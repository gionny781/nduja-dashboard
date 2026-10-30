"""Chat di famiglia di 'Nduja Dashboard: messaggi tra le persone di casa, salvati solo in Home Assistant.

Membri: gli utenti attivi di Home Assistant collegati a una persona. Conversazioni:
- «famiglia»: tutti i membri;
- «d:<uid>+<uid>»: due persone (id degli utenti in ordine alfabetico).
Ogni controllo (chi vede, chi scrive, chi cancella) è fatto qui, lato server: un utente riceve solo le conversazioni
di cui fa parte, anche negli avvisi in tempo reale. Gli avvisi passano dal dispatcher interno e non dal bus degli eventi,
così nemmeno un amministratore che ascolta tutti gli eventi vede i messaggi degli altri.

Store «nduja_dashboard.chat»:
{ "conv": { id: { "n": ultimo numero, "msg": [ {n, da, quando, tipo, testo?, dati?} ], "letti": {uid: n} } },
  "muti": [uid che non vogliono le notifiche sul telefono] }
Le foto delle telecamere sono file JPEG in .storage/nduja_dashboard.chat_foto (fuori da /local, quindi non pubbliche)
e si vedono solo con l'indirizzo firmato di chi fa parte della conversazione.
"""
from __future__ import annotations

import logging
import re
import shutil
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any
from urllib.parse import quote

import voluptuous as vol
from aiohttp import web
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.components.http import KEY_HASS_USER, HomeAssistantView
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from .const import DOMAIN, PANEL_URL

_LOGGER = logging.getLogger(__name__)

STORE_CHAT = f"{DOMAIN}.chat"
FOTO_DIR = f"{DOMAIN}.chat_foto"
SEGNALE = f"{DOMAIN}_chat"

MAX_MSG = 500           # messaggi tenuti per conversazione: i più vecchi si cancellano da soli
MAX_FOTO = 60           # foto tenute per conversazione (le più vecchie diventano «foto non più disponibile»)
MAX_TESTO = 1000
MAX_FOTO_BYTE = 4 * 1024 * 1024
RITMO = (12, 15)        # al massimo 12 messaggi ogni 15 secondi per persona
PRESENTE_S = 300        # plancia aperta e usata negli ultimi 5 minuti: niente notifica sul telefono
FAMIGLIA = "famiglia"
TIPI = ("testo", "pos", "foto", "spesa")

UID = r"[A-Za-z0-9_-]{1,64}"
CONV = vol.All(str, vol.Match(rf"^({FAMIGLIA}|d:{UID}\+{UID})$"))


def _dati(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.setdefault(DOMAIN, {})


def _chat(hass: HomeAssistant) -> dict[str, Any] | None:
    return _dati(hass).get("chat")


def _cartella(hass: HomeAssistant) -> Path:
    return Path(hass.config.path(".storage")) / FOTO_DIR


async def async_setup_chat(hass: HomeAssistant) -> None:
    """Carica i messaggi e registra comandi e indirizzo delle foto (una volta sola)."""
    data = _dati(hass)
    if "chat_store" not in data:
        data["chat_store"] = Store(hass, 1, STORE_CHAT)
        dati = await data["chat_store"].async_load() or {}
        data["chat"] = {"conv": dati.get("conv") or {}, "muti": list(dati.get("muti") or [])}
    if not data.get("chat_comandi"):
        data["chat_comandi"] = True
        for cmd in (ws_chat_get, ws_chat_msg, ws_chat_send, ws_chat_read, ws_chat_delete, ws_chat_notifiche,
                    ws_chat_subscribe, ws_chat_presenza):
            websocket_api.async_register_command(hass, cmd)
        hass.http.register_view(NdujaChatFotoView(hass))


async def async_remove_chat(hass: HomeAssistant) -> None:
    """Integrazione rimossa: cancello messaggi e foto."""
    await Store(hass, 1, STORE_CHAT).async_remove()
    cartella = _cartella(hass)
    await hass.async_add_executor_job(lambda: shutil.rmtree(cartella, ignore_errors=True))
    data = _dati(hass)
    data.pop("chat_store", None)
    data.pop("chat", None)


def _salva(hass: HomeAssistant) -> None:
    data = _dati(hass)
    if "chat_store" in data:
        data["chat_store"].async_delay_save(lambda: data["chat"], 1)


# ---------------- chi fa parte della famiglia ----------------
async def _membri(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """Utenti attivi collegati a una persona: {uid: {uid, nome, persona}}. Li tengo anche in cache per gli avvisi."""
    persone: dict[str, Any] = {}
    for st in hass.states.async_all("person"):
        uid = st.attributes.get("user_id")
        if uid and uid not in persone:
            persone[uid] = st
    out: dict[str, dict[str, Any]] = {}
    for u in await hass.auth.async_get_users():
        if u.system_generated or not u.is_active or u.id not in persone:
            continue
        p = persone[u.id]
        out[u.id] = {"uid": u.id, "nome": p.name or u.name or "?", "persona": p.entity_id}
    _dati(hass)["chat_membri"] = set(out)
    return out


def _coppia(conv: str) -> tuple[str, str] | None:
    if not conv.startswith("d:"):
        return None
    a, _, b = conv[2:].partition("+")
    return (a, b) if a and b and a < b else None


def _partecipanti(conv: str, membri) -> set[str]:
    if conv == FAMIGLIA:
        return set(membri)
    c = _coppia(conv)
    return set(c) if c else set()


def _vede(uid: str, conv: str, membri) -> bool:
    """Un utente vede solo le conversazioni di cui fa parte."""
    if conv == FAMIGLIA:
        return uid in membri
    c = _coppia(conv)
    return bool(c) and uid in c


def _scrive(uid: str, conv: str, membri) -> bool:
    if conv == FAMIGLIA:
        return uid in membri
    c = _coppia(conv)
    return bool(c) and uid in c and c[0] in membri and c[1] in membri


def _conv(chat: dict[str, Any], conv: str, crea: bool = False) -> dict[str, Any] | None:
    c = chat["conv"].get(conv)
    if c is None and crea:
        c = chat["conv"][conv] = {"n": 0, "msg": [], "letti": {}}
    return c


def _non_letti(c: dict[str, Any], uid: str) -> int:
    letto = c.get("letti", {}).get(uid, 0)
    return sum(1 for m in c["msg"] if m["n"] > letto and m["da"] != uid and m["tipo"] != "cancellato")


def _letti(c: dict[str, Any], conv: str, membri) -> dict[str, int]:
    parti = _partecipanti(conv, membri)
    return {u: n for u, n in c.get("letti", {}).items() if u in parti}


# ---------------- notifiche sul telefono ----------------
def _telefoni(hass: HomeAssistant, persona: str | None) -> list[tuple[str, str]]:
    """Servizi notify.mobile_app_* dei telefoni della persona (dai suoi device_tracker dell'app): [(servizio, nome)]."""
    st = hass.states.get(persona) if persona else None
    if st is None:
        return []
    reg, out = er.async_get(hass), []
    for tracker in st.attributes.get("device_trackers") or []:
        e = reg.async_get(tracker)
        if e is None or e.platform != "mobile_app" or not e.config_entry_id:
            continue
        ce = hass.config_entries.async_get_entry(e.config_entry_id)
        nome = ce.data.get("device_name") if ce else None
        if not nome:
            continue
        servizio = "mobile_app_" + slugify(nome)
        if hass.services.has_service("notify", servizio) and all(s != servizio for s, _ in out):
            out.append((servizio, nome))
    return out


def _presente(hass: HomeAssistant, uid: str) -> bool:
    """La persona ha la plancia aperta, visibile e usata da poco su almeno un dispositivo."""
    ora = time.monotonic()
    return any(p["uid"] == uid and p["vis"] and ora - p["t"] < PRESENTE_S for p in _dati(hass).get("chat_presenze", {}).values())


def _anteprima(m: dict[str, Any], it: bool) -> str:
    d = m.get("dati") or {}
    if m["tipo"] == "pos":
        return "📍 " + ("Posizione" if it else "Location") + (f" · {d['zona']}" if d.get("zona") else "")
    if m["tipo"] == "foto":
        return "📷 " + ("Foto" if it else "Photo") + (f" · {d['cam']}" if d.get("cam") else "")
    if m["tipo"] == "spesa":
        return "🛒 " + str(d.get("voce", ""))
    testo = str(m.get("testo", ""))
    return testo if len(testo) <= 220 else testo[:219] + "…"


async def _notifica(hass: HomeAssistant, servizio: str, dati: dict[str, Any], ctx: Context) -> None:
    try:
        await hass.services.async_call("notify", servizio, dati, blocking=True, context=ctx)
    except (HomeAssistantError, vol.Invalid) as err:
        _LOGGER.warning("Chat: notifica a %s non inviata: %s", servizio, err)


def _notifiche(hass: HomeAssistant, conv: str, m: dict[str, Any], membri: dict[str, dict[str, Any]], ctx: Context) -> None:
    chat = _chat(hass)
    it = str(hass.config.language or "").lower().startswith("it")
    mittente = membri.get(m["da"], {}).get("nome", "?")
    titolo = f"💬 {'Famiglia' if it else 'Family'} · {mittente}" if conv == FAMIGLIA else f"💬 {mittente}"
    url = f"/{PANEL_URL}?apri=" + quote(f"chat:{conv}", safe=":")   # il «+» delle chat a due va scritto %2B
    for uid in _partecipanti(conv, membri) - {m["da"]}:
        if uid in chat["muti"] or uid not in membri or _presente(hass, uid):
            continue
        for servizio, _nome in _telefoni(hass, membri[uid]["persona"]):
            hass.async_create_task(_notifica(hass, servizio, {
                "title": titolo, "message": _anteprima(m, it),
                "data": {"url": url, "clickAction": url, "group": f"nduja-chat-{conv}", "channel": "Chat 'Nduja"},
            }, ctx), f"{DOMAIN} chat notifica")


# ---------------- foto ----------------
def _foto_file(hass: HomeAssistant, nome: str) -> Path:
    return _cartella(hass) / f"{nome}.jpg"


def _togli_foto(hass: HomeAssistant, m: dict[str, Any]) -> None:
    f = (m.get("dati") or {}).get("f")
    if m.get("tipo") == "foto" and f and re.fullmatch(r"[0-9a-f]{32}", f):
        percorso = _foto_file(hass, f)
        hass.async_add_executor_job(lambda: percorso.unlink(missing_ok=True))


def _pulisci(hass: HomeAssistant, c: dict[str, Any]) -> None:
    """Tiene al massimo MAX_MSG messaggi e MAX_FOTO foto per conversazione."""
    while len(c["msg"]) > MAX_MSG:
        _togli_foto(hass, c["msg"].pop(0))
    foto = [m for m in c["msg"] if m["tipo"] == "foto" and not m.get("dati", {}).get("persa")]
    for m in foto[:max(0, len(foto) - MAX_FOTO)]:
        _togli_foto(hass, m)
        m["dati"] = {"cam": m.get("dati", {}).get("cam", ""), "persa": True}


class NdujaChatFotoView(HomeAssistantView):
    """Foto della chat: solo per chi fa parte della conversazione (indirizzo firmato con auth/sign_path)."""

    url = f"/api/{DOMAIN}/chat_foto/{{conv}}/{{foto}}"
    name = f"api:{DOMAIN}:chat_foto"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request: web.Request, conv: str, foto: str) -> web.Response:
        hass, user = self._hass, request.get(KEY_HASS_USER)
        chat = _chat(hass)
        if chat is None or user is None or not re.fullmatch(r"[0-9a-f]{32}", foto):
            return web.Response(status=404)
        membri = await _membri(hass)
        c = chat["conv"].get(conv)
        if c is None or not _vede(user.id, conv, membri) or not any(m["tipo"] == "foto" and (m.get("dati") or {}).get("f") == foto for m in c["msg"]):
            return web.Response(status=404)
        percorso = _foto_file(hass, foto)
        corpo = await hass.async_add_executor_job(lambda: percorso.read_bytes() if percorso.is_file() else None)
        if corpo is None:
            return web.Response(status=404)
        return web.Response(body=corpo, content_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


async def _scatta(hass: HomeAssistant, user, camera: str) -> str:
    """Prende una foto dalla telecamera e la salva: restituisce il suo nome."""
    from homeassistant.components.camera import async_get_image  # pylint: disable=import-outside-toplevel

    if not user.permissions.check_entity(camera, POLICY_READ):
        raise HomeAssistantError("unauthorized")
    img = await async_get_image(hass, camera, timeout=15, width=1280)
    if not img.content or len(img.content) > MAX_FOTO_BYTE:
        raise HomeAssistantError("foto troppo grande")
    if "jpeg" not in (img.content_type or "") and "jpg" not in (img.content_type or ""):
        raise HomeAssistantError("la telecamera non dà una foto JPEG")
    nome, cartella = uuid.uuid4().hex, _cartella(hass)

    def scrivi() -> None:
        cartella.mkdir(parents=True, exist_ok=True)
        _foto_file(hass, nome).write_bytes(img.content)

    await hass.async_add_executor_job(scrivi)
    return nome


# ---------------- comandi websocket (per qualsiasi utente autenticato) ----------------
def _pronta(hass: HomeAssistant, connection, msg) -> dict[str, Any] | None:
    chat = _chat(hass)
    if chat is None:
        connection.send_error(msg["id"], "not_ready", "'Nduja Dashboard non è configurata")
    return chat


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/chat_get"})
@websocket_api.async_response
async def ws_chat_get(hass: HomeAssistant, connection, msg) -> None:
    """Membri e conversazioni di chi chiede (solo le sue), con l'ultimo messaggio e quanti non ha letto."""
    if (chat := _pronta(hass, connection, msg)) is None:
        return
    uid, membri = connection.user.id, await _membri(hass)
    conv = []
    for cid, c in chat["conv"].items():
        if not _vede(uid, cid, membri):
            continue
        conv.append({"id": cid, "n": c["n"], "ultimo": c["msg"][-1] if c["msg"] else None,
                     "non_letti": _non_letti(c, uid), "letti": _letti(c, cid, membri)})
    io = membri.get(uid)
    connection.send_result(msg["id"], {
        "io": uid, "membro": io is not None, "membri": list(membri.values()), "conv": conv,
        "notifiche": uid not in chat["muti"],
        "telefoni": [nome for _s, nome in _telefoni(hass, io["persona"])] if io else [],
        "limiti": {"testo": MAX_TESTO, "msg": MAX_MSG},
    })


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/chat_msg",
    vol.Required("conv"): CONV,
    vol.Optional("prima"): vol.All(int, vol.Range(min=1)),
    vol.Optional("limite", default=60): vol.All(int, vol.Range(min=1, max=200)),
})
@websocket_api.async_response
async def ws_chat_msg(hass: HomeAssistant, connection, msg) -> None:
    """I messaggi di una conversazione, dai più recenti (con «prima» quelli precedenti a quel numero)."""
    if (chat := _pronta(hass, connection, msg)) is None:
        return
    uid, membri, cid = connection.user.id, await _membri(hass), msg["conv"]
    if not _vede(uid, cid, membri):
        connection.send_error(msg["id"], "unauthorized", "non fai parte di questa conversazione")
        return
    c = _conv(chat, cid) or {"n": 0, "msg": [], "letti": {}}
    L = [m for m in c["msg"] if "prima" not in msg or m["n"] < msg["prima"]]
    parte = L[-msg["limite"]:]
    connection.send_result(msg["id"], {"conv": cid, "n": c["n"], "msg": parte, "altri": len(L) > len(parte),
                                       "letti": _letti(c, cid, membri)})


def _testo(v: Any, massimo: int) -> str:
    s = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", str(v or "")).replace("\r", "")
    return re.sub(r"\n{3,}", "\n\n", s).strip()[:massimo]


def _num(v: Any, lo: float, hi: float) -> float:
    x = float(v)
    if not lo <= x <= hi:
        raise ValueError
    return round(x, 6)


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/chat_send",
    vol.Required("conv"): CONV,
    vol.Required("tipo"): vol.In(TIPI),
    vol.Optional("testo"): vol.All(str, vol.Length(max=MAX_TESTO * 2)),
    vol.Optional("dati"): vol.All(dict, vol.Length(max=8)),
    vol.Optional("camera"): vol.All(str, vol.Match(r"^camera\.[a-z0-9_]+$")),
})
@websocket_api.async_response
async def ws_chat_send(hass: HomeAssistant, connection, msg) -> None:
    """Manda un messaggio: testo, posizione, foto di una telecamera di casa o elemento della lista della spesa."""
    if (chat := _pronta(hass, connection, msg)) is None:
        return
    uid, membri, cid, tipo = connection.user.id, await _membri(hass), msg["conv"], msg["tipo"]
    if not _scrive(uid, cid, membri):
        connection.send_error(msg["id"], "unauthorized", "non fai parte di questa conversazione")
        return
    ritmo = _dati(hass).setdefault("chat_ritmo", {}).setdefault(uid, deque(maxlen=RITMO[0]))
    ora = time.monotonic()
    if len(ritmo) == RITMO[0] and ora - ritmo[0] < RITMO[1]:
        connection.send_error(msg["id"], "too_fast", "troppi messaggi insieme")
        return
    d, nuovo = msg.get("dati") or {}, {"tipo": tipo}
    try:
        if tipo == "testo":
            nuovo["testo"] = _testo(msg.get("testo"), MAX_TESTO)
            if not nuovo["testo"]:
                raise ValueError
        elif tipo == "pos":
            nuovo["dati"] = {"lat": _num(d.get("lat"), -90, 90), "lon": _num(d.get("lon"), -180, 180),
                             "zona": _testo(d.get("zona"), 60)}
            if d.get("acc") is not None:
                nuovo["dati"]["acc"] = int(_num(d["acc"], 0, 100000))
        elif tipo == "spesa":
            nuovo["dati"] = {"voce": _testo(d.get("voce"), 200), "lista": _testo(d.get("lista"), 80)}
            if not nuovo["dati"]["voce"]:
                raise ValueError
        elif tipo == "foto" and not msg.get("camera"):
            raise ValueError
    except (TypeError, ValueError):
        connection.send_error(msg["id"], "invalid_format", "messaggio non valido")
        return
    if tipo == "foto":
        camera = msg["camera"]
        st = hass.states.get(camera)
        try:
            nome = await _scatta(hass, connection.user, camera)
        except HomeAssistantError as err:
            code = "unauthorized" if str(err) == "unauthorized" else "camera"
            connection.send_error(msg["id"], code, str(err) or "foto non riuscita")
            return
        nuovo["dati"] = {"f": nome, "cam": _testo(d.get("cam"), 60) or _testo(st.name if st else camera, 60)}
    ritmo.append(ora)
    c = _conv(chat, cid, crea=True)
    c["n"] += 1
    m = {"n": c["n"], "da": uid, "quando": dt_util.utcnow().isoformat(timespec="seconds"), **nuovo}
    c["msg"].append(m)
    c.setdefault("letti", {})[uid] = c["n"]
    _pulisci(hass, c)
    _salva(hass)
    async_dispatcher_send(hass, SEGNALE, {"conv": cid, "tipo": "nuovo", "msg": m})
    connection.send_result(msg["id"], {"conv": cid, "msg": m})
    _notifiche(hass, cid, m, membri, Context(user_id=uid))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/chat_read",
    vol.Required("conv"): CONV,
    vol.Required("n"): vol.All(int, vol.Range(min=0)),
})
@websocket_api.async_response
async def ws_chat_read(hass: HomeAssistant, connection, msg) -> None:
    """Segna come letti i messaggi fino al numero «n»."""
    if (chat := _pronta(hass, connection, msg)) is None:
        return
    uid, membri, cid = connection.user.id, await _membri(hass), msg["conv"]
    if not _vede(uid, cid, membri):
        connection.send_error(msg["id"], "unauthorized", "non fai parte di questa conversazione")
        return
    c = _conv(chat, cid)
    if c is None:
        connection.send_result(msg["id"], {"n": 0})
        return
    letti = c.setdefault("letti", {})
    n = min(msg["n"], c["n"])
    if n > letti.get(uid, 0):
        letti[uid] = n
        _salva(hass)
        async_dispatcher_send(hass, SEGNALE, {"conv": cid, "tipo": "letto", "uid": uid, "n": n})
    connection.send_result(msg["id"], {"n": letti.get(uid, 0)})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/chat_delete",
    vol.Required("conv"): CONV,
    vol.Required("n"): vol.All(int, vol.Range(min=1)),
})
@websocket_api.async_response
async def ws_chat_delete(hass: HomeAssistant, connection, msg) -> None:
    """Cancella un proprio messaggio: resta il segno «messaggio cancellato», il contenuto (e la foto) sparisce."""
    if (chat := _pronta(hass, connection, msg)) is None:
        return
    uid, membri, cid = connection.user.id, await _membri(hass), msg["conv"]
    c = _conv(chat, cid)
    m = next((x for x in c["msg"] if x["n"] == msg["n"]), None) if c and _vede(uid, cid, membri) else None
    if m is None:
        connection.send_error(msg["id"], "not_found", "messaggio non trovato")
        return
    if m["da"] != uid:
        connection.send_error(msg["id"], "unauthorized", "puoi cancellare solo i tuoi messaggi")
        return
    if m["tipo"] != "cancellato":
        _togli_foto(hass, m)
        m.pop("testo", None)
        m.pop("dati", None)
        m["tipo"] = "cancellato"
        _salva(hass)
        async_dispatcher_send(hass, SEGNALE, {"conv": cid, "tipo": "cancellato", "n": m["n"]})
    connection.send_result(msg["id"], {"n": m["n"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/chat_notifiche", vol.Required("attive"): bool})
@websocket_api.async_response
async def ws_chat_notifiche(hass: HomeAssistant, connection, msg) -> None:
    """Ognuno accende o spegne per sé le notifiche della chat sul telefono."""
    if (chat := _pronta(hass, connection, msg)) is None:
        return
    uid = connection.user.id
    chat["muti"] = [u for u in chat["muti"] if u != uid] + ([] if msg["attive"] else [uid])
    _salva(hass)
    connection.send_result(msg["id"], {"notifiche": msg["attive"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/chat_subscribe"})
@callback
def ws_chat_subscribe(hass: HomeAssistant, connection, msg) -> None:
    """Avvisi in tempo reale, filtrati qui: arrivano solo quelli delle conversazioni di chi ascolta."""
    uid, data = connection.user.id, _dati(hass)
    presenze = data.setdefault("chat_presenze", {})
    chiave = (id(connection), msg["id"])
    presenze[chiave] = {"uid": uid, "conn": id(connection), "vis": False, "t": 0.0}

    @callback
    def inoltra(ev: dict[str, Any]) -> None:
        if _vede(uid, ev["conv"], data.get("chat_membri", set())):
            connection.send_message(websocket_api.event_message(msg["id"], ev))

    stacca = async_dispatcher_connect(hass, SEGNALE, inoltra)

    @callback
    def fine() -> None:
        stacca()
        presenze.pop(chiave, None)

    connection.subscriptions[msg["id"]] = fine
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/chat_presenza", vol.Required("visibile"): bool})
@callback
def ws_chat_presenza(hass: HomeAssistant, connection, msg) -> None:
    """La plancia dice se è aperta e usata su questo dispositivo: allora niente notifiche sul telefono."""
    for p in _dati(hass).get("chat_presenze", {}).values():
        if p["conn"] == id(connection):
            p["vis"], p["t"] = msg["visibile"], time.monotonic()
    connection.send_result(msg["id"])

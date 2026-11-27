"""Copie di sicurezza delle scelte della casa (0.7.63).

Una copia contiene le scelte della plancia (layout, solo amministratori) e i dati della casa (Faccende, Bacheca, Liste,
viste del Colpo d'occhio, piante…). Restano fuori le sezioni che sono lo stato del momento e non scelte di qualcuno
(«pause» delle automazioni e «irrigazione»: zone che stanno irrigando, pausa per pioggia): ripristinare non tocca
dispositivi né automazioni.

Quando: prima della procedura guidata, di un'importazione, di un ripristino, di «Ricomincia dal benvenuto», al primo avvio
di una versione nuova di 'Nduja, e una volta al giorno se qualcosa è cambiato. Due copie di fila uguali non si fanno
(tranne quelle prima di un aggiornamento, di un ripristino o di un'importazione, che devono comparire nell'elenco;
i dati uguali non occupano altro spazio).
Quante: le ultime 10, più la più recente di ognuna delle 3 versioni di 'Nduja più recenti.

Store «nduja_dashboard.copie» (in .storage, quindi anche nei backup di Home Assistant):
{ "versione": ultima versione avviata,
  "copie": [ {id, ts, motivo, param, chi, versione, h} ]   (dalla più recente),
  "dati": { h: {"z": JSON compresso con zlib in base64, "byte": byte compressi, "grezzi": byte del JSON} },
  "chi": [nomi di chi ha cambiato qualcosa dopo l'ultima copia] }
Le copie con lo stesso contenuto condividono gli stessi dati (h = impronta del contenuto), così non gonfiano lo spazio.
"""
from __future__ import annotations

import asyncio
import base64
import copy
import hashlib
import json
import logging
import secrets
import zlib
from datetime import timedelta
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN, VERSION

_LOGGER = logging.getLogger(__name__)

STORE_COPIE = f"{DOMAIN}.copie"
ULTIME = 10                  # copie più recenti tenute
VERSIONI = 3                 # versioni di 'Nduja di cui tengo sempre l'ultima copia
ESCLUSE = frozenset({"pause", "irrigazione"})   # stato del momento, non scelte: non si copiano e non si ripristinano
MOTIVI_PLANCIA = ("guidata", "importa", "predefiniti")   # copie chieste dalla plancia prima di un cambiamento grosso
OGNI = timedelta(hours=24)   # copia di ogni giorno: al massimo una ogni 24 ore, e solo se qualcosa è cambiato
CONTROLLO = timedelta(hours=1)
MAX_TUTTE = 8 * 1024 * 1024  # tetto di sicurezza per tutte le copie insieme (compresse)
MAX_CHI = 8


def _json(x: Any) -> bytes:
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def _comprimi(grezzi: bytes) -> str:
    return base64.b64encode(zlib.compress(grezzi, 9)).decode()


def _espandi(z: str) -> dict[str, Any]:
    return json.loads(zlib.decompress(base64.b64decode(z)).decode())


class Copie:
    """Le copie di sicurezza: una sola istanza in hass.data[DOMAIN]["copie"]."""

    def __init__(self, hass: HomeAssistant, evento_layout: str, evento_casa: str, sezione_valida: Any,
                 max_sezione: int, max_sezioni: int) -> None:
        self.hass = hass
        self.store = Store(hass, 1, STORE_COPIE)
        self.d: dict[str, Any] = {}
        self.lock = asyncio.Lock()
        self.evento_layout, self.evento_casa = evento_layout, evento_casa
        self.sezione_valida, self.max_sezione, self.max_sezioni = sezione_valida, max_sezione, max_sezioni
        self.annulla: list[Any] = []

    @property
    def _dati(self) -> dict[str, Any]:
        return self.hass.data[DOMAIN]

    async def async_carica(self) -> None:
        d = await self.store.async_load() or {}
        self.d = {"versione": d.get("versione"), "copie": list(d.get("copie") or []),
                  "dati": dict(d.get("dati") or {}), "chi": list(d.get("chi") or [])}

    async def _salva(self) -> None:
        await self.store.async_save(self.d)

    # ---------- contenuto ----------
    def istantanea(self) -> dict[str, Any]:
        """Le scelte di adesso: layout e sezioni della casa (meno quelle escluse)."""
        casa = self._dati.get("casa", {})
        return {"layout": copy.deepcopy(self._dati.get("layout", {})),
                "casa": {k: copy.deepcopy((v or {}).get("dati", {})) for k, v in casa.items() if k not in ESCLUSE}}

    @staticmethod
    def _vuota(snap: dict[str, Any]) -> bool:
        return not snap.get("layout") and not any(snap.get("casa", {}).values())

    # ---------- chi ha cambiato qualcosa ----------
    @callback
    def segna_chi(self, nome: str | None) -> None:
        """Chiamata da ogni salvataggio della plancia: chi ha cambiato qualcosa dopo l'ultima copia."""
        if not nome or nome in self.d.get("chi", []):
            return
        self.d.setdefault("chi", []).append(nome)
        del self.d["chi"][:-MAX_CHI]
        self.store.async_delay_save(lambda: self.d, 30)

    # ---------- creare e potare ----------
    async def async_crea(self, motivo: str, param: dict[str, Any] | None = None, chi: str | None = None,
                         versione: str | None = VERSION, sempre: bool = False) -> dict[str, Any] | None:
        """Fa una copia di adesso. Se è uguale all'ultima non ne fa un'altra (restituisce l'ultima), tranne con sempre=True
        (la copia «prima dell'aggiornamento», che si vuole vedere nell'elenco: i dati uguali non occupano altro spazio)."""
        async with self.lock:
            snap = self.istantanea()
            grezzi = _json(snap)
            h = hashlib.sha1(grezzi).hexdigest()[:16]
            copie = self.d["copie"]
            if copie and copie[0].get("h") == h and not sempre:
                return copie[0]
            if not copie and self._vuota(snap):
                return None   # niente da salvare (plancia appena installata)
            if h not in self.d["dati"]:
                z = await self.hass.async_add_executor_job(_comprimi, grezzi)
                self.d["dati"][h] = {"z": z, "byte": len(z) * 3 // 4, "grezzi": len(grezzi)}
            nuova = {"id": secrets.token_hex(6), "ts": dt_util.utcnow().isoformat(timespec="seconds"), "motivo": motivo,
                     "param": param or {}, "chi": chi, "versione": versione, "h": h}
            copie.insert(0, nuova)
            self.d["chi"] = []
            self._pota()
            await self._salva()
            return nuova

    def _tenute(self) -> set[str]:
        """id delle copie da tenere: le ultime ULTIME e la più recente di ognuna delle ultime VERSIONI versioni."""
        copie = self.d["copie"]
        tieni = {c["id"] for c in copie[:ULTIME]}
        viste: list[Any] = []
        for c in copie:
            v = c.get("versione") or ""
            if v in viste:
                continue
            viste.append(v)
            if len(viste) > VERSIONI:
                break
            tieni.add(c["id"])
        return tieni

    def _pota(self) -> None:
        tieni = self._tenute()
        self.d["copie"] = [c for c in self.d["copie"] if c["id"] in tieni]
        while len(self.d["copie"]) > 1 and self._byte() > MAX_TUTTE:
            self.d["copie"].pop()   # tetto di sicurezza: via la più vecchia
            self._pulisci()
        self._pulisci()

    def _pulisci(self) -> None:
        usati = {c["h"] for c in self.d["copie"]}
        self.d["dati"] = {h: x for h, x in self.d["dati"].items() if h in usati}

    def _byte(self) -> int:
        return sum(x.get("byte", 0) for x in self.d["dati"].values())

    def elenco(self) -> dict[str, Any]:
        recenti = {c["id"] for c in self.d["copie"][:ULTIME]}
        dati = self.d["dati"]
        return {"copie": [{k: c.get(k) for k in ("id", "ts", "motivo", "param", "chi", "versione")}
                          | {"byte": dati.get(c["h"], {}).get("byte", 0), "grezzi": dati.get(c["h"], {}).get("grezzi", 0),
                             "tenuta": c["id"] not in recenti}
                          for c in self.d["copie"]],
                "byte": self._byte(), "ultime": ULTIME, "versioni": VERSIONI, "versione": VERSION}

    def trova(self, cid: str) -> dict[str, Any] | None:
        return next((c for c in self.d["copie"] if c["id"] == cid), None)

    async def async_contenuto(self, c: dict[str, Any]) -> dict[str, Any]:
        return await self.hass.async_add_executor_job(_espandi, self.d["dati"][c["h"]]["z"])

    async def async_elimina(self, cid: str) -> bool:
        async with self.lock:
            n = len(self.d["copie"])
            self.d["copie"] = [c for c in self.d["copie"] if c["id"] != cid]
            if len(self.d["copie"]) == n:
                return False
            self._pulisci()
            await self._salva()
            return True

    # ---------- ripristinare ----------
    def valida(self, snap: Any) -> dict[str, Any]:
        """Controlla il contenuto di una copia o di un file importato: {"layout": {...}, "casa": {...}?}."""
        if not isinstance(snap, dict) or not isinstance(snap.get("layout"), dict):
            raise vol.Invalid("layout")
        out: dict[str, Any] = {"layout": snap["layout"]}
        if "casa" in snap:
            casa = snap["casa"]
            if not isinstance(casa, dict) or len(casa) > self.max_sezioni:
                raise vol.Invalid("casa")
            for nome, dati in casa.items():
                self.sezione_valida(nome)
                if not isinstance(dati, dict) or len(_json(dati)) > self.max_sezione:
                    raise vol.Invalid(nome)
            out["casa"] = {k: v for k, v in casa.items() if k not in ESCLUSE}
        return out

    async def async_applica(self, snap: dict[str, Any], user_id: str | None) -> list[str]:
        """Rimette le scelte della copia: il layout e, se la copia li ha, i dati della casa (le sezioni che non
        c'erano tornano vuote). Restituisce le sezioni della casa cambiate."""
        data = self._dati
        data["layout"] = copy.deepcopy(snap["layout"])
        await data["store"].async_save(data["layout"])
        self.hass.bus.async_fire(self.evento_layout, {})
        if "casa" not in snap:
            return []
        casa, cambiate = data["casa"], []
        for nome in sorted(set(snap["casa"]) | {k for k in casa if k not in ESCLUSE}):
            if nome in ESCLUSE:
                continue
            nuovi = snap["casa"].get(nome, {})
            prima = casa.get(nome) or {}
            if prima.get("dati", {}) == nuovi:
                continue
            if nome not in casa and len(casa) >= self.max_sezioni:
                continue
            casa[nome] = {"rev": prima.get("rev", 0) + 1, "dati": copy.deepcopy(nuovi)}
            cambiate.append(nome)
        if cambiate:
            await data["casa_store"].async_save(casa)
            for nome in cambiate:
                self.hass.bus.async_fire(self.evento_casa, {"sezione": nome, "rev": casa[nome]["rev"], "user_id": user_id})
        return cambiate

    # ---------- da soli: aggiornamento e copia di ogni giorno ----------
    async def async_avvio(self) -> None:
        """Al primo avvio di una versione nuova: copia «prima dell'aggiornamento» (con le scelte della versione di prima)."""
        prima = self.d.get("versione")
        if prima != VERSION:
            try:
                await self.async_crea("aggiornamento", {"da": prima, "a": VERSION}, None, prima or "", sempre=True)
            except Exception:  # noqa: BLE001 - una copia non riuscita non deve fermare la plancia
                _LOGGER.exception("'Nduja: copia prima dell'aggiornamento non riuscita")
            self.d["versione"] = VERSION
            await self._salva()

        async def controlla(_ora=None) -> None:
            copie = self.d["copie"]
            if copie and dt_util.utcnow() - (dt_util.parse_datetime(copie[0]["ts"]) or dt_util.utcnow()) < OGNI:
                return
            try:
                await self.async_crea("giorno", None, ", ".join(self.d.get("chi") or []) or None)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("'Nduja: copia di ogni giorno non riuscita")

        self.annulla.append(async_track_time_interval(self.hass, controlla, CONTROLLO))
        self.annulla.append(async_call_later(self.hass, 120, controlla))

    def ferma(self) -> None:
        for a in self.annulla:
            a()
        self.annulla.clear()


def _copie(hass: HomeAssistant) -> Copie | None:
    return hass.data.get(DOMAIN, {}).get("copie")


async def async_setup_copie(hass: HomeAssistant, evento_layout: str, evento_casa: str, sezione_valida: Any,
                            max_sezione: int, max_sezioni: int) -> None:
    data = hass.data[DOMAIN]
    if not data.get("copie_ws"):
        data["copie_ws"] = True
        for cmd in (ws_copie_lista, ws_copie_crea, ws_copie_get, ws_copie_elimina, ws_copie_ripristina):
            websocket_api.async_register_command(hass, cmd)
    if "copie" not in data:
        c = Copie(hass, evento_layout, evento_casa, sezione_valida, max_sezione, max_sezioni)
        await c.async_carica()
        data["copie"] = c
        await c.async_avvio()


async def async_remove_copie(hass: HomeAssistant) -> None:
    c = hass.data.get(DOMAIN, {}).pop("copie", None)
    if c:
        c.ferma()
    await Store(hass, 1, STORE_COPIE).async_remove()


@callback
def segna_chi(hass: HomeAssistant, connection) -> None:
    c = _copie(hass)
    if c and connection.user:
        c.segna_chi(connection.user.name)


def _non_pronte(connection, msg) -> None:
    connection.send_error(msg["id"], "not_ready", "'Nduja Dashboard non è configurata")


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/copie_lista"})
@callback
def ws_copie_lista(hass: HomeAssistant, connection, msg) -> None:
    c = _copie(hass)
    if c is None:
        return _non_pronte(connection, msg)
    connection.send_result(msg["id"], c.elenco())


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/copie_crea", vol.Required("motivo"): vol.In(MOTIVI_PLANCIA)})
@websocket_api.async_response
async def ws_copie_crea(hass: HomeAssistant, connection, msg) -> None:
    """La plancia chiede una copia prima di un cambiamento grosso (procedura guidata, importazione, ricomincia)."""
    c = _copie(hass)
    if c is None:
        return _non_pronte(connection, msg)
    nuova = await c.async_crea(msg["motivo"], None, connection.user.name)
    connection.send_result(msg["id"], {"id": nuova["id"] if nuova else None})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/copie_get", vol.Required("copia"): str})
@websocket_api.async_response
async def ws_copie_get(hass: HomeAssistant, connection, msg) -> None:
    """Il contenuto di una copia: per «Scarica» e per dire cosa cambierà ripristinandola."""
    c = _copie(hass)
    if c is None:
        return _non_pronte(connection, msg)
    x = c.trova(msg["copia"])
    if x is None:
        connection.send_error(msg["id"], "not_found", msg["copia"])
        return
    connection.send_result(msg["id"], {**{k: x.get(k) for k in ("id", "ts", "motivo", "param", "chi", "versione")}, **await c.async_contenuto(x)})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/copie_elimina", vol.Required("copia"): str})
@websocket_api.async_response
async def ws_copie_elimina(hass: HomeAssistant, connection, msg) -> None:
    c = _copie(hass)
    if c is None:
        return _non_pronte(connection, msg)
    if not await c.async_elimina(msg["copia"]):
        connection.send_error(msg["id"], "not_found", msg["copia"])
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/copie_ripristina",
    vol.Exclusive("copia", "da"): str,
    vol.Exclusive("dati", "da"): dict,
})
@websocket_api.async_response
async def ws_copie_ripristina(hass: HomeAssistant, connection, msg) -> None:
    """Rimette una copia («copia»: il suo id) o il contenuto di un file importato («dati»). Prima fa una copia di adesso."""
    c = _copie(hass)
    if c is None:
        return _non_pronte(connection, msg)
    if "copia" in msg:
        x = c.trova(msg["copia"])
        if x is None:
            connection.send_error(msg["id"], "not_found", msg["copia"])
            return
        snap, motivo, param = await c.async_contenuto(x), "ripristino", {"ts": x["ts"]}
    elif "dati" in msg:
        snap, motivo, param = msg["dati"], "importa", {}
    else:
        connection.send_error(msg["id"], "invalid_format", "copia o dati")
        return
    try:
        snap = c.valida(snap)
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_format", f"dati non validi: {err}")
        return
    prima = await c.async_crea(motivo, param, connection.user.name, sempre=True)   # promessa all'utente: si vede sempre nell'elenco
    cambiate = await c.async_applica(snap, connection.user.id)
    connection.send_result(msg["id"], {"ok": True, "prima": prima["id"] if prima else None, "casa": cambiate})

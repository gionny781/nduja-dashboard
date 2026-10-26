"""'Nduja Dashboard: una plancia a pagina intera per Home Assistant, nella barra laterale."""
from __future__ import annotations

import hashlib
import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, Unauthorized
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (CONF_ADMIN, CONF_ICON, CONF_TITLE, DEFAULT_ICON, DEFAULT_TITLE,
                    DOMAIN, PANEL_URL, STATIC_URL, VERSION)

FRONTEND_DIR = Path(__file__).parent / "frontend"


def _build_id() -> str:
    """Impronta dei file della plancia: cambia appena cambia un file, così i browser riscaricano tutto
    anche se il numero di versione è lo stesso (per esempio installando «main» da HACS)."""
    h = hashlib.sha1()
    for f in sorted(FRONTEND_DIR.rglob("*")):
        if f.is_file():
            h.update(f.relative_to(FRONTEND_DIR).as_posix().encode())
            h.update(f.read_bytes())
    return h.hexdigest()[:8]


class NdujaAppView(HomeAssistantView):
    """Per l'app 'Nduja (iPhone/iPad): dice dove si trova la plancia e la versione installata.
    Non contiene dati della casa, quindi non serve l'accesso."""

    url = f"/api/{DOMAIN}/app"
    name = f"api:{DOMAIN}:app"
    requires_auth = False

    def __init__(self, build: str) -> None:
        self._build = build

    async def get(self, request):
        return self.json({"version": VERSION, "url": f"{STATIC_URL}/{self._build}/index.html"})


STORE_VERSION = 1
EVENT_LAYOUT = f"{DOMAIN}_layout_updated"

# Dati della casa (Faccende, Bacheca…): uguali su tutti i dispositivi e modificabili da QUALSIASI utente.
# Sono separati dalle scelte della plancia (layout, solo amministratori). Una sezione per pagina:
# { "faccende": {"rev": 3, "dati": {...}}, "bacheca": {...} }. «rev» cresce a ogni salvataggio, così due
# persone che salvano insieme non si cancellano a vicenda: chi arriva secondo riceve «conflict» e riprova.
STORE_CASA = f"{DOMAIN}.casa"
EVENT_CASA = f"{DOMAIN}_casa_updated"
CASA_MAX_BYTES = 256 * 1024     # per sezione
CASA_MAX_SEZIONI = 16
SEZIONE = vol.All(str, vol.Match(r"^[a-z][a-z0-9_]{0,31}$"))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Pubblica i file della plancia, carica le scelte del wizard e aggiunge la voce nella barra laterale."""
    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("static"):
        # versione + impronta dei file nell'indirizzo: i file nuovi si scaricano appena cambiano
        data["build"] = f"{VERSION}-{await hass.async_add_executor_job(_build_id)}"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(f"{STATIC_URL}/{data['build']}", str(FRONTEND_DIR), True)]
        )
        hass.http.register_view(NdujaAppView(data["build"]))
        websocket_api.async_register_command(hass, ws_config)
        websocket_api.async_register_command(hass, ws_save_layout)
        websocket_api.async_register_command(hass, ws_casa_get)
        websocket_api.async_register_command(hass, ws_casa_save)
        websocket_api.async_register_command(hass, ws_casa_subscribe)
        websocket_api.async_register_command(hass, ws_pausa)
        data["static"] = True
    if "store" not in data:
        data["store"] = Store(hass, STORE_VERSION, f"{DOMAIN}.layout")
        data["layout"] = await data["store"].async_load() or {}
    if "casa_store" not in data:
        data["casa_store"] = Store(hass, STORE_VERSION, STORE_CASA)
        data["casa"] = await data["casa_store"].async_load() or {}
    if not data.get("pause_avviate"):
        data["pause_avviate"] = True
        _pause_riprendi(hass)
    data["entry"] = entry
    _register_panel(hass, entry)
    entry.async_on_unload(entry.add_update_listener(_reload))
    return True


@callback
def _register_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    opt = {**entry.data, **entry.options}
    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=opt.get(CONF_TITLE, DEFAULT_TITLE),
        sidebar_icon=opt.get(CONF_ICON, DEFAULT_ICON),
        frontend_url_path=PANEL_URL,
        config={"url": f"{STATIC_URL}/{hass.data[DOMAIN]['build']}/index.html"},
        require_admin=opt.get(CONF_ADMIN, False),
        update=True,
    )


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, PANEL_URL)
    hass.data.get(DOMAIN, {}).pop("entry", None)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Integrazione rimossa: cancello anche le scelte del wizard e i dati della casa."""
    await Store(hass, STORE_VERSION, f"{DOMAIN}.layout").async_remove()
    data = hass.data.get(DOMAIN, {})
    await Store(hass, STORE_VERSION, STORE_CASA).async_remove()
    data.pop("store", None)
    data.pop("layout", None)
    for annulla in data.pop("pause_timers", {}).values():
        annulla()
    data.pop("pause_avviate", None)
    data.pop("casa_store", None)
    data.pop("casa", None)   # i file statici restano registrati fino al riavvio


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config"})
@callback
def ws_config(hass: HomeAssistant, connection, msg) -> None:
    """La plancia chiede le impostazioni e le scelte fatte nel wizard."""
    data = hass.data.get(DOMAIN, {})
    entry = data.get("entry")
    opt = {**entry.data, **entry.options} if entry else {}
    connection.send_result(msg["id"], {"version": VERSION, "options": opt, "layout": data.get("layout", {})})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/save_layout", vol.Required("layout"): dict})
@websocket_api.async_response
async def ws_save_layout(hass: HomeAssistant, connection, msg) -> None:
    """Il wizard salva le scelte (solo amministratori): valgono per tutti i dispositivi."""
    data = hass.data.setdefault(DOMAIN, {})
    layout: dict[str, Any] = msg["layout"]
    data["layout"] = layout
    if "store" in data:
        await data["store"].async_save(layout)
    hass.bus.async_fire(EVENT_LAYOUT, {})
    connection.send_result(msg["id"], {"ok": True})


def _sezione(casa: dict[str, Any], nome: str) -> dict[str, Any]:
    s = casa.get(nome) or {}
    return {"rev": s.get("rev", 0), "dati": s.get("dati", {})}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/casa_get", vol.Optional("sezione"): SEZIONE})
@callback
def ws_casa_get(hass: HomeAssistant, connection, msg) -> None:
    """Dati della casa per qualsiasi utente: una sezione sola oppure tutte."""
    casa = hass.data.get(DOMAIN, {}).get("casa", {})
    if "sezione" in msg:
        connection.send_result(msg["id"], {"sezione": msg["sezione"], **_sezione(casa, msg["sezione"])})
    else:
        connection.send_result(msg["id"], {"sezioni": {k: _sezione(casa, k) for k in casa}})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/casa_save",
    vol.Required("sezione"): SEZIONE,
    vol.Required("dati"): dict,
    vol.Optional("rev"): vol.All(int, vol.Range(min=0)),
})
@websocket_api.async_response
async def ws_casa_save(hass: HomeAssistant, connection, msg) -> None:
    """Qualsiasi utente salva una sezione intera. Con «rev» il salvataggio riesce solo se nessuno
    l'ha cambiata nel frattempo; altrimenti «conflict» e la plancia rilegge e riprova."""
    data = hass.data.get(DOMAIN, {})
    store, casa = data.get("casa_store"), data.get("casa")
    if store is None or casa is None:
        connection.send_error(msg["id"], "not_ready", "'Nduja Dashboard non è configurata")
        return
    nome, prima = msg["sezione"], _sezione(casa, msg["sezione"])
    if "rev" in msg and msg["rev"] != prima["rev"]:
        connection.send_error(msg["id"], "conflict", f"rev {prima['rev']}")
        return
    if nome not in casa and len(casa) >= CASA_MAX_SEZIONI:
        connection.send_error(msg["id"], "too_many", f"max {CASA_MAX_SEZIONI}")
        return
    try:
        peso = len(json.dumps(msg["dati"], ensure_ascii=False, separators=(",", ":")).encode())
    except (TypeError, ValueError):
        connection.send_error(msg["id"], "invalid_format", "dati non validi")
        return
    if peso > CASA_MAX_BYTES:
        connection.send_error(msg["id"], "too_big", f"{peso} > {CASA_MAX_BYTES} byte")
        return
    rev = prima["rev"] + 1
    casa[nome] = {"rev": rev, "dati": msg["dati"]}   # cambio in memoria subito: il controllo di rev resta valido
    await store.async_save(casa)
    hass.bus.async_fire(EVENT_CASA, {"sezione": nome, "rev": rev, "user_id": connection.user.id})
    connection.send_result(msg["id"], {"sezione": nome, "rev": rev})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/casa_subscribe"})
@callback
def ws_casa_subscribe(hass: HomeAssistant, connection, msg) -> None:
    """Avvisa la plancia quando qualcuno cambia i dati della casa. Serve un comando apposta perché
    Home Assistant non lascia ascoltare gli eventi qualsiasi agli utenti che non sono amministratori."""

    @callback
    def inoltra(event) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], dict(event.data)))

    connection.subscriptions[msg["id"]] = hass.bus.async_listen(EVENT_CASA, inoltra)
    connection.send_result(msg["id"])


# ---------------- Automazioni in pausa ----------------
# «Spegni per un'ora / fino a domattina»: l'automazione si spegne e Home Assistant la riaccende da solo
# all'ora giusta, anche se nessuno ha la plancia aperta e anche dopo un riavvio.
# Le pause stanno nei dati della casa (sezione «pause»: {entity_id: fino_iso}), così tutti i dispositivi le vedono.
PAUSE = "pause"


async def _pause_salva(hass: HomeAssistant, dati: dict[str, str]) -> None:
    data = hass.data[DOMAIN]
    casa = data["casa"]
    rev = _sezione(casa, PAUSE)["rev"] + 1
    casa[PAUSE] = {"rev": rev, "dati": dati}
    await data["casa_store"].async_save(casa)
    hass.bus.async_fire(EVENT_CASA, {"sezione": PAUSE, "rev": rev})


async def _pause_fine(hass: HomeAssistant, entity_id: str, riaccendi: bool = True, context: Context | None = None) -> None:
    """Toglie la pausa (e il timer) e, se richiesto, riaccende l'automazione."""
    data = hass.data.get(DOMAIN, {})
    annulla = data.get("pause_timers", {}).pop(entity_id, None)
    if annulla:
        annulla()
    dati = dict(_sezione(data.get("casa", {}), PAUSE)["dati"])
    if entity_id in dati:
        dati.pop(entity_id)
        await _pause_salva(hass, dati)
    if riaccendi:
        await hass.services.async_call("automation", "turn_on", {"entity_id": entity_id}, blocking=True, context=context)


@callback
def _pause_programma(hass: HomeAssistant, entity_id: str, fino) -> None:
    timers = hass.data[DOMAIN].setdefault("pause_timers", {})
    vecchio = timers.pop(entity_id, None)
    if vecchio:
        vecchio()

    async def riaccendi(_ora) -> None:
        timers.pop(entity_id, None)
        try:
            await _pause_fine(hass, entity_id)
        except HomeAssistantError:
            pass

    timers[entity_id] = async_track_point_in_utc_time(hass, riaccendi, fino)


@callback
def _pause_riprendi(hass: HomeAssistant) -> None:
    """All'avvio rimetto i timer; le pause già scadute le chiudo tra un minuto (quando le automazioni sono caricate)."""
    ora = dt_util.utcnow()
    for eid, iso in _sezione(hass.data[DOMAIN].get("casa", {}), PAUSE)["dati"].items():
        fino = dt_util.parse_datetime(str(iso)) or ora
        _pause_programma(hass, eid, max(fino, ora + timedelta(minutes=1)))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/pausa",
    vol.Required("entity_id"): vol.All(str, vol.Match(r"^automation\.[a-z0-9_]+$")),
    vol.Required("minuti"): vol.All(int, vol.Range(min=0, max=60 * 24 * 31)),
})
@websocket_api.async_response
async def ws_pausa(hass: HomeAssistant, connection, msg) -> None:
    """Qualsiasi utente mette in pausa un'automazione per «minuti» (0 = togli la pausa e riaccendi)."""
    data = hass.data.get(DOMAIN, {})
    if "casa" not in data:
        connection.send_error(msg["id"], "not_ready", "'Nduja Dashboard non è configurata")
        return
    eid, ctx = msg["entity_id"], Context(user_id=connection.user.id)
    if hass.states.get(eid) is None:
        connection.send_error(msg["id"], "not_found", eid)
        return
    try:
        if msg["minuti"] == 0:
            await _pause_fine(hass, eid, True, ctx)
            connection.send_result(msg["id"], {"fino": None})
            return
        fino = dt_util.utcnow() + timedelta(minutes=msg["minuti"])
        await hass.services.async_call("automation", "turn_off", {"entity_id": eid}, blocking=True, context=ctx)
        dati = dict(_sezione(data["casa"], PAUSE)["dati"])
        dati[eid] = fino.isoformat()
        await _pause_salva(hass, dati)
        _pause_programma(hass, eid, fino)
        connection.send_result(msg["id"], {"fino": fino.isoformat()})
    except Unauthorized:
        connection.send_error(msg["id"], "unauthorized", "non puoi comandare questa automazione")
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "failed", str(err))

"""'Nduja Dashboard: una plancia a pagina intera per Home Assistant, nella barra laterale."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

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


STORE_VERSION = 1
EVENT_LAYOUT = f"{DOMAIN}_layout_updated"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Pubblica i file della plancia, carica le scelte del wizard e aggiunge la voce nella barra laterale."""
    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("static"):
        # versione + impronta dei file nell'indirizzo: i file nuovi si scaricano appena cambiano
        data["build"] = f"{VERSION}-{await hass.async_add_executor_job(_build_id)}"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(f"{STATIC_URL}/{data['build']}", str(FRONTEND_DIR), True)]
        )
        websocket_api.async_register_command(hass, ws_config)
        websocket_api.async_register_command(hass, ws_save_layout)
        data["static"] = True
    if "store" not in data:
        data["store"] = Store(hass, STORE_VERSION, f"{DOMAIN}.layout")
        data["layout"] = await data["store"].async_load() or {}
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
    """Integrazione rimossa: cancello anche le scelte del wizard."""
    await Store(hass, STORE_VERSION, f"{DOMAIN}.layout").async_remove()
    data = hass.data.get(DOMAIN, {})
    data.pop("store", None)
    data.pop("layout", None)   # i file statici restano registrati fino al riavvio


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

"""'Nduja Dashboard: una plancia a pagina intera per Home Assistant, nella barra laterale."""
from __future__ import annotations

from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .const import (CONF_ADMIN, CONF_ICON, CONF_TITLE, DEFAULT_ICON, DEFAULT_TITLE,
                    DOMAIN, PANEL_URL, STATIC_URL, VERSION)

FRONTEND_DIR = Path(__file__).parent / "frontend"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Pubblica i file della plancia e aggiunge la voce nella barra laterale."""
    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("static"):
        # la versione nell'indirizzo fa scaricare i file nuovi a ogni aggiornamento
        await hass.http.async_register_static_paths(
            [StaticPathConfig(f"{STATIC_URL}/{VERSION}", str(FRONTEND_DIR), True)]
        )
        websocket_api.async_register_command(hass, ws_config)
        data["static"] = True
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
        config={"url": f"{STATIC_URL}/{VERSION}/index.html"},
        require_admin=opt.get(CONF_ADMIN, False),
        update=True,
    )


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, PANEL_URL)
    hass.data.get(DOMAIN, {}).pop("entry", None)
    return True


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config"})
@callback
def ws_config(hass: HomeAssistant, connection, msg) -> None:
    """La plancia chiede le sue impostazioni (entità scelte nella configurazione)."""
    entry = hass.data.get(DOMAIN, {}).get("entry")
    opt = {**entry.data, **entry.options} if entry else {}
    connection.send_result(msg["id"], {"version": VERSION, "options": opt})

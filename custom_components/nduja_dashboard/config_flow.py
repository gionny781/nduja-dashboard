"""Configurazione guidata di 'Nduja Dashboard."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (CONF_ADMIN, CONF_ICON, CONF_TITLE, DEFAULT_ICON, DEFAULT_TITLE,
                    DOMAIN, ENERGY_KEYS)

SENSOR = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor"))


def _base_schema(d: dict[str, Any]) -> vol.Schema:
    return vol.Schema({
        vol.Optional(CONF_TITLE, default=d.get(CONF_TITLE, DEFAULT_TITLE)): str,
        vol.Optional(CONF_ICON, default=d.get(CONF_ICON, DEFAULT_ICON)): selector.IconSelector(),
        vol.Optional(CONF_ADMIN, default=d.get(CONF_ADMIN, False)): bool,
    })


class NdujaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title=user_input.get(CONF_TITLE) or DEFAULT_TITLE, data=user_input)
        return self.async_show_form(step_id="user", data_schema=_base_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(entry):
        return NdujaOptionsFlow()


class NdujaOptionsFlow(config_entries.OptionsFlow):
    """Impostazioni: nome e icona nella barra laterale, sensori dell'energia."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        cur = {**self.config_entry.data, **self.config_entry.options}
        schema = _base_schema(cur).extend({
            vol.Optional(k, description={"suggested_value": cur.get(k)}): SENSOR for k in ENERGY_KEYS
        })
        return self.async_show_form(step_id="init", data_schema=schema)

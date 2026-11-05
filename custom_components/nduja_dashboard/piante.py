"""Piante (pagina 🪴 Piante della plancia): la parte che lavora anche a plancia chiusa.

- Servizio «nduja_dashboard.leggi_casa»: restituisce una sezione dei dati della casa. Lo usa l'automazione
  «'Nduja · piante» creata dalla plancia per i promemoria sul telefono: le automazioni non possono leggere
  in altro modo i dati della plancia. Sono gli stessi dati che ogni utente vede già nella plancia.
- Irrigazione: quando parte una zona collegata a una pianta (scelta nella plancia), segno da solo che quella
  pianta è stata annaffiata, anche se nessuno ha la plancia aperta.

Le piante stanno nella sezione «piante» dei dati della casa: {"piante": {id: {"zona": "switch.x", "acqua": {...}, ...}}}.
"""
from __future__ import annotations

import copy
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Any

import voluptuous as vol

from homeassistant.core import Event, HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse, callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.util import dt as dt_util

from .const import DOMAIN

SEZ = "piante"
SERVIZIO = "leggi_casa"
ACCESA = ("on", "open", "opening")
SPENTA_VERA = ("off", "closed", "closing")   # da qui a «accesa» è una partenza vera (non un ritorno dopo un riavvio)
MAX_STORIA = 12

Leggi = Callable[[HomeAssistant, str], dict[str, Any]]
Scrivi = Callable[[HomeAssistant, str, dict[str, Any]], Awaitable[int]]


def _quando(iso: Any) -> datetime | None:
    try:
        d = dt_util.parse_datetime(str(iso)) if iso else None
    except (TypeError, ValueError):
        return None
    return dt_util.as_utc(d) if d else None


def _zone(dati: dict[str, Any]) -> set[str]:
    """Le zone dell'irrigazione collegate ad almeno una pianta."""
    piante = dati.get("piante")
    if not isinstance(piante, dict):
        return set()
    return {p["zona"] for p in piante.values()
            if isinstance(p, dict) and not p.get("tolta") and isinstance(p.get("zona"), str)
            and p["zona"].split(".", 1)[0] in ("switch", "valve", "input_boolean")}


@callback
def async_setup_piante(hass: HomeAssistant, leggi: Leggi, scrivi: Scrivi, evento_casa: str, sezione_valida: Any) -> None:
    """Registra il servizio e segue le zone dell'irrigazione collegate alle piante (una volta sola)."""
    data = hass.data[DOMAIN]
    if not hass.services.has_service(DOMAIN, SERVIZIO):

        async def leggi_casa(call: ServiceCall) -> ServiceResponse:
            nome = call.data["sezione"]
            s = leggi(hass, nome)
            return {"sezione": nome, "rev": s["rev"], "dati": copy.deepcopy(s["dati"])}

        hass.services.async_register(DOMAIN, SERVIZIO, leggi_casa, schema=vol.Schema({vol.Required("sezione"): sezione_valida}),
                                     supports_response=SupportsResponse.ONLY)
    if data.get("piante_segui"):
        return
    stato: dict[str, Any] = {"zone": (), "annulla": None}

    async def segna(zona: str, quando: datetime) -> None:
        """La zona è partita: le piante collegate sono annaffiate adesso (se non lo erano già dopo)."""
        if "casa" not in hass.data.get(DOMAIN, {}):
            return
        dati = copy.deepcopy(leggi(hass, SEZ)["dati"])
        piante = dati.get("piante")
        if not isinstance(piante, dict):
            return
        iso = dt_util.as_utc(quando).replace(microsecond=0).isoformat()
        cambiate = False
        for p in piante.values():
            if not isinstance(p, dict) or p.get("tolta") or p.get("zona") != zona:
                continue
            acqua = dict(p["acqua"]) if isinstance(p.get("acqua"), dict) else {}
            prima = _quando(acqua.get("ultima"))
            if prima and prima >= quando - timedelta(minutes=1):
                continue
            acqua.update({"ultima": iso, "via": "irr", "chi": None})
            p["acqua"] = acqua
            storia = p.get("storia") if isinstance(p.get("storia"), list) else []
            p["storia"] = [{"c": "acqua", "q": iso, "via": "irr", "z": zona, "prima": prima.isoformat() if prima else None}, *storia][:MAX_STORIA]
            cambiate = True
        if cambiate:
            await scrivi(hass, SEZ, dati)

    @callback
    def cambiata(event: Event) -> None:
        nuovo, vecchio = event.data.get("new_state"), event.data.get("old_state")
        if nuovo is None or vecchio is None or nuovo.state not in ACCESA or vecchio.state not in SPENTA_VERA:
            return
        hass.async_create_task(segna(event.data["entity_id"], nuovo.last_changed))

    @callback
    def aggiorna(event: Event | None = None) -> None:
        if event is not None and event.data.get("sezione") != SEZ:
            return
        zone = tuple(sorted(_zone(leggi(hass, SEZ)["dati"])))
        if zone == stato["zone"]:
            return
        if stato["annulla"]:
            stato["annulla"]()
            stato["annulla"] = None
        stato["zone"] = zone
        if zone:
            stato["annulla"] = async_track_state_change_event(hass, list(zone), cambiata)

    togli_ascolto = hass.bus.async_listen(evento_casa, aggiorna)
    aggiorna()

    @callback
    def ferma() -> None:
        togli_ascolto()
        if stato["annulla"]:
            stato["annulla"]()
            stato["annulla"] = None

    data["piante_segui"] = ferma


@callback
def async_remove_piante(hass: HomeAssistant) -> None:
    """Integrazione rimossa: smetto di seguire le zone e tolgo il servizio."""
    ferma = hass.data.get(DOMAIN, {}).pop("piante_segui", None)
    if ferma:
        ferma()
    if hass.services.has_service(DOMAIN, SERVIZIO):
        hass.services.async_remove(DOMAIN, SERVIZIO)

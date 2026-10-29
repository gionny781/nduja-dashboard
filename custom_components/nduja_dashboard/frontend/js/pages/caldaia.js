/* Caldaia: la caldaia disegnata per 'Nduja (la fiamma si accende e cresce con la modulazione, l'acqua scorre nei tubi di
   mandata e ritorno fino al termosifone, l'acqua calda esce dal rubinetto), riscaldamento (on/off, estate/inverno/auto,
   mandata impostata), acqua calda sanitaria (temperatura, setpoint, comfort/eco, boost), impianto (pressione con avviso,
   temperatura esterna), errori e manutenzione (anche annotata a mano, con promemoria negli Avvisi) e consumi del gas
   dalle statistiche di Home Assistant, con il costo se il prezzo è nella configurazione Energia.
   Tutto si trova da solo (Ariston, myVAILLANT, ViCare, Bosch/Buderus, Remeha/Baxi/De Dietrich, Immergas, ebusd,
   OpenTherm Gateway, Plugwise, Netatmo…); con ✏️ (solo admin) si scelgono dispositivi e sensori: LAYOUT.caldaia.
   I circuiti della caldaia (clima che non sono il termostato di una stanza) escono dalla pagina Clima finché questa pagina
   è accesa; i termostati veri restano dove sono. In Home la scheda «Caldaia» (HOME_EXTRA). */
import { S, REG, DEVICES, ACT, CHG, UI, LAYOUT, HOME_EXTRA, DEFAULT_OFF, VISTE, t, LOC, esc, fnum, nm, nmHA, ok, val, attr, unit, card, page, svc, ws, cached,
  toast, openSheet, closeSheet, render, isAdmin, deviceClass, domain, utenteCfg } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { statistiche, barre } from "../grafici.js";

/* ---------- integrazioni e nomi ---------- */
const PIATT = /^(ariston|aristonnet|ariston_net|aristonremotethermo|mypyllant|myvaillant|vaillant|multimatic|vaillant_vsmart|vicare|viessmann|bosch|bosch_thermostat|nefit|nefiteasy|easycontrol|buderus|remeha_home|remeha|bdr_thermea|baxi|dedietrich|de_dietrich|immergas|dominus|beretta|riello|ebusd|opentherm_gw|opentherm|otgw|ems_esp|emsesp|wolflink|intergas|atag|elco|ferroli|chaffoteaux|saunier_duval|plugwise|netatmo)$/;
/* pompe di calore: hanno l'acqua calda ma non sono una caldaia */
const POMPE = /^(daikin|daikin_onecta|daikin_altherma|aquarea|panasonic_aquarea|nibe|nibe_heatpump|myuplink|stiebel_eltron|ecodan|melcloud|luxtronik|ecoforest|idm|weheat|hitachi_yutaki)$/;
const NOME = /caldaia|boiler|chaudi[eè]re|kessel|ariston|vaillant|viessmann|vito(dens|pend|crossal)|ecotec|bosch|buderus|junkers|baxi|dietrich|immergas|beretta|riello|ferroli|\bsime\b|chaffoteaux|saunier|hermann|nefit|remeha|intergas|opentherm|\botgw\b|ebus|\bems\b|heater.?central|scaldabagno|scaldacqua|water.?heater/i;

const conf = () => LAYOUT.caldaia || {};
const testo = id => (id + " " + nmHA(id)).toLowerCase();
const piatt = id => REG[id]?.platform || "";
const pct = id => unit(id) === "%";
const isTempS = id => id.startsWith("sensor.") && (deviceClass(id) === "temperature" || /^°\s?[CF]$/.test(unit(id)));
const SI = ["on", "true", "1", "yes", "si", "sì", "acceso", "accesa", "active", "attivo", "attiva", "running", "heating", "burning"];
const acceso = id => !!id && ok(id) && SI.includes(String(S[id].state).toLowerCase());
const giorno = 864e5;

/* ---------- ruoli: cosa fa ogni entità ---------- */
const R_FIAMMA = /flame|fiamma|burner|bruciatore|brenner/i, R_NO_FIAMMA = /fault|error|errore|guasto|lockout|blocco|start|avvii|hour|\bore\b|count|modulat|modulaz|power|potenza|consum|gas|time|tempo/i;
const R_MOD = /modulat|modulaz|rel(ative)?_?mod|burner_?power|flame_?level|potenza_?(bruciatore|fiamma)|burner_?load|brennerleistung/i;
const R_MANDATA = /flow|mandata|supply|vorlauf|leaving|ch_?water|boiler_?water|boiler_?temp|heating_?water|kesseltemp|temperatura_?caldaia|water_?temp/i;
const R_RITORNO = /return|ritorno|r[uü]e?cklauf/i;
const R_SET = /set_?point|setpoint|target|impostat|desired|intended|control_?set|max_?ch|_set\b|_set_|soll|comfort_?temp|reduced_?temp/i;
const R_ACS = /dhw|\bacs\b|_acs|sanitar|hot_?water|warm_?wasser|warmwasser|domestic|tap_?water|water_?heater|bollitore|accumulo|\btank\b|cylinder|storage/i;
const R_PRESS = /pressure|pressione|druck|press\b|_press_/i, R_NO_PRESS = /gas|\bair\b|aria|barometr|atmos|vapor|abgas|flue|fumi/i;
const R_EST = /outside|outdoor|esterna|esterno|external|au(ss|ß)en|exterior/i;
const R_ERR = /error|errore|fault|fehler|guasto|anomal|lockout|blocco|diagnostic_?code|status_?code|err_?code|oem_?code/i;
const R_ALLARME = /fault|error|errore|guasto|low_?water|low_?pressure|bassa_?pressione|lockout|blocco|overtemp|over_?temp|sovratemp|gas_?fault|air_?pressure|diagnostic|anomal|wassermangel|st[oö]rung/i;
const R_MANUT = /service|manutenz|maintenance|wartung|revision/i;
const R_GAS = /\bgas\b|_gas|gas_|metano|methane/i;
const R_POMPA = /pump|pompa|circulat|circolat|umw[aä]lz/i;
const R_CH = /central_?heating|\bch\b|_ch_|_ch$|ch_?active|ch_?mode|ch_?enable|heating|riscaldamento|heizung/i;
const R_NO_FLAG = /present|enable|config|transfer|support|block|override|ovrd|\brw\b|readwrite|priority|control_?type|remote|request|cooling|raffresc|filling|reset/i;
const R_BOOST = /boost|one_?time|onetime|einmal|charge_?once|quick_?heat|rapid|turbo|ricarica_?rapida|push/i;
const R_MODO = /plant_?mode|operating_?mode|operation_?mode|\bmode\b|_mode|modalit|season|stagion|betriebsart|programma|program/i;

const isFiamma = x => (x.startsWith("binary_sensor.") || (x.startsWith("sensor.") && isNaN(+S[x]?.state))) && R_FIAMMA.test(testo(x)) && !R_NO_FIAMMA.test(testo(x));
const isMod = x => x.startsWith("sensor.") && pct(x) && R_MOD.test(testo(x)) && !R_SET.test(testo(x)) && !/max|min/i.test(testo(x));
const isMandata = x => isTempS(x) && R_MANDATA.test(testo(x)) && !R_SET.test(testo(x)) && !R_ACS.test(testo(x)) && !R_RITORNO.test(testo(x)) && !R_EST.test(testo(x)) && !/max|min|room|ambient|stanza|exhaust|flue|fumi|abgas/i.test(testo(x));
const isRitorno = x => isTempS(x) && R_RITORNO.test(testo(x)) && !R_SET.test(testo(x)) && !R_ACS.test(testo(x));
const isPress = x => x.startsWith("sensor.") && (deviceClass(x) === "pressure" || /^(bar|psi|kpa|mbar|mpa)$/i.test(unit(x))) && !/^hpa$/i.test(unit(x)) && !R_NO_PRESS.test(testo(x));
const isAcsTemp = x => isTempS(x) && R_ACS.test(testo(x)) && !R_SET.test(testo(x)) && !/max|min|solar|solare|collector|collettore/i.test(testo(x));

/** pressione in bar, qualunque sia l'unità */
function bar(id) {
  const v = val(id); if (v == null) return null;
  const u = unit(id).toLowerCase();
  return u === "psi" ? v / 14.5038 : u === "kpa" ? v / 100 : u === "mbar" ? v / 1000 : u === "mpa" ? v * 10 : u === "pa" ? v / 1e5 : v;
}
/** termostato di una stanza (resta nella pagina Clima) o circuito della caldaia (va nella pagina Caldaia)? */
export function termostatoVero(id) {
  const a = S[id]?.attributes || {}, cur = parseFloat(a.current_temperature);
  if (/circuit|circuito|heizkreis|\bhk\d|\bch\b|_ch_|_ch$|flow|mandata|supply|vorlauf|boiler|caldaia|kessel|central.?heating/i.test(testo(id))) return false;
  if (a.max_temp != null && +a.max_temp > 35) return false;   // la temperatura voluta è quella dell'acqua, non della stanza
  return !isNaN(cur) && cur >= 3 && cur <= 38;
}

/* ---------- dispositivi di Home Assistant ---------- */
function perDispositivo() {
  const G = {};
  /* le entità senza dispositivo (YAML, template, MQTT senza dispositivo) fanno gruppo da sole */
  for (const id of Object.keys(S)) { const r = REG[id]; if (r?.hidden) continue; const k = r?.device || id; (G[k] = G[k] || []).push(id); }
  return G;
}
const nomeDev = k => DEVICES[k]?.name || (S[k] ? nmHA(k) : k);
const testoDev = (k, E) => (nomeDev(k) + " " + (DEVICES[k]?.model || "") + " " + (DEVICES[k]?.maker || "") + " " + E.map(testo).join(" ")).toLowerCase();
function punti(E) {
  const c = f => E.some(f) ? 1 : 0;
  return c(isFiamma) + c(isMod) + c(isMandata) + c(isRitorno) + c(isPress) + c(isAcsTemp) + 2 * c(x => x.startsWith("water_heater."));
}
function eCaldaia(k, E) {
  if (DEVICES[k]?.disabled) return false;
  const pl = E.map(piatt).find(Boolean) || "";
  if (POMPE.test(pl) || E.some(x => /^(vacuum|lawn_mower|media_player|camera|light|device_tracker)\./.test(x))) return false;
  if (E.some(x => x.startsWith("water_heater."))) return true;
  const p = punti(E);
  if ((PIATT.test(pl) || NOME.test(testoDev(k, E))) && p >= 1) return true;
  return p >= 3 && E.some(x => isFiamma(x) || isMod(x));   // OpenTherm fatto in casa (ESPHome, MQTT): fiamma o modulazione e altri due segni
}
let memo = { k: "", v: null };
function trovaTutto() {
  const c = conf(), key = Object.keys(S).length + ":" + Object.keys(REG).length + ":" + Object.keys(DEVICES).length + ":" + JSON.stringify([c.extra, c.tolti]);
  if (memo.k === key && memo.v) return memo.v;
  const G = perDispositivo(), tolti = new Set(c.tolti || []), D = [];
  const extra = new Set((c.extra || []).map(id => REG[id]?.device || id).filter(k => G[k]));
  for (const [k, E] of Object.entries(G)) if (!tolti.has(k) && (extra.has(k) || eCaldaia(k, E))) D.push(k);
  const nascosti = [...tolti].filter(k => G[k]);
  memo = { k: key, v: { D, G, E: D.flatMap(k => G[k]), nascosti } };
  return memo.v;
}
/** ricalcolo al massimo ogni 250 ms o se cambiano le scelte */
const ogni = f => { let t0 = 0, c0 = null, v; return () => { const n = performance.now(); if (n - t0 > 250 || LAYOUT.caldaia !== c0) { v = f(); t0 = n; c0 = LAYOUT.caldaia; } return v; }; };

/** i ruoli di tutte le entità della caldaia (anche quelle «diagnostiche»); le scelte di ✏️ vincono */
const ruoli = ogni(() => {
  const { E } = trovaTutto(), sc = conf().sens || {}, trova = f => E.find(f) || null;
  const sens = E.filter(x => x.startsWith("sensor.")), bin = E.filter(x => x.startsWith("binary_sensor."));
  const temps = sens.filter(isTempS);
  const clima = E.filter(x => x.startsWith("climate."));
  const R = {
    fiamma: trova(isFiamma),
    mod: trova(isMod),
    mandata: temps.find(isMandata) || null,
    ritorno: temps.find(isRitorno) || null,
    setMandata: E.find(x => /^(number|input_number)\./.test(x) && R_MANDATA.test(testo(x)) && !R_ACS.test(testo(x)) && !R_RITORNO.test(testo(x)) && !/min/i.test(testo(x)))
      || E.find(x => /^(number|input_number)\./.test(x) && R_CH.test(testo(x)) && /temp|set/i.test(testo(x)) && !R_ACS.test(testo(x)))
      || temps.find(x => R_SET.test(testo(x)) && R_MANDATA.test(testo(x)) && !R_ACS.test(testo(x)) && !/min/i.test(testo(x)))
      || temps.find(x => /control_?setpoint|intended_?boiler|ch_?setpoint|ch_?target/i.test(testo(x))) || null,
    press: sens.filter(isPress).sort((a, b) => (R_PRESS.test(testo(b)) ? 1 : 0) - (R_PRESS.test(testo(a)) ? 1 : 0))[0] || null,
    esterna: temps.find(x => R_EST.test(testo(x)) && !R_SET.test(testo(x))) || null,
    errore: sens.find(x => R_ERR.test(testo(x)) && !/count|numero|number_of|total|hours|\bore\b/i.test(testo(x))) || null,
    manut: sens.find(x => R_MANUT.test(testo(x)) && !R_ERR.test(testo(x))) || null,
    servizio: bin.find(x => R_MANUT.test(testo(x)) && !/present|support/i.test(testo(x))) || null,
    gas: sens.find(x => (deviceClass(x) === "gas" || (/^(m³|m3|ft³|ft3|ccf|l)$/i.test(unit(x)) && R_GAS.test(testo(x))) || (deviceClass(x) === "energy" && R_GAS.test(testo(x))))
      && ["total", "total_increasing"].includes(attr(x, "state_class"))) || null,
    pompa: bin.find(x => R_POMPA.test(testo(x)) && !R_NO_FLAG.test(testo(x)) && !R_ALLARME.test(testo(x))) || null,
    chOn: bin.find(x => R_CH.test(testo(x)) && !R_NO_FLAG.test(testo(x)) && !R_ALLARME.test(testo(x)) && !R_ACS.test(testo(x)) && !/2\b|_2$/.test(x)) || null,
    dhwOn: bin.find(x => R_ACS.test(testo(x)) && !R_NO_FLAG.test(testo(x)) && !R_ALLARME.test(testo(x)) && !R_BOOST.test(testo(x))) || null,
    circuito: clima.find(x => !termostatoVero(x)) || null,
    interruttore: E.find(x => /^(switch|input_boolean)\./.test(x) && R_CH.test(testo(x)) && !R_ACS.test(testo(x)) && !R_BOOST.test(testo(x)) && !/auto|cooling|raffresc/i.test(testo(x))) || null,
    modo: E.find(x => /^(select|input_select)\./.test(x) && R_MODO.test(testo(x)) && !R_ACS.test(testo(x)) && (attr(x, "options") || []).length > 1) || null,
    wh: E.find(x => x.startsWith("water_heater.")) || null,
    acsTemp: temps.find(isAcsTemp) || null,
    acsSet: E.find(x => /^(number|input_number)\./.test(x) && R_ACS.test(testo(x)) && !/min|max|reduced|ridott|eco/i.test(testo(x)))
      || temps.find(x => R_ACS.test(testo(x)) && R_SET.test(testo(x)) && !/min|max/i.test(testo(x))) || null,
    acsModo: E.find(x => /^(select|input_select)\./.test(x) && R_ACS.test(testo(x)) && (attr(x, "options") || []).length > 1) || null,
    boost: E.find(x => /^(switch|button|input_boolean|input_button)\./.test(x) && R_BOOST.test(testo(x))) || null,
  };
  for (const r of Object.keys(R)) { const s = sc[r]; if (s === "none") R[r] = null; else if (s && S[s]) R[r] = s; }
  R.termostati = clima.filter(x => termostatoVero(x) && x !== R.circuito);
  R.allarmi = bin.filter(x => (deviceClass(x) === "problem" || deviceClass(x) === "safety" || R_ALLARME.test(testo(x))) && !R_MANUT.test(testo(x)) && !R_NO_FLAG.test(testo(x)) && x !== R.fiamma);
  return R;
});

/* ---------- stato di adesso ---------- */
const NESSUN_ERR = /^(0|0x0+|none|no|false|off|ok|normal|normale|nessuno|nessun[oa]? ?errore|no[ _-]?errors?|no[ _-]?faults?|kein[ _]?fehler|aucune?( erreur)?|-|—|n\/a|standby)$/i;
/** errori in chiaro: codice e descrizione se l'integrazione li dà, più gli allarmi accesi */
function errori(R) {
  const L = [];
  if (R.errore && ok(R.errore)) {
    const s = String(S[R.errore].state).trim(), A = S[R.errore].attributes || {};
    if (s && !NESSUN_ERR.test(s)) {
      const desc = A.description || A.descrizione || A.error_description || A.message || A.text || A.testo || "";
      const codice = /^[a-z]?\d{1,4}[a-z]?$/i.test(s) || /^0x[0-9a-f]+$/i.test(s);
      L.push({ id: R.errore, cod: codice ? s : null, txt: codice ? (desc || "") : s, extra: !codice && desc ? desc : "" });
    }
    /* alcune integrazioni mettono l'elenco degli errori negli attributi */
    for (const e of (Array.isArray(A.errors) ? A.errors : Array.isArray(A.errori) ? A.errori : []).slice(0, 4)) {
      const c = typeof e === "object" ? (e.code ?? e.codice ?? e.fault_code ?? "") : "", d = typeof e === "object" ? (e.description ?? e.descrizione ?? e.text ?? e.name ?? "") : String(e);
      if ((c || d) && !L.some(x => x.cod === String(c) && x.txt === d)) L.push({ id: R.errore, cod: c ? String(c) : null, txt: String(d) });
    }
  }
  for (const id of R.allarmi) if (acceso(id)) L.push({ id, cod: null, txt: pulisci(id), allarme: true });
  return L;
}
/** nome senza il nome del dispositivo davanti («OpenTherm Gateway Low water pressure» → «Low water pressure») */
function pulisci(id) {
  const n = nm(id), d = DEVICES[REG[id]?.device]?.name;
  return d && n.toLowerCase().startsWith(d.toLowerCase() + " ") && n.length > d.length + 2 ? n.slice(d.length + 1) : n;
}
/** soglie della pressione (bar): 1 e 2,5 di partenza, cambiabili con ✏️ */
const soglie = () => ({ min: +(conf().pmin ?? 1), max: +(conf().pmax ?? 2.5) });
function pressione(R) {
  const p = R.press ? bar(R.press) : null, s = soglie();
  return { p, s, k: p == null ? "nd" : p < s.min ? "bassa" : p > s.max ? "alta" : "ok" };
}
/** come sta la caldaia adesso */
function stato(R = ruoli()) {
  const mod = R.mod ? val(R.mod) : null;
  let fiamma = R.fiamma && ok(R.fiamma) ? acceso(R.fiamma) : mod != null ? mod > 0 : R.circuito && ok(R.circuito) ? attr(R.circuito, "hvac_action") === "heating" : null;
  const acs = R.dhwOn ? acceso(R.dhwOn) : false;
  const ch = R.chOn ? acceso(R.chOn) : R.circuito && ok(R.circuito) ? attr(R.circuito, "hvac_action") === "heating" : fiamma && !acs;
  const pompa = R.pompa && ok(R.pompa) ? acceso(R.pompa) : !!(fiamma && !acs) || !!ch;
  const E = errori(R), P = pressione(R);
  const raggiungibile = trovaTutto().E.some(ok);
  return { fiamma, mod: mod != null ? Math.max(0, Math.min(100, mod)) : fiamma ? 60 : 0, conMod: mod != null, acs, ch: !!ch, pompa, err: E, P, raggiungibile };
}

/* ---------- manutenzione ---------- */
const oggi0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dataISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const piuMesi = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const dataTesto = d => d.toLocaleDateString(LOC, { day: "numeric", month: "short", year: "numeric" });
/** giorni che mancano a una data scritta dall'integrazione (data, data e ora, o «giorni/ore/mesi che mancano») */
function giorniIntegrazione(id) {
  if (!id || !ok(id)) return null;
  const s = S[id].state, u = unit(id).toLowerCase();
  if (deviceClass(id) === "timestamp" || deviceClass(id) === "date" || /^\d{4}-\d{2}-\d{2}/.test(s)) { const ms = new Date(s.length === 10 ? s + "T00:00:00" : s).getTime(); return isNaN(ms) ? null : Math.round((ms - oggi0().getTime()) / giorno); }
  const v = val(id); if (v == null) return null;
  return /^(d|days?|giorni|g)$/.test(u) ? v : /^(h|hours?|ore)$/.test(u) ? v / 24 : /^(months?|mesi)$/.test(u) ? v * 30.4 : /^(w|weeks?|settimane)$/.test(u) ? v * 7 : null;
}
/** la prossima manutenzione: annotata a mano (vince) o dall'integrazione; { giorni, data, fonte, ultima, chiede } */
function manutenzione(R = ruoli()) {
  const m = conf().manut || {}, ultima = daISO(m.ultima), ogni = +(m.ogni || 12);
  let data = daISO(m.prossima) || (ultima ? piuMesi(ultima, ogni) : null), fonte = data ? "mano" : null;
  if (!data) { const g = giorniIntegrazione(R.manut); if (g != null) { data = new Date(oggi0().getTime() + Math.round(g) * giorno); fonte = "int"; } }
  const giorni = data ? Math.round((data.getTime() - oggi0().getTime()) / giorno) : null;
  return { giorni, data, fonte, ultima, ogni, nota: m.nota || "", chiede: acceso(R.servizio), testoInt: R.manut && ok(R.manut) && giorniIntegrazione(R.manut) == null ? S[R.manut].state : null };
}
const traGiorni = g => g === 0 ? t("oggi", "today") : g === 1 ? t("domani", "tomorrow") : g > 0 ? t(`tra ${g} giorni`, `in ${g} days`) : g === -1 ? t("da ieri", "since yesterday") : t(`scaduta da ${-g} giorni`, `overdue by ${-g} days`);

/* ---------- gas ---------- */
const prefs = () => cached("energy:prefs", 10 * 60000, () => ws({ type: "energy/get_prefs" }).catch(() => ({}))) || {};
const meta = ids => cached("cd:meta:" + ids.join(","), 3600e3, () => ws({ type: "recorder/get_statistics_metadata", statistic_ids: ids }).catch(() => []));
const UNITA = u => ({ m3: "m³", "m³": "m³", ft3: "ft³", "ft³": "ft³", kwh: "kWh", wh: "Wh", mwh: "MWh", ccf: "CCF", l: "L" }[String(u || "").toLowerCase()] || u || "");
/** contatori del gas: quello scelto con ✏️, altrimenti quelli della configurazione Energia (con il prezzo), altrimenti quello della caldaia */
function gas(R = ruoli()) {
  const sc = conf().sens?.gas, G = (prefs().energy_sources || []).filter(s => s.type === "gas" && s.stat_energy_from);
  let ids = [], prezzo = null, daEnergia = false;
  if (sc === "none") ids = [];
  else if (sc && S[sc]) ids = [sc];
  else if (G.length) { ids = G.map(s => s.stat_energy_from); daEnergia = true; }
  else if (R.gas) ids = [R.gas];
  /* il prezzo vale solo per i contatori della configurazione Energia (è per la loro unità: €/m³ o €/kWh) */
  const g = G.find(s => ids.includes(s.stat_energy_from));
  if (g) prezzo = g.number_energy_price != null ? +g.number_energy_price : g.entity_energy_price && S[g.entity_energy_price] ? val(g.entity_energy_price) : null;
  let u = ids.map(id => S[id] && unit(id)).find(Boolean);
  if (!u && ids.length) { const M = meta(ids); u = Array.isArray(M) ? M.map(x => x.statistics_unit_of_measurement || x.display_unit_of_measurement).find(Boolean) : null; }
  return { ids, prezzo, daEnergia, u: UNITA(u) || "m³" };
}
const cambioIn = (id, periodo) => cached("cd:per:" + id + ":" + periodo + ":" + dataISO(oggi0()), 5 * 60000, () =>
  ws({ type: "recorder/statistic_during_period", statistic_id: id, calendar: { period: periodo }, types: ["change"] }).then(r => r?.change ?? null).catch(() => null));
const somma = (ids, periodo) => { const v = ids.map(id => cambioIn(id, periodo)); if (v.some(x => x === undefined)) return undefined; const n = v.filter(x => x != null); return n.length ? n.reduce((a, b) => a + b, 0) : null; };
const euro = v => v == null || isNaN(v) ? "—" : v.toLocaleString(LOC, { style: "currency", currency: "EUR" });
const qta = (v, u) => v == null ? "—" : fnum(v, v < 10 ? 2 : v < 100 ? 1 : 0) + " " + u;

/* ---------- disegno: caldaia, termosifone e rubinetto (viewBox 320×200) ---------- */
/** forma di una fiamma con la base in (x, y) e alta h */
const lingua = (x, y, h, w) => `M${x} ${y}c${-w} ${(-h * .2).toFixed(1)} ${(-w * 1.1).toFixed(1)} ${(-h * .55).toFixed(1)} 0 ${-h}c${(w * 1.1).toFixed(1)} ${(h * .45).toFixed(1)} ${w} ${(h * .8).toFixed(1)} 0 ${h}z`;
/** svg della caldaia: s = stato(); o = { cls: "xs" (piccola, solo la caldaia), mandata, ritorno (testi), lcd (testo del display) } */
export function scena(s, o = {}) {
  const xs = o.cls === "xs", m = s.fiamma ? s.mod / 100 : 0;
  const err = s.err.length > 0, pk = s.P.k === "bassa" || s.P.k === "alta";
  const pAng = s.P.p == null ? -120 : -120 + Math.max(0, Math.min(4, s.P.p)) / 4 * 240;
  const cls = ["cd1s", xs ? "xs" : "", s.fiamma ? "on" : "", s.pompa || s.fiamma ? "fl" : "", s.ch || (s.pompa && !s.acs) ? "ch" : "", s.acs ? "acs" : "", err ? "err" : "", pk ? "pk" : "", s.raggiungibile ? "" : "un"].filter(Boolean).join(" ");
  const H = [19, 24, 28, 24, 19], fiamme = [137, 148.5, 160, 171.5, 183].map((x, i) => `<g class="lg l${i}"><path class="fo" d="${lingua(x, 76, H[i], 5)}"/><path class="fp" d="${lingua(x, 72, H[i] * .62, 3.4)}"/><path class="fc" d="${lingua(x, 76, H[i] * .34, 2.4)}"/></g>`).join("");
  const termosifone = [14, 24, 34, 44, 54].map((x, i) => `<rect class="col" x="${x}" y="98" width="8" height="52" rx="4"/><rect class="cal c${i}" x="${x}" y="98" width="8" height="52" rx="4"/>`).join("");
  const onda = (x, y) => `<path d="M${x} ${y}q2.6 -3 0 -6t0 -6 0 -6"/>`;
  return `<svg class="${cls}" style="--mod:${m.toFixed(2)}" viewBox="${xs ? "100 0 120 150" : "0 0 320 200"}" role="img" aria-label="${esc(t("Caldaia", "Boiler"))}">
    ${xs ? "" : `<g class="tb">
      <path class="tu m" d="M130 138V166H58V152"/><path class="tu r" d="M22 152V186H146V138"/>
      <path class="tu g" d="M162 138V196"/><path class="tu a" d="M180 138V164H262V125"/>
      <path class="fx m" d="M130 138V166H58V152"/><path class="fx r" d="M22 152V186H146V138"/><path class="fx a" d="M180 138V164H262V125"/>
      <rect class="vg" x="157" y="176" width="10" height="5" rx="1.5"/>
    </g>
    <g class="rad"><rect class="k2" x="12" y="104" width="52" height="3" rx="1.5"/><rect class="k2" x="12" y="141" width="52" height="3" rx="1.5"/>${termosifone}
      <g class="ond">${onda(24, 92)}${onda(38, 90)}${onda(52, 92)}</g></g>
    <g class="rub"><path class="mx" d="M262 112V106M255.5 105H268.5"/><rect class="cr" x="253" y="111" width="18" height="14" rx="5"/><path class="mx" d="M271 117.5H279a5 5 0 0 1 5 5V128"/>
      <g class="gcc"><circle cx="284" cy="135" r="1.8"/><circle cx="284" cy="143" r="1.6"/><circle cx="284" cy="151" r="1.4"/><circle cx="284" cy="159" r="1.2"/></g></g>
    ${o.acs ? `<text class="et a" x="222" y="158" text-anchor="middle">${esc(o.acs)}</text>` : ""}
    ${o.mandata ? `<text class="et m" x="94" y="161" text-anchor="middle">${esc(o.mandata)}</text>` : ""}${o.ritorno ? `<text class="et r" x="84" y="198" text-anchor="middle">${esc(o.ritorno)}</text>` : ""}
    <text class="et g" x="170" y="196">gas</text>`}
    <rect class="cs" x="110" y="8" width="100" height="130" rx="16"/><path class="hl" d="M122 14.5h46"/>
    <rect class="fin" x="126" y="26" width="68" height="58" rx="11"/>
    <g class="bag"><ellipse cx="160" cy="70" rx="32" ry="11"/><ellipse cx="160" cy="71" rx="24" ry="8"/><ellipse cx="160" cy="72" rx="15" ry="5.5"/></g>
    <g class="fia">${fiamme}</g>
    <rect class="bru" x="132" y="76" width="56" height="4.4" rx="2.2"/>
    <rect class="lcd" x="128" y="92" width="64" height="20" rx="6"/><text class="lt" x="160" y="106.5" text-anchor="middle">${esc(o.lcd ?? "")}</text>
    <g class="man"><circle class="mq" cx="160" cy="126" r="7.5"/><path class="mz" d="M154.2 130.8a7.5 7.5 0 0 1 -1.3 -7.4"/><path class="mz" d="M167.1 123.4a7.5 7.5 0 0 1 -1.3 7.4"/>
      <path class="ago" style="transform:rotate(${pAng.toFixed(0)}deg)" d="M160 126V120.5"/><circle class="hub" cx="160" cy="126" r="1.4"/></g>
    <circle class="kn" cx="138" cy="126" r="4.2"/><circle class="kn" cx="182" cy="126" r="4.2"/><circle class="led" cx="196" cy="20" r="2.2"/>
  </svg>`;
}
const gradi = id => id && val(id) != null ? fnum(val(id), 0) + "°" : null;
/** temperatura dell'acqua calda: quella dello scaldacqua (water_heater), altrimenti il sensore */
const tempAcs = R => R.wh && S[R.wh] && attr(R.wh, "current_temperature") != null ? +attr(R.wh, "current_temperature") : R.acsTemp ? val(R.acsTemp) : null;
function lcd(R, s) {
  if (!s.raggiungibile) return "- - -";
  if (s.err.length) { const c = s.err.find(e => e.cod)?.cod; return c ? (/^[a-z]/i.test(c) ? c : "E" + c).slice(0, 5) : "⚠"; }
  if (s.acs) return gradi(R.acsTemp) || (R.wh && attr(R.wh, "current_temperature") != null ? fnum(attr(R.wh, "current_temperature"), 0) + "°" : "ACS");
  return gradi(R.mandata) || (s.fiamma ? "ON" : "– –");
}

/* ---------- schede ---------- */
const nomeCaldaia = () => conf().nome || (trovaTutto().D.length === 1 ? nomeDev(trovaTutto().D[0]) : "") || t("Caldaia", "Boiler");
const valore = (id, d = 0, u) => id && val(id) != null ? fnum(val(id), d) + (u ?? (isTempS(id) ? "°" : unit(id) ? " " + unit(id) : "")) : "—";
const tile = (k, v, id, cls = "", sub = "") => `<${id ? `button data-act="more" data-id="${id}"` : "div"} class="cd1k ${cls}"><small>${k}</small><b>${v}</b>${sub ? `<span>${sub}</span>` : ""}</${id ? "button" : "div"}>`;
function cardScena() {
  const R = ruoli(), s = stato(R), ed = UI.edit && isAdmin();
  const tag = !s.raggiungibile ? ["bad", t("non raggiungibile", "unavailable")] : s.err.length ? ["bad", t("errore", "error")] : s.fiamma ? ["warn", t("fiamma accesa", "flame on")] : s.fiamma === false ? ["", t("fiamma spenta", "flame off")] : ["info", t("stato sconosciuto", "unknown")];
  const frase = !s.raggiungibile ? t("La caldaia non risponde a Home Assistant.", "The boiler isn't responding to Home Assistant.")
    : s.fiamma && s.acs ? "🚿 " + t("Sta scaldando l'acqua calda", "Heating hot water")
    : s.fiamma ? "♨️ " + t("Sta scaldando i termosifoni", "Heating the radiators")
    : s.acs ? "🚿 " + t("Acqua calda in uso", "Hot water in use")
    : s.ch ? "♨️ " + t("Riscaldamento acceso, fiamma in pausa", "Heating on, flame resting")
    : s.fiamma === null ? "ℹ️ " + t("Non so se la fiamma è accesa", "I don't know if the flame is on")
    : "💤 " + t("A riposo", "Resting");
  const cal = s.fiamma && s.conMod ? `<span class="cd1bar"><i style="width:${Math.max(3, s.mod).toFixed(0)}%"></i></span>` : "";
  return `<section class="card span2 cd1h ${s.err.length || !s.raggiungibile ? "ko" : ""}">
    <div class="ch"><h2>🔥 ${esc(nomeCaldaia())} <span class="tag ${tag[0]}">${tag[1]}</span></h2>${ed ? `<button class="btn sm" data-act="cdSens">✏️ ${t("Sensori", "Sensors")}</button>` : ""}</div>
    <div class="cd1in">
      <div class="cd1sc">${scena(s, { mandata: gradi(R.mandata), ritorno: gradi(R.ritorno), acs: tempAcs(R) != null ? fnum(tempAcs(R), 0) + "°" : null, lcd: lcd(R, s) })}</div>
      <div class="cd1st">
        <div class="cd1f">${frase}</div>
        <div class="cd1ks">
          ${R.mod || R.fiamma ? tile("🔥 " + t("Modulazione", "Modulation"), s.fiamma === false ? t("spenta", "off") : s.conMod ? Math.round(s.mod) + "%" : t("accesa", "on"), R.mod || R.fiamma, s.fiamma ? "on" : "", cal) : ""}
          ${R.mandata ? tile("↗ " + t("Mandata", "Flow"), valore(R.mandata), R.mandata, "m") : ""}
          ${R.ritorno ? tile("↙ " + t("Ritorno", "Return"), valore(R.ritorno), R.ritorno, "r") : ""}
          ${R.press ? tile("⏲ " + t("Pressione", "Pressure"), s.P.p != null ? fnum(s.P.p, 1) + " bar" : "—", R.press, s.P.k === "ok" ? "" : s.P.k === "nd" ? "" : "bad") : ""}
        </div>
      </div>
    </div></section>`;
}
function cardImpianto() {
  const R = ruoli(), P = pressione(R), s = stato(R);
  if (!R.press && !R.esterna && !R.pompa) return "";
  const pos = v => Math.max(0, Math.min(100, v / 4 * 100)).toFixed(1);
  const msg = P.k === "bassa" ? ["bad", "⚠️ " + t(`Pressione bassa (sotto ${fnum(P.s.min, 1)} bar): l'impianto va ricaricato, come spiega il libretto della caldaia. Se cala spesso, c'è una perdita da far controllare.`, `Low pressure (below ${fnum(P.s.min, 1)} bar): the system needs topping up, as the boiler manual explains. If it keeps dropping, have a leak checked.`)]
    : P.k === "alta" ? ["bad", "⚠️ " + t(`Pressione alta (sopra ${fnum(P.s.max, 1)} bar): fai controllare l'impianto e il vaso d'espansione.`, `High pressure (above ${fnum(P.s.max, 1)} bar): have the system and the expansion vessel checked.`)]
    : P.k === "ok" ? ["ok", "✅ " + t(`Pressione giusta (tra ${fnum(P.s.min, 1)} e ${fnum(P.s.max, 1)} bar)`, `Pressure fine (between ${fnum(P.s.min, 1)} and ${fnum(P.s.max, 1)} bar)`)] : ["", t("Pressione non disponibile", "Pressure not available")];
  return card("🛠️ " + t("Impianto", "System"), `
    ${R.press ? `<button class="cd1p ${P.k}" data-act="more" data-id="${R.press}"><b>${P.p != null ? fnum(P.p, 1) : "—"}<small> bar</small></b>
      <span class="cd1pt"><i class="z" style="left:${pos(P.s.min)}%;width:${(+pos(P.s.max) - +pos(P.s.min)).toFixed(1)}%"></i>${P.p != null ? `<i class="n" style="left:${pos(P.p)}%"></i>` : ""}</span>
      <span class="cd1ps"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span></span></button>
    <div class="cd1msg ${msg[0]}">${msg[1]}</div>` : ""}
    <div class="stack" style="margin-top:12px">
      ${R.esterna ? `<button class="li" data-act="more" data-id="${R.esterna}"><span class="ic">🌤️</span><div class="tx"><b>${t("Temperatura esterna", "Outdoor temperature")} ${valore(R.esterna, 1)}</b><span>${t("la caldaia la usa per regolare la mandata", "the boiler uses it to set the flow temperature")}</span></div></button>` : ""}
      ${R.pompa ? `<div class="li"><span class="ic">🔄</span><div class="tx"><b>${t("Pompa", "Pump")}</b><span>${!ok(R.pompa) ? t("non raggiungibile", "unavailable") : acceso(R.pompa) ? t("in funzione: l'acqua gira nell'impianto", "running: water is circulating") : t("ferma", "stopped")}</span></div><span class="cd1dot ${acceso(R.pompa) ? "on" : ""}"></span></div>` : ""}
    </div>`, { cls: "cd1im" + (s.P.k === "bassa" || s.P.k === "alta" ? " ko" : "") });
}
/* ---------- modalità in parole ---------- */
const MODI = () => ({ summer: ["☀️", t("Estate", "Summer")], estate: ["☀️", t("Estate", "Summer")], winter: ["❄️", t("Inverno", "Winter")], inverno: ["❄️", t("Inverno", "Winter")],
  auto: ["✨", "Auto"], automatic: ["✨", "Auto"], automatico: ["✨", "Auto"], off: ["⏻", t("Spento", "Off")], spento: ["⏻", t("Spento", "Off")], standby: ["⏻", "Standby"],
  heating_only: ["♨️", t("Solo riscaldamento", "Heating only")], heating: ["♨️", t("Riscaldamento", "Heating")], heat: ["♨️", t("Riscaldamento", "Heating")],
  dhw_only: ["🚿", t("Solo acqua calda", "Hot water only")], dhw: ["🚿", t("Acqua calda", "Hot water")], heating_and_dhw: ["♨️", t("Riscaldamento e acqua calda", "Heating and hot water")], dhwandheating: ["♨️", t("Riscaldamento e acqua calda", "Heating and hot water")],
  cooling: ["❄️", t("Raffrescamento", "Cooling")], cooling_only: ["❄️", t("Solo raffrescamento", "Cooling only")], cool: ["❄️", t("Raffrescamento", "Cooling")],
  comfort: ["🌡️", "Comfort"], eco: ["🌿", "Eco"], economy: ["🌿", "Eco"], green: ["🌿", "Green"], performance: ["⚡", t("Prestazioni", "Performance")], high_demand: ["⚡", t("Alta richiesta", "High demand")],
  boost: ["⚡", "Boost"], electric: ["🔌", t("Elettrico", "Electric")], gas: ["🔥", "Gas"], heat_pump: ["♻️", t("Pompa di calore", "Heat pump")], manual: ["✋", t("Manuale", "Manual")],
  time_program: ["🗓️", t("Programma", "Schedule")], program: ["🗓️", t("Programma", "Schedule")], schedule: ["🗓️", t("Programma", "Schedule")], away: ["🧳", t("Fuori casa", "Away")],
  vacation: ["🧳", t("Vacanza", "Holiday")], holiday: ["🧳", t("Vacanza", "Holiday")], frost_protection: ["🧊", t("Antigelo", "Frost protection")], antifreeze: ["🧊", t("Antigelo", "Frost protection")],
  night: ["🌙", t("Notte", "Night")], reduced: ["🌙", t("Ridotto", "Reduced")], normal: ["🌡️", t("Normale", "Normal")], on: ["⏻", t("Acceso", "On")] });
const nomeModo = m => { const k = String(m).toLowerCase().replace(/[\s-]+/g, "_"), x = MODI()[k]; return x ? x : ["", String(m).replace(/_/g, " ")]; };
/** scelta tra le modalità: pulsanti se sono poche, altrimenti un menu */
function scelta(id, opzioni, attuale, act, chg) {
  if (!opzioni?.length) return "";
  if (opzioni.length > 5) return `<select class="cd1sel" data-chg="${chg}" data-id="${id}">${opzioni.map(o => `<option value="${esc(o)}" ${o === attuale ? "selected" : ""}>${esc(nomeModo(o).join(" ").trim())}</option>`).join("")}</select>`;
  return `<div class="seg cd1seg">${opzioni.map(o => `<button class="${o === attuale ? "act" : ""}" data-act="${act}" data-id="${id}" data-v="${esc(o)}">${nomeModo(o)[0] ? `<span>${nomeModo(o)[0]}</span>` : ""}${esc(nomeModo(o)[1])}</button>`).join("")}</div>`;
}
/** − valore + : n (number/input_number), climate (temperature) o water_heater (temperature) */
function regola(id, v, passo, act, dec) {
  return `<div class="cd1rg"><button class="step" data-act="${act}" data-id="${id}" data-d="-1" aria-label="−">−</button><span class="tgt">${v == null ? "—" : fnum(v, dec) + "°"}</span><button class="step" data-act="${act}" data-id="${id}" data-d="1" aria-label="+">+</button></div>`;
}
const passoDi = id => { const s = +(attr(id, "step") || attr(id, "target_temp_step") || 0); return s > 0 ? s : 1; };
function cardRiscaldamento() {
  const R = ruoli(), s = stato(R), C = R.circuito && S[R.circuito] ? R.circuito : null;
  if (!C && !R.interruttore && !R.modo && !R.setMandata && !R.termostati.length && !R.chOn) return "";
  const H = C ? (attr(C, "hvac_modes") || []) : [];
  /* acceso o spento: l'interruttore, altrimenti il clima del circuito */
  let on = null, sw = "";
  if (R.interruttore && ok(R.interruttore)) { on = S[R.interruttore].state === "on"; sw = `<button class="sw ${on ? "on" : ""}" data-act="toggle" data-id="${R.interruttore}" aria-label="${t("Riscaldamento", "Heating")}"><i></i></button>`; }
  else if (C && ok(C) && H.includes("off")) { on = S[C].state !== "off"; sw = `<button class="sw ${on ? "on" : ""}" data-act="cpower" data-id="${C}" aria-label="${t("Riscaldamento", "Heating")}"><i></i></button>`; }
  const st = !on && on !== null ? t("spento", "off") : s.ch ? (s.fiamma && !s.acs ? t("sta scaldando", "heating") : t("acceso, in attesa", "on, waiting")) : on ? t("acceso, la casa è in temperatura", "on, home is warm enough") : t("pronto", "ready");
  /* mandata impostata: number/input_number, oppure la temperatura del circuito se è quella dell'acqua (max sopra i 35°) */
  const nSet = R.setMandata && /^(number|input_number)\./.test(R.setMandata) && ok(R.setMandata) ? R.setMandata : null;
  const cAcqua = C && attr(C, "temperature") != null && (attr(C, "max_temp") == null || +attr(C, "max_temp") > 35) ? C : null;
  const setV = nSet ? val(nSet) : cAcqua ? +attr(cAcqua, "temperature") : R.setMandata ? val(R.setMandata) : null;
  const setHtml = nSet ? regola(nSet, setV, passoDi(nSet), "cdNum", passoDi(nSet) < 1 ? 1 : 0) : cAcqua ? regola(cAcqua, setV, passoDi(cAcqua), "cstep", passoDi(cAcqua) < 1 ? 1 : 0) : setV != null ? `<b class="cd1v">${fnum(setV, 0)}°</b>` : "";
  const modi = R.modo && ok(R.modo) ? scelta(R.modo, attr(R.modo, "options"), S[R.modo].state, "cdSel", "cdSelC") : C && H.length > 1 ? `<div class="seg cd1seg">${H.map(m => `<button class="${m === S[C].state ? "act" : ""}" data-act="cmode" data-id="${C}" data-v="${m}">${nomeModo(m)[0] ? `<span>${nomeModo(m)[0]}</span>` : ""}${esc(nomeModo(m)[1])}</button>`).join("")}</div>` : "";
  const preset = C && (attr(C, "preset_modes") || []).length > 1 ? scelta(C, attr(C, "preset_modes"), attr(C, "preset_mode"), "cdPreset", "cdPresetC") : "";
  const termo = R.termostati.filter(x => S[x]).map(x => `<button class="li" data-act="go" data-id="clima"><span class="ic">🌡️</span><div class="tx"><b>${esc(nm(x))}</b><span>${attr(x, "current_temperature") != null ? fnum(attr(x, "current_temperature"), 1) + "°" : "—"}${attr(x, "temperature") != null ? " → " + fnum(attr(x, "temperature"), 1) + "°" : ""} · ${esc((({ heating: t("chiede calore", "calling for heat"), idle: t("a riposo", "idle"), off: t("spento", "off") })[attr(x, "hvac_action")]) || S[x].state)}</span></div><span class="st">›</span></button>`).join("");
  return card("♨️ " + t("Riscaldamento", "Heating"), `
    <div class="cd1row"><div class="tx"><b>${t("Riscaldamento", "Heating")}</b><span class="${s.ch && s.fiamma && !s.acs ? "cd1hot" : ""}">${st}</span></div>${sw}</div>
    ${modi ? `<div class="fl1">${t("Modalità", "Mode")}</div>${modi}` : ""}
    ${preset ? `<div class="fl1">${t("Programma", "Preset")}</div>${preset}` : ""}
    ${setHtml ? `<div class="cd1row cd1rs"><div class="tx"><b>${t("Mandata impostata", "Flow set point")}</b><span>${t("quanto calda va l'acqua nei termosifoni", "how hot the water to the radiators is")}</span></div>${setHtml}</div>` : ""}
    ${termo ? `<div class="fl1">${t("Termostati", "Thermostats")}</div><div class="stack">${termo}</div>` : ""}`);
}
function cardAcqua() {
  const R = ruoli(), s = stato(R), W = R.wh && S[R.wh] ? R.wh : null;
  if (!W && !R.acsTemp && !R.acsSet && !R.dhwOn) return "";
  const cur = W && attr(W, "current_temperature") != null ? +attr(W, "current_temperature") : R.acsTemp ? val(R.acsTemp) : null;
  const sf = W ? +(attr(W, "supported_features") || 0) : 0, L = W ? (attr(W, "operation_list") || []) : [];
  const modi = W ? L.filter(m => !/^off$/i.test(m)) : [];
  const mAtt = W ? attr(W, "operation_mode") ?? S[W].state : null;
  /* acceso o spento: turn_on/turn_off (funzione 8) o la modalità «off» */
  const puoOnOff = W && ok(W) && ((sf & 8) || L.some(m => /^off$/i.test(m)));
  const spento = W && (S[W].state === "off" || /^off$/i.test(String(mAtt)));
  const nSet = R.acsSet && /^(number|input_number)\./.test(R.acsSet) && ok(R.acsSet) ? R.acsSet : null;
  const setV = W && attr(W, "temperature") != null ? +attr(W, "temperature") : R.acsSet ? val(R.acsSet) : null;
  const set = W && attr(W, "temperature") != null && ok(W) ? regola(W, setV, 1, "cdWhT", passoDi(W) < 1 ? 1 : 0) : nSet ? regola(nSet, setV, passoDi(nSet), "cdNum", passoDi(nSet) < 1 ? 1 : 0) : setV != null ? `<b class="cd1v">${fnum(setV, 0)}°</b>` : "";
  const boostMode = W ? L.find(m => R_BOOST.test(m)) : null;
  const bAttivo = R.boost ? (R.boost.startsWith("switch.") || R.boost.startsWith("input_boolean.") ? S[R.boost]?.state === "on" : false) : boostMode ? mAtt === boostMode : false;
  const boost = R.boost && S[R.boost] ? `<button class="btn ${bAttivo ? "warm" : ""}" data-act="cdBoost" data-id="${R.boost}">⚡ ${bAttivo ? t("Boost attivo", "Boost on") : "Boost"}</button>` : boostMode && ok(W) ? `<button class="btn ${bAttivo ? "warm" : ""}" data-act="cdWhM" data-id="${W}" data-v="${esc(bAttivo ? (modi.find(m => m !== boostMode) || boostMode) : boostMode)}">⚡ ${bAttivo ? t("Boost attivo", "Boost on") : "Boost"}</button>` : "";
  const modiSenzaBoost = modi.filter(m => m !== boostMode);
  const sceltaModi = W && modiSenzaBoost.length > 1 && ok(W) ? scelta(W, modiSenzaBoost, mAtt, "cdWhM", "cdWhMC") : R.acsModo && ok(R.acsModo) ? scelta(R.acsModo, attr(R.acsModo, "options"), S[R.acsModo].state, "cdSel", "cdSelC") : "";
  const stTxt = spento ? t("spenta", "off") : s.acs ? "🚿 " + t("in uso adesso", "in use now") : W && !ok(W) ? t("non raggiungibile", "unavailable") : t("pronta", "ready");
  return card("🚿 " + t("Acqua calda", "Hot water"), `
    <div class="cd1row"><div class="tx"><b>${t("Acqua calda sanitaria", "Domestic hot water")}</b><span class="${s.acs ? "cd1hot" : ""}">${stTxt}</span></div>
      ${puoOnOff ? `<button class="sw ${spento ? "" : "on"}" data-act="cdWhOn" data-id="${W}" aria-label="${t("Acqua calda", "Hot water")}"><i></i></button>` : ""}</div>
    <div class="cd1ac ${s.acs ? "on" : ""}">
      <div class="cd1at"><small>${t("Adesso", "Now")}</small><b>${cur != null ? fnum(cur, 0) + "°" : "—"}</b></div>
      ${set ? `<div class="cd1as"><small>${t("Voluta", "Target")}</small>${set}</div>` : ""}
    </div>
    ${sceltaModi ? `<div class="fl1">${t("Modalità", "Mode")}</div>${sceltaModi}` : ""}
    ${boost ? `<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">${boost}<span class="small muted">${t("acqua calda subito, per una volta", "hot water right away, just once")}</span></div>` : ""}`, { cls: s.acs ? "cd1acq on" : "cd1acq" });
}
function cardErrori() {
  const R = ruoli(), s = stato(R), M = manutenzione(R);
  const errHtml = s.err.length ? `<div class="stack">${s.err.map(e => `<button class="li cd1er" data-act="more" data-id="${e.id}"><span class="ic">${e.allarme ? "🚨" : "⚠️"}</span><div class="tx"><b>${e.cod ? `<span class="cd1cod">${esc(e.cod)}</span>` : ""}${esc(e.txt || t("Errore della caldaia", "Boiler error"))}</b><span>${e.extra ? esc(e.extra) + " · " : ""}${esc(new Date(S[e.id].last_changed).toLocaleString(LOC, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></div></button>`).join("")}</div>
      <p class="small muted" style="margin-top:8px">${t("Il significato preciso di ogni codice è nel libretto della caldaia.", "The exact meaning of each code is in the boiler manual.")}</p>`
    : `<div class="cd1ok">✅ ${R.errore || R.allarmi.length ? t("Nessun errore", "No errors") : t("L'integrazione non segnala errori", "The integration reports no error codes")}</div>`;
  const mcls = M.giorni == null ? "" : M.giorni < 0 ? "bad" : M.giorni <= 30 ? "warn" : "";
  const manut = `<div class="cd1mn ${mcls}">
      <span class="ic">🔧</span><div class="tx"><b>${M.data ? t("Prossima manutenzione", "Next service") + ": " + esc(dataTesto(M.data)) : M.testoInt ? esc(M.testoInt) : t("Manutenzione non annotata", "Service not recorded")}</b>
      <span>${M.giorni != null ? traGiorni(M.giorni) + (M.fonte === "int" ? " · " + t("dalla caldaia", "from the boiler") : "") : t("Annota l'ultima: ti ricordo la prossima negli Avvisi.", "Record the last one: I'll remind you of the next in Alerts.")}${M.ultima ? " · " + t("ultima", "last") + " " + esc(dataTesto(M.ultima)) : ""}</span>
      ${M.nota ? `<em>${esc(M.nota)}</em>` : ""}</div></div>
    ${M.chiede ? `<div class="cd1msg bad">🔧 ${t("La caldaia chiede la manutenzione.", "The boiler is asking for a service.")}</div>` : ""}
    ${isAdmin() ? `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="cdManut">✏️ ${t("Annota", "Record")}</button>${M.fonte === "mano" || !M.data ? `<button class="btn sm" data-act="cdFatta">✅ ${t("Fatta oggi", "Done today")}</button>` : ""}</div>` : ""}`;
  return card("⚠️ " + t("Errori e manutenzione", "Errors and service"), `${errHtml}<div class="fl1">🔧 ${t("Manutenzione", "Service")}</div>${manut}`, { cls: s.err.length ? "cd1ers ko" : "cd1ers" });
}
let VS = "mese";
function cardGas() {
  const g = gas();
  if (!g.ids.length) return card("🔥 " + t("Consumi del gas", "Gas use"), `<p class="small muted" style="line-height:1.5">${t("Per vedere quanto gas usi aggiungi il contatore del gas nella configurazione Energia di Home Assistant (Impostazioni → Dashboard → Energia)", "To see your gas use add the gas meter to Home Assistant's Energy configuration (Settings → Dashboards → Energy)")}${isAdmin() ? t(", oppure scegline uno con ✏️ Modifica → Sensori.", ", or pick one with ✏️ Edit → Sensors.") : "."}</p>`, { cls: "span3" });
  const oggi = somma(g.ids, "day"), mese = somma(g.ids, "month");
  const [giorni, periodo] = VS === "anno" ? [365, "month"] : [30, "day"];
  const ora = new Date(), start = periodo === "month" ? new Date(ora.getFullYear(), ora.getMonth() - 11, 1) : new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() - giorni + 1);
  const r = statistiche(g.ids, start, periodo, ["change"]);
  const punti = (() => { const m = {}; for (const id of g.ids) for (const p of (r?.[id] || [])) m[p.start] = (m[p.start] || 0) + (p.change || 0); return Object.entries(m).map(([x, v]) => ({ x: +x, v: Math.max(0, v) })); })();
  const tot = punti.reduce((a, q) => a + q.v, 0), cost = v => g.prezzo != null && v != null ? euro(v * g.prezzo) : null;
  const k = (n, v, c, cls = "") => `<div class="cd1g ${cls}"><small>${n}</small><b>${v === undefined ? "…" : qta(v, g.u)}</b>${c ? `<span>${c}</span>` : ""}</div>`;
  const media = mese != null ? mese / new Date().getDate() : null;
  return card("🔥 " + t("Consumi del gas", "Gas use"), `<div class="cd1gw">
    <div class="cd1gs">${k(t("Oggi", "Today"), oggi, cost(oggi))}${k(t("Questo mese", "This month"), mese, cost(mese))}${k(t("Media al giorno", "Daily average"), media, cost(media), "md")}
      ${g.prezzo != null ? `<div class="cd1g eu"><small>${VS === "anno" ? t("Ultimi 12 mesi", "Last 12 months") : t("Ultimi 30 giorni", "Last 30 days")}</small><b>${r === undefined ? "…" : euro(tot * g.prezzo)}</b><span>${r === undefined ? "" : qta(tot, g.u)}</span></div>` : ""}</div>
    <div class="cd1gc"><div class="seg" style="margin-bottom:10px">${[["mese", t("30 giorni", "30 days")], ["anno", t("12 mesi", "12 months")]].map(([x, n]) => `<button class="${VS === x ? "act" : ""}" data-act="cdStor" data-v="${x}">${n}</button>`).join("")}</div>
    ${r === undefined ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : barre([{ nome: t("Gas", "Gas"), colore: "#ff9f0a", valori: punti }], { u: g.u, periodo })}
    <div class="small muted" style="margin-top:8px">${g.prezzo != null ? t("Prezzo", "Price") + ": " + euro(g.prezzo) + "/" + esc(g.u) + " · " + t("dalla configurazione Energia", "from the Energy configuration") : g.daEnergia ? t("Per il costo imposta il prezzo del gas nella configurazione Energia di Home Assistant.", "For the cost set the gas price in Home Assistant's Energy configuration.") : t("Dalle statistiche di Home Assistant.", "From Home Assistant's statistics.")}</div></div></div>`, { cls: "span3 cd1gas" });
}
ACT.cdStor = el => { VS = el.dataset.v; render(); };

function pagina() {
  const { D, nascosti } = trovaTutto(), ed = UI.edit && isAdmin();
  if (!D.length) return `<div class="g g3">${card("🔥 " + t("Caldaia", "Boiler"), `<p class="small muted" style="line-height:1.5">${t("Non trovo la caldaia in Home Assistant.", "I can't find the boiler in Home Assistant.")}${isAdmin() ? " " + t("Con ✏️ Modifica puoi aggiungerla scegliendo una sua entità qualsiasi.", "With ✏️ Edit you can add it by picking any of its entities.") : ""}</p>${ed ? `<button class="add1" data-act="cdAggiungi" style="margin-top:10px"><span>＋</span>${t("Aggiungi la caldaia", "Add the boiler")}</button>` : ""}`, { cls: "span3" })}</div>`;
  const modifica = ed ? `<section class="card span3 cd1e">
      <div class="ch"><h2>✏️ ${t("Scelte della caldaia", "Boiler settings")}</h2></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-act="cdSens">🎛️ ${t("Sensori e comandi", "Sensors and controls")}</button>${isAdmin() ? `<button class="btn" data-act="cdManut">🔧 ${t("Manutenzione", "Service")}</button>` : ""}</div>
      <div class="fl1">${t("Dispositivi della caldaia", "Boiler devices")}</div>
      <div class="stack">${D.map(k => `<div class="li"><span class="ic">🔥</span><div class="tx"><b>${esc(nomeDev(k))}</b><span>${esc([DEVICES[k]?.maker, DEVICES[k]?.model].filter(Boolean).join(" ") || (trovaTutto().G[k] || []).length + " " + t("entità", "entities"))}</span></div><button class="btn sm bad" data-act="cdTogli" data-k="${esc(k)}">✕ ${t("Togli", "Remove")}</button></div>`).join("")}
        <button class="add1" data-act="cdAggiungi"><span>＋</span>${t("Aggiungi un dispositivo", "Add a device")}</button></div>
      ${nascosti.length ? `<div class="fl1">👁 ${t("Tolti dalla pagina", "Removed from the page")} (${nascosti.length})</div><div class="stack">${nascosti.map(k => `<div class="li"><span class="ic">🙈</span><div class="tx"><b>${esc(nomeDev(k))}</b><span>${esc(DEVICES[k]?.model || k)}</span></div><button class="btn sm" data-act="cdRimetti" data-k="${esc(k)}">👁 ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>` : ""}
      <p class="small muted" style="margin-top:12px">${t("I circuiti della caldaia escono dalla pagina Clima; i termostati delle stanze restano lì.", "The boiler circuits leave the Climate page; room thermostats stay there.")}</p>
    </section>` : "";
  return `<div class="g g3 cd1">${cardScena()}${cardImpianto()}${cardRiscaldamento()}${cardAcqua()}${cardErrori()}${cardGas()}${modifica}</div>`;
}

/* ---------- ✏️ sensori e comandi ---------- */
const salvaC = (fn, msg) => cambia(l => { const C = l.caldaia = JSON.parse(JSON.stringify(l.caldaia || {})); fn(C); for (const k of ["sens", "manut"]) if (C[k] && !Object.keys(C[k]).length) delete C[k]; if (!Object.keys(C).length) delete l.caldaia; }, msg);
const dom = (...d) => id => d.includes(domain(id));
const RUOLI = () => [
  [t("Bruciatore e acqua", "Burner and water"), [["fiamma", "🔥 " + t("Fiamma (accesa/spenta)", "Flame (on/off)"), dom("binary_sensor", "sensor")], ["mod", "📶 " + t("Modulazione (%)", "Modulation (%)"), dom("sensor")],
    ["mandata", "↗ " + t("Temperatura di mandata", "Flow temperature"), dom("sensor")], ["ritorno", "↙ " + t("Temperatura di ritorno", "Return temperature"), dom("sensor")], ["pompa", "🔄 " + t("Pompa (in funzione sì/no)", "Pump (running yes/no)"), dom("binary_sensor")]]],
  [t("Riscaldamento", "Heating"), [["interruttore", "⏻ " + t("Riscaldamento acceso/spento", "Heating on/off"), dom("switch", "input_boolean")], ["modo", "🗓️ " + t("Modalità (estate/inverno/auto)", "Mode (summer/winter/auto)"), dom("select", "input_select")],
    ["circuito", "♨️ " + t("Circuito del riscaldamento (clima)", "Heating circuit (climate)"), dom("climate")], ["setMandata", "🎯 " + t("Mandata impostata", "Flow set point"), dom("number", "input_number", "sensor")], ["chOn", "♨️ " + t("Riscaldamento in funzione (sì/no)", "Heating active (yes/no)"), dom("binary_sensor")]]],
  [t("Acqua calda sanitaria", "Domestic hot water"), [["wh", "🚿 " + t("Acqua calda (water_heater)", "Hot water (water_heater)"), dom("water_heater")], ["acsTemp", "🌡️ " + t("Temperatura dell'acqua calda", "Hot water temperature"), dom("sensor")],
    ["acsSet", "🎯 " + t("Temperatura voluta", "Target temperature"), dom("number", "input_number", "sensor")], ["acsModo", "🌿 " + t("Modalità comfort/eco", "Comfort/eco mode"), dom("select", "input_select")],
    ["boost", "⚡ Boost", dom("switch", "button", "input_boolean", "input_button")], ["dhwOn", "🚿 " + t("Acqua calda in uso (sì/no)", "Hot water in use (yes/no)"), dom("binary_sensor")]]],
  [t("Impianto, errori e gas", "System, errors and gas"), [["press", "⏲ " + t("Pressione dell'impianto", "System pressure"), dom("sensor")], ["esterna", "🌤️ " + t("Temperatura esterna della caldaia", "Boiler outdoor temperature"), dom("sensor")],
    ["errore", "⚠️ " + t("Codice di errore", "Error code"), dom("sensor")], ["manut", "🔧 " + t("Manutenzione (dall'integrazione)", "Service (from the integration)"), dom("sensor")], ["servizio", "🔧 " + t("Richiesta di manutenzione (sì/no)", "Service request (yes/no)"), dom("binary_sensor")],
    ["gas", "🔥 " + t("Contatore del gas", "Gas meter"), dom("sensor")]]],
];
const valoreDi = id => id && S[id] ? (ok(id) ? esc(S[id].state) + (unit(id) ? " " + esc(unit(id)) : "") : t("non raggiungibile", "unavailable")) : "—";
function schedaSensori() {
  const R = ruoli(), sc = conf().sens || {}, g = gas(R), s = soglie();
  const riga = (r, n) => { const id = r === "gas" ? (sc.gas === "none" ? null : g.ids[0] || null) : sc[r] === "none" ? null : R[r], man = !!sc[r];
    return `<button class="pk1 ${man ? "sel1" : ""}" data-act="cdRuolo" data-r="${r}"><span class="tx"><b>${n}</b><small>${id ? esc(S[id] ? nm(id) : id) + " · " + valoreDi(id) : t("nessuno", "none")}${man ? "" : " · ✨ " + t("automatico", "automatic")}${r === "gas" && !man && g.daEnergia ? " · " + t("configurazione Energia", "Energy configuration") : ""}</small></span><span class="st">›</span></button>`; };
  return `<div class="sh-head"><div><h3>🎛️ ${t("Sensori e comandi", "Sensors and controls")}</h3><div class="small muted">${t("Lascia «automatico» se va bene così.", "Leave «automatic» if it's fine.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome della caldaia", "Boiler name")}</span><input id="cd1n" type="text" value="${esc(BZ.cd1n ?? conf().nome ?? "")}" placeholder="${esc(trovaTutto().D.length === 1 ? nomeDev(trovaTutto().D[0]) : t("Caldaia", "Boiler"))}"></label>
    ${RUOLI().map(([tit, L]) => `<div class="fl1">${tit}</div><div class="pkl1">${L.map(([r, n]) => riga(r, n)).join("")}</div>`).join("")}
    <div class="fl1">⏲ ${t("Avviso della pressione (bar)", "Pressure alert (bar)")}</div>
    <div class="row" style="gap:10px"><label class="fld1" style="flex:1;margin-top:0"><span>${t("Sotto", "Below")}</span><input id="cd1pmin" type="number" step="0.1" min="0" max="6" value="${esc(BZ.cd1pmin ?? conf().pmin ?? "")}" placeholder="${fnum(s.min, 1)}"></label>
      <label class="fld1" style="flex:1;margin-top:0"><span>${t("Sopra", "Above")}</span><input id="cd1pmax" type="number" step="0.1" min="0" max="6" value="${esc(BZ.cd1pmax ?? conf().pmax ?? "")}" placeholder="${fnum(s.max, 1)}"></label></div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="cdSalva">💾 ${t("Salva", "Save")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Le scelte valgono per tutta la casa e solo nella plancia.", "Choices apply to the whole home and only in the dashboard.")}</p>`;
}
function schedaManut() {
  const m = conf().manut || {}, ogni = +(BZ.ogni ?? m.ogni ?? 12);
  const ult = BZ.cd1u ?? m.ultima ?? "", calc = daISO(ult) ? dataISO(piuMesi(daISO(ult), ogni)) : "";
  return `<div class="sh-head"><div><h3>🔧 ${t("Manutenzione della caldaia", "Boiler service")}</h3><div class="small muted">${t("Ti ricordo la prossima negli Avvisi della Home, un mese prima.", "I'll remind you of the next one in the Home Alerts, a month ahead.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Ultima manutenzione", "Last service")}</span><input id="cd1u" type="date" value="${esc(ult)}" max="${dataISO(oggi0())}"></label>
    <div class="fl1">${t("Ogni quanto", "How often")}</div>
    <div class="seg">${[[12, t("Ogni anno", "Every year")], [24, t("Ogni 2 anni", "Every 2 years")]].map(([k, n]) => `<button class="${ogni === k ? "act" : ""}" data-act="cdOgni" data-v="${k}">${n}</button>`).join("")}</div>
    <label class="fld1"><span>${t("Prossima (vuota: la calcolo io)", "Next (empty: I work it out)")}</span><input id="cd1p" type="date" value="${esc(BZ.cd1p ?? m.prossima ?? "")}" placeholder="${esc(calc)}">${calc && !(BZ.cd1p ?? m.prossima) ? `<small>${t("Calcolata", "Worked out")}: ${esc(dataTesto(daISO(calc)))}</small>` : ""}</label>
    <label class="fld1"><span>${t("Nota", "Note")}</span><input id="cd1nt" type="text" maxlength="120" value="${esc(BZ.cd1nt ?? m.nota ?? "")}" placeholder="${t("es. ditta della manutenzione, analisi dei fumi", "e.g. service company, flue gas test")}"></label>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="cdManSalva">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="cdFatta">✅ ${t("Fatta oggi", "Done today")}</button>
      ${conf().manut ? `<button class="btn bad" data-act="cdManVia">🗑 ${t("Cancella", "Clear")}</button>` : ""}</div>`;
}

/* ---------- azioni ---------- */
let BZ = {};
document.addEventListener("input", e => { if (["cd1n", "cd1pmin", "cd1pmax", "cd1u", "cd1p", "cd1nt"].includes(e.target.id)) { BZ[e.target.id] = e.target.value; if (e.target.id === "cd1u") render(); } });
const svcNum = (id, v) => svc(domain(id), "set_value", { value: v }, { entity_id: id });
Object.assign(ACT, {
  cdNum: el => {
    const id = el.dataset.id, s = passoDi(id), mn = attr(id, "min"), mx = attr(id, "max");
    let v = Math.round(((val(id) ?? 0) + s * +el.dataset.d) * 100) / 100;
    if (mn != null) v = Math.max(+mn, v); if (mx != null) v = Math.min(+mx, v);
    svcNum(id, v);
  },
  cdWhT: el => {
    const id = el.dataset.id, a = S[id].attributes, s = passoDi(id);
    let v = Math.round(((+a.temperature || 0) + s * +el.dataset.d) * 10) / 10;
    if (a.min_temp != null) v = Math.max(+a.min_temp, v); if (a.max_temp != null) v = Math.min(+a.max_temp, v);
    svc("water_heater", "set_temperature", { temperature: v }, { entity_id: id });
  },
  cdWhM: el => svc("water_heater", "set_operation_mode", { operation_mode: el.dataset.v }, { entity_id: el.dataset.id }).then(() => toast("🚿 " + nomeModo(el.dataset.v)[1])).catch(() => {}),
  cdWhOn: el => {
    const id = el.dataset.id, sf = +(attr(id, "supported_features") || 0), L = attr(id, "operation_list") || [], spento = S[id].state === "off" || /^off$/i.test(String(attr(id, "operation_mode")));
    if (sf & 8) return svc("water_heater", spento ? "turn_on" : "turn_off", {}, { entity_id: id });
    const off = L.find(m => /^off$/i.test(m)), su = L.find(m => !/^off$/i.test(m) && !R_BOOST.test(m));
    svc("water_heater", "set_operation_mode", { operation_mode: spento ? su : off }, { entity_id: id });
  },
  cdSel: el => svc(domain(el.dataset.id), "select_option", { option: el.dataset.v }, { entity_id: el.dataset.id }).then(() => toast("✓ " + nomeModo(el.dataset.v)[1])).catch(() => {}),
  cdPreset: el => svc("climate", "set_preset_mode", { preset_mode: el.dataset.v }, { entity_id: el.dataset.id }),
  cdBoost: el => {
    const id = el.dataset.id, d = domain(id);
    const p = d === "button" || d === "input_button" ? svc(d, "press", {}, { entity_id: id }) : svc(d, "toggle", {}, { entity_id: id });
    p.then(() => toast("⚡ Boost")).catch(() => {});
  },
  cdSens: () => { BZ = {}; openSheet(schedaSensori); },
  cdRuolo: el => {
    const r = el.dataset.r, ruolo = RUOLI().flatMap(x => x[1]).find(x => x[0] === r), { E } = trovaTutto();
    scegli({ titolo: ruolo[1], sotto: esc(nomeCaldaia()), filtro: id => ruolo[2](id) && (E.includes(id) || !REG[id]?.hidden), area: null, attuale: conf().sens?.[r] || "", nessuno: true,
      onPick: id => { salvaC(C => { C.sens = { ...(C.sens || {}) }; if (id) C.sens[r] = id; else delete C.sens[r]; }); setTimeout(() => openSheet(schedaSensori), 60); } });
  },
  cdSalva: () => {
    const n = document.getElementById("cd1n")?.value.trim(), pmin = document.getElementById("cd1pmin")?.value, pmax = document.getElementById("cd1pmax")?.value;
    const num = v => v === "" || v == null || isNaN(+v) ? null : Math.round(+v * 10) / 10;
    if (num(pmin) != null && num(pmax) != null && num(pmin) >= num(pmax)) return toast(t("La soglia bassa deve essere sotto quella alta", "The low threshold must be below the high one"), true);
    closeSheet();
    salvaC(C => { if (n) C.nome = n; else delete C.nome; if (num(pmin) != null) C.pmin = num(pmin); else delete C.pmin; if (num(pmax) != null) C.pmax = num(pmax); else delete C.pmax; }, "💾 " + (n || nomeCaldaia()));
  },
  cdAggiungi: () => scegli({ titolo: "＋ " + t("Dispositivo della caldaia", "Boiler device"), sotto: t("Scegli una sua entità qualsiasi: aggiungo tutto il dispositivo.", "Pick any of its entities: I add the whole device."),
    filtro: id => /^(sensor|binary_sensor|water_heater|climate|switch|select|number)\./.test(id) && !REG[id]?.hidden && !trovaTutto().E.includes(id), auto: false,
    onPick: id => { if (!id || !S[id]) return; const k = REG[id]?.device || id; salvaC(C => { C.extra = [...new Set([...(C.extra || []), id])]; C.tolti = (C.tolti || []).filter(x => x !== k); if (!C.tolti.length) delete C.tolti; }, "＋ " + nomeDev(k)); } }),
  cdTogli: el => { const k = el.dataset.k; salvaC(C => { C.tolti = [...new Set([...(C.tolti || []), k])]; C.extra = (C.extra || []).filter(id => (REG[id]?.device || id) !== k); if (!C.extra.length) delete C.extra; }, "✕ " + nomeDev(k)); },
  cdRimetti: el => { const k = el.dataset.k; salvaC(C => { C.tolti = (C.tolti || []).filter(x => x !== k); if (!C.tolti.length) delete C.tolti; }, "👁 " + nomeDev(k)); },
  cdManut: () => { BZ = {}; openSheet(schedaManut); },
  cdOgni: el => { BZ.ogni = +el.dataset.v; render(); },
  cdManSalva: () => {
    const u = document.getElementById("cd1u")?.value || "", p = document.getElementById("cd1p")?.value || "", nota = (document.getElementById("cd1nt")?.value || "").trim(), ogni = +(BZ.ogni ?? conf().manut?.ogni ?? 12);
    if (!u && !p) return toast(t("Scrivi almeno una data", "Enter at least one date"), true);
    closeSheet();
    salvaC(C => { C.manut = { ...(u ? { ultima: u } : {}), ...(p ? { prossima: p } : {}), ogni, ...(nota ? { nota } : {}) }; }, "🔧 " + t("Manutenzione annotata", "Service recorded"));
  },
  cdFatta: () => {
    const nota = (document.getElementById("cd1nt")?.value ?? conf().manut?.nota ?? "").trim(), ogni = +(BZ.ogni ?? conf().manut?.ogni ?? 12);
    if (UI.sheet) closeSheet();
    salvaC(C => { C.manut = { ultima: dataISO(oggi0()), ogni, ...(nota ? { nota } : {}) }; }, "✅ " + t("Manutenzione fatta oggi: la prossima tra ", "Service done today: next one in ") + (ogni === 24 ? t("2 anni", "2 years") : t("un anno", "a year")));
  },
  cdManVia: () => { closeSheet(); salvaC(C => { delete C.manut; }, "🗑 " + t("Manutenzione cancellata", "Service cleared")); },
});
CHG.cdSelC = el => svc(domain(el.dataset.id), "select_option", { option: el.value }, { entity_id: el.dataset.id });
CHG.cdWhMC = el => svc("water_heater", "set_operation_mode", { operation_mode: el.value }, { entity_id: el.dataset.id });
CHG.cdPresetC = el => svc("climate", "set_preset_mode", { preset_mode: el.value }, { entity_id: el.dataset.id });

/* ---------- pagina, Home, collegamenti con le altre pagine ---------- */
export function haCaldaia() { try { return trovaTutto().D.length > 0; } catch { return false; } }
const accesa = () => LAYOUT.pages?.caldaia !== false && utenteCfg().pages?.caldaia !== false;
/** problemi da segnalare: errori, pressione fuori range, manutenzione scaduta o vicina */
function problemi() {
  const R = ruoli(), s = stato(R), M = manutenzione(R);
  return { s, M, err: s.err, press: s.P.k === "bassa" || s.P.k === "alta", manut: M.giorni != null && M.giorni <= 30, scaduta: (M.giorni != null && M.giorni < 0) || M.chiede };
}
function homeCard() {
  const R = ruoli(), { s, M, err, press, manut, scaduta } = problemi();
  const W = R.wh && S[R.wh] ? R.wh : null, acs = W && attr(W, "current_temperature") != null ? +attr(W, "current_temperature") : R.acsTemp ? val(R.acsTemp) : null;
  const titolo = !s.raggiungibile ? t("Non raggiungibile", "Unavailable") : s.fiamma ? (s.acs ? t("Fiamma accesa · acqua calda", "Flame on · hot water") : t("Fiamma accesa", "Flame on") + (s.conMod ? " · " + Math.round(s.mod) + "%" : "")) : s.fiamma === false ? t("Fiamma spenta", "Flame off") : t("Caldaia", "Boiler");
  const righe = [acs != null ? `🚿 ${fnum(acs, 0)}° ${t("acqua calda", "hot water")}` : "", s.P.p != null ? `⏲ ${fnum(s.P.p, 1)} bar` : "", R.mandata && val(R.mandata) != null && s.fiamma ? `↗ ${fnum(val(R.mandata), 0)}°` : ""].filter(Boolean);
  const tags = [...err.slice(0, 2).map(e => `<span class="tag bad">${e.allarme ? "🚨" : "⚠️"} ${esc(e.cod ? e.cod + (e.txt ? " · " + e.txt : "") : e.txt || t("errore", "error"))}</span>`),
    press ? `<span class="tag bad">⏲ ${s.P.k === "bassa" ? t("pressione bassa", "low pressure") : t("pressione alta", "high pressure")}</span>` : "",
    manut || M.chiede ? `<span class="tag ${scaduta ? "bad" : "warn"}">🔧 ${M.chiede && !manut ? t("chiede la manutenzione", "asks for a service") : t("manutenzione", "service") + " " + traGiorni(M.giorni)}</span>` : ""].filter(Boolean);
  return card("🔥 " + t("Caldaia", "Boiler"), `<button class="cd1hb ${err.length || press || !s.raggiungibile ? "bad" : s.fiamma ? "on" : ""}" data-act="go" data-id="caldaia">
      <span class="cd1hs">${scena(s, { cls: "xs", lcd: lcd(R, s) })}</span><div class="tx"><b>${titolo}</b><span>${righe.join(" · ")}</span></div><span class="st">›</span></button>
    ${tags.length ? `<div class="cd1ht">${tags.join("")}</div>` : `<div class="small muted" style="margin-top:8px">✅ ${t("Nessun allarme", "No alarms")}</div>`}`, { link: [t("Tutto", "All"), "caldaia"] });
}
HOME_EXTRA.caldaia = { title: () => t("Caldaia", "Boiler"), render: homeCard, show: () => haCaldaia() && accesa() };
/** promemoria negli Avvisi della Home: manutenzione vicina o scaduta (avvisi.js) */
VISTE.caldaiaAvvisi = () => {
  if (!haCaldaia() || !accesa()) return [];
  const { M, manut } = problemi(); if (!manut && !M.chiede) return [];
  return [{ k: "cd:manut:" + (M.data ? dataISO(M.data) : "chiede") + (M.giorni != null && M.giorni < 0 ? ":scaduta" : ""), ic: "🔧", b: t("Manutenzione della caldaia", "Boiler service"),
    s: M.data ? esc(dataTesto(M.data)) + " · " + traGiorni(M.giorni) : t("la caldaia la chiede", "the boiler is asking for it"), go: "caldaia", cls: M.giorni != null && M.giorni < 0 ? "alert" : "" }];
};
/* i circuiti della caldaia escono dalla pagina Clima (e dalle stanze) finché questa pagina è accesa; i termostati veri restano */
let circ = { t: 0, l: null, p: null, s: new Set() };
function circuiti() {
  const n = performance.now();
  if (n - circ.t > 1000 || circ.l !== LAYOUT.caldaia || circ.p !== LAYOUT.pages) {
    let s = new Set();
    try { if (accesa() && haCaldaia()) { const c = ruoli().circuito; s = new Set(trovaTutto().E.filter(x => x.startsWith("climate.") && !termostatoVero(x))); if (c) s.add(c); } } catch {}
    circ = { t: n, l: LAYOUT.caldaia, p: LAYOUT.pages, s };
  }
  return circ.s;
}
DEFAULT_OFF.push(id => id.startsWith("climate.") && circuiti().has(id));
/** nella pagina Clima (✏️) un pulsante per aggiungere la caldaia quando non la trovo da solo */
VISTE.caldaiaTrovata = haCaldaia;

page("caldaia", { title: t("Caldaia", "Boiler"), short: t("Caldaia", "Boiler"), icon: "🔥", order: 21, editable: true,
  show: () => haCaldaia() || (conf().extra || []).length > 0, badge: () => { try { const p = problemi(); return p.err.length > 0 || p.press || p.scaduta; } catch { return false; } }, render: pagina });

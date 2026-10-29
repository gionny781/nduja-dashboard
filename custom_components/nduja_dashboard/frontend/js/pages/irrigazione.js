/* Irrigazione: una tessera per ogni zona (nome, stato, avvio con la durata scelta, stop) con il prato o l'aiuola
   disegnati per 'Nduja (irrigatori che spruzzano, gocciolatori, terreno che si scurisce mentre si bagna); i programmi
   (prossima irrigazione), l'umidità del terreno e la pioggia prevista, con «Domani piove: vuoi saltare l'irrigazione?».
   Zone trovate da sole: valvole dell'acqua, switch con nomi da irrigazione, Rain Bird, Hydrawise, Rachio, b-hyve,
   OpenSprinkler, Gardena…; con ✏️ se ne aggiungono altre (switch, valvole, script).
   Durata: con il servizio dell'integrazione se c'è (rainbird.start_irrigation, hydrawise.start_watering, rachio.start_watering,
   bhyve.start_watering, opensprinkler.run_station); altrimenti accendo e lo script «'Nduja · irrigazione» chiude dopo i minuti scelti
   (più l'automazione di sicurezza che chiude quelle zone se Home Assistant si riavvia mentre irrigano).
   In Home la scheda «Irrigazione» (HOME_EXTRA); le zone escono dalla pagina Prese (VISTE.irrZone). */
import { S, REG, ACT, CHG, UI, LAYOUT, HOME_EXTRA, VISTE, t, esc, nm, nmHA, ok, attr, ents, allEnts, areaOf, AREAS, card, page, svc, svcResp, ws, api,
  sGet, sSet, toast, render, go, isAdmin, openSheet, closeSheet, cached, forecast, weatherEnt, WX, hhmm, LOC, deviceClass, domain, etichettaNduja } from "../core.js";
import { scegli, cambia } from "../edit.js";
import { casa, casaCambia } from "../casa.js";

/* ================= zone ================= */
/** integrazioni da irrigazione: le loro valvole e i loro switch sono zone (tranne programmi, ritardo pioggia…) */
const PIATT = ["rainbird", "hydrawise", "rachio", "bhyve", "opensprinkler", "gardena_smart_system", "rainmachine", "melnor", "linktap"];
const MARCHE = { rainbird: "Rain Bird", hydrawise: "Hydrawise", rachio: "Rachio", bhyve: "b-hyve", opensprinkler: "OpenSprinkler", gardena_smart_system: "Gardena",
  rainmachine: "RainMachine", melnor: "Melnor", linktap: "LinkTap", tuya: "Tuya", zha: "Zigbee", mqtt: "Zigbee2MQTT", shelly: "Shelly", esphome: "ESPHome" };
const NOME = /irrig|sprinkl|gocciol|\bdrip|annaff|watering|elettrovalvol|solenoid|water.?valve|valvol[ae].?(acqua|giardino|orto)|rubinett|(^|[^a-z])zon[ae]([^a-z]|$)/i;
/* non sono zone: programmi, ritardo pioggia, pompe e valvole principali; e le «zone» che sono luci, prese, clima… */
const NO_PROG = /rain.?delay|ritardo|standby|program|schedul|auto(matic)?.?water|smart.?water|controller|master|pomp|pump/i;
const NO_ALTRO = /luc[ei]|light|lamp|presa|plug|clima|riscald|heat|termo|caldaia|boiler|\bgas\b|\btv\b|allarm|alarm|zon[ae].?(giorno|notte|day|night)|(giorno|notte).?zon/i;
const NO_VALV = /principal|main|generale|perdita|leak|shut.?off|contatore|meter|\bgas\b/i;
const testo = id => id + " " + nmHA(id);
const fratelli = id => { const d = REG[id]?.device; return d ? Object.keys(S).filter(x => x !== id && REG[x]?.device === d) : []; };
function eZona(id) {
  const d = domain(id), p = REG[id]?.platform || "", s = testo(id);
  if (d !== "switch" && d !== "valve") return false;
  /* OpenSprinkler: le zone sono le stazioni (lo switch abilita la stazione; si avvia con run_station) */
  if (p === "opensprinkler") return d === "switch" && /station/i.test(id) && !/program/i.test(id);
  /* Hydrawise: la valvola della zona; lo switch «manuale» solo se la valvola non c'è */
  if (p === "hydrawise") return d === "valve" || (/manual/i.test(id) && !fratelli(id).some(x => x.startsWith("valve.")));
  if (PIATT.includes(p)) return !NO_PROG.test(s) && !/socket|power|plug|presa|luc[ei]|light|lamp/i.test(s);   // Gardena ha anche prese smart
  if (NO_PROG.test(s) || NO_ALTRO.test(s)) return false;
  if (d === "valve") return !NO_VALV.test(s) && (deviceClass(id) === "water" || NOME.test(s));
  return NOME.test(s);
}
const SCRIPT = "script.nduja_irrigazione";
let zc = null, zt = 0;
/** le zone della pagina: trovate da sole + aggiunte con ✏️, meno quelle tolte */
export function zone() {
  const n = performance.now(); if (zc && n - zt < 80) return zc;
  const I = LAYOUT.irrig || {}, tolte = new Set(I.tolte || []), mani = (I.zone || []).filter(id => S[id] && id !== SCRIPT);
  const auto = [...ents("switch"), ...ents("valve")].filter(id => !mani.includes(id) && eZona(id));
  const A = id => AREAS[areaOf(id)]?.name || "~";
  zc = [...auto, ...mani].filter(id => !tolte.has(id)).sort((a, b) => A(a).localeCompare(A(b), LOC) || nm(a).localeCompare(nm(b), LOC)); zt = n;
  return zc;
}
VISTE.irrZone = zone;
/** tutto quello che sta nella pagina Irrigazione o le appartiene (switch dei programmi e del ritardo pioggia delle integrazioni): esce dalla pagina Prese */
VISTE.irrTutte = () => [...zone(), ...Object.keys(S).filter(id => /^(switch|valve)\./.test(id) && PIATT.includes(REG[id]?.platform))];

/** nome dell'oggetto senza i suffissi delle integrazioni («prato_station_enabled» → «prato») */
const base = id => id.split(".")[1].replace(/_(zone|station_enabled|station|manual_watering|watering|valve|switch|enabled)$/, "");
/** tra le entità sorelle quella che passa il test; se sullo stesso dispositivo ci sono più zone, solo quella col nome della zona */
function sorella(id, test) {
  const F = fratelli(id), L = F.filter(test), b = base(id), molte = F.filter(x => eZona(x)).length > 0;
  return (molte ? L.find(x => x.includes(b)) : L.find(x => x.includes(b)) || L[0]) || Object.keys(S).find(x => x !== id && x.split(".")[1].startsWith(b + "_") && test(x)) || null;
}
/** contesto di una zona: integrazione, sensore «in funzione», tempo che manca, prossima partenza (rifatto a ogni disegno) */
const CX = new Map(); let cxT = 0;
function ctx(id) {
  const n = performance.now(); if (n - cxT > 80) { CX.clear(); cxT = n; }
  if (!CX.has(id)) CX.set(id, contesto(id));
  return CX.get(id);
}
function contesto(id) {
  const p = REG[id]?.platform || "", d = domain(id);
  const run = p === "opensprinkler" ? sorella(id, x => x.startsWith("binary_sensor.") && /running/i.test(x))
    : p === "hydrawise" ? sorella(id, x => x.startsWith("binary_sensor.") && (deviceClass(x) === "running" || /water|running|irrig/i.test(x)) && !/rain|cloud|api/i.test(x)) : null;
  const rest = d === "script" ? null : sorella(id, x => x.startsWith("sensor.") && /remaining|watering.?time|time.?left|rimanent|residu/i.test(testo(x)) && !/next|prossim/i.test(x));
  const prox = d === "script" ? null : sorella(id, x => x.startsWith("sensor.") && (deviceClass(x) === "timestamp" || /^\d{4}-\d\d-\d\dT/.test(S[x]?.state || "")) && /next|prossim/i.test(testo(x)));
  return { id, d, p, run, rest, prox };
}
const ACCESO = ["on", "open", "opening"];
function attiva(c) {
  if (c.run) return S[c.run]?.state === "on" || (c.d === "valve" && ACCESO.includes(S[c.id]?.state));
  if (c.p === "opensprinkler") return false;   // lo switch dice solo se la stazione è abilitata
  return ACCESO.includes(S[c.id]?.state);
}
const raggiungibile = c => ok(c.id) || (!!c.run && ok(c.run));
/** aspetto: irrigatore (prato) o gocciolatore (aiuola) */
const gocciaDaNome = id => /gocc|drip|aiuol|orto|vas[oi]|siepe|hedge|flower|fior|piant|plant/i.test(testo(id) + " " + nm(id));
const goccia = id => { const a = LAYOUT.irrig?.aspetto?.[id]; return a ? a === "goccia" : gocciaDaNome(id); };

/* ================= servizi delle integrazioni ================= */
const servizi = () => cached("services", 3600e3, () => ws({ type: "get_services" }));
async function serviziOra() { return servizi() || await ws({ type: "get_services" }).catch(() => ({})); }
const ha = (SV, d, s) => !!SV?.[d]?.[s];
/** il servizio dell'integrazione che avvia la zona per «min» minuti: [dominio, servizio, dati], null (uso il timer della plancia) o "no" */
function nativo(c, min, SV) {
  if (c.p === "rainbird" && c.d === "switch" && ha(SV, "rainbird", "start_irrigation")) return ["rainbird", "start_irrigation", { entity_id: c.id, duration: Math.min(min, 1440) }];
  if (c.p === "hydrawise" && c.run && ha(SV, "hydrawise", "start_watering")) return ["hydrawise", "start_watering", { entity_id: c.run, duration: min }];
  if (c.p === "rachio" && c.d === "switch" && ha(SV, "rachio", "start_watering")) return ["rachio", "start_watering", { entity_id: c.id, duration: Math.min(min, 180) }];
  if (c.p === "bhyve" && ha(SV, "bhyve", "start_watering")) return ["bhyve", "start_watering", { entity_id: c.id, minutes: min }];
  if (c.p === "opensprinkler") return ha(SV, "opensprinkler", "run_station") ? ["opensprinkler", "run_station", { entity_id: c.id, run_seconds: min * 60 }]
    : ha(SV, "opensprinkler", "run") ? ["opensprinkler", "run", { entity_id: c.id, run_seconds: min * 60 }] : "no";
  return null;
}
/** zone che usano il timer della plancia (script + sicurezza): switch, valvole e interruttori senza un servizio con la durata */
function generiche() {
  const SV = servizi(); if (!SV) return null;
  return zone().map(ctx).filter(c => ["switch", "valve", "input_boolean"].includes(c.d) && nativo(c, 10, SV) === null).map(c => c.id).sort();
}

/* ================= timer della plancia: script «'Nduja · irrigazione» e automazione di sicurezza ================= */
const ACCESA_T = "{% set s = expand(zona) | first %}{{ s is defined and s.state in ['on', 'open', 'opening'] and (now() - s.last_changed).total_seconds() >= (minuti | int(10)) * 60 - 45 }}";
const scriptCfg = () => ({
  alias: "'Nduja · " + t("irrigazione", "irrigation"), icon: "mdi:sprinkler-variant", mode: "parallel", max: 30,
  description: t("Creato da 'Nduja Dashboard (pagina Irrigazione): apre una zona e la chiude dopo i minuti scelti. Se nel frattempo la zona è stata chiusa e riaperta, non la tocca.",
    "Created by 'Nduja Dashboard (Irrigation page): opens a zone and closes it after the chosen minutes. If the zone was closed and reopened meanwhile, it leaves it alone."),
  fields: {
    zona: { name: t("Zona", "Zone"), required: true, selector: { entity: { domain: ["switch", "valve", "input_boolean"] } } },
    minuti: { name: t("Minuti", "Minutes"), required: true, default: 10, selector: { number: { min: 1, max: 240, unit_of_measurement: "min" } } },
  },
  sequence: [
    { if: [{ condition: "template", value_template: "{{ zona.startswith('valve.') }}" }], then: [{ action: "valve.open_valve", target: { entity_id: "{{ zona }}" } }],
      else: [{ action: "homeassistant.turn_on", target: { entity_id: "{{ zona }}" } }] },
    { delay: { minutes: "{{ minuti | int(10) }}" } },
    { condition: "template", value_template: ACCESA_T },
    { if: [{ condition: "template", value_template: "{{ zona.startswith('valve.') }}" }], then: [{ action: "valve.close_valve", target: { entity_id: "{{ zona }}" } }],
      else: [{ action: "homeassistant.turn_off", target: { entity_id: "{{ zona }}" } }] },
  ],
});
function sicurezzaCfg(G) {
  const vl = G.filter(id => id.startsWith("valve.")), sw = G.filter(id => !id.startsWith("valve."));
  return { id: "nduja_irrigazione", alias: "'Nduja · " + t("irrigazione (sicurezza)", "irrigation (safety)"), mode: "single",
    description: t("Creata da 'Nduja Dashboard (pagina Irrigazione): se Home Assistant si riavvia mentre una zona irriga con il timer della plancia, il timer si perde; all'avvio chiudo queste zone.",
      "Created by 'Nduja Dashboard (Irrigation page): if Home Assistant restarts while a zone is watering with the dashboard timer, the timer is lost; on startup I close these zones."),
    triggers: [{ trigger: "homeassistant", event: "start" }], conditions: [],
    actions: [{ delay: { seconds: 45 } },
      ...(sw.length ? [{ action: "homeassistant.turn_off", target: { entity_id: sw }, continue_on_error: true }] : []),
      ...(vl.length ? [{ action: "valve.close_valve", target: { entity_id: vl }, continue_on_error: true }] : [])] };
}
const automazioneSicurezza = () => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === "nduja_irrigazione") || null;
/** il timer va creato (o aggiornato perché le zone sono cambiate)? solo per gli amministratori */
function timerDaPreparare() {
  const G = generiche(); if (!G || !G.length) return null;
  if (!S[SCRIPT] || !automazioneSicurezza()) return "crea";
  return JSON.stringify([...(LAYOUT.irrig?.timer || [])].sort()) === JSON.stringify(G) ? null : "aggiorna";
}
let preparando = false;
async function preparaTimer() {
  if (preparando) return false; preparando = true;
  try {
    const G = generiche() || [], nuovoS = !S[SCRIPT], nuovaA = !automazioneSicurezza();
    await api("POST", "/api/config/script/config/nduja_irrigazione", scriptCfg());
    await api("POST", "/api/config/automation/config/nduja_irrigazione", sicurezzaCfg(G));
    if (nuovoS) etichettaNduja(() => S[SCRIPT] ? SCRIPT : null);   // etichetta «'Nduja»
    if (nuovaA) etichettaNduja(automazioneSicurezza);
    await cambia(l => { l.irrig = { ...(l.irrig || {}), timer: G }; });
    for (let i = 0; i < 24 && !S[SCRIPT]; i++) await new Promise(r => setTimeout(r, 500));   // Home Assistant ricarica gli script
    return !!S[SCRIPT];
  } catch (e) { toast(t("Timer non creato: ", "Timer not created: ") + (e.message || e), true); return false; }
  finally { preparando = false; render(); }
}

/* ================= tempi: dati della casa (sezione «irrigazione»), uguali su tutti i dispositivi ================= */
/* { avvii: { zona: { da, fine, min, stop? } }, pausa: { fino, fatti: [{ id, via }] } } */
const dati = () => casa("irrigazione")?.dati || {};
const rec = id => dati().avvii?.[id] || null;
const pulisci = A => Object.fromEntries(Object.entries(A || {}).filter(([, r]) => Date.now() - new Date(r.fine).getTime() < 864e5));
const quandoAcceso = c => new Date(S[c.run && S[c.run]?.state === "on" ? c.run : c.id]?.last_changed || Date.now()).getTime();
/** { da, fine, tot }: fine e tot solo se li so (sensore dell'integrazione o avvio dalla plancia) */
function tempo(c) {
  const now = Date.now(), da = quandoAcceso(c);
  if (c.rest && ok(c.rest)) {
    const v = parseFloat(S[c.rest].state), u = String(attr(c.rest, "unit_of_measurement") || "min").toLowerCase();
    if (v > 0) { const fine = now + v * (u.startsWith("s") ? 1e3 : u.startsWith("h") ? 36e5 : 6e4); return { da, fine, tot: fine - da }; }
  }
  const r = rec(c.id);
  if (r && !r.stop) { const rf = new Date(r.fine).getTime(), rd = new Date(r.da).getTime(); if (rf > now && da <= rd + 120e3) return { da: rd, fine: rf, tot: rf - rd }; }
  return { da, fine: null, tot: null };
}
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
/** quanto è bagnato il terreno (0…1): cresce mentre irriga, poi si asciuga in due ore */
function bagnato(c) {
  const now = Date.now();
  if (attiva(c)) { const T = tempo(c); return T.tot ? lim(.2 + .8 * (1 - (T.fine - now) / T.tot), .2, 1) : lim(.2 + .8 * (now - T.da) / 9e5, .2, 1); }
  const r = rec(c.id); if (!r) return 0;
  const rd = new Date(r.da).getTime(), off = quandoAcceso(c);
  const fine = Math.min(new Date(r.fine).getTime(), r.stop ? new Date(r.stop).getTime() : Infinity, off > rd ? off : Infinity);
  if (!isFinite(fine) || fine > now || fine < rd) return 0;
  const pieno = lim(.2 + .8 * (fine - rd) / (r.min * 6e4), .2, 1), dopo = (now - fine) / 72e5;
  return dopo >= 1 ? 0 : pieno * (1 - dopo);
}
const durTxt = ms => { const m = Math.max(1, Math.ceil(ms / 6e4)); return m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + String(m % 60).padStart(2, "0") + " min" : ""); };
const giorno0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
function quando(d) {
  const g = Math.round((giorno0(d) - giorno0(Date.now())) / 864e5);
  return (g === 0 ? t("oggi ", "today ") : g === 1 ? t("domani ", "tomorrow ") : new Date(d).toLocaleDateString(LOC, { weekday: "short", day: "numeric" }) + " ") + hhmm(d);
}
/** prossima partenza di una zona, se l'integrazione la espone */
function prossima(c) {
  const v = [c.prox && ok(c.prox) ? S[c.prox].state : null, ...["next_start_time", "next_cycle", "next_run", "next_watering", "next_start"].map(k => attr(c.id, k))]
    .map(x => x ? new Date(x) : null).find(d => d && !isNaN(d) && d > Date.now());
  return v || null;
}
function statoZ(c) {
  const now = Date.now();
  if (!raggiungibile(c)) return { k: "un", n: t("Non raggiungibile", "Unavailable") };
  if (attiva(c)) { const T = tempo(c); return { k: "on", T, n: T.fine ? t("Irriga · mancano ", "Watering · ") + durTxt(T.fine - now) + t("", " left") : t("Irriga da ", "Watering for ") + durTxt(now - T.da) }; }
  const P = prossima(c); if (P) return { k: "prog", n: t("Programmata · ", "Scheduled · ") + quando(P), P };
  if (c.p === "opensprinkler" && S[c.id]?.state === "off") return { k: "off", n: t("Stazione disattivata in OpenSprinkler", "Station disabled in OpenSprinkler") };
  return { k: "off", n: t("Spenta", "Off") };
}

/* ================= disegni: prato con irrigatore, aiuola con gocciolatore (SVG + CSS, nduja.css «irrigazione») ================= */
const ERBA = "M6 78l1.6-6 1.8 6M15 82l1.2-5 1.6 5M24 76l1.8-6.5 1.6 6.5M38 84l1.4-5 1.4 5M47 77l1.6-6 1.8 6M110 77l1.6-6 1.8 6M121 84l1.4-5 1.4 5M132 76l1.8-6.5 1.6 6.5M143 82l1.2-5 1.6 5M152 78l1.6-6 1.8 6M62 90l1.4-5 1.4 5M97 90l1.4-5 1.4 5";
function prato(k) {
  return `<svg viewBox="0 20 160 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${k}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="p1"/><stop offset="1" class="p2"/></linearGradient></defs>
    <path class="colle" d="M0 58Q30 44 66 52T128 47Q146 45 160 50V100H0Z"/><path class="cespi" d="M14 56a7 5 0 0 1 14 0ZM120 50a9 6 0 0 1 18 0ZM134 51a6 4 0 0 1 12 0Z"/>
    <path class="suolo" d="M0 66Q80 52 160 66V100H0Z" fill="url(#${k}p)"/><path class="umido" d="M0 66Q80 52 160 66V100H0Z"/>
    <ellipse class="lucido" cx="80" cy="82" rx="58" ry="9"/>
    <path class="erba" d="${ERBA}"/>
    <g class="getto"><path class="velo" d="M80 58Q57 18 30 70M80 58Q103 18 130 70"/><path class="arco a0" d="M80 58Q57 18 30 70"/><path class="arco a1" d="M80 58Q68 28 50 74"/><path class="arco a2" d="M80 58Q92 28 110 74"/><path class="arco a3" d="M80 58Q103 18 130 70"/>
      <g class="nebbia"><circle cx="30" cy="70" r="3.2"/><circle cx="50" cy="74" r="2.6"/><circle cx="110" cy="74" r="2.6"/><circle cx="130" cy="70" r="3.2"/></g></g>
    <g class="testa"><rect class="ugello" x="77" y="55" width="6" height="9" rx="2"/><circle class="foro" cx="80" cy="57.5" r="1.1"/></g>
    <path class="corpo" d="M74 63h12l-1 6.5H75Z"/><ellipse class="buco" cx="80" cy="69.5" rx="8" ry="2.2"/>
    <path class="erba" d="M68 72l1.4-5 1.6 5M88 72l1.4-5 1.6 5"/></svg>`;
}
/* gocciolatori sull'ala: punti della curva M6 72 Q80 58 154 72 a t = 0,2 · 0,5 · 0,8 */
const GOCCE = [[35.6, 67.5], [80, 65], [124.4, 67.5]];
function aiuola(k) {
  const pianta = (x, y, s, fiore) => `<g class="pianta" transform="translate(${x} ${y}) scale(${s})"><path class="stelo" d="M0 0V-14"/><path class="foglia" d="M0-5C-7-6-9-12-9-12C-3-12 0-9 0-5ZM0-9C6-10 8-16 8-16C3-16 0-13 0-9Z"/>
    ${fiore ? `<g class="fiore"><circle cx="0" cy="-17" r="3.3"/><circle cx="-3.4" cy="-14.6" r="3"/><circle cx="3.4" cy="-14.6" r="3"/><circle cx="-2.2" cy="-11" r="2.7"/><circle cx="2.2" cy="-11" r="2.7"/><circle class="cuore" cx="0" cy="-14" r="2"/></g>` : ""}</g>`;
  return `<svg viewBox="0 20 160 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${k}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="t1"/><stop offset="1" class="t2"/></linearGradient><radialGradient id="${k}m"><stop offset="0" class="m1"/><stop offset=".55" class="m1"/><stop offset="1" class="m2"/></radialGradient></defs>
    <path class="colle" d="M0 56Q40 44 84 50T160 46V100H0Z"/><path class="prato2" d="M0 70Q80 60 160 70V100H0Z"/>
    <path class="bordo" d="M2 74Q80 52 158 74L154 92Q80 102 6 92Z"/>
    <path class="terra" d="M8 72Q80 56 152 72L148 88Q80 97 12 88Z" fill="url(#${k}t)"/><path class="umido" d="M8 72Q80 56 152 72L148 88Q80 97 12 88Z"/>
    ${GOCCE.map(([x, y], i) => `<ellipse class="macchia m${i}" cx="${x}" cy="${y + 9}" rx="15" ry="4.8" fill="url(#${k}m)"/>`).join("")}
    ${pianta(58, 68, 1.25, true)}${pianta(103, 68, 1.1, false)}${pianta(18, 76, .7, false)}${pianta(143, 76, .75, true)}
    <path class="tubo" d="M6 72Q80 58 154 72"/>
    ${GOCCE.map(([x, y], i) => `<g class="gc g${i}"><circle class="ugello" cx="${x}" cy="${y}" r="2"/><path class="goccia" d="M${x} ${y + 2.6}c-1.3 1.8-1.9 2.9-1.9 3.7a1.9 1.9 0 0 0 3.8 0c0-.8-.6-1.9-1.9-3.7z"/><ellipse class="onda" cx="${x}" cy="${y + 9}" rx="5" ry="1.6"/></g>`).join("")}
  </svg>`;
}
/** la zona disegnata; key distingue i disegni nella stessa pagina; cls: "", "sm", "xs" */
function scena(c, key, cls = "") {
  const on = attiva(c);
  return `<div class="ir1s ${goccia(c.id) ? "gc1" : "sp1"} ${on ? "on" : ""} ${raggiungibile(c) ? "" : "un"} ${cls}" style="--wet:${bagnato(c).toFixed(2)}">${goccia(c.id) ? aiuola(key) : prato(key)}</div>`;
}

/* ================= avvio e stop ================= */
const DUR = [5, 10, 15, 30];
const durata = id => lim(+sGet("ir_dur_" + id) || 10, 1, 240);
async function avvia(id, min) {
  const c = ctx(id); min = lim(Math.round(min), 1, 240);
  try {
    if (c.d === "script") await svc("script", "turn_on", { variables: { minuti: min, durata: min } }, { entity_id: id });
    else {
      const n = nativo(c, min, await serviziOra());
      if (n === "no") return toast(t("OpenSprinkler: aggiorna l'integrazione, manca il servizio per avviare una stazione.", "OpenSprinkler: update the integration, the service to run a station is missing."), true);
      if (n) await svc(n[0], n[1], n[2]);
      else {
        if (!S[SCRIPT]) {
          if (!isAdmin()) return toast(t("Serve lo script «'Nduja · irrigazione»: chiedi a un amministratore di aprire la pagina Irrigazione.", "The «'Nduja · irrigation» script is needed: ask an administrator to open the Irrigation page."), true);
          toast("⏱ " + t("Preparo il timer in Home Assistant…", "Setting up the timer in Home Assistant…"));
          if (!await preparaTimer()) return;
        }
        await svc("script", "turn_on", { variables: { zona: id, minuti: min } }, { entity_id: SCRIPT });
      }
    }
  } catch { return; }   // svc ha già detto cosa non va
  toast("💧 " + nm(id) + " · " + durTxt(min * 6e4));
  const da = Date.now();
  casaCambia("irrigazione", d => { d.avvii = pulisci(d.avvii); d.avvii[id] = { da: new Date(da).toISOString(), fine: new Date(da + min * 6e4).toISOString(), min }; });
}
async function ferma(id) {
  const c = ctx(id), SV = await serviziOra();
  try {
    if (c.p === "opensprinkler") await svc("opensprinkler", "stop", { entity_id: id });
    else if (c.p === "bhyve" && ha(SV, "bhyve", "stop_watering")) await svc("bhyve", "stop_watering", { entity_id: id });
    else if (c.d === "valve") await svc("valve", "close_valve", {}, { entity_id: id });
    else await svc(c.d === "script" ? "script" : c.d === "input_boolean" ? "input_boolean" : "switch", "turn_off", {}, { entity_id: id });
  } catch { return; }
  toast("■ " + nm(id));
  if (rec(id)) casaCambia("irrigazione", d => { if (d.avvii?.[id]) d.avvii[id].stop = new Date().toISOString(); });
}

/* ================= meteo, programmi, pausa ================= */
const PIOGGIA = ["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"];
const domani = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };
/** previsione di domani se piove: { f, pr, mm } */
function pioggiaDomani() {
  const w = weatherEnt(); if (!w) return null;
  const k = domani().toDateString(), f = (forecast(w, "daily") || []).find(x => new Date(x.datetime).toDateString() === k);
  if (!f) return null;
  const pr = f.precipitation_probability, mm = f.precipitation;
  return PIOGGIA.includes(f.condition) || pr >= 60 || mm >= 2 ? { f, pr, mm } : null;
}
const AUTO_IRR = /irrig|annaff|sprinkl|gocciol|watering/i, RD = /rain.?delay|ritardo.?pioggia|pausa.?pioggia/i;
/** cosa si può mettere in pausa: automazioni dell'irrigazione, ritardo pioggia (numero o switch), OpenSprinkler, Hydrawise, switch scelti con ✏️ */
function pausabili() {
  const I = LAYOUT.irrig || {}, extra = I.pausa || [], no = I.noPausa || [], SV = servizi(), L = [];
  const zr = new Set(zone().map(z => ctx(z).run).filter(Boolean));
  for (const id of Object.keys(S)) {
    const d = domain(id), p = REG[id]?.platform || "", s = testo(id);
    if (d === "automation") { if (S[id].state === "on" && attr(id, "id") !== "nduja_irrigazione" && (extra.includes(id) || (AUTO_IRR.test(s) && !no.includes(id)))) L.push({ id, via: "auto" }); }
    else if (no.includes(id)) continue;
    else if (d === "number" && RD.test(s)) L.push({ id, via: "giorni" });
    else if (d === "switch" && RD.test(s)) L.push({ id, via: p === "bhyve" && ha(SV, "bhyve", "enable_rain_delay") ? "bhyve" : "rd" });
    else if (d === "switch" && p === "opensprinkler" && !/station|program/i.test(id) && ha(SV, "opensprinkler", "set_rain_delay")) L.push({ id, via: "os" });
    else if (d === "binary_sensor" && zr.has(id) && p === "hydrawise" && ha(SV, "hydrawise", "suspend")) L.push({ id, via: "hw" });
    else if (extra.includes(id) && (d === "switch" || d === "input_boolean") && S[id].state === "on") L.push({ id, via: "spegni" });
  }
  return L;
}
const VIA = () => ({ auto: t("automazione: Home Assistant la riaccende da solo", "automation: Home Assistant turns it back on by itself"), giorni: t("finisce da solo", "ends by itself"),
  bhyve: t("finisce da solo", "ends by itself"), rd: t("di solito dura 24 ore", "usually lasts 24 hours"), os: t("finisce da solo", "ends by itself"),
  hw: t("Hydrawise riprende da solo", "Hydrawise resumes by itself"), spegni: t("lo spengo: si riaccende con «Riprendi»", "turned off: it comes back with «Resume»") });
/** nome di una cosa in pausa: la zona per Hydrawise, l'integrazione per i ritardi pioggia */
function nomeP(x) {
  if (x.via === "hw") { const z = zone().find(id => ctx(id).run === x.id); return z ? nm(z) : nm(x.id); }
  if (["giorni", "rd", "bhyve", "os"].includes(x.via)) { const m = MARCHE[REG[x.id]?.platform]; return m ? m + " · " + t("ritardo pioggia", "rain delay") : nm(x.id); }
  return nm(x.id);
}
const fineDomani = () => { const d = domani(); d.setHours(23, 59, 0, 0); return d; };
const dataHA = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
async function sospendi(x, fino) {
  const ms = fino - Date.now(), ore = Math.ceil(ms / 36e5);
  if (x.via === "auto") return ws({ type: "nduja_dashboard/pausa", entity_id: x.id, minuti: Math.max(1, Math.ceil(ms / 6e4)) });
  if (x.via === "giorni") { const h = /^h/i.test(attr(x.id, "unit_of_measurement") || ""), v = h ? ore : Math.ceil(ms / 864e5), mx = attr(x.id, "max");
    return svc("number", "set_value", { value: mx != null ? Math.min(v, mx) : v }, { entity_id: x.id }); }
  if (x.via === "bhyve") return svc("bhyve", "enable_rain_delay", { entity_id: x.id, hours: ore });
  if (x.via === "rd") return svc("switch", "turn_on", {}, { entity_id: x.id });
  if (x.via === "os") return svc("opensprinkler", "set_rain_delay", { entity_id: x.id, rain_delay: ore });
  if (x.via === "hw") return svc("hydrawise", "suspend", { entity_id: x.id, until: dataHA(fino) });
  if (x.via === "spegni") return svc(domain(x.id), "turn_off", {}, { entity_id: x.id });
}
async function riprendi(x) {
  if (x.via === "auto") return ws({ type: "nduja_dashboard/pausa", entity_id: x.id, minuti: 0 });
  if (x.via === "giorni") return svc("number", "set_value", { value: attr(x.id, "min") ?? 0 }, { entity_id: x.id });
  if (x.via === "bhyve") return svc("bhyve", "disable_rain_delay", { entity_id: x.id });
  if (x.via === "rd") return svc("switch", "turn_off", {}, { entity_id: x.id });
  if (x.via === "os") return svc("opensprinkler", "set_rain_delay", { entity_id: x.id, rain_delay: 0 });
  if (x.via === "hw") return svc("hydrawise", "resume", { entity_id: x.id });
  if (x.via === "spegni") return svc(domain(x.id), "turn_on", {}, { entity_id: x.id });
}
const pausa = () => { const p = dati().pausa; return p && new Date(p.fino) > Date.now() ? p : null; };
/** switch spenti da una pausa già finita: restano spenti finché qualcuno non li riaccende */
const ancoraSpenti = () => { const p = dati().pausa; return p && !pausa() ? (p.fatti || []).filter(x => x.via === "spegni" && S[x.id]?.state === "off") : []; };
let lavoro = false;
async function mettiInPausa() {
  if (lavoro) return; lavoro = true; render();
  const fino = fineDomani(), L = pausabili(), fatti = [];
  try {
    for (const x of L) { try { await sospendi(x, fino); fatti.push({ id: x.id, via: x.via }); } catch (e) { if (x.via === "auto") toast(nm(x.id) + ": " + (e.message || e.code || e), true); } }
    if (!fatti.length) return;
    await casaCambia("irrigazione", d => { d.pausa = { fino: fino.toISOString(), fatti, da: new Date().toISOString() }; });
    toast("⏸ " + t("Irrigazione in pausa fino a ", "Irrigation paused until ") + quando(fino));
  } finally { lavoro = false; render(); }
}
async function togliPausa() {
  if (lavoro) return; lavoro = true; render();
  const p = dati().pausa || { fatti: [] };
  try {
    for (const x of p.fatti || []) { if (!S[x.id]) continue; if (x.via === "spegni" && S[x.id].state === "on") continue; try { await riprendi(x); } catch { /* svc l'ha già detto */ } }
    await casaCambia("irrigazione", d => { delete d.pausa; });
    toast("▶ " + t("Programmi ripresi", "Schedules resumed"));
  } finally { lavoro = false; render(); }
}
/** calendari dei programmi (Rain Bird, Rachio…): prossimi eventi della settimana */
const calendari = () => allEnts("calendar", id => PIATT.includes(REG[id]?.platform) || /irrig|sprinkl|annaff|watering|gocciol/i.test(testo(id)));
function eventi() {
  const C = calendari(); if (!C.length) return [];
  return cached("ir:cal:" + C.join(","), 15 * 6e4, async () => {
    const r = await svcResp("calendar", "get_events", { start_date_time: new Date().toISOString(), end_date_time: new Date(Date.now() + 7 * 864e5).toISOString() }, C);
    return C.flatMap(cid => (r?.[cid]?.events || []).map(e => ({ cal: cid, titolo: e.summary || nm(cid), da: new Date(e.start) }))).filter(e => !isNaN(e.da) && e.da > Date.now()).sort((a, b) => a.da - b.da);
  }) || [];
}
/** le prossime partenze: zone e calendari, in ordine di tempo */
function prossime() {
  const Z = zone().map(ctx).map(c => ({ id: c.id, titolo: nm(c.id), da: prossima(c) })).filter(x => x.da);
  return [...Z, ...eventi().map(e => ({ cal: e.cal, titolo: e.titolo, da: e.da }))].sort((a, b) => a.da - b.da);
}
/** sensori di umidità del terreno */
const terreno = () => ents("sensor", id => (deviceClass(id) === "moisture" || /terreno|soil|suolo/i.test(testo(id))) && unitaPct(id) && !/batter|aria|air|room|stanza/i.test(testo(id)) && ok(id));
const unitaPct = id => (attr(id, "unit_of_measurement") || "%") === "%";

/* ================= pagina ================= */
function tessera(id, i) {
  const c = ctx(id), st = statoZ(c), on = st.k === "on", un = st.k === "un", d = durata(id), now = Date.now();
  const marca = MARCHE[c.p] || (c.d === "script" ? "Script" : "");
  const pr = on && st.T?.tot ? lim(1 - (st.T.fine - now) / st.T.tot, 0, 1) : null;
  return `<section class="card ir1z ${st.k}">
    <div class="ir1h"><div class="ir1n"><b>${esc(nm(id))}</b><small>${esc([AREAS[areaOf(id)]?.name, goccia(id) ? t("a goccia", "drip") : t("irrigatore", "sprinkler"), marca].filter(Boolean).join(" · "))}</small></div>
      ${UI.edit && isAdmin() ? `<button class="btn sm" data-act="irEd" data-id="${id}" aria-label="${t("Modifica", "Edit")}">✏️</button>` : ""}</div>
    <div class="ir1sw">${scena(c, "z" + i)}<span class="ir1st ${st.k}">${on ? "💧 " : st.k === "prog" ? "🗓 " : ""}${esc(st.n)}</span></div>
    ${pr != null ? `<div class="ir1pr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pr * 100)}"><i style="width:${(pr * 100).toFixed(1)}%"></i></div>` : ""}
    <div class="ir1c">${on ? `<span class="ir1fn">${st.T?.fine ? t("fino alle ", "until ") + hhmm(st.T.fine) : t("dalle ", "since ") + hhmm(st.T.da)}</span>
        <button class="btn bad ir1go" data-act="irStop" data-id="${id}">■ ${t("Ferma", "Stop")}</button>`
      : `<div class="seg ir1d" role="group" aria-label="${t("Durata", "Duration")}">${DUR.map(m => `<button class="${d === m ? "act" : ""}" data-act="irDur" data-id="${id}" data-v="${m}" aria-pressed="${d === m}">${m}′</button>`).join("")}
        <button class="${DUR.includes(d) ? "" : "act"}" data-act="irAltro" data-id="${id}" aria-label="${t("Altra durata", "Other duration")}">${DUR.includes(d) ? "⋯" : d + "′"}</button></div>
        <button class="btn pri ir1go" data-act="irGo" data-id="${id}" ${un ? "disabled" : ""}>▶ ${t("Avvia", "Start")}</button>`}</div>
    ${c.d === "script" && !on ? `<div class="small muted ir1nt">${t("Lo script riceve i minuti nella variabile «minuti».", "The script gets the minutes in the «minuti» variable.")}</div>` : ""}
  </section>`;
}
/** avviso in alto: pioggia domani, pausa in corso, switch ancora spenti */
function avviso() {
  const p = pausa(), sp = ancoraSpenti(), pd = pioggiaDomani(), L = pausabili();
  if (p) return card("", `<div class="ir1a"><span class="ir1ai">⏸</span><div class="tx"><b>${t("Irrigazione in pausa fino a ", "Irrigation paused until ")}${esc(quando(new Date(p.fino)))}</b>
      <span>${(p.fatti || []).map(x => esc(nomeP(x)) + " · " + esc(VIA()[x.via] || "")).join("<br>")}</span></div>
      <button class="btn" data-act="irRiprendi" ${lavoro ? "disabled" : ""}>▶ ${t("Riprendi", "Resume")}</button></div>`, { cls: "span3 ir1av pz" });
  if (sp.length) return card("", `<div class="ir1a"><span class="ir1ai">⚠️</span><div class="tx"><b>${t("La pausa è finita, ma questi programmi sono ancora spenti", "The pause is over, but these schedules are still off")}</b>
      <span>${sp.map(x => esc(nm(x.id))).join(", ")}</span></div><button class="btn pri" data-act="irRiprendi" ${lavoro ? "disabled" : ""}>▶ ${t("Riaccendi", "Turn back on")}</button></div>`, { cls: "span3 ir1av" });
  if (!pd || sGet("ir_nopioggia") === domani().toDateString()) return "";
  const ic = (WX()[pd.f.condition] || ["🌧️"])[0], det = [pd.pr != null ? pd.pr + "%" : "", pd.mm ? String(pd.mm).replace(".", t(",", ".")) + " mm" : ""].filter(Boolean).join(" · ");
  return card("", `<div class="ir1a"><span class="ir1ai">${ic}</span><div class="tx"><b>${t("Domani piove: vuoi saltare l'irrigazione?", "Rain tomorrow: skip watering?")}</b>
      <span>${det ? esc(det) + " · " : ""}${L.length ? t("Metto in pausa i programmi fino a domani sera: ", "I'll pause the schedules until tomorrow night: ") + L.map(x => esc(nomeP(x))).join(", ")
        : isAdmin() ? t("Non trovo programmi da mettere in pausa: se irrighi con un'automazione, aggiungila con ✏️ Modifica.", "No schedules to pause found: if you water with an automation, add it with ✏️ Edit.")
        : t("Non trovo programmi da mettere in pausa.", "No schedules to pause found.")}</span></div>
      <div class="ir1ab">${L.length ? `<button class="btn pri" data-act="irPausa" ${lavoro ? "disabled" : ""}>⏸ ${t("Sì, salta", "Yes, skip")}</button>` : ""}<button class="btn" data-act="irNoPioggia">${L.length ? t("No, irriga", "No, water") : t("Ok", "OK")}</button></div></div>`, { cls: "span3 ir1av" });
}
/** solo per gli amministratori: il timer della plancia va creato o aggiornato */
function avvisoTimer() {
  const k = isAdmin() ? timerDaPreparare() : null; if (!k) return "";
  const G = generiche();
  return card("", `<div class="ir1a"><span class="ir1ai">⏱</span><div class="tx"><b>${k === "crea" ? t("Prepara il timer dell'irrigazione", "Set up the irrigation timer") : t("Le zone sono cambiate: aggiorna il timer", "Zones changed: update the timer")}</b>
      <span>${t("Creo in Home Assistant lo script «'Nduja · irrigazione», che chiude la zona dopo i minuti scelti anche a plancia chiusa, e un'automazione che, se Home Assistant si riavvia durante un'irrigazione, chiude per sicurezza: ", "I create the «'Nduja · irrigation» script in Home Assistant, which closes the zone after the chosen minutes even with the dashboard closed, and an automation that, if Home Assistant restarts while watering, closes for safety: ")}${G.map(id => esc(nm(id))).join(", ")}.</span></div>
      <button class="btn pri" data-act="irTimer" ${preparando ? "disabled" : ""}>${k === "crea" ? "＋ " + t("Crea", "Create") : "↻ " + t("Aggiorna", "Update")}</button></div>`, { cls: "span3 ir1av" });
}
function programmi() {
  const P = prossime().slice(0, 5), w = weatherEnt(), F = w ? (forecast(w, "daily") || []).slice(0, 5) : [], U = terreno(), L = pausabili(), pz = pausa();
  const col = (tit, corpo) => `<div class="ir1col"><div class="mu1l">${tit}</div>${corpo}</div>`;
  const prog = P.length ? `<div class="stack">${P.map(x => `<div class="li ir1pl"><span class="ic">🗓</span><div class="tx"><b>${esc(quando(x.da))}</b><span>${esc(x.titolo)}</span></div></div>`).join("")}</div>`
    : `<div class="small muted">${t("Nessuna partenza programmata che conosco: le integrazioni che la espongono (Hydrawise, b-hyve, Rain Bird con il calendario…) la mostrano qui.", "No scheduled start I know of: integrations that expose it (Hydrawise, b-hyve, Rain Bird with its calendar…) show it here.")}</div>`;
  const meteo = F.length ? `<div class="ir1fc">${F.map(d => { const wet = PIOGGIA.includes(d.condition) || d.precipitation_probability >= 60;
      return `<div class="${wet ? "wet" : ""}"><small>${esc(new Date(d.datetime).toLocaleDateString(LOC, { weekday: "short" }))}</small><span>${(WX()[d.condition] || ["·"])[0]}</span><b>${d.precipitation_probability != null ? d.precipitation_probability + "%" : d.precipitation != null ? d.precipitation + " mm" : "—"}</b></div>`; }).join("")}</div>`
    : `<div class="small muted">${w ? t("Previsioni in arrivo…", "Forecast loading…") : t("Nessun meteo in Home Assistant.", "No weather in Home Assistant.")}</div>`;
  const umid = U.length ? `<div class="stack">${U.map(id => { const v = +S[id].state, k = v < 25 ? "secco" : v > 60 ? "zuppo" : "ok";
      return `<button class="ir1u ${k}" data-act="more" data-id="${id}"><span class="tx"><b>${esc(nm(id))}</b><small>${k === "secco" ? t("secco", "dry") : k === "zuppo" ? t("bagnato", "wet") : t("giusto", "fine")}</small></span><span class="ir1ub"><i style="width:${lim(v, 0, 100)}%"></i></span><em>${Math.round(v)}%</em></button>`; }).join("")}</div>`
    : `<div class="small muted">${t("Nessun sensore di umidità del terreno.", "No soil moisture sensor.")}</div>`;
  const pulsante = !pz && L.length ? `<div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="irPausa" ${lavoro ? "disabled" : ""}>⏸ ${t("Salta l'irrigazione fino a domani sera", "Skip watering until tomorrow night")}</button></div>` : "";
  return card("📅 " + t("Programmi e meteo", "Schedules and weather"), `<div class="ir1pm">${col(t("Prossime irrigazioni", "Next waterings"), prog + pulsante)}${col(t("Pioggia prevista", "Expected rain"), meteo)}${col(t("Umidità del terreno", "Soil moisture"), umid)}</div>`, { cls: "span3" });
}
/** ✏️: zone aggiunte e tolte, programmi da sospendere, timer */
function modifica() {
  if (!UI.edit || !isAdmin()) return "";
  const I = LAYOUT.irrig || {}, tolte = (I.tolte || []).filter(id => S[id]), L = pausabili(), extra = (I.pausa || []).filter(id => S[id] && !L.some(x => x.id === id)), no = (I.noPausa || []).filter(id => S[id]);
  const riga = (id, sotto, btn, nome = nm(id)) => `<div class="li"><div class="tx"><b>${esc(nome)}</b><span>${esc(sotto)}</span></div>${btn}</div>`;
  const G = generiche() || [];
  return card("✏️ " + t("Zone e programmi", "Zones and schedules"), `<div class="ir1pm">
    <div class="ir1col"><div class="mu1l">${t("Zone", "Zones")}</div><div class="stack">
      <button class="add1" data-act="irAdd"><span>＋</span>${t("Aggiungi zona (switch, valvola o script)", "Add zone (switch, valve or script)")}</button>
      ${tolte.map(id => riga(id, t("tolta dalla pagina", "removed from the page"), `<button class="btn sm" data-act="irRimetti" data-id="${id}">↺ ${t("Rimetti", "Restore")}</button>`)).join("")}</div>
      <p class="small muted" style="margin-top:10px">${t("Tocca ✏️ su una zona per cambiarle nome e aspetto o toglierla.", "Tap ✏️ on a zone to change its name and look or remove it.")}</p></div>
    <div class="ir1col"><div class="mu1l">${t("Da mettere in pausa quando piove", "To pause when it rains")}</div><div class="stack">
      ${L.map(x => riga(x.id, VIA()[x.via], `<button class="btn sm" data-act="irNoP" data-id="${x.id}" aria-label="${t("Togli", "Remove")}">✕</button>`, nomeP(x))).join("")}
      ${extra.map(id => riga(id, t("spento adesso: lo metto in pausa quando è acceso", "off now: I'll pause it when it's on"), `<button class="btn sm" data-act="irNoP" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button>`)).join("")}
      ${no.map(id => riga(id, t("escluso", "excluded"), `<button class="btn sm" data-act="irSiP" data-id="${id}">↺</button>`)).join("")}
      <button class="add1" data-act="irAddP"><span>＋</span>${t("Automazione o switch del programma", "Schedule automation or switch")}</button></div></div>
    <div class="ir1col"><div class="mu1l">⏱ ${t("Timer della plancia", "Dashboard timer")}</div>
      <p class="small muted" style="line-height:1.5">${G.length ? t("Per le zone senza un servizio con la durata accendo e lo script «'Nduja · irrigazione» chiude dopo i minuti scelti: ", "For zones without a service with a duration I turn them on and the «'Nduja · irrigation» script closes them after the chosen minutes: ") + G.map(id => esc(nm(id))).join(", ") + "."
        : t("Tutte le zone hanno un servizio dell'integrazione con la durata: il timer della plancia non serve.", "Every zone has an integration service with a duration: the dashboard timer isn't needed.")}</p>
      ${G.length ? `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><span class="tag ${S[SCRIPT] && !timerDaPreparare() ? "ok" : "warn"}">${S[SCRIPT] ? (timerDaPreparare() ? t("da aggiornare", "needs update") : t("pronto", "ready")) : t("da creare", "to create")}</span>
        <button class="btn sm" data-act="irTimer" ${preparando ? "disabled" : ""}>${S[SCRIPT] ? "↻ " + t("Ricrea", "Recreate") : "＋ " + t("Crea", "Create")}</button></div>` : ""}</div>
  </div>`, { cls: "span3" });
}
function pagina() {
  const Z = zone();
  return `<div class="g g3">${avviso()}${avvisoTimer()}${Z.map(tessera).join("")}
    ${!Z.length ? card("💧 " + t("Irrigazione", "Irrigation"), `<div class="empty">${t("Nessuna zona: premi ✏️ Modifica e ＋ per aggiungerne.", "No zones: press ✏️ Edit and ＋ to add some.")}</div>`, { cls: "span3" }) : ""}
    ${programmi()}${modifica()}</div>`;
}

/* ---------- scheda della Home: zone attive e prossima partenza ---------- */
function homeCard() {
  const Z = zone().map(ctx), A = Z.filter(attiva), P = prossime()[0], pz = pausa(), pd = pioggiaDomani();
  const righe = A.slice(0, 4).map(c => { const st = statoZ(c);
    return `<div class="ir1hr"><button class="ir1hb" data-act="irVai">${scena(c, "h" + c.id.replace(/\W/g, ""), "xs")}<span class="tx"><b>${esc(nm(c.id))}</b><small>${esc(st.n)}</small></span></button>
      <button class="mpc1" data-act="irStop" data-id="${c.id}" aria-label="${t("Ferma", "Stop")} ${esc(nm(c.id))}">■</button></div>`; }).join("");
  const sotto = [pz ? "⏸ " + t("in pausa fino a ", "paused until ") + quando(new Date(pz.fino)) : "", P ? "🗓 " + t("Prossima: ", "Next: ") + P.titolo + " · " + quando(P.da) : "",
    !pz && pd && sGet("ir_nopioggia") !== domani().toDateString() ? "🌧️ " + t("Domani piove", "Rain tomorrow") : ""].filter(Boolean);
  return card("💧 " + t("Irrigazione", "Irrigation"), `${righe ? `<div class="stack">${righe}</div>` : `<button class="ir1h0" data-act="irVai">${t("Nessuna zona in irrigazione", "No zone watering")}</button>`}
    ${sotto.length ? `<button class="ir1hs" data-act="irVai">${sotto.map(s => `<span>${esc(s)}</span>`).join("")}</button>` : ""}`, { link: [t("Zone", "Zones"), "irrigazione"] });
}
HOME_EXTRA.irrigazione = { title: () => t("Irrigazione", "Irrigation"), render: homeCard,
  show: () => { const Z = zone(); return Z.length > 0 && (Z.some(id => attiva(ctx(id))) || !!pausa() || prossime().length > 0 || !!pioggiaDomani()); } };

/* ---------- ✏️ una zona ---------- */
let ED = null;
function foglioZona() {
  const id = ED, a = LAYOUT.irrig?.aspetto?.[id] || "auto", man = (LAYOUT.irrig?.zone || []).includes(id);
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted mono">${esc(id)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome nella plancia", "Name in the dashboard")}</span><input id="ir1n" type="text" value="${esc(LAYOUT.names?.[id] || "")}" placeholder="${esc(nmHA(id))}"></label>
    <div class="fl1">${t("Aspetto", "Look")}</div>
    <div class="ir1ak">${[["auto", "✨ " + t("Automatico", "Automatic")], ["irrigatore", t("Irrigatore", "Sprinkler")], ["goccia", t("A goccia", "Drip")]].map(([k, n]) => {
      const g = k === "auto" ? gocciaDaNome(id) : k === "goccia";
      return `<button class="${a === k ? "on" : ""}" data-act="irAsp" data-v="${k}">${`<div class="ir1s ${g ? "gc1" : "sp1"} on sm" style="--wet:.55">${g ? aiuola("ak" + k) : prato("ak" + k)}</div>`}<span>${n}</span></button>`; }).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="irEdSalva">💾 ${t("Salva", "Save")}</button>
      <button class="btn bad" data-act="irTogli">✕ ${man ? t("Togli dalla pagina", "Remove from the page") : t("Non è una zona", "Not a zone")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Il nome cambia solo nella plancia, non in Home Assistant.", "The name changes only in the dashboard, not in Home Assistant.")}</p>`;
}
/* ---------- durata personalizzata ---------- */
let DZ = null;
function foglioDurata() {
  const id = DZ, d = durata(id);
  return `<div class="sh-head"><div><h3>⏱ ${esc(nm(id))}</h3><div class="small muted">${t("Quanti minuti?", "How many minutes?")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="ir1dm"><button class="step" data-act="irPiu" data-v="-5" aria-label="−5">−</button><label><input id="ir1m" type="number" inputmode="numeric" min="1" max="240" value="${d}"><span>min</span></label><button class="step" data-act="irPiu" data-v="5" aria-label="+5">+</button></div>
    <div class="vr1" style="justify-content:center;margin-top:12px">${[20, 45, 60, 90, 120].map(m => `<button data-act="irSetM" data-v="${m}">${durTxt(m * 6e4)}</button>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:16px;justify-content:center"><button class="btn pri" data-act="irDurGo">▶ ${t("Avvia", "Start")}</button><button class="btn" data-act="irDurOk">${t("Usa come durata", "Use as duration")}</button></div>`;
}
const minuti = () => lim(Math.round(+document.getElementById("ir1m")?.value || 10), 1, 240);
const irrigCambia = (fn, msg) => cambia(l => { l.irrig = JSON.parse(JSON.stringify(l.irrig || {})); fn(l.irrig, l); }, msg);

Object.assign(ACT, {
  irGo: el => avvia(el.dataset.id, durata(el.dataset.id)),
  irStop: (el, e) => { e?.stopPropagation?.(); ferma(el.dataset.id); },
  irDur: el => { sSet("ir_dur_" + el.dataset.id, el.dataset.v); render(true); },
  irAltro: el => { DZ = el.dataset.id; openSheet(foglioDurata); setTimeout(() => document.getElementById("ir1m")?.select(), 80); },
  irPiu: el => { const i = document.getElementById("ir1m"); if (i) i.value = lim((+i.value || 10) + +el.dataset.v, 1, 240); },
  irSetM: el => { const i = document.getElementById("ir1m"); if (i) i.value = el.dataset.v; },
  irDurOk: () => { sSet("ir_dur_" + DZ, minuti()); closeSheet(); },
  irDurGo: () => { const m = minuti(), id = DZ; sSet("ir_dur_" + id, m); closeSheet(); avvia(id, m); },
  irVai: () => go("irrigazione"),
  irPausa: () => mettiInPausa(),
  irRiprendi: () => togliPausa(),
  irNoPioggia: () => { sSet("ir_nopioggia", domani().toDateString()); render(true); },
  irTimer: () => preparaTimer().then(ok => { if (ok) toast("⏱ " + t("Timer pronto", "Timer ready")); }),
  irEd: el => { ED = el.dataset.id; openSheet(foglioZona); },
  irAsp: el => { const v = el.dataset.v, id = ED; irrigCambia(I => { I.aspetto = I.aspetto || {}; if (v === "auto") delete I.aspetto[id]; else I.aspetto[id] = v; }).then(() => { if (UI.sheet) render(); }); },
  irEdSalva: () => { const id = ED, n = (document.getElementById("ir1n")?.value || "").trim(); closeSheet();
    cambia(l => { l.names = { ...(l.names || {}) }; if (n && n !== nmHA(id)) l.names[id] = n; else delete l.names[id]; }, "💾 " + (n || nmHA(id))); },
  irTogli: () => { const id = ED; closeSheet(); irrigCambia(I => { I.zone = (I.zone || []).filter(x => x !== id); if (eZona(id)) I.tolte = [...new Set([...(I.tolte || []), id])]; }, "✕ " + nm(id)); },
  irRimetti: el => { const id = el.dataset.id; irrigCambia(I => { I.tolte = (I.tolte || []).filter(x => x !== id); }, "↺ " + nm(id)); },
  irAdd: () => scegli({ titolo: "＋ " + t("Zona", "Zone"), sotto: t("Switch, valvole, interruttori e script della casa.", "Switches, valves, toggles and scripts in the house."), auto: false, attuale: null,
    filtro: id => /^(switch|valve|script|input_boolean)\./.test(id) && id !== SCRIPT && !zone().includes(id),
    onPick: id => id && irrigCambia(I => { I.zone = [...new Set([...(I.zone || []), id])]; I.tolte = (I.tolte || []).filter(x => x !== id); }, "＋ " + nm(id)) }),
  irAddP: () => scegli({ titolo: "＋ " + t("Programma da sospendere", "Schedule to pause"), sotto: t("Automazioni o switch che fanno partire l'irrigazione.", "Automations or switches that start watering."), auto: false, attuale: null,
    filtro: id => /^(automation|switch|input_boolean)\./.test(id) && attr(id, "id") !== "nduja_irrigazione" && !pausabili().some(x => x.id === id),
    onPick: id => id && irrigCambia(I => { I.pausa = [...new Set([...(I.pausa || []), id])]; I.noPausa = (I.noPausa || []).filter(x => x !== id); }, "＋ " + nm(id)) }),
  irNoP: el => { const id = el.dataset.id; irrigCambia(I => { const extra = (I.pausa || []).includes(id); I.pausa = (I.pausa || []).filter(x => x !== id); if (!extra) I.noPausa = [...new Set([...(I.noPausa || []), id])]; }); },
  irSiP: el => { const id = el.dataset.id; irrigCambia(I => { I.noPausa = (I.noPausa || []).filter(x => x !== id); }); },
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "ir1m") { e.preventDefault(); ACT.irDurGo(); } });

page("irrigazione", { title: t("Irrigazione", "Irrigation"), short: t("Irrigaz.", "Irrigation"), icon: "💧", order: 36, editable: true,
  show: () => zone().length > 0, badge: () => zone().some(id => attiva(ctx(id))), render: pagina });

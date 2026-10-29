/* Batterie: trova da sola le pile dei dispositivi (sensori % di batteria, «batteria bassa» sì/no, attributo battery_level),
   una per dispositivo, senza telefoni (sono in Persone), auto (pagina Auto) e batteria di casa del fotovoltaico.
   Le scelte sono in LAYOUT.batterie (per tutta la casa, solo admin):
   { soglia: 20, extra: [entity_id aggiunti a mano], nascosti: [chiavi], d: { chiave: { soglia, tipo, qta, nome, cambio: ISO } } }
   La chiave è il dispositivo di Home Assistant; per un'entità senza dispositivo è l'entity_id.
   Qui c'è solo la logica: la pagina è pages/batterie.js, gli avvisi «pila scarica» sono in avvisi.js. */
import { S, REG, DEVICES, AREAS, LAYOUT, UI, nm, nmHA, ok, attr, unit, deviceClass, areaOf, pronto, render } from "./core.js";

export const SOGLIA = 20;          // avviso sotto il 20% se l'utente non sceglie altro
export const MUTO_GG = 7;          // nessuna notizia dal dispositivo da tanti giorni: forse è scarico o scollegato
const GIORNO = 864e5;
export const conf = () => LAYOUT.batterie || {};
export const confDi = k => conf().d?.[k] || {};
export const sogliaGlobale = () => { const v = +conf().soglia; return v > 0 && v < 100 ? v : SOGLIA; };
export const sogliaDi = k => { const v = +confDi(k).soglia; return v > 0 && v < 100 ? v : sogliaGlobale(); };
const nascosti = () => new Set(conf().nascosti || []);
const extra = () => (conf().extra || []).filter(id => S[id]);

/* ---------- cosa è una batteria ---------- */
const num = v => v != null && v !== "" && !isNaN(+v);
export const isSensBatt = id => id.startsWith("sensor.") && deviceClass(id) === "battery" && (unit(id) === "%" || !unit(id));
export const isBinBatt = id => id.startsWith("binary_sensor.") && deviceClass(id) === "battery";
export const hasBattAttr = id => !id.startsWith("sensor.") && !id.startsWith("binary_sensor.") && num(attr(id, "battery_level"));
const chiave = id => REG[id]?.device || id;

/* ---------- esclusi: telefoni, auto, batteria di casa ----------
   Auto ed energia stanno nelle loro pagine (caricate dopo la Home): le leggo appena ci sono. */
let MOD = null, caricando = false;
function moduli() {
  if (MOD || caricando || !pronto()) return MOD;
  caricando = true;
  Promise.all([import("./pages/auto.js"), import("./pages/energia.js")])
    .then(([a, e]) => { MOD = { a, e }; render(); })
    .catch(e => { console.warn("nduja batterie", e); MOD = { a: null, e: null }; render(); });
  return null;
}
/** pronto quando so quali sono le auto e la batteria di casa (poco dopo l'avvio) */
export const prontoBatt = () => !!moduli();
let memoEs = { k: "", v: new Set() };
function esclusi() {
  const M = moduli() || {}, k = Object.keys(S).length + ":" + Object.keys(DEVICES).length + ":" + JSON.stringify(LAYOUT.people || {}) + JSON.stringify(LAYOUT.energy || {}) + JSON.stringify(LAYOUT.cars?._hide || []) + !!MOD;
  if (memoEs.k === k) return memoEs.v;
  const E = new Set(), TEL = new Set();
  /* telefoni: i dispositivi seguiti dalle persone, l'app di Home Assistant e le batterie scelte in Persone */
  for (const p of Object.keys(S).filter(x => x.startsWith("person."))) for (const tr of attr(p, "device_trackers") || []) { const d = REG[tr]?.device; if (d) TEL.add(d); }
  for (const id in REG) if (REG[id].platform === "mobile_app") TEL.add(chiave(id));
  for (const c of Object.values(LAYOUT.people || {})) if (c?.battery) { TEL.add(c.battery); TEL.add(chiave(c.battery)); }
  TEL.forEach(x => E.add(x)); E.tel = TEL;
  /* auto */
  try { for (const d of M.a?.auto() || []) E.add(d); } catch {}
  /* batteria di casa (fotovoltaico) */
  try { const s = M.e?.sensori() || {}; for (const id of [s.soc, ...(M.e?.scelti("soc") || []), UI.opt?.battery_soc].filter(Boolean)) { E.add(id); E.add(chiave(id)); } } catch {}
  memoEs = { k, v: E };
  return E;
}

/* ---------- elenco ----------
   { k, id (entità mostrata), pct (0-100 o null), bassa (sì/no dal binary_sensor), on (raggiungibile), nome, area,
     agg (ultima notizia dal dispositivo, ms), muto (giorni), soglia, tipo, qta, cambio (ms), attesa (cambiata, aspetto la nuova lettura),
     cambiare (da cambiare), extra (aggiunta a mano), nascosta } */
let memo = { k: "", v: [] };
export function batterie({ tutte = false } = {}) {
  const k = Object.keys(S).length + ":" + JSON.stringify(conf()) + ":" + !!MOD + ":" + Math.floor(Date.now() / 30000) + ":" + JSON.stringify(LAYOUT.names || {}) + JSON.stringify(LAYOUT.rooms || {});
  /* gli stati cambiano spesso: ricalcolo al massimo ogni secondo */
  if (memo.k === k && Date.now() - memo.t < 1000) return tutte ? memo.v : memo.v.filter(b => !b.nascosta);
  const ES = esclusi(), X = extra(), H = nascosti(), G = {}, PD = {};
  for (const id of Object.keys(S)) { const d = REG[id]?.device; if (d) (PD[d] = PD[d] || []).push(id); }
  const metti = (id, forza) => {
    const c = chiave(id);
    if (!forza && (ES.has(c) || ES.has(id))) return;
    (G[c] = G[c] || { k: c, ids: [], extra: false }).ids.push(id);
    if (forza) G[c].extra = true;
  };
  for (const id of Object.keys(S)) if (isSensBatt(id) || isBinBatt(id) || hasBattAttr(id)) metti(id, false);
  for (const id of X) if (!G[chiave(id)]?.ids.includes(id)) metti(id, true);
  const v = Object.values(G).map(g => voce(g, X, H, PD)).filter(Boolean);
  memo = { k, t: Date.now(), v };
  return tutte ? v : v.filter(b => !b.nascosta);
}
/** la batteria di un gruppo: prima quella scelta a mano, poi il sensore in %, l'attributo battery_level, il sì/no */
function voce(g, X, H, PD) {
  const pctDi = id => id.startsWith("binary_sensor.") ? null : id.startsWith("sensor.") ? (ok(id) && num(S[id].state) ? Math.max(0, Math.min(100, +S[id].state)) : null) : (num(attr(id, "battery_level")) ? Math.max(0, Math.min(100, +attr(id, "battery_level"))) : null);
  const peso = id => (X.includes(id) ? 100 : 0) + (id.startsWith("sensor.") ? 20 : id.startsWith("binary_sensor.") ? 0 : 10) + (pctDi(id) != null ? 5 : 0) + (ok(id) ? 2 : 0) + (/batter/i.test(id) ? 1 : 0);
  const ids = g.ids.sort((a, b) => peso(b) - peso(a)), id = ids[0];
  const bin = ids.find(x => x.startsWith("binary_sensor.") && ok(x));
  const dev = REG[id]?.device, c = confDi(g.k);
  const pct = pctDi(id), bassa = bin ? S[bin].state === "on" : null;
  const on = ids.some(ok);
  /* ultima notizia: l'aggiornamento più recente di tutte le entità del dispositivo (una pila che resta al 100% non cambia mai) */
  const tutteDev = (dev && PD[dev]) || ids;
  const agg = Math.max(0, ...tutteDev.filter(ok).map(x => new Date(S[x].last_updated || S[x].last_changed).getTime() || 0));
  const muto = agg ? Math.floor((Date.now() - agg) / GIORNO) : null;
  const soglia = sogliaDi(g.k);
  const cambio = c.cambio ? new Date(c.cambio).getTime() : 0;
  /* pila appena cambiata: finché il dispositivo non manda una lettura nuova, il valore vecchio non conta */
  const lettura = Math.max(0, ...ids.map(x => new Date(S[x]?.last_updated || 0).getTime() || 0));
  const scarica = (pct != null && pct < soglia) || bassa === true;
  const attesa = scarica && !!cambio && lettura < cambio;
  return {
    k: g.k, id, ids, pct, bassa, on, dev, agg, muto, soglia, cambio, attesa,
    nome: c.nome || nomeDi(id, dev), area: areaDi(id, dev), tipo: String(c.tipo || "").trim(), qta: Math.max(1, Math.min(12, +c.qta || 1)),
    cambiare: scarica && !attesa, extra: g.extra, nascosta: H.has(g.k),
  };
}
const SENZA = /\s*[-–·:]?\s*(livello\s+(della\s+)?)?(batteria|battery|pila)(\s+(level|livello|bassa|low|scarica|state|stato|%))*\s*$/i;
/** nome del dispositivo, senza «batteria» in fondo */
export function nomeDi(id, dev = REG[id]?.device) {
  const D = dev && DEVICES[dev]?.name;
  if (D) return D;
  const n = LAYOUT.names?.[id] || nmHA(id);
  return n.replace(SENZA, "").trim() || n;
}
export function areaDi(id, dev = REG[id]?.device) {
  const a = areaOf(id) || (dev && DEVICES[dev]?.area) || null;
  return a && AREAS[a] ? a : null;
}
/** le pile da cambiare (per gli avvisi e il pallino della pagina); vuoto finché non so cosa escludere */
export const daCambiare = () => prontoBatt() ? batterie().filter(b => b.cambiare).sort((a, b) => ordine(a) - ordine(b)) : [];
/** per ordinare dalla più scarica: le «bassa» sì/no come 0, quelle ok sì/no in fondo alle buone, quelle che non rispondono alla fine */
export const ordine = b => b.pct != null ? b.pct : b.bassa === true ? 0 : b.bassa === false ? 100.5 : 101;

/** «Ti servono»: tipo di pila → quante, solo per quelle da cambiare; senza: quante non hanno il tipo */
export function spesa(L = daCambiare()) {
  const P = {}; let senza = 0;
  for (const b of L) { if (!b.tipo) { senza++; continue; } const k = b.tipo.toUpperCase().replace(/\s+/g, " "); P[k] = (P[k] || 0) + b.qta; }
  return { pile: Object.entries(P).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), senza };
}

/** entità per l'automazione degli avvisi sul telefono, con le soglie e senza le nascoste (più i telefoni, al 15%):
    { soglie: { 20: [sensori %] }, attributi: { 20: [entità con battery_level] }, basse: [binary_sensor sì/no] } */
export function perAutomazione() {
  const soglie = {}, attributi = {}, basse = [], add = (o, s, id) => (o[s] = o[s] || []).push(id);
  /* i telefoni non sono nella pagina ma restano negli avvisi sul telefono, sotto il 15% come prima */
  const TEL = esclusi().tel || new Set();
  for (const id of Object.keys(S)) if (isSensBatt(id) && (TEL.has(chiave(id)) || TEL.has(id))) add(soglie, 15, id);
  for (const b of batterie()) {
    if (b.id.startsWith("sensor.")) add(soglie, b.soglia, b.id);
    else if (b.id.startsWith("binary_sensor.")) basse.push(b.id);
    else add(attributi, b.soglia, b.id);
  }
  return { soglie, attributi, basse };
}
export const TIPI_PILA = ["CR2032", "CR2450", "CR2477", "CR2016", "CR1632", "CR123A", "AA", "AAA", "9V", "C", "D", "LR44", "ER14250"];
export const nomeBreve = b => b.nome || nm(b.id);
export const tTipo = b => b.tipo ? (b.qta > 1 ? b.qta + " × " : "") + b.tipo : "";

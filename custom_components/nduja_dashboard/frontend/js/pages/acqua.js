/* Acqua e gas: pagina gemella di Energia con i consumi di acqua e gas.
   Da dove leggo (le scelte di ✏️ vincono): i contatori della configurazione Energia di Home Assistant (energy/get_prefs: «water» e «gas»),
   altrimenti il sensore più adatto (device_class water/gas, state_class total o total_increasing, niente contatori di oggi/mese o dell'irrigazione).
   A) Oggi: consumo da mezzanotte (statistiche del recorder), confronto con la media degli ultimi 30 giorni (o dei giorni scelti in ⚙️), portata in tempo reale se c'è
      un sensore di portata (volume_flow_rate); disegni di 'Nduja: contatore dell'acqua con le cifre che scorrono, contatore del gas con la fiamma.
   B) Storico e costi: settimana, mese, anno come lo storico di Energia; prezzi della configurazione Energia oppure scelti in ⚙️.
   C) Perdite: con un sensore di portata, avviso «Possibile perdita: l'acqua scorre da 2 ore» (minuti e portata minima in ⚙️); i sensori di perdita
      (binary_sensor moisture) con il loro stato; la valvola dell'acqua (valve) con «Chiudi l'acqua» a doppia conferma.
   D) In Home la scheda «Acqua e gas» (HOME_EXTRA) e negli Avvisi la possibile perdita (VISTE.acquaAvvisi).
   Scelte in LAYOUT.acqua = { acqua:[id] | "none", gas:[id] | "none", flussoAcqua: id | "none", flussoGas: id | "none", valvola: id | "none",
     perditeExtra:[id], perditeTolte:[id], prezzoAcqua: €/unità, prezzoGas: €/unità, avviso:{ on, min, portata }, inUso: minuti, mediaGiorni: giorni }
   La valuta è quella di Home Assistant; il periodo dello Storico si ricorda su ogni dispositivo (aqStor). */
import { S, ACT, CHG, UI, LAYOUT, VISTE, HOME_EXTRA, PAGES, t, LOC, esc, fnum, nm, nmHA, ok, val, attr, unit, allEnts, deviceClass, card, page,
  svc, ws, cached, toast, openSheet, closeSheet, render, isAdmin, utenteCfg, durata, ago, sicuro, sGet, sSet } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { statistiche, barre } from "../grafici.js";

const MIN = 6e4, GIORNO = 864e5;
const C = () => LAYOUT.acqua || {};
const aqCambia = (fn, msg) => cambia(l => { l.acqua = JSON.parse(JSON.stringify(l.acqua || {})); fn(l.acqua); if (!Object.keys(l.acqua).length) delete l.acqua; }, msg);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const testo = id => (id + " " + nmHA(id)).toLowerCase().replace(/[_.]/g, " ");
const lista = v => (Array.isArray(v) ? v : v && v !== "none" ? [v] : []).filter(id => S[id]);
const oggi0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dataISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** valuta di Home Assistant (Impostazioni → Sistema → Generale); prima era sempre l'euro */
const valuta = () => { const c = cached("haConfig", 3600e3, () => ws({ type: "get_config" }).catch(() => ({}))); return /^[A-Z]{3}$/.test(c?.currency || "") ? c.currency : "EUR"; };
const euro = v => { if (v == null || isNaN(v)) return "—"; try { return v.toLocaleString(LOC, { style: "currency", currency: valuta() }); } catch { return v.toLocaleString(LOC, { style: "currency", currency: "EUR" }); } };
const simbolo = () => { try { return (0).toLocaleString(LOC, { style: "currency", currency: valuta(), currencyDisplay: "narrowSymbol" }).replace(/[\d\s.,\u00a0]/g, "") || valuta(); } catch { return "€"; } };
const KIND = { acqua: { tipo: "water", dc: "water", ic: "💧", col: "#64d2ff" }, gas: { tipo: "gas", dc: "gas", ic: "🔥", col: "#ff9f0a" } };
const nomeK = k => k === "acqua" ? t("Acqua", "Water") : t("Gas", "Gas");

/* ---------- impostazioni (valori predefiniti e campi in ⚙️) ---------- */
const avvisoOn = () => C().avviso?.on !== false;
/** dopo quanti minuti di acqua che scorre senza sosta compare «Possibile perdita» (120 se non scegli) */
const minPerdita = () => clamp(Math.round(+(C().avviso?.min ?? 120)) || 120, 10, 1440);
/** sotto questa portata (L/min) l'acqua è «ferma»: serve per i contatori che segnano qualche goccia anche a rubinetti chiusi (0 se non scegli) */
const portataMin = () => { const v = +(C().avviso?.portata ?? 0); return isNaN(v) ? 0 : clamp(v, 0, 50); };
/** senza sensore di portata: acqua o gas «in uso» se il contatore è cambiato negli ultimi minuti (10 se non scegli) */
const minInUso = () => clamp(Math.round(+(C().inUso ?? 10)) || 10, 1, 240);
/** «giorno medio»: media degli ultimi N giorni interi (30 se non scegli) */
const GG_MEDIA = [7, 14, 30, 60, 90];
const ggMedia = () => GG_MEDIA.includes(+C().mediaGiorni) ? +C().mediaGiorni : 30;

/* ---------- configurazione Energia ---------- */
const prefs = () => cached("energy:prefs", 10 * MIN, () => ws({ type: "energy/get_prefs" }).catch(() => ({}))) || {};
const fontiPrefs = k => (prefs().energy_sources || []).filter(s => s.type === KIND[k].tipo && s.stat_energy_from);
const meta = ids => cached("aq:meta:" + ids.join(","), 3600e3, () => ws({ type: "recorder/get_statistics_metadata", statistic_ids: ids }).catch(() => []));

/* ---------- unità ---------- */
const nu = u => { const x = String(u || "").trim().toLowerCase().replace(/3$/, "³");
  return { "m³": "m³", l: "L", gal: "gal", "ft³": "ft³", ccf: "CCF", kwh: "kWh", wh: "Wh", mwh: "MWh", mj: "MJ", gj: "GJ" }[x] || String(u || "").trim(); };
/* fattori verso l'unità di base: acqua in litri, gas in m³ (volume) oppure kWh (energia) */
const ACQ = { L: 1, "m³": 1000, gal: 3.78541, "ft³": 28.3168, CCF: 2831.68 };
const GASV = { "m³": 1, L: .001, "ft³": .0283168, CCF: 2.83168 };
const GASE = { kWh: 1, Wh: .001, MWh: 1000, MJ: 1 / 3.6, GJ: 1000 / 3.6 };
function unitaDi(id) {
  if (S[id] && unit(id)) return nu(unit(id));
  const M = meta([id]); const m = Array.isArray(M) ? M.find(x => x.statistic_id === id) || M[0] : null;
  return m ? nu(m.statistics_unit_of_measurement || m.display_unit_of_measurement) : "";
}
/** come misuro un insieme di contatori: fattore di ognuno verso la base, unità da mostrare (du) e il suo fattore (df) */
function misura(k, ids) {
  const U = ids.map(unitaDi), u0 = U.find(Boolean) || (k === "acqua" ? "m³" : "m³");
  if (k === "acqua") { const du = ["gal", "ft³", "CCF"].includes(u0) ? u0 : "m³";
    return { f: id => ACQ[unitaDi(id)] ?? ACQ[u0] ?? 1000, du, df: ACQ[du], metrico: du === "m³" }; }
  const fam = GASE[u0] ? GASE : GASV;
  return { f: id => fam[unitaDi(id) || u0] ?? null, du: fam[u0] ? u0 : "m³", df: fam[u0] ?? 1, metrico: false };
}
/** quantità da mostrare: l'acqua in litri finché è poca, poi in m³ */
function qta(k, base, M) {
  if (base == null || isNaN(base)) return "—";
  if (k === "acqua" && M.metrico) return Math.abs(base) < 10000 ? fnum(base, Math.abs(base) < 10 ? 1 : 0) + " L" : fnum(base / 1000, Math.abs(base) < 1e5 ? 1 : 0) + " m³";
  const v = base / M.df; return fnum(v, Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0) + " " + M.du;
}

/* ---------- contatori ---------- */
const totale = id => ["total", "total_increasing"].includes(attr(id, "state_class"));
/* contatori di un periodo (oggi, mese…), costi e previsioni: non sono il contatore della casa */
const NON_CONT = /(^| )(today|daily|oggi|giorno|giornalier[oa]|day|week|weekly|settiman[ae]|month|monthly|mese|mensile|year|yearly|anno|annuale|yesterday|ieri|last|ultim[oa]|hour|hourly|ora|orari[oa]|previous|precedente|cost|costo|price|prezzo|forecast|previsione)( |$)/;
const IRRIG = /irrig|sprinkl|gocciol|(^| )drip|annaff|watering|(^| )prato|(^| )orto( |$)|giardin|garden|lawn|(^| )zon[ae]( |$)|(^| )zone( |$)|piscina|(^| )pool( |$)/;
const CALDAIA = /caldaia|boiler|heating|riscald|(^| )dhw|(^| )acs( |$)|sanitar|cooking|fornell|piano cottura|stove/;
const isContatore = (k, id) => id.startsWith("sensor.") && totale(id) && deviceClass(id) === KIND[k].dc && !NON_CONT.test(testo(id)) && !IRRIG.test(testo(id));
function migliore(k) {
  let best = null, top = -99;
  for (const id of allEnts("sensor", x => isContatore(k, x))) {
    const s = testo(id); let p = 0;
    if (/contatore|meter|totale|total|lettura|reading|consumo|consumption|utility/.test(s)) p += 2;
    if (CALDAIA.test(s)) p -= 3;   // il gas della sola caldaia è una parte: meglio il contatore della casa
    if (ok(id)) p += .5;
    if (p > top) { top = p; best = id; }
  }
  return best;
}
/** i contatori in uso per l'acqua o il gas: { ids, fonte: "mano" | "energia" | "auto" | "no" } */
export function contatori(k) {
  const v = C()[k];
  if (v === "none") return { ids: [], fonte: "no" };
  const man = lista(v); if (man.length) return { ids: man, fonte: "mano" };
  const P = fontiPrefs(k); if (P.length) return { ids: [...new Set(P.map(s => s.stat_energy_from))], fonte: "energia" };
  const a = migliore(k); return { ids: a ? [a] : [], fonte: a ? "auto" : "no" };
}
/** prezzo per unità del contatore: quello scelto in ⚙️ (per l'unità mostrata) o quello della configurazione Energia */
const prezzoScelto = k => { const v = C()[k === "acqua" ? "prezzoAcqua" : "prezzoGas"]; return v == null || v === "" || isNaN(+v) ? null : +v; };
function prezzoPrefs(k, id) {
  const s = fontiPrefs(k).find(x => x.stat_energy_from === id); if (!s) return null;
  return s.number_energy_price != null ? +s.number_energy_price : s.entity_energy_price && S[s.entity_energy_price] ? val(s.entity_energy_price) : null;
}
/** prezzo da mostrare (€/du) e da dove viene */
function prezzo(k, ids, M) {
  const o = prezzoScelto(k); if (o != null) return { p: o, da: "mano" };
  for (const id of ids) { const p = prezzoPrefs(k, id), f = M.f(id); if (p != null && f) return { p: p * M.df / f, da: "energia" }; }
  return { p: null, da: null };
}
/** costo di un insieme di valori { id: quantità nell'unità del contatore } */
function costo(k, valori, M) {
  const o = prezzoScelto(k); let tot = 0, c = false;
  for (const [id, v] of Object.entries(valori)) {
    if (v == null || isNaN(v)) continue;
    const f = M.f(id); if (f == null) continue;
    const p = o != null ? o * f / M.df : prezzoPrefs(k, id); if (p == null) continue;
    tot += v * p; c = true;
  }
  return c ? tot : null;
}

/* ---------- oggi e media ---------- */
const cambioIn = (id, periodo) => cached("aq:" + periodo + ":" + id + ":" + dataISO(oggi0()), 2 * MIN, () =>
  ws({ type: "recorder/statistic_during_period", statistic_id: id, calendar: { period: periodo }, types: ["change"] }).then(r => r?.change ?? null).catch(() => null));
/** consumo di oggi (o di questo mese): { base, valori, carica } */
function oggi(k, ids, M, periodo = "day") {
  const valori = {}; let base = 0, c = false, carica = false;
  for (const id of ids) { const v = cambioIn(id, periodo); if (v === undefined) { carica = true; continue; } valori[id] = v; const f = M.f(id); if (v != null && f != null) { base += Math.max(0, v) * f; c = true; } }
  return { base: c ? base : null, valori, carica };
}
/** somma per periodo (giorni o mesi) dalle statistiche: [{ x, base, valori:{id:v} }] oppure undefined mentre carica */
function perPeriodo(ids, start, periodo, M) {
  const r = statistiche(ids, start, periodo, ["change"]); if (r === undefined) return undefined;
  const m = {};
  for (const id of ids) { const f = M.f(id); if (f == null) continue;
    for (const p of (r?.[id] || [])) { const x = typeof p.start === "number" ? p.start : Date.parse(p.start), q = m[x] = m[x] || { x, base: 0, valori: {} };
      const v = Math.max(0, +p.change || 0); q.base += v * f; q.valori[id] = (q.valori[id] || 0) + v; } }
  return Object.values(m).sort((a, b) => a.x - b.x);
}
/** media al giorno degli ultimi 30 giorni interi (o di quelli scelti in ⚙️), senza oggi */
function media(ids, M) {
  const g0 = oggi0(), start = new Date(g0.getTime() - ggMedia() * GIORNO);
  const P = perPeriodo(ids, start, "day", M); if (P === undefined) return undefined;
  const L = P.filter(p => p.x < g0.getTime()); if (!L.length) return null;
  return L.reduce((a, p) => a + p.base, 0) / L.length;
}

/* ---------- portata in tempo reale ---------- */
const UF = { "l/min": 1, "l/h": 1 / 60, "l/s": 60, "ml/s": .06, "ml/min": .001, "m³/h": 1000 / 60, "m³/min": 1000, "m³/s": 6e4, "gal/min": 3.78541, gpm: 3.78541, "gal/h": 3.78541 / 60, "ft³/min": 28.3168, cfm: 28.3168, "ft³/h": 28.3168 / 60 };
const uf = id => String(unit(id)).toLowerCase().replace(/\s/g, "").replace(/3(?=\/)/, "³");
const NON_FLUSSO = /caldaia|boiler|(^| )ch( |$)|heating|riscald|pump|pompa|circuit|circol|irrig|sprinkl|(^| )aria( |$)|(^| )air( |$)|ventil|(^| )fan( |$)|hvac|exhaust|fumi|radiat|termosif|piscina|(^| )pool( |$)|heat pump|pompa di calore|solar|solare/;
const GAS = /(^| )gas( |$)|metano|methane|propan|gpl|lpg/;
const isFlusso = id => id.startsWith("sensor.") && (deviceClass(id) === "volume_flow_rate" || UF[uf(id)] != null) && !NON_FLUSSO.test(testo(id));
/** portata in L/min */
const lmin = id => { const v = val(id); if (v == null) return null; return v * (UF[uf(id)] ?? 1); };
/** il sensore di portata dell'acqua o del gas: quello scelto, altrimenti il più adatto (soloAuto: ignora la scelta) */
export function flusso(k, soloAuto) {
  const v = soloAuto ? null : C()[k === "acqua" ? "flussoAcqua" : "flussoGas"];
  if (v === "none") return null; if (v && S[v]) return v;
  const L = allEnts("sensor", id => isFlusso(id) && (k === "gas" ? GAS.test(testo(id)) : !GAS.test(testo(id))));
  return L.find(id => ok(id) && /acqua|water|idric|portata|flow|gas|metano/.test(testo(id))) || L.find(ok) || L[0] || null;
}
const flussoTxt = (k, id) => {
  if (!id || !ok(id)) return "—";
  if (k === "acqua" && /^l\/|^m³\/|^ml\//.test(uf(id))) { const q = lmin(id); return fnum(q, q < 10 ? 1 : 0) + " L/min"; }
  return fnum(val(id), Math.abs(val(id)) < 10 ? 2 : 1) + " " + unit(id);
};

/* ---------- adesso: in uso? ---------- */
/** { on, da (ms), intensita 0…1, conFlusso } per l'acqua o il gas */
function adesso(k, ids) {
  const f = flusso(k);
  if (f && ok(f)) {
    const q = k === "acqua" ? lmin(f) : val(f), on = q != null && q > (k === "acqua" ? portataMin() : 0);
    const i = k === "acqua" ? clamp((q || 0) / 12, .12, 1) : clamp((q || 0) * (UF[uf(f)] ?? 1) / 40, .3, 1);   // 12 L/min = rubinetto aperto; 40 L/min di gas ≈ caldaia al massimo
    return { on, intensita: on ? i : 0, conFlusso: true, q, f };
  }
  const recente = ids.some(id => S[id] && ok(id) && Date.now() - Date.parse(S[id].last_changed) < minInUso() * MIN);
  return { on: recente, intensita: recente ? .55 : 0, conFlusso: false, q: null, f: null };
}

/* ---------- perdite ---------- */
const VISTO = { giu: 0 };   // l'ultima volta che ho visto l'acqua ferma (se la cronologia in cache è di qualche minuto fa)
/** da quando l'acqua scorre senza sosta (ms); null = è ferma o non c'è il sensore; undefined = sto caricando la cronologia */
function scorreDa() {
  const id = flusso("acqua"); if (!id || !ok(id)) return null;
  const sog = portataMin(), q = lmin(id);
  if (!(q > sog)) { VISTO.giu = Date.now(); return null; }
  const W = Math.max(6 * 60, minPerdita() * 2) * MIN, f = UF[uf(id)] ?? 1;
  const H = cached("aqH:" + id + ":" + W, 2 * MIN, () => ws({ type: "history/history_during_period", start_time: new Date(Date.now() - W).toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true })
    .then(r => r?.[id] || []).catch(() => []));
  if (H === undefined) return undefined;
  const P = H.map(x => ({ t: ((x.lu ?? x.lc) || 0) * 1000, v: parseFloat(x.s) })).filter(p => p.t).sort((a, b) => a.t - b.t);
  let da;
  if (!P.length) { const lc = Date.parse(S[id]?.last_changed); da = isNaN(lc) ? Date.now() : lc; }
  else { da = P[0].t; for (let i = P.length - 1; i >= 0; i--) if (isNaN(P[i].v) || !(P[i].v * f > sog)) { da = P[i + 1]?.t ?? Date.now(); break; } }
  return Math.max(da, VISTO.giu || 0);
}
/** possibile perdita: l'acqua scorre da più dei minuti scelti → { da, q } */
function perdita() {
  const da = scorreDa(); if (da == null) return null;
  if (Date.now() - da < minPerdita() * MIN) return null;
  return { da, q: lmin(flusso("acqua")) };
}
const isSensPerdita = id => id.startsWith("binary_sensor.") && (deviceClass(id) === "moisture" || (/leak|perdit|allag|flood|water alarm|acqua a terra/.test(testo(id)) && [undefined, null, "problem", "safety"].includes(deviceClass(id))));
export function sensoriPerdita() {
  const c = C(), via = new Set(c.perditeTolte || []);
  return [...new Set([...allEnts("binary_sensor", isSensPerdita), ...lista(c.perditeExtra)])].filter(id => !via.has(id));
}
const bagnato = id => S[id]?.state === "on";

/* ---------- valvola dell'acqua ---------- */
const VALV_NOME = /acqua|water|idric|(^| )main( |$)|principal|general|shut ?off|chiusura|arresto|centrale|ingresso/;
export function valvola(soloAuto) {
  const v = soloAuto ? null : C().valvola; if (v === "none") return null; if (v && S[v]) return v;
  let irr; try { irr = new Set([...(VISTE.irrTutte?.() || []), ...(VISTE.irrZone?.() || [])]); } catch { irr = new Set(); }
  const L = allEnts("valve", id => !irr.has(id) && !GAS.test(testo(id)) && !IRRIG.test(testo(id)) && (deviceClass(id) === "water" || VALV_NOME.test(testo(id))));
  return L.sort((a, b) => (/principal|main|general|centrale|ingresso/.test(testo(b)) ? 1 : 0) - (/principal|main|general|centrale|ingresso/.test(testo(a)) ? 1 : 0))[0] || null;
}
/** "aperta", "chiusa", "si apre", "si chiude" o null */
function statoValvola(id) {
  if (!id || !ok(id)) return null; const s = S[id].state;
  if (id.startsWith("switch.") || id.startsWith("input_boolean.")) return s === "on" ? "aperta" : "chiusa";
  return { open: "aperta", closed: "chiusa", opening: "si apre", closing: "si chiude" }[s] || null;
}
const STV = () => ({ aperta: t("aperta", "open"), chiusa: t("chiusa", "closed"), "si apre": t("si sta aprendo", "opening"), "si chiude": t("si sta chiudendo", "closing") });

/* ---------- tutto insieme ---------- */
function dati(k) {
  const { ids, fonte } = contatori(k), M = misura(k, ids);
  return { k, ids, fonte, M, ad: adesso(k, ids), f: flusso(k) };
}
const haK = k => contatori(k).ids.length > 0 || !!flusso(k);
export const haAcquaGas = () => { try { return haK("acqua") || haK("gas") || !!valvola(); } catch { return false; } };
const pagAttiva = () => !!PAGES.acqua?.show() && LAYOUT.pages?.acqua !== false && utenteCfg().pages?.acqua !== false;

/* ================= disegni di 'Nduja (SVG + CSS, fermi con «riduci movimento» e in modalità leggera) ================= */
/** cifre del contatore: 5 nere (unità) e 3 rosse (millesimi) */
function cifre(v) { if (v == null || isNaN(v)) return null; const n = Math.floor(Math.abs(v) * 1000 + 1e-6) % 1e8; return String(n).padStart(8, "0").split("").map(Number); }
/** finestrella con i rulli delle cifre: x, y, larghezza; gira = l'ultimo rullo scorre */
function rulli(x, y, w, h, D, gira) {
  const cw = w / 8, step = h;
  const col = (i) => { const d = D ? D[i] : 0, tx = (i * cw + cw / 2).toFixed(2);
    return `<rect class="${i < 5 ? "nb" : "nr"}" x="${(i * cw + .35).toFixed(2)}" y="0" width="${(cw - .7).toFixed(2)}" height="${h}" rx="1.2"/>
      <g class="col ${gira && i === 7 ? "ul" : ""}" style="transform:translateY(${-d * step}px)">${Array.from({ length: 11 }, (_, j) => `<text x="${tx}" y="${(j * step + h * .76).toFixed(2)}" text-anchor="middle">${j % 10}</text>`).join("")}</g>`; };
  return `<svg class="rl ${D ? "" : "nd"}" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden">${Array.from({ length: 8 }, (_, i) => col(i)).join("")}<rect class="vt" x="0" y="0" width="${w}" height="${h}" rx="2"/></svg>`;
}
/** stellina del contatore (gira quando passa l'acqua) */
function stella(cx, cy, r) {
  let d = ""; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 - Math.PI / 2, rr = i % 2 ? r * .42 : r; d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2); }
  return d + "Z";
}
/** lettura del contatore (il primo con uno stato) nell'unità da mostrare */
function lettura(dt) {
  const id = dt.ids.find(x => S[x] && ok(x)); if (!id) return null;
  const v = val(id), f = dt.M.f(id); if (v == null || f == null) return null;
  return v * f / dt.M.df;
}
const velocita = i => ({ rd: (clamp(2.6 / Math.max(i, .05), 1.1, 20)).toFixed(2), rs: (clamp(1.6 / Math.max(i, .05), .45, 12)).toFixed(2) });
/** contatore dell'acqua: o = { xs, valv: "aperta"|"chiusa"|…|null, al (allarme), uid } */
function scenaAcqua(dt, o = {}) {
  const on = dt.ad.on, D = cifre(lettura(dt)), v = velocita(dt.ad.intensita || .5), chiusa = o.valv === "chiusa" || o.valv === "si chiude";
  const cls = ["aq1s", "aq1a", on ? "on" : "", o.al ? "al" : "", chiusa ? "vc" : "", o.xs ? "xs" : ""].filter(Boolean).join(" ");
  const gocce = [0, 1, 2].map(i => `<circle cx="226" cy="${140 + i * 6}" r="${(2.2 - i * .3).toFixed(1)}"/>`).join("");
  return `<svg class="${cls}" viewBox="${o.xs ? "60 14 120 116" : "0 0 240 160"}" style="--rd:${v.rd}s;--rs:${v.rs}s" role="img" aria-label="${esc(t("Contatore dell'acqua", "Water meter") + (on ? " · " + t("l'acqua scorre", "water is flowing") : ""))}">
    ${o.xs ? "" : `<g class="tb"><rect class="tu" x="-6" y="104" width="216" height="16" rx="3"/><path class="tu2" d="M204 112H216a10 10 0 0 1 10 10V133"/><rect class="lip" x="218" y="131" width="16" height="5" rx="2"/>
      <path class="fx" d="M-6 112H214"/><rect class="dado" x="55" y="100" width="12" height="24" rx="2.5"/><rect class="dado" x="173" y="100" width="12" height="24" rx="2.5"/></g>
      <g class="gcc">${gocce}</g>
      ${o.valv ? `<g class="vlv"><rect class="vb" x="19" y="99" width="20" height="26" rx="4"/><path class="vm" d="M29 99V90"/><path class="vh" d="M14 87H44"/><circle class="vp" cx="29" cy="88" r="3"/></g>` : ""}`}
    <circle class="cr" cx="120" cy="72" r="56"/><circle class="qd" cx="120" cy="72" r="47"/>
    <path class="hl" d="M83.5 49a44 44 0 0 1 40 -21.5"/>
    <text class="un" x="120" y="46" text-anchor="middle">${esc(dt.M.du)}</text>
    <rect class="fw" x="76" y="52" width="88" height="22" rx="4"/>${rulli(77, 53, 86, 20, D, on)}
    <circle class="pd" cx="100" cy="95" r="8"/><path class="pn" style="transform:rotate(${D ? D[6] * 36 : 0}deg)" d="M100 95V89"/>
    <circle class="pd" cx="140" cy="95" r="8"/><path class="pn" style="transform:rotate(${D ? D[5] * 36 : 0}deg)" d="M140 95V89"/>
    <g class="stl"><path d="${stella(120, 101, 7)}"/><circle cx="120" cy="101" r="1.6"/></g>
  </svg>`;
}
/** forma di una fiammella con la base in (x, y), alta h e larga w */
const fiammella = (x, y, h, w) => `M${x.toFixed(1)} ${y.toFixed(1)}C${(x - w).toFixed(1)} ${(y - h * .22).toFixed(1)} ${(x - w * .55).toFixed(1)} ${(y - h * .62).toFixed(1)} ${x.toFixed(1)} ${(y - h).toFixed(1)}C${(x + w * .55).toFixed(1)} ${(y - h * .62).toFixed(1)} ${(x + w).toFixed(1)} ${(y - h * .22).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z`;
/** contatore del gas e fornello con la fiamma: o = { xs, uid } */
function scenaGas(dt, o = {}) {
  const on = dt.ad.on, D = cifre(lettura(dt)), i = dt.ad.intensita || .55, v = velocita(i);
  const X = [172, 180.5, 189, 197.5, 206, 214.5, 223], H = [9, 13, 16, 18, 16, 13, 9];
  const fiamme = X.map((x, j) => `<g class="fm f${j}"><path class="fo" d="${fiammella(x, 103.5, H[j], 3.6)}"/><path class="fi" d="${fiammella(x, 103.5, H[j] * .52, 2)}"/></g>`).join("");
  return `<svg class="aq1s aq1g ${on ? "on" : ""} ${o.xs ? "xs" : ""}" viewBox="${o.xs ? "158 62 80 52" : "0 0 240 160"}" style="--rd:${v.rd}s;--fv:${(.55 + .45 * i).toFixed(2)}" role="img" aria-label="${esc(t("Contatore del gas", "Gas meter") + (on ? " · " + t("gas in uso", "gas in use") : ""))}">
    ${o.xs ? "" : `<path class="tg" d="M74 118V142H197V122"/><path class="fxg" d="M74 118V142H197V122"/>
      <rect class="gs" x="34" y="6" width="14" height="10" rx="2"/><rect class="gs" x="100" y="6" width="14" height="10" rx="2"/>
      <rect class="gb" x="14" y="14" width="120" height="104" rx="16"/><path class="gbt" d="M14 34V30a16 16 0 0 1 16 -16H118a16 16 0 0 1 16 16V34Z"/>
      <rect class="fw" x="27" y="47" width="94" height="24" rx="4"/>${rulli(29, 49, 90, 20, D, on)}
      <text class="un" x="74" y="88" text-anchor="middle">${esc(dt.M.du)}</text>
      <path class="gl" d="M32 101H116M32 108H88"/>`}
    <ellipse class="gw" cx="197.5" cy="94" rx="36" ry="17"/>
    <rect class="bs" x="189.5" y="108" width="16" height="12" rx="2"/>
    <ellipse class="bh" cx="197.5" cy="107" rx="31" ry="6.5"/>
    <g class="fia">${fiamme}</g>
    <ellipse class="bc" cx="197.5" cy="103" rx="17" ry="3.6"/>
  </svg>`;
}

/* ================= pagina ================= */
/** riga «oggi» di un tipo: scena, numeri, confronto con la media */
function pannello(dt, P) {
  const { k, ids, M, ad } = dt, O = ids.length ? oggi(k, ids, M) : { base: null, valori: {}, carica: false }, md = ids.length ? media(ids, M) : null;
  const Me = ids.length ? oggi(k, ids, M, "month") : { base: null, valori: {}, carica: false };
  const pr = prezzo(k, ids, M), cOggi = O.base != null ? costo(k, O.valori, M) : null;
  const vs = O.base != null && md ? O.base / md : null, sc = Math.max(O.base || 0, md || 0) * 1.12 || 1;
  const conf = vs == null ? "" : vs < .97 ? t(`finora il ${Math.round(vs * 100)}% di un giorno medio`, `so far ${Math.round(vs * 100)}% of an average day`)
    : vs <= 1.03 ? t("come un giorno medio", "like an average day") : t(`già ${Math.round((vs - 1) * 100)}% più di un giorno medio`, `already ${Math.round((vs - 1) * 100)}% more than an average day`);
  const tag = k === "acqua" && P ? ["bad", t("possibile perdita", "possible leak")] : k === "acqua" && (dt.valv === "chiusa") ? ["bad", t("acqua chiusa", "water shut off")]
    : ad.on ? ["info", k === "acqua" ? t("sta scorrendo", "flowing") : t("in uso", "in use")] : ad.conFlusso ? ["", k === "acqua" ? t("ferma", "not flowing") : t("spento", "off")] : null;
  const sc1 = k === "acqua" ? scenaAcqua(dt, { valv: dt.valv, al: !!P }) : scenaGas(dt);
  const kpi = (n, v, s, cls = "", id) => `<${id ? `button data-act="more" data-id="${id}"` : "div"} class="aq1k ${cls}"><small>${n}</small><b>${v}</b>${s ? `<span>${s}</span>` : ""}</${id ? "button" : "div"}>`;
  return `<div class="aq1u k-${k} ${ad.on ? "on" : ""} ${k === "acqua" && P ? "ko" : ""}">
    <div class="aq1sc">${sc1}</div>
    <div class="aq1nx">
      <div class="aq1t"><b>${KIND[k].ic} ${nomeK(k)}</b>${tag ? `<span class="tag ${tag[0]}">${tag[1]}</span>` : ""}</div>
      ${ids.length ? `<div class="aq1v"><b>${O.base == null ? (O.carica ? "…" : "—") : esc(qta(k, O.base, M))}</b><small>${t("oggi da mezzanotte", "today since midnight")}</small></div>
      <div class="aq1cf"><span class="aq1br"><i style="width:${O.base != null ? (O.base / sc * 100).toFixed(1) : 0}%"></i>${md ? `<u style="left:${(md / sc * 100).toFixed(1)}%" title="${esc(t("giorno medio", "average day"))}"></u>` : ""}</span>
        <small>${md === undefined ? t("calcolo la media…", "working out the average…") : md ? esc(conf || t("giorno medio", "average day")) + " · " + t("media ", "average ") + esc(qta(k, md, M)) + t(" al giorno", " a day") : t("ancora pochi dati per la media", "not enough data for an average yet")}</small></div>`
      : `<div class="aq1v"><small>${t("Nessun contatore: vedo solo la portata.", "No meter: I only see the flow.")}</small></div>`}
      <div class="aq1ks">
        ${dt.f ? kpi(t("Adesso", "Now"), esc(flussoTxt(k, dt.f)), ad.on ? (k === "acqua" ? t("l'acqua scorre", "water is flowing") : t("gas in uso", "gas in use")) : t("fermo", "idle"), ad.on ? "on" : "", dt.f) : ""}
        ${ids.length ? kpi(t("Questo mese", "This month"), Me.base == null ? (Me.carica ? "…" : "—") : esc(qta(k, Me.base, M)), Me.base != null && costo(k, Me.valori, M) != null ? esc(euro(costo(k, Me.valori, M))) : "") : ""}
        ${ids.length && cOggi != null ? kpi(t("Costo di oggi", "Today's cost"), esc(euro(cOggi)), esc(euro(pr.p)) + "/" + esc(M.du)) : ""}
      </div>
    </div></div>`;
}
function hero() {
  const A = haK("acqua") ? { ...dati("acqua"), valv: statoValvola(valvola()) } : null, G = haK("gas") ? dati("gas") : null, P = A ? perdita() : null;
  const adm = isAdmin();
  return `<section class="card span3 aq1h ${A && G ? "due" : ""}"><div class="ch"><h2>📅 ${t("Oggi", "Today")}</h2>${adm ? `<button class="btn sm" data-act="aqCfg" aria-label="${t("Sensori, prezzi e avvisi", "Sensors, prices and alerts")}">⚙️</button>` : ""}</div>
    <div class="aq1hg">${A ? pannello(A, P) : ""}${G ? pannello(G, null) : ""}</div></section>`;
}

/* C) perdite e valvola */
function cardPerdite() {
  const fid = flusso("acqua"), SP = sensoriPerdita(), V = valvola();
  if (!fid && !SP.length && !V) return haK("acqua") ? card("🛟 " + t("Perdite", "Leaks"), `<p class="small muted aq1nt">${t("Per accorgermi delle perdite mi serve un sensore di portata dell'acqua o un sensore di perdita (allagamento).", "To notice leaks I need a water flow sensor or a leak (flood) sensor.")}${isAdmin() ? " " + t("Se ce l'hai, sceglilo in ⚙️.", "If you have one, choose it in ⚙️.") : ""}</p>`, { cls: "span3" }) : "";
  const da = scorreDa(), P = perdita(), q = fid ? lmin(fid) : null;
  let stato = "";
  if (fid) {
    const cls = P ? "ko" : da ? "on" : !ok(fid) ? "" : "ok";
    const tit = !ok(fid) ? t("Sensore di portata non raggiungibile", "Flow sensor unavailable")
      : P ? t(`Possibile perdita: l'acqua scorre da ${durata((Date.now() - P.da) / 1000)}`, `Possible leak: water has been flowing for ${durata((Date.now() - P.da) / 1000)}`)
      : da ? t(`L'acqua scorre da ${durata((Date.now() - da) / 1000)}`, `Water has been flowing for ${durata((Date.now() - da) / 1000)}`)
      : da === undefined ? t("Controllo da quanto scorre…", "Checking how long it's been flowing…") : t("Nessuna perdita: l'acqua è ferma", "No leak: the water is still");
    const sotto = !ok(fid) ? esc(nm(fid)) : P ? t(`${flussoTxt("acqua", fid)} senza mai fermarsi. Controlla rubinetti, sciacquone e tubi${V ? ", oppure chiudi l'acqua" : ""}.`, `${flussoTxt("acqua", fid)} without ever stopping. Check taps, toilet cistern and pipes${V ? ", or shut off the water" : ""}.`)
      : da ? flussoTxt("acqua", fid) + " · " + t(`avviso dopo ${durata(minPerdita() * 60)} senza sosta`, `alert after ${durata(minPerdita() * 60)} without a break`)
      : t(`Ti avviso se scorre per più di ${durata(minPerdita() * 60)} senza fermarsi.`, `I'll alert you if it flows for more than ${durata(minPerdita() * 60)} without stopping.`);
    stato = `<button class="aq1ps ${cls}" data-act="more" data-id="${fid}"><span class="ic">${P ? "⚠️" : da ? "💧" : "✅"}</span><span class="tx"><b>${tit}</b><span>${sotto}</span></span></button>
      ${!avvisoOn() ? `<p class="small muted aq1nt">🔕 ${t("L'avviso nella Home è spento.", "The Home alert is off.")}</p>` : ""}`;
  } else stato = `<div class="aq1ps"><span class="ic">ℹ️</span><span class="tx"><b>${t("Nessun sensore di portata", "No flow sensor")}</b><span>${t("Con un sensore di portata ti avviso quando l'acqua scorre troppo a lungo.", "With a flow sensor I alert you when water runs for too long.")}</span></span></div>`;
  const sens = SP.length ? `<div class="fl1">${t("Sensori di perdita", "Leak sensors")}</div><div class="stack">${SP.map(id => { const w = bagnato(id), un = !ok(id);
    return `<button class="li aq1sp ${w ? "ko" : ""} ${un ? "dis" : ""}" data-act="more" data-id="${id}"><span class="ic">${w ? "🚨" : "💧"}</span><div class="tx"><b>${esc(nm(id))}</b><span>${un ? t("non raggiungibile", "unavailable") : w ? t("Acqua rilevata!", "Water detected!") + " · " + esc(ago(S[id].last_changed)) : t("asciutto", "dry")}</span></div><span class="aq1dot ${w ? "ko" : un ? "" : "ok"}"></span></button>`; }).join("")}</div>` : "";
  const sv = statoValvola(V), chiusa = sv === "chiusa" || sv === "si chiude", muove = sv === "si apre" || sv === "si chiude";
  const valv = V ? `<div class="fl1">${t("Valvola dell'acqua", "Water valve")}</div>
    <div class="aq1vv ${chiusa ? "chiusa" : ""} ${!ok(V) ? "dis" : ""}"><div class="tx"><b>🚰 ${esc(nm(V))}</b><span>${!ok(V) ? t("non raggiungibile", "unavailable") : esc(STV()[sv] || S[V].state)}${ok(V) ? " · " + esc(ago(S[V].last_changed)) : ""}</span></div>
      ${ok(V) && !muove ? (chiusa ? `<button class="btn" data-act="aqValv" data-v="apri" data-id="${V}">💧 ${t("Riapri l'acqua", "Turn water back on")}</button>`
        : `<button class="btn bad" data-act="aqValv" data-v="chiudi" data-id="${V}">⛔ ${t("Chiudi l'acqua", "Shut off water")}</button>`) : ""}</div>
    <p class="small muted aq1nt">${chiusa ? t("Con l'acqua chiusa in casa non arriva acqua.", "With the water shut off, no water reaches the house.") : t("Tocca due volte per confermare: chiude l'acqua di tutta la casa.", "Tap twice to confirm: it shuts off water to the whole house.")}</p>` : "";
  return card("🛟 " + t("Perdite", "Leaks") + (V ? " " + t("e valvola", "and valve") : ""), `<div class="aq1pg"><div>${stato}${valv}</div>${sens ? `<div>${sens}</div>` : ""}</div>`, { cls: "span3 aq1pc" + (P || SP.some(bagnato) ? " ko" : "") });
}

/* B) storico e costi */
/* periodo dello Storico: ricordato su questo dispositivo (settimana se non scegli) */
const VS = { get p() { const v = sGet("aqStor"); return ["settimana", "mese", "anno"].includes(v) ? v : "settimana"; } };
function storicoDi(k, giorni, periodo, start) {
  const { ids } = contatori(k); if (!ids.length) return "";
  const M = misura(k, ids), P = perPeriodo(ids, start, periodo, M);
  const tit = `<div class="aq1st"><b>${KIND[k].ic} ${nomeK(k)}</b>`;
  if (P === undefined) return `${tit}<div class="small muted">${t("Carico…", "Loading…")}</div></div>`;
  const tot = P.reduce((a, p) => a + p.base, 0), valori = {}; P.forEach(p => { for (const [id, v] of Object.entries(p.valori)) valori[id] = (valori[id] || 0) + v; });
  const max = Math.max(0, ...P.map(p => p.base)), inL = k === "acqua" && M.metrico && max < 10000, du = inL ? "L" : M.du, df = inL ? 1 : M.df;
  const cst = costo(k, valori, M), pr = prezzo(k, ids, M), n = P.length || 1;
  return `${tit}${barre([{ nome: nomeK(k), colore: KIND[k].col, valori: P.map(p => ({ x: p.x, v: p.base / df })) }], { u: du, periodo })}
    <div class="og68 aq1og"><div><small>${t("Totale", "Total")}</small><b>${esc(qta(k, tot, M))}</b></div><div><small>${t("Costo", "Cost")}</small><b style="color:${KIND[k].col}">${esc(euro(cst))}</b></div>
      <div><small>${periodo === "month" ? t("Media al mese", "Monthly average") : t("Media al giorno", "Daily average")}</small><b>${esc(qta(k, tot / n, M))}</b></div>
      <div><small>${t("Prezzo", "Price")}</small><b>${pr.p != null ? esc(euro(pr.p)) + `<span class="aq1u2">/${esc(M.du)}</span>` : "—"}</b></div></div>
    <div class="small muted" style="margin-top:8px">${pr.p == null ? (isAdmin() ? t("Per i costi scrivi il prezzo in ⚙️ o nella configurazione Energia di Home Assistant.", "For costs enter the price in ⚙️ or in Home Assistant's Energy configuration.") : t("Il prezzo non è impostato.", "The price isn't set."))
      : pr.da === "energia" ? t("Prezzo della configurazione Energia.", "Price from the Energy configuration.") : t("Prezzo scelto nella plancia.", "Price chosen in the dashboard.")}</div></div>`;
}
function cardStorico() {
  if (!contatori("acqua").ids.length && !contatori("gas").ids.length) return "";
  const [giorni, periodo] = { settimana: [7, "day"], mese: [30, "day"], anno: [365, "month"] }[VS.p];
  const ora = new Date(), start = periodo === "month" ? new Date(ora.getFullYear(), ora.getMonth() - 11, 1) : new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() - giorni + 1);
  const A = storicoDi("acqua", giorni, periodo, start), G = storicoDi("gas", giorni, periodo, start);
  return card("📊 " + t("Storico e costi", "History and costs"), `<div class="seg" style="margin-bottom:12px">${[["settimana", t("Settimana", "Week")], ["mese", t("Mese", "Month")], ["anno", t("Anno", "Year")]].map(([x, n]) => `<button class="${VS.p === x ? "act" : ""}" data-act="aqStor" data-v="${x}" aria-pressed="${VS.p === x}">${n}</button>`).join("")}</div>
    <div class="aq1sg ${A && G ? "due" : ""}">${A}${G}</div>`, { cls: "span3" });
}

/* ⚙️ sensori, prezzi e avvisi (amministratori): nella scheda di ✏️ Modifica e nel foglio di ⚙️ */
const numerico = id => id.startsWith("sensor.") && S[id] && (ok(id) ? !isNaN(parseFloat(S[id].state)) : true);
const VOCI = () => [
  ["acqua", "💧 " + t("Contatore dell'acqua", "Water meter"), id => numerico(id) && (deviceClass(id) === "water" || ACQ[nu(unit(id))] != null), true,
    t("Uno o più contatori (per esempio acqua calda e fredda): li sommo io.", "One or more meters (e.g. hot and cold water): I add them up.")],
  ["gas", "🔥 " + t("Contatore del gas", "Gas meter"), id => numerico(id) && (deviceClass(id) === "gas" || GASV[nu(unit(id))] != null || (GASE[nu(unit(id))] != null && GAS.test(testo(id)))), true,
    t("In m³ o in kWh. Più contatori si sommano.", "In m³ or kWh. Several meters are added up.")],
  ["flussoAcqua", "🚿 " + t("Portata dell'acqua (adesso)", "Water flow (now)"), id => numerico(id) && (deviceClass(id) === "volume_flow_rate" || UF[uf(id)] != null), false,
    t("Litri al minuto o m³/h: serve per vedere se l'acqua scorre e per le perdite.", "Litres per minute or m³/h: used to see if water is flowing and for leaks.")],
  ["flussoGas", "🔥 " + t("Portata del gas (adesso)", "Gas flow (now)"), id => numerico(id) && (deviceClass(id) === "volume_flow_rate" || UF[uf(id)] != null), false,
    t("Se c'è: la fiamma del disegno si accende quando il gas passa. Senza, guardo quando cambia il contatore.", "If you have one: the drawing's flame lights up when gas flows. Without it, I watch when the meter changes.")],
  ["valvola", "🚰 " + t("Valvola dell'acqua", "Water valve"), id => /^(valve|switch)\./.test(id), false,
    t("La valvola che chiude l'acqua di casa: valvola (valve) o interruttore (acceso = aperta).", "The valve that shuts off the house water: valve or switch (on = open).")],
];
/** sensori scelti per una voce (vuoto = automatico) e quelli trovati da soli */
function sceltiDi(k) { const v = C()[k]; return v === "none" ? "none" : ["acqua", "gas"].includes(k) ? lista(v) : v && S[v] ? [v] : []; }
function autoDi(k) {
  if (k === "acqua" || k === "gas") { const P = fontiPrefs(k); if (P.length) return { ids: [...new Set(P.map(s => s.stat_energy_from))], da: "energia" }; const a = migliore(k); return { ids: a ? [a] : [], da: "auto" }; }
  const x = k === "valvola" ? valvola(true) : flusso(k === "flussoAcqua" ? "acqua" : "gas", true);
  return { ids: x ? [x] : [], da: "auto" };
}
const valoreDi = id => S[id] ? (ok(id) ? esc(S[id].state) + (unit(id) ? " " + esc(unit(id)) : "") : t("non raggiungibile", "unavailable")) : t("solo statistiche", "statistics only");
function scelte() {
  const voce = ([k, label, , multi, help]) => {
    const L = sceltiDi(k), A = L === "none" || L.length ? null : autoDi(k), no = L === "none";
    return `<div class="en2"><div class="row between" style="gap:8px"><b>${label}</b><div class="row" style="gap:6px">${no || (L.length) ? `<button class="btn sm" data-act="aqAuto" data-k="${k}">✨ ${t("Automatico", "Automatic")}</button>` : ""}${!no ? `<button class="btn sm" data-act="aqNo" data-k="${k}">🚫 ${t("Non usare", "Don't use")}</button>` : ""}</div></div>
      ${help ? `<small class="muted">${help}</small>` : ""}
      <div class="stack" style="margin-top:8px">${no ? `<div class="small muted">🚫 ${t("Non usato in questa pagina.", "Not used on this page.")}</div>` : ""}
        ${!no ? L.map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)} · ${valoreDi(id)}</span></div><button class="x3" data-act="aqDel" data-k="${k}" data-id="${id}" aria-label="${t("Togli", "Remove")} · ${esc(nm(id))}">✕</button></div>`).join("") : ""}
        ${A ? `<div class="small muted">✨ ${A.ids.length ? (A.da === "energia" ? t("Dalla configurazione Energia: ", "From the Energy configuration: ") : t("Automatico: ", "Automatic: ")) + A.ids.map(id => esc(S[id] ? nm(id) : id)).join(" + ") : t("Automatico: niente trovato", "Automatic: nothing found")}</div>` : ""}
        ${!no && (multi || !L.length) ? `<button class="add1" data-act="aqAdd" data-k="${k}"><span>＋</span>${L.length ? t("Aggiungi un altro contatore", "Add another meter") : t("Scegli a mano", "Choose it yourself")}</button>` : ""}
        ${!no && !multi && L.length ? `<button class="add1" data-act="aqAdd" data-k="${k}"><span>⇄</span>${t("Cambia", "Change")}</button>` : ""}</div></div>`;
  };
  const c = C(), SP = sensoriPerdita(), tolte = lista(c.perditeTolte);
  const nIn = (id, v, min, max, step, ph, chg, extra = "") => `<input type="number" inputmode="decimal" id="${id}" min="${min}" max="${max}" step="${step}" value="${v ?? ""}" placeholder="${ph ?? ""}" data-chg="${chg}" ${extra}>`;
  const MA = misura("acqua", contatori("acqua").ids), MG = misura("gas", contatori("gas").ids);
  const pP = k => { const ids = contatori(k).ids, M = k === "acqua" ? MA : MG; for (const id of ids) { const p = prezzoPrefs(k, id), f = M.f(id); if (p != null && f) return fnum(p * M.df / f, 3); } return ""; };
  return `<div class="aq1sc2">${VOCI().map(voce).join("")}
    <div class="en2"><b>🛟 ${t("Sensori di perdita", "Leak sensors")}</b><small class="muted"> ${t("Sensori di allagamento: li trovo da soli, puoi toglierli o aggiungerne.", "Flood sensors: I find them myself, you can remove or add some.")}</small>
      <div class="stack" style="margin-top:8px">${SP.map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)} · ${valoreDi(id)}</span></div><button class="x3" data-act="aqPTogli" data-id="${id}" aria-label="${t("Togli", "Remove")} · ${esc(nm(id))}">✕</button></div>`).join("")}
        ${tolte.map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${t("tolto da questa pagina", "removed from this page")}</span></div><button class="btn sm" data-act="aqPRimetti" data-id="${id}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}
        <button class="add1" data-act="aqPAdd"><span>＋</span>${t("Aggiungi un sensore di perdita", "Add a leak sensor")}</button></div></div>
    <div class="en2"><b>💶 ${t("Prezzi (facoltativi)", "Prices (optional)")}</b><small class="muted"> ${t("Vuoto = quelli della configurazione Energia. La valuta è quella di Home Assistant (Impostazioni → Sistema → Generale): ", "Empty = those of the Energy configuration. The currency is Home Assistant's (Settings → System → General): ") + esc(valuta())}.</small>
      <div class="row aq1pr" style="gap:10px"><label class="fld1"><span>💧 ${t("Acqua", "Water")} ${esc(simbolo())}/${esc(MA.du)}</span>${nIn("aq1pa", c.prezzoAcqua, 0, 1000, "0.001", pP("acqua"), "aqPrezzo", 'data-k="prezzoAcqua"')}</label>
        <label class="fld1"><span>🔥 ${t("Gas", "Gas")} ${esc(simbolo())}/${esc(MG.du)}</span>${nIn("aq1pg", c.prezzoGas, 0, 1000, "0.001", pP("gas"), "aqPrezzo", 'data-k="prezzoGas"')}</label></div></div>
    <div class="en2"><div class="row between" style="gap:8px"><b>🔔 ${t("Avviso «Possibile perdita»", "«Possible leak» alert")}</b><button class="sw ${avvisoOn() ? "on" : ""}" data-act="aqAvOn" aria-pressed="${avvisoOn()}" aria-label="${t("Avviso nella Home", "Alert on Home")}"><i></i></button></div>
      <small class="muted">${t("Compare negli Avvisi della Home quando l'acqua scorre senza mai fermarsi (serve il sensore di portata).", "Shows in Home Alerts when water flows without ever stopping (needs the flow sensor).")}</small>
      <label class="fld1"><span>${t("Dopo quanti minuti di acqua che scorre", "After how many minutes of flowing water")}</span><span class="ar1in">${nIn("aq1am", minPerdita(), 10, 1440, 5, "", "aqNum", 'data-f="min"')}<em>min</em></span></label>
      <label class="fld1"><span>${t("Acqua ferma sotto", "Water counts as still below")}</span><span class="ar1in">${nIn("aq1ap", portataMin(), 0, 50, "0.1", "", "aqNum", 'data-f="portata"')}<em>L/min</em></span></label>
      <small class="muted">${t("Alzala un poco se il contatore segna qualche goccia anche con i rubinetti chiusi.", "Raise it a little if the meter shows a few drops even with the taps closed.")}</small></div>
    <div class="en2"><b>⏱️ ${t("Senza sensore di portata", "Without a flow sensor")}</b>
      <label class="fld1"><span>${t("«In uso» se il contatore è cambiato negli ultimi", "«In use» if the meter changed in the last")}</span><span class="ar1in">${nIn("aq1iu", minInUso(), 1, 240, 1, "", "aqNum", 'data-f="inUso"')}<em>min</em></span></label>
      <small class="muted">${t("Serve ai disegni: le cifre scorrono e la fiamma si accende. Alzalo se il tuo contatore si aggiorna di rado.", "Used by the drawings: digits roll and the flame lights up. Raise it if your meter updates rarely.")}</small></div>
    <div class="en2"><b>📊 ${t("Giorno medio", "Average day")}</b>
      <label class="fld1"><span>${t("Confronta oggi con la media degli ultimi", "Compare today with the average of the last")}</span><select data-chg="aqMedia">${GG_MEDIA.map(n => `<option value="${n}" ${ggMedia() === n ? "selected" : ""}>${t(`${n} giorni`, `${n} days`)}</option>`).join("")}</select></label>
      <small class="muted">${t("Serve per «come un giorno medio» e la tacca sulla barra di oggi, qui e nella Home. Con meno giorni segue di più la stagione.", "Used for «like an average day» and the mark on today's bar, here and on Home. Fewer days follow the season more closely.")}</small></div></div>`;
}
let RIAPRI = false;
const foglio = () => `<div class="sh-head"><div><h3>⚙️ ${t("Acqua e gas", "Water and gas")}</h3><div class="small muted">${t("Valgono per tutta la casa e solo nella plancia. Si salvano subito.", "They apply to the whole home and only in the dashboard. Saved immediately.")}</div></div><button class="x" data-act="sheetClose">×</button></div>${scelte()}`;
function cardModifica() {
  if (!UI.edit || !isAdmin()) return "";
  return card("✏️ " + t("Sensori, prezzi e avvisi", "Sensors, prices and alerts"), scelte(), { cls: "span3 aq1ed" });
}
function pagina() {
  if (!haAcquaGas()) return `<div class="g g3">${card("🚰 " + t("Acqua e gas", "Water and gas"), `<p class="small muted aq1nt">${t("Non trovo contatori dell'acqua o del gas. Aggiungili nella configurazione Energia di Home Assistant (Impostazioni → Plance → Energia: consumo di acqua e di gas)", "I can't find water or gas meters. Add them in Home Assistant's Energy configuration (Settings → Dashboards → Energy: water and gas consumption)")}${isAdmin() ? t(", oppure sceglili con ✏️ Modifica.", ", or choose them with ✏️ Edit.") : "."}</p>`, { cls: "span3" })}${cardModifica()}</div>`;
  return `<div class="g g3 aq1p">${haK("acqua") || haK("gas") ? hero() : ""}${cardPerdite()}${cardStorico()}${cardModifica()}</div>`;
}

/* ---------- azioni ---------- */
const dopo = () => { if (RIAPRI) setTimeout(() => openSheet(foglio), 60); };
Object.assign(ACT, {
  aqCfg: () => openSheet(foglio),
  aqStor: el => { sSet("aqStor", el.dataset.v); render(); },
  aqValv: el => {
    const id = el.dataset.id, apri = el.dataset.v === "apri";
    if (!sicuro(el, apri ? t("Tocca ancora per riaprire", "Tap again to turn on") : t("Tocca ancora: chiudo l'acqua", "Tap again: I'll shut off the water"))) return;
    const d = id.split(".")[0], p = d === "valve" ? svc("valve", apri ? "open_valve" : "close_valve", {}, { entity_id: id }) : svc(d, apri ? "turn_on" : "turn_off", {}, { entity_id: id });
    p.then(() => toast(apri ? "💧 " + t("Riapro l'acqua", "Turning the water back on") : "⛔ " + t("Chiudo l'acqua", "Shutting off the water"))).catch(() => {});
  },
  aqAdd: el => {
    const k = el.dataset.k, v = VOCI().find(x => x[0] === k); RIAPRI = !!UI.sheet;
    scegli({ titolo: v[1], sotto: t("Tutti quelli della casa: cerca per nome.", "Everything in the house: search by name."), filtro: id => v[2](id) && !(Array.isArray(sceltiDi(k)) && sceltiDi(k).includes(id)), attuale: null, auto: false,
      onPick: id => { if (!id || id === "none") return dopo(); aqCambia(c => { c[k] = v[3] ? [...new Set([...lista(c[k]), id])] : id; }, "＋ " + nm(id)).then(dopo); } });
  },
  aqDel: el => { const k = el.dataset.k, id = el.dataset.id; aqCambia(c => { if (Array.isArray(c[k])) { c[k] = c[k].filter(x => x !== id); if (!c[k].length) delete c[k]; } else delete c[k]; }, "✕ " + nm(id)); },
  aqAuto: el => { const k = el.dataset.k; aqCambia(c => { delete c[k]; }, "✨ " + t("Automatico", "Automatic")); },
  aqNo: el => { const k = el.dataset.k; aqCambia(c => { c[k] = "none"; }, "🚫 " + t("Non usato", "Not used")); },
  aqPTogli: el => { const id = el.dataset.id; aqCambia(c => { c.perditeExtra = (c.perditeExtra || []).filter(x => x !== id); if (!c.perditeExtra.length) delete c.perditeExtra; if (isSensPerdita(id)) c.perditeTolte = [...new Set([...(c.perditeTolte || []), id])]; }, "✕ " + nm(id)); },
  aqPRimetti: el => { const id = el.dataset.id; aqCambia(c => { c.perditeTolte = (c.perditeTolte || []).filter(x => x !== id); if (!c.perditeTolte.length) delete c.perditeTolte; }, "↺ " + nm(id)); },
  aqPAdd: () => { const qui = new Set(sensoriPerdita()); RIAPRI = !!UI.sheet;
    scegli({ titolo: "＋ " + t("Sensore di perdita", "Leak sensor"), sotto: t("Sensori sì/no della casa (acceso = acqua rilevata).", "Yes/no sensors in the house (on = water detected)."), auto: false, attuale: null,
      filtro: id => id.startsWith("binary_sensor.") && !qui.has(id),
      onPick: id => { if (!id || id === "none") return dopo(); aqCambia(c => { c.perditeTolte = (c.perditeTolte || []).filter(x => x !== id); if (!c.perditeTolte.length) delete c.perditeTolte; if (!isSensPerdita(id)) c.perditeExtra = [...new Set([...(c.perditeExtra || []), id])]; }, "＋ " + nm(id)).then(dopo); } }); },
  aqAvOn: () => aqCambia(c => { c.avviso = { ...(c.avviso || {}), on: !avvisoOn() }; }, avvisoOn() ? "🔕 " + t("Avviso spento", "Alert off") : "🔔 " + t("Avviso acceso", "Alert on")),
});
CHG.aqPrezzo = el => {
  const k = el.dataset.k, v = String(el.value).replace(",", ".").trim();
  if (v !== "" && (isNaN(+v) || +v < 0)) { toast(t("Scrivi un prezzo valido, per esempio 2,10", "Enter a valid price, e.g. 2.10"), true); el.value = C()[k] ?? ""; return; }
  aqCambia(c => { if (v === "") delete c[k]; else c[k] = Math.round(+v * 10000) / 10000; }, "💶 " + t("Salvato", "Saved"));
};
CHG.aqMedia = el => { const n = +el.value; aqCambia(c => { if (n === 30 || !GG_MEDIA.includes(n)) delete c.mediaGiorni; else c.mediaGiorni = n; }, "📊 " + t(`Media di ${n} giorni`, `${n}-day average`)); };
CHG.aqNum = el => {
  const f = el.dataset.f, v = +String(el.value).replace(",", "."), lim = { min: [10, 1440], portata: [0, 50], inUso: [1, 240] }[f];
  const cur = { min: minPerdita(), portata: portataMin(), inUso: minInUso() }[f];
  if (el.value === "" || isNaN(v) || v < lim[0] || v > lim[1]) { toast(t(`Scegli un numero da ${lim[0]} a ${lim[1]}`, `Pick a number from ${lim[0]} to ${lim[1]}`), true); el.value = cur; return; }
  const n = f === "portata" ? Math.round(v * 10) / 10 : Math.round(v);
  aqCambia(c => { if (f === "inUso") c.inUso = n; else c.avviso = { ...(c.avviso || {}), [f]: n }; }, "💾 " + fnum(n, f === "portata" ? 1 : 0));
};

/* ---------- Home: la scheda «Acqua e gas» ---------- */
function rigaHome(k, extra) {
  const dt = { ...dati(k), valv: k === "acqua" ? statoValvola(valvola()) : null }, { ids, M, ad } = dt;
  const O = ids.length ? oggi(k, ids, M) : null, md = ids.length ? media(ids, M) : null, vs = O?.base != null && md ? O.base / md : null;
  const sotto = [vs != null ? t(`${Math.round(vs * 100)}% di un giorno medio`, `${Math.round(vs * 100)}% of an average day`) : "", ad.on ? (k === "acqua" ? t("scorre", "flowing") : t("in uso", "in use")) : ""].filter(Boolean).join(" · ");
  return `<button class="aq1hr k-${k} ${ad.on ? "on" : ""} ${extra?.ko ? "ko" : ""}" data-act="go" data-id="acqua"><span class="aq1hi">${k === "acqua" ? scenaAcqua(dt, { xs: true, al: extra?.ko }) : scenaGas(dt, { xs: true })}</span>
    <span class="tx"><b>${KIND[k].ic} ${nomeK(k)} <em>${O ? (O.base == null ? (O.carica ? "…" : "—") : esc(qta(k, O.base, M))) : ""}</em></b><span>${O ? t("oggi", "today") + (sotto ? " · " + esc(sotto) : "") : esc(sotto)}</span></span>
    ${dt.f && ok(dt.f) ? `<i class="aq1hf">${esc(flussoTxt(k, dt.f))}</i>` : ""}</button>`;
}
function homeCard() {
  const A = haK("acqua"), G = haK("gas"), P = A ? perdita() : null, V = valvola(), sv = statoValvola(V), W = sensoriPerdita().filter(bagnato);
  const tags = [P ? `<span class="tag bad">⚠️ ${t("Possibile perdita: scorre da ", "Possible leak: flowing for ")}${esc(durata((Date.now() - P.da) / 1000))}</span>` : "",
    ...W.slice(0, 2).map(id => `<span class="tag bad">🚨 ${esc(nm(id))}</span>`),
    sv === "chiusa" ? `<span class="tag warn">⛔ ${t("acqua chiusa", "water shut off")}</span>` : ""].filter(Boolean);
  return card("🚰 " + t("Acqua e gas", "Water and gas"), `<div class="aq1hl">${A ? rigaHome("acqua", { ko: !!P }) : ""}${G ? rigaHome("gas") : ""}</div>${tags.length ? `<div class="aq1ht">${tags.join("")}</div>` : ""}`, { link: [t("Dettagli", "Details"), "acqua"] });
}
HOME_EXTRA.acqua = { title: () => t("Acqua e gas", "Water and gas"), render: homeCard, show: () => pagAttiva() && (contatori("acqua").ids.length > 0 || contatori("gas").ids.length > 0) };
/** avvisi della Home (avvisi.js): possibile perdita dal sensore di portata; i sensori di perdita «moisture» sono già negli avvisi di Sicurezza */
VISTE.acquaAvvisi = () => {
  if (!haAcquaGas()) return [];   // anche con la pagina spenta: una perdita va segnalata (porta al sensore)
  const out = [], vai = pagAttiva() ? { go: "acqua" } : null;
  const P = avvisoOn() ? perdita() : null;
  if (P) out.push({ k: "aq:perdita:" + Math.round(P.da / MIN), ic: "💧", b: t("Possibile perdita d'acqua", "Possible water leak"),
    s: t("l'acqua scorre da ", "water has been flowing for ") + esc(durata((Date.now() - P.da) / 1000)) + " · " + esc(flussoTxt("acqua", flusso("acqua"))), ...(vai || { id: flusso("acqua") }), cls: "alert" });
  for (const id of sensoriPerdita()) if (bagnato(id) && deviceClass(id) !== "moisture" && deviceClass(id) !== "safety")
    out.push({ k: "aq:sp:" + id + S[id].last_changed, ic: "💧", b: esc(nm(id)), s: t("acqua rilevata", "water detected") + " · " + esc(ago(S[id].last_changed)), ...(vai || { id }), cls: "alert" });
  return out;
};
/** la valvola dell'acqua sta in questa pagina (non si ripete nelle Prese) */
VISTE.acquaDisp = () => { try { return pagAttiva() && valvola() ? new Set([valvola()]) : new Set(); } catch { return new Set(); } };

page("acqua", { title: t("Acqua e gas", "Water and gas"), short: t("Acqua", "Water"), icon: "🚰", order: 16, editable: true,
  show: () => haAcquaGas() || isAdmin(),
  badge: () => { try { return !!perdita() || sensoriPerdita().some(bagnato); } catch { return false; } }, render: pagina });

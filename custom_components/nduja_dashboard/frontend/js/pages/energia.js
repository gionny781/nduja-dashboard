/* Energia: «Adesso» come scena animata (cielo, meteo, casa, batteria, rete, auto, elettrodomestici accesi; scenaenergia.js),
   totali di oggi, storico e costi, consumi dei dispositivi.
   I sensori si trovano da soli: prima le scelte dell'utente (✏️ Modifica → ⚙️ Sensori), poi le opzioni
   dell'integrazione, poi la configurazione «Energia» di Home Assistant, infine i nomi dei sensori.
   Segni: rete + = prelievo / − = immissione; batteria + = scarica / − = carica (come Home Assistant). */
import { S, ACT, CHG, LAYOUT, UI, STRIP, t, LOC, esc, fnum, nm, ok, val, attr, W, watts, ws, cached, card, empty, page, isAdmin,
  saveLayout, toast, openSheet, closeSheet, render, allEnts, deviceClass, REG, DEVICES, VISTE } from "../core.js";
import { scegli, cambia } from "../edit.js";
import { statistiche, barre } from "../grafici.js";
import { scena, intestazione, etichette } from "../scenaenergia.js";
import { auto, ricarica } from "./auto.js";

/* ---------- da dove leggo ---------- */
const prefs = () => cached("energy:prefs", 10 * 60000, () => ws({ type: "energy/get_prefs" }).catch(() => ({}))) || {};
function rateDaPrefs(tipo) {
  const P = prefs(), src = (P.energy_sources || []).filter(s => s.type === tipo);
  for (const s of src) {
    if (s.stat_rate) return s.stat_rate;
    for (const k of ["power", "flow_from", "flow_to"]) for (const x of (s[k] || [])) if (x?.stat_rate) return x.stat_rate;
  }
  return null;
}
const potenze = () => allEnts("sensor", id => deviceClass(id) === "power");
/* sensori da non usare mai per il flusso: previsioni, stime, valori futuri */
const PREVISIONE = /forecast|previs|stimat|estimat|next|prossim|tomorrow|domani|_\d+h|hour|ora\b/i;
/** dispositivo dei sensori di energia scelti nella configurazione Energia (per riconoscere l'inverter) */
function dispositiviPrefs(tipo) {
  const P = prefs(), out = new Set();
  for (const s of (P.energy_sources || []).filter(x => x.type === tipo))
    for (const id of [s.stat_energy_from, s.stat_energy_to, ...(s.flow_from || []).map(f => f.stat_energy_from), ...(s.flow_to || []).map(f => f.stat_energy_to)])
      if (id && REG[id]?.device) out.add(REG[id].device);
  return out;
}
/** sceglie il sensore più adatto: nome giusto, stesso dispositivo dell'impianto, niente previsioni */
function cerca(re, tipo, bonusDev = 3) {
  const dev = tipo ? dispositiviPrefs(tipo) : new Set();
  let best = null, top = 0;
  for (const id of potenze()) {
    const n = id + " " + nm(id); if (PREVISIONE.test(n)) continue;
    let sc = re.test(n) ? 2 : 0; if (!sc) continue;
    if (dev.has(REG[id]?.device)) sc += bonusDev;
    if (/total|totale|instant|generat|attuale|now\b/i.test(n)) sc += 1;
    if (!tipo && /house|home|casa/i.test(n)) sc += 1;
    if (/pv\s?[12]\b|pv[12]_|string|stringa|mppt/i.test(n)) sc -= 1;
    if (ok(id)) sc += .5;
    if (sc > top) { top = sc; best = id; }
  }
  return best;
}
/** valore scelto dall'utente per un ruolo: sempre una lista (anche se salvato come stringa) */
const lista = v => (Array.isArray(v) ? v : v ? [v] : []).filter(id => S[id]);
/** sensori scelti a mano per un ruolo (vuoto = automatico) */
export const scelti = k => lista((LAYOUT.energy || {})[k]);
/** sensore usato per ogni ruolo */
export function sensori() {
  const E = LAYOUT.energy || {}, O = UI.opt || {};
  const pick = (k, opt, tipo, re, bonus) => scelti(k)[0] || O[opt] || (tipo && rateDaPrefs(tipo)) || (re && cerca(re, tipo, bonus)) || null;
  return {
    pv: pick("pv", "pv_power", "solar", /solar|solare|fotovolt|photovolt|\bpv|produzione|production|generat/i, 3),
    grid: pick("grid", "grid_power", "grid", /\bgrid|\brete\b|_rete\b|scambio|contatore|meter\b/i, 1),
    battery: pick("battery", "battery_power", "battery", /batter/i, 3),
    soc: scelti("soc")[0] || O.battery_soc || allEnts("sensor", id => deviceClass(id) === "battery" && /inverter|storage|accumul|batteria_casa|home_battery|zcs|solis|huawei|growatt|sofar|fronius|victron|deye|sunsynk|soc\b|_soc/i.test(id + nm(id)) && !/iphone|ipad|phone|pixel|galaxy|watch|tablet|[._]tab[._]|remote|porta|door|window|finestra/i.test(id + nm(id)))[0] || null,
    home: scelti("home")[0] || O.home_power || cerca(/house|home|\bcasa\b|_casa|load|consumo|consumption/i, null) || null,
    gridInv: !!E.gridInv, batInv: !!E.batInv,
  };
}
/* se il sensore del sole è una sola stringa (PV1), sommo le altre stringhe dello stesso inverter */
function stringhe(id) {
  if (scelti("pv").length) return scelti("pv");
  if (!id || !/pv\s?_?1\b|pv1|string.?1|stringa.?1|mppt.?1/i.test(id + " " + nm(id))) return [id];
  const dev = REG[id]?.device;
  const altre = potenze().filter(x => x !== id && REG[x]?.device === dev && /pv\s?_?[2-9]\b|pv[2-9]|string.?[2-9]|stringa.?[2-9]|mppt.?[2-9]/i.test(x + " " + nm(x)));
  return [id, ...altre];
}
export function letture() {
  const s = sensori(), somma = (k, primo) => { const L = scelti(k).length ? scelti(k) : primo ? [primo] : []; const v = L.map(W).filter(x => x != null); return v.length ? v.reduce((a, x) => a + x, 0) : null; };
  const g = somma("grid", s.grid), b = somma("battery", s.battery);
  const pvL = s.pv ? stringhe(s.pv).map(W).filter(v => v != null) : [], pv = s.pv ? Math.max(0, pvL.reduce((a, v) => a + v, 0)) : null;
  const rete = g == null ? null : s.gridInv ? -g : g, bat = b == null ? null : s.batInv ? -b : b;
  let casa = somma("home", s.home);
  if (casa == null && (pv != null || rete != null)) casa = Math.max(0, (pv || 0) + (rete || 0) + (bat || 0));
  const socL = scelti("soc").length ? scelti("soc") : s.soc ? [s.soc] : [], socV = socL.map(val).filter(x => x != null);
  return { s, pv, pvL: s.pv ? stringhe(s.pv).map(id => ({ id, w: W(id) })) : [], rete, bat, casa, soc: socV.length ? socV.reduce((a, x) => a + x, 0) / socV.length : null };
}
export const haEnergia = () => { const s = sensori(); return !!(s.pv || s.grid || s.battery || s.home); };

/* ---------- totali di oggi dalle statistiche ---------- */
/** kWh di oggi di un contatore: se è già un contatore giornaliero (today/daily/oggi) uso il suo valore,
    altrimenti quanto è cresciuto da mezzanotte nelle statistiche di Home Assistant */
const GIORNO = /today|daily|oggi|giorn|_day\b|day_/i;
const kwh = id => { const v = val(id); if (v == null) return null; const u = String(attr(id, "unit_of_measurement") || "").toLowerCase(); return u === "wh" ? v / 1000 : u === "mwh" ? v * 1000 : v; };
const statOggi = id => cached("estat:" + id, 5 * 60000, () => ws({ type: "recorder/statistic_during_period", statistic_id: id, calendar: { period: "day" }, types: ["change"] })
  .then(r => r?.change ?? null).catch(e => { console.warn("nduja energia", id, e); return null; }));
export const oggi = id => {
  if (!id) return null;
  if (S[id] && GIORNO.test(id + " " + nm(id)) && kwh(id) != null) return kwh(id);
  const v = statOggi(id);
  return v != null ? v : null;
};
export function totali() {
  const P = prefs(), src = P.energy_sources || [], sum = ids => { const v = ids.map(oggi).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const grid = src.filter(s => s.type === "grid"), sol = src.filter(s => s.type === "solar"), bat = src.filter(s => s.type === "battery");
  const own = k => scelti(k).length ? sum(scelti(k)) : undefined;
  const imp = own("impKwh") !== undefined ? own("impKwh") : sum(grid.flatMap(g => [...(g.flow_from || []).map(f => f.stat_energy_from), g.stat_energy_from].filter(Boolean)));
  const exp = own("expKwh") !== undefined ? own("expKwh") : sum(grid.flatMap(g => [...(g.flow_to || []).map(f => f.stat_energy_to), g.stat_energy_to].filter(Boolean)));
  const pv = own("pvKwh") !== undefined ? own("pvKwh") : sum(sol.map(s => s.stat_energy_from).filter(Boolean));
  const bOut = sum(bat.map(s => s.stat_energy_from).filter(Boolean)), bIn = sum(bat.map(s => s.stat_energy_to).filter(Boolean));
  const casa = (pv != null || imp != null) ? Math.max(0, (pv || 0) + (imp || 0) - (exp || 0) + (bOut || 0) - (bIn || 0)) : null;
  return { imp, exp, pv, bOut, bIn, casa, ok: src.length > 0 || ["pvKwh", "impKwh", "expKwh"].some(k => scelti(k).length) };
}

/* ---------- adesso: la scena animata (scenaenergia.js) ---------- */
/** come si divide l'energia in questo momento (W): da dove arriva e dove va */
export function ripartisci({ pv, rete, bat }) {
  const P = Math.max(0, pv || 0), imp = Math.max(0, rete || 0), exp = Math.max(0, -(rete || 0)), car = Math.max(0, -(bat || 0)), sc = Math.max(0, bat || 0);
  const solBat = Math.min(P, car), solRete = Math.min(P - solBat, exp), solCasa = Math.max(0, P - solBat - solRete);
  const reteBat = Math.min(imp, car - solBat), reteCasa = imp - reteBat;
  const batRete = Math.min(sc, exp - solRete), batCasa = sc - batRete;
  return { solCasa, solBat, solRete, reteCasa, reteBat, batCasa, batRete };
}
/** potenza più alta del fotovoltaico negli ultimi 30 giorni (statistiche), per far brillare i pannelli in proporzione */
let maxVisto = 0;
function picco(ids, pv) {
  maxVisto = Math.max(maxVisto, pv || 0);
  const k = id => { const u = String(attr(id, "unit_of_measurement") || "").toLowerCase(); return u === "kw" ? 1000 : u === "mw" ? 1e6 : 1; };
  const r = ids.length ? cached("enPicco:" + ids.join(","), 3 * 3600e3, () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 30);
    return ws({ type: "recorder/statistics_during_period", start_time: d.toISOString(), statistic_ids: ids, period: "day", types: ["max"] }).catch(() => ({})); }) : null;
  const st = ids.reduce((a, id) => a + Math.max(0, ...(r?.[id] || []).map(x => +x.max || 0)) * k(id), 0);
  return Math.max(st, maxVisto, 800);
}
/** l'auto da mostrare davanti a casa: prima quella in carica, poi quella collegata; solo se è a casa */
function autoACasa() {
  const L = auto().map(ricarica).filter(a => a.casa === true || (a.casa == null && (a.ric || a.spina)));
  return L.find(a => a.ric) || L.find(a => a.spina) || L[0] || null;
}
/** riepilogo in parole semplici: «Il sole copre il 78% dei consumi, stai immettendo 1,2 kW.» */
function riepilogo(Lt, F, A) {
  const { pv, rete, casa, soc } = Lt, C = casa || 0, imp = Math.max(0, rete || 0), exp = Math.max(0, -(rete || 0));
  const pct = v => Math.round(Math.min(100, v / C * 100)), parti = [];
  let tuttaRete = false;
  if (C > 20) {
    const sol = (pv || 0) > 20 ? pct(F.solCasa) : 0, bt = pct(F.batCasa);
    if (sol >= 99) parti.push(t("Il sole copre tutti i consumi", "The sun covers everything the house uses"));
    else if (sol > 0) parti.push(t(`Il sole copre il ${sol}% dei consumi`, `The sun covers ${sol}% of what the house uses`) + (bt >= 5 ? t(`, la batteria il ${bt}%`, `, the battery ${bt}%`) : ""));
    else if (bt >= 99) parti.push(t("La batteria copre tutti i consumi", "The battery covers everything the house uses"));
    else if (bt > 0) parti.push(t(`La batteria copre il ${bt}% dei consumi`, `The battery covers ${bt}% of what the house uses`));
    else if (imp > 20) { tuttaRete = true; parti.push(t(`La casa usa ${watts(C)}, tutti dalla rete`, `The house uses ${watts(C)}, all from the grid`)); }
    else parti.push(t(`La casa usa ${watts(C)}`, `The house uses ${watts(C)}`));
  } else if ((pv || 0) > 20) parti.push(t(`Il sole produce ${watts(pv)}`, `The sun is producing ${watts(pv)}`));
  if (exp > 20) parti.push(t(`stai immettendo ${watts(exp)}`, `you're exporting ${watts(exp)}`));
  else if (imp > 20 && !tuttaRete) parti.push(t(`prelevi ${watts(imp)} dalla rete`, `you're drawing ${watts(imp)} from the grid`));
  const altro = [];
  if ((Lt.bat || 0) < -20) altro.push(t(`La batteria si sta caricando${soc != null ? ` (${Math.round(soc)}%)` : ""}.`, `The battery is charging${soc != null ? ` (${Math.round(soc)}%)` : ""}.`));
  if (A?.ric) altro.push(t(`${A.nome} si ricarica${A.w ? " a " + watts(A.w) : ""}.`, `${A.nome} is charging${A.w ? " at " + watts(A.w) : ""}.`));
  return { frase: parti.length ? parti.join(", ") + "." : "", altro: altro.join(" ") };
}
/** elettrodomestici accesi (dalla pagina Elettrodomestici), quelli che consumano di più in evidenza */
function accesi(casa) {
  const L = VISTE.elettroAccesi?.(); if (!L) return "";
  if (!L.length) return `<div class="en7a"><div class="small muted">🧺 ${t("Nessun elettrodomestico acceso adesso.", "No appliances running right now.")}</div></div>`;
  const tot = casa > 0 ? casa : null, max = Math.max(...L.map(a => a.w || 0), 1);
  return `<div class="en7a"><div class="en7ah">🧺 ${t("Elettrodomestici accesi", "Appliances running")}</div><div class="en7al">${L.map((a, i) => {
    const q = a.w != null && tot ? Math.round(Math.min(100, a.w / tot * 100)) : null, top = a.w != null && a.w > 20 && (i === 0 || (q != null && q >= 25));
    const barra = a.w != null ? (q != null ? q : Math.round(a.w / max * 100)) : 0;
    return `<button class="en7ai ${top ? "top" : ""}" data-act="apGo">${a.vista(top ? "md" : "sm", "en" + i)}<span class="tx"><b>${esc(a.nome)}</b>
      <span>${a.w != null ? `<em>${watts(a.w)}</em>${q != null ? ` · ${q}%<span class="en7q">${t(" della casa", " of the house")}</span>` : ""}` : t("in funzione", "running")}</span><i><u style="width:${barra}%"></u></i></span></button>`; }).join("")}</div></div>`;
}
function adesso() {
  const Lt = letture(), { s, pv, rete, bat, casa, soc } = Lt, haPv = !!s.pv, haBat = !!(s.battery || s.soc), haRete = rete != null || !!s.grid;
  const F = ripartisci(Lt), A = autoACasa(), stretto = window.innerWidth < 700;
  const { frase, altro } = riepilogo(Lt, F, A);
  const pvIds = haPv ? stringhe(s.pv) : [];
  const sc = scena({ stretto, pv, haPv, rete, haRete, bat, haBat, soc, casa, F, auto: A, picco: haPv ? picco(pvIds, pv) : 1, titolo: frase || t("Energia adesso", "Energy now") });
  const soci = scelti("soc").length ? scelti("soc") : s.soc ? [s.soc] : [], primo = L => L[0] || null;
  const E = [
    haPv && { k: "pv", id: primo(pvIds), ic: "☀️", v: watts(pv), s: t("produzione", "solar"), cls: "sol" },
    haRete && { k: "rete", id: primo(scelti("grid").length ? scelti("grid") : [s.grid]), ic: rete > 20 ? "↓" : rete < -20 ? "↑" : "⚡", v: watts(rete == null ? null : Math.abs(rete)),
      s: rete > 20 ? t("prelievo", "import") : rete < -20 ? t("immissione", "export") : t("rete in pari", "grid idle"), cls: rete > 20 ? "imp" : rete < -20 ? "exp" : "" },
    { k: "casa", id: primo(scelti("home").length ? scelti("home") : [s.home]), ic: "🏠", v: watts(casa), s: t("consumo", "use"), cls: "casa" },
    haBat && { k: "bat", id: primo(soci) || primo(scelti("battery").length ? scelti("battery") : [s.battery]), ic: "🔋", v: soc == null ? watts(bat == null ? null : Math.abs(bat)) : Math.round(soc) + "%",
      s: bat < -20 ? t("in carica", "charging") + (soc != null ? " · " + watts(-bat) : "") : bat > 20 ? t("in uso", "in use") + (soc != null ? " · " + watts(bat) : "") : t("ferma", "idle"), cls: "bat" },
    A && { k: "auto", id: A.id, ic: "🚗", v: A.b != null ? Math.round(A.b) + "%" : esc(A.nome), s: A.ric ? "⚡ " + (A.w ? watts(A.w) : t("in carica", "charging")) : A.spina ? t("collegata", "plugged in") : t("a casa", "home"), cls: "ev" },
  ].filter(Boolean);
  return `<section class="card span3 en7c"><div class="ch"><h2>⚡ ${t("Adesso", "Now")}</h2><span class="muted small">${esc(intestazione(sc.sole, sc.meteo))}</span></div>
    ${frase ? `<div class="en7r">${esc(frase)}${altro ? `<small>${esc(altro)}</small>` : ""}</div>` : ""}
    <div class="en7 ${stretto ? "tel" : ""}">${sc.html}${stretto ? "" : etichette(E, sc.g)}</div>
    ${stretto ? `<div class="en7t">${etichette(E, null)}</div>` : ""}
    ${accesi(casa)}
    ${!haEnergia() ? `<div class="note1">${t("Non ho trovato i sensori dell'energia. Configurali in Home Assistant (Impostazioni → Plance → Energia) oppure con ✏️ Modifica → ⚙️ Sensori.", "No energy sensors found. Set them up in Home Assistant (Settings → Dashboards → Energy) or with ✏️ Edit → ⚙️ Sensors.")}</div>` : ""}</section>`;
}
window.addEventListener("resize", () => { clearTimeout(window.__enR); window.__enR = setTimeout(() => render(true), 300); });

/* ---------- oggi ---------- */
function cardOggi() {
  const T = totali(); if (!T.ok) return "";
  const k = v => v == null ? "—" : fnum(v, 2) + " kWh";
  const auto = T.pv ? Math.round(Math.max(0, T.pv - (T.exp || 0)) / T.pv * 100) : null, suff = T.casa ? Math.round(Math.max(0, T.casa - (T.imp || 0)) / T.casa * 100) : null;
  return card("📅 " + t("Oggi", "Today"), `<div class="og68">
    <div><small>${t("Prodotto", "Produced")}</small><b style="color:#ffd60a">${k(T.pv)}</b></div><div><small>${t("Consumato", "Consumed")}</small><b style="color:#64d2ff">${k(T.casa)}</b></div>
    <div><small>${t("Prelevato", "Imported")}</small><b style="color:#ff6961">${k(T.imp)}</b></div><div><small>${t("Immesso", "Exported")}</small><b style="color:#30d158">${k(T.exp)}</b></div>
    ${auto != null ? `<div><small>${t("Autoconsumo", "Self-consumption")}</small><b>${auto}%</b></div>` : ""}${suff != null ? `<div><small>${t("Autosufficienza", "Self-sufficiency")}</small><b>${suff}%</b></div>` : ""}
    ${prezzi().compra != null && T.imp != null ? `<div><small>${t("Spesa di oggi", "Today's cost")}</small><b>${euro(T.imp * prezzi().compra - (T.exp || 0) * (prezzi().vende || 0))}</b></div>` : ""}
    ${T.bIn != null ? `<div><small>${t("Batteria caricata", "Battery charged")}</small><b>${k(T.bIn)}</b></div><div><small>${t("Batteria scaricata", "Battery discharged")}</small><b>${k(T.bOut)}</b></div>` : ""}
  </div>`);
}

/* ---------- consumi dei dispositivi ---------- */
function consumi() {
  const P = prefs(), dc = (P.device_consumption || []).map(d => d.stat_consumption).filter(Boolean);
  const nomeD = id => esc(S[id] ? nm(id) : id.split(".").pop().replace(/_/g, " "));
  /* oggi in kWh (dalla configurazione Energia) */
  const giorno = dc.map(id => ({ id, v: oggi(id) })).filter(r => r.v != null && r.v > 0.005).sort((a, b) => b.v - a.v);
  /* adesso in W: sensori di potenza dei dispositivi (non quelli dell'impianto) */
  const s = sensori(), escl = [s.pv, s.grid, s.battery, s.home].filter(Boolean);
  const ora = potenze().filter(id => !escl.includes(id) && ok(id) && (W(id) || 0) > 1 && !/inverter|grid|rete|solar|pv|batter|total|totale|house|casa_consumo|consumo_casa/i.test(id)).map(id => ({ id, w: W(id) })).sort((a, b) => b.w - a.w).slice(0, 12);
  if (!giorno.length && !ora.length) return "";
  const maxG = Math.max(...giorno.map(r => r.v), 0.01), maxW = Math.max(...ora.map(r => r.w), 1);
  return `${ora.length ? card("🔌 " + t("Chi consuma adesso", "Using power now"), `<div class="stack">${ora.map(r => `<button class="cn1" data-act="more" data-id="${r.id}"><span>${nomeD(r.id)}</span><i><b style="width:${(r.w / maxW * 100).toFixed(1)}%"></b></i><em>${watts(r.w)}</em></button>`).join("")}</div>`) : ""}
    ${giorno.length ? card("📊 " + t("Consumi di oggi", "Today's consumption"), `<div class="stack">${giorno.slice(0, 12).map(r => `<button class="cn1" data-act="more" data-id="${r.id}"><span>${nomeD(r.id)}</span><i><b style="width:${(r.v / maxG * 100).toFixed(1)}%;background:#64d2ff"></b></i><em>${fnum(r.v, 2)} kWh</em></button>`).join("")}</div>`) : ""}`;
}

/* ---------- scelta dei sensori: qualsiasi sensore, anche più di uno per voce (si sommano) ---------- */
const numerico = id => id.startsWith("sensor.") && S[id] && (ok(id) ? !isNaN(parseFloat(S[id].state)) : true);
const potenza = id => numerico(id) && (deviceClass(id) === "power" || /^(m|k)?w$/i.test(attr(id, "unit_of_measurement") || ""));
const energia = id => numerico(id) && (deviceClass(id) === "energy" || /wh$/i.test(attr(id, "unit_of_measurement") || ""));
const VOCI = () => [
  ["pv", "☀️ " + t("Fotovoltaico (una riga per stringa o inverter)", "Solar (one row per string or inverter)"), potenza, t("Aggiungi una stringa per volta: le sommo io.", "Add one string at a time: I add them up.")],
  ["grid", "🔌 " + t("Rete", "Grid"), potenza, t("Positivo quando prelevi, negativo quando immetti.", "Positive when importing, negative when exporting."), "gridInv"],
  ["home", "🏠 " + t("Consumo casa", "Home consumption"), potenza, t("Se non lo scegli lo calcolo: sole + rete + batteria.", "If not chosen I calculate it: solar + grid + battery.")],
  ["battery", "🔋 " + t("Potenza batteria", "Battery power"), potenza, t("Positivo quando si scarica, negativo quando si carica. Più batterie si sommano.", "Positive when discharging, negative when charging. Several batteries are added up."), "batInv"],
  ["soc", "🔋 " + t("Carica batteria (%)", "Battery charge (%)"), numerico, t("Con più batterie faccio la media.", "With several batteries I use the average.")],
  ["pvKwh", "📅 " + t("Prodotto oggi (kWh)", "Produced today (kWh)"), energia, t("Contatori di energia: uso quanto sono cresciuti da mezzanotte.", "Energy meters: I use how much they grew since midnight.")],
  ["impKwh", "📅 " + t("Prelevato oggi (kWh)", "Imported today (kWh)"), energia],
  ["expKwh", "📅 " + t("Immesso oggi (kWh)", "Exported today (kWh)"), energia],
];
function scheda() {
  const s = sensori(), E = LAYOUT.energy || {};
  const auto = k => k === "pv" ? (s.pv ? stringhe(s.pv) : []) : ["pvKwh", "impKwh", "expKwh"].includes(k) ? [] : s[k] ? [s[k]] : [];
  const voce = ([k, label, , help, inv]) => { const L = scelti(k), A = L.length ? [] : auto(k);
    return `<div class="en2"><div class="row between"><b>${label}</b>${L.length ? `<button class="btn sm" data-act="enAuto" data-k="${k}">✨ ${t("Automatico", "Automatic")}</button>` : ""}</div>
      ${help ? `<small class="muted">${help}</small>` : ""}
      <div class="stack" style="margin-top:8px">${L.map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)} · ${ok(id) ? esc(S[id].state) + " " + esc(attr(id, "unit_of_measurement") || "") : "—"}</span></div><button class="x3" data-act="enDel" data-k="${k}" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button></div>`).join("")}
        ${!L.length ? `<div class="small muted">✨ ${A.length ? t("Automatico: ", "Automatic: ") + A.map(id => esc(nm(id))).join(" + ") : t("Automatico: niente trovato", "Automatic: nothing found")}</div>` : ""}
        <button class="add1" data-act="enAdd" data-k="${k}"><span>＋</span>${L.length ? t("Aggiungi un altro sensore", "Add another sensor") : t("Scegli il sensore", "Choose the sensor")}</button></div>
      ${inv ? `<label class="row" style="gap:8px;margin-top:8px;font-size:13px"><input type="checkbox" data-chg="enInv" data-k="${inv}" ${E[inv] ? "checked" : ""}> ${t("Il mio sensore ha i segni al contrario", "My sensor has the opposite sign")}</label>` : ""}</div>`; };
  return `<div class="sh-head"><div><h3>⚙️ ${t("Sensori dell'energia", "Energy sensors")}</h3><div class="small muted">${t("Puoi scegliere qualsiasi sensore della casa. Le modifiche si salvano subito.", "You can choose any sensor in the house. Changes save immediately.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${VOCI().map(voce).join("")}
    <div class="en2"><b>💶 ${t("Prezzi (facoltativi)", "Prices (optional)")}</b><small class="muted"> ${t("Vuoto = quelli della configurazione Energia.", "Empty = those of the Energy configuration.")}</small>
      <div class="row" style="gap:10px"><label class="fld1" style="flex:1"><span>${t("Prelievo €/kWh", "Import €/kWh")}</span><input type="number" step="0.001" min="0" value="${esc(E.prezzo ?? "")}" data-chg="enPrezzo" data-k="prezzo" placeholder="${prezzi().compra ?? ""}"></label>
      <label class="fld1" style="flex:1"><span>${t("Immissione €/kWh", "Export €/kWh")}</span><input type="number" step="0.001" min="0" value="${esc(E.prezzoVendita ?? "")}" data-chg="enPrezzo" data-k="prezzoVendita" placeholder="${prezzi().vende ?? ""}"></label></div></div>`;
}
const salvaE = (fn, msg) => cambia(l => { l.energy = { ...(l.energy || {}) }; fn(l.energy); }, msg).then(() => { if (!UI.sheet) openSheet(scheda); });
CHG.enPrezzo = el => salvaE(e => { if (el.value === "") delete e[el.dataset.k]; else e[el.dataset.k] = +el.value; }, "💶 " + t("Salvato", "Saved"));
CHG.enInv = el => salvaE(e => { e[el.dataset.k] = el.checked; });
Object.assign(ACT, {
  enSensors: () => openSheet(scheda),
  enAdd: el => { const k = el.dataset.k, v = VOCI().find(x => x[0] === k);
    scegli({ titolo: v[1], sotto: t("Tutti i sensori della casa: cerca per nome (es. «pv2», «stringa», «inverter»).", "Every sensor in the house: search by name (e.g. «pv2», «string», «inverter»)."), filtro: v[2], attuale: null, auto: false,
      onPick: id => id && salvaE(e => { e[k] = [...new Set([...lista(e[k]), id])]; }, "＋ " + nm(id)) }); },
  enDel: el => { const k = el.dataset.k, id = el.dataset.id; salvaE(e => { e[k] = lista(e[k]).filter(x => x !== id); if (!e[k].length) delete e[k]; }); },
  enAuto: el => { const k = el.dataset.k; salvaE(e => { delete e[k]; }); },
});

/* stringhe del fotovoltaico, una per riga */
function cardStringhe() {
  const { pvL, pv } = letture(); if (pvL.length < 2) return "";
  const max = Math.max(...pvL.map(x => x.w || 0), 1);
  return card("☀️ " + t("Stringhe", "Strings"), `<div class="stack">${pvL.map(x => `<button class="cn1" data-act="more" data-id="${x.id}"><span>${esc(nm(x.id))}</span><i><b style="width:${((x.w || 0) / max * 100).toFixed(1)}%;background:#ffd60a"></b></i><em>${watts(x.w)}</em></button>`).join("")}
    <div class="row between" style="margin-top:4px"><b>${t("Totale", "Total")}</b><b>${watts(pv)}</b></div></div>`, { right: isAdmin() ? `<button class="btn sm" data-act="enSensors">⚙️</button>` : "" });
}

/* ---------- storico e costi: settimana, mese, anno ---------- */
function idsEnergia() {
  const P = prefs(), src = P.energy_sources || [], grid = src.filter(x => x.type === "grid");
  const own = k => scelti(k).length ? scelti(k) : null;
  return {
    pv: own("pvKwh") || src.filter(x => x.type === "solar").map(x => x.stat_energy_from).filter(Boolean),
    imp: own("impKwh") || grid.flatMap(g => [...(g.flow_from || []).map(f => f.stat_energy_from), g.stat_energy_from]).filter(Boolean),
    exp: own("expKwh") || grid.flatMap(g => [...(g.flow_to || []).map(f => f.stat_energy_to), g.stat_energy_to]).filter(Boolean),
  };
}
/** prezzi €/kWh: dalla configurazione Energia (numero fisso o sensore del prezzo), oppure scelti in ⚙️ */
function prezzi() {
  const E = LAYOUT.energy || {}, g = (prefs().energy_sources || []).find(x => x.type === "grid") || {};
  const num = (n, ent) => n != null ? +n : ent && S[ent] ? val(ent) : null;
  return { compra: E.prezzo != null && E.prezzo !== "" ? +E.prezzo : num(g.number_energy_price, g.entity_energy_price), vende: E.prezzoVendita != null && E.prezzoVendita !== "" ? +E.prezzoVendita : num(g.number_energy_price_export, g.entity_energy_price_export) };
}
const euro = v => v == null || isNaN(v) ? "—" : v.toLocaleString(LOC, { style: "currency", currency: "EUR" });
const VS = { p: "settimana" };
function cardStorico() {
  const I = idsEnergia(), tutti = [...I.pv, ...I.imp, ...I.exp]; if (!tutti.length) return "";
  const [giorni, periodo] = { settimana: [7, "day"], mese: [30, "day"], anno: [365, "month"] }[VS.p];
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - giorni + 1); if (periodo === "month") start.setDate(1);
  const r = statistiche(tutti, start, periodo, ["change"]);
  const somma = ids => { const m = {}; for (const id of ids) for (const p of (r?.[id] || [])) m[p.start] = (m[p.start] || 0) + (p.change || 0); return Object.entries(m).map(([x, v]) => ({ x: +x, v: Math.max(0, v) })); };
  const pv = somma(I.pv), imp = somma(I.imp), exp = somma(I.exp), tot = L => L.reduce((a, q) => a + q.v, 0);
  const pr = prezzi(), spesa = pr.compra != null ? tot(imp) * pr.compra : null, guad = pr.vende != null ? tot(exp) * pr.vende : null;
  const risp = pr.compra != null && I.pv.length ? Math.max(0, tot(pv) - tot(exp)) * pr.compra : null;
  return card("📊 " + t("Storico e costi", "History and costs"), `
    <div class="seg" style="margin-bottom:10px">${[["settimana", t("Settimana", "Week")], ["mese", t("Mese", "Month")], ["anno", t("Anno", "Year")]].map(([k, n]) => `<button class="${VS.p === k ? "act" : ""}" data-act="enStor" data-v="${k}">${n}</button>`).join("")}</div>
    ${r === undefined ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : barre([...(I.pv.length ? [{ nome: t("Prodotto", "Produced"), colore: "#ffd60a", valori: pv }] : []), { nome: t("Prelevato", "Imported"), colore: "#ff6961", valori: imp }, { nome: t("Immesso", "Exported"), colore: "#30d158", valori: exp }], { u: "kWh", periodo })}
    <div class="og68" style="margin-top:12px">
      <div><small>${t("Spesa in bolletta", "Grid cost")}</small><b style="color:#ff6961">${euro(spesa)}</b></div>
      <div><small>${t("Guadagno immissione", "Export earnings")}</small><b style="color:#30d158">${euro(guad)}</b></div>
      ${risp != null ? `<div><small>${t("Risparmio dal sole", "Saved by solar")}</small><b style="color:#ffd60a">${euro(risp)}</b></div>` : ""}
      <div><small>${t("Netto", "Net")}</small><b>${euro(spesa != null ? spesa - (guad || 0) : null)}</b></div>
    </div>
    ${pr.compra == null ? `<div class="small muted" style="margin-top:8px">${t("Per i costi imposta il prezzo in ⚙️ Sensori o nella configurazione Energia di Home Assistant.", "For costs set the price in ⚙️ Sensors or in Home Assistant's Energy configuration.")}</div>` : `<div class="small muted" style="margin-top:8px">${t("Prezzi", "Prices")}: ${euro(pr.compra)}/kWh ${t("prelievo", "import")}${pr.vende != null ? ` · ${euro(pr.vende)}/kWh ${t("immissione", "export")}` : ""}</div>`}`, { cls: "span3" });
}
ACT.enStor = el => { VS.p = el.dataset.v; render(); };

function pagina() {
  return `<div class="g g3">
    ${isAdmin() ? `<section class="card span3 row between" style="flex-wrap:wrap;gap:8px"><span class="muted">${t("Scegli tu i sensori: stringhe del fotovoltaico, rete, casa, batterie, contatori di oggi.", "Choose your sensors: solar strings, grid, home, batteries, today's meters.")}</span><button class="btn" data-act="enSensors">⚙️ ${t("Sensori", "Sensors")}</button></section>` : ""}
    ${adesso()}${cardStringhe()}${cardOggi()}${cardStorico()}${consumi()}
  </div>`;
}
page("energia", { title: t("Energia", "Energy"), short: t("Energia", "Energy"), icon: "⚡", order: 15, editable: true, show: () => haEnergia() || isAdmin(), render: pagina });

/* pillole in alto: sole e rete */
STRIP.push(() => {
  if (!haEnergia()) return "";
  const { pv, rete } = letture();
  return `${pv != null ? `<span class="pillv sun" data-act="go" data-id="energia">☀ ${watts(pv)}</span>` : ""}${rete != null ? `<span class="pillv ${rete > 20 ? "grid" : "exp"}" data-act="go" data-id="energia">${rete > 20 ? "↓" : "↑"} ${watts(Math.abs(rete))}</span>` : ""}`;
});

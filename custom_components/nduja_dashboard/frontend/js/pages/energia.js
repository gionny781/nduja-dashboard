/* Energia: flusso in tempo reale (sole, rete, casa, batteria), totali di oggi e consumi dei dispositivi.
   I sensori si trovano da soli: prima le scelte dell'utente (✏️ Modifica → ⚙️ Sensori), poi le opzioni
   dell'integrazione, poi la configurazione «Energia» di Home Assistant, infine i nomi dei sensori.
   Segni: rete + = prelievo / − = immissione; batteria + = scarica / − = carica (come Home Assistant). */
import { S, ACT, CHG, LAYOUT, UI, STRIP, t, LOC, esc, fnum, nm, ok, val, attr, W, watts, ws, cached, card, empty, page, isAdmin,
  saveLayout, toast, openSheet, closeSheet, render, allEnts, deviceClass, REG, DEVICES } from "../core.js";
import { scegli, cambia } from "../edit.js";
import { statistiche, barre } from "../grafici.js";

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
function letture() {
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
function totali() {
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

/* ---------- flusso ---------- */
const box = (x, y, w, h, lab, v, sub, cls = "") => `<g class="bx68 ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>
  <text x="${x + w / 2}" y="${y + 17}" class="lb68">${lab}</text><text x="${x + w / 2}" y="${y + h / 2 + (sub ? 12 : 16)}" class="vl68">${v}</text>${sub ? `<text x="${x + w / 2}" y="${y + h - 9}" class="sb68">${sub}</text>` : ""}</g>`;
const ln = (d, col, on, rev) => `<path d="${d}" class="ln68"/>${on ? `<path d="${d}" class="fl68 ${rev ? "rev" : ""}" style="stroke:${col}"/>` : ""}`;
function flusso() {
  const { s, pv, rete, bat, casa, soc } = letture(), haPv = !!s.pv, haBat = !!(s.battery || s.soc);
  const sole = (pv || 0) > 20, compra = rete != null && rete > 20, vende = rete != null && rete < -20, scarica = bat != null && bat > 20, carica = bat != null && bat < -20;
  const bil = pv != null && casa != null ? pv - casa : null, socC = soc == null ? "#8e8e93" : soc < 20 ? "#ff453a" : soc < 40 ? "#ff9f0a" : "#30d158";
  if (window.innerWidth < 700) return flussoTel({ s, pv, rete, bat, casa, soc, haPv, haBat, sole, compra, vende, scarica, carica, bil, socC });
  return `<section class="card span3 fw68"><div class="ch"><h2>⚡ ${t("Adesso", "Now")}</h2><span class="muted small">${bil == null ? "" : bil >= 0 ? t(`surplus ${watts(bil)}`, `surplus ${watts(bil)}`) : t(`mancano ${watts(-bil)}`, `short by ${watts(-bil)}`)}</span></div>
  <svg viewBox="0 30 1000 ${haBat ? 470 : 360}" class="sv68" role="img" aria-label="${t("Flusso di energia", "Energy flow")}">
    ${haPv ? `<g class="sun68 ${sole ? "on" : ""}" transform="translate(330 80)"><circle r="15"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="0" y1="-21" x2="0" y2="-28" transform="rotate(${a})"/>`).join("")}</g>
      ${box(370, 44, 180, 78, t("SOLE", "SOLAR"), watts(pv), "", sole ? "sol" : "")}${ln("M460 122 V250", "#ffd60a", sole)}` : ""}
    ${ln("M305 315 H405", compra ? "#ff6961" : "#30d158", compra || vende, vende)}
    ${box(165, 278, 140, 74, t("RETE", "GRID"), watts(rete == null ? null : Math.abs(rete)), compra ? t("prelievo", "import") : vende ? t("immissione", "export") : t("in pari", "idle"), compra ? "red" : vende ? "grn" : "")}
    <g class="pyl68" transform="translate(88 300)"><path d="M-14 34 L0 -26 L14 34 M-9 12 H9 M-12 -6 H12 M-20 -16 H20 M-5 -6 L7 12 M5 -6 L-7 12"/></g>
    <g class="inv68"><circle cx="460" cy="315" r="54" class="body"/><text x="460" y="310" class="t">${casa == null ? "—" : watts(casa)}</text><text x="460" y="330" class="s">${t("casa", "home")}</text></g>
    ${ln("M515 315 H595", "#64d2ff", (casa || 0) > 20)}
    <g class="house68" transform="translate(650 312)"><path d="M-36 4 L0 -30 L36 4" class="roof"/><rect x="-26" y="2" width="52" height="38" rx="3" class="wall"/><rect x="-7" y="18" width="14" height="22" rx="2" class="door"/></g>
    <text x="760" y="300" class="tx68" style="text-anchor:start">${t("Consumo", "Consumption")}</text><text x="760" y="326" class="vl68" style="text-anchor:start;font-size:22px">${watts(casa)}</text>
    ${haBat ? `${ln("M460 369 V420", "#30d158", carica || scarica, scarica)}
      <g class="bt68"><rect x="426" y="420" width="68" height="34" rx="7" class="case"/><rect x="494" y="431" width="6" height="12" rx="2" class="case"/>
      <rect x="429" y="423" width="${soc == null ? 0 : Math.max(3, Math.min(62, 62 * soc / 100)).toFixed(1)}" height="28" rx="5" style="fill:${socC}"/></g>
      <text x="460" y="484" class="soc68" style="fill:${socC}">${soc == null ? "—" : Math.round(soc) + "%"}</text>
      ${box(560, 410, 160, 74, carica ? t("IN CARICA", "CHARGING") : scarica ? t("IN SCARICA", "DISCHARGING") : t("BATTERIA", "BATTERY"), watts(bat == null ? null : Math.abs(bat)), "", carica || scarica ? "grn" : "")}` : ""}
  </svg>
  ${!haEnergia() ? `<div class="note1">${t("Non ho trovato i sensori dell'energia. Configurali in Home Assistant (Impostazioni → Plance → Energia) oppure con ✏️ Modifica → ⚙️ Sensori.", "No energy sensors found. Set them up in Home Assistant (Settings → Dashboards → Energy) or with ✏️ Edit → ⚙️ Sensors.")}</div>` : ""}</section>`;
}

/* versione per il telefono: stesso schema, più stretto, scritte più grandi */
function flussoTel(o) {
  const { pv, rete, bat, casa, soc, haPv, haBat, sole, compra, vende, scarica, carica, bil, socC } = o, y0 = haPv ? 0 : -90;
  return `<section class="card span3 fw68"><div class="ch"><h2>⚡ ${t("Adesso", "Now")}</h2><span class="muted small">${bil == null ? "" : bil >= 0 ? `+${watts(bil)}` : `−${watts(-bil)}`}</span></div>
  <svg viewBox="0 ${y0} 400 ${(haBat ? 380 : 250) - y0}" class="sv68 tel68" role="img" aria-label="${t("Flusso di energia", "Energy flow")}">
    ${haPv ? `${box(110, 4, 180, 76, "☀ " + t("SOLE", "SOLAR"), watts(pv), "", sole ? "sol" : "")}${ln("M200 80 V142", "#ffd60a", sole)}` : ""}
    ${ln("M124 190 H152", compra ? "#ff6961" : "#30d158", compra || vende, vende)}
    ${box(4, 150, 120, 80, t("RETE", "GRID"), watts(rete == null ? null : Math.abs(rete)), compra ? t("prelievo", "import") : vende ? t("immissione", "export") : t("in pari", "idle"), compra ? "red" : vende ? "grn" : "")}
    <g class="inv68"><circle cx="200" cy="190" r="48" class="body"/><text x="200" y="190" class="t">${casa == null ? "—" : watts(casa)}</text><text x="200" y="210" class="s">${t("casa", "home")}</text></g>
    ${ln("M248 190 H276", "#64d2ff", (casa || 0) > 20)}
    ${box(276, 150, 120, 80, "🏠 " + t("CASA", "HOME"), watts(casa), t("consumo", "use"), "home")}
    ${haBat ? `${ln("M200 238 V276", "#30d158", carica || scarica, scarica)}
      <g class="bt68"><rect x="160" y="276" width="80" height="40" rx="8" class="case"/><rect x="240" y="289" width="7" height="14" rx="2" class="case"/>
      <rect x="164" y="280" width="${soc == null ? 0 : Math.max(3, Math.min(72, 72 * soc / 100)).toFixed(1)}" height="32" rx="6" style="fill:${socC}"/></g>
      <text x="200" y="352" class="soc68" style="fill:${socC}">${soc == null ? "—" : Math.round(soc) + "%"}</text>
      ${box(266, 284, 130, 72, carica ? t("CARICA", "CHARGE") : scarica ? t("SCARICA", "DISCHARGE") : "🔋", watts(bat == null ? null : Math.abs(bat)), "", carica || scarica ? "grn" : "")}` : ""}
  </svg></section>`;
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
    ${flusso()}${cardStringhe()}${cardOggi()}${cardStorico()}${consumi()}
  </div>`;
}
page("energia", { title: t("Energia", "Energy"), short: t("Energia", "Energy"), icon: "⚡", order: 15, editable: true, show: () => haEnergia() || isAdmin(), render: pagina });

/* pillole in alto: sole e rete */
STRIP.push(() => {
  if (!haEnergia()) return "";
  const { pv, rete } = letture();
  return `${pv != null ? `<span class="pillv sun" data-act="go" data-id="energia">☀ ${watts(pv)}</span>` : ""}${rete != null ? `<span class="pillv ${rete > 20 ? "grid" : "exp"}" data-act="go" data-id="energia">${rete > 20 ? "↓" : "↑"} ${watts(Math.abs(rete))}</span>` : ""}`;
});

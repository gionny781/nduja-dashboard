/* Energia: flusso in tempo reale (sole, rete, casa, batteria), totali di oggi e consumi dei dispositivi.
   I sensori si trovano da soli: prima le scelte dell'utente (✏️ Modifica → ⚙️ Sensori), poi le opzioni
   dell'integrazione, poi la configurazione «Energia» di Home Assistant, infine i nomi dei sensori.
   Segni: rete + = prelievo / − = immissione; batteria + = scarica / − = carica (come Home Assistant). */
import { S, ACT, CHG, LAYOUT, UI, STRIP, t, esc, fnum, nm, ok, val, attr, W, watts, ws, cached, card, empty, page, isAdmin,
  saveLayout, toast, openSheet, closeSheet, render, allEnts, deviceClass, REG, DEVICES } from "../core.js";

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
/** sensore usato per ogni ruolo */
export function sensori() {
  const E = LAYOUT.energy || {}, O = UI.opt || {};
  const pick = (k, opt, tipo, re, bonus) => E[k] || O[opt] || (tipo && rateDaPrefs(tipo)) || (re && cerca(re, tipo, bonus)) || null;
  return {
    pv: pick("pv", "pv_power", "solar", /solar|solare|fotovolt|photovolt|\bpv|produzione|production|generat/i, 3),
    grid: pick("grid", "grid_power", "grid", /\bgrid|\brete\b|_rete\b|scambio|contatore|meter\b/i, 1),
    battery: pick("battery", "battery_power", "battery", /batter/i, 3),
    soc: E.soc || O.battery_soc || allEnts("sensor", id => deviceClass(id) === "battery" && /inverter|storage|accumul|batteria_casa|home_battery|battery_level|zcs|solis|huawei|growatt|sofar|fronius|victron|deye|sunsynk/i.test(id + nm(id)))[0] || null,
    home: E.home || O.home_power || cerca(/house|home|\bcasa\b|_casa|load|consumo|consumption/i, null) || null,
    gridInv: !!E.gridInv, batInv: !!E.batInv,
  };
}
/* se il sensore del sole è una sola stringa (PV1), sommo le altre stringhe dello stesso inverter */
function stringhe(id) {
  if (!id || (LAYOUT.energy || {}).pv || !/pv\s?_?1\b|pv1|string.?1|stringa.?1|mppt.?1/i.test(id + " " + nm(id))) return [id];
  const dev = REG[id]?.device;
  const altre = potenze().filter(x => x !== id && REG[x]?.device === dev && /pv\s?_?[2-9]\b|pv[2-9]|string.?[2-9]|stringa.?[2-9]|mppt.?[2-9]/i.test(x + " " + nm(x)));
  return [id, ...altre];
}
function letture() {
  const s = sensori(), g = W(s.grid), b = W(s.battery);
  const pvL = s.pv ? stringhe(s.pv).map(W).filter(v => v != null) : [], pv = s.pv ? Math.max(0, pvL.reduce((a, v) => a + v, 0)) : null;
  const rete = g == null ? null : s.gridInv ? -g : g, bat = b == null ? null : s.batInv ? -b : b;
  let casa = s.home ? W(s.home) : null;
  if (casa == null && (pv != null || rete != null)) casa = Math.max(0, (pv || 0) + (rete || 0) + (bat || 0));
  return { s, pv, rete, bat, casa, soc: s.soc ? val(s.soc) : null };
}
export const haEnergia = () => { const s = sensori(); return !!(s.pv || s.grid || s.battery || s.home); };

/* ---------- totali di oggi dalle statistiche ---------- */
const oggi = id => !id ? null : cached("estat:" + id, 5 * 60000, () => ws({ type: "recorder/statistic_during_period", statistic_id: id, fixed_period: { calendar: { period: "day" } }, types: ["change"] }).then(r => r?.change ?? null).catch(() => null));
function totali() {
  const P = prefs(), src = P.energy_sources || [], sum = ids => { const v = ids.map(oggi).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const grid = src.filter(s => s.type === "grid"), sol = src.filter(s => s.type === "solar"), bat = src.filter(s => s.type === "battery");
  const imp = sum(grid.flatMap(g => [...(g.flow_from || []).map(f => f.stat_energy_from), g.stat_energy_from].filter(Boolean)));
  const exp = sum(grid.flatMap(g => [...(g.flow_to || []).map(f => f.stat_energy_to), g.stat_energy_to].filter(Boolean)));
  const pv = sum(sol.map(s => s.stat_energy_from).filter(Boolean));
  const bOut = sum(bat.map(s => s.stat_energy_from).filter(Boolean)), bIn = sum(bat.map(s => s.stat_energy_to).filter(Boolean));
  const casa = (pv != null || imp != null) ? Math.max(0, (pv || 0) + (imp || 0) - (exp || 0) + (bOut || 0) - (bIn || 0)) : null;
  return { imp, exp, pv, bOut, bIn, casa, ok: src.length > 0 };
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
    ${T.pv != null ? `<div><small>${t("Prodotto", "Produced")}</small><b style="color:#ffd60a">${k(T.pv)}</b></div>` : ""}<div><small>${t("Consumato", "Consumed")}</small><b style="color:#64d2ff">${k(T.casa)}</b></div>
    <div><small>${t("Prelevato", "Imported")}</small><b style="color:#ff6961">${k(T.imp)}</b></div><div><small>${t("Immesso", "Exported")}</small><b style="color:#30d158">${k(T.exp)}</b></div>
    ${auto != null ? `<div><small>${t("Autoconsumo", "Self-consumption")}</small><b>${auto}%</b></div>` : ""}${suff != null ? `<div><small>${t("Autosufficienza", "Self-sufficiency")}</small><b>${suff}%</b></div>` : ""}
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

/* ---------- scelta dei sensori ---------- */
function scheda() {
  const s = sensori(), E = LAYOUT.energy || {}, P = potenze().sort((a, b) => nm(a).localeCompare(nm(b)));
  const SOC = allEnts("sensor", id => deviceClass(id) === "battery").sort((a, b) => nm(a).localeCompare(nm(b)));
  const sel = (k, L, label, help) => `<label class="fld1"><span>${label}</span><select data-chg="enSel" data-k="${k}"><option value="">${t("Automatico", "Automatic")}${s[k] && !E[k] ? ` (${esc(nm(s[k]))})` : ""}</option>${L.map(id => `<option value="${id}" ${E[k] === id ? "selected" : ""}>${esc(nm(id))} · ${ok(id) ? esc(S[id].state) + " " + esc(attr(id, "unit_of_measurement") || "") : "—"}</option>`).join("")}</select>${help ? `<small class="muted">${help}</small>` : ""}</label>`;
  const inv = (k, label) => `<label class="row" style="gap:8px;margin-top:6px;font-size:13px"><input type="checkbox" data-chg="enInv" data-k="${k}" ${E[k] ? "checked" : ""}> ${label}</label>`;
  return `<div class="sh-head"><div><h3>⚙️ ${t("Sensori dell'energia", "Energy sensors")}</h3><div class="small muted">${t("«Automatico» usa la configurazione Energia di Home Assistant.", "«Automatic» uses Home Assistant's Energy configuration.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${sel("pv", P, "☀️ " + t("Produzione fotovoltaico", "Solar production"))}
    ${sel("grid", P, "🔌 " + t("Rete", "Grid"), t("Positivo quando prelevi, negativo quando immetti.", "Positive when importing, negative when exporting."))}${inv("gridInv", t("Il mio sensore ha i segni al contrario", "My sensor has the opposite sign"))}
    ${sel("home", P, "🏠 " + t("Consumo casa", "Home consumption"), t("Se lo lasci su Automatico e non c'è, lo calcolo: sole + rete + batteria.", "If left on Automatic and missing, I calculate it: solar + grid + battery."))}
    ${sel("battery", P, "🔋 " + t("Potenza batteria", "Battery power"), t("Positivo quando si scarica, negativo quando si carica.", "Positive when discharging, negative when charging."))}${inv("batInv", t("Il mio sensore ha i segni al contrario", "My sensor has the opposite sign"))}
    ${sel("soc", SOC, "🔋 " + t("Carica batteria (%)", "Battery charge (%)"))}
    <button class="btn pri" data-act="enSave" style="margin-top:14px">💾 ${t("Salva", "Save")}</button>`;
}
let bozza = null;
CHG.enSel = el => { bozza = bozza || { ...(LAYOUT.energy || {}) }; if (el.value) bozza[el.dataset.k] = el.value; else delete bozza[el.dataset.k]; };
CHG.enInv = el => { bozza = bozza || { ...(LAYOUT.energy || {}) }; bozza[el.dataset.k] = el.checked; };
Object.assign(ACT, {
  enSensors: () => { bozza = null; openSheet(scheda); },
  enSave: async () => { try { await saveLayout({ ...LAYOUT, energy: bozza || LAYOUT.energy || {} }); bozza = null; closeSheet(); toast("💾 " + t("Sensori salvati", "Sensors saved")); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); } },
});

function pagina() {
  return `<div class="g g3">
    ${UI.edit ? `<section class="card span3 row between" style="flex-wrap:wrap;gap:8px"><span class="muted">${t("Scegli tu i sensori se quelli trovati non sono giusti.", "Choose the sensors yourself if the ones found are wrong.")}</span><button class="btn" data-act="enSensors">⚙️ ${t("Sensori", "Sensors")}</button></section>` : ""}
    ${flusso()}${cardOggi()}${consumi()}
  </div>`;
}
page("energia", { title: t("Energia", "Energy"), short: t("Energia", "Energy"), icon: "⚡", order: 15, editable: true, show: () => haEnergia() || isAdmin(), render: pagina });

/* pillole in alto: sole e rete */
STRIP.push(() => {
  if (!haEnergia()) return "";
  const { pv, rete } = letture();
  return `${pv != null ? `<span class="pillv sun" data-act="go" data-id="energia">☀ ${watts(pv)}</span>` : ""}${rete != null ? `<span class="pillv ${rete > 20 ? "grid" : "exp"}" data-act="go" data-id="energia">${rete > 20 ? "↓" : "↑"} ${watts(Math.abs(rete))}</span>` : ""}`;
});

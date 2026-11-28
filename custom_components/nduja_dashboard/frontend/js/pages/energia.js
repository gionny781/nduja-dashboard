/* Energia: «Adesso» come scena animata (cielo, meteo, casa, batteria, rete, auto, elettrodomestici accesi; scenaenergia.js),
   totali di oggi, storico e costi, consumi dei dispositivi.
   I sensori si trovano da soli: prima le scelte dell'utente (✏️ Modifica → ⚙️ Sensori), poi le opzioni
   dell'integrazione, poi la configurazione «Energia» di Home Assistant, infine i nomi dei sensori.
   Segni: rete + = prelievo / − = immissione; batteria + = scarica / − = carica (come Home Assistant). */
import { S, ACT, CHG, LAYOUT, UI, STRIP, t, LOC, IT, esc, fnum, nm, nmHA, ok, val, attr, unit, W, watts, ws, cached, card, empty, page, isAdmin, sGet, sSet,
  saveLayout, toast, openSheet, closeSheet, render, allEnts, deviceClass, REG, DEVICES, VISTE, COLPO, myHA, manca, linkBtn, hhmm, VERS, idsDispositivo } from "../core.js";
import { scegli, cambia } from "../edit.js";
import { statistiche, barre } from "../grafici.js";
import { scena, intestazione, etichette } from "../scenaenergia.js";
import { auto, ricarica } from "./auto.js";

/* ---------- da dove leggo ---------- */
const prefs = () => cached("energy:prefs", 10 * 60000, () => ws({ type: "energy/get_prefs" }).catch(() => ({}))) || {};
/** la configurazione Energia è arrivata? (prima non so ancora se c'è il fotovoltaico) */
const prefsPronte = () => cached("energy:prefs", 10 * 60000, () => ws({ type: "energy/get_prefs" }).catch(() => ({}))) !== undefined;
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
  const pv = pick("pv", "pv_power", "solar", /solar|solare|fotovolt|photovolt|\bpv|produzione|production|generat/i, 3);
  return {
    pv,
    /* senza fotovoltaico, se non trovo la rete per nome: la potenza misurata dallo stesso dispositivo del contatore (Shelly EM…) (0.7.66) */
    grid: pick("grid", "grid_power", "grid", /\bgrid|\brete\b|_rete\b|scambio|contatore|meter\b/i, 1) || (!pv && !scelti("home").length && !O.home_power ? potenzaContatore() : null),
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
  let casa = somma("home", s.home), rt = rete, stim = false;
  /* solo contatore senza sensore di potenza (0.7.66): la potenza di adesso si stima da quanto cresce il contatore */
  if (rt == null && casa == null && !s.pv && soloContatore()) { const e = stimaW(); if (e != null) { rt = e; casa = e; stim = true; } }
  if (casa == null && (pv != null || rt != null)) casa = Math.max(0, (pv || 0) + (rt || 0) + (bat || 0));
  const socL = scelti("soc").length ? scelti("soc") : s.soc ? [s.soc] : [], socV = socL.map(val).filter(x => x != null);
  const r = { s, pv, pvL: s.pv ? stringhe(s.pv).map(id => ({ id, w: W(id) })) : [], rete: rt, bat, casa, soc: socV.length ? socV.reduce((a, x) => a + x, 0) / socV.length : null };
  if (stim) r.stim = true;
  return r;
}
/** i sensori di potenza di ogni ruolo, come li usa letture(): { pv:[], rete:[], bat:[], casa:[], gridInv, batInv }
    (casa vuoto = la casa si calcola da sole + rete + batteria). Li usa il salvaschermo «Consumi della casa» per il grafico */
export function idsPotenza() {
  const s = sensori(), L = (k, primo) => scelti(k).length ? scelti(k) : primo ? [primo] : [];
  return { pv: s.pv ? stringhe(s.pv) : [], rete: L("grid", s.grid), bat: L("battery", s.battery), casa: L("home", s.home), gridInv: s.gridInv, batInv: s.batInv };
}
export const haEnergia = () => { const s = sensori(); return !!(s.pv || s.grid || s.battery || s.home) || contatori().length > 0; };

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
  if ((LAYOUT.energy || {}).noAuto) return null;   // l'utente non la vuole nella scena (⚙️ Sensori)
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
/** la scena di adesso e i suoi numeri, già pronti: { Lt, F, A, frase, altro, sc (scenaenergia.js), E (etichette) }.
    La usa anche il salvaschermo «Fotovoltaico in tempo reale» (salvaschermo.js) */
export function scenaAdesso(stretto = window.innerWidth < 700, idp) {
  const Lt = letture(), { s, pv, rete, bat, casa, soc } = Lt, haPv = !!s.pv, haBat = !!(s.battery || s.soc), haRete = rete != null || !!s.grid;
  const F = ripartisci(Lt), A = autoACasa(), cnt = !haPv && soloContatore();
  let { frase, altro } = riepilogo(Lt, F, A);
  /* solo contatore: quanto della potenza impegnata si sta usando */
  if (cnt && casa != null) frase = t(`La casa usa ${watts(casa)}${Lt.stim ? " (stimata dal contatore)" : ""}: il ${Math.round(Math.max(0, casa) / (impegnata() * 10))}% della potenza impegnata`, `The house uses ${watts(casa)}${Lt.stim ? " (estimated from the meter)" : ""}: ${Math.round(Math.max(0, casa) / (impegnata() * 10))}% of your contracted power`) + ".";
  const pvIds = haPv ? stringhe(s.pv) : [];
  const sc = scena({ stretto, pv, haPv, rete, haRete, bat, haBat, soc, casa, F, auto: A, picco: haPv ? picco(pvIds, pv) : 1, titolo: frase || t("Energia adesso", "Energy now"), idp });
  const soci = scelti("soc").length ? scelti("soc") : s.soc ? [s.soc] : [], primo = L => L[0] || null;
  const E = [
    haPv && { k: "pv", id: primo(pvIds), ic: "☀️", v: watts(pv), s: t("produzione", "solar"), cls: "sol" },
    haRete && !cnt && { k: "rete", id: primo(scelti("grid").length ? scelti("grid") : [s.grid]), ic: rete > 20 ? "↓" : rete < -20 ? "↑" : "⚡", v: watts(rete == null ? null : Math.abs(rete)),
      s: rete > 20 ? t("prelievo", "import") : rete < -20 ? t("immissione", "export") : t("rete in pari", "grid idle"), cls: rete > 20 ? "imp" : rete < -20 ? "exp" : "" },
    { k: "casa", id: primo(scelti("home").length ? scelti("home") : [s.home]) || (cnt ? primo(scelti("grid").length ? scelti("grid") : [s.grid]) || primo(contatori().filter(id => S[id])) : null), ic: "🏠", v: watts(casa), s: cnt ? (Lt.stim ? t("adesso · stimata", "now · estimated") : t("adesso", "now")) : t("consumo", "use"), cls: "casa" },
    haBat && { k: "bat", id: primo(soci) || primo(scelti("battery").length ? scelti("battery") : [s.battery]), ic: "🔋", v: soc == null ? watts(bat == null ? null : Math.abs(bat)) : Math.round(soc) + "%",
      s: bat < -20 ? t("in carica", "charging") + (soc != null ? " · " + watts(-bat) : "") : bat > 20 ? t("in uso", "in use") + (soc != null ? " · " + watts(bat) : "") : t("ferma", "idle"), cls: "bat" },
    A && { k: "auto", id: A.id, ic: "🚗", v: A.b != null ? Math.round(A.b) + "%" : esc(A.nome), s: A.ric ? "⚡ " + (A.w ? watts(A.w) : t("in carica", "charging")) : A.spina ? t("collegata", "plugged in") : t("a casa", "home"), cls: "ev" },
  ].filter(Boolean);
  return { Lt, F, A, frase, altro, sc, E, cnt };
}
/** stretto (facoltativo): disegno da telefono anche su uno schermo largo; compatto: solo la frase e i numeri, senza la scena
    (le tessere di Colpo d'occhio) */
function adesso(stretto = window.innerWidth < 700, compatto = false) {
  const { Lt: { casa, stim }, frase, altro, sc, E, cnt } = scenaAdesso(stretto);
  /* solo contatore: la lancetta verso la potenza impegnata (sopra la scena nello schermo largo, sotto sul telefono) e i kWh di oggi */
  const lan = cnt ? lancetta(casa, stim, compatto ? "sm" : "") : "", oggiK = cnt ? (() => { const v = contatori().map(oggi); return v.some(x => x == null) ? null : v.reduce((a, x) => a + x, 0); })() : null;
  const oggiH = cnt && oggiK != null ? `<div class="en8k"><small>📅 ${t("Oggi", "Today")}</small><b>${kwhTx(oggiK)}</b></div>` : "";
  return `<section class="card span3 en7c"><div class="ch"><h2>⚡ ${t("Adesso", "Now")}</h2><span class="muted small">${esc(intestazione(sc.sole, sc.meteo))}</span></div>
    ${frase ? `<div class="en7r">${esc(frase)}${altro ? `<small>${esc(altro)}</small>` : ""}</div>` : ""}
    ${compatto ? "" : `<div class="en7 ${stretto ? "tel" : ""}">${sc.html}${stretto ? "" : etichette(E, sc.g)}${cnt && !stretto ? `<div class="en8o">${lan}${oggiH}</div>` : ""}</div>`}${cnt && (stretto || compatto) ? `<div class="en8r">${lan}${oggiH}</div>` : ""}
    ${(stretto || compatto) && !(cnt && compatto) && (!cnt || E.some(e => e.k !== "casa")) ? `<div class="en7t">${etichette(cnt ? E.filter(e => e.k !== "casa") : E, null)}</div>` : ""}
    ${compatto ? "" : accesi(casa)}
    ${!haEnergia() ? manca(t("Non ho trovato i sensori dell'energia. Configurali nella plancia Energia di Home Assistant, oppure scegli tu i sensori.", "No energy sensors found. Set them up in Home Assistant's Energy dashboard, or pick the sensors yourself."),
      linkBtn(t("Configurazione Energia", "Energy configuration"), myHA("config_energy"), "pri") + (isAdmin() ? `<button class="btn sm" data-act="enSensors">⚙️ ${t("Scegli i sensori", "Pick the sensors")}</button>` : "")) : ""}</section>`;
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
/** quante righe e da quanti W in su (⚙️ Sensori → Elenchi): prima 12 righe e 1 W, fissi */
const righe = () => { const n = +(LAYOUT.energy || {}).righe; return n >= 1 ? Math.round(n) : 12; };
const minW = () => { const n = +(LAYOUT.energy || {}).minW; return n >= 0 && (LAYOUT.energy || {}).minW != null && (LAYOUT.energy || {}).minW !== "" ? n : 1; };
/** i dispositivi che consumano di più adesso (W), con le stesse scelte di «Chi consuma adesso»: [{ id, w }] */
export function chiConsuma(n = righe()) {
  const s = sensori(), escl = [s.pv, s.grid, s.battery, s.home].filter(Boolean);
  const tolti = new Set((LAYOUT.energy || {}).nascosti || []), soglia = minW();
  return (scelti("devW").length ? scelti("devW") : potenze().filter(id => !escl.includes(id) && !tolti.has(id) && !/inverter|grid|rete|solar|pv|batter|total|totale|house|casa_consumo|consumo_casa/i.test(id)))
    .filter(id => ok(id) && (W(id) || 0) > soglia).map(id => ({ id, w: W(id) })).sort((a, b) => b.w - a.w).slice(0, n);
}
function consumi() {
  const P = prefs(), dc = scelti("devKwh").length ? scelti("devKwh") : (P.device_consumption || []).map(d => d.stat_consumption).filter(Boolean);
  const nomeD = id => esc(S[id] ? nm(id) : id.split(".").pop().replace(/_/g, " "));
  /* oggi in kWh (dalla configurazione Energia) */
  const giorno = dc.map(id => ({ id, v: oggi(id) })).filter(r => r.v != null && r.v > 0.005).sort((a, b) => b.v - a.v);
  /* adesso in W: sensori di potenza dei dispositivi (non quelli dell'impianto) */
  const N = righe(), ora = chiConsuma(N);
  if (!giorno.length && !ora.length) return "";
  const maxG = Math.max(...giorno.map(r => r.v), 0.01), maxW = Math.max(...ora.map(r => r.w), 1);
  /* in ✏️ Modifica: ✕ toglie un sensore da «Chi consuma adesso» (si rimette in ⚙️ Sensori) */
  const via = id => UI.edit && isAdmin() && !scelti("devW").length ? `<button class="x3" data-act="enTogli" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button>` : "";
  const cfg = isAdmin() ? `<button class="btn sm" data-act="enSensors">⚙️</button>` : "";
  return `${ora.length ? card("🔌 " + t("Chi consuma adesso", "Using power now"), `<div class="stack">${ora.map(r => `<div class="row" style="gap:6px"><button class="cn1 grow" data-act="more" data-id="${r.id}"><span>${nomeD(r.id)}</span><i><b style="width:${(r.w / maxW * 100).toFixed(1)}%"></b></i><em>${watts(r.w)}</em></button>${via(r.id)}</div>`).join("")}</div>`, { right: cfg }) : ""}
    ${giorno.length ? card("📊 " + t("Consumi di oggi", "Today's consumption"), `<div class="stack">${giorno.slice(0, N).map(r => `<button class="cn1" data-act="more" data-id="${r.id}"><span>${nomeD(r.id)}</span><i><b style="width:${(r.v / maxG * 100).toFixed(1)}%;background:#64d2ff"></b></i><em>${fnum(r.v, 2)} kWh</em></button>`).join("")}</div>`, { right: cfg }) : ""}`;
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
  ["devW", "🔌 " + t("Chi consuma adesso", "Using power now"), potenza, t("Scegli tu quali dispositivi mostrare. Automatico: tutti i sensori di potenza della casa, tranne quelli dell'impianto.", "Choose which devices to show. Automatic: every power sensor in the house, except the system ones.")],
  ["devKwh", "📊 " + t("Consumi di oggi", "Today's consumption"), energia, t("Contatori di energia dei dispositivi. Automatico: quelli dei «Consumi dei dispositivi» della configurazione Energia.", "Devices' energy meters. Automatic: the «Individual devices» of the Energy configuration.")],
];
function scheda() {
  const s = sensori(), E = LAYOUT.energy || {};
  const auto = k => k === "pv" ? (s.pv ? stringhe(s.pv) : []) : ["pvKwh", "impKwh", "expKwh", "devW", "devKwh"].includes(k) ? [] : s[k] ? [s[k]] : [];
  const voce = ([k, label, , help, inv]) => { const L = scelti(k), A = L.length ? [] : auto(k);
    const nienteAuto = k === "devW" ? t("Automatico: tutti i sensori di potenza", "Automatic: every power sensor") : k === "devKwh" ? t("Automatico: dalla configurazione Energia", "Automatic: from the Energy configuration") : t("Automatico: niente trovato", "Automatic: nothing found");
    return `<div class="en2"><div class="row between"><b>${label}</b>${L.length ? `<button class="btn sm" data-act="enAuto" data-k="${k}">✨ ${t("Automatico", "Automatic")}</button>` : ""}</div>
      ${help ? `<small class="muted">${help}</small>` : ""}
      <div class="stack" style="margin-top:8px">${L.map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)} · ${ok(id) ? esc(S[id].state) + " " + esc(attr(id, "unit_of_measurement") || "") : "—"}</span></div><button class="x3" data-act="enDel" data-k="${k}" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button></div>`).join("")}
        ${!L.length ? `<div class="small muted">✨ ${A.length ? t("Automatico: ", "Automatic: ") + A.map(id => esc(nm(id))).join(" + ") : nienteAuto}</div>` : ""}
        <button class="add1" data-act="enAdd" data-k="${k}"><span>＋</span>${L.length ? t("Aggiungi un altro sensore", "Add another sensor") : t("Scegli il sensore", "Choose the sensor")}</button></div>
      ${inv ? `<label class="row" style="gap:8px;margin-top:8px;font-size:13px"><input type="checkbox" data-chg="enInv" data-k="${inv}" ${E[inv] ? "checked" : ""}> ${t("Il mio sensore ha i segni al contrario", "My sensor has the opposite sign")}</label>` : ""}</div>`; };
  return `<div class="sh-head"><div><h3>⚙️ ${t("Sensori dell'energia", "Energy sensors")}</h3><div class="small muted">${t("Puoi scegliere qualsiasi sensore della casa. Le modifiche si salvano subito.", "You can choose any sensor in the house. Changes save immediately.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="en2 row between" style="gap:8px;flex-wrap:wrap"><span><b>⚡ ${soloContatore() ? t("Pagina: solo contatore", "Page: meter only") : t("Pagina: con fotovoltaico", "Page: with solar")}</b><br><small class="muted">${t("Senza fotovoltaico: contatore, potenza impegnata, fasce e bolletta.", "Without solar: meter, contracted power, bands and bill.")}</small></span><button class="btn sm" data-act="enCnt">⚙️ ${t("Contatore e bolletta", "Meter and bill")}</button></div>
    ${VOCI().map(voce).join("")}
    <div class="en2"><b>💶 ${t("Prezzi (facoltativi)", "Prices (optional)")}</b><small class="muted"> ${t("Vuoto = quelli della configurazione Energia.", "Empty = those of the Energy configuration.")}</small>
      <div class="row" style="gap:10px"><label class="fld1" style="flex:1"><span>${t("Prelievo ", "Import ") + simbolo()}/kWh</span><input type="number" step="0.001" min="0" value="${esc(E.prezzo ?? "")}" data-chg="enPrezzo" data-k="prezzo" placeholder="${prezzi().compra ?? ""}"></label>
      <label class="fld1" style="flex:1"><span>${t("Immissione ", "Export ") + simbolo()}/kWh</span><input type="number" step="0.001" min="0" value="${esc(E.prezzoVendita ?? "")}" data-chg="enPrezzo" data-k="prezzoVendita" placeholder="${prezzi().vende ?? ""}"></label></div></div>
    <div class="en2"><b>📋 ${t("Elenchi «Chi consuma adesso» e «Consumi di oggi»", "«Using power now» and «Today's consumption» lists")}</b>
      <small class="muted">${t("Quante righe mostrare e sotto quanti watt un dispositivo non compare (evita quelli in stand-by).", "How many rows to show and below how many watts a device is left out (skips those on standby).")}</small>
      <div class="row" style="gap:10px"><label class="fld1" style="flex:1"><span>${t("Righe", "Rows")}</span><input type="number" min="1" max="50" step="1" value="${righe()}" data-chg="enNum" data-k="righe"></label>
      <label class="fld1" style="flex:1"><span>${t("Mostra sopra (W)", "Show above (W)")}</span><input type="number" min="0" step="1" value="${minW()}" data-chg="enNum" data-k="minW"></label></div>
      ${(E.nascosti || []).length ? `<div class="small muted" style="margin-top:8px">${t("Tolti da «Chi consuma adesso» (con ✕ in ✏️ Modifica):", "Removed from «Using power now» (with ✕ in ✏️ Edit):")}</div>
        <div class="stack" style="margin-top:6px">${E.nascosti.map(id => `<div class="li"><div class="tx"><b>${esc(S[id] ? nm(id) : id)}</b><span>${esc(id)}</span></div><button class="btn sm" data-act="enRimetti" data-id="${id}">↩︎ ${t("Rimetti", "Put back")}</button></div>`).join("")}</div>` : ""}</div>
    <div class="en2"><b>🚗 ${t("Auto nella scena «Adesso»", "Car in the «Now» scene")}</b>
      <label class="row" style="gap:8px;margin-top:6px;font-size:13px"><input type="checkbox" data-chg="enNoAuto" ${E.noAuto ? "" : "checked"}> ${t("Mostra l'auto davanti a casa quando è a casa, collegata o in carica", "Show the car in front of the house when it's home, plugged in or charging")}</label></div>
    <p class="small muted">💱 ${t("La valuta è quella di Home Assistant (Impostazioni → Sistema → Generale): ", "The currency is Home Assistant's (Settings → System → General): ") + valuta()}.</p>`;
}
const salvaE = (fn, msg) => cambia(l => { l.energy = { ...(l.energy || {}) }; fn(l.energy); }, msg).then(() => { if (!UI.sheet) openSheet(scheda); });
CHG.enPrezzo = el => salvaE(e => { if (el.value === "") delete e[el.dataset.k]; else e[el.dataset.k] = +el.value; }, "💶 " + t("Salvato", "Saved"));
CHG.enInv = el => salvaE(e => { e[el.dataset.k] = el.checked; });
CHG.enNum = el => salvaE(e => { const v = parseFloat(String(el.value).replace(",", ".")); if (el.value === "" || isNaN(v) || v < 0) delete e[el.dataset.k]; else e[el.dataset.k] = el.dataset.k === "righe" ? Math.max(1, Math.round(v)) : v; }, "💾 " + t("Salvato", "Saved"));
CHG.enNoAuto = el => salvaE(e => { if (el.checked) delete e.noAuto; else e.noAuto = true; });
Object.assign(ACT, {
  enSensors: () => openSheet(scheda),
  enAdd: el => { const k = el.dataset.k, v = VOCI().find(x => x[0] === k);
    scegli({ titolo: v[1], sotto: t("Tutti i sensori della casa: cerca per nome (es. «pv2», «stringa», «inverter»).", "Every sensor in the house: search by name (e.g. «pv2», «string», «inverter»)."), filtro: v[2], attuale: null, auto: false,
      onPick: id => id && (el.dataset.da === "cnt" ? salvaC : salvaE)(e => { e[k] = [...new Set([...lista(e[k]), id])]; }, "＋ " + nm(id)) }); },
  enDel: el => { const k = el.dataset.k, id = el.dataset.id; salvaE(e => { e[k] = lista(e[k]).filter(x => x !== id); if (!e[k].length) delete e[k]; }); },
  enAuto: el => { const k = el.dataset.k; salvaE(e => { delete e[k]; }); },
  enTogli: el => { const id = el.dataset.id; cambia(l => { l.energy = { ...(l.energy || {}) }; l.energy.nascosti = [...new Set([...(l.energy.nascosti || []), id])]; }, "✕ " + nm(id)); },
  enRimetti: el => { const id = el.dataset.id; salvaE(e => { e.nascosti = (e.nascosti || []).filter(x => x !== id); if (!e.nascosti.length) delete e.nascosti; }); },
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
  /* configurazione Energia nel formato con flow_from / flow_to: il prezzo sta nel primo flusso (0.7.66) */
  const f0 = (g.flow_from || [])[0] || {}, t0 = (g.flow_to || [])[0] || {};
  const num = (n, ent) => n != null ? +n : ent && S[ent] ? val(ent) : null;
  const compra = num(g.number_energy_price, g.entity_energy_price) ?? num(f0.number_energy_price, f0.entity_energy_price);
  const vende = num(g.number_energy_price_export, g.entity_energy_price_export) ?? num(t0.number_energy_price, t0.entity_energy_price);
  return { compra: E.prezzo != null && E.prezzo !== "" ? +E.prezzo : compra, vende: E.prezzoVendita != null && E.prezzoVendita !== "" ? +E.prezzoVendita : vende };
}
/** valuta di Home Assistant (Impostazioni → Sistema → Generale); prima era sempre l'euro */
const valuta = () => { const c = cached("haConfig", 3600e3, () => ws({ type: "get_config" }).catch(() => ({}))); return /^[A-Z]{3}$/.test(c?.currency || "") ? c.currency : "EUR"; };
const euro = v => { if (v == null || isNaN(v)) return "—"; try { return v.toLocaleString(LOC, { style: "currency", currency: valuta() }); } catch { return v.toLocaleString(LOC, { style: "currency", currency: "EUR" }); } };
const simbolo = () => { try { return (0).toLocaleString(LOC, { style: "currency", currency: valuta(), currencyDisplay: "narrowSymbol" }).replace(/[\d\s.,\u00a0]/g, "") || valuta(); } catch { return "€"; } };
/* periodo dello storico: ricordato su questo dispositivo */
const VS = { get p() { const v = sGet("enStor"); return ["settimana", "mese", "anno"].includes(v) ? v : "settimana"; }, set p(v) { sSet("enStor", v); } };
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

/* ================= ⚡ solo contatore (0.7.66) =================
   Per chi non ha il fotovoltaico: un contatore di energia (kWh, total_increasing: Shelly EM, lettore ottico, misuratore in quadro),
   anche senza sensore di potenza. Riquadri dei periodi con il confronto, grafici, fasce F1/F2/F3, stima della bolletta, consumo di base.
   Scelte della casa in LAYOUT.energy (solo amministratori, ⚙️):
     { modo: "contatore" | "completo" (senza = automatico), impegnata: kW (3), fasce: { on, schema: "it" | "mio", ore: { f, s, d } (24 cifre 1-3), festivi },
       prezzoModo: "fisso" | "sensore" | "fasce", prezzoSensore, prezzoF: { f1, f2, f3 }, quota: €/mese, giornoBolletta: 1-28 }
   Scelta di questo dispositivo: nduja_enCnt (grafico: oggi | mese | anno). */
const EC = () => LAYOUT.energy || {};
/** c'è il fotovoltaico? scelto a mano, nella configurazione Energia o trovato da solo */
const haFotovoltaico = () => !!sensori().pv || (prefs().energy_sources || []).some(s => s.type === "solar") || scelti("pvKwh").length > 0;
/** pagina «Solo contatore»: da sola quando non c'è il fotovoltaico (finché la configurazione Energia non arriva resta com'era) */
export const soloContatore = () => EC().modo === "contatore" ? true : EC().modo === "completo" ? false : prefsPronte() && !haFotovoltaico();

/* ---------- il contatore (kWh) ---------- */
/* contatori che non sono quello della casa: elettrodomestici, prese, auto, impianto, costi */
const NON_CASA = /lavatric|asciug|lavastov|forno|frigo|freezer|congel|(^|[^a-z])tv([^a-z]|$)|televis|computer|(^|[^a-z])pc([^a-z]|$)|server|(^|[^a-z])nas([^a-z]|$)|plug|presa|prese|socket|boiler|scaldabagno|pompa|pump|clima|condizion|aircon|caldaia|wallbox|charger|colonnin|ricarica|(^|[^a-z])ev([^a-z]|$)|luce|luci|light|lamp|stufa|induz|microonde|aspirap|robot|deumid|umidif|ventil|router|modem|batter|inverter|solar|solare|(^|[^a-z])pv|fotovolt|produz|production|export|immess|immission|returned|feed.?in|cost|costo|price|prezzo|gas|acqua|water/i;
/* nomi del contatore della casa */
const CASA_KWH = [[/grid|(^|[^a-z])rete([^a-z]|$)|contatore|meter|import|prelev|from.?grid/i, 3], [/casa|home|house|consum|totale|(^|[^a-z])total([^a-z]|$)|generale|main/i, 2], [/shelly|(^|[^a-z])3?em\d?([^a-z]|$)|pro.?em|channel|canale|fase|phase|quadro|lettore|optical|ottico|tasmota|sdm\d|pzem|iammeter/i, 1]];
/* contatori a periodo (utility_meter): vanno bene, ma meglio quello vero */
const A_PERIODO = /daily|today|oggi|giorn|week|settiman|month|mese|mensil|year|anno|annual|yesterday|ieri|(^|[^a-z])(f[123]|peak|offpeak|picco)([^a-z]|$)/i;
const daContatore = id => id.startsWith("sensor.") && (deviceClass(id) === "energy" || /^(k|m)?wh$/i.test(unit(id))) && ["total_increasing", "total"].includes(attr(id, "state_class"));
let contG = -1, contP = null, contV = null;
function trovaContatore() {
  const P = prefs(); if (contG === VERSgen() && contP === P) return contV;
  const dev = new Set((P.device_consumption || []).map(d => d.stat_consumption));
  const L = allEnts("sensor", id => daContatore(id) && !dev.has(id) && !PREVISIONE.test(id + " " + nmHA(id)) && !NON_CASA.test(id + " " + nmHA(id)));
  let best = null, top = 0;
  for (const id of L) {
    const n = id + " " + nmHA(id); let p = 0;
    for (const [re, v] of CASA_KWH) if (re.test(n)) p += v;
    if (A_PERIODO.test(n)) p -= 2;
    if (!ok(id)) p -= 1;
    if (p > top || (p === top && best && id < best)) { top = p; best = id; }
  }
  /* un solo contatore in casa: è lui, anche con un nome qualsiasi (ma non quello di una presa o di un relè che comanda qualcosa) */
  if (!best && L.length === 1) { const d = REG[L[0]]?.device; if (!d || !idsDispositivo(d).some(x => /^(switch|light)\./.test(x))) best = L[0]; }
  contG = VERSgen(); contP = P; contV = best;
  return best;
}
/** i contatori della casa (kWh) da cui leggo lo storico: scelti in ⚙️, quelli della rete nella configurazione Energia, oppure quello trovato da solo */
export function contatori() {
  const I = idsEnergia().imp.filter(id => S[id] || id.includes(":"));
  if (I.length) return I;
  const a = trovaContatore(); return a ? [a] : [];
}
/** sensore di potenza dello stesso dispositivo del contatore (Shelly EM, misuratore in quadro): la potenza di tutta la casa */
function potenzaContatore() {
  const devs = new Set(contatori().map(id => REG[id]?.device).filter(Boolean)); if (!devs.size) return null;
  return potenze().filter(id => devs.has(REG[id]?.device) && !PREVISIONE.test(id + " " + nm(id))).sort((a, b) => (ok(b) - ok(a)) || a.localeCompare(b))[0] || null;
}
/** il contatore trovato da solo (per ⚙️) */
export const contatoreAuto = () => idsEnergia().imp.length ? idsEnergia().imp : trovaContatore() ? [trovaContatore()] : [];

/* ---------- potenza stimata dal contatore (senza sensore in W) ---------- */
const CAMP = [];   // letture del contatore: [{ t, v }] (kWh in totale)
function stimaW() {
  const ids = contatori().filter(id => S[id]); if (!ids.length) return null;
  const vs = ids.map(kwh); if (vs.some(v => v == null)) return null;
  const v = vs.reduce((a, x) => a + x, 0), tt = Math.max(...ids.map(id => Date.parse(S[id].last_updated || S[id].last_changed) || 0));
  const u = CAMP[CAMP.length - 1];
  if (!u || u.v !== v) { if (u && v < u.v) CAMP.length = 0; CAMP.push({ t: tt || Date.now(), v }); }
  while (CAMP.length > 2 && CAMP[0].t < Date.now() - 15 * 6e4) CAMP.shift();
  /* dalle letture arrivate mentre la plancia è aperta: almeno 2 minuti di aumenti, l'ultimo da poco */
  const a = CAMP[0], b = CAMP[CAMP.length - 1];
  if (CAMP.length >= 3 && b.t - a.t >= 120e3 && Date.now() - b.t < 6 * 6e4) return Math.max(0, (b.v - a.v) / ((b.t - a.t) / 3600e3) * 1000);
  /* altrimenti dalle statistiche ogni 5 minuti di Home Assistant: la media degli ultimi due intervalli */
  const st = new Date(Date.now() - 40 * 6e4); st.setMinutes(Math.floor(st.getMinutes() / 5) * 5, 0, 0);
  const r = cached("enStima:" + ids.join(","), 2 * 6e4, () => ws({ type: "recorder/statistics_during_period", start_time: st.toISOString(), statistic_ids: ids, period: "5minute", types: ["change"] }).catch(() => ({})));
  if (!r) return null;
  const per = {};
  for (const id of ids) for (const p of (r[id] || [])) if (p.change != null) per[p.start] = (per[p.start] || 0) + p.change * kwhK(id);
  const K = Object.keys(per).map(Number).sort((x, y) => x - y).slice(-2);
  if (!K.length) return null;
  return Math.max(0, K.reduce((s0, k) => s0 + per[k], 0) / (K.length * 5 / 60) * 1000);
}
/** quanti kWh vale un'unità del contatore (Wh, kWh, MWh) */
const kwhK = id => { const u = String(attr(id, "unit_of_measurement") || "").toLowerCase(); return u === "wh" ? .001 : u === "mwh" ? 1000 : 1; };
const VERSgen = () => VERS.gen;

/* ---------- potenza impegnata e lancetta ---------- */
/** potenza impegnata del contratto, in kW (3 se non scelta) */
export const impegnata = () => { const v = parseFloat(EC().impegnata); return v > 0 && v < 1000 ? v : 3; };
/** lancetta dalla potenza di adesso verso la potenza impegnata: verde, arancione dall'80%, rossa oltre il 100%. dim = "" | "sm" */
export function lancetta(w, stim, dim = "") {
  const lim = impegnata() * 1000, M = lim * 1.2, q = w == null ? 0 : Math.max(0, w) / lim, ang = -90 + 180 * Math.min(1, (w || 0) / M);
  const liv = w == null ? "" : q > 1 ? "ko" : q >= .8 ? "at" : "";
  const P = a => { const r = a * Math.PI / 180; return [(Math.sin(r) * 46).toFixed(1), (-Math.cos(r) * 46).toFixed(1)]; };
  const arco = (f0, f1) => { const [x0, y0] = P(-90 + 180 * f0), [x1, y1] = P(-90 + 180 * f1); return `M${x0} ${y0}A46 46 0 0 1 ${x1} ${y1}`; };
  const f80 = .8 / 1.2, f100 = 1 / 1.2, [tx, ty] = P(-90 + 180 * f100);
  const avviso = liv === "ko" ? t("Oltre la potenza impegnata: rischio che salti il contatore", "Above your contracted power: the meter may trip")
    : liv === "at" ? t("Vicino al limite: meglio non accendere altro", "Close to the limit: better not to switch anything else on") : "";
  return `<div class="en8 ${dim} ${liv}" role="img" aria-label="${esc(watts(w) + " · " + Math.round(q * 100) + "% · " + fnum(impegnata(), impegnata() % 1 ? 1 : 0) + " kW")}">
    <svg class="en8g" viewBox="-56 -54 112 62" aria-hidden="true"><path class="tr" d="${arco(0, 1)}"/><path class="z1" d="${arco(0, f80)}"/><path class="z2" d="${arco(f80, f100)}"/><path class="z3" d="${arco(f100, 1)}"/>
      <path class="tk" d="M${(tx * .8).toFixed(1)} ${(ty * .8).toFixed(1)}L${(tx * 1.1).toFixed(1)} ${(ty * 1.1).toFixed(1)}"/>
      <g class="ag" style="transform:rotate(${ang.toFixed(1)}deg)"><path d="M0 -40L3 0H-3Z"/></g><circle class="pv" r="4.5"/></svg>
    <div class="en8t"><b>${watts(w)}</b><span>${w == null ? t("in attesa del contatore", "waiting for the meter") : Math.round(q * 100) + "% " + t("di ", "of ") + fnum(impegnata(), impegnata() % 1 ? 1 : 0) + " kW"}${stim ? ` · <i>${t("stimata", "estimated")}</i>` : ""}</span>
      ${avviso ? `<em>${avviso}</em>` : ""}</div></div>`;
}

/* ---------- fasce orarie ---------- */
/** Pasqua (calendario gregoriano) */
function pasqua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const PASQ = {};
/** festività nazionali italiane (calendario ARERA): Capodanno, Epifania, Pasquetta, 25 aprile, 1° maggio, 2 giugno, Ferragosto, Ognissanti, Immacolata, Natale, Santo Stefano */
export function festivo(d) {
  const k = (d.getMonth() + 1) * 100 + d.getDate();
  if ([101, 106, 425, 501, 602, 815, 1101, 1208, 1225, 1226].includes(k)) return true;
  const y = d.getFullYear(), p = PASQ[y] || (PASQ[y] = pasqua(y)), lun = new Date(p.getFullYear(), p.getMonth(), p.getDate() + 1);
  return d.getMonth() === lun.getMonth() && d.getDate() === lun.getDate();
}
/* le ore di ARERA: F1 lun-ven 8-19; F2 lun-ven 7-8 e 19-23, sabato 7-23; F3 il resto, domenica e festivi tutto il giorno */
const ORE_IT = { f: "333333321111111111122223", s: "333333322222222222222223", d: "333333333333333333333333" };
const fcfg = () => EC().fasce || {};
/** fasce accese? (di partenza sì in Italia, no altrove) */
export const fasceOn = () => fcfg().on != null ? !!fcfg().on : IT || /^it/i.test(navigator.language || "");
const oreFasce = () => { const o = fcfg().schema === "mio" ? fcfg().ore || {} : ORE_IT, ok3 = v => /^[123]{24}$/.test(v || "");
  return { f: ok3(o.f) ? o.f : ORE_IT.f, s: ok3(o.s) ? o.s : ORE_IT.s, d: ok3(o.d) ? o.d : ORE_IT.d }; };
const festiviOn = () => fcfg().schema === "mio" ? fcfg().festivi !== false : true;
/** fascia (1, 2, 3) di un'ora */
export function fascia(d) {
  const O = oreFasce(), g = d.getDay(), riga = g === 0 || (festiviOn() && festivo(d)) ? O.d : g === 6 ? O.s : O.f;
  return +riga[d.getHours()];
}
const NOMI_F = () => ({ 1: [t("F1 · punta", "F1 · peak"), "#ff9f0a"], 2: [t("F2 · intermedia", "F2 · mid"), "#64d2ff"], 3: [t("F3 · fuori punta", "F3 · off-peak"), "#30d158"] });

/* ---------- prezzi del contatore ---------- */
const prezzoF = () => { const P = EC().prezzoF || {}, n = k => P[k] != null && P[k] !== "" && !isNaN(+P[k]) ? +P[k] : null; return { 1: n("f1"), 2: n("f2"), 3: n("f3") }; };
const conFasce = () => { const P = prezzoF(); return fasceOn() && P[1] != null && P[2] != null && P[3] != null; };
/** come si calcola il costo: per fascia, dal sensore del prezzo o con il prezzo fisso */
export function prezzoModo() {
  const m = EC().prezzoModo;
  if (m === "fasce" && conFasce()) return "fasce";
  if (m === "sensore" && S[EC().prezzoSensore]) return "sensore";
  if (m === "fisso") return "fisso";
  return conFasce() ? "fasce" : "fisso";
}
/** €/kWh unico (fisso o sensore); null = non c'è */
const prezzoUnico = () => prezzoModo() === "sensore" ? val(EC().prezzoSensore) : prezzi().compra;
const quota = () => { const v = parseFloat(EC().quota); return v > 0 ? v : 0; };
const giornoBolletta = () => { const v = Math.round(+EC().giornoBolletta); return v >= 1 && v <= 28 ? v : 1; };

/* ---------- i dati: ore (ultimi giorni) e giorni (due anni) dalle statistiche ---------- */
const g0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const chiave = ms => { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const conG = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** inizio del periodo di fatturazione di adesso e del prossimo */
function periodoBolletta(ora = new Date()) {
  const B = giornoBolletta(); let a = new Date(ora.getFullYear(), ora.getMonth(), B);
  if (a > ora) a = new Date(ora.getFullYear(), ora.getMonth() - 1, B);
  return [a, new Date(a.getFullYear(), a.getMonth() + 1, B)];
}
let DC = null;
/** tutto quello che serve alle schede del contatore, calcolato una volta per ogni arrivo di dati */
function datiContatore() {
  const ids = contatori(); if (!ids.length) return null;
  const ora = new Date(), oggi0 = g0(ora), [pb] = periodoBolletta(ora);
  const hStart = new Date(Math.min(conG(oggi0, -8).getTime(), pb.getTime()));
  const dStart = new Date(Math.min(new Date(ora.getFullYear() - 1, 0, 1).getTime(), new Date(ora.getFullYear() - 1, ora.getMonth() - 1, 1).getTime()));
  const rh = statistiche(ids, hStart, "hour", ["change"]), rd = statistiche(ids, dStart, "day", ["change"]);
  const oggiV = ids.map(oggi), oggiT = oggiV.some(v => v == null) ? null : oggiV.reduce((a, v) => a + v, 0);
  const firma = [ids.join(), rh, rd, oggiT, oggiT == null ? 0 : Math.floor(Date.now() / 6e4), EC(), oggi0.getTime()];
  if (DC && DC.firma.every((x, i) => x === firma[i])) return DC.v;
  const v = calcola(ids, rh, rd, oggiT, ora);
  DC = { firma, v }; return v;
}
function calcola(ids, rh, rd, oggiT, ora) {
  if (rh === undefined || rd === undefined) return { carico: true };
  const oggi0 = g0(ora), fr = (ora - oggi0) / (conG(oggi0, 1) - oggi0);
  /* kWh per ora e per giorno (somma dei contatori) */
  const ORE = new Map(), GG = new Map();
  for (const id of ids) {
    const k = kwhK(id);
    for (const p of (rh?.[id] || [])) { const x = typeof p.start === "number" ? p.start : Date.parse(p.start); ORE.set(x, (ORE.get(x) || 0) + Math.max(0, (p.change || 0) * k)); }
    for (const p of (rd?.[id] || [])) { const x = typeof p.start === "number" ? p.start : Date.parse(p.start); const c = chiave(x); GG.set(c, (GG.get(c) || 0) + Math.max(0, (p.change || 0) * k)); }
  }
  const kOggi = chiave(oggi0);
  /* oggi: quanto è cresciuto da mezzanotte (anche l'ora in corso); senza, la somma delle ore */
  const oreOggi = [...ORE].filter(([x]) => x >= oggi0.getTime()).reduce((a, [, v]) => a + v, 0);
  const oggiV = oggiT != null ? Math.max(oggiT, 0) : oreOggi;
  GG.set(kOggi, oggiV);
  const giorni = [...GG.keys()].filter(c => c !== kOggi), primo = giorni.length ? Math.min(...giorni) : kOggi;
  const somma = (da, a) => { let tot = 0, n = 0; for (let d = new Date(da); d < a; d = conG(d, 1)) { const v = GG.get(chiave(d)); if (v != null) { tot += v; n++; } } return n ? tot : 0; };
  const c0 = d => chiave(d) >= primo;   // ci sono dati da quel giorno?
  /* stesso punto del periodo di prima: i giorni interi prima e il giorno corrispondente in proporzione all'ora di adesso */
  const finoA = (da, giorno) => c0(da) ? somma(da, giorno) + (GG.get(chiave(giorno)) || 0) * fr : null;
  /* ieri a quest'ora: le ore di ieri fino a quest'ora, l'ora in corso in proporzione */
  const ieri0 = conG(oggi0, -1), hIeri = new Date(ora.getTime() - 864e5);
  let ieriOra = null;
  if (c0(ieri0) && ORE.size) { ieriOra = 0; for (const [x, v] of ORE) { if (x < ieri0.getTime() || x >= oggi0.getTime()) continue; if (x + 3600e3 <= hIeri.getTime()) ieriOra += v; else if (x <= hIeri.getTime()) ieriOra += v * (hIeri - x) / 3600e3; } }
  const lun = conG(oggi0, -((oggi0.getDay() + 6) % 7)), mese0 = new Date(ora.getFullYear(), ora.getMonth(), 1), anno0 = new Date(ora.getFullYear(), 0, 1);
  const meseP0 = new Date(ora.getFullYear(), ora.getMonth() - 1, 1);
  const mmA = (y, m, g) => new Date(y, m, Math.min(g, new Date(y, m + 1, 0).getDate()));   // stesso giorno, anche nei mesi più corti
  const nomeMese = d => d.toLocaleDateString(LOC, { month: "long", year: "numeric" });
  const P = [];
  P.push({ k: "oggi", n: t("Oggi", "Today"), v: oggiV, prima: ieriOra, rif: t("ieri a quest'ora", "yesterday by now") });
  P.push({ k: "ieri", n: t("Ieri", "Yesterday"), v: c0(ieri0) ? GG.get(chiave(ieri0)) ?? null : null, prima: c0(conG(oggi0, -2)) ? GG.get(chiave(conG(oggi0, -2))) ?? null : null, rif: conG(oggi0, -2).toLocaleDateString(LOC, { weekday: "long" }) });
  P.push({ k: "sett", n: t("Questa settimana", "This week"), v: somma(lun, oggi0) + oggiV, prima: finoA(conG(lun, -7), conG(oggi0, -7)), rif: t("la settimana scorsa", "last week") });
  /* mese: rispetto allo stesso mese dell'anno prima; se non ci sono i dati, al mese prima */
  const mAnno = mmA(ora.getFullYear() - 1, ora.getMonth(), 1), gAnno = mmA(ora.getFullYear() - 1, ora.getMonth(), ora.getDate());
  const mPrec = meseP0, gPrec = mmA(ora.getFullYear(), ora.getMonth() - 1, ora.getDate());
  const meseV = somma(mese0, oggi0) + oggiV, meseA = finoA(mAnno, gAnno);
  P.push({ k: "mese", n: t("Questo mese", "This month"), v: meseV, prima: meseA ?? finoA(mPrec, gPrec), rif: nomeMese(meseA != null ? mAnno : mPrec) });
  const mpV = c0(meseP0) ? somma(meseP0, mese0) : null, mpA0 = new Date(ora.getFullYear() - 1, ora.getMonth() - 1, 1), mpA1 = new Date(ora.getFullYear() - 1, ora.getMonth(), 1);
  const mpB0 = new Date(ora.getFullYear(), ora.getMonth() - 2, 1), mpA = c0(mpA0) ? somma(mpA0, mpA1) : null;
  P.push({ k: "mesep", n: t("Mese scorso", "Last month"), v: mpV, prima: mpA ?? (c0(mpB0) ? somma(mpB0, meseP0) : null), rif: nomeMese(mpA != null ? mpA0 : mpB0), sotto: meseP0.toLocaleDateString(LOC, { month: "long" }) });
  const aV = somma(anno0, oggi0) + oggiV, aPrima = finoA(new Date(ora.getFullYear() - 1, 0, 1), mmA(ora.getFullYear() - 1, ora.getMonth(), ora.getDate()));
  P.push({ k: "anno", n: t("Quest'anno", "This year"), v: aV, prima: aPrima, rif: String(ora.getFullYear() - 1) });
  /* grafici */
  const oreG = []; for (let h = 0; h < 24; h++) { const x = new Date(oggi0.getFullYear(), oggi0.getMonth(), oggi0.getDate(), h).getTime(); oreG.push(x); }
  const inOra = new Date(ora); inOra.setMinutes(0, 0, 0);
  const vOre = oreG.filter(x => x <= inOra.getTime()).map(x => ({ x, v: ORE.get(x) ?? (x === inOra.getTime() ? Math.max(0, oggiV - oreOggi) : 0) }));
  const giorniM = []; for (let d = new Date(mese0); d.getMonth() === mese0.getMonth(); d = conG(d, 1)) giorniM.push(d.getTime());
  const vGiorni = giorniM.filter(x => x <= oggi0.getTime()).map(x => ({ x, v: GG.get(chiave(x)) ?? 0 }));
  const mesi = Array.from({ length: 12 }, (_, m) => new Date(ora.getFullYear(), m, 1).getTime());
  const meseTot = (y, m) => chiave(new Date(y, m + 1, 0)) >= primo ? somma(new Date(y, m, 1), new Date(y, m + 1, 1)) : null;   // null = ancora niente dati in quel mese
  const vMesi = mesi.filter(x => x <= mese0.getTime()).map((x, m) => ({ x, v: m === ora.getMonth() ? meseV : meseTot(ora.getFullYear(), m) ?? 0 }));
  const vMesiP = mesi.map((x, m) => ({ x, v: meseTot(ora.getFullYear() - 1, m) })).filter(q => q.v != null);
  /* fasce del periodo di fatturazione (dalle ore; l'ora in corso nella sua fascia) */
  const [pb, pf] = periodoBolletta(ora), F = { 1: 0, 2: 0, 3: 0 };
  let pbOre = 0;
  for (const [x, v] of ORE) if (x >= pb.getTime()) { F[fascia(new Date(x))] += v; pbOre += v; }
  const resto = Math.max(0, oggiV - oreOggi); F[fascia(ora)] += resto;
  /* periodo di fatturazione: i giorni prima di oggi e oggi */
  const pbKwh = somma(pb, oggi0 > pb ? oggi0 : pb) + (oggi0 >= pb ? oggiV : 0);
  /* consumo di base: la media oraria più bassa tra mezzanotte e le 5, notte per notte, negli ultimi 7 giorni */
  const notti = [];
  for (let n = 1; n <= 7; n++) { const d0 = conG(oggi0, -n + 1), L = [0, 1, 2, 3, 4].map(h => ORE.get(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), h).getTime())).filter(v => v != null);
    if (d0.getTime() === oggi0.getTime() && ora.getHours() < 5) continue; if (L.length >= 3) notti.push(Math.min(...L) * 1000); }
  notti.sort((a, b) => a - b);
  const base = notti.length >= 3 ? notti[Math.floor(notti.length / 2)] : null;
  return { P, oreG, vOre, giorniM, vGiorni, mesi, vMesi, vMesiP, F, pb, pf, pbKwh, base, notti: notti.length, primo, ora };
}

/* ---------- schede ---------- */
/** euro senza centesimi (cifre grandi e stime) */
const euro0 = v => { if (v == null || isNaN(v)) return "—"; try { return v.toLocaleString(LOC, { style: "currency", currency: valuta(), maximumFractionDigits: 0, minimumFractionDigits: 0 }); } catch { return euro(v); } };
const kwhTx = v => v == null ? "—" : fnum(v, v < 10 ? 2 : v < 100 ? 1 : 0) + " kWh";
const pctTx = (v, p) => { if (v == null || p == null || p < .05) return ""; const d = (v - p) / p * 100, r = Math.round(d);
  return `<span class="en9d ${r > 2 ? "su" : r < -2 ? "giu" : ""}">${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)}%</span>`; };
/** €/kWh medio di adesso: fisso, dal sensore o (per fascia) la media del periodo di fatturazione */
function prezzoMedio(D) {
  if (prezzoModo() !== "fasce") return prezzoUnico();
  const P = prezzoF(), k = D.F[1] + D.F[2] + D.F[3];
  return k > 0 ? (D.F[1] * P[1] + D.F[2] * P[2] + D.F[3] * P[3]) / k : (P[1] + P[2] + P[3]) / 3;
}
const cfgBtn = () => isAdmin() ? `<button class="btn sm" data-act="enCnt" title="${t("Contatore e bolletta", "Meter and bill")}" aria-label="${t("Contatore e bolletta", "Meter and bill")}">⚙️</button>` : "";
function carica(titolo, cls = "") { return card(titolo, `<div class="small muted">${t("Carico…", "Loading…")}</div>`, { cls }); }
function cardRiquadri(D) {
  if (!D) return "";
  if (D.carico) return carica("📅 " + t("I tuoi consumi", "Your consumption"), "span3");
  const pm = prezzoMedio(D);
  return card("📅 " + t("I tuoi consumi", "Your consumption"), `<div class="en9">${D.P.map(p => `<div class="en9r"><small>${esc(p.n)}</small><b>${kwhTx(p.v)}</b>
      <span class="en9e">${[p.sotto ? esc(p.sotto) : "", pm != null && p.v != null ? euro(p.v * pm) : ""].filter(Boolean).join(" · ")}</span>
      <span class="en9c">${p.prima != null && p.v != null && p.prima >= .05 ? `${pctTx(p.v, p.prima)} ${t("rispetto a ", "vs ")}${esc(p.rif)}` : ""}</span></div>`).join("")}</div>
    <div class="small muted" style="margin-top:8px">${pm == null ? t("Per i costi imposta il prezzo dell'energia in ⚙️.", "For costs set the energy price in ⚙️.")
      : prezzoModo() === "fasce" ? t("Costi al prezzo medio delle tue fasce in questo periodo", "Costs at your bands' average price this period") + `: ${euro(pm)}/kWh`
      : prezzoModo() === "sensore" ? t("Costi al prezzo di adesso", "Costs at the current price") + `: ${euro(pm)}/kWh` : t("Prezzo", "Price") + `: ${euro(pm)}/kWh`}</div>`, { cls: "span3", right: cfgBtn() });
}
const VG = { get p() { const v = sGet("enCnt"); return ["oggi", "mese", "anno"].includes(v) ? v : "oggi"; }, set p(v) { sSet("enCnt", v); } };
ACT.enCntG = el => { VG.p = el.dataset.v; render(); };
function cardGrafici(D) {
  if (!D) return "";
  if (D.carico) return carica("📊 " + t("Grafici", "Charts"), "span3");
  const ora = D.ora, mese = ora.toLocaleDateString(LOC, { month: "long" });
  const seg = `<div class="seg" style="margin-bottom:10px">${[["oggi", t("Oggi, ora per ora", "Today, by hour")], ["mese", t("Giorno per giorno", "Day by day")], ["anno", t("Mese per mese", "Month by month")]].map(([k, n]) => `<button class="${VG.p === k ? "act" : ""}" data-act="enCntG" data-v="${k}">${n}</button>`).join("")}</div>`;
  const C = "#64d2ff";
  const g = VG.p === "oggi" ? barre([{ nome: t("Oggi", "Today"), colore: C, valori: D.vOre }], { u: "kWh", periodo: "hour", tocca: "cntOre", xs: D.oreG,
      etichetta: x => { const a = new Date(x); return t("dalle ", "") + hhmm(a) + t(" alle ", "–") + hhmm(new Date(x + 3600e3)) + (fasceOn() ? " · F" + fascia(a) : ""); } })
    : VG.p === "mese" ? barre([{ nome: mese, colore: C, valori: D.vGiorni }], { u: "kWh", periodo: "day", tocca: "cntGg", xs: D.giorniM })
    : barre([{ nome: String(ora.getFullYear()), colore: C, valori: D.vMesi }, ...(D.vMesiP.length ? [{ nome: String(ora.getFullYear() - 1), colore: "#8e8e93", valori: D.vMesiP }] : [])],
      { u: "kWh", periodo: "month", tocca: "cntMesi", xs: D.mesi, etichetta: x => new Date(x).toLocaleDateString(LOC, { month: "long" }) });
  return card("📊 " + t("Grafici", "Charts"), seg + g, { cls: "span3" });
}
function cardFasce(D) {
  if (!D || D.carico || !fasceOn()) return "";
  const N = NOMI_F(), tot = D.F[1] + D.F[2] + D.F[3], P = prezzoF(), adesso = fascia(new Date());
  /* fino a quando dura la fascia di adesso */
  let fino = null; for (let h = 1; h <= 48; h++) { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + h); if (fascia(d) !== adesso) { fino = d; break; } }
  const quando = fino ? (g0(fino).getTime() === g0(new Date()).getTime() ? t("fino alle ", "until ") + hhmm(fino) : t("fino a ", "until ") + fino.toLocaleDateString(LOC, { weekday: "long" }) + " " + hhmm(fino)) : "";
  const righe = [1, 2, 3].map(f => { const q = tot > 0 ? D.F[f] / tot * 100 : 0;
    return `<div class="en9f ${f === adesso ? "ora" : ""}"><span class="n"><i style="background:${N[f][1]}"></i>${esc(N[f][0])}</span><span class="b"><u style="width:${q.toFixed(1)}%;background:${N[f][1]}"></u></span>
      <b>${kwhTx(D.F[f])}</b><small>${Math.round(q)}%${P[f] != null ? " · " + euro(D.F[f] * P[f]) : ""}</small></div>`; }).join("");
  return card("🕐 " + t("Fasce orarie", "Time bands"), `<div class="en9fa"><span class="en9fn" style="--fc:${N[adesso][1]}">${t("Adesso", "Now")}: <b>F${adesso}</b>${quando ? ` · ${esc(quando)}` : ""}</span></div>
    <div class="stack" style="margin-top:10px">${righe}</div>
    <div class="small muted" style="margin-top:8px">${t("Dal ", "Since ")}${D.pb.toLocaleDateString(LOC, { day: "numeric", month: "long" })} · ${fcfg().schema === "mio" ? t("fasce scelte da te", "your own bands") : t("calendario ARERA: F1 lun-ven 8-19, F2 lun-ven 7-8 e 19-23 e sabato 7-23, F3 notte, domenica e festivi", "ARERA calendar: F1 Mon-Fri 8-19, F2 Mon-Fri 7-8 and 19-23 and Sat 7-23, F3 night, Sunday and holidays")}.</div>`, { right: cfgBtn() });
}
function cardBolletta(D) {
  if (!D || D.carico) return "";
  const modo = prezzoModo(), P = prezzoF(), pu = prezzoUnico(), q = quota();
  const costo = modo === "fasce" ? D.F[1] * P[1] + D.F[2] * P[2] + D.F[3] * P[3] : pu != null ? D.pbKwh * pu : null;
  const tot = (D.pf - D.pb) / 864e5, passati = Math.max(.25, (D.ora - D.pb) / 864e5), k = tot / passati;
  const kPrev = D.pbKwh * k, cPrev = costo != null ? costo * k + q : null;
  const fine = new Date(D.pf.getTime() - 864e5);
  /* senza prezzo: i kWh in grande */
  return card("🧾 " + t("Stima della bolletta", "Bill estimate"), `<div class="og68">
      <div><small>${t("Finora", "So far")}</small><b>${costo != null ? euro(costo) : kwhTx(D.pbKwh)}</b>${costo != null ? `<span class="en9s">${kwhTx(D.pbKwh)}</span>` : ""}</div>
      <div><small>${t("A fine periodo", "By period end")}</small><b class="en9p">≈ ${cPrev != null ? euro(cPrev) : kwhTx(kPrev)}</b>${cPrev != null ? `<span class="en9s">≈ ${kwhTx(kPrev)}</span>` : ""}</div></div>
    <div class="small muted" style="margin-top:8px">${t("Periodo dal ", "Period from ")}${D.pb.toLocaleDateString(LOC, { day: "numeric", month: "short" })} ${t("al ", "to ")}${fine.toLocaleDateString(LOC, { day: "numeric", month: "short" })}
      · ${t("previsione dalla media dei giorni passati", "forecast from the average of past days")}${q ? ` · ${t("con ", "with ")}${euro(q)} ${t("di quota fissa", "fixed fee")}` : ""}.
      ${costo == null ? t(" Per i costi imposta il prezzo in ⚙️.", " For costs set the price in ⚙️.") : modo === "fasce" ? t(" Prezzi per fascia.", " Prices per band.") : modo === "sensore" ? t(" Al prezzo di adesso del sensore.", " At the sensor's current price.") : ""}</div>`, { right: cfgBtn() });
}
function cardBase(D) {
  if (!D || D.carico || D.base == null) return "";
  const w = D.base, kAnno = w / 1000 * 8760, pm = prezzoMedio(D);
  return card("🌙 " + t("Consumo di base", "Base load"), `<div class="en9b"><b>${watts(w)}</b><span>${t(`Di notte la casa consuma sempre almeno ${watts(w)}`, `At night the house always uses at least ${watts(w)}`)}${pm != null ? t(`: sono circa ${euro0(kAnno * pm)} l'anno`, `: about ${euro0(kAnno * pm)} a year`) : t(`: sono circa ${fnum(kAnno, 0)} kWh l'anno`, `: about ${fnum(kAnno, 0)} kWh a year`)}.</span>
    <small>${t("Frigorifero, router, apparecchi in stand-by: spegnere quello che non serve abbassa questo numero.", "Fridge, router, devices on standby: switching off what you don't need lowers this number.")} ${t(`Dalle notti degli ultimi ${D.notti} giorni.`, `From the nights of the last ${D.notti} days.`)}</small></div>`);
}

/* ---------- ⚙️ contatore e bolletta (amministratori) ---------- */
const CICLO = { 1: 2, 2: 3, 3: 1 };
function schedaContatore() {
  const E = EC(), F = fcfg(), O = oreFasce(), P = E.prezzoF || {}, modo = E.modo || "", pm = prezzoModo(), auto = contatoreAuto();
  const pmS = E.prezzoModo === "fasce" && !fasceOn() ? pm : E.prezzoModo || pm;   // il modo scelto (anche se manca ancora il prezzo o il sensore)
  const num = (k, v, ph, st = "0.001", extra = "") => `<input type="number" step="${st}" min="0" value="${esc(v ?? "")}" data-chg="enCntNum" data-k="${k}" placeholder="${esc(ph ?? "")}" ${extra}>`;
  const riga = (k, n) => `<div class="en9h"><span>${n}</span><div class="en9hg">${[...O[k]].map((c, h) => `<button class="f${c}" data-act="enFascia" data-k="${k}" data-h="${h}" title="${h}:00–${h + 1}:00 · F${c}" ${F.schema === "mio" ? "" : "disabled"}>${h % 6 === 0 ? h : ""}</button>`).join("")}</div></div>`;
  return `<div class="sh-head"><div><h3>⚙️ ${t("Contatore e bolletta", "Meter and bill")}</h3><div class="small muted">${t("Valgono per tutta la casa. Le modifiche si salvano subito.", "They apply to the whole home. Changes save immediately.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="en2"><b>⚡ ${t("Pagina Energia", "Energy page")}</b><small class="muted"> ${t("«Solo contatore» per chi non ha il fotovoltaico: la sceglie da sola se non trova i pannelli.", "«Meter only» for homes without solar: picked automatically when no panels are found.")}</small>
      <div style="margin-top:8px"><div class="seg">${[["", "✨ " + t("Automatica", "Automatic")], ["contatore", t("Solo contatore", "Meter only")], ["completo", t("Con fotovoltaico", "With solar")]].map(([v, n]) => `<button class="${modo === v ? "act" : ""}" data-act="enModo" data-v="${v}">${n}</button>`).join("")}</div></div>
      <div class="small muted" style="margin-top:6px">${soloContatore() ? "✅ " + t("Adesso: solo contatore", "Now: meter only") : "☀️ " + t("Adesso: con fotovoltaico", "Now: with solar")}</div></div>
    <div class="en2"><b>🔌 ${t("Contatore (kWh)", "Meter (kWh)")}</b><small class="muted"> ${t("Il sensore di energia della casa (total_increasing): Shelly EM, lettore ottico, misuratore in quadro. Più contatori si sommano.", "The home's energy sensor (total_increasing): Shelly EM, optical reader, panel meter. Several meters are added up.")}</small>
      <div class="stack" style="margin-top:8px">${scelti("impKwh").map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)} · ${ok(id) ? esc(S[id].state) + " " + esc(unit(id)) : "—"}</span></div><button class="x3" data-act="enDel" data-k="impKwh" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button></div>`).join("")}
        ${!scelti("impKwh").length ? `<div class="small muted">✨ ${auto.length ? t("Automatico: ", "Automatic: ") + auto.map(id => esc(S[id] ? nm(id) : id)).join(" + ") : t("Automatico: niente trovato", "Automatic: nothing found")}</div>` : `<button class="btn sm" data-act="enAuto" data-k="impKwh">✨ ${t("Automatico", "Automatic")}</button>`}
        <button class="add1" data-act="enAdd" data-k="impKwh" data-da="cnt"><span>＋</span>${scelti("impKwh").length ? t("Aggiungi un altro contatore", "Add another meter") : t("Scegli il contatore", "Choose the meter")}</button></div>
      <small class="muted">${t("Senza un sensore di potenza (W) la potenza di adesso si stima da quanto cresce il contatore.", "Without a power sensor (W) the current power is estimated from how fast the meter grows.")}</small></div>
    <div class="en2"><b>🎚️ ${t("Potenza impegnata", "Contracted power")}</b><small class="muted"> ${t("Quella del contratto (in bolletta). La lancetta diventa arancione dall'80% e rossa oltre il 100%.", "The one in your contract (on the bill). The needle turns orange from 80% and red above 100%.")}</small>
      <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><div class="seg">${[3, 4.5, 6].map(v => `<button class="${impegnata() === v ? "act" : ""}" data-act="enImp" data-v="${v}">${fnum(v, v % 1 ? 1 : 0)} kW</button>`).join("")}</div>
        <label class="fld1" style="flex:1;min-width:120px;margin:0"><span>${t("Altro (kW)", "Other (kW)")}</span>${num("impegnata", E.impegnata, "3", "0.5", 'max="999"')}</label></div></div>
    <div class="en2"><b>🕐 ${t("Fasce orarie", "Time bands")}</b>
      <label class="row" style="gap:8px;margin-top:6px;font-size:13px"><input type="checkbox" data-chg="enFasceOn" ${fasceOn() ? "checked" : ""}> ${t("Mostra le fasce F1, F2, F3 (spegnile se hai la tariffa monoraria)", "Show the F1, F2, F3 bands (turn off for a flat-rate tariff)")}</label>
      ${fasceOn() ? `<div style="margin-top:8px"><div class="seg">${[["it", "🇮🇹 " + t("Italia (ARERA)", "Italy (ARERA)")], ["mio", "✋ " + t("Le mie fasce", "My own bands")]].map(([v, n]) => `<button class="${(F.schema === "mio" ? "mio" : "it") === v ? "act" : ""}" data-act="enSchema" data-v="${v}">${n}</button>`).join("")}</div></div>
        <div class="en9hh">${riga("f", t("Lun-ven", "Mon-Fri"))}${riga("s", t("Sabato", "Saturday"))}${riga("d", t("Domenica e festivi", "Sunday, holidays"))}
          <div class="en9hl">${[1, 2, 3].map(f => `<span><i class="f${f}"></i>F${f}</span>`).join("")}</div></div>
        ${F.schema === "mio" ? `<small class="muted">${t("Tocca un'ora per cambiarne la fascia (F1 → F2 → F3).", "Tap an hour to change its band (F1 → F2 → F3).")}</small>
          <label class="row" style="gap:8px;margin-top:6px;font-size:13px"><input type="checkbox" data-chg="enFestivi" ${festiviOn() ? "checked" : ""}> ${t("Le festività italiane valgono come la domenica", "Italian public holidays count as Sunday")}</label>` : ""}` : ""}</div>
    <div class="en2"><b>💶 ${t("Prezzo dell'energia", "Energy price")}</b>
      <div style="margin-top:8px"><div class="seg">${[["fisso", t("Fisso", "Fixed")], ["sensore", t("Da un sensore", "From a sensor")], ...(fasceOn() ? [["fasce", t("Per fascia", "Per band")]] : [])].map(([v, n]) => `<button class="${pmS === v ? "act" : ""}" data-act="enPMod" data-v="${v}">${n}</button>`).join("")}</div></div>
      ${pmS === "sensore" ? `<div class="stack" style="margin-top:8px"><button class="li" data-act="enPSens"><span class="ic">📈</span><div class="tx"><b>${S[E.prezzoSensore] ? esc(nm(E.prezzoSensore)) : t("Scegli il sensore del prezzo", "Choose the price sensor")}</b><span>${S[E.prezzoSensore] ? esc(S[E.prezzoSensore].state) + " " + esc(unit(E.prezzoSensore)) : t("per esempio il PUN o il prezzo del tuo fornitore", "for example your supplier's price")}</span></div><span class="st">›</span></button></div>` : ""}
      ${pmS === "fasce" ? `<div class="row" style="gap:8px;margin-top:8px">${[1, 2, 3].map(f => `<label class="fld1" style="flex:1;margin:0;min-width:0"><span>F${f} ${simbolo()}/kWh</span>${num("f" + f, P["f" + f])}</label>`).join("")}</div>` : ""}
      ${pmS === "fisso" ? `<label class="fld1" style="margin-top:8px"><span>${simbolo()}/kWh</span>${num("prezzo", E.prezzo, prezzi().compra ?? "")}</label><small class="muted">${t("Vuoto = quello della configurazione Energia.", "Empty = the one in the Energy configuration.")}</small>` : ""}
      <div class="row" style="gap:10px;margin-top:8px"><label class="fld1" style="flex:1;margin:0;min-width:0"><span>${t("Quota fissa al mese", "Fixed fee per month")} (${simbolo()})</span>${num("quota", E.quota, "0", "0.01")}</label>
        <label class="fld1" style="flex:1;margin:0;min-width:0"><span>${t("Giorno di inizio", "Start day")}</span>${num("giornoBolletta", E.giornoBolletta, "1", "1", 'max="28"')}</label></div>
      <small class="muted">${t("La quota fissa (potenza, oneri) entra nella previsione a fine periodo. Il giorno di inizio è quello della bolletta (1 = dal primo del mese).", "The fixed fee goes into the end-of-period forecast. The start day is your bill's (1 = from the first of the month).")}</small></div>`;
}
const salvaC = (fn, msg) => cambia(l => { l.energy = JSON.parse(JSON.stringify(l.energy || {})); fn(l.energy); }, msg).then(() => { if (!UI.sheet) openSheet(schedaContatore); });
CHG.enCntNum = el => { const k = el.dataset.k, v = parseFloat(String(el.value).replace(",", "."));
  salvaC(e => {
    const via = el.value === "" || isNaN(v) || v < 0;
    if (/^f[123]$/.test(k)) { e.prezzoF = { ...(e.prezzoF || {}) }; if (via) delete e.prezzoF[k]; else e.prezzoF[k] = v; return; }
    if (via) delete e[k]; else e[k] = k === "giornoBolletta" ? Math.min(28, Math.max(1, Math.round(v))) : v;
  }, "💾 " + t("Salvato", "Saved")); };
CHG.enFasceOn = el => salvaC(e => { e.fasce = { ...(e.fasce || {}), on: el.checked }; });
CHG.enFestivi = el => salvaC(e => { e.fasce = { ...(e.fasce || {}), festivi: el.checked }; });
Object.assign(ACT, {
  enCnt: () => openSheet(schedaContatore),
  enModo: el => salvaC(e => { if (el.dataset.v) e.modo = el.dataset.v; else delete e.modo; }, "⚡ " + t("Salvato", "Saved")),
  enImp: el => salvaC(e => { e.impegnata = +el.dataset.v; }, "🎚️ " + fnum(+el.dataset.v, +el.dataset.v % 1 ? 1 : 0) + " kW"),
  enSchema: el => salvaC(e => { const f = e.fasce = { ...(e.fasce || {}) }; f.schema = el.dataset.v; if (f.schema === "mio" && !f.ore) f.ore = { ...ORE_IT }; }),
  enFascia: el => { const k = el.dataset.k, h = +el.dataset.h;
    salvaC(e => { const f = e.fasce = { ...(e.fasce || {}) }, o = f.ore = { ...ORE_IT, ...(f.ore || {}) }, r = [...(/^[123]{24}$/.test(o[k]) ? o[k] : ORE_IT[k])]; r[h] = String(CICLO[r[h]]); o[k] = r.join(""); }); },
  enPMod: el => salvaC(e => { e.prezzoModo = el.dataset.v; }),
  enPSens: () => scegli({ titolo: "📈 " + t("Sensore del prezzo", "Price sensor"), sotto: t("Un sensore con il prezzo dell'energia in €/kWh.", "A sensor with the energy price per kWh."), auto: false, attuale: EC().prezzoSensore || null,
    filtro: id => id.startsWith("sensor.") && S[id] && !isNaN(parseFloat(S[id].state)) && (/\/\s?kwh/i.test(unit(id)) || deviceClass(id) === "monetary" || /prezz|price|pun|tariff|costo/i.test(id + " " + nmHA(id))),
    onPick: id => id && id !== "none" && salvaC(e => { e.prezzoSensore = id; e.prezzoModo = "sensore"; }, "📈 " + nm(id)) }),
});

function pagina() {
  if (soloContatore()) { const D = datiContatore();
    return `<div class="g g3">
    ${isAdmin() ? `<section class="card span3 row between" style="flex-wrap:wrap;gap:8px"><span class="muted">${t("Solo contatore: consumi, fasce e bolletta dal contatore di casa. Scegli tu contatore, potenza impegnata e prezzi.", "Meter only: consumption, bands and bill from your home meter. Choose the meter, contracted power and prices.")}</span><span class="row" style="gap:6px"><button class="btn" data-act="enCnt">⚙️ ${t("Contatore e bolletta", "Meter and bill")}</button><button class="btn" data-act="enSensors">🔌 ${t("Sensori", "Sensors")}</button></span></section>` : ""}
    ${adesso()}${cardRiquadri(D)}${cardGrafici(D)}${cardBolletta(D)}${cardFasce(D)}${cardBase(D)}${consumi()}
    ${!D && isAdmin() ? `<section class="card span3">${manca(t("Non ho trovato il contatore di energia (kWh). Sceglilo tu, oppure aggiungilo nella configurazione Energia di Home Assistant.", "No energy meter (kWh) found. Pick it yourself, or add it in Home Assistant's Energy configuration."), `<button class="btn sm pri" data-act="enCnt">⚙️ ${t("Scegli il contatore", "Pick the meter")}</button>` + linkBtn(t("Configurazione Energia", "Energy configuration"), myHA("config_energy")))}</section>` : ""}
  </div>`; }
  return `<div class="g g3">
    ${isAdmin() ? `<section class="card span3 row between" style="flex-wrap:wrap;gap:8px"><span class="muted">${t("Scegli tu i sensori: stringhe del fotovoltaico, rete, casa, batterie, contatori di oggi.", "Choose your sensors: solar strings, grid, home, batteries, today's meters.")}</span><button class="btn" data-act="enSensors">⚙️ ${t("Sensori", "Sensors")}</button></section>` : ""}
    ${adesso()}${cardStringhe()}${cardOggi()}${cardStorico()}${consumi()}
  </div>`;
}
/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("Quanto produce il fotovoltaico, quanto consuma la casa e quanto prende dalla rete, in una scena animata, con storico e costi.", "What your solar panels produce, what the house uses and what it takes from the grid, in an animated scene, with history and costs."),
  serve: t("I sensori della rete, del fotovoltaico, della batteria o dei consumi di casa, meglio se nella configurazione Energia di Home Assistant. Senza fotovoltaico basta il contatore di energia (kWh).", "Grid, solar, battery or house consumption sensors, ideally in Home Assistant's Energy configuration. Without solar the energy meter (kWh) is enough."),
  passi: [t("Impostazioni → Plance → Energia: aggiungi il consumo dalla rete e, se li hai, il fotovoltaico e la batteria.", "Settings → Dashboards → Energy: add grid consumption and, if you have them, solar and battery."),
    t("Oppure scegli tu i sensori: Energia → ✏️ Modifica → ⚙️ Sensori.", "Or pick the sensors yourself: Energy → ✏️ Edit → ⚙️ Sensors.")],
  link: [[t("Configurazione Energia", "Energy configuration"), myHA("config_energy")]],
  anteprima: [["☀️", t("Fotovoltaico", "Solar"), t("la casa usa 0,8 kW", "the house uses 0.8 kW"), "2,4 kW", 70]] };
page("energia", { richiede: RICHIEDE, title: t("Energia", "Energy"), short: t("Energia", "Energy"), icon: "⚡", order: 15, editable: true, show: () => haEnergia() || isAdmin(), render: pagina });

/* 👁️ Colpo d'occhio: «Adesso»; la scena animata solo nella tessera grande, nelle altre la frase e i numeri */
COLPO.energia = { title: () => t("Energia adesso", "Energy now"), icon: "⚡", pagina: "energia", show: haEnergia,
  render: dim => adesso(dim !== "l" || window.innerWidth < 700, dim !== "l") };

/* pillole in alto: sole e rete */
STRIP.push(() => {
  if (!haEnergia()) return "";
  const { pv, rete, casa } = letture();
  if (pv == null && soloContatore()) return casa != null ? `<span class="pillv" data-act="go" data-id="energia">⚡ ${watts(casa)}</span>` : "";
  return `${pv != null ? `<span class="pillv sun" data-act="go" data-id="energia">☀ ${watts(pv)}</span>` : ""}${rete != null ? `<span class="pillv ${rete > 20 ? "grid" : "exp"}" data-act="go" data-id="energia">${rete > 20 ? "↓" : "↑"} ${watts(Math.abs(rete))}</span>` : ""}`;
});

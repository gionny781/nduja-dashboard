/* Avvisi intelligenti sulla Home: unisce i vecchi «Da sistemare» a controlli più furbi.
   - finestra aperta con il clima acceso nella stessa stanza
   - pioggia in arrivo con finestre aperte
   - porta aperta da più di 10 minuti (o dei minuti scelti in ⚙️)
   - elettrodomestico finito (lavatrice, asciugatrice, lavastoviglie: dal consumo)
   - pile scariche, telefoni scarichi, aggiornamenti, raccolta da esporre stasera
   - scadenze di oggi e scadute (pagina Scadenze)
   - allerte meteo da arancione in su, o dal livello scelto (pagina Meteo)
   - una stanza con l'aria «Scarsa» da più dei minuti scelti (pagina Aria, 30 se non scegli)
   - possibile perdita: l'acqua scorre senza sosta da più dei minuti scelti (pagina Acqua e gas, 120 se non scegli)
   - piante da annaffiare o da concimare oggi (promemoria) e piante che hanno sete (sensore) (pagina Piante)
   Ogni avviso si può nascondere con ✕ (torna se la situazione cambia). Con ⚙️ (solo amministratori) si scelgono
   i numeri degli avvisi di questo file (minuti della porta, ore e probabilità della pioggia, telefono scarico…)
   e quali mostrare nella Home; valgono per tutta la casa (LAYOUT.avvisi). */
import { S, ACT, CHG, LAYOUT, PAGES, VISTE, utenteCfg, t, esc, nm, ok, val, attr, ents, allEnts, isOn, ago, deviceClass, areaOf, openings, shortName, card, render, sGet, sSet, weatherEnt, forecast,
  ws, cached, api, toast, openSheet, closeSheet, isAdmin, etichettaNduja } from "./core.js";
import { cambia } from "./edit.js";
import { ritiri, chip, haRaccolta } from "./raccolta.js";
import { pericoli } from "./pages/sicurezza.js";
import { novitaAvvisi } from "./novita.js";
import { daCambiare, perAutomazione, tTipo } from "./batterie.js";
import { info } from "./people.js";

const MIN = 6e4;
const vecchio = id => Date.now() - new Date(S[id].last_changed).getTime();
const nascosti = () => { try { return JSON.parse(sGet("dismiss") || "{}"); } catch { return {}; } };

/* --- regole scelte dall'amministratore (⚙️ nella scheda Avvisi): senza scelte, i valori di sempre --- */
const REGOLE_DEF = { portaMin: 10, pioggiaOre: 3, pioggiaPr: 60, finitoOre: 6, telBatt: 20, raccoltaOra: 17 };
/* limiti dei campi: [minimo, massimo] */
const REGOLE_LIM = { portaMin: [1, 1440], pioggiaOre: [1, 24], pioggiaPr: [5, 100], finitoOre: [1, 48], telBatt: [1, 99], raccoltaOra: [0, 23] };
/** i numeri degli avvisi: { portaMin, pioggiaOre, pioggiaPr, finitoOre, telBatt, raccoltaOra } */
export function regole() {
  const a = LAYOUT.avvisi || {}, r = {};
  for (const k in REGOLE_DEF) { const v = +a[k], [lo, hi] = REGOLE_LIM[k]; r[k] = a[k] != null && !isNaN(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : REGOLE_DEF[k]; }
  return r;
}
/** tipi di avviso che si possono togliere dalla Home (i pericoli e l'allarme restano sempre) */
const TIPI_HOME = () => [
  ["aperture", "🪟 " + t("Porte e finestre aperte", "Open doors and windows")],
  ["pioggia", "🌧️ " + t("Pioggia con finestre aperte", "Rain with windows open")],
  ["elettro", "🧺 " + t("Elettrodomestico finito", "Appliance done")],
  ["telefoni", "📱 " + t("Telefoni scarichi", "Phones low on battery")],
  ["pile", "🪫 " + t("Pile scariche", "Low batteries")],
  ["raccolta", "♻️ " + t("Raccolta da esporre stasera", "Waste to put out tonight")],
  ["aggiornamenti", "⬆️ " + t("Aggiornamenti", "Updates")],
];
const inHome = k => !(LAYOUT.avvisi?.off || []).includes(k);

/* --- elettrodomestici: seguo il consumo nel browser --- */
const ELETTRO = /lavatric|asciugatric|lavastovigl|washer|washing|dryer|dishwasher|forno|oven/i;
/** sensori di potenza da seguire in più (quelli scelti nella pagina Elettrodomestici) */
export const POTENZE_EXTRA = [];
/** soglie scelte da chi usa la plancia per ogni elettrodomestico (pagina Elettrodomestici → ✏️): ogni funzione riceve
    il sensore di potenza e restituisce { threshold, fineW, fineMin, cicloMin, avviso } oppure niente */
export const SOGLIE = [];
/** soglie di un sensore di potenza: quelle scelte, altrimenti valori adatti alla maggior parte degli elettrodomestici */
export function soglie(id) {
  let s = null;
  for (const f of SOGLIE) { try { s = f(id); } catch {} if (s) break; }
  s = s || {};
  return { on: +s.threshold || 15, off: +s.fineW || 5, min: +s.fineMin || 3, ciclo: s.cicloMin === 0 ? 0 : (+s.cicloMin || 10), avviso: s.avviso !== false };
}
const elettro = () => [...new Set([...allEnts("sensor", id => deviceClass(id) === "power" && ELETTRO.test(id + " " + nm(id)) && ok(id)), ...POTENZE_EXTRA.flatMap(f => { try { return f(); } catch { return []; } }).filter(id => S[id] && ok(id))])];
/** stato del ciclo di un sensore di potenza: { on: inizio (ms) o 0, fine: fine dell'ultimo ciclo (ms) } */
export const ciclo = id => EL[id] || { on: 0, fine: 0 };
let EL = {}; try { EL = JSON.parse(sGet("appl") || "{}"); } catch {}
function seguiElettro() {
  let cambiato = false;
  for (const id of elettro()) {
    const w = val(id) || 0, s = EL[id] || { on: 0, low: 0, fine: 0 }, now = Date.now(), g = soglie(id);
    if (w > g.on) { if (!s.on) s.on = now; s.low = 0; }
    else if (s.on && w < g.off) {
      if (!s.low) s.low = now;
      if (now - s.low > g.min * MIN) { if (now - s.on > g.ciclo * MIN) s.fine = now; s.on = 0; s.low = 0; }
    }
    if (JSON.stringify(s) !== JSON.stringify(EL[id])) { EL[id] = s; cambiato = true; }
  }
  if (cambiato) sSet("appl", JSON.stringify(EL));
}
setInterval(seguiElettro, 30000);

const pioggia = r => {
  const w = weatherEnt(); if (!w) return false;
  if (/rain|pour|lightning|hail/.test(S[w].state)) return true;
  const f = forecast(w, "hourly").slice(0, r.pioggiaOre);
  return f.some(x => /rain|pour|lightning|hail/.test(x.condition || "") || (x.precipitation_probability || 0) >= r.pioggiaPr);
};

/** elenco degli avvisi: { k (chiave per nasconderlo), ic, b, s, id?, go?, act?, cls } */
export function avvisi() {
  seguiElettro();
  const A = [], R = regole(), aperte = inHome("aperture") ? openings().filter(isOn) : [];
  ents("alarm_control_panel", id => S[id].state === "triggered").forEach(id => A.push({ k: "al:" + id + S[id].last_changed, ic: "🚨", b: esc(nm(id)) + " — " + t("ALLARME!", "TRIGGERED!"), s: ago(S[id].last_changed), go: "sicurezza", cls: "alert" }));
  pericoli().forEach(id => A.push({ k: "pe:" + id + S[id].last_changed, ic: { smoke: "🔥", gas: "💨", carbon_monoxide: "☠️", moisture: "💧" }[deviceClass(id)] || "⚠️", b: esc(nm(id)), s: t("rilevato", "detected") + " · " + ago(S[id].last_changed), id, cls: "alert" }));
  try { A.push(...(VISTE.meteoAvvisi?.() || [])); } catch {}   // allerte meteo da arancione in su (pages/meteo.js)
  try { A.push(...(VISTE.ariaAvvisi?.() || [])); } catch {}   // aria scarsa da più di 30 minuti, o dei minuti scelti (pages/aria.js)
  try { A.push(...(VISTE.acquaAvvisi?.() || [])); } catch {}   // possibile perdita d'acqua dal sensore di portata (pages/acqua.js)
  const clima = ents("climate", id => ok(id) && S[id].state !== "off");
  for (const o of aperte) {
    const conClima = clima.find(c => areaOf(c) && areaOf(c) === areaOf(o));
    const porta = ["door", "garage_door"].includes(deviceClass(o));
    if (conClima) A.push({ k: "cl:" + o + S[o].last_changed, ic: "🌡️", b: `${esc(shortName(o))} ${t("aperta col clima acceso", "open with climate on")}`, s: esc(nm(conClima)) + " · " + ago(S[o].last_changed), id: o, cls: "alert" });
    else if (porta && vecchio(o) > R.portaMin * MIN) A.push({ k: "po:" + o + S[o].last_changed, ic: "🚪", b: `${esc(shortName(o))} ${t("aperta da", "open for")} ${ago(S[o].last_changed).replace(t(" fa", " ago"), "")}`, s: t("forse è rimasta aperta", "maybe left open"), id: o, cls: "alert" });
    else A.push({ k: "ap:" + o + S[o].last_changed, ic: "🪟", b: esc(nm(o)), s: t("aperta", "open") + " · " + ago(S[o].last_changed), id: o, cls: "alert" });
  }
  if (inHome("pioggia") && openings().some(o => isOn(o) && deviceClass(o) === "window") && pioggia(R))
    A.unshift({ k: "rain", ic: "🌧️", b: t("Sta arrivando la pioggia", "Rain is coming"), s: t("ci sono finestre aperte", "some windows are open"), cls: "alert" });
  if (inHome("elettro")) for (const id of elettro()) if (soglie(id).avviso && EL[id]?.fine && Date.now() - EL[id].fine < R.finitoOre * 3600e3)
    A.push({ k: "el:" + id + EL[id].fine, ic: "🧺", b: `${esc(shortName(id).replace(/\s*(potenza|power|consumo)\s*/ig, " ").trim())} ${t("ha finito", "is done")}`, s: ago(new Date(EL[id].fine).toISOString()), id });
  const RF = inHome("raccolta") && new Date().getHours() >= R.raccoltaOra ? ritiri().domani : [];
  if (RF.length) A.push({ k: "rf:" + new Date().toDateString(), ic: "♻️", b: t("Stasera esponi", "Put out tonight"), s: RF.map(chip).join(" "), raw: true });
  /* pile scariche: le scelte della pagina Batterie (soglie, nascoste, aggiunte; niente telefoni, auto e batteria di casa) */
  const pagBatt = PAGES.batterie?.show() && LAYOUT.pages?.batterie !== false && utenteCfg().pages?.batterie !== false;
  /* i telefoni non sono pile: restano qui come prima (sotto il 20%, o la soglia scelta in ⚙️, e non in carica) */
  if (inHome("telefoni")) ents("person").map(info).filter(p => p.bat != null && p.bat < R.telBatt && !p.carica).forEach(p => A.push({ k: "tel:" + p.pid, ic: "📱", b: t("Telefono di ", "Phone of ") + esc(p.nome), s: `${t("batteria al", "battery at")} ${Math.round(p.bat)}%`, id: p.pid }));
  if (inHome("pile")) daCambiare().forEach(x => A.push({ k: "bt:" + x.k, ic: "🪫", b: esc(x.nome), s: (x.pct != null ? `${t("pila al", "battery at")} ${Math.round(x.pct)}%` : t("pila scarica", "battery low")) + (x.tipo ? " · " + esc(tTipo(x)) : ""), ...(pagBatt ? { go: "batterie" } : { id: x.id }) }));
  try { A.push(...(VISTE.caldaiaAvvisi?.() || [])); } catch {}   // promemoria della manutenzione della caldaia (pages/caldaia.js)
  try { A.push(...(VISTE.scadenzeAvvisi?.() || [])); } catch {}   // scadenze di oggi e scadute (pages/scadenze.js)
  try { A.push(...(VISTE.pianteAvvisi?.() || [])); } catch {}   // piante da annaffiare o concimare, piante con sete (pages/piante.js)
  A.push(...novitaAvvisi());   // dispositivi nuovi e auto nuove (solo amministratori)
  const U = Object.keys(S).filter(id => id.startsWith("update.") && S[id].state === "on");
  if (U.length && inHome("aggiornamenti")) A.push({ k: "up:" + U.join(","), ic: "⬆️", b: `${U.length} ${t(U.length === 1 ? "aggiornamento" : "aggiornamenti", U.length === 1 ? "update" : "updates")}`, s: U.slice(0, 3).map(id => esc(String(attr(id, "title") || nm(id)).replace(/\s*(update|aggiornamento)$/i, ""))).join(", "), go: "aggiornamenti" });
  const N = nascosti();
  return A.filter(a => !N[a.k]);
}

export function avvisiCard() {
  const A = avvisi(), n = A.length;
  return card(`🔔 ${t("Avvisi", "Alerts")} <span class="tag ${n ? "warn" : "ok"}">${n || t("tutto ok", "all good")}</span>`, n ? `<div class="stack">${A.map(a => `<div class="li av3 ${a.cls || ""}" ${a.act ? `data-act="${a.act}"` : a.go ? `data-act="go" data-id="${a.go}"` : a.id ? `data-act="more" data-id="${a.id}"` : ""} role="button">
      <span class="ic">${a.ic}</span><div class="tx"><b>${a.b}</b><span>${a.s}</span></div><button class="x3" data-act="avHide" data-k="${esc(a.k)}" aria-label="${t("Nascondi", "Dismiss")}">✕</button></div>`).join("")}</div>`
    : `<div class="small muted">${t("Nessuna finestra aperta, nessuna pila scarica, nessun aggiornamento.", "No open windows, no low batteries, no updates.")}</div>`,
    { right: isAdmin() ? `<div class="row" style="gap:6px"><button class="btn sm" data-act="avRegole" title="${t("Regole degli avvisi", "Alert rules")}" aria-label="${t("Regole degli avvisi", "Alert rules")}">⚙️</button><button class="btn sm" data-act="avNotif" title="${t("Avvisi sul telefono", "Alerts on the phone")}">📱${LAYOUT.notifiche?.servizi?.length ? " ✓" : ""}</button></div>` : "" });
}

/* ---------- avvisi anche sul telefono: creo (o aggiorno) l'automazione «'Nduja · avvisi» in Home Assistant ---------- */
const TIPI_N = () => [
  ["pericolo", "🚨 " + t("Fumo, gas, acqua, manomissione", "Smoke, gas, water, tamper")],
  ["allarme", "🛡️ " + t("Allarme scattato", "Alarm triggered")],
  ["porta", "🚪 " + t(`Porta o finestra aperta da ${regole().portaMin} min`, `Door or window open ${regole().portaMin} min`)],
  ["elettro", "🧺 " + t("Elettrodomestico finito", "Appliance done")],
  ["batteria", "🪫 " + t("Pila scarica (soglie della pagina Batterie)", "Low battery (thresholds from the Batteries page)")],
  ["pioggia", "🌧️ " + t("Inizia a piovere con finestre aperte", "Rain starts with windows open")],
  ["aggiornamento", "⬆️ " + t("Nuovo aggiornamento disponibile", "New update available")],
];
const servizi = () => { const s = cached("services", 3600e3, () => ws({ type: "get_services" })) || {}; return Object.keys(s.notify || {}).filter(k => !["send_message", "persistent_notification", "notify"].includes(k)).sort(); };
let NB = null;
function schedaNotifiche() {
  const c = NB, sv = servizi();
  const ck = (on, act, k, n) => `<button class="ck1 ${on ? "on" : ""}" data-act="${act}" data-k="${k}"><span class="bx"></span><span class="tx"><b>${n}</b></span></button>`;
  return `<div class="sh-head"><div><h3>📱 ${t("Avvisi sul telefono", "Alerts on the phone")}</h3><div class="small muted">${t("Creo in Home Assistant l'automazione «'Nduja · avvisi»: funziona anche a plancia chiusa.", "I create the «'Nduja · alerts» automation in Home Assistant: it works even with the dashboard closed.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("A chi", "To")}</div><div class="cks1">${sv.map(k => ck(c.servizi.includes(k), "avnS", k, esc(k.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ")))).join("") || `<div class="small muted">${t("Nessun telefono: installa l'app Home Assistant sul telefono.", "No phone: install the Home Assistant app on the phone.")}</div>`}</div>
    <div class="fl1">${t("Cosa", "What")}</div><div class="cks1">${TIPI_N().map(([k, n]) => ck(c.tipi[k] !== false, "avnT", k, n)).join("")}</div>
    <div class="small muted" style="margin-top:6px">🧺 ${t("Quando un elettrodomestico è in funzione o ha finito lo decidi tu, per ognuno: pagina Elettrodomestici → ✏️.", "When an appliance is running or done is up to you, for each one: Appliances page → ✏️.")}<br>🚪 ${t("Dopo quanti minuti avvisarti di una porta aperta lo scegli con ⚙️ nella scheda Avvisi.", "After how many minutes to tell you about an open door is set with ⚙️ on the Alerts card.")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="avnSave">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${LAYOUT.notifiche?.servizi?.length ? `<button class="btn bad" data-act="avnOff">${t("Spegni gli avvisi sul telefono", "Turn off phone alerts")}</button>` : ""}</div>`;
}
function automazione(c) {
  const T = [], tipo = k => c.tipi[k] !== false, R = regole();
  const danger = allEnts("binary_sensor", id => ["smoke", "gas", "carbon_monoxide", "moisture", "tamper", "safety"].includes(deviceClass(id)));
  if (tipo("pericolo") && danger.length) T.push({ trigger: "state", entity_id: danger, to: "on", id: "pericolo" });
  const al = allEnts("alarm_control_panel"); if (tipo("allarme") && al.length) T.push({ trigger: "state", entity_id: al, to: "triggered", id: "allarme" });
  const op = ents("binary_sensor", id => ["door", "window", "garage_door", "opening"].includes(deviceClass(id))); if (tipo("porta") && op.length) T.push({ trigger: "state", entity_id: op, to: "on", for: { minutes: R.portaMin }, id: "porta" });
  /* elettrodomestici: ognuno con le sue soglie (pagina Elettrodomestici → ✏️); raggruppo quelli con le stesse */
  const el = elettro().filter(id => soglie(id).avviso), gruppi = {};
  for (const id of el) { const g = soglie(id), k = g.off + "/" + g.min; (gruppi[k] = gruppi[k] || { below: g.off, min: g.min, ids: [] }).ids.push(id); }
  if (tipo("elettro")) for (const g of Object.values(gruppi)) T.push({ trigger: "numeric_state", entity_id: g.ids, below: g.below, for: { minutes: g.min }, id: "elettro" });
  const sopra = Object.fromEntries(el.map(id => [id, soglie(id).on]));
  /* pile: con le soglie e senza le pile nascoste della pagina Batterie */
  if (tipo("batteria")) {
    const B = perAutomazione();
    for (const [sg, L] of Object.entries(B.soglie)) T.push({ trigger: "numeric_state", entity_id: L, below: +sg, id: "batteria" });
    for (const [sg, L] of Object.entries(B.attributi)) T.push({ trigger: "numeric_state", entity_id: L, attribute: "battery_level", below: +sg, id: "batteria_attr" });
    if (B.basse.length) T.push({ trigger: "state", entity_id: B.basse, from: "off", to: "on", id: "batteria_bassa" });
  }
  const fin = ents("binary_sensor", id => deviceClass(id) === "window"), w = weatherEnt();
  if (tipo("pioggia") && fin.length && w) T.push({ trigger: "state", entity_id: w, to: ["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"], not_from: ["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"], id: "pioggia" });
  const up = Object.keys(S).filter(id => id.startsWith("update."));   // gli update hanno quasi sempre una categoria (config): allEnts li scarterebbe
  if (tipo("aggiornamento") && up.length) T.push({ trigger: "state", entity_id: up, from: "off", to: "on", id: "aggiornamento" });
  const msg = "{% set n = trigger.to_state.name %}{% if trigger.id == 'pericolo' %}🚨 {{ n }}: " + t("rilevato!", "detected!") + "{% elif trigger.id == 'allarme' %}🚨 " + t("Allarme scattato", "Alarm triggered") + ": {{ n }}{% elif trigger.id == 'porta' %}🚪 {{ n }} " + t(`aperta da ${R.portaMin} minuti`, `open for ${R.portaMin} minutes`) + "{% elif trigger.id == 'elettro' %}🧺 {{ n | regex_replace('(?i)\\s*(power|potenza|consumo)$', '') }} " + t("ha finito", "is done") + "{% elif trigger.id == 'pioggia' %}🌧️ " + t("Inizia a piovere e ci sono finestre aperte", "It's starting to rain and windows are open") + "{% elif trigger.id == 'aggiornamento' %}⬆️ " + t("Aggiornamento disponibile", "Update available") + ": {{ state_attr(trigger.entity_id, 'title') or n }} {{ state_attr(trigger.entity_id, 'latest_version') or '' }}{% elif trigger.id == 'batteria_bassa' %}🪫 {{ n | regex_replace('(?i)\\s*(battery|batteria)(\\s*(low|bassa))?$', '') }}: " + t("pila scarica", "battery low") + "{% elif trigger.id == 'batteria_attr' %}🪫 {{ n }} " + t("al", "at") + " {{ trigger.to_state.attributes.battery_level }}%{% else %}🪫 {{ n }} " + t("al", "at") + " {{ trigger.to_state.state }}%{% endif %}";
  return { id: "nduja_avvisi", alias: "'Nduja · " + t("avvisi sul telefono", "phone alerts"), description: t("Creata da 'Nduja Dashboard (Home → Avvisi → 📱)", "Created by 'Nduja Dashboard (Home → Alerts → 📱)"),
    triggers: T, conditions: [
      /* elettrodomestico finito solo se prima stava davvero lavorando (sopra 10 W): così il consumo a riposo che oscilla
         intorno ai 5 W, o la presa che torna disponibile dopo un riavvio, non manda avvisi a caso */
      ...(el.length && tipo("elettro") ? [{ condition: "template", value_template: "{{ trigger.id != 'elettro' or (trigger.from_state.state | float(0)) > " + JSON.stringify(sopra) + ".get(trigger.entity_id, 15) }}" }] : []),
      ...(fin.length && tipo("pioggia") ? [{ condition: "template", value_template: "{{ trigger.id != 'pioggia' or " + JSON.stringify(fin) + " | select('is_state', 'on') | list | count > 0 }}" }] : [])], actions: c.servizi.map(s => ({ action: "notify." + s, data: { title: "🌶️ 'Nduja", message: msg } })), mode: "queued", max: 20 };
}
/** dopo aver cambiato le soglie di un elettrodomestico: se gli avvisi sul telefono sono attivi, riscrivo l'automazione */
export async function aggiornaAvvisiTelefono() {
  if (!LAYOUT.notifiche?.servizi?.length) return false;
  const c = { tipi: {}, ...LAYOUT.notifiche }, cfg = automazione(c);
  if (!cfg.triggers.length) return false;
  try { await api("POST", "/api/config/automation/config/nduja_avvisi", cfg); return true; } catch { return false; }
}
Object.assign(ACT, {
  avNotif: () => { NB = JSON.parse(JSON.stringify(LAYOUT.notifiche || { servizi: [], tipi: {} })); NB.tipi = NB.tipi || {}; openSheet(schedaNotifiche); },
  avnS: el => { const k = el.dataset.k, i = NB.servizi.indexOf(k); i < 0 ? NB.servizi.push(k) : NB.servizi.splice(i, 1); render(); },
  avnT: el => { const k = el.dataset.k; NB.tipi[k] = NB.tipi[k] === false; render(); },
  avnSave: async () => {
    if (!NB.servizi.length) return toast(t("Scegli almeno un telefono", "Choose at least one phone"), true);
    const cfg = automazione(NB); if (!cfg.triggers.length) return toast(t("Niente da controllare in casa tua per questi avvisi", "Nothing to watch in your home for these alerts"), true);
    const nuova = !LAYOUT.notifiche?.servizi?.length;
    try { await api("POST", "/api/config/automation/config/nduja_avvisi", cfg);
      if (nuova) etichettaNduja(() => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === "nduja_avvisi"));   // nuova: etichetta «'Nduja»
      const c = NB; await cambia(l => { l.notifiche = c; }); closeSheet(); toast("📱 " + t("Avvisi sul telefono attivi", "Phone alerts on")); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  avnOff: async () => { try { await api("DELETE", "/api/config/automation/config/nduja_avvisi"); } catch {} await cambia(l => { delete l.notifiche; }); closeSheet(); toast(t("Avvisi sul telefono spenti", "Phone alerts off")); },
});
/* ---------- ⚙️ regole degli avvisi (per tutta la casa, solo amministratori) ---------- */
let RB = null;
function schedaRegole() {
  const r = RB, w = weatherEnt();
  const num = (k, lab) => `<label class="fld1"><span>${lab}</span><input type="number" inputmode="numeric" min="${REGOLE_LIM[k][0]}" max="${REGOLE_LIM[k][1]}" value="${r[k]}" data-chg="avrN" data-k="${k}"></label>`;
  const aiuto = s => `<p class="small muted" style="margin:6px 0 0;line-height:1.45">${s}</p>`;
  const ore = Array.from({ length: 12 }, (_, i) => i + 12);
  const ck = ([k, n]) => `<button class="ck1 ${r.off.includes(k) ? "" : "on"}" data-act="avrT" data-k="${k}"><span class="bx"></span><span class="tx"><b>${n}</b></span></button>`;
  const bat = ents("person").map(info).filter(p => p.bat != null);
  return `<div class="sh-head"><div><h3>⚙️ ${t("Regole degli avvisi", "Alert rules")}</h3><div class="small muted">${t("Valgono per tutta la casa: nella Home e, dove serve, negli avvisi sul telefono.", "They apply to the whole home: on Home and, where it matters, in the phone alerts.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">🚪 ${t("Porte", "Doors")}</div>
    <div class="apn1">${num("portaMin", t("Rimasta aperta dopo (minuti)", "Left open after (minutes)"))}</div>
    ${aiuto(t("Una porta aperta da più di così diventa «forse è rimasta aperta»; con 📱 attivo arriva anche sul telefono (porte e finestre).", "A door open longer than this becomes «maybe left open»; with 📱 on it also reaches the phone (doors and windows)."))}
    <div class="fl1">🌧️ ${t("Pioggia con finestre aperte", "Rain with windows open")}</div>
    <div class="apn1">${num("pioggiaOre", t("Guarda le prossime (ore)", "Look ahead (hours)"))}${num("pioggiaPr", t("Pioggia probabile da (%)", "Rain likely from (%)"))}</div>
    ${aiuto(t("Avviso se piove già o se le previsioni orarie danno pioggia, o almeno questa probabilità, nelle prossime ore.", "Alert if it's already raining or the hourly forecast shows rain, or at least this chance, in the next hours.") + (w ? ` ${t("Meteo usato", "Weather used")}: <b>${esc(nm(w))}</b>.` : ` ⚠️ ${t("Nessun meteo in casa.", "No weather in your home.")}`))}
    <div class="fl1">🧺 ${t("Elettrodomestici", "Appliances")}</div>
    <div class="apn1">${num("finitoOre", t("«Ha finito» resta per (ore)", "«Done» stays for (hours)"))}</div>
    ${aiuto(t("Dopo questo tempo l'avviso sparisce da solo. Le soglie di ogni elettrodomestico sono nella pagina Elettrodomestici → ✏️.", "After this time the alert goes away by itself. Each appliance's thresholds are on the Appliances page → ✏️."))}
    <div class="fl1">📱 ${t("Telefoni", "Phones")}</div>
    <div class="apn1">${num("telBatt", t("Scarico sotto (%)", "Low below (%)"))}</div>
    ${aiuto(t("Solo quando il telefono non è in carica.", "Only when the phone isn't charging.") + (bat.length ? " " + t("Adesso", "Now") + ": " + bat.map(p => `${esc(p.nome)} <b>${Math.round(p.bat)}%</b>`).join(" · ") + "." : "") + " " + t("Le pile dei sensori hanno le loro soglie nella pagina Batterie.", "Sensor batteries have their own thresholds on the Batteries page."))}
    ${haRaccolta() ? `<div class="fl1">♻️ ${t("Raccolta differenziata", "Waste collection")}</div>
    <label class="fld1"><span>${t("«Stasera esponi» dalle", "«Put out tonight» from")}</span><select data-chg="avrN" data-k="raccoltaOra">${ore.map(h => `<option value="${h}" ${h === r.raccoltaOra ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></label>
    ${aiuto(t("Da quest'ora gli Avvisi ricordano cosa portare fuori per il ritiro di domani.", "From this time the Alerts remind you what to put out for tomorrow's pickup."))}` : ""}
    <div class="fl1">🏠 ${t("Da mostrare nella Home", "Show on Home")}</div>
    <div class="cks1">${TIPI_HOME().map(ck).join("")}</div>
    ${aiuto(t("Fumo, gas, acqua e allarme si vedono sempre. Gli avvisi delle altre pagine (aria, acqua, meteo, piante, scadenze…) si regolano nelle loro pagine.", "Smoke, gas, water and alarm are always shown. Alerts from other pages (air, water, weather, plants, deadlines…) are set on their own pages."))}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="avrSave">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="avrDef">↺ ${t("Valori di partenza", "Defaults")}</button></div>`;
}
CHG.avrN = el => { const k = el.dataset.k, v = parseInt(el.value, 10), [lo, hi] = REGOLE_LIM[k];
  RB[k] = isNaN(v) ? REGOLE_DEF[k] : Math.min(hi, Math.max(lo, v)); render(); };
Object.assign(ACT, {
  avRegole: () => { RB = { ...regole(), off: [...(LAYOUT.avvisi?.off || [])] }; openSheet(schedaRegole); },
  avrT: el => { const k = el.dataset.k, i = RB.off.indexOf(k); i < 0 ? RB.off.push(k) : RB.off.splice(i, 1); render(); },
  avrDef: () => { RB = { ...REGOLE_DEF, off: [] }; render(); },
  avrSave: async () => {
    /* salvo solo quello che è diverso dai valori di partenza: chi non cambia niente resta come prima */
    const a = {}; for (const k in REGOLE_DEF) if (RB[k] !== REGOLE_DEF[k]) a[k] = RB[k];
    if (RB.off.length) a.off = [...RB.off];
    const porta = regole().portaMin;
    await cambia(l => { if (Object.keys(a).length) l.avvisi = a; else delete l.avvisi; });
    if (JSON.stringify(LAYOUT.avvisi || {}) !== JSON.stringify(a)) return;   // non salvato: l'errore l'ha già detto cambia()
    closeSheet();
    /* l'automazione del telefono usa i minuti della porta: la riscrivo se sono cambiati */
    const tel = regole().portaMin !== porta && await aggiornaAvvisiTelefono();
    toast("⚙️ " + t("Regole salvate", "Rules saved") + (tel ? " · 📱 " + t("automazione aggiornata", "automation updated") : ""));
  },
});
ACT.avHide = (el, e) => {
  e?.stopPropagation?.();
  const N = nascosti(); N[el.dataset.k] = Date.now();
  for (const k of Object.keys(N)) if (Date.now() - N[k] > 7 * 864e5) delete N[k];   // pulizia
  sSet("dismiss", JSON.stringify(N)); render();
};

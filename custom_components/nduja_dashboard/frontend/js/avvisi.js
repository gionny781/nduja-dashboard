/* Avvisi intelligenti sulla Home: unisce i vecchi «Da sistemare» a controlli più furbi.
   - finestra aperta con il clima acceso nella stessa stanza
   - pioggia in arrivo con finestre aperte
   - porta aperta da più di 10 minuti
   - elettrodomestico finito (lavatrice, asciugatrice, lavastoviglie: dal consumo)
   - pile scariche, telefoni scarichi, aggiornamenti, raccolta da esporre stasera
   Ogni avviso si può nascondere con ✕ (torna se la situazione cambia). */
import { S, ACT, CHG, LAYOUT, PAGES, VISTE, utenteCfg, t, esc, nm, ok, val, attr, ents, allEnts, isOn, ago, deviceClass, areaOf, openings, shortName, card, render, sGet, sSet, weatherEnt, forecast,
  ws, cached, api, toast, openSheet, closeSheet, isAdmin, etichettaNduja } from "./core.js";
import { cambia } from "./edit.js";
import { ritiri, chip } from "./raccolta.js";
import { pericoli } from "./pages/sicurezza.js";
import { novitaAvvisi } from "./novita.js";
import { daCambiare, perAutomazione, tTipo } from "./batterie.js";
import { info } from "./people.js";

const MIN = 6e4;
const vecchio = id => Date.now() - new Date(S[id].last_changed).getTime();
const nascosti = () => { try { return JSON.parse(sGet("dismiss") || "{}"); } catch { return {}; } };

/* --- elettrodomestici: seguo il consumo nel browser --- */
const ELETTRO = /lavatric|asciugatric|lavastovigl|washer|washing|dryer|dishwasher|forno|oven/i;
/** sensori di potenza da seguire in più (quelli scelti nella pagina Elettrodomestici) */
export const POTENZE_EXTRA = [];
const elettro = () => [...new Set([...allEnts("sensor", id => deviceClass(id) === "power" && ELETTRO.test(id + " " + nm(id)) && ok(id)), ...POTENZE_EXTRA.flatMap(f => { try { return f(); } catch { return []; } }).filter(id => S[id] && ok(id))])];
/** stato del ciclo di un sensore di potenza: { on: inizio (ms) o 0, fine: fine dell'ultimo ciclo (ms) } */
export const ciclo = id => EL[id] || { on: 0, fine: 0 };
let EL = {}; try { EL = JSON.parse(sGet("appl") || "{}"); } catch {}
function seguiElettro() {
  let cambiato = false;
  for (const id of elettro()) {
    const w = val(id) || 0, s = EL[id] || { on: 0, low: 0, fine: 0 }, now = Date.now();
    if (w > 15) { if (!s.on) s.on = now; s.low = 0; }
    else if (s.on && w < 5) {
      if (!s.low) s.low = now;
      if (now - s.low > 3 * MIN) { if (now - s.on > 10 * MIN) s.fine = now; s.on = 0; s.low = 0; }
    }
    if (JSON.stringify(s) !== JSON.stringify(EL[id])) { EL[id] = s; cambiato = true; }
  }
  if (cambiato) sSet("appl", JSON.stringify(EL));
}
setInterval(seguiElettro, 30000);

const pioggia = () => {
  const w = weatherEnt(); if (!w) return false;
  if (/rain|pour|lightning|hail/.test(S[w].state)) return true;
  const f = forecast(w, "hourly").slice(0, 3);
  return f.some(x => /rain|pour|lightning|hail/.test(x.condition || "") || (x.precipitation_probability || 0) >= 60);
};

/** elenco degli avvisi: { k (chiave per nasconderlo), ic, b, s, id?, go?, act?, cls } */
export function avvisi() {
  seguiElettro();
  const A = [], aperte = openings().filter(isOn);
  ents("alarm_control_panel", id => S[id].state === "triggered").forEach(id => A.push({ k: "al:" + id + S[id].last_changed, ic: "🚨", b: esc(nm(id)) + " — " + t("ALLARME!", "TRIGGERED!"), s: ago(S[id].last_changed), go: "sicurezza", cls: "alert" }));
  pericoli().forEach(id => A.push({ k: "pe:" + id + S[id].last_changed, ic: { smoke: "🔥", gas: "💨", carbon_monoxide: "☠️", moisture: "💧" }[deviceClass(id)] || "⚠️", b: esc(nm(id)), s: t("rilevato", "detected") + " · " + ago(S[id].last_changed), id, cls: "alert" }));
  const clima = ents("climate", id => ok(id) && S[id].state !== "off");
  for (const o of aperte) {
    const conClima = clima.find(c => areaOf(c) && areaOf(c) === areaOf(o));
    const porta = ["door", "garage_door"].includes(deviceClass(o));
    if (conClima) A.push({ k: "cl:" + o + S[o].last_changed, ic: "🌡️", b: `${esc(shortName(o))} ${t("aperta col clima acceso", "open with climate on")}`, s: esc(nm(conClima)) + " · " + ago(S[o].last_changed), id: o, cls: "alert" });
    else if (porta && vecchio(o) > 10 * MIN) A.push({ k: "po:" + o + S[o].last_changed, ic: "🚪", b: `${esc(shortName(o))} ${t("aperta da", "open for")} ${ago(S[o].last_changed).replace(t(" fa", " ago"), "")}`, s: t("forse è rimasta aperta", "maybe left open"), id: o, cls: "alert" });
    else A.push({ k: "ap:" + o + S[o].last_changed, ic: "🪟", b: esc(nm(o)), s: t("aperta", "open") + " · " + ago(S[o].last_changed), id: o, cls: "alert" });
  }
  if (aperte.some(o => deviceClass(o) === "window") && pioggia())
    A.unshift({ k: "rain", ic: "🌧️", b: t("Sta arrivando la pioggia", "Rain is coming"), s: t("ci sono finestre aperte", "some windows are open"), cls: "alert" });
  for (const id of elettro()) if (EL[id]?.fine && Date.now() - EL[id].fine < 6 * 3600e3)
    A.push({ k: "el:" + id + EL[id].fine, ic: "🧺", b: `${esc(shortName(id).replace(/\s*(potenza|power|consumo)\s*/ig, " ").trim())} ${t("ha finito", "is done")}`, s: ago(new Date(EL[id].fine).toISOString()), id });
  const R = new Date().getHours() >= 17 ? ritiri().domani : [];
  if (R.length) A.push({ k: "rf:" + new Date().toDateString(), ic: "♻️", b: t("Stasera esponi", "Put out tonight"), s: R.map(chip).join(" "), raw: true });
  /* pile scariche: le scelte della pagina Batterie (soglie, nascoste, aggiunte; niente telefoni, auto e batteria di casa) */
  const pagBatt = PAGES.batterie?.show() && LAYOUT.pages?.batterie !== false && utenteCfg().pages?.batterie !== false;
  /* i telefoni non sono pile: restano qui come prima (sotto il 20% e non in carica) */
  ents("person").map(info).filter(p => p.bat != null && p.bat < 20 && !p.carica).forEach(p => A.push({ k: "tel:" + p.pid, ic: "📱", b: t("Telefono di ", "Phone of ") + esc(p.nome), s: `${t("batteria al", "battery at")} ${Math.round(p.bat)}%`, id: p.pid }));
  daCambiare().forEach(x => A.push({ k: "bt:" + x.k, ic: "🪫", b: esc(x.nome), s: (x.pct != null ? `${t("pila al", "battery at")} ${Math.round(x.pct)}%` : t("pila scarica", "battery low")) + (x.tipo ? " · " + esc(tTipo(x)) : ""), ...(pagBatt ? { go: "batterie" } : { id: x.id }) }));
  try { A.push(...(VISTE.caldaiaAvvisi?.() || [])); } catch {}   // promemoria della manutenzione della caldaia (pages/caldaia.js)
  A.push(...novitaAvvisi());   // dispositivi nuovi e auto nuove (solo amministratori)
  const U = Object.keys(S).filter(id => id.startsWith("update.") && S[id].state === "on");
  if (U.length) A.push({ k: "up:" + U.join(","), ic: "⬆️", b: `${U.length} ${t(U.length === 1 ? "aggiornamento" : "aggiornamenti", U.length === 1 ? "update" : "updates")}`, s: U.slice(0, 3).map(id => esc(String(attr(id, "title") || nm(id)).replace(/\s*(update|aggiornamento)$/i, ""))).join(", "), go: "aggiornamenti" });
  const N = nascosti();
  return A.filter(a => !N[a.k]);
}

export function avvisiCard() {
  const A = avvisi(), n = A.length;
  return card(`🔔 ${t("Avvisi", "Alerts")} <span class="tag ${n ? "warn" : "ok"}">${n || t("tutto ok", "all good")}</span>`, n ? `<div class="stack">${A.map(a => `<div class="li av3 ${a.cls || ""}" ${a.act ? `data-act="${a.act}"` : a.go ? `data-act="go" data-id="${a.go}"` : a.id ? `data-act="more" data-id="${a.id}"` : ""} role="button">
      <span class="ic">${a.ic}</span><div class="tx"><b>${a.b}</b><span>${a.s}</span></div><button class="x3" data-act="avHide" data-k="${esc(a.k)}" aria-label="${t("Nascondi", "Dismiss")}">✕</button></div>`).join("")}</div>`
    : `<div class="small muted">${t("Nessuna finestra aperta, nessuna pila scarica, nessun aggiornamento.", "No open windows, no low batteries, no updates.")}</div>`,
    { right: isAdmin() ? `<button class="btn sm" data-act="avNotif" title="${t("Avvisi sul telefono", "Alerts on the phone")}">📱${LAYOUT.notifiche?.servizi?.length ? " ✓" : ""}</button>` : "" });
}

/* ---------- avvisi anche sul telefono: creo (o aggiorno) l'automazione «'Nduja · avvisi» in Home Assistant ---------- */
const TIPI_N = () => [
  ["pericolo", "🚨 " + t("Fumo, gas, acqua, manomissione", "Smoke, gas, water, tamper")],
  ["allarme", "🛡️ " + t("Allarme scattato", "Alarm triggered")],
  ["porta", "🚪 " + t("Porta o finestra aperta da più di 10 minuti", "Door or window open for over 10 minutes")],
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
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="avnSave">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${LAYOUT.notifiche?.servizi?.length ? `<button class="btn bad" data-act="avnOff">${t("Spegni gli avvisi sul telefono", "Turn off phone alerts")}</button>` : ""}</div>`;
}
function automazione(c) {
  const T = [], tipo = k => c.tipi[k] !== false;
  const danger = allEnts("binary_sensor", id => ["smoke", "gas", "carbon_monoxide", "moisture", "tamper", "safety"].includes(deviceClass(id)));
  if (tipo("pericolo") && danger.length) T.push({ trigger: "state", entity_id: danger, to: "on", id: "pericolo" });
  const al = allEnts("alarm_control_panel"); if (tipo("allarme") && al.length) T.push({ trigger: "state", entity_id: al, to: "triggered", id: "allarme" });
  const op = ents("binary_sensor", id => ["door", "window", "garage_door", "opening"].includes(deviceClass(id))); if (tipo("porta") && op.length) T.push({ trigger: "state", entity_id: op, to: "on", for: { minutes: 10 }, id: "porta" });
  const el = elettro(); if (tipo("elettro") && el.length) T.push({ trigger: "numeric_state", entity_id: el, below: 5, for: { minutes: 3 }, id: "elettro" });
  /* pile: con le soglie e senza le pile nascoste della pagina Batterie */
  if (tipo("batteria")) {
    const B = perAutomazione();
    for (const [sg, L] of Object.entries(B.soglie)) T.push({ trigger: "numeric_state", entity_id: L, below: +sg, id: "batteria" });
    for (const [sg, L] of Object.entries(B.attributi)) T.push({ trigger: "numeric_state", entity_id: L, attribute: "battery_level", below: +sg, id: "batteria_attr" });
    if (B.basse.length) T.push({ trigger: "state", entity_id: B.basse, from: "off", to: "on", id: "batteria_bassa" });
  }
  const fin = ents("binary_sensor", id => deviceClass(id) === "window"), w = weatherEnt();
  if (tipo("pioggia") && fin.length && w) T.push({ trigger: "state", entity_id: w, to: ["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"], not_from: ["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"], id: "pioggia" });
  const up = Object.keys(S).filter(id => id.startsWith("update."));   // gli update hanno quasi sempre una categoria (config): allEnts li scarterebbe if (tipo("aggiornamento") && up.length) T.push({ trigger: "state", entity_id: up, from: "off", to: "on", id: "aggiornamento" });
  const msg = "{% set n = trigger.to_state.name %}{% if trigger.id == 'pericolo' %}🚨 {{ n }}: " + t("rilevato!", "detected!") + "{% elif trigger.id == 'allarme' %}🚨 " + t("Allarme scattato", "Alarm triggered") + ": {{ n }}{% elif trigger.id == 'porta' %}🚪 {{ n }} " + t("aperta da 10 minuti", "open for 10 minutes") + "{% elif trigger.id == 'elettro' %}🧺 {{ n | regex_replace('(?i)\\s*(power|potenza|consumo)$', '') }} " + t("ha finito", "is done") + "{% elif trigger.id == 'pioggia' %}🌧️ " + t("Inizia a piovere e ci sono finestre aperte", "It's starting to rain and windows are open") + "{% elif trigger.id == 'aggiornamento' %}⬆️ " + t("Aggiornamento disponibile", "Update available") + ": {{ state_attr(trigger.entity_id, 'title') or n }} {{ state_attr(trigger.entity_id, 'latest_version') or '' }}{% elif trigger.id == 'batteria_bassa' %}🪫 {{ n | regex_replace('(?i)\\s*(battery|batteria)(\\s*(low|bassa))?$', '') }}: " + t("pila scarica", "battery low") + "{% elif trigger.id == 'batteria_attr' %}🪫 {{ n }} " + t("al", "at") + " {{ trigger.to_state.attributes.battery_level }}%{% else %}🪫 {{ n }} " + t("al", "at") + " {{ trigger.to_state.state }}%{% endif %}";
  return { id: "nduja_avvisi", alias: "'Nduja · " + t("avvisi sul telefono", "phone alerts"), description: t("Creata da 'Nduja Dashboard (Home → Avvisi → 📱)", "Created by 'Nduja Dashboard (Home → Alerts → 📱)"),
    triggers: T, conditions: fin.length && tipo("pioggia") ? [{ condition: "template", value_template: "{{ trigger.id != 'pioggia' or " + JSON.stringify(fin) + " | select('is_state', 'on') | list | count > 0 }}" }] : [], actions: c.servizi.map(s => ({ action: "notify." + s, data: { title: "🌶️ 'Nduja", message: msg } })), mode: "queued", max: 20 };
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
ACT.avHide = (el, e) => {
  e?.stopPropagation?.();
  const N = nascosti(); N[el.dataset.k] = Date.now();
  for (const k of Object.keys(N)) if (Date.now() - N[k] > 7 * 864e5) delete N[k];   // pulizia
  sSet("dismiss", JSON.stringify(N)); render();
};

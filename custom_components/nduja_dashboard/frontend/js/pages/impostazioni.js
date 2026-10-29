/* Impostazioni: il wizard per scegliere cosa mostrare nella plancia.
   Si parte da tutto acceso e si toglie quello che non serve; le scelte si salvano in Home Assistant
   (valgono su tutti i dispositivi) e solo un amministratore può cambiarle. */
import { scegli, isTemp, isHum, cambia } from "../edit.js";
import { ssMin, ssStile, ssDir } from "../salvaschermo.js";
import { schedeHome } from "./home.js";
import { controllaCard } from "../controlla.js";
import { S, UI, AREAS, FLOORS, REG, ACT, CHG, LAYOUT, PAGES, t, LOC, esc, nm, ok, attr, allEnts, shortName, climateSensors,
  saveLayout, render, toast, go, page, ws, openSheet, isAdmin, deviceClass, HVAC, manualKind, excluded, tema, navMode, chiosco, sGet, sSet } from "../core.js";

const DEV = ["cover", "switch", "fan", "lock", "media_player", "humidifier", "vacuum", "siren", "valve"];
const OPEN = ["door", "window", "opening", "garage_door"];
const W = { step: 0, d: null, ripreso: false, inCima: false };
const BASE = () => ({ mode: "auto", hiddenAreas: [], areaOrder: [], exclude: [], include: [], sensors: {}, pages: {}, weather: null });
const draft = () => {
  if (!W.d) W.d = JSON.parse(JSON.stringify({ ...BASE(), ...LAYOUT }));
  return W.d;
};
/* bozza della procedura guidata: resta su questo dispositivo finché non salvi o annulli,
   così se chiudi la plancia a metà riparti dal passo in cui eri */
const BOZZA = "wizard";
function salvaBozza() { if (W.d) sSet(BOZZA, JSON.stringify({ step: W.step, d: W.d, ts: Date.now() })); }
export function cancellaBozza() { try { localStorage.removeItem("nduja_" + BOZZA); } catch {} W.ripreso = false; W.inCima = false; }
export function bozza() { try { const b = JSON.parse(sGet(BOZZA) || "null"); return b && b.d && Date.now() - (b.ts || 0) < 30 * 864e5 ? b : null; } catch { return null; } }
(() => { const b = bozza(); if (b) { W.d = b.d; W.step = Math.max(0, Math.min(7, +b.step || 0)); W.ripreso = true; W.inCima = true; } })();
const PASSI = () => [t("Inizio", "Start"), t("Stanze", "Rooms"), t("Luci", "Lights"), t("Clima", "Climate"), t("Dispositivi", "Devices"), t("Casa", "Home"), t("Pagine", "Pages"), t("Fine", "Done")];

/* ---------- aiuti ---------- */
const areaDi = id => REG[id]?.area && AREAS[REG[id].area] ? REG[id].area : "_";
const visibile = a => a === "_" || !draft().hiddenAreas.includes(a);
function stanzeOrdinate() {
  const d = draft(), fl = f => FLOORS[f]?.level ?? 99, pos = a => { const i = d.areaOrder.indexOf(a); return i < 0 ? 999 : i; };
  return Object.keys(AREAS).sort((a, b) => fl(AREAS[a].floor) - fl(AREAS[b].floor) || pos(a) - pos(b) || AREAS[a].name.localeCompare(AREAS[b].name, LOC));
}
const statoBreve = id => { const s = S[id]; if (!s) return ""; if (!ok(id)) return t("non raggiungibile", "unavailable"); if (id.startsWith("climate.")) return HVAC()[s.state] || s.state; return s.state === "on" ? t("acceso", "on") : s.state === "off" ? t("spento", "off") : esc(s.state) + (attr(id, "unit_of_measurement") ? " " + esc(attr(id, "unit_of_measurement")) : ""); };
const manuale = id => draft().mode === "manual" && manualKind(id);
const acceso = id => manuale(id) ? draft().include.includes(id) : !draft().exclude.includes(id);
function riga(id) {
  const on = acceso(id);
  return `<button class="ck1 ${on ? "on" : ""}" data-act="wzX" data-id="${id}"><span class="bx"></span><span class="tx"><b>${esc(shortName(id))}</b><small>${esc(id)}</small></span><span class="st">${statoBreve(id)}</span></button>`;
}
/** elenco per stanza con «tutti / nessuno» */
function perStanza(ids, vuoto) {
  if (!ids.length) return `<div class="small muted">${vuoto}</div>`;
  const g = {}; ids.forEach(id => (g[areaDi(id)] = g[areaDi(id)] || []).push(id));
  const ord = [...stanzeOrdinate().filter(a => g[a] && visibile(a)), ...(g._ ? ["_"] : [])];
  const nascoste = Object.keys(g).filter(a => a !== "_" && !visibile(a)).length;
  return ord.map(a => `<div class="wg1"><div class="row between"><b>${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)}</b>
      <span class="row" style="gap:6px"><button class="btn sm" data-act="wzAll" data-v="1" data-ids="${g[a].join(",")}">${t("Tutti", "All")}</button><button class="btn sm" data-act="wzAll" data-v="0" data-ids="${g[a].join(",")}">${t("Nessuno", "None")}</button></span></div>
      <div class="cks1">${g[a].sort((x, y) => shortName(x).localeCompare(shortName(y), LOC)).map(riga).join("")}</div></div>`).join("")
    + (nascoste ? `<div class="small muted" style="margin-top:8px">${t(`${nascoste} stanze nascoste non sono elencate.`, `${nascoste} hidden rooms are not listed.`)}</div>` : "");
}

/* «Salta per ora»: rimetto questo passo com'era prima e vado avanti */
const OPEN_ID = id => id.startsWith("binary_sensor.") && OPEN.includes(deviceClass(id));
const DEL_PASSO = [null,
  null,
  id => id.startsWith("light."),
  id => id.startsWith("climate."),
  id => DEV.some(d => id.startsWith(d + ".")) || OPEN_ID(id),
  id => id.startsWith("person.") || id.startsWith("scene."),
  null, null];
function salta(step) {
  const d = draft(), L = { ...BASE(), ...JSON.parse(JSON.stringify(LAYOUT)) }, f = DEL_PASSO[step];
  if (step === 1) { d.hiddenAreas = L.hiddenAreas; d.areaOrder = L.areaOrder; }
  if (f) for (const k of ["include", "exclude"]) d[k] = [...d[k].filter(id => !f(id)), ...(L[k] || []).filter(f)];
  if (step === 3) d.sensors = L.sensors;
  if (step === 5) d.weather = L.weather;
  if (step === 6) d.pages = L.pages;
}

/* ---------- passi ---------- */
function passoInizio() {
  const n = d => allEnts(d).length;
  return `<div class="wz-h"><span>🌶️</span><div><h3>${t("Configuriamo la plancia", "Let's set up your dashboard")}</h3><p>${t("Ho trovato tutto questo in casa tua. Nei prossimi passi tieni acceso quello che vuoi vedere e spegni il resto: puoi tornare qui quando vuoi.", "This is what I found in your home. In the next steps keep on what you want to see and switch off the rest: you can come back any time.")}</p></div></div>
    <div class="wz-n">${[[Object.keys(AREAS).length, t("stanze", "rooms")], [n("light"), t("luci", "lights")], [n("climate"), t("termostati", "thermostats")], [DEV.reduce((s, d) => s + n(d), 0), t("dispositivi", "devices")], [n("person"), t("persone", "people")], [n("scene"), t("scene", "scenes")]]
      .map(([v, k]) => `<div><b>${v}</b><small>${k}</small></div>`).join("")}</div>
    <h4 class="wz-s">${t("Modalità", "Mode")}</h4>
    <div class="seg" style="max-width:520px">${[["auto", "✨ " + t("Automatica", "Automatic")], ["manual", "🛠️ " + t("Manuale", "Manual")]].map(([k, n]) => `<button class="${draft().mode === k ? "act" : ""}" data-act="wzMode" data-v="${k}">${n}</button>`).join("")}</div>
    <p class="small muted" style="margin-top:8px">${draft().mode === "manual" ? t("Manuale: si vede solo quello che accendi tu nei prossimi passi (o con ＋ Aggiungi nelle pagine).", "Manual: only what you switch on in the next steps (or add with ＋ Add on the pages) is shown.") : t("Automatica: si vede tutto quello che trovo, tranne quello che spegni.", "Automatic: everything I find is shown, except what you switch off.")}</p>
    ${!Object.keys(AREAS).length ? `<div class="note1">${t("Non ci sono aree in Home Assistant: creale in Impostazioni → Aree e assegna i dispositivi, la plancia funziona molto meglio.", "There are no areas in Home Assistant: create them in Settings → Areas and assign your devices, the dashboard works much better.")}</div>` : ""}`;
}
function passoStanze() {
  const d = draft(), A = stanzeOrdinate();
  if (!A.length) return `<div class="small muted">${t("Nessuna stanza.", "No rooms.")}</div>`;
  let piano = null;
  return `<p class="wz-p">${t("Scegli le stanze da mostrare e mettile nell'ordine che preferisci. Le stanze nascoste spariscono da tutte le pagine, con i loro dispositivi.", "Choose which rooms to show and put them in your order. Hidden rooms disappear from every page, with their devices.")}</p>` + A.map(a => {
    const f = AREAS[a].floor, head = f !== piano ? `<div class="fl1">${esc(FLOORS[f]?.name || t("Senza piano", "No floor"))}</div>` : ""; piano = f;
    const on = !d.hiddenAreas.includes(a), n = Object.keys(S).filter(id => REG[id]?.area === a).length;
    return `${head}<div class="ck1 ar ${on ? "on" : ""}"><button class="ckb" data-act="wzA" data-id="${a}"><span class="bx"></span><span class="tx"><b>${esc(AREAS[a].name)}</b><small>${n} ${t("entità", "entities")}</small></span></button>
      <span class="row" style="gap:4px"><button class="btn sm" data-act="wzMove" data-id="${a}" data-v="-1" aria-label="su">▲</button><button class="btn sm" data-act="wzMove" data-id="${a}" data-v="1" aria-label="giù">▼</button></span></div>`;
  }).join("");
}
const passoLuci = () => `<p class="wz-p">${draft().mode === "manual" ? t("Tocca le luci che vuoi nella plancia: diventano verdi.", "Tap the lights you want on the dashboard: they turn green.") : t("Spegni le luci che non vuoi vedere (per esempio i doppioni dei gruppi o le luci tecniche).", "Switch off the lights you don't want to see (for example group duplicates or technical lights).")}</p>` + perStanza(allEnts("light"), t("Nessuna luce.", "No lights."));
function passoClima() {
  const d = draft();
  const voce = (a, k) => { const v = d.sensors[a]?.[k] || "";
    return `<button class="btn sm sns2" data-act="wzSensorPick" data-id="${a}" data-k="${k}">${k === "temp" ? "🌡️" : "💧"} ${v === "none" ? t("nessuno", "none") : v && S[v] ? esc(shortName(v)) + ` <small>${esc(S[v].state)}${esc(attr(v, "unit_of_measurement") || "")}</small>` : t("Automatico", "Automatic")} ›</button>`; };
  const stanze = stanzeOrdinate().filter(a => visibile(a));
  return `<p class="wz-p">${t("Termostati e condizionatori da mostrare.", "Thermostats and air conditioners to show.")}</p>${perStanza(allEnts("climate"), t("Nessun termostato.", "No thermostats."))}
    ${stanze.length ? `<h4 class="wz-s">${t("Temperatura e umidità di ogni stanza", "Temperature and humidity of each room")}</h4><p class="wz-p">${t("Tocca per scegliere il sensore: puoi prendere qualsiasi sensore della casa, anche di un'altra stanza.", "Tap to choose the sensor: you can pick any sensor in the house, even from another room.")}</p>
      <div class="sns1">${stanze.map(a => `<div><b>${esc(AREAS[a].name)}</b>${voce(a, "temp")}${voce(a, "hum")}</div>`).join("")}</div>` : ""}`;
}
const passoDispositivi = () => `<p class="wz-p">${t("Tapparelle, prese, ventilatori, TV e serrature che compaiono nelle stanze.", "Covers, plugs, fans, TVs and locks shown in the rooms.")}</p>${perStanza(DEV.flatMap(d => allEnts(d)), t("Nessun dispositivo.", "No devices."))}
  <h4 class="wz-s">${t("Porte e finestre", "Doors and windows")}</h4>${perStanza(allEnts("binary_sensor", id => OPEN.includes(deviceClass(id))), t("Nessun sensore di porte o finestre.", "No door or window sensors."))}`;
function passoCasa() {
  const d = draft(), W2 = allEnts("weather"), P = allEnts("person"), SC = allEnts("scene");
  return `${W2.length ? `<h4 class="wz-s" style="margin-top:0">${t("Meteo", "Weather")}</h4><select data-chg="wzWeather" class="wz-sel"><option value="">${t("Automatico", "Automatic")}</option>${W2.map(id => `<option value="${id}" ${d.weather === id ? "selected" : ""}>${esc(nm(id))}</option>`).join("")}</select>` : ""}
    ${P.length ? `<h4 class="wz-s">${t("Persone", "People")}</h4><div class="cks1">${P.map(riga).join("")}</div>` : ""}
    ${SC.length ? `<h4 class="wz-s">${t("Scene nella Home", "Scenes on Home")}</h4><div class="cks1">${SC.map(riga).join("")}</div>` : ""}
    <h4 class="wz-s">${t("Altro nella Home", "More on Home")}</h4>${personalizza()}
    ${!W2.length && !P.length && !SC.length ? `<div class="small muted">${t("Niente da scegliere qui.", "Nothing to choose here.")}</div>` : ""}`;
}
function passoPagine() {
  const d = draft(), L = Object.keys(PAGES).filter(k => !["home", "impostazioni"].includes(k) && PAGES[k].show()).sort((a, b) => PAGES[a].order - PAGES[b].order);
  return `<p class="wz-p">${t("Le pagine che compaiono nel menu. La Home e le Impostazioni ci sono sempre.", "Pages shown in the menu. Home and Settings are always there.")}</p>
    <div class="cks1">${L.filter(k => !k.startsWith("c_")).map(k => `<button class="ck1 ${d.pages[k] !== false ? "on" : ""}" data-act="wzPage" data-id="${k}"><span class="bx"></span><span class="tx"><b>${PAGES[k].icon} ${esc(PAGES[k].title)}</b></span></button>`).join("")}</div>
    <h4 class="wz-s">${t("Le tue pagine", "Your pages")}</h4>
    <p class="wz-p">${t("Crea pagine tue (Giardino, Ufficio, Bambini…) e mettici dentro quello che vuoi con ✏️ Modifica → ＋ Aggiungi.", "Create your own pages (Garden, Office, Kids…) and put anything in them with ✏️ Edit → ＋ Add.")}</p>
    <div class="cks1">${(LAYOUT.customPages || []).map(p => `<button class="ck1 on" data-act="go" data-id="c_${p.id}"><span class="tx"><b>${esc(p.icon)} ${esc(p.title)}</b><small>${p.items.length} ${t("elementi", "items")}</small></span><span class="st">›</span></button>`).join("")}
      <button class="add1" data-act="edNewPage"><span>＋</span>${t("Nuova pagina", "New page")}</button></div>`;
}
function passoFine() {
  const d = draft(), tolte = d.mode === "manual" ? d.include.filter(id => S[id]).length : d.exclude.filter(id => S[id]).length;
  return `<div class="wz-h"><span>✅</span><div><h3>${t("Tutto pronto", "All set")}</h3><p>${t(`Modalità ${d.mode === "manual" ? "manuale" : "automatica"} · stanze nascoste: ${d.hiddenAreas.length} · elementi ${d.mode === "manual" ? "scelti" : "tolti"}: ${tolte}. Premi «Salva»: le scelte valgono su tutti i tablet e telefoni. Per cambiarle torna in ⚙️ Impostazioni.`, `${d.mode === "manual" ? "Manual" : "Automatic"} mode · hidden rooms: ${d.hiddenAreas.length} · items ${d.mode === "manual" ? "chosen" : "removed"}: ${tolte}. Press «Save»: your choices apply to every tablet and phone. To change them come back to ⚙️ Settings.`)}</p></div></div>
    <button class="btn sm" data-act="wzReset" style="margin-top:10px">↺ ${t("Annulla le scelte di questi passi", "Undo the choices in these steps")}</button>`;
}

/* scorciatoie per tutto quello che si può personalizzare */
function personalizza() {
  const b = (act, ic, n, s, id = "") => `<button class="li" data-act="${act}" ${id ? `data-id="${id}"` : ""}><span class="ic">${ic}</span><div class="tx"><b>${n}</b><span>${s}</span></div><span class="st">›</span></button>`;
  return `<div class="stack">
    ${b("goEdit", "🏠", t("Home: schede, ordine, stanze", "Home: cards, order, rooms"), t("Apre la Home in modifica: sposta ▲▼, nascondi, ✏️ sulle stanze e sui sensori", "Opens Home in edit mode: move ▲▼, hide, ✏️ rooms and sensors"), "home")}
    ${b("wxEdit", "🌤️", t("Meteo", "Weather"), t("Da dove prendo il meteo", "Weather source"))}
    ${b("rfEdit", "♻️", t("Raccolta differenziata", "Waste collection"), t("Sensori e calendari dei ritiri", "Pickup sensors and calendars"))}
    ${b("calEdit", "📅", t("Calendari", "Calendars"), t("Quali calendari mostrare", "Which calendars to show"))}
    ${b("sqEdit", "⚽", t("La mia squadra", "My team"), t("Le squadre che segui: Team Tracker, Calcio Live o un calendario", "The teams you follow: Team Tracker, Calcio Live or a calendar"))}
    ${b("cfgExport", "⬇️", t("Esporta le impostazioni", "Export settings"), t("Scarica un file con tutte le scelte della plancia (backup o per un altro Home Assistant)", "Download a file with every dashboard choice (backup or another Home Assistant)"))}
    ${b("cfgImport", "⬆️", t("Importa le impostazioni", "Import settings"), t("Carica un file esportato prima: sostituisce le scelte attuali", "Load a previously exported file: replaces the current choices"))}
  </div>`;
}

/* scelte di questo tablet o telefono (non toccano gli altri dispositivi) */
function dispositivo() {
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, n]) => `<button class="${cur === k ? "act" : ""}" data-act="${act}" data-v="${k}">${n}</button>`).join("")}</div>`;
  return `<section class="card dev1"><div class="ch"><h2>📱 ${t("Questo dispositivo", "This device")}</h2></div>
    <div class="dev1g"><div><b>${t("Tema", "Theme")}</b>${seg("themeSet", tema(), [["auto", "◐ " + t("Automatico", "Auto")], ["light", "☀︎ " + t("Chiaro", "Light")], ["dark", "☾ " + t("Scuro", "Dark")]])}</div>
    <div><b>${t("Barra di navigazione", "Navigation bar")}</b>${seg("navMode", navMode(), [["fixed", t("Sempre visibile", "Always visible")], ["auto", t("A scomparsa", "Auto-hide")]])}
      <small class="muted">${t("A scomparsa: compare avvicinandoti al bordo, toccando la linguetta o scorrendo verso l'alto.", "Auto-hide: it appears when you move to the edge, tap the handle or scroll up.")}</small></div>
    <div><b>${t("Salvaschermo", "Screensaver")}</b>${seg("ssMin", String(ssMin()), [["0", t("Spento", "Off")], ["1", "1 min"], ["5", "5 min"], ["10", "10 min"], ["30", "30 min"]])}
      ${ssMin() ? `<div style="margin-top:6px">${seg("ssStile", ssStile(), [["orologio", "🕐 " + t("Orologio", "Clock")], ["foto", "🖼️ " + t("Foto", "Photos")]])}</div>
      <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${ssStile() === "foto" ? `<button class="btn sm" data-act="ssDir">📁 ${ssDir() ? esc(decodeURIComponent(ssDir().split("/").pop() || "")) : t("Scegli la cartella", "Choose folder")}</button>` : ""}<button class="btn sm" data-act="ssProva">▶ ${t("Prova", "Try")}</button></div>` : ""}
      <small class="muted">${t("Dopo qualche minuto senza tocchi: orologio grande, meteo e temperatura di casa, oppure le tue foto. Si sveglia al tocco.", "After a few minutes without touches: big clock, weather and home temperature, or your photos. Wakes on touch.")}</small></div>
    <div><b>${t("Modalità chiosco", "Kiosk mode")}</b>${seg("kioskSet", chiosco() ? "1" : "0", [["0", t("Spenta", "Off")], ["1", "🖥️ " + t("Attiva", "On")]])}
      <small class="muted">${t("Nasconde la barra laterale e l'intestazione di Home Assistant su questo dispositivo, a ogni apertura. Il pulsante ⛶ in alto mette a tutto schermo (dove il browser lo permette).", "Hides Home Assistant's sidebar and header on this device, every time. The ⛶ button at the top goes full screen (where the browser allows it).")}</small></div></div></section>`;
}
ACT.kioskSet = el => { if ((el.dataset.v === "1") !== chiosco()) ACT.kiosk(); };
ACT.themeSet = el => { try { localStorage.setItem("nduja_theme", el.dataset.v); } catch {} ; ACT.theme && (document.body.classList.remove("light")); render(true); };

const inCorso = () => W.inCima && !!W.d;
function pagina() {
  if (!isAdmin()) return `<div class="g">${dispositivo()}<section class="card small muted">${t("Le altre impostazioni le può cambiare solo un amministratore.", "Other settings can only be changed by an administrator.")}</section></div>`;
  const P = PASSI(), s = W.step, corpo = [passoInizio, passoStanze, passoLuci, passoClima, passoDispositivi, passoCasa, passoPagine, passoFine][s]();
  const altre = `${dispositivo()}<section class="card rst1"><div class="row" style="gap:12px;flex-wrap:wrap"><span style="font-size:28px">🌶️</span>
      <div style="flex:1;min-width:200px"><b>${t("Ricomincia dal benvenuto", "Restart from the welcome screen")}</b><div class="small muted">${t("Riparte la configurazione da zero: scegli di nuovo Automatica o Manuale. Le pagine create da te restano.", "Setup starts over: choose Automatic or Manual again. Pages you created are kept.")}</div></div>
      <button class="btn warm" data-act="wzRestart">🔄 ${t("Riavvia il wizard", "Restart the wizard")}</button></div></section>
    <section class="card"><div class="ch"><h2>👥 ${t("Plancia per persona", "Per-person dashboard")}</h2></div>
      <p class="small muted" style="margin:0 0 10px">${t("Per ogni utente di Home Assistant scegli quali pagine e quali schede della Home vede (per esempio una plancia più semplice per chi non ci smanetta). Gli amministratori vedono sempre Impostazioni.", "For each Home Assistant user choose which pages and Home cards they see (e.g. a simpler dashboard for less techy people). Admins always see Settings.")}</p>
      <div class="vr1">${utenti().map(u => `<button data-act="usEdit" data-id="${esc(u.id)}">${u.is_owner ? "👑" : u.group_ids?.includes("system-admin") ? "🛠️" : "👤"} ${esc(u.name)}${LAYOUT.users?.[u.id] ? " ✏️" : ""}</button>`).join("") || `<span class="small muted">${t("Carico gli utenti…", "Loading users…")}</span>`}</div></section>
    <section class="card"><div class="ch"><h2>🎨 ${t("Personalizza", "Customize")}</h2></div>${personalizza()}
      <p class="small muted" style="margin-top:10px">${t("In ogni pagina c'è ✏️ Modifica in alto: ＋ aggiungi, ✏️ cambia, ✕ togli.", "Every page has ✏️ Edit at the top: ＋ add, ✏️ change, ✕ remove.")}</p></section>
    ${controllaCard()}
`;
  const guida = `<section class="card wz1">
    <div class="wz-steps">${P.map((n, i) => `<button class="${i === s ? "act" : i < s ? "done" : ""}" data-act="wzGo" data-v="${i}"><i>${i < s ? "✓" : i + 1}</i><span>${n}</span></button>`).join("")}</div>
    ${W.ripreso ? `<div class="note1 wz-rip">↩️ ${t(`Ho ripreso da dove eri rimasto (passo ${s + 1}, ${P[s]}). Le scelte non sono ancora salvate.`, `Picked up where you left off (step ${s + 1}, ${P[s]}). Your choices are not saved yet.`)}
      <button class="btn sm" data-act="wzDaCapo">${t("Ricomincia da capo", "Start over")}</button></div>` : ""}
    <div class="wz-body">${corpo}</div>
    <div class="wz-nav"><button class="btn" data-act="wzGo" data-v="${s - 1}" ${s === 0 ? "disabled" : ""}>← ${t("Indietro", "Back")}</button>
      <button class="btn ghost" data-act="wzAnnulla" title="${t("Esci senza salvare", "Leave without saving")}">${t("Annulla", "Cancel")}</button><span class="grow"></span>
      ${s < P.length - 1 ? `${s > 0 && s < P.length - 1 ? `<button class="btn ghost" data-act="wzSalta">${t("Salta per ora", "Skip for now")}</button>` : ""}<button class="btn" data-act="wzSave">${t("Salva", "Save")}</button><button class="btn pri" data-act="wzGo" data-v="${s + 1}">${t("Avanti", "Next")} →</button>` : `<button class="btn pri" data-act="wzSave">💾 ${t("Salva", "Save")}</button>`}</div>
  </section>`;
  /* procedura guidata in corso: la metto in cima, così si vede subito */
  return `<div class="g">${inCorso() ? guida + altre : altre + guida}</div>`;
}

/* dispositivi già visti (novita.js): valgono quelli di adesso, non quelli copiati quando è partita la procedura */
const visti = () => Object.fromEntries(["seen", "seenCars"].filter(k => Array.isArray(LAYOUT[k])).map(k => [k, LAYOUT[k]]));

/* ---------- azioni ---------- */
const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };
/* ogni azione del wizard aggiorna anche la bozza di questo dispositivo */
const conBozza = o => { for (const k in o) { const f = o[k]; o[k] = async (...a) => { const r = await f(...a); if (W.d && k !== "wzAnnulla" && k !== "wzRestart") salvaBozza(); return r; }; } return o; };
Object.assign(ACT, conBozza({
  wzSalta: () => { salta(W.step); W.ripreso = false; ACT.wzGo({ dataset: { v: W.step + 1 } }); toast("⏭️ " + t("Saltato: potrai farlo quando vuoi da ⚙️ Impostazioni.", "Skipped: you can do it any time from ⚙️ Settings.")); },
  wzDaCapo: () => { const m = draft().mode; cancellaBozza(); W.d = null; draft().mode = m; W.step = 0; W.inCima = true; render(true); },
  wzAnnulla: () => {
    W.d = null; W.step = 0; cancellaBozza();
    toast(t("Nessuna modifica salvata.", "Nothing was changed."));
    go(LAYOUT.configured ? "home" : "benvenuto");
  },
}));
Object.assign(ACT, conBozza({
  wzGo: el => { W.ripreso = false; W.step = Math.max(0, Math.min(PASSI().length - 1, +el.dataset.v)); draft(); render(); document.querySelector(".wz1")?.scrollIntoView({ block: "start" }); },
  wzX: el => { const id = el.dataset.id; toggle(manuale(id) ? draft().include : draft().exclude, id); render(); },
  wzMode: el => {
    const d = draft(), m = el.dataset.v; if (d.mode === m) return;
    const K = Object.keys(S).filter(manualKind);
    if (m === "manual") d.include = K.filter(id => !d.exclude.includes(id) && !REG[id]?.hidden && REG[id]?.cat == null);   // tengo quello che si vede adesso
    else d.exclude = K.filter(id => !d.include.includes(id));
    d.mode = m; render();
  },
  wzA: el => { toggle(draft().hiddenAreas, el.dataset.id); render(); },
  wzAll: el => {
    const d = draft(), ids = el.dataset.ids.split(","), on = el.dataset.v === "1", man = ids.filter(manuale), aut = ids.filter(id => !manuale(id));
    d.include = on ? [...new Set([...d.include, ...man])] : d.include.filter(x => !man.includes(x));
    d.exclude = on ? d.exclude.filter(x => !aut.includes(x)) : [...new Set([...d.exclude, ...aut])]; render();
  },
  wzPage: el => { const d = draft(), k = el.dataset.id; d.pages[k] = d.pages[k] === false ? true : false; render(); },
  wzMove: el => {
    const d = draft(), A = stanzeOrdinate(), i = A.indexOf(el.dataset.id), j = i + +el.dataset.v;
    if (j < 0 || j >= A.length || AREAS[A[j]].floor !== AREAS[A[i]].floor) return;
    [A[i], A[j]] = [A[j], A[i]]; d.areaOrder = A; render();
  },
  wzRestart: async el => {
    if (el.dataset.sure !== "1") { el.dataset.sure = "1"; el.textContent = t("Sicuro? Tocca ancora", "Sure? Tap again"); setTimeout(() => { if (el.isConnected) { el.dataset.sure = ""; el.textContent = "🔄 " + t("Riavvia il wizard", "Restart the wizard"); } }, 3500); return; }
    try { await saveLayout({ configured: false, customPages: LAYOUT.customPages || [] }); W.d = null; W.step = 0; cancellaBozza(); go("benvenuto"); }
    catch (e) { toast(t("Non riuscito: ", "Failed: ") + (e.message || e.code), true); }
  },
  wzReset: () => { W.d = { mode: draft().mode, hiddenAreas: [], areaOrder: [], exclude: [], include: [], sensors: {}, pages: {}, weather: null, customPages: draft().customPages || [] }; render(); },
  wzSave: async () => {
    try { await saveLayout({ ...draft(), customPages: LAYOUT.customPages || [], ...visti(), configured: true }); toast("💾 " + t("Impostazioni salvate", "Settings saved")); if (W.step === PASSI().length - 1) { W.step = 0; W.d = null; cancellaBozza(); go("home"); } else W.ripreso = false; }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
  },
  wzAuto: () => saveLayout({ ...LAYOUT, configured: true }).then(() => toast("👍 " + t("Ok, mostro tutto. Puoi cambiare idea in ⚙️ Impostazioni.", "Ok, showing everything. You can change it in ⚙️ Settings."))).catch(() => {}),
}));
/* ---------- plancia per persona ---------- */
let UT = null;
function utenti() { if (!UT) { UT = []; ws({ type: "config/auth/list" }).then(L => { UT = L.filter(u => !u.system_generated && u.is_active); render(); }).catch(() => {}); } return UT; }
let uSel = null;
function schedaUtente() {
  const u = utenti().find(x => x.id === uSel); if (!u) return "";
  const c = LAYOUT.users?.[u.id] || {}, P = Object.keys(PAGES).filter(k => !PAGES[k].hiddenNav && !["home", "impostazioni"].includes(k) && PAGES[k].show()).sort((a, b) => PAGES[a].order - PAGES[b].order);
  const ck = (on, act, k, n) => `<button class="ck1 ${on ? "on" : ""}" data-act="${act}" data-k="${k}"><span class="bx"></span><span class="tx"><b>${n}</b></span></button>`;
  return `<div class="sh-head"><div><h3>👤 ${esc(u.name)}</h3><div class="small muted">${t("Spegni quello che questa persona non deve vedere. Vale su tutti i suoi dispositivi.", "Switch off what this person shouldn't see. Applies on all their devices.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("Pagine", "Pages")}</div><div class="cks1">${P.map(k => ck(c.pages?.[k] !== false, "usPage", k, PAGES[k].icon + " " + esc(PAGES[k].title))).join("")}</div>
    <div class="fl1">${t("Schede della Home", "Home cards")}</div><div class="cks1">${schedeHome().map(([k, n]) => ck(!(c.homeHidden || []).includes(k), "usHome", k, esc(n))).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-act="usSemplice">🧸 ${t("Plancia semplice", "Simple dashboard")}</button><button class="btn" data-act="usReset">↺ ${t("Vede tutto", "Sees everything")}</button></div>
    <p class="small muted" style="margin-top:10px">${t("«Plancia semplice»: solo Home, Luci, Clima e Musica; in Home saluto, meteo, stanze, momenti e persone.", "«Simple dashboard»: only Home, Lights, Climate and Music; on Home greeting, weather, rooms, moments and people.")}</p>`;
}
const salvaU = fn => { const id = uSel; return cambia(l => { l.users = { ...(l.users || {}) }; const c = l.users[id] = JSON.parse(JSON.stringify(l.users[id] || {})); fn(c); if (!Object.keys(c.pages || {}).length && !(c.homeHidden || []).length) delete l.users[id]; }); };
Object.assign(ACT, {
  usEdit: el => { uSel = el.dataset.id; openSheet(schedaUtente); },
  usPage: el => salvaU(c => { c.pages = c.pages || {}; const k = el.dataset.k; if (c.pages[k] === false) delete c.pages[k]; else c.pages[k] = false; }),
  usHome: el => salvaU(c => { const h = new Set(c.homeHidden || []), k = el.dataset.k; h.has(k) ? h.delete(k) : h.add(k); c.homeHidden = [...h]; }),
  usReset: () => salvaU(c => { delete c.pages; delete c.homeHidden; }),
  usSemplice: () => salvaU(c => {
    const tieni = ["luci", "clima", "musica"]; c.pages = {};
    Object.keys(PAGES).filter(k => !["home", "impostazioni", ...tieni].includes(k) && !PAGES[k].hiddenNav).forEach(k => c.pages[k] = false);
    c.homeHidden = schedeHome().map(([k]) => k).filter(k => !["riepilogo", "meteo", "stanze", "momenti", "persone"].includes(k));
  }),
});
ACT.cfgExport = () => {
  const dati = { nduja: UI.version, esportato: new Date().toISOString(), layout: LAYOUT };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
  a.download = "nduja-dashboard-" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); a.remove();
  toast("⬇️ " + t("File scaricato", "File downloaded"));
};
ACT.cfgImport = () => {
  const i = document.createElement("input"); i.type = "file"; i.accept = ".json,application/json";
  i.onchange = async () => {
    try {
      const d = JSON.parse(await i.files[0].text()), l = d.layout || d;
      if (typeof l !== "object" || Array.isArray(l)) throw new Error(t("file non valido", "invalid file"));
      if (!confirm(t("Sostituire tutte le scelte della plancia con quelle del file?", "Replace every dashboard choice with the file's?"))) return;
      await saveLayout(l); toast("⬆️ " + t("Impostazioni importate", "Settings imported")); go("home");
    } catch (e) { toast(t("Non importato: ", "Not imported: ") + (e.message || e), true); }
  };
  i.click();
};
ACT.goEdit = el => { ACT.go(el); UI.edit = true; render(true); };
ACT.wzSensorPick = el => { const a = el.dataset.id, k = el.dataset.k, d = draft();
  scegli({ titolo: (k === "temp" ? "🌡️ " : "💧 ") + esc(AREAS[a].name), filtro: k === "temp" ? isTemp : isHum, area: a, attuale: d.sensors[a]?.[k] || "", nessuno: true,
    onPick: id => { d.sensors[a] = { ...(d.sensors[a] || {}), [k]: id || undefined }; salvaBozza(); } }); };
CHG.wzSensor = el => { const d = draft(), a = el.dataset.id; d.sensors[a] = { ...(d.sensors[a] || {}), [el.dataset.k]: el.value || undefined }; salvaBozza(); };
CHG.wzWeather = el => { draft().weather = el.value || null; salvaBozza(); };

page("impostazioni", { title: t("Impostazioni", "Settings"), short: t("Impost.", "Settings"), icon: "⚙️", order: 99, bare: true, render: pagina });

/** dal benvenuto: modalità manuale, si parte da zero e si va ai passi */
export function startManual() {
  W.d = JSON.parse(JSON.stringify({ hiddenAreas: [], areaOrder: [], sensors: {}, pages: {}, weather: null, ...LAYOUT, mode: "manual", include: [], exclude: [] }));
  W.step = 1; W.ripreso = false; W.inCima = true; salvaBozza(); go("impostazioni");
}
/** dal riepilogo dell'automatica: «voglio scegliere io», si parte con tutto acceso */
export function startAuto() {
  W.d = JSON.parse(JSON.stringify({ ...BASE(), ...LAYOUT, mode: "auto" }));
  W.step = 1; W.ripreso = false; W.inCima = true; salvaBozza(); go("impostazioni");
}
/** riprende la procedura guidata lasciata a metà */
export function riprendi() { const b = bozza(); if (b) { W.d = b.d; W.step = b.step; W.ripreso = true; W.inCima = true; } go("impostazioni"); }

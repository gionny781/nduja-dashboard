/* Impostazioni: il wizard per scegliere cosa mostrare nella plancia.
   Si parte da tutto acceso e si toglie quello che non serve; le scelte si salvano in Home Assistant
   (valgono su tutti i dispositivi) e solo un amministratore può cambiarle. */
import { S, AREAS, FLOORS, REG, ACT, CHG, LAYOUT, PAGES, t, LOC, esc, nm, ok, attr, allEnts, shortName, climateSensors,
  saveLayout, render, toast, go, page, isAdmin, deviceClass, HVAC, manualKind, excluded } from "../core.js";

const DEV = ["cover", "switch", "fan", "lock", "media_player", "humidifier", "vacuum", "siren", "valve"];
const OPEN = ["door", "window", "opening", "garage_door"];
const W = { step: 0, d: null };
const draft = () => {
  if (!W.d) W.d = JSON.parse(JSON.stringify({ mode: "auto", hiddenAreas: [], areaOrder: [], exclude: [], include: [], sensors: {}, pages: {}, weather: null, ...LAYOUT }));
  return W.d;
};
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
  const sel = (a, k, dc) => { const L = climateSensors(a, dc), v = d.sensors[a]?.[k] || "";
    return `<select data-chg="wzSensor" data-id="${a}" data-k="${k}"><option value="" ${!v ? "selected" : ""}>${t("Automatico", "Automatic")}</option>${L.map(id => `<option value="${id}" ${v === id ? "selected" : ""}>${esc(shortName(id))} (${esc(S[id].state)}${esc(attr(id, "unit_of_measurement") || "")})</option>`).join("")}<option value="none" ${v === "none" ? "selected" : ""}>${t("Nessuno", "None")}</option></select>`; };
  const stanze = stanzeOrdinate().filter(a => visibile(a) && (climateSensors(a, "temperature").length || climateSensors(a, "humidity").length));
  return `<p class="wz-p">${t("Termostati e condizionatori da mostrare.", "Thermostats and air conditioners to show.")}</p>${perStanza(allEnts("climate"), t("Nessun termostato.", "No thermostats."))}
    ${stanze.length ? `<h4 class="wz-s">${t("Temperatura e umidità di ogni stanza", "Temperature and humidity of each room")}</h4><p class="wz-p">${t("Se in una stanza ci sono più sensori, scegli quale usare.", "If a room has more sensors, choose which one to use.")}</p>
      <div class="sns1">${stanze.map(a => `<div><b>${esc(AREAS[a].name)}</b><label>🌡️ ${sel(a, "temp", "temperature")}</label><label>💧 ${sel(a, "hum", "humidity")}</label></div>`).join("")}</div>` : ""}`;
}
const passoDispositivi = () => `<p class="wz-p">${t("Tapparelle, prese, ventilatori, TV e serrature che compaiono nelle stanze.", "Covers, plugs, fans, TVs and locks shown in the rooms.")}</p>${perStanza(DEV.flatMap(d => allEnts(d)), t("Nessun dispositivo.", "No devices."))}
  <h4 class="wz-s">${t("Porte e finestre", "Doors and windows")}</h4>${perStanza(allEnts("binary_sensor", id => OPEN.includes(deviceClass(id))), t("Nessun sensore di porte o finestre.", "No door or window sensors."))}`;
function passoCasa() {
  const d = draft(), W2 = allEnts("weather"), P = allEnts("person"), SC = allEnts("scene");
  return `${W2.length ? `<h4 class="wz-s" style="margin-top:0">${t("Meteo", "Weather")}</h4><select data-chg="wzWeather" class="wz-sel"><option value="">${t("Automatico", "Automatic")}</option>${W2.map(id => `<option value="${id}" ${d.weather === id ? "selected" : ""}>${esc(nm(id))}</option>`).join("")}</select>` : ""}
    ${P.length ? `<h4 class="wz-s">${t("Persone", "People")}</h4><div class="cks1">${P.map(riga).join("")}</div>` : ""}
    ${SC.length ? `<h4 class="wz-s">${t("Scene nella Home", "Scenes on Home")}</h4><div class="cks1">${SC.map(riga).join("")}</div>` : ""}
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
    <button class="btn sm" data-act="wzReset" style="margin-top:10px">↺ ${t("Ricomincia da capo (mostra tutto)", "Start over (show everything)")}</button>`;
}

function pagina() {
  if (!isAdmin()) return `<div class="g">${`<section class="card">${t("Solo un amministratore può cambiare le impostazioni.", "Only an administrator can change the settings.")}</section>`}</div>`;
  const P = PASSI(), s = W.step, corpo = [passoInizio, passoStanze, passoLuci, passoClima, passoDispositivi, passoCasa, passoPagine, passoFine][s]();
  return `<div class="g"><section class="card wz1">
    <div class="wz-steps">${P.map((n, i) => `<button class="${i === s ? "act" : i < s ? "done" : ""}" data-act="wzGo" data-v="${i}"><i>${i < s ? "✓" : i + 1}</i><span>${n}</span></button>`).join("")}</div>
    <div class="wz-body">${corpo}</div>
    <div class="wz-nav"><button class="btn" data-act="wzGo" data-v="${s - 1}" ${s === 0 ? "disabled" : ""}>← ${t("Indietro", "Back")}</button><span class="grow"></span>
      ${s < P.length - 1 ? `<button class="btn" data-act="wzSave">${t("Salva", "Save")}</button><button class="btn pri" data-act="wzGo" data-v="${s + 1}">${t("Avanti", "Next")} →</button>` : `<button class="btn pri" data-act="wzSave">💾 ${t("Salva", "Save")}</button>`}</div>
  </section></div>`;
}

/* ---------- azioni ---------- */
const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };
Object.assign(ACT, {
  wzGo: el => { W.step = Math.max(0, Math.min(PASSI().length - 1, +el.dataset.v)); draft(); render(); document.querySelector(".wz1")?.scrollIntoView({ block: "start" }); },
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
  wzReset: () => { W.d = { mode: draft().mode, hiddenAreas: [], areaOrder: [], exclude: [], include: [], sensors: {}, pages: {}, weather: null, customPages: draft().customPages || [] }; render(); },
  wzSave: async () => {
    try { await saveLayout({ ...draft(), customPages: LAYOUT.customPages || [], configured: true }); toast("💾 " + t("Impostazioni salvate", "Settings saved")); if (W.step === PASSI().length - 1) { W.step = 0; W.d = null; go("home"); } }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
  },
  wzAuto: () => saveLayout({ ...LAYOUT, configured: true }).then(() => toast("👍 " + t("Ok, mostro tutto. Puoi cambiare idea in ⚙️ Impostazioni.", "Ok, showing everything. You can change it in ⚙️ Settings."))).catch(() => {}),
});
CHG.wzSensor = el => { const d = draft(), a = el.dataset.id; d.sensors[a] = { ...(d.sensors[a] || {}), [el.dataset.k]: el.value || undefined }; };
CHG.wzWeather = el => { draft().weather = el.value || null; };

page("impostazioni", { title: t("Impostazioni", "Settings"), short: t("Impost.", "Settings"), icon: "⚙️", order: 99, admin: true, render: pagina });

/** dal benvenuto: modalità manuale, si parte da zero e si va ai passi */
export function startManual() {
  W.d = JSON.parse(JSON.stringify({ hiddenAreas: [], areaOrder: [], sensors: {}, pages: {}, weather: null, ...LAYOUT, mode: "manual", include: [], exclude: [] }));
  W.step = 1; go("impostazioni");
}

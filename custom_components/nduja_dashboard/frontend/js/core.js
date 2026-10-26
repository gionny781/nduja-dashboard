/* 'Nduja Dashboard — nucleo: connessione a Home Assistant, stati, registri (aree, piani, dispositivi),
   lingua, componenti comuni, navigazione e disegno della pagina senza ricostruirla ogni volta.
   Gira dentro il pannello della barra laterale: usa la connessione già aperta da Home Assistant. */

/* ================= stato condiviso ================= */
export const S = {};          // stati delle entità
export const REG = {};        // entity_id -> { area, device, hidden, cat, platform }
export const AREAS = {};      // area_id -> { name, floor, icon }
export const FLOORS = {};     // floor_id -> { name, level, icon }
export const DEVICES = {};    // device_id -> { name, area, model, maker }
export const ACT = {};        // azioni: data-act="nome"
export const CHG = {};        // azioni su change (slider, select)
export const UI = { page: null, sheet: null, user: null, opt: {}, version: "", edit: false };
/* scelte dell'utente, salvate in Home Assistant e uguali su tutti i dispositivi:
   { configured, mode:"auto"|"manual", include:[] (manuale), exclude:[] (automatica), hiddenAreas:[], areaOrder:[],
     names:{id:nome}, rooms:{id:area}, sensors:{area:{temp,hum}}, weather, pages:{id:false}, customPages:[{id,title,icon,items}],
     seen:[entity_id già visti], seenCars:[dispositivi delle auto già viste] (novita.js) } */
export const LAYOUT = {};
export const isAdmin = () => !!UI.user?.is_admin;
export let conn = null;

export const $ = s => document.querySelector(s);
export const sGet = k => { try { return localStorage.getItem("nduja_" + k); } catch { return null; } };
export const sSet = (k, v) => { try { localStorage.setItem("nduja_" + k, v); } catch {} };

/* ================= lingua ================= */
const LANG = (() => { try { return (parent.document.documentElement.lang || navigator.language || "en").slice(0, 2); } catch { return (navigator.language || "en").slice(0, 2); } })();
export const IT = LANG === "it";
export const LOC = IT ? "it-IT" : (navigator.language || "en-US");
/** testo nelle due lingue: t("Ciao", "Hello") */
export const t = (it, en) => IT ? it : en;

/* ================= helper valori ================= */
export const ok = id => !!S[id] && !["unavailable", "unknown", ""].includes(S[id].state);
export const isOn = id => ["on", "open", "opening", "playing", "home", "unlocked"].includes(S[id]?.state);
export const fnum = (v, d = 1) => (v == null || v === "" || isNaN(+v)) ? "—" : (+v).toLocaleString(LOC, { minimumFractionDigits: d, maximumFractionDigits: d });
export const val = id => ok(id) && !isNaN(+S[id].state) ? +S[id].state : null;
export const attr = (id, a) => S[id]?.attributes?.[a];
export const unit = id => attr(id, "unit_of_measurement") || "";
export const nmHA = id => String(S[id]?.attributes?.friendly_name || id.split(".")[1].replace(/_/g, " ")).trim();
/** nome da mostrare: quello scelto dall'utente, altrimenti quello di Home Assistant */
export const nm = id => LAYOUT.names?.[id] || nmHA(id);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const watts = w => w == null ? "—" : Math.abs(w) >= 1000 ? fnum(w / 1000, 2) + " kW" : Math.round(w) + " W";
/** potenza in W qualunque sia l'unità (W, kW, MW) */
export const W = id => { const v = val(id); if (v == null) return null; const u = unit(id).toLowerCase(); return u === "kw" ? v * 1000 : u === "mw" ? v * 1e6 : v; };
export const ago = iso => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t("adesso", "now");
  if (s < 3600) return Math.floor(s / 60) + t(" min fa", " min ago");
  if (s < 86400) return Math.floor(s / 3600) + t(" h fa", " h ago");
  return new Date(iso).toLocaleDateString(LOC, { day: "numeric", month: "short" });
};
export const hhmm = d => new Date(d).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
export const domain = id => id.split(".")[0];
/* in modalità manuale queste cose si vedono solo se l'utente le ha aggiunte */
export const MANUAL = ["light", "climate", "switch", "cover", "fan", "media_player", "lock", "humidifier", "vacuum", "valve", "siren", "scene", "person", "camera", "alarm_control_panel"];
/** entità nascoste finché l'utente non le aggiunge (doppioni delle telecamere, mappe dei robot…): funzioni registrate dalle pagine */
export const DEFAULT_OFF = [];
export const defaultOff = id => DEFAULT_OFF.some(f => { try { return f(id); } catch { return false; } }) && !(LAYOUT.show || []).includes(id);
export const OPENING = ["door", "window", "opening", "garage_door"];
export const manualKind = id => MANUAL.includes(id.split(".")[0]) || (id.startsWith("binary_sensor.") && OPENING.includes(S[id]?.attributes?.device_class));
export const isManual = () => LAYOUT.mode === "manual";
export const excluded = id => (isManual() ? manualKind(id) && !(LAYOUT.include || []).includes(id) : (LAYOUT.exclude || []).includes(id))
  || (!!areaOf(id) && (LAYOUT.hiddenAreas || []).includes(areaOf(id)));
/** tutte le entità di un dominio che hanno senso in una plancia (senza filtri del wizard) */
export const allEnts = (dom, pred = () => true) => Object.keys(S).filter(id => id.startsWith(dom + ".") && !REG[id]?.hidden && REG[id]?.cat == null && pred(id, S[id]));
/** entità visibili: come sopra, meno quelle tolte nel wizard */
export const ents = (dom, pred = () => true) => allEnts(dom, pred).filter(id => !excluded(id) && !(isManual() ? false : defaultOff(id)));
export const areaOf = id => LAYOUT.rooms?.[id] || REG[id]?.area || null;
export const inArea = (area, dom, pred) => ents(dom, pred).filter(id => areaOf(id) === area);
export const deviceClass = id => attr(id, "device_class");
/** nome breve: toglie il nome della stanza davanti ("Cucina Luce" → "Luce") */
export function shortName(id) {
  const n = nm(id), a = AREAS[areaOf(id)]?.name;
  if (a && n.toLowerCase().startsWith(a.toLowerCase() + " ") && n.length > a.length + 2) return n.slice(a.length + 1);
  return n;
}
/** stanze ordinate per piano */
export function areasSorted(all) {
  const fl = f => FLOORS[f]?.level ?? 99, ord = LAYOUT.areaOrder || [];
  const pos = a => { const i = ord.indexOf(a); return i < 0 ? 999 : i; };
  return Object.keys(AREAS).filter(a => all || !(LAYOUT.hiddenAreas || []).includes(a))
    .sort((a, b) => fl(AREAS[a].floor) - fl(AREAS[b].floor) || pos(a) - pos(b) || AREAS[a].name.localeCompare(AREAS[b].name, LOC));
}
/** temperatura e umidità di una stanza: il primo sensore adatto nell'area */
export const climateSensors = (area, dc) => allEnts("sensor", id => areaOf(id) === area && deviceClass(id) === dc && ok(id));
/* sensori che NON sono la temperatura della stanza: caldaie, interni dei dispositivi, CPU, batterie, esterni */
const NON_STANZA = /device_temp|temperatura_?dispositivo|cpu|chip|processor|\bsoc\b|disk|nas\b|router|modem|fritz|flow|mandata|ritorno|return|setpoint|target|\bch_|_ch_|dhw|boiler|caldaia|acqua|water|module|modulo|inner|interna|internal|esterna|outdoor|outside|batter|switch_\d|channel_\d|relay|inverter|plug|presa|dew|rugiada|feels|percepita|min\b|max\b/i;
function climateSensor(area, dc) {
  const k = dc === "temperature" ? "temp" : "hum", sc = LAYOUT.sensors?.[area]?.[k];
  if (sc === "none") return null; if (sc && S[sc]) return sc;
  let best = null, top = -1;
  for (const id of inArea(area, "sensor", id => deviceClass(id) === dc && ok(id))) {
    if (NON_STANZA.test(id + " " + nmHA(id))) continue;
    let p = 0, dev = REG[id]?.device;
    const altro = dc === "temperature" ? "humidity" : "temperature";
    if (dev && Object.keys(S).some(x => x !== id && REG[x]?.device === dev && deviceClass(x) === altro)) p += 2;   // termoigrometro vero
    if (dc === "temperature" && /temp|temperatura/i.test(nmHA(id))) p += 1;
    if (dc === "temperature") { const v = val(id); if (v != null && (v < 5 || v > 40)) p -= 3; }
    if (p > top) { top = p; best = id; }
  }
  return best;
}
export const roomTemp = area => { const c = inArea(area, "climate").find(id => attr(id, "current_temperature") != null); const s = climateSensor(area, "temperature"); return s ? val(s) : c ? attr(c, "current_temperature") : null; };
export const roomHum = area => { const s = climateSensor(area, "humidity"); return s ? val(s) : null; };
export const openings = () => ents("binary_sensor", id => OPENING.includes(deviceClass(id)));
/** distanza in km tra due punti (lat/lon) */
export function km(a1, o1, a2, o2) {
  if ([a1, o1, a2, o2].some(v => v == null)) return null;
  const R = 6371, r = x => x * Math.PI / 180, d1 = r(a2 - a1), d2 = r(o2 - o1);
  const q = Math.sin(d1 / 2) ** 2 + Math.cos(r(a1)) * Math.cos(r(a2)) * Math.sin(d2 / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}
export const lightsOn = (area) => ents("light", id => S[id].state === "on" && (!area || areaOf(id) === area));

/* ================= servizi ================= */
export function toast(msg, err) {
  const el = $("#toast"); el.textContent = msg; el.className = "toast show" + (err ? " err" : "");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.className = "toast", 2800);
}
export const ws = msg => conn.sendMessagePromise(msg);
export async function svc(dom, service, data = {}, target) {
  try { return await ws({ type: "call_service", domain: dom, service, service_data: data, target }); }
  catch (e) { toast(t("Comando non riuscito: ", "Command failed: ") + (e.message || e.code || dom + "." + service), true); throw e; }
}
export async function svcResp(dom, service, data, entity_id) {
  const r = await ws({ type: "call_service", domain: dom, service, service_data: data || {}, target: entity_id ? { entity_id } : undefined, return_response: true });
  return r.response;
}
const cache = {};
/** valore caricato una volta e tenuto per ttl; ridisegna quando arriva */
export function cached(key, ttl, loader) {
  const c = cache[key];
  if (c && (Date.now() - c.t < ttl || c.loading)) return c.v;
  cache[key] = { t: Date.now(), v: c?.v, loading: true };
  loader().then(v => { cache[key] = { t: Date.now(), v }; render(); }).catch(e => { console.warn(key, e); cache[key] = { t: Date.now(), v: c?.v }; });
  return c?.v;
}
/** dimentica i valori in cache che iniziano con prefix (per ricaricarli subito) */
export function uncache(prefix) { for (const k of Object.keys(cache)) if (k.startsWith(prefix)) delete cache[k]; }
/** meteo di casa: quello scelto, altrimenti il più adatto (scarta meteo di circuiti, città lontane…) */
export function weatherEnt() {
  if (LAYOUT.weather && S[LAYOUT.weather]) return LAYOUT.weather;
  const casa = String(attr("zone.home", "friendly_name") || "").toLowerCase();
  let best = null, top = -99;
  for (const id of ents("weather")) {
    const n = (id + " " + nmHA(id)).toLowerCase(); let p = 0;
    if (/^weather\.(home|forecast_home|casa)$/.test(id)) p += 3;
    if (casa && casa.split(/\s+/).some(w => w.length > 2 && n.includes(w))) p += 2;
    if (/home|casa|forecast/.test(n)) p += 1;
    if (/f1|formula|circuit|grand prix|\bgp\b|race|gara|airport|aeroporto|meteoalarm/.test(n)) p -= 6;
    if (!ok(id)) p -= 2;
    if (p > top) { top = p; best = id; }
  }
  return best;
}
export const forecast = (eid, type = "daily") => cached("fc:" + eid + type, 30 * 60000, async () => (await svcResp("weather", "get_forecasts", { type }, eid))?.[eid]?.forecast || []) || [];

/* ================= componenti ================= */
export const card = (title, body, o = {}) => `<section class="card ${o.cls || ""}">
  ${title ? `<div class="ch"><h2>${title}</h2>${o.link ? `<a data-act="go" data-id="${o.link[1]}">${o.link[0]} ›</a>` : o.right || ""}</div>` : ""}${body}</section>`;
export const stat = (k, v, u, s, cls = "") => `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}${u ? `<small>${u}</small>` : ""}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
export const empty = txt => `<div class="empty">${txt}</div>`;
export const HVAC = () => ({ off: t("Spento", "Off"), heat: t("Caldo", "Heat"), cool: t("Freddo", "Cool"), auto: "Auto", heat_cool: "Auto", dry: t("Deumidifica", "Dry"), fan_only: t("Ventola", "Fan"), on: t("Acceso", "On") });
export const ACTION = () => ({ heating: t("sta scaldando", "heating"), cooling: t("sta raffreddando", "cooling"), idle: t("a riposo", "idle"), off: t("spento", "off"), drying: t("deumidifica", "drying"), fan: t("ventila", "fan"), preheating: t("preriscalda", "preheating") });
export const WX = () => ({ "clear-night": ["🌙", t("Sereno", "Clear")], cloudy: ["☁️", t("Nuvoloso", "Cloudy")], fog: ["🌫️", t("Nebbia", "Fog")], hail: ["🌨️", t("Grandine", "Hail")],
  lightning: ["🌩️", t("Temporale", "Storm")], "lightning-rainy": ["⛈️", t("Temporale", "Storm")], partlycloudy: ["⛅", t("Poco nuvoloso", "Partly cloudy")], pouring: ["🌧️", t("Rovesci", "Pouring")],
  rainy: ["🌦️", t("Pioggia", "Rain")], snowy: ["❄️", t("Neve", "Snow")], "snowy-rainy": ["🌨️", t("Nevischio", "Sleet")], sunny: ["☀️", t("Sereno", "Sunny")], windy: ["💨", t("Vento", "Windy")],
  "windy-variant": ["💨", t("Vento", "Windy")], exceptional: ["⚠️", t("Allerta", "Alert")] });

const lightIcon = id => { const s = id + nm(id); return /led|strip|striscia/i.test(s) ? "▮" : /spot|faretti/i.test(s) ? "✨" : /lamp|abat|piantana/i.test(s) ? "🛋" : /esterno|outdoor|giardino|garden|portico|porch/i.test(s) ? "🏮" : "💡"; };
export function lightTile(id, label) {
  const s = S[id]; if (!s) return "";
  const on = s.state === "on", b = s.attributes.brightness, un = !ok(id);
  const dim = on && b != null, pct = b != null ? Math.round(b / 2.55) : null;
  const rgb = on && s.attributes.rgb_color ? `style="--lc:rgb(${s.attributes.rgb_color.join(",")})"` : "";
  return `<div class="tile ${on ? "on" : ""} ${un ? "dis" : ""}" data-act="toggle" data-id="${id}" role="button" ${rgb}>
    <div class="row" style="width:100%"><span class="ti">${lightIcon(id)}</span><span class="grow"></span>${dim ? `<span class="mono">${pct}%</span>` : ""}</div>
    <b>${esc(label || shortName(id))}</b><span>${un ? t("non raggiungibile", "unavailable") : on ? t("accesa", "on") : t("spenta", "off")}</span>
    ${dim ? `<input type="range" min="1" max="100" value="${pct}" data-chg="bright" data-id="${id}">` : ""}</div>`;
}
/** disegni registrati da altri moduli (climadisegni.js: VISTE.clima(id) = l'aspetto del clima, animato o con le tue immagini) */
export const VISTE = {};
export function climateCard(id, label) {
  const c = S[id]; if (!c) return "";
  const a = c.attributes, m = c.state, active = m !== "off" && ok(id), H = HVAC(), A = ACTION();
  const modes = (a.hvac_modes || []).filter(x => x !== "heat_cool" || !a.hvac_modes.includes("auto"));
  const step = a.target_temp_step || (unit(id) === "°F" ? 1 : 0.5);
  return `<div class="clim ${active ? (m === "cool" || m === "dry" ? "cool" : "heat") : ""}">
    <div class="row between"><div class="row clh1">${VISTE.clima ? VISTE.clima(id) : ""}<div class="clt1"><b style="font-size:15px">${esc(label || shortName(id))}</b><div class="small muted">${H[m] || m}${a.current_temperature != null ? t(" · in stanza ", " · room ") + fnum(a.current_temperature) + "°" : ""}${a.hvac_action ? " · " + (A[a.hvac_action] || a.hvac_action) : ""}</div></div></div>
    ${modes.includes("off") ? `<button class="btn sm ${active ? "bad" : "warm"}" data-act="cpower" data-id="${id}">${active ? t("⏻ Spegni", "⏻ Off") : t("⏻ Accendi", "⏻ On")}</button>` : ""}</div>
    ${a.temperature != null ? `<div class="row" style="justify-content:center;gap:18px;margin:12px 0">
      <button class="step" data-act="cstep" data-id="${id}" data-d="-1" aria-label="−">−</button><span class="tgt">${fnum(a.temperature, step >= 1 ? 0 : 1)}°</span>
      <button class="step" data-act="cstep" data-id="${id}" data-d="1" aria-label="+">+</button></div>` : ""}
    ${modes.length > 1 ? `<div class="seg">${modes.map(x => `<button class="${x === m ? "act" : ""}" data-act="cmode" data-id="${id}" data-v="${x}">${H[x] || x}</button>`).join("")}</div>` : ""}
  </div>`;
}
/** riga generica per interruttori, prese, tapparelle, ventole, serrature */
export function entityRow(id) {
  const d = domain(id), s = S[id]; if (!s) return "";
  const on = isOn(id), un = !ok(id);
  const ic = { switch: "🔌", fan: "🌀", cover: "🪟", lock: on ? "🔓" : "🔒", media_player: "📺", input_boolean: "🔘", scene: "🎬", script: "▶️", button: "⏺", vacuum: "🤖" }[d] || "•";
  const st = d === "cover" ? ({ open: t("aperta", "open"), closed: t("chiusa", "closed"), opening: t("si apre", "opening"), closing: t("si chiude", "closing") }[s.state] || s.state) + (attr(id, "current_position") != null ? ` · ${attr(id, "current_position")}%` : "")
    : d === "lock" ? (s.state === "locked" ? t("chiusa", "locked") : t("aperta", "unlocked"))
    : d === "media_player" ? (s.state === "playing" ? (attr(id, "media_title") || t("in riproduzione", "playing")) : s.state === "off" ? t("spento", "off") : s.state)
    : on ? t("acceso", "on") : t("spento", "off");
  const ctl = d === "cover" ? `<div class="row" style="gap:6px"><button class="btn sm" data-act="cover" data-v="open_cover" data-id="${id}">▲</button><button class="btn sm" data-act="cover" data-v="stop_cover" data-id="${id}">■</button><button class="btn sm" data-act="cover" data-v="close_cover" data-id="${id}">▼</button></div>`
    : ["scene", "script", "button"].includes(d) ? `<button class="btn sm" data-act="toggle" data-id="${id}">▶</button>`
    : `<button class="sw ${on ? "on" : ""}" data-act="toggle" data-id="${id}" aria-label="${esc(nm(id))}"><i></i></button>`;
  return `<div class="li ${un ? "dis" : ""}"><span class="ic">${ic}</span><div class="tx"><b>${esc(shortName(id))}</b><span>${un ? t("non raggiungibile", "unavailable") : esc(st)}</span></div>${un ? "" : ctl}</div>`;
}
/** doppio tocco di conferma (aprire un'auto, un cancello…): il primo tocco trasforma il pulsante in «⚠️ msg» per 3,5 s,
    il secondo restituisce true. Intanto il pulsante non viene ridisegnato (data-sure, vedi morph). */
export function sicuro(el, msg) {
  if (el.dataset.sure === "1") { clearTimeout(el._sureT); el._sureFine?.(); return true; }
  const html = el.innerHTML, cls = el.className;
  el.dataset.sure = "1"; el.innerHTML = `⚠️<span>${esc(msg)}</span>`; el.classList.add("warn");
  el._sureFine = () => { el._sureFine = null; el.dataset.sure = ""; el.innerHTML = html; el.className = cls; render(); };
  el._sureT = setTimeout(() => { if (el.isConnected) el._sureFine?.(); }, 3500);
  return false;
}
/** apre la finestra «dettagli» di Home Assistant per un'entità */
export function moreInfo(id) {
  const e = new Event("hass-more-info", { bubbles: true, composed: true }); e.detail = { entityId: id };
  try { (parent.document.querySelector("home-assistant") || parent.document.body).dispatchEvent(e); } catch { /* fuori da HA */ }
}

/* ================= azioni comuni ================= */
Object.assign(ACT, {
  go: el => go(el.dataset.id),
  toggle: el => {
    const id = el.dataset.id, d = domain(id);
    if (["light", "switch", "fan", "input_boolean", "media_player", "humidifier", "siren"].includes(d)) svc(d, "toggle", {}, { entity_id: id });
    else if (d === "cover") svc("cover", "toggle", {}, { entity_id: id });
    else if (d === "scene" || d === "script") svc(d, "turn_on", {}, { entity_id: id });
    else if (d === "button" || d === "input_button") svc(d, "press", {}, { entity_id: id });
    else if (d === "lock") svc("lock", S[id].state === "locked" ? "unlock" : "lock", {}, { entity_id: id });
    else moreInfo(id);
  },
  cover: el => svc("cover", el.dataset.v, {}, { entity_id: el.dataset.id }),
  cpower: el => { const id = el.dataset.id; svc("climate", S[id].state === "off" ? "turn_on" : "turn_off", {}, { entity_id: id }); },
  cmode: el => svc("climate", "set_hvac_mode", { hvac_mode: el.dataset.v }, { entity_id: el.dataset.id }),
  cstep: el => {
    const id = el.dataset.id, a = S[id].attributes, step = a.target_temp_step || 0.5;
    let v = Math.round((+a.temperature + step * +el.dataset.d) * 10) / 10;
    if (a.min_temp != null) v = Math.max(a.min_temp, v); if (a.max_temp != null) v = Math.min(a.max_temp, v);
    svc("climate", "set_temperature", { temperature: v }, { entity_id: id });
  },
  more: el => el.dataset.id ? moreInfo(el.dataset.id) : $("#more").classList.toggle("open"),
  lightsOff: el => { const L = el.dataset.area ? lightsOn(el.dataset.area) : lightsOn(); if (L.length) svc("light", "turn_off", {}, { entity_id: L }).then(() => toast(t("Luci spente: ", "Lights off: ") + L.length)); },
  sheetClose: () => closeSheet(),
});
CHG.bright = el => svc("light", "turn_on", { brightness_pct: +el.value }, { entity_id: el.dataset.id });

/* ================= pagine e navigazione ================= */
export const PAGES = {};
/** funzioni chiamate prima di ogni disegno (per esempio le pagine create dall'utente) */
export const HOOKS = [];
/** nomi delle stanze scelti nella plancia */
export function nomiStanze() { for (const a in AREAS) AREAS[a].name = LAYOUT.areaNames?.[a] || AREAS[a].nameHA || AREAS[a].name; }
HOOKS.push(nomiStanze);
/** registra una pagina: { title, short, icon, render, badge, order, show } */
export function page(id, def) { PAGES[id] = { order: 50, show: () => true, ...def }; if (conn) render(); }
/** scelte per la persona che sta usando la plancia (pagine e schede della Home), decise dall'amministratore */
export const utenteCfg = () => (UI.user?.id && LAYOUT.users?.[UI.user.id]) || {};
const visible = () => Object.keys(PAGES).filter(k => !PAGES[k].hiddenNav && PAGES[k].show() && LAYOUT.pages?.[k] !== false && utenteCfg().pages?.[k] !== false && (!PAGES[k].admin || isAdmin())).sort((a, b) => PAGES[a].order - PAGES[b].order);
/* le pagine «secondarie» arrivano dopo la Home: se si apre direttamente una di queste, la mostro appena c'è */
let pronte = false, attesa = null;
export function tuttePronte() { pronte = true; if (attesa) { const a = attesa; attesa = null; go(a); } else render(true); }
/** vero quando tutte le pagine sono caricate (e hanno registrato i loro filtri, per esempio le auto) */
export const pronto = () => pronte;
export function go(id) {
  HOOKS.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  if (id && !PAGES[id] && !pronte) { attesa = id; id = "home"; }
  if (!LAYOUT.configured && isAdmin() && PAGES.benvenuto && id !== "impostazioni") id = "benvenuto";
  if (!PAGES[id] || !PAGES[id].show() || (PAGES[id].admin && !isAdmin()) || (utenteCfg().pages?.[id] === false && id !== "impostazioni")) id = "home";
  if (UI.page !== id) UI.edit = false;
  UI.page = id; sSet("page", id);
  try { if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id); } catch {}
  $("#more").classList.remove("open");
  $("#main").innerHTML = ""; window.scrollTo(0, 0);
  render(true);
}
window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (id && id !== UI.page) go(id); });
export function openSheet(fn) { UI.sheet = fn; $("#sheet").classList.add("open"); $("#backdrop").classList.add("open"); $("#sheet").innerHTML = ""; render(true); }
export function closeSheet() { UI.sheet = null; $("#sheet").classList.remove("open"); $("#backdrop").classList.remove("open"); render(); }

/* aggiorna il DOM senza ricostruirlo (mantiene focus, slider trascinati, iframe con data-keep) */
let dragging = null;
function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b); return; }
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.nodeType !== 1) return;
  if (a.hasAttribute("data-keep") && b.hasAttribute("data-keep")) return;
  if (a.getAttribute("data-sure") === "1") return;   // pulsante in attesa di conferma: non lo tocco finché non scade
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (a.tagName === "INPUT" && a.type === "range" && a !== dragging) a.value = b.getAttribute("value") ?? a.value;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) && a.type !== "range") return;
  const ac = [...a.childNodes], bc = [...b.childNodes];
  bc.forEach((n, i) => { if (i < ac.length) morph(ac[i], n); else a.appendChild(n); });
  for (let i = bc.length; i < ac.length; i++) ac[i].remove();
}
export function patch(el, html) {
  if (!el.firstChild) { el.innerHTML = html; return; }
  const tmp = document.createElement(el.tagName); tmp.innerHTML = html;
  const ac = [...el.childNodes], bc = [...tmp.childNodes];
  bc.forEach((n, i) => { if (i < ac.length) morph(ac[i], n); else el.appendChild(n); });
  for (let i = bc.length; i < ac.length; i++) ac[i].remove();
}
/* ---------- tema: automatico (come Home Assistant), chiaro o scuro; scelto per ogni dispositivo ---------- */
export const tema = () => sGet("theme") || "auto";
function haScuro() {
  try { const h = parent.document.querySelector("home-assistant")?.hass; if (h?.themes && typeof h.themes.darkMode === "boolean") return h.themes.darkMode; } catch {}
  return matchMedia("(prefers-color-scheme: dark)").matches;
}
export function applyTheme() {
  applyKiosk();
  const m = tema(), scuro = m === "dark" || (m === "auto" && haScuro());
  document.body.classList.toggle("light", !scuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scuro ? "#05070d" : "#eef2f8");
}
ACT.theme = () => { const o = ["auto", "light", "dark"], m = o[(o.indexOf(tema()) + 1) % 3]; sSet("theme", m); applyTheme(); render(true);
  toast({ auto: t("Tema automatico (come Home Assistant)", "Automatic theme (follows Home Assistant)"), light: t("Tema chiaro", "Light theme"), dark: t("Tema scuro", "Dark theme") }[m]); };
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); }); } catch {}

/* ---------- barra di navigazione: sempre visibile o a scomparsa (scelta per dispositivo) ---------- */
export const navMode = () => sGet("nav") || "fixed";
let navT = null;
export function navShow(ms = 3500) {
  if (navMode() !== "auto") return;
  document.body.classList.remove("navhide"); clearTimeout(navT);
  navT = setTimeout(() => { if (!document.querySelector(".rail:hover,.tabbar:hover,.more.open")) document.body.classList.add("navhide"); }, ms);
}
let navPrev = null;
export function applyNav() {
  const m = navMode(); if (m === navPrev) return; navPrev = m;
  document.body.classList.toggle("navauto", m === "auto");
  if (m === "auto") navShow(); else { document.body.classList.remove("navhide"); clearTimeout(navT); }
}
ACT.navMode = el => { sSet("nav", el.dataset.v); applyNav(); render(true); toast(el.dataset.v === "auto" ? t("Barra a scomparsa: avvicinati al bordo per farla comparire", "Auto-hide bar: move to the edge to show it") : t("Barra sempre visibile", "Bar always visible")); };
ACT.navPeek = () => navShow(5000);

/* ---------- schermo intero e modalità chiosco (per ogni dispositivo) ----------
   ⛶ mette la plancia a tutto schermo (dove il browser lo permette, es. tablet, PC, Android);
   la modalità chiosco nasconde barra laterale e intestazione di Home Assistant e resta attiva ad ogni apertura
   (funziona anche su iPhone, dove il tutto schermo non esiste). */
export function chiosco() { return sGet("kiosk") === "1"; }
var KCSS = `ha-sidebar,.toolbar,app-header,app-toolbar,ha-top-app-bar-fixed>*[slot=navigationIcon]{display:none!important}
  ha-drawer{--mdc-drawer-width:0px!important}
  :host{--header-height:0px!important;--mdc-drawer-width:0px!important}
  .content,#content,hass-subpage{top:0!important;height:100%!important;padding-top:0!important}`;
function radici() { const R = []; try { let n = window.frameElement; while (n) { const r = n.getRootNode(); if (r && r !== document && r.host) { R.push(r); n = r.host; } else break; } } catch {} return R; }
export function applyKiosk() {
  for (const r of radici()) {
    let st = r.querySelector("style[data-nduja-kiosk]");
    if (chiosco() && !st) { st = document.createElement("style"); st.setAttribute("data-nduja-kiosk", ""); st.textContent = KCSS; r.appendChild(st); }
    if (!chiosco() && st) st.remove();
  }
}
const fsEl = () => { try { return parent.document.fullscreenElement || parent.document.webkitFullscreenElement; } catch { return document.fullscreenElement; } };
export const puoFullscreen = () => { try { const f = window.frameElement || document.documentElement; return !!(f.requestFullscreen || f.webkitRequestFullscreen); } catch { return false; } };
ACT.fullscreen = async () => {
  try {
    if (fsEl()) { const d = fsEl().ownerDocument; await (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const f = window.frameElement || document.documentElement;
    if (f.requestFullscreen || f.webkitRequestFullscreen) { await (f.requestFullscreen || f.webkitRequestFullscreen).call(f); return; }
  } catch (e) { console.warn("fullscreen", e); }
  ACT.kiosk();   /* niente tutto schermo (iPhone): uso la modalità chiosco */
};
ACT.kiosk = () => { sSet("kiosk", chiosco() ? "0" : "1"); applyKiosk(); toast(chiosco() ? "🖥️ " + t("Modalità chiosco attiva", "Kiosk mode on") : t("Modalità chiosco spenta", "Kiosk mode off")); render(true); };
document.addEventListener("fullscreenchange", () => render(true));
try { parent.document.addEventListener("fullscreenchange", () => render(true)); } catch {}
let lastY = 0;
window.addEventListener("scroll", () => { if (navMode() !== "auto") return; const y = window.scrollY; if (y < lastY - 8 || y < 40) navShow(); else if (y > lastY + 8) { document.body.classList.add("navhide"); clearTimeout(navT); } lastY = y; }, { passive: true });
document.addEventListener("mousemove", e => { if (navMode() === "auto" && (e.clientX < 36 || e.clientY > innerHeight - 50)) navShow(); }, { passive: true });
document.addEventListener("touchstart", e => { const p = e.touches[0]; if (navMode() === "auto" && p && (p.clientX < 24 || p.clientY > innerHeight - 40)) navShow(5000); }, { passive: true });
applyTheme();

let pending = false;
export function render(now) {
  if (pending && !now) return; pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (!conn || !UI.page) return;
    HOOKS.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    const P = PAGES[UI.page]; if (!P) return go("home");
    document.body.classList.toggle("editing", UI.edit); document.body.classList.toggle("nonav", !!P.noNav); applyTheme(); applyNav();
    try {
      $("#pageTitle").textContent = P.title;
      document.title = P.title + " · 'Nduja";
      renderNav(); renderStrip();
      patch($("#main"), P.render());
      P.after?.();
      if (UI.sheet) patch($("#sheet"), `<div class="grab"></div>` + UI.sheet());
    } catch (e) { console.error(e); }
  });
}
function renderNav() {
  const v = visible();
  const nav = k => `<button class="nav ${k === UI.page ? "act" : ""}" data-act="go" data-id="${k}"><span class="i">${PAGES[k].icon}</span>${PAGES[k].short || PAGES[k].title}${PAGES[k].badge?.() ? '<span class="dot"></span>' : ""}</button>`;
  const nuova = isAdmin() && UI.edit ? `<button class="nav nw1" data-act="edNewPage"><span class="i">＋</span>${t("Pagina", "Page")}</button>` : "";
  patch($("#rail"), `<div class="logo" title="'Nduja ${esc(UI.version)}">🌶️</div><div class="beta1">BETA</div>` + v.map(nav).join("") + nuova);
  const main = v.slice(0, 4);
  patch($("#tabbar"), main.map(nav).join("") + (v.length > 4 ? `<button class="nav ${main.includes(UI.page) ? "" : "act"}" data-act="more"><span class="i">☰</span>${t("Altro", "More")}</button>` : ""));
  patch($("#more"), v.slice(4).map(nav).join("") + nuova);
  if (!$("#navh")) document.body.insertAdjacentHTML("beforeend", `<button id="navh" class="navh1" data-act="navPeek" aria-label="${t("Mostra il menu", "Show menu")}"></button>`);
}
/* pillole in alto: meteo, persone, luci accese, energia (se configurata) */
export const STRIP = [];
/** schede della Home aggiunte dalle altre pagine: { chiave: { title(), render(), show() } } (compaiono solo se show() è vero) */
export const HOME_EXTRA = {};
function renderStrip() {
  const w = weatherEnt(), home = ents("person").filter(p => S[p].state === "home").length, L = lightsOn().length;
  const extra = STRIP.map(f => { try { return f(); } catch { return ""; } }).join("");
  const P = PAGES[UI.page], canEdit = isAdmin() && P?.editable;
  if (P?.bare) { patch($("#strip"), ""); return; }   // benvenuto e configurazione: niente dati in alto
  patch($("#strip"), `${canEdit ? `<button class="pillv edt1 ${UI.edit ? "on" : ""}" data-act="edToggle">${UI.edit ? "✓ " + t("Fatto", "Done") : "✏️ " + t("Modifica", "Edit")}</button>` : ""}${extra}
    ${ents("person").length ? `<span class="pillv">🏠 ${home} ${t("in casa", "home")}</span>` : ""}
    ${L ? `<span class="pillv sun" data-act="go" data-id="luci">💡 ${L}</span>` : ""}
    ${w ? `<span class="pillv">${(WX()[S[w].state] || ["🌡️"])[0]} ${fnum(attr(w, "temperature"))}°</span>` : ""}
    <button class="pillv th1" data-act="theme" title="${t("Tema", "Theme")}">${{ auto: "◐", light: "☀︎", dark: "☾" }[tema()]}</button>
    <button class="pillv th1 ${fsEl() || chiosco() ? "on" : ""}" data-act="fullscreen" title="${t("Tutto schermo", "Full screen")}">${fsEl() ? "🗗" : "⛶"}</button>
    ${UI.page === "home" ? "" : `<span class="pillv"><span class="st ${conn?.connected ? "ok" : ""}"></span>${hhmm(Date.now())}</span>`}`);
}

/* ================= eventi ================= */
document.addEventListener("click", e => {
  if (e.target.id === "backdrop") return closeSheet();
  const el = e.target.closest("[data-act]");
  if (!el || ["INPUT", "SELECT", "TEXTAREA", "LABEL"].includes(e.target.tagName)) return;
  const f = ACT[el.dataset.act];
  if (f) { e.preventDefault(); try { f(el, e); } catch (err) { console.error(err); } }
});
document.addEventListener("change", e => { const el = e.target, f = CHG[el.dataset.chg]; if (f) f(el, e); });
document.addEventListener("pointerdown", e => { if (e.target.type === "range") dragging = e.target; });
document.addEventListener("pointerup", () => { dragging = null; });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

/* ================= connessione ================= */
async function getConn() {
  try { if (window.parent !== window && window.parent.hassConnection) { const r = await window.parent.hassConnection; if (r?.conn) return r.conn; } } catch { /* origine diversa */ }
  /* dentro l'app 'Nduja per iPhone/iPad: collegamento diretto, senza l'interfaccia di Home Assistant */
  if (window.NDUJA_APP) {
    /* nell'app non mi arrendo: dopo un cambio di rete (Wi‑Fi ↔ 5G) il primo tentativo può fallire */
    const { connetti } = await import("./appconn.js");
    for (let i = 0; ; i++) {
      try { const c = await connetti(); $("#connect").classList.remove("show"); return c; } catch (e) { console.error(e); }
      const box = $("#connect p");
      if (box) box.textContent = LANG === "it" ? "Mi collego a Home Assistant… (tentativo " + (i + 2) + ")" : "Connecting to Home Assistant… (attempt " + (i + 2) + ")";
      $("#connect").classList.add("show");
      await new Promise(r => setTimeout(r, Math.min(15000, 2000 * (i + 1))));
    }
  }
  return null;
}
/** chiamata REST a Home Assistant con il token della sessione (serve per salvare le automazioni) */
export async function api(method, path, body) {
  let token;
  if (window.NDUJA_APP && !(window.parent !== window && window.parent.hassConnection)) token = await (await import("./appconn.js")).accessToken();
  else {
    const r = await window.parent.hassConnection, auth = r?.auth;
    if (!auth) throw new Error("no auth");
    if (auth.expired) await auth.refreshAccessToken();
    token = auth.accessToken;
  }
  const res = await fetch(path, { method, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(res.status + " " + (await res.text().catch(() => "")));
  const tx = await res.text(); try { return JSON.parse(tx); } catch { return tx; }
}
/** apre una pagina di Home Assistant (fuori dalla plancia) */
export function apriHA(path) { try { parent.history.pushState(null, "", path); parent.dispatchEvent(new CustomEvent("location-changed")); } catch { window.open(path, "_top"); } }
/** etichetta «'Nduja» sulle automazioni e sugli script creati dalla plancia: la crea se manca e la aggiunge
   senza togliere le altre. trova() restituisce l'entity_id appena Home Assistant lo crea. Se qualcosa non va, niente. */
export async function etichettaNduja(trova) {
  try {
    let id = null;
    for (let i = 0; i < 40 && !(id = trova()); i++) await new Promise(r => setTimeout(r, 500));   // Home Assistant ricarica le automazioni: aspetto l'entità
    if (!id) return;
    const norm = s => String(s || "").toLowerCase().replace(/[’`´]/g, "'").trim();
    let lab = ((await ws({ type: "config/label_registry/list" })) || []).find(l => norm(l.name) === "'nduja");
    if (!lab) lab = await ws({ type: "config/label_registry/create", name: "'Nduja", icon: "mdi:chili-hot" });
    const e = await ws({ type: "config/entity_registry/get", entity_id: id }), L = e?.labels || [];
    if (lab?.label_id && !L.includes(lab.label_id)) await ws({ type: "config/entity_registry/update", entity_id: id, labels: [...L, lab.label_id] });
  } catch (e) { /* in silenzio */ }
}
async function loadRegistry() {
  const q = type => ws({ type }).catch(() => null);
  const [er, dr, ar, fr] = await Promise.all([q("config/entity_registry/list_for_display"), q("config/device_registry/list"), q("config/area_registry/list"), q("config/floor_registry/list")]);
  for (const k in FLOORS) delete FLOORS[k]; for (const k in AREAS) delete AREAS[k]; for (const k in DEVICES) delete DEVICES[k]; for (const k in REG) delete REG[k];
  (fr || []).forEach(f => FLOORS[f.floor_id] = { name: f.name, level: f.level ?? 0, icon: f.icon });
  (ar || []).forEach(a => AREAS[a.area_id] = { name: LAYOUT.areaNames?.[a.area_id] || a.name, nameHA: a.name, floor: a.floor_id, icon: a.icon });
  (dr || []).forEach(d => DEVICES[d.id] = { name: d.name_by_user || d.name, area: d.area_id, model: d.model, maker: d.manufacturer, disabled: !!d.disabled_by });
  (er?.entities || []).forEach(e => REG[e.ei] = { area: e.ai || (e.di && DEVICES[e.di]?.area) || null, device: e.di || null, hidden: !!e.hb, cat: e.ec ?? null, platform: e.pl });
}
async function loadConfig() {
  try { const c = await ws({ type: "nduja_dashboard/config" }); UI.opt = c.options || {}; UI.version = c.version || ""; for (const k in LAYOUT) delete LAYOUT[k]; Object.assign(LAYOUT, c.layout || {}); } catch {}
}
/** salva le scelte del wizard in Home Assistant (solo amministratori) */
export async function saveLayout(layout) {
  await ws({ type: "nduja_dashboard/save_layout", layout });
  for (const k in LAYOUT) delete LAYOUT[k]; Object.assign(LAYOUT, layout); render();
}
/* abbonamento agli stati in formato compatto (come fa Home Assistant stesso) */
function toState(id, c) {
  const lc = c.lc ? new Date(c.lc * 1000).toISOString() : undefined;
  return { entity_id: id, state: c.s, attributes: c.a || {}, last_changed: lc, last_updated: c.lu ? new Date(c.lu * 1000).toISOString() : lc };
}
function onEntities(m) {
  if (m.a) for (const id in m.a) S[id] = toState(id, m.a[id]);
  if (m.r) for (const id of m.r) delete S[id];
  if (m.c) for (const id in m.c) {
    const cur = S[id]; if (!cur) continue;
    const n = { ...cur, attributes: { ...cur.attributes } }, p = m.c[id]["+"], r = m.c[id]["-"];
    if (p) {
      if (p.s !== undefined) n.state = p.s;
      if (p.a) Object.assign(n.attributes, p.a);
      if (p.lc) n.last_updated = n.last_changed = new Date(p.lc * 1000).toISOString(); else if (p.lu) n.last_updated = new Date(p.lu * 1000).toISOString();
    }
    if (r?.a) for (const k of r.a) delete n.attributes[k];
    S[id] = n;
  }
  if (!UI.page) { go(location.hash.slice(1) || sGet("page") || "home"); window.ndujaPronta?.(); } else renderDaStati();   // dati arrivati: niente schermata d'errore (errore.js)
}
/* Gli stati cambiano anche più volte al secondo (sensori di potenza, lettori…): ridisegnare tutta la pagina
   a ogni cambio fa scattare i telefoni. Qui ridisegno al massimo ogni 400 ms e mai mentre il dito è sullo schermo;
   i tocchi dell'utente continuano a ridisegnare subito. */
let ultimoRender = 0, attesaRender = null, tocco = false;
function renderDaStati() {
  if (attesaRender) return;
  attesaRender = setTimeout(() => {
    attesaRender = null;
    if (tocco) return renderDaStati();
    ultimoRender = performance.now(); render();
  }, Math.max(0, 400 - (performance.now() - ultimoRender)));
}
document.addEventListener("pointerdown", () => { tocco = true; }, { passive: true });
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, () => { setTimeout(() => { tocco = false; }, 120); }, { passive: true });
async function start() {
  conn = await getConn();
  if (!conn) { if (window.ndujaErrore) window.ndujaErrore("fuori"); else $("#connect").classList.add("show"); return; }
  try { UI.user = await ws({ type: "auth/current_user" }); } catch {}
  await loadConfig();
  await loadRegistry();
  conn.addEventListener("ready", () => loadRegistry().then(() => render()));
  conn.addEventListener("disconnected", () => render());
  /* registri cambiati (nuove aree, dispositivi spostati): li ricarico */
  for (const ev of ["area_registry_updated", "device_registry_updated", "entity_registry_updated", "floor_registry_updated"])
    conn.subscribeEvents(() => { clearTimeout(start._r); start._r = setTimeout(() => loadRegistry().then(() => render()), 1500); }, ev).catch(() => {});
  /* scelte cambiate da un altro dispositivo */
  conn.subscribeEvents(() => loadConfig().then(() => render()), "nduja_dashboard_layout_updated").catch(() => {});
  window.addEventListener("focus", () => loadConfig().then(() => render()));
  conn.subscribeMessage(onEntities, { type: "subscribe_entities" });
}
setInterval(() => render(), 15000);
export const ready = start();

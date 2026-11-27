/* 'Nduja Dashboard — automazioni (0.7.64): il modello semplice del costruttore «Quando → Solo se → Allora»,
   la traduzione nella configurazione di Home Assistant (inHA), la lettura inversa (daHA) e la frase in italiano (frase).
   Modello (v: 2):
     { v: 2, nome, descrizione?, modo? (mode di Home Assistant), quando: [Q…], soloSe: { modo: "e" | "o", cond: [C…] }, azioni: [A…], firma? }
   Q.tipo: ora, stato, sole, persona, soglia, apertura, movimento, pulsante, elettro, allarme, calendario, pioggia, casa
   C.tipo: casa, orario, sole, stato, valore
   A.tipo: on, off, toggle, pertempo, tapparella, clima, scena, automazione, allarme, notifica, alexa, attendi
   Regola d'oro: un'automazione fatta fuori da 'Nduja si modifica qui SOLO se daHA → inHA dà esattamente la stessa configurazione
   (confronto dopo aver uniformato le scritture equivalenti: «platform»/«trigger», «service»/«action», durate, orari…).
   Se non torna identica si legge soltanto, con «Apri in Home Assistant»: non la riscriviamo mai a metà. */
import { S, t, esc, nm, attr, unit, deviceClass, REG, DEVICES, AREAS, OPENING, cached, ws, weatherEnt, idsDi, allEnts } from "./core.js";
import { elettrodomestici, soglie } from "./avvisi.js";
export { elettrodomestici };

/* ---------------- elenchi comuni ---------------- */
export const ARMATO = ["armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass"];
export const PIOGGIA = ["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"];
const CONTROLLABILI = /^(light|switch|fan|cover|climate|media_player|input_boolean|lock|vacuum|humidifier|siren|valve|automation|water_heater)\./;
export const controllabile = id => CONTROLLABILI.test(id);
export const persone = () => allEnts("person");
/** Echo di Alexa Media Player (senza importare la pagina Alexa) */
export const echi = () => idsDi("media_player").filter(id => REG[id]?.platform === "alexa_media" && !REG[id]?.hidden && S[id] && !/this_device|questo_dispositivo/i.test(id));
/** servizi di Home Assistant (una volta ogni ora) */
export const servizi = () => cached("services", 3600e3, () => ws({ type: "get_services" })) || {};
export const notifiche = () => Object.keys(servizi().notify || {}).filter(k => k !== "send_message" && k !== "persistent_notification" && !k.startsWith("alexa_media")).sort();
export const apertura = id => id.startsWith("binary_sensor.") && OPENING.includes(deviceClass(id));
export const movimento = id => id.startsWith("binary_sensor.") && ["motion", "occupancy", "presence"].includes(deviceClass(id));
export const isElettro = id => { try { return elettrodomestici().includes(id); } catch { return false; } };
const PANNELLO = "/nduja";
const AREE = () => AREAS;

/* ---------------- piccoli aiuti ---------------- */
const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const E = v => arr(v).filter(Boolean);
const num = v => v === "" || v == null || isNaN(+v) ? null : +v;
const copia = x => JSON.parse(JSON.stringify(x));
/** «-00:30:00» dai minuti (anche negativi) */
const hms = min => { const o = Math.round(+min || 0), a = Math.abs(o); return `${o < 0 ? "-" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}:00`; };
/** secondi da una durata di Home Assistant: 300, "00:05:00", "5:00", { minutes: 5 }, { hours, minutes, seconds, milliseconds, days } */
export function secondi(d) {
  if (d == null) return null;
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    if (/^-?\d+(\.\d+)?$/.test(d.trim())) return +d;
    const m = d.trim().match(/^(-)?(\d+):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?$/); if (!m) return NaN;
    const s = (+m[2]) * 3600 + (+m[3]) * 60 + (+(m[4] || 0)); return m[1] ? -s : s;
  }
  if (typeof d === "object") { const k = Object.keys(d); if (k.some(x => !["days", "hours", "minutes", "seconds", "milliseconds"].includes(x))) return NaN;
    return (+d.days || 0) * 86400 + (+d.hours || 0) * 3600 + (+d.minutes || 0) * 60 + (+d.seconds || 0) + (+d.milliseconds || 0) / 1000; }
  return NaN;
}
/** minuti interi da una durata (null se non è un numero intero di minuti) */
const minuti = d => { const s = secondi(d); return s == null || isNaN(s) || s % 60 ? null : s / 60; };
const hhmm = v => { const m = String(v || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` + (m[3] && m[3] !== "00" ? ":" + m[3] : "") : null; };
const hex2rgb = h => { const m = String(h || "").match(/^#?([0-9a-f]{6})$/i); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => Array.isArray(c) && c.length === 3 ? "#" + c.map(x => Math.max(0, Math.min(255, Math.round(+x))).toString(16).padStart(2, "0")).join("") : null;

/* ================= dal vecchio modello (0.7.22) al nuovo ================= */
export function nuovo() { return { v: 2, nome: "", quando: [{ tipo: "ora", ora: "07:00" }], soloSe: { modo: "e", cond: [] }, azioni: [{ tipo: "on", entita: [] }] }; }
/** porta qualsiasi modello salvato al formato di oggi; quello del 0.7.22 dà la stessa configurazione di prima */
export function normalizza(m0) {
  const m = copia(m0 || {});
  if (m.v === 2) {
    m.quando = arr(m.quando).length ? arr(m.quando) : [{ tipo: "ora", ora: "07:00" }];
    m.soloSe = { modo: m.soloSe?.modo === "o" ? "o" : "e", cond: arr(m.soloSe?.cond) };
    m.azioni = arr(m.azioni); if (!m.azioni.length) m.azioni.push({ tipo: "on", entita: [] });
    m.nome = m.nome || ""; return m;
  }
  const q = { ...(m.quando || { tipo: "ora", ora: "07:00" }) }, ss = m.soloSe || {}, cond = [];
  if (q.tipo === "ora" && (q.giorni || []).length) cond.push({ tipo: "orario", giorni: [...q.giorni] });
  delete q.giorni;
  if (ss.dalle || ss.alle) cond.push({ tipo: "orario", dalle: ss.dalle || "", alle: ss.alle || "" });
  /* «chi è in casa» della 0.7.22: elencava le persone di allora (e senza persone non c'era) — lo tengo uguale finché non lo cambi */
  if (ss.casa && persone().length) cond.push({ tipo: "casa", chi: ss.casa, _vecchio: persone() });
  const az = arr(m.azioni);
  return { v: 2, nome: m.nome || "", quando: [q], soloSe: { modo: "e", cond }, azioni: az.length ? az : [{ tipo: "on", entita: [] }] };
}

/* ================= modello → Home Assistant ================= */
const NON = { _non: true };   // un pezzo che il costruttore non sa scrivere: la configurazione non tornerà uguale
function trigHA(q) {
  const L = E(q.entita);
  switch (q.tipo) {
    case "ora": { const h = hhmm(q.ora) || "07:00"; return { trigger: "time", at: h.length === 5 ? h + ":00" : h }; }
    case "stato": { const tr = { trigger: "state", entity_id: L }; if ((q.a || "on") !== "*") tr.to = q.a || "on"; if (+q.per) tr.for = { minutes: +q.per }; return tr; }
    case "sole": return { trigger: "sun", event: q.evento || "sunset", offset: hms(q.offset) };
    case "persona": return { trigger: "zone", entity_id: E(q.persona), zone: "zone.home", event: q.evento === "esce" ? "leave" : "enter" };
    case "soglia": { const tr = { trigger: "numeric_state", entity_id: L }; tr[q.verso === "sotto" ? "below" : "above"] = num(q.valore) ?? 0; if (+q.per) tr.for = { minutes: +q.per }; return tr; }
    case "apertura": return { trigger: "state", entity_id: L, to: "on", for: { minutes: +q.min || 5 } };
    case "movimento": return q.modo === "nessuno" ? { trigger: "state", entity_id: L, to: "off", for: { minutes: +q.min || 10 } } : { trigger: "state", entity_id: L, to: "on" };
    case "pulsante":
      if (q.device) { const d = copia(q.device); delete d.platform; return { trigger: "device", ...d }; }
      return { trigger: "state", entity_id: L, not_from: ["unavailable", "unknown"], not_to: ["unavailable", "unknown"] };
    case "elettro": { const g = soglie(L[0]); return { trigger: "numeric_state", entity_id: L, below: g.off, for: { minutes: g.min } }; }
    case "allarme": return { trigger: "state", entity_id: L, to: q.evento === "scattato" ? "triggered" : q.evento === "disinserito" ? "disarmed" : [...ARMATO] };
    case "calendario": { const tr = { trigger: "calendar", event: "start", entity_id: L[0] || "" }; if (+q.prima) tr.offset = hms(-Math.abs(+q.prima)); return tr; }
    case "pioggia": return { trigger: "state", entity_id: L.length ? L : E(weatherEnt()), to: [...PIOGGIA] };
    case "casa": return q.evento === "primo" ? { trigger: "numeric_state", entity_id: "zone.home", above: 0 } : { trigger: "state", entity_id: "zone.home", to: "0" };
  }
  return NON;
}
function condHA(c) {
  const L = E(c.entita);
  switch (c.tipo) {
    case "casa":
      if (c._vecchio?.length && c.chi === "qualcuno") return { condition: "or", conditions: c._vecchio.map(p => ({ condition: "state", entity_id: p, state: "home" })) };
      if (c._vecchio?.length && c.chi === "nessuno") return { condition: "and", conditions: c._vecchio.map(p => ({ condition: "not", conditions: [{ condition: "state", entity_id: p, state: "home" }] })) };
      if (c.chi === "qualcuno") return { condition: "numeric_state", entity_id: "zone.home", above: 0 };
      if (c.chi === "nessuno") return { condition: "state", entity_id: "zone.home", state: "0" };
      if (c.chi) { const s = { condition: "state", entity_id: c.chi, state: "home" }; return c.dentro === false ? { condition: "not", conditions: [s] } : s; }
      return null;
    case "orario": { const o = { condition: "time" }; if (hhmm(c.dalle)) o.after = hhmm(c.dalle) + ":00"; if (hhmm(c.alle)) o.before = hhmm(c.alle) + ":00"; if (arr(c.giorni).length) o.weekday = [...c.giorni];
      return Object.keys(o).length > 1 ? o : null; }
    case "sole": return { condition: "state", entity_id: "sun.sun", state: c.fase === "notte" ? "below_horizon" : "above_horizon" };
    case "stato": return L.length ? { condition: "state", entity_id: L, state: c.stato ?? "on" } : null;
    case "valore": { if (!L.length) return null; const o = { condition: "numeric_state", entity_id: L }; o[c.verso === "sotto" ? "below" : "above"] = num(c.valore) ?? 0; return o; }
  }
  return NON;
}
/** le condizioni: «e» (una dopo l'altra) oppure «o» (ne basta una); il filtro della pressione di un pulsante va sempre davanti */
function condizioniHA(m) {
  const C = m.soloSe.cond.map(condHA).filter(Boolean);
  const pr = m.quando.filter(q => q.tipo === "pulsante" && !q.device && q.pressione && E(q.entita)[0]).map(q => ({ condition: "state", entity_id: E(q.entita)[0], attribute: "event_type", state: q.pressione }));
  return [...pr, ...(m.soloSe.modo === "o" && C.length > 1 ? [{ condition: "or", conditions: C }] : C)];
}
/** accendere / spegnere / commutare: un'azione per dominio (le tapparelle si aprono, le serrature si aprono, i robot partono) */
function onOff(tipo, L, a = {}) {
  const out = [];
  for (const dom of [...new Set(L.map(x => x.split(".")[0]))]) {
    const ids = L.filter(x => x.startsWith(dom + ".")), srv = dom === "cover" ? { on: "open_cover", off: "close_cover", toggle: "toggle" }[tipo]
      : dom === "lock" ? { on: "unlock", off: "lock", toggle: "lock" }[tipo] : dom === "vacuum" ? { on: "start", off: "return_to_base", toggle: "start" }[tipo]
      : dom === "valve" ? { on: "open_valve", off: "close_valve", toggle: "toggle" }[tipo] : "turn_" + tipo;
    const x = { action: `${dom}.${tipo === "toggle" && !["cover", "lock", "vacuum", "valve"].includes(dom) ? "toggle" : srv}`, target: { entity_id: ids } };
    if (dom === "light" && tipo === "on") { const d = {}; if (+a.lum) d.brightness_pct = +a.lum; if (hex2rgb(a.colore)) d.rgb_color = hex2rgb(a.colore); else if (+a.kelvin) d.color_temp_kelvin = +a.kelvin; if (Object.keys(d).length) x.data = d; }
    out.push(x);
  }
  return out;
}
/** azioni del modello → azioni di Home Assistant (usato anche dai Momenti, che diventano script) */
export function azioniHA(m) {
  const act = [], titolo = a => a.titolo != null ? a.titolo : "🌶️ " + (m.nome || "'Nduja");
  for (const a of m.azioni) {
    const L = E(a.entita);
    switch (a.tipo) {
      case "on": case "off": case "toggle": if (L.length) act.push(...onOff(a.tipo, L, a)); break;
      case "pertempo": if (L.length) act.push(...onOff("on", L, a), { delay: { minutes: +a.minuti || 2 } }, ...onOff("off", L)); break;
      case "tapparella": if (L.length) act.push({ action: "cover.set_cover_position", target: { entity_id: L }, data: { position: Math.max(0, Math.min(100, Math.round(num(a.pos) ?? 0))) } }); break;
      case "clima": if (L.length && num(a.temp) != null) act.push({ action: "climate.set_temperature", target: { entity_id: L }, data: { temperature: +a.temp, ...(a.modo ? { hvac_mode: a.modo } : {}) } });
        else if (L.length && a.modo) act.push({ action: "climate.set_hvac_mode", target: { entity_id: L }, data: { hvac_mode: a.modo } }); break;
      case "scena": { const sc = L.filter(x => x.startsWith("scene.")), sp = L.filter(x => x.startsWith("script."));
        /* l'ordine scelto: prima il tipo del primo elemento (come in 0.7.22) */
        const g = L[0]?.startsWith("script.") ? [["script", sp], ["scene", sc]] : [["scene", sc], ["script", sp]];
        for (const [d, ids] of g) if (ids.length) act.push({ action: d + ".turn_on", target: { entity_id: ids } }); break; }
      case "automazione": if (L.length) act.push({ action: "automation.trigger", target: { entity_id: L } }); break;
      case "allarme": if (L.length) act.push({ action: "alarm_control_panel." + (a.modo || "alarm_arm_away"), target: { entity_id: L }, ...(a.codice ? { data: { code: a.codice } } : {}) }); break;
      case "notifica": { const d = { message: a.messaggio || m.nome || "'Nduja" }, ti = titolo(a); if (ti) d.title = ti;
        if (a.apri) d.data = { url: PANNELLO, clickAction: PANNELLO, actions: [{ action: "URI", title: t("Apri 'Nduja", "Open 'Nduja"), uri: PANNELLO }] };
        act.push({ action: "notify." + (a.servizio || "notify"), data: d }); break; }
      case "alexa": { if (!L.length) break; const tipo = a.modo === "tts" ? "tts" : "announce", msg = a.messaggio || m.nome || "'Nduja", sv = servizi().notify;
        if (a.servizio === "singoli" || (sv && !sv.alexa_media && L.every(x => sv["alexa_media_" + x.split(".")[1]])))
          L.forEach(x => act.push({ action: "notify.alexa_media_" + x.split(".")[1], data: { message: msg, data: { type: tipo } } }));
        else act.push({ action: "notify.alexa_media", data: { message: msg, target: L, data: { type: tipo } } });
        break; }
      case "attendi": act.push({ delay: { minutes: +a.minuti || 5 } }); break;
      default: act.push(NON);
    }
  }
  return act;
}
/** la configurazione intera di Home Assistant */
export function inHA(m0, id) {
  const m = normalizza(m0);
  return { id, alias: m.nome, description: m.descrizione != null ? m.descrizione : t("Creata con 'Nduja Dashboard", "Created with 'Nduja Dashboard"),
    triggers: m.quando.map(trigHA), conditions: condizioniHA(m), actions: azioniHA(m), mode: m.modo || "single" };
}
/** che cosa manca per salvare (testo da mostrare) o null se è tutto a posto */
export function controlla(m0) {
  const m = normalizza(m0), cfg = inHA(m, "x");
  if (!m.nome.trim()) return t("Scrivi un nome", "Write a name");
  for (const q of m.quando) {
    if (["stato", "soglia", "apertura", "movimento", "elettro", "allarme", "calendario"].includes(q.tipo) && !E(q.entita).length) return t("Completa il «Quando»: scegli il dispositivo", "Complete the «When»: choose the device");
    if (q.tipo === "persona" && !E(q.persona).length) return t("Completa il «Quando»: scegli chi", "Complete the «When»: choose who");
    if (q.tipo === "pulsante" && !q.device && !E(q.entita).length) return t("Completa il «Quando»: scegli il pulsante", "Complete the «When»: choose the button");
    if (q.tipo === "pioggia" && !E(q.entita).length && !weatherEnt()) return t("Per la pioggia serve il meteo in Home Assistant", "Rain needs a weather entity in Home Assistant");
    if (q.tipo === "soglia" && num(q.valore) == null) return t("Scrivi il valore della soglia", "Write the threshold value");
  }
  if (m.quando.some(q => q.tipo === "pulsante" && q.pressione && !q.device) && m.quando.length > 1)
    return t("Con «quale pressione» il pulsante deve essere l'unico «Quando»", "With «which press» the button must be the only «When»");
  for (const c of m.soloSe.cond) {
    if (["stato", "valore"].includes(c.tipo) && !E(c.entita).length) return t("Completa il «Solo se»: scegli il dispositivo", "Complete the «Only if»: choose the device");
    if (c.tipo === "valore" && num(c.valore) == null) return t("Completa il «Solo se»: scrivi il valore", "Complete the «Only if»: write the value");
  }
  if (!cfg.actions.length) return t("Aggiungi almeno un'azione con i dispositivi", "Add at least one action with devices");
  for (const a of m.azioni) {
    if (["on", "off", "toggle", "pertempo", "tapparella", "clima", "scena", "automazione", "allarme", "alexa"].includes(a.tipo) && !E(a.entita).length) return t("Ogni azione ha bisogno dei suoi dispositivi", "Every action needs its devices");
    if (a.tipo === "clima" && num(a.temp) == null && !a.modo) return t("Clima: scegli la modalità o la temperatura", "Climate: choose the mode or the temperature");
    if (a.tipo === "alexa" && !String(a.messaggio || "").trim()) return t("Scrivi cosa deve dire Alexa", "Write what Alexa should say");
  }
  return null;
}

/* ================= uniformare le scritture equivalenti ================= */
const unoSolo = v => Array.isArray(v) && v.length === 1 ? v[0] : v;
const numero = v => typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? +v : v;
const orario = v => { const h = hhmm(v); return h ? (h.length === 5 ? h + ":00" : h) : v; };
function nTrig(x0) {
  if (!x0 || typeof x0 !== "object") return x0;
  const x = { ...x0 };
  if (x.platform && !x.trigger) { x.trigger = x.platform; } delete x.platform;
  if ("entity_id" in x && x.trigger !== "calendar") x.entity_id = arr(x.entity_id);
  for (const k of ["to", "from", "not_to", "not_from"]) if (k in x) x[k] = unoSolo(x[k]);
  if ("for" in x) x.for = { s: secondi(x.for) };
  if (x.trigger === "time" && "at" in x) x.at = Array.isArray(x.at) ? x.at.map(orario) : orario(x.at);
  if ((x.trigger === "sun" || x.trigger === "calendar") && "offset" in x) { x.offset = secondi(x.offset); if (!x.offset) delete x.offset; }
  for (const k of ["above", "below"]) if (k in x) x[k] = numero(x[k]);
  return x;
}
function nCond(c0) {
  if (typeof c0 === "string") return { template: c0 };
  if (!c0 || typeof c0 !== "object") return c0;
  let c = { ...c0 };
  for (const k of ["or", "and", "not"]) if (!c.condition && Array.isArray(c[k])) { c = { condition: k, conditions: c[k] }; break; }
  if (Array.isArray(c.conditions)) c.conditions = c.conditions.map(nCond); else if (c.conditions) c.conditions = [nCond(c.conditions)];
  if ("entity_id" in c) c.entity_id = arr(c.entity_id);
  if ("state" in c) c.state = unoSolo(c.state);
  if ("weekday" in c) c.weekday = arr(c.weekday);
  if (c.condition === "time") for (const k of ["after", "before"]) if (k in c) c[k] = orario(c[k]);
  for (const k of ["above", "below"]) if (k in c) c[k] = numero(c[k]);
  if ("for" in c) c.for = { s: secondi(c.for) };
  return c;
}
function nAz(a0) {
  if (!a0 || typeof a0 !== "object") return a0;
  const a = { ...a0 };
  if (a.service && !a.action) a.action = a.service; delete a.service;
  if ("delay" in a) { a.delay = { s: secondi(a.delay) }; return a; }
  if ("entity_id" in a) { a.target = { ...(a.target || {}), entity_id: a.entity_id }; delete a.entity_id; }
  if (a.data?.entity_id) { a.target = { ...(a.target || {}), entity_id: a.data.entity_id }; a.data = { ...a.data }; delete a.data.entity_id; }
  if (a.target) { a.target = { ...a.target }; for (const k of Object.keys(a.target)) a.target[k] = arr(a.target[k]); }
  if (a.data && typeof a.data === "object" && !Object.keys(a.data).length) delete a.data;
  return a;
}
const lista = (c, k1, k2) => arr(c[k1] ?? c[k2]);
/** forma unica per il confronto: solo quello che conta (non id, nome e descrizione) */
export function uniforma(cfg) {
  const fuori = Object.keys(cfg || {}).filter(k => !["id", "alias", "description", "triggers", "trigger", "conditions", "condition", "actions", "action", "mode"].includes(k));
  return { triggers: lista(cfg, "triggers", "trigger").map(nTrig), conditions: lista(cfg, "conditions", "condition").map(nCond), actions: lista(cfg, "actions", "action").map(nAz),
    mode: cfg.mode || "single", ...Object.fromEntries(fuori.map(k => ["extra_" + k, cfg[k]])) };
}
const ordinato = x => Array.isArray(x) ? x.map(ordinato) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordinato(x[k])])) : x;
export const uguali = (a, b) => JSON.stringify(ordinato(uniforma(a))) === JSON.stringify(ordinato(uniforma(b)));

/* ================= Home Assistant → modello ================= */
const soloChiavi = (o, K) => Object.keys(o).every(k => K.includes(k));
function daTrig(x0) {
  const x = nTrig(x0); if (!x || typeof x !== "object") return null;
  const L = arr(x.entity_id), fm = x.for ? minuti(x.for.s) : null;
  if (x.for && fm == null) return null;
  switch (x.trigger) {
    /* solo da leggere (il costruttore non li scrive): bastano a dire la frase */
    case "time_pattern": { const q = [["hours", t("ore", "hours"), t("ogni ora", "every hour")], ["minutes", t("minuti", "minutes"), t("ogni minuto", "every minute")], ["seconds", t("secondi", "seconds"), t("ogni secondo", "every second")]].find(([k]) => x[k] != null);
      if (!q) return null; const v = String(x[q[0]]); return { tipo: "_f", html: /^\/\d+$/.test(v) ? t(`ogni ${v.slice(1)} ${q[1]}`, `every ${v.slice(1)} ${q[1]}`) : v === "*" || v === "/1" ? q[2] : t(`quando i ${q[1]} sono ${esc(v)}`, `when the ${q[1]} are ${esc(v)}`) }; }
    case "template": return { tipo: "_f", html: t("quando una condizione scritta a mano diventa vera", "when a hand-written template becomes true") };
    case "homeassistant": return { tipo: "_f", html: x.event === "shutdown" ? t("quando Home Assistant si spegne", "when Home Assistant shuts down") : t("quando Home Assistant si avvia", "when Home Assistant starts") };
    case "time": if (typeof x.at === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(x.at)) return { tipo: "_f", html: t("all'ora di ", "at the time of ") + B(x.at) }; return typeof x.at === "string" && /^\d{2}:\d{2}:\d{2}$/.test(x.at) && soloChiavi(x, ["trigger", "at"]) ? { tipo: "ora", ora: x.at.endsWith(":00") ? x.at.slice(0, 5) : x.at } : null;
    case "sun": { const o = x.offset == null ? 0 : x.offset; return ["sunrise", "sunset"].includes(x.event) && o % 60 === 0 && soloChiavi(x, ["trigger", "event", "offset"]) ? { tipo: "sole", evento: x.event, offset: o / 60 } : null; }
    case "zone": return x.zone === "zone.home" && L.length && soloChiavi(x, ["trigger", "entity_id", "zone", "event"]) ? { tipo: "persona", persona: L.length === 1 ? L[0] : L, evento: x.event === "leave" ? "esce" : "arriva" } : null;
    case "calendar": return x.event === "start" && typeof x.entity_id === "string" && (x.offset == null || (x.offset <= 0 && x.offset % 60 === 0)) && soloChiavi(x, ["trigger", "event", "entity_id", "offset"])
      ? { tipo: "calendario", entita: x.entity_id, prima: x.offset ? -x.offset / 60 : 0 } : null;
    case "device": { const d = { ...x0 }; delete d.platform; delete d.trigger; return { tipo: "pulsante", device: d }; }
    case "numeric_state": {
      if (!soloChiavi(x, ["trigger", "entity_id", "above", "below", "for"]) || ("above" in x) === ("below" in x) || typeof (x.above ?? x.below) !== "number" || !L.length) return null;
      if (L.length === 1 && L[0] === "zone.home") return x.above === 0 && !x.for ? { tipo: "casa", evento: "primo" } : null;
      if ("below" in x && L.length === 1 && isElettro(L[0])) { const g = soglie(L[0]); if (x.below === g.off && fm === g.min) return { tipo: "elettro", entita: L[0] }; }
      return { tipo: "soglia", entita: L, verso: "below" in x ? "sotto" : "sopra", valore: x.above ?? x.below, per: fm || "" };
    }
    case "state": {
      if (!L.length) return null;
      if (L.length === 1 && L[0] === "zone.home") return x.to === "0" && soloChiavi(x, ["trigger", "entity_id", "to"]) ? { tipo: "casa", evento: "ultimo" } : null;
      if (L.every(id => id.startsWith("event.")) && JSON.stringify(x.not_from) === JSON.stringify(["unavailable", "unknown"]) && JSON.stringify(x.not_to) === JSON.stringify(["unavailable", "unknown"]) && soloChiavi(x, ["trigger", "entity_id", "not_from", "not_to"]))
        return { tipo: "pulsante", entita: L[0], ...(L.length > 1 ? { entita: L } : {}) };
      if (!soloChiavi(x, ["trigger", "entity_id", "to", "for"])) return null;
      if (L.every(id => id.startsWith("alarm_control_panel."))) {
        if (JSON.stringify(x.to) === JSON.stringify(ARMATO) && !x.for) return { tipo: "allarme", entita: L, evento: "inserito" };
        if ((x.to === "triggered" || x.to === "disarmed") && !x.for) return { tipo: "allarme", entita: L, evento: x.to === "triggered" ? "scattato" : "disinserito" };
      }
      if (L.every(id => id.startsWith("weather.")) && JSON.stringify(x.to) === JSON.stringify(PIOGGIA) && !x.for) return { tipo: "pioggia", entita: L };
      if (Array.isArray(x.to)) return null;
      if (x.to === "on" && fm && L.every(apertura)) return { tipo: "apertura", entita: L, min: fm };
      if (L.every(movimento) && ((x.to === "on" && !x.for) || (x.to === "off" && fm))) return x.to === "on" ? { tipo: "movimento", entita: L, modo: "rilevato" } : { tipo: "movimento", entita: L, modo: "nessuno", min: fm };
      if (x.to != null && typeof x.to !== "string") return null;
      return { tipo: "stato", entita: L.length === 1 ? L[0] : L, a: x.to == null ? "*" : x.to, per: fm || "" };
    }
  }
  return null;
}
/** una condizione (null = non la so rappresentare) */
function daCond(c0) {
  const c = nCond(c0); if (!c || typeof c !== "object") return null;
  const L = arr(c.entity_id);
  if (c.condition === "numeric_state" && L.length === 1 && L[0] === "zone.home" && c.above === 0 && soloChiavi(c, ["condition", "entity_id", "above"])) return { tipo: "casa", chi: "qualcuno" };
  if (c.condition === "state" && L.length === 1 && L[0] === "zone.home" && c.state === "0" && soloChiavi(c, ["condition", "entity_id", "state"])) return { tipo: "casa", chi: "nessuno" };
  /* come le scriveva la 0.7.22: «o» di tutte le persone in casa, «e» di tutte le persone non in casa (solo lettura) */
  const inCasa = x => x?.condition === "state" && arr(x.entity_id).length === 1 && arr(x.entity_id)[0].startsWith("person.") && x.state === "home" && soloChiavi(x, ["condition", "entity_id", "state"]);
  if (c.condition === "or" && c.conditions?.length && c.conditions.every(inCasa)) return { tipo: "casa", chi: "qualcuno", _vecchio: c.conditions.map(x => arr(x.entity_id)[0]) };
  if (c.condition === "and" && c.conditions?.length && c.conditions.every(x => x.condition === "not" && x.conditions?.length === 1 && inCasa(x.conditions[0]))) return { tipo: "casa", chi: "nessuno", _vecchio: c.conditions.map(x => arr(x.conditions[0].entity_id)[0]) };
  if (inCasa(c)) return { tipo: "casa", chi: L[0], dentro: true };
  if (c.condition === "not" && c.conditions?.length === 1 && inCasa(c.conditions[0]) && soloChiavi(c, ["condition", "conditions"])) return { tipo: "casa", chi: arr(c.conditions[0].entity_id)[0], dentro: false };
  if (c.condition === "time" && soloChiavi(c, ["condition", "after", "before", "weekday"]) && [c.after, c.before].every(v => v == null || /^\d{2}:\d{2}:00$/.test(v)))
    return { tipo: "orario", dalle: c.after ? c.after.slice(0, 5) : "", alle: c.before ? c.before.slice(0, 5) : "", ...(c.weekday ? { giorni: c.weekday } : {}) };
  if (c.condition === "state" && L.length === 1 && L[0] === "sun.sun" && ["above_horizon", "below_horizon"].includes(c.state) && soloChiavi(c, ["condition", "entity_id", "state"])) return { tipo: "sole", fase: c.state === "below_horizon" ? "notte" : "giorno" };
  if (c.condition === "state" && L.length && typeof c.state === "string" && soloChiavi(c, ["condition", "entity_id", "state"])) return { tipo: "stato", entita: L.length === 1 ? L[0] : L, stato: c.state };
  if (c.condition === "numeric_state" && L.length && soloChiavi(c, ["condition", "entity_id", "above", "below"]) && ("above" in c) !== ("below" in c) && typeof (c.above ?? c.below) === "number")
    return { tipo: "valore", entita: L.length === 1 ? L[0] : L, verso: "below" in c ? "sotto" : "sopra", valore: c.above ?? c.below };
  return null;
}
const SRV_ON = { turn_on: "on", turn_off: "off", toggle: "toggle", open_cover: "on", close_cover: "off", unlock: "on", lock: "off", start: "on", return_to_base: "off", open_valve: "on", close_valve: "off" };
/** un'azione di Home Assistant → un pezzo semplice (poi si uniscono quelli che vanno insieme) */
function daAzUno(a0) {
  const a = nAz(a0); if (!a || typeof a !== "object") return null;
  if ("delay" in a) { const m = minuti(a.delay.s); return m && soloChiavi(a, ["delay"]) ? { tipo: "attendi", minuti: m } : null; }
  if (typeof a.action !== "string" || !soloChiavi(a, ["action", "target", "data"])) return null;
  const [dom, srv] = a.action.split("."), L = arr(a.target?.entity_id), d = a.data || {};
  if (a.target && !soloChiavi(a.target, ["entity_id"])) {   // per stanza / piano / etichetta: solo da leggere
    const dove = [...arr(a.target.area_id).map(x => AREE()[x]?.name || x), ...arr(a.target.floor_id), ...arr(a.target.label_id)];
    const v = { turn_on: t("accendi", "turn on"), turn_off: t("spegni", "turn off"), toggle: t("commuta", "toggle"), open_cover: t("apri", "open"), close_cover: t("chiudi", "close") }[srv];
    const cosa = { light: t("le luci", "the lights"), switch: t("le prese", "the switches"), cover: t("le tapparelle", "the covers"), climate: t("il clima", "the climate"), media_player: t("i lettori", "the players") }[dom];
    return dove.length ? { tipo: "_f", html: v && cosa ? `${v} ${cosa} ${t("in", "in")} ${elenco(dove.map(x => `<b>${esc(x)}</b>`))}` : `${t("usa", "use")} «${esc(a.action)}» ${t("in", "in")} ${elenco(dove.map(x => `<b>${esc(x)}</b>`))}` } : null;
  }
  if (dom === "notify") {
    if (srv === "alexa_media" || srv.startsWith("alexa_media_")) {
      if (!soloChiavi(d, ["message", "target", "data"]) || (d.data && !soloChiavi(d.data, ["type"]))) return null;
      const tipo = d.data?.type || "announce"; if (!["announce", "tts"].includes(tipo)) return null;
      const chi = srv === "alexa_media" ? arr(d.target) : (d.target ? null : ["media_player." + srv.slice(12)]); if (!chi?.length) return null;
      return { tipo: "alexa", entita: chi, messaggio: d.message || "", modo: tipo, ...(srv !== "alexa_media" ? { servizio: "singoli" } : {}) };
    }
    if (!soloChiavi(d, ["message", "title", "data"]) || L.length) return null;
    const apri = d.data ? JSON.stringify(ordinato(d.data)) === JSON.stringify(ordinato({ url: PANNELLO, clickAction: PANNELLO, actions: [{ action: "URI", title: t("Apri 'Nduja", "Open 'Nduja"), uri: PANNELLO }] })) : false;
    return { tipo: "notifica", servizio: srv, messaggio: d.message || "", titolo: d.title ?? "", ...(apri ? { apri: true } : {}) };
  }
  if (!L.length) return dom === "script" && srv && srv !== "turn_on" ? { tipo: "_f", html: `${t("esegui lo script", "run the script")} ${B("script." + srv)}` } : null;
  if (dom === "cover" && srv === "set_cover_position" && soloChiavi(d, ["position"])) return { tipo: "tapparella", entita: L, pos: d.position };
  if (dom === "climate" && srv === "set_temperature" && "temperature" in d && soloChiavi(d, ["temperature", "hvac_mode"])) return { tipo: "clima", entita: L, temp: d.temperature, modo: d.hvac_mode || "" };
  if (dom === "climate" && srv === "set_hvac_mode" && soloChiavi(d, ["hvac_mode"])) return { tipo: "clima", entita: L, modo: d.hvac_mode, temp: "" };
  if ((dom === "scene" || dom === "script") && srv === "turn_on" && !Object.keys(d).length && L.every(x => x.startsWith(dom + "."))) return { tipo: "scena", entita: L };
  if (dom === "automation" && srv === "trigger" && !Object.keys(d).length) return { tipo: "automazione", entita: L };
  if (dom === "alarm_control_panel" && /^alarm_(arm_\w+|disarm)$/.test(srv) && soloChiavi(d, ["code"])) return { tipo: "allarme", entita: L, modo: srv, ...(d.code ? { codice: String(d.code) } : {}) };
  if (SRV_ON[srv] && L.every(x => x.startsWith(dom + "."))) {
    const tipo = srv === "toggle" ? "toggle" : SRV_ON[srv], x = { tipo, entita: L, _dom: dom };
    if (dom === "light" && tipo === "on") {
      if (!soloChiavi(d, ["brightness_pct", "rgb_color", "color_temp_kelvin"])) return generico(a, L);
      if (d.brightness_pct != null) x.lum = d.brightness_pct; if (d.rgb_color) x.colore = rgb2hex(d.rgb_color); if (d.color_temp_kelvin != null) x.kelvin = d.color_temp_kelvin;
    } else if (Object.keys(d).length) return generico(a, L);
    /* «toggle» delle serrature e dei robot non esiste: è la parola usata dal costruttore per chiudere / avviare */
    return x;
  }
  /* solo da leggere: un servizio qualsiasi sui dispositivi */
  return generico(a, L);
}
const generico = (a, L) => a.action === "script.turn_on" ? { tipo: "_f", html: `${t("esegui", "run")} ${nomi(L)}${a.data ? t(" (con dei valori)", " (with some values)") : ""}` } : ({ tipo: "_f", html: `${t("usa", "use")} «${esc(a.action)}» ${t("su", "on")} ${nomi(L)}` });
/** azioni: unisce le accensioni dello stesso tipo (una per dominio in Home Assistant) e riconosce «accendi per N minuti» */
function daAzioni(L0) {
  const P = L0.map(daAzUno), out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (!p) { out.push(null); continue; }
    const prec = out[out.length - 1], chiave = x => JSON.stringify([x.tipo, x.lum ?? null, x.colore ?? null, x.kelvin ?? null]);
    if (["on", "off", "toggle"].includes(p.tipo) && prec && ["on", "off", "toggle"].includes(prec.tipo) && chiave(prec) === chiave(p) && !prec._doms.includes(p._dom)) {
      prec.entita = [...prec.entita, ...p.entita]; prec._doms.push(p._dom); continue; }
    if (["on", "off", "toggle"].includes(p.tipo)) p._doms = [p._dom];
    out.push(p);
  }
  /* accendi + aspetta + spegni (gli stessi) = «accendi per N minuti» */
  const fin = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[i + 1], c = out[i + 2];
    if (a?.tipo === "on" && b?.tipo === "attendi" && c?.tipo === "off" && JSON.stringify(a.entita) === JSON.stringify(c.entita)) {
      fin.push({ tipo: "pertempo", entita: a.entita, minuti: b.minuti, ...(a.lum != null ? { lum: a.lum } : {}), ...(a.colore ? { colore: a.colore } : {}), ...(a.kelvin != null ? { kelvin: a.kelvin } : {}) }); i += 2; continue; }
    fin.push(a);
  }
  return fin.map(x => { if (!x) return x; const y = { ...x }; delete y._dom; delete y._doms; return y; });
}
/** legge una configurazione di Home Assistant: { modello, avanzati (pezzi che non so dire), modificabile, motivo } */
export function daHA(cfg) {
  const T = lista(cfg, "triggers", "trigger"), C = lista(cfg, "conditions", "condition"), A = lista(cfg, "actions", "action");
  const quando = T.map(daTrig);
  /* condizioni: il filtro della pressione di un pulsante, poi una «o» intera oppure un elenco «e» */
  let Cr = [...C], pressione = null;
  const ev = quando.length === 1 && quando[0]?.tipo === "pulsante" && !quando[0].device ? arr(quando[0].entita)[0] : null;
  const c0 = Cr[0] && nCond(Cr[0]);
  if (ev && c0?.condition === "state" && c0.attribute === "event_type" && arr(c0.entity_id)[0] === ev && soloChiavi(c0, ["condition", "entity_id", "attribute", "state"]) && typeof c0.state === "string") { pressione = c0.state; Cr = Cr.slice(1); }
  let modo = "e", cond;
  const n0 = Cr.length === 1 ? nCond(Cr[0]) : null;
  if (n0?.condition === "or" && soloChiavi(n0, ["condition", "conditions"]) && !daCond(Cr[0])) { modo = "o"; cond = n0.conditions.map(daCond); }
  else cond = Cr.map(daCond);
  const azioni = daAzioni(A);
  if (pressione) quando[0].pressione = pressione;
  const modello = { v: 2, nome: cfg.alias || "", descrizione: cfg.description ?? "", modo: cfg.mode || "single",
    quando: quando.filter(Boolean), soloSe: { modo, cond: cond.filter(Boolean) }, azioni: azioni.filter(Boolean) };
  const avanzati = quando.filter(x => !x).length + cond.filter(x => !x).length + azioni.filter(x => !x).length;
  let modificabile = false, motivo = "";
  if (avanzati) motivo = "avanzati";
  else if (!T.length || !A.length) motivo = "vuota";
  else { try { modificabile = uguali(inHA(modello, cfg.id), cfg); } catch { modificabile = false; } if (!modificabile) motivo = "diversa"; }
  return { modello, avanzati, modificabile, motivo, quando, cond, azioni };
}

/* ================= la frase ================= */
const B = id => `<b>${esc(S[id] ? nm(id) : id)}</b>`;
/** «A, B e C» */
export const elenco = L => { L = L.filter(Boolean); return L.length <= 1 ? (L[0] || "") : L.slice(0, -1).join(", ") + t(" e ", " and ") + L[L.length - 1]; };
const nomi = v => elenco(E(v).map(B)) || "<b>…</b>";
const min = n => n === 1 ? t("1 minuto", "1 minute") : `${n} ${t("minuti", "minutes")}`;
const u = id => { const x = unit(E(id)[0] || ""); return !x ? "" : x === "%" ? "%" : " " + esc(x); };
/** «al 40%», «all'80%», «all'8%» (in inglese «at 40%») */
const alPct = n => { n = Math.round(+n || 0); return t((n === 1 || n === 8 || n === 11 || (n >= 80 && n < 90) ? "all'" : "al ") + n + "%", "at " + n + "%"); };
/** nome del colore più vicino (per la frase) */
function nomeColore(h) {
  const c = hex2rgb(h); if (!c) return "";
  const [r, g, b] = c.map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx > .85 && d < .15) return t("bianco", "white"); if (mx < .2) return t("spento", "dark");
  let hu = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hu = (hu * 60 + 360) % 360;
  return hu < 15 || hu >= 340 ? t("rosso", "red") : hu < 45 ? t("arancione", "orange") : hu < 70 ? t("giallo", "yellow") : hu < 160 ? t("verde", "green") : hu < 200 ? t("azzurro", "cyan") : hu < 250 ? t("blu", "blue") : hu < 290 ? t("viola", "purple") : t("rosa", "pink");
}
const GIORNI = () => ({ mon: t("lunedì", "Monday"), tue: t("martedì", "Tuesday"), wed: t("mercoledì", "Wednesday"), thu: t("giovedì", "Thursday"), fri: t("venerdì", "Friday"), sat: t("sabato", "Saturday"), sun: t("domenica", "Sunday") });
/** «A, B o C» */
const oppure = L => L.length <= 1 ? (L[0] || "") : L.slice(0, -1).join(", ") + t(" o ", " or ") + L[L.length - 1];
const HVAC = () => ({ off: t("spento", "off"), heat: t("caldo", "heat"), cool: t("freddo", "cool"), auto: "auto", heat_cool: "auto", dry: t("deumidifica", "dry"), fan_only: t("ventola", "fan") });
/** il nome di uno stato, detto bene per quel tipo di dispositivo */
export function nomeStato(id, s) {
  const d = String(id).split(".")[0], dc = deviceClass(id);
  if (s === "on" || s === "off") {
    const on = s === "on";
    if (d === "binary_sensor") return OPENING.includes(dc) ? (on ? t("aperta", "open") : t("chiusa", "closed")) : ["motion", "occupancy", "presence"].includes(dc) ? (on ? t("rileva qualcuno", "detects someone") : t("libero", "clear"))
      : ["moisture", "smoke", "gas", "carbon_monoxide"].includes(dc) ? (on ? t("in allarme", "alerting") : t("tranquillo", "clear")) : on ? t("attivo", "on") : t("a riposo", "off");
    return on ? t("acceso", "on") : t("spento", "off");
  }
  const N = { open: t("aperta", "open"), closed: t("chiusa", "closed"), opening: t("si apre", "opening"), closing: t("si chiude", "closing"), locked: t("chiusa a chiave", "locked"), unlocked: t("aperta", "unlocked"),
    home: t("in casa", "home"), not_home: t("fuori", "away"), playing: t("in riproduzione", "playing"), paused: t("in pausa", "paused"), idle: t("fermo", "idle"),
    disarmed: t("disinserito", "disarmed"), triggered: t("scattato", "triggered"), armed_away: t("inserito fuori casa", "armed away"), armed_home: t("inserito in casa", "armed home"), armed_night: t("inserito notte", "armed night"),
    sunny: t("sereno", "sunny"), "clear-night": t("sereno", "clear"), cloudy: t("nuvoloso", "cloudy"), partlycloudy: t("poco nuvoloso", "partly cloudy"), rainy: t("piovoso", "rainy"), pouring: t("a rovesci", "pouring"),
    "lightning-rainy": t("temporalesco", "stormy"), snowy: t("nevoso", "snowy"), fog: t("nebbioso", "foggy"), windy: t("ventoso", "windy"),
    cleaning: t("pulisce", "cleaning"), docked: t("alla base", "docked"), above_horizon: t("sopra l'orizzonte", "above the horizon"), below_horizon: t("sotto l'orizzonte", "below the horizon"), ...HVAC() };
  return N[s] || `«${esc(s)}»`;
}
/** possibili stati di un'entità, per il menu «Solo se … è» */
export function statiPossibili(id) {
  const d = String(id || "").split(".")[0];
  if (d === "cover") return ["open", "closed"];
  if (d === "lock") return ["locked", "unlocked"];
  if (d === "climate") return attr(id, "hvac_modes") || ["off", "heat", "cool", "auto"];
  if (d === "media_player") return ["playing", "paused", "idle", "off", "on"];
  if (d === "alarm_control_panel") return ["disarmed", "armed_away", "armed_home", "armed_night", "triggered"];
  if (d === "person" || d === "device_tracker") return ["home", "not_home"];
  if (d === "vacuum") return ["cleaning", "docked", "idle", "paused"];
  if (["input_select", "select"].includes(d)) return attr(id, "options") || [];
  return ["on", "off"];
}
const verbo = (tipo, L) => {   // «si apre», «si accende»… per il cambio di stato
  const id = E(L)[0] || "", d = id.split(".")[0], dc = deviceClass(id), pl = E(L).length > 1;
  if (tipo === "*") return pl ? t("cambiano", "change") : t("cambia", "changes");
  const on = tipo === "on";
  if (tipo !== "on" && tipo !== "off") return (pl ? t("diventano ", "become ") : t("diventa ", "becomes ")) + nomeStato(id, tipo);
  if (d === "binary_sensor" && OPENING.includes(dc)) return on ? (pl ? t("si aprono", "open") : t("si apre", "opens")) : (pl ? t("si chiudono", "close") : t("si chiude", "closes"));
  if (d === "binary_sensor" && ["motion", "occupancy", "presence"].includes(dc)) return on ? (pl ? t("rilevano movimento", "detect motion") : t("rileva movimento", "detects motion")) : (pl ? t("tornano liberi", "clear") : t("torna libero", "clears"));
  if (d === "binary_sensor") return on ? (pl ? t("si attivano", "turn on") : t("si attiva", "turns on")) : (pl ? t("tornano a riposo", "turn off") : t("torna a riposo", "turns off"));
  return on ? (pl ? t("si accendono", "turn on") : t("si accende", "turns on")) : (pl ? t("si spengono", "turn off") : t("si spegne", "turns off"));
};
/** frase di un «Quando» (dopo «quando», tranne l'ora che dice «alle …») */
export function fraseQ(q) {
  if (!q) return null;
  if (q.tipo === "_f") return q.html;
  const L = q.entita, per = +q.per ? t(` per almeno ${min(+q.per)}`, ` for at least ${min(+q.per)}`) : "";
  switch (q.tipo) {
    case "ora": return t(`alle ${esc(q.ora || "07:00")}`, `at ${esc(q.ora || "07:00")}`);
    case "stato": return `${t("quando", "when")} ${nomi(L)} ${verbo(q.a || "on", L)}${per}`;
    case "sole": { const o = +q.offset || 0, ev = q.evento === "sunrise", n = Math.abs(o);
      if (!o) return ev ? t("quando sorge il sole", "when the sun rises") : t("quando il sole tramonta", "when the sun sets");
      const qq = n % 60 ? min(n) : n === 60 ? t("1 ora", "1 hour") : `${n / 60} ${t("ore", "hours")}`;
      return o < 0 ? t(`${qq} prima ${ev ? "dell'alba" : "del tramonto"}`, `${qq} before ${ev ? "sunrise" : "sunset"}`) : t(`${qq} dopo ${ev ? "l'alba" : "il tramonto"}`, `${qq} after ${ev ? "sunrise" : "sunset"}`); }
    case "persona": { const pl = E(q.persona).length > 1; return `${t("quando", "when")} ${nomi(q.persona)} ${q.evento === "esce" ? (pl ? t("escono di casa", "leave home") : t("esce di casa", "leaves home")) : (pl ? t("arrivano a casa", "arrive home") : t("arriva a casa", "arrives home"))}`; }
    case "soglia": return `${t("quando", "when")} ${nomi(L)} ${q.verso === "sotto" ? t("scende sotto", "drops below") : t("supera", "goes above")} ${esc(q.valore ?? "")}${u(L)}${per}`;
    case "apertura": return `${t("quando", "when")} ${nomi(L)} ${E(L).length > 1 ? t("restano aperte", "stay open") : t("resta aperta", "stays open")} ${t("per", "for")} ${min(+q.min || 5)}`;
    case "movimento": return q.modo === "nessuno" ? `${t("quando", "when")} ${nomi(L)} ${t("non rileva nessuno per", "detects nobody for")} ${min(+q.min || 10)}` : `${t("quando", "when")} ${nomi(L)} ${t("rileva movimento", "detects motion")}`;
    case "pulsante": {
      if (q.device) return `${t("quando premi", "when you press")} ${fraseDispositivo(q.device)}`;
      return `${t("quando premi", "when you press")} ${nomi(L)}${q.pressione ? ` (${esc(nomePressione(q.pressione))})` : ""}`; }
    case "elettro": return `${t("quando", "when")} ${elenco(E(L).map(id => `<b>${esc((S[id] ? nm(id) : id).replace(/\s*\b(power|potenza|consumo|watt)\b\s*/ig, " ").trim())}</b>`))} ${t("finisce", "is done")}`;
    case "allarme": return `${t("quando", "when")} ${nomi(L)} ${q.evento === "scattato" ? t("scatta", "is triggered") : q.evento === "disinserito" ? t("si disinserisce", "is disarmed") : t("si inserisce", "is armed")}`;
    case "calendario": return +q.prima ? t(`${min(+q.prima)} prima di un evento di ${nomi(L)}`, `${min(+q.prima)} before an event in ${nomi(L)}`) : `${t("quando inizia un evento di", "when an event starts in")} ${nomi(L)}`;
    case "pioggia": return t("quando il meteo annuncia pioggia", "when the weather says rain");
    case "casa": return q.evento === "primo" ? t("quando arriva il primo a casa", "when the first person gets home") : t("quando esce l'ultimo di casa", "when the last person leaves home");
  }
  return null;
}
const PRESSIONI = () => ({ single: t("una pressione", "single press"), short_press: t("pressione breve", "short press"), initial_press: t("pressione", "press"), press: t("pressione", "press"),
  double: t("doppia", "double"), double_press: t("doppia", "double"), triple: t("tripla", "triple"), long: t("lunga", "long"), long_press: t("lunga", "long"), hold: t("tenuto premuto", "hold"),
  long_release: t("rilasciato dopo una lunga", "released after long"), release: t("rilasciato", "released"), short_release: t("rilasciato", "released"), on: "on", off: "off", up: t("su", "up"), down: t("giù", "down") });
export const nomePressione = p => PRESSIONI()[p] || String(p).replace(/_/g, " ");
/** un pulsante di un dispositivo (device trigger): «Telecomando IKEA, tasto 1 (lunga)» */
export function fraseDispositivo(d) {
  const nome = esc(DEVICES[d.device_id]?.name || t("un dispositivo", "a device"));
  const tipo = String(d.type || "").replace(/^remote_button_|^button_/, ""), pr = PRESSIONI()[tipo] || tipo.replace(/_/g, " ");
  const sub = d.subtype ? String(d.subtype).replace(/^button_?/, t("tasto ", "button ")).replace(/_/g, " ") : "";
  return `<b>${nome}</b>${sub || pr ? ` (${esc([sub, pr].filter(Boolean).join(", "))})` : ""}`;
}
/** frase di una condizione (dopo «se») */
export function fraseC(c) {
  if (!c) return null;
  switch (c.tipo) {
    case "casa":
      if (c._vecchio?.length && c.chi === "qualcuno") return { condition: "or", conditions: c._vecchio.map(p => ({ condition: "state", entity_id: p, state: "home" })) };
      if (c._vecchio?.length && c.chi === "nessuno") return { condition: "and", conditions: c._vecchio.map(p => ({ condition: "not", conditions: [{ condition: "state", entity_id: p, state: "home" }] })) };
      if (c.chi === "qualcuno") return t("c'è qualcuno in casa", "someone is home");
      if (c.chi === "nessuno") return t("non c'è nessuno in casa", "nobody is home");
      return `${B(c.chi)} ${c.dentro === false ? t("non è in casa", "isn't home") : t("è in casa", "is home")}`;
    case "orario": { const p = [], G = GIORNI();
      if (c.dalle && c.alle) p.push(t(`è tra le ${esc(c.dalle)} e le ${esc(c.alle)}`, `it's between ${esc(c.dalle)} and ${esc(c.alle)}`));
      else if (c.dalle) p.push(t(`sono passate le ${esc(c.dalle)}`, `it's after ${esc(c.dalle)}`)); else if (c.alle) p.push(t(`non sono ancora le ${esc(c.alle)}`, `it's before ${esc(c.alle)}`));
      const g = arr(c.giorni);
      if (g.length) p.push(g.length === 5 && ["mon", "tue", "wed", "thu", "fri"].every(x => g.includes(x)) ? t("è un giorno feriale", "it's a weekday") : g.length === 2 && g.includes("sat") && g.includes("sun") ? t("è il fine settimana", "it's the weekend") : `${t("è", "it's")} ${oppure(g.map(x => G[x] || x))}`);
      return p.length ? p.join(t(" e ", " and ")) : null; }
    case "sole": return c.fase === "notte" ? t("è notte", "it's night") : t("è giorno", "it's daytime");
    case "stato": { const L = E(c.entita); return `${nomi(L)} ${L.length > 1 ? t("sono", "are") : t("è", "is")} ${nomeStato(L[0] || "", c.stato ?? "on")}`; }
    case "valore": return `${nomi(c.entita)} ${t("è", "is")} ${c.verso === "sotto" ? t("sotto", "below") : t("sopra", "above")} ${esc(c.valore ?? "")}${u(c.entita)}`;
  }
  return null;
}
const ALL = () => ({ alarm_arm_away: t("fuori casa", "away"), alarm_arm_home: t("in casa", "home"), alarm_arm_night: t("notte", "night"), alarm_arm_vacation: t("vacanza", "vacation"), alarm_arm_custom_bypass: t("personalizzato", "custom") });
const nomeServizio = s => !s || s === "notify" ? t("a tutti i telefoni", "to all phones") : t("a ", "to ") + `<b>${esc(s.replace(/^mobile_app_/, "📱 ").replace(/_/g, " "))}</b>`;
/** frase di un'azione (all'imperativo) */
export function fraseA(a) {
  if (!a) return null;
  if (a.tipo === "_f") return a.html;
  const L = a.entita, luce = [];
  if (+a.lum) luce.push(alPct(a.lum));
  if (a.colore) luce.push(`${t("di colore", "in")} ${nomeColore(a.colore)} <span class="aufc" style="background:${esc(a.colore)}" aria-hidden="true"></span>`); else if (+a.kelvin) luce.push(`${t("a", "at")} ${+a.kelvin} K`);
  const extra = luce.length ? " " + luce.join(" ") : "";
  const dom = String(E(L)[0] || "").split(".")[0];
  switch (a.tipo) {
    case "on": return `${dom === "cover" || dom === "valve" ? t("apri", "open") : dom === "lock" ? t("apri", "unlock") : dom === "vacuum" ? t("fai partire", "start") : t("accendi", "turn on")} ${nomi(L)}${extra}`;
    case "off": return `${dom === "cover" || dom === "valve" ? t("chiudi", "close") : dom === "lock" ? t("chiudi a chiave", "lock") : dom === "vacuum" ? t("rimanda alla base", "send to base") : t("spegni", "turn off")} ${nomi(L)}`;
    case "toggle": return `${t("commuta", "toggle")} ${nomi(L)}`;
    case "pertempo": return t(`accendi ${nomi(L)}${extra} per ${min(+a.minuti || 2)} e poi spegni`, `turn on ${nomi(L)}${extra} for ${min(+a.minuti || 2)} then turn off`);
    case "tapparella": { const n = Math.round(+a.pos || 0);
      return n === 0 ? `${t("abbassa del tutto", "fully close")} ${nomi(L)}` : n === 100 ? `${t("alza del tutto", "fully open")} ${nomi(L)}` : `${t("porta", "set")} ${nomi(L)} ${t(alPct(n), "to " + n + "%")}`; }
    case "clima": return `${t("imposta", "set")} ${nomi(L)}${a.modo ? " " + t("su", "to") + " " + esc(HVAC()[a.modo] || a.modo) : ""}${num(a.temp) != null ? ` ${t("a", "at")} ${esc(a.temp)}°` : ""}`;
    case "scena": return `${t("attiva", "run")} ${nomi(L)}`;
    case "automazione": return `${t("fai partire l'automazione", "run the automation")} ${nomi(L)}`;
    case "allarme": return a.modo === "alarm_disarm" ? `${t("disinserisci", "disarm")} ${nomi(L)}` : `${t("inserisci", "arm")} ${nomi(L)} (${esc(ALL()[a.modo || "alarm_arm_away"] || a.modo)})`;
    case "notifica": return `${t("manda una notifica", "send a notification")} ${nomeServizio(a.servizio)}${a.messaggio ? `: «${esc(a.messaggio)}»` : ""}${a.apri ? t(" (con «Apri 'Nduja»)", " (with «Open 'Nduja»)") : ""}`;
    case "alexa": return `${a.modo === "tts" ? t("fai dire ad Alexa", "have Alexa say") : t("annuncia con Alexa", "announce with Alexa")} ${t("su", "on")} ${nomi(L)}${a.messaggio ? `: «${esc(a.messaggio)}»` : ""}`;
    case "attendi": return `${t("aspetta", "wait")} ${min(+a.minuti || 5)}`;
  }
  return null;
}
const maiuscola = s => s ? s[0].toLocaleUpperCase() + s.slice(1) : s;
/** la frase intera in HTML: «Quando il sole tramonta, se c'è qualcuno in casa, accendi Luci salotto al 60%.»
    pezzi = { quando, cond, azioni, modo } (anche con null: quelli che non so dire diventano «… e altri N passi avanzati») */
export function frase(m0, pezzi) {
  const m = pezzi ? null : normalizza(m0);
  const Q = (pezzi ? pezzi.quando : m.quando).map(fraseQ), C = (pezzi ? pezzi.cond : m.soloSe.cond).map(fraseC), A = (pezzi ? pezzi.azioni : m.azioni).map(fraseA);
  const modo = pezzi ? pezzi.modo : m.soloSe.modo, avanzati = [...Q, ...C, ...A].filter(x => !x).length;
  const q = Q.filter(Boolean), c = C.filter(Boolean), a = A.filter(Boolean);
  let s = q.length ? q.join(t(" oppure ", " or ")) : t("quando succede qualcosa", "when something happens");
  if (c.length) s += ", " + t("se ", "if ") + c.join(modo === "o" ? t(" oppure se ", " or if ") : t(" e ", " and "));
  s += ", " + (!a.length ? t("fai qualcosa", "do something") : a.length === 1 ? a[0] : a.slice(0, -1).join(", ") + t(" e poi ", " and then ") + a[a.length - 1]);
  s = maiuscola(s).replace(/ e è /g, t(" ed è ", " and it's ")) + ".";
  if (avanzati) s += ` <span class="muted">${t(`… e ${avanzati === 1 ? "un altro passo avanzato" : `altri ${avanzati} passi avanzati`}`, `… and ${avanzati === 1 ? "one more advanced step" : `${avanzati} more advanced steps`}`)}</span>`;
  return s;
}
/** frase in testo semplice (per i lettori di schermo e i titoli) */
export const fraseTesto = (m, p) => frase(m, p).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

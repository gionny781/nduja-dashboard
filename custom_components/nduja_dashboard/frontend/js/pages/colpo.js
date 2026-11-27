/* 👁️ Colpo d'occhio: la vista di ognuno con le cose più importanti per lui, da vedere e comandare al volo.
   Tessere scelte con ＋: qualsiasi entità, i blocchi pronti delle altre pagine (le schede della Home e COLPO di core.js),
   i gruppi («tutte le luci di sopra», «tutte le tapparelle») e le stanze. Un tocco fa l'azione naturale, la pressione lunga
   (o il clic destro) apre i dettagli. In ✏️ Modifica: tocca una tessera per nome, icona e misura, trascinala, ✕ la toglie.
   Ogni persona ha la sua vista: dati della casa (casa.js), sezione «colpo», { [id utente]: { t: [tessere], agg } },
   così la segue su tutti i suoi dispositivi e la cambia anche chi non è amministratore.
   Tessera: { id, k: "e" entità | "b" blocco | "g" gruppo | "a" stanza, x: cosa (entity_id, chiave, "luci|casa", area), d: "s"|"m"|"l", n?, i? } */
import { S, ACT, CHG, UI, AREAS, FLOORS, PAGES, COLPO, VISTE, t, LOC, esc, fnum, nm, ok, attr, unit, W, watts, ago, hhmm, domain, deviceClass, isOn, areaOf,
  areasSorted, roomTemp, roomHum, lightsOn, luci, luciContate, luciComando, isLightSwitch, ents, weatherEnt, card, empty, svc, toast, sicuro, moreInfo,
  openSheet, closeSheet, render, go, page, isAdmin, utenteCfg, visible, ws, HVAC, REG, LAYOUT } from "../core.js";
import { casa, casaCambia, casaErrore } from "../casa.js";
import { TRASCINA, riordina } from "../trascina.js";
import { blocchiHome } from "./home.js";
import { anteprima } from "../video.js";
import { vistaClima } from "../climadisegni.js";
import { info as infoPersona } from "../people.js";

const SEZ = "colpo", MAX = 60, DIM = ["s", "m", "l"];
const io = () => UI.user?.id || "";
const copia = x => JSON.parse(JSON.stringify(x));
const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ================= cosa si può mettere ================= */
/** domini che si possono aggiungere come tessera */
const DOMINI = ["light", "switch", "fan", "input_boolean", "climate", "cover", "lock", "valve", "scene", "script", "button", "input_button", "sensor", "binary_sensor",
  "number", "input_number", "person", "camera", "media_player", "alarm_control_panel", "humidifier", "vacuum", "siren", "automation"];
const FILTRI = () => [["", t("Tutti", "All")], ["luci", "💡 " + t("Luci", "Lights")], ["prese", "🔌 " + t("Interruttori", "Switches")], ["clima", "🌡️ " + t("Clima", "Climate")],
  ["tapp", "🪟 " + t("Tapparelle e cancelli", "Covers and gates")], ["serr", "🔒 " + t("Serrature", "Locks")], ["scene", "🎬 " + t("Scene, script e automazioni", "Scenes, scripts and automations")],
  ["sens", "📈 " + t("Sensori", "Sensors")], ["pers", "👤 " + t("Persone", "People")], ["cam", "📷 " + t("Telecamere", "Cameras")], ["media", "📺 Media"], ["altro", "• " + t("Altro", "Other")]];
function gruppoDom(id) {
  const d = domain(id);
  if (d === "light" || isLightSwitch(id)) return "luci";
  return { switch: "prese", input_boolean: "prese", fan: "prese", climate: "clima", humidifier: "clima", cover: "tapp", valve: "tapp", lock: "serr", scene: "scene", script: "scene", automation: "scene",
    button: "scene", input_button: "scene", sensor: "sens", binary_sensor: "sens", number: "sens", input_number: "sens", person: "pers", camera: "cam", media_player: "media" }[d] || "altro";
}
const aggiungibile = id => DOMINI.includes(domain(id)) && !REG[id]?.hidden;

/* icone di partenza */
const ICO_DOM = { switch: "🔌", fan: "🌀", input_boolean: "🔘", climate: "🌡️", cover: "🪟", lock: "🔒", valve: "🚰", scene: "🎬", script: "▶️", button: "⏺", input_button: "⏺",
  sensor: "📈", binary_sensor: "🔘", number: "🔢", input_number: "🔢", person: "👤", camera: "📷", media_player: "📺", alarm_control_panel: "🛡️", humidifier: "💧", vacuum: "🤖", siren: "🚨", automation: "🔁" };
const ICO_DC = { temperature: "🌡️", humidity: "💧", power: "⚡", energy: "⚡", battery: "🔋", illuminance: "☀️", carbon_dioxide: "🫧", pm25: "🌫️", pm10: "🌫️", gas: "🔥",
  water: "🚰", pressure: "🧭", wind_speed: "💨", precipitation: "🌧️", voltage: "⚡", current: "⚡", monetary: "💶", duration: "⏱️", timestamp: "🕒",
  door: "🚪", window: "🪟", garage_door: "🚗", opening: "🚪", motion: "🏃", occupancy: "👤", presence: "👤", moisture: "💧", smoke: "🔥", carbon_monoxide: "☠️",
  connectivity: "📶", plug: "🔌", problem: "⚠️", safety: "⚠️", tamper: "🛠️", vibration: "📳", sound: "🔊", gate: "🚧", garage: "🚗", door_cover: "🚪", outlet: "🔌" };
const VARCO = ["gate", "garage", "door"];   // tapparelle che sono cancelli, garage o porte: si aprono solo con due tocchi
const varco = id => domain(id) === "cover" && VARCO.includes(deviceClass(id));
function iconaEnt(id) {
  const d = domain(id), dc = deviceClass(id);
  if (d === "lock") return S[id]?.state === "locked" ? "🔒" : "🔓";
  if (d === "cover" && dc && ICO_DC[dc === "door" ? "door_cover" : dc]) return ICO_DC[dc === "door" ? "door_cover" : dc];
  if ((d === "sensor" || d === "binary_sensor" || d === "switch") && ICO_DC[dc]) return ICO_DC[dc];
  return ICO_DOM[d] || "•";
}
function iconaStanza(a) {
  const n = (AREAS[a]?.name || a).toLowerCase();
  return /cucin|kitchen/.test(n) ? "🍳" : /soggiorn|salott|living|lounge/.test(n) ? "🛋️" : /camer|letto|bed/.test(n) ? "🛏️" : /bagn|bath|wc/.test(n) ? "🛁"
    : /studi|uffic|office|study/.test(n) ? "💻" : /garage|box/.test(n) ? "🚗" : /giardin|garden|terrazz|balcon|patio|cortil/.test(n) ? "🌳"
    : /lavander|laundry/.test(n) ? "🧺" : /corridoi|ingress|hall|entrat/.test(n) ? "🚪" : /cantin|cellar|soffitt|attic/.test(n) ? "📦" : "🏠";
}

/* ---------- blocchi pronti: le schede della Home e quelli registrati dalle pagine (COLPO) ---------- */
const ICO_HOME = { riepilogo: "🕒", momenti: "✨", meteo: "🌤️", stanze: "🏠", avvisi: "🔔", persone: "👥", raccolta: "♻️", agenda: "📅", musica: "🎵", accessi: "🚪" };
const PAG_HOME = { meteo: "meteo", agenda: "calendario", raccolta: "calendario", musica: "musica", stanze: "mappa", persone: "mappa", accessi: "sicurezza" };
/** blocchi che questa persona può vedere: { chiave: { titolo, icona, render(dim), pagina, desc } } */
let BL = null;   // un disegno chiede i blocchi più volte: li calcolo una volta sola (per 200 ms)
function blocchi() {
  if (BL && performance.now() - BL.t < 200) return BL.v;
  const out = {}, uc = utenteCfg(), viaH = new Set(uc.homeHidden || []);
  for (const [k, titolo, r] of blocchiHome()) {
    if (viaH.has(k) || !r) continue;
    out[k] = { titolo, icona: ICO_HOME[k] || PAGES[k]?.icon || "▦", render: () => r(), pagina: PAG_HOME[k] || (PAGES[k] ? k : null) };
  }
  for (const [k, b] of Object.entries(COLPO)) {
    try { if (b.show && !b.show()) continue; } catch { continue; }
    if (b.pagina && (uc.pages?.[b.pagina] === false || LAYOUT.pages?.[b.pagina] === false)) continue;
    out["x_" + k] = { titolo: b.title(), icona: b.icon || "▦", render: dim => b.render(dim), pagina: b.pagina || null };
  }
  BL = { t: performance.now(), v: out };
  return out;
}

/* ---------- gruppi: tutte le luci o tutte le tapparelle della casa, di un piano o di una stanza ---------- */
const TIPI_G = () => ({ luci: ["💡", t("Luci", "Lights")], tapp: ["🪟", t("Tapparelle", "Covers")] });
const tapparelle = () => (VISTE.tapTutte?.() || ents("cover")).filter(id => S[id] && !varco(id));   // mai cancelli e garage insieme alle tapparelle
function membri(x) {
  const [tipo, dove = "casa"] = String(x).split("|"), L = tipo === "luci" ? luciContate() : tipo === "tapp" ? tapparelle() : [];
  if (dove === "casa") return L;
  if (dove.startsWith("f:")) return L.filter(id => AREAS[areaOf(id)]?.floor === dove.slice(2));
  if (dove.startsWith("a:")) return L.filter(id => areaOf(id) === dove.slice(2));
  return [];
}
function nomeDove(dove) {
  if (!dove || dove === "casa") return t("tutta la casa", "whole home");
  if (dove.startsWith("f:")) return FLOORS[dove.slice(2)]?.name || t("piano", "floor");
  return AREAS[dove.slice(2)]?.name || t("stanza", "room");
}
function nomeGruppo(x) {
  const [tipo, dove] = String(x).split("|");
  if (!dove || dove === "casa") return tipo === "luci" ? t("Tutte le luci", "All lights") : t("Tutte le tapparelle", "All covers");
  return (TIPI_G()[tipo]?.[1] || tipo) + " · " + nomeDove(dove);
}
const aperta = id => ["open", "opening"].includes(S[id]?.state) || (+attr(id, "current_position") > 0 && S[id]?.state !== "closed");
const accesiG = x => { const tipo = String(x).split("|")[0], M = membri(x); return tipo === "luci" ? M.filter(id => S[id]?.state === "on") : M.filter(aperta); };
/** i posti per cui ha senso un gruppo: la casa, i piani con almeno 2 elementi, le stanze con almeno 2 */
function postiGruppo(tipo) {
  const out = [["casa", membri(tipo + "|casa").length]];
  Object.keys(FLOORS).sort((a, b) => (FLOORS[a].level ?? 0) - (FLOORS[b].level ?? 0)).forEach(f => { const n = membri(tipo + "|f:" + f).length; if (n >= 2) out.push(["f:" + f, n]); });
  areasSorted().forEach(a => { const n = membri(tipo + "|a:" + a).length; if (n >= 2) out.push(["a:" + a, n]); });
  return out.filter(([, n]) => n > 0);
}

/* ================= la vista di questa persona ================= */
const sez = () => casa(SEZ);
const valida = T => T && typeof T.id === "string" && ["e", "b", "g", "a"].includes(T.k) && typeof T.x === "string";
const mia = () => { const v = sez()?.stato === "ok" && io() ? sez().dati?.[io()] : null; return v && Array.isArray(v.t) ? v : null; };
/** stanze principali per la proposta: quelle con la temperatura e più cose dentro (al massimo 4), nell'ordine della casa */
function principali() {
  const A = areasSorted().filter(a => roomTemp(a) != null), n = a => Object.keys(S).filter(id => areaOf(id) === a).length;
  const top = new Set([...A].sort((x, y) => n(y) - n(x)).slice(0, 4));
  return A.filter(a => top.has(a));
}
/** proposta automatica per chi non ha ancora fatto la sua vista */
function proposta() {
  const L = [], add = (k, x, d) => L.push({ id: "p_" + k + "_" + x.replace(/[^a-z0-9]/gi, "_"), k, x, d });
  if (weatherEnt()) add("b", "meteo", "s");
  if (ents("calendar").length) add("b", "agenda", "s");
  if (luciContate().length) add("g", "luci|casa", "m");
  principali().forEach(a => add("a", a, "s"));
  ents("person").slice(0, 4).forEach(p => add("e", p, "s"));
  ents("alarm_control_panel").slice(0, 1).forEach(a => add("e", a, "s"));
  return L;
}
const salvata = () => !!mia();
/** le tessere da mostrare: quelle scelte, altrimenti la proposta */
const tessere = () => (mia()?.t || proposta()).filter(valida).map(T => ({ ...T, d: DIM.includes(T.d) ? T.d : "s" }));
/** salva la vista (se non c'era parte dalla proposta). fn(v) cambia v.t; false = niente da salvare */
function salvaMia(fn, msg) {
  const u = io(); if (!u) { toast(t("Non so chi sei: riapri la plancia", "I don't know who you are: reopen the dashboard"), true); return Promise.resolve(false); }
  return casaCambia(SEZ, d => {
    const v = d[u] && Array.isArray(d[u].t) ? d[u] : { t: proposta() };
    if (fn(v) === false) return false;
    v.t = v.t.filter(valida).slice(0, MAX); v.agg = new Date().toISOString(); d[u] = v;
  }, msg);
}
const trova = k => tessere().find(T => T.id === k);

/* ================= disegno delle tessere ================= */
function nomeT(T) {
  if (T.n) return T.n;
  if (T.k === "e") return S[T.x] ? nm(T.x) : T.x;
  if (T.k === "b") return blocchi()[T.x]?.titolo || T.x;
  if (T.k === "g") return nomeGruppo(T.x);
  return AREAS[T.x]?.name || T.x;
}
/** numero e unità di un sensore */
function valore(id) {
  if (!ok(id)) return { v: "—", u: "" };
  const s = String(S[id].state), dc = deviceClass(id);
  if (dc === "timestamp") { const d = new Date(s); if (isNaN(d)) return { v: s, u: "", txt: true };
    return { v: Math.abs(Date.now() - d) < 864e5 ? hhmm(d) : d.toLocaleDateString(LOC, { day: "numeric", month: "short" }), u: "", txt: true }; }
  if (/^-?\d+([.,]\d+)?(e[-+]?\d+)?$/i.test(s.trim())) {
    if (dc === "power" && /^k?w$/i.test(unit(id))) { const [v, u] = watts(W(id)).split(" "); return { v, u }; }
    const n = parseFloat(s), dec = Number.isInteger(n) || Math.abs(n) >= 100 ? 0 : 1;
    return { v: fnum(n, dec), u: unit(id) };
  }
  return { v: s, u: "", txt: true };
}
const BIN = () => ({ door: [t("aperta", "open"), t("chiusa", "closed")], window: [t("aperta", "open"), t("chiusa", "closed")], garage_door: [t("aperto", "open"), t("chiuso", "closed")],
  opening: [t("aperto", "open"), t("chiuso", "closed")], motion: [t("movimento", "motion"), t("tutto fermo", "clear")], occupancy: [t("occupato", "occupied"), t("libero", "clear")],
  presence: [t("qualcuno c'è", "present"), t("nessuno", "away")], moisture: [t("acqua!", "wet!"), t("asciutto", "dry")], smoke: [t("fumo!", "smoke!"), t("tutto ok", "clear")],
  gas: [t("gas!", "gas!"), t("tutto ok", "clear")], carbon_monoxide: [t("monossido!", "CO!"), t("tutto ok", "clear")], problem: [t("problema", "problem"), t("tutto ok", "ok")],
  safety: [t("pericolo", "unsafe"), t("tutto ok", "safe")], tamper: [t("manomesso", "tampered"), t("tutto ok", "ok")], connectivity: [t("collegato", "connected"), t("scollegato", "disconnected")],
  plug: [t("collegato", "plugged in"), t("scollegato", "unplugged")], battery: [t("scarica", "low"), t("carica", "ok")], lock: [t("aperta", "unlocked"), t("chiusa", "locked")],
  running: [t("in funzione", "running"), t("fermo", "idle")], power: [t("acceso", "on"), t("spento", "off")], vibration: [t("vibra", "vibration"), t("fermo", "clear")],
  sound: [t("rumore", "sound"), t("silenzio", "quiet")], heat: [t("caldo!", "hot!"), t("tutto ok", "normal")], cold: [t("freddo!", "cold!"), t("tutto ok", "normal")] });
const BIN_ALL = ["moisture", "smoke", "gas", "carbon_monoxide", "problem", "safety", "tamper", "heat", "cold", "battery"];
const ALL = () => ({ disarmed: t("Disinserito", "Disarmed"), armed_home: t("Inserito in casa", "Armed home"), armed_away: t("Inserito fuori casa", "Armed away"),
  armed_night: t("Inserito notte", "Armed night"), armed_vacation: t("Inserito vacanza", "Armed vacation"), armed_custom_bypass: t("Inserito", "Armed"),
  arming: t("Si inserisce…", "Arming…"), pending: t("In attesa…", "Pending…"), triggered: t("ALLARME!", "TRIGGERED!") });
const COVER = () => ({ open: t("aperta", "open"), closed: t("chiusa", "closed"), opening: t("si apre", "opening"), closing: t("si chiude", "closing") });

/** contenuto di una tessera di un'entità: { cls, ico, v, u, txt, sub, ctl } */
function contenuto(id, T) {
  const s = S[id], d = domain(id), a = s.attributes, un = !ok(id), on = isOn(id);
  const r = { cls: "", ico: iconaEnt(id), v: "", u: "", txt: true, sub: "", ctl: "" };
  if (un) { r.cls = "dis"; r.sub = t("non raggiungibile", "unavailable"); return r; }
  if (["switch", "fan", "input_boolean", "humidifier", "siren", "valve"].includes(d)) {
    r.cls = on ? "on" : ""; r.v = d === "valve" ? (on ? t("Aperta", "Open") : t("Chiusa", "Closed")) : on ? t("Acceso", "On") : t("Spento", "Off");
    if (d === "switch" && REG[id]?.device) { const p = Object.keys(S).find(x => x.startsWith("sensor.") && REG[x]?.device === REG[id].device && deviceClass(x) === "power");   // presa con il consumo
      if (p && on && W(p) != null) r.sub = "⚡ " + watts(W(p)); }
    if (d === "fan" && on && a.percentage != null) r.sub = Math.round(a.percentage) + "%";
  } else if (d === "climate") {
    const m = s.state, act = m !== "off", mode = (HVAC()[m] || m);
    r.cls = act ? (["cool", "dry"].includes(m) ? "cool" : m === "fan_only" ? "on" : "heat") : "";
    r.ico = vistaClima(id, "xs") || "🌡️"; r.icoHtml = true;
    if (a.current_temperature != null) { r.v = fnum(a.current_temperature); r.u = "°"; r.txt = false; } else r.v = mode;
    r.sub = mode + (act && a.temperature != null ? " · " + t("vuole ", "set ") + fnum(a.temperature, (a.target_temp_step || .5) >= 1 ? 0 : 1) + "°" : "");
    if (T.d !== "s" && a.temperature != null) r.ctl = `<button class="step" data-act="cstep" data-id="${id}" data-d="-1" aria-label="−">−</button><span class="vq1tg">${fnum(a.temperature, (a.target_temp_step || .5) >= 1 ? 0 : 1)}°</span><button class="step" data-act="cstep" data-id="${id}" data-d="1" aria-label="+">+</button>`;
  } else if (d === "cover") {
    const pos = a.current_position, ap = aperta(id);
    r.cls = ap ? "on" : ""; const m = VISTE.tapMini?.(id); if (m) { r.ico = m; r.icoHtml = true; }
    if (pos != null) { r.v = String(Math.round(pos)); r.u = "%"; r.txt = false; }
    const st = COVER()[s.state] || s.state; if (pos != null) r.sub = st; else r.v = st[0].toUpperCase() + st.slice(1);
    if (varco(id) && !ap) r.sub = t("due tocchi per aprire", "tap twice to open");
    if (T.d !== "s") r.ctl = `<button class="btn sm" data-act="cover" data-v="open_cover" data-id="${id}" aria-label="${t("Apri", "Open")}">▲</button><button class="btn sm" data-act="cover" data-v="stop_cover" data-id="${id}" aria-label="Stop">■</button><button class="btn sm" data-act="cover" data-v="close_cover" data-id="${id}" aria-label="${t("Chiudi", "Close")}">▼</button>`;
  } else if (d === "lock") {
    const L = s.state === "locked"; r.cls = L ? "" : "on"; r.v = L ? t("Chiusa", "Locked") : s.state === "unlocked" ? t("Aperta", "Unlocked") : s.state;
    r.sub = L ? t("tocca per aprire", "tap to unlock") : t("tocca per chiudere", "tap to lock");
  } else if (d === "automation") {
    /* automazione (0.7.64): interruttore; in pausa dice fino a quando (pages/automazioni.js) */
    const pz = VISTE.autoPausa?.(id), acc = s.state === "on" && !pz;
    r.cls = acc ? "on" : ""; r.v = pz ? t("In pausa", "Paused") : acc ? t("Accesa", "On") : t("Spenta", "Off"); r.txt = true;
    r.sub = pz ? t("fino a ", "until ") + hhmm(pz) : a.last_triggered ? t("ultima volta ", "last ran ") + ago(a.last_triggered) : t("mai partita", "never ran");
    if (T.d !== "s") r.ctl = `<span class="sw ${acc ? "on" : ""}" aria-hidden="true"><i></i></span>`;
  } else if (d === "scene" || d === "script" || d === "button" || d === "input_button") {
    r.cls = d === "script" && s.state === "on" ? "on" : ""; r.sub = d === "script" && s.state === "on" ? t("in corso…", "running…") : d === "scene" ? t("tocca per attivarla", "tap to activate") : t("tocca per avviarlo", "tap to run");
  } else if (d === "sensor" || d === "number" || d === "input_number") {
    const x = valore(id); Object.assign(r, { v: x.v, u: x.u, txt: !!x.txt }); r.sub = AREAS[areaOf(id)]?.name || "";
    if (deviceClass(id) === "battery" && +s.state < 20) r.cls = "al";
  } else if (d === "binary_sensor") {
    const dc = deviceClass(id), B = BIN()[dc] || [t("attivo", "on"), t("a riposo", "off")];
    r.v = on ? B[0] : B[1]; r.cls = on ? (BIN_ALL.includes(dc) ? "al" : "on") : ""; r.sub = ago(s.last_changed);
  } else if (d === "person") {
    const i = infoPersona(id); r.foto = i.foto; r.v = i.zona; r.cls = i.casa ? "on casa" : ""; r.sub = t("da ", "for ") + ago(i.da).replace(t(" fa", " ago"), "");
  } else if (d === "media_player") {
    const pl = s.state === "playing", pa = s.state === "paused";
    r.cls = pl ? "on" : ""; r.foto = (pl || pa) && a.entity_picture ? a.entity_picture : null;
    r.v = (pl || pa) ? (a.media_title || t("in riproduzione", "playing")) : s.state === "off" ? t("spento", "off") : s.state === "idle" || s.state === "on" ? t("acceso", "on") : s.state;
    r.sub = (pl || pa) ? [a.media_artist, a.app_name].filter(Boolean).join(" · ") || (pa ? t("in pausa", "paused") : "") : "";
    if (T.d !== "s" && (pl || pa)) r.ctl = `<button class="btn sm" data-act="cdMp" data-id="${id}" data-v="media_previous_track" aria-label="${t("Precedente", "Previous")}">⏮</button><button class="btn sm" data-act="cdMp" data-id="${id}" data-v="media_play_pause" aria-label="${pl ? "Pausa" : "Play"}">${pl ? "⏸" : "▶"}</button><button class="btn sm" data-act="cdMp" data-id="${id}" data-v="media_next_track" aria-label="${t("Successivo", "Next")}">⏭</button>`;
  } else if (d === "alarm_control_panel") {
    r.v = ALL()[s.state] || s.state; r.cls = s.state === "triggered" ? "al" : s.state === "disarmed" ? "" : "on";
    r.sub = s.state === "disarmed" ? t("tocca per inserirlo", "tap to arm") : t("tocca per i comandi", "tap for controls");
  } else if (d === "vacuum") {
    r.v = { cleaning: t("pulisce", "cleaning"), docked: t("alla base", "docked"), returning: t("torna alla base", "returning"), paused: t("in pausa", "paused"), idle: t("fermo", "idle"), error: t("errore", "error") }[s.state] || s.state;
    r.cls = s.state === "cleaning" ? "on" : s.state === "error" ? "al" : ""; if (a.battery_level != null) r.sub = "🔋 " + Math.round(a.battery_level) + "%";
  } else { r.v = s.state; }
  return r;
}
/** la parte che si vede di una tessera (ico, nome, valore, sotto, comandi) */
function corpo({ ico, icoHtml, foto, nome, v, u, txt, sub, ctl }) {
  const icona = foto ? `<span class="vq1i ft" style="background-image:url('${esc(foto)}')"></span>` : `<span class="vq1i">${icoHtml ? ico : esc(ico)}</span>`;
  if (txt && typeof v === "string" && v) v = v[0].toLocaleUpperCase(LOC) + v.slice(1);   // «Tutto ok», «Alla base»
  return `<span class="vq1h">${icona}<span class="vq1n">${esc(nome)}</span></span>
    <span class="vq1f"><span class="vq1x">${v !== "" && v != null ? `<span class="vq1v ${txt ? "txt" : ""}">${esc(v)}${u ? `<small>${esc(u)}</small>` : ""}</span>` : ""}${sub ? `<span class="vq1s">${esc(sub)}</span>` : ""}</span>${ctl ? `<span class="vq1c">${ctl}</span>` : ""}</span>`;
}
/** pulsanti di ✏️ Modifica sopra la tessera */
const attrezzi = T => UI.edit ? `<span class="edb vq1e"><button data-act="cdEd" data-k="${esc(T.id)}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="cdDel" data-k="${esc(T.id)}" aria-label="${t("Togli", "Remove")}">✕</button></span>` : "";
/** custodia della tessera: misura, trascinamento, tocco (fuori modifica) o ✏️ (in modifica), pressione lunga */
function cella(T, tipo, dentro, cls = "") {
  const e = UI.edit, nome = nomeT(T);
  return `<div class="vq1 d-${T.d} k-${tipo} ${e ? "ed" : ""} ${cls}" data-tri="${esc(T.id)}" ${e ? `data-act="cdEd" data-k="${esc(T.id)}" role="button" tabindex="0" aria-label="${esc(t("Modifica: ", "Edit: ") + nome)}"` : `data-cdl="${esc(T.id)}"`}>${dentro}${attrezzi(T)}</div>`;
}
const tessuto = (T, r, nome) => `<div class="vq1t ${r.cls}" ${UI.edit ? "" : `data-act="cdTap" data-k="${esc(T.id)}" role="button" tabindex="0"`} aria-label="${esc(nome + (r.v ? ": " + r.v + (r.u || "") : "") + (r.sub ? ", " + r.sub : ""))}">${corpo({ ...r, nome })}</div>`;

function tesseraEnt(T) {
  const id = T.x;
  if (!S[id]) return UI.edit ? cella(T, "x", `<div class="vq1t dis">${corpo({ ico: "❔", nome: nomeT(T), v: t("non c'è più", "gone"), txt: true, sub: id })}</div>`) : "";
  const d = domain(id), nome = nomeT(T);
  if ((d === "light" || isLightSwitch(id)) && VISTE.luce) {
    let h = VISTE.luce(id, nome);
    if (T.i) h = h.replace(/<span class="lt2i">[\s\S]*?<\/span>/, `<span class="lt2i vq1le">${esc(T.i)}</span>`);
    return cella(T, "luce", h);
  }
  if (d === "camera") return cella(T, "cam", `<div class="cm1 ${ok(id) ? "" : "dis"}">${anteprima(id)}</div>`);
  const r = contenuto(id, T); if (T.i) { r.ico = T.i; r.icoHtml = false; }
  return cella(T, d === "person" ? "pers" : d === "media_player" ? "media" : "ent", tessuto(T, r, nome));
}
function tesseraGruppo(T) {
  const tipo = T.x.split("|")[0], M = membri(T.x), A = accesiG(T.x), nome = nomeT(T);
  const r = { cls: A.length ? "on" : "", ico: T.i || TIPI_G()[tipo]?.[0] || "▦", v: M.length ? String(A.length) : "—", u: M.length ? "/" + M.length : "", txt: false,
    sub: !M.length ? t("niente qui", "nothing here") : tipo === "luci" ? (A.length ? t(A.length === 1 ? "accesa · tocca per spegnere" : "accese · tocca per spegnerle", "on · tap to turn off") : t("tutte spente", "all off"))
      : (A.length ? t(A.length === 1 ? "aperta · tocca per chiudere" : "aperte · tocca per chiuderle", "open · tap to close") : t("tutte chiuse", "all closed")) };
  if (!M.length) r.cls = "dis";
  return cella(T, "grp", tessuto(T, r, nome));
}
function tesseraStanza(T) {
  const a = T.x; if (!AREAS[a]) return UI.edit ? cella(T, "x", `<div class="vq1t dis">${corpo({ ico: "❔", nome: nomeT(T), v: t("non c'è più", "gone"), txt: true })}</div>`) : "";
  const Tm = roomTemp(a), H = roomHum(a), L = lightsOn(a).length, nL = luci(a).length, nome = nomeT(T);
  const r = { cls: L ? "on" : "", ico: T.i || iconaStanza(a), v: Tm != null ? fnum(Tm) : "", u: Tm != null ? "°" : "", txt: false,
    sub: [H != null ? "💧 " + Math.round(H) + "%" : "", nL ? "💡 " + (L ? L + " " + t(L === 1 ? "accesa" : "accese", "on") : t("spente", "off")) : ""].filter(Boolean).join(" · ") };
  if (Tm == null) { r.v = AREAS[a].name; r.txt = true; }
  return cella(T, "room", tessuto(T, r, nome));
}
function tesseraBlocco(T) {
  const B = blocchi()[T.x];
  if (!B) return UI.edit ? cella(T, "b", card(`❔ ${esc(nomeT(T))}`, empty(t("Questo blocco non c'è più (la pagina è spenta o manca il dispositivo).", "This block is gone (the page is off or the device is missing)."))), "b") : "";
  let h = "", e = UI.edit; UI.edit = false;   // i disegni delle altre pagine senza i loro pulsanti di modifica
  try { h = B.render(T.d) || ""; } catch (err) { console.error("colpo", T.x, err); } finally { UI.edit = e; }
  if (!h.trim()) h = card(`${esc(B.icona)} ${esc(B.titolo)}`, empty(t("Niente da mostrare adesso.", "Nothing to show right now.")));
  if (T.n || T.i) h = h.replace(/(<div class="ch"><h2>)[\s\S]*?(<\/h2>)/, (_, a, b) => `${a}${esc(T.i || B.icona)} ${esc(T.n || B.titolo)}${b}`);
  return cella(T, "b", `<div class="vq1bx">${h}</div>`, "b");
}
const disegna = T => T.k === "e" ? tesseraEnt(T) : T.k === "g" ? tesseraGruppo(T) : T.k === "a" ? tesseraStanza(T) : tesseraBlocco(T);

/* ================= pagina ================= */
function avviso() {
  const s = sez();
  if (!io()) return `<section class="card vq1m"><div class="note1">${t("Non so chi sta usando la plancia: la vista che vedi è la proposta automatica e non si può salvare.", "I don't know who is using the dashboard: this is the automatic suggestion and it can't be saved.")}</div></section>`;
  if (s?.stato === "errore") return `<section class="card vq1m"><div class="note1">${casaErrore(SEZ) === "riavvia"
    ? t("Per salvare la tua vista riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha cambiato anche la parte che salva i dati. Intanto vedi la proposta automatica.", "To save your view restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update also changed the part that stores the data. Meanwhile you see the automatic suggestion.")
    : t("Non riesco a leggere la tua vista da Home Assistant: intanto vedi la proposta automatica. Riprova tra poco.", "I can't read your view from Home Assistant: meanwhile you see the automatic suggestion. Try again shortly.")}</div></section>`;
  if (s?.stato === "ok" && !salvata()) return `<section class="card vq1m vq1pr"><div class="vq1pri" aria-hidden="true">✨</div><div class="vq1prt"><b>${t("Ti ho preparato una proposta", "Here's a suggestion for you")}</b>
      <span class="small muted">${t("Le luci, il meteo, le stanze principali, chi è in casa e il prossimo impegno. È solo tua: la vedi su tutti i tuoi dispositivi e la cambi quando vuoi.", "Lights, weather, the main rooms, who's home and what's next. It's yours only: you see it on all your devices and change it whenever you like.")}</span></div>
      <div class="vq1prb"><button class="btn pri" data-act="cdOk">👍 ${t("Va bene così", "Looks good")}</button><button class="btn" data-act="cdIo">✏️ ${t("Scelgo io", "I'll choose")}</button></div></section>`;
  return "";
}
function barraModifica() {
  if (!UI.edit) return "";
  const n = UI.user?.name ? esc(UI.user.name.split(" ")[0]) : "";
  return `<section class="card vq1m vq1bar"><div class="vq1prt"><b>✏️ ${t("La tua vista", "Your view")}${n ? ` · ${n}` : ""}</b>
      <span class="small muted">${t("Tocca una tessera per nome, icona e misura; trascinala per spostarla (col dito tieni premuto un attimo); ✕ la toglie. Vale solo per te, su tutti i tuoi dispositivi.", "Tap a tile for name, icon and size; drag it to move it (with a finger, press and hold a moment); ✕ removes it. It's only for you, on all your devices.")}</span></div>
    <div class="vq1prb"><button class="btn pri" data-act="cdAdd">＋ ${t("Aggiungi", "Add")}</button><button class="btn" data-act="cdProp">✨ ${t("Proposta automatica", "Automatic suggestion")}</button>${isAdmin() ? `<button class="btn" data-act="cdCopia">📋 ${t("Copia a…", "Copy to…")}</button>` : ""}</div></section>`;
}
function pagina() {
  const s = sez();
  if (io() && s?.stato === "caricando") return `<div class="vq1w"><section class="card vq1m"><div class="small muted">${t("Carico la tua vista…", "Loading your view…")}</div></section></div>`;
  const T = tessere(), corpoG = T.map(disegna).join("");
  const vuota = !corpoG && !UI.edit;
  return `<div class="vq1w">${avviso()}${barraModifica()}
    ${vuota ? `<section class="card vq1m vq1z"><div class="vq1zi" aria-hidden="true">👁️</div><b>${t("La tua vista è vuota", "Your view is empty")}</b>
      <span class="small muted">${t("Mettici le cose che guardi e usi di più: una luce, il termostato, il cancello, il meteo, la lista della spesa…", "Put here what you look at and use the most: a light, the thermostat, the gate, the weather, the shopping list…")}</span>
      <div class="vq1prb"><button class="btn pri" data-act="cdIo">＋ ${t("Aggiungi", "Add")}</button><button class="btn" data-act="cdProp">✨ ${t("Proposta automatica", "Automatic suggestion")}</button></div></section>`
      : `<div class="vq1g" data-tr="colpo">${corpoG}${UI.edit && io() && T.length < MAX ? `<button class="add1 vq1a" data-act="cdAdd" data-trfine><span>＋</span>${t("Aggiungi", "Add")}</button>` : ""}</div>`}</div>`;
}
page("colpo", { title: t("Colpo d'occhio", "At a glance"), short: t("Colpo", "Glance"), icon: "👁️", order: 1, editable: true, editTutti: true, render: pagina });

/* ================= azioni ================= */
function tocco(el) {
  const T = trova(el.dataset.k); if (!T) return;
  if (T.k === "g") {
    const tipo = T.x.split("|")[0], M = membri(T.x), A = accesiG(T.x); if (!M.length) return;
    if (tipo === "luci") return luciComando(A.length ? A : M, !A.length).then(() => toast((A.length ? "💡 " + t("Spente: ", "Off: ") : "💡 " + t("Accese: ", "On: ")) + (A.length || M.length))).catch(() => {});
    return svc("cover", A.length ? "close_cover" : "open_cover", {}, { entity_id: M }).then(() => toast("🪟 " + (A.length ? t("Chiudo: ", "Closing: ") : t("Apro: ", "Opening: ")) + M.length)).catch(() => {});
  }
  if (T.k === "a") return ACT.room({ dataset: { id: T.x } });
  if (T.k !== "e" || !S[T.x] || !ok(T.x)) return T.k === "e" && S[T.x] ? moreInfo(T.x) : undefined;
  const id = T.x, d = domain(id), s = S[id].state, tg = { entity_id: id };
  if (d === "lock") { if (s === "locked") { if (sicuro(el, t("Tocca ancora per aprire", "Tap again to unlock"))) svc("lock", "unlock", {}, tg); } else svc("lock", "lock", {}, tg); return; }
  if (d === "cover") { if (varco(id) && !aperta(id)) { if (sicuro(el, t("Tocca ancora per aprire", "Tap again to open"))) svc("cover", "open_cover", {}, tg); } else svc("cover", "toggle", {}, tg); return; }
  if (d === "siren") { if (s !== "on") { if (sicuro(el, t("Tocca ancora: suona", "Tap again: it sounds"))) svc("siren", "turn_on", {}, tg); } else svc("siren", "turn_off", {}, tg); return; }
  if (["switch", "fan", "input_boolean", "humidifier", "valve"].includes(d)) return svc(d, "toggle", {}, tg);
  if (d === "scene" || d === "script") return svc(d, "turn_on", {}, tg).then(() => toast((d === "scene" ? "🎬 " : "▶️ ") + nomeT(T)));
  if (d === "button" || d === "input_button") return svc(d, "press", {}, tg).then(() => toast("⏺ " + nomeT(T)));
  if (d === "climate") return svc("climate", s === "off" ? "turn_on" : "turn_off", {}, tg);
  if (d === "automation") return VISTE.autoTocca ? VISTE.autoTocca(id) : svc("automation", s === "on" ? "turn_off" : "turn_on", {}, tg);
  if (d === "media_player") return svc("media_player", ["playing", "paused"].includes(s) ? "media_play_pause" : "toggle", {}, tg);
  if (d === "alarm_control_panel" && COLPO.allarme) return openSheet(() => `<div class="sh-head"><div><h3>🛡️ ${esc(t("Allarme", "Alarm"))}</h3></div><button class="x" data-act="sheetClose">×</button></div><div class="stack">${COLPO.allarme.render()}</div>`);
  if (d === "vacuum") return svc("vacuum", s === "cleaning" ? "return_to_base" : "start", {}, tg);
  moreInfo(id);
}
/** pressione lunga (o clic destro): i dettagli */
function dettagli(k) {
  const T = trova(k); if (!T) return;
  if (T.k === "e") { if (!S[T.x]) return; return domain(T.x) === "light" || isLightSwitch(T.x) ? ACT.luDet?.({ dataset: { id: T.x } }) : moreInfo(T.x); }
  if (T.k === "a") return ACT.room({ dataset: { id: T.x } });
  if (T.k === "g") return openSheet(() => foglioGruppo(T.x));
  const B = blocchi()[T.x];
  if (B?.pagina && visible().includes(B.pagina)) return go(B.pagina);
  toast(t("Questo blocco non ha una pagina da aprire", "This block has no page to open"));
}
function foglioGruppo(x) {
  const tipo = x.split("|")[0], M = membri(x), A = accesiG(x);
  const tutti = tipo === "luci" ? `<button class="btn sm" data-act="cdGr" data-x="${esc(x)}" data-v="${A.length ? 0 : 1}">${A.length ? "💡 " + t("Spegni tutte", "Turn all off") : "💡 " + t("Accendi tutte", "Turn all on")}</button>`
    : `<button class="btn sm" data-act="cdGr" data-x="${esc(x)}" data-v="1">▲ ${t("Apri tutte", "Open all")}</button><button class="btn sm" data-act="cdGr" data-x="${esc(x)}" data-v="0">▼ ${t("Chiudi tutte", "Close all")}</button>`;
  return `<div class="sh-head"><div><h3>${TIPI_G()[tipo]?.[0] || ""} ${esc(nomeGruppo(x))}</h3><div class="small muted">${M.length} · ${tipo === "luci" ? A.length + " " + t("accese", "on") : A.length + " " + t("aperte", "open")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">${M.length ? tutti : ""}</div>
    ${!M.length ? empty(t("Qui non c'è niente.", "Nothing here.")) : tipo === "luci" ? `<div class="tiles">${M.map(id => VISTE.luce ? VISTE.luce(id) : "").join("")}</div>` : `<div class="stack">${M.map(id => VISTE.tapRiga?.(id) || "").join("")}</div>`}`;
}

/* ---------- pressione lunga ---------- */
let LP = null, mangiaClic = 0;
const fineLP = () => { if (LP) { clearTimeout(LP.t); LP.el.classList.remove("vq1p"); } LP = null; };
document.addEventListener("pointerdown", e => {
  if (UI.page !== "colpo" || UI.edit || (e.pointerType === "mouse" && e.button !== 0)) return;
  const el = e.target.closest?.("[data-cdl]"); if (!el || e.target.closest("[data-lug],input,select,textarea")) return;
  fineLP();
  LP = { el, id: e.pointerId, x: e.clientX, y: e.clientY, t: setTimeout(() => { const k = el.dataset.cdl; fineLP(); mangiaClic = Date.now(); try { navigator.vibrate?.(12); } catch {} dettagli(k); }, 520) };
  el.classList.add("vq1p");
}, true);
document.addEventListener("pointermove", e => { if (LP && e.pointerId === LP.id && Math.hypot(e.clientX - LP.x, e.clientY - LP.y) > 10) fineLP(); }, { passive: true });
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, e => { if (LP && e.pointerId === LP.id) fineLP(); }, true);
document.addEventListener("scroll", fineLP, { passive: true, capture: true });
/* dopo la pressione lunga il dito si alza: quel clic non deve fare l'azione (né chiudere il foglio appena aperto) */
window.addEventListener("click", e => { if (Date.now() - mangiaClic < 700) { mangiaClic = 0; e.stopPropagation(); e.preventDefault(); } }, true);
/* clic destro col mouse = dettagli; col dito il menu del browser non deve comparire */
document.addEventListener("contextmenu", e => {
  if (UI.page !== "colpo" || UI.edit) return;
  const el = e.target.closest?.("[data-cdl]"); if (!el || e.target.closest("[data-lug]")) return;
  e.preventDefault();
  if (e.pointerType === "touch" || Date.now() - mangiaClic < 900) return;
  dettagli(el.dataset.cdl);
});
/* tastiera: Invio o spazio = tocco, il tasto «menu» o Maiusc+F10 = dettagli */
document.addEventListener("keydown", e => {
  if (UI.page !== "colpo") return;
  const el = e.target.closest?.(".vq1t[data-act],.vq1[data-act]"); if (!el || e.target !== el) return;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); }
  else if (!UI.edit && (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) { e.preventDefault(); const c = el.closest("[data-cdl]"); if (c) dettagli(c.dataset.cdl); }
});

/* ---------- ✏️ una tessera: nome, icona, misura (gruppo: dove) ---------- */
let ED = null;
function foglioTessera() {
  const T = trova(ED); if (!T) return "";
  const B = T.k === "b" ? blocchi()[T.x] : null, base = { ...T, n: "" }, def = nomeT(base);
  const icoDef = T.k === "e" ? (S[T.x] ? (domain(T.x) === "light" ? "💡" : iconaEnt(T.x)) : "❔") : T.k === "b" ? B?.icona || "▦" : T.k === "g" ? TIPI_G()[T.x.split("|")[0]]?.[0] : iconaStanza(T.x);
  const cosa = T.k === "e" ? T.x : T.k === "b" ? t("blocco pronto", "ready-made block") : T.k === "g" ? t("gruppo", "group") : t("stanza", "room");
  const misure = [["s", t("Piccola", "Small")], ["m", t("Media", "Medium")], ["l", t("Grande", "Large")]];
  const [tipo, dove] = T.k === "g" ? T.x.split("|") : [];
  return `<div class="sh-head"><div><h3>✏️ ${esc(nomeT(T))}</h3><div class="small muted ${T.k === "e" ? "mono" : ""}">${esc(cosa)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="row" style="gap:10px"><label class="fld1" style="flex:0 0 92px"><span>${t("Icona", "Icon")}</span><input id="vq1i" type="text" maxlength="4" value="${esc(T.i || "")}" placeholder="${esc(icoDef)}" enterkeyhint="done"></label>
      <label class="fld1" style="flex:1;min-width:0"><span>${t("Nome", "Name")}</span><input id="vq1n" type="text" maxlength="40" value="${esc(T.n || "")}" placeholder="${esc(def)}" enterkeyhint="done"></label></div>
    <p class="small muted" style="margin:6px 0 0">${t("Vuoti = quelli di partenza. Il nome e l'icona cambiano solo nella tua vista.", "Empty = the default ones. Name and icon change only in your view.")}</p>
    <div class="fl1">${t("Misura", "Size")}</div><div class="seg">${misure.map(([k, n]) => `<button class="${T.d === k ? "act" : ""}" data-act="cdDim" data-v="${k}">${n}</button>`).join("")}</div>
    <p class="small muted" style="margin:6px 0 0">${T.k === "b" ? t("I blocchi grandi mostrano di più; se non ci sta tutto, dentro si scorre.", "Larger blocks show more; if it doesn't all fit, scroll inside.") : t("Nelle misure media e grande compaiono anche i comandi (temperatura, ▲■▼, ⏯).", "Medium and large sizes also show the controls (temperature, ▲■▼, ⏯).")}</p>
    ${T.k === "g" ? `<label class="fld1" style="margin-top:12px"><span>${t("Dove", "Where")}</span><select data-chg="cdDove">${postiGruppo(tipo).map(([p, n]) => `<option value="${esc(p)}" ${p === (dove || "casa") ? "selected" : ""}>${esc(nomeDove(p))} · ${n}</option>`).join("")}</select></label>` : ""}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="cdSave">💾 ${t("Salva", "Save")}</button><button class="btn bad" data-act="cdDel" data-k="${esc(T.id)}">✕ ${t("Togli dalla vista", "Remove from view")}</button></div>`;
}
const cambiaT = (k, fn, msg) => salvaMia(v => { const T = v.t.find(x => x.id === k); if (!T) return false; return fn(T, v); }, msg);
document.addEventListener("keydown", e => { if (e.key === "Enter" && (e.target.id === "vq1n" || e.target.id === "vq1i")) { e.preventDefault(); ACT.cdSave(); } });

/* ---------- ＋ aggiungi ---------- */
const AG = { tab: "ent", q: "", f: "" };
function foglioAggiungi() {
  const gia = new Set(tessere().map(T => T.k + ":" + T.x)), q = AG.q.trim().toLowerCase();
  const tab = (k, n) => `<button class="${AG.tab === k ? "act" : ""}" data-act="cdTab" data-v="${k}">${n}</button>`;
  const riga = (k, x, ic, n, sub, st, icHtml) => { const c = gia.has(k + ":" + x);
    return `<button class="pk1 ${c ? "vq1gia" : ""}" data-act="cdPick" data-kk="${k}" data-x="${esc(x)}" ${c ? `aria-disabled="true"` : ""}><span class="ic">${icHtml ? ic : esc(ic)}</span><span class="tx"><b>${esc(n)}</b><small>${esc(sub)}</small></span>${st ? `<span class="st">${esc(st)}</span>` : ""}<span class="plus">${c ? "✓" : "＋"}</span></button>`; };
  let corpo = "";
  if (AG.tab === "ent") {
    const L = Object.keys(S).filter(aggiungibile).filter(id => !AG.f || gruppoDom(id) === AG.f)
      .filter(id => !q || (nm(id) + " " + id + " " + (AREAS[areaOf(id)]?.name || "")).toLowerCase().includes(q))
      .sort((a, b) => nm(a).localeCompare(nm(b), LOC));
    const per = {}; L.forEach(id => (per[AREAS[areaOf(id)] ? areaOf(id) : "_"] = per[AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
    const ord = [...areasSorted(true).filter(a => per[a]), ...(per._ ? ["_"] : [])];
    let n = 0; const MAXR = 160;
    corpo = `<div class="pkt1">${FILTRI().filter(([k]) => !k || Object.keys(S).some(id => aggiungibile(id) && gruppoDom(id) === k)).map(([k, nn]) => `<button class="${AG.f === k ? "act" : ""}" data-act="cdFil" data-v="${k}">${nn}</button>`).join("")}</div>
      ${L.length ? ord.map(a => { const R = per[a].slice(0, Math.max(0, MAXR - n)); n += R.length; return R.length ? `<div class="fl1">${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)}</div><div class="pkl1 vq1l">${R.map(id => { const v = valore(id);
        return riga("e", id, iconaEnt(id), nm(id), id, ok(id) ? (domain(id) === "sensor" ? v.v + (v.u ? " " + v.u : "") : S[id].state) : t("non raggiungibile", "unavailable")); }).join("")}</div>` : ""; }).join("")
        + (L.length > MAXR ? `<div class="small muted" style="margin-top:8px">${t(`Ne mostro ${MAXR} su ${L.length}: cerca per trovare le altre.`, `Showing ${MAXR} of ${L.length}: search to find the others.`)}</div>` : "")
        : empty(t("Nessun risultato.", "No results."))}`;
  } else if (AG.tab === "blk") {
    const B = Object.entries(blocchi()).filter(([, b]) => !q || b.titolo.toLowerCase().includes(q));
    corpo = `<p class="small muted" style="margin:0 0 8px">${t("Gli stessi disegni delle altre pagine, aggiornati da soli. Ci sono solo quelli che hai in casa.", "The same drawings as the other pages, always up to date. Only the ones you have at home are listed.")}</p>
      <div class="pkl1 vq1l">${B.map(([k, b]) => riga("b", k, b.icona, b.titolo, b.pagina && PAGES[b.pagina] ? t("dalla pagina ", "from the page ") + PAGES[b.pagina].title : t("dalla Home", "from Home"))).join("") || empty(t("Nessun risultato.", "No results."))}</div>`;
  } else if (AG.tab === "grp") {
    corpo = `<p class="small muted" style="margin:0 0 8px">${t("Un tocco solo per tutte: se una è accesa (o aperta) le spegne (o chiude) tutte, altrimenti le accende (o apre). Cancelli e garage non entrano mai nelle tapparelle.", "One tap for all of them: if any is on (or open) it turns them all off (or closes them), otherwise it turns them on (or opens them). Gates and garages are never part of the covers.")}</p>
      ${Object.entries(TIPI_G()).map(([tipo, [ic, n]]) => { const P = postiGruppo(tipo).filter(([p]) => !q || nomeGruppo(tipo + "|" + p).toLowerCase().includes(q)); return P.length ? `<div class="fl1">${ic} ${esc(n)}</div><div class="pkl1 vq1l">${P.map(([p, c]) => riga("g", tipo + "|" + p, ic, nomeGruppo(tipo + "|" + p), c + " " + (tipo === "luci" ? t("luci", "lights") : t("tapparelle", "covers")))).join("")}</div>` : ""; }).join("")
        || empty(t("Non ho trovato luci né tapparelle.", "No lights or covers found."))}`;
  } else {
    const A = areasSorted().filter(a => !q || AREAS[a].name.toLowerCase().includes(q));
    corpo = `<p class="small muted" style="margin:0 0 8px">${t("Temperatura, umidità e luci accese; al tocco si apre la stanza.", "Temperature, humidity and lights on; tap to open the room.")}</p>
      <div class="pkl1 vq1l">${A.map(a => { const T = roomTemp(a); return riga("a", a, iconaStanza(a), AREAS[a].name, FLOORS[AREAS[a].floor]?.name || "", T != null ? fnum(T) + "°" : ""); }).join("") || empty(t("Nessuna stanza.", "No rooms."))}</div>`;
  }
  return `<div class="sh-head"><div><h3>＋ ${t("Aggiungi alla tua vista", "Add to your view")}</h3><div class="small muted">${t("Tocca per aggiungere: puoi sceglierne più di uno.", "Tap to add: you can pick more than one.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="seg vq1tabs">${tab("ent", "🔌 " + t("Dispositivi", "Devices"))}${tab("blk", "▦ " + t("Blocchi", "Blocks"))}${tab("grp", "💡 " + t("Gruppi", "Groups"))}${tab("room", "🏠 " + t("Stanze", "Rooms"))}</div>
    <input id="vq1q" class="pk1q" type="search" placeholder="🔍 ${t("Cerca…", "Search…")}" value="${esc(AG.q)}" autocomplete="off">${corpo}`;
}
document.addEventListener("input", e => { if (e.target.id === "vq1q") { AG.q = e.target.value; render(); } });
/** misura di partenza di una tessera nuova */
const dimPartenza = (k, x) => k === "g" ? "m" : k === "b" ? "s" : k === "a" ? "s" : ["camera", "media_player"].includes(domain(x)) || (domain(x) === "climate") ? "m" : "s";

/* ---------- 📋 copia la mia vista a un'altra persona (amministratori) ---------- */
let UT = null;
function utenti() { if (!UT) { UT = []; ws({ type: "config/auth/list" }).then(L => { UT = (L || []).filter(u => !u.system_generated && u.is_active); render(); }).catch(() => {}); } return UT; }
function foglioCopia() {
  const L = utenti().filter(u => u.id !== io()), D = sez()?.dati || {};
  return `<div class="sh-head"><div><h3>📋 ${t("Copia la tua vista", "Copy your view")}</h3><div class="small muted">${t("La persona che scegli trova la tua vista al posto della sua (utile per i nonni o i bambini). Poi può cambiarla da sola.", "The person you pick gets your view instead of theirs (handy for grandparents or kids). Then they can change it on their own.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${L.map(u => { const v = D[u.id], n = Array.isArray(v?.t) ? v.t.length : null;
      return `<div class="li"><span class="ic">👤</span><div class="tx"><b>${esc(u.name)}</b><span>${n == null ? t("non ha ancora una sua vista", "no own view yet") : t(`ha già una sua vista (${n} tessere)`, `has their own view (${n} tiles)`)}</span></div>
        <button class="btn sm" data-act="cdCopiaA" data-id="${esc(u.id)}" data-n="${esc(u.name)}">📋 ${t("Copia", "Copy")}</button></div>`; }).join("") || empty(t("Non ci sono altre persone in Home Assistant.", "There are no other people in Home Assistant."))}</div>`;
}

Object.assign(ACT, {
  cdTap: el => tocco(el),
  cdMp: el => svc("media_player", el.dataset.v, {}, { entity_id: el.dataset.id }),
  cdGr: el => { const x = el.dataset.x, tipo = x.split("|")[0], M = membri(x), on = el.dataset.v === "1"; if (!M.length) return;
    if (tipo === "luci") luciComando(on ? M : accesiG(x), on).catch(() => {}); else svc("cover", on ? "open_cover" : "close_cover", {}, { entity_id: M }).catch(() => {}); },
  cdOk: () => salvaMia(() => {}, "👍 " + t("La tua vista è pronta", "Your view is ready")),
  cdIo: () => { const f = () => { UI.edit = true; render(true); AG.tab = "ent"; AG.q = ""; AG.f = ""; openSheet(foglioAggiungi); };
    if (!salvata() && io()) salvaMia(v => { v.t = []; }).then(okk => okk && f()); else f(); },
  cdProp: el => { if (salvata() && tessere().length && !sicuro(el, t("Tocca ancora: sostituisce la tua vista", "Tap again: it replaces your view"))) return;
    const prima = mia() ? copia(mia().t) : null;
    salvaMia(v => { v.t = proposta(); }).then(okk => okk && toast("✨ " + t("Proposta automatica", "Automatic suggestion"), false, prima ? [t("Annulla", "Undo"), () => salvaMia(v => { v.t = prima; }, "↶ " + t("Come prima", "Back as it was"))] : null)); },
  cdAdd: () => { AG.q = ""; openSheet(foglioAggiungi); },
  cdTab: el => { AG.tab = el.dataset.v; AG.q = ""; render(); },
  cdFil: el => { AG.f = el.dataset.v; render(); },
  cdPick: el => { const k = el.dataset.kk, x = el.dataset.x; if (el.getAttribute("aria-disabled") === "true") return;
    if (tessere().length >= MAX) return toast(t(`Al massimo ${MAX} tessere`, `${MAX} tiles at most`), true);
    const n = k === "e" ? nm(x) : k === "b" ? blocchi()[x]?.titolo : k === "g" ? nomeGruppo(x) : AREAS[x]?.name;
    salvaMia(v => { if (v.t.some(T => T.k === k && T.x === x)) return false; v.t.push({ id: nuovoId(), k, x, d: dimPartenza(k, x) }); }, "＋ " + (n || x)); },
  cdEd: el => { ED = el.dataset.k; if (trova(ED)) openSheet(foglioTessera); },
  cdDim: el => { const v = el.dataset.v; if (DIM.includes(v)) cambiaT(ED, T => { if (T.d === v) return false; T.d = v; }); },
  cdSave: () => { const n = (document.getElementById("vq1n")?.value || "").trim().slice(0, 40), i = (document.getElementById("vq1i")?.value || "").trim().slice(0, 8), k = ED;
    closeSheet(); cambiaT(k, T => { if ((T.n || "") === n && (T.i || "") === i) return false; if (n) T.n = n; else delete T.n; if (i) T.i = i; else delete T.i; }, "💾 " + (n || nomeT({ ...trova(k), n: "" }))); },
  cdDel: el => { const k = el.dataset.k, T = trova(k); if (!T) return; const L = tessere(), pos = L.findIndex(x => x.id === k), nome = nomeT(T);
    if (UI.sheet) closeSheet();
    salvaMia(v => { const i = v.t.findIndex(x => x.id === k); if (i < 0) return false; v.t.splice(i, 1); })
      .then(okk => okk && toast("✕ " + nome, false, [t("Annulla", "Undo"), () => salvaMia(v => { if (!v.t.some(x => x.id === k)) v.t.splice(Math.min(pos, v.t.length), 0, T); }, "↶ " + nome)])); },
  cdCopia: () => { if (isAdmin()) openSheet(foglioCopia); },
  cdCopiaA: el => { if (!isAdmin()) return; const u = el.dataset.id, nome = el.dataset.n, prima = sez()?.dati?.[u];
    if (prima && !sicuro(el, t("Tocca ancora: sostituisce la sua", "Tap again: replaces theirs"))) return;
    const mie = copia(tessere());
    casaCambia(SEZ, d => { d[u] = { t: mie, agg: new Date().toISOString(), da: io() }; })
      .then(okk => okk && toast("📋 " + t("Copiata a ", "Copied to ") + nome, false, [t("Annulla", "Undo"), () => casaCambia(SEZ, d => { if (prima) d[u] = prima; else delete d[u]; }, "↶ " + nome)])); },
});
CHG.cdDove = el => { const p = el.value; cambiaT(ED, T => { const [tipo] = T.x.split("|"), x = tipo + "|" + p; if (T.x === x) return false; T.x = x; }); };

/* ---------- trascina e sposta (trascina.js): anche per chi non è amministratore, è la sua vista ---------- */
TRASCINA.colpo = {
  attivo: () => UI.edit && UI.page === "colpo" && !!io(),
  nome: k => { const T = trova(k); return T ? nomeT(T) : ""; },
  salva: async ({ ids }) => {
    const prima = tessere().map(T => T.id);
    const okk = await salvaMia(v => { const per = new Map(v.t.map(T => [T.id, T])), o = riordina(v.t.map(T => T.id), ids);
      if (o.join() === v.t.map(T => T.id).join()) return false; v.t = o.map(id => per.get(id)).filter(Boolean); });
    if (!okk) return;
    return () => salvaMia(v => { const per = new Map(v.t.map(T => [T.id, T])); v.t = [...prima.map(id => per.get(id)).filter(Boolean), ...v.t.filter(T => !prima.includes(T.id))]; }, "↶ " + t("Come prima", "Back as it was"));
  },
};

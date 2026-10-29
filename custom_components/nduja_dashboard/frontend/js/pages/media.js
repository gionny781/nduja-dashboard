/* Media: TV, decoder, Apple TV, Chromecast, Fire TV, console e telecomandi (remote.*).
   Per ogni schermo: la scheda con accensione, sorgente, volume e quello che è in onda; il telecomando virtuale
   (croce, OK, indietro, home, menu, volume, canali, numeri a scomparsa) con i comandi giusti per l'integrazione
   e i soli tasti che funzionano (con ✏️ un tasto si ridefinisce con un comando tuo); le app di streaming
   con un logo di testo e i colori disegnati per 'Nduja. In Home la scheda «Media» per la TV accesa.
   Le TV escono dalla pagina Musica (vedi tvInMedia in core.js). */
import { S, REG, DEVICES, ACT, CHG, UI, LAYOUT, HOME_EXTRA, t, esc, nm, ok, attr, ents, areaOf, AREAS, card, empty, page, svc, sGet, sSet,
  toast, render, go, isAdmin, openSheet, closeSheet, isTV, remotoDi, lettoreDi } from "../core.js";
import { item, addBtn, cambia } from "../edit.js";

const F = { PAUSE: 1, VOL: 4, MUTE: 8, PREV: 16, NEXT: 32, ON: 128, OFF: 256, PLAY_MEDIA: 512, VSTEP: 1024, SOURCE: 2048, PLAY: 16384 };
const ha = (id, f) => !!id && ((attr(id, "supported_features") || 0) & f) === f;
const acceso = id => !!id && ok(id) && !["off", "standby", "unavailable", "unknown"].includes(S[id].state);
const vibra = () => { try { navigator.vibrate?.(8); } catch {} };

/* ================= schermi e telecomandi ================= */
const schermi = () => ents("media_player", isTV).sort((a, b) => nm(a).localeCompare(nm(b)));
/** telecomandi senza un lettore (Harmony, Broadlink…) */
const remotiSoli = () => ents("remote", id => !lettoreDi(id)).sort((a, b) => nm(a).localeCompare(nm(b)));
const chiavi = () => [...schermi(), ...remotiSoli()];
function scelto() {
  const K = chiavi(), v = sGet("md_tv");
  return K.includes(v) ? v : K.find(acceso) || K[0] || null;
}
/** contesto di uno schermo: il lettore, il suo telecomando e l'integrazione */
function ctx(k) {
  const mp = k?.startsWith("media_player.") ? k : null, rm = mp ? remotoDi(mp) : k;
  return { k, mp, rm, plat: REG[mp]?.platform || REG[rm]?.platform || "" };
}
const MARCHE = { samsungtv: "Samsung", webostv: "LG webOS", braviatv: "Sony Bravia", philips_js: "Philips", androidtv_remote: "Android / Google TV", androidtv: "Fire TV · Android (ADB)",
  apple_tv: "Apple TV", cast: "Google Cast", roku: "Roku", vizio: "Vizio", panasonic_viera: "Panasonic", ps4: "PlayStation", xbox: "Xbox", harmony: "Harmony", broadlink: "Broadlink", firetv: "Fire TV" };
function icona(k) {
  if (k.startsWith("remote.")) return "🎛️";
  const s = k + " " + nm(k) + " " + (DEVICES[REG[k]?.device]?.model || "");
  return /xbox|playstation|\bps[45]\b|nintendo|console/i.test(s) || ["ps4", "xbox"].includes(REG[k]?.platform) ? "🎮"
    : attr(k, "device_class") === "receiver" ? "🎚️" : /decoder|sky|tim\s*box|\bbox\b/i.test(s) ? "📡" : "📺";
}

/* ================= tasti: i comandi delle integrazioni principali ================= */
/* via: "remote" (remote.send_command), "webos" (webostv.button), "adb" (remote o androidtv.adb_command) */
const P = {
  samsungtv: { via: "remote", k: { su: "KEY_UP", giu: "KEY_DOWN", sx: "KEY_LEFT", dx: "KEY_RIGHT", ok: "KEY_ENTER", indietro: "KEY_RETURN", home: "KEY_HOME", menu: "KEY_MENU",
    volsu: "KEY_VOLUP", volgiu: "KEY_VOLDOWN", muto: "KEY_MUTE", chsu: "KEY_CHUP", chgiu: "KEY_CHDOWN", power: "KEY_POWER" }, num: n => "KEY_" + n },
  androidtv_remote: { via: "remote", k: { su: "DPAD_UP", giu: "DPAD_DOWN", sx: "DPAD_LEFT", dx: "DPAD_RIGHT", ok: "DPAD_CENTER", indietro: "BACK", home: "HOME", menu: "MENU",
    volsu: "VOLUME_UP", volgiu: "VOLUME_DOWN", muto: "MUTE", chsu: "CHANNEL_UP", chgiu: "CHANNEL_DOWN", power: "POWER" }, num: n => String(n) },
  /* Apple TV: «menu» del telecomando torna indietro, «top_menu» apre il menu principale dell'app */
  apple_tv: { via: "remote", k: { su: "up", giu: "down", sx: "left", dx: "right", ok: "select", indietro: "menu", home: "home", menu: "top_menu", volsu: "volume_up", volgiu: "volume_down" } },
  webostv: { via: "webos", k: { su: "UP", giu: "DOWN", sx: "LEFT", dx: "RIGHT", ok: "ENTER", indietro: "BACK", home: "HOME", menu: "MENU",
    volsu: "VOLUMEUP", volgiu: "VOLUMEDOWN", muto: "MUTE", chsu: "CHANNELUP", chgiu: "CHANNELDOWN" }, num: n => String(n) },
  braviatv: { via: "remote", k: { su: "Up", giu: "Down", sx: "Left", dx: "Right", ok: "Confirm", indietro: "Return", home: "Home", menu: "ActionMenu" }, num: n => "Num" + n },
  philips_js: { via: "remote", k: { su: "CursorUp", giu: "CursorDown", sx: "CursorLeft", dx: "CursorRight", ok: "Confirm", indietro: "Back", home: "Home", menu: "Options",
    volsu: "VolumeUp", volgiu: "VolumeDown", muto: "Mute", chsu: "ChannelStepUp", chgiu: "ChannelStepDown", power: "Standby" }, num: n => "Digit" + n },
  /* Fire TV e Android con ADB (integrazione Android Debug Bridge) */
  androidtv: { via: "adb", k: { su: "UP", giu: "DOWN", sx: "LEFT", dx: "RIGHT", ok: "CENTER", indietro: "BACK", home: "HOME", menu: "MENU",
    volsu: "VOLUME_UP", volgiu: "VOLUME_DOWN", muto: "MUTE", power: "POWER" } },
};
P.firetv = P.androidtv;
const NOMI = () => ({ su: t("Su", "Up"), giu: t("Giù", "Down"), sx: t("Sinistra", "Left"), dx: t("Destra", "Right"), ok: "OK", indietro: t("Indietro", "Back"), home: "Home", menu: "Menu",
  volsu: t("Volume +", "Volume +"), volgiu: t("Volume −", "Volume −"), muto: t("Muto", "Mute"), chsu: t("Canale +", "Channel +"), chgiu: t("Canale −", "Channel −"), power: t("Accensione", "Power"),
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ["n" + n, String(n)])) });
/** il comando di partenza di un tasto per questo schermo (null se l'integrazione non lo ha) */
function base(c, k) {
  const p = P[c.plat]; if (!p) return null;
  if (/^n\d$/.test(k)) return p.num ? p.num(+k.slice(1)) : null;
  return p.k[k] || null;
}
/** come arriva un comando allo schermo: "remote", "webos", "adb" oppure null */
function canale(c, cmd) {
  if (/^script\./.test(cmd || "")) return "script";
  const v = P[c.plat]?.via;
  if (v === "webos" || (!v && c.plat === "webostv")) return c.mp ? "webos" : null;
  if (v === "adb" || c.plat === "androidtv") return c.rm ? "remote" : c.mp ? "adb" : null;
  return c.rm ? "remote" : null;
}
function invia(c, cmd) {
  vibra();
  const via = canale(c, cmd);
  if (via === "script") return svc("script", "turn_on", {}, { entity_id: cmd.trim() });
  if (via === "remote") return svc("remote", "send_command", { command: cmd }, { entity_id: c.rm });
  if (via === "webos") return svc("webostv", "button", { button: cmd }, { entity_id: c.mp });
  if (via === "adb") return svc("androidtv", "adb_command", { command: cmd }, { entity_id: c.mp });
  toast(t("Questo schermo non ha un telecomando in Home Assistant.", "This screen has no remote in Home Assistant."), true);
}
const proprio = (c, k) => String(LAYOUT.mdTasti?.[c.k]?.[k] || "").trim();
/** cosa fa un tasto: una funzione, oppure null se su questo schermo non funziona (dove basta, uso media_player) */
function azione(c, k) {
  const mio = proprio(c, k); if (mio && canale(c, mio)) return () => invia(c, mio);
  const mp = c.mp;
  if ((k === "volsu" || k === "volgiu") && mp) {
    if (ha(mp, F.VSTEP)) return () => { vibra(); svc("media_player", k === "volsu" ? "volume_up" : "volume_down", {}, { entity_id: mp }); };
    if (ha(mp, F.VOL)) return () => { vibra(); const v = Math.min(1, Math.max(0, (+attr(mp, "volume_level") || 0) + (k === "volsu" ? .05 : -.05))); svc("media_player", "volume_set", { volume_level: Math.round(v * 100) / 100 }, { entity_id: mp }); };
  }
  if (k === "muto" && ha(mp, F.MUTE)) return () => { vibra(); svc("media_player", "volume_mute", { is_volume_muted: !attr(mp, "is_volume_muted") }, { entity_id: mp }); };
  if (k === "power") {
    if (mp && (ha(mp, F.ON) || ha(mp, F.OFF))) return () => { vibra(); svc("media_player", acceso(mp) ? "turn_off" : "turn_on", {}, { entity_id: mp }); };
    if (!mp && c.rm) return () => { vibra(); svc("remote", S[c.rm]?.state === "on" ? "turn_off" : "turn_on", {}, { entity_id: c.rm }); };
  }
  const b = base(c, k);
  return b && canale(c, b) ? () => invia(c, b) : null;
}

/* ================= app di streaming: logo di testo e colori disegnati per 'Nduja (niente loghi ufficiali) ================= */
/* r: riconosce il nome o l'id dell'app; w: la scritta; a1/a2: sfondo; fg: colore della scritta; st: stile della scritta; link: per Android/Google TV */
const APP = [
  { r: /netflix/i, n: "Netflix", w: "NETFLIX", a1: "#c4161c", a2: "#4a0508", fg: "#fff", st: "caps", link: "netflix://" },
  { r: /prime\s*video|amazon\s*(prime\s*)?video|amazonvideo|primevideo/i, n: "Prime Video", w: "prime video", a1: "#1aa3d6", a2: "#0b2a46", fg: "#fff", st: "low", link: "https://app.primevideo.com" },
  { r: /disney/i, n: "Disney+", w: "Disney+", a1: "#1f4fc4", a2: "#0a1640", fg: "#fff", st: "it", link: "https://www.disneyplus.com" },
  { r: /youtube\s*music/i, n: "YouTube Music", w: "▶ music", a1: "#e8333a", a2: "#2a0607", fg: "#fff", st: "low" },
  { r: /youtube\s*kids/i, n: "YouTube Kids", w: "▶ kids", a1: "#ff5a4f", a2: "#b81d14", fg: "#fff", st: "low" },
  { r: /youtube/i, n: "YouTube", w: "▶ YouTube", a1: "#e8333a", a2: "#5c0b0b", fg: "#fff", st: "", link: "https://www.youtube.com" },
  { r: /rai\s*play/i, n: "RaiPlay", w: "RaiPlay", a1: "#1866c9", a2: "#071f45", fg: "#fff", st: "" },
  { r: /mediaset|infinity/i, n: "Mediaset Infinity", w: "infinity", a1: "#6a2bd8", a2: "#150a3d", fg: "#fff", st: "low" },
  { r: /dazn/i, n: "DAZN", w: "DAZN", a1: "#262626", a2: "#050505", fg: "#f4ff4a", st: "caps" },
  { r: /spotify/i, n: "Spotify", w: "spotify", a1: "#25c460", a2: "#0b3d1d", fg: "#fff", st: "low" },
  { r: /apple\s*tv|com\.apple\.tv/i, n: "Apple TV", w: "tv+", a1: "#3a3a3c", a2: "#0c0c0d", fg: "#fff", st: "low" },
  { r: /apple\s*music/i, n: "Apple Music", w: "♪ music", a1: "#fb4a62", a2: "#7a0f22", fg: "#fff", st: "low" },
  { r: /amazon\s*music/i, n: "Amazon Music", w: "music", a1: "#3fd8de", a2: "#123b52", fg: "#fff", st: "low" },
  { r: /^now(\s*tv)?$|nowtv/i, n: "NOW", w: "NOW", a1: "#14b8a6", a2: "#063b36", fg: "#fff", st: "caps" },
  { r: /sky\s*go|^sky$/i, n: "Sky Go", w: "sky go", a1: "#2c7be5", a2: "#5b21b6", fg: "#fff", st: "low" },
  { r: /paramount/i, n: "Paramount+", w: "Paramount+", a1: "#1764e8", a2: "#08214f", fg: "#fff", st: "" },
  { r: /tim\s*vision/i, n: "TIMVISION", w: "TIMVISION", a1: "#1a4fb5", a2: "#0a1f4d", fg: "#fff", st: "caps" },
  { r: /discovery/i, n: "discovery+", w: "discovery+", a1: "#2f7fe0", a2: "#0d2550", fg: "#fff", st: "low" },
  { r: /pluto/i, n: "Pluto TV", w: "pluto tv", a1: "#262626", a2: "#000", fg: "#fff36b", st: "low" },
  { r: /plex/i, n: "Plex", w: "plex", a1: "#3b3b3b", a2: "#111", fg: "#f1b52c", st: "low", link: "plex://" },
  { r: /kodi/i, n: "Kodi", w: "kodi", a1: "#2aa9d8", a2: "#0b3046", fg: "#fff", st: "low" },
  { r: /twitch/i, n: "Twitch", w: "twitch", a1: "#8b5cf6", a2: "#2e1065", fg: "#fff", st: "low", link: "twitch://home" },
  { r: /crunchyroll/i, n: "Crunchyroll", w: "crunchyroll", a1: "#f58a2a", a2: "#7a3304", fg: "#fff", st: "low" },
  { r: /jellyfin/i, n: "Jellyfin", w: "jellyfin", a1: "#8b5cf6", a2: "#0e7490", fg: "#fff", st: "low" },
];
const appDi = s => APP.find(a => a.r.test(String(s || ""))) || null;
/* gli ingressi (HDMI, TV, AV…) non sono app: stanno nel menu «Sorgente» */
const INGRESSO = /^(tv|live\s*tv|dtv|atv|hdmi.*|av\s*\d*|component.*|composite.*|usb.*|antenna|cable|cavo|sat(ellite)?|digitale terrestre|vga|pc|scart|optical|ottico|bluetooth|line.*|input.*|ingresso.*|game|aux|tuner|radio|home dashboard|apps|app|settings|impostazioni|.*input.*|hdmi\d.*)$/i;
/** le app di uno schermo: { nome, app (del catalogo o null), via: "source" | "app" | "activity", v (valore da mandare) } */
function apps(c) {
  const mp = c.mp, L = [], visti = new Set();
  const metti = (nome, via, v) => { const a = appDi(nome) || appDi(v), key = (a ? a.n : nome).toLowerCase(); if (visti.has(key)) return; visti.add(key); L.push({ nome: a ? a.n : nome, app: a, via, v }); };
  if (mp && ha(mp, F.SOURCE)) (attr(mp, "source_list") || []).filter(s => typeof s === "string" && !INGRESSO.test(s.trim())).forEach(s => metti(s, "source", s));
  const al = attr(mp, "app_list");
  if (Array.isArray(al)) al.forEach(x => { const n = typeof x === "string" ? x : x?.name || x?.title; if (n) metti(n, "app", typeof x === "string" ? x : x.id || x.app_id || n); });
  else if (al && typeof al === "object") Object.entries(al).forEach(([n, id]) => metti(n, "app", id));
  /* Android/Google TV: non dice quali app ha, ma le apre con un link */
  if (c.plat === "androidtv_remote" && c.rm) APP.filter(a => a.link).forEach(a => metti(a.n, "activity", a.link));
  /* le app del catalogo prima, poi le altre in ordine di nome */
  return L.sort((x, y) => (!!y.app - !!x.app) || (x.app ? APP.indexOf(x.app) - APP.indexOf(y.app) : x.nome.localeCompare(y.nome)));
}
/** l'app che è aperta adesso */
function appOra(c) {
  const v = [attr(c.mp, "app_name"), attr(c.mp, "app_id"), attr(c.rm, "current_activity"), acceso(c.mp) ? attr(c.mp, "source") : ""].filter(Boolean).map(String);
  return v.length ? { testo: v[0], app: v.map(appDi).find(Boolean) || null, tutti: v.map(x => x.toLowerCase()) } : null;
}
const coloreLibero = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return [`hsl(${h} 55% 42%)`, `hsl(${(h + 40) % 360} 60% 16%)`]; };
function logo(a, nome, cls = "") {
  const [a1, a2] = a ? [a.a1, a.a2] : coloreLibero(nome);
  return `<span class="md1lg ${cls} ${a ? "st-" + (a.st || "n") : "lib"}" style="--a1:${a1};--a2:${a2};--fg:${a ? a.fg : "#fff"}" aria-hidden="true"><b>${esc(a ? a.w : nome)}</b></span>`;
}
async function apri(c, x) {
  vibra();
  try {
    if (c.mp && !acceso(c.mp) && ha(c.mp, F.ON)) { await svc("media_player", "turn_on", {}, { entity_id: c.mp }); await new Promise(r => setTimeout(r, 1500)); }
    if (x.via === "source") await svc("media_player", "select_source", { source: x.v }, { entity_id: c.mp });
    else if (x.via === "app") await svc("media_player", "play_media", { media_content_type: "app", media_content_id: x.v }, { entity_id: c.mp });
    else await svc("remote", "turn_on", { activity: x.v }, { entity_id: c.rm });
    toast("▶ " + x.nome + " · " + nm(c.k));
  } catch { /* svc ha già detto cosa non va */ }
}

/* ================= disegni ================= */
const ora = c => {
  const mp = c.mp; if (!mp || !acceso(mp)) return null;
  const a = S[mp].attributes, o = appOra(c);
  return { titolo: a.media_title || a.media_series_title || "", sotto: [a.media_series_title && a.media_title ? a.media_series_title : "", a.media_artist || a.media_channel || ""].filter(Boolean).join(" · "),
    app: o?.app || null, sorgente: a.app_name || a.source || "", img: a.entity_picture || null };
};
/** lo schermo disegnato: spento (con la lucina), con l'app aperta (i suoi colori) o con l'immagine di quello che è in onda */
function schermo(c, cls = "") {
  const o = ora(c), un = c.mp && !ok(c.mp);
  const dentro = !o ? `<i class="md1sb" aria-hidden="true"></i>`
    : o.img ? `<img src="${esc(o.img)}" alt="" loading="lazy" onerror="this.remove()">${o.app ? logo(o.app, o.app.n, "pic") : ""}`
    : o.app ? logo(o.app, o.app.n, "full")
    : `<span class="md1sn"><b>${esc(o.sorgente || nm(c.k))}</b></span>`;
  return `<div class="md1tv ${o ? "on" : ""} ${un ? "un" : ""} ${cls}"><div class="md1sc">${dentro}<i class="md1gl" aria-hidden="true"></i></div><i class="md1ft" aria-hidden="true"></i></div>`;
}
const STATO = () => ({ on: t("Acceso", "On"), playing: t("In riproduzione", "Playing"), paused: t("In pausa", "Paused"), idle: t("Acceso", "On"), off: t("Spento", "Off"), standby: "Standby",
  buffering: t("Carica…", "Buffering…"), unavailable: t("Non raggiungibile", "Unavailable"), unknown: "—" });
function cardTV(c) {
  const mp = c.mp, a = S[mp].attributes, on = acceso(mp), o = ora(c), vol = a.volume_level;
  /* le app hanno i loro pulsanti: nel menu «Sorgente» restano gli ingressi (HDMI, TV…) */
  const tutte = (a.source_list || []).filter(s => typeof s === "string"), ingressi = tutte.filter(s => INGRESSO.test(s.trim()));
  const pl = (v, ic, f, lab) => ha(mp, f) ? `<button class="mpc1" data-act="mdMp" data-v="${v}" data-id="${mp}" aria-label="${lab}">${ic}</button>` : "";
  const corpo = `${schermo(c)}
    <div class="md1in"><div class="row between" style="gap:10px"><div class="md1nm"><b>${esc(nm(mp))}</b><small>${esc([STATO()[S[mp].state] || S[mp].state, AREAS[areaOf(mp)]?.name, MARCHE[c.plat]].filter(Boolean).join(" · "))}</small></div>
      ${ha(mp, F.ON) || ha(mp, F.OFF) || c.rm ? `<button class="md1pw ${on ? "on" : ""}" data-act="mdK" data-k="power" data-id="${c.k}" aria-label="${on ? t("Spegni", "Turn off") : t("Accendi", "Turn on")}" aria-pressed="${on}">⏻</button>` : ""}</div>
      ${o?.titolo ? `<div class="mpn1 md1now"><b>${esc(o.titolo)}</b>${o.sotto || o.sorgente ? `<span>${esc(o.sotto || o.sorgente)}</span>` : ""}</div>` : ""}
      ${on && (ha(mp, F.PAUSE) || ha(mp, F.PLAY)) && ["playing", "paused"].includes(S[mp].state) ? `<div class="mpk1">${pl("media_previous_track", "⏮", F.PREV, t("Precedente", "Previous"))}
        <button class="mpc1 big" data-act="mdMp" data-v="media_play_pause" data-id="${mp}" aria-label="${t("Riproduci o pausa", "Play or pause")}">${S[mp].state === "playing" ? "⏸" : "▶"}</button>
        ${pl("media_next_track", "⏭", F.NEXT, t("Successivo", "Next"))}</div>` : ""}
      ${on && ha(mp, F.VOL) ? `<div class="mpv1">${ha(mp, F.MUTE) ? `<button data-act="mdK" data-k="muto" data-id="${c.k}" aria-label="${t("Muto", "Mute")}">${a.is_volume_muted ? "🔇" : vol > .5 ? "🔊" : "🔉"}</button>` : "🔉"}<input type="range" min="0" max="100" value="${Math.round((vol || 0) * 100)}" data-chg="mdVol" data-id="${mp}" aria-label="Volume"><em>${Math.round((vol || 0) * 100)}</em></div>` : ""}
      ${on && ha(mp, F.SOURCE) && ingressi.length ? `<label class="fld1"><span>${t("Sorgente", "Source")}</span><select data-chg="mdSrc" data-id="${mp}">${a.source && !ingressi.includes(a.source) ? `<option selected>${esc(a.source)}</option>` : ""}${ingressi.map(s => `<option ${a.source === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}
      ${!on && ok(mp) && !ha(mp, F.ON) && !c.rm ? `<div class="small muted">${t("Si accende dal suo telecomando o dalla sua app.", "Turn it on with its own remote or app.")}</div>` : ""}
    </div>`;
  return card("", `<div class="md1tc">${corpo}</div>`, { cls: "md1a1" });
}
/* telecomando senza lettore (Harmony, Broadlink…): accensione e attività */
function cardRemoto(c) {
  const on = S[c.rm]?.state === "on", att = attr(c.rm, "current_activity");
  return card("", `<div class="md1tc"><div class="md1tv ${on ? "on" : ""} md1rmv"><div class="md1sc"><span class="md1sn"><b>🎛️</b><small>${esc(on && att && !/^power\s*off$/i.test(att) ? att : on ? t("Acceso", "On") : t("Spento", "Off"))}</small></span><i class="md1gl" aria-hidden="true"></i></div><i class="md1ft" aria-hidden="true"></i></div>
    <div class="md1in"><div class="row between" style="gap:10px"><div class="md1nm"><b>${esc(nm(c.rm))}</b><small>${esc([AREAS[areaOf(c.rm)]?.name, MARCHE[c.plat] || t("Telecomando", "Remote")].filter(Boolean).join(" · "))}</small></div>
      <button class="md1pw ${on ? "on" : ""}" data-act="mdK" data-k="power" data-id="${c.k}" aria-label="${on ? t("Spegni", "Turn off") : t("Accendi", "Turn on")}" aria-pressed="${on}">⏻</button></div>
      ${!(attr(c.rm, "activity_list") || []).length && !Object.keys(LAYOUT.mdTasti?.[c.k] || {}).length ? `<div class="small muted">${isAdmin() ? t("Con ✏️ Modifica scegli il comando di ogni tasto del telecomando.", "With ✏️ Edit choose the command of each remote key.") : t("I tasti di questo telecomando non sono ancora stati scelti.", "This remote's keys haven't been set up yet.")}</div>` : ""}</div></div>`, { cls: "md1a1" });
}

/* ---------- telecomando virtuale ---------- */
const MD = { num: false };
function tasto(c, k, ic, cls = "") {
  const f = azione(c, k), mio = !!proprio(c, k), lab = NOMI()[k];
  if (UI.edit && isAdmin()) return `<button class="md1k ${cls} ${f ? "" : "nd"} ${mio ? "mio" : ""}" data-act="mdEd" data-k="${k}" data-id="${c.k}" aria-label="✏️ ${esc(lab)}">${ic}</button>`;
  if (!f) return `<span class="md1k ${cls} vuoto" aria-hidden="true"></span>`;
  return `<button class="md1k ${cls}" data-act="mdK" data-k="${k}" data-id="${c.k}" aria-label="${esc(lab)}" title="${esc(lab)}">${ic}</button>`;
}
const c1 = (c, L) => UI.edit && isAdmin() || L.some(k => azione(c, k));
function cardTelecomando(c) {
  const croce = c1(c, ["su", "giu", "sx", "dx", "ok"]), nav = c1(c, ["indietro", "home", "menu"]);
  const vol = c1(c, ["volsu", "volgiu"]), ch = c1(c, ["chsu", "chgiu"]), muto = c1(c, ["muto"]), num = c1(c, ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9"]);
  if (!croce && !nav && !vol && !ch && !muto && !num) return "";
  const freccia = r => `<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${r}deg)"><path d="M7 14.5l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const rocker = (su, giu, nome, a, b) => `<div class="md1rk"><span class="md1rl">${nome}</span>${tasto(c, su, a, "rk")}${tasto(c, giu, b, "rk")}</div>`;
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, ""].map(n => n === "" ? `<span></span>` : tasto(c, "n" + n, String(n), "nu")).join("");
  const corpo = `<div class="md1rc">
    ${UI.edit && isAdmin() ? `<div class="md1eh">✏️ ${t("Tocca un tasto per dargli un comando tuo. Tratteggiati: non hanno ancora un comando.", "Tap a key to give it your own command. Dashed: no command yet.")}</div>` : ""}
    ${croce ? `<div class="md1pad">${tasto(c, "su", freccia(0), "su")}${tasto(c, "sx", freccia(-90), "sx")}${tasto(c, "ok", "OK", "ok")}${tasto(c, "dx", freccia(90), "dx")}${tasto(c, "giu", freccia(180), "giu")}</div>` : ""}
    ${nav ? `<div class="md1nv">${tasto(c, "indietro", "↩", "tn")}${tasto(c, "home", "⌂", "tn")}${tasto(c, "menu", "☰", "tn")}</div>` : ""}
    ${vol || ch || muto ? `<div class="md1rks">${vol ? rocker("volsu", "volgiu", "VOL", "+", "−") : ""}${muto ? `<div class="md1mm">${tasto(c, "muto", attr(c.mp, "is_volume_muted") ? "🔇" : "🔈", "tn")}<small>${t("muto", "mute")}</small></div>` : ""}${ch ? rocker("chsu", "chgiu", "CH", "⌃", "⌄") : ""}</div>` : ""}
    ${num ? `<button class="md1nt ${MD.num ? "on" : ""}" data-act="mdNum" aria-expanded="${MD.num}">123 <span>${MD.num ? "▴" : "▾"}</span></button>
      <div class="md1np ${MD.num ? "open" : ""}" ${MD.num ? "" : "inert"}><div class="md1ng">${nums}</div></div>` : ""}
  </div>`;
  return card("🎛️ " + t("Telecomando", "Remote"), corpo, { cls: "md1a2" });
}
function cardApp(c) {
  const L = apps(c), o = appOra(c), act = attr(c.rm, "activity_list"), cur = attr(c.rm, "current_activity");
  const attivita = Array.isArray(act) && act.length ? act.filter(x => !/^power\s*off$/i.test(x)) : [];
  if (!L.length && !attivita.length) return "";
  APPV[c.k] = L;
  const aperta = x => !!o && o.tutti.some(v => v === String(x.v).toLowerCase() || v === x.nome.toLowerCase() || (x.app && x.app.r.test(v)));
  const pezzi = L.map((x, i) => `<button class="md1ap ${aperta(x) ? "ora" : ""}" data-act="mdApp" data-id="${c.k}" data-i="${i}" aria-label="${t("Apri", "Open")} ${esc(x.nome)}">${logo(x.app, x.nome)}<small>${esc(x.nome)}</small></button>`).join("");
  const att = attivita.map(a => `<button class="md1at ${a === cur ? "ora" : ""}" data-act="mdAtt" data-id="${c.rm}" data-v="${esc(a)}"><span>${a === cur ? "●" : "▶"}</span>${esc(a)}</button>`).join("");
  return card("▶ " + (L.length ? t("App", "Apps") : t("Attività", "Activities")), `${L.length ? `<div class="md1aps">${pezzi}</div>` : ""}${attivita.length ? `${L.length ? `<div class="mu1l">${t("Attività", "Activities")}</div>` : ""}<div class="md1ats">${att}</div>` : ""}
    ${c.plat === "androidtv_remote" && L.some(x => x.via === "activity") ? `<div class="small muted" style="margin-top:10px">${t("Si aprono se l'app è installata sulla TV.", "They open if the app is installed on the TV.")}</div>` : ""}`, { cls: "md1a3" });
}
const APPV = {};

/* ================= pagina ================= */
function chip(k, sel) {
  const c = ctx(k), on = c.mp ? acceso(c.mp) : S[k]?.state === "on", o = ora(c);
  const sotto = o ? (o.titolo || o.sorgente || t("Acceso", "On")) : c.mp ? STATO()[S[k].state] || S[k].state : on ? t("Acceso", "On") : t("Spento", "Off");
  return `<button class="mu1c md1ch ${sel ? "act" : ""} ${on ? "play" : ""}" data-act="mdSel" data-id="${k}" aria-pressed="${sel}"><span class="ic">${icona(k)}</span><span class="tx"><b>${esc(nm(k))}</b><small>${on ? "● " : ""}${esc(sotto)}</small></span></button>`;
}
function pagina() {
  const K = chiavi(), k = scelto();
  if (!k) return `<div class="g g3">${card("📺 Media", empty(UI.edit ? t("Premi ＋ per aggiungere una TV o un telecomando.", "Press ＋ to add a TV or a remote.") : t("Nessuna TV: premi ✏️ Modifica in alto per aggiungerne.", "No TV: press ✏️ Edit at the top to add some.")) + addBtn(["media_player", "remote"], { big: true, label: t("Aggiungi TV o telecomando", "Add TV or remote") }), { cls: "span3" })}</div>`;
  const c = ctx(k);
  const lista = UI.edit ? card("✏️ " + t("Schermi e telecomandi", "Screens and remotes"), `<div class="stack">${K.map(id => item(id, `<div class="li"><span class="ic">${icona(id)}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc([AREAS[areaOf(id)]?.name, MARCHE[ctx(id).plat]].filter(Boolean).join(" · ") || id)}</span></div></div>`)).join("")}
    ${addBtn(["media_player", "remote"], { label: t("Aggiungi TV o telecomando", "Add TV or remote") })}</div>`, { cls: "span3" }) : "";
  return `<div class="g g3">
    ${K.length > 1 ? card("", `<div class="mu1cs">${K.map(x => chip(x, x === k)).join("")}</div>`, { cls: "span3 md1cc" }) : ""}
    <div class="span3 md1g">${c.mp ? cardTV(c) : cardRemoto(c)}${cardTelecomando(c)}${cardApp(c)}</div>
    ${lista}
  </div>`;
}

/* ---------- scheda della Home: la TV accesa ---------- */
function homeCard() {
  const L = schermi().filter(acceso); if (!L.length) return "";
  return card("📺 " + t("Media", "Media"), `<div class="stack">${L.slice(0, 3).map(mp => { const c = ctx(mp), o = ora(c), su = azione(c, "volsu"), giu = azione(c, "volgiu");
    return `<div class="md1h">${`<button class="md1hb" data-act="mdVai" data-id="${mp}">${schermo(c, "sm")}<span class="tx"><b>${esc(nm(mp))}</b><small>${esc(o?.titolo || o?.sorgente || STATO()[S[mp].state] || "")}</small></span></button>`}
      ${giu ? `<button class="mpc1" data-act="mdK" data-k="volgiu" data-id="${mp}" aria-label="${t("Volume −", "Volume −")}">−</button>` : ""}${su ? `<button class="mpc1" data-act="mdK" data-k="volsu" data-id="${mp}" aria-label="${t("Volume +", "Volume +")}">+</button>` : ""}
      ${azione(c, "power") ? `<button class="md1pw on sm" data-act="mdK" data-k="power" data-id="${mp}" aria-label="${t("Spegni", "Turn off")}">⏻</button>` : ""}</div>`; }).join("")}</div>`, { link: ["Media", "media"] });
}
HOME_EXTRA.media = { title: () => t("Media", "Media"), render: homeCard, show: () => schermi().some(acceso) };

/* ---------- ✏️ un tasto con un comando tuo ---------- */
let ED = null;
const VIA = (c, cmd) => ({ script: t("avvia lo script", "runs the script"), remote: "remote.send_command · " + (c.rm || ""), webos: "webostv.button · " + (c.mp || ""), adb: "androidtv.adb_command · " + (c.mp || "") })[canale(c, cmd)] || "";
function foglioTasto() {
  const c = ctx(ED.id), k = ED.k, b = base(c, k), mio = proprio(c, k), via = canale(c, "X");
  return `<div class="sh-head"><div><h3>✏️ ${t("Tasto", "Key")} «${esc(NOMI()[k])}»</h3><div class="small muted">${esc(nm(c.k))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <p class="small muted">${b ? t("Comando di partenza: ", "Default command: ") + `<b class="mono">${esc(b)}</b>` : ["volsu", "volgiu", "muto", "power"].includes(k) && azione({ ...c, k: "" }, k) ? t("Di partenza uso i comandi del lettore (media_player).", "By default I use the player's own commands (media_player).") : t("Di partenza questo tasto non ha un comando.", "By default this key has no command.")}</p>
    <label class="fld1"><span>${t("Comando tuo", "Your command")}</span><input id="md1c" type="text" autocomplete="off" spellcheck="false" value="${esc(mio)}" placeholder="${esc(b || (via === "webos" ? "HOME" : via ? "KEY_…" : "script.…"))}"></label>
    <p class="small muted" style="margin-top:8px">${via ? t("Lo mando con ", "Sent with ") + `<span class="mono">${esc(VIA(c, "X"))}</span>. ` : t("Questo schermo non ha un telecomando in Home Assistant: ", "This screen has no remote in Home Assistant: ")}${t("Puoi anche scrivere uno script (script.nome) da avviare.", "You can also write a script (script.name) to run.")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="mdEdSalva">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="mdEdProva">▶ ${t("Prova", "Try")}</button>
      ${mio ? `<button class="btn bad" data-act="mdEdVia">↺ ${t("Torna a quello di partenza", "Back to default")}</button>` : ""}</div>`;
}
function salvaTasto(v) {
  const { id, k } = ED;
  cambia(l => { const T = JSON.parse(JSON.stringify(l.mdTasti || {})); T[id] = { ...(T[id] || {}) }; if (v) T[id][k] = v; else delete T[id][k]; if (!Object.keys(T[id]).length) delete T[id]; l.mdTasti = T; },
    v ? "💾 " + NOMI()[k] + " → " + v : "↺ " + NOMI()[k]);
}

Object.assign(ACT, {
  mdSel: el => { sSet("md_tv", el.dataset.id); render(true); },
  mdVai: el => { sSet("md_tv", el.dataset.id); go("media"); },
  mdK: el => { const f = azione(ctx(el.dataset.id), el.dataset.k); if (f) f(); },
  mdMp: el => svc("media_player", el.dataset.v, {}, { entity_id: el.dataset.id }),
  mdNum: () => { MD.num = !MD.num; render(true); },
  mdApp: el => { const c = ctx(el.dataset.id), x = (APPV[el.dataset.id] || [])[+el.dataset.i]; if (x) apri(c, x); },
  mdAtt: el => { vibra(); svc("remote", "turn_on", { activity: el.dataset.v }, { entity_id: el.dataset.id }).then(() => toast("▶ " + el.dataset.v)).catch(() => {}); },
  mdEd: el => { ED = { id: el.dataset.id, k: el.dataset.k }; openSheet(foglioTasto); setTimeout(() => document.getElementById("md1c")?.focus(), 80); },
  mdEdSalva: () => { const v = (document.getElementById("md1c")?.value || "").trim(); closeSheet(); salvaTasto(v); },
  mdEdVia: () => { closeSheet(); salvaTasto(""); },
  mdEdProva: () => { const v = (document.getElementById("md1c")?.value || "").trim() || base(ctx(ED.id), ED.k); const c = ctx(ED.id);
    if (!v) { const f = azione(c, ED.k); if (f) f(); return; }
    if (!canale(c, v)) { toast(t("Questo schermo non ha un telecomando in Home Assistant.", "This screen has no remote in Home Assistant."), true); return; }
    Promise.resolve(invia(c, v)).then(() => toast("▶ " + v)).catch(() => {}); },
});
CHG.mdVol = el => svc("media_player", "volume_set", { volume_level: +el.value / 100 }, { entity_id: el.dataset.id });
CHG.mdSrc = el => svc("media_player", "select_source", { source: el.value }, { entity_id: el.dataset.id });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "md1c") { e.preventDefault(); ACT.mdEdSalva(); } });
/* sul PC: frecce, Invio e ⌫ comandano lo schermo scelto (fuori dai campi di testo e dai fogli) */
document.addEventListener("keydown", e => {
  if (UI.page !== "media" || UI.sheet || UI.edit || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  const k = { ArrowUp: "su", ArrowDown: "giu", ArrowLeft: "sx", ArrowRight: "dx", Enter: "ok", Backspace: "indietro" }[e.key]; if (!k) return;
  if (e.key === "Enter" && e.target.closest?.("button,a")) return;   // Invio su un pulsante: lo preme
  const id = scelto(), f = id && azione(ctx(id), k); if (!f) return;
  e.preventDefault(); f();
});

page("media", { title: "Media", short: "Media", icon: "📺", order: 34, editable: true,
  show: () => chiavi().length > 0, badge: () => schermi().some(id => S[id]?.state === "playing"), render: pagina });

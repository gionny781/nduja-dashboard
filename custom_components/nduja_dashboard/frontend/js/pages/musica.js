/* Musica e TV: «Dove ascolti» (questo dispositivo, le casse, i gruppi), il lettore della plancia con il mini lettore in basso,
   «Sfoglia» con le copertine e, per Alexa, «Chiedi ad Alexa». Sotto, casse, TV e lettori per stanza.
   In Home la scheda «In riproduzione» mostra solo quello che sta suonando (anche su questo dispositivo). */
import { S, ACT, CHG, UI, REG, DEVICES, t, esc, nm, ok, attr, ents, areaOf, AREAS, areasSorted, card, empty, page, svc, ws, sGet, sSet,
  toast, render, cached, uncache, go, patch, FISSI } from "../core.js";
import { item, addBtn } from "../edit.js";

const F = { PAUSE: 1, SEEK: 2, VOL: 4, MUTE: 8, PREV: 16, NEXT: 32, ON: 128, OFF: 256, PLAY_MEDIA: 512, SOURCE: 2048, STOP: 4096, PLAY: 16384, SHUFFLE: 32768,
  SOUND: 65536, BROWSE: 131072, REPEAT: 262144 };
const ha = (id, f) => ((attr(id, "supported_features") || 0) & f) === f;
const acceso = id => ok(id) && !["off", "standby", "unavailable", "unknown"].includes(S[id].state);
const suona = id => S[id]?.state === "playing";
const tipo = id => { const d = String(attr(id, "device_class") || ""); return d === "tv" || /tv|televis|samsung|lg_|bravia|chromecast|fire|apple_tv|shield/i.test(id) ? "📺" : d === "speaker" || /echo|alexa|sonos|nest|home|speaker|cassa|google/i.test(id) ? "🔊" : "🎵"; };
const STATO = () => ({ playing: t("In riproduzione", "Playing"), paused: t("In pausa", "Paused"), idle: t("Acceso", "Idle"), on: t("Acceso", "On"), off: t("Spento", "Off"), standby: "Standby", buffering: t("Carica…", "Buffering…") });

function lettore(id, piccolo = false) {
  const a = S[id].attributes, on = acceso(id), img = a.entity_picture, vol = a.volume_level;
  const titolo = a.media_title || (on ? a.source || a.app_name || "" : ""), art = a.media_artist || a.media_album_name || a.media_series_title || "";
  const b = (act, ic, f, extra = "") => ha(id, f) ? `<button class="mpc1 ${extra}" data-act="${act}" data-id="${id}">${ic}</button>` : "";
  return `<div class="mpl1 ${on ? "on" : ""} ${suona(id) ? "play" : ""} ${piccolo ? "mini" : ""}">
    <div class="mpa1" style="${img ? `background-image:url('${esc(img)}')` : ""}">${img ? "" : `<span>${tipo(id)}</span>`}</div>
    <div class="mpt2"><div class="row between" style="gap:8px"><b>${esc(nm(id))}</b>${ha(id, F.ON) || ha(id, F.OFF) ? `<button class="sw ${on ? "on" : ""}" data-act="muPower" data-id="${id}" aria-label="${esc(nm(id))}"><i></i></button>` : ""}</div>
      <small>${esc(STATO()[S[id].state] || S[id].state)}${AREAS[areaOf(id)] && !piccolo ? " · " + esc(AREAS[areaOf(id)].name) : ""}</small>
      ${titolo ? `<div class="mpn1"><b>${esc(titolo)}</b>${art ? `<span>${esc(art)}</span>` : ""}</div>` : ""}
      ${on ? `<div class="mpk1">${b("muPrev", "⏮", F.PREV)}${ha(id, F.PAUSE) || ha(id, F.PLAY) ? `<button class="mpc1 big" data-act="muPlay" data-id="${id}">${suona(id) ? "⏸" : "▶"}</button>` : ""}${b("muNext", "⏭", F.NEXT)}
        ${!piccolo ? b("muShuffle", "🔀", F.SHUFFLE, a.shuffle ? "on" : "") + b("muRepeat", a.repeat === "one" ? "🔂" : "🔁", F.REPEAT, a.repeat && a.repeat !== "off" ? "on" : "") : ""}</div>
      ${ha(id, F.VOL) ? `<div class="mpv1">${ha(id, F.MUTE) ? `<button data-act="muMute" data-id="${id}">${a.is_volume_muted ? "🔇" : vol > .5 ? "🔊" : "🔉"}</button>` : "🔉"}<input type="range" min="0" max="100" value="${Math.round((vol || 0) * 100)}" data-chg="muVol" data-id="${id}"><em>${Math.round((vol || 0) * 100)}</em></div>` : ""}
      ${!piccolo && ha(id, F.SOURCE) && (a.source_list || []).length ? `<label class="fld1"><span>${t("Sorgente", "Source")}</span><select data-chg="muSrc" data-id="${id}">${(a.source_list || []).map(s => `<option ${a.source === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}
      ${!piccolo && ha(id, F.SOUND) && (a.sound_mode_list || []).length ? `<label class="fld1"><span>${t("Modalità audio", "Sound mode")}</span><select data-chg="muSound" data-id="${id}">${(a.sound_mode_list || []).map(s => `<option ${a.sound_mode === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}` : ""}
    </div></div>`;
}

const tutti = () => ents("media_player", id => !attr(id, "group_members") || attr(id, "group_members").length <= 1 || attr(id, "group_members")[0] === id);

/* ================= Dove ascolti ================= */
const piattaforma = id => REG[id]?.platform || "";
const isAlexa = id => piattaforma(id) === "alexa_media";
const MARCHE = { alexa_media: "Alexa", cast: "Google Cast", sonos: "Sonos", music_assistant: "Music Assistant", squeezebox: "Squeezebox", heos: "HEOS", bluesound: "Bluesound",
  linkplay: "LinkPlay", dlna_dmr: "DLNA", yamaha_musiccast: "MusicCast", bose: "Bose", soundtouch: "Bose", apple_tv: "Apple TV", kodi: "Kodi", plex: "Plex", jellyfin: "Jellyfin", spotify: "Spotify", forked_daapd: "OwnTone", mpd: "MPD" };
/** gruppi fissi: gruppi di Home Assistant (attributo entity_id), gruppi Google Cast, gruppi di altre integrazioni */
const isGruppo = id => Array.isArray(attr(id, "entity_id")) || piattaforma(id) === "group" || /\bgroup\b|gruppo/i.test(DEVICES[REG[id]?.device]?.model || "");
/** le casse a cui si può mandare musica dalla plancia */
const casse = () => ents("media_player", id => ha(id, F.PLAY_MEDIA)).sort((a, b) => nm(a).localeCompare(nm(b)));
export function dove() { const v = sGet("mu_dove"); return v && v !== "qui" && S[v] && casse().includes(v) ? v : "qui"; }
const questo = () => /iPad|Tablet/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ? t("questo tablet", "this tablet")
  : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? t("questo telefono", "this phone") : t("questo computer", "this computer");

function scelta() {
  const chi = dove(), C = casse(), G = C.filter(isGruppo), K = C.filter(id => !isGruppo(id)), b = brano();
  const chip = (id, ic, nome, sotto, attivo) => `<button class="mu1c ${chi === id ? "act" : ""} ${attivo ? "play" : ""}" data-act="mu1dove" data-id="${id}" aria-pressed="${chi === id}">
    <span class="ic">${ic}</span><span class="tx"><b>${esc(nome)}</b><small>${esc(sotto)}</small></span>${attivo ? eq() : ""}</button>`;
  const sottoCassa = id => suona(id) && attr(id, "media_title") ? "▶ " + attr(id, "media_title")
    : [isGruppo(id) ? t("Gruppo", "Group") : "", MARCHE[piattaforma(id)], AREAS[areaOf(id)]?.name].filter(Boolean).join(" · ") || STATO()[S[id].state] || S[id].state;
  const qui = chip("qui", "📱", t("Questo dispositivo", "This device"), b ? (QUI.stato === "play" ? "▶ " : "⏸ ") + b.titolo : questo(), QUI.stato === "play");
  /* prima questo dispositivo, poi le casse, poi i gruppi (👥), separati da una lineetta */
  const sep = `<span class="mu1sep" aria-hidden="true"></span>`, ch = L => L.map(id => chip(id, isGruppo(id) ? "👥" : tipo(id), nm(id), sottoCassa(id), suona(id))).join("");
  return card("🎧 " + t("Dove ascolti", "Where to listen"), `<div class="mu1cs">${[qui, ch(K), ch(G)].filter(Boolean).join(sep)}</div>`, { cls: "span3 mu1s" });
}
const eq = () => `<i class="mu1eq" aria-hidden="true"><b></b><b></b><b></b></i>`;

/* ================= lettore della plancia (questo dispositivo) ================= */
/* la coda: [{ id (media-source://…), titolo, sotto, img }] */
const QUI = { coda: [], i: -1, stato: "", err: "", attesa: false };   // stato: carica | play | pausa | fine | errore
const brano = () => QUI.coda[QUI.i] || null;
const AU = new Audio(); AU.preload = "auto";
/* un attimo di silenzio: su iPhone e iPad il suono si sblocca solo dentro il tocco, poi la plancia può cambiare brano da sola */
const SILENZIO = (() => { const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer), s = (o, x) => [...x].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  s(0, "RIFF"); v.setUint32(4, 36 + n, true); s(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); s(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
  let x = ""; b.forEach(c => x += String.fromCharCode(c)); return "data:audio/wav;base64," + btoa(x); })();
let sbloccato = false;
function sblocca() { if (sbloccato) return; sbloccato = true; try { AU.src = SILENZIO; AU.play().catch(() => {}); } catch {} }
/* su iPhone e iPad il volume del browser non si può cambiare (si usano i tasti del telefono) */
const volOk = (() => { try { const a = new Audio(); a.volume = .5; return a.volume === .5; } catch { return false; } })();
AU.volume = Math.min(1, Math.max(0, +(sGet("mu_vol") ?? 80) / 100));
const pulisci = s => String(s || "").replace(/\.(mp3|m4a|m4b|aac|flac|ogg|oga|opus|wav|wma|webm|aiff?)$/i, "").replace(/_/g, " ").trim();
const mmss = s => !isFinite(s) || s < 0 ? "" : Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const inDiretta = () => vero() && AU.duration === Infinity;

let tok = 0;
async function apri() {
  const b = brano(); if (!b) return;
  const mio = ++tok;
  Object.assign(QUI, { stato: "carica", err: "", attesa: false }); render(); sessione();
  try {
    /* indirizzo firmato valido 6 ore: serve anche per saltare avanti dopo un po' */
    const r = await ws({ type: "media_source/resolve_media", media_content_id: b.id, expires: 21600 })
      .catch(e => e?.code === "invalid_format" ? ws({ type: "media_source/resolve_media", media_content_id: b.id }) : Promise.reject(e));
    if (mio !== tok) return;
    AU.src = r.url;
    await AU.play();
  } catch (e) {
    if (mio !== tok) return;
    if (e?.name === "NotAllowedError") { QUI.stato = "pausa"; render(); sessione(); return; }   // il browser vuole un tocco: resta pronto su ▶
    errore(e?.message || e?.code || "");
  }
}
function errore(msg) {
  QUI.stato = "errore"; QUI.err = msg; render(); sessione();
  toast(t("Non riesco a suonare «", "Can't play «") + (brano()?.titolo || "") + "»" + (msg ? ": " + msg : ""), true);
}
function suonaQui(coda, i) { if (!coda.length) return; QUI.coda = coda; QUI.i = Math.max(0, Math.min(i, coda.length - 1)); apri(); }
function avanti(d) {
  if (d < 0 && AU.currentTime > 3 && !inDiretta()) { AU.currentTime = 0; return; }
  const j = QUI.i + d; if (j < 0 || j >= QUI.coda.length) { if (d > 0) { QUI.stato = "fine"; render(); sessione(); } else { AU.currentTime = 0; } return; }
  QUI.i = j; apri();
}
function playPausa() {
  if (!brano()) return;
  if (QUI.stato === "play") AU.pause();
  else if (QUI.stato === "fine" || QUI.stato === "errore" || !vero()) { if (QUI.stato === "fine") QUI.i = Math.min(QUI.i, QUI.coda.length - 1); apri(); }
  else AU.play().catch(e => errore(e?.message || ""));
}
function ferma() { tok++; AU.pause(); try { AU.removeAttribute("src"); AU.load(); } catch {} Object.assign(QUI, { coda: [], i: -1, stato: "", err: "" }); render(); sessione(); }
/** vero quando l'elemento audio ha un brano vero (non il silenzio usato per sbloccare il suono) */
const vero = () => !!AU.src && AU.src !== SILENZIO;
AU.addEventListener("playing", () => { if (!vero()) return; Object.assign(QUI, { stato: "play", attesa: false }); render(); sessione(); });
AU.addEventListener("pause", () => { if (vero() && QUI.stato === "play" && !AU.ended) { QUI.stato = "pausa"; render(); sessione(); } });
AU.addEventListener("waiting", () => { if (vero() && QUI.stato === "play") { QUI.attesa = true; render(); } });
AU.addEventListener("ended", () => { if (vero()) avanti(1); });
AU.addEventListener("error", () => { if (vero() && brano() && QUI.stato !== "") errore(AU.error?.code === 4 ? t("formato non supportato da questo browser", "format not supported by this browser") : ""); });
AU.addEventListener("loadedmetadata", () => { if (vero()) render(); });
AU.addEventListener("timeupdate", avanzamento);
/** aggiorna solo la barra e i minuti (senza ridisegnare la pagina a ogni secondo) */
function avanzamento() {
  if (!vero()) return;
  const c = AU.currentTime, d = AU.duration, p = isFinite(d) && d > 0 ? Math.min(100, c / d * 100) : 0;
  document.querySelectorAll("[data-mu1t]").forEach(el => { el.textContent = mmss(c); });
  document.querySelectorAll("input[data-mu1pos]").forEach(el => { if (!el.matches(":active")) { el.max = isFinite(d) ? d : 0; el.value = c; el.style.setProperty("--p", p + "%"); } });
  document.querySelectorAll(".mu1bar>i").forEach(el => { el.style.width = p + "%"; });
}
/* comandi sulla schermata di blocco e sulle cuffie */
function sessione() {
  try {
    const ms = navigator.mediaSession; if (!ms) return;
    const b = brano();
    if (!b) { ms.metadata = null; ms.playbackState = "none"; return; }
    const img = b.img ? copertina(b.img) : null;
    ms.metadata = new MediaMetadata({ title: b.titolo, artist: b.sotto || "'Nduja", artwork: img ? [{ src: new URL(img, location.href).href }] : [] });
    ms.playbackState = QUI.stato === "play" ? "playing" : "paused";
  } catch {}
}
try {
  const ms = navigator.mediaSession;
  ms?.setActionHandler("play", () => playPausa()); ms?.setActionHandler("pause", () => AU.pause());
  ms?.setActionHandler("previoustrack", () => avanti(-1)); ms?.setActionHandler("nexttrack", () => avanti(1));
  ms?.setActionHandler("seekto", e => { if (!inDiretta()) AU.currentTime = e.seekTime; });
} catch {}

/* disco disegnato per 'Nduja quando non c'è la copertina (gira mentre suona) */
const disco = gira => `<svg class="mu1d ${gira ? "gira" : ""}" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="mu1dg" cx="50%" cy="50%" r="50%">
  <stop offset="0" stop-color="#2a2d3a"/><stop offset="1" stop-color="#0d0f16"/></radialGradient><linearGradient id="mu1dl" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#ff6a3d"/><stop offset="1" stop-color="#bf5af2"/></linearGradient></defs>
  <circle cx="50" cy="50" r="48" fill="url(#mu1dg)"/>${[40, 34, 28].map(r => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`).join("")}
  <path d="M50 6a44 44 0 0 1 38 22" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="17" fill="url(#mu1dl)"/><path d="M50 40c3 0 6 4 6 9s-3 10-6 12c-3-2-6-7-6-12s3-9 6-9z" fill="rgba(255,255,255,.85)"/><circle cx="50" cy="50" r="2.2" fill="#0d0f16"/></svg>`;
function cop(img, gira, cls = "") {
  const u = img ? copertina(img) : null;
  return `<div class="mu1a ${cls}">${disco(gira)}${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>`;
}
function lettoreQui() {
  const b = brano();
  if (!b) return `<div class="mu1v">${cop(null, false, "big")}<p>${t("Scegli qualcosa da ascoltare in «Sfoglia»: la musica esce da ", "Pick something in «Browse»: the music plays on ")}${questo()}.</p></div>`;
  const play = QUI.stato === "play", d = vero() && QUI.stato !== "carica" ? AU.duration : NaN, c = isFinite(d) ? AU.currentTime || 0 : 0, live = inDiretta();
  const stato = QUI.stato === "carica" || QUI.attesa ? t("Carico…", "Loading…") : QUI.stato === "errore" ? "⚠️ " + t("Non si apre", "Can't open") : QUI.stato === "fine" ? t("Finito", "Finished") : "";
  const dopo = QUI.coda.slice(QUI.i + 1, QUI.i + 7);
  return `<div class="mu1q ${play ? "play" : ""}">${cop(b.img, play, "big")}
    <div class="mu1n"><b>${esc(b.titolo)}</b><span>${esc(b.sotto || "")}</span>${stato ? `<em>${stato}</em>` : ""}</div>
    ${live ? `<div class="mu1live">● ${t("In diretta", "Live")}</div>` : `<div class="mu1pr"><input type="range" min="0" max="${isFinite(d) ? d : 0}" step="0.1" value="${c}" data-mu1pos data-chg="mu1seek" aria-label="${t("Posizione", "Position")}" style="--p:${isFinite(d) && d > 0 ? c / d * 100 : 0}%">
      <div class="row between small muted"><span data-mu1t>${mmss(c)}</span><span>${mmss(d)}</span></div></div>`}
    <div class="mu1k"><button class="mpc1" data-act="mu1prev" aria-label="${t("Precedente", "Previous")}">⏮</button>
      <button class="mpc1 big" data-act="mu1play" aria-label="${play ? t("Pausa", "Pause") : t("Riproduci", "Play")}">${play ? "⏸" : "▶"}</button>
      <button class="mpc1" data-act="mu1next" aria-label="${t("Successivo", "Next")}" ${QUI.i >= QUI.coda.length - 1 ? "disabled" : ""}>⏭</button>
      <button class="mpc1" data-act="mu1stop" aria-label="${t("Ferma", "Stop")}">⏹</button></div>
    ${volOk ? `<div class="mpv1 mu1vo"><span>${AU.volume > .5 ? "🔊" : AU.volume > 0 ? "🔉" : "🔈"}</span><input type="range" min="0" max="100" value="${Math.round(AU.volume * 100)}" data-chg="mu1vol" data-mu1in aria-label="Volume"><em>${Math.round(AU.volume * 100)}</em></div>` : ""}
    ${dopo.length ? `<div class="mu1l">${t("Dopo", "Up next")}</div><div class="mu1co">${dopo.map((x, k) => `<button data-act="mu1coda" data-i="${QUI.i + 1 + k}"><span>${QUI.i + 2 + k}</span><b>${esc(x.titolo)}</b></button>`).join("")}${QUI.coda.length > QUI.i + 7 ? `<small>${t("e altri ", "and ")}${QUI.coda.length - QUI.i - 7}${t("", " more")}</small>` : ""}</div>` : ""}
  </div>`;
}
/** riga compatta (Home e mini lettore) */
function rigaQui(mini) {
  const b = brano(), play = QUI.stato === "play", d = vero() && QUI.stato !== "carica" ? AU.duration : NaN, p = isFinite(d) && d > 0 ? AU.currentTime / d * 100 : 0;
  return `<div class="mu1r ${play ? "play" : ""} ${mini ? "mini" : ""}">${mini ? `<div class="mu1bar"><i style="width:${p}%"></i></div>` : ""}
    <button class="mu1rt" data-act="mu1vai">${cop(b.img, play, "sm")}<span class="tx"><b>${esc(b.titolo)}</b><small>${play ? eq() : ""}📱 ${esc(b.sotto || t("Questo dispositivo", "This device"))}</small></span></button>
    <button class="mpc1 mu1hp" data-act="mu1prev" aria-label="${t("Precedente", "Previous")}">⏮</button><button class="mpc1 big" data-act="mu1play" aria-label="${play ? t("Pausa", "Pause") : t("Riproduci", "Play")}">${play ? "⏸" : "▶"}</button>
    <button class="mpc1" data-act="mu1next" aria-label="${t("Successivo", "Next")}">⏭</button>${mini ? `<button class="mpc1 mu1x" data-act="mu1stop" aria-label="${t("Chiudi", "Close")}">✕</button>` : ""}</div>`;
}
/* mini lettore in basso: resta quando si cambia pagina (non serve solo dove il lettore è già grande) */
/* sulla pagina Musica compare solo quando il lettore grande esce dallo schermo (sul telefono, scorrendo verso «Sfoglia») */
const grandeInVista = () => { const g = document.querySelector("#main .mu1q"); if (!g) return false; const r = g.getBoundingClientRect(); return r.bottom > 80 && r.top < innerHeight - 80; };
function mini() {
  let el = document.getElementById("mu1mini");
  const via = !brano() || UI.page === "benvenuto" || (UI.page === "musica" && dove() === "qui" && grandeInVista());
  document.body.classList.toggle("mu1on", !via);
  if (via) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "mu1mini"; el.className = "mu1m"; el.setAttribute("role", "region"); el.setAttribute("aria-label", t("Lettore", "Player")); document.body.appendChild(el); }
  patch(el, rigaQui(true));
}
FISSI.push(mini);
let scorri = false;
window.addEventListener("scroll", () => { if (scorri || UI.page !== "musica" || !brano()) return; scorri = true; requestAnimationFrame(() => { scorri = false; mini(); }); }, { passive: true });

/* ================= Sfoglia ================= */
const SIG = {};
/** le copertine di Home Assistant (indirizzi che iniziano con «/») vogliono l'accesso: uso un indirizzo firmato */
function copertina(u) {
  if (!u || !u.startsWith("/") || /[?&](token|authSig)=/.test(u)) return u || null;
  return cached("musig:" + u, 20 * 3600e3, () => ws({ type: "auth/sign_path", path: u, expires: 86400 }).then(r => r.path)) || null;
}
const BR = { chi: null, pila: [], quanti: 120 };
let VISTI = [], NODO = null;
const usaCassa = chi => chi !== "qui" && ha(chi, F.BROWSE);
const puoSfogliare = chi => chi === "qui" || ha(chi, F.BROWSE) || (ha(chi, F.PLAY_MEDIA) && !isAlexa(chi));
/* sulla plancia e sulle casse senza un loro elenco uso i media di Home Assistant: solo quello che si ascolta */
const NO_AUDIO = ["image", "video", "movie", "tv_show", "season"];
const ascoltabile = c => !NO_AUDIO.includes(c.media_class) && !/^(image|video)\//.test(c.media_content_type || "")
  && !(c.can_expand && NO_AUDIO.includes(c.children_media_class)) && !/^media-source:\/\/(tts|camera|image_upload)\b/.test(c.media_content_id || "");
function sfoglia(chi, nodo) {
  const k = "mub:" + chi + ":" + (nodo ? nodo.type + "|" + nodo.id : "");
  return cached(k, 5 * 60000, () => (usaCassa(chi)
    ? ws({ type: "media_player/browse_media", entity_id: chi, ...(nodo ? { media_content_id: nodo.id, media_content_type: nodo.type } : {}) })
    : ws({ type: "media_source/browse_media", ...(nodo ? { media_content_id: nodo.id } : {}) })).catch(e => ({ errore: e?.message || e?.code || String(e) })));
}
const ICONE = { directory: "📁", album: "💿", artist: "🎤", contributing_artist: "🎤", playlist: "📃", track: "🎵", music: "🎵", podcast: "🎙️", episode: "🎧", channel: "📻",
  app: "🧩", genre: "🏷️", composer: "🎼", url: "🔗", video: "🎬", movie: "🎬", tv_show: "📺", season: "📺", game: "🎮", image: "🖼️" };
const CLASSI = () => ({ directory: t("Cartella", "Folder"), album: "Album", artist: t("Artista", "Artist"), playlist: "Playlist", track: t("Brano", "Track"), music: t("Brano", "Track"),
  podcast: "Podcast", episode: t("Puntata", "Episode"), channel: "Radio", app: "App", genre: t("Genere", "Genre"), composer: t("Compositore", "Composer") });
/* le fonti di Home Assistant in cima a «Sfoglia» */
const FONTI = () => [[/^media-source:\/\/media_source\b/, "🗂️", t("I tuoi file", "Your files")], [/^media-source:\/\/radio_browser\b/, "📻", "Radio"], [/^media-source:\/\/music_assistant\b/, "🎶", "Music Assistant"],
  [/^media-source:\/\/dlna_dms\b/, "🖧", "DLNA"], [/^media-source:\/\/(jellyfin|plex|emby)\b/, "🎞️", t("Libreria", "Library")], [/^media-source:\/\/xbox\b/, "🎮", "Xbox"]];
const fonte = c => FONTI().find(([r]) => r.test(c.media_content_id || ""));
const radiceNome = chi => chi === "qui" ? t("Tutto", "All") : nm(chi);
function cardSfoglia(chi) {
  if (BR.chi !== chi) Object.assign(BR, { chi, pila: [], quanti: 120 });
  const nodo = BR.pila[BR.pila.length - 1] || null, r = sfoglia(chi, nodo);
  const briciole = `<div class="mu1cr"><button data-act="mu1cr" data-i="0">🏠 ${esc(radiceNome(chi))}</button>${BR.pila.map((n, i) => `<span>›</span><button data-act="mu1cr" data-i="${i + 1}">${esc(n.title)}</button>`).join("")}</div>`;
  let corpo;
  if (!r) corpo = `<div class="mu1w">${t("Carico…", "Loading…")}</div>`;
  else if (r.errore) corpo = `${empty(t("Non riesco ad aprire questa cartella: ", "I can't open this folder: ") + esc(r.errore))}<button class="btn sm" data-act="mu1riprova">↻ ${t("Riprova", "Try again")}</button>`;
  else {
    const filtra = !usaCassa(chi), L = (r.children || []).filter(c => !filtra || ascoltabile(c));
    VISTI = L; NODO = r;
    const suonabili = L.filter(c => c.can_play && !c.can_expand), cassa = chi !== "qui";
    const azioni = [
      chi === "qui" && suonabili.length > 1 && !suonabili.every(c => c.media_class === "channel") ? `<button class="btn sm pri" data-act="mu1tutto">▶ ${t("Riproduci tutto", "Play all")}</button><button class="btn sm" data-act="mu1tutto" data-v="1">🔀 ${t("Casuale", "Shuffle")}</button>` : "",
      nodo && r.can_play && (cassa || !suonabili.length) ? `<button class="btn sm pri" data-act="mu1su" data-i="-1">▶ ${t("Riproduci", "Play")} «${esc(r.title)}»</button>` : ""].join("");
    const tessera = (c, i) => {
      const fo = !nodo && fonte(c), ic = fo ? fo[1] : ICONE[c.media_class] || (c.can_expand ? "📁" : "🎵"), u = copertina(c.thumbnail), cls = fo ? fo[2] : CLASSI()[c.media_class] || "";
      const ora = chi === "qui" && brano()?.id === c.media_content_id;
      return `<div class="mu1t ${ora ? "ora" : ""}"><button class="mu1tb" data-act="${c.can_expand ? "mu1apri" : "mu1su"}" data-i="${i}" ${!c.can_expand && !c.can_play ? "disabled" : ""}>
        <span class="mu1ti"><span>${ic}</span>${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${!c.can_expand && c.can_play ? `<i class="mu1pl">${ora && QUI.stato === "play" ? eq() : "▶"}</i>` : ""}</span>
        <b>${esc(pulisci(c.title))}</b>${cls ? `<small>${cls}</small>` : ""}</button>
        ${c.can_expand && c.can_play ? `<button class="mu1tp" data-act="mu1su" data-i="${i}" aria-label="${t("Riproduci", "Play")} ${esc(c.title)}">▶</button>` : ""}</div>`;
    };
    /* dentro un album, una playlist o un elenco di radio: righe come in un lettore, non tessere */
    const riga = (c, i) => {
      const ora = chi === "qui" && brano()?.id === c.media_content_id, u = copertina(c.thumbnail), cls = CLASSI()[c.media_class] || "";
      return `<button class="mu1lr ${ora ? "ora" : ""}" data-act="mu1su" data-i="${i}" ${c.can_play ? "" : "disabled"}><span class="n">${ora && QUI.stato === "play" ? eq() : i + 1}</span>
        ${u ? `<span class="mu1ti sm"><span>${ICONE[c.media_class] || "🎵"}</span><img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()"></span>` : ""}
        <span class="tx"><b>${esc(pulisci(c.title))}</b>${cls ? `<small>${cls}</small>` : ""}</span><span class="pl" aria-hidden="true">▶</span></button>`;
    };
    const lista = !!nodo && L.length > 0 && L.every(c => !c.can_expand);
    corpo = `${azioni ? `<div class="row mu1az">${azioni}</div>` : ""}
      ${L.length ? lista ? `<div class="mu1li">${L.slice(0, BR.quanti).map(riga).join("")}</div>` : `<div class="mu1b">${L.slice(0, BR.quanti).map(tessera).join("")}</div>` : empty(nodo ? t("Qui non c'è niente da ascoltare.", "Nothing to listen to here.") : chi === "qui"
        ? t("Non ho trovato musica in Home Assistant. Metti i file nella cartella «media» (Impostazioni → Sistema → Archiviazione) oppure aggiungi l'integrazione Radio Browser.", "No music found in Home Assistant. Put files in the «media» folder (Settings → System → Storage) or add the Radio Browser integration.")
        : t("Questa cassa non ha niente da sfogliare.", "This speaker has nothing to browse."))}
      ${L.length > BR.quanti ? `<button class="btn sm" data-act="mu1altri" style="margin-top:10px">${t("Mostra altri ", "Show ")}${Math.min(120, L.length - BR.quanti)}${t("", " more")}</button>` : ""}
      ${r.not_shown ? `<div class="small muted" style="margin-top:8px">${t("Altri ", "Another ")}${r.not_shown}${t(" elementi non sono mostrati dalla cassa.", " items are not shown by the speaker.")}</div>` : ""}`;
  }
  return card("📂 " + t("Sfoglia", "Browse"), briciole + corpo, { cls: "mu1sf", right: chi !== "qui" ? `<span class="small muted">${t("suona su ", "plays on ")}${esc(nm(chi))}</span>` : "" });
}
const voce = (c, padre) => ({ id: c.media_content_id, titolo: pulisci(c.title), sotto: padre?.title || "", img: c.thumbnail || padre?.thumbnail || null });
/** ▶ su un album o una cartella: suono i brani che contiene */
async function suonaCartella(c) {
  try {
    const r = await ws({ type: "media_source/browse_media", media_content_id: c.media_content_id });
    const L = (r.children || []).filter(x => ascoltabile(x) && x.can_play && !x.can_expand).map(x => voce(x, r));
    if (L.length) suonaQui(L, 0); else if (c.can_play) suonaQui([voce(c, NODO)], 0); else toast(t("Qui non c'è niente da ascoltare.", "Nothing to listen to here."));
  } catch (e) { toast(t("Non riesco ad aprire «", "I can't open «") + pulisci(c.title) + "»", true); }
}
function suonaSu(chi, c) {
  if (chi === "qui") return;
  svc("media_player", "play_media", { media_content_id: c.media_content_id, media_content_type: c.media_content_type || "music" }, { entity_id: chi })
    .then(() => toast("▶ " + pulisci(c.title) + " · " + nm(chi))).catch(() => {});
}

/* ================= Alexa: chiedi con i tipi che Alexa capisce ================= */
const SERVIZI = () => [["AMAZON_MUSIC", "Amazon Music"], ["SPOTIFY", "Spotify"], ["APPLE_MUSIC", "Apple Music"], ["DEEZER", "Deezer"], ["TUNEIN", t("Radio (TuneIn)", "Radio (TuneIn)")],
  ["IHEARTRADIO", "iHeartRadio"], ["custom", t("🗣️ A voce", "🗣️ Voice")]];
const servizio = () => { const v = sGet("mu_alexa"); return SERVIZI().some(s => s[0] === v) ? v : "AMAZON_MUSIC"; };
function chiediAlexa(id) {
  const s = servizio();
  return `<div class="mu1ax"><b>🗣️ ${t("Chiedi ad Alexa", "Ask Alexa")}</b>
    <small>${s === "custom" ? t("Scrivi quello che diresti ad Alexa, per esempio «metti musica rilassante».", "Write what you'd say to Alexa, for example «play relaxing music».") : t("Artista, brano, playlist o radio: lo cerca Alexa su ", "Artist, song, playlist or station: Alexa looks for it on ") + esc(SERVIZI().find(x => x[0] === s)[1]) + "."}</small>
    <div class="mu1axs">${SERVIZI().map(([k, n]) => `<button class="${k === s ? "act" : ""}" data-act="mu1axs" data-v="${k}">${esc(n)}</button>`).join("")}</div>
    <div class="row mu1axf"><input id="mu1axq" type="search" enterkeyhint="go" autocomplete="off" placeholder="${s === "custom" ? t("metti musica rilassante", "play relaxing music") : s === "TUNEIN" ? "Radio Deejay, RTL 102.5…" : "Queen, Vasco Rossi, Lo-fi…"}">
      <button class="btn pri" data-act="mu1ax" data-id="${id}">▶ ${t("Suona", "Play")}</button></div></div>`;
}

/* ================= pagina ================= */
function cardCassa(id) {
  const nota = !puoSfogliare(id) && !isAlexa(id) ? `<div class="small muted" style="margin-top:10px">${t("Da questa cassa non si può scegliere la musica dalla plancia: usa la sua app, poi la comandi da qui.", "This speaker doesn't let the dashboard choose the music: use its app, then control it from here.")}</div>` : "";
  /* senza «Sfoglia» la scheda è larga: il lettore e «Chiedi ad Alexa» stanno affiancati */
  return card((isGruppo(id) ? "👥 " : tipo(id) + " ") + esc(nm(id)), `<div class="${puoSfogliare(id) ? "" : "mu1two"}">${lettore(id)}${isAlexa(id) ? chiediAlexa(id) : ""}</div>${nota}`, { cls: "mu1p" });
}
function pagina() {
  const chi = dove(), L = tutti(), g = {};
  L.forEach(id => (g[AREAS[areaOf(id)] ? areaOf(id) : "_"] = g[AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
  const ord = [...areasSorted().filter(a => g[a]), ...(g._ ? ["_"] : [])].filter(a => UI.edit || g[a].some(id => !suona(id)));
  const play = L.filter(suona).filter(id => id !== chi);
  return `<div class="g g3">
    ${scelta()}
    <div class="span3 mu1g ${puoSfogliare(chi) ? "" : "solo"}">${chi === "qui" ? card("📱 " + t("Questo dispositivo", "This device"), lettoreQui(), { cls: "mu1p" }) : cardCassa(chi)}${puoSfogliare(chi) ? cardSfoglia(chi) : ""}</div>
    ${play.length ? card("🎶 " + t("In riproduzione", "Now playing"), `<div class="mpg2">${play.map(id => lettore(id)).join("")}</div>`, { cls: "span3" }) : ""}
    ${ord.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name), `<div class="stack">${g[a].filter(id => !suona(id)).map(id => item(id, lettore(id))).join("") || `<div class="small muted">${t("Sta suonando qui sopra.", "Playing above.")}</div>`}${addBtn(["media_player"], { area: a === "_" ? "" : a })}</div>`)).join("")}
    ${!L.length && UI.edit ? card("🎵 " + t("Musica e TV", "Music and TV"), empty(t("Nessun lettore multimediale.", "No media player.")) + addBtn(["media_player"], { big: true }), { cls: "span3" }) : ""}
  </div>`;
}
/** scheda Home: solo quello che suona adesso (anche su questo dispositivo) */
export function musicaCard() {
  const P = tutti().filter(suona), q = brano() && QUI.stato !== "fine";
  if (!P.length && !q) return "";
  return card("🎶 " + t("In riproduzione", "Now playing"), `<div class="stack">${q ? rigaQui(false) : ""}${P.slice(0, q ? 2 : 3).map(id => lettore(id, true)).join("")}</div>`, { link: [t("Musica", "Music"), "musica"] });
}
/* la pagina serve se ci sono lettori oppure musica da ascoltare su questo dispositivo (file in «media», radio…) */
const fonti = () => cached("mu:fonti", 30 * 60000, async () => {
  const r = await ws({ type: "media_source/browse_media" });
  const L = (r.children || (r.can_expand ? [] : [r])).filter(ascoltabile);
  for (const c of L) {
    if (!/^media-source:\/\/media_source\b/.test(c.media_content_id || "")) return true;   // radio e altre fonti: c'è sempre qualcosa
    const x = await ws({ type: "media_source/browse_media", media_content_id: c.media_content_id }).catch(() => null);
    if ((x?.children || []).some(ascoltabile)) return true;
  }
  return false;
}) === true;

Object.assign(ACT, {
  muPlay: el => svc("media_player", "media_play_pause", {}, { entity_id: el.dataset.id }),
  muPrev: el => svc("media_player", "media_previous_track", {}, { entity_id: el.dataset.id }),
  muNext: el => svc("media_player", "media_next_track", {}, { entity_id: el.dataset.id }),
  muPower: el => svc("media_player", acceso(el.dataset.id) ? "turn_off" : "turn_on", {}, { entity_id: el.dataset.id }),
  muMute: el => svc("media_player", "volume_mute", { is_volume_muted: !attr(el.dataset.id, "is_volume_muted") }, { entity_id: el.dataset.id }),
  muShuffle: el => svc("media_player", "shuffle_set", { shuffle: !attr(el.dataset.id, "shuffle") }, { entity_id: el.dataset.id }),
  muRepeat: el => { const r = attr(el.dataset.id, "repeat"); svc("media_player", "repeat_set", { repeat: r === "off" ? "all" : r === "all" ? "one" : "off" }, { entity_id: el.dataset.id }); },
  /* dove ascolti */
  mu1dove: el => { sSet("mu_dove", el.dataset.id); render(true); },
  /* sfoglia */
  mu1apri: el => { const c = VISTI[+el.dataset.i]; if (!c) return; BR.pila.push({ id: c.media_content_id, type: c.media_content_type, title: pulisci(c.title) }); BR.quanti = 120; render(true); },
  mu1cr: el => { BR.pila.length = +el.dataset.i; BR.quanti = 120; render(true); },
  mu1altri: () => { BR.quanti += 120; render(true); },
  mu1riprova: () => { uncache("mub:"); render(true); },
  mu1su: el => {
    const chi = dove(), i = +el.dataset.i, c = i < 0 ? NODO : VISTI[i]; if (!c) return;
    if (chi !== "qui") return suonaSu(chi, c);
    sblocca();
    if (i < 0) { suonaQui([voce(NODO, null)], 0); return; }
    if (c.can_expand) { suonaCartella(c); return; }
    const L = VISTI.filter(x => x.can_play && !x.can_expand);
    suonaQui(L.map(x => voce(x, NODO)), L.indexOf(c));
  },
  mu1tutto: el => {
    sblocca();
    const L = VISTI.filter(x => x.can_play && !x.can_expand).map(x => voce(x, NODO));
    if (el.dataset.v) for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    suonaQui(L, 0);
  },
  /* lettore della plancia */
  mu1play: () => { sblocca(); playPausa(); },
  mu1prev: () => { sblocca(); avanti(-1); },
  mu1next: () => { sblocca(); avanti(1); },
  mu1stop: () => ferma(),
  mu1coda: el => { sblocca(); QUI.i = +el.dataset.i; apri(); },
  mu1vai: () => { sSet("mu_dove", "qui"); go("musica"); },
  /* Alexa */
  mu1axs: el => { sSet("mu_alexa", el.dataset.v); render(true); setTimeout(() => document.getElementById("mu1axq")?.focus(), 50); },
  mu1ax: el => {
    const id = el.dataset.id, q = (document.getElementById("mu1axq")?.value || "").trim(), s = servizio();
    if (!q) { document.getElementById("mu1axq")?.focus(); return; }
    svc("media_player", "play_media", { media_content_id: q, media_content_type: s }, { entity_id: id })
      .then(() => { toast("🗣️ " + q + " · " + nm(id)); const i = document.getElementById("mu1axq"); if (i) i.value = ""; }).catch(() => {});
  },
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "mu1axq") { e.preventDefault(); document.querySelector('[data-act="mu1ax"]')?.click(); } });
/* volume della plancia: segue il dito mentre si trascina */
document.addEventListener("input", e => { if (e.target.matches?.("[data-mu1in]")) { AU.volume = +e.target.value / 100; const em = e.target.nextElementSibling; if (em) em.textContent = e.target.value; } });
CHG.mu1vol = el => { AU.volume = +el.value / 100; sSet("mu_vol", el.value); render(); };
CHG.mu1seek = el => { if (!inDiretta() && isFinite(AU.duration)) AU.currentTime = +el.value; };
CHG.muVol = el => svc("media_player", "volume_set", { volume_level: +el.value / 100 }, { entity_id: el.dataset.id });
CHG.muSrc = el => svc("media_player", "select_source", { source: el.value }, { entity_id: el.dataset.id });
CHG.muSound = el => svc("media_player", "select_sound_mode", { sound_mode: el.value }, { entity_id: el.dataset.id });

page("musica", { title: t("Musica e TV", "Music and TV"), short: t("Musica", "Music"), icon: "🎵", order: 33, editable: true,
  show: () => ents("media_player").length > 0 || !!brano() || fonti(), badge: () => tutti().some(suona) || QUI.stato === "play", render: pagina });

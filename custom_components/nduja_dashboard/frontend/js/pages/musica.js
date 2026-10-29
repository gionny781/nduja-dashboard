/* Musica e TV: «Dove ascolti» (questo dispositivo, le casse, i gruppi), il lettore della plancia con il mini lettore in basso,
   «Sfoglia» con le copertine e, per Alexa, «Chiedi ad Alexa». Con Music Assistant: ricerca, riproduzione (anche «radio») e coda.
   «Sposta su…» passa la musica da una cassa all'altra; i «Preferiti» (playlist e radio) valgono per tutta la casa.
   Sotto, casse e lettori per stanza (le TV stanno nella pagina Media, se c'è: vedi tvInMedia in core.js).
   In Home la scheda «In riproduzione» mostra solo quello che sta suonando (anche su questo dispositivo). */
import { S, ACT, CHG, UI, REG, DEVICES, LAYOUT, t, esc, nm, ok, attr, ents, areaOf, AREAS, areasSorted, card, empty, page, svc, svcResp, ws, sGet, sSet,
  toast, render, cached, uncache, go, patch, FISSI, isAdmin, openSheet, closeSheet, PAGES, isTV, tvInMedia } from "../core.js";
import { item, addBtn, cambia } from "../edit.js";

const F = { PAUSE: 1, SEEK: 2, VOL: 4, MUTE: 8, PREV: 16, NEXT: 32, ON: 128, OFF: 256, PLAY_MEDIA: 512, SOURCE: 2048, STOP: 4096, PLAY: 16384, SHUFFLE: 32768,
  SOUND: 65536, BROWSE: 131072, REPEAT: 262144, ENQUEUE: 2097152 };
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
      ${!piccolo && ha(id, F.SOUND) && (a.sound_mode_list || []).length ? `<label class="fld1"><span>${t("Modalità audio", "Sound mode")}</span><select data-chg="muSound" data-id="${id}">${(a.sound_mode_list || []).map(s => `<option ${a.sound_mode === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}
      ${!piccolo && (suona(id) || S[id].state === "paused") && destinazioni(id).length ? bottoneSposta(id) : ""}` : ""}
    </div></div>`;
}

/* le TV stanno nella pagina Media (se c'è): qui restano le casse */
const tutti = () => { const tv = tvInMedia(); return ents("media_player", id => (!attr(id, "group_members") || attr(id, "group_members").length <= 1 || attr(id, "group_members")[0] === id) && !(tv && isTV(id))); };

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
  /* le TV passate in Media non compaiono tra le casse, tranne quella già scelta qui (la scelta resta) */
  const tv = tvInMedia(), chi = dove(), C = casse().filter(id => !tv || !isTV(id) || id === chi), G = C.filter(isGruppo), K = C.filter(id => !isGruppo(id)), b = brano();
  const chip = (id, ic, nome, sotto, attivo) => `<button class="mu1c ${chi === id ? "act" : ""} ${attivo ? "play" : ""}" data-act="mu1dove" data-id="${id}" aria-pressed="${chi === id}">
    <span class="ic">${ic}</span><span class="tx"><b>${esc(nome)}</b><small>${esc(sotto)}</small></span>${attivo ? eq() : ""}</button>`;
  const sottoCassa = id => suona(id) && attr(id, "media_title") ? "▶ " + attr(id, "media_title")
    : [isGruppo(id) ? t("Gruppo", "Group") : "", MARCHE[piattaforma(id)], AREAS[areaOf(id)]?.name].filter(Boolean).join(" · ") || STATO()[S[id].state] || S[id].state;
  const qui = chip("qui", "📱", t("Questo dispositivo", "This device"), b ? (QUI.stato === "play" ? "▶ " : "⏸ ") + b.titolo : questo(), QUI.stato === "play");
  /* prima questo dispositivo, poi le casse, poi i gruppi (👥), separati da una lineetta */
  const sep = `<span class="mu1sep" aria-hidden="true"></span>`, ch = L => L.map(id => chip(id, isGruppo(id) ? "👥" : tipo(id), nm(id), sottoCassa(id), suona(id))).join("");
  /* senza Music Assistant: una riga discreta per chi può installarla */
  const consiglio = !haMA() && isAdmin() ? `<div class="ma1h">🎶 ${t("Per cercare e ascoltare da Spotify, Apple Music, radio… installa Music Assistant.", "To search and listen from Spotify, Apple Music, radio… install Music Assistant.")}
    <a href="https://www.home-assistant.io/integrations/music_assistant/" target="_blank" rel="noopener noreferrer">${t("Come si fa", "How to")} ↗</a></div>` : "";
  return card("🎧 " + t("Dove ascolti", "Where to listen"), `<div class="mu1cs">${[qui, ch(K), ch(G)].filter(Boolean).join(sep)}</div>${consiglio}`, { cls: "span3 mu1s" });
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
    ${destinazioni("qui").length ? bottoneSposta("qui") : ""}
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
      nodo && r.can_play && (cassa || !suonabili.length) ? `<button class="btn sm pri" data-act="mu1su" data-i="-1">▶ ${t("Riproduci", "Play")} «${esc(r.title)}»</button>` : "",
      nodo && isAdmin() && preferibile(r) ? stella(chi, r, -1, true) : ""].join("");
    const tessera = (c, i) => {
      const fo = !nodo && fonte(c), ic = fo ? fo[1] : ICONE[c.media_class] || (c.can_expand ? "📁" : "🎵"), u = copertina(c.thumbnail), cls = fo ? fo[2] : CLASSI()[c.media_class] || "";
      const ora = chi === "qui" && brano()?.id === c.media_content_id;
      return `<div class="mu1t ${ora ? "ora" : ""}"><button class="mu1tb" data-act="${c.can_expand ? "mu1apri" : "mu1su"}" data-i="${i}" ${!c.can_expand && !c.can_play ? "disabled" : ""}>
        <span class="mu1ti"><span>${ic}</span>${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${!c.can_expand && c.can_play ? `<i class="mu1pl">${ora && QUI.stato === "play" ? eq() : "▶"}</i>` : ""}</span>
        <b>${esc(pulisci(c.title))}</b>${cls ? `<small>${cls}</small>` : ""}</button>
        ${c.can_expand && c.can_play ? `<button class="mu1tp" data-act="mu1su" data-i="${i}" aria-label="${t("Riproduci", "Play")} ${esc(c.title)}">▶</button>` : ""}${isAdmin() && preferibile(c) ? stella(chi, c, i) : ""}</div>`;
    };
    /* dentro un album, una playlist o un elenco di radio: righe come in un lettore, non tessere */
    const riga = (c, i) => {
      const ora = chi === "qui" && brano()?.id === c.media_content_id, u = copertina(c.thumbnail), cls = CLASSI()[c.media_class] || "";
      return `<div class="mu1lw"><button class="mu1lr ${ora ? "ora" : ""}" data-act="mu1su" data-i="${i}" ${c.can_play ? "" : "disabled"}><span class="n">${ora && QUI.stato === "play" ? eq() : i + 1}</span>
        ${u ? `<span class="mu1ti sm"><span>${ICONE[c.media_class] || "🎵"}</span><img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()"></span>` : ""}
        <span class="tx"><b>${esc(pulisci(c.title))}</b>${cls ? `<small>${cls}</small>` : ""}</span><span class="pl" aria-hidden="true">▶</span></button>${isAdmin() && preferibile(c) ? stella(chi, c, i) : ""}</div>`;
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
const voce = (c, padre) => ({ id: c.media_content_id, titolo: pulisci(c.title), sotto: padre?.title || "", img: c.thumbnail || padre?.thumbnail || null, tipo: c.media_content_type || "" });
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

/* ================= Music Assistant: ricerca, riproduzione e coda ================= */
const isMA = id => piattaforma(id) === "music_assistant";
/** Music Assistant è installata: c'è la sua piattaforma tra le entità */
const haMA = () => Object.values(REG).some(r => r.platform === "music_assistant");
const casseMA = () => casse().filter(isMA);
/** la cassa di Music Assistant che suona: quella di «Dove ascolti» se è di Music Assistant, altrimenti quella scelta qui
    (o la sua gemella in Music Assistant, con lo stesso nome o nella stessa stanza) */
function cassaMA() {
  const C = casseMA(), chi = dove(); if (!C.length) return null;
  if (C.includes(chi)) return chi;
  const s = sGet("mu_ma"); if (C.includes(s)) return s;
  if (chi !== "qui") { const n = nm(chi).toLowerCase(), g = C.find(id => nm(id).toLowerCase() === n) || C.find(id => areaOf(id) && areaOf(id) === areaOf(chi)); if (g) return g; }
  return C.find(suona) || C[0];
}
/* la ricerca vuole l'istanza di Music Assistant (config_entry_id): la prendo dal registro di una sua entità */
const ISTANZA = {};
async function istanzaMA(pid) {
  const id = pid || Object.keys(REG).find(x => REG[x].platform === "music_assistant") || "";
  if (ISTANZA[id]) return ISTANZA[id];
  const e = id ? await ws({ type: "config/entity_registry/get", entity_id: id }).catch(() => null) : null;
  let v = e?.config_entry_id || "";
  if (!v) { const L = await ws({ type: "config_entries/get", domain: "music_assistant" }).catch(() => []) || []; v = ((L.find?.(x => x.state === "loaded")) || L[0])?.entry_id || ""; }
  if (v) ISTANZA[id] = v;
  return v;
}
const TIPI_MA = () => [["", t("Tutto", "All")], ["track", t("Brani", "Tracks")], ["artist", t("Artisti", "Artists")], ["album", "Album"], ["playlist", "Playlist"], ["radio", "Radio"]];
const GRUPPI_MA = [["track", "tracks"], ["artist", "artists"], ["album", "albums"], ["playlist", "playlists"], ["radio", "radio"]];
const ICONE_MA = { track: "🎵", artist: "🎤", album: "💿", playlist: "📃", radio: "📻" };
const MAS = { q: "", tipo: "", res: null, fatta: "", carica: false, err: "", voci: [] };
let cercaTok = 0;
async function cercaMA() {
  const q = MAS.q.trim(); if (!q) { document.getElementById("ma1q")?.focus(); return; }
  const mio = ++cercaTok; Object.assign(MAS, { carica: true, err: "" }); render(true);
  try {
    const ce = await istanzaMA(cassaMA());
    if (!ce) throw new Error(t("non trovo Music Assistant", "Music Assistant not found"));
    const r = await svcResp("music_assistant", "search", { config_entry_id: ce, name: q, media_type: MAS.tipo ? [MAS.tipo] : GRUPPI_MA.map(g => g[0]), limit: MAS.tipo ? 24 : 8 });
    if (mio !== cercaTok) return;
    Object.assign(MAS, { res: r || {}, fatta: q });
  } catch (e) { if (mio !== cercaTok) return; Object.assign(MAS, { res: null, err: e?.message || e?.code || String(e) }); }
  MAS.carica = false; render(true);
}
const artistiMA = x => (x?.artists || []).map(a => a?.name).filter(Boolean).join(", ");
function sottoMA(x) {
  const T = { track: t("Brano", "Track"), artist: t("Artista", "Artist"), album: "Album", playlist: "Playlist", radio: "Radio" };
  return [x.media_type === "artist" || x.media_type === "radio" ? T[x.media_type] : artistiMA(x) || T[x.media_type], x.media_type === "track" ? x.album?.name : ""].filter(Boolean).join(" · ");
}
const immagineMA = (x, ic, cls = "") => { const u = x?.image ? copertina(x.image) : null; return `<span class="mu1ti ${cls}"><span>${ic}</span>${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>`; };
function risultatiMA() {
  if (MAS.carica) return `<div class="mu1w">${t("Cerco…", "Searching…")}</div>`;
  if (MAS.err) return empty(t("La ricerca non è riuscita: ", "The search failed: ") + esc(MAS.err));
  if (!MAS.res) return "";
  MAS.voci = [];
  const gruppi = GRUPPI_MA.filter(([k]) => !MAS.tipo || MAS.tipo === k).map(([k, g]) => [k, (Array.isArray(MAS.res[g]) ? MAS.res[g] : []).filter(x => x && x.uri)]).filter(([, L]) => L.length);
  if (!gruppi.length) return empty(t("Nessun risultato per «", "No results for «") + esc(MAS.fatta) + "».");
  const nomi = Object.fromEntries(TIPI_MA());
  return gruppi.map(([k, L]) => {
    const pezzi = L.map(x => { const i = MAS.voci.push({ ...x, media_type: x.media_type || k }) - 1, v = MAS.voci[i], ic = ICONE_MA[v.media_type] || "🎵";
      const menu = `<button class="ma1m" data-act="ma1menu" data-i="${i}" aria-label="${t("Altre scelte", "More options")}: ${esc(v.name)}">⋯</button>`;
      return k === "track"
        ? `<div class="mu1lw"><button class="mu1lr" data-act="ma1su" data-i="${i}">${immagineMA(v, ic, "sm")}<span class="tx"><b>${esc(v.name)}${v.version ? ` <em>(${esc(v.version)})</em>` : ""}</b><small>${esc(sottoMA(v))}</small></span><span class="pl" aria-hidden="true">▶</span></button>${menu}</div>`
        : `<div class="mu1t ${k === "artist" ? "ma1ar" : ""}"><button class="mu1tb" data-act="ma1su" data-i="${i}">${immagineMA(v, ic)}<b>${esc(v.name)}</b><small>${esc(sottoMA(v))}</small></button>${menu}</div>`; }).join("");
    return `${MAS.tipo ? "" : `<div class="mu1l">${esc(nomi[k])}</div>`}${k === "track" ? `<div class="mu1li">${pezzi}</div>` : `<div class="mu1b">${pezzi}</div>`}`;
  }).join("");
}
function cardMA() {
  const C = casseMA(), pid = cassaMA(), chi = dove();
  const scegli = C.length > 1 && !C.includes(chi) ? `<label class="fld1 ma1dv"><span>${t("Suona su", "Plays on")}</span><select data-chg="ma1cassa">${C.map(id => `<option value="${id}" ${id === pid ? "selected" : ""}>${esc(nm(id))}</option>`).join("")}</select></label>` : "";
  const corpo = !C.length ? empty(t("Music Assistant non ha ancora casse in Home Assistant: aggiungile nella sua app.", "Music Assistant has no speakers in Home Assistant yet: add them in its app."))
    : `<form class="row mu1axf" data-ma1f><input id="ma1q" type="search" enterkeyhint="search" autocomplete="off" value="${esc(MAS.q)}" placeholder="${t("Brani, artisti, album, playlist, radio…", "Songs, artists, albums, playlists, radio…")}" aria-label="${t("Cerca in Music Assistant", "Search Music Assistant")}">
        <button class="btn pri" data-act="ma1cerca">🔎 ${t("Cerca", "Search")}</button></form>
      <div class="mu1axs ma1ts">${TIPI_MA().map(([k, n]) => `<button class="${MAS.tipo === k ? "act" : ""}" data-act="ma1tipo" data-v="${k}" aria-pressed="${MAS.tipo === k}">${esc(n)}</button>`).join("")}</div>
      ${scegli}${!C.includes(chi) && C.length === 1 ? `<div class="small muted">${t("Suona su ", "Plays on ")}<b>${esc(nm(pid))}</b>${t(", la cassa di Music Assistant.", ", the Music Assistant speaker.")}</div>` : ""}
      <div class="ma1r">${risultatiMA()}</div>`;
  return card("🔎 " + t("Cerca in Music Assistant", "Search Music Assistant"), corpo, { cls: "ma1c" });
}
/** riproduce un elemento di Music Assistant: { uri, media_type, name } con enqueue (play, next, add) o radio */
function suonaMA(x, o = {}) {
  const pid = cassaMA(); if (!pid) { toast(t("Serve una cassa di Music Assistant.", "A Music Assistant speaker is needed."), true); return; }
  return svc("music_assistant", "play_media", { media_id: x.uri, media_type: x.media_type, ...(o.enqueue ? { enqueue: o.enqueue } : {}), ...(o.radio ? { radio_mode: true } : {}) }, { entity_id: pid })
    .then(() => {
      toast((o.enqueue === "next" ? "⏭ " : o.enqueue === "add" ? "＋ " : o.radio ? "📻 " : "▶ ") + x.name + (o.enqueue === "next" ? t(": dopo questo", ": up next") : o.enqueue === "add" ? t(": in coda", ": queued") : o.radio ? t(": radio", ": radio") : "") + " · " + nm(pid));
      uncache("maq:" + pid);
      if (!o.enqueue && dove() !== pid) { sSet("mu_dove", pid); render(true); }
    }).catch(() => {});
}
/* il foglio «⋯» di un risultato */
let MENU = -1;
function foglioMA() {
  const x = MAS.voci[MENU]; if (!x) return `<div class="sh-head"><h3>…</h3><button class="x" data-act="sheetClose">×</button></div>`;
  const pid = cassaMA(), r = ["track", "artist", "album", "playlist"].includes(x.media_type), p = prefDaMA(x);
  const riga = (act, ic, b, sotto, extra = "") => `<button class="pk1" data-act="${act}" ${extra}><span class="ic">${ic}</span><span class="tx"><b>${b}</b>${sotto ? `<small class="ma1s">${sotto}</small>` : ""}</span></button>`;
  return `<div class="sh-head"><div class="row" style="gap:12px;min-width:0">${immagineMA(x, ICONE_MA[x.media_type] || "🎵", "ma1sh")}<div style="min-width:0"><h3>${esc(x.name)}</h3><div class="small muted">${esc(sottoMA(x))}${pid ? " · " + t("suona su ", "plays on ") + esc(nm(pid)) : ""}</div></div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="pkl1">
      ${riga("ma1fai", "▶", t("Riproduci adesso", "Play now"), "", `data-v="play"`)}
      ${riga("ma1fai", "⏭", t("Dopo questo", "Play next"), t("subito dopo il brano che sta suonando", "right after the current track"), `data-v="next"`)}
      ${riga("ma1fai", "＋", t("Aggiungi alla coda", "Add to queue"), t("in fondo alla coda", "at the end of the queue"), `data-v="add"`)}
      ${r ? riga("ma1fai", "📻", t("Radio da qui", "Radio from here"), t("musica simile, senza fine (se il servizio lo permette)", "similar music, endless (if the service allows it)"), `data-v="radio"`) : ""}
      ${isAdmin() && p ? riga("ma1pref", isPref(p) ? "★" : "☆", isPref(p) ? t("Togli dai preferiti", "Remove from favourites") : t("Aggiungi ai preferiti", "Add to favourites"), t("per tutta la casa", "for the whole home")) : ""}
    </div>`;
}

/* la coda della cassa di Music Assistant: il brano di adesso, il prossimo e quanti ce ne sono */
const CODA = {};
function codaMA(id) {
  const k = "maq:" + id + ":" + S[id].state + ":" + (attr(id, "media_title") || "") + ":" + (attr(id, "media_content_id") || "");
  const r = cached(k, 30000, () => svcResp("music_assistant", "get_queue", {}, id).then(x => x?.[id] || { vuota: true }).catch(() => ({ errore: true })));
  if (r) CODA[id] = r;
  const q = r || CODA[id];
  if (!q) return `<div class="mu1l">${t("Coda", "Queue")}</div><div class="mu1w" style="padding:8px 4px">${t("Carico…", "Loading…")}</div>`;
  if (q.errore) return "";
  const voce = (it, et) => { if (!it) return ""; const m = it.media_item || {}, nome = m.name || it.name || "", sotto = artistiMA(m);
    return `<div class="ma1q"><span class="ma1qe">${et}</span>${immagineMA({ image: m.image || it.image }, ICONE_MA[m.media_type] || "🎵", "sm")}<span class="tx"><b>${esc(nome)}</b>${sotto ? `<small>${esc(sotto)}</small>` : ""}</span>${it.duration ? `<em>${mmss(it.duration)}</em>` : ""}</div>`; };
  const n = +q.items || 0, i = Number.isFinite(+q.current_index) ? +q.current_index : -1;
  const corpo = q.current_item || q.next_item ? voce(q.current_item, t("Adesso", "Now")) + voce(q.next_item, t("Dopo", "Next")) : `<div class="small muted" style="padding:4px 2px">${t("La coda è vuota: cerca qualcosa qui accanto.", "The queue is empty: search for something.")}</div>`;
  return `<div class="mu1l">${t("Coda", "Queue")}${n ? ` · <span class="ma1qn">${i >= 0 ? `${i + 1} ${t("di", "of")} ` : ""}${n} ${n === 1 ? t("brano", "track") : t("brani", "tracks")}</span>` : ""}</div><div class="ma1qs">${corpo}</div>`;
}

/* ================= «Sposta su…»: la musica passa da una cassa all'altra ================= */
const portabile = c => /^(media-source|https?):\/\//.test(c);
/** si può passare la musica da «da» ad «a»? (con Music Assistant passa la coda, altrimenti riparte lo stesso contenuto) */
function puoSpostare(da, a) {
  if (!a || a === da) return false;
  if (da === "qui") return !!brano() && QUI.stato !== "" && a !== "qui" && ha(a, F.PLAY_MEDIA) && !isAlexa(a);
  if (!S[da]) return false;
  if (isMA(da) && isMA(a)) return true;
  const c = String(attr(da, "media_content_id") || ""); if (!c) return false;
  if (a === "qui") return /^media-source:\/\//.test(c);
  return ha(a, F.PLAY_MEDIA) && !isAlexa(a) && (portabile(c) || piattaforma(a) === piattaforma(da));
}
const destinazioni = da => ["qui", ...casse()].filter(a => puoSpostare(da, a));
const comeSposta = (da, a) => isMA(da) && isMA(a) ? t("passa tutta la coda (Music Assistant)", "moves the whole queue (Music Assistant)")
  : da === "qui" && QUI.coda.length > QUI.i + 1 ? ha(a, F.ENQUEUE) ? t("con il resto della coda", "with the rest of the queue") : t("riparte questo brano, senza il resto della coda", "this track starts again, without the rest of the queue")
  : t("riparte da capo il brano o la radio", "the track or station starts again");
const bottoneSposta = id => `<div class="mu1spw"><button class="btn sm mu1spb" data-act="mu1sp" data-id="${id}">⇄ ${t("Sposta su…", "Move to…")}</button></div>`;
let DA = null;
function foglioSposta() {
  const da = DA, D = da ? destinazioni(da) : [];
  const titolo = da === "qui" ? brano()?.titolo || "" : attr(da, "media_title") || "";
  const ic = id => id === "qui" ? "📱" : isGruppo(id) ? "👥" : tipo(id);
  return `<div class="sh-head"><div><h3>⇄ ${t("Sposta su…", "Move to…")}</h3><div class="small muted">${titolo ? "«" + esc(titolo) + "» · " : ""}${t("adesso su ", "now on ")}${esc(da === "qui" ? t("questo dispositivo", "this device") : nm(da))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${D.length ? `<div class="pkl1">${D.map(a => `<button class="pk1" data-act="mu1spv" data-id="${a}"><span class="ic">${ic(a)}</span><span class="tx"><b>${esc(a === "qui" ? t("Questo dispositivo", "This device") : nm(a))}</b><small class="ma1s">${esc(comeSposta(da, a))}${a !== "qui" && AREAS[areaOf(a)] ? " · " + esc(AREAS[areaOf(a)].name) : ""}</small></span>${suona(a) ? eq() : ""}</button>`).join("")}</div>`
      : empty(t("Nessun'altra cassa può suonare questo.", "No other speaker can play this."))}`;
}
async function sposta(da, a) {
  if (!puoSpostare(da, a)) return;
  const nome = a === "qui" ? t("questo dispositivo", "this device") : nm(a);
  try {
    if (da === "qui") {
      const b = brano(), resto = ha(a, F.ENQUEUE) ? QUI.coda.slice(QUI.i + 1, QUI.i + 51) : [];
      await svc("media_player", "play_media", { media_content_id: b.id, media_content_type: b.tipo || "music" }, { entity_id: a });
      ferma();
      /* il resto della coda: se una voce non entra, la musica è già passata e mi fermo lì */
      try { for (const x of resto) await svc("media_player", "play_media", { media_content_id: x.id, media_content_type: x.tipo || "music", enqueue: "add" }, { entity_id: a }); } catch {}
    } else if (isMA(da) && isMA(a)) {
      await svc("music_assistant", "transfer_queue", { source_player: da, auto_play: true }, { entity_id: a });
      uncache("maq:");
    } else {
      const c = attr(da, "media_content_id"), ty = attr(da, "media_content_type");
      if (a === "qui") { sblocca(); suonaQui([{ id: c, titolo: attr(da, "media_title") || nm(da), sotto: attr(da, "media_artist") || attr(da, "media_album_name") || "", img: attr(da, "entity_picture") || null, tipo: ty || "" }], 0); }
      else await svc("media_player", "play_media", { media_content_id: c, media_content_type: ty || "music" }, { entity_id: a });
      if (suona(da) && (ha(da, F.PAUSE) || ha(da, F.STOP))) await svc("media_player", ha(da, F.PAUSE) ? "media_pause" : "media_stop", {}, { entity_id: da }).catch(() => {});
    }
  } catch { return; }   // svc ha già detto cosa non va
  sSet("mu_dove", a); toast("⇄ " + t("Ora su ", "Now on ") + nome); render(true);
}

/* ================= Preferiti: playlist e radio per tutta la casa (salvati nella plancia) ================= */
/* { k: "ma" (Music Assistant) | "ms" (media di Home Assistant) | "cassa" (elenco di una cassa), id, tipo, titolo, sotto, img, classe: "playlist"|"radio", cassa?, espandi? } */
const preferiti = () => (Array.isArray(LAYOUT.muPreferiti) ? LAYOUT.muPreferiti : []).filter(p => p && p.id && p.k);
const chiaveP = p => p.k + "|" + (p.cassa || "") + "|" + p.id;
const isPref = p => !!p && preferiti().some(x => chiaveP(x) === chiaveP(p));
const preferibile = c => !!c && c.can_play && ["playlist", "channel"].includes(c.media_class);
function prefDaSfoglia(chi, c) {
  const base = { id: c.media_content_id, tipo: c.media_content_type || "", titolo: pulisci(c.title), img: c.thumbnail || null, classe: c.media_class === "channel" ? "radio" : "playlist" };
  /* dall'elenco di una cassa di Music Assistant: vale su tutte le sue casse */
  if (usaCassa(chi) && isMA(chi) && /^[a-z0-9_]+:\/\//i.test(base.id) && !/^media-source:/.test(base.id)) return { k: "ma", ...base, tipo: base.classe === "radio" ? "radio" : "playlist" };
  return usaCassa(chi) ? { k: "cassa", cassa: chi, ...base } : { k: "ms", ...base, ...(c.can_expand ? { espandi: true } : {}) };
}
const prefDaMA = x => ["playlist", "radio"].includes(x?.media_type) ? { k: "ma", id: x.uri, tipo: x.media_type, titolo: x.name, sotto: artistiMA(x), img: x.image || null, classe: x.media_type === "radio" ? "radio" : "playlist" } : null;
function cambiaPref(p) {
  if (!p || !isAdmin()) return;
  const k = chiaveP(p), c = isPref(p);
  cambia(l => { l.muPreferiti = (Array.isArray(l.muPreferiti) ? l.muPreferiti : []).filter(x => x && chiaveP(x) !== k).concat(c ? [] : [p]); },
    c ? "☆ " + t("Tolto dai preferiti: ", "Removed from favourites: ") + p.titolo : "⭐ " + t("Nei preferiti: ", "Added to favourites: ") + p.titolo);
}
const stella = (chi, c, i, testo) => { const on = isPref(prefDaSfoglia(chi, c));
  return `<button class="${testo ? "btn sm" : "mu1st"} ${on ? "on" : ""}" data-act="mu1stella" data-i="${i}" aria-pressed="${on}" aria-label="${on ? t("Togli dai preferiti", "Remove from favourites") : t("Aggiungi ai preferiti", "Add to favourites")}: ${esc(pulisci(c.title))}">${on ? "★" : "☆"}${testo ? " " + (on ? t("Nei preferiti", "In favourites") : t("Preferiti", "Favourite")) : ""}</button>`; };
const doveP = p => p.k === "cassa" ? nm(p.cassa) : p.k === "ma" ? "Music Assistant" : "";
function cardPreferiti() {
  const P = preferiti(), mod = UI.edit && isAdmin();
  if (!P.length) return mod ? card("⭐ " + t("Preferiti", "Favourites"), empty(t("Tocca ☆ su una playlist o una radio (in «Sfoglia» o nella ricerca di Music Assistant) per averla qui, per tutta la casa.", "Tap ☆ on a playlist or a station (in «Browse» or in the Music Assistant search) to keep it here, for the whole home.")), { cls: "span3 mu1fv" }) : "";
  return card("⭐ " + t("Preferiti", "Favourites"), `<div class="mu1fs">${P.map((p, i) => { const u = p.img ? copertina(p.img) : null, ic = p.classe === "radio" ? "📻" : "📃";
    return `<div class="mu1f"><button class="mu1fb" data-act="mu1pref" data-i="${i}"><span class="mu1ti sm"><span>${ic}</span>${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
      <span class="tx"><b>${esc(p.titolo)}</b><small>${[p.classe === "radio" ? "Radio" : "Playlist", doveP(p)].filter(Boolean).map(esc).join(" · ")}</small></span></button>
      ${mod ? `<button class="mu1fx" data-act="mu1prefx" data-i="${i}" aria-label="${t("Togli", "Remove")}: ${esc(p.titolo)}">✕</button>` : ""}</div>`; }).join("")}</div>`, { cls: "span3 mu1fv" });
}
/** suona un preferito dove ascolti; se lì non si può, dove si può (e «Dove ascolti» lo segue) */
function suonaPref(p) {
  const chi = dove();
  if (p.k === "ma") return suonaMA({ uri: p.id, media_type: p.tipo, name: p.titolo });
  if (p.k === "cassa") {
    if (!S[p.cassa]) { toast(t("Non trovo la cassa di questo preferito.", "I can't find this favourite's speaker."), true); return; }
    return svc("media_player", "play_media", { media_content_id: p.id, media_content_type: p.tipo || "music" }, { entity_id: p.cassa })
      .then(() => { toast("▶ " + p.titolo + " · " + nm(p.cassa)); if (chi !== p.cassa) { sSet("mu_dove", p.cassa); render(true); } }).catch(() => {});
  }
  if (chi !== "qui" && ha(chi, F.PLAY_MEDIA) && !isAlexa(chi))
    return svc("media_player", "play_media", { media_content_id: p.id, media_content_type: p.tipo || "music" }, { entity_id: chi }).then(() => toast("▶ " + p.titolo + " · " + nm(chi))).catch(() => {});
  sblocca();
  if (chi !== "qui") { sSet("mu_dove", "qui"); toast("📱 " + p.titolo + " · " + t("questo dispositivo", "this device")); }
  if (p.espandi) suonaCartella({ media_content_id: p.id, title: p.titolo, thumbnail: p.img, can_play: true, media_content_type: p.tipo });
  else suonaQui([{ id: p.id, titolo: p.titolo, sotto: p.sotto || "", img: p.img, tipo: p.tipo }], 0);
}

/* ================= pagina ================= */
function cardCassa(id) {
  const nota = !puoSfogliare(id) && !isAlexa(id) ? `<div class="small muted" style="margin-top:10px">${t("Da questa cassa non si può scegliere la musica dalla plancia: usa la sua app, poi la comandi da qui.", "This speaker doesn't let the dashboard choose the music: use its app, then control it from here.")}</div>` : "";
  /* senza «Sfoglia» la scheda è larga: il lettore e «Chiedi ad Alexa» stanno affiancati */
  return card((isGruppo(id) ? "👥 " : tipo(id) + " ") + esc(nm(id)), `<div class="${puoSfogliare(id) ? "" : "mu1two"}">${lettore(id)}${isAlexa(id) ? chiediAlexa(id) : ""}</div>${isMA(id) ? codaMA(id) : ""}${nota}`, { cls: "mu1p" });
}
function pagina() {
  const chi = dove(), L = tutti(), g = {};
  L.forEach(id => (g[AREAS[areaOf(id)] ? areaOf(id) : "_"] = g[AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
  const ord = [...areasSorted().filter(a => g[a]), ...(g._ ? ["_"] : [])].filter(a => UI.edit || g[a].some(id => !suona(id)));
  const play = L.filter(suona).filter(id => id !== chi);
  const destra = (haMA() ? cardMA() : "") + (puoSfogliare(chi) ? cardSfoglia(chi) : "");
  return `<div class="g g3">
    ${scelta()}
    ${cardPreferiti()}
    <div class="span3 mu1g ${destra ? "" : "solo"}">${chi === "qui" ? card("📱 " + t("Questo dispositivo", "This device"), lettoreQui(), { cls: "mu1p" }) : cardCassa(chi)}${destra ? `<div class="mu1dx">${destra}</div>` : ""}</div>
    ${play.length ? card("🎶 " + t("In riproduzione", "Now playing"), `<div class="mpg2">${play.map(id => lettore(id)).join("")}</div>`, { cls: "span3" }) : ""}
    ${ord.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name), `<div class="stack">${g[a].filter(id => !suona(id)).map(id => item(id, lettore(id))).join("") || `<div class="small muted">${t("Sta suonando qui sopra.", "Playing above.")}</div>`}${addBtn(["media_player"], { area: a === "_" ? "" : a })}</div>`)).join("")}
    ${!L.length && UI.edit ? card("🎵 " + titolo(), empty(t("Nessun lettore multimediale.", "No media player.")) + addBtn(["media_player"], { big: true }), { cls: "span3" }) : ""}
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
  /* preferiti */
  mu1stella: el => { const i = +el.dataset.i, c = i < 0 ? NODO : VISTI[i]; if (c) cambiaPref(prefDaSfoglia(dove(), c)); },
  mu1pref: el => { const p = preferiti()[+el.dataset.i]; if (p) suonaPref(p); },
  mu1prefx: el => { const p = preferiti()[+el.dataset.i]; if (p) cambiaPref(p); },
  /* sposta su… */
  mu1sp: el => { DA = el.dataset.id; openSheet(foglioSposta); },
  mu1spv: el => { const da = DA, a = el.dataset.id; closeSheet(); if (da === "qui" || a === "qui") sblocca(); sposta(da, a); },
  /* Music Assistant */
  ma1cerca: () => { MAS.q = document.getElementById("ma1q")?.value || MAS.q; cercaMA(); },
  ma1tipo: el => { MAS.tipo = el.dataset.v; MAS.q = document.getElementById("ma1q")?.value || MAS.q; if (MAS.q.trim()) cercaMA(); else render(true); },
  ma1su: el => { const x = MAS.voci[+el.dataset.i]; if (x) suonaMA(x); },
  ma1menu: el => { MENU = +el.dataset.i; openSheet(foglioMA); },
  ma1fai: el => { const x = MAS.voci[MENU], v = el.dataset.v; closeSheet(); if (x) suonaMA(x, v === "radio" ? { radio: true } : v === "play" ? {} : { enqueue: v }); },
  ma1pref: () => { const p = prefDaMA(MAS.voci[MENU]); closeSheet(); cambiaPref(p); },
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
/* ricerca di Music Assistant: il testo resta mentre la pagina si ridisegna; Invio cerca */
document.addEventListener("input", e => { if (e.target.id === "ma1q") MAS.q = e.target.value; });
document.addEventListener("submit", e => { if (e.target.matches?.("[data-ma1f]")) { e.preventDefault(); MAS.q = document.getElementById("ma1q")?.value || ""; cercaMA(); } });
CHG.ma1cassa = el => { sSet("mu_ma", el.value); render(true); };
CHG.mu1vol = el => { AU.volume = +el.value / 100; sSet("mu_vol", el.value); render(); };
CHG.mu1seek = el => { if (!inDiretta() && isFinite(AU.duration)) AU.currentTime = +el.value; };
CHG.muVol = el => svc("media_player", "volume_set", { volume_level: +el.value / 100 }, { entity_id: el.dataset.id });
CHG.muSrc = el => svc("media_player", "select_source", { source: el.value }, { entity_id: el.dataset.id });
CHG.muSound = el => svc("media_player", "select_sound_mode", { sound_mode: el.value }, { entity_id: el.dataset.id });

page("musica", { title: t("Musica e TV", "Music and TV"), short: t("Musica", "Music"), icon: "🎵", order: 33, editable: true,
  show: () => tutti().length > 0 || !!brano() || fonti(), badge: () => tutti().some(suona) || QUI.stato === "play", render: pagina });
/* con la pagina Media le TV sono là: il titolo diventa «Musica» */
const titolo = () => tvInMedia() ? t("Musica", "Music") : t("Musica e TV", "Music and TV");
Object.defineProperty(PAGES.musica, "title", { get: titolo, configurable: true });

/* Lettore video unico per le telecamere (pagina Telecamere, Sicurezza, pagine create dall'utente).
   Per ogni telecamera prova, in quest'ordine: WebRTC → HLS → MJPEG → una foto ogni 2 secondi.
   Solo API ufficiali di Home Assistant:
     camera/capabilities              quali flussi offre la telecamera (frontend_stream_types)
     camera/webrtc/get_client_config  server ICE, canale dati, candidati subito o man mano
     camera/webrtc/offer              (sottoscrizione) → session, answer, candidate, error
     camera/webrtc/candidate          i candidati ICE del browser
     camera/stream                    indirizzo .m3u8 per HLS
     /api/camera_proxy_stream/…       MJPEG;  /api/camera_proxy/…  foto singola
   Il dispositivo ricorda il metodo che ha funzionato (sGet/sSet) e la volta dopo parte da quello.
   Gli stream si chiudono davvero quando il foglio si chiude, si cambia pagina o la plancia va in secondo piano.

   Uso: un segnaposto <div class="vp1" data-keep data-cam="camera.x"></div> nel codice della pagina;
   il lettore si monta da solo quando compare e si smonta quando sparisce. */
import { S, ACT, LAYOUT, UI, conn, t, esc, nm, ok, attr, ws, sGet, sSet, openSheet, closeSheet, render, areaOf, AREAS, toast, $, LOC } from "./core.js";

const ORDINE = ["webrtc", "hls", "mjpeg", "foto"];
const NOME = { webrtc: "WebRTC", hls: "HLS", mjpeg: "MJPEG", foto: t("Foto", "Photo") };
/* quanto aspetto il primo fotogramma prima di passare al metodo dopo */
const ATTESA = { webrtc: 8000, hls: 16000, mjpeg: 10000, foto: 10000 };
const memoria = id => sGet("camMetodo_" + id);
/* la «foto ogni 2 s» non la ricordo: è il ripiego, la volta dopo riprovo i metodi veri */
const ricorda = (id, m) => { if (m !== "foto") sSet("camMetodo_" + id, m); };

/* ================= anteprime leggere delle griglie ================= */
/** telecamere nell'ordine scelto con ◀ ▶ */
export const ordineCam = L => { const o = LAYOUT.camOrder || []; return [...L].sort((a, b) => ((o.indexOf(a) + 1 || 999) - (o.indexOf(b) + 1 || 999)) || nm(a).localeCompare(nm(b), LOC)); };
/* l'anteprima cambia indirizzo quando Home Assistant rinnova il token: aggiungo un contatore per ricaricarla */
let giro = 0; setInterval(() => { giro++; if (document.querySelector(".cm1 img")) render(); }, 10000);
export const fotoCam = id => { const p = attr(id, "entity_picture"); return p ? p + (p.includes("?") ? "&" : "?") + "t=" + giro : ""; };
const STATO = s => ({ recording: "⏺ " + t("registra", "recording"), streaming: "🔴 live", idle: "" }[s] ?? s);
/** contenuto di una tessera: foto leggera, nome e stanza; al tocco parte la diretta */
export const anteprima = id => `<button class="cmb1" data-act="camLive" data-id="${id}" aria-label="${esc(t("Diretta: ", "Live: ") + nm(id))}">${ok(id) && attr(id, "entity_picture") ? `<img src="${esc(fotoCam(id))}" alt="" loading="lazy">` : `<span class="cmx1">📷</span>`}
    <span class="cmp1" aria-hidden="true">▶</span><span class="cmn1"><b>${esc(nm(id))}</b><small>${esc([AREAS[areaOf(id)]?.name, STATO(S[id]?.state)].filter(Boolean).join(" · "))}</small></span></button>`;

/* ================= foglio della diretta ================= */
let LIVE = null;
function foglio() {
  const id = LIVE; if (!id || !S[id]) return "";
  return `<div class="sh-head"><div><h3>📷 ${esc(nm(id))}</h3><div class="small muted">${esc(AREAS[areaOf(id)]?.name || t("In diretta", "Live"))}</div></div>
    <button class="btn sm" data-act="more" data-id="${id}">⤢ ${t("Apri in HA", "Open in HA")}</button><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    <div class="vp1" data-keep data-cam="${id}"></div>`;
}
ACT.camLive = el => { LIVE = el.dataset.id; openSheet(foglio); };

/* ================= lettore ================= */
const ATTIVI = new Set();
/** vero se sullo schermo c'è una diretta (il salvaschermo non la copre) */
export const inDiretta = () => [...ATTIVI].some(p => p.gen && !p.sospeso);

function monta(box) {
  const id = box.dataset.cam;
  box.innerHTML = `<div class="vps1"></div>
    <div class="vpb1" role="status"><i></i><span></span></div>
    <div class="vpe1" hidden><b>${t("Non riesco a mostrare questa telecamera", "I can't show this camera")}</b><small></small><button type="button" data-v="riprova">↻ ${t("Riprova", "Try again")}</button></div>
    <div class="vpf1"></div>
    <div class="vpc1">
      <button type="button" data-v="audio" hidden></button>
      <button type="button" data-v="scatta">📸 <span>${t("Istantanea", "Snapshot")}</span></button>
      <button type="button" data-v="tutto"></button>
    </div>`;
  const p = { id, box, scena: box.querySelector(".vps1"), metodo: null, gen: 0, pulizie: [], audio: false, cadute: 0, sospeso: false, pagina: UI.page };
  box._p = p; ATTIVI.add(p);
  box.addEventListener("click", e => {
    const b = e.target.closest("button[data-v]");
    if (!b) { const v = p.scena.querySelector("video"); if (v?.paused) v.play().catch(() => {}); return; }   // autoplay bloccato (risparmio energetico): parte al tocco
    if (b.dataset.v === "riprova") { p.cadute = 0; avvia(p, true); }
    else if (b.dataset.v === "audio") audio(p);
    else if (b.dataset.v === "scatta") scatta(p);
    else if (b.dataset.v === "tutto") tutto(p);
  });
  comandi(p);
  avvia(p);
}
function smonta(p) {
  ferma(p); ATTIVI.delete(p); p.box._p = null;
  esciTutto(p);
  p.box.innerHTML = "";
}
/** chiude tutto quello che è aperto: connessione WebRTC, sottoscrizione, hls.js, MJPEG, timer */
function pulisci(p) {
  for (const f of p.pulizie.splice(0)) { try { f(); } catch {} }
  p.scena.innerHTML = "";
}
function ferma(p) { p.gen = 0; pulisci(p); }

function stato(p, fase, dettaglio = "") {
  const b = p.box.querySelector(".vpb1"), e = p.box.querySelector(".vpe1");
  if (!b) return;
  b.className = "vpb1 " + fase + (fase === "live" && p.metodo === "foto" ? " foto" : "");
  b.querySelector("span").textContent = fase === "live" ? (p.metodo === "foto" ? t("Foto ogni 2 s", "Photo every 2 s") : "LIVE · " + NOME[p.metodo])
    : fase === "errore" ? t("Non disponibile", "Not available")
    : (p.metodo ? NOME[p.metodo] + " · " : "") + t("collegamento…", "connecting…");
  e.hidden = fase !== "errore";
  if (fase === "errore") e.querySelector("small").textContent = dettaglio;
  p.box.classList.toggle("errore", fase === "errore");
  comandi(p);
}
function comandi(p) {
  const a = p.box.querySelector('[data-v="audio"]'), f = p.box.querySelector('[data-v="tutto"]'), v = p.scena.querySelector("video");
  if (a) {
    a.hidden = !(v && p.audio);
    a.innerHTML = v && !v.muted ? `🔊 <span>${t("Audio", "Sound")}</span>` : `🔇 <span>${t("Muto", "Muted")}</span>`;
    a.setAttribute("aria-label", v && !v.muted ? t("Togli l'audio", "Mute") : t("Attiva l'audio", "Unmute"));
  }
  if (f) { const dentro = schermoIntero() === p.box || p.box.classList.contains("full"); f.innerHTML = dentro ? `🗗 <span>${t("Esci", "Exit")}</span>` : `⛶ <span>${t("Tutto schermo", "Full screen")}</span>`; }
}

/** prova i metodi uno dopo l'altro, partendo da quello che ha funzionato l'ultima volta.
    p.gen è la «generazione»: cambia a ogni tentativo, così quelli vecchi non toccano più niente. */
const nuovaGen = p => (p.gen = Math.random() + 1);
async function avvia(p, daCapo) {
  ferma(p);
  const g = nuovaGen(p);
  p.metodo = null; p.audio = false; stato(p, "collega");
  let tipi = null;
  try { tipi = (await ws({ type: "camera/capabilities", entity_id: p.id }))?.frontend_stream_types || []; } catch { tipi = null; }   // Home Assistant vecchio: provo comunque
  if (g !== p.gen) return;
  const possibili = ORDINE.filter(m => m === "webrtc" ? !!tipi?.includes("web_rtc") && "RTCPeerConnection" in window : m === "hls" ? !tipi || tipi.includes("hls") : true);
  const m0 = daCapo ? null : memoria(p.id);
  const prove = m0 && possibili.includes(m0) ? [m0, ...possibili.filter(x => x !== m0)] : possibili;
  let ultimo = "", gm = g;
  for (const m of prove) {
    if (gm !== p.gen) return;
    gm = nuovaGen(p);
    p.metodo = m; p.audio = false; stato(p, "collega");
    let fatto = false;
    try { fatto = await entro(PROVA[m](p, gm), ATTESA[m]); } catch (e) { ultimo = e?.message || e?.code || String(e); console.warn("nduja video", p.id, m, e); }
    if (gm !== p.gen) return;
    if (fatto) { ricorda(p.id, m); stato(p, "live"); setTimeout(() => { if (gm === p.gen) p.cadute = 0; }, 30000); return; }
    pulisci(p);
  }
  p.gen = 0; p.metodo = null; stato(p, "errore", ultimo);
}
const entro = (pr, ms) => new Promise((ok, ko) => { const tm = setTimeout(() => ok(false), ms); pr.then(v => { clearTimeout(tm); ok(v); }, e => { clearTimeout(tm); ko(e); }); });
/** lo stream si è interrotto dopo essere partito: riprovo (al massimo 3 volte di fila, poi «Riprova») */
function caduto(p, g) {
  if (g !== p.gen) return;
  if (++p.cadute > 3) { ferma(p); stato(p, "errore", t("Il collegamento si interrompe di continuo.", "The connection keeps dropping.")); return; }
  const g2 = nuovaGen(p);   // gli altri avvisi dello stesso stream caduto non contano più
  stato(p, "collega");
  setTimeout(() => { if (g2 === p.gen) avvia(p); }, 1500);
}

/* ---------- pezzi comuni ---------- */
function video(p) {
  const v = document.createElement("video");
  v.muted = true; v.defaultMuted = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
  p.scena.appendChild(v);
  p.pulizie.push(() => { try { v.pause(); } catch {} v.srcObject = null; v.removeAttribute("src"); try { v.load(); } catch {} v.remove(); });
  v.addEventListener("volumechange", () => comandi(p));
  return v;
}
/** si risolve al primo fotogramma vero (anche se il browser non lo fa partire da solo) */
function primoFotogramma(v, g, p) {
  return new Promise(ok => {
    const fatto = () => { if (v.videoWidth > 0) { v.removeEventListener("loadeddata", fatto); v.removeEventListener("playing", fatto); v.play().catch(() => {}); ok(g === p.gen); } };
    v.addEventListener("loadeddata", fatto); v.addEventListener("playing", fatto);
    v.play().catch(() => {});
  });
}
const tokenDi = id => attr(id, "access_token") || "";

/* ---------- 1) WebRTC ---------- */
async function webrtc(p, g) {
  const cfg = await ws({ type: "camera/webrtc/get_client_config", entity_id: p.id });
  if (g !== p.gen) return false;
  const pc = new RTCPeerConnection(cfg?.configuration || {});
  let fine = null, chiuso = false;
  p.pulizie.push(() => { chiuso = true; try { pc.close(); } catch {} if (fine) Promise.resolve().then(fine).catch(() => {}); });
  if (cfg?.dataChannel) pc.createDataChannel(cfg.dataChannel);   // alcune telecamere (Nest) lo vogliono
  pc.addTransceiver("audio", { direction: "recvonly" });
  pc.addTransceiver("video", { direction: "recvonly" });
  const v = video(p), flusso = new MediaStream();
  v.srcObject = flusso;
  pc.ontrack = e => { if (!flusso.getTracks().includes(e.track)) flusso.addTrack(e.track); if (e.track.kind === "audio") { p.audio = true; comandi(p); } };
  await pc.setLocalDescription(await pc.createOffer());
  if (cfg?.getCandidatesUpfront) await raccolti(pc, 4000);   // tutti i candidati dentro l'offerta
  if (g !== p.gen || chiuso) return false;

  let sessione = null, remoto = false;
  const miei = [], loro = [];
  const invia = c => ws({ type: "camera/webrtc/candidate", entity_id: p.id, session_id: sessione, candidate: c }).catch(() => {});
  pc.onicecandidate = e => { if (!e.candidate?.candidate || cfg?.getCandidatesUpfront) return; const c = e.candidate.toJSON(); if (sessione) invia(c); else miei.push(c); };

  return new Promise((ok, ko) => {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") { if (p.metodo === "webrtc" && p.box.querySelector(".vpb1.live")) caduto(p, g); else ko(new Error("WebRTC: " + t("collegamento non riuscito", "connection failed"))); }
    };
    conn.subscribeMessage(async m => {
      if (chiuso || g !== p.gen) return;
      try {
        if (m.type === "session") { sessione = m.session_id; miei.splice(0).forEach(invia); }
        else if (m.type === "answer") { await pc.setRemoteDescription({ type: "answer", sdp: m.answer }); remoto = true; for (const c of loro.splice(0)) await pc.addIceCandidate(c).catch(() => {}); }
        else if (m.type === "candidate" && m.candidate) { if (remoto) await pc.addIceCandidate(m.candidate).catch(() => {}); else loro.push(m.candidate); }
        else if (m.type === "error") ko(new Error(m.message || m.code));
      } catch (e) { ko(e); }
    }, { type: "camera/webrtc/offer", entity_id: p.id, offer: pc.localDescription.sdp }, { resubscribe: false })
      .then(u => { fine = u; if (chiuso) Promise.resolve().then(u).catch(() => {}); }, ko);
    primoFotogramma(v, g, p).then(ok);
  });
}
const raccolti = (pc, ms) => new Promise(ok => {
  if (pc.iceGatheringState === "complete") return ok();
  const tm = setTimeout(ok, ms);
  pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(tm); ok(); } });
});

/* ---------- 2) HLS: video nativo su Safari / iPhone, hls.js (lib/hls.min.js, caricato solo adesso) altrove ---------- */
let hlsJs = null;
function caricaHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return hlsJs ||= new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = new URL("../lib/hls.min.js", import.meta.url).href;   // percorso relativo, mai da internet
    s.onload = () => ok(window.Hls); s.onerror = () => { hlsJs = null; ko(new Error("hls.js")); };
    document.head.appendChild(s);
  });
}
const safari = () => /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Android|Edg\//.test(navigator.userAgent);
async function hls(p, g) {
  const r = await ws({ type: "camera/stream", entity_id: p.id, format: "hls" });
  if (g !== p.gen || !r?.url) return false;
  const v = video(p), nativo = !!v.canPlayType("application/vnd.apple.mpegurl");
  const fallito = new Promise((_, ko) => {
    if (nativo && (safari() || !("MediaSource" in window))) {
      v.addEventListener("error", () => { if (p.box.querySelector(".vpb1.live")) caduto(p, g); else ko(new Error("HLS")); });
      v.addEventListener("loadedmetadata", () => { p.audio = !!(v.audioTracks?.length); comandi(p); });
      v.src = r.url;
      return;
    }
    caricaHls().then(Hls => {
      if (g !== p.gen) return;
      if (!Hls?.isSupported()) { if (nativo) { v.src = r.url; return; } return ko(new Error(t("HLS non supportato da questo browser", "HLS not supported by this browser"))); }
      const h = new Hls({ lowLatencyMode: true, backBufferLength: 30, maxLiveSyncPlaybackRate: 1.5, manifestLoadingTimeOut: 20000, levelLoadingTimeOut: 20000, fragLoadingTimeOut: 20000 });
      p.pulizie.push(() => { try { h.destroy(); } catch {} });
      h.on(Hls.Events.MANIFEST_PARSED, () => { p.audio = h.levels.some(l => l.audioCodec) || h.audioTracks.length > 0; comandi(p); });
      h.on(Hls.Events.BUFFER_CODECS, (e, d) => { if (d?.audio) { p.audio = true; comandi(p); } });   // playlist senza codec dichiarati
      h.on(Hls.Events.ERROR, (e, d) => {
        if (!d.fatal) return;
        if (p.box.querySelector(".vpb1.live")) caduto(p, g); else ko(new Error("HLS: " + (d.details || d.type)));
      });
      h.loadSource(r.url); h.attachMedia(v);
    }, ko);
  });
  return Promise.race([primoFotogramma(v, g, p), fallito]);
}

/* ---------- 3) MJPEG e 4) foto ogni 2 secondi ---------- */
const VUOTA = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
function immagine(p) {
  const im = document.createElement("img"); im.alt = ""; im.decoding = "async";
  p.scena.appendChild(im);
  p.pulizie.push(() => { im.onload = im.onerror = null; im.src = VUOTA; im.remove(); });   // cambiare src chiude davvero lo stream MJPEG
  return im;
}
function mjpeg(p, g) {
  const tok = tokenDi(p.id); if (!tok) return Promise.resolve(false);
  const im = immagine(p);
  return new Promise((ok, ko) => {
    let partito = false;
    const guarda = setInterval(() => { if (!partito && im.naturalWidth > 0) { partito = true; ok(g === p.gen); } }, 200);
    p.pulizie.push(() => clearInterval(guarda));
    im.onerror = () => { if (partito) caduto(p, g); else ko(new Error("MJPEG")); };
    im.src = `/api/camera_proxy_stream/${encodeURIComponent(p.id)}?token=${encodeURIComponent(tok)}`;
  });
}
function foto(p, g) {
  if (!attr(p.id, "entity_picture")) return Promise.resolve(false);
  const im = immagine(p);
  return new Promise(ok => {
    let n = 0, primo = true;
    const prossima = () => {
      const u = attr(p.id, "entity_picture"); if (!u || g !== p.gen) return;
      const nuova = new Image();
      nuova.onload = () => { if (g !== p.gen) return; im.src = nuova.src; if (primo) { primo = false; ok(true); } };
      nuova.src = u + (u.includes("?") ? "&" : "?") + "v=" + Date.now() + "_" + n++;
    };
    prossima();
    const tm = setInterval(prossima, 2000);
    p.pulizie.push(() => clearInterval(tm));
  });
}
const PROVA = { webrtc, hls, mjpeg, foto };

/* ================= comandi ================= */
function audio(p) {
  const v = p.scena.querySelector("video"); if (!v) return;
  v.muted = !v.muted; if (!v.muted) v.play().catch(() => {});
  comandi(p);
}
/* tutto schermo: quello del browser se c'è; sull'iPhone il video a schermo intero; altrimenti riempio la finestra */
const schermoIntero = () => document.fullscreenElement || document.webkitFullscreenElement || null;
async function tutto(p) {
  if (schermoIntero() === p.box) { const r = (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); r?.catch?.(() => {}); return; }
  if (p.box.classList.contains("full")) { esciTutto(p); return; }
  const b = p.box;
  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
    try { if (b.requestFullscreen) { await b.requestFullscreen(); return; } if (b.webkitRequestFullscreen) { b.webkitRequestFullscreen(); return; } } catch {}
  }
  const v = p.scena.querySelector("video");
  if (v?.webkitEnterFullscreen && !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) { try { v.webkitEnterFullscreen(); return; } catch {} }
  b.classList.add("full"); document.body.classList.add("vfull"); comandi(p);
}
function esciTutto(p) { p.box.classList.remove("full"); if (!document.querySelector(".vp1.full")) document.body.classList.remove("vfull"); comandi(p); }
for (const ev of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(ev, () => ATTIVI.forEach(comandi));
/* Esc esce prima dal «tutto schermo» finto, poi chiude il foglio */
window.addEventListener("keydown", e => { if (e.key !== "Escape") return; const p = [...ATTIVI].find(x => x.box.classList.contains("full")); if (p) { e.stopImmediatePropagation(); esciTutto(p); } }, true);

/** 📸 il fotogramma che si vede adesso (se non si può, una foto fresca da Home Assistant), salvato o condiviso */
async function scatta(p) {
  let blob = null;
  const el = p.scena.querySelector("video, img"), w = el?.videoWidth || el?.naturalWidth, h = el?.videoHeight || el?.naturalHeight;
  if (w && h) try {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(el, 0, 0, w, h);
    blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
  } catch { blob = null; }
  if (!blob && tokenDi(p.id)) try { const r = await fetch(`/api/camera_proxy/${encodeURIComponent(p.id)}?token=${encodeURIComponent(tokenDi(p.id))}`, { cache: "no-store" }); if (r.ok) blob = await r.blob(); } catch {}
  if (!blob) { toast(t("Istantanea non riuscita", "Snapshot failed"), true); return; }
  const f = p.box.querySelector(".vpf1"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");   // lampo
  const d = new Date(), z = n => String(n).padStart(2, "0");
  const nome = `${nm(p.id).replace(/[\\/:*?"<>|]+/g, " ").trim() || "camera"} ${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}.${z(d.getMinutes())}.${z(d.getSeconds())}.jpg`;
  /* su telefono e tablet il foglio «Condividi» permette di salvarla nelle Foto */
  if (/iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) {
    try { const file = new File([blob], nome, { type: "image/jpeg" }); if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: nm(p.id) }); return; } }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.style.display = "none";
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  toast("📸 " + t("Istantanea salvata", "Snapshot saved"));
}

/* ================= montaggio e chiusura automatici ================= */
const visibile = box => !box.closest("#sheet") || $("#sheet").classList.contains("open");
let inCoda = false;
function sync() {
  inCoda = false;
  /* cambio di pagina della plancia con la diretta aperta: chiudo il foglio (e quindi lo stream) */
  if ([...ATTIVI].some(p => p.box.closest("#sheet") && UI.page !== p.pagina) && UI.sheet) closeSheet();
  for (const p of [...ATTIVI]) if (!p.box.isConnected || !visibile(p.box) || p.box.dataset.cam !== p.id) smonta(p);
  for (const box of document.querySelectorAll(".vp1[data-cam]")) if (!box._p && visibile(box)) monta(box);
}
const presto = () => { if (!inCoda) { inCoda = true; queueMicrotask(sync); } };
new MutationObserver(presto).observe(document.body, { childList: true, subtree: true });
new MutationObserver(presto).observe($("#sheet"), { attributes: true, attributeFilter: ["class"] });
/* plancia in secondo piano (altra app, schermo spento): chiudo gli stream e li riapro al ritorno */
document.addEventListener("visibilitychange", () => {
  for (const p of ATTIVI) {
    if (document.hidden) { if (p.gen) { ferma(p); p.sospeso = true; } }
    else if (p.sospeso) { p.sospeso = false; p.cadute = 0; avvia(p); }
  }
});

/* Sfondi della plancia: una galleria di sfondi statici e animati, disegnati qui in CSS, SVG e canvas (css/sfondi.css),
   più la tua immagine. Si sceglie in ⚙️ Impostazioni → 🎨 Aspetto → «Sfondo».
   - Scelta per dispositivo (localStorage «nduja_sfondo»: { id, o: { [id]: opzioni } }); senza scelta vale lo sfondo della casa,
     scelto dall'amministratore (LAYOUT.aspetto.sfondo, stessa forma). Senza nessuna scelta: 'Nduja classico animato, come prima.
   - Opzioni: velocità e intensità (animati), velo per leggere meglio le schede, colori e direzione, immagine con sfocatura.
     Ogni sfondo ha la sua versione chiara e scura: segue il tema.
   - Leggerezza: con la grafica leggera gli animati si fermano (restano fermi ma belli), salvo «animato anche in leggera»;
     niente 60 fps (il canvas va a 24 al secondo, 12 nelle miniature), tutto si ferma quando la pagina non si vede o c'è il
     salvaschermo, e con «Riduci movimento».
   Lo usa anche il salvaschermo «✨ Sfondo animato» (salvaschermo.js, montaSfondo). */
import { ACT, CHG, FISSI, LAYOUT, UI, t, esc, sGet, sSet, sDel, ws, toast, openSheet, closeSheet, render, isAdmin, leggera, menoMoto } from "./core.js";
import { cambia, indirizzoLocale, fileEsiste } from "./edit.js";
import { mix } from "./scenaenergia.js";
import { montaStile } from "./salvaschermo.js";
import { inPeriodo, fine as fineFesta, dataTesto } from "./festa.js";
import { voceFrasi } from "./oggetti.js";

/* ================= catalogo ================= */
/** [id, icona, nome, descrizione, animato, gruppo] (gruppo «natale»: gli sfondi di Natale, in un gruppo a parte) */
export const SFONDI = () => [
  ["classico", "🌶️", t("'Nduja classico", "'Nduja classic"), t("Le luci sfocate e il peperoncino, fermi", "Soft lights and the chili, still"), false],
  ["tinta", "🎨", t("Tinta unita", "Solid colour"), t("Un colore a scelta", "A colour you pick"), false],
  ["sfumatura", "🌈", t("Sfumatura", "Gradient"), t("Due colori e la direzione", "Two colours and a direction"), false],
  ["grana", "📜", t("Carta", "Paper"), t("Un colore con la grana della carta", "A colour with a paper grain"), false],
  ["notte", "🌑", t("Notte", "Night"), t("Scurissimo, per la camera", "Very dark, for the bedroom"), false],
  ["immagine", "🖼️", t("La tua immagine", "Your image"), t("Dai Media o da /local/, sfocata e scurita a piacere", "From Media or /local/, blurred and dimmed as you like"), false],
  ["vivo", "🌶️", t("'Nduja classico", "'Nduja classic"), t("Le luci che si muovono piano", "The slowly moving lights"), true],
  ["aurora", "🌌", t("Aurora", "Aurora"), t("Veli di luce che ondeggiano lenti", "Veils of light swaying slowly"), true],
  ["onde", "🌊", t("Onde", "Waves"), t("Onde morbide che scorrono", "Soft waves rolling by"), true],
  ["stelle", "✨", t("Stelle", "Stars"), t("Stelle che brillano (di giorno, pulviscolo)", "Twinkling stars (by day, floating specks)"), true],
  ["bokeh", "🫧", t("Bokeh", "Bokeh"), t("Luci fuori fuoco che galleggiano", "Out-of-focus lights drifting"), true],
  ["cielo", "🌅", t("Cielo vivo", "Live sky"), t("Il cielo di adesso, con l'ora e il meteo di casa", "The sky right now, from your home's time and weather"), true],
  ["neve", "❄️", t("Neve", "Snow"), t("Fiocchi che scendono piano, con luci calde sfocate", "Flakes falling slowly, with soft warm lights"), true, "natale"],
  ["lucifesta", "🎄", t("Luci di festa", "Festive lights"), t("Luci rosse, oro e verdi che respirano piano", "Red, gold and green lights gently breathing"), true, "natale"],
  ["nottenatale", "🌟", t("Notte di Natale", "Christmas night"), t("Neve, stelle e finestre accese, ferma", "Snow, stars and lit windows, still"), false, "natale"],
];
/** gli sfondi di Natale (per «Automatico a Natale») */
export const NATALIZI = ["neve", "lucifesta", "nottenatale"];
const INFO = id => SFONDI().find(s => s[0] === id) || SFONDI()[6];
export const animato = id => !!INFO(id)[4];
const ID = new Set(SFONDI().map(s => s[0]));
/* valori di partenza di ogni sfondo: vel 1 lenta · 2 normale · 3 veloce; int 1 tenue · 2 normale · 3 forte; osc = velo (0-0,8);
   c/c1/c2 colori del tema scuro (nel chiaro si schiariscono da soli, salvo «uguali»); dir = direzione della sfumatura */
const DEF = {
  classico: { osc: 0 }, vivo: { osc: 0, vel: 2, int: 2 },
  tinta: { osc: 0, c: "#14213d", uguali: false },
  sfumatura: { osc: 0, c1: "#1b2a6b", c2: "#4a1d4f", dir: "135", uguali: false },
  grana: { osc: 0, c: "#1b1915", uguali: false },
  notte: { osc: 0 },
  immagine: { osc: .35, fonte: "url", url: "", media: "", nome: "", sfoca: 0 },
  aurora: { osc: .05, vel: 2, int: 2 }, onde: { osc: 0, vel: 2, int: 2 }, stelle: { osc: 0, vel: 2, int: 2 },
  bokeh: { osc: .05, vel: 2, int: 2 }, cielo: { osc: .25, vel: 2 },
  neve: { osc: .05, vel: 2, int: 2 }, lucifesta: { osc: .05, vel: 2, int: 2 }, nottenatale: { osc: 0 },
};
export const opzioni = (c, id) => ({ ...DEF[id], ...(c?.o?.[id] || {}) });

/* ================= scelte ================= */
const J = (k, d) => { try { return JSON.parse(sGet(k) || "null") ?? d; } catch { return d; } };
const valido = c => c && ID.has(c.id) ? c : null;
/** lo sfondo della casa (amministratore) */
export const diCasa = () => valido(LAYOUT.aspetto?.sfondo) || { id: "vivo" };
/** la scelta di questo dispositivo: null = usa quello della casa */
export const diDispositivo = () => valido(J("sfondo", null));
/** «Automatico a Natale» su questo dispositivo: nel periodo di festa uno sfondo di Natale, poi torna da solo quello scelto */
export const natAuto = () => sGet("sfNatale") === "1";
export const natId = () => NATALIZI.includes(sGet("sfNatId")) ? sGet("sfNatId") : "neve";
/** lo sfondo di Natale sta sostituendo quello scelto? */
export const natAttivo = () => natAuto() && inPeriodo();
/** lo sfondo scelto (del dispositivo o della casa), senza Natale */
const scelto = () => diDispositivo() || diCasa();
/** quello che si vede adesso su questo dispositivo (la scelta non si tocca: a Natale passato torna da sola) */
export const attuale = () => natAttivo() ? { id: natId(), o: scelto().o || {}, natale: true } : scelto();
/** «animato anche con la grafica leggera» (per dispositivo) */
const animaInLeggera = () => sGet("sfLite") === "1";
/** gli animati sono fermi? (grafica leggera, «riduci movimento») */
export const fermo = () => menoMoto() || (leggera() && !animaInLeggera());
const scuro = () => !document.body.classList.contains("light");

/* ================= disegno ================= */
const r1 = n => Math.round(n * 10) / 10;
const caso = seme => { let s = seme % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
/** colore scelto per il tema scuro → quello del tema chiaro (più chiaro e un po' grigio), salvo «uguali» */
const tinta = (c, o, chiaro, verso = "#ffffff", k = .7) => !chiaro || o.uguali ? c : mix(c, verso, k);
const hexOk = c => /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : null;
const SV = { 1: .55, 2: 1, 3: 1.8 }, SI = { 1: .6, 2: 1, 3: 1.45 };
/* grana della carta: rumore disegnato una volta dal browser (feTurbulence), in un quadratino che si ripete */
const GRANA = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .55 0"/></filter><rect width="180" height="180" filter="url(#g)"/></svg>`)}")`;
/* onda che si ripete: due periodi uguali in 1600 (si sposta di metà e ricomincia senza salti) */
const ONDA = (a, b) => `M0 ${b}C200 ${b - a} 200 ${b - a} 400 ${b}S600 ${b + a} 800 ${b}S1000 ${b - a} 1200 ${b}S1400 ${b + a} 1600 ${b}V200H0Z`;
/* luci di festa: rosso, oro e verde che respirano (colori 0-2), più grandi e più morbide del bokeh */
const FESTA = (() => { const r = caso(1225); return Array.from({ length: 16 }, (_, i) => ({ x: r1(r() * 100), y: r1(10 + r() * 85), s: r1(9 + r() * 20), c: i % 3, d: r1(7 + r() * 9), dl: r1(-r() * 12) })); })();
/* notte di Natale: stelle fisse e abeti sulle colline (sempre uguali) */
const NN_STELLE = (() => { const r = caso(2412); return Array.from({ length: 70 }, () => [Math.round(r() * 1600), Math.round(r() * 430), r1(.6 + r() * 1.5), r1(.35 + r() * .6)]); })();
const BOKEH = (() => { const r = caso(2026); return Array.from({ length: 13 }, (_, i) => ({ x: r1(r() * 100), y: r1(r() * 100), s: r1(10 + r() * 22), c: i % 4, d: r1(26 + r() * 30), dl: r1(-r() * 40), dx: r1((r() - .5) * 16), dy: r1((r() - .5) * 14) })); })();

/** l'HTML degli strati di uno sfondo (dentro .sf1) e le variabili CSS */
function strati(id, o, chiaro) {
  const v = [`--sv:${SV[o.vel] || 1}`, `--si:${SI[o.int] || 1}`, `--osc:${Math.max(0, Math.min(.85, +o.osc || 0))}`];
  let h = "";
  if (id === "classico" || id === "vivo") h = `<i class="sfc1"></i><i class="sfc2"></i><i class="sfch"></i>`;
  else if (id === "tinta") v.push(`--c1:${tinta(hexOk(o.c) || DEF.tinta.c, o, chiaro)}`);
  else if (id === "sfumatura") {
    const a = tinta(hexOk(o.c1) || DEF.sfumatura.c1, o, chiaro), b = tinta(hexOk(o.c2) || DEF.sfumatura.c2, o, chiaro);
    v.push(`--gr:${o.dir === "rad" ? `radial-gradient(120% 120% at 50% 40%,${a},${b})` : `linear-gradient(${["180", "135", "90", "45"].includes(String(o.dir)) ? o.dir : "135"}deg,${a},${b})`}`);
  } else if (id === "grana") { v.push(`--c1:${tinta(hexOk(o.c) || DEF.grana.c, o, chiaro, "#f6f0e2", .84)}`); h = `<i class="sfg1" style="background-image:${GRANA}"></i>`; }
  else if (id === "notte") h = `<i class="sfn1"></i>`;
  else if (id === "immagine") h = `<i class="sfim" style="--bl:${Math.max(0, Math.min(30, +o.sfoca || 0))}px"></i>`;
  else if (id === "aurora") h = `<i class="sfa1"></i><i class="sfa2"></i><i class="sfa3"></i><i class="sfa4"></i>`;
  else if (id === "onde") h = [[22, 150, 1], [16, 160, 2], [12, 172, 3]].map(([a, b, n]) => `<svg class="sfw sfw${n}" viewBox="0 0 1600 200" preserveAspectRatio="none" aria-hidden="true"><path d="${ONDA(a, b)}"/></svg>`).join("") + `<i class="sfwl"></i>`;
  else if (id === "stelle") h = `<canvas class="sfcv"></canvas>`;
  else if (id === "bokeh") h = BOKEH.map(b => `<i class="sfb sfb${b.c}" style="left:${b.x}%;top:${b.y}%;width:${b.s}cqmax;height:${b.s}cqmax;--dx:${b.dx}cqw;--dy:${b.dy}cqh;animation-duration:calc(${b.d}s / var(--sv));animation-delay:${b.dl}s"></i>`).join("");
  else if (id === "cielo") h = `<div class="sfsk"></div>`;
  else if (id === "neve") h = `<i class="sfnl"></i><canvas class="sfcv"></canvas>`;
  else if (id === "lucifesta") h = FESTA.map(b => `<i class="sfx sfx${b.c}" style="left:${b.x}%;top:${b.y}%;width:${b.s}cqmax;height:${b.s}cqmax;animation-duration:calc(${b.d}s / var(--sv));animation-delay:${b.dl}s"></i>`).join("") + `<i class="sfxv"></i>`;
  else if (id === "nottenatale") h = notteNatale(chiaro);
  return { h, v: v.join(";") };
}

/* ---------- stelle e pulviscolo (canvas, 24 al secondo) ---------- */
function stelle(cv, o, mini, isFermo, chiaro) {
  const ctx = cv.getContext("2d"); if (!ctx) return () => {};
  const D = Math.min(1.5, window.devicePixelRatio || 1), r = caso(777), dark = !chiaro, k = SI[o.int] || 1, sp = SV[o.vel] || 1;
  let W = 0, H = 0, P = [], T = null, stop = false, ultima = 0, cometa = null;
  const misura = () => {
    const R = cv.getBoundingClientRect(); W = Math.max(1, R.width); H = Math.max(1, R.height);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); ctx.setTransform(D, 0, 0, D, 0, 0);
    const n = Math.round(Math.min(dark ? 260 : 90, W * H / (mini ? (dark ? 700 : 1600) : dark ? 5200 : 14000)) * k);
    const rr = caso(31);
    P = Array.from({ length: n }, () => ({ x: rr() * W, y: rr() * H, z: .3 + rr() * .7, f: rr() * 6.28, q: .6 + rr() * 1.6, c: Math.floor(rr() * 4) }));
  };
  const COL = dark ? ["#ffffff", "#cfe0ff", "#fff1d6", "#dcd4ff"] : ["#5a7bd8", "#7f68d8", "#2fa6b8", "#d08a4a"];
  const passo = ts => {
    if (stop) return;
    if (!cv.isConnected) { stop = true; return; }
    T = requestAnimationFrame(passo);
    if (document.hidden || UI.ss) return;
    if (ts - ultima < 1000 / (mini ? 12 : 24)) return;
    const dt = ultima ? Math.min(.2, (ts - ultima) / 1000) : 0; ultima = ts;
    disegna(ts / 1000, dt);
  };
  function disegna(s, dt) {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      /* di notte le stelle salgono pianissimo e brillano; di giorno il pulviscolo sale e ondeggia */
      p.y -= dt * sp * (dark ? 1.2 : 7) * p.z; p.x += dt * sp * (dark ? .6 : Math.sin(s * .4 + p.f) * 5) * p.z;
      if (p.y < -4) { p.y = H + 4; p.x = r() * W; } if (p.x > W + 4) p.x = -4; if (p.x < -4) p.x = W + 4;
      const a = dark ? (.35 + .65 * (.5 + .5 * Math.sin(s * (1.1 + p.q) + p.f))) * p.z : (.18 + .22 * p.z);
      ctx.globalAlpha = Math.min(1, a * (dark ? 1 : k)); ctx.fillStyle = COL[p.c];
      ctx.beginPath(); ctx.arc(p.x, p.y, (dark ? .45 + p.q * .55 : 1.2 + p.q * 1.6) * (mini ? .75 : 1) * p.z, 0, 6.283); ctx.fill();
    }
    /* una stella cadente ogni tanto (solo di notte, non nelle miniature) */
    if (dark && !mini && dt) {
      if (!cometa && r() < dt / 14) cometa = { x: W * (.3 + r() * .6), y: H * r() * .35, t: 0 };
      if (cometa) {
        cometa.t += dt; const q = cometa.t / .9, x = cometa.x - q * W * .22, y = cometa.y + q * H * .12;
        const g = ctx.createLinearGradient(x, y, x + 80, y - 44); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = 1 - q; ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 80, y - 44); ctx.stroke();
        if (q >= 1) cometa = null;
      }
    }
    ctx.globalAlpha = 1;
  }
  misura();
  let ro = null; try { ro = new ResizeObserver(() => { misura(); if (isFermo) disegna(0, 0); }); ro.observe(cv); } catch {}
  if (isFermo) disegna(0, 0); else T = requestAnimationFrame(passo);
  return () => { stop = true; cancelAnimationFrame(T); try { ro?.disconnect(); } catch {} };
}

/* ---------- neve (canvas, 24 al secondo): fiocchi a tre profondità che scendono ondeggiando ---------- */
function neve(cv, o, mini, isFermo, chiaro) {
  const ctx = cv.getContext("2d"); if (!ctx) return () => {};
  const D = Math.min(1.5, window.devicePixelRatio || 1), k = SI[o.int] || 1, sp = SV[o.vel] || 1;
  let W = 0, H = 0, P = [], T = null, stop = false, ultima = 0;
  const misura = () => {
    const R = cv.getBoundingClientRect(); W = Math.max(1, R.width); H = Math.max(1, R.height);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); ctx.setTransform(D, 0, 0, D, 0, 0);
    const n = Math.round(Math.min(mini ? 60 : 200, W * H / (mini ? 900 : 6500)) * k), rr = caso(1912);
    P = Array.from({ length: n }, () => { const z = rr() < .5 ? .35 + rr() * .2 : rr() < .7 ? .6 + rr() * .2 : .85 + rr() * .15; return { x: rr() * W, y: rr() * H, z, f: rr() * 6.28, q: .7 + rr() * .6 }; });
  };
  const COL = chiaro ? "#ffffff" : "#f4f8ff", OMB = "rgba(50,75,120,.42)";
  const passo = ts => {
    if (stop) return;
    if (!cv.isConnected) { stop = true; return; }
    T = requestAnimationFrame(passo);
    if (document.hidden || (UI.ss && !cv.closest(".ss1"))) return;
    if (ts - ultima < 1000 / (mini ? 12 : 24)) return;
    const dt = ultima ? Math.min(.2, (ts - ultima) / 1000) : 0; ultima = ts;
    disegna(ts / 1000, dt);
  };
  function disegna(s, dt) {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.y += dt * sp * (10 + 34 * p.z) * (mini ? .5 : 1); p.x += dt * sp * Math.sin(s * .5 + p.f) * 9 * p.z;
      if (p.y > H + 6) { p.y = -6; p.x = Math.random() * W; } if (p.x > W + 6) p.x = -6; if (p.x < -6) p.x = W + 6;
      const r = (mini ? .7 : 1) * (.9 + p.z * 2.9) * p.q;
      if (chiaro) { ctx.globalAlpha = .9 * p.z; ctx.fillStyle = OMB; ctx.beginPath(); ctx.arc(p.x, p.y + .5, r + 1.1, 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = Math.min(1, (.3 + .7 * p.z) * (chiaro ? 1 : .9)); ctx.fillStyle = COL;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  misura();
  let ro = null; try { ro = new ResizeObserver(() => { misura(); if (isFermo) disegna(0, 0); }); ro.observe(cv); } catch {}
  if (isFermo) disegna(0, 0); else T = requestAnimationFrame(passo);
  return () => { stop = true; cancelAnimationFrame(T); try { ro?.disconnect(); } catch {} };
}

/* ---------- notte di Natale (ferma): cielo, stelle, colline innevate, abeti e una casa con le finestre accese ---------- */
function abete(x, y, h, col, luci) {
  const w = h * .42, P = [[0, 0], [w * .5, h * .38], [w * .28, h * .38], [w * .72, h * .7], [w * .42, h * .7], [w, h], [-w, h], [-w * .42, h * .7], [-w * .72, h * .7], [-w * .28, h * .38], [-w * .5, h * .38]];
  const L = luci ? [[-.2, .5], [.25, .58], [-.45, .86], [0, .8], [.5, .9], [.1, .35]].map(([a, b], i) => `<circle cx="${r1(x + a * w)}" cy="${r1(y + b * h)}" r="${r1(h * .028)}" fill="${["#ffcf72", "#ff6b6b", "#7ee3a0"][i % 3]}"/>`).join("") : "";
  return `<path d="M${P.map(([a, b]) => r1(x + a) + " " + r1(y + b)).join("L")}Z" fill="${col}"/>${L}`;
}
function notteNatale(chiaro) {
  const C = chiaro ? { a: "#c9d6ee", b: "#e7e2ee", c: "#f6dccb", st: "#ffffff", h1: "#f3f6fb", h2: "#e6ecf5", h3: "#dbe3ef", ab: "#5d7a72", ab2: "#7d968f", casa: "#8a6f64", tetto: "#f7f9fc", fin: "#ffbe5c" }
    : { a: "#040817", b: "#0c1636", c: "#1e2b57", st: "#ffffff", h1: "#a9b8d4", h2: "#8193b7", h3: "#62779f", ab: "#0a1324", ab2: "#101c33", casa: "#1a1d2c", tetto: "#c9d5ea", fin: "#ffc35c" };
  const stelle = chiaro ? "" : NN_STELLE.map(([x, y, r, a]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.st}" opacity="${a}"/>`).join("");
  return `<svg class="sfnn" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="sfnnc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.a}"/><stop offset=".55" stop-color="${C.b}"/><stop offset="1" stop-color="${C.c}"/></linearGradient>
      <radialGradient id="sfnnf"><stop offset="0" stop-color="${C.fin}" stop-opacity=".55"/><stop offset="1" stop-color="${C.fin}" stop-opacity="0"/></radialGradient>
      <radialGradient id="sfnnl"><stop offset="0" stop-color="${chiaro ? "#ffffff" : "#fff6dc"}" stop-opacity="${chiaro ? .9 : .35}"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient></defs>
    <rect width="1600" height="900" fill="url(#sfnnc)"/>${stelle}
    <circle cx="1270" cy="170" r="140" fill="url(#sfnnl)"/><circle cx="1270" cy="170" r="${chiaro ? 0 : 34}" fill="#f4efe0"/><circle cx="1284" cy="160" r="${chiaro ? 0 : 30}" fill="${C.b}"/>
    <path d="M0 610C220 560 420 590 640 570S1060 520 1300 566S1520 560 1600 556V900H0Z" fill="${C.h3}"/>
    ${[[160, 520, 110], [255, 545, 80], [1380, 500, 120], [1480, 530, 90], [1060, 520, 70]].map(([x, y, h]) => abete(x, y, h, C.ab2, false)).join("")}
    <path d="M0 700C260 650 520 690 800 668S1300 640 1600 676V900H0Z" fill="${C.h2}"/>
    <g transform="translate(700 560)"><rect x="0" y="40" width="170" height="104" fill="${C.casa}"/><path d="M-16 48L85 -16L186 48Z" fill="${C.tetto}"/><rect x="120" y="-6" width="18" height="34" fill="${C.casa}"/>
      <rect x="22" y="64" width="34" height="30" rx="3" fill="${C.fin}"/><rect x="114" y="64" width="34" height="30" rx="3" fill="${C.fin}"/><rect x="70" y="86" width="30" height="58" rx="3" fill="${C.fin}" opacity=".85"/>
      <ellipse cx="85" cy="150" rx="150" ry="40" fill="url(#sfnnf)"/></g>
    ${abete(560, 560, 150, C.ab, true)}${abete(1000, 600, 120, C.ab, true)}
    <path d="M0 780C300 744 640 770 960 756S1400 738 1600 760V900H0Z" fill="${C.h1}"/>
  </svg>`;
}

/* ---------- la tua immagine ---------- */
const URLM = {};
/** indirizzo dell'immagine: /local/… così com'è, quella dei Media chiesta a Home Assistant (firmata, la tengo 20 minuti) */
async function indirizzoImmagine(o) {
  if (o.fonte !== "media") return indirizzoLocale(o.url) || null;
  if (!o.media) return null;
  const c = URLM[o.media]; if (c && Date.now() - c.t < 20 * 60000) return c.u;
  try { const u = (await ws({ type: "media_source/resolve_media", media_content_id: o.media })).url; URLM[o.media] = { u, t: Date.now() }; return u; } catch { return null; }
}

/** monta uno sfondo dentro un contenitore: { stop } (mini = miniatura o anteprima: misure in proporzione;
    scuro = sempre la versione scura, per il salvaschermo) */
export function montaSfondo(root, id, o, { mini = false, scuro: soloScuro = false, fermo: forzaFermo = false } = {}) {
  if (!ID.has(id)) id = "vivo";
  const chiaro = !soloScuro && !scuro(), isFermo = animato(id) && (forzaFermo || fermo()), { h, v } = strati(id, o, chiaro);
  const el = document.createElement("div");
  el.className = `sf1 sf-${id}${animato(id) ? " anim" : ""}${isFermo ? " fermo" : ""}${mini ? " mini" : ""}${chiaro ? " chiaro" : ""}`;
  el.setAttribute("style", v); el.innerHTML = h + `<i class="sfv"></i>`;
  root.replaceChildren(el);
  if (mini) { const W = root.getBoundingClientRect().width || 160; el.style.setProperty("--k", String(r1(Math.min(1, W / Math.max(320, innerWidth)) * 100) / 100)); }
  const ctl = { el, stop: () => {} };
  if (id === "stelle") { const s = stelle(el.querySelector("canvas"), o, mini, isFermo, chiaro); ctl.stop = s; }
  else if (id === "neve") { const s = neve(el.querySelector("canvas"), o, mini, isFermo, chiaro); ctl.stop = s; }
  else if (id === "cielo") {
    const sk = montaStile(el.querySelector(".sfsk"), "cielo", { cfg: { info: [], vel: o.vel || 2 }, sfondo: true });
    ctl.stop = () => sk.stop();
  } else if (id === "immagine") {
    let vivo = true;
    indirizzoImmagine(o).then(u => { if (!vivo || !u) { if (vivo) el.classList.add("vuota"); return; }
      const im = new Image(); im.onload = () => { if (vivo) { el.querySelector(".sfim").style.backgroundImage = `url(${JSON.stringify(u)})`; el.classList.add("pronta"); } };
      im.onerror = () => { if (vivo) el.classList.add("vuota"); }; im.src = u; });
    ctl.stop = () => { vivo = false; };
  }
  return ctl;
}

/* ================= lo sfondo vero della plancia (.bg) ================= */
let BG = null;
function applica() {
  const bg = document.querySelector(".bg"); if (!bg) return;
  const c = attuale(), o = opzioni(c, c.id);
  const chiave = JSON.stringify([c.id, o, scuro(), fermo(), innerWidth > 760]);
  if (BG && BG.chiave === chiave && BG.el.isConnected) return;
  BG?.stop();
  bg.classList.add("sf");
  BG = montaSfondo(bg, c.id, o); BG.chiave = chiave;
}
FISSI.push(applica);
FISSI.push(miniature);
setTimeout(applica, 0);   // prima ancora del collegamento (salvaschermo.js è già pronto: niente import a metà)
try { matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", applica); } catch {}
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(applica, 50)); } catch {}

/* ================= Impostazioni → 🎨 Aspetto ================= */
/** la riga «Sfondo» nella scheda Aspetto */
export function sfondoVoce() {
  const d = diDispositivo(), c = attuale(), [, ic, n] = INFO(c.id), casa = INFO(diCasa().id), pr = INFO(scelto().id);
  return `<button class="li sf1r" data-act="sfApri" data-v="disp"><i class="sf1m" data-sf="${c.id}" data-sfo="${esc(JSON.stringify(opzioni(c, c.id)))}"><i class="sf1mi" data-keep></i></i>
      <div class="tx"><b>${ic} ${esc(n)}${animato(c.id) ? ` <small class="sf1tag">${t("animato", "animated")}</small>` : ""}</b><span>${c.natale ? "🎄 " + t(`Automatico a Natale, fino al ${dataTesto(fineFesta())}; poi torna «${pr[2]}»`, `Automatic at Christmas, until ${dataTesto(fineFesta())}; then «${pr[2]}» comes back`) : d ? t("Scelto per questo dispositivo", "Chosen for this device") : t("Lo sfondo della casa", "The home's background")}</span></div><span class="st">›</span></button>
    ${isAdmin() ? `<button class="li" data-act="sfApri" data-v="casa"><span class="ic">🏠</span><div class="tx"><b>${t("Sfondo della casa", "Home background")}: ${esc(casa[2])}${animato(casa[0]) ? " · " + t("animato", "animated") : ""}</b><span>${t("Quello di tutti i dispositivi che non ne hanno scelto uno", "The one used by every device that hasn't picked its own")}</span></div><span class="st">›</span></button>` : ""}
    ${natVoce()}`;
}
/** «🎄 Automatico a Natale» (per dispositivo): interruttore e quale sfondo di Natale */
function natVoce() {
  const on = natAuto();
  return `<div class="sf1nat"><div class="row between" style="gap:10px"><div class="tx"><b>🎄 ${t("Automatico a Natale", "Automatic at Christmas")}</b><span>${t("Su questo dispositivo, nel periodo di festa", "On this device, during the festive season")}</span></div>
      <button class="sw ${on ? "on" : ""}" data-act="sfNat" aria-label="${t("Automatico a Natale", "Automatic at Christmas")}"><i></i></button></div>
    ${on ? `<div class="seg" style="margin-top:8px">${NATALIZI.map(k => `<button class="${natId() === k ? "act" : ""}" data-act="sfNatId" data-v="${k}">${INFO(k)[1]} ${esc(INFO(k)[2])}</button>`).join("")}</div>` : ""}
    <p class="small muted" style="margin-top:6px">${t(`Nel periodo di festa (fino al ${dataTesto(fineFesta())}) metto uno sfondo di Natale; finite le feste torna da solo quello scelto, che non cancello. Il periodo si cambia in ⚙️ Impostazioni → Natale.`, `During the festive season (until ${dataTesto(fineFesta())}) I show a Christmas background; after the holidays the chosen one comes back by itself (I don't delete it). Change the season in ⚙️ Settings → Christmas.`)}</p></div>`;
}
export function aspettoCard() {
  return `<section class="card"><div class="ch"><h2>🎨 ${t("Aspetto", "Appearance")}</h2></div><div class="stack">${sfondoVoce()}${voceFrasi()}</div>
    <p class="small muted" style="margin-top:8px">${t("Sfondi statici e animati, tutti disegnati dalla plancia, oppure una tua immagine. Ogni dispositivo può avere il suo, e le sue frasi degli oggetti.", "Still and animated backgrounds, all drawn by the dashboard, or an image of yours. Every device can have its own, and its own object sentences.")}</p></section>`;
}

/* ---------- il foglio «Sfondo» ---------- */
const ED = { dove: "disp", sel: null };
/** la configurazione che si sta modificando (del dispositivo o della casa) */
const inModifica = () => ED.dove === "casa" ? diCasa() : (diDispositivo() || { ...diCasa(), daCasa: true });
async function salvaCfg(nuova, msg) {
  if (ED.dove === "casa") {
    if (!isAdmin()) return;
    await cambia(l => { l.aspetto = { ...(l.aspetto || {}), sfondo: { id: nuova.id, o: nuova.o || {} } }; }, msg).catch(e => toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code || e), true));
  } else { sSet("sfondo", JSON.stringify({ id: nuova.id, o: nuova.o || {} })); if (msg) toast(msg); }
  BG = null; render(true);
}
function cambiaOpz(k, v) {
  const c = inModifica(), id = c.id, o = { ...(c.o || {}) };
  o[id] = { ...(o[id] || {}), [k]: v };
  return salvaCfg({ id, o });
}
const seg = (act, cur, opts, x = "") => `<div class="seg">${opts.map(([k, n]) => `<button class="${String(cur) === String(k) ? "act" : ""}" data-act="${act}" data-v="${k}" ${x}>${n}</button>`).join("")}</div>`;
const riga = (nome, corpo) => `<div class="sz1o"><span>${nome}</span>${corpo}</div>`;
function opzioniDi(c) {
  const id = c.id, o = opzioni(c, id), out = [];
  const colore = (k, n) => `<label class="sf1col"><input type="color" data-chg="sfCol" data-k="${k}" value="${esc(hexOk(o[k]) || DEF[id][k])}"><span>${n}</span></label>`;
  if (animato(id)) {
    out.push(riga(t("Velocità", "Speed"), seg("sfOpz", o.vel, [[1, t("Lenta", "Slow")], [2, t("Normale", "Normal")], [3, t("Veloce", "Fast")]], `data-k="vel"`)));
    if (id !== "cielo") out.push(riga(t("Intensità", "Intensity"), seg("sfOpz", o.int, [[1, t("Tenue", "Soft")], [2, t("Normale", "Normal")], [3, t("Forte", "Strong")]], `data-k="int"`)));
  }
  if (id === "tinta" || id === "grana") out.push(riga(t("Colore", "Colour"), colore("c", t("tema scuro", "dark theme"))));
  if (id === "sfumatura") {
    out.push(riga(t("Colori", "Colours"), `<div class="row" style="gap:10px;flex-wrap:wrap">${colore("c1", t("primo", "first"))}${colore("c2", t("secondo", "second"))}</div>`));
    out.push(riga(t("Direzione", "Direction"), seg("sfOpz", o.dir, [["180", "↓"], ["135", "↘"], ["90", "→"], ["45", "↗"], ["rad", "◎ " + t("dal centro", "from the centre")]], `data-k="dir"`)));
  }
  if (["tinta", "sfumatura", "grana"].includes(id)) out.push(riga(t("Nel tema chiaro", "In light theme"), seg("sfOpz", o.uguali ? "1" : "0", [["0", t("Più chiari", "Lighter")], ["1", t("Uguali", "The same")]], `data-k="uguali"`))
    + `<p class="small muted">${t("Con «Più chiari» la plancia schiarisce da sola i colori quando il tema è chiaro, così le schede restano leggibili.", "With «Lighter» the dashboard lightens the colours by itself in light theme, so cards stay readable.")}</p>`);
  if (id === "immagine") {
    const st = o.fonte === "url" && o.url ? fileEsiste(indirizzoLocale(o.url)) : null;
    out.push(riga(t("Da dove", "From"), seg("sfOpz", o.fonte, [["media", "📁 " + t("Media", "Media")], ["url", "🔗 " + t("Indirizzo", "Address")]], `data-k="fonte"`)));
    out.push(o.fonte === "media"
      ? `<button class="li" data-act="sfMedia"><span class="ic">🖼️</span><div class="tx"><b>${o.media ? esc(o.nome || decodeURIComponent(o.media.split("/").pop() || "")) : t("Scegli l'immagine", "Pick the image")}</b><span>${t("Dai Media di Home Assistant (Impostazioni → Media)", "From Home Assistant's Media (Settings → Media)")}</span></div><span class="st">›</span></button>`
      : `<label class="fld1"><span>${t("Indirizzo dell'immagine", "Image address")}</span><input type="text" data-chg="sfUrl" value="${esc(o.url || "")}" placeholder="/local/sfondo.jpg" autocomplete="off"></label>
        ${o.url ? `<div class="small muted sz1st">${st === "ok" ? "✅ " + t("Trovata.", "Found.") : st === "no" ? "⚠️ " + t("Non la trovo: controlla l'indirizzo.", "Not found: check the address.") : "… " + t("Controllo…", "Checking…")}</div>` : ""}
        <p class="small muted">${t("Metti il file nella cartella www di Home Assistant: «/config/www/sfondo.jpg» diventa «/local/sfondo.jpg».", "Put the file in Home Assistant's www folder: «/config/www/background.jpg» becomes «/local/background.jpg».")}</p>`);
    out.push(riga(t("Sfoca", "Blur"), `<div class="sf1rg"><input type="range" min="0" max="30" step="2" value="${+o.sfoca || 0}" data-chg="sfRange" data-k="sfoca"><b>${+o.sfoca || 0} px</b></div>`));
  }
  if (id === "cielo") out.push(`<p class="small muted">${t("Segue l'alba, il giorno, il tramonto e la notte di casa (sun.sun) e il meteo: nuvole, pioggia, neve, nebbia e lampi.", "Follows your home's sunrise, day, sunset and night (sun.sun) and the weather: clouds, rain, snow, fog and lightning.")}</p>`);
  if (id === "notte") out.push(`<p class="small muted">${t("Quasi nero, con un filo di blu in basso: le schede si leggono e lo schermo non illumina la stanza. Nel tema chiaro diventa un grigio tenue.", "Almost black, with a hint of blue at the bottom: cards stay readable and the screen doesn't light up the room. In light theme it becomes a soft grey.")}</p>`);
  const vp = Math.round((+o.osc || 0) * 100);
  out.push(riga(t("Velo", "Veil"), `<div class="sf1rg"><input type="range" min="0" max="80" step="5" value="${vp}" data-chg="sfRange" data-k="osc"><b>${vp}%</b></div>`)
    + `<p class="small muted">${t("Un velo del colore del tema sopra lo sfondo: alzalo se le schede si leggono poco.", "A veil in the theme colour over the background: raise it if cards are hard to read.")}</p>`);
  if (animato(id) && ED.dove === "disp" && leggera() && !menoMoto())
    out.push(riga(t("Grafica leggera", "Light graphics"), seg("sfLite", animaInLeggera() ? "1" : "0", [["0", "⏸ " + t("Fermo", "Still")], ["1", "▶ " + t("Animato lo stesso", "Animated anyway")]]))
      + `<p class="small muted">${t("Su questo dispositivo è attiva la grafica leggera: gli sfondi animati restano fermi per non rallentare. Puoi animarli lo stesso.", "Light graphics is on for this device: animated backgrounds stay still to keep things smooth. You can animate them anyway.")}</p>`);
  if (animato(id) && menoMoto()) out.push(`<p class="small muted">⏸ ${t("Il dispositivo chiede di ridurre il movimento: lo sfondo resta fermo.", "This device asks to reduce motion: the background stays still.")}</p>`);
  return out.join("");
}
function foglio() {
  const c = inModifica(), dove = ED.dove, [, ic, n] = INFO(c.id);
  const gruppo = (anim, titolo) => `<div class="fl1">${titolo}</div><div class="sf1g">${SFONDI().filter(s => anim === "natale" ? s[5] === "natale" : s[4] === anim && !s[5]).map(([id, i, nn, sub]) => {
    const on = c.id === id && !c.daCasa, o = opzioni(c, id), dc = c.daCasa && c.id === id;
    return `<button class="${on ? "act" : dc ? "dc" : ""}" ${dc ? `title="${t("Lo sfondo della casa", "The home's background")}"` : ""} data-act="sfScegli" data-v="${id}"><i class="sf1m" data-sf="${id}" data-sfo="${esc(JSON.stringify(o))}"><i class="sf1mi" data-keep></i></i><b>${i} ${esc(nn)}</b><small>${esc(sub)}</small></button>`; }).join("")}</div>`;
  return `<div class="sh-head"><div><h3>🎨 ${dove === "casa" ? t("Sfondo della casa", "Home background") : t("Sfondo", "Background")}</h3><div class="small muted">${dove === "casa"
      ? t("Vale per tutti i dispositivi che non ne hanno scelto uno.", "Applies to every device that hasn't picked its own.") : t("Scelta di questo dispositivo: gli altri tablet e telefoni non cambiano.", "Choice for this device: other tablets and phones don't change.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${dove === "disp" ? seg("sfCasa", c.daCasa ? "1" : "0", [["1", "🏠 " + t("Usa lo sfondo della casa", "Use the home's background")], ["0", "📱 " + t("Scelgo io", "My own")]]) : ""}
    <div class="sf1pv"><i class="sf1m big" data-sf="${c.id}" data-sfo="${esc(JSON.stringify(opzioni(c, c.id)))}"><i class="sf1mi" data-keep></i></i>
      <div class="sf1es glass" aria-hidden="true"><b>21,5°</b><span>${t("Soggiorno · 3 luci accese", "Living room · 3 lights on")}</span></div>
      <button class="btn sm pri sf1go" data-act="sfProva">▶ ${t("Prova a schermo intero", "Try full screen")}</button></div>
    <div class="small muted" style="margin:6px 0 2px">${ic} ${esc(n)}${c.daCasa ? " · " + t("quello della casa", "the home's one") : ""}</div>
    ${dove === "disp" && natAttivo() ? `<div class="note1">🎄 ${t(`Fino al ${dataTesto(fineFesta())} vedi lo sfondo di Natale («Automatico a Natale»): quello che scegli qui torna dopo le feste.`, `Until ${dataTesto(fineFesta())} you see the Christmas background («Automatic at Christmas»): what you pick here comes back after the holidays.`)}</div>` : ""}
    ${gruppo(false, t("Statici", "Still"))}${gruppo(true, t("Animati", "Animated"))}${gruppo("natale", "🎄 " + t("Natale", "Christmas"))}
    ${c.daCasa ? `<div class="note1">${t("Stai usando lo sfondo della casa: tocca uno sfondo per sceglierne uno tuo.", "You're using the home's background: tap one to pick your own.")}</div>` : `<div class="fl1">${ic} ${esc(n)} · ${t("opzioni", "options")}</div>${opzioniDi(c)}`}`;
}

/* ---------- miniature dal vivo (galleria, riga di Aspetto, anteprima grande) ---------- */
const MINI = new Map();
function miniature() {
  for (const [el, m] of MINI) if (!el.isConnected) { m.stop(); MINI.delete(el); }
  document.querySelectorAll(".sf1m[data-sf]").forEach(el => {
    const id = el.dataset.sf, o = (() => { try { return JSON.parse(el.dataset.sfo || "{}"); } catch { return {}; } })();
    const chiave = JSON.stringify([id, o, scuro(), fermo()]), m = MINI.get(el);
    if (m && m.chiave === chiave) return;
    m?.stop();
    const box = el.firstElementChild || el;   // dentro c'è il contenitore che il ridisegno non tocca (data-keep)
    const n = montaSfondo(box, id, o, { mini: true }); n.chiave = chiave; MINI.set(el, n);
  });
}

/* ---------- prova a schermo intero ---------- */
let PROVA = null;
function prova() {
  if (PROVA) return;
  const c = inModifica(), box = document.createElement("div");
  box.className = "sf1fs";
  box.innerHTML = `<div class="sf1fsb"></div><div class="sf1fsc"><div class="sf1es glass"><b>21,5°</b><span>${t("Soggiorno · 3 luci accese", "Living room · 3 lights on")}</span></div>
    <div class="sf1es glass"><b>⚡ 1,2 kW</b><span>${t("La casa adesso", "The house right now")}</span></div></div><div class="sf1fsh">${t("Tocca per tornare", "Tap to go back")}</div>`;
  document.body.appendChild(box);
  const ctl = montaSfondo(box.querySelector(".sf1fsb"), c.id, opzioni(c, c.id));
  PROVA = { box, ctl };
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("on")));
  const chiudi = () => { if (!PROVA) return; const p = PROVA; PROVA = null; p.box.classList.remove("on"); setTimeout(() => { p.ctl.stop(); p.box.remove(); }, 350); };
  box.addEventListener("click", chiudi);
  const esc_ = e => { if (e.key === "Escape") { chiudi(); document.removeEventListener("keydown", esc_); } };
  document.addEventListener("keydown", esc_);
}

/* ---------- scelta dell'immagine dai Media ---------- */
let MD = { dir: "media-source://media_source", elenco: null, storia: [] };
async function apriMedia(id) {
  MD.dir = id; MD.elenco = null; render();
  try { MD.elenco = await ws({ type: "media_source/browse_media", media_content_id: id }); } catch (e) { MD.elenco = { title: t("Errore", "Error"), children: [], err: e.message || e.code }; }
  render();
}
const immagineMedia = c => c.media_class === "image" || /^image\//.test(c.media_content_type || "");
function sfogliaMedia() {
  const L = MD.elenco?.children || [], cartelle = L.filter(c => c.can_expand), img = L.filter(c => !c.can_expand && immagineMedia(c));
  return `<div class="sh-head"><div><h3>🖼️ ${t("Immagine dello sfondo", "Background image")}</h3><div class="small muted">${t("Dai Media di Home Assistant. Le immagini si caricano da Impostazioni → Media.", "From Home Assistant's Media. Upload images in Settings → Media.")}</div></div><button class="x" data-act="sfApri" data-v="${ED.dove}">×</button></div>
    <div class="row between" style="margin-bottom:8px"><b>${esc(MD.elenco?.title || "…")}</b>${MD.dir !== "media-source://media_source" ? `<button class="btn sm" data-act="sfMdSu">⬆ ${t("Su", "Up")}</button>` : ""}</div>
    ${!MD.elenco ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : `<div class="stack">
      ${cartelle.map(c => `<button class="li" data-act="sfMdApri" data-id="${esc(c.media_content_id)}"><span class="ic">📁</span><div class="tx"><b>${esc(c.title)}</b></div><span class="st">›</span></button>`).join("")}
      ${img.map(c => `<button class="li" data-act="sfMdUsa" data-id="${esc(c.media_content_id)}" data-n="${esc(c.title)}"><span class="ic">🖼️</span><div class="tx"><b>${esc(c.title)}</b><span>${t("Usa questa", "Use this one")}</span></div><span class="st">✓</span></button>`).join("")}
      ${!cartelle.length && !img.length ? `<div class="small muted">${MD.elenco.err ? esc(MD.elenco.err) : t("Qui non ci sono immagini.", "No images here.")}</div>` : ""}</div>`}`;
}

/* ---------- azioni ---------- */
Object.assign(ACT, {
  sfApri: el => { ED.dove = el.dataset.v === "casa" && isAdmin() ? "casa" : "disp"; openSheet(foglio); },
  sfCasa: el => { if (el.dataset.v === "1") { sDel("sfondo"); BG = null; render(true); toast("🏠 " + t("Sfondo della casa", "Home background")); }
    else if (!diDispositivo()) salvaCfg({ ...diCasa() }, "📱 " + t("Sfondo tuo: scegli qui sotto", "Your own background: pick below")); },
  sfScegli: el => { const c = inModifica(), id = el.dataset.v; salvaCfg({ id, o: c.daCasa ? { ...(diCasa().o || {}) } : (c.o || {}) }, `${INFO(id)[1]} ${INFO(id)[2]}`); },
  sfOpz: el => { const k = el.dataset.k, v = el.dataset.v; cambiaOpz(k, k === "uguali" ? v === "1" : ["vel", "int"].includes(k) ? +v : v); },
  sfLite: el => { sSet("sfLite", el.dataset.v); BG = null; render(true); },
  sfNat: () => { const on = !natAuto(); sSet("sfNatale", on ? "1" : "0"); BG = null; render(true);
    toast(on ? "🎄 " + (inPeriodo() ? t("Sfondo di Natale fino alla fine delle feste", "Christmas background until the end of the holidays") : t("Sfondo di Natale nel periodo di festa", "Christmas background during the festive season")) : t("Sfondo di sempre", "Usual background")); },
  sfNatId: el => { sSet("sfNatId", el.dataset.v); BG = null; render(true); },
  sfProva: () => setTimeout(prova, 60),
  sfMedia: () => { MD.storia = []; openSheet(sfogliaMedia); apriMedia("media-source://media_source"); },
  sfMdApri: el => { MD.storia.push(MD.dir); apriMedia(el.dataset.id); },
  sfMdSu: () => apriMedia(MD.storia.pop() || "media-source://media_source"),
  sfMdUsa: async el => { const c = inModifica(), o = { ...(c.o || {}) };
    o.immagine = { ...(o.immagine || {}), fonte: "media", media: el.dataset.id, nome: el.dataset.n || "" };
    await salvaCfg({ id: "immagine", o }, "🖼️ " + (el.dataset.n || "")); openSheet(foglio); },
});
Object.assign(CHG, {
  sfCol: el => { if (hexOk(el.value)) cambiaOpz(el.dataset.k, el.value.toLowerCase()); },
  sfRange: el => { const k = el.dataset.k, v = +el.value; cambiaOpz(k, k === "osc" ? v / 100 : v); },
  sfUrl: el => { const c = inModifica(), o = { ...(c.o || {}) }; o.immagine = { ...(o.immagine || {}), fonte: "url", url: el.value.trim() }; salvaCfg({ id: "immagine", o }); },
});
/* il numero accanto ai cursori cambia mentre si trascina (si salva quando si lascia) */
document.addEventListener("input", e => { const el = e.target; if (el.dataset?.chg === "sfRange") { const b = el.nextElementSibling; if (b) b.textContent = el.dataset.k === "osc" ? el.value + "%" : el.value + " px"; } });

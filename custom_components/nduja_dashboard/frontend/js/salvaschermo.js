/* Salvaschermo per il tablet a muro: dopo X minuti senza tocchi copre la plancia con uno stile a scelta e si sveglia
   al primo tocco. Tutto si sceglie per ogni dispositivo (⚙️ Impostazioni → Questo dispositivo → Salvaschermo).
   Stili «della plancia», disegnati qui in HTML/SVG/CSS (nduja.css, «salvaschermo»):
   - orologio: ora grande, data e le informazioni scelte, che si sposta piano (niente segni sullo schermo);
   - cielo: il cielo di adesso — colori dal sole (sun.sun), sole o luna con la sua fase, stelle, nuvole, pioggia,
     neve, nebbia e lampi dal meteo di casa — sopra le colline con la casetta;
   - casa: pannelli che si alternano con meteo, stanze, persone, prossimi impegni e consumi;
   - notte: ora grande e molto scura, per la camera da letto;
   - foto: una cartella dei Media, un indirizzo (anche una GIF) o un elenco di indirizzi, in dissolvenza o con il
     movimento lento (Ken Burns);
   - auto: di giorno foto o cielo, di notte il minimal scuro, con l'orario scelto.
   Leggerezza: si ridisegna al massimo ogni 20 secondi (e al cambio del minuto), le animazioni sono solo CSS
   (transform e opacity), tutto si ferma quando la scheda non è visibile e con «Riduci movimento».
   Anteprima dal vivo nel foglio «Personalizza» (stesso disegno, in piccolo). */
import { S, ACT, CHG, FISSI, UI, t, LOC, esc, fnum, attr, W, sGet, sSet, ws, toast, openSheet, closeSheet, render, patch,
  weatherEnt, WX, ents, roomTemp, roomHum, areasSorted, AREAS, forecast } from "./core.js";
import { inDiretta } from "./video.js";
import { indirizzoLocale, fileEsiste } from "./edit.js";
import { calendari, eventi, inizio, fine, allDay, nomeGiorno, colore } from "./agenda.js";
import { info as persona } from "./people.js";
import { sole, mix } from "./scenaenergia.js";

/* ================= scelte (di questo dispositivo) ================= */
const J = (k, d) => { try { return JSON.parse(sGet(k) || "null") ?? d; } catch { return d; } };
const STILI = ["auto", "orologio", "cielo", "casa", "notte", "foto"];
export const ssMin = () => +(sGet("ssMin") || 0);          // 0 = spento
export const ssStile = () => { const s = sGet("ssStile") || "orologio"; return STILI.includes(s) ? s : "orologio"; };
export const ssDir = () => sGet("ssDir") || "";
const fonte = () => sGet("ssFonte") || "media";            // media | url | lista
const ssUrl = () => indirizzoLocale(sGet("ssUrl") || "");
const ssLista = () => String(sGet("ssLista") || "").split(/[\n;]+/).map(indirizzoLocale).filter(Boolean);
export const haFoto = () => fonte() === "media" ? !!ssDir() : fonte() === "url" ? !!ssUrl() : ssLista().length > 0;
const notteDa = () => sGet("ssNotteDa") || "23:00";
const notteA = () => sGet("ssNotteA") || "07:00";
const attenua = () => sGet("ssAtt") !== "0";
const giorno = () => sGet("ssGiorno") === "cielo" ? "cielo" : "foto";   // in Automatico, di giorno
const minuti = hm => { const [h, m] = String(hm).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
/** è l'orario della notte scelto (di solito dalle 23 alle 7)? */
export function diNotte(d = new Date()) {
  const x = d.getHours() * 60 + d.getMinutes(), a = minuti(notteDa()), b = minuti(notteA());
  return a === b ? false : a < b ? x >= a && x < b : x >= a || x < b;
}
/* per ogni stile: velocità (1 lenta, 2 normale, 3 veloce), effetto (fade = dissolvenza, mov = movimento lento), informazioni sopra */
const DEF = {
  orologio: { vel: 2, eff: "mov", info: ["meteo", "temp", "persone", "impegno"] },
  cielo: { vel: 2, eff: "mov", info: ["ora", "meteo", "temp"] },
  casa: { vel: 2, eff: "fade", info: ["ora", "meteo"] },
  notte: { vel: 1, eff: "fade", info: [] },
  foto: { vel: 2, eff: "mov", info: ["ora", "meteo"] },
};
const cfg = s => ({ ...DEF[s], ...(J("ssCfg", {})[s] || {}) });
function setCfg(s, k, v) { const a = J("ssCfg", {}); a[s] = { ...(a[s] || {}), [k]: v }; sSet("ssCfg", JSON.stringify(a)); }
/** lo stile da disegnare adesso (Automatico sceglie da solo; le foto senza foto diventano l'orologio) */
function reale(stile, d = new Date()) {
  if (stile === "auto") return diNotte(d) ? "notte" : giorno() === "foto" && haFoto() ? "foto" : "cielo";
  if (stile === "foto" && !haFoto()) return "orologio";
  return stile;
}

/* ================= pezzi comuni ================= */
const lim = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const r1 = n => Math.round(n * 10) / 10;
const caso = seme => { let s = seme % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const oraTxt = d => d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
const dataTxt = d => { const s = d.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" }); return s[0].toUpperCase() + s.slice(1); };
const media = L => L.length ? L.reduce((a, b) => a + b, 0) / L.length : null;
const tempCasa = () => media(areasSorted().map(roomTemp).filter(v => v != null));
const inCasa = () => ents("person").filter(p => S[p].state === "home").length;
/** il prossimo impegno dei calendari della plancia (anche quello in corso) */
function prossimo() {
  const L = eventi(calendari(), 7), ora = Date.now();
  if (!Array.isArray(L)) return null;
  return L.find(ev => fine(ev) > ora && (!allDay(ev) || inizio(ev) >= new Date(new Date().setHours(0, 0, 0, 0)))) || null;
}
function quando(ev) {
  const s = inizio(ev), oggi = new Date().toDateString() === s.toDateString();
  if (allDay(ev)) return nomeGiorno(s);
  if (s <= new Date()) return t("Adesso", "Now");
  return (oggi ? "" : nomeGiorno(s) + " ") + oraTxt(s);
}
const corto = (s, n = 34) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
/** le informazioni scelte, come pillole: meteo, temperatura di casa, persone, prossimo impegno */
function pillole(info) {
  const w = weatherEnt(), out = [];
  for (const k of info) {
    if (k === "meteo" && w && S[w]) { const [ic, tx] = WX()[S[w].state] || ["🌡️", S[w].state]; out.push(`<span>${ic} ${fnum(attr(w, "temperature"), 0)}° <small>${esc(tx)}</small></span>`); }
    if (k === "temp") { const v = tempCasa(); if (v != null) out.push(`<span>🏠 ${fnum(v, 1)}°</span>`); }
    if (k === "persone" && ents("person").length) out.push(`<span>👥 ${inCasa()} <small>${t("in casa", "home")}</small></span>`);
    if (k === "impegno") { const ev = prossimo(); if (ev) out.push(`<span class="ev">📅 <small>${esc(quando(ev))}</small> ${esc(corto(ev.summary))}</span>`); }
  }
  return out.join("");
}
/** ora, data e pillole in basso a sinistra (cielo e foto) */
const blocco = (d, c) => `<div class="ssc1">${c.info.includes("ora") ? `<div class="ssh1">${oraTxt(d)}</div><div class="ssd1">${esc(dataTxt(d))}</div>` : ""}<div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div>`;

/* ================= stili ================= */
/* ---------- orologio ---------- */
const PASSO = { 1: 300000, 2: 60000, 3: 20000 };
/** posizione nello schermo per il turno n (si sposta piano: niente segni sugli schermi) */
const posto = (n, k = 1) => { const r = caso(n * 7919 + 13); r(); return [r1(r() * 9 * k), r1(-r() * 10 * k)]; };
function orologio(d, c, x) {
  const sl = sole(), el = sl.el;
  /* un alone appena visibile che cambia colore con il sole: blu di notte, ambra all'alba e al tramonto, azzurro di giorno */
  const g = el < -8 ? "#1d2f6b" : el < 8 ? mix(el < 0 ? "#3b2a6b" : "#a2522c", el < 0 ? "#a2522c" : "#2b6f8f", (el + 8) / 16) : "#2b6f8f";
  const [dx, dy] = posto(x.turno);
  return `<div class="sso1" style="--g:${g}"></div>
    <div class="ssw1"><div class="ssc1 ssgr ${c.eff === "fade" ? "fd" : ""} ${x.fuori ? "out" : ""}" style="--dx:${dx}cqw;--dy:${dy}cqh">
      <div class="ssh1">${oraTxt(d)}</div><div class="ssd1">${esc(dataTxt(d))}</div><div class="ssi1">${pillole(c.info)}</div></div></div>`;
}

/* ---------- minimal notturno ---------- */
function notte(d, c, x) {
  const [a, b] = posto(x.turno, 1.6), dx = r1(a - 7), dy = r1(b + 8);   // attorno al centro
  return `<div class="ssw1 ssn2"><div class="ssc1 fd ${x.fuori ? "out" : ""}" style="--dx:${dx}cqw;--dy:${dy}cqh">
    <div class="ssh1">${oraTxt(d)}</div>${c.info.length ? `<div class="ssi1">${pillole(c.info)}</div>` : ""}</div></div>`;
}

/* ---------- cielo vivo ---------- */
/** com'è il cielo dal meteo di casa: nuvole (quante), copertura, grigio, nuvole scure, cosa cade, lampi, nebbia, vento */
function meteoCielo() {
  const w = weatherEnt(), st = w && S[w] ? S[w].state : "";
  const M = {
    partlycloudy: [3, .3, .06, 0], cloudy: [6, .85, .6, .3], fog: [2, .7, .62, .15],
    rainy: [6, .9, .74, .6, "pioggia"], pouring: [7, 1, .84, .8, "rovesci"], lightning: [6, .9, .76, .85], "lightning-rainy": [7, 1, .82, .9, "pioggia"],
    snowy: [6, .85, .62, .25, "neve"], "snowy-rainy": [6, .9, .7, .45, "pioggia"], hail: [6, .9, .76, .7, "grandine"],
    windy: [3, .3, .08, 0], "windy-variant": [4, .55, .3, .2], exceptional: [7, 1, .84, .9],
  }[st] || [0, 0, 0, 0];
  let [nubi, cop, grigio, cupo, cade = null] = M;
  const cc = parseFloat(attr(w, "cloud_coverage"));
  if (st === "partlycloudy" && !isNaN(cc)) { nubi = cc < 25 ? 2 : cc < 55 ? 3 : 4; cop = lim(cc / 100, .2, .6); }
  const v = parseFloat(attr(w, "wind_speed")), u = String(attr(w, "wind_speed_unit") || "");
  const kmh = isNaN(v) ? null : /m\/s/.test(u) ? v * 3.6 : /mph/.test(u) ? v * 1.61 : v;
  return { st, nubi, cop, grigio, cupo, cade, lampi: /lightning|exceptional/.test(st), nebbia: st === "fog", kmh: kmh ?? (/windy/.test(st) ? 35 : 8) };
}
/* colori del cielo [in alto, a metà, all'orizzonte] secondo l'altezza del sole; all'alba più rosa, al tramonto più arancio */
const CIELO_ALBA = [[-14, ["#03060f", "#07102a", "#0d1a3a"]], [-8, ["#0a1430", "#1c2556", "#3d3466"]], [-3, ["#1b2f63", "#6b5a8e", "#f08a6c"]], [3, ["#3d6fb3", "#a7b6d6", "#ffc49a"]], [12, ["#2f78d0", "#69a8e6", "#bfe0f7"]], [30, ["#1f6cd1", "#5aa2ea", "#aed8f6"]]];
const CIELO_SERA = [[-14, ["#03060f", "#07102a", "#0d1a3a"]], [-8, ["#0b1230", "#25205a", "#4a2c5c"]], [-3, ["#1a2a5a", "#7a4a7c", "#ff7a45"]], [3, ["#3a62a8", "#c98f9a", "#ffa25a"]], [12, ["#2f78d0", "#69a8e6", "#bfe0f7"]], [30, ["#1f6cd1", "#5aa2ea", "#aed8f6"]]];
function colori(el, sale, grigio) {
  const P = sale ? CIELO_ALBA : CIELO_SERA;
  let c = P[P.length - 1][1];
  if (el <= P[0][0]) c = P[0][1];
  else for (let i = 1; i < P.length; i++) if (el <= P[i][0]) { const k = (el - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); c = P[i][1].map((x, j) => mix(P[i - 1][1][j], x, k)); break; }
  const G = el > 0 ? ["#6d7787", "#8d96a3", "#a9b0ba"] : ["#0b0e14", "#141821", "#1d222c"];
  return c.map((x, j) => mix(x, G[j], grigio));
}
/** fase della luna: 0 nuova, 0,5 piena */
function faseLuna(d = new Date()) { const s = 29.530588853, p = ((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % s; return (p < 0 ? p + s : p) / s; }
/** luna con la sua fase (parte illuminata a destra quando cresce; al contrario nell'emisfero sud) */
function luna(p, sud) {
  const r = 40, k = Math.cos(2 * Math.PI * p), cresce = p < .5, rx = r1(Math.abs(k) * r);
  const destra = cresce !== sud;   // lato illuminato
  /* mezzo disco dal lato illuminato, poi il terminatore (un'ellisse) che torna su: gobba verso il buio se è gibbosa */
  const s1 = destra ? 1 : 0, s2 = (k < 0) === destra ? 1 : 0;
  const lit = p < .02 || p > .98 ? "" : `<path d="M0 ${-r}A${r} ${r} 0 0 ${s1} 0 ${r}A${rx} ${r} 0 0 ${s2} 0 ${-r}Z" fill="#f4f1e6"/>`;
  return `<svg viewBox="-50 -50 100 100"><circle r="${r}" fill="#2a3044" opacity=".55"/>${lit}<circle r="${r}" fill="none" stroke="rgba(255,255,255,.08)"/></svg>`;
}
/** un cumulo disegnato per 'Nduja: palle morbide su una base piatta, l'ombra sotto e la luce sopra, sfumate (la sfocatura
    si calcola una volta sola: poi la nuvola scorre intera, con il transform) */
function nuvola(r, luce, ombra, k = 1) {
  const n = 5 + Math.floor(r() * 3), C = [];
  for (let i = 0; i < n; i++) { const x = 40 + (i / (n - 1)) * 140, m = Math.sin(Math.PI * i / (n - 1)); C.push([r1(x + (r() - .5) * 12), r1(64 - m * (22 + r() * 16) * k), r1(14 + m * (16 + r() * 10) * k)]); }
  const forma = C.map(([x, y, q]) => `<circle cx="${x}" cy="${y}" r="${q}"/>`).join("") + `<rect x="30" y="54" width="160" height="22" rx="11"/>`;
  return `<svg viewBox="0 0 220 100"><g filter="url(#ssbl)"><g fill="${ombra}" transform="translate(0 4)">${forma}</g><g fill="${luce}" transform="translate(2 -2) scale(.985)">${forma}</g></g></svg>`;
}
const STELLE = (() => { const r = caso(4242); return Array.from({ length: 90 }, () => [r1(r() * 160), r1(r() * 70), r1(.18 + r() * .32), Math.floor(r() * 3)]); })();
function cielo(d, c, x) {
  const sl = sole(), m = meteoCielo(), el = sl.el, [top, mid, hz] = colori(el, sl.sale, m.grigio);
  const notteK = lim((-el - 4) / 8), coperto = m.cop;
  const sud = (attr("zone.home", "latitude") ?? 45) < 0;
  /* sole e luna lungo un arco: da sinistra (alba) a destra (tramonto) */
  const ax = 8 + sl.f * 84, ay = 72 - Math.sin(Math.PI * sl.f) * 54;
  const caldo = lim((14 - el) / 18), solCol = mix("#fff6d6", "#ffab5e", caldo);
  const astro = sl.su
    ? `<div class="sss1" style="left:${r1(ax)}%;top:${r1(ay)}%;--sc:${solCol};opacity:${coperto >= .85 ? 0 : r1(1 - coperto * .8)}"><i></i></div>`
    : `<div class="ssm1" style="left:${r1(ax)}%;top:${r1(ay)}%;opacity:${coperto >= .85 ? 0 : r1((1 - coperto * .85) * lim((-el + 2) / 6, .35))}">${luna(faseLuna(d), sud)}</div>`;
  /* stelle: solo con il buio e il cielo sgombro; un terzo luccica, in due gruppi */
  const sv = r1(notteK * Math.pow(1 - coperto, 1.5));
  const stelle = sv > .03 ? [0, 1, 2].map(g => `<svg class="sst1 sg${g}" viewBox="0 0 160 70" preserveAspectRatio="xMidYMin slice" style="opacity:${sv}">${STELLE.filter(s => s[3] === g).map(([a, b, q]) => `<circle cx="${a}" cy="${b}" r="${q}"/>`).join("")}</svg>`).join("")
    + (coperto < .3 && notteK > .8 ? `<i class="ssst"></i>` : "") : "";
  /* nuvole: di giorno chiare (scure se il tempo è brutto), di notte grigio-blu */
  const luce = el > 0 ? mix("#ffffff", "#9aa3b2", m.cupo) : mix("#3a4256", "#1c212c", m.cupo);
  const tinta = el > -3 && el < 8 ? mix(luce, "#ffb48a", .35 * (1 - m.cupo)) : luce;   // all'alba e al tramonto si colorano
  const ombra = el > 0 ? mix(tinta, "#6f7888", .3 + .35 * m.cupo) : mix(tinta, "#0b0e14", .45);
  const vk = { 1: .6, 2: 1, 3: 1.8 }[c.vel] * (m.kmh > 30 ? 1.8 : m.kmh > 15 ? 1.3 : 1);
  const r = caso(97);
  const nubi = Array.from({ length: m.nubi }, (_, i) => {
    const q = .55 + r() * .7, w = r1(16 + q * 22), y = r1(4 + r() * 38 + (i % 2) * 6), x0 = r1(-10 + ((i * 37 + r() * 20) % 110)), dur = Math.round((150 + q * 90) / vk);
    const p0 = (x0 + 50) / 200;
    return `<div class="ssn1" style="--x:${x0}cqw;left:${x0}cqw;top:${y}cqh;width:${w}cqw;animation-duration:${dur}s;animation-delay:${-Math.round(p0 * dur)}s;opacity:${r1(.75 + q * .25)}">${nuvola(r, tinta, ombra, q)}</div>`;
  }).join("");
  const cade = m.cade ? `<div class="ssp2 ${m.cade}">${m.cade === "pioggia" || m.cade === "rovesci" ? `<i class="l1"></i><i class="l2"></i>` : `<i class="l1"></i>`}</div>` : "";
  const nebbia = m.nebbia ? `<i class="ssfg f1"></i><i class="ssfg f2"></i>` : "";
  /* colline e casetta: più scure del cielo; la finestra si accende con il buio */
  const sc = (k) => mix(hz, "#05070d", k), finestra = el < -1 ? "#ffcf72" : mix(mid, "#0a0f1c", .5);
  return `<svg class="ssdf"><filter id="ssbl" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter></svg>
    <div class="ssk2" style="background:linear-gradient(180deg,${top} 0%,${mid} 52%,${hz} 80%)"></div>${stelle}${astro}
    ${coperto >= .6 ? `<i class="ssov" style="--vc:${ombra};opacity:${r1(coperto * .9)}"></i>` : ""}<div class="ssnb">${nubi}</div>${cade}${nebbia}${m.lampi ? `<i class="ssl1"></i>` : ""}
    <svg class="ssh2" viewBox="0 0 1600 320" preserveAspectRatio="none"><path d="M0 130C200 80 380 120 560 98S900 52 1100 104S1450 86 1600 112V320H0Z" fill="${sc(.45)}"/>
      <path d="M0 200C260 160 420 196 640 176S1000 146 1240 186S1500 168 1600 180V320H0Z" fill="${sc(.65)}"/><path d="M0 256C300 236 600 266 900 248S1350 232 1600 252V320H0Z" fill="${sc(.82)}"/></svg>
    <svg class="ssca" viewBox="0 0 120 80"><g fill="${sc(.82)}"><path d="M14 80V44L46 18L78 44V80Z"/><path d="M60 30V14H68V37Z"/><circle cx="100" cy="46" r="14"/><rect x="98" y="52" width="4" height="28"/></g>
      <rect x="27" y="50" width="12" height="11" rx="1.5" fill="${finestra}"/><rect x="51" y="50" width="12" height="11" rx="1.5" fill="${finestra}"/>${el < -1 ? `<circle cx="39" cy="56" r="22" fill="url(#ssgl)" opacity=".5"/><defs><radialGradient id="ssgl"><stop offset="0" stop-color="#ffcf72" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf72" stop-opacity="0"/></radialGradient></defs>` : ""}</svg>
    <div class="ssv1 lieve"></div><div class="ssw1">${blocco(d, c)}</div>`;
}

/* ---------- casa: pannelli che si alternano ---------- */
let EN = null, enChiesto = false;
/** energia.js (pagina Energia) si carica dopo la Home: lo prendo quando serve */
function energia() { if (!enChiesto) { enChiesto = true; import("./pages/energia.js").then(m => { EN = m; }).catch(() => {}); } return EN; }
const pan = (ic, tit, corpo, col) => ({ ic, tit, corpo, col });
function pannelli(d) {
  const P = [], w = weatherEnt();
  if (w && S[w]) {
    const [ic, tx] = WX()[S[w].state] || ["🌡️", S[w].state], a = S[w].attributes, fc = (forecast(w) || []).slice(0, 5);
    P.push(pan("🌤️", t("Meteo", "Weather"), `<div class="ssq1"><span class="i">${ic}</span><div><b>${fnum(a.temperature, 0)}°</b><span>${esc(tx)}</span>
        <small>${[a.humidity != null ? "💧 " + fnum(a.humidity, 0) + "%" : "", a.wind_speed != null ? "💨 " + fnum(a.wind_speed, 0) + " " + esc(a.wind_speed_unit || "km/h") : ""].filter(Boolean).join(" · ")}</small></div></div>
      ${fc.length ? `<div class="ssq2">${fc.map(f => `<div><small>${esc(new Date(f.datetime).toLocaleDateString(LOC, { weekday: "short" }))}</small><span>${(WX()[f.condition] || ["·"])[0]}</span><b>${fnum(f.temperature, 0)}°</b><i>${f.templow != null ? fnum(f.templow, 0) + "°" : ""}</i></div>`).join("")}</div>` : ""}`, "#2b6f8f"));
  }
  const R = areasSorted().map(a => ({ a, v: roomTemp(a), h: roomHum(a) })).filter(r => r.v != null).slice(0, 8);
  if (R.length) P.push(pan("🌡️", t("Stanze", "Rooms"), `<div class="ssq3">${R.map(r => `<div style="--tc:${r.v < 18 ? "#64d2ff" : r.v > 24.5 ? "#ff9f0a" : "#30d158"}"><span>${esc(AREAS[r.a]?.name || "")}</span><b>${fnum(r.v, 1)}°</b>${r.h != null ? `<small>💧 ${fnum(r.h, 0)}%</small>` : ""}</div>`).join("")}</div>`, "#6a3a2a"));
  const PP = ents("person").slice(0, 6);
  if (PP.length) P.push(pan("👥", t("Persone", "People"), `<div class="ssq4">${PP.map(p => { const i = persona(p);
      return `<div class="${i.casa ? "home" : ""}"><span class="ssav" style="${i.foto ? `background-image:url('${esc(i.foto)}')` : ""}">${i.foto ? "" : esc(i.nome[0] || "?")}</span><b>${esc(i.nome)}</b><small>${i.casa ? "🏠" : "📍"} ${esc(i.zona)}</small></div>`; }).join("")}</div>`, "#3b4a8f"));
  const E = calendari().length ? eventi(calendari(), 7) : [];
  const EV = Array.isArray(E) ? E.filter(ev => fine(ev) > Date.now()).slice(0, 4) : [];
  if (EV.length) P.push(pan("📅", t("Prossimi impegni", "Coming up"), `<div class="ssq5">${EV.map(ev => `<div style="--cc:${colore(ev.cal)}"><span>${esc(quando(ev))}</span><b>${esc(corto(ev.summary, 48))}</b>${ev.location ? `<small>📍 ${esc(corto(ev.location, 40))}</small>` : ""}</div>`).join("")}</div>`, "#5a3a7a"));
  const en = energia();
  if (en && en.haEnergia?.()) {
    const L = en.letture?.(), T = en.totali?.() || {}, kw = w => w == null ? "—" : Math.abs(w) >= 1000 ? fnum(w / 1000, 1) + " kW" : Math.round(w) + " W";
    if (L && L.casa != null) P.push(pan("⚡", t("Consumi", "Energy"), `<div class="ssq6"><div class="tot"><small>${t("La casa adesso", "Home right now")}</small><b>${kw(L.casa)}</b></div><div class="ssq7">
      ${L.pv != null ? `<div><span>☀️ ${t("Sole", "Solar")}</span><b>${kw(L.pv)}</b></div>` : ""}
      ${L.rete != null ? `<div><span>🔌 ${L.rete < 0 ? t("Alla rete", "To grid") : t("Dalla rete", "From grid")}</span><b>${kw(Math.abs(L.rete))}</b></div>` : ""}
      ${L.soc != null ? `<div><span>🔋 ${t("Batteria", "Battery")}</span><b>${fnum(L.soc, 0)}%</b></div>` : ""}
      ${T.casa != null ? `<div><span>🏠 ${t("Oggi", "Today")}</span><b>${fnum(T.casa, 1)} kWh</b></div>` : ""}</div></div>`, "#7a5a1a"));
  }
  return P;
}
const GIRO = { 1: 30000, 2: 15000, 3: 8000 };
function casa(d, c, x) {
  const P = pannelli(d);
  if (!P.length) return orologio(d, { ...cfg("orologio"), info: c.info.filter(k => k !== "ora") }, x);
  const per = GIRO[c.vel] || 15000, n = Math.floor(Date.now() / per), i = n % P.length, prima = (n - 1) % P.length;
  x.prossimo = per - (Date.now() % per) + 40;
  const su = c.info.includes("ora");
  return `<div class="ssk3"></div>
    <div class="ssb2">${su ? `<div class="ssc2"><b>${oraTxt(d)}</b><span>${esc(dataTxt(d))}</span></div>` : "<span></span>"}<div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div>
    <div class="ssg1 ${c.eff === "mov" ? "mov" : ""}">${P.map((p, k) => `<section class="ssk1 ${k === i ? "on" : P.length > 1 && k === prima ? "via" : ""}" style="--pc:${p.col}"><h3>${p.ic} ${esc(p.tit)}</h3>${p.corpo}</section>`).join("")}</div>
    ${P.length > 1 ? `<div class="ssdt">${P.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>` : ""}`;
}

/* ---------- foto ---------- */
const CAMBIO = { 1: 60000, 2: 20000, 3: 10000 };
function foto(d, c, x) {
  return `<div class="ssb1" data-keep></div><div class="ssv1"></div>${x.fotoErr ? `<div class="ssmsg">🖼️ ${t("Non riesco ad aprire le foto scelte.", "Can't open the chosen photos.")}</div>` : ""}<div class="ssw1">${blocco(d, c)}</div>`;
}
/** elenco delle foto: dalla cartella dei Media (fino a 200, in ordine casuale) o dagli indirizzi scelti */
async function elencoFoto() {
  if (fonte() === "url") return ssUrl() ? [{ u: ssUrl() }] : [];
  if (fonte() === "lista") return ssLista().map(u => ({ u }));
  if (!ssDir()) return [];
  try {
    const r = await ws({ type: "media_source/browse_media", media_content_id: ssDir() });
    const img = (r.children || []).filter(c => c.media_class === "image" || /^image\//.test(c.media_content_type || "")).slice(0, 200);
    for (let i = img.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [img[i], img[j]] = [img[j], img[i]]; }
    return img.map(c => ({ id: c.media_content_id }));
  } catch (e) { console.warn("salvaschermo", e); return []; }
}
async function indirizzo(f) { if (f.u) return f.u; try { return (await ws({ type: "media_source/resolve_media", media_content_id: f.id })).url; } catch { return null; } }
/** le foto si alternano: la nuova si carica prima, poi entra in dissolvenza (con il movimento lento se scelto) */
function avviaFoto(x) {
  const F = x.foto = { L: [], i: 0, T: null, ko: 0, fermo: false };
  const c = () => cfg("foto"), box = () => x.el?.querySelector(".ssb1");
  const dopo = ms => { clearTimeout(F.T); if (!F.fermo && F.L.length > 1) F.T = setTimeout(prossima, ms); };
  async function prossima() {
    if (F.fermo) return;
    if (inPausa(x)) { F.T = setTimeout(prossima, 3000); return; }
    const f = F.L[F.i++ % F.L.length], url = f && await indirizzo(f);
    if (F.fermo) return;
    const im = new Image();
    im.onload = () => {
      const b = box(); if (F.fermo || !b) return;
      F.ko = 0; if (x.fotoErr) { x.fotoErr = false; disegna(x); }
      const per = CAMBIO[c().vel] || 20000, kb = c().eff === "mov";
      const L = document.createElement("div"); L.className = "ssf1" + (kb ? " kb kb" + (F.i % 4) : "");
      L.style.setProperty("--kd", Math.round(per * 1.4 / 1000 + 4) + "s");
      /* foto molto più alta o più larga dello schermo: intera, con sotto la stessa foto sfocata */
      const R = b.getBoundingClientRect(), q = (im.naturalWidth / im.naturalHeight) / ((R.width || 16) / (R.height || 10)), fuori = q < .74 || q > 1.36;
      const u = `url(${JSON.stringify(url)})`;
      L.innerHTML = fuori ? `<i class="ssfb"></i><i class="ssfi ct"></i>` : `<i class="ssfi"></i>`;
      L.querySelectorAll("i").forEach(e => { e.style.backgroundImage = u; });
      b.appendChild(L);
      requestAnimationFrame(() => requestAnimationFrame(() => L.classList.add("on")));
      const vecchie = b.querySelectorAll(".ssf1"); if (vecchie.length > 2) vecchie[0].remove();
      setTimeout(() => { const v = b.querySelectorAll(".ssf1"); for (let k = 0; k < v.length - 1; k++) v[k].classList.add("via"); }, 2600);
      dopo(per);
    };
    im.onerror = () => { F.ko++; if (F.ko >= F.L.length) { x.fotoErr = true; disegna(x); } else { clearTimeout(F.T); F.T = setTimeout(prossima, 400); } };
    if (url) im.src = url; else im.onerror();
  }
  elencoFoto().then(L => { if (F.fermo) return; F.L = L; if (L.length) prossima(); else { x.fotoErr = true; disegna(x); } });
}
const fermaFoto = x => { if (x.foto) { x.foto.fermo = true; clearTimeout(x.foto.T); x.foto = null; } x.fotoErr = false; };

/* ================= motore: disegna uno stile dentro un contenitore ================= */
const STILE = { orologio, notte, cielo, casa, foto };
const VIVI = new Set();
let nid = 0;
/** ferma tutto quando la scheda non si vede, o quando l'anteprima è coperta dal salvaschermo vero */
const inPausa = x => document.hidden || (x.mini && attivo);
/** monta uno stile nel contenitore (root): restituisce il controllo { stop } */
function monta(root, stile, mini) {
  const x = { id: ++nid, root, stile, mini, el: null, s: null, turno: 0, fuori: false, T: null, T2: null, foto: null, fotoErr: false, prossimo: null };
  root.innerHTML = "";
  x.stop = () => { clearTimeout(x.T); clearTimeout(x.T2); (x.T3 || []).forEach(clearTimeout); fermaFoto(x); VIVI.delete(x); };
  VIVI.add(x); giro(x);
  /* calendari, previsioni e consumi arrivano un attimo dopo: ridisegno presto due volte */
  x.T3 = [1500, 4500].map(ms => setTimeout(() => { if (VIVI.has(x)) giro(x); }, ms));
  return x;
}
function giro(x) {
  clearTimeout(x.T);
  if (!x.root.isConnected) { x.stop(); return; }
  if (inPausa(x)) { x.root.querySelectorAll(".ssr1").forEach(e => e.classList.add("pausa")); return; }   // riparte con riprendi()
  x.root.querySelectorAll(".ssr1").forEach(e => e.classList.remove("pausa"));
  x.prossimo = null; disegna(x);
  const ora = Date.now(), alMinuto = 60000 - (ora % 60000) + 60;
  x.T = setTimeout(() => giro(x), Math.max(800, Math.min(20000, alMinuto, x.prossimo || Infinity)));
}
function riprendi() { for (const x of VIVI) giro(x); }
document.addEventListener("visibilitychange", riprendi);
function disegna(x) {
  const d = new Date(), s = reale(x.stile, d), c = cfg(s);
  if (s !== x.s) {
    /* cambio di stile (Automatico all'inizio o alla fine della notte): il nuovo entra in dissolvenza sopra il vecchio */
    fermaFoto(x);
    const vecchio = x.el, el = document.createElement("div");
    el.className = "ssr1 st-" + s + (vecchio ? " entra" : "");
    x.root.appendChild(el); x.el = el; x.s = s; x.turno = Math.floor(Date.now() / (s === "notte" ? 180000 : PASSO[c.vel] || 60000)); x.fuori = false;
    if (vecchio) { requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("entra"))); setTimeout(() => vecchio.remove(), 2200); }
  }
  /* orologio e notte cambiano posto a turni: con la dissolvenza spariscono, si spostano e ricompaiono */
  if (s === "orologio" || s === "notte") {
    const per = s === "notte" ? 180000 : PASSO[c.vel] || 60000, n = Math.floor(Date.now() / per);
    x.prossimo = per - (Date.now() % per) + 40;
    if (n !== x.turno && !x.fuori) {
      if (c.eff === "fade" || s === "notte") { x.fuori = true; clearTimeout(x.T2); x.T2 = setTimeout(() => { x.turno = n; x.fuori = false; disegna(x); }, 1300); }
      else x.turno = n;
    }
  }
  const dim = attenua() && s !== "notte" && diNotte(d);
  try { patch(x.el, STILE[s](d, c, x) + `<div class="ssdim ${dim ? "on" : ""}"></div>`); } catch (e) { console.error("salvaschermo", e); }
  if (s === "foto" && !x.foto) avviaFoto(x);
}

/* ================= a tutto schermo ================= */
let timer = null, attivo = false, el = null, ctl = null;
function riarma() {
  clearTimeout(timer);
  if (attivo || !ssMin()) return;
  timer = setTimeout(mostra, ssMin() * 60000);
}
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => document.addEventListener(ev, () => { if (attivo) nascondi(); else riarma(); }, { passive: true, capture: true }));
let ultimoMove = 0;
document.addEventListener("mousemove", () => { const n = Date.now(); if (n - ultimoMove > 1000) { ultimoMove = n; if (!attivo) riarma(); } }, { passive: true });
document.addEventListener("visibilitychange", () => { if (!document.hidden && !attivo) riarma(); });

export function mostra(prova) {
  if (attivo) return;
  if (prova !== true && (inDiretta() || document.hidden)) { riarma(); return; }   // si sta guardando una telecamera: non la copro
  attivo = true; clearTimeout(timer);
  el = document.createElement("div"); el.className = "ss1";
  document.body.appendChild(el);
  ctl = monta(el, ssStile(), false);
  requestAnimationFrame(() => requestAnimationFrame(() => el && el.classList.add("on")));
  /* sotto non si vede niente: smetto di ridisegnare la plancia e di animarla */
  setTimeout(() => { if (attivo) { document.body.classList.add("ss-on"); UI.ss = true; } }, 450);
  riprendi();
}
function nascondi() {
  attivo = false; UI.ss = false; document.body.classList.remove("ss-on");
  const e = el, c = ctl; el = null; ctl = null;
  if (e) { e.classList.remove("on"); setTimeout(() => { c?.stop(); e.remove(); }, 450); }
  render(true); riprendi(); riarma();
}
riarma();

/* ================= Impostazioni ================= */
const NOMI = () => ({
  auto: ["✨", t("Automatico", "Automatic"), t("Di giorno foto o cielo, di notte scuro", "Photos or sky by day, dark at night")],
  orologio: ["🕐", t("Orologio", "Clock"), t("Ora grande, data e quello che scegli", "Big time, date and what you pick")],
  cielo: ["🌅", t("Cielo vivo", "Live sky"), t("Il cielo di adesso, con il meteo di casa", "Today's sky, with your home weather")],
  casa: ["🏠", t("Casa", "Home"), t("Meteo, stanze, persone, impegni e consumi", "Weather, rooms, people, events and energy")],
  notte: ["🌙", t("Minimal notturno", "Night minimal"), t("Ora grande e scurissima, per la camera", "Big, very dark time for the bedroom")],
  foto: ["🖼️", t("Foto", "Photos"), t("Le tue foto o una GIF", "Your photos or a GIF")],
});
/** riga del salvaschermo nella scheda «Questo dispositivo» */
export function ssVoce() {
  const s = ssStile(), [ic, n] = NOMI()[s];
  const sotto = s === "auto" ? t(`Di giorno ${giorno() === "foto" && haFoto() ? "foto" : "cielo vivo"}, di notte minimal (${notteDa()}–${notteA()})`, `By day ${giorno() === "foto" && haFoto() ? "photos" : "live sky"}, at night minimal (${notteDa()}–${notteA()})`)
    : s === "foto" && !haFoto() ? t("Scegli le foto", "Choose your photos") : NOMI()[s][2];
  return `<button class="li sz1v" data-act="ssCfg"><span class="ic">${ic}</span><div class="tx"><b>${esc(n)}</b><span>${esc(sotto)}</span></div><span class="st">›</span></button>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="ssCfg">🎨 ${t("Personalizza", "Customize")}</button><button class="btn sm" data-act="ssProva">▶ ${t("Prova", "Try")}</button></div>`;
}
/* foglio «Personalizza»: in alto l'anteprima dal vivo, poi lo stile e le sue opzioni */
const ED = { sub: "giorno" };
const seg = (act, cur, opts, x = "") => `<div class="seg">${opts.map(([k, n]) => `<button class="${String(cur) === String(k) ? "act" : ""}" data-act="${act}" data-v="${k}" ${x}>${n}</button>`).join("")}</div>`;
/** lo stile di cui si vedono le opzioni (in Automatico: quello del giorno o della notte) */
const inModifica = () => { const s = ssStile(); return s !== "auto" ? s : ED.sub === "notte" ? "notte" : giorno(); };
const VEL = () => ({
  orologio: [t("Si sposta", "Moves"), [t("ogni 5 min", "every 5 min"), t("ogni minuto", "every minute"), t("ogni 20 s", "every 20 s")]],
  cielo: [t("Nuvole", "Clouds"), [t("lente", "slow"), t("normali", "normal"), t("veloci", "fast")]],
  casa: [t("Cambio pannello", "Next panel"), ["30 s", "15 s", "8 s"]],
  foto: [t("Cambio foto", "Next photo"), ["1 min", "20 s", "10 s"]],
});
const EFF = () => ({
  orologio: [t("Dissolvenza", "Fade"), t("Movimento lento", "Slow drift")],
  casa: [t("Dissolvenza", "Fade"), t("Scorrimento lento", "Slow slide")],
  foto: [t("Dissolvenza", "Fade"), t("Movimento lento (Ken Burns)", "Slow motion (Ken Burns)")],
});
const INFO = () => ({ ora: "🕐 " + t("Ora", "Time"), meteo: "🌤️ " + t("Meteo", "Weather"), temp: "🏠 " + t("Temperatura di casa", "Home temperature"), persone: "👥 " + t("Persone in casa", "People home"), impegno: "📅 " + t("Prossimo impegno", "Next event") });
const INFO_DI = { orologio: ["meteo", "temp", "persone", "impegno"], notte: ["meteo", "temp", "impegno"], cielo: ["ora", "meteo", "temp", "persone", "impegno"], casa: ["ora", "meteo", "temp", "persone", "impegno"], foto: ["ora", "meteo", "temp", "persone", "impegno"] };
function opzioni(s) {
  const c = cfg(s), V = VEL()[s], E = EFF()[s], I = INFO();
  return `${V ? `<div class="sz1o"><span>${V[0]}</span>${seg("ssVel", c.vel, V[1].map((n, i) => [i + 1, n]), `data-s="${s}"`)}</div>` : ""}
    ${E ? `<div class="sz1o"><span>${t("Passaggio", "Transition")}</span>${seg("ssEff", c.eff, [["fade", E[0]], ["mov", E[1]]], `data-s="${s}"`)}</div>` : ""}
    <div class="sz1o"><span>${s === "casa" ? t("In alto", "On top") : t("Da mostrare sopra", "Shown on top")}</span><div class="vr1">${INFO_DI[s].map(k => `<button class="${c.info.includes(k) ? "on" : ""}" data-act="ssInfo" data-s="${s}" data-v="${k}">${I[k]}</button>`).join("")}</div></div>
    ${s === "foto" ? fotoScelta() : ""}
    ${s === "cielo" ? `<p class="small muted">${t("I colori seguono il sole, le nuvole e la pioggia il meteo di casa; di notte la luna ha la sua fase vera.", "Colours follow the sun, clouds and rain your home weather; at night the moon shows its real phase.")}</p>` : ""}
    ${s === "notte" ? `<p class="small muted">${t("Nero, con l'ora in un arancio molto tenue che non abbaglia; cambia posto ogni pochi minuti.", "Black, with the time in a very soft orange that doesn't dazzle; it moves every few minutes.")}</p>` : ""}`;
}
function fotoScelta() {
  const f = fonte(), stato = u => { const s = fileEsiste(u); return s === "ok" ? "✅" : s === "no" ? "⚠️" : s === "?" ? "…" : ""; };
  let corpo = "";
  if (f === "media") corpo = `<button class="li" data-act="ssDir"><span class="ic">📁</span><div class="tx"><b>${ssDir() ? esc(decodeURIComponent(ssDir().split("/").pop() || "")) : t("Scegli la cartella", "Choose the folder")}</b><span>${t("Dai Media di Home Assistant (Impostazioni → Media)", "From Home Assistant's Media (Settings → Media)")}</span></div><span class="st">›</span></button>`;
  else if (f === "url") { const u = ssUrl();
    corpo = `<label class="fld1"><span>${t("Indirizzo dell'immagine o della GIF", "Image or GIF address")}</span><input type="text" data-chg="ssUrl" value="${esc(sGet("ssUrl") || "")}" placeholder="/local/salvaschermo.gif" autocomplete="off"></label>
      ${u ? `<div class="small muted sz1st">${stato(u)} ${fileEsiste(u) === "no" ? t("Non la trovo: controlla l'indirizzo.", "Not found: check the address.") : fileEsiste(u) === "ok" ? t("Trovata.", "Found.") : t("Controllo…", "Checking…")}</div>` : ""}`; }
  else { const L = ssLista(), ok = L.filter(u => fileEsiste(u) === "ok").length, no = L.filter(u => fileEsiste(u) === "no");
    corpo = `<label class="fld1"><span>${t("Un indirizzo per riga", "One address per line")}</span><textarea rows="4" data-chg="ssLista" placeholder="/local/foto/mare.jpg&#10;/local/foto/monti.jpg" autocomplete="off">${esc(sGet("ssLista") || "")}</textarea></label>
      ${L.length ? `<div class="small muted sz1st">${t(`${L.length} indirizzi · ${ok} trovati`, `${L.length} addresses · ${ok} found`)}${no.length ? ` · ⚠️ ${t("non trovati", "not found")}: ${no.map(esc).join(", ")}` : ""}</div>` : ""}`; }
  return `<div class="sz1o"><span>${t("Le foto", "Photos")}</span>${seg("ssFonte", f, [["media", "📁 " + t("Cartella dei Media", "Media folder")], ["url", "🔗 " + t("Un indirizzo", "One address")], ["lista", "📋 " + t("Più indirizzi", "Several")]])}</div>${corpo}
    ${f !== "media" ? `<p class="small muted">${t("Metti i file nella cartella www di Home Assistant: «/config/www/foto.jpg» diventa «/local/foto.jpg». Vanno bene anche le GIF animate.", "Put the files in Home Assistant's www folder: «/config/www/photo.jpg» becomes «/local/photo.jpg». Animated GIFs work too.")}</p>` : ""}`;
}
function foglio() {
  const s = ssStile(), N = NOMI(), m = inModifica();
  const vista = s === "auto" ? (ED.sub === "notte" ? "notte" : giorno() === "foto" && haFoto() ? "foto" : "cielo") : reale(s);
  const ore = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const sel = (chg, v) => `<select data-chg="${chg}">${[...new Set([...ore, v])].sort().map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`;
  return `<div class="sh-head"><div><h3>🌙 ${t("Salvaschermo", "Screensaver")}</h3><div class="small muted">${t("Scelte di questo dispositivo: gli altri tablet e telefoni non cambiano.", "Choices for this device: other tablets and phones don't change.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="sz1p"><div class="ssp1" data-keep data-act="ssProva" role="button" aria-label="${t("Prova a tutto schermo", "Try full screen")}"></div>
      <div class="row between"><span class="small muted">${t("Anteprima dal vivo", "Live preview")} · ${esc(N[vista]?.[1] || "")}</span><button class="btn sm pri" data-act="ssProva">▶ ${t("Prova a tutto schermo", "Try full screen")}</button></div></div>
    <div class="fl1">${t("Stile", "Style")}</div>
    <div class="sz1g">${STILI.map(k => `<button class="${k === s ? "act" : ""}" data-act="ssStile" data-v="${k}"><i class="sz1t t-${k}"></i><b>${N[k][0]} ${esc(N[k][1])}</b><small>${esc(N[k][2])}</small></button>`).join("")}</div>
    ${s === "auto" ? `<div class="fl1">✨ ${t("Automatico", "Automatic")}</div>
      <div class="sz1o"><span>${t("Di giorno", "By day")}</span>${seg("ssGiorno", giorno(), [["foto", "🖼️ " + t("Foto", "Photos")], ["cielo", "🌅 " + t("Cielo vivo", "Live sky")]])}</div>
      ${giorno() === "foto" && !haFoto() ? `<div class="note1">${t("Scegli le foto qui sotto: finché mancano, di giorno mostro il cielo vivo.", "Choose the photos below: until then, by day I show the live sky.")}</div>` : ""}
      <div class="sz1o"><span>${t("Di notte", "At night")}</span><span class="small muted">🌙 ${t("Minimal notturno, dalle", "Night minimal, from")} ${notteDa()} ${t("alle", "to")} ${notteA()}</span></div>
      <div class="sz1o"><span>${t("Opzioni di", "Options for")}</span>${seg("ssSub", ED.sub, [["giorno", "☀️ " + esc(N[giorno()][1])], ["notte", "🌙 " + esc(N.notte[1])]])}</div>` : ""}
    <div class="fl1">${N[m][0]} ${esc(N[m][1])}</div>
    ${s === "foto" && !haFoto() ? `<div class="note1">${t("Scegli da dove prendere le foto: intanto mostro l'orologio.", "Choose where the photos come from: until then I show the clock.")}</div>` : ""}
    ${opzioni(m)}
    <div class="fl1">🌙 ${t("Notte", "Night")}</div>
    <div class="sz1o"><span>${t("Orario", "Hours")}</span><div class="row sz1h">${t("dalle", "from")} ${sel("ssNotteDa", notteDa())} ${t("alle", "to")} ${sel("ssNotteA", notteA())}</div></div>
    <div class="sz1o"><span>${t("Attenuazione", "Dimming")}</span>${seg("ssAtt", attenua() ? "1" : "0", [["1", t("Abbassa di notte", "Dim at night")], ["0", t("No", "No")]])}</div>
    <p class="small muted">${t("Di notte gli stili chiari si abbassano; in Automatico di notte c'è il minimal scuro.", "At night bright styles are dimmed; in Automatic the dark minimal style is used at night.")}</p>
    <div class="fl1">⏱️ ${t("Parte dopo", "Starts after")}</div>
    ${seg("ssMin", String(ssMin()), [["0", t("Spento", "Off")], ["1", "1 min"], ["5", "5 min"], ["10", "10 min"], ["30", "30 min"]])}
    <p class="small muted" style="margin-top:8px">${t("Senza tocchi per questo tempo. Si sveglia al primo tocco; non parte mentre guardi una telecamera.", "With no touches for this long. Wakes on the first touch; doesn't start while you watch a camera.")}</p>`;
}
/* anteprima nel foglio: si monta (e si rimonta quando cambia qualcosa) dopo ogni disegno */
let PV = null;
function anteprima() {
  const box = document.querySelector(".ssp1");
  if (!box) { if (PV) { PV.stop(); PV = null; } return; }
  const s = ssStile(), vista = s === "auto" ? (ED.sub === "notte" ? "notte" : giorno() === "foto" && haFoto() ? "foto" : "cielo") : s;
  const chiave = JSON.stringify([vista, sGet("ssCfg"), fonte(), ssDir(), sGet("ssUrl"), sGet("ssLista"), attenua(), notteDa(), notteA()]);
  if (PV && PV.root === box && PV.chiave === chiave) return;
  PV?.stop(); PV = monta(box, vista, true); PV.chiave = chiave;
}
FISSI.push(anteprima);

/* ---------- scelta della cartella delle foto ---------- */
let dir = "media-source://media_source", elenco = null, daFoglio = false;
async function apri(id) {
  dir = id; elenco = null; render();
  try { elenco = await ws({ type: "media_source/browse_media", media_content_id: id }); } catch (e) { elenco = { title: t("Errore", "Error"), children: [], err: e.message || e.code }; }
  render();
}
function sfoglia() {
  const L = elenco?.children || [], cartelle = L.filter(c => c.can_expand), n = L.filter(c => c.media_class === "image" || /^image\//.test(c.media_content_type || "")).length;
  return `<div class="sh-head"><div><h3>🖼️ ${t("Cartella delle foto", "Photo folder")}</h3><div class="small muted">${t("Dai Media di Home Assistant (per esempio la cartella /media). Le foto si caricano da Impostazioni → Media.", "From Home Assistant's Media (e.g. the /media folder). Upload photos in Settings → Media.")}</div></div><button class="x" data-act="${daFoglio ? "ssCfg" : "sheetClose"}">×</button></div>
    <div class="row between" style="margin-bottom:8px"><b>${esc(elenco?.title || "…")}</b>${dir !== "media-source://media_source" ? `<button class="btn sm" data-act="ssSu">⬆ ${t("Su", "Up")}</button>` : ""}</div>
    ${!elenco ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : `<div class="stack">${cartelle.map(c => `<button class="li" data-act="ssApri" data-id="${esc(c.media_content_id)}"><span class="ic">📁</span><div class="tx"><b>${esc(c.title)}</b></div><span class="st">›</span></button>`).join("") || `<div class="small muted">${elenco.err ? esc(elenco.err) : t("Nessuna sottocartella.", "No subfolders.")}</div>`}</div>
      <button class="btn pri" data-act="ssScegli" style="margin-top:12px" ${n ? "" : "disabled"}>✅ ${t(`Usa questa cartella (${n} foto)`, `Use this folder (${n} photos)`)}</button>`}`;
}
const storia = [];
const toggle = (L, v) => L.includes(v) ? L.filter(x => x !== v) : [...L, v];
Object.assign(ACT, {
  ssMin: el => { sSet("ssMin", el.dataset.v); riarma(); render(); },
  ssStile: el => { sSet("ssStile", el.dataset.v); ED.sub = "giorno"; render(); },
  ssProva: () => { setTimeout(() => mostra(true), 150); },
  ssCfg: () => { daFoglio = false; openSheet(foglio); },
  ssSub: el => { ED.sub = el.dataset.v; render(); },
  ssGiorno: el => { sSet("ssGiorno", el.dataset.v); render(); },
  ssVel: el => { setCfg(el.dataset.s, "vel", +el.dataset.v); render(); },
  ssEff: el => { setCfg(el.dataset.s, "eff", el.dataset.v); render(); },
  ssInfo: el => { const s = el.dataset.s, I = INFO_DI[s]; setCfg(s, "info", I.filter(k => toggle(cfg(s).info, el.dataset.v).includes(k))); render(); },
  ssFonte: el => { sSet("ssFonte", el.dataset.v); render(); },
  ssAtt: el => { sSet("ssAtt", el.dataset.v); render(); },
  ssDir: () => { daFoglio = UI.sheet === foglio; storia.length = 0; openSheet(sfoglia); apri("media-source://media_source"); },
  ssApri: el => { storia.push(dir); apri(el.dataset.id); },
  ssSu: () => apri(storia.pop() || "media-source://media_source"),
  ssScegli: () => { sSet("ssDir", dir); sSet("ssFonte", "media"); toast("🖼️ " + (elenco?.title || "")); if (daFoglio) openSheet(foglio); else closeSheet(); },
});
Object.assign(CHG, {
  ssUrl: el => { sSet("ssUrl", el.value.trim()); render(); },
  ssLista: el => { sSet("ssLista", el.value); render(); },
  ssNotteDa: el => { sSet("ssNotteDa", el.value); render(); },
  ssNotteA: el => { sSet("ssNotteA", el.value); render(); },
});

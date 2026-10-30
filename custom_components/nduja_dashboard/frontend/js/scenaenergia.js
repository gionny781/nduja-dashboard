/* Scena dell'energia (pagina Energia, «Adesso»): cielo, sole, luna e stelle, meteo, casa con i pannelli, batteria,
   contatore della rete, auto in carica e linee di energia con i pallini che scorrono.
   Tutto disegnato in SVG apposta per 'Nduja e animato solo con il CSS (nduja.css, «scena dell'energia»):
   transform, opacity e stroke-dashoffset, pochi elementi, fermo con prefers-reduced-motion.
   I colori del cielo e della casa seguono il sole (sun.sun: elevation, rising, next_rising, next_setting);
   il meteo di casa (weatherEnt) aggiunge nuvole, pioggia, neve, grandine, nebbia, vento e lampi.
   scena(d) riceve da energia.js i dati già letti e restituisce l'HTML: svg + etichette (sul telefono, tessere sotto).
   La usa anche la pagina Meteo (d.meteo: solo cielo, colline e casa, senza il cerchio dei consumi; d.w: il meteo da mostrare). */
import { S, t, esc, attr, hhmm, weatherEnt, WX } from "./core.js";

/* ---------- geometrie: largo (tablet e PC) e stretto (telefono) ---------- */
const GEO = {
  largo: { W: 1000, H: 430, hz: 340, k: 1, arco: [70, 930, 62], rs: 26,
    casa: { x0: 420, x1: 580, top: 258, rb: [405, 595], rt: [445, 555], ry: 188, hub: [500, 304, 19], fin: [[436, 268, 34, 28], [530, 268, 34, 28]], porta: [446, 312, 22, 28], cam: [532, 172, 14, 28], col: 6 },
    palo: { x: 250, top: 242, box: [231, 279, 38, 40] }, traliccio: { x: 96, s: 1 },
    bat: [664, 286, 32, 54], wb: [750, 294, 20, 28], auto: { x: 880, s: 1 },
    L: { solRete: "M407 259Q330 274 254 246", reteCasa: "M269 304H481", solCasa: "M500 240V285", solBat: "M593 259Q646 252 676 282",
      batCasa: "M664 312H519", casaAuto: "M500 323V356H760V322C776 340 800 338 814 318" },
    chip: { pv: [500, 146], rete: [250, 388], casa: [500, 388], bat: [680, 388], auto: [880, 388] } },
  stretto: { W: 400, H: 300, hz: 232, k: .62, arco: [26, 374, 30], rs: 16,
    casa: { x0: 148, x1: 252, top: 180, rb: [138, 262], rt: [168, 232], ry: 134, hub: [200, 208, 12], fin: [[157, 188, 20, 15], [223, 188, 20, 15]], porta: [158, 214, 15, 18], cam: [216, 120, 10, 22], col: 5 },
    palo: { x: 56, top: 170, box: [44, 190, 24, 26] }, traliccio: null,
    bat: [282, 196, 20, 36], wb: null, auto: { x: 356, s: .5 },
    L: { solRete: "M142 181Q100 192 59 172", reteCasa: "M68 208H188", solCasa: "M200 160V196", solBat: "M258 181Q282 176 291 192",
      batCasa: "M282 214H212", casaAuto: "M200 220V242H323V222" },
    chip: null },
};

/* ---------- colori ---------- */
const lim = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
/** mescola due colori #rrggbb (k da 0 = a, a 1 = b) */
export const mix = (a, b, k) => { k = lim(k); const A = hx(a), B = hx(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
/** colore lungo una scala [[valore, colore], …] */
const scala = (P, v) => { if (v <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (v <= P[i][0]) return mix(P[i - 1][1], P[i][1], (v - P[i - 1][0]) / (P[i][0] - P[i - 1][0])); return P[P.length - 1][1]; };

/* ---------- sole: dove si trova e com'è il cielo ---------- */
/** { su (sopra l'orizzonte), el (gradi), f (0 alba → 1 tramonto, o tramonto → alba di notte), sale, alba, tramonto } */
export function sole() {
  const s = S["sun.sun"], ora = Date.now(), G = 864e5;
  let su, el, f, sale, alba, tramonto;
  if (s?.attributes) {
    const a = s.attributes, nr = Date.parse(a.next_rising), ns = Date.parse(a.next_setting);
    su = s.state === "above_horizon"; el = parseFloat(a.elevation); sale = typeof a.rising === "boolean" ? a.rising : null;
    if (isNaN(el)) el = su ? 20 : -20;
    if (!isNaN(nr) && !isNaN(ns)) {
      /* di giorno l'alba di oggi è circa 24 ore prima della prossima; di notte vale lo stesso per il tramonto di ieri */
      f = su ? (ora - (nr - G)) / (ns - (nr - G)) : (ora - (ns - G)) / (nr - (ns - G));
      alba = nr; tramonto = ns;
    }
  }
  if (f == null || !isFinite(f)) {   // senza sun.sun: giorno dalle 7 alle 19
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60, oggi = x => { const q = new Date(d); q.setHours(x, 0, 0, 0); if (q < d) q.setDate(q.getDate() + 1); return q.getTime(); };
    su = h >= 7 && h < 19; f = su ? (h - 7) / 12 : ((h + 5) % 24) / 12;
    el = su ? 4 + Math.sin(Math.PI * f) * 40 : -6 - Math.sin(Math.PI * f) * 30; alba = oggi(7); tramonto = oggi(19); sale = null;
  }
  f = lim(f);
  if (sale == null) sale = su ? f < .5 : f > .5;
  return { su, el, f, sale, alba, tramonto };
}

/* ---------- meteo ---------- */
/** com'è il cielo: nubi (quante), cop (copertura 0-1), grigio (quanto si spegne il cielo), cupo (nuvole scure), cosa cade, lampi, nebbia, vento */
function meteo(w = weatherEnt()) {
  const st = w && S[w] ? S[w].state : "";
  const M = {
    sunny: [0, 0, 0, 0], "clear-night": [0, 0, 0, 0], partlycloudy: [3, .3, .08, 0], cloudy: [5, .8, .42, .25], fog: [2, .75, .5, .15],
    rainy: [5, .9, .55, .6, "pioggia"], pouring: [6, 1, .66, .8, "rovesci"], lightning: [5, .9, .66, .85], "lightning-rainy": [6, 1, .72, .9, "pioggia"],
    snowy: [5, .85, .38, .3, "neve"], "snowy-rainy": [5, .9, .5, .5, "nevischio"], hail: [5, .9, .6, .7, "grandine"],
    windy: [3, .35, .1, 0], "windy-variant": [4, .55, .25, .2], exceptional: [6, 1, .75, .9],
  }[st] || [0, 0, 0, 0];
  let [nubi, cop, grigio, cupo, cade = null] = M;
  /* poco nuvoloso: quante nuvole lo dice la copertura, se il meteo la dà */
  const cc = parseFloat(attr(w, "cloud_coverage"));
  if (st === "partlycloudy" && !isNaN(cc)) { nubi = cc < 25 ? 2 : cc < 55 ? 3 : 4; cop = lim(cc / 100, .2, .6); }
  const vento = parseFloat(attr(w, "wind_speed")), kmh = isNaN(vento) ? null : /m\/s/.test(attr(w, "wind_speed_unit") || "") ? vento * 3.6 : /mph/.test(attr(w, "wind_speed_unit") || "") ? vento * 1.61 : vento;
  return { st, w, nubi, cop, grigio, cupo, cade, lampi: /lightning|exceptional/.test(st), nebbia: st === "fog", ventoso: /windy/.test(st), kmh };
}

/* ---------- pezzi ---------- */
const r1 = n => Math.round(n * 10) / 10;
/** numeri casuali ma sempre uguali (la scena non cambia a ogni disegno) */
const caso = seme => { let s = seme; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const NUVOLA = "M24 56C10 56 2 48 2 38C2 27 11 20 22 21C24 9 35 2 48 2C59 2 68 8 72 17C77 12 84 10 91 10C106 10 117 21 117 35C127 35 136 42 136 47C136 52 132 56 126 56Z";
/* nuvole: x (frazione), y (frazione del cielo), grandezza */
const NUBI = [[.14, .2, 1.05], [.6, .1, .8], [.84, .3, 1], [.36, .36, .7], [.74, .02, .9], [.04, .44, .78]];
/** durata dei pallini: più watt, più veloci (a gradini, così l'animazione non salta a ogni lettura) */
export const durata = w => w < 150 ? 2.3 : w < 400 ? 1.7 : w < 1000 ? 1.25 : w < 2500 ? .9 : w < 5000 ? .66 : .5;
/** linea di energia: binario + pallini; v = watt, rv = verso al contrario */
function linea(g, d, v, col, rv, cls = "") {
  const on = v > 20, sw = r1(g.k * (v < 400 ? 4.6 : v < 2500 ? 5.6 : 6.6));
  return `<path class="lb" d="${d}" stroke-width="${r1(7.5 * g.k)}"/>${on ? `<path class="fd ${rv ? "rv" : ""} ${cls}" d="${d}" style="stroke:${col};stroke-width:${sw}px;animation-duration:${durata(v)}s"/>` : ""}`;
}
/** pannelli sul tetto: celle in righe che seguono la pendenza del tetto (trapezio) */
function pannelli(c) {
  const [b0, b1] = c.rb, [t0, t1] = c.rt, B = c.top, T = c.ry, xl = y => t0 + (b0 - t0) * (y - T) / (B - T), xr = y => t1 + (b1 - t1) * (y - T) / (B - T);
  const pad = (B - T) * .14, ya = T + pad, yb = B - pad * .8, gap = (B - T) * .05, righe = [[ya, (ya + yb) / 2 - gap / 2], [(ya + yb) / 2 + gap / 2, yb]];
  const ins = (b1 - b0) * .045, n = c.col, celle = [];
  for (const [y0, y1] of righe) {
    const a0 = xl(y0) + ins, a1 = xr(y0) - ins, z0 = xl(y1) + ins, z1 = xr(y1) - ins, ga = (a1 - a0) * .018;
    for (let i = 0; i < n; i++) {
      const p = (x0, x1, j) => x0 + (x1 - x0) * j / n;
      celle.push(`M${r1(p(a0, a1, i) + ga)} ${r1(y0)}L${r1(p(a0, a1, i + 1) - ga)} ${r1(y0)}L${r1(p(z0, z1, i + 1) - ga)} ${r1(y1)}L${r1(p(z0, z1, i) + ga)} ${r1(y1)}Z`);
    }
  }
  const tutte = celle.join(""), righeInt = righe.map(([y0, y1]) => [.33, .66].map(q => { const y = y0 + (y1 - y0) * q; return `M${r1(xl(y) + ins)} ${r1(y)}L${r1(xr(y) - ins)} ${r1(y)}`; }).join("")).join("");
  return { tutte, righeInt, x0: xl(ya), x1: xr(ya), y0: ya, y1: yb };
}
/** auto vista di lato (davanti a sinistra, verso la colonnina), con le ruote a terra in y = 0 */
function macchina(a, k) {
  const b = a.b, ric = a.ric, cb = b == null ? null : b < 15 ? "#ff453a" : b < 30 ? "#ff9f0a" : "#30d158";
  return `<path class="car" d="M-74 -12Q-75 -26 -60 -29L-36 -33Q-20 -50 4 -51L28 -51Q46 -50 58 -34L68 -31Q76 -29 75 -16L74 -10Q73 -6 68 -6L-69 -6Q-74 -6 -74 -12Z"/>
    <path class="vt" d="M-30 -33Q-17 -47 2 -47H8V-33Z"/><path class="vt" d="M13 -47H27Q42 -46 52 -33H13Z"/>
    <path class="cl" d="M10 -33V-11M-60 -27H66"/><rect class="fa" x="-74" y="-25" width="6" height="4" rx="2"/><rect class="fp" x="70" y="-25" width="5" height="5" rx="2"/>
    <circle class="ru" cx="-46" cy="-13" r="13"/><circle class="rc" cx="-46" cy="-13" r="5.5"/><circle class="ru" cx="46" cy="-13" r="13"/><circle class="rc" cx="46" cy="-13" r="5.5"/>
    <circle class="pt ${ric ? "on" : ""}" cx="-66" cy="-22" r="3.2"/>
    ${b != null ? `<g class="cb ${ric ? "on" : ""}" transform="translate(0 -64)"><rect class="cbc" x="-22" y="-6" width="44" height="12" rx="4"/><rect x="-20" y="-4" width="${r1(40 * lim(b / 100))}" height="8" rx="2.5" style="fill:${cb}"/><path class="cbt" d="M22 -2.5h3v5h-3z"/>
      ${ric ? `<path class="fulm" d="M2 -15l-6 9h4.5l-2.5 7 7-10h-4.5l2-6z" transform="translate(0 -4)"/>` : ""}</g>` : ""}`;
}
/** traliccio dell'alta tensione (decorazione), base in y = 0 */
const traliccio = () => `<path class="tr" d="M-24 0L-7 -150M24 0L7 -150M-7 -150H7M-20 -24H20M-17 -50H17M-14 -76H14M-11 -102H11M-9 -126H9M-20 -24L17 -50M20 -24L-17 -50M-17 -50L14 -76M17 -50L-14 -76M-14 -76L11 -102M14 -76L-11 -102M-11 -102L9 -126M11 -102L-9 -126M-30 -138H30M-24 -116H24M-30 -138L-7 -150M30 -138L7 -150"/>
  <path class="tr is" d="M-28 -138v7M28 -138v7M-22 -116v7M22 -116v7"/>`;

/* ---------- la scena ---------- */
/** d = { stretto, pv, haPv, rete, haRete, bat, haBat, soc, casa, F (ripartizione, energia.js), auto (ricarica, auto.js), picco (W), titolo,
         meteo (pagina Meteo: niente cerchio dei consumi), w (entità meteo, se non è quella di casa) }
    → { html, sole, meteo, g (geometria) } */
export function scena(d) {
  const g = d.stretto ? GEO.stretto : GEO.largo, { W, H, hz, k } = g, c = g.casa;
  const sl = sole(), mt = meteo(d.w || weatherEnt()), el = sl.el, F = d.F || {};
  /* colori del cielo: notte → crepuscolo → alba o tramonto → giorno */
  const alto = scala([[-12, "#060d1f"], [-4, "#1d2a57"], [3, "#4a68b4"], [12, "#2f7ed8"]], el);
  const basso = scala([[-12, "#16223f"], [-4, sl.sale ? "#c98a73" : "#b8675d"], [3, sl.sale ? "#ffbf7d" : "#ff9563"], [12, "#a8dbff"]], el);
  const luce = lim((el + 5) / 13);   // 0 notte, 1 giorno pieno
  const lg = luce * (1 - mt.cupo * .45), gA = mix("#191e29", "#7b8696", lg), gB = mix("#272d39", "#aab3bf", lg);
  const cieloA = mix(alto, gA, mt.grigio), cieloB = mix(basso, gB, mt.grigio);
  /* paesaggio: più scuro di notte e con il brutto tempo; bianco con la neve */
  const scurisci = col => mix(col, "#253129", mt.grigio * .4);
  let pr1 = scurisci(mix("#0e1b15", "#5d9b4d", luce)), pr2 = scurisci(mix("#13241a", "#7cb963", luce));
  if (/neve|nevischio/.test(mt.cade || "")) { pr1 = mix(pr1, mix("#4c586b", "#e3eaf2", luce), .78); pr2 = mix(pr2, mix("#5a667a", "#f1f5f9", luce), .8); }
  const cella = mix("#0c1730", "#1d3a6b", luce), vars = `--muro:${mix("#283043", "#d4dce6", luce)};--tetto:${mix("#141925", "#3d4454", luce)};--vetro:${mix("#141c2e", "#a6cbe8", luce)};--pr1:${pr1};--pr2:${pr2};`
    + `--fil:${mix("#8a95ad", "#3b4354", luce)};--box:${mix("#394155", "#e6eaf0", luce)};--auto:${mix("#173058", "#2f78d6", luce)};--nube:${mix(mix("#3c465a", "#f7f9fc", luce), mix("#252b36", "#848d9c", luce), mt.cupo)}`;

  /* sole e luna sull'arco */
  const [ax0, ax1, atop] = g.arco, pos = f => [r1(ax0 + (ax1 - ax0) * f), r1(hz - Math.sin(Math.PI * f) * (hz - atop) - g.rs * .25)];
  const [sx, sy] = pos(sl.f), nott = !sl.su, coperto = mt.cop;
  const soleVis = sl.su ? lim(1 - coperto * .7, .25) : 0;
  const stelle = nott ? lim((-el - 3) / 9) * (1 - coperto) : 0, lunaVis = nott ? lim((-el + 1) / 6) * lim(1 - coperto * .75, .15) : 0;

  /* luna: fase dal calendario (luna nuova di riferimento: 6 gennaio 2000, 18:14 UTC) */
  const fase = (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1 + 1) % 1, R = g.rs * .82;
  const kx = Math.cos(2 * Math.PI * fase), cresce = fase < .5, rx = r1(Math.abs(kx) * R);
  const illuminata = `M0 ${-R}A${R} ${R} 0 0 ${cresce ? 1 : 0} 0 ${R}A${rx} ${R} 0 0 ${cresce ? (kx > 0 ? 0 : 1) : (kx > 0 ? 1 : 0)} 0 ${-R}Z`;

  /* stelle */
  const rs = caso(11), stelleH = Array.from({ length: d.stretto ? 12 : 22 }, (_, i) => `<circle class="tw${i % 3}" cx="${r1(rs() * W)}" cy="${r1(rs() * hz * .62)}" r="${r1((.7 + rs() * .9) * (d.stretto ? .8 : 1))}"/>`).join("");

  /* nuvole: passano da sinistra a destra; il ritardo negativo le distribuisce nel cielo */
  const durN = lim(95 - Math.round((mt.kmh || (mt.ventoso ? 35 : 8)) / 10) * 16, 22, 95), sN = d.stretto ? .52 : 1;
  const nuvole = NUBI.slice(0, mt.nubi).map(([fx, fy, sc], i) => {
    const s = sc * sN, x0 = fx * W, y = r1(fy * hz * .7 + 6), a = -(x0 + 140 * s), b = W - x0 + 10, dur = r1(durN * (1.3 - sc * .3)), p = (x0 + 140 * s) / (W + 10 + 140 * s);
    return `<g transform="translate(${r1(x0)} ${y})"><g class="nb" style="--a:${r1(a)}px;--b:${r1(b)}px;animation-duration:${dur}s;animation-delay:${r1(-p * dur)}s"><path d="${NUVOLA}" transform="scale(${r1(s * 100) / 100})"/></g></g>`;
  }).join("");

  /* precipitazioni: due copie una sopra l'altra che scendono (il giro si chiude senza salti) */
  const cade = (tipo, n, seme) => {
    const rr = caso(seme), dx = tipo === "neve" ? 0 : r1(H * .22), el1 = [];
    for (let i = 0; i < n; i++) {
      const x = r1(rr() * (W + dx) - W * .02), y = r1(rr() * H), q = rr();
      const pezzo = (X, Y) => tipo === "neve" ? `<circle cx="${X}" cy="${Y}" r="${r1((1.3 + q * 1.6) * (d.stretto ? .8 : 1))}"/>` : tipo === "grandine" ? `<circle cx="${X}" cy="${Y}" r="${r1(d.stretto ? 1.3 : 1.8)}"/>`
        : `<path d="M${X} ${Y}l${r1(-3 * k)} ${r1((11 + q * 6) * k)}"/>`;
      el1.push(pezzo(x, y), pezzo(r1(x + dx), r1(y - H)));
    }
    const vel = { pioggia: .75, rovesci: .5, grandine: .62, neve: 9 }[tipo];
    return `<g class="cd ${tipo === "rovesci" ? "pioggia" : tipo}" style="--dx:${-dx}px;--dy:${H}px;animation-duration:${vel}s">${el1.join("")}</g>`;
  };
  const dens = d.stretto ? .45 : 1, cadute = !mt.cade ? "" : {
    pioggia: cade("pioggia", Math.round(38 * dens), 3), rovesci: cade("rovesci", Math.round(70 * dens), 5), grandine: cade("grandine", Math.round(34 * dens), 9) + cade("pioggia", Math.round(18 * dens), 4),
    neve: `<g class="dond">${cade("neve", Math.round(46 * dens), 7)}</g>`, nevischio: `<g class="dond">${cade("neve", Math.round(26 * dens), 7)}</g>` + cade("pioggia", Math.round(22 * dens), 3),
  }[mt.cade];
  const lampi = mt.lampi ? `<rect class="lpf" x="0" y="0" width="${W}" height="${H}"/>
    <path class="lp" d="M0 0L-10 26H2L-9 56L17 17H5L13 0Z" transform="translate(${r1(W * .3)} ${r1(hz * .3)}) scale(${r1(k * 1.3 * 100) / 100})"/>
    <path class="lp l2" d="M0 0L-10 26H2L-9 56L17 17H5L13 0Z" transform="translate(${r1(W * .76)} ${r1(hz * .22)}) scale(${r1(k * 1.05 * 100) / 100})"/>` : "";
  /* nebbia: velo su tutta la scena e banchi morbidi che scivolano piano */
  const nebbia = mt.nebbia ? `<rect class="nbv" width="${W}" height="${H}"/>` + [.42, .62, .8, .97].map((fy, i) => `<rect class="nbb n${i}" x="${-W * .25}" y="${r1(hz * fy - 34 * k)}" width="${W * 1.5}" height="${r1(68 * k)}" fill="url(#en7nebbia)"/>`).join("") : "";
  /* vento: folate (un tratto che corre lungo una curva) */
  const vento = mt.ventoso ? [[.08, .2], [.46, .34], [.2, .52], [.62, .12]].map(([fx, fy], i) => { const L = W * .2;
    return `<path class="vn v${i}" d="M${r1(W * fx)} ${r1(hz * fy)}q${r1(L * .3)} ${r1(-8 * k)} ${r1(L * .6)} 0t${r1(L * .4)} ${r1(-4 * k)}q${r1(L * .12)} ${r1(-7 * k)} ${r1(L * .02)} ${r1(-12 * k)}" stroke-width="${r1(2.2 * k + .5)}"/>`; }).join("") : "";

  /* casa */
  /* pannelli: quanto brillano (a passi del 5%, così non si ridisegnano a ogni lettura) */
  const P = d.haPv ? pannelli(c) : null, lv = d.haPv ? Math.round(lim((d.pv || 0) / (d.picco || 1)) * 20) / 20 : 0;
  const notteCasa = luce < .45, accesa = notteCasa && (d.casa == null || d.casa > 30);
  const hub = c.hub, consumo = d.casa || 0;
  const tetto = `M${c.rb[0]} ${c.top}L${c.rt[0]} ${c.ry}H${c.rt[1]}L${c.rb[1]} ${c.top}Z`;
  const casa = `<rect class="cm" x="${c.cam[0]}" y="${c.cam[1]}" width="${c.cam[2]}" height="${c.cam[3]}" rx="2"/>
    <rect class="mu" x="${c.x0}" y="${c.top}" width="${c.x1 - c.x0}" height="${hz - c.top + 2}"/>
    <path class="te" d="${tetto}"/><path class="gr" d="M${c.rb[0] - 4 * k} ${c.top}H${c.rb[1] + 4 * k}" stroke-width="${r1(5 * k)}"/>
    ${P ? `<g class="pan"><path class="ca2" d="${P.tutte}" style="stroke-width:${r1((3 + lv * 5) * k)};opacity:${r1(lv * .55 * 100) / 100}"/>
      <path class="ce" d="${P.tutte}" style="fill:${mix(cella, "#4b93ec", lv * .85)};stroke:${mix("#9dbcf2", "#ffe27a", lv)}"/><path class="ci" d="${P.righeInt}"/><path class="cg" d="${P.tutte}" style="opacity:${r1(lv * .22 * 100) / 100}"/>
      ${lv > .04 && sl.su ? `<g clip-path="url(#en7pan)"><rect class="lu" x="${r1(P.x0 - 40 * k)}" y="${r1(c.ry)}" width="${r1(30 * k)}" height="${c.top - c.ry}" style="--da:${r1(P.x1 - P.x0 + 80 * k)}px;animation-duration:${lv > .6 ? 5 : lv > .3 ? 7 : 9}s"/></g>` : ""}</g>` : ""}
    ${c.fin.map(([x, y, w, h]) => `<rect class="fi ${accesa ? "on" : ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r1(2 * k)}"/><path class="fx" d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}"/>`).join("")}
    <rect class="po" x="${c.porta[0]}" y="${c.porta[1]}" width="${c.porta[2]}" height="${c.porta[3] + 1}" rx="${r1(2 * k)}"/><circle class="pm" cx="${r1(c.porta[0] + c.porta[2] * .78)}" cy="${r1(c.porta[1] + c.porta[3] * .55)}" r="${r1(1.6 * k + .4)}"/>`;
  const hubH = `<g class="hb ${consumo > 20 ? "on" : ""}" style="--hd:${r1(durata(consumo) * 2.2)}s"><circle class="hr" cx="${hub[0]}" cy="${hub[1]}" r="${hub[2]}"/><circle class="hc" cx="${hub[0]}" cy="${hub[1]}" r="${hub[2]}"/>
    <path class="hf" d="M${r1(hub[0] + 2 * k * 1.6)} ${r1(hub[1] - 12 * k * 1.1)}l${r1(-9 * k)} ${r1(13 * k)}h${r1(6.5 * k)}l${r1(-3 * k)} ${r1(10 * k)}l${r1(10 * k)} ${r1(-14 * k)}h${r1(-6.5 * k)}z"/></g>`;

  /* contatore della rete */
  const pl = g.palo, imp = (d.rete || 0) > 20, esp = (d.rete || 0) < -20, [bx, by, bw, bh] = pl.box;
  const palo = d.haRete ? `<rect class="pl" x="${pl.x - 3 * k}" y="${pl.top}" width="${r1(6 * k)}" height="${hz - pl.top}"/>
    <rect class="ct" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r1(5 * k)}"/><rect class="cd2 ${imp ? "imp" : esp ? "exp" : ""}" x="${r1(bx + bw * .16)}" y="${r1(by + bh * .18)}" width="${r1(bw * .68)}" height="${r1(bh * .34)}" rx="${r1(2.4 * k)}"/>
    <path class="cf ${imp ? "imp" : esp ? "exp" : ""}" d="${imp ? `M${pl.x} ${r1(by + bh * .24)}v${r1(bh * .22)}m${r1(-4 * k)} ${r1(-4 * k)}l${r1(4 * k)} ${r1(4 * k)}l${r1(4 * k)} ${r1(-4 * k)}` : esp ? `M${pl.x} ${r1(by + bh * .46)}v${r1(-bh * .22)}m${r1(-4 * k)} ${r1(4 * k)}l${r1(4 * k)} ${r1(-4 * k)}l${r1(4 * k)} ${r1(4 * k)}` : `M${r1(pl.x - 5 * k)} ${r1(by + bh * .35)}h${r1(10 * k)}`}"/>
    <circle class="ctl" cx="${r1(bx + bw * .3)}" cy="${r1(by + bh * .74)}" r="${r1(2.2 * k)}"/><circle class="ctl" cx="${r1(bx + bw * .7)}" cy="${r1(by + bh * .74)}" r="${r1(2.2 * k)}"/>` : "";
  const tr = g.traliccio, cavi = d.haRete ? (tr ? `<g transform="translate(${tr.x} ${hz}) scale(${tr.s})">${traliccio()}</g>
      <path class="cv" d="M${tr.x + 30} ${hz - 131}Q${(tr.x + 30 + pl.x) / 2} ${hz - 100} ${pl.x} ${pl.top + 3}M${tr.x - 30} ${hz - 131}Q${tr.x - 70} ${hz - 112} -10 ${hz - 128}M${tr.x + 24} ${hz - 109}Q${(tr.x + 24 + pl.x) / 2} ${hz - 82} ${pl.x} ${pl.top + 9}"/>`
    : `<path class="cv" d="M-6 ${pl.top - 6}Q${pl.x / 2} ${pl.top + 12} ${pl.x} ${pl.top + 3}"/>`) : "";

  /* batteria */
  const soc = d.soc, sc = soc == null ? null : lim(soc / 100), carica = (d.bat || 0) < -20, scarica = (d.bat || 0) > 20;
  const socC = soc == null ? "#8e8e93" : soc < 20 ? "#ff453a" : soc < 40 ? "#ff9f0a" : "#30d158";
  const [qx, qy, qw, qh] = g.bat, pad = r1(3.2 * k), hIn = qh - pad * 2, hL = sc == null ? 0 : r1(Math.max(2, hIn * sc));
  const batteria = d.haBat ? `<rect class="bt" x="${r1(qx + qw * .3)}" y="${r1(qy - 4 * k)}" width="${r1(qw * .4)}" height="${r1(5 * k)}" rx="${r1(1.5 * k)}"/>
    <rect class="bc" x="${qx}" y="${qy}" width="${qw}" height="${qh}" rx="${r1(6 * k)}"/>
    <rect x="${r1(qx + pad)}" y="${r1(qy + pad + hIn - hL)}" width="${r1(qw - pad * 2)}" height="${hL}" rx="${r1(3.5 * k)}" style="fill:${socC}" class="bl"/>
    <g clip-path="url(#en7bat)">${carica || scarica ? `<g class="bv ${scarica ? "giu" : ""}" style="--bd:${r1(qh * .5)}px">${[0, 1, 2, 3].map(i => `<path d="M${r1(qx + qw * .28)} ${r1(qy + qh * (.2 + i * .25) + 4 * k)}l${r1(qw * .22)} ${r1((scarica ? 5 : -5) * k)}l${r1(qw * .22)} ${r1((scarica ? -5 : 5) * k)}"/>`).join("")}</g>` : ""}</g>` : "";

  /* auto e colonnina */
  const A = d.auto, au = g.auto, wb = g.wb;
  const autoH = A ? `${wb ? `<rect class="pl" x="${wb[0] + wb[2] / 2 - 2.5}" y="${wb[1] + wb[3]}" width="5" height="${hz - wb[1] - wb[3]}"/><rect class="wb" x="${wb[0]}" y="${wb[1]}" width="${wb[2]}" height="${wb[3]}" rx="5"/>
      <circle class="wl ${A.ric ? "on" : ""}" cx="${wb[0] + wb[2] / 2}" cy="${wb[1] + 9}" r="4"/>` : ""}
    <g transform="translate(${au.x} ${hz}) scale(${au.s})">${macchina(A, k)}</g>` : "";

  /* linee di energia */
  const Ln = g.L, rv = (d.rete || 0) < 0;
  const linee = [
    d.haPv && d.haRete ? linea(g, Ln.solRete, F.solRete, "#30d158") : "",
    d.haRete ? linea(g, Ln.reteCasa, (F.reteCasa || 0) + (F.reteBat || 0) + (F.batRete || 0), rv ? "#30d158" : "#ff6961", rv) : "",
    d.haPv ? linea(g, Ln.solCasa, F.solCasa, "#ffd60a") : "",
    d.haPv && d.haBat ? linea(g, Ln.solBat, F.solBat, "#ffd60a") : "",
    d.haBat ? linea(g, Ln.batCasa, Math.max(F.batCasa || 0, F.batRete || 0, F.reteBat || 0), "#bf8cff", (F.reteBat || 0) > (F.batCasa || 0) + (F.batRete || 0)) : "",
    A ? linea(g, Ln.casaAuto, A.ric ? Math.max(A.w || 0, 21) : 0, "#64d2ff") : "",
  ].join("");

  /* sole */
  const raggi = Array.from({ length: 12 }, (_, i) => `<path d="M0 ${-g.rs * 1.38}V${-g.rs * 1.75}" transform="rotate(${i * 30})"/>`).join("");
  const soleH = sl.su ? `<g transform="translate(${sx} ${sy})" style="opacity:${r1(soleVis * 100) / 100}"><circle class="sa" r="${g.rs * 3.2}" fill="url(#en7sole)"/>
    ${coperto < .5 ? `<g class="sr" stroke-width="${r1(3 * k + .6)}">${raggi}</g>` : ""}<circle class="sd" r="${g.rs}"/><circle class="sh" r="${r1(g.rs * .62)}" cx="${r1(-g.rs * .22)}" cy="${r1(-g.rs * .22)}"/></g>` : "";
  const lunaH = lunaVis > .02 ? `<g transform="translate(${pos(sl.f)[0]} ${pos(sl.f)[1]})" style="opacity:${r1(lunaVis * 100) / 100}"><circle r="${r1(R * 3)}" fill="url(#en7chiaro)"/><circle class="lo" r="${R}"/>
    <path class="lil" d="${illuminata}"/><g clip-path="url(#en7luna)"><circle class="lc" cx="${r1(-R * .3)}" cy="${r1(-R * .2)}" r="${r1(R * .22)}"/><circle class="lc" cx="${r1(R * .28)}" cy="${r1(R * .35)}" r="${r1(R * .16)}"/><circle class="lc" cx="${r1(R * .1)}" cy="${r1(-R * .5)}" r="${r1(R * .1)}"/></g></g>` : "";

  /* colline e vialetto */
  const colline = `<path class="c2" d="M0 ${hz - 18 * k}Q${W * .18} ${hz - 44 * k} ${W * .38} ${hz - 14 * k}T${W * .78} ${hz - 22 * k}T${W} ${hz - 30 * k}V${hz + 1}H0Z"/>
    <path class="c1" d="M0 ${hz}Q${W * .25} ${hz - 9 * k} ${W * .5} ${hz}T${W} ${hz - 4 * k}V${H}H0Z"/>`;

  const html = `<svg class="en7s" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="${vars}" role="img" aria-label="${esc(d.titolo || "")}">
    <defs><linearGradient id="en7cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cieloA}"/><stop offset="1" stop-color="${cieloB}"/></linearGradient>
      <radialGradient id="en7sole"><stop offset="0" stop-color="#ffe680" stop-opacity=".75"/><stop offset=".35" stop-color="#ffd24d" stop-opacity=".28"/><stop offset="1" stop-color="#ffc83c" stop-opacity="0"/></radialGradient>
      <linearGradient id="en7caldo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset="1" stop-color="#ffc93a"/></linearGradient>
      <linearGradient id="en7nebbia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f6" stop-opacity="0"/><stop offset=".5" stop-color="#eef2f6" stop-opacity=".5"/><stop offset="1" stop-color="#eef2f6" stop-opacity="0"/></linearGradient>
      <radialGradient id="en7chiaro"><stop offset=".3" stop-color="#e8eeff" stop-opacity=".2"/><stop offset="1" stop-color="#e8eeff" stop-opacity="0"/></radialGradient>
      <clipPath id="en7pan"><path d="${P ? P.tutte : "M0 0"}"/></clipPath><clipPath id="en7luna"><path d="${illuminata}"/></clipPath>
      <clipPath id="en7bat"><rect x="${qx}" y="${qy}" width="${qw}" height="${qh}" rx="${r1(6 * k)}"/></clipPath></defs>
    <rect class="cie" width="${W}" height="${H}" fill="url(#en7cielo)"/>
    <g class="stl" style="opacity:${r1(stelle * 100) / 100}">${stelle > .02 ? stelleH : ""}</g>
    <g class="lun">${lunaH}</g><g class="sol">${soleH}</g>
    <g class="nbs" style="fill:var(--nube)">${nuvole}</g>
    <g class="cvv">${cavi}</g>
    <g class="col">${colline}</g>
    <g class="ca">${casa}</g><g class="pa">${palo}</g><g class="ba">${batteria}</g><g class="au">${autoH}</g>
    <g class="ln${d.stretto ? " tl" : ""}">${linee}</g><g class="hu">${d.meteo ? "" : hubH}</g>
    <g class="mt">${nebbia}${vento}${cadute}${lampi}</g>
  </svg>`;
  return { html, sole: sl, meteo: mt, g };
}

/** testo del meteo e del prossimo cambio di luce, per l'intestazione */
export function intestazione(sl, mt) {
  const wx = mt.st ? WX()[mt.st] : null;
  const notte = !sl.su && mt.st === "sunny" ? WX()["clear-night"] : wx;
  const quando = sl.su ? (sl.tramonto ? t("tramonto ", "sunset ") + hhmm(sl.tramonto) : "") : (sl.alba ? t("alba ", "sunrise ") + hhmm(sl.alba) : "");
  return [notte ? notte[0] + " " + notte[1] : "", quando].filter(Boolean).join(" · ");
}

/** etichette sopra la scena (largo) o tessere sotto (telefono): [{ k, x, y, id, ic, v, s, cls }] */
export function etichette(L, g) {
  const one = e => `<${e.id ? "button" : "div"} class="en7k ${e.cls || ""}" ${e.id ? `data-act="more" data-id="${esc(e.id)}"` : ""} ${g?.chip ? `style="left:${r1(g.chip[e.k][0] / g.W * 100)}%;top:${r1(g.chip[e.k][1] / g.H * 100)}%"` : ""}>
    <span class="en7kv"><i>${e.ic}</i><b>${e.v}</b></span>${e.s ? `<small>${e.s}</small>` : ""}</${e.id ? "button" : "div"}>`;
  return L.map(one).join("");
}

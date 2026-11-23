/* 'Nduja Dashboard — la casa intera in 3D (pagina Mappa → 3D).
   Perché un piccolo motore su <canvas> e non le trasformazioni 3D CSS di prima: la casa intera ha piani uno sopra l'altro,
   un tetto a falde (piani inclinati), porte che girano, mobili e bagliori delle luci. Con il CSS servirebbero molte centinaia
   di elementi con preserve-3d, pesanti sui tablet Android e con incroci sbagliati tra i piani; su un canvas disegno solo
   poligoni piatti, in proiezione ortogonale (come un plastico visto dall'alto), dal piano più basso al più alto e, dentro
   ogni piano, dal più lontano al più vicino. La telecamera sta sempre sopra la casa, quindi questo ordine basta.
   Si ridisegna solo quando serve (gesti, stati che cambiano), niente librerie esterne.
   Sopra il canvas restano in HTML i nomi delle stanze e i dispositivi (gli stessi pallini del 2D): si toccano come nel 2D,
   la pressione lunga apre i dettagli. Modalità leggera: niente bagliori, ombre e tegole; «Riduci movimento»: niente animazioni. */
import { S, REG, FLOORS, AREAS, ACT, UI, LAYOUT, t, esc, fnum, isOn, ok, attr, sGet, sSet, render, leggera, moreInfo, go, roomTemp, lightsOn, inArea, deviceClass } from "./core.js";
import { COL, piani, posizioni, pezzi, proprietari, bordi, mappaAperture, statoAp, unita, altezzaPiano, tetto, finitura, datiFinitura, esterna, posOggetti, nomeStanza, mobili, chiaveMuro } from "./pianta.js";
import { pezziMobile } from "./arredo.js";
import { coloreDi } from "./luce.js";

const fermo = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const SOL = .07;                 // spessore del solaio tra un piano e l'altro
const SP = .2;                   // spallette ai lati delle porte (la porta è larga il pezzo di muro meno 2 × SP)
const CAM0 = { yaw: -32, el: 48, zoom: 1, px: 0, py: 0 };
const leggi = () => { try { const c = JSON.parse(sGet("map3cam") || "{}"); return { ...CAM0, ...Object.fromEntries(Object.entries(c).filter(([k, v]) => k in CAM0 && Number.isFinite(v))) }; } catch { return { ...CAM0 }; } };
const CAM = leggi();
let CUT = sGet("map3cut") != null && Number.isFinite(+sGet("map3cut")) ? +sGet("map3cut") : null;   // quanto è aperta la casa: N = chiusa col tetto, e = piano e aperto
let M = null;                    // il modello costruito all'ultimo disegno della pagina
const salvaCam = () => { sSet("map3cam", JSON.stringify({ yaw: Math.round(CAM.yaw * 10) / 10, el: Math.round(CAM.el * 10) / 10, zoom: Math.round(CAM.zoom * 100) / 100, px: Math.round(CAM.px), py: Math.round(CAM.py) })); };
const muriBassi = () => sGet("map3muri") !== "0";
const nPiani = () => M?.floors.length || 1;
const taglio = () => { const N = nPiani(); return CUT == null ? N : Math.max(0, Math.min(N, CUT)); };
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= modello: piani, stanze, muri, aperture, dispositivi ================= */
function costruisci() {
  const P = piani().filter(p => p.stanze.length), floors = [];
  let z = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) {
    const pos = posizioni(p.f, p.stanze), O = proprietari(pos, p.stanze), H = altezzaPiano(p.f);
    const est = new Map(p.stanze.map(a => [a, esterna(a, p.f)]));
    for (const k of O.keys()) { const [x, y] = k.split(",").map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    floors.push({ f: p.f, nome: p.nome, stanze: p.stanze, pos, O, E: bordi(pos, p.stanze, O), H, z0: z, est, ogg: posOggetti(p.f, p.stanze, pos), AP: mappaAperture(p.f), arredo: mobili(p.f, pos) });
    z += H + SOL;
  }
  if (!floors.length) return { floors, bb: { x0: 0, y0: 0, x1: COL, y1: 4 }, zTot: 1 };
  /* luci accese di ogni piano: posizione, colore e luminosità veri */
  for (const fl of floors) {
    fl.luci = [];
    for (const [k, g] of fl.ogg) if (g.o.tipo === "luce" && S[k]?.state === "on") {
      const b = attr(k, "brightness"), rgb = coloreDi(k) || [255, 200, 130];
      fl.luci.push({ x: g.x, y: g.y, z: fl.z0 + fl.H * .72, a: g.a, rgb, b: b == null ? 1 : cl(b / 255, .15, 1) });
    }
    fl.lit = new Set(fl.luci.map(l => l.a));
  }
  return { floors, bb: { x0, y0, x1, y1 }, zTot: z };
}

/* ================= proiezione ================= */
let V = null, W = 0, Hc = 0, DPR = 1, ctx = null, cv = null;
function vista() {
  const th = CAM.yaw * Math.PI / 180, ph = CAM.el * Math.PI / 180, bb = M.bb, cz = (M.zTot + 1) / 2;
  const v = { c: Math.cos(th), s: Math.sin(th), sp: Math.sin(ph), cp: Math.cos(ph), cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, cz };
  /* zoom «giusto»: la casa (col tetto) riempie il riquadro come la si vede dalla vista iniziale; poi lo zoom lo scegli tu
     (non cambia ruotando, altrimenti la casa si gonfierebbe e sgonfierebbe girandola) */
  if (!M.fit) {
    const hh = M.zTot + 1.1, X = [bb.x0 - .3, bb.x1 + .3], Y = [bb.y0 - .3, bb.y1 + .3], g = CAM0.yaw * Math.PI / 180, e = CAM0.el * Math.PI / 180;
    const c = Math.cos(g), s = Math.sin(g), xs = [], ys = [];
    for (const x of X) for (const y of Y) for (const z of [0, hh]) { const dx = x - v.cx, dy = y - v.cy; xs.push(dx * c - dy * s); ys.push((dx * s + dy * c) * Math.sin(e) - (z - cz) * Math.cos(e)); }
    M.fit = { larg: Math.max(...xs) - Math.min(...xs), alt: Math.max(...ys) - Math.min(...ys), my: (Math.max(...ys) + Math.min(...ys)) / 2 };
  }
  v.k = Math.min((W - Math.min(80, W * .14)) / M.fit.larg, (Hc - 30) / M.fit.alt) * .94 * CAM.zoom;
  v.oy0 = -M.fit.my * v.k;   // la casa al centro, in altezza
  v.ox = W / 2 + CAM.px; v.oy = Hc / 2 + CAM.py + v.oy0;
  v.cam = [v.s * v.cp, v.c * v.cp, v.sp];   // verso chi guarda
  V = v;
}
const proj = (x, y, z) => { const dx = x - V.cx, dy = y - V.cy, dz = z - V.cz, Y2 = dx * V.s + dy * V.c;
  return [V.ox + V.k * (dx * V.c - dy * V.s), V.oy + V.k * (Y2 * V.sp - dz * V.cp), Y2 * V.cp + dz * V.sp]; };
/** il canvas disegna sul piano orizzontale z con le coordinate della pianta */
function piano(z) {
  const k = V.k * DPR, a = k * V.c, b = k * V.s * V.sp, c = -k * V.s, d = k * V.c * V.sp;
  const e = DPR * (V.ox + V.k * (-V.cx * V.c + V.cy * V.s)), f = DPR * (V.oy + V.k * ((-V.cx * V.s - V.cy * V.c) * V.sp - (z - V.cz) * V.cp));
  ctx.setTransform(a, b, c, d, e, f);
}
const schermo = () => ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

/* ================= colori e luce ================= */
const SOLE = (() => { const v = [-.45, -.55, .7], n = Math.hypot(...v); return v.map(x => x / n); })();
const MURO = [234, 230, 222], BORDO_SOL = [176, 170, 160], CAP = [198, 192, 184], TEGOLE = [181, 88, 60], LEGNO_P = [150, 106, 70], METALLO = [150, 154, 162];
const ARANCIO = [255, 159, 10];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
/** luce delle lampade accese delle stanze R su un punto (somma, già pesata) */
function tinta(fl, x, y, z, R) {
  if (!fl.luci.length) return null;
  let r = 0, g = 0, b = 0;
  for (const l of fl.luci) { if (R && !R.includes(l.a)) continue;
    const d = Math.hypot(l.x - x, l.y - y, (l.z - z) * .8), k = Math.max(0, 1 - d / 2.4) ** 2 * l.b * .55; if (k <= 0) continue;
    r += l.rgb[0] * k; g += l.rgb[1] * k; b += l.rgb[2] * k; }
  return r + g + b > 1 ? [r, g, b] : null;
}

/* ================= facce ================= */
/* faccia: { p:[[x,y,z]…], c:[r,g,b], a, tin?, st? (colore del bordo), lw?, teg? (tegole), nolum? } */
const quad = (A, B, z0, z1, extra) => ({ p: [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]], ...extra });
function scatola(x0, y0, x1, y1, z0, h, c, a = 1, tin = null) {
  const z1 = z0 + h, F = [{ p: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c, a, tin }];
  if (h > .015) F.push(quad([x0, y0], [x1, y0], z0, z1, { c, a, tin }), quad([x1, y0], [x1, y1], z0, z1, { c, a, tin }), quad([x1, y1], [x0, y1], z0, z1, { c, a, tin }), quad([x0, y1], [x0, y0], z0, z1, { c, a, tin }));
  return F;
}
/** la stanza dalla parte opposta a chi guarda (per abbassare i muri davanti) */
function dietro(fl, e) {
  if (e.o === "h") return V.c * V.cp > 0 ? e.a1 : e.a2;   // "lontano" = verso −y' : y' cresce con +y quando cos > 0
  return V.s * V.cp > 0 ? e.a1 : e.a2;
}
/** muri, aperture, solaio, mobili e dispositivi di un piano */
function faccePiano(fl, z0, aperto, cutF) {
  const F = [], H = fl.H, PAR = .22, inD = a => a && !fl.est.get(a);
  const fatte = new Set();
  for (const e of fl.E) {
    const i1 = inD(e.a1), i2 = inD(e.a2);
    if (!i1 && !i2 && e.a1 && e.a2) continue;                     // tra due spazi all'aperto: niente muro
    const pieno = i1 || i2;
    let top = pieno ? H : PAR;
    if (pieno && cutF > 0 && muriBassi() && dietro(fl, e)) top = H - (H - H * .3) * cutF;   // muri davanti più bassi per guardare dentro
    const A = [e.x, e.y], B = e.o === "h" ? [e.x + 1, e.y] : [e.x, e.y + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const R = [e.a1, e.a2].filter(Boolean), tin = tinta(fl, mx, my, z0 + top / 2, R);
    /* bordo del solaio verso fuori */
    if (!e.a1 || !e.a2) F.push(quad(A, B, z0 - SOL, z0, { c: BORDO_SOL, a: 1 }));
    const u = fl.AP.get(chiaveMuro(e.o, e.x, e.y));
    if (!u || !pieno) { F.push(quad(A, B, z0, z0 + top, { c: MURO, a: 1, tin })); continue; }
    const ap = u.ap, st = statoAp(ap), luceDentro = R.some(a => fl.lit.has(a)), evid = st.aperta;
    if (ap.tipo === "porta") {
      const Dt = Math.min(H * .8, H - .06), d = e.o === "h" ? [1, 0] : [0, 1], n = unita(ap).length;
      if (top > Dt) F.push(quad(A, B, z0 + Dt, z0 + top, { c: MURO, a: 1, tin }));
      /* la porta vera è un po' più stretta del pezzo di muro: ai lati restano due spallette */
      if (u.i === 0) F.push(quad(A, [A[0] + d[0] * SP, A[1] + d[1] * SP], z0, z0 + Math.min(Dt, top), { c: MURO, a: 1, tin }));
      if (u.i === n - 1) F.push(quad([B[0] - d[0] * SP, B[1] - d[1] * SP], B, z0, z0 + Math.min(Dt, top), { c: MURO, a: 1, tin }));
      /* chiusa, l'anta sta nel muro e si abbassa con lui; aperta, sta dentro la stanza e resta alta tutta */
      if (!fatte.has(ap.id)) { fatte.add(ap.id); F.push(...anta(fl, ap, st, z0, st.aperta && !ap.cover ? Dt : Math.min(Dt, top), evid)); }
    } else {
      const Ws = H * .3, Wt = Math.min(H * .8, H - .06);
      F.push(quad(A, B, z0, z0 + Math.min(Ws, top), { c: MURO, a: 1, tin }));
      if (top > Wt) F.push(quad(A, B, z0 + Wt, z0 + top, { c: MURO, a: 1, tin }));
      if (!fatte.has(ap.id) && top > Ws) { fatte.add(ap.id); F.push(...finestra(fl, ap, st, z0, Ws, Math.min(Wt, top), luceDentro, evid)); }
    }
  }
  /* mobili */
  for (const m of fl.arredo) {
    const R = [fl.O.get(Math.floor(m.x + .2) + "," + Math.floor(m.y + .2))].filter(Boolean);
    for (const [x0, y0, x1, y1, z, h, c, al] of pezziMobile(m)) {
      const hh = Math.min(h, H * .92 - z); if (hh <= 0) continue;
      F.push(...scatola(x0, y0, x1, y1, z0 + z, hh, c, al, tinta(fl, (x0 + x1) / 2, (y0 + y1) / 2, z0 + z + hh, R)));
    }
  }
  /* dispositivi con un corpo: TV, clima, elettrodomestici, casse, robot */
  for (const [k, g] of fl.ogg) F.push(...corpo(fl, k, g, z0, aperto));
  return F;
}
/** anta della porta: gira quando il sensore dice aperta; con una tapparella/garage si alza quanto è alzata */
function anta(fl, ap, st, z0, hT, evid) {
  const U = unita(ap), dir = ap.o === "h" ? [1, 0] : [0, 1], w = U.length - 2 * SP, A = [ap.x + dir[0] * SP, ap.y + dir[1] * SP];
  const B = [A[0] + dir[0] * w, A[1] + dir[1] * w];
  if (hT <= .02) return [];
  if (ap.cover) {
    const p = st.pos ?? 0, zb = z0 + hT * p / 100;
    return zb < z0 + hT - .01 ? [quad(A, B, zb, z0 + hT, { c: METALLO, a: 1, st: evid ? ARANCIO : null, lw: 2 })] : [];
  }
  /* gira verso la stanza al chiuso (di solito quella dopo il muro) */
  const dopo = ap.o === "h" ? fl.O.get(ap.x + "," + ap.y) : fl.O.get(ap.x + "," + ap.y), n = (dopo && !fl.est.get(dopo)) ? (ap.o === "h" ? [0, 1] : [1, 0]) : (ap.o === "h" ? [0, -1] : [-1, 0]);
  const ang = st.aperta ? 78 * Math.PI / 180 : 0, out = [], c = evid ? mix(LEGNO_P, ARANCIO, .45) : LEGNO_P;
  const foglia = (h0, verso, len) => { const d = [dir[0] * verso * Math.cos(ang) + n[0] * Math.sin(ang), dir[1] * verso * Math.cos(ang) + n[1] * Math.sin(ang)];
    out.push(quad(h0, [h0[0] + d[0] * len, h0[1] + d[1] * len], z0, z0 + hT, { c, a: 1, st: evid ? ARANCIO : null, lw: evid ? 2 : 1 })); };
  if (U.length >= 2) { foglia(A, 1, w / 2); foglia(B, -1, w / 2); } else foglia(A, 1, w);
  return out;
}
/** finestra: vetro (caldo se dentro è acceso), ante aperte se il sensore lo dice, tapparella alla sua posizione */
function finestra(fl, ap, st, z0, Ws, Wt, luce, evid) {
  const U = unita(ap), w = U.length, A = [ap.x, ap.y], dir = ap.o === "h" ? [1, 0] : [0, 1], B = [A[0] + dir[0] * w, A[1] + dir[1] * w], out = [];
  let zv = z0 + Wt;                                   // fin dove arriva il vetro (sotto la tapparella)
  if (ap.cover && st.pos != null) { const giu = (1 - st.pos / 100) * (Wt - Ws); if (giu > .01) { zv = z0 + Wt - giu; out.push(quad(A, B, zv, z0 + Wt, { c: [126, 122, 116], a: 1, righe: Math.max(2, Math.round(giu / .05)) })); } }
  if (zv > z0 + Ws + .01) {
    const vetro = luce ? [255, 212, 140] : [150, 196, 226], av = luce ? .82 : .38;
    if (st.aperta) {
      const dopo = fl.O.get(ap.x + "," + ap.y), n = (dopo && !fl.est.get(dopo)) ? (ap.o === "h" ? [0, 1] : [1, 0]) : (ap.o === "h" ? [0, -1] : [-1, 0]), ang = 58 * Math.PI / 180;
      const sash = (h0, verso) => { const d = [dir[0] * verso * Math.cos(ang) + n[0] * Math.sin(ang), dir[1] * verso * Math.cos(ang) + n[1] * Math.sin(ang)], L = w / 2;
        out.push(quad(h0, [h0[0] + d[0] * L, h0[1] + d[1] * L], z0 + Ws, zv, { c: vetro, a: av, st: ARANCIO, lw: 2, nolum: true })); };
      sash(A, 1); sash(B, -1);
      out.push(quad(A, B, z0 + Ws, zv, { c: ARANCIO, a: 0, st: ARANCIO, lw: 2 }));
    } else out.push(quad(A, B, z0 + Ws, zv, { c: vetro, a: av, st: evid ? ARANCIO : [255, 255, 255], lw: evid ? 2 : 1, nolum: true }));
  }
  return out;
}
/** il lato della stanza più vicino a un punto: [nx, ny] verso il muro e la distanza */
function muroVicino(fl, x, y) {
  const a = fl.O.get(Math.floor(x) + "," + Math.floor(y)); let best = [0, -1], bd = 9;
  for (const [nx, ny] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { let d = 0; while (d < 4 && fl.O.get(Math.floor(x + nx * (d + .02)) + "," + Math.floor(y + ny * (d + .02))) === a) d += .05; if (d < bd) { bd = d; best = [nx, ny]; } }
  return { n: best, d: bd };
}
function corpo(fl, k, g, z0, aperto) {
  const t0 = g.o.tipo, H = fl.H, R = [g.a], tin = tinta(fl, g.x, g.y, z0 + .4, R);
  if (t0 === "tv" || t0 === "clima") {
    const { n, d } = muroVicino(fl, g.x, g.y), wx = g.x + n[0] * d, wy = g.y + n[1] * d;   // contro il muro più vicino
    const lw = t0 === "tv" ? .52 : .46, sp = t0 === "tv" ? .035 : .1, h = t0 === "tv" ? .3 : .13, z = t0 === "tv" ? z0 + Math.min(.32, H * .3) : z0 + H * .8 - .13;
    const px = -n[1], py = n[0], c0 = [wx - px * lw / 2 - n[0] * (sp + .02), wy - py * lw / 2 - n[1] * (sp + .02)], c1 = [wx + px * lw / 2 - n[0] * .02, wy + py * lw / 2 - n[1] * .02];
    const on = t0 === "tv" ? ok(k) && !["off", "standby", "idle", "unavailable"].includes(S[k]?.state) : false;
    const F = scatola(Math.min(c0[0], c1[0]), Math.min(c0[1], c1[1]), Math.max(c0[0], c1[0]), Math.max(c0[1], c1[1]), z, h, t0 === "tv" ? [30, 32, 38] : [238, 238, 236], 1, t0 === "tv" ? null : tin);
    if (t0 === "tv") {   // lo schermo, dal lato della stanza
      const f0 = [wx - px * lw * .46 - n[0] * (sp + .022), wy - py * lw * .46 - n[1] * (sp + .022)], f1 = [wx + px * lw * .46 - n[0] * (sp + .022), wy + py * lw * .46 - n[1] * (sp + .022)];
      F.push(quad(f0, f1, z + .02, z + h - .02, { c: on ? [176, 214, 255] : [14, 15, 18], a: 1, nolum: on, glow: on }));
    }
    return F;
  }
  if (t0 === "elettro") return scatola(g.x - .17, g.y - .17, g.x + .17, g.y + .17, z0, .4, g.o.on ? [232, 246, 236] : [236, 236, 234], 1, tin);
  if (t0 === "cassa") return scatola(g.x - .05, g.y - .05, g.x + .05, g.y + .05, z0, .2, [58, 60, 66], 1, tin);
  if (t0 === "robot") {
    const p = robotDove(k, fl, g); if (!p) return [];
    const r = .15, N = 8, top = z0 + .055, pts = Array.from({ length: N }, (_, i) => [p.x + r * Math.cos(i / N * 2 * Math.PI), p.y + r * Math.sin(i / N * 2 * Math.PI)]);
    const F = pts.map((q, i) => quad(q, pts[(i + 1) % N], z0, top, { c: [64, 66, 72], a: 1 }));
    F.push({ p: pts.map(q => [q[0], q[1], top]), c: [92, 96, 104], a: 1 }, { p: pts.map(q => [p.x + (q[0] - p.x) * .35, p.y + (q[1] - p.y) * .35, top + .004]), c: S[k]?.state === "cleaning" ? [48, 209, 88] : [180, 184, 190], a: 1, nolum: true });
    return F;
  }
  return [];
}

/* ---------- robot: nella stanza dove sta pulendo, se Home Assistant lo dice; altrimenti alla sua base ---------- */
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function stanzaRobot(k) {
  const dev = REG[k]?.device, nomi = [attr(k, "current_room"), attr(k, "room"), attr(k, "current_segment")?.name ?? attr(k, "current_segment"), attr(k, "segment_name"),
    ...(dev ? Object.keys(S).filter(x => x.startsWith("sensor.") && REG[x]?.device === dev && /current_room|current_segment|_room$/.test(x)).map(x => S[x].state) : [])].map(norm).filter(n => n && !["unknown", "unavailable", "none"].includes(n));
  if (!nomi.length) return null;
  for (const fl of M.floors) for (const a of fl.stanze) { const n = norm(nomeStanza(a, fl.f)); if (nomi.some(x => x === n || (x.length > 3 && (n.includes(x) || x.includes(n))))) return { fl, a }; }
  return null;
}
let tRobot = 0;
function robotDove(k, fl, g) {
  const pulisce = S[k]?.state === "cleaning", st = pulisce ? stanzaRobot(k) : null;
  if (!st) return fl === M.floors.find(x => x.ogg.get(k) === g) ? { x: g.x, y: g.y } : null;
  if (st.fl !== fl) return null;
  const P = st.fl.pos[st.a], cx = P.x + P.w / 2, cy = P.y + P.h / 2, mov = !fermo() && !leggera();
  return { x: cx + (mov ? Math.sin(tRobot * .7) * (P.w / 2 - .3) : 0), y: cy + (mov ? Math.sin(tRobot * 1.13 + 1) * (P.h / 2 - .3) : 0) };
}
const robotInGiro = () => M?.floors.some(fl => [...fl.ogg.keys()].some(k => k.startsWith("vacuum.") && S[k]?.state === "cleaning"));

/* ================= tetto ================= */
function facceTetto(fl, zb) {
  const C = [...fl.O.entries()].filter(([, a]) => !fl.est.get(a)).map(([k]) => k.split(",").map(Number));
  if (!C.length) return { piano: true, F: [] };
  const x0 = Math.min(...C.map(c => c[0])), y0 = Math.min(...C.map(c => c[1])), x1 = Math.max(...C.map(c => c[0])) + 1, y1 = Math.max(...C.map(c => c[1])) + 1;
  /* le falde coprono il rettangolo intorno alle stanze al chiuso: se la casa non è (quasi) un rettangolo, o nel rettangolo
     c'è un giardino o una terrazza, coprirebbero il vuoto o il prato. Allora il tetto resta piano (terrazza). */
  const fuori = [...fl.O.entries()].some(([k, a]) => fl.est.get(a) && (([x, y]) => x >= x0 && x < x1 && y >= y0 && y < y1)(k.split(",").map(Number)));
  if (tetto() === "piano" || fuori || C.length / ((x1 - x0) * (y1 - y0)) < .9) return { piano: true, F: [] };
  const o = .22, X0 = x0 - o, X1 = x1 + o, Y0 = y0 - o, Y1 = y1 + o, w = X1 - X0, d = Y1 - Y0, lungo = w >= d;
  /* lavoro con l'asse lungo come x e poi scambio se serve */
  const sw = (p) => lungo ? p : [p[1], p[0], p[2]];
  const a0 = lungo ? X0 : Y0, a1 = lungo ? X1 : Y1, b0 = lungo ? Y0 : X0, b1 = lungo ? Y1 : X1, la = a1 - a0, lb = b1 - b0, bm = (b0 + b1) / 2;
  const rise = lb / 2 * .42, zr = zb + rise, F = [], T = { c: TEGOLE, a: 1, teg: true };
  if (tetto() === "quattro") {
    const hd = Math.min(lb / 2, la / 2), r0 = a0 + hd, r1 = a1 - hd;
    F.push({ ...T, p: [[a0, b0, zb], [a1, b0, zb], [r1, bm, zr], [r0, bm, zr]].map(sw) }, { ...T, p: [[a1, b1, zb], [a0, b1, zb], [r0, bm, zr], [r1, bm, zr]].map(sw) },
      { ...T, p: [[a0, b1, zb], [a0, b0, zb], [r0, bm, zr]].map(sw) }, { ...T, p: [[a1, b0, zb], [a1, b1, zb], [r1, bm, zr]].map(sw) });
  } else {
    F.push({ ...T, p: [[a0, b0, zb], [a1, b0, zb], [a1, bm, zr], [a0, bm, zr]].map(sw) }, { ...T, p: [[a1, b1, zb], [a0, b1, zb], [a0, bm, zr], [a1, bm, zr]].map(sw) });
    /* i timpani, sul filo dei muri */
    const g0 = lungo ? x0 : y0, g1 = lungo ? x1 : y1, c0 = lungo ? y0 : x0, c1 = lungo ? y1 : x1, zE = zb + rise * (o / (lb / 2));
    for (const g of [g0, g1]) F.push({ c: MURO, a: 1, gab: true, p: [[g, c0, zb], [g, c1, zb], [g, c1, zE], [g, bm, zr], [g, c0, zE]].map(sw) });
  }
  /* il tetto è un solido convesso: disegno solo le facce rivolte verso chi guarda (niente sovrapposizioni sbagliate) */
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = zb + rise / 3;
  return { piano: false, F: F.filter(f => { const [a, b, c] = f.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = f.p.reduce((s, q) => [s[0] + q[0] / f.p.length, s[1] + q[1] / f.p.length, s[2] + q[2] / f.p.length], [0, 0, 0]);
    if (n[0] * (m[0] - cx) + n[1] * (m[1] - cy) + n[2] * (m[2] - cz) < 0) n = n.map(x => -x);
    return n[0] * V.cam[0] + n[1] * V.cam[1] + n[2] * V.cam[2] > 0; }) };
}

/* ================= disegno ================= */
function riempi(f, alpha) {
  const P = f.p.map(q => proj(q[0], q[1], q[2]));
  let col = f.c;
  if (!f.nolum) {
    const [a, b, c] = f.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    if (n[0] * V.cam[0] + n[1] * V.cam[1] + n[2] * V.cam[2] < 0) n = n.map(x => -x);
    const k = .6 + .4 * Math.max(0, n[0] * SOLE[0] + n[1] * SOLE[1] + n[2] * SOLE[2]);
    col = col.map(x => x * k);
  }
  if (f.tin) col = col.map((x, i) => x + f.tin[i]);
  col = col.map(x => Math.min(255, x));
  ctx.beginPath(); P.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
  if (f.a > 0) { ctx.fillStyle = rgba(col, f.a * alpha); ctx.fill(); }
  if (f.glow && !leggera()) { ctx.save(); ctx.shadowColor = "rgba(150,200,255,.9)"; ctx.shadowBlur = 14; ctx.fillStyle = rgba(col, alpha); ctx.fill(); ctx.restore(); }
  ctx.strokeStyle = f.st ? rgba(f.st, (f.st === ARANCIO ? .95 : .55) * alpha) : `rgba(0,0,0,${.2 * alpha})`; ctx.lineWidth = f.lw || 1; ctx.stroke();
  if (f.righe) { ctx.strokeStyle = `rgba(0,0,0,${.22 * alpha})`; ctx.lineWidth = 1; for (let i = 1; i < f.righe; i++) { const k = i / f.righe, a = lerp(P[3], P[0], k), b = lerp(P[2], P[1], k); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
  if (f.teg && !leggera()) {   // file di tegole parallele alla gronda
    ctx.strokeStyle = `rgba(90,30,18,${.32 * alpha})`; ctx.lineWidth = 1; const n = 7, tri = P.length === 3;
    for (let i = 1; i < n; i++) { const k = i / n, a = tri ? lerp(P[0], P[2], k) : lerp(P[0], P[3], k), b = tri ? lerp(P[1], P[2], k) : lerp(P[1], P[2], k); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  }
}
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const prof = f => { let s = 0; for (const q of f.p) s += (q[0] - V.cx) * V.s * V.cp + (q[1] - V.cy) * V.c * V.cp + (q[2] - V.cz) * V.sp; return s / f.p.length; };
function lotto(F, alpha) { F.map(f => [prof(f), f]).sort((a, b) => a[0] - b[0]).forEach(([, f]) => riempi(f, alpha)); }
/** pavimenti del piano: colore del pavimento, disegno (assi, piastrelle) e bagliori delle luci accese */
function pavimenti(fl, z0, alpha, aperto) {
  piano(z0);
  for (const a of fl.stanze) {
    const fin = finitura(a, fl.f), dat = datiFinitura(fin), lit = fl.lit.has(a);
    const base = aperto && !lit && !fl.est.get(a) ? dat[3].map(x => x * .8) : dat[3];
    ctx.save(); ctx.beginPath(); pezzi(fl.pos[a]).forEach(r => ctx.rect(r.x, r.y, r.w, r.h)); ctx.clip();
    ctx.fillStyle = rgba(base, alpha); ctx.fillRect(-1, -1, COL + 2, 400);
    const passo = { ceramica: .25, marmo: .33, cotto: .2, terrazza: .33 }[fin], assi = { legno: .14, noce: .14 }[fin];
    if (passo || assi) {
      ctx.strokeStyle = `rgba(0,0,0,${(fin === "marmo" ? .06 : .11) * alpha})`; ctx.lineWidth = 1 / (V.k * DPR) * DPR * 1; ctx.beginPath();
      const P0 = fl.pos[a], R = pezzi(P0), x0 = Math.min(...R.map(r => r.x)), y0 = Math.min(...R.map(r => r.y)), x1 = Math.max(...R.map(r => r.x + r.w)), y1 = Math.max(...R.map(r => r.y + r.h));
      for (let y = y0; y <= y1; y += passo || assi) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      if (passo) for (let x = x0; x <= x1; x += passo) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      ctx.stroke();
    }
    /* segnali come nel 2D: finestre aperte (arancio), pericolo (rosso) */
    if (fl.segni?.[a]) { ctx.fillStyle = fl.segni[a] === "dang" ? `rgba(255,69,58,${.35 * alpha})` : `rgba(255,159,10,${.2 * alpha})`; ctx.fillRect(-1, -1, COL + 2, 400); }
    ctx.restore();
  }
  /* bagliori: la luce vera sul pavimento della sua stanza, col suo colore e la sua luminosità */
  if (!leggera() && alpha > .5) for (const l of fl.luci) {
    ctx.save(); ctx.beginPath(); pezzi(fl.pos[l.a]).forEach(r => ctx.rect(r.x, r.y, r.w, r.h)); ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const R = .9 + 1.4 * l.b, g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, R);
    g.addColorStop(0, rgba(l.rgb, .55 * l.b * alpha)); g.addColorStop(.45, rgba(l.rgb, .22 * l.b * alpha)); g.addColorStop(1, rgba(l.rgb, 0));
    ctx.fillStyle = g; ctx.fillRect(l.x - R, l.y - R, R * 2, R * 2); ctx.restore();
  }
  if (leggera()) for (const l of fl.luci) { ctx.save(); ctx.beginPath(); pezzi(fl.pos[l.a]).forEach(r => ctx.rect(r.x, r.y, r.w, r.h)); ctx.fillStyle = rgba(l.rgb, .16 * alpha); ctx.fill(); ctx.restore(); }
  schermo();
}
/** il «coperchio» di un piano (dove sopra non c'è un altro piano al chiuso) e il parapetto intorno */
function coperchio(fl, z, sopra, alpha) {
  const C = [...fl.O.entries()].filter(([k, a]) => !fl.est.get(a) && !(sopra && sopra.has(k))).map(([k]) => k);
  if (!C.length) return [];
  piano(z); ctx.fillStyle = rgba(CAP, alpha); ctx.beginPath();
  for (const k of C) { const [x, y] = k.split(",").map(Number); ctx.rect(x - .005, y - .005, 1.01, 1.01); }
  ctx.fill(); schermo();
  const set = new Set(C), F = [];
  for (const k of C) { const [x, y] = k.split(",").map(Number);
    if (!set.has(x + "," + (y - 1))) F.push(quad([x, y], [x + 1, y], z, z + .07, { c: MURO, a: 1 }));
    if (!set.has(x + "," + (y + 1))) F.push(quad([x, y + 1], [x + 1, y + 1], z, z + .07, { c: MURO, a: 1 }));
    if (!set.has((x - 1) + "," + y)) F.push(quad([x, y], [x, y + 1], z, z + .07, { c: MURO, a: 1 }));
    if (!set.has((x + 1) + "," + y)) F.push(quad([x + 1, y], [x + 1, y + 1], z, z + .07, { c: MURO, a: 1 })); }
  return F;
}
const celleDentro = fl => new Set([...fl.O.entries()].filter(([, a]) => !fl.est.get(a)).map(([k]) => k));
let PIN = new Map();   // dove disegnare nomi e dispositivi: chiave → [x, y, visibile]
function disegna() {
  if (!ctx || !M) return;
  schermo(); ctx.clearRect(0, 0, W, Hc);
  if (!M.floors.length) return;
  vista(); PIN = new Map();
  const N = M.floors.length, c = taglio(), lift = e => cl(e - c, 0, 1), ombra = !leggera();
  /* ombra morbida sotto la casa */
  if (ombra) { const bb = M.bb, cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, r = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + .8;
    piano(-SOL); const g = ctx.createRadialGradient(cx, cy, r * .3, cx, cy, r); const sc = document.body.classList.contains("light");
    g.addColorStop(0, `rgba(0,0,0,${sc ? .16 : .38})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); schermo(); }
  const sopraDi = M.floors.map((fl, e) => e + 1 < N ? celleDentro(M.floors[e + 1]) : null);
  const tt = facceTetto(M.floors[N - 1], 0);
  M.floors.forEach((fl, e) => {
    const L = lift(e), su = L * (1.2 + fl.H), z0 = fl.z0 + su, alpha = 1 - .88 * L;
    const cutF = cl(e + 1 - c, 0, 1) * (L === 0 ? 1 : 0), aperto = cutF > .5;
    if (L >= .98) {   // piano sollevato del tutto: resta solo il contorno, trasparente
      const ch = document.body.classList.contains("light") ? "0,0,0" : "255,255,255";
      piano(z0); ctx.strokeStyle = `rgba(${ch},.3)`; ctx.fillStyle = `rgba(${ch},.05)`; ctx.lineWidth = 1.5 / (V.k);
      for (const a of fl.stanze) { ctx.beginPath(); pezzi(fl.pos[a]).forEach(r => ctx.rect(r.x, r.y, r.w, r.h)); ctx.fill(); ctx.stroke(); }
      schermo(); return;
    }
    pavimenti(fl, z0, alpha, aperto);
    lotto(faccePiano(fl, z0, aperto, cutF), alpha);
    /* coperchio: si apre mentre si guarda dentro questo piano */
    const capA = alpha * (1 - cutF);
    if (capA > .02) {
      const tettoSopra = e === N - 1 && !tt.piano;
      if (!tettoSopra) lotto(coperchio(fl, z0 + fl.H, sopraDi[e], capA), capA);   // sotto le falde il coperchio non serve
    }
    /* nomi delle stanze e dispositivi: solo del piano aperto */
    const vis = aperto && L === 0;
    for (const a of fl.stanze) { const P = fl.pos[a], q = proj(P.x + P.w / 2, P.y + P.h / 2, z0 + .05); PIN.set("room:" + a, [q[0], q[1], vis]); }
    for (const [k, g] of fl.ogg) {
      const zz = g.o.tipo === "luce" ? fl.H * .72 : g.o.tipo === "clima" ? fl.H * .78 : g.o.tipo === "tv" ? .45 : .32;
      const rp = g.o.tipo === "robot" ? robotDove(k, fl, g) : null, q = proj(rp ? rp.x : g.x, rp ? rp.y : g.y, z0 + zz);
      PIN.set(k, [q[0], q[1], vis && (g.o.tipo !== "robot" || !!rp)]);
    }
  });
  /* tetto */
  const Lr = lift(N), top = M.floors[N - 1];
  if (!tt.piano && Lr < .98) { const zb = top.z0 + top.H + Lr * (1.6 + top.H), F = facceTetto(top, zb).F, a = 1 - .9 * Lr;
    lotto(F.filter(f => f.gab), a); lotto(F.filter(f => !f.gab), a); }   // prima i timpani, sopra le falde che sporgono
  posizionaPin();
}
function posizionaPin() {
  const o = document.getElementById("m3o"); if (!o) return;
  const ps = cl(V.k / 78, .58, 1.12);   // pallini grandi quanto la casa: piccoli sul telefono, più grandi avvicinando
  o.style.setProperty("--ps", ps.toFixed(2));
  for (const el of o.children) {
    const p = PIN.get(el.dataset.k);
    if (!p || !p[2]) { el.style.display = "none"; continue; }
    el.style.display = ""; el.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) translate(-50%,-50%)`;
  }
}

/* ================= pagina ================= */
let rafD = 0;
const ridisegna = () => { if (rafD) return; rafD = requestAnimationFrame(() => { rafD = 0; disegna(); }); };
/** l'HTML della vista 3D (il canvas resta lo stesso tra un disegno e l'altro: data-keep) */
export function vista3d() {
  M = costruisci();
  if (!M.floors.length) return `<div class="empty">${t("Non c'è ancora nessuna stanza da mostrare.", "There are no rooms to show yet.")}</div>`;
  const N = M.floors.length, c = taglio();
  /* segni come nel 2D: finestre aperte, pericoli */
  for (const fl of M.floors) { fl.segni = {};
    for (const a of fl.stanze) { if (!AREAS[a]) continue;
      const dang = inArea(a, "binary_sensor", id => ["smoke", "gas", "moisture", "carbon_monoxide"].includes(deviceClass(id)) && isOn(id) && !(LAYOUT.sicurezza?.noPericoli || []).includes(id)).length;
      const open = LAYOUT.mapShow?.open !== false && inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && isOn(id)).length;
      if (dang) fl.segni[a] = "dang"; else if (open) fl.segni[a] = "open"; } }
  const nomi = M.floors.flatMap(fl => fl.stanze.map(a => { const T = AREAS[a] && LAYOUT.mapShow?.temp !== false ? roomTemp(a) : null, L = AREAS[a] ? lightsOn(a).length : 0;
    const dentro = `<b>${esc(nomeStanza(a, fl.f))}</b>${T != null || L ? `<small>${T != null ? fnum(T) + "°" : ""}${L ? (T != null ? " · " : "") + "💡" + L : ""}</small>` : ""}`;
    return `<div class="m3l" data-k="room:${esc(a)}">${AREAS[a] ? `<button data-act="room" data-id="${esc(a)}">${dentro}</button>` : `<span>${dentro}</span>`}</div>`; })).join("");
  const pin = M.floors.flatMap(fl => [...fl.ogg.values()].map(g => `<div class="m3d" data-k="${esc(g.o.k)}" data-lp="${esc(g.o.id || g.o.k)}">${g.o.chip()}</div>`)).join("");
  const B = (act, v, ic, tit) => `<button class="m3b" data-act="${act}" data-v="${v}" title="${tit}" aria-label="${tit}">${ic}</button>`;
  return `<div class="m3c" id="m3c" tabindex="0" role="application" aria-label="${t("La casa in 3D: trascina per ruotare, due dita o rotella per lo zoom", "The house in 3D: drag to rotate, two fingers or wheel to zoom")}">
    <div class="m3k" data-keep><canvas id="m3cv"></canvas></div>
    <div class="m3o" id="m3o">${nomi}${pin}</div>
    <label class="m3ap" title="${t("Apri la casa", "Open the house")}"><span>🏠</span><input id="m3ap" type="range" min="0" max="${N}" step="0.01" value="${c}" aria-label="${t("Apri la casa: dal tetto al piano più basso", "Open the house: from the roof to the lowest floor")}"><span>▁</span></label>
  </div>
  <div class="m3ctl">${B("m3Rot", "-45", "⟲", t("Ruota a sinistra", "Rotate left"))}${B("m3Rot", "45", "⟳", t("Ruota a destra", "Rotate right"))}${B("m3Tilt", "12", "⤒", t("Guarda più dall'alto", "Look more from above"))}${B("m3Tilt", "-12", "⤓", t("Guarda più di lato", "Look more from the side"))}${B("m3Zoom", "1.25", "＋", t("Avvicina", "Zoom in"))}${B("m3Zoom", "0.8", "−", t("Allontana", "Zoom out"))}
    <button class="m3b wide" data-act="m3Home">⌂ ${t("Vista iniziale", "Initial view")}</button><button class="m3b wide ${muriBassi() ? "on" : ""}" data-act="m3Muri" title="${t("Quando guardi dentro un piano, i muri davanti si abbassano", "When you look inside a floor, the front walls go down")}">🧱 ${t("Muri bassi", "Low walls")}</button></div>
  <p class="small muted" style="margin-top:8px">${t("Trascina per ruotare, due dita o rotella per avvicinare, due dita (o il tasto destro) per spostare. Scegli un piano, o scorri 🏠, per sollevare il tetto e guardare dentro; tocca un dispositivo per comandarlo, tienilo premuto per i dettagli.", "Drag to rotate, two fingers or the wheel to zoom, two fingers (or right button) to pan. Pick a floor, or slide 🏠, to lift the roof and look inside; tap a device to control it, press and hold for details.")}</p>`;
}
/** i pulsanti dei piani nella vista 3D: la casa chiusa e ogni piano (si apre quello) */
export function segPiani3d() {
  const P = piani().filter(p => p.stanze.length), N = P.length, c = CUT == null ? N : Math.max(0, Math.min(N, CUT)), cur = Math.round(c);
  return `<div class="seg"><button class="${cur >= N ? "act" : ""}" data-act="m3Cut" data-v="${N}">🏠 ${t("Col tetto", "With roof")}</button>${P.map((p, e) => `<button class="${cur === e ? "act" : ""}" data-act="m3Cut" data-v="${e}" data-f="${esc(p.f)}">${p.f === "_" ? "🔍 " + t("Dentro", "Inside") : esc(p.nome)}</button>`).join("")}</div>`;
}
/* ---------- montaggio dopo ogni disegno della pagina ---------- */
let RO = null, montato = null, rafR = 0;
export function monta3d() {
  const box = document.getElementById("m3c"), c = document.getElementById("m3cv");
  if (!box || !c) { montato = null; return; }
  if (montato !== c) {
    montato = c; cv = c; ctx = c.getContext("2d");
    RO?.disconnect(); RO = new ResizeObserver(() => { dimensiona(); disegna(); }); RO.observe(box);
  }
  dimensiona(); disegna();
  if (robotInGiro() && !fermo() && !leggera() && !rafR) giraRobot();
}
function dimensiona() {
  const box = document.getElementById("m3c"); if (!box || !cv) return;
  DPR = leggera() ? 1 : Math.min(2, window.devicePixelRatio || 1); W = box.clientWidth; Hc = box.clientHeight;
  const w = Math.round(W * DPR), h = Math.round(Hc * DPR);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cv.style.width = W + "px"; cv.style.height = Hc + "px"; }
}
function giraRobot() {
  let ultimo = 0;
  const passo = ts => {
    if (!document.getElementById("m3cv") || !robotInGiro() || fermo() || leggera() || document.hidden) { rafR = 0; return; }
    if (ts - ultimo > 66) { ultimo = ts; tRobot = ts / 1000; disegna(); }
    rafR = requestAnimationFrame(passo);
  };
  rafR = requestAnimationFrame(passo);
}

/* ---------- animazioni dolci (niente con «Riduci movimento») ---------- */
let anim = null;
function vaiA(dest, ms = 450) {
  const da = { ...CAM, cut: taglio() }, a = { ...da, ...dest };
  cancelAnimationFrame(anim?.raf);
  const fine = () => { Object.assign(CAM, Object.fromEntries(Object.entries(a).filter(([k]) => k in CAM0))); if ("cut" in dest) { CUT = a.cut; sSet("map3cut", CUT); } salvaCam(); disegna(); aggiornaSeg(); };
  if (fermo()) return fine();
  const t0 = performance.now();
  const passo = now => { const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    for (const key of Object.keys(CAM0)) CAM[key] = da[key] + (a[key] - da[key]) * e;
    if ("cut" in dest) CUT = da.cut + (a.cut - da.cut) * e;
    const r = document.getElementById("m3ap"); if (r && "cut" in dest) r.value = CUT;
    disegna(); if (k < 1) anim.raf = requestAnimationFrame(passo); else fine(); };
  anim = { raf: requestAnimationFrame(passo) };
}
function aggiornaSeg() { const N = nPiani(), cur = Math.round(taglio()); document.querySelectorAll('[data-act="m3Cut"]').forEach(b => b.classList.toggle("act", +b.dataset.v === (cur >= N ? N : cur))); }
/** dalla Modifica: «🏠 Guarda la tua casa in 3D» (la casa chiusa, che gira un poco per farsi vedere) */
export function guardaCasa() {
  CUT = null; sSet("map3cut", ""); const fine = { ...CAM0, yaw: CAM.yaw };
  if (!fermo()) { Object.assign(CAM, { ...fine, yaw: CAM.yaw - 70, el: 30 }); requestAnimationFrame(() => vaiA({ ...fine }, 1100)); }
  else Object.assign(CAM, fine);
  salvaCam();
}
Object.assign(ACT, {
  m3Rot: el => vaiA({ yaw: CAM.yaw + +el.dataset.v }),
  m3Tilt: el => vaiA({ el: cl(CAM.el + +el.dataset.v, 14, 89) }),
  m3Zoom: el => vaiA({ zoom: cl(CAM.zoom * +el.dataset.v, .4, 5) }, 250),
  m3Home: () => vaiA({ ...CAM0, yaw: CAM0.yaw + Math.round((CAM.yaw - CAM0.yaw) / 360) * 360 }),
  m3Cut: el => { if (el.dataset.f) sSet("mapFloor", el.dataset.f); vaiA({ cut: +el.dataset.v }, 650); },
  m3Muri: () => { sSet("map3muri", muriBassi() ? "0" : "1"); render(true); },
});
document.addEventListener("input", e => { if (e.target.id !== "m3ap") return; CUT = +e.target.value; disegna(); });
document.addEventListener("change", e => { if (e.target.id !== "m3ap") return; const N = nPiani(), v = +e.target.value, r = Math.abs(v - Math.round(v)) < .2 ? Math.round(v) : v;
  if (r !== v) vaiA({ cut: r }, 200); else { CUT = v; sSet("map3cut", v); aggiornaSeg(); }
  const fl = M?.floors[Math.min(N - 1, Math.floor(r))]; if (fl && r < N) sSet("mapFloor", fl.f); });

/* ---------- gesti: un dito ruota, due dita zoom e spostamento, rotella zoom, tasto destro sposta, frecce ---------- */
const DITA = new Map(); let gesto = null, mangiaG = 0;
/* il gesto parte anche sopra un dispositivo o un nome (così due dita sopra un pallino fanno comunque lo zoom);
   finché le dita non si muovono, il tocco resta un tocco sul dispositivo */
const nuovoGesto = (pan = false) => { gesto = { cam: { ...CAM }, pan, dita: [...DITA.values()].map(p => ({ ...p })), attivo: gesto?.attivo || false }; };
document.addEventListener("pointerdown", e => {
  const box = e.target.closest?.("#m3c"); if (!box || e.target.closest("input,label,.m3ap")) return;
  DITA.set(e.pointerId, { x: e.clientX, y: e.clientY }); nuovoGesto(e.button === 2 || e.shiftKey || e.ctrlKey);
  if (DITA.size > 1) attiva(box);
  if (e.button === 2) e.preventDefault();
});
function attiva(box) { if (gesto.attivo) return; gesto.attivo = true; for (const id of DITA.keys()) try { box.setPointerCapture(id); } catch {} }
document.addEventListener("pointermove", e => {
  if (!DITA.has(e.pointerId) || !gesto) return;
  DITA.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const D = [...DITA.values()], D0 = gesto.dita;
  if (!gesto.attivo) { if (Math.hypot(D[0].x - D0[0].x, D[0].y - D0[0].y) < 6) return; const box = document.getElementById("m3c"); if (box) attiva(box); }
  if (D.length >= 2 && D0.length >= 2) {
    const d0 = Math.hypot(D0[0].x - D0[1].x, D0[0].y - D0[1].y) || 1, d1 = Math.hypot(D[0].x - D[1].x, D[0].y - D[1].y);
    CAM.zoom = cl(gesto.cam.zoom * d1 / d0, .4, 5);
    CAM.px = gesto.cam.px + ((D[0].x + D[1].x) - (D0[0].x + D0[1].x)) / 2; CAM.py = gesto.cam.py + ((D[0].y + D[1].y) - (D0[0].y + D0[1].y)) / 2;
  } else if (D0.length === 1) {
    const dx = D[0].x - D0[0].x, dy = D[0].y - D0[0].y;
    if (gesto.pan) { CAM.px = gesto.cam.px + dx; CAM.py = gesto.cam.py + dy; }
    else { CAM.yaw = gesto.cam.yaw + dx * .4; CAM.el = cl(gesto.cam.el + dy * .3, 14, 89); }
  }
  ridisegna();
});
const finisci = e => { if (!DITA.delete(e.pointerId)) return; const era = gesto?.attivo;
  if (!DITA.size) { gesto = null; if (era) { mangiaG = Date.now(); salvaCam(); } return; }
  nuovoGesto(); };
document.addEventListener("pointerup", finisci); document.addEventListener("pointercancel", finisci);
window.addEventListener("click", e => { if (Date.now() - mangiaG < 350 && e.target.closest?.("#m3c")) { mangiaG = 0; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("contextmenu", e => { if (e.target.closest?.("#m3c") && !e.target.closest(".m3d")) e.preventDefault(); });
document.addEventListener("wheel", e => { if (!e.target.closest?.("#m3c")) return; e.preventDefault(); CAM.zoom = cl(CAM.zoom * Math.exp(-e.deltaY * .0015), .4, 5); ridisegna(); clearTimeout(salvaCam._t); salvaCam._t = setTimeout(salvaCam, 400); }, { passive: false });
document.addEventListener("keydown", e => {
  if (!document.activeElement?.closest?.("#m3c") || e.target.tagName === "INPUT") return;
  const k = e.key, m = { ArrowLeft: { yaw: CAM.yaw - 15 }, ArrowRight: { yaw: CAM.yaw + 15 }, ArrowUp: { el: cl(CAM.el + 8, 14, 89) }, ArrowDown: { el: cl(CAM.el - 8, 14, 89) },
    "+": { zoom: cl(CAM.zoom * 1.2, .4, 5) }, "=": { zoom: cl(CAM.zoom * 1.2, .4, 5) }, "-": { zoom: cl(CAM.zoom / 1.2, .4, 5) }, "0": { ...CAM0 },
    PageUp: { cut: Math.min(nPiani(), Math.round(taglio()) + 1) }, PageDown: { cut: Math.max(0, Math.round(taglio()) - 1) } }[k];
  if (!m) return; e.preventDefault(); vaiA(m, 220);
});

/* ---------- pressione lunga su un dispositivo (3D e 2D): i dettagli ---------- */
let lp = null, mangia = 0;
document.addEventListener("pointerdown", e => {
  const el = e.target.closest?.("[data-lp]"); if (!el || UI.edit || (e.pointerType === "mouse" && e.button !== 0)) return;
  const id = el.dataset.lp; clearTimeout(lp?.t);
  lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; mangia = Date.now(); try { navigator.vibrate?.(12); } catch {} dettagli(id); }, 520) };
}, true);
document.addEventListener("pointermove", e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 9) { clearTimeout(lp.t); lp = null; } }, true);
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, () => { if (lp) { clearTimeout(lp.t); lp = null; } }, true);
document.addEventListener("contextmenu", e => { const el = e.target.closest?.("[data-lp]"); if (!el || UI.edit) return; e.preventDefault(); mangia = Date.now(); dettagli(el.dataset.lp); }, true);
window.addEventListener("click", e => { if (Date.now() - mangia < 600 && e.target.closest?.("[data-lp]")) { mangia = 0; e.stopPropagation(); e.preventDefault(); } }, true);
const dettagli = id => id.startsWith("ap:") ? go("elettrodomestici") : moreInfo(id);
/** usata dalla pagina: c'è una casa da mostrare in 3D? */
export const haStanze3d = () => piani().some(p => p.stanze.length);

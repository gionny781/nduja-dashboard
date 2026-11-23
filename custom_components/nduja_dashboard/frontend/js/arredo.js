/* 'Nduja Dashboard — arredo semplice della casa: una piccola libreria di mobili stilizzati, disegnati per 'Nduja.
   Ogni mobile è fatto di parallelepipedi (pezzi): gli stessi pezzi danno la vista dall'alto del 2D (SVG) e il mobile della casa in 3D.
   Misure in caselle (una casella ≈ 1,6 m); il lato «dietro» (schienale, testiera, muro) è in alto (v = 0) quando il mobile non è ruotato.
   Rotazione r = 0…3, a passi di 90° in senso orario: r = 1 → il dietro guarda a destra, 2 → in basso, 3 → a sinistra.
   Si salva in LAYOUT.map[piano].arredo = [{ id, k, x, y, r }] (x, y = angolo in alto a sinistra dell'ingombro, già ruotato). */
import { t } from "./core.js";
import { pezzi, nomeStanza } from "./pianta.js";

const LEGNO = [176, 132, 92], LEGNO2 = [142, 102, 70], BIANCO = [236, 234, 230], GRIGIO = [120, 124, 132], TESSUTO = [92, 118, 150], CUSCINO = [238, 232, 220],
  VERDE = [86, 150, 84], VERDE2 = [62, 124, 70], VASO = [170, 98, 66], VETRO = [170, 210, 230], NERO = [52, 54, 60], LANA = [180, 96, 84];
/** pezzo: [u, v, z, larghezza, profondità, altezza, colore, alfa?] */
const P = (u, v, z, w, d, h, c, a) => [u, v, z, w, d, h, c, a ?? 1];
export const ARREDO = () => ({
  letto: { n: t("Letto", "Bed"), i: "🛏️", w: 1, d: 1.25, muro: true, p: [P(0, 0, 0, 1, .07, .42, LEGNO2), P(.02, .07, 0, .96, 1.16, .17, LEGNO), P(.04, .08, .17, .92, 1.12, .08, BIANCO),
    P(.1, .12, .25, .34, .16, .06, CUSCINO), P(.56, .12, .25, .34, .16, .06, CUSCINO), P(.04, .46, .25, .92, .74, .03, TESSUTO)] },
  divano: { n: t("Divano", "Sofa"), i: "🛋️", w: 1.3, d: .55, muro: true, p: [P(0, 0, 0, 1.3, .16, .48, TESSUTO), P(0, .16, 0, .14, .39, .34, TESSUTO), P(1.16, .16, 0, .14, .39, .34, TESSUTO),
    P(.14, .16, 0, 1.02, .39, .24, [110, 136, 168]), P(.2, .14, .24, .4, .1, .16, CUSCINO), P(.7, .14, .24, .4, .1, .16, CUSCINO)] },
  tavolo: { n: t("Tavolo con sedie", "Table and chairs"), i: "🍽️", w: 1, d: .9, p: [P(.15, .2, .42, .7, .5, .04, LEGNO), P(.17, .22, 0, .05, .05, .42, LEGNO2), P(.78, .22, 0, .05, .05, .42, LEGNO2),
    P(.17, .63, 0, .05, .05, .42, LEGNO2), P(.78, .63, 0, .05, .05, .42, LEGNO2),
    ...[[.22, 0], [.58, 0], [.22, .72], [.58, .72]].flatMap(([u, v]) => [P(u, v + (v ? 0 : .02), .25, .2, .16, .03, LEGNO2), P(u, v ? v + .14 : v, .25, .2, .03, .3, LEGNO2), P(u + .02, v + .03, 0, .16, .1, .25, LEGNO2, .9)])] },
  cucina: { n: t("Cucina", "Kitchen"), i: "🍳", w: 1.5, d: .4, muro: true, p: [P(0, 0, 0, 1.5, .4, .52, BIANCO), P(0, 0, .52, 1.5, .4, .04, [70, 72, 78]), P(.2, .08, .56, .3, .24, .01, NERO),
    P(.86, .07, .5, .34, .26, .07, [200, 204, 210]), P(0, 0, .9, 1.5, .2, .34, BIANCO)] },
  lavabo: { n: t("Lavabo", "Washbasin"), i: "🚰", w: .4, d: .3, muro: true, p: [P(.04, .02, 0, .32, .26, .4, BIANCO), P(0, 0, .4, .4, .3, .06, [244, 244, 246]), P(.17, .02, .46, .06, .06, .08, [190, 194, 200]),
    P(.06, 0, .62, .28, .02, .3, VETRO, .8)] },
  doccia: { n: t("Doccia", "Shower"), i: "🚿", w: .55, d: .55, muro: true, p: [P(0, 0, 0, .55, .55, .04, [236, 238, 240]), P(0, .53, .04, .55, .02, .95, VETRO, .45), P(.53, 0, .04, .02, .55, .95, VETRO, .45),
    P(.24, 0, .82, .08, .1, .03, [190, 194, 200])] },
  wc: { n: t("WC", "Toilet"), i: "🚽", w: .25, d: .4, muro: true, p: [P(0, 0, 0, .25, .1, .45, BIANCO), P(.03, .1, 0, .19, .26, .24, BIANCO), P(.03, .1, .24, .19, .26, .02, [228, 228, 230])] },
  armadio: { n: t("Armadio", "Wardrobe"), i: "🚪", w: 1, d: .4, muro: true, alto: true, p: [P(0, 0, 0, 1, .4, 1.15, LEGNO), P(.495, .4, .1, .01, .005, .95, LEGNO2)] },
  scrivania: { n: t("Scrivania", "Desk"), i: "🖥️", w: .8, d: .55, muro: true, p: [P(0, 0, .44, .8, .35, .03, LEGNO), P(.02, .02, 0, .04, .3, .44, GRIGIO), P(.74, .02, 0, .04, .3, .44, GRIGIO),
    P(.3, .06, .47, .2, .03, .14, NERO), P(.3, .38, .26, .2, .17, .04, NERO), P(.3, .53, .26, .2, .02, .3, NERO), P(.38, .44, 0, .04, .04, .26, GRIGIO)] },
  libreria: { n: t("Libreria", "Bookcase"), i: "📚", w: .6, d: .22, muro: true, alto: true, p: [P(0, 0, 0, .6, .22, 1.05, LEGNO2), P(.04, .2, .08, .52, .02, .22, [180, 80, 70]),
    P(.04, .2, .36, .52, .02, .22, [70, 110, 160]), P(.04, .2, .64, .52, .02, .22, [210, 170, 80])] },
  pianta: { n: t("Pianta", "Plant"), i: "🪴", w: .3, d: .3, p: [P(.08, .08, 0, .14, .14, .16, VASO), P(.03, .03, .16, .24, .24, .22, VERDE), P(.08, .08, .38, .14, .14, .14, VERDE2)] },
  tappeto: { n: t("Tappeto", "Rug"), i: "🟥", w: 1.2, d: .8, piatto: true, p: [P(0, 0, 0, 1.2, .8, .012, LANA), P(.12, .1, .012, .96, .6, .004, [214, 160, 120])] },
});
/** ingombro ruotato */
export const ingombro = (k, r = 0) => { const A = ARREDO()[k]; if (!A) return { w: .5, d: .5 }; return r % 2 ? { w: A.d, d: A.w } : { w: A.w, d: A.d }; };
/** un punto del mobile (u, v) nella pianta, con la rotazione */
export function ruota(u, v, A, r) {
  r = ((r | 0) % 4 + 4) % 4;
  return r === 1 ? [A.d - v, u] : r === 2 ? [A.w - u, A.d - v] : r === 3 ? [v, A.w - u] : [u, v];
}
/** pezzi del mobile nella pianta: [x0, y0, x1, y1, z, h, colore, alfa] */
export function pezziMobile(m) {
  const A = ARREDO()[m.k]; if (!A) return [];
  return A.p.map(([u, v, z, w, d, h, c, al]) => {
    const [ax, ay] = ruota(u, v, A, m.r), [bx, by] = ruota(u + w, v + d, A, m.r);
    return [m.x + Math.min(ax, bx), m.y + Math.min(ay, by), m.x + Math.max(ax, bx), m.y + Math.max(ay, by), z, h, c, al];
  });
}
const rgb = (c, k = 1) => `rgb(${c.map(v => Math.round(Math.min(255, v * k))).join(",")})`;
/** vista dall'alto (SVG) di un mobile, già ruotato: per il 2D */
export function svgMobile(m) {
  const g = ingombro(m.k, m.r), L = pezziMobile({ ...m, x: 0, y: 0 }).sort((a, b) => (a[4] + a[5]) - (b[4] + b[5]));
  return `<svg viewBox="0 0 ${g.w} ${g.d}" preserveAspectRatio="none" aria-hidden="true">${L.map(([x0, y0, x1, y1, z, h, c, al]) =>
    `<rect x="${x0.toFixed(3)}" y="${y0.toFixed(3)}" width="${(x1 - x0).toFixed(3)}" height="${(y1 - y0).toFixed(3)}" fill="${rgb(c, .8 + Math.min(.35, (z + h) * .3))}" ${al < 1 ? `fill-opacity="${al}"` : ""} stroke="rgba(0,0,0,.35)" stroke-width=".012"/>`).join("")}</svg>`;
}

/* ---------- «Arreda per me»: mobili adatti al nome della stanza, messi contro i muri o al centro ---------- */
const PER_STANZA = [
  [/cameretta|bambin|kids/i, ["letto", "armadio", "scrivania", "tappeto"]], [/camera|letto|bedroom|matrimon|ospiti/i, ["letto", "armadio", "tappeto", "pianta"]],
  [/cucina|kitchen|cottura/i, ["cucina", "tavolo"]], [/soggiorno|salotto|living|salone|open.?space/i, ["divano", "tappeto", "libreria", "pianta"]],
  [/pranzo|dining/i, ["tavolo", "pianta"]], [/bagno|bath|wc|toilet/i, ["doccia", "lavabo", "wc"]], [/studio|ufficio|office|lavoro/i, ["scrivania", "libreria", "pianta"]],
  [/lavanderia|laundry/i, ["lavabo"]], [/ingresso|corridoio|hall|entrata|disimpegno/i, ["pianta"]], [/giardin|garden|terrazz|balcon|veranda|portico|patio|cortile|esterno/i, ["pianta", "pianta"]]];
export const proposteStanza = (a, f) => (PER_STANZA.find(([re]) => re.test(nomeStanza(a, f) + " " + a)) || [null, []])[1];
const sovrappone = (r, L) => L.some(q => r.x < q.x + q.w - .02 && q.x < r.x + r.w - .02 && r.y < q.y + q.d - .02 && q.y < r.y + r.d - .02);
/** trova un posto libero per il mobile k nella stanza (celle C, "x,y"), lontano dagli altri (occupati: [{x,y,w,d}]): { x, y, r } o null */
export function postoLibero(k, P0, C, occupati, vieta = { porte: [], finestre: [] }) {
  const A = ARREDO()[k]; if (!A) return null;
  const dentro = (x, y, w, d) => { for (let cx = Math.floor(x + .001); cx < x + w - .001; cx++) for (let cy = Math.floor(y + .001); cy < y + d - .001; cy++) if (!C.has(cx + "," + cy)) return false; return true; };
  const R = pezzi(P0), x0 = Math.min(...R.map(r => r.x)), y0 = Math.min(...R.map(r => r.y)), x1 = Math.max(...R.map(r => r.x + r.w)), y1 = Math.max(...R.map(r => r.y + r.h));
  const cx = P0.x + P0.w / 2, cy = P0.y + P0.h / 2, cand = [];
  for (let r = 0; r < 4; r++) {
    if (!A.muro && r) break;
    const g = ingombro(k, r);
    for (let x = x0; x <= x1 - g.w + .001; x += .25) for (let y = y0; y <= y1 - g.d + .001; y += .25) {
      if (!dentro(x, y, g.w, g.d)) continue;
      if (!A.piatto && sovrappone({ x, y, w: g.w, d: g.d }, occupati)) continue;
      if (!A.piatto && sovrappone({ x, y, w: g.w, d: g.d }, vieta.porte)) continue;                 // davanti alle porte si passa
      if ((A.alto || k === "cucina") && sovrappone({ x, y, w: g.w, d: g.d }, vieta.finestre)) continue;   // niente armadi né pensili davanti alle finestre
      /* contro il muro: il lato «dietro» tocca il bordo della stanza */
      const dietro = r === 0 ? !C.has(Math.floor(x + g.w / 2) + "," + (Math.round(y) - 1)) && Math.abs(y - Math.round(y)) < .01
        : r === 1 ? !C.has(Math.round(x + g.w) + "," + Math.floor(y + g.d / 2)) && Math.abs(x + g.w - Math.round(x + g.w)) < .01
        : r === 2 ? !C.has(Math.floor(x + g.w / 2) + "," + Math.round(y + g.d)) && Math.abs(y + g.d - Math.round(y + g.d)) < .01
        : !C.has((Math.round(x) - 1) + "," + Math.floor(y + g.d / 2)) && Math.abs(x - Math.round(x)) < .01;
      if (A.muro && !dietro) continue;
      const d = Math.hypot(x + g.w / 2 - cx, y + g.d / 2 - cy);
      cand.push({ x, y, r, s: k === "pianta" ? -d : d });   // le piante negli angoli, il resto verso il centro
    }
  }
  cand.sort((p, q) => p.s - q.s);
  return cand[0] ? { x: cand[0].x, y: cand[0].y, r: cand[0].r } : null;
}
/** spazio da lasciare libero davanti a porte e finestre del piano (aperture di pianta.js) */
export function zoneLibere(L) {
  const porte = [], finestre = [];
  for (const ap of L) for (let i = 0; i < Math.max(1, ap.w | 0 || 1); i++) {
    const x = ap.o === "h" ? ap.x + i : ap.x, y = ap.o === "h" ? ap.y : ap.y + i;
    (ap.tipo === "porta" ? porte : finestre).push(ap.o === "h" ? { x, y: y - .5, w: 1, d: 1 } : { x: x - .5, y, w: 1, d: 1 });
  }
  return { porte, finestre };
}
/** celle di una stanza: Set "x,y" */
export const celle = P0 => { const C = new Set(); pezzi(P0).forEach(r => { for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) C.add(x + "," + y); }); return C; };
/** il mobile occupa questo spazio (per non sovrapporne altri) */
export const spazio = m => { const g = ingombro(m.k, m.r); return { x: m.x, y: m.y, w: g.w, d: g.d, piatto: !!ARREDO()[m.k]?.piatto }; };

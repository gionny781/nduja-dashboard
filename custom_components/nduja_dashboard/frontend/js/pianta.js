/* 'Nduja Dashboard — la pianta della casa, in comune tra la Mappa 2D (pages/mappa.js) e la casa in 3D (casa3d.js):
   piani e stanze, muri, porte e finestre, dispositivi con la loro posizione, pavimenti, altezze e tetto.
   Dove si salva (tutta la casa, solo amministratori):
     LAYOUT.map[piano] = { rooms, custom, hide, devs, devMode, img,                       ← come prima (0.7.0)
       aperture: [{ id, o:"h"|"v", x, y, w, tipo:"porta"|"finestra", ent?, cover? }],   ← porte e finestre sui muri
       pos: { entity_id | "ap:<elettrodomestico>": { a, x, y } },                        ← dispositivi spostati a mano
       arredo: [{ id, k, a, x, y, r }] }                                                 ← mobili (arredo.js)
     (x, y di pos e arredo sono misurati dall'angolo in alto a sinistra della stanza a: spostando la stanza, la seguono) 
     LAYOUT.map.casa = { tetto:"due"|"quattro"|"piano", alt:{ piano: moltiplicatore }, pav:{ stanza: pavimento } }
   Le mappe salvate prima non hanno queste chiavi: valgono i valori predefiniti, niente si rompe.
   Coordinate: una casella della griglia è 1 × 1; il muro "h" (x,y) va da (x,y) a (x+1,y), il muro "v" (x,y) da (x,y) a (x,y+1). */
import { S, AREAS, FLOORS, LAYOUT, UI, VISTE, t, esc, nm, isOn, inArea, areasSorted, isLightSwitch, allEnts, areaOf, deviceClass, OPENING, attr, isTV } from "./core.js";
import { luciStanza, iconaPiccola } from "./luce.js";
import { vistaClima, momentoClima } from "./climadisegni.js";
import { elettroStanza } from "./pages/elettrodomestici.js";

export const COL = 12;
/* stanze della mappa: le aree di Home Assistant (anche vuote) più le stanze create solo nella mappa */
export const mp = f => LAYOUT.map?.[f] || {};
export const custom = f => mp(f).custom || [];
const nascostaMappa = (f, a) => (mp(f).hide || []).includes(a);
export const nomeStanza = (a, f) => AREAS[a]?.name || custom(f).find(c => c.id === a)?.name || a;
/** piani in ordine (FLOORS.level), ognuno con le sue stanze visibili e quelle tolte dalla mappa */
export const piani = () => {
  const A = areasSorted();
  const F = [...new Set([...Object.keys(FLOORS), ...A.map(a => AREAS[a].floor || "_"), ...Object.keys(LAYOUT.map || {}).filter(f => custom(f).length)])]
    .filter(f => f === "_" ? A.some(a => !AREAS[a].floor) || custom("_").length : true)
    .sort((x, y) => (FLOORS[x]?.level ?? 99) - (FLOORS[y]?.level ?? 99));
  if (!F.length) F.push("_");
  return F.map(f => {
    const tutte = [...A.filter(a => (AREAS[a].floor || "_") === f), ...custom(f).map(c => c.id)];
    return { f, nome: FLOORS[f]?.name || t("Casa", "Home"), tutte, stanze: tutte.filter(a => !nascostaMappa(f, a)), nascoste: tutte.filter(a => nascostaMappa(f, a)) };
  });
};
const GRANDE = /soggiorno|salotto|salone|living|cucina|kitchen|open.?space|taverna|garage|giardino|garden/i;
/** posizione di ogni stanza: quella salvata, altrimenti una disposizione automatica a righe */
export function posizioni(f, stanze) {
  const M = LAYOUT.map?.[f]?.rooms || {}, out = {};
  let x = 0, y = 0, hRiga = 0;
  for (const a of stanze) {
    if (M[a]) { out[a] = M[a]; continue; }
    const n = nomeStanza(a, f), w = GRANDE.test(n) ? 4 : 3, h = GRANDE.test(n) ? 3 : 2;
    if (x + w > COL) { x = 0; y += hRiga; hRiga = 0; }
    out[a] = { x, y, w, h }; x += w; hRiga = Math.max(hRiga, h);
  }
  /* le stanze salvate non devono finire sotto quelle automatiche: le automatiche partono sotto l'ultima salvata */
  const salvate = stanze.filter(a => M[a]), fondo = Math.max(0, ...salvate.flatMap(a => [M[a], ...(M[a].extra || [])].map(r => r.y + r.h)));
  if (salvate.length && salvate.length < stanze.length) stanze.filter(a => !M[a]).forEach(a => out[a] = { ...out[a], y: out[a].y + fondo });
  return out;
}
/** pezzi di una stanza: il rettangolo principale più quelli aggiunti (per le stanze a L, a T…) */
export const pezzi = p => [{ x: p.x, y: p.y, w: p.w, h: p.h }, ...(p.extra || [])];
/** righe occupate dal piano (almeno 4) */
export const righeDi = pos => Math.max(4, ...Object.values(pos).flatMap(p => pezzi(p).map(r => r.y + r.h)));
/** muri del 2D: il contorno dell'unione delle celle di ogni stanza (così una L ha un solo contorno) */
export function muri(pos, stanze) {
  const seg = [];
  for (const a of stanze) {
    const C = new Set();
    pezzi(pos[a]).forEach(r => { for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) C.add(x + "," + y); });
    for (const c of C) { const [x, y] = c.split(",").map(Number);
      if (!C.has(x + "," + (y - 1))) seg.push(`M${x} ${y}H${x + 1}`);
      if (!C.has(x + "," + (y + 1))) seg.push(`M${x} ${y + 1}H${x + 1}`);
      if (!C.has((x - 1) + "," + y)) seg.push(`M${x} ${y}V${y + 1}`);
      if (!C.has((x + 1) + "," + y)) seg.push(`M${x + 1} ${y}V${y + 1}`); }
  }
  return seg.join("");
}
/** di chi è ogni casella: "x,y" → stanza (se due stanze si sovrappongono vince l'ultima) */
export function proprietari(pos, stanze) {
  const O = new Map();
  for (const a of stanze) for (const r of pezzi(pos[a])) for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) O.set(x + "," + y, a);
  return O;
}
/** tutti i pezzi di muro (lunghi una casella), una volta sola: { o, x, y, a1 (stanza prima: sopra / a sinistra), a2 (dopo: sotto / a destra) } */
export function bordi(pos, stanze, O = proprietari(pos, stanze)) {
  const E = new Map();
  const metti = (o, x, y) => { const k = o + x + "," + y; if (E.has(k)) return;
    E.set(k, o === "h" ? { o, x, y, a1: O.get(x + "," + (y - 1)) || null, a2: O.get(x + "," + y) || null } : { o, x, y, a1: O.get((x - 1) + "," + y) || null, a2: O.get(x + "," + y) || null }); };
  for (const [k, a] of O) { const [x, y] = k.split(",").map(Number);
    if (O.get(x + "," + (y - 1)) !== a) metti("h", x, y);
    if (O.get(x + "," + (y + 1)) !== a) metti("h", x, y + 1);
    if (O.get((x - 1) + "," + y) !== a) metti("v", x, y);
    if (O.get((x + 1) + "," + y) !== a) metti("v", x + 1, y); }
  return [...E.values()];
}
export const chiaveMuro = (o, x, y) => o + x + "," + y;

/* ---------- porte e finestre ---------- */
export const aperture = f => Array.isArray(mp(f).aperture) ? mp(f).aperture.filter(a => a && (a.o === "h" || a.o === "v") && Number.isFinite(a.x) && Number.isFinite(a.y)) : [];
/** i pezzi di muro coperti da un'apertura: [[x,y], …] */
export const unita = ap => Array.from({ length: Math.max(1, Math.min(8, ap.w | 0 || 1)) }, (_, i) => ap.o === "h" ? [ap.x + i, ap.y] : [ap.x, ap.y + i]);
/** pezzo di muro → { ap, i } */
export function mappaAperture(f) { const M = new Map(); for (const ap of aperture(f)) unita(ap).forEach(([x, y], i) => M.set(chiaveMuro(ap.o, x, y), { ap, i })); return M; }
/** posizione di una tapparella o di un garage: 0 chiusa … 100 aperta (null se non si sa) */
export function posCover(id) {
  if (!id || !S[id]) return null;
  const p = attr(id, "current_position"); if (p != null && !isNaN(+p)) return Math.max(0, Math.min(100, +p));
  return { open: 100, opening: 60, closing: 40, closed: 0 }[S[id].state] ?? null;
}
/** stato vero di un'apertura: aperta (sensore, o porta del garage alzata) e posizione della tapparella */
export function statoAp(ap) {
  const sens = ap.ent && S[ap.ent] ? isOn(ap.ent) : null, pos = posCover(ap.cover);
  const aperta = sens != null ? sens : ap.tipo === "porta" && pos != null ? pos > 5 : false;
  return { aperta, sens, pos };
}
/** tutte le entità già usate dalle aperture della casa */
export const usateAperture = () => new Set(Object.keys(LAYOUT.map || {}).flatMap(f => f === "casa" ? [] : aperture(f).flatMap(a => [a.ent, a.cover])).filter(Boolean));

/* ---------- pavimenti, altezze, tetto (LAYOUT.map.casa) ---------- */
export const casaCfg = () => LAYOUT.map?.casa || {};
/** [chiave, icona, nome, colore rgb, all'aperto] */
export const FINITURE = () => [
  ["legno", "🪵", t("Legno chiaro", "Light wood"), [198, 164, 122]], ["noce", "🟫", t("Legno scuro", "Dark wood"), [128, 92, 64]],
  ["cotto", "🧱", t("Cotto", "Terracotta"), [181, 108, 78]], ["ceramica", "⬜", t("Piastrelle", "Tiles"), [208, 210, 212]],
  ["marmo", "🤍", t("Marmo", "Marble"), [232, 228, 220]], ["cemento", "⬛", t("Cemento", "Concrete"), [146, 148, 152]],
  ["moquette", "🟦", t("Moquette", "Carpet"), [96, 112, 146]],
  ["prato", "🌱", t("Prato (all'aperto)", "Lawn (outdoors)"), [104, 156, 86], true], ["terrazza", "☀️", t("Terrazza (all'aperto)", "Terrace (outdoors)"), [190, 172, 150], true]];
export function finituraAuto(a, f) {
  const n = nomeStanza(a, f) + " " + a;
  return /giardin|garden|prato|cortile|yard|esterno|outdoor|outside|orto/i.test(n) ? "prato" : /terrazz|balcon|veranda|portico|patio|terrace|loggia/i.test(n) ? "terrazza"
    : /bagno|bath|wc|toilet|doccia|lavanderia|laundry/i.test(n) ? "ceramica" : /cucina|kitchen|cottura/i.test(n) ? "cotto"
    : /garage|cantina|box|taverna|ripost|cellar|basement|deposito|soffitta|attic/i.test(n) ? "cemento" : /soggiorno|salotto|living|salone|pranzo|dining/i.test(n) ? "noce"
    : /ingresso|corridoio|hall|entrata|disimpegno|scale/i.test(n) ? "marmo" : "legno";
}
export const finitura = (a, f) => { const s = casaCfg().pav?.[a]; return FINITURE().some(x => x[0] === s) ? s : finituraAuto(a, f); };
export const datiFinitura = k => FINITURE().find(x => x[0] === k) || FINITURE()[0];
/** stanza all'aperto (prato, terrazza): niente muri alti né tetto */
export const esterna = (a, f) => !!datiFinitura(finitura(a, f))[4];
/** altezza dei muri di un piano: una casella × 1,25 (valore di partenza), per il moltiplicatore scelto in ✏️ */
export const H0 = 1.25;
export const moltPiano = f => { const v = +casaCfg().alt?.[f]; return Number.isFinite(v) && v > 0 ? Math.max(.6, Math.min(1.6, v)) : 1; };
export const altezzaPiano = f => H0 * moltPiano(f);
export const TETTI = () => [["due", "⌂", t("Due falde", "Gable")], ["quattro", "◇", t("Quattro falde", "Hip")], ["piano", "▭", t("Piano (terrazza)", "Flat")]];
export const tetto = () => TETTI().some(x => x[0] === casaCfg().tetto) ? casaCfg().tetto : "due";

/* ---------- dispositivi nelle stanze: automatici dall'area, più quelli aggiunti, meno quelli tolti ---------- */
const DOM_MAPPA = ["light", "switch", "cover", "fan", "media_player", "lock", "climate", "vacuum", "humidifier", "camera"];
const devsConf = (f, a) => mp(f).devs?.[a] || {};
export function dispositivi(a, f) {
  const c = devsConf(f, a), manuale = mp(f).devMode === "manual";
  /* luci come nella pagina Luci: i gruppi raccolgono le loro luci, gli interruttori scelti come luci contano come luci */
  const auto = manuale || !AREAS[a] ? [] : [...luciStanza(a), ...DOM_MAPPA.filter(d => d !== "light").flatMap(d => inArea(a, d)).filter(id => !isLightSwitch(id))];
  return [...new Set([...auto.filter(id => !(c.hide || []).includes(id)), ...(c.add || []).filter(id => S[id])])];
}
export const eLuce = id => id.startsWith("light.") || isLightSwitch(id);
const ICO_D = (id) => { const d = id.split(".")[0], on = isOn(id) || ["open", "playing", "cleaning", "unlocked", "heat", "cool"].includes(S[id]?.state);
  return { light: "💡", switch: "🔌", cover: on ? "🪟" : "🟫", fan: "🌀", media_player: "📺", lock: on ? "🔓" : "🔒", climate: "❄️", vacuum: "🤖", humidifier: "💧", camera: "📷",
    sensor: "📈", binary_sensor: on ? "🔴" : "⚪", scene: "🎬", script: "▶️", input_boolean: "🔘" }[d] || "•"; };
/* le tapparelle con il loro disegno (pagina Tapparelle), aperte quanto sono aperte */
const tappMini = id => id.startsWith("cover.") ? VISTE.tapMini?.(id) || null : null;
/** il dispositivo come pallino della mappa: il clima con il suo disegno, le luci col loro colore, le tapparelle aperte quanto sono */
export const chipD = (id, a, f) => { const tp = tappMini(id); return `<span class="mpd2 ${id.startsWith("climate.") ? "cl2 m-" + momentoClima(id).k : eLuce(id) ? "lt4 " + (isOn(id) ? "on" : "") : tp ? "tp2" : isOn(id) || ["open", "playing", "cleaning", "unlocked"].includes(S[id]?.state) ? "on" : ""}">
  <button data-act="mpDev" data-id="${id}" title="${esc(nm(id))}" aria-label="${esc(nm(id))}">${id.startsWith("climate.") ? vistaClima(id, "xs") : eLuce(id) ? iconaPiccola(id) : tp || ICO_D(id)}</button>${UI.edit ? `<button class="dx" data-act="mpDevDel" data-id="${id}" data-a="${a}" data-f="${f}" aria-label="${t("Togli", "Remove")}">✕</button>` : ""}</span>`; };
/** che cos'è, per il disegno 3D */
export function tipoOgg(k) {
  if (k.startsWith("ap:")) return "elettro";
  const d = k.split(".")[0];
  if (eLuce(k)) return "luce";
  if (d === "media_player") return isTV(k) ? "tv" : "cassa";
  return { climate: "clima", vacuum: "robot", camera: "telecamera", cover: "tapparella", fan: "ventola", lock: "serratura", humidifier: "umidificatore", sensor: "sensore", binary_sensor: "sensore" }[d] || "altro";
}
const PRIO = ["luce", "clima", "tv", "cassa", "elettro", "robot", "ventola", "umidificatore", "tapparella", "serratura", "telecamera", "sensore", "altro"];
/** dispositivi ed elettrodomestici di una stanza: [{ k, id, tipo, chip() }] (le tapparelle messe su una finestra stanno nella finestra) */
export function oggetti(a, f, usate = usateAperture()) {
  const D = dispositivi(a, f).filter(id => !(id.startsWith("cover.") && usate.has(id))).map(id => ({ k: id, id, tipo: tipoOgg(id), chip: () => chipD(id, a, f) }));
  const E = AREAS[a] ? elettroStanza(a).map(e => ({ k: "ap:" + e.id, id: null, tipo: "elettro", on: e.on, nome: e.nome, chip: () => e.html })) : [];
  return [...D, ...E].sort((x, y) => PRIO.indexOf(x.tipo) - PRIO.indexOf(y.tipo));
}
const valida = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= COL && Math.abs(p.y) <= 400;
/** un punto salvato rispetto all'angolo della sua stanza (così segue la stanza quando la sposti) → coordinate della pianta */
export const assoluto = (p, pos) => pos[p.a] ? { x: pos[p.a].x + p.x, y: pos[p.a].y + p.y } : null;
/** mobili del piano con le coordinate della pianta (quelli di stanze tolte dalla mappa non si vedono) */
export const mobili = (f, pos) => (Array.isArray(mp(f).arredo) ? mp(f).arredo : []).flatMap(m => { const q = m && valida(m) ? assoluto(m, pos) : null; return q ? [{ ...m, x: q.x, y: q.y }] : []; });
/** dove sta ogni dispositivo del piano: quello spostato a mano, altrimenti dal centro della stanza verso i bordi.
    → Map k → { x, y, a, salvato, o } (o = l'oggetto di oggetti()) */
export function posOggetti(f, stanze, pos) {
  const out = new Map(), S0 = mp(f).pos || {}, usate = usateAperture();
  for (const a of stanze) {
    const L = oggetti(a, f, usate); if (!L.length) continue;
    const presi = [];
    L.forEach(o => { const q = valida(S0[o.k]) && S0[o.k].a === a ? assoluto(S0[o.k], pos) : null; if (q) { out.set(o.k, { x: q.x, y: q.y, a, salvato: true, o }); presi.push(q); } });
    const liberi = L.filter(o => !out.has(o.k)); if (!liberi.length) continue;
    const P = pos[a], c = { x: P.x + P.w / 2, y: P.y + P.h / 2 }, cand = [];
    for (const r of pezzi(P)) for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) for (const dx of [.25, .75]) for (const dy of [.25, .75]) cand.push({ x: x + dx, y: y + dy });
    /* il centro esatto per primo (dove di solito sta la luce), poi gli altri punti dal più vicino al centro */
    cand.unshift({ x: c.x, y: c.y });
    cand.sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
    for (const o of liberi) {
      let p = null;
      for (const dmin of [.7, .45, 0]) { p = cand.find(q => presi.every(s => Math.hypot(s.x - q.x, s.y - q.y) >= dmin)); if (p) break; }
      p = p || c; presi.push(p); out.set(o.k, { x: p.x, y: p.y, a, salvato: false, o });
    }
  }
  return out;
}
/** sensori di apertura e tapparelle che si possono collegare a un muro tra le stanze A (i più adatti prima) */
export function propostePer(A, tipo, usate = usateAperture()) {
  const qui = id => A.includes(areaOf(id)) && !usate.has(id);
  const sens = allEnts("binary_sensor", id => OPENING.includes(deviceClass(id))).filter(qui)
    .sort((x, y) => (tipo === "finestra" ? (deviceClass(y) === "window") - (deviceClass(x) === "window") : (deviceClass(y) !== "window") - (deviceClass(x) !== "window")));
  const cov = allEnts("cover").filter(qui).sort((x, y) => {
    const g = id => /garage|gate|door/.test(deviceClass(id) || "") || /garage|basculante|portone|cancell/i.test(id + nm(id));
    return tipo === "porta" ? g(y) - g(x) : g(x) - g(y);
  });
  return { sens, cov };
}

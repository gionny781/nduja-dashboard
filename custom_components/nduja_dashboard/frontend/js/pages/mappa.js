/* Mappa della casa: le stanze di ogni piano disegnate su una griglia, con luci accese, finestre aperte,
   clima, movimento e temperatura. Si costruisce da sola dalle aree; in ✏️ Modifica (amministratori) ci sono quattro strumenti:
   🧱 Stanze (sposti e ridimensioni le stanze, la piantina sotto), 🚪 Porte e finestre (tocchi un muro), 💡 Dispositivi (li trascini
   al loro posto), 🛋️ Arredo (mobili da aggiungere, trascinare e ruotare); «🏠 Tetto e piani» sceglie tetto, altezze e pavimenti.
   In 3D (casa3d.js) la stessa pianta diventa la casa intera. La pianta in comune sta in pianta.js. */
import { S, AREAS, ACT, CHG, LAYOUT, UI, t, esc, fnum, ok, isOn, inArea, areaOf, roomTemp, roomHum, lightsOn, luciContate, luciComando,
  deviceClass, svc, toast, card, empty, page, sGet, sSet, render, isAdmin, openSheet, closeSheet, nm, moreInfo, myHA, manca, linkBtn, comeFare, leggera } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { COL, mp, custom, nomeStanza, piani, posizioni, pezzi, righeDi, muri, proprietari, bordi, chiaveMuro, aperture, unita, mappaAperture, statoAp, usateAperture, propostePer, posCover,
  dispositivi, posOggetti, mobili, casaCfg, FINITURE, finitura, finituraAuto, moltPiano, TETTI, tetto } from "../pianta.js";
import { ARREDO, ingombro, svgMobile, postoLibero, proposteStanza, celle, spazio, zoneLibere } from "../arredo.js";
import { vista3d, segPiani3d, monta3d, guardaCasa, haStanze3d } from "../casa3d.js";
import { chipD as CHIP } from "../pianta.js";
import { elettroStanza as VEL } from "./elettrodomestici.js";
export { nomeStanza, dispositivi } from "../pianta.js";

const comandi = (a, i, f) => `<div class="mpe1" data-f="${f}">
  <button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="x,-1">←</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="y,-1">↑</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="y,1">↓</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="x,1">→</button>
  <button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="w,-1">⇠</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="w,1">⇢</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="h,-1">⇡</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="h,1">⇣</button>
  ${i === 0 ? `<button class="wide" data-act="mpPiece" data-id="${a}">＋ ${t("pezzo (L)", "piece (L)")}</button>
    ${AREAS[a] ? `<button class="wide" data-act="mpHide" data-id="${a}">🙈 ${t("togli dalla mappa", "remove from map")}</button>` : `<button class="wide" data-act="mpCustom" data-id="${a}">✏️ ${t("nome", "name")}</button><button class="wide bad" data-act="mpCustomDel" data-id="${a}">🗑 ${t("elimina stanza", "delete room")}</button>`}`
    : `<button class="wide bad" data-act="mpPieceDel" data-id="${a}" data-i="${i}">✕ ${t("pezzo", "piece")}</button>`}</div>`;

/* ---------- strumenti di ✏️ Modifica ---------- */
const STRUMENTI = () => [["stanze", "🧱", t("Stanze", "Rooms")], ["aperture", "🚪", t("Porte e finestre", "Doors & windows")], ["disp", "💡", t("Dispositivi", "Devices")], ["arredo", "🛋️", t("Arredo", "Furniture")]];
/** strumento scelto (solo amministratori in ✏️ Modifica; ricordato per dispositivo) */
const strumento = () => isAdmin() && UI.edit ? (STRUMENTI().some(s => s[0] === sGet("mapTool")) ? sGet("mapTool") : "stanze") : null;
let SEL = null;        // mobile selezionato (strumento Arredo): ⟳ e 🗑 compaiono in alto, accanto agli strumenti
const selezionato = (f, pos) => SEL ? mobili(f, pos).find(m => m.id === SEL) || null : null;

/* dispositivi nelle stanze: le righe di pallini; quelli messi al loro posto (pos) stanno sopra, nel punto scelto */
const rigaDev = (a, f, spostati, tool) => {
  if (tool === "aperture") return "";
  if (tool === "disp") return `<div class="mpd1"><button class="mpd2 add" data-act="mpDevAdd" data-a="${a}" data-f="${f}" aria-label="${t("Aggiungi un dispositivo", "Add a device")}">＋</button></div>`;
  if (tool === "arredo") return `<div class="mpd1"><button class="mpd2 add" data-act="mpArAdd" data-a="${a}" data-f="${f}">＋ 🛋️</button></div>`;
  const D = dispositivi(a, f).filter(id => !spostati.has(id)), E = AREAS[a] ? (VEL(a).filter(e => !spostati.has("ap:" + e.id)).map(e => e.html).join("")) : "";
  return D.length || E || UI.edit ? `<div class="mpd1">${E}${D.map(id => CHIP(id, a, f)).join("")}${UI.edit ? `<button class="mpd2 add" data-act="mpDevAdd" data-a="${a}" data-f="${f}">＋</button>` : ""}</div>` : ""; };

/* ⚙️ cosa mostrare nelle stanze (tutta la casa, LAYOUT.mapShow: si salvano solo quelle spente); i pericoli (fumo, gas, acqua) si vedono sempre */
const MOSTRA = () => [["temp", "🌡️", t("Temperatura e umidità", "Temperature and humidity"), t("dai sensori scelti in ✏️ della stanza (Home)", "from the sensors chosen in the room's ✏️ (Home)")],
  ["open", "🪟", t("Porte e finestre aperte", "Open doors and windows"), t("sensori di apertura della stanza", "the room's opening sensors")],
  ["mov", "🏃", t("Movimento e presenza", "Motion and presence"), t("spegnilo se un sensore di presenza resta sempre acceso", "turn it off if a presence sensor is always on")],
  ["clima", "🔥", t("Clima acceso", "Climate on"), t("riscaldamento o condizionatore della stanza", "the room's heating or air conditioning")]];
const vedo = k => LAYOUT.mapShow?.[k] !== false;
function stanza(a, p, f, spostati, tool) {
  const ctl = (i) => tool === "stanze" ? comandi(a, i, f) : "";
  if (!AREAS[a]) return pezzi(p).map((r, i) => `<div class="mpr1 cust ${i ? "pz" : ""}" style="grid-column:${r.x + 1} / span ${r.w};grid-row:${r.y + 1} / span ${r.h}">${i === 0 ? `<button class="mpb1" ${isAdmin() ? `data-act="mpCustom" data-id="${a}" data-f="${f}"` : ""}><b>${esc(nomeStanza(a, f))}</b></button>${rigaDev(a, f, spostati, tool)}` : `<span class="mpb1"></span>`}${ctl(i)}</div>`).join("");
  const T = vedo("temp") ? roomTemp(a) : null, H = vedo("temp") ? roomHum(a) : null, L = lightsOn(a).length, nL = luciContate(a).length;
  const O = vedo("open") ? inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && isOn(id)).length : 0;
  const mov = vedo("mov") ? inArea(a, "binary_sensor", id => ["motion", "occupancy", "presence"].includes(deviceClass(id)) && isOn(id)).length : 0;
  const C = vedo("clima") ? inArea(a, "climate").find(id => ok(id) && S[id].state !== "off") : null, freddo = C && ["cool", "dry"].includes(S[C].state);
  /* pericoli: per tipo, corretti dalle scelte della pagina Sicurezza (LAYOUT.sicurezza: noPericoli tolti, pericoli aggiunti) */
  const noP = new Set(LAYOUT.sicurezza?.noPericoli || []);
  const pericolo = new Set([...inArea(a, "binary_sensor", id => ["smoke", "gas", "moisture", "carbon_monoxide"].includes(deviceClass(id))),
    ...(LAYOUT.sicurezza?.pericoli || []).filter(id => S[id] && areaOf(id) === a)].filter(id => !noP.has(id) && isOn(id))).size;
  const cls = `mpr1 ${L ? "lit" : ""} ${O ? "open" : ""} ${mov ? "mov" : ""} ${pericolo ? "dang" : ""}`;
  return pezzi(p).map((r, i) => `<div class="${cls} ${i ? "pz" : ""}" style="grid-column:${r.x + 1} / span ${r.w};grid-row:${r.y + 1} / span ${r.h}">
    ${i === 0 ? `<button class="mpb1" data-act="room" data-id="${a}"><b>${esc(nomeStanza(a, f))}</b>
      <span class="mpt1">${T != null ? fnum(T) + "°" : ""}${H != null ? `<small>${Math.round(H)}%</small>` : ""}</span></button>${rigaDev(a, f, spostati, tool)}
    ${tool && tool !== "stanze" ? "" : `<div class="mpi1">${nL ? `<button class="${L ? "on" : ""}" data-act="mpLights" data-id="${a}" title="${t("Luci", "Lights")}">💡${L ? " " + L : ""}</button>` : ""}${O ? `<i class="al">🪟 ${O}</i>` : ""}${C ? `<i>${freddo ? "❄️" : "🔥"}</i>` : ""}${mov ? `<i>🏃</i>` : ""}${pericolo ? `<i class="al">🚨</i>` : ""}</div>`}`
      : `<button class="mpb1" data-act="room" data-id="${a}" aria-label="${esc(nomeStanza(a, f))}"></button>`}
    ${ctl(i)}</div>`).join("");
}

/* ---------- porte e finestre nel 2D: sopra i muri, arancio se aperte; nello strumento i muri si toccano ---------- */
function svgAperture(f, pos, stanze, tool) {
  const E = new Set(bordi(pos, stanze).map(e => chiaveMuro(e.o, e.x, e.y))), out = [];
  for (const ap of aperture(f)) {
    const st = statoAp(ap), cls = `mpo1 ${ap.tipo === "porta" ? "po" : "fi"} ${st.aperta ? "ap" : ""}`;
    for (const [x, y] of unita(ap)) {
      const d = ap.o === "h" ? `M${x + .1} ${y}H${x + .9}` : `M${x} ${y + .1}V${y + .9}`;
      if (E.has(chiaveMuro(ap.o, x, y))) out.push(`<path class="${cls}" d="${d}"/>${ap.tipo === "finestra" ? `<path class="mpo1 fi2" d="${d}"/>` : ""}`);
      else if (tool === "aperture") out.push(`<path class="mpo1 orf" d="${d}"/>`);   // il muro non c'è più (stanza spostata): si vede per toglierla
    }
  }
  return out.join("");
}
function svgTocco(f, pos, stanze) {
  const M = mappaAperture(f);
  return bordi(pos, stanze).map(e => { const d = e.o === "h" ? `M${e.x} ${e.y}H${e.x + 1}` : `M${e.x} ${e.y}V${e.y + 1}`, u = M.get(chiaveMuro(e.o, e.x, e.y));
    return `<path class="mph2 ${u ? "su" : ""}" d="${d}" data-act="mpOpen" data-f="${esc(f)}" data-o="${e.o}" data-x="${e.x}" data-y="${e.y}"><title>${u ? (u.ap.tipo === "porta" ? t("Porta", "Door") : t("Finestra", "Window")) : t("Metti una porta o una finestra", "Add a door or a window")}</title></path>`; }).join("");
}
/* ---------- livello sopra la griglia: dispositivi al loro posto e mobili ---------- */
const pct = (v, n) => (v / n * 100).toFixed(3) + "%";
function livello(f, pos, stanze, righe, tool, G) {
  const out = [];
  for (const [k, g] of G) {
    if (!(tool === "disp" || (g.salvato && (!tool || tool === "stanze")))) continue;
    out.push(`<div class="mpk1 ${g.salvato ? "" : "auto"}" data-mv="${tool === "disp" ? "dev" : ""}" data-key="${esc(k)}" data-a="${esc(g.a)}" ${tool ? "" : `data-lp="${esc(g.o.id || k)}"`} style="left:${pct(g.x, COL)};top:${pct(g.y, righe)}">${g.o.chip()}</div>`);
  }
  if (tool === "arredo") for (const m of mobili(f, pos)) {
    const g = ingombro(m.k, m.r), sel = SEL === m.id;
    out.push(`<div class="mpa2 ${sel ? "sel" : ""}" data-mv="arr" data-id="${esc(m.id)}" style="left:${pct(m.x, COL)};top:${pct(m.y, righe)};width:${pct(g.w, COL)};height:${pct(g.d, righe)}" title="${esc(ARREDO()[m.k]?.n || "")}">${svgMobile(m)}
</div>`);
  }
  return out.length ? `<div class="mpov" data-f="${esc(f)}" data-righe="${righe}">${out.join("")}</div>` : "";
}

function testata(P, cur, tool, in3d) {
  const admin = isAdmin() && UI.edit;
  const vista = `<div class="seg">${["2D", "3D"].map(v => `<button class="${(sGet("map3") === "1") === (v === "3D") ? "act" : ""}" data-act="m3Toggle" data-v="${v}">${v}</button>`).join("")}</div>`;
  const pianiSeg = in3d ? segPiani3d() : `<div class="seg">${P.map(p => `<button class="${p.f === cur.f ? "act" : ""}" data-act="mpFloor" data-v="${p.f}">${esc(p.nome)}</button>`).join("")}</div>`;
  if (!admin) return `<div class="ch"><div class="row" style="gap:8px;flex-wrap:wrap">${vista}${pianiSeg}</div></div>`;
  const pos = posizioni(cur.f, cur.stanze), quanteSpostate = Object.keys(mp(cur.f).pos || {}).length, quantiMobili = mobili(cur.f, pos).length;
  const extra = {
    stanze: `<button class="btn sm pri" data-act="mpNew" data-v="${cur.f}">＋ ${t("Stanza", "Room")}</button><button class="btn sm" data-act="mpImg" data-v="${cur.f}">🖼️ ${t("Piantina", "Floor plan")}</button><button class="btn sm" data-act="mpReset" data-v="${cur.f}">↺ ${t("Disposizione automatica", "Auto layout")}</button>`,
    aperture: `<span class="small muted">${t("Tocca un muro per metterci una porta o una finestra.", "Tap a wall to put a door or a window on it.")}</span>`,
    disp: `<div class="seg">${[["auto", "✨ " + t("Dispositivi automatici", "Auto devices")], ["manual", "✋ " + t("Solo scelti", "Chosen only")]].map(([k, n]) => `<button class="${(mp(cur.f).devMode || "auto") === k ? "act" : ""}" data-act="mpDevMode" data-v="${k}" data-f="${cur.f}">${n}</button>`).join("")}</div>
      ${quanteSpostate ? `<button class="btn sm" data-act="mpPosReset" data-v="${cur.f}">↺ ${t("Posti automatici", "Automatic spots")}</button>` : ""}`,
    arredo: selezionato(cur.f, pos) ? (m => `<span class="mpa2t"><b>${ARREDO()[m.k]?.i || ""} ${esc(ARREDO()[m.k]?.n || "")}</b><button class="btn sm" data-act="mpArRot" data-id="${esc(m.id)}" data-f="${esc(cur.f)}">⟳ ${t("Ruota", "Rotate")}</button><button class="btn sm bad" data-act="mpArDel" data-id="${esc(m.id)}" data-f="${esc(cur.f)}">🗑 ${t("Togli", "Remove")}</button><button class="btn sm" data-act="mpArSel" data-id="${esc(m.id)}" aria-label="${t("Fatto", "Done")}">✓</button></span>`)(selezionato(cur.f, pos))
      : `<button class="btn sm pri" data-act="mpArAuto" data-v="${cur.f}">✨ ${t("Arreda per me", "Furnish for me")}</button>${quantiMobili ? `<button class="btn sm bad" data-act="mpArClear" data-v="${cur.f}">🗑 ${t("Togli tutti i mobili", "Remove all furniture")}</button>` : ""}`,
  }[tool];
  return `<div class="ch"><div class="row" style="gap:8px;flex-wrap:wrap">${vista}${pianiSeg}</div>
      <span class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="mpCasa">🏠 ${t("Tetto e piani", "Roof and floors")}</button><button class="btn sm pri" data-act="m3Vedi">🏠 ${t("Guarda la tua casa in 3D", "See your house in 3D")}</button><button class="btn sm" data-act="mpCfg" title="${t("Cosa mostrare", "What to show")}" aria-label="${t("Cosa mostrare", "What to show")}">⚙️</button></span></div>
    <div class="mpst1"><div class="seg">${STRUMENTI().map(([k, ic, n]) => `<button class="${tool === k ? "act" : ""}" data-act="mpTool" data-v="${k}">${ic} ${n}</button>`).join("")}</div><span class="row" style="gap:6px;flex-wrap:wrap">${extra}</span></div>`;
}
const AIUTO = () => ({
  stanze: t("«＋ Stanza» aggiunge una stanza solo nella mappa (anche se non esiste in Home Assistant: ripostiglio, scale, terrazzo…). ← ↑ ↓ → sposta, ⇠ ⇢ larghezza, ⇡ ⇣ altezza. «＋ pezzo (L)» aggiunge un altro rettangolo alla stanza: mettilo accanto per fare una stanza a L, a T o di qualsiasi forma; i muri si uniscono da soli. «Piantina» mette sotto un'immagine (/local/piantina.png).", "«＋ Room» adds a room only on the map (even if it doesn't exist in Home Assistant: closet, stairs, terrace…). ← ↑ ↓ → move, ⇠ ⇢ width, ⇡ ⇣ height. «＋ piece (L)» adds another rectangle to the room: put it alongside to make an L, T or any shape; walls join automatically. «Floor plan» puts an image underneath (/local/plan.png)."),
  aperture: t("Porte e finestre si vedono nel 2D sopra i muri e nel 3D aperte o chiuse con lo stato vero: collegale a un sensore di apertura o a una tapparella. Le linee rosse tratteggiate sono aperture rimaste dove una stanza non c'è più: toccale per toglierle.", "Doors and windows show on the walls in 2D and open or closed with their real state in 3D: link them to an opening sensor or a cover. Dashed red lines are openings left where a room no longer is: tap them to remove them."),
  disp: t("Trascina i dispositivi dove sono davvero (sul telefono: tieni premuto e poi sposta). Quelli tratteggiati sono messi da soli, dal centro della stanza verso i bordi. ＋ aggiunge, ✕ toglie. Fuori dalla Modifica, quelli che hai spostato restano nel loro punto anche nel 2D.", "Drag devices to where they really are (on a phone: press and hold, then move). Dashed ones were placed automatically, from the centre of the room outwards. ＋ adds, ✕ removes. Outside Edit, the ones you moved stay in their spot in 2D too."),
  arredo: t("«＋ 🛋️» in una stanza aggiunge un mobile; trascinalo per spostarlo, toccalo per ruotarlo o toglierlo. «Arreda per me» propone i mobili dal nome delle stanze ancora vuote. L'arredo si vede nella casa in 3D.", "«＋ 🛋️» in a room adds a piece of furniture; drag it to move it, tap it to rotate or remove it. «Furnish for me» suggests furniture from the names of rooms that are still empty. Furniture shows in the 3D house."),
});

function pagina() {
  const P = piani();
  if (!P.length) return `<div class="g">${card("🗺️ " + t("Mappa", "Map"), empty(t("Crea le aree in Home Assistant (Impostazioni → Aree) e assegna i dispositivi: la mappa si disegna da sola.", "Create areas in Home Assistant (Settings → Areas) and assign devices: the map draws itself.")) + manca(t("Servono le aree di Home Assistant, una per stanza.", "It needs Home Assistant areas, one per room."), linkBtn(t("Aree di Home Assistant", "Home Assistant areas"), myHA("areas"), "pri") + comeFare("mappa")))}</div>`;
  const cur = P.find(p => p.f === sGet("mapFloor")) || P[0], pos = posizioni(cur.f, cur.stanze), tool = strumento();
  const in3d = sGet("map3") === "1" && !UI.edit && haStanze3d();
  const righe = righeDi(pos), img = LAYOUT.map?.[cur.f]?.img;
  const G = posOggetti(cur.f, cur.stanze, pos), spostati = new Set([...G].filter(([, g]) => g.salvato).map(([k]) => k));
  const corpo = in3d ? vista3d() : `<div class="mpw1 ${tool ? "t-" + tool : ""}"><div class="mpg1 ${UI.edit ? "edit" : ""}" style="grid-template-rows:repeat(${righe},64px)${img ? `;background-image:url('${esc(img)}')` : ""}">${cur.stanze.map(a => stanza(a, pos[a], cur.f, tool === "disp" || tool === "arredo" ? new Set() : spostati, tool)).join("")}</div>
      <svg class="mpm1" viewBox="0 0 ${COL} ${righe}" preserveAspectRatio="none" aria-hidden="true"><path d="${muri(pos, cur.stanze)}"/>${svgAperture(cur.f, pos, cur.stanze, tool)}</svg>
      ${tool === "aperture" ? `<svg class="mph1" viewBox="0 0 ${COL} ${righe}" preserveAspectRatio="none">${svgTocco(cur.f, pos, cur.stanze)}</svg>` : ""}
      ${livello(cur.f, pos, cur.stanze, righe, tool, G)}</div>`;
  return `<div class="g"><section class="card mp1">${testata(P, cur, tool, in3d)}${corpo}
    ${tool === "stanze" && cur.nascoste.length ? `<div class="fl1">${t("Tolte dalla mappa", "Removed from the map")}</div><div class="vr1">${cur.nascoste.map(a => `<button data-act="mpShow" data-id="${a}" data-f="${cur.f}">👁 ${esc(nomeStanza(a, cur.f))}</button>`).join("")}</div>` : ""}
    ${in3d ? "" : `<p class="small muted" style="margin-top:10px">${tool ? AIUTO()[tool] : t("Tocca una stanza per comandarla, 💡 per spegnere o accendere le sue luci. Con 3D vedi la casa intera.", "Tap a room to control it, 💡 to switch its lights. 3D shows the whole house.")}</p>`}
  </section></div>`;
}

/** copia modificabile delle posizioni del piano della stanza a */
function modifica(a, fn, f = AREAS[a]?.floor || "_") {
  const P = piani().find(p => p.f === f), pos = posizioni(f, P.stanze);
  return cambia(l => {
    l.map = { ...(l.map || {}) }; l.map[f] = { ...(l.map[f] || {}) };
    l.map[f].rooms = JSON.parse(JSON.stringify({ ...pos, ...(l.map[f].rooms || {}) }));
    fn(l.map[f].rooms[a]);
  });
}
/** piano di un pulsante: data-f sul pulsante o sul gruppo dei comandi */
function fl(el) { return el.dataset.f || el.closest("[data-f]")?.dataset.f || sGet("mapFloor") || piani()[0]?.f || "_"; }
function mapSet(f, fn, msg) { return cambia(l => { l.map = { ...(l.map || {}) }; l.map[f] = JSON.parse(JSON.stringify(l.map[f] || {})); fn(l.map[f]); }, msg); }
/** salva una modifica al piano f e offre «Annulla» per qualche secondo */
async function conAnnulla(f, fn, msg) {
  const prima = JSON.stringify(LAYOUT.map?.[f] ?? null);
  await mapSet(f, fn);
  toast(msg, false, [t("Annulla", "Undo"), () => cambia(l => { l.map = { ...(l.map || {}) }; const v = JSON.parse(prima); if (v == null) delete l.map[f]; else l.map[f] = v; }, "↶ " + t("Come prima", "Back as it was"))]);
}
const casaSet = (fn, msg) => cambia(l => { l.map = { ...(l.map || {}) }; l.map.casa = JSON.parse(JSON.stringify(l.map.casa || {})); fn(l.map.casa); }, msg);
const pianoDi = f => piani().find(p => p.f === f);

Object.assign(ACT, {
  m3Toggle: el => { sSet("map3", el.dataset.v === "3D" ? "1" : "0"); render(true); },
  m3Vedi: () => { UI.edit = false; sSet("map3", "1"); guardaCasa(); render(true); },
  mpTool: el => { sSet("mapTool", el.dataset.v); SEL = null; render(true); },
  mpFloor: el => { sSet("mapFloor", el.dataset.v); SEL = null; render(true); },
  mpLights: el => { const a = el.dataset.id, on = lightsOn(a); luciComando(on.length ? on : luciContate(a), !on.length); },
  mpMove: el => {
    const a = el.dataset.id, i = +el.dataset.i || 0, [k, d] = el.dataset.v.split(",");
    modifica(a, room => {
      const r = i ? room.extra[i - 1] : room;
      r[k] = Math.max(k === "w" || k === "h" ? 1 : 0, r[k] + +d);
      if (r.x + r.w > COL) { if (k === "x") r.x = COL - r.w; else r.w = COL - r.x; }
    }, fl(el));
  },
  mpPiece: el => modifica(el.dataset.id, r => { r.extra = [...(r.extra || []), { x: r.x, y: r.y + r.h, w: Math.max(1, Math.ceil(r.w / 2)), h: 1 }]; }, fl(el)),
  mpPieceDel: el => { const i = +el.dataset.i; modifica(el.dataset.id, r => { r.extra = (r.extra || []).filter((_, j) => j !== i - 1); if (!r.extra.length) delete r.extra; }, fl(el)); },
  mpHide: el => { const a = el.dataset.id, f = fl(el); mapSet(f, m => { m.hide = [...new Set([...(m.hide || []), a])]; }); },
  mpShow: el => { const a = el.dataset.id, f = fl(el); mapSet(f, m => { m.hide = (m.hide || []).filter(x => x !== a); }); },
  mpNew: el => nomeSheet(el.dataset.v, null),
  mpDev: el => { const id = el.dataset.id, d = id.split(".")[0];
    if (UI.edit) return; if (["light", "switch", "fan", "input_boolean", "humidifier"].includes(d)) svc(d, "toggle", {}, { entity_id: id });
    else if (d === "cover") svc("cover", "toggle", {}, { entity_id: id }); else if (["scene", "script"].includes(d)) svc(d, "turn_on", {}, { entity_id: id });
    else moreInfo(id); },
  mpDevDel: el => { const id = el.dataset.id, a = el.dataset.a, f = fl(el);
    mapSet(f, m => { m.devs = m.devs || {}; const c = m.devs[a] = m.devs[a] || {}; c.add = (c.add || []).filter(x => x !== id); c.hide = [...new Set([...(c.hide || []), id])]; if (m.pos) delete m.pos[id]; }); },
  mpDevAdd: el => { const a = el.dataset.a, f = fl(el);
    scegli({ titolo: "＋ " + esc(nomeStanza(a, f)), sotto: t("Qualsiasi dispositivo della casa: compare come icona nella stanza.", "Any device in the house: it shows as an icon in the room."), area: AREAS[a] ? a : null, auto: false, attuale: null,
      filtro: id => /^(light|switch|cover|fan|media_player|lock|climate|vacuum|humidifier|camera|sensor|binary_sensor|scene|script|input_boolean)\./.test(id) && !dispositivi(a, f).includes(id),
      onPick: id => id && mapSet(f, m => { m.devs = m.devs || {}; const c = m.devs[a] = m.devs[a] || {}; c.hide = (c.hide || []).filter(x => x !== id); c.add = [...new Set([...(c.add || []), id])]; }, "＋ " + nm(id)) }); },
  mpDevMode: el => { const f = fl(el), v = el.dataset.v; mapSet(f, m => { if (v === "auto") delete m.devMode; else m.devMode = v; }); },
  mpPosReset: el => { const f = el.dataset.v; conAnnulla(f, m => { delete m.pos; }, "↺ " + t("Dispositivi ai posti automatici", "Devices back to automatic spots")); },
  mpCustom: el => nomeSheet(fl(el), el.dataset.id),
  mpCustomDel: el => { const a = el.dataset.id, f = fl(el); mapSet(f, m => { m.custom = (m.custom || []).filter(c => c.id !== a); if (m.rooms) delete m.rooms[a]; }); },
  mpNameSave: el => { const f = el.dataset.f, id = el.dataset.id, n = (document.getElementById("mp1n")?.value || "").trim(); if (!n) return toast(t("Scrivi un nome", "Write a name"), true);
    closeSheet(); mapSet(f, m => { m.custom = m.custom || []; const c = m.custom.find(x => x.id === id); if (c) c.name = n; else m.custom.push({ id: "m_" + Date.now().toString(36), name: n }); }, "🗺️ " + n); },
  mpReset: el => { const f = el.dataset.v; cambia(l => { if (l.map?.[f]) { l.map = { ...l.map }; l.map[f] = { ...l.map[f] }; delete l.map[f].rooms; } }); },
  mpImg: el => { const f = el.dataset.v, cur = LAYOUT.map?.[f]?.img || "";
    openSheet(() => `<div class="sh-head"><div><h3>🖼️ ${t("Piantina sotto la mappa", "Floor plan under the map")}</h3><div class="small muted">${t("Indirizzo di un'immagine: caricala in config/www e scrivi /local/nome.png. Lascia vuoto per toglierla.", "Image address: upload it to config/www and write /local/name.png. Leave empty to remove it.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
      <label class="fld1"><span>URL</span><input id="mp1i" type="text" value="${esc(cur)}" placeholder="/local/piantina.png" data-chg="mpImgSet" data-v="${f}"></label>
      <div class="small muted" style="margin-top:8px">${t("Si salva appena esci dal campo.", "Saved when you leave the field.")}</div>`); },
});
function nomeSheet(f, id) {
  const c = id ? custom(f).find(x => x.id === id) : null;
  openSheet(() => `<div class="sh-head"><div><h3>🗺️ ${c ? t("Stanza della mappa", "Map room") : t("Nuova stanza", "New room")}</h3><div class="small muted">${t("Esiste solo nella mappa: utile per ripostigli, scale, terrazzi, stanze che non hai creato in Home Assistant.", "It exists only in the map: handy for closets, stairs, terraces, rooms you didn't create in Home Assistant.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="mp1n" type="text" value="${esc(c?.name || "")}" placeholder="${t("Ripostiglio, Scale, Terrazzo…", "Closet, Stairs, Terrace…")}"></label>
    <button class="btn pri" data-act="mpNameSave" data-f="${f}" data-id="${id || ""}" style="margin-top:12px">💾 ${t("Salva", "Save")}</button>`);
}
const cfgMappa = () => `<div class="sh-head"><div><h3>⚙️ ${t("Cosa mostrare nelle stanze", "What to show in the rooms")}</h3><div class="small muted">${t("Vale per tutti i piani e per tutta la casa, in 2D e 3D.", "It applies to every floor and the whole home, in 2D and 3D.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${MOSTRA().map(([k, ic, n, s]) => `<label class="li"><span class="ic">${ic}</span><div class="tx"><b>${n}</b><span>${s}</span></div><input type="checkbox" data-chg="mpShowK" data-k="${k}" ${vedo(k) ? "checked" : ""}></label>`).join("")}</div>
    <p class="small muted" style="margin:10px 0 0">${t("Le luci (💡), i dispositivi della stanza e i pericoli (🚨 fumo, gas, acqua) si vedono sempre: i dispositivi si scelgono con ＋ e ✕ su ogni stanza, i sensori di pericolo nella pagina Sicurezza.", "Lights (💡), the room's devices and hazards (🚨 smoke, gas, water) are always shown: devices are chosen with ＋ and ✕ on each room, hazard sensors on the Security page.")}</p>`;
ACT.mpCfg = () => openSheet(cfgMappa);
CHG.mpShowK = el => { const k = el.dataset.k, on = el.checked;
  cambia(l => { const m = { ...(l.mapShow || {}) }; if (on) delete m[k]; else m[k] = false; if (Object.keys(m).length) l.mapShow = m; else delete l.mapShow; }, (on ? "👁 " : "🙈 ") + (MOSTRA().find(x => x[0] === k)?.[2] || "")); };
CHG.mpImgSet = el => { const f = el.dataset.v, v = el.value.trim(); cambia(l => { l.map = { ...(l.map || {}) }; l.map[f] = { ...(l.map[f] || {}) }; if (v) l.map[f].img = v; else delete l.map[f].img; }, "🖼️ " + t("Salvato", "Saved")); };

/* ================= 🚪 porte e finestre ================= */
const AP = { f: null, o: null, x: 0, y: 0 };
/** l'apertura sul pezzo di muro scelto (se c'è) */
const apQui = () => mappaAperture(AP.f).get(chiaveMuro(AP.o, AP.x, AP.y))?.ap || null;
function stanzeDelMuro() { const P = pianoDi(AP.f); if (!P) return []; const O = proprietari(posizioni(AP.f, P.stanze), P.stanze);
  return (AP.o === "h" ? [O.get(AP.x + "," + (AP.y - 1)), O.get(AP.x + "," + AP.y)] : [O.get((AP.x - 1) + "," + AP.y), O.get(AP.x + "," + AP.y)]).filter(Boolean); }
/** cosa propongo di collegare a una porta o a una finestra nuova: il primo sensore adatto, e la tapparella (finestra) o la basculante (porta) */
const garage = id => /garage|gate|door/.test(deviceClass(id) || "") || /garage|basculante|portone|serranda/i.test(id + nm(id));
function proposta(A, tipo) { const p = propostePer(A, tipo); return { ent: p.sens[0] || null, cover: (tipo === "finestra" ? p.cov.find(id => !garage(id)) : p.cov.find(garage)) || null }; }
const statoBreve = id => !ok(id) ? t("non raggiungibile", "unavailable") : id.startsWith("cover.") ? (posCover(id) == null ? S[id].state : posCover(id) <= 0 ? t("chiusa", "closed") : posCover(id) >= 100 ? t("aperta", "open") : t("aperta al ", "open ") + posCover(id) + "%")
  : isOn(id) ? t("aperto adesso", "open now") : t("chiuso adesso", "closed now");
const rigaEnt = (id, act, actNo, vuoto, proposto) => `<div class="li"><span class="ic">${id ? (id.startsWith("cover.") ? "🪟" : isOn(id) ? "🔓" : "🔒") : "—"}</span><div class="tx"><b>${id ? esc(nm(id)) : vuoto}</b><span>${id ? (S[id] ? statoBreve(id) : t("non trovato", "not found")) + (proposto ? " · ✨ " + t("proposto", "suggested") : "") : t("niente collegato", "nothing linked")}</span></div>
  <span class="row" style="gap:6px"><button class="btn sm" data-act="${act}">${id ? t("Cambia", "Change") : t("Scegli", "Choose")}</button>${id ? `<button class="btn sm" data-act="${actNo}" aria-label="${t("Togli il collegamento", "Unlink")}">✕</button>` : ""}</span></div>`;
function apSheet() {
  const ap = apQui(), A = stanzeDelMuro(), nomi = A.map(a => esc(nomeStanza(a, AP.f))).join(" ↔ ") || t("muro esterno", "outside wall");
  const testa = `<div class="sh-head"><div><h3>${ap ? (ap.tipo === "porta" ? "🚪 " + t("Porta", "Door") : "🪟 " + t("Finestra", "Window")) : "🧱 " + t("Muro", "Wall")}</h3><div class="small muted">${nomi}</div></div><button class="x" data-act="sheetClose">×</button></div>`;
  if (!ap) {
    const esterno = A.length < 2, pS = proposta(A, "porta"), pF = proposta(A, "finestra");
    const sug = pS.ent && deviceClass(pS.ent) !== "window" && !(pF.ent && deviceClass(pF.ent) === "window") ? "porta" : esterno || (pF.ent && deviceClass(pF.ent) === "window") ? "finestra" : "porta";
    return testa + `<p class="small muted" style="margin:0 0 10px">${t("Cosa c'è in questo pezzo di muro? Poi puoi allargarla e collegarla a un sensore o a una tapparella.", "What's on this piece of wall? Then you can widen it and link it to a sensor or a cover.")}</p>
      <div class="mpap2"><button class="${sug === "porta" ? "pri" : ""}" data-act="mpApNew" data-v="porta">🚪<b>${t("Porta", "Door")}</b><small>${[pS.ent, pS.cover].filter(Boolean).map(id => "✨ " + esc(nm(id))).join(" · ") || t("senza sensore", "no sensor")}</small></button>
      <button class="${sug === "finestra" ? "pri" : ""}" data-act="mpApNew" data-v="finestra">🪟<b>${t("Finestra", "Window")}</b><small>${[pF.ent, pF.cover].filter(Boolean).map(id => "✨ " + esc(nm(id))).join(" · ") || t("senza sensore", "no sensor")}</small></button></div>`;
  }
  const st = statoAp(ap);
  return testa + `<div class="seg" style="margin-bottom:10px">${[["porta", "🚪 " + t("Porta", "Door")], ["finestra", "🪟 " + t("Finestra", "Window")]].map(([k, n]) => `<button class="${ap.tipo === k ? "act" : ""}" data-act="mpApTipo" data-v="${k}">${n}</button>`).join("")}</div>
    <div class="li"><span class="ic">↔</span><div class="tx"><b>${t("Larghezza", "Width")}</b><span>${t(`${unita(ap).length} casell${unita(ap).length === 1 ? "a" : "e"} di muro`, `${unita(ap).length} wall square${unita(ap).length === 1 ? "" : "s"}`)}</span></div>
      <span class="row" style="gap:6px"><button class="btn sm" data-act="mpApW" data-v="-1" ${unita(ap).length <= 1 ? "disabled" : ""}>−</button><button class="btn sm" data-act="mpApW" data-v="1" ${unita(ap).length >= 6 ? "disabled" : ""}>＋</button></span></div>
    <div class="fl1">${t("Sensore di apertura", "Opening sensor")}</div>
    ${rigaEnt(ap.ent, "mpApEnt", "mpApEntNo", t("Nessun sensore", "No sensor"), ap.auto?.ent && ap.auto.ent === ap.ent)}
    <div class="fl1">${ap.tipo === "porta" ? t("Basculante o serranda (facoltativa)", "Garage or roller door (optional)") : t("Tapparella (facoltativa)", "Cover (optional)")}</div>
    ${rigaEnt(ap.cover, "mpApCov", "mpApCovNo", t("Nessuna", "None"), ap.auto?.cover && ap.auto.cover === ap.cover)}
    <p class="small muted" style="margin:10px 0">${t("Nel 3D si vede com'è adesso: ", "In 3D it shows as it is now: ")}${st.aperta ? "🟠 " + t("aperta", "open") : t("chiusa", "closed")}${st.pos != null ? " · " + (ap.tipo === "porta" ? t("alzata al ", "raised to ") : t("tapparella al ", "cover at ")) + st.pos + "%" : ""}.</p>
    <button class="btn bad" data-act="mpApDel">🗑 ${ap.tipo === "porta" ? t("Togli la porta", "Remove the door") : t("Togli la finestra", "Remove the window")}</button>`;
}
const apMod = (fn, msg) => mapSet(AP.f, m => { const ap = (m.aperture || []).find(x => x.id === apQui()?.id); if (ap) fn(ap, m); }, msg);
Object.assign(ACT, {
  mpOpen: el => { Object.assign(AP, { f: el.dataset.f, o: el.dataset.o, x: +el.dataset.x, y: +el.dataset.y }); openSheet(apSheet); },
  mpApNew: el => { const tipo = el.dataset.v, A = stanzeDelMuro(), { ent, cover } = proposta(A, tipo);
    const ap = { id: "ap" + Date.now().toString(36), o: AP.o, x: AP.x, y: AP.y, w: 1, tipo, ...(ent ? { ent } : {}), ...(cover ? { cover } : {}), auto: { ent, cover } };
    mapSet(AP.f, m => { m.aperture = [...(m.aperture || []).filter(x => !unita(x).some(([x0, y0]) => x.o === AP.o && x0 === AP.x && y0 === AP.y)), ap]; }, (tipo === "porta" ? "🚪 " : "🪟 ") + (tipo === "porta" ? t("Porta messa", "Door added") : t("Finestra messa", "Window added"))); },
  mpApTipo: el => apMod(ap => { ap.tipo = el.dataset.v; }),
  mpApW: el => apMod(ap => { ap.w = Math.max(1, Math.min(6, (ap.w || 1) + +el.dataset.v)); }),
  mpApEntNo: () => apMod(ap => { delete ap.ent; }),
  mpApCovNo: () => apMod(ap => { delete ap.cover; }),
  mpApDel: () => { const id = apQui()?.id; closeSheet(); conAnnulla(AP.f, m => { m.aperture = (m.aperture || []).filter(x => x.id !== id); if (!m.aperture.length) delete m.aperture; }, "🗑 " + t("Tolta", "Removed")); },
  mpApEnt: () => { const ap = apQui(), f = AP.f, k = { ...AP }, usate = usateAperture(); usate.delete(ap?.ent);
    scegli({ titolo: "🔌 " + t("Sensore di apertura", "Opening sensor"), sotto: t("Porta, finestra, garage o apertura: nel 3D l'anta si gira quando è aperto.", "Door, window, garage or opening: in 3D the leaf swings when it's open."), area: stanzeDelMuro()[0] || null, auto: false, attuale: ap?.ent || null,
      filtro: id => id.startsWith("binary_sensor.") && ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && !usate.has(id),
      onPick: id => { Object.assign(AP, k); if (id) mapSet(f, m => { const a = (m.aperture || []).find(x => x.id === ap.id); if (a) a.ent = id; }, "🔌 " + nm(id)); openSheet(apSheet); } }); },
  mpApCov: () => { const ap = apQui(), f = AP.f, k = { ...AP }, usate = usateAperture(); usate.delete(ap?.cover);
    scegli({ titolo: "🪟 " + (ap?.tipo === "porta" ? t("Basculante o serranda", "Garage or roller door") : t("Tapparella", "Cover")), sotto: t("Nel 3D si vede alla sua posizione vera.", "In 3D it shows at its real position."), area: stanzeDelMuro()[0] || null, auto: false, attuale: ap?.cover || null,
      filtro: id => id.startsWith("cover.") && !usate.has(id),
      onPick: id => { Object.assign(AP, k); if (id) mapSet(f, m => { const a = (m.aperture || []).find(x => x.id === ap.id); if (a) a.cover = id; }, "🪟 " + nm(id)); openSheet(apSheet); } }); },
});

/* ================= 🏠 tetto, altezze e pavimenti ================= */
function casaSheet() {
  const P = piani().filter(p => p.stanze.length), c = casaCfg();
  return `<div class="sh-head"><div><h3>🏠 ${t("Tetto e piani", "Roof and floors")}</h3><div class="small muted">${t("Come si vede la casa in 3D. Vale per tutta la casa.", "How the house looks in 3D. It applies to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("Tetto", "Roof")}</div>
    <div class="seg">${TETTI().map(([k, ic, n]) => `<button class="${tetto() === k ? "act" : ""}" data-act="mpTetto" data-v="${k}">${ic} ${n}</button>`).join("")}</div>
    <p class="small muted" style="margin:6px 0 0">${t("Le falde coprono la casa quando è un rettangolo: con una forma a L, o un giardino o una terrazza in mezzo, il tetto resta piano.", "Pitched roofs cover the house when it is a rectangle: with an L shape, or a garden or terrace in between, the roof stays flat.")}</p>
    <div class="fl1">${t("Altezza dei muri", "Wall height")}</div>
    <p class="small muted" style="margin:0 0 6px">${t("Alzala se la casa sembra schiacciata, abbassala per guardare meglio dentro le stanze. 100% = come le altre case.", "Raise it if the house looks squashed, lower it to see better into the rooms. 100% = like other houses.")}</p>
    <div class="stack">${P.map(p => `<label class="li"><span class="ic">🏢</span><div class="tx"><b>${esc(p.nome)}</b><span>${Math.round(moltPiano(p.f) * 100)}%</span></div><input type="range" min="60" max="160" step="5" value="${Math.round(moltPiano(p.f) * 100)}" data-chg="mpAlt" data-f="${esc(p.f)}" aria-label="${t("Altezza dei muri", "Wall height")} ${esc(p.nome)}"></label>`).join("")}</div>
    <div class="fl1">${t("Pavimenti", "Floors")}</div>
    <p class="small muted" style="margin:0 0 6px">${t("✨ li sceglie dal nome della stanza. «Prato» e «Terrazza» sono all'aperto: niente muri alti né tetto sopra.", "✨ picks them from the room's name. «Lawn» and «Terrace» are outdoors: no tall walls and no roof above.")}</p>
    ${P.map(p => `${P.length > 1 ? `<div class="small muted" style="margin:8px 0 4px"><b>${esc(p.nome)}</b></div>` : ""}<div class="stack">${p.stanze.map(a => { const s = c.pav?.[a], auto = finituraAuto(a, p.f);
      return `<div class="li mppv1"><div class="tx"><b>${esc(nomeStanza(a, p.f))}</b><span>${esc((FINITURE().find(x => x[0] === finitura(a, p.f)) || [])[2] || "")}${!s ? " · ✨" : ""}</span></div><div class="mppv2">
        <button class="${!s ? "act" : ""}" data-act="mpPav" data-a="${esc(a)}" data-v="" title="✨ ${t("Automatico", "Automatic")}" aria-label="✨ ${t("Automatico", "Automatic")}">✨</button>
        ${FINITURE().map(([k, ic, n, rgb]) => `<button class="${s === k ? "act" : ""} ${!s && auto === k ? "au" : ""}" data-act="mpPav" data-a="${esc(a)}" data-v="${k}" title="${esc(n)}" aria-label="${esc(n)}" style="--pv:rgb(${rgb.join(",")})"></button>`).join("")}</div></div>`; }).join("")}</div>`).join("")}`;
}
Object.assign(ACT, {
  mpCasa: () => openSheet(casaSheet),
  mpTetto: el => casaSet(c => { c.tetto = el.dataset.v; }, TETTI().find(x => x[0] === el.dataset.v)?.[1] + " " + TETTI().find(x => x[0] === el.dataset.v)?.[2]),
  mpPav: el => casaSet(c => { c.pav = { ...(c.pav || {}) }; if (el.dataset.v) c.pav[el.dataset.a] = el.dataset.v; else delete c.pav[el.dataset.a]; if (!Object.keys(c.pav).length) delete c.pav; }),
});
CHG.mpAlt = el => casaSet(c => { c.alt = { ...(c.alt || {}) }; const v = +el.value / 100; if (Math.abs(v - 1) < .01) delete c.alt[el.dataset.f]; else c.alt[el.dataset.f] = v; if (!Object.keys(c.alt).length) delete c.alt; }, "📏 " + el.value + "%");

/* ================= 🛋️ arredo ================= */
const arSheet = (a, f) => `<div class="sh-head"><div><h3>＋ 🛋️ ${esc(nomeStanza(a, f))}</h3><div class="small muted">${t("Scegli un mobile: lo metto in un posto libero, poi lo sposti trascinandolo.", "Pick a piece: I put it in a free spot, then you drag it where you want.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
  <div class="mpal1">${Object.entries(ARREDO()).map(([k, A]) => `<button data-act="mpArPick" data-k="${k}" data-a="${esc(a)}" data-f="${esc(f)}"><span>${svgMobile({ k, x: 0, y: 0, r: 0 })}</span><b>${A.i} ${esc(A.n)}</b></button>`).join("")}</div>`;
/** mette il mobile k nella stanza a, nel primo posto libero (o al centro) */
function metti(m, f, a, k, pos, occ) {
  const P0 = pos[a], p = postoLibero(k, P0, celle(P0), occ, zoneLibere(aperture(f))) || { x: P0.x + Math.max(0, (P0.w - ingombro(k, 0).w) / 2), y: P0.y + Math.max(0, (P0.h - ingombro(k, 0).d) / 2), r: 0 };
  const it = { id: "mb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k, a, x: Math.round((p.x - P0.x) * 100) / 100, y: Math.round((p.y - P0.y) * 100) / 100, r: p.r };
  m.arredo = [...(m.arredo || []), it]; occ.push(spazio({ ...it, x: p.x, y: p.y }));
  return it;
}
Object.assign(ACT, {
  mpArAdd: el => openSheet(() => arSheet(el.dataset.a, fl(el))),
  mpArPick: el => { const { k, a, f } = el.dataset, P = pianoDi(f), pos = posizioni(f, P.stanze); closeSheet();
    let id = null; conAnnulla(f, m => { const occ = mobili(f, pos).filter(x => !ARREDO()[x.k]?.piatto).map(spazio); id = metti(m, f, a, k, pos, occ).id; }, "＋ " + ARREDO()[k].n).then(() => { SEL = id; render(true); }); },
  mpArAuto: el => { const f = el.dataset.v, P = pianoDi(f), pos = posizioni(f, P.stanze), gia = new Set(mobili(f, pos).map(m => m.a)); let n = 0;
    const vuote = P.stanze.filter(a => !gia.has(a) && proposteStanza(a, f).length);
    if (!vuote.length) return toast(t("Nessuna stanza vuota da arredare: i nomi delle stanze non mi dicono che mobili mettere, oppure sono già arredate.", "No empty room to furnish: the room names don't tell me which furniture to use, or they're already furnished."));
    conAnnulla(f, m => { const occ = mobili(f, pos).filter(x => !ARREDO()[x.k]?.piatto).map(spazio);
      for (const a of vuote) for (const k of proposteStanza(a, f)) { const P0 = pos[a]; if (postoLibero(k, P0, celle(P0), occ, zoneLibere(aperture(f)))) { metti(m, f, a, k, pos, occ); n++; } } },
      "✨ " + t(`${vuote.length} stanz${vuote.length === 1 ? "a arredata" : "e arredate"}`, `${vuote.length} room${vuote.length === 1 ? "" : "s"} furnished`)); },
  mpArClear: el => { const f = el.dataset.v; SEL = null; conAnnulla(f, m => { delete m.arredo; }, "🗑 " + t("Mobili tolti", "Furniture removed")); },
  mpArRot: el => { const id = el.dataset.id, f = fl(el), P = pianoDi(f), pos = posizioni(f, P.stanze);
    conAnnulla(f, m => { const it = (m.arredo || []).find(x => x.id === id); if (!it) return; const g0 = ingombro(it.k, it.r), r = ((it.r | 0) + 1) % 4, g1 = ingombro(it.k, r);
      /* giro intorno al centro, restando nella griglia */
      const R0 = pos[it.a], cx = R0.x + it.x + g0.w / 2, cy = R0.y + it.y + g0.d / 2;
      it.r = r; it.x = Math.round((Math.max(0, Math.min(COL - g1.w, cx - g1.w / 2)) - R0.x) * 4) / 4; it.y = Math.round((Math.max(0, cy - g1.d / 2) - R0.y) * 4) / 4; }, "⟳ " + t("Ruotato", "Rotated")); },
  mpArDel: el => { const id = el.dataset.id, f = fl(el); SEL = null; conAnnulla(f, m => { m.arredo = (m.arredo || []).filter(x => x.id !== id); if (!m.arredo.length) delete m.arredo; }, "🗑 " + t("Tolto", "Removed")); },
  mpArSel: el => { SEL = SEL === el.dataset.id ? null : el.dataset.id; render(true); },
});

/* ================= trascinare dispositivi e mobili nel 2D (✏️ Modifica) =================
   Col mouse basta trascinare; col dito si tiene premuto un attimo (come in trascina.js), così la pagina scorre come sempre.
   Il punto si arrotonda al quarto di casella; si salva subito, con «Annulla». */
let MV = null, mangiaMv = 0;
const fermoMv = () => leggera() || matchMedia("(prefers-reduced-motion: reduce)").matches;
document.addEventListener("pointerdown", e => {
  const el = e.target.closest?.("[data-mv]"); if (!el || !el.dataset.mv || !UI.edit || !isAdmin() || (e.pointerType === "mouse" && e.button !== 0)) return;
  if (e.target.closest(".dx,.mpa2t button")) return;
  const box = el.closest(".mpov"); if (!box) return;
  MV = { el, box, id: e.pointerId, x0: e.clientX, y0: e.clientY, dito: e.pointerType !== "mouse", su: false, r: el.getBoundingClientRect() };
  if (MV.dito) MV.t = setTimeout(() => { if (MV && MV.el === el) { try { navigator.vibrate?.(12); } catch {} prendi(); } }, 320);
}, true);
function prendi() { if (!MV) return; MV.su = true; MV.box.dataset.drag = "1"; MV.el.classList.add("mv1"); document.body.classList.add("tr1on"); }
document.addEventListener("pointermove", e => {
  if (!MV || e.pointerId !== MV.id) return;
  const dx = e.clientX - MV.x0, dy = e.clientY - MV.y0;
  if (!MV.su) { if (MV.dito) { if (Math.hypot(dx, dy) > 9) { clearTimeout(MV.t); MV = null; } return; } if (Math.hypot(dx, dy) < 4) return; prendi(); }
  const B = MV.box.getBoundingClientRect(), righe = +MV.box.dataset.righe;
  if (MV.el.dataset.mv === "dev") { MV.el.style.left = pct(Math.max(0, Math.min(B.width, MV.r.left + MV.r.width / 2 - B.left + dx)), B.width); MV.el.style.top = pct(Math.max(0, Math.min(B.height, MV.r.top + MV.r.height / 2 - B.top + dy)), B.height); }
  else { MV.el.style.left = pct(Math.max(0, Math.min(B.width - MV.r.width, MV.r.left - B.left + dx)), B.width); MV.el.style.top = pct(Math.max(0, Math.min(B.height - MV.r.height, MV.r.top - B.top + dy)), B.height); }
  MV.ult = { cx: (parseFloat(MV.el.style.left) / 100) * COL, cy: (parseFloat(MV.el.style.top) / 100) * righe };
}, { passive: true });
document.addEventListener("touchmove", e => { if (MV?.su) e.preventDefault(); }, { passive: false });
function lascia(ok) {
  const m = MV; MV = null; if (!m) return; clearTimeout(m.t);
  if (!m.su) return;
  mangiaMv = Date.now(); delete m.box.dataset.drag; m.el.classList.remove("mv1"); document.body.classList.remove("tr1on");
  if (!ok || !m.ult) return render(true);
  const f = m.box.dataset.f, P = pianoDi(f), pos = posizioni(f, P.stanze), q = v => Math.round(v * 4) / 4;
  if (m.el.dataset.mv === "dev") {
    const k = m.el.dataset.key, a = m.el.dataset.a, R = pos[a]; if (!R) return render(true);
    conAnnulla(f, mm => { mm.pos = { ...(mm.pos || {}), [k]: { a, x: q(m.ult.cx - R.x), y: q(m.ult.cy - R.y) } }; }, "↕ " + t("Spostato", "Moved"));
  } else {
    const id = m.el.dataset.id, O = proprietari(pos, P.stanze);
    conAnnulla(f, mm => { const it = (mm.arredo || []).find(x => x.id === id); if (!it) return; const g = ingombro(it.k, it.r);
      /* la stanza è quella dove cade il centro del mobile (se cade fuori, resta quella di prima) */
      const a = O.get(Math.floor(m.ult.cx + g.w / 2) + "," + Math.floor(m.ult.cy + g.d / 2)) || it.a, R = pos[a] || pos[it.a];
      it.a = pos[a] ? a : it.a; it.x = q(m.ult.cx - R.x); it.y = q(m.ult.cy - R.y); }, "↕ " + t("Spostato", "Moved"));
  }
}
document.addEventListener("pointerup", e => { if (MV && e.pointerId === MV.id) { if (!MV.su && MV.el.dataset.mv === "arr") { const id = MV.el.dataset.id; clearTimeout(MV.t); MV = null; SEL = SEL === id ? null : id; render(true); return; } lascia(true); } }, true);
document.addEventListener("pointercancel", e => { if (MV && e.pointerId === MV.id) lascia(false); }, true);
document.addEventListener("keydown", e => { if (MV?.su && e.key === "Escape") lascia(false); });
window.addEventListener("click", e => { if (Date.now() - mangiaMv < 450) { mangiaMv = 0; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("contextmenu", e => { if (MV) e.preventDefault(); }, true);

/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("La pianta della casa disegnata dalle stanze, con luci, temperatura e finestre aperte in ogni stanza.", "The floor plan drawn from your rooms, with lights, temperature and open windows in each room."),
  serve: t("Le aree di Home Assistant (le stanze), con i dispositivi assegnati.", "Home Assistant areas (your rooms), with devices assigned."),
  passi: [t("Impostazioni → Aree, etichette e zone → Crea area: una per stanza (e i piani, se la casa ne ha più d'uno).", "Settings → Areas, labels & zones → Create area: one per room (and the floors, if your home has more than one)."),
    t("Apri ogni dispositivo e scegli la sua area: la mappa si disegna da sola.", "Open each device and choose its area: the map draws itself.")],
  link: [[t("Aree di Home Assistant", "Home Assistant areas"), myHA("areas")]] };
page("mappa", { richiede: RICHIEDE, title: t("Mappa", "Map"), short: t("Mappa", "Map"), icon: "🗺️", order: 5, editable: true, show: () => Object.keys(AREAS).length > 0 || isAdmin(), render: pagina, after: monta3d });

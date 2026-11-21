/* 'Nduja Dashboard — trascina e sposta: un solo modo di riordinare, per tutta la plancia.
   Come si usa da una pagina:
     - il contenitore dell'elenco ha data-tr="tipo" (e, se serve, data-trc="contesto": la stanza, il piano, la scheda…);
     - ogni elemento che si sposta ha data-tri="id"; data-trfine segna un pulsante che resta in fondo (＋, «Altro»);
     - TRASCINA[tipo] = { attivo(), salva(info), maniglia?, gruppo?, puo?(da, a), nome?(id) }.
   Col mouse basta trascinare; col dito (o la penna) si prende con una pressione lunga, così la pagina scorre come sempre.
   Al rilascio salva subito e compare «Annulla». Esc, o lasciarlo fuori posto, annulla. Mentre si trascina quell'elenco
   non viene ridisegnato (data-drag, vedi morph in core.js). ▲▼ e ◀▶ restano per la tastiera. */
import { LAYOUT, UI, PAGES, t, toast, render, isAdmin, leggera, ordineNav, visible } from "./core.js";
import { cambia } from "./edit.js";

/** tipi di elenco trascinabili: { attivo, salva, maniglia, gruppo, puo, nome } */
export const TRASCINA = {};
/** di solito si trascina solo in ✏️ Modifica, da amministratore */
export const inModifica = () => UI.edit && isAdmin();

const PRESA_MS = 350, SOGLIA_MOUSE = 6, SOGLIA_DITO = 9, BORDO = 64;
const fermo = () => leggera() || matchMedia("(prefers-reduced-motion: reduce)").matches;
let P = null;        // pressione in attesa (non ancora sollevato)
let D = null;        // trascinamento in corso
let mangiaClic = 0;  // dopo il rilascio il clic non deve aprire niente

/* ---------- aiuti per l'ordine ---------- */
/** rimette in `tutti` gli id di `nuovi` nell'ordine nuovo, ai posti che occupavano (gli altri restano dove sono) */
export function riordina(tutti, nuovi) {
  const N = new Set(nuovi), resto = nuovi.filter(x => tutti.includes(x)); let k = 0;
  const out = tutti.map(x => N.has(x) ? resto[k++] : x);
  return [...out, ...nuovi.filter(x => !tutti.includes(x))];
}
/** salva l'ordine scelto di un elenco della plancia in LAYOUT.ordine[chiave] (vedi ordina() in core.js) */
export const salvaOrdine = (chiave, tutti, nuovi) => cambia(l => {
  const vecchio = l.ordine?.[chiave] || [], nuovo = riordina(tutti, nuovi);
  l.ordine = { ...(l.ordine || {}), [chiave]: [...nuovo, ...vecchio.filter(x => !nuovo.includes(x))] };
});

/* ---------- dove sono le cose ---------- */
const elementi = box => [...box.children].filter(e => e.dataset?.tri != null && e !== D?.el);
const dentro = (r, x, y, m = 0) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
const visibile = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
/** i contenitori dove può andare: lo stesso, o tutti quelli dello stesso tipo se il tipo ha gruppo */
function contenitori(box, h) {
  if (!h.gruppo) return [box];
  const radice = box.closest("#sheet") || box.closest("#main") || document;
  return [...radice.querySelectorAll(`[data-tr="${CSS.escape(box.dataset.tr)}"]`)].filter(b => b === box || visibile(b));
}
/** il primo antenato che scorre (o la finestra) */
function scorrevole(el, asse) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const s = getComputedStyle(n), o = asse === "y" ? s.overflowY : s.overflowX;
    if (/(auto|scroll)/.test(o) && (asse === "y" ? n.scrollHeight > n.clientHeight + 2 : n.scrollWidth > n.clientWidth + 2)) return n;
  }
  return asse === "y" ? window : null;
}

/* ---------- inizio: pressione ---------- */
document.addEventListener("pointerdown", e => {
  if (D || (e.pointerType === "mouse" && e.button !== 0)) return;
  const it = e.target.closest?.("[data-tri]"), box = it?.parentElement;
  if (!it || !box?.dataset?.tr) return;
  const h = TRASCINA[box.dataset.tr]; if (!h || !(h.attivo ? h.attivo(box) : inModifica())) return;
  if (e.target.closest("input,select,textarea,[contenteditable],[data-lug]:not([data-lug='t']),[data-tpg]")) return;
  if (h.maniglia && !e.target.closest(h.maniglia)) return;
  const dito = e.pointerType !== "mouse";
  P = { it, box, h, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dito };
  if (dito) P.timer = setTimeout(() => { if (P && P.it === it) { try { navigator.vibrate?.(12); } catch {} solleva(); } }, PRESA_MS);
}, true);
document.addEventListener("pointermove", e => {
  if (P && e.pointerId === P.id) {
    P.x = e.clientX; P.y = e.clientY;
    const d = Math.hypot(e.clientX - P.x0, e.clientY - P.y0);
    if (P.dito) { if (d > SOGLIA_DITO) annullaPresa(); }   // si sta scorrendo la pagina
    else if (d > SOGLIA_MOUSE) solleva();
    return;
  }
  if (D && e.pointerId === D.pid) { punta(e); segui(); }
}, { passive: true });
/** dove punta il dito; negli elenchi in colonna (uno solo) l'elemento va solo su e giù */
function punta(e) { D.x = D.soloY ? D.x0 : e.clientX; D.y = e.clientY; }
document.addEventListener("pointerup", e => {
  if (P && e.pointerId === P.id) { annullaPresa(); return; }
  if (D && e.pointerId === D.pid) { punta(e); rilascia(); }
}, true);
document.addEventListener("pointercancel", e => {
  if (P && e.pointerId === P.id) annullaPresa();
  if (D && e.pointerId === D.pid) fine(false);
}, true);
/* col dito, una volta sollevato, la pagina non deve scorrere sotto */
document.addEventListener("touchmove", e => { if (D) e.preventDefault(); }, { passive: false });
/* niente menu della pressione lunga, niente trascinamento nativo di link e immagini */
document.addEventListener("contextmenu", e => { if (P || D) e.preventDefault(); }, true);
document.addEventListener("dragstart", e => { if (P || D || e.target.closest?.("[data-tr] [data-tri]") && document.body.classList.contains("editing")) e.preventDefault(); }, true);
window.addEventListener("click", e => { if (Date.now() - mangiaClic < 450) { mangiaClic = 0; e.stopPropagation(); e.preventDefault(); } }, true);
window.addEventListener("keydown", e => { if (D && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fine(false); } }, true);
function annullaPresa() { if (P) clearTimeout(P.timer); P = null; }

/* ---------- sollevare ---------- */
function solleva() {
  const p = P; P = null; if (!p) return; clearTimeout(p.timer);
  const { it: el, box, h } = p;
  if (!el.isConnected) return;
  const r = el.getBoundingClientRect(), cs = foto(el), dentroEl = el.firstElementChild ? getComputedStyle(el.firstElementChild) : cs;
  const ph = document.createElement(el.tagName === "SECTION" ? "section" : "div");
  ph.className = "tr1ph"; ph.setAttribute("aria-hidden", "true");
  misura(ph, box, r.width, r.height, cs);
  ph.style.borderRadius = parseFloat(cs.raggio) ? cs.raggio : dentroEl.borderRadius;
  const C = contenitori(box, h);
  C.forEach(b => { b.dataset.drag = "1"; if (getComputedStyle(b).position === "static") { b.style.position = "relative"; b.dataset.trpos = "1"; } });
  el.before(ph);
  D = { el, box, h, ph, C, pid: p.id, x: p.x, y: p.y, dx: p.x - r.left, dy: p.y - r.top, w: r.width, h0: r.height,
    da: box, daCtx: box.dataset.trc || "", prima: elementi(box).map(x => x.dataset.tri), primaTutti: C.map(b => elementi(b).map(x => x.dataset.tri)),
    i0: elementi(box).indexOf(el), w0: r.width, h0: r.height, cs0: cs, dx0: p.x - r.left, dy0: p.y - r.top, ultimo: 0, lx: p.x, ly: p.y, no: null, dito: p.dito, max: { x: new Map(), y: new Map() } };
  D.i0 = D.prima.indexOf(el.dataset.tri); D.x0 = p.x; D.soloY = C.length === 1 && !inRiga(box);
  Object.assign(el.style, { position: "absolute", width: r.width + "px", height: r.height + "px", margin: "0", left: "0", top: "0", zIndex: "40", gridColumn: "auto", gridRow: "auto", borderRadius: ph.style.borderRadius });
  el.classList.add("tr1su"); if (fermo()) el.classList.add("tr1fermo");
  document.body.classList.add("tr1on");
  try { window.getSelection()?.removeAllRanges(); } catch {}
  posiziona(); alza();
  D.raf = requestAnimationFrame(ciclo);
}
/** l'elemento sollevato passa sopra le schede vicine: ogni scheda (vetro) è un livello a sé, alzo quelle che lo contengono */
function alza() {
  document.querySelectorAll(".tr1alto").forEach(n => n.classList.remove("tr1alto"));
  if (!D) return;
  for (let n = D.el.parentElement; n && !["MAIN", "BODY"].includes(n.tagName) && n.id !== "sheet"; n = n.parentElement) n.classList.add("tr1alto");
}
/** come sta un elemento nel suo contenitore (colonne della griglia, flex, angoli): fotografato prima di sollevarlo */
function foto(el) {
  const s = getComputedStyle(el);
  return { colonne: s.gridColumnStart.startsWith("span") || s.gridColumnEnd.startsWith("span") ? s.gridColumn : "", flex: s.flex, raggio: s.borderRadius };
}
/** il segnaposto ha la misura dell'elemento: nelle griglie prende la cella (e le colonne), negli elenchi la larghezza */
function misura(ph, box, w, h, cs) {
  const griglia = getComputedStyle(box).display.includes("grid");
  ph.style.height = h + "px";
  ph.style.width = griglia ? "" : w + "px";
  if (cs) { ph.style.gridColumn = cs.colonne; ph.style.flex = cs.flex; }
}
/** l'elemento segue il dito: è dentro il suo contenitore (position:absolute), così tiene il suo aspetto */
function posiziona() {
  const { el } = D, b = el.offsetParent || D.box, r = b.getBoundingClientRect();
  el.style.left = (D.x - D.dx - r.left - b.clientLeft + b.scrollLeft) + "px";
  el.style.top = (D.y - D.dy - r.top - b.clientTop + b.scrollTop) + "px";
}

/* ---------- mentre si trascina ---------- */
function segui() { if (!D) return; posiziona(); cerca(); }
function ciclo() {
  if (!D) return;
  scorri(); posiziona(); cerca();
  D.raf = requestAnimationFrame(ciclo);
}
/** vicino ai bordi la pagina (o il foglio, o la barra) scorre da sola */
function scorri() {
  const { x, y } = D;
  for (const asse of ["y", "x"]) {
    const s = scorrevole(D.ph.parentElement || D.box, asse); if (!s) continue;
    const r = s === window ? { top: 0, left: 0, bottom: innerHeight, right: innerWidth } : s.getBoundingClientRect();
    const a = asse === "y" ? y : x, lo = asse === "y" ? r.top : r.left, hi = asse === "y" ? r.bottom : r.right;
    const bordo = Math.min(BORDO, (hi - lo) / 4), basso = asse === "y" && s === window && innerWidth <= 860 ? bordo + 70 : bordo;   // sul telefono c'è la barra in basso
    let v = 0;
    if (a < lo + bordo) v = -Math.ceil((lo + bordo - a) / bordo * 16);
    else if (a > hi - basso) v = Math.ceil((a - (hi - basso)) / basso * 16);
    if (!v) continue;
    v = Math.max(-18, Math.min(18, v));
    /* non oltre la fine di prima: l'elemento sollevato allungherebbe la pagina all'infinito */
    const M = D.max[asse];
    if (!M.has(s)) M.set(s, s === window ? (asse === "y" ? document.documentElement.scrollHeight - innerHeight : document.documentElement.scrollWidth - innerWidth) : (asse === "y" ? s.scrollHeight - s.clientHeight : s.scrollWidth - s.clientWidth));
    const ora = s === window ? (asse === "y" ? scrollY : scrollX) : (asse === "y" ? s.scrollTop : s.scrollLeft);
    if (v > 0) v = Math.min(v, M.get(s) - ora); if (v <= 0 && ora + v < 0) v = -ora;
    if (!v) continue;
    if (s === window) asse === "y" ? scrollBy(0, v) : scrollBy(v, 0); else asse === "y" ? s.scrollTop += v : s.scrollLeft += v;
  }
}
/** gli elementi del contenitore stanno in riga (barre, griglie a più colonne) o in colonna? */
function inRiga(box) {
  const s = getComputedStyle(box);
  if (s.display.includes("grid")) return s.gridTemplateColumns.trim().split(/\s+/).length > 1;
  return s.display.includes("flex") && s.flexDirection.startsWith("row");
}
/** quanti elementi stanno prima del segnaposto nel suo contenitore */
const postoOra = L => L.filter(e => e.compareDocumentPosition(D.ph) & Node.DOCUMENT_POSITION_FOLLOWING).length;
/** trova dove va il segnaposto */
function cerca() {
  const { x, y, h } = D;
  const box = D.C.find(b => dentro(b.getBoundingClientRect(), x, y, 14));
  D.el.classList.toggle("tr1fuori", !box);
  if (!box) { rimettiPosto(); suggerimento(null); return; }
  if (box !== D.ph.parentElement) {
    const no = box !== D.da && h.puo ? h.puo(D.daCtx, box.dataset.trc || "") : true;
    if (no !== true) { rimettiPosto(); suggerimento(no); return; }
  }
  suggerimento(null);
  /* aspetto che il dito si sposti un po' dopo ogni cambio: con elementi di misure diverse non salta avanti e indietro */
  if (performance.now() - D.ultimo < 110 && Math.hypot(x - D.lx, y - D.ly) < 12) return;
  const L = elementi(box), riga = inRiga(box);
  let k = null;
  for (let i = 0; i < L.length; i++) {
    const r = L[i].getBoundingClientRect(); if (!dentro(r, x, y)) continue;
    k = (riga ? x > r.left + r.width / 2 : y > r.top + r.height / 2) ? i + 1 : i; break;
  }
  if (k == null) {
    if (!L.length) k = 0;
    else {
      const f = L[0].getBoundingClientRect(), u = L[L.length - 1].getBoundingClientRect();
      if (y < f.top || (riga && y < f.bottom && x < f.left)) k = 0;
      else if (y > u.bottom || (riga && y > u.top && x > u.right)) k = L.length;
    }
  }
  if (k == null || (D.ph.parentElement === box && postoOra(L) === k)) return;
  sposta(box, k, L);
}
/** mette il segnaposto al posto k (0 = primo) di un contenitore, con gli altri che si fanno da parte */
function metti(box, k, L) {
  if (k < L.length) box.insertBefore(D.ph, L[k]);
  else if (L.length) L[L.length - 1].after(D.ph);
  else box.insertBefore(D.ph, box.querySelector(":scope > [data-trfine], :scope > .add1") || null);
}
function sposta(box, k, L) {
  const prima = fermo() ? null : new Map(D.C.flatMap(elementi).map(e => [e, e.getBoundingClientRect()]));
  if (box !== D.ph.parentElement) {
    /* in un altro contenitore (per esempio dalla barra in basso al menu «Altro»): prendo la misura dei suoi elementi */
    const m = L[0] || null, r = m?.getBoundingClientRect();
    if (r) dimensioni(box, r.width, r.height, foto(m)); else dimensioni(box, D.w0, D.h0, D.cs0);
    box.appendChild(D.el); alza();
  }
  metti(box, k, L);
  D.ultimo = performance.now(); D.lx = D.x; D.ly = D.y;
  posiziona();
  if (prima) anima(prima);
}
/** misura del segnaposto e dell'elemento sollevato */
function dimensioni(box, w, h, cs) {
  misura(D.ph, box, w, h, cs);
  Object.assign(D.el.style, { width: w + "px", height: h + "px" });
  D.dx = Math.min(D.dx0, w - 8); D.dy = Math.min(D.dy0, h - 8);
}
/** gli altri elementi scivolano al loro posto nuovo (FLIP) */
function anima(prima) {
  for (const [e, a] of prima) {
    const b = e.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if ((Math.abs(dx) > .5 || Math.abs(dy) > .5) && e.animate) e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 170, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
}
/** il segnaposto torna dove era all'inizio (fuori posto, o in un contenitore dove non può andare) */
function rimettiPosto() {
  const box = D.da, L = elementi(box);
  if (D.ph.parentElement === box && postoOra(L) === D.i0) return;
  const prima = fermo() ? null : new Map(D.C.flatMap(elementi).map(e => [e, e.getBoundingClientRect()]));
  if (box !== D.ph.parentElement) { dimensioni(box, D.w0, D.h0, D.cs0); box.appendChild(D.el); alza(); }
  metti(box, D.i0, L);
  posiziona(); if (prima) anima(prima);
}
/** una riga sopra l'elemento quando lì non può andare */
function suggerimento(msg) {
  if (D.no === msg) return; D.no = msg;
  D.el.querySelector(":scope > .tr1no")?.remove();
  if (msg) D.el.insertAdjacentHTML("beforeend", `<span class="tr1no" role="status"></span>`), D.el.lastElementChild.textContent = msg;
}

/* ---------- rilascio ---------- */
function rilascia() {
  const { x, y } = D;
  const fuori = !D.C.some(b => dentro(b.getBoundingClientRect(), x, y, 14)) || D.no;
  fine(!fuori);
}
/** chiude il trascinamento: ok = salva il posto nuovo, altrimenti torna com'era */
function fine(ok) {
  const d = D; if (!d) return; D = null;
  cancelAnimationFrame(d.raf);
  mangiaClic = Date.now();
  const msg = d.no;
  if (!ok) { D = d; if (d.ph.parentElement !== d.da) d.da.appendChild(d.el); metti(d.da, d.i0, elementi(d.da)); D = null; }
  const r0 = d.el.getBoundingClientRect();
  d.ph.replaceWith(d.el);
  d.el.querySelector(":scope > .tr1no")?.remove();
  for (const k of ["position", "width", "height", "margin", "left", "top", "zIndex", "gridColumn", "gridRow", "borderRadius"]) d.el.style[k] = "";
  d.el.classList.remove("tr1su", "tr1fuori", "tr1fermo"); document.body.classList.remove("tr1on"); alza();
  if (!fermo() && d.el.animate) { const r1 = d.el.getBoundingClientRect(); d.el.animate([{ transform: `translate(${r0.left - r1.left}px,${r0.top - r1.top}px)` }, { transform: "none" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }); }
  const sblocca = () => { d.C.forEach(b => { delete b.dataset.drag; if (b.dataset.trpos) { b.style.position = ""; delete b.dataset.trpos; } }); render(true); };
  const dopoTutti = d.C.map(b => elementi(b).map(x => x.dataset.tri));
  if (!ok || JSON.stringify(dopoTutti) === JSON.stringify(d.primaTutti)) { if (msg && !ok) toast(msg); sblocca(); return; }
  const a = d.el.parentElement, info = { id: d.el.dataset.tri, da: d.daCtx, a: a?.dataset.trc || "", ids: elementi(a).map(x => x.dataset.tri),
    gruppi: d.C.map((b, i) => ({ ctx: b.dataset.trc || "", ids: dopoTutti[i] })) };
  salva(d.h, info).finally(sblocca);
}
/** salva e offre «Annulla»: rimette le scelte toccate com'erano (o chiama l'annulla del tipo, se lo dà) */
async function salva(h, info) {
  const prima = JSON.parse(JSON.stringify(LAYOUT));
  let r;
  try { r = await h.salva(info); } catch (e) { toast(t("Non spostato: ", "Not moved: ") + (e?.message || e?.code || e), true); return; }
  const nome = h.nome?.(info.id) || "";
  const testo = "↕ " + (nome ? t("Spostato: ", "Moved: ") + nome : t("Spostato", "Moved"));
  if (typeof r === "function") { toast(testo, false, [t("Annulla", "Undo"), r]); return; }
  const K = [...new Set([...Object.keys(prima), ...Object.keys(LAYOUT)])].filter(k => JSON.stringify(prima[k]) !== JSON.stringify(LAYOUT[k]));
  if (!K.length) return;
  toast(testo, false, [t("Annulla", "Undo"), () => cambia(l => { for (const k of K) { if (k in prima) l[k] = prima[k]; else delete l[k]; } }, "↶ " + t("Come prima", "Back as it was"))]);
}

/* ---------- pagine del menu (barra laterale, barra in basso del telefono, «Altro») ----------
   Vale per tutti (LAYOUT.navOrder); le pagine nascoste a qualcuno restano nascoste. Sul telefono le prime 4 sono la barra in basso:
   portare una pagina da «Altro» alla barra (o viceversa) la sposta tra le prime 4. */
TRASCINA.nav = {
  gruppo: true,
  nome: k => PAGES[k]?.title || k,
  salva: ({ gruppi }) => {
    const ord = { rail: 0, bar: 1, altro: 2 }, nuovi = [...gruppi].sort((a, b) => (ord[a.ctx] ?? 9) - (ord[b.ctx] ?? 9)).flatMap(g => g.ids);
    const vis = riordina(visible(), nuovi);
    return cambia(l => { l.navOrder = riordina(ordineNav(), vis); });
  },
};

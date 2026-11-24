/* 'Nduja Dashboard — schede oggetto: ogni oggetto della casa (cancello, porta con serratura, robot, clima, elettrodomestici…)
   si apre in un foglio grande con il suo disegno al centro, che si muove con lo stato vero, e una frase in alto, come se
   l'oggetto parlasse. Sotto, pochi comandi grandi e una riga con i dati; il resto è nella sua pagina («Altro»).
   Le pagine registrano i loro oggetti con registra(tipo, def): qui ci sono il foglio, i gesti (tocco, tocco lungo,
   trascinamento del quadrante), la scheda della Home «Oggetti in primo piano» e la scelta per dispositivo
   «Apri gli oggetti come schede grandi» (⚙️ Impostazioni → Questo dispositivo, sGet("oggetti"): "0" = pannelli di prima).

   def = { nome(), icona, ordine, pagina, elenco() → [id], esiste(id), titolo(id), luogo(id), frase(id) (html con <em>),
           disegno(id, misura "xl" | "sm"), centro(id) (facoltativo: al posto del disegno, per esempio il quadrante del clima),
           stato(id) ("ok" | "warn" | "run" | "bad" | "na": il colore della scheda), comandi(id) → [pulsante], dati(id) → [[icona, testo, classe]],
           extra(id) (html sotto i comandi), gesti(id) → { tocco, lungo, aiuto }, imposta(id, valore, quale) (quadrante), altro(id) (facoltativo) }
   pulsante = { act, id, v, ic, txt, pri, tieni: "frase" (si tiene premuto: serve per sbloccare e spegnere), off (disattivato), cls } */
import { ACT, CHG, LAYOUT, fnum, UI, HOME_EXTRA, t, esc, sGet, sSet, openSheet, closeSheet, render, go, isAdmin, toast, sicuro, card, PAGES, utenteCfg } from "./core.js";
import { cambia } from "./edit.js";

export const OGGETTI = {};
/** registra un tipo di oggetto (lo fanno le pagine) */
export function registra(tipo, def) { OGGETTI[tipo] = { ordine: 50, icona: "•", gesti: () => ({}), dati: () => [], comandi: () => [], stato: () => "", ...def }; render(); }
const parti = k => { const i = String(k || "").indexOf(":"); return i < 0 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)]; };
const defDi = k => OGGETTI[parti(k)[0]] || null;
const esiste = k => { const d = defDi(k); try { return !!d && d.esiste(parti(k)[1]); } catch { return false; } };

/** schede grandi accese su questo dispositivo (di partenza sì) */
export const schedeGrandi = () => sGet("oggetti") !== "0";
/** avvolge il disegno di un oggetto: con le schede grandi accese diventa un pulsante che apre la scheda (non in ✏️ Modifica) */
export function tocca(k, html, label = "", cls = "") {
  if (!schedeGrandi() || UI.edit || !esiste(k)) return html;
  return `<button class="og1tp ${cls}" data-act="ogApri" data-k="${esc(k)}" aria-label="${esc(t("Apri la scheda di ", "Open the card of ") + label)}" title="${esc(label)}">${html}</button>`;
}

/* ---------- parole che servono a tutte le frasi ---------- */
/** quanto tempo, a parole: «un minuto», «7 minuti», «un'ora e mezza», «3 ore», «2 giorni» */
export function quanto(sec) {
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 1) return t("pochi secondi", "a few seconds");
  if (m === 1) return t("un minuto", "a minute");
  if (m < 60) return m + t(" minuti", " minutes");
  const h = m / 60;
  if (h < 1.25) return t("un'ora", "an hour");
  if (h < 1.75) return t("un'ora e mezza", "an hour and a half");
  if (h < 24) return Math.round(h) + t(" ore", " hours");
  const g = Math.round(h / 24);
  return g === 1 ? t("un giorno", "a day") : g + t(" giorni", " days");
}
/** fra quanto, a parole e arrotondato come lo direbbe una persona: «in qualche minuto», «in una ventina di minuti», «in circa un'ora» */
export function fraPoco(min) {
  if (min == null || !isFinite(min) || min < 0) return "";
  if (min < 3) return t("tra pochissimo", "any minute now");
  if (min < 8) return t("in qualche minuto", "in a few minutes");
  if (min < 13) return t("in una decina di minuti", "in about ten minutes");
  if (min < 17) return t("in un quarto d'ora", "in a quarter of an hour");
  if (min < 25) return t("in una ventina di minuti", "in about twenty minutes");
  if (min < 38) return t("in una mezz'ora", "in about half an hour");
  if (min < 52) return t("in una quarantina di minuti", "in about forty minutes");
  if (min < 75) return t("in circa un'ora", "in about an hour");
  if (min < 105) return t("in un'ora e mezza", "in an hour and a half");
  return t("in circa ", "in about ") + Math.round(min / 60) + t(" ore", " hours");
}
/** la parte che cambia, evidenziata */
export const em = s => `<em>${esc(s)}</em>`;

/* ---------- il foglio grande ---------- */
let K = null;
const aiutoVisto = tipo => sGet("ogAiuto_" + tipo) === "1";
const segnaAiuto = tipo => { if (!aiutoVisto(tipo)) { sSet("ogAiuto_" + tipo, "1"); render(); } };
function bottone(b) {
  const da = `${b.id != null ? ` data-id="${esc(b.id)}"` : ""}${b.v != null ? ` data-v="${esc(b.v)}"` : ""}`;
  /* da tenere premuto: niente data-act (il clic normale non deve partire), ci pensa il gesto qui sotto */
  if (b.tieni) return `<button class="og1k tieni ${b.pri ? "pri" : ""} ${b.cls || ""}" data-oact="${b.act}"${da} data-tieni="${esc(b.tieni)}" ${b.off ? "disabled" : ""}><i>${b.ic || ""}</i><span>${esc(b.txt)}</span><s></s></button>`;
  return `<button class="og1k ${b.pri ? "pri" : ""} ${b.cls || ""}" data-act="${b.act}"${da} ${b.off ? "disabled" : ""}><i>${b.ic || ""}</i><span>${esc(b.txt)}</span></button>`;
}
function foglio() {
  const [tipo, id] = parti(K), d = OGGETTI[tipo];
  if (!d || !esiste(K)) return `<div class="sh-head"><div><h3>${t("Non c'è più", "It's gone")}</h3><div class="small muted">${t("Questo oggetto non è più nella plancia.", "This object is no longer on the dashboard.")}</div></div><button class="x" data-act="sheetClose">×</button></div>`;
  const g = d.gesti(id) || {}, fa = !!(g.tocco || g.lungo), st = d.stato(id) || "", luogo = d.luogo?.(id) || "";
  const B = (d.comandi(id) || []).filter(Boolean), D = (d.dati(id) || []).filter(Boolean);
  const centro = d.centro?.(id) || `<div class="og1g ${fa ? "ges" : ""}" ${fa ? `data-og="${esc(K)}" role="button" tabindex="0" aria-label="${esc(g.aiuto || d.titolo(id))}"` : ""}>
      ${d.disegno(id, "xl")}${g.lungo ? `<svg class="og1r" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="98" height="98" rx="7" pathLength="100"/></svg>` : ""}</div>`;
  const aiuto = g.aiuto && !aiutoVisto(tipo) ? `<div class="og1a"><span>👆 ${esc(g.aiuto)}</span><button data-act="ogAiutoOk" data-v="${tipo}" aria-label="${t("Ho capito", "Got it")}">✕</button></div>` : "";
  return `<div class="og1 og-${tipo} st-${st || "na"}">
    <div class="og1h"><div class="og1n"><b>${esc(d.titolo(id))}</b>${luogo ? `<small>${esc(luogo)}</small>` : ""}</div>
      <button class="btn sm" data-act="ogAltro">⋯ ${t("Altro", "More")}</button><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    <p class="og1f" aria-live="polite">${d.frase(id) || ""}</p>
    <div class="og1c">${centro}${d.angolo?.(id) || ""}</div>
    <div class="og1p">${aiuto}
      ${B.length ? `<div class="og1b n${Math.min(B.length, 4)}">${B.map(bottone).join("")}</div>` : ""}
      ${D.length ? `<div class="og1d">${D.map(([ic, tx, cls]) => `<span class="${cls || ""}">${ic ? `<i>${ic}</i>` : ""}${tx}</span>`).join("")}</div>` : ""}
      ${d.extra?.(id) || ""}</div>
  </div>`;
}
/** apre la scheda grande di un oggetto (chiave «tipo:id»); con le schede grandi spente va alla sua pagina */
export function apriOggetto(k) {
  const d = defDi(k); if (!d) return;
  if (!schedeGrandi()) { if (d.pagina) go(d.pagina); return; }
  K = k; openSheet(foglio);
}
Object.assign(ACT, {
  ogApri: el => apriOggetto(el.dataset.k),
  ogAltro: () => { const [tipo, id] = parti(K), d = OGGETTI[tipo]; closeSheet(); if (!d) return;
    if (d.altro) return d.altro(id);
    if (d.pagina && UI.page !== d.pagina && paginaVisibile(d.pagina)) go(d.pagina); },
  ogAiutoOk: el => segnaAiuto(el.dataset.v),
});

/* ---------- gesti: tocco e tocco lungo sul disegno, pulsanti da tenere premuti ---------- */
const LUNGO = 650, TIENI = 900;
let G = null;
const fine = () => { if (!G) return; clearTimeout(G.t); G.el.classList.remove("hold"); G = null; };
const vibra = () => { try { navigator.vibrate?.(18); } catch {} };
function esegui(f, tipo) { try { f(); } catch (e) { console.error(e); } segnaAiuto(tipo); }
document.addEventListener("pointerdown", e => {
  if (e.button > 0) return;
  const tk = e.target.closest?.(".og1k.tieni");
  if (tk && !tk.disabled) {
    fine(); G = { el: tk, x: e.clientX, y: e.clientY, tieni: true };
    tk.classList.add("hold"); tk.style.setProperty("--td", TIENI + "ms");
    G.t = setTimeout(() => { const el = G?.el; if (!el) return; G.fatto = true; el.classList.remove("hold"); vibra(); esegui(() => ACT[el.dataset.oact]?.(el), parti(K)[0]); }, TIENI);
    return;
  }
  const el = e.target.closest?.(".og1g[data-og]"); if (!el) return;
  const [tipo, id] = parti(el.dataset.og), g = OGGETTI[tipo]?.gesti(id) || {};
  fine(); G = { el, x: e.clientX, y: e.clientY, g, tipo };
  if (g.lungo) { el.classList.add("hold"); G.t = setTimeout(() => { if (!G) return; G.fatto = true; G.el.classList.remove("hold"); vibra(); esegui(g.lungo, tipo); }, LUNGO); }
});
document.addEventListener("pointermove", e => { if (G && Math.hypot(e.clientX - G.x, e.clientY - G.y) > 14) fine(); }, { passive: true });
document.addEventListener("pointerup", () => {
  if (!G) return; const g = G;
  clearTimeout(g.t); g.el.classList.remove("hold"); G = null;
  if (g.fatto) return;
  if (g.tieni) return toast("✋ " + g.el.dataset.tieni);
  if (g.g.tocco) esegui(g.g.tocco, g.tipo);
  else if (g.g.lungo) toast("✋ " + (g.g.aiuto || t("Tieni premuto", "Press and hold")));
});
document.addEventListener("pointercancel", fine);
document.addEventListener("contextmenu", e => { if (e.target.closest?.(".og1g,.og1k.tieni,.og1q")) e.preventDefault(); });
/* da tastiera: Invio sul disegno è il tocco; un pulsante da tenere premuto chiede un secondo Invio (come il doppio tocco di conferma) */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest?.(".og1g[data-og]"); if (!el) return;
  e.preventDefault(); const [tipo, id] = parti(el.dataset.og), g = OGGETTI[tipo]?.gesti(id) || {};
  if (g.tocco) esegui(g.tocco, tipo);
});
document.addEventListener("click", e => {
  const el = e.target.closest?.(".og1k.tieni"); if (!el || e.detail !== 0 || el.disabled) return;   // detail 0 = da tastiera
  if (sicuro(el, t("Premi ancora per confermare", "Press again to confirm"))) esegui(() => ACT[el.dataset.oact]?.(el), parti(K)[0]);
});

/* ---------- quadrante da trascinare (temperatura del clima) ----------
   quadrante(k, { min, max, step, v, v2 (secondo valore, facoltativo), stanza (temperatura della stanza), colore, dentro (html al centro), sotto (riga piccola) })
   Durante il trascinamento il disegno si aggiorna da solo (data-drag: la pagina non lo ridisegna); al rilascio chiama def.imposta(id, valore, quale). */
const A0 = 135, GIRO = 270, CX = 120, CY = 120, R = 102;
const pendenti = {};   // valori appena scelti, finché Home Assistant non li conferma
const pt = a => [CX + R * Math.cos(a * Math.PI / 180), CY + R * Math.sin(a * Math.PI / 180)];
const angolo = (o, v) => A0 + GIRO * Math.min(1, Math.max(0, (v - o.min) / (o.max - o.min || 1)));
const arco = (a1, a2) => { if (a2 - a1 < .01) return ""; const [x1, y1] = pt(a1), [x2, y2] = pt(a2); return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; };
const dec = o => o.step < 1 ? 1 : 0;
const testoV = (o, v) => v == null ? "—" : fnum(+v, dec(o)) + "°";
function pezziQuadrante(o, v, v2) {
  const due = v2 != null, a = angolo(o, v), a2 = due ? angolo(o, v2) : null;
  const [kx, ky] = pt(a), [k2x, k2y] = due ? pt(a2) : [0, 0];
  const s = o.stanza != null && o.stanza >= o.min && o.stanza <= o.max ? pt(angolo(o, o.stanza)) : null;
  return { pieno: due ? arco(a, a2) : arco(A0, a), k: [kx, ky], k2: due ? [k2x, k2y] : null, s };
}
export function quadrante(k, o) {
  const p = pendenti[k], fresco = p && Date.now() - p.t < 6000;
  const v = fresco ? p.v : o.v, v2 = fresco && p.v2 !== undefined ? p.v2 : o.v2, Q = pezziQuadrante(o, v, v2);
  const manopola = (c, cls, q, val) => `<g class="og1m ${cls}" data-q="${q}" role="slider" tabindex="0" aria-label="${esc(o.nomi?.[q] || t("Temperatura", "Temperature"))}" aria-valuemin="${o.min}" aria-valuemax="${o.max}" aria-valuenow="${val}"><circle class="mh" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="22"/><circle class="mk" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="12"/></g>`;
  return `<div class="og1q ${o.off ? "spento" : ""}" data-og="${esc(k)}" data-min="${o.min}" data-max="${o.max}" data-step="${o.step}" data-v="${v ?? ""}" data-v2="${v2 ?? ""}" style="--qc:${o.colore || "var(--orange)"}">
    <svg viewBox="0 0 240 240" aria-hidden="false"><path class="tr" d="${arco(A0, A0 + GIRO)}"/><path class="pi" d="${Q.pieno}"/>
      ${Q.s ? `<circle class="st" cx="${Q.s[0].toFixed(2)}" cy="${Q.s[1].toFixed(2)}" r="4.5"><title>${esc(t("In stanza", "In the room"))}</title></circle>` : ""}
      ${o.off || v == null ? "" : manopola(Q.k, "m1", 1, v)}${Q.k2 && !o.off ? manopola(Q.k2, "m2", 2, v2) : ""}</svg>
    <div class="og1qd">${o.dentro || ""}</div>
    <div class="og1qv"><b>${o.off ? esc(o.spentoTxt || t("Spento", "Off")) : v2 != null ? testoV(o, v) + " – " + testoV(o, v2) : testoV(o, v)}</b>${o.sotto ? `<small>${o.sotto}</small>` : ""}</div>
  </div>`;
}
/* trascinamento del quadrante */
let Q = null;
function valoreDa(el, e) {
  const r = el.querySelector("svg").getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 240, y = (e.clientY - r.top) / r.height * 240;
  let a = Math.atan2(y - CY, x - CX) * 180 / Math.PI; a = (a + 360) % 360;
  let rel = (a - A0 + 360) % 360; if (rel > GIRO) rel = rel > GIRO + (360 - GIRO) / 2 ? 0 : GIRO;
  const min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step || .5;
  return Math.min(max, Math.max(min, Math.round((min + rel / GIRO * (max - min)) / step) * step));
}
function ridisegna(el, v, v2) {
  const o = { min: +el.dataset.min, max: +el.dataset.max, step: +el.dataset.step }, P = pezziQuadrante(o, v, v2);
  el.querySelector(".pi")?.setAttribute("d", P.pieno);
  const sp = (g, c) => g?.querySelectorAll("circle").forEach(cc => { cc.setAttribute("cx", c[0].toFixed(2)); cc.setAttribute("cy", c[1].toFixed(2)); });
  sp(el.querySelector(".m1"), P.k); if (P.k2) sp(el.querySelector(".m2"), P.k2);
  el.querySelector(".m1")?.setAttribute("aria-valuenow", v); if (v2 != null) el.querySelector(".m2")?.setAttribute("aria-valuenow", v2);
  const b = el.querySelector(".og1qv b"); if (b) b.textContent = v2 != null ? testoV(o, v) + " – " + testoV(o, v2) : testoV(o, v);
}
function conferma(el, q, v) {
  const k = el.dataset.og, [tipo, id] = parti(k), d = OGGETTI[tipo]; if (!d?.imposta) return;
  const cur = { v: +el.dataset.v, v2: el.dataset.v2 === "" ? undefined : +el.dataset.v2 };
  if (q === 2) cur.v2 = v; else cur.v = v;
  pendenti[k] = { ...cur, t: Date.now() };
  try { d.imposta(id, v, q, cur); } catch (e) { console.error(e); }
  segnaAiuto(tipo);
}
document.addEventListener("pointerdown", e => {
  const el = e.target.closest?.(".og1q[data-og]"); if (!el || el.classList.contains("spento") || e.button > 0 || !el.querySelector(".m1")) return;
  const r = el.querySelector("svg").getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 240, y = (e.clientY - r.top) / r.height * 240;
  const dist = Math.hypot(x - CX, y - CY); if (dist < R - 36 || dist > R + 30) return;   // solo sull'anello: il centro resta libero
  const v = +el.dataset.v, v2 = el.dataset.v2 === "" ? null : +el.dataset.v2, nv = valoreDa(el, e);
  const q = v2 != null && Math.abs(nv - v2) < Math.abs(nv - v) ? 2 : 1;
  Q = { el, q, v, v2 }; el.dataset.drag = "1"; el.classList.add("tira"); el.setPointerCapture?.(e.pointerId);
  muovi(e); e.preventDefault();
});
function muovi(e) {
  if (!Q) return; let nv = valoreDa(Q.el, e);
  if (Q.v2 != null) { if (Q.q === 1) nv = Math.min(nv, Q.v2 - (+Q.el.dataset.step || .5)); else nv = Math.max(nv, Q.v + (+Q.el.dataset.step || .5)); }
  if (Q.q === 1) Q.v = nv; else Q.v2 = nv;
  ridisegna(Q.el, Q.v, Q.v2);
}
document.addEventListener("pointermove", muovi, { passive: true });
document.addEventListener("pointerup", () => { if (!Q) return; const { el, q, v, v2 } = Q; Q = null; el.classList.remove("tira"); el.dataset.drag = "";
  const nuovo = q === 1 ? v : v2, prima = q === 1 ? +el.dataset.v : +el.dataset.v2;
  if (nuovo !== prima) conferma(el, q, nuovo); render(); });
document.addEventListener("pointercancel", () => { if (!Q) return; Q.el.classList.remove("tira"); Q.el.dataset.drag = ""; Q = null; render(); });
/* frecce sulla manopola: un passo alla volta, conferma dopo una breve pausa */
let attesaTasti = null;
document.addEventListener("keydown", e => {
  const m = e.target.closest?.(".og1m"); if (!m) return;
  const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (!d) return;
  e.preventDefault(); const el = m.closest(".og1q"), q = +m.dataset.q, step = +el.dataset.step || .5;
  const k = q === 2 ? "v2" : "v", v = Math.min(+el.dataset.max, Math.max(+el.dataset.min, Math.round((+el.dataset[k] + d * step) / step) * step));
  el.dataset[k] = v; el.dataset.drag = "1"; ridisegna(el, +el.dataset.v, el.dataset.v2 === "" ? null : +el.dataset.v2);
  clearTimeout(attesaTasti); attesaTasti = setTimeout(() => { el.dataset.drag = ""; conferma(el, q, v); }, 700);
});

/* ---------- Home: «Oggetti in primo piano» ---------- */
const tutti = () => Object.entries(OGGETTI).sort(([, a], [, b]) => a.ordine - b.ordine).flatMap(([tipo, d]) => { try { return d.elenco().map(id => tipo + ":" + id); } catch { return []; } });
/** senza scelta: uno per tipo (quello acceso o in movimento, se c'è), fino a sei */
function automatici() {
  const out = [];
  for (const [tipo, d] of Object.entries(OGGETTI).sort(([, a], [, b]) => a.ordine - b.ordine)) {
    let L = []; try { L = d.elenco(); } catch {}
    if (!L.length) continue;
    const vivo = L.find(id => ["run", "heat", "cool", "dry", "warn", "bad"].includes(d.stato(id))) || L[0];
    out.push(tipo + ":" + vivo);
  }
  return out.slice(0, 6);
}
const scelti = () => Array.isArray(LAYOUT.oggetti?.home) ? LAYOUT.oggetti.home.filter(esiste) : automatici();
function piccola(k) {
  const [tipo, id] = parti(k), d = OGGETTI[tipo], st = d.stato(id) || "na";
  return `<button class="og1hm st-${st}" data-act="ogApri" data-k="${esc(k)}"><span class="og1hd">${d.disegno(id, "sm")}</span>
    <span class="tx"><b>${esc(d.titolo(id))}</b><span>${d.frase(id) || ""}</span></span></button>`;
}
function homeCard() {
  const L = scelti(); if (!L.length) return "";
  return card("✨ " + t("Oggetti in primo piano", "Featured objects"), `<div class="og1hg">${L.map(piccola).join("")}</div>`, { cls: L.length > 2 ? "span2" : "" });
}
HOME_EXTRA.oggetti = { title: () => t("Oggetti in primo piano", "Featured objects"), render: homeCard, show: () => scelti().length > 0, cfg: "ogCfg" };

/* ⚙️ quali oggetti in primo piano (vale per tutta la casa) */
function cfg() {
  const auto = !Array.isArray(LAYOUT.oggetti?.home), S1 = new Set(scelti()), L = tutti();
  const perTipo = {}; L.forEach(k => (perTipo[parti(k)[0]] = perTipo[parti(k)[0]] || []).push(k));
  return `<div class="sh-head"><div><h3>✨ ${t("Oggetti in primo piano", "Featured objects")}</h3><div class="small muted">${t("Vale per tutta la casa.", "It applies to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <button class="li ${auto ? "sel1" : ""}" data-act="ogAuto"><span class="ic">✨</span><div class="tx"><b>${t("Automatico", "Automatic")}</b><span>${t("Uno per tipo: quello acceso o in movimento, se c'è.", "One per kind: the one that's on or moving, if any.")}</span></div></button>
    <p class="small muted" style="margin:12px 0 6px;line-height:1.45">${t("Oppure scegli tu: nella scheda compaiono nell'ordine di questo elenco. Toccandoli si apre la loro scheda grande.", "Or pick them yourself: they show in the order of this list. Tap one to open its big card.")}</p>
    ${Object.entries(perTipo).map(([tipo, K2]) => `<div class="fl1">${OGGETTI[tipo].icona} ${esc(OGGETTI[tipo].nome())}</div>
      <div class="stack">${K2.map(k => `<label class="li rfc1"><input type="checkbox" data-chg="ogScelta" data-k="${esc(k)}" ${S1.has(k) ? "checked" : ""}><span class="og1cd">${OGGETTI[tipo].disegno(parti(k)[1], "sm")}</span><div class="tx"><b>${esc(OGGETTI[tipo].titolo(parti(k)[1]))}</b><span>${esc(OGGETTI[tipo].luogo?.(parti(k)[1]) || "")}</span></div></label>`).join("")}</div>`).join("")
      || `<div class="empty">${t("Non ho ancora trovato oggetti: cancelli, serrature, robot, clima o elettrodomestici.", "No objects found yet: gates, locks, vacuums, climate or appliances.")}</div>`}`;
}
ACT.ogCfg = () => { if (isAdmin()) openSheet(cfg); };
ACT.ogAuto = () => cambia(l => { if (l.oggetti) { delete l.oggetti.home; if (!Object.keys(l.oggetti).length) delete l.oggetti; } }, "✨ " + t("Oggetti automatici", "Automatic objects"));
CHG.ogScelta = el => { const k = el.dataset.k, on = el.checked, L = tutti(), cur = new Set(scelti());
  if (on) cur.add(k); else cur.delete(k);
  cambia(l => { l.oggetti = { ...(l.oggetti || {}), home: L.filter(x => cur.has(x)) }; }); };

/* la pagina di un oggetto, se chi usa la plancia la può vedere (per «Altro») */
export const paginaVisibile = p => !!PAGES[p] && PAGES[p].show() && LAYOUT.pages?.[p] !== false && utenteCfg().pages?.[p] !== false;

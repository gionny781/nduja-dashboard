/* 'Nduja Dashboard — le luci: tessera grande (colore vero della lampada, alone, luminosità come riempimento),
   gesti (tocco = accendi/spegni, trascina in orizzontale = luminosità, pressione lunga = dettagli),
   foglio dei dettagli (luminosità, bianco, colori con i preferiti, effetti, luci del gruppo), icone disegnate per 'Nduja.
   La tessera compare ovunque ci sia una luce (pagina Luci, stanze della Home, pagine e schede create da te). */
import { S, ACT, LAYOUT, UI, VISTE, t, esc, nm, ok, attr, areaOf, AREAS, shortName, svc, toast, openSheet, closeSheet, render, moreInfo,
  isAdmin, sGet, sSet, luci, membriLuce, isLightGroup, isLightSwitch, saveLayout } from "./core.js";

/* ---------- icone (disegni originali, 24×24; la parte .g si accende col colore della lampada) ---------- */
const P = {
  lampadina: `<path class="g" d="M12 3a6 6 0 0 0-3.7 10.7c.8.7 1.2 1.5 1.2 2.3h5c0-.8.4-1.6 1.2-2.3A6 6 0 0 0 12 3z"/><path d="M9.6 18.6h4.8M10.4 21h3.2"/>`,
  lampadario: `<path d="M12 2v12.4M4.5 10.6c.6 2.6 3.6 3.8 7.5 3.8s6.9-1.2 7.5-3.8M3.2 10.6h2.6M18.2 10.6h2.6"/><path class="g" d="M4.5 5c-1 1.1-1.4 1.9-1.4 2.6a1.4 1.4 0 0 0 2.8 0c0-.7-.4-1.5-1.4-2.6zM19.5 5c-1 1.1-1.4 1.9-1.4 2.6a1.4 1.4 0 0 0 2.8 0c0-.7-.4-1.5-1.4-2.6zM12 15.6c-1.1 1.4-1.6 2.4-1.6 3.2a1.6 1.6 0 0 0 3.2 0c0-.8-.5-1.8-1.6-3.2z"/>`,
  plafoniera: `<path d="M3.5 5h17"/><path class="g" d="M5.5 5.6h13a6.5 6.5 0 0 1-13 0z"/><path d="M12 15.6v2.6M6.8 14.4l-1.5 2M17.2 14.4l1.5 2"/>`,
  lampada: `<path class="g" d="M8.2 3.5h7.6l3 7.5H5.2z"/><path d="M12 11v7.5M8.5 20.5h7"/>`,
  piantana: `<path d="M6 21h6M9 21V8.5C9 5.4 11 3.5 14 3.5h1"/><path class="g" d="M13.6 5h7l-1.6 4.6h-3.8z"/>`,
  led: `<rect x="2.5" y="9" width="19" height="6" rx="1.6"/><rect class="g" x="5.8" y="10.8" width="2.4" height="2.4" rx=".5"/><rect class="g" x="10.8" y="10.8" width="2.4" height="2.4" rx=".5"/><rect class="g" x="15.8" y="10.8" width="2.4" height="2.4" rx=".5"/><path d="M7 6.4l-.5-1.7M12 6.2V4.4M17 6.4l.5-1.7"/>`,
  faretti: `<path d="M2.5 4h19"/><path class="g" d="M4.2 4.6h4v2.6a2 2 0 0 1-4 0zM10 4.6h4v2.6a2 2 0 0 1-4 0zM15.8 4.6h4v2.6a2 2 0 0 1-4 0z"/><path d="M5.6 12.5l-.9 7M12 12.5v7M18.4 12.5l.9 7" stroke-dasharray="1.6 2.2"/>`,
  applique: `<path d="M4.5 4.5v15M4.5 14.5h4.2c1.3 0 2.3-1 2.3-2.3V9.6"/><path class="g" d="M7.4 3.6h7.2l-1.7 6H9.1z"/>`,
  esterno: `<path d="M12 2.5v2.2M7.8 6.8h8.4L15 4.7H9z"/><path class="g" d="M8.6 6.8h6.8v9.6H8.6z"/><path d="M12 9.5v4.4M7.6 16.4h8.8M10.2 19.6h3.6M12 16.4v3.2"/>`,
};
export const ICONE_LUCE = () => [["lampadina", t("Lampadina", "Bulb")], ["lampadario", t("Lampadario", "Chandelier")], ["plafoniera", t("Plafoniera", "Ceiling light")],
  ["lampada", t("Lampada", "Lamp")], ["piantana", t("Piantana", "Floor lamp")], ["applique", "Applique"], ["faretti", t("Faretti", "Spotlights")],
  ["led", t("Striscia LED", "LED strip")], ["esterno", t("Esterno", "Outdoor")]];
/** icona scelta con ✏️, altrimenti indovinata dal nome */
export function iconaAuto(id) {
  const s = (id + " " + nm(id)).toLowerCase();
  return /lampadari|chandelier/.test(s) ? "lampadario" : /\bled\b|_led|led_|strip|striscia|nastro/.test(s) ? "led" : /spot|faret|incass/.test(s) ? "faretti"
    : /piantana|floor/.test(s) ? "piantana" : /applique|parete|wall/.test(s) ? "applique" : /plafon|ceiling|soffitto/.test(s) ? "plafoniera"
    : /esterno|outdoor|giardino|garden|portico|porch|vialetto|cortile|terrazz|balcon|patio|cancello/.test(s) ? "esterno"
    : /lamp|abat|comodino|scrivania|desk|tavolo|lettura/.test(s) ? "lampada" : "lampadina";
}
export const iconaDi = id => P[LAYOUT.lightIcons?.[id]] ? LAYOUT.lightIcons[id] : iconaAuto(id);
export const svgLuce = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k] || P.lampadina}</svg>`;

/* ---------- colori ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** colore approssimato del bianco a una certa temperatura (kelvin) */
export function rgbKelvin(k) {
  const x = clamp(k, 1500, 9000) / 100;
  const r = x <= 66 ? 255 : 330 * Math.pow(x - 60, -0.1332);
  const g = x <= 66 ? 99.5 * Math.log(x) - 161 : 288 * Math.pow(x - 60, -0.0755);
  const b = x >= 66 ? 255 : x <= 19 ? 0 : 138.5 * Math.log(x - 10) - 305;
  return [r, g, b].map(v => Math.round(clamp(v, 0, 255)));
}
export function rgbHs(h, s) {   // h 0-360, s 0-1, luminosità piena
  const f = n => { const k = (n + h / 60) % 6; return 255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))); };
  return [f(5), f(3), f(1)].map(Math.round);
}
function hsRgb([r, g, b]) {
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  let h = 0; if (d) h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, M ? d / M : 0];
}
/* per disegnare la scala del bianco: i bianchi freddi un filo più azzurri, così la scala si legge */
const kVis = k => { const c = rgbKelvin(k), f = clamp((k - 4500) / 3000, 0, 1) * .3; return c.map((v, i) => Math.round(v * (1 - f) + [196, 216, 255][i] * f)); };
const mix = (c, f) => c.map(v => Math.round(v * f + 255 * (1 - f)));
const css = c => `rgb(${c.join(",")})`;
const modi = id => attr(id, "supported_color_modes") || [];
export const dimmerabile = id => id.startsWith("light.") && (modi(id).some(m => m !== "onoff") || attr(id, "brightness") != null);
export const haBianchi = id => modi(id).includes("color_temp");
export const haColori = id => modi(id).some(m => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(m));
const mired = v => v ? Math.round(1e6 / v) : null;
const limitiK = id => {
  const a = S[id]?.attributes || {};
  return [a.min_color_temp_kelvin || mired(a.max_mireds) || 2000, a.max_color_temp_kelvin || mired(a.min_mireds) || 6500];
};
const kelvinDi = id => attr(id, "color_temp_kelvin") || mired(attr(id, "color_temp"));

/* ---------- valori «ottimisti»: dopo un comando la tessera cambia subito, senza aspettare Home Assistant ---------- */
const OTT = {}, ULTIMA = {};
function stato(id) {
  const s = S[id], a = s.attributes, o = OTT[id], vivo = o && Date.now() - o.t < 4000;
  let on = s.state === "on", b = a.brightness != null ? Math.round(a.brightness / 2.55) : null;
  if (on && b != null) ULTIMA[id] = b;
  let rgb = a.rgb_color || (kelvinDi(id) ? rgbKelvin(kelvinDi(id)) : null), k = kelvinDi(id), hs = a.hs_color ? [a.hs_color[0], a.hs_color[1] / 100] : null;
  /* Home Assistant dà tutti i formati del colore: conta quello in uso (bianco o colore) */
  if (a.color_mode === "color_temp") hs = null; else if (["hs", "xy", "rgb", "rgbw", "rgbww"].includes(a.color_mode)) k = null;
  if (vivo) {
    if (o.on != null) { if (o.on === on) delete o.on; else { on = o.on; if (on && b == null) b = ULTIMA[id] ?? null; } }
    if (o.b != null) { if (b != null && Math.abs(b - o.b) <= 2) delete o.b; else b = o.b; }
    if (o.k != null) { if (k && Math.abs(k - o.k) < 60) delete o.k; else { k = o.k; rgb = rgbKelvin(k); hs = null; } }
    if (o.hs) { if (hs && Math.abs(hs[0] - o.hs[0]) < 4 && Math.abs(hs[1] - o.hs[1]) < .05) delete o.hs; else { hs = o.hs; rgb = rgbHs(hs[0], hs[1]); k = null; } }
  } else if (o) delete OTT[id];
  if (!rgb) rgb = [255, 194, 112];   // bianco caldo per le luci senza colore
  return { on, b: on ? (b ?? (dimmerabile(id) ? null : 100)) : 0, rgb, k, hs };
}
const ott = (id, o) => { OTT[id] = { ...(OTT[id] || {}), ...o, t: Date.now() }; };
/** variabili CSS della tessera: colore puro, chiaro, riempimento, alone */
function stile(st) {
  const c = st.rgb, f = st.b == null ? 1 : clamp(st.b / 100, 0, 1);
  return `--lr:${c.join(",")};--lc:${css(c)};--lb:${css(mix(c, .14))};--lf:${css(mix(c, .52))};--b:${f.toFixed(3)};--lh:${(.3 + .45 * f).toFixed(2)}`;
}

/* ---------- tessera ---------- */
const nGruppo = id => membriLuce(id).filter(m => S[m]).length;
function testoStato(id, st) {
  if (!ok(id)) return t("non raggiungibile", "unavailable");
  const g = isLightGroup(id) ? ` · ▦ ${nGruppo(id) || t("gruppo", "group")}` : "";
  return (st.on ? (dimmerabile(id) && st.b != null ? `<b class="lt2n" data-lup>${st.b}%</b>` : t("accesa", "on")) : t("spenta", "off")) + g;
}
export function tessera(id, label) {
  if (!S[id]) return "";
  const st = stato(id), un = !ok(id), dim = dimmerabile(id) && !un, n = label || shortName(id);
  const desc = `${n}: ${un ? t("non raggiungibile", "unavailable") : st.on ? t("accesa", "on") + (dim && st.b != null ? " " + st.b + "%" : "") : t("spenta", "off")}`;
  return `<div class="lt2 ${st.on ? "on" : ""} ${un ? "dis" : ""}" data-lug="t" data-id="${id}" data-dim="${dim ? 1 : 0}" role="button" tabindex="0" aria-label="${esc(desc)}" style="${stile(st)}">
    <i class="lf2"></i>
    <div class="lt2h"><span class="lt2i">${svgLuce(iconaDi(id))}</span><button class="lt2d" data-act="luDet" data-id="${id}" aria-label="${t("Dettagli", "Details")} ${esc(n)}">⋯</button></div>
    <b class="lt2t">${esc(n)}</b><span class="lt2s">${testoStato(id, st)}</span></div>`;
}
VISTE.luce = tessera;
/** colore di adesso (anche ottimista) di una luce */
export const coloreDi = id => S[id] ? stato(id).rgb : null;
/** icona piccola con il colore della luce (mappa) */
export function iconaPiccola(id) {
  const st = S[id] ? stato(id) : { on: false, rgb: [255, 194, 112], b: 0 };
  return `<span class="lu4 ${st.on ? "on" : ""}" style="${stile(st)}">${svgLuce(iconaDi(id))}</span>`;
}

/* ---------- comandi ---------- */
function accendiSpegni(id) {
  if (!ok(id)) return;
  const on = !stato(id).on; ott(id, { on }); render(true);
  svc(id.split(".")[0], on ? "turn_on" : "turn_off", {}, { entity_id: id }).catch(() => { delete OTT[id]; render(); });
}
function luminosita(id, v) {
  ott(id, v > 0 ? { on: true, b: v } : { on: false });
  return svc("light", v > 0 ? "turn_on" : "turn_off", v > 0 ? { brightness_pct: v } : {}, { entity_id: id }).catch(() => { delete OTT[id]; render(); });
}
const bianco = (id, k) => { ott(id, { on: true, k }); return svc("light", "turn_on", { color_temp_kelvin: Math.round(k) }, { entity_id: id }).catch(() => { delete OTT[id]; render(); }); };
const colore = (id, h, s) => { ott(id, { on: true, hs: [h, s] }); return svc("light", "turn_on", { hs_color: [Math.round(h), Math.round(s * 100)] }, { entity_id: id }).catch(() => { delete OTT[id]; render(); }); };

/* ---------- gesti: tocco, trascinamento, pressione lunga ---------- */
let G = null, mangia = 0;
const dentro = (e, r) => clamp((e.clientX - r.left) / r.width, 0, 1);
function inizia(g) { g.st = "drag"; clearTimeout(g.lp); g.el.dataset.drag = "1"; g.el.classList.add("drag"); try { g.el.setPointerCapture(g.pid); } catch {} }
function mostra(g, e) {
  const el = g.el, r = g.r;
  if (g.k === "t" || g.k === "b") {
    g.v = Math.round(g.k === "t" ? clamp(g.b0 + (e.clientX - g.x0) / r.width * 100, 0, 100) : dentro(e, r) * 100);
    el.style.setProperty("--b", (g.v / 100).toFixed(3)); el.style.setProperty("--lh", (.3 + .45 * g.v / 100).toFixed(2));
    el.classList.toggle("on", g.v > 0);
    const p = el.querySelector("[data-lup]") || el.querySelector(".lt2s"); if (p) p.textContent = g.v ? g.v + "%" : t("spegni", "off");
    el.setAttribute("aria-valuenow", g.v);
  } else if (g.k === "k") {
    const [a, b] = limitiK(g.id), f = dentro(e, r); g.v = a + f * (b - a);
    el.style.setProperty("--x", (f * 100).toFixed(1) + "%"); const p = el.querySelector("[data-lup]"); if (p) p.textContent = Math.round(g.v / 50) * 50 + " K";
  } else if (g.k === "w") {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy;
    const h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, s = clamp(Math.hypot(dx, dy) / (r.width / 2), 0, 1);
    g.v = [h, s]; const k = el.querySelector(".lu3wk");
    if (k) { k.style.left = (50 + s * Math.sin(h * Math.PI / 180) * 50).toFixed(2) + "%"; k.style.top = (50 - s * Math.cos(h * Math.PI / 180) * 50).toFixed(2) + "%"; k.style.background = css(rgbHs(h, s)); }
  }
}
function invia(g, fine) {
  if (g.v == null || (!fine && Date.now() - g.inv < 380)) return; g.inv = Date.now();
  if (g.k === "t" || g.k === "b") { if (g.v === 0 && !fine) return; luminosita(g.id, g.v); }
  else if (g.k === "k") bianco(g.id, g.v);
  else if (g.k === "w") colore(g.id, g.v[0], g.v[1]);
}
function chiudi(g) { delete g.el.dataset.drag; g.el.classList.remove("drag"); render(true); }
document.addEventListener("pointerdown", e => {
  const el = e.target.closest("[data-lug]");
  if (!el || e.button > 0 || (el.dataset.lug === "t" && (UI.edit || e.target.closest("[data-act]")))) return;
  const id = el.dataset.id; if (!S[id] || !ok(id)) return;
  G = { el, id, k: el.dataset.lug, x0: e.clientX, y0: e.clientY, r: el.getBoundingClientRect(), st: "?", pid: e.pointerId, b0: stato(id).b || 0, v: null, inv: 0 };
  if (G.k === "t") { const g = G; g.lp = setTimeout(() => { if (G === g && g.st === "?") { G = null; mangia = Date.now(); try { navigator.vibrate?.(10); } catch {} apri(id); } }, 480); }
  else { inizia(G); mostra(G, e); }
});
document.addEventListener("pointermove", e => {
  const g = G; if (!g || e.pointerId !== g.pid) return;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
  if (g.st === "?") {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2 && g.el.dataset.dim === "1") inizia(g);
    else if (Math.hypot(dx, dy) > 10) { clearTimeout(g.lp); g.st = "via"; return; }
    else return;
  }
  if (g.st === "drag") { e.preventDefault(); mostra(g, e); invia(g, false); }
});
document.addEventListener("pointerup", e => {
  const g = G; if (!g || e.pointerId !== g.pid) return; G = null; clearTimeout(g.lp);
  if (g.st === "?" && g.k === "t") accendiSpegni(g.id);
  else if (g.st === "drag") { invia(g, true); chiudi(g); }
});
document.addEventListener("pointercancel", e => { const g = G; if (!g || e.pointerId !== g.pid) return; G = null; clearTimeout(g.lp); if (g.st === "drag") chiudi(g); });
/* dopo la pressione lunga il dito si alza sopra il foglio appena aperto: quel clic non deve chiuderlo */
window.addEventListener("click", e => { if (Date.now() - mangia < 900) { mangia = 0; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("contextmenu", e => { const el = e.target.closest('[data-lug="t"]'); if (!el) return; e.preventDefault(); if (!UI.edit && e.pointerType !== "touch" && Date.now() - mangia > 900) apri(el.dataset.id); });
/* tastiera: Invio accende/spegne, frecce regolano */
document.addEventListener("keydown", e => {
  const el = e.target.closest?.("[data-lug]"); if (!el || e.target !== el) return;
  const id = el.dataset.id, k = el.dataset.lug, st = S[id] ? stato(id) : null; if (!st || !ok(id)) return;
  const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
  if (k === "t" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); accendiSpegni(id); }
  else if (d && (k === "t" || k === "b") && dimmerabile(id)) { e.preventDefault(); luminosita(id, clamp((st.b || 0) + d * 10, 0, 100)); render(true); }
  else if (d && k === "k" && haBianchi(id)) { e.preventDefault(); const [a, b] = limitiK(id); bianco(id, clamp((st.k || a) + d * 250, a, b)); render(true); }
});

/* ---------- foglio dei dettagli ---------- */
let DID = null, PILA = [];
/** apre i dettagli di una luce; se c'era già un foglio (la stanza della Home, il gruppo) «‹» ci riporta lì */
export function apri(id) {
  if (UI.sheet === dettaglio) { if (DID !== id) PILA.push({ id: DID }); } else PILA = UI.sheet ? [{ fn: UI.sheet }] : [];
  DID = id; openSheet(dettaglio);
}
ACT.luBack = () => { const x = PILA.pop(); if (!x) return closeSheet(); if (x.id) { DID = x.id; openSheet(dettaglio); } else openSheet(x.fn); };
const BIANCHI = () => [[2700, t("Calda", "Warm")], [4000, t("Naturale", "Neutral")], [6000, t("Fredda", "Cool")]];
const COLORI = [[0, 1], [28, 1], [50, 1], [120, .9], [175, .85], [205, .85], [235, .9], [275, .8], [320, .7]];
const preferiti = () => { if (isAdmin()) return LAYOUT.lightFav || []; try { return JSON.parse(sGet("lightFav") || "[]"); } catch { return []; } };
const vicino = (st, f) => f.startsWith("k:") ? st.k && Math.abs(st.k - +f.slice(2)) < 120 : st.hs && (([h, s]) => Math.min(Math.abs(st.hs[0] - h), 360 - Math.abs(st.hs[0] - h)) < 6 && Math.abs(st.hs[1] - s) < .08)(f.split(",").map(Number));
const voceCol = f => f.startsWith("k:") ? rgbKelvin(+f.slice(2)) : (([h, s]) => rgbHs(h, s))(f.split(",").map(Number));
function dettaglio() {
  const id = DID; if (!S[id]) return `<div class="sh-head"><h3>—</h3><button class="x" data-act="sheetClose">×</button></div>`;
  const st = stato(id), un = !ok(id), dim = dimmerabile(id) && !un, A = AREAS[areaOf(id)]?.name, a = S[id].attributes;
  const testa = `<div class="sh-head lu3h"><div class="row" style="gap:14px;min-width:0"><span class="lu3i ${st.on ? "on" : ""}" style="${stile(st)}">${svgLuce(iconaDi(id))}</span>
      <div style="min-width:0"><h3>${esc(nm(id))}</h3><div class="small muted">${[A && esc(A), isLightGroup(id) && "▦ " + t("gruppo", "group"), isLightSwitch(id) && "🔌 " + t("interruttore", "switch"), un ? t("non raggiungibile", "unavailable") : st.on ? t("accesa", "on") + (dim && st.b != null ? " · " + st.b + "%" : "") : t("spenta", "off")].filter(Boolean).join(" · ")}</div></div></div>
    <div class="row" style="gap:8px;flex:none">${PILA.length ? `<button class="x" data-act="luBack" aria-label="${t("Indietro", "Back")}">‹</button>` : ""}<button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div></div>`;
  if (un) return testa + `<p class="small muted">${t("Home Assistant non riesce a raggiungere questa luce: controlla che sia alimentata e collegata.", "Home Assistant can't reach this light: check that it's powered and connected.")}</p>${fondo(id)}`;
  const parti = [`<button class="lu3p ${st.on ? "on" : ""}" data-act="luTog" data-id="${id}" style="${stile(st)}"><span>⏻</span>${st.on ? t("Spegni", "Turn off") : t("Accendi", "Turn on")}</button>`];
  if (dim) parti.push(`<div class="lu3b ${st.on ? "on" : ""}" data-lug="b" data-id="${id}" role="slider" tabindex="0" aria-label="${t("Luminosità", "Brightness")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st.b || 0}" style="${stile(st)}">
      <i class="lf2"></i><span class="lu3bt">☀︎ ${t("Luminosità", "Brightness")}</span><b data-lup>${st.on && st.b != null ? st.b + "%" : t("spenta", "off")}</b></div>`);
  if (haBianchi(id)) {
    const [k0, k1] = limitiK(id), k = st.k && !st.hs ? st.k : null, x = k ? (clamp(k, k0, k1) - k0) / (k1 - k0 || 1) * 100 : null;
    const W = BIANCHI().map(([v, n]) => [clamp(v, k0, k1), n]).filter((v, i, L) => L.findIndex(w => Math.abs(w[0] - v[0]) < 300) === i);
    parti.push(`<div class="fl1">${t("Bianco", "White")}</div>
      <div class="lu3k ${x == null ? "nok" : ""}" data-lug="k" data-id="${id}" role="slider" tabindex="0" aria-label="${t("Temperatura del bianco", "White temperature")}" aria-valuenow="${k || ""}"
        style="--x:${x ?? 50}%;--k0:${css(kVis(k0))};--k1:${css(kVis(k1))};--km:${css(kVis((k0 + k1) / 2))}"><i class="lu3kk"></i><b data-lup>${k ? Math.round(k / 50) * 50 + " K" : t("trascina", "drag")}</b></div>
      <div class="lu3c">${W.map(([v, n]) => `<button class="${k && Math.abs(k - v) < 150 ? "on" : ""}" data-act="luK" data-id="${id}" data-v="${v}"><i style="background:${css(kVis(v))}"></i>${n}</button>`).join("")}</div>`);
  }
  if (haColori(id)) {
    const hs = st.hs || (st.on && !st.k ? hsRgb(st.rgb) : null), F = preferiti(), cur = hs ? `${Math.round(hs[0])},${Math.round(hs[1] * 100) / 100}` : st.k ? "k:" + Math.round(st.k / 50) * 50 : "";
    const giaFav = cur && F.some(f => vicino(st, f));
    const sw = (f, cls = "") => `<button class="lu3s ${cls} ${vicino(st, f) ? "on" : ""}" data-act="luCol" data-id="${id}" data-v="${f}" style="background:${css(voceCol(f))}" aria-label="${esc(f)}"></button>`;
    parti.push(`<div class="fl1">${t("Colore", "Colour")}</div>
      <div class="lu3cw"><div class="lu3w" data-lug="w" data-id="${id}" aria-label="${t("Ruota dei colori", "Colour wheel")}">${hs ? `<i class="lu3wk" style="left:${(50 + hs[1] * Math.sin(hs[0] * Math.PI / 180) * 50).toFixed(2)}%;top:${(50 - hs[1] * Math.cos(hs[0] * Math.PI / 180) * 50).toFixed(2)}%;background:${css(rgbHs(hs[0], hs[1]))}"></i>` : ""}</div>
        <div class="lu3pal"><div class="lu3sg">${COLORI.map(([h, s]) => sw(h + "," + s)).join("")}</div>
          <div class="small muted" style="margin:10px 0 6px">⭐ ${t("Preferiti", "Favourites")}</div>
          <div class="lu3sg">${F.map(f => sw(f, "fav")).join("")}${cur ? `<button class="lu3s add ${giaFav ? "on" : ""}" data-act="luFav" data-id="${id}" data-v="${cur}" aria-label="${giaFav ? t("Togli dai preferiti", "Remove from favourites") : t("Aggiungi ai preferiti", "Add to favourites")}">${giaFav ? "★" : "☆"}</button>` : ""}</div>
          <div class="small muted" style="margin-top:6px">${giaFav ? t("★ toglie questo colore dai preferiti.", "★ removes this colour from favourites.") : cur ? t("☆ salva il colore di adesso.", "☆ saves the current colour.") : t("Scegli un colore, poi ☆ per salvarlo.", "Pick a colour, then ☆ to save it.")}</div></div></div>`);
  }
  const E = a.effect_list || [];
  if (E.length && !isLightSwitch(id)) parti.push(`<div class="fl1">${t("Effetti", "Effects")}</div><div class="lu3e">${E.map(x => `<button class="${a.effect === x ? "on" : ""}" data-act="luEff" data-id="${id}" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div>`);
  const M = membriLuce(id).filter(m => S[m]);
  if (M.length) parti.push(`<div class="fl1">${t("Luci del gruppo", "Lights in the group")}</div><div class="stack">${M.map(m => { const s2 = stato(m);
    return `<div class="li lu3m ${ok(m) ? "" : "dis"}"><span class="lu4 ${s2.on ? "on" : ""}" style="${stile(s2)}">${svgLuce(iconaDi(m))}</span><button class="tx" data-act="luDet" data-id="${m}"><b>${esc(nm(m))}</b><span>${!ok(m) ? t("non raggiungibile", "unavailable") : s2.on ? (s2.b != null && dimmerabile(m) ? s2.b + "%" : t("accesa", "on")) : t("spenta", "off")} ›</span></button>
      ${ok(m) ? `<button class="sw ${s2.on ? "on" : ""}" data-act="luTog" data-id="${m}" aria-label="${esc(nm(m))}"><i></i></button>` : ""}</div>`; }).join("")}</div>`);
  return testa + `<div class="lu3">${parti.join("")}</div>` + fondo(id);
}
const fondo = id => `<div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap">
    ${isAdmin() ? `<button class="btn sm" data-act="edItem" data-id="${id}" data-page="${isLightSwitch(id) ? "lu:sw" : ""}">✏️ ${t("Nome, stanza e icona", "Name, room and icon")}</button>` : ""}
    <button class="btn sm" data-act="luHA" data-id="${id}">⚙️ ${t("Altro in Home Assistant", "More in Home Assistant")}</button></div>`;

Object.assign(ACT, {
  luDet: el => apri(el.dataset.id),
  luTog: el => accendiSpegni(el.dataset.id),
  luK: el => { bianco(el.dataset.id, +el.dataset.v); render(true); },
  luCol: el => { const f = el.dataset.v, id = el.dataset.id;
    if (f.startsWith("k:")) { if (haBianchi(id)) bianco(id, +f.slice(2)); else { const [h, s] = hsRgb(rgbKelvin(+f.slice(2))); colore(id, h, s); } }
    else { const [h, s] = f.split(",").map(Number); colore(id, h, s); } render(true); },
  luEff: el => { const id = el.dataset.id; svc("light", "turn_on", { effect: el.dataset.v }, { entity_id: id }); },
  luFav: async el => {
    const f = el.dataset.v, st = stato(el.dataset.id), F = preferiti(), via = F.filter(x => vicino(st, x)), N = via.length ? F.filter(x => !via.includes(x)) : [...F, f].slice(-12);
    if (isAdmin()) { try { await saveLayout({ ...JSON.parse(JSON.stringify(LAYOUT)), lightFav: N }); } catch (e) { return toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); } }
    else { sSet("lightFav", JSON.stringify(N)); render(true); }
    toast(via.length ? "☆ " + t("Tolto dai preferiti", "Removed from favourites") : "⭐ " + t("Aggiunto ai preferiti", "Added to favourites"));
  },
  luHA: el => { const id = el.dataset.id; closeSheet(); moreInfo(id); },
});

/* ---------- ✏️ icona (nel foglio ✏️ della luce, edit.js) ---------- */
VISTE.luceRiga = id => {
  const cur = LAYOUT.lightIcons?.[id] || "";
  return `<div class="fl1">${t("Icona", "Icon")}</div><div class="lu5">
    <button class="${!cur ? "on" : ""}" data-act="luIco" data-id="${id}" data-v=""><span>${svgLuce(iconaAuto(id))}</span>✨ ${t("Automatica", "Automatic")}</button>
    ${ICONE_LUCE().map(([k, n]) => `<button class="${cur === k ? "on" : ""}" data-act="luIco" data-id="${id}" data-v="${k}"><span>${svgLuce(k)}</span>${esc(n)}</button>`).join("")}</div>`;
};
ACT.luIco = async el => {
  const id = el.dataset.id, v = el.dataset.v, l = JSON.parse(JSON.stringify(LAYOUT)), I = { ...(l.lightIcons || {}) };
  if (v) I[id] = v; else delete I[id]; l.lightIcons = I;
  try { await saveLayout(l); toast("💾 " + nm(id)); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
};

/* ---------- luci da mostrare per stanza: gruppi riconosciuti, membri raccolti nel loro gruppo (niente doppioni) ---------- */
const posOrdine = () => { const o = LAYOUT.lightOrder || [], m = new Map(); o.forEach((id, i) => m.set(id, i)); return m; };
/** { stanze: { area|"_": [id…] }, gruppi: [id…] (gruppi senza stanza con luci in più stanze) } — ordine scelto con ✏️, poi per nome */
export function luciPerStanza() {
  const L = luci(), vis = new Set(L), piegate = new Set(), dove = {};
  const stanzaGruppo = g => { if (areaOf(g)) return areaOf(g); const A = [...new Set(membriLuce(g).filter(m => vis.has(m)).map(m => areaOf(m) || "_"))]; return A.length === 1 && A[0] !== "_" ? A[0] : null; };
  for (const id of L) dove[id] = isLightGroup(id) ? stanzaGruppo(id) : areaOf(id);
  for (const g of L.filter(isLightGroup)) { const a = dove[g]; if (!a) continue; membriLuce(g).forEach(m => { if (m !== g && vis.has(m) && (areaOf(m) || dove[m]) === a) piegate.add(m); }); }
  const pos = posOrdine(), ord = (x, y) => (pos.get(x) ?? 1e6) - (pos.get(y) ?? 1e6) || shortName(x).localeCompare(shortName(y));
  const stanze = {}, gruppi = [];
  for (const id of L) {
    if (piegate.has(id)) continue;
    if (isLightGroup(id) && !dove[id] && membriLuce(id).some(m => vis.has(m))) { gruppi.push(id); continue; }
    const a = dove[id] && AREAS[dove[id]] ? dove[id] : "_";
    (stanze[a] = stanze[a] || []).push(id);
  }
  for (const a in stanze) stanze[a].sort(ord);
  return { stanze, gruppi: gruppi.sort(ord) };
}
/** luci di una stanza, come nella pagina Luci (per la finestra della stanza nella Home) */
export const luciStanza = a => luciPerStanza().stanze[a] || [];

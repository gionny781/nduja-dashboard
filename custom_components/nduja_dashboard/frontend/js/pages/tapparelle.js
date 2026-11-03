/* Tapparelle e tende: tapparelle, veneziane, tende, tende a rullo, tende da sole e finestre motorizzate (cover di tipo
   shutter, blind, curtain, shade, awning, window). Cancelli e garage restano negli Accessi (pagina Sicurezza).
   Ogni tapparella ha il suo disegno della plancia (SVG + CSS) che sale e scende con la posizione; si trascina sulla finestra.
   Gruppi rapidi (casa, piano, stanza, lato), scenari salvati come script e automatismi facoltativi creati su richiesta.
   Scelte in LAYOUT.tapparelle = { extra:[], tolte:[], lati:{id:"n|e|s|o"}, aspetto:{id:tipo}, finestre:{id:sensore|"none"},
   meta: %, scenari:[{ id, nome, icona, passi:[{ dove, cosa:"su|giu|pos", pos }] }], auto:{ sole, caldo, finestra }, firme:{ id: impronta } } */
import { S, AREAS, FLOORS, REG, ACT, CHG, LAYOUT, UI, VISTE, HOME_EXTRA, HOOKS, t, LOC, esc, nm, nmHA, ok, attr, ents, allEnts, areaOf, areasSorted,
  deviceClass, card, page, svc, toast, openSheet, closeSheet, render, isAdmin, api, etichettaNduja, sGet, sSet, go, weatherEnt, unit, fnum, pronto } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { accessi } from "./sicurezza.js";
import { sensore } from "./meteo.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const C = () => LAYOUT.tapparelle || {};
const tpCambia = (fn, msg) => cambia(l => { l.tapparelle = JSON.parse(JSON.stringify(l.tapparelle || {})); fn(l.tapparelle, l); }, msg);

/* ================= quali sono ================= */
const CLASSI = ["shutter", "blind", "curtain", "awning", "shade", "window"];
const NON_TAPP = /cancell|garage|basculant|portone|\bgate\b|\bdoor\b|porta\b|trunk|frunk|baule|bagagli|charge|sportell|valvol|damper|serrand.*garage/i;
/** è una tapparella o una tenda? (le cover senza tipo sì, tranne quelle che dal nome sono cancelli, porte, auto…) */
function eTapparella(id) {
  const dc = deviceClass(id);
  if (CLASSI.includes(dc)) return true;
  if (dc) return false;   // gate, garage, door, damper
  return !NON_TAPP.test(id + " " + nmHA(id));
}
const idAccessi = () => { try { return new Set(accessi().map(a => a.id)); } catch { return new Set(); } };
const ordine = () => { const A = areasSorted(true); return id => { const i = A.indexOf(areaOf(id)); return i < 0 ? 999 : i; }; };
/** tutte le tapparelle della pagina: trovate da sole (non negli Accessi, non tolte) più quelle aggiunte a mano.
    La Mappa, la Home e le Prese la chiedono molte volte per disegno: la tengo per un attimo, finché le scelte non cambiano. */
let memo = { t: 0, k: null, v: [] };
export function tutte() {
  const k = [LAYOUT.tapparelle, LAYOUT.accessi, LAYOUT.include, LAYOUT.exclude, LAYOUT.show, LAYOUT.hiddenAreas, LAYOUT.rooms, LAYOUT.names, LAYOUT.mode, Object.keys(S).length];
  if (Date.now() - memo.t < 400 && memo.k && k.every((x, i) => x === memo.k[i])) return memo.v;
  const c = C(), tolte = new Set(c.tolte || []), extra = (c.extra || []).filter(id => S[id]), acc = idAccessi();
  const L = [...new Set([...ents("cover", id => eTapparella(id) && !acc.has(id) && !tolte.has(id)), ...extra])];
  const o = ordine();
  memo = { t: Date.now(), k, v: L.sort((a, b) => o(a) - o(b) || nm(a).localeCompare(nm(b), LOC)) };
  return memo.v;
}
VISTE.tapTutte = tutte;

/* ================= stato ================= */
const sf = id => +attr(id, "supported_features") || 0;
const puoPos = id => (sf(id) & 4) > 0;
const puoStop = id => (sf(id) & 8) > 0;
const puoSu = id => !sf(id) || (sf(id) & 1) > 0;
const puoGiu = id => !sf(id) || (sf(id) & 2) > 0;
const puoTilt = id => (sf(id) & 128) > 0 && attr(id, "current_tilt_position") != null;
const muove = id => ["opening", "closing"].includes(S[id]?.state);
/** posizione 0 (chiusa) … 100 (aperta); senza posizione: aperta 100, chiusa 0, in movimento 50 */
function pos(id) {
  const p = attr(id, "current_position");
  if (p != null && p !== "" && !isNaN(+p)) return clamp(Math.round(+p), 0, 100);
  const s = S[id]?.state; return s === "open" ? 100 : s === "closed" ? 0 : 50;
}
const aperta = id => ok(id) && (attr(id, "current_position") != null ? pos(id) > 0 : S[id].state !== "closed");
const ASPETTI = () => [["tapparella", t("Tapparella", "Roller shutter")], ["veneziana", t("Veneziana", "Venetian blind")], ["tenda", t("Tenda", "Curtain")],
  ["rullo", t("Tenda a rullo", "Roller shade")], ["sole", t("Tenda da sole", "Awning")], ["finestra", t("Finestra", "Window")]];
function aspettoAuto(id) {
  const dc = deviceClass(id), s = (id + " " + nmHA(id)).toLowerCase();
  if (dc === "curtain") return "tenda"; if (dc === "awning") return "sole"; if (dc === "shade") return "rullo"; if (dc === "window") return "finestra";
  if (dc === "blind" || attr(id, "current_tilt_position") != null || /venez|lamell|\bblind/.test(s)) return "veneziana";
  if (/tenda da sole|tende da sole|awning|parasole|pergol|frangisole|sun.?shade/.test(s)) return "sole";
  if (/lucernari|velux|skylight|finestr|window/.test(s)) return "finestra";
  if (/rullo|roller.?shade|oscurant|screen/.test(s)) return "rullo";
  if (/tend|curtain|drape|sipari/.test(s)) return "tenda";
  return "tapparella";
}
const aspetto = id => ASPETTI().some(([k]) => k === C().aspetto?.[id]) ? C().aspetto[id] : aspettoAuto(id);
const LATI = () => [["n", t("Nord", "North"), "N"], ["e", t("Est", "East"), t("E", "E")], ["s", t("Sud", "South"), t("S", "S")], ["o", t("Ovest", "West"), t("O", "W")]];
const latoDi = id => LATI().some(([k]) => k === C().lati?.[id]) ? C().lati[id] : "";
const nomeLato = k => (LATI().find(x => x[0] === k) || [])[1] || "";
const sigla = k => (LATI().find(x => x[0] === k) || [])[2] || "";
const meta = () => clamp(Math.round(+C().meta || 50), 5, 95);

/** sensore della finestra: scelto con ✏️, altrimenti uno dello stesso dispositivo, altrimenti l'unico della stanza se c'è una sola tapparella */
const FIN = ["window", "opening", "door"];
const sensoriFinestra = () => allEnts("binary_sensor", x => FIN.includes(deviceClass(x)));
function finestraAuto(id) {
  const Fs = sensoriFinestra(), dev = REG[id]?.device;
  if (dev) { const x = Fs.find(s => REG[s]?.device === dev); if (x) return x; }
  const a = areaOf(id); if (!a) return null;
  const qui = Fs.filter(s => areaOf(s) === a && deviceClass(s) !== "door"), cop = tutte().filter(c => areaOf(c) === a && !["tenda", "sole"].includes(aspetto(c)));
  return qui.length === 1 && cop.length === 1 && cop[0] === id ? qui[0] : null;
}
function finestraDi(id) { const v = C().finestre?.[id]; if (v === "none") return null; if (v && S[v]) return v; return finestraAuto(id); }
/** coppie tapparella → sensore della finestra (tende da sole e tende interne escluse) */
const coppie = L => Object.fromEntries(L.filter(id => !["sole", "tenda"].includes(aspetto(id))).map(id => [id, finestraDi(id)]).filter(([, f]) => f));

/* ================= dove: casa, piano, stanza, lato ================= */
const pianoDi = id => AREAS[areaOf(id)]?.floor || "_";
const stanzaDi = id => areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_";
function inDove(dove, L = tutte()) {
  if (!dove || dove === "casa") return L;
  const [k, v] = String(dove).split(":");
  if (k === "piano") return L.filter(id => pianoDi(id) === v);
  if (k === "stanza") return L.filter(id => stanzaDi(id) === v);
  if (k === "lato") return L.filter(id => latoDi(id) === v);
  return [];
}
function nomeDove(dove) {
  const [k, v] = String(dove || "casa").split(":");
  if (k === "piano") return FLOORS[v]?.name || t("Senza piano", "No floor");
  if (k === "stanza") return v === "_" ? t("Senza stanza", "No room") : AREAS[v]?.name || v;
  if (k === "lato") return t("Lato ", "") + nomeLato(v) + t("", " side");
  return t("Tutta la casa", "Whole house");
}
/** scelte possibili (sempre «casa»; piani se più di uno; stanze; lati usati), con il numero di tapparelle */
function doveScelte(conVuoti) {
  const L = tutte(), out = [["casa", "🏠 " + nomeDove("casa"), L.length]];
  const piani = [...new Set(L.map(pianoDi))].sort((a, b) => (FLOORS[a]?.level ?? 99) - (FLOORS[b]?.level ?? 99));
  if (piani.length > 1) piani.forEach(p => out.push(["piano:" + p, "🏢 " + nomeDove("piano:" + p), inDove("piano:" + p, L).length]));
  const st = [...new Set(L.map(stanzaDi))], o = areasSorted(true); st.sort((a, b) => (o.indexOf(a) < 0 ? 999 : o.indexOf(a)) - (o.indexOf(b) < 0 ? 999 : o.indexOf(b)));
  st.forEach(a => out.push(["stanza:" + a, "🚪 " + nomeDove("stanza:" + a), inDove("stanza:" + a, L).length]));
  LATI().forEach(([k]) => { const n = inDove("lato:" + k, L).length; if (n || conVuoti) out.push(["lato:" + k, "🧭 " + nomeDove("lato:" + k), n]); });
  return out;
}

/* ================= comandi ================= */
const TGT = {};   // dove sta andando dopo un trascinamento: { id: { p, da } }
function verso(id, p) { TGT[id] = { p, da: Date.now() }; }
async function muovi(id, cosa, v) {
  const T = { entity_id: id };
  if (cosa === "su") { verso(id, 100); return svc("cover", "open_cover", {}, T); }
  if (cosa === "giu") { verso(id, 0); return svc("cover", "close_cover", {}, T); }
  if (cosa === "stop") { delete TGT[id]; return svc("cover", "stop_cover", {}, T); }
  if (cosa === "pos") { v = clamp(Math.round(v), 0, 100);
    if (puoPos(id)) { verso(id, v); return svc("cover", "set_cover_position", { position: v }, T); }
    if (v >= 100 || v > pos(id) + 5) return muovi(id, "su"); if (v <= 0 || v < pos(id) - 5) return muovi(id, "giu"); }
}
/** comando per un gruppo: su, giù, metà (o una posizione), stop */
async function gruppo(L, cosa, v) {
  L = L.filter(ok);
  if (!L.length) return toast(t("Nessuna tapparella raggiungibile", "No reachable cover"), true);
  try {
    if (cosa === "su") { L.forEach(id => verso(id, 100)); await svc("cover", "open_cover", {}, { entity_id: L }); }
    else if (cosa === "giu") { L.forEach(id => verso(id, 0)); await svc("cover", "close_cover", {}, { entity_id: L }); }
    else if (cosa === "stop") { const P = L.filter(puoStop); P.forEach(id => delete TGT[id]); if (P.length) await svc("cover", "stop_cover", {}, { entity_id: P }); }
    else { const P = L.filter(puoPos), x = v ?? meta(); P.forEach(id => verso(id, x));
      if (P.length) await svc("cover", "set_cover_position", { position: x }, { entity_id: P });
      if (P.length < L.length) toast(t(`${L.length - P.length} senza posizione: non le ho mosse`, `${L.length - P.length} without position: not moved`)); }
    render();
  } catch {}
}

/* ================= disegni della plancia (SVG fatti apposta, animati solo col CSS «tapparelle» di nduja.css) =================
   --o = quanto è aperta (0…1), --t = lamelle (0 chiuse … 1 aperte). La finestra (vetro) va da x 12 a 88 e da y 18 a 108. */
const GX = 12, GY = 18, GW = 76, GH = 90;
function cielo() {
  const el = +attr("sun.sun", "elevation");
  if (!isNaN(el)) return el > 6 ? "g" : el > -6 ? "t" : "n";
  return S["sun.sun"]?.state === "below_horizon" ? "n" : "g";
}
const vetro = (x = GX, y = GY, w = GW, h = GH) => `<rect class="sk" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="sk2" x="${x}" y="${y + h * .55}" width="${w}" height="${h * .45}"/>
  <circle class="so" cx="${x + w * .7}" cy="${y + h * .24}" r="${Math.min(w, h) * .1}"/><path class="sx" d="M${x + w * .2} ${y + h * .15}h.1M${x + w * .38} ${y + h * .3}h.1M${x + w * .15} ${y + h * .42}h.1"/>
  <path class="cr" d="M${x + w / 2} ${y}v${h}M${x} ${y + h * .46}h${w}"/>`;
const strisce = (n, y0, passo, alt, cls, x = GX + 1, w = GW - 2) => Array.from({ length: n }, (_, i) => `<rect class="${cls}" x="${x}" y="${(y0 + i * passo).toFixed(1)}" width="${w}" height="${alt}" rx=".8"/>`).join("");
const DISEGNO = {
  tapparella: u => `<rect class="fr" x="4" y="4" width="92" height="112" rx="6"/>${vetro()}
    <clipPath id="tpk${u}"><rect x="${GX}" y="${GY}" width="${GW}" height="${GH}"/></clipPath>
    <g clip-path="url(#tpk${u})"><g class="pn">${strisce(15, GY, 6, 5.5, "sl")}<rect class="bb" x="${GX}" y="${GY + GH - 4}" width="${GW}" height="4"/></g></g>
    <rect class="bx" x="7" y="5" width="86" height="13" rx="3"/><rect class="dz" x="6" y="108" width="88" height="6" rx="2"/>`,
  veneziana: u => `<rect class="fr" x="4" y="4" width="92" height="112" rx="6"/>${vetro()}
    <clipPath id="tpk${u}"><rect x="${GX}" y="${GY}" width="${GW}" height="${GH}"/></clipPath>
    <g clip-path="url(#tpk${u})"><g class="pn"><path class="cd" d="M32 ${GY}v${GH}M68 ${GY}v${GH}"/>${strisce(17, GY + 2, 5.3, 3.6, "vs", GX + 2, GW - 4)}<rect class="bb" x="${GX + 1}" y="${GY + GH - 3}" width="${GW - 2}" height="3" rx="1"/></g></g>
    <rect class="bx" x="9" y="11" width="82" height="7" rx="2"/><rect class="dz" x="6" y="108" width="88" height="6" rx="2"/>`,
  tenda: () => `<rect class="fr" x="4" y="4" width="92" height="112" rx="6"/>${vetro()}<rect class="dz" x="6" y="108" width="88" height="6" rx="2"/>
    <g class="cl"><rect class="fb" x="9" y="13" width="41.5" height="99" rx="2"/><path class="fd" d="${Array.from({ length: 7 }, (_, i) => `M${14 + i * 5.6} 15v95`).join("")}"/></g>
    <g class="cr2"><rect class="fb" x="49.5" y="13" width="41.5" height="99" rx="2"/><path class="fd" d="${Array.from({ length: 7 }, (_, i) => `M${54.5 + i * 5.6} 15v95`).join("")}"/></g>
    <path class="rd" d="M5 12h90"/><circle class="rdp" cx="5" cy="12" r="2.4"/><circle class="rdp" cx="95" cy="12" r="2.4"/>`,
  rullo: u => `<rect class="fr" x="4" y="4" width="92" height="112" rx="6"/>${vetro()}
    <clipPath id="tpk${u}"><rect x="${GX}" y="${GY}" width="${GW}" height="${GH}"/></clipPath>
    <g clip-path="url(#tpk${u})"><g class="pn"><rect class="fb" x="${GX}" y="${GY}" width="${GW}" height="${GH}"/><path class="fd" d="M${GX} ${GY + 30}h${GW}M${GX} ${GY + 60}h${GW}"/><rect class="bb" x="${GX - 1}" y="${GY + GH - 3.5}" width="${GW + 2}" height="3.5" rx="1.5"/></g></g>
    <rect class="bx" x="8" y="9" width="84" height="9" rx="4.5"/><rect class="dz" x="6" y="108" width="88" height="6" rx="2"/>`,
  sole: () => `<rect class="fr" x="4" y="4" width="92" height="112" rx="6"/>${vetro(20, 44, 60, 62)}<rect class="dz" x="16" y="106" width="68" height="6" rx="2"/>
    <rect class="om" x="10" y="12" width="80" height="60" rx="3"/>
    <g class="cn"><rect class="aw" x="7" y="12" width="86" height="44"/>${Array.from({ length: 6 }, (_, i) => `<rect class="aw2" x="${7 + i * 14.33}" y="12" width="7.16" height="44"/>`).join("")}</g>
    <g class="vl"><path class="aw" d="M7 16h86v4${Array.from({ length: 6 }, (_, i) => `q-${7.16 / 2} 5 -7.16 0q-${7.16 / 2} 5 -7.16 0`).join("")}z"/></g>
    <rect class="bx" x="5" y="6" width="90" height="8" rx="3"/>`,
  finestra: () => `<rect class="fr" x="4" y="4" width="92" height="112" rx="6"/><rect class="gap" x="${GX}" y="${GY}" width="${GW}" height="${GH}"/>
    <g class="sa">${vetro()}<rect class="sf" x="${GX}" y="${GY}" width="${GW}" height="${GH}" rx="1.5"/><rect class="mn" x="44" y="${GY + GH - 9}" width="12" height="4" rx="2"/></g>
    <rect class="dz" x="6" y="108" width="88" height="6" rx="2"/>`,
};
const freccia = `<g class="mva"><circle cx="50" cy="62" r="13"/><path d="M43 65l7-7 7 7"/></g>`;
let uid = 0;
/** il disegno di una tapparella: k aspetto, o 0…1 aperta, tl 0…1 lamelle (o null), st stato, cls classe in più */
export function disegnoTapp(k, o, tl, st = "", cls = "", tg = null) {
  const u = ++uid, f = DISEGNO[k] || DISEGNO.tapparella;
  const mira = tg != null && (k === "tapparella" || k === "veneziana" || k === "rullo") ? `<path class="tg" d="M${GX - 3} ${(GY + GH * (1 - tg)).toFixed(1)}h${GW + 6}"/>` : "";
  return `<svg class="tp1d k-${k} c-${cielo()} ${st ? "s-" + st : ""} ${cls}" viewBox="0 0 100 120" style="--o:${(+o).toFixed(3)};--t:${tl == null ? .45 : (+tl).toFixed(3)}" aria-hidden="true">${f(u)}${mira}${freccia}</svg>`;
}
const disegno = (id, cls = "") => { const g = TGT[id]; return disegnoTapp(aspetto(id), pos(id) / 100, puoTilt(id) ? +attr(id, "current_tilt_position") / 100 : null, ok(id) ? S[id].state : "un", cls, g && muove(id) ? g.p / 100 : null); };
/** piccolo, per la Mappa e le stanze della Home (null se non è una tapparella della pagina) */
VISTE.tapMini = id => tutte().includes(id) ? disegno(id, "xs") : null;

/* ================= testi ================= */
function statoTesto(id) {
  if (!ok(id)) return t("non raggiungibile", "unavailable");
  const s = S[id].state, p = pos(id), conPos = attr(id, "current_position") != null;
  if (s === "opening") return t("si apre…", "opening…") + (conPos ? " " + p + "%" : "");
  if (s === "closing") return t("si chiude…", "closing…") + (conPos ? " " + p + "%" : "");
  if (!conPos) return s === "open" ? t("aperta", "open") : s === "closed" ? t("chiusa", "closed") : String(s);
  return p >= 100 ? t("aperta", "open") : p <= 0 ? t("chiusa", "closed") : t(`aperta al ${p}%`, `${p}% open`);
}

/* ================= pagina ================= */
const ICO = {
  su: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`, giu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="pi" x="7.5" y="7.5" width="9" height="9" rx="1.5"/></svg>`,
  meta: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4.5" width="13" height="15" rx="2"/><rect class="pi" x="5.5" y="4.5" width="13" height="7.5" rx="1.5"/></svg>` };
const passoTesto = p => (p.cosa === "su" ? "▲ " : p.cosa === "giu" ? "▼ " : t("Al ", "To ") + clamp(Math.round(+p.pos || 0), 0, 100) + "% · ") + nomeDove(p.dove);
const pulsanti = (id, piccoli) => `<div class="tp1b ${piccoli ? "sm" : ""}">
  ${puoSu(id) ? `<button data-act="tpCmd" data-id="${id}" data-v="su" aria-label="${t("Su", "Up")} · ${esc(nm(id))}">${ICO.su}</button>` : ""}
  ${puoStop(id) ? `<button data-act="tpCmd" data-id="${id}" data-v="stop" aria-label="${t("Ferma", "Stop")} · ${esc(nm(id))}">${ICO.stop}</button>` : ""}
  ${puoGiu(id) ? `<button data-act="tpCmd" data-id="${id}" data-v="giu" aria-label="${t("Giù", "Down")} · ${esc(nm(id))}">${ICO.giu}</button>` : ""}</div>`;
function tessera(id) {
  const k = aspetto(id), un = !ok(id), p = pos(id), lato = latoDi(id), conPos = attr(id, "current_position") != null;
  const st = un ? "un" : muove(id) ? "mv" : p >= 100 && aperta(id) ? "op" : !aperta(id) ? "cl" : "md";
  const tl = puoTilt(id) ? Math.round(+attr(id, "current_tilt_position")) : null;
  const corpo = `<div class="tp1t st-${st}">
    <div class="tp1w ${puoPos(id) ? "pos" : ""}" ${un || UI.edit ? "" : `data-tpg="${id}" data-k="${k}" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-valuetext="${esc(statoTesto(id))}" aria-label="${esc(nm(id))}"`}>${disegno(id)}
      ${conPos && !un ? `<span class="tp1p" data-tpp>${p}%</span>` : ""}</div>
    <div class="tp1n"><b>${esc(nm(id))}</b><span>${esc(statoTesto(id))}${lato ? ` · <i title="${esc(nomeLato(lato))}">🧭 ${esc(sigla(lato))}</i>` : ""}</span></div>
    ${un ? "" : pulsanti(id)}
    ${tl != null && !un ? `<label class="tp1tl"><span>${t("Lamelle", "Slats")}</span><input type="range" min="0" max="100" step="5" value="${tl}" data-chg="tpTilt" data-id="${id}" aria-label="${t("Lamelle", "Slats")} · ${esc(nm(id))}"><em>${tl}%</em></label>` : ""}
  </div>`;
  if (!UI.edit || !isAdmin()) return corpo;
  return `<div class="ed1">${corpo}<div class="edb"><button data-act="tpEd" data-id="${id}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="tpTogli" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}
const rapidi = (dove, piccoli) => { const n = esc(nomeDove(dove)), b = (v, ic, testo, aria) => `<button data-act="tpGr" data-dove="${esc(dove)}" data-v="${v}" aria-label="${aria} · ${n}" title="${aria}">${ic}${piccoli || !testo ? "" : `<span>${testo}</span>`}</button>`;
  return `<div class="tp1q ${piccoli ? "sm" : ""}" role="group" aria-label="${n}">${b("su", ICO.su, t("Tutte su", "All up"), t("Tutte su", "All up"))}${b("meta", ICO.meta, t("Metà", "Half"), t("Tutte a metà", "All halfway"))}${b("giu", ICO.giu, t("Tutte giù", "All down"), t("Tutte giù", "All down"))}${piccoli ? "" : b("stop", ICO.stop, "", t("Ferma tutte", "Stop all"))}</div>`; };
function conta(L) {
  const A = L.filter(aperta), M = L.filter(id => ok(id) && attr(id, "current_position") != null && pos(id) > 0 && pos(id) < 100);
  return { tot: L.length, aperte: A.length, meta: M.length, chiuse: L.filter(id => ok(id) && !aperta(id)).length, muovono: L.filter(muove).length, un: L.filter(id => !ok(id)).length };
}
/** «2 del tutto · 3 a metà · 3 chiuse · 1 non raggiungibile» (sotto il numero delle aperte) */
const riassunto = n => [n.aperte && n.meta ? (n.aperte - n.meta ? t(`${n.aperte - n.meta} del tutto`, `${n.aperte - n.meta} fully`) + " · " : "") + t(`${n.meta} a metà`, `${n.meta} partly`) : "",
  t(`${n.chiuse} chius${n.chiuse === 1 ? "a" : "e"}`, `${n.chiuse} closed`), n.muovono ? t(`${n.muovono} in movimento`, `${n.muovono} moving`) : "",
  n.un ? t(`${n.un} non raggiungibil${n.un === 1 ? "e" : "i"}`, `${n.un} unavailable`) : ""].filter(Boolean).join(" · ");
/** riga breve per una stanza: «1 aperta su 2», «tutte chiuse», «non raggiungibile» */
function breve(n) {
  const v = n.tot - n.un; if (!v) return t(n.tot === 1 ? "non raggiungibile" : "non raggiungibili", "unavailable");
  if (!n.aperte) return v === 1 ? t("chiusa", "closed") : t("tutte chiuse", "all closed");
  if (n.aperte === v && !n.meta) return v === 1 ? t("aperta", "open") : t("tutte aperte", "all open");
  return t(`${n.aperte} apert${n.aperte === 1 ? "a" : "e"} su ${v}`, `${n.aperte} of ${v} open`);
}
function doveAttuale() { const d = sGet("tpDove") || "casa"; return doveScelte().some(([k]) => k === d) ? d : "casa"; }
function schedaGruppi() {
  const L = tutte(), n = conta(L), d = doveAttuale(), S1 = doveScelte().filter(([k]) => !k.startsWith("stanza:"));
  return card("🪟 " + t("Gruppi rapidi", "Quick groups"), `<div class="tp1s"><b>${n.aperte}</b><span>${t(`apert${n.aperte === 1 ? "a" : "e"} su ${n.tot}`, `open of ${n.tot}`)}<small>${esc(riassunto(n))}</small></span></div>
    ${S1.length > 1 ? `<div class="seg tp1dv" role="group" aria-label="${t("Quali", "Which")}">${S1.map(([k, nome, q]) => `<button class="${d === k ? "act" : ""}" data-act="tpDove" data-v="${esc(k)}" aria-pressed="${d === k}">${esc(nome)} <em>${q}</em></button>`).join("")}</div>` : ""}
    ${rapidi(d)}
    ${isAdmin() && !LATI().some(([k]) => inDove("lato:" + k, L).length) ? `<p class="small muted tp1nt">${t("Vuoi comandarle per lato della casa (nord, sud, est, ovest)? Premi ✏️ Modifica e scegli il lato di ogni tapparella.", "Want to control them by side of the house (north, south, east, west)? Press ✏️ Edit and choose each cover's side.")}</p>` : ""}`,
    { cls: "span3 tp1gr", right: isAdmin() ? `<button class="btn sm" data-act="tpCfg" aria-label="${t("Impostazioni", "Settings")}">⚙️</button>` : "" });
}
function stanze() {
  const L = tutte(), per = {}; L.forEach(id => (per[stanzaDi(id)] = per[stanzaDi(id)] || []).push(id));
  const o = areasSorted(true), K = Object.keys(per).sort((a, b) => (o.indexOf(a) < 0 ? 999 : o.indexOf(a)) - (o.indexOf(b) < 0 ? 999 : o.indexOf(b)));
  const piani = [...new Set(K.map(a => AREAS[a]?.floor || "_"))]; let fp = null;
  return K.map(a => {
    const f = AREAS[a]?.floor || "_", tit = piani.length > 1 && f !== fp ? `<h3 class="tp1fl spanall">${esc(FLOORS[f]?.name || t("Altre stanze", "Other rooms"))}</h3>` : ""; fp = f;
    const I = per[a], n = conta(I);
    return tit + card(`${esc(nomeDove("stanza:" + a))} <small class="tp1c">${esc(breve(n))}</small>`, `<div class="tp1g">${I.map(tessera).join("")}</div>`,
      { cls: I.length >= 5 ? "span3" : I.length >= 3 ? "span2" : "", right: I.length > 1 ? rapidi("stanza:" + a, true) : "" });
  }).join("");
}

/* ---------- scenari: script «'Nduja», riusabili nei Momenti ---------- */
const scenari = () => (C().scenari || []).filter(s => s && s.id);
const SCRIPT = s => "nduja_tapp_" + s.id;
VISTE.tapScenari = () => scenari().map(s => ({ id: "script." + SCRIPT(s), nome: s.nome, icona: s.icona })).filter(x => S[x.id]);
const ICONE = ["🌙", "☀️", "😎", "🔥", "🛏️", "🎬", "🍽️", "🏖️", "🌧️", "💨", "🔒", "🪟"];
const PRONTI = () => [
  { nome: t("Notte", "Night"), icona: "🌙", passi: [{ dove: "casa", cosa: "giu" }] },
  { nome: t("Mattina", "Morning"), icona: "☀️", passi: [{ dove: "casa", cosa: "su" }] },
  { nome: t("Sole forte", "Strong sun"), icona: "😎", passi: [{ dove: "lato:s", cosa: "pos", pos: meta() }] },
];
function azioniPasso(p) {
  const L = inDove(p.dove); if (!L.length) return [];
  const v = p.cosa === "su" ? 100 : p.cosa === "giu" ? 0 : clamp(Math.round(+p.pos || 0), 0, 100);
  if (v >= 100) return [{ action: "cover.open_cover", target: { entity_id: L }, continue_on_error: true }];
  if (v <= 0) return [{ action: "cover.close_cover", target: { entity_id: L }, continue_on_error: true }];
  const P = L.filter(puoPos); return P.length ? [{ action: "cover.set_cover_position", target: { entity_id: P }, data: { position: v }, continue_on_error: true }] : [];
}
const scriptCfg = s => ({ alias: `${s.icona || "🪟"} ${s.nome}`, icon: "mdi:window-shutter", mode: "restart",
  description: t("Scenario delle tapparelle creato con 'Nduja Dashboard (pagina Tapparelle). Le tapparelle si aggiornano da sole quando cambi stanze o lati nella plancia.",
    "Covers scene created with 'Nduja Dashboard (Covers page). Covers update by themselves when you change rooms or sides in the dashboard."),
  sequence: (s.passi || []).flatMap(azioniPasso) });
function quanteMuove(s) { return new Set((s.passi || []).flatMap(p => p.cosa === "pos" && clamp(+p.pos || 0, 0, 100) % 100 ? inDove(p.dove).filter(puoPos) : inDove(p.dove))).size; }
async function eseguiScenario(s) {
  const sid = "script." + SCRIPT(s);
  if (S[sid]) return svc("script", "turn_on", {}, { entity_id: sid }).then(() => toast(`${s.icona || "🪟"} ${s.nome}`));
  for (const p of s.passi || []) await gruppo(inDove(p.dove), p.cosa === "pos" ? "pos" : p.cosa, p.cosa === "pos" ? clamp(+p.pos || 0, 0, 100) : undefined);   // script non ancora in Home Assistant: li muovo da qui
  toast(`${s.icona || "🪟"} ${s.nome}`);
}
function schedaScenari() {
  const L = scenari(), adm = isAdmin();
  if (!L.length && !adm) return "";
  const manca = s => adm && tolta(C().firme || {}, SCRIPT(s)) && !S["script." + SCRIPT(s)];
  return card("🎬 " + t("Scenari", "Scenes"), `<div class="tp1sc">${L.map((s, i) => `<button class="tp1sb ${manca(s) ? "ko" : ""}" data-act="tpScRun" data-i="${i}"><span>${esc(s.icona || "🪟")}</span><b>${esc(s.nome)}</b>
      <small>${esc((s.passi || []).map(passoTesto).join(" · "))}</small>
      ${UI.edit && adm ? `<i data-act="tpScEd" data-i="${i}" role="button" aria-label="${t("Modifica", "Edit")}">✏️</i>` : ""}</button>`).join("")}
    ${adm ? (L.length ? `<button class="tp1sb add" data-act="tpScNew"><span>＋</span><b>${t("Nuovo scenario", "New scene")}</b></button>`
      : PRONTI().map((p, i) => `<button class="tp1sb add" data-act="tpScNew" data-p="${i}"><span>${p.icona}</span><b>＋ ${esc(p.nome)}</b><small>${esc(p.passi.map(passoTesto).join(" · "))}</small></button>`).join("")) : ""}</div>
    ${adm ? `<p class="small muted tp1nt">${L.some(manca) ? "⚠️ " + t("Uno scenario non c'è più in Home Assistant: aprilo con ✏️ e premi Salva per ricrearlo. ", "A scene is missing from Home Assistant: open it with ✏️ and press Save to recreate it. ") : ""}${t("Ogni scenario è uno script di Home Assistant con l'etichetta «'Nduja»: lo puoi usare nei Momenti, nelle automazioni e con gli assistenti vocali.", "Each scene is a Home Assistant script with the «'Nduja» label: use it in Moments, automations and voice assistants.")}</p>` : ""}`,
    { cls: "span3", right: adm && L.length && !UI.edit ? `<button class="btn sm" data-act="edToggle" aria-label="${t("Modifica", "Edit")}">✏️</button>` : "" });
}
/* editor */
let SC = null, scNuovo = false;
function foglioScenario() {
  const D = doveScelte(true), n = quanteMuove(SC);
  const sel = (i, p) => `<select data-chg="tpScP" data-i="${i}" data-k="dove" aria-label="${t("Quali", "Which")}">${D.map(([k, nome, q]) => `<option value="${esc(k)}" ${p.dove === k ? "selected" : ""}>${esc(nome)} (${q})</option>`).join("")}</select>`;
  const passo = (p, i) => `<div class="tp1ps"><b>${i + 1}</b>${sel(i, p)}
    <select data-chg="tpScP" data-i="${i}" data-k="cosa" aria-label="${t("Cosa", "What")}">${[["su", "▲ " + t("Su (aperte)", "Up (open)")], ["giu", "▼ " + t("Giù (chiuse)", "Down (closed)")], ["pos", t("A una posizione…", "To a position…")]].map(([k, x]) => `<option value="${k}" ${p.cosa === k ? "selected" : ""}>${x}</option>`).join("")}</select>
    ${p.cosa === "pos" ? `<label class="tp1pc"><input type="number" min="0" max="100" step="5" value="${clamp(Math.round(+p.pos || 0), 0, 100)}" data-chg="tpScP" data-i="${i}" data-k="pos" aria-label="${t("Posizione", "Position")}"><span>%</span></label>` : ""}
    <button class="dx" data-act="tpScPDel" data-i="${i}" aria-label="${t("Togli", "Remove")}">✕</button></div>`;
  return `<div class="sh-head"><div><h3>${esc(SC.icona || "🪟")} ${scNuovo ? t("Nuovo scenario", "New scene") : esc(SC.nome)}</h3><div class="small muted">${t("Un pulsante che muove le tapparelle come vuoi. Si salva in Home Assistant come script.", "One button that moves your covers the way you want. Saved in Home Assistant as a script.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${scNuovo ? `<div class="vr1" style="margin-bottom:8px">${PRONTI().map((p, i) => `<button data-act="tpScPronto" data-i="${i}">${p.icona} ${esc(p.nome)}</button>`).join("")}</div>` : ""}
    <label class="fld1"><span>${t("Nome", "Name")}</span><input type="text" value="${esc(SC.nome || "")}" data-chg="tpScF" data-k="nome" placeholder="${t("Notte", "Night")}"></label>
    <div class="ico1" style="margin-top:8px">${ICONE.map(ic => `<button class="${SC.icona === ic ? "on" : ""}" data-act="tpScIco" data-v="${ic}">${ic}</button>`).join("")}</div>
    <div class="fl1">${t("Cosa fa", "What it does")}</div><div class="stack">${(SC.passi || []).map(passo).join("")}</div>
    <button class="add1" data-act="tpScPAdd" style="margin-top:8px"><span>＋</span>${t("Aggiungi un passo", "Add a step")}</button>
    <p class="small muted" style="margin-top:10px">${n ? t(`Muove ${n} tapparell${n === 1 ? "a" : "e"}.`, `Moves ${n} cover${n === 1 ? "" : "s"}.`) : "⚠️ " + t("Per ora non muove nessuna tapparella.", "Right now it moves no cover.")} ${t("Quelle senza posizione si muovono solo con «Su» e «Giù».", "Covers without position move only with «Up» and «Down».")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="tpScSave">💾 ${t("Salva", "Save")}</button>${!scNuovo ? `<button class="btn bad" data-act="tpScDel">🗑 ${t("Elimina", "Delete")}</button>` : ""}</div>`;
}
CHG.tpScF = el => { SC[el.dataset.k] = el.value; };
CHG.tpScP = el => { const p = SC.passi[+el.dataset.i]; p[el.dataset.k] = el.dataset.k === "pos" ? clamp(Math.round(+el.value || 0), 0, 100) : el.value; if (p.cosa === "pos" && p.pos == null) p.pos = meta(); render(); };

/* ---------- automatismi (facoltativi, creati su richiesta): automazioni con l'etichetta «'Nduja» ---------- */
const AUTO_DEF = () => ({ sole: { on: false, dove: "casa", chiudi: true, apri: true, rt: 15, ra: 0, dopo: "07:00" },
  caldo: { on: false, lati: ["s", "o"], temp: unitaT() === "°F" ? 79 : 26, pos: meta(), el: 10, sole: true, sens: "" }, finestra: { on: false } });
const AU = k => ({ ...AUTO_DEF()[k], ...(C().auto?.[k] || {}) });
const AID = { sole: "nduja_tapp_sole", caldo: "nduja_tapp_caldo", finestra: "nduja_tapp_finestra" };
const ritardo = m => { const o = Math.round(+m || 0), a = Math.abs(o); return `${o < 0 ? "-" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}:00`; };
const dict = F => JSON.stringify(F).replace(/'/g, "");
/** azioni che chiudono (o portano a una posizione) saltando le tapparelle con la finestra aperta, se l'automatismo della finestra è acceso */
function chiudiSicuro(L, posizione) {
  const F = AU("finestra").on ? coppie(L) : {}, nuda = posizione == null;
  if (!L.length) return [];
  if (nuda && !Object.keys(F).length) return [{ action: "cover.close_cover", target: { entity_id: L }, continue_on_error: true }];
  const cond = [`{% set f = ${dict(F)} %}{{ repeat.item not in f or not is_state(f[repeat.item], 'on') }}`];
  if (!nuda) cond.push(`{{ (state_attr(repeat.item, 'current_position') | int(0)) > ${posizione} }}`);
  return [{ repeat: { for_each: L, sequence: [{ if: cond.map(v => ({ condition: "template", value_template: v })),
    then: [nuda ? { action: "cover.close_cover", target: { entity_id: "{{ repeat.item }}" }, continue_on_error: true }
      : { action: "cover.set_cover_position", target: { entity_id: "{{ repeat.item }}" }, data: { position: posizione }, continue_on_error: true }] }] } }];
}
function cfgSole() {
  const a = AU("sole"), L = inDove(a.dove); if (!a.on || !L.length || (!a.chiudi && !a.apri)) return null;
  const tr = [], ch = [];
  if (a.chiudi) { tr.push({ trigger: "sun", event: "sunset", offset: ritardo(a.rt), id: "chiudi" }); ch.push({ conditions: [{ condition: "trigger", id: "chiudi" }], sequence: chiudiSicuro(L) }); }
  if (a.apri) {
    const apri = [{ action: "cover.open_cover", target: { entity_id: L }, continue_on_error: true }], ora = /^\d\d:\d\d$/.test(a.dopo || "") ? a.dopo + ":00" : null;
    tr.push({ trigger: "sun", event: "sunrise", offset: ritardo(a.ra), id: "alba" });
    ch.push({ conditions: [{ condition: "trigger", id: "alba" }, ...(ora ? [{ condition: "time", after: ora }] : [])], sequence: apri });
    if (ora) { tr.push({ trigger: "time", at: ora, id: "ora" });   // l'alba è già passata prima di quest'ora: apro all'ora scelta
      ch.push({ conditions: [{ condition: "trigger", id: "ora" }, { condition: "sun", after: "sunrise", after_offset: ritardo(a.ra), before: "sunset" }], sequence: apri }); }
  }
  return { alias: "'Nduja · " + t("tapparelle al tramonto e all'alba", "covers at sunset and sunrise"),
    description: t("Creata da 'Nduja Dashboard (pagina Tapparelle): chiude al tramonto e apre all'alba, con il ritardo scelto. Si aggiorna da sola quando cambi le scelte nella plancia.",
      "Created by 'Nduja Dashboard (Covers page): closes at sunset and opens at sunrise, with the chosen delay. It updates itself when you change your choices in the dashboard."),
    triggers: tr, conditions: [], actions: [{ choose: ch }], mode: "single" };
}
/** temperatura per «caldo»: il sensore scelto, altrimenti quello esterno trovato dalla pagina Meteo, altrimenti il meteo di casa */
function fonteT(a = AU("caldo")) {
  const s = a.sens && S[a.sens] ? a.sens : (() => { try { return sensore("temp"); } catch { return null; } })();
  if (s) return { id: s, tpl: `states('${s}') | float(-99)`, v: +S[s]?.state, u: unit(s) || "°C" };
  const w = weatherEnt(); if (w) return { id: w, tpl: `state_attr('${w}', 'temperature') | float(-99)`, v: +attr(w, "temperature"), u: attr(w, "temperature_unit") || "°C" };
  return null;
}
function unitaT() { try { return fonteT({})?.u || "°C"; } catch { return "°C"; } }
const AZ = { n: "(az >= 315 or az < 45)", e: "(az >= 45 and az < 135)", s: "(az >= 135 and az < 225)", o: "(az >= 225 and az < 315)" };
const latoDelSole = az => az >= 315 || az < 45 ? "n" : az < 135 ? "e" : az < 225 ? "s" : "o";
function cfgCaldo() {
  const a = AU("caldo"), T = fonteT(a); if (!a.on || !T) return null;
  const P = clamp(Math.round(+a.pos || 50), 0, 95), per = (a.lati || []).map(l => [l, tutte().filter(id => latoDi(id) === l && puoPos(id))]).filter(([, L]) => L.length);
  if (!per.length) return null;
  const w = a.sole ? weatherEnt() : null;
  const tpl = l => `{% set az = state_attr('sun.sun', 'azimuth') | float(-1) %}{% set el = state_attr('sun.sun', 'elevation') | float(-90) %}{% set t = ${T.tpl} %}{{ el >= ${+a.el || 0} and t >= ${+a.temp} and ${AZ[l]}${w ? ` and states('${w}') in ['sunny', 'partlycloudy']` : ""} }}`;
  const seq = per.map(([l, L]) => ({ conditions: [{ condition: "trigger", id: l }], sequence: chiudiSicuro(L, P) }));
  return { alias: "'Nduja · " + t("tapparelle col sole e il caldo", "covers in sun and heat"),
    description: t("Creata da 'Nduja Dashboard (pagina Tapparelle): quando fa caldo e il sole batte su un lato della casa, porta a metà le tapparelle di quel lato (solo quelle più aperte). Si aggiorna da sola quando cambi le scelte nella plancia.",
      "Created by 'Nduja Dashboard (Covers page): when it's hot and the sun hits one side of the house, it brings that side's covers halfway down (only the ones more open). It updates itself when you change your choices in the dashboard."),
    triggers: per.map(([l]) => ({ trigger: "template", value_template: tpl(l), id: l })), conditions: [], actions: [{ choose: seq }], mode: "queued" };
}
function cfgFinestra() {
  const a = AU("finestra"); if (!a.on) return null;
  const F = coppie(tutte()), K = Object.keys(F); if (!K.length) return null;
  const ferma = K.filter(puoStop);
  return { alias: "'Nduja · " + t("tapparelle e finestre aperte", "covers and open windows"),
    description: t("Creata da 'Nduja Dashboard (pagina Tapparelle): se una tapparella si chiude mentre la sua finestra è aperta, la ferma (o la riapre se non si può fermare). Si aggiorna da sola quando cambi le scelte nella plancia.",
      "Created by 'Nduja Dashboard (Covers page): if a cover closes while its window is open, it stops it (or opens it again if it can't stop). It updates itself when you change your choices in the dashboard."),
    triggers: [{ trigger: "state", entity_id: K, to: "closing" }],
    conditions: [{ condition: "template", value_template: `{% set f = ${dict(F)} %}{{ is_state(f.get(trigger.entity_id, ''), 'on') }}` }],
    actions: [{ action: `{{ 'cover.stop_cover' if trigger.entity_id in ${dict(ferma)} else 'cover.open_cover' }}`, target: { entity_id: "{{ trigger.entity_id }}" } }], mode: "parallel" };
}
const CFG = { sole: cfgSole, caldo: cfgCaldo, finestra: cfgFinestra };

/* ---------- sincronizzazione: scenari e automatismi si aggiornano da soli quando cambiano le scelte (solo amministratori) ---------- */
const impronta = c => { const s = JSON.stringify({ ...c, alias: undefined, description: undefined }); let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
const oggetti = () => [...scenari().map(s => ({ tipo: "script", id: SCRIPT(s), cfg: () => scriptCfg(s) })),
  ...Object.keys(AID).filter(k => AU(k).on).map(k => ({ tipo: "automation", id: AID[k], cfg: CFG[k] }))];
const entitaDi = o => o.tipo === "script" ? (S["script." + o.id] ? "script." + o.id : null) : Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === o.id) || null;
async function scrivi(o, cfg) {
  const nuova = !entitaDi(o);
  await api("POST", `/api/config/${o.tipo}/config/${o.id}`, o.tipo === "automation" ? { id: o.id, ...cfg } : cfg);
  if (nuova) etichettaNduja(() => entitaDi(o));   // nuova: etichetta «'Nduja»
}
/* firme: impronta dell'ultima versione scritta; "-" = tolta da me perché non c'era niente da fare (si ricrea da sola) */
const tolta = (F, id) => F[id] && F[id] !== "-";
let coda = null, ultimo = 0;
/** allinea Home Assistant alle scelte: crea o aggiorna quello che è cambiato e toglie gli automatismi rimasti senza tapparelle.
    Quello che l'utente ha cancellato in Home Assistant non lo ricrea da sola: lo fanno «Ricrea» e «Salva» (solo = id da forzare). */
async function esegui(solo) {
  if (!isAdmin() || !pronto()) return;
  const F = { ...(C().firme || {}) }; let cambiato = false;
  try {
    for (const o of oggetti()) {
      const cfg = o.cfg(), e = entitaDi(o);
      if (!cfg) { if (e && o.tipo === "automation") await api("DELETE", `/api/config/automation/config/${o.id}`); if (F[o.id] !== "-" && (F[o.id] || e)) { F[o.id] = "-"; cambiato = true; } continue; }
      const f = impronta(cfg);
      if (solo !== o.id && e && F[o.id] === f) continue;
      if (solo !== o.id && !e && tolta(F, o.id)) continue;
      await scrivi(o, cfg); F[o.id] = f; cambiato = true;
    }
    if (cambiato) await tpCambia(c => { c.firme = F; });
  } catch (e) { toast(t("Home Assistant non ha accettato: ", "Home Assistant refused: ") + (e.message || e), true); }
  finally { ultimo = Date.now(); render(); }
}
/** in fila: una sincronizzazione alla volta */
function sincronizza(solo) { const p = (coda || Promise.resolve()).then(() => esegui(solo)); coda = p; p.finally(() => { if (coda === p) coda = null; }); return p; }
HOOKS.push(() => { if (isAdmin() && !coda && Date.now() - ultimo > 5000 && LAYOUT.tapparelle && pronto()) { ultimo = Date.now(); setTimeout(() => sincronizza(), 0); } });

function schedaAuto() {
  const adm = isAdmin(), L = tutte();
  const stato = k => { const o = { tipo: "automation", id: AID[k] }, e = entitaDi(o), a = AU(k), cfg = a.on ? CFG[k]() : null;
    if (!a.on) return ["off", t("Spento", "Off")];
    if (!cfg) return ["warn", t("In attesa", "Waiting")];
    if (!e) return tolta(C().firme || {}, AID[k]) ? ["bad", t("Tolta da Home Assistant", "Removed from Home Assistant")] : ["warn", t("Da creare", "To create")];
    return S[e].state === "on" ? ["ok", t("Attivo", "On")] : ["warn", t("Spento in Home Assistant", "Off in Home Assistant")]; };
  const riga = (k, ic, tit, spiega, corpo) => { const [c, n] = stato(k), a = AU(k), e = entitaDi({ tipo: "automation", id: AID[k] });
    return `<div class="tp1au ${a.on ? "on" : ""}"><div class="tp1ah"><span class="ic">${ic}</span><div class="tx"><b>${tit}</b><span>${spiega}</span><em class="tag ${c} tp1tm">${esc(n)}</em></div>
      <span class="tag ${c} tp1tg">${esc(n)}</span>${adm ? `<button class="sw ${a.on ? "on" : ""}" data-act="tpAuto" data-k="${k}" aria-label="${esc(tit)}" aria-pressed="${!!a.on}"><i></i></button>` : ""}</div>
      ${a.on && adm ? `<div class="tp1af">${corpo}${c === "bad" ? `<button class="btn sm" data-act="tpRicrea" data-k="${k}">↻ ${t("Ricrea", "Recreate")}</button>` : ""}${e ? `<button class="btn sm ghost" data-act="more" data-id="${e}">${t("Apri in Home Assistant", "Open in Home Assistant")} ›</button>` : ""}</div>` : ""}</div>`; };
  const num = (k, campo, v, min, max, step, lab, u) => `<label class="fld1 tp1n2"><span>${lab}</span><span class="tp1in"><input type="number" min="${min}" max="${max}" step="${step}" value="${esc(v)}" data-chg="tpAuF" data-k="${k}" data-f="${campo}"><em>${esc(u)}</em></span></label>`;
  const spunta = (k, campo, v, lab) => `<label class="tp1ck"><input type="checkbox" ${v ? "checked" : ""} data-chg="tpAuF" data-k="${k}" data-f="${campo}"> ${lab}</label>`;
  /* chiudi al tramonto, apri all'alba */
  const s = AU("sole"), D = doveScelte(true);
  const corpoSole = `<label class="fld1"><span>${t("Quali tapparelle", "Which covers")}</span><select data-chg="tpAuF" data-k="sole" data-f="dove">${D.map(([k, nome, q]) => `<option value="${esc(k)}" ${s.dove === k ? "selected" : ""}>${esc(nome)} (${q})</option>`).join("")}</select></label>
    <div class="tp1fr">${spunta("sole", "chiudi", s.chiudi, "🌇 " + t("Chiudi al tramonto", "Close at sunset"))}${s.chiudi ? num("sole", "rt", s.rt, -180, 240, 5, t("Minuti dopo il tramonto (−30 = mezz'ora prima)", "Minutes after sunset (−30 = half an hour before)"), "min") : ""}</div>
    <div class="tp1fr">${spunta("sole", "apri", s.apri, "🌅 " + t("Apri all'alba", "Open at sunrise"))}${s.apri ? num("sole", "ra", s.ra, -180, 240, 5, t("Minuti dopo l'alba", "Minutes after sunrise"), "min")
      + `<label class="fld1 tp1n2"><span>${t("Non prima delle (vuoto = nessun limite)", "Not before (empty = no limit)")}</span><input type="time" value="${esc(s.dopo || "")}" data-chg="tpAuF" data-k="sole" data-f="dopo"></label>` : ""}</div>`;
  /* caldo e sole sul lato */
  const c = AU("caldo"), T = fonteT(c), az = +attr("sun.sun", "azimuth"), el = +attr("sun.sun", "elevation"), w = weatherEnt();
  const conLato = LATI().map(([k]) => [k, L.filter(id => latoDi(id) === k && puoPos(id)).length]);
  const corpoCaldo = `<div class="fl1">${t("Lati della casa", "Sides of the house")}</div><div class="vr1">${LATI().map(([k, nome]) => { const q = conLato.find(x => x[0] === k)[1];
      return `<button class="${(c.lati || []).includes(k) ? "on" : ""}" data-act="tpAuLato" data-v="${k}" aria-pressed="${(c.lati || []).includes(k)}">🧭 ${esc(nome)} <em class="tp1q0">${q}</em></button>`; }).join("")}</div>
    ${!conLato.some(([k, q]) => q && (c.lati || []).includes(k)) ? `<p class="small tp1wn">⚠️ ${t("Nessuna tapparella con la posizione su questi lati: scegli il lato di ogni tapparella con ✏️ Modifica.", "No cover with position on these sides: choose each cover's side with ✏️ Edit.")}</p>` : ""}
    <div class="tp1fr">${num("caldo", "temp", c.temp, -20, 120, .5, t("Quando fuori ci sono almeno", "When it's at least this hot outside"), T?.u || "°C")}${num("caldo", "pos", c.pos, 0, 95, 5, t("Porta le tapparelle al", "Bring covers to"), "%")}${num("caldo", "el", c.el, 0, 60, 1, t("Sole alto almeno", "Sun at least this high"), "°")}</div>
    <button class="li tp1ts" data-act="tpAuSens"><span class="ic">🌡️</span><div class="tx"><b>${T ? esc(nm(T.id)) : t("Nessuna temperatura esterna", "No outdoor temperature")}</b><span>${c.sens && S[c.sens] ? t("scelto da te", "chosen by you") : "✨ " + t("automatico", "automatic")}${T && !isNaN(T.v) ? " · " + t("adesso ", "now ") + fnum(T.v) + " " + esc(T.u) : ""}</span></div><span class="st">›</span></button>
    ${w ? spunta("caldo", "sole", c.sole, "☀️ " + t(`Solo se il meteo dice sole (${nm(w)})`, `Only if the weather says sunny (${nm(w)})`)) : ""}
    ${!isNaN(az) ? `<p class="small muted tp1nt">${el > 0 ? t(`Adesso il sole è a ${nomeLato(latoDelSole(az)).toLowerCase()} (${Math.round(az)}°), alto ${Math.round(el)}°.`, `The sun is now ${nomeLato(latoDelSole(az)).toLowerCase()} (${Math.round(az)}°), ${Math.round(el)}° high.`) : t("Adesso il sole è sotto l'orizzonte.", "The sun is below the horizon now.")} ${t("Lato nord: da 315° a 45°, est: 45°-135°, sud: 135°-225°, ovest: 225°-315°.", "North side: 315° to 45°, east: 45°-135°, south: 135°-225°, west: 225°-315°.")}</p>` : ""}`;
  /* finestra aperta */
  const F = coppie(L), K = Object.keys(F);
  const corpoFin = K.length ? `<div class="stack">${K.map(id => `<div class="li tp1cp"><span class="ic">${isOnF(F[id]) ? "🔓" : "🔒"}</span><div class="tx"><b>${esc(nm(id))}</b><span>↔ ${esc(nm(F[id]))}${isOnF(F[id]) ? " · " + t("aperta adesso", "open now") : ""}</span></div></div>`).join("")}</div>
      <p class="small muted tp1nt">${t("Ferma la tapparella appena comincia a chiudersi (scenari, telecomandi, Alexa, tutto). Funziona con le tapparelle che dicono a Home Assistant «si sta chiudendo». Anche gli altri automatismi le saltano.", "Stops the cover as soon as it starts closing (scenes, remotes, Alexa, anything). Works with covers that tell Home Assistant «closing». The other automations skip them too.")}</p>`
    : `<p class="small tp1wn">⚠️ ${t("Nessuna tapparella ha un sensore della finestra: sceglilo con ✏️ Modifica sulla tapparella.", "No cover has a window sensor: choose it with ✏️ Edit on the cover.")}</p>`;
  return card("⏱️ " + t("Automatismi", "Automations"), `<div class="stack">
    ${riga("sole", "🌇", t("Chiudi al tramonto, apri all'alba", "Close at sunset, open at sunrise"), t("Con un ritardo, e senza aprire troppo presto.", "With a delay, and without opening too early."), corpoSole)}
    ${riga("caldo", "☀️", t("Mezze chiuse col sole e il caldo", "Half closed in sun and heat"), t("Quando fa caldo e il sole batte su un lato, porta a metà le tapparelle di quel lato.", "When it's hot and the sun hits a side, brings that side's covers halfway."), corpoCaldo)}
    ${riga("finestra", "🪟", t("Non chiudere con la finestra aperta", "Don't close with the window open"), t("Per le tapparelle che hanno il sensore della finestra.", "For covers with a window sensor."), corpoFin)}</div>
    ${adm ? `<p class="small muted tp1nt">${t("Ognuno è un'automazione di Home Assistant con l'etichetta «'Nduja», creata solo quando lo accendi. Si aggiorna da sola quando cambi queste scelte, le stanze o i lati.", "Each one is a Home Assistant automation with the «'Nduja» label, created only when you turn it on. It updates itself when you change these choices, rooms or sides.")}</p>` : ""}`, { cls: "span3" });
}
const isOnF = id => S[id]?.state === "on";

/** ✏️: aggiungere tapparelle e rimettere quelle tolte */
function schedaModifica() {
  if (!UI.edit || !isAdmin()) return "";
  const tolte = (C().tolte || []).filter(id => S[id]);
  return card("✏️ " + t("Tapparelle e tende", "Covers"), `<div class="stack">
    <button class="add1" data-act="tpAdd"><span>＋</span>${t("Aggiungi una tapparella o una tenda", "Add a cover")}</button>
    ${tolte.map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${t("tolta da questa pagina: è nella pagina Prese", "removed from this page: it's on the Plugs page")}</span></div><button class="btn sm" data-act="tpRimetti" data-id="${id}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>
    <p class="small muted tp1nt">${t("Tocca ✏️ su una tapparella per scegliere il lato della casa, l'aspetto e il sensore della finestra.", "Tap ✏️ on a cover to choose its side of the house, its look and its window sensor.")}</p>`, { cls: "span3" });
}
function pagina() {
  const L = tutte();
  if (!L.length) return `<div class="g g3">${card("🪟 " + t("Tapparelle e tende", "Covers"), `<div class="empty">${t("Nessuna tapparella: premi ✏️ Modifica e ＋ per aggiungerne.", "No covers: press ✏️ Edit and ＋ to add some.")}</div>`, { cls: "span3" })}${schedaModifica()}</div>`;
  for (const id of Object.keys(TGT)) if (!S[id] || Math.abs(pos(id) - TGT[id].p) <= 2 || Date.now() - TGT[id].da > 120e3) delete TGT[id];
  return `<div class="g g3">${schedaGruppi()}${schedaScenari()}${stanze()}${schedaAuto()}${schedaModifica()}</div>`;
}

/* ---------- Home: quante sono aperte e i pulsanti rapidi ---------- */
function homeCard() {
  const L = tutte(), n = conta(L), V = L.slice(0, 8);
  return card("🪟 " + t("Tapparelle", "Covers"), `<button class="tp1hm" data-act="go" data-id="tapparelle"><span class="tp1s sm"><b>${n.aperte}</b><span>${t(`apert${n.aperte === 1 ? "a" : "e"} su ${n.tot}`, `open of ${n.tot}`)}<small>${esc(riassunto(n))}</small></span></span>
      <span class="tp1mm">${V.map(id => disegno(id, "xs")).join("")}</span></button>${rapidi("casa")}`, { link: [t("Tutte", "All"), "tapparelle"] });
}
HOME_EXTRA.tapparelle = { title: () => t("Tapparelle", "Covers"), render: homeCard, show: () => tutte().length > 0 };
/** riga compatta per la finestra della stanza (Home): null se non è una tapparella della pagina */
VISTE.tapRiga = id => !tutte().includes(id) ? null : `<div class="li tp1r ${ok(id) ? "" : "dis"}"><span class="tp1rd">${disegno(id, "xs")}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc(statoTesto(id))}</span></div>${ok(id) ? pulsanti(id, true) : ""}</div>`;

/* ---------- ✏️ una tapparella ---------- */
let ED = null;
function foglioTapp() {
  const id = ED; if (!S[id]) return "";
  const r = LAYOUT.rooms?.[id] || "", haA = REG[id]?.area, lato = latoDi(id), asp = C().aspetto?.[id] || "", fv = C().finestre?.[id] || "", fin = finestraDi(id), fa = finestraAuto(id);
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted mono">${esc(id)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome nella plancia", "Name in the dashboard")}</span><input id="tp1nn" type="text" value="${esc(LAYOUT.names?.[id] || "")}" placeholder="${esc(nmHA(id))}"></label>
    <label class="fld1"><span>${t("Stanza", "Room")}</span><select id="tp1rr"><option value="">${haA && AREAS[haA] ? t("Come in Home Assistant", "As in Home Assistant") + ` (${esc(AREAS[haA].name)})` : t("Nessuna stanza", "No room")}</option>
      ${areasSorted(true).map(a => `<option value="${a}" ${r === a ? "selected" : ""}>${esc(AREAS[a].name)}${FLOORS[AREAS[a].floor] ? " · " + esc(FLOORS[AREAS[a].floor].name) : ""}</option>`).join("")}</select></label>
    <div class="fl1">🧭 ${t("Lato della casa", "Side of the house")}</div>
    <div class="tp1ls" role="group" aria-label="${t("Lato della casa", "Side of the house")}"><button class="${!lato ? "on" : ""}" data-act="tpLato" data-v="">—</button>${LATI().map(([k, nome]) => `<button class="${lato === k ? "on" : ""} l-${k}" data-act="tpLato" data-v="${k}">${esc(nome)}</button>`).join("")}</div>
    <p class="small muted" style="margin-top:6px">${t("Verso dove guarda la finestra: serve per i gruppi per lato e per l'automatismo del sole.", "Which way the window faces: used for groups by side and the sun automation.")}</p>
    <div class="fl1">${t("Aspetto", "Look")}</div>
    <div class="tp1ak"><button class="${!asp ? "on" : ""}" data-act="tpAsp" data-v="">${disegnoTapp(aspettoAuto(id), .55, .6, "", "xs")}<span>✨ ${t("Automatico", "Automatic")}</span></button>
      ${ASPETTI().map(([k, n]) => `<button class="${asp === k ? "on" : ""}" data-act="tpAsp" data-v="${k}">${disegnoTapp(k, .55, .6, "", "xs")}<span>${esc(n)}</span></button>`).join("")}</div>
    <div class="fl1">🪟 ${t("Sensore della finestra", "Window sensor")}</div>
    <button class="li" data-act="tpFin"><span class="ic">${fin ? (isOnF(fin) ? "🔓" : "🔒") : "—"}</span><div class="tx"><b>${fin ? esc(nm(fin)) : t("Nessuno", "None")}</b><span>${fv === "none" ? t("nessuno, scelto da te", "none, chosen by you") : fv && S[fv] ? t("scelto da te", "chosen by you") : "✨ " + t("automatico", "automatic") + (fa ? "" : t(" · non trovato", " · not found"))}</span></div><span class="st">›</span></button>
    <p class="small muted" style="margin-top:6px">${t("Serve all'automatismo «Non chiudere con la finestra aperta».", "Used by the «Don't close with the window open» automation.")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="tpEdSalva">💾 ${t("Salva nome e stanza", "Save name and room")}</button>
      <button class="btn bad" data-act="tpTogli" data-id="${id}">✕ ${(C().extra || []).includes(id) ? t("Togli dalla pagina", "Remove from the page") : t("Non è una tapparella", "Not a cover")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Nome e stanza cambiano solo nella plancia, non in Home Assistant.", "Name and room change only in the dashboard, not in Home Assistant.")}</p>`;
}
const foglioCfg = () => `<div class="sh-head"><div><h3>⚙️ ${t("Tapparelle", "Covers")}</h3><div class="small muted">${t("Valgono per tutta la casa.", "They apply to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
  <label class="fld1"><span>${t("Posizione di «Metà»", "«Half» position")}</span><span class="tp1in"><input type="number" min="5" max="95" step="5" value="${meta()}" data-chg="tpMeta"><em>%</em></span></label>
  <p class="small muted" style="margin-top:6px">${t("Dove si fermano le tapparelle con il pulsante «Metà» (0 = chiuse, 100 = aperte). Si salva appena esci dal campo.", "Where covers stop with the «Half» button (0 = closed, 100 = open). Saved when you leave the field.")}</p>`;

/* ---------- azioni ---------- */
Object.assign(ACT, {
  tpCmd: el => muovi(el.dataset.id, el.dataset.v).then(() => render()).catch(() => {}),
  tpGr: el => { const d = el.dataset.dove, v = el.dataset.v; gruppo(inDove(d), v === "meta" ? "pos" : v, v === "meta" ? meta() : undefined); },
  tpDove: el => { sSet("tpDove", el.dataset.v); render(true); },
  tpCfg: () => openSheet(foglioCfg),
  tpEd: el => { ED = el.dataset.id; openSheet(foglioTapp); },
  tpEdSalva: () => { const id = ED, n = (document.getElementById("tp1nn")?.value || "").trim(), r = document.getElementById("tp1rr")?.value || "";
    closeSheet(); cambia(l => { l.names = { ...(l.names || {}) }; l.rooms = { ...(l.rooms || {}) };
      if (n && n !== nmHA(id)) l.names[id] = n; else delete l.names[id]; if (r) l.rooms[id] = r; else delete l.rooms[id]; }, "💾 " + (n || nmHA(id))); },
  tpLato: el => { const id = ED, v = el.dataset.v; tpCambia(c => { c.lati = c.lati || {}; if (v) c.lati[id] = v; else delete c.lati[id]; }, "🧭 " + (v ? nomeLato(v) : t("Nessun lato", "No side"))); },
  tpAsp: el => { const id = ED, v = el.dataset.v; tpCambia(c => { c.aspetto = c.aspetto || {}; if (v) c.aspetto[id] = v; else delete c.aspetto[id]; }); },
  tpFin: () => { const id = ED;
    scegli({ titolo: "🪟 " + esc(nm(id)), sotto: t("Il sensore della finestra (o della portafinestra) dietro questa tapparella.", "The window (or French door) sensor behind this cover."),
      filtro: x => x.startsWith("binary_sensor.") && FIN.includes(deviceClass(x)), area: areaOf(id), attuale: C().finestre?.[id] || "", auto: finestraAuto(id) || null, nessuno: true,
      onPick: x => tpCambia(c => { c.finestre = c.finestre || {}; if (x) c.finestre[id] = x; else delete c.finestre[id]; }).then(() => { ED = id; openSheet(foglioTapp); }) }); },
  tpTogli: el => { const id = el.dataset.id || ED; if (UI.sheet) closeSheet();
    tpCambia(c => { const ex = (c.extra || []).includes(id); c.extra = (c.extra || []).filter(x => x !== id); if (!ex || eTapparella(id)) c.tolte = [...new Set([...(c.tolte || []), id])]; }, "✕ " + nm(id)); },
  tpRimetti: el => { const id = el.dataset.id; tpCambia(c => { c.tolte = (c.tolte || []).filter(x => x !== id); if (!eTapparella(id) || idAccessi().has(id)) c.extra = [...new Set([...(c.extra || []), id])]; }, "↺ " + nm(id)); },
  tpAdd: () => scegli({ titolo: "＋ " + t("Tapparella o tenda", "Cover"), sotto: t("Tutte le cover della casa: anche quelle che non ho riconosciuto da sole.", "Every cover in the house: also the ones I didn't recognise by myself."), auto: false, attuale: null,
    filtro: id => id.startsWith("cover.") && !tutte().includes(id),
    onPick: id => id && tpCambia(c => { c.tolte = (c.tolte || []).filter(x => x !== id); c.extra = [...new Set([...(c.extra || []), id])]; }, "＋ " + nm(id)) }),
  /* scenari */
  tpScRun: (el, e) => { if (e?.target?.closest?.('[data-act="tpScEd"]')) return; const s = scenari()[+el.dataset.i]; if (s) eseguiScenario(s); },
  tpScEd: (el, e) => { e?.stopPropagation?.(); SC = JSON.parse(JSON.stringify(scenari()[+el.dataset.i])); scNuovo = false; openSheet(foglioScenario); },
  tpScNew: el => { const p = el.dataset.p != null ? PRONTI()[+el.dataset.p] : null;
    SC = { id: Date.now().toString(36), nome: p?.nome || "", icona: p?.icona || "🪟", passi: JSON.parse(JSON.stringify(p?.passi || [{ dove: "casa", cosa: "giu" }])) }; scNuovo = true; openSheet(foglioScenario); },
  tpScPronto: el => { const p = PRONTI()[+el.dataset.i]; Object.assign(SC, JSON.parse(JSON.stringify(p))); render(); },
  tpScIco: el => { SC.icona = el.dataset.v; render(); },
  tpScPAdd: () => { SC.passi = [...(SC.passi || []), { dove: "casa", cosa: "su" }]; render(); },
  tpScPDel: el => { SC.passi.splice(+el.dataset.i, 1); render(); },
  tpScSave: async () => {
    if (!SC.nome?.trim()) return toast(t("Scrivi un nome", "Write a name"), true);
    if (!(SC.passi || []).length) return toast(t("Aggiungi almeno un passo", "Add at least one step"), true);
    const s = JSON.parse(JSON.stringify(SC)); s.nome = s.nome.trim();
    const o = { tipo: "script", id: SCRIPT(s) }, cfg = scriptCfg(s);
    try {
      await scrivi(o, cfg);
      await tpCambia(c => { const L = (c.scenari || []), i = L.findIndex(x => x.id === s.id); if (i < 0) L.push(s); else L[i] = s; c.scenari = L; c.firme = { ...(c.firme || {}), [o.id]: impronta(cfg) }; });
      closeSheet(); toast("💾 " + s.nome);
    } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  tpScDel: async () => {
    if (!confirm(t("Eliminare questo scenario?", "Delete this scene?"))) return;
    const s = SC; try { await api("DELETE", `/api/config/script/config/${SCRIPT(s)}`); } catch {}
    await tpCambia(c => { c.scenari = (c.scenari || []).filter(x => x.id !== s.id); if (c.firme) delete c.firme[SCRIPT(s)]; }, "🗑 " + s.nome); closeSheet();
  },
  /* automatismi */
  tpAuto: async el => { const k = el.dataset.k, on = !AU(k).on;
    await tpCambia(c => { c.auto = c.auto || {}; c.auto[k] = { ...AU(k), on }; });
    if (!on) { const e = entitaDi({ tipo: "automation", id: AID[k] }); if (e) { try { await api("DELETE", `/api/config/automation/config/${AID[k]}`); } catch {} }
      await tpCambia(c => { if (c.firme) delete c.firme[AID[k]]; }); toast(t("Automatismo spento", "Automation off")); return; }
    await sincronizza(AID[k]); if (entitaDi({ tipo: "automation", id: AID[k] }) || C().firme?.[AID[k]]) toast("✅ " + t("Automatismo creato in Home Assistant", "Automation created in Home Assistant")); },
  tpRicrea: el => sincronizza(AID[el.dataset.k]),
  tpAuLato: el => { const v = el.dataset.v; tpCambia(c => { c.auto = c.auto || {}; const a = { ...AU("caldo") }; a.lati = (a.lati || []).includes(v) ? a.lati.filter(x => x !== v) : [...(a.lati || []), v]; c.auto.caldo = a; }); },
  tpAuSens: () => { const a = AU("caldo");
    scegli({ titolo: "🌡️ " + t("Temperatura esterna", "Outdoor temperature"), sotto: t("Il sensore che dice quanto fa caldo fuori. Automatico: quello della pagina Meteo, altrimenti il meteo di casa.", "The sensor telling how hot it is outside. Automatic: the Weather page's one, otherwise the home weather."),
      filtro: x => x.startsWith("sensor.") && (deviceClass(x) === "temperature" || /°\s?[CF]$/.test(unit(x))), attuale: a.sens || "", auto: (() => { try { return sensore("temp"); } catch { return null; } })() || weatherEnt() || null,
      onPick: x => tpCambia(c => { c.auto = c.auto || {}; c.auto.caldo = { ...AU("caldo"), sens: x || "" }; }) }); },
});
CHG.tpAuF = el => { const k = el.dataset.k, f = el.dataset.f, v = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? AUTO_DEF()[k][f] : +el.value) : el.value;
  tpCambia(c => { c.auto = c.auto || {}; c.auto[k] = { ...AU(k), [f]: v }; }); };
CHG.tpMeta = el => { const v = clamp(Math.round(+el.value || 50), 5, 95); tpCambia(c => { c.meta = v; }, t("Metà: ", "Half: ") + v + "%"); };
CHG.tpTilt = el => { const id = el.dataset.id, v = clamp(+el.value, 0, 100); svc("cover", "set_cover_tilt_position", { tilt_position: v }, { entity_id: id }).catch(() => {}); };

/* ---------- trascinare sulla finestra disegnata ---------- */
let G = null;
/** posizione (0…100) dal punto toccato: le tapparelle seguono il dito, la tenda si apre dal centro, la tenda da sole si allunga */
function daPunto(g, e) {
  const r = g.r, x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 120;
  if (g.k === "tenda") return clamp(Math.abs(x - 50) / 31, 0, 1) * 100;
  if (g.k === "sole") return clamp((y - 16) / 38, 0, 1) * 100;
  return (1 - clamp((y - GY) / GH, 0, 1)) * 100;
}
function inizia(g) { g.st = "drag"; g.el.dataset.drag = "1"; g.el.classList.add("drag"); try { g.el.setPointerCapture(g.pid); } catch {} }
function mostra(g, e) {
  g.v = Math.round(daPunto(g, e)); const sv = g.el.querySelector("svg"); if (sv) sv.style.setProperty("--o", (g.v / 100).toFixed(3));
  const p = g.el.querySelector("[data-tpp]"); if (p) p.textContent = g.v + "%"; g.el.setAttribute("aria-valuenow", g.v);
}
function chiudi(g) { delete g.el.dataset.drag; g.el.classList.remove("drag"); render(true); }
document.addEventListener("pointerdown", e => {
  const el = e.target.closest("[data-tpg]"); if (!el || e.button > 0 || UI.edit) return;
  const id = el.dataset.tpg, sv = el.querySelector("svg"); if (!S[id] || !ok(id) || !sv) return;
  G = { el, id, k: el.dataset.k, pid: e.pointerId, x0: e.clientX, y0: e.clientY, r: sv.getBoundingClientRect(), st: "?", v: null };
});
document.addEventListener("pointermove", e => {
  const g = G; if (!g || e.pointerId !== g.pid) return;
  if (g.st === "?") { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return; inizia(g); }
  e.preventDefault(); mostra(g, e);
});
document.addEventListener("pointerup", e => {
  const g = G; if (!g || e.pointerId !== g.pid) return; G = null;
  if (g.st !== "drag") return;
  mostra(g, e); const v = g.v; chiudi(g);
  if (v != null) muovi(g.id, "pos", v).then(() => render()).catch(() => {});
});
document.addEventListener("pointercancel", e => { const g = G; if (!g || e.pointerId !== g.pid) return; G = null; if (g.st === "drag") chiudi(g); });
/* tastiera: frecce ±10%, Inizio/Fine aperta/chiusa */
document.addEventListener("keydown", e => {
  const el = e.target.closest?.("[data-tpg]"); if (!el || e.target !== el) return;
  const id = el.dataset.tpg; if (!S[id] || !ok(id)) return;
  const d = { ArrowUp: 10, ArrowRight: 10, ArrowDown: -10, ArrowLeft: -10, PageUp: 25, PageDown: -25 }[e.key];
  if (d) { e.preventDefault(); muovi(id, "pos", clamp((TGT[id]?.p ?? pos(id)) + d, 0, 100)); render(true); }
  else if (e.key === "Home") { e.preventDefault(); muovi(id, "su"); } else if (e.key === "End") { e.preventDefault(); muovi(id, "giu"); }
});

page("tapparelle", { title: t("Tapparelle e tende", "Covers"), short: t("Tapparelle", "Covers"), icon: "🪟", order: 25, editable: true,
  show: () => tutte().length > 0, badge: () => tutte().some(muove), render: pagina });

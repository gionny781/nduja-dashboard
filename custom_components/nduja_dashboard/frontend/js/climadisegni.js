/* Clima animato: condizionatori, termostati e radiatori disegnati per 'Nduja in SVG e animati solo con il CSS
   (nduja.css, «clima animato»). Cinque momenti: spento, raffresca, scalda, deumidifica, ventila (classe m-… sull'SVG).
   La velocità delle animazioni segue la ventola (fan_mode) con la variabile --cv; «rest» quando il clima è acceso
   ma a riposo (temperatura raggiunta): il disegno resta colorato ma fermo.
   Con ✏️ si sceglie l'aspetto: animazioni della plancia (default), immagini o GIF dell'utente (/local/…) per ogni momento,
   oppure le icone di sempre. Le scelte stanno in LAYOUT.climaAspetto[entity_id] e valgono nella pagina Clima, nelle schede
   clima (Home, stanze), nella mappa e nelle stanze della Home. */
import { S, ACT, CHG, LAYOUT, VISTE, t, esc, nm, nmHA, ok, attr, isAdmin, openSheet, closeSheet, render, toast } from "./core.js";
import { cambia, fileEsiste, indirizzoLocale } from "./edit.js";

/** momenti: [chiave, nome breve] */
export const MOMENTI_CLIMA = () => [["off", t("Spento", "Off")], ["cool", t("Raffresca", "Cooling")], ["heat", t("Scalda", "Heating")], ["dry", t("Deumidifica", "Drying")], ["fan", t("Ventila", "Fan")]];
/** disegni: [chiave, nome] */
export const DISEGNI_CLIMA = () => [["split", t("Condizionatore", "Air conditioner")], ["termostato", t("Termostato", "Thermostat")], ["radiatore", t("Radiatore", "Radiator")]];

/* ---------- stato del clima ---------- */
const AZIONE = { heating: "heat", preheating: "heat", defrosting: "heat", cooling: "cool", drying: "dry", fan: "fan" };
const MODO = { heat: "heat", cool: "cool", dry: "dry", fan_only: "fan" };
/** momento di adesso: { k, rest } — prima quello che sta facendo (hvac_action), poi la modalità;
    in auto senza hvac_action decido dalla temperatura della stanza rispetto a quella voluta */
export function momentoClima(id) {
  const c = S[id]; if (!c || !ok(id)) return { k: "off", rest: false };
  const a = c.attributes || {}, m = c.state, act = a.hvac_action;
  if (m === "off" || act === "off") return { k: "off", rest: false };
  if (AZIONE[act]) return { k: AZIONE[act], rest: false };
  let k = MODO[m];
  if (!k) {
    const cur = +a.current_temperature, lo = a.target_temp_low, hi = a.target_temp_high, tg = a.temperature;
    if (!isNaN(cur) && lo != null && hi != null) k = cur < +lo ? "heat" : cur > +hi ? "cool" : "fan";
    else if (!isNaN(cur) && tg != null) k = cur < +tg ? "heat" : "cool";
    else k = (a.hvac_modes || []).includes("cool") ? "cool" : "heat";
  }
  return { k, rest: act === "idle" };
}
/** disegno adatto: radiatori e valvole, termostati, condizionatori (chi sa raffrescare o deumidificare) */
export function tipoClima(id) {
  const s = id + " " + nmHA(id), M = attr(id, "hvac_modes") || [];
  if (/radiat|termosif|valvol|valve|\btrv\b|testina|thermostatic/i.test(s)) return "radiatore";
  if (M.some(m => ["cool", "dry", "fan_only"].includes(m))) return "split";
  return "termostato";
}
/** velocità della ventola → moltiplicatore delle durate (--cv): 1 normale, più piccolo = più veloce */
export function velocita(id) {
  const fm = attr(id, "fan_mode"); if (fm == null || fm === "") return 1;
  const s = String(fm).toLowerCase(), L = (attr(id, "fan_modes") || []).map(x => String(x).toLowerCase());
  let lv = null;
  if (/quiet|silen|sleep|night|notte|mute|eco/.test(s)) lv = .12;
  else if (/turbo|max|boost|power|strong|highest|forte/.test(s)) lv = 1;
  else if (/(medium|mid|middle|medi[ao]).?(high|alt[ao])|high.?mid/.test(s)) lv = .72;
  else if (/(medium|mid|middle|medi[ao]).?(low|bass[ao])|low.?mid/.test(s)) lv = .4;
  else if (/high|alt[ao]/.test(s)) lv = .85;
  else if (/low|bass[ao]|min/.test(s)) lv = .25;
  else if (/medium|mid|middle|medi[ao]|normal/.test(s)) lv = .55;
  else if (/auto/.test(s)) lv = .55;
  else if (!isNaN(parseFloat(s))) {
    const N = L.map(parseFloat).filter(n => !isNaN(n)), v = parseFloat(s), mx = Math.max(v, ...N), mn = Math.min(v, ...N);
    lv = mx > mn ? .15 + .85 * (v - mn) / (mx - mn) : .55;
  } else if (L.length > 1 && L.includes(s)) lv = (L.indexOf(s) + 1) / L.length;
  return lv == null ? 1 : +(1.55 - lv).toFixed(2);   // da 1.43 (silenziosa) a 0.55 (turbo)
}

/* ---------- disegni (viewBox 100×100) ---------- */
const fiocco = (x, y, i) => `<path class="fz f${i}" d="M${x - 3} ${y}h6M${x} ${y - 3}v6M${x - 2.1} ${y - 2.1}l4.2 4.2M${x - 2.1} ${y + 2.1}l4.2-4.2"/>`;
const goccia = (x, y, i, c = "gc") => `<path class="${c} g${i}" d="M${x} ${y - 3.6}c1.7 2.4 2.7 3.7 2.7 5.1a2.7 2.7 0 0 1-5.4 0c0-1.4 1-2.7 2.7-5.1z"/>`;
/** onda verticale (aria calda) da y0 verso l'alto per h, ampiezza w */
const onda = (x, y0, h, w = 2.6, cls = "") => { let d = `M${x} ${y0}`; const n = Math.round(h / 6); for (let i = 0; i < n; i++) d += `q${i % 2 ? -w : w} -3 0 -6`; return `<path class="${cls}" d="${d}"/>`; };
/** ventola a tre pale attorno a (cx, cy) */
const pale = (cx, cy, r) => [0, 120, 240].map(g => `<path transform="rotate(${g} ${cx} ${cy})" d="M${cx} ${cy}c${(-r * .5).toFixed(2)} ${(-r * .35).toFixed(2)} ${(-r * .35).toFixed(2)} ${(-r * .98).toFixed(2)} ${(r * .2).toFixed(2)} ${(-r * .98).toFixed(2)}s${(r * .42).toFixed(2)} ${(r * .62).toFixed(2)} ${(-r * .2).toFixed(2)} ${(r * .98).toFixed(2)}z"/>`).join("");

/* condizionatore a parete: alette che si muovono, aria che scende (fredda, calda, secca o normale) */
function split() {
  return `<g class="alo"><ellipse cx="50" cy="79" rx="40" ry="16"/><ellipse cx="50" cy="79" rx="29" ry="11.5"/><ellipse cx="50" cy="79" rx="18" ry="7"/></g>
  <rect class="b" x="6" y="16" width="88" height="34" rx="11"/><path class="hl" d="M15 20.5h42"/>
  <circle class="gl" cx="23" cy="31" r="7.6"/><g class="rot">${pale(23, 31, 6.2)}<circle class="hub" cx="23" cy="31" r="1.5"/></g>
  <rect class="dsp" x="64" y="26" width="20" height="9" rx="4.5"/><rect class="dsx" x="68" y="29.3" width="12" height="2.4" rx="1.2"/>
  <rect class="out" x="14" y="40.5" width="72" height="6" rx="3"/>
  <g class="van"><path d="M23 42v3M31 42v3M39 42v3M47 42v3M55 42v3M63 42v3M71 42v3M79 42v3"/></g>
  <rect class="flap" x="13" y="47" width="74" height="4.2" rx="2.1"/>
  <g class="aria"><path class="a0" d="M34 56c-3 11-8 21-13 34"/><path class="a1" d="M50 56v36"/><path class="a2" d="M66 56c3 11 8 21 13 34"/></g>
  <g class="ond">${onda(34, 92, 36, 2.4, "o0")}${onda(50, 94, 36, 2.4, "o1")}${onda(66, 92, 36, 2.4, "o2")}</g>
  <g class="fzz">${[[30, 62], [52, 68], [70, 60], [40, 80], [62, 84]].map(([x, y], i) => fiocco(x, y, i)).join("")}</g>
  <g class="gcc">${[[33, 63], [50, 66], [67, 63], [42, 78]].map(([x, y], i) => goccia(x, y, i)).join("")}</g>`;
}
/* termostato rotondo: fiamma che guizza, fiocco, goccia o ventola al centro; anello colorato che respira */
function termostato() {
  return `<g class="alo2"><circle cx="50" cy="52" r="47"/><circle cx="50" cy="52" r="43.5"/><circle cx="50" cy="52" r="40"/></g>
  <circle class="b" cx="50" cy="52" r="38"/><path class="hl" d="M18.7 37.4A34.5 34.5 0 0 1 38.2 19.6"/>
  <circle class="trk" cx="50" cy="52" r="30" pathLength="100"/><circle class="arc" cx="50" cy="52" r="30" pathLength="100"/>
  <circle class="gl" cx="50" cy="52" r="23"/>
  <g class="pw"><path d="M44.2 46.4a9 9 0 1 0 11.6 0"/><path d="M50 42.5v9"/></g>
  <g class="fia"><path class="fl1" d="M50 34c7 7.5 12 13 12 20a12 12 0 0 1-24 0c0-4.5 2.4-8 5-10.5.4 3.2 1.8 5.2 3.6 6.2C46 44 47.6 38.6 50 34z"/>
    <path class="fl2" d="M50.6 49c3.4 3.6 5.6 6.4 5.6 9.4a6.2 6.2 0 0 1-12.4 0c0-2.6 1.6-4.6 3.2-6 .5 1.6 1.4 2.6 2.4 3 .2-2.4.4-4.4 1.2-6.4z"/></g>
  <g class="fzc"><path d="M50 37v30M37 44.5l26 15M37 59.5l26-15M45.4 38.4 50 42l4.6-3.6M45.4 65.6 50 62l4.6 3.6M36.6 50l5.6-.9-1.9-5.3M63.4 54l-5.6.9 1.9 5.3M40.3 59.3l1.9-5.3-5.6-.9M59.7 44.7l-1.9 5.3 5.6.9"/></g>
  <path class="gcc1" d="M50 38c6 8.2 9.2 12.8 9.2 17.4a9.2 9.2 0 0 1-18.4 0c0-4.6 3.2-9.2 9.2-17.4z"/>
  <g class="rot rc">${pale(50, 52, 13)}<circle class="hub" cx="50" cy="52" r="2.6"/></g>
  <circle class="tip" cx="50" cy="22" r="3"/>`;
}
/* radiatore: elementi che si scaldano uno dopo l'altro e onde di calore che salgono */
function radiatore() {
  const col = [0, 1, 2, 3, 4, 5].map(i => 17 + i * 11.2);
  return `<g class="ond">${onda(31, 36, 30, 2.6, "o0")}${onda(50, 34, 30, 2.6, "o1")}${onda(69, 36, 30, 2.6, "o2")}</g>
  <rect class="k2" x="12" y="45" width="76" height="3.6" rx="1.8"/><rect class="k2" x="12" y="80" width="76" height="3.6" rx="1.8"/>
  ${col.map((x, i) => `<rect class="b col" x="${x}" y="40" width="8.6" height="49" rx="4.3"/><rect class="cal c${i}" x="${x}" y="40" width="8.6" height="49" rx="4.3"/><path class="hl" d="M${x + 2.6} 45v12"/>`).join("")}
  <rect class="k2" x="5.5" y="78.2" width="7" height="7.2" rx="2"/><circle class="vlv" cx="9" cy="73.5" r="4.2"/>
  <rect class="k2" x="20" y="89" width="5" height="4" rx="1.4"/><rect class="k2" x="75" y="89" width="5" height="4" rx="1.4"/>`;
}
const FN = { split, termostato, radiatore };
/** svg del clima: kind (split | termostato | radiatore), k (off | cool | heat | dry | fan), rest (acceso ma fermo), cv (velocità) */
export function disegnoClima(kind, k, rest = false, cv = 1) {
  const f = FN[kind] || split;
  return `<svg class="cld1 c-${FN[kind] ? kind : "split"} m-${k}${rest ? " rest" : ""}" style="--cv:${cv}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${f()}</svg>`;
}

/* ---------- aspetto scelto ---------- */
const cfgDi = id => LAYOUT.climaAspetto?.[id] || {};
export const aspettoClima = c => ["plancia", "immagini", "icona"].includes(c.aspetto) ? c.aspetto : "plancia";
const disegnoDi = (c, id) => FN[c.disegno] ? c.disegno : tipoClima(id);
/** la tua immagine per quel momento; se manca (o il file non c'è) quella di «spento», poi la prima che c'è */
const immagineDi = (c, k) => { const I = c.img || {}; return [I[k], I.off, I.cool, I.heat, I.dry, I.fan].find(u => u && fileEsiste(u) !== "no") || ""; };
const ICO = { cool: "❄️", heat: "🔥", dry: "💧", fan: "🌀" };
/** il clima disegnato: cls (md, sm, xs, cl), opz { cfg (bozza), k (momento forzato) } */
export function vistaClima(id, cls = "", o = {}) {
  const c = o.cfg || cfgDi(id), st = momentoClima(id), k = o.k || st.k, rest = !o.k && st.rest, tipo = disegnoDi(c, id);
  let m = aspettoClima(c);
  if (m === "immagini" && !immagineDi(c, k)) m = "plancia";   // nessuna immagine: non lascio il vuoto
  const tt = esc(MOMENTI_CLIMA().find(x => x[0] === k)?.[1] || "");
  if (m === "immagini") return `<span class="apv1 cl1 ${cls}" title="${tt}"><img src="${esc(immagineDi(c, k))}" alt=""></span>`;
  if (m === "icona") return `<span class="apv1 ico2 cl1 ${cls}" title="${tt}"><span class="cli1 m-${k}">${k === "off" ? (tipo === "split" ? "❄️" : "🔥") : ICO[k]}</span></span>`;
  return `<span class="apv1 cl1 ${cls}" title="${tt}">${disegnoClima(tipo, k, rest, velocita(id))}</span>`;
}
VISTE.clima = id => vistaClima(id, "cl");

/* ---------- ✏️ aspetto ---------- */
let bz = null, bid = null;
const nomeFile = k => "/local/" + t("clima", "ac") + "-" + { off: t("spento", "off"), cool: t("freddo", "cool"), heat: t("caldo", "heat"), dry: t("deumidifica", "dry"), fan: t("ventola", "fan") }[k] + ".gif";
function campo(k, n) {
  const v = bz.img?.[k] || "", c = fileEsiste(v);
  const nota = c === "ok" ? `<small class="ok">✓ ${t("trovata", "found")}</small>` : c === "no" ? `<small class="no">⚠️ ${t("Non trovo il file: controlla il nome e che sia in /config/www.", "File not found: check the name and that it's in /config/www.")}</small>`
    : c === "?" ? `<small>${t("controllo…", "checking…")}</small>` : `<small>${k === "off" ? t("Es. ", "E.g. ") + esc(nomeFile(k)) : t("Vuoto: uso quella di «Spento».", "Empty: I use the «Off» one.")}</small>`;
  return `<div class="apf1"><span class="apv1">${v && c !== "no" ? `<img src="${esc(v)}" alt="">` : ""}</span>
    <label class="fld1"><span>${n}</span><input type="text" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(v)}" placeholder="${esc(nomeFile(k))}" data-chg="clImg" data-k="${k}">${nota}</label></div>`;
}
/* anteprima dal vivo dei cinque momenti, con quello di adesso evidenziato */
function anteprima() {
  const st = momentoClima(bid);
  return `<div class="apv2 clv5">${MOMENTI_CLIMA().map(([k, n]) => `<div class="${k === st.k ? "now" : ""}">${vistaClima(bid, "md", { cfg: bz, k })}<span>${n}${k === st.k ? `<em>${st.rest ? t("a riposo", "idle") : t("adesso", "now")}</em>` : ""}</span></div>`).join("")}</div>`;
}
const esempio = kind => kind === "split" ? "cool" : "heat";
function foglio() {
  const id = bid, asp = aspettoClima(bz), auto = tipoClima(id), fm = attr(id, "fan_mode");
  const parti = {
    plancia: `<div class="fl1">${t("Disegno", "Drawing")}</div>
      <div class="apk1"><button class="${!FN[bz.disegno] ? "on" : ""}" data-act="clDis" data-v="auto"><span class="apv1">${disegnoClima(auto, esempio(auto))}</span>✨ ${t("Automatico", "Automatic")}</button>
        ${DISEGNI_CLIMA().map(([k, n]) => `<button class="${bz.disegno === k ? "on" : ""}" data-act="clDis" data-v="${k}"><span class="apv1">${disegnoClima(k, esempio(k))}</span>${esc(n)}</button>`).join("")}</div>
      <p class="small muted" style="line-height:1.45">${fm != null ? t("La velocità dell'animazione segue la ventola: adesso «", "The animation speed follows the fan: now «") + esc(fm) + "»." : t("Se il clima ha la velocità della ventola, l'animazione la segue.", "If the climate device has a fan speed, the animation follows it.")}</p>`,
    immagini: `<p class="small muted" style="margin-top:8px;line-height:1.45">${t("Un'immagine o una GIF per ogni momento. Mettile nella cartella /config/www di Home Assistant e scrivi /local/nome-del-file.", "One image or GIF for each moment. Put them in Home Assistant's /config/www folder and write /local/file-name.")}</p>
      ${MOMENTI_CLIMA().map(([k, n]) => campo(k, n)).join("")}`,
    icona: `<p class="small muted" style="margin-top:8px;line-height:1.45">${t("Le icone di sempre: ❄️ raffresca, 🔥 scalda, 💧 deumidifica, 🌀 ventila.", "The usual icons: ❄️ cooling, 🔥 heating, 💧 drying, 🌀 fan.")}</p>`,
  };
  return `<div class="sh-head"><div><h3>🎞️ ${esc(nm(id))}</h3><div class="small muted">${t("Aspetto nella pagina Clima, nella Home e nella mappa.", "Look on the Climate page, on Home and on the map.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="seg" style="flex-wrap:wrap;margin-top:6px">${[["plancia", "🎞️ " + t("Animazioni della plancia", "Dashboard animations")], ["immagini", "🖼️ " + t("Le mie immagini", "My images")], ["icona", "🙂 " + t("Icona", "Icon")]]
      .map(([k, n]) => `<button class="${asp === k ? "act" : ""}" data-act="clAspV" data-v="${k}">${n}</button>`).join("")}</div>
    ${anteprima()}
    ${parti[asp]}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="clSave">💾 ${t("Salva", "Save")}</button>
      ${LAYOUT.climaAspetto?.[id] ? `<button class="btn" data-act="clReset">↺ ${t("Come all'inizio", "Back to default")}</button>` : ""}</div>`;
}
/* immagini: l'anteprima segue quello che scrivi, il controllo del file parte quando ti fermi */
function immagineScritta(el, fine) {
  if (!bz) return;
  const k = el.dataset.k, v = indirizzoLocale(el.value), I = { ...(bz.img || {}) };
  if (v) I[k] = v; else delete I[k];
  bz.img = I;
  if (fine && el.value !== v) el.value = v;
  if (fine || v) fileEsiste(v);
  render();
}
CHG.clImg = el => immagineScritta(el, true);
let attesa = null;
document.addEventListener("input", e => { if (e.target.dataset?.chg !== "clImg") return; clearTimeout(attesa); const el = e.target; attesa = setTimeout(() => immagineScritta(el, false), 700); });
Object.assign(ACT, {
  clAsp: el => { if (!isAdmin()) return; bid = el.dataset.id; bz = JSON.parse(JSON.stringify(cfgDi(bid))); Object.values(bz.img || {}).forEach(u => fileEsiste(u, true)); openSheet(foglio); },
  clAspV: el => { bz.aspetto = el.dataset.v; render(); },
  clDis: el => { if (el.dataset.v === "auto") delete bz.disegno; else bz.disegno = el.dataset.v; render(); },
  clSave: () => {
    const id = bid, c = { ...bz }, I = Object.values(c.img || {}), manca = I.some(u => fileEsiste(u) === "no");
    if (!c.img || !I.length) delete c.img;
    if (aspettoClima(c) === "plancia") delete c.aspetto;
    closeSheet();
    cambia(l => { const A = { ...(l.climaAspetto || {}) }; if (Object.keys(c).length) A[id] = c; else delete A[id]; l.climaAspetto = A; })
      .then(() => toast(c.aspetto === "immagini" && !I.length ? "💾 " + t("Salvato: senza immagini uso l'animazione della plancia", "Saved: with no images I use the dashboard animation")
        : manca ? "💾 " + t("Salvato, ma un'immagine non si trova", "Saved, but an image can't be found") : "💾 " + nm(id), manca));
  },
  clReset: () => { const id = bid; closeSheet(); cambia(l => { const A = { ...(l.climaAspetto || {}) }; delete A[id]; l.climaAspetto = A; }, "↺ " + nm(id)); },
});
/** riga per il foglio ✏️ di un clima (edit.js): apre la scelta dell'aspetto */
export const rigaAspetto = id => {
  const asp = aspettoClima(cfgDi(id)), n = { plancia: t("Animazioni della plancia", "Dashboard animations"), immagini: t("Le mie immagini", "My images"), icona: t("Icona", "Icon") }[asp];
  return `<button class="li cla1" data-act="clAsp" data-id="${id}">${vistaClima(id, "sm")}<div class="tx"><b>🎞️ ${t("Aspetto", "Look")}</b><span>${n}</span></div><span class="st">›</span></button>`;
};
VISTE.climaRiga = rigaAspetto;

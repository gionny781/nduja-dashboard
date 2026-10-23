/* Elettrodomestici: lavatrice, asciugatrice, lavastoviglie, forno, frigo… Una scheda per elettrodomestico con
   stato (in funzione / finito / fermo), potenza adesso, consumo di oggi, ora di fine e la presa per accenderlo.
   Si trovano da soli dai nomi (anche se un elettrodomestico ha più dispositivi: presa smart + app del produttore);
   con ✏️ scegli tu nome, aspetto e qualsiasi sensore; con ＋ ne aggiungi di nuovi.
   Aspetto per fermo, in funzione e finito: le animazioni della plancia (disegni.js), le tue immagini o GIF (/local/…) oppure l'icona.
   Lo stesso aspetto compare nella pagina, nella scheda della Home e nella mappa (nella stanza della presa o del sensore). */
import { S, REG, ACT, CHG, LAYOUT, UI, HOME_EXTRA, t, esc, nm, ok, val, attr, allEnts, deviceClass, watts, W, fnum, ago, hhmm, card, empty, page, svc, toast,
  openSheet, closeSheet, render, isAdmin, LOC, areaOf, go } from "../core.js";
import { scegli, cambia, fileEsiste, indirizzoLocale } from "../edit.js";
import { disegno, DISEGNI, riconosci } from "../disegni.js";
import { oggi } from "./energia.js";
import { ciclo, POTENZE_EXTRA } from "../avvisi.js";

const TIPI = () => [
  ["lavatrice", /lavatric|washer|washing|lavabianch/i, "🧺", t("Lavatrice", "Washing machine")],
  ["asciugatrice", /asciugatric|dryer|tumble/i, "🌀", t("Asciugatrice", "Dryer")],
  ["lavastoviglie", /lavastovigl|dishwasher/i, "🍽️", t("Lavastoviglie", "Dishwasher")],
  ["forno", /forno|oven/i, "♨️", t("Forno", "Oven")],
  ["friggitrice", /friggitric|air.?fryer/i, "🍟", t("Friggitrice", "Air fryer")],
  ["frigo", /frigo|fridge|refrigerat|congelator|freezer/i, "🧊", t("Frigorifero", "Fridge")],
  ["microonde", /microonde|microwave/i, "📡", t("Microonde", "Microwave")],
  ["piano", /piano.?cottura|induzion|hob|cooktop/i, "🍳", t("Piano cottura", "Hob")],
  ["caffe", /caff[eè]|coffee|espresso/i, "☕", t("Macchina del caffè", "Coffee machine")],
  ["boiler", /boiler|scaldabagno|water.?heater/i, "🚿", t("Scaldabagno", "Water heater")],
];
const SCARTA = /internet|wrinkle|bubble|child|lock|led|light|luce|rssi|uptime|voltage|current|temperature|delta|saved|returned|powerenergy|signal|firmware|update/i;
const KEY = /(sensor|switch|binary_sensor)\./;

/* icone: tante emoji divise per gruppo, oppure un'immagine/GIF tua (/local/…) */
const ICONE = [
  ["🧺", "🫧", "🌀", "👕", "👖", "🧦", "🧼", "🧴", "🪣", "🧽"],
  ["🍽️", "🥣", "🍳", "♨️", "🔥", "🍕", "🍞", "🥐", "🍟", "🍗", "🥘", "🍲", "🥟", "🧇"],
  ["☕", "🫖", "🍵", "🥤", "🧃", "🍹", "🧊", "🥶", "❄️", "🍦"],
  ["🔌", "⚡", "💡", "🔋", "📺", "🖥️", "💻", "🎮", "🔊", "📡", "🖨️", "📠"],
  ["🚿", "🛁", "💧", "🌡️", "🔆", "💨", "🌬️", "🧯", "🪴", "🌱", "🐟", "🐶"],
  ["🤖", "🧹", "🪒", "💇", "🧖", "🏋️", "🚗", "🛵", "🚲", "⛽", "🔧", "🛠️"],
];
/** animazione quando è in funzione: scelta, altrimenti quella adatta al tipo */
const ANIM = () => [["auto", t("Automatica", "Automatic")], ["gira", t("Gira", "Spin")], ["vibra", t("Vibra", "Shake")], ["pulsa", t("Pulsa", "Pulse")], ["salta", t("Salta", "Bounce")], ["fumo", t("Vapore", "Steam")], ["no", t("Nessuna", "None")]];
const animDi = a => a.anim && a.anim !== "auto" ? a.anim : /lavatric|asciugat|wash|dry/i.test(a.id + a.nome) || ["🧺", "🌀", "🫧"].includes(a.icona) ? "gira"
  : /lavastov|dish|friggit|fryer|frull/i.test(a.id + a.nome) ? "vibra" : /forno|oven|piano|caff|coffee|boiler|scald|bollit/i.test(a.id + a.nome) ? "fumo" : "pulsa";
const immagine = v => /^(\/|https?:)/.test(v || "");
export const icona = (a, on) => `<span class="api1 ${on && animDi(a) !== "no" ? "an-" + animDi(a) : ""}">${immagine(a.icona) ? `<img src="${esc(a.icona)}" alt="">` : esc(a.icona || "🔌")}</span>`;

/* ---------- aspetto: animazioni della plancia, le tue immagini per ogni momento, oppure l'icona ---------- */
const MOMENTI = () => [["idle", t("Fermo", "Idle")], ["on", t("In funzione", "Running")], ["done", t("Finito", "Done")]];
const momento = k => k === "on" ? "on" : k === "done" ? "done" : "idle";
/** come si mostra: quello scelto con ✏️; altrimenti le animazioni della plancia per i tipi che riconosco e l'icona per gli altri.
    Chi aveva già messo una sua immagine o un'animazione nell'icona la ritrova com'era. */
export function aspettoDi(a) {
  if (["plancia", "immagini", "icona"].includes(a.aspetto)) return a.aspetto;
  if (immagine(a.icona) || (a.anim && a.anim !== "auto")) return "icona";
  return riconosci(a) ? "plancia" : "icona";
}
const disegnoDi = a => DISEGNI().some(([k]) => k === a.disegno) ? a.disegno : riconosci(a) || "presa";
/** la tua immagine per quel momento; se manca (o il file non c'è) uso quella di «fermo», o la prima che c'è */
const immagineDi = (a, k) => { const I = a.img || {}; return [I[k], I.idle, I.on, I.done].find(u => u && fileEsiste(u) !== "no") || ""; };
/** l'elettrodomestico disegnato nel momento k (on, done, idle); key distingue i disegni nella stessa pagina; cls: md, sm, xs */
export function vista(a, k, key, cls = "") {
  k = momento(k);
  let m = aspettoDi(a);
  if (m === "immagini" && !immagineDi(a, k)) m = riconosci(a) || a.disegno ? "plancia" : "icona";   // nessuna immagine: non lascio il vuoto
  if (m === "immagini") return `<span class="apv1 ${cls}"><img src="${esc(immagineDi(a, k))}" alt="">${k === "done" && immagineDi(a, k) !== a.img?.done ? `<b class="apok1">✓</b>` : ""}</span>`;
  if (m === "plancia") return `<span class="apv1 ${cls}">${disegno(disegnoDi(a), k, key + (a.id || ""))}</span>`;
  return `<span class="apv1 ico2 ${cls}">${icona(a, k === "on")}</span>`;
}
/** elettrodomestici trovati da soli: per ogni tipo raccolgo i sensori di tutte le entità che lo nominano */
function automatici() {
  const out = [];
  for (const [k, re, ic, nome] of TIPI()) {
    const E = Object.keys(S).filter(id => KEY.test(id) && re.test(id + " " + nm(id)) && !REG[id]?.hidden && REG[id]?.cat == null);
    if (!E.length) continue;
    const pw = E.filter(id => id.startsWith("sensor.") && deviceClass(id) === "power" && !SCARTA.test(id));
    const en = E.filter(id => id.startsWith("sensor.") && deviceClass(id) === "energy" && !SCARTA.test(id));
    const st = E.filter(id => id.startsWith("sensor.") && /machine_state|operation_state|operating_state|stato|status|run_state/i.test(id));
    const fine = E.filter(id => id.startsWith("sensor.") && (deviceClass(id) === "timestamp" && /complet|fine|end|finish/i.test(id) || /remaining|residuo|time_left/i.test(id)));
    const sw = E.filter(id => id.startsWith("switch.") && !SCARTA.test(id));
    if (!pw.length && !st.length && !sw.length) continue;
    const best = L => L.find(id => ok(id) && (W(id) || 0) > 0) || L.find(ok) || L[0] || null;
    out.push({ id: k, nome, icona: ic, power: best(pw), energy: en.find(ok) || en[0] || null, status: st[0] || null, end: fine[0] || null, switch: sw.sort((a, b) => a.length - b.length)[0] || null });
  }
  return out;
}
const elenco = () => Array.isArray(LAYOUT.appliances) ? LAYOUT.appliances : automatici();
POTENZE_EXTRA.push(() => elenco().map(a => a.power).filter(Boolean));

/* stato: dal sensore di stato del produttore, altrimenti dal consumo */
const ATTIVO = /run|running|on\b|wash|dry|rins|spin|cook|heat|bake|active|in.?corso|lavaggio|asciug|cottura|funzion/i;
const FERMO = /stop|off|idle|ready|none|pausa|pause|finish|end|complet|standby|ferm/i;
function stato(a) {
  const w = a.power && ok(a.power) ? W(a.power) : null, soglia = a.threshold || 10, c = a.power ? ciclo(a.power) : null;
  const s = a.status && ok(a.status) ? String(S[a.status].state) : null;
  const acceso = s ? ATTIVO.test(s) && !FERMO.test(s) || (w != null && w > soglia) : w != null && w > soglia;
  if (acceso) return { k: "on", n: t("In funzione", "Running"), w };
  if (c?.fine && Date.now() - c.fine < 3 * 3600e3) return { k: "done", n: t("Finito", "Done") + " · " + ago(new Date(c.fine).toISOString()), w };
  if (a.switch && S[a.switch]?.state === "off") return { k: "off", n: t("Spento", "Off"), w };
  return { k: "idle", n: s && !/^none$/i.test(s) ? s.replace(/_/g, " ") : t("Fermo", "Idle"), w };
}
function quandoFinisce(a) {
  if (!a.end || !ok(a.end)) return null;
  const v = S[a.end].state;
  if (deviceClass(a.end) === "timestamp" || /^\d{4}-\d\d-\d\dT/.test(v)) { const d = new Date(v); return d > Date.now() ? t("finisce alle ", "ends at ") + hhmm(d) : null; }
  const n = parseFloat(v); if (isNaN(n) || n <= 0) return null;
  const u = String(attr(a.end, "unit_of_measurement") || "min").toLowerCase(), min = u.startsWith("h") ? n * 60 : u.startsWith("s") ? n / 60 : n;
  return t("mancano ", "") + (min >= 60 ? Math.floor(min / 60) + " h " + Math.round(min % 60) + " min" : Math.round(min) + " min") + t("", " left");
}

function scheda(a, i) {
  const st = stato(a), fin = st.k === "on" ? quandoFinisce(a) : null, kwh = a.energy ? oggi(a.energy) : null;
  const sw = a.switch && S[a.switch];
  return `<section class="card ap1 ${st.k}">
    <div class="ch"><h2>${esc(a.nome)}</h2>${isAdmin() ? `<button class="btn sm" data-act="apEdit" data-i="${i}">✏️</button>` : ""}</div>
    <div class="apr1">${vista(a, st.k, "pg" + i)}<div class="grow aps1"><b>${esc(st.n)}</b>${fin ? `<span>⏱ ${esc(fin)}</span>` : ""}</div></div>
    <div class="apg1">
      ${a.power ? `<button data-act="more" data-id="${a.power}"><small>${t("Adesso", "Now")}</small><b>${st.w != null ? watts(st.w) : "—"}</b></button>` : ""}
      ${a.energy ? `<button data-act="more" data-id="${a.energy}"><small>${t("Oggi", "Today")}</small><b>${kwh != null ? fnum(kwh, 2) + " kWh" : "—"}</b></button>` : ""}
      ${a.power && ciclo(a.power).fine ? `<div><small>${t("Ultimo ciclo", "Last cycle")}</small><b>${new Date(ciclo(a.power).fine).toLocaleString(LOC, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</b></div>` : ""}
    </div>
    ${sw ? `<div class="row between" style="margin-top:12px"><span class="small muted">🔌 ${t("Presa", "Plug")} · ${esc(nm(a.switch))}</span><button class="sw ${sw.state === "on" ? "on" : ""}" data-act="apSwitch" data-i="${i}" aria-label="${t("Presa", "Plug")}"><i></i></button></div>` : ""}
  </section>`;
}

/* ---------- ✏️ e ＋ ---------- */
let bz = null, idx = -1;
const VOCI = () => [["power", "⚡ " + t("Potenza (W)", "Power (W)"), id => id.startsWith("sensor.") && (deviceClass(id) === "power" || /^(k)?w$/i.test(attr(id, "unit_of_measurement") || ""))],
  ["energy", "📊 " + t("Contatore di energia (kWh)", "Energy meter (kWh)"), id => id.startsWith("sensor.") && (deviceClass(id) === "energy" || /wh$/i.test(attr(id, "unit_of_measurement") || ""))],
  ["status", "📋 " + t("Stato del produttore (facoltativo)", "Manufacturer status (optional)"), id => id.startsWith("sensor.") || id.startsWith("binary_sensor.")],
  ["end", "⏱ " + t("Ora di fine o tempo che manca", "End time or time left"), id => id.startsWith("sensor.")],
  ["switch", "🔌 " + t("Presa o interruttore", "Plug or switch"), id => id.startsWith("switch.") || id.startsWith("input_boolean.")]];
/* anteprima dal vivo dei tre momenti, con quello di adesso evidenziato */
function anteprima(a) {
  const ora = momento(stato(a).k);
  return `<div class="apv2">${MOMENTI().map(([k, n]) => `<div class="${k === ora ? "now" : ""}">${vista(a, k, "pv" + k, "md")}<span>${n}${k === ora ? " · " + t("adesso", "now") : ""}</span></div>`).join("")}</div>`;
}
/* suggerimento per il nome del file, es. /local/lavatrice-ferma.gif */
const nomeFile = (a, k) => "/local/" + ({ lavatrice: t("lavatrice", "washer"), asciugatrice: t("asciugatrice", "dryer"), lavastoviglie: t("lavastoviglie", "dishwasher"),
  forno: t("forno", "oven"), frigo: t("frigo", "fridge"), presa: t("presa", "plug") }[disegnoDi(a)]) + "-" + { idle: t("ferma", "idle"), on: t("in-funzione", "running"), done: t("finita", "done") }[k] + ".gif";
function campoImmagine(a, k, n) {
  const v = a.img?.[k] || "", c = fileEsiste(v);
  const nota = c === "ok" ? `<small class="ok">✓ ${t("trovata", "found")}</small>` : c === "no" ? `<small class="no">⚠️ ${t("Non trovo il file: controlla il nome e che sia in /config/www.", "File not found: check the name and that it's in /config/www.")}</small>`
    : c === "?" ? `<small>${t("controllo…", "checking…")}</small>` : `<small>${k === "idle" ? t("Es. ", "E.g. ") + esc(nomeFile(a, k)) : t("Vuoto: uso quella di «Fermo».", "Empty: I use the «Idle» one.")}</small>`;
  return `<div class="apf1"><span class="apv1">${v && c !== "no" ? `<img src="${esc(v)}" alt="">` : ""}</span>
    <label class="fld1"><span>${n}</span><input type="text" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(v)}" placeholder="${esc(nomeFile(a, k))}" data-chg="apImg" data-k="${k}">${nota}</label></div>`;
}
function config() {
  const a = bz, asp = aspettoDi(a), ric = riconosci(a);
  const riga = ([k, label]) => `<button class="li" data-act="apPick" data-k="${k}"><div class="tx"><b>${label}</b><span>${a[k] && S[a[k]] ? esc(nm(a[k])) + " · " + esc(S[a[k]].state) + " " + esc(attr(a[k], "unit_of_measurement") || "") : t("nessuno", "none")}</span></div><span class="st">›</span></button>`;
  const parti = {
    plancia: `<div class="fl1">${t("Disegno", "Drawing")}</div>
      <div class="apk1"><button class="${!a.disegno || a.disegno === "auto" ? "on" : ""}" data-act="apDis" data-v="auto"><span class="apv1">${disegno(ric || "presa", "on", "pkauto")}</span>✨ ${t("Automatico", "Automatic")}</button>
        ${DISEGNI().map(([k, n]) => `<button class="${a.disegno === k ? "on" : ""}" data-act="apDis" data-v="${k}"><span class="apv1">${disegno(k, "on", "pk" + k)}</span>${esc(n)}</button>`).join("")}</div>`,
    immagini: `<p class="small muted" style="margin-top:8px;line-height:1.45">${t("Un'immagine o una GIF per ogni momento. Mettile nella cartella /config/www di Home Assistant e scrivi /local/nome-del-file.", "One image or GIF for each moment. Put them in Home Assistant's /config/www folder and write /local/file-name.")}</p>
      ${MOMENTI().map(([k, n]) => campoImmagine(a, k, n)).join("")}`,
    icona: `<div class="ico1" style="margin-top:10px">${ICONE.flat().map(ic => `<button class="${a.icona === ic ? "on" : ""}" data-act="apIco" data-v="${ic}">${ic}</button>`).join("")}</div>
      <label class="fld1"><span>${t("Oppure un'immagine o una GIF tua (es. /local/lavatrice.gif)", "Or your own image or GIF (e.g. /local/washer.gif)")}</span><input type="text" value="${immagine(a.icona) ? esc(a.icona) : ""}" data-chg="apF" data-k="icona" placeholder="/local/…"></label>
      <div class="fl1">${t("Animazione quando è in funzione", "Animation while running")}</div>
      <div class="seg" style="flex-wrap:wrap">${ANIM().map(([k, n]) => `<button class="${(a.anim || "auto") === k ? "act" : ""}" data-act="apAnim" data-v="${k}">${n}</button>`).join("")}</div>`,
  };
  return `<div class="sh-head"><div><h3>${idx < 0 ? t("Nuovo elettrodomestico", "New appliance") : "✏️ " + esc(a.nome)}</h3><div class="small muted">${t("Puoi scegliere qualsiasi sensore della casa.", "You can choose any sensor in the house.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input type="text" value="${esc(a.nome || "")}" data-chg="apF" data-k="nome" placeholder="${t("Lavatrice", "Washing machine")}"></label>
    <div class="vr1" style="margin:10px 0 4px">${TIPI().map(([, , ic, n]) => `<button data-act="apTipo" data-ic="${ic}" data-n="${esc(n)}">${ic} ${esc(n)}</button>`).join("")}</div>
    <div class="fl1">${t("Aspetto", "Look")}</div>
    <div class="seg" style="flex-wrap:wrap">${[["plancia", "🎞️ " + t("Animazioni della plancia", "Dashboard animations")], ["immagini", "🖼️ " + t("Le mie immagini", "My images")], ["icona", "🙂 " + t("Icona", "Icon")]]
      .map(([k, n]) => `<button class="${asp === k ? "act" : ""}" data-act="apAsp" data-v="${k}">${n}</button>`).join("")}</div>
    ${anteprima(a)}
    ${parti[asp]}
    <div class="fl1">${t("Sensori", "Sensors")}</div>
    <div class="stack">${VOCI().map(riga).join("")}</div>
    <label class="fld1"><span>${t("In funzione sopra (W)", "Running above (W)")}</span><input type="number" min="1" value="${a.threshold || 10}" data-chg="apF" data-k="threshold"></label>
    <label class="row" style="gap:8px;margin-top:12px"><input type="checkbox" data-chg="apMappa" ${a.mappa === false ? "" : "checked"}> ${t("Mostra nella mappa (nella stanza della presa o del sensore)", "Show on the map (in the plug's or sensor's room)")}</label>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="apSave">💾 ${t("Salva", "Save")}</button>${idx >= 0 ? `<button class="btn bad" data-act="apDel">🗑 ${t("Togli", "Remove")}</button>` : ""}</div>`;
}
CHG.apF = el => { if (el.dataset.k === "icona" && !el.value.trim()) return; bz[el.dataset.k] = el.dataset.k === "threshold" ? +el.value || 10 : el.dataset.k === "icona" ? indirizzoLocale(el.value) : el.value; render(); };
/* immagini dei tre momenti: l'anteprima segue quello che scrivi, il controllo del file parte quando ti fermi */
function immagineScritta(el, fine) {
  const k = el.dataset.k, v = indirizzoLocale(el.value), I = { ...(bz.img || {}) };
  if (v) I[k] = v; else delete I[k];
  bz.img = I;
  if (fine && el.value !== v) el.value = v;
  if (fine || v) fileEsiste(v);
  render();
}
CHG.apImg = el => immagineScritta(el, true);
let attesaImg = null;
document.addEventListener("input", e => { if (e.target.dataset?.chg !== "apImg" || !bz) return; clearTimeout(attesaImg); const el = e.target; attesaImg = setTimeout(() => immagineScritta(el, false), 700); });
CHG.apMappa = el => { if (el.checked) delete bz.mappa; else bz.mappa = false; };
const salva = L => cambia(l => { l.appliances = L; });
Object.assign(ACT, {
  apEdit: el => { idx = +el.dataset.i; bz = JSON.parse(JSON.stringify(elenco()[idx])); Object.values(bz.img || {}).forEach(u => fileEsiste(u, true)); openSheet(config); },
  apNew: () => { idx = -1; bz = { id: "a" + Date.now().toString(36), nome: "", icona: "🔌" }; openSheet(config); },
  apIco: el => { bz.icona = el.dataset.v; render(); },
  apAnim: el => { bz.anim = el.dataset.v; render(); },
  apAsp: el => { bz.aspetto = el.dataset.v; render(); },
  apDis: el => { if (el.dataset.v === "auto") delete bz.disegno; else bz.disegno = el.dataset.v; render(); },
  apTipo: el => { bz.icona = el.dataset.ic; if (!bz.nome) bz.nome = el.dataset.n; render(); },
  apPick: el => { const k = el.dataset.k, v = VOCI().find(x => x[0] === k), keep = { ...bz }, i = idx;
    scegli({ titolo: v[1], filtro: v[2], attuale: bz[k] || "none", auto: false, nessuno: true,
      onPick: id => { idx = i; bz = { ...keep, [k]: id && id !== "none" ? id : null }; openSheet(config); } }); },
  apSave: () => { if (!bz.nome) return toast(t("Scrivi un nome", "Write a name"), true);
    const a = bz, I = Object.values(a.img || {}), manca = I.some(u => fileEsiste(u) === "no");
    const L = [...elenco()]; if (idx < 0) L.push(a); else L[idx] = a; closeSheet();
    salva(L).then(() => toast(a.aspetto === "immagini" && !I.length ? "💾 " + t("Salvato: senza immagini uso l'animazione della plancia", "Saved: with no images I use the dashboard animation")
      : manca ? "💾 " + t("Salvato, ma un'immagine non si trova", "Saved, but an image can't be found") : "💾 " + a.nome, manca)); },
  apDel: () => { const L = elenco().filter((_, j) => j !== idx); closeSheet(); salva(L); },
  apAuto: () => cambia(l => { delete l.appliances; }),
  apSwitch: el => { const a = elenco()[+el.dataset.i], on = S[a.switch].state === "on";
    if (on && stato(a).k === "on" && !confirm(t("È in funzione: spegnendo la presa lo fermi. Continuo?", "It's running: switching off the plug will stop it. Continue?"))) return;
    svc(a.switch.split(".")[0], on ? "turn_off" : "turn_on", {}, { entity_id: a.switch }); },
  /* dalla Home e dalla mappa alla pagina (non mentre si modifica la mappa) */
  apGo: () => { if (!(UI.edit && UI.page === "mappa")) go("elettrodomestici"); },
});

/* ---------- Home e mappa: lo stesso aspetto della pagina ---------- */
function homeCard() {
  const L = elenco(); if (!L.length) return "";
  return card("🧺 " + t("Elettrodomestici", "Appliances"), `<div class="aph1">${L.map((a, i) => { const st = stato(a), fin = st.k === "on" ? quandoFinisce(a) : null;
    return `<button class="${st.k}" data-act="apGo">${vista(a, st.k, "hm" + i, "sm")}<span class="tx"><b>${esc(a.nome)}</b><span>${esc(fin ? "⏱ " + fin.replace(/^(finisce alle|ends at) /, "") : st.n)}</span></span></button>`; }).join("")}</div>`,
    { link: [t("Tutti", "All"), "elettrodomestici"] });
}
HOME_EXTRA.elettrodomestici = { title: () => t("Elettrodomestici", "Appliances"), render: homeCard, show: () => elenco().length > 0 };
/** stanza di un elettrodomestico: quella della presa, altrimenti dei suoi sensori */
const stanzaDi = a => [a.switch, a.power, a.status, a.energy, a.end].map(id => id && S[id] ? areaOf(id) : null).find(Boolean) || null;
/** pallini degli elettrodomestici di una stanza, per la mappa */
export function elettroMappa(area) {
  return elenco().map((a, i) => [a, i]).filter(([a]) => a.mappa !== false && stanzaDi(a) === area).map(([a, i]) => { const st = stato(a);
    return `<span class="mpd2 ap2 ${st.k}"><button data-act="apGo" title="${esc(a.nome)} · ${esc(st.n)}" aria-label="${esc(a.nome)} · ${esc(st.n)}">${vista(a, st.k, "mp" + i, "xs")}</button></span>`; }).join("");
}

function pagina() {
  const L = elenco();
  return `<div class="g g3">${L.map(scheda).join("")}
    ${!L.length ? card("🧺 " + t("Elettrodomestici", "Appliances"), empty(t("Non ho trovato elettrodomestici. Aggiungili con ＋: basta una presa smart che misura i consumi.", "No appliances found. Add them with ＋: a smart plug with power metering is enough.")), { cls: "span3" }) : ""}
    ${isAdmin() ? `<section class="card span3 row" style="gap:8px;flex-wrap:wrap"><button class="add1" data-act="apNew" style="flex:1"><span>＋</span>${t("Aggiungi elettrodomestico", "Add appliance")}</button>
      ${Array.isArray(LAYOUT.appliances) ? `<button class="btn sm" data-act="apAuto">✨ ${t("Torna a quelli trovati da soli", "Back to auto-detected")}</button>` : ""}</section>` : ""}
  </div>`;
}
page("elettrodomestici", { title: t("Elettrodomestici", "Appliances"), short: t("Elettrod.", "Appliances"), icon: "🧺", order: 32, show: () => elenco().length > 0 || isAdmin(),
  badge: () => elenco().some(a => stato(a).k === "done"), render: pagina });

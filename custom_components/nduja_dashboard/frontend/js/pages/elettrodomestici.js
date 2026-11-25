/* Elettrodomestici: lavatrice, asciugatrice, lavastoviglie, forno, frigo… Una scheda per elettrodomestico con
   stato (in funzione / finito / fermo), potenza adesso, consumo di oggi, ora di fine e la presa per accenderlo.
   Si trovano da soli dai nomi (anche se un elettrodomestico ha più dispositivi: presa smart + app del produttore);
   con ✏️ scegli tu nome, aspetto e qualsiasi sensore; con ＋ ne aggiungi di nuovi.
   Aspetto per fermo, in funzione e finito: le animazioni della plancia (disegni.js), le tue immagini o GIF (/local/…) oppure l'icona.
   Lo stesso aspetto compare nella pagina, nella scheda della Home e nella mappa (nella stanza della presa o del sensore). */
import { memoGen, memoVer, tutteLeEntita, S, REG, ACT, CHG, LAYOUT, UI, HOME_EXTRA, VISTE, AREAS, t, esc, nm, ok, val, attr, allEnts, deviceClass, watts, W, fnum, ago, hhmm, card, empty, page, svc, toast,
  openSheet, closeSheet, render, isAdmin, LOC, areaOf, go, ordina, domain, sGet, sSet } from "../core.js";
import { TRASCINA } from "../trascina.js";
import { scegli, cambia, fileEsiste, indirizzoLocale } from "../edit.js";
import { disegno, DISEGNI, riconosci } from "../disegni.js";
import { oggi } from "./energia.js";
import { ciclo, POTENZE_EXTRA, SOGLIE, soglie, aggiornaAvvisiTelefono } from "../avvisi.js";
import { registra, tocca, schedeGrandi, em, quanto, articolo } from "../oggetti.js";

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
/* le entità di ogni tipo si cercano solo quando cambiano le entità di casa (memoGen), non a ogni ridisegno */
const trovati = memoGen(() => {
  const out = [], tutte = tutteLeEntita();
  for (const [k, re, ic, nome] of TIPI()) {
    const E = tutte.filter(id => KEY.test(id) && re.test(id + " " + nm(id)) && !REG[id]?.hidden && REG[id]?.cat == null);
    if (!E.length) continue;
    const pw = E.filter(id => id.startsWith("sensor.") && deviceClass(id) === "power" && !SCARTA.test(id));
    const en = E.filter(id => id.startsWith("sensor.") && deviceClass(id) === "energy" && !SCARTA.test(id));
    const st = E.filter(id => id.startsWith("sensor.") && /machine_state|operation_state|operating_state|stato|status|run_state/i.test(id));
    const fine = E.filter(id => id.startsWith("sensor.") && (deviceClass(id) === "timestamp" && /complet|fine|end|finish/i.test(id) || /remaining|residuo|time_left/i.test(id)));
    const sw = E.filter(id => id.startsWith("switch.") && !SCARTA.test(id));
    if (!pw.length && !st.length && !sw.length) continue;
    out.push({ k, ic, nome, pw, en, st, fine, sw });
  }
  return out;
});
const automatici = memoVer(() => {
  const out = [];
  for (const { k, ic, nome, pw, en, st, fine, sw } of trovati()) {
    const best = L => L.find(id => ok(id) && (W(id) || 0) > 0) || L.find(ok) || L[0] || null;
    out.push({ id: k, nome, icona: ic, power: best(pw), energy: en.find(ok) || en[0] || null, status: st[0] || null, end: fine[0] || null, switch: [...sw].sort((a, b) => a.length - b.length)[0] || null });
  }
  return out;
});
/** gli elettrodomestici, nell'ordine scelto trascinando le schede in ✏️ Modifica (LAYOUT.ordine.elettrodomestici) */
const elenco = memoVer(() => ordina(Array.isArray(LAYOUT.appliances) ? LAYOUT.appliances : automatici(), "elettrodomestici", a => a.id));
TRASCINA.elettrodomestici = { nome: id => elenco().find(a => a.id === id)?.nome || "",
  salva: ({ ids }) => cambia(l => { const o = l.ordine?.elettrodomestici || []; l.ordine = { ...(l.ordine || {}), elettrodomestici: [...ids, ...o.filter(x => !ids.includes(x))] }; }) };
POTENZE_EXTRA.push(() => elenco().map(a => a.power).filter(Boolean));
/* «ha finito» non ha senso per frigo e congelatore (il compressore si accende e spegne da solo): lì l'avviso parte spento */
const avvisoDi = a => a.avviso ?? !/frigo|fridge|freez|congel|refrigerat/i.test(a.id + " " + (a.nome || ""));
SOGLIE.push(id => { const a = elenco().find(x => x.power === id); return a && { threshold: a.threshold || 10, fineW: a.fineW, fineMin: a.fineMin, cicloMin: a.cicloMin, avviso: avvisoDi(a) }; });

/* stato: dal sensore di stato del produttore, altrimenti dal consumo */
const ATTIVO = /run|running|on\b|wash|dry|rins|spin|cook|heat|bake|active|in.?corso|lavaggio|asciug|cottura|funzion/i;
const FERMO = /stop|off|idle|ready|none|pausa|pause|finish|end|complet|standby|ferm/i;
function stato(a) {
  const w = a.power && ok(a.power) ? W(a.power) : null, soglia = a.threshold || 10, c = a.power ? ciclo(a.power) : null;
  const s = a.status && ok(a.status) ? String(S[a.status].state) : null;
  const acceso = s ? ATTIVO.test(s) && !FERMO.test(s) || (w != null && w > soglia) : w != null && w > soglia;
  if (acceso) return { k: "on", n: t("In funzione", "Running"), w };
  if (c?.fine && Date.now() - c.fine < (a.fineOre ?? 3) * 3600e3) return { k: "done", n: t("Finito", "Done") + " · " + ago(new Date(c.fine).toISOString()), w };
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
  return `<section class="card ap1 ${st.k}" data-tri="${esc(a.id)}">
    <div class="ch"><h2>${esc(a.nome)}</h2>${isAdmin() ? `<button class="btn sm" data-act="apEdit" data-i="${i}">✏️</button>` : ""}</div>
    <div class="apr1">${tocca("elettro:" + a.id, vista(a, st.k, "pg" + i), a.nome, "ap1t")}<div class="grow aps1"><b>${esc(st.n)}</b>${fin ? `<span>⏱ ${esc(fin)}</span>` : ""}</div></div>
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
  ["switch", "🔌 " + t("Presa o interruttore", "Plug or switch"), id => id.startsWith("switch.") || id.startsWith("input_boolean.")],
  ["pausa", "⏸ " + t("Pausa (facoltativo)", "Pause (optional)"), id => /^(button|input_button|script|switch)\./.test(id)],
  ["riprendi", "▶ " + t("Riprendi (facoltativo)", "Resume (optional)"), id => /^(button|input_button|script|switch)\./.test(id)]];
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
  const auto = k => k === "pausa" ? pausaAuto(a) : k === "riprendi" ? riprendiAuto(a) : null;
  const riga = ([k, label]) => `<button class="li" data-act="apPick" data-k="${k}"><div class="tx"><b>${label}</b><span>${a[k] && S[a[k]] ? esc(nm(a[k])) + " · " + esc(S[a[k]].state) + " " + esc(attr(a[k], "unit_of_measurement") || "") : auto(k) && a[k] !== "none" ? "✨ " + esc(nm(auto(k))) + " · " + t("trovato da solo", "found by itself") : t("nessuno", "none")}</span></div><span class="st">›</span></button>`;
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
    <p class="small muted" style="margin:6px 0 0;line-height:1.45">${t("Pausa e Riprendi servono alla scheda grande: li trovo da soli tra i pulsanti del produttore (Home Connect, Miele…); se non ci sono, la pausa non compare.", "Pause and Resume are used by the big card: I find them by myself among the maker's buttons (Home Connect, Miele…); if there are none, pause doesn't show.")}</p>
    ${(() => { const M = manutenzioneDi(a, true), no = new Set(a.noManut || []);
      return `<div class="fl1">🧽 ${t("Manutenzione", "Maintenance")}</div>
      <p class="small muted" style="margin:0 0 6px;line-height:1.45">${t("Filtri, sale, brillantante, pulizia del cestello…: li mostro nella scheda grande. Togli la spunta a quelli che non vuoi, con ＋ aggiungi qualsiasi sensore.", "Filters, salt, rinse aid, drum cleaning…: I show them on the big card. Untick the ones you don't want, add any sensor with ＋.")}</p>
      <div class="stack">${M.map(x => `<label class="li rfc1"><input type="checkbox" data-chg="apMan" data-v="${x}" ${no.has(x) ? "" : "checked"}><div class="tx"><b>${esc(nomeManut(a, x))}</b><span>${esc(valoreManut(x).tx)}${(a.manut || []).includes(x) ? " · " + t("aggiunto da te", "added by you") : ""}</span></div></label>`).join("") || `<div class="small muted">${t("Nessun sensore di manutenzione trovato.", "No maintenance sensor found.")}</div>`}
        <button class="add1" data-act="apManAdd"><span>＋</span>${t("Aggiungi un sensore", "Add a sensor")}</button></div>`; })()}
    <div class="fl1">${t("Quando è in funzione e quando ha finito", "When it's running and when it's done")}</div>
    <p class="small muted" style="margin:0 0 6px;line-height:1.45">${t("Ogni elettrodomestico consuma a modo suo: guarda quanto segna a riposo e mentre lavora, e regola i numeri. Valgono per la scheda, per gli avvisi della Home e per quelli sul telefono.", "Every appliance draws power its own way: check what it reads at rest and while working, and adjust the numbers. They apply to the card, the Home alerts and the phone alerts.")}${a.power && ok(a.power) ? ` <b>${t("Adesso", "Now")}: ${watts(W(a.power))}</b>` : ""}</p>
    <div class="apn1">
      <label class="fld1"><span>${t("In funzione sopra (W)", "Running above (W)")}</span><input type="text" inputmode="decimal" value="${String(a.threshold || 10).replace(".", ",")}" data-chg="apN" data-k="threshold"></label>
      <label class="fld1"><span>${t("Ha finito sotto (W)", "Done below (W)")}</span><input type="text" inputmode="decimal" value="${String(a.fineW || 5).replace(".", ",")}" data-chg="apN" data-k="fineW"></label>
      <label class="fld1"><span>${t("…per almeno (minuti)", "…for at least (minutes)")}</span><input type="number" min="1" value="${a.fineMin || 3}" data-chg="apN" data-k="fineMin"></label>
      <label class="fld1"><span>${t("Ciclo più breve (minuti)", "Shortest cycle (minutes)")}</span><input type="number" min="0" value="${a.cicloMin ?? 10}" data-chg="apN" data-k="cicloMin"></label>
      <label class="fld1"><span>${t("«Finito» resta per (ore)", "«Done» stays for (hours)")}</span><input type="text" inputmode="decimal" value="${String(a.fineOre ?? 3).replace(".", ",")}" data-chg="apN" data-k="fineOre"></label>
    </div>
    <p class="small muted" style="margin:6px 0 0;line-height:1.45">${t("«Ciclo più breve»: i cicli più corti non contano come «ha finito». «Finito» resta sulla scheda, nella scheda della Home e nella mappa per queste ore, poi torna «Fermo» (0 = non mostrarlo). L'avviso «ha finito» ha la sua durata in Home → Avvisi → ⚙️.", "«Shortest cycle»: shorter cycles don't count as «done». «Done» stays on the card, the Home card and the map for these hours, then goes back to «Idle» (0 = don't show it). The «is done» alert has its own duration in Home → Alerts → ⚙️.")}</p>
    ${(a.fineW || 5) >= (a.threshold || 10) ? `<div class="small" style="color:var(--orange);margin-top:6px">⚠️ ${t("«Ha finito sotto» deve essere più basso di «In funzione sopra».", "«Done below» must be lower than «Running above».")}</div>` : ""}
    <label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" data-chg="apAvviso" ${avvisoDi(a) ? "checked" : ""}> 🔔 ${t("Avvisami quando ha finito (Home e telefono)", "Tell me when it's done (Home and phone)")}</label>
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
CHG.apN = el => { const k = el.dataset.k, v = parseFloat(String(el.value).replace(",", "."));
  const def = { threshold: 10, fineW: 5, fineMin: 3, cicloMin: 10, fineOre: 3 }[k];
  bz[k] = isNaN(v) || v < 0 ? def : k === "cicloMin" ? Math.round(v) : k === "fineOre" ? Math.round(v * 10) / 10 : Math.max(k === "fineMin" ? 1 : 0.1, v); render(); };
CHG.apAvviso = el => { bz.avviso = el.checked; };
CHG.apMan = el => { const x = el.dataset.v, L = new Set(bz.noManut || []); if (el.checked) L.delete(x); else L.add(x); bz.noManut = L.size ? [...L] : undefined; };
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
    const opz = k === "pausa" || k === "riprendi";   // pausa e riprendi: «automatico» li cerca tra i pulsanti del produttore, «nessuno» li toglie
    scegli({ titolo: v[1], filtro: v[2], attuale: opz ? bz[k] || "" : bz[k] || "none", auto: opz ? (k === "pausa" ? pausaAuto(bz) : riprendiAuto(bz)) || null : false, nessuno: true,
      onPick: id => { idx = i; bz = { ...keep, [k]: opz ? id || undefined : id && id !== "none" ? id : null }; openSheet(config); } }); },
  apManAdd: () => { const keep = { ...bz }, i = idx;
    scegli({ titolo: "🧽 " + t("Sensore di manutenzione", "Maintenance sensor"), sotto: t("Qualsiasi sensore: filtro, sale, pulizia…", "Any sensor: filter, salt, cleaning…"), auto: false, attuale: null,
      filtro: id => /^(sensor|binary_sensor)\./.test(id) && !manutenzioneDi(keep, true).includes(id),
      onPick: id => { idx = i; bz = { ...keep, manut: id ? [...new Set([...(keep.manut || []), id])] : keep.manut, noManut: (keep.noManut || []).filter(x => x !== id) }; if (!bz.noManut.length) delete bz.noManut; openSheet(config); } }); },
  apSave: () => { if (!bz.nome) return toast(t("Scrivi un nome", "Write a name"), true);
    const a = bz, I = Object.values(a.img || {}), manca = I.some(u => fileEsiste(u) === "no");
    const L = [...elenco()]; if (idx < 0) L.push(a); else L[idx] = a; closeSheet();
    salva(L).then(() => aggiornaAvvisiTelefono()).then(() => toast(a.aspetto === "immagini" && !I.length ? "💾 " + t("Salvato: senza immagini uso l'animazione della plancia", "Saved: with no images I use the dashboard animation")
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
    return `<button class="${st.k}" ${schedeGrandi() ? `data-act="ogApri" data-k="elettro:${esc(a.id)}"` : `data-act="apGo"`}>${vista(a, st.k, "hm" + i, "sm")}<span class="tx"><b>${esc(a.nome)}</b><span>${esc(fin ? "⏱ " + fin.replace(/^(finisce alle|ends at) /, "") : st.n)}</span></span></button>`; }).join("")}</div>`,
    { link: [t("Tutti", "All"), "elettrodomestici"] });
}
HOME_EXTRA.elettrodomestici = { title: () => t("Elettrodomestici", "Appliances"), render: homeCard, show: () => elenco().length > 0 };
/** elettrodomestici in funzione per la scena della pagina Energia, dal più energivoro: { nome, w, vista(cls, key) } */
VISTE.elettroAccesi = () => elenco().map(a => ({ a, st: stato(a) })).filter(x => x.st.k === "on")
  .map(({ a, st }) => ({ nome: a.nome, w: st.w, vista: (cls, key) => vista(a, "on", key, cls) })).sort((x, y) => (y.w ?? -1) - (x.w ?? -1));
/** stanza di un elettrodomestico: quella della presa, altrimenti dei suoi sensori */
const stanzaDi = a => [a.switch, a.power, a.status, a.energy, a.end].map(id => id && S[id] ? areaOf(id) : null).find(Boolean) || null;
/** pallini degli elettrodomestici di una stanza, per la mappa */
export function elettroMappa(area) { return elettroStanza(area).map(e => e.html).join(""); }
/** elettrodomestici di una stanza, uno per uno (per metterli al loro posto nella mappa e nella casa in 3D): [{ id, nome, on, html }] */
export function elettroStanza(area, pre = "mp") {
  return elenco().map((a, i) => [a, i]).filter(([a]) => a.mappa !== false && stanzaDi(a) === area).map(([a, i]) => { const st = stato(a);
    return { id: a.id, nome: a.nome, on: st.k === "on",
      html: `<span class="mpd2 ap2 ${st.k}"><button data-act="apGo" title="${esc(a.nome)} · ${esc(st.n)}" aria-label="${esc(a.nome)} · ${esc(st.n)}">${vista(a, st.k, pre + i, "xs")}</button></span>` }; });
}

/* ---------- scheda oggetto (oggetti.js): l'elettrodomestico disegnato, quanto manca, pausa, presa e manutenzione ---------- */
const apDi = id => elenco().find(a => a.id === id) || null;
/** le entità dei dispositivi dell'elettrodomestico (presa, sensori, app del produttore): per pausa e manutenzione */
function parenti(a) {
  const D = new Set([a.power, a.status, a.switch, a.end, a.energy].filter(x => x && S[x]).map(x => REG[x]?.device).filter(Boolean)), mie = new Set([a.power, a.status, a.switch, a.end, a.energy]);
  return Object.keys(S).filter(x => D.has(REG[x]?.device) && !mie.has(x));
}
const PAUSA = /pause|pausa|sospend|interromp/i, RIPRENDI = /resume|riprend|continu|start|avvia|play/i;
const pausaAuto = a => parenti(a).find(x => /^(button|input_button)\./.test(x) && PAUSA.test(x + " " + nm(x))) || null;
const riprendiAuto = a => parenti(a).find(x => /^(button|input_button)\./.test(x) && RIPRENDI.test(x + " " + nm(x)) && !PAUSA.test(x + " " + nm(x)) && !/delay|ritard|remote|update|aggiorn/i.test(x)) || null;
const scelto = (a, k, f) => a[k] === "none" ? null : a[k] && S[a[k]] ? a[k] : f(a);
const pausaDi = a => scelto(a, "pausa", pausaAuto), riprendiDi = a => scelto(a, "riprendi", riprendiAuto) || pausaDi(a);   // alcuni hanno un solo pulsante «avvia / pausa»
const inPausa = a => !!a.status && ok(a.status) && /paus/i.test(String(S[a.status].state));
const premi = id => { const d = domain(id); return d === "script" ? svc("script", "turn_on", {}, { entity_id: id }) : d === "switch" ? svc("switch", "toggle", {}, { entity_id: id }) : svc(d, "press", {}, { entity_id: id }); };
/* manutenzione: sensori del produttore che parlano di filtri, sale, pulizie (più quelli aggiunti in ✏️, meno quelli tolti) */
const MANUT = /filt|tub.?clean|drum.?clean|pulizi|clean|decalc|descal|calcare|\bsal[et]\b|salt|brillant|rinse.?aid|lint|lanugin|condens|detersiv|deterg|serbatoi|tank|maintenance|manutenz|odor|odour/i;
function manutenzioneDi(a, tutti = false) {
  const no = new Set(tutti ? [] : a.noManut || []);
  const L = parenti(a).filter(x => /^(sensor|binary_sensor)\./.test(x) && MANUT.test(x + " " + nm(x)) && !/time|tempo|power|energy|program|programma/i.test(x) && REG[x]?.hidden !== true);
  return [...new Set([...L, ...(a.manut || []).filter(x => S[x])])].filter(x => !no.has(x));
}
const nomeManut = (a, x) => nm(x).replace(new RegExp("^" + (a.nome || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "") || nm(x);
/* gli stati dei sensori di manutenzione dei produttori (spesso in inglese), detti come li diresti */
const STATI_MANUT = () => ({ low: t("basso", "low"), empty: t("vuoto", "empty"), required: t("da fare", "to do"), needed: t("da fare", "to do"), warning: t("da controllare", "check it"),
  ok: t("a posto", "fine"), full: t("pieno", "full"), present: t("presente", "present"), absent: t("manca", "missing"), off: t("a posto", "fine"), on: t("da controllare", "check it") });
function valoreManut(x) {
  if (!ok(x)) return { tx: t("non raggiungibile", "unavailable"), cls: "" };
  if (x.startsWith("binary_sensor.")) return S[x].state === "on" ? { tx: t("da controllare", "check it"), cls: "warn" } : { tx: t("a posto", "fine"), cls: "" };
  const u = attr(x, "unit_of_measurement") || "", v = S[x].state, n = String(v).toLowerCase().replace(/[\s-]+/g, "_");
  return { tx: isNaN(parseFloat(v)) ? STATI_MANUT()[n] || String(v).replace(/_/g, " ") : fnum(parseFloat(v), 0) + (u ? (u === "%" ? "" : " ") + u : ""), cls: /^(on|required|needed|low|empty|vuoto|warning|necessar)/i.test(v) ? "warn" : "" };
}
const femm = a => ["lavatrice", "asciugatrice", "lavastoviglie", "friggitrice"].includes(riconosci(a) || "") || /lavatric|asciugatric|lavastovigl|friggitric|macchina|presa|caldaia/i.test(a.nome || "");
const VERBO = () => ({ lavatrice: t("Sto lavando", "I'm washing"), asciugatrice: t("Sto asciugando", "I'm drying"), lavastoviglie: t("Sto lavando i piatti", "I'm washing the dishes"), forno: t("Sto cuocendo", "I'm cooking"), frigo: t("Sto raffreddando", "I'm cooling") });
const CONSIGLIO = () => ({ lavatrice: t("è ora di stendere!", "time to hang the washing!"), asciugatrice: t("piega i panni finché sono caldi.", "fold the clothes while they're warm."), lavastoviglie: t("apri lo sportello e fai uscire il vapore.", "open the door and let the steam out."), forno: t("attenzione, è ancora caldo.", "careful, it's still hot.") });
/** quando finisce: { ore (Date) oppure min (minuti che mancano) } */
function fineDi(a) {
  if (!a.end || !ok(a.end)) return null;
  const v = S[a.end].state;
  if (deviceClass(a.end) === "timestamp" || /^\d{4}-\d\d-\d\dT/.test(v)) { const d = new Date(v); return d > Date.now() ? { ore: d, min: (d - Date.now()) / 60e3 } : null; }
  const n = parseFloat(v); if (isNaN(n) || n <= 0) return null;
  const u = String(attr(a.end, "unit_of_measurement") || "min").toLowerCase();
  return { min: u.startsWith("h") ? n * 60 : u.startsWith("s") ? n / 60 : n };
}
/* «38 minuti in anticipo»: la prima ora di fine che l'elettrodomestico ha detto in questo ciclo, confrontata con quando ha finito davvero.
   Si segna su questo dispositivo (come i cicli, vedi avvisi.js): { [id]: { on: inizio del ciclo (ms), fine: fine prevista (ms) } } */
let PREV = {}; try { PREV = JSON.parse(sGet("apPrev") || "{}") || {}; } catch {}
function segnaPrevisione(a) {
  if (!a.power || !a.end) return;
  const c = ciclo(a.power), fi = c.on ? fineDi(a) : null; if (!fi || PREV[a.id]?.on === c.on) return;
  PREV[a.id] = { on: c.on, fine: Math.round(fi.ore ? +fi.ore : Date.now() + fi.min * 60e3) };
  sSet("apPrev", JSON.stringify(PREV));
}
setInterval(() => { try { elenco().forEach(segnaPrevisione); } catch {} }, 30000);
/** minuti di anticipo (positivi) o di ritardo (negativi) dell'ultimo ciclo finito rispetto alla prima previsione; null se non lo so */
function anticipo(a) {
  if (!a.power) return null;
  const c = ciclo(a.power), r = PREV[a.id];
  if (!c.fine || !r || r.on > c.fine || c.fine - r.on > 12 * 3600e3) return null;
  return (r.fine - (c.fine - soglie(a.power).min * 60e3)) / 60e3;   // il consumo è sceso qualche minuto prima che me ne accorgessi
}
/** «38 minuti in anticipo», «con 12 minuti di ritardo», «puntuale» (null se non lo so) */
const comeAnticipo = m => m == null ? null : Math.abs(m) < 3 ? t("puntuale", "right on time") : m > 0 ? quanto(m * 60) + t(" in anticipo", " early") : t("con ", "") + quanto(-m * 60) + t(" di ritardo", " late");
/** chi è, per le frasi in terza persona: «La lavatrice» se il nome è quello del tipo, altrimenti il nome com'è («Miele») */
const soggetto = a => { const n = a.nome || ""; if (!riconosci(a) || !/^(la |il |lo |l')?(lavatric|asciugatric|lavastovigl|forno|frigo|friggitric|washer|washing|dryer|dishwasher|oven|fridge)/i.test(n)) return n;
  const x = articolo(n); return x[0].toUpperCase() + x.slice(1); };
const raggiungibileAp = a => [a.power, a.status, a.switch].some(x => x && ok(x)) || ![a.power, a.status, a.switch].some(Boolean);
function fraseElettro(a) {
  const f = femm(a), st = stato(a), tipo = riconosci(a) || disegnoDi(a), V = VERBO()[tipo] || t("Sono in funzione", "I'm running");
  if (!raggiungibileAp(a)) return t(`${em("Non ti sento")}: controlla la presa o la rete.`, `${em("I can't hear you")}: check the plug or the network.`);
  const M = manutenzioneDi(a).filter(x => valoreManut(x).cls === "warn"), coda = M.length ? " " + t(`Da controllare: ${em(nomeManut(a, M[0]).toLowerCase())}.`, `Please check: ${em(nomeManut(a, M[0]).toLowerCase())}.`) : "";
  if (inPausa(a)) return t(`Sono ${em("in pausa")}. Riprendo quando vuoi.`, `I'm ${em("paused")}. I'll carry on whenever you like.`) + coda;
  if (st.k === "on") {
    const fi = fineDi(a), c = a.power ? ciclo(a.power) : null;
    if (fi?.ore && fi.min > 2) return `${V}: ` + t(`${em("finisco alle " + hhmm(fi.ore))}.`, `${em("I'll finish at " + hhmm(fi.ore))}.`) + coda;
    if (fi && fi.min > 0) return `${V}: ` + t(`${em("mi mancano " + quanto(fi.min * 60))}.`, `${em(quanto(fi.min * 60) + " to go")}.`) + coda;
    if (c?.on && Date.now() - c.on > 120e3) return `${V} ` + t(`da ${em(quanto((Date.now() - c.on) / 1000))}`, `for ${em(quanto((Date.now() - c.on) / 1000))}`) + (st.w != null ? t(`, consumo ${watts(st.w)}.`, `, using ${watts(st.w)}.`) : ".") + coda;
    return `${V}` + (st.w != null ? t(`: consumo ${em(watts(st.w))}.`, `: using ${em(watts(st.w))}.`) : ".") + coda;
  }
  if (st.k === "done") { const fine = a.power ? ciclo(a.power).fine : 0, k = CONSIGLIO()[tipo];
    return t(`${em("Ho finito")}`, `${em("I'm done")}`) + (fine ? " " + t(`${quanto((Date.now() - fine) / 1000)} fa`, `${quanto((Date.now() - fine) / 1000)} ago`) : "") + (k ? t(": ", ": ") + k : ".") + coda; }
  if (st.k === "off") return t(`Sono ${em(f ? "spenta" : "spento")} dalla presa.`, `I'm ${em("switched off")} at the plug.`) + coda;
  if (tipo === "frigo") return t(`Tengo tutto ${em("al fresco")}.`, `I'm keeping everything ${em("cool")}.`) + coda;
  return t(`Sono ${em(f ? "pronta" : "pronto")} quando vuoi.`, `I'm ${em("ready")} when you are.`) + coda;
}
/** il disegno grande con l'anello di quanto manca (se si sa da quando lavora e quando finisce) */
function disegnoElettro(a, m) {
  const st = stato(a), v = vista(a, inPausa(a) ? "idle" : st.k, "og" + m, "og1v " + m);
  if (m !== "xl" || st.k !== "on") return v;
  const fi = fineDi(a), c = a.power ? ciclo(a.power) : null;
  if (!fi || !c?.on) return v;
  const fineMs = Date.now() + fi.min * 60e3, p = Math.min(1, Math.max(0, (Date.now() - c.on) / (fineMs - c.on || 1)));
  return `<span class="og1pg">${v}<svg class="og1pgr" viewBox="0 0 100 100" aria-hidden="true"><circle class="tr" cx="50" cy="50" r="47" pathLength="100"/><circle class="pi" cx="50" cy="50" r="47" pathLength="100" style="stroke-dasharray:${(p * 100).toFixed(1)} 100"/></svg></span>`;
}
registra("elettro", {
  nome: () => t("Elettrodomestici", "Appliances"), icona: "🧺", ordine: 50, pagina: "elettrodomestici",
  elenco: () => elenco().map(a => a.id), esiste: id => !!apDi(id),
  titolo: id => apDi(id).nome, luogo: id => AREAS[stanzaDi(apDi(id))]?.name || "",
  stato: id => { const a = apDi(id); if (!raggiungibileAp(a)) return "na"; if (inPausa(a)) return "warn"; const k = stato(a).k; return k === "on" ? "run" : k === "done" ? "warn" : k === "off" ? "off" : "ok"; },
  frase: id => fraseElettro(apDi(id)),
  semplice: id => { const a = apDi(id), st = stato(a), fi = st.k === "on" ? fineDi(a) : null;
    if (!raggiungibileAp(a)) return t("Non raggiungibile", "Unavailable");
    return [inPausa(a) ? t("In pausa", "Paused") : st.n, fi ? (fi.ore ? t("fine ", "ends ") + hhmm(fi.ore) : t("mancano ", "") + quanto(fi.min * 60) + t("", " left")) : st.k === "on" && st.w != null ? watts(st.w) : ""].filter(Boolean).join(" · "); },
  /* le entità dell'elettrodomestico (presa, sensori) portano a lui: per le frasi negli Avvisi */
  trova: e => elenco().find(a => a.id === e || [a.power, a.status, a.switch, a.end, a.energy].includes(e))?.id ?? null,
  /* negli Avvisi (se chi usa la plancia lo sceglie): «La lavatrice ha finito, 38 minuti in anticipo.» */
  avviso: id => { const a = apDi(id); if (stato(a).k !== "done") return null;
    const an = comeAnticipo(anticipo(a)), k = CONSIGLIO()[riconosci(a) || disegnoDi(a)], chi = esc(soggetto(a)) + " " + t("ha finito", "is done");
    return an ? `${chi}, ${an}.` : k ? `${chi}: ${k}` : chi + "."; },
  disegno: (id, m) => disegnoElettro(apDi(id), m),
  comandi: id => { const a = apDi(id), st = stato(a), B = [], p = pausaDi(a), r = riprendiDi(a);
    if (inPausa(a) && r) B.push({ act: "ogApPremi", id: r, ic: "▶", txt: t("Riprendi", "Resume"), pri: true, off: S[r]?.state === "unavailable" });
    else if (st.k === "on" && p) B.push({ act: "ogApPremi", id: p, ic: "⏸", txt: t("Pausa", "Pause"), pri: true, off: S[p]?.state === "unavailable" });
    if (a.switch && S[a.switch]) { const on = S[a.switch].state === "on", gira = on && st.k === "on";
      B.push(gira ? { act: "ogApPresa", id, ic: "🔌", txt: t("Spegni la presa", "Switch off the plug"), tieni: t("Tieni premuto: lo fermi mentre lavora", "Press and hold: it stops while running"), cls: "bad", off: !ok(a.switch) }
        : { act: "ogApPresa", id, ic: "🔌", txt: on ? t("Spegni la presa", "Switch off the plug") : t("Accendi la presa", "Switch on the plug"), pri: !on, off: !ok(a.switch) }); }
    return B; },
  dati: id => { const a = apDi(id), st = stato(a), kwh = a.energy ? oggi(a.energy) : null, fi = st.k === "on" ? fineDi(a) : null, c = a.power ? ciclo(a.power) : null;
    return [a.power ? ["⚡", st.w != null ? watts(st.w) : "—"] : null, kwh != null ? ["📊", fnum(kwh, 2) + t(" kWh oggi", " kWh today")] : null,
      fi ? ["⏱", fi.ore ? t("fine ", "ends ") + hhmm(fi.ore) : quanto(fi.min * 60)] : null,
      c?.fine && st.k !== "on" ? ["🕒", t("ultimo ciclo ", "last cycle ") + new Date(c.fine).toLocaleString(LOC, { weekday: "short", hour: "2-digit", minute: "2-digit" })] : null,
      st.k === "done" && comeAnticipo(anticipo(a)) ? ["🎯", esc(comeAnticipo(anticipo(a)))] : null]; },
  extra: id => { const a = apDi(id), M = manutenzioneDi(a); if (!M.length) return "";
    return `<div class="fl1">🧽 ${t("Manutenzione", "Maintenance")}</div><div class="og1mn">${M.map(x => { const v = valoreManut(x); return `<button class="${v.cls}" data-act="more" data-id="${x}"><small>${esc(nomeManut(a, x))}</small><b>${esc(v.tx)}</b></button>`; }).join("")}</div>`; },
  gesti: id => { const a = apDi(id), st = stato(a), p = pausaDi(a), r = riprendiDi(a);
    if (inPausa(a) && r) return { tocco: () => premi(r).then(() => toast("▶ " + t("Riprendo", "Resuming"))).catch(() => {}), aiuto: t("Tocca il disegno per riprendere", "Tap the drawing to resume") };
    if (st.k === "on" && p) return { tocco: () => premi(p).then(() => toast("⏸ " + t("In pausa", "Paused"))).catch(() => {}), aiuto: t("Tocca il disegno per mettere in pausa", "Tap the drawing to pause") };
    return {}; },
});
Object.assign(ACT, {
  ogApPremi: el => premi(el.dataset.id).then(() => toast("✓ " + nm(el.dataset.id))).catch(() => {}),
  ogApPresa: el => { const a = apDi(el.dataset.id); if (!a?.switch) return; const on = S[a.switch].state === "on";
    svc(domain(a.switch), on ? "turn_off" : "turn_on", {}, { entity_id: a.switch }).then(() => toast("🔌 " + (on ? t("Presa spenta", "Plug off") : t("Presa accesa", "Plug on")))).catch(() => {}); },
});

function pagina() {
  const L = elenco();
  return `<div class="g g3" ${UI.edit && isAdmin() ? `data-tr="elettrodomestici"` : ""}>${L.map(scheda).join("")}
    ${!L.length ? card("🧺 " + t("Elettrodomestici", "Appliances"), empty(t("Non ho trovato elettrodomestici. Aggiungili con ＋: basta una presa smart che misura i consumi.", "No appliances found. Add them with ＋: a smart plug with power metering is enough.")), { cls: "span3" }) : ""}
    ${isAdmin() ? `<section class="card span3 row" style="gap:8px;flex-wrap:wrap"><button class="add1" data-act="apNew" style="flex:1"><span>＋</span>${t("Aggiungi elettrodomestico", "Add appliance")}</button>
      ${Array.isArray(LAYOUT.appliances) ? `<button class="btn sm" data-act="apAuto">✨ ${t("Torna a quelli trovati da soli", "Back to auto-detected")}</button>` : ""}
      ${UI.edit && L.length > 1 ? `<p class="small muted" style="flex-basis:100%;margin:2px 0 0">${t("Trascina le schede per cambiarne l'ordine: vale anche nella Home.", "Drag the cards to change their order: it applies on Home too.")}</p>` : ""}</section>` : ""}
  </div>`;
}
/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("Lavatrice, asciugatrice e lavastoviglie: se stanno andando, quando finiscono e quanto consumano.", "Washer, dryer and dishwasher: whether they're running, when they finish and how much they use."),
  serve: t("Una presa smart che misura i consumi, oppure l'integrazione del produttore dell'elettrodomestico.", "A smart plug that measures power, or the appliance maker's integration."),
  passi: [t("Collega l'elettrodomestico a una presa smart che misura i consumi e aggiungila a Home Assistant.", "Plug the appliance into a smart plug that measures power and add it to Home Assistant."),
    t("Se la presa si chiama come l'elettrodomestico («Lavatrice»…) lo trovo da solo; altrimenti Elettrodomestici → ＋.", "If the plug is named after the appliance («Washer»…) I find it by myself; otherwise Appliances → ＋.")],
  anteprima: [["🧺", t("Lavatrice", "Washer"), t("finisce tra 25 min", "done in 25 min"), "1,9 kW"]] };
page("elettrodomestici", { richiede: RICHIEDE, title: t("Elettrodomestici", "Appliances"), short: t("Elettrod.", "Appliances"), icon: "🧺", order: 32, editable: true, show: () => elenco().length > 0 || isAdmin(),
  badge: () => elenco().some(a => stato(a).k === "done"), render: pagina });

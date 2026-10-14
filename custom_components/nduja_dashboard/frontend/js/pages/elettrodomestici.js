/* Elettrodomestici: lavatrice, asciugatrice, lavastoviglie, forno, frigo… Una scheda per elettrodomestico con
   stato (in funzione / finito / fermo), potenza adesso, consumo di oggi, ora di fine e la presa per accenderlo.
   Si trovano da soli dai nomi (anche se un elettrodomestico ha più dispositivi: presa smart + app del produttore);
   con ✏️ scegli tu nome, icona e qualsiasi sensore; con ＋ ne aggiungi di nuovi. */
import { S, REG, ACT, CHG, LAYOUT, UI, t, esc, nm, ok, val, attr, allEnts, deviceClass, watts, W, fnum, ago, hhmm, card, empty, page, svc, toast,
  openSheet, closeSheet, render, isAdmin, LOC } from "../core.js";
import { scegli, cambia } from "../edit.js";
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
    <div class="ch"><h2><span class="api1">${esc(a.icona || "🔌")}</span> ${esc(a.nome)}</h2>${isAdmin() ? `<button class="btn sm" data-act="apEdit" data-i="${i}">✏️</button>` : ""}</div>
    <div class="aps1"><b>${esc(st.n)}</b>${fin ? `<span>⏱ ${esc(fin)}</span>` : ""}</div>
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
function config() {
  const a = bz;
  const riga = ([k, label]) => `<button class="li" data-act="apPick" data-k="${k}"><div class="tx"><b>${label}</b><span>${a[k] && S[a[k]] ? esc(nm(a[k])) + " · " + esc(S[a[k]].state) + " " + esc(attr(a[k], "unit_of_measurement") || "") : t("nessuno", "none")}</span></div><span class="st">›</span></button>`;
  return `<div class="sh-head"><div><h3>${esc(a.icona || "🔌")} ${idx < 0 ? t("Nuovo elettrodomestico", "New appliance") : esc(a.nome)}</h3><div class="small muted">${t("Puoi scegliere qualsiasi sensore della casa.", "You can choose any sensor in the house.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="row" style="gap:10px"><label class="fld1" style="flex:0 0 80px"><span>${t("Icona", "Icon")}</span><input type="text" maxlength="4" value="${esc(a.icona || "")}" data-chg="apF" data-k="icona"></label>
      <label class="fld1" style="flex:1"><span>${t("Nome", "Name")}</span><input type="text" value="${esc(a.nome || "")}" data-chg="apF" data-k="nome" placeholder="${t("Lavatrice", "Washing machine")}"></label></div>
    <div class="vr1" style="margin:8px 0">${TIPI().map(([, , ic, n]) => `<button data-act="apTipo" data-ic="${ic}" data-n="${esc(n)}">${ic} ${esc(n)}</button>`).join("")}</div>
    <div class="stack">${VOCI().map(riga).join("")}</div>
    <label class="fld1"><span>${t("In funzione sopra (W)", "Running above (W)")}</span><input type="number" min="1" value="${a.threshold || 10}" data-chg="apF" data-k="threshold"></label>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="apSave">💾 ${t("Salva", "Save")}</button>${idx >= 0 ? `<button class="btn bad" data-act="apDel">🗑 ${t("Togli", "Remove")}</button>` : ""}</div>`;
}
CHG.apF = el => { bz[el.dataset.k] = el.dataset.k === "threshold" ? +el.value || 10 : el.value; };
const salva = L => cambia(l => { l.appliances = L; });
Object.assign(ACT, {
  apEdit: el => { idx = +el.dataset.i; bz = { ...elenco()[idx] }; openSheet(config); },
  apNew: () => { idx = -1; bz = { id: "a" + Date.now().toString(36), nome: "", icona: "🔌" }; openSheet(config); },
  apTipo: el => { bz.icona = el.dataset.ic; if (!bz.nome) bz.nome = el.dataset.n; render(); },
  apPick: el => { const k = el.dataset.k, v = VOCI().find(x => x[0] === k), keep = { ...bz }, i = idx;
    scegli({ titolo: v[1], filtro: v[2], attuale: bz[k] || "none", auto: false, nessuno: true,
      onPick: id => { idx = i; bz = { ...keep, [k]: id && id !== "none" ? id : null }; openSheet(config); } }); },
  apSave: () => { if (!bz.nome) return toast(t("Scrivi un nome", "Write a name"), true);
    const L = [...elenco()]; if (idx < 0) L.push(bz); else L[idx] = bz; closeSheet(); salva(L).then(() => toast("💾 " + bz.nome)); },
  apDel: () => { const L = elenco().filter((_, j) => j !== idx); closeSheet(); salva(L); },
  apAuto: () => cambia(l => { delete l.appliances; }),
  apSwitch: el => { const a = elenco()[+el.dataset.i], on = S[a.switch].state === "on";
    if (on && stato(a).k === "on" && !confirm(t("È in funzione: spegnendo la presa lo fermi. Continuo?", "It's running: switching off the plug will stop it. Continue?"))) return;
    svc(a.switch.split(".")[0], on ? "turn_off" : "turn_on", {}, { entity_id: a.switch }); },
});

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

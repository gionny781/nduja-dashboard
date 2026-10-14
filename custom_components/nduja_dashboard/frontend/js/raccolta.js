/* Raccolta differenziata: «Stasera esponi …» e i prossimi ritiri.
   Fonti trovate da sole: sensori con il tipo di rifiuto nello stato (oggi / domani) e calendari della raccolta.
   Con ✏️ si scelgono a mano. */
import { S, ACT, CHG, LAYOUT, UI, t, esc, nm, ok, ents, allEnts, card, saveLayout, toast, openSheet, closeSheet, isAdmin } from "./core.js";
import { RIFIUTI, eventi, nelGiorno, nomeGiorno, inizio } from "./agenda.js";

/* tipi di rifiuto: parole → colore ed emoji */
const TIPI = [
  [/plastic|imballagg|plastik/i, "#f5c518", "🧴", () => t("Plastica", "Plastic")],
  [/carta|cartone|paper|cardboard|papier/i, "#3d8bff", "📦", () => t("Carta", "Paper")],
  [/vetro|glass|glas/i, "#2fbf71", "🍾", () => t("Vetro", "Glass")],
  [/metall|lattin|alluminio|metal|cans/i, "#9aa7b8", "🥫", () => t("Metalli", "Metal")],
  [/umido|organic|organico|food|bio|compost/i, "#a0682e", "🍂", () => t("Umido", "Organic")],
  [/verde|sfalci|potature|garden|green|yard/i, "#5cb85c", "🌿", () => t("Verde", "Garden")],
  [/indifferenz|secco|residu|general|rest|landfill|non riciclabile/i, "#6b6f76", "🗑️", () => t("Indifferenziato", "General waste")],
  [/pannolin|tessil|nappies|diaper|textile/i, "#c792ea", "👕", () => t("Tessili/pannolini", "Textiles")],
];
/** «Sacco Carta e Vetro» → [carta, vetro] */
export function tipi(testo) {
  const s = String(testo || "");
  const T = TIPI.filter(([re]) => re.test(s));
  if (T.length) return T.map(([, c, e, n]) => ({ c, e, n: n() }));
  return s && !/^(unknown|unavailable|none|nessun|-|—)$/i.test(s) ? [{ c: "#8a8f98", e: "♻️", n: s }] : [];
}
export const chip = x => `<span class="rf1" style="--c:${x.c}">${x.e} ${esc(x.n)}</span>`;

const sensoreRifiuti = id => RIFIUTI.test(id + " " + nm(id)) && !/version|versione|aggiornament|notific|orario/i.test(id + " " + nm(id)) && ok(id) && isNaN(+S[id].state) && !/^\d{4}-\d\d-\d\d/.test(S[id].state);
const calRifiuti = id => RIFIUTI.test(id + " " + nm(id));
const domani = id => /domani|tomorrow|morgen/i.test(id + " " + nm(id)) || /_2$/.test(id) && ents("sensor").includes(id.replace(/_2$/, ""));

/** fonti: { sensori: [{id, quando:"oggi"|"domani"}], calendari: [] } */
export function fonti() {
  const w = LAYOUT.waste || {};
  const sens = w.sensors ? w.sensors.filter(id => S[id]) : allEnts("sensor", sensoreRifiuti);
  const cals = w.calendars ? w.calendars.filter(id => S[id]) : ents("calendar").filter(calRifiuti);
  return { sensori: sens.map(id => ({ id, quando: w.when?.[id] || (domani(id) ? "domani" : "oggi") })), calendari: cals };
}

/** cosa si ritira oggi e domani, e i prossimi giorni dal calendario */
export function ritiri() {
  const F = fonti(), out = { oggi: [], domani: [], prossimi: [] };
  for (const s of F.sensori) out[s.quando].push(...tipi(S[s.id].state));
  const ev = eventi(F.calendari, 8) || [];
  const oggi = new Date(), dom = new Date(Date.now() + 864e5);
  if (!F.sensori.some(s => s.quando === "oggi")) ev.filter(e => nelGiorno(e, oggi)).forEach(e => out.oggi.push(...tipi(e.summary)));
  if (!F.sensori.some(s => s.quando === "domani")) ev.filter(e => nelGiorno(e, dom)).forEach(e => out.domani.push(...tipi(e.summary)));
  const g = {};
  ev.filter(e => inizio(e) >= new Date(new Date().setHours(0, 0, 0, 0) + 2 * 864e5)).forEach(e => { const k = inizio(e).toDateString(); (g[k] = g[k] || { d: inizio(e), x: [] }).x.push(...tipi(e.summary)); });
  out.prossimi = Object.values(g).slice(0, 4);
  const uniq = L => [...new Map(L.map(x => [x.n, x])).values()];
  out.oggi = uniq(out.oggi); out.domani = uniq(out.domani);
  return out;
}
export const haRaccolta = () => { const F = fonti(); return F.sensori.length + F.calendari.length > 0; };

export function raccoltaCard() {
  if (!haRaccolta() && !UI.edit) return "";
  const R = ritiri(), sera = new Date().getHours() >= 12;
  const riga = (titolo, L, forte) => `<div class="rfr1 ${forte ? "on" : ""}"><small>${titolo}</small><div>${L.length ? L.map(chip).join("") : `<span class="muted small">${t("niente", "nothing")}</span>`}</div></div>`;
  const ed = UI.edit && isAdmin() ? `<button class="btn sm" data-act="rfEdit">✏️</button>` : "";
  if (!haRaccolta()) return card("♻️ " + t("Raccolta differenziata", "Waste collection"), `<div class="small muted">${t("Non ho trovato sensori o calendari della raccolta. Sceglili con ✏️.", "No waste sensors or calendars found. Pick them with ✏️.")}</div>`, { right: ed });
  return card("♻️ " + t("Raccolta differenziata", "Waste collection"), `
    ${riga(sera ? "🌙 " + t("Stasera esponi", "Put out tonight") : "☀️ " + t("Oggi si ritira", "Collected today"), sera ? R.domani : R.oggi, true)}
    ${riga(sera ? t("Ritirato oggi", "Collected today") : t("Domani", "Tomorrow"), sera ? R.oggi : R.domani)}
    ${R.prossimi.length ? `<div class="rfn1">${R.prossimi.map(p => `<div><small>${esc(nomeGiorno(p.d))}</small>${p.x.map(chip).join("")}</div>`).join("")}</div>` : ""}`, { right: ed });
}

/* ---------- ✏️ scelta delle fonti ---------- */
let bz = null;
function config() {
  const F = fonti(), w = bz || { sensors: F.sensori.map(s => s.id), calendars: F.calendari, when: Object.fromEntries(F.sensori.map(s => [s.id, s.quando])) };
  bz = w;
  const testo = id => ok(id) && isNaN(+S[id].state) && !/version|versione/i.test(id + nm(id));
  let S1 = allEnts("sensor", id => testo(id) && RIFIUTI.test(id + " " + nm(id)));
  if (!S1.length) S1 = allEnts("sensor", testo).slice(0, 60);
  S1 = [...new Set([...w.sensors.filter(id => S[id]), ...S1])];
  return `<div class="sh-head"><div><h3>♻️ ${t("Raccolta differenziata", "Waste collection")}</h3><div class="small muted">${t("Scegli da dove prendo i ritiri.", "Choose where pickups come from.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("Sensori (lo stato dice cosa si ritira)", "Sensors (state says what is collected)")}</div>
    <div class="stack">${S1.map(id => `<label class="li rfc1"><input type="checkbox" data-chg="rfSens" data-id="${id}" ${w.sensors.includes(id) ? "checked" : ""}><div class="tx"><b>${esc(nm(id))}</b><span>${esc(S[id].state)}</span></div>
      <select data-chg="rfWhen" data-id="${id}"><option value="oggi" ${w.when[id] !== "domani" ? "selected" : ""}>${t("oggi", "today")}</option><option value="domani" ${w.when[id] === "domani" ? "selected" : ""}>${t("domani", "tomorrow")}</option></select></label>`).join("")}</div>
    <div class="fl1">${t("Calendari", "Calendars")}</div>
    <div class="stack">${ents("calendar").map(id => `<label class="li rfc1"><input type="checkbox" data-chg="rfCal" data-id="${id}" ${w.calendars.includes(id) ? "checked" : ""}><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)}</span></div></label>`).join("") || `<div class="small muted">—</div>`}</div>
    <div class="row" style="gap:8px;margin-top:14px"><button class="btn pri" data-act="rfSave">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="rfAuto">${t("Automatico", "Automatic")}</button></div>`;
}
const tog = (L, id, on) => on ? [...new Set([...L, id])] : L.filter(x => x !== id);
CHG.rfSens = el => { bz.sensors = tog(bz.sensors, el.dataset.id, el.checked); };
CHG.rfCal = el => { bz.calendars = tog(bz.calendars, el.dataset.id, el.checked); };
CHG.rfWhen = el => { bz.when[el.dataset.id] = el.value; };
async function salva(w) {
  const l = JSON.parse(JSON.stringify(LAYOUT));
  if (w) l.waste = w; else delete l.waste;
  try { await saveLayout(l); closeSheet(); toast("♻️ " + t("Salvato", "Saved")); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
}
Object.assign(ACT, {
  rfEdit: () => { bz = null; openSheet(config); },
  rfSave: () => salva(bz),
  rfAuto: () => salva(null),
});

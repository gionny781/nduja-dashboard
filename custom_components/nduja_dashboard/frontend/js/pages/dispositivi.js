/* Prese e dispositivi: prese e interruttori, tapparelle, ventilatori, TV, serrature, robot… divisi per stanza. */
import { AREAS, PAGES, LAYOUT, VISTE, t, esc, ents, isLightSwitch, areaOf, areasSorted, entityRow, card, empty, page, UI, isAdmin, utenteCfg } from "../core.js";
import { item, addBtn } from "../edit.js";

const DOM = ["switch", "cover", "fan", "lock", "humidifier", "valve", "siren", "input_boolean"];
/* le zone dell'irrigazione (e gli switch delle sue integrazioni) stanno nella pagina Irrigazione, se c'è e non è spenta */
function zoneIrrigazione() {
  try { return PAGES.irrigazione?.show() && LAYOUT.pages?.irrigazione !== false && utenteCfg().pages?.irrigazione !== false ? new Set(VISTE.irrTutte()) : new Set(); } catch { return new Set(); }
}
const tutti = () => { const Z = zoneIrrigazione(); return DOM.flatMap(d => ents(d)).filter(id => !isLightSwitch(id) && !Z.has(id)); };   // gli interruttori scelti come luci stanno nella pagina Luci
function pagina() {
  const L = tutti(), g = {};
  L.forEach(id => (g[areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"] = g[areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
  const zone = [...areasSorted().filter(a => g[a]), ...(g._ ? ["_"] : [])];
  return `<div class="g g3">
    ${!L.length ? card("🔌 " + t("Prese e dispositivi", "Plugs and devices"), empty(UI.edit ? t("Premi ＋ per aggiungere il primo.", "Press ＋ to add the first one.") : t("Nessun dispositivo: premi ✏️ Modifica in alto per aggiungerne.", "No devices: press ✏️ Edit at the top to add some.")), { cls: "span3" }) : ""}
    ${zone.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name), `<div class="stack">${g[a].map(id => item(id, entityRow(id))).join("")}${addBtn(DOM, { area: a === "_" ? "" : a })}</div>`)).join("")}
    ${UI.edit ? `<section class="card span3">${addBtn(DOM, { big: true, label: t("Aggiungi presa o dispositivo", "Add plug or device") })}</section>` : ""}
  </div>`;
}
page("dispositivi", { title: t("Prese e dispositivi", "Plugs and devices"), short: t("Prese", "Plugs"), icon: "🔌", order: 30, editable: true,
  show: () => tutti().length > 0 || isAdmin(), badge: () => false, render: pagina });

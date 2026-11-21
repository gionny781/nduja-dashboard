/* Prese e dispositivi: prese e interruttori, tapparelle (se non c'è la pagina Tapparelle), ventilatori, TV, serrature, robot… divisi per stanza. */
import { AREAS, PAGES, LAYOUT, VISTE, t, esc, ents, isLightSwitch, areaOf, areasSorted, entityRow, card, empty, page, UI, isAdmin, utenteCfg, myHA, ordina, nm } from "../core.js";
import { item, addBtn } from "../edit.js";
import { TRASCINA, salvaOrdine } from "../trascina.js";

const DOM = ["switch", "cover", "fan", "lock", "humidifier", "valve", "siren", "input_boolean"];
/* le zone dell'irrigazione (e gli switch delle sue integrazioni) stanno nella pagina Irrigazione, se c'è e non è spenta */
function zoneIrrigazione() {
  try { return PAGES.irrigazione?.show() && LAYOUT.pages?.irrigazione !== false && utenteCfg().pages?.irrigazione !== false ? new Set(VISTE.irrTutte()) : new Set(); } catch { return new Set(); }
}
/* la rete ospiti e le accensioni dei server (Wake on LAN) stanno nella pagina Rete, se c'è e non è spenta */
function comandiRete() {
  try { return PAGES.rete?.show() && LAYOUT.pages?.rete !== false && utenteCfg().pages?.rete !== false && VISTE.reteMostrati ? VISTE.reteMostrati() : new Set(); } catch { return new Set(); }
}
/* purificatori e umidificatori stanno nella pagina Aria, se c'è e non è spenta */
function aria() { try { return VISTE.ariaDisp ? VISTE.ariaDisp() : new Set(); } catch { return new Set(); } }
/* la valvola dell'acqua sta nella pagina Acqua e gas, se c'è e non è spenta */
function acqua() { try { return VISTE.acquaDisp ? VISTE.acquaDisp() : new Set(); } catch { return new Set(); } }
/* tapparelle e tende stanno nella pagina Tapparelle, se c'è e non è spenta */
function tapparelle() {
  try { return PAGES.tapparelle?.show() && LAYOUT.pages?.tapparelle !== false && utenteCfg().pages?.tapparelle !== false && VISTE.tapTutte ? new Set(VISTE.tapTutte()) : new Set(); } catch { return new Set(); }
}
const tutti = () => { const Z = zoneIrrigazione(), R = comandiRete(), T = tapparelle(), A = aria(), Q = acqua(); return ordina(DOM.flatMap(d => ents(d)).filter(id => !isLightSwitch(id) && !Z.has(id) && !R.has(id) && !T.has(id) && !A.has(id) && !Q.has(id)), "dispositivi"); };   // gli interruttori scelti come luci stanno nella pagina Luci; l'ordine si sceglie trascinando in ✏️ Modifica
TRASCINA.dispositivi = { nome: nm, salva: ({ ids }) => salvaOrdine("dispositivi", tutti(), ids) };
function pagina() {
  const L = tutti(), g = {};
  L.forEach(id => (g[areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"] = g[areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
  const zone = [...areasSorted().filter(a => g[a]), ...(g._ ? ["_"] : [])];
  return `<div class="g g3">
    ${!L.length ? card("🔌 " + t("Prese e dispositivi", "Plugs and devices"), empty(UI.edit ? t("Premi ＋ per aggiungere il primo.", "Press ＋ to add the first one.") : t("Nessun dispositivo: premi ✏️ Modifica in alto per aggiungerne.", "No devices: press ✏️ Edit at the top to add some.")), { cls: "span3" }) : ""}
    ${zone.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name), `<div class="stack" ${UI.edit ? `data-tr="dispositivi"` : ""}>${g[a].map(id => item(id, entityRow(id))).join("")}${addBtn(DOM, { area: a === "_" ? "" : a })}</div>`)).join("")}
    ${UI.edit ? `<section class="card span3">${addBtn(DOM, { big: true, label: t("Aggiungi presa o dispositivo", "Add plug or device") })}</section>` : ""}
  </div>`;
}
/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("Prese, interruttori, ventilatori, serrature e gli altri dispositivi di casa, divisi per stanza.", "Plugs, switches, fans, locks and your other devices, by room."),
  serve: t("Una presa o un interruttore smart, un ventilatore, una serratura o un altro dispositivo da accendere e spegnere.", "A smart plug or switch, a fan, a lock or another device to turn on and off."),
  passi: [t("Impostazioni → Dispositivi e servizi → ＋ Aggiungi integrazione: cerca la marca o il sistema del dispositivo e segui i passi.", "Settings → Devices & services → ＋ Add integration: search for the device's brand or system and follow the steps.")], link: [[t("Aggiungi un'integrazione", "Add an integration"), myHA("integrations")]] };
page("dispositivi", { richiede: RICHIEDE, title: t("Prese e dispositivi", "Plugs and devices"), short: t("Prese", "Plugs"), icon: "🔌", order: 30, editable: true,
  show: () => tutti().length > 0 || isAdmin(), badge: () => false, render: pagina });

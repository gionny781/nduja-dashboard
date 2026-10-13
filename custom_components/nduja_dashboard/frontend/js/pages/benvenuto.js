/* Primo avvio: la plancia chiede se trovare tutto in automatico o partire da zero. */
import { ACT, LAYOUT, t, page, saveLayout, toast, go, allEnts, AREAS } from "../core.js";
import { startManual } from "./impostazioni.js";

function pagina() {
  const n = d => allEnts(d).length;
  return `<div class="wel2">
    <div class="wel2h"><span>🌶️</span><h2>${t("Benvenuto in 'Nduja!", "Welcome to 'Nduja!")} <sup class="beta1">BETA</sup></h2>
      <p>${t("Come vuoi preparare la tua plancia?", "How do you want to set up your dashboard?")}</p></div>
    <div class="wel2c">
      <button class="wel2b" data-act="wAuto"><span class="i">✨</span><b>${t("Automatica", "Automatic")}</b>
        <p>${t(`Trovo io tutto quello che c'è in casa (${Object.keys(AREAS).length} stanze, ${n("light")} luci, ${n("climate")} clima…). Dopo puoi togliere o aggiungere quello che vuoi.`, `I find everything in your home (${Object.keys(AREAS).length} rooms, ${n("light")} lights, ${n("climate")} climate…). Then you can remove or add what you like.`)}</p>
        <em>${t("Consigliata", "Recommended")}</em></button>
      <button class="wel2b" data-act="wManual"><span class="i">🛠️</span><b>${t("Manuale", "Manual")}</b>
        <p>${t("Parti da una plancia vuota e scegli tu, sezione per sezione, le luci, il clima, le prese e tutto il resto.", "Start from an empty dashboard and choose, section by section, lights, climate, plugs and everything else.")}</p></button>
    </div>
    <p class="wel2f">🧪 ${t("Versione beta: se qualcosa non va, segnalalo su GitHub.", "Beta version: if something is wrong, report it on GitHub.")}<br>${t("Potrai cambiare tutto quando vuoi: in ogni pagina c'è ✏️ Modifica, e in ⚙️ Impostazioni trovi la procedura guidata.", "You can change everything later: every page has ✏️ Edit, and ⚙️ Settings has the guided setup.")}</p>
  </div>`;
}
Object.assign(ACT, {
  wAuto: async () => {
    try { await saveLayout({ ...LAYOUT, mode: "auto", configured: true }); toast("✨ " + t("Fatto! Per togliere o aggiungere usa ✏️ Modifica in ogni pagina.", "Done! To remove or add things use ✏️ Edit on every page.")); go("home"); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
  },
  wManual: () => startManual(),
});
page("benvenuto", { title: "'Nduja", icon: "🌶️", order: -1, hiddenNav: true, admin: true, render: pagina });

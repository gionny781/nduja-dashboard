/* Primo avvio: la plancia chiede se trovare tutto in automatico o partire da zero.
   Con «Automatica» mostra prima un riepilogo di quello che ha trovato; se la procedura guidata
   era rimasta a metà su questo dispositivo, propone di riprenderla. */
import { ACT, LAYOUT, t, page, saveLayout, toast, go, allEnts, AREAS, FLOORS, PAGES, LOC, esc, render } from "../core.js";
import { startManual, startAuto, bozza, riprendi, cancellaBozza } from "./impostazioni.js";

const V = { riepilogo: false };
const DEV = ["cover", "switch", "fan", "lock", "media_player", "humidifier", "vacuum", "siren", "valve"];

function scelta() {
  const n = d => allEnts(d).length, b = bozza();
  return `<div class="wel2">
    <div class="wel2h"><span>🌶️</span><h2>${t("Benvenuto in 'Nduja!", "Welcome to 'Nduja!")} <sup class="beta1">BETA</sup></h2>
      <p>${t("Come vuoi preparare la tua plancia?", "How do you want to set up your dashboard?")}</p></div>
    ${b ? `<div class="note1 wz-rip" style="margin:18px 0 0;text-align:left">↩️ ${t("Avevi cominciato a configurare la plancia su questo dispositivo.", "You had started setting up the dashboard on this device.")}
      <button class="btn sm pri" data-act="wRiprendi">${t("Riprendi da dove eri", "Pick up where you left off")}</button><button class="btn sm ghost" data-act="wScarta">${t("Lascia perdere", "Discard")}</button></div>` : ""}
    <div class="wel2c">
      <button class="wel2b" data-act="wAuto"><span class="i">✨</span><b>${t("Automatica", "Automatic")}</b>
        <p>${t(`Trovo io tutto quello che c'è in casa (${Object.keys(AREAS).length} stanze, ${n("light")} luci, ${n("climate")} clima…). Prima di cominciare ti mostro il riepilogo.`, `I find everything in your home (${Object.keys(AREAS).length} rooms, ${n("light")} lights, ${n("climate")} climate…). Before starting I show you a summary.`)}</p>
        <em>${t("Consigliata", "Recommended")}</em></button>
      <button class="wel2b" data-act="wManual"><span class="i">🛠️</span><b>${t("Manuale", "Manual")}</b>
        <p>${t("Parti da una plancia vuota e scegli tu, sezione per sezione, le luci, il clima, le prese e tutto il resto.", "Start from an empty dashboard and choose, section by section, lights, climate, plugs and everything else.")}</p></button>
    </div>
    <p class="wel2f">🧪 ${t("Versione beta: se qualcosa non va, segnalalo su GitHub.", "Beta version: if something is wrong, report it on GitHub.")}<br>${t("Potrai cambiare tutto quando vuoi: in ogni pagina c'è ✏️ Modifica, e in ⚙️ Impostazioni trovi la procedura guidata.", "You can change everything later: every page has ✏️ Edit, and ⚙️ Settings has the guided setup.")}</p>
  </div>`;
}

/** riepilogo di quello che la modalità automatica mostrerà */
function riepilogo() {
  const n = d => allEnts(d).length, A = Object.keys(AREAS);
  const piani = {}; A.forEach(a => (piani[AREAS[a].floor || "_"] = piani[AREAS[a].floor || "_"] || []).push(AREAS[a].name));
  const ordP = Object.keys(piani).sort((x, y) => (FLOORS[x]?.level ?? 99) - (FLOORS[y]?.level ?? 99));
  const pagine = Object.keys(PAGES).filter(k => !PAGES[k].hiddenNav && !k.startsWith("c_") && PAGES[k].show()).sort((a, b) => PAGES[a].order - PAGES[b].order);
  const num = [[A.length, t("stanze", "rooms")], [n("light"), t("luci", "lights")], [n("climate"), t("clima", "climate")],
    [DEV.reduce((s, d) => s + n(d), 0), t("dispositivi", "devices")], [n("person"), t("persone", "people")], [n("camera"), t("telecamere", "cameras")]];
  return `<div class="wel3">
    <div class="wz-h"><span>✨</span><div><h3>${t("Ecco cosa ho trovato", "Here's what I found")}</h3>
      <p>${t("Con la modalità automatica la plancia mostra tutto questo. Se ti va bene entra pure: potrai togliere quello che non serve con ✏️ Modifica in ogni pagina.", "In automatic mode the dashboard shows all of this. If it looks right go ahead: you can remove what you don't need with ✏️ Edit on every page.")}</p></div></div>
    <div class="wz-n">${num.map(([v, k]) => `<div><b>${v}</b><small>${k}</small></div>`).join("")}</div>
    ${A.length ? `<h4 class="wz-s">${t("Stanze per piano", "Rooms by floor")}</h4>
      <div class="wel3l">${ordP.map(f => `<div><b>${esc(f === "_" ? t("Senza piano", "No floor") : FLOORS[f]?.name || f)}</b><small>${piani[f].sort((a, b) => a.localeCompare(b, LOC)).map(esc).join(" · ")}</small></div>`).join("")}</div>`
      : `<div class="note1">${t("Non ci sono aree in Home Assistant: creale in Impostazioni → Aree e assegna i dispositivi, la plancia funziona molto meglio.", "There are no areas in Home Assistant: create them in Settings → Areas and assign your devices, the dashboard works much better.")}</div>`}
    ${A.length && !Object.keys(FLOORS).length ? `<div class="note1">${t("Le stanze non hanno un piano: assegnalo in Home Assistant (Impostazioni → Aree) per vederle divise e per la mappa.", "Rooms have no floor: assign one in Home Assistant (Settings → Areas) to group them and draw the map.")}</div>` : ""}
    <h4 class="wz-s">${t("Pagine che compariranno", "Pages you'll get")}</h4>
    <div class="wel3p">${pagine.map(k => `<span>${PAGES[k].icon} ${esc(PAGES[k].title)}</span>`).join("")}</div>
    <div class="wel3b"><button class="btn pri" data-act="wAutoOk">✅ ${t("Va bene, entra", "Looks good, let's go")}</button>
      <button class="btn" data-act="wAutoScegli">🛠️ ${t("Voglio scegliere io", "Let me choose")}</button>
      <span class="grow"></span><button class="btn ghost" data-act="wIndietro">← ${t("Indietro", "Back")}</button></div>
  </div>`;
}

Object.assign(ACT, {
  wAuto: () => { V.riepilogo = true; render(true); window.scrollTo(0, 0); },
  wIndietro: () => { V.riepilogo = false; render(true); },
  wAutoOk: async () => {
    try { await saveLayout({ ...LAYOUT, mode: "auto", configured: true }); cancellaBozza(); V.riepilogo = false; toast("✨ " + t("Fatto! Per togliere o aggiungere usa ✏️ Modifica in ogni pagina.", "Done! To remove or add things use ✏️ Edit on every page.")); go("home"); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
  },
  wAutoScegli: () => { V.riepilogo = false; startAuto(); },
  wManual: () => { V.riepilogo = false; startManual(); },
  wRiprendi: () => riprendi(),
  wScarta: () => { cancellaBozza(); render(true); },
});
page("benvenuto", { title: "'Nduja", icon: "🌶️", order: -1, hiddenNav: true, admin: true, bare: true, noNav: true, render: () => V.riepilogo ? riepilogo() : scelta() });

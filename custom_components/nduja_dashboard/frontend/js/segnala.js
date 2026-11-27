/* 'Nduja Dashboard — 🐞 «Segnala un problema» (0.7.63), per tutti da ⚙️ Impostazioni.
   Una scheda con cosa è successo, il tipo (non funziona, si vede male, va lento, idea) e i dettagli raccolti da soli:
   versioni, browser e dispositivo, lingua, grafica e fluidità, quante entità e pagine, la pagina aperta, gli ultimi errori.
   Niente dati personali: niente nomi di entità, indirizzi IP, posizione o persone (errore.js li toglie dagli errori).
   L'utente vede esattamente il testo e può togliere ogni riga. «Apri su GitHub» apre la segnalazione già compilata;
   se è troppo lunga per un indirizzo la copia negli appunti e spiega di incollarla. «Copia» la mette negli appunti.
   Il testo lo prepara errore.js (window.ndujaSegnala), lo stesso della schermata d'errore. */
import { ACT, HOOKS, LAYOUT, PAGES, AREAS, FLOORS, DEVICES, UI, S, t, esc, render, toast, openSheet, isAdmin, conn, ESEMPIO,
  tutteLeEntita, idsDi, visible, attr, tema, grafica, leggera, menoMoto } from "./core.js";
import { dimTesto, contrastoAlto } from "./leggibilita.js";
import { esitoMisura, fpsMisurati, sogliaFps } from "./fluido.js";

const SG = { tipo: "bug", cosa: "", via: {} };
const NS = () => window.ndujaSegnala;

/* l'ultima pagina aperta prima delle Impostazioni (da dove si arriva a segnalare) */
let primaPagina = null;
HOOKS.push(() => { if (UI.page && UI.page !== "impostazioni") primaPagina = UI.page; });
const nomePagina = id => !id ? "" : id.startsWith("c_") ? t("una pagina creata da te", "a page you created") : id;

/** nomi da togliere dagli errori: persone, utente, stanze, piani, zone, dispositivi, nomi scelti nella plancia, pagine tue */
function nomi() {
  const N = [UI.user?.name];
  for (const id of [...idsDi("person"), ...idsDi("zone")]) N.push(attr(id, "friendly_name"));
  for (const a of Object.values(AREAS)) N.push(a.name, a.nameHA);
  for (const f of Object.values(FLOORS)) N.push(f.name);
  for (const d of Object.values(DEVICES)) N.push(d.name);
  N.push(...Object.values(LAYOUT.names || {}), ...Object.values(LAYOUT.areaNames || {}), ...(LAYOUT.customPages || []).map(p => p.title));
  return [...new Set(N.filter(x => typeof x === "string"))];
}
/** le righe dei dettagli: { k, testo } (ognuna si può togliere) */
function righe() {
  const ns = NS(); if (!ns) return [];
  const R = ns.base();
  const fps = fpsMisurati(), es = esitoMisura();
  const pagine = visible().length, tutte = Object.keys(PAGES).filter(k => !PAGES[k].hiddenNav).length;
  /* versione: quella che dichiara Home Assistant, con l'impronta dei file se la plancia arriva da Home Assistant */
  const b = ns.versione().split(" ")[0], imp = b.startsWith(UI.version + "-") ? b.slice(UI.version.length + 1) : "";
  if (UI.version) R[0] = { k: "nduja", testo: "'Nduja: " + UI.version + (imp ? " (" + t("file ", "files ") + imp + ")" : "") + (window.NDUJA_APP ? " · app" : "") };
  R.splice(1, 0, { k: "ha", testo: "Home Assistant: " + (conn?.haVersion || "?") + (ESEMPIO ? " · " + t("casa di esempio", "sample home") : "") });
  R.push({ k: "grafica", testo: t("Grafica: ", "Graphics: ") + (leggera() ? t("leggera", "light") : t("piena", "full")) + " (" + (grafica() === "auto" ? t("automatica", "automatic") : t("scelta a mano", "chosen by hand")) + ")"
    + " · " + t("tema ", "theme ") + ({ auto: t("automatico", "automatic"), light: t("chiaro", "light"), dark: t("scuro", "dark") }[tema()] || tema()) + (dimTesto() !== "0" ? " · " + t("testo grande ", "large text ") + dimTesto() : "") + (contrastoAlto() ? " · " + t("contrasto alto", "high contrast") : "") + (menoMoto() ? " · " + t("movimento ridotto", "reduced motion") : "") });
  R.push({ k: "fluido", testo: t("Fluidità: ", "Smoothness: ") + (fps ? Math.round(fps) + " fps" + t(" misurati", " measured") + " (" + t("soglia ", "threshold ") + sogliaFps() + (es === "1" ? t(", troppo lenta: grafica leggera", ", too slow: light graphics") : es === "0" ? t(", ok", ", ok") : "") + ")" : t("non ancora misurata", "not measured yet")) });
  R.push({ k: "casa", testo: t("Casa: ", "Home: ") + tutteLeEntita().length + t(" entità · ", " entities · ") + pagine + "/" + tutte + t(" pagine attive · modalità ", " active pages · mode ") + (LAYOUT.mode === "manual" ? t("manuale", "manual") : t("automatica", "automatic")) + (isAdmin() ? t(" · amministratore", " · administrator") : "") });
  R.push({ k: "pagina", testo: t("Pagina aperta: ", "Open page: ") + nomePagina(UI.page) + (primaPagina && primaPagina !== UI.page ? t(" (prima: ", " (before: ") + nomePagina(primaPagina) + ")" : "") });
  ns.errori(nomi()).forEach(e => R.push({ k: "e:" + e.replace(/^\S+\s+/, "").replace(/\s+\(×\d+\)$/, ""), testo: e, err: true }));   // chiave senza ora e conteggio: resta la stessa se l'errore si ripete
  return R;
}
function testo() {
  const ns = NS(), R = righe(), tieni = R.filter(r => !SG.via[r.k]);
  return { titolo: ns.titolo(SG.tipo, SG.cosa), corpo: ns.corpo({ tipo: SG.tipo, cosa: SG.cosa, righe: tieni.filter(r => !r.err).map(r => r.testo), conErrori: true, errori: tieni.filter(r => r.err).map(r => r.testo) }), R };
}

function scheda() {
  const ns = NS();
  const testa = `<div class="sh-head"><div><h3>🐞 ${t("Segnala un problema", "Report a problem")}</h3><div class="small muted">${t("Scrivi cosa è successo: preparo io la segnalazione per GitHub, con i dettagli che servono e senza dati personali.", "Write what happened: I prepare the report for GitHub, with the details needed and no personal data.")}</div></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>`;
  if (!ns) return testa + `<div class="note1">${t("Ricarica la pagina per segnalare un problema.", "Reload the page to report a problem.")}</div>`;
  const x = testo(), u = ns.url(x.titolo, x.corpo), E = x.R.filter(r => r.err);
  const riga = r => `<button class="sg1l ${SG.via[r.k] ? "via" : ""} ${r.err ? "err" : ""}" data-act="sgRiga" data-k="${esc(r.k)}" aria-pressed="${!SG.via[r.k]}"><span class="bx"></span><span>${esc(r.testo)}</span></button>`;
  return testa + `<div class="sg1">
    <div class="seg sg1t" role="group" aria-label="${t("Tipo di problema", "Kind of problem")}">${ns.tipi().map(([k, ic, n]) => `<button class="${SG.tipo === k ? "act" : ""}" data-act="sgTipo" data-v="${k}">${ic} ${esc(n)}</button>`).join("")}</div>
    <label class="fld1"><span>${SG.tipo === "idea" ? t("Cosa vorresti?", "What would you like?") : t("Cosa è successo?", "What happened?")}</span><textarea id="sg1c" rows="4" placeholder="${esc(SG.tipo === "idea" ? t("Per esempio: nella pagina Luci vorrei…", "For example: on the Lights page I'd like…") : t("Per esempio: nella pagina Clima, toccando + la temperatura non cambia.", "For example: on the Climate page, tapping + doesn't change the temperature."))}">${esc(SG.cosa)}</textarea></label>
    <div class="sg1h">${t("Dettagli raccolti da soli · tocca una riga per toglierla", "Details collected automatically · tap a line to remove it")}</div>
    <div class="sg1r">${x.R.filter(r => !r.err).map(riga).join("")}</div>
    <div class="sg1h">${E.length ? t(`Ultimi errori (${E.length})`, `Latest errors (${E.length})`) : t("Ultimi errori: nessuno 👍", "Latest errors: none 👍")}</div>
    ${E.length ? `<div class="sg1r">${E.map(riga).join("")}</div>` : ""}
    <div class="sg1h">${t("Ecco esattamente cosa verrà inviato", "Here's exactly what will be sent")} · ${(x.titolo + x.corpo).length} ${t("caratteri", "characters")}</div>
    <pre class="sg1v">${esc(x.titolo + "\n\n" + x.corpo)}</pre>
    ${u.lungo ? `<p class="note1">📋 ${t("Il testo è lungo per un indirizzo: toccando «Apri su GitHub» lo copio negli appunti. Su GitHub tieni premuto nella casella e scegli «Incolla» (o Ctrl+V).", "The text is too long for a link: tapping «Open on GitHub» copies it to the clipboard. On GitHub long-press the box and choose «Paste» (or Ctrl+V).")}</p>` : ""}
    <div class="row sg1a"><a class="btn pri" href="${esc(u.url)}" target="_blank" rel="noopener" data-sglungo="${u.lungo ? "1" : ""}">↗ ${t("Apri su GitHub", "Open on GitHub")}</a>
      <button class="btn" data-act="sgCopia">📋 ${t("Copia", "Copy")}</button></div>
    <p class="small muted sg1n">${t("Serve un account GitHub (gratis). Non parte niente da solo: lo invii tu, su GitHub. Se GitHub non si apre (alcune app lo bloccano), tocca «Copia» e incollalo da un altro dispositivo in github.com/gionny781/nduja-dashboard/issues.",
      "You need a (free) GitHub account. Nothing is sent by itself: you send it, on GitHub. If GitHub doesn't open (some apps block it), tap «Copy» and paste it from another device at github.com/gionny781/nduja-dashboard/issues.")}</p></div>`;
}

document.addEventListener("input", e => { if (e.target.id === "sg1c") { SG.cosa = e.target.value; render(); } });
/* testo lungo: lo copio nello stesso tocco che apre GitHub (il link si apre comunque) */
document.addEventListener("click", e => {
  const a = e.target.closest?.("a[data-sglungo='1']");
  if (a && NS()) { const x = testo(); NS().copia(x.corpo).then(ok => toast(ok ? "📋 " + t("Copiato: incollalo su GitHub", "Copied: paste it on GitHub") : t("Non riesco a copiare: usa «Copia» o seleziona il testo", "Can't copy: use «Copy» or select the text"), !ok)); }
}, true);

Object.assign(ACT, {
  sgApri: () => { SG.via = {}; openSheet(scheda); },
  sgTipo: el => { SG.tipo = el.dataset.v; render(); },
  sgRiga: el => { const k = el.dataset.k; SG.via[k] = !SG.via[k]; render(); },
  sgCopia: () => { const x = testo(); NS()?.copia(x.titolo + "\n\n" + x.corpo).then(ok => toast(ok ? "📋 " + t("Copiato negli appunti", "Copied to the clipboard") : t("Non riesco a copiare: seleziona il testo", "Can't copy: select the text"), !ok)); },
});

/** scheda di ⚙️ Impostazioni (per tutti) */
export function segnalaCard() {
  return `<section class="card sg1c"><div class="row" style="gap:12px;flex-wrap:wrap"><span class="sg1ci" aria-hidden="true">🐞</span>
    <div style="flex:1;min-width:200px"><b>${t("Segnala un problema", "Report a problem")}</b>
      <div class="small muted">${t("Qualcosa non va o hai un'idea? Preparo io la segnalazione per GitHub, con i dettagli che servono e senza dati personali.", "Something's wrong or have an idea? I prepare the GitHub report, with the details needed and no personal data.")}</div></div>
    <button class="btn" data-act="sgApri">🐞 ${t("Segnala", "Report")}</button></div></section>`;
}

/* 'Nduja Dashboard — 🏡 casa di esempio (0.7.62).
   Chi arriva per la prima volta vede subito cosa fa la plancia: una casa finta completa (luci, clima, energia e fotovoltaico,
   telecamere, elettrodomestici, Alexa, auto, irrigazione…) dentro la plancia vera, dove si tocca, si cambia pagina e si prova ✏️ Modifica.
   Si carica solo quando la si apre (core.js, getConn): il finto Home Assistant è esempio/casa.js, lo stesso della prova degli sviluppatori.
   Niente arriva a Home Assistant: comandi, salvataggi e servizi restano in memoria; le chiamate REST che la casa finta non conosce
   non partono (risposta «non trovato» data qui). Uscendo (fascia in alto, «Esci») la pagina si ricarica sulla casa vera, com'era. */
import { t } from "./core.js";

/* scelte della casa finta: due piani, le piante e la chat d'esempio, l'energia che si muove da sola */
const OPZIONI = { mockPiani: "1", mockPianteDemo: "1", mockChatDemo: "1", mockEnVivo: "1" };

/** connessione al finto Home Assistant (al posto di quella vera) */
export async function connessioneEsempio() {
  fascia();
  const [{ casaFinta }, layout] = await Promise.all([
    import("../esempio/casa.js"),
    fetch(new URL("../esempio/casa3d.json", import.meta.url)).then(r => r.ok ? r.text() : null).catch(() => null)]);
  const mem = new Map(Object.entries({ ...OPZIONI, ...(layout ? { mockLayout: layout } : {}) }));
  const ls = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } };
  const versione = (location.pathname.match(/nduja_dashboard_static\/([^/]+)\//) || [])[1];
  const C = casaFinta({ ls, w: {}, versione, camAudio: false });
  proteggiFetch(C.fetch);
  return C.conn;
}

/* fetch: prima le risposte della casa finta; poi i file della plancia e gli indirizzi esterni (Wikipedia, per le auto) come sempre;
   tutto il resto di Home Assistant (/api/, /auth/, /local/…) non parte */
function proteggiFetch(finto) {
  const f0 = window.fetch.bind(window), plancia = new URL("../", import.meta.url).href;
  window.fetch = (u, o) => {
    const r = finto(u, o); if (r) return r;
    let url; try { url = new URL(u instanceof Request ? u.url : String(u), location.href); } catch { return f0(u, o); }
    if (url.origin !== location.origin || url.href.startsWith(plancia)) return f0(u, o);
    return Promise.resolve(new Response(JSON.stringify({ message: "Casa di esempio" }), { status: 404, headers: { "Content-Type": "application/json" } }));
  };
}

/* fascia sempre visibile in alto: cosa sto guardando e come uscire */
function fascia() {
  document.body.classList.add("es1on");
  if (document.getElementById("es1")) return;
  document.body.insertAdjacentHTML("afterbegin", `<div class="es1" id="es1" role="status"><span class="es1i" aria-hidden="true">🏡</span>
    <span class="es1t"><b>${t("Casa di esempio", "Sample home")}</b><span class="es1d"> — </span><span class="es1s">${t("niente di quello che tocchi è vero", "nothing you touch is real")}</span></span>
    <button class="es1b" data-act="esEsci">${t("Esci", "Exit")}</button></div>`);
}

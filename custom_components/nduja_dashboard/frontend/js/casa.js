/* Dati della casa: valgono su tutti i dispositivi e li può cambiare QUALSIASI utente (Faccende, Bacheca…).
   Sono in Home Assistant, separati dalle scelte della plancia (LAYOUT, solo amministratori): una sezione per pagina.
   casa("faccende") → { stato: "caricando" | "ok" | "errore", dati, rev, err }: la prima volta li chiede e ridisegna quando arrivano.
   casaCambia("faccende", d => { …cambia d… }) salva; se un altro dispositivo ha salvato nel frattempo rilegge e rifà la modifica,
   quindi fn deve lavorare sui dati che riceve (per id, non per posizione). */
import { conn, ready, ws, render, toast, t } from "./core.js";

const D = {}, inVolo = new Set();
/** «riavvia»: Home Assistant ha ancora il Python della versione prima (aggiornata ma non riavviata) */
export const casaErrore = sez => D[sez]?.stato === "errore" ? (/unknown_command|unknown command/i.test(D[sez].err || "") ? "riavvia" : "altro") : null;

async function carica(sez) {
  const prima = D[sez];
  if (!prima) D[sez] = { stato: "caricando" };
  inVolo.add(sez);
  try {
    const r = await ws({ type: "nduja_dashboard/casa_get", sezione: sez });
    D[sez] = { stato: "ok", rev: r.rev || 0, dati: r.dati || {} };
  } catch (e) {
    console.warn("nduja casa", sez, e);
    if (prima?.stato !== "ok") D[sez] = { stato: "errore", err: e?.code || e?.message || String(e) };
  } finally { inVolo.delete(sez); }
  render();
}
/** dati di una sezione (per i disegni): li carica la prima volta */
export function casa(sez) {
  if (!D[sez]) carica(sez);
  return D[sez];
}
/** salva una modifica: fn(dati) cambia la copia; se restituisce false non salvo niente */
export async function casaCambia(sez, fn, msg) {
  for (let prova = 0; prova < 4; prova++) {
    if (D[sez]?.stato !== "ok") await carica(sez);
    const d = D[sez];
    if (d?.stato !== "ok") { toast(t("Non salvato: ", "Not saved: ") + (casaErrore(sez) === "riavvia" ? t("riavvia Home Assistant", "restart Home Assistant") : d?.err || "?"), true); return false; }
    const nuovi = JSON.parse(JSON.stringify(d.dati || {}));
    if (fn(nuovi) === false) return false;
    try {
      const r = await ws({ type: "nduja_dashboard/casa_save", sezione: sez, dati: nuovi, rev: d.rev || 0 });
      D[sez] = { stato: "ok", rev: r.rev, dati: nuovi };
      render();
      if (msg) toast(typeof msg === "function" ? msg(nuovi) : msg);
      return true;
    } catch (e) {
      if (e?.code === "conflict") { await carica(sez); continue; }   // qualcuno ha salvato prima di me: rileggo e rifaccio
      toast(t("Non salvato: ", "Not saved: ") + (e?.code === "too_big" ? t("troppi dati", "too much data") : e?.message || e?.code || e), true);
      return false;
    }
  }
  toast(t("Non salvato: troppe modifiche insieme, riprova", "Not saved: too many changes at once, try again"), true);
  return false;
}

/* cambiati da un altro dispositivo: rileggo le sezioni che sto usando */
const ricarica = () => { for (const s of Object.keys(D)) if (!inVolo.has(s)) carica(s); };
ready.then(() => {
  if (!conn) return;
  conn.subscribeMessage(ev => { const s = ev?.sezione; if (s && D[s] && D[s].rev !== ev.rev) carica(s); }, { type: "nduja_dashboard/casa_subscribe" })
    .catch(e => console.warn("nduja casa_subscribe", e));
  conn.addEventListener("ready", ricarica);   // ricollegato: potrei aver perso qualche cambio
  window.addEventListener("focus", ricarica);
}).catch(() => {});

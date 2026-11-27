/* 'Nduja Dashboard — ↩️ copie di sicurezza (0.7.63, solo amministratori).
   Home Assistant salva da solo una copia delle scelte della casa (scelte della plancia e dati di casa.js: Colpo d'occhio,
   Faccende, Bacheca, Liste, Piante…) prima di ogni cambiamento grosso e una volta al giorno (copie.py): qui l'elenco,
   con Ripristina (prima fa una copia di adesso e dice cosa cambierà), Scarica (come «Esporta») ed Elimina.
   copiaPrima(motivo) la chiede la plancia prima della procedura guidata, dell'importazione e di «Ricomincia dal benvenuto». */
import { ACT, LAYOUT, PAGES, UI, LOC, t, esc, ws, render, toast, openSheet, closeSheet, isAdmin, sicuro, mettiLayout } from "./core.js";
import { casaRicarica } from "./casa.js";

const CP = { lista: null, chiesta: false, quando: 0, err: null, conferma: null, lavoro: false };

/** chiede a Home Assistant una copia di adesso prima di un cambiamento grosso; se non riesce, il cambiamento va avanti lo stesso */
export async function copiaPrima(motivo) {
  if (!isAdmin()) return null;
  try { const r = await ws({ type: "nduja_dashboard/copie_crea", motivo }); CP.chiesta = false; return r?.id || null; }
  catch (e) { console.warn("nduja copia di sicurezza", e); return null; }
}

/* ---------- elenco ---------- */
async function carica() {
  CP.chiesta = true; CP.quando = Date.now();
  try { CP.lista = await ws({ type: "nduja_dashboard/copie_lista" }); CP.err = null; }
  catch (e) { CP.err = /unknown/i.test(e?.code || e?.message || "") ? "riavvia" : (e?.message || e?.code || "?"); }
  render();
}
/* l'elenco si rilegge se è passato più di un minuto (le copie di ogni giorno le fa Home Assistant da solo) */
const lista = () => { if (!CP.chiesta || Date.now() - CP.quando > 60000) carica(); return CP.lista; };

const kb = b => b >= 1048576 ? (b / 1048576).toLocaleString(LOC, { maximumFractionDigits: 1 }) + " MB" : Math.max(1, Math.round((b || 0) / 1024)) + " kB";
const quando = iso => new Date(iso).toLocaleString(LOC, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ver = v => String(v || "").replace(/-dev$/, "");
/** icona e frase del motivo */
function motivo(c) {
  const p = c.param || {};
  switch (c.motivo) {
    case "aggiornamento": return ["🆕", p.a ? t(`Prima dell'aggiornamento a ${ver(p.a)}`, `Before the update to ${ver(p.a)}`) : t("Prima dell'aggiornamento", "Before the update")];
    case "guidata": return ["🧭", t("Prima della procedura guidata", "Before the setup wizard")];
    case "importa": return ["⬆️", t("Prima dell'importazione di un file", "Before importing a file")];
    case "ripristino": return ["↩️", p.ts ? t(`Prima di ripristinare la copia di ${quando(p.ts)}`, `Before restoring the copy from ${quando(p.ts)}`) : t("Prima di un ripristino", "Before a restore")];
    case "predefiniti": return ["🔄", t("Prima di ricominciare dal benvenuto", "Before restarting from the welcome screen")];
    case "giorno": return ["📅", t("Copia di ogni giorno", "Daily copy")];
    default: return ["💾", c.motivo || t("Copia", "Copy")];
  }
}
/** chi ha fatto il cambiamento: la persona; «'Nduja» per l'aggiornamento; per la copia di ogni giorno chi ha cambiato qualcosa */
const chi = c => c.motivo === "aggiornamento" ? "'Nduja" : c.chi || "";

function riga(c, i) {
  const [ic, fr] = motivo(c), dopo = [chi(c), c.versione ? t("versione ", "version ") + ver(c.versione) : c.motivo === "aggiornamento" ? t("versione di prima", "previous version") : "", kb(c.byte)].filter(Boolean);
  return `<div class="cp1r">
    <span class="cp1i" aria-hidden="true">${ic}</span>
    <div class="cp1t"><b>${esc(quando(c.ts))}${i === 0 ? ` <span class="tag ok">${t("la più recente", "latest")}</span>` : ""}${c.tenuta ? ` <span class="tag">📌 ${t("tenuta per la versione", "kept for the version")}</span>` : ""}</b>
      <span>${esc(fr)}</span><small>${dopo.map(esc).join(" · ")}</small></div>
    <div class="cp1b"><button class="btn sm" data-act="cpPrepara" data-id="${esc(c.id)}">↩️ ${t("Ripristina", "Restore")}</button>
      <button class="btn sm" data-act="cpScarica" data-id="${esc(c.id)}" title="${t("Scarica come file (come «Esporta»)", "Download as a file (like «Export»)")}" aria-label="${t("Scarica", "Download")}">⬇️</button>
      <button class="btn sm" data-act="cpElimina" data-id="${esc(c.id)}" title="${t("Elimina", "Delete")}" aria-label="${t("Elimina", "Delete")}">🗑</button></div></div>`;
}

const testa = (titolo, sotto) => `<div class="sh-head"><div><h3>${titolo}</h3>${sotto ? `<div class="small muted">${sotto}</div>` : ""}</div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>`;
function scheda() {
  if (CP.conferma) return conferma();
  const L = lista();
  const sotto = t("Le scelte della plancia e i dati della casa (Colpo d'occhio, Faccende, Bacheca, Liste, Piante…), salvati da soli in Home Assistant prima di ogni cambiamento grosso e una volta al giorno se qualcosa è cambiato. Valgono per tutti i dispositivi.",
    "The dashboard choices and the home data (At a glance, Chores, Board, Lists, Plants…), saved automatically in Home Assistant before every big change and once a day if something changed. They apply to every device.");
  if (CP.err) return testa("↩️ " + t("Copie di sicurezza", "Safety copies"), sotto) + `<div class="note1">${CP.err === "riavvia" ? t("Riavvia Home Assistant per usare le copie di sicurezza (è stato aggiornato 'Nduja).", "Restart Home Assistant to use the safety copies ('Nduja was updated).") : t("Non riesco a leggere le copie: ", "I can't read the copies: ") + esc(CP.err)}</div>`;
  if (!L) return testa("↩️ " + t("Copie di sicurezza", "Safety copies"), sotto) + `<div class="empty">${t("Carico le copie…", "Loading the copies…")}</div>`;
  return testa("↩️ " + t("Copie di sicurezza", "Safety copies"), sotto)
    + (L.copie.length ? `<div class="cp1l">${L.copie.map(riga).join("")}</div>`
      : `<div class="empty">${t("Ancora nessuna copia: la prima arriva al prossimo cambiamento grosso o entro un giorno.", "No copies yet: the first one comes with the next big change or within a day.")}</div>`)
    + `<p class="small muted cp1p">${t(`Tengo le ultime ${L.ultime} copie, più l'ultima di ognuna delle ${L.versioni} versioni di 'Nduja più recenti · in tutto ${kb(L.byte)}, compresse. Ripristinare non tocca dispositivi né automazioni di Home Assistant.`,
      `I keep the latest ${L.ultime} copies, plus the latest of each of the ${L.versioni} most recent 'Nduja versions · ${kb(L.byte)} in total, compressed. Restoring doesn't touch Home Assistant devices or automations.`)}</p>`;
}

/* ---------- cosa cambierà ---------- */
/** JSON con le chiavi in ordine: due oggetti uguali danno lo stesso testo */
const ordinato = x => Array.isArray(x) ? x.map(ordinato) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordinato(x[k])])) : x;
const uguale = (a, b) => JSON.stringify(ordinato(a ?? null)) === JSON.stringify(ordinato(b ?? null));
/* nomi delle scelte della plancia (le chiavi di LAYOUT); null = scelte tecniche che non elenco a parte */
const NOMI = () => ({
  configured: t("Cosa si vede nella plancia", "What the dashboard shows"), mode: t("Cosa si vede nella plancia", "What the dashboard shows"),
  include: t("Cosa si vede nella plancia", "What the dashboard shows"), exclude: t("Cosa si vede nella plancia", "What the dashboard shows"), show: t("Cosa si vede nella plancia", "What the dashboard shows"),
  hiddenAreas: t("Stanze (nascoste, ordine, nomi)", "Rooms (hidden, order, names)"), areaOrder: t("Stanze (nascoste, ordine, nomi)", "Rooms (hidden, order, names)"), areaNames: t("Stanze (nascoste, ordine, nomi)", "Rooms (hidden, order, names)"),
  names: t("Nomi dei dispositivi", "Device names"), rooms: t("Stanze dei dispositivi", "Device rooms"), sensors: t("Sensori delle stanze", "Room sensors"), weather: t("Meteo", "Weather"),
  pages: t("Pagine del menu", "Menu pages"), navOrder: t("Ordine delle pagine", "Page order"), customPages: t("Le tue pagine", "Your pages"), users: t("Plancia per persona", "Per-person dashboard"),
  home: "Home", ordine: t("Ordine degli elenchi", "List order"), lightFav: t("Luci preferite", "Favourite lights"), lightSwitches: t("Interruttori usati come luci", "Switches used as lights"),
  seen: null, seenCars: null,
});
const nomeSezione = s => ({ colpo: t("Colpo d'occhio (viste di ognuno)", "At a glance (everyone's views)") }[s] || (PAGES[s] ? PAGES[s].icon + " " + PAGES[s].title : s));
/** elenco leggibile di cosa cambia passando da adesso alla copia: [testo, quanti] */
function differenze(copia, casaOra) {
  const N = NOMI(), out = new Map(), altre = new Set();
  const ogg = x => x && typeof x === "object" && !Array.isArray(x);
  /* quante voci cambiano dentro una scelta fatta di voci (nomi, stanze, pagine…); una scelta che manca conta come vuota */
  const conta = (a, b) => (ogg(a) || ogg(b)) && (a == null || ogg(a)) && (b == null || ogg(b))
    ? [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter(k => !uguale(a?.[k], b?.[k])).length : 0;
  for (const k of new Set([...Object.keys(LAYOUT), ...Object.keys(copia.layout || {})])) {
    if (uguale(LAYOUT[k], copia.layout?.[k])) continue;
    const n = k in N ? N[k] : PAGES[k] ? PAGES[k].icon + " " + PAGES[k].title : undefined;
    if (n === null) continue;
    if (n === undefined) { altre.add(k); continue; }
    out.set(n, (out.get(n) || 0) + conta(LAYOUT[k], copia.layout?.[k]));
  }
  const R = [...out].map(([n, q]) => [n, q]);
  if (altre.size) R.push([t("Altre scelte della plancia", "Other dashboard choices"), altre.size]);
  if (copia.casa && casaOra) for (const s of [...new Set([...Object.keys(copia.casa), ...Object.keys(casaOra)])].sort())
    if (!["pause", "irrigazione"].includes(s) && !uguale(casaOra[s] || {}, copia.casa[s] || {})) R.push([nomeSezione(s), 0, true]);
  return R;
}
function conferma() {
  const C = CP.conferma, c = C.copia, D = C.diff;
  const testoRiga = ([n, q, casa]) => `<li>${esc(n)}${q ? ` <small class="muted">(${q} ${q === 1 ? t("voce", "item") : t("voci", "items")})</small>` : ""}${casa ? ` <small class="muted">· ${t("dati della casa", "home data")}</small>` : ""}</li>`;
  return testa("↩️ " + t("Ripristinare questa copia?", "Restore this copy?"), esc(quando(c.ts)) + " · " + esc(motivo(c)[1]))
    + (C.carica ? `<div class="empty">${t("Confronto la copia con adesso…", "Comparing the copy with now…")}</div>`
      : D.length ? `<div class="fl1">${t("Cosa cambierà", "What will change")}</div><ul class="cp1d">${D.map(testoRiga).join("")}</ul>`
        : `<div class="note1 cp1u">✓ ${t("È uguale a com'è adesso: ripristinandola non cambia niente.", "It's the same as now: restoring it changes nothing.")}</div>`)
    + `<p class="small muted cp1p">🛟 ${t("Prima faccio una copia di adesso, così puoi sempre tornare indietro. Dispositivi e automazioni di Home Assistant non cambiano; vale per tutti i dispositivi.", "First I make a copy of now, so you can always go back. Home Assistant devices and automations don't change; it applies to every device.")}</p>
    <div class="row cp1a"><button class="btn pri" data-act="cpRipristina" ${C.carica || CP.lavoro || !D.length ? "disabled" : ""}>${CP.lavoro ? "⏳ " + t("Ripristino…", "Restoring…") : "↩️ " + t("Ripristina", "Restore")}</button>
      <button class="btn" data-act="cpIndietro">${t("Annulla", "Cancel")}</button></div>`;
}

async function contenuto(id) { return ws({ type: "nduja_dashboard/copie_get", copia: id }); }
const trova = id => CP.lista?.copie.find(c => c.id === id);

/* ---------- azioni ---------- */
Object.assign(ACT, {
  cpApri: () => { CP.conferma = null; carica(); openSheet(scheda); },
  cpIndietro: () => { CP.conferma = null; render(true); },
  cpPrepara: async el => {
    const c = trova(el.dataset.id); if (!c) return;
    CP.conferma = { copia: c, diff: [], carica: true }; render(true);
    try {
      const [x, casa] = await Promise.all([contenuto(c.id), ws({ type: "nduja_dashboard/casa_get" }).catch(() => null)]);
      if (CP.conferma?.copia !== c) return;
      const ora = casa?.sezioni ? Object.fromEntries(Object.entries(casa.sezioni).map(([k, v]) => [k, v.dati || {}])) : null;
      CP.conferma = { copia: c, diff: differenze(x, ora), carica: false };
    } catch (e) { CP.conferma = null; toast(t("Non riesco a leggere la copia: ", "I can't read the copy: ") + (e.message || e.code), true); }
    render(true);
  },
  cpRipristina: async () => {
    const c = CP.conferma?.copia; if (!c || CP.lavoro) return;
    CP.lavoro = true; render(true);
    try {
      await ws({ type: "nduja_dashboard/copie_ripristina", copia: c.id });
      const x = await ws({ type: "nduja_dashboard/config" }); mettiLayout(x.layout || {});
      casaRicarica();
      CP.conferma = null; await carica();
      toast("↩️ " + t("Copia ripristinata: ", "Copy restored: ") + quando(c.ts));
    } catch (e) { toast(t("Non ripristinata: ", "Not restored: ") + (e.message || e.code), true); }
    finally { CP.lavoro = false; render(true); }
  },
  cpScarica: async el => {
    const c = trova(el.dataset.id); if (!c) return;
    try {
      const x = await contenuto(c.id);
      const dati = { nduja: UI.version, esportato: new Date().toISOString(), copia: { data: c.ts, motivo: c.motivo, versione: c.versione }, layout: x.layout, casa: x.casa };
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
      const d = new Date(c.ts), p = n => String(n).padStart(2, "0");
      a.download = `nduja-dashboard-copia-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("⬇️ " + t("File scaricato: si ricarica con «Importa le impostazioni»", "File downloaded: load it back with «Import settings»"));
    } catch (e) { toast(t("Non scaricata: ", "Not downloaded: ") + (e.message || e.code), true); }
  },
  cpElimina: async el => {
    const c = trova(el.dataset.id); if (!c || !sicuro(el, t("Elimina?", "Delete?"))) return;
    try { await ws({ type: "nduja_dashboard/copie_elimina", copia: c.id }); await carica(); toast("🗑 " + t("Copia eliminata", "Copy deleted")); }
    catch (e) { toast(t("Non eliminata: ", "Not deleted: ") + (e.message || e.code), true); }
  },
});

/** scheda di ⚙️ Impostazioni (solo amministratori) */
export function copieCard() {
  if (!isAdmin()) return "";
  const L = lista(), u = L?.copie?.[0];
  const sotto = CP.err === "riavvia" ? t("Riavvia Home Assistant per attivarle.", "Restart Home Assistant to turn them on.")
    : !L ? t("Carico…", "Loading…")
    : u ? t(`${L.copie.length} ${L.copie.length === 1 ? "copia" : "copie"} · l'ultima ${quando(u.ts)}: ${motivo(u)[1].toLowerCase()}`, `${L.copie.length} ${L.copie.length === 1 ? "copy" : "copies"} · latest ${quando(u.ts)}: ${motivo(u)[1].toLowerCase()}`)
    : t("Ancora nessuna copia", "No copies yet");
  return `<section class="card cp1c"><div class="row" style="gap:12px;flex-wrap:wrap"><span class="cp1ci" aria-hidden="true">🛟</span>
    <div style="flex:1;min-width:200px"><b>${t("Copie di sicurezza", "Safety copies")}</b>
      <div class="small muted">${t("Home Assistant salva da solo le scelte della casa prima dei cambiamenti grossi e ogni giorno: se qualcosa va storto, torni indietro.", "Home Assistant saves the home's choices by itself before big changes and every day: if something goes wrong, you go back.")}</div>
      <div class="small cp1cs">${esc(sotto)}</div></div>
    <button class="btn" data-act="cpApri">↩️ ${t("Apri", "Open")}</button></div></section>`;
}

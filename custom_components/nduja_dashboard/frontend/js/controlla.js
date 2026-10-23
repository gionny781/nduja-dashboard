/* «🩺 Controlla Home Assistant» (⚙️ Impostazioni, solo amministratori): un controllo in parole semplici
   di quello che serve alla plancia per funzionare bene (stanze, piani, Energia, meteo, persone, dispositivi
   che non rispondono, versione). Legge soltanto: non cambia niente. Ogni ⚠️ porta alla schermata giusta di Home Assistant. */
import { S, AREAS, FLOORS, ACT, LAYOUT, MANUAL, t, LOC, esc, nm, attr, ents, areaOf, openings, render, ws, apriHA } from "./core.js";

/* versione minima di Home Assistant (come in hacs.json) */
const MINIMA = [2024, 12, 0];
const C = { stato: "", quando: 0, voci: [], aperto: false };

/** entità che la plancia mostra: dispositivi delle stanze, porte e finestre, e quelle messe nelle pagine create dall'utente */
function mostrate() {
  const L = new Set([...MANUAL.flatMap(d => ents(d)), ...openings()]);
  for (const p of LAYOUT.customPages || []) for (const id of p.items || []) if (S[id]) L.add(id);
  return [...L];
}
/* persone e scene non hanno una stanza: non le conto tra quelle «senza stanza» */
const senzaStanza = () => mostrate().filter(id => !["person", "scene"].includes(id.split(".")[0]) && !areaOf(id));
const confronta = (v, m) => { const n = String(v).split(".").map(x => parseInt(x, 10) || 0); for (let i = 0; i < 3; i++) if ((n[i] || 0) !== m[i]) return (n[i] || 0) - m[i]; return 0; };

async function controlla() {
  if (C.stato === "corre") return;
  C.stato = "corre"; render(true);
  const [en, cfg] = await Promise.all([ws({ type: "energy/get_prefs" }).catch(() => null), ws({ type: "get_config" }).catch(() => null)]);
  const V = [], aree = Object.keys(AREAS), fuori = senzaStanza();
  const voce = (ok, ic, testo, n, apri, extra = {}) => V.push({ ok, ic, testo, n, apri, ...extra });
  /* stanze e piani */
  voce(aree.length > 0, "🏠", aree.length ? t("Stanze in Home Assistant", "Rooms in Home Assistant") : t("Nessuna stanza in Home Assistant", "No rooms in Home Assistant"), aree.length, "/config/areas/dashboard",
    { aiuto: aree.length ? "" : t("Crea le stanze (aree) e assegna i dispositivi: la plancia li divide per stanza.", "Create rooms (areas) and assign your devices: the dashboard groups them by room.") });
  if (aree.length) {
    const sp = aree.filter(a => !FLOORS[AREAS[a].floor]);
    voce(!sp.length, "🏢", sp.length ? t("Stanze senza piano", "Rooms without a floor") : t("Tutte le stanze hanno un piano", "Every room has a floor"), sp.length, "/config/areas/dashboard",
      { aiuto: sp.length ? t("Assegna un piano (terra, primo…) a ogni stanza: la mappa le mette in ordine.", "Give each room a floor (ground, first…): the map puts them in order.") : "" });
  }
  voce(!fuori.length, "📍", fuori.length ? t("Dispositivi mostrati senza stanza", "Devices shown without a room") : t("Tutti i dispositivi mostrati hanno una stanza", "Every device shown has a room"), fuori.length, "/config/entities",
    { aiuto: fuori.length ? t("Finiscono in «Senza stanza». Assegna loro un'area in Home Assistant, oppure una stanza con ✏️ nella plancia.", "They end up in «No room». Give them an area in Home Assistant, or a room with ✏️ in the dashboard.") : "" });
  /* Energia */
  const fonti = (en?.energy_sources || []).length + (en?.device_consumption || []).length;
  voce(fonti > 0, "⚡", fonti ? t("Energia configurata", "Energy configured") : t("Energia non configurata", "Energy not configured"), fonti, "/config/energy",
    { aiuto: fonti ? "" : t("Con la dashboard Energia di Home Assistant la plancia mostra consumi, produzione e costi del giorno.", "With Home Assistant's Energy dashboard the dashboard shows today's usage, production and costs.") });
  /* meteo */
  const meteo = Object.keys(S).filter(id => id.startsWith("weather.")).length;
  voce(meteo > 0, "🌤️", meteo ? t("Meteo", "Weather") : t("Nessun meteo", "No weather"), meteo, "/config/integrations/dashboard/add?domain=met",
    { aiuto: meteo ? "" : t("Aggiungi un meteo (per esempio Met.no): serve alla Home, agli avvisi di pioggia e al salvaschermo.", "Add a weather integration (e.g. Met.no): Home, rain alerts and the screensaver use it.") });
  /* persone */
  const P = Object.keys(S).filter(id => id.startsWith("person.")), np = P.filter(id => !(attr(id, "device_trackers") || []).length);
  voce(!np.length, "👤", !P.length ? t("Nessuna persona", "No people") : np.length ? t("Persone senza telefono o tracker", "People without a phone or tracker") : t("Tutte le persone hanno un tracker", "Everyone has a tracker"), P.length ? np.length : 0, "/config/person",
    { aiuto: np.length ? np.map(id => esc(nm(id))).join(", ") + " · " + t("senza un dispositivo da seguire la plancia non sa chi è in casa: collega il telefono (app Home Assistant) alla persona.", "without a device to follow, the dashboard can't tell who's home: link the phone (Home Assistant app) to the person.") : "" });
  /* dispositivi che non rispondono */
  const giu = mostrate().filter(id => S[id]?.state === "unavailable").sort((a, b) => nm(a).localeCompare(nm(b), LOC));
  voce(!giu.length, "📡", giu.length ? t("Dispositivi mostrati che non rispondono", "Devices shown that don't respond") : t("Tutti i dispositivi mostrati rispondono", "Every device shown responds"), giu.length, "/config/entities",
    { elenco: giu, aiuto: giu.length ? t("Possono essere spenti, scollegati o senza batteria.", "They may be off, disconnected or out of battery.") : "" });
  /* versione */
  const ver = cfg?.version || "", vecchia = ver && confronta(ver, MINIMA) < 0;
  const agg = Object.keys(S).find(id => id.startsWith("update.") && S[id].state === "on" && /home_assistant_core|core_update/.test(id));
  voce(!!ver && !vecchia && !agg, "🏷️", "Home Assistant " + (ver ? esc(ver) : "?"), null, "/config/updates",
    { aiuto: vecchia ? t(`'Nduja vuole almeno la ${MINIMA.join(".")}: aggiorna Home Assistant.`, `'Nduja needs at least ${MINIMA.join(".")}: update Home Assistant.`)
      : agg ? t("C'è un aggiornamento di Home Assistant", "A Home Assistant update is available") + (attr(agg, "latest_version") ? ": " + esc(attr(agg, "latest_version")) : ".") : !ver ? t("Non riesco a leggere la versione.", "I can't read the version.") : "" });
  C.voci = V; C.stato = "fatto"; C.quando = Date.now(); render(true);
}

function riga(v, i) {
  const conta = v.n == null ? "" : `<span class="tag ${v.ok ? "ok" : "warn"}">${v.n}</span>`;
  const elenco = v.elenco?.length ? `<details class="hc3" ${C.aperto ? "open" : ""}><summary data-act="hcElenco">${t("Vedi quali", "See which")}</summary><div class="stack">${v.elenco.map(id =>
    `<button class="li" data-act="more" data-id="${id}"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(AREAS[areaOf(id)]?.name || t("senza stanza", "no room"))} · ${esc(id)}</span></div><span class="st">›</span></button>`).join("")}</div></details>` : "";
  return `<div class="hc2 ${v.ok ? "ok" : "warn"}"><span class="hc1i">${v.ok ? "✅" : "⚠️"}</span>
    <div class="tx"><b>${v.ic} ${v.testo} ${conta}</b>${v.aiuto ? `<span>${v.aiuto}</span>` : ""}${elenco}</div>
    ${v.ok ? "" : `<button class="btn sm" data-act="hcApri" data-i="${i}">${t("Apri", "Open")} ›</button>`}</div>`;
}

/** la scheda nelle Impostazioni */
export function controllaCard() {
  const V = C.voci, da = V.filter(v => !v.ok).length;
  const testa = C.stato === "fatto" ? `<span class="tag ${da ? "warn" : "ok"}">${da ? da + " ⚠️" : t("tutto ok", "all good")}</span>` : "";
  return `<section class="card hc1"><div class="ch"><h2>🩺 ${t("Controlla Home Assistant", "Check Home Assistant")} ${testa}</h2>
      <button class="btn ${C.stato === "fatto" ? "" : "pri"}" data-act="hcVai" ${C.stato === "corre" ? "disabled" : ""}>${C.stato === "corre" ? "⏳ " + t("Controllo…", "Checking…") : C.stato === "fatto" ? "↻ " + t("Controlla di nuovo", "Check again") : "🩺 " + t("Controlla", "Check")}</button></div>
    ${C.stato === "fatto" ? `<div class="stack">${V.map(riga).join("")}</div>
      <p class="small muted" style="margin-top:10px">${t("Controllo delle ", "Checked at ")}${new Date(C.quando).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })} · ${t("non ho cambiato niente: ⚠️ ti porta dove sistemarlo in Home Assistant.", "nothing was changed: ⚠️ takes you where to fix it in Home Assistant.")}</p>`
      : `<p class="small muted" style="margin:0">${t("Guardo stanze, piani, Energia, meteo, persone, dispositivi che non rispondono e versione, e ti dico cosa sistemare. Non cambio niente.", "I look at rooms, floors, Energy, weather, people, devices that don't respond and the version, and tell you what to fix. I don't change anything.")}</p>`}
  </section>`;
}

Object.assign(ACT, {
  hcVai: () => controlla(),
  hcApri: el => { const v = C.voci[+el.dataset.i]; if (v) apriHA(v.apri); },
  hcElenco: (el, e) => { e?.preventDefault?.(); C.aperto = !C.aperto; render(true); },
});

/* Automazioni (0.7.64, prima 0.7.22-dev1): tutte le automazioni di Home Assistant, ognuna con un interruttore grande.
   - Elenco: ricerca, filtri (accese, spente, in pausa, create con 'Nduja), raggruppate per stanza o etichetta di Home Assistant,
     «Spegni tutte» / «Riaccendi tutte» di un gruppo (con il secondo tocco di conferma).
   - Tocca un'automazione: la scheda con la frase in italiano di cosa fa, le ultime 5 esecuzioni (trace/list, trace/get),
     la pausa (1 ora, 4 ore, fino a domattina… la toglie Home Assistant da solo), Esegui, Modifica, Duplica, «com'era prima».
   - Costruttore «Quando → Solo se → Allora» (automazioni-modello.js) con la frase che si scrive mentre scegli, «Prova ora»,
     e 📚 ricette pronte (automazioni-ricette.js) che chiedono solo i dispositivi.
   - Le automazioni fatte in Home Assistant si leggono sempre in frase; si modificano qui solo se il costruttore le sa
     riscrivere identiche, altrimenti «Apri in Home Assistant». Prima di cambiarne una teniamo la configurazione di prima.
   Chi non è amministratore accende, spegne e mette in pausa; creare e modificare lo può fare solo un amministratore (Home Assistant). */
import { S, ACT, CHG, LAYOUT, UI, HOME_EXTRA, HOOKS, AREAS, REG, VERS, t, esc, nm, ok, attr, allEnts, ago, hhmm, card, empty, page, svc, toast, openSheet, closeSheet,
  render, isAdmin, api, apriHA, ws, cached, LOC, VISTE, etichettaNduja, myHA, areasSorted, areaOf, sGet, sSet, sicuro, pronto, unit, idsDi, weatherEnt, DEVICES } from "../core.js";
import { casa, casaCambia } from "../casa.js";
import { scegli, cambia } from "../edit.js";
import { TRASCINA, riordina } from "../trascina.js";
import { soglie } from "../avvisi.js";
import { nuovo, normalizza, inHA, daHA, uguali, controlla, frase, fraseTesto, fraseA, fraseC, nomeStato, statiPossibili, nomePressione, fraseDispositivo,
  controllabile, apertura, movimento, echi, notifiche, isElettro, elettrodomestici, persone, azioniHA as azioniModello } from "../automazioni-modello.js";
import { ricetteDisponibili, valoriIniziali, mancaRicetta } from "../automazioni-ricette.js";

/** azioni del modello → azioni di Home Assistant (lo usano anche i Momenti, che diventano script) */
export const azioniHA = azioniModello;

const V = { q: "", filtro: "tutte", nascoste: false, det: null, aperta: null };
const autos = () => allEnts("automation").sort((a, b) => nm(a).localeCompare(nm(b), LOC));
const cfgId = id => attr(id, "id");

/* pause (le gestisce Home Assistant) e scelte condivise: preferite in Home, nascoste, icone, configurazioni di prima */
const pause = () => casa("pause")?.dati || {};
const scelte = () => casa("automazioni")?.dati || {};
const preferite = () => (scelte().preferite || []).filter(id => S[id]);
const nascosta = id => (scelte().nascoste || []).includes(id);
const pausaFino = id => { const f = pause()[id], d = f ? new Date(f) : null; return d && d > Date.now() ? d : null; };
const inPausa = () => autos().filter(id => pausaFino(id));
const quando = d => { const oggi = new Date(), dom = new Date(Date.now() + 864e5);
  return d.toDateString() === oggi.toDateString() ? hhmm(d) : d.toDateString() === dom.toDateString() ? t("domani ", "tomorrow ") + hhmm(d) : d.toLocaleDateString(LOC, { day: "numeric", month: "short" }) + " " + hhmm(d); };

/* etichette di Home Assistant (per i gruppi e per riconoscere quelle create con 'Nduja) */
const etichette = () => cached("labels", 600e3, () => ws({ type: "config/label_registry/list" })) || [];
const nomeEtichetta = id => etichette().find(l => l.label_id === id)?.name || id;
const idNduja = () => etichette().find(l => String(l.name || "").toLowerCase().replace(/[’`´]/g, "'").trim() === "'nduja")?.label_id;
const diNduja = id => String(cfgId(id) || "").startsWith("nduja_") || (REG[id]?.labels || []).includes(idNduja());

/* un'icona che si capisce al volo, dal nome dell'automazione */
const ICONE = [[/allarm|alarm|intrus/, "🛡️"], [/luc|light|lamp|neon|led/, "💡"], [/nott|night|dorm|sleep|buonanott/, "🌙"], [/matt|sveglia|morning|alba|sunrise|buongiorno/, "🌅"], [/tramont|sera|sunset|evening/, "🌇"],
  [/irrig|giardin|prato|water|sprink/, "💧"], [/allarm|alarm|sicur|security|intrus/, "🛡️"], [/tappar|tend|cover|blind|shutter|persian/, "🪟"],
  [/clima|risc|termo|caldo|freddo|temp|heat|cool|condiz|aria/, "🌡️"], [/notif|avvis|messag|telegram|alert/, "🔔"], [/cancell|garage|gate|porta|door|serrat|lock/, "🚪"],
  [/arriv|casa|home|esco|uscit|leave|presen/, "🏠"], [/energ|solar|fotovolt|batter|consum|power|carica|charg|pila/, "⚡"], [/lavatr|lavastov|forno|asciug|washer|dryer|oven/, "🧺"],
  [/aspirap|robot|vacuum|pulizi/, "🧹"], [/music|radio|tv|media|film|spotify|sonos/, "🎵"], [/\bauto\b|tesla|macchin/, "🚗"], [/telecam|camera|video/, "📷"], [/meteo|pioggia|piove|vento|rain|wind/, "🌦️"]];
const iconaAuto = id => { const n = (nm(id) + " " + id.split(".")[1]).toLowerCase(); return (ICONE.find(([r]) => r.test(n)) || [0, "⚡"])[1]; };
/** l'icona scelta nella scheda (se il nome trae in inganno), altrimenti quella trovata dal nome */
const icona = id => scelte().icone?.[id] || iconaAuto(id);
const SCELTA_ICONE = [...new Set([...ICONE.map(x => x[1]), "⚡", "🔁", "⏰", "🔊", "🐾", "🍳", "🛁", "🎉"])];

/** riga sotto il nome: in pausa, spenta, in corso, «ultima volta: 2 h fa» */
function sotto(id) {
  const on = S[id].state === "on", pz = pausaFino(id), lt = attr(id, "last_triggered");
  return pz ? "⏸️ " + t("in pausa fino a ", "paused until ") + quando(pz)
    : !on ? t("spenta", "off") + (lt ? t(" · ultima volta ", " · last ran ") + ago(lt) : "")
    : attr(id, "current") ? "▶ " + t("in corso", "running")
    : lt ? t("accesa · ultima volta ", "on · last ran ") + ago(lt) : t("accesa · mai partita", "on · never ran");
}
/** un'automazione: tocchi e si apre la sua scheda; l'interruttore grande la accende o la spegne */
function tasto(id) {
  const on = S[id].state === "on", pz = pausaFino(id), n = esc(nm(id));
  return `<div class="aut ${on ? "on" : ""} ${pz ? "pz" : ""}" data-tri="${id}">
    <button class="aut-m" data-act="auApri" data-id="${id}" aria-label="${n}: ${t("apri i dettagli", "open details")}">
      <span class="aut-i" aria-hidden="true">${icona(id)}</span><span class="aut-t"><b>${n}</b><small>${esc(sotto(id))}</small></span></button>
    <button class="aut-sw" data-act="auTile" data-id="${id}" role="switch" aria-checked="${on && !pz}" aria-label="${n}: ${on ? t("accesa, tocca per spegnere", "on, tap to turn off") : pz ? t("in pausa, tocca per riaccendere", "paused, tap to turn back on") : t("spenta, tocca per accendere", "off, tap to turn on")}"><span class="sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span></button></div>`;
}

/* ---------------- elenco ---------------- */
const gruppoScelto = () => ["stanza", "etichetta", "no"].includes(sGet("auGruppo")) ? sGet("auGruppo") : null;
/** raggruppa: scelta su questo dispositivo; senza scelta per stanza se qualche automazione ce l'ha, poi per etichetta */
function gruppo(A) {
  const g = gruppoScelto(); if (g) return g;
  if (A.some(id => areaOf(id))) return "stanza";
  if (A.some(id => (REG[id]?.labels || []).length)) return "etichetta";
  return "no";
}
function gruppi(L, modo) {
  if (modo === "stanza") {
    const per = {}; L.forEach(id => { const a = areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"; (per[a] = per[a] || []).push(id); });
    return [...areasSorted(true).filter(a => per[a]).map(a => [a, AREAS[a].name, per[a]]), ...(per._ ? [["_", t("Senza stanza", "No room"), per._]] : [])];
  }
  if (modo === "etichetta") {
    const per = {}, senza = [];
    L.forEach(id => { const E = REG[id]?.labels || []; if (!E.length) senza.push(id); E.forEach(l => (per[l] = per[l] || []).push(id)); });
    return [...Object.keys(per).sort((a, b) => nomeEtichetta(a).localeCompare(nomeEtichetta(b), LOC)).map(l => [l, "🏷️ " + nomeEtichetta(l), per[l]]), ...(senza.length ? [["_", t("Senza etichetta", "No label"), senza]] : [])];
  }
  return [["tutte", "", L]];
}
/** i pulsanti «Spegni tutte» / «Riaccendi tutte» di un gruppo */
function tuttiGruppo(k, L) {
  if (L.length < 2) return "";
  const acc = L.filter(id => S[id].state === "on" && !pausaFino(id)), spente = L.filter(id => S[id].state !== "on" || pausaFino(id));
  return `<span class="aug1b">${acc.length ? `<button class="btn sm" data-act="auTutte" data-k="${esc(k)}" data-v="off">⛔ ${t("Spegni tutte", "Turn all off")} (${acc.length})</button>` : ""}${!acc.length && spente.length ? `<button class="btn sm" data-act="auTutte" data-k="${esc(k)}" data-v="on">✅ ${t("Riaccendi tutte", "Turn all back on")} (${spente.length})</button>` : ""}</span>`;
}
let ULTIMI = [];   // i gruppi disegnati (per «Spegni tutte»)
function pagina() {
  const A = autos(), q = V.q.toLowerCase(), P = pause();
  const visibili = A.filter(id => V.nascoste || !nascosta(id)), nNasc = A.filter(nascosta).length;
  const nPz = A.filter(id => P[id] && pausaFino(id)).length, nNd = A.filter(diNduja).length;
  if ((V.filtro === "pausa" && !nPz) || (V.filtro === "nduja" && !nNd)) V.filtro = "tutte";
  const L = visibili.filter(id => (!q || (nm(id) + " " + id + " " + (AREAS[areaOf(id)]?.name || "")).toLowerCase().includes(q)) && (V.filtro === "tutte"
    || (V.filtro === "accese" && S[id].state === "on") || (V.filtro === "spente" && S[id].state !== "on" && !pausaFino(id)) || (V.filtro === "pausa" && !!pausaFino(id)) || (V.filtro === "nduja" && diNduja(id))));
  const nOn = A.filter(id => S[id].state === "on").length, modo = gruppo(A);
  const filtri = [["tutte", t("Tutte", "All")], ["accese", t("Accese", "On")], ["spente", t("Spente", "Off")], ...(nPz ? [["pausa", "⏸️ " + t("In pausa", "Paused")]] : []), ...(nNd ? [["nduja", "🌶️ " + t("Create con 'Nduja", "Made with 'Nduja")]] : [])];
  const G = gruppi(L, modo); ULTIMI = G;
  const ricette = isAdmin() ? ricetteDisponibili() : [];
  return `<div class="g">
    <section class="card"><div class="ch"><h2>🔁 ${t("Automazioni", "Automations")} <span class="tag info">${nOn}/${A.length}</span></h2>${isAdmin() ? `<button class="btn pri" data-act="auNew">＋ ${t("Nuova automazione", "New automation")}</button>` : ""}</div>
      <p class="small muted" style="margin:0 0 12px">${t("L'interruttore la accende o la spegne. Tocca il nome per leggere cosa fa, vedere quando è partita e metterla in pausa.", "The switch turns it on or off. Tap the name to read what it does, see when it ran and pause it.")}</p>
      ${!isAdmin() ? `<p class="small muted au1na">🔒 ${t("Puoi accendere, spegnere e mettere in pausa le automazioni. Crearle e modificarle lo può fare solo un amministratore: lo decide Home Assistant.", "You can turn automations on, off and pause them. Only an administrator can create and edit them: Home Assistant decides that.")}</p>` : ""}
      ${A.length > 3 ? `<div class="au1bar"><input id="au1q" class="pk1q" type="search" placeholder="🔍 ${t("Cerca…", "Search…")}" value="${esc(V.q)}" aria-label="${t("Cerca un'automazione", "Search an automation")}">
        <div class="seg" role="group" aria-label="${t("Filtro", "Filter")}">${filtri.map(([k, n]) => `<button class="${V.filtro === k ? "act" : ""}" data-act="auFiltro" data-v="${k}" aria-pressed="${V.filtro === k}">${n}</button>`).join("")}</div>
        <label class="au1gr"><span>${t("Raggruppa", "Group")}</span><select data-chg="auGruppo">${[["stanza", t("per stanza", "by room")], ["etichetta", t("per etichetta", "by label")], ["no", t("tutte insieme", "all together")]].map(([k, n]) => `<option value="${k}" ${modo === k ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>` : ""}
      ${L.length ? G.map(([k, n, ids]) => `${n || ids.length > 1 ? `<div class="aug1"><h3>${esc(n || t("Tutte", "All"))} <span class="muted">${ids.length}</span></h3>${tuttiGruppo(k, ids)}</div>` : ""}<div class="autg">${ids.map(tasto).join("")}</div>`).join("")
        : empty(A.length ? t("Nessun risultato.", "No results.") : isAdmin() ? t("Non hai ancora automazioni: creane una con ＋ o parti da una ricetta qui sotto.", "No automations yet: create one with ＋ or start from a recipe below.") : t("Non ci sono automazioni.", "There are no automations."))}
      ${nNasc ? `<button class="btn ghost sm" style="margin-top:12px" data-act="auNascoste">${V.nascoste ? "🙈 " + t("Nascondi di nuovo", "Hide again") : "👁 " + t(`Mostra le nascoste (${nNasc})`, `Show hidden (${nNasc})`)}</button>` : ""}
    </section>
    ${ricette.length ? `<section class="card"><div class="ch"><h2>📚 ${t("Ricette pronte", "Ready-made recipes")}</h2></div>
      <p class="small muted" style="margin:0 0 12px">${t("Un tocco, scegli i dispositivi (spesso li trovo io) e salvi. Poi la puoi ritoccare nel costruttore.", "One tap, choose the devices (often I find them for you) and save. You can fine-tune it in the builder later.")}</p>
      <div class="aur1">${ricette.map(r => `<button class="aur1b" data-act="auRicetta" data-k="${r.k}"><span aria-hidden="true">${r.ic}</span><b>${esc(r.nome())}</b><small>${esc(r.cosa())}</small></button>`).join("")}</div></section>` : ""}
  </div>`;
}

/* ---------------- configurazioni di Home Assistant (lette quando servono) ---------------- */
const CFG = {};   // entity_id → { t, stato: "caricando" | "ok" | "errore", cfg, err }
/** la configurazione: { cfg, file } — file = sta in automations.yaml, quindi Home Assistant la lascia riscrivere (come il suo editor) */
async function leggiCfg(id) {
  const c = cfgId(id), buona = x => x && typeof x === "object" && (x.triggers || x.trigger) && (x.actions || x.action);
  if (c && isAdmin()) { try { const r = await api("GET", "/api/config/automation/config/" + encodeURIComponent(c)); if (buona(r)) return { cfg: r, file: true }; } catch (e) { /* 404: è in un altro file YAML */ } }
  const r = await ws({ type: "automation/config", entity_id: id });
  if (!buona(r?.config)) throw new Error("no config");
  return { cfg: r.config, file: false };
}
function cfgDi(id, forza) {
  const c = CFG[id];
  if (c && !forza && (c.stato === "caricando" || Date.now() - c.t < 30e3)) return c;
  CFG[id] = { t: Date.now(), stato: c?.cfg ? "ok" : "caricando", cfg: c?.cfg, file: c?.file };
  leggiCfg(id).then(r => { CFG[id] = { t: Date.now(), stato: "ok", cfg: r.cfg, file: r.file }; render(); })
    .catch(e => { CFG[id] = { t: Date.now(), stato: "errore", err: e?.code || e?.message || String(e) }; render(); });
  return CFG[id];
}
const dimentica = id => { delete CFG[id]; for (const k of Object.keys(STORIA)) if (k.startsWith(id + "|")) delete STORIA[k]; };
/** la lettura di un'automazione: { modello, modificabile, pezzi } (il modello salvato vale solo se dà ancora la stessa configurazione) */
function lettura(id, cfg, file = true) {
  const c = cfgId(id), mod = c && LAYOUT.autoModels?.[c];
  if (mod) { try { const m = normalizza(mod); if (uguali(inHA(m, c), cfg)) return { modello: m, modificabile: true, nostro: true }; } catch {} }
  const r = daHA(cfg);
  return { modello: r.modello, modificabile: r.modificabile && file, yaml: r.modificabile && !file, motivo: r.motivo, pezzi: { quando: r.quando, cond: r.cond, azioni: r.azioni, modo: r.modello.soloSe.modo } };
}

/* ---------------- cronologia: le ultime 5 esecuzioni ---------------- */
const STORIA = {};
function storia(id) {
  const c = cfgId(id); if (!c) return { stato: "noid" };
  const k = id + "|" + (attr(id, "last_triggered") || "");
  if (!STORIA[k]) { STORIA[k] = { stato: "caricando" };
    ws({ type: "trace/list", domain: "automation", item_id: c }).then(L => { STORIA[k] = { stato: "ok", L: (L || []).sort((a, b) => String(b.timestamp?.start).localeCompare(String(a.timestamp?.start))).slice(0, 5) }; render(); })
      .catch(e => { STORIA[k] = { stato: "errore", err: e?.code || e?.message || "" }; render(); }); }
  return STORIA[k];
}
const DETTAGLI = {};
/** cosa l'ha fatta partire, in italiano (Home Assistant lo scrive in inglese: «state of binary_sensor.porta») */
function partenza(s) {
  const x = String(s || ""), id = (x.match(/\b([a-z_]+\.[a-z0-9_]+)\b/) || [])[1], n = id && S[id] ? `«${nm(id)}»` : id ? `«${id}»` : "";
  if (/automation\.trigger|manual|by service|by action/i.test(x)) return "👆 " + t("fatta partire a mano (Esegui)", "started by hand (Run)");
  if (/^numeric state of/i.test(x)) return "📈 " + t("valore di ", "value of ") + n;
  if (/^state of/i.test(x)) return "🔁 " + t("cambio di ", "change of ") + n;
  if (/^time pattern/i.test(x)) return "⏱️ " + t("a intervalli", "time pattern");
  if (/^time/i.test(x)) return "🕐 " + t("l'ora stabilita", "the set time");
  if (/sun|sunset|sunrise/i.test(x)) return "🌅 " + t("alba o tramonto", "sunrise or sunset");
  if (/zone/i.test(x)) return "🏠 " + t("qualcuno arriva o esce", "someone arrives or leaves");
  if (/calendar/i.test(x)) return "📅 " + t("evento del calendario", "calendar event");
  if (/device/i.test(x)) return "🔘 " + t("un pulsante", "a button");
  if (/home ?assistant|start|shutdown/i.test(x)) return "🏠 " + t("avvio di Home Assistant", "Home Assistant start");
  if (/event/i.test(x)) return "📣 " + t("un evento", "an event");
  if (/template/i.test(x)) return "🧩 " + t("una condizione avanzata", "an advanced template");
  return x ? "• " + x : "—";
}
function esito(r) {
  const ex = r.script_execution || (r.state === "running" ? "running" : "");
  return { finished: ["ok", "✅ " + t("fatta", "done")], failed_conditions: ["", "⏭ " + t("le condizioni non c'erano: non ha fatto niente", "conditions not met: did nothing")],
    failed_single: ["", "⏸️ " + t("era già in corso", "was already running")], failed_max_runs: ["", "⏸️ " + t("troppe insieme", "too many at once")], error: ["bad", "❌ " + t("errore", "error")],
    aborted: ["warn", "⏹ " + t("interrotta", "stopped")], cancelled: ["warn", "⏹ " + t("annullata", "cancelled")], running: ["info", "▶ " + t("in corso", "running")] }[ex] || ["", ex || "—"];
}
function riga(id, r, lett) {
  const [cls, txt] = esito(r), k = r.run_id, ap = V.aperta === k, d = DETTAGLI[k];
  const quando = r.timestamp?.start ? new Date(r.timestamp.start).toLocaleString(LOC, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  let det = "";
  if (ap) {
    if (!d || d.stato === "caricando") det = `<div class="small muted">${t("Leggo…", "Reading…")}</div>`;
    else if (d.stato === "errore") det = `<div class="small muted">${t("Non riesco a leggere i dettagli.", "I can't read the details.")}</div>`;
    else {
      const P = d.tr?.trace || {}, passi = [];
      for (const [path, L] of Object.entries(P)) {
        const m = path.match(/^(condition|action)\/(\d+)$/); if (!m) continue;
        const x = (L || [])[0] || {}, i = +m[2], err = x.error;
        if (m[1] === "condition") { if (x.result?.result === false) passi.push(`⏭ ${t("non è andata avanti", "stopped here")}: ${lett?.pezzi?.cond?.[i] ? fraseC(lett.pezzi.cond[i]) : lett?.modello?.soloSe?.cond?.[i] ? fraseC(lett.modello.soloSe.cond[i]) : t("una condizione", "a condition")}`); continue; }
        const raw = (d.tr?.config?.actions || d.tr?.config?.action || [])[i], f = raw ? fraseA(daHA({ actions: [raw], triggers: [] }).azioni[0]) : null;
        passi.push(`${err ? "❌" : "✅"} ${f || t("un passo avanzato", "an advanced step")}${err ? ` — <span class="bad1">${esc(err)}</span>` : ""}`);
      }
      det = passi.length ? `<ol class="au1ps">${passi.map(p => `<li>${p}</li>`).join("")}</ol>` : `<div class="small muted">${t("Nessun passo registrato.", "No steps recorded.")}</div>`;
      if (d.tr?.error && !r.error && !Object.values(P).some(L => (L || []).some(x => x.error))) det += `<div class="small bad1 au1pe">❌ ${esc(d.tr.error)}</div>`;
    }
  }
  return `<li class="au1st ${cls}"><button class="au1stb" data-act="auTraccia" data-id="${id}" data-k="${esc(k)}" aria-expanded="${ap}"><span class="au1stq">${esc(quando)}</span><span class="au1stp">${esc(partenza(r.trigger))}</span><span class="au1ste">${esc(txt)}${r.error ? ": " + esc(r.error) : ""}</span></button>${det}</li>`;
}
function cronologia(id, lett) {
  const s = storia(id);
  if (s.stato === "noid") return `<p class="small muted">${t("Questa automazione non ha un identificativo (è scritta a mano in YAML senza «id»): Home Assistant non ne tiene la cronologia.", "This automation has no id (hand-written YAML without «id»): Home Assistant keeps no history for it.")}</p>`;
  if (s.stato === "caricando") return `<p class="small muted">${t("Leggo la cronologia…", "Reading the history…")}</p>`;
  if (s.stato === "errore") return `<p class="small muted">${/unauthorized/i.test(s.err) ? t("La cronologia la può vedere solo un amministratore di Home Assistant.", "Only a Home Assistant administrator can see the history.") : t("Non riesco a leggere la cronologia.", "I can't read the history.")}</p>`;
  if (!s.L.length) return `<p class="small muted">${t("Non è ancora partita (o Home Assistant è stato riavviato da poco).", "It hasn't run yet (or Home Assistant was restarted recently).")}</p>`;
  return `<ul class="au1sl">${s.L.map(r => riga(id, r, lett)).join("")}</ul><p class="small muted" style="margin-top:6px">${t("Tocca un'esecuzione per vedere cosa ha fatto.", "Tap a run to see what it did.")}</p>`;
}

/* ---------------- la scheda di un'automazione ---------------- */
const oraMattina = () => /^\d{2}:\d{2}$/.test(scelte().mattina || "") ? scelte().mattina : "07:00";
const minutiADomattina = () => { const [h, m] = oraMattina().split(":").map(Number), d = new Date(), dopo = d.getHours() * 60 + d.getMinutes() >= h * 60 + m;
  d.setDate(d.getDate() + (dopo ? 1 : 0)); d.setHours(h, m, 0, 0); return Math.max(1, Math.round((d - Date.now()) / 6e4)); };
/** «aaaa-mm-ggThh:mm» locale per il campo «Fino a…» */
const locale = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
function dettaglio() {
  const id = V.det; if (!id || !S[id]) return `<div class="sh-head"><div><h3>🔁 ${t("Automazione", "Automation")}</h3></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>${empty(t("Questa automazione non c'è più.", "This automation is gone."))}`;
  const on = S[id].state === "on", pz = pausaFino(id), pref = preferite().includes(id), nas = nascosta(id), c = cfgId(id), adm = isAdmin();
  const op = (act, txt, extra = "", cls = "") => `<button class="btn ${cls}" data-act="${act}" data-id="${id}" ${extra}>${txt}</button>`;
  const cf = c ? cfgDi(id) : { stato: "noid" }, lett = cf.stato === "ok" && cf.cfg ? lettura(id, cf.cfg, cf.file) : null;
  const prima = c && scelte().prima?.[c];
  const fr = cf.stato === "noid" ? t("Scritta a mano in Home Assistant senza «id»: qui non la posso leggere.", "Hand-written in Home Assistant without «id»: I can't read it here.")
    : cf.stato === "errore" ? (/unauthorized/i.test(cf.err) ? t("Solo un amministratore può leggere cosa fa.", "Only an administrator can read what it does.") : t("Non riesco a leggere cosa fa.", "I can't read what it does."))
    : !lett ? t("Leggo…", "Reading…") : frase(lett.modificabile ? lett.modello : null, lett.modificabile ? null : lett.pezzi);
  return `<div class="sh-head au1dh"><div><h3>${icona(id)} ${esc(nm(id))}</h3><div class="small muted">${esc(sotto(id))}${diNduja(id) ? " · 🌶️ 'Nduja" : ""}</div></div>
      <button class="aut-sw big" data-act="auTile" data-id="${id}" role="switch" aria-checked="${on && !pz}" aria-label="${on ? t("Spegni", "Turn off") : t("Accendi", "Turn on")}"><span class="sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span></button>
      <button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    <div class="auf1"><span class="auf1t">📖 ${t("Cosa fa", "What it does")}</span><p>${fr}</p>
      ${lett?.yaml && adm ? `<p class="small muted">${t("È scritta in un file YAML di Home Assistant (non in automations.yaml): qui si legge, si cambia in quel file.", "It's written in a Home Assistant YAML file (not automations.yaml): you can read it here, change it in that file.")}</p>` : ""}
      ${lett && !lett.modificabile && !lett.yaml && adm ? `<p class="small muted">${t("È fatta in Home Assistant con passi che il costruttore non sa riscrivere identici: qui si legge, per cambiarla apri Home Assistant.", "It's made in Home Assistant with steps the builder can't rewrite identically: you can read it here, open Home Assistant to change it.")}</p>` : ""}</div>
    <div class="fl1">🕘 ${t("Ultime esecuzioni", "Latest runs")}</div>${cronologia(id, lett)}
    <div class="fl1">⏸️ ${t("Metti in pausa", "Pause")}</div>
    <div class="aut-op">
      ${op("auPausa", "⏸️ " + t("1 ora", "1 hour"), 'data-m="60"')}${op("auPausa", "⏸️ " + t("4 ore", "4 hours"), 'data-m="240"')}
      ${op("auPausa", "🌙 " + t("Fino a domattina", "Until tomorrow morning") + ` <small>${oraMattina()}</small>`, `data-m="${minutiADomattina()}"`)}${op("auPausa", "📅 " + t("Una settimana", "One week"), 'data-m="10080"')}
      ${pz ? op("auRiprendi", "▶ " + t("Togli la pausa", "End the pause"), "", "pri") : ""}
    </div>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap;align-items:flex-end">
      <label class="fld1" style="flex:1;min-width:190px;margin:0"><span>${t("Fino a un giorno e un'ora a scelta", "Until a day and time of your choice")}</span><input id="au1pf" type="datetime-local" min="${locale(new Date())}" value="${locale(new Date(Date.now() + 2 * 36e5))}"></label>
      ${op("auPausaFino", "⏸️ " + t("Metti in pausa", "Pause"))}</div>
    <label class="fld1" style="margin-top:8px"><span>${t("Ora di «domattina» (vale per tutte le automazioni)", "«Tomorrow morning» time (for all automations)")}</span><input type="time" value="${oraMattina()}" data-chg="auMattina"></label>
    <small class="muted">${t("Dopo la pausa Home Assistant la riaccende da solo, anche se la plancia è chiusa.", "After the pause Home Assistant turns it back on by itself, even with the dashboard closed.")}</small>
    <div class="fl1">${t("Altro", "More")}</div>
    <div class="aut-op">
      ${op("auRun", "▶ " + t("Esegui adesso", "Run now"), `title="${t("Fa le azioni subito, senza guardare le condizioni", "Does the actions now, without checking the conditions")}"`)}
      ${op("auPref", pref ? "⭐ " + t("Togli dalla Home", "Remove from Home") : "☆ " + t("Mostra in Home", "Show on Home"))}
      ${op("auNasc", nas ? "👁 " + t("Rimetti nell'elenco", "Show again") : "🙈 " + t("Nascondi da qui", "Hide from here"))}
      ${adm && lett?.modificabile ? op("auEdit", "✏️ " + t("Modifica", "Edit"), "", "pri") : ""}
      ${adm && lett ? op("auDuplica", "📄 " + t("Duplica", "Duplicate")) : ""}
      ${adm && c ? op("auApriHA", "↗ " + t("Apri in Home Assistant", "Open in Home Assistant")) : ""}
      ${adm && prima ? op("auPrima", "↶ " + t("Rimetti com'era prima", "Put back as it was"), `title="${esc(t("Versione del ", "Version of ") + new Date(prima.ts).toLocaleString(LOC))}"`) : ""}
    </div>
    ${!adm ? `<p class="small muted" style="margin-top:8px">🔒 ${t("Modificarla lo può fare solo un amministratore: lo decide Home Assistant.", "Only an administrator can edit it: Home Assistant decides that.")}</p>` : ""}
    <div class="fl1">${t("Icona", "Icon")}</div>
    <div class="vr1">${[["", "✨"], ...SCELTA_ICONE.map(x => [x, x])].map(([k, n]) => `<button class="${(scelte().icone?.[id] || "") === k ? "on" : ""}" data-act="auIcona" data-id="${id}" data-v="${k}" ${k ? "" : `title="${t("Automatica, dal nome", "Automatic, from the name")}"`}>${n}${k ? "" : " " + t("dal nome", "from name")}</button>`).join("")}</div>`;
}
async function pausa(id, minuti) {
  try { await ws({ type: "nduja_dashboard/pausa", entity_id: id, minuti }); return true; }
  catch (e) {
    toast(/unknown_command|unknown command/i.test(e?.code || e?.message || "") ? t("Aggiorna e riavvia Home Assistant per usare le pause", "Update and restart Home Assistant to use pauses") : t("Non riuscito: ", "Failed: ") + (e?.message || e?.code || e), true);
    return false;
  }
}
/** tocco sull'interruttore: accende / spegne (se era in pausa, toglie la pausa e la riaccende) */
async function tocca(id) {
  if (!S[id]) return;
  if (pausaFino(id)) { if (await pausa(id, 0)) toast("✅ " + nm(id) + " · " + t("riaccesa", "back on")); return; }
  const on = S[id].state === "on";
  if (on && pause()[id]) await pausa(id, 0);   // pausa scaduta rimasta: la pulisco
  await svc("automation", on ? "turn_off" : "turn_on", {}, { entity_id: id });
  toast((on ? "⛔ " : "✅ ") + nm(id) + " · " + (on ? t("spenta", "off") : t("accesa", "on")));
}

/* ---------------- Home: le preferite e quelle in pausa; Colpo d'occhio ---------------- */
function homeCard() {
  const L = preferite(); if (!L.length) return "";
  return card("🔁 " + t("Automazioni", "Automations"), `<div class="autg sm" ${UI.edit ? `data-tr="autopref"` : ""}>${L.map(tasto).join("")}</div>`, { link: [t("Tutte", "All"), "automazioni"] });
}
function pausaCard() {
  const L = inPausa(); if (!L.length) return "";
  return card("⏸️ " + t("Automazioni in pausa", "Paused automations"), `<div class="stack">${L.map(id => `<div class="li au1pz"><span class="ic" aria-hidden="true">${icona(id)}</span><div class="tx"><b>${esc(nm(id))}</b><span>${t("riparte da sola ", "restarts by itself ")}${quando(pausaFino(id))}</span></div>
    <button class="btn sm" data-act="auRiprendi" data-id="${id}">▶ ${t("Riaccendi", "Turn on")}</button></div>`).join("")}</div>`, { link: [t("Tutte", "All"), "automazioni"] });
}
/* in ✏️ Modifica della Home le automazioni preferite si trascinano per cambiarne l'ordine (vale per tutta la casa) */
TRASCINA.autopref = { nome: nm, salva: async ({ ids }) => {
  const prima = [...(scelte().preferite || [])];
  await casaCambia("automazioni", d => { d.preferite = riordina(d.preferite || [], ids); });
  return () => casaCambia("automazioni", d => { d.preferite = prima; }, "↶ " + t("Come prima", "Back as it was"));
} };
HOME_EXTRA.automazioni = { title: () => t("Automazioni", "Automations"), render: homeCard, show: () => preferite().length > 0 };
HOME_EXTRA.autoPausa = { title: () => t("Automazioni in pausa", "Paused automations"), render: pausaCard, show: () => inPausa().length > 0 };
/* per la tessera «automazione» del Colpo d'occhio (pages/colpo.js) */
VISTE.autoTocca = tocca;
VISTE.autoPausa = id => pausaFino(id);
document.addEventListener("input", e => { if (e.target.id === "au1q") { V.q = e.target.value; render(); } });

/* ================= costruttore ================= */
let M = null, mId = null, mEid = null;
const GIORNI = () => [["mon", t("Lun", "Mon")], ["tue", t("Mar", "Tue")], ["wed", t("Mer", "Wed")], ["thu", t("Gio", "Thu")], ["fri", t("Ven", "Fri")], ["sat", t("Sab", "Sat")], ["sun", t("Dom", "Sun")]];
const QUANDO = () => [["ora", "🕐 " + t("A un'ora", "At a time")], ["sole", "🌅 " + t("Alba o tramonto", "Sunrise or sunset")], ["stato", "🔁 " + t("Un dispositivo cambia", "A device changes")],
  ["soglia", "📈 " + t("Un valore supera o scende sotto una soglia", "A value goes above or below a threshold")], ["apertura", "🚪 " + t("Porta o finestra aperta da N minuti", "Door or window open for N minutes")],
  ["movimento", "🏃 " + t("Movimento (o nessuno da N minuti)", "Motion (or none for N minutes)")], ["persona", "🏠 " + t("Qualcuno arriva o esce", "Someone arrives or leaves")],
  ["casa", "👥 " + t("L'ultimo esce o il primo arriva", "Last one leaves or first one arrives")], ["pulsante", "🔘 " + t("Pressione di un pulsante o telecomando", "A button or remote press")],
  ["elettro", "🧺 " + t("Un elettrodomestico finisce", "An appliance is done")], ["allarme", "🛡️ " + t("L'allarme si inserisce, si disinserisce o scatta", "The alarm is armed, disarmed or triggered")],
  ["calendario", "📅 " + t("Inizia un evento del calendario", "A calendar event starts")], ["pioggia", "🌧️ " + t("Il meteo annuncia pioggia", "The weather says rain")]];
const SOLOSE = () => [["casa", "🏠 " + t("Chi è in casa", "Who's home")], ["orario", "🕐 " + t("Fascia oraria e giorni", "Time range and days")], ["sole", "🌗 " + t("Giorno o notte", "Day or night")],
  ["stato", "🔁 " + t("Stato di un dispositivo", "A device's state")], ["valore", "📈 " + t("Un valore sopra o sotto", "A value above or below")]];
const AZIONI = () => [["on", "✅ " + t("Accendi / apri", "Turn on / open")], ["off", "⛔ " + t("Spegni / chiudi", "Turn off / close")], ["toggle", "🔁 " + t("Commuta", "Toggle")],
  ["pertempo", "⏱️ " + t("Accendi per N minuti, poi spegni", "Turn on for N minutes, then off")], ["tapparella", "🪟 " + t("Tapparelle a una percentuale", "Covers to a percentage")],
  ["clima", "🌡️ " + t("Clima: modalità e temperatura", "Climate: mode and temperature")], ["scena", "🎬 " + t("Scena, script o Momento", "Scene, script or Moment")],
  ["automazione", "🔁 " + t("Fai partire un'altra automazione", "Run another automation")], ["allarme", "🛡️ " + t("Allarme", "Alarm")], ["notifica", "🔔 " + t("Notifica al telefono", "Phone notification")],
  ...(echi().length ? [["alexa", "🗣️ " + t("Messaggio su Alexa", "Message on Alexa")]] : []), ["attendi", "⏳ " + t("Aspetta", "Wait")]];
const NUOVO_Q = tipo => ({ ora: { ora: "07:00" }, sole: { evento: "sunset", offset: 0 }, stato: { entita: [], a: "on" }, soglia: { entita: [], verso: "sopra", valore: "" }, apertura: { entita: [], min: 5 },
  movimento: { entita: [], modo: "rilevato", min: 10 }, persona: { persona: [], evento: "arriva" }, casa: { evento: "ultimo" }, pulsante: { entita: [] }, elettro: { entita: elettrodomestici().slice(0, 1) },
  allarme: { entita: allEnts("alarm_control_panel").slice(0, 1), evento: "inserito" }, calendario: { entita: allEnts("calendar").slice(0, 1), prima: 0 }, pioggia: { entita: [weatherEnt()].filter(Boolean) } }[tipo] || {});
const NUOVA_C = tipo => ({ casa: { chi: "qualcuno" }, orario: { dalle: "", alle: "", giorni: [] }, sole: { fase: "notte" }, stato: { entita: [], stato: "on" }, valore: { entita: [], verso: "sopra", valore: "" } }[tipo] || {});

/* percorsi dentro il modello: "quando.0.entita", "soloSe.cond.1.chi", "azioni.2.minuti" */
const get = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);
const set = (o, path, v) => { const k = path.split("."); let x = o; while (k.length > 1) x = x[k.shift()]; x[k[0]] = v; };
const lista = v => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const sel = (path, v, opts, act = "auF") => `<select data-chg="${act}" data-k="${path}">${opts.map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? "") === String(a) ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>`;
const campo = (tit, html, cls = "") => `<label class="fld1 ${cls}"><span>${tit}</span>${html}</label>`;
const numero = (path, v, extra = "") => `<input type="number" inputmode="decimal" value="${esc(v ?? "")}" data-chg="auF" data-k="${path}" ${extra}>`;
const minutiF = (path, v, tit) => campo(tit, numero(path, v, 'min="1" step="1"'));

/* filtri per scegliere i dispositivi */
const numerico = id => /^(sensor|number|input_number)\./.test(id) && S[id] && !isNaN(parseFloat(S[id].state)) && !/^\d{4}-\d{2}-\d{2}/.test(S[id].state);
const FILTRI = {
  tutto: id => /^(binary_sensor|sensor|light|switch|cover|lock|climate|media_player|input_boolean|person|alarm_control_panel|vacuum|fan|device_tracker|input_select|select|valve|humidifier|siren|sun|automation|water_heater)\./.test(id),
  num: numerico, apertura, movimento, evento: id => id.startsWith("event."), elettro: id => isElettro(id), allarme: id => id.startsWith("alarm_control_panel."), calendario: id => id.startsWith("calendar."),
  meteo: id => id.startsWith("weather."), persona: id => id.startsWith("person.") || id.startsWith("device_tracker."), controllabile, cover: id => id.startsWith("cover."), clima: id => id.startsWith("climate."),
  scena: id => /^(scene|script)\./.test(id), automazione: id => id.startsWith("automation.") && id !== mEid, echo: id => echi().includes(id),
};
const TITOLI = () => ({ tutto: "🔁 " + t("Quale dispositivo", "Which device"), num: "📈 " + t("Quale valore", "Which value"), apertura: "🚪 " + t("Quale porta o finestra", "Which door or window"),
  movimento: "🏃 " + t("Quale sensore di movimento", "Which motion sensor"), evento: "🔘 " + t("Quale pulsante", "Which button"), elettro: "🧺 " + t("Quale elettrodomestico", "Which appliance"),
  allarme: "🛡️ " + t("Quale allarme", "Which alarm"), calendario: "📅 " + t("Quale calendario", "Which calendar"), meteo: "🌦️ " + t("Quale meteo", "Which weather"), persona: "👤 " + t("Chi", "Who"),
  controllabile: "＋ " + t("Dispositivo", "Device"), cover: "🪟 " + t("Quale tapparella", "Which cover"), clima: "🌡️ " + t("Quale clima", "Which climate"), scena: "🎬 " + t("Scena, script o Momento", "Scene, script or Moment"),
  automazione: "🔁 " + t("Quale automazione", "Which automation"), echo: "🗣️ " + t("Quale Echo", "Which Echo") });
/** i dispositivi scelti come chip (✕ per toglierli) e ＋ per aggiungerne */
function chips(path, f, multi = true, vuoto = "") {
  const L = lista(get(M, path));
  return `<div class="auch1">${L.map(id => `<span class="auch1c">${esc(S[id] ? nm(id) : id)}<button data-act="auTogli" data-k="${path}" data-id="${esc(id)}" aria-label="${t("Togli ", "Remove ")}${esc(S[id] ? nm(id) : id)}">✕</button></span>`).join("")}
    ${multi || !L.length ? `<button class="auch1a" data-act="auPick" data-k="${path}" data-f="${f}" data-m="${multi ? 1 : 0}">＋ ${L.length ? t("Aggiungi", "Add") : vuoto || t("Scegli…", "Choose…")}</button>` : `<button class="auch1a" data-act="auPick" data-k="${path}" data-f="${f}" data-m="0">${t("Cambia", "Change")}</button>`}</div>`;
}
const unita = path => { const id = lista(get(M, path))[0]; return id && unit(id) ? ` (${esc(unit(id))})` : ""; };
const testata = (pre, i, opts, path, n, cls) => `<div class="au3h">${i ? `<span class="au3o">${pre}</span>` : ""}${sel(path + ".tipo", get(M, path + ".tipo"), opts, cls)}${n > 1 || cls === "auCTipo" ? `<button class="dx" data-act="${cls === "auQTipo" ? "auQDel" : "auCDel"}" data-i="${i}" aria-label="${t("Togli", "Remove")}">✕</button>` : ""}</div>`;
function quandoCard(q, i) {
  const p = "quando." + i, per = minutiF(p + ".per", q.per, t("Per almeno (minuti, facoltativo)", "For at least (minutes, optional)"));
  let f = "";
  switch (q.tipo) {
    case "ora": f = campo(t("Ora", "Time"), `<input type="time" value="${esc(q.ora || "07:00")}" data-chg="auF" data-k="${p}.ora">`) + `<small class="muted">${t("I giorni si scelgono in «Solo se → Fascia oraria e giorni».", "Days are chosen in «Only if → Time range and days».")}</small>`; break;
    case "sole": f = `<div class="au3r">${campo(t("Quando", "When"), sel(p + ".evento", q.evento || "sunset", [["sunset", "🌇 " + t("Tramonto", "Sunset")], ["sunrise", "🌅 " + t("Alba", "Sunrise")]]))}
      ${campo(t("Minuti prima (−) o dopo (+)", "Minutes before (−) or after (+)"), numero(p + ".offset", q.offset || 0, 'step="5"'))}</div>`; break;
    case "stato": { const id = lista(q.entita)[0] || "";
      f = chips(p + ".entita", "tutto") + `<div class="au3r">${campo(t("Quando", "When"), sel(p + ".a", q.a || "on", [["on", id ? nomeStato(id, "on") : t("acceso / aperto / rilevato", "on / open / detected")], ["off", id ? nomeStato(id, "off") : t("spento / chiuso / libero", "off / closed / clear")], ...statiPossibili(id).filter(s => !["on", "off"].includes(s)).map(s => [s, nomeStato(id, s)]), ["*", t("qualsiasi cambio", "any change")]]))}${per}</div>`; break; }
    case "soglia": f = chips(p + ".entita", "num") + `<div class="au3r">${campo(t("Quando", "When"), sel(p + ".verso", q.verso || "sopra", [["sopra", t("supera", "goes above")], ["sotto", t("scende sotto", "drops below")]]))}
      ${campo(t("Valore", "Value") + unita(p + ".entita"), numero(p + ".valore", q.valore, 'step="any"'))}${per}</div>`; break;
    case "apertura": f = chips(p + ".entita", "apertura") + minutiF(p + ".min", q.min || 5, t("Aperta da almeno (minuti)", "Open for at least (minutes)")); break;
    case "movimento": f = chips(p + ".entita", "movimento") + `<div class="au3r">${campo(t("Quando", "When"), sel(p + ".modo", q.modo || "rilevato", [["rilevato", t("rileva movimento", "detects motion")], ["nessuno", t("nessuno per N minuti", "nobody for N minutes")]]))}
      ${q.modo === "nessuno" ? minutiF(p + ".min", q.min || 10, t("Minuti senza movimento", "Minutes without motion")) : ""}</div>`; break;
    case "persona": f = chips(p + ".persona", "persona") + campo(t("Quando", "When"), sel(p + ".evento", q.evento || "arriva", [["arriva", t("arriva a casa", "arrives home")], ["esce", t("esce di casa", "leaves home")]])); break;
    case "casa": f = campo(t("Quando", "When"), sel(p + ".evento", q.evento || "ultimo", [["ultimo", t("esce l'ultimo (casa vuota)", "the last one leaves (empty home)")], ["primo", t("arriva il primo (casa non più vuota)", "the first one arrives")]]))
      + `<small class="muted">${t("Conta le persone di Home Assistant che sono nella zona «Casa».", "Counts Home Assistant people in the «Home» zone.")}</small>`; break;
    case "pulsante": {
      if (q.device) { f = `<div class="li"><span class="ic">🔘</span><div class="tx"><b>${fraseDispositivo(q.device)}</b><span>${t("pulsante di un dispositivo", "a device's button")}</span></div><button class="btn sm" data-act="auDevTogli" data-i="${i}">✕</button></div>`; break; }
      const ev = lista(q.entita)[0], tipi = ev ? attr(ev, "event_types") || [] : [];
      f = chips(p + ".entita", "evento", false, t("Pulsante (entità «event»)", "Button (an «event» entity)"))
        + (ev && tipi.length ? campo(t("Quale pressione", "Which press"), sel(p + ".pressione", q.pressione || "", [["", t("qualsiasi", "any")], ...tipi.map(x => [x, nomePressione(x)])])) : "")
        + `<button class="btn sm" style="margin-top:8px" data-act="auDev" data-i="${i}">📟 ${t("Oppure un pulsante di un dispositivo…", "Or a device's button…")}</button>`
        + `<small class="muted" style="display:block;margin-top:6px">${t("Telecomandi e pulsanti Zigbee, Hue, Shelly, IKEA…: scegli il dispositivo e poi il tasto.", "Zigbee, Hue, Shelly, IKEA remotes and buttons: choose the device, then the button.")}</small>`; break; }
    case "elettro": { const el = lista(q.entita)[0], g = el ? soglie(el) : null;
      f = elettrodomestici().length ? chips(p + ".entita", "elettro", false) + (g ? `<small class="muted">${t(`Ha finito quando consuma meno di ${g.off} W per ${g.min} minuti: si regola nella pagina Elettrodomestici (✏️), e l'automazione si aggiorna da sola.`, `It's done when it draws less than ${g.off} W for ${g.min} minutes: set it on the Appliances page (✏️), and the automation updates by itself.`)}</small>` : "")
        : `<p class="small muted">${t("Non trovo elettrodomestici con il sensore del consumo: aggiungili nella pagina Elettrodomestici.", "I can't find appliances with a power sensor: add them on the Appliances page.")}</p>`; break; }
    case "allarme": f = chips(p + ".entita", "allarme") + campo(t("Quando", "When"), sel(p + ".evento", q.evento || "inserito", [["inserito", t("si inserisce", "is armed")], ["disinserito", t("si disinserisce", "is disarmed")], ["scattato", t("scatta", "is triggered")]])); break;
    case "calendario": f = chips(p + ".entita", "calendario", false) + minutiF(p + ".prima", q.prima || "", t("Minuti prima dell'inizio (facoltativo)", "Minutes before it starts (optional)")); break;
    case "pioggia": f = `${chips(p + ".entita", "meteo", false)}<small class="muted">${t("Parte quando il meteo passa a pioggia, rovesci, temporale o grandine.", "It starts when the weather turns to rain, showers, storm or hail.")}</small>`; break;
  }
  return `<div class="au2 au3">${testata(t("oppure", "or"), i, QUANDO(), p, M.quando.length, "auQTipo")}${f}</div>`;
}
function condCard(c, i) {
  const p = "soloSe.cond." + i;
  let f = "";
  switch (c.tipo) {
    case "casa": { const P = persone(); f = `<div class="au3r">${campo(t("Chi", "Who"), sel(p + ".chi", c.chi || "qualcuno", [["qualcuno", t("c'è qualcuno in casa", "someone is home")], ["nessuno", t("non c'è nessuno", "nobody is home")], ...P.map(x => [x, nm(x)])]))}
      ${c.chi && !["qualcuno", "nessuno"].includes(c.chi) ? campo(t("È", "Is"), sel(p + ".dentro", c.dentro === false ? "no" : "si", [["si", t("in casa", "home")], ["no", t("fuori casa", "away")]])) : ""}</div>`; break; }
    case "orario": f = `<div class="au3r">${campo(t("Dalle", "From"), `<input type="time" value="${esc(c.dalle || "")}" data-chg="auF" data-k="${p}.dalle">`)}${campo(t("Alle", "To"), `<input type="time" value="${esc(c.alle || "")}" data-chg="auF" data-k="${p}.alle">`)}</div>
      <div class="vr1" style="margin-top:10px">${GIORNI().map(([k, n]) => `<button class="${(c.giorni || []).includes(k) ? "on" : ""}" data-act="auGiorno" data-i="${i}" data-v="${k}" aria-pressed="${(c.giorni || []).includes(k)}">${n}</button>`).join("")}</div>
      <small class="muted">${t("Nessun giorno scelto = tutti i giorni. Le ore vuote = tutto il giorno.", "No day chosen = every day. Empty times = all day.")}</small>`; break;
    case "sole": f = campo(t("Quando", "When"), sel(p + ".fase", c.fase || "notte", [["giorno", "☀️ " + t("è giorno (sole sopra l'orizzonte)", "it's daytime (sun above the horizon)")], ["notte", "🌙 " + t("è notte", "it's night")]])); break;
    case "stato": { const id = lista(c.entita)[0] || "";
      f = chips(p + ".entita", "tutto", false) + campo(t("È", "Is"), sel(p + ".stato", c.stato ?? "on", statiPossibili(id).map(s => [s, nomeStato(id, s)]))); break; }
    case "valore": f = chips(p + ".entita", "num", false) + `<div class="au3r">${campo(t("È", "Is"), sel(p + ".verso", c.verso || "sopra", [["sopra", t("sopra", "above")], ["sotto", t("sotto", "below")]]))}${campo(t("Valore", "Value") + unita(p + ".entita"), numero(p + ".valore", c.valore, 'step="any"'))}</div>`; break;
  }
  return `<div class="au2 au3">${testata(M.soloSe.modo === "o" ? t("oppure", "or") : t("e", "and"), i, SOLOSE(), p, M.soloSe.cond.length, "auCTipo")}${f}</div>`;
}
const azione = (a, i) => {
  const p = "azioni." + i, L = lista(a.entita), dom = (L[0] || "").split(".")[0], luci = L.some(id => id.startsWith("light."));
  const filtro = { tapparella: "cover", clima: "clima", scena: "scena", automazione: "automazione", allarme: "allarme", alexa: "echo" }[a.tipo] || "controllabile";
  let f = "";
  if (["on", "off", "toggle", "pertempo", "tapparella", "clima", "scena", "automazione", "allarme", "alexa"].includes(a.tipo)) f += chips(p + ".entita", filtro);
  if ((a.tipo === "on" || a.tipo === "pertempo") && luci) f += `<div class="au3r">${campo(t("Luminosità %", "Brightness %"), numero(p + ".lum", a.lum, 'min="1" max="100"'))}
      ${campo(t("Colore", "Colour"), `<span class="au3c ${a.colore ? "" : "vuoto"}"><input type="color" value="${esc(a.colore || "#ffb347")}" data-chg="auF" data-k="${p}.colore" aria-label="${t("Colore", "Colour")}">${a.colore ? `<button class="dx" data-act="auVia" data-k="${p}.colore">✕</button>` : `<small class="muted">${t("facoltativo", "optional")}</small>`}</span>`)}
      ${a.colore ? "" : campo(t("Bianco (K)", "White (K)"), sel(p + ".kelvin", a.kelvin || "", [["", t("come prima", "as before")], ["2700", "2700 K · " + t("caldo", "warm")], ["3500", "3500 K"], ["4000", "4000 K · " + t("neutro", "neutral")], ["5000", "5000 K"], ["6500", "6500 K · " + t("freddo", "cool")]]))}</div>`;
  if (a.tipo === "pertempo") f += minutiF(p + ".minuti", a.minuti || 2, t("Per quanti minuti", "For how many minutes"));
  if (a.tipo === "tapparella") f += campo(t("Apertura %", "Open %") + ` <b>${esc(a.pos ?? 0)}%</b>`, `<input type="range" min="0" max="100" step="5" value="${esc(a.pos ?? 0)}" data-chg="auF" data-k="${p}.pos">`);
  if (a.tipo === "clima") { const modi = [...new Set(L.flatMap(id => attr(id, "hvac_modes") || []))], H = { off: t("Spento", "Off"), heat: t("Caldo", "Heat"), cool: t("Freddo", "Cool"), auto: "Auto", heat_cool: "Auto", dry: t("Deumidifica", "Dry"), fan_only: t("Ventola", "Fan") };
    f += `<div class="au3r">${campo(t("Modalità", "Mode"), sel(p + ".modo", a.modo || "", [["", t("non cambiare", "don't change")], ...(modi.length ? modi : ["heat", "cool", "auto", "off"]).map(x => [x, H[x] || x])]))}${campo(t("Temperatura °", "Temperature °"), numero(p + ".temp", a.temp, 'step="0.5"'))}</div>`; }
  if (a.tipo === "allarme") f += `<div class="au3r">${campo(t("Come", "How"), sel(p + ".modo", a.modo || "alarm_arm_away", [["alarm_arm_away", t("Inserisci fuori casa", "Arm away")], ["alarm_arm_home", t("Inserisci in casa", "Arm home")], ["alarm_arm_night", t("Inserisci notte", "Arm night")], ["alarm_disarm", t("Disinserisci", "Disarm")]]))}
      ${campo(t("Codice (solo se il tuo allarme lo chiede)", "Code (only if your alarm needs it)"), `<input type="password" inputmode="numeric" autocomplete="off" value="${esc(a.codice || "")}" data-chg="auF" data-k="${p}.codice">`)}</div>`;
  if (a.tipo === "notifica") f += campo(t("A chi", "To"), sel(p + ".servizio", a.servizio || "notify", [["notify", t("Tutti i telefoni", "All phones")], ...notifiche().map(k => [k, k.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ")]), ...(a.servizio && a.servizio !== "notify" && !notifiche().includes(a.servizio) ? [[a.servizio, a.servizio]] : [])]))
    + campo(t("Messaggio", "Message"), `<input type="text" value="${esc(a.messaggio || "")}" data-chg="auF" data-k="${p}.messaggio" placeholder="${esc(M.nome || t("Messaggio", "Message"))}">`)
    + `<label class="au3k"><input type="checkbox" ${a.apri ? "checked" : ""} data-chg="auCheck" data-k="${p}.apri"> ${t("Tasto «Apri 'Nduja» nella notifica (app di Home Assistant)", "«Open 'Nduja» button in the notification (Home Assistant app)")}</label>`;
  if (a.tipo === "alexa") f += campo(t("Cosa dire", "What to say"), `<input type="text" value="${esc(a.messaggio || "")}" data-chg="auF" data-k="${p}.messaggio" placeholder="${t("La lavatrice ha finito", "The washer is done")}">`)
    + campo(t("Come", "How"), sel(p + ".modo", a.modo || "announce", [["announce", "📢 " + t("Annuncio (con il suono)", "Announcement (with chime)")], ["tts", "🗣️ " + t("Solo la voce", "Voice only")]]));
  if (a.tipo === "attendi") f += minutiF(p + ".minuti", a.minuti || 5, t("Minuti", "Minutes"));
  if (a.tipo === "scena") f += `<small class="muted">${t("I Momenti sono script: li trovi qui con il loro nome.", "Moments are scripts: you'll find them here by name.")}</small>`;
  return `<div class="au2 au3"><div class="au3h"><b class="au3n">${i + 1}.</b>${sel(p + ".tipo", a.tipo, AZIONI().concat(AZIONI().some(x => x[0] === a.tipo) ? [] : [[a.tipo, a.tipo]]), "auAz")}<button class="dx" data-act="auAzDel" data-i="${i}" aria-label="${t("Togli", "Remove")}">✕</button></div>${f}</div>`;
};
/** editor delle azioni (lo usano anche i Momenti) */
export const editorAzioni = m => `<div class="stack">${m.azioni.map(azione).join("")}</div>
    <button class="add1 au3add" data-act="auAzAdd" style="margin-top:8px"><span>＋</span>${t("Aggiungi un'azione", "Add an action")}</button>`;
function costruttore() {
  const n = M.soloSe.cond.length;
  return `<div class="sh-head"><div><h3>🔁 ${mId ? t("Modifica automazione", "Edit automation") : t("Nuova automazione", "New automation")}</h3><div class="small muted">${t("Si salva in Home Assistant come tutte le altre.", "It's saved in Home Assistant like any other.")}</div></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    ${!mId && ricetteDisponibili().length ? `<button class="btn sm" data-act="auRicette">📚 ${t("Parti da una ricetta", "Start from a recipe")}</button>` : ""}
    ${campo(t("Nome", "Name"), `<input type="text" value="${esc(M.nome)}" data-chg="auF" data-k="nome" placeholder="${t("Luci del giardino al tramonto", "Garden lights at sunset")}">`)}
    <div class="auf1 au1live" aria-live="polite"><span class="auf1t">📖 ${t("Si legge così", "It reads like this")}</span><p>${frase(M)}</p></div>
    <div class="fl1">1 · ${t("Quando", "When")}</div><div class="stack">${M.quando.map(quandoCard).join("")}</div>
    <button class="add1 au3add" data-act="auQAdd"><span>＋</span>${t("Oppure quando…", "Or when…")}</button>
    <div class="fl1">2 · ${t("Solo se (facoltativo)", "Only if (optional)")}</div>
    ${n > 1 ? `<div class="seg" style="margin-bottom:8px">${[["e", t("Tutte vere", "All true")], ["o", t("Ne basta una", "Any one")]].map(([k, x]) => `<button class="${M.soloSe.modo === k ? "act" : ""}" data-act="auModo" data-v="${k}" aria-pressed="${M.soloSe.modo === k}">${x}</button>`).join("")}</div>` : ""}
    <div class="stack">${M.soloSe.cond.map(condCard).join("")}</div>
    <button class="add1 au3add" data-act="auCAdd"><span>＋</span>${t("Aggiungi una condizione", "Add a condition")}</button>
    <div class="fl1">3 · ${t("Allora", "Then")}</div>${editorAzioni(M)}
    <div class="row au1sv"><button class="btn pri" data-act="auSave">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>
      <button class="btn" data-act="auProva">▶ ${t("Prova ora", "Try now")}</button>${mId ? `<button class="btn bad" data-act="auDel">🗑 ${t("Elimina", "Delete")}</button>` : ""}</div>
    <p class="small muted" style="margin-top:8px">${t("«Prova ora» fa subito le azioni, senza aspettare il «Quando» e senza guardare il «Solo se».", "«Try now» does the actions right away, without waiting for the «When» and without checking the «Only if».")}</p>`;
}
let riapri = () => openSheet(costruttore);
/** i Momenti usano lo stesso editor delle azioni: gli passo il loro modello e come riaprire la loro scheda */
export function usaModello(m, r) { M = m; riapri = r; }
const apriCostruttore = (m, id, eid) => { M = normalizza(m); mId = id; mEid = eid; riapri = () => openSheet(costruttore); riapri(); };

/* ---------------- ricette ---------------- */
const RC = { r: null, v: {} };
function schedaRicetta() {
  const r = RC.r; if (!r) return "";
  const m = { v: 2, ...r.crea(RC.v) };
  const f = r.campi().map(c => {
    if (c.tipo === "ent") { const L = RC.v[c.k] || [];
      return `<div class="fld1"><span>${esc(c.titolo)}</span><div class="auch1">${L.map(id => `<span class="auch1c">${esc(S[id] ? nm(id) : id)}<button data-act="auRcTogli" data-k="${c.k}" data-id="${esc(id)}" aria-label="${t("Togli", "Remove")}">✕</button></span>`).join("")}
        ${c.multi || !L.length ? `<button class="auch1a" data-act="auRcPick" data-k="${c.k}">＋ ${L.length ? t("Aggiungi", "Add") : t("Scegli…", "Choose…")}</button>` : ""}</div></div>`; }
    if (c.tipo === "num") return campo(esc(c.titolo), `<input type="number" step="any" value="${esc(RC.v[c.k] ?? "")}" data-chg="auRcF" data-k="${c.k}">`);
    if (c.tipo === "ora") return campo(esc(c.titolo), `<input type="time" value="${esc(RC.v[c.k] || "")}" data-chg="auRcF" data-k="${c.k}">`);
    if (c.tipo === "tel") return campo(esc(c.titolo), sel(c.k, RC.v[c.k] || "notify", [["notify", t("Tutti i telefoni", "All phones")], ...notifiche().map(k => [k, k.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ")])], "auRcF"));
    return campo(esc(c.titolo), `<input type="text" value="${esc(RC.v[c.k] || "")}" data-chg="auRcF" data-k="${c.k}">`);
  }).join("");
  return `<div class="sh-head"><div><h3>${r.ic} ${esc(r.nome())}</h3><div class="small muted">${esc(r.cosa())}</div></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    ${f}
    <div class="auf1 au1live" aria-live="polite"><span class="auf1t">📖 ${t("Si legge così", "It reads like this")}</span><p>${frase(m)}</p></div>
    <div class="row au1sv"><button class="btn pri" data-act="auRcSalva">💾 ${t("Salva subito", "Save now")}</button><button class="btn" data-act="auRcRitocca">✏️ ${t("Ritocca nel costruttore", "Fine-tune in the builder")}</button></div>`;
}
function elencoRicette() {
  return `<div class="sh-head"><div><h3>📚 ${t("Ricette pronte", "Ready-made recipes")}</h3><div class="small muted">${t("Solo quelle per i dispositivi che hai.", "Only the ones for the devices you have.")}</div></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    <div class="aur1">${ricetteDisponibili().map(r => `<button class="aur1b" data-act="auRicetta" data-k="${r.k}"><span aria-hidden="true">${r.ic}</span><b>${esc(r.nome())}</b><small>${esc(r.cosa())}</small></button>`).join("")}</div>`;
}

/* ---------------- salvare in Home Assistant ---------------- */
/** tiene la configurazione di prima di un cambiamento (per «Annulla» e «Rimetti com'era prima»): le ultime 25 */
async function tieniPrima(c, cfg, nome) {
  if (!c || !cfg) return;
  await casaCambia("automazioni", d => { const P = d.prima = { ...(d.prima || {}) }; P[c] = { ts: new Date().toISOString(), cfg, nome };
    const K = Object.keys(P).sort((a, b) => String(P[b].ts).localeCompare(String(P[a].ts))); K.slice(25).forEach(k => delete P[k]); });
}
const scrivi = (c, cfg) => api("POST", "/api/config/automation/config/" + encodeURIComponent(c), cfg);
/** salva un modello in Home Assistant e lo ricorda (per modificarlo di nuovo e per aggiornarlo da solo) */
async function salvaModello(m0, c, { nuova, prima } = {}) {
  const m = normalizza(m0), cfg = inHA(m, c);
  if (prima) await tieniPrima(c, prima, m.nome);
  await scrivi(c, cfg);
  if (nuova) etichettaNduja(() => idsDi("automation").find(e => attr(e, "id") === c));   // nuova: etichetta «'Nduja»
  const mod = { ...m, firma: JSON.stringify(cfg.triggers) };
  await cambia(l => { l.autoModels = { ...(l.autoModels || {}), [c]: mod }; });
  return cfg;
}
/** rimette una configurazione di prima (con il suo modello, se c'era) */
async function rimetti(c, cfg, nome) {
  await scrivi(c, cfg);
  const r = daHA(cfg); await cambia(l => { l.autoModels = { ...(l.autoModels || {}) }; if (r.modificabile) l.autoModels[c] = { ...r.modello, firma: JSON.stringify(inHA(r.modello, c).triggers) }; else delete l.autoModels[c]; });
  for (const id of idsDi("automation")) if (attr(id, "id") === c) dimentica(id);
  toast("↶ " + (nome || cfg.alias || "") + " · " + t("com'era prima", "as it was"));
}
/* gli elettrodomestici: se le soglie cambiano (pagina Elettrodomestici), le automazioni create qui si aggiornano da sole */
let allG = -1, allinea = false;
HOOKS.push(() => {
  if (!isAdmin() || allG === VERS.gen || allinea || !pronto()) return;
  allG = VERS.gen; const Mo = LAYOUT.autoModels || {};
  const da = Object.entries(Mo).filter(([c, m]) => m?.firma && (m.quando || []).some?.(q => q.tipo === "elettro") && idsDi("automation").some(id => attr(id, "id") === c));
  const cambiate = da.filter(([c, m]) => { try { return JSON.stringify(inHA(m, c).triggers) !== m.firma; } catch { return false; } });
  if (!cambiate.length) return;
  allinea = true;
  setTimeout(async () => {
    try { for (const [c, m] of cambiate) { await salvaModello(m, c); } toast("🧺 " + t("Automazioni aggiornate con le nuove soglie degli elettrodomestici", "Automations updated with the new appliance thresholds")); }
    catch (e) { console.warn("nduja allinea", e); } finally { allinea = false; }
  }, 50);
});

/* ---------------- azioni ---------------- */
CHG.auMattina = el => { const v = el.value; if (!/^\d{2}:\d{2}$/.test(v)) return;
  casaCambia("automazioni", d => { if (v === "07:00") delete d.mattina; else d.mattina = v; }, "🌙 " + t("Domattina = alle ", "Tomorrow morning = ") + v); };
CHG.auGruppo = el => { sSet("auGruppo", el.value); render(); };
CHG.auF = el => { const k = el.dataset.k; let v = el.value;
  if (/\.dentro$/.test(k)) v = v !== "no";
  if (/\.chi$/.test(k)) delete get(M, k.replace(/\.chi$/, ""))._vecchio;   // scelta nuova: «chi è in casa» nella forma di oggi
  set(M, k, v); render(); };
CHG.auCheck = el => { set(M, el.dataset.k, el.checked || undefined); render(); };
CHG.auAz = el => { const a = M.azioni[+el.dataset.k.split(".")[1]], tipo = el.value; const tieni = lista(a.entita);
  for (const k of Object.keys(a)) delete a[k]; a.tipo = tipo; a.entita = ["notifica", "attendi"].includes(tipo) ? [] : tieni.filter(id => (FILTRI[{ tapparella: "cover", clima: "clima", scena: "scena", automazione: "automazione", allarme: "allarme", alexa: "echo" }[tipo] || "controllabile"])(id));
  if (tipo === "alexa" && !a.entita.length) a.entita = echi().slice(0, 1); render(); };
CHG.auQTipo = el => { const i = +el.dataset.k.split(".")[1]; M.quando[i] = { tipo: el.value, ...NUOVO_Q(el.value) }; render(); };
CHG.auCTipo = el => { const i = +el.dataset.k.split(".")[2]; M.soloSe.cond[i] = { tipo: el.value, ...NUOVA_C(el.value) }; render(); };
CHG.auRcF = el => { RC.v[el.dataset.k] = el.value; render(); };
Object.assign(ACT, {
  auTile: el => tocca(el.dataset.id),
  auApri: el => { V.det = el.dataset.id; V.aperta = null; openSheet(dettaglio); },
  auPausa: async el => { const id = el.dataset.id, m = +el.dataset.m;
    if (await pausa(id, m)) toast("⏸️ " + nm(id) + " · " + t("in pausa fino a ", "paused until ") + quando(new Date(Date.now() + m * 6e4))); },
  auPausaFino: async el => { const id = el.dataset.id, v = document.getElementById("au1pf")?.value, f = v ? new Date(v) : null, m = f ? Math.round((f - Date.now()) / 6e4) : 0;
    if (!f || isNaN(f) || m < 1) return toast(t("Scegli un momento nel futuro", "Choose a time in the future"), true);
    if (await pausa(id, m)) toast("⏸️ " + nm(id) + " · " + t("in pausa fino a ", "paused until ") + quando(f)); },
  auIcona: el => { const id = el.dataset.id, v = el.dataset.v;
    casaCambia("automazioni", d => { const I = d.icone = { ...(d.icone || {}) }; if (v) I[id] = v; else delete I[id]; if (!Object.keys(I).length) delete d.icone; }, (v || iconaAuto(id)) + " " + nm(id)); },
  auRiprendi: async el => { const id = el.dataset.id; if (await pausa(id, 0)) toast("✅ " + nm(id) + " · " + t("riaccesa", "back on")); },
  auPref: el => { const id = el.dataset.id;
    casaCambia("automazioni", d => { const p = d.preferite = (d.preferite || []).filter(x => x !== id); if (!preferite().includes(id)) p.push(id); },
      preferite().includes(id) ? "☆ " + t("Tolta dalla Home", "Removed from Home") : "⭐ " + t("In Home", "On Home")); },
  auNasc: el => { const id = el.dataset.id, era = nascosta(id);
    casaCambia("automazioni", d => { const n = d.nascoste = (d.nascoste || []).filter(x => x !== id); if (!era) n.push(id); }, era ? "👁 " + nm(id) : "🙈 " + nm(id)); },
  auNascoste: () => { V.nascoste = !V.nascoste; render(); },
  auRun: el => svc("automation", "trigger", { skip_condition: true }, { entity_id: el.dataset.id }).then(() => toast("▶ " + nm(el.dataset.id))),
  auFiltro: el => { V.filtro = el.dataset.v; render(); },
  /* «Spegni tutte» / «Riaccendi tutte» di un gruppo: il secondo tocco conferma */
  auTutte: async el => {
    const g = ULTIMI.find(x => x[0] === el.dataset.k); if (!g) return;
    const on = el.dataset.v === "on", L = g[2].filter(id => on ? (S[id].state !== "on" || pausaFino(id)) : (S[id].state === "on" && !pausaFino(id)));
    if (!L.length || !sicuro(el, on ? t(`Tocca ancora: riaccendi ${L.length}`, `Tap again: turn ${L.length} on`) : t(`Tocca ancora: spegni ${L.length}`, `Tap again: turn ${L.length} off`))) return;
    const pz = L.filter(pausaFino), resto = L.filter(id => !pausaFino(id));
    for (const id of pz) await pausa(id, 0);
    if (resto.length) await svc("automation", on ? "turn_on" : "turn_off", {}, { entity_id: resto });
    toast((on ? "✅ " : "⛔ ") + (on ? t(`${L.length} riaccese`, `${L.length} back on`) : t(`${L.length} spente`, `${L.length} turned off`)) + (g[1] ? " · " + g[1].replace(/^🏷️ /, "") : ""));
  },
  auTraccia: el => { const id = el.dataset.id, k = el.dataset.k; V.aperta = V.aperta === k ? null : k;
    if (V.aperta && !DETTAGLI[k]) { DETTAGLI[k] = { stato: "caricando" };
      ws({ type: "trace/get", domain: "automation", item_id: cfgId(id), run_id: k }).then(tr => { DETTAGLI[k] = { stato: "ok", tr }; render(); }).catch(() => { DETTAGLI[k] = { stato: "errore" }; render(); }); }
    render(); },
  auApriHA: el => { closeSheet(); apriHA("/config/automation/edit/" + encodeURIComponent(cfgId(el.dataset.id) || "")); },
  auNew: () => apriCostruttore(nuovo(), null, null),
  auEdit: el => {
    const id = el.dataset.id, c = cfgId(id), cf = CFG[id];
    if (!isAdmin()) return;
    if (cf?.stato !== "ok") return toast(t("Un attimo: sto leggendo l'automazione", "One moment: reading the automation"));
    const l = lettura(id, cf.cfg, cf.file);
    if (!l.modificabile) { toast(t("Questa si modifica in Home Assistant", "This one is edited in Home Assistant"), true); return; }
    apriCostruttore(l.modello, c, id);
  },
  auDuplica: async el => {
    const id = el.dataset.id, cf = CFG[id]; if (!isAdmin() || cf?.stato !== "ok") return;
    const l = lettura(id, cf.cfg, cf.file);
    if (l.modificabile || l.yaml) { const m = JSON.parse(JSON.stringify(l.modello)); m.nome = (m.nome || nm(id)) + t(" (copia)", " (copy)"); delete m.firma; m.descrizione = undefined; return apriCostruttore(m, null, null); }
    /* non la so riscrivere: la copio così com'è, con un nome nuovo */
    const c = "nduja_" + Date.now().toString(36), cfg = { ...JSON.parse(JSON.stringify(cf.cfg)), id: c, alias: (cf.cfg.alias || nm(id)) + t(" (copia)", " (copy)") };
    try { await scrivi(c, cfg); etichettaNduja(() => idsDi("automation").find(e => attr(e, "id") === c)); closeSheet(); toast("📄 " + cfg.alias); }
    catch (e) { toast(t("Non duplicata: ", "Not duplicated: ") + (e.message || e), true); }
  },
  auPrima: async el => {
    const id = el.dataset.id, c = cfgId(id), p = scelte().prima?.[c]; if (!p || !isAdmin()) return;
    if (!sicuro(el, t("Tocca ancora: rimetti com'era", "Tap again: put it back"))) return;
    try { const ora = CFG[id]?.stato === "ok" ? CFG[id].cfg : await leggiCfg(id).then(r => r.cfg).catch(() => null);
      if (ora) await tieniPrima(c, ora, nm(id));   // così si può tornare anche indietro
      await rimetti(c, p.cfg, nm(id)); }
    catch (e) { toast(t("Non riuscito: ", "Failed: ") + (e.message || e), true); }
  },
  auQAdd: () => { M.quando.push({ tipo: "stato", ...NUOVO_Q("stato") }); render(); },
  auQDel: el => { M.quando.splice(+el.dataset.i, 1); if (!M.quando.length) M.quando.push({ tipo: "ora", ora: "07:00" }); render(); },
  auCAdd: () => { M.soloSe.cond.push({ tipo: "casa", ...NUOVA_C("casa") }); render(); },
  auCDel: el => { M.soloSe.cond.splice(+el.dataset.i, 1); render(); },
  auModo: el => { M.soloSe.modo = el.dataset.v; render(); },
  auGiorno: el => { const c = M.soloSe.cond[+el.dataset.i], g = c.giorni = c.giorni || [], v = el.dataset.v, i = g.indexOf(v); i < 0 ? g.push(v) : g.splice(i, 1);
    const ord = GIORNI().map(x => x[0]); c.giorni.sort((a, b) => ord.indexOf(a) - ord.indexOf(b)); render(); },
  auVia: el => { set(M, el.dataset.k, undefined); render(); },
  auPick: el => { const k = el.dataset.k, f = el.dataset.f, multi = el.dataset.m === "1", keep = M, rp = riapri;
    scegli({ titolo: TITOLI()[f] || "＋", auto: false, attuale: null, filtro: FILTRI[f] || FILTRI.tutto,
      onPick: id => { M = keep; if (id) { const v = lista(get(M, k)); set(M, k, multi ? [...new Set([...v, id])] : id); } rp(); } }); },
  auTogli: el => { const k = el.dataset.k, v = get(M, k); set(M, k, Array.isArray(v) ? v.filter(x => x !== el.dataset.id) : ""); render(); },
  auAzAdd: () => { M.azioni.push({ tipo: "on", entita: [] }); render(); },
  auAzDel: el => { M.azioni.splice(+el.dataset.i, 1); if (!M.azioni.length) M.azioni.push({ tipo: "on", entita: [] }); render(); },
  /* pulsanti dei dispositivi (device trigger): prima il dispositivo, poi il tasto */
  auDev: el => { const i = +el.dataset.i, keep = M; DV.i = i; DV.q = ""; DV.dev = null; DV.L = null; DV.keep = keep; openSheet(schedaDispositivi); },
  auDevTogli: el => { const q = M.quando[+el.dataset.i]; delete q.device; q.entita = []; render(); },
  auDevScegli: async el => { DV.dev = el.dataset.id; DV.L = null; render();
    try { DV.L = (await ws({ type: "device_automation/trigger/list", device_id: DV.dev })) || []; } catch { DV.L = []; } render(); },
  auDevTasto: el => { const tr = { ...DV.L[+el.dataset.i] }; delete tr.platform; delete tr.metadata; M = DV.keep; const q = M.quando[DV.i]; q.device = tr; delete q.entita; delete q.pressione; riapri(); },
  auDevIndietro: () => { if (DV.dev) { DV.dev = null; DV.L = null; render(); } else { M = DV.keep; riapri(); } },
  auSave: async () => {
    const err = controlla(M); if (err) return toast(err, true);
    const nuova = !mId, c = mId || "nduja_" + Date.now().toString(36);
    let prima = null;
    if (!nuova) { const eid = mEid || idsDi("automation").find(e => attr(e, "id") === c); prima = eid && CFG[eid]?.stato === "ok" ? CFG[eid].cfg : eid ? await leggiCfg(eid).then(r => r.cfg).catch(() => null) : null; }
    try {
      await salvaModello(M, c, { nuova, prima });
      if (mEid) dimentica(mEid);
      closeSheet();
      if (prima) toast("💾 " + M.nome, false, [t("Annulla", "Undo"), () => rimetti(c, prima, M.nome).catch(e => toast(t("Non riuscito: ", "Failed: ") + (e.message || e), true))]);
      else toast("💾 " + M.nome);
    } catch (e) { toast(t("Non salvata: ", "Not saved: ") + (e.message || e), true); }
  },
  auProva: async () => {
    const seq = azioniHA(normalizza(M)); if (!seq.length) return toast(t("Aggiungi almeno un'azione con i dispositivi", "Add at least one action with devices"), true);
    try { await ws({ type: "execute_script", sequence: seq }); toast("▶ " + t("Fatto: azioni eseguite", "Done: actions run")); }
    catch (e) { toast(t("Prova non riuscita: ", "Try failed: ") + (e.message || e.code || e), true); }
  },
  auDel: async el => {
    if (!sicuro(el, t("Tocca ancora: elimina da Home Assistant", "Tap again: delete from Home Assistant"))) return;
    const c = mId, eid = mEid || idsDi("automation").find(e => attr(e, "id") === c), nome = M.nome;
    const prima = eid && CFG[eid]?.stato === "ok" ? CFG[eid].cfg : eid ? await leggiCfg(eid).then(r => r.cfg).catch(() => null) : null;
    try {
      if (prima) await tieniPrima(c, prima, nome);
      await api("DELETE", "/api/config/automation/config/" + encodeURIComponent(c));
      await cambia(l => { if (l.autoModels) { l.autoModels = { ...l.autoModels }; delete l.autoModels[c]; } });
      if (eid) dimentica(eid); closeSheet();
      toast("🗑 " + nome, false, prima ? [t("Annulla", "Undo"), () => rimetti(c, prima, nome).catch(e => toast(t("Non riuscito: ", "Failed: ") + (e.message || e), true))] : undefined);
    } catch (e) { toast(t("Non eliminata: ", "Not deleted: ") + (e.message || e), true); }
  },
  /* ricette */
  auRicette: () => openSheet(elencoRicette),
  auRicetta: el => { const r = ricetteDisponibili().find(x => x.k === el.dataset.k); if (!r) return; RC.r = r; RC.v = valoriIniziali(r); openSheet(schedaRicetta); },
  auRcPick: el => { const k = el.dataset.k, c = RC.r.campi().find(x => x.k === k);
    scegli({ titolo: "＋ " + c.titolo, auto: false, attuale: null, filtro: c.filtro, onPick: id => { if (id) RC.v[k] = c.multi ? [...new Set([...(RC.v[k] || []), id])] : [id]; openSheet(schedaRicetta); } }); },
  auRcTogli: el => { const k = el.dataset.k; RC.v[k] = (RC.v[k] || []).filter(x => x !== el.dataset.id); render(); },
  auRcRitocca: () => { const err = mancaRicetta(RC.r, RC.v); if (err) return toast(err, true); apriCostruttore({ v: 2, ...RC.r.crea(RC.v) }, null, null); },
  auRcSalva: async () => {
    const err = mancaRicetta(RC.r, RC.v); if (err) return toast(err, true);
    const m = normalizza({ v: 2, ...RC.r.crea(RC.v) }), e2 = controlla(m); if (e2) return toast(e2, true);
    try { await salvaModello(m, "nduja_" + Date.now().toString(36), { nuova: true }); closeSheet(); toast("💾 " + m.nome); }
    catch (e) { toast(t("Non salvata: ", "Not saved: ") + (e.message || e), true); }
  },
});

/* ---------------- scelta di un pulsante di un dispositivo ---------------- */
const DV = { i: 0, q: "", dev: null, L: null, keep: null };
const PULS = /remote|button|switch|dimmer|telecomand|pulsant|tasto|click|tradfri|styrbar|rodret|somrig|aqara|wxkg|hue.*(dimmer|tap|button)|shelly.*(i3|i4|button)|zigbee.*(remote|button)/i;
function schedaDispositivi() {
  const q = DV.q.toLowerCase();
  if (DV.dev) {
    const L = DV.L, d = DEVICES[DV.dev] || {};
    const etich = tr => { const x = String(tr.type || "").replace(/^remote_button_|^button_/, ""), sub = tr.subtype ? String(tr.subtype).replace(/_/g, " ") : ""; return [sub, nomePressione(x)].filter(Boolean).join(" · ") || tr.type; };
    return `<div class="sh-head"><div><h3>📟 ${esc(d.name || "")}</h3><div class="small muted">${t("Scegli il tasto e la pressione", "Choose the button and the press")}</div></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
      <button class="btn sm" data-act="auDevIndietro">‹ ${t("Altri dispositivi", "Other devices")}</button>
      ${L == null ? `<p class="small muted">${t("Leggo i tasti…", "Reading the buttons…")}</p>` : !L.length ? empty(t("Questo dispositivo non ha pulsanti da usare come «Quando».", "This device has no buttons to use as «When».")) :
        `<div class="pkl1" style="margin-top:10px">${L.map((tr, i) => `<button class="pk1" data-act="auDevTasto" data-i="${i}"><span class="tx"><b>${esc(etich(tr))}</b><small>${esc(tr.domain || "")}</small></span></button>`).join("")}</div>`}`;
  }
  const D = Object.entries(DEVICES).filter(([, d]) => !d.disabled && (!q || (d.name + " " + (d.model || "") + " " + (d.maker || "")).toLowerCase().includes(q)));
  const sug = D.filter(([, d]) => PULS.test((d.name || "") + " " + (d.model || ""))), altri = D.filter(x => !sug.includes(x)).sort((a, b) => String(a[1].name).localeCompare(String(b[1].name), LOC)).slice(0, 150);
  const riga = ([id, d]) => `<button class="pk1" data-act="auDevScegli" data-id="${esc(id)}"><span class="tx"><b>${esc(d.name || id)}</b><small>${esc([d.maker, d.model, AREAS[d.area]?.name].filter(Boolean).join(" · "))}</small></span><span class="st">›</span></button>`;
  return `<div class="sh-head"><div><h3>📟 ${t("Pulsante di un dispositivo", "A device's button")}</h3><div class="small muted">${t("Prima il dispositivo, poi il tasto.", "First the device, then the button.")}</div></div><button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    <button class="btn sm" data-act="auDevIndietro">‹ ${t("Torna all'automazione", "Back to the automation")}</button>
    <input id="au1dq" class="pk1q" type="search" placeholder="🔍 ${t("Cerca per nome o modello…", "Search by name or model…")}" value="${esc(DV.q)}" autocomplete="off" style="margin-top:10px">
    ${sug.length ? `<div class="fl1 sug1h">✨ ${t("Sembrano pulsanti o telecomandi", "Look like buttons or remotes")}</div><div class="pkl1">${sug.map(riga).join("")}</div>` : ""}
    ${altri.length ? `<div class="fl1">${t("Tutti i dispositivi", "All devices")}</div><div class="pkl1">${altri.map(riga).join("")}</div>` : ""}
    ${!D.length ? empty(t("Nessun risultato.", "No results.")) : ""}`;
}
document.addEventListener("input", e => { if (e.target.id === "au1dq") { DV.q = e.target.value; render(); } });

/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("Le automazioni con un interruttore ciascuna, la pausa, la cronologia e un costruttore semplice con le ricette pronte.", "Automations with a switch each, pause, history and a simple builder with ready-made recipes."),
  serve: t("Almeno un'automazione in Home Assistant: la puoi creare anche dalla plancia.", "At least one automation in Home Assistant: you can create it from the dashboard too."),
  passi: [t("Apri Automazioni e premi ＋ o scegli una ricetta, oppure creala in Impostazioni → Automazioni e scene.", "Open Automations and press ＋ or pick a recipe, or create it in Settings → Automations & scenes.")],
  link: [[t("Automazioni", "Automations"), myHA("automations")]] };
page("automazioni", { richiede: RICHIEDE, title: t("Automazioni", "Automations"), short: t("Automaz.", "Automations"), icon: "🔁", order: 80, show: () => allEnts("automation").length > 0 || isAdmin(), render: pagina });

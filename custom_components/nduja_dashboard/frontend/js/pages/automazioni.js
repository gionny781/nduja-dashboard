/* Automazioni: un tasto per ogni automazione di Home Assistant — tocchi e si accende o si spegne; con ⋯ la metti
   in pausa (1 ora, 4 ore, fino a domattina: Home Assistant la riaccende da solo), la esegui, la porti in Home o la nascondi.
   e un costruttore semplice per crearne di nuove senza uscire dalla plancia:
   QUANDO (ora, un dispositivo cambia, alba/tramonto, qualcuno arriva o esce) → SOLO SE (facoltativo) → ALLORA (azioni).
   Le automazioni create qui si salvano in Home Assistant (automations.yaml) e si possono modificare anche qui. */
import { S, ACT, CHG, LAYOUT, UI, HOME_EXTRA, t, esc, nm, ok, attr, ents, allEnts, ago, hhmm, card, empty, page, svc, toast, openSheet, closeSheet,
  render, isAdmin, api, apriHA, ws, cached, LOC, etichettaNduja } from "../core.js";
import { casa, casaCambia } from "../casa.js";
import { scegli, cambia } from "../edit.js";

const V = { q: "", filtro: "tutte", nascoste: false, menu: null };
const autos = () => allEnts("automation").sort((a, b) => nm(a).localeCompare(nm(b), LOC));

/* pause (le gestisce Home Assistant) e scelte condivise: preferite in Home, nascoste dai tasti */
const pause = () => casa("pause")?.dati || {};
const scelte = () => casa("automazioni")?.dati || {};
const preferite = () => (scelte().preferite || []).filter(id => S[id]);
const nascosta = id => (scelte().nascoste || []).includes(id);
const pausaFino = id => { const f = pause()[id], d = f ? new Date(f) : null; return d && d > Date.now() ? d : null; };
const quando = d => { const oggi = new Date(), dom = new Date(Date.now() + 864e5);
  return d.toDateString() === oggi.toDateString() ? hhmm(d) : d.toDateString() === dom.toDateString() ? t("domani ", "tomorrow ") + hhmm(d) : d.toLocaleDateString(LOC, { day: "numeric", month: "short" }) + " " + hhmm(d); };

/* un'icona che si capisce al volo, dal nome dell'automazione */
const ICONE = [[/luc|light|lamp|neon|led/, "💡"], [/nott|night|dorm|sleep|buonanott/, "🌙"], [/matt|sveglia|morning|alba|sunrise/, "🌅"], [/tramont|sera|sunset|evening/, "🌇"],
  [/irrig|giardin|prato|water|sprink/, "💧"], [/allarm|alarm|sicur|security|intrus/, "🛡️"], [/tappar|tend|cover|blind|shutter|persian/, "🪟"],
  [/clima|risc|termo|caldo|freddo|temp|heat|cool|condiz|aria/, "🌡️"], [/notif|avvis|messag|telegram|alert/, "🔔"], [/cancell|garage|gate|porta|door|serrat|lock/, "🚪"],
  [/arriv|casa|home|esco|uscit|leave|presen/, "🏠"], [/energ|solar|fotovolt|batter|consum|power|carica|charg/, "⚡"], [/lavatr|lavastov|forno|asciug|washer|dryer|oven/, "🧺"],
  [/aspirap|robot|vacuum|pulizi/, "🧹"], [/music|radio|tv|media|film|spotify|sonos/, "🎵"], [/\bauto\b|tesla|macchin/, "🚗"], [/telecam|camera|video/, "📷"], [/meteo|pioggia|vento|rain|wind/, "🌦️"]];
const icona = id => { const n = (nm(id) + " " + id.split(".")[1]).toLowerCase(); return (ICONE.find(([r]) => r.test(n)) || [0, "⚡"])[1]; };

/** un tasto: tocchi ovunque e cambia; ⋯ per le altre scelte */
function tasto(id) {
  const on = S[id].state === "on", pz = pausaFino(id), lt = attr(id, "last_triggered");
  const sub = pz ? "⏸ " + t("in pausa fino a ", "paused until ") + quando(pz)
    : !on ? t("spenta", "off")
    : attr(id, "current") ? "▶ " + t("in corso", "running")
    : lt ? t("attiva · partita ", "on · ran ") + ago(lt) : t("attiva · mai partita", "on · never ran");
  return `<div class="aut ${on ? "on" : ""} ${pz ? "pz" : ""}">
    <button class="aut-m" data-act="auTile" data-id="${id}" aria-pressed="${on}" aria-label="${esc(nm(id))}: ${on ? t("attiva, tocca per spegnere", "on, tap to turn off") : t("spenta, tocca per accendere", "off, tap to turn on")}">
      <span class="aut-i">${icona(id)}</span><span class="aut-t"><b>${esc(nm(id))}</b><small>${esc(sub)}</small></span>
      <span class="sw ${on ? "on" : ""}" aria-hidden="true"><i></i></span></button>
    <button class="aut-x" data-act="auMenu" data-id="${id}" aria-label="${t("Altre scelte per ", "More for ")}${esc(nm(id))}">⋯</button></div>`;
}

function pagina() {
  const A = autos(), q = V.q.toLowerCase(), P = pause();
  const visibili = A.filter(id => V.nascoste || !nascosta(id)), nNasc = A.filter(nascosta).length;
  const L = visibili.filter(id => (!q || (nm(id) + id).toLowerCase().includes(q)) && (V.filtro === "tutte"
    || (V.filtro === "attive" && S[id].state === "on") || (V.filtro === "spente" && S[id].state !== "on" && !pausaFino(id)) || (V.filtro === "pausa" && !!pausaFino(id))));
  const nOn = A.filter(id => S[id].state === "on").length, nPz = A.filter(id => P[id] && pausaFino(id)).length;
  const filtri = [["tutte", t("Tutte", "All")], ["attive", t("Attive", "On")], ["spente", t("Spente", "Off")], ...(nPz ? [["pausa", "⏸ " + t("In pausa", "Paused")]] : [])];
  return `<div class="g">
    <section class="card"><div class="ch"><h2>🔁 ${t("Automazioni", "Automations")} <span class="tag info">${nOn}/${A.length}</span></h2>${isAdmin() ? `<button class="btn pri" data-act="auNew">＋ ${t("Nuova automazione", "New automation")}</button>` : ""}</div>
      <p class="small muted" style="margin:0 0 12px">${t("Tocca un tasto per accendere o spegnere un'automazione. Con ⋯ la metti in pausa: Home Assistant la riaccende da solo.", "Tap a button to turn an automation on or off. Use ⋯ to pause it: Home Assistant turns it back on by itself.")}</p>
      ${A.length > 6 ? `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><input id="au1q" class="pk1q" style="flex:1;min-width:180px;margin:0" type="search" placeholder="🔍 ${t("Cerca…", "Search…")}" value="${esc(V.q)}">
        <div class="seg">${filtri.map(([k, n]) => `<button class="${V.filtro === k ? "act" : ""}" data-act="auFiltro" data-v="${k}">${n}</button>`).join("")}</div></div>` : ""}
      ${L.length ? `<div class="autg">${L.map(tasto).join("")}</div>` : empty(A.length ? t("Nessun risultato.", "No results.") : t("Non hai ancora automazioni: creane una con ＋.", "No automations yet: create one with ＋."))}
      ${nNasc ? `<button class="btn ghost sm" style="margin-top:12px" data-act="auNascoste">${V.nascoste ? "🙈 " + t("Nascondi di nuovo", "Hide again") : "👁 " + t(`Mostra le nascoste (${nNasc})`, `Show hidden (${nNasc})`)}</button>` : ""}
    </section></div>`;
}

/* ⋯ : pausa, esegui, Home, nascondi, modifica */
const minutiADomattina = () => { const d = new Date(); d.setDate(d.getDate() + (d.getHours() >= 7 ? 1 : 0)); d.setHours(7, 0, 0, 0); return Math.max(1, Math.round((d - Date.now()) / 6e4)); };
function menu() {
  const id = V.menu; if (!id || !S[id]) return "";
  const on = S[id].state === "on", pz = pausaFino(id), pref = preferite().includes(id), nas = nascosta(id);
  const op = (act, txt, extra = "", cls = "") => `<button class="btn ${cls}" data-act="${act}" data-id="${id}" ${extra}>${txt}</button>`;
  return `<div class="sh-head"><div><h3>${icona(id)} ${esc(nm(id))}</h3><div class="small muted">${pz ? "⏸ " + t("in pausa fino a ", "paused until ") + quando(pz) : on ? t("attiva", "on") : t("spenta", "off")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("Metti in pausa", "Pause")}</div>
    <div class="aut-op">
      ${op("auPausa", "⏸ " + t("1 ora", "1 hour"), 'data-m="60"')}${op("auPausa", "⏸ " + t("4 ore", "4 hours"), 'data-m="240"')}
      ${op("auPausa", "🌙 " + t("Fino a domattina", "Until tomorrow morning"), `data-m="${minutiADomattina()}"`)}${op("auPausa", "📅 " + t("Una settimana", "One week"), 'data-m="10080"')}
    </div>
    <small class="muted">${t("Dopo la pausa Home Assistant la riaccende da solo, anche se la plancia è chiusa.", "After the pause Home Assistant turns it back on by itself, even with the dashboard closed.")}</small>
    <div class="fl1">${t("Altro", "More")}</div>
    <div class="aut-op">
      ${pz ? op("auRiprendi", "▶ " + t("Riaccendi adesso", "Turn back on now"), "", "pri") : op("auTile", on ? "⛔ " + t("Spegni", "Turn off") : "✅ " + t("Accendi", "Turn on"))}
      ${op("auRun", "▶ " + t("Esegui adesso", "Run now"))}
      ${op("auPref", pref ? "⭐ " + t("Togli dalla Home", "Remove from Home") : "☆ " + t("Mostra in Home", "Show on Home"))}
      ${op("auNasc", nas ? "👁 " + t("Rimetti tra i tasti", "Show again") : "🙈 " + t("Nascondi da qui", "Hide from here"))}
      ${isAdmin() ? op("auEdit", "✏️ " + t("Modifica", "Edit")) : ""}
    </div>`;
}
async function pausa(id, minuti) {
  try {
    await ws({ type: "nduja_dashboard/pausa", entity_id: id, minuti });
    return true;
  } catch (e) {
    toast(/unknown_command|unknown command/i.test(e?.code || e?.message || "") ? t("Aggiorna e riavvia Home Assistant per usare le pause", "Update and restart Home Assistant to use pauses") : t("Non riuscito: ", "Failed: ") + (e?.message || e?.code || e), true);
    return false;
  }
}

/* Home: le automazioni preferite, come tasti */
function homeCard() {
  const L = preferite(); if (!L.length) return "";
  return card("🔁 " + t("Automazioni", "Automations"), `<div class="autg sm">${L.map(tasto).join("")}</div>`, { link: [t("Tutte", "All"), "automazioni"] });
}
HOME_EXTRA.automazioni = { title: () => t("Automazioni", "Automations"), render: homeCard, show: () => preferite().length > 0 };
document.addEventListener("input", e => { if (e.target.id === "au1q") { V.q = e.target.value; render(); } });

/* ---------------- costruttore ---------------- */
const GIORNI = () => [["mon", t("Lun", "Mon")], ["tue", t("Mar", "Tue")], ["wed", t("Mer", "Wed")], ["thu", t("Gio", "Thu")], ["fri", t("Ven", "Fri")], ["sat", t("Sab", "Sat")], ["sun", t("Dom", "Sun")]];
const QUANDO = () => [["ora", "🕐 " + t("A un'ora", "At a time")], ["stato", "🔁 " + t("Un dispositivo cambia", "A device changes")], ["sole", "🌅 " + t("Alba o tramonto", "Sunrise or sunset")], ["persona", "🏠 " + t("Qualcuno arriva o esce", "Someone arrives or leaves")]];
const AZIONI = () => [["on", "✅ " + t("Accendi", "Turn on")], ["off", "⛔ " + t("Spegni", "Turn off")], ["toggle", "🔁 " + t("Commuta", "Toggle")], ["scena", "🎬 " + t("Attiva scena o script", "Run scene or script")], ["allarme", "🛡️ " + t("Allarme", "Alarm")], ["notifica", "🔔 " + t("Manda una notifica", "Send a notification")], ["attendi", "⏳ " + t("Aspetta", "Wait")]];
let M = null, mId = null;
const nuovo = () => ({ nome: "", quando: { tipo: "ora", ora: "07:00", giorni: [] }, soloSe: { dalle: "", alle: "", casa: "" }, azioni: [{ tipo: "on", entita: [] }] });
const controllabile = id => /^(light|switch|fan|cover|climate|media_player|input_boolean|lock|vacuum|humidifier|siren|valve)\./.test(id);
const notifiche = () => { const s = cached("services", 3600e3, () => ws({ type: "get_services" })) || {}; return Object.keys(s.notify || {}).filter(k => k !== "send_message" && k !== "persistent_notification").sort(); };

const azione = (a, i) => `<div class="au2"><div class="row between"><b>${i + 1}.</b><button class="dx" data-act="auAzDel" data-i="${i}">✕</button></div>
    <label class="fld1"><span>${t("Cosa fare", "What to do")}</span><select data-chg="auAz" data-i="${i}" data-k="tipo">${AZIONI().map(([k, n]) => `<option value="${k}" ${a.tipo === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    ${a.tipo === "allarme" ? `<label class="fld1"><span>${t("Come", "How")}</span><select data-chg="auAz" data-i="${i}" data-k="modo">${[["alarm_arm_away", t("Inserisci fuori casa", "Arm away")], ["alarm_arm_home", t("Inserisci in casa", "Arm home")], ["alarm_arm_night", t("Inserisci notte", "Arm night")], ["alarm_disarm", t("Disinserisci", "Disarm")]].map(([k, n]) => `<option value="${k}" ${(a.modo || "alarm_arm_away") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="fld1"><span>${t("Codice (solo se il tuo allarme lo chiede)", "Code (only if your alarm needs it)")}</span><input type="password" inputmode="numeric" autocomplete="off" value="${esc(a.codice || "")}" data-chg="auAz" data-i="${i}" data-k="codice"></label>` : ""}
    ${["on", "off", "toggle", "scena", "allarme"].includes(a.tipo) ? `<button class="li" data-act="auPickAz" data-i="${i}"><div class="tx"><b>${(a.entita || []).map(id => esc(nm(id))).join(", ") || t("Scegli i dispositivi…", "Choose devices…")}</b><span>${t("puoi sceglierne più di uno", "you can choose more than one")}</span></div><span class="st">＋</span></button>` : ""}
    ${a.tipo === "on" && (a.entita || []).some(id => id.startsWith("light.")) ? `<label class="fld1"><span>${t("Luminosità % (facoltativa)", "Brightness % (optional)")}</span><input type="number" min="1" max="100" value="${a.lum || ""}" data-chg="auAz" data-i="${i}" data-k="lum"></label>` : ""}
    ${a.tipo === "notifica" ? `<label class="fld1"><span>${t("A chi", "To")}</span><select data-chg="auAz" data-i="${i}" data-k="servizio">${["notify", ...notifiche()].map(k => `<option value="${k}" ${a.servizio === k ? "selected" : ""}>${k === "notify" ? t("Tutti i telefoni", "All phones") : esc(k.replace(/^mobile_app_/, "📱 ").replace(/_/g, " "))}</option>`).join("")}</select></label>
      <label class="fld1"><span>${t("Messaggio", "Message")}</span><input type="text" value="${esc(a.messaggio || "")}" data-chg="auAz" data-i="${i}" data-k="messaggio"></label>` : ""}
    ${a.tipo === "attendi" ? `<label class="fld1"><span>${t("Minuti", "Minutes")}</span><input type="number" min="1" value="${a.minuti || 5}" data-chg="auAz" data-i="${i}" data-k="minuti"></label>` : ""}</div>`;
/** editor delle azioni (usato anche dai Momenti) */
export const editorAzioni = m => `<div class="stack">${m.azioni.map(azione).join("")}</div>
    <button class="add1" data-act="auAzAdd" style="margin-top:8px"><span>＋</span>${t("Aggiungi azione", "Add action")}</button>`;
function costruttore() {
  const q = M.quando, sel = (k, v, opts) => `<select data-chg="auF" data-k="${k}">${opts.map(([a, b]) => `<option value="${a}" ${v === a ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>`;
  const ent = (k, v, multi) => `<button class="li" data-act="auPick" data-k="${k}" data-m="${multi ? 1 : 0}"><div class="tx"><b>${(Array.isArray(v) ? v : v ? [v] : []).map(id => esc(nm(id))).join(", ") || t("Scegli…", "Choose…")}</b><span>${t("tocca per scegliere", "tap to choose")}</span></div><span class="st">›</span></button>`;
  const quando = q.tipo === "ora" ? `<label class="fld1"><span>${t("Ora", "Time")}</span><input type="time" value="${q.ora || "07:00"}" data-chg="auF" data-k="quando.ora"></label>
      <div class="vr1">${GIORNI().map(([k, n]) => `<button class="${(q.giorni || []).includes(k) ? "on" : ""}" data-act="auGiorno" data-v="${k}">${n}</button>`).join("")}</div><small class="muted">${t("Nessun giorno scelto = tutti i giorni.", "No day chosen = every day.")}</small>`
    : q.tipo === "stato" ? `${ent("quando.entita", q.entita)}<label class="fld1"><span>${t("Quando diventa", "When it becomes")}</span>${sel("quando.a", q.a || "on", [["on", t("acceso / aperto / rilevato", "on / open / detected")], ["off", t("spento / chiuso / libero", "off / closed / clear")], ["*", t("qualsiasi cambio", "any change")]])}</label>
      <label class="fld1"><span>${t("Per almeno (minuti, facoltativo)", "For at least (minutes, optional)")}</span><input type="number" min="0" value="${q.per || ""}" data-chg="auF" data-k="quando.per"></label>`
    : q.tipo === "sole" ? `<label class="fld1"><span>${t("Evento", "Event")}</span>${sel("quando.evento", q.evento || "sunset", [["sunrise", "🌅 " + t("Alba", "Sunrise")], ["sunset", "🌇 " + t("Tramonto", "Sunset")]])}</label>
      <label class="fld1"><span>${t("Spostamento in minuti (es. -30 = mezz'ora prima)", "Offset in minutes (e.g. -30 = half an hour before)")}</span><input type="number" value="${q.offset || 0}" data-chg="auF" data-k="quando.offset"></label>`
    : `${ent("quando.persona", q.persona)}<label class="fld1"><span>${t("Quando", "When")}</span>${sel("quando.evento", q.evento || "arriva", [["arriva", t("arriva a casa", "arrives home")], ["esce", t("esce di casa", "leaves home")]])}</label>`;
  return `<div class="sh-head"><div><h3>🔁 ${mId ? t("Modifica automazione", "Edit automation") : t("Nuova automazione", "New automation")}</h3><div class="small muted">${t("Si salva in Home Assistant come tutte le altre.", "It's saved in Home Assistant like any other.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input type="text" value="${esc(M.nome)}" data-chg="auF" data-k="nome" placeholder="${t("Luci del giardino al tramonto", "Garden lights at sunset")}"></label>
    <div class="fl1">1 · ${t("Quando", "When")}</div><div class="seg" style="flex-wrap:wrap;margin-bottom:8px">${QUANDO().map(([k, n]) => `<button class="${q.tipo === k ? "act" : ""}" data-act="auQuando" data-v="${k}">${n}</button>`).join("")}</div>${quando}
    <div class="fl1">2 · ${t("Solo se (facoltativo)", "Only if (optional)")}</div>
    <div class="row" style="gap:10px"><label class="fld1" style="flex:1"><span>${t("Dalle", "From")}</span><input type="time" value="${M.soloSe.dalle || ""}" data-chg="auF" data-k="soloSe.dalle"></label><label class="fld1" style="flex:1"><span>${t("Alle", "To")}</span><input type="time" value="${M.soloSe.alle || ""}" data-chg="auF" data-k="soloSe.alle"></label></div>
    <label class="fld1"><span>${t("Chi è in casa", "Who's home")}</span>${sel("soloSe.casa", M.soloSe.casa || "", [["", t("non importa", "doesn't matter")], ["qualcuno", t("c'è qualcuno", "someone is home")], ["nessuno", t("non c'è nessuno", "nobody is home")]])}</label>
    <div class="fl1">3 · ${t("Allora", "Then")}</div>${editorAzioni(M)}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="auSave">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${mId ? `<button class="btn bad" data-act="auDel">🗑 ${t("Elimina", "Delete")}</button>` : ""}</div>`;
}

/** dal modello semplice alla configurazione di Home Assistant */
function inHA(m, id) {
  const q = m.quando, trig = [], cond = [], act = [];
  if (q.tipo === "ora") { trig.push({ trigger: "time", at: (q.ora || "07:00") + ":00" }); if ((q.giorni || []).length) cond.push({ condition: "time", weekday: q.giorni }); }
  if (q.tipo === "stato") { const tr = { trigger: "state", entity_id: [q.entita].flat().filter(Boolean) }; if ((q.a || "on") !== "*") tr.to = q.a || "on"; if (+q.per) tr.for = { minutes: +q.per }; trig.push(tr); }
  if (q.tipo === "sole") { const o = +q.offset || 0, hh = String(Math.floor(Math.abs(o) / 60)).padStart(2, "0"), mm = String(Math.abs(o) % 60).padStart(2, "0"); trig.push({ trigger: "sun", event: q.evento || "sunset", offset: `${o < 0 ? "-" : ""}${hh}:${mm}:00` }); }
  if (q.tipo === "persona") trig.push({ trigger: "zone", entity_id: [q.persona].flat().filter(Boolean), zone: "zone.home", event: q.evento === "esce" ? "leave" : "enter" });
  if (m.soloSe.dalle || m.soloSe.alle) cond.push({ condition: "time", ...(m.soloSe.dalle ? { after: m.soloSe.dalle + ":00" } : {}), ...(m.soloSe.alle ? { before: m.soloSe.alle + ":00" } : {}) });
  const P = allEnts("person");
  if (m.soloSe.casa === "qualcuno" && P.length) cond.push({ condition: "or", conditions: P.map(p => ({ condition: "state", entity_id: p, state: "home" })) });
  if (m.soloSe.casa === "nessuno" && P.length) cond.push({ condition: "and", conditions: P.map(p => ({ condition: "not", conditions: [{ condition: "state", entity_id: p, state: "home" }] })) });
  act.push(...azioniHA(m));
  return { id, alias: m.nome, description: t("Creata con 'Nduja Dashboard", "Created with 'Nduja Dashboard"), triggers: trig, conditions: cond, actions: act, mode: "single" };
}
/** azioni del modello → azioni di Home Assistant (usato anche dai Momenti, che diventano script) */
export function azioniHA(m) {
  const act = [];
  for (const a of m.azioni) {
    const E = (a.entita || []).filter(Boolean);
    if (["on", "off", "toggle"].includes(a.tipo) && E.length) {
      for (const dom of [...new Set(E.map(x => x.split(".")[0]))]) {
        const ids = E.filter(x => x.startsWith(dom + ".")), srv = dom === "cover" ? { on: "open_cover", off: "close_cover", toggle: "toggle" }[a.tipo] : dom === "lock" ? { on: "unlock", off: "lock", toggle: "lock" }[a.tipo] : dom === "vacuum" ? { on: "start", off: "return_to_base", toggle: "start" }[a.tipo] : "turn_" + a.tipo.replace("turn_", "");
        act.push({ action: `${dom}.${a.tipo === "toggle" && !["cover", "lock", "vacuum"].includes(dom) ? "toggle" : srv}`, target: { entity_id: ids }, ...(dom === "light" && a.tipo === "on" && +a.lum ? { data: { brightness_pct: +a.lum } } : {}) });
      }
    }
    if (a.tipo === "allarme" && E.length) act.push({ action: "alarm_control_panel." + (a.modo || "alarm_arm_away"), target: { entity_id: E }, ...(a.codice ? { data: { code: a.codice } } : {}) });
    if (a.tipo === "scena" && E.length) act.push({ action: E[0].startsWith("script.") ? "script.turn_on" : "scene.turn_on", target: { entity_id: E } });
    if (a.tipo === "notifica") act.push({ action: "notify." + (a.servizio || "notify"), data: { message: a.messaggio || m.nome, title: "🌶️ " + m.nome } });
    if (a.tipo === "attendi") act.push({ delay: { minutes: +a.minuti || 5 } });
  }
  return act;
}
const set = (o, path, v) => { const k = path.split("."); let x = o; while (k.length > 1) x = x[k.shift()]; x[k[0]] = v; };
CHG.auF = el => { set(M, el.dataset.k, el.value); if (el.tagName === "SELECT") render(); };
CHG.auAz = el => { M.azioni[+el.dataset.i][el.dataset.k] = el.value; if (el.tagName === "SELECT") render(); };
let riapri = () => openSheet(costruttore);
/** i Momenti usano lo stesso editor delle azioni: gli passo il loro modello e come riaprire la loro scheda */
export function usaModello(m, r) { M = m; riapri = r; }
Object.assign(ACT, {
  auToggle: el => { const id = el.dataset.id; svc("automation", S[id].state === "on" ? "turn_off" : "turn_on", {}, { entity_id: id }); },
  /* tocco sul tasto: accende/spegne (se era in pausa, toglie la pausa e la riaccende) */
  auTile: async el => {
    const id = el.dataset.id; if (!S[id]) return;
    if (UI.sheet === menu) closeSheet();
    if (pausaFino(id)) { if (await pausa(id, 0)) toast("✅ " + nm(id) + " · " + t("riaccesa", "back on")); return; }
    const on = S[id].state === "on";
    if (on && pause()[id]) await pausa(id, 0);   // pausa scaduta rimasta: la pulisco
    await svc("automation", on ? "turn_off" : "turn_on", {}, { entity_id: id });
    toast((on ? "⛔ " : "✅ ") + nm(id) + " · " + (on ? t("spenta", "off") : t("attiva", "on")));
  },
  auMenu: el => { V.menu = el.dataset.id; openSheet(menu); },
  auPausa: async el => { const id = el.dataset.id, m = +el.dataset.m;
    if (await pausa(id, m)) { closeSheet(); toast("⏸ " + nm(id) + " · " + t("in pausa fino a ", "paused until ") + quando(new Date(Date.now() + m * 6e4))); } },
  auRiprendi: async el => { const id = el.dataset.id; if (await pausa(id, 0)) { closeSheet(); toast("✅ " + nm(id) + " · " + t("riaccesa", "back on")); } },
  auPref: el => { const id = el.dataset.id;
    casaCambia("automazioni", d => { const p = d.preferite = (d.preferite || []).filter(x => x !== id); if (!preferite().includes(id)) p.push(id); },
      preferite().includes(id) ? "☆ " + t("Tolta dalla Home", "Removed from Home") : "⭐ " + t("In Home", "On Home")); },
  auNasc: el => { const id = el.dataset.id, era = nascosta(id);
    casaCambia("automazioni", d => { const n = d.nascoste = (d.nascoste || []).filter(x => x !== id); if (!era) n.push(id); }, era ? "👁 " + nm(id) : "🙈 " + nm(id));
    if (!era) closeSheet(); },
  auNascoste: () => { V.nascoste = !V.nascoste; render(); },
  auRun: el => { if (UI.sheet === menu) closeSheet(); return svc("automation", "trigger", { skip_condition: true }, { entity_id: el.dataset.id }).then(() => toast("▶ " + nm(el.dataset.id))); },
  auFiltro: el => { V.filtro = el.dataset.v; render(); },
  auNew: () => { M = nuovo(); mId = null; riapri = () => openSheet(costruttore); riapri(); },
  auEdit: el => { if (UI.sheet === menu) closeSheet(); const id = el.dataset.id, cfg = attr(id, "id"), mod = LAYOUT.autoModels?.[cfg];
    if (mod) { M = JSON.parse(JSON.stringify(mod)); mId = cfg; riapri = () => openSheet(costruttore); return riapri(); }
    apriHA("/config/automation/edit/" + encodeURIComponent(cfg || "")); },
  auQuando: el => { M.quando = { tipo: el.dataset.v, giorni: [] }; render(); },
  auGiorno: el => { const g = M.quando.giorni = M.quando.giorni || [], v = el.dataset.v, i = g.indexOf(v); i < 0 ? g.push(v) : g.splice(i, 1); render(); },
  auPick: el => { const k = el.dataset.k, persona = k === "quando.persona", keep = M;
    scegli({ titolo: persona ? "👤 " + t("Chi", "Who") : "🔁 " + t("Quale dispositivo", "Which device"), auto: false, attuale: null,
      filtro: persona ? id => id.startsWith("person.") || id.startsWith("device_tracker.") : id => /^(binary_sensor|sensor|light|switch|cover|lock|climate|media_player|input_boolean|person|alarm_control_panel|vacuum|fan)\./.test(id),
      onPick: id => { M = keep; if (id) set(M, k, id); riapri(); } }); },
  auPickAz: el => { const i = +el.dataset.i, keep = M, scena = M.azioni[i].tipo === "scena";
    scegli({ titolo: "＋ " + t("Dispositivo", "Device"), auto: false, attuale: null, filtro: scena ? id => /^(scene|script)\./.test(id) : M.azioni[i].tipo === "allarme" ? id => id.startsWith("alarm_control_panel.") : controllabile,
      onPick: id => { M = keep; if (id) { const a = M.azioni[i]; a.entita = [...new Set([...(a.entita || []), id])]; } riapri(); } }); },
  auAzAdd: () => { M.azioni.push({ tipo: "on", entita: [] }); render(); },
  auAzDel: el => { M.azioni.splice(+el.dataset.i, 1); if (!M.azioni.length) M.azioni.push({ tipo: "on", entita: [] }); render(); },
  auSave: async () => {
    if (!M.nome.trim()) return toast(t("Scrivi un nome", "Write a name"), true);
    const id = mId || "nduja_" + Date.now().toString(36), cfg = inHA(M, id);
    if (!cfg.triggers.length || (M.quando.tipo !== "ora" && !cfg.triggers[0].entity_id?.length && M.quando.tipo !== "sole")) return toast(t("Completa il «Quando»", "Complete the «When»"), true);
    if (!cfg.actions.length) return toast(t("Aggiungi almeno un'azione", "Add at least one action"), true);
    try {
      await api("POST", "/api/config/automation/config/" + encodeURIComponent(id), cfg);
      if (!mId) etichettaNduja(() => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === id));   // nuova: etichetta «'Nduja»
      const mod = M; await cambia(l => { l.autoModels = { ...(l.autoModels || {}), [id]: mod }; });
      closeSheet(); toast("💾 " + M.nome);
    } catch (e) { toast(t("Non salvata: ", "Not saved: ") + (e.message || e), true); }
  },
  auDel: async () => {
    if (!confirm(t("Eliminare questa automazione da Home Assistant?", "Delete this automation from Home Assistant?"))) return;
    try { await api("DELETE", "/api/config/automation/config/" + encodeURIComponent(mId));
      const id = mId; await cambia(l => { if (l.autoModels) { l.autoModels = { ...l.autoModels }; delete l.autoModels[id]; } }); closeSheet(); toast("🗑 " + M.nome);
    } catch (e) { toast(t("Non eliminata: ", "Not deleted: ") + (e.message || e), true); }
  },
});

page("automazioni", { title: t("Automazioni", "Automations"), short: t("Automaz.", "Automations"), icon: "🔁", order: 80, show: () => allEnts("automation").length > 0 || isAdmin(), render: pagina });

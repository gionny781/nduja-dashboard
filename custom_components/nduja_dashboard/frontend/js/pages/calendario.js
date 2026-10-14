/* Calendario: gli eventi di oggi e dei prossimi giorni dai calendari di Home Assistant, con «＋ Evento». */
import { S, ACT, CHG, LAYOUT, UI, t, LOC, esc, nm, ents, card, empty, page, svc, toast, openSheet, closeSheet, saveLayout, uncache, isAdmin, render } from "../core.js";
import { calendari, colore, puoScrivere, eventi, nelGiorno, ora, nomeGiorno, allDay, inizio } from "../agenda.js";

const V = { giorni: 7 };
const evRiga = ev => `<div class="ev1" style="--c:${colore(ev.cal)}"><span class="eh1">${esc(ora(ev))}</span><div class="tx"><b>${esc(ev.summary || t("(senza titolo)", "(untitled)"))}</b>
  <span>${esc(nm(ev.cal))}${ev.location ? " · 📍 " + esc(ev.location) : ""}</span>${ev.description ? `<small>${esc(String(ev.description).slice(0, 140))}</small>` : ""}</div></div>`;

function elenco(giorni) {
  const C = calendari(), E = eventi(C, giorni);
  if (!C.length) return empty(t("Nessun calendario scelto.", "No calendar selected."));
  if (E === undefined) return `<div class="small muted">${t("Carico gli eventi…", "Loading events…")}</div>`;
  const out = [];
  for (let i = 0; i < giorni; i++) {
    const d = new Date(Date.now() + i * 864e5), L = E.filter(e => nelGiorno(e, d));
    if (!L.length && i > 1) continue;
    out.push(`<div class="fl1">${esc(nomeGiorno(d))}</div>${L.length ? `<div class="stack">${L.map(evRiga).join("")}</div>` : `<div class="small muted">${t("Niente in programma.", "Nothing planned.")}</div>`}`);
  }
  return out.join("");
}

/** agenda breve per la Home: oggi e domani */
export function agendaCard() {
  const C = calendari(); if (!C.length) return "";
  const E = eventi(C, 2) || [], ora0 = new Date();
  const dom = new Date(Date.now() + 864e5);
  const L = E.filter(e => (nelGiorno(e, ora0) || nelGiorno(e, dom)) && (allDay(e) || new Date(e.end) > ora0)).slice(0, 5);
  return card("📅 " + t("Agenda", "Agenda"), L.length ? `<div class="stack">${L.map(e => evRiga(e).replace('class="eh1">', `class="eh1">${nelGiorno(e, ora0) ? "" : t("dom ", "tmrw ")}`)).join("")}</div>`
    : `<div class="small muted">${t("Niente in programma oggi e domani.", "Nothing planned today or tomorrow.")}</div>`, { link: [t("Calendario", "Calendar"), "calendario"] });
}

/* ---------- ＋ Evento ---------- */
let F = null;
const oggiISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
function nuovo() {
  const W = ents("calendar").filter(puoScrivere);
  F = F || { cal: W.find(id => calendari().includes(id)) || W[0], titolo: "", data: oggiISO(), da: "09:00", a: "10:00", tutto: false, dove: "" };
  if (!W.length) return `<div class="sh-head"><h3>＋ ${t("Evento", "Event")}</h3><button class="x" data-act="sheetClose">×</button></div>${empty(t("Nessun calendario permette di aggiungere eventi (per esempio il calendario locale di Home Assistant o Google).", "No calendar accepts new events (e.g. Home Assistant's Local calendar or Google)."))}`;
  return `<div class="sh-head"><h3>＋ ${t("Nuovo evento", "New event")}</h3><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Titolo", "Title")}</span><input type="text" data-chg="evF" data-k="titolo" value="${esc(F.titolo)}" placeholder="${t("Dentista, cena da Caterina…", "Dentist, dinner…")}"></label>
    <label class="fld1"><span>${t("Calendario", "Calendar")}</span><select data-chg="evF" data-k="cal">${W.map(id => `<option value="${id}" ${F.cal === id ? "selected" : ""}>${esc(nm(id))}</option>`).join("")}</select></label>
    <label class="fld1"><span>${t("Giorno", "Day")}</span><input type="date" data-chg="evF" data-k="data" value="${F.data}"></label>
    <label class="row" style="gap:8px;margin:10px 0"><input type="checkbox" data-chg="evAll" ${F.tutto ? "checked" : ""}> ${t("Tutto il giorno", "All day")}</label>
    ${F.tutto ? "" : `<div class="row" style="gap:10px"><label class="fld1" style="flex:1"><span>${t("Dalle", "From")}</span><input type="time" data-chg="evF" data-k="da" value="${F.da}"></label><label class="fld1" style="flex:1"><span>${t("Alle", "To")}</span><input type="time" data-chg="evF" data-k="a" value="${F.a}"></label></div>`}
    <label class="fld1"><span>${t("Dove (facoltativo)", "Where (optional)")}</span><input type="text" data-chg="evF" data-k="dove" value="${esc(F.dove)}"></label>
    <button class="btn pri" data-act="evSave" style="margin-top:14px">💾 ${t("Aggiungi", "Add")}</button>`;
}
CHG.evF = el => { F[el.dataset.k] = el.value; };
CHG.evAll = el => { F.tutto = el.checked; };

/* ---------- ✏️ calendari da mostrare ---------- */
let scelti = null;
function scelta() {
  scelti = scelti || calendari();
  return `<div class="sh-head"><div><h3>📅 ${t("Calendari", "Calendars")}</h3><div class="small muted">${t("Scegli quali mostrare.", "Choose which to show.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${ents("calendar").map(id => `<label class="li rfc1"><input type="checkbox" data-chg="calPick" data-id="${id}" ${scelti.includes(id) ? "checked" : ""}><span class="dot1" style="background:${colore(id)}"></span><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)}${puoScrivere(id) ? " · ✍️" : ""}</span></div></label>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px"><button class="btn pri" data-act="calSave">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="calAuto">${t("Automatico", "Automatic")}</button></div>`;
}
CHG.calPick = el => { scelti = el.checked ? [...new Set([...scelti, el.dataset.id])] : scelti.filter(x => x !== el.dataset.id); };
async function salvaCal(v) {
  const l = JSON.parse(JSON.stringify(LAYOUT)); if (v) l.calendars = v; else delete l.calendars;
  try { await saveLayout(l); closeSheet(); uncache("ev:"); toast("📅 " + t("Salvato", "Saved")); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
}

Object.assign(ACT, {
  calDays: el => { V.giorni = +el.dataset.v; render(true); },
  evNew: () => { F = null; openSheet(nuovo); },
  evSave: async () => {
    if (!F.titolo.trim()) return toast(t("Scrivi un titolo", "Write a title"), true);
    const d = { summary: F.titolo.trim() };
    if (F.dove) d.location = F.dove;
    if (F.tutto) { d.start_date = F.data; d.end_date = new Date(new Date(F.data + "T12:00:00").getTime() + 864e5).toISOString().slice(0, 10); }
    else { d.start_date_time = `${F.data} ${F.da}:00`; d.end_date_time = `${F.data} ${F.a > F.da ? F.a : F.da}:00`; }
    try { await svc("calendar", "create_event", d, { entity_id: F.cal }); closeSheet(); uncache("ev:"); toast("📅 " + d.summary); } catch {}
  },
  calEdit: () => { scelti = null; openSheet(scelta); },
  calSave: () => salvaCal(scelti),
  calAuto: () => salvaCal(null),
});

page("calendario", { title: t("Calendario", "Calendar"), short: t("Agenda", "Agenda"), icon: "📅", order: 40,
  show: () => ents("calendar").length > 0,
  render: () => `<div class="g g3">${card("📅 " + t("Calendario", "Calendar"), `
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:6px"><div class="seg">${[[1, t("Oggi", "Today")], [7, t("Settimana", "Week")], [30, t("Mese", "Month")]].map(([v, n]) => `<button class="${V.giorni === v ? "act" : ""}" data-act="calDays" data-v="${v}">${n}</button>`).join("")}</div>
        <span style="flex:1"></span>${ents("calendar").some(puoScrivere) ? `<button class="btn pri sm" data-act="evNew">＋ ${t("Evento", "Event")}</button>` : ""}${isAdmin() ? `<button class="btn sm" data-act="calEdit">✏️ ${t("Calendari", "Calendars")}</button>` : ""}</div>
      ${elenco(V.giorni)}`, { cls: "span3" })}</div>` });

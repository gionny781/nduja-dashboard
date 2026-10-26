/* Bacheca: i messaggi di famiglia. Ognuno ha testo, autore (l'utente che lo scrive), data, colore, può essere appuntato in alto
   e può avere una scadenza: allo scadere sparisce. Lo cancella chi l'ha scritto oppure un amministratore.
   I dati sono «della casa» (casa.js, come le Faccende): uguali su tutti i dispositivi e qualsiasi utente può scrivere;
   un messaggio nuovo arriva subito sugli altri dispositivi grazie all'avviso di casa.js.
   Sezione «bacheca» = { messaggi: [{ id, testo, colore, quando, fisso, scade, autore: { uid, nome, p } }] }
   In Home la scheda «Bacheca» con gli ultimi messaggi (HOME_EXTRA), nascondibile come le altre. */
import { S, ACT, CHG, UI, HOME_EXTRA, t, LOC, esc, nm, attr, allEnts, card, page, toast, openSheet, closeSheet, render, sGet, sSet, sicuro, isAdmin, ago } from "../core.js";
import { casa, casaCambia, casaErrore } from "../casa.js";

const SEZ = "bacheca";
const MAX_TESTO = 280, MAX_MSG = 80, IN_HOME = 4;
const COLORI = () => [["giallo", t("Giallo", "Yellow")], ["arancio", t("Arancio", "Orange")], ["rosa", t("Rosa", "Pink")], ["verde", t("Verde", "Green")], ["azzurro", t("Azzurro", "Blue")], ["viola", t("Viola", "Purple")]];
const COL = new Set(["giallo", "arancio", "rosa", "verde", "azzurro", "viola"]);
const colore = c => COL.has(c) ? c : "giallo";

/* ---------- dati ---------- */
const sezione = () => casa(SEZ);
const scaduto = (m, ora = Date.now()) => !!m.scade && new Date(m.scade).getTime() <= ora;
/** messaggi ancora validi: prima gli appuntati, poi i più recenti */
export const messaggi = () => {
  const s = sezione(); if (s?.stato !== "ok") return [];
  const ora = Date.now();
  return (s.dati.messaggi || []).filter(m => m && m.id && m.testo && !scaduto(m, ora))
    .sort((a, b) => (!!b.fisso - !!a.fisso) || String(b.quando).localeCompare(String(a.quando)));
};
const trova = id => messaggi().find(m => m.id === id);
const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** tolgo dai dati salvati i messaggi scaduti (a ogni salvataggio, così la sezione non cresce) */
const pulisci = d => { const ora = Date.now(); d.messaggi = (d.messaggi || []).filter(m => m && m.id && !scaduto(m, ora)); };

/* ---------- chi scrive ---------- */
/** la persona di Home Assistant collegata a chi usa la plancia (per la foto) */
const io = () => UI.user?.id ? allEnts("person").find(p => attr(p, "user_id") === UI.user.id) || null : null;
const mioNome = () => { const p = io(); return p ? nm(p) : String(UI.user?.name || t("Qualcuno", "Someone")).trim(); };
const mio = m => !!UI.user?.id && m.autore?.uid === UI.user.id;
/** cancellare e appuntare: chi l'ha scritto oppure un amministratore */
const puo = m => mio(m) || isAdmin();
/* nome e foto: se la persona c'è ancora uso quelli di oggi, altrimenti il nome salvato quando ha scritto */
const nomeA = a => a?.p && S[a.p] ? nm(a.p) : String(a?.nome || t("Qualcuno", "Someone"));
function avatar(a) {
  const foto = a?.p && S[a.p] && attr(a.p, "entity_picture"), n = nomeA(a);
  return `<span class="bca1" style="${foto ? `background-image:url('${esc(foto)}')` : ""}" aria-hidden="true">${foto ? "" : esc((n[0] || "?").toUpperCase())}</span>`;
}

/* ---------- scadenza ---------- */
const fineGiorno = (d, piu = 0) => { const x = new Date(d); x.setDate(x.getDate() + piu); x.setHours(23, 59, 59, 0); return x; };
const oggiISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const SCADE = () => [["mai", t("Mai", "Never")], ["sera", t("Stasera", "Tonight")], ["domani", t("Domani", "Tomorrow")], ["3", t("3 giorni", "3 days")], ["7", t("1 settimana", "1 week")], ["data", t("Scegli il giorno…", "Pick a day…")]];
function scadeDa(k, data) {
  const ora = new Date();
  if (k === "sera") return fineGiorno(ora);
  if (k === "domani") return fineGiorno(ora, 1);
  if (k === "3" || k === "7") return fineGiorno(ora, +k);
  if (k === "data" && data) return fineGiorno(data + "T12:00:00");
  return null;
}
function scadeTesto(iso) {
  const d = new Date(iso), g = Math.round((fineGiorno(d) - fineGiorno(new Date())) / 864e5);
  if (g <= 0) return d.getHours() === 23 && d.getMinutes() === 59 ? t("fino a stasera", "until tonight") : t("fino alle ", "until ") + d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
  if (g === 1) return t("fino a domani", "until tomorrow");
  return t("fino a ", "until ") + d.toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short" });
}

/** nel foglio ✍️: quando sparisce il messaggio */
function sparisce(d) {
  if (!d) return F?.scade === "data" ? t("Scegli il giorno.", "Pick the day.") : t("Resta finché qualcuno non lo cancella.", "It stays until someone deletes it.");
  const g = Math.round((fineGiorno(d) - fineGiorno(new Date())) / 864e5);
  if (g <= 0) return t("Sparisce stanotte, a fine giornata.", "It disappears tonight, at the end of the day.");
  const giorno = g === 1 ? t("domani", "tomorrow") : d.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" });
  return t(`Sparisce ${giorno}, a fine giornata.`, `It disappears ${g === 1 ? "" : "on "}${giorno}, at the end of the day.`);
}

/* ---------- disegno ---------- */
const nuovo = m => Date.now() - new Date(m.quando).getTime() < 60000;
/* puntina della plancia (SVG fatto apposta) */
const puntina = () => `<svg class="bcpn1" viewBox="0 0 24 24" aria-hidden="true"><circle class="t" cx="12" cy="8" r="5.5"/><path class="g" d="M12 13.5V21"/><circle class="l" cx="10.2" cy="6.4" r="1.6"/></svg>`;
function messaggio(m) {
  return `<article class="bc1 c-${colore(m.colore)} ${m.fisso ? "fisso" : ""} ${nuovo(m) ? "nw" : ""}">
    ${m.fisso ? `<span class="bcf1" title="${t("Appuntato", "Pinned")}">${puntina()}</span>` : ""}
    <p class="bct1">${esc(m.testo)}</p>${m.scade ? `<span class="bcs2">⏳ ${esc(scadeTesto(m.scade))}</span>` : ""}
    <div class="bc1f">${avatar(m.autore)}<div class="tx"><b>${esc(nomeA(m.autore))}${mio(m) ? ` <small>· ${t("tu", "you")}</small>` : ""}</b><span>${esc(ago(m.quando))}</span></div>
      ${puo(m) ? `<button class="bcb1 ${m.fisso ? "on" : ""}" data-act="bcFisso" data-id="${esc(m.id)}" title="${m.fisso ? t("Togli dall'alto", "Unpin") : t("Appunta in alto", "Pin to top")}" aria-label="${m.fisso ? t("Togli dall'alto", "Unpin") : t("Appunta in alto", "Pin to top")}">📌</button>
        <button class="bcb1 del" data-act="bcDel" data-id="${esc(m.id)}" title="${t("Cancella", "Delete")}" aria-label="${t("Cancella", "Delete")}">🗑</button>` : ""}</div></article>`;
}
/* bacheca vuota: tavola di sughero con due foglietti e una puntina (SVG fatto apposta) */
const disegno = () => `<svg class="bcd1" viewBox="0 0 64 64" aria-hidden="true"><rect class="tv" x="6" y="10" width="52" height="42" rx="6"/>
  <g class="n1"><path class="f1" d="M14 18h17v16H14z"/><path class="r" d="M17 23h11M17 27h8"/></g>
  <g class="n2"><path class="f2" d="M35 24h16v17H35z"/><path class="r" d="M38 29h10M38 33h7"/></g>
  <g class="pn"><circle class="pt" cx="22.5" cy="17" r="3"/></g><path class="sp" d="M50 13l2-3M54 17h3"/></svg>`;

function riavvia() {
  return `<section class="card span3"><div class="ch"><h2>📌 ${t("Bacheca", "Notice board")}</h2></div><div class="note1">${casaErrore(SEZ) === "riavvia"
    ? t("Per usare la Bacheca riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha cambiato anche la parte che salva i dati.", "To use the Notice board restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update also changed the part that stores the data.")
    : t("Non riesco a leggere la bacheca da Home Assistant. Riprova tra poco.", "I can't read the notice board from Home Assistant. Try again shortly.")}</div></section>`;
}
function pagina() {
  const s = sezione();
  if (s?.stato === "errore") return `<div class="g g3">${riavvia()}</div>`;
  if (s?.stato !== "ok") return `<div class="g g3"><section class="card span3"><div class="small muted">${t("Carico la bacheca…", "Loading the notice board…")}</div></section></div>`;
  const M = messaggi();
  const testa = `<section class="card span3 bch1"><div class="ch"><h2>📌 ${t("Bacheca", "Notice board")}${M.length ? ` <span class="tag info">${M.length}</span>` : ""}${M.some(m => m.fisso) ? ` <span class="tag warn">📌 ${M.filter(m => m.fisso).length}</span>` : ""}</h2>
      <button class="btn pri sm" data-act="bcNuovo">✍️ ${t("Nuovo messaggio", "New message")}</button></div>
    <p class="small muted" style="margin:0">${t("I messaggi di famiglia, uguali su tutti i dispositivi. Chiunque in casa può scrivere; cancella chi l'ha scritto oppure un amministratore.", "Family messages, the same on every device. Anyone at home can write; the author or an admin can delete them.")}</p></section>`;
  if (!M.length) return `<div class="g g3">${testa}<section class="card span3 bcz1"><span class="bcz1i">${disegno()}</span><div><h3>${t("La bacheca è vuota", "The board is empty")}</h3>
      <p class="small muted">${t("Lascia un messaggio a tutta la casa: «Torno tardi», «Il pane è nel forno», «Domani passa il tecnico». Lo vedono subito tutti, su ogni telefono e tablet.", "Leave a message for the whole home: «Back late», «Bread is in the oven», «The technician comes tomorrow». Everyone sees it right away, on every phone and tablet.")}</p>
      <button class="btn pri" data-act="bcNuovo" style="margin-top:12px">✍️ ${t("Scrivi il primo", "Write the first one")}</button></div></section></div>`;
  return `<div class="g g3">${testa}<section class="card span3"><div class="bcg1">${M.map(messaggio).join("")}</div></section></div>`;
}

/* ---------- Home: gli ultimi messaggi ---------- */
function homeCard() {
  const M = messaggi(), V = M.slice(0, IN_HOME);
  return card("📌 " + t("Bacheca", "Notice board"), `<div class="bchl1">${V.map(m => `<div class="bch2 c-${colore(m.colore)} ${m.fisso ? "fisso" : ""} ${nuovo(m) ? "nw" : ""}">
      <p>${m.fisso ? puntina() : ""}${esc(m.testo)}</p><span>${avatar(m.autore)}<b>${esc(nomeA(m.autore))}</b> · ${esc(ago(m.quando))}${m.scade ? " · ⏳ " + esc(scadeTesto(m.scade)) : ""}</span></div>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="bcNuovo">✍️ ${t("Scrivi", "Write")}</button>${M.length > IN_HOME ? `<button class="btn sm" data-act="go" data-id="bacheca">${M.length - IN_HOME === 1 ? t("e un altro", "and 1 more") : t(`e altri ${M.length - IN_HOME}`, `and ${M.length - IN_HOME} more`)} ›</button>` : ""}</div>`,
    { link: [t("Tutti", "All"), "bacheca"] });
}
HOME_EXTRA.bacheca = { title: () => t("Bacheca", "Notice board"), render: homeCard, show: () => messaggi().length > 0 };

/* ---------- ✍️ nuovo messaggio ---------- */
let F = null;
function apri() {
  F = { testo: "", colore: colore(sGet("bachecaColore")), fisso: false, scade: "mai", data: "" };
  openSheet(scheda);
  setTimeout(() => document.getElementById("bc1t")?.focus(), 250);
}
function scheda() {
  if (!F) return "";
  const resta = MAX_TESTO - F.testo.length, sc = F.scade === "data" ? (F.data ? scadeDa("data", F.data) : null) : scadeDa(F.scade);
  return `<div class="sh-head"><div><h3>✍️ ${t("Nuovo messaggio", "New message")}</h3><div class="small muted">${t("Lo vedono tutti, su tutti i dispositivi.", "Everyone sees it, on every device.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="bcw1 c-${colore(F.colore)}"><textarea id="bc1t" maxlength="${MAX_TESTO}" rows="4" placeholder="${t("Torno per cena · Il pane è nel forno · Domani passa il tecnico…", "Back for dinner · Bread is in the oven · The technician comes tomorrow…")}" aria-label="${t("Messaggio", "Message")}">${esc(F.testo)}</textarea>
      <div class="bcw1f">${avatar({ p: io(), nome: mioNome() })}<span>${t("Firmato: ", "Signed: ")}<b>${esc(mioNome())}</b></span><small id="bc1c" class="${resta < 20 ? "poco" : ""}">${resta}</small></div></div>
    <div class="fl1">${t("Colore", "Colour")}</div>
    <div class="bcc1">${COLORI().map(([k, n]) => `<button class="c-${k} ${F.colore === k ? "on" : ""}" data-act="bcCol" data-v="${k}" aria-label="${esc(n)}" title="${esc(n)}"><i></i></button>`).join("")}</div>
    <div class="fl1">${t("Sparisce", "Disappears")}</div>
    <div class="vr1 bcv1">${SCADE().map(([k, n]) => `<button class="${F.scade === k ? "on" : ""}" data-act="bcScade" data-v="${k}">${esc(n)}</button>`).join("")}</div>
    ${F.scade === "data" ? `<input id="bc1d" class="bcdt1" type="date" min="${oggiISO()}" value="${esc(F.data)}" data-chg="bcData" aria-label="${t("Giorno", "Day")}">` : ""}
    <p class="small muted" style="margin:6px 0 0">${esc(sparisce(sc))}</p>
    <label class="row bck1"><input type="checkbox" data-chg="bcFissoF" ${F.fisso ? "checked" : ""}> 📌 ${t("Appunta in alto", "Pin to top")}</label>
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="bcPubblica">📌 ${t("Pubblica", "Post")}</button><button class="btn" data-act="sheetClose">${t("Annulla", "Cancel")}</button></div>`;
}
const leggiTesto = () => { const el = document.getElementById("bc1t"); if (F && el) F.testo = el.value.slice(0, MAX_TESTO); };
/* contatore dei caratteri mentre scrivi (senza ridisegnare il foglio) */
document.addEventListener("input", e => {
  if (e.target.id !== "bc1t" || !F) return;
  F.testo = e.target.value.slice(0, MAX_TESTO);
  const c = document.getElementById("bc1c"); if (c) { const r = MAX_TESTO - F.testo.length; c.textContent = r; c.classList.toggle("poco", r < 20); }
});
CHG.bcData = el => { if (!F) return; F.data = el.value && el.value >= oggiISO() ? el.value : oggiISO(); if (el.value !== F.data) el.value = F.data; render(); };
CHG.bcFissoF = el => { if (F) F.fisso = el.checked; };

Object.assign(ACT, {
  bcNuovo: () => apri(),
  bcCol: el => { leggiTesto(); F.colore = colore(el.dataset.v); sSet("bachecaColore", F.colore); render(); },
  bcScade: el => { leggiTesto(); F.scade = el.dataset.v; if (F.scade === "data" && !F.data) F.data = oggiISO(); render(); },
  bcPubblica: async () => {
    leggiTesto();
    const testo = String(F.testo || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TESTO);
    if (!testo) { toast(t("Scrivi il messaggio", "Write the message"), true); document.getElementById("bc1t")?.focus(); return; }
    const sc = F.scade === "data" ? scadeDa("data", F.data) : scadeDa(F.scade);
    if (sc && sc.getTime() <= Date.now()) { toast(t("Questo giorno è già passato", "That day has already gone"), true); return; }
    const m = { id: nuovoId(), testo, colore: colore(F.colore), quando: new Date().toISOString(), fisso: !!F.fisso, scade: sc ? sc.toISOString() : null,
      autore: { uid: UI.user?.id || null, nome: mioNome(), p: io() } };
    const ok = await casaCambia(SEZ, d => {
      pulisci(d); d.messaggi.unshift(m);
      /* troppi messaggi: tolgo i più vecchi non appuntati */
      while (d.messaggi.length > MAX_MSG) { const i = d.messaggi.map(x => !x.fisso).lastIndexOf(true); d.messaggi.splice(i >= 0 ? i : d.messaggi.length - 1, 1); }
    }, "📌 " + t("Messaggio pubblicato", "Message posted"));
    if (ok) { F = null; closeSheet(); }
  },
  bcFisso: async el => {
    const id = el.dataset.id, m = trova(id); if (!m || !puo(m)) return;
    const su = !m.fisso;
    await casaCambia(SEZ, d => { pulisci(d); const x = d.messaggi.find(q => q.id === id); if (!x) return false; x.fisso = su; },
      su ? "📌 " + t("Appuntato in alto", "Pinned to top") : t("Tolto dall'alto", "Unpinned"));
  },
  bcDel: async el => {
    const id = el.dataset.id, m = trova(id); if (!m || !puo(m)) return;
    if (!sicuro(el, t("Cancello?", "Delete?"))) return;
    await casaCambia(SEZ, d => { pulisci(d); const n = d.messaggi.length; d.messaggi = d.messaggi.filter(q => q.id !== id); if (d.messaggi.length === n) return false; }, "🗑 " + t("Messaggio cancellato", "Message deleted"));
  },
});

page("bacheca", { title: t("Bacheca", "Notice board"), short: t("Bacheca", "Board"), icon: "📌", order: 42, render: pagina });

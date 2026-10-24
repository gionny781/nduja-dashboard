/* Faccende: i lavori di casa, ognuno con nome, icona, ogni quanti giorni va fatto, a chi tocca (tra le persone di
   Home Assistant, a turno o sempre la stessa) e l'ultima volta che è stato fatto. «Fatto» registra chi e quando e passa il turno.
   I dati sono «della casa» (casa.js): uguali su tutti i dispositivi e li può cambiare qualsiasi utente, non solo gli amministratori.
   Sezione «faccende» = { lavori: [{ id, nome, icona, ogni, chi: [person…], modo: "turno"|"fisso", tocca, ultima, storia: [{ chi, quando, prima }] }] }
   In Home la scheda «Faccende di oggi» (HOME_EXTRA), nascondibile come le altre. */
import { S, ACT, CHG, UI, HOME_EXTRA, IT, t, LOC, esc, nm, attr, ents, allEnts, card, page, toast, openSheet, closeSheet, render, sGet, sSet, sicuro } from "../core.js";
import { casa, casaCambia, casaErrore } from "../casa.js";

const SEZ = "faccende";
const MAX_STORIA = 12, MAX_LAVORI = 150;
const ICONE = ["🧹", "🧽", "🚽", "🛁", "🧺", "👕", "🛏️", "🍽️", "🗑️", "♻️", "🪴", "🌿", "🐶", "🐱", "🐟", "🛒", "🍳", "🧊", "🪟", "🚗", "💡", "🔧", "📦", "🧴"];
const ESEMPI = () => [
  ["🚽", t("Pulire il bagno", "Clean the bathroom"), 7],
  ["🧹", t("Passare l'aspirapolvere", "Vacuum the floors"), 7],
  ["🗑️", t("Portare fuori la spazzatura", "Take out the rubbish"), 2],
  ["🍽️", t("Svuotare la lavastoviglie", "Empty the dishwasher"), 1],
  ["🧺", t("Fare il bucato", "Do the laundry"), 3],
  ["🛏️", t("Cambiare le lenzuola", "Change the sheets"), 14],
  ["🪴", t("Innaffiare le piante", "Water the plants"), 3],
  ["🪟", t("Pulire i vetri", "Clean the windows"), 30],
  ["🧊", t("Pulire il frigorifero", "Clean the fridge"), 30],
];

/* ---------- dati ---------- */
const sezione = () => casa(SEZ);
export const lavori = () => { const s = sezione(); return s?.stato === "ok" ? (s.dati.lavori || []).filter(l => l && l.id) : []; };
const trova = id => lavori().find(l => l.id === id);
const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- persone ---------- */
const persone = (extra = []) => [...new Set([...ents("person"), ...extra.filter(p => S[p])])].sort((a, b) => nm(a).localeCompare(nm(b), LOC));
/** la persona di Home Assistant collegata a chi usa la plancia (persona → utente) */
const io = () => UI.user?.id ? allEnts("person").find(p => attr(p, "user_id") === UI.user.id) || null : null;
const nomeP = p => p && S[p] ? nm(p) : t("qualcuno", "someone");
/** «tocca a Mario», «tocca ad Anna» */
const aChi = n => IT && /^[aA]/.test(n) ? "ad " : "a ";
function avatar(p, cls = "") {
  const foto = p && attr(p, "entity_picture"), n = p && S[p] ? nm(p) : "";
  return `<span class="fka1 ${cls}" style="${foto ? `background-image:url('${esc(foto)}')` : ""}" aria-hidden="true">${foto ? "" : esc((n[0] || "?").toUpperCase())}</span>`;
}
const chiDi = l => (l.chi || []).filter(p => S[p]);
/** a chi tocca adesso: null = chiunque */
export function tocca(l) {
  const C = chiDi(l); if (!C.length) return null;
  if (l.modo === "fisso" || C.length === 1) return C[0];
  return C.includes(l.tocca) ? l.tocca : C[0];
}

/* ---------- giorni ---------- */
const mezzanotte = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const giorniTra = (a, b) => Math.round((mezzanotte(b) - mezzanotte(a)) / 864e5);
const piuGiorni = (d, n) => { const x = mezzanotte(d); x.setDate(x.getDate() + n); return x; };
const ogniDi = l => Math.max(1, Math.min(365, Math.round(+l.ogni || 7)));
/** giorno in cui va rifatto (mai fatto: oggi) */
const scadenza = l => l.ultima ? piuGiorni(l.ultima, ogniDi(l)) : mezzanotte(Date.now());
/** giorni che mancano: < 0 in ritardo, 0 oggi */
export const mancano = l => giorniTra(Date.now(), scadenza(l));
const fattoOggi = l => !!l.ultima && giorniTra(l.ultima, Date.now()) === 0;
const statoDi = l => { const m = mancano(l); return m < 0 ? "ritardo" : m === 0 ? "oggi" : "poi"; };
const giorni = n => n === 1 ? t("1 giorno", "1 day") : n + t(" giorni", " days");
function ogniTesto(n) {
  if (n === 1) return t("ogni giorno", "every day");
  if (n === 7) return t("ogni settimana", "every week");
  if (n === 30 || n === 31) return t("ogni mese", "every month");
  if (n % 7 === 0 && n <= 70) return t(`ogni ${n / 7} settimane`, `every ${n / 7} weeks`);
  return t(`ogni ${n} giorni`, `every ${n} days`);
}
const giornoBreve = d => new Date(d).toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short" });
function quando(l) {
  const m = mancano(l);
  if (!l.ultima) return t("mai fatto · da fare", "never done · to do");
  if (m < 0) return t("in ritardo di ", "overdue by ") + giorni(-m);
  if (m === 0) return t("da fare oggi", "due today");
  if (m === 1) return fattoOggi(l) ? t("fatto oggi · di nuovo domani", "done today · again tomorrow") : t("domani", "tomorrow");
  return (fattoOggi(l) ? t("fatto oggi · ", "done today · ") : "") + (m < 7 ? t(`tra ${m} giorni`, `in ${m} days`) : giornoBreve(scadenza(l)));
}
/** quanto è passato del periodo (0…1): la barra si riempie fino alla scadenza */
const passato = l => l.ultima ? Math.max(0, Math.min(1, (Date.now() - new Date(l.ultima).getTime()) / (ogniDi(l) * 864e5))) : 1;
const ultimaTesto = l => {
  if (!l.ultima) return "";
  const s = (l.storia || [])[0], chi = s && s.quando === l.ultima && s.chi && S[s.chi] ? " · " + nm(s.chi) : "";
  const g = giorniTra(l.ultima, Date.now());
  return t("ultima volta: ", "last time: ") + (g === 0 ? t("oggi", "today") : g === 1 ? t("ieri", "yesterday") : new Date(l.ultima).toLocaleDateString(LOC, { day: "numeric", month: "short" })) + chi;
};
/** in ordine: prima i più in ritardo */
const ordinati = L => [...L].sort((a, b) => mancano(a) - mancano(b) || String(a.nome).localeCompare(String(b.nome), LOC));
const mie = () => sGet("faccendeMie") === "1" && !!io();
const perMe = l => { const p = tocca(l); return !p || p === io(); };

/* ---------- «Fatto»: chi, quando e il turno che passa ---------- */
function segnaFatto(l, chi, quandoISO) {
  const C = chiDi(l), prima = { ultima: l.ultima || null, tocca: l.tocca || null };
  l.storia = [{ chi: chi || null, quando: quandoISO, prima }, ...(l.storia || [])].slice(0, MAX_STORIA);
  l.ultima = quandoISO;
  if (l.modo !== "fisso" && C.length > 1) {
    const da = C.includes(chi) ? chi : tocca(l);   // il turno passa a chi viene dopo chi l'ha fatto
    l.tocca = C[(C.indexOf(da) + 1) % C.length];
  }
}
async function fatto(id, chi) {
  const quandoISO = new Date().toISOString();
  let dopo = null, nome = "";
  const ok = await casaCambia(SEZ, d => {
    const l = (d.lavori || []).find(x => x.id === id); if (!l) return false;
    segnaFatto(l, chi, quandoISO); dopo = tocca(l); nome = l.nome;
  });
  if (ok) toast(`✓ ${nome}${chi ? " · " + nomeP(chi) : ""}${dopo && dopo !== chi ? t(" · ora tocca " + aChi(nomeP(dopo)), " · now it's ") + nomeP(dopo) + t("", "'s turn") : ""}`);
}
/* chi l'ha fatto? */
let chiPer = null;
function sceltaChi() {
  const l = trova(chiPer); if (!l) return "";
  const P = persone(l.chi || []), tc = tocca(l), C = chiDi(l);
  P.sort((a, b) => (b === tc) - (a === tc) || C.includes(b) - C.includes(a));
  return `<div class="sh-head"><div><h3>${esc(l.icona || "🧹")} ${esc(l.nome)}</h3><div class="small muted">${t("Chi l'ha fatto?", "Who did it?")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fkw1">${P.map(p => `<button data-act="faChi" data-p="${p}">${avatar(p)}<b>${esc(nm(p))}</b>${p === tc ? `<small>${t("era il suo turno", "it was their turn")}</small>` : ""}</button>`).join("")}
      <button data-act="faChi" data-p="">${avatar(null, "nn")}<b>${t("Qualcun altro", "Someone else")}</b></button></div>`;
}

/* ---------- disegno ---------- */
function lavoro(l) {
  const st = statoDi(l), p = tocca(l), me = p && p === io(), pc = Math.round(passato(l) * 100);
  return `<div class="fk1 s-${st} ${fattoOggi(l) ? "fatto" : ""}">
    <div class="fk1h"><span class="fki1">${esc(l.icona || "🧹")}</span><div class="tx"><b>${esc(l.nome)}</b><span><em>${esc(quando(l))}</em> · ${esc(ogniTesto(ogniDi(l)))}</span></div>
      <button class="fke1" data-act="faEdit" data-id="${esc(l.id)}" aria-label="${t("Modifica", "Edit")}">✏️</button></div>
    <div class="fkb1" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%"></i></div>
    <div class="fk1f"><span class="fkp1 ${me ? "me" : ""}">${p ? avatar(p) : `<span class="fka1 nn">👥</span>`}<span>${p ? (me ? t("tocca a te", "your turn") : t("tocca " + aChi(nm(p)), "") + `<b>${esc(nm(p))}</b>` + t("", "'s turn")) : t("chiunque", "anyone")}${chiDi(l).length > 1 && l.modo !== "fisso" ? ` <small>· ${t("a turno", "taking turns")}</small>` : ""}</span></span>
      <button class="fkx1" data-act="faFatto" data-id="${esc(l.id)}"><i>✓</i>${t("Fatto", "Done")}</button></div>
    ${l.ultima ? `<small class="fku1">${esc(ultimaTesto(l))}</small>` : ""}</div>`;
}
const gruppo = (titolo, L, cls) => L.length ? `<section class="card span3 fks1 ${cls}"><div class="ch"><h2>${titolo} <span class="tag ${cls === "ritardo" ? "bad" : cls === "oggi" ? "warn" : "info"}">${L.length}</span></h2></div><div class="fkg1">${L.map(lavoro).join("")}</div></section>` : "";

/* esempi: solo con l'elenco vuoto, e solo quelli che l'utente sceglie */
let scelti = null;
function esempi() {
  const E = ESEMPI(); scelti = scelti || new Set(E.map((_, i) => i));
  return `<section class="card span3 fkz1"><div class="fkz1h"><span class="fkz1i" aria-hidden="true">${disegno()}</span><div><h3>${t("Nessuna faccenda, per ora", "No chores yet")}</h3>
      <p class="small muted">${t("Aggiungi i lavori di casa: ogni quanto vanno fatti e a chi toccano. Valgono su tutti i telefoni e tablet, e chiunque in casa può segnarli come fatti. Vuoi partire da qualche esempio? Tocca per scegliere.", "Add your household chores: how often they're due and whose turn it is. They're the same on every phone and tablet, and anyone at home can mark them done. Want to start from a few examples? Tap to choose.")}</p></div></div>
    <div class="cks1 fkz1l">${E.map(([ic, n, g], i) => `<button class="ck1 ${scelti.has(i) ? "on" : ""}" data-act="faEs" data-i="${i}"><span class="bx"></span><span class="fki1 sm">${ic}</span><span class="tx"><b>${esc(n)}</b></span><span class="st">${esc(ogniTesto(g))}</span></button>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="faEsOk" ${scelti.size ? "" : "disabled"}>${t(`Aggiungi questi ${scelti.size}`, `Add these ${scelti.size}`)}</button><button class="btn" data-act="faNuovo">＋ ${t("Ne creo una io", "I'll create my own")}</button></div>
    <p class="small muted" style="margin-top:10px">${t("Gli esempi partono «mai fatti» e senza persone: con ✏️ scegli a chi toccano.", "Examples start «never done» and with nobody assigned: use ✏️ to choose whose turn it is.")}</p></section>`;
}
/* disegno della plancia per l'elenco vuoto: secchio, spazzolone e bolle (SVG fatto apposta) */
const disegno = () => `<svg class="fkd1" viewBox="0 0 64 64"><path class="mo" d="M46 6 34 40"/><path class="mf" d="M27 38h15l3 6H24z"/><path class="bk" d="M12 34h26l-3 22H15z"/><path class="ac" d="M14 38h22"/>
  <circle class="bo b1" cx="20" cy="30" r="3"/><circle class="bo b2" cx="29" cy="27" r="2.2"/><circle class="bo b3" cx="25" cy="22" r="1.6"/><path class="sp" d="M52 20l2-4M56 26h4M53 31l3 2"/></svg>`;

function riavvia() {
  return `<section class="card span3"><div class="ch"><h2>🧹 ${t("Faccende", "Chores")}</h2></div><div class="note1">${casaErrore(SEZ) === "riavvia"
    ? t("Per usare le Faccende riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha cambiato anche la parte che salva i dati.", "To use Chores restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update also changed the part that stores the data.")
    : t("Non riesco a leggere le faccende da Home Assistant. Riprova tra poco.", "I can't read the chores from Home Assistant. Try again shortly.")}</div></section>`;
}
function pagina() {
  const s = sezione();
  if (s?.stato === "errore") return `<div class="g g3">${riavvia()}</div>`;
  if (s?.stato !== "ok") return `<div class="g g3"><section class="card span3"><div class="small muted">${t("Carico le faccende…", "Loading chores…")}</div></section></div>`;
  const tutti = lavori(), L = ordinati(mie() ? tutti.filter(perMe) : tutti);
  const R = L.filter(l => statoDi(l) === "ritardo"), O = L.filter(l => statoDi(l) === "oggi"), P = L.filter(l => statoDi(l) === "poi");
  const testa = `<section class="card span3 fkt1"><div class="ch"><h2>🧹 ${t("Faccende", "Chores")}
      ${tutti.length ? `<span class="tag ${R.length ? "bad" : O.length ? "warn" : "ok"}">${R.length ? R.length + " " + t("in ritardo", "overdue") : O.length ? O.length + " " + t("da fare oggi", "due today") : t("tutto in regola", "all on track")}</span>` : ""}</h2>
      <span class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">${io() && tutti.length ? `<span class="seg">${[["0", t("Tutte", "All")], ["1", t("Le mie", "Mine")]].map(([k, n]) => `<button class="${(mie() ? "1" : "0") === k ? "act" : ""}" data-act="faMie" data-v="${k}">${n}</button>`).join("")}</span>` : ""}
      <button class="btn pri sm" data-act="faNuovo">＋ ${t("Nuova faccenda", "New chore")}</button></span></div>
    <p class="small muted" style="margin:0">${t("Uguali su tutti i dispositivi: chiunque in casa può aggiungerle, cambiarle e segnarle come fatte.", "The same on every device: anyone at home can add, change and mark them done.")}</p></section>`;
  if (!tutti.length) return `<div class="g g3">${testa}${esempi()}</div>`;
  return `<div class="g g3">${testa}
    ${gruppo("⏰ " + t("In ritardo", "Overdue"), R, "ritardo")}${gruppo("📌 " + t("Oggi", "Today"), O, "oggi")}${gruppo("🗓️ " + t("Prossimi giorni", "Coming up"), P, "poi")}
    ${!L.length ? `<section class="card span3"><div class="small muted">${t("Niente che tocchi a te. 🎉", "Nothing on your list. 🎉")}</div></section>` : ""}</div>`;
}

/* ---------- Home: «Faccende di oggi» ---------- */
function homeCard() {
  const L = ordinati(lavori()), D = L.filter(l => mancano(l) <= 0), me = io();
  D.sort((a, b) => (tocca(b) === me && !!me) - (tocca(a) === me && !!me) || mancano(a) - mancano(b));   // prima le mie
  const prossima = L.find(l => mancano(l) > 0);
  const riga = l => { const p = tocca(l), st = statoDi(l);
    return `<div class="fkh1 s-${st}"><span class="fki1">${esc(l.icona || "🧹")}</span><div class="tx"><b>${esc(l.nome)}</b><span><em>${esc(st === "ritardo" ? quando(l) : l.ultima ? t("oggi", "today") : t("mai fatto", "never done"))}</em>${p ? " · " + (p === me ? t("tocca a te", "your turn") : esc(nm(p))) : ""}</span></div>
      <button class="fkx1" data-act="faFatto" data-id="${esc(l.id)}" aria-label="${t("Fatto", "Done")}: ${esc(l.nome)}"><i>✓</i><span>${t("Fatto", "Done")}</span></button></div>`; };
  return card("🧹 " + t("Faccende di oggi", "Today's chores"), D.length
    ? `<div class="fkhl1">${D.slice(0, 5).map(riga).join("")}</div>${D.length > 5 ? `<button class="btn sm" data-act="go" data-id="faccende" style="margin-top:10px">${t(`e altre ${D.length - 5}`, `and ${D.length - 5} more`)} ›</button>` : ""}`
    : `<div class="fkok1"><span>✓</span><div><b>${t("Tutto fatto per oggi", "All done for today")}</b>${prossima ? `<small>${t("Prossima: ", "Next: ")}${esc(prossima.icona || "")} ${esc(prossima.nome)} · ${esc(mancano(prossima) === 1 ? t("domani", "tomorrow") : giornoBreve(scadenza(prossima)))}</small>` : ""}</div></div>`,
    { link: [t("Tutte", "All"), "faccende"] });
}
HOME_EXTRA.faccende = { title: () => t("Faccende di oggi", "Today's chores"), render: homeCard, show: () => lavori().length > 0 };

/* ---------- ＋ e ✏️: nome, icona, ogni quanto, a chi tocca, ultima volta ---------- */
let F = null;
const oggiISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const dataLocale = iso => { const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
function apri(l) {
  F = l ? { ...JSON.parse(JSON.stringify(l)), nuovo: false, data: l.ultima ? dataLocale(l.ultima) : "", mai: !l.ultima }
    : { id: nuovoId(), nome: "", icona: "🧹", ogni: 7, chi: [], modo: "turno", tocca: null, nuovo: true, data: oggiISO(), mai: true };
  openSheet(scheda);
}
function scheda() {
  if (!F) return "";
  const P = persone(F.chi), C = F.chi.filter(p => S[p]), turno = F.modo !== "fisso" && C.length > 1, tc = tocca(F), n = ogniDi(F);
  const prossima = F.mai || !F.data ? t("da fare subito", "due now") : giornoBreve(piuGiorni(F.data + "T12:00:00", n));
  return `<div class="sh-head"><div><h3>${F.nuovo ? "＋ " + t("Nuova faccenda", "New chore") : "✏️ " + esc(F.nome)}</h3><div class="small muted">${t("Vale per tutta la casa, su tutti i dispositivi.", "For the whole home, on every device.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="fa1n" type="text" maxlength="60" value="${esc(F.nome)}" placeholder="${t("Pulire il bagno, portare fuori il cane…", "Clean the bathroom, walk the dog…")}" data-chg="faF" data-k="nome"></label>
    <div class="fl1">${t("Icona", "Icon")}</div><div class="ico1">${ICONE.map(ic => `<button class="${F.icona === ic ? "on" : ""}" data-act="faIco" data-v="${ic}">${ic}</button>`).join("")}</div>
    <div class="fl1">${t("Ogni quanti giorni", "How often (days)")}</div>
    <div class="row" style="gap:10px;flex-wrap:wrap"><input id="fa1o" class="fkn1" type="number" min="1" max="365" inputmode="numeric" value="${n}" data-chg="faOgni" aria-label="${t("Giorni", "Days")}">
      <div class="vr1">${[1, 2, 3, 7, 14, 30].map(g => `<button class="${n === g ? "on" : ""}" data-act="faOgniV" data-v="${g}">${g === 7 ? t("1 sett.", "1 wk") : g === 14 ? t("2 sett.", "2 wk") : g === 30 ? t("1 mese", "1 mo") : g}</button>`).join("")}</div></div>
    <p class="small muted" style="margin:6px 0 0">${esc(ogniTesto(n))}</p>
    <div class="fl1">${t("A chi tocca", "Whose turn")}</div>
    ${P.length ? `<div class="fkw1 sel">${P.map(p => { const i = C.indexOf(p); return `<button class="${i >= 0 ? "on" : ""}" data-act="faP" data-p="${p}">${avatar(p)}<b>${esc(nm(p))}</b>${i >= 0 && turno ? `<small>${i + 1}°</small>` : ""}</button>`; }).join("")}</div>
      ${C.length > 1 ? `<div class="seg" style="margin-top:10px">${[["turno", "🔄 " + t("A turno", "Taking turns")], ["fisso", "📌 " + t("Sempre la stessa persona", "Always the same person")]].map(([k, x]) => `<button class="${(F.modo === "fisso" ? "fisso" : "turno") === k ? "act" : ""}" data-act="faModo" data-v="${k}">${x}</button>`).join("")}</div>` : ""}
      <p class="small muted" style="margin:8px 0 0">${!C.length ? t("Nessuno scelto: la può fare chiunque.", "Nobody chosen: anyone can do it.") : turno ? t("A turno, nell'ordine dei numeri: dopo ogni «Fatto» tocca al successivo.", "Taking turns in the numbered order: after each «Done» it's the next one's turn.") : t("Tocca sempre " + aChi(nm(C[0])), "Always ") + esc(nm(C[0])) + t(".", "'s job.") + (F.modo === "fisso" && C.length > 1 ? " " + t("(la prima scelta)", "(the first one chosen)") : "")}</p>
      ${turno ? `<label class="fld1"><span>${t("Adesso tocca a", "Now it's the turn of")}</span><select data-chg="faTocca">${C.map(p => `<option value="${p}" ${tc === p ? "selected" : ""}>${esc(nm(p))}</option>`).join("")}</select></label>` : ""}`
      : `<p class="small muted" style="margin:0">${t("Nessuna persona in Home Assistant (Impostazioni → Persone): la può fare chiunque.", "No people in Home Assistant (Settings → People): anyone can do it.")}</p>`}
    <div class="fl1">${t("Ultima volta", "Last time")}</div>
    <div class="row" style="gap:12px;flex-wrap:wrap;align-items:center"><label class="row" style="gap:8px"><input type="checkbox" data-chg="faMai" ${F.mai ? "checked" : ""}> ${t("Mai fatto", "Never done")}</label>
      ${F.mai ? "" : `<input id="fa1d" class="fkn1 dt" type="date" max="${oggiISO()}" value="${esc(F.data)}" data-chg="faData" aria-label="${t("Ultima volta", "Last time")}">`}</div>
    <p class="small muted" style="margin:6px 0 0">${t("Prossima volta: ", "Next time: ")}<b>${esc(prossima)}</b></p>
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="faSalva">💾 ${t("Salva", "Save")}</button>
      ${F.nuovo ? "" : `<button class="btn" data-act="faFattoDa" data-id="${esc(F.id)}">✓ ${t("Fatto da…", "Done by…")}</button>${(F.storia || []).length ? `<button class="btn" data-act="faAnnulla" data-id="${esc(F.id)}">↺ ${t("Annulla l'ultimo «Fatto»", "Undo the last «Done»")}</button>` : ""}
        <button class="btn bad" data-act="faDel" data-id="${esc(F.id)}">🗑 ${t("Elimina", "Delete")}</button>`}</div>
    ${!F.nuovo && (F.storia || []).length ? `<div class="fl1">${t("Le ultime volte", "Recent times")}</div><div class="fkl1">${F.storia.slice(0, 6).map(s => `<div>${avatar(s.chi)}<b>${esc(s.chi && S[s.chi] ? nm(s.chi) : t("Qualcuno", "Someone"))}</b><span>${esc(new Date(s.quando).toLocaleString(LOC, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></div>`).join("")}</div>` : ""}`;
}
CHG.faF = el => { if (F) F[el.dataset.k] = el.value; };
CHG.faOgni = el => { if (!F) return; F.ogni = Math.max(1, Math.min(365, Math.round(+el.value) || 1)); render(); };
CHG.faTocca = el => { if (F) F.tocca = el.value; };
CHG.faMai = el => { if (!F) return; F.mai = el.checked; if (!F.mai && !F.data) F.data = oggiISO(); render(); };
CHG.faData = el => { if (!F) return; F.data = el.value && el.value <= oggiISO() ? el.value : oggiISO(); if (el.value !== F.data) el.value = F.data; render(); };
const leggiCampi = () => { const n = document.getElementById("fa1n"); if (F && n) F.nome = n.value; };

Object.assign(ACT, {
  faNuovo: () => apri(null),
  faEdit: el => { const l = trova(el.dataset.id); if (l) apri(l); },
  faIco: el => { leggiCampi(); F.icona = el.dataset.v; render(); },
  faOgniV: el => { leggiCampi(); F.ogni = +el.dataset.v; const o = document.getElementById("fa1o"); if (o) o.value = F.ogni; render(); },
  faP: el => { leggiCampi(); const p = el.dataset.p, C = F.chi.filter(x => S[x]);
    F.chi = C.includes(p) ? C.filter(x => x !== p) : [...C, p];
    if (F.tocca && !F.chi.includes(F.tocca)) F.tocca = null; render(); },
  faModo: el => { leggiCampi(); F.modo = el.dataset.v; render(); },
  faSalva: async () => {
    leggiCampi();
    const nome = String(F.nome || "").trim().slice(0, 60);
    if (!nome) { toast(t("Scrivi il nome della faccenda", "Write the chore's name"), true); document.getElementById("fa1n")?.focus(); return; }
    const o = document.getElementById("fa1o"); if (o) F.ogni = Math.max(1, Math.min(365, Math.round(+o.value) || 1));
    const orig = F.nuovo ? null : trova(F.id);
    /* ultima volta: se il giorno non cambia tengo l'ora vera; oggi = adesso; un altro giorno = a mezzogiorno */
    const ultima = F.mai ? null : orig?.ultima && dataLocale(orig.ultima) === F.data ? orig.ultima : F.data === oggiISO() ? new Date().toISOString() : new Date(F.data + "T12:00:00").toISOString();
    const v = { nome, icona: F.icona || "🧹", ogni: F.ogni, chi: F.chi.filter(p => S[p]), modo: F.modo === "fisso" ? "fisso" : "turno", tocca: F.tocca || null, ultima };
    const id = F.id, nuovo = F.nuovo;
    const ok = await casaCambia(SEZ, d => {
      d.lavori = d.lavori || [];
      const l = d.lavori.find(x => x.id === id);
      if (l) Object.assign(l, v);
      else { if (d.lavori.length >= MAX_LAVORI) { toast(t("Troppe faccende", "Too many chores"), true); return false; } d.lavori.push({ id, ...v, storia: [] }); }
    }, (nuovo ? "＋ " : "💾 ") + nome);
    if (ok) { F = null; closeSheet(); }
  },
  faDel: async el => {
    if (!sicuro(el, t("Tocca ancora per eliminare", "Tap again to delete"))) return;
    const id = el.dataset.id, nome = trova(id)?.nome || "";
    if (await casaCambia(SEZ, d => { const n = (d.lavori || []).length; d.lavori = (d.lavori || []).filter(x => x.id !== id); if (d.lavori.length === n) return false; }, "🗑 " + nome)) { F = null; closeSheet(); }
  },
  faFatto: el => {
    const id = el.dataset.id, me = io();
    if (me) return fatto(id, me);   // so chi sei: lo segno a nome tuo (per un'altra persona: ✏️ → «Fatto da…»)
    chiPer = id; openSheet(sceltaChi);   // tablet di casa o utente senza persona: chiedo chi l'ha fatto
  },
  faFattoDa: el => { chiPer = el.dataset.id; F = null; openSheet(sceltaChi); },
  faChi: el => { const id = chiPer; closeSheet(); fatto(id, el.dataset.p || null); },
  faAnnulla: async el => {
    const id = el.dataset.id;
    const ok = await casaCambia(SEZ, d => { const l = (d.lavori || []).find(x => x.id === id), s = l?.storia?.[0]; if (!s) return false;
      l.storia = l.storia.slice(1); l.ultima = s.prima?.ultima || null; l.tocca = s.prima?.tocca || null; }, "↺ " + t("Annullato", "Undone"));
    if (ok) { const l = trova(id); if (l) apri(l); }
  },
  faMie: el => { sSet("faccendeMie", el.dataset.v); render(true); },
  faEs: el => { const i = +el.dataset.i; scelti.has(i) ? scelti.delete(i) : scelti.add(i); render(); },
  faEsOk: async () => {
    const E = ESEMPI().filter((_, i) => scelti.has(i)); if (!E.length) return;
    const ok = await casaCambia(SEZ, d => {
      d.lavori = d.lavori || [];
      if (d.lavori.length) return false;   // nel frattempo qualcuno ne ha aggiunte: niente esempi
      d.lavori = E.map(([icona, nome, ogni]) => ({ id: nuovoId(), nome, icona, ogni, chi: [], modo: "turno", tocca: null, ultima: null, storia: [] }));
    }, "＋ " + E.length + " " + t("faccende", "chores"));
    if (ok) scelti = null;
  },
});

page("faccende", { title: t("Faccende", "Chores"), short: t("Faccende", "Chores"), icon: "🧹", order: 41,
  badge: () => lavori().some(l => mancano(l) < 0), render: pagina });

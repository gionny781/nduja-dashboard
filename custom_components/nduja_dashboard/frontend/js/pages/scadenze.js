/* Scadenze: bollette, tagliando e revisione, assicurazione, bollo, visite, compleanni, abbonamenti, garanzie…
   Dove: una lista todo.* di Home Assistant scelta dall'amministratore (consigliata una Local To-do «Scadenze»), con la scadenza
   della voce (due_date, o due_datetime se c'è l'ora). Senza scelta uso la lista che si chiama «Scadenze» (o simile).
   Categoria, ripetizione e importo stanno nella descrizione della voce, in una riga leggibile anche nelle app di Home Assistant:
     «🏷️ Bollette · 🔁 Ogni mese · 💰 82,00 €»   poi le note libere   e «⏰ Ricorda il AAAA-MM-GG» («Ricordamelo domani» dal telefono).
   Si leggono tutte e due le lingue, così la lista resta valida se cambia la lingua di Home Assistant.
   Con «Fatto» una scadenza che si ripete passa da sola alla prossima data dopo oggi; le altre si spuntano.
   Promemoria: l'automazione «'Nduja · scadenze» (etichetta «'Nduja») ogni giorno all'ora scelta legge la lista e manda la notifica
   ai telefoni delle persone scelte con l'anticipo scelto; le azioni «Fatto» e «Ricordamelo domani» della notifica le gestisce
   la stessa automazione, anche a plancia chiusa. Si riscrive da sola quando cambiano lista, persone, anticipo o ora.
   Scelte della casa (LAYOUT.scadenze, solo amministratori):
     { lista: "todo.x", promemoria: { persone: [person.x], altri: [servizi notify], anticipi: [0, 1, 3, 7], ora: "HH:MM" } }
   In Home la scheda «Scadenze» con le prossime 3; scadute e di oggi anche negli Avvisi. */
import { S, REG, DEVICES, ACT, CHG, UI, VISTE, HOME_EXTRA, LAYOUT, PAGES, utenteCfg, t, LOC, esc, nm, nmHA, ok, attr, allEnts, page, ws, api, cached,
  ready, toast, openSheet, closeSheet, render, sicuro, isAdmin, go, apriHA, etichettaNduja } from "../core.js";
import { cambia } from "../edit.js";
import { voci, cmd, leggi, listaKo, ESCLUSE } from "./liste.js";

/* funzioni delle liste di Home Assistant (TodoListEntityFeature) */
const F_ADD = 1, F_DEL = 2, F_UPD = 4, F_DATA = 16, F_ORA = 32, F_DESC = 64;
const puo = (id, f) => ((+attr(id, "supported_features") || 0) & f) === f;
/** una lista va bene per le scadenze se si può aggiungere, cambiare e mettere la data */
const adatta = id => puo(id, F_ADD) && puo(id, F_UPD) && (puo(id, F_DATA) || puo(id, F_ORA));
const NOME_LISTA = /scadenz|deadline|due.?date|promemoria|reminder|rinnov|renewal|bollett/i;
const AUT = "nduja_scadenze";
const C = () => LAYOUT.scadenze || {};

/** la lista delle scadenze: quella scelta, altrimenti una lista adatta che si chiama «Scadenze» (meglio se Local To-do) */
export function lista() {
  const c = C().lista; if (c && S[c]) return c;
  const L = allEnts("todo", adatta).filter(id => NOME_LISTA.test(id + " " + nmHA(id)));
  return L.sort((a, b) => (REG[b]?.platform === "local_todo") - (REG[a]?.platform === "local_todo") || a.localeCompare(b))[0] || null;
}
const paginaAttiva = () => LAYOUT.pages?.scadenze !== false;
/* la lista ha la sua pagina: nella pagina Liste non la ripeto (se spegni Scadenze, torna lì) */
ESCLUSE.push(id => paginaAttiva() && id === lista());

/* ---------- categorie ---------- */
const CAT = () => [
  ["bollette", "🧾", t("Bollette", "Bills")], ["auto", "🚗", t("Auto", "Car")], ["casa", "🏠", t("Casa", "Home")], ["salute", "🩺", t("Salute", "Health")],
  ["documenti", "🪪", t("Documenti", "Documents")], ["abbonamenti", "📺", t("Abbonamenti", "Subscriptions")], ["altro", "📌", t("Altro", "Other")]];
/* nomi in tutte e due le lingue: la descrizione resta leggibile anche se cambia la lingua */
const NOMI_CAT = { bollette: ["bollette", "bolletta", "bills", "bill"], auto: ["auto", "car"], casa: ["casa", "home", "house"], salute: ["salute", "health"],
  documenti: ["documenti", "documents"], abbonamenti: ["abbonamenti", "subscriptions"], altro: ["altro", "other"] };
const cat = k => CAT().find(c => c[0] === k) || CAT()[6];
const catDaNome = s => { s = String(s || "").trim().toLowerCase(); return Object.keys(NOMI_CAT).find(k => NOMI_CAT[k].includes(s)) || null; };
/* indovino la categoria dal titolo (si cambia con un tocco) */
const INDOVINA = [
  ["auto", /tagliand|revision|\bbollo\b|rc ?auto|assicurazione (auto|moto|macchina)|gomme|pneumatic|cambio olio|\bauto\b|macchina|\bmoto\b|car insurance|car tax|\bmot\b|\btyres?\b|\bcar\b/i],
  ["bollette", /bollett|\bluce\b|\bgas\b|\bacqua\b|\btari\b|telefon|internet|fibra|\benel\b|\bhera\b|\ba2a\b|\biren\b|\bbills?\b|electricity|water bill|phone bill|utilit/i],
  ["salute", /visita|dentist|medic|analisi|vaccin|oculist|pediatr|ginecolog|cardiolog|dermatolog|controllo|check.?up|doctor|appointment|health|farmac/i],
  ["documenti", /carta d.identit|\bcie\b|passaport|patente|permesso|document|tessera|\bisee\b|\b730\b|dichiarazion|\btasse\b|\bimu\b|\bf24\b|garanzi|passport|licen[cs]e|\btax|warrant/i],
  ["abbonamenti", /abbonament|netflix|spotify|disney|prime video|amazon prime|\bdazn\b|\bsky\b|now tv|palestra|\bgym\b|icloud|google one|dominio|subscription|membership/i],
  ["casa", /condomin|affitto|mutuo|caldaia|manutenz|assicurazione casa|spazzacamin|giardin|\brent\b|mortgage|boiler|house|home insurance/i]];
const indovina = titolo => (INDOVINA.find(([, re]) => re.test(titolo || "")) || ["altro"])[0];

/* ---------- ripetizione ---------- */
/** { tipo: "no" | "sett" | "mesi" | "anno", n: ogni quanti mesi, g: giorno del mese da tenere (29-31, per non scivolare dopo febbraio) } */
const NO = { tipo: "no" };
function ripTesto(r) {
  const g = r.g ? t(` (giorno ${r.g})`, ` (day ${r.g})`) : "";
  if (r.tipo === "sett") return t("Ogni settimana", "Every week");
  if (r.tipo === "anno") return t("Ogni anno", "Every year") + g;
  if (r.tipo === "mesi" && r.n % 12 === 0) return (r.n > 12 ? t(`Ogni ${r.n / 12} anni`, `Every ${r.n / 12} years`) : t("Ogni anno", "Every year")) + g;
  if (r.tipo === "mesi") return (r.n > 1 ? t(`Ogni ${r.n} mesi`, `Every ${r.n} months`) : t("Ogni mese", "Every month")) + g;
  return "";
}
function ripDa(s) {
  s = String(s || "").toLowerCase();
  const g = +(s.match(/(\d{1,2}) *\)/) || [])[1] || null, s0 = s.replace(/\(.*\)/g, "");
  if (/settiman|week/.test(s0)) return { tipo: "sett" };
  const n = Math.max(1, +(s0.match(/(\d+)/) || [])[1] || 1);
  if (/ann|year/.test(s0)) return n > 1 ? { tipo: "mesi", n: Math.min(120, n * 12), g } : { tipo: "anno", g };   // «ogni 2 anni» scritto a mano: 24 mesi
  if (/mes|month/.test(s0)) return { tipo: "mesi", n: Math.min(120, n), g };
  return NO;
}
const ripBreve = r => r.tipo === "sett" ? t("ogni settimana", "weekly") : r.tipo === "anno" || (r.tipo === "mesi" && r.n === 12) ? t("ogni anno", "yearly")
  : r.tipo === "mesi" && r.n % 12 === 0 ? t(`ogni ${r.n / 12} anni`, `every ${r.n / 12} years`) : r.tipo === "mesi" ? (r.n > 1 ? t(`ogni ${r.n} mesi`, `every ${r.n} months`) : t("ogni mese", "monthly")) : "";

/* ---------- date ---------- */
const mezzanotte = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const giorniTra = (a, b) => Math.round((mezzanotte(b) - mezzanotte(a)) / 864e5);
const iso = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const hm = d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
/** un passo (i volte) della ripetizione a partire da d0, tenendo l'ora */
function passo(d0, r, i) {
  if (r.tipo === "sett") { const d = new Date(d0); d.setDate(d.getDate() + 7 * i); return d; }
  const tot = d0.getMonth() + (r.tipo === "anno" ? 12 : r.n) * i, y = d0.getFullYear() + Math.floor(tot / 12), m = tot % 12;
  return new Date(y, m, Math.min(r.g || d0.getDate(), new Date(y, m + 1, 0).getDate()), d0.getHours(), d0.getMinutes());
}
/** la prossima scadenza dopo oggi */
function prossima(d0, r) {
  const oggi = mezzanotte(Date.now());
  for (let i = 1; i < 2000; i++) { const d = passo(d0, r, i); if (mezzanotte(d) > oggi) return d; }
  return null;
}

/* ---------- soldi ---------- */
const valuta = () => (cached("haconfig", 6 * 3600e3, () => ws({ type: "get_config" })) || {}).currency || "EUR";
const soldi = v => { try { return v.toLocaleString(LOC, { style: "currency", currency: valuta() }); } catch { return v.toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } };
/** «82,00 €», «€ 1.234,50», «82.5» → numero (l'ultimo separatore con 1-2 cifre dopo è quello dei decimali) */
function numero(s) {
  s = String(s ?? "").replace(/[^\d.,-]/g, ""); if (!/\d/.test(s)) return null;
  const i = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  const v = i >= 0 && s.length - i - 1 <= 2 ? +(s.slice(0, i).replace(/[.,]/g, "") + "." + s.slice(i + 1)) : +s.replace(/[.,]/g, "");
  return isNaN(v) ? null : Math.round(v * 100) / 100;
}

/* ---------- voci: dalla descrizione ai campi e ritorno ---------- */
const RICORDA = /⏰[^\n]*?(\d{4}-\d{2}-\d{2})/;
/** voce della lista → { uid, titolo, fatta, giorno (Date a mezzanotte) | null, ora: "HH:MM" | "", d (Date con l'ora), cat, rip, importo, note, ricorda } */
function leggiVoce(x) {
  let meta = null, ricorda = null; const note = [];
  for (const r of String(x.description || "").split(/\r?\n/)) {
    if (meta == null && /🏷|🔁|💰/.test(r)) { meta = r; continue; }
    const m = r.match(RICORDA); if (m) { ricorda = m[1]; continue; }
    note.push(r);
  }
  const campo = em => { const m = meta && meta.match(new RegExp(em + "\\uFE0F? *([^·\\n]+)")); return m ? m[1].trim() : ""; };
  let d = null, ora = "";
  if (x.due) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(x.due)) d = new Date(x.due + "T00:00:00");
    else { d = new Date(x.due); ora = isNaN(d) ? "" : hm(d); }
    if (isNaN(d)) d = null;
  }
  return { uid: x.uid, titolo: x.summary, fatta: x.status === "completed", tmp: !!x.tmp, d, giorno: d ? mezzanotte(d) : null, ora,
    cat: catDaNome(campo("🏷")) || indovina(x.summary), rip: ripDa(campo("🔁")), importo: numero(campo("💰")),
    note: note.join("\n").trim(), ricorda, haMeta: meta != null };
}
/** la descrizione da salvare */
function descrizione({ cat: k, rip, importo, note, ricorda }) {
  const meta = ["🏷️ " + cat(k)[2], rip.tipo !== "no" ? "🔁 " + ripTesto(rip) : "", importo != null ? "💰 " + soldi(importo) : ""].filter(Boolean).join(" · ");
  return [meta, String(note || "").trim(), ricorda ? "⏰ " + t("Ricorda il", "Remind on") + " " + ricorda : ""].filter(Boolean).join("\n");
}
/** tutte le voci lette (null finché la lista non arriva) */
function tutte() {
  const id = lista(); if (!id) return null;
  const v = voci(id); return v ? v.map(leggiVoce) : null;
}
const daFare = () => (tutte() || []).filter(x => !x.fatta);
const gg = x => x.giorno ? giorniTra(Date.now(), x.giorno) : null;
/** gruppo: scadute, oggi, settimana, poi, senza data */
const gruppo = x => { const g = gg(x); return g == null ? "senza" : g < 0 ? "scadute" : g === 0 ? "oggi" : g <= 7 ? "settimana" : "poi"; };
const ordina = L => [...L].sort((a, b) => (a.d ? a.d.getTime() : 9e15) - (b.d ? b.d.getTime() : 9e15) || String(a.titolo).localeCompare(String(b.titolo), LOC));
/** quando, in parole: { testo, cls } */
function quando(x, { fatta = false } = {}) {
  const g = gg(x); if (g == null) return { testo: t("senza data", "no date"), cls: "senza" };
  const o = x.ora ? " · " + x.ora : "";
  const data = x.d.toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short", year: x.d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  if (fatta) return { testo: data, cls: "poi" };
  if (g < 0) return { testo: g === -1 ? t("scaduta ieri", "overdue since yesterday") : t(`scaduta da ${-g} giorni`, `overdue by ${-g} days`), cls: "ritardo" };
  if (g === 0) return { testo: t("oggi", "today") + o, cls: "oggi" };
  if (g === 1) return { testo: t("domani", "tomorrow") + o, cls: "domani" };
  return { testo: (g < 7 ? x.d.toLocaleDateString(LOC, { weekday: "long" }) : t(`tra ${g} giorni`, `in ${g} days`) + " · " + data) + o, cls: "poi" };
}
const scaduteOggi = () => daFare().filter(x => { const g = gg(x); return g != null && g <= 0; });

/* ---------- comandi ---------- */
const trova = uid => (tutte() || []).find(x => x.uid === uid);
const voceGrezza = uid => (voci(lista()) || []).find(x => x.uid === uid);
/** scadenza per Home Assistant: { due_date } o { due_datetime } secondo quello che la lista accetta */
function scadenzaHA(id, data, ora) {
  if (!data) return { [puo(id, F_DATA) ? "due_date" : "due_datetime"]: null };
  if (puo(id, F_ORA) && (ora || !puo(id, F_DATA))) return { due_datetime: `${data} ${ora || "09:00"}:00` };
  return { due_date: data };
}
async function fatto(uid) {
  const id = lista(), x = trova(uid), g = voceGrezza(uid); if (!id || !x || x.tmp || !g) return;
  const pulita = puo(id, F_DESC) && x.ricorda ? { description: descrizione({ ...x, ricorda: null }) } : {};
  if (x.rip.tipo !== "no" && x.d) {
    const p = prossima(x.d, x.rip); if (!p) return;
    const data = scadenzaHA(id, iso(p), x.ora ? hm(p) : "");
    g.due = data.due_date || new Date(`${iso(p)}T${x.ora || "09:00"}:00`).toISOString(); render();
    if (await cmd(id, "update_item", { item: uid, ...data, ...pulita })) toast("✓ " + x.titolo + " · " + t("prossima: ", "next: ") + p.toLocaleDateString(LOC, { day: "numeric", month: "long", year: p.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }));
    return;
  }
  g.status = "completed"; render();
  if (await cmd(id, "update_item", { item: uid, status: "completed", ...pulita })) toast("✓ " + x.titolo);
}
async function riapri(uid) {
  const id = lista(), g = voceGrezza(uid); if (!id || !g) return;
  g.status = "needs_action"; render();
  await cmd(id, "update_item", { item: uid, status: "needs_action" });
}

/* ---------- disegno ---------- */
/* il foglietto del calendario: mese in alto (colore della categoria), giorno grande */
function foglietto(x) {
  if (!x.d) return `<span class="sc1dt vuoto" aria-hidden="true"><i>—</i><b>?</b></span>`;
  return `<span class="sc1dt" aria-hidden="true"><i>${esc(x.d.toLocaleDateString(LOC, { month: "short" }).replace(".", ""))}</i><b>${x.d.getDate()}</b></span>`;
}
function riga(x, { piccola = false } = {}) {
  const q = quando(x, { fatta: x.fatta }), c = cat(x.cat), id = lista(), upd = puo(id, F_UPD) && !x.tmp;
  const sotto = [`<em class="sc1q ${x.fatta ? "" : q.cls}">${x.fatta ? "" : q.cls === "ritardo" ? "⚠️ " : ""}${esc(q.testo)}</em>`, piccola ? "" : esc(c[2]), x.rip.tipo !== "no" && !piccola ? "🔁 " + esc(ripBreve(x.rip)) : ""].filter(Boolean).join(" · ");
  const btn = x.fatta ? `<button class="sc1ok ri" data-act="scRiapri" data-uid="${esc(x.uid)}" ${upd ? "" : "disabled"} aria-label="${t("Di nuovo da fare", "Not done")}" title="${t("Di nuovo da fare", "Not done")}">↺</button>`
    : `<button class="sc1ok" data-act="scFatto" data-uid="${esc(x.uid)}" ${upd ? "" : "disabled"} aria-label="${esc(t("Fatto: ", "Done: ") + x.titolo)}" title="${x.rip.tipo !== "no" ? t("Fatto: passa alla prossima", "Done: move to the next one") : t("Fatto", "Done")}"><i></i></button>`;
  return `<div class="sc1r ${piccola ? "sm" : ""} ${x.fatta ? "fatta" : "s-" + q.cls} ${x.tmp ? "tmp" : ""}" data-c="${x.cat}">
    <button class="sc1t" data-act="scApri" data-uid="${esc(x.uid)}">${foglietto(x)}<span class="tx"><b><span class="sc1ci" aria-hidden="true">${c[1]}</span> ${esc(x.titolo)}</b><small>${sotto}</small></span>
      ${x.importo != null ? `<span class="sc1e">${esc(soldi(x.importo))}</span>` : ""}</button>${btn}</div>`;
}
/* disegno della plancia per «niente in scadenza»: foglio del calendario con gli anelli e la spunta (SVG fatto apposta) */
const disegno = () => `<svg class="sc1zd" viewBox="0 0 64 64" aria-hidden="true"><path class="bo" d="M12 14h40v40H12z"/><path class="ba" d="M12 14h40v10H12z"/>
  <path class="an" d="M22 9v9M42 9v9"/><path class="ok" d="M23 39l6 6 13-13"/></svg>`;
const UIS = { fatte: false };
const GRUPPI = () => [["scadute", "⚠️", t("Scadute", "Overdue")], ["oggi", "📌", t("Oggi", "Today")], ["settimana", "📆", t("Prossimi 7 giorni", "Next 7 days")],
  ["poi", "🗓", t("Più avanti", "Later")], ["senza", "…", t("Senza data", "No date")]];
function elenco(id) {
  const T = tutte();
  if (!ok(id)) return `<div class="note1">${t("La lista non è raggiungibile adesso: controlla l'integrazione in Home Assistant.", "The list isn't reachable right now: check the integration in Home Assistant.")}</div>`;
  if (!T && listaKo(id)) return `<div class="note1">${t("Non riesco a leggere la lista. ", "I can't read the list. ")}<button class="lnk" data-act="scRileggi">${t("Riprova", "Try again")}</button></div>`;
  if (!T) return `<div class="small muted sc1car">${t("Carico le scadenze…", "Loading deadlines…")}</div>`;
  const A = T.filter(x => !x.fatta), D = T.filter(x => x.fatta), g = {};
  A.forEach(x => (g[gruppo(x)] = g[gruppo(x)] || []).push(x));
  const tot = L => { const v = L.filter(x => x.importo != null).reduce((s, x) => s + x.importo, 0); return v ? `<em>${esc(soldi(v))}</em>` : ""; };
  const corpo = A.length ? GRUPPI().filter(([k]) => g[k]).map(([k, ic, n]) => `<div class="sc1gh ${k}"><span aria-hidden="true">${ic}</span>${esc(n)}<i>${g[k].length}</i>${tot(g[k])}</div>
      <div class="sc1l">${ordina(g[k]).map(x => riga(x)).join("")}</div>`).join("")
    : `<div class="sc1z"><span class="sc1zi">${disegno()}</span><div><b>${t("Niente in scadenza", "Nothing due")}</b><small>${t("Aggiungi bollette, revisione, assicurazione, visite, compleanni…: ti avviso io prima che scadano.", "Add bills, car service, insurance, appointments, birthdays…: I'll remind you before they're due.")}</small></div></div>`;
  const fine = D.length ? `<div class="sc1fh"><button class="lnk" data-act="scFatte" aria-expanded="${UIS.fatte}">✓ ${t("Fatte", "Done")} (${D.length}) ${UIS.fatte ? "▴" : "▾"}</button><span class="grow"></span>
      ${UIS.fatte && puo(id, F_DEL) ? `<button class="btn sm" data-act="scSvuota">🧹 ${t("Svuota le fatte", "Clear done")}</button>` : ""}</div>
    ${UIS.fatte ? `<div class="sc1l">${ordina(D).reverse().map(x => riga(x)).join("")}</div>` : ""}` : "";
  return corpo + fine;
}
function testa(id) {
  const A = daFare(), sc = A.filter(x => gruppo(x) === "scadute").length, og = A.filter(x => gruppo(x) === "oggi").length, T = tutte();
  const frase = !T ? "&nbsp;" : !A.length ? t("tutto in ordine", "all sorted") : [sc ? `<b class="r">${sc}</b> ${t(sc === 1 ? "scaduta" : "scadute", "overdue")}` : "", og ? `<b class="o">${og}</b> ${t("oggi", "today")}` : "",
    `<b>${A.length}</b> ${t(A.length === 1 ? "da pagare o da fare" : "da pagare o da fare", "to pay or do")}`].filter(Boolean).join(" · ");
  return `<div class="sc1h"><div class="tx"><h2>⏰ ${t("Scadenze", "Deadlines")}</h2><span>${frase}</span></div>
    <div class="sc1ha">${puo(id, F_ADD) && ok(id) ? `<button class="btn pri" data-act="scNuova">＋ ${t("Nuova", "New")}</button>` : ""}${isAdmin() ? `<button class="btn sm" data-act="scCfg" title="${t("Lista delle scadenze", "Deadlines list")}" aria-label="${t("Lista delle scadenze", "Deadlines list")}">⚙️</button>` : ""}</div></div>`;
}
/* riepilogo: totale del mese per categoria */
function mese() {
  const ora = new Date(), m = ora.getMonth(), y = ora.getFullYear();
  const L = daFare().filter(x => x.d && x.d.getMonth() === m && x.d.getFullYear() === y && x.importo != null), tot = L.reduce((s, x) => s + x.importo, 0);
  const per = {}; L.forEach(x => per[x.cat] = (per[x.cat] || 0) + x.importo);
  const max = Math.max(1, ...Object.values(per)), nome = ora.toLocaleDateString(LOC, { month: "long" });
  return `<section class="card sc1m"><div class="ch"><h2>💰 ${esc(nome[0].toUpperCase() + nome.slice(1))}</h2></div>
    <div class="sc1tot">${esc(soldi(tot))}</div><div class="small muted">${L.length ? t(`da pagare questo mese · ${L.length} scadenz${L.length === 1 ? "a" : "e"} con importo`, `to pay this month · ${L.length} with an amount`) : t("Nessun importo questo mese: aggiungilo nella scadenza (facoltativo).", "No amounts this month: add one to a deadline (optional).")}</div>
    ${L.length ? `<div class="sc1cb">${CAT().filter(c => per[c[0]]).sort((a, b) => per[b[0]] - per[a[0]]).map(c => `<div data-c="${c[0]}"><span>${c[1]} ${esc(c[2])}</span><b>${esc(soldi(per[c[0]]))}</b><i><u style="width:${Math.max(4, per[c[0]] / max * 100)}%"></u></i></div>`).join("")}</div>` : ""}</section>`;
}
function promemoriaCard() {
  if (isAdmin()) serviziNotify();   // preparo l'elenco dei telefoni per 🔔
  const p = C().promemoria, on = !!p, chi = p ? (p.persone || []).filter(x => S[x]).map(x => nm(x)).concat((p.altri || []).map(nomeServizio)) : [];
  return `<section class="card sc1p"><div class="ch"><h2>🔔 ${t("Promemoria", "Reminders")}</h2>${isAdmin() ? `<button class="btn sm" data-act="scProm">${on ? "✏️" : t("Attiva", "Turn on")}</button>` : ""}</div>
    ${on ? `<div class="sc1ps"><b>${esc(anticipiTesto(p.anticipi))}</b><span>${t("alle", "at")} ${esc(p.ora || "09:00")} · ${esc(chi.join(", ") || "—")}</span></div>
      <div class="small muted" style="margin-top:8px">${t("Sul telefono con «✓ Fatto» e «⏰ Ricordamelo domani».", "On the phone with «✓ Done» and «⏰ Remind me tomorrow».")}</div>`
    : `<div class="small muted">${isAdmin() ? t("Una notifica sul telefono prima di ogni scadenza, anche a plancia chiusa.", "A phone notification before each deadline, even with the dashboard closed.") : t("Spenti. Li attiva un amministratore.", "Off. An admin can turn them on.")}</div>`}</section>`;
}
function pagina() {
  const id = lista();
  if (!id) return `<div class="g g3"><section class="card span3">${configura()}</section></div>`;
  const desc = puo(id, F_DESC);
  return `<div class="sc1w"><section class="card sc1c">${testa(id)}
      ${desc ? "" : `<div class="note1" style="margin-bottom:10px">${t("Questa lista non ha la descrizione: categoria, ripetizione e importo non si possono salvare. Meglio una lista «Local To-do» (⚙️).", "This list has no description: category, repetition and amount can't be saved. A «Local To-do» list is better (⚙️).")}</div>`}
      <div class="sc1b">${elenco(id)}</div></section>
    <div class="sc1sd">${mese()}${promemoriaCard()}</div></div>`;
}

/* ---------- senza lista: sceglierla o crearla ---------- */
const CR = { inCorso: false, errore: "" };
const NOME_NUOVA = () => t("Scadenze", "Deadlines");
function configura() {
  const L = allEnts("todo", adatta);
  return `<div class="sc1cfg"><span class="sc1zi">${disegno()}</span><div class="tx"><h2>⏰ ${t("Scadenze", "Deadlines")}</h2>
    <p>${t("Bollette, tagliando e revisione, assicurazione, bollo, visite, compleanni, abbonamenti, garanzie: tutto in un posto, con un promemoria sul telefono prima che scadano.", "Bills, car service and inspection, insurance, road tax, appointments, birthdays, subscriptions, warranties: all in one place, with a phone reminder before they're due.")}</p>
    <p class="small muted">${t("Le scadenze si salvano in una lista di Home Assistant: le vedi anche nelle sue app.", "Deadlines are saved in a Home Assistant list: you see them in its apps too.")}</p></div></div>
    ${isAdmin() ? `<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn pri" data-act="scCrea" ${CR.inCorso ? "disabled" : ""}>${CR.inCorso ? "⏳ " + t("Creo la lista…", "Creating the list…") : "＋ " + t("Crea la lista Scadenze", "Create the Deadlines list")}</button>
      ${L.length ? `<button class="btn" data-act="scCfg">📋 ${t("Usa una lista che ho già", "Use a list I already have")}</button>` : ""}</div>
      ${CR.errore ? istruzioni() : `<p class="small muted" style="margin-top:10px">${t("Creo in Home Assistant una lista «Local To-do» chiamata «Scadenze».", "I create a «Local To-do» list called «Deadlines» in Home Assistant.")}</p>`}`
      : `<p class="small muted" style="margin-top:12px">${t("Chiedi a un amministratore di creare la lista delle scadenze.", "Ask an admin to create the deadlines list.")}</p>`}`;
}
const istruzioni = () => `<div class="note1">${CR.errore === "?" ? "" : t("Non sono riuscito a crearla da qui", "I couldn't create it from here") + (CR.errore ? ` (${esc(CR.errore)})` : "") + ". "}${t("Si fa in un minuto: Impostazioni → Dispositivi e servizi → ＋ Aggiungi integrazione → «Local To-do» → nome «Scadenze». Poi torna qui.", "It takes a minute: Settings → Devices & services → ＋ Add integration → «Local To-do» → name «Deadlines». Then come back here.")}
  <div style="margin-top:8px"><button class="btn sm" data-act="scApriHA">↗ ${t("Apri Aggiungi integrazione", "Open Add integration")}</button></div></div>`;
async function creaLista() {
  if (CR.inCorso) return;
  const prima = new Set(Object.keys(S).filter(x => x.startsWith("todo."))), nome = NOME_NUOVA();
  CR.inCorso = true; CR.errore = ""; render(true);
  try {
    /* flusso di configurazione di Local To-do (lo stesso di Impostazioni → Aggiungi integrazione) */
    let r = await api("POST", "/api/config/config_entries/flow", { handler: "local_todo", show_advanced_options: false });
    if (r?.type === "form") r = await api("POST", "/api/config/config_entries/flow/" + r.flow_id, { todo_list_name: nome });
    if (r?.type === "abort" && r.reason === "already_configured") throw new Error(t("esiste già una lista con questo nome", "a list with this name already exists"));
    if (r?.type !== "create_entry") throw new Error(r?.reason || r?.errors?.base || r?.type || "?");
    let id = null; const nuova = () => Object.keys(S).find(x => x.startsWith("todo.") && !prima.has(x) && nmHA(x).toLowerCase() === nome.toLowerCase()) || Object.keys(S).find(x => x.startsWith("todo.") && !prima.has(x));
    for (let i = 0; i < 40 && !(id = nuova()); i++) await new Promise(res => setTimeout(res, 500));   // Home Assistant crea l'entità
    if (id) await cambia(l => { l.scadenze = { ...(l.scadenze || {}), lista: id }; }, "⏰ " + t("Lista «Scadenze» creata", "«Deadlines» list created"));
    else throw new Error(t("la lista non compare", "the list doesn't show up"));
  } catch (e) {
    console.warn("nduja scadenze crea", e);
    let m = String(e?.message || e || "").replace(/^\d{3}\s*/, ""); try { m = JSON.parse(m).message || m; } catch {}   // risposta di Home Assistant: {"message": "…"}
    CR.errore = m.slice(0, 120) || "?";
  }
  CR.inCorso = false; render(true);
}

/* ---------- ⚙️ quale lista (amministratori) ---------- */
function schedaCfg() {
  const L = allEnts("todo", id => puo(id, F_ADD)), cur = lista();
  const PIATT = { local_todo: "Local To-do", google_tasks: "Google Tasks", todoist: "Todoist", caldav: "CalDAV", microsoft_todo: "Microsoft To Do", shopping_list: t("Lista della spesa", "Shopping list") };
  return `<div class="sh-head"><div><h3>⚙️ ${t("Lista delle scadenze", "Deadlines list")}</h3><div class="small muted">${t("Vale per tutta la casa.", "For the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${L.map(id => { const ad = adatta(id), dsc = puo(id, F_DESC);
      return `<button class="li ${cur === id ? "sel1" : ""} ${ad ? "" : "dis"}" data-act="scLista" data-id="${id}" ${ad ? "" : "disabled"}><span class="ic">${cur === id ? "✓" : "📋"}</span><div class="tx"><b>${esc(nm(id))}</b>
        <span>${esc([PIATT[REG[id]?.platform] || REG[id]?.platform || id, !ad ? t("non accetta le date", "doesn't take dates") : !dsc ? t("senza descrizione: niente categoria, ripetizione e importo", "no description: no category, repetition or amount") : ""].filter(Boolean).join(" · "))}</span></div></button>`; }).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-act="scCrea" ${CR.inCorso ? "disabled" : ""}>＋ ${t("Crea una lista nuova «Scadenze»", "Create a new «Deadlines» list")}</button></div>
    ${CR.errore ? istruzioni() : ""}
    <p class="small muted" style="margin-top:12px">${t("Consigliata una lista «Local To-do»: tiene la data, l'ora e la descrizione. La lista scelta non compare più nella pagina Liste.", "A «Local To-do» list is best: it keeps date, time and description. The chosen list no longer shows on the Lists page.")}</p>`;
}

/* ---------- ✏️ una scadenza: nuova o da cambiare ---------- */
let E = null;
function apri(uid) {
  const id = lista(); if (!id) return;
  if (uid) {
    const x = trova(uid); if (!x || x.tmp) return;
    E = { uid, titolo: x.titolo, cat: x.cat, catMan: true, data: x.d ? iso(x.d) : "", ora: x.ora, rip: x.rip.tipo === "no" ? { tipo: "no", n: 3 } : { n: 3, ...x.rip },
      importo: x.importo != null ? x.importo.toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) : "", note: x.note, ricorda: x.ricorda, d0: x.d ? iso(x.d) + x.ora : "", fatta: x.fatta };
  } else E = { uid: null, titolo: "", cat: "altro", catMan: false, data: iso(Date.now() + 864e5 * 7), ora: "", rip: { tipo: "no", n: 3 }, importo: "", note: "", ricorda: null, d0: "", fatta: false };
  openSheet(scheda);
}
function scheda() {
  const id = lista(); if (!E || !id) return "";
  const x = E.uid ? trova(E.uid) : null;
  if (E.uid && !x) return `<div class="sh-head"><h3>${t("Scadenza sparita", "Deadline gone")}</h3><button class="x" data-act="sheetClose">×</button></div><div class="small muted">${t("Qualcuno l'ha tolta dalla lista.", "Someone removed it from the list.")}</div>`;
  const fd = puo(id, F_DATA), fo = puo(id, F_ORA), desc = puo(id, F_DESC);
  const R = [["no", t("Mai", "Never")], ["sett", t("Ogni settimana", "Weekly")], ["mese", t("Ogni mese", "Monthly")], ["mesi", t("Ogni … mesi", "Every … months")], ["anno", t("Ogni anno", "Yearly")]];
  const rk = E.rip.tipo === "mesi" ? (E.rip.n > 1 ? "mesi" : "mese") : E.rip.tipo;
  const P = (E.data && E.rip.tipo !== "no") ? prossima(new Date(E.data + "T" + (E.ora || "00:00") + ":00"), ripVera()) : null;
  return `<div class="sh-head"><div><h3>${E.uid ? "✏️ " + esc(x.titolo) : "＋ " + t("Nuova scadenza", "New deadline")}</h3><div class="small muted">📋 ${esc(nm(id))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Cosa", "What")}</span><input id="sc1ti" type="text" maxlength="255" value="${esc(E.titolo)}" placeholder="${t("Bolletta della luce, revisione auto, dentista…", "Electricity bill, car inspection, dentist…")}" autocomplete="off" enterkeyhint="done"></label>
    ${desc ? `<div class="fl1">${t("Categoria", "Category")}</div><div class="sc1cats" role="radiogroup">${CAT().map(([k, ic, n]) => `<button class="${E.cat === k ? "on" : ""}" data-act="scCat" data-v="${k}" data-c="${k}" role="radio" aria-checked="${E.cat === k}"><span aria-hidden="true">${ic}</span>${esc(n)}</button>`).join("")}</div>` : ""}
    <div class="fl1">${t("Scadenza", "Due")}</div>
    <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><input id="sc1d" class="fkn1 dt" type="date" value="${esc(E.data)}" data-chg="scF" data-k="data" aria-label="${t("Giorno", "Day")}">
      ${fo ? `<input id="sc1o" class="fkn1 dt" type="time" value="${esc(E.ora)}" data-chg="scF" data-k="ora" aria-label="${t("Ora (facoltativa)", "Time (optional)")}">` : ""}
      ${E.ora && fd ? `<button class="lnk" data-act="scSenzaOra">${t("senza ora", "no time")}</button>` : ""}</div>
    ${fo && fd ? `<p class="small muted" style="margin:6px 0 0">${t("L'ora è facoltativa.", "The time is optional.")}</p>` : ""}
    ${desc ? `<div class="fl1">${t("Si ripete", "Repeats")}</div><div class="vr1">${R.map(([k, n]) => `<button class="${rk === k ? "on" : ""}" data-act="scRip" data-v="${k}" aria-pressed="${rk === k}">${n}</button>`).join("")}</div>
      ${rk === "mesi" ? `<label class="row sc1nm" style="gap:10px;margin-top:10px">${t("Ogni", "Every")} <input class="fkn1" type="number" min="2" max="120" step="1" inputmode="numeric" value="${E.rip.n}" data-chg="scMesi" aria-label="${t("Mesi", "Months")}"> ${t("mesi", "months")}</label>` : ""}
      ${P ? `<p class="small muted" style="margin:8px 0 0">🔁 ${t("Con «Fatto» passa da sola alla prossima: ", "With «Done» it moves to the next one by itself: ")}<b>${esc(P.toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "long", year: "numeric" }))}</b></p>` : ""}
      <label class="fld1"><span>${t("Importo (facoltativo)", "Amount (optional)")}</span><input id="sc1im" type="text" inputmode="decimal" maxlength="14" value="${esc(E.importo)}" placeholder="${esc(soldi(82))}" autocomplete="off"></label>
      <label class="fld1"><span>${t("Note (facoltative)", "Notes (optional)")}</span><textarea id="sc1no" rows="2" maxlength="800" placeholder="${t("codice cliente, dove pagare, cosa portare…", "customer number, where to pay, what to bring…")}">${esc(E.note)}</textarea></label>` : ""}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="scSalva">💾 ${E.uid ? t("Salva", "Save") : t("Aggiungi", "Add")}</button>
      ${E.uid ? (E.fatta ? `<button class="btn" data-act="scRiapriE">↺ ${t("Di nuovo da fare", "Not done")}</button>` : `<button class="btn" data-act="scFattoE">✓ ${t("Fatto", "Done")}</button>`) : ""}
      ${E.uid && puo(id, F_DEL) ? `<button class="btn bad" data-act="scDel">🗑 ${t("Elimina", "Delete")}</button>` : ""}</div>`;
}
/** ripetizione dai campi, con il giorno da tenere se cade dopo il 28 */
function ripVera() {
  const r = E.rip, g = E.data ? +E.data.slice(8, 10) : 0;
  if (r.tipo === "no" || r.tipo === "sett") return { tipo: r.tipo };
  return { tipo: r.tipo, n: r.tipo === "mesi" ? Math.min(120, Math.max(1, +r.n || 1)) : undefined, g: g > 28 ? g : null };
}
const leggiCampi = () => {
  const v = sel => document.getElementById(sel);
  if (!E) return;
  if (v("sc1ti")) E.titolo = v("sc1ti").value;
  if (v("sc1im")) E.importo = v("sc1im").value;
  if (v("sc1no")) E.note = v("sc1no").value;
  if (v("sc1d")) E.data = v("sc1d").value;
  if (v("sc1o")) E.ora = v("sc1o").value;
};
CHG.scF = el => { if (!E) return; E[el.dataset.k] = el.value; if (el.dataset.k === "data" && !el.value) E.ora = ""; render(); };
CHG.scMesi = el => { if (!E) return; E.rip.n = Math.min(120, Math.max(2, Math.round(+el.value) || 2)); render(); };
document.addEventListener("input", e => {
  if (!E) return;
  if (e.target.id === "sc1ti") { E.titolo = e.target.value; if (!E.catMan && !E.uid) { const k = indovina(E.titolo); if (k !== E.cat) { E.cat = k; render(); } } }
  else if (e.target.id === "sc1im") E.importo = e.target.value;
  else if (e.target.id === "sc1no") E.note = e.target.value;
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing && e.target.id === "sc1ti") { e.preventDefault(); e.target.blur(); } });
async function salva() {
  const id = lista(); if (!E || !id) return;
  leggiCampi();
  const titolo = String(E.titolo || "").replace(/\s+/g, " ").trim().slice(0, 255);
  if (!titolo) { toast(t("Scrivi cosa scade", "Write what's due"), true); document.getElementById("sc1ti")?.focus(); return; }
  const imp = String(E.importo || "").trim() ? numero(E.importo) : null;
  if (String(E.importo || "").trim() && imp == null) { toast(t("Importo non valido", "Invalid amount"), true); document.getElementById("sc1im")?.focus(); return; }
  const rip = ripVera();
  if (rip.tipo !== "no" && !E.data) { toast(t("Per ripeterla serve il giorno della scadenza", "A repeating deadline needs a date"), true); return; }
  const stessa = (E.data + E.ora) === E.d0;
  const desc = puo(id, F_DESC) ? descrizione({ cat: E.cat, rip, importo: imp, note: E.note, ricorda: stessa ? E.ricorda : null }) : null;
  const data = { ...scadenzaHA(id, E.data, E.ora), ...(desc != null ? { description: desc || null } : {}) };
  const e = E; closeSheet(); E = null;
  if (!e.uid) {
    if (!data.due_date && !data.due_datetime) { delete data.due_date; delete data.due_datetime; }
    if (data.description == null) delete data.description;
    if (await cmd(id, "add_item", { item: titolo, ...data })) toast("＋ " + titolo);
    return;
  }
  const x = voceGrezza(e.uid); if (!x) return;
  if (titolo !== x.summary) data.rename = titolo;
  if (stessa) { delete data.due_date; delete data.due_datetime; }
  if (desc != null && desc === String(x.description || "").trim()) delete data.description;
  if (Object.keys(data).length === 0) return;   // niente da cambiare
  if (await cmd(id, "update_item", { item: e.uid, ...data })) toast("💾 " + titolo);
}

/* ---------- 🔔 promemoria sul telefono: automazione «'Nduja · scadenze» ---------- */
const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const serviziNotify = () => { const s = cached("services", 3600e3, () => ws({ type: "get_services" })) || {}; return Object.keys(s.notify || {}).filter(k => k.startsWith("mobile_app_")).sort(); };
/** i telefoni (servizi notify.mobile_app_*) di una persona: dai suoi device_tracker dell'app di Home Assistant */
function telefoniDi(pid) {
  const sv = new Set(serviziNotify()), out = [];
  for (const tr of attr(pid, "device_trackers") || []) {
    const s = ["mobile_app_" + slug(tr.split(".")[1]), "mobile_app_" + slug(DEVICES[REG[tr]?.device]?.name)].find(x => sv.has(x));
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}
const nomeServizio = s => String(s).replace(/^mobile_app_/, "").replace(/_/g, " ");
const ANTICIPI = () => [[0, t("Il giorno stesso", "On the day")], [1, t("1 giorno prima", "1 day before")], [3, t("3 giorni prima", "3 days before")], [7, t("7 giorni prima", "7 days before")]];
function anticipiTesto(A) {
  const L = [...(A || [1])].sort((a, b) => b - a);
  return L.map(a => a === 0 ? t("il giorno stesso", "on the day") : a === 1 ? t("1 giorno prima", "1 day before") : t(`${a} giorni prima`, `${a} days before`)).join(", ").replace(/^./, c => c.toUpperCase());
}
let NB = null;
function schedaProm() {
  /* la prima volta: tutte le persone con il telefono (appena so quali telefoni ci sono) */
  if (NB.auto && serviziNotify().length) { NB.auto = false; NB.persone = allEnts("person").filter(x => telefoniDi(x).length); }
  const P = allEnts("person"), conTel = P.filter(p => telefoniDi(p).length), suoi = new Set(P.flatMap(telefoniDi)), altri = serviziNotify().filter(s => !suoi.has(s));
  const ck = (on, act, k, testo, sotto, dis) => `<button class="ck1 ${on ? "on" : ""}" data-act="${act}" data-k="${esc(k)}" ${dis ? "disabled" : ""} aria-pressed="${!!on}"><span class="bx"></span><span class="tx"><b>${testo}</b>${sotto ? `<span>${sotto}</span>` : ""}</span></button>`;
  return `<div class="sh-head"><div><h3>🔔 ${t("Promemoria delle scadenze", "Deadline reminders")}</h3><div class="small muted">${t("Creo in Home Assistant l'automazione «'Nduja · scadenze»: funziona anche a plancia chiusa.", "I create the «'Nduja · deadlines» automation in Home Assistant: it works even with the dashboard closed.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("A chi", "To")}</div><div class="cks1">${P.map(p => { const T = telefoniDi(p); return ck(NB.persone.includes(p) && T.length, "scnP", p, esc(nm(p)), T.length ? "📱 " + esc(T.map(nomeServizio).join(", ")) : t("nessun telefono con l'app di Home Assistant", "no phone with the Home Assistant app"), !T.length); }).join("")}
      ${altri.map(s => ck(NB.altri.includes(s), "scnA", s, "📱 " + esc(nomeServizio(s)), t("telefono senza persona", "phone without a person"))).join("")}</div>
    ${!conTel.length && !altri.length ? `<div class="small muted" style="margin-top:6px">${t("Nessun telefono: installa l'app Home Assistant sul telefono e collegala a una persona.", "No phone: install the Home Assistant app on the phone and link it to a person.")}</div>` : ""}
    <div class="fl1">${t("Quando", "When")}</div><div class="vr1">${ANTICIPI().map(([a, n]) => `<button class="${NB.anticipi.includes(a) ? "on" : ""}" data-act="scnT" data-v="${a}" aria-pressed="${NB.anticipi.includes(a)}">${n}</button>`).join("")}</div>
    <p class="small muted" style="margin:6px 0 0">${t("Puoi sceglierne più di uno.", "You can pick more than one.")}</p>
    <div class="fl1">${t("A che ora", "At what time")}</div><input class="fkn1 dt" type="time" value="${esc(NB.ora)}" data-chg="scnO" aria-label="${t("Ora del promemoria", "Reminder time")}">
    <p class="small muted" style="margin:10px 0 0">${puo(lista(), F_DESC) ? t("Nella notifica: «✓ Fatto» (quelle che si ripetono passano alla prossima data) e «⏰ Ricordamelo domani».", "In the notification: «✓ Done» (repeating ones move to the next date) and «⏰ Remind me tomorrow».") : t("Nella notifica: «✓ Fatto». «Ricordamelo domani» serve una lista con la descrizione.", "In the notification: «✓ Done». «Remind me tomorrow» needs a list with a description.")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="scnSalva">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${C().promemoria ? `<button class="btn bad" data-act="scnOff">${t("Spegni i promemoria", "Turn off reminders")}</button>` : ""}</div>`;
}
const serviziDi = p => [...new Set([...(p.persone || []).filter(x => S[x]).flatMap(telefoniDi), ...(p.altri || []).filter(s => serviziNotify().includes(s))])];
/** l'automazione. Tutto il lavoro lo fa Home Assistant: ogni giorno all'ora scelta legge la lista (todo.get_items) e manda una notifica
    per ogni scadenza che cade tra «anticipi» giorni (o che hai chiesto di ricordare oggi); le azioni della notifica cambiano la voce. */
function automazione(p, id) {
  const sv = serviziDi(p), desc = puo(id, F_DESC);
  const ICONE = {}; for (const [k, ic] of CAT()) for (const n of NOMI_CAT[k]) ICONE[n] = ic;
  const RE_RIC = String.raw`'⏰[^\n]*?([0-9]{4}-[0-9]{2}-[0-9]{2})'`, campo = em => String.raw`((desc | regex_findall('` + em + String.raw`️? *([^·\n]+)')) + [''])[0] | trim`;
  const voce = String.raw`((r.get(lista, {}).get('items', []) | selectattr('uid', 'eq', azione.split('|', 1)[1]) | list) + [{}]) | first`;
  const pulita = String.raw`{%- set x = ` + voce + String.raw` -%}{{ ((x.get('description') or '').split('\n') | reject('search', '⏰') | list) | join('\n') | trim }}`;
  const elenco = String.raw`{%- set ns = namespace(v=[]) -%}{%- set oggi = now().date() -%}{%- set icone = ` + JSON.stringify(ICONE) + String.raw` -%}
{%- for x in r.get(lista, {}).get('items', []) -%}
{%- set due = x.get('due') or '' -%}{%- set desc = x.get('description') or '' -%}
{%- set ric = desc | regex_findall(` + RE_RIC + String.raw`) -%}
{%- set d = ((as_local(as_datetime(due)) if 'T' in due else strptime(due[:10], '%Y-%m-%d', none)) if due else none) -%}
{%- set g = (d.date() - oggi).days if d else none -%}
{%- if (g is not none and g in anticipi) or (ric and ric[-1] == oggi | string) -%}
{%- set imp = ` + campo("💰") + String.raw` -%}{%- set cat = ` + campo("🏷") + String.raw` | lower -%}
{%- set quando = '' if g is none else '` + t("Oggi", "Today") + String.raw`' if g == 0 else '` + t("Domani", "Tomorrow") + String.raw`' if g == 1 else '` + t("Scaduta ieri", "Overdue since yesterday") + String.raw`' if g == -1
  else ('` + t("Scaduta da ", "Overdue by ") + String.raw`' ~ (-g) ~ '` + t(" giorni", " days") + String.raw`') if g < 0 else ('` + t("Tra ", "In ") + String.raw`' ~ g ~ '` + t(" giorni", " days") + String.raw` (' ~ d.strftime('%d/%m') ~ ')') -%}
{%- set ora = (d.strftime('%H:%M') if 'T' in due else '') if d else '' -%}
{%- set ns.v = ns.v + [{'uid': x.uid | string, 'titolo': icone.get(cat, '⏰') ~ ' ' ~ x.summary, 'testo': ([quando, ora, imp] | select | join(' · ')) or '` + t("Promemoria", "Reminder") + String.raw`'}] -%}
{%- endif -%}{%- endfor -%}{{ ns.v }}`;
  const prossimaT = String.raw`{%- set x = ` + voce + String.raw` -%}{%- set desc = x.get('description') or '' -%}{%- set due = x.get('due') or '' -%}
{%- set rip = (` + campo("🔁") + String.raw`) | lower -%}{%- set anc = ((rip | regex_findall('([0-9]{1,2}) *[)]')) + [''])[0] -%}{%- set rip = rip | regex_replace('[(].*[)]', '') -%}
{%- set sett = 'settiman' in rip or 'week' in rip -%}
{%- set n = (((rip | regex_findall('([0-9]+)')) + ['1'])[0] | int(1)) or 1 -%}
{%- set mesi = (12 * n) if ('ann' in rip or 'year' in rip) else n if ('mes' in rip or 'month' in rip) else 0 -%}
{%- if due and (sett or mesi) -%}
{%- set conora = 'T' in due -%}{%- set d0 = as_local(as_datetime(due)) if conora else strptime(due[:10], '%Y-%m-%d') -%}
{%- set giorno = (anc | int(0)) or d0.day -%}{%- set ns = namespace(d=none) -%}
{%- for i in range(1, 2000) if ns.d is none or ns.d <= now().date() -%}
{%- if sett -%}{%- set ns.d = (d0 + timedelta(days=7 * i)).date() -%}
{%- else -%}{%- set tot = d0.month - 1 + mesi * i -%}{%- set y = d0.year + tot // 12 -%}{%- set m = tot % 12 + 1 -%}
{%- set fine = (strptime('%04d-%02d-01' % ((y + 1, 1) if m == 12 else (y, m + 1)), '%Y-%m-%d') - timedelta(days=1)).day -%}
{%- set ns.d = strptime('%04d-%02d-%02d' % (y, m, [giorno, fine] | min), '%Y-%m-%d').date() -%}{%- endif -%}
{%- endfor -%}{{ ns.d ~ ((' ' ~ d0.strftime('%H:%M:%S')) if conora else '') }}{%- endif -%}`;
  const item = "{{ azione.split('|', 1)[1] }}", T = { entity_id: "{{ lista }}" };
  const upd = extra => ({ action: "todo.update_item", target: T, data: { item, ...extra, ...(desc ? { description: pulita } : {}) } });
  const leggi = { action: "todo.get_items", target: T, data: { status: "needs_action" }, response_variable: "r" };
  const avviso = sv.map(s => ({ action: "notify." + s, data: { title: "{{ repeat.item.titolo }}", message: "{{ repeat.item.testo }}",
    data: { tag: "nduja-scad-{{ repeat.item.uid }}", group: "nduja-scadenze", channel: t("Scadenze 'Nduja", "'Nduja deadlines"), url: "/nduja?apri=scadenze", clickAction: "/nduja?apri=scadenze",
      actions: [{ action: "NDUJA_SCAD_FATTO|{{ repeat.item.uid }}", title: "✓ " + t("Fatto", "Done") }, ...(desc ? [{ action: "NDUJA_SCAD_DOMANI|{{ repeat.item.uid }}", title: "⏰ " + t("Ricordamelo domani", "Remind me tomorrow") }] : [])] } } }));
  /* «Fatto»: se si ripete, la prossima data dopo oggi; altrimenti spuntata. «Ricordamelo domani»: la riga «⏰ Ricorda il …» nella descrizione */
  const fattoSeq = [{ variables: { prossima: prossimaT } }, { if: [{ condition: "template", value_template: "{{ prossima | string | length > 0 }}" }],
    then: [{ if: [{ condition: "template", value_template: "{{ ' ' in prossima | string }}" }], then: [upd({ due_datetime: "{{ prossima | string }}" })], else: [upd({ due_date: "{{ prossima | string }}" })] }],
    else: [upd({ status: "completed" })] }];
  const domani = [{ action: "todo.update_item", target: T, data: { item,
    description: String.raw`{%- set x = ` + voce + String.raw` -%}{{ (((x.get('description') or '').split('\n') | reject('search', '⏰') | list) + ['⏰ ` + t("Ricorda il", "Remind on") + String.raw` ' ~ ((now() + timedelta(days=1)).date() | string)]) | join('\n') | trim }}` } }];
  const [hh, mm] = String(p.ora || "09:00").split(":");
  return { id: AUT, alias: "'Nduja · " + t("scadenze", "deadlines"), description: t("Creata da 'Nduja Dashboard (Scadenze → 🔔): promemoria delle scadenze sul telefono. Si aggiorna da sola dalla plancia.", "Created by 'Nduja Dashboard (Deadlines → 🔔): deadline reminders on the phone. The dashboard keeps it up to date."),
    variables: { lista: id, anticipi: [...new Set(p.anticipi || [1])].sort((a, b) => a - b) },
    triggers: [{ trigger: "time", at: `${String(+hh || 0).padStart(2, "0")}:${String(+mm || 0).padStart(2, "0")}:00`, id: "ora" }, { trigger: "event", event_type: "mobile_app_notification_action", id: "azione" }],
    conditions: [{ condition: "template", value_template: "{{ trigger.id == 'ora' or (trigger.event.data.get('action', '') | string).startswith('NDUJA_SCAD_') }}" }],
    actions: [{ choose: [
      { conditions: [{ condition: "trigger", id: "ora" }], sequence: [leggi, { variables: { voci: elenco } }, { repeat: { for_each: "{{ voci }}", sequence: avviso } }] },
      { conditions: [{ condition: "trigger", id: "azione" }], sequence: [
        { variables: { azione: "{{ trigger.event.data.action | string }}" } }, leggi,
        { condition: "template", value_template: "{{ (r.get(lista, {}).get('items', []) | selectattr('uid', 'eq', azione.split('|', 1)[1]) | list | count) > 0 }}" },
        ...(desc ? [{ choose: [{ conditions: [{ condition: "template", value_template: "{{ azione.startswith('NDUJA_SCAD_DOMANI|') }}" }], sequence: domani }], default: fattoSeq }] : fattoSeq)] }] }],
    mode: "queued", max: 10 };
}
/** riscrive l'automazione se i promemoria sono attivi (cambio di lista, persone, anticipo, ora) */
async function aggiornaAutomazione(p = C().promemoria, id = lista()) {
  if (!p || !id) return false;
  const cfg = automazione(p, id); if (!serviziDi(p).length) return false;
  await api("POST", "/api/config/automation/config/" + AUT, cfg); return true;
}

/* ---------- Home: le prossime 3 ---------- */
function homeCard() {
  const id = lista(); if (!id) return "";
  const T = tutte(), A = ordina(daFare().filter(x => x.d)), sc = A.filter(x => gg(x) < 0).length;
  const L = A.slice(0, 3);
  return `<section class="card sc1hc"><div class="ch"><h2>⏰ ${t("Scadenze", "Deadlines")}${sc ? ` <span class="tag bad">${sc} ${t(sc === 1 ? "scaduta" : "scadute", "overdue")}</span>` : ""}</h2><a data-act="go" data-id="scadenze">${t("Tutte", "All")} ›</a></div>
    ${!ok(id) ? `<div class="small muted">${t("Lista non raggiungibile.", "List unavailable.")}</div>` : !T ? `<div class="small muted">${t("Carico…", "Loading…")}</div>`
      : L.length ? `<div class="sc1l">${L.map(x => riga(x, { piccola: true })).join("")}</div>${A.length > 3 ? `<div class="small muted sc1alt">${t(`e altre ${A.length - 3}`, `and ${A.length - 3} more`)}</div>` : ""}`
      : `<div class="ls1ok"><span>✓</span><b>${t("Niente in scadenza", "Nothing due")}</b></div>`}</section>`;
}
HOME_EXTRA.scadenze = { title: () => t("Scadenze", "Deadlines"), render: homeCard, show: () => !!lista() && paginaAttiva() };

/* ---------- Avvisi della Home: scadute e di oggi ---------- */
VISTE.scadenzeAvvisi = () => {
  if (!lista() || !PAGES.scadenze?.show() || !paginaAttiva() || utenteCfg().pages?.scadenze === false) return [];
  return ordina(scaduteOggi()).map(x => { const q = quando(x), c = cat(x.cat);
    return { k: "sc:" + x.uid + ":" + (x.d ? iso(x.d) + x.ora : ""), ic: c[1], b: esc(x.titolo), s: esc(q.testo + (x.importo != null ? " · " + soldi(x.importo) : "")), go: "scadenze", cls: gg(x) < 0 ? "alert" : "" }; });
};

/* ---------- azioni ---------- */
Object.assign(ACT, {
  scNuova: () => apri(null),
  scApri: el => apri(el.dataset.uid),
  scFatto: el => fatto(el.dataset.uid),
  scRiapri: el => riapri(el.dataset.uid),
  scFatte: () => { UIS.fatte = !UIS.fatte; render(true); },
  scSvuota: async el => {
    const id = lista(), n = (tutte() || []).filter(x => x.fatta).length; if (!id || !n) return;
    if (!sicuro(el, t(`Tocca ancora: tolgo ${n} scadenz${n === 1 ? "a" : "e"} fatt${n === 1 ? "a" : "e"}`, `Tap again: remove ${n} done`))) return;
    if (await cmd(id, "remove_completed_items", {})) toast("🧹 " + t(`Tolte ${n} scadenze fatte`, `Removed ${n} done deadlines`));
  },
  scRileggi: () => { const id = lista(); if (id) leggi(id); },
  scCat: el => { if (!E) return; leggiCampi(); E.cat = el.dataset.v; E.catMan = true; render(); },
  scRip: el => { if (!E) return; leggiCampi(); const v = el.dataset.v; E.rip = v === "mese" ? { tipo: "mesi", n: 1 } : v === "mesi" ? { tipo: "mesi", n: E.rip.n > 1 ? E.rip.n : 3 } : { tipo: v, n: E.rip.n || 3 }; render(); },
  scSenzaOra: () => { if (!E) return; leggiCampi(); E.ora = ""; const o = document.getElementById("sc1o"); if (o) o.value = ""; render(); },
  scSalva: () => salva(),
  scFattoE: () => { if (!E) return; const u = E.uid; closeSheet(); E = null; fatto(u); },
  scRiapriE: () => { if (!E) return; const u = E.uid; closeSheet(); E = null; riapri(u); },
  scDel: async el => {
    const id = lista(), x = E && trova(E.uid); if (!x) return closeSheet();
    if (!sicuro(el, t("Tocca ancora per eliminare", "Tap again to delete"))) return;
    closeSheet(); E = null;
    if (await cmd(id, "remove_item", { item: [x.uid] })) toast("🗑 " + x.titolo);
  },
  scCfg: () => openSheet(schedaCfg),
  scLista: async el => {
    const id = el.dataset.id; closeSheet();
    await cambia(l => { l.scadenze = { ...(l.scadenze || {}), lista: id }; }, "⏰ " + nm(id));
    if (C().promemoria) aggiornaAutomazione(C().promemoria, id).catch(e => toast(t("Promemoria non aggiornati: ", "Reminders not updated: ") + (e.message || e), true));
  },
  scCrea: () => { if (UI.sheet) closeSheet(); creaLista(); },
  scApriHA: () => apriHA("/config/integrations/dashboard/add?domain=local_todo"),
  scProm: () => {
    const p = C().promemoria;
    NB = { persone: [], altri: [], anticipi: [1, 0], ora: "09:00", ...JSON.parse(JSON.stringify(p || {})) };
    NB.auto = !p;
    openSheet(schedaProm);
  },
  scnP: el => { const k = el.dataset.k, i = NB.persone.indexOf(k); i < 0 ? NB.persone.push(k) : NB.persone.splice(i, 1); render(); },
  scnA: el => { const k = el.dataset.k, i = NB.altri.indexOf(k); i < 0 ? NB.altri.push(k) : NB.altri.splice(i, 1); render(); },
  scnT: el => { const a = +el.dataset.v, i = NB.anticipi.indexOf(a); i < 0 ? NB.anticipi.push(a) : NB.anticipi.splice(i, 1); render(); },
  scnSalva: async () => {
    const id = lista(); if (!id || !NB) return;
    NB.persone = NB.persone.filter(p => telefoniDi(p).length);
    if (!serviziDi(NB).length) return toast(t("Scegli almeno una persona con il telefono", "Choose at least one person with a phone"), true);
    if (!NB.anticipi.length) return toast(t("Scegli quando avvisare", "Choose when to remind"), true);
    const nuova = !C().promemoria, p = { persone: NB.persone, altri: NB.altri, anticipi: [...NB.anticipi].sort((a, b) => a - b), ora: NB.ora };
    try {
      await api("POST", "/api/config/automation/config/" + AUT, automazione(p, id));
      if (nuova) etichettaNduja(() => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === AUT));   // nuova: etichetta «'Nduja»
      await cambia(l => { l.scadenze = { ...(l.scadenze || {}), lista: id, promemoria: p }; });
      closeSheet(); toast("🔔 " + t("Promemoria attivi", "Reminders on"));
    } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  scnOff: async () => {
    try { await api("DELETE", "/api/config/automation/config/" + AUT); } catch {}
    await cambia(l => { if (l.scadenze) delete l.scadenze.promemoria; }); closeSheet(); toast(t("Promemoria spenti", "Reminders off"));
  },
});
CHG.scnO = el => { if (NB && el.value) NB.ora = el.value; };

/* la notifica sul telefono apre /nduja?apri=scadenze: porto qui e tolgo il segno dall'indirizzo */
function apriDaLink() {
  let w = window; try { if (window.parent !== window && parent.location.href) w = parent; } catch {}
  let q = null; try { q = new URLSearchParams(w.location.search).get("apri"); } catch { return; }
  if (q !== "scadenze") return;
  try { const u = new URL(w.location.href); u.searchParams.delete("apri"); w.history.replaceState(w.history.state, "", u.pathname + u.search + u.hash); } catch {}
  const prova = (i = 0) => { if (!UI.page || !Object.keys(S).length || !PAGES.scadenze?.show()) { if (i < 60) setTimeout(() => prova(i + 1), 300); return; } go("scadenze"); };
  prova();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") apriDaLink(); });
ready.then(apriDaLink).catch(() => {});

page("scadenze", { title: t("Scadenze", "Deadlines"), short: t("Scadenze", "Deadlines"), icon: "⏰", order: 40.6,
  show: () => !!lista() || isAdmin(),
  badge: () => daFare().some(x => gruppo(x) === "scadute"),
  render: pagina });

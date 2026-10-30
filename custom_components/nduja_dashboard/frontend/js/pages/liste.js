/* Liste: la spesa e le cose da fare, sulle liste todo.* di Home Assistant (Lista della spesa, Local To-do, Google Tasks,
   Todoist, Bring!, CalDAV…). Compare solo se c'è almeno una lista.
   Le voci arrivano in tempo reale con todo/item/subscribe (se non risponde, todo/item/list a ogni cambio della lista)
   e si cambiano con i servizi todo.*; si usano solo le funzioni che la lista supporta (supported_features):
   scadenza (giorno o giorno e ora), descrizione, riordino.
   Spesa: le voci si raggruppano per reparto (reparti.js); il reparto si corregge con un tocco e la plancia lo ricorda.
   Dati della casa (casa.js, sezione «liste», chiunque li può cambiare):
     { reparti: { chiave voce: reparto }, uso: { todo.x: { chiave voce: { s: testo, n: volte, t: "AAAA-MM-GG" } } } }
   Scelte della casa (LAYOUT.liste, solo amministratori): { nascoste: [todo.x], spesa: { todo.x: true|false } }.
   Scelte del dispositivo (sGet/sSet): la lista aperta, quella della Home, la vista per reparto o in ordine.
   In Home la scheda «Liste» (HOME_EXTRA) con la lista preferita e un campo per aggiungere al volo. */
import { S, REG, ACT, CHG, UI, HOOKS, HOME_EXTRA, LAYOUT, t, LOC, esc, nm, ok, attr, allEnts, page, svc, ws, conn, ready, toast,
  openSheet, closeSheet, render, sGet, sSet, sicuro, isAdmin, go, hhmm } from "../core.js";
import { cambia } from "../edit.js";
import { casa, casaCambia } from "../casa.js";
import { REPARTI, reparto, repartoAuto, chiave } from "../reparti.js";

const SEZ = "liste";
/* funzioni delle liste di Home Assistant (TodoListEntityFeature) */
const F_ADD = 1, F_DEL = 2, F_UPD = 4, F_MOVE = 8, F_DATA = 16, F_ORA = 32, F_DESC = 64;
const puo = (id, f) => ((+attr(id, "supported_features") || 0) & f) === f;
const MAX_USO = 150, MAX_REPARTI = 500;

/* ---------- quali liste ---------- */
const PIATT_SPESA = ["shopping_list", "bring", "ourgroceries", "anylist", "picnic", "grocy", "mealie"];
const spesaAuto = id => PIATT_SPESA.includes(REG[id]?.platform) || /spes|shopping|grocer|einkauf|courses|compra|supermerc|market|alimentari/i.test(id + " " + nm(id));
/** lista della spesa: le voci si raggruppano per reparto e ci sono i suggerimenti della spesa (scelta dell'amministratore, altrimenti automatico) */
const isSpesa = id => { const v = LAYOUT.liste?.spesa?.[id]; return v == null ? spesaAuto(id) : !!v; };
const tutte = () => allEnts("todo").sort((a, b) => isSpesa(b) - isSpesa(a) || nm(a).localeCompare(nm(b), LOC));
/** le liste della plancia (senza quelle nascoste dall'amministratore) */
export const liste = () => tutte().filter(id => !(LAYOUT.liste?.nascoste || []).includes(id));
const aperta = () => { const L = liste(), s = sGet("listaSel"); return L.includes(s) ? s : L[0] || null; };
const diHome = () => { const L = liste(), s = sGet("listaHome"); return L.includes(s) ? s : L.find(isSpesa) || L[0] || null; };
const vista = id => isSpesa(id) ? (sGet("listaVista_" + id) || "reparti") : "ordine";
const icona = id => isSpesa(id) ? "🛒" : "📝";
const PIATT = { shopping_list: t("Lista della spesa", "Shopping list"), local_todo: "Local To-do", google_tasks: "Google Tasks", todoist: "Todoist", bring: "Bring!",
  caldav: "CalDAV", microsoft_todo: "Microsoft To Do", ourgroceries: "OurGroceries", anylist: "AnyList", mealie: "Mealie", habitica: "Habitica", nextcloud: "Nextcloud" };

/* ---------- voci: in tempo reale ---------- */
const V = {};   // todo.x -> { voci: [..] | null, err, unsub, modo: "sub" | "list", agg, usato }
const pulisci = x => ({ uid: x.uid ?? x.summary, summary: String(x.summary ?? ""), status: x.status === "completed" ? "completed" : "needs_action", due: x.due || null, description: x.description || "" });
async function leggi(id) {
  const v = V[id]; if (!v) return;
  v.agg = S[id]?.last_updated;
  try { const r = await ws({ type: "todo/item/list", entity_id: id }); v.voci = (r?.items || []).map(pulisci); v.err = false; }
  catch (e) { console.warn("nduja liste", id, e); if (!v.voci) v.err = true; }
  render();
}
function abbona(id) {
  const v = V[id];
  conn.subscribeMessage(m => { if (V[id] !== v) return; v.voci = Array.isArray(m?.items) ? m.items.map(pulisci) : (v.voci || []); v.err = false; render(); },
    { type: "todo/item/subscribe", entity_id: id })
    .then(u => { if (V[id] === v) v.unsub = u; else u?.(); })
    .catch(e => { console.warn("nduja todo/item/subscribe", id, e); v.modo = "list"; leggi(id); });
  /* niente voci dopo qualche secondo (Home Assistant non manda la prima lista): le chiedo io */
  setTimeout(() => { if (V[id] === v && !v.voci) leggi(id); }, 6000);
}
/** voci di una lista (le carica e le segue in tempo reale): null finché non arrivano */
function voci(id) {
  if (!id || !conn) return null;
  if (!V[id]) { V[id] = { voci: null, err: false, unsub: null, modo: "sub" }; abbona(id); }
  V[id].usato = Date.now();
  return V[id].voci;
}
/* senza abbonamento rileggo quando cambia la lista (il numero di voci da fare è lo stato dell'entità) */
HOOKS.push(() => { for (const id in V) if (V[id].modo === "list" && S[id] && S[id].last_updated !== V[id].agg) leggi(id); });
/* liste non guardate da qualche minuto: smetto di seguirle */
setInterval(() => { for (const id in V) if (Date.now() - V[id].usato > 5 * 60000 && id !== aperta() && id !== diHome()) { try { V[id].unsub?.(); } catch {} delete V[id]; } }, 60000);
ready.then(() => conn?.addEventListener?.("ready", () => { for (const id in V) if (V[id].modo === "list") leggi(id); })).catch(() => {});

const daFare = L => (L || []).filter(x => x.status !== "completed");
const fatte = L => (L || []).filter(x => x.status === "completed");
const nDaFare = id => { const v = V[id]?.voci; if (v) return daFare(v).length; const n = parseInt(S[id]?.state, 10); return isNaN(n) ? null : n; };
const trova = (id, uid) => (V[id]?.voci || []).find(x => x.uid === uid);
/** stesso testo, a meno di maiuscole, accenti e spazi */
const uguale = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/* ---------- scadenze ---------- */
const mezzanotte = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const giorniTra = (a, b) => Math.round((mezzanotte(b) - mezzanotte(a)) / 864e5);
const isoLocale = d => { const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const soloGiorno = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
/** { cls: ritardo|oggi|domani|poi, testo } */
function scad(x) {
  if (!x.due) return null;
  const sg = soloGiorno(x.due), d = sg ? new Date(x.due + "T00:00:00") : new Date(x.due); if (isNaN(d)) return null;
  const g = giorniTra(Date.now(), d), ora = sg ? "" : " " + hhmm(d), passata = sg ? g < 0 : d.getTime() < Date.now();
  const cls = passata ? "ritardo" : g === 0 ? "oggi" : g === 1 ? "domani" : "poi";
  const testo = passata ? (g === 0 ? t("scaduto alle", "overdue since") + ora : g === -1 ? t("scaduto ieri", "overdue since yesterday") : t(`scaduto da ${-g} giorni`, `overdue by ${-g} days`))
    : g === 0 ? t("oggi", "today") + ora : g === 1 ? t("domani", "tomorrow") + ora
    : (g < 7 ? d.toLocaleDateString(LOC, { weekday: "long" }) : d.toLocaleDateString(LOC, { day: "numeric", month: "short", year: g > 300 ? "numeric" : undefined })) + ora;
  return { cls, testo, giorno: d.toLocaleDateString(LOC, { day: "numeric", month: "short" }) + ora };
}
/** parti della scadenza per i campi: { data: "AAAA-MM-GG", ora: "HH:MM" | "" } */
function partiScad(due) {
  if (!due) return { data: "", ora: "" };
  if (soloGiorno(due)) return { data: due, ora: "" };
  const d = new Date(due); if (isNaN(d)) return { data: "", ora: "" };
  return { data: isoLocale(d), ora: String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") };
}

/* ---------- dati della casa: reparti ricordati e voci usate più spesso ---------- */
const dati = () => { const s = casa(SEZ); return s?.stato === "ok" ? s.dati || {} : null; };
const repartoDi = testo => dati()?.reparti?.[chiave(testo)] || repartoAuto(testo);
const SPESA_BASE = () => [t("Latte", "Milk"), t("Pane", "Bread"), t("Uova", "Eggs"), t("Acqua", "Water"), t("Frutta", "Fruit"), t("Verdura", "Vegetables"),
  t("Pasta", "Pasta"), t("Caffè", "Coffee"), t("Burro", "Butter"), t("Yogurt", "Yogurt"), t("Formaggio", "Cheese"), t("Carta igienica", "Toilet paper")];
/** ricordo cosa si aggiunge (per i suggerimenti), su tutti i dispositivi */
function impara(id, testo) {
  const k = chiave(testo); if (!k || casa(SEZ)?.stato !== "ok") return;
  casaCambia(SEZ, d => {
    d.uso = d.uso || {}; const u = d.uso[id] = d.uso[id] || {};
    u[k] = { s: testo, n: Math.min(9999, (u[k]?.n || 0) + 1), t: isoLocale(Date.now()) };
    const K = Object.keys(u); if (K.length > MAX_USO) K.sort((a, b) => peso(u[a]) - peso(u[b])).slice(0, K.length - MAX_USO).forEach(x => delete u[x]);
  });
}
/* le voci usate di recente pesano di più */
const peso = e => { const g = e?.t ? giorniTra(e.t + "T12:00:00", Date.now()) : 365; return (e?.n || 0) * (g < 30 ? 1 : g < 90 ? .6 : .3); };
function suggerimenti(id, q) {
  const u = dati()?.uso?.[id] || {}, ci = new Set(daFare(V[id]?.voci).map(x => chiave(x.summary)));
  const L = Object.entries(u).map(([k, e]) => ({ k, s: e.s, p: peso(e) }));
  if (isSpesa(id)) SPESA_BASE().forEach((s, i) => { const k = chiave(s); if (!u[k]) L.push({ k, s, p: .05 - i / 1000 }); });
  const qk = chiave(q);
  return L.filter(x => x.k && !ci.has(x.k) && (!qk || (x.k !== qk && (x.k.startsWith(qk) || x.k.includes(" " + qk)))))
    .sort((a, b) => b.p - a.p).slice(0, qk ? 6 : 8);
}

/* ---------- comandi ---------- */
async function cmd(id, service, data) {
  try { await svc("todo", service, data, { entity_id: id }); }
  catch (e) { leggi(id); return false; }   // svc ha già avvisato: rileggo la lista com'è davvero
  finally { if (V[id]?.modo === "list") leggi(id); }
  return true;
}
let tmpN = 0;
/** aggiunge una voce (se c'è già fatta la rimette da fare) */
async function aggiungi(id, testo) {
  testo = String(testo || "").replace(/\s+/g, " ").trim().slice(0, 255);
  if (!id || !testo) return;
  if (!puo(id, F_ADD)) return toast(t("Questa lista non permette di aggiungere voci", "This list doesn't allow adding items"), true);
  testo = testo[0].toLocaleUpperCase(LOC) + testo.slice(1);
  const v = voci(id) || [], gia = v.find(x => uguale(x.summary) === uguale(testo));
  if (gia && gia.status !== "completed") return toast(t(`«${gia.summary}» è già nella lista`, `«${gia.summary}» is already on the list`));
  impara(id, testo);
  if (gia && puo(id, F_UPD)) {
    gia.status = "needs_action"; render();
    if (await cmd(id, "update_item", { item: gia.uid, status: "needs_action" })) toast("↺ " + gia.summary + t(" · di nuovo da fare", " · back on the list"));
    return;
  }
  if (V[id]?.voci) { V[id].voci = [...V[id].voci, { uid: "nd-tmp-" + (++tmpN), summary: testo, status: "needs_action", due: null, description: "", tmp: true }]; render(); }
  if (await cmd(id, "add_item", { item: testo })) toast("＋ " + testo);
}
async function segna(id, uid) {
  const x = trova(id, uid); if (!x || x.tmp) return;
  if (!puo(id, F_UPD)) return toast(t("Questa lista non permette di cambiare le voci", "This list doesn't allow changing items"), true);
  const nuovo = x.status === "completed" ? "needs_action" : "completed";
  x.status = nuovo; render();
  await cmd(id, "update_item", { item: uid, status: nuovo });
}
/** sposta una voce dopo «prima» (null = in cima) */
async function sposta(id, uid, prima) {
  const v = V[id]?.voci; if (!v) return;
  const x = v.find(y => y.uid === uid); if (!x) return;
  const L = v.filter(y => y !== x), i = prima ? L.findIndex(y => y.uid === prima) + 1 : 0;
  L.splice(i, 0, x); V[id].voci = L; render(true);
  try { await ws({ type: "todo/item/move", entity_id: id, uid, ...(prima ? { previous_uid: prima } : {}) }); }
  catch (e) { toast(t("Non spostata: ", "Not moved: ") + (e?.message || e?.code || e), true); leggi(id); }
}

/* ---------- disegno ---------- */
function rigaVoce(id, x, { piccola = false, maniglia = false, rep = false } = {}) {
  const fatta = x.status === "completed", sc = scad(x), upd = puo(id, F_UPD), r = rep ? reparto(repartoDi(x.summary)) : null;
  return `<div class="ls1r ${piccola ? "sm" : ""} ${fatta ? "fatta" : sc ? "s-" + sc.cls : ""} ${x.tmp ? "tmp" : ""}" data-uid="${esc(x.uid)}">
    ${maniglia ? `<span class="ls1hd" title="${t("Trascina per spostare", "Drag to move")}" aria-hidden="true"></span>` : ""}
    <button class="ls1ck ${fatta ? "on" : ""}" data-act="lsFatto" data-id="${id}" data-uid="${esc(x.uid)}" role="checkbox" aria-checked="${fatta}" aria-label="${esc(x.summary)}" ${upd && !x.tmp ? "" : "disabled"}><i></i></button>
    <button class="ls1t" data-act="${piccola ? "lsApri" : "lsVoce"}" data-id="${id}" data-uid="${esc(x.uid)}"><b>${esc(x.summary)}</b>${x.description && !piccola ? `<small>${esc(x.description)}</small>` : ""}${sc ? `<em class="ls1d ${fatta ? "" : sc.cls}">${sc.cls === "ritardo" && !fatta ? "⚠️ " : "🗓 "}${esc(fatta ? sc.giorno : sc.testo)}</em>` : ""}</button>
    ${r ? `<button class="ls1rp" data-act="lsRep" data-id="${id}" data-uid="${esc(x.uid)}" title="${t("Reparto: ", "Aisle: ")}${esc(r[2])}" aria-label="${t("Reparto: ", "Aisle: ")}${esc(r[2])}">${r[1]}</button>` : ""}</div>`;
}
/* disegno della plancia per la lista vuota: borsa della spesa (o blocco note) con la spunta (SVG fatto apposta) */
const disegno = spesa => spesa
  ? `<svg class="ls1zd" viewBox="0 0 64 64" aria-hidden="true"><path class="lf" d="M38 14c2-6 8-8 12-7-1 5-5 9-12 7z"/><path class="ma" d="M22 24v-6a10 10 0 0 1 20 0v6"/><path class="bo" d="M12 24h40l-3 32H15z"/><path class="ok" d="M24 40l6 6 11-12"/></svg>`
  : `<svg class="ls1zd" viewBox="0 0 64 64" aria-hidden="true"><path class="bo" d="M16 8h32v48H16z"/><path class="ma" d="M24 6v6M32 6v6M40 6v6"/><path class="ri" d="M23 24h18M23 32h18M23 40h10"/><path class="ok" d="M36 44l4 4 9-10"/></svg>`;
function vuota(id) {
  const sp = isSpesa(id);
  return `<div class="ls1z"><span class="ls1zi">${disegno(sp)}</span><div><b>${sp ? t("Non manca niente", "Nothing missing") : t("Tutto fatto", "All done")}</b>
    <small>${puo(id, F_ADD) ? (sp ? t("Scrivi qui sopra cosa comprare, o tocca un suggerimento.", "Type above what to buy, or tap a suggestion.") : t("Scrivi qui sopra la prossima cosa da fare.", "Type above the next thing to do.")) : t("La lista è vuota.", "The list is empty.")}</small></div></div>`;
}
const UIL = { q: "", fatte: {} };
function lato(L, id) {
  const h = diHome();
  return `<section class="card ls1s"><div class="ch"><h2>🛒 ${t("Liste", "Lists")}</h2>${isAdmin() ? `<button class="btn sm" data-act="lsCfg" title="${t("Quali liste e quali sono della spesa", "Which lists and which are for shopping")}">⚙️</button>` : ""}</div>
    <div class="ls1sl" role="tablist">${L.map(x => { const n = nDaFare(x);
      return `<button class="ls1sb ${x === id ? "act" : ""}" data-act="lsSel" data-id="${x}" role="tab" aria-selected="${x === id}"><span class="ic">${icona(x)}</span><span class="tx"><b>${esc(nm(x))}</b><small>${[ok(x) ? "" : t("non raggiungibile", "unavailable"), uguale(PIATT[REG[x]?.platform]) === uguale(nm(x)) ? "" : PIATT[REG[x]?.platform] || "", L.length > 1 && x === h ? "⭐ " + t("in Home", "on Home") : ""].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small></span>${n ? `<span class="n">${n}</span>` : ""}</button>`; }).join("")}</div></section>`;
}
function lista(id) {
  const v = voci(id), sp = isSpesa(id), vi = vista(id), add = puo(id, F_ADD) && ok(id), L = liste();
  const A = daFare(v), D = fatte(v), sg = add ? suggerimenti(id, UIL.q) : [];
  const testa = `<div class="ls1h"><div class="tx"><h2>${icona(id)} ${esc(nm(id))}</h2><span>${v ? (A.length ? `<b>${A.length}</b> ${sp ? t("da comprare", "to buy") : t("da fare", "to do")}` : sp ? t("niente da comprare", "nothing to buy") : t("niente da fare", "nothing to do")) + (D.length ? ` · ${D.length} ${t(D.length === 1 ? "fatta" : "fatte", "done")}` : "") : "&nbsp;"}</span></div>
    <div class="ls1ha">${sp ? `<span class="seg">${[["reparti", "🗂 " + t("Per reparto", "By aisle")], ["ordine", "↕ " + t("In ordine", "In order")]].map(([k, n]) => `<button class="${vi === k ? "act" : ""}" data-act="lsVista" data-id="${id}" data-v="${k}">${n}</button>`).join("")}</span>` : ""}
      ${L.length > 1 ? `<button class="btn sm ls1st ${diHome() === id ? "on" : ""}" data-act="lsHome" data-id="${id}" aria-pressed="${diHome() === id}">⭐ ${diHome() === id ? t("In Home", "On Home") : t("Mostra in Home", "Show on Home")}</button>` : ""}</div></div>`;
  const campo = add ? `<div class="ls1add"><input id="ls1in" class="ls1in" type="text" enterkeyhint="done" autocomplete="off" maxlength="255" data-eid="${id}" value="${esc(UIL.q)}" placeholder="${sp ? t("Cosa manca? Latte, pane…", "What's missing? Milk, bread…") : t("Aggiungi una cosa da fare…", "Add a to-do…")}" aria-label="${t("Aggiungi", "Add")}">
      <button class="btn pri" data-act="lsAdd" data-id="${id}" aria-label="${t("Aggiungi", "Add")}">＋</button></div>
    ${sg.length ? `<div class="ls1sg"><small>${UIL.q ? t("Forse:", "Maybe:") : Object.keys(dati()?.uso?.[id] || {}).length ? t("Usate spesso:", "Often used:") : t("Suggeriti:", "Suggested:")}</small>${sg.map(x => `<button data-act="lsSug" data-id="${id}" data-v="${esc(x.s)}">＋ ${esc(x.s)}</button>`).join("")}${!UIL.q && dati()?.uso?.[id] && Object.keys(dati().uso[id]).length ? `<button class="ls1sgm" data-act="lsSugCfg" data-id="${id}" title="${t("Gestisci i suggerimenti", "Manage suggestions")}" aria-label="${t("Gestisci i suggerimenti", "Manage suggestions")}">⋯</button>` : ""}</div>` : ""}` : "";
  let corpo;
  if (!ok(id)) corpo = `<div class="note1">${t("La lista non è raggiungibile adesso: controlla l'integrazione in Home Assistant.", "The list isn't reachable right now: check the integration in Home Assistant.")}</div>`;
  else if (V[id]?.err && !v) corpo = `<div class="note1">${t("Non riesco a leggere la lista. ", "I can't read the list. ")}<button class="lnk" data-act="lsRileggi" data-id="${id}">${t("Riprova", "Try again")}</button></div>`;
  else if (!v) corpo = `<div class="small muted ls1car">${t("Carico la lista…", "Loading the list…")}</div>`;
  else {
    const muovi = vi === "ordine" && puo(id, F_MOVE) && A.length > 1;
    let fare;
    if (!A.length) fare = vuota(id);
    else if (vi === "reparti") {
      const g = {}; A.forEach(x => (g[repartoDi(x.summary)] = g[repartoDi(x.summary)] || []).push(x));
      fare = REPARTI().filter(r => g[r[0]]).map(([k, ic, n]) => `<div class="ls1gh"><span aria-hidden="true">${ic}</span>${esc(n)}<i>${g[k].length}</i></div>
        <div class="ls1l ls1l2">${g[k].map(x => rigaVoce(id, x, { rep: true })).join("")}</div>`).join("");
    } else fare = `<div class="ls1l" data-eid="${id}" ${muovi ? `data-mv="1"` : ""}>${A.map(x => rigaVoce(id, x, { maniglia: muovi })).join("")}</div>`;
    const aperte = UIL.fatte[id] ?? D.length <= 6;
    const fine = D.length ? `<div class="ls1fh"><button class="lnk" data-act="lsFatte" data-id="${id}" aria-expanded="${aperte}">✓ ${t("Fatte", "Done")} (${D.length}) ${aperte ? "▴" : "▾"}</button><span class="grow"></span>
        ${puo(id, F_DEL) ? `<button class="btn sm" data-act="lsSvuota" data-id="${id}">🧹 ${t("Svuota le fatte", "Clear done")}</button>` : ""}</div>
      ${aperte ? `<div class="ls1l">${D.map(x => rigaVoce(id, x)).join("")}</div>` : ""}` : "";
    corpo = fare + fine;
  }
  return `<section class="card ls1m">${testa}${campo}<div class="ls1c">${corpo}</div>
    ${v && vi === "ordine" && puo(id, F_MOVE) && A.length > 1 ? `<p class="small muted ls1nt">${t("Trascina ⠿ per cambiare l'ordine.", "Drag ⠿ to change the order.")}</p>` : ""}
    ${v && vi === "reparti" && A.length ? `<p class="small muted ls1nt">${t("Reparto sbagliato? Tocca l'icona accanto alla voce: la plancia se lo ricorda.", "Wrong aisle? Tap the icon next to the item: the dashboard will remember.")}</p>` : ""}</section>`;
}
function pagina() {
  const L = liste();
  if (!L.length) return `<div class="g g3"><section class="card span3"><div class="ch"><h2>🛒 ${t("Liste", "Lists")}</h2>${isAdmin() ? `<button class="btn sm" data-act="lsCfg">⚙️ ${t("Liste", "Lists")}</button>` : ""}</div>
    <div class="small muted">${t("Hai nascosto tutte le liste: con ⚙️ scegli quali mostrare.", "You've hidden every list: use ⚙️ to choose which to show.")}</div></section></div>`;
  const id = aperta();
  return `<div class="ls1w">${lato(L, id)}${lista(id)}</div>`;
}

/* ---------- Home: la lista preferita e un campo per aggiungere al volo ---------- */
function homeCard() {
  const id = diHome(); if (!id) return "";
  const v = voci(id), A = daFare(v), sp = isSpesa(id), add = puo(id, F_ADD) && ok(id), MAX = 6;
  /* prima le scadute e quelle di oggi, poi l'ordine della lista */
  const P = [...A].sort((a, b) => ({ ritardo: 0, oggi: 1 }[scad(a)?.cls] ?? 2) - ({ ritardo: 0, oggi: 1 }[scad(b)?.cls] ?? 2));
  return `<section class="card ls1hc"><div class="ch"><h2>${icona(id)} ${esc(nm(id))}${A.length ? ` <span class="tag info">${A.length}</span>` : ""}</h2><a data-act="lsApri" data-id="${id}">${t("Liste", "Lists")} ›</a></div>
    ${add ? `<div class="ls1add sm"><input id="ls1hin" class="ls1in" type="text" enterkeyhint="done" autocomplete="off" maxlength="255" data-eid="${id}" placeholder="${sp ? t("Aggiungi alla spesa…", "Add to shopping…") : t("Aggiungi…", "Add…")}" aria-label="${t("Aggiungi a ", "Add to ")}${esc(nm(id))}">
      <button class="btn pri" data-act="lsAddH" data-id="${id}" aria-label="${t("Aggiungi", "Add")}">＋</button></div>` : ""}
    ${!ok(id) ? `<div class="small muted" style="margin-top:10px">${t("Lista non raggiungibile.", "List unavailable.")}</div>`
      : !v ? `<div class="small muted" style="margin-top:10px">${t("Carico…", "Loading…")}</div>`
      : A.length ? `<div class="ls1hl">${P.slice(0, MAX).map(x => rigaVoce(id, x, { piccola: true })).join("")}</div>${A.length > MAX ? `<button class="btn sm" data-act="lsApri" data-id="${id}" style="margin-top:10px">${t(`e altre ${A.length - MAX}`, `and ${A.length - MAX} more`)} ›</button>` : ""}`
      : `<div class="ls1ok"><span>✓</span><b>${sp ? t("Non manca niente", "Nothing missing") : t("Niente da fare", "Nothing to do")}</b></div>`}</section>`;
}
HOME_EXTRA.liste = { title: () => t("Liste", "Lists"), render: homeCard, show: () => liste().length > 0 };

/* ---------- ✏️ una voce: nome, note, scadenza, reparto, ordine ---------- */
let E = null;
function apriVoce(id, uid) {
  const x = trova(id, uid); if (!x || x.tmp) return;
  E = { id, uid, ...partiScad(x.due) };
  openSheet(schedaVoce);
}
function schedaVoce() {
  const x = E && trova(E.id, E.uid); if (!x) return `<div class="sh-head"><h3>${t("Voce sparita", "Item gone")}</h3><button class="x" data-act="sheetClose">×</button></div><div class="small muted">${t("Qualcuno l'ha tolta dalla lista.", "Someone removed it from the list.")}</div>`;
  const id = E.id, upd = puo(id, F_UPD), fd = puo(id, F_DATA), fo = puo(id, F_ORA), fatta = x.status === "completed";
  const A = daFare(V[id]?.voci), i = A.findIndex(y => y.uid === x.uid), r = isSpesa(id) ? reparto(repartoDi(x.summary)) : null;
  const oggi = isoLocale(Date.now()), domani = isoLocale(Date.now() + 864e5);
  return `<div class="sh-head"><div><h3>✏️ ${esc(x.summary)}</h3><div class="small muted">${icona(id)} ${esc(nm(id))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${upd ? `<label class="fld1"><span>${t("Nome", "Name")}</span><input id="ls1en" type="text" maxlength="255" value="${esc(x.summary)}"></label>` : ""}
    ${upd && puo(id, F_DESC) ? `<label class="fld1"><span>${t("Note (facoltative)", "Notes (optional)")}</span><textarea id="ls1eno" rows="2" maxlength="1000" placeholder="${isSpesa(id) ? t("marca, quantità, quale negozio…", "brand, quantity, which shop…") : t("dettagli…", "details…")}">${esc(x.description)}</textarea></label>` : ""}
    ${upd && (fd || fo) ? `<div class="fl1">${t("Scadenza", "Due")}</div>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><input id="ls1ed" class="fkn1 dt" type="date" value="${esc(E.data)}" data-chg="lsData" aria-label="${t("Giorno", "Day")}">
        ${fo ? `<input id="ls1eo" class="fkn1 dt" type="time" value="${esc(E.ora)}" data-chg="lsOra" aria-label="${t("Ora", "Time")}">` : ""}</div>
      <div class="vr1" style="margin-top:8px">${[[oggi, t("Oggi", "Today")], [domani, t("Domani", "Tomorrow")], ["", t("Nessuna", "None")]].map(([d, n]) => `<button class="${E.data === d ? "on" : ""}" data-act="lsDataV" data-v="${d}">${n}</button>`).join("")}</div>
      <p class="small muted" style="margin:6px 0 0">${fo && !fd ? t("Questa lista vuole anche l'ora.", "This list also needs a time.") : fo ? t("L'ora è facoltativa.", "The time is optional.") : t("Questa lista accetta solo il giorno.", "This list accepts only the day.")}</p>` : ""}
    ${r ? `<div class="fl1">${t("Reparto", "Aisle")}</div><button class="li ls1erp" data-act="lsRep" data-id="${id}" data-uid="${esc(x.uid)}"><span class="ic">${r[1]}</span><div class="tx"><b>${esc(r[2])}</b><span>${dati()?.reparti?.[chiave(x.summary)] ? t("scelto da voi", "chosen by you") : t("automatico · tocca per cambiarlo", "automatic · tap to change")}</span></div><span class="st">›</span></button>` : ""}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap">
      ${upd ? `<button class="btn pri" data-act="lsSalva">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="lsFattoE">${fatta ? "↺ " + t("Di nuovo da fare", "Not done") : "✓ " + t("Fatto", "Done")}</button>` : ""}
      ${puo(id, F_MOVE) && !fatta && A.length > 1 ? `<button class="btn" data-act="lsSu" ${i <= 0 ? "disabled" : ""} aria-label="${t("Sposta su", "Move up")}">▲</button><button class="btn" data-act="lsGiu" ${i >= A.length - 1 ? "disabled" : ""} aria-label="${t("Sposta giù", "Move down")}">▼</button>` : ""}
      ${puo(id, F_DEL) ? `<button class="btn bad" data-act="lsDel">🗑 ${t("Elimina", "Delete")}</button>` : ""}</div>
    ${!upd ? `<p class="small muted" style="margin-top:12px">${t("Questa lista non permette di cambiare le voci dalla plancia.", "This list doesn't allow changing items from the dashboard.")}</p>` : ""}`;
}
CHG.lsData = el => { if (E) { E.data = el.value; render(); } };
CHG.lsOra = el => { if (E) { E.ora = el.value; render(); } };

/* ---------- reparto con un tocco ---------- */
let R = null;
function schedaReparto() {
  const x = R && trova(R.id, R.uid); if (!x) return "";
  const k = chiave(x.summary), mio = dati()?.reparti?.[k], cur = repartoDi(x.summary), auto = repartoAuto(x.summary);
  return `<div class="sh-head"><div><h3>🗂 ${esc(x.summary)}</h3><div class="small muted">${t("In che reparto la trovi?", "Which aisle is it in?")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="ls1rg">${REPARTI().map(([rk, ic, n]) => `<button class="${rk === cur ? "on" : ""}" data-act="lsRepSet" data-v="${rk}" aria-pressed="${rk === cur}"><span aria-hidden="true">${ic}</span>${esc(n)}</button>`).join("")}</div>
    <p class="small muted" style="margin-top:12px">${t(`La plancia se lo ricorda per «${esc(x.summary)}», su tutti i dispositivi di casa.`, `The dashboard remembers it for «${esc(x.summary)}», on every device at home.`)}</p>
    ${mio ? `<button class="btn sm" data-act="lsRepSet" data-v="" style="margin-top:6px">↺ ${t("Torna automatico", "Back to automatic")} (${esc(reparto(auto)[2])})</button>` : ""}`;
}

/* ---------- suggerimenti: togliere quelli che non servono ---------- */
let SG = null;
function schedaSug() {
  const u = dati()?.uso?.[SG] || {}, L = Object.entries(u).sort((a, b) => peso(b[1]) - peso(a[1]));
  return `<div class="sh-head"><div><h3>💡 ${t("Suggerimenti", "Suggestions")}</h3><div class="small muted">${t("Le voci che aggiungete più spesso a ", "The items you add most often to ")}${esc(nm(SG))}. ${t("Valgono per tutta la casa.", "Shared by the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${L.length ? `<div class="ls1sm">${L.map(([k, e]) => `<div><b>${esc(e.s)}</b><span>${t(`${e.n} volt${e.n === 1 ? "a" : "e"}`, `${e.n} time${e.n === 1 ? "" : "s"}`)}</span><button class="fke1" data-act="lsSugDel" data-k="${esc(k)}" aria-label="${t("Togli ", "Remove ")}${esc(e.s)}">✕</button></div>`).join("")}</div>
      <button class="btn bad sm" data-act="lsSugZero" style="margin-top:14px">🗑 ${t("Dimentica tutti", "Forget all")}</button>` : `<div class="empty">${t("Ancora niente: si impara man mano che aggiungete.", "Nothing yet: it learns as you add items.")}</div>`}`;
}

/* ---------- ⚙️ liste (amministratori) ---------- */
function schedaCfg() {
  const nas = LAYOUT.liste?.nascoste || [];
  return `<div class="sh-head"><div><h3>⚙️ ${t("Liste", "Lists")}</h3><div class="small muted">${t("Valgono per tutta la casa.", "For the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${tutte().map(id => { const vis = !nas.includes(id), sp = isSpesa(id), n = nDaFare(id);
      return `<div class="li ls1cf"><span class="ic">${icona(id)}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc([PIATT[REG[id]?.platform] || id, n != null ? n + " " + t("da fare", "to do") : ""].filter(Boolean).join(" · "))}</span></div>
        <div class="vr1"><button class="${vis ? "on" : ""}" data-act="lsVis" data-id="${id}" aria-pressed="${vis}">👁 ${t("Visibile", "Visible")}</button><button class="${sp ? "on" : ""}" data-act="lsSp" data-id="${id}" aria-pressed="${sp}">🛒 ${t("Spesa", "Shopping")}</button></div></div>`; }).join("")}</div>
    <p class="small muted" style="margin-top:12px">${t("«Visibile»: la lista compare nella pagina e in Home. «Spesa»: le voci si raggruppano per reparto e ci sono i suggerimenti per la spesa (all'inizio lo decido io dal nome della lista).", "«Visible»: the list shows on the page and on Home. «Shopping»: items are grouped by aisle and there are shopping suggestions (at first I decide from the list's name).")}</p>`;
}

/* ---------- trascina per riordinare (solo nelle liste che lo permettono) ---------- */
let TR = null;
document.addEventListener("pointerdown", e => {
  const h = e.target.closest?.(".ls1hd"); if (!h || e.button > 0) return;
  const row = h.closest(".ls1r"), box = row?.parentElement; if (!row || !box?.dataset.mv) return;
  e.preventDefault();
  TR = { row, box, id: box.dataset.eid, uid: row.dataset.uid, y0: e.clientY, prima: [...box.children].indexOf(row) };
  box.dataset.drag = "1"; row.classList.add("drag");
  try { h.setPointerCapture(e.pointerId); } catch {}
});
document.addEventListener("pointermove", e => {
  if (!TR) return;
  const { row, box } = TR;
  const scambia = sib => { const a = row.offsetTop; if (sib === row.nextElementSibling) box.insertBefore(sib, row); else box.insertBefore(row, sib); TR.y0 += row.offsetTop - a; };
  row.style.transform = `translateY(${e.clientY - TR.y0}px)`;
  const r = row.getBoundingClientRect(), c = r.top + r.height / 2, nx = row.nextElementSibling, pv = row.previousElementSibling;
  if (nx) { const q = nx.getBoundingClientRect(); if (c > q.top + q.height / 2) scambia(nx); }
  if (pv) { const q = pv.getBoundingClientRect(); if (c < q.top + q.height / 2) scambia(pv); }
  row.style.transform = `translateY(${e.clientY - TR.y0}px)`;
  if (e.clientY < 70) scrollBy(0, -12); else if (e.clientY > innerHeight - 90) scrollBy(0, 12);
}, { passive: true });
function fineTrascina() {
  if (!TR) return;
  const { row, box, id, uid, prima } = TR; TR = null;
  row.style.transform = ""; row.classList.remove("drag"); delete box.dataset.drag;
  const R1 = [...box.children], i = R1.indexOf(row);
  if (i === prima) return render(true);
  sposta(id, uid, i > 0 ? R1[i - 1].dataset.uid : null);
}
document.addEventListener("pointerup", fineTrascina);
document.addEventListener("pointercancel", fineTrascina);

/* ---------- tastiera ---------- */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.isComposing || !["ls1in", "ls1hin"].includes(e.target.id)) return;
  e.preventDefault();
  const el = e.target, v = el.value; el.value = ""; if (el.id === "ls1in") UIL.q = "";
  aggiungi(el.dataset.eid, v);
});
document.addEventListener("input", e => { if (e.target.id === "ls1in") { UIL.q = e.target.value; render(); } });
const daCampo = (sel, id) => { const el = document.getElementById(sel); if (!el) return; const v = el.value; el.value = ""; if (sel === "ls1in") UIL.q = ""; aggiungi(id, v); el.focus(); };

Object.assign(ACT, {
  lsSel: el => { sSet("listaSel", el.dataset.id); UIL.q = ""; const i = document.getElementById("ls1in"); if (i) i.value = ""; render(true); },
  lsApri: el => { sSet("listaSel", el.dataset.id); go("liste"); },
  lsAdd: el => daCampo("ls1in", el.dataset.id),
  lsAddH: el => daCampo("ls1hin", el.dataset.id),
  lsSug: el => { aggiungi(el.dataset.id, el.dataset.v); if (UIL.q) { UIL.q = ""; const i = document.getElementById("ls1in"); if (i) i.value = ""; } },
  lsFatto: el => segna(el.dataset.id, el.dataset.uid),
  lsVoce: el => apriVoce(el.dataset.id, el.dataset.uid),
  lsVista: el => { sSet("listaVista_" + el.dataset.id, el.dataset.v); render(true); },
  lsHome: el => { sSet("listaHome", el.dataset.id); toast("⭐ " + nm(el.dataset.id) + t(" in Home", " on Home")); render(true); },
  lsFatte: el => { const id = el.dataset.id; UIL.fatte[id] = !(UIL.fatte[id] ?? fatte(V[id]?.voci).length <= 6); render(true); },
  lsSvuota: async el => {
    const id = el.dataset.id, n = fatte(V[id]?.voci).length; if (!n) return;
    if (!sicuro(el, t(`Tocca ancora: tolgo ${n} voc${n === 1 ? "e" : "i"}`, `Tap again: remove ${n} item${n === 1 ? "" : "s"}`))) return;
    V[id].voci = daFare(V[id].voci); render();
    if (await cmd(id, "remove_completed_items", {})) toast("🧹 " + t(`Tolte ${n} voci fatte`, `Removed ${n} done items`));
  },
  lsRileggi: el => { const v = V[el.dataset.id]; if (v) { v.err = false; render(); leggi(el.dataset.id); } },
  lsRep: el => { R = { id: el.dataset.id, uid: el.dataset.uid, daVoce: UI.sheet === schedaVoce }; openSheet(schedaReparto); },
  lsRepSet: async el => {
    const x = R && trova(R.id, R.uid); if (!x) return closeSheet();
    const k = chiave(x.summary), rk = el.dataset.v; if (!k) return closeSheet();
    const ok1 = await casaCambia(SEZ, d => {
      d.reparti = d.reparti || {};
      if (!rk || rk === repartoAuto(x.summary)) delete d.reparti[k]; else d.reparti[k] = rk;
      const K = Object.keys(d.reparti); if (K.length > MAX_REPARTI) K.slice(0, K.length - MAX_REPARTI).forEach(y => delete d.reparti[y]);   // i più vecchi
    }, () => reparto(rk || repartoAuto(x.summary))[1] + " " + x.summary + " → " + reparto(rk || repartoAuto(x.summary))[2]);
    if (ok1) { if (R.daVoce && E?.uid === x.uid) openSheet(schedaVoce); else closeSheet(); }
  },
  lsDataV: el => { if (!E) return; E.data = el.dataset.v; if (!E.data) E.ora = "";
    const d = document.getElementById("ls1ed"), o = document.getElementById("ls1eo"); if (d) d.value = E.data; if (o && !E.data) o.value = ""; render(); },
  lsSalva: async () => {
    const x = E && trova(E.id, E.uid); if (!x) return closeSheet();
    const id = E.id, fd = puo(id, F_DATA), fo = puo(id, F_ORA), data = { item: x.uid }, loc = {};
    const n = document.getElementById("ls1en"), no = document.getElementById("ls1eno"), dd = document.getElementById("ls1ed"), oo = document.getElementById("ls1eo");
    const nome = (n?.value || "").replace(/\s+/g, " ").trim().slice(0, 255);
    if (n && !nome) { toast(t("Scrivi il nome", "Write the name"), true); n.focus(); return; }
    if (n && nome !== x.summary) { data.rename = nome; loc.summary = nome; }
    if (no) { const d = no.value.trim(); if (d !== (x.description || "")) { data.description = d || null; loc.description = d; } }
    if (dd && (fd || fo)) {
      const g = dd.value, o = oo?.value || "", p = partiScad(x.due);
      if (g !== p.data || (fo && g && o !== p.ora)) {
        if (!g) data[fd ? "due_date" : "due_datetime"] = null;
        else if (fo && (o || !fd)) data.due_datetime = `${g} ${o || "09:00"}:00`;
        else data.due_date = g;
        loc.due = !g ? null : data.due_datetime ? new Date(`${g}T${o || "09:00"}:00`).toISOString() : g;
      }
    }
    closeSheet(); E = null;
    if (Object.keys(data).length === 1) return;
    Object.assign(x, loc); render();
    if (await cmd(id, "update_item", data)) toast("💾 " + (loc.summary || x.summary));
  },
  lsFattoE: () => { if (!E) return; const { id, uid } = E; closeSheet(); E = null; segna(id, uid); },
  lsSu: () => { if (!E) return; const A = daFare(V[E.id]?.voci), i = A.findIndex(y => y.uid === E.uid); if (i > 0) sposta(E.id, E.uid, i > 1 ? A[i - 2].uid : null); },
  lsGiu: () => { if (!E) return; const A = daFare(V[E.id]?.voci), i = A.findIndex(y => y.uid === E.uid); if (i >= 0 && i < A.length - 1) sposta(E.id, E.uid, A[i + 1].uid); },
  lsDel: async el => {
    const x = E && trova(E.id, E.uid); if (!x) return closeSheet();
    if (!sicuro(el, t("Tocca ancora per eliminare", "Tap again to delete"))) return;
    const id = E.id; closeSheet(); E = null;
    V[id].voci = V[id].voci.filter(y => y !== x); render();
    if (await cmd(id, "remove_item", { item: [x.uid] })) toast("🗑 " + x.summary);
  },
  lsSugCfg: el => { SG = el.dataset.id; openSheet(schedaSug); },
  lsSugDel: el => { const k = el.dataset.k, id = SG; casaCambia(SEZ, d => { if (!d.uso?.[id]?.[k]) return false; delete d.uso[id][k]; }); },
  lsSugZero: el => { if (!sicuro(el, t("Tocca ancora per dimenticarli", "Tap again to forget them"))) return; const id = SG;
    casaCambia(SEZ, d => { if (!d.uso?.[id]) return false; delete d.uso[id]; }, "🗑 " + t("Suggerimenti azzerati", "Suggestions cleared")).then(ok1 => ok1 && closeSheet()); },
  lsCfg: () => openSheet(schedaCfg),
  lsVis: el => { const id = el.dataset.id; cambia(l => { l.liste = { ...(l.liste || {}) }; const s = new Set(l.liste.nascoste || []); s.has(id) ? s.delete(id) : s.add(id); l.liste.nascoste = [...s]; }); },
  lsSp: el => { const id = el.dataset.id, nuovo = !isSpesa(id);
    cambia(l => { l.liste = { ...(l.liste || {}) }; const sp = { ...(l.liste.spesa || {}) }; if (nuovo === spesaAuto(id)) delete sp[id]; else sp[id] = nuovo; l.liste.spesa = sp; }); },
});

/* sul telefono le liste sono una fila che scorre: porto in vista quella aperta quando cambia */
let vista0 = null;
function dopo() {
  const a = document.querySelector(".ls1sb.act"), box = a?.parentElement; if (!a || !box) return;
  const k = a.dataset.id + ":" + box.clientWidth; if (k === vista0) return; vista0 = k;
  if (box.scrollWidth > box.clientWidth && (a.offsetLeft < box.scrollLeft || a.offsetLeft + a.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollLeft = a.offsetLeft - 12;
}

page("liste", { title: t("Liste", "Lists"), short: t("Liste", "Lists"), icon: "🛒", order: 40.5, after: dopo,
  show: () => tutte().length > 0 && (liste().length > 0 || isAdmin()),
  badge: () => liste().some(id => daFare(V[id]?.voci).some(x => scad(x)?.cls === "ritardo")),
  render: pagina });

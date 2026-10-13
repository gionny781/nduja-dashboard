/* Pagine create dall'utente: un nome, un'icona e dentro quello che vuole (luci, clima, prese, sensori, telecamere…). */
import { S, ACT, LAYOUT, PAGES, HOOKS, UI, t, esc, nm, ok, attr, domain, card, empty, lightTile, climateCard, entityRow, page, isAdmin,
  saveLayout, toast, openSheet, closeSheet, go, render, moreInfo } from "../core.js";
import { item, addBtn, TIPI } from "../edit.js";

const ICONE = ["⭐", "🏠", "🛋️", "🍳", "🛏️", "🛁", "🧸", "💼", "🌳", "🚗", "🔌", "💡", "❄️", "🔥", "🎮", "📺", "🎵", "🔒", "📷", "🐶", "🌱", "⚡", "🧺", "🍷"];
const TUTTI = () => Object.keys(TIPI());
const pid = k => "c_" + k;

function sensore(id) {
  const u = attr(id, "unit_of_measurement");
  return `<button class="sv1" data-act="more" data-id="${id}"><small>${esc(nm(id))}</small><b>${ok(id) ? esc(S[id].state) : "—"}${u ? `<i>${esc(u)}</i>` : ""}</b></button>`;
}
function pagina(p) {
  const it = p.items.filter(id => S[id]), L = it.filter(id => domain(id) === "light"), C = it.filter(id => domain(id) === "climate");
  const V = it.filter(id => ["sensor", "binary_sensor"].includes(domain(id))), CAM = it.filter(id => domain(id) === "camera");
  const R = it.filter(id => !L.includes(id) && !C.includes(id) && !V.includes(id) && !CAM.includes(id));
  const k = p.id;
  return `<div class="g g3">
    ${UI.edit ? `<section class="card span3 row between" style="flex-wrap:wrap;gap:8px"><b>${esc(p.icon)} ${esc(p.title)}</b><span class="row" style="gap:8px">
      <button class="btn sm" data-act="pgEdit" data-id="${k}">✏️ ${t("Nome e icona", "Name and icon")}</button><button class="btn sm bad" data-act="pgDel" data-id="${k}">🗑 ${t("Elimina pagina", "Delete page")}</button></span></section>` : ""}
    ${!it.length && !UI.edit ? card("", empty(t("Pagina vuota: premi ✏️ Modifica in alto e poi ＋ Aggiungi.", "Empty page: press ✏️ Edit at the top, then ＋ Add.")), { cls: "span3" }) : ""}
    ${L.length ? card("💡 " + t("Luci", "Lights"), `<div class="tiles">${L.map(id => item(id, lightTile(id), k)).join("")}</div>`, { cls: "span2" }) : ""}
    ${C.length ? card("❄️ " + t("Clima", "Climate"), `<div class="stack">${C.map(id => item(id, climateCard(id), k)).join("")}</div>`) : ""}
    ${R.length ? card("🔌 " + t("Dispositivi", "Devices"), `<div class="stack">${R.map(id => item(id, entityRow(id), k)).join("")}</div>`) : ""}
    ${V.length ? card("📈 " + t("Sensori", "Sensors"), `<div class="sg1">${V.map(id => item(id, sensore(id), k)).join("")}</div>`) : ""}
    ${CAM.length ? card("📷 " + t("Telecamere", "Cameras"), `<div class="cg1">${CAM.map(id => item(id, `<button class="cam1" data-act="more" data-id="${id}"><img src="${esc(attr(id, "entity_picture") || "")}" alt=""><span>${esc(nm(id))}</span></button>`, k)).join("")}</div>`, { cls: "span3" }) : ""}
    ${UI.edit ? `<section class="card span3">${addBtn(TUTTI(), { page: k, label: t("Aggiungi a questa pagina", "Add to this page"), big: true })}</section>` : ""}
  </div>`;
}

/* registra e toglie le pagine dell'utente quando cambiano le scelte */
HOOKS.push(() => {
  const L = LAYOUT.customPages || [], ids = L.map(p => pid(p.id));
  Object.keys(PAGES).filter(k => k.startsWith("c_") && !ids.includes(k)).forEach(k => delete PAGES[k]);
  L.forEach((p, i) => { PAGES[pid(p.id)] = { order: 60 + i, show: () => true, editable: true, title: p.title, short: p.title.length > 9 ? p.title.slice(0, 8) + "…" : p.title, icon: p.icon || "⭐", render: () => pagina(p) }; });
});

/* ---------- nuova pagina, nome e icona ---------- */
const FORM = { title: "", icon: "⭐", id: null };
function scheda() {
  return `<div class="sh-head"><div><h3>${FORM.id ? "✏️ " + t("Modifica pagina", "Edit page") : "＋ " + t("Nuova pagina", "New page")}</h3></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="pg1n" type="text" maxlength="24" value="${esc(FORM.title)}" placeholder="${t("Es. Giardino, Ufficio, Bambini…", "E.g. Garden, Office, Kids…")}"></label>
    <div class="fld1"><span>${t("Icona", "Icon")}</span><div class="ic1">${ICONE.map(i => `<button class="${FORM.icon === i ? "act" : ""}" data-act="pgIcon" data-v="${i}">${i}</button>`).join("")}</div></div>
    <button class="btn pri" data-act="pgSave" style="margin-top:12px">💾 ${FORM.id ? t("Salva", "Save") : t("Crea la pagina", "Create page")}</button>`;
}
const copia = () => JSON.parse(JSON.stringify(LAYOUT));
Object.assign(ACT, {
  edNewPage: () => { Object.assign(FORM, { title: "", icon: "⭐", id: null }); openSheet(scheda); },
  pgEdit: el => { const p = (LAYOUT.customPages || []).find(x => x.id === el.dataset.id); if (p) { Object.assign(FORM, { title: p.title, icon: p.icon, id: p.id }); openSheet(scheda); } },
  pgIcon: el => { FORM.title = document.getElementById("pg1n")?.value ?? FORM.title; FORM.icon = el.dataset.v; render(); },
  pgSave: async () => {
    const title = document.getElementById("pg1n").value.trim(); if (!title) return toast(t("Scrivi un nome", "Type a name"), true);
    const l = copia(); l.customPages = l.customPages || [];
    let id = FORM.id;
    if (id) Object.assign(l.customPages.find(p => p.id === id), { title, icon: FORM.icon });
    else { id = Date.now().toString(36); l.customPages.push({ id, title, icon: FORM.icon, items: [] }); }
    try { await saveLayout(l); closeSheet(); render(true); if (!FORM.id) { UI.edit = true; go(pid(id)); UI.edit = true; render(true); } toast("💾 " + title); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
  },
  pgDel: async el => {
    if (el.dataset.sure !== "1") { const old = el.textContent; el.dataset.sure = "1"; el.textContent = t("Sicuro? Tocca ancora", "Sure? Tap again"); setTimeout(() => { if (el.isConnected) { el.dataset.sure = ""; el.textContent = old; } }, 3500); return; }
    const l = copia(); l.customPages = (l.customPages || []).filter(p => p.id !== el.dataset.id);
    await saveLayout(l).catch(() => {}); go("home"); toast("🗑 " + t("Pagina eliminata", "Page deleted"));
  },
});

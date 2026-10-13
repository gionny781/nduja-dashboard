/* 'Nduja Dashboard — modifica direttamente nelle sezioni (solo amministratori):
   «＋ Aggiungi» apre l'elenco dei dispositivi di quel tipo con la ricerca, «✏️» su un elemento cambia nome e stanza,
   «✕» lo toglie dalla plancia. Ogni modifica si salva subito in Home Assistant. */
import { S, AREAS, FLOORS, REG, ACT, LAYOUT, UI, t, LOC, esc, nm, nmHA, ok, attr, allEnts, areaOf, areasSorted, excluded,
  isManual, saveLayout, render, toast, openSheet, closeSheet, domain, deviceClass, OPENING } from "./core.js";

const copia = () => JSON.parse(JSON.stringify(LAYOUT));
async function salva(l, msg) {
  try { await saveLayout(l); if (msg) toast(msg); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
}
export const TIPI = () => ({
  light: ["💡", t("Luci", "Lights"), t("luce", "light")], climate: ["❄️", t("Clima", "Climate"), t("climatizzatore", "climate device")],
  switch: ["🔌", t("Prese e interruttori", "Plugs and switches"), t("presa", "plug")], cover: ["🪟", t("Tapparelle", "Covers"), t("tapparella", "cover")],
  fan: ["🌀", t("Ventilatori", "Fans"), t("ventilatore", "fan")], media_player: ["📺", "TV & media", "TV"], lock: ["🔒", t("Serrature", "Locks"), t("serratura", "lock")],
  vacuum: ["🤖", t("Robot", "Vacuums"), "robot"], humidifier: ["💧", t("Umidificatori", "Humidifiers"), t("umidificatore", "humidifier")],
  scene: ["🎬", t("Scene", "Scenes"), t("scena", "scene")], person: ["👤", t("Persone", "People"), t("persona", "person")],
  sensor: ["📈", t("Sensori", "Sensors"), t("sensore", "sensor")], binary_sensor: ["🚪", t("Porte, finestre e sensori", "Doors, windows and sensors"), t("sensore", "sensor")],
  camera: ["📷", t("Telecamere", "Cameras"), t("telecamera", "camera")], script: ["▶️", "Script", "script"], input_boolean: ["🔘", t("Interruttori virtuali", "Toggles"), t("interruttore", "toggle")],
  valve: ["🚰", t("Valvole", "Valves"), t("valvola", "valve")], siren: ["🚨", t("Sirene", "Sirens"), t("sirena", "siren")],
});
const custom = pid => (LAYOUT.customPages || []).find(p => p.id === pid);

/* ---------- pezzi da usare nelle pagine ---------- */
/** avvolge un elemento: in modifica mostra ✏️ e ✕ */
export function item(id, html, pid = "") {
  if (!UI.edit) return html;
  return `<div class="ed1">${html}<div class="edb"><button data-act="edItem" data-id="${id}" data-page="${pid}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="edDel" data-id="${id}" data-page="${pid}" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}
/** pulsante «＋ Aggiungi …» (solo in modifica) */
export function addBtn(doms, { area = "", page = "", label = "", big = false } = {}) {
  if (!UI.edit) return "";
  const T = TIPI(), n = label || t("Aggiungi ", "Add ") + (doms.length === 1 ? (T[doms[0]]?.[2] || doms[0]) : t("dispositivo", "device"));
  return `<button class="add1 ${big ? "wide1" : ""}" data-act="edAdd" data-dom="${doms.join(",")}" data-area="${area}" data-page="${page}"><span>＋</span>${esc(n)}</button>`;
}

/* ---------- elenco per aggiungere ---------- */
const PK = { doms: [], area: "", page: "", q: "", dom: "" };
const visibileOra = (id) => PK.page ? (custom(PK.page)?.items || []).includes(id) : !excluded(id);
function candidati() {
  const doms = PK.dom ? [PK.dom] : PK.doms;
  return doms.flatMap(d => allEnts(d, id => d !== "binary_sensor" || PK.page || OPENING.includes(deviceClass(id))))
    .filter(id => !visibileOra(id))
    .filter(id => !PK.q || (nm(id) + " " + id + " " + (AREAS[areaOf(id)]?.name || "")).toLowerCase().includes(PK.q.toLowerCase()));
}
function picker() {
  const T = TIPI(), L = candidati(), g = {};
  L.forEach(id => (g[areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"] = g[areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
  const ord = [...areasSorted(true).filter(a => g[a]), ...(g._ ? ["_"] : [])];
  if (PK.area && g[PK.area]) ord.splice(ord.indexOf(PK.area), 1), ord.unshift(PK.area);
  const titolo = PK.doms.length === 1 ? (T[PK.doms[0]]?.[1] || PK.doms[0]) : t("Dispositivi", "Devices");
  return `<div class="sh-head"><div><h3>＋ ${esc(titolo)}</h3><div class="small muted">${t("Tocca per aggiungere. Puoi aggiungerne più di uno.", "Tap to add. You can add more than one.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <input id="pk1q" class="pk1q" type="search" placeholder="🔍 ${t("Cerca per nome o stanza…", "Search by name or room…")}" value="${esc(PK.q)}" autocomplete="off">
    ${PK.doms.length > 1 ? `<div class="pkt1"><button class="${!PK.dom ? "act" : ""}" data-act="pkDom" data-v="">${t("Tutti", "All")}</button>${PK.doms.filter(d => allEnts(d).length).map(d => `<button class="${PK.dom === d ? "act" : ""}" data-act="pkDom" data-v="${d}">${T[d]?.[0] || ""} ${esc(T[d]?.[1] || d)}</button>`).join("")}</div>` : ""}
    ${L.length ? ord.map(a => `<div class="fl1">${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)}</div><div class="pkl1">${g[a].sort((x, y) => nm(x).localeCompare(nm(y), LOC)).map(id => `<button class="pk1" data-act="edPick" data-id="${id}">
        <span class="ic">${T[domain(id)]?.[0] || "•"}</span><span class="tx"><b>${esc(nm(id))}</b><small>${esc(id)}</small></span><span class="st">${ok(id) ? esc(S[id].state) + (attr(id, "unit_of_measurement") ? " " + esc(attr(id, "unit_of_measurement")) : "") : t("non raggiungibile", "unavailable")}</span><span class="plus">＋</span></button>`).join("")}</div>`).join("")
      : `<div class="empty">${PK.q ? t("Nessun risultato.", "No results.") : t("Hai già aggiunto tutto quello che c'è di questo tipo.", "You've already added everything of this kind.")}</div>`}`;
}
document.addEventListener("input", e => { if (e.target.id === "pk1q") { PK.q = e.target.value; render(); } });

/* ---------- scheda di un elemento ---------- */
function scheda(id, pid) {
  const r = LAYOUT.rooms?.[id] || "", haArea = REG[id]?.area;
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted mono">${esc(id)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome nella plancia", "Name in the dashboard")}</span><input id="ed1n" type="text" value="${esc(LAYOUT.names?.[id] || "")}" placeholder="${esc(nmHA(id))}"></label>
    <label class="fld1"><span>${t("Stanza", "Room")}</span><select id="ed1r"><option value="">${haArea && AREAS[haArea] ? t("Come in Home Assistant", "As in Home Assistant") + ` (${esc(AREAS[haArea].name)})` : t("Nessuna stanza", "No room")}</option>
      ${areasSorted(true).map(a => `<option value="${a}" ${r === a ? "selected" : ""}>${esc(AREAS[a].name)}${FLOORS[AREAS[a].floor] ? " · " + esc(FLOORS[AREAS[a].floor].name) : ""}</option>`).join("")}</select></label>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="edSave" data-id="${id}">💾 ${t("Salva", "Save")}</button>
      <button class="btn bad" data-act="edDel" data-id="${id}" data-page="${pid}">✕ ${t("Togli dalla plancia", "Remove from dashboard")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Il nome e la stanza cambiano solo nella plancia, non in Home Assistant.", "Name and room change only in the dashboard, not in Home Assistant.")}</p>`;
}

/* ---------- azioni ---------- */
Object.assign(ACT, {
  edToggle: () => { UI.edit = !UI.edit; render(true); },
  edAdd: el => { Object.assign(PK, { doms: el.dataset.dom.split(","), area: el.dataset.area, page: el.dataset.page, q: "", dom: "" }); openSheet(picker); },
  pkDom: el => { PK.dom = el.dataset.v; render(); },
  edPick: el => {
    const id = el.dataset.id, l = copia();
    if (PK.page) { const p = (l.customPages || []).find(x => x.id === PK.page); if (p && !p.items.includes(id)) p.items.push(id); }
    else {
      if (isManual()) l.include = [...new Set([...(l.include || []), id])]; else l.exclude = (l.exclude || []).filter(x => x !== id);
      if (PK.area && !areaOf(id)) l.rooms = { ...(l.rooms || {}), [id]: PK.area };
      if (areaOf(id) && (l.hiddenAreas || []).includes(areaOf(id))) l.hiddenAreas = l.hiddenAreas.filter(a => a !== areaOf(id));
    }
    salva(l, "＋ " + nm(id));
  },
  edDel: el => {
    const id = el.dataset.id, pid = el.dataset.page, l = copia();
    if (pid) { const p = (l.customPages || []).find(x => x.id === pid); if (p) p.items = p.items.filter(x => x !== id); }
    else if (isManual()) l.include = (l.include || []).filter(x => x !== id);
    else l.exclude = [...new Set([...(l.exclude || []), id])];
    if (UI.sheet) closeSheet();
    salva(l, "✕ " + nm(id));
  },
  edItem: el => { const id = el.dataset.id, pid = el.dataset.page; openSheet(() => scheda(id, pid)); },
  edSave: el => {
    const id = el.dataset.id, l = copia(), n = document.getElementById("ed1n").value.trim(), r = document.getElementById("ed1r").value;
    l.names = { ...(l.names || {}) }; l.rooms = { ...(l.rooms || {}) };
    if (n && n !== nmHA(id)) l.names[id] = n; else delete l.names[id];
    if (r) l.rooms[id] = r; else delete l.rooms[id];
    closeSheet(); salva(l, "💾 " + (n || nmHA(id)));
  },
});

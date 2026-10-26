/* Luci: riepilogo (quante accese e dove, «Spegni tutto», scene di luce), poi le stanze per piano con le tessere grandi di luce.js.
   Con ✏️ Modifica: ＋ luci nascoste e interruttori che comandano una luce, ✕ toglie, ◀ ▶ ordine, ✏️ nome, stanza e icona. */
import { S, AREAS, FLOORS, ACT, LAYOUT, UI, t, LOC, esc, nm, nmHA, ok, attr, ents, allEnts, areaOf, areasSorted, luci, luciContate, lightsOn, luciComando,
  isLightGroup, isLightSwitch, membriLuce, deviceClass, lightTile, card, empty, page, isAdmin, openSheet, closeSheet, render } from "../core.js";
import { cambia, mostra } from "../edit.js";
import { luciPerStanza, iconaPiccola, svgLuce, iconaAuto, coloreDi } from "../luce.js";

const nomeStanza = a => a === "_" ? t("Senza stanza", "No room") : AREAS[a]?.name || a;

/* ---------- scene di luce: quelle che comandano luci (o di Hue), o con un nome da luce ---------- */
const LUCE_NOME = /luc[ei]|light|lamp|relax|lettur|reading|notte|night|cena|dinner|film|movie|tv|cinema|romant|soft|soffus|bright|dim|giorno|day|sera|evening|party|festa|concentra|focus|energ|tramonto|sunset|alba/i;
function sceneLuce() {
  const L = new Set(luci());
  return ents("scene", id => { const E = attr(id, "entity_id");
    if (Array.isArray(E)) return E.some(x => x.startsWith("light.") || L.has(x));
    return attr(id, "is_hue_scene") === true || LUCE_NOME.test(nm(id)); }).sort((a, b) => nm(a).localeCompare(nm(b), LOC));
}

/* ---------- riepilogo in alto ---------- */
function riepilogo() {
  const C = luciContate(), on = C.filter(id => S[id].state === "on"), dove = {};
  on.forEach(id => { const a = areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"; dove[a] = (dove[a] || 0) + 1; });
  const zone = [...areasSorted().filter(a => dove[a]), ...(dove._ ? ["_"] : [])], SC = sceneLuce();
  const frase = on.length ? t(`${on.length === 1 ? "accesa" : "accese"} su ${C.length}`, `on of ${C.length}`) : t(`tutte spente · ${C.length} luc${C.length === 1 ? "e" : "i"}`, `all off · ${C.length} light${C.length === 1 ? "" : "s"}`);
  /* il riepilogo prende il colore medio delle luci accese */
  const C3 = on.map(coloreDi).filter(Boolean), media = C3.length ? [0, 1, 2].map(i => Math.round(C3.reduce((s, c) => s + c[i], 0) / C3.length)).join(",") : "";
  return `<section class="card span3 lu1 ${media ? "acc" : ""}" ${media ? `style="--lr:${media}"` : ""}>
    <div class="lu1a"><div class="lu1n"><b>${on.length}</b><span>${frase}</span></div>
      <div class="lu1d" aria-hidden="true">${on.slice(0, 24).map(id => iconaPiccola(id)).join("")}</div>
      ${on.length ? `<button class="btn warm lu1x" data-act="lightsOff">⏻ ${t("Spegni tutto", "Turn everything off")}</button>` : ""}</div>
    ${zone.length ? `<div class="lu1z">${zone.map(a => `<button data-act="luVai" data-id="${a}"><b>${dove[a]}</b>${esc(nomeStanza(a))}</button>`).join("")}</div>` : ""}
    ${SC.length ? `<div class="lu1s"><span class="small muted">🎬 ${t("Scene", "Scenes")}</span>${SC.map(id => `<button class="btn sm" data-act="toggle" data-id="${id}">${esc(nm(id))}</button>`).join("")}</div>` : ""}
  </section>`;
}

/* ---------- tessere, con i comandi di modifica ---------- */
function tesseraEd(id, L, i) {
  const html = lightTile(id);
  if (!UI.edit) return html;
  return `<div class="ed1">${html}<div class="edb">
    <button data-act="luMove" data-id="${id}" data-v="-1" ${i > 0 ? "" : "disabled"} aria-label="${t("Sposta prima", "Move earlier")}">◀</button><button data-act="luMove" data-id="${id}" data-v="1" ${i < L.length - 1 ? "" : "disabled"} aria-label="${t("Sposta dopo", "Move later")}">▶</button>
    <button data-act="edItem" data-id="${id}" data-page="${isLightSwitch(id) ? "lu:sw" : ""}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="edDel" data-id="${id}" data-page="${isLightSwitch(id) ? "lu:sw" : ""}" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}
const aggiungi = (a = "", big = false) => UI.edit ? `<button class="add1 ${big ? "wide1" : ""}" data-act="luAdd" data-area="${a === "_" ? "" : a}"><span>＋</span>${t("Aggiungi luce", "Add light")}</button>` : "";
function stanza(a, L) {
  const on = a === "#g" ? L.filter(id => S[id].state === "on").length : lightsOn(a === "_" ? null : a).filter(id => a !== "_" || !areaOf(id) || !AREAS[areaOf(id)]).length;
  const destra = (UI.edit && a !== "_" && a !== "#g" ? `<button class="btn sm" data-act="rmEdit" data-id="${a}">✏️ ${t("Stanza", "Room")}</button>` : "")
    + (UI.edit ? "" : on ? `<button class="btn sm" data-act="luStanza" data-id="${a}" data-v="0">${t("Spegni", "Turn off")}</button>`
      : L.some(id => ok(id)) ? `<button class="btn sm" data-act="luStanza" data-id="${a}" data-v="1">${t("Accendi", "Turn on")}</button>` : "");
  return `<section class="card lu2 ${L.length > 4 ? "span2" : ""}" id="lu-${esc(a)}"><div class="ch"><h2>${a === "#g" ? "▦ " + t("Gruppi", "Groups") : esc(nomeStanza(a))} ${on ? `<span class="tag warn">${on}</span>` : ""}</h2>${destra}</div>
    <div class="lts2">${L.map((id, i) => tesseraEd(id, L, i)).join("")}${a !== "#g" ? aggiungi(a) : ""}</div></section>`;
}

function pagina() {
  const tutte = luci();
  if (!tutte.length) return `<div class="g">${card("💡 " + t("Luci", "Lights"), (UI.edit ? "" : empty(t("Nessuna luce: premi ✏️ Modifica in alto per aggiungerne.", "No lights: press ✏️ Edit at the top to add some."))) + aggiungi("", true))}</div>`;
  const { stanze, gruppi } = luciPerStanza(), piani = Object.keys(FLOORS).length > 1;
  const zone = [...areasSorted().filter(a => stanze[a]), ...(stanze._ ? ["_"] : [])];
  let piano;
  const blocchi = zone.map(a => {
    const f = a === "_" ? "_" : AREAS[a].floor || "_";
    const intest = piani && f !== piano ? `<div class="fl1 span3 lu2f">${esc(FLOORS[f]?.name || t("Altre", "Other"))}</div>` : ""; piano = f;
    return intest + stanza(a, stanze[a]);
  });
  return `<div class="g g3">${riepilogo()}${gruppi.length ? stanza("#g", gruppi) : ""}${blocchi.join("")}
    ${UI.edit ? `<section class="card span3">${aggiungi("", true)}<p class="small muted" style="margin-top:10px">${t("◀ ▶ cambia l'ordine, ✏️ nome, stanza e icona, ✕ toglie la luce dalla plancia. Con ＋ ritrovi le luci tolte e puoi aggiungere gli interruttori che comandano una luce. I gruppi di luci raccolgono da soli le loro luci: le trovi tenendo premuto sul gruppo.", "◀ ▶ changes the order, ✏️ name, room and icon, ✕ removes the light from the dashboard. With ＋ you get back removed lights and can add switches that control a light. Light groups gather their own lights: press and hold the group to see them.")}</p></section>` : ""}</div>`;
}

/* ---------- ＋ aggiungi: luci tolte e interruttori che comandano una luce ---------- */
const AG = { area: "", q: "" };
const SEMBRA_LUCE = /luc[ei]|light|lamp|lampad|faret|spot|\bled\b|_led|strip|striscia|plafon|abat|piantana|applique|neon|insegna|illumin|chandelier|ceiling/i;
function foglioAggiungi() {
  const q = AG.q.toLowerCase(), cerca = id => !q || (nm(id) + " " + id + " " + (AREAS[areaOf(id)]?.name || "")).toLowerCase().includes(q);
  const vis = new Set(ents("light")), tolte = allEnts("light").filter(id => !vis.has(id) && cerca(id)).sort((a, b) => nm(a).localeCompare(nm(b), LOC));
  const sw = allEnts("switch", id => !isLightSwitch(id)).filter(cerca).map(id => ({ id, p: SEMBRA_LUCE.test(id + " " + nmHA(id)) ? 2 : deviceClass(id) === "switch" ? 1 : 0 }))
    .filter(x => q || x.p > 0).sort((a, b) => b.p - a.p || (areaOf(b.id) === AG.area) - (areaOf(a.id) === AG.area) || nm(a.id).localeCompare(nm(b.id), LOC));
  const altri = q ? 0 : allEnts("switch", id => !isLightSwitch(id)).length - sw.length;
  const riga = (id, extra, tipo) => `<button class="pk1 ${extra ? "sug1" : ""}" data-act="luPick" data-id="${id}" data-v="${tipo}">
    <span class="ic lu6">${svgLuce(iconaAuto(id))}</span><span class="tx"><b>${esc(nm(id))}</b><small>${extra ? `<em>${extra}</em> · ` : ""}${esc(AREAS[areaOf(id)]?.name || t("senza stanza", "no room"))} · ${esc(id)}</small></span>
    <span class="st">${ok(id) ? (S[id].state === "on" ? t("accesa", "on") : t("spenta", "off")) : t("non raggiungibile", "unavailable")}</span><span class="plus">＋</span></button>`;
  return `<div class="sh-head"><div><h3>＋ ${t("Aggiungi luce", "Add light")}</h3><div class="small muted">${t("Tocca per aggiungere. Puoi aggiungerne più di una.", "Tap to add. You can add more than one.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <input id="lu1q" class="pk1q" type="search" placeholder="🔍 ${t("Cerca per nome o stanza…", "Search by name or room…")}" value="${esc(AG.q)}" autocomplete="off">
    ${tolte.length ? `<div class="fl1">💡 ${t("Luci non mostrate", "Lights not shown")}</div><div class="pkl1">${tolte.map(id => riga(id, "", "light")).join("")}</div>` : ""}
    ${sw.length ? `<div class="fl1">🔌 ${t("Interruttori che comandano una luce", "Switches that control a light")}</div><div class="small muted" style="margin:-4px 2px 8px">${t("Diventano luci: escono da Prese e compaiono qui, con l'icona che scegli. Con ✕ tornano tra le prese.", "They become lights: they leave Plugs and show up here, with the icon you choose. ✕ puts them back in Plugs.")}</div>
      <div class="pkl1">${sw.map(x => riga(x.id, x.p === 2 ? "✨ " + t("sembra una luce", "looks like a light") : x.p === 1 ? t("interruttore", "switch") : "", "sw")).join("")}</div>` : ""}
    ${altri > 0 ? `<p class="small muted" style="margin-top:10px">${t(`Altri ${altri} interruttori e prese: cerca per nome per trovarli.`, `${altri} more switches and plugs: search by name to find them.`)}</p>` : ""}
    ${!tolte.length && !sw.length ? `<div class="empty">${q ? t("Nessun risultato.", "No results.") : t("Ci sono già tutte le luci.", "All the lights are already here.")}</div>` : ""}`;
}
document.addEventListener("input", e => { if (e.target.id === "lu1q") { AG.q = e.target.value; render(); } });

Object.assign(ACT, {
  luVai: el => { const s = document.getElementById("lu-" + el.dataset.id); if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); },
  luStanza: el => { const a = el.dataset.id, on = el.dataset.v === "1";
    const L = a === "#g" ? luciPerStanza().gruppi : luciContate(a === "_" ? null : a).filter(id => a !== "_" || !areaOf(id) || !AREAS[areaOf(id)]);
    const da = L.filter(id => ok(id) && (S[id].state === "on") !== on); if (da.length) luciComando(da, on); },
  luAdd: el => { Object.assign(AG, { area: el.dataset.area || "", q: "" }); openSheet(foglioAggiungi); },
  luPick: el => { const id = el.dataset.id, sw = el.dataset.v === "sw";
    cambia(l => { if (sw) l.lightSwitches = [...new Set([...(l.lightSwitches || []), id])]; mostra(l, id, { area: AG.area }); }, "＋ " + nm(id)); },
  luMove: el => { const id = el.dataset.id, d = +el.dataset.v, { stanze, gruppi } = luciPerStanza();
    const R = [...(Object.values(stanze).find(L => L.includes(id)) || (gruppi.includes(id) ? gruppi : []))], i = R.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= R.length) return; [R[i], R[j]] = [R[j], R[i]];
    cambia(l => { l.lightOrder = [...R, ...(l.lightOrder || []).filter(x => !R.includes(x) && S[x])]; }); },
});
/* ✕ o «Togli» su un interruttore usato come luce: torna tra le prese, non sparisce dalla plancia */
const edDel0 = ACT.edDel;
ACT.edDel = el => {
  if (el.dataset.page !== "lu:sw") return edDel0(el);
  const id = el.dataset.id; if (UI.sheet) closeSheet();
  cambia(l => { l.lightSwitches = (l.lightSwitches || []).filter(x => x !== id); }, "🔌 " + nm(id) + t(" torna tra le prese", " is back in Plugs"));
};

page("luci", { title: t("Luci", "Lights"), short: t("Luci", "Lights"), icon: "💡", order: 10, editable: true, show: () => luci().length > 0 || isAdmin(), badge: () => lightsOn().length > 0, render: pagina });

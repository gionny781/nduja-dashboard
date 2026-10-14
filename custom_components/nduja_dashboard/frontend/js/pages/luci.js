/* Luci: tutte le luci divise per piano e stanza, con «spegni» per stanza e per tutta la casa. */
import { S, AREAS, FLOORS, UI, t, esc, ents, areaOf, areasSorted, lightsOn, lightTile, card, empty, page, isAdmin } from "../core.js";
import { item, addBtn } from "../edit.js";

function pagina() {
  const tutte = ents("light"), on = lightsOn();
  if (!tutte.length) return `<div class="g">${card("💡 " + t("Luci", "Lights"), empty(UI.edit ? "" : t("Nessuna luce: premi ✏️ Modifica in alto per aggiungerne.", "No lights: press ✏️ Edit at the top to add some.")) + addBtn(["light"], { big: true }))}</div>`;
  const zone = [...areasSorted().filter(a => tutte.some(id => areaOf(id) === a)), ...(tutte.some(id => !areaOf(id) || !AREAS[areaOf(id)]) ? ["_"] : [])];
  let piano = null;
  const blocchi = zone.map(a => {
    const L = tutte.filter(id => a === "_" ? !areaOf(id) || !AREAS[areaOf(id)] : areaOf(id) === a).sort((x, y) => (S[y].state === "on") - (S[x].state === "on"));
    const n = L.filter(id => S[id].state === "on").length, f = a === "_" ? "_" : AREAS[a].floor;
    const intest = f !== piano && Object.keys(FLOORS).length > 1 ? `<div class="fl1 span3">${esc(FLOORS[f]?.name || t("Altre", "Other"))}</div>` : ""; piano = f;
    return intest + card(`${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)} ${n ? `<span class="tag warn">${n}</span>` : ""}`,
      `<div class="tiles">${L.map(id => item(id, lightTile(id))).join("")}${addBtn(["light"], { area: a === "_" ? "" : a })}</div>`, { cls: L.length > 4 ? "span2" : "", right: (UI.edit && a !== "_" ? `<button class="btn sm" data-act="rmEdit" data-id="${a}">✏️ ${t("Stanza", "Room")}</button>` : "") + (n ? `<button class="btn sm" data-act="lightsOff" ${a === "_" ? "" : `data-area="${a}"`}>${t("Spegni", "Off")}</button>` : "") });
  });
  return `<div class="g g3">
    <section class="card span3 row between" style="flex-wrap:wrap"><div><b style="font-size:22px">${on.length}</b> <span class="muted">${t(`accese su ${tutte.length}`, `on of ${tutte.length}`)}</span></div>
      ${on.length ? `<button class="btn warm" data-act="lightsOff">💡 ${t("Spegni tutte", "Turn all off")}</button>` : ""}</section>
    ${blocchi.join("")}
    ${UI.edit ? `<section class="card span3">${addBtn(["light"], { big: true })}</section>` : ""}</div>`;
}
page("luci", { title: t("Luci", "Lights"), short: t("Luci", "Lights"), icon: "💡", order: 10, editable: true, show: () => ents("light").length > 0 || isAdmin(), badge: () => lightsOn().length > 0, render: pagina });

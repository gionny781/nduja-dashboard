/* Luci: tutte le luci divise per piano e stanza, con «spegni» per stanza e per tutta la casa. */
import { S, AREAS, FLOORS, t, esc, ents, areaOf, areasSorted, lightsOn, lightTile, card, empty, page } from "../core.js";

function pagina() {
  const tutte = ents("light"), on = lightsOn();
  if (!tutte.length) return `<div class="g">${card("💡 " + t("Luci", "Lights"), empty(t("Nessuna luce trovata.", "No lights found.")))}</div>`;
  const zone = [...areasSorted().filter(a => tutte.some(id => areaOf(id) === a)), ...(tutte.some(id => !areaOf(id) || !AREAS[areaOf(id)]) ? ["_"] : [])];
  let piano = null;
  const blocchi = zone.map(a => {
    const L = tutte.filter(id => a === "_" ? !areaOf(id) || !AREAS[areaOf(id)] : areaOf(id) === a).sort((x, y) => (S[y].state === "on") - (S[x].state === "on"));
    const n = L.filter(id => S[id].state === "on").length, f = a === "_" ? "_" : AREAS[a].floor;
    const intest = f !== piano && Object.keys(FLOORS).length > 1 ? `<div class="fl1 span3">${esc(FLOORS[f]?.name || t("Altre", "Other"))}</div>` : ""; piano = f;
    return intest + card(`${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)} ${n ? `<span class="tag warn">${n}</span>` : ""}`,
      `<div class="tiles">${L.map(id => lightTile(id)).join("")}</div>`, { cls: L.length > 4 ? "span2" : "", right: n ? `<button class="btn sm" data-act="lightsOff" ${a === "_" ? "" : `data-area="${a}"`}>${t("Spegni", "Off")}</button>` : "" });
  });
  return `<div class="g g3">
    <section class="card span3 row between" style="flex-wrap:wrap"><div><b style="font-size:22px">${on.length}</b> <span class="muted">${t(`accese su ${tutte.length}`, `on of ${tutte.length}`)}</span></div>
      ${on.length ? `<button class="btn warm" data-act="lightsOff">💡 ${t("Spegni tutte", "Turn all off")}</button>` : ""}</section>
    ${blocchi.join("")}</div>`;
}
page("luci", { title: t("Luci", "Lights"), short: t("Luci", "Lights"), icon: "💡", order: 10, show: () => ents("light").length > 0, badge: () => lightsOn().length > 0, render: pagina });

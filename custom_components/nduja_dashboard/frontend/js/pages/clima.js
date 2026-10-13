/* Clima: termostati e condizionatori per stanza, più temperatura e umidità di ogni stanza. */
import { S, AREAS, UI, t, esc, fnum, ok, ents, areaOf, areasSorted, roomTemp, roomHum, climateCard, entityRow, card, empty, page, isAdmin } from "../core.js";
import { item, addBtn } from "../edit.js";

function pagina() {
  const C = ents("climate"), F = [...ents("fan"), ...ents("humidifier")];
  const zone = [...new Set(C.map(id => areaOf(id) || "_"))].sort((a, b) => areasSorted().indexOf(a) - areasSorted().indexOf(b));
  const stanze = areasSorted().map(a => ({ a, T: roomTemp(a), H: roomHum(a) })).filter(r => r.T != null || r.H != null);
  const tmin = Math.min(...stanze.map(r => r.T ?? 99)), tmax = Math.max(...stanze.map(r => r.T ?? -99));
  return `<div class="g g3">
    ${zone.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a]?.name || a), `<div class="stack">${C.filter(id => (areaOf(id) || "_") === a).map(id => item(id, climateCard(id))).join("")}${addBtn(["climate"], { area: a === "_" ? "" : a })}</div>`)).join("")}
    ${!C.length ? card("🌡️ " + t("Clima", "Climate"), (UI.edit ? "" : empty(t("Nessun climatizzatore: premi ✏️ Modifica in alto per aggiungerne uno.", "No climate devices: press ✏️ Edit at the top to add one."))) + addBtn(["climate"], { big: true })) : UI.edit ? `<section class="card">${addBtn(["climate"], { big: true, label: t("Aggiungi climatizzatore", "Add climate device") })}</section>` : ""}
    ${stanze.length ? card("🌡️ " + t("Temperature in casa", "Indoor temperatures"), `<div class="stack">${stanze.map(r => {
      const w = r.T == null || tmax === tmin ? 0 : (r.T - tmin) / (tmax - tmin);
      return `<div class="row between tr1"><span>${esc(AREAS[r.a].name)}</span><span class="bar1"><i style="width:${(15 + w * 85).toFixed(0)}%;background:${w > .66 ? "var(--orange)" : w < .33 ? "var(--teal)" : "var(--green)"}"></i></span>
        <b>${r.T != null ? fnum(r.T) + "°" : "—"}</b><small class="muted">${r.H != null ? Math.round(r.H) + "%" : ""}</small></div>`; }).join("")}</div>`, { cls: zone.length % 3 === 2 ? "" : "span2" }) : ""}
    ${F.length ? card("🌀 " + t("Ventilatori e umidificatori", "Fans and humidifiers"), `<div class="stack">${F.map(id => item(id, entityRow(id))).join("")}</div>`) : ""}
  </div>`;
}
const attivi = () => ents("climate", id => ok(id) && S[id].state !== "off").length;
page("clima", { title: t("Clima", "Climate"), short: t("Clima", "Climate"), icon: "🌡️", order: 20, editable: true, show: () => isAdmin() || ents("climate").length > 0 || ents("sensor", id => S[id].attributes.device_class === "temperature").length > 0, badge: () => attivi() > 0, render: pagina });

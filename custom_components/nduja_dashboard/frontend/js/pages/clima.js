/* Clima: termostati e condizionatori per stanza (animati o con le tue immagini, vedi climadisegni.js), più temperatura e umidità di ogni stanza. */
import { S, AREAS, UI, VISTE, t, esc, fnum, ok, ents, areaOf, areasSorted, roomTemp, roomHum, climateCard, entityRow, card, empty, page, isAdmin } from "../core.js";
import { item, addBtn } from "../edit.js";

/* la caldaia ha la sua pagina (pages/caldaia.js): se non la trovo da sola, in ✏️ la si aggiunge da qui */
const caldaiaManca = () => isAdmin() && !!VISTE.caldaiaTrovata && !VISTE.caldaiaTrovata();
function pagina() {
  const C = ents("climate"), F = [...ents("fan"), ...ents("humidifier")];
  const zone = [...new Set(C.map(id => areaOf(id) || "_"))].sort((a, b) => areasSorted().indexOf(a) - areasSorted().indexOf(b));
  const stanze = areasSorted(UI.edit).map(a => ({ a, T: roomTemp(a), H: roomHum(a) })).filter(r => UI.edit || r.T != null || r.H != null);
  const TT = stanze.filter(r => r.T != null), tmin = Math.min(...TT.map(r => r.T)), tmax = Math.max(...TT.map(r => r.T));
  const adm = isAdmin();
  return `<div class="g g3">
    ${zone.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a]?.name || a), `<div class="stack">${C.filter(id => (areaOf(id) || "_") === a).map(id => item(id, climateCard(id))).join("")}${addBtn(["climate"], { area: a === "_" ? "" : a })}</div>`, { right: UI.edit && a !== "_" ? `<button class="btn sm" data-act="rmEdit" data-id="${a}">✏️ ${t("Stanza", "Room")}</button>` : "" })).join("")}
    ${!C.length ? card("🌡️ " + t("Clima", "Climate"), (UI.edit ? "" : empty(t("Nessun climatizzatore: premi ✏️ Modifica in alto per aggiungerne uno.", "No climate devices: press ✏️ Edit at the top to add one."))) + addBtn(["climate"], { big: true }) + (UI.edit && caldaiaManca() ? `<button class="btn" data-act="cdAggiungi" style="margin-top:10px">🔥 ${t("Non trovo la caldaia: aggiungila a mano", "I can't find the boiler: add it by hand")}</button>` : "")) : UI.edit ? `<section class="card">${addBtn(["climate"], { big: true, label: t("Aggiungi climatizzatore", "Add climate device") })}<p class="small muted" style="margin-top:10px;line-height:1.45">${t("✏️ su un climatizzatore: nome, stanza e 🎞️ aspetto (animazioni della plancia, le tue immagini o GIF, oppure l'icona).", "✏️ on a climate device: name, room and 🎞️ look (dashboard animations, your images or GIFs, or the icon).")}</p>${caldaiaManca() ? `<button class="btn" data-act="cdAggiungi" style="margin-top:10px">🔥 ${t("Non trovo la caldaia: aggiungila a mano", "I can't find the boiler: add it by hand")}</button>` : ""}</section>` : ""}
    ${stanze.length ? card("🌡️ " + t("Temperature in casa", "Indoor temperatures"), `<div class="stack">${stanze.map(r => {
      const w = r.T == null || tmax === tmin ? 0 : (r.T - tmin) / (tmax - tmin);
      return `<${adm ? `button data-act="rmEdit" data-id="${r.a}"` : "div"} class="row between tr1 ${adm ? "tap1" : ""}"><span>${esc(AREAS[r.a].name)}${UI.edit ? " ✏️" : ""}</span><span class="bar1"><i style="width:${(15 + w * 85).toFixed(0)}%;background:${w > .66 ? "var(--orange)" : w < .33 ? "var(--teal)" : "var(--green)"}"></i></span>
        <b>${r.T != null ? fnum(r.T) + "°" : "—"}</b><small class="muted">${r.H != null ? Math.round(r.H) + "%" : ""}</small></${adm ? "button" : "div"}>`; }).join("")}</div>${adm ? `<div class="small muted" style="margin-top:10px">${t("Tocca una stanza per cambiarle nome o scegliere i sensori di temperatura e umidità.", "Tap a room to rename it or choose its temperature and humidity sensors.")}</div>` : ""}`, { cls: zone.length % 3 === 2 ? "" : "span2" }) : ""}
    ${F.length ? card("🌀 " + t("Ventilatori e umidificatori", "Fans and humidifiers"), `<div class="stack">${F.map(id => item(id, entityRow(id))).join("")}</div>`) : ""}
  </div>`;
}
const attivi = () => ents("climate", id => ok(id) && S[id].state !== "off").length;
page("clima", { title: t("Clima", "Climate"), short: t("Clima", "Climate"), icon: "🌡️", order: 20, editable: true, show: () => isAdmin() || ents("climate").length > 0 || ents("sensor", id => S[id].attributes.device_class === "temperature").length > 0, badge: () => attivi() > 0, render: pagina });

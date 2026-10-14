/* Mappa della casa: le stanze di ogni piano disegnate su una griglia, con luci accese, finestre aperte,
   clima, movimento e temperatura. Si costruisce da sola dalle aree; con ✏️ Modifica sposti e ridimensioni
   le stanze (frecce e ＋/−) e puoi mettere sotto la piantina vera (un'immagine in /local/…). */
import { S, AREAS, FLOORS, ACT, CHG, LAYOUT, UI, t, esc, fnum, ok, isOn, inArea, areaOf, areasSorted, roomTemp, roomHum, lightsOn,
  deviceClass, svc, toast, card, empty, page, sGet, sSet, render, isAdmin, attr, openSheet } from "../core.js";
import { cambia } from "../edit.js";

const COL = 12;
const piani = () => {
  const A = areasSorted().filter(a => Object.keys(S).some(id => areaOf(id) === a));
  const F = [...new Set(A.map(a => AREAS[a].floor || "_"))].sort((x, y) => (FLOORS[x]?.level ?? 99) - (FLOORS[y]?.level ?? 99));
  return F.map(f => ({ f, nome: FLOORS[f]?.name || t("Casa", "Home"), stanze: A.filter(a => (AREAS[a].floor || "_") === f) }));
};
const GRANDE = /soggiorno|salotto|salone|living|cucina|kitchen|open.?space|taverna|garage|giardino|garden/i;
/** posizione di ogni stanza: quella salvata, altrimenti una disposizione automatica a righe */
function posizioni(f, stanze) {
  const M = LAYOUT.map?.[f]?.rooms || {}, out = {};
  let x = 0, y = 0, hRiga = 0;
  for (const a of stanze) {
    if (M[a]) { out[a] = M[a]; continue; }
    const w = GRANDE.test(AREAS[a].name) ? 4 : 3, h = GRANDE.test(AREAS[a].name) ? 3 : 2;
    if (x + w > COL) { x = 0; y += hRiga; hRiga = 0; }
    out[a] = { x, y, w, h }; x += w; hRiga = Math.max(hRiga, h);
  }
  /* le stanze salvate non devono finire sotto quelle automatiche: le automatiche partono sotto l'ultima salvata */
  const salvate = stanze.filter(a => M[a]), fondo = Math.max(0, ...salvate.map(a => M[a].y + M[a].h));
  if (salvate.length && salvate.length < stanze.length) stanze.filter(a => !M[a]).forEach(a => out[a] = { ...out[a], y: out[a].y + fondo });
  return out;
}

function stanza(a, p) {
  const T = roomTemp(a), H = roomHum(a), L = lightsOn(a).length, nL = inArea(a, "light").length;
  const O = inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && isOn(id)).length;
  const mov = inArea(a, "binary_sensor", id => ["motion", "occupancy", "presence"].includes(deviceClass(id)) && isOn(id)).length;
  const C = inArea(a, "climate").find(id => ok(id) && S[id].state !== "off"), freddo = C && ["cool", "dry"].includes(S[C].state);
  const pericolo = inArea(a, "binary_sensor", id => ["smoke", "gas", "moisture", "carbon_monoxide"].includes(deviceClass(id)) && isOn(id)).length;
  const ed = UI.edit ? `<div class="mpe1">
      <button data-act="mpMove" data-id="${a}" data-v="x,-1">←</button><button data-act="mpMove" data-id="${a}" data-v="y,-1">↑</button><button data-act="mpMove" data-id="${a}" data-v="y,1">↓</button><button data-act="mpMove" data-id="${a}" data-v="x,1">→</button>
      <button data-act="mpMove" data-id="${a}" data-v="w,-1">⇠</button><button data-act="mpMove" data-id="${a}" data-v="w,1">⇢</button><button data-act="mpMove" data-id="${a}" data-v="h,-1">⇡</button><button data-act="mpMove" data-id="${a}" data-v="h,1">⇣</button></div>` : "";
  return `<div class="mpr1 ${L ? "lit" : ""} ${O ? "open" : ""} ${mov ? "mov" : ""} ${pericolo ? "dang" : ""}" style="grid-column:${p.x + 1} / span ${p.w};grid-row:${p.y + 1} / span ${p.h}">
    <button class="mpb1" data-act="room" data-id="${a}"><b>${esc(AREAS[a].name)}</b>
      <span class="mpt1">${T != null ? fnum(T) + "°" : ""}${H != null ? `<small>${Math.round(H)}%</small>` : ""}</span></button>
    <div class="mpi1">${nL ? `<button class="${L ? "on" : ""}" data-act="mpLights" data-id="${a}" title="${t("Luci", "Lights")}">💡${L ? " " + L : ""}</button>` : ""}${O ? `<i class="al">🪟 ${O}</i>` : ""}${C ? `<i>${freddo ? "❄️" : "🔥"}</i>` : ""}${mov ? `<i>🏃</i>` : ""}${pericolo ? `<i class="al">🚨</i>` : ""}</div>${ed}</div>`;
}

function pagina() {
  const P = piani();
  if (!P.length) return `<div class="g">${card("🗺️ " + t("Mappa", "Map"), empty(t("Crea le aree in Home Assistant (Impostazioni → Aree) e assegna i dispositivi: la mappa si disegna da sola.", "Create areas in Home Assistant (Settings → Areas) and assign devices: the map draws itself.")))}</div>`;
  const cur = P.find(p => p.f === sGet("mapFloor")) || P[0], pos = posizioni(cur.f, cur.stanze);
  const righe = Math.max(4, ...Object.values(pos).map(p => p.y + p.h)), img = LAYOUT.map?.[cur.f]?.img;
  return `<div class="g"><section class="card mp1">
    <div class="ch"><div class="seg">${P.map(p => `<button class="${p.f === cur.f ? "act" : ""}" data-act="mpFloor" data-v="${p.f}">${esc(p.nome)}</button>`).join("")}</div>
      ${isAdmin() && UI.edit ? `<span class="row" style="gap:6px"><button class="btn sm" data-act="mpImg" data-v="${cur.f}">🖼️ ${t("Piantina", "Floor plan")}</button><button class="btn sm" data-act="mpReset" data-v="${cur.f}">↺ ${t("Disposizione automatica", "Auto layout")}</button></span>` : ""}</div>
    <div class="mpg1 ${UI.edit ? "edit" : ""}" style="grid-template-rows:repeat(${righe},minmax(54px,auto))${img ? `;background-image:url('${esc(img)}')` : ""}">${cur.stanze.map(a => stanza(a, pos[a])).join("")}</div>
    ${UI.edit ? `<p class="small muted" style="margin-top:10px">${t("← ↑ ↓ → sposta la stanza, ⇠ ⇢ la allarga o la stringe, ⇡ ⇣ cambia l'altezza. «Piantina» mette sotto un'immagine (per esempio /local/piantina.png caricata nella cartella www).", "← ↑ ↓ → move the room, ⇠ ⇢ change its width, ⇡ ⇣ its height. «Floor plan» puts an image underneath (for example /local/plan.png uploaded to the www folder).")}</p>`
      : `<p class="small muted" style="margin-top:10px">${t("Tocca una stanza per comandarla, 💡 per spegnere o accendere le sue luci.", "Tap a room to control it, 💡 to switch its lights.")}</p>`}
  </section></div>`;
}

Object.assign(ACT, {
  mpFloor: el => { sSet("mapFloor", el.dataset.v); render(true); },
  mpLights: el => { const a = el.dataset.id, on = lightsOn(a), all = inArea(a, "light");
    svc("light", on.length ? "turn_off" : "turn_on", {}, { entity_id: on.length ? on : all }); },
  mpMove: el => {
    const a = el.dataset.id, [k, d] = el.dataset.v.split(","), f = AREAS[a].floor || "_";
    const P = piani().find(p => p.f === f), pos = posizioni(f, P.stanze);
    cambia(l => {
      l.map = { ...(l.map || {}) }; l.map[f] = { ...(l.map[f] || {}), rooms: { ...pos, ...(l.map[f]?.rooms || {}) } };
      const r = { ...l.map[f].rooms[a] };
      r[k] = Math.max(k === "w" || k === "h" ? 1 : 0, r[k] + +d);
      if (r.x + r.w > COL) { if (k === "x") r.x = COL - r.w; else r.w = COL - r.x; }
      l.map[f].rooms[a] = r;
    });
  },
  mpReset: el => { const f = el.dataset.v; cambia(l => { if (l.map?.[f]) { l.map = { ...l.map }; l.map[f] = { ...l.map[f] }; delete l.map[f].rooms; } }); },
  mpImg: el => { const f = el.dataset.v, cur = LAYOUT.map?.[f]?.img || "";
    openSheet(() => `<div class="sh-head"><div><h3>🖼️ ${t("Piantina sotto la mappa", "Floor plan under the map")}</h3><div class="small muted">${t("Indirizzo di un'immagine: caricala in config/www e scrivi /local/nome.png. Lascia vuoto per toglierla.", "Image address: upload it to config/www and write /local/name.png. Leave empty to remove it.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
      <label class="fld1"><span>URL</span><input id="mp1i" type="text" value="${esc(cur)}" placeholder="/local/piantina.png" data-chg="mpImgSet" data-v="${f}"></label>
      <div class="small muted" style="margin-top:8px">${t("Si salva appena esci dal campo.", "Saved when you leave the field.")}</div>`); },
});
CHG.mpImgSet = el => { const f = el.dataset.v, v = el.value.trim(); cambia(l => { l.map = { ...(l.map || {}) }; l.map[f] = { ...(l.map[f] || {}) }; if (v) l.map[f].img = v; else delete l.map[f].img; }, "🖼️ " + t("Salvato", "Saved")); };

page("mappa", { title: t("Mappa", "Map"), short: t("Mappa", "Map"), icon: "🗺️", order: 5, editable: true, show: () => Object.keys(AREAS).length > 0, render: pagina });

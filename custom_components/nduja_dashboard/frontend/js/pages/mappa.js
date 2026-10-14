/* Mappa della casa: le stanze di ogni piano disegnate su una griglia, con luci accese, finestre aperte,
   clima, movimento e temperatura. Si costruisce da sola dalle aree; con ✏️ Modifica sposti e ridimensioni
   le stanze (frecce e ＋/−) e puoi mettere sotto la piantina vera (un'immagine in /local/…). */
import { S, AREAS, FLOORS, ACT, CHG, LAYOUT, UI, t, esc, fnum, ok, isOn, inArea, areaOf, areasSorted, roomTemp, roomHum, lightsOn,
  deviceClass, svc, toast, card, empty, page, sGet, sSet, render, isAdmin, attr, openSheet, closeSheet, nm, moreInfo } from "../core.js";
import { cambia, scegli } from "../edit.js";

const COL = 12;
/* stanze della mappa: le aree di Home Assistant (anche vuote) più le stanze create solo nella mappa */
const mp = f => LAYOUT.map?.[f] || {};
const custom = f => mp(f).custom || [];
const nascostaMappa = (f, a) => (mp(f).hide || []).includes(a);
export const nomeStanza = (a, f) => AREAS[a]?.name || custom(f).find(c => c.id === a)?.name || a;
const piani = () => {
  const A = areasSorted();
  const F = [...new Set([...Object.keys(FLOORS), ...A.map(a => AREAS[a].floor || "_"), ...Object.keys(LAYOUT.map || {}).filter(f => custom(f).length)])]
    .filter(f => f === "_" ? A.some(a => !AREAS[a].floor) || custom("_").length : true)
    .sort((x, y) => (FLOORS[x]?.level ?? 99) - (FLOORS[y]?.level ?? 99));
  if (!F.length) F.push("_");
  return F.map(f => {
    const tutte = [...A.filter(a => (AREAS[a].floor || "_") === f), ...custom(f).map(c => c.id)];
    return { f, nome: FLOORS[f]?.name || t("Casa", "Home"), tutte, stanze: tutte.filter(a => !nascostaMappa(f, a)), nascoste: tutte.filter(a => nascostaMappa(f, a)) };
  });
};
const GRANDE = /soggiorno|salotto|salone|living|cucina|kitchen|open.?space|taverna|garage|giardino|garden/i;
/** posizione di ogni stanza: quella salvata, altrimenti una disposizione automatica a righe */
function posizioni(f, stanze) {
  const M = LAYOUT.map?.[f]?.rooms || {}, out = {};
  let x = 0, y = 0, hRiga = 0;
  for (const a of stanze) {
    if (M[a]) { out[a] = M[a]; continue; }
    const n = nomeStanza(a, f), w = GRANDE.test(n) ? 4 : 3, h = GRANDE.test(n) ? 3 : 2;
    if (x + w > COL) { x = 0; y += hRiga; hRiga = 0; }
    out[a] = { x, y, w, h }; x += w; hRiga = Math.max(hRiga, h);
  }
  /* le stanze salvate non devono finire sotto quelle automatiche: le automatiche partono sotto l'ultima salvata */
  const salvate = stanze.filter(a => M[a]), fondo = Math.max(0, ...salvate.flatMap(a => [M[a], ...(M[a].extra || [])].map(r => r.y + r.h)));
  if (salvate.length && salvate.length < stanze.length) stanze.filter(a => !M[a]).forEach(a => out[a] = { ...out[a], y: out[a].y + fondo });
  return out;
}

/** pezzi di una stanza: il rettangolo principale più quelli aggiunti (per le stanze a L, a T…) */
const pezzi = p => [{ x: p.x, y: p.y, w: p.w, h: p.h }, ...(p.extra || [])];
/** muri: il contorno dell'unione delle celle di ogni stanza (così una L ha un solo contorno) */
function muri(pos, stanze) {
  const seg = [];
  for (const a of stanze) {
    const C = new Set();
    pezzi(pos[a]).forEach(r => { for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) C.add(x + "," + y); });
    for (const c of C) { const [x, y] = c.split(",").map(Number);
      if (!C.has(x + "," + (y - 1))) seg.push(`M${x} ${y}H${x + 1}`);
      if (!C.has(x + "," + (y + 1))) seg.push(`M${x} ${y + 1}H${x + 1}`);
      if (!C.has((x - 1) + "," + y)) seg.push(`M${x} ${y}V${y + 1}`);
      if (!C.has((x + 1) + "," + y)) seg.push(`M${x + 1} ${y}V${y + 1}`); }
  }
  return seg.join("");
}
const comandi = (a, i, f) => `<div class="mpe1" data-f="${f}">
  <button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="x,-1">←</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="y,-1">↑</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="y,1">↓</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="x,1">→</button>
  <button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="w,-1">⇠</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="w,1">⇢</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="h,-1">⇡</button><button data-act="mpMove" data-id="${a}" data-i="${i}" data-v="h,1">⇣</button>
  ${i === 0 ? `<button class="wide" data-act="mpPiece" data-id="${a}">＋ ${t("pezzo (L)", "piece (L)")}</button>
    ${AREAS[a] ? `<button class="wide" data-act="mpHide" data-id="${a}">🙈 ${t("togli dalla mappa", "remove from map")}</button>` : `<button class="wide" data-act="mpCustom" data-id="${a}">✏️ ${t("nome", "name")}</button><button class="wide bad" data-act="mpCustomDel" data-id="${a}">🗑 ${t("elimina stanza", "delete room")}</button>`}`
    : `<button class="wide bad" data-act="mpPieceDel" data-id="${a}" data-i="${i}">✕ ${t("pezzo", "piece")}</button>`}</div>`;

/* ---------- dispositivi nelle stanze: automatici dall'area, più quelli aggiunti, meno quelli tolti ---------- */
const DOM_MAPPA = ["light", "switch", "cover", "fan", "media_player", "lock", "climate", "vacuum", "humidifier", "camera"];
const ICO_D = (id) => { const d = id.split(".")[0], on = isOn(id) || ["open", "playing", "cleaning", "unlocked", "heat", "cool"].includes(S[id]?.state);
  return { light: "💡", switch: "🔌", cover: on ? "🪟" : "🟫", fan: "🌀", media_player: "📺", lock: on ? "🔓" : "🔒", climate: "❄️", vacuum: "🤖", humidifier: "💧", camera: "📷",
    sensor: "📈", binary_sensor: on ? "🔴" : "⚪", scene: "🎬", script: "▶️", input_boolean: "🔘" }[d] || "•"; };
const devsConf = (f, a) => mp(f).devs?.[a] || {};
export function dispositivi(a, f) {
  const c = devsConf(f, a), manuale = mp(f).devMode === "manual";
  const auto = manuale || !AREAS[a] ? [] : DOM_MAPPA.flatMap(d => inArea(a, d));
  return [...new Set([...auto.filter(id => !(c.hide || []).includes(id)), ...(c.add || []).filter(id => S[id])])];
}
const chipD = (id, a, f) => `<span class="mpd2 ${isOn(id) || ["open", "playing", "cleaning", "unlocked"].includes(S[id]?.state) ? "on" : ""}">
  <button data-act="mpDev" data-id="${id}" title="${esc(nm(id))}">${ICO_D(id)}</button>${UI.edit ? `<button class="dx" data-act="mpDevDel" data-id="${id}" data-a="${a}" data-f="${f}">✕</button>` : ""}</span>`;
const rigaDev = (a, f) => { const D = dispositivi(a, f);
  return D.length || UI.edit ? `<div class="mpd1">${D.map(id => chipD(id, a, f)).join("")}${UI.edit ? `<button class="mpd2 add" data-act="mpDevAdd" data-a="${a}" data-f="${f}">＋</button>` : ""}</div>` : ""; };

function stanza(a, p, f) {
  if (!AREAS[a]) return pezzi(p).map((r, i) => `<div class="mpr1 cust ${i ? "pz" : ""}" style="grid-column:${r.x + 1} / span ${r.w};grid-row:${r.y + 1} / span ${r.h}">${i === 0 ? `<button class="mpb1" ${isAdmin() ? `data-act="mpCustom" data-id="${a}" data-f="${f}"` : ""}><b>${esc(nomeStanza(a, f))}</b></button>${rigaDev(a, f)}` : `<span class="mpb1"></span>`}${UI.edit ? comandi(a, i, f) : ""}</div>`).join("");
  const T = roomTemp(a), H = roomHum(a), L = lightsOn(a).length, nL = inArea(a, "light").length;
  const O = inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && isOn(id)).length;
  const mov = inArea(a, "binary_sensor", id => ["motion", "occupancy", "presence"].includes(deviceClass(id)) && isOn(id)).length;
  const C = inArea(a, "climate").find(id => ok(id) && S[id].state !== "off"), freddo = C && ["cool", "dry"].includes(S[C].state);
  const pericolo = inArea(a, "binary_sensor", id => ["smoke", "gas", "moisture", "carbon_monoxide"].includes(deviceClass(id)) && isOn(id)).length;
  const cls = `mpr1 ${L ? "lit" : ""} ${O ? "open" : ""} ${mov ? "mov" : ""} ${pericolo ? "dang" : ""}`;
  return pezzi(p).map((r, i) => `<div class="${cls} ${i ? "pz" : ""}" style="grid-column:${r.x + 1} / span ${r.w};grid-row:${r.y + 1} / span ${r.h}">
    ${i === 0 ? `<button class="mpb1" data-act="room" data-id="${a}"><b>${esc(nomeStanza(a, f))}</b>
      <span class="mpt1">${T != null ? fnum(T) + "°" : ""}${H != null ? `<small>${Math.round(H)}%</small>` : ""}</span></button>${rigaDev(a, f)}
    <div class="mpi1">${nL ? `<button class="${L ? "on" : ""}" data-act="mpLights" data-id="${a}" title="${t("Luci", "Lights")}">💡${L ? " " + L : ""}</button>` : ""}${O ? `<i class="al">🪟 ${O}</i>` : ""}${C ? `<i>${freddo ? "❄️" : "🔥"}</i>` : ""}${mov ? `<i>🏃</i>` : ""}${pericolo ? `<i class="al">🚨</i>` : ""}</div>`
      : `<button class="mpb1" data-act="room" data-id="${a}" aria-label="${esc(nomeStanza(a, f))}"></button>`}
    ${UI.edit ? comandi(a, i, f) : ""}</div>`).join("");
}

function pagina() {
  const P = piani();
  if (!P.length) return `<div class="g">${card("🗺️ " + t("Mappa", "Map"), empty(t("Crea le aree in Home Assistant (Impostazioni → Aree) e assegna i dispositivi: la mappa si disegna da sola.", "Create areas in Home Assistant (Settings → Areas) and assign devices: the map draws itself.")))}</div>`;
  const cur = P.find(p => p.f === sGet("mapFloor")) || P[0], pos = posizioni(cur.f, cur.stanze);
  const righe = Math.max(4, ...Object.values(pos).flatMap(p => pezzi(p).map(r => r.y + r.h))), img = LAYOUT.map?.[cur.f]?.img;
  return `<div class="g"><section class="card mp1">
    <div class="ch"><div class="seg">${P.map(p => `<button class="${p.f === cur.f ? "act" : ""}" data-act="mpFloor" data-v="${p.f}">${esc(p.nome)}</button>`).join("")}</div>
      ${isAdmin() && UI.edit ? `<span class="row" style="gap:6px"><div class="seg">${[["auto", "✨ " + t("Dispositivi automatici", "Auto devices")], ["manual", "✋ " + t("Solo scelti", "Chosen only")]].map(([k, n]) => `<button class="${(mp(cur.f).devMode || "auto") === k ? "act" : ""}" data-act="mpDevMode" data-v="${k}" data-f="${cur.f}">${n}</button>`).join("")}</div><button class="btn sm pri" data-act="mpNew" data-v="${cur.f}">＋ ${t("Stanza", "Room")}</button><button class="btn sm" data-act="mpImg" data-v="${cur.f}">🖼️ ${t("Piantina", "Floor plan")}</button><button class="btn sm" data-act="mpReset" data-v="${cur.f}">↺ ${t("Disposizione automatica", "Auto layout")}</button></span>` : ""}</div>
    <div class="mpw1"><div class="mpg1 ${UI.edit ? "edit" : ""}" style="grid-template-rows:repeat(${righe},64px)${img ? `;background-image:url('${esc(img)}')` : ""}">${cur.stanze.map(a => stanza(a, pos[a], cur.f)).join("")}</div>
      <svg class="mpm1" viewBox="0 0 ${COL} ${righe}" preserveAspectRatio="none" aria-hidden="true"><path d="${muri(pos, cur.stanze)}"/></svg></div>
    ${UI.edit && cur.nascoste.length ? `<div class="fl1">${t("Tolte dalla mappa", "Removed from the map")}</div><div class="vr1">${cur.nascoste.map(a => `<button data-act="mpShow" data-id="${a}" data-f="${cur.f}">👁 ${esc(nomeStanza(a, cur.f))}</button>`).join("")}</div>` : ""}
    ${UI.edit ? `<p class="small muted" style="margin-top:10px">${t("«＋ Stanza» aggiunge una stanza solo nella mappa (anche se non esiste in Home Assistant: ripostiglio, scale, terrazzo…). ← ↑ ↓ → sposta, ⇠ ⇢ larghezza, ⇡ ⇣ altezza. «＋ pezzo (L)» aggiunge un altro rettangolo alla stanza: mettilo accanto per fare una stanza a L, a T o di qualsiasi forma; i muri si uniscono da soli. «Piantina» mette sotto un'immagine (/local/piantina.png).", "← ↑ ↓ → move, ⇠ ⇢ width, ⇡ ⇣ height. «＋ piece (L)» adds another rectangle to the room: put it alongside to make an L, T or any shape; walls join automatically. «Floor plan» puts an image underneath (/local/plan.png).")}</p>`
      : `<p class="small muted" style="margin-top:10px">${t("Tocca una stanza per comandarla, 💡 per spegnere o accendere le sue luci.", "Tap a room to control it, 💡 to switch its lights.")}</p>`}
  </section></div>`;
}

/** copia modificabile delle posizioni del piano della stanza a */
function modifica(a, fn, f = AREAS[a]?.floor || "_") {
  const P = piani().find(p => p.f === f), pos = posizioni(f, P.stanze);
  return cambia(l => {
    l.map = { ...(l.map || {}) }; l.map[f] = { ...(l.map[f] || {}) };
    l.map[f].rooms = JSON.parse(JSON.stringify({ ...pos, ...(l.map[f].rooms || {}) }));
    fn(l.map[f].rooms[a]);
  });
}
Object.assign(ACT, {
  mpFloor: el => { sSet("mapFloor", el.dataset.v); render(true); },
  mpLights: el => { const a = el.dataset.id, on = lightsOn(a), all = inArea(a, "light");
    svc("light", on.length ? "turn_off" : "turn_on", {}, { entity_id: on.length ? on : all }); },
  mpMove: el => {
    const a = el.dataset.id, i = +el.dataset.i || 0, [k, d] = el.dataset.v.split(",");
    modifica(a, room => {
      const r = i ? room.extra[i - 1] : room;
      r[k] = Math.max(k === "w" || k === "h" ? 1 : 0, r[k] + +d);
      if (r.x + r.w > COL) { if (k === "x") r.x = COL - r.w; else r.w = COL - r.x; }
    }, fl(el));
  },
  mpPiece: el => modifica(el.dataset.id, r => { r.extra = [...(r.extra || []), { x: r.x, y: r.y + r.h, w: Math.max(1, Math.ceil(r.w / 2)), h: 1 }]; }, fl(el)),
  mpPieceDel: el => { const i = +el.dataset.i; modifica(el.dataset.id, r => { r.extra = (r.extra || []).filter((_, j) => j !== i - 1); if (!r.extra.length) delete r.extra; }, fl(el)); },
  mpHide: el => { const a = el.dataset.id, f = fl(el); mapSet(f, m => { m.hide = [...new Set([...(m.hide || []), a])]; }); },
  mpShow: el => { const a = el.dataset.id, f = fl(el); mapSet(f, m => { m.hide = (m.hide || []).filter(x => x !== a); }); },
  mpNew: el => nomeSheet(el.dataset.v, null),
  mpDev: el => { const id = el.dataset.id, d = id.split(".")[0];
    if (UI.edit) return; if (["light", "switch", "fan", "input_boolean", "humidifier"].includes(d)) svc(d, "toggle", {}, { entity_id: id });
    else if (d === "cover") svc("cover", "toggle", {}, { entity_id: id }); else if (["scene", "script"].includes(d)) svc(d, "turn_on", {}, { entity_id: id });
    else moreInfo(id); },
  mpDevDel: el => { const id = el.dataset.id, a = el.dataset.a, f = fl(el);
    mapSet(f, m => { m.devs = m.devs || {}; const c = m.devs[a] = m.devs[a] || {}; c.add = (c.add || []).filter(x => x !== id); c.hide = [...new Set([...(c.hide || []), id])]; }); },
  mpDevAdd: el => { const a = el.dataset.a, f = fl(el);
    scegli({ titolo: "＋ " + esc(nomeStanza(a, f)), sotto: t("Qualsiasi dispositivo della casa: compare come icona nella stanza.", "Any device in the house: it shows as an icon in the room."), area: AREAS[a] ? a : null, auto: false, attuale: null,
      filtro: id => /^(light|switch|cover|fan|media_player|lock|climate|vacuum|humidifier|camera|sensor|binary_sensor|scene|script|input_boolean)\./.test(id) && !dispositivi(a, f).includes(id),
      onPick: id => id && mapSet(f, m => { m.devs = m.devs || {}; const c = m.devs[a] = m.devs[a] || {}; c.hide = (c.hide || []).filter(x => x !== id); c.add = [...new Set([...(c.add || []), id])]; }, "＋ " + nm(id)) }); },
  mpDevMode: el => { const f = fl(el), v = el.dataset.v; mapSet(f, m => { if (v === "auto") delete m.devMode; else m.devMode = v; }); },
  mpCustom: el => nomeSheet(fl(el), el.dataset.id),
  mpCustomDel: el => { const a = el.dataset.id, f = fl(el); mapSet(f, m => { m.custom = (m.custom || []).filter(c => c.id !== a); if (m.rooms) delete m.rooms[a]; }); },
  mpNameSave: el => { const f = el.dataset.f, id = el.dataset.id, n = (document.getElementById("mp1n")?.value || "").trim(); if (!n) return toast(t("Scrivi un nome", "Write a name"), true);
    closeSheet(); mapSet(f, m => { m.custom = m.custom || []; const c = m.custom.find(x => x.id === id); if (c) c.name = n; else m.custom.push({ id: "m_" + Date.now().toString(36), name: n }); }, "🗺️ " + n); },
  mpReset: el => { const f = el.dataset.v; cambia(l => { if (l.map?.[f]) { l.map = { ...l.map }; l.map[f] = { ...l.map[f] }; delete l.map[f].rooms; } }); },
  mpImg: el => { const f = el.dataset.v, cur = LAYOUT.map?.[f]?.img || "";
    openSheet(() => `<div class="sh-head"><div><h3>🖼️ ${t("Piantina sotto la mappa", "Floor plan under the map")}</h3><div class="small muted">${t("Indirizzo di un'immagine: caricala in config/www e scrivi /local/nome.png. Lascia vuoto per toglierla.", "Image address: upload it to config/www and write /local/name.png. Leave empty to remove it.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
      <label class="fld1"><span>URL</span><input id="mp1i" type="text" value="${esc(cur)}" placeholder="/local/piantina.png" data-chg="mpImgSet" data-v="${f}"></label>
      <div class="small muted" style="margin-top:8px">${t("Si salva appena esci dal campo.", "Saved when you leave the field.")}</div>`); },
});
/** piano di un pulsante: data-f sul pulsante o sul gruppo dei comandi */
function fl(el) { return el.dataset.f || el.closest("[data-f]")?.dataset.f || sGet("mapFloor") || "_"; }
function mapSet(f, fn, msg) { return cambia(l => { l.map = { ...(l.map || {}) }; l.map[f] = JSON.parse(JSON.stringify(l.map[f] || {})); fn(l.map[f]); }, msg); }
function nomeSheet(f, id) {
  const c = id ? custom(f).find(x => x.id === id) : null;
  openSheet(() => `<div class="sh-head"><div><h3>🗺️ ${c ? t("Stanza della mappa", "Map room") : t("Nuova stanza", "New room")}</h3><div class="small muted">${t("Esiste solo nella mappa: utile per ripostigli, scale, terrazzi, stanze che non hai creato in Home Assistant.", "It exists only in the map: handy for closets, stairs, terraces, rooms you didn't create in Home Assistant.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="mp1n" type="text" value="${esc(c?.name || "")}" placeholder="${t("Ripostiglio, Scale, Terrazzo…", "Closet, Stairs, Terrace…")}"></label>
    <button class="btn pri" data-act="mpNameSave" data-f="${f}" data-id="${id || ""}" style="margin-top:12px">💾 ${t("Salva", "Save")}</button>`);
}
CHG.mpImgSet = el => { const f = el.dataset.v, v = el.value.trim(); cambia(l => { l.map = { ...(l.map || {}) }; l.map[f] = { ...(l.map[f] || {}) }; if (v) l.map[f].img = v; else delete l.map[f].img; }, "🖼️ " + t("Salvato", "Saved")); };

page("mappa", { title: t("Mappa", "Map"), short: t("Mappa", "Map"), icon: "🗺️", order: 5, editable: true, show: () => Object.keys(AREAS).length > 0 || isAdmin(), render: pagina });

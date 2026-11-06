/* Robot aspirapolvere: stato, batteria, mappa, comandi, pulizia per stanza, impostazioni rapide e manutenzione.
   Tutto viene dal dispositivo del robot; con ✏️ (amministratori) si scelgono, per ogni robot, in LAYOUT.vacuums[id]:
   { map: camera | "none", quick: [select], passate: 2|3 (pulizia per stanza), ricambi: % (rosso sotto), noManut: [sensori da non mostrare] } */
import { S, REG, ACT, CHG, LAYOUT, render, openSheet, UI, t, esc, nm, ok, val, attr, ents, card, empty, page, svc, ws, cached, toast, isAdmin, shortName, deviceClass, DEFAULT_OFF } from "../core.js";
import { item, addBtn, scegli, cambia } from "../edit.js";

const conf = id => LAYOUT.vacuums?.[id] || {};
/** salva una scelta del robot: chi lascia tutto come prima non ha niente in LAYOUT */
const salvaV = (id, fn, msg) => cambia(l => { l.vacuums = { ...(l.vacuums || {}) }; const c = { ...(l.vacuums[id] || {}) }; fn(c);
  for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
  if (Object.keys(c).length) l.vacuums[id] = c; else delete l.vacuums[id]; if (!Object.keys(l.vacuums).length) delete l.vacuums; }, msg);
/** ricambi: rosso sotto questa percentuale, arancione fino a 20 punti sopra (prima fissi 15% e 35%) */
const RIC_DEF = 15;
const sottoRic = id => { const v = +conf(id).ricambi; return v >= 1 && v <= 80 ? Math.round(v) : RIC_DEF; };
/** passate per la pulizia delle stanze (1 come prima, 2 o 3 se scelte in ✏️) */
const passate = id => [2, 3].includes(+conf(id).passate) ? +conf(id).passate : 1;
const delDispositivo = (id, pred) => { const d = REG[id]?.device; return d ? Object.keys(S).filter(x => x !== id && REG[x]?.device === d && pred(x)) : []; };
const MAPPA = x => x.startsWith("camera.") && /map/i.test(x) && !/data|wifi/i.test(x);
/* le mappe dei robot non sono telecamere: fuori dalla pagina Telecamere finché non le aggiungi */
DEFAULT_OFF.push(id => id.startsWith("camera.") && /(^|_)map(_\d+)?$|map_data|wifi_map/.test(id));

function mappa(id) {
  const c = conf(id).map;
  if (c === "none") return null;
  if (c && S[c]) return c;
  const L = delDispositivo(id, MAPPA);
  return L.find(x => /_map$/.test(x)) || L[0] || null;
}
const batteria = id => attr(id, "battery_level") ?? attr(id, "battery") ?? (() => { const b = delDispositivo(id, x => x.startsWith("sensor.") && deviceClass(x) === "battery")[0]; return b ? val(b) : null; })();
const STATO = () => ({ cleaning: t("Sta pulendo", "Cleaning"), docked: t("Alla base", "Docked"), returning: t("Torna alla base", "Returning"), paused: t("In pausa", "Paused"), idle: t("Fermo", "Idle"), error: t("Errore", "Error") });
const servizi = () => cached("services", 3600e3, () => ws({ type: "get_services" })) || {};

/* stanze del robot (Dreame e simili espongono attributes.rooms per mappa) */
function stanze(id) {
  const r = attr(id, "rooms"); if (!r || typeof r !== "object") return [];
  const m = attr(id, "selected_map"), L = Array.isArray(r) ? r : (r[m] || Object.values(r)[0] || []);
  return L.filter(x => x && x.id != null).map(x => ({ id: x.id, nome: x.name || "#" + x.id }));
}
const sel = {};   // stanze scelte per robot (solo su questo dispositivo, finché non parte)
/** le passate si possono chiedere solo a Dreame (repeats) e Roborock (repeat); gli altri robot puliscono una volta */
const passateOk = () => { const sv = servizi(); return !!(sv.dreame_vacuum?.vacuum_clean_segment || sv.roborock); };
function pulisciStanze(id, ids) {
  const sv = servizi(), n = passate(id);
  if (sv.dreame_vacuum?.vacuum_clean_segment) return svc("dreame_vacuum", "vacuum_clean_segment", { segments: ids, ...(n > 1 ? { repeats: n } : {}) }, { entity_id: id });
  if (sv.roborock) return svc("vacuum", "send_command", { command: "app_segment_clean", params: [{ segments: ids, repeat: n }] }, { entity_id: id });
  return svc("vacuum", "send_command", { command: "app_segment_clean", params: ids }, { entity_id: id });
}

/* impostazioni rapide: select del robot (potenza, modalità, umidità del mop…) */
const RAPIDE = /suction|fan_speed|cleaning_mode|mop_pad_humidity|water_volume|mop_mode|potenza|modalit/i;
function rapide(id) {
  const c = conf(id).quick;
  const L = delDispositivo(id, x => x.startsWith("select.") && ok(x) && !/room_\d/.test(x));
  return c ? c.filter(x => S[x]) : L.filter(x => RAPIDE.test(x)).slice(0, 4);
}
/* manutenzione: sensori «…_left» in % del robot, con il pulsante di azzeramento se c'è; quelli tolti in ✏️ non compaiono (tutti = anche quelli) */
const nomeRic = (id, x) => shortName(x).replace(new RegExp("^" + nm(id) + "\\s*", "i"), "").replace(/\s*(left|rimanente)$/i, "");
function manutenzione(id, tutti = false) {
  const no = new Set(tutti ? [] : conf(id).noManut || []);
  return delDispositivo(id, x => x.startsWith("sensor.") && /_left$/.test(x) && attr(x, "unit_of_measurement") === "%" && ok(x) && !no.has(x)).map(x => {
    const k = x.replace(/^sensor\./, "").replace(/_left$/, ""), base = k.split("_")[0], cosa = k.slice(base.length + 1);
    const reset = Object.keys(S).find(b => b === `button.${base}_reset_${cosa}` || (b.startsWith("button.") && REG[b]?.device === REG[id]?.device && b.endsWith("reset_" + cosa)));
    return { id: x, v: val(x), reset };
  });
}

function robot(id) {
  const s = S[id], st = s.state, b = batteria(id), m = mappa(id), R = stanze(id), Q = rapide(id), M = manutenzione(id);
  const err = attr(id, "error"), errOk = !err || /no.?error|none|^0$/i.test(String(err));
  const scelte = sel[id] || [];
  const btn = (act, ic, n, on = true) => on ? `<button class="btn ${act === "start" ? "pri" : ""}" data-act="vac" data-v="${act}" data-id="${id}">${ic} ${n}</button>` : "";
  const area = attr(id, "cleaned_area"), tempo = attr(id, "cleaning_time"), prog = attr(id, "cleaning_progress");
  return `<section class="card span3 vac1">
    <div class="ch"><h2>🤖 ${esc(nm(id))}</h2>${isAdmin() ? `<button class="btn sm" data-act="vacEdit" data-id="${id}">✏️</button>` : ""}</div>
    <div class="vg1">
      <div>
        <div class="vs1"><b>${esc(STATO()[st] || attr(id, "status") || st)}</b>${attr(id, "status") && STATO()[st] ? `<span class="muted small">${esc(String(attr(id, "status")).replace(/_/g, " "))}</span>` : ""}</div>
        <div class="row" style="gap:14px;margin:10px 0 14px;flex-wrap:wrap">
          ${b != null ? `<span class="vb1">🔋 <b>${Math.round(b)}%</b>${attr(id, "charging") ? " ⚡" : ""}</span>` : ""}
          ${area != null ? `<span class="vb1">📐 <b>${area}</b> m²</span>` : ""}${tempo != null ? `<span class="vb1">⏱ <b>${tempo}</b> min</span>` : ""}
          ${st === "cleaning" && prog ? `<span class="vb1">📈 <b>${prog}%</b></span>` : ""}
        </div>
        ${!errOk ? `<div class="note1">⚠️ ${esc(String(err))}</div>` : ""}
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${btn("start", "▶", st === "paused" ? t("Riprendi", "Resume") : t("Pulisci tutto", "Clean all"), st !== "cleaning")}
          ${btn("pause", "⏸", t("Pausa", "Pause"), st === "cleaning")}
          ${btn("stop", "⏹", t("Ferma", "Stop"), ["cleaning", "paused", "returning"].includes(st))}
          ${btn("return_to_base", "🏠", t("Alla base", "Dock"), st !== "docked")}
          ${btn("locate", "📍", t("Trova", "Locate"))}
        </div>
        ${R.length ? `<div class="fl1">${t("Pulisci solo alcune stanze", "Clean some rooms only")}</div>
          <div class="vr1">${R.map(r => `<button class="${scelte.includes(r.id) ? "on" : ""}" data-act="vacRoom" data-id="${id}" data-v="${r.id}">${esc(r.nome)}</button>`).join("")}</div>
          ${scelte.length ? `<button class="btn pri" data-act="vacRooms" data-id="${id}" style="margin-top:10px">▶ ${t(`Pulisci ${scelte.length} stanz${scelte.length === 1 ? "a" : "e"}`, `Clean ${scelte.length} room${scelte.length === 1 ? "" : "s"}`)}${passate(id) > 1 && passateOk() ? " · " + t(`${passate(id)} passate`, `${passate(id)} passes`) : ""}</button>` : ""}` : ""}
        ${Q.length ? `<div class="fl1">${t("Impostazioni rapide", "Quick settings")}</div>${Q.map(q => `<label class="fld1"><span>${esc(shortName(q).replace(new RegExp("^" + nm(id) + "\\s*", "i"), ""))}</span>
          <select data-chg="vacSel" data-id="${q}">${(attr(q, "options") || []).map(o => `<option value="${esc(o)}" ${S[q].state === o ? "selected" : ""}>${esc(String(o).replace(/_/g, " "))}</option>`).join("")}</select></label>`).join("")}` : ""}
      </div>
      <div>
        ${m ? `<img class="vm1" src="${esc(attr(m, "entity_picture") || "")}" alt="${t("Mappa", "Map")}" data-act="more" data-id="${m}">` : `<div class="vm1 none">🗺️<small>${t("Nessuna mappa: sceglila con ✏️", "No map: choose one with ✏️")}</small></div>`}
        ${M.length ? `<div class="fl1">${t("Manutenzione", "Maintenance")}</div><div class="stack">${M.map(x => `<div class="vmn1"><span>${esc(nomeRic(id, x.id))}</span><span class="bar1"><i style="width:${Math.max(3, x.v)}%;background:${x.v < sottoRic(id) ? "var(--red)" : x.v < sottoRic(id) + 20 ? "var(--orange)" : "var(--green)"}"></i></span><b>${Math.round(x.v)}%</b>${x.reset && isAdmin() ? `<button class="btn sm" data-act="vacReset" data-id="${x.reset}" title="${t("Azzera dopo la sostituzione", "Reset after replacing")}">↺</button>` : ""}</div>`).join("")}</div>` : ""}
      </div>
    </div></section>`;
}

/* ✏️ robot: mappa e impostazioni rapide */
function config(id) {
  const Q = rapide(id), L = delDispositivo(id, x => x.startsWith("select.") && ok(x) && !/room_\d/.test(x));
  const M = manutenzione(id, true), no = new Set(conf(id).noManut || []), P = passate(id);
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted">${t("Vale per tutta la casa.", "It applies to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <button class="li" data-act="vacMap" data-id="${id}"><span class="ic">🗺️</span><div class="tx"><b>${t("Mappa", "Map")}</b><span>${conf(id).map === "none" ? t("nessuna", "none") : mappa(id) ? esc(nm(mappa(id))) : "—"}</span></div><span class="st">›</span></button>
    <div class="fl1">${t("Impostazioni rapide da mostrare", "Quick settings to show")}</div>
    <p class="small muted" style="margin:0 0 6px;line-height:1.45">${t("I menu del robot (potenza, modalità, acqua del mop…) da avere sulla scheda. Senza scelta mostro i primi quattro adatti.", "The robot's menus (power, mode, mop water…) to keep on the card. Without a choice I show the first four that fit.")}</p>
    <div class="stack">${L.map(x => `<label class="li rfc1"><input type="checkbox" data-chg="vacQuick" data-id="${id}" data-v="${x}" ${Q.includes(x) ? "checked" : ""}><div class="tx"><b>${esc(shortName(x))}</b><span>${esc(S[x].state)}</span></div></label>`).join("") || `<div class="small muted">—</div>`}</div>
    ${stanze(id).length && passateOk() ? `<div class="fl1">${t("Pulizia delle stanze scelte", "Cleaning the chosen rooms")}</div>
    <p class="small muted" style="margin:0 0 6px;line-height:1.45">${t("Quante volte il robot passa su ogni stanza quando usi «Pulisci solo alcune stanze».", "How many times the robot goes over each room when you use «Clean some rooms only».")}</p>
    <div class="seg">${[1, 2, 3].map(n => `<button class="${P === n ? "act" : ""}" data-act="vacPass" data-id="${id}" data-v="${n}">${n === 1 ? t("1 passata", "1 pass") : t(`${n} passate`, `${n} passes`)}</button>`).join("")}</div>` : ""}
    ${M.length ? `<div class="fl1">${t("Manutenzione", "Maintenance")}</div>
    <p class="small muted" style="margin:0 0 6px;line-height:1.45">${t("Spazzole, filtro, mop…: quanta vita resta. Togli la spunta a quelli che non vuoi vedere.", "Brushes, filter, mop…: how much life is left. Untick the ones you don't want to see.")}</p>
    <div class="stack">${M.map(x => `<label class="li rfc1"><input type="checkbox" data-chg="vacMan" data-id="${id}" data-v="${x.id}" ${no.has(x.id) ? "" : "checked"}><div class="tx"><b>${esc(nomeRic(id, x.id))}</b><span>${Math.round(x.v)}%</span></div></label>`).join("")}</div>
    <label class="fld1"><span>${t("Da cambiare sotto (%)", "Replace below (%)")}</span><input type="number" min="1" max="80" step="1" value="${sottoRic(id)}" data-chg="vacRic" data-id="${id}">
      <small>${t(`Sotto questa percentuale la barra è rossa, fino a 20 punti sopra è arancione. Di partenza ${RIC_DEF}%.`, `Below this percentage the bar is red, up to 20 points above it's orange. Default ${RIC_DEF}%.`)}</small></label>` : ""}`;
}

Object.assign(ACT, {
  vac: el => svc("vacuum", el.dataset.v, {}, { entity_id: el.dataset.id }),
  vacRoom: el => { const id = el.dataset.id, v = isNaN(+el.dataset.v) ? el.dataset.v : +el.dataset.v, L = sel[id] = sel[id] || []; const i = L.indexOf(v); i < 0 ? L.push(v) : L.splice(i, 1); render(); },
  vacRooms: el => { const id = el.dataset.id; pulisciStanze(id, sel[id]).then(() => { toast("🤖 " + t("Partito", "Started")); sel[id] = []; }).catch(() => {}); },
  vacReset: el => svc("button", "press", {}, { entity_id: el.dataset.id }).then(() => toast("↺ " + nm(el.dataset.id))),
  vacEdit: el => { const id = el.dataset.id; openSheet(() => config(id)); },
  vacPass: el => { const id = el.dataset.id, n = +el.dataset.v; salvaV(id, c => { if (n > 1) c.passate = n; else delete c.passate; }, "🤖 " + (n === 1 ? t("1 passata", "1 pass") : t(`${n} passate`, `${n} passes`))); },
  vacMap: el => { const id = el.dataset.id; scegli({ titolo: "🗺️ " + esc(nm(id)), filtro: x => x.startsWith("camera."), attuale: conf(id).map || "", auto: mappa(id), nessuno: true,
    onPick: v => cambia(l => { l.vacuums = l.vacuums || {}; l.vacuums[id] = { ...(l.vacuums[id] || {}), map: v || undefined }; }) }); },
});
{
  CHG.vacSel = el => svc("select", "select_option", { option: el.value }, { entity_id: el.dataset.id });
  CHG.vacQuick = el => { const id = el.dataset.id, x = el.dataset.v, cur = rapide(id);
    cambia(l => { l.vacuums = l.vacuums || {}; l.vacuums[id] = { ...(l.vacuums[id] || {}), quick: el.checked ? [...new Set([...cur, x])] : cur.filter(q => q !== x) }; }); };
  /* manutenzione: spunta tolta = non la mostro; soglia dei ricambi */
  CHG.vacMan = el => { const id = el.dataset.id, x = el.dataset.v, on = el.checked;
    salvaV(id, c => { const L = new Set(c.noManut || []); if (on) L.delete(x); else L.add(x); c.noManut = L.size ? [...L] : undefined; }); };
  CHG.vacRic = el => { const id = el.dataset.id, v = Math.round(+String(el.value).replace(",", "."));
    if (!(v >= 1 && v <= 80)) { el.value = sottoRic(id); return toast(t("Scrivi un numero da 1 a 80", "Enter a number from 1 to 80"), true); }
    salvaV(id, c => { c.ricambi = v === RIC_DEF ? undefined : v; }, "🔧 " + t(`Da cambiare sotto il ${v}%`, `Replace below ${v}%`)); };
}

function pagina() {
  const V = ents("vacuum");
  return `<div class="g g3">${V.map(id => item(id, robot(id))).join("")}
    ${!V.length ? card("🤖 " + t("Robot", "Vacuums"), empty(t("Nessun robot aspirapolvere.", "No robot vacuum.")) + addBtn(["vacuum"], { big: true }), { cls: "span3" }) : UI.edit ? `<section class="card span3">${addBtn(["vacuum"], { big: true })}</section>` : ""}</div>`;
}
page("robot", { title: t("Robot", "Vacuum"), short: "Robot", icon: "🤖", order: 35, editable: true, show: () => ents("vacuum").length > 0, badge: () => ents("vacuum").some(id => S[id].state === "cleaning" || S[id].state === "error"), render: pagina });

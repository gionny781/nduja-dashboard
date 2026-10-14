/* Persone: foto, dove sono e da quando, distanza da casa, batteria del telefono (e se è in carica).
   Il telefono si trova da solo tra i dispositivi della persona; con ✏️ si sceglie a mano. */
import { S, REG, ACT, CHG, LAYOUT, UI, t, esc, fnum, nm, nmHA, ok, val, attr, ents, ago, km, card, saveLayout, toast, openSheet, closeSheet,
  deviceClass, allEnts } from "./core.js";
import { item, addBtn } from "./edit.js";

const TELEFONO = /iphone|phone|pixel|galaxy|sm_[a-z]|android|oneplus|xiaomi|redmi|huawei|motorola|moto_|nokia|oppo|realme|poco/i;
const conf = pid => (LAYOUT.people || {})[pid] || {};

/** telefono della persona: il primo tracker che sembra un telefono (altrimenti il primo GPS) */
function telefono(pid) {
  const tr = (attr(pid, "device_trackers") || []).filter(id => S[id]);
  const conBatt = id => { const d = REG[id]?.device; return d && Object.keys(S).some(x => REG[x]?.device === d && x.startsWith("sensor.") && deviceClass(x) === "battery" && ok(x)); };
  const punti = id => (TELEFONO.test(id + nm(id)) ? 4 : 0) + (conBatt(id) ? 3 : 0) + (attr(id, "source_type") === "gps" ? 1 : 0) + (ok(id) ? 1 : 0) - (/watch|ipad|[._]tab[._]|tablet|lenovo/i.test(id) ? 5 : 0);
  return tr.sort((a, b) => punti(b) - punti(a))[0] || null;
}
/** sensori dello stesso dispositivo del telefono */
function sulTelefono(pid, pred) {
  const tel = telefono(pid), dev = tel && REG[tel]?.device;
  return dev ? Object.keys(S).filter(id => REG[id]?.device === dev && pred(id)) : [];
}
const batteriaDi = pid => conf(pid).battery || sulTelefono(pid, id => id.startsWith("sensor.") && deviceClass(id) === "battery")[0] || null;
function inCarica(pid) {
  const c = conf(pid).charging || sulTelefono(pid, id => (id.startsWith("binary_sensor.") && deviceClass(id) === "battery_charging") || (id.startsWith("sensor.") && /battery_state|stato_batteria|charger|ricarica/i.test(id)))[0];
  if (!c || !ok(c)) return false;
  const s = String(S[c].state).toLowerCase();
  return s === "on" || /charging|in carica|full|piena|ac|usb|wireless/.test(s) && !/not|non/.test(s);
}

export function info(pid) {
  const p = S[pid], a = p.attributes, z = p.state;
  const casa = z === "home", lat = a.latitude, lon = a.longitude;
  const dist = !casa ? km(lat, lon, attr("zone.home", "latitude"), attr("zone.home", "longitude")) : null;
  const b = batteriaDi(pid);
  return { pid, nome: nm(pid), foto: a.entity_picture, casa, zona: z === "home" ? t("A casa", "Home") : z === "not_home" ? t("Fuori", "Away") : (S["zone." + z]?.attributes.friendly_name || z),
    da: p.last_changed, dist, bat: b ? val(b) : null, carica: inCarica(pid) };
}

function scheda(i) {
  const bat = i.bat == null ? "" : `<span class="pb2 ${i.bat < 20 && !i.carica ? "low" : ""}"><i style="width:${Math.max(4, Math.min(100, i.bat))}%"></i></span><em>${Math.round(i.bat)}%${i.carica ? " ⚡" : ""}</em>`;
  return `<button class="ps2 ${i.casa ? "home" : ""}" data-act="more" data-id="${i.pid}">
    <span class="av2" style="${i.foto ? `background-image:url('${esc(i.foto)}')` : ""}">${i.foto ? "" : esc(i.nome[0] || "?")}<b></b></span>
    <strong>${esc(i.nome)}</strong>
    <span class="zn2">${i.casa ? "🏠" : "📍"} ${esc(i.zona)}</span>
    <small>${t("da", "for")} ${esc(ago(i.da).replace(t(" fa", " ago"), ""))}${i.dist != null && conf(i.pid).noDist !== true ? ` · ${i.dist < 1 ? Math.round(i.dist * 1000) + " m" : fnum(i.dist, i.dist < 10 ? 1 : 0) + " km"}` : ""}</small>
    ${bat ? `<span class="bt2">📱 ${bat}</span>` : ""}
  </button>`;
}
export function personeCard() {
  const P = ents("person");
  if (!P.length && !UI.edit) return "";
  return card("👥 " + t("Persone", "People"), `<div class="pg2">${P.map(p => item(p, scheda(info(p)))).join("")}${addBtn(["person"], { label: t("Aggiungi persona", "Add person") })}</div>
    ${UI.edit ? `<div class="small muted" style="margin-top:10px">${t("Le persone nuove si creano in Home Assistant: Impostazioni → Persone. Poi compaiono qui con ＋.", "New people are created in Home Assistant: Settings → People. Then add them here with ＋.")}</div>` : ""}`, { cls: P.length > 2 ? "span2" : "" });
}

/* ---------- ✏️ di una persona: telefono, batteria, distanza ---------- */
let bozza = null, chi = null;
function config() {
  const pid = chi, c = { ...conf(pid), ...(bozza || {}) }, i = info(pid);
  const BAT = allEnts("sensor", id => deviceClass(id) === "battery").sort((a, b) => nm(a).localeCompare(nm(b)));
  const CH = [...allEnts("binary_sensor", id => deviceClass(id) === "battery_charging"), ...allEnts("sensor", id => /battery_state|stato_batteria|charger/i.test(id))];
  const sel = (k, L, label, auto) => `<label class="fld1"><span>${label}</span><select data-chg="pplSel" data-k="${k}"><option value="">${t("Automatico", "Automatic")}${auto ? ` (${esc(nm(auto))})` : ""}</option>${L.map(id => `<option value="${id}" ${c[k] === id ? "selected" : ""}>${esc(nm(id))} · ${ok(id) ? esc(S[id].state) : "—"}</option>`).join("")}</select></label>`;
  return `<div class="sh-head"><div><h3>👤 ${esc(i.nome)}</h3><div class="small muted">${t("Telefono trovato:", "Phone found:")} ${esc(telefono(pid) ? nm(telefono(pid)) : "—")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome nella plancia", "Name in the dashboard")}</span><input id="ppl1n" type="text" value="${esc(LAYOUT.names?.[pid] || "")}" placeholder="${esc(nmHA(pid))}"></label>
    ${sel("battery", BAT, "🔋 " + t("Batteria del telefono", "Phone battery"), !conf(pid).battery && batteriaDi(pid))}
    ${sel("charging", CH, "⚡ " + t("Sensore di ricarica", "Charging sensor"))}
    <label class="row" style="gap:8px;margin-top:12px"><input type="checkbox" data-chg="pplDist" ${c.noDist ? "" : "checked"}> ${t("Mostra la distanza da casa", "Show distance from home")}</label>
    <button class="btn pri" data-act="pplSave" style="margin-top:14px">💾 ${t("Salva", "Save")}</button>`;
}
CHG.pplSel = el => { bozza = bozza || {}; bozza[el.dataset.k] = el.value || undefined; };
CHG.pplDist = el => { bozza = bozza || {}; bozza.noDist = !el.checked; };
Object.assign(ACT, {
  pplEdit: el => { chi = el.dataset.id; bozza = null; openSheet(config); },
  pplSave: async () => {
    const l = JSON.parse(JSON.stringify(LAYOUT)); l.people = l.people || {};
    l.people[chi] = { ...(l.people[chi] || {}), ...(bozza || {}) };
    const n = document.getElementById("ppl1n")?.value.trim(); l.names = { ...(l.names || {}) };
    if (n && n !== nmHA(chi)) l.names[chi] = n; else delete l.names[chi];
    for (const k of Object.keys(l.people[chi])) if (l.people[chi][k] === undefined) delete l.people[chi][k];
    try { await saveLayout(l); closeSheet(); toast("💾 " + nm(chi)); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
  },
});
/* in modifica, la ✏️ di una persona apre questa scheda invece di quella generica */
const edItem = ACT.edItem;
ACT.edItem = el => el.dataset.id?.startsWith("person.") ? ACT.pplEdit(el) : edItem(el);

/* Sicurezza: allarme (inserisci / disinserisci col codice), serrature, porte e finestre aperte,
   fumo, gas, acqua, monossido, movimento. I sensori di pericolo accesi finiscono anche negli Avvisi della Home. */
import { S, ACT, CHG, UI, t, esc, nm, ok, attr, ents, isOn, ago, card, empty, page, svc, toast, openSheet, closeSheet, render, deviceClass, openings, shortName, areaOf, AREAS, isAdmin } from "../core.js";
import { item, addBtn } from "../edit.js";

export const pericoli = () => ents("binary_sensor", id => isOn(id) && ["smoke", "gas", "carbon_monoxide", "moisture", "safety", "tamper"].includes(deviceClass(id)));
const STATO = () => ({ disarmed: [t("Disinserito", "Disarmed"), "ok"], armed_home: [t("Inserito in casa", "Armed home"), "warn"], armed_away: [t("Inserito fuori casa", "Armed away"), "bad"], armed_night: [t("Inserito notte", "Armed night"), "warn"], armed_vacation: [t("Inserito vacanza", "Armed vacation"), "bad"], armed_custom_bypass: [t("Inserito personalizzato", "Armed custom"), "warn"], arming: [t("Si sta inserendo…", "Arming…"), "warn"], pending: [t("In attesa…", "Pending…"), "warn"], triggered: [t("ALLARME!", "TRIGGERED!"), "bad"] });
const MODI = () => [["arm_home", 1, "🏠 " + t("In casa", "Home")], ["arm_away", 2, "🚶 " + t("Fuori casa", "Away")], ["arm_night", 4, "🌙 " + t("Notte", "Night")], ["arm_vacation", 32, "🏖️ " + t("Vacanza", "Vacation")]];
const ICO = { smoke: "🔥", gas: "💨", carbon_monoxide: "☠️", moisture: "💧", motion: "🏃", occupancy: "👤", presence: "👤", tamper: "🛠️", safety: "⚠️", vibration: "📳", sound: "🔊" };

/* ---------- allarme ---------- */
let K = { id: null, srv: null, code: "" };
function tastiera() {
  const dot = "●".repeat(K.code.length) || "&nbsp;";
  return `<div class="sh-head"><div><h3>🔐 ${esc(nm(K.id))}</h3><div class="small muted">${t("Inserisci il codice", "Enter the code")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="kpd1"><div class="kpv1">${dot}</div>${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map(k => `<button data-act="kpKey" data-v="${k}" class="${k === "✓" ? "ok" : ""}">${k}</button>`).join("")}</div>`;
}
function allarme(id) {
  const st = S[id].state, [n, cls] = STATO()[st] || [st, "info"], f = attr(id, "supported_features") || 0;
  const modi = MODI().filter(([, bit]) => f & bit);
  return `<section class="card al1 ${cls}"><div class="ch"><h2>🛡️ ${esc(nm(id))}</h2><span class="tag ${cls}">${esc(n)}</span></div>
    <div class="small muted" style="margin-bottom:12px">${t("da", "since")} ${ago(S[id].last_changed).replace(t(" fa", " ago"), "")}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap">${st === "disarmed" ? modi.map(([s, , l]) => `<button class="btn" data-act="alArm" data-id="${id}" data-v="alarm_${s}">${l}</button>`).join("")
      : `<button class="btn pri" data-act="alArm" data-id="${id}" data-v="alarm_disarm">🔓 ${t("Disinserisci", "Disarm")}</button>`}</div></section>`;
}
async function esegui(id, srv, code) {
  try { await svc("alarm_control_panel", srv, code ? { code } : {}, { entity_id: id }); toast("🛡️ " + nm(id)); closeSheet(); } catch {}
}
Object.assign(ACT, {
  alArm: el => { const id = el.dataset.id, srv = el.dataset.v, serve = attr(id, "code_format") && (srv === "alarm_disarm" || attr(id, "code_arm_required") !== false);
    if (!serve) return esegui(id, srv); K = { id, srv, code: "" }; openSheet(tastiera); },
  kpKey: el => { const v = el.dataset.v;
    if (v === "⌫") K.code = K.code.slice(0, -1); else if (v === "✓") return esegui(K.id, K.srv, K.code); else if (K.code.length < 12) K.code += v; render(); },
});

/* ---------- pezzi ---------- */
const riga = (id, extra = "") => `<div class="li ${isOn(id) ? "alert" : ""}" data-act="more" data-id="${id}" role="button"><span class="ic">${ICO[deviceClass(id)] || (isOn(id) ? "🔓" : "🔒")}</span>
  <div class="tx"><b>${esc(shortName(id))}</b><span>${esc(AREAS[areaOf(id)]?.name || "")}${AREAS[areaOf(id)] ? " · " : ""}${extra || (isOn(id) ? t("ATTIVO", "ACTIVE") : t("tutto ok", "all good"))} · ${ago(S[id].last_changed)}</span></div></div>`;

function pagina() {
  const A = ents("alarm_control_panel"), L = ents("lock"), O = openings(), aperte = O.filter(isOn);
  const P = ents("binary_sensor", id => ["smoke", "gas", "carbon_monoxide", "moisture"].includes(deviceClass(id)));
  const M = ents("binary_sensor", id => ["motion", "occupancy", "presence"].includes(deviceClass(id))).sort((a, b) => new Date(S[b].last_changed) - new Date(S[a].last_changed)).slice(0, 12);
  const PB = pericoli();
  return `<div class="g g3">
    ${PB.length ? `<section class="card span3 al1 bad"><div class="ch"><h2>🚨 ${t("Attenzione", "Warning")}</h2></div><div class="stack">${PB.map(id => riga(id)).join("")}</div></section>` : ""}
    ${A.map(id => item(id, allarme(id))).join("")}
    ${L.length ? card("🔐 " + t("Serrature", "Locks"), `<div class="stack">${L.map(id => item(id, `<div class="li"><span class="ic">${S[id].state === "locked" ? "🔒" : "🔓"}</span><div class="tx"><b>${esc(shortName(id))}</b><span>${S[id].state === "locked" ? t("chiusa", "locked") : S[id].state === "unlocked" ? t("aperta", "unlocked") : esc(S[id].state)}</span></div>
      ${ok(id) ? `<button class="btn sm" data-act="lockT" data-id="${id}">${S[id].state === "locked" ? t("Apri", "Unlock") : t("Chiudi", "Lock")}</button>` : ""}</div>`)).join("")}${addBtn(["lock"])}</div>`) : ""}
    ${card(`🚪 ${t("Porte e finestre", "Doors and windows")} <span class="tag ${aperte.length ? "warn" : "ok"}">${aperte.length ? aperte.length + " " + t("aperte", "open") : t("tutte chiuse", "all closed")}</span>`,
      O.length ? `<div class="stack">${[...aperte, ...O.filter(id => !isOn(id))].map(id => item(id, riga(id, isOn(id) ? t("aperta", "open") : t("chiusa", "closed")))).join("")}</div>` : empty(t("Nessun sensore di porte o finestre.", "No door or window sensors.")))}
    ${P.length ? card("🔥 " + t("Fumo, gas e acqua", "Smoke, gas and water"), `<div class="stack">${P.map(id => item(id, riga(id))).join("")}</div>`) : ""}
    ${M.length ? card("🏃 " + t("Movimento", "Motion"), `<div class="stack">${M.map(id => item(id, riga(id, isOn(id) ? t("movimento", "motion") : t("libero", "clear")))).join("")}</div>`) : ""}
    ${!A.length && !L.length && !O.length && !P.length && !M.length ? card("🛡️ " + t("Sicurezza", "Security"), empty(t("Nessun allarme, serratura o sensore di sicurezza.", "No alarm, lock or security sensor.")) + addBtn(["alarm_control_panel", "lock", "binary_sensor"], { big: true }), { cls: "span3" }) : ""}
    ${UI.edit ? `<section class="card span3">${addBtn(["alarm_control_panel", "lock", "binary_sensor"], { big: true, label: t("Aggiungi allarme, serratura o sensore", "Add alarm, lock or sensor") })}</section>` : ""}
  </div>`;
}
ACT.lockT = el => { const id = el.dataset.id; svc("lock", S[id].state === "locked" ? "unlock" : "lock", {}, { entity_id: id }); };

page("sicurezza", { title: t("Sicurezza", "Security"), short: t("Sicurezza", "Security"), icon: "🛡️", order: 45, editable: true,
  show: () => ents("alarm_control_panel").length + ents("lock").length + openings().length > 0 || isAdmin(),
  badge: () => pericoli().length > 0 || ents("alarm_control_panel").some(id => S[id].state === "triggered"), render: pagina });

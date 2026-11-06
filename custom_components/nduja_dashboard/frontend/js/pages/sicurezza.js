/* Sicurezza: allarme (inserisci / disinserisci col codice), accessi (cancelli, garage, portoni, porte e serrature),
   telecamere (anteprime, diretta al tocco col lettore di video.js), porte e finestre aperte, fumo, gas, acqua, monossido, movimento. I sensori di pericolo accesi finiscono anche negli Avvisi della Home.
   ⚙️ (amministratori): LAYOUT.sicurezza = { noPericoli:[] (trovati da soli ma senza allarme), pericoli:[] (aggiunti a mano), movimenti: quanti (0 = scheda nascosta), camere: "no" | id di un gruppo } */
import { S, ACT, CHG, UI, LAYOUT, HOME_EXTRA, t, LOC, esc, fnum, nm, nmHA, ok, attr, ents, isOn, ago, card, empty, page, svc, toast, openSheet, closeSheet, render,
  deviceClass, openings, shortName, areaOf, AREAS, isAdmin, domain, sicuro, PAGES, excluded } from "../core.js";
import { item, addBtn, scegli, cambia } from "../edit.js";
import { anteprima, telecamere, gruppiCam, gruppoDi } from "../video.js";

const sc = () => LAYOUT.sicurezza || {};
const PERICOLO = ["smoke", "gas", "carbon_monoxide", "moisture", "safety", "tamper"], MOVIMENTO = ["motion", "occupancy", "presence"];
const aggiunti = () => (sc().pericoli || []).filter(id => S[id] && !excluded(id));
/** sensori che danno l'allarme: trovati dalla device_class più quelli aggiunti in ⚙️, meno quelli a cui l'utente ha tolto la spunta */
export function sensoriPericolo() {
  const no = new Set(sc().noPericoli || []);
  return [...new Set([...ents("binary_sensor", id => PERICOLO.includes(deviceClass(id))), ...aggiunti()])].filter(id => !no.has(id));
}
export const pericoli = () => sensoriPericolo().filter(isOn);
/** quanti sensori di movimento mostrare: 12, o quelli scelti in ⚙️ (0 = scheda nascosta) */
const quantiMov = () => { const v = sc().movimenti; return v === 0 ? 0 : +v >= 1 && +v <= 99 ? Math.round(+v) : 12; };
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

/* ---------- accessi: cancello, cancelletto, garage, portone, porta ----------
   Da soli: le cover gate/garage/door e le serrature. Con ＋ qualsiasi lock, cover, switch, button, input_button o script.
   Scelte in LAYOUT.accessi = { voci: { entity_id: { nome, icona, cmd, sensore, extra, impulso, home } }, tolti: [entity_id], ordine: [entity_id] }
   (extra: aggiunto a mano; impulso: secondi dell'impulso di un interruttore, se non è 1; home: false = non nella scheda della Home;
   tolti: trovati da soli ma tolti con ✕). */
const DOMINI = /^(lock|cover|switch|button|input_button|script)\./;
const FORME = () => [["cancello", t("Cancello", "Gate")], ["cancelletto", t("Cancelletto", "Pedestrian gate")], ["garage", "Garage"], ["portone", t("Portone", "Main door")], ["porta", t("Porta", "Door")]];
const raggiungibile = id => !!S[id] && S[id].state !== "unavailable";
const conf = () => LAYOUT.accessi || {};
function formaAuto(id) {
  const s = (id + " " + nmHA(id)).toLowerCase(), dc = deviceClass(id);
  if (dc === "garage" || /garage|basculant|autorimess|\bbox\b/.test(s)) return "garage";
  if (/cancellett|pedonal|wicket|pedestrian/.test(s)) return "cancelletto";
  if (dc === "gate" || /cancell|carrab|carrai|\bgate\b|driveway/.test(s)) return "cancello";
  if (/portone|condomin|front.?door|main.?door|entrance/.test(s)) return "portone";
  return "porta";
}
const formaDi = a => FORME().some(([k]) => k === a.icona) ? a.icona : formaAuto(a.id);
const nomeDi = a => a.nome || shortName(a.id);
/** comandi possibili: il primo è quello di partenza */
function comandiDi(id) {
  const d = domain(id), f = +attr(id, "supported_features") || 0;
  if (d === "cover") return f & 8 ? ["tre", "toggle", "impulso"] : ["toggle", "impulso"];
  if (d === "lock") return f & 1 ? ["toggle", "impulso"] : ["toggle"];
  if (d === "switch") return ["impulso", "toggle"];
  return ["impulso"];
}
const cmdDi = a => comandiDi(a.id).includes(a.cmd) ? a.cmd : comandiDi(a.id)[0];
/** quanti secondi resta acceso un interruttore col comando a impulso: 1, o quelli scelti con ✏️ (da 0,2 a 10) */
const impulsoS = a => { const v = +a.impulso; return v >= 0.2 && v <= 10 ? Math.round(v * 10) / 10 : 1; };
const NOMI_CMD = () => ({ toggle: t("Apri / chiudi", "Open / close"), impulso: t("Impulso", "Pulse"), tre: t("Apri · stop · chiudi", "Open · stop · close") });
function spiegaCmd(a, c) {
  const id = a.id, d = domain(id), s = impulsoS(a);
  if (c === "tre") return t("Tre pulsanti: apri, ferma e chiudi.", "Three buttons: open, stop and close.");
  if (c === "toggle") return d === "lock" ? t("Sblocca o blocca la serratura.", "Unlocks or locks the lock.") : d === "switch" ? t("Acceso vuol dire aperto, spento chiuso.", "On means open, off means closed.") : t("Un pulsante: apre se è chiuso, chiude se è aperto.", "One button: opens when closed, closes when open.");
  return d === "lock" ? t("Apre la porta (sgancia lo scrocco).", "Opens the door (releases the latch).")
    : d === "switch" ? (s === 1 ? t("Accende per un secondo e spegne, come il telecomando.", "On for one second, then off, like a remote.") : t(`Accende per ${fnum(s, s % 1 ? 1 : 0)} secondi e spegne, come il telecomando.`, `On for ${fnum(s, s % 1 ? 1 : 0)} seconds, then off, like a remote.`))
    : d === "cover" ? t("Un tocco come il telecomando: apre, ferma o chiude.", "One tap like the remote: opens, stops or closes.") : d === "script" ? t("Avvia lo script.", "Runs the script.") : t("Preme il pulsante.", "Presses the button.");
}
/** accessi in ordine: [{ id, nome, icona, cmd, sensore }] */
export function accessi() {
  const C = conf(), V = C.voci || {}, tolti = new Set(C.tolti || []), o = C.ordine || [];
  const trovati = [...ents("cover", id => ["gate", "garage", "door"].includes(deviceClass(id))), ...ents("lock")];
  const L = [...new Set([...trovati, ...Object.keys(V).filter(id => V[id]?.extra)])].filter(id => S[id] && !tolti.has(id)).map(id => ({ ...(V[id] || {}), id }));
  const pos = id => { const i = o.indexOf(id); return i < 0 ? 1e6 : i; };
  return L.sort((a, b) => pos(a.id) - pos(b.id) || nomeDi(a).localeCompare(nomeDi(b), LOC));
}
/** stato: open, closed, opening, closing, jammed oppure null (non noto); src = entità da cui viene */
function statoDi(a) {
  const id = a.id, s = S[id]?.state, d = domain(id), sn = a.sensore && ok(a.sensore) ? a.sensore : null;
  let k = null, src = id;
  if (d === "cover" && (s === "opening" || s === "closing")) k = s;
  else if (d === "lock" && ["opening", "unlocking", "locking", "jammed"].includes(s)) k = s === "locking" ? "closing" : s === "jammed" ? "jammed" : "opening";
  if (!k && sn) { k = S[sn].state === "on" ? "open" : "closed"; src = sn; }
  if (!k && ok(id)) {
    if (d === "cover") k = s === "open" ? "open" : s === "closed" ? "closed" : null;
    else if (d === "lock") k = s === "locked" ? "closed" : s === "unlocked" || s === "open" ? "open" : null;
    else if (d === "switch" && cmdDi(a) === "toggle") k = s === "on" ? "open" : s === "off" ? "closed" : null;
  }
  return { k, src };
}
const parola = (k, f) => ({ open: f ? t("Aperta", "Open") : t("Aperto", "Open"), closed: f ? t("Chiusa", "Closed") : t("Chiuso", "Closed"), opening: t("Si apre…", "Opening…"),
  closing: t("Si chiude…", "Closing…"), jammed: f ? t("Bloccata", "Jammed") : t("Bloccato", "Jammed") }[k] || "");

/* disegni della plancia (SVG fatti apposta, animati solo col CSS «accessi» di nduja.css): .mv è la parte che si muove */
const DISEGNO = {
  cancello: () => `<rect class="po" x="4" y="14" width="5" height="28" rx="1.2"/><rect class="po" x="39" y="14" width="5" height="28" rx="1.2"/>
    <svg x="9" y="4" width="30" height="38" viewBox="9 4 30 38"><g class="mv"><path class="lf" d="M9.5 17Q24 3 38.5 17V38H9.5Z"/><path d="M9.5 17Q24 3 38.5 17M9.5 20h29M9.5 37h29"/>
    <path d="M13 14v26M18.5 11v29M24 10v30M29.5 11v29M35 14v26"/></g></svg>`,
  cancelletto: () => `<path class="po" d="M9 15h4v27H9zM35 15h4v27h-4z"/><g class="mv"><path class="lf" d="M13.5 19Q24 9 34.5 19V39H13.5Z"/><path d="M13.5 39V19Q24 9 34.5 19V39M13.5 22.5h21M13.5 36h21M19 15.6V39M24 14v25M29 15.6V39"/></g>`,
  garage: () => `<path class="po" d="M4 22 24 8l20 14"/><path d="M8 20v22M40 20v22"/><rect class="in" x="12" y="23" width="24" height="19"/>
    <svg x="12" y="23" width="24" height="19" viewBox="12 23 24 19"><g class="mv"><rect class="lf" x="12.5" y="23.5" width="23" height="18.5" rx="1"/><path d="M12.5 28.2h23M12.5 32.8h23M12.5 37.4h23"/></g></svg><path d="M11 42V22h26v20"/>`,
  portone: () => `<path class="in" d="M11 42V20.5a13 13 0 0 1 26 0V42Z"/><path d="M9 42V20.5a15 15 0 0 1 30 0V42"/>
    <g class="mv l"><path class="lf" d="M11 42V20.5A13 13 0 0 1 24 7.5V42Z"/><path d="M14.5 19.5h6v7.5h-6zM14.5 30.5h6v8h-6z"/><circle class="pm" cx="22" cy="28.8" r="1.1"/></g>
    <g class="mv r"><path class="lf" d="M37 42V20.5A13 13 0 0 0 24 7.5V42Z"/><path d="M27.5 19.5h6v7.5h-6zM27.5 30.5h6v8h-6z"/><circle class="pm" cx="26" cy="28.8" r="1.1"/></g>`,
  porta: () => `<rect class="in" x="14" y="8" width="20" height="34"/><path d="M12 42V6h24v36"/>
    <g class="mv l"><rect class="lf" x="14" y="8" width="20" height="34" rx="1"/><path d="M17.5 12h13v11h-13zM17.5 27h13v11h-13z"/><circle class="pm" cx="30.5" cy="25" r="1.3"/></g>`,
};
export const disegnoAccesso = (forma, k) => `<svg class="acd1 k-${forma} s-${k || "closed"}" viewBox="0 0 48 48" aria-hidden="true"><path class="gr" d="M3 42h42"/>${(DISEGNO[forma] || DISEGNO.porta)()}</svg>`;

/** pulsanti: [comando, testo, icona, chiede conferma, principale] */
function pulsanti(a, st) {
  const c = cmdDi(a), k = st.k, lock = domain(a.id) === "lock", aperto = k === "open" || k === "opening", moto = k === "opening" || k === "closing";
  const AP = [t("Apri", "Open"), lock ? "🔓" : "▲"], CH = [t("Chiudi", "Close"), lock ? "🔒" : "▼"];
  if (c === "tre") return [["apri", ...AP, true, !moto && k !== "open"], ["stop", t("Ferma", "Stop"), "■", false, moto], ["chiudi", ...CH, false, !moto && k === "open"]];
  if (c === "toggle") return [aperto ? ["chiudi", ...CH, false, true] : ["apri", ...AP, true, true]];
  return [["impulso", ...(lock || !(k === "open") ? AP : CH), true, true]];
}
const chiedi = (a, cosa) => cmdDi(a) === "tre" ? t("Tocca ancora", "Tap again") : cosa === "impulso" && domain(a.id) !== "lock" && statoDi(a).k === "open" ? t("Tocca ancora per chiudere", "Tap again to close") : t("Tocca ancora per aprire", "Tap again to open");
const bottone = (a, [cosa, txt, ic, conf, pri], cls = "") => `<button class="acx1 ${pri ? "pri" : ""} ${cls}" data-act="acCmd" data-id="${a.id}" data-v="${cosa}" ${conf ? `data-ask="${esc(chiedi(a, cosa))}"` : ""} ${raggiungibile(a.id) ? "" : "disabled"}><i>${ic}</i><span>${esc(txt)}</span></button>`;
function riassunto(a, st) {
  if (!raggiungibile(a.id)) return `<em class="na">${t("non raggiungibile", "unavailable")}</em>`;
  const w = parola(st.k, formaDi(a) === "porta");
  return w ? `<em>${esc(w)}</em> · ${esc(ago(S[st.src].last_changed))}` : esc(AREAS[areaOf(a.id)]?.name || (domain(a.id) === "script" ? "Script" : t("comando", "command")));
}
function accesso(a, i, n) {
  const st = statoDi(a), P = pulsanti(a, st);
  const html = `<div class="ac1 st-${st.k || "na"} ${raggiungibile(a.id) ? "" : "dis"}">
    <div class="ac1h"><span class="aci1">${disegnoAccesso(formaDi(a), st.k)}</span><div class="tx"><b>${esc(nomeDi(a))}</b><span>${riassunto(a, st)}</span></div></div>
    <div class="acb1 ${P.length > 1 ? "tre" : ""}">${P.map(p => bottone(a, p)).join("")}</div></div>`;
  if (!UI.edit) return html;
  return `<div class="ed1">${html}<div class="edb"><button data-act="acMove" data-id="${a.id}" data-v="-1" ${i ? "" : "disabled"} aria-label="${t("Sposta prima", "Move earlier")}">◀</button><button data-act="acMove" data-id="${a.id}" data-v="1" ${i < n - 1 ? "" : "disabled"} aria-label="${t("Sposta dopo", "Move later")}">▶</button>
    <button data-act="acEdit" data-id="${a.id}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="acDel" data-id="${a.id}" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}
function accessiCard() {
  const L = accessi(); if (!L.length && !UI.edit) return "";
  return card("🚪 " + t("Accessi", "Access"), `<div class="acg1">${L.map((a, i) => accesso(a, i, L.length)).join("")}
    ${UI.edit ? `<button class="add1" data-act="acAdd"><span>＋</span>${t("Aggiungi accesso", "Add access")}</button>` : ""}</div>
    ${UI.edit && !L.length ? `<p class="small muted" style="margin-top:10px">${t("Cancello, cancelletto, porta del garage, portone: qualsiasi serratura, cover, interruttore, pulsante o script.", "Gate, pedestrian gate, garage door, main door: any lock, cover, switch, button or script.")}</p>` : ""}`, { cls: "span3" });
}

/* comandi */
async function comando(a, cosa) {
  const id = a.id, d = domain(id), T = { entity_id: id };
  if (cosa === "apri") return d === "cover" ? svc("cover", "open_cover", {}, T) : d === "lock" ? svc("lock", "unlock", {}, T) : svc(d, "turn_on", {}, T);
  if (cosa === "chiudi") return d === "cover" ? svc("cover", "close_cover", {}, T) : d === "lock" ? svc("lock", "lock", {}, T) : svc(d, "turn_off", {}, T);
  if (cosa === "stop") return svc("cover", "stop_cover", {}, T);
  if (d === "cover") return svc("cover", "toggle", {}, T);
  if (d === "lock") return svc("lock", "open", {}, T);
  if (d === "switch") { await svc("switch", "turn_on", {}, T); setTimeout(() => svc("switch", "turn_off", {}, T).catch(() => {}), impulsoS(a) * 1000); return; }
  if (d === "script") return svc("script", "turn_on", {}, T);
  return svc(d, "press", {}, T);
}

/* ✏️ e ＋: nome, disegno, comando e sensore facoltativo */
let bz = null, nuovo = false;
function config() {
  const a = bz, C = comandiDi(a.id), c = cmdDi(a), st = statoDi(a);
  return `<div class="sh-head"><div><h3>${nuovo ? "＋ " + t("Nuovo accesso", "New access") : "✏️ " + esc(nomeDi(a))}</h3><div class="small muted mono">${esc(a.id)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="ac1n" type="text" value="${esc(a.nome || "")}" placeholder="${esc(shortName(a.id))}" data-chg="acNome"></label>
    <div class="fl1">${t("Icona", "Icon")}</div>
    <div class="ack1">${FORME().map(([k, n]) => `<button class="${formaDi(a) === k ? "on" : ""}" data-act="acIco" data-v="${k}"><span class="aci1">${disegnoAccesso(k, "closed")}</span>${esc(n)}</button>`).join("")}</div>
    <div class="fl1">${t("Comando", "Command")}</div>
    ${C.length > 1 ? `<div class="seg" style="flex-wrap:wrap">${C.map(k => `<button class="${c === k ? "act" : ""}" data-act="acCmdSet" data-v="${k}">${esc(NOMI_CMD()[k])}</button>`).join("")}</div>`
      : `<div class="vb1" style="display:inline-block">${esc(NOMI_CMD()[c])}</div>`}
    <p class="small muted" style="margin-top:6px">${esc(spiegaCmd(a, c))} ${t("Per aprire serve il doppio tocco.", "Opening needs a double tap.")}</p>
    ${domain(a.id) === "switch" && c === "impulso" ? `<label class="fld1"><span>${t("Durata dell'impulso (secondi)", "Pulse length (seconds)")}</span><input id="ac1i" type="number" min="0.2" max="10" step="0.1" value="${impulsoS(a)}" data-chg="acImp"></label>
    <p class="small muted" style="margin-top:6px">${t("Quanto resta acceso il relè prima di spegnersi. Di solito basta 1 secondo; alcune centraline di cancelli e garage vogliono un impulso più lungo o più corto.", "How long the relay stays on before switching off. 1 second is usually enough; some gate and garage controllers want a longer or shorter pulse.")}</p>` : ""}
    <div class="fl1">${t("Sensore aperto / chiuso (facoltativo)", "Open / closed sensor (optional)")}</div>
    <button class="li" data-act="acSens" style="width:100%;text-align:left"><span class="ic">📡</span><div class="tx"><b>${a.sensore && S[a.sensore] ? esc(nm(a.sensore)) : t("Nessuno", "None")}</b>
      <span>${a.sensore && S[a.sensore] ? esc(a.sensore) + " · " + (S[a.sensore].state === "on" ? t("aperto", "open") : S[a.sensore].state === "off" ? t("chiuso", "closed") : esc(S[a.sensore].state)) : t("Un binary_sensor che dice se è aperto: così vedi lo stato anche dei comandi a impulso.", "A binary_sensor telling whether it's open: so you see the state even with pulse commands.")}</span></div><span class="st">›</span></button>
    <div class="acpv1 st-${st.k || "na"}"><span class="aci1">${disegnoAccesso(formaDi(a), st.k)}</span><span>${t("Adesso", "Now")}: <b>${esc(parola(st.k, formaDi(a) === "porta") || t("stato non noto", "state unknown"))}</b></span></div>
    <div class="li" style="margin-top:10px"><span class="ic">🏠</span><div class="tx"><b>${t("Nella scheda della Home", "On the Home card")}</b><span>${t("Spento: resta solo qui nella pagina Sicurezza.", "Off: it stays only here on the Security page.")}</span></div>
      <button class="sw ${a.home !== false ? "on" : ""}" data-act="acHome" aria-pressed="${a.home !== false}" aria-label="${t("Nella scheda della Home", "On the Home card")}"><i></i></button></div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="acSave">💾 ${t("Salva", "Save")}</button>${nuovo ? "" : `<button class="btn bad" data-act="acDel" data-id="${esc(a.id)}">✕ ${t("Togli dagli accessi", "Remove from access")}</button>`}</div>`;
}
const salvaAccessi = (fn, msg) => cambia(l => { const C = JSON.parse(JSON.stringify(l.accessi || {})); C.voci = C.voci || {}; C.tolti = C.tolti || []; C.ordine = C.ordine || []; fn(C); l.accessi = C; }, msg);
const apri = (a, n) => { bz = a; nuovo = n; openSheet(config); };
CHG.acNome = el => { if (bz) bz.nome = el.value.trim(); };
CHG.acImp = el => { if (!bz) return; const v = +String(el.value).replace(",", "."); bz.impulso = v >= 0.2 && v <= 10 ? v : 1; el.value = impulsoS(bz); render(); };
Object.assign(ACT, {
  acCmd: el => { const id = el.dataset.id, cosa = el.dataset.v, a = accessi().find(x => x.id === id) || { id };
    if (el.dataset.ask && !sicuro(el, el.dataset.ask)) return;
    comando(a, cosa).then(() => toast({ apri: "▲ " + t("Apro", "Opening"), chiudi: "▼ " + t("Chiudo", "Closing"), stop: "■ " + t("Fermo", "Stopping"), impulso: "▶ " + t("Comando inviato", "Command sent") }[cosa] + " · " + nomeDi(a))).catch(() => {}); },
  acAdd: () => { const gia = new Set(accessi().map(a => a.id));
    scegli({ titolo: "＋ " + t("Accesso", "Access"), sotto: t("Serrature, cover, interruttori, pulsanti e script: scegli quello che apre il cancello, il garage o la porta.", "Locks, covers, switches, buttons and scripts: pick the one that opens the gate, the garage or the door."),
      filtro: id => DOMINI.test(id) && !gia.has(id), auto: false, attuale: null, onPick: id => { if (id) apri({ ...(conf().voci?.[id] || {}), id }, true); } }); },
  acEdit: el => { const a = accessi().find(x => x.id === el.dataset.id); if (a) apri(JSON.parse(JSON.stringify(a)), false); },
  acIco: el => { bz.icona = el.dataset.v; render(); },
  acCmdSet: el => { bz.cmd = el.dataset.v; render(); },
  acHome: () => { bz.home = bz.home === false ? undefined : false; render(); },
  acSens: () => { const keep = { ...bz, nome: document.getElementById("ac1n")?.value.trim() ?? bz.nome }, n = nuovo;
    scegli({ titolo: "📡 " + t("Sensore aperto / chiuso", "Open / closed sensor"), sotto: t("Acceso vuol dire aperto.", "On means open."), filtro: id => id.startsWith("binary_sensor."),
      area: areaOf(keep.id), attuale: keep.sensore || "none", auto: false, nessuno: true, onPick: id => apri({ ...keep, sensore: id && id !== "none" ? id : undefined }, n) }); },
  acSave: () => { const a = bz, n = (document.getElementById("ac1n")?.value || "").trim(), id = a.id;
    const v = { extra: true };   // salvato a mano: resta anche se Home Assistant cambia la device_class
    if (n && n !== shortName(id)) v.nome = n;
    if (a.icona && a.icona !== formaAuto(id)) v.icona = a.icona;
    if (a.cmd && a.cmd !== comandiDi(id)[0]) v.cmd = a.cmd;
    if (a.sensore) v.sensore = a.sensore;
    if (domain(id) === "switch" && impulsoS(a) !== 1) v.impulso = impulsoS(a);   // tenuto anche col comando apri / chiudi: se si torna all'impulso c'è ancora
    if (a.home === false) v.home = false;
    closeSheet();
    salvaAccessi(C => { C.voci[id] = v; C.tolti = C.tolti.filter(x => x !== id); if (!C.ordine.includes(id)) C.ordine = [...accessi().map(x => x.id).filter(x => x !== id), id]; }, "💾 " + (n || shortName(id))); },
  acDel: el => { const id = el.dataset.id; if (UI.sheet) closeSheet();
    salvaAccessi(C => { delete C.voci[id]; C.tolti = [...new Set([...C.tolti, id])]; C.ordine = C.ordine.filter(x => x !== id); }, "✕ " + nomeDi({ ...(conf().voci?.[id] || {}), id })); },
  acMove: el => { const id = el.dataset.id, d = +el.dataset.v, o = accessi().map(a => a.id), i = o.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; salvaAccessi(C => { C.ordine = o; }); },
});

/* scheda compatta nella Home: un pulsante principale per accesso (senza quelli tolti dalla Home con ✏️) */
const inHome = () => accessi().filter(a => a.home !== false);
function homeCard() {
  const L = inHome(); if (!L.length) return "";
  return card("🚪 " + t("Accessi", "Access"), `<div class="ach1">${L.map(a => { const st = statoDi(a), p = pulsanti(a, st).find(x => x[4]) || pulsanti(a, st)[0];
    return `<div class="st-${st.k || "na"} ${raggiungibile(a.id) ? "" : "dis"}"><span class="aci1">${disegnoAccesso(formaDi(a), st.k)}</span><div class="tx"><b>${esc(nomeDi(a))}</b><span>${riassunto(a, st)}</span></div>${bottone(a, p)}</div>`; }).join("")}</div>`,
    { link: [t("Tutti", "All"), "sicurezza"] });
}
HOME_EXTRA.accessi = { title: () => t("Accessi", "Access"), render: homeCard, show: () => inHome().length > 0 };

/* ---------- telecamere: anteprime leggere, la diretta parte al tocco ---------- */
/** telecamere da mostrare qui: tutte, nessuna ("no") o quelle di un gruppo della pagina Telecamere (scelta in ⚙️) */
function camQui() {
  const v = sc().camere; if (v === "no") return [];
  const L = telecamere(); return v && gruppiCam().some(g => g.id === v) ? L.filter(id => gruppoDi(id) === v) : L;
}
function telecamereCard() {
  const L = camQui(); if (!L.length) return "";
  const pag = PAGES.telecamere && PAGES.telecamere.show() && LAYOUT.pages?.telecamere !== false;
  return card(`📷 ${t("Telecamere", "Cameras")} <span class="tag info">${L.length}</span>`,
    `<div class="cms1 sct1">${L.map(id => `<div class="cm1 ${ok(id) ? "" : "dis"}">${anteprima(id)}</div>`).join("")}</div>`,
    { cls: "span3", link: pag ? [t("Tutte", "All"), "telecamere"] : null });
}

/* ---------- pezzi ---------- */
/* quieto: sensore di pericolo a cui è stata tolta la spunta in ⚙️ (niente rosso) */
const riga = (id, extra = "", quieto = false) => `<div class="li ${isOn(id) && !quieto ? "alert" : ""}" data-act="more" data-id="${id}" role="button"><span class="ic">${ICO[deviceClass(id)] || ((sc().pericoli || []).includes(id) ? "⚠️" : isOn(id) ? "🔓" : "🔒")}</span>
  <div class="tx"><b>${esc(shortName(id))}</b><span>${esc(AREAS[areaOf(id)]?.name || "")}${AREAS[areaOf(id)] ? " · " : ""}${extra || (isOn(id) ? t("ATTIVO", "ACTIVE") : t("tutto ok", "all good"))}${quieto ? " · 🔕 " + t("senza allarme", "no alarm") : ""} · ${ago(S[id].last_changed)}</span></div></div>`;
const cfgBtn = () => isAdmin() ? `<button class="btn sm" data-act="siCfg" title="${t("Impostazioni", "Settings")}" aria-label="${t("Impostazioni", "Settings")}">⚙️</button>` : "";

function pagina() {
  const A = ents("alarm_control_panel"), AC = accessi(), O = openings(), aperte = O.filter(isOn), no = new Set(sc().noPericoli || []);
  const P = [...new Set([...ents("binary_sensor", id => ["smoke", "gas", "carbon_monoxide", "moisture"].includes(deviceClass(id))), ...aggiunti()])];
  const nM = quantiMov(), M = ents("binary_sensor", id => MOVIMENTO.includes(deviceClass(id))).sort((a, b) => new Date(S[b].last_changed) - new Date(S[a].last_changed)).slice(0, nM);
  const PB = pericoli();
  return `<div class="g g3">
    ${PB.length ? `<section class="card span3 al1 bad"><div class="ch"><h2>🚨 ${t("Attenzione", "Warning")}</h2>${cfgBtn()}</div><div class="stack">${PB.map(id => riga(id)).join("")}</div></section>` : ""}
    ${accessiCard()}
    ${telecamereCard()}
    ${A.map(id => item(id, allarme(id))).join("")}
    ${card(`🚪 ${t("Porte e finestre", "Doors and windows")} <span class="tag ${aperte.length ? "warn" : "ok"}">${aperte.length ? aperte.length + " " + t("aperte", "open") : t("tutte chiuse", "all closed")}</span>`,
      O.length ? `<div class="stack">${[...aperte, ...O.filter(id => !isOn(id))].map(id => item(id, riga(id, isOn(id) ? t("aperta", "open") : t("chiusa", "closed")))).join("")}</div>` : empty(t("Nessun sensore di porte o finestre.", "No door or window sensors.")))}
    ${P.length ? card("🔥 " + t("Fumo, gas e acqua", "Smoke, gas and water"), `<div class="stack">${P.map(id => item(id, riga(id, "", no.has(id)))).join("")}</div>`, { right: cfgBtn() }) : ""}
    ${M.length ? card("🏃 " + t("Movimento", "Motion"), `<div class="stack">${M.map(id => item(id, riga(id, isOn(id) ? t("movimento", "motion") : t("libero", "clear")))).join("")}</div>`, { right: cfgBtn() }) : ""}
    ${!A.length && !AC.length && !O.length && !P.length && !M.length && !UI.edit ? card("🛡️ " + t("Sicurezza", "Security"), empty(t("Nessun allarme, accesso o sensore di sicurezza.", "No alarm, access or security sensor.")), { cls: "span3" }) : ""}
    ${UI.edit ? `<section class="card span3">${addBtn(["alarm_control_panel", "lock", "binary_sensor"], { big: true, label: t("Aggiungi allarme, serratura o sensore", "Add alarm, lock or sensor") })}
      ${isAdmin() ? `<button class="add1 wide1" data-act="siCfg" style="margin-top:8px"><span>⚙️</span>${t("Sensori di pericolo, movimento e telecamere di questa pagina", "Danger sensors, motion and cameras on this page")}</button>` : ""}</section>` : ""}
  </div>`;
}

/* ---------- ⚙️ scelte della pagina (amministratori, valgono per tutta la casa) ---------- */
const sicCambia = (fn, msg) => cambia(l => { const c = JSON.parse(JSON.stringify(l.sicurezza || {})); fn(c);
  for (const k of ["noPericoli", "pericoli"]) if (Array.isArray(c[k]) && !c[k].length) delete c[k];
  if (Object.keys(c).length) l.sicurezza = c; else delete l.sicurezza; }, msg);   // tutto come di partenza: niente chiave
/* sensori di sicurezza tolti con ✕ (in ＋ Aggiungi compaiono solo porte e finestre): qui si rimettono */
const tolti = () => (LAYOUT.exclude || []).filter(id => id.startsWith("binary_sensor.") && S[id] && ([...PERICOLO, ...MOVIMENTO].includes(deviceClass(id)) || (sc().pericoli || []).includes(id)));
function foglioCfg() {
  const no = new Set(sc().noPericoli || []), agg = aggiunti(), trovati = ents("binary_sensor", id => PERICOLO.includes(deviceClass(id))), T = [...new Set([...trovati, ...agg])];
  const statoP = id => !ok(id) ? t("non raggiungibile", "unavailable") : isOn(id) ? "⚠️ " + t("attivo adesso", "active now") : t("tutto ok", "all good");
  const nMov = ents("binary_sensor", id => MOVIMENTO.includes(deviceClass(id))).length, q = quantiMov();
  const G = gruppiCam(), cv = sc().camere === "no" ? "no" : G.some(g => g.id === sc().camere) ? sc().camere : "";
  return `<div class="sh-head"><div><h3>⚙️ ${t("Sicurezza", "Security")}</h3><div class="small muted">${t("Valgono per tutta la casa.", "They apply to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">🚨 ${t("Sensori di pericolo", "Danger sensors")}</div>
    <p class="small muted" style="margin:0 0 6px;line-height:1.45">${t("Quando uno di questi si accende compaiono la scheda rossa «Attenzione», il pallino sulla pagina e l'avviso nella Home. Togli la spunta a quelli che danno falsi allarmi (per esempio i sensori di manomissione); con ＋ aggiungi un sensore sì/no che non ho riconosciuto da solo.", "When one of these turns on you get the red «Warning» card, the dot on the page and the alert on Home. Untick the ones giving false alarms (tamper sensors, for example); with ＋ add a yes/no sensor I didn't recognise by myself.")}</p>
    <div class="stack">${T.map(id => `<label class="li"><input type="checkbox" data-chg="siPer" data-id="${id}" ${no.has(id) ? "" : "checked"}><div class="tx"><b>${esc(nm(id))}</b><span>${esc(statoP(id))}${agg.includes(id) && !trovati.includes(id) ? " · " + t("aggiunto da te", "added by you") : ""}</span></div></label>`).join("") || `<div class="small muted">${t("Nessun sensore di pericolo trovato.", "No danger sensor found.")}</div>`}
      <button class="add1" data-act="siPerAdd"><span>＋</span>${t("Aggiungi un sensore di pericolo", "Add a danger sensor")}</button></div>
    ${nMov ? `<label class="fld1"><span>🏃 ${t("Sensori di movimento da mostrare", "Motion sensors to show")}</span><select data-chg="siMov">${[[0, t("Nessuno (scheda nascosta)", "None (card hidden)")], ...[...new Set([4, 6, 8, 12, 20, 40, q || 12])].sort((a, b) => a - b).map(n => [n, n === 12 ? n + " · " + t("predefinito", "default") : n])].map(([n, x]) => `<option value="${n}" ${q === n ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <p class="small muted" style="margin:6px 0 0">${t(`Prima quelli che si sono accesi o spenti da poco. In casa ne hai ${nMov}.`, `The most recently changed first. You have ${nMov} at home.`)}</p>` : ""}
    ${telecamere().length ? `<div class="fl1">📷 ${t("Telecamere in questa pagina", "Cameras on this page")}</div>
    <div class="pkt1">${[["", t("Tutte", "All")], ...G.map(g => [g.id, g.nome]), ["no", t("Nessuna", "None")]].map(([k, n]) => `<button class="${cv === k ? "act" : ""}" data-act="siCam" data-v="${esc(k)}">${esc(n)}</button>`).join("")}</div>
    <p class="small muted" style="margin:6px 0 0">${t("I gruppi si creano nella pagina Telecamere (✏️ Modifica → 🗂 Gruppi). La pagina Telecamere resta com'è.", "Groups are made on the Cameras page (✏️ Edit → 🗂 Groups). The Cameras page stays as it is.")}</p>` : ""}
    ${tolti().length ? `<div class="fl1">✕ ${t("Tolti dalla pagina", "Removed from the page")}</div><div class="stack">${tolti().map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)}</span></div><button class="btn sm" data-act="siRimetti" data-id="${id}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>` : ""}`;
}
/* l'automazione degli avvisi sul telefono (avvisi.js), se è attiva, si riscrive con i sensori nuovi */
const telefono = () => import("../avvisi.js").then(m => m.aggiornaAvvisiTelefono()).catch(() => {});
CHG.siPer = el => { const id = el.dataset.id, on = el.checked;
  sicCambia(c => { if ((c.pericoli || []).includes(id) && !ents("binary_sensor", x => x === id && PERICOLO.includes(deviceClass(x))).length) { if (!on) c.pericoli = c.pericoli.filter(x => x !== id); return; }   // aggiunto a mano: togliere la spunta lo toglie
    c.noPericoli = on ? (c.noPericoli || []).filter(x => x !== id) : [...new Set([...(c.noPericoli || []), id])]; }, (on ? "🚨 " : "🔕 ") + nm(id)).then(telefono); };
CHG.siMov = el => { const n = +el.value; sicCambia(c => { if (n === 12) delete c.movimenti; else c.movimenti = n; }, "🏃 " + (n ? n : t("Scheda nascosta", "Card hidden"))); };
Object.assign(ACT, {
  siCfg: () => openSheet(foglioCfg),
  siCam: el => { const v = el.dataset.v; sicCambia(c => { if (v) c.camere = v; else delete c.camere; }, "📷 " + el.textContent.trim()); },
  siPerAdd: () => { const gia = new Set([...ents("binary_sensor", id => PERICOLO.includes(deviceClass(id))), ...aggiunti()]);
    scegli({ titolo: "🚨 " + t("Sensore di pericolo", "Danger sensor"), sotto: t("Un sensore sì/no: acceso vuol dire pericolo (allagamento, fumo, gas, guasto…).", "A yes/no sensor: on means danger (leak, smoke, gas, fault…)."),
      filtro: id => id.startsWith("binary_sensor.") && !gia.has(id), auto: false, attuale: null,
      onPick: id => { if (!id) return openSheet(foglioCfg); sicCambia(c => { c.pericoli = [...new Set([...(c.pericoli || []), id])]; c.noPericoli = (c.noPericoli || []).filter(x => x !== id); }, "＋ " + nm(id)).then(() => { openSheet(foglioCfg); telefono(); }); } }); },
  siRimetti: el => { const id = el.dataset.id; cambia(l => { l.exclude = (l.exclude || []).filter(x => x !== id); }, "↺ " + nm(id)); },
});

page("sicurezza", { title: t("Sicurezza", "Security"), short: t("Sicurezza", "Security"), icon: "🛡️", order: 45, editable: true,
  show: () => ents("alarm_control_panel").length + accessi().length + openings().length > 0 || isAdmin(),
  badge: () => pericoli().length > 0 || ents("alarm_control_panel").some(id => S[id].state === "triggered"), render: pagina });

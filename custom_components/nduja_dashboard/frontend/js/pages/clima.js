/* Clima: termostati e condizionatori per stanza (animati o con le tue immagini, vedi climadisegni.js), più temperatura e umidità di ogni stanza.
   Purificatori, deumidificatori e umidificatori stanno nella pagina Aria, se c'è. */
import { S, AREAS, UI, VISTE, ACT, t, esc, fnum, ok, attr, unit, ents, areaOf, areasSorted, roomTemp, roomHum, climateCard, entityRow, card, empty, page, isAdmin, myHA, ordina, nm, svc, toast, ws, cached, HVAC, ACTION } from "../core.js";
import { item, addBtn } from "../edit.js";
import { TRASCINA, salvaOrdine } from "../trascina.js";
import { registra, quadrante, em, fraPoco } from "../oggetti.js";
import { vistaClima, momentoClima } from "../climadisegni.js";

/* l'ordine si sceglie trascinando in ✏️ Modifica (LAYOUT.ordine.clima e .ventilatori); i nuovi vanno in fondo */
const climi = () => ordina(ents("climate"), "clima");
const ventole = () => { const AR = VISTE.ariaDisp?.() || new Set(); return ordina([...ents("fan"), ...ents("humidifier")].filter(id => !AR.has(id)), "ventilatori"); };
TRASCINA.clima = { nome: nm, salva: ({ ids }) => salvaOrdine("clima", climi(), ids) };
TRASCINA.ventilatori = { nome: nm, salva: ({ ids }) => salvaOrdine("ventilatori", ventole(), ids) };

/* la caldaia ha la sua pagina (pages/caldaia.js): se non la trovo da sola, in ✏️ la si aggiunge da qui */
const caldaiaManca = () => isAdmin() && !!VISTE.caldaiaTrovata && !VISTE.caldaiaTrovata();
function pagina() {
  const C = climi(), F = ventole(), tr = k => UI.edit ? ` data-tr="${k}"` : "";
  const zone = [...new Set(C.map(id => areaOf(id) || "_"))].sort((a, b) => areasSorted().indexOf(a) - areasSorted().indexOf(b));
  const stanze = areasSorted(UI.edit).map(a => ({ a, T: roomTemp(a), H: roomHum(a) })).filter(r => UI.edit || r.T != null || r.H != null);
  const TT = stanze.filter(r => r.T != null), tmin = Math.min(...TT.map(r => r.T)), tmax = Math.max(...TT.map(r => r.T));
  const adm = isAdmin();
  return `<div class="g g3">
    ${zone.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a]?.name || a), `<div class="stack"${tr("clima")}>${C.filter(id => (areaOf(id) || "_") === a).map(id => item(id, climateCard(id))).join("")}${addBtn(["climate"], { area: a === "_" ? "" : a })}</div>`, { right: UI.edit && a !== "_" ? `<button class="btn sm" data-act="rmEdit" data-id="${a}">✏️ ${t("Stanza", "Room")}</button>` : "" })).join("")}
    ${!C.length ? card("🌡️ " + t("Clima", "Climate"), (UI.edit ? "" : empty(t("Nessun climatizzatore: premi ✏️ Modifica in alto per aggiungerne uno.", "No climate devices: press ✏️ Edit at the top to add one."))) + addBtn(["climate"], { big: true }) + (UI.edit && caldaiaManca() ? `<button class="btn" data-act="cdAggiungi" style="margin-top:10px">🔥 ${t("Non trovo la caldaia: aggiungila a mano", "I can't find the boiler: add it by hand")}</button>` : "")) : UI.edit ? `<section class="card">${addBtn(["climate"], { big: true, label: t("Aggiungi climatizzatore", "Add climate device") })}<p class="small muted" style="margin-top:10px;line-height:1.45">${t("✏️ su un climatizzatore: nome, stanza e 🎞️ aspetto (animazioni della plancia, le tue immagini o GIF, oppure l'icona).", "✏️ on a climate device: name, room and 🎞️ look (dashboard animations, your images or GIFs, or the icon).")}</p>${caldaiaManca() ? `<button class="btn" data-act="cdAggiungi" style="margin-top:10px">🔥 ${t("Non trovo la caldaia: aggiungila a mano", "I can't find the boiler: add it by hand")}</button>` : ""}</section>` : ""}
    ${stanze.length ? card("🌡️ " + t("Temperature in casa", "Indoor temperatures"), `<div class="stack">${stanze.map(r => {
      const w = r.T == null || tmax === tmin ? 0 : (r.T - tmin) / (tmax - tmin);
      return `<${adm ? `button data-act="rmEdit" data-id="${r.a}"` : "div"} class="row between tr1 ${adm ? "tap1" : ""}"><span>${esc(AREAS[r.a].name)}${UI.edit ? " ✏️" : ""}</span><span class="bar1"><i style="width:${(15 + w * 85).toFixed(0)}%;background:${w > .66 ? "var(--orange)" : w < .33 ? "var(--teal)" : "var(--green)"}"></i></span>
        <b>${r.T != null ? fnum(r.T) + "°" : "—"}</b><small class="muted">${r.H != null ? Math.round(r.H) + "%" : ""}</small></${adm ? "button" : "div"}>`; }).join("")}</div>${adm ? `<div class="small muted" style="margin-top:10px">${t("Tocca una stanza per cambiarle nome o scegliere i sensori di temperatura e umidità.", "Tap a room to rename it or choose its temperature and humidity sensors.")}</div>` : ""}`, { cls: zone.length % 3 === 2 ? "" : "span2" }) : ""}
    ${F.length || UI.edit ? card("🌀 " + t("Ventilatori e umidificatori", "Fans and humidifiers"), `<div class="stack"${tr("ventilatori")}>${F.map(id => item(id, entityRow(id))).join("")}${addBtn(["fan", "humidifier"], { label: t("Aggiungi ventilatore o umidificatore", "Add fan or humidifier") })}</div>`) : ""}
  </div>`;
}
/* ---------- scheda oggetto (oggetti.js): lo split, il termostato o il radiatore al centro di un quadrante da trascinare ---------- */
const gr = v => v == null || isNaN(+v) ? "—" : fnum(+v, Math.abs(+v % 1) > .01 ? 1 : 0) + "°";
const COLORE = { cool: "var(--teal)", heat: "var(--orange)", dry: "#3fdcc4", fan: "#b8c6d6", off: "rgba(160,170,185,.6)" };
/* quanto manca alla temperatura voluta: dalla velocità vera degli ultimi minuti (storico di Home Assistant), niente tempi inventati */
const MIN = 60e3;
const storico = id => cached("ogClH:" + id, 5 * MIN, () => ws({ type: "history/history_during_period", start_time: new Date(Date.now() - 75 * MIN).toISOString(), entity_ids: [id], minimal_response: false, no_attributes: false, significant_changes_only: false })
  .then(r => (r?.[id] || []).map(x => ({ t: (x.lu || x.lc) * 1000, s: x.s, c: x.a?.current_temperature })).filter(x => x.c != null && !isNaN(+x.c))).catch(() => [])) || [];
function minutiAllaMeta(id) {
  const a = S[id].attributes, k = momentoClima(id).k, cur = +a.current_temperature, tg = +a.temperature;
  if (!["heat", "cool"].includes(k) || isNaN(cur) || isNaN(tg)) return null;
  const P = [...storico(id).filter(x => x.s === S[id].state && Date.now() - x.t < 45 * MIN), { t: Date.now(), c: cur }];
  if (P.length < 2 || P[P.length - 1].t - P[0].t < 10 * MIN) return null;
  /* retta dei minimi quadrati: gradi al minuto */
  const n = P.length, mx = P.reduce((s, p) => s + p.t, 0) / n, my = P.reduce((s, p) => s + +p.c, 0) / n;
  const v = P.reduce((s, p) => s + (p.t - mx) * (+p.c - my), 0) / (P.reduce((s, p) => s + (p.t - mx) ** 2, 0) || 1) * MIN;
  const manca = tg - cur; if (!v || Math.sign(v) !== Math.sign(manca) || Math.abs(v) < .004) return null;
  const m = manca / v; return m > 0 && m < 240 ? m : null;
}
const umido = id => { const h = attr(id, "current_humidity"); return h != null ? +h : roomHum(areaOf(id)); };
function fraseClima(id) {
  if (!ok(id)) return t(`${em("Non ti sento")}: controlla che sia acceso e collegato.`, `${em("I can't hear you")}: check it's powered and connected.`);
  const a = S[id].attributes, m = S[id].state, st = momentoClima(id), cur = a.current_temperature, tg = a.temperature;
  if (m === "off") return t(`Sono ${em("spento")}.`, `I'm ${em("off")}.`) + (cur != null ? " " + t(`In stanza ci sono ${gr(cur)}.`, `It's ${gr(cur)} in the room.`) : "");
  if (tg == null && a.target_temp_low != null && a.target_temp_high != null)
    return t(`Tengo la stanza ${em("tra " + gr(a.target_temp_low) + " e " + gr(a.target_temp_high))}`, `I keep the room ${em("between " + gr(a.target_temp_low) + " and " + gr(a.target_temp_high))}`) + (cur != null ? t(`: ora ci sono ${gr(cur)}.`, `: it's ${gr(cur)} now.`) : ".");
  if (st.k === "dry") { const h = umido(id); return t(`Sto ${em("togliendo l'umidità")}`, `I'm ${em("drying the air")}`) + (h != null ? t(`: in stanza c'è il ${Math.round(h)}%.`, `: the room is at ${Math.round(h)}%.`) : "."); }
  if (st.k === "fan") return t(`Faccio solo ${em("girare l'aria")}.`, `I'm just ${em("moving the air")}.`);
  if (cur != null && tg != null) {
    const caldo = st.k === "heat", arrivato = st.rest || (caldo ? +cur >= +tg - .2 : +cur <= +tg + .2);
    if (arrivato) return t(`Siamo a ${em(gr(cur))}, come volevi.`, `We're at ${em(gr(cur))}, just as you wanted.`) + (st.rest ? " " + t("Resto a riposo.", "I'm resting.") : "");
    const eta = fraPoco(minutiAllaMeta(id));
    return t(`Fa ${em(gr(cur))}, ti porto a ${em(gr(tg))}`, `It's ${em(gr(cur))}, I'm taking you to ${em(gr(tg))}`) + (eta ? " " + eta : "") + ".";
  }
  if (tg != null) return t(`Sono acceso: ${em(gr(tg))}.`, `I'm on: ${em(gr(tg))}.`);
  return t(`Sono ${em("acceso")}.`, `I'm ${em("on")}.`);
}
const passo = id => +attr(id, "target_temp_step") || (unit(id) === "°F" ? 1 : .5);
const limiti = id => { const F = unit(id) === "°F" || attr(id, "temperature_unit") === "°F", lo = +attr(id, "min_temp"), hi = +attr(id, "max_temp");
  return [isNaN(lo) ? (F ? 45 : 7) : lo, isNaN(hi) ? (F ? 95 : 35) : hi]; };
const conSpegni = id => (attr(id, "hvac_modes") || []).includes("off");
const modi = id => (attr(id, "hvac_modes") || []).filter(x => x !== "heat_cool" || !attr(id, "hvac_modes").includes("auto"));
const ICO_M = { off: "⏻", heat: "🔥", cool: "❄️", auto: "✨", heat_cool: "✨", dry: "💧", fan_only: "🌀" };
function disegnoGesto(id) {
  const tg = conSpegni(id) && ok(id);
  return `<div class="og1g ${tg ? "ges" : ""}" ${tg ? `data-og="clima:${esc(id)}" role="button" tabindex="0" aria-label="${esc(S[id].state === "off" ? t("Accendi", "Turn on") : t("Spegni", "Turn off"))}"` : ""}>${vistaClima(id, "og1v md2")}</div>`;
}
registra("clima", {
  nome: () => t("Clima", "Climate"), icona: "🌡️", ordine: 40, pagina: "clima",
  elenco: () => climi(), esiste: id => !!S[id] && id.startsWith("climate."),
  titolo: id => nm(id), luogo: id => AREAS[areaOf(id)]?.name || "",
  stato: id => { if (!ok(id)) return "na"; if (S[id].state === "off") return "off"; const m = momentoClima(id); return m.rest ? "ok" : { heat: "heat", cool: "cool", dry: "dry" }[m.k] || "run"; },
  frase: fraseClima,
  semplice: id => { if (!ok(id)) return t("Non raggiungibile", "Unavailable"); const a = S[id].attributes, H = HVAC(), cur = a.current_temperature;
    const meta = a.temperature != null ? gr(a.temperature) : a.target_temp_low != null && a.target_temp_high != null ? gr(a.target_temp_low) + "–" + gr(a.target_temp_high) : "";
    return [H[S[id].state] || S[id].state, S[id].state === "off" ? (cur != null ? gr(cur) : "") : cur != null && meta ? gr(cur) + " → " + meta : meta || (cur != null ? gr(cur) : "")].filter(Boolean).join(" · "); },
  disegno: (id, m) => vistaClima(id, "og1v " + m),
  centro: id => {
    const a = S[id]?.attributes || {}, due = a.temperature == null && a.target_temp_low != null && a.target_temp_high != null;
    if (a.temperature == null && !due) return "";
    const [mn, mx] = limiti(id), k = S[id].state === "off" || !ok(id) ? "off" : momentoClima(id).k;
    return quadrante("clima:" + id, { min: mn, max: mx, step: passo(id), v: due ? +a.target_temp_low : +a.temperature, v2: due ? +a.target_temp_high : undefined, stanza: a.current_temperature != null ? +a.current_temperature : null,
      colore: COLORE[k] || COLORE.heat, off: S[id].state === "off" || !ok(id), spentoTxt: ok(id) ? t("Spento", "Off") : t("Non raggiungibile", "Unavailable"), dentro: disegnoGesto(id),
      nomi: { 1: due ? t("Minima", "Low") : t("Temperatura", "Temperature"), 2: t("Massima", "High") },
      sotto: a.current_temperature != null ? t("in stanza ", "in the room ") + gr(a.current_temperature) : "" });
  },
  imposta: (id, v, q, cur) => { const a = S[id].attributes;
    const d = a.temperature == null && a.target_temp_low != null ? { target_temp_low: cur.v, target_temp_high: cur.v2 } : { temperature: v };
    svc("climate", "set_temperature", d, { entity_id: id }).then(() => toast("🌡️ " + nm(id) + " · " + (d.temperature != null ? gr(d.temperature) : gr(d.target_temp_low) + " – " + gr(d.target_temp_high)))).catch(() => {}); },
  comandi: id => { const a = S[id].attributes, off = !ok(id), spento = S[id].state === "off", B = [];
    if (conSpegni(id)) B.push({ act: "cpower", id, ic: "⏻", txt: spento ? t("Accendi", "Turn on") : t("Spegni", "Turn off"), pri: spento, off, cls: spento ? "" : "bad" });
    if (a.temperature != null && !spento) B.push({ act: "ogClPasso", id, v: -1, ic: "−", txt: fnum(passo(id), passo(id) < 1 ? 1 : 0) + "°", off }, { act: "ogClPasso", id, v: 1, ic: "+", txt: fnum(passo(id), passo(id) < 1 ? 1 : 0) + "°", off });
    return B; },
  dati: id => { const a = S[id].attributes, h = umido(id), A = ACTION();
    return [a.current_temperature != null ? ["🌡️", t("in stanza ", "room ") + gr(a.current_temperature)] : null, h != null ? ["💧", Math.round(h) + "%"] : null,
      a.hvac_action && S[id].state !== "off" ? ["", esc(A[a.hvac_action] || a.hvac_action)] : null, a.fan_mode != null && S[id].state !== "off" ? ["🌀", esc(String(a.fan_mode).replace(/_/g, " "))] : null]; },
  extra: id => { const M = modi(id), m = S[id].state, H = HVAC(), F = attr(id, "fan_modes") || [], fm = attr(id, "fan_mode"), off = !ok(id);
    return `${M.length > 1 ? `<div class="fl1">${t("Modalità", "Mode")}</div><div class="og1md">${M.map(x => `<button class="${x === m ? "act" : ""} m-${x}" data-act="cmode" data-id="${id}" data-v="${x}" ${off ? "disabled" : ""}><i>${ICO_M[x] || "•"}</i>${esc(H[x] || x)}</button>`).join("")}</div>` : ""}
      ${F.length > 1 && m !== "off" ? `<div class="fl1">${t("Ventola", "Fan")}</div><div class="seg og1fn">${F.map(x => `<button class="${x === fm ? "act" : ""}" data-act="ogClFan" data-id="${id}" data-v="${esc(x)}" ${off ? "disabled" : ""}>${esc(String(x).replace(/_/g, " "))}</button>`).join("")}</div>` : ""}`; },
  gesti: id => conSpegni(id) && ok(id) ? { tocco: () => ACT.cpower({ dataset: { id } }),
    aiuto: S[id].attributes.temperature != null || S[id].attributes.target_temp_low != null ? t("Trascina il cerchio per cambiare la temperatura · tocca il disegno per accendere o spegnere", "Drag the ring to change the temperature · tap the drawing to turn it on or off") : t("Tocca il disegno per accendere o spegnere", "Tap the drawing to turn it on or off") } : {},
});
Object.assign(ACT, {
  ogClPasso: el => ACT.cstep({ dataset: { id: el.dataset.id, d: el.dataset.v } }),
  ogClFan: el => svc("climate", "set_fan_mode", { fan_mode: el.dataset.v }, { entity_id: el.dataset.id }),
});

const attivi = () => ents("climate", id => ok(id) && S[id].state !== "off").length;
/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("Termostati e condizionatori con la temperatura di ogni stanza, animati o con le tue immagini.", "Thermostats and air conditioners with each room's temperature, animated or with your own images."),
  serve: t("Un termostato o un climatizzatore in Home Assistant, oppure un sensore di temperatura.", "A thermostat or air conditioner in Home Assistant, or a temperature sensor."),
  passi: [t("Impostazioni → Dispositivi e servizi → ＋ Aggiungi integrazione: cerca la marca o il sistema del dispositivo e segui i passi.", "Settings → Devices & services → ＋ Add integration: search for the device's brand or system and follow the steps."), t("Ventilatori e umidificatori: Clima → ✏️ Modifica → ＋.", "Fans and humidifiers: Climate → ✏️ Edit → ＋.")],
  link: [[t("Aggiungi un'integrazione", "Add an integration"), myHA("integrations")]] };
page("clima", { richiede: RICHIEDE, title: t("Clima", "Climate"), short: t("Clima", "Climate"), icon: "🌡️", order: 20, editable: true, show: () => isAdmin() || ents("climate").length > 0 || ents("sensor", id => S[id].attributes.device_class === "temperature").length > 0, badge: () => attivi() > 0, render: pagina });

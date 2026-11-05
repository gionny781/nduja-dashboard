/* Auto: la pagina compare solo se in Home Assistant c'è un'auto (elettrica o ibrida plug-in) collegata
   con la sua integrazione (Tesla, BMW, Volkswagen, Kia/Hyundai, Renault, Polestar, Mercedes…).
   Tutto viene dal dispositivo dell'auto: batteria, autonomia, ricarica, clima, serrature, posizione e comandi.
   La foto è quella dell'integrazione; se non c'è, la cerco su Wikipedia con marca e modello. */
import { S, REG, DEVICES, ACT, CHG, LAYOUT, UI, STRIP, HOME_EXTRA, DEFAULT_OFF, t, LOC, esc, fnum, nm, ok, val, attr, unit, W, card, empty, page,
  svc, toast, go, isAdmin, shortName, deviceClass, km, ago, sGet, sSet, render, openSheet, closeSheet, sicuro } from "../core.js";
import { cambia, scegli } from "../edit.js";

/* integrazioni delle auto più diffuse (dominio della piattaforma) */
const PIATTAFORME = /^(tesla_fleet|teslemetry|tessie|tesla_custom|tesla|bmw_connected_drive|volkswagen_we_connect_id|volkswagencarnet|myskoda|skodaconnect|seatconnect|cupra_we_connect|audiconnect|kia_uvo|hyundai_kia_connect|renault|polestar|polestar_api|mbapi2020|mercedes_me|fordpass|ford|nissan_leaf|leaf|smartcar|volvo|volvooncall|toyota|mazda|subaru|porscheconnect|porsche|jlrincontrol|stellantis_vehicles|psa_car_controller|byd|saic_ismart|mg_saic|zeekr|ovms|weconnect|bmw|mini)$/;
const NON_AUTO = /^(mobile_app|ios|companion|ble_monitor|bluetooth|zha|mqtt_room|wallbox|easee|zaptec|ocpp|go_echarger|goecharger|openwb|evcc|myenergi|ohme|pod_point|tibber)$/;

const testo = id => (id + " " + (S[id]?.attributes?.friendly_name || "")).toLowerCase();
const re = (id, r) => r.test(testo(id));
const pct = id => unit(id) === "%";
const lunghezza = id => /^(km|mi|m)$/i.test(unit(id));

/* ---------- riconoscimento delle auto ---------- */
let memo = { k: "", L: [] };
function entitaDi(dev) { return Object.keys(S).filter(id => REG[id]?.device === dev && !REG[id]?.hidden); }
/** sensori trovati da soli (senza le correzioni dell'utente) */
function rilevati(dev) {
  const E = entitaDi(dev), sens = E.filter(x => x.startsWith("sensor.") && ok(x)), trova = (L, f) => L.find(f) || null;
  return {
    E,
    batt: trova(sens, x => pct(x) && (deviceClass(x) === "battery" || re(x, /battery_level|state_of_charge|\bsoc\b|_soc$|batteria|charge_level|battery_percent/)) && !re(x, /12v|aux|key|chiave|phone|tpms/)),
    range: trova(sens, x => lunghezza(x) && re(x, /range|autonomia|reichweite|remaining_distance|distance_to_empty|electric_range|est_battery/)),
    odo: trova(sens, x => lunghezza(x) && re(x, /odometer|mileage|odometro|chilometr|kilometerstand|total_distance/)),
    statoRic: trova(E, x => (x.startsWith("sensor.") && re(x, /charging_state|charge_state|charging_status|charger_state|stato_ricarica|charging$/)) || (x.startsWith("binary_sensor.") && deviceClass(x) === "battery_charging")),
    spina: trova(E, x => x.startsWith("binary_sensor.") && (deviceClass(x) === "plug" || re(x, /plug|cable|cavo|charge_port_connected|connected_charger|charger_connected/))),
    potenza: trova(sens, x => (deviceClass(x) === "power" || /^k?w$/i.test(unit(x))) && re(x, /charg|ricaric/)),
    fine: trova(sens, x => re(x, /time_to_full|minutes_to_full|time_to_charge|time_remaining|charging_end|charge_complete|fine_ricarica|remaining_charging/)),
    limite: trova(E, x => (x.startsWith("number.") || x.startsWith("sensor.")) && pct(x) && re(x, /charge_limit|target_soc|charge_target|soc_target|limit_soc|limite|max_soc|target_state_of_charge/)),
    ampere: trova(E, x => x.startsWith("number.") && re(x, /amps|current|corrente|ampere/)),
    tempIn: trova(sens, x => deviceClass(x) === "temperature" && re(x, /inside|interior|cabin|interno|innen/)),
    tempOut: trova(sens, x => deviceClass(x) === "temperature" && re(x, /outside|exterior|esterno|outdoor|aussen/)),
    gomme: sens.filter(x => (deviceClass(x) === "pressure" || /^(bar|psi|kpa)$/i.test(unit(x))) && re(x, /tire|tyre|pneum|reifen|tpms/)),
    pos: trova(E, x => x.startsWith("device_tracker.")),
    foto: trova(E, x => x.startsWith("image.") && ok(x)) || trova(E, x => !x.startsWith("camera.") && attr(x, "entity_picture") && !/\/api\/(camera_proxy|image_proxy)\/(?!image\.)/.test(attr(x, "entity_picture"))),
  };
}
/* sensori che l'utente può correggere in ✏️ (riconoscimento sbagliato o sensore di un'altra integrazione): [ruolo, nome, filtro] */
const isS = (x, d) => x.startsWith(d + ".");
const RUOLI = () => [
  ["batt", t("Batteria (%)", "Battery (%)"), x => isS(x, "sensor") && pct(x)],
  ["range", t("Autonomia", "Range"), x => isS(x, "sensor") && lunghezza(x)],
  ["odo", t("Chilometri percorsi", "Odometer"), x => isS(x, "sensor") && lunghezza(x)],
  ["statoRic", t("Stato della ricarica", "Charging state"), x => isS(x, "sensor") || isS(x, "binary_sensor")],
  ["spina", t("Cavo collegato", "Cable plugged in"), x => isS(x, "binary_sensor")],
  ["potenza", t("Potenza di ricarica", "Charging power"), x => isS(x, "sensor") && (deviceClass(x) === "power" || /^k?w$/i.test(unit(x)))],
  ["fine", t("Tempo alla carica completa", "Time to full charge"), x => isS(x, "sensor")],
  ["limite", t("Limite di carica (%)", "Charge limit (%)"), x => (isS(x, "number") || isS(x, "sensor")) && pct(x)],
  ["ampere", t("Corrente di ricarica", "Charging current"), x => isS(x, "number")],
  ["tempIn", t("Temperatura abitacolo", "Cabin temperature"), x => isS(x, "sensor") && (deviceClass(x) === "temperature" || /°/.test(unit(x)))],
  ["tempOut", t("Temperatura esterna", "Outside temperature"), x => isS(x, "sensor") && (deviceClass(x) === "temperature" || /°/.test(unit(x)))],
  ["pos", t("Posizione", "Location"), x => isS(x, "device_tracker")],
];
/** sensori dell'auto: quelli trovati da soli, corretti da quelli scelti in ✏️ («none» = nessuno) */
function ruoli(dev) {
  const r = rilevati(dev), sc = LAYOUT.cars?.[dev]?.sensori || {};
  for (const [k] of RUOLI()) if (sc[k] === "none") r[k] = null; else if (sc[k] && S[sc[k]]) r[k] = sc[k];
  return r;
}
function eAuto(dev) {
  const D = DEVICES[dev]; if (!D || D.disabled) return false;
  const E = entitaDi(dev); if (!E.length) return false;
  const pl = E.map(x => REG[x]?.platform).find(Boolean) || "";
  if (NON_AUTO.test(pl) || E.some(x => x.startsWith("vacuum.") || x.startsWith("lawn_mower."))) return false;
  const r = ruoli(dev);
  if (PIATTAFORME.test(pl)) return !!(r.batt || r.range || r.odo || r.pos || E.some(x => x.startsWith("lock.")));
  return !!((r.batt && (r.range || r.odo)) || (r.range && r.pos) || (r.batt && r.statoRic && r.pos));
}
/** dispositivi delle auto (id del dispositivo), in ordine di nome */
export function auto() {
  const k = Object.keys(S).length + ":" + Object.keys(DEVICES).length + ":" + JSON.stringify(LAYOUT.cars || {});
  if (memo.k === k) return memo.L;
  const H = LAYOUT.cars?._hide || [], agg = (LAYOUT.cars?._add || []).filter(d => DEVICES[d] && !DEVICES[d].disabled);
  const L = [...new Set([...Object.keys(DEVICES).filter(eAuto), ...agg])].filter(d => !H.includes(d)).sort((a, b) => nomeAuto(a).localeCompare(nomeAuto(b), LOC));
  memo = { k, L };
  return L;
}
const conf = d => LAYOUT.cars?.[d] || {};
const nomeAuto = d => conf(d).nome || DEVICES[d]?.name || t("Auto", "Car");
const modello = d => [DEVICES[d]?.maker, DEVICES[d]?.model].filter(Boolean).join(" ");
/** batteria bassa (rossa) sotto questa %, arancione sotto il doppio: si sceglie in ✏️ (15 se non scegli) */
const basso = d => { const v = +conf(d).basso; return v > 0 && v < 100 ? v : 15; };
const coloreBatt = (d, b) => b == null ? "var(--tx3)" : b < basso(d) ? "var(--red)" : b < Math.min(100, basso(d) * 2) ? "var(--orange)" : "var(--green)";

/* i comandi dell'auto non finiscono nelle altre pagine (clima, prese, sicurezza…) */
const AUTO_DEV = () => new Set(auto());
DEFAULT_OFF.push(id => { const d = REG[id]?.device; return !!d && AUTO_DEV().has(d); });

/* ---------- foto ---------- */
const WIKI = {};
function fotoWiki(d) {
  const q = modello(d) || DEVICES[d]?.name; if (!q) return null;
  const key = "carimg_" + q.toLowerCase().replace(/\s+/g, "_");
  const c = sGet(key); if (c) { try { const o = JSON.parse(c); if (Date.now() - o.ts < 30 * 864e5) return o.url || null; } catch {} }
  if (WIKI[key]) return null;
  WIKI[key] = true;
  /* marca + modello; se non trovo niente provo con meno parole («BMW i4 eDrive40» → «BMW i4») */
  const parole = q.split(/\s+/), prove = [...new Set([q, parole.slice(0, 2).join(" "), parole.slice(0, 3).join(" ")])];
  const cerca = async (lang, qq) => {
    const r = await fetch(`https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(qq)}&limit=1`).then(r => r.json());
    const p = r?.pages?.[0]; if (!p) return null;
    const s = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.key)}`).then(r => r.json()).catch(() => null);
    const u = s?.thumbnail?.source || s?.originalimage?.source || (p.thumbnail?.url ? (p.thumbnail.url.startsWith("//") ? "https:" + p.thumbnail.url : p.thumbnail.url) : null);
    return u ? u.replace(/\/\d+px-/, "/640px-") : null;
  };
  (async () => { let u = null;
    for (const lang of [...new Set([LOC.startsWith("it") ? "it" : "en", "en"])]) for (const qq of prove) { if (u) break; try { u = await cerca(lang, qq); } catch {} }
    sSet(key, JSON.stringify({ url: u, ts: Date.now() })); if (u) render(); })();
  return null;
}
function foto(d, r) {
  const c = conf(d).foto;
  if (c === "none") return null;
  if (c && c !== "auto") return c;
  if (r.foto) return attr(r.foto, "entity_picture");
  return conf(d).noWeb ? null : fotoWiki(d);
}
const fotoHtml = (d, r, cls) => { const u = foto(d, r); return u ? `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} none',textContent:'🚗'}))">` : `<span class="${cls} none">🚗</span>`; };

/* ---------- stato ---------- */
const STATI = () => ({ charging: t("In ricarica", "Charging"), complete: t("Ricarica completata", "Charge complete"), stopped: t("Ricarica ferma", "Charging stopped"), disconnected: t("Non collegata", "Unplugged"),
  starting: t("Avvio ricarica", "Starting"), no_power: t("Senza corrente", "No power"), nopower: t("Senza corrente", "No power"), connected: t("Collegata", "Plugged in"), not_charging: t("Non in ricarica", "Not charging"), fully_charged: t("Carica", "Fully charged") });
function inRicarica(r) { const s = r.statoRic; if (!s) return r.potenza ? (val(r.potenza) || 0) > 0 : false; return s.startsWith("binary_sensor.") ? S[s].state === "on" : /^charging$|^in_carica$|^started$/i.test(S[s].state); }
function statoRicarica(r) { const s = r.statoRic; if (!s || !ok(s)) return null; if (s.startsWith("binary_sensor.")) return S[s].state === "on" ? STATI().charging : null; const v = String(S[s].state).toLowerCase(); return STATI()[v] || S[s].state; }
function dove(r) {
  const p = r.pos; if (!p || !ok(p)) return null;
  const st = S[p].state, z = st === "home" ? t("A casa", "Home") : st === "not_home" ? t("Fuori", "Away") : (S["zone." + st]?.attributes?.friendly_name || st);
  const la = attr(p, "latitude"), lo = attr(p, "longitude"), dist = st !== "home" && la != null ? km(la, lo, attr("zone.home", "latitude"), attr("zone.home", "longitude")) : null;
  return { z, dist, la, lo, home: st === "home" };
}
/** ricarica di un'auto per la pagina Energia: { id (sensore da aprire), nome, b (%), w (W), ric, spina, casa (true a casa, false fuori, null se non si sa) } */
export function ricarica(d) {
  const r = ruoli(d), p = dove(r);
  return { id: r.potenza || r.batt || null, nome: nomeAuto(d), b: r.batt ? val(r.batt) : null, ric: inRicarica(r), w: r.potenza && ok(r.potenza) ? W(r.potenza) : null,
    spina: r.spina && ok(r.spina) ? S[r.spina].state === "on" : null, casa: p ? p.home : null };
}
const minuti = id => { const v = val(id), u = unit(id).toLowerCase(); if (v == null) { const d = Date.parse(S[id]?.state); return isNaN(d) ? null : Math.max(0, Math.round((d - Date.now()) / 60000)); } return u.startsWith("h") ? v * 60 : u.startsWith("s") ? v / 60 : v; };
const durata = m => m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}` : `${Math.round(m)} min`;
const valU = (id, d = 0) => id && ok(id) ? `${fnum(val(id) ?? S[id].state, d)}<small> ${esc(unit(id))}</small>` : "—";

/* ---------- comandi ---------- */
function comandi(r, d, tutti = false) {
  const E = r.E, dom = d => E.filter(x => x.startsWith(d + ".") && S[x] && REG[x]?.cat == null);
  const usati = new Set([r.limite, r.ampere].filter(Boolean));
  const ricSw = dom("switch").find(x => re(x, /charg|ricaric/) && !re(x, /port|sportell|schedule|programm|scheduled/)) || null;
  const ricStart = dom("button").find(x => re(x, /start_charg|charge_start|avvia_ricarica|charging_start/)), ricStop = dom("button").find(x => re(x, /stop_charg|charge_stop|ferma_ricarica|charging_stop/));
  [ricSw, ricStart, ricStop].forEach(x => x && usati.add(x));
  const serr = dom("lock"); serr.forEach(x => usati.add(x));
  const clima = dom("climate")[0] || null; clima && usati.add(clima);
  const cop = dom("cover"); cop.forEach(x => usati.add(x));
  /* «Altri comandi»: quelli tolti in ✏️ non compaiono (tutti=true per l'elenco in ✏️) */
  const via = new Set(tutti || !d ? [] : conf(d).nascondi || []), qui = x => !via.has(x);
  return { ricSw, ricStart, ricStop, serr, clima, cop,
    btn: dom("button").filter(x => !usati.has(x) && !re(x, /wake|sveglia|refresh|aggiorna|update|reload|force/)).filter(qui),
    sw: dom("switch").filter(x => !usati.has(x)).filter(qui), sel: dom("select").filter(qui), num: dom("number").filter(x => !usati.has(x)).filter(qui), wake: dom("button").find(x => re(x, /wake|sveglia/)) || null };
}
const nomeBreve = (id, d) => shortName(id).replace(new RegExp("^" + nomeAuto(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "") || shortName(id);

/* ---------- scheda dell'auto ---------- */
function batteria(r, d) {
  const b = r.batt ? val(r.batt) : null, lim = r.limite && ok(r.limite) ? val(r.limite) : null, ric = inRicarica(r);
  const col = coloreBatt(d, b);
  return `<div class="car-b">
    <div class="car-bn"><b>${b != null ? Math.round(b) : "—"}<small>%</small></b>${r.range ? `<span>${valU(r.range)}</span>` : ""}${ric ? `<em>⚡ ${t("in ricarica", "charging")}</em>` : ""}</div>
    <div class="car-bar"><i style="width:${Math.max(2, b || 0)}%;background:${col}" class="${ric ? "anim" : ""}"></i>${lim != null ? `<u style="left:${lim}%" title="${t("Limite", "Limit")} ${Math.round(lim)}%"></u>` : ""}</div>
  </div>`;
}
function scheda(d) {
  const r = ruoli(d), c = comandi(r, d), pos = dove(r), ric = inRicarica(r), sr = statoRicarica(r);
  const serrata = c.serr.length ? c.serr.every(x => S[x].state === "locked") : null;
  const climaOn = c.clima && ok(c.clima) && S[c.clima].state !== "off";
  const chip = (ic, txt) => `<span class="vb1">${ic} ${txt}</span>`;
  const big = (act, id, ic, n, on, cls = "") => `<button class="car-c ${on ? "on" : ""} ${cls}" data-act="${act}" data-id="${id}">${ic}<span>${n}</span></button>`;
  const info = [
    r.odo && [t("Chilometri", "Odometer"), valU(r.odo)],
    r.tempIn && [t("Abitacolo", "Cabin"), valU(r.tempIn, 1)],
    r.tempOut && [t("Fuori", "Outside"), valU(r.tempOut, 1)],
    r.potenza && ok(r.potenza) && ric && [t("Potenza", "Power"), valU(r.potenza, 1)],
    r.fine && ok(r.fine) && ric && [t("Carica tra", "Full in"), durata(minuti(r.fine))],
  ].filter(Boolean);
  return `<section class="card span3 car1">
    <div class="ch"><h2>🚗 ${esc(nomeAuto(d))}</h2>${modello(d) && modello(d) !== nomeAuto(d) ? `<span class="muted small">${esc(modello(d))}</span>` : ""}<span class="grow"></span>
      ${c.wake ? `<button class="btn sm" data-act="carPress" data-id="${c.wake}" title="${t("Sveglia l'auto per aggiornare i dati", "Wake the car to refresh")}">⏰</button>` : ""}${isAdmin() ? `<button class="btn sm" data-act="carEdit" data-id="${d}">✏️</button>` : ""}</div>
    <div class="car-g">
      <div class="car-ph">${fotoHtml(d, r, "car-img")}</div>
      <div>
        ${batteria(r, d)}
        <div class="row" style="gap:8px;flex-wrap:wrap;margin:12px 0">
          ${sr ? chip(ric ? "⚡" : "🔌", esc(sr)) : r.spina && ok(r.spina) ? chip("🔌", S[r.spina].state === "on" ? t("Collegata", "Plugged in") : t("Non collegata", "Unplugged")) : ""}
          ${pos ? chip(pos.home ? "🏠" : "📍", esc(pos.z) + (pos.dist != null ? ` · ${fnum(pos.dist, pos.dist < 10 ? 1 : 0)} km` : "")) : ""}
          ${serrata != null ? chip(serrata ? "🔒" : "🔓", serrata ? t("Chiusa", "Locked") : t("Aperta", "Unlocked")) : ""}
          ${climaOn ? chip("❄️", t("Clima acceso", "Climate on") + (attr(c.clima, "temperature") != null ? ` · ${fnum(attr(c.clima, "temperature"), 1)}°` : "")) : ""}
        </div>
        <div class="car-cs">
          ${c.serr.length ? big("carLock", c.serr.join(","), serrata ? "🔓" : "🔒", serrata ? t("Apri", "Unlock") : t("Chiudi", "Lock"), !serrata, serrata ? "warn" : "") : ""}
          ${c.clima ? big("carClima", c.clima, "❄️", climaOn ? t("Spegni clima", "Climate off") : t("Accendi clima", "Climate on"), climaOn) : ""}
          ${c.ricSw ? big("carToggle", c.ricSw, "⚡", S[c.ricSw].state === "on" ? t("Ferma ricarica", "Stop charging") : t("Avvia ricarica", "Start charging"), S[c.ricSw].state === "on")
            : c.ricStart || c.ricStop ? big("carPress", ric ? (c.ricStop || c.ricStart) : (c.ricStart || c.ricStop), "⚡", ric ? t("Ferma ricarica", "Stop charging") : t("Avvia ricarica", "Start charging"), ric) : ""}
          ${c.cop.map(x => big("carCover", x, /trunk|baule|bagagli|tailgate|portellone/i.test(testo(x)) ? "🧳" : /frunk|anterior/i.test(testo(x)) ? "🧰" : /window|finestr/i.test(testo(x)) ? "🪟" : /port|sportell/i.test(testo(x)) ? "🔌" : "🚪", esc(nomeBreve(x, d)) + `<small>${S[x].state === "open" ? t("aperto", "open") : S[x].state === "closed" ? t("chiuso", "closed") : esc(S[x].state)}</small>`, S[x].state === "open")).join("")}
        </div>
        ${c.clima && climaOn && attr(c.clima, "temperature") != null ? `<div class="row car-t" style="gap:8px;margin-top:10px"><span class="muted small">${t("Temperatura clima", "Climate temperature")}</span><span class="grow"></span>
          <button class="btn sm" data-act="carTemp" data-id="${c.clima}" data-v="-0.5">−</button><b>${fnum(attr(c.clima, "temperature"), 1)}°</b><button class="btn sm" data-act="carTemp" data-id="${c.clima}" data-v="0.5">＋</button></div>` : ""}
        ${[r.limite, r.ampere].filter(x => x && x.startsWith("number.") && ok(x)).map(x => `<label class="fld1 car-n"><span>${esc(nomeBreve(x, d))} <b>${fnum(val(x), 0)} ${esc(unit(x))}</b></span>
          <input type="range" min="${attr(x, "min") ?? 0}" max="${attr(x, "max") ?? 100}" step="${attr(x, "step") ?? 1}" value="${val(x)}" data-chg="carNum" data-id="${x}"></label>`).join("")}
      </div>
    </div>
    ${info.length || r.gomme.length ? `<div class="car-i">${info.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("")}
      ${r.gomme.length ? `<div class="car-gm"><small>${t("Gomme", "Tyres")}</small><b>${r.gomme.slice(0, 4).map(x => `<span title="${esc(shortName(x))}">${ok(x) ? fnum(val(x), 1) : "—"}</span>`).join("")}<small> ${esc(unit(r.gomme[0]))}</small></b></div>` : ""}</div>` : ""}
    ${c.btn.length || c.sw.length || c.sel.length || c.num.length ? `<details class="car-x"><summary>${t("Altri comandi", "More controls")} <small>${c.btn.length + c.sw.length + c.sel.length + c.num.length}</small></summary>
      <div class="car-xg">
        ${c.btn.map(x => `<button class="btn" data-act="carPress" data-id="${x}">▶ ${esc(nomeBreve(x, d))}</button>`).join("")}
        ${c.sw.map(x => `<button class="btn ${S[x].state === "on" ? "pri" : ""}" data-act="carToggle" data-id="${x}">${S[x].state === "on" ? "●" : "○"} ${esc(nomeBreve(x, d))}</button>`).join("")}
      </div>
      ${c.sel.map(x => `<label class="fld1"><span>${esc(nomeBreve(x, d))}</span><select data-chg="carSel" data-id="${x}">${(attr(x, "options") || []).map(o => `<option value="${esc(o)}" ${S[x].state === o ? "selected" : ""}>${esc(String(o).replace(/_/g, " "))}</option>`).join("")}</select></label>`).join("")}
      ${c.num.filter(ok).map(x => `<label class="fld1 car-n"><span>${esc(nomeBreve(x, d))} <b>${fnum(val(x), 0)} ${esc(unit(x))}</b></span><input type="range" min="${attr(x, "min") ?? 0}" max="${attr(x, "max") ?? 100}" step="${attr(x, "step") ?? 1}" value="${val(x)}" data-chg="carNum" data-id="${x}"></label>`).join("")}
    </details>` : ""}
    ${pos && pos.la != null ? `<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm" data-act="more" data-id="${r.pos}">📍 ${t("Dov'è", "Where is it")}</button>
      <a class="btn sm" href="https://www.openstreetmap.org/?mlat=${pos.la}&mlon=${pos.lo}#map=17/${pos.la}/${pos.lo}" target="_blank" rel="noopener">🗺️ ${t("Apri la mappa", "Open map")}</a>
      ${r.batt && S[r.batt].last_updated ? `<span class="small muted" style="margin-left:auto">${t("Aggiornata", "Updated")} ${esc(ago(S[r.batt].last_updated))}</span>` : ""}</div>` : ""}
  </section>`;
}

/* ✏️ auto: nome, foto, nascondi */
function config(d) {
  const r = ruoli(d), c = conf(d), f = c.foto || "auto";
  return `<div class="sh-head"><div><h3>✏️ ${esc(nomeAuto(d))}</h3><div class="small muted">${esc(modello(d))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="car1n" type="text" value="${esc(c.nome || "")}" placeholder="${esc(DEVICES[d]?.name || "")}"></label>
    <div class="fl1">${t("Foto", "Photo")}</div>
    <div class="seg" style="flex-wrap:wrap">${[["auto", "✨ " + t("Automatica", "Automatic")], ["url", "🔗 " + t("Da un indirizzo", "From a link")], ["none", "🚫 " + t("Nessuna", "None")]].map(([k, n]) => `<button class="${(f === k || (k === "url" && !["auto", "none"].includes(f))) ? "act" : ""}" data-act="carFoto" data-id="${d}" data-v="${k}">${n}</button>`).join("")}</div>
    <p class="small muted" style="margin-top:6px">${r.foto ? t("Uso la foto che dà l'integrazione dell'auto.", "I use the picture provided by the car integration.") : t("L'integrazione non ha una foto: la cerco su Wikipedia con marca e modello.", "The integration has no picture: I look it up on Wikipedia by make and model.")}</p>
    ${!["auto", "none"].includes(f) ? `<label class="fld1"><span>${t("Indirizzo della foto", "Photo link")}</span><input id="car1u" type="url" value="${esc(f === "url" ? "" : f)}" placeholder="https://…"></label>` : ""}
    ${f === "auto" && !r.foto ? `<label class="row" style="gap:8px;margin-top:8px"><input id="car1w" type="checkbox" ${c.noWeb ? "" : "checked"}> ${t("Cerca la foto su internet (Wikipedia)", "Look up the photo online (Wikipedia)")}</label>` : ""}
    <details class="car-x" ${c.sensori ? "open" : ""}><summary>${t("Sensori", "Sensors")} <small>${Object.keys(c.sensori || {}).length ? t("corretti da te", "corrected by you") : t("trovati da soli", "found automatically")}</small></summary>
    <p class="small muted" style="margin:8px 0 6px">${t("Li trovo da soli tra quelli dell'auto. Se uno è sbagliato o manca, toccalo e scegli quello giusto (anche di un'altra integrazione).", "I find them by myself among the car's entities. If one is wrong or missing, tap it and choose the right one (even from another integration).")}</p>
    <div class="stack">${RUOLI().map(([k, n]) => { const sc = c.sensori?.[k], id = r[k];
      return `<button class="li" data-act="carRuolo" data-id="${d}" data-k="${k}"><div class="tx"><b>${esc(n)}</b><span>${sc === "none" ? "🚫 " + t("nessuno", "none") : id ? (sc ? "✋ " : "✨ ") + esc(nm(id)) : "✨ " + t("non trovato", "not found")}</span></div>
        <span class="st">${id && ok(id) ? esc(valoreBreve(id)) : "›"}</span></button>`; }).join("")}</div></details>
    <div class="fl1">${t("Batteria", "Battery")}</div>
    <label class="fld1"><span>${t("Batteria bassa sotto (%)", "Low battery below (%)")}</span><input id="car1b" type="number" min="1" max="99" value="${basso(d)}"></label>
    <p class="small muted" style="margin:4px 0 0">${t("Sotto questo valore la barra diventa rossa, sotto il doppio arancione.", "Below this value the bar turns red, below twice the value orange.")}${r.batt && val(r.batt) != null ? ` <b>${t("Adesso", "Now")}: ${Math.round(val(r.batt))}%</b>` : ""}</p>
    <label class="row" style="gap:8px;margin-top:10px"><input id="car1p" type="checkbox" ${pillola(d) ? "checked" : ""}> 🚗 ${t("Mostra la batteria in alto, accanto al meteo", "Show the battery at the top, next to the weather")}</label>
    ${(() => { const T = comandi(r, d, true), L = [...T.btn, ...T.sw, ...T.sel, ...T.num]; if (!L.length) return "";
      return `<div class="fl1">${t("Altri comandi", "More controls")}</div><p class="small muted" style="margin:0 0 6px">${t("Togli il segno a quelli che non usi: spariscono da «Altri comandi».", "Untick the ones you don't use: they disappear from «More controls».")}</p>
        <div class="stack">${L.map(x => `<label class="row" style="gap:8px"><input type="checkbox" data-chg="carCmd" data-id="${d}" data-e="${x}" ${(c.nascondi || []).includes(x) ? "" : "checked"}> ${esc(nomeBreve(x, d))}</label>`).join("")}</div>`; })()}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="carSave" data-id="${d}">💾 ${t("Salva", "Save")}</button>
      <button class="btn bad" data-act="carHide" data-id="${d}">🙈 ${t("Non è un'auto: nascondi", "Not a car: hide")}</button></div>`;
}
/** valore di un sensore in una riga di ✏️ (orari come «14:45», testi lunghi accorciati) */
const valoreBreve = id => { const v = String(S[id].state);
  if (deviceClass(id) === "timestamp" && !isNaN(Date.parse(v))) return new Date(v).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
  return (v.length > 16 ? v.slice(0, 16) + "…" : v) + (unit(id) ? " " + unit(id) : ""); };
/** pillola in alto: scelta in ✏️; se non scegli, c'è solo quando l'auto è una */
const pillola = d => conf(d).pillola ?? auto().length === 1;
const carSet = (d, fn) => cambia(l => { l.cars = JSON.parse(JSON.stringify(l.cars || {})); l.cars[d] = { ...(l.cars[d] || {}) }; fn(l.cars[d], l.cars); });

Object.assign(ACT, {
  carLock: el => { const ids = el.dataset.id.split(","), aperta = ids.every(x => S[x].state === "locked");
    if (aperta && !sicuro(el, t("Tocca ancora per aprire", "Tap again to unlock"))) return;
    svc("lock", aperta ? "unlock" : "lock", {}, { entity_id: ids }).then(() => toast(aperta ? "🔓 " + t("Apro l'auto", "Unlocking") : "🔒 " + t("Chiudo l'auto", "Locking"))); },
  carClima: el => { const id = el.dataset.id; svc("climate", S[id].state === "off" ? "turn_on" : "turn_off", {}, { entity_id: id }); },
  carTemp: el => { const id = el.dataset.id, v = (+attr(id, "temperature") || 20) + +el.dataset.v; svc("climate", "set_temperature", { temperature: Math.round(v * 2) / 2 }, { entity_id: id }); },
  carToggle: el => svc("switch", "toggle", {}, { entity_id: el.dataset.id }),
  carPress: el => svc("button", "press", {}, { entity_id: el.dataset.id }).then(() => toast("✓ " + shortName(el.dataset.id))),
  carCover: el => { const id = el.dataset.id, ap = S[id].state === "open";
    if (!ap && !sicuro(el, t("Tocca ancora", "Tap again"))) return;
    svc("cover", ap ? "close_cover" : "open_cover", {}, { entity_id: id }); },
  carEdit: el => { const d = el.dataset.id; openSheet(() => config(d)); },
  carFoto: el => { const d = el.dataset.id, v = el.dataset.v; carSet(d, c => { c.foto = v === "url" ? "url" : v; }); },
  carSave: el => { const d = el.dataset.id, n = document.getElementById("car1n")?.value.trim(), u = document.getElementById("car1u")?.value.trim(), w = document.getElementById("car1w");
    const b = Math.round(+document.getElementById("car1b")?.value), p = document.getElementById("car1p")?.checked, pDef = auto().length === 1;
    closeSheet(); carSet(d, c => { c.nome = n || undefined; if (u) c.foto = u; else if (c.foto === "url") c.foto = "auto"; if (w) c.noWeb = !w.checked;
      if (b > 0 && b < 100 && b !== 15) c.basso = b; else delete c.basso;
      if (p === pDef) delete c.pillola; else c.pillola = p; }); },
  carHide: el => { const d = el.dataset.id; closeSheet(); carSet(d, (c, all) => { all._hide = [...new Set([...(all._hide || []), d])]; all._add = (all._add || []).filter(x => x !== d); }); },
  carShow: el => { const d = el.dataset.id; cambia(l => { l.cars = { ...(l.cars || {}), _hide: (l.cars?._hide || []).filter(x => x !== d) }; }, "👁 " + nomeAuto(d)); },
  carAdd: () => scegli({ titolo: "＋ " + t("Aggiungi un'auto", "Add a car"), sotto: t("Scegli un sensore dell'auto (per esempio la batteria): aggiungo tutto il suo dispositivo.", "Choose one of the car's sensors (for example the battery): I add its whole device."),
    auto: false, filtro: x => { const d = REG[x]?.device; return !!d && !!DEVICES[d] && !auto().includes(d) && /^(sensor|binary_sensor|device_tracker|lock|climate)\./.test(x); },
    onPick: x => { const d = REG[x]?.device; if (!d) return;
      cambia(l => { const c = { ...(l.cars || {}) }; c._add = [...new Set([...(c._add || []), d])]; c._hide = (c._hide || []).filter(y => y !== d); l.cars = c; }, "＋ " + (DEVICES[d]?.name || t("Auto", "Car"))); } }),
  carRuolo: el => { const d = el.dataset.id, k = el.dataset.k, R = RUOLI().find(x => x[0] === k), det = rilevati(d)[k], sc = conf(d).sensori?.[k];
    scegli({ titolo: R[1], sotto: esc(nomeAuto(d)), filtro: R[2], attuale: sc || "", auto: det || "", nessuno: true,
      onPick: id => carSet(d, c => { const s = { ...(c.sensori || {}) }; if (id) s[k] = id; else delete s[k]; c.sensori = s; if (!Object.keys(s).length) delete c.sensori; }).then(() => openSheet(() => config(d))) }); },
  goAuto: () => go("auto"),
});
CHG.carCmd = el => { const d = el.dataset.id, x = el.dataset.e, via = !el.checked;
  carSet(d, c => { const n = new Set(c.nascondi || []); via ? n.add(x) : n.delete(x); c.nascondi = [...n]; if (!c.nascondi.length) delete c.nascondi; }); };
CHG.carNum = el => svc("number", "set_value", { value: +el.value }, { entity_id: el.dataset.id });
CHG.carSel = el => svc("select", "select_option", { option: el.value }, { entity_id: el.dataset.id });

/* ---------- pagina, scheda nella Home e pillola in alto ---------- */
function pagina() {
  const L = auto(), H = (LAYOUT.cars?._hide || []).filter(d => DEVICES[d]);
  return `<div class="g g3">${L.map(scheda).join("") || card("🚗 " + t("Auto", "Car"), empty(t("Nessuna auto collegata a Home Assistant.", "No car connected to Home Assistant.")), { cls: "span3" })}
    ${isAdmin() ? `<section class="card span3"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="add1" data-act="carAdd" style="flex:1"><span>＋</span>${t("Aggiungi un'auto che non ho riconosciuto", "Add a car I didn't recognise")}</button></div>
      ${H.length ? `<div class="fl1">🙈 ${t("Nascoste (non sono auto)", "Hidden (not cars)")}</div><div class="row" style="gap:8px;flex-wrap:wrap">${H.map(d => `<button class="btn sm" data-act="carShow" data-id="${d}">↩︎ ${esc(nomeAuto(d))}</button>`).join("")}</div>` : ""}</section>` : ""}</div>`;
}
function homeCard() {
  const L = auto(); if (!L.length) return "";
  return card("🚗 " + t("Auto", "Car"), `<div class="stack">${L.map(d => { const r = ruoli(d), b = r.batt ? val(r.batt) : null, ric = inRicarica(r), pos = dove(r);
    return `<button class="car-h" data-act="goAuto">${fotoHtml(d, r, "car-hi")}<div class="tx"><b>${esc(nomeAuto(d))}</b>
      <span>${b != null ? `🔋 ${Math.round(b)}%` : ""}${r.range && ok(r.range) ? ` · ${fnum(val(r.range), 0)} ${esc(unit(r.range))}` : ""}${ric ? " · ⚡" : ""}${pos ? ` · ${esc(pos.z)}` : ""}</span>
      ${b != null ? `<span class="bar1"><i style="width:${Math.max(2, b)}%;background:${coloreBatt(d, b)}"></i></span>` : ""}</div><span class="st">›</span></button>`; }).join("")}</div>`);
}
HOME_EXTRA.auto = { title: () => t("Auto", "Car"), render: homeCard, show: () => auto().length > 0 };
STRIP.push(() => auto().filter(pillola).map(d => {
  const r = ruoli(d), b = r.batt ? val(r.batt) : null; if (b == null) return "";
  return `<span class="pillv" data-act="go" data-id="auto" title="${esc(nomeAuto(d))}">🚗 ${Math.round(b)}%${inRicarica(r) ? " ⚡" : ""}</span>`;
}).join(""));
/* la pagina c'è se c'è un'auto; per l'amministratore anche quando ha nascosto tutte quelle trovate (per poterle rimettere) */
page("auto", { title: t("Auto", "Car"), short: "Auto", icon: "🚗", order: 33, show: () => auto().length > 0 || (isAdmin() && (LAYOUT.cars?._hide || []).some(d => DEVICES[d])), badge: () => auto().some(d => inRicarica(ruoli(d))), render: pagina });

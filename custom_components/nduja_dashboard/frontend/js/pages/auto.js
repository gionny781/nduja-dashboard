/* Auto: la pagina compare solo se in Home Assistant c'è un'auto (elettrica o ibrida plug-in) collegata
   con la sua integrazione (Tesla, BMW, Volkswagen, Kia/Hyundai, Renault, Polestar, Mercedes…).
   Tutto viene dal dispositivo dell'auto: batteria, autonomia, ricarica, clima, serrature, posizione e comandi.
   La foto è quella dell'integrazione; se non c'è, la cerco su Wikipedia con marca e modello. */
import { S, REG, DEVICES, ACT, CHG, LAYOUT, UI, STRIP, HOME_EXTRA, DEFAULT_OFF, t, LOC, esc, fnum, nm, ok, val, attr, unit, card, empty, page,
  svc, toast, go, isAdmin, shortName, deviceClass, km, ago, sGet, sSet, render, openSheet, closeSheet } from "../core.js";
import { cambia } from "../edit.js";

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
function ruoli(dev) {
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
  const k = Object.keys(S).length + ":" + Object.keys(DEVICES).length + ":" + (LAYOUT.cars?._hide || []).join(",");
  if (memo.k === k) return memo.L;
  const L = Object.keys(DEVICES).filter(eAuto).filter(d => !(LAYOUT.cars?._hide || []).includes(d)).sort((a, b) => nomeAuto(a).localeCompare(nomeAuto(b), LOC));
  memo = { k, L };
  return L;
}
const conf = d => LAYOUT.cars?.[d] || {};
const nomeAuto = d => conf(d).nome || DEVICES[d]?.name || t("Auto", "Car");
const modello = d => [DEVICES[d]?.maker, DEVICES[d]?.model].filter(Boolean).join(" ");

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
const minuti = id => { const v = val(id), u = unit(id).toLowerCase(); if (v == null) { const d = Date.parse(S[id]?.state); return isNaN(d) ? null : Math.max(0, Math.round((d - Date.now()) / 60000)); } return u.startsWith("h") ? v * 60 : u.startsWith("s") ? v / 60 : v; };
const durata = m => m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}` : `${Math.round(m)} min`;
const valU = (id, d = 0) => id && ok(id) ? `${fnum(val(id) ?? S[id].state, d)}<small> ${esc(unit(id))}</small>` : "—";

/* ---------- comandi ---------- */
function comandi(r) {
  const E = r.E, dom = d => E.filter(x => x.startsWith(d + ".") && S[x] && REG[x]?.cat == null);
  const usati = new Set([r.limite, r.ampere].filter(Boolean));
  const ricSw = dom("switch").find(x => re(x, /charg|ricaric/) && !re(x, /port|sportell|schedule|programm|scheduled/)) || null;
  const ricStart = dom("button").find(x => re(x, /start_charg|charge_start|avvia_ricarica|charging_start/)), ricStop = dom("button").find(x => re(x, /stop_charg|charge_stop|ferma_ricarica|charging_stop/));
  [ricSw, ricStart, ricStop].forEach(x => x && usati.add(x));
  const serr = dom("lock"); serr.forEach(x => usati.add(x));
  const clima = dom("climate")[0] || null; clima && usati.add(clima);
  const cop = dom("cover"); cop.forEach(x => usati.add(x));
  return { ricSw, ricStart, ricStop, serr, clima, cop,
    btn: dom("button").filter(x => !usati.has(x) && !re(x, /wake|sveglia|refresh|aggiorna|update|reload|force/)),
    sw: dom("switch").filter(x => !usati.has(x)), sel: dom("select"), num: dom("number").filter(x => !usati.has(x)), wake: dom("button").find(x => re(x, /wake|sveglia/)) || null };
}
const sicuro = (el, msg) => { if (el.dataset.sure === "1") return true; el.dataset.sure = "1"; const o = el.innerHTML; el.innerHTML = `⚠️<span>${esc(msg)}</span>`; el.classList.add("warn");
  setTimeout(() => { if (el.isConnected) { el.dataset.sure = ""; el.innerHTML = o; } }, 3500); return false; };
const nomeBreve = (id, d) => shortName(id).replace(new RegExp("^" + nomeAuto(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "") || shortName(id);

/* ---------- scheda dell'auto ---------- */
function batteria(r) {
  const b = r.batt ? val(r.batt) : null, lim = r.limite && ok(r.limite) ? val(r.limite) : null, ric = inRicarica(r);
  const col = b == null ? "var(--tx3)" : b < 15 ? "var(--red)" : b < 30 ? "var(--orange)" : "var(--green)";
  return `<div class="car-b">
    <div class="car-bn"><b>${b != null ? Math.round(b) : "—"}<small>%</small></b>${r.range ? `<span>${valU(r.range)}</span>` : ""}${ric ? `<em>⚡ ${t("in ricarica", "charging")}</em>` : ""}</div>
    <div class="car-bar"><i style="width:${Math.max(2, b || 0)}%;background:${col}" class="${ric ? "anim" : ""}"></i>${lim != null ? `<u style="left:${lim}%" title="${t("Limite", "Limit")} ${Math.round(lim)}%"></u>` : ""}</div>
  </div>`;
}
function scheda(d) {
  const r = ruoli(d), c = comandi(r), pos = dove(r), ric = inRicarica(r), sr = statoRicarica(r);
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
        ${batteria(r)}
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
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="carSave" data-id="${d}">💾 ${t("Salva", "Save")}</button>
      <button class="btn bad" data-act="carHide" data-id="${d}">🙈 ${t("Non è un'auto: nascondi", "Not a car: hide")}</button></div>`;
}
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
    closeSheet(); carSet(d, c => { c.nome = n || undefined; if (u) c.foto = u; else if (c.foto === "url") c.foto = "auto"; if (w) c.noWeb = !w.checked; }); },
  carHide: el => { const d = el.dataset.id; closeSheet(); carSet(d, (c, all) => { all._hide = [...new Set([...(all._hide || []), d])]; }); },
  goAuto: () => go("auto"),
});
CHG.carNum = el => svc("number", "set_value", { value: +el.value }, { entity_id: el.dataset.id });
CHG.carSel = el => svc("select", "select_option", { option: el.value }, { entity_id: el.dataset.id });

/* ---------- pagina, scheda nella Home e pillola in alto ---------- */
function pagina() {
  const L = auto();
  return `<div class="g g3">${L.map(scheda).join("") || card("🚗 " + t("Auto", "Car"), empty(t("Nessuna auto collegata a Home Assistant.", "No car connected to Home Assistant.")), { cls: "span3" })}</div>`;
}
function homeCard() {
  const L = auto(); if (!L.length) return "";
  return card("🚗 " + t("Auto", "Car"), `<div class="stack">${L.map(d => { const r = ruoli(d), b = r.batt ? val(r.batt) : null, ric = inRicarica(r), pos = dove(r);
    return `<button class="car-h" data-act="goAuto">${fotoHtml(d, r, "car-hi")}<div class="tx"><b>${esc(nomeAuto(d))}</b>
      <span>${b != null ? `🔋 ${Math.round(b)}%` : ""}${r.range && ok(r.range) ? ` · ${fnum(val(r.range), 0)} ${esc(unit(r.range))}` : ""}${ric ? " · ⚡" : ""}${pos ? ` · ${esc(pos.z)}` : ""}</span>
      ${b != null ? `<span class="bar1"><i style="width:${Math.max(2, b)}%;background:${b < 15 ? "var(--red)" : b < 30 ? "var(--orange)" : "var(--green)"}"></i></span>` : ""}</div><span class="st">›</span></button>`; }).join("")}</div>`);
}
HOME_EXTRA.auto = { title: () => t("Auto", "Car"), render: homeCard, show: () => auto().length > 0 };
STRIP.push(() => {
  const L = auto(); if (L.length !== 1) return "";
  const r = ruoli(L[0]), b = r.batt ? val(r.batt) : null; if (b == null) return "";
  return `<span class="pillv" data-act="go" data-id="auto">🚗 ${Math.round(b)}%${inRicarica(r) ? " ⚡" : ""}</span>`;
});
page("auto", { title: t("Auto", "Car"), short: "Auto", icon: "🚗", order: 33, show: () => auto().length > 0, badge: () => auto().some(d => inRicarica(ruoli(d))), render: pagina });

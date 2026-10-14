/* Home: saluto e riepilogo, meteo, stanze (per piano), persone, scene, cose da sistemare.
   Tutto viene dalle aree e dai dispositivi di Home Assistant: niente da configurare. */
import { S, AREAS, FLOORS, UI, ACT, CHG, t, LOC, esc, fnum, attr, ok, val, nm, ents, inArea, areaOf, areasSorted, roomTemp, roomHum,
  openings, lightsOn, isOn, card, empty, lightTile, climateCard, entityRow, openSheet, closeSheet, page, WX, HVAC, forecast, deviceClass, shortName, svc, toast, ago, weatherEnt, LAYOUT, isAdmin, saveLayout } from "../core.js";
import { item, addBtn, scegli, isTemp, isHum, cambia } from "../edit.js";
import { personeCard } from "../people.js";
import { avvisiCard } from "../avvisi.js";
import { raccoltaCard } from "../raccolta.js";
import { agendaCard } from "./calendario.js";
import { momentiCard } from "../momenti.js";

const saluto = () => { const h = new Date().getHours(); return h < 6 ? t("Buonanotte", "Good night") : h < 13 ? t("Buongiorno", "Good morning") : h < 18 ? t("Buon pomeriggio", "Good afternoon") : t("Buonasera", "Good evening"); };
const climaAttivi = () => ents("climate", id => ok(id) && S[id].state !== "off");

function riepilogo() {
  const nome = (UI.user?.name || "").split(" ")[0];
  const L = lightsOn().length, O = openings().filter(isOn), C = climaAttivi(), P = ents("person"), home = P.filter(p => S[p].state === "home");
  const frasi = [];
  if (P.length) frasi.push(home.length ? t(`In casa: ${home.map(p => esc(nm(p))).join(", ")}.`, `Home: ${home.map(p => esc(nm(p))).join(", ")}.`) : t("Non c'è nessuno in casa.", "Nobody is home."));
  frasi.push(L ? t(`${L} luc${L === 1 ? "e accesa" : "i accese"}`, `${L} light${L === 1 ? "" : "s"} on`) : t("Luci tutte spente", "All lights off"));
  if (O.length) frasi.push(`<span style="color:var(--orange)">${t(`${O.length} apert${O.length === 1 ? "a" : "e"}: `, `${O.length} open: `)}${O.slice(0, 3).map(o => esc(shortName(o))).join(", ")}</span>`);
  if (C.length) frasi.push(t(`clima acceso in ${C.length} zon${C.length === 1 ? "a" : "e"}`, `climate on in ${C.length} zone${C.length === 1 ? "" : "s"}`));
  return `<section class="card span2 hero1">
    <div class="clk1">${new Date().toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })}</div>
    <div class="small muted dt1">${new Date().toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" })}</div>
    <h2 class="hi1">${saluto()}${nome ? ", " + esc(nome) : ""}</h2>
    <p class="hs1">${frasi.join(" · ")}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">
      ${L ? `<button class="btn sm" data-act="lightsOff">💡 ${t("Spegni tutte le luci", "Turn off all lights")}</button>` : ""}
      ${scene().slice(0, UI.edit ? 99 : 6).map(id => item(id, `<button class="btn sm" data-act="toggle" data-id="${id}">🎬 ${esc(nm(id))}</button>`)).join("")}${addBtn(["scene"])}
    </div></section>`;
}
const scene = () => ents("scene").sort((a, b) => nm(a).localeCompare(nm(b), LOC));

function meteo() {
  const w = weatherEnt(); if (!w) return UI.edit ? card(`🌤️ ${t("Meteo", "Weather")}`, `<div class="small muted">${t("Nessun meteo in Home Assistant.", "No weather in Home Assistant.")}</div>`) : "";
  const a = S[w].attributes, [ic, txt] = WX()[S[w].state] || ["🌡️", S[w].state];
  const fc = forecast(w).slice(0, 5);
  return card(`${ic} ${t("Meteo", "Weather")}`, `${UI.edit ? `<div class="small muted" style="margin:-4px 0 8px">${esc(nm(w))}</div>` : ""}<div class="row" style="gap:14px"><div class="wxbig1">${fnum(a.temperature, 0)}°</div>
      <div><b>${esc(txt)}</b><div class="small muted">${a.humidity != null ? t("Umidità ", "Humidity ") + Math.round(a.humidity) + "%" : ""}${a.wind_speed != null ? ` · ${t("vento", "wind")} ${fnum(a.wind_speed, 0)} ${esc(a.wind_speed_unit || "")}` : ""}</div></div></div>
    ${fc.length ? `<div class="fc1">${fc.map(d => `<div><small>${new Date(d.datetime).toLocaleDateString(LOC, { weekday: "short" })}</small><span>${(WX()[d.condition] || ["·"])[0]}</span><b>${fnum(d.temperature, 0)}°</b><i>${d.templow != null ? fnum(d.templow, 0) + "°" : ""}</i></div>`).join("")}</div>` : ""}`, { right: UI.edit ? `<button class="btn sm" data-act="wxEdit">✏️</button>` : "" });
}

function stanza(a) {
  const T = roomTemp(a), H = roomHum(a), L = lightsOn(a).length, O = inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && isOn(id)).length;
  const C = inArea(a, "climate").find(id => ok(id) && S[id].state !== "off"), cool = C && ["cool", "dry"].includes(S[C].state);
  const nLuci = inArea(a, "light").length;
  return `<button class="rm1 ${L ? "lit" : ""} ${O ? "open" : ""} ${(LAYOUT.hiddenAreas || []).includes(a) ? "off1" : ""}" data-act="room" data-id="${a}">
    <span class="rn">${esc(AREAS[a].name)}</span>
    <span class="rt">${T != null ? fnum(T) + "°" : "—"}${H != null ? `<small>${Math.round(H)}%</small>` : ""}</span>
    <span class="ri">${nLuci ? `<i class="${L ? "on" : ""}">💡${L ? " " + L : ""}</i>` : ""}${O ? `<i class="al">🪟 ${O}</i>` : ""}${C ? `<i class="${cool ? "cool" : "heat"}">${cool ? "❄️" : "🔥"}</i>` : ""}</span>
  </button>`;
}
function stanze() {
  const A = areasSorted(UI.edit).filter(a => Object.keys(S).some(id => areaOf(id) === a));
  if (!A.length) return card(t("🏠 Stanze", "🏠 Rooms"), empty(t("Nessuna area configurata in Home Assistant: crea le aree (Impostazioni → Aree) e assegna i dispositivi.", "No areas yet: create areas in Home Assistant (Settings → Areas) and assign your devices.")), { cls: "span3" });
  const perPiano = {}; A.forEach(a => (perPiano[AREAS[a].floor || "_"] = perPiano[AREAS[a].floor || "_"] || []).push(a));
  const piani = Object.keys(perPiano).sort((x, y) => (FLOORS[x]?.level ?? 99) - (FLOORS[y]?.level ?? 99));
  return card(t("🏠 Stanze", "🏠 Rooms"), piani.map(f => `${piani.length > 1 ? `<div class="fl1">${esc(FLOORS[f]?.name || t("Altre", "Other"))}</div>` : ""}<div class="rms1">${perPiano[f].map(a => UI.edit ? `<div class="ed1">${stanza(a)}<div class="edb"><button data-act="rmEdit" data-id="${a}" aria-label="${t("Modifica", "Edit")}">✏️</button></div></div>` : stanza(a)).join("")}</div>`).join(""), { cls: "span3" });
}

/* ✏️ meteo: quale previsione usare */
function sceltaMeteo() {
  const W = ents("weather").sort((a, b) => nm(a).localeCompare(nm(b), LOC)), cur = LAYOUT.weather || "";
  return `<div class="sh-head"><div><h3>🌤️ ${t("Meteo di casa", "Home weather")}</h3><div class="small muted">${t("Scegli da dove prendo il meteo.", "Choose the weather source.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack"><button class="li ${!cur ? "sel1" : ""}" data-act="wxSet" data-id=""><span class="ic">✨</span><div class="tx"><b>${t("Automatico", "Automatic")}</b><span>${esc(nm(weatherEnt() || ""))}</span></div></button>
    ${W.map(id => { const [ic, tx] = WX()[S[id].state] || ["🌡️", S[id].state]; return `<button class="li ${cur === id ? "sel1" : ""}" data-act="wxSet" data-id="${id}"><span class="ic">${ic}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc(tx)} · ${fnum(attr(id, "temperature"), 0)}° · ${esc(id)}</span></div></button>`; }).join("")}</div>`;
}
ACT.wxEdit = () => openSheet(sceltaMeteo);
ACT.wxSet = async el => {
  const l = JSON.parse(JSON.stringify(LAYOUT)); if (el.dataset.id) l.weather = el.dataset.id; else delete l.weather;
  try { await saveLayout(l); closeSheet(); toast("🌤️ " + nm(weatherEnt())); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
};

/* primo avvio: invito a scegliere cosa mostrare (solo per gli amministratori) */
function benvenuto() {
  if (LAYOUT.configured || !isAdmin()) return "";
  return `<section class="card span3 wel1"><div class="row" style="gap:16px;flex-wrap:wrap"><span style="font-size:40px">🌶️</span>
    <div style="flex:1;min-width:220px"><b style="font-size:18px">${t("Benvenuto in 'Nduja!", "Welcome to 'Nduja!")}</b>
    <div class="small muted" style="margin-top:4px;line-height:1.5">${t("Ho preparato la plancia con tutto quello che ho trovato in casa. Scegli tu stanze, luci, clima e dispositivi da mostrare: ci vogliono due minuti.", "I built the dashboard from everything I found in your home. Choose the rooms, lights, climate and devices to show: it takes two minutes.")}</div></div>
    <button class="btn pri" data-act="go" data-id="impostazioni">⚙️ ${t("Configura la plancia", "Set up the dashboard")}</button>
    <button class="btn" data-act="wzAuto">${t("Va bene così", "Keep it as is")}</button></div></section>`;
}

/* finestra della stanza */
function schedaStanza(a) {
  const ar = AREAS[a]; if (!ar) return "";
  const T = roomTemp(a), H = roomHum(a);
  const L = inArea(a, "light"), C = inArea(a, "climate");
  const R = ["cover", "switch", "fan", "lock", "media_player", "humidifier", "vacuum"].flatMap(d => inArea(a, d));
  const O = inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)));
  const SN = inArea(a, "sensor", id => ["temperature", "humidity", "illuminance", "carbon_dioxide", "pm25", "power", "energy"].includes(deviceClass(id)) && ok(id)).slice(0, 12);
  return `<div class="sh-head"><div><h3>${esc(ar.name)}</h3><div class="small muted">${T != null ? fnum(T) + "°" : ""}${H != null ? " · " + Math.round(H) + "%" : ""}${ar.floor && FLOORS[ar.floor] ? " · " + esc(FLOORS[ar.floor].name) : ""}</div></div>${isAdmin() ? `<button class="btn sm" data-act="rmEdit" data-id="${a}">✏️ ${t("Personalizza", "Customize")}</button>` : ""}<button class="x" data-act="sheetClose">×</button></div>
    ${L.length ? `<div class="row between" style="margin:6px 0 8px"><b>${t("Luci", "Lights")}</b>${lightsOn(a).length ? `<button class="btn sm" data-act="lightsOff" data-area="${a}">${t("Spegni", "Turn off")}</button>` : ""}</div><div class="tiles">${L.map(id => lightTile(id)).join("")}</div>` : ""}
    ${C.length ? `<div style="margin:14px 0 8px"><b>${t("Clima", "Climate")}</b></div><div class="stack">${C.map(id => climateCard(id)).join("")}</div>` : ""}
    ${R.length ? `<div style="margin:14px 0 8px"><b>${t("Dispositivi", "Devices")}</b></div><div class="stack">${R.map(entityRow).join("")}</div>` : ""}
    ${O.length ? `<div style="margin:14px 0 8px"><b>${t("Porte e finestre", "Doors and windows")}</b></div><div class="stack">${O.map(id => `<div class="li ${isOn(id) ? "alert" : ""}"><span class="ic">${isOn(id) ? "🔓" : "🔒"}</span><div class="tx"><b>${esc(shortName(id))}</b><span>${isOn(id) ? t("aperta", "open") : t("chiusa", "closed")} · ${ago(S[id].last_changed)}</span></div></div>`).join("")}</div>` : ""}
    ${SN.length ? `<div style="margin:14px 0 8px"><b>${t("Sensori", "Sensors")}</b></div><div class="sn1">${SN.map(id => `<button data-act="more" data-id="${id}"><small>${esc(shortName(id))}</small><b>${esc(S[id].state)} ${esc(attr(id, "unit_of_measurement") || "")}</b></button>`).join("")}</div>` : ""}`;
}
ACT.room = el => { const a = el.dataset.id; openSheet(() => schedaStanza(a)); };

/* ---------- ✏️ stanza: nome, sensori, visibile, ordine ---------- */
function editStanza(a) {
  const ar = AREAS[a]; if (!ar) return "";
  const sc = LAYOUT.sensors?.[a] || {};
  const voce = (k, ic, label, fil) => { const v = sc[k];
    return `<button class="li" data-act="rmSensor" data-id="${a}" data-k="${k}"><span class="ic">${ic}</span><div class="tx"><b>${label}</b><span>${v === "none" ? t("nessuno", "none") : v && S[v] ? esc(nm(v)) + " · " + esc(S[v].state) + " " + esc(attr(v, "unit_of_measurement") || "") : "✨ " + t("automatico", "automatic") + (k === "temp" ? (roomTemp(a) != null ? " · " + fnum(roomTemp(a)) + "°" : "") : (roomHum(a) != null ? " · " + Math.round(roomHum(a)) + "%" : ""))}</span></div><span class="st">›</span></button>`; };
  const nascosta = (LAYOUT.hiddenAreas || []).includes(a);
  return `<div class="sh-head"><div><h3>✏️ ${esc(ar.name)}</h3><div class="small muted">${t("Cambia solo nella plancia, non in Home Assistant.", "Changes only the dashboard, not Home Assistant.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome della stanza", "Room name")}</span><input id="rm1n" type="text" data-chg="rmName" data-id="${a}" enterkeyhint="done" value="${esc(LAYOUT.areaNames?.[a] || "")}" placeholder="${esc(ar.nameHA || ar.name)}"></label>
    <div class="stack" style="margin-top:12px">${voce("temp", "🌡️", t("Sensore di temperatura", "Temperature sensor"))}${voce("hum", "💧", t("Sensore di umidità", "Humidity sensor"))}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn pri" data-act="rmSave" data-id="${a}">💾 ${t("Salva nome", "Save name")}</button>
      <button class="btn sm" data-act="rmMove" data-id="${a}" data-v="-1">▲ ${t("Prima", "Earlier")}</button><button class="btn sm" data-act="rmMove" data-id="${a}" data-v="1">▼ ${t("Dopo", "Later")}</button>
      <button class="btn ${nascosta ? "" : "bad"}" data-act="rmHide" data-id="${a}">${nascosta ? "👁 " + t("Mostra la stanza", "Show room") : "🙈 " + t("Nascondi la stanza", "Hide room")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Per aggiungere o togliere luci, clima e dispositivi di questa stanza usa ✏️ Modifica nelle pagine Luci, Clima e Prese.", "To add or remove lights, climate and devices of this room use ✏️ Edit on the Lights, Climate and Plugs pages.")}</p>`;
}
CHG.rmName = el => ACT.rmSave(el);
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "rm1n") e.target.blur(); });
Object.assign(ACT, {
  rmEdit: el => { const a = el.dataset.id; openSheet(() => editStanza(a)); },
  rmSensor: el => {
    const a = el.dataset.id, k = el.dataset.k, temp = k === "temp";
    scegli({ titolo: (temp ? "🌡️ " : "💧 ") + esc(AREAS[a].name), sotto: temp ? t("Tutti i sensori di temperatura della casa: scegli quello della stanza.", "Every temperature sensor in the house: pick the room's one.") : t("Tutti i sensori di umidità della casa.", "Every humidity sensor in the house."),
      filtro: temp ? isTemp : isHum, area: a, attuale: LAYOUT.sensors?.[a]?.[k] || "", nessuno: true,
      onPick: id => cambia(l => { l.sensors = l.sensors || {}; l.sensors[a] = { ...(l.sensors[a] || {}) }; if (id) l.sensors[a][k] = id; else delete l.sensors[a][k]; }, "💾 " + AREAS[a].name).then(() => openSheet(() => editStanza(a))) });
  },
  rmSave: el => { const a = el.dataset.id, n = (document.getElementById("rm1n")?.value || "").trim(); if ((LAYOUT.areaNames?.[a] || "") === n) return;
    cambia(l => { l.areaNames = { ...(l.areaNames || {}) }; if (n && n !== AREAS[a].nameHA) l.areaNames[a] = n; else delete l.areaNames[a]; }, "💾 " + (n || AREAS[a].nameHA)); },
  rmHide: el => { const a = el.dataset.id; cambia(l => { const h = new Set(l.hiddenAreas || []); h.has(a) ? h.delete(a) : h.add(a); l.hiddenAreas = [...h]; }); closeSheet(); },
  rmMove: el => { const a = el.dataset.id, d = +el.dataset.v;
    cambia(l => { const ord = areasSorted(true); const i = ord.indexOf(a), j = i + d; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; l.areaOrder = ord; }); },
});

/* ---------- schede della Home: ordine e visibilità (✏️ Modifica) ---------- */
const SCHEDE = () => ({
  riepilogo: [t("Saluto e orologio", "Greeting and clock"), riepilogo],
  momenti: [t("Momenti", "Moments"), momentiCard],
  meteo: [t("Meteo", "Weather"), meteo, "wxEdit"],
  stanze: [t("Stanze", "Rooms"), stanze],
  avvisi: [t("Avvisi", "Alerts"), avvisiCard],
  persone: [t("Persone", "People"), personeCard],
  raccolta: [t("Raccolta differenziata", "Waste collection"), raccoltaCard, "rfEdit"],
  agenda: [t("Agenda", "Agenda"), agendaCard, "calEdit"],
});
const ordine = () => { const K = Object.keys(SCHEDE()), o = (LAYOUT.home?.order || []).filter(k => K.includes(k)); return [...o, ...K.filter(k => !o.includes(k))]; };
const nascoste = () => LAYOUT.home?.hidden || [];
function attrezzi(k, html, i, n) {
  const off = nascoste().includes(k), cfg = SCHEDE()[k][2];
  const bar = `<div class="hct1"><b>${esc(SCHEDE()[k][0])}</b><span class="grow"></span>${cfg ? `<button data-act="${cfg}" title="${t("Impostazioni", "Settings")}">⚙️</button>` : ""}
    <button data-act="hcMove" data-id="${k}" data-v="-1" ${i === 0 ? "disabled" : ""}>▲</button><button data-act="hcMove" data-id="${k}" data-v="1" ${i === n - 1 ? "disabled" : ""}>▼</button>
    <button data-act="hcHide" data-id="${k}">${off ? "👁 " + t("Mostra", "Show") : "🙈 " + t("Nascondi", "Hide")}</button></div>`;
  if (!html) html = card("", `<div class="small muted">${t("Niente da mostrare per ora.", "Nothing to show right now.")}</div>`);
  return html.replace(/<section class="card([^"]*)"/, `<section class="card$1 hc1 ${off ? "off" : ""}"`).replace(/(<section[^>]*>)/, `$1${bar}`);
}
Object.assign(ACT, {
  hcMove: el => { const k = el.dataset.id, d = +el.dataset.v; cambia(l => { const o = ordine(), i = o.indexOf(k), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; l.home = { ...(l.home || {}), order: o }; }); },
  hcHide: el => { const k = el.dataset.id; cambia(l => { const h = new Set(l.home?.hidden || []); h.has(k) ? h.delete(k) : h.add(k); l.home = { ...(l.home || {}), hidden: [...h] }; }); },
});
function pagina() {
  const S1 = SCHEDE(), o = ordine();
  const corpo = UI.edit ? o.map((k, i) => attrezzi(k, S1[k][1](), i, o.length)).join("") : o.filter(k => !nascoste().includes(k)).map(k => S1[k][1]()).join("");
  return `<div class="g g3">${benvenuto()}${corpo}</div>`;
}

page("home", { title: "Home", short: "Home", icon: "🏠", order: 0, editable: true, render: pagina });

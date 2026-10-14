/* Home: saluto e riepilogo, meteo, stanze (per piano), persone, scene, cose da sistemare.
   Tutto viene dalle aree e dai dispositivi di Home Assistant: niente da configurare. */
import { S, AREAS, FLOORS, UI, ACT, t, LOC, esc, fnum, attr, ok, val, nm, ents, inArea, areaOf, areasSorted, roomTemp, roomHum,
  openings, lightsOn, isOn, card, empty, lightTile, climateCard, entityRow, openSheet, closeSheet, page, WX, HVAC, forecast, deviceClass, shortName, svc, toast, ago, weatherEnt, LAYOUT, isAdmin, saveLayout } from "../core.js";
import { item, addBtn } from "../edit.js";
import { personeCard } from "../people.js";
import { avvisiCard } from "../avvisi.js";
import { raccoltaCard } from "../raccolta.js";
import { agendaCard } from "./calendario.js";

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
    <div class="small muted">${new Date().toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" })}</div>
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
  return `<button class="rm1 ${L ? "lit" : ""} ${O ? "open" : ""}" data-act="room" data-id="${a}">
    <span class="rn">${esc(AREAS[a].name)}</span>
    <span class="rt">${T != null ? fnum(T) + "°" : "—"}${H != null ? `<small>${Math.round(H)}%</small>` : ""}</span>
    <span class="ri">${nLuci ? `<i class="${L ? "on" : ""}">💡${L ? " " + L : ""}</i>` : ""}${O ? `<i class="al">🪟 ${O}</i>` : ""}${C ? `<i class="${cool ? "cool" : "heat"}">${cool ? "❄️" : "🔥"}</i>` : ""}</span>
  </button>`;
}
function stanze() {
  const A = areasSorted().filter(a => Object.keys(S).some(id => areaOf(id) === a));
  if (!A.length) return card(t("🏠 Stanze", "🏠 Rooms"), empty(t("Nessuna area configurata in Home Assistant: crea le aree (Impostazioni → Aree) e assegna i dispositivi.", "No areas yet: create areas in Home Assistant (Settings → Areas) and assign your devices.")), { cls: "span3" });
  const perPiano = {}; A.forEach(a => (perPiano[AREAS[a].floor || "_"] = perPiano[AREAS[a].floor || "_"] || []).push(a));
  const piani = Object.keys(perPiano).sort((x, y) => (FLOORS[x]?.level ?? 99) - (FLOORS[y]?.level ?? 99));
  return card(t("🏠 Stanze", "🏠 Rooms"), piani.map(f => `${piani.length > 1 ? `<div class="fl1">${esc(FLOORS[f]?.name || t("Altre", "Other"))}</div>` : ""}<div class="rms1">${perPiano[f].map(stanza).join("")}</div>`).join(""), { cls: "span3" });
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
  return `<div class="sh-head"><div><h3>${esc(ar.name)}</h3><div class="small muted">${T != null ? fnum(T) + "°" : ""}${H != null ? " · " + Math.round(H) + "%" : ""}${ar.floor && FLOORS[ar.floor] ? " · " + esc(FLOORS[ar.floor].name) : ""}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${L.length ? `<div class="row between" style="margin:6px 0 8px"><b>${t("Luci", "Lights")}</b>${lightsOn(a).length ? `<button class="btn sm" data-act="lightsOff" data-area="${a}">${t("Spegni", "Turn off")}</button>` : ""}</div><div class="tiles">${L.map(id => lightTile(id)).join("")}</div>` : ""}
    ${C.length ? `<div style="margin:14px 0 8px"><b>${t("Clima", "Climate")}</b></div><div class="stack">${C.map(id => climateCard(id)).join("")}</div>` : ""}
    ${R.length ? `<div style="margin:14px 0 8px"><b>${t("Dispositivi", "Devices")}</b></div><div class="stack">${R.map(entityRow).join("")}</div>` : ""}
    ${O.length ? `<div style="margin:14px 0 8px"><b>${t("Porte e finestre", "Doors and windows")}</b></div><div class="stack">${O.map(id => `<div class="li ${isOn(id) ? "alert" : ""}"><span class="ic">${isOn(id) ? "🔓" : "🔒"}</span><div class="tx"><b>${esc(shortName(id))}</b><span>${isOn(id) ? t("aperta", "open") : t("chiusa", "closed")} · ${ago(S[id].last_changed)}</span></div></div>`).join("")}</div>` : ""}
    ${SN.length ? `<div style="margin:14px 0 8px"><b>${t("Sensori", "Sensors")}</b></div><div class="sn1">${SN.map(id => `<button data-act="more" data-id="${id}"><small>${esc(shortName(id))}</small><b>${esc(S[id].state)} ${esc(attr(id, "unit_of_measurement") || "")}</b></button>`).join("")}</div>` : ""}`;
}
ACT.room = el => { const a = el.dataset.id; openSheet(() => schedaStanza(a)); };

page("home", { title: "Home", short: "Home", icon: "🏠", order: 0, editable: true,
  render: () => `<div class="g g3">${benvenuto()}${riepilogo()}${meteo()}${stanze()}${avvisiCard()}${personeCard()}${raccoltaCard()}${agendaCard()}</div>` });

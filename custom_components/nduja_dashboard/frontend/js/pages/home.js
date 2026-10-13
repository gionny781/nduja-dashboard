/* Home: saluto e riepilogo, meteo, stanze (per piano), persone, scene, cose da sistemare.
   Tutto viene dalle aree e dai dispositivi di Home Assistant: niente da configurare. */
import { S, AREAS, FLOORS, UI, ACT, t, LOC, esc, fnum, attr, ok, val, nm, ents, inArea, areaOf, areasSorted, roomTemp, roomHum,
  openings, lightsOn, isOn, card, empty, lightTile, climateCard, entityRow, openSheet, page, WX, HVAC, forecast, deviceClass, shortName, svc, toast, ago } from "../core.js";

const saluto = () => { const h = new Date().getHours(); return h < 6 ? t("Buonanotte", "Good night") : h < 13 ? t("Buongiorno", "Good morning") : h < 18 ? t("Buon pomeriggio", "Good afternoon") : t("Buonasera", "Good evening"); };
const climaAttivi = () => ents("climate", id => ok(id) && S[id].state !== "off");
const batterieBasse = () => ents("sensor", id => deviceClass(id) === "battery" && ok(id) && val(id) != null && val(id) < 20).sort((a, b) => val(a) - val(b));
const aggiornamenti = () => Object.keys(S).filter(id => id.startsWith("update.") && S[id].state === "on");

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
      ${scene().slice(0, 6).map(id => `<button class="btn sm" data-act="toggle" data-id="${id}">${attr(id, "icon") ? "" : "🎬 "}${esc(nm(id))}</button>`).join("")}
    </div></section>`;
}
const scene = () => ents("scene").sort((a, b) => nm(a).localeCompare(nm(b), LOC));

function meteo() {
  const w = ents("weather")[0]; if (!w) return "";
  const a = S[w].attributes, [ic, txt] = WX()[S[w].state] || ["🌡️", S[w].state];
  const fc = forecast(w).slice(0, 5);
  return card(`${ic} ${t("Meteo", "Weather")}`, `<div class="row" style="gap:14px"><div class="wxbig1">${fnum(a.temperature, 0)}°</div>
      <div><b>${esc(txt)}</b><div class="small muted">${a.humidity != null ? t("Umidità ", "Humidity ") + Math.round(a.humidity) + "%" : ""}${a.wind_speed != null ? ` · ${t("vento", "wind")} ${fnum(a.wind_speed, 0)} ${esc(a.wind_speed_unit || "")}` : ""}</div></div></div>
    ${fc.length ? `<div class="fc1">${fc.map(d => `<div><small>${new Date(d.datetime).toLocaleDateString(LOC, { weekday: "short" })}</small><span>${(WX()[d.condition] || ["·"])[0]}</span><b>${fnum(d.temperature, 0)}°</b><i>${d.templow != null ? fnum(d.templow, 0) + "°" : ""}</i></div>`).join("")}</div>` : ""}`);
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

function persone() {
  const P = ents("person"); if (!P.length) return "";
  const zona = s => s === "home" ? t("A casa", "Home") : s === "not_home" ? t("Fuori", "Away") : (S["zone." + s]?.attributes.friendly_name || s);
  return card(t("👥 Persone", "👥 People"), `<div class="stack">${P.map(p => { const pic = attr(p, "entity_picture"), h = S[p].state === "home";
    return `<div class="li" data-act="more" data-id="${p}" role="button"><span class="av1 ${h ? "home" : ""}" style="${pic ? `background-image:url('${esc(pic)}')` : ""}">${pic ? "" : esc(nm(p)[0])}</span>
      <div class="tx"><b>${esc(nm(p))}</b><span>${esc(zona(S[p].state))} · ${ago(S[p].last_changed)}</span></div></div>`; }).join("")}</div>`);
}

function sistemare() {
  const O = openings().filter(isOn), B = batterieBasse(), U = aggiornamenti();
  const n = O.length + B.length + U.length;
  return card(`🔧 ${t("Da sistemare", "Needs attention")} <span class="tag ${n ? "warn" : "ok"}">${n || t("tutto ok", "all good")}</span>`, n ? `<div class="stack">
    ${O.map(id => `<div class="li alert" data-act="more" data-id="${id}" role="button"><span class="ic">🪟</span><div class="tx"><b>${esc(nm(id))}</b><span>${t("aperta", "open")} · ${ago(S[id].last_changed)}</span></div></div>`).join("")}
    ${B.map(id => `<div class="li" data-act="more" data-id="${id}" role="button"><span class="ic">🪫</span><div class="tx"><b>${esc(nm(id).replace(/\s*(batteria|battery)\s*/ig, " ").trim())}</b><span>${t("pila al", "battery at")} ${Math.round(val(id))}%</span></div></div>`).join("")}
    ${U.length ? `<div class="li" data-act="go" data-id="aggiornamenti" role="button"><span class="ic">⬆️</span><div class="tx"><b>${U.length} ${t(U.length === 1 ? "aggiornamento" : "aggiornamenti", U.length === 1 ? "update" : "updates")}</b><span>${U.slice(0, 3).map(id => esc(String(attr(id, "title") || nm(id)).replace(/\s*(update|aggiornamento)$/i, ""))).join(", ")}</span></div></div>` : ""}
  </div>` : `<div class="small muted">${t("Nessuna finestra aperta, nessuna pila scarica, nessun aggiornamento.", "No open windows, no low batteries, no updates.")}</div>`);
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

page("home", { title: "Home", short: "Home", icon: "🏠", order: 0,
  render: () => `<div class="g g3">${riepilogo()}${meteo()}${stanze()}${sistemare()}${persone()}</div>` });

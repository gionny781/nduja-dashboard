/* Home: saluto e riepilogo, meteo, stanze (per piano), persone, scene, cose da sistemare.
   Tutto viene dalle aree e dai dispositivi di Home Assistant: niente da configurare. */
import { S, HOME_EXTRA, PAGES, AREAS, FLOORS, UI, ACT, CHG, t, LOC, esc, fnum, attr, ok, val, nm, ents, inArea, areaOf, areasSorted, roomTemp, roomHum,
  openings, lightsOn, luci, isLightSwitch, isOn, card, empty, lightTile, climateCard, entityRow, openSheet, closeSheet, page, WX, HVAC, forecast, deviceClass, shortName, svc, toast, ago, weatherEnt, LAYOUT, isAdmin, saveLayout, utenteCfg, VISTE } from "../core.js";
import { item, addBtn, scegli, isTemp, isHum, cambia } from "../edit.js";
import { personeCard } from "../people.js";
import { avvisiCard } from "../avvisi.js";
import { raccoltaCard } from "../raccolta.js";
import { agendaCard } from "./calendario.js";
import { momentiCard } from "../momenti.js";
import { musicaCard } from "./musica.js";
import { novitaHome } from "../novita.js";
import { vistaClima, momentoClima } from "../climadisegni.js";
import { luciStanza } from "../luce.js";

const saluto = () => { const h = new Date().getHours(); return h < 6 ? t("Buonanotte", "Good night") : h < 13 ? t("Buongiorno", "Good morning") : h < 18 ? t("Buon pomeriggio", "Good afternoon") : t("Buonasera", "Good evening"); };
const climaAttivi = () => ents("climate", id => ok(id) && S[id].state !== "off");
/* scelte della Home (⚙️ delle schede in ✏️ Modifica, solo amministratori): se non scegli valgono quelle di sempre */
/** quante scene nel saluto: 6, o quelle scelte (0 = nessuna) */
const nScene = () => { const v = LAYOUT.home?.scene; return v != null && +v >= 0 && +v <= 12 ? +v : 6; };
/** giorni di previsione nella scheda Meteo: 5, o quelli scelti */
const giorniMeteo = () => { const v = +LAYOUT.home?.meteoGiorni; return v >= 1 && v <= 7 ? v : 5; };
/** salva una scelta in LAYOUT.home; il valore predefinito toglie la chiave (chi non tocca niente resta com'era) */
const homeSet = (k, v, def, msg) => cambia(l => { l.home = { ...(l.home || {}) }; if (v === def) delete l.home[k]; else l.home[k] = v; if (!Object.keys(l.home).length) delete l.home; }, msg);

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
      ${scene().slice(0, UI.edit ? 99 : nScene()).map(id => item(id, `<button class="btn sm" data-act="toggle" data-id="${id}">🎬 ${esc(nm(id))}</button>`)).join("")}${addBtn(["scene"])}
    </div></section>`;
}
const scene = () => ents("scene").sort((a, b) => nm(a).localeCompare(nm(b), LOC));

function meteo() {
  const w = weatherEnt(); if (!w) return UI.edit ? card(`🌤️ ${t("Meteo", "Weather")}`, `<div class="small muted">${t("Nessun meteo in Home Assistant.", "No weather in Home Assistant.")}</div>`) : "";
  const a = S[w].attributes, [ic, txt] = WX()[S[w].state] || ["🌡️", S[w].state];
  const fc = forecast(w).slice(0, giorniMeteo());
  return card(`${ic} ${t("Meteo", "Weather")}`, `${UI.edit ? `<div class="small muted" style="margin:-4px 0 8px">${esc(nm(w))}</div>` : ""}<div class="row" style="gap:14px"><div class="wxbig1">${fnum(a.temperature, 0)}°</div>
      <div><b>${esc(txt)}</b><div class="small muted">${a.humidity != null ? t("Umidità ", "Humidity ") + Math.round(a.humidity) + "%" : ""}${a.wind_speed != null ? ` · ${t("vento", "wind")} ${fnum(a.wind_speed, 0)} ${esc(a.wind_speed_unit || "")}` : ""}</div></div></div>
    ${fc.length ? `<div class="fc1"${giorniMeteo() !== 5 ? ` style="grid-template-columns:repeat(${giorniMeteo()},1fr)"` : ""}>${fc.map(d => `<div><small>${new Date(d.datetime).toLocaleDateString(LOC, { weekday: "short" })}</small><span>${(WX()[d.condition] || ["·"])[0]}</span><b>${fnum(d.temperature, 0)}°</b><i>${d.templow != null ? fnum(d.templow, 0) + "°" : ""}</i></div>`).join("")}</div>` : ""}`, UI.edit ? { right: `<button class="btn sm" data-act="wxEdit">✏️</button>` } : PAGES.meteo?.show() && LAYOUT.pages?.meteo !== false && utenteCfg().pages?.meteo !== false ? { link: [t("Dettagli", "Details"), "meteo"] } : {});
}

function stanza(a) {
  const T = roomTemp(a), H = roomHum(a), L = lightsOn(a).length, O = inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)) && isOn(id)).length;
  const C = inArea(a, "climate").find(id => ok(id) && S[id].state !== "off"), mc = C ? momentoClima(C).k : null;
  const nLuci = luci(a).length;
  return `<button class="rm1 ${L ? "lit" : ""} ${O ? "open" : ""} ${(LAYOUT.hiddenAreas || []).includes(a) ? "off1" : ""}" data-act="room" data-id="${a}">
    <span class="rn">${esc(AREAS[a].name)}</span>
    <span class="rt">${T != null ? fnum(T) + "°" : "—"}${H != null ? `<small>${Math.round(H)}%</small>` : ""}</span>
    <span class="ri">${nLuci ? `<i class="${L ? "on" : ""}">💡${L ? " " + L : ""}</i>` : ""}${O ? `<i class="al">🪟 ${O}</i>` : ""}${C ? `<i class="clr1 ${mc === "heat" ? "heat" : mc === "fan" ? "" : "cool"}">${vistaClima(C, "xs")}</i>` : ""}${VISTE.ariaChip?.(a) || ""}</span>
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
    ${W.map(id => { const [ic, tx] = WX()[S[id].state] || ["🌡️", S[id].state]; return `<button class="li ${cur === id ? "sel1" : ""}" data-act="wxSet" data-id="${id}"><span class="ic">${ic}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc(tx)} · ${fnum(attr(id, "temperature"), 0)}° · ${esc(id)}</span></div></button>`; }).join("")}</div>
    <label class="fld1" style="margin-top:14px"><span>${t("Giorni di previsione nella scheda", "Forecast days on the card")}</span><select data-chg="wxGiorni">${[3, 4, 5, 6, 7].map(n => `<option value="${n}" ${giorniMeteo() === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <p class="small muted" style="margin:6px 0 0">${t("Quanti giorni mostra la scheda Meteo della Home, se il servizio meteo li dà. Tutti i giorni restano nella pagina Meteo.", "How many days the Home weather card shows, if the weather service provides them. Every day stays on the Weather page.")}</p>`;
}
ACT.wxEdit = () => openSheet(sceltaMeteo);
CHG.wxGiorni = el => homeSet("meteoGiorni", +el.value, 5, "🌤️ " + t("Previsione: ", "Forecast: ") + el.value + t(" giorni", " days"));

/* ⚙️ saluto e orologio: quante scene sotto il saluto */
const cfgSaluto = () => `<div class="sh-head"><div><h3>⚙️ ${t("Saluto e orologio", "Greeting and clock")}</h3><div class="small muted">${t("Vale per tutta la casa.", "It applies to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Scene sotto il saluto", "Scenes under the greeting")}</span><select data-chg="hmScene">${[0, 2, 3, 4, 6, 8, 10, 12].map(n => `<option value="${n}" ${nScene() === n ? "selected" : ""}>${n === 0 ? t("Nessuna", "None") : n}</option>`).join("")}</select></label>
    <p class="small muted" style="margin:6px 0 0">${t("Le prime in ordine di nome", "The first ones by name")}${scene().length ? ` (${t("ne hai", "you have")} ${scene().length})` : ""}. ${t("Per togliere una scena usa ✕ sul suo pulsante in ✏️ Modifica, per rimetterla ＋.", "To remove a scene use ✕ on its button in ✏️ Edit, ＋ to bring it back.")}</p>`;
ACT.hmCfg = () => openSheet(cfgSaluto);
CHG.hmScene = el => homeSet("scene", +el.value, 6, "🎬 " + t("Scene nel saluto: ", "Scenes in the greeting: ") + el.value);
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
  const L = luciStanza(a), C = inArea(a, "climate");
  const R = ["cover", "switch", "fan", "lock", "media_player", "humidifier", "vacuum"].flatMap(d => inArea(a, d)).filter(id => !isLightSwitch(id));
  const O = inArea(a, "binary_sensor", id => ["door", "window", "opening", "garage_door"].includes(deviceClass(id)));
  const SN = sensoriStanza(a);
  return `<div class="sh-head"><div><h3>${esc(ar.name)}</h3><div class="small muted">${T != null ? fnum(T) + "°" : ""}${H != null ? " · " + Math.round(H) + "%" : ""}${ar.floor && FLOORS[ar.floor] ? " · " + esc(FLOORS[ar.floor].name) : ""}</div></div>${isAdmin() ? `<button class="btn sm" data-act="rmEdit" data-id="${a}">✏️ ${t("Personalizza", "Customize")}</button>` : ""}<button class="x" data-act="sheetClose">×</button></div>
    ${VISTE.ariaStanza?.(a) ? `<div class="stack" style="margin:4px 0 10px">${VISTE.ariaStanza(a)}</div>` : ""}
    ${L.length ? `<div class="row between" style="margin:6px 0 8px"><b>${t("Luci", "Lights")}</b>${lightsOn(a).length ? `<button class="btn sm" data-act="lightsOff" data-area="${a}">${t("Spegni", "Turn off")}</button>` : ""}</div><div class="tiles">${L.map(id => lightTile(id)).join("")}</div>` : ""}
    ${C.length ? `<div style="margin:14px 0 8px"><b>${t("Clima", "Climate")}</b></div><div class="stack">${C.map(id => climateCard(id)).join("")}</div>` : ""}
    ${R.length ? `<div style="margin:14px 0 8px"><b>${t("Dispositivi", "Devices")}</b></div><div class="stack">${R.map(id => VISTE.tapRiga?.(id) || entityRow(id)).join("")}</div>` : ""}
    ${O.length ? `<div style="margin:14px 0 8px"><b>${t("Porte e finestre", "Doors and windows")}</b></div><div class="stack">${O.map(id => `<div class="li ${isOn(id) ? "alert" : ""}"><span class="ic">${isOn(id) ? "🔓" : "🔒"}</span><div class="tx"><b>${esc(shortName(id))}</b><span>${isOn(id) ? t("aperta", "open") : t("chiusa", "closed")} · ${ago(S[id].last_changed)}</span></div></div>`).join("")}</div>` : ""}
    ${SN.length ? `<div style="margin:14px 0 8px"><b>${t("Sensori", "Sensors")}</b></div><div class="sn1">${SN.map(id => `<button data-act="more" data-id="${id}"><small>${esc(shortName(id))}</small><b>${esc(S[id].state)} ${esc(attr(id, "unit_of_measurement") || "")}</b></button>`).join("")}</div>` : ""}`;
}
ACT.room = el => { const a = el.dataset.id; openSheet(() => schedaStanza(a)); };
/* sensori nella finestra della stanza: trovati da soli per tipo (al massimo 12), meno quelli tolti, più quelli aggiunti in ✏️ (LAYOUT.roomSens[stanza] = { add, hide }) */
const SN_TIPI = ["temperature", "humidity", "illuminance", "carbon_dioxide", "pm25", "power", "energy"];
const snConf = a => LAYOUT.roomSens?.[a] || {};
const sensoriAuto = a => inArea(a, "sensor", id => SN_TIPI.includes(deviceClass(id)) && ok(id));
function sensoriStanza(a) {
  const c = snConf(a), via = new Set(c.hide || []);
  return [...new Set([...sensoriAuto(a).filter(id => !via.has(id)).slice(0, 12), ...(c.add || []).filter(id => S[id])])];
}

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
    ${(() => { const c = snConf(a), SN = sensoriStanza(a), via = (c.hide || []).filter(id => S[id]);
      return `<div class="fl1">📈 ${t("Sensori nella finestra della stanza", "Sensors in the room window")}</div>
      <p class="small muted" style="margin:0 0 6px">${t("Compaiono toccando la stanza. ✨ li trovo da soli (temperatura, umidità, luce, CO₂, PM2,5, consumi), ✋ li hai aggiunti tu. ✕ toglie, ＋ aggiunge qualsiasi sensore.", "They show when you tap the room. ✨ found automatically (temperature, humidity, light, CO₂, PM2.5, power), ✋ added by you. ✕ removes, ＋ adds any sensor.")}</p>
      <div class="stack">${SN.map(id => `<div class="li"><div class="tx"><b>${(c.add || []).includes(id) ? "✋" : "✨"} ${esc(shortName(id))}</b><span>${ok(id) ? esc(S[id].state) + " " + esc(attr(id, "unit_of_measurement") || "") : t("non raggiungibile", "unavailable")}</span></div>
        <button class="btn sm" data-act="rmSnDel" data-id="${a}" data-e="${id}" aria-label="${t("Togli", "Remove")}">✕</button></div>`).join("")}</div>
      ${via.length ? `<div class="vr1" style="margin-top:8px">${via.map(id => `<button data-act="rmSnShow" data-id="${a}" data-e="${id}">↩︎ ${esc(shortName(id))}</button>`).join("")}</div>` : ""}
      <button class="add1" data-act="rmSnAdd" data-id="${a}" style="margin-top:8px"><span>＋</span>${t("Aggiungi sensore", "Add sensor")}</button>`; })()}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn pri" data-act="rmSave" data-id="${a}">💾 ${t("Salva nome", "Save name")}</button>
      <button class="btn sm" data-act="rmMove" data-id="${a}" data-v="-1">▲ ${t("Prima", "Earlier")}</button><button class="btn sm" data-act="rmMove" data-id="${a}" data-v="1">▼ ${t("Dopo", "Later")}</button>
      <button class="btn ${nascosta ? "" : "bad"}" data-act="rmHide" data-id="${a}">${nascosta ? "👁 " + t("Mostra la stanza", "Show room") : "🙈 " + t("Nascondi la stanza", "Hide room")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Per aggiungere o togliere luci, clima e dispositivi di questa stanza usa ✏️ Modifica nelle pagine Luci, Clima e Prese.", "To add or remove lights, climate and devices of this room use ✏️ Edit on the Lights, Climate and Plugs pages.")}</p>`;
}
/** cambia i sensori della finestra di una stanza; liste vuote e stanze senza scelte si cancellano */
const snSet = (a, fn, msg) => cambia(l => { l.roomSens = { ...(l.roomSens || {}) }; const c = l.roomSens[a] = JSON.parse(JSON.stringify(l.roomSens[a] || {})); fn(c);
  for (const k of ["add", "hide"]) if (!(c[k] || []).length) delete c[k]; if (!Object.keys(c).length) delete l.roomSens[a]; if (!Object.keys(l.roomSens).length) delete l.roomSens; }, msg);
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
  rmSnDel: el => { const a = el.dataset.id, id = el.dataset.e;
    snSet(a, c => { if ((c.add || []).includes(id)) c.add = c.add.filter(x => x !== id); if (sensoriAuto(a).includes(id)) c.hide = [...new Set([...(c.hide || []), id])]; }, "✕ " + nm(id)); },
  rmSnShow: el => { const a = el.dataset.id, id = el.dataset.e; snSet(a, c => { c.hide = (c.hide || []).filter(x => x !== id); }, "↩︎ " + nm(id)); },
  rmSnAdd: el => { const a = el.dataset.id;
    scegli({ titolo: "📈 " + esc(AREAS[a]?.name || ""), sotto: t("Qualsiasi sensore della casa: compare nella finestra della stanza.", "Any sensor in the house: it shows in the room window."), area: a, auto: false, attuale: null,
      filtro: id => /^(sensor|binary_sensor|input_number|number)\./.test(id) && !sensoriStanza(a).includes(id),
      onPick: id => id && snSet(a, c => { c.add = [...new Set([...(c.add || []), id])]; c.hide = (c.hide || []).filter(x => x !== id); }, "＋ " + nm(id)).then(() => openSheet(() => editStanza(a))) }); },
  rmHide: el => { const a = el.dataset.id; cambia(l => { const h = new Set(l.hiddenAreas || []); h.has(a) ? h.delete(a) : h.add(a); l.hiddenAreas = [...h]; }); closeSheet(); },
  rmMove: el => { const a = el.dataset.id, d = +el.dataset.v;
    cambia(l => { const ord = areasSorted(true); const i = ord.indexOf(a), j = i + d; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; l.areaOrder = ord; }); },
});

/* ---------- schede della Home: ordine e visibilità (✏️ Modifica) ---------- */
const SCHEDE = () => ({
  riepilogo: [t("Saluto e orologio", "Greeting and clock"), riepilogo, "hmCfg"],
  momenti: [t("Momenti", "Moments"), momentiCard],
  meteo: [t("Meteo", "Weather"), meteo, "wxEdit"],
  stanze: [t("Stanze", "Rooms"), stanze],
  avvisi: [t("Avvisi", "Alerts"), avvisiCard],
  persone: [t("Persone", "People"), personeCard],
  /* in ordine di nome: le pagine si caricano insieme e l'ordine d'arrivo cambierebbe da un'apertura all'altra */
  ...Object.fromEntries(Object.entries(HOME_EXTRA).sort(([x], [y]) => x.localeCompare(y)).filter(([, x]) => { try { return x.show(); } catch { return false; } }).map(([k, x]) => [k, [x.title(), x.render, x.cfg]])),   // cfg: azione del ⚙️ della scheda (facoltativa)
  raccolta: [t("Raccolta differenziata", "Waste collection"), raccoltaCard, "rfEdit"],
  agenda: [t("Agenda", "Agenda"), agendaCard, "calEdit"],
  musica: [t("In riproduzione", "Now playing"), musicaCard],
  ...Object.fromEntries((LAYOUT.homeCards || []).map(c => ["c_" + c.id, [c.titolo || t("Scheda", "Card"), () => schedaLibera(c), "hlEdit\" data-id=\"" + c.id]])),
});

/* ---------- schede libere: qualsiasi dispositivo o sensore, scelto da te ---------- */
function elemento(id) {
  const d = id.split(".")[0];
  if (d === "light") return lightTile(id);
  if (/^(sensor|input_number|number)$/.test(d) || (d === "binary_sensor")) {
    const v = S[id]?.state, u = attr(id, "unit_of_measurement") || "";
    return `<button class="hlv1" data-act="more" data-id="${id}"><small>${esc(shortName(id))}</small><b>${ok(id) ? esc(isNaN(parseFloat(v)) ? v : fnum(parseFloat(v), Math.abs(parseFloat(v)) < 10 ? 1 : 0)) + (u ? " " + esc(u) : "") : "—"}</b></button>`;
  }
  if (d === "climate") return climateCard(id);
  return entityRow(id);
}
function schedaLibera(c) {
  const L = (c.items || []).filter(id => S[id]);
  const luci = L.filter(id => id.startsWith("light.")), valori = L.filter(id => /^(sensor|binary_sensor|input_number|number)\./.test(id)), altri = L.filter(id => !luci.includes(id) && !valori.includes(id));
  return card(`${esc(c.icona || "⭐")} ${esc(c.titolo || "")}`, `${valori.length ? `<div class="hlg1">${valori.map(id => item(id, elemento(id), "hc:" + c.id)).join("")}</div>` : ""}
    ${luci.length ? `<div class="tiles" style="margin-top:8px">${luci.map(id => item(id, elemento(id), "hc:" + c.id)).join("")}</div>` : ""}
    ${altri.length ? `<div class="stack" style="margin-top:8px">${altri.map(id => item(id, elemento(id), "hc:" + c.id)).join("")}</div>` : ""}
    ${UI.edit ? `<button class="add1" data-act="hlAdd" data-id="${c.id}" style="margin-top:8px"><span>＋</span>${t("Aggiungi dispositivo o sensore", "Add device or sensor")}</button>` : !L.length ? `<div class="small muted">${t("Vuota: premi ✏️ Modifica e ＋.", "Empty: press ✏️ Edit and ＋.")}</div>` : ""}`, { cls: c.larga ? "span2" : "" });
}
function nuovaScheda(id) {
  const c = (LAYOUT.homeCards || []).find(x => x.id === id) || { id: Date.now().toString(36), titolo: "", icona: "⭐", items: [] };
  openSheet(() => `<div class="sh-head"><div><h3>${id ? "✏️" : "＋"} ${t("Scheda della Home", "Home card")}</h3><div class="small muted">${t("Una scheda tua con i dispositivi e i sensori che vuoi.", "Your own card with any devices and sensors.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="row" style="gap:10px"><label class="fld1" style="flex:0 0 90px"><span>${t("Icona", "Icon")}</span><input id="hl1i" type="text" maxlength="4" value="${esc(c.icona || "")}"></label>
      <label class="fld1" style="flex:1"><span>${t("Titolo", "Title")}</span><input id="hl1t" type="text" value="${esc(c.titolo || "")}" placeholder="${t("Giardino, Ufficio, Bambini…", "Garden, Office, Kids…")}"></label></div>
    <label class="row" style="gap:8px;margin-top:10px"><input id="hl1w" type="checkbox" ${c.larga ? "checked" : ""}> ${t("Scheda larga", "Wide card")}</label>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="hlSave" data-id="${c.id}">💾 ${t("Salva", "Save")}</button>${id ? `<button class="btn bad" data-act="hlDel" data-id="${c.id}">🗑 ${t("Elimina scheda", "Delete card")}</button>` : ""}</div>`);
}
const cardsSet = fn => cambia(l => { l.homeCards = JSON.parse(JSON.stringify(l.homeCards || [])); fn(l.homeCards, l); });
Object.assign(ACT, {
  hlNew: () => nuovaScheda(null),
  hlEdit: el => nuovaScheda(el.dataset.id),
  hlSave: el => { const id = el.dataset.id, ti = document.getElementById("hl1t").value.trim() || t("Scheda", "Card"), ic = document.getElementById("hl1i").value.trim() || "⭐", w = document.getElementById("hl1w").checked;
    closeSheet(); cardsSet((L, l) => { const c = L.find(x => x.id === id); if (c) Object.assign(c, { titolo: ti, icona: ic, larga: w }); else { L.push({ id, titolo: ti, icona: ic, larga: w, items: [] }); l.home = { ...(l.home || {}), order: [...ordine(), "c_" + id] }; } }); },
  hlDel: el => { const id = el.dataset.id; closeSheet(); cardsSet(L => { const i = L.findIndex(x => x.id === id); if (i >= 0) L.splice(i, 1); }); },
  hlAdd: el => { const id = el.dataset.id;
    scegli({ titolo: "＋ " + t("Dispositivo o sensore", "Device or sensor"), auto: false, attuale: null, filtro: x => /^(light|switch|cover|fan|climate|media_player|lock|sensor|binary_sensor|scene|script|input_boolean|input_number|vacuum|humidifier|button)\./.test(x),
      onPick: x => x && cardsSet(L => { const c = L.find(q => q.id === id); if (c) c.items = [...new Set([...(c.items || []), x])]; }) }); },
});
/* ✕ su un elemento di una scheda libera: lo toglie solo da quella scheda */
const edDel0 = ACT.edDel;
ACT.edDel = el => el.dataset.page?.startsWith("hc:") ? cardsSet(L => { const c = L.find(q => q.id === el.dataset.page.slice(3)); if (c) c.items = c.items.filter(x => x !== el.dataset.id); }) : edDel0(el);
const ordine = () => { const K = Object.keys(SCHEDE()), o = (LAYOUT.home?.order || []).filter(k => K.includes(k));
  /* schede nuove (per esempio Auto): le metto al loro posto naturale, dopo la scheda che le precede */
  K.forEach((k, i) => { if (o.includes(k)) return; const prima = K.slice(0, i).reverse().find(x => o.includes(x)); o.splice(prima ? o.indexOf(prima) + 1 : 0, 0, k); });
  return o; };
const nascoste = () => UI.edit ? (LAYOUT.home?.hidden || []) : [...new Set([...(LAYOUT.home?.hidden || []), ...(utenteCfg().homeHidden || [])])];
/** schede della Home (per le scelte per persona in Impostazioni) */
export const schedeHome = () => Object.entries(SCHEDE()).map(([k, v]) => [k, v[0]]);
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
  return `<div class="g g3">${benvenuto()}${novitaHome()}${corpo}${UI.edit && isAdmin() ? `<section class="card span3">${`<button class="add1 wide1" data-act="hlNew"><span>＋</span>${t("Nuova scheda con i dispositivi che vuoi", "New card with any devices")}</button>`}</section>` : ""}</div>`;
}

page("home", { title: "Home", short: "Home", icon: "🏠", order: 0, editable: true, render: pagina });

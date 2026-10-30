/* Meteo: pagina completa dal meteo di casa (weatherEnt, scelto in Home → ✏️) o da un altro meteo scelto su questo dispositivo (📍).
   A) Adesso: la scena animata dell'Energia (scenaenergia.js: solo cielo, colline e casa) con temperatura e cielo, poi le tessere:
      percepita, umidità, pressione, vento con la bussola, UV, visibilità, alba e tramonto (compaiono solo se il meteo ha quel dato).
   B) Previsioni: ora per ora (weather.get_forecasts «hourly», 24 o 48 ore) con il grafico di temperatura e probabilità di pioggia;
      giornaliere («daily», oppure «twice_daily» unite per giorno) per 7-10 giorni con le barre minima-massima.
   C) Sensori di casa: stazione meteo o sensori esterni (temperatura, umidità, pluviometro, anemometro, direzione, pressione, UV),
      trovati da soli o scelti dall'amministratore (⚙️), con accanto il valore della previsione. I servizi di previsione non contano.
   D) Allerte: Meteoalarm, Protezione Civile, DWD, Météo-France, NWS e simili, o il meteo stesso; in evidenza con il colore del livello.
      In Home, negli Avvisi, da arancione in su (il livello lo sceglie l'amministratore).
   E) Radar: solo se c'è una telecamera radar in Home Assistant o un indirizzo immagine scritto dall'amministratore: niente di nascosto.
   Scelte della casa (LAYOUT.meteo, solo amministratori):
     { sensori: { temp, hum, pioggia, intensita, piove, vento, raffica, dir, pressione, uv: entity_id | "none" },
       allerte: { piu: [entity_id], meno: [entity_id], home: 3 (2 giallo, 3 arancione, 4 rosso, 0 mai) },
       radar: { cam: entity_id | "none", url: "", min: 5 } }
   Scelte di questo dispositivo: nduja_meteoEnt (meteo da mostrare), nduja_meteoOre (24 | 48), nduja_meteoRadar (cam | url). */
import { S, REG, AREAS, ACT, LAYOUT, VISTE, PAGES, utenteCfg, IT, t, LOC, esc, fnum, nm, nmHA, ok, attr, unit, deviceClass, allEnts, areaOf, page,
  forecast, weatherEnt, WX, hhmm, sGet, sSet, render, openSheet, closeSheet, isAdmin, toast, durata } from "../core.js";
import { cambia, scegli, indirizzoLocale } from "../edit.js";
import { scena, sole } from "../scenaenergia.js";

const C = () => LAYOUT.meteo || {};
const G = 864e5;
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const A = (w, k) => num(attr(w, k));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- quale meteo ---------- */
/** il meteo di questa pagina: quello scelto su questo dispositivo, altrimenti quello di casa */
export const meteoPagina = () => { const s = sGet("meteoEnt"); return s && S[s] ? s : weatherEnt(); };
const meteiTutti = () => Object.keys(S).filter(id => id.startsWith("weather.") && !REG[id]?.hidden);
/* funzioni del meteo (WeatherEntityFeature): previsioni giornaliere, orarie, due volte al giorno */
const F_GIORNO = 1, F_ORA = 2, F_META = 4;
const puo = (w, f) => ((+attr(w, "supported_features") || 0) & f) === f;

/* ---------- unità e conversioni ---------- */
const fahr = w => /F/.test(attr(w, "temperature_unit") || "");
const inC = (v, w) => v == null ? null : fahr(w) ? (v - 32) * 5 / 9 : v;
const uVento = w => attr(w, "wind_speed_unit") || "km/h";
const kmh = (v, u = "km/h") => v == null ? null : /m\/s/i.test(u) ? v * 3.6 : /mph/i.test(u) ? v * 1.609 : /kn|kt/i.test(u) ? v * 1.852 : /ft\/s/i.test(u) ? v * 1.097 : v;
const hPa = (v, u = "hPa") => v == null ? null : /inhg/i.test(u) ? v * 33.864 : /mmhg/i.test(u) ? v * 1.3332 : /kpa/i.test(u) ? v * 10 : /psi/i.test(u) ? v * 68.948 : v;
const km = (v, u = "km") => v == null ? null : /mi/i.test(u) ? v * 1.609 : /^m$/i.test(u) ? v / 1000 : v;
const gr = v => v == null ? "—" : fnum(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) + "°";
const intero = v => v == null ? "—" : fnum(v, 0);

/* colore di una temperatura (in °C): viola, blu, verde, giallo, arancio, rosso */
const SCALA_T = [[-10, [94, 92, 230]], [0, [100, 210, 255]], [10, [48, 209, 88]], [20, [255, 214, 10]], [28, [255, 159, 10]], [36, [255, 69, 58]]];
function coloreT(c) {
  if (c == null) return "#8e8e93";
  if (c <= SCALA_T[0][0]) return `rgb(${SCALA_T[0][1]})`;
  for (let i = 1; i < SCALA_T.length; i++) if (c <= SCALA_T[i][0]) {
    const [a, ca] = SCALA_T[i - 1], [b, cb] = SCALA_T[i], k = (c - a) / (b - a);
    return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`;
  }
  return `rgb(${SCALA_T[SCALA_T.length - 1][1]})`;
}

/* ---------- vento ---------- */
const PUNTI = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** direzione in gradi: numero, oppure sigla (N, NNE… anche in italiano con la O di ovest) */
export function gradi(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(v); if (!isNaN(n)) return ((n % 360) + 360) % 360;
  const i = PUNTI.indexOf(String(v).toUpperCase().trim().replace(/O/g, "W")); return i < 0 ? null : i * 22.5;
}
const sigla = g => (IT ? ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"] : PUNTI)[Math.round(g / 22.5) % 16];
const DIR8 = () => [t("nord", "north"), t("nord-est", "north-east"), t("est", "east"), t("sud-est", "south-east"), t("sud", "south"), t("sud-ovest", "south-west"), t("ovest", "west"), t("nord-ovest", "north-west")];
const VENTI = ["tramontana", "grecale", "levante", "scirocco", "ostro", "libeccio", "ponente", "maestrale"];
/** «da nord-ovest (maestrale)»: da dove arriva il vento; in italiano anche il nome del vento */
const daDove = g => { const i = Math.round(g / 45) % 8; return t("da ", "from ") + DIR8()[i] + (IT ? ` (${VENTI[i]})` : ""); };
const BF = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const BFN = () => IT ? ["calma", "bava di vento", "brezza leggera", "brezza tesa", "vento moderato", "vento teso", "vento fresco", "vento forte", "burrasca", "burrasca forte", "tempesta", "fortunale", "uragano"]
  : ["calm", "light air", "light breeze", "gentle breeze", "moderate breeze", "fresh breeze", "strong breeze", "near gale", "gale", "strong gale", "storm", "violent storm", "hurricane"];
const beaufort = k => { let i = 0; while (i < BF.length && k >= BF[i]) i++; return i; };
/** bussola: la freccia va dove soffia il vento (la coda è da dove arriva) */
function bussola(g, piccola) {
  const tacche = Array.from({ length: 16 }, (_, i) => `<path d="M0 -28V${i % 4 ? -25.5 : -23}" transform="rotate(${i * 22.5})"/>`).join("");
  const card = [["N", 0], [t("E", "E"), 90], ["S", 180], [t("O", "W"), 270]].map(([l, a]) => { const r = a * Math.PI / 180;
    return `<text x="${(Math.sin(r) * 16.5).toFixed(1)}" y="${(-Math.cos(r) * 16.5 + 3.4).toFixed(1)}" class="${a ? "" : "nn"}">${l}</text>`; }).join("");
  return `<svg class="mt1bs ${piccola ? "pk" : ""}" viewBox="-32 -32 64 64" aria-hidden="true"><circle class="o" r="30"/><g class="tk">${tacche}</g>${piccola ? "" : card}
    ${g == null ? "" : `<g transform="rotate(${Math.round(g + 180)})"><g class="fr"><path d="M0 -27L6.5 -14.5H2V22H-2V-14.5H-6.5Z"/><circle cy="22" r="3.2"/></g></g>`}</svg>`;
}

/* ---------- percepita (se il meteo non la dà: temperatura apparente di Steadman, con umidità e vento) ---------- */
function percepita(w) {
  const a = A(w, "apparent_temperature"); if (a != null) return { v: a, calc: false };
  const T = inC(A(w, "temperature"), w), RH = A(w, "humidity"), v = kmh(A(w, "wind_speed"), uVento(w));
  if (T == null || RH == null || v == null) return null;
  const e = RH / 100 * 6.105 * Math.exp(17.27 * T / (237.7 + T)), at = T + .33 * e - .7 * (v / 3.6) - 4;
  return { v: fahr(w) ? at * 9 / 5 + 32 : at, calc: true };
}

/* ---------- previsioni ---------- */
const inizioOggi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const giornoDi = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** previsioni orarie da adesso (l'ora in corso compresa) */
function orarie(w) {
  if (!puo(w, F_ORA)) return [];
  const da = Date.now() - 3600e3;
  return (forecast(w, "hourly") || []).filter(f => Date.parse(f.datetime) > da);
}
/** previsioni per giorno da oggi: giornaliere, oppure le due metà del giorno (giorno e notte) unite */
function giornaliere(w) {
  const tipo = puo(w, F_GIORNO) ? "daily" : puo(w, F_META) ? "twice_daily" : null; if (!tipo) return [];
  const F = (forecast(w, tipo) || []).filter(f => giornoDi(Date.parse(f.datetime)) >= inizioOggi());
  if (tipo === "daily") return F.slice(0, 10).map(f => ({ ...f, g: giornoDi(Date.parse(f.datetime)) }));
  const per = new Map();
  for (const f of F) { const g = giornoDi(Date.parse(f.datetime)); (per.get(g) || per.set(g, []).get(g)).push(f); }
  return [...per.entries()].slice(0, 10).map(([g, L]) => {
    const T = L.flatMap(f => [num(f.temperature), num(f.templow)]).filter(v => v != null), giorno = L.find(f => f.is_daytime !== false) || L[0];
    const P = L.map(f => num(f.precipitation_probability)).filter(v => v != null), mm = L.map(f => num(f.precipitation)).filter(v => v != null);
    return { ...giorno, g, temperature: T.length ? Math.max(...T) : null, templow: T.length > 1 ? Math.min(...T) : null,
      precipitation_probability: P.length ? Math.max(...P) : null, precipitation: mm.length ? mm.reduce((a, b) => a + b, 0) : null };
  });
}
/* notte o giorno di un'ora delle previsioni: is_daytime se c'è, altrimenti dall'orario di alba e tramonto */
function minutiSole() {
  const s = sole(), m = ms => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
  return [s.alba ? m(s.alba) : 420, s.tramonto ? m(s.tramonto) : 1140];
}
function icona(cond, notte) {
  if (notte && (cond === "sunny" || cond === "clear-night")) return "🌙";
  if (notte && cond === "partlycloudy") return "☁️";
  return (WX()[cond] || ["·"])[0];
}

/* ================= D) allerte ================= */
const PIATT_ALL = /^(meteoalarm|dpc|meteo_france|dwd_weather_warnings|nws_alerts|weatheralerts|met_alerts|meteoswiss|knmi|allertameteo|allerta_meteo|protezione_civile|italian_civil_protection)$/;
const NOME_ALL = /allert|alert|warning|warnung|vigilan|meteoalarm|protezione.?civile|(^|[._ ])dpc([._ ]|$)/i;
const NON_ALL = /batter|door|porta|finestr|window|smoke|fumo|\bgas\b|leak|perdit|allagament|update|aggiorn|cpu|disk|ups|filtr|filter|manuten|maintenance|tesla|stampant|printer|tamper|manomiss|lavatric|washer|dryer|frigo|fridge|caldaia|boiler|pomp|pump|inverter|solar|router|fritz|server|nas\b|intrus|siren|sirena|sicurezza|security|motion|movimento|presence|presenza|lock|serratur|robot|vacuum|car\b|auto_|veicol|vehicle|phone|telefono/i;
const LIV = () => ({ 2: [t("Allerta gialla", "Yellow warning"), "#ffd60a", "🟡"], 3: [t("Allerta arancione", "Orange warning"), "#ff9f0a", "🟠"], 4: [t("Allerta rossa", "Red warning"), "#ff453a", "🔴"] });
const LIV_TXT = [[/rosso|rossa|(^|[^a-z])red([^a-z]|$)|rouge|(^|[^a-z])rot([^a-z]|$)|extreme|estrem|viola|purple/i, 4], [/arancio|orange|severe|markant/i, 3], [/giall|yellow|jaune|gelb|moderat/i, 2],
  [/verde|green|(^|[^a-z])vert([^a-z]|$)|grün|gruen|minor|nessun|none|keine|aucun|no warning|nessuna/i, 1]];
const livTesto = s => { s = String(s ?? ""); for (const [re, v] of LIV_TXT) if (re.test(s)) return v; return 0; };
/** livello da un colore (#rrggbb): rosso/viola 4, arancio 3, giallo 2, verde 1 */
function livColore(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < .15) return 0;
  let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); h = (h * 60 + 360) % 360;
  return h < 14 || h >= 260 ? 4 : h < 38 ? 3 : h < 72 ? 2 : h < 170 ? 1 : 0;
}
const TIPI_MA = () => ({ 1: ["💨", t("Vento", "Wind")], 2: ["❄️", t("Neve e ghiaccio", "Snow and ice")], 3: ["⛈️", t("Temporali", "Thunderstorms")], 4: ["🌫️", t("Nebbia", "Fog")],
  5: ["🥵", t("Caldo", "High temperature")], 6: ["🥶", t("Freddo", "Low temperature")], 7: ["🌊", t("Mareggiate", "Coastal event")], 8: ["🔥", t("Incendi boschivi", "Forest fire")],
  9: ["🏔️", t("Valanghe", "Avalanches")], 10: ["🌧️", t("Pioggia", "Rain")], 12: ["🌊", t("Alluvioni", "Flooding")], 13: ["🌧️", t("Pioggia e alluvioni", "Rain and flooding")] });
const ICONA_ALL = [[/temporal|thunder|orage|gewitter|fulmin|lightning/i, "⛈️"], [/vent|wind|sturm|böe|boe|bufer|burrasc|gale/i, "💨"], [/neve|snow|ghiacc|\bice\b|neige|verglas|schnee|glätte|gelat/i, "❄️"],
  [/nebbia|fog|brouill|nebel/i, "🌫️"], [/caldo|heat|canicul|hitze|ondat/i, "🥵"], [/freddo|cold|frost|grand froid|gelo/i, "🥶"], [/idrogeo|idraul|alluvion|flood|inond|hochwasser|piena|frane/i, "🌊"],
  [/pioggia|rain|pluie|regen|precipit/i, "🌧️"], [/incend|fire|feu|waldbrand/i, "🔥"], [/valang|avalanch|lawin/i, "🏔️"], [/mare|coast|vagues|submersion|wave|mareggiat/i, "🌊"]];
const iconaAllerta = s => (ICONA_ALL.find(([re]) => re.test(s || "")) || [0, "⚠️"])[1];
/** legge un'allerta da un insieme di attributi (Meteoalarm, DPC, voci delle liste di NWS…); stato = stato dell'entità */
function leggiAllerta(x, stato) {
  const g = (...K) => { for (const k of K) for (const n of [k, k.toLowerCase(), k[0].toUpperCase() + k.slice(1)]) { const v = x?.[n]; if (v != null && v !== "") return v; } };
  const al = g("awareness_level"), at = g("awareness_type");
  let lv = 0;
  if (al != null) { const m = String(al).match(/^\s*(\d)/); lv = livTesto(al) || (m ? Math.min(4, +m[1]) : 0); }
  if (!lv) lv = livTesto(g("color", "colore", "level_color", "colour")) || livColore(g("color", "colore", "colour"));
  if (!lv) { const l = g("level", "livello", "alert_level", "warning_level", "severity", "severita", "gravita"); if (l != null) lv = /^\s*\d+\s*$/.test(l) ? Math.min(4, +l) : livTesto(l); }
  if (!lv && stato != null) lv = /^\s*\d+\s*$/.test(stato) ? Math.min(4, +stato) : livTesto(stato);
  const tm = at != null ? String(at).match(/^\s*(\d+)/) : null, tipo = tm ? TIPI_MA()[+tm[1]] : null;
  const titolo = String(g("headline", "event", "title", "titolo", "evento", "rischio", "risk", "name") || (tipo ? tipo[1] : at ? String(at).replace(/^\s*\d+\s*;\s*/, "") : "") || "");
  return { lv, titolo, ic: tipo ? tipo[0] : iconaAllerta(titolo + " " + (at || "") + " " + (g("event") || "")),
    testo: String(g("description", "descrizione", "instruction", "info", "message", "messaggio") || ""), da: g("onset", "effective", "start", "inizio", "from", "valid_from"),
    a: g("expires", "ends", "end", "fine", "until", "to", "valid_to") };
}
/** tutte le allerte di un'entità (alcune ne hanno più di una) */
function allerteDi(id) {
  const s = S[id]; if (!s || !ok(id)) return [];
  const a = s.attributes || {}, base = { id, fonte: nm(id) }, out = [], dom = id.split(".")[0];
  /* liste negli attributi: NWS Alerts, weatheralerts, alcuni meteo */
  const lista = [a.alerts, a.Alerts, a.warnings, a.Warnings].find(Array.isArray);
  if (lista) { lista.forEach((x, i) => { const o = leggiAllerta(x); if (o.lv >= 2) out.push({ ...base, ...o, k: id + ":" + i }); }); }
  else if (a.warning_1_name != null || a.warning_count != null) {   // DWD
    for (let i = 1; i <= 20; i++) { const n = a[`warning_${i}_name`]; if (!n) break;
      const lv = livColore(a[`warning_${i}_color`]) || [0, 2, 3, 4, 4][+a[`warning_${i}_level`]] || 0;
      if (lv >= 2) out.push({ ...base, k: id + ":" + i, lv, titolo: String(n), ic: iconaAllerta(n), testo: String(a[`warning_${i}_headline`] || a[`warning_${i}_description`] || ""), da: a[`warning_${i}_start`], a: a[`warning_${i}_end`] }); }
  } else if (REG[id]?.platform === "meteo_france" || /^(vert|jaune|orange|rouge)$/i.test(s.state)) {   // Météo-France: un attributo per rischio
    for (const [k, v] of Object.entries(a)) if (typeof v === "string" && /^(vert|jaune|orange|rouge)$/i.test(v)) { const lv = livTesto(v); if (lv >= 2) out.push({ ...base, k: id + ":" + k, lv, titolo: k, ic: iconaAllerta(k), testo: "" }); }
    if (!out.length) { const lv = livTesto(s.state); if (lv >= 2) out.push({ ...base, k: id, lv, titolo: nm(id), ic: "⚠️", testo: "" }); }
  } else if (dom === "weather") {
    if (s.state === "exceptional") out.push({ ...base, k: id, lv: 3, titolo: t("Condizioni eccezionali", "Exceptional conditions"), ic: "⚠️", testo: "" });
  } else if (dom !== "binary_sensor" || s.state === "on") {
    const o = leggiAllerta(a, dom === "binary_sensor" ? null : s.state);
    if (dom === "binary_sensor" && !o.lv) o.lv = 2;    // acceso ma senza colore: allerta generica
    if (o.lv >= 2) out.push({ ...base, ...o, k: id, titolo: o.titolo || nm(id) });
  }
  /* finite: via; quelle che iniziano più avanti restano (con «da …») */
  return out.filter(o => { const f = Date.parse(o.a); return isNaN(f) || f > Date.now(); });
}
/** fonti di allerte trovate da sole (per integrazione o per nome) */
export function fontiAuto() {
  return Object.keys(S).filter(id => /^(sensor|binary_sensor)\./.test(id) && (PIATT_ALL.test(REG[id]?.platform || "")
    || (!REG[id]?.hidden && REG[id]?.cat == null && NOME_ALL.test(id + " " + nmHA(id)) && !NON_ALL.test(id + " " + nmHA(id)) && !(id.startsWith("binary_sensor.") && deviceClass(id)))));
}
const fonti = () => { const al = C().allerte || {}, meno = al.meno || []; return [...new Set([...fontiAuto(), ...(al.piu || [])])].filter(id => S[id] && !meno.includes(id)); };
/** allerte attive (gialle, arancioni, rosse) dalle fonti e dal meteo, la più grave prima */
export function allerte(w = weatherEnt()) {
  const L = [...fonti(), ...(w ? [w] : [])].flatMap(id => { try { return allerteDi(id); } catch { return []; } });
  const visti = new Set();
  return L.filter(a => { const k = a.lv + "|" + a.titolo.toLowerCase() + "|" + (a.da || "") + "|" + (a.a || ""); if (visti.has(k)) return false; visti.add(k); return true; })
    .sort((x, y) => y.lv - x.lv || (Date.parse(x.da) || 0) - (Date.parse(y.da) || 0));
}
const quando = a => {
  const d = Date.parse(a.da), f = Date.parse(a.a), fmt = ms => { const x = new Date(ms), oggi = giornoDi(ms) === inizioOggi(), dom = giornoDi(ms) === inizioOggi() + G;
    return (oggi ? t("oggi", "today") : dom ? t("domani", "tomorrow") : x.toLocaleDateString(LOC, { weekday: "short", day: "numeric" })) + " " + hhmm(ms); };
  if (!isNaN(d) && d > Date.now()) return t("da ", "from ") + fmt(d) + (!isNaN(f) ? t(" a ", " to ") + fmt(f) : "");
  return !isNaN(f) ? t("fino a ", "until ") + fmt(f) : t("in corso", "now");
};
const APERTE = new Set();
function allerteCard(L) {
  if (!L.length) return "";
  const N = LIV();
  return `<section class="card span3 mt1al">${L.map(a => { const [nome, col, pal] = N[a.lv], lungo = a.testo.length > (window.innerWidth < 700 ? 150 : 330), aperta = APERTE.has(a.k);
    return `<div class="mt1a l${a.lv}" style="--lv:${col}"><span class="ic">${a.ic}</span><div class="tx"><div class="hd"><span class="lvp">${pal} ${esc(nome)}</span><small>${esc(quando(a))}</small></div>
      <b>${esc(a.titolo)}</b>${a.testo ? `<p class="${lungo && !aperta ? "cut" : ""}">${esc(a.testo)}</p>${lungo ? `<button class="lnk" data-act="mtAlx" data-k="${esc(a.k)}">${aperta ? t("Meno", "Less") : t("Leggi tutto", "Read more")}</button>` : ""}` : ""}
      <small class="fo">${esc(a.fonte)}</small></div></div>`; }).join("")}</section>`;
}
ACT.mtAlx = el => { const k = el.dataset.k; APERTE.has(k) ? APERTE.delete(k) : APERTE.add(k); render(); };
const pagAttiva = () => !!PAGES.meteo?.show() && LAYOUT.pages?.meteo !== false && utenteCfg().pages?.meteo !== false;
/* avvisi della Home (avvisi.js): da arancione in su, o dal livello scelto dall'amministratore */
VISTE.meteoAvvisi = () => {
  const soglia = C().allerte?.home ?? 3; if (!soglia) return [];
  return allerte().filter(a => a.lv >= soglia).map(a => ({ k: "mt:" + a.k + ":" + a.lv + ":" + (a.da || "") + (a.a || ""), ic: a.ic, b: `${LIV()[a.lv][2]} ${livTesto(a.titolo) >= 2 ? esc(a.titolo) : esc(LIV()[a.lv][0]) + " · " + esc(a.titolo)}`,
    s: esc(quando(a)) + " · " + esc(a.fonte), ...(pagAttiva() ? { go: "meteo" } : { id: a.id }), cls: "alert" }));
};

/* ================= C) sensori di casa ================= */
/* integrazioni di previsione: i loro sensori non sono misure di casa */
const PREV = /^(openweathermap|accuweather|pirateweather|tomorrowio|metoffice|meteo_france|weatherkit|aemet|ipma|nws|smhi|environment_canada|bom|open_meteo|met|met_eireann|meteoblue|weatherbit|visual_crossing|dwd_weather|meteoalarm|nws_alerts|weatheralerts|dpc|meteoswiss|knmi|ilmeteo|meteoam|weatherflow_forecast|openmeteo|yr|foreca|meteonorway)$/;
const ESTERNO = /estern|outdoor|outside|fuori|balcon|terrazz|giardin|garden|cortile|yard|patio|veranda|meteo|weather|stazione|station|ecowitt|tempest|davis|ambient|netatmo|(^|[^a-z])wh\d/i;
const NON_EST = /cpu|chip|batter|acqua|water|piscina|pool|frigo|fridge|freezer|congel|caldaia|boiler|mandata|ritorno|flow|return|dew|rugiada|feels|percepit|apparent|soil|terreno|suolo|interna|indoor|inside|(^|[^a-z])(min|max)([^a-z]|$)|forecast|previs|domani|tomorrow|setpoint|target|heat.?index|wind.?chill|chill|tesla|vehicle|veicol|(^|[^a-z])car([^a-z]|$)|model.?[3sxy]([^a-z]|$)/i;
const testoDi = id => id + " " + nmHA(id) + " " + (AREAS[areaOf(id)]?.nameHA || "") + " " + (AREAS[areaOf(id)]?.name || "");
const daPrevisione = id => PREV.test(REG[id]?.platform || "") || /forecast|previsione/i.test(id + " " + nmHA(id));
const numerico = id => ok(id) && !isNaN(parseFloat(S[id].state));
const nomeV = id => id + " " + nmHA(id);
const KIND = () => [
  ["temp", "🌡️", t("Temperatura esterna", "Outdoor temperature")], ["hum", "💧", t("Umidità esterna", "Outdoor humidity")],
  ["pioggia", "🌧️", t("Pioggia di oggi (pluviometro)", "Rain today (rain gauge)")], ["intensita", "☔", t("Intensità della pioggia", "Rain rate")], ["piove", "🌂", t("Sensore di pioggia (sì/no)", "Rain sensor (yes/no)")],
  ["vento", "💨", t("Vento (anemometro)", "Wind (anemometer)")], ["raffica", "🌬️", t("Raffiche", "Gusts")], ["dir", "🧭", t("Direzione del vento", "Wind direction")],
  ["pressione", "⏱️", t("Pressione", "Pressure")], ["uv", "🕶️", t("Indice UV", "UV index")],
];
/* trovati da soli: misure vere di casa */
const AUTO = {
  temp: id => deviceClass(id) === "temperature" && ESTERNO.test(testoDi(id)) && !NON_EST.test(nomeV(id)),
  hum: id => deviceClass(id) === "humidity" && ESTERNO.test(testoDi(id)) && !NON_EST.test(nomeV(id)),
  pioggia: id => deviceClass(id) === "precipitation" || (/^(mm|in)$/.test(unit(id)) && /rain|pioggia|piogg|precip/i.test(nomeV(id)) && !/rate|intens|\/h/i.test(nomeV(id))),
  intensita: id => deviceClass(id) === "precipitation_intensity" || /^(mm|in)\/h$/.test(unit(id)),
  vento: id => deviceClass(id) === "wind_speed" && !/gust|raffic|max/i.test(nomeV(id)),
  raffica: id => deviceClass(id) === "wind_speed" && /gust|raffic/i.test(nomeV(id)),
  dir: id => deviceClass(id) === "wind_direction" || (unit(id) === "°" && /wind|vento|bearing|direz/i.test(nomeV(id))),
  pressione: id => deviceClass(id) === "atmospheric_pressure" || (deviceClass(id) === "pressure" && /baro|atmos|relativ|absolut|sea|livello del mare|meteo|weather|ecowitt|netatmo|stazione|station/i.test(testoDi(id)) && !/caldaia|boiler|acqua|water|tire|tyre|pneum|gomm|(^|[^a-z])ch([^a-z]|$)/i.test(nomeV(id))),
  uv: id => /(^|[^a-z])uv([^a-z]|$)|uv_?index|uvi([^a-z]|$)|indice.?uv/i.test(nomeV(id)) && !/lamp|light|luce|steril/i.test(nomeV(id)),
};
/* quale scegliere quando ce n'è più di uno: meglio una stazione meteo (lo stesso dispositivo misura anche altro tempo atmosferico)
   che la sonda esterna di una caldaia o di una pompa di calore; per la pioggia meglio il totale di oggi che quello orario o settimanale */
const METEO_DC = ["humidity", "wind_speed", "wind_direction", "precipitation", "precipitation_intensity", "atmospheric_pressure"];
const RISCALDA = /caldaia|boiler|ariston|vaillant|viessmann|vicare|remeha|baxi|buderus|bosch|immergas|otgw|opentherm|ebusd|pompa.?di.?calore|heat.?pump|daikin|mitsubishi|panasonic|nibe|clima|climate|termostat|thermostat/i;
function punti(id, k) {
  let p = 0; const dev = REG[id]?.device;
  if (dev && Object.keys(S).some(x => x !== id && REG[x]?.device === dev && x.startsWith("sensor.") && METEO_DC.includes(deviceClass(x)) && deviceClass(x) !== deviceClass(id))) p += 3;
  if (/meteo|weather|stazione|station|ecowitt|netatmo|tempest|davis|ambient/i.test(testoDi(id) + " " + (REG[id]?.platform || ""))) p += 2;
  if (RISCALDA.test(nomeV(id) + " " + (REG[id]?.platform || ""))) p -= 3;
  if (k === "pioggia") { const s = nomeV(id); p += (/daily|giorn|oggi|today|(^|[^a-z])day|24h/i.test(s) ? 2 : 0) - (/hour|orari|rate|event|week|settim|month|mese|year|anno|total|totale|yesterday|ieri/i.test(s) ? 3 : 0); }
  return p;
}
function autoSensore(k) {
  if (k === "piove") return allEnts("binary_sensor", id => deviceClass(id) === "moisture" && /rain|pioggia|piov/i.test(nomeV(id)) && !daPrevisione(id)).sort()[0] || null;
  return allEnts("sensor", id => !daPrevisione(id) && numerico(id) && AUTO[k](id)).sort((a, b) => punti(b, k) - punti(a, k) || a.localeCompare(b))[0] || null;
}
/** il sensore di casa di un tipo: quello scelto, altrimenti quello trovato */
export function sensore(k) { const v = C().sensori?.[k]; if (v === "none") return null; if (v && S[v]) return v; return autoSensore(k); }
/* per la scelta a mano: tutti i sensori adatti */
const FILTRO = {
  temp: id => id.startsWith("sensor.") && (deviceClass(id) === "temperature" || /°\s?[CF]$/.test(unit(id))),
  hum: id => id.startsWith("sensor.") && (deviceClass(id) === "humidity" || unit(id) === "%"),
  pioggia: id => id.startsWith("sensor.") && (deviceClass(id) === "precipitation" || /^(mm|in)$/.test(unit(id))),
  intensita: id => id.startsWith("sensor.") && (deviceClass(id) === "precipitation_intensity" || /\/h$/.test(unit(id))),
  piove: id => id.startsWith("binary_sensor."),
  vento: id => id.startsWith("sensor.") && (deviceClass(id) === "wind_speed" || /^(km\/h|m\/s|mph|kn|kt|ft\/s|bft)$/i.test(unit(id))),
  dir: id => id.startsWith("sensor.") && (deviceClass(id) === "wind_direction" || unit(id) === "°" || /dir|bearing/i.test(nomeV(id))),
  pressione: id => id.startsWith("sensor.") && (["pressure", "atmospheric_pressure"].includes(deviceClass(id)) || /^(hpa|mbar|inhg|mmhg|kpa)$/i.test(unit(id))),
  uv: id => id.startsWith("sensor.") && !isNaN(parseFloat(S[id]?.state)),
};
FILTRO.raffica = FILTRO.vento;
const valTxt = id => !ok(id) ? t("non raggiungibile", "unavailable") : id.startsWith("binary_sensor.") ? (S[id].state === "on" ? t("piove", "raining") : t("asciutto", "dry"))
  : isNaN(parseFloat(S[id].state)) ? esc(S[id].state) : fnum(parseFloat(S[id].state), Math.abs(parseFloat(S[id].state)) < 100 && parseFloat(S[id].state) % 1 ? 1 : 0) + (unit(id) ? " " + esc(unit(id)) : "");

function sensoriCard(w, D) {
  const K = KIND().map(([k, ic, n]) => [k, ic, n, sensore(k)]).filter(x => x[3] && S[x[3]]);
  if (!K.length) return "";
  const v = id => num(S[id]?.state), oggi = D.find(d => d.g === inizioOggi());
  const riga = ([k, ic, n, id]) => {
    let prev = "", diff = "", extra = "";
    const u = unit(id);
    if (k === "temp" && A(w, "temperature") != null) { prev = gr(A(w, "temperature")); const d = v(id) != null ? v(id) - A(w, "temperature") : null; if (d != null && Math.abs(d) >= .5) diff = (d > 0 ? "+" : "−") + fnum(Math.abs(d), 1) + "°"; }
    if (k === "hum" && A(w, "humidity") != null) prev = Math.round(A(w, "humidity")) + "%";
    if ((k === "vento" || k === "raffica") && A(w, k === "vento" ? "wind_speed" : "wind_gust_speed") != null) prev = fnum(A(w, k === "vento" ? "wind_speed" : "wind_gust_speed"), 0) + " " + esc(uVento(w));
    if (k === "pressione" && A(w, "pressure") != null) prev = fnum(A(w, "pressure"), /inhg/i.test(attr(w, "pressure_unit") || "") ? 2 : 0) + " " + esc(attr(w, "pressure_unit") || "hPa");
    if (k === "uv" && A(w, "uv_index") != null) prev = fnum(A(w, "uv_index"), 0);
    if (k === "pioggia" && oggi?.precipitation != null) prev = fnum(oggi.precipitation, 1) + " " + esc(attr(w, "precipitation_unit") || "mm");
    if (k === "dir") { const g = gradi(S[id]?.state), gw = gradi(attr(w, "wind_bearing")); extra = bussola(g, true); if (gw != null) prev = sigla(gw); return `<button class="mt1sr" data-act="more" data-id="${id}">${extra}<span class="tx"><small>${esc(n)}</small><b>${g == null ? "—" : sigla(g) + " · " + Math.round(g) + "°"}</b>${g != null ? `<em>${esc(daDove(g))}</em>` : ""}</span>${prev ? `<span class="pv"><small>${t("previsione", "forecast")}</small>${prev}</span>` : ""}</button>`; }
    if (k === "intensita") extra = (v(id) || 0) > 0 ? `<em class="si">${t("sta piovendo", "it's raining")}</em>` : `<em>${t("non piove", "not raining")}</em>`;
    const valore = k === "piove" ? (S[id].state === "on" ? "☔ " + t("Piove", "Raining") : t("Asciutto", "Dry")) : valTxt(id);
    return `<button class="mt1sr ${k === "piove" && S[id].state === "on" ? "on" : ""}" data-act="more" data-id="${id}"><span class="ic">${ic}</span><span class="tx"><small>${esc(n)}</small><b>${valore}${diff ? `<i>${diff}</i>` : ""}</b>${extra}</span>
      ${prev ? `<span class="pv"><small>${k === "pioggia" ? t("previsti oggi", "expected today") : t("previsione", "forecast")}</small>${prev}</span>` : ""}</button>`;
  };
  return `<section class="card mt1sc"><div class="ch"><h2>🏡 ${t("Sensori di casa", "Home sensors")}</h2><span class="small muted">${t("misure vere", "real readings")}</span></div><div class="mt1sl">${K.map(riga).join("")}</div></section>`;
}

/* ================= E) radar ================= */
const radarAuto = () => Object.keys(S).filter(id => id.startsWith("camera.") && (/radar|rainviewer|precipit|regen|buienradar/i.test(nomeV(id)) || /^(rainviewer|buienradar)$/.test(REG[id]?.platform || ""))).sort()[0] || null;
function radarCam() { const r = C().radar || {}; if (r.cam === "none") return null; if (r.cam && S[r.cam]) return r.cam; return radarAuto(); }
const radarUrl = () => indirizzoLocale(C().radar?.url || "");
const radarMin = () => lim(+C().radar?.min || 5, 1, 120);
const conGiro = u => u + (u.includes("?") ? "&" : "?") + "nduja=" + Math.floor(Date.now() / (radarMin() * 6e4));
function radarCard() {
  const cam = radarCam(), url = radarUrl(); if (!cam && !url) return "";
  const scelta = cam && url ? (sGet("meteoRadar") === "url" ? "url" : "cam") : cam ? "cam" : "url";
  const pic = scelta === "cam" ? attr(cam, "entity_picture") : url, src = pic ? conGiro(pic) : "";
  return `<section class="card mt1rc"><div class="ch"><h2>🛰️ ${t("Radar pioggia", "Rain radar")}</h2>${cam && url ? `<div class="seg"><button class="${scelta === "cam" ? "act" : ""}" data-act="mtRad" data-v="cam">📷 ${esc(nm(cam))}</button><button class="${scelta === "url" ? "act" : ""}" data-act="mtRad" data-v="url">🔗 ${t("Immagine", "Image")}</button></div>` : ""}</div>
    ${src ? `<div class="mt1rd"><img src="${esc(src)}" alt="${t("Radar della pioggia", "Rain radar")}" loading="lazy"></div>` : `<div class="small muted">${t("Il radar non è raggiungibile.", "The radar is unavailable.")}</div>`}
    <div class="small muted mt1rf">${scelta === "cam" ? esc(nm(cam)) : t("Indirizzo scelto da un amministratore", "Address chosen by an admin")} · ${t("si aggiorna ogni ", "refreshes every ")}${radarMin()} min</div></section>`;
}
ACT.mtRad = el => { sSet("meteoRadar", el.dataset.v); render(); };

/* ================= A) adesso ================= */
const UVL = () => [[3, t("basso", "low"), "#30d158"], [6, t("moderato", "moderate"), "#ffd60a"], [8, t("alto", "high"), "#ff9f0a"], [11, t("molto alto", "very high"), "#ff453a"], [99, t("estremo", "extreme"), "#bf5af2"]];
const uvLiv = v => UVL().find(([m]) => v < m);
function tessera(cls, ic, k, v, s, disegno = "") {
  return `<div class="mt1k ${cls}"><div class="kh"><span>${ic}</span>${k}</div><div class="kv">${v}</div>${disegno}${s ? `<div class="ks">${s}</div>` : ""}</div>`;
}
function tessere(w, H, oggi) {
  const out = [], a = S[w].attributes;
  /* percepita */
  const P = percepita(w), T = A(w, "temperature");
  if (P) { const d = T != null ? P.v - T : 0;
    out.push(tessera("pe", "🌡️", t("Percepita", "Feels like"), gr(P.v), (Math.abs(d) < 1 ? t("come quella vera", "same as actual") : d < 0 ? t(`${fnum(-d, 0)}° più fresca`, `${fnum(-d, 0)}° cooler`) : t(`${fnum(d, 0)}° più calda`, `${fnum(d, 0)}° warmer`))
      + (P.calc ? ` · <i>${t("calcolata", "estimated")}</i>` : ""))); }
  /* umidità */
  const U = A(w, "humidity");
  if (U != null) { const dp = A(w, "dew_point");
    out.push(tessera("um", "💧", t("Umidità", "Humidity"), Math.round(U) + "<small>%</small>", dp != null ? t("punto di rugiada ", "dew point ") + gr(dp) : U >= 85 ? t("molto umido", "very humid") : U <= 30 ? t("aria secca", "dry air") : "",
      `<div class="mt1bar"><i style="width:${lim(U, 0, 100)}%"></i></div>`)); }
  /* vento */
  const V = A(w, "wind_speed"), g = gradi(a.wind_bearing), R = A(w, "wind_gust_speed");
  if (V != null) { const b = beaufort(kmh(V, uVento(w)));
    out.push(tessera("ve", "💨", t("Vento", "Wind"), `${fnum(V, V < 10 && V % 1 ? 1 : 0)}<small>${esc(uVento(w))}</small>`,
      [BFN()[b], g != null ? daDove(g) : "", R != null ? t("raffiche ", "gusts ") + fnum(R, 0) : ""].filter(Boolean).join(" · "), bussola(g))); }
  /* pressione: lancetta da 960 a 1050 hPa */
  const pr = A(w, "pressure");
  if (pr != null) { const pu = attr(w, "pressure_unit") || "hPa", h = hPa(pr, pu), k = lim((h - 960) / 90, 0, 1), ang = -120 + k * 240;
    const arco = (a0, a1) => { const p = x => [(Math.sin(x * Math.PI / 180) * 24).toFixed(1), (-Math.cos(x * Math.PI / 180) * 24).toFixed(1)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0}A24 24 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
    out.push(tessera("pr", "⏱️", t("Pressione", "Pressure"), `${fnum(pr, /inhg/i.test(pu) ? 2 : 0)}<small>${esc(pu)}</small>`,
      h < 1005 ? t("bassa", "low") : h > 1022 ? t("alta", "high") : t("nella media", "normal"),
      `<svg class="mt1pg" viewBox="-30 -30 60 44" aria-hidden="true"><path class="tr" d="${arco(-120, 120)}"/><path class="lo" d="${arco(-120, -40)}"/><path class="hi" d="${arco(40, 120)}"/>
        <g transform="rotate(${ang.toFixed(1)})"><path class="ag" d="M0 -21L2.6 0H-2.6Z"/></g><circle class="pv" r="3.6"/></svg>`)); }
  /* UV: dal meteo, altrimenti dalla prima ora delle previsioni, altrimenti da un sensore di casa */
  let uv = A(w, "uv_index"), uvDa = "";
  if (uv == null && H[0]?.uv_index != null) uv = num(H[0].uv_index);
  if (uv == null && sensore("uv") && num(S[sensore("uv")].state) != null) { uv = num(S[sensore("uv")].state); uvDa = t(" · dal sensore", " · from sensor"); }
  if (uv == null && oggi?.uv_index != null) { uv = num(oggi.uv_index); uvDa = t(" · massimo di oggi", " · today's max"); }
  if (uv != null) { const [, n, col] = uvLiv(uv);
    out.push(tessera("uv", "🕶️", t("Indice UV", "UV index"), fnum(uv, 0), `<b style="color:${col}">${n}</b>${uv >= 3 ? t(" · proteggiti dal sole", " · use sun protection") : ""}${uvDa}`,
      `<div class="mt1uv"><i style="left:${lim(uv / 11 * 100, 0, 100)}%"></i></div>`)); }
  /* visibilità */
  const vi = A(w, "visibility");
  if (vi != null) { const vu = attr(w, "visibility_unit") || "km", k = km(vi, vu);
    out.push(tessera("vi", "👁️", t("Visibilità", "Visibility"), `${fnum(vi, vi < 10 && vi % 1 ? 1 : 0)}<small>${esc(vu)}</small>`,
      k >= 20 ? t("ottima", "excellent") : k >= 10 ? t("buona", "good") : k >= 4 ? t("discreta", "moderate") : k >= 1 ? t("scarsa", "poor") : t("nebbia fitta", "dense fog"))); }
  /* alba e tramonto */
  if (S["sun.sun"]) { const s = sole(), luce = s.alba && s.tramonto ? ((s.tramonto - s.alba) % G + G) % G : null, f = s.su ? s.f : null;
    const x = f == null ? null : (8 + 104 * f).toFixed(1), y = f == null ? null : (52 - Math.sin(Math.PI * f) * 44).toFixed(1);
    const manca = s.su ? (s.tramonto ? t("tramonta tra ", "sets in ") + durata((s.tramonto - Date.now()) / 1000) : "") : (s.alba ? t("sorge tra ", "rises in ") + durata((s.alba - Date.now()) / 1000) : "");
    out.push(tessera("so", "🌅", t("Alba e tramonto", "Sunrise and sunset"), `<span class="ab"><small>↑</small>${s.alba ? hhmm(s.alba) : "—"}</span><span class="ab"><small>↓</small>${s.tramonto ? hhmm(s.tramonto) : "—"}</span>`,
      [luce ? durata(luce / 1000) + t(" di luce", " of daylight") : "", manca].filter(Boolean).join(" · "),
      `<svg class="mt1sa" viewBox="0 0 120 58" aria-hidden="true"><path class="or" d="M2 52H118"/><path class="ar" d="M8 52A52 44 0 0 1 112 52"/>
        ${f != null ? `<path class="fat" d="M8 52A52 44 0 0 1 ${x} ${y}"/><circle class="sl" cx="${x}" cy="${y}" r="6"/>` : `<circle class="nt" cx="60" cy="52" r="4"/>`}</svg>`)); }
  return out.join("");
}
function adesso(w, D, H) {
  const a = S[w].attributes, stretto = window.innerWidth < 700, oggi = D.find(d => d.g === inizioOggi());
  const sc = scena({ stretto, meteo: true, w, titolo: t("Meteo adesso", "Weather now") });
  const st = !sc.sole.su && S[w].state === "sunny" ? "clear-night" : S[w].state, [ic, tx] = WX()[st] || ["🌡️", S[w].state];
  const P = percepita(w), fuori = w === weatherEnt() ? sensore("temp") : null, tf = fuori ? num(S[fuori].state) : null;
  const hiLo = oggi && (oggi.temperature != null || oggi.templow != null) ? `${oggi.temperature != null ? "↑ " + gr(num(oggi.temperature)) : ""}${oggi.templow != null ? "  ↓ " + gr(num(oggi.templow)) : ""}` : "";
  const pioggia = (() => { const L = H.slice(0, 24); const i = L.findIndex(f => (num(f.precipitation_probability) || 0) >= 50 || /rain|pour|lightning-rainy|snow|hail/.test(f.condition || ""));
    if (!L.length) return ""; if (i < 0) return "☀️ " + t("niente pioggia nelle prossime 24 ore", "no rain in the next 24 hours");
    if (i === 0 && /rain|pour|snow|hail|lightning/.test(S[w].state)) { const j = L.findIndex(f => (num(f.precipitation_probability) || 0) < 40 && !/rain|pour|snow|hail|lightning/.test(f.condition || ""));
      return "☂️ " + (j > 0 ? t("dovrebbe smettere verso le ", "should stop around ") + hhmm(Date.parse(L[j].datetime)) : t("continua per tutto il giorno", "keeps going all day")); }
    const p = num(L[i].precipitation_probability); return "🌂 " + (/snow/.test(L[i].condition || "") ? t("neve", "snow") : t("pioggia", "rain")) + t(" probabile verso le ", " likely around ") + hhmm(Date.parse(L[i].datetime)) + (p != null ? ` (${Math.round(p)}%)` : ""); })();
  const chi = meteiTutti().length > 1 || sGet("meteoEnt");
  return `<section class="card span3 mt1c"><div class="ch"><h2>${ic} ${t("Adesso", "Now")}</h2><div class="row" style="gap:6px">
      ${chi ? `<button class="btn sm" data-act="mtEnt" title="${t("Quale meteo", "Which weather")}">📍 ${esc(nm(w))}</button>` : `<span class="small muted">${esc(nm(w))}</span>`}
      ${isAdmin() ? `<button class="btn sm" data-act="mtCfg" title="${t("Impostazioni", "Settings")}" aria-label="${t("Impostazioni", "Settings")}">⚙️</button>` : ""}</div></div>
    <div class="en7 mt1sc0 ${stretto ? "tel" : ""}">${sc.html}
      <div class="mt1o"><div class="mt1t">${a.temperature != null ? fnum(a.temperature, 0) : "—"}<sup>°</sup></div><div class="mt1x"><b>${esc(tx)}</b>${hiLo ? `<span>${hiLo}</span>` : ""}
        ${P ? `<span>${t("Percepita ", "Feels like ")}${gr(P.v)}</span>` : ""}${tf != null ? `<span class="fu">🏡 ${gr(tf)} ${t("dal tuo sensore", "your sensor")}</span>` : ""}</div></div></div>
    ${pioggia ? `<div class="mt1pi">${pioggia}</div>` : ""}
    <div class="mt1g">${tessere(w, H, oggi)}</div></section>`;
}

/* ================= B) previsioni ================= */
function oraPerOra(w, H) {
  if (!H.length) return "";
  const n = sGet("meteoOre") === "48" && H.length > 24 ? 48 : 24, F = H.slice(0, n), N = F.length, COL = 44, VW = N * COL, Hh = 232;
  const yI = 24, yT0 = 66, yT1 = 132, yP0 = 152, yP1 = 196, yO = 220, ogni = N > 24 ? 2 : 1;
  const T = F.map(f => num(f.temperature)), tv = T.filter(v => v != null);
  if (!tv.length) return "";
  let lo = Math.min(...tv), hi = Math.max(...tv); if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
  const X = i => i * COL + COL / 2, Y = v => yT1 - (v - lo) / (hi - lo) * (yT1 - yT0);
  const pts = T.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
  /* curva morbida (Catmull-Rom → Bézier) */
  const curva = pts.map((p, i) => { if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`; const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6], c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6];
    return `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }).join("");
  const area = curva + `L${pts[pts.length - 1][0].toFixed(1)} ${yT1 + 12}L${pts[0][0].toFixed(1)} ${yT1 + 12}Z`;
  const [ma, mt] = minutiSole(), cU = attr(w, "precipitation_unit") || "mm";
  const colonne = F.map((f, i) => {
    const d = new Date(f.datetime), mins = d.getHours() * 60 + d.getMinutes(), notte = f.is_daytime != null ? f.is_daytime === false : (mins < ma || mins >= mt);
    const p = num(f.precipitation_probability), mm = num(f.precipitation), x = X(i), mostra = i % ogni === 0, mezzanotte = d.getHours() === 0 && i > 0;
    const hP = p != null ? Math.max(p > 0 ? 2 : 0, p / 100 * (yP1 - yP0)) : mm != null && mm > 0 ? Math.min(1, mm / 4) * (yP1 - yP0) : 0;
    const titolo = `${d.toLocaleDateString(LOC, { weekday: "short" })} ${hhmm(d)} · ${(WX()[f.condition] || ["", f.condition || ""])[1]} · ${gr(T[i])}${p != null ? " · " + Math.round(p) + "%" : ""}${mm ? " · " + fnum(mm, 1) + " " + cU : ""}${f.wind_speed != null ? " · " + t("vento ", "wind ") + fnum(f.wind_speed, 0) + " " + uVento(w) : ""}`;
    return `<g><title>${esc(titolo)}</title><rect class="hz" x="${i * COL}" y="0" width="${COL}" height="${Hh}"/>
      ${mezzanotte ? `<path class="mz" d="M${i * COL} 8V${yO - 12}"/><text class="gn" x="${i * COL + 4}" y="${yO + 1}">${esc(d.toLocaleDateString(LOC, { weekday: "short" }))}</text>` : ""}
      ${mostra ? `<text class="ic" x="${x}" y="${yI}">${icona(f.condition, notte)}</text>` : ""}
      ${mostra && T[i] != null ? `<text class="tv" x="${x}" y="${(Y(T[i]) - 10).toFixed(1)}" style="fill:${coloreT(inC(T[i], w))}">${Math.round(T[i])}°</text>` : ""}
      ${hP > 0 ? `<rect class="pb" x="${(x - COL * .26).toFixed(1)}" y="${(yP1 - hP).toFixed(1)}" width="${(COL * .52).toFixed(1)}" height="${hP.toFixed(1)}" rx="3" style="opacity:${(.38 + (p ?? 50) / 100 * .62).toFixed(2)}"/>` : ""}
      ${mostra && p != null && p >= 20 ? `<text class="pp" x="${x}" y="${(yP1 - hP - 4).toFixed(1)}">${Math.round(p)}%</text>` : ""}
      ${mezzanotte ? "" : `<text class="or" x="${x}" y="${yO}">${i === 0 ? t("Ora", "Now") : mostra ? String(d.getHours()).padStart(2, "0") : ""}</text>`}</g>`;
  }).join("");
  /* gradiente della linea: il colore segue la temperatura */
  const stops = [0, .25, .5, .75, 1].map(k => { const v = hi - (hi - lo) * k; return `<stop offset="${(k * 100).toFixed(0)}%" stop-color="${coloreT(inC(v, w))}"/>`; }).join("");
  const svg = `<svg class="mt1h" viewBox="0 0 ${VW} ${Hh}" style="min-width:${N * 38}px" role="img" aria-label="${t("Temperatura e probabilità di pioggia, ora per ora", "Temperature and chance of rain, hour by hour")}">
    <defs><linearGradient id="mt1lg" gradientUnits="userSpaceOnUse" x1="0" y1="${yT0}" x2="0" y2="${yT1}">${stops}</linearGradient>
      <linearGradient id="mt1ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd60a" stop-opacity=".22"/><stop offset="1" stop-color="#ffd60a" stop-opacity="0"/></linearGradient></defs>
    <path class="bp" d="M0 ${yP1 + .5}H${VW}"/>${colonne}<path class="ar" d="${area}"/><path class="ln" d="${curva}" stroke="url(#mt1lg)"/>
    <circle class="ad" cx="${pts[0][0]}" cy="${pts[0][1]}" r="4.5"/></svg>`;
  return `<section class="card span3 mt1hc"><div class="ch"><h2>🕐 ${t("Ora per ora", "Hour by hour")}</h2>${H.length > 24 ? `<div class="seg"><button class="${n === 24 ? "act" : ""}" data-act="mtOre" data-v="24">24 h</button><button class="${n === 48 ? "act" : ""}" data-act="mtOre" data-v="48">48 h</button></div>` : ""}</div>
    <div class="mt1hs">${svg}</div>
    <div class="mt1lgd"><span><i class="lt"></i>${t("Temperatura", "Temperature")}</span><span><i class="lp"></i>${t("Probabilità di pioggia", "Chance of rain")}</span></div></section>`;
}
ACT.mtOre = el => { sSet("meteoOre", el.dataset.v); render(); };

function prossimiGiorni(w, D, largo) {
  if (!D.length) return "";
  const vals = D.flatMap(d => [num(d.temperature), num(d.templow)]).filter(v => v != null); if (!vals.length) return "";
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1, pos = v => ((v - mn) / sp * 100).toFixed(1), Tn = A(w, "temperature"), cU = attr(w, "precipitation_unit") || "mm";
  const righe = D.map((d, i) => {
    const oggi = d.g === inizioOggi(), dom = d.g === inizioOggi() + G, hiV = num(d.temperature), loV = num(d.templow) ?? hiV, p = num(d.precipitation_probability), mm = num(d.precipitation);
    const nome = oggi ? t("Oggi", "Today") : dom ? t("Domani", "Tomorrow") : new Date(d.g).toLocaleDateString(LOC, { weekday: window.innerWidth < 700 ? "short" : "long" });
    const vento = d.wind_speed != null ? `💨 ${fnum(d.wind_speed, 0)}${gradi(d.wind_bearing) != null ? " " + sigla(gradi(d.wind_bearing)) : ""}` : "";
    return `<div class="mt1d ${oggi ? "oggi" : ""}"><span class="dn"><b>${esc(nome)}</b><small>${esc(new Date(d.g).toLocaleDateString(LOC, { day: "numeric", month: "short" }))}</small></span>
      <span class="di" title="${esc((WX()[d.condition] || ["", d.condition || ""])[1])}">${icona(d.condition)}</span>
      <span class="dp ${p != null && p >= 50 ? "hi" : ""}">${p != null && p >= 10 ? "💧" + Math.round(p) + "%" : mm ? "💧" + fnum(mm, 1) : ""}</span>
      <span class="dl">${loV != null ? gr(loV) : ""}</span>
      <span class="db"><i style="left:${pos(loV ?? hiV)}%;right:${(100 - pos(hiV ?? loV)).toFixed(1)}%;background:linear-gradient(90deg,${coloreT(inC(loV, w))},${coloreT(inC(hiV, w))})"></i>${oggi && Tn != null ? `<u style="left:${lim(+pos(Tn), 0, 100)}%"></u>` : ""}</span>
      <span class="dh">${hiV != null ? gr(hiV) : ""}</span>
      ${largo ? `<span class="dx">${vento}${mm ? ` · ${fnum(mm, 1)} ${esc(cU)}` : ""}</span>` : ""}</div>`;
  }).join("");
  return `<section class="card mt1dc ${largo ? "span2" : "span3"}"><div class="ch"><h2>📅 ${t("Prossimi giorni", "Next days")}</h2><span class="small muted">${D.length} ${t("giorni", "days")}</span></div><div class="mt1dl ${largo ? "lg" : ""}">${righe}</div></section>`;
}

/* ================= pagina ================= */
function pagina() {
  const w = meteoPagina();
  if (!w || !S[w]) return `<div class="g g3"><section class="card span3">${`<div class="empty">${t("Nessun meteo in Home Assistant: aggiungi un'integrazione meteo (per esempio «Meteorologisk institutt (Met.no)»).", "No weather in Home Assistant: add a weather integration (for example «Meteorologisk institutt (Met.no)»).")}</div>`}</section></div>`;
  const D = giornaliere(w), H = orarie(w), L = allerte(w);
  /* i sensori di casa solo accanto al meteo di casa, non a quello di un altro posto */
  const lato = [w === weatherEnt() ? sensoriCard(w, D) : "", radarCard()].filter(Boolean).join("");
  const fonte = attr(w, "attribution");
  return `<div class="g g3 mt1p">${allerteCard(L)}${adesso(w, D, H)}${oraPerOra(w, H)}${prossimiGiorni(w, D, !!lato)}${lato ? `<div class="mt1sd">${lato}</div>` : ""}
    ${!D.length && !H.length ? `<section class="card span3"><div class="small muted">${t("Questo meteo non dà previsioni.", "This weather source has no forecast.")}</div></section>` : ""}
    ${fonte ? `<div class="span3 small muted mt1fo">${esc(fonte)}</div>` : ""}</div>`;
}

/* ---------- 📍 quale meteo (su questo dispositivo) ---------- */
function sceltaMeteo() {
  const cur = sGet("meteoEnt") || "", casa = weatherEnt();
  const riga = (id, tit, sub, sel) => { const [ic] = WX()[S[id]?.state] || ["🌡️"]; return `<button class="li ${sel ? "sel1" : ""}" data-act="mtEntSet" data-id="${id === casa && !tit ? "" : id}"><span class="ic">${ic}</span><div class="tx"><b>${esc(tit || nm(id))}</b><span>${sub}</span></div></button>`; };
  return `<div class="sh-head"><div><h3>📍 ${t("Quale meteo", "Which weather")}</h3><div class="small muted">${t("Vale solo su questo dispositivo. Il meteo di casa si sceglie in Home → ✏️ Modifica.", "Only on this device. The home weather is chosen in Home → ✏️ Edit.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${casa ? riga(casa, "🏠 " + t("Meteo di casa", "Home weather"), esc(nm(casa)) + " · " + gr(A(casa, "temperature")), !cur) : ""}
    ${meteiTutti().sort((a, b) => nm(a).localeCompare(nm(b), LOC)).map(id => `<button class="li ${cur === id ? "sel1" : ""}" data-act="mtEntSet" data-id="${id}"><span class="ic">${(WX()[S[id].state] || ["🌡️"])[0]}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc((WX()[S[id].state] || ["", S[id].state])[1])} · ${gr(A(id, "temperature"))} · ${esc(id)}</span></div></button>`).join("")}</div>`;
}
Object.assign(ACT, {
  mtEnt: () => openSheet(sceltaMeteo),
  mtEntSet: el => { sSet("meteoEnt", el.dataset.id || ""); closeSheet(); toast("📍 " + nm(meteoPagina())); },
});

/* ---------- ⚙️ impostazioni della casa (amministratori) ---------- */
function impostazioni() {
  const c = C(), al = c.allerte || {}, r = c.radar || {}, soglia = al.home ?? 3, F = fonti(), meno = (al.meno || []).filter(id => S[id]);
  const rigaS = ([k, ic, n]) => { const v = c.sensori?.[k], au = autoSensore(k);
    return `<button class="li" data-act="mtSens" data-k="${k}"><span class="ic">${ic}</span><div class="tx"><b>${n}</b><span>${v === "none" ? "🚫 " + t("nessuno", "none") : v && S[v] ? esc(nm(v)) + " · " + valTxt(v) : au ? "✨ " + esc(nm(au)) + " · " + valTxt(au) : "✨ " + t("automatico: non trovato", "automatic: not found")}</span></div><span class="st">›</span></button>`; };
  const cam = radarCam();
  return `<div class="sh-head"><div><h3>⚙️ ${t("Meteo", "Weather")}</h3><div class="small muted">${t("Valgono per tutta la casa.", "They apply to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">🏡 ${t("Sensori di casa", "Home sensors")}</div>
    <p class="small muted" style="margin:0 2px 8px">${t("Le misure della tua stazione meteo o dei sensori esterni, mostrate accanto alle previsioni. Li trovo da solo; se sbaglio, scegli tu.", "Readings from your weather station or outdoor sensors, shown next to the forecast. I find them myself; if I get it wrong, pick them.")}</p>
    <div class="stack">${KIND().map(rigaS).join("")}</div>
    <div class="fl1">⚠️ ${t("Allerte meteo", "Weather warnings")}</div>
    <p class="small muted" style="margin:0 2px 8px">${t("Da Meteoalarm, Protezione Civile, DWD, Météo-France, NWS e simili. Le trovo da solo; puoi aggiungerne o toglierne.", "From Meteoalarm, Civil Protection, DWD, Météo-France, NWS and similar. I find them myself; you can add or remove them.")}</p>
    <div class="stack">${F.map(id => { const n = allerteDi(id).length; return `<div class="li"><span class="ic">${n ? "⚠️" : "✅"}</span><div class="tx"><b>${esc(nm(id))}</b><span>${esc(id)} · ${n ? n + " " + t(n === 1 ? "allerta" : "allerte", n === 1 ? "warning" : "warnings") : t("nessuna allerta", "no warnings")}</span></div><button class="btn sm" data-act="mtAlMeno" data-id="${id}">✕</button></div>`; }).join("")
      || `<div class="small muted" style="padding:4px 2px">${t("Nessuna fonte di allerte trovata.", "No warning source found.")}</div>`}
      ${meno.map(id => `<div class="li dis"><span class="ic">🚫</span><div class="tx"><b>${esc(nm(id))}</b><span>${t("tolta", "removed")}</span></div><button class="btn sm" data-act="mtAlRimetti" data-id="${id}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}
      <button class="add1" data-act="mtAlPiu"><span>＋</span>${t("Aggiungi una fonte di allerte", "Add a warning source")}</button></div>
    <div class="row between" style="gap:10px;flex-wrap:wrap;margin-top:12px"><span class="small"><b>${t("In Home, negli Avvisi", "On Home, in Alerts")}</b><br><span class="muted">${t("da quale livello mostrare l'allerta", "from which level to show the warning")}</span></span>
      <div class="seg">${[[2, "🟡 " + t("Gialla", "Yellow")], [3, "🟠 " + t("Arancione", "Orange")], [4, "🔴 " + t("Rossa", "Red")], [0, t("Mai", "Never")]].map(([v, n]) => `<button class="${soglia === v ? "act" : ""}" data-act="mtAlHome" data-v="${v}">${n}</button>`).join("")}</div></div>
    <div class="fl1">🛰️ ${t("Radar pioggia", "Rain radar")}</div>
    <p class="small muted" style="margin:0 2px 8px">${t("Compare solo se c'è una telecamera radar in Home Assistant (per esempio RainViewer) o se scrivi qui l'indirizzo di un'immagine. Non carico nient'altro.", "Shown only if there's a radar camera in Home Assistant (for example RainViewer) or if you enter an image address here. I don't load anything else.")}</p>
    <div class="stack"><button class="li" data-act="mtRadCam"><span class="ic">📷</span><div class="tx"><b>${t("Telecamera radar", "Radar camera")}</b><span>${r.cam === "none" ? "🚫 " + t("nessuna", "none") : r.cam && S[r.cam] ? esc(nm(r.cam)) : cam ? "✨ " + esc(nm(cam)) : "✨ " + t("automatica: non trovata", "automatic: not found")}</span></div><span class="st">›</span></button></div>
    <label class="fld1"><span>${t("Indirizzo di un'immagine radar (facoltativo)", "Radar image address (optional)")}</span><input id="mt1ru" type="url" inputmode="url" value="${esc(r.url || "")}" placeholder="https://… ${t("oppure", "or")} /local/radar.gif" autocomplete="off"></label>
    <label class="fld1"><span>${t("Ogni quanti minuti ricaricarla", "Reload every how many minutes")}</span><input id="mt1rm" type="number" min="1" max="120" step="1" value="${radarMin()}" style="max-width:120px"></label>
    <p class="small muted" style="margin:6px 2px 0">${t("Vale anche per la telecamera. Un'immagine pubblica di un servizio radar va bene; controlla che il servizio ne permetta l'uso.", "Applies to the camera too. A public image from a radar service is fine; check the service allows it.")}</p>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn pri" data-act="mtRadSalva">💾 ${t("Salva il radar", "Save radar")}</button>${r.url ? `<button class="btn bad" data-act="mtRadVia">✕ ${t("Togli l'indirizzo", "Remove address")}</button>` : ""}</div>`;
}
const riapri = () => openSheet(impostazioni);
const salvaMeteo = (fn, msg) => cambia(l => { l.meteo = JSON.parse(JSON.stringify(l.meteo || {})); fn(l.meteo); }, msg);
Object.assign(ACT, {
  mtCfg: () => riapri(),
  mtSens: el => {
    const k = el.dataset.k, [, ic, n] = KIND().find(x => x[0] === k), au = autoSensore(k);
    scegli({ titolo: ic + " " + esc(n), sotto: t("Scegli il sensore di casa, «Automatico» o «Nessuno».", "Pick the home sensor, «Automatic» or «None»."), filtro: FILTRO[k], auto: au || undefined,
      attuale: C().sensori?.[k] || "", nessuno: true,
      onPick: id => salvaMeteo(m => { m.sensori = { ...(m.sensori || {}) }; if (id) m.sensori[k] = id; else delete m.sensori[k]; }, "💾 " + n).then(riapri) });
  },
  mtAlMeno: el => { const id = el.dataset.id; salvaMeteo(m => { const a = m.allerte = { ...(m.allerte || {}) }; a.piu = (a.piu || []).filter(x => x !== id); if (fontiAuto().includes(id)) a.meno = [...new Set([...(a.meno || []), id])]; }, "✕ " + nm(id)); },
  mtAlRimetti: el => { const id = el.dataset.id; salvaMeteo(m => { const a = m.allerte = { ...(m.allerte || {}) }; a.meno = (a.meno || []).filter(x => x !== id); }, "↺ " + nm(id)); },
  mtAlPiu: () => scegli({ titolo: "＋ " + t("Fonte di allerte", "Warning source"), sotto: t("Un sensore che dà le allerte meteo della tua zona.", "A sensor that gives the weather warnings for your area."), auto: false, attuale: null,
    filtro: id => /^(sensor|binary_sensor)\./.test(id) && !fonti().includes(id),
    onPick: id => id && id !== "none" && salvaMeteo(m => { const a = m.allerte = { ...(m.allerte || {}) }; a.piu = [...new Set([...(a.piu || []), id])]; a.meno = (a.meno || []).filter(x => x !== id); }, "＋ " + nm(id)).then(riapri) }),
  mtAlHome: el => { const v = +el.dataset.v; salvaMeteo(m => { m.allerte = { ...(m.allerte || {}), home: v }; }, v ? "🔔 " + t("Avvisi da ", "Alerts from ") + LIV()[v][0].toLowerCase() : t("Allerte meteo non più negli Avvisi", "Weather warnings no longer in Alerts")); },
  mtRadCam: () => scegli({ titolo: "📷 " + t("Telecamera radar", "Radar camera"), sotto: t("Una telecamera di Home Assistant con l'immagine del radar.", "A Home Assistant camera with the radar image."), filtro: id => id.startsWith("camera."),
    auto: radarAuto() || undefined, attuale: C().radar?.cam || "", nessuno: true,
    onPick: id => salvaMeteo(m => { m.radar = { ...(m.radar || {}) }; if (id) m.radar.cam = id; else delete m.radar.cam; }, "📷 " + (id && id !== "none" ? nm(id) : id === "none" ? t("Nessuna telecamera", "No camera") : t("Automatica", "Automatic"))).then(riapri) }),
  mtRadSalva: () => {
    const u = (document.getElementById("mt1ru")?.value || "").trim(), mi = Math.round(+(document.getElementById("mt1rm")?.value || 5));
    if (u && !/^(https?:\/\/|\/)/i.test(indirizzoLocale(u))) return toast(t("L'indirizzo deve iniziare con https:// o /local/", "The address must start with https:// or /local/"), true);
    if (!(mi >= 1 && mi <= 120)) return toast(t("Minuti: da 1 a 120", "Minutes: 1 to 120"), true);
    salvaMeteo(m => { m.radar = { ...(m.radar || {}), min: mi }; if (u) m.radar.url = indirizzoLocale(u); else delete m.radar.url; }, "🛰️ " + t("Radar salvato", "Radar saved"));
  },
  mtRadVia: () => salvaMeteo(m => { m.radar = { ...(m.radar || {}) }; delete m.radar.url; }, t("Indirizzo tolto", "Address removed")),
});

page("meteo", { title: t("Meteo", "Weather"), short: t("Meteo", "Weather"), icon: "🌦️", order: 16,
  show: () => !!meteoPagina(),
  badge: () => { try { return allerte().some(a => a.lv >= 3); } catch { return false; } },
  render: pagina });

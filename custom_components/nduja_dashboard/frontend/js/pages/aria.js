/* Qualità dell'aria: CO₂, polveri sottili (PM2.5, PM10), VOC, NO₂, formaldeide, radon e umidità di ogni stanza, con un giudizio semplice
   (Ottima, Buona, Discreta, Scarsa), consigli in parole semplici, grafici, purificatori, deumidificatori e umidificatori.
   Compare solo se in casa ci sono questi sensori o questi dispositivi. I sensori di fuori (giardino, terrazzo, servizi come WAQI) non sono
   stanze: servono solo ai consigli («fuori l'aria è peggiore»).
   Scelte in LAYOUT.aria = { soglie:{ tipo:[a,b,c] } (umidità: [ottima da, a, buona da, a, discreta da, a]), avviso:{ on, min }, ricambio: minuti,
   filtro: %, extra:[sensori aggiunti], tolti:[sensori tolti], tipi:{ id: tipo }, dispExtra:[], dispTolti:[],
   consigliDa: 2 (Discreta) | 3 (solo Scarsa), fuori:{ area: true|false } (stanza di fuori o no, scelta a mano), dispTipi:{ id: purif|deum|umid } }

   Come giudico l'aria (valori predefiniti, scritti per 'Nduja partendo da riferimenti pubblici; gli amministratori li cambiano in ⚙️):
   tipo        unità    Ottima fino a   Buona fino a   Discreta fino a   oltre = Scarsa     riferimento
   CO₂         ppm          800            1000            1400                            ricambio d'aria nelle stanze (uso comune, es. EN 16798)
   PM2.5       µg/m³         10              15            37,5                            OMS 2021: 15 in 24 ore; 37,5 = obiettivo intermedio 3
   PM10        µg/m³         20              45              75                            OMS 2021: 45 in 24 ore; 75 = obiettivo intermedio 3
   VOC         µg/m³        300            1000            3000                            agenzia tedesca per l'ambiente (UBA), livelli 1-3
   VOC         ppb           65             220             660                            gli stessi livelli in ppb (miscela tipica, come Sensirion)
   VOC indice  —            100             150             250                            indice Sensirion: 100 = come nelle ultime 24 ore
   NO₂         µg/m³         10              25              50                            OMS 2021: 10 in un anno, 25 in 24 ore, 50 = obiettivo intermedio 2
   Formaldeide µg/m³         30              60             100                            OMS: 100 in 30 minuti
   Radon       Bq/m³         50             100             300                            OMS: 100; Italia (D.Lgs. 101/2020): livello di riferimento 300
   Umidità     %          40–60           35–65           30–70        fuori da 30–70     muffe e acari sopra, aria secca sotto
   Il giudizio della stanza è quello della misura peggiore. */
import { S, AREAS, FLOORS, REG, DEVICES, ACT, CHG, LAYOUT, UI, VISTE, HOME_EXTRA, PAGES, t, LOC, esc, nm, nmHA, ok, attr, unit, fnum, ents, allEnts, areaOf, areasSorted,
  deviceClass, card, page, svc, toast, openSheet, closeSheet, render, isAdmin, ws, cached, sGet, sSet, utenteCfg, openings, isOn, durata, shortName } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { grafico, periodi, FASCE } from "../grafici.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const C = () => LAYOUT.aria || {};
const arCambia = (fn, msg) => cambia(l => { l.aria = JSON.parse(JSON.stringify(l.aria || {})); fn(l.aria, l); }, msg);
const MIN = 6e4;

/* ================= livelli ================= */
export const LIV = () => [[t("Ottima", "Excellent"), "#30d158"], [t("Buona", "Good"), "#9fd356"], [t("Discreta", "Fair"), "#ff9f0a"], [t("Scarsa", "Poor"), "#ff453a"]];
/* tipi di misura: nome, unità di riferimento, soglie predefinite, decimali, spiegazione */
const TIPI = () => ({
  co2: { n: "CO₂", u: "ppm", s: [800, 1000, 1400], d: 0, ic: "🫁",
    x: t("Si accumula respirando in una stanza chiusa: sopra 1000 ppm ci si concentra meno, sopra 1400 l'aria è viziata.", "It builds up as people breathe in a closed room: above 1000 ppm it's harder to focus, above 1400 the air is stale.") },
  pm25: { n: "PM2.5", u: "µg/m³", s: [10, 15, 37.5], d: 0, ic: "🌫️",
    x: t("Polveri sottilissime: fumo, cucina, candele, traffico. Soglie dalle linee guida OMS 2021 (15 µg/m³ in 24 ore).", "Very fine dust: smoke, cooking, candles, traffic. Thresholds from the WHO 2021 guidelines (15 µg/m³ over 24 hours).") },
  pm10: { n: "PM10", u: "µg/m³", s: [20, 45, 75], d: 0, ic: "🌫️",
    x: t("Polveri più grosse: polvere di casa, pollini, traffico. OMS 2021: 45 µg/m³ in 24 ore.", "Coarser dust: house dust, pollen, traffic. WHO 2021: 45 µg/m³ over 24 hours.") },
  voc: { n: "VOC", u: "µg/m³", s: [300, 1000, 3000], d: 0, ic: "🧴",
    x: t("Sostanze che evaporano da detersivi, vernici, colle, mobili nuovi e cucina. Soglie dalla guida dell'agenzia tedesca per l'ambiente (UBA).", "Substances evaporating from cleaners, paints, glues, new furniture and cooking. Thresholds from the German Environment Agency (UBA) guide.") },
  vocp: { n: "VOC", u: "ppb", s: [65, 220, 660], d: 0, ic: "🧴",
    x: t("Come i VOC in µg/m³, misurati in parti per miliardo: gli stessi livelli UBA per una miscela tipica.", "Same as VOC in µg/m³, measured in parts per billion: the same UBA levels for a typical mix.") },
  voci: { n: t("VOC (indice)", "VOC (index)"), u: "", s: [100, 150, 250], d: 0, ic: "🧴",
    x: t("Indice dei sensori Sensirion: 100 vuol dire «come nelle ultime 24 ore», più alto = più sostanze del solito.", "Sensirion sensor index: 100 means «like the last 24 hours», higher = more substances than usual.") },
  no2: { n: "NO₂", u: "µg/m³", s: [10, 25, 50], d: 0, ic: "🔥",
    x: t("Biossido di azoto: viene soprattutto dai fornelli a gas e dal traffico. OMS 2021: 25 µg/m³ in 24 ore.", "Nitrogen dioxide: mostly from gas stoves and traffic. WHO 2021: 25 µg/m³ over 24 hours.") },
  hcho: { n: t("Formaldeide", "Formaldehyde"), u: "µg/m³", s: [30, 60, 100], d: 0, ic: "🪑",
    x: t("Esce da mobili in truciolato, colle, fumo. OMS: non oltre 100 µg/m³ in 30 minuti.", "Released by chipboard furniture, glues, smoke. WHO: no more than 100 µg/m³ over 30 minutes.") },
  radon: { n: "Radon", u: "Bq/m³", s: [50, 100, 300], d: 0, ic: "🪨",
    x: t("Gas naturale che sale dal terreno; conta la media nel tempo. L'OMS consiglia di restare sotto 100 Bq/m³, in Italia il livello di riferimento è 300.", "Natural gas rising from the ground; the long-term average is what counts. WHO advises staying below 100 Bq/m³; Italy's reference level is 300.") },
  hum: { n: t("Umidità", "Humidity"), u: "%", s: [40, 60, 35, 65, 30, 70], d: 0, ic: "💧",
    x: t("Tra 40% e 60% si sta bene: sopra 65% crescono muffe e acari, sotto 35% l'aria secca irrita gola e occhi.", "Between 40% and 60% feels right: above 65% mould and mites grow, below 35% dry air irritates throat and eyes.") },
});
const ORDINE = ["co2", "pm25", "pm10", "voc", "vocp", "voci", "no2", "hcho", "radon", "hum"];
const nomeTipo = k => TIPI()[k]?.n || k;
/** soglie in uso: quelle scelte (se valide), altrimenti le predefinite */
export function soglie(k) {
  const d = TIPI()[k]?.s || [], v = C().soglie?.[k];
  if (!Array.isArray(v) || v.length !== d.length || v.some(x => typeof x !== "number" || isNaN(x))) return d;
  return v;
}
const validaSoglie = (k, v) => k === "hum" ? v[2] <= v[0] && v[0] <= v[1] && v[1] <= v[3] && v[4] <= v[2] && v[3] <= v[5] && v[4] >= 0 && v[5] <= 100 : v[0] < v[1] && v[1] < v[2] && v[0] >= 0;
/** livello 0 (Ottima) … 3 (Scarsa) di un valore già nell'unità di riferimento */
export function livello(k, v) {
  if (v == null || isNaN(v)) return null;
  const s = soglie(k);
  if (k === "hum") return v >= s[0] && v <= s[1] ? 0 : v >= s[2] && v <= s[3] ? 1 : v >= s[4] && v <= s[5] ? 2 : 3;
  return v <= s[0] ? 0 : v <= s[1] ? 1 : v <= s[2] ? 2 : 3;
}
const alta = (k, v) => k === "hum" ? v > soglie("hum")[1] : true;   // l'umidità può essere troppo alta o troppo bassa

/* ================= quali sensori ================= */
const testo = id => (id + " " + nmHA(id)).toLowerCase().replace(/[_.]/g, " ");
const uNorm = u => String(u || "").replace(/μ/g, "µ").replace(/\s/g, "").replace(/3$/, "³").toLowerCase();
const NON_ARIA = /tesla|model ?[3sxy]( |$)|vehicle|veicol|frigo|fridge|freezer|congel|wine|vino|serra|greenhouse|terrari|acquari|aquari|soil|terreno|suolo|piant|plant|dew|rugiada|absolute|assolut|(^| )(max|min|avg|average|media|mean|24h|8h|1h|forecast|previsione|domani|tomorrow|trend|aqi)( |$)/;
/** che misura è (co2, pm25, …) oppure null */
export function tipoDi(id) {
  const c = C().tipi?.[id]; if (c && TIPI()[c]) return c;
  if (!id.startsWith("sensor.")) return null;
  const dc = deviceClass(id), s = testo(id), u = uNorm(unit(id));
  if (NON_ARIA.test(s) && !(dc === "aqi" && /voc/.test(s))) return null;
  if (dc === "carbon_dioxide") return "co2";
  if (dc === "pm25") return "pm25";
  if (dc === "pm10") return "pm10";
  if (dc === "nitrogen_dioxide") return "no2";
  if (dc === "volatile_organic_compounds") return "voc";
  if (dc === "volatile_organic_compounds_parts") return "vocp";
  if (dc === "humidity") return "hum";
  if (dc === "aqi" && /(^| )t?voc/.test(s)) return "voci";
  if (dc) return null;   // altre misure (pm1, ozono, monossido…): non sono in questa pagina
  if (/(^| )(co2|co₂)( |$)|carbon dioxide|anidride carbonica/.test(s) && (!u || u === "ppm")) return "co2";
  if (/(^| )pm ?2[ ,]?5( |$)|pm2 5|pm25/.test(s)) return "pm25";
  if (/(^| )pm ?10( |$)/.test(s)) return "pm10";
  if (/formald|hcho|ch2o/.test(s)) return "hcho";
  if (/radon/.test(s)) return "radon";
  if (/(^| )(no2|no₂)( |$)|nitrogen dioxide|biossido di azoto/.test(s)) return "no2";
  if (/(^| )t?voc/.test(s)) return /^pp[bm]$/.test(u) ? "vocp" : /g\/m³$/.test(u) ? "voc" : "voci";
  return null;
}
/** fattore per passare dall'unità del sensore a quella di riferimento (null = unità che non conosco) */
function fattore(k, uRaw) {
  const u = uNorm(uRaw);
  switch (k) {
    case "co2": return !u || u === "ppm" ? 1 : u === "%" ? 1e4 : null;
    case "pm25": case "pm10": return /^(µ|u)g\/m³$/.test(u) || !u ? 1 : u === "mg/m³" ? 1000 : null;
    case "voc": return /^(µ|u)g\/m³$/.test(u) || !u ? 1 : u === "mg/m³" ? 1000 : null;
    case "vocp": return u === "ppb" || !u ? 1 : u === "ppm" ? 1000 : null;
    case "voci": return !u || /^(index|indice|voc)$/.test(u) ? 1 : null;
    case "no2": return /^(µ|u)g\/m³$/.test(u) || !u ? 1 : u === "ppb" ? 1.88 : u === "ppm" ? 1880 : u === "mg/m³" ? 1000 : null;
    case "hcho": return /^(µ|u)g\/m³$/.test(u) || !u ? 1 : u === "mg/m³" ? 1000 : u === "ppb" ? 1.23 : u === "ppm" ? 1230 : null;
    case "radon": return u === "bq/m³" || !u ? 1 : u === "pci/l" ? 37 : null;
    case "hum": return u === "%" ? 1 : null;
  }
  return null;
}
/** valore nell'unità di riferimento */
const conv = (k, v, u) => { const f = fattore(k, u); return f == null || v == null || isNaN(v) ? null : v * f; };
const valore = (id, k) => ok(id) ? conv(k, parseFloat(S[id].state), unit(id)) : null;

const FUORI = /estern|outdoor|outside|fuori|giardin|garden|terrazz|balcon|cortile|yard|patio|veranda|portico|porch|tetto|roof/i;
const PIATT_FUORI = /^(waqi|airvisual|openaq|airly|luftdaten|sensor_community|google_air_quality|accuweather|openweathermap|ambee|iqair|airnow|purpleair|gios|nam|met|meteo_france|aemet|smhi|dwd_weather|open_meteo)$/;
const stanzaFuoriAuto = a => !!a && FUORI.test((AREAS[a]?.nameHA || "") + " " + (AREAS[a]?.name || "") + " " + a);
/** stanza di fuori: la scelta dell'amministratore (⚙️), altrimenti dal nome (giardino, terrazzo…) */
const stanzaFuori = a => { const v = C().fuori?.[a]; return typeof v === "boolean" ? v : stanzaFuoriAuto(a); };
/** è un sensore di fuori? (area esterna, oppure senza stanza scelta a mano e con un nome o un servizio di fuori) */
function diFuori(id) {
  const a = areaOf(id); if (a) return stanzaFuori(a) || (!LAYOUT.rooms?.[id] && PIATT_FUORI.test(REG[id]?.platform || ""));
  return FUORI.test(nmHA(id) + " " + id) || PIATT_FUORI.test(REG[id]?.platform || "");
}
/* l'umidità di una stanza: una sola, quella scelta per la stanza (Home → ✏️) oppure la più adatta */
function umiditaStanza(a, L) {
  if (!L.length) return [];
  const sc = LAYOUT.sensors?.[a]?.hum; if (sc === "none") return []; if (sc && L.includes(sc)) return [sc];
  const punti = id => { let p = 0; const dev = REG[id]?.device; if (dev && Object.keys(S).some(x => x !== id && REG[x]?.device === dev && deviceClass(x) === "temperature")) p += 2; if (/umid|humid/i.test(nmHA(id))) p += 1; if (!ok(id)) p -= 3; return p; };
  return [[...L].sort((x, y) => punti(y) - punti(x) || x.localeCompare(y))[0]];
}
let memo = { t: 0, k: null, v: null };
/** tutti i sensori della pagina: { id, k (tipo), a (stanza o "_"), fuori } */
export function sensori() {
  const k = [LAYOUT.aria, LAYOUT.rooms, LAYOUT.sensors, LAYOUT.exclude, LAYOUT.include, LAYOUT.hiddenAreas, LAYOUT.mode, Object.keys(S).length];
  if (memo.v && Date.now() - memo.t < 400 && k.every((x, i) => x === memo.k[i])) return memo.v;
  const c = C(), tolti = new Set(c.tolti || []), extra = (c.extra || []).filter(id => S[id] && !tolti.has(id));
  const trovati = ents("sensor", id => !tolti.has(id) && !!tipoDi(id) && fattore(tipoDi(id), unit(id)) != null);
  const out = [], umid = {};
  for (const id of new Set([...trovati, ...extra])) {
    const tp = tipoDi(id); if (!tp) continue;
    const fu = diFuori(id), a = areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_";
    if (tp === "hum" && !fu && !extra.includes(id)) { (umid[a] = umid[a] || []).push(id); continue; }
    if (tp === "hum" && fu) continue;   // l'umidità di fuori è della pagina Meteo
    out.push({ id, k: tp, a, fuori: fu });
  }
  for (const [a, L] of Object.entries(umid)) umiditaStanza(a, L).forEach(id => out.push({ id, k: "hum", a, fuori: false }));
  memo = { t: Date.now(), k, v: out };
  return out;
}

/* ================= dispositivi: purificatori, deumidificatori, umidificatori ================= */
const PURIF = /purif|depurat|luftreinig|air ?clean|starkvind|airmega|blueair|levoit|winix|vital ?100|core ?[2-6]00|ac ?\d{4}|zhimi ?airp|airpurifier|aeratore/i;
const PIATT_PURIF = /^(philips_airpurifier|philips_airpurifier_coap|blueair|winix|coway|iocare|airmega|levoit)$/;
const ePurificatore = id => id.startsWith("air_purifier.") || (id.startsWith("fan.") && (PURIF.test(id + " " + nmHA(id) + " " + (DEVICES[REG[id]?.device]?.model || "")) || PIATT_PURIF.test(REG[id]?.platform || "")));
export function dispositivi() {
  const c = C(), tolti = new Set(c.dispTolti || []);
  const L = [...ents("fan", ePurificatore), ...ents("humidifier"), ...allEnts("air_purifier")].filter(id => !tolti.has(id));
  const o = areasSorted(true), pos = id => { const i = o.indexOf(areaOf(id)); return i < 0 ? 999 : i; };
  return [...new Set([...L, ...(c.dispExtra || []).filter(id => S[id] && !tolti.has(id))])].sort((a, b) => pos(a) - pos(b) || nm(a).localeCompare(nm(b), LOC));
}
/** purif | deum | umid */
const TIPI_DISP = () => [["purif", "🌀 " + t("Purificatore", "Air purifier")], ["deum", "💧 " + t("Deumidificatore", "Dehumidifier")], ["umid", "💨 " + t("Umidificatore", "Humidifier")]];
function tipoDispAuto(id) {
  if (!id.startsWith("humidifier.")) return "purif";
  return deviceClass(id) === "dehumidifier" || /deumid|dehumid|asciug/i.test(id + " " + nmHA(id)) ? "deum" : "umid";
}
/** scelto a mano in ✏️ del dispositivo, altrimenti riconosciuto da solo */
function tipoDisp(id) { const v = C().dispTipi?.[id]; return ["purif", "deum", "umid"].includes(v) ? v : tipoDispAuto(id); }
const acceso = id => ok(id) && S[id].state === "on";
const stessoDisp = (id, pred) => { const dev = REG[id]?.device; return dev ? Object.keys(S).filter(x => x !== id && REG[x]?.device === dev && pred(x)) : []; };
/** stato del filtro: { pct, testo, cambia, id } oppure null */
function filtro(id) {
  const vic = stessoDisp(id, x => /filt/i.test(testo(x)) && /^(sensor|binary_sensor)\./.test(x));
  const soglia = filtroMin();
  const b = vic.find(x => x.startsWith("binary_sensor.") && ok(x));
  const pc = vic.find(x => x.startsWith("sensor.") && unit(x) === "%" && ok(x)) || null;
  const tempo = vic.find(x => x.startsWith("sensor.") && /^(h|d|days?|giorni|ore|hours?)$/i.test(unit(x)) && /left|remain|rimanent|resid|restant/i.test(testo(x)) && ok(x));
  let pct = pc ? +S[pc].state : attr(id, "filter_life_remaining") ?? attr(id, "filter_life_level") ?? attr(id, "filter_life");
  pct = pct == null || isNaN(+pct) ? null : clamp(+pct, 0, 100);
  if (pct == null && !b && !tempo) return null;
  const cambiaF = (b && S[b].state === "on") || (pct != null && pct <= soglia);
  const tp = tempo ? (() => { const v = +S[tempo].state, u = unit(tempo).toLowerCase(); return u.startsWith("h") || u === "ore" ? durata(v * 3600) : durata(v * 86400); })() : "";
  return { pct, cambia: cambiaF, id: pc || tempo || b || id,
    testo: (cambiaF ? t("da cambiare", "replace it") : t("ok", "ok")) + (pct != null ? ` · ${Math.round(pct)}%` : "") + (tp ? ` · ${tp}${t("", " left")}` : "") };
}
const NOMI_MODI = () => ({ auto: "Auto", automatic: "Auto", smart: "Smart", sleep: t("Notte", "Sleep"), night: t("Notte", "Night"), silent: t("Silenzioso", "Silent"), quiet: t("Silenzioso", "Quiet"),
  favorite: t("Preferita", "Favourite"), favourite: t("Preferita", "Favourite"), manual: t("Manuale", "Manual"), turbo: "Turbo", boost: "Boost", normal: t("Normale", "Normal"), eco: "Eco", comfort: "Comfort",
  home: t("Casa", "Home"), away: t("Fuori casa", "Away"), baby: t("Bambini", "Baby"), laundry: t("Bucato", "Laundry"), dry: t("Asciugatura", "Drying"), continuous: t("Continua", "Continuous"), pet: t("Animali", "Pets"),
  allergen: t("Allergeni", "Allergens"), pollen: t("Pollini", "Pollen"), low: t("Bassa", "Low"), medium: t("Media", "Medium"), high: t("Alta", "High"), max: "Max" });
const nomeModo = m => NOMI_MODI()[String(m).toLowerCase().replace(/[\s-]+/g, "_")] || String(m).replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

/* ================= stanze ================= */
const nomeStanza = a => a === "_" ? t("Senza stanza", "No room") : AREAS[a]?.name || a;
/** misure di ogni stanza (non di fuori): { a: [{ id, k, v, lv }] } in ordine di importanza */
function perStanza() {
  const g = {};
  for (const s of sensori()) { if (s.fuori) continue; const v = valore(s.id, s.k); (g[s.a] = g[s.a] || []).push({ ...s, v, lv: livello(s.k, v) }); }
  for (const a in g) g[a].sort((x, y) => (y.lv ?? -1) - (x.lv ?? -1) || ORDINE.indexOf(x.k) - ORDINE.indexOf(y.k));
  return g;
}
const stanzeOrdinate = g => { const o = areasSorted(true); return Object.keys(g).sort((a, b) => (o.indexOf(a) < 0 ? 999 : o.indexOf(a)) - (o.indexOf(b) < 0 ? 999 : o.indexOf(b))); };
/** giudizio di una stanza: { lv, peggio (la misura peggiore) } */
function giudizio(M) { const V = (M || []).filter(m => m.lv != null); return V.length ? { lv: Math.max(...V.map(m => m.lv)), peggio: V[0] } : { lv: null, peggio: null }; }
/** misure di fuori per i consigli: quella del tipo chiesto, altrimenti la peggiore tra le polveri */
function fuori(k) {
  const P = sensori().filter(s => s.fuori && ["pm25", "pm10"].includes(s.k)).map(s => ({ ...s, v: valore(s.id, s.k) })).filter(s => s.v != null).map(s => ({ ...s, lv: livello(s.k, s.v) }));
  return (k && P.find(s => s.k === k)) || P.sort((a, b) => b.lv - a.lv)[0] || null;
}
const fmt = (v, id) => { const x = parseFloat(v); if (isNaN(x)) return "—"; const a = Math.abs(x); return fnum(x, a < 1 && a > 0 ? (a < .1 ? 3 : 2) : a < 10 && x % 1 ? 1 : 0); };
const valTxt = id => !ok(id) ? "—" : fmt(S[id].state, id) + (unit(id) === "%" ? "%" : unit(id) ? " " + unit(id) : "");
const etichetta = m => m.k === "hum" ? t("Umidità", "Humidity") : nomeTipo(m.k);

/* ================= disegni della plancia: l'aria della stanza con le particelle (SVG + CSS, più fitte quando l'aria è peggiore) ================= */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
function rnd(seed) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
const QUANTE = [6, 12, 22, 36];   // particelle in un riquadro 240×80: la scena grande ne ha di più
const FORME = { big: [300, 170], pan: [300, 90], sm: [120, 60] };
export function scenaAria(lv, seme = "", cls = "") {
  const [W, H] = FORME[cls] || [240, 80], r = rnd(hash(seme) || 7), n = lv == null ? 0 : Math.round(QUANTE[lv] * Math.max(.45, W * H / 19200));
  const P = Array.from({ length: n }, (_, i) => {
    const x = 4 + r() * (W - 8), y = 4 + r() * (H - 8), rr = (lv >= 2 ? 1 : .75) + r() * (lv >= 2 ? 1.5 : 1), dx = (r() - .5) * (lv >= 2 ? 22 : 14), dy = (r() - .5) * (lv >= 2 ? 14 : 9);
    const d = (lv === 3 ? 3.2 : lv === 2 ? 4.6 : 7.5) + r() * 3.5, ri = -r() * d;
    return `<circle class="pt${i % 3}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;animation-duration:${d.toFixed(1)}s;animation-delay:${ri.toFixed(1)}s"/>`;
  }).join("");
  /* due soffi d'aria che scorrono piano: ci sono sempre, più chiari quando l'aria è buona */
  const soffi = `<path class="sf" d="M-10 ${H * .38} C ${W * .25} ${H * .2}, ${W * .45} ${H * .56}, ${W + 10} ${H * .34}"/><path class="sf s2" d="M-10 ${H * .7} C ${W * .3} ${H * .86}, ${W * .6} ${H * .5}, ${W + 10} ${H * .72}"/>`;
  return `<svg class="ar1s l${lv ?? "x"} ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="bg" width="${W}" height="${H}" rx="14"/>${soffi}<g class="pp">${P}</g></svg>`;
}
/* disegnini dei dispositivi: purificatore, deumidificatore, umidificatore (quando sono accesi si muove l'aria o l'acqua) */
function disegnoDisp(id) {
  const k = tipoDisp(id), on = acceso(id);
  const corpo = k === "purif"
    ? `<rect class="cp" x="16" y="10" width="32" height="50" rx="9"/><rect class="gr" x="21" y="15" width="22" height="6" rx="3"/>${[30, 36, 42, 48].map(y => `<path class="gl" d="M22 ${y}h20"/>`).join("")}<circle class="led" cx="32" cy="55" r="1.8"/>
       <g class="fl"><path d="M24 7c0-3 3-3 3-6"/><path d="M32 7c0-3 3-3 3-6"/><path d="M40 7c0-3 3-3 3-6"/></g>`
    : k === "deum"
      ? `<rect class="cp" x="13" y="12" width="38" height="48" rx="8"/><rect class="gr" x="18" y="17" width="28" height="7" rx="3.5"/><rect class="tk" x="18" y="38" width="28" height="17" rx="4"/><rect class="aq" x="19.5" y="47" width="25" height="6.5" rx="3"/><path class="gc" d="M32 28c-2.6 3.4-3.6 5-3.6 6.5a3.6 3.6 0 0 0 7.2 0c0-1.5-1-3.1-3.6-6.5z"/><circle class="led" cx="44" cy="30" r="1.8"/>`
      : `<path class="cp" d="M18 26c0-6 5-10 14-10s14 4 14 10v28a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z"/><rect class="aq" x="21" y="42" width="22" height="13" rx="4"/><rect class="gr" x="27" y="11" width="10" height="6" rx="3"/><circle class="led" cx="32" cy="34" r="1.8"/>
         <g class="ns"><circle cx="28" cy="6" r="3"/><circle cx="34" cy="4" r="3.6"/><circle cx="39" cy="7" r="2.6"/></g>`;
  return `<svg class="ar1d k-${k} ${on ? "on" : ""}" viewBox="0 0 64 64" aria-hidden="true">${corpo}</svg>`;
}

/* ================= consigli ================= */
const ricambio = () => clamp(Math.round(+C().ricambio || 10), 1, 120);
const filtroMin = () => clamp(Math.round(C().filtro ?? 10), 0, 50);
const minAvviso = () => clamp(Math.round(+C().avviso?.min || 30), 5, 720);
const avvisoOn = () => C().avviso?.on !== false;
/** da che livello dare i consigli: 2 = Discreta o peggio (predefinito), 3 = solo Scarsa */
const consigliDa = () => C().consigliDa === 3 ? 3 : 2;
const finestraAperta = a => a !== "_" && openings().some(id => areaOf(id) === a && isOn(id) && ["window", "opening"].includes(deviceClass(id)));
const dispStanza = (a, k) => dispositivi().filter(id => (areaOf(id) || "_") === a && ok(id) && (!k || tipoDisp(id) === k));
const climaDeumidifica = a => a === "_" ? null : ents("climate", id => areaOf(id) === a && ok(id) && (attr(id, "hvac_modes") || []).includes("dry"))[0] || null;
/** consigli in parole semplici: { a, lv, k, testo, az: { act, id, v, n } } */
function consigli(g = perStanza()) {
  const out = [], m = ricambio(), F = fuori();
  for (const a of stanzeOrdinate(g)) {
    const R = esc(nomeStanza(a)), fin = finestraAperta(a), visti = new Set();
    for (const x of g[a]) {
      const gruppo = { vocp: "voc", voci: "voc", hcho: "voc", pm10: "pm", pm25: "pm" }[x.k] || x.k;   // un consiglio solo per polveri e per sostanze
      if (x.lv == null || x.lv < consigliDa() || visti.has(gruppo)) continue;
      visti.add(gruppo);
      const V = `<b>${esc(valTxt(x.id))}</b>`, apri = fin ? t(" La finestra è già aperta: lasciala ancora un po'.", " The window is already open: leave it a bit longer.") : "";
      const Fk = fuori(x.k), fuoriPeggio = !!Fk && Fk.lv >= 2 && Fk.v >= x.v, fuoriMeglio = !!Fk && Fk.v < x.v * .7;
      let tx = "", az = null;
      if (x.k === "co2") {
        if (fin) continue;   // l'aria si sta già cambiando
        tx = t(`In ${R} la CO₂ è alta (${V}): apri la finestra ${m} minuti.`, `In ${R} CO₂ is high (${V}): open the window for ${m} minutes.`) + (F && F.lv === 3 ? t(" Fuori ci sono molte polveri: bastano pochi minuti.", " There's a lot of dust outside: a few minutes are enough.") : "");
      } else if (x.k === "pm25" || x.k === "pm10") {
        const P = dispStanza(a, "purif"), spento = P.find(id => !acceso(id)), lento = P.find(id => acceso(id) && attr(id, "percentage") != null && +attr(id, "percentage") < 100 && (+attr(id, "supported_features") & 1));
        if (spento && !P.some(acceso)) { tx = t(`In ${R} ci sono molte polveri sottili (${V}): accendi il purificatore.`, `In ${R} there's a lot of fine dust (${V}): turn on the air purifier.`); az = { act: "arFai", id: spento, v: "on", n: "▶ " + t("Accendi", "Turn on") }; }
        else if (lento) { tx = t(`In ${R} le polveri sottili sono ancora alte (${V}): metti il purificatore al massimo per un po'.`, `In ${R} fine dust is still high (${V}): set the purifier to maximum for a while.`); az = { act: "arFai", id: lento, v: "max", n: "⏫ " + t("Al massimo", "Maximum") }; }
        else if (P.some(acceso)) continue;   // il purificatore sta già lavorando al massimo
        else tx = fuoriPeggio ? t(`In ${R} ci sono molte polveri sottili (${V}), ma fuori è peggio: tieni chiuse le finestre.`, `In ${R} there's a lot of fine dust (${V}), but it's worse outside: keep the windows closed.`)
          : t(`In ${R} ci sono molte polveri sottili (${V}): arieggia ${m} minuti${fuoriMeglio ? ", fuori l'aria è più pulita" : ""}. Spesso vengono da cucina, candele o fumo.`, `In ${R} there's a lot of fine dust (${V}): air the room for ${m} minutes${fuoriMeglio ? ", the air outside is cleaner" : ""}. It often comes from cooking, candles or smoke.`) + apri;
      } else if (gruppo === "voc") {
        if (fin) continue;
        tx = t(`In ${R} ci sono sostanze nell'aria (${etichetta(x)} ${V}): arieggia ${m} minuti. Spesso vengono da detersivi, vernici, profumatori o mobili nuovi.`, `In ${R} there are substances in the air (${etichetta(x)} ${V}): air the room for ${m} minutes. They often come from cleaners, paints, air fresheners or new furniture.`);
      } else if (x.k === "no2") {
        tx = t(`In ${R} il biossido di azoto è alto (${V}): se hai cucinato col gas accendi la cappa e arieggia ${m} minuti.`, `In ${R} nitrogen dioxide is high (${V}): if you cooked on gas, turn on the hood and air the room for ${m} minutes.`) + apri;
      } else if (x.k === "radon") {
        tx = t(`In ${R} il radon è alto (${V}): arieggia spesso. Se resta alto per settimane, fai fare una misura da un tecnico.`, `In ${R} radon is high (${V}): air the room often. If it stays high for weeks, have it measured by a professional.`);
      } else if (x.k === "hum" && alta("hum", x.v)) {
        const D = dispStanza(a, "deum"), U = dispStanza(a, "umid").find(acceso), cl = climaDeumidifica(a);
        if (U) { tx = t(`Umidità ${V} in ${R} e l'umidificatore è acceso: spegnilo.`, `Humidity ${V} in ${R} and the humidifier is on: turn it off.`); az = { act: "arFai", id: U, v: "off", n: "⏹ " + t("Spegni", "Turn off") }; }
        else if (D.some(acceso)) continue;   // il deumidificatore sta già lavorando
        else if (D.length) { tx = t(`Umidità ${V} in ${R}: accendi il deumidificatore.`, `Humidity ${V} in ${R}: turn on the dehumidifier.`); az = { act: "arFai", id: D[0], v: "on", n: "▶ " + t("Accendi", "Turn on") }; }
        else if (cl && S[cl].state !== "dry") { tx = t(`Umidità ${V} in ${R}: metti il clima in deumidifica.`, `Humidity ${V} in ${R}: set the air conditioner to dry mode.`); az = { act: "arFai", id: cl, v: "dry", n: "💧 " + t("Deumidifica", "Dry") }; }
        else if (cl) continue;
        else { if (fin) continue; tx = t(`Umidità ${V} in ${R}: apri la finestra ${m} minuti${/bagn|bath|doccia|shower/i.test(nomeStanza(a)) ? " e accendi l'aspiratore" : ""}.`, `Humidity ${V} in ${R}: open the window for ${m} minutes${/bagn|bath|doccia|shower/i.test(nomeStanza(a)) ? " and turn on the extractor fan" : ""}.`); }
      } else if (x.k === "hum") {
        const U = dispStanza(a, "umid"), D = dispStanza(a, "deum").find(acceso);
        if (D) { tx = t(`L'aria in ${R} è secca (${V}) e il deumidificatore è acceso: spegnilo.`, `The air in ${R} is dry (${V}) and the dehumidifier is on: turn it off.`); az = { act: "arFai", id: D, v: "off", n: "⏹ " + t("Spegni", "Turn off") }; }
        else if (U.some(acceso)) continue;
        else if (U.length) { tx = t(`L'aria in ${R} è secca (${V}): accendi l'umidificatore.`, `The air in ${R} is dry (${V}): turn on the humidifier.`); az = { act: "arFai", id: U[0], v: "on", n: "▶ " + t("Accendi", "Turn on") }; }
        else tx = t(`L'aria in ${R} è secca (${V}): un umidificatore aiuta, e non scaldare troppo la stanza.`, `The air in ${R} is dry (${V}): a humidifier helps, and don't overheat the room.`);
      }
      if (tx) out.push({ a, lv: x.lv, k: x.k, testo: tx, az });
    }
  }
  return out.sort((x, y) => y.lv - x.lv);
}
const rigaConsiglio = c => `<div class="ar1c l${c.lv}"><i></i><p>${c.testo}</p>${c.az ? `<button class="btn sm" data-act="${c.az.act}" data-id="${c.az.id}" data-v="${c.az.v}">${c.az.n}</button>` : ""}</div>`;

/* ================= E) da quanto è «Scarsa»: dalla cronologia di Home Assistant ================= */
/** quando è iniziata la serie di valori «Scarsa» del sensore (ms); undefined = sto caricando, null = adesso non è scarsa */
function scarsaDa(m) {
  if (m.lv !== 3) return null;
  const W = Math.max(6 * 60, minAvviso() * 2) * MIN, u = unit(m.id);
  const H = cached("arH:" + m.id, 3 * MIN, () => ws({ type: "history/history_during_period", start_time: new Date(Date.now() - W).toISOString(), entity_ids: [m.id], minimal_response: true, no_attributes: true })
    .then(r => r?.[m.id] || []).catch(() => []));
  if (H === undefined) return undefined;
  const P = H.map(x => ({ t: ((x.lu ?? x.lc) || 0) * 1000, v: parseFloat(x.s) })).filter(p => p.t).sort((a, b) => a.t - b.t);
  if (!P.length) { const lc = Date.parse(S[m.id]?.last_changed); return isNaN(lc) ? Date.now() : lc; }   // niente cronologia: da quando il valore non cambia
  for (let i = P.length - 1; i >= 0; i--) if (isNaN(P[i].v) || livello(m.k, conv(m.k, P[i].v, u)) !== 3) return P[i + 1]?.t ?? Date.now();
  return P[0].t;
}
/** stanze «Scarsa» da più dei minuti scelti: [{ a, m (misura), da }] */
function scarseDaTempo(g = perStanza()) {
  const out = [];
  for (const a of stanzeOrdinate(g)) {
    let primo = null, mis = null;
    for (const m of g[a]) { if (m.lv !== 3) continue; const d = scarsaDa(m); if (d == null) continue; if (primo == null || d < primo) { primo = d; mis = m; } }
    if (primo != null && Date.now() - primo >= minAvviso() * MIN) out.push({ a, m: mis, da: primo });
  }
  return out;
}
const pagAttiva = () => !!PAGES.aria?.show() && LAYOUT.pages?.aria !== false && utenteCfg().pages?.aria !== false;
/* avvisi della Home (avvisi.js) */
VISTE.ariaAvvisi = () => {
  if (!avvisoOn()) return [];
  return scarseDaTempo().map(({ a, m, da }) => ({ k: "ar:" + a + ":" + Math.round(da / MIN), ic: "🍃", b: t("Aria scarsa in ", "Poor air in ") + esc(a === "_" ? shortName(m.id) : nomeStanza(a)),
      s: `${esc(etichetta(m))} ${esc(valTxt(m.id))} · ${t("da", "for")} ${durata((Date.now() - da) / 1000)}`, ...(pagAttiva() ? { go: "aria" } : { id: m.id }), cls: "alert" }));
};

/* ================= pagina ================= */
const pill = lv => lv == null ? `<span class="ar1l lx">—</span>` : `<span class="ar1l l${lv}">${esc(LIV()[lv][0])}</span>`;
/** da dove viene una misura («Purificatore»), per distinguere due misure uguali nella stessa stanza */
function fonte(id) {
  const a = AREAS[areaOf(id)]?.name || "", n = DEVICES[REG[id]?.device]?.name || nm(id);
  const s = n.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").replace(/\s+/g, " ").trim();
  return (s || n).slice(0, 22);
}
const chip = (m, doppio) => `<button class="ar1m l${m.lv ?? "x"}" data-act="more" data-id="${m.id}" title="${esc(nm(m.id))}"><i></i><span>${esc(etichetta(m))}${doppio ? ` <small>${esc(fonte(m.id))}</small>` : ""}</span><b>${esc(valTxt(m.id))}</b></button>`;
function tesseraStanza(a, M, Cs) {
  const { lv, peggio } = giudizio(M), adm = isAdmin() && UI.edit, c = Cs.find(x => x.a === a), D = dispositivi().filter(id => (areaOf(id) || "_") === a);
  const sotto = peggio ? `${esc(etichetta(peggio))} ${esc(valTxt(peggio.id))}` : t("sensori non raggiungibili", "sensors unavailable"), doppio = m => M.filter(x => x.k === m.k).length > 1;
  return card(esc(nomeStanza(a)), `<button class="ar1st" data-act="arSt" data-id="${esc(a)}" aria-label="${t("Dettagli", "Details")} · ${esc(nomeStanza(a))}">${scenaAria(lv, a)}
      <span class="ar1sv"><b>${lv == null ? "—" : esc(LIV()[lv][0])}</b><small>${sotto}</small></span><span class="ar1go">${t("Dettagli", "Details")} ›</span></button>
    <div class="ar1ms">${M.map(m => adm ? `<span class="ar1me">${chip(m, doppio(m))}<button data-act="arSEd" data-id="${m.id}" aria-label="${t("Modifica", "Edit")} · ${esc(nm(m.id))}">✏️</button><button class="x" data-act="arSTogli" data-id="${m.id}" aria-label="${t("Togli", "Remove")} · ${esc(nm(m.id))}">✕</button></span>` : chip(m, doppio(m))).join("")}</div>
    ${c ? rigaConsiglio(c) : ""}
    ${D.length ? `<div class="ar1dm">${D.map(id => `<button class="ar1dx ${acceso(id) ? "on" : ""} ${ok(id) ? "" : "dis"}" data-act="arTog" data-id="${id}" aria-pressed="${acceso(id)}">${disegnoDisp(id)}<span>${esc(shortName(id))}</span><em>${ok(id) ? (acceso(id) ? t("acceso", "on") : t("spento", "off")) : t("non raggiungibile", "unavailable")}</em></button>`).join("")}</div>` : ""}`,
    { cls: "ar1r l" + (lv ?? "x") });
}
function hero(g, Cs) {
  const A = stanzeOrdinate(g).map(a => ({ a, ...giudizio(g[a]) })).filter(x => x.lv != null);
  const lv = A.length ? Math.max(...A.map(x => x.lv)) : null, F = fuori();
  const per = [0, 1, 2, 3].map(l => A.filter(x => x.lv === l));
  const frase = lv == null ? t("Nessun sensore raggiungibile in questo momento.", "No sensor is reachable right now.")
    : lv <= 1 ? t(A.length === 1 ? "L'aria è buona." : "L'aria è buona in tutte le stanze.", A.length === 1 ? "The air is good." : "The air is good in every room.")
    : "";
  const conti = [3, 2, 1, 0].map(l => per[l].length ? `<span class="l${l}"><i></i>${esc(LIV()[l][0])}: ${per[l].map(x => esc(nomeStanza(x.a))).join(", ")}</span>` : "").join("");
  const adm = isAdmin();
  return `<section class="card span3 ar1h l${lv ?? "x"}"><div class="ch"><h2>🍃 ${t("Aria in casa", "Air at home")}</h2><div class="row" style="gap:6px">
      <button class="btn sm" data-act="arInfo" aria-label="${t("Come giudico l'aria", "How I rate the air")}">ℹ️</button>${adm ? `<button class="btn sm" data-act="arCfg" aria-label="${t("Impostazioni", "Settings")}">⚙️</button>` : ""}</div></div>
    <div class="ar1hg"><div class="ar1hs">${scenaAria(lv, "casa", "big")}<div class="ar1hv"><b>${lv == null ? "—" : esc(LIV()[lv][0])}</b>${frase ? `<span>${frase}</span>` : ""}<span class="ar1cn">${conti}</span>
        ${F ? `<span class="ar1fu">🌳 ${t("Fuori", "Outside")}: ${esc(etichetta(F))} ${esc(valTxt(F.id))} · ${esc(LIV()[F.lv][0].toLowerCase())}</span>` : ""}</div></div>
      <div class="ar1cs"><div class="fl1">💡 ${t("Consigli", "Tips")}</div>${Cs.length ? Cs.slice(0, 5).map(rigaConsiglio).join("") + (Cs.length > 5 ? `<p class="small muted">${t(`e altri ${Cs.length - 5} nelle stanze qui sotto`, `and ${Cs.length - 5} more in the rooms below`)}</p>` : "")
        : `<div class="ar1ok">✓ ${t("Niente da fare: l'aria va bene.", "Nothing to do: the air is fine.")}</div>`}</div></div></section>`;
}
/* D) dispositivi */
function tesseraDisp(id) {
  const k = tipoDisp(id), un = !ok(id), on = acceso(id), a = S[id]?.attributes || {}, fan = id.startsWith("fan."), hum = id.startsWith("humidifier.");
  const modi = fan ? a.preset_modes || [] : hum ? a.available_modes || [] : [], modo = fan ? a.preset_mode : hum ? a.mode : null;
  const vel = fan && (+a.supported_features & 1) && a.percentage != null, passo = Math.max(1, Math.round(+a.percentage_step || 1));
  const obiettivo = hum && a.humidity != null, numeri = stessoDisp(id, x => x.startsWith("number.") && /target|obiettivo|favou?rite|preferit/i.test(testo(x)) && ok(x));
  const F = filtro(id), az = { humidifying: t("umidifica", "humidifying"), drying: t("deumidifica", "drying"), idle: t("a riposo", "idle"), off: t("spento", "off") }[a.action];
  const nomeK = { purif: t("Purificatore", "Air purifier"), deum: t("Deumidificatore", "Dehumidifier"), umid: t("Umidificatore", "Humidifier") }[k];
  const stato = un ? t("non raggiungibile", "unavailable") : [on ? t("acceso", "on") : t("spento", "off"), on && az && a.action !== "off" ? az : "", a.current_humidity != null ? t("umidità ", "humidity ") + Math.round(+a.current_humidity) + "%" : ""].filter(Boolean).join(" · ");
  const corpo = `<div class="ar1dt ${on ? "on" : ""} k-${k} ${un ? "dis" : ""}">
    <div class="ar1dh">${disegnoDisp(id)}<div class="tx"><b>${esc(nm(id))}</b><span>${esc(nomeK)}${areaOf(id) && AREAS[areaOf(id)] ? " · " + esc(AREAS[areaOf(id)].name) : ""}</span><span>${esc(stato)}</span></div>
      ${un ? "" : `<button class="sw ${on ? "on" : ""}" data-act="arTog" data-id="${id}" aria-label="${esc(nm(id))}" aria-pressed="${on}"><i></i></button>`}</div>
    ${!un && modi.length ? `<div class="fl1">${t("Modalità", "Mode")}</div><div class="seg ar1sg">${modi.map(m => `<button class="${m === modo ? "act" : ""}" data-act="arModo" data-id="${id}" data-v="${esc(m)}" aria-pressed="${m === modo}">${esc(nomeModo(m))}</button>`).join("")}</div>` : ""}
    ${!un && vel ? `<label class="ar1rg"><span>${t("Velocità", "Speed")}</span><input type="range" min="0" max="100" step="${passo}" value="${Math.round(+a.percentage)}" data-chg="arVel" data-id="${id}" aria-label="${t("Velocità", "Speed")} · ${esc(nm(id))}"><em>${Math.round(+a.percentage)}%</em></label>` : ""}
    ${!un && obiettivo ? `<div class="ar1ob"><span>${k === "deum" ? t("Umidità da raggiungere", "Target humidity") : t("Umidità da raggiungere", "Target humidity")}</span><div class="row" style="gap:12px"><button class="step" data-act="arObj" data-id="${id}" data-d="-5" aria-label="−">−</button><b>${Math.round(+a.humidity)}%</b><button class="step" data-act="arObj" data-id="${id}" data-d="5" aria-label="+">+</button></div></div>` : ""}
    ${!un ? numeri.map(n => { const s = +attr(n, "step") || 1; return `<div class="ar1ob"><span>${esc(shortName(n).replace(new RegExp("^" + nm(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "") || nm(n))}</span><div class="row" style="gap:12px"><button class="step" data-act="arNum" data-id="${n}" data-d="${-s}" aria-label="−">−</button><b>${fmt(S[n].state)}${unit(n) ? " " + esc(unit(n)) : ""}</b><button class="step" data-act="arNum" data-id="${n}" data-d="${s}" aria-label="+">+</button></div></div>`; }).join("") : ""}
    ${F ? `<button class="ar1fl ${F.cambia ? "ko" : ""}" data-act="more" data-id="${F.id}"><span>🧽 ${t("Filtro", "Filter")}</span>${F.pct != null ? `<span class="br"><i style="width:${F.pct}%"></i></span>` : ""}<em>${esc(F.testo)}</em></button>` : ""}
  </div>`;
  if (!UI.edit || !isAdmin()) return corpo;
  return `<div class="ed1">${corpo}<div class="edb"><button data-act="arDEd" data-id="${id}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="arDTogli" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}
function schedaDisp() {
  const D = dispositivi(); if (!D.length && !UI.edit) return "";
  return card("🌀 " + t("Purificatori e deumidificatori", "Purifiers and dehumidifiers"), `${D.length ? `<div class="ar1dg">${D.map(tesseraDisp).join("")}</div>` : `<div class="small muted">${t("Nessun purificatore, deumidificatore o umidificatore.", "No purifier, dehumidifier or humidifier.")}</div>`}
    ${UI.edit && isAdmin() ? `<button class="add1" data-act="arDAdd" style="margin-top:10px"><span>＋</span>${t("Aggiungi un purificatore o un deumidificatore", "Add a purifier or dehumidifier")}</button>` : ""}`, { cls: "span3" });
}
function schedaModifica() {
  if (!UI.edit || !isAdmin()) return "";
  const c = C(), tolti = (c.tolti || []).filter(id => S[id]), dt = (c.dispTolti || []).filter(id => S[id]);
  return card("✏️ " + t("Sensori dell'aria", "Air sensors"), `<div class="stack"><button class="add1" data-act="arSAdd"><span>＋</span>${t("Aggiungi un sensore", "Add a sensor")}</button>
    ${[...tolti, ...dt].map(id => `<div class="li"><div class="tx"><b>${esc(nm(id))}</b><span>${t("tolto da questa pagina", "removed from this page")}</span></div><button class="btn sm" data-act="arRimetti" data-id="${id}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>
    <p class="small muted ar1nt">${t("Tocca ✏️ su una misura per cambiarne stanza o tipo. L'umidità di una stanza è una sola: la stessa scelta in Home (✏️ sulla stanza); con ＋ ne aggiungi altre. I sensori di giardini, terrazzi e servizi online servono solo ai consigli.", "Tap ✏️ on a reading to change its room or type. Each room has one humidity reading: the one chosen on Home (✏️ on the room); add more with ＋. Sensors in gardens, terraces and online services are used only for tips.")}</p>`, { cls: "span3" });
}
function pagina() {
  const g = perStanza(), A = stanzeOrdinate(g), Cs = consigli(g);
  if (!A.length && !dispositivi().length) return `<div class="g g3">${card("🍃 " + t("Qualità dell'aria", "Air quality"), `<div class="empty">${t("Nessun sensore dell'aria in casa: premi ✏️ Modifica e ＋ per aggiungerne.", "No air sensors at home: press ✏️ Edit and ＋ to add some.")}</div>`, { cls: "span3" })}${schedaModifica()}</div>`;
  return `<div class="g g3 ar1p">${A.length ? hero(g, Cs) : ""}${A.map(a => tesseraStanza(a, g[a], Cs)).join("")}${schedaDisp()}${schedaModifica()}</div>`;
}

/* ---------- pannello di una stanza: valori, scala, grafici, dispositivi ---------- */
let PAN = null;
const periodo = () => periodi().some(([k]) => k === sGet("arPer")) ? sGet("arPer") : "24h";
/** scala colorata con il segno del valore */
function scala(m) {
  const s = soglie(m.k), L = LIV();
  if (m.k === "hum") {
    const seg = [[0, s[4], 3], [s[4], s[2], 2], [s[2], s[0], 1], [s[0], s[1], 0], [s[1], s[3], 1], [s[3], s[5], 2], [s[5], 100, 3]];
    return `<span class="ar1sc">${seg.map(([a, b, l]) => `<i style="flex:${Math.max(.5, b - a)};background:${L[l][1]}"></i>`).join("")}${m.v != null ? `<u style="left:${clamp(m.v, 0, 100)}%"></u>` : ""}</span>`;
  }
  const top = s[2] * 1.5, seg = [[0, s[0], 0], [s[0], s[1], 1], [s[1], s[2], 2], [s[2], top, 3]];
  return `<span class="ar1sc">${seg.map(([a, b, l]) => `<i style="flex:${b - a};background:${L[l][1]}"></i>`).join("")}${m.v != null ? `<u style="left:${clamp(m.v / top * 100, 0, 100).toFixed(1)}%"></u>` : ""}</span>`;
}
const soglieTxt = k => { const s = soglie(k), u = TIPI()[k].u, L = LIV(), f = v => fnum(v, v % 1 ? 1 : 0);
  return k === "hum" ? `${L[0][0]} ${f(s[0])}–${f(s[1])}% · ${L[1][0]} ${f(s[2])}–${f(s[3])}% · ${L[2][0]} ${f(s[4])}–${f(s[5])}%`
    : `${L[0][0]} ≤ ${f(s[0])} · ${L[1][0]} ≤ ${f(s[1])} · ${L[2][0]} ≤ ${f(s[2])}${u ? " " + u : ""}`; };
function pannello() {
  const a = PAN, g = perStanza(), M = g[a]; if (!M) return `<div class="sh-head"><div><h3>🍃</h3></div><button class="x" data-act="sheetClose">×</button></div>`;
  const { lv } = giudizio(M), Cs = consigli(g).filter(c => c.a === a), D = dispositivi().filter(id => (areaOf(id) || "_") === a), p = periodo();
  return `<div class="sh-head"><div><h3>🍃 ${esc(nomeStanza(a))}</h3><div class="small muted">${lv == null ? "" : t("Aria ", "Air: ") + esc(LIV()[lv][0].toLowerCase())}${a !== "_" && AREAS[a]?.floor && FLOORS[AREAS[a].floor] ? " · " + esc(FLOORS[AREAS[a].floor].name) : ""}</div></div>${pill(lv)}<button class="x" data-act="sheetClose">×</button></div>
    <div class="ar1pn">${scenaAria(lv, a, "pan")}</div>
    ${Cs.length ? `<div class="stack" style="margin-top:12px">${Cs.map(rigaConsiglio).join("")}</div>` : ""}
    <div class="fl1">${t("Valori", "Readings")}</div>
    <div class="stack">${M.map(m => `<div class="ar1v l${m.lv ?? "x"}"><div class="hd"><b>${esc(etichetta(m))}</b><span>${esc(valTxt(m.id))}</span>${pill(m.lv)}</div>${scala(m)}
      <small>${esc(soglieTxt(m.k))} · ${esc(nm(m.id))}</small></div>`).join("")}</div>
    <div class="row between" style="margin:16px 2px 8px;gap:8px;flex-wrap:wrap"><b>📈 ${t("Andamento", "Trend")}</b><div class="seg">${periodi().map(([k, n]) => `<button class="${p === k ? "act" : ""}" data-act="arPer" data-v="${k}" aria-pressed="${p === k}">${n}</button>`).join("")}</div></div>
    <div class="stack">${M.map(m => `<div class="ar1gr"><div class="row between"><b>${esc(etichetta(m))}</b><button class="lnk" data-act="more" data-id="${m.id}">${esc(nm(m.id))} ›</button></div>${grafico(m.id, p, { colore: LIV()[m.lv ?? 1][1] })}</div>`).join("")}</div>
    ${D.length ? `<div class="fl1">${t("Dispositivi", "Devices")}</div><div class="ar1dg">${D.map(tesseraDisp).join("")}</div>` : ""}`;
}
/* zone colorate dei grafici: i livelli, nell'unità del sensore */
FASCE.push(id => {
  const s = sensori().find(x => x.id === id); if (!s) return null;
  const f = fattore(s.k, unit(id)); if (!f) return null;
  const q = soglie(s.k).map(v => v / f), L = LIV();
  if (s.k === "hum") return [[null, q[4], L[3][1]], [q[4], q[2], L[2][1]], [q[2], q[0], L[1][1]], [q[0], q[1], L[0][1]], [q[1], q[3], L[1][1]], [q[3], q[5], L[2][1]], [q[5], null, L[3][1]]];
  return [[null, q[0], L[0][1]], [q[0], q[1], L[1][1]], [q[1], q[2], L[2][1]], [q[2], null, L[3][1]]];
});

/* ---------- ℹ️ come giudico l'aria ---------- */
function info() {
  const T = TIPI(), usati = new Set(sensori().map(s => s.k)), K = ORDINE.filter(k => usati.has(k) || !usati.size);
  const altri = ORDINE.filter(k => !K.includes(k));
  const riga = k => `<div class="ar1if"><div class="hd"><b>${esc(T[k].ic)} ${esc(T[k].n)}</b>${T[k].u ? `<small>${esc(T[k].u)}</small>` : ""}</div>${scala({ k, v: null })}<small class="sv">${esc(soglieTxt(k))}${k === "hum" ? "" : " · " + esc(LIV()[3][0]) + t(" oltre", " above")}</small><p>${esc(T[k].x)}</p></div>`;
  return `<div class="sh-head"><div><h3>ℹ️ ${t("Come giudico l'aria", "How I rate the air")}</h3><div class="small muted">${t("Ogni stanza prende il giudizio della sua misura peggiore.", "Each room gets the rating of its worst reading.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${K.map(riga).join("")}</div>
    ${altri.length ? `<details class="ar1al"><summary>${t("Altre misure", "Other readings")} (${altri.length})</summary><div class="stack" style="margin-top:8px">${altri.map(riga).join("")}</div></details>` : ""}
    <p class="small muted ar1nt">${t("Soglie scritte per 'Nduja partendo da riferimenti pubblici (OMS 2021, agenzia tedesca per l'ambiente, normativa italiana sul radon). Non sono un parere medico.", "Thresholds written for 'Nduja from public references (WHO 2021, German Environment Agency, Italian radon rules). They are not medical advice.")}${isAdmin() ? " " + t("Gli amministratori le cambiano in ⚙️.", "Admins change them in ⚙️.") : ""}</p>`;
}

/* ---------- ⚙️ impostazioni (amministratori) ---------- */
function impostazioni() {
  const T = TIPI(), usati = new Set(sensori().map(s => s.k)), K = ORDINE.filter(k => usati.has(k)), c = C();
  const n = (k, i, v) => `<input type="number" inputmode="decimal" step="any" min="0" value="${v}" data-chg="arSg" data-k="${k}" data-i="${i}" aria-label="${esc(T[k].n)}">`;
  const riga = k => { const s = soglie(k), mio = !!c.soglie?.[k], L = LIV();
    const corpo = k === "hum" ? [0, 1, 2].map(j => `<label><span class="l${j}"><i></i>${esc(L[j][0])}</span><span class="ar1in">${n(k, j * 2, s[j * 2])}<em>–</em>${n(k, j * 2 + 1, s[j * 2 + 1])}<em>%</em></span></label>`).join("")
      : [0, 1, 2].map(j => `<label><span class="l${j}"><i></i>${esc(L[j][0])} ${t("fino a", "up to")}</span><span class="ar1in">${n(k, j, s[j])}<em>${esc(T[k].u)}</em></span></label>`).join("");
    return `<div class="ar1sz"><div class="hd"><b>${esc(T[k].ic)} ${esc(T[k].n)}</b>${mio ? `<button class="btn sm" data-act="arSgReset" data-k="${k}">↺ ${t("Predefinite", "Defaults")}</button>` : ""}</div><div class="ar1sr">${corpo}</div>
      <small>${k === "hum" ? t("Fuori dall'ultima fascia: Scarsa.", "Outside the last range: Poor.") : t("Oltre l'ultima: Scarsa.", "Above the last one: Poor.")}</small></div>`; };
  return `<div class="sh-head"><div><h3>⚙️ ${t("Qualità dell'aria", "Air quality")}</h3><div class="small muted">${t("Valgono per tutta la casa. Si salvano appena esci da un campo.", "They apply to the whole home. Saved when you leave a field.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">🔔 ${t("Avviso in Home", "Alert on Home")}</div>
    <div class="li"><div class="tx"><b>${t("Quando una stanza resta «Scarsa»", "When a room stays «Poor»")}</b><span>${t("L'avviso compare negli Avvisi della Home.", "The alert shows in Home Alerts.")}</span></div><button class="sw ${avvisoOn() ? "on" : ""}" data-act="arAvOn" aria-pressed="${avvisoOn()}" aria-label="${t("Avviso in Home", "Alert on Home")}"><i></i></button></div>
    ${avvisoOn() ? `<label class="fld1"><span>${t("Dopo quanti minuti di aria scarsa", "After how many minutes of poor air")}</span><span class="ar1in"><input type="number" min="5" max="720" step="5" value="${minAvviso()}" data-chg="arCfgN" data-f="avviso"><em>min</em></span></label>` : ""}
    <div class="fl1">💡 ${t("Consigli", "Tips")}</div>
    <div class="fld1"><span>${t("Dai consigli quando l'aria è", "Give tips when the air is")}</span>
      <div class="seg" style="align-self:flex-start">${[[2, LIV()[2][0] + t(" o peggio", " or worse")], [3, t("Solo ", "Only ") + LIV()[3][0].toLowerCase()]].map(([v, n]) => `<button class="${consigliDa() === v ? "act" : ""}" data-act="arConsDa" data-v="${v}" aria-pressed="${consigliDa() === v}">${esc(n)}</button>`).join("")}</div></div>
    <p class="small muted" style="margin:6px 2px 0">${t("«Discreta» ti avvisa prima; «Scarsa» solo quando serve davvero.", "«Fair» warns you earlier; «Poor» only when it really matters.")}</p>
    <label class="fld1"><span>${t("Per quanti minuti consigliare di aprire la finestra", "How many minutes to suggest opening the window")}</span><span class="ar1in"><input type="number" min="1" max="120" step="1" value="${ricambio()}" data-chg="arCfgN" data-f="ricambio"><em>min</em></span></label>
    <label class="fld1"><span>${t("Filtro da cambiare sotto il", "Filter to replace below")}</span><span class="ar1in"><input type="number" min="0" max="50" step="1" value="${filtroMin()}" data-chg="arCfgN" data-f="filtro"><em>%</em></span></label>
    <p class="small muted" style="margin:6px 2px 0">${t("Il filtro si controlla solo se il purificatore dice quanto ne resta.", "The filter is checked only if the purifier reports how much is left.")}</p>
    ${stanzeSensori().length ? `<div class="fl1">🌳 ${t("Stanze di fuori", "Outdoor rooms")}</div>
    <p class="small muted" style="margin:0 2px 8px">${t("I sensori di una stanza di fuori non hanno un giudizio: servono solo ai consigli («fuori l'aria è peggiore»). Le riconosco dal nome (giardino, terrazzo…): se sbaglio, correggi qui.", "Sensors in an outdoor room get no rating: they're only used for tips («the air outside is worse»). I detect them by name (garden, terrace…): if I get it wrong, fix it here.")}</p>
    <div class="stack">${stanzeSensori().map(a => { const f = stanzaFuori(a), mio = typeof c.fuori?.[a] === "boolean";
      return `<div class="li"><div class="tx"><b>${esc(nomeStanza(a))}</b><span>${f ? t("di fuori", "outdoor") : t("in casa", "indoor")}${mio ? " · " + t("scelto da te", "your choice") : " · " + t("riconosciuto da solo", "detected")}</span></div>
        ${mio ? `<button class="btn sm" data-act="arFuori" data-id="${esc(a)}" data-v="" aria-label="${t("Riconosci da solo", "Detect automatically")}">✨</button>` : ""}<button class="sw ${f ? "on" : ""}" data-act="arFuori" data-id="${esc(a)}" data-v="${f ? "0" : "1"}" aria-pressed="${f}" aria-label="${t("Di fuori", "Outdoor")} · ${esc(nomeStanza(a))}"><i></i></button></div>`; }).join("")}</div>` : ""}
    <div class="fl1">📏 ${t("Soglie", "Thresholds")}</div>
    <p class="small muted" style="margin:0 2px 8px">${t("Quando una misura è Ottima, Buona o Discreta. Compaiono solo le misure che hai in casa; i valori predefiniti e da dove vengono sono in ℹ️.", "When a reading is Excellent, Good or Fair. Only the readings you have at home are listed; defaults and their sources are in ℹ️.")}</p>
    <div class="stack">${K.map(riga).join("") || `<div class="small muted">${t("Nessun sensore.", "No sensors.")}</div>`}</div>`;
}

/** stanze che hanno sensori dell'aria (di casa o di fuori): quelle che si possono segnare «di fuori» */
const stanzeSensori = () => { const o = areasSorted(true); return [...new Set([...sensori().map(s => s.a), ...Object.keys(C().fuori || {})].filter(a => a !== "_" && AREAS[a]))].sort((x, y) => o.indexOf(x) - o.indexOf(y)); };

/* ---------- ✏️ un sensore ---------- */
let ED = null;
function foglioSensore() {
  const id = ED; if (!S[id]) return "";
  const r = LAYOUT.rooms?.[id] || "", haA = REG[id]?.area, k = tipoDi(id), mio = C().tipi?.[id] || "";
  const scelte = ORDINE.filter(x => fattore(x, unit(id)) != null);
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted mono">${esc(id)} · ${esc(valTxt(id))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Stanza", "Room")}</span><select id="ar1rr"><option value="">${haA && AREAS[haA] ? t("Come in Home Assistant", "As in Home Assistant") + ` (${esc(AREAS[haA].name)})` : t("Nessuna stanza", "No room")}</option>
      ${areasSorted(true).map(a => `<option value="${a}" ${r === a ? "selected" : ""}>${esc(AREAS[a].name)}${stanzaFuori(a) ? " · " + t("fuori", "outside") : ""}</option>`).join("")}</select></label>
    <div class="fl1">${t("Che cosa misura", "What it measures")}</div>
    <div class="vr1">${scelte.map(x => `<button class="${(mio || k) === x ? "on" : ""}" data-act="arTipo" data-v="${x}" aria-pressed="${(mio || k) === x}">${esc(TIPI()[x].ic)} ${esc(TIPI()[x].n)}${TIPI()[x].u ? ` <small>${esc(TIPI()[x].u)}</small>` : ""}</button>`).join("")}</div>
    ${mio ? `<button class="btn sm" data-act="arTipo" data-v="" style="margin-top:8px">✨ ${t("Riconosci da solo", "Detect automatically")}</button>` : ""}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="arSSalva">💾 ${t("Salva la stanza", "Save room")}</button><button class="btn bad" data-act="arSTogli" data-id="${id}">✕ ${t("Togli dalla pagina", "Remove from the page")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("La stanza cambia solo nella plancia, non in Home Assistant. Un sensore in una stanza di fuori serve solo ai consigli.", "The room changes only in the dashboard, not in Home Assistant. A sensor in an outdoor room is used only for tips.")}</p>`;
}
/* ✏️ un dispositivo */
function foglioDisp() {
  const id = ED; if (!S[id]) return "";
  const r = LAYOUT.rooms?.[id] || "", haA = REG[id]?.area, mio = C().dispTipi?.[id] || "", k = tipoDisp(id);
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted mono">${esc(id)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("Che cos'è", "What it is")}</div>
    <div class="seg" style="flex-wrap:wrap">${TIPI_DISP().map(([v, n]) => `<button class="${k === v ? "act" : ""}" data-act="arDTipo" data-v="${v}" aria-pressed="${k === v}">${esc(n)}</button>`).join("")}</div>
    <p class="small muted" style="margin:6px 2px 0">${mio ? `<button class="lnk" data-act="arDTipo" data-v="" style="background:none;border:0;padding:0">✨ ${t("Riconosci da solo", "Detect automatically")} (${esc(TIPI_DISP().find(x => x[0] === tipoDispAuto(id))[1])})</button>` : t("Riconosciuto da solo: se sbaglio, scegli tu. Serve ai consigli («accendi il deumidificatore»).", "Detected automatically: if I'm wrong, pick it. It's used for tips («turn on the dehumidifier»).")}</p>
    <label class="fld1"><span>${t("Nome nella plancia", "Name in the dashboard")}</span><input id="ar1nn" type="text" value="${esc(LAYOUT.names?.[id] || "")}" placeholder="${esc(nmHA(id))}"></label>
    <label class="fld1"><span>${t("Stanza", "Room")}</span><select id="ar1rr"><option value="">${haA && AREAS[haA] ? t("Come in Home Assistant", "As in Home Assistant") + ` (${esc(AREAS[haA].name)})` : t("Nessuna stanza", "No room")}</option>
      ${areasSorted(true).map(a => `<option value="${a}" ${r === a ? "selected" : ""}>${esc(AREAS[a].name)}</option>`).join("")}</select></label>
    <p class="small muted" style="margin-top:6px">${t("La stanza serve ai consigli: «accendi il purificatore» compare per la stanza dove si trova.", "The room is used for tips: «turn on the purifier» shows for the room it's in.")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="arDSalva">💾 ${t("Salva", "Save")}</button><button class="btn bad" data-act="arDTogli" data-id="${id}">✕ ${t("Togli dalla pagina", "Remove from the page")}</button></div>`;
}
const salvaStanza = (id, n) => { const r = document.getElementById("ar1rr")?.value || "";
  closeSheet(); cambia(l => { l.names = { ...(l.names || {}) }; l.rooms = { ...(l.rooms || {}) };
    if (n != null) { if (n && n !== nmHA(id)) l.names[id] = n; else delete l.names[id]; }
    if (r) l.rooms[id] = r; else delete l.rooms[id]; }, "💾 " + nm(id)); };

/* ---------- azioni ---------- */
Object.assign(ACT, {
  arSt: el => { PAN = el.dataset.id; openSheet(pannello); },
  arPer: el => { sSet("arPer", el.dataset.v); render(); },
  arInfo: () => openSheet(info),
  arCfg: () => openSheet(impostazioni),
  arFai: el => { const id = el.dataset.id, v = el.dataset.v;
    const p = v === "on" ? svc("homeassistant", "turn_on", {}, { entity_id: id }) : v === "off" ? svc("homeassistant", "turn_off", {}, { entity_id: id })
      : v === "max" ? svc("fan", "set_percentage", { percentage: 100 }, { entity_id: id }) : v === "dry" ? svc("climate", "set_hvac_mode", { hvac_mode: "dry" }, { entity_id: id }) : null;
    p?.then(() => toast("✓ " + nm(id))).catch(() => {}); },
  arTog: el => { const id = el.dataset.id; if (!ok(id)) return; svc("homeassistant", acceso(id) ? "turn_off" : "turn_on", {}, { entity_id: id }).catch(() => {}); },
  arModo: el => { const id = el.dataset.id, v = el.dataset.v;
    if (id.startsWith("fan.")) svc("fan", "set_preset_mode", { preset_mode: v }, { entity_id: id }).catch(() => {});
    else if (id.startsWith("humidifier.")) svc("humidifier", "set_mode", { mode: v }, { entity_id: id }).catch(() => {}); },
  arObj: el => { const id = el.dataset.id, a = S[id].attributes, lo = +(a.min_humidity ?? 0), hi = +(a.max_humidity ?? 100);
    svc("humidifier", "set_humidity", { humidity: clamp(Math.round(+a.humidity + +el.dataset.d), lo, hi) }, { entity_id: id }).catch(() => {}); },
  arNum: el => { const id = el.dataset.id, a = S[id].attributes, v = +S[id].state + +el.dataset.d;
    svc("number", "set_value", { value: clamp(Math.round(v * 1000) / 1000, +(a.min ?? -Infinity), +(a.max ?? Infinity)) }, { entity_id: id }).catch(() => {}); },
  /* modifica */
  arSEd: el => { ED = el.dataset.id; openSheet(foglioSensore); },
  arSSalva: () => salvaStanza(ED, null),
  arTipo: el => { const id = ED, v = el.dataset.v; arCambia(c => { c.tipi = c.tipi || {}; if (v) c.tipi[id] = v; else delete c.tipi[id]; }, v ? TIPI()[v].ic + " " + TIPI()[v].n : "✨"); },
  arSTogli: el => { const id = el.dataset.id || ED; if (UI.sheet) closeSheet();
    arCambia(c => { c.extra = (c.extra || []).filter(x => x !== id); c.tolti = [...new Set([...(c.tolti || []), id])]; }, "✕ " + nm(id)); },
  arRimetti: el => { const id = el.dataset.id; arCambia(c => { c.tolti = (c.tolti || []).filter(x => x !== id); c.dispTolti = (c.dispTolti || []).filter(x => x !== id); }, "↺ " + nm(id)); },
  arSAdd: () => { const qui = new Set(sensori().map(s => s.id));
    scegli({ titolo: "＋ " + t("Sensore dell'aria", "Air sensor"), sotto: t("Tutti i sensori con un numero: se non capisco da solo cosa misura, te lo chiedo.", "Every sensor with a number: if I can't tell what it measures, I'll ask you."), auto: false, attuale: null,
      filtro: id => id.startsWith("sensor.") && !qui.has(id) && !isNaN(parseFloat(S[id]?.state)) && deviceClass(id) !== "timestamp",
      onPick: id => { if (!id || id === "none") return; arCambia(c => { c.tolti = (c.tolti || []).filter(x => x !== id); c.extra = [...new Set([...(c.extra || []), id])]; }, "＋ " + nm(id))
        .then(() => { ED = id; openSheet(foglioSensore); }); } }); },
  arDEd: el => { ED = el.dataset.id; openSheet(foglioDisp); },
  arDTipo: el => { const id = ED, v = el.dataset.v; arCambia(c => { c.dispTipi = { ...(c.dispTipi || {}) }; if (v) c.dispTipi[id] = v; else delete c.dispTipi[id]; }, v ? TIPI_DISP().find(x => x[0] === v)[1] : "✨"); },
  arDSalva: () => salvaStanza(ED, (document.getElementById("ar1nn")?.value || "").trim()),
  arDTogli: el => { const id = el.dataset.id || ED; if (UI.sheet) closeSheet();
    arCambia(c => { c.dispExtra = (c.dispExtra || []).filter(x => x !== id); c.dispTolti = [...new Set([...(c.dispTolti || []), id])]; }, "✕ " + nm(id)); },
  arDAdd: () => { const qui = new Set(dispositivi());
    scegli({ titolo: "＋ " + t("Purificatore o deumidificatore", "Purifier or dehumidifier"), sotto: t("Ventilatori, purificatori e umidificatori della casa.", "Fans, purifiers and humidifiers in the house."), auto: false, attuale: null,
      filtro: id => /^(fan|humidifier|air_purifier)\./.test(id) && !qui.has(id),
      onPick: id => id && id !== "none" && arCambia(c => { c.dispTolti = (c.dispTolti || []).filter(x => x !== id); c.dispExtra = [...new Set([...(c.dispExtra || []), id])]; }, "＋ " + nm(id)) }); },
  /* impostazioni */
  arAvOn: () => arCambia(c => { c.avviso = { ...(c.avviso || {}), on: !avvisoOn() }; }, avvisoOn() ? t("Avviso spento", "Alert off") : "🔔 " + t("Avviso acceso", "Alert on")),
  arConsDa: el => arCambia(c => { if (+el.dataset.v === 3) c.consigliDa = 3; else delete c.consigliDa; }, "💡"),
  arFuori: el => { const a = el.dataset.id, v = el.dataset.v; arCambia(c => { c.fuori = { ...(c.fuori || {}) }; if (v === "") delete c.fuori[a]; else c.fuori[a] = v === "1"; }, "🌳 " + nomeStanza(a)); },
  arSgReset: el => { const k = el.dataset.k; arCambia(c => { if (c.soglie) delete c.soglie[k]; }, "↺ " + nomeTipo(k)); },
});
CHG.arVel = el => svc("fan", "set_percentage", { percentage: +el.value }, { entity_id: el.dataset.id }).catch(() => {});
CHG.arSg = el => {
  const k = el.dataset.k, i = +el.dataset.i, v = parseFloat(String(el.value).replace(",", "."));
  if (isNaN(v)) { el.value = soglie(k)[i]; return; }
  const s = [...soglie(k)]; s[i] = v;
  if (!validaSoglie(k, s)) { el.value = soglie(k)[i]; toast(k === "hum" ? t("Ogni fascia deve contenere quella prima (es. 40–60 dentro 35–65)", "Each range must contain the previous one (e.g. 40–60 inside 35–65)") : t("Le soglie devono crescere: Ottima < Buona < Discreta", "Thresholds must increase: Excellent < Good < Fair"), true); return; }
  arCambia(c => { c.soglie = { ...(c.soglie || {}), [k]: s }; }, "📏 " + nomeTipo(k));
};
CHG.arCfgN = el => {
  const f = el.dataset.f, v = Math.round(+el.value), lim = { avviso: [5, 720], ricambio: [1, 120], filtro: [0, 50] }[f];
  if (el.value === "" || isNaN(v) || v < lim[0] || v > lim[1]) { toast(t(`Scegli un numero da ${lim[0]} a ${lim[1]}`, `Pick a number from ${lim[0]} to ${lim[1]}`), true); el.value = { avviso: minAvviso(), ricambio: ricambio(), filtro: filtroMin() }[f]; return; }
  arCambia(c => { if (f === "avviso") c.avviso = { ...(c.avviso || {}), min: v }; else c[f] = v; }, "💾 " + v);
};

/* ---------- Home: la scheda «Aria», il segno sulle stanze e la riga nella finestra della stanza ---------- */
function homeCard() {
  const g = perStanza(), A = stanzeOrdinate(g).map(a => ({ a, ...giudizio(g[a]) })).filter(x => x.lv != null), Cs = consigli(g);
  const lv = A.length ? Math.max(...A.map(x => x.lv)) : null, V = [...A].sort((x, y) => y.lv - x.lv).slice(0, 5);
  return card("🍃 " + t("Aria", "Air"), `<button class="ar1hm l${lv ?? "x"}" data-act="go" data-id="aria">${scenaAria(lv, "home", "sm")}<span class="ar1hv"><b>${lv == null ? "—" : esc(LIV()[lv][0])}</b><span>${lv == null ? "" : lv <= 1 ? t("in tutta la casa", "all over the house") : t("nella stanza peggiore", "in the worst room")}</span></span></button>
    <div class="ar1hl">${V.map(x => `<button class="l${x.lv}" data-act="arSt" data-id="${esc(x.a)}"><i></i><b>${esc(nomeStanza(x.a))}</b><span>${esc(etichetta(x.peggio))} ${esc(valTxt(x.peggio.id))}</span><em>${esc(LIV()[x.lv][0])}</em></button>`).join("")}</div>
    ${Cs[0] ? rigaConsiglio(Cs[0]) : ""}`, { link: [t("Dettagli", "Details"), "aria"] });
}
HOME_EXTRA.aria = { title: () => t("Aria", "Air"), render: homeCard, show: () => pagAttiva() && Object.keys(perStanza()).length > 0 };
/** segno sulla stanza della Home: solo se l'aria è discreta o scarsa */
VISTE.ariaChip = a => { if (!pagAttiva()) return ""; const { lv } = giudizio(perStanza()[a]); return lv >= 2 ? `<i class="ar1hc l${lv}" title="${esc(t("Aria ", "Air: ") + LIV()[lv][0].toLowerCase())}">🍃</i>` : ""; };
/** riga nella finestra della stanza (Home) */
VISTE.ariaStanza = a => { if (!pagAttiva()) return ""; const M = perStanza()[a]; if (!M) return ""; const { lv, peggio } = giudizio(M);
  return `<button class="li ar1sr2 l${lv ?? "x"}" data-act="arSt" data-id="${esc(a)}"><span class="ic">🍃</span><div class="tx"><b>${t("Aria", "Air")} ${lv == null ? "" : esc(LIV()[lv][0].toLowerCase())}</b><span>${M.map(m => esc(etichetta(m)) + " " + esc(valTxt(m.id))).join(" · ")}</span></div><span class="st">›</span></button>`; };
/** purificatori e umidificatori della pagina (non si ripetono in Clima e in Prese) */
VISTE.ariaDisp = () => pagAttiva() ? new Set(dispositivi()) : new Set();

page("aria", { title: t("Qualità dell'aria", "Air quality"), short: t("Aria", "Air"), icon: "🍃", order: 22, editable: true,
  show: () => sensori().some(s => !s.fuori) || dispositivi().length > 0,
  badge: () => { try { return scarseDaTempo().length > 0; } catch { return false; } }, render: pagina });

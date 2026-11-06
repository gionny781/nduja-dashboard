/* Piante e giardino: una scheda per pianta con nome, stanza, foto (scattata o caricata da chi usa la plancia) oppure un disegno
   fatto per 'Nduja secondo il tipo (verde, grassa, fiorita, aromatica, orto, albero).
   Piante trovate da sole: entità plant.* (integrazione «plant» di Home Assistant e Plant Monitor dal Marketplace) e dispositivi con un sensore
   di umidità del terreno (Xiaomi Mi Flora / Flower Care, sensori del terreno Zigbee…); le altre si aggiungono a mano.
   Sensori: umidità del terreno, luce, temperatura, fertilità (conducibilità) e pila del sensore, con barre e soglie (quelle dell'entità
   plant se le dà, altrimenti valori indicativi per tipo; si cambiano per ogni pianta con ✏️) e lo stato in parole semplici.
   Promemoria: «Annaffia ogni N giorni», «Concima ogni N settimane», «Fatto oggi» (lo segna chiunque); negli Avvisi della Home e,
   se un amministratore li attiva (🔔), sul telefono con l'automazione «'Nduja · piante».
   Giardino: una pianta collegata a una zona dell'Irrigazione si segna annaffiata da sola quando la zona parte (lo fa Home Assistant,
   piante.py); se domani piove, il promemoria delle piante di fuori slitta a dopodomani.

   Dati della casa (casa.js), sezione «piante» = { piante: { id: {
     man (aggiunta a mano), nome, area ("" = nessuna), fuori (true/false; manca = da solo), tipo, foto,
     acqua: { ogni (giorni, 0 = mai), ultima (ISO), chi (person), via ("irr" = irrigazione) }, concime: { ogni (settimane), ultima, chi },
     zona (switch/valve dell'irrigazione), sens: { misura: entity_id | "none" }, soglie: { misura: [min, max] }, tolta (trovata da sola ma tolta),
     storia: [{ c: "acqua"|"concime", q, chi, via, prima }], nt / fz (nome e «fuori» per l'automazione del telefono) } } }
   id: entity_id della plant, «dev:<dispositivo>» o «s:<sensore>» per i sensori senza plant, «m…» per quelle aggiunte a mano.
   Scelte della casa (amministratori) in LAYOUT.piante = { pioggia: { pr, mm }, batt, avvisi, sete, promemoria: { persone, altri, ora, meteo } }. */
import { S, REG, AREAS, DEVICES, ACT, CHG, UI, LAYOUT, VISTE, PAGES, t, LOC, esc, nmHA, ok, val, attr, unit, fnum, allEnts, areaOf, areasSorted,
  deviceClass, page, toast, openSheet, closeSheet, render, isAdmin, ws, api, cached, weatherEnt, forecast, WX, utenteCfg, etichettaNduja,
  sicuro, ready, go, tokenHA } from "../core.js";
import { cambia, scegli, indirizzoLocale } from "../edit.js";
import { casa, casaCambia, casaErrore } from "../casa.js";
import { zone as zoneIrr } from "./irrigazione.js";
import { serviziNotify, telefoniDi, nomeServizio } from "./scadenze.js";

const SEZ = "piante", AUT = "nduja_piante", MAX = 200, MAX_STORIA = 12, GIORNO = 864e5;
const C = () => LAYOUT.piante || {};
const piCambia = (fn, msg) => cambia(l => { l.piante = JSON.parse(JSON.stringify(l.piante || {})); fn(l.piante, l); }, msg);
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= giorni ================= */
const mezzanotte = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const piuGiorni = (d, n) => { const x = mezzanotte(d); x.setDate(x.getDate() + n); return x; };
const giorniTra = (a, b) => Math.round((mezzanotte(b) - mezzanotte(a)) / GIORNO);
const isoG = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const giornoBreve = d => new Date(d).toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short" });
const giorni = n => n === 1 ? t("1 giorno", "1 day") : n + t(" giorni", " days");
const quandoFatto = iso => { const g = giorniTra(iso, Date.now()); return g <= 0 ? t("oggi", "today") : g === 1 ? t("ieri", "yesterday") : g < 7 ? t(`${g} giorni fa`, `${g} days ago`) : new Date(iso).toLocaleDateString(LOC, { day: "numeric", month: "short" }); };

/* ================= tipi di pianta e soglie indicative =================
   Valori scritti per 'Nduja come punto di partenza (umidità del terreno %, luce lx, temperatura °C, fertilità µS/cm):
   ognuno li cambia per ogni pianta con ✏️, e le soglie dell'entità plant (Plant Monitor) hanno la precedenza. */
const TIPI = () => [["verde", t("Verde", "Foliage")], ["grassa", t("Grassa", "Succulent")], ["fiorita", t("Fiorita", "Flowering")],
  ["aromatica", t("Aromatica", "Herb")], ["orto", t("Orto", "Vegetable")], ["albero", t("Albero", "Tree")]];
const tipoNome = k => (TIPI().find(x => x[0] === k) || TIPI()[0])[1];
const DEF = {
  verde: { umidita: [20, 60], luce: [1500, 30000], temp: [12, 32], cond: [350, 2000], acqua: 7, concime: 4 },
  grassa: { umidita: [7, 40], luce: [5000, 100000], temp: [8, 38], cond: [100, 1200], acqua: 14, concime: 8 },
  fiorita: { umidita: [25, 60], luce: [3000, 50000], temp: [12, 30], cond: [350, 2000], acqua: 5, concime: 2 },
  aromatica: { umidita: [20, 55], luce: [5000, 90000], temp: [8, 35], cond: [250, 1800], acqua: 3, concime: 4 },
  orto: { umidita: [30, 65], luce: [10000, 100000], temp: [10, 35], cond: [500, 2500], acqua: 2, concime: 2 },
  albero: { umidita: [20, 60], luce: [5000, 100000], temp: [-5, 38], cond: [300, 2000], acqua: 7, concime: 6 },
};
const INDOVINA = [
  ["grassa", /cact|grass[ae]|succul|aloe|echeveri|crassul|sansevier|haworth|opunt|kalancho|agave|sedum|zamioc/i],
  ["aromatica", /basilic|basil|rosmarin|rosemar|salvia|sage|menta|mint|prezzem|parsley|timo\b|thyme|origan|oregano|lavand|erba ?cipol|chive|alloro|bay ?leaf|maggiorana|marjoram|aromatic|herb/i],
  ["orto", /\borto\b|pomodor|tomat|zucchin|insalat|lattug|lettuce|peperon|pepper|fragol|strawberr|melanz|aubergin|eggplant|cetriol|cucumb|fagiol|bean|vegetable|veggie/i],
  ["albero", /alber|tree|limon|lemon|ulivo|olivo|olive|aranc|orange|\bfico\b|\bfig\b|bonsai|\bmelo\b|\bpero\b|pesco|cilieg|cherry|palm|acero|maple|mandarin|agrum|citrus/i],
  ["fiorita", /orchid|\brosa\b|\brose|geran|fior|flower|ciclamin|cyclamen|begon|anthur|azale|gerber|violet|petun|ortensi|hydrang|calla|gardenia|camelia|bouganv|stella di natale|poinsett|tulip|giacint|hyacinth/i],
];
const indovina = s => (INDOVINA.find(([, re]) => re.test(s || "")) || ["verde"])[0];

/* ================= misure dei sensori ================= */
const MIS = ["umidita", "luce", "temp", "cond", "batt"];
const MIS_N = () => ({ umidita: ["💧", t("Umidità del terreno", "Soil moisture"), t("Terreno", "Soil")], luce: ["☀️", t("Luce", "Light"), t("Luce", "Light")],
  temp: ["🌡️", t("Temperatura", "Temperature"), t("Temperatura", "Temperature")], cond: ["🌱", t("Fertilità", "Fertility"), t("Fertilità", "Fertility")],
  batt: ["🔋", t("Pila del sensore", "Sensor battery"), t("Pila", "Battery")] });
const testo = id => (id + " " + nmHA(id)).toLowerCase();
/** che cosa misura un sensore (per le piante), o null */
function misura(id) {
  if (!id?.startsWith("sensor.")) return null;
  const dc = deviceClass(id), u = String(unit(id)).toLowerCase(), s = testo(id);
  if (dc === "moisture" || (u === "%" && /soil|terreno|suolo|moisture/.test(s) && !/humidity|umidit[aà] (dell')?aria/.test(s))) return "umidita";
  if (dc === "illuminance" || u === "lx") return "luce";
  if (dc === "conductivity" || /[µμu]s\/cm/.test(u) || /conductiv|conducib|fertil/.test(s)) return "cond";
  if (dc === "battery" || (u === "%" && /batter/.test(s))) return "batt";
  if (dc === "temperature" || /°\s?[cf]$/.test(u)) return "temp";
  return null;
}
/* sensori di umidità che non sono di una pianta */
const NON_PIANTA = /\b(aria|air|room|stanza|wall|muro|legno|wood|leak|perdit|allag|flood)\b/i;
const fratelli = id => { const d = REG[id]?.device; return d ? Object.keys(S).filter(x => x !== id && REG[x]?.device === d) : []; };
const CORE = { moisture: "umidita", brightness: "luce", temperature: "temp", conductivity: "cond", battery: "batt" };
const pulisci = n => { const s = String(n || "").replace(/umidit[aà]\s*(del\s*)?(terreno|suolo)|soil\s*moisture|moisture|umidit[aà]|sensore|sensor/gi, " ").replace(/\s+/g, " ").trim(); return s ? s[0].toUpperCase() + s.slice(1) : String(n || ""); };

/** piante trovate da sole: { id, ent, sens:{misura:id}, nome, area } */
let TC = null, TT = 0;
function trovate() {
  const n = performance.now(); if (TC && n - TT < 80) return TC;
  const out = [], usati = new Set();
  for (const id of allEnts("plant")) {
    const sens = {}, sc = attr(id, "sensors");
    if (sc && typeof sc === "object") for (const [k, e] of Object.entries(sc)) if (CORE[k] && typeof e === "string" && S[e]) sens[CORE[k]] = e;
    for (const x of fratelli(id)) { const k = misura(x); if (k && !sens[k]) sens[k] = x; }
    Object.values(sens).forEach(e => usati.add(e)); if (REG[id]?.device) usati.add("dev:" + REG[id].device);
    out.push({ id, ent: id, sens, nome: nmHA(id), area: areaOf(id) || Object.values(sens).map(areaOf).find(Boolean) || null });
  }
  const G = {};
  for (const id of Object.keys(S)) {
    if (usati.has(id) || REG[id]?.hidden || REG[id]?.cat != null || misura(id) !== "umidita" || NON_PIANTA.test(testo(id))) continue;
    if (String(unit(id) || "%") !== "%") continue;
    const dev = REG[id]?.device; if (dev && usati.has("dev:" + dev)) continue;
    const k = dev ? "dev:" + dev : "s:" + id;
    if (!G[k]) G[k] = { id: k, dev, sens: { umidita: id } };
  }
  for (const g of Object.values(G)) {
    if (g.dev) for (const x of fratelli(g.sens.umidita)) { const k = misura(x); if (k && !g.sens[k]) g.sens[k] = x; }
    const b = g.sens.umidita, dn = g.dev && DEVICES[g.dev] ? DEVICES[g.dev].name : "";
    out.push({ id: g.id, ent: null, sens: g.sens, nome: dn && !/^(flower ?care|mi ?flora|soil|plant ?sensor)\b/i.test(dn) ? dn : pulisci(nmHA(b)),
      area: areaOf(b) || (g.dev && DEVICES[g.dev]?.area) || null });
  }
  TC = out; TT = n; return out;
}

/* ================= dati ================= */
const sezione = () => casa(SEZ);
const recs = () => { const s = sezione(); return s?.stato === "ok" && s.dati?.piante && typeof s.dati.piante === "object" ? s.dati.piante : {}; };
const FUORI = /estern|outdoor|outside|fuori|giardin|garden|terrazz|balcon|cortile|yard|patio|veranda|portico|porch|tetto|roof|\borto\b|prato|lawn/i;
const fuoriAuto = (area, nome) => FUORI.test((area && AREAS[area] ? (AREAS[area].nameHA || "") + " " + AREAS[area].name + " " + area : "") + " " + (nome || ""));
function vista(a, r) {
  const sens = { ...a.sens };
  for (const [k, e] of Object.entries(r.sens || {})) { if (e === "none") delete sens[k]; else if (e && S[e]) sens[k] = e; }
  const area = "area" in r ? (r.area && AREAS[r.area] ? r.area : null) : a.area;
  const nome = String(r.nome || a.nome || "?");
  const tipo = DEF[r.tipo] ? r.tipo : indovina(nome + " " + (a.ent ? String(attr(a.ent, "species") || "") : ""));
  return { id: a.id, man: !!a.man, ent: a.ent || null, rec: r, nome, nomeAuto: a.nome, area, areaAuto: a.area || null, tipo, sens,
    fuori: typeof r.fuori === "boolean" ? r.fuori : fuoriAuto(area, nome), foto: r.foto || "", zona: r.zona && S[r.zona] ? r.zona : "" };
}
let PC = null, PT = 0, PR = null;
/** tutte le piante, in ordine di stanza e di nome (rifatte a ogni disegno e subito quando cambiano i dati della casa) */
export function piante() {
  const n = performance.now(), R = recs(); if (PC && n - PT < 80 && R === PR) return PC;
  const out = [];
  for (const a of trovate()) { const r = R[a.id] || {}; if (!r.tolta) out.push(vista(a, r)); }
  for (const [id, r] of Object.entries(R)) if (r && r.man && !r.tolta) out.push(vista({ id, man: true, sens: {}, nome: r.nome, area: null }, r));
  const ord = areasSorted(true), pos = a => { const i = ord.indexOf(a); return i < 0 ? 999 : i; };
  out.sort((a, b) => pos(a.area) - pos(b.area) || a.nome.localeCompare(b.nome, LOC));
  PC = out; PT = n; PR = R; return out;
}
const trova = id => piante().find(p => p.id === id) || null;
/** piante trovate da sole ma tolte (si rimettono) */
const tolte = () => { const R = recs(); return trovate().filter(a => R[a.id]?.tolta).map(a => vista(a, R[a.id])); };
/** la persona di chi usa la plancia */
const io = () => UI.user?.id ? allEnts("person").find(p => attr(p, "user_id") === UI.user.id) || null : null;
const nomeChi = p => p && S[p] ? nmHA(p) : "";
const nuovoId = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** cambia (o crea) la pianta id nei dati della casa: fn(record, tutte); tiene aggiornati nome e «fuori» per l'automazione del telefono */
function scrivi(id, fn, msg) {
  return casaCambia(SEZ, d => {
    if (!d.piante || typeof d.piante !== "object") d.piante = {};
    const r = d.piante[id] = JSON.parse(JSON.stringify(d.piante[id] || {}));
    if (fn(r, d.piante) === false) return false;
    if (!d.piante[id]) return;   // eliminata
    const a = trovate().find(x => x.id === id) || { id, man: true, sens: {}, nome: r.nome, area: null }, v = vista(a, r);
    r.nt = v.nome; r.fz = v.fuori;
  }, msg);
}

/* ================= soglie e stato ================= */
const sole = () => { const e = +attr("sun.sun", "elevation"); return S["sun.sun"] ? (isNaN(e) ? (S["sun.sun"].state === "above_horizon" ? 30 : -10) : e) : 30; };
const fC = v => Math.round(v * 9 / 5 + 32);
/** soglie [min, max] di una misura: scelte con ✏️, poi quelle dell'entità plant (Plant Monitor), poi quelle indicative del tipo */
function soglie(p, k) {
  if (k === "batt") return [battMin(), null];
  const mie = p.rec.soglie?.[k];
  const d = DEF[p.tipo][k].slice(), id = p.sens[k], F = k === "temp" && id && /°\s?F/i.test(unit(id));
  if (F) { d[0] = fC(d[0]); d[1] = fC(d[1]); }
  const ent = sogliaEnt(p, k);
  const base = [ent[0] ?? d[0], ent[1] ?? d[1]];
  return [Number.isFinite(+mie?.[0]) && mie?.[0] !== "" && mie?.[0] != null ? +mie[0] : base[0], Number.isFinite(+mie?.[1]) && mie?.[1] !== "" && mie?.[1] != null ? +mie[1] : base[1]];
}
/* Plant Monitor: le soglie sono entità number sullo stesso dispositivo (min_soil_moisture, max_illuminance…) */
const PAROLA_ENT = { umidita: /moisture/, luce: /illuminance|brightness|light/, temp: /temperature/, cond: /conductivity/ };
function sogliaEnt(p, k) {
  if (!p.ent || !PAROLA_ENT[k]) return [];
  const N = fratelli(p.ent).filter(x => x.startsWith("number.") && PAROLA_ENT[k].test(x) && ok(x) && !/dli|humidity/.test(x));
  const v = re => { const x = N.find(y => re.test(y)); return x ? val(x) : null; };
  return [v(/_min_|min_/), v(/_max_|max_/)];
}
const battMin = () => lim(+C().batt || 15, 1, 60);
const hoSoglieMie = (p, k) => Array.isArray(p.rec.soglie?.[k]) && p.rec.soglie[k].some(x => x !== "" && x != null);
/** giudizio dell'entità plant: «basso», «alto», «ok» o undefined */
function giudizioEnt(p, k) {
  if (!p.ent || !ok(p.ent) || hoSoglieMie(p, k)) return undefined;
  const A = { umidita: "moisture_status", luce: "illuminance_status", temp: "temperature_status", cond: "conductivity_status" }[k];
  const s = A ? String(attr(p.ent, A) ?? "").toLowerCase() : "";
  if (s) return s === "low" ? "basso" : s === "high" ? "alto" : "ok";
  const pr = attr(p.ent, "problem"); if (pr == null) return undefined;
  const w = { umidita: "moisture", luce: "brightness", temp: "temperature", cond: "conductivity", batt: "battery" }[k], x = String(pr).toLowerCase();
  return x.includes(w + " low") ? "basso" : x.includes(w + " high") ? "alto" : "ok";
}
/** le misure della pianta: [{ k, id, v, mn, mx, st: "basso"|"alto"|"ok"|null }] */
function letture(p) {
  const L = [];
  for (const k of MIS) {
    const id = p.sens[k]; if (!id || !S[id]) continue;
    const v = val(id), [mn, mx] = soglie(p, k);
    let st = v == null ? null : (k === "batt" ? (v < mn ? "basso" : "ok") : (mn != null && v < mn ? "basso" : mx != null && v > mx ? "alto" : "ok"));
    const e = k === "batt" ? undefined : giudizioEnt(p, k);
    /* la pianta di Home Assistant giudica con le sue soglie: se non le conosco (né mie né di Plant Monitor) non disegno la fascia */
    const fascia = e === undefined || hoSoglieMie(p, k) || sogliaEnt(p, k).some(x => x != null);
    if (e !== undefined && v != null) st = e;
    else if (k === "luce" && st === "basso" && (p.fuori ? sole() < 15 : sole() < 20)) st = "ok";   // di notte o al mattino presto la luce è poca per forza
    L.push({ k, id, v, mn, mx, st, fascia });
  }
  return L;
}
const PAROLE = () => ({
  umidita: { basso: ["💧", t("Ha sete", "Thirsty")], alto: ["🌊", t("Troppa acqua", "Too much water")] },
  temp: { basso: ["🥶", t("Ha freddo", "Too cold")], alto: ["🥵", t("Ha caldo", "Too hot")] },
  luce: { basso: ["🌥️", t("Poca luce", "Not enough light")], alto: ["☀️", t("Troppa luce", "Too much light")] },
  cond: { basso: ["🍽️", t("Ha fame: concimala", "Hungry: feed it")], alto: ["🧂", t("Troppo concime", "Too much fertiliser")] },
  batt: { basso: ["🪫", t("Pila del sensore scarica", "Sensor battery low")] },
});
/** problemi dai sensori, dal più importante: [{ k, st, ic, n }] */
function problemi(p) {
  const W = PAROLE();
  return letture(p).filter(m => m.st === "basso" || m.st === "alto").map(m => ({ ...m, ic: W[m.k][m.st][0], n: W[m.k][m.st][1] }));
}
const haSete = p => letture(p).some(m => m.k === "umidita" && m.st === "basso");

/* ================= promemoria ================= */
/** ogni quanto: giorni per l'acqua, settimane per il concime (0 = nessun promemoria) */
const ogniDi = (p, c) => { const o = p.rec[c]?.ogni; return o != null && o !== "" ? lim(Math.round(+o) || 0, 0, c === "acqua" ? 60 : 52) : p.man ? DEF[p.tipo][c] : 0; };
/* pioggia di domani: le soglie le scelgono gli amministratori in ⚙️ (60% o 2 mm se non scelgono) */
const PIOGGIA = ["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"];
const prMin = () => lim(+C().pioggia?.pr || 60, 10, 100);
const mmMin = () => lim(C().pioggia?.mm != null && C().pioggia.mm !== "" ? +C().pioggia.mm : 2, 0, 100);
function pioggiaDomani() {
  const w = weatherEnt(); if (!w) return null;
  const k = piuGiorni(Date.now(), 1).toDateString(), f = (forecast(w, "daily") || []).find(x => new Date(x.datetime).toDateString() === k);
  if (!f) return null;
  return PIOGGIA.includes(f.condition) || (f.precipitation_probability ?? 0) >= prMin() || (mmMin() > 0 && (f.precipitation ?? 0) >= mmMin()) ? f : null;
}
/** prossima volta: { g (giorno), m (giorni che mancano: < 0 in ritardo), slitta, ogni, ultima, via, chi } o null */
function scad(p, c) {
  const o = ogniDi(p, c); if (!o) return null;
  const r = p.rec[c] || {}, passo = c === "acqua" ? o : o * 7;
  const g0 = r.ultima ? piuGiorni(r.ultima, passo) : mezzanotte(Date.now());
  let g = g0, slitta = false;
  if (c === "acqua" && p.fuori && giorniTra(Date.now(), g0) <= 1 && pioggiaDomani()) { g = piuGiorni(Date.now(), 2); slitta = true; }
  return { g, m: giorniTra(Date.now(), g), slitta, ogni: o, ultima: r.ultima || null, via: r.via, chi: r.chi };
}
const daFare = (p, c) => { const s = scad(p, c); return !!s && s.m <= 0; };
const fattoOggi = (p, c) => { const u = p.rec[c]?.ultima; return !!u && giorniTra(u, Date.now()) === 0; };
function ogniTesto(c, o) {
  if (c === "acqua") return o === 1 ? t("ogni giorno", "every day") : o === 7 ? t("ogni settimana", "every week") : o % 7 === 0 ? t(`ogni ${o / 7} settimane`, `every ${o / 7} weeks`) : t(`ogni ${o} giorni`, `every ${o} days`);
  return o === 1 ? t("ogni settimana", "every week") : o === 4 ? t("ogni mese", "every month") : t(`ogni ${o} settimane`, `every ${o} weeks`);
}
function quandoTesto(s) {
  if (s.m < 0) return t("in ritardo di ", "overdue by ") + giorni(-s.m);
  if (s.m === 0) return t("oggi", "today");
  if (s.m === 1) return t("domani", "tomorrow");
  return s.m < 7 ? t(`tra ${s.m} giorni`, `in ${s.m} days`) : giornoBreve(s.g);
}
/** cosa fare oggi: [{ p, c }] (annaffiare, concimare) */
const oggi = () => piante().flatMap(p => ["acqua", "concime"].filter(c => daFare(p, c)).map(c => ({ p, c, s: scad(p, c) })));
/** stato della pianta per il colore: "ko" (problema dai sensori o in ritardo), "fare" (da fare oggi), "ok" */
function statoP(p) {
  const P = problemi(p);
  if (P.some(x => x.k !== "batt") || ["acqua", "concime"].some(c => { const s = scad(p, c); return s && s.m < 0; })) return "ko";
  if (["acqua", "concime"].some(c => daFare(p, c)) || P.length) return "fare";
  return "ok";
}

/* ================= «Fatto oggi» ================= */
async function fatto(id, c) {
  const p = trova(id); if (!p) return;
  const q = new Date().toISOString(), chi = io(), o = ogniDi(p, c);
  const ok1 = await scrivi(id, r => {
    const x = { ...(r[c] || {}) }; if (x.ogni == null) x.ogni = o;
    const prima = x.ultima || null, primaChi = x.chi || null, primaVia = x.via || null; x.ultima = q; x.chi = chi; delete x.via; r[c] = x;
    r.storia = [{ c, q, chi, prima, primaChi, primaVia }, ...(Array.isArray(r.storia) ? r.storia : [])].slice(0, MAX_STORIA);
  });
  if (ok1) toast((c === "acqua" ? "💧 " + t("Annaffiata: ", "Watered: ") : "🌱 " + t("Concimata: ", "Fed: ")) + p.nome);
}
/** annulla l'ultimo «Fatto» di oggi */
async function annulla(id, c) {
  const p = trova(id); if (!p) return;
  const ok1 = await scrivi(id, r => {
    const x = r[c]; if (!x?.ultima) return false;
    const S0 = Array.isArray(r.storia) ? r.storia : [], i = S0.findIndex(s => s.c === c && s.q === x.ultima);
    if (i < 0) return false;
    r[c] = { ...x, ultima: S0[i].prima || null, chi: S0[i].primaChi || null }; delete r[c].via; if (S0[i].primaVia) r[c].via = S0[i].primaVia; if (!r[c].ultima) delete r[c].ultima;
    r.storia = S0.filter((_, j) => j !== i);
  });
  if (ok1) toast("↶ " + p.nome);
}

/* ================= disegni (SVG fatti per 'Nduja) ================= */
const VASO = `<path class="vs" d="M39 85h42l-5.5 27h-31z"/><path class="vsh" d="M42 88h36l-1 5H43z"/><rect class="vo" x="34" y="78" width="52" height="9" rx="3"/><ellipse class="tr" cx="60" cy="79.6" rx="23" ry="2.6"/>`;
const foglia = (x, y, r, s = 1, cls = "lf") => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path class="${cls}" d="M0 0C-10-6-13-21 0-33C13-21 10-6 0 0Z"/><path class="vn" d="M0-2V-30"/></g>`;
const fogliolina = (x, y, r, s = 1, cls = "lf") => `<path class="${cls}" transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0C-4-3-5-9 0-12C5-9 4-3 0 0Z"/>`;
const fiore = (x, y, s = 1, cls = "pt") => `<g class="fi" transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288].map(a => `<ellipse class="${cls}" rx="4.2" ry="6.4" transform="rotate(${a}) translate(0 -5.6)"/>`).join("")}<circle class="cu" r="3.2"/></g>`;
const DIS = {
  verde: () => `${VASO}<g class="fo"><path class="st" d="M60 79C58 67 50 60 42 55M60 79C61 64 61 52 60 40M60 79C62 67 70 60 79 56M60 79C56 72 46 71 36 70M60 79C64 72 74 71 84 71"/>
    ${foglia(36, 70, -78, .72, "lf2")}${foglia(84, 71, 78, .72, "lf2")}${foglia(42, 55, -46, .92)}${foglia(79, 56, 46, .92)}${foglia(60, 41, 0, 1.02, "lf2")}</g>`,
  grassa: () => `${VASO}<g class="fo"><path class="cc" d="M45 80C41 62 45 42 60 39C75 42 79 62 75 80Z"/><path class="cr" d="M52 79C49 64 51 48 60 40M68 79C71 64 69 48 60 40M60 40V79"/>
    <path class="cc" d="M75 66C83 66 86 60 86 51C86 46.5 81 46.5 81 51C81 57 79 60 75 60.5Z"/><path class="cc" d="M45.5 70C39 70 36 65 36 59C36 55 40.5 55 40.5 59C40.5 63 42 65 45 65.4Z"/>
    <g class="sp">${[[50, 50], [56, 46], [64, 46], [70, 50], [49, 62], [71, 62], [55, 70], [65, 70], [84, 52], [38, 60]].map(([x, y]) => `<path d="M${x} ${y}l-2-1.4M${x} ${y}l2-1.4"/>`).join("")}</g>${fiore(60, 37, .55, "pt3")}</g>`,
  fiorita: () => `${VASO}<g class="fo"><path class="st" d="M60 79C58 66 50 56 46 44M60 79C61 64 63 50 64 34M60 79C63 68 72 60 78 50"/>
    ${fogliolina(54, 72, -60, 1.6)}${fogliolina(66, 72, 60, 1.6)}${fogliolina(53, 62, -40, 1.3, "lf2")}${fogliolina(68, 60, 50, 1.3, "lf2")}${fogliolina(62, 50, 20, 1.2)}
    ${fiore(46, 42, 1)}${fiore(64, 32, 1.12, "pt2")}${fiore(78, 48, .92)}</g>`,
  aromatica: () => `${VASO}<g class="fo"><path class="st" d="M60 79C58 68 52 60 48 50M60 79C60 66 60 56 61 44M60 79C62 69 68 61 73 53M60 79C56 73 48 70 42 66M60 79C64 73 72 71 79 68"/>
    ${[[48, 50, -20], [61, 44, 5], [73, 53, 25], [42, 66, -60], [79, 68, 60], [52, 60, -50], [56, 56, 30], [66, 58, -30], [69, 64, 50], [51, 70, -70], [64, 50, -15], [58, 66, 10], [45, 58, -35], [76, 60, 40]]
      .map(([x, y, r], i) => fogliolina(x, y, r, 1.25 + (i % 3) * .15, i % 2 ? "lf2" : "lf")).join("")}</g>`,
  orto: () => `<path class="cs" d="M30 84h60v26H30z"/><path class="csl" d="M30 92h60M30 101h60"/><path class="tr" d="M31 84h58v3H31z"/>
    <g class="fo"><path class="pa" d="M73 86V30"/><path class="pal" d="M70.5 44h5M70.5 60h5"/><path class="st" d="M60 85C58 74 64 68 62 58C60 50 66 44 64 34M62 66C56 62 50 62 46 56M63 52C69 50 74 46 78 40"/>
    ${fogliolina(46, 56, -70, 1.6)}${fogliolina(78, 40, 60, 1.4, "lf2")}${fogliolina(56, 72, -50, 1.5, "lf2")}${fogliolina(66, 46, 30, 1.3)}${fogliolina(60, 40, -20, 1.2, "lf2")}${fogliolina(64, 34, 0, 1.1)}
    ${[[52, 64, 5.4], [60, 70, 6], [69, 56, 4.8]].map(([x, y, r]) => `<g class="fr"><circle class="pm" cx="${x}" cy="${y}" r="${r}"/><circle class="pml" cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .28}"/><path class="pmc" d="M${x - 2.6} ${y - r + .6}l2.6 1.8 2.6-1.8M${x} ${y - r - 1}v2.4"/></g>`).join("")}</g>`,
  albero: () => `${VASO}<g class="fo"><path class="tk" d="M57 80C58 70 56 63 50 56L53.5 53.5C58 58 60 62 60.5 66C61 61 63.5 56.5 68 52L71 55C66 60 63.5 68 63.5 80Z"/>
    <circle class="cp" cx="50" cy="46" r="15"/><circle class="cp" cx="72" cy="45" r="15"/><circle class="cp2" cx="61" cy="33" r="17"/><circle class="cp" cx="60" cy="52" r="12"/>
    <circle class="cph" cx="55" cy="27" r="6"/><circle class="cph" cx="44" cy="41" r="4.5"/>
    ${[[47, 52], [69, 50], [74, 38], [58, 40], [64, 24]].map(([x, y]) => `<ellipse class="fl" cx="${x}" cy="${y}" rx="3.4" ry="2.6"/>`).join("")}</g>`,
};
/** il disegno della pianta: cls «sete» (foglie giù), «bagnata» (terra scura) */
function disegno(tipo, cls = "") {
  return `<svg class="pi1s t-${tipo} ${cls}" viewBox="0 18 120 96" aria-hidden="true"><ellipse class="om" cx="60" cy="112" rx="30" ry="3"/>${(DIS[tipo] || DIS.verde)()}</svg>`;
}
const bagnata = p => { const u = p.rec.acqua?.ultima; const m = letture(p).find(x => x.k === "umidita"); return m?.v != null ? m.st !== "basso" : !!u && Date.now() - new Date(u).getTime() < 8 * 36e5; };
function clsDis(p) { return [haSete(p) || (p.rec.acqua && scad(p, "acqua")?.m < 0) ? "sete" : "", bagnata(p) ? "bagnata" : ""].join(" "); }

/* ---------- foto ---------- */
const KO = new Set();
window.ndujaPiKo = el => { if (el?.dataset?.u) { KO.add(el.dataset.u); render(); } };
/** indirizzo della foto: /local/…, /api/image/serve/… (caricata dalla plancia) o media-source:// (dai Media) */
function fotoUrl(f) {
  if (!f) return null;
  if (f.startsWith("media-source://")) return cached("pi:ms:" + f, 3 * 36e5, async () => (await ws({ type: "media_source/resolve_media", media_content_id: f, expires: 21600 })
    .catch(e => e?.code === "invalid_format" ? ws({ type: "media_source/resolve_media", media_content_id: f }) : Promise.reject(e)))?.url) || null;
  return indirizzoLocale(f);
}
function figura(p, cls = "") {
  const u = fotoUrl(p.foto);
  if (u && !KO.has(u)) return `<span class="pi1f ${cls}"><img src="${esc(u)}" alt="${esc(p.nome)}" loading="lazy" decoding="async" data-u="${esc(u)}" onerror="ndujaPiKo(this)"></span>`;
  return `<span class="pi1f dis ${cls} s-${statoP(p)}">${disegno(p.tipo, clsDis(p))}</span>`;
}

/* ================= pagina ================= */
const nomeStanza = a => a && AREAS[a] ? AREAS[a].name : t("Senza stanza", "No room");
const pagAttiva = () => !!PAGES.piante?.show() && LAYOUT.pages?.piante !== false && utenteCfg().pages?.piante !== false;
/** scala di una barra: posizione 0…1 del valore */
function pos(k, v) {
  if (v == null) return 0;
  if (k === "luce") return lim(Math.log10(Math.max(1, v)) / 5, 0, 1);   // da 1 a 100.000 lx
  if (k === "temp") return lim((v + 10) / 55, 0, 1);
  if (k === "cond") return lim(v / 3000, 0, 1);
  return lim(v / 100, 0, 1);
}
const valTxt = m => m.v == null ? "—" : m.k === "luce" ? (m.v >= 10000 ? fnum(m.v / 1000, 0) + "k" : fnum(m.v, 0)) + " lx" : fnum(m.v, m.k === "temp" ? 1 : 0) + (unit(m.id) ? (m.k === "temp" ? "" : " ") + unit(m.id) : "");
function barra(m, p) {
  const tempF = m.k === "temp" && /°\s?F/i.test(unit(m.id)), pv = v => m.k === "temp" && tempF ? pos("temp", (v - 32) * 5 / 9) : pos(m.k, v);
  const a = m.mn != null ? pv(m.mn) : 0, b = m.k === "batt" ? 1 : m.mx != null ? pv(m.mx) : 1, x = pv(m.v);
  const N = MIS_N()[m.k];
  return `<button class="pi1m s-${m.st || "x"}" data-act="more" data-id="${m.id}" aria-label="${esc(N[1])}: ${esc(valTxt(m))}"><span class="ic">${N[0]}</span><span class="nm">${esc(N[2])}</span>
    <span class="br">${m.fascia ? `<i style="left:${(a * 100).toFixed(1)}%;width:${((b - a) * 100).toFixed(1)}%"></i>` : ""}${m.v != null ? `<u style="left:${(x * 100).toFixed(1)}%"></u>` : ""}</span><b>${esc(valTxt(m))}</b></button>`;
}
function riga(p, c) {
  const s = scad(p, c); if (!s) return "";
  const fo = fattoOggi(p, c), ic = c === "acqua" ? "💧" : "🌱", irr = c === "acqua" && s.via === "irr" && s.ultima;
  const ul = s.ultima ? (irr ? t("irrigata ", "watered by irrigation ") : (c === "acqua" ? t("annaffiata ", "watered ") : t("concimata ", "fed "))) + quandoFatto(s.ultima) + (s.chi && S[s.chi] && !irr ? " · " + nomeChi(s.chi) : "") : t("mai segnata", "never logged");
  const cls = s.m < 0 ? "tardi" : s.m === 0 ? "oggi" : "poi";
  return `<div class="pi1r ${fo ? "fatto" : cls}"><span class="ic">${ic}</span><div class="tx"><b>${c === "acqua" ? t("Annaffia ", "Water ") : t("Concima ", "Feed ")}${esc(ogniTesto(c, s.ogni))}</b>
      <span>${fo ? "✓ " + esc(ul) + " · " + t("prossima ", "next ") + esc(quandoTesto(s)) : `<em>${esc(quandoTesto(s))}</em> · ${esc(ul)}`}</span>
      ${s.slitta ? `<span class="pi1rn">🌧️ ${t("Domani piove: slitta a ", "Rain tomorrow: moved to ")}${esc(giornoBreve(s.g))}</span>` : ""}</div>
    ${fo && !irr ? `<button class="pi1u" data-act="piAnnulla" data-id="${esc(p.id)}" data-c="${c}" aria-label="${t("Annulla", "Undo")}">↶</button>`
      : `<button class="pi1x ${s.m <= 0 ? "pri" : ""}" data-act="piFatto" data-id="${esc(p.id)}" data-c="${c}"><i>✓</i>${t("Fatto oggi", "Done today")}</button>`}</div>`;
}
function tessera(p) {
  const st = statoP(p), P = problemi(p), L = letture(p), dentro = p.fuori ? "🌳 " + t("fuori", "outside") : "";
  const fare = ["acqua", "concime"].filter(c => daFare(p, c));
  const frase = P.length ? P.map(x => `<span class="pw s-${x.st}">${x.ic} ${esc(x.n)}</span>`).join("")
    : fare.length ? fare.map(c => `<span class="pw s-fare">${c === "acqua" ? "💧 " + t("Da annaffiare", "Needs water") : "🌱 " + t("Da concimare", "Needs feeding")}</span>`).join("")
    : `<span class="pw s-ok">✓ ${t("Tutto ok", "All good")}</span>`;
  const zona = p.zona ? `<div class="pi1z">🚿 ${t("Irrigata dalla zona ", "Watered by the zone ")}<b>${esc(nmZona(p.zona))}</b>${ok(p.zona) && ["on", "open", "opening"].includes(S[p.zona].state) ? " · " + t("adesso", "now") : ""}</div>` : "";
  return `<article class="pi1t s-${st}">
    <button class="pi1v" data-act="piEd" data-id="${esc(p.id)}" aria-label="${t("Modifica", "Edit")} · ${esc(p.nome)}">${figura(p)}</button>
    <div class="pi1h"><div class="tx"><b>${esc(p.nome)}</b><span>${esc([tipoNome(p.tipo), dentro].filter(Boolean).join(" · "))}</span></div>
      <button class="pi1e" data-act="piEd" data-id="${esc(p.id)}" aria-label="${t("Modifica", "Edit")} · ${esc(p.nome)}">✏️</button></div>
    <div class="pi1w">${frase}</div>
    ${L.length ? `<div class="pi1ms">${L.map(m => barra(m, p)).join("")}</div>` : ""}
    ${riga(p, "acqua")}${riga(p, "concime")}${zona}
  </article>`;
}
const nmZona = id => { try { return LAYOUT.names?.[id] || nmHA(id); } catch { return id; } };
function hero(P) {
  const O = oggi(), sete = P.filter(p => haSete(p) && !daFare(p, "acqua")), pd = pioggiaDomani(), F = P.filter(p => p.fuori && scad(p, "acqua"));
  const ko = P.filter(p => statoP(p) !== "ok").length;
  const tit = !O.length && !sete.length ? t("Tutte a posto", "All fine") : t(`${O.length + sete.length} cos${O.length + sete.length === 1 ? "a" : "e"} da fare`, `${O.length + sete.length} thing${O.length + sete.length === 1 ? "" : "s"} to do`);
  const righe = [...O.map(({ p, c, s }) => `<div class="pi1o ${s.m < 0 ? "tardi" : ""}"><span class="mini">${figura(p, "xs")}</span><div class="tx"><b>${esc(p.nome)}</b><span>${c === "acqua" ? "💧 " + t("annaffiare", "water") : "🌱 " + t("concimare", "feed")} · ${esc(quandoTesto(s))}</span></div>
      <button class="pi1x pri" data-act="piFatto" data-id="${esc(p.id)}" data-c="${c}"><i>✓</i>${t("Fatto", "Done")}</button></div>`),
    ...sete.map(p => { const m = letture(p).find(x => x.k === "umidita"); return `<div class="pi1o tardi"><span class="mini">${figura(p, "xs")}</span><div class="tx"><b>${esc(p.nome)}</b><span>💧 ${t("ha sete", "is thirsty")} · ${esc(valTxt(m))}</span></div>
      <button class="pi1x" data-act="piFatto" data-id="${esc(p.id)}" data-c="acqua"><i>✓</i>${t("Annaffiata", "Watered")}</button></div>`; })].join("");
  const adm = isAdmin(), prom = !!C().promemoria;
  return `<section class="card span3 pi1hc"><div class="ch"><h2>🪴 ${t("Le mie piante", "My plants")} <span class="tag ${ko ? "warn" : "ok"}">${P.length}</span></h2><div class="row" style="gap:6px">
      <button class="btn sm" data-act="piNuova">＋ ${t("Pianta", "Plant")}</button>${adm ? `<button class="btn sm ${prom ? "on1" : ""}" data-act="piProm" aria-label="${t("Promemoria sul telefono", "Phone reminders")}">🔔${prom ? " ✓" : ""}</button><button class="btn sm" data-act="piCfg" aria-label="${t("Impostazioni", "Settings")}">⚙️</button>` : ""}</div></div>
    <div class="pi1hh"><div class="pi1hs">${["verde", "fiorita", "grassa"].map(k => disegno(k)).join("")}</div><div class="pi1ht"><b>${esc(tit)}</b>
      <span>${t(`${P.length} piant${P.length === 1 ? "a" : "e"}`, `${P.length} plant${P.length === 1 ? "" : "s"}`)}${P.filter(p => p.fuori).length ? " · " + t(`${P.filter(p => p.fuori).length} fuori`, `${P.filter(p => p.fuori).length} outside`) : ""}${P.filter(p => letture(p).length).length ? " · " + t(`${P.filter(p => letture(p).length).length} con i sensori`, `${P.filter(p => letture(p).length).length} with sensors`) : ""}</span>
      ${pd && F.length ? `<span class="pi1pd">${(WX()[pd.condition] || ["🌧️"])[0]} ${t("Domani piove: i promemoria per annaffiare le piante di fuori slittano.", "Rain tomorrow: watering reminders for outdoor plants are moved.")}</span>` : ""}</div></div>
    ${righe ? `<div class="pi1os">${righe}</div>` : `<div class="pi1ok">✓ ${t("Niente da fare oggi.", "Nothing to do today.")}</div>`}</section>`;
}
function gruppi(P) {
  const G = {}; P.forEach(p => (G[p.area || "_"] = G[p.area || "_"] || []).push(p));
  const ord = [...areasSorted(true).filter(a => G[a]), ...(G._ ? ["_"] : [])];
  return ord.map(a => `<section class="card span3 pi1g"><div class="ch"><h2>${a !== "_" && fuoriAuto(a, "") ? "🌳" : "🏠"} ${esc(a === "_" ? t("Senza stanza", "No room") : nomeStanza(a))} <span class="tag info">${G[a].length}</span></h2></div>
    <div class="pi1l">${G[a].map(tessera).join("")}</div></section>`).join("");
}
function vuota() {
  return `<section class="card span3 pi1z0"><div class="pi1zh"><div class="pi1hs">${["fiorita", "verde", "aromatica"].map(k => disegno(k)).join("")}</div><div>
      <h3>${t("Nessuna pianta, per ora", "No plants yet")}</h3>
      <p class="small muted">${t("Aggiungi le tue piante: ogni quanto annaffiarle e concimarle, con un promemoria quando tocca. Chiunque in casa può segnare «Fatto oggi». Se hai sensori per le piante (Mi Flora, Plant Monitor, sensori del terreno) compaiono da sole, con l'umidità della terra, la luce e la temperatura.", "Add your plants: how often to water and feed them, with a reminder when it's time. Anyone at home can mark «Done today». If you have plant sensors (Mi Flora, Plant Monitor, soil sensors) they show up by themselves, with soil moisture, light and temperature.")}</p>
      <button class="btn pri" data-act="piNuova" style="margin-top:12px">＋ ${t("Aggiungi una pianta", "Add a plant")}</button></div></div></section>`;
}
function piede() {
  const T = tolte(), servizio = serviziHA(), zoneUsate = piante().some(p => p.zona);
  return `<section class="card span3 pi1pie">
    ${T.length ? `<div class="fl1">${t("Tolte da questa pagina", "Removed from this page")}</div><div class="stack">${T.map(p => `<div class="li"><div class="tx"><b>${esc(p.nome)}</b><span>${t("trovata da sola", "found automatically")}</span></div><button class="btn sm" data-act="piRimetti" data-id="${esc(p.id)}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>` : ""}
    ${zoneUsate && servizio === false ? `<div class="note1">${t("Per segnare da sole le piante annaffiate dall'irrigazione riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha cambiato anche la parte in Python.", "To mark plants watered by irrigation automatically, restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update also changed the Python part.")}</div>` : ""}
    <p class="small muted pi1nt">${t("Le soglie dei sensori sono indicative, scritte per 'Nduja per ogni tipo di pianta (le soglie di Plant Monitor hanno la precedenza): cambiale per ogni pianta con ✏️. Le foto restano in Home Assistant.", "Sensor thresholds are indicative, written for 'Nduja for each kind of plant (Plant Monitor's thresholds come first): change them for each plant with ✏️. Photos stay in Home Assistant.")}</p></section>`;
}
function pagina() {
  if (casaErrore(SEZ) === "riavvia") return `<div class="g g3">${card0(t("Per usare le Piante riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha cambiato anche la parte che salva i dati.", "To use Plants restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update also changed the part that stores the data."))}</div>`;
  const P = piante(); setTimeout(allinea, 0); controllaAutomazione();
  if (!P.length) return `<div class="g g3 pi1p">${vuota()}${tolte().length ? piede() : ""}</div>`;
  return `<div class="g g3 pi1p">${hero(P)}${gruppi(P)}${piede()}</div>`;
}
const card0 = txt => `<section class="card span3"><div class="ch"><h2>🪴 ${t("Piante", "Plants")}</h2></div><div class="note1">${txt}</div></section>`;

/* nome e «fuori» delle piante salvate per l'automazione del telefono: se cambiano (stanza spostata, nome cambiato in Home Assistant) li aggiorno */
let allineato = 0;
function allinea() {
  if (Date.now() - allineato < 6e4 || sezione()?.stato !== "ok") return;
  const R = recs(), diversi = piante().filter(p => R[p.id] && (R[p.id].nt !== p.nome || R[p.id].fz !== p.fuori));
  allineato = Date.now();
  if (diversi.length) casaCambia(SEZ, d => { let n = 0; for (const p of diversi) { const r = d.piante?.[p.id]; if (r && (r.nt !== p.nome || r.fz !== p.fuori)) { r.nt = p.nome; r.fz = p.fuori; n++; } } return n ? undefined : false; });
}

/* ================= avvisi della Home ================= */
const avvisiOn = () => C().avvisi !== false;
const seteOn = () => C().sete !== false;
VISTE.pianteAvvisi = () => {
  if (!pagAttiva() || !avvisiOn()) return [];
  const A = [], g = isoG(Date.now());
  for (const { p, c, s } of oggi()) A.push({ k: "pi:" + c + ":" + p.id + ":" + g, ic: c === "acqua" ? "🪴" : "🌱", b: esc(p.nome) + " · " + (c === "acqua" ? t("da annaffiare", "needs water") : t("da concimare", "needs feeding")),
    s: esc(s.m < 0 ? t("in ritardo di ", "overdue by ") + giorni(-s.m) : t("oggi", "today")), go: "piante", cls: s.m < 0 ? "alert" : "" });
  if (seteOn()) for (const p of piante()) if (haSete(p) && !daFare(p, "acqua")) { const m = letture(p).find(x => x.k === "umidita");
    A.push({ k: "pi:sete:" + p.id + ":" + g, ic: "💧", b: esc(p.nome) + " " + t("ha sete", "is thirsty"), s: t("umidità del terreno ", "soil moisture ") + esc(valTxt(m)), go: "piante", cls: "alert" }); }
  return A;
};

/* ================= ✏️ una pianta (anche nuova): chiunque in casa ================= */
let E = null;
const ZONE = () => { try { return zoneIrr().filter(id => S[id] && /^(switch|valve|input_boolean)\./.test(id)); } catch { return []; } };
function apri(id) {
  const p = id ? trova(id) || tolte().find(x => x.id === id) : null;
  if (id && !p) return;
  const r = p?.rec || {};
  E = { id: p?.id || null, man: p ? p.man : true, nome: p?.nome || "", nomeAuto: p?.nomeAuto || "", area: p ? ("area" in r ? (r.area || "") : "__auto") : "", areaAuto: p?.areaAuto || null,
    fuori: typeof r.fuori === "boolean" ? (r.fuori ? "fuori" : "dentro") : "auto", tipo: p?.tipo || "verde", tipoMan: !!(r.tipo || p), foto: p?.foto || "",
    acqua: p ? ogniDi(p, "acqua") : DEF.verde.acqua, concime: p ? ogniDi(p, "concime") : DEF.verde.concime, ogniMan: !!p, zona: r.zona || "",
    sens: { ...(r.sens || {}) }, sensAuto: p ? (trovate().find(a => a.id === p.id)?.sens || {}) : {}, soglie: JSON.parse(JSON.stringify(r.soglie || {})), vista: "form", url: "" };
  openSheet(foglio);
}
/* legge i campi scritti prima di ridisegnare il foglio */
function leggiCampi() {
  if (!E) return;
  const v = id => document.getElementById(id);
  if (v("pi1nn")) E.nome = v("pi1nn").value;
  if (v("pi1ar")) E.area = v("pi1ar").value;
  for (const c of ["acqua", "concime"]) if (v("pi1o-" + c)) E[c] = lim(Math.round(+v("pi1o-" + c).value) || 0, 0, c === "acqua" ? 60 : 52);
  if (v("pi1zn")) E.zona = v("pi1zn").value;
  for (const k of MIS) for (const i of [0, 1]) { const x = v(`pi1g-${k}-${i}`); if (x) { E.soglie[k] = E.soglie[k] || ["", ""]; E.soglie[k][i] = x.value.trim() === "" ? "" : +x.value; } }
  if (v("pi1url")) E.url = v("pi1url").value;
}
/** com'è adesso la pianta del foglio (per disegni, soglie e sensori) */
function bozza() {
  const a = E.id ? trovate().find(x => x.id === E.id) : null;
  const r = { nome: E.nome, tipo: E.tipo, foto: E.foto, sens: E.sens, soglie: E.soglie, ...(E.area !== "__auto" ? { area: E.area } : {}), ...(E.fuori !== "auto" ? { fuori: E.fuori === "fuori" } : {}) };
  return vista(a || { id: E.id || "nuova", man: true, sens: {}, nome: E.nome, area: null }, r);
}
function foglio() {
  if (!E) return "";
  if (E.vista === "media") return foglioMedia();
  if (E.vista === "foto") return foglioFoto();
  const p = bozza(), Z = ZONE(), N = MIS_N(), L = letture(p);
  const areaOpt = `${!E.man ? `<option value="__auto" ${E.area === "__auto" ? "selected" : ""}>${t("Come in Home Assistant", "As in Home Assistant")}${E.areaAuto && AREAS[E.areaAuto] ? ` (${esc(AREAS[E.areaAuto].name)})` : ""}</option>` : ""}
    <option value="" ${E.area === "" ? "selected" : ""}>${t("Nessuna stanza", "No room")}</option>${areasSorted(true).map(a => `<option value="${a}" ${E.area === a ? "selected" : ""}>${esc(AREAS[a].name)}</option>`).join("")}`;
  const stp = c => `<div class="pi1st"><button class="step" data-act="piStep" data-c="${c}" data-d="-1" aria-label="−">−</button>
      <label><input id="pi1o-${c}" type="number" inputmode="numeric" min="0" max="${c === "acqua" ? 60 : 52}" value="${E[c]}" data-chg="piOgni" data-c="${c}"><span>${c === "acqua" ? t("giorni", "days") : t("settimane", "weeks")}</span></label>
      <button class="step" data-act="piStep" data-c="${c}" data-d="1" aria-label="+">+</button><em>${E[c] ? esc(ogniTesto(c, E[c])) : t("nessun promemoria", "no reminder")}</em></div>`;
  const sensRiga = k => {
    const id = p.sens[k], m = L.find(x => x.k === k), [dmn, dmx] = (() => { const x = { ...p, rec: { ...p.rec, soglie: {} } }; return soglie(x, k); })(), mie = E.soglie[k] || ["", ""];
    const inp = (i, ph) => `<input id="pi1g-${k}-${i}" type="number" inputmode="decimal" step="any" value="${mie[i] === "" || mie[i] == null ? "" : esc(mie[i])}" placeholder="${ph == null ? "—" : esc(String(Math.round(ph * 10) / 10))}" aria-label="${esc(N[k][1])} ${i ? "max" : "min"}">`;
    return `<div class="pi1sz"><div class="hd"><b>${N[k][0]} ${esc(N[k][1])}</b><span>${m ? esc(valTxt(m)) : ""}</span><button class="lnk" data-act="piSens" data-k="${k}">${t("Cambia", "Change")}</button><button class="x" data-act="piSensNo" data-k="${k}" aria-label="${t("Togli", "Remove")}">✕</button></div>
      <small>${esc(id ? nmHA(id) : "")}</small>
      ${k === "batt" ? `<small>${t("Scarica sotto il ", "Low below ")}${battMin()}% (⚙️)</small>` : `<div class="pi1sr"><label><span>${t("Min", "Min")}</span>${inp(0, dmn)}</label><label><span>${t("Max", "Max")}</span>${inp(1, dmx)}</label>${(mie[0] !== "" && mie[0] != null) || (mie[1] !== "" && mie[1] != null) ? `<button class="btn sm" data-act="piSgReset" data-k="${k}">↺</button>` : ""}</div>`}</div>`;
  };
  const presenti = MIS.filter(k => p.sens[k]);
  return `<div class="sh-head"><div><h3>${E.id ? "✏️ " + esc(E.nome || E.nomeAuto) : "🪴 " + t("Nuova pianta", "New plant")}</h3>${E.id && p.ent ? `<div class="small muted mono">${esc(p.ent)}</div>` : ""}</div><button class="x" data-act="sheetClose">×</button></div>
    <div class="pi1ef"><button class="pi1fb" data-act="piFoto" aria-label="${t("Foto", "Photo")}">${figura(p, "big")}<span>📷 ${p.foto ? t("Cambia foto", "Change photo") : t("Aggiungi una foto", "Add a photo")}</span></button>
      <div class="pi1ec"><label class="fld1"><span>${t("Nome", "Name")}</span><input id="pi1nn" type="text" maxlength="40" value="${esc(E.nome)}" placeholder="${esc(E.nomeAuto || t("es. Basilico", "e.g. Basil"))}" autocomplete="off"></label>
        <label class="fld1"><span>${t("Stanza", "Room")}</span><select id="pi1ar" data-chg="piArea">${areaOpt}</select></label>
        <div class="fl1">${t("Dove sta", "Where it is")}</div><div class="seg pi1sg">${[["auto", "✨ " + t("Da solo", "Auto") + ` (${fuoriAuto(E.area === "__auto" ? E.areaAuto : E.area, E.nome) ? t("fuori", "outside") : t("dentro", "inside")})`], ["dentro", "🏠 " + t("Dentro", "Inside")], ["fuori", "🌳 " + t("Fuori", "Outside")]]
          .map(([k, n]) => `<button class="${E.fuori === k ? "act" : ""}" data-act="piDove" data-v="${k}" aria-pressed="${E.fuori === k}">${n}</button>`).join("")}</div></div></div>
    <div class="fl1">${t("Che pianta è", "What kind of plant")}</div>
    <div class="pi1tp">${TIPI().map(([k, n]) => `<button class="${E.tipo === k ? "on" : ""}" data-act="piTipo" data-v="${k}" aria-pressed="${E.tipo === k}">${disegno(k)}<span>${esc(n)}</span></button>`).join("")}</div>
    <div class="fl1">💧 ${t("Annaffia ogni", "Water every")}</div>${stp("acqua")}
    <div class="fl1">🌱 ${t("Concima ogni", "Feed every")}</div>${stp("concime")}
    <p class="small muted" style="margin:6px 2px 0">${t("0 = nessun promemoria. Con un sensore di umidità del terreno l'acqua te la dice il sensore.", "0 = no reminder. With a soil moisture sensor the sensor tells you when to water.")}</p>
    ${Z.length ? `<div class="fl1">🚿 ${t("Zona dell'irrigazione", "Irrigation zone")}</div><label class="fld1"><select id="pi1zn" data-chg="piZona"><option value="">${t("Nessuna: la annaffio a mano", "None: I water it by hand")}</option>${Z.map(z => `<option value="${z}" ${E.zona === z ? "selected" : ""}>${esc(nmZona(z))}</option>`).join("")}</select></label>
      <p class="small muted" style="margin:6px 2px 0">${t("Quando la zona parte, la pianta si segna annaffiata da sola.", "When the zone starts, the plant is marked as watered by itself.")}</p>` : ""}
    <div class="fl1">📈 ${t("Sensori e soglie", "Sensors and thresholds")}</div>
    <div class="stack">${presenti.map(sensRiga).join("")}
      <button class="add1" data-act="piSens" data-k=""><span>＋</span>${t("Aggiungi un sensore (terreno, luce, temperatura, fertilità, pila)", "Add a sensor (soil, light, temperature, fertility, battery)")}</button></div>
    ${presenti.length ? `<p class="small muted" style="margin:6px 2px 0">${t("Lascia vuoto per i valori indicativi del tipo di pianta (in grigio).", "Leave empty for the kind of plant's indicative values (in grey).")}</p>` : ""}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="piSalva">💾 ${t("Salva", "Save")}</button>
      ${E.id ? (E.man ? `<button class="btn bad" data-act="piDel">🗑 ${t("Elimina la pianta", "Delete the plant")}</button>` : `<button class="btn bad" data-act="piTogli">✕ ${t("Non è una pianta", "Not a plant")}</button>`) : ""}</div>
    <p class="small muted" style="margin-top:12px">${t("Le piante valgono per tutta la casa: chiunque le vede e le può cambiare. Il nome e la stanza cambiano solo nella plancia.", "Plants are for the whole home: anyone sees them and can change them. Name and room change only in the dashboard.")}</p>`;
}
/* foto: scatta o carica (nei Media di Home Assistant), dai Media, indirizzo /local/ */
function foglioFoto() {
  const p = bozza();
  return `<div class="sh-head"><div><h3>📷 ${esc(E.nome || E.nomeAuto || t("Foto", "Photo"))}</h3><div class="small muted">${t("La foto resta in Home Assistant: niente immagini da internet.", "The photo stays in Home Assistant: no pictures from the internet.")}</div></div><button class="x" data-act="piIndietro">‹</button></div>
    <div class="pi1fp">${figura(p, "big")}</div>
    <div class="stack" style="margin-top:12px">
      <label class="pi1up ${E.carico ? "dis" : ""}"><input type="file" accept="image/*" data-chg="piFile" ${E.carico ? "disabled" : ""}><span class="ic">📷</span><span class="tx"><b>${E.carico ? t("Carico la foto…", "Uploading the photo…") : t("Scatta o carica una foto", "Take or upload a photo")}</b><span>${t("Finisce nei Media di Home Assistant (Image Upload)", "It goes to Home Assistant's Media (Image Upload)")}</span></span></label>
      <button class="li pi1ub" data-act="piMedia"><span class="ic">🖼️</span><span class="tx"><b>${t("Scegli dai Media", "Choose from Media")}</b><span>${t("Una foto che è già in Home Assistant", "A photo already in Home Assistant")}</span></span><span class="st">›</span></button>
      <div class="li"><span class="ic">🔗</span><div class="tx"><b>${t("Indirizzo di un'immagine", "Image address")}</b><span>${t("Una tua immagine in config/www: /local/nome.jpg", "Your own image in config/www: /local/name.jpg")}</span>
        <div class="row" style="gap:6px;margin-top:8px"><input id="pi1url" class="pi1in" type="text" placeholder="/local/piante/basilico.jpg" value="${esc(E.url || (/^\/(local|api\/image)\//.test(E.foto) ? E.foto : ""))}" autocomplete="off"><button class="btn sm" data-act="piUrl">${t("Usa", "Use")}</button></div></div></div>
      ${E.foto ? `<button class="btn bad" data-act="piFotoNo" style="align-self:flex-start">✕ ${t("Togli la foto (torna il disegno)", "Remove the photo (back to the drawing)")}</button>` : ""}</div>`;
}
/* ---------- Media di Home Assistant ---------- */
const MB = { id: "", el: null, err: "", su: [] };
async function mbApri(id) {
  MB.id = id; MB.el = null; MB.err = ""; render();
  try { MB.el = await ws({ type: "media_source/browse_media", ...(id ? { media_content_id: id } : {}) }); } catch (e) { MB.err = e?.message || e?.code || "?"; }
  render();
}
const immagine = c => c.media_class === "image" || /^image\//.test(c.media_content_type || "");
function foglioMedia() {
  const el = MB.el, ch = (el?.children || []).filter(c => c.can_expand ? !/^media-source:\/\/(tts|radio_browser)\b/.test(c.media_content_id || "") : immagine(c));
  return `<div class="sh-head"><div><h3>🖼️ ${esc(el?.title || t("Media", "Media"))}</h3><div class="small muted">${t("Tocca una foto per sceglierla.", "Tap a photo to choose it.")}</div></div><button class="x" data-act="piMbSu">‹</button></div>
    ${MB.err ? `<div class="note1">${esc(MB.err)}</div>` : !el ? `<div class="small muted">${t("Carico…", "Loading…")}</div>`
      : ch.length ? `<div class="pi1mb">${ch.map(c => c.can_expand ? `<button data-act="piMbDir" data-id="${esc(c.media_content_id)}"><span class="th">📁</span><b>${esc(c.title)}</b></button>`
        : `<button data-act="piMbPick" data-id="${esc(c.media_content_id)}"><span class="th">${c.thumbnail ? `<img src="${esc(c.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : "🖼️"}</span><b>${esc(c.title)}</b></button>`).join("")}</div>`
      : `<div class="empty">${t("Nessuna foto qui.", "No photos here.")}</div>`}`;
}
/** riduce la foto (al massimo 1280 px, JPEG) prima di caricarla */
async function riduci(file) {
  try {
    const bmp = await createImageBitmap(file), s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", .86)); if (b) return b;
  } catch { /* formato che il browser non sa disegnare: provo a mandarlo com'è */ }
  return /^image\/(jpeg|png|gif)$/.test(file.type) ? file : null;
}
/** carica la foto in Home Assistant (Image Upload, la stessa delle foto delle persone): qualsiasi utente; restituisce l'indirizzo */
async function carica(file) {
  const b = await riduci(file); if (!b) throw new Error(t("formato non supportato: usa JPEG o PNG", "unsupported format: use JPEG or PNG"));
  const fd = new FormData(); fd.append("file", b, "pianta." + ((b.type || "").split("/")[1] || "jpg").replace("jpeg", "jpg"));
  const res = await fetch("/api/image/upload", { method: "POST", headers: { Authorization: "Bearer " + await tokenHA() }, body: fd });
  if (!res.ok) throw new Error(res.status + " " + (await res.text().catch(() => "")).slice(0, 80));
  const j = await res.json(); if (!j?.id) throw new Error("?");
  return `/api/image/serve/${j.id}/512x512`;
}

async function salva() {
  leggiCampi();
  const nome = E.nome.trim() || E.nomeAuto; if (!nome) { toast(t("Scrivi il nome della pianta", "Write the plant's name"), true); return; }
  if (!E.id && Object.keys(recs()).length >= MAX) { toast(t("Troppe piante", "Too many plants"), true); return; }
  const id = E.id || nuovoId(), e = JSON.parse(JSON.stringify(E)), auto = e.sensAuto || {};
  closeSheet(); E = null;
  await scrivi(id, r => {
    if (e.man) r.man = true;
    if (e.man || nome !== e.nomeAuto) r.nome = nome; else delete r.nome;
    if (e.area === "__auto") delete r.area; else r.area = e.area;
    if (e.fuori === "auto") delete r.fuori; else r.fuori = e.fuori === "fuori";
    if (e.man || e.tipoMan) r.tipo = e.tipo; else delete r.tipo;
    if (e.foto) r.foto = e.foto; else delete r.foto;
    for (const c of ["acqua", "concime"]) r[c] = { ...(r[c] || {}), ogni: e[c] };
    if (e.zona && S[e.zona]) r.zona = e.zona; else delete r.zona;
    const sens = {}; for (const [k, v] of Object.entries(e.sens || {})) if (v && v !== auto[k] && (v === "none" ? auto[k] : true)) sens[k] = v;
    if (Object.keys(sens).length) r.sens = sens; else delete r.sens;
    const sg = {}; for (const [k, v] of Object.entries(e.soglie || {})) if (Array.isArray(v) && v.some(x => x !== "" && x != null && Number.isFinite(+x))) sg[k] = v.map(x => x === "" || x == null || !Number.isFinite(+x) ? "" : +x);
    if (Object.keys(sg).length) r.soglie = sg; else delete r.soglie;
  }, "💾 " + nome);
}

/* ================= ⚙️ impostazioni (amministratori) ================= */
function impostazioni() {
  const c = C();
  return `<div class="sh-head"><div><h3>⚙️ ${t("Piante", "Plants")}</h3><div class="small muted">${t("Valgono per tutta la casa. Si salvano appena esci da un campo.", "They apply to the whole home. Saved when you leave a field.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">🔔 ${t("Avvisi della Home", "Home alerts")}</div>
    <div class="li"><div class="tx"><b>${t("Piante da annaffiare o da concimare", "Plants to water or feed")}</b><span>${t("Il giorno del promemoria e finché non è fatto.", "On the reminder's day and until it's done.")}</span></div><button class="sw ${avvisiOn() ? "on" : ""}" data-act="piCfgSw" data-f="avvisi" aria-pressed="${avvisiOn()}" aria-label="${t("Avvisi", "Alerts")}"><i></i></button></div>
    <div class="li"><div class="tx"><b>${t("Piante che hanno sete", "Thirsty plants")}</b><span>${t("Quando il sensore del terreno scende sotto la soglia.", "When the soil sensor drops below the threshold.")}</span></div><button class="sw ${seteOn() ? "on" : ""}" data-act="piCfgSw" data-f="sete" aria-pressed="${seteOn()}" aria-label="${t("Sete", "Thirst")}"><i></i></button></div>
    <div class="fl1">🌧️ ${t("Pioggia di domani", "Tomorrow's rain")}</div>
    <p class="small muted" style="margin:0 2px 8px">${t("Se domani piove, il promemoria per annaffiare le piante di fuori slitta a dopodomani. Conta come pioggia quando il meteo prevede pioggia, oppure:", "If it rains tomorrow, the watering reminder for outdoor plants moves to the day after. It counts as rain when the forecast says rain, or:")}</p>
    <label class="fld1"><span>${t("Probabilità di pioggia almeno", "Chance of rain at least")}</span><span class="ar1in"><input type="number" min="10" max="100" step="5" value="${prMin()}" data-chg="piCfgN" data-f="pr"><em>%</em></span></label>
    <label class="fld1"><span>${t("Oppure pioggia prevista almeno (0 = non contare)", "Or expected rain at least (0 = don't count)")}</span><span class="ar1in"><input type="number" min="0" max="100" step="0.5" value="${mmMin()}" data-chg="piCfgN" data-f="mm"><em>mm</em></span></label>
    <div class="fl1">🔋 ${t("Sensori", "Sensors")}</div>
    <label class="fld1"><span>${t("Pila del sensore scarica sotto il", "Sensor battery low below")}</span><span class="ar1in"><input type="number" min="1" max="60" step="1" value="${battMin()}" data-chg="piCfgN" data-f="batt"><em>%</em></span></label>
    <p class="small muted" style="margin-top:12px">${t("Le soglie di umidità, luce, temperatura e fertilità si scelgono per ogni pianta con ✏️.", "Moisture, light, temperature and fertility thresholds are set for each plant with ✏️.")}</p>`;
}

/* ================= 🔔 promemoria sul telefono: automazione «'Nduja · piante» ================= */
/** il servizio di 'Nduja che legge i dati della casa (serve il riavvio dopo l'aggiornamento): true, false o null (non so ancora) */
function serviziHA() { const s = cached("services", 3600e3, () => ws({ type: "get_services" })); return s ? !!s.nduja_dashboard?.leggi_casa : null; }
let NB = null;
function foglioProm() {
  if (NB.auto && serviziNotify().length) { NB.auto = false; NB.persone = allEnts("person").filter(x => telefoniDi(x).length); }
  const P = allEnts("person"), suoi = new Set(P.flatMap(telefoniDi)), altri = serviziNotify().filter(s => !suoi.has(s)), sv = serviziHA();
  const ck = (on, act, k, tx, sotto, dis) => `<button class="ck1 ${on ? "on" : ""}" data-act="${act}" data-k="${esc(k)}" ${dis ? "disabled" : ""} aria-pressed="${!!on}"><span class="bx"></span><span class="tx"><b>${tx}</b>${sotto ? `<span>${sotto}</span>` : ""}</span></button>`;
  return `<div class="sh-head"><div><h3>🔔 ${t("Promemoria delle piante", "Plant reminders")}</h3><div class="small muted">${t("Creo in Home Assistant l'automazione «'Nduja · piante»: una notifica al giorno con le piante da annaffiare e da concimare, anche a plancia chiusa.", "I create the «'Nduja · plants» automation in Home Assistant: one notification a day with the plants to water and feed, even with the dashboard closed.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${sv === false ? `<div class="note1">${t("Prima riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha aggiunto il servizio che l'automazione usa per leggere le piante.", "First restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update added the service the automation uses to read the plants.")}</div>` : ""}
    <div class="fl1">${t("A chi", "To")}</div><div class="cks1">${P.map(p => { const T = telefoniDi(p); return ck(NB.persone.includes(p) && T.length, "pinP", p, esc(nmHA(p)), T.length ? "📱 " + esc(T.map(nomeServizio).join(", ")) : t("nessun telefono con l'app di Home Assistant", "no phone with the Home Assistant app"), !T.length); }).join("")}
      ${altri.map(s => ck(NB.altri.includes(s), "pinA", s, "📱 " + esc(nomeServizio(s)), t("telefono senza persona", "phone without a person"))).join("")}</div>
    <div class="fl1">${t("A che ora", "At what time")}</div><input class="fkn1 dt" type="time" value="${esc(NB.ora)}" data-chg="pinO" aria-label="${t("Ora del promemoria", "Reminder time")}">
    <p class="small muted" style="margin:10px 2px 0">${t("Solo per le piante con «Annaffia ogni» o «Concima ogni». Se domani piove, le piante di fuori aspettano. Toccando la notifica si apre questa pagina.", "Only for plants with «Water every» or «Feed every». If it rains tomorrow, outdoor plants wait. Tapping the notification opens this page.")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="pinSalva" ${sv === false ? "disabled" : ""}>💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${C().promemoria ? `<button class="btn bad" data-act="pinOff">${t("Spegni i promemoria", "Turn off reminders")}</button>` : ""}</div>`;
}
const serviziDi = p => [...new Set([...(p.persone || []).filter(x => S[x]).flatMap(telefoniDi), ...(p.altri || []).filter(s => serviziNotify().includes(s))])];
/** l'automazione: ogni giorno all'ora scelta legge le piante (nduja_dashboard.leggi_casa) e il meteo di domani e manda una notifica.
    Le date si calcolano come nella plancia: ultima volta + ogni N giorni (settimane per il concime), mai fatta = oggi; fuori + pioggia domani = dopodomani. */
function automazione(p) {
  const sv = serviziDi(p), w = weatherEnt() || "", [hh, mm] = String(p.ora || "09:00").split(":");
  const lista = String.raw`{%- set ns = namespace(a=[], c=[], piove=false) -%}{%- set oggi = now().date() -%}
{%- set fc = (f.get(meteo, {}).get('forecast', []) if f is defined and f is mapping else []) -%}
{%- for x in fc -%}{%- if x.get('datetime') and (as_local(as_datetime(x.datetime)).date() - oggi).days == 1
  and (x.get('condition') in pioggia or (x.get('precipitation_probability') or 0) >= pr or (mm > 0 and (x.get('precipitation') or 0) >= mm)) -%}{%- set ns.piove = true -%}{%- endif -%}{%- endfor -%}
{%- set P = c.get('dati', {}).get('piante', {}) if c is mapping else {} -%}
{%- for id, p in (P.items() if P is mapping else []) if p is mapping and not p.get('tolta') and (p.get('man') or id in trovate) -%}
{%- for cosa in ['acqua', 'concime'] -%}{%- set r = p.get(cosa) if p.get(cosa) is mapping else {} -%}{%- set o = (r.get('ogni') or 0) | int(0) -%}
{%- if o > 0 and not (cosa == 'acqua' and p.get('zona') and is_state(p.get('zona'), ['on', 'open', 'opening'])) -%}
{%- set u = r.get('ultima') -%}{%- set g = ((as_local(as_datetime(u)).date() + timedelta(days=o * (1 if cosa == 'acqua' else 7))) if u and as_datetime(u) else oggi) -%}
{%- if cosa == 'acqua' and p.get('fz') and ns.piove and (g - oggi).days <= 1 -%}{%- set g = oggi + timedelta(days=2) -%}{%- endif -%}
{%- if g <= oggi -%}{%- if cosa == 'acqua' -%}{%- set ns.a = ns.a + [p.get('nt') or p.get('nome') or id] -%}{%- else -%}{%- set ns.c = ns.c + [p.get('nt') or p.get('nome') or id] -%}{%- endif -%}{%- endif -%}
{%- endif -%}{%- endfor -%}{%- endfor -%}
{{ ((['💧 ` + t("Annaffia", "Water") + String.raw`: ' ~ (ns.a | join(', '))] if ns.a else []) + (['🌱 ` + t("Concima", "Feed") + String.raw`: ' ~ (ns.c | join(', '))] if ns.c else [])) | join('\n') }}`;
  const avviso = sv.map(s => ({ action: "notify." + s, data: { title: "🪴 " + t("Piante", "Plants"), message: "{{ testo }}",
    data: { tag: "nduja-piante", group: "nduja-piante", channel: t("Piante 'Nduja", "'Nduja plants"), url: "/nduja?apri=piante", clickAction: "/nduja?apri=piante" } } }));
  return { id: AUT, alias: "'Nduja · " + t("piante", "plants"), description: t("Creata da 'Nduja Dashboard (Piante → 🔔): ogni giorno le piante da annaffiare e da concimare sul telefono. Si aggiorna da sola dalla plancia.", "Created by 'Nduja Dashboard (Plants → 🔔): every day the plants to water and feed on the phone. The dashboard keeps it up to date."),
    variables: { meteo: w, pr: prMin(), mm: mmMin(), pioggia: PIOGGIA, trovate: trovate().map(a => a.id) },
    triggers: [{ trigger: "time", at: `${String(+hh || 0).padStart(2, "0")}:${String(+mm || 0).padStart(2, "0")}:00` }],
    conditions: [],
    actions: [
      { action: "nduja_dashboard.leggi_casa", data: { sezione: SEZ }, response_variable: "c" },
      ...(w ? [{ action: "weather.get_forecasts", target: { entity_id: w }, data: { type: "daily" }, response_variable: "f", continue_on_error: true }] : []),
      { variables: { testo: lista } },
      { condition: "template", value_template: "{{ testo | trim | length > 0 }}" },
      ...avviso],
    mode: "single" };
}
/** riscrive l'automazione se i promemoria sono attivi (meteo di casa, soglie della pioggia o piante trovate cambiati) */
async function aggiornaAutomazione(p = C().promemoria) {
  if (!p || !isAdmin() || !serviziDi(p).length) return false;
  await api("POST", "/api/config/automation/config/" + AUT, automazione(p));
  const firma = firmaAut();
  if (p.firma !== firma) await piCambia(c => { if (c.promemoria) c.promemoria.firma = firma; });
  return true;
}
const firmaAut = () => [weatherEnt() || "", prMin(), mmMin(), trovate().map(a => a.id).sort().join(",")].join("|");
let controllato = 0;
function controllaAutomazione() {
  const p = C().promemoria; if (!p || !isAdmin() || Date.now() - controllato < 6e4 || !serviziNotify().length) return;
  controllato = Date.now();
  if (p.firma !== firmaAut()) aggiornaAutomazione(p).catch(e => console.warn("nduja piante", e));
}

/* ================= azioni ================= */
Object.assign(ACT, {
  piFatto: (el, e) => { e?.stopPropagation?.(); fatto(el.dataset.id, el.dataset.c); },
  piAnnulla: (el, e) => { e?.stopPropagation?.(); annulla(el.dataset.id, el.dataset.c); },
  piNuova: () => { if (Object.keys(recs()).length >= MAX) return toast(t("Troppe piante", "Too many plants"), true); apri(null); setTimeout(() => document.getElementById("pi1nn")?.focus(), 120); },
  piEd: el => apri(el.dataset.id),
  piTipo: el => { leggiCampi(); E.tipo = el.dataset.v; E.tipoMan = true; if (!E.ogniMan) { E.acqua = DEF[E.tipo].acqua; E.concime = DEF[E.tipo].concime; } render(); },
  piDove: el => { leggiCampi(); E.fuori = el.dataset.v; render(); },
  piStep: el => { leggiCampi(); const c = el.dataset.c; E[c] = lim((E[c] || 0) + +el.dataset.d, 0, c === "acqua" ? 60 : 52); E.ogniMan = true; render(); },
  piSalva: () => salva(),
  piDel: async el => {
    if (!E?.id) return; if (!sicuro(el, t("Tocca ancora per eliminare", "Tap again to delete"))) return;
    const id = E.id, n = E.nome; closeSheet(); E = null;
    await scrivi(id, (r, tutte) => { delete tutte[id]; }, "🗑 " + n);
  },
  piTogli: () => { if (!E?.id) return; const id = E.id, n = E.nome || E.nomeAuto; closeSheet(); E = null; scrivi(id, r => { r.tolta = true; }, "✕ " + n); },
  piRimetti: el => { const id = el.dataset.id; scrivi(id, r => { delete r.tolta; }, "↺ " + (trova(id)?.nome || tolte().find(x => x.id === id)?.nome || "")); },
  piSens: el => {
    leggiCampi(); const k = el.dataset.k, p = bozza();
    scegli({ titolo: k ? MIS_N()[k][0] + " " + MIS_N()[k][1] : "＋ " + t("Sensore della pianta", "Plant sensor"), sotto: t("Sensori di umidità del terreno, luce, temperatura, fertilità e pila.", "Soil moisture, light, temperature, fertility and battery sensors."),
      auto: false, attuale: k ? p.sens[k] : null, area: p.area,
      filtro: id => { const m = misura(id); return !!m && (!k || m === k); },
      onPick: id => { if (id && E) { const m = k || misura(id); if (m) E.sens[m] = id; } openSheet(foglio); } });
  },
  piSensNo: el => { leggiCampi(); const k = el.dataset.k; if (E.sensAuto[k]) E.sens[k] = "none"; else delete E.sens[k]; delete E.soglie[k]; render(); },
  piSgReset: el => { leggiCampi(); delete E.soglie[el.dataset.k]; render(); },
  piFoto: () => { leggiCampi(); E.vista = "foto"; render(); },
  piIndietro: () => { leggiCampi(); E.vista = "form"; render(); },
  piMedia: () => { leggiCampi(); E.vista = "media"; MB.su = []; mbApri(""); },
  piMbDir: el => { MB.su.push(MB.id); mbApri(el.dataset.id); },
  piMbSu: () => { if (MB.su.length) mbApri(MB.su.pop()); else { E.vista = "foto"; render(); } },
  piMbPick: el => { E.foto = el.dataset.id; E.vista = "form"; render(); },
  piUrl: () => { leggiCampi(); const u = indirizzoLocale(E.url); if (!u) return toast(t("Scrivi l'indirizzo", "Write the address"), true); E.foto = u; E.vista = "form"; render(); },
  piFotoNo: () => { E.foto = ""; E.url = ""; E.vista = "form"; render(); },
  piCfg: () => openSheet(impostazioni),
  piCfgSw: el => { const f = el.dataset.f, on = f === "avvisi" ? avvisiOn() : seteOn(); piCambia(c => { c[f] = !on; }); },
  piProm: () => { const p = C().promemoria; NB = { persone: [], altri: [], ora: "08:30", ...JSON.parse(JSON.stringify(p || {})) }; NB.auto = !p; openSheet(foglioProm); },
  pinP: el => { const k = el.dataset.k, i = NB.persone.indexOf(k); i < 0 ? NB.persone.push(k) : NB.persone.splice(i, 1); render(); },
  pinA: el => { const k = el.dataset.k, i = NB.altri.indexOf(k); i < 0 ? NB.altri.push(k) : NB.altri.splice(i, 1); render(); },
  pinSalva: async () => {
    if (!NB) return;
    if (serviziHA() === false) return toast(t("Riavvia Home Assistant", "Restart Home Assistant"), true);
    NB.persone = NB.persone.filter(p => telefoniDi(p).length);
    if (!serviziDi(NB).length) return toast(t("Scegli almeno una persona con il telefono", "Choose at least one person with a phone"), true);
    const nuova = !C().promemoria, p = { persone: NB.persone, altri: NB.altri, ora: NB.ora || "08:30" };
    try {
      await api("POST", "/api/config/automation/config/" + AUT, automazione(p));
      if (nuova) etichettaNduja(() => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === AUT));   // nuova: etichetta «'Nduja»
      await piCambia(c => { c.promemoria = { ...p, firma: firmaAut() }; });
      closeSheet(); toast("🔔 " + t("Promemoria delle piante attivi", "Plant reminders on"));
    } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  pinOff: async () => {
    try { await api("DELETE", "/api/config/automation/config/" + AUT); } catch {}
    await piCambia(c => { delete c.promemoria; }); closeSheet(); toast(t("Promemoria spenti", "Reminders off"));
  },
});
CHG.piOgni = el => { if (!E) return; leggiCampi(); E.ogniMan = true; render(); };
CHG.piArea = () => { leggiCampi(); render(); };
CHG.piZona = () => { leggiCampi(); };
CHG.pinO = el => { if (NB && el.value) NB.ora = el.value; };
CHG.piCfgN = el => {
  const f = el.dataset.f, v = +el.value; if (!Number.isFinite(v)) return;
  piCambia(c => { if (f === "batt") c.batt = lim(Math.round(v), 1, 60); else { c.pioggia = { ...(c.pioggia || {}), [f]: f === "pr" ? lim(Math.round(v), 10, 100) : lim(v, 0, 100) }; } })
    .then(() => { if (f !== "batt" && C().promemoria) aggiornaAutomazione().catch(e => toast(t("Promemoria non aggiornati: ", "Reminders not updated: ") + (e.message || e), true)); });
};
CHG.piFile = async el => {
  const f = el.files?.[0]; if (!f || !E) return;
  leggiCampi(); E.carico = true; render();
  try { E.foto = await carica(f); E.vista = "form"; toast("📷 " + t("Foto caricata", "Photo uploaded")); }
  catch (e) { toast(t("Foto non caricata: ", "Photo not uploaded: ") + (e.message || e), true); }
  finally { if (E) E.carico = false; render(); }
};
/* mentre scrivi il nome della pianta nuova indovino il tipo (finché non lo scegli tu) */
document.addEventListener("input", e => {
  if (e.target.id !== "pi1nn" || !E) return;
  E.nome = e.target.value;
  if (!E.tipoMan) { const k = indovina(E.nome); if (k !== E.tipo) { E.tipo = k; if (!E.ogniMan) { E.acqua = DEF[k].acqua; E.concime = DEF[k].concime; } render(); } }
});

/* la notifica sul telefono apre /nduja?apri=piante: porto qui e tolgo il segno dall'indirizzo */
function apriDaLink() {
  let w = window; try { if (window.parent !== window && parent.location.href) w = parent; } catch {}
  let q = null; try { q = new URLSearchParams(w.location.search).get("apri"); } catch { return; }
  if (q !== "piante") return;
  try { const u = new URL(w.location.href); u.searchParams.delete("apri"); w.history.replaceState(w.history.state, "", u.pathname + u.search + u.hash); } catch {}
  const prova = (i = 0) => { if (!UI.page || !Object.keys(S).length || !PAGES.piante?.show()) { if (i < 60) setTimeout(() => prova(i + 1), 300); return; } go("piante"); };
  prova();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") apriDaLink(); });
ready.then(apriDaLink).catch(() => {});

page("piante", { title: t("Piante", "Plants"), short: t("Piante", "Plants"), icon: "🪴", order: 36.5,
  show: () => piante().length > 0 || isAdmin(),
  badge: () => { try { return oggi().some(x => x.s.m < 0) || piante().some(haSete); } catch { return false; } }, render: pagina });

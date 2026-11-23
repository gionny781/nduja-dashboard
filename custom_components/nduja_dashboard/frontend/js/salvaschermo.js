/* Salvaschermo per il tablet a muro: dopo X minuti senza tocchi copre la plancia con uno stile a scelta e si sveglia
   al primo tocco. Tutto si sceglie per ogni dispositivo (⚙️ Impostazioni → Questo dispositivo → Salvaschermo).
   Stili «della plancia», disegnati qui in HTML/SVG/CSS (nduja.css e sfondi.css, «salvaschermo»):
   - orologio: ora grande, data e le informazioni scelte, che si sposta piano (niente segni sullo schermo);
   - analogico: un orologio con le lancette, la data e la temperatura fuori;
   - cielo: il cielo di adesso — colori dal sole (sun.sun), sole o luna con la sua fase, stelle, nuvole, pioggia,
     neve, nebbia e lampi dal meteo di casa — sopra le colline con la casetta;
   - solare: il fotovoltaico in tempo reale, con la scena dell'Energia (scenaenergia.js) in grande: sole, pannelli, casa,
     batteria e rete con i flussi che seguono i watt veri; sotto prodotto oggi, autoconsumo, batteria e ora;
   - consumi: la potenza della casa adesso, il grafico delle ultime ore e chi consuma di più;
   - meteo: il tempo adesso e le prossime ore, grande e leggibile da lontano;
   - giornata: la data, gli impegni di oggi, la raccolta da esporre e le scadenze;
   - casa: pannelli che si alternano con meteo, stanze, persone, prossimi impegni e consumi;
   - notte: ora grande e molto scura, per la camera da letto;
   - foto: una cartella dei Media, un indirizzo (anche una GIF) o un elenco di indirizzi, in dissolvenza o con il
     movimento lento (Ken Burns);
   - sfondo: uno degli sfondi animati (sfondi.js) a tutto schermo, con l'ora piccola;
   - natale: la neve, l'orologio, il conto alla rovescia a Natale e l'albero disegnato che segue il Twinkly vero (festa.js);
     di notte più scuro e fermo. In Alterna e Automatico solo nel periodo di festa; «Automatico a Natale» lo mette al posto
     dello stile scelto per tutto il periodo;
   - alterna: gira tra gli stili scelti, con il tempo di cambio scelto;
   - auto: di giorno lo stile scelto (e il fotovoltaico quando produce), di notte quello della notte, con l'orario scelto.
   Leggerezza: si ridisegna al massimo ogni 20 secondi (e al cambio del minuto), le animazioni sono solo CSS
   (transform e opacity), tutto si ferma quando la scheda non è visibile e con «Riduci movimento».
   Anteprima dal vivo nel foglio «Personalizza» (stesso disegno, in piccolo). */
import { S, ACT, CHG, FISSI, UI, AGGIUNGI, t, LOC, esc, fnum, attr, W, nm, watts, sGet, sSet, ws, toast, openSheet, closeSheet, render, patch, cached,
  weatherEnt, WX, ents, roomTemp, roomHum, areasSorted, AREAS, forecast, myHA } from "./core.js";
import { inDiretta } from "./video.js";
import { indirizzoLocale, fileEsiste } from "./edit.js";
import { calendari, eventi, inizio, fine, allDay, nomeGiorno, colore, nelGiorno } from "./agenda.js";
import { info as persona } from "./people.js";
import { sole, mix, etichette } from "./scenaenergia.js";
import { ritiri, haRaccolta } from "./raccolta.js";
import { montaSfondo, SFONDI, opzioni as opzSfondo } from "./sfondi.js";
import { inPeriodo, conto, oreAlNatale, statoAlbero, alberoSVG, fine as fineFesta, dataTesto } from "./festa.js";

/* ---------- pagine caricate dopo la Home (Energia, Scadenze): le prendo quando servono ---------- */
const MOD = {};
function modulo(nome) {
  if (!(nome in MOD)) { MOD[nome] = null; import(`./pages/${nome}.js`).then(m => { MOD[nome] = m; render(); }).catch(() => {}); }
  return MOD[nome];
}
const energia = () => modulo("energia");
/** c'è il fotovoltaico? (null = non lo so ancora: la pagina Energia non è ancora caricata) */
export function haSolare() { const en = energia(); if (!en) return null; try { return !!en.sensori().pv; } catch { return false; } }
const haConsumi = () => { const en = energia(); if (!en) return null; try { return en.haEnergia() && en.letture().casa != null; } catch { return false; } };

/* ================= scelte (di questo dispositivo) ================= */
const J = (k, d) => { try { return JSON.parse(sGet(k) || "null") ?? d; } catch { return d; } };
const STILI = ["auto", "alterna", "orologio", "analogico", "cielo", "solare", "consumi", "meteo", "giornata", "casa", "notte", "foto", "sfondo", "natale"];
/** stili che si possono mettere in Automatico (di giorno, di notte) e in Alterna */
const SEMPLICI = STILI.filter(s => s !== "auto" && s !== "alterna");
export const ssMin = () => +(sGet("ssMin") || 0);          // 0 = spento
export const ssStile = () => { const s = sGet("ssStile") || "orologio"; return STILI.includes(s) ? s : "orologio"; };
export const ssDir = () => sGet("ssDir") || "";
const fonte = () => sGet("ssFonte") || "media";            // media | url | lista
const ssUrl = () => indirizzoLocale(sGet("ssUrl") || "");
const ssLista = () => String(sGet("ssLista") || "").split(/[\n;]+/).map(indirizzoLocale).filter(Boolean);
export const haFoto = () => fonte() === "media" ? !!ssDir() : fonte() === "url" ? !!ssUrl() : ssLista().length > 0;
const notteDa = () => sGet("ssNotteDa") || "23:00";
const notteA = () => sGet("ssNotteA") || "07:00";
const attenua = () => sGet("ssAtt") !== "0";
/** in Automatico: lo stile del giorno (prima solo foto o cielo) e quello della notte */
const giorno = () => { const v = sGet("ssGiorno"); return SEMPLICI.includes(v) && v !== "notte" ? v : "foto"; };
/** «🎄 Automatico a Natale»: nel periodo di festa il salvaschermo di Natale al posto di quello scelto */
const natAuto = () => sGet("ssNatale") === "1";
/** lo stile di Natale fuori dal periodo non entra in Alterna e Automatico */
const fuoriFesta = (s, d) => s === "natale" && !inPeriodo(d);
const notteStile = () => { const v = sGet("ssNotteStile"); return SEMPLICI.includes(v) ? v : "notte"; };
/** in Automatico, di giorno: il fotovoltaico quando produce più di tanti watt (acceso di partenza, se c'è il fotovoltaico) */
const solareAuto = () => sGet("ssSolAuto") !== "0";
const solareW = () => { const v = +sGet("ssSolW"); return v > 0 ? Math.round(v) : 200; };
const minuti = hm => { const [h, m] = String(hm).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
/** è l'orario della notte scelto (di solito dalle 23 alle 7)? */
export function diNotte(d = new Date()) {
  const x = d.getHours() * 60 + d.getMinutes(), a = minuti(notteDa()), b = minuti(notteA());
  return a === b ? false : a < b ? x >= a && x < b : x >= a || x < b;
}
/* per ogni stile: velocità (1 lenta, 2 normale, 3 veloce), effetto (fade = dissolvenza, mov = movimento lento), informazioni sopra,
   e le scelte proprie (ore del grafico, ore del meteo, secondi, giorni delle scadenze, sfondo, elenco di Alterna) */
const DEF = {
  orologio: { vel: 2, eff: "mov", info: ["meteo", "temp", "persone", "impegno"] },
  analogico: { vel: 2, info: ["meteo", "temp"], sec: "liscia" },
  cielo: { vel: 2, eff: "mov", info: ["ora", "meteo", "temp"] },
  solare: { vel: 2, info: ["meteo"] },
  consumi: { vel: 2, info: ["ora", "meteo"], ore: 6 },
  meteo: { vel: 2, info: ["ora", "temp"], ore: 12 },
  giornata: { vel: 2, info: ["meteo", "temp"], giorni: 7 },
  casa: { vel: 2, eff: "fade", info: ["ora", "meteo"] },
  notte: { vel: 1, eff: "fade", info: [] },
  foto: { vel: 2, eff: "mov", info: ["ora", "meteo"] },
  sfondo: { vel: 2, info: ["ora"], sf: "aurora", int: 2 },
  natale: { vel: 2, info: ["meteo", "temp"], albero: 1 },
  alterna: { lista: ["orologio", "cielo", "meteo", "giornata"], min: 2 },
};
const cfg = s => ({ ...DEF[s], ...(J("ssCfg", {})[s] || {}) });
function setCfg(s, k, v) { const a = J("ssCfg", {}); a[s] = { ...(a[s] || {}), [k]: v }; sSet("ssCfg", JSON.stringify(a)); }
/** si può mostrare adesso? (null = non lo so ancora: lo provo) */
function disponibile(s) {
  if (s === "solare") return haSolare() !== false;
  if (s === "consumi") return haConsumi() !== false;
  if (s === "meteo") return !!weatherEnt();
  return true;
}
/** il fotovoltaico «produce» (con un margine, così non salta avanti e indietro attorno alla soglia) */
let produce = false;
function staProducendo() {
  const en = energia(); if (!en || !haSolare()) return (produce = false);
  let pv = null; try { pv = en.letture().pv; } catch {}
  const soglia = solareW();
  produce = pv != null && (produce ? pv > soglia * .7 : pv > soglia);
  return produce;
}
/** gli stili di Alterna che si possono mostrare */
const giroAlterna = () => { const L = (cfg("alterna").lista || []).filter(s => SEMPLICI.includes(s) && disponibile(s) && (s !== "foto" || haFoto()) && !fuoriFesta(s)); return L.length ? L : ["orologio"]; };
const perAlterna = () => Math.max(1, +cfg("alterna").min || 2) * 60000;
/** lo stile da disegnare adesso (Automatico e Alterna scelgono da soli; quello che manca diventa l'orologio) */
function reale(stile, d = new Date()) {
  if (natAuto() && inPeriodo(d)) return "natale";
  if (stile === "auto") {
    if (diNotte(d)) { const n = notteStile(); return fuoriFesta(n, d) ? "notte" : reale(n, d); }
    if (solareAuto() && staProducendo()) return "solare";
    const g = giorno();
    return g === "foto" && !haFoto() ? "cielo" : fuoriFesta(g, d) ? "cielo" : reale(g, d);
  }
  if (stile === "alterna") { const L = giroAlterna(); return reale(L[Math.floor(d.getTime() / perAlterna()) % L.length], d); }
  if (stile === "foto" && !haFoto()) return "orologio";
  if (!disponibile(stile)) return "orologio";
  return stile;
}

/* ================= pezzi comuni ================= */
const lim = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const r1 = n => Math.round(n * 10) / 10;
const caso = seme => { let s = seme % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const oraTxt = d => d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
const dataTxt = d => { const s = d.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" }); return s[0].toUpperCase() + s.slice(1); };
const media = L => L.length ? L.reduce((a, b) => a + b, 0) / L.length : null;
const tempCasa = () => media(areasSorted().map(roomTemp).filter(v => v != null));
const inCasa = () => ents("person").filter(p => S[p].state === "home").length;
/** il prossimo impegno dei calendari della plancia (anche quello in corso) */
function prossimo() {
  const L = eventi(calendari(), 7), ora = Date.now();
  if (!Array.isArray(L)) return null;
  return L.find(ev => fine(ev) > ora && (!allDay(ev) || inizio(ev) >= new Date(new Date().setHours(0, 0, 0, 0)))) || null;
}
function quando(ev) {
  const s = inizio(ev), oggi = new Date().toDateString() === s.toDateString();
  if (allDay(ev)) return nomeGiorno(s);
  if (s <= new Date()) return t("Adesso", "Now");
  return (oggi ? "" : nomeGiorno(s) + " ") + oraTxt(s);
}
const corto = (s, n = 34) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
/** le informazioni scelte, come pillole: meteo, temperatura di casa, persone, prossimo impegno */
function pillole(info) {
  const w = weatherEnt(), out = [];
  for (const k of info) {
    if (k === "meteo" && w && S[w]) { const [ic, tx] = WX()[S[w].state] || ["🌡️", S[w].state]; out.push(`<span>${ic} ${fnum(attr(w, "temperature"), 0)}° <small>${esc(tx)}</small></span>`); }
    if (k === "temp") { const v = tempCasa(); if (v != null) out.push(`<span>🏠 ${fnum(v, 1)}°</span>`); }
    if (k === "persone" && ents("person").length) out.push(`<span>👥 ${inCasa()} <small>${t("in casa", "home")}</small></span>`);
    if (k === "impegno") { const ev = prossimo(); if (ev) out.push(`<span class="ev">📅 <small>${esc(quando(ev))}</small> ${esc(corto(ev.summary))}</span>`); }
  }
  return out.join("");
}
/** ora, data e pillole in basso a sinistra (cielo e foto) */
const blocco = (d, c) => `<div class="ssc1">${c.info.includes("ora") ? `<div class="ssh1">${oraTxt(d)}</div><div class="ssd1">${esc(dataTxt(d))}</div>` : ""}<div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div>`;

/* ================= stili ================= */
/* ---------- orologio ---------- */
const PASSO = { 1: 300000, 2: 60000, 3: 20000 };
/** posizione nello schermo per il turno n (si sposta piano: niente segni sugli schermi) */
const posto = (n, k = 1) => { const r = caso(n * 7919 + 13); r(); return [r1(r() * 9 * k), r1(-r() * 10 * k)]; };
function orologio(d, c, x) {
  const sl = sole(), el = sl.el;
  /* un alone appena visibile che cambia colore con il sole: blu di notte, ambra all'alba e al tramonto, azzurro di giorno */
  const g = el < -8 ? "#1d2f6b" : el < 8 ? mix(el < 0 ? "#3b2a6b" : "#a2522c", el < 0 ? "#a2522c" : "#2b6f8f", (el + 8) / 16) : "#2b6f8f";
  const [dx, dy] = posto(x.turno);
  return `<div class="sso1" style="--g:${g}"></div>
    <div class="ssw1"><div class="ssc1 ssgr ${c.eff === "fade" ? "fd" : ""} ${x.fuori ? "out" : ""}" style="--dx:${dx}cqw;--dy:${dy}cqh">
      <div class="ssh1">${oraTxt(d)}</div><div class="ssd1">${esc(dataTxt(d))}</div><div class="ssi1">${pillole(c.info)}</div></div></div>`;
}

/* ---------- minimal notturno ---------- */
function notte(d, c, x) {
  const [a, b] = posto(x.turno, 1.6), dx = r1(a - 7), dy = r1(b + 8);   // attorno al centro
  return `<div class="ssw1 ssn2"><div class="ssc1 fd ${x.fuori ? "out" : ""}" style="--dx:${dx}cqw;--dy:${dy}cqh">
    <div class="ssh1">${oraTxt(d)}</div>${c.info.length ? `<div class="ssi1">${pillole(c.info)}</div>` : ""}</div></div>`;
}

/* ---------- cielo vivo ---------- */
/** com'è il cielo dal meteo di casa: nuvole (quante), copertura, grigio, nuvole scure, cosa cade, lampi, nebbia, vento */
function meteoCielo() {
  const w = weatherEnt(), st = w && S[w] ? S[w].state : "";
  const M = {
    partlycloudy: [3, .3, .06, 0], cloudy: [6, .85, .6, .3], fog: [2, .7, .62, .15],
    rainy: [6, .9, .74, .6, "pioggia"], pouring: [7, 1, .84, .8, "rovesci"], lightning: [6, .9, .76, .85], "lightning-rainy": [7, 1, .82, .9, "pioggia"],
    snowy: [6, .85, .62, .25, "neve"], "snowy-rainy": [6, .9, .7, .45, "pioggia"], hail: [6, .9, .76, .7, "grandine"],
    windy: [3, .3, .08, 0], "windy-variant": [4, .55, .3, .2], exceptional: [7, 1, .84, .9],
  }[st] || [0, 0, 0, 0];
  let [nubi, cop, grigio, cupo, cade = null] = M;
  const cc = parseFloat(attr(w, "cloud_coverage"));
  if (st === "partlycloudy" && !isNaN(cc)) { nubi = cc < 25 ? 2 : cc < 55 ? 3 : 4; cop = lim(cc / 100, .2, .6); }
  const v = parseFloat(attr(w, "wind_speed")), u = String(attr(w, "wind_speed_unit") || "");
  const kmh = isNaN(v) ? null : /m\/s/.test(u) ? v * 3.6 : /mph/.test(u) ? v * 1.61 : v;
  return { st, nubi, cop, grigio, cupo, cade, lampi: /lightning|exceptional/.test(st), nebbia: st === "fog", kmh: kmh ?? (/windy/.test(st) ? 35 : 8) };
}
/* colori del cielo [in alto, a metà, all'orizzonte] secondo l'altezza del sole; all'alba più rosa, al tramonto più arancio */
const CIELO_ALBA = [[-14, ["#03060f", "#07102a", "#0d1a3a"]], [-8, ["#0a1430", "#1c2556", "#3d3466"]], [-3, ["#1b2f63", "#6b5a8e", "#f08a6c"]], [3, ["#3d6fb3", "#a7b6d6", "#ffc49a"]], [12, ["#2f78d0", "#69a8e6", "#bfe0f7"]], [30, ["#1f6cd1", "#5aa2ea", "#aed8f6"]]];
const CIELO_SERA = [[-14, ["#03060f", "#07102a", "#0d1a3a"]], [-8, ["#0b1230", "#25205a", "#4a2c5c"]], [-3, ["#1a2a5a", "#7a4a7c", "#ff7a45"]], [3, ["#3a62a8", "#c98f9a", "#ffa25a"]], [12, ["#2f78d0", "#69a8e6", "#bfe0f7"]], [30, ["#1f6cd1", "#5aa2ea", "#aed8f6"]]];
function colori(el, sale, grigio) {
  const P = sale ? CIELO_ALBA : CIELO_SERA;
  let c = P[P.length - 1][1];
  if (el <= P[0][0]) c = P[0][1];
  else for (let i = 1; i < P.length; i++) if (el <= P[i][0]) { const k = (el - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); c = P[i][1].map((x, j) => mix(P[i - 1][1][j], x, k)); break; }
  const G = el > 0 ? ["#6d7787", "#8d96a3", "#a9b0ba"] : ["#0b0e14", "#141821", "#1d222c"];
  return c.map((x, j) => mix(x, G[j], grigio));
}
/** fase della luna: 0 nuova, 0,5 piena */
function faseLuna(d = new Date()) { const s = 29.530588853, p = ((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % s; return (p < 0 ? p + s : p) / s; }
/** luna con la sua fase (parte illuminata a destra quando cresce; al contrario nell'emisfero sud) */
function luna(p, sud) {
  const r = 40, k = Math.cos(2 * Math.PI * p), cresce = p < .5, rx = r1(Math.abs(k) * r);
  const destra = cresce !== sud;   // lato illuminato
  /* mezzo disco dal lato illuminato, poi il terminatore (un'ellisse) che torna su: gobba verso il buio se è gibbosa */
  const s1 = destra ? 1 : 0, s2 = (k < 0) === destra ? 1 : 0;
  const lit = p < .02 || p > .98 ? "" : `<path d="M0 ${-r}A${r} ${r} 0 0 ${s1} 0 ${r}A${rx} ${r} 0 0 ${s2} 0 ${-r}Z" fill="#f4f1e6"/>`;
  return `<svg viewBox="-50 -50 100 100"><circle r="${r}" fill="#2a3044" opacity=".55"/>${lit}<circle r="${r}" fill="none" stroke="rgba(255,255,255,.08)"/></svg>`;
}
/** un cumulo disegnato per 'Nduja: palle morbide su una base piatta, l'ombra sotto e la luce sopra, sfumate (la sfocatura
    si calcola una volta sola: poi la nuvola scorre intera, con il transform) */
function nuvola(r, luce, ombra, k = 1) {
  const n = 5 + Math.floor(r() * 3), C = [];
  for (let i = 0; i < n; i++) { const x = 40 + (i / (n - 1)) * 140, m = Math.sin(Math.PI * i / (n - 1)); C.push([r1(x + (r() - .5) * 12), r1(64 - m * (22 + r() * 16) * k), r1(14 + m * (16 + r() * 10) * k)]); }
  const forma = C.map(([x, y, q]) => `<circle cx="${x}" cy="${y}" r="${q}"/>`).join("") + `<rect x="30" y="54" width="160" height="22" rx="11"/>`;
  return `<svg viewBox="0 0 220 100"><g filter="url(#ssbl)"><g fill="${ombra}" transform="translate(0 4)">${forma}</g><g fill="${luce}" transform="translate(2 -2) scale(.985)">${forma}</g></g></svg>`;
}
const STELLE = (() => { const r = caso(4242); return Array.from({ length: 90 }, () => [r1(r() * 160), r1(r() * 70), r1(.18 + r() * .32), Math.floor(r() * 3)]); })();
function cielo(d, c, x) {
  const sl = sole(), m = meteoCielo(), el = sl.el, [top, mid, hz] = colori(el, sl.sale, m.grigio);
  const notteK = lim((-el - 4) / 8), coperto = m.cop;
  const sud = (attr("zone.home", "latitude") ?? 45) < 0;
  /* sole e luna lungo un arco: da sinistra (alba) a destra (tramonto) */
  const ax = 8 + sl.f * 84, ay = 72 - Math.sin(Math.PI * sl.f) * 54;
  const caldo = lim((14 - el) / 18), solCol = mix("#fff6d6", "#ffab5e", caldo);
  const astro = sl.su
    ? `<div class="sss1" style="left:${r1(ax)}%;top:${r1(ay)}%;--sc:${solCol};opacity:${coperto >= .85 ? 0 : r1(1 - coperto * .8)}"><i></i></div>`
    : `<div class="ssm1" style="left:${r1(ax)}%;top:${r1(ay)}%;opacity:${coperto >= .85 ? 0 : r1((1 - coperto * .85) * lim((-el + 2) / 6, .35))}">${luna(faseLuna(d), sud)}</div>`;
  /* stelle: solo con il buio e il cielo sgombro; un terzo luccica, in due gruppi */
  const sv = r1(notteK * Math.pow(1 - coperto, 1.5));
  const stelle = sv > .03 ? [0, 1, 2].map(g => `<svg class="sst1 sg${g}" viewBox="0 0 160 70" preserveAspectRatio="xMidYMin slice" style="opacity:${sv}">${STELLE.filter(s => s[3] === g).map(([a, b, q]) => `<circle cx="${a}" cy="${b}" r="${q}"/>`).join("")}</svg>`).join("")
    + (coperto < .3 && notteK > .8 ? `<i class="ssst"></i>` : "") : "";
  /* nuvole: di giorno chiare (scure se il tempo è brutto), di notte grigio-blu */
  const luce = el > 0 ? mix("#ffffff", "#9aa3b2", m.cupo) : mix("#3a4256", "#1c212c", m.cupo);
  const tinta = el > -3 && el < 8 ? mix(luce, "#ffb48a", .35 * (1 - m.cupo)) : luce;   // all'alba e al tramonto si colorano
  const ombra = el > 0 ? mix(tinta, "#6f7888", .3 + .35 * m.cupo) : mix(tinta, "#0b0e14", .45);
  const vk = { 1: .6, 2: 1, 3: 1.8 }[c.vel] * (m.kmh > 30 ? 1.8 : m.kmh > 15 ? 1.3 : 1);
  const r = caso(97);
  const nubi = Array.from({ length: m.nubi }, (_, i) => {
    const q = .55 + r() * .7, w = r1(16 + q * 22), y = r1(4 + r() * 38 + (i % 2) * 6), x0 = r1(-10 + ((i * 37 + r() * 20) % 110)), dur = Math.round((150 + q * 90) / vk);
    const p0 = (x0 + 50) / 200;
    return `<div class="ssn1" style="--x:${x0}cqw;left:${x0}cqw;top:${y}cqh;width:${w}cqw;animation-duration:${dur}s;animation-delay:${-Math.round(p0 * dur)}s;opacity:${r1(.75 + q * .25)}">${nuvola(r, tinta, ombra, q)}</div>`;
  }).join("");
  const cade = m.cade ? `<div class="ssp2 ${m.cade}">${m.cade === "pioggia" || m.cade === "rovesci" ? `<i class="l1"></i><i class="l2"></i>` : `<i class="l1"></i>`}</div>` : "";
  const nebbia = m.nebbia ? `<i class="ssfg f1"></i><i class="ssfg f2"></i>` : "";
  /* colline e casetta: più scure del cielo; la finestra si accende con il buio */
  const sc = (k) => mix(hz, "#05070d", k), finestra = el < -1 ? "#ffcf72" : mix(mid, "#0a0f1c", .5);
  return `<svg class="ssdf"><filter id="ssbl" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter></svg>
    <div class="ssk2" style="background:linear-gradient(180deg,${top} 0%,${mid} 52%,${hz} 80%)"></div>${stelle}${astro}
    ${coperto >= .6 ? `<i class="ssov" style="--vc:${ombra};opacity:${r1(coperto * .9)}"></i>` : ""}<div class="ssnb">${nubi}</div>${cade}${nebbia}${m.lampi ? `<i class="ssl1"></i>` : ""}
    <svg class="ssh2" viewBox="0 0 1600 320" preserveAspectRatio="none"><path d="M0 130C200 80 380 120 560 98S900 52 1100 104S1450 86 1600 112V320H0Z" fill="${sc(.45)}"/>
      <path d="M0 200C260 160 420 196 640 176S1000 146 1240 186S1500 168 1600 180V320H0Z" fill="${sc(.65)}"/><path d="M0 256C300 236 600 266 900 248S1350 232 1600 252V320H0Z" fill="${sc(.82)}"/></svg>
    <svg class="ssca" viewBox="0 0 120 80"><g fill="${sc(.82)}"><path d="M14 80V44L46 18L78 44V80Z"/><path d="M60 30V14H68V37Z"/><circle cx="100" cy="46" r="14"/><rect x="98" y="52" width="4" height="28"/></g>
      <rect x="27" y="50" width="12" height="11" rx="1.5" fill="${finestra}"/><rect x="51" y="50" width="12" height="11" rx="1.5" fill="${finestra}"/>${el < -1 ? `<circle cx="39" cy="56" r="22" fill="url(#ssgl)" opacity=".5"/><defs><radialGradient id="ssgl"><stop offset="0" stop-color="#ffcf72" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf72" stop-opacity="0"/></radialGradient></defs>` : ""}</svg>
    <div class="ssv1 lieve"></div><div class="ssw1">${blocco(d, c)}</div>`;
}

/* ---------- casa: pannelli che si alternano ---------- */
const pan = (ic, tit, corpo, col) => ({ ic, tit, corpo, col });
function pannelli(d) {
  const P = [], w = weatherEnt();
  if (w && S[w]) {
    const [ic, tx] = WX()[S[w].state] || ["🌡️", S[w].state], a = S[w].attributes, fc = (forecast(w) || []).slice(0, 5);
    P.push(pan("🌤️", t("Meteo", "Weather"), `<div class="ssq1"><span class="i">${ic}</span><div><b>${fnum(a.temperature, 0)}°</b><span>${esc(tx)}</span>
        <small>${[a.humidity != null ? "💧 " + fnum(a.humidity, 0) + "%" : "", a.wind_speed != null ? "💨 " + fnum(a.wind_speed, 0) + " " + esc(a.wind_speed_unit || "km/h") : ""].filter(Boolean).join(" · ")}</small></div></div>
      ${fc.length ? `<div class="ssq2">${fc.map(f => `<div><small>${esc(new Date(f.datetime).toLocaleDateString(LOC, { weekday: "short" }))}</small><span>${(WX()[f.condition] || ["·"])[0]}</span><b>${fnum(f.temperature, 0)}°</b><i>${f.templow != null ? fnum(f.templow, 0) + "°" : ""}</i></div>`).join("")}</div>` : ""}`, "#2b6f8f"));
  }
  const R = areasSorted().map(a => ({ a, v: roomTemp(a), h: roomHum(a) })).filter(r => r.v != null).slice(0, 8);
  if (R.length) P.push(pan("🌡️", t("Stanze", "Rooms"), `<div class="ssq3">${R.map(r => `<div style="--tc:${r.v < 18 ? "#64d2ff" : r.v > 24.5 ? "#ff9f0a" : "#30d158"}"><span>${esc(AREAS[r.a]?.name || "")}</span><b>${fnum(r.v, 1)}°</b>${r.h != null ? `<small>💧 ${fnum(r.h, 0)}%</small>` : ""}</div>`).join("")}</div>`, "#6a3a2a"));
  const PP = ents("person").slice(0, 6);
  if (PP.length) P.push(pan("👥", t("Persone", "People"), `<div class="ssq4">${PP.map(p => { const i = persona(p);
      return `<div class="${i.casa ? "home" : ""}"><span class="ssav" style="${i.foto ? `background-image:url('${esc(i.foto)}')` : ""}">${i.foto ? "" : esc(i.nome[0] || "?")}</span><b>${esc(i.nome)}</b><small>${i.casa ? "🏠" : "📍"} ${esc(i.zona)}</small></div>`; }).join("")}</div>`, "#3b4a8f"));
  const E = calendari().length ? eventi(calendari(), 7) : [];
  const EV = Array.isArray(E) ? E.filter(ev => fine(ev) > Date.now()).slice(0, 4) : [];
  if (EV.length) P.push(pan("📅", t("Prossimi impegni", "Coming up"), `<div class="ssq5">${EV.map(ev => `<div style="--cc:${colore(ev.cal)}"><span>${esc(quando(ev))}</span><b>${esc(corto(ev.summary, 48))}</b>${ev.location ? `<small>📍 ${esc(corto(ev.location, 40))}</small>` : ""}</div>`).join("")}</div>`, "#5a3a7a"));
  const en = energia();
  if (en && en.haEnergia?.()) {
    const L = en.letture?.(), T = en.totali?.() || {}, kw = w => w == null ? "—" : Math.abs(w) >= 1000 ? fnum(w / 1000, 1) + " kW" : Math.round(w) + " W";
    if (L && L.casa != null) P.push(pan("⚡", t("Consumi", "Energy"), `<div class="ssq6"><div class="tot"><small>${t("La casa adesso", "Home right now")}</small><b>${kw(L.casa)}</b></div><div class="ssq7">
      ${L.pv != null ? `<div><span>☀️ ${t("Sole", "Solar")}</span><b>${kw(L.pv)}</b></div>` : ""}
      ${L.rete != null ? `<div><span>🔌 ${L.rete < 0 ? t("Alla rete", "To grid") : t("Dalla rete", "From grid")}</span><b>${kw(Math.abs(L.rete))}</b></div>` : ""}
      ${L.soc != null ? `<div><span>🔋 ${t("Batteria", "Battery")}</span><b>${fnum(L.soc, 0)}%</b></div>` : ""}
      ${T.casa != null ? `<div><span>🏠 ${t("Oggi", "Today")}</span><b>${fnum(T.casa, 1)} kWh</b></div>` : ""}</div></div>`, "#7a5a1a"));
  }
  return P;
}
const GIRO = { 1: 30000, 2: 15000, 3: 8000 };
function casa(d, c, x) {
  const P = pannelli(d);
  if (!P.length) return orologio(d, { ...cfg("orologio"), info: c.info.filter(k => k !== "ora") }, x);
  const per = GIRO[c.vel] || 15000, n = Math.floor(Date.now() / per), i = n % P.length, prima = (n - 1) % P.length;
  x.prossimo = per - (Date.now() % per) + 40;
  const su = c.info.includes("ora");
  return `<div class="ssk3"></div>
    <div class="ssb2">${su ? `<div class="ssc2"><b>${oraTxt(d)}</b><span>${esc(dataTxt(d))}</span></div>` : "<span></span>"}<div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div>
    <div class="ssg1 ${c.eff === "mov" ? "mov" : ""}">${P.map((p, k) => `<section class="ssk1 ${k === i ? "on" : P.length > 1 && k === prima ? "via" : ""}" style="--pc:${p.col}"><h3>${p.ic} ${esc(p.tit)}</h3>${p.corpo}</section>`).join("")}</div>
    ${P.length > 1 ? `<div class="ssdt">${P.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>` : ""}`;
}

/* ---------- spostamento lento contro i segni sullo schermo (fotovoltaico, consumi, analogico, meteo, giornata, sfondo) ---------- */
const SPOSTA = new Set(["analogico", "solare", "consumi", "meteo", "giornata", "sfondo", "natale"]);
/** pochissimo (±1,2 % dello schermo), a turni: con la transizione lunga non si nota */
const spinta = c => { const [a, b] = posto(Math.floor(Date.now() / (PASSO[c.vel] || 60000)), .26); return `--dx:${r1(a - 1.2)}cqw;--dy:${r1(b + 1.3)}cqh`; };
/** cielo dietro uno stile scuro: i colori di adesso, abbassati perché il testo si legga */
function fondoCielo(k = .5) { const sl = sole(), m = meteoCielo(), [a, b, c] = colori(sl.el, sl.sale, m.grigio); return `linear-gradient(180deg,${mix(a, "#03050a", k)} 0%,${mix(b, "#03050a", k + .08)} 60%,${mix(c, "#03050a", k + .16)} 100%)`; }
const testata = (d, c, ora = true) => `<div class="ssb2">${ora && c.info.includes("ora") ? `<div class="ssc2"><b>${oraTxt(d)}</b><span>${esc(dataTxt(d))}</span></div>` : "<span></span>"}<div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div>`;
const kwhTxt = v => v == null ? "—" : fnum(v, v < 10 ? 1 : 0) + " kWh";

/* ---------- ☀️ fotovoltaico in tempo reale ---------- */
function solare(d, c, x) {
  const en = energia();
  if (!en) return `<div class="ssk3"></div><div class="ssw1"><div class="ssc1"><div class="ssd1">⚡ ${t("Carico i dati dell'energia…", "Loading energy data…")}</div></div></div>`;
  const R = x.root.getBoundingClientRect(), stretto = R.width < R.height * 1.15;   // in verticale (telefono): il disegno stretto
  const { Lt, sc, E, frase } = en.scenaAdesso(stretto, "ss" + x.id), T = en.totali() || {};
  const notte = !sc.sole.su && (Lt.pv || 0) < 20, bat = Lt.soc != null || Lt.bat != null;
  const auto = T.pv != null && T.pv > .05 ? Math.round(lim((T.pv - (T.exp || 0)) / T.pv) * 100) : null;
  const batTx = Lt.soc != null ? fnum(Lt.soc, 0) + "%" : watts(Math.abs(Lt.bat || 0)), batSo = (Lt.bat || 0) < -20 ? t("in carica", "charging") + " · " + watts(-Lt.bat) : (Lt.bat || 0) > 20 ? t("in uso", "in use") + " · " + watts(Lt.bat) : t("ferma", "idle");
  const box = (ic, n, v, s = "", cls = "") => `<div class="${cls}"><small>${ic} ${n}</small><b>${v}</b>${s ? `<span>${s}</span>` : ""}</div>`;
  const dati = notte
    ? [bat && box("🔋", t("Batteria", "Battery"), batTx, batSo, "bat"), box("🏠", t("Consumo adesso", "Using now"), watts(Lt.casa), "", "casa"), T.pv != null && box("☀️", t("Prodotto oggi", "Made today"), kwhTxt(T.pv), "", "sol"), box("🕐", esc(dataTxt(d)), oraTxt(d))]
    : [box("☀️", t("Prodotto oggi", "Made today"), kwhTxt(T.pv), watts(Lt.pv) + " " + t("adesso", "now"), "sol"), auto != null && box("♻️", t("Autoconsumo", "Self-use"), auto + "%", t("del prodotto resta in casa", "of it stays at home")), bat && box("🔋", t("Batteria", "Battery"), batTx, batSo, "bat"), box("🕐", esc(dataTxt(d)), oraTxt(d))];
  /* niente pulsanti sopra il salvaschermo: un tocco lo deve solo svegliare */
  const E0 = E.map(e => ({ ...e, id: null }));
  return `<div class="ssk4" style="background:${fondoCielo(.55)}"></div>
    <div class="sspv1 ssmv" style="${spinta(c)}">
      <div class="sspv2">${esc(frase || (notte ? t("Di notte la casa va con la batteria e con la rete.", "At night the house runs on the battery and the grid.") : t("Il fotovoltaico adesso", "Solar right now")))}</div>
      <div class="en7 sspv ${stretto ? "tel" : ""}">${sc.html}${stretto ? "" : etichette(E0, sc.g)}</div>
      ${stretto ? `<div class="en7t sspvt">${etichette(E0, null)}</div>` : ""}
      <div class="sspv3">${dati.filter(Boolean).join("")}</div></div>
    <div class="ssb2 ssb3"><span></span><div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div>`;
}

/* ---------- ⚡ consumi della casa ---------- */
const colW = w => w == null ? "#8e8e93" : w < 500 ? "#30d158" : w < 1500 ? "#64d2ff" : w < 3000 ? "#ff9f0a" : "#ff453a";
const kW = id => { const u = String(attr(id, "unit_of_measurement") || "").toLowerCase(); return u === "kw" ? 1000 : u === "mw" ? 1e6 : 1; };
/** la potenza della casa nelle ultime ore, ogni 5 minuti, dalle statistiche (o da sole + rete + batteria): [{ x, y }]; null = sto caricando */
function serieCasa(ore) {
  const en = energia(); if (!en?.idsPotenza) return [];
  const I = en.idsPotenza(), usa = I.casa.length ? { casa: I.casa } : { pv: I.pv, rete: I.rete, bat: I.bat };
  const ids = [...new Set(Object.values(usa).flat())]; if (!ids.length) return [];
  const st = new Date(Date.now() - ore * 3600e3); st.setMinutes(Math.floor(st.getMinutes() / 5) * 5, 0, 0);
  const r = cached("ssCons:" + ids.join(",") + ":" + ore, 5 * 60000, () => ws({ type: "recorder/statistics_during_period", start_time: st.toISOString(), statistic_ids: ids, period: "5minute", types: ["mean"] }).catch(() => ({})));
  if (r === undefined) return null;
  const per = {};
  for (const id of ids) for (const p of (r?.[id] || [])) if (p.mean != null) (per[p.start] = per[p.start] || {})[id] = p.mean * kW(id);
  const somma = (o, L, inv) => !L?.length ? 0 : L.reduce((a, id) => a + (o[id] ?? NaN), 0) * (inv ? -1 : 1);
  return Object.keys(per).map(Number).sort((a, b) => a - b).map(x => {
    const o = per[x], y = usa.casa ? somma(o, usa.casa) : Math.max(0, Math.max(0, somma(o, usa.pv)) + somma(o, usa.rete, I.gridInv) + somma(o, usa.bat, I.batInv));
    return { x: typeof x === "number" && x < 1e11 ? x * 1000 : x, y };
  }).filter(p => isFinite(p.y));
}
/** un numero «tondo» sopra il massimo, per l'asse */
const tondo = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))), q = v / p; return (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * p; };
function graficoCasa(P, ore, ora) {
  if (P == null) return `<div class="sscg0">${t("Carico il grafico…", "Loading the chart…")}</div>`;
  const L = [...P]; if (ora != null) L.push({ x: Date.now(), y: ora });
  if (L.length < 2) return `<div class="sscg0">📈 ${t("Il grafico compare quando Home Assistant ha le statistiche della potenza (state_class: measurement).", "The chart shows up when Home Assistant has power statistics (state_class: measurement).")}</div>`;
  const x1 = Date.now(), x0 = x1 - ore * 3600e3, mx = tondo(Math.max(...L.map(p => p.y)) * 1.08), X = x => r1((x - x0) / (x1 - x0) * 1000), Y = y => r1(300 - lim(y / mx) * 290);
  const Q = L.filter(p => p.x >= x0);
  const linea = Q.map((p, i) => `${i ? "L" : "M"}${X(p.x)} ${Y(p.y)}`).join("");
  const area = `${linea}L${X(Q[Q.length - 1].x)} 300L${X(Q[0].x)} 300Z`;
  const passoOre = ore <= 3 ? 1 : ore <= 6 ? 1 : ore <= 12 ? 2 : 4, tic = [];
  const h0 = new Date(x0); h0.setMinutes(0, 0, 0);
  for (let h = h0.getTime() + 3600e3; h < x1; h += 3600e3) if (new Date(h).getHours() % passoOre === 0) tic.push(h);
  return `<div class="sscg"><svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sscg${ore}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#64d2ff" stop-opacity=".42"/><stop offset="1" stop-color="#64d2ff" stop-opacity="0"/></linearGradient></defs>
      ${[.5, 1].map(f => `<line x1="0" x2="1000" y1="${Y(mx * f)}" y2="${Y(mx * f)}" class="sscgl"/>`).join("")}
      <path d="${area}" fill="url(#sscg${ore})"/><path d="${linea}" class="sscgp"/></svg>
    ${[.5, 1].map(f => `<i class="sscgy" style="top:${r1(Y(mx * f) / 3)}%">${watts(mx * f)}</i>`).join("")}
    <i class="sscgd" style="left:${r1(X(Q[Q.length - 1].x) / 10)}%;top:${r1(Y(Q[Q.length - 1].y) / 3)}%"></i>
    <div class="sscgx">${tic.map(h => `<i style="left:${r1(X(h) / 10)}%">${new Date(h).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })}</i>`).join("")}</div></div>`;
}
function consumi(d, c, x) {
  const en = energia();
  if (!en) return `<div class="ssk3"></div><div class="ssw1"><div class="ssc1"><div class="ssd1">⚡ ${t("Carico i dati dell'energia…", "Loading energy data…")}</div></div></div>`;
  const Lt = en.letture(), F = en.ripartisci(Lt), casa = Lt.casa, ore = [3, 6, 12, 24].includes(+c.ore) ? +c.ore : 6;
  const pct = v => casa > 20 ? Math.round(lim(v / casa) * 100) : 0, da = [];
  if ((Lt.pv || 0) > 20 && pct(F.solCasa)) da.push(`☀️ ${pct(F.solCasa)}% ${t("dal sole", "from the sun")}`);
  if (pct(F.batCasa)) da.push(`🔋 ${pct(F.batCasa)}% ${t("dalla batteria", "from the battery")}`);
  if (pct(F.reteCasa)) da.push(`🔌 ${pct(F.reteCasa)}% ${t("dalla rete", "from the grid")}`);
  let top = []; try { top = en.chiConsuma(4); } catch {}
  const mx = Math.max(casa || 0, ...top.map(r => r.w), 1);
  return `<div class="ssk3"></div>${testata(d, c)}
    <div class="sscn ssmv" style="${spinta(c)}">
      <div class="sscn1" style="--wc:${colW(casa)}"><small>🏠 ${t("La casa adesso", "The house right now")}</small><b>${watts(casa)}</b>${da.length ? `<span>${da.join(" · ")}</span>` : ""}</div>
      <div class="sscn3">${top.length ? `<h4>${t("Chi consuma di più", "Using the most")}</h4>${top.map(r => `<div><span>${esc(nm(r.id))}</span><i><u style="width:${r1(r.w / mx * 100)}%;background:${colW(r.w)}"></u></i><b>${watts(r.w)}</b></div>`).join("")}` : ""}</div>
      <div class="sscn2"><h4>${t(`Ultime ${ore} ore`, `Last ${ore} hours`)}</h4>${graficoCasa(serieCasa(ore), ore, casa)}</div></div>`;
}

/* ---------- 🕰️ orologio analogico ---------- */
/** angoli delle lancette in gradi, che crescono sempre (niente salti all'indietro a mezzanotte): base = mezzanotte di quando è partito */
function angoli(base, sec) {
  const s = (Date.now() - base) / 1000;
  return { h: r1(s / 120), m: r1(s / 10), s: sec === "scatti" ? Math.floor(s) * 6 : r1(s * 6) };
}
const TACCHE = Array.from({ length: 60 }, (_, i) => { const a = i * 6 * Math.PI / 180, o = i % 5 === 0, r0 = o ? 80 : 86, r = 92;
  return `<line x1="${r1(Math.sin(a) * r0)}" y1="${r1(-Math.cos(a) * r0)}" x2="${r1(Math.sin(a) * r)}" y2="${r1(-Math.cos(a) * r)}" class="${o ? "o" : ""}"/>`; }).join("");
function analogico(d, c, x) {
  if (!x.base) { const m = new Date(); m.setHours(0, 0, 0, 0); x.base = m.getTime(); }
  const sl = sole(), el = sl.el, g = el < -8 ? "#1d2f6b" : el < 8 ? mix(el < 0 ? "#3b2a6b" : "#a2522c", el < 0 ? "#a2522c" : "#2b6f8f", (el + 8) / 16) : "#2b6f8f";
  const A = angoli(x.base, c.sec), num = [12, 3, 6, 9].map((n, i) => { const a = i * Math.PI / 2; return `<text x="${r1(Math.sin(a) * 66)}" y="${r1(-Math.cos(a) * 66 + 6)}">${n}</text>`; }).join("");
  return `<div class="sso1" style="--g:${g}"></div>
    <div class="ssan ssmv" style="${spinta(c)}"><svg class="ssan1" viewBox="-100 -100 200 200" aria-hidden="true">
      <circle r="97" class="fc"/><g class="tc">${TACCHE}</g><g class="nm">${num}</g>
      <g class="ssanh sec-${c.sec}" data-keep><path class="h" d="M-3.4 12L-2.4 -48Q0 -54 2.4 -48L3.4 12Z" style="transform:rotate(${A.h}deg)"/>
        <path class="m" d="M-2.4 14L-1.6 -74Q0 -79 1.6 -74L2.4 14Z" style="transform:rotate(${A.m}deg)"/>
        ${c.sec === "no" ? "" : `<g class="s" style="transform:rotate(${A.s}deg)"><line y1="18" y2="-82"/><circle r="3.4"/></g>`}<circle r="4.6" class="cn"/></g></svg>
      <div class="ssan2"><div class="ssd1">${esc(dataTxt(d))}</div><div class="ssi1">${pillole(c.info)}</div></div></div>`;
}
/** le lancette si muovono da sole, una volta al secondo (solo tre attributi: leggero) */
function lancette(x) {
  clearInterval(x.T4);
  const muovi = () => {
    if (!x.el?.isConnected || x.s !== "analogico") return clearInterval(x.T4);
    if (inPausa(x)) return;
    const g = x.el.querySelector(".ssanh"); if (!g) return;
    const A = angoli(x.base, cfg("analogico").sec);
    for (const k of ["h", "m", "s"]) { const e = g.querySelector("." + k); if (e) e.style.transform = `rotate(${A[k]}deg)`; }
  };
  x.T4 = setInterval(muovi, 1000);
}

/* ---------- 🌤️ meteo, grande ---------- */
function meteoSS(d, c, x) {
  const w = weatherEnt(); if (!w || !S[w]) return orologio(d, { ...cfg("orologio"), info: [] }, x);
  const a = S[w].attributes, sl = sole(), st = S[w].state === "sunny" && !sl.su ? "clear-night" : S[w].state, [ic0, tx] = WX()[st] || ["🌡️", S[w].state];
  const ic = sl.su ? ic0 : iconaMeteo(st, Date.now());   // di notte niente sole dietro le nuvole
  const ore = [6, 12, 24].includes(+c.ore) ? +c.ore : 12, H = (forecast(w, "hourly") || []).filter(f => Date.parse(f.datetime) > Date.now() - 30 * 60000).slice(0, ore);
  const D = forecast(w, "daily") || [], oggi = D[0], passo = Math.ceil(H.length / 12), HH = H.filter((_, i) => i % passo === 0);
  const u = esc(a.temperature_unit || "°"), ve = a.wind_speed != null ? fnum(a.wind_speed, 0) + " " + esc(a.wind_speed_unit || "km/h") : null;
  const pr = H[0]?.precipitation_probability ?? oggi?.precipitation_probability;
  const det = [a.apparent_temperature != null && `🌡️ ${t("percepita", "feels like")} ${fnum(a.apparent_temperature, 0)}°`, a.humidity != null && `💧 ${fnum(a.humidity, 0)}%`, ve && `💨 ${ve}`, pr != null && `☔ ${fnum(pr, 0)}%`].filter(Boolean);
  return `<div class="ssk4" style="background:${fondoCielo(.42)}"></div>${testata(d, c)}
    <div class="ssmt ssmv" style="${spinta(c)}">
      <div class="ssmt1"><span class="i">${ic}</span><div><b>${fnum(a.temperature, 0)}${u === "°C" || u === "°F" ? "°" : u}</b><span>${esc(tx)}</span>
        ${oggi && oggi.temperature != null ? `<small>↑ ${fnum(oggi.temperature, 0)}°${oggi.templow != null ? ` · ↓ ${fnum(oggi.templow, 0)}°` : ""}</small>` : ""}</div>
        ${det.length ? `<div class="ssmt2">${det.map(z => `<span>${z}</span>`).join("")}</div>` : ""}</div>
      ${HH.length ? `<div class="ssmt3" style="--n:${HH.length}">${HH.map(f => { const p = f.precipitation_probability;
        return `<div><small>${new Date(f.datetime).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })}</small><span>${iconaMeteo(f.condition, Date.parse(f.datetime))}</span><b>${fnum(f.temperature, 0)}°</b>
          <i class="pr"><u style="height:${p != null ? lim(p / 100) * 100 : 0}%"></u></i><em>${p ? fnum(p, 0) + "%" : ""}</em></div>`; }).join("")}</div>`
        : D.length > 1 ? `<div class="ssmt3" style="--n:${Math.min(6, D.length - 1)}">${D.slice(1, 7).map(f => `<div><small>${esc(new Date(f.datetime).toLocaleDateString(LOC, { weekday: "short" }))}</small><span>${(WX()[f.condition] || ["·"])[0]}</span><b>${fnum(f.temperature, 0)}°</b><em>${f.templow != null ? fnum(f.templow, 0) + "°" : ""}</em></div>`).join("")}</div>` : ""}
    </div>`;
}

/** è notte a quell'ora? (dall'alba e dal tramonto di sun.sun; senza, dalle 18 alle 7) */
function notteAlle(ms) {
  const a = S["sun.sun"]?.attributes || {}, nr = Date.parse(a.next_rising), ns = Date.parse(a.next_setting);
  if (isNaN(nr) || isNaN(ns)) { const h = new Date(ms).getHours(); return h < 7 || h >= 18; }
  return ns < nr ? ms >= ns && ms < nr : ms < nr || ms >= ns;
}
/** l'icona del tempo, senza il sole di notte */
const iconaMeteo = (cond, ms) => { const [ic] = WX()[cond] || ["·"]; return notteAlle(ms) ? ({ sunny: "🌙", rainy: "🌧️", partlycloudy: "☁️" }[cond] || ic) : ic; };

/* ---------- 📅 la giornata ---------- */
function giornata(d, c, x) {
  const oggi = new Date(), dom = new Date(Date.now() + 864e5), E = calendari().length ? eventi(calendari(), 2) : [];
  const L = Array.isArray(E) ? E : [], ancora = L.filter(ev => nelGiorno(ev, oggi) && fine(ev) > Date.now()), domani = L.filter(ev => nelGiorno(ev, dom));
  const evs = (ancora.length ? ancora : domani).slice(0, 5);
  const evRiga = ev => `<div style="--cc:${colore(ev.cal)}"><span>${allDay(ev) ? t("tutto il giorno", "all day") : inizio(ev) <= new Date() ? t("adesso", "now") : oraTxt(inizio(ev))}</span><b>${esc(corto(ev.summary, 46))}</b>${ev.location ? `<small>📍 ${esc(corto(ev.location, 40))}</small>` : ""}</div>`;
  const sera = oggi.getHours() >= 12, R = haRaccolta() ? ritiri() : null, rf = R ? (sera ? R.domani : R.oggi) : [];
  const sc = modulo("scadenze"), lst = sc?.lista?.(), N = [3, 7, 14, 30].includes(+c.giorni) ? +c.giorni : 7, SC = lst ? sc.prossime?.(N) : null;
  const giornoTx = oggi.toLocaleDateString(LOC, { weekday: "long" }), dataTx = oggi.toLocaleDateString(LOC, { day: "numeric", month: "long" });
  const pann = [
    `<section class="ssgg1"><h3>📅 ${ancora.length || !domani.length ? t("Oggi", "Today") : t("Domani", "Tomorrow")}</h3>${evs.length ? `<div class="ssq5">${evs.map(evRiga).join("")}</div>`
      : `<p class="ssgg0">${calendari().length ? t("Niente in programma: giornata libera.", "Nothing planned: a free day.") : t("Nessun calendario nella plancia.", "No calendars on the dashboard.")}</p>`}</section>`,
    R ? `<section class="ssgg1"><h3>♻️ ${sera ? t("Stasera esponi", "Put out tonight") : t("Oggi si ritira", "Collected today")}</h3>${rf.length ? `<div class="ssgg2">${rf.map(z => `<span style="--c:${z.c}">${z.e} ${esc(z.n)}</span>`).join("")}</div>` : `<p class="ssgg0">${t("Niente da esporre.", "Nothing to put out.")}</p>`}</section>` : "",
    lst ? `<section class="ssgg1"><h3>⏰ ${t("Scadenze", "Deadlines")}</h3>${SC == null ? `<p class="ssgg0">…</p>` : SC.length ? `<div class="ssgg3">${SC.slice(0, 4).map(z => `<div class="${z.cls}"><b>${esc(corto(z.titolo, 40))}</b><span>${esc(z.quando)}</span></div>`).join("")}</div>`
      : `<p class="ssgg0">${t(`Niente nei prossimi ${N} giorni.`, `Nothing in the next ${N} days.`)}</p>`}</section>` : "",
  ].filter(Boolean);
  return `<div class="ssk3"></div>
    <div class="ssgg ssmv" style="${spinta(c)}"><div class="ssgg4"><div><small>${esc(giornoTx)}</small><b>${esc(dataTx)}</b></div><div class="ssgg5"><b>${oraTxt(d)}</b><div class="ssi1">${pillole(c.info)}</div></div></div>
      <div class="ssgg6 n${pann.length}">${pann.join("")}</div></div>`;
}

/* ---------- ✨ sfondo animato ---------- */
const sfondoAnim = id => SFONDI().some(s => s[0] === id && s[4]) ? id : "aurora";
function sfondoSS(d, c, x) {
  return `<div class="sssf" data-keep></div><div class="ssv1 lieve"></div>
    <div class="ssw1 sssf2"><div class="ssc1 ssmv" style="${spinta(c)}">${c.info.includes("ora") ? `<div class="ssh1">${oraTxt(d)}</div>` : ""}<div class="ssi1">${pillole(c.info.filter(k => k !== "ora"))}</div></div></div>`;
}
/** monta (o cambia) lo sfondo animato dentro il salvaschermo */
function sfondoMonta(x, c) {
  const id = sfondoAnim(c.sf), o = { ...opzSfondo(null, id), vel: +c.vel || 2, int: +c.int || 2, osc: 0 }, chiave = JSON.stringify([id, o]);
  const box = x.el?.querySelector(".sssf"); if (!box) return;
  if (x.sf && x.sf.chiave === chiave && x.sf.box === box) return;
  x.sf?.stop(); x.sf = montaSfondo(box, id, o, { mini: x.mini, scuro: true }); x.sf.chiave = chiave; x.sf.box = box;
}
const fermaSfondo = x => { x.sf?.stop(); x.sf = null; };

/* ---------- 🎄 Natale ---------- */
function natale(d, c, x) {
  const nt = diNotte(d), ct = conto(d), st = statoAlbero();
  const testo = ct.k === "vigilia" && d.getHours() >= 18 ? oreAlNatale(ct.ms) : ct.testo;
  const ic = ct.k === "natale" ? "🎁" : ct.k === "feste" ? "✨" : ct.k === "vigilia" ? "🌟" : "🎄";
  return `<div class="sssf" data-keep></div><div class="ssnt0 ${nt ? "nt" : ""}"></div>
    <div class="ssnt ${nt ? "nt" : ""} ${c.albero === 0 ? "noal" : ""} ssmv" style="${spinta(c)}">
      ${c.albero === 0 ? "" : `<div class="ssnt2">${alberoSVG(st, { uid: "ss" + x.id })}</div>`}
      <div class="ssnt3"><div class="ssh1">${oraTxt(d)}</div><div class="ssd1">${esc(dataTxt(d))}</div>
        <div class="ssnt4 ${ct.k}"><span>${ic}</span>${esc(testo)}</div><div class="ssi1">${pillole(c.info)}</div></div></div>`;
}
/** la neve dietro: lo sfondo «Neve» (sfondi.js), scuro; di notte ferma */
function natMonta(x, c) {
  const nt = diNotte(), o = { ...opzSfondo(null, "neve"), vel: +c.vel || 2, int: nt ? 1 : 2, osc: 0 }, chiave = JSON.stringify(["neve", o, nt]);
  const box = x.el?.querySelector(".sssf"); if (!box) return;
  if (x.sf && x.sf.chiave === chiave && x.sf.box === box) return;
  x.sf?.stop(); x.sf = montaSfondo(box, "neve", o, { mini: x.mini, scuro: true, fermo: nt }); x.sf.chiave = chiave; x.sf.box = box;
}

/* ---------- foto ---------- */
const CAMBIO = { 1: 60000, 2: 20000, 3: 10000 };
function foto(d, c, x) {
  return `<div class="ssb1" data-keep></div><div class="ssv1"></div>${x.fotoErr ? `<div class="ssmsg">🖼️ ${t("Non riesco ad aprire le foto scelte.", "Can't open the chosen photos.")}</div>` : ""}<div class="ssw1">${blocco(d, c)}</div>`;
}
/** elenco delle foto: dalla cartella dei Media (fino a 200, in ordine casuale) o dagli indirizzi scelti */
async function elencoFoto() {
  if (fonte() === "url") return ssUrl() ? [{ u: ssUrl() }] : [];
  if (fonte() === "lista") return ssLista().map(u => ({ u }));
  if (!ssDir()) return [];
  try {
    const r = await ws({ type: "media_source/browse_media", media_content_id: ssDir() });
    const img = (r.children || []).filter(c => c.media_class === "image" || /^image\//.test(c.media_content_type || "")).slice(0, 200);
    for (let i = img.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [img[i], img[j]] = [img[j], img[i]]; }
    return img.map(c => ({ id: c.media_content_id }));
  } catch (e) { console.warn("salvaschermo", e); return []; }
}
async function indirizzo(f) { if (f.u) return f.u; try { return (await ws({ type: "media_source/resolve_media", media_content_id: f.id })).url; } catch { return null; } }
/** le foto si alternano: la nuova si carica prima, poi entra in dissolvenza (con il movimento lento se scelto) */
function avviaFoto(x) {
  const F = x.foto = { L: [], i: 0, T: null, ko: 0, fermo: false };
  const c = () => cfg("foto"), box = () => x.el?.querySelector(".ssb1");
  const dopo = ms => { clearTimeout(F.T); if (!F.fermo && F.L.length > 1) F.T = setTimeout(prossima, ms); };
  async function prossima() {
    if (F.fermo) return;
    if (inPausa(x)) { F.T = setTimeout(prossima, 3000); return; }
    const f = F.L[F.i++ % F.L.length], url = f && await indirizzo(f);
    if (F.fermo) return;
    const im = new Image();
    im.onload = () => {
      const b = box(); if (F.fermo || !b) return;
      F.ko = 0; if (x.fotoErr) { x.fotoErr = false; disegna(x); }
      const per = CAMBIO[c().vel] || 20000, kb = c().eff === "mov";
      const L = document.createElement("div"); L.className = "ssf1" + (kb ? " kb kb" + (F.i % 4) : "");
      L.style.setProperty("--kd", Math.round(per * 1.4 / 1000 + 4) + "s");
      /* foto molto più alta o più larga dello schermo: intera, con sotto la stessa foto sfocata */
      const R = b.getBoundingClientRect(), q = (im.naturalWidth / im.naturalHeight) / ((R.width || 16) / (R.height || 10)), fuori = q < .74 || q > 1.36;
      const u = `url(${JSON.stringify(url)})`;
      L.innerHTML = fuori ? `<i class="ssfb"></i><i class="ssfi ct"></i>` : `<i class="ssfi"></i>`;
      L.querySelectorAll("i").forEach(e => { e.style.backgroundImage = u; });
      b.appendChild(L);
      requestAnimationFrame(() => requestAnimationFrame(() => L.classList.add("on")));
      const vecchie = b.querySelectorAll(".ssf1"); if (vecchie.length > 2) vecchie[0].remove();
      setTimeout(() => { const v = b.querySelectorAll(".ssf1"); for (let k = 0; k < v.length - 1; k++) v[k].classList.add("via"); }, 2600);
      dopo(per);
    };
    im.onerror = () => { F.ko++; if (F.ko >= F.L.length) { x.fotoErr = true; disegna(x); } else { clearTimeout(F.T); F.T = setTimeout(prossima, 400); } };
    if (url) im.src = url; else im.onerror();
  }
  elencoFoto().then(L => { if (F.fermo) return; F.L = L; if (L.length) prossima(); else { x.fotoErr = true; disegna(x); } });
}
const fermaFoto = x => { if (x.foto) { x.foto.fermo = true; clearTimeout(x.foto.T); x.foto = null; } x.fotoErr = false; };

/* ================= motore: disegna uno stile dentro un contenitore ================= */
const STILE = { orologio, notte, cielo, casa, foto, analogico, solare, consumi, meteo: meteoSS, giornata, sfondo: sfondoSS, natale };
const VIVI = new Set();
let nid = 0;
/** ferma tutto quando la scheda non si vede, o quando l'anteprima (o lo sfondo della plancia) è coperta dal salvaschermo vero */
const inPausa = x => document.hidden || ((x.mini || x.opz.sfondo) && attivo);
/** monta uno stile nel contenitore (root): restituisce il controllo { stop }.
    opz (facoltativo): { cfg: scelte che sostituiscono quelle salvate, sfondo: true se è lo sfondo della plancia (sfondi.js: niente attenuazione) } */
function monta(root, stile, mini, opz = {}) {
  const x = { id: ++nid, root, stile, mini, opz, el: null, s: null, turno: 0, fuori: false, T: null, T2: null, T4: null, foto: null, fotoErr: false, prossimo: null, sf: null, base: 0 };
  root.innerHTML = "";
  x.stop = () => { clearTimeout(x.T); clearTimeout(x.T2); clearInterval(x.T4); (x.T3 || []).forEach(clearTimeout); fermaFoto(x); fermaSfondo(x); VIVI.delete(x); };
  VIVI.add(x); giro(x);
  /* calendari, previsioni e consumi arrivano un attimo dopo: ridisegno presto due volte */
  x.T3 = [1500, 4500].map(ms => setTimeout(() => { if (VIVI.has(x)) giro(x); }, ms));
  return x;
}
/** uno stile dentro un altro contenitore (lo sfondo «Cielo vivo» della plancia, sfondi.js) */
export const montaStile = (root, stile, opz = {}) => monta(root, stile, true, opz);
function giro(x) {
  clearTimeout(x.T);
  if (!x.root.isConnected) { x.stop(); return; }
  if (inPausa(x)) { x.root.querySelectorAll(".ssr1").forEach(e => e.classList.add("pausa")); return; }   // riparte con riprendi()
  x.root.querySelectorAll(".ssr1").forEach(e => e.classList.remove("pausa"));
  x.prossimo = null; disegna(x);
  const ora = Date.now(), alMinuto = 60000 - (ora % 60000) + 60;
  x.T = setTimeout(() => giro(x), Math.max(800, Math.min(20000, alMinuto, x.prossimo || Infinity)));
}
function riprendi() { for (const x of VIVI) giro(x); }
document.addEventListener("visibilitychange", riprendi);
function disegna(x) {
  const d = new Date(), s = reale(x.stile, d), c = { ...cfg(s), ...(x.opz.cfg || {}) };
  if (s !== x.s) {
    /* cambio di stile (Automatico all'inizio o alla fine della notte, Alterna): il nuovo entra in dissolvenza sopra il vecchio */
    fermaFoto(x); fermaSfondo(x); clearInterval(x.T4);
    const vecchio = x.el, el = document.createElement("div");
    el.className = "ssr1 st-" + s + (vecchio ? " entra" : "");
    x.root.appendChild(el); x.el = el; x.s = s; x.turno = Math.floor(Date.now() / (s === "notte" ? 180000 : PASSO[c.vel] || 60000)); x.fuori = false;
    if (vecchio) { requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("entra"))); setTimeout(() => vecchio.remove(), 2200); }
    if (s === "analogico") lancette(x);
  }
  /* orologio e notte cambiano posto a turni: con la dissolvenza spariscono, si spostano e ricompaiono */
  if (s === "orologio" || s === "notte") {
    const per = s === "notte" ? 180000 : PASSO[c.vel] || 60000, n = Math.floor(Date.now() / per);
    x.prossimo = per - (Date.now() % per) + 40;
    if (n !== x.turno && !x.fuori) {
      if (c.eff === "fade" || s === "notte") { x.fuori = true; clearTimeout(x.T2); x.T2 = setTimeout(() => { x.turno = n; x.fuori = false; disegna(x); }, 1300); }
      else x.turno = n;
    }
  }
  /* gli altri si spostano di pochissimo a turni (spinta), senza sparire */
  if (SPOSTA.has(s)) { const per = PASSO[c.vel] || 60000; x.prossimo = Math.min(x.prossimo || Infinity, per - (Date.now() % per) + 40); }
  /* attenuazione di notte: la scelta dello stile, altrimenti quella di sempre */
  const dim = !x.opz.sfondo && s !== "notte" && s !== "natale" && (c.att != null ? !!c.att : attenua()) && diNotte(d);
  try { patch(x.el, STILE[s](d, c, x) + `<div class="ssdim ${dim ? "on" : ""}"></div>`); } catch (e) { console.error("salvaschermo", e); }
  if (s === "foto" && !x.foto) avviaFoto(x);
  if (s === "sfondo") sfondoMonta(x, c);
  if (s === "natale") natMonta(x, c);
  /* Alterna: il prossimo giro arriva al cambio di stile */
  if (x.stile === "alterna") { const per = perAlterna(); x.prossimo = Math.min(x.prossimo || Infinity, per - (Date.now() % per) + 60); }
}

/* ================= a tutto schermo ================= */
let timer = null, attivo = false, el = null, ctl = null;
function riarma() {
  clearTimeout(timer);
  if (attivo || !ssMin()) return;
  timer = setTimeout(mostra, ssMin() * 60000);
}
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => document.addEventListener(ev, () => { if (attivo) nascondi(); else riarma(); }, { passive: true, capture: true }));
let ultimoMove = 0;
document.addEventListener("mousemove", () => { const n = Date.now(); if (n - ultimoMove > 1000) { ultimoMove = n; if (!attivo) riarma(); } }, { passive: true });
document.addEventListener("visibilitychange", () => { if (!document.hidden && !attivo) riarma(); });

export function mostra(prova) {
  if (attivo) return;
  if (prova !== true && (inDiretta() || document.hidden)) { riarma(); return; }   // si sta guardando una telecamera: non la copro
  attivo = true; clearTimeout(timer);
  el = document.createElement("div"); el.className = "ss1";
  document.body.appendChild(el);
  ctl = monta(el, ssStile(), false);
  requestAnimationFrame(() => requestAnimationFrame(() => el && el.classList.add("on")));
  /* sotto non si vede niente: smetto di ridisegnare la plancia e di animarla */
  setTimeout(() => { if (attivo) { document.body.classList.add("ss-on"); UI.ss = true; } }, 450);
  riprendi();
}
function nascondi() {
  attivo = false; UI.ss = false; document.body.classList.remove("ss-on");
  const e = el, c = ctl; el = null; ctl = null;
  if (e) { e.classList.remove("on"); setTimeout(() => { c?.stop(); e.remove(); }, 450); }
  render(true); riprendi(); riarma();
}
riarma();

/* ================= Impostazioni ================= */
const NOMI = () => ({
  auto: ["✨", t("Automatico", "Automatic"), t("Di giorno lo stile che scegli, di notte quello della notte", "By day the style you pick, at night the night one")],
  alterna: ["🔁", t("Alterna", "Rotate"), t("Gira tra gli stili che scegli", "Rotates the styles you pick")],
  orologio: ["🕐", t("Orologio", "Clock"), t("Ora grande, data e quello che scegli", "Big time, date and what you pick")],
  analogico: ["🕰️", t("Orologio analogico", "Analog clock"), t("Lancette eleganti, data e temperatura fuori", "Elegant hands, date and outdoor temperature")],
  cielo: ["🌅", t("Cielo vivo", "Live sky"), t("Il cielo di adesso, con il meteo di casa", "Today's sky, with your home weather")],
  solare: ["☀️", t("Fotovoltaico", "Solar"), t("Sole, pannelli, casa, batteria e rete in tempo reale", "Sun, panels, house, battery and grid in real time")],
  consumi: ["⚡", t("Consumi della casa", "Home energy use"), t("La potenza adesso, le ultime ore e chi consuma di più", "Power now, the last hours and what uses the most")],
  meteo: ["🌤️", t("Meteo", "Weather"), t("Il tempo adesso e le prossime ore, grande", "The weather now and the next hours, big")],
  giornata: ["📅", t("La giornata", "Your day"), t("Data, impegni di oggi, raccolta e scadenze", "Date, today's events, waste collection and deadlines")],
  casa: ["🏠", t("Casa", "Home"), t("Meteo, stanze, persone, impegni e consumi", "Weather, rooms, people, events and energy")],
  notte: ["🌙", t("Minimal notturno", "Night minimal"), t("Ora grande e scurissima, per la camera", "Big, very dark time for the bedroom")],
  foto: ["🖼️", t("Foto", "Photos"), t("Le tue foto o una GIF", "Your photos or a GIF")],
  sfondo: ["✨", t("Sfondo animato", "Animated background"), t("Uno sfondo animato, con l'ora piccola", "An animated background, with a small clock")],
  natale: ["🎄", t("Natale", "Christmas"), t("Neve, orologio, conto alla rovescia e il tuo albero", "Snow, clock, countdown and your tree")],
});
/** lo stile del giorno come si vede davvero (le foto senza foto diventano il cielo) */
const giornoVero = () => giorno() === "foto" && !haFoto() ? "cielo" : giorno();
const conSolare = () => solareAuto() && haSolare() === true;
/** riga del salvaschermo nella scheda «Questo dispositivo» */
export function ssVoce() {
  const s = ssStile(), N = NOMI(), [ic, n] = N[s];
  const sotto = natAuto() && inPeriodo() ? t(`🎄 Natale fino al ${dataTesto(fineFesta())}, poi ${N[s][1].toLowerCase()}`, `🎄 Christmas until ${dataTesto(fineFesta())}, then ${N[s][1].toLowerCase()}`)
    : s === "auto" ? t(`Di giorno ${N[giornoVero()][1].toLowerCase()}${conSolare() ? " (o il fotovoltaico quando produce)" : ""}, di notte ${N[notteStile()][1].toLowerCase()} (${notteDa()}–${notteA()})`,
      `By day ${N[giornoVero()][1].toLowerCase()}${conSolare() ? " (or solar while it produces)" : ""}, at night ${N[notteStile()][1].toLowerCase()} (${notteDa()}–${notteA()})`)
    : s === "alterna" ? t(`Gira tra ${giroAlterna().map(k => N[k][1].toLowerCase()).join(", ")} · ogni ${cfg("alterna").min} min`, `Rotates ${giroAlterna().map(k => N[k][1].toLowerCase()).join(", ")} · every ${cfg("alterna").min} min`)
    : s === "foto" && !haFoto() ? t("Scegli le foto", "Choose your photos") : !disponibile(s) ? t("Non disponibile qui: mostro l'orologio", "Not available here: showing the clock") : N[s][2];
  return `<button class="li sz1v" data-act="ssCfg"><span class="ic">${ic}</span><div class="tx"><b>${esc(n)}</b><span>${esc(sotto)}</span></div><span class="st">›</span></button>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="ssCfg">🎨 ${t("Personalizza", "Customize")}</button><button class="btn sm" data-act="ssProva">▶ ${t("Prova", "Try")}</button></div>`;
}
/* foglio «Personalizza»: in alto l'anteprima dal vivo, poi lo stile e le sue opzioni */
const ED = { sub: "giorno" };
const seg = (act, cur, opts, x = "") => `<div class="seg">${opts.map(([k, n]) => `<button class="${String(cur) === String(k) ? "act" : ""}" data-act="${act}" data-v="${k}" ${x}>${n}</button>`).join("")}</div>`;
/** lo stile di cui si vedono le opzioni (in Automatico: quello del giorno, della notte o il fotovoltaico) */
const inModifica = () => { const s = ssStile(); if (s !== "auto") return s; return ED.sub === "notte" ? notteStile() : ED.sub === "solare" && conSolare() ? "solare" : giorno(); };
/** lo stile dell'anteprima */
const vistaAnteprima = () => { const s = ssStile(); if (natAuto() && inPeriodo()) return "natale"; if (s !== "auto") return s; return ED.sub === "notte" ? notteStile() : ED.sub === "solare" && conSolare() ? "solare" : giornoVero(); };
const SPOSTA_TX = () => [t("Si sposta", "Shifts"), [t("ogni 5 min", "every 5 min"), t("ogni minuto", "every minute"), t("ogni 20 s", "every 20 s")]];
const VEL = () => ({
  orologio: [t("Si sposta", "Moves"), [t("ogni 5 min", "every 5 min"), t("ogni minuto", "every minute"), t("ogni 20 s", "every 20 s")]],
  cielo: [t("Nuvole", "Clouds"), [t("lente", "slow"), t("normali", "normal"), t("veloci", "fast")]],
  casa: [t("Cambio pannello", "Next panel"), ["30 s", "15 s", "8 s"]],
  foto: [t("Cambio foto", "Next photo"), ["1 min", "20 s", "10 s"]],
  analogico: SPOSTA_TX(), solare: SPOSTA_TX(), consumi: SPOSTA_TX(), meteo: SPOSTA_TX(), giornata: SPOSTA_TX(),
  sfondo: [t("Velocità", "Speed"), [t("lenta", "slow"), t("normale", "normal"), t("veloce", "fast")]],
  natale: [t("Neve", "Snow"), [t("lenta", "slow"), t("normale", "normal"), t("veloce", "fast")]],
});
const EFF = () => ({
  orologio: [t("Dissolvenza", "Fade"), t("Movimento lento", "Slow drift")],
  casa: [t("Dissolvenza", "Fade"), t("Scorrimento lento", "Slow slide")],
  foto: [t("Dissolvenza", "Fade"), t("Movimento lento (Ken Burns)", "Slow motion (Ken Burns)")],
});
const INFO = () => ({ ora: "🕐 " + t("Ora", "Time"), meteo: "🌤️ " + t("Meteo", "Weather"), temp: "🏠 " + t("Temperatura di casa", "Home temperature"), persone: "👥 " + t("Persone in casa", "People home"), impegno: "📅 " + t("Prossimo impegno", "Next event") });
const INFO_DI = { orologio: ["meteo", "temp", "persone", "impegno"], notte: ["meteo", "temp", "impegno"], cielo: ["ora", "meteo", "temp", "persone", "impegno"], casa: ["ora", "meteo", "temp", "persone", "impegno"], foto: ["ora", "meteo", "temp", "persone", "impegno"],
  analogico: ["meteo", "temp", "persone", "impegno"], solare: ["meteo", "temp", "persone", "impegno"], consumi: ["ora", "meteo", "temp", "persone"], meteo: ["ora", "temp", "persone", "impegno"],
  giornata: ["meteo", "temp", "persone"], sfondo: ["ora", "meteo", "temp", "persone", "impegno"], natale: ["meteo", "temp", "persone", "impegno"], alterna: [] };
/** le scelte proprie di uno stile: [chiave, nome, [[valore, testo], …], spiegazione] */
const PROPRIE = () => ({
  analogico: [["sec", t("Secondi", "Seconds"), [["liscia", t("Scorrevoli", "Smooth")], ["scatti", t("A scatti", "Ticking")], ["no", t("Senza", "None")]]]],
  consumi: [["ore", t("Grafico", "Chart"), [[3, "3 h"], [6, "6 h"], [12, "12 h"], [24, "24 h"]], t("Quante ore indietro mostra il grafico della potenza.", "How many hours back the power chart goes.")]],
  meteo: [["ore", t("Prossime ore", "Next hours"), [[6, "6 h"], [12, "12 h"], [24, "24 h"]]]],
  giornata: [["giorni", t("Scadenze entro", "Deadlines within"), [[3, t("3 giorni", "3 days")], [7, t("7 giorni", "7 days")], [14, t("14 giorni", "14 days")], [30, t("30 giorni", "30 days")]]]],
  sfondo: [["int", t("Intensità", "Intensity"), [[1, t("Tenue", "Soft")], [2, t("Normale", "Normal")], [3, t("Forte", "Strong")]]]],
  natale: [["albero", t("L'albero", "The tree"), [[1, "🎄 " + t("Mostra", "Show")], [0, t("Nascondi", "Hide")]], t("L'albero disegnato si accende come quello vero (Twinkly): acceso, spento e colore. Senza albero smart resta acceso con luci calde. Toccarlo sveglia la plancia, non lo comanda.", "The drawn tree lights up like the real one (Twinkly): on, off and colour. Without a smart tree it stays lit with warm lights. Touching it wakes the dashboard, it doesn't control it.")]],
});
function opzioni(s) {
  const c = cfg(s), V = VEL()[s], E = EFF()[s], I = INFO(), N = NOMI();
  if (s === "alterna") return `<div class="sz1o"><span>${t("Stili", "Styles")}</span><div class="vr1">${SEMPLICI.filter(k => disponibile(k) || (c.lista || []).includes(k)).map(k => `<button class="${(c.lista || []).includes(k) ? "on" : ""}" data-act="ssAlt" data-v="${k}">${N[k][0]} ${esc(N[k][1])}</button>`).join("")}</div></div>
    <div class="sz1o"><span>${t("Cambia ogni", "Changes every")}</span>${seg("ssOpz", c.min, [[1, "1 min"], [2, "2 min"], [5, "5 min"], [10, "10 min"], [30, "30 min"]], `data-s="alterna" data-k="min"`)}</div>
    <p class="small muted">${t("Le opzioni di ogni stile (informazioni, velocità…) si scelgono mettendo quello stile da solo: valgono anche qui.", "Each style's options (info, speed…) are set by picking that style on its own: they apply here too.")}</p>`;
  const P = PROPRIE()[s] || [];
  return `${V ? `<div class="sz1o"><span>${V[0]}</span>${seg("ssVel", c.vel, V[1].map((n, i) => [i + 1, n]), `data-s="${s}"`)}</div>${SPOSTA.has(s) && s !== "sfondo" ? `<p class="small muted">${t("Di pochissimo, così lo schermo non si segna.", "Just a little, so the screen doesn't get marked.")}</p>` : ""}` : ""}
    ${E ? `<div class="sz1o"><span>${t("Passaggio", "Transition")}</span>${seg("ssEff", c.eff, [["fade", E[0]], ["mov", E[1]]], `data-s="${s}"`)}</div>` : ""}
    ${s === "sfondo" ? `<div class="sz1o"><span>${t("Sfondo", "Background")}</span><div class="vr1">${SFONDI().filter(z => z[4]).map(([id, ic, n]) => `<button class="${sfondoAnim(c.sf) === id ? "on" : ""}" data-act="ssOpz" data-s="sfondo" data-k="sf" data-v="${id}">${ic} ${esc(n)}</button>`).join("")}</div></div>` : ""}
    ${P.map(([k, n, L, sp]) => `<div class="sz1o"><span>${n}</span>${seg("ssOpz", c[k], L, `data-s="${s}" data-k="${k}"`)}</div>${sp ? `<p class="small muted">${sp}</p>` : ""}`).join("")}
    ${INFO_DI[s]?.length ? `<div class="sz1o"><span>${s === "casa" ? t("In alto", "On top") : t("Da mostrare sopra", "Shown on top")}</span><div class="vr1">${INFO_DI[s].map(k => `<button class="${c.info.includes(k) ? "on" : ""}" data-act="ssInfo" data-s="${s}" data-v="${k}">${I[k]}</button>`).join("")}</div></div>` : ""}
    ${s === "natale" ? `<p class="small muted">${t("Il conto alla rovescia: i giorni che mancano, la vigilia sera le ore e i minuti, il 25 «Buon Natale» e fino all'Epifania «Buone feste». Di notte (orario qui sotto) è più scuro e la neve si ferma.", "The countdown: the days to go, on Christmas Eve evening hours and minutes, on the 25th «Merry Christmas» and until Epiphany «Happy holidays». At night (hours below) it's darker and the snow stops.")}</p>` : ""}
    ${s !== "notte" && s !== "natale" ? `<div class="sz1o"><span>${t("Di notte", "At night")}</span>${seg("ssOpz", (c.att != null ? !!c.att : attenua()) ? 1 : 0, [[1, t("Abbassa la luce", "Dim it")], [0, t("Come di giorno", "As by day")]], `data-s="${s}" data-k="att"`)}</div>` : ""}
    ${s === "foto" ? fotoScelta() : ""}
    ${s === "cielo" ? `<p class="small muted">${t("I colori seguono il sole, le nuvole e la pioggia il meteo di casa; di notte la luna ha la sua fase vera.", "Colours follow the sun, clouds and rain your home weather; at night the moon shows its real phase.")}</p>` : ""}
    ${s === "notte" ? `<p class="small muted">${t("Nero, con l'ora in un arancio molto tenue che non abbaglia; cambia posto ogni pochi minuti.", "Black, with the time in a very soft orange that doesn't dazzle; it moves every few minutes.")}</p>` : ""}
    ${s === "solare" ? `<p class="small muted">${t("Usa gli stessi sensori della pagina Energia (si scelgono lì, in ✏️ Modifica → ⚙️ Sensori). I flussi vanno più veloci quando passano più watt.", "Uses the same sensors as the Energy page (pick them there, in ✏️ Edit → ⚙️ Sensors). Flows move faster when more watts pass.")}</p>` : ""}
    ${s === "giornata" ? `<p class="small muted">${t("Impegni dei calendari della plancia, la raccolta (dopo mezzogiorno quella da esporre stasera) e le scadenze della lista Scadenze.", "Events from the dashboard's calendars, waste collection (after noon, what goes out tonight) and the Deadlines list.")}</p>` : ""}`;
}
function fotoScelta() {
  const f = fonte(), stato = u => { const s = fileEsiste(u); return s === "ok" ? "✅" : s === "no" ? "⚠️" : s === "?" ? "…" : ""; };
  let corpo = "";
  if (f === "media") corpo = `<button class="li" data-act="ssDir"><span class="ic">📁</span><div class="tx"><b>${ssDir() ? esc(decodeURIComponent(ssDir().split("/").pop() || "")) : t("Scegli la cartella", "Choose the folder")}</b><span>${t("Dai Media di Home Assistant (Impostazioni → Media)", "From Home Assistant's Media (Settings → Media)")}</span></div><span class="st">›</span></button>`;
  else if (f === "url") { const u = ssUrl();
    corpo = `<label class="fld1"><span>${t("Indirizzo dell'immagine o della GIF", "Image or GIF address")}</span><input type="text" data-chg="ssUrl" value="${esc(sGet("ssUrl") || "")}" placeholder="/local/salvaschermo.gif" autocomplete="off"></label>
      ${u ? `<div class="small muted sz1st">${stato(u)} ${fileEsiste(u) === "no" ? t("Non la trovo: controlla l'indirizzo.", "Not found: check the address.") : fileEsiste(u) === "ok" ? t("Trovata.", "Found.") : t("Controllo…", "Checking…")}</div>` : ""}`; }
  else { const L = ssLista(), ok = L.filter(u => fileEsiste(u) === "ok").length, no = L.filter(u => fileEsiste(u) === "no");
    corpo = `<label class="fld1"><span>${t("Un indirizzo per riga", "One address per line")}</span><textarea rows="4" data-chg="ssLista" placeholder="/local/foto/mare.jpg&#10;/local/foto/monti.jpg" autocomplete="off">${esc(sGet("ssLista") || "")}</textarea></label>
      ${L.length ? `<div class="small muted sz1st">${t(`${L.length} indirizzi · ${ok} trovati`, `${L.length} addresses · ${ok} found`)}${no.length ? ` · ⚠️ ${t("non trovati", "not found")}: ${no.map(esc).join(", ")}` : ""}</div>` : ""}`; }
  return `<div class="sz1o"><span>${t("Le foto", "Photos")}</span>${seg("ssFonte", f, [["media", "📁 " + t("Cartella dei Media", "Media folder")], ["url", "🔗 " + t("Un indirizzo", "One address")], ["lista", "📋 " + t("Più indirizzi", "Several")]])}</div>${corpo}
    ${f !== "media" ? `<p class="small muted">${t("Metti i file nella cartella www di Home Assistant: «/config/www/foto.jpg» diventa «/local/foto.jpg». Vanno bene anche le GIF animate.", "Put the files in Home Assistant's www folder: «/config/www/photo.jpg» becomes «/local/photo.jpg». Animated GIFs work too.")}</p>` : ""}`;
}
function foglio() {
  const s = ssStile(), N = NOMI(), m = inModifica(), vista = reale(vistaAnteprima());
  const ore = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const sel = (chg, v) => `<select data-chg="${chg}">${[...new Set([...ore, v])].sort().map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`;
  const scelta = (chg, v, L) => `<select data-chg="${chg}">${L.map(k => `<option value="${k}" ${k === v ? "selected" : ""}>${N[k][0]} ${esc(N[k][1])}</option>`).join("")}</select>`;
  /* il fotovoltaico compare solo se c'è (manca: lo dice «✨ Cosa puoi aggiungere»); uno stile già scelto resta visibile */
  const visibili = STILI.filter(k => disponibile(k) || k === s), diGiorno = SEMPLICI.filter(k => k !== "notte" && (disponibile(k) || k === giorno()));
  const sub = [["giorno", "🌤️ " + esc(N[giorno()][1])], ...(conSolare() ? [["solare", N.solare[0] + " " + esc(N.solare[1])]] : []), ["notte", "🌙 " + esc(N[notteStile()][1])]];
  if (s === "auto" && !sub.some(x => x[0] === ED.sub)) ED.sub = "giorno";
  return `<div class="sh-head"><div><h3>🌙 ${t("Salvaschermo", "Screensaver")}</h3><div class="small muted">${t("Scelte di questo dispositivo: gli altri tablet e telefoni non cambiano.", "Choices for this device: other tablets and phones don't change.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="sz1p"><div class="ssp1" data-keep data-act="ssProva" role="button" aria-label="${t("Prova a tutto schermo", "Try full screen")}"></div>
      <div class="row between"><span class="small muted">${t("Anteprima dal vivo", "Live preview")} · ${esc(N[vista]?.[1] || "")}</span><button class="btn sm pri" data-act="ssProva">▶ ${t("Prova a tutto schermo", "Try full screen")}</button></div></div>
    <div class="fl1">${t("Stile", "Style")}</div>
    <div class="sz1g">${visibili.map(k => `<button class="${k === s ? "act" : ""}" data-act="ssStile" data-v="${k}"><i class="sz1t t-${k}"></i><b>${N[k][0]} ${esc(N[k][1])}</b><small>${esc(N[k][2])}</small></button>`).join("")}</div>
    <div class="sz1o"><span>🎄 ${t("Automatico a Natale", "Automatic at Christmas")}</span>${seg("ssNatale", natAuto() ? "1" : "0", [["0", t("No", "No")], ["1", "🎄 " + t("Sì", "Yes")]])}</div>
    <p class="small muted">${t(`Nel periodo di festa (fino al ${dataTesto(fineFesta())}) mostro il salvaschermo di Natale al posto di questo; poi torna da solo. ${inPeriodo() ? "Adesso siamo nel periodo." : ""}`, `During the festive season (until ${dataTesto(fineFesta())}) I show the Christmas screensaver instead of this one; then it comes back by itself. ${inPeriodo() ? "We're in the season now." : ""}`)}${["auto", "alterna"].includes(s) ? " " + t("In Automatico e Alterna lo stile di Natale si usa solo nel periodo di festa.", "In Automatic and Rotate the Christmas style is only used during the festive season.") : ""}</p>
    ${s === "auto" ? `<div class="fl1">✨ ${t("Automatico", "Automatic")}</div>
      <div class="sz1o"><span>${t("Di giorno", "By day")}</span><div class="row sz1h">${scelta("ssGiornoSel", giorno(), diGiorno)}</div></div>
      ${giorno() === "foto" && !haFoto() ? `<div class="note1">${t("Scegli le foto qui sotto: finché mancano, di giorno mostro il cielo vivo.", "Choose the photos below: until then, by day I show the live sky.")}</div>` : ""}
      ${haSolare() ? `<div class="sz1o"><span>${t("Fotovoltaico", "Solar")}</span>${seg("ssSolAuto", solareAuto() ? "1" : "0", [["1", "☀️ " + t("Quando produce", "While it produces")], ["0", t("No", "No")]])}
        ${solareAuto() ? `<label class="row sz1h sz1w">${t("più di", "over")} <input type="number" min="1" step="50" value="${solareW()}" data-chg="ssSolW" inputmode="numeric"> W</label>` : ""}</div>
        <p class="small muted">${t("Di giorno, quando i pannelli producono più di questa potenza, compare il fotovoltaico in tempo reale; quando scendono torna lo stile del giorno.", "By day, when the panels produce more than this, the live solar view shows up; when they drop, the day style comes back.")}</p>` : ""}
      <div class="sz1o"><span>${t("Di notte", "At night")}</span><div class="row sz1h">${scelta("ssNotteSel", notteStile(), SEMPLICI.filter(k => disponibile(k) || k === notteStile()))} ${t("dalle", "from")} ${notteDa()} ${t("alle", "to")} ${notteA()}</div></div>
      <div class="sz1o"><span>${t("Opzioni di", "Options for")}</span>${seg("ssSub", ED.sub, sub)}</div>` : ""}
    <div class="fl1">${N[m][0]} ${esc(N[m][1])}</div>
    ${s === "foto" && !haFoto() ? `<div class="note1">${t("Scegli da dove prendere le foto: intanto mostro l'orologio.", "Choose where the photos come from: until then I show the clock.")}</div>` : ""}
    ${!disponibile(m) ? `<div class="note1">${m === "solare" ? t("Non trovo il fotovoltaico: intanto mostro l'orologio. Guarda «✨ Cosa puoi aggiungere» in Impostazioni.", "I can't find solar panels: until then I show the clock. See «✨ What you can add» in Settings.") : t("Qui manca quello che serve: intanto mostro l'orologio.", "What this needs is missing here: until then I show the clock.")}</div>` : ""}
    ${opzioni(m)}
    <div class="fl1">🌙 ${t("Notte", "Night")}</div>
    <div class="sz1o"><span>${t("Orario", "Hours")}</span><div class="row sz1h">${t("dalle", "from")} ${sel("ssNotteDa", notteDa())} ${t("alle", "to")} ${sel("ssNotteA", notteA())}</div></div>
    <p class="small muted">${t("In queste ore gli stili chiari si abbassano (si cambia in ogni stile, «Di notte»); in Automatico c'è lo stile della notte.", "During these hours bright styles are dimmed (change it in each style, «At night»); in Automatic the night style is used.")}</p>
    <div class="fl1">⏱️ ${t("Parte dopo", "Starts after")}</div>
    ${seg("ssMin", String(ssMin()), [["0", t("Spento", "Off")], ["1", "1 min"], ["5", "5 min"], ["10", "10 min"], ["30", "30 min"]])}
    <p class="small muted" style="margin-top:8px">${t("Senza tocchi per questo tempo. Si sveglia al primo tocco; non parte mentre guardi una telecamera.", "With no touches for this long. Wakes on the first touch; doesn't start while you watch a camera.")}</p>`;
}
/* anteprima nel foglio: si monta (e si rimonta quando cambia qualcosa) dopo ogni disegno */
let PV = null;
function anteprima() {
  const box = document.querySelector(".ssp1");
  if (!box) { if (PV) { PV.stop(); PV = null; } return; }
  const vista = vistaAnteprima();
  const chiave = JSON.stringify([vista, sGet("ssCfg"), fonte(), ssDir(), sGet("ssUrl"), sGet("ssLista"), attenua(), notteDa(), notteA(), sGet("ssNotteStile"), sGet("ssGiorno"), sGet("ssSolAuto"), sGet("ssSolW"), sGet("ssNatale")]);
  if (PV && PV.root === box && PV.chiave === chiave) return;
  PV?.stop(); PV = monta(box, vista, true); PV.chiave = chiave;
}
FISSI.push(anteprima);

/* ---------- scelta della cartella delle foto ---------- */
let dir = "media-source://media_source", elenco = null, daFoglio = false;
async function apri(id) {
  dir = id; elenco = null; render();
  try { elenco = await ws({ type: "media_source/browse_media", media_content_id: id }); } catch (e) { elenco = { title: t("Errore", "Error"), children: [], err: e.message || e.code }; }
  render();
}
function sfoglia() {
  const L = elenco?.children || [], cartelle = L.filter(c => c.can_expand), n = L.filter(c => c.media_class === "image" || /^image\//.test(c.media_content_type || "")).length;
  return `<div class="sh-head"><div><h3>🖼️ ${t("Cartella delle foto", "Photo folder")}</h3><div class="small muted">${t("Dai Media di Home Assistant (per esempio la cartella /media). Le foto si caricano da Impostazioni → Media.", "From Home Assistant's Media (e.g. the /media folder). Upload photos in Settings → Media.")}</div></div><button class="x" data-act="${daFoglio ? "ssCfg" : "sheetClose"}">×</button></div>
    <div class="row between" style="margin-bottom:8px"><b>${esc(elenco?.title || "…")}</b>${dir !== "media-source://media_source" ? `<button class="btn sm" data-act="ssSu">⬆ ${t("Su", "Up")}</button>` : ""}</div>
    ${!elenco ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : `<div class="stack">${cartelle.map(c => `<button class="li" data-act="ssApri" data-id="${esc(c.media_content_id)}"><span class="ic">📁</span><div class="tx"><b>${esc(c.title)}</b></div><span class="st">›</span></button>`).join("") || `<div class="small muted">${elenco.err ? esc(elenco.err) : t("Nessuna sottocartella.", "No subfolders.")}</div>`}</div>
      <button class="btn pri" data-act="ssScegli" style="margin-top:12px" ${n ? "" : "disabled"}>✅ ${t(`Usa questa cartella (${n} foto)`, `Use this folder (${n} photos)`)}</button>`}`;
}
const storia = [];
const toggle = (L, v) => L.includes(v) ? L.filter(x => x !== v) : [...L, v];
Object.assign(ACT, {
  ssMin: el => { sSet("ssMin", el.dataset.v); riarma(); render(); },
  ssStile: el => { sSet("ssStile", el.dataset.v); ED.sub = "giorno"; render(); },
  ssNatale: el => { sSet("ssNatale", el.dataset.v); render(); },
  ssProva: () => { setTimeout(() => mostra(true), 150); },
  ssCfg: () => { daFoglio = false; openSheet(foglio); },
  ssSub: el => { ED.sub = el.dataset.v; render(); },
  ssGiorno: el => { sSet("ssGiorno", el.dataset.v); render(); },
  ssVel: el => { setCfg(el.dataset.s, "vel", +el.dataset.v); render(); },
  ssEff: el => { setCfg(el.dataset.s, "eff", el.dataset.v); render(); },
  ssOpz: el => { const k = el.dataset.k, v = el.dataset.v; setCfg(el.dataset.s, k, k === "att" ? v === "1" : ["sec", "sf"].includes(k) ? v : +v); render(); },
  ssAlt: el => { const L = toggle(cfg("alterna").lista || [], el.dataset.v); if (!L.length) return toast(t("Lascia almeno uno stile", "Keep at least one style"), true); setCfg("alterna", "lista", SEMPLICI.filter(k => L.includes(k))); render(); },
  ssSolAuto: el => { sSet("ssSolAuto", el.dataset.v); if (el.dataset.v !== "1" && ED.sub === "solare") ED.sub = "giorno"; render(); },
  ssInfo: el => { const s = el.dataset.s, I = INFO_DI[s]; setCfg(s, "info", I.filter(k => toggle(cfg(s).info, el.dataset.v).includes(k))); render(); },
  ssFonte: el => { sSet("ssFonte", el.dataset.v); render(); },
  ssAtt: el => { sSet("ssAtt", el.dataset.v); render(); },
  ssDir: () => { daFoglio = UI.sheet === foglio; storia.length = 0; openSheet(sfoglia); apri("media-source://media_source"); },
  ssApri: el => { storia.push(dir); apri(el.dataset.id); },
  ssSu: () => apri(storia.pop() || "media-source://media_source"),
  ssScegli: () => { sSet("ssDir", dir); sSet("ssFonte", "media"); toast("🖼️ " + (elenco?.title || "")); if (daFoglio) openSheet(foglio); else closeSheet(); },
});
Object.assign(CHG, {
  ssUrl: el => { sSet("ssUrl", el.value.trim()); render(); },
  ssLista: el => { sSet("ssLista", el.value); render(); },
  ssNotteDa: el => { sSet("ssNotteDa", el.value); render(); },
  ssNotteA: el => { sSet("ssNotteA", el.value); render(); },
  ssGiornoSel: el => { if (SEMPLICI.includes(el.value)) sSet("ssGiorno", el.value); render(); },
  ssNotteSel: el => { if (SEMPLICI.includes(el.value)) sSet("ssNotteStile", el.value); render(); },
  ssSolW: el => { const v = Math.round(+el.value); if (v > 0) sSet("ssSolW", String(v)); render(); },
});

/* «✨ Cosa puoi aggiungere» (aggiungi.js): il salvaschermo del fotovoltaico, quando in casa i pannelli non ci sono (o non li trovo) */
AGGIUNGI.ssSolare = { title: () => t("Salvaschermo del fotovoltaico", "Solar screensaver"), icon: "☀️", tipo: () => t("Salvaschermo", "Screensaver"), ord: 15.5,
  richiede: {
    cosa: t("Sul tablet a muro, quando nessuno lo tocca: il sole, i pannelli, la casa, la batteria e la rete disegnati grandi, con i flussi che seguono i watt veri; sotto quanto hai prodotto oggi, l'autoconsumo e la batteria.", "On the wall tablet, when nobody touches it: the sun, panels, house, battery and grid drawn big, with flows that follow the real watts; below, what you made today, self-use and the battery."),
    serve: t("Un sensore della potenza del fotovoltaico (W o kW), meglio se nella configurazione Energia di Home Assistant.", "A solar power sensor (W or kW), ideally in Home Assistant's Energy configuration."),
    passi: [t("Collega l'inverter a Home Assistant (la sua integrazione: Fronius, SolarEdge, Huawei, ZCS, Victron…).", "Connect your inverter to Home Assistant (its integration: Fronius, SolarEdge, Huawei, ZCS, Victron…)."),
      t("Impostazioni → Plance → Energia: aggiungi la produzione solare.", "Settings → Dashboards → Energy: add solar production."),
      t("Oppure scegli tu il sensore: Energia → ✏️ Modifica → ⚙️ Sensori → Fotovoltaico.", "Or pick the sensor yourself: Energy → ✏️ Edit → ⚙️ Sensors → Solar.")],
    link: [[t("Configurazione Energia", "Energy configuration"), myHA("config_energy")]],
    quando: t("Quando c'è, lo trovi in ⚙️ Impostazioni → Questo dispositivo → Salvaschermo → 🎨 Personalizza.", "Once it's there, you'll find it in ⚙️ Settings → This device → Screensaver → 🎨 Customize."),
    anteprima: [["☀️", t("Fotovoltaico", "Solar"), t("prodotto oggi 14,2 kWh · autoconsumo 71%", "made today 14.2 kWh · self-use 71%"), "2,4 kW", 70]],
    manca: () => haSolare() === false,
  } };

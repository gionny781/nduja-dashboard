/* Formula 1: il prossimo Gran Premio (circuito, conto alla rovescia, orari di tutte le sessioni nell'ora di casa), il weekend
   in corso (sessione, bandiere e safety car, ordine in pista, direzione gara), le classifiche piloti e costruttori con il pilota
   e il team preferiti evidenziati, l'ultima gara con il podio.
   I dati vengono solo da Home Assistant: F1 Sensor (HACS), un calendario della F1 oppure Team Tracker (racing).
   Si trova tutto da solo; in ⚙️ Impostazioni (e con ✏️) si aggiungono fonti, si scelgono pilota e team preferiti.
   Il tracciato è l'immagine dell'integrazione; se manca, un circuito astratto disegnato per 'Nduja.
   In Home la scheda «Formula 1» (HOME_EXTRA). Facoltativa l'automazione «'Nduja · Formula 1»: «Tra 15 minuti partono…». */
import { S, REG, ACT, UI, LAYOUT, HOME_EXTRA, t, LOC, esc, nmHA, ok, card, page, render, isAdmin,
  openSheet, closeSheet, toast, cached, svcResp, ws, api, attr, etichettaNduja } from "../core.js";
import { scegli, cambia } from "../edit.js";

/* ================= valori ================= */
const A = id => (id && S[id]?.attributes) || {};
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const vuoto = v => v == null || v === "" || /^(n\/a|none|null|unknown|unavailable|tbd)$/i.test(String(v).trim());
const pulito = v => vuoto(v) ? "" : String(v).trim();
const data = v => { if (vuoto(v)) return null; const d = new Date(v); return isNaN(d) ? null : d; };
const hex = v => { const s = String(v || "").trim(); return /^#?[0-9a-f]{6}$/i.test(s) ? (s[0] === "#" ? s : "#" + s) : null; };
const C = () => LAYOUT.f1 || {};

/* ================= fonti ================= */
const isF1 = id => REG[id]?.platform === "f1_sensor" || /^(sensor|binary_sensor|calendar)\.f1_/.test(id);
/** calendari che dal nome sono della Formula 1 */
const CAL_F1 = /\bf1\b|formula ?(1|uno|one)\b|grand prix|gran premio/i;
const isCalF1 = id => id.startsWith("calendar.") && (isF1(id) || CAL_F1.test(id.split(".")[1].replace(/_/g, " ") + " " + nmHA(id)));
/** Team Tracker con lo sport «racing» (Formula 1) */
const isTT = id => id.startsWith("sensor.") && !!S[id] && (REG[id]?.platform === "teamtracker" || ("team_name" in A(id) && "kickoff_in" in A(id)));
const isTTF1 = id => isTT(id) && /racing/i.test(A(id).sport || A(id).sport_path || "") && /\bf1\b|formula/i.test((A(id).league || "") + " " + (A(id).league_name || "") + " " + (A(id).league_path || ""));
const fonteOk = id => isCalF1(id) || id.startsWith("calendar.") || isTT(id) || (id.startsWith("sensor.") && isF1(id));

let memoF = { k: "", F: null };
/** le entità della F1: prossima gara, classifiche, ultima gara, dati in diretta (F1 Sensor), calendari e Team Tracker */
function fonti() {
  /* ricontrollo ogni 30 secondi: un sensore che torna disponibile porta i suoi attributi senza cambiare il numero di entità */
  const c = C(), k = Object.keys(S).length + "|" + Object.keys(REG).length + "|" + JSON.stringify([c.extra, c.tolte]) + "|" + Math.floor(Date.now() / 3e4);
  if (memoF.k === k) return memoF.F;
  const ids = Object.keys(S).sort(), via = new Set(c.tolte || []), extra = (c.extra || []).filter(id => S[id]);
  const find = f => ids.find(id => !via.has(id) && f(id, A(id))) || null;
  const suf = (dom, s) => find(id => id.startsWith(dom + ".") && isF1(id) && id.endsWith(s));
  const sens = id => id.startsWith("sensor.");
  const F = {
    next: find((id, a) => sens(id) && !!a.race_name && ("qualifying_start" in a || "first_practice_start" in a || "race_start" in a) && !Array.isArray(a.results)),
    piloti: find((id, a) => sens(id) && Array.isArray(a.driver_standings)),
    costr: find((id, a) => sens(id) && Array.isArray(a.constructor_standings)),
    ultima: find((id, a) => sens(id) && Array.isArray(a.results) && !!a.race_name && !/sprint/.test(id)),
    lista: find((id, a) => sens(id) && Array.isArray(a.drivers) && !("current_qualifying_part" in a) && !/position/.test(id)),
    pos: suf("sensor", "driver_positions") || find((id, a) => sens(id) && Array.isArray(a.drivers) && "current_qualifying_part" in a),
    pista: suf("sensor", "track_status"), stato: suf("sensor", "session_status"), sess: suf("sensor", "current_session"),
    giro: suf("sensor", "race_lap_count"), sc: suf("binary_sensor", "safety_car"), rc: suf("sensor", "race_control"), resta: suf("sensor", "session_time_remaining"),
    top: [1, 2, 3].map(n => suf("sensor", "top_three_p" + n)).filter(Boolean),
  };
  F.cal = [...new Set([...ids.filter(id => isCalF1(id) && !via.has(id)), ...extra.filter(id => id.startsWith("calendar."))])];
  F.tt = [...new Set([...ids.filter(id => isTTF1(id) && !via.has(id)), ...extra.filter(isTT)])];
  F.trovato = !!(F.next || F.piloti || F.costr || F.ultima || F.stato || F.cal.length || F.tt.length);
  memoF = { k, F };
  return F;
}

/* ================= sessioni ================= */
const SESS = [["fp1", "first_practice"], ["fp2", "second_practice"], ["fp3", "third_practice"], ["sq", "sprint_qualifying"], ["s", "sprint"], ["q", "qualifying"], ["r", "race"]];
const DUR = { fp1: 60, fp2: 60, fp3: 60, sq: 45, s: 60, q: 60, r: 120 };
const NOMI = () => ({ fp1: t("Libere 1", "Practice 1"), fp2: t("Libere 2", "Practice 2"), fp3: t("Libere 3", "Practice 3"), sq: t("Qualifiche Sprint", "Sprint Qualifying"), s: "Sprint", q: t("Qualifiche", "Qualifying"), r: t("Gara", "Race") });
const ICS = { fp1: "⏱️", fp2: "⏱️", fp3: "⏱️", sq: "⚡", s: "⚡", q: "🎯", r: "🏁" };
/** che sessione è, dal nome («Practice 1», «Qualifiche», «Sprint Shootout», «Gara»…) */
function tipo(s) {
  s = norm(s); if (!s) return null;
  if (/sprint (quali|shootout)|qualifiche sprint|sprint qualifying/.test(s)) return "sq";
  if (/\bsprint\b/.test(s)) return "s";
  if (/quali/.test(s)) return "q";
  const p = s.match(/(?:practice|prove libere|libere|fp)\s*([123])/); if (p) return "fp" + p[1];
  if (/\brace\b|\bgara\b/.test(s)) return "r";
  return null;
}
const sessione = (k, inizio, fine) => ({ k, inizio, fine: fine && fine > inizio ? fine : new Date(inizio.getTime() + DUR[k] * 6e4) });

/** il Gran Premio da F1 Sensor (sensore «prossima gara») */
function gpSensore(id) {
  const a = A(id); if (!a.race_name) return null;
  const sessioni = SESS.map(([k, x]) => { const d = data(a[x + "_start"]) || data(a[x + "_start_utc"]); return d && sessione(k, d); }).filter(Boolean).sort((x, y) => x.inizio - y.inizio);
  if (!sessioni.length) { const d = data(S[id].state); if (d) sessioni.push(sessione("r", d)); }
  return { fonte: "f1", nome: pulito(a.race_name), round: pulito(a.round), stagione: pulito(a.season), circuito: pulito(a.circuit_name), citta: pulito(a.circuit_locality),
    paese: pulito(a.circuit_country), cc: pulito(a.country_code), bandiera: pulito(a.country_flag_url), mappa: pulito(a.circuit_outline_url) || pulito(a.circuit_map_url),
    tz: pulito(a.circuit_timezone), giri: pulito(a.scheduled_laps), sessioni };
}
/* calendari: «Mexico City Grand Prix - Practice 1», «F1: Gran Premio d'Italia - Gara», «GP del Messico» */
const eventiCal = ids => !ids.length ? [] : cached("f1:cal:" + ids.join(",") + ":" + new Date().toDateString(), 15 * 6e4, async () => {
  const r = await svcResp("calendar", "get_events", { start_date_time: new Date(Date.now() - 6 * 864e5).toISOString(), end_date_time: new Date(Date.now() + 150 * 864e5).toISOString() }, ids);
  return ids.flatMap(id => (r?.[id]?.events || []).map(ev => ({ ...ev, cal: id })));
}) || [];
function nomeGP(s) {
  const P = String(s || "").split(/\s+[-–—|]\s+|:\s+/).map(x => x.trim()).filter(Boolean);
  return P.find(p => /grand prix|gran premio|\bgp\b/i.test(p)) || P.find(p => !tipo(p) && !/^(f1|formula ?(1|uno|one))$/i.test(p)) || P[0] || "";
}
function gpCalendario(ids) {
  const G = [];
  for (const ev of eventiCal(ids)) {
    const allDay = String(ev.start).length <= 10, ini = allDay ? new Date(ev.start + "T12:00:00") : new Date(ev.start); if (isNaN(ini)) continue;
    const sm = String(ev.summary || ""), fin = allDay ? null : new Date(ev.end || ev.start), nome = nomeGP(sm), k = tipo(sm.replace(nome, "")) || tipo(sm) || "r";
    let g = G.find(x => norm(x.nome) === norm(nome) && Math.abs(x.sessioni[0].inizio - ini) < 5 * 864e5);
    if (!g) { const [circ, ...resto] = String(ev.location || "").split(",").map(x => x.trim()); g = { fonte: "cal", nome, circuito: circ || "", citta: resto.join(", "), sessioni: [], cal: ev.cal }; G.push(g); }
    if (!g.sessioni.some(s => s.k === k)) g.sessioni.push(sessione(k, ini, fin));
  }
  G.forEach(g => g.sessioni.sort((x, y) => x.inizio - y.inizio));
  return G.sort((x, y) => x.sessioni[0].inizio - y.sessioni[0].inizio).find(g => g.sessioni.at(-1).fine > Date.now() - 6 * 36e5) || null;
}
/** Team Tracker (racing): la prossima gara, e la posizione del pilota seguito durante la gara */
function gpTT(id) {
  const a = A(id), d = data(a.date); if (!d) return null;
  const pos = pulito(a.team_rank) || pulito(a.team_score);
  return { fonte: "tt", nome: pulito(a.event_name) || pulito(a.league_name) || "Formula 1", circuito: pulito(a.venue), citta: pulito(a.location), sessioni: [sessione("r", d)],
    tt: { stato: String(S[id].state || "").toUpperCase(), pilota: pulito(a.team_long_name) || pulito(a.team_name), pos: /^\d+$/.test(pos) ? pos : "", giro: pulito(a.clock) } };
}
const statoS = s => { const n = Date.now(); return n < s.inizio ? "pre" : n < s.fine ? "in" : "post"; };

/* ================= in pista (F1 Sensor, dati in diretta) ================= */
const valido = id => ok(id) && !/^unknown$/i.test(S[id].state);
function inPista(F) {
  const st = valido(F.stato) ? String(S[F.stato].state).toLowerCase() : null, nomeS = valido(F.sess) ? S[F.sess].state : "";
  let pista = valido(F.pista) ? String(S[F.pista].state).toUpperCase() : null;
  if (!pista && valido(F.sc) && S[F.sc].state === "on") pista = String(A(F.sc).track_status || "SC").toUpperCase();
  const attiva = ["live", "suspended", "break"].includes(st) || (!st && !!nomeS);
  const finita = ["finished", "finalised"].includes(st);
  const pa = F.pos && S[F.pos] && S[F.pos].state !== "unavailable" ? A(F.pos) : {};   // in qualifica lo stato è «unknown» ma l'ordine c'è
  const ordine = (Array.isArray(pa.drivers) ? pa.drivers : []).filter(d => d && !vuoto(d.current_position)).sort((x, y) => +x.current_position - +y.current_position);
  const top = F.top.filter(valido).map(id => ({ ...A(id), tla: S[id].state })).filter(x => !x.withheld).sort((x, y) => (x.position || 0) - (y.position || 0));
  const rc = valido(F.rc) ? { msg: S[F.rc].state, flag: pulito(A(F.rc).flag), cat: pulito(A(F.rc).category), storia: Array.isArray(A(F.rc).history) ? A(F.rc).history : [], quando: data(A(F.rc).utc) } : null;
  return { attiva, finita, stato: st, nome: nomeS, k: tipo(nomeS), pista, giro: valido(F.giro) ? S[F.giro].state : "", giri: pulito(A(F.giro).total_laps) || pulito(pa.total_laps),
    resta: valido(F.resta) ? S[F.resta].state : "", ordine, top, rc, qPart: pa.current_qualifying_part || null, veloce: pa.fastest_lap || null, meeting: pulito(A(F.stato).meeting_name) };
}

/* ================= tutto insieme ================= */
function dati() {
  const F = fonti();
  const gp = (F.next && gpSensore(F.next)) || (F.cal.length && gpCalendario(F.cal)) || F.tt.map(gpTT).filter(Boolean).sort((a, b) => a.sessioni[0].inizio - b.sessioni[0].inizio)[0] || null;
  const L = inPista(F);
  if (gp) gp.sessioni.forEach(s => { s.stato = statoS(s); if (L.attiva && L.k === s.k && s.inizio - Date.now() < 3 * 36e5) s.stato = "in"; });
  const ora = gp?.sessioni.find(s => s.stato === "in") || null, prossima = gp?.sessioni.find(s => s.stato === "pre") || null;
  return { F, gp, L, ora, prossima, live: L.attiva || (!!ora && gp?.fonte === "tt" && gp.tt.stato === "IN") };
}

/* ================= ora di casa ================= */
const tzCasa = () => { try { return parent.document.querySelector("home-assistant")?.hass?.config?.time_zone || undefined; } catch { return undefined; } };
const conTz = (d, o, tz = tzCasa()) => { try { return d.toLocaleString(LOC, { ...o, timeZone: tz }); } catch { return d.toLocaleString(LOC, o); } };
const ore = (d, tz) => conTz(d, { hour: "2-digit", minute: "2-digit" }, tz);
const chiaveG = d => conTz(d, { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\D/g, "");
function giorno(d, lungo) {
  const g0 = chiaveG, oggi = new Date(), dom = new Date(Date.now() + 864e5), ieri = new Date(Date.now() - 864e5), k = g0(d);
  if (k === g0(oggi)) return t("Oggi", "Today"); if (k === g0(dom)) return t("Domani", "Tomorrow"); if (k === g0(ieri)) return t("Ieri", "Yesterday");
  const x = conTz(d, lungo ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
  return lungo ? x.charAt(0).toUpperCase() + x.slice(1) : x;
}
function traQuanto(ms) {
  if (ms <= 0) return t("sta per iniziare", "about to start");
  const g = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return t("tra ", "in ") + (g ? `${g} ${t("g", "d")}${h ? ` ${h} h` : ""}` : h ? `${h} h${m ? ` ${m} min` : ""}` : `${Math.max(1, m)} min`);
}
function contoAllaRovescia(d) {
  const ms = d - Date.now();
  if (ms <= 0) return `<div class="fo1cd fo1cd0">⏱️ ${t("Sta per iniziare", "About to start")}</div>`;
  const g = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  const b = (v, u) => `<div><b>${String(v).padStart(2, "0")}</b><small>${u}</small></div>`;
  const pz = g ? [b(g, g === 1 ? t("giorno", "day") : t("giorni", "days")), b(h, t("ore", "hours")), b(m, "min")] : h ? [b(h, t("ore", "hours")), b(m, "min"), b(s, "sec")] : [b(m, "min"), b(s, "sec")];
  return `<div class="fo1cd" role="timer" aria-label="${esc(traQuanto(ms))}">${pz.join("")}</div>`;
}

/* ================= piloti, team, colori, preferiti ================= */
/** chiave del team uguale per tutte le fonti («Red Bull Racing» = «red_bull», «RB F1 Team» = «Racing Bulls»…) */
function tk(s) {
  let x = norm(s).replace(/\b(f1|team|racing|scuderia|formula (one|1)|motorsport|amg|petronas|bwt|visa|cash app|stake|kick|moneygram|aramco|mastercard|atlassian|hp)\b/g, " ").replace(/\s+/g, " ").trim();
  if (x === "rb" || x === "bulls" || x === "vcarb") x = "bulls";
  return x || norm(s);
}
const stessoTeam = (a, b) => { const x = tk(a), y = tk(b); return !!x && !!y && (x === y || (x.length > 3 && y.length > 3 && (x.startsWith(y) || y.startsWith(x)))); };
const PAL = ["#e8002d", "#ff8000", "#27f4d2", "#3671c6", "#229971", "#0093cc", "#64c4ff", "#b6babd", "#52e252", "#6692ff"];
const hash = s => [...norm(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
let memoL = { k: "", P: {}, T: [] };
/** piloti (per sigla) e colori dei team, dalla lista piloti e dall'ordine in pista */
function anagrafe(F) {
  const k = (F.lista ? S[F.lista]?.last_updated : "") + "|" + (F.pos ? S[F.pos]?.last_updated : "");
  if (memoL.k === k) return memoL;
  const P = {}, T = [];
  for (const d of [...(A(F.lista).drivers || []), ...(A(F.pos).drivers || [])]) {
    const tla = pulito(d.tla).toUpperCase(); if (!tla) continue;
    P[tla] = P[tla] || { tla, nome: pulito(d.first_name), cognome: pulito(d.last_name), team: pulito(d.team), col: hex(d.team_color), num: pulito(d.racing_number) };
    if (d.team && hex(d.team_color) && !T.some(x => stessoTeam(x[0], d.team))) T.push([d.team, hex(d.team_color)]);
  }
  memoL = { k, P, T };
  return memoL;
}
const coloreTeam = (F, team) => (team && anagrafe(F).T.find(x => stessoTeam(x[0], team))?.[1]) || (team ? PAL[hash(tk(team)) % PAL.length] : "#8e8e93");
const pilotaPref = () => C().pilota || null, teamPref = () => C().team || null;
const ePilota = (code, cognome) => { const p = pilotaPref(); return !!p && ((p.code && code && p.code === String(code).toUpperCase()) || (!!p.nome && !!cognome && norm(p.nome) === norm(cognome))); };
const eTeam = nome => { const p = teamPref(); return !!p && (stessoTeam(p.id, nome) || stessoTeam(p.nome, nome)); };

/* ================= disegni ================= */
const KO = new Set();
window.ndujaF1Ko = el => { KO.add(el.dataset.u); render(true); };
/** tracciato: l'immagine dell'integrazione, altrimenti un circuito astratto disegnato per 'Nduja (con un giro che scorre) */
function tracciato(gp) {
  const u = gp?.mappa && !KO.has(gp.mappa) ? gp.mappa : null;
  if (u) return `<img class="fo1img" src="${esc(u)}" alt="${esc(gp.circuito || "")}" loading="lazy" decoding="async" data-u="${esc(u)}" onerror="ndujaF1Ko(this)">`;
  const d = "M34 92C20 80 20 52 42 42L92 24C114 16 128 28 124 44C120 58 134 66 150 54C166 42 188 50 184 74C180 96 154 104 124 102L60 106C48 107 41 99 34 92Z";
  return `<svg class="fo1trk" viewBox="0 0 210 130" role="img" aria-label="${t("Circuito (illustrazione)", "Circuit (illustration)")}">
    <path class="asf" d="${d}"/><path class="lin" d="${d}"/><path class="run" d="${d}" pathLength="400"/>
    <g class="via" transform="translate(70 104.5) rotate(-3)">${[0, 1, 2, 3].map(i => `<rect x="${i * 2.6}" y="${i % 2 ? 0 : 2.6}" width="2.6" height="2.6"/><rect x="${i * 2.6}" y="${i % 2 ? 2.6 : 0}" width="2.6" height="2.6" class="b"/>`).join("")}</g>
    <circle class="cv" cx="124" cy="44" r="2.2"/><circle class="cv" cx="184" cy="74" r="2.2"/></svg>`;
}
const bandieraImg = gp => gp?.bandiera && !KO.has(gp.bandiera) ? `<img class="fo1fg" src="${esc(gp.bandiera)}" alt="" loading="lazy" data-u="${esc(gp.bandiera)}" onerror="ndujaF1Ko(this)">` : "";
/* bandiere della pista (disegnate) */
const PISTA = () => ({ CLEAR: ["verde", t("Pista libera", "Track clear")], GREEN: ["verde", t("Pista libera", "Track clear")], YELLOW: ["gialla", t("Bandiera gialla", "Yellow flag")],
  DOUBLE_YELLOW: ["gialla", t("Doppia gialla", "Double yellow")], VSC: ["vsc", "Virtual Safety Car"], SC: ["sc", "Safety Car"], RED: ["rossa", t("Bandiera rossa", "Red flag")] });
function bandiera(k) {
  if (k === "sc" || k === "vsc") return `<span class="fo1sc ${k}" aria-hidden="true"><i></i>${k === "sc" ? "SC" : "VSC"}<i></i></span>`;
  const tela = k === "scacchi" ? `<g clip-path="url(#fo1clip)">${[0, 1, 2, 3, 4, 5].map(c => [0, 1, 2].map(r => (c + r) % 2 ? "" : `<rect x="${6 + c * 5.4}" y="${2 + r * 5.6}" width="5.4" height="5.6" fill="#111"/>`).join("")).join("")}</g>` : "";
  return `<svg class="fo1fl ${k}" viewBox="0 0 40 30" aria-hidden="true"><defs><clipPath id="fo1clip"><path d="M6 3c6-3 11 3 17 0s9-2 13 0v14c-4-2-7-3-13 0s-11-3-17 0z"/></clipPath></defs>
    <path class="asta" d="M5 2v27"/><g class="tela"><path class="tl" d="M6 3c6-3 11 3 17 0s9-2 13 0v14c-4-2-7-3-13 0s-11-3-17 0z"/>${tela}</g></svg>`;
}
function statoPista(L) {
  if (L.finita || (L.stato === "ended")) return ["scacchi", t("Sessione finita", "Session over")];
  if (L.stato === "suspended") return ["rossa", t("Sessione sospesa", "Session suspended")];
  if (L.pista && PISTA()[L.pista]) return PISTA()[L.pista];
  return L.stato === "break" ? ["", t("Pausa tra le manche", "Break between parts")] : null;
}

/* ================= pagina ================= */
const V = { tutti: {} };
function eroe(D) {
  const { gp, L, ora, prossima } = D, F = D.F;
  const testa = `<div class="ch"><h2>🏎️ Formula 1${D.live ? ` <span class="fo1lv">LIVE</span>` : ""}</h2><span class="grow"></span>
    ${isAdmin() ? `<button class="btn sm" data-act="f1Notif" title="${t("Avvisi sul telefono", "Phone alerts")}">📱</button>` : ""}${isAdmin() && UI.edit ? `<button class="btn sm" data-act="f1Edit">✏️</button>` : ""}</div>`;
  const col = teamPref() ? coloreTeam(F, teamPref().nome || teamPref().id) : "#e10600";
  if (!gp) return `<section class="card span3 fo1h" style="--foc:${col}">${testa}<div class="fo1vuoto"><span>🗓️</span><div><b>${t("Nessun Gran Premio in programma", "No Grand Prix scheduled")}</b><small>${t("Appena l'integrazione pubblica il prossimo, compare qui.", "As soon as the integration publishes the next one, it shows up here.")}</small></div></div></section>`;
  const N = NOMI(), cur = ora || (L.attiva ? { k: L.k, fine: null } : null), fin = !cur && !prossima;
  const et = cur ? `<span class="fo1now"><i></i>${t("In corso", "Live now")} · ${esc(N[cur.k] || L.nome || "")}</span>` : prossima ? (prossima.k === "r" ? `<b>${t("Partenza della gara", "Race start")}</b>` : `${t("Prossima sessione", "Next session")} · <b>${esc(N[prossima.k])}</b>`) : t("Weekend finito", "Weekend over");
  const sp = L.attiva ? statoPista(L) : null;
  let corpo;
  if (cur) corpo = `<div class="fo1lvb">${sp ? `<span class="fo1ps ${sp[0]}">${sp[0] ? bandiera(sp[0]) : ""}${esc(sp[1])}</span>` : ""}
      ${L.giro ? `<span class="fo1chip">🔁 ${t("Giro", "Lap")} <b>${esc(L.giro)}</b>${L.giri ? ` / ${esc(L.giri)}` : ""}</span>` : ""}${L.resta && L.k !== "r" ? `<span class="fo1chip">⏳ <b>${esc(L.resta)}</b></span>` : ""}
      ${gp.tt?.stato === "IN" && gp.tt.pos ? `<span class="fo1chip">🏎️ ${esc(gp.tt.pilota)} <b>P${esc(gp.tt.pos)}</b></span>` : ""}
      ${!L.attiva && cur.fine && gp.fonte !== "tt" ? `<span class="fo1chip">${t("Fino alle", "Until")} ${esc(ore(cur.fine))}</span>` : ""}</div>${L.attiva ? podioLive(D) : ""}`;
  else if (prossima) corpo = contoAllaRovescia(prossima.inizio);
  else corpo = `<div class="fo1fin">${bandiera("scacchi")}<span>${t("Le sessioni di questo weekend sono finite.", "This weekend's sessions are over.")}</span></div>`;
  const sx = ora || prossima, gara = gp.sessioni.find(s => s.k === "r" && s !== sx && s.stato === "pre"), inPistaOra = gp.tz ? ore(new Date(), gp.tz) : "";
  const inf = [sx && ["📅", `${giorno(sx.inizio)} · ${ore(sx.inizio)}`], gara && ["🏁", `${t("Gara", "Race")} · ${giorno(gara.inizio)} · ${ore(gara.inizio)}`], inPistaOra && ["🕐", t("in pista sono le ", "track time ") + inPistaOra], gp.giri && ["🔁", gp.giri + " " + t("giri", "laps")]].filter(Boolean);
  return `<section class="card span2 fo1h ${D.live ? "live" : ""}" style="--foc:${col}"><svg class="fo1sp" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 150 410 40M-10 175 410 65M-10 200 410 90"/></svg>${testa}
    <div class="fo1top"><div class="fo1gp">
      <div class="fo1rd">${bandieraImg(gp)}${[gp.round && t("Round ", "Round ") + esc(gp.round), esc(gp.stagione || "")].filter(Boolean).join(" · ") || "Formula 1"}</div>
      <h3 class="fo1nm">${esc(gp.nome)}</h3>
      ${gp.circuito || gp.citta ? `<div class="fo1ci">${esc([gp.circuito, [gp.citta, gp.paese].filter(Boolean).join(", ")].filter(Boolean).join(" · "))}</div>` : ""}
      <div class="fo1lb ${fin ? "fin" : ""}">${et}</div>${corpo}
      ${inf.length ? `<div class="fo1inf">${inf.map(([i, x]) => `<span><em>${i}</em>${esc(x)}</span>`).join("")}</div>` : ""}
    </div><div class="fo1map">${tracciato(gp)}</div></div></section>`;
}
/** i primi tre in pista (nell'eroe) */
function podioLive(D) {
  const L = D.L, F = D.F, a = anagrafe(F).P;
  const P = (L.ordine.length ? L.ordine.slice(0, 3).map(d => ({ tla: d.tla, cognome: d.last_name || a[d.tla]?.cognome || "", team: d.team, col: hex(d.team_color) })) : L.top.map(x => ({ tla: x.tla, cognome: x.last_name, team: x.team, col: hex(x.team_color) }))).filter(x => x.tla);
  if (!P.length) return "";
  return `<div class="fo1p3">${P.map((x, i) => `<span class="${ePilota(x.tla, x.cognome) ? "pref" : ""}" style="--tc:${x.col || coloreTeam(F, x.team)}"><em>${i + 1}</em><b>${esc(x.tla)}</b><small>${esc(x.cognome)}</small></span>`).join("")}</div>`;
}
function programma(D) {
  const gp = D.gp; if (!gp) return "";
  const N = NOMI(), tz = tzCasa();
  const righe = gp.sessioni.map(s => {
    const nx = s === D.prossima, st = s.stato === "in" ? `<span class="st in"><i></i>${t("In corso", "Live")}</span>` : s.stato === "post" ? `<span class="st ok">✓</span>` : nx ? `<span class="st nx">${esc(traQuanto(s.inizio - Date.now()))}</span>` : "";
    return `<div class="fo1se ${s.stato} ${nx ? "nx" : ""}"><span class="d"><small>${esc(conTz(s.inizio, { weekday: "short" }, tz))}</small><b>${esc(conTz(s.inizio, { day: "numeric" }, tz))}</b></span>
      <div class="tx"><b>${ICS[s.k]} ${esc(N[s.k])}</b><small>${esc(ore(s.inizio))}${gp.fonte !== "tt" ? " – " + esc(ore(s.fine)) : ""}</small></div>${st}</div>`;
  }).join("");
  return card("📅 " + t("Programma del weekend", "Weekend schedule"), `<div class="fo1ses">${righe}</div><p class="small muted fo1tz">${t("Orari nell'ora di casa", "Times in your home time zone")}</p>`, { cls: "fo1pr" });
}
/* ---------- weekend in corso: ordine in pista ---------- */
const giroT = v => pulito(v);
function rigaPista(D, d, i, gara) {
  const a = anagrafe(D.F).P[d.tla] || {}, col = hex(d.team_color) || coloreTeam(D.F, d.team), pref = ePilota(d.tla, d.last_name || a.cognome), tpref = eTeam(d.team);
  const fuori = (D.L.qPart === 2 && d.q1_knocked_out) || (D.L.qPart === 3 && (d.q1_knocked_out || d.q2_knocked_out));
  const stato = d.retired ? `<em class="tg rit">${t("RIT", "OUT")}</em>` : d.stopped ? `<em class="tg rit">${t("FERMO", "STOP")}</em>` : d.in_pit || d.status === "pit_in" ? `<em class="tg pit">PIT</em>` : d.status === "pit_out" ? `<em class="tg out">${t("USCITA", "OUT LAP")}</em>` : "";
  const tempo = gara ? (i === 0 ? (giroT(d.completed_laps) ? t("Giro ", "Lap ") + d.completed_laps : t("Leader", "Leader")) : pulito(d.gap_to_leader) || pulito(d.interval_to_position_ahead)) : pulito(d.best_lap_time) || "—";
  const dist = !gara && i > 0 && d.best_lap_time_secs && D.L.ordine[0]?.best_lap_time_secs ? "+" + (d.best_lap_time_secs - D.L.ordine[0].best_lap_time_secs).toFixed(3) : gara && i > 0 && pulito(d.interval_to_position_ahead) && pulito(d.interval_to_position_ahead) !== pulito(d.gap_to_leader) ? pulito(d.interval_to_position_ahead) : "";
  return `<div class="fo1or ${pref ? "pref" : ""} ${tpref ? "tpref" : ""} ${fuori || d.retired ? "ko" : ""}" style="--tc:${col}"><span class="p">${esc(d.current_position)}</span><i class="tb"></i>
    <span class="nm"><b>${esc(d.tla || "")}</b><small>${esc(d.last_name || a.cognome || d.name || "")}${d.fastest_lap ? ` <em class="fl">⏱</em>` : ""}</small></span>
    <span class="tm">${esc(d.team || "")}</span>${stato}<span class="gp"><b>${esc(tempo)}</b>${dist ? `<small>${esc(dist)}</small>` : ""}</span></div>`;
}
function weekendCard(D) {
  const L = D.L; if (!L.attiva && !(L.finita && L.ordine.length)) return "";
  const N = NOMI(), sp = statoPista(L), gara = L.k === "r" || L.k === "s";
  const tutti = V.tutti.pista, base = L.ordine.slice(0, 10), extra = L.ordine.filter((d, i) => i >= 10 && ePilota(d.tla, d.last_name)), R = tutti ? L.ordine : [...base, ...extra];
  const titolo = `🔴 ${t("In pista", "On track")} <span class="muted">${esc(N[L.k] || L.nome || "")}${L.qPart ? " · Q" + esc(L.qPart) : ""}</span>`;
  const testa = `<div class="fo1wk">${sp ? `<div class="fo1ban ${sp[0]}">${sp[0] ? bandiera(sp[0]) : ""}<b>${esc(sp[1])}</b></div>` : ""}
    ${L.giro ? `<div class="fo1kv"><small>${t("Giro", "Lap")}</small><b>${esc(L.giro)}${L.giri ? `<span>/${esc(L.giri)}</span>` : ""}</b></div>` : ""}
    ${L.resta ? `<div class="fo1kv"><small>${t("Tempo che manca", "Time left")}</small><b>${esc(L.resta)}</b></div>` : ""}
    ${L.veloce?.tla ? `<div class="fo1kv"><small>⏱ ${t("Giro veloce", "Fastest lap")}</small><b>${esc(L.veloce.tla)} <span>${esc(L.veloce.time || "")}</span></b></div>` : ""}</div>`;
  const ord = R.length ? `<div class="fo1ord">${R.map(d => rigaPista(D, d, L.ordine.indexOf(d), gara)).join("")}</div>
    ${L.ordine.length > 10 ? `<button class="btn sm ghost fo1mo" data-act="f1Tutti" data-k="pista">${tutti ? t("Mostra meno", "Show less") : t("Mostra tutti", "Show all") + ` (${L.ordine.length})`}</button>` : ""}`
    : L.top.length ? `<div class="fo1ord">${L.top.map((x, i) => rigaPista(D, { ...x, current_position: x.position || i + 1, best_lap_time: x.lap_time }, i, false)).join("")}</div>` : `<div class="small muted">${t("L'ordine in pista compare appena l'integrazione lo manda.", "The running order shows up as soon as the integration sends it.")}</div>`;
  const rc = L.rc ? `<div class="fo1rc"><div class="fl1">📣 ${t("Direzione gara", "Race control")}</div>${[{ message: L.rc.msg, utc: L.rc.quando, flag: L.rc.flag }, ...L.rc.storia.filter(h => h.message && h.message !== L.rc.msg)].slice(0, 3)
    .map(h => `<div class="fo1rm ${esc(norm(h.flag).replace(/ /g, "_"))}">${h.utc ? `<small>${esc(ore(new Date(h.utc)))}</small>` : ""}<span>${esc(h.message)}</span></div>`).join("")}</div>` : "";
  return card(titolo, testa + ord + rc, { cls: "span3 fo1live" });
}
/* ---------- classifiche ---------- */
function stella(tipo, id, nome, on) {
  if (!(isAdmin() && UI.edit)) return on ? `<em class="fo1st">⭐</em>` : "";
  return `<button class="fo1sb ${on ? "on" : ""}" data-act="f1Pref" data-t="${tipo}" data-id="${esc(id)}" data-n="${esc(nome)}" title="${t("Preferito", "Favourite")}">${on ? "⭐" : "☆"}</button>`;
}
function pilotiCard(D) {
  const F = D.F, R = A(F.piloti).driver_standings; if (!Array.isArray(R) || !R.length) return "";
  const a = anagrafe(F).P, max = Math.max(1, +R[0].points || 0), tutti = V.tutti.piloti;
  const righe = R.map((r, i) => {
    const d = r.Driver || {}, code = pulito(d.code).toUpperCase(), team = a[code]?.team || (r.Constructors || []).at(-1)?.name || "", pref = ePilota(code, d.familyName);
    return { i, pref, html: `<div class="fo1cr ${pref ? "pref" : ""} ${eTeam(team) ? "tpref" : ""}" style="--tc:${coloreTeam(F, team)};--pc:${Math.round(100 * (+r.points || 0) / max)}%"><span class="p">${esc(r.position || i + 1)}</span><i class="tb"></i>
      <span class="nm"><b>${esc([pulito(d.givenName).slice(0, 1) && pulito(d.givenName).slice(0, 1) + ".", pulito(d.familyName)].filter(Boolean).join(" ") || code)}</b><small>${esc(team)}${+r.wins ? ` · ${esc(r.wins)} ${+r.wins === 1 ? t("vittoria", "win") : t("vittorie", "wins")}` : ""}</small></span>
      ${stella("p", code, pulito(d.familyName), pref)}<span class="pt"><b>${esc(r.points)}</b><i></i></span></div>` };
  });
  const L = tutti ? righe : righe.filter(r => r.i < 10 || r.pref);
  return card("🏆 " + t("Piloti", "Drivers") + ` <span class="muted">${esc(A(F.piloti).season || "")}</span>`, `<div class="fo1cl">${L.map(r => r.html).join("")}</div>
    ${righe.length > 10 ? `<button class="btn sm ghost fo1mo" data-act="f1Tutti" data-k="piloti">${tutti ? t("Mostra meno", "Show less") : t("Mostra tutti", "Show all") + ` (${righe.length})`}</button>` : ""}`, { cls: "fo1cc" });
}
function costruttoriCard(D) {
  const F = D.F, R = A(F.costr).constructor_standings; if (!Array.isArray(R) || !R.length) return "";
  const max = Math.max(1, +R[0].points || 0);
  return card("🛠️ " + t("Costruttori", "Constructors") + ` <span class="muted">${esc(A(F.costr).season || "")}</span>`, `<div class="fo1cl">${R.map((r, i) => {
    const c = r.Constructor || {}, nome = pulito(c.name) || pulito(c.constructorId), pref = eTeam(nome) || eTeam(c.constructorId);
    return `<div class="fo1cr ${pref ? "tpref" : ""}" style="--tc:${coloreTeam(F, nome)};--pc:${Math.round(100 * (+r.points || 0) / max)}%"><span class="p">${esc(r.position || i + 1)}</span><i class="tb"></i>
      <span class="nm"><b>${esc(nome)}</b>${+r.wins ? `<small>${esc(r.wins)} ${+r.wins === 1 ? t("vittoria", "win") : t("vittorie", "wins")}</small>` : ""}</span>${stella("t", c.constructorId || nome, nome, pref)}<span class="pt"><b>${esc(r.points)}</b><i></i></span></div>`;
  }).join("")}</div>`, { cls: "fo1cc" });
}
/* ---------- ultima gara ---------- */
function ultimaCard(D) {
  const F = D.F, a = A(F.ultima), R = Array.isArray(a.results) ? [...a.results].sort((x, y) => (+x.position || 99) - (+y.position || 99)) : []; if (!R.length) return "";
  const an = anagrafe(F).P, quando = data(a.race_start) || data(a.race_start_utc), tutti = V.tutti.ultima;
  const info = r => { const d = r.driver || r.Driver || {}, code = pulito(d.code).toUpperCase(), team = pulito((r.constructor || r.Constructor || {}).name);
    return { code, cognome: pulito(d.familyName) || an[code]?.cognome || code, nome: pulito(d.givenName), team, col: coloreTeam(F, team || an[code]?.team), pref: ePilota(code, d.familyName) }; };
  const podio = [2, 1, 3].map(p => { const r = R[p - 1]; if (!r) return ""; const x = info(r);
    return `<div class="fo1pp p${p} ${x.pref ? "pref" : ""}" style="--tc:${x.col}"><b class="tla">${esc(x.code || "?")}</b><span class="cg">${esc(x.cognome)}</span><small>${esc(x.team)}</small>
      <div class="blk"><em>${p}</em><small>${esc(pulito(r.time) || pulito(r.status))}</small></div></div>`; }).join("");
  const resto = R.slice(3).map(r => ({ r, x: info(r) })), L = tutti ? resto : resto.filter(({ x }, i) => i < 7 || x.pref);
  const fin = r => /finish|lapped|^\+\d+ lap/i.test(pulito(r.status)) || !pulito(r.status);
  return card(`🏁 ${t("Ultima gara", "Last race")} <span class="muted">${esc(pulito(a.race_name))}</span>`, `${quando ? `<div class="small muted fo1ud">${esc(giorno(quando, true))}${a.circuit_name ? " · " + esc(a.circuit_name) : ""}</div>` : ""}
    <div class="fo1pd">${podio}</div>
    <div class="fo1cl fo1rs">${L.map(({ r, x }) => `<div class="fo1cr ${x.pref ? "pref" : ""} ${eTeam(x.team) ? "tpref" : ""} ${fin(r) ? "" : "ko"}" style="--tc:${x.col}"><span class="p">${esc(r.position)}</span><i class="tb"></i>
      <span class="nm"><b>${esc(x.cognome)}</b><small>${esc(x.team)}</small></span><span class="tt">${esc(fin(r) ? pulito(r.time) || pulito(r.status) : t("Ritirato", "Retired"))}</span><span class="pt"><b>${+r.points ? "+" + esc(r.points) : ""}</b></span></div>`).join("")}</div>
    ${resto.length > 7 ? `<button class="btn sm ghost fo1mo" data-act="f1Tutti" data-k="ultima">${tutti ? t("Mostra meno", "Show less") : t("Tutti i risultati", "All results") + ` (${R.length})`}</button>` : ""}`, { cls: "fo1uc" });
}
const fonteTesto = F => [(F.next || F.piloti || F.stato) && "F1 Sensor", F.cal.length && !F.next && t("calendario", "calendar"), F.tt.length && "Team Tracker"].filter(Boolean).join(" · ");
function pagina() {
  const D = dati();
  if (!D.F.trovato) return `<div class="g g3">${card("🏎️ Formula 1", spiegazione(), { cls: "span3" })}</div>`;
  const pref = [pilotaPref() && "⭐ " + esc(pilotaPref().nome || pilotaPref().code), teamPref() && "⭐ " + esc(teamPref().nome)].filter(Boolean);
  return `<div class="g g3">${eroe(D)}${programma(D)}${weekendCard(D)}${pilotiCard(D)}${costruttoriCard(D)}${ultimaCard(D)}
    ${UI.edit && isAdmin() ? `<section class="card span3"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-act="f1Edit">⚙️ ${t("Fonti e preferiti", "Sources and favourites")}</button><button class="add1" data-act="f1Add"><span>＋</span>${t("Aggiungi una fonte", "Add a source")}</button></div>
      <p class="small muted" style="margin-top:10px">${t("Tocca ☆ nelle classifiche per scegliere il pilota e il team preferiti.", "Tap ☆ in the standings to pick your favourite driver and team.")}</p></section>` : ""}
    <p class="small muted fo1src span3">${pref.length ? pref.join(" · ") + " · " : ""}${t("Dati da ", "Data from ")}${esc(fonteTesto(D.F))}</p></div>`;
}
/* spiegazione quando non c'è niente */
const DOC = "https://github.com/Nicxe/f1_sensor";
function spiegazione(bottone = true) {
  return `<div class="fo1no"><span class="fo1noi">🏎️</span><div><b>${t("Installa F1 Sensor da HACS", "Install F1 Sensor from HACS")}</b>
    <p>${t("La plancia mostra il prossimo Gran Premio con gli orari di tutte le sessioni, la sessione in corso con bandiere e ordine in pista, le classifiche e l'ultima gara. F1 Sensor è gratuito: in HACS cercalo, scaricalo, riavvia Home Assistant e aggiungi l'integrazione «F1 Sensor» (per la diretta attiva anche i dati live). Va bene anche un calendario con le gare (per esempio quello di F1 Sensor o uno di Google) o Team Tracker con lo sport «racing» e il campionato F1.",
      "The dashboard shows the next Grand Prix with every session time, the live session with flags and running order, the standings and the last race. F1 Sensor is free: search it in HACS, download it, restart Home Assistant and add the «F1 Sensor» integration (turn on live data for the live part). A calendar with the races (for example F1 Sensor's or a Google one) or Team Tracker with the «racing» sport and the F1 league work too.")}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn sm pri" href="${DOC}" target="_blank" rel="noopener">📖 ${t("Guida di F1 Sensor", "F1 Sensor guide")}</a>${isAdmin() && bottone ? `<button class="btn sm" data-act="f1Add">📅 ${t("Scegli un calendario o un sensore", "Pick a calendar or a sensor")}</button>` : ""}</div></div></div>`;
}

/* ================= Home ================= */
function homeCard() {
  const D = dati(); if (!D.F.trovato) return "";
  const { gp, L, ora, prossima } = D, N = NOMI(), link = { link: ["F1", "formula1"] };
  if (!gp && !L.attiva) {
    const R = A(D.F.ultima).results, w = Array.isArray(R) ? R.find(r => +r.position === 1) : null;
    return card("🏎️ Formula 1", w ? `<button class="fo1hr" data-act="go" data-id="formula1"><span class="fo1hi">🏁</span><span class="tx"><b>${esc(pulito(A(D.F.ultima).race_name))}</b><small>${t("Ha vinto ", "Won by ")}${esc(pulito((w.driver || {}).familyName) || pulito((w.driver || {}).code))}</small></span><span class="st">›</span></button>`
      : `<div class="small muted">${t("Nessun Gran Premio in programma.", "No Grand Prix scheduled.")}</div>`, link);
  }
  if (L.attiva || ora) {
    const sp = L.attiva ? statoPista(L) : null, P = (L.ordine.length ? L.ordine.slice(0, 3).map(d => d.tla) : L.top.map(x => x.tla)).filter(Boolean);
    const k = L.k || ora?.k;
    return card("🏎️ Formula 1", `<button class="fo1hr live" data-act="go" data-id="formula1"><span class="fo1hi">${sp?.[0] ? bandiera(sp[0]) : "🏎️"}</span><span class="tx">
      <b>${esc(N[k] || L.nome || "")}${L.qPart ? " · Q" + esc(L.qPart) : ""} · ${esc(gp?.nome || L.meeting || "")}</b>
      <small><em class="lv">● ${t("In corso", "Live")}</em>${sp ? " · " + esc(sp[1]) : ""}${L.giro ? ` · ${t("giro", "lap")} ${esc(L.giro)}${L.giri ? "/" + esc(L.giri) : ""}` : ""}</small>${P.length ? `<small class="p3">${P.map((x, i) => `<em>${i + 1}</em> ${esc(x)}`).join(" ")}</small>` : ""}</span><span class="st">›</span></button>`, link);
  }
  if (!prossima) return card("🏎️ Formula 1", `<div class="small muted">${esc(gp.nome)} · ${t("weekend finito", "weekend over")}</div>`, link);
  const gara = gp.sessioni.find(s => s.k === "r" && s !== prossima && s.stato === "pre");
  return card("🏎️ Formula 1", `<button class="fo1hr" data-act="go" data-id="formula1"><span class="fo1hi">${bandieraImg(gp) || ICS[prossima.k]}</span><span class="tx"><b>${esc(gp.nome)}</b>
    <small><strong>${esc(N[prossima.k])}</strong> · ${esc(giorno(prossima.inizio))} ${esc(ore(prossima.inizio))} · ${esc(traQuanto(prossima.inizio - Date.now()))}</small>
    ${gara ? `<small>🏁 ${t("Gara", "Race")} · ${esc(giorno(gara.inizio))} ${esc(ore(gara.inizio))}</small>` : ""}</span><span class="st">›</span></button>`, link);
}
HOME_EXTRA.formula1 = { title: () => "Formula 1", render: homeCard, show: () => fonti().trovato };

/* conto alla rovescia ai secondi nell'ultima ora */
setInterval(() => {
  if (UI.page !== "formula1" || UI.sheet || document.hidden) return;
  try { const D = dati(); if (D.prossima && D.prossima.inizio - Date.now() < 36e5) render(); } catch {}
}, 1000);

/* ================= ⚙️ fonti e preferiti ================= */
const salva = (fn, msg) => cambia(l => { l.f1 = JSON.parse(JSON.stringify(l.f1 || {})); fn(l.f1); }, msg);
function nomeFonte(id) { return id.startsWith("calendar.") ? t("Calendario", "Calendar") : isTT(id) ? "Team Tracker" : "F1 Sensor"; }
function schedaFonti() {
  const F = fonti(), c = C(), D = dati();
  const auto = [F.next, F.piloti, F.costr, F.ultima, F.stato].filter(Boolean), altre = [...F.cal, ...F.tt];
  const an = anagrafe(F).P, piloti = (A(F.piloti).driver_standings || []).map(r => [pulito(r.Driver?.code).toUpperCase(), pulito(r.Driver?.familyName), [pulito(r.Driver?.givenName), pulito(r.Driver?.familyName)].join(" ")]);
  if (!piloti.length) Object.values(an).forEach(p => piloti.push([p.tla, p.cognome, p.nome + " " + p.cognome]));
  const team = (A(F.costr).constructor_standings || []).map(r => [pulito(r.Constructor?.constructorId), pulito(r.Constructor?.name)]);
  if (!team.length) anagrafe(F).T.forEach(([n]) => team.push([n, n]));
  const pp = pilotaPref(), tp = teamPref();
  return `<div class="sh-head"><div><h3>🏎️ Formula 1</h3><div class="small muted">${t("Da dove prendo i dati e chi tifi. Valgono per tutta la casa.", "Where the data comes from and who you support. They apply to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${auto.length ? `<div class="fl1">F1 Sensor</div><div class="stack">${auto.map(id => `<button class="li" data-act="more" data-id="${esc(id)}"><span class="ic">📡</span><div class="tx"><b>${esc(nmHA(id))}</b><span>${esc(id)}</span></div><span class="st">›</span></button>`).join("")}</div>` : ""}
    ${altre.length ? `<div class="fl1">${t("Altre fonti", "Other sources")}</div><div class="stack">${altre.map(id => `<div class="li"><span class="ic">${id.startsWith("calendar.") ? "📅" : "📡"}</span><div class="tx"><b>${esc(nmHA(id))}</b><span>${esc(nomeFonte(id))} · ${esc(id)}</span></div><button class="btn sm" data-act="f1Togli" data-id="${esc(id)}">✕</button></div>`).join("")}</div>` : ""}
    ${!F.next && !F.piloti ? `<div class="fo1nt">${spiegazione(false)}</div>` : ""}
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" data-act="f1Add">＋ ${t("Aggiungi una fonte", "Add a source")}</button>${D.gp || F.cal.length || F.tt.length ? `<button class="btn" data-act="f1Notif">📱 ${t("Avvisi sul telefono", "Phone alerts")}</button>` : ""}</div>
    ${(c.tolte || []).length ? `<div class="fl1">${t("Tolte", "Removed")}</div><div class="stack">${c.tolte.map(id => `<div class="li"><span class="ic">🙈</span><div class="tx"><b>${esc(S[id] ? nmHA(id) : id)}</b><span>${esc(id)}</span></div><button class="btn sm" data-act="f1Rimetti" data-id="${esc(id)}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>` : ""}
    ${piloti.length ? `<div class="fl1">⭐ ${t("Pilota preferito", "Favourite driver")}</div><div class="fo1ch">${[["", "", t("Nessuno", "None")], ...piloti].map(([code, cg, n]) => `<button class="${(pp?.code || "") === code && (code || !pp) ? "act" : ""}" data-act="f1Pref" data-t="p" data-id="${esc(code)}" data-n="${esc(cg)}" ${code ? `style="--tc:${an[code]?.col || "#8e8e93"}"` : ""}>${code ? `<i></i>` : ""}${esc(n.trim() || code)}</button>`).join("")}</div>` : ""}
    ${team.length ? `<div class="fl1">⭐ ${t("Team preferito", "Favourite team")}</div><div class="fo1ch">${[["", t("Nessuno", "None")], ...team].map(([id, n]) => `<button class="${(tp?.id || "") === id && (id || !tp) ? "act" : ""}" data-act="f1Pref" data-t="t" data-id="${esc(id)}" data-n="${esc(id ? n : "")}" ${id ? `style="--tc:${coloreTeam(F, n)}"` : ""}>${id ? `<i></i>` : ""}${esc(n)}</button>`).join("")}</div>` : ""}
    <p class="small muted" style="margin-top:12px">${t("Il pilota e il team preferiti sono evidenziati in classifica, in pista e nei risultati.", "Your favourite driver and team are highlighted in the standings, on track and in the results.")}</p>`;
}

/* ================= 📱 avvisi: automazione «'Nduja · Formula 1» ================= */
const AUT = "nduja_f1";
const servizi = () => { const s = cached("services", 3600e3, () => ws({ type: "get_services" })) || {}; return Object.keys(s.notify || {}).filter(k => !["send_message", "persistent_notification", "notify"].includes(k)).sort(); };
const TIPI_AV = () => [["fp", "⏱️ " + t("Prove libere", "Practice")], ["q", "🎯 " + t("Qualifiche (anche quelle sprint)", "Qualifying (sprint too)")], ["s", "⚡ Sprint"], ["r", "🏁 " + t("Gara", "Race")]];
const MSG = () => ({ fp1: t("Tra 15 minuti partono le prove libere 1", "Practice 1 starts in 15 minutes"), fp2: t("Tra 15 minuti partono le prove libere 2", "Practice 2 starts in 15 minutes"),
  fp3: t("Tra 15 minuti partono le prove libere 3", "Practice 3 starts in 15 minutes"), sq: t("Tra 15 minuti partono le qualifiche sprint", "Sprint qualifying starts in 15 minutes"),
  s: t("Tra 15 minuti parte la sprint", "The sprint starts in 15 minutes"), q: t("Tra 15 minuti partono le qualifiche", "Qualifying starts in 15 minutes"), r: t("Tra 15 minuti parte la gara", "The race starts in 15 minutes") });
const gruppo = k => k.startsWith("fp") ? "fp" : k === "sq" ? "q" : k;
let NB = null;
function schedaNotifiche() {
  const c = NB, sv = servizi(), F = fonti(), via = F.next ? "F1 Sensor" : F.cal.length ? t("il calendario", "the calendar") + " «" + nmHA(F.cal[0]) + "»" : "Team Tracker";
  const ck = (on, act, k, n) => `<button class="ck1 ${on ? "on" : ""}" data-act="${act}" data-k="${esc(k)}"><span class="bx"></span><span class="tx"><b>${n}</b></span></button>`;
  return `<div class="sh-head"><div><h3>📱 ${t("Avvisi della Formula 1", "Formula 1 alerts")}</h3><div class="small muted">${t("Creo in Home Assistant l'automazione «'Nduja · Formula 1»: avvisa 15 minuti prima, anche a plancia chiusa.", "I create the «'Nduja · Formula 1» automation in Home Assistant: it alerts 15 minutes before, even with the dashboard closed.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("A chi", "To")}</div><div class="cks1">${sv.map(k => ck(c.servizi.includes(k), "f1nS", k, esc(k.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ")))).join("") || `<div class="small muted">${t("Nessun telefono: installa l'app Home Assistant sul telefono.", "No phone: install the Home Assistant app on the phone.")}</div>`}</div>
    <div class="fl1">${t("Quando", "When")}</div><div class="cks1">${TIPI_AV().filter(([k]) => F.next || F.cal.length || k === "r").map(([k, n]) => ck(c.tipi.includes(k), "f1nT", k, n)).join("")}</div>
    <p class="small muted" style="margin-top:8px">${t("Gli orari vengono da ", "Times come from ")}${esc(via)}.</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="f1nSave">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${C().notif?.servizi?.length ? `<button class="btn bad" data-act="f1nOff">${t("Spegni gli avvisi della F1", "Turn off F1 alerts")}</button>` : ""}</div>`;
}
/** l'automazione: con F1 Sensor 15 minuti prima di ogni sessione scelta (orari del sensore «prossima gara»);
    altrimenti con il calendario (inizio dell'evento meno 15 minuti) o con Team Tracker (solo la gara) */
function automazione(c) {
  const F = fonti(), M = MSG(), T = [], tipi = new Set(c.tipi);
  const finestra = (id, at) => `{% set s = state_attr('${id}', '${at}') %}{% set d = as_datetime(s) if s else none %}{{ d is not none and 0 < (d - now()).total_seconds() <= 900 }}`;
  let msg, cond = [];
  if (F.next) {
    for (const [k, x] of SESS) if (tipi.has(gruppo(k))) T.push({ trigger: "template", value_template: finestra(F.next, x + "_start"), id: k });
    msg = `{% set m = ${JSON.stringify(M)} %}🏎️ {{ m[trigger.id] }} · {{ state_attr('${F.next}', 'race_name') }}`;
  } else if (F.cal.length) {
    const P = { fp: "practice|libere|fp ?[123]", q: "quali", s: "sprint(?!.*quali)(?!.*shootout)", r: "race|gara|grand prix$|gran premio$" };
    T.push({ trigger: "calendar", event: "start", offset: "-0:15:0", entity_id: F.cal[0] });
    cond = [{ condition: "template", value_template: `{{ trigger.calendar_event.summary | regex_search('${[...tipi].map(k => P[k]).join("|")}', ignorecase=True) }}` }];
    msg = "🏎️ " + t("Tra 15 minuti: ", "In 15 minutes: ") + "{{ trigger.calendar_event.summary }}";
  } else if (F.tt.length && tipi.has("r")) {
    F.tt.forEach(id => T.push({ trigger: "template", value_template: finestra(id, "date"), id: "r" }));
    msg = `🏎️ ${M.r} · {{ state_attr(trigger.entity_id, 'event_name') or 'Formula 1' }}`;
  }
  return { id: AUT, alias: "'Nduja · Formula 1", description: t("Creata da 'Nduja Dashboard (Formula 1 → 📱)", "Created by 'Nduja Dashboard (Formula 1 → 📱)"),
    triggers: T, conditions: cond, actions: c.servizi.map(s => ({ action: "notify." + s, data: { title: "🏎️ 'Nduja", message: msg } })), mode: "queued", max: 10 };
}

Object.assign(ACT, {
  f1Tutti: el => { const k = el.dataset.k; V.tutti[k] = !V.tutti[k]; render(true); },
  f1Edit: () => openSheet(schedaFonti),
  f1Add: () => scegli({ titolo: "🏎️ " + t("Aggiungi una fonte", "Add a source"), auto: false, attuale: null,
    sotto: t("Un calendario con le gare (per esempio «Gran Premio d'Italia - Gara»), un sensore di Team Tracker (racing) o di F1 Sensor.", "A calendar with the races (e.g. «Italian Grand Prix - Race»), a Team Tracker (racing) or F1 Sensor sensor."),
    filtro: fonteOk,
    onPick: id => id && salva(f => { f.extra = [...new Set([...(f.extra || []), id])]; f.tolte = (f.tolte || []).filter(x => x !== id); }, "🏎️ " + nmHA(id)).then(() => openSheet(schedaFonti)) }),
  f1Togli: el => { const id = el.dataset.id; salva(f => { f.extra = (f.extra || []).filter(x => x !== id); if (isCalF1(id) || isTTF1(id)) f.tolte = [...new Set([...(f.tolte || []), id])]; }, "✕ " + nmHA(id)); },
  f1Rimetti: el => { const id = el.dataset.id; salva(f => { f.tolte = (f.tolte || []).filter(x => x !== id); }, "↺"); },
  f1Pref: el => { if (!isAdmin()) return; const tp = el.dataset.t, id = el.dataset.id, n = el.dataset.n, k = tp === "p" ? "pilota" : "team";
    const gia = tp === "p" ? pilotaPref()?.code === id : teamPref()?.id === id;
    salva(f => { if (!id || gia) delete f[k]; else f[k] = tp === "p" ? { code: id, nome: n } : { id, nome: n }; }, id && !gia ? "⭐ " + n : t("Preferito tolto", "Favourite removed")); },
  f1Notif: () => { NB = JSON.parse(JSON.stringify(C().notif || {})); NB.servizi = NB.servizi || []; NB.tipi = NB.tipi || ["q", "s", "r"]; openSheet(schedaNotifiche); },
  f1nS: el => { const k = el.dataset.k, i = NB.servizi.indexOf(k); i < 0 ? NB.servizi.push(k) : NB.servizi.splice(i, 1); render(); },
  f1nT: el => { const k = el.dataset.k, i = NB.tipi.indexOf(k); i < 0 ? NB.tipi.push(k) : NB.tipi.splice(i, 1); render(); },
  f1nSave: async () => {
    if (!NB.servizi.length) return toast(t("Scegli almeno un telefono", "Choose at least one phone"), true);
    const cfg = automazione(NB); if (!cfg.triggers.length || !NB.tipi.length) return toast(t("Niente da avvisare: scegli almeno una sessione", "Nothing to alert: choose at least one session"), true);
    const nuova = !C().notif?.servizi?.length;
    try { await api("POST", "/api/config/automation/config/" + AUT, cfg);
      if (nuova) etichettaNduja(() => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === AUT));
      const c = NB; await salva(f => { f.notif = c; }); closeSheet(); toast("📱 " + t("Avvisi della F1 attivi", "F1 alerts on")); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  f1nOff: async () => { try { await api("DELETE", "/api/config/automation/config/" + AUT); } catch {} await salva(f => { delete f.notif; }); closeSheet(); toast(t("Avvisi della F1 spenti", "F1 alerts off")); },
});

page("formula1", { title: "Formula 1", short: "F1", icon: "🏎️", order: 44, editable: true,
  show: () => fonti().trovato, badge: () => { try { return dati().live; } catch { return false; } }, render: pagina });

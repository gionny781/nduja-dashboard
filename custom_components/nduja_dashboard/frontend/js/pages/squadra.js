/* La mia squadra (calcio): la prossima partita con il conto alla rovescia, la partita in corso (risultato grande, minuto,
   gol e cartellini, con un'animazione al gol disegnata per 'Nduja), gli ultimi risultati e la classifica.
   I dati vengono solo da Home Assistant: Team Tracker (HACS), Calcio Live (HACS) oppure un calendario con le partite.
   Le squadre si trovano da sole; in ⚙️ Impostazioni (e con ✏️) se ne aggiungono altre, si tolgono, si cambiano nome,
   sigla e colori. I loghi sono solo quelli dell'integrazione: se mancano, uno stemma con le iniziali e i colori scelti.
   In Home la scheda «La mia squadra» (HOME_EXTRA). Facoltativa l'automazione «'Nduja · squadra»: avviso sul telefono
   al gol o a fine partita, creata su richiesta. */
import { S, REG, ACT, CHG, UI, LAYOUT, HOME_EXTRA, HOOKS, t, LOC, esc, nmHA, allEnts, card, page, render, go, isAdmin,
  openSheet, closeSheet, toast, cached, svcResp, ws, api, attr, etichettaNduja, sGet, sSet, hhmm } from "../core.js";
import { scegli, cambia } from "../edit.js";

/* ================= riconoscimento ================= */
const A = id => S[id]?.attributes || {};
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const vuoto = v => v == null || v === "" || /^(n\/a|none|null|tbd)$/i.test(String(v).trim());
const pulito = v => vuoto(v) ? "" : String(v).trim();
/** Team Tracker: sensori con team_name, opponent_name e kickoff_in (o della sua integrazione) */
export const isTT = id => id.startsWith("sensor.") && !!S[id] && (REG[id]?.platform === "teamtracker" || ("team_name" in A(id) && "opponent_name" in A(id) && "kickoff_in" in A(id)));
const ttCalcio = id => { const s = String(A(id).sport || A(id).sport_path || "").toLowerCase(); return !s || s === "soccer"; };
/** Calcio Live: sensori di una squadra (team_name e l'elenco matches) */
export const isCL = id => id.startsWith("sensor.") && !!S[id] && typeof A(id).team_name === "string" && Array.isArray(A(id).matches);
/** classifiche di Calcio Live (standings_groups) */
const isClassifica = id => id.startsWith("sensor.") && Array.isArray(A(id).standings_groups);
/** calendari che dal nome sono di calcio (Serie A, Champions, Coppa Italia…) */
const SPORT = /\b(calcio|serie [abc]|champions|europa league|conference league|coppa italia|supercoppa|premier league|la ?liga|bundesliga|ligue 1|eredivisie|uefa|fifa|soccer|football|fixtures|partite)\b/i;
const isCalSport = id => id.startsWith("calendar.") && SPORT.test(id.split(".")[1].replace(/_/g, " ") + " " + nmHA(id));
const fonteOk = id => isTT(id) || isCL(id) || id.startsWith("calendar.");
const simili = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || (x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x)))); };

const C = () => LAYOUT.squadra || {};
const cfgDi = k => C().cfg?.[k] || {};

/* le squadre: Team Tracker e Calcio Live con lo stesso nome diventano una squadra sola; i calendari solo se non c'è altro
   (o se li aggiungi tu) */
let memoR = { k: "", L: [] };
function rileva() {
  const c = C(), k = Object.keys(S).length + "|" + Object.keys(REG).length + "|" + JSON.stringify([c.extra, c.tolte]);
  if (memoR.k === k) return memoR.L;
  const T = [];
  const metti = (id, tipo, nomi, nome) => {
    nomi = nomi.map(norm).filter(Boolean);
    let q = tipo === "cal" ? null : T.find(x => x.tipo !== "cal" && nomi.some(n => x.nomi.has(n)));
    if (!q) { q = { key: tipo === "cal" ? "cal:" + id : "sq:" + (norm(nome) || id), nome, tipo, nomi: new Set(), tt: [], cl: [], cal: [] }; T.push(q); }
    nomi.forEach(n => q.nomi.add(n)); if (!q[tipo].includes(id)) q[tipo].push(id);
  };
  const addCL = id => metti(id, "cl", [A(id).team_name], A(id).team_name || nmHA(id));
  const addTT = id => metti(id, "tt", [A(id).team_long_name, A(id).team_name], pulito(A(id).team_long_name) || pulito(A(id).team_name) || nmHA(id));
  const cl = allEnts("sensor", isCL).sort(), tt = allEnts("sensor", isTT).filter(ttCalcio).sort(), extra = (c.extra || []).filter(id => S[id]);
  cl.forEach(addCL); tt.forEach(addTT);
  extra.forEach(id => isCL(id) ? addCL(id) : isTT(id) ? addTT(id) : id.startsWith("calendar.") && metti(id, "cal", [], nmHA(id)));
  if (!T.length) allEnts("calendar", isCalSport).sort().forEach(id => metti(id, "cal", [], nmHA(id)));
  const tolte = new Set(c.tolte || []);
  memoR = { k, L: T.filter(q => !tolte.has(q.key)) };
  return memoR.L;
}

/* ================= partite: tutte nello stesso formato ================= */
const numero = v => { const m = String(v ?? "").match(/^\s*(\d+)(?:\s*\((\d+)\))?/); return m ? [+m[1], m[2] != null ? +m[2] : null] : [null, null]; };
const hex = v => { const s = String(v || "").trim(); return /^#?[0-9a-f]{6}$/i.test(s) ? (s[0] === "#" ? s : "#" + s) : null; };
/** tipo di un evento della partita dal testo dell'integrazione (ESPN: «Goal», «Penalty - Scored», «Own Goal», «Yellow Card», «Red Card»…) */
function tipoEv(s) {
  s = String(s || "");
  if (/own goal|autogol|autorete/i.test(s)) return "auto";
  if (/(penalty|rigore).*(miss|saved|sbagliat|parat)/i.test(s)) return "rigsb";
  if (/goal|\bgol\b|penalty.*scored|rigore/i.test(s)) return "gol";
  if (/red|rosso|second yellow|doppia ammon|espuls/i.test(s)) return "rosso";
  if (/yellow|giall|ammon/i.test(s)) return "giallo";
  if (/substitut|sostituz|\bsub\b/i.test(s)) return "cambio";
  return "altro";
}
const minuto = s => String(s || "").replace(/''/g, "'").trim();
/* Team Tracker, durante la partita: «JUV 55%, NAP 45%;      23'  Goal: Nome (JUV)     40'  Yellow Card: Nome (NAP)          » */
function eventiTT(a) {
  const s = String(a.last_play || ""); if (!s.trim()) return { ev: [], poss: null };
  let poss = null, resto = s;
  const m = s.match(/^\s*(\S+)\s+([\d.]+)%\s*,\s*(\S+)\s+([\d.]+)%\s*;/);
  if (m) { poss = { [m[1]]: +m[2], [m[3]]: +m[4] }; resto = s.slice(m[0].length); }
  const ev = resto.split(/\s{5,}/).map(x => x.trim()).filter(Boolean).map(x => {
    const r = x.match(/^(.+?)\s{2,}(.+?):\s*(.+?)\s*\(([^()]*)\)$/); if (!r) return null;
    return { min: minuto(r[1]), tipo: tipoEv(r[2]), testo: r[2], chi: r[3], sigla: r[4] };
  }).filter(Boolean);
  return { ev, poss };
}
/* Calcio Live: «Goal - 38': Nome» nei match_details, oppure key_events (solo nella prossima partita) */
function eventiCL(m) {
  if (Array.isArray(m.key_events) && m.key_events.length) return m.key_events.map(e => {
    const cl = typeof e.clock === "object" ? e.clock?.displayValue : e.clock, tm = typeof e.team === "object" ? (e.team?.displayName || e.team?.name) : e.team;
    const chi = (e.athletes || []).map(x => typeof x === "object" ? x.displayName || x.name : x).filter(Boolean).join(", ") || e.short_text || "";
    const tp = tipoEv(e.type_text || e.type);
    return ["altro", "cambio"].includes(tp) && !e.scoring_play ? null : { min: minuto(cl), tipo: e.scoring_play && tp === "altro" ? "gol" : tp, testo: e.type_text || "", chi, squadra: tm || "" };
  }).filter(Boolean);
  return (m.match_details || []).map(x => { const r = String(x).match(/^(.+?)\s+-\s+([^:]+?):\s*(.*)$/); return r ? { min: minuto(r[2]), tipo: tipoEv(r[1]), testo: r[1], chi: r[3] } : null; }).filter(Boolean);
}
const dataCL = s => { const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/); return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null; };
function daCL(m, idS) {
  const d = dataCL(m.date); if (!d) return null;
  const st = String(m.state || "").toLowerCase(), pre = st === "pre";
  const [gc, rc] = pre ? [null, null] : numero(m.home_score), [go, ro] = pre ? [null, null] : numero(m.away_score);
  const sh = k => { const s = m[k + "_statistics"] || {}; const p = parseFloat(s.possessionPct), tp = s.shotsOnTarget; return { p: isNaN(p) ? null : p, tp: vuoto(tp) ? null : tp }; };
  const hs = sh("home"), as = sh("away");
  return { id: m.event_id ? "e" + m.event_id : null, fonte: "cl", sens: idS, data: d, stato: ["pre", "in", "post"].includes(st) ? st : "pre",
    casa: { nome: m.home_team, sigla: pulito(m.home_abbrev), logo: pulito(m.home_logo), col: hex(m.home_color) },
    osp: { nome: m.away_team, sigla: pulito(m.away_abbrev), logo: pulito(m.away_logo), col: hex(m.away_color) },
    gc, go, rc, ro, min: pulito(m.clock), det: pulito(m.status_detail), desc: pulito(m.status), comp: pulito(m.league_name) || pulito(m.season_info),
    stadio: pulito(m.venue), citta: pulito(m.venue_city), tv: pulito(m.broadcast), eventi: eventiCL(m),
    poss: hs.p != null && as.p != null ? [hs.p, as.p] : null, tiri: hs.tp != null && as.tp != null ? [hs.tp, as.tp] : null, tbd: /tbd/i.test(m.status_detail || "") };
}
function daTT(id) {
  const a = A(id), st = String(S[id].state || "").toUpperCase(); if (!["PRE", "IN", "POST"].includes(st)) return null;
  const d = new Date(a.date); if (isNaN(d)) return null;
  const noi = { nome: pulito(a.team_long_name) || pulito(a.team_name), sigla: pulito(a.team_abbr), logo: pulito(a.team_logo), col: hex(a.team_colors?.[0]), col2: hex(a.team_colors?.[1]) };
  const lor = { nome: pulito(a.opponent_long_name) || pulito(a.opponent_name), sigla: pulito(a.opponent_abbr), logo: pulito(a.opponent_logo), col: hex(a.opponent_colors?.[0]), col2: hex(a.opponent_colors?.[1]) };
  const inCasa = String(a.team_homeaway || "home").toLowerCase() !== "away", pre = st === "PRE";
  const [gn, rn] = pre ? [null, null] : numero(a.team_score), [gl, rl] = pre ? [null, null] : numero(a.opponent_score);
  const { ev, poss } = st === "IN" ? eventiTT(a) : { ev: [], poss: null };
  ev.forEach(e => { e.squadra = e.sigla && e.sigla === noi.sigla ? noi.nome : e.sigla && e.sigla === lor.sigla ? lor.nome : ""; });
  const pN = poss?.[noi.sigla], pL = poss?.[lor.sigla], tN = a.team_shots_on_target, tL = a.opponent_shots_on_target;
  const C2 = (x, y) => inCasa ? [x, y] : [y, x];
  const loc = pulito(a.location);
  return { id: a.event_id ? "e" + a.event_id : null, fonte: "tt", sens: id, data: d, stato: st.toLowerCase(),
    casa: inCasa ? noi : lor, osp: inCasa ? lor : noi, gc: inCasa ? gn : gl, go: inCasa ? gl : gn, rc: inCasa ? rn : rl, ro: inCasa ? rl : rn,
    min: pulito(a.clock), det: "", desc: "", comp: pulito(a.league_name) || pulito(a.league) || pulito(a.event_name), stadio: pulito(a.venue), citta: loc.split(",")[0].trim(), tv: pulito(a.tv_network),
    eventi: ev, poss: pN != null && pL != null ? C2(pN, pL) : null, tiri: st === "IN" && !vuoto(tN) && !vuoto(tL) && (+tN || +tL) ? C2(tN, tL) : null };
}
/* calendario: «Inter - Milan», «Inter vs Milan», «Serie A: Inter - Milan», «Inter 2-1 Milan» */
const TV = /\b(DAZN|Sky Sport(?: (?:Uno|Calcio|Arena|Football|Max|Mix|\d{3}))?|Sky|Amazon Prime Video|Prime Video|Rai ?(?:1|2|3|Sport)|Canale 5|Italia 1|Paramount\+|TV8)/i;
function daCal(ev, cal) {
  const allDay = String(ev.start).length <= 10, ini = allDay ? new Date(ev.start + "T00:00:00") : new Date(ev.start), fin = allDay ? new Date(ev.end + "T00:00:00") : new Date(ev.end || ev.start);
  if (isNaN(ini)) return null;
  let s = String(ev.summary || "").trim(), comp = "";
  const due = s.match(/^([^:]{2,40}):\s*(.+)$/); if (due && /\s(-|–|—|vs\.?|v)\s/i.test(due[2])) { comp = due[1].trim(); s = due[2].trim(); }
  let casa = s, osp = "", gc = null, go = null;
  const r = s.match(/^(.+?)\s+(\d{1,2})\s*[-–:]\s*(\d{1,2})\s+(.+)$/), v = s.match(/^(.+?)\s+(?:-|–|—|vs\.?|v\.?|contro)\s+(.+)$/i) || s.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (r) [casa, gc, go, osp] = [r[1], +r[2], +r[3], r[4]]; else if (v) [casa, osp] = [v[1], v[2]];
  const n = Date.now(), stato = n < ini ? "pre" : n < fin ? "in" : "post";
  const tv = String(ev.description || "").match(TV)?.[0] || String(ev.location || "").match(TV)?.[0] || "";
  return { id: null, fonte: "cal", sens: cal, data: ini, stato, casa: { nome: casa.trim() }, osp: { nome: osp.trim() }, gc: stato === "post" ? gc : null, go: stato === "post" ? go : null, rc: null, ro: null,
    min: "", det: "", desc: "", comp: comp || nmHA(cal), stadio: tv && String(ev.location || "").match(TV) ? "" : pulito(ev.location), citta: "", tv, eventi: [], poss: null, tiri: null, tbd: allDay };
}
const eventiCal = ids => !ids.length ? [] : cached("sq:cal:" + ids.join(",") + ":" + new Date().toDateString(), 10 * 6e4, async () => {
  const da = new Date(Date.now() - 60 * 864e5), a = new Date(Date.now() + 90 * 864e5);
  const r = await svcResp("calendar", "get_events", { start_date_time: da.toISOString(), end_date_time: a.toISOString() }, ids);
  return ids.flatMap(id => (r?.[id]?.events || []).map(ev => ({ ev, cal: id })));
}) || [];

/* la stessa partita da più fonti (Team Tracker, Calcio Live, calendario): una sola, con i dati migliori */
const ORD = { pre: 0, in: 1, post: 2 };
function unisci(L) {
  const out = [];
  for (const p of L) {
    const g = out.find(x => (p.id && x.id === p.id) || (Math.abs(x.data - p.data) < 4 * 36e5 && ((simili(x.casa.nome, p.casa.nome) && simili(x.osp.nome, p.osp.nome)) || (simili(x.casa.nome, p.osp.nome) && simili(x.osp.nome, p.casa.nome)))));
    if (!g) { out.push({ ...p, casa: { ...p.casa }, osp: { ...p.osp } }); continue; }
    /* stato e risultato: la fonte più avanti (il calendario non comanda) */
    if (p.fonte !== "cal" && (g.fonte === "cal" || ORD[p.stato] > ORD[g.stato])) Object.assign(g, { stato: p.stato, gc: p.gc, go: p.go, rc: p.rc, ro: p.ro, min: p.min || g.min, det: p.det || g.det, desc: p.desc || g.desc, data: p.data, fonte: p.fonte, sens: p.sens, tbd: p.tbd });
    for (const k of ["comp", "stadio", "citta", "tv"]) if (!g[k] && p[k]) g[k] = p[k];
    if ((p.eventi || []).length > (g.eventi || []).length) g.eventi = p.eventi;
    g.poss = g.poss || p.poss; g.tiri = g.tiri || p.tiri;
    const lati = simili(g.casa.nome, p.casa.nome) ? [["casa", "casa"], ["osp", "osp"]] : [["casa", "osp"], ["osp", "casa"]];
    for (const [a, b] of lati) for (const k of ["sigla", "logo", "col", "col2"]) if (!g[a][k] && p[b][k]) g[a][k] = p[b][k];
  }
  return out.sort((a, b) => a.data - b.data);
}

let memoD = { k: "", L: [] };
/** le squadre con le partite: { key, nome, tt, cl, cal, partite, live, prossima, ultimi, finita, cfg } */
export function squadre() {
  const R = rileva(), ids = R.flatMap(q => [...q.tt, ...q.cl]), cals = [...new Set(R.flatMap(q => q.cal))].sort(), CE = eventiCal(cals);
  const k = R.map(q => q.key).join(",") + "|" + ids.map(id => S[id]?.last_updated + S[id]?.state).join(",") + "|" + CE.length + "|" + JSON.stringify(C().cfg || {}) + "|" + Math.floor(Date.now() / 2e4);
  if (memoD.k === k) return memoD.L;
  const n = Date.now();
  const L = R.map(q => {
    const tutte = unisci([...q.tt.map(daTT), ...q.cl.flatMap(id => (A(id).matches || []).map(m => daCL(m, id))), ...CE.filter(x => q.cal.includes(x.cal)).map(x => daCal(x.ev, x.cal))].filter(Boolean));
    /* calendario: la mia squadra è quella che c'è in quasi tutte le partite («Partite Pro Valle» → «Pro Valle») */
    let nomeQ = q.nome;
    if (q.tipo === "cal") {
      const n = {}; tutte.forEach(p => [p.casa.nome, p.osp.nome].filter(Boolean).forEach(x => { const k = norm(x); n[k] = n[k] || [0, x]; n[k][0]++; }));
      const best = Object.values(n).sort((a, b) => b[0] - a[0])[0];
      if (best && best[0] >= 2 && best[0] >= tutte.length * .6) { nomeQ = best[1]; q.nomi.add(norm(best[1])); }
    }
    const eNoi = nome => [...q.nomi].some(x => simili(x, nome)) || simili(nomeQ, nome);
    tutte.forEach(p => { p.lato = eNoi(p.casa.nome) ? "casa" : eNoi(p.osp.nome) ? "osp" : null; });
    const live = tutte.find(p => p.stato === "in");
    const prossima = tutte.find(p => p.stato === "pre" && p.data > n - 4 * 36e5);
    const ultimi = tutte.filter(p => p.stato === "post" && p.data > n - 150 * 864e5 && p.data < n).reverse().slice(0, 5);
    const finita = ultimi[0] && n - ultimi[0].data < 5 * 36e5 ? ultimi[0] : null;
    const cfg = cfgDi(q.key);
    return { ...q, nome: cfg.nome || nomeQ, nomeDati: nomeQ, cfg, partite: tutte, live, prossima, ultimi, finita, eNoi };
  });
  memoD = { k, L };
  return L;
}

/* ================= classifica (Calcio Live) ================= */
function classifica(q) {
  const cand = [];
  for (const id of Object.keys(S).filter(isClassifica)) for (const g of A(id).standings_groups || []) {
    const righe = g.standings || [];
    if (righe.some(r => q.eNoi(r.team_name))) cand.push({ id, nome: pulito(A(id).season) || pulito(g.name), gruppo: pulito(g.name), righe });
  }
  if (!cand.length) return null;
  const lg = norm(q.live?.comp || q.prossima?.comp || q.ultimi[0]?.comp);
  return (lg && cand.find(c => norm(c.nome).includes(lg) || (norm(c.gruppo).includes(lg)))) || cand[0];
}

/* ================= stemma: il logo dell'integrazione, altrimenti iniziali e colori ================= */
const KO = new Set();
window.ndujaSqKo = el => { KO.add(el.dataset.u); render(true); };
const PAL = [["#1f4e9c", "#f2c230"], ["#b3122e", "#1c1c1e"], ["#0f7a3d", "#f5f5f5"], ["#6a2c91", "#f2f2f2"], ["#e35d0b", "#0d2240"], ["#0b6fb8", "#f5f5f5"], ["#2b2d33", "#f5f5f5"], ["#8b1d2c", "#e8b04a"], ["#11807a", "#ffd23f"], ["#d1202f", "#1f4e9c"]];
const hash = s => [...norm(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function siglaDa(s) {
  if (s.sigla) return s.sigla.slice(0, 4).toUpperCase();
  const p = norm(s.nome).split(" ").filter(w => w && !/^(fc|ac|as|ss|us|asd|ssd|calcio|club|cf|sc|afc|cd|ud|rc|fk|sk|1\d{3}|\d+)$/.test(w));
  if (!p.length) return "?";
  return (p.length > 1 ? p.slice(0, 3).map(w => w[0]).join("") : p[0].slice(0, 3)).toUpperCase();
}
function stemma(s, cls = "", cfg = null) {
  const u = s.logo && !KO.has(s.logo) ? s.logo : null;
  if (u) return `<img class="sq1bd ${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async" data-u="${esc(u)}" onerror="ndujaSqKo(this)">`;
  const p = PAL[hash(s.nome) % PAL.length], c1 = hex(cfg?.c1) || s.col || p[0], c2 = hex(cfg?.c2) || s.col2 || (s.col ? "#f5f5f5" : p[1]);
  const sg = esc((cfg?.sigla || siglaDa(s)).slice(0, 4)), fs = sg.length >= 4 ? 9.5 : sg.length === 3 ? 11.5 : 14;
  return `<svg class="sq1bd ${cls}" viewBox="0 0 40 46" role="img" aria-label="${esc(s.nome || "")}">
    <path d="M20 2 3 7v15c0 11 8 18 17 22z" fill="${c1}"/><path d="M20 2 37 7v15c0 11-8 18-17 22z" fill="${c2}"/>
    <path d="M20 2 37 7v15c0 11-8 18-17 22C11 40 3 33 3 22V7z" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6"/>
    <path d="M7 10.5 20 6.6l13 3.9" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/><rect x="${sg.length >= 4 ? 4 : 6}" y="${26 - (fs + 4.5) / 2}" width="${sg.length >= 4 ? 32 : 28}" height="${fs + 4.5}" rx="3.5" fill="rgba(0,0,0,.28)"/>
    <text x="20" y="${26 + fs / 3}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.4)" stroke-width="1.6" paint-order="stroke" font-family="system-ui,sans-serif" letter-spacing=".3">${sg}</text></svg>`;
}
/** stemma di una delle due squadre della partita: per la mia uso sigla e colori scelti */
const stemmaDi = (q, p, lato, cls) => stemma(p[lato], cls, p.lato === lato ? q.cfg : null);
const nomeDi = (q, p, lato) => p.lato === lato && q.cfg.nome ? q.cfg.nome : p[lato].nome || "";

/* ================= testi ================= */
function quando(d, tbd) {
  const g0 = x => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y; }, diff = Math.round((g0(d) - g0(Date.now())) / 864e5);
  const g = diff === 0 ? t("Oggi", "Today") : diff === 1 ? t("Domani", "Tomorrow") : diff === -1 ? t("Ieri", "Yesterday") : d.toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short" });
  return g + (tbd ? " · " + t("orario da definire", "time to be confirmed") : " · " + hhmm(d));
}
const breve = d => d.toLocaleDateString(LOC, { day: "numeric", month: "short" });
function traQuanto(ms) {
  if (ms <= 0) return t("sta per iniziare", "about to start");
  const g = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return t("tra ", "in ") + (g ? `${g} ${t("g", "d")}${h ? ` ${h} h` : ""}` : h ? `${h} h${m ? ` ${m} min` : ""}` : `${Math.max(1, m)} min`);
}
function contoAllaRovescia(p) {
  const ms = p.data - Date.now();
  if (ms <= 0) return `<div class="sq1cd sq1cd0">⏱️ ${t("Sta per iniziare", "About to start")}</div>`;
  const g = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  const b = (v, u) => `<div><b>${String(v).padStart(2, "0")}</b><small>${u}</small></div>`;
  const pz = g ? [b(g, g === 1 ? t("giorno", "day") : t("giorni", "days")), b(h, t("ore", "hours")), b(m, "min")] : h ? [b(h, t("ore", "hours")), b(m, "min"), b(s, t("sec", "sec"))] : [b(m, "min"), b(s, t("sec", "sec"))];
  return `<div class="sq1cd" role="timer" aria-label="${esc(traQuanto(ms))}">${pz.join("")}</div>`;
}
const intervallo = p => /^ht$|half.?time|intervallo/i.test(p.min + " " + p.det + " " + p.desc);
function minutoLive(p) {
  if (intervallo(p)) return t("Intervallo", "Half-time");
  const m = p.min && p.min !== "0'" ? p.min : "";
  return m || (p.fonte === "cal" ? t("In corso", "Live") : t("Inizio", "Kick-off"));
}
/** esito per la mia squadra: V (vinta), N (pari), P (persa) */
function esito(p) {
  if (!p.lato || p.gc == null || p.go == null) return null;
  let a = p.gc, b = p.go; if (a === b && p.rc != null && p.ro != null) { a = p.rc; b = p.ro; }
  const noi = p.lato === "casa" ? a - b : b - a;
  return noi > 0 ? ["v", t("V", "W"), t("Vinta", "Won")] : noi < 0 ? ["p", t("P", "L"), t("Persa", "Lost")] : ["n", t("N", "D"), t("Pareggio", "Draw")];
}
const punteggio = p => p.gc == null || p.go == null ? "" : `${p.gc}${p.rc != null ? `<sup>(${p.rc})</sup>` : ""}<i>–</i>${p.go}${p.ro != null ? `<sup>(${p.ro})</sup>` : ""}`;
const IC = { gol: "⚽", auto: "⚽", rigsb: "✖️", giallo: "🟨", rosso: "🟥", cambio: "🔁", altro: "•" };
const NOMEV = () => ({ gol: t("Gol", "Goal"), auto: t("Autogol", "Own goal"), rigsb: t("Rigore sbagliato", "Missed penalty"), giallo: t("Ammonizione", "Yellow card"), rosso: t("Espulsione", "Red card"), cambio: t("Cambio", "Substitution"), altro: "" });
const luogo = p => [p.stadio, p.citta && !simili(p.citta, p.stadio) ? p.citta : ""].filter(Boolean).join(", ");

/* ================= animazione al gol ================= */
const PREV = {}; let GOL = null;
HOOKS.push(() => {
  if (!conn0()) return;
  for (const q of squadre()) {
    const p = q.live, k = q.key + "|" + (p?.id || p?.data?.getTime());
    if (!p || p.gc == null || p.go == null) continue;
    const pr = PREV[k];
    if (pr && (p.gc > pr[0] || p.go > pr[1])) {
      const lato = p.gc > pr[0] ? "casa" : "osp", ult = [...(p.eventi || [])].reverse().find(e => e.tipo === "gol" || e.tipo === "auto");
      GOL = { k, lato, fino: Date.now() + 6500, chi: ult?.chi || "", min: ult?.min || "", squadra: nomeDi(q, p, lato), nostro: p.lato === lato };
      setTimeout(() => render(), 6600);
    }
    PREV[k] = [p.gc, p.go];
  }
});
const conn0 = () => Object.keys(S).length > 0;
const golDi = (q, p) => GOL && Date.now() < GOL.fino && GOL.k === q.key + "|" + (p.id || p.data.getTime()) ? GOL : null;
function animaGol(g) {
  return `<div class="sq1gol ${g.nostro ? "noi" : ""}" role="status" aria-live="polite">
    <svg class="sq1gs" viewBox="0 0 140 80" aria-hidden="true">
      <g class="rete"><path class="tel" d="M38 14h80v52H38z"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path class="fil" d="M${48 + i * 10} 14v52"/>`).join("")}${[0, 1, 2, 3].map(i => `<path class="fil" d="M38 ${24 + i * 10}h80"/>`).join("")}</g>
      <path class="pali" d="M36 68V12h84v56"/>
      <g class="palla"><circle r="7.5" fill="#fff"/><path d="M0-3.2 3 -.9 1.9 2.6H-1.9L-3-.9z" fill="#1c1c1e"/><path d="M0-3.2V-7.4M3-.9 7 -2.3M1.9 2.6 4.4 6.1M-1.9 2.6-4.4 6.1M-3-.9-7-2.3" stroke="#1c1c1e" stroke-width="1.1"/></g>
    </svg>
    <div class="sq1gt"><b>${t("GOL!", "GOAL!")}</b><span>${esc(g.squadra)}${g.chi ? " · " + esc(g.chi) : ""}${g.min ? " " + esc(g.min) : ""}</span></div></div>`;
}

/* ================= pagina ================= */
const selezionata = L => L.find(q => q.key === sGet("sq_sel")) || L.find(q => q.live) || L[0];
function tabellone(q, p, live) {
  const sc = live || p.stato === "post";
  return `<div class="sq1sb">
    <div class="sq1t ${p.lato === "casa" ? "noi" : ""}">${stemmaDi(q, p, "casa", "xl")}<b>${esc(nomeDi(q, p, "casa") || "—")}</b><small>${t("in casa", "home")}</small></div>
    <div class="sq1mid">${sc && p.gc != null ? `<div class="sq1sc">${punteggio(p)}</div>` : `<div class="sq1vs">VS</div>`}
      ${live ? `<span class="sq1min ${intervallo(p) ? "ht" : ""}"><i></i>${esc(minutoLive(p))}</span>` : p.stato === "post" ? `<span class="sq1fin">${t("Finita", "Full time")}</span>` : ""}</div>
    <div class="sq1t ${p.lato === "osp" ? "noi" : ""}">${stemmaDi(q, p, "osp", "xl")}<b>${esc(nomeDi(q, p, "osp") || t("da definire", "to be decided"))}</b><small>${t("fuori casa", "away")}</small></div>
  </div>`;
}
function infoPartita(p) {
  const L = [["📅", quando(p.data, p.tbd)], p.comp && ["🏆", p.comp], luogo(p) && ["🏟️", luogo(p)], p.tv && ["📺", p.tv]].filter(Boolean);
  return `<div class="sq1inf">${L.map(([i, x]) => `<span><em>${i}</em>${esc(x)}</span>`).join("")}</div>`;
}
function cronaca(q, p) {
  const E = [...(p.eventi || [])].filter(e => e.tipo !== "cambio").reverse().slice(0, 10), N = NOMEV();
  const lato = e => e.squadra ? (simili(e.squadra, p.casa.nome) ? "casa" : simili(e.squadra, p.osp.nome) ? "osp" : "") : "";
  const stat = [];
  if (p.poss) stat.push(`<div class="sq1st"><span>${Math.round(p.poss[0])}%</span><div class="sq1pb"><i style="width:${Math.max(4, Math.min(96, p.poss[0]))}%"></i></div><span>${Math.round(p.poss[1])}%</span><small>${t("Possesso palla", "Possession")}</small></div>`);
  if (p.tiri) stat.push(`<div class="sq1st t"><span>${esc(p.tiri[0])}</span><small>${t("Tiri in porta", "Shots on target")}</small><span>${esc(p.tiri[1])}</span></div>`);
  if (!E.length && !stat.length) return p.fonte === "cal" ? "" : `<div class="small muted sq1nev">${t("Ancora nessun gol o cartellino.", "No goals or cards yet.")}</div>`;
  return `${stat.length ? `<div class="sq1sts">${stat.join("")}</div>` : ""}
    ${E.length ? `<div class="sq1evs">${E.map(e => `<div class="sq1ev ${lato(e)} ${e.tipo}"><em>${IC[e.tipo]}</em><span class="m">${esc(e.min)}</span><div><b>${esc(e.chi || N[e.tipo])}</b><small>${esc(N[e.tipo] || e.testo)}${e.tipo === "gol" && /penalty|rigore/i.test(e.testo) ? " · " + t("rigore", "penalty") : ""}</small></div></div>`).join("")}</div>` : ""}`;
}
const fonteTesto = q => [q.tt.length && "Team Tracker", q.cl.length && "Calcio Live", q.cal.length && t("calendario", "calendar")].filter(Boolean).join(" · ");
function eroe(q) {
  const p = q.live || q.prossima || q.finita, live = !!q.live, gol = p ? golDi(q, p) : null;
  const c1 = hex(q.cfg.c1) || (p && p.lato ? p[p.lato].col : null) || PAL[hash(q.nome) % PAL.length][0];
  const testa = `<div class="ch"><h2>⚽ ${esc(q.nome)}${live ? ` <span class="sq1lv">LIVE</span>` : ""}</h2><span class="grow"></span>
    ${isAdmin() ? `<button class="btn sm" data-act="sqNotif" title="${t("Avvisi sul telefono", "Phone alerts")}">📱</button>` : ""}${isAdmin() && UI.edit ? `<button class="btn sm" data-act="sqTeam" data-id="${esc(q.key)}">✏️</button>` : ""}</div>`;
  if (!p) {
    const u = q.ultimi[0];
    return `<section class="card span3 sq1h" style="--sqc:${c1}">${campo()}${testa}
      ${u ? `<div class="sq1lb">${t("Ultima partita", "Last match")}</div>${tabellone(q, u, false)}${infoPartita(u)}` : `<div class="sq1vuoto"><span>📭</span><div><b>${t("Nessuna partita in programma", "No match scheduled")}</b><small>${t("Appena l'integrazione pubblica la prossima partita, compare qui.", "As soon as the integration publishes the next match, it shows up here.")}</small></div></div>`}</section>`;
  }
  const et = live ? t("Partita in corso", "Live match") : p.stato === "post" ? t("Appena finita", "Just finished") : t("Prossima partita", "Next match");
  return `<section class="card span3 sq1h ${live ? "live" : ""}" style="--sqc:${c1}">${campo()}${testa}
    <div class="sq1lb">${et}</div>
    ${tabellone(q, p, live)}
    ${p.stato === "pre" ? contoAllaRovescia(p) : ""}
    ${infoPartita(p)}
    ${live ? cronaca(q, p) : ""}
    ${gol ? animaGol(gol) : ""}
  </section>`;
}
/* righe del campo, appena accennate dietro il tabellone */
const campo = () => `<svg class="sq1cp" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path d="M200 0v200M10 10h380v180H10zM10 55h55v90H10M390 55h-55v90h55"/><circle cx="200" cy="100" r="34"/><circle cx="200" cy="100" r="2.5"/></svg>`;
function ultimiCard(q) {
  if (!q.ultimi.length) return "";
  return card("🗓️ " + t("Ultimi risultati", "Recent results"), `<div class="sq1ul">${q.ultimi.map(p => { const e = esito(p);
    return `<div class="sq1r"><small class="d">${esc(breve(p.data))}${p.comp ? `<em>${esc(p.comp)}</em>` : ""}</small>
      <div class="sq1rt ${p.lato === "casa" ? "noi" : ""}"><span>${esc(nomeDi(q, p, "casa"))}</span>${stemmaDi(q, p, "casa", "sm")}</div>
      <b class="sq1rs">${p.gc != null ? punteggio(p) : "–"}</b>
      <div class="sq1rt o ${p.lato === "osp" ? "noi" : ""}">${stemmaDi(q, p, "osp", "sm")}<span>${esc(nomeDi(q, p, "osp"))}</span></div>
      ${e ? `<span class="sq1es ${e[0]}" title="${e[2]}">${e[1]}</span>` : `<span class="sq1es"></span>`}</div>`; }).join("")}</div>`, { cls: "sq1u" + (classifica(q) ? "" : " span3") });
}
/** sigla, logo e colori delle squadre incontrate nelle partite (per avere in classifica lo stesso stemma) */
function giaVisti(q) { const M = {}; for (const p of q.partite) for (const l of ["casa", "osp"]) { const k = norm(p[l].nome); if (k && !M[k]) M[k] = p[l]; } return M; }
function classificaCard(q) {
  const c = classifica(q); if (!c) return "";
  const n = c.righe.length, V = giaVisti(q);
  return card("📊 " + t("Classifica", "Table") + ` <span class="muted">${esc(c.nome)}</span>`, `<div class="sq1tb">
    <div class="sq1tr hd"><span>#</span><span>${t("Squadra", "Team")}</span><span>${t("G", "P")}</span><span class="sx">${t("V", "W")}</span><span class="sx">${t("N", "D")}</span><span class="sx">${t("P", "L")}</span><span>${t("DR", "GD")}</span><span>${t("Pt", "Pts")}</span></div>
    ${c.righe.map((r, i) => { const noi = q.eNoi(r.team_name), v = x => vuoto(x) ? "–" : esc(x), info = noi ? noiDi(q) : V[norm(r.team_name)] || {};
      return `<div class="sq1tr ${noi ? "noi" : ""} ${i < 4 && n > 10 ? "su" : ""} ${i >= n - 3 && n > 10 ? "giu" : ""}"><span>${v(r.rank ?? i + 1)}</span>
        <span class="tm">${stemma({ ...info, nome: r.team_name, logo: pulito(r.team_logo) || info.logo || "" }, "xs", noi ? q.cfg : null)}<b>${esc(r.team_name)}</b></span>
        <span>${v(r.games_played)}</span><span class="sx">${v(r.wins)}</span><span class="sx">${v(r.draws)}</span><span class="sx">${v(r.losses)}</span><span>${v(r.goal_difference)}</span><b>${v(r.points)}</b></div>`; }).join("")}
  </div>`, { cls: (q.ultimi.length ? "span2" : "span3") + " sq1cl" });
}
function scelta(L, sel) {
  if (L.length < 2) return "";
  return `<div class="sq1sel">${L.map(q => `<button class="${q.key === sel.key ? "act" : ""}" data-act="sqSel" data-id="${esc(q.key)}">${q.live ? `<i class="lv"></i>` : ""}${esc(q.nome)}</button>`).join("")}</div>`;
}
function pagina() {
  const L = squadre();
  if (!L.length) return `<div class="g g3">${card("⚽ " + t("La mia squadra", "My team"), spiegazione(), { cls: "span3" })}</div>`;
  const q = selezionata(L);
  return `${scelta(L, q)}<div class="g g3">${eroe(q)}${ultimiCard(q)}${classificaCard(q)}
    ${UI.edit && isAdmin() ? `<section class="card span3"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="add1" data-act="sqAdd"><span>＋</span>${t("Aggiungi squadra", "Add team")}</button><button class="btn" data-act="sqEdit">⚙️ ${t("Squadre e fonti", "Teams and sources")}</button></div></section>` : ""}
    <p class="small muted sq1src span3">${t("Dati da ", "Data from ")}${esc(fonteTesto(q))}</p></div>`;
}
/* spiegazione quando non c'è niente */
const DOC_TT = "https://github.com/vasqued2/ha-teamtracker";
const haIntegrazione = () => Object.keys(S).some(id => isTT(id) || isCL(id));
function spiegazione(bottone = true) {
  return `<div class="sq1no"><span class="sq1noi">⚽</span><div><b>${t("Installa Team Tracker da HACS e scegli la tua squadra", "Install Team Tracker from HACS and choose your team")}</b>
    <p>${t("La plancia mostra la prossima partita, la diretta con i gol e gli ultimi risultati. Team Tracker è gratuito: in HACS cercalo, scaricalo, riavvia Home Assistant e aggiungi l'integrazione «Team Tracker» con il campionato e la squadra. Va bene anche Calcio Live (con la classifica) o un calendario con le partite.", "The dashboard shows the next match, the live score with goals and the latest results. Team Tracker is free: search it in HACS, download it, restart Home Assistant and add the «Team Tracker» integration with your league and team. Calcio Live (with the table) or a calendar with the matches work too.")}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn sm pri" href="${DOC_TT}" target="_blank" rel="noopener">📖 ${t("Guida di Team Tracker", "Team Tracker guide")}</a>${isAdmin() && bottone ? `<button class="btn sm" data-act="sqAdd">📅 ${t("Scegli un sensore o un calendario", "Pick a sensor or a calendar")}</button>` : ""}</div></div></div>`;
}

/* ================= Home ================= */
function homeCard() {
  const L = squadre(); if (!L.length) return "";
  const righe = [...L].sort((a, b) => !!b.live - !!a.live).map(q => {
    const p = q.live || q.finita || q.prossima; if (!p) return "";
    const live = p.stato === "in", gol = golDi(q, p);
    const sotto = live ? `<em class="lv">● ${esc(minutoLive(p))}</em>${p.comp ? " · " + esc(p.comp) : ""}` : p.stato === "post" ? `${t("Finita", "Full time")}${p.comp ? " · " + esc(p.comp) : ""}` : `${esc(quando(p.data, p.tbd))} · ${esc(traQuanto(p.data - Date.now()))}`;
    return `<button class="sq1hr ${live ? "live" : ""} ${gol ? "gol" : ""}" data-act="sqGo" data-id="${esc(q.key)}">
      <span class="sq1hm">${stemmaDi(q, p, "casa", "md")}<b>${p.gc != null && p.stato !== "pre" ? punteggio(p) : "VS"}</b>${stemmaDi(q, p, "osp", "md")}</span>
      <span class="tx"><b>${esc(nomeDi(q, p, "casa"))} – ${esc(nomeDi(q, p, "osp") || "?")}</b><small>${gol ? `⚽ <strong>${t("GOL!", "GOAL!")}</strong> ${esc(gol.squadra)}` : sotto}</small></span><span class="st">›</span></button>`;
  }).filter(Boolean);
  if (!righe.length) return card("⚽ " + t("La mia squadra", "My team"), `<div class="small muted">${t("Nessuna partita in programma.", "No match scheduled.")}</div>`, { link: [t("Squadra", "Team"), "squadra"] });
  return card("⚽ " + t("La mia squadra", "My team"), `<div class="stack">${righe.join("")}</div>`, { link: [t("Squadra", "Team"), "squadra"] });
}
HOME_EXTRA.squadra = { title: () => t("La mia squadra", "My team"), render: homeCard, show: () => squadre().length > 0 };

/* conto alla rovescia ai secondi nell'ultima ora */
setInterval(() => {
  if (UI.page !== "squadra" || UI.sheet || document.hidden) return;
  const q = (() => { try { return selezionata(squadre()); } catch { return null; } })();
  if (q && !q.live && q.prossima && q.prossima.data - Date.now() < 36e5) render();
}, 1000);

/* ================= ⚙️ squadre e fonti ================= */
const salvaSq = (fn, msg) => cambia(l => { l.squadra = JSON.parse(JSON.stringify(l.squadra || {})); fn(l.squadra); }, msg);
/** la mia squadra com'è nei dati (nome, sigla, logo, colori), dalla partita più vicina */
function noiDi(q) { const L = [q.live, q.prossima, ...q.ultimi, ...q.partite].filter(p => p && p.lato); return L.length ? { ...L[0][L[0].lato], nome: L[0][L[0].lato].nome || q.nomeDati } : { nome: q.nomeDati }; }
function nomeFonte(id) { return isTT(id) ? "Team Tracker" : isCL(id) ? "Calcio Live" : id.startsWith("calendar.") ? t("Calendario", "Calendar") : ""; }
function schedaFonti() {
  const L = squadre(), tolte = (C().tolte || []);
  return `<div class="sh-head"><div><h3>⚽ ${t("La mia squadra", "My team")}</h3><div class="small muted">${t("Le squadre che segui e da dove prendo i dati. Valgono per tutta la casa.", "The teams you follow and where the data comes from. They apply to the whole home.")}</div></div><button class="sx" data-act="sheetClose">×</button></div>
    ${L.length ? `<div class="stack">${L.map(q => `<div class="li sq1fl"><span class="sq1fi">${stemma(noiDi(q), "md", q.cfg)}</span>
      <div class="tx"><b>${esc(q.nome)}</b><span>${[...q.tt, ...q.cl, ...q.cal].map(id => `${esc(nomeFonte(id))}: ${esc(nmHA(id))}`).join(" · ")}</span></div>
      <button class="btn sm" data-act="sqTeam" data-id="${esc(q.key)}">✏️</button></div>`).join("")}</div>` : ""}
    ${!haIntegrazione() ? `<div class="sq1nt">${spiegazione(false)}</div>` : ""}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="sqAdd">＋ ${t("Aggiungi squadra", "Add team")}</button>${L.length ? `<button class="btn" data-act="sqNotif">📱 ${t("Avvisi sul telefono", "Phone alerts")}</button>` : ""}</div>
    ${tolte.length ? `<div class="fl1">${t("Tolte dalla plancia", "Removed from the dashboard")}</div><div class="stack">${tolte.map(k => `<div class="li"><span class="ic">🙈</span><div class="tx"><b>${esc(C().nomiTolte?.[k] || k.replace(/^(sq|cal):/, ""))}</b></div><button class="btn sm" data-act="sqRimetti" data-id="${esc(k)}">↺ ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>` : ""}
    <p class="small muted" style="margin-top:12px">${t("Puoi scegliere un sensore di Team Tracker o di Calcio Live, oppure un calendario con le partite (per esempio «Inter - Milan»). Più squadre? Aggiungine quante vuoi.", "Pick a Team Tracker or Calcio Live sensor, or a calendar with the matches (e.g. «Inter - Milan»). More teams? Add as many as you like.")}</p>`;
}
let ED = null;
function schedaSquadra() {
  const q = squadre().find(x => x.key === ED?.key); if (!q) return "";
  const base = noiDi(q);
  const prova = { ...base, nome: ED.nome || q.nomeDati, logo: ED.logo ? base.logo : "" };
  return `<div class="sh-head"><div><h3>✏️ ${esc(q.nome)}</h3><div class="small muted">${esc(fonteTesto(q))}</div></div><button class="sx" data-act="sheetClose">×</button></div>
    <div class="sq1ed"><div class="sq1edp">${stemma(prova, "xl", ED)}</div>
      <div class="sq1edf"><label class="fld1"><span>${t("Nome", "Name")}</span><input type="text" data-chg="sqF" data-k="nome" value="${esc(ED.nome)}" placeholder="${esc(q.nomeDati)}"></label>
        <div class="sq1edr"><label class="fld1"><span>${t("Sigla", "Initials")}</span><input type="text" maxlength="4" data-chg="sqF" data-k="sigla" value="${esc(ED.sigla)}" placeholder="${esc(siglaDa(base))}"></label>
          <label class="fld1 sq1col"><span>${t("Colore 1", "Colour 1")}</span><input type="color" data-chg="sqF" data-k="c1" value="${esc(hex(ED.c1) || base.col || PAL[hash(base.nome) % PAL.length][0])}"></label>
          <label class="fld1 sq1col"><span>${t("Colore 2", "Colour 2")}</span><input type="color" data-chg="sqF" data-k="c2" value="${esc(hex(ED.c2) || base.col2 || PAL[hash(base.nome) % PAL.length][1])}"></label></div></div></div>
    <p class="small muted" style="margin-top:8px">${base.logo && !KO.has(base.logo) ? t("Il logo arriva dall'integrazione; sigla e colori servono quando il logo non c'è (sopra vedi lo stemma di riserva).", "The logo comes from the integration; initials and colours are used when there is no logo (above is the fallback badge).") : t("L'integrazione non dà il logo: uso lo stemma con la sigla e i colori che scegli.", "The integration gives no logo: I use the badge with the initials and colours you choose.")}</p>
    <div class="fl1">${t("Fonti", "Sources")}</div><div class="stack">${[...q.tt, ...q.cl, ...q.cal].map(id => `<button class="li" data-act="more" data-id="${esc(id)}"><span class="ic">${id.startsWith("calendar.") ? "📅" : "📡"}</span><div class="tx"><b>${esc(nmHA(id))}</b><span>${esc(nomeFonte(id))} · ${esc(id)}</span></div><span class="st">›</span></button>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="sqSalva">💾 ${t("Salva", "Save")}</button><button class="btn" data-act="sqColAuto">↺ ${t("Colori automatici", "Automatic colours")}</button><button class="btn bad" data-act="sqTogli">✕ ${t("Togli dalla plancia", "Remove from dashboard")}</button></div>`;
}
CHG.sqF = el => { if (!ED) return; ED[el.dataset.k] = el.value; render(); };
document.addEventListener("input", e => { const el = e.target; if (el.dataset?.chg === "sqF" && ED && el.type === "color") { ED[el.dataset.k] = el.value; render(); } });

/* ================= 📱 avvisi sul telefono: automazione «'Nduja · squadra» ================= */
const AUT = "nduja_squadra";
const servizi = () => { const s = cached("services", 3600e3, () => ws({ type: "get_services" })) || {}; return Object.keys(s.notify || {}).filter(k => !["send_message", "persistent_notification", "notify"].includes(k)).sort(); };
let NB = null;
function schedaNotifiche() {
  const c = NB, sv = servizi(), L = squadre(), conDati = L.filter(q => q.tt.length || q.cl.length), soloCal = L.filter(q => !q.tt.length && !q.cl.length);
  const ck = (on, act, k, n) => `<button class="ck1 ${on ? "on" : ""}" data-act="${act}" data-k="${esc(k)}"><span class="bx"></span><span class="tx"><b>${n}</b></span></button>`;
  return `<div class="sh-head"><div><h3>📱 ${t("Avvisi della squadra", "Team alerts")}</h3><div class="small muted">${t("Creo in Home Assistant l'automazione «'Nduja · squadra»: funziona anche a plancia chiusa.", "I create the «'Nduja · team» automation in Home Assistant: it works even with the dashboard closed.")}</div></div><button class="sx" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("A chi", "To")}</div><div class="cks1">${sv.map(k => ck(c.servizi.includes(k), "sqnS", k, esc(k.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ")))).join("") || `<div class="small muted">${t("Nessun telefono: installa l'app Home Assistant sul telefono.", "No phone: install the Home Assistant app on the phone.")}</div>`}</div>
    <div class="fl1">${t("Quando", "When")}</div><div class="cks1">${ck(c.gol !== false, "sqnT", "gol", "⚽ " + t("Gol (di tutte e due le squadre)", "Goals (both teams)"))}${ck(c.fine !== false, "sqnT", "fine", "🏁 " + t("Fine partita, con il risultato", "Full time, with the score"))}</div>
    <div class="fl1">${t("Squadre", "Teams")}</div><div class="cks1">${conDati.map(q => ck(!(c.no || []).includes(q.key), "sqnQ", q.key, "⚽ " + esc(q.nome))).join("")}</div>
    ${soloCal.length ? `<p class="small muted" style="margin-top:8px">${t("Per le squadre che vengono solo da un calendario non so quando segnano: servono Team Tracker o Calcio Live.", "For teams that come only from a calendar I can't know when they score: Team Tracker or Calcio Live are needed.")} (${soloCal.map(q => esc(q.nome)).join(", ")})</p>` : ""}
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="sqnSave">💾 ${t("Salva in Home Assistant", "Save to Home Assistant")}</button>${C().notif?.servizi?.length ? `<button class="btn bad" data-act="sqnOff">${t("Spegni gli avvisi della squadra", "Turn off team alerts")}</button>` : ""}</div>`;
}
/** l'automazione: Team Tracker (punteggi e fine partita) e gli eventi di Calcio Live (calcio_live_goal, calcio_live_match_finished) */
function automazione(c) {
  const L = squadre().filter(q => !(c.no || []).includes(q.key)), tt = L.flatMap(q => q.tt), T = [];
  /* Calcio Live solo per le squadre senza Team Tracker, così lo stesso gol non arriva due volte */
  const nomiCL = [...new Set(L.filter(q => q.cl.length && !q.tt.length).flatMap(q => [...q.cl.map(id => norm(A(id).team_name))]).filter(Boolean))];
  if (c.gol !== false && tt.length) T.push({ trigger: "state", entity_id: tt, attribute: "team_score", id: "tt_gol" }, { trigger: "state", entity_id: tt, attribute: "opponent_score", id: "tt_gol" });
  if (c.fine !== false && tt.length) T.push({ trigger: "state", entity_id: tt, from: "IN", to: "POST", id: "tt_fine" });
  if (c.gol !== false && nomiCL.length) T.push({ trigger: "event", event_type: "calcio_live_goal", id: "cl_gol" });
  if (c.fine !== false && nomiCL.length) T.push({ trigger: "event", event_type: "calcio_live_match_finished", id: "cl_fine" });
  const N = JSON.stringify(nomiCL);
  const cond = "{% if trigger.id == 'tt_gol' %}{{ trigger.from_state is not none and trigger.to_state.state == 'IN' and (trigger.to_state.attributes.get(trigger.attribute) | int(0)) > (trigger.from_state.attributes.get(trigger.attribute) | int(0)) }}"
    + "{% elif trigger.id in ['cl_gol', 'cl_fine'] %}{% set d = trigger.event.data %}{% set x = ((d.home_team or '') ~ ' ' ~ (d.away_team or '')) | lower %}{{ " + N + " | select('in', x) | list | count > 0 }}"
    + "{% else %}true{% endif %}";
  const tt0 = "{% set s = trigger.to_state.attributes %}{% set c = s.team_homeaway != 'away' %}{% set h = s.team_name if c else s.opponent_name %}{% set a = s.opponent_name if c else s.team_name %}"
    + "{% set hs = s.team_score if c else s.opponent_score %}{% set as_ = s.opponent_score if c else s.team_score %}";
  const msg = "{% if trigger.id == 'tt_gol' %}" + tt0 + "⚽ " + t("GOL", "GOAL") + " {{ s.team_name if trigger.attribute == 'team_score' else s.opponent_name }}! {{ h }} {{ hs }}–{{ as_ }} {{ a }}{% if s.clock %} ({{ s.clock }}){% endif %}"
    + "{% elif trigger.id == 'tt_fine' %}" + tt0 + "🏁 " + t("Finita", "Full time") + ": {{ h }} {{ hs }}–{{ as_ }} {{ a }}"
    + "{% elif trigger.id == 'cl_gol' %}{% set d = trigger.event.data %}⚽ " + t("GOL", "GOAL") + " {{ d.team }}! {{ d.home_team }} {{ d.home_score }}–{{ d.away_score }} {{ d.away_team }}{% if d.player and d.player != 'N/A' %} · {{ d.player }}{% endif %}{% if d.minute and d.minute != 'N/A' %} {{ d.minute }}{% endif %}"
    + "{% else %}{% set d = trigger.event.data %}🏁 " + t("Finita", "Full time") + ": {{ d.home_team }} {{ d.home_score }}–{{ d.away_score }} {{ d.away_team }}{% if d.goal_scorers_str and d.goal_scorers_str != 'N/A' %} · {{ d.goal_scorers_str }}{% endif %}{% endif %}";
  return { id: AUT, alias: "'Nduja · " + t("squadra", "team"), description: t("Creata da 'Nduja Dashboard (La mia squadra → 📱)", "Created by 'Nduja Dashboard (My team → 📱)"),
    triggers: T, conditions: [{ condition: "template", value_template: cond }],
    actions: c.servizi.map(s => ({ action: "notify." + s, data: { title: "⚽ 'Nduja", message: msg } })), mode: "queued", max: 10 };
}

Object.assign(ACT, {
  sqSel: el => { sSet("sq_sel", el.dataset.id); render(true); },
  sqGo: el => { sSet("sq_sel", el.dataset.id); go("squadra"); },
  sqEdit: () => openSheet(schedaFonti),
  sqAdd: () => scegli({ titolo: "⚽ " + t("Aggiungi squadra", "Add team"), auto: false, attuale: null,
    sotto: t("Un sensore di Team Tracker o di Calcio Live, oppure un calendario con le partite.", "A Team Tracker or Calcio Live sensor, or a calendar with the matches."),
    filtro: fonteOk,
    onPick: id => id && salvaSq(s => { s.extra = [...new Set([...(s.extra || []), id])];
      const k = id.startsWith("calendar.") ? "cal:" + id : "sq:" + norm(isCL(id) ? A(id).team_name : A(id).team_long_name || A(id).team_name);
      s.tolte = (s.tolte || []).filter(x => x !== k); }, "⚽ " + nmHA(id)).then(() => openSheet(schedaFonti)) }),
  sqTeam: el => { const k = el.dataset.id, c = cfgDi(k), q = squadre().find(x => x.key === k);
    ED = { key: k, nome: c.nome || "", sigla: c.sigla || "", c1: c.c1 || "", c2: c.c2 || "", logo: false }; if (q) openSheet(schedaSquadra); },
  sqColAuto: () => { if (ED) { ED.c1 = ""; ED.c2 = ""; render(); } },
  sqSalva: () => { const e = ED; if (!e) return; closeSheet();
    salvaSq(s => { s.cfg = s.cfg || {}; const v = { nome: e.nome.trim(), sigla: e.sigla.trim().toUpperCase(), c1: hex(e.c1) || "", c2: hex(e.c2) || "" };
      Object.keys(v).forEach(x => { if (!v[x]) delete v[x]; }); if (Object.keys(v).length) s.cfg[e.key] = v; else delete s.cfg[e.key]; }, "💾 " + (e.nome || t("Salvato", "Saved"))); },
  sqTogli: () => { const e = ED; if (!e) return; const q = squadre().find(x => x.key === e.key); closeSheet();
    salvaSq(s => { s.tolte = [...new Set([...(s.tolte || []), e.key])]; s.nomiTolte = { ...(s.nomiTolte || {}), [e.key]: q?.nome || e.key }; const mie = q ? [...q.tt, ...q.cl, ...q.cal] : []; s.extra = (s.extra || []).filter(x => !mie.includes(x)); if (sGet("sq_sel") === e.key) sSet("sq_sel", ""); }, "✕ " + (q?.nome || "")); },
  sqRimetti: el => { const k = el.dataset.id; salvaSq(s => { s.tolte = (s.tolte || []).filter(x => x !== k); if (s.nomiTolte) delete s.nomiTolte[k]; }, "↺"); },
  sqNotif: () => { NB = JSON.parse(JSON.stringify(C().notif || { servizi: [] })); NB.servizi = NB.servizi || []; openSheet(schedaNotifiche); },
  sqnS: el => { const k = el.dataset.k, i = NB.servizi.indexOf(k); i < 0 ? NB.servizi.push(k) : NB.servizi.splice(i, 1); render(); },
  sqnT: el => { const k = el.dataset.k; NB[k] = NB[k] === false; render(); },
  sqnQ: el => { const k = el.dataset.k, s = new Set(NB.no || []); s.has(k) ? s.delete(k) : s.add(k); NB.no = [...s]; render(); },
  sqnSave: async () => {
    if (!NB.servizi.length) return toast(t("Scegli almeno un telefono", "Choose at least one phone"), true);
    const cfg = automazione(NB); if (!cfg.triggers.length) return toast(t("Niente da avvisare: scegli gol o fine partita e una squadra di Team Tracker o Calcio Live", "Nothing to alert: choose goals or full time and a Team Tracker or Calcio Live team"), true);
    const nuova = !C().notif?.servizi?.length;
    try { await api("POST", "/api/config/automation/config/" + AUT, cfg);
      if (nuova) etichettaNduja(() => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === AUT));   // nuova: etichetta «'Nduja»
      const c = NB; await salvaSq(s => { s.notif = c; }); closeSheet(); toast("📱 " + t("Avvisi della squadra attivi", "Team alerts on")); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  sqnOff: async () => { try { await api("DELETE", "/api/config/automation/config/" + AUT); } catch {} await salvaSq(s => { delete s.notif; }); closeSheet(); toast(t("Avvisi della squadra spenti", "Team alerts off")); },
});

page("squadra", { title: t("La mia squadra", "My team"), short: t("Squadra", "Team"), icon: "⚽", order: 43, editable: true,
  show: () => squadre().length > 0, badge: () => squadre().some(q => q.live), render: pagina });

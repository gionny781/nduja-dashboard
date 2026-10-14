/* Grafici dentro la plancia: tocchi un sensore con un numero (temperatura, umidità, consumi…) e vedi
   l'andamento di 24 ore, 7 giorni o 30 giorni dalle statistiche di Home Assistant (min, media, max),
   oppure dalla cronologia se il sensore non ha statistiche. «Apri in Home Assistant» resta disponibile. */
import { S, ACT, t, LOC, esc, nm, val, attr, unit, fnum, ws, cached, openSheet, render, moreInfo, deviceClass } from "./core.js";

/** statistiche (cache 5 minuti): ids, inizio, periodo hour|day|week|month, tipi */
export function statistiche(ids, start, period, types) {
  const key = "st:" + ids.join(",") + start.toISOString().slice(0, 13) + period + types.join();
  return cached(key, 5 * 60000, () => ws({ type: "recorder/statistics_during_period", start_time: start.toISOString(), statistic_ids: ids, period, types }).catch(() => ({})));
}
const storia = (id, start) => cached("hi:" + id + start.toISOString().slice(0, 13), 5 * 60000, () =>
  ws({ type: "history/history_during_period", start_time: start.toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true }).then(r => r?.[id] || []).catch(() => []));

/* ---------- disegno ---------- */
const W = 640, H = 220, PL = 40, PB = 22, PT = 10;
function asse(min, max) { if (min === max) { min -= 1; max += 1; } const p = (max - min) * .08; return [min - p, max + p]; }
const fmtX = (ms, periodo) => { const d = new Date(ms); return periodo === "hour" ? d.toLocaleTimeString(LOC, { hour: "2-digit" }) : d.toLocaleDateString(LOC, { day: "numeric", month: "short" }); };
/** linea con banda min-max: P = [{x(ms), y, lo?, hi?}] */
export function linea(P, { colore = "#64d2ff", u = "", periodo = "hour" } = {}) {
  if (!P.length) return `<div class="small muted">${t("Nessun dato per questo periodo.", "No data for this period.")}</div>`;
  const xs = P.map(p => p.x), ys = P.flatMap(p => [p.y, p.lo, p.hi]).filter(v => v != null && !isNaN(v));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs) || 1], [y0, y1] = asse(Math.min(...ys), Math.max(...ys));
  const X = x => PL + (x - x0) / ((x1 - x0) || 1) * (W - PL - 6), Y = y => PT + (1 - (y - y0) / (y1 - y0)) * (H - PT - PB);
  const path = P.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join("");
  const banda = P.some(p => p.lo != null) ? `<path d="${P.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.hi ?? p.y).toFixed(1)}`).join("")}${[...P].reverse().map(p => `L${X(p.x).toFixed(1)} ${Y(p.lo ?? p.y).toFixed(1)}`).join("")}Z" fill="${colore}" opacity=".16"/>` : "";
  const griglia = [0, .25, .5, .75, 1].map(f => { const v = y0 + (y1 - y0) * f; return `<line x1="${PL}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" class="gg1"/><text x="${PL - 6}" y="${Y(v) + 4}" class="gl1" text-anchor="end">${fnum(v, Math.abs(y1 - y0) < 10 ? 1 : 0)}</text>`; }).join("");
  const tick = [0, .25, .5, .75, 1].map(f => { const x = x0 + (x1 - x0) * f; return `<text x="${X(x)}" y="${H - 4}" class="gl1" text-anchor="middle">${fmtX(x, periodo)}</text>`; }).join("");
  const ult = P[P.length - 1], mn = Math.min(...P.map(p => p.lo ?? p.y)), mx = Math.max(...P.map(p => p.hi ?? p.y));
  return `<svg viewBox="0 0 ${W} ${H}" class="gr1">${griglia}${tick}${banda}<path d="${path}" fill="none" stroke="${colore}" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${X(ult.x)}" cy="${Y(ult.y)}" r="4" fill="${colore}"/></svg>
    <div class="grs1"><span>${t("min", "min")} <b>${fnum(mn, 1)}${esc(u)}</b></span><span>${t("max", "max")} <b>${fnum(mx, 1)}${esc(u)}</b></span><span>${t("ultimo", "last")} <b>${fnum(ult.y, 1)}${esc(u)}</b></span></div>`;
}
/** barre: serie = [{nome, colore, valori:[{x, v}]}] affiancate per ogni x */
export function barre(serie, { u = "", periodo = "day" } = {}) {
  const xs = [...new Set(serie.flatMap(s => s.valori.map(v => v.x)))].sort((a, b) => a - b);
  if (!xs.length) return `<div class="small muted">${t("Nessun dato per questo periodo.", "No data for this period.")}</div>`;
  const max = Math.max(...serie.flatMap(s => s.valori.map(v => v.v || 0)), .01), [, y1] = asse(0, max);
  const bw = (W - PL - 6) / xs.length, n = serie.length, Y = v => PT + (1 - v / y1) * (H - PT - PB);
  const rett = xs.map((x, i) => serie.map((s, k) => { const v = s.valori.find(q => q.x === x)?.v || 0;
    return `<rect x="${(PL + i * bw + bw * .12 + k * (bw * .76 / n)).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(bw * .76 / n).toFixed(1)}" height="${(H - PB - Y(v)).toFixed(1)}" rx="2" fill="${s.colore}"><title>${esc(s.nome)}: ${fnum(v, 2)} ${esc(u)}</title></rect>`; }).join("")).join("");
  const griglia = [0, .5, 1].map(f => { const v = y1 * f; return `<line x1="${PL}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" class="gg1"/><text x="${PL - 6}" y="${Y(v) + 4}" class="gl1" text-anchor="end">${fnum(v, v < 10 ? 1 : 0)}</text>`; }).join("");
  const passo = Math.ceil(xs.length / 7), tick = xs.map((x, i) => i % passo ? "" : `<text x="${PL + i * bw + bw / 2}" y="${H - 4}" class="gl1" text-anchor="middle">${fmtX(x, periodo === "month" ? "month" : "day").replace(/^(\d+) (\w+)$/, periodo === "month" ? "$2" : "$1 $2")}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="gr1">${griglia}${tick}${rett}</svg>
    <div class="grs1">${serie.map(s => `<span><i style="background:${s.colore}"></i>${esc(s.nome)} <b>${fnum(s.valori.reduce((a, q) => a + (q.v || 0), 0), 1)} ${esc(u)}</b></span>`).join("")}</div>`;
}

/* ---------- scheda del grafico di un sensore ---------- */
const PER = () => [["24h", t("24 ore", "24 h"), 1, "hour"], ["7g", t("7 giorni", "7 days"), 7, "hour"], ["30g", t("30 giorni", "30 days"), 30, "day"]];
let G = { id: null, p: "24h" };
const COL = id => ({ temperature: "#ff9f0a", humidity: "#64d2ff", power: "#ffd60a", energy: "#30d158", battery: "#30d158", illuminance: "#ffd60a", carbon_dioxide: "#bf5af2" }[deviceClass(id)] || "#64d2ff");
function dati(id) {
  const [, , giorni, periodo] = PER().find(x => x[0] === G.p), start = new Date(Date.now() - giorni * 864e5);
  const sc = attr(id, "state_class");
  if (sc === "total_increasing" || sc === "total") {
    const r = statistiche([id], start, giorni > 1 ? "day" : "hour", ["change"]); if (r === undefined) return null;
    return { tipo: "barre", P: (r[id] || []).map(p => ({ x: p.start, v: p.change })), periodo: giorni > 1 ? "day" : "hour" };
  }
  if (sc === "measurement") {
    const r = statistiche([id], start, periodo, ["mean", "min", "max"]); if (r === undefined) return null;
    const P = (r[id] || []).filter(p => p.mean != null).map(p => ({ x: p.start, y: p.mean, lo: p.min, hi: p.max }));
    if (P.length) return { tipo: "linea", P, periodo };
  }
  const h = storia(id, start); if (h === undefined) return null;
  return { tipo: "linea", P: h.map(s => ({ x: (s.lu || s.lc) * 1000, y: parseFloat(s.s) })).filter(p => !isNaN(p.y)), periodo };
}
function scheda() {
  const id = G.id, d = dati(id), u = unit(id);
  return `<div class="sh-head"><div><h3>📈 ${esc(nm(id))}</h3><div class="small muted">${t("Adesso", "Now")}: <b>${esc(S[id]?.state || "—")} ${esc(u)}</b></div></div><button class="btn sm" data-act="grHA" data-id="${id}">⤢ ${t("Apri in HA", "Open in HA")}</button><button class="x" data-act="sheetClose">×</button></div>
    <div class="seg" style="margin-bottom:10px">${PER().map(([k, n]) => `<button class="${G.p === k ? "act" : ""}" data-act="grPer" data-v="${k}">${n}</button>`).join("")}</div>
    ${d == null ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : d.tipo === "barre" ? barre([{ nome: nm(id), colore: COL(id), valori: d.P }], { u, periodo: d.periodo }) : linea(d.P, { colore: COL(id), u, periodo: d.periodo })}`;
}
/** sensori con un numero: si aprono nel grafico della plancia */
export const conGrafico = id => /^(sensor|input_number|number)\./.test(id) && S[id] && !isNaN(parseFloat(S[id].state)) && deviceClass(id) !== "timestamp";
export function apriGrafico(id) { G = { id, p: G.p || "24h" }; openSheet(scheda); }
Object.assign(ACT, {
  grPer: el => { G.p = el.dataset.v; render(); },
  grHA: el => moreInfo(el.dataset.id),
});
/* ogni «more» su un sensore numerico apre il grafico invece della finestra di Home Assistant */
const more = ACT.more;
ACT.more = el => el.dataset.id && conGrafico(el.dataset.id) ? apriGrafico(el.dataset.id) : more(el);

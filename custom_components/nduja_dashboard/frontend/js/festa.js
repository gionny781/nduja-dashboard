/* Natale: cose in comune tra la pagina 🎄 Natale (pages/natale.js), lo sfondo (sfondi.js) e il salvaschermo (salvaschermo.js).
   - Periodo di festa: dal 1° dicembre al 6 gennaio, oppure le date scelte in ⚙️ Impostazioni → Natale (LAYOUT.natale.da / .a, «MM-GG»).
     «Quando si vede» (LAYOUT.natale.vista): auto (solo nel periodo), sempre, mai.
   - Conto alla rovescia: «Mancano 12 giorni a Natale», la vigilia, «Buon Natale», «Buone feste» fino all'Epifania.
   - Riconoscimento: l'albero (una luce dell'integrazione Twinkly, o quella scelta), la sua «modalità» (select sullo stesso dispositivo)
     e le altre luci e prese di festa (dal nome, dalla stanza o dalle etichette; più quelle aggiunte a mano, meno quelle tolte).
   - L'albero disegnato per 'Nduja (SVG fatto a mano) che si accende come quello vero: colore, luminosità, effetto animato. */
import { S, REG, AREAS, LAYOUT, t, LOC, esc, nmHA, nm, ok, attr, allEnts, areaOf, ws, cached } from "./core.js";

export const NC = () => LAYOUT.natale || {};

/* ================= periodo ================= */
const mmgg = s => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(s || "")) ? s : null;
export const DA = "12-01", A = "01-06";
export const inizio = () => mmgg(NC().da) || DA;
export const fine = () => mmgg(NC().a) || A;
const md = d => String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/** siamo nel periodo di festa? (anche a cavallo dell'anno: 1 dic – 6 gen) */
export function inPeriodo(d = new Date()) { const x = md(d), a = inizio(), b = fine(); return a <= b ? x >= a && x <= b : x >= a || x <= b; }
/** «Quando si vede» la pagina: auto, sempre, mai */
export const vista = () => ["sempre", "mai"].includes(NC().vista) ? NC().vista : "auto";
/** la voce di menu e la scheda della Home ci sono adesso? */
export const inMenu = (d = new Date()) => vista() === "sempre" || (vista() === "auto" && inPeriodo(d));
/** «1 dicembre», «6 gennaio» */
export const dataTesto = s => { const [m, g] = String(s).split("-").map(Number); return new Date(2024, m - 1, g).toLocaleDateString(LOC, { day: "numeric", month: "long" }); };

/* ================= conto alla rovescia ================= */
/** { k: prima | vigilia | natale | feste, giorni, ms (fino alla mezzanotte di Natale), testo } */
export function conto(d = new Date()) {
  const m = d.getMonth(), g = d.getDate();
  if (m === 11 && g === 25) return { k: "natale", testo: t("Buon Natale!", "Merry Christmas!") };
  if ((m === 11 && g > 25) || (m === 0 && g <= 6)) return { k: "feste", testo: t("Buone feste!", "Happy holidays!") };
  const nat = new Date(d.getFullYear(), 11, 25), oggi = new Date(d.getFullYear(), m, g);
  const giorni = Math.round((nat - oggi) / 864e5), ms = nat - d;
  if (giorni === 1) return { k: "vigilia", giorni, ms, testo: t("Domani è Natale", "Christmas is tomorrow") };
  return { k: "prima", giorni, ms, testo: t(`Mancano ${giorni} giorni a Natale`, `${giorni} days to Christmas`) };
}
/** la vigilia sera: «Mancano 5 ore e 12 minuti» */
export function oreAlNatale(ms) {
  const h = Math.floor(ms / 3600e3), mi = Math.floor(ms % 3600e3 / 60000);
  if (h < 1) return t(`Mancano ${mi} minut${mi === 1 ? "o" : "i"} a Natale`, `${mi} minute${mi === 1 ? "" : "s"} to Christmas`);
  return t(`Mancano ${h} or${h === 1 ? "a" : "e"} e ${mi} minut${mi === 1 ? "o" : "i"} a Natale`, `${h} hour${h === 1 ? "" : "s"} and ${mi} minute${mi === 1 ? "" : "s"} to go`);
}

/* ================= riconoscimento ================= */
const PAROLE = /natal|xmas|christmas|presep|nativity|albero|\btrees?\b|luminari|addobb|\bstell[ae]\b|\bstars?\b|ghirland|garland|wreath|\bfest[ae]\b|festiv|holiday|babbo|santa ?claus|renne|reindeer/i;
/** nomi delle etichette di Home Assistant (le carico una volta ogni 10 minuti) */
const etichette = () => { const L = cached("natLabel", 600000, () => ws({ type: "config/label_registry/list" }).catch(() => [])) || []; return Object.fromEntries(L.map(l => [l.label_id, l.name])); };
const testo = id => { const E = etichette(); return [id.split(".")[1].replace(/_/g, " "), nmHA(id), LAYOUT.names?.[id] || "", AREAS[areaOf(id)]?.name || "", ...(REG[id]?.labels || []).map(l => E[l] || l)].join(" "); };
/** è una luce o una presa di festa (dal nome, dalla stanza o dalle etichette)? */
export const festiva = id => PAROLE.test(testo(id));
const twinkly = id => REG[id]?.platform === "twinkly";
const tipoOk = id => /^(light|switch)\./.test(id);
/** l'albero: quello scelto («none» = nessuno), altrimenti una luce Twinkly (meglio se si chiama albero), altrimenti una luce «albero» */
export function albero(soloAuto = false) {
  const c = NC().albero; if (!soloAuto) { if (c === "none") return null; if (c && S[c]) return c; }
  const T = Object.keys(S).filter(id => id.startsWith("light.") && twinkly(id) && !REG[id]?.hidden);
  const nomeAlbero = id => /albero|\btree\b|natal|xmas|christmas/i.test(id + " " + nmHA(id));
  /* senza Twinkly: una luce o una presa che si chiama «albero» (la presa dell'albero) */
  return T.find(nomeAlbero) || T[0] || [...allEnts("light"), ...allEnts("switch")].find(id => /albero|\btrees?\b/i.test(id + " " + nmHA(id) + " " + (LAYOUT.names?.[id] || ""))) || null;
}
/** la modalità del Twinkly (select con movie, color, effect…): quella scelta, sullo stesso dispositivo o col nome dell'albero */
export function modoDi(lid) {
  const c = NC().modo; if (c === "none") return null; if (c && S[c]) return c;
  if (!lid) return null;
  const dev = REG[lid]?.device, base = lid.split(".")[1].replace(/_\d+$/, "");
  const L = Object.keys(S).filter(id => id.startsWith("select.") && Array.isArray(attr(id, "options")));
  return (dev && L.find(id => REG[id]?.device === dev && (twinkly(id) || /modalit|mode/i.test(id)))) || L.find(id => /^select\./.test(id) && new RegExp("^select\\." + base + "_(modalita|mode)$").test(id)) || null;
}
/** le altre luci e prese di festa (senza l'albero): trovate da sole + aggiunte a mano − tolte */
/** quelle che troverei da sola (senza le aggiunte a mano e senza togliere quelle tolte) */
export const luciAuto = () => [...allEnts("light"), ...allEnts("switch")].filter(id => festiva(id) || twinkly(id));
export function luciFesta() {
  const al = albero(), via = new Set(NC().tolte || []), auto = luciAuto();
  return [...new Set([...auto, ...(NC().luci || []).filter(id => S[id] && tipoOk(id))])].filter(id => id !== al && !via.has(id))
    .sort((a, b) => nm(a).localeCompare(nm(b)));
}
/** tutto il Natale: l'albero e le altre luci */
export const tutteFesta = () => [albero(), ...luciFesta()].filter(Boolean);
export const haQualcosa = () => tutteFesta().length > 0;

/* ================= stato dell'albero ================= */
const MODI_ANIM = ["movie", "effect", "playlist", "demo", "rt"];
export const nomeEffetto = e => String(e || "").replace(/^\d+\s+/, "");
/** { id, on, disp, rgb, bri (0–1), eff, modo, anim } — null se non c'è l'albero */
export function statoAlbero(id = albero()) {
  if (!id || !S[id]) return null;
  const a = S[id].attributes || {}, disp = ok(id), on = disp && S[id].state === "on", mo = modoDi(id), modo = mo && ok(mo) ? S[mo].state : null;
  const eff = a.effect && !/^(none|nessuno|off|solid)$/i.test(a.effect) ? a.effect : null;
  return { id, on, disp, rgb: Array.isArray(a.rgb_color) ? a.rgb_color : null, bri: a.brightness != null ? a.brightness / 255 : on ? 1 : 0, eff, modo,
    anim: on && (modo ? MODI_ANIM.includes(modo) : !!eff) };
}

/* ================= l'albero disegnato ================= */
const r1 = n => Math.round(n * 10) / 10;
const caso = seme => { let s = seme % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
/* tre palchi con il bordo di sotto a festoni: [cima, base, mezza larghezza] */
const PALCHI = [[96, 206, 84], [52, 148, 62], [20, 92, 40]];
function palco([yt, yb, w], k) {
  const n = k + 3, sc = [];
  for (let i = 0; i < n; i++) { const x0 = w - (2 * w * i) / n, x1 = w - (2 * w * (i + 1)) / n; sc.push(`Q${r1((x0 + x1) / 2)} ${yb + 9} ${r1(x1)} ${yb}`); }
  return `M0 ${yt}Q${r1(w * .32)} ${r1((yt + yb) / 2 + 6)} ${w} ${yb}${sc.join("")}Q${r1(-w * .32)} ${r1((yt + yb) / 2 + 6)} 0 ${yt}Z`;
}
/* le lucine lungo quattro fili che scendono di traverso */
const LUCI = (() => {
  const out = [], fili = [[58, 1], [84, -1], [112, 1], [138, -1], [166, 1], [192, -1]], r = caso(1225);
  const mezza = y => y < 92 ? (y - 20) / 72 * 40 : y < 148 ? (y - 52) / 96 * 62 : (y - 96) / 110 * 84;
  fili.forEach(([y0, v], f) => {
    const h = mezza(y0) * .84, n = Math.max(3, Math.round(h / 8)), P = [];
    for (let i = 0; i <= n; i++) { const u = i / n, x = -h + 2 * h * u, y = y0 + v * (u - .5) * 16 + Math.sin(Math.PI * u) * 6; P.push([r1(x), r1(y)]); }
    out.push({ f, P, d: P.map(([x, y], i) => (i ? "L" : "M") + x + " " + y).join("") });
  });
  let k = 0; out.forEach(o => o.L = o.P.map(([x, y]) => ({ x, y, i: k++, dl: r1(-r() * 2.4), du: r1(1.6 + r() * 1.8) })));
  return out;
})();
/* le palline appese (ferme, non sono luci): [x, y, colore] */
const PALLE = [[-22, 76, "#d93a3a"], [20, 104, "#e8b33c"], [-38, 128, "#c9ced8"], [34, 150, "#d93a3a"], [-8, 160, "#e8b33c"], [-52, 186, "#d93a3a"], [56, 192, "#c9ced8"], [6, 196, "#d93a3a"], [12, 66, "#c9ced8"]];
const MULTI = ["#ff4d4d", "#ffd166", "#5be37d", "#5aa9ff", "#fff1d0", "#ff7ad9"];
const hex = rgb => "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** l'albero in SVG. st = statoAlbero() (null = albero decorativo, acceso caldo); o.uid = prefisso unico per i gradienti */
export function alberoSVG(st, o = {}) {
  const u = o.uid || "na", dec = !st, on = dec || st.on, na = !dec && !st.disp, anim = !dec && st.anim;
  const col = !dec && st.rgb ? hex(st.rgb) : "#ffcf72", b = dec ? .85 : Math.max(.25, Math.min(1, st.bri || 1));
  const stella = (() => { const P = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 5.6 : 13; P.push(r1(Math.cos(a) * rr) + "," + r1(14 + Math.sin(a) * rr)); } return P.join(" "); })();
  const bulbi = LUCI.map(o2 => o2.L.map(p => { const c = anim ? MULTI[p.i % MULTI.length] : col;
    return `<g class="nb" style="--c:${c};--dl:${p.dl}s;--du:${p.du}s"><circle class="h" cx="${p.x}" cy="${p.y}" r="8"/><circle class="k" cx="${p.x}" cy="${p.y}" r="3.4"/></g>`; }).join("")).join("");
  const palle = PALLE.map(([x, y, c]) => `<g class="pa"><line x1="${x}" y1="${y - 9}" x2="${x}" y2="${y - 5}"/><circle cx="${x}" cy="${y}" r="5.4" fill="${c}"/><circle cx="${x - 1.8}" cy="${y - 1.9}" r="1.6" class="lu"/></g>`).join("");
  return `<svg class="na-tree ${on ? "on" : "off"}${na ? " na" : ""}${anim ? " anim" : ""}" viewBox="-104 -4 208 252" style="--b:${r1(b * 100) / 100};--tc:${col}" role="img" aria-label="${esc(t("Albero di Natale", "Christmas tree"))}">
    <defs><linearGradient id="${u}g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#2f9160"/><stop offset=".55" stop-color="#1a6a43"/><stop offset="1" stop-color="#0f4430"/></linearGradient>
      <radialGradient id="${u}a"><stop offset="0" style="stop-color:var(--tc)" stop-opacity=".55"/><stop offset="1" style="stop-color:var(--tc)" stop-opacity="0"/></radialGradient>
      <linearGradient id="${u}s" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#ffb300"/></linearGradient>
      <radialGradient id="${u}l"><stop offset="0" stop-color="#ffe08a" stop-opacity=".75"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient></defs>
    <ellipse class="alo" cx="0" cy="130" rx="104" ry="118" fill="url(#${u}a)"/>
    <ellipse cx="0" cy="240" rx="62" ry="6" class="omb"/>
    <path d="M-28 222H28L23 244H-23Z" class="vaso"/><path d="M-30 218H30V226H-30Z" class="vaso2"/>
    <rect x="-9" y="200" width="18" height="22" rx="3" class="tronco"/>
    <g fill="url(#${u}g)" class="rami">${PALCHI.map((p, i) => `<path d="${palco(p, i)}"/>`).join("")}</g>
    <g class="palle">${palle}</g>
    <g class="fili">${LUCI.map(f => `<path d="${f.d}"/>`).join("")}</g>
    <g class="bulbi">${bulbi}</g>
    <circle class="sal" cx="0" cy="14" r="26" fill="url(#${u}l)"/>
    <polygon class="stl" points="${stella}" fill="url(#${u}s)"/>
  </svg>`;
}
/** icona di una luce di festa dal nome */
export function iconaFesta(id) {
  const s = testo(id).toLowerCase();
  return /presep|nativity/.test(s) ? "🛖" : /stell|star/.test(s) ? "⭐" : /ghirland|garland|wreath/.test(s) ? "🎀" : /babbo|santa|renn|reindeer/.test(s) ? "🦌"
    : /albero|tree/.test(s) ? "🎄" : /finestr|window|balcon|terrazz|esterno|outdoor|giardin|garden|porch|portico/.test(s) ? "🏡" : /luminari|addobb|fest|natal|xmas|christmas/.test(s) ? "✨" : id.startsWith("switch.") ? "🔌" : "💡";
}

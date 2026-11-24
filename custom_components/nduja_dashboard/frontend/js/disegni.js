/* Animazioni della plancia per gli elettrodomestici: disegni in SVG fatti apposta per 'Nduja, animati solo con il CSS
   (nduja.css, «animazioni degli elettrodomestici»). Ogni disegno ha tre momenti, scelti con una classe sul contenitore:
   st-idle (fermo), st-on (in funzione, l'unico animato), st-done (finito: spunta e brillantini).
   Niente immagini esterne: pochi elementi, solo transform e opacity, fermi con prefers-reduced-motion. */
import { t } from "./core.js";

/** disegni disponibili: [chiave, nome] */
export const DISEGNI = () => [
  ["lavatrice", t("Lavatrice", "Washing machine")], ["asciugatrice", t("Asciugatrice", "Dryer")], ["lavastoviglie", t("Lavastoviglie", "Dishwasher")],
  ["forno", t("Forno", "Oven")], ["frigo", t("Frigorifero", "Fridge")], ["presa", t("Presa (generica)", "Plug (generic)")],
];
/* tipi riconosciuti dal nome (l'ordine conta: «dishwasher» contiene «washer», «lavasciuga» è una lavatrice) */
const RICONOSCI = [
  ["lavastoviglie", /lavastovigl|dishwasher/i], ["lavatrice", /lavatric|lavabianch|lavasciug|washing|washer(?!.?dryer)/i],
  ["asciugatrice", /asciugatric|dryer|tumble/i], ["forno", /forno|oven/i], ["frigo", /frigo|fridge|refrigerat|congelator|freezer/i],
];
const DA_ICONA = { "🧺": "lavatrice", "🫧": "lavatrice", "🌀": "asciugatrice", "🍽️": "lavastoviglie", "♨️": "forno", "🧊": "frigo", "🥶": "frigo", "🔌": "presa" };
/** disegno adatto a un elettrodomestico ({ id, nome, icona }), o null se non lo riconosco */
export function riconosci(a) {
  const s = (a.id || "") + " " + (a.nome || "");
  for (const [k, re] of RICONOSCI) if (re.test(s)) return k;
  return DA_ICONA[a.icona] && DA_ICONA[a.icona] !== "presa" ? DA_ICONA[a.icona] : null;
}

/* pezzi comuni */
const stella = (x, y, s) => `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;
const fatto = (x = 82, y = 16) => `<g class="spk">${[[12, 12, 4], [93, 44, 3.2], [8, 56, 3], [90, 84, 3.6]].map(([a, b, s], i) => `<path class="s${i}" d="${stella(a, b, s)}"/>`).join("")}</g>
  <g class="ok1"><circle cx="${x}" cy="${y}" r="10"/><path d="M${x - 4.6} ${y + .4}l3.2 3.3 6.2-6.8"/></g>`;
const fiocco = (x, y, i) => `<path class="fz f${i}" d="M${x - 3} ${y}h6M${x} ${y - 3}v6M${x - 2.1} ${y - 2.1}l4.2 4.2M${x - 2.1} ${y + 2.1}l4.2-4.2"/>`;
const resistenza = (y, d) => "M24 " + y + Array.from({ length: 13 }, (_, i) => `l4 ${i % 2 ? -d : d}`).join("");

/* ---------- lavatrice: oblò che gira con i panni, acqua che ondeggia, bolle ---------- */
function lavatrice(p) {
  const fori = [0, 45, 90, 135, 180, 225, 270, 315].map(g => { const r = g * Math.PI / 180; return `<circle class="foro" cx="${(50 + 15.5 * Math.cos(r)).toFixed(1)}" cy="${(60 + 15.5 * Math.sin(r)).toFixed(1)}" r="1.1"/>`; }).join("");
  return `<defs><clipPath id="${p}o"><circle cx="50" cy="60" r="18.2"/></clipPath></defs>
  <rect class="b" x="15" y="8" width="70" height="86" rx="13"/><path class="hl" d="M23 12.5h34"/>
  <path class="ln" d="M15 27h70"/><rect class="dsp" x="22" y="14" width="24" height="7" rx="3.5"/><rect class="dsx" x="25" y="16.3" width="9" height="2.4" rx="1.2"/>
  <circle class="led" cx="61" cy="17.5" r="2"/><circle class="k" cx="74" cy="17.5" r="5"/><path class="kl" d="M74 17.5v-3.4"/>
  <circle class="ring" cx="50" cy="60" r="25"/><circle class="gl" cx="50" cy="60" r="19"/>
  <g clip-path="url(#${p}o)">
    <g class="acqua"><path class="wv" d="M20 66q6-3.2 12 0t12 0t12 0t12 0t12 0t12 0V84H20Z"/></g>
    <g class="cesto">${fori}<path class="c1" d="M39 67c3-4.4 9.5-4.2 11.3.2s-2.6 8-6.6 7.2-7-3.4-4.7-7.4z"/><path class="c2" d="M52 70c2.2-3.4 8.4-3.2 9.4.8s-3.2 6.4-6.2 5.4-4.6-3.2-3.2-6.2z"/><path class="c3" d="M46 47.5c2-2.4 6.4-2.2 7.2.8s-2 5.2-4.4 4.4-4.2-2.4-2.8-5.2z"/></g>
    <g class="bolle"><circle class="q0" cx="41" cy="76" r="1.7"/><circle class="q1" cx="48" cy="78" r="2.3"/><circle class="q2" cx="56" cy="77" r="1.4"/><circle class="q3" cx="60" cy="79" r="1.9"/><circle class="q4" cx="45" cy="80" r="1.2"/></g>
  </g>
  <path class="rf" d="M37.5 52a15.5 15.5 0 0 1 9-7.6"/><rect class="k2" x="76.5" y="55" width="3.6" height="10" rx="1.8"/>
  ${fatto()}`;
}
/* ---------- asciugatrice: cestello che gira veloce, aria calda che soffia ---------- */
function asciugatrice(p) {
  return `<defs><clipPath id="${p}o"><circle cx="50" cy="60" r="18.2"/></clipPath></defs>
  <rect class="b" x="15" y="8" width="70" height="86" rx="13"/><path class="hl" d="M23 12.5h34"/>
  <path class="ln" d="M15 27h70"/><path class="k" d="M22 14.5h9M22 17.5h9M22 20.5h9"/>
  <circle class="k" cx="50" cy="17.5" r="5.6"/><path class="kl" d="M50 17.5l3-2.6"/><circle class="led" cx="76" cy="17.5" r="2"/>
  <circle class="ring" cx="50" cy="60" r="25"/><circle class="gl" cx="50" cy="60" r="19"/>
  <g clip-path="url(#${p}o)">
    <g class="caldo"><circle cx="50" cy="60" r="18"/></g>
    <g class="aria"><path d="M36 58a14 14 0 0 1 18-11"/><path d="M64 62a14 14 0 0 1-18 11"/></g>
    <g class="cesto"><path class="c1" d="M38 64c3-4.4 9.5-4.2 11.3.2s-2.6 8-6.6 7.2-7-3.4-4.7-7.4z"/><path class="c2" d="M53 67c2.2-3.4 8.4-3.2 9.4.8s-3.2 6.4-6.2 5.4-4.6-3.2-3.2-6.2z"/><path class="c3" d="M44 46c2-2.4 6.4-2.2 7.2.8s-2 5.2-4.4 4.4-4.2-2.4-2.8-5.2z"/><path class="c4" d="M57 51c1.8-2 5.4-1.8 6 .8s-1.8 4.2-3.8 3.6-3.4-2.2-2.2-4.4z"/></g>
    <g class="pel"><circle class="q0" cx="42" cy="70" r="1"/><circle class="q1" cx="58" cy="56" r=".9"/><circle class="q2" cx="50" cy="74" r=".8"/></g>
  </g>
  <path class="rf" d="M37.5 52a15.5 15.5 0 0 1 9-7.6"/><rect class="k2" x="38" y="88" width="24" height="2.6" rx="1.3"/>
  ${fatto()}`;
}
/* ---------- lavastoviglie: braccio che gira, spruzzi d'acqua, vapore che esce ---------- */
function lavastoviglie(p) {
  return `<defs><clipPath id="${p}o"><rect x="22.5" y="42.5" width="55" height="45" rx="6.5"/></clipPath></defs>
  <g class="vap"><path class="v0" d="M38 16c-3-3 3-5 0-8s3-5 0-7"/><path class="v1" d="M50 15c-3-3 3-5 0-8s3-5 0-7"/><path class="v2" d="M62 16c-3-3 3-5 0-8s3-5 0-7"/></g>
  <rect class="b" x="14" y="18" width="72" height="76" rx="12"/><path class="hl" d="M22 22h34"/>
  <path class="ln" d="M14 32h72"/><rect class="dsp" x="22" y="22.2" width="16" height="6" rx="3"/>
  <circle class="led" cx="66" cy="25.2" r="1.7"/><circle class="k" cx="72.5" cy="25.2" r="1.7"/><circle class="k" cx="79" cy="25.2" r="1.7"/>
  <rect class="k2" x="34" y="35.4" width="32" height="3.2" rx="1.6"/>
  <rect class="gl" x="22" y="42" width="56" height="46" rx="7"/>
  <g clip-path="url(#${p}o)">
    <g class="nebbia"><rect x="22" y="42" width="56" height="46"/></g>
    <path class="k" d="M26 58h48M30 58v-2M42 58v-2M54 58v-2M66 58v-2M26 80h48"/>
    <path class="c1" d="M31 50.5h7v4.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z"/><path class="c2" d="M46.5 50.5h7v4.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z"/><path class="c3" d="M62 50.5h7v4.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z"/>
    <ellipse class="pi" cx="32" cy="72" rx="2.4" ry="7.4"/><ellipse class="pi" cx="39" cy="72" rx="2.4" ry="7.4"/><ellipse class="pi" cx="46" cy="72" rx="2.4" ry="7.4"/><path class="pi" d="M54 74a8 8 0 0 0 16 0z"/>
    <g class="gocce"><circle class="q0" cx="38" cy="84" r="1.1"/><circle class="q1" cx="45" cy="84" r="1.3"/><circle class="q2" cx="55" cy="84" r="1.1"/><circle class="q3" cx="62" cy="84" r="1.3"/><circle class="q4" cx="50" cy="84" r="1"/></g>
    <rect class="braccio" x="34" y="83" width="32" height="2.6" rx="1.3"/>
  </g>
  ${fatto(82, 24)}`;
}
/* ---------- forno: resistenze che si accendono, luce calda, aria che trema ---------- */
function forno(p) {
  return `<defs><clipPath id="${p}o"><rect x="18.5" y="41.5" width="63" height="39" rx="6.5"/></clipPath></defs>
  <rect class="b" x="10" y="14" width="80" height="76" rx="12"/><path class="hl" d="M18 18h38"/>
  <path class="ln" d="M10 30h80"/><circle class="k" cx="22" cy="22" r="4.5"/><path class="kl kn1" d="M22 22v-3.2"/><circle class="k" cx="78" cy="22" r="4.5"/><path class="kl kn2" d="M78 22l2.3-2.3"/>
  <rect class="dsp" x="38" y="18.5" width="24" height="7" rx="3.5"/><rect class="dsx" x="44" y="20.8" width="12" height="2.4" rx="1.2"/>
  <rect class="k2" x="24" y="33.6" width="52" height="3.4" rx="1.7"/>
  <rect class="in" x="18" y="41" width="64" height="40" rx="7"/>
  <g clip-path="url(#${p}o)">
    <rect class="luce" x="18" y="41" width="64" height="40"/>
    <path class="res alone" d="${resistenza(46, 3)}"/><path class="res" d="${resistenza(46, 3)}"/>
    <path class="res alone" d="${resistenza(76, -3)}"/><path class="res" d="${resistenza(76, -3)}"/>
    <path class="k" d="M26 68.5h48"/><path class="cibo" d="M36 68a14 9 0 0 1 28 0z"/><path class="cib2" d="M42 64.5q3-1.6 6 0M52 63.5q3-1.6 6 0"/>
    <g class="trem"><path class="v0" d="M33 62c-2-2.5 2-4 0-6.5s2-4 0-6.5"/><path class="v1" d="M50 59c-2-2.5 2-4 0-6.5s2-4 0-6.5"/><path class="v2" d="M67 62c-2-2.5 2-4 0-6.5s2-4 0-6.5"/></g>
  </g>
  <rect class="gl0" x="18" y="41" width="64" height="40" rx="7"/>
  <rect class="k2" x="18" y="90" width="9" height="3" rx="1.5"/><rect class="k2" x="73" y="90" width="9" height="3" rx="1.5"/>
  ${fatto(84, 18)}`;
}
/* ---------- frigorifero: fiocchi di neve e un alone freddo che respira ---------- */
function frigo() {
  return `<rect class="alfr" x="26" y="6" width="48" height="88" rx="10"/>
  <rect class="b" x="26" y="6" width="48" height="88" rx="10"/><path class="hl" d="M33 10.5h18"/>
  <path class="ln" d="M26 34h48"/><rect class="k2" x="65" y="14" width="3.2" height="13" rx="1.6"/><rect class="k2" x="65" y="42" width="3.2" height="24" rx="1.6"/>
  <rect class="dsp" x="33" y="42" width="17" height="9" rx="2.6"/><rect class="dsx" x="36" y="45.3" width="7" height="2.4" rx="1.2"/>
  <path class="k" d="M33 87h34M36 90h28"/>
  ${[[37, 18], [55, 24], [43, 64], [57, 76], [36, 80]].map(([x, y], i) => fiocco(x, y, i)).join("")}
  ${fatto(80, 14)}`;
}
/* ---------- presa (generica): spia che si accende, energia che scorre nel cavo ---------- */
function presa() {
  return `<path class="cavo" d="M50 72c0 12 20 8 20 22"/><path class="flusso" d="M50 72c0 12 20 8 20 22"/>
  <rect class="b" x="26" y="12" width="48" height="60" rx="17"/><path class="hl" d="M35 16.5h18"/>
  <circle class="ledr" cx="50" cy="26.5" r="8"/><path class="lamp" d="M52.6 18.6l-6.4 8.8h4.4l-2.4 6.8 7-9.4h-4.4l2.2-6.2z"/>
  <circle class="gl" cx="50" cy="52" r="13"/><circle class="k3" cx="44" cy="52" r="2.6"/><circle class="k3" cx="56" cy="52" r="2.6"/>
  ${fatto(80, 14)}`;
}
const FN = { lavatrice, asciugatrice, lavastoviglie, forno, frigo, presa };

/** svg di un disegno: kind (chiave di DISEGNI), k (on | done | idle), key (unico nella pagina, per i ritagli) */
export function disegno(kind, k, key) {
  const f = FN[kind] || presa, p = "nd" + String(key || kind).replace(/[^\w-]/g, "_") + "_";
  return `<svg class="apd1 d-${FN[kind] ? kind : "presa"} st-${k}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${f(p)}</svg>`;
}

/* ================= disegni grandi delle schede oggetto (oggetti.js) =================
   Fatti a mano per 'Nduja, animati solo col CSS di css/oggetti.css. Lo stato è una classe sull'SVG:
   cancello e porta s-closed | s-open | s-opening | s-closing | s-jammed | s-na (stato non noto), robot r-cleaning | r-docked | …;
   «off» = non raggiungibile. Usano le stesse variabili di colore dei disegni degli elettrodomestici (--apb, --aps, --apk…),
   quindi tema chiaro e scuro vengono da soli dentro .apv1. */

/* ---------- cancello scorrevole: l'anta scorre dietro il muretto ---------- */
const sbarre = (x0, x1, y0, y1, passo) => { let d = ""; for (let x = x0; x <= x1 + .01; x += passo) d += `M${x.toFixed(1)} ${y0}V${y1}`; return d; };
function cancelloScorrevole() {
  return `<ellipse class="omb" cx="120" cy="150" rx="114" ry="9"/><path class="via" d="M86 170 104 146H186L204 170Z"/>
  <path class="bin" d="M4 147.5H204"/>
  <g class="anta sc"><rect class="lf" x="72" y="56" width="126" height="88" rx="3"/><path class="tel" d="M72 56h126v88H72zM72 100h126"/>
    <path class="sb" d="${sbarre(82.5, 188, 56, 144, 10.5)}"/><circle class="ruota" cx="86" cy="146" r="3"/><circle class="ruota" cx="184" cy="146" r="3"/></g>
  <g class="muro"><rect class="mu" x="2" y="50" width="70" height="97" rx="2"/><path class="mt" d="M2 66h70M2 82h70M2 98h70M2 114h70M2 130h70M20 50v16M48 66v16M20 82v16M48 98v16M20 114v16M48 130v17"/><rect class="cap" x="0" y="44" width="74" height="8" rx="3"/></g>
  <g class="pil"><rect class="mu" x="198" y="40" width="24" height="107" rx="2"/><rect class="cap" x="194" y="34" width="32" height="8" rx="3"/></g>
  <g class="lamp"><rect class="lb" x="204" y="26" width="12" height="8" rx="2"/><path class="lv" d="M204 26a6 7 0 0 1 12 0z"/><circle class="la" cx="210" cy="22" r="13"/></g>`;
}
/* ---------- cancello a battente: due ante che girano sui cardini ---------- */
function anta(x0, x1, lato) {
  /* il bordo in alto sale verso il centro: curva da (x0, y0) a (x1, y1) con il punto di controllo a metà (x varia in modo lineare) */
  const [y0, y1] = lato === "l" ? [60, 46] : [46, 60], yc = 48, d = `M${x0} ${y0}Q${(x0 + x1) / 2} ${yc} ${x1} ${y1}V140H${x0}Z`;
  let sb = ""; for (let x = x0 + 9; x < x1 - 3; x += 9) { const u = (x - x0) / (x1 - x0), yt = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * yc + u * u * y1; sb += `M${x.toFixed(1)} ${(yt + 1).toFixed(1)}V140`; }
  return `<g class="anta bt ${lato}"><path class="lf" d="${d}"/><path class="tel" d="${d}M${x0} 104H${x1}"/><path class="sb" d="${sb}"/></g>`;
}
function cancelloBattente() {
  return `<ellipse class="omb" cx="120" cy="150" rx="114" ry="9"/><path class="via" d="M78 170 98 146H142L162 170Z"/>
  ${anta(42, 119, "l")}${anta(121, 198, "r")}
  <g class="pil"><rect class="mu" x="16" y="34" width="26" height="113" rx="2"/><rect class="cap" x="12" y="28" width="34" height="8" rx="3"/>
    <rect class="mu" x="198" y="34" width="26" height="113" rx="2"/><rect class="cap" x="194" y="28" width="34" height="8" rx="3"/></g>
  <g class="lamp"><rect class="lb" x="205" y="20" width="12" height="8" rx="2"/><path class="lv" d="M205 20a6 7 0 0 1 12 0z"/><circle class="la" cx="211" cy="16" r="13"/></g>`;
}
/* ---------- cancelletto pedonale: un'anta tra la recinzione ---------- */
function cancelletto() {
  const rete = x0 => { let d = ""; for (let x = x0 + 8; x < x0 + 64; x += 9) d += `M${x} 92V146`; return `<path class="sb" d="${d}M${x0} 98H${x0 + 66}M${x0} 140H${x0 + 66}"/>`; };
  return `<ellipse class="omb" cx="120" cy="150" rx="114" ry="9"/><path class="via" d="M98 170 106 146H134L142 170Z"/>
  <g class="rec">${rete(2)}${rete(172)}</g>
  <g class="anta bt l1"><path class="lf" d="M90 72Q120 60 150 72V142H90Z"/><path class="tel" d="M90 72Q120 60 150 72V142H90ZM90 106H150"/><path class="sb" d="${sbarre(98, 142, 70, 142, 7.4)}"/><circle class="man" cx="144" cy="108" r="2.4"/></g>
  <g class="pil"><rect class="mu" x="70" y="58" width="20" height="89" rx="2"/><rect class="cap" x="67" y="53" width="26" height="7" rx="3"/>
    <rect class="mu" x="150" y="58" width="20" height="89" rx="2"/><rect class="cap" x="147" y="53" width="26" height="7" rx="3"/></g>`;
}
const CANC = { scorrevole: cancelloScorrevole, battente: cancelloBattente, cancelletto };
/** il cancello grande: tipo scorrevole | battente | cancelletto, k = stato (open, closed, opening, closing, jammed, na), off = non raggiungibile */
export function disegnoCancello(tipo, k, o = {}) {
  const f = CANC[tipo] || cancelloScorrevole;
  return `<svg class="ogd1 og-cg t-${CANC[tipo] ? tipo : "scorrevole"} s-${k || "na"}${o.off ? " off" : ""}${o.tieni ? " tieni" : ""}" viewBox="0 0 240 170" aria-hidden="true" focusable="false">${f()}
    <g class="qq"><circle cx="120" cy="30" r="11"/><path d="M116.4 27a3.8 3.8 0 1 1 5.4 3.4c-1.2.6-1.8 1.3-1.8 2.6M120 37.2v.2"/></g></svg>`;
}

/* ---------- porta con serratura: la chiave gira, il catenaccio entra ed esce, la porta si socchiude su «apri» ---------- */
export function disegnoPorta(k, o = {}) {
  return `<svg class="ogd1 og-pt s-${k || "na"}${o.off ? " off" : ""}" viewBox="0 0 200 210" aria-hidden="true" focusable="false">
  <ellipse class="omb" cx="100" cy="199" rx="88" ry="7"/>
  <rect class="mur" x="30" y="6" width="140" height="192" rx="4"/>
  <rect class="fuori" x="52" y="20" width="96" height="178"/><rect class="luce" x="52" y="20" width="96" height="178"/>
  <g class="anta"><rect class="lf" x="52" y="20" width="96" height="178" rx="2"/>
    <rect class="pan" x="64" y="34" width="72" height="64" rx="4"/><rect class="pan" x="64" y="112" width="72" height="72" rx="4"/>
    <rect class="cat" x="141" y="127" width="11" height="6" rx="2"/>
    <rect class="plc" x="123" y="94" width="16" height="50" rx="8"/><path class="mng" d="M131 104h-19"/><circle class="mng0" cx="131" cy="104" r="4.4"/>
    <circle class="anello" cx="131" cy="129" r="11"/><circle class="cil" cx="131" cy="129" r="6.8"/>
    <g class="chiave"><path class="ks" d="M131 129v17"/><path class="kd" d="M131 138h3.6M131 142h2.8"/><rect class="kh" x="124" y="145" width="14" height="14" rx="7"/><circle class="kf" cx="131" cy="152" r="2.4"/></g></g>
  <path class="tel" d="M48 198V16h104v182"/><path class="sog" d="M40 198h120"/>
  <rect class="zer" x="66" y="200" width="68" height="7" rx="2"/></svg>`;
}

/* ---------- robot aspirapolvere: visto dall'alto, sul pavimento con la sua base ---------- */
export function disegnoRobot(k, o = {}) {
  const pol = [[44, 30], [96, 52], [168, 34], [204, 80], [58, 96], [150, 98], [92, 120], [196, 124], [36, 140]].map(([x, y], i) => `<circle class="p${i % 4}" cx="${x}" cy="${y}" r="${1.4 + (i % 3) * .5}"/>`).join("");
  const spaz = (x, y) => `<g transform="translate(${x} ${y})"><g class="spz"><circle class="bb" r="9"/><path d="M0 0l8-3M0 0l-1.6 8.4M0 0l-6.4-5.4"/><circle r="1.8"/></g></g>`;   // .bb: cerchio invisibile, così la spazzola gira sul suo centro
  /* piccolo (Home, elenchi): solo il robot, fermo al centro, senza pavimento né base */
  return `<svg class="ogd1 og-rb r-${k}${o.off ? " off" : ""}${o.carica ? " carica" : ""}${o.piccolo ? " pc" : ""}" viewBox="${o.piccolo ? "84 50 72 72" : "0 0 240 180"}" aria-hidden="true" focusable="false">
  <rect class="pav" x="6" y="6" width="228" height="168" rx="22"/><path class="fug" d="M6 62h228M6 118h228M82 6v168M158 6v168"/>
  <path class="sc" d="M60 40H180V72H60V104H180"/><path class="rit" d="M184 64Q150 92 120 136"/>
  <g class="pol">${pol}</g>
  <g class="dock"><rect class="db" x="94" y="158" width="52" height="16" rx="6"/><rect class="dl" x="114" y="162" width="12" height="3.4" rx="1.7"/></g>
  <g class="rbm"><g class="rb">
    <circle class="ombr" cx="2" cy="4" r="30"/>
    <circle class="b" r="28"/><path class="bump" d="M-24.2-14a28 28 0 0 1 48.4 0"/><circle class="tur" cy="-4" r="9"/><circle class="lid" cy="-4" r="9" pathLength="100"/>
    ${spaz(-17, -19)}${spaz(17, -19)}
    <circle class="led" cy="12" r="2.6"/><path class="bolt" d="M1.6 3.6-3 10.4h3.2L-1.4 16.4 4 9.2H.8l2-5.6z"/>
    <g class="ps"><rect x="-4.6" y="-9" width="3.2" height="10" rx="1.2"/><rect x="1.4" y="-9" width="3.2" height="10" rx="1.2"/></g>
    <g class="err"><circle cx="20" cy="-24" r="9"/><path d="M20-29.4v6M20-19.6v.2"/></g>
  </g></g>
  <g class="zz"><path d="M150 112h7l-7 8h7M163 100h5l-5 6h5"/></g></svg>`;
}

/* ---------- cassa: il woofer che pompa, le onde che escono (tante quanto il volume), pausa e muto ---------- */
/** la cassa disegnata: k = play | pausa | on (accesa e zitta) | off | na; vol (0–1) decide quante onde; muta; piccolo (Home, elenchi: solo la cassa) */
export function disegnoCassa(k, o = {}) {
  const v = o.vol == null ? 2 : o.vol < .34 ? 1 : o.vol < .67 ? 2 : 3, cx = 100, cy = 124;
  const arco = (r, lato) => { const a = 28 * Math.PI / 180, x = r * Math.cos(a), y = r * Math.sin(a), s = lato === "d" ? 1 : -1;
    return `M${(cx + s * x).toFixed(1)} ${(cy - y).toFixed(1)}A${r} ${r} 0 0 ${lato === "d" ? 1 : 0} ${(cx + s * x).toFixed(1)} ${(cy + y).toFixed(1)}`; };
  const onde = lato => [56, 70, 84].map((r, i) => `<path class="w w${i + 1}" d="${arco(r, lato)}"/>`).join("");
  return `<svg class="ogd1 og-cs s-${k} v${v}${o.muta ? " muta" : ""}${o.piccolo ? " pc" : ""}" viewBox="${o.piccolo ? "50 6 100 188" : "0 0 200 200"}" aria-hidden="true" focusable="false">
  <ellipse class="omb" cx="100" cy="192" rx="56" ry="5"/>
  <g class="ond od">${onde("d")}</g><g class="ond os">${onde("s")}</g>
  <rect class="b" x="56" y="12" width="88" height="176" rx="16"/><rect class="pan" x="63" y="19" width="74" height="162" rx="11"/>
  <circle class="tw" cx="100" cy="52" r="13"/><circle class="twd" cx="100" cy="52" r="6"/>
  <g class="wf"><circle class="acc" cx="${cx}" cy="${cy}" r="35"/><circle class="sur" cx="${cx}" cy="${cy}" r="31"/><circle class="cono" cx="${cx}" cy="${cy}" r="25"/>
    <circle class="ri" cx="${cx}" cy="${cy}" r="19"/><circle class="ri" cx="${cx}" cy="${cy}" r="13.5"/><circle class="cap" cx="${cx}" cy="${cy}" r="8.5"/></g>
  <g class="ps"><rect x="93" y="113" width="5" height="22" rx="2"/><rect x="102" y="113" width="5" height="22" rx="2"/></g>
  <g class="mu"><circle cx="160" cy="88" r="11"/><path d="M155 83l10 10M165 83l-10 10"/></g>
  <circle class="led" cx="100" cy="174" r="2.6"/>
  <g class="qq"><circle cx="100" cy="124" r="11"/><path d="M96.4 121a3.8 3.8 0 1 1 5.4 3.4c-1.2.6-1.8 1.3-1.8 2.6M100 131.2v.2"/></g></svg>`;
}

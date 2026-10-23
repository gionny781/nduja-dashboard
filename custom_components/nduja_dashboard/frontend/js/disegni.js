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

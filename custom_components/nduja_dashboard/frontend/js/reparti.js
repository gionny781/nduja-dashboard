/* Reparti della spesa (pagina Liste): un dizionario semplice, scritto per 'Nduja, che mette ogni voce nel suo reparto
   (frutta e verdura, latticini, pane…). Italiano e inglese, senza accenti né maiuscole.
   Come decide: prima le frasi intere («carta igienica»), poi la prima parola che conosce («latte di soia» → latte).
   Le parole valgono anche al plurale (mela/mele, pomodoro/pomodori, egg/eggs); con «*» finale valgono come inizio di parola.
   Il reparto scelto a mano da qualcuno di casa vince sempre (lo ricorda la pagina Liste). */
import { t } from "./core.js";

/** reparti nell'ordine di un giro tipico al supermercato */
export const REPARTI = () => [
  ["frutta", "🍎", t("Frutta e verdura", "Fruit and veg")],
  ["pane", "🥖", t("Pane e forno", "Bakery")],
  ["latte", "🧀", t("Latticini e uova", "Dairy and eggs")],
  ["carne", "🥩", t("Carne e pesce", "Meat and fish")],
  ["dispensa", "🍝", t("Pasta e dispensa", "Pantry")],
  ["colazione", "☕", t("Colazione e dolci", "Breakfast and sweets")],
  ["surgelati", "🧊", t("Surgelati", "Frozen")],
  ["bevande", "🥤", t("Bevande", "Drinks")],
  ["casa", "🧽", t("Casa e pulizia", "Household")],
  ["igiene", "🧴", t("Igiene e cura", "Personal care")],
  ["animali", "🐾", t("Animali", "Pets")],
  ["altro", "🛒", t("Altro", "Other")],
];
export const reparto = k => REPARTI().find(r => r[0] === k) || REPARTI().at(-1);

const PAROLE = {
  frutta: `frutta verdura insalat* lattuga rucola spinaci valeriana pomodoro pomodorin* patata cipolla aglio carota zucchina melanzana peperone cetriolo sedano
    finocchio broccolo cavolo cavolfiore verza carciofo asparago fagiolini funghi fungo zucca porro radicchio basilico prezzemolo rosmarino salvia menta
    mela pera banana arancia limone mandarino clementina uva fragola kiwi ananas pesca albicocca ciliegia anguria melone avocado lampone mirtillo fico
    castagna lime zenzero cocco prugna susina melagrana rapa ravanello bietola cicoria scarola friarielli germogli
    apple pear banana orange lemon grape strawberr* tomato potato onion garlic carrot lettuce salad spinach cucumber zucchini courgette mushroom
    broccoli cauliflower cabbage celery herbs parsley basil vegetables veggies fruit berries blueberr* raspberr* cherr* peach plum melon`,
  pane: `pane panin* pancarre piadina focaccia pizza grissino cracker tarallo crostino baguette bauletto ciabatta rosetta tramezzin* panettone pandoro
    bread roll bun toast tortilla bagel wrap pita`,
  latte: `latte yogurt* yoghurt* formaggio formaggin* mozzarell* burrata ricotta mascarpone parmigiano grana pecorino gorgonzola stracchino scamorza provola
    fontina asiago emmental philadelphia stracciatella crescenza taleggio burro panna uovo kefir skyr
    milk cheese butter cream egg cheddar`,
  carne: `carne pollo tacchino manzo vitello maiale macinato macinata bistecca braciola salsicc* hamburger cotoletta arrosto agnello coniglio wurstel wurst
    prosciutt* salame mortadella speck bresaola pancetta guanciale affettat* cotechino pesce salmone merluzzo orata branzino spigola gamberi gamberett*
    cozze vongole calamari polpo seppia alici acciughe baccala sogliola trota
    chicken beef pork turkey ham bacon sausage fish salmon shrimp prawns mince steak meat lamb`,
  dispensa: `pasta spaghetti penne fusilli rigatoni tagliatelle lasagne gnocchi tortellini ravioli riso farina sale olio aceto passata pelati sugo pesto tonno
    legumi ceci lenticchie fagioli piselli mais olive capperi brodo dado spezie pepe origano curry paprika lievito pangrattato maionese ketchup senape
    quinoa couscous orzo farro polenta noci mandorle nocciole pistacchi arachidi patatine salatini popcorn salsa scatolame sottaceti
    rice flour salt oil vinegar beans chickpeas lentils sauce stock spices noodles pepper mayo mustard crisps chips nuts`,
  colazione: `caffe cappuccino te tisana camomilla biscott* cereal* muesli granola marmellata confettura nutella miele cacao cioccolat* merendin* crostata
    zucchero dolci torta budino gelatina caramelle wafer savoiardi
    coffee tea cookie biscuit cereal honey jam chocolate sugar cake candy sweets`,
  surgelati: `surgel* gelato ghiaccio bastoncini sofficini minestrone frozen ice`,
  bevande: `acqua vino birra succo bibita aranciata coca cola gassosa spremuta tonica aperol prosecco spumante liquore whisky gin vodka rum chinotto
    energy water wine beer juice soda lemonade`,
  casa: `detersivo ammorbidente candeggina varechina sgrassatore anticalcare spugna strofinacci scottex tovagliolo tovaglioli pellicola alluminio sacchett*
    sacchi pattumiera lampadina pile batteria brillantante pastiglie piatti bicchieri posate candela insetticida zanzar* carta stuzzicadenti
    detergent sponge foil bags bin bulb batteries dishwasher napkins`,
  igiene: `shampoo* bagnoschiuma balsamo sapone saponetta dentifricio spazzolin* collutorio deodorante rasoio lamette assorbent* tampon* pannolin* salviett*
    cotone cotton dischetti cerotti fazzolett* profumo smalto struccante medicin* aspirina tachipirina
    soap toothpaste toothbrush deodorant razor nappies diapers tissues wipes plasters`,
  animali: `gatto gatti cane cani lettiera sabbietta croccantini bocconcini scatolette antiparassitario
    cat dog litter`,
};
/** frasi intere, prima di guardare le parole una per una */
const FRASI = [
  ["carta igienica", "igiene"], ["filo interdentale", "igiene"], ["crema solare", "igiene"], ["schiuma da barba", "igiene"],
  ["carta forno", "casa"], ["carta da forno", "casa"], ["carta assorbente", "casa"], ["sale lavastoviglie", "casa"], ["sale per lavastoviglie", "casa"],
  ["detersivo piatti", "casa"], ["sacchi spazzatura", "casa"], ["fette biscottate", "colazione"], ["pan grattato", "dispensa"], ["pane grattato", "dispensa"], ["pane grattugiato", "dispensa"], ["pan di spagna", "colazione"],
  ["latte di cocco", "dispensa"], ["crema pasticcera", "colazione"], ["panna da cucina", "latte"], ["toilet paper", "igiene"], ["kitchen roll", "casa"],
  ["paper towels", "casa"], ["ice cream", "surgelati"], ["ice tea", "bevande"], ["te freddo", "bevande"], ["estathe", "bevande"], ["peanut butter", "dispensa"], ["cibo gatto", "animali"], ["cibo cane", "animali"],
];
const VUOTE = new Set("di da del dello della dei degli delle al allo alla ai agli alle per e ed con senza in un uno una il lo la i gli le of the for and with a an some x kg g gr l ml cl pz pezzi conf confezione confezioni pacco pacchi bottiglia bottiglie vasetto vasetti barattolo lattina lattine scatola busta".split(" "));

/** testo semplice per confrontare le voci: minuscole, senza accenti, senza quantità («2 kg», «x3», «500g») */
export function chiave(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´]/g, " ").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(x\s*\d+|\d+\s*x|\d+([.,]\d+)?\s*(kg|g|gr|l|ml|cl|pz|pezzi)?)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
/* radice per singolare/plurale: «pomodori» e «pomodoro» → «pomodor», «eggs» → «egg» */
const radice = w => w.replace(/(?<=..)(es|s)$/, "").replace(/(?<=...)[aeio]$/, "");
const ESATTE = new Map(), RADICI = new Map(), INIZI = [];
for (const [rep, testo] of Object.entries(PAROLE)) for (const p of testo.split(/\s+/).filter(Boolean)) {
  const w = p.replace(/_/g, " ");
  if (w.endsWith("*")) { INIZI.push([w.slice(0, -1), rep]); continue; }
  ESATTE.set(w, rep);
  const r = radice(w);
  if (RADICI.has(r) && RADICI.get(r) !== rep) RADICI.set(r, null);   // radice che vale per due reparti (pesca/pesce): non la uso
  else RADICI.set(r, rep);
}
function parola(w) {
  if (ESATTE.has(w)) return ESATTE.get(w);
  const r = RADICI.get(radice(w)); if (r) return r;
  for (const [ini, rep] of INIZI) if (w.startsWith(ini)) return rep;
  return null;
}
/** reparto indovinato dal dizionario: chiave del reparto o "altro" */
export function repartoAuto(testo) {
  const k = chiave(testo); if (!k) return "altro";
  for (const [f, rep] of FRASI) if ((" " + k + " ").includes(" " + f + " ")) return rep;
  if (ESATTE.has(k)) return ESATTE.get(k);
  if (/\b(surgel|frozen)/.test(k)) return "surgelati";   // «pizza surgelata», «frozen peas»
  for (const w of k.split(" ")) { if (VUOTE.has(w) || w.length < 2) continue; const rep = parola(w); if (rep) return rep; }
  return "altro";
}

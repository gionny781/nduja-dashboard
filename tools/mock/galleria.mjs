// Galleria del README e della guida: per ogni pagina un'immagine con il tablet (tema scuro) e il telefono (tema chiaro),
// fatta sul finto Home Assistant e salvata in WebP compresso in docs/galleria/.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):
//   node tools/mock/galleria.mjs              tutte le immagini
//   node tools/mock/galleria.mjs home meteo   solo quelle con questi nomi
// Variabili: OUT=cartella (predefinita docs/galleria), Q=qualità WebP 0-1 (predefinita 0.8), RAW=1 salva anche i PNG dei due schermi.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const ORA = "2026-11-25T11:00";          // un mercoledì mattina con il sole: stessa ora per tutte, così le immagini restano coerenti
const OUT = process.env.OUT || "docs/galleria", Q = +(process.env.Q || 0.8);
const casa3d = () => import("node:fs").then(fs => fs.readFileSync("tools/mock/casa3d.json", "utf8").replace(/\n/g, ""));

/* nome del file · pagina · scelte del finto Home Assistant (LS) · clic sul tablet | clic sul telefono (facoltativi) */
const G = [
  { n: "home", p: "home" },
  { n: "home-chiaro", p: "home", inverti: true },
  { n: "colpo", p: "colpo" },
  { n: "mappa", p: "mappa", ls: { mockPiani: "1" }, lay: "3d" },
  { n: "mappa-3d", p: "mappa", ls: { mockPiani: "1", nduja_map3: "1", nduja_map3cut: "1" }, lay: "3d" },
  { n: "luci", p: "luci" },
  { n: "energia", p: "energia" },
  { n: "acqua", p: "acqua" },
  { n: "meteo", p: "meteo" },
  { n: "clima", p: "clima" },
  { n: "caldaia", p: "caldaia" },
  { n: "aria", p: "aria" },
  { n: "tapparelle", p: "tapparelle" },
  { n: "dispositivi", p: "dispositivi" },
  { n: "batterie", p: "batterie" },
  { n: "elettrodomestici", p: "elettrodomestici" },
  { n: "musica", p: "musica" },
  { n: "media", p: "media" },
  { n: "robot", p: "robot" },
  { n: "irrigazione", p: "irrigazione" },
  { n: "piante", p: "piante", ls: { mockPianteDemo: "1" } },
  { n: "auto", p: "auto" },
  { n: "sicurezza", p: "sicurezza" },
  { n: "telecamere", p: "telecamere" },
  { n: "calendario", p: "calendario" },
  { n: "liste", p: "liste" },
  { n: "scadenze", p: "scadenze" },
  { n: "faccende", p: "faccende" },
  { n: "bacheca", p: "bacheca" },
  { n: "chat", p: "chat", ls: { mockChatDemo: "1" }, tel: '[data-act="ktApri"][data-id="famiglia"]' },
  { n: "squadra", p: "squadra" },
  { n: "formula1", p: "formula1", ls: { mockF1Live: "gara" } },
  { n: "natale", p: "natale", ora: "2026-12-12T18:30" },
  { n: "automazioni", p: "automazioni" },
  { n: "rete", p: "rete" },
  { n: "aggiornamenti", p: "aggiornamenti" },
  { n: "impostazioni", p: "impostazioni", ls: { nduja_ssMin: "5" } },
  { n: "oggetti", p: "sicurezza", tab: '[data-k="cancello:cover.cancello"]', tel: '[data-k="clima:climate.cucina"]', telPagina: "clima" },
  { n: "assistente", p: "home", tab: '[data-act="vcApri"]', tel: '#vc1fab|[data-act="vcFrase"] >> nth=0' },
  { n: "salvaschermo", p: "impostazioni", ls: { nduja_ssMin: "5", nduja_ssStile: "solare" }, tab: '[data-act="ssProva"] >> nth=0', telLs: { nduja_ssMin: "5", nduja_ssStile: "orologio" }, tel: '[data-act="ssProva"] >> nth=0' },
  { n: "benvenuto", p: "benvenuto", lay: '{"configured":false}' },
  { n: "riepilogo", p: "benvenuto", lay: '{"configured":false}', ls: { mockPiani: "1" }, tab: '[data-act="wAuto"]', tel: '[data-act="wAuto"]' },
  { n: "wizard", p: "benvenuto", lay: '{"configured":false}', tab: '[data-act="wAuto"]|[data-act="wAutoScegli"]', tel: '[data-act="wManual"]' },
  { n: "controlla", p: "impostazioni", tab: '[data-act="hcVai"]', tel: '[data-act="hcVai"]', scorri: ".hc1" },
  { n: "errore", p: "home", ls: { mockNoData: "1" }, attesa: 16000 },
];

/* per le schermate, al posto del peperoncino di prova: le immagini delle telecamere e la mappa del robot disegnate in tools/mock */
const IMMAGINI = { "camera.porta_ingresso": "cam-ingresso.svg", "camera.garage": "cam-garage.svg", "camera.garage_sub_stream": "cam-garage.svg",
  "camera.ambrogio_map": "mappa-robot.svg", "camera.ambrogio_map_data": "mappa-robot.svg" };
const BASE = Object.fromEntries(Object.entries(IMMAGINI).map(([id, f]) => [id, [id === "camera.porta_ingresso" ? "recording" : "idle", { entity_picture: "/tools/mock/" + f }]]));

const solo = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
mkdirSync(OUT, { recursive: true });

async function schermo(g, w, h, chiaro, tel) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("pageerror", e => console.log("PAGEERR", g.n, e.message));
  await p.clock.setFixedTime(new Date(g.ora || ORA));
  await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
  const lay = g.lay === "3d" ? await casa3d() : g.lay || "";
  const ls = { ...(g.ls || {}), ...(tel && g.telLs || {}) };
  ls.mockEnt = JSON.stringify({ ...BASE, ...JSON.parse(ls.mockEnt || "{}") });
  await p.evaluate(([lay, chiaro, ls]) => { localStorage.clear(); if (lay) localStorage.setItem("mockLayout", lay); if (chiaro) localStorage.setItem("nduja_theme", "light");
    for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }, [lay, chiaro, ls]);
  await p.reload(); await p.waitForTimeout(2500);
  const f = p.frames()[1];
  await f.evaluate(id => location.hash = id, tel && g.telPagina || g.p); await p.waitForTimeout(1800);
  for (const sel of ((tel ? g.tel : g.tab) || "").split("|").filter(Boolean)) { await f.click(sel).catch(() => console.log("CLICK FAIL", g.n, sel)); await p.waitForTimeout(900); }
  if (g.scorri) await f.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: "start" }), g.scorri);
  await p.waitForTimeout(g.attesa || 600);
  const png = await p.screenshot();
  await p.close();
  return png;
}

/* tablet e telefono uno accanto all'altro, con la cornice disegnata qui; sfondo trasparente */
async function componi(tab, tel) {
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const url = await p.evaluate(async ([a, c, q]) => {
    const img = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
    const A = await img(a), C = await img(c);
    const bt = 16, bp = 12, gap = 40;
    const tw = A.width + bt * 2, th = A.height + bt * 2, pw = C.width + bp * 2, ph = C.height + bp * 2;
    const cv = document.createElement("canvas"); cv.width = tw + gap + pw; cv.height = Math.max(th, ph);
    const x = cv.getContext("2d");
    const rr = (X, Y, W, H, R) => { x.beginPath(); x.roundRect(X, Y, W, H, R); };
    const dev = (I, X, Y, W, H, bz, R, r) => {
      rr(X, Y, W, H, R); x.fillStyle = "#17171c"; x.fill(); x.lineWidth = 2; x.strokeStyle = "#3a3a44"; x.stroke();
      x.save(); rr(X + bz, Y + bz, I.width, I.height, r); x.clip(); x.drawImage(I, X + bz, Y + bz); x.restore();
    };
    dev(A, 1, (cv.height - th) / 2, tw - 2, th - 2, bt - 1, 30, 16);
    dev(C, tw + gap, (cv.height - ph) / 2 + 1, pw - 2, ph - 2, bp - 1, 50, 40);
    return cv.toDataURL("image/webp", q);
  }, [tab.toString("base64"), tel.toString("base64"), Q]);
  await p.close();
  return Buffer.from(url.split(",")[1], "base64");
}

for (const g of G) {
  if (solo.length && !solo.includes(g.n)) continue;
  const tab = await schermo(g, 1180, 820, !!g.inverti, false);
  const tel = await schermo(g, 390, 844, !g.inverti, true);
  if (process.env.RAW) { writeFileSync(`${OUT}/${g.n}-tablet.png`, tab); writeFileSync(`${OUT}/${g.n}-telefono.png`, tel); }
  const webp = await componi(tab, tel);
  writeFileSync(`${OUT}/${g.n}.webp`, webp);
  console.log(g.n, Math.round(webp.length / 1024) + " kB");
}
await b.close();

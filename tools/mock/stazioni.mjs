// Prova del riconoscimento delle stazioni meteo (0.7.66): per ogni stazione finta (mockStazione) quali sensori trova da sola la pagina Meteo.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso): node tools/mock/stazioni.mjs
import { chromium } from "playwright-core";
const TIPI = ["ecowitt", "netatmo", "davis", "tempest", "ambient", "fineoffset", "sparsi"];
const K = ["temp", "hum", "percepita", "rugiada", "pioggia", "intensita", "vento", "raffica", "dir", "pressione", "uv", "lux", "rad"];
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
let errori = 0;
for (const tipo of TIPI) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", e => { errori++; console.log("PAGEERR", tipo, e.message); });
  await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
  await p.evaluate(t => { localStorage.clear(); localStorage.setItem("mockStazione", t); }, tipo);
  await p.reload(); await p.waitForTimeout(2500);
  const f = p.frames()[1];
  await f.evaluate(() => location.hash = "meteo"); await p.waitForTimeout(2000);
  const r = await f.evaluate(async K => { const m = await import("./js/pages/meteo.js"); return { staz: m.haStazione(), card: !!document.querySelector(".mt2"), s: Object.fromEntries(K.map(k => [k, m.sensore(k)])) }; }, K);
  console.log(`\n${tipo}: stazione ${r.staz ? "sì" : "NO"} · scheda ${r.card ? "sì" : "NO"}`);
  for (const k of K) console.log(`  ${k.padEnd(10)} ${r.s[k] || "—"}`);
  await p.close();
}
await b.close();
if (errori) process.exit(1);

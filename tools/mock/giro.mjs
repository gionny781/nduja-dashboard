// Giro di tutte le pagine (0.7.66): apre ogni pagina del menu e segnala gli errori JavaScript (PAGEERR) e le pagine vuote.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):
//   node tools/mock/giro.mjs                          casa di prova, 1280 e 390, tema scuro e chiaro
//   LS='{"mockCasa":"contatore"}' W=1280,800 node tools/mock/giro.mjs
import { chromium } from "playwright-core";
const LARGH = (process.env.W || "1280,390").split(",").map(Number), TEMI = (process.env.TEMI || "dark,light").split(",");
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
let ko = 0;
for (const w of LARGH) for (const tema of TEMI) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
  await p.evaluate(([t, ls]) => { localStorage.clear(); localStorage.setItem("nduja_theme", t); for (const [k, v] of Object.entries(JSON.parse(ls || "{}"))) localStorage.setItem(k, v); }, [tema, process.env.LS || ""]);
  await p.reload(); await p.waitForTimeout(3500);
  const f = p.frames()[1];
  const pagine = await f.evaluate(async () => (await import("./js/core.js")).visible());
  const vuote = [];
  for (const id of pagine) {
    const n = err.length;
    await f.evaluate(id => location.hash = id, id); await p.waitForTimeout(1300);
    const r = await f.evaluate(() => ({ pg: location.hash.slice(1), len: document.querySelector("#main")?.innerText.trim().length || 0 }));
    if (r.len < 20) vuote.push(id);
    if (err.length > n) console.log(`PAGEERR ${w} ${tema} ${id}: ${err.slice(n).join(" | ")}`);
  }
  ko += err.length + vuote.length;
  console.log(`${w} ${tema}: ${pagine.length} pagine, errori ${err.length}${vuote.length ? ", vuote: " + vuote.join(",") : ""}`);
  await p.close();
}
await b.close();
process.exit(ko ? 1 : 0);

// Screenshot di una pagina della plancia sul finto Home Assistant.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):
//   node tools/mock/shot.mjs <pagina> [larghezza] [altezza] [file.png] ["selettore1|selettore2"]
// Variabili: L=1 tema chiaro; ORA="2026-10-30T22:15" ora fissa; LAYOUT='{"configured":false}' per partire dal benvenuto;
//   LS='{"mockCasa":"…","mockNoAdmin":"1"}' altre chiavi di localStorage per il finto Home Assistant.
import { chromium } from "playwright-core";
const [,, page = "home", w = "1280", h = "1100", out = "s.png", extra = ""] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
/* ORA="2026-10-30T22:15" ferma l'orologio a quell'ora (salvaschermo, sole finto, calendari) */
if (process.env.ORA) await p.clock.setFixedTime(new Date(process.env.ORA));
p.on("pageerror", e => console.log("PAGEERR", e.message));
p.on("console", m => { if (m.type() === "error" && !/404/.test(m.text())) console.log("CONSOLE", m.text()); });
await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
await p.evaluate(([lay, light, ls]) => { localStorage.clear(); if (lay) localStorage.setItem("mockLayout", lay); if (light) localStorage.setItem("nduja_theme", "light");
  for (const [k, v] of Object.entries(JSON.parse(ls || "{}"))) localStorage.setItem(k, v); }, [process.env.LAYOUT || "", process.env.L || "", process.env.LS || ""]);
await p.reload(); await p.waitForTimeout(2500);
const f = p.frames()[1];
await f.evaluate(id => location.hash = id, page); await p.waitForTimeout(1500);
for (const sel of extra.split("|").filter(Boolean)) { await f.click(sel).catch(() => console.log("CLICK FAIL", sel)); await p.waitForTimeout(700); }
await p.screenshot({ path: out, fullPage: true });
await b.close();

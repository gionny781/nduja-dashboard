// Come shot.mjs, ma aspetta ATTESA millisecondi (predefinito 4000) dopo i clic prima dello screenshot: per il salvaschermo e i dati che arrivano dopo.
// Uso: ATTESA=5000 LS='{…}' node tools/mock/attesa.mjs <pagina> [larghezza] [altezza] [file.png] ["selettore1|selettore2"]
import { chromium } from "playwright-core";
const [,, page = "home", w = "1280", h = "1100", out = "s.png", extra = ""] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
if (process.env.ORA) await p.clock.setFixedTime(new Date(process.env.ORA));
p.on("pageerror", e => console.log("PAGEERR", e.message));
await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
await p.evaluate(([lay, light, ls]) => { localStorage.clear(); if (lay) localStorage.setItem("mockLayout", lay); if (light) localStorage.setItem("nduja_theme", "light");
  for (const [k, v] of Object.entries(JSON.parse(ls || "{}"))) localStorage.setItem(k, v); }, [process.env.LAYOUT || "", process.env.L || "", process.env.LS || ""]);
await p.reload(); await p.waitForTimeout(2500);
const f = p.frames()[1];
await f.evaluate(id => location.hash = id, page); await p.waitForTimeout(1500);
for (const sel of extra.split("|").filter(Boolean)) { await f.click(sel).catch(() => console.log("CLICK FAIL", sel)); await p.waitForTimeout(700); }
await p.waitForTimeout(+(process.env.ATTESA || 4000));
await p.screenshot({ path: out, fullPage: true });
await b.close();

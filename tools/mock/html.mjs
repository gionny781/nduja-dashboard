// HTML di una pagina della plancia sul finto Home Assistant, per confrontare due versioni (deve restare identico).
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):
//   ORA="2026-11-28T11:00" LS='{…}' node tools/mock/html.mjs <pagina> [larghezza] > pagina.html
// Ora ferma e numeri casuali sempre uguali: due giri con lo stesso codice danno lo stesso HTML.
import { chromium } from "playwright-core";
const [,, page = "energia", w = "1280"] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: +w, height: 1100 } });
await p.addInitScript(() => { let s = 7; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; });
await p.clock.setFixedTime(new Date(process.env.ORA || "2026-11-28T11:00"));
p.on("pageerror", e => console.error("PAGEERR", e.message));
await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
await p.evaluate(ls => { localStorage.clear(); for (const [k, v] of Object.entries(JSON.parse(ls || "{}"))) localStorage.setItem(k, v); }, process.env.LS || "");
await p.reload(); await p.waitForTimeout(2500);
const f = p.frames()[1];
await f.evaluate(id => location.hash = id, page); await p.waitForTimeout(2500);
console.log(await f.evaluate(() => document.querySelector("#main").innerHTML));
await b.close();

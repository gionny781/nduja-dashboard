// Velocità con tante entità (0.7.65): per ogni pagina misura il ridisegno dopo un cambio di stato (VERS.ver++) e dopo un cambio delle entità
// (nuovaGen), con la CPU rallentata. «stato»/«entita» = solo la pagina (render + patch); «statoPieno»/«entitaPiena» = il ridisegno vero di core.js
// (menu, pillole in alto, pagina), cioè il tempo tra due fotogrammi meno quello di un fotogramma vuoto. Tempi in millisecondi.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):
//   node tools/mock/velocita.mjs                       tutte le pagine, 3000 entità in più (mockTante + mockTanteMix), CPU 6×
//   TANTE=1000 RATE=4 PAGES=home,mappa node tools/mock/velocita.mjs
// Variabili: TANTE (entità in più), RATE (quante volte più lenta la CPU), W (larghezza), NOMIX=1 (solo sensori di luce, come prima della 0.7.65),
//   PAGES (elenco), OUT (file JSON dei risultati), PORT, CHROME.
import { chromium } from "playwright-core";
const N = process.env.TANTE || "3000", RATE = +(process.env.RATE || 6), W = +(process.env.W || 1340);
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: W, height: 900 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
await p.evaluate(([n, mix]) => { localStorage.clear(); localStorage.setItem("nduja_theme", "dark"); localStorage.setItem("mockTante", n); if (mix) localStorage.setItem("mockTanteMix", "1"); }, [N, process.env.NOMIX ? "" : "1"]);
await p.reload(); await p.waitForTimeout(6000);
const f = p.frames()[1];
const cdp = await p.context().newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
const n = await f.evaluate(async () => (await import("./js/core.js")).tutteLeEntita().length);
console.log("entità:", n, "CPU ×" + RATE);
const pages = process.env.PAGES ? process.env.PAGES.split(",") : await f.evaluate(async () => Object.keys((await import("./js/core.js")).PAGES));
const R = [];
for (const id of pages) {
  await f.evaluate(id => location.hash = id, id); await p.waitForTimeout(2500);
  const r = await f.evaluate(async id => {
    const c = await import("./js/core.js"), P = c.PAGES[id], main = document.querySelector("#main");
    if (c.UI.page !== id) return { id, skip: c.UI.page };
    const giro = () => { const t0 = performance.now(); c.HOOKS.forEach(h => { try { h(); } catch {} }); c.patch(main, P.render()); return performance.now() - t0; };
    const raf = () => new Promise(r => requestAnimationFrame(r));
    /* il ridisegno vero di core.js (menu, pillole in alto, pagina, foglio): tempo tra i due fotogrammi meno quello di un fotogramma vuoto */
    const pieno = async (prima) => { await raf(); return await new Promise(res => requestAnimationFrame(() => { prima?.(); const t0 = performance.now(); if (prima !== undefined) c.render(true); requestAnimationFrame(() => res(performance.now() - t0)); })); };
    const vuoto = []; for (let i = 0; i < 3; i++) vuoto.push(await pieno(undefined)); const fv = Math.min(...vuoto);
    giro(); const v = [], vp = []; for (let i = 0; i < 3; i++) { c.VERS.ver++; v.push(giro()); vp.push(await pieno(() => c.VERS.ver++)); }
    c.nuovaGen(); const g = giro(); const gp = await pieno(() => c.nuovaGen());
    return { id, stato: Math.round(v.reduce((a, b) => a + b) / v.length), statoPieno: Math.round(vp.reduce((a, b) => a + b) / vp.length - fv), entita: Math.round(g), entitaPiena: Math.round(gp - fv) };
  }, id);
  R.push(r); console.log(JSON.stringify(r));
}
if (errs.length) console.log("PAGEERR", errs.slice(0, 5));
if (process.env.OUT) (await import("fs")).writeFileSync(process.env.OUT, JSON.stringify(R));
await b.close();

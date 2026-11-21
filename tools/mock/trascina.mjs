// Prova del trascinamento (0.7.50) sul finto Home Assistant: prende un elemento e lo porta su un altro,
// col mouse o col dito (pressione lunga, eventi touch veri via CDP), fa lo screenshot DURANTE e DOPO e stampa l'ordine salvato.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):
//   node tools/mock/trascina.mjs <pagina> <da> <a> [mouse|dito] [larghezza] [altezza] [prefisso] ["clic prima|…"]
//   <da> e <a> sono selettori dentro la plancia ("R:selettore" tra i clic prima = clic destro); il dito si posa al centro di <da> e si alza al centro di <a> (o sul suo bordo: <a>@dopo / <a>@prima).
// Variabili come shot.mjs (L=1, LS='{…}', LAYOUT='{…}'); MODIFICA=0 non apre ✏️ Modifica; ANNULLA=1 tocca «Annulla» alla fine; ESC=1 preme Esc a metà;
// SCORRI=1 col dito: prova che uno scorrimento normale NON prende niente.
import { chromium } from "playwright-core";
const [,, pagina = "home", da, a, modo = "mouse", w = "1280", h = "1000", pre = "tr", clic = ""] = process.argv;
const dito = modo === "dito";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: dito, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on("pageerror", e => console.log("PAGEERR", e.message));
p.on("console", m => { if (m.type() === "error" && !/404/.test(m.text())) console.log("CONSOLE", m.text()); });
await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
await p.evaluate(([lay, light, ls]) => { localStorage.clear(); if (lay) localStorage.setItem("mockLayout", lay); if (light) localStorage.setItem("nduja_theme", "light");
  for (const [k, v] of Object.entries(JSON.parse(ls || "{}"))) localStorage.setItem(k, v); }, [process.env.LAYOUT || "", process.env.L || "", process.env.LS || ""]);
await p.reload(); await p.waitForTimeout(2500);
const f = p.frames()[1];
await f.evaluate(id => location.hash = id, pagina); await p.waitForTimeout(1500);
if (process.env.MODIFICA !== "0") { await f.click('[data-act="edToggle"]').catch(() => console.log("NO EDIT")); await p.waitForTimeout(600); }
for (const sel of clic.split("|").filter(Boolean)) { const dx = sel.startsWith("R:"); await f.click(dx ? sel.slice(2) : sel, dx ? { button: "right" } : {}).catch(() => console.log("CLICK FAIL", sel)); await p.waitForTimeout(600); }
const ord = v => Array.isArray(v) ? v.map(ord) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ord(v[k])])) : v;
const lay = () => p.evaluate(() => localStorage.getItem("mockLayout")).then(s => JSON.stringify(ord(JSON.parse(s || "{}"))));
const prima = await lay();
const cdp = dito ? await ctx.newCDPSession(p) : null;
const tocca = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
async function centro(sel) {
  const [s, lato] = sel.split("@"), el = f.locator(s).first();
  if (!lato) await el.evaluate(e => { const r = e.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 120) e.scrollIntoView({ block: "center" }); }).catch(() => {});
  else await el.scrollIntoViewIfNeeded().catch(() => {});
  const r = await el.boundingBox(); if (!r) throw new Error("non trovo " + s);
  return { x: r.x + (lato === "dopo" ? r.width * .85 : lato === "prima" ? r.width * .15 : r.width / 2), y: r.y + (lato === "dopo" ? r.height * .85 : lato === "prima" ? r.height * .15 : r.height / 2) };
}
if (process.env.SCORRI && dito) {
  const c = await centro(da), y0 = await f.evaluate(() => scrollY);
  await tocca("touchStart", c.x, c.y);
  for (let i = 1; i <= 12; i++) { await tocca("touchMove", c.x, c.y - i * 14); await p.waitForTimeout(16); }
  await tocca("touchEnd"); await p.waitForTimeout(700);
  console.log("SCORRI", "scrollY", y0, "→", await f.evaluate(() => scrollY), "sollevato:", await f.evaluate(() => !!document.querySelector(".tr1su")), "salvato:", (await lay()) !== prima);
  await b.close(); process.exit(0);
}
const A = await centro(da);
if (dito) { await tocca("touchStart", A.x, A.y); await p.waitForTimeout(450); }
else { await p.mouse.move(A.x, A.y); await p.mouse.down(); }
const B = await centro(a);
const muovi = async (x, y) => dito ? tocca("touchMove", x, y) : p.mouse.move(x, y);
const N = 18;
for (let i = 1; i <= N; i++) { await muovi(A.x + (B.x - A.x) * i / N, A.y + (B.y - A.y) * i / N); await p.waitForTimeout(25); }
await p.waitForTimeout(350);
console.log("DURANTE", await f.evaluate(() => ({ sollevato: !!document.querySelector(".tr1su"), segnaposto: !!document.querySelector(".tr1ph"), no: document.querySelector(".tr1no")?.textContent || "" })));
await p.screenshot({ path: pre + "-durante.png" });
if (process.env.ESC) { await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
if (dito) await tocca("touchEnd"); else await p.mouse.up();
await p.waitForTimeout(900);
const dopo = await lay();
console.log("SALVATO", dopo !== prima, "TOAST", await f.evaluate(() => document.querySelector("#toast.show")?.textContent || ""));
console.log("DOPO", dopo);
await p.screenshot({ path: pre + "-dopo.png" });
if (process.env.ANNULLA) {
  await f.click('[data-act="toastAz"]'); await p.waitForTimeout(900);
  console.log("ANNULLATO", (await lay()) === prima ? "come prima" : "DIVERSO: " + await lay());
}
await b.close();

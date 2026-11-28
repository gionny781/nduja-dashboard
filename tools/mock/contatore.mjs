// Prova della pagina Energia «Solo contatore» (0.7.66): fasce F1/F2/F3 (feriali, sabato, domenica, festivi), fasce scelte a mano,
// lancetta della potenza impegnata, previsione della bolletta, potenza stimata senza sensore in W.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso): node tools/mock/contatore.mjs   (esce con 1 se qualcosa non torna)
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
let ko = 0;
const ok = (cond, txt) => { console.log((cond ? "✅ " : "❌ ") + txt); if (!cond) ko++; };
async function apri(ls, ora = "2026-11-28T19:40") {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  p.on("pageerror", e => { ko++; console.log("PAGEERR", e.message); });
  await p.clock.setFixedTime(new Date(ora));
  await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
  await p.evaluate(ls => { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }, ls);
  await p.reload(); await p.waitForTimeout(2500);
  const f = p.frames()[1];
  await f.evaluate(() => location.hash = "energia"); await p.waitForTimeout(2500);
  return { p, f };
}
/* 1) fasce ARERA */
{
  const { p, f } = await apri({ mockCasa: "contatore" });
  const casi = [["2026-11-30T06:59", 3, "lunedì 6:59"], ["2026-11-30T07:30", 2, "lunedì 7:30"], ["2026-11-30T08:00", 1, "lunedì 8:00"], ["2026-11-30T18:59", 1, "lunedì 18:59"],
    ["2026-11-30T19:00", 2, "lunedì 19:00"], ["2026-11-30T22:59", 2, "lunedì 22:59"], ["2026-11-30T23:00", 3, "lunedì 23:00"],
    ["2026-11-28T06:59", 3, "sabato 6:59"], ["2026-11-28T07:00", 2, "sabato 7:00"], ["2026-11-28T12:00", 2, "sabato 12:00"], ["2026-11-28T23:00", 3, "sabato 23:00"],
    ["2026-11-29T12:00", 3, "domenica 12:00"], ["2026-12-08T12:00", 3, "martedì 8 dicembre (Immacolata) 12:00"], ["2026-12-07T12:00", 1, "lunedì 7 dicembre 12:00"],
    ["2026-12-24T10:00", 1, "giovedì 24 dicembre 10:00"], ["2026-12-25T10:00", 3, "venerdì 25 dicembre 10:00"], ["2026-12-26T10:00", 3, "sabato 26 dicembre (Santo Stefano) 10:00"],
    ["2027-03-29T10:00", 3, "Pasquetta 2027 (29 marzo) 10:00"], ["2027-03-30T10:00", 1, "martedì 30 marzo 2027 10:00"], ["2026-06-02T10:00", 3, "2 giugno 2026 10:00"],
    ["2027-01-06T09:00", 3, "Epifania 2027 9:00"], ["2026-04-25T10:00", 3, "25 aprile 2026 (sabato) 10:00"], ["2026-08-15T10:00", 3, "Ferragosto 2026 10:00"]];
  const r = await f.evaluate(async C => { const m = await import("./js/pages/energia.js"); return C.map(([d]) => { const [y, mo, g, h, mi] = d.split(/[-T:]/).map(Number); return m.fascia(new Date(y, mo - 1, g, h, mi)); }); }, casi);
  casi.forEach(([, atteso, nome], i) => ok(r[i] === atteso, `${nome}: F${r[i]} (atteso F${atteso})`));
  const st = await f.evaluate(async () => { const m = await import("./js/pages/energia.js"); return { cnt: m.soloContatore(), ids: m.contatori() }; });
  ok(st.cnt && st.ids[0] === "sensor.shelly_em_energia", `solo contatore riconosciuto da solo, contatore trovato: ${st.ids.join(",")}`);
  const stima = await f.evaluate(() => document.querySelector(".en8o .en8t")?.textContent || "");
  ok(/stimata/.test(stima), `senza sensore in W la potenza è stimata: «${stima.replace(/\s+/g, " ").trim()}»`);
  const bol = await f.evaluate(() => [...document.querySelectorAll(".og68 b")].map(x => x.textContent));
  const n = s => parseFloat(String(s).replace(/[^\d,]/g, "").replace(",", "."));
  const atteso = n(bol[0]) * 30 / (27 + (19 + 40 / 60) / 24);
  ok(Math.abs(n(bol[1]) - atteso) < 1, `previsione a fine mese: finora ${bol[0]}, fine ${bol[1]} (attesi ≈ ${atteso.toFixed(0)} kWh)`);
  await p.close();
}
/* 2) fasce scelte a mano, senza festivi; inizio del periodo il 15 */
{
  const L = { configured: true, mode: "auto", energy: { fasce: { on: true, schema: "mio", festivi: false, ore: { f: "1".repeat(24), s: "2".repeat(24), d: "3".repeat(24) } }, giornoBolletta: 15 } };
  const { p, f } = await apri({ mockCasa: "contatore", mockLayout: JSON.stringify(L) });
  const r = await f.evaluate(async () => { const m = await import("./js/pages/energia.js"); return [m.fascia(new Date(2026, 11, 8, 12)), m.fascia(new Date(2026, 10, 28, 3)), m.fascia(new Date(2026, 10, 29, 3))]; });
  ok(r[0] === 1 && r[1] === 2 && r[2] === 3, `fasce mie (feriali F1, sabato F2, domenica F3; l'8 dicembre senza festivi è feriale): ${r.join(", ")}`);
  const per = await f.evaluate(() => [...document.querySelectorAll(".card")].find(c => /Stima della bolletta|Bill estimate/.test(c.querySelector("h2")?.textContent || ""))?.querySelector(".small")?.textContent || "");
  ok(/15 nov/.test(per) && /14 dic/.test(per), `periodo di fatturazione dal 15: «${per.replace(/\s+/g, " ").trim().slice(0, 40)}»`);
  const bol = await f.evaluate(() => [...document.querySelectorAll(".og68 b")].map(x => x.textContent));
  const n = s => parseFloat(String(s).replace(/[^\d,]/g, "").replace(",", "."));
  const atteso = n(bol[0]) * 30 / (13 + (19 + 40 / 60) / 24);
  ok(Math.abs(n(bol[1]) - atteso) < 1.5, `previsione dal 15: finora ${bol[0]}, fine ${bol[1]} (attesi ≈ ${atteso.toFixed(0)} kWh)`);
  await p.close();
}
/* 3) lancetta della potenza impegnata (3 kW): verde, arancione dall'80%, rossa oltre il 100% */
for (const [w, cls, nome] of [["1000", "", "1000 W (33%)"], ["2500", "at", "2500 W (83%)"], ["3400", "ko", "3400 W (113%)"]]) {
  const { p, f } = await apri({ mockCasa: "contatore-w", mockCntW: w });
  const r = await f.evaluate(() => { const e = document.querySelector(".en8o .en8"); return e ? { cls: e.className, t: e.textContent.replace(/\s+/g, " ").trim(), rot: e.querySelector(".ag")?.style.transform } : null; });
  ok(r && (cls ? r.cls.split(/\s+/).includes(cls) : !/\b(at|ko)\b/.test(r.cls)) && !/stimata/.test(r.t), `lancetta con ${nome}: «${r?.t}» ${r?.rot}`);
  await p.close();
}
await b.close();
console.log(ko ? `\n${ko} controlli NON passati` : "\nTutto a posto");
process.exit(ko ? 1 : 0);

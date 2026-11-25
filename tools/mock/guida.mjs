// Immagini della guida all'installazione (docs/guida/*.webp): i disegni semplificati di guida.html, in italiano e in inglese.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso): node tools/mock/guida.mjs [scena…]
// Le immagini della plancia (benvenuto, procedura guidata, Controlla Home Assistant, errore) le fa galleria.mjs.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
const OUT = process.env.OUT || "docs/guida", Q = +(process.env.Q || 0.82);
const SCENE = ["marketplace", "hacs", "scarica", "prerelease", "riavvia", "integrazione", "apri"];
const solo = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
for (const s of SCENE) for (const l of ["it", "en"]) {
  if (solo.length && !solo.includes(s)) continue;
  const p = await b.newPage({ viewport: { width: 1180, height: 740 } });
  p.on("pageerror", e => console.log("PAGEERR", s, e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T11:00"));
  await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
  await p.evaluate(() => localStorage.clear());
  await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/guida.html#${s}-${l}`);
  await p.waitForTimeout(s === "apri" ? 5000 : 600);
  const png = (await p.screenshot()).toString("base64");
  const url = await p.evaluate(async ([a, q]) => { const i = new Image(); i.src = "data:image/png;base64," + a; await i.decode();
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; c.getContext("2d").drawImage(i, 0, 0); return c.toDataURL("image/webp", q); }, [png, Q]);
  const buf = Buffer.from(url.split(",")[1], "base64");
  writeFileSync(`${OUT}/${s}-${l}.webp`, buf);
  console.log(s, l, Math.round(buf.length / 1024) + " kB");
  await p.close();
}
await b.close();

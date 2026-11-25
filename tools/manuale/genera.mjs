// Manuale di istruzioni in PDF (italiano e inglese), fatto sul finto Home Assistant di tools/mock.
// Uso, dalla radice del repo (una volta: npm i --no-save playwright-core):
//   node tools/manuale/genera.mjs            i due manuali
//   node tools/manuale/genera.mjs it         solo l'italiano
// Variabili: CHROME = percorso di Chromium (predefinito /opt/pw-browsers/chromium); Q = qualità JPEG delle schermate (predefinita 72);
//   HTML=1 lascia in tools/manuale/out/ anche l'HTML di stampa e le pagine del PDF in PNG (per controllarle).
// Cosa fa: avvia da solo un piccolo server per il finto Home Assistant, legge l'ordine del menu, fa le schermate (tablet in tema scuro,
// qualcuna chiara), riempie il modello di stampa (modello.css), stampa il PDF due volte (la prima per sapere su che pagina cade ogni
// capitolo, la seconda con i numeri giusti nell'indice) e scrive custom_components/nduja_dashboard/frontend/manuale/:
//   Nduja-manuale-it.pdf, Nduja-manuale-en.pdf e manuale.json (versione, data, dimensione, pagine e capitoli: li legge la plancia).
// Servono pdftotext e pdfinfo (poppler-utils). Ogni PDF deve restare sotto i 6 MB: se no lo script si ferma.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PAGINE } from "./pagine.mjs";
import { TESTI } from "./testi.mjs";

const QUI = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(QUI, "../..");
const DEST = join(ROOT, "custom_components/nduja_dashboard/frontend/manuale");
const OUT = join(QUI, "out");
const MAX = 6e6, Q = +(process.env.Q || 72);   // 6 MB = 6 milioni di byte
const ORA = "2026-11-25T11:00";            // stessa ora della galleria: un mercoledì mattina col sole
const LINGUE = process.argv.slice(2).filter(l => ["it", "en"].includes(l));
const versione = JSON.parse(readFileSync(join(ROOT, "custom_components/nduja_dashboard/manifest.json"), "utf8")).version;
const oggi = new Date();
const dataISO = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;

/* ---------- piccolo server per il finto Home Assistant (come python3 -m http.server) ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf", ".wav": "audio/wav" };
const server = createServer((req, res) => {
  const p = resolve(ROOT, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream" }); res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

/* le immagini delle telecamere e la mappa del robot disegnate in tools/mock, al posto del peperoncino di prova (come galleria.mjs) */
const IMMAGINI = { "camera.porta_ingresso": "cam-ingresso.svg", "camera.garage": "cam-garage.svg", "camera.garage_sub_stream": "cam-garage.svg",
  "camera.ambrogio_map": "mappa-robot.svg", "camera.ambrogio_map_data": "mappa-robot.svg" };
const ENT = Object.fromEntries(Object.entries(IMMAGINI).map(([id, f]) => [id, [id === "camera.porta_ingresso" ? "recording" : "idle", { entity_picture: "/tools/mock/" + f }]]));
const casa3d = readFileSync(join(ROOT, "tools/mock/casa3d.json"), "utf8").replace(/\n/g, "");

/** apre il finto Home Assistant nella lingua giusta; restituisce { p, f } (pagina e frame della plancia) */
async function apri(lang, s, w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, locale: lang === "en" ? "en-GB" : "it-IT" });
  p.on("pageerror", e => console.log("  PAGEERR", lang, s.p, e.message));
  await p.route("**/tools/mock/host.html", async r => {
    const res = await r.fetch(); let t = await res.text();
    if (lang === "en") t = t.replace('<html lang="it">', '<html lang="en">');
    r.fulfill({ response: res, body: t });
  });
  await p.clock.setFixedTime(new Date(s.ora || ORA));
  await p.goto(BASE + "/tools/mock/host.html");
  const ls = { nduja_manuale: "1", ...(s.ls || {}) };   // la riga «C'è il manuale» della Home non serve nelle schermate
  ls.mockEnt = JSON.stringify({ ...ENT, ...JSON.parse(ls.mockEnt || "{}") });
  const lay = s.lay === "3d" ? casa3d : s.lay || "";
  await p.evaluate(([lay, chiaro, ls]) => { localStorage.clear(); if (lay) localStorage.setItem("mockLayout", lay); if (chiaro) localStorage.setItem("nduja_theme", "light");
    for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }, [lay, !!s.chiaro, ls]);
  await p.reload(); await p.waitForTimeout(2600);
  const f = p.frames()[1];
  await f.evaluate(id => location.hash = id, s.p); await p.waitForTimeout(1900);
  for (const sel of (s.clic || "").split("|").filter(Boolean)) { await f.click(sel).catch(() => console.log("  CLICK FAIL", s.p, sel)); await p.waitForTimeout(900); }
  if (s.scorri) await f.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: "start" }), s.scorri);
  await p.waitForTimeout(s.attesa || 700);
  return { p, f };
}
const jpg = async (p, clip) => "data:image/jpeg;base64," + (await p.screenshot({ type: "jpeg", quality: Q, clip })).toString("base64");
async function scatto(lang, s, w = 1180, h = 820) { const { p } = await apri(lang, s, w, s.alto || h); const d = await jpg(p); await p.close(); return d; }

/** la Home con i riquadri numerati di «Com'è fatta» (le posizioni vengono dagli elementi veri) */
async function anatomia(lang) {
  const W = 1340, H = 820, { p, f } = await apri(lang, { p: "home" }, W, H);   // più largo: tutte le pillole in alto si vedono
  const box = await f.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
    const pill = [...document.querySelectorAll("#strip .pillv")].filter(e => !e.matches(".edt1,.vc1p,.th1")).map(e => e.getBoundingClientRect());
    const th = [...document.querySelectorAll("#strip .th1")].map(e => e.getBoundingClientRect());
    const uni = L => L.length ? [Math.min(...L.map(b => b.left)), Math.min(...L.map(b => b.top)), Math.max(...L.map(b => b.right)) - Math.min(...L.map(b => b.left)), Math.max(...L.map(b => b.bottom)) - Math.min(...L.map(b => b.top))] : null;
    const t = document.getElementById("pageTitle").getBoundingClientRect();
    return [r("#rail"), [t.left, t.top, Math.min(t.width, 180), t.height], r("#strip .edt1"), uni(pill), r("#strip .vc1p"), uni(th)];
  });
  const img = await jpg(p); await p.close();
  return { img, box, W, H };
}

/** immagine della guida (WebP) ripassata in JPEG, così il PDF resta leggero */
async function guida(nome) {
  const p = await browser.newPage({ viewport: { width: 1180, height: 740 } });
  await p.setContent(`<body style="margin:0"><img src="data:image/webp;base64,${readFileSync(join(ROOT, "docs/guida", nome + ".webp")).toString("base64")}" style="display:block"></body>`);
  const d = await jpg(p); await p.close(); return d;
}

/** ordine delle pagine nel menu della plancia (con Natale, che compare solo nel periodo di festa) */
async function menu(lang) {
  const { p, f } = await apri(lang, { p: "home", ora: "2026-12-12T11:00" }, 1180, 820);
  const L = await f.evaluate(() => [...document.querySelectorAll("#rail .nav[data-id]")].map(b => [b.dataset.id, b.querySelector(".i")?.textContent || "", b.textContent.replace(b.querySelector(".i")?.textContent || "", "").trim()]));
  const titoli = await f.evaluate(async () => { const { PAGES } = await import("./js/core.js"); return Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, [v.icon, v.title]])); });
  await p.close();
  return { ordine: L.map(x => x[0]), titoli };
}

/* ---------- testo: **grassetto**, il resto senza HTML ---------- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const ul = (L, tag = "ul") => `<${tag}>${L.map(x => `<li>${md(x)}</li>`).join("")}</${tag}>`;

function blocchi(B, img) {
  return B.map(b => {
    if (b.h) return `<h3>${md(b.h)}</h3>`;
    if (b.p) return `<p>${md(b.p)}</p>`;
    if (b.ul) return ul(b.ul);
    if (b.ol) return ul(b.ol, "ol");
    if (b.nota) return `<div class="nota">${md(b.nota)}</div>`;
    if (b.img) return figura(img[b.img], b.cap, b.larga ? "larga" : b.img === "telefono" ? "tel" : "stretta");
    if (b.tab) return `<table><thead><tr>${b.tab.testa.map(x => `<th>${md(x)}</th>`).join("")}</tr></thead><tbody>${b.tab.righe.map(r => `<tr>${r.map(x => `<td>${md(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    if (b.gloss) return `<dl class="gloss">${b.gloss.map(([k, v]) => `<div><dt>${md(k)}</dt><dd>${md(v)}</dd></div>`).join("")}</dl>`;
    if (b.passi) return b.passi.map(x => `<div class="passo"><img src="${img[x.img]}" alt=""><div><h4>${md(x.t)}</h4>${ul(x.ol, "ol")}${x.nota ? `<p class="piccolo">${md(x.nota)}</p>` : ""}</div></div>`).join("");
    return "";
  }).join("");
}
function figura(x, cap, cls) {
  if (!x) return "";
  if (typeof x === "object") {   // con i riquadri numerati
    const { W, H } = x;
    const seg = x.box.map((b, i) => b ? `<span class="seg ${i < 2 ? "dx" : "giu"}" style="left:${b[0] / W * 100}%;top:${b[1] / H * 100}%;width:${b[2] / W * 100}%;height:${b[3] / H * 100}%"><i>${i + 1}</i></span>` : "").join("");
    return `<figure class="larga"><div class="schermo anat"><img src="${x.img}" alt="">${seg}</div>${cap ? `<figcaption>${md(cap)}</figcaption>` : ""}</figure>`;
  }
  return `<figure class="${cls}"><div class="schermo"><img src="${x}" alt=""></div>${cap ? `<figcaption>${md(cap)}</figcaption>` : ""}</figure>`;
}

/* ---------- HTML di stampa ---------- */
function html(lang, T, voci, img, numeri, marcatori) {
  const css = readFileSync(join(QUI, "modello.css"), "utf8");
  const chili = readFileSync(join(ROOT, "custom_components/nduja_dashboard/frontend/img/chili.svg"), "utf8");
  const mk = id => marcatori ? `<span class="mk">@@${id}@@</span>` : "";
  const n = id => numeri?.[id] ?? "";
  const cap = T.capitoli;
  const dataLunga = oggi.toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const indice = `<section class="indice"><h1>${esc(T.indice)}</h1><ol class="toc">${cap.map((c, i) => `<li><a href="#c-${c.id}"><span class="ti">${c.icona}</span><span class="tt">${i + 1}. ${esc(c.titolo)}</span><span class="pt"></span><span class="pn">${n("c-" + c.id)}</span></a>
      ${c.id === "pagine" ? `<ol class="toc2">${voci.map(v => `<li><a href="#p-${v.id}"><span>${v.icona} ${esc(v.titolo)}</span><span class="pt"></span><span class="pn">${n("p-" + v.id)}</span></a></li>`).join("")}</ol>` : ""}</li>`).join("")}</ol></section>`;
  const pagina = v => `<section class="pg" id="p-${v.id}">${mk("p-" + v.id)}
      <header><span class="ic">${v.icona}</span><div><h2>${esc(v.titolo)}</h2><p>${md(v.t.sotto)}</p></div></header>
      <div class="schermo"><img src="${img["p:" + v.id]}" alt=""></div>
      <div class="col2"><div><h4>${esc(T.serve)}</h4><p>${md(v.t.serve)}</p><h4>${esc(T.sola)}</h4><p>${md(v.t.sola)}</p></div>
        <div><h4>${esc(T.tocchi)}</h4>${ul(v.t.tocchi)}${v.t.consigli?.length ? `<div class="consiglio"><h4>💡 ${esc(T.consigli)}</h4>${ul(v.t.consigli)}</div>` : ""}</div></div></section>`;
  const capitolo = (c, i) => `<section class="cap" id="c-${c.id}">${mk("c-" + c.id)}<div class="capt"><span class="cn">${i + 1}</span><span class="ci">${c.icona}</span><h1>${esc(c.titolo)}</h1></div>
      ${blocchi(c.blocchi, img)}${c.id === "glossario" ? `<div class="colofone"><b>'Nduja Dashboard</b> · ${esc(T.titolo)} · ${esc(T.versione)} ${esc(versione)} · ${esc(dataLunga)}<br>${esc(T.casaFinta)}<br>github.com/gionny781/nduja-dashboard · MIT</div>` : ""}</section>
      ${c.id === "pagine" ? voci.map(pagina).join("") : ""}`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>'Nduja Dashboard · ${esc(T.titolo)}</title>
<style>${css}
@page{@bottom-left{content:"${T.piede.replace(/"/g, '\\"')} · ${versione}"}}</style></head><body>
<section class="copertina"><div class="cop-logo">${chili}</div><div class="cop-t"><small>'Nduja Dashboard</small><h1>${esc(T.titolo)}</h1><p>${esc(T.sottotitolo)}</p></div>
  <div class="cop-img"><div class="cornice"><img src="${img["p:home"]}" alt=""></div></div>
  <div class="cop-v">${esc(T.versione)} ${esc(versione)} · ${esc(dataLunga)}<br><span>${esc(T.casaFinta)}</span></div></section>
${indice}
${cap.map(capitolo).join("")}
</body></html>`;
}

/** su che pagina del PDF cade ogni marcatore (pdftotext, pagina per pagina) */
function pagineDi(pdf, n) {
  const out = {};
  for (let i = 1; i <= n; i++) {
    const tx = execFileSync("pdftotext", ["-f", String(i), "-l", String(i), "-layout", pdf, "-"], { encoding: "utf8" });
    for (const m of tx.matchAll(/@@([a-z0-9-]+)@@/g)) out[m[1]] ??= i;
  }
  return out;
}
const numPagine = pdf => +execFileSync("pdfinfo", [pdf], { encoding: "utf8" }).match(/Pages:\s+(\d+)/)[1];

async function stampa(htmlTxt, file) {
  const p = await browser.newPage();
  await p.setContent(htmlTxt, { waitUntil: "load" });
  await p.pdf({ path: file, format: "A4", printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
  await p.close();
}

mkdirSync(DEST, { recursive: true }); mkdirSync(OUT, { recursive: true });
const META = existsSync(join(DEST, "manuale.json")) ? JSON.parse(readFileSync(join(DEST, "manuale.json"), "utf8")) : {};
let errori = 0;
for (const lang of LINGUE.length ? LINGUE : ["it", "en"]) {
  const T = TESTI[lang];
  console.log(`== ${lang}: menu`);
  const { ordine, titoli } = await menu(lang);
  /* voci del capitolo 3 nell'ordine del menu; quelle con «dopo» subito dopo la loro pagina, quelle con «fine» in fondo */
  const perId = Object.fromEntries(PAGINE.map(x => [x.id, x]));
  const mancano = ordine.filter(id => !perId[id]);
  if (mancano.length) { console.log("  ⚠️ pagine del menu senza testo nel manuale:", mancano.join(", ")); errori++; }
  const voci = [];
  for (const id of ordine) {
    if (!perId[id]) continue;
    voci.push(perId[id]);
    voci.push(...PAGINE.filter(x => x.dopo === id));
  }
  voci.push(...PAGINE.filter(x => x.fine));
  const fuori = PAGINE.filter(x => !x.dopo && !x.fine && !ordine.includes(x.id));
  if (fuori.length) console.log("  ⚠️ testi di pagine che non sono nel menu (saltati):", fuori.map(x => x.id).join(", "));
  const V = voci.map(x => ({ id: x.id, t: x[lang], titolo: x[lang].titolo || titoli[x.id]?.[1] || x.id, icona: x.icona || titoli[x.id]?.[0] || "•", scatto: x.scatto }));

  console.log(`== ${lang}: schermate (${V.length} pagine)`);
  const img = {};
  for (const v of V) { img["p:" + v.id] = await scatto(lang, v.scatto); process.stdout.write("."); }
  img.anatomia = await anatomia(lang);
  img.telefono = await scatto(lang, { p: "home", chiaro: true, clic: '[data-act="more"]' }, 390, 844);
  img.benvenuto = await scatto(lang, { p: "benvenuto", lay: '{"configured":false}' });
  img.modifica = await scatto(lang, { p: "home", clic: '[data-act="edToggle"]' });
  img.aggiungi = await scatto(lang, { p: "impostazioni", ls: { mockNoCar: "1", mockVia: "^(sensor|binary_sensor|calendar)\\.f1_|rain_bird|prato_dietro|orto_gocciolatore|zona_siepe" }, scorri: "#ag1" });
  img.salvaschermo = await scatto(lang, { p: "impostazioni", ls: { nduja_ssMin: "5", nduja_ssStile: "solare" }, clic: '[data-act="ssProva"] >> nth=0' });
  img.errore = await scatto(lang, { p: "home", ls: { mockNoData: "1" }, attesa: 16000 });
  for (const g of ["marketplace", "scarica", "riavvia", "integrazione", "apri"]) img["g-" + g] = await guida(`${g}-${lang}`);
  console.log(" fatto");

  const prova = join(OUT, `prova-${lang}.pdf`), fine = join(DEST, `Nduja-manuale-${lang}.pdf`);
  await stampa(html(lang, T, V, img, null, true), prova);
  const N = numPagine(prova), numeri = pagineDi(prova, N);
  /* ogni pagina della plancia deve stare in una pagina A4 sola */
  V.forEach((v, i) => { const a = numeri["p-" + v.id], b = i + 1 < V.length ? numeri["p-" + V[i + 1].id] : numeri["c-sumisura"]; if (a && b && b - a > 1) { console.log(`  ⚠️ «${v.titolo}» occupa ${b - a} pagine`); errori++; } });
  const finale = html(lang, T, V, img, numeri, false);
  if (process.env.HTML) writeFileSync(join(OUT, `manuale-${lang}.html`), finale);
  await stampa(finale, fine);
  rmSync(prova, { force: true });
  const byte = statSync(fine).size, pagine = numPagine(fine);
  console.log(`== ${lang}: ${pagine} pagine, ${(byte / 1048576).toFixed(2)} MB → ${fine}`);
  if (byte > MAX) { console.log("  ❌ più di 6 MB: abbassa Q o usa meno schermate"); errori++; }
  if (pagine !== N) { console.log("  ⚠️ la seconda stampa ha un numero di pagine diverso dalla prima"); errori++; }
  if (process.env.HTML) execFileSync("pdftoppm", ["-r", "45", "-png", fine, join(OUT, `pag-${lang}`)]);
  META[lang] = { byte, pagine, indice: T.capitoli.map(c => c.titolo) };
}
writeFileSync(join(DEST, "manuale.json"), JSON.stringify({ versione, data: dataISO, it: META.it, en: META.en }, null, 1) + "\n");
await browser.close(); server.close();
if (errori) { console.log(`❌ ${errori} problemi: controlla sopra`); process.exit(1); }
console.log("✅ manuale pronto");

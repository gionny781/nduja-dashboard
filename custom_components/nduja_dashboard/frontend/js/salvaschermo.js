/* Salvaschermo per il tablet a muro: dopo X minuti senza tocchi mostra un orologio grande con data, meteo,
   temperatura di casa e il prossimo impegno; se scegli una cartella di foto (Media di Home Assistant) le fa scorrere
   in dissolvenza. Si sveglia al primo tocco. Tutto si sceglie per ogni dispositivo (⚙️ Impostazioni → Questo dispositivo). */
import { S, ACT, t, LOC, esc, fnum, attr, sGet, sSet, ws, toast, openSheet, closeSheet, render, weatherEnt, WX, ents, roomTemp, areasSorted } from "./core.js";
import { inDiretta } from "./video.js";

export const ssMin = () => +(sGet("ssMin") || 0);          // 0 = spento
export const ssStile = () => sGet("ssStile") || "orologio"; // orologio | foto
export const ssDir = () => sGet("ssDir") || "";
let timer = null, attivo = false, foto = [], fi = 0, giro = null, el = null;

function riarma() {
  clearTimeout(timer);
  if (attivo || !ssMin()) return;
  timer = setTimeout(mostra, ssMin() * 60000);
}
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => document.addEventListener(ev, () => { if (attivo) nascondi(); else riarma(); }, { passive: true, capture: true }));
let ultimoMove = 0;
document.addEventListener("mousemove", () => { const n = Date.now(); if (n - ultimoMove > 1000) { ultimoMove = n; if (!attivo) riarma(); } }, { passive: true });

/* foto dalla cartella scelta nei Media di Home Assistant */
async function caricaFoto() {
  foto = [];
  if (ssStile() !== "foto" || !ssDir()) return;
  try {
    const r = await ws({ type: "media_source/browse_media", media_content_id: ssDir() });
    const img = (r.children || []).filter(c => c.media_class === "image" || /^image\//.test(c.media_content_type || "")).slice(0, 200);
    for (let i = img.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [img[i], img[j]] = [img[j], img[i]]; }
    foto = img.map(c => c.media_content_id);
  } catch (e) { console.warn("salvaschermo", e); }
}
async function urlFoto(id) { try { return (await ws({ type: "media_source/resolve_media", media_content_id: id })).url; } catch { return null; } }

function contenuto() {
  const d = new Date(), w = weatherEnt(), [ic, tx] = w ? (WX()[S[w].state] || ["🌡️", S[w].state]) : [null, null];
  const casa = areasSorted().map(roomTemp).filter(v => v != null), media = casa.length ? casa.reduce((a, b) => a + b, 0) / casa.length : null;
  const notte = d.getHours() >= 23 || d.getHours() < 7;
  return `<div class="ssc1 ${notte ? "notte" : ""}" style="--dx:${(d.getMinutes() % 7) * 9 - 27}px;--dy:${(d.getMinutes() % 5) * 9 - 18}px">
    <div class="ssh1">${d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })}</div>
    <div class="ssd1">${esc(d.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" }))}</div>
    <div class="ssi1">${w ? `<span>${ic} ${fnum(attr(w, "temperature"), 0)}° <small>${esc(tx)}</small></span>` : ""}${media != null ? `<span>🏠 ${fnum(media, 1)}°</span>` : ""}
      ${ents("person").length ? `<span>👥 ${ents("person").filter(p => S[p].state === "home").length}</span>` : ""}</div></div>`;
}
async function prossimaFoto() {
  if (!attivo || !foto.length || !el) return;
  const url = await urlFoto(foto[fi++ % foto.length]); if (!url || !el) return;
  const img = new Image(); img.onload = () => {
    if (!el) return;
    const div = document.createElement("div"); div.className = "ssf1"; div.style.backgroundImage = `url("${url}")`;
    el.querySelector(".ssb1").appendChild(div);
    requestAnimationFrame(() => div.classList.add("on"));
    const vecchie = el.querySelectorAll(".ssf1"); if (vecchie.length > 2) vecchie[0].remove();
  }; img.src = url;
}
export async function mostra(prova) {
  if (attivo) return;
  if (inDiretta() && prova !== true) { riarma(); return; }   // si sta guardando una telecamera: non la copro
  attivo = true;
  el = document.createElement("div"); el.className = "ss1"; el.innerHTML = `<div class="ssb1"></div><div class="ssv1"></div><div class="ssw1">${contenuto()}</div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el && el.classList.add("on"));
  giro = setInterval(() => { if (el) el.querySelector(".ssw1").innerHTML = contenuto(); }, 20000);
  if (ssStile() === "foto") { await caricaFoto(); prossimaFoto(); giro2 = setInterval(prossimaFoto, 15000); }
}
let giro2 = null;
function nascondi() {
  attivo = false; clearInterval(giro); clearInterval(giro2);
  const e = el; el = null; if (e) { e.classList.remove("on"); setTimeout(() => e.remove(), 400); }
  riarma();
}
riarma();

/* ---------- scelta della cartella delle foto ---------- */
let dir = "media-source://media_source", elenco = null;
async function apri(id) {
  dir = id; elenco = null; render();
  try { elenco = await ws({ type: "media_source/browse_media", media_content_id: id }); } catch (e) { elenco = { title: t("Errore", "Error"), children: [], err: e.message || e.code }; }
  render();
}
function sfoglia() {
  const L = elenco?.children || [], cartelle = L.filter(c => c.can_expand), n = L.filter(c => c.media_class === "image").length;
  return `<div class="sh-head"><div><h3>🖼️ ${t("Cartella delle foto", "Photo folder")}</h3><div class="small muted">${t("Dai Media di Home Assistant (per esempio la cartella /media). Le foto si caricano da Impostazioni → Media.", "From Home Assistant's Media (e.g. the /media folder). Upload photos in Settings → Media.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="row between" style="margin-bottom:8px"><b>${esc(elenco?.title || "…")}</b>${dir !== "media-source://media_source" ? `<button class="btn sm" data-act="ssSu">⬆ ${t("Su", "Up")}</button>` : ""}</div>
    ${!elenco ? `<div class="small muted">${t("Carico…", "Loading…")}</div>` : `<div class="stack">${cartelle.map(c => `<button class="li" data-act="ssApri" data-id="${esc(c.media_content_id)}"><span class="ic">📁</span><div class="tx"><b>${esc(c.title)}</b></div><span class="st">›</span></button>`).join("") || `<div class="small muted">${elenco.err ? esc(elenco.err) : t("Nessuna sottocartella.", "No subfolders.")}</div>`}</div>
      <button class="btn pri" data-act="ssScegli" style="margin-top:12px" ${n ? "" : "disabled"}>✅ ${t(`Usa questa cartella (${n} foto)`, `Use this folder (${n} photos)`)}</button>`}`;
}
const storia = [];
Object.assign(ACT, {
  ssMin: el => { sSet("ssMin", el.dataset.v); riarma(); render(); },
  ssStile: el => { sSet("ssStile", el.dataset.v); render(); if (el.dataset.v === "foto" && !ssDir()) ACT.ssDir(); },
  ssProva: () => { closeSheet(); setTimeout(() => mostra(true), 200); },
  ssDir: () => { storia.length = 0; openSheet(sfoglia); apri("media-source://media_source"); },
  ssApri: el => { storia.push(dir); apri(el.dataset.id); },
  ssSu: () => apri(storia.pop() || "media-source://media_source"),
  ssScegli: () => { sSet("ssDir", dir); closeSheet(); toast("🖼️ " + (elenco?.title || "")); },
});

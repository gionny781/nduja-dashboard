/* 'Nduja Dashboard — manuale di istruzioni in PDF (frontend/manuale/, rifatto con tools/manuale/genera.mjs).
   «Apri» lo apre in una nuova scheda del browser; dentro le app (Home Assistant, Fully Kiosk, app 'Nduja), dove una
   nuova scheda o il download spesso non partono, lo mostra a schermo intero dentro la plancia con «Condividi» e «Salva».
   «Scarica PDF» lo scarica. Sempre nella lingua della plancia. */
import { ACT, IT, LOC, t, esc, sGet, sSet, render } from "./core.js";

const LINGUA = IT ? "it" : "en";
const FILE = `Nduja-manuale-${LINGUA}.pdf`;
/** indirizzo completo del PDF (accanto a index.html della plancia: /nduja_dashboard_static/<versione>/manuale/…) */
export const manualeUrl = () => new URL("manuale/" + FILE, location.href).href;

/* versione, data, dimensione e pagine dei due PDF: manuale/manuale.json, scritto da genera.mjs */
let INFO, chiesto = false;
function info() {
  if (!chiesto) {
    chiesto = true;
    fetch(new URL("manuale/manuale.json", location.href), { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
      .then(j => { INFO = j || null; render(); }).catch(() => { INFO = null; });
  }
  return INFO;
}
const mb = b => b >= 1048576 ? (b / 1048576).toLocaleString(LOC, { maximumFractionDigits: 1 }) + " MB" : Math.max(1, Math.round(b / 1024)) + " kB";
/** «PDF · 4,2 MB · 46 pagine · versione 0.7.61-dev» */
export function manualeDati() {
  const I = info(), L = I?.[LINGUA];
  return ["PDF", L?.byte ? mb(L.byte) : "", L?.pagine ? L.pagine + t(" pagine", " pages") : "", I?.versione ? t("versione ", "version ") + esc(I.versione) : ""].filter(Boolean).join(" · ");
}

/** dentro un'app (Home Assistant per Android o iPhone, Fully Kiosk, app 'Nduja) o in una WebView Android */
function inApp() {
  if (window.NDUJA_APP || /; wv\)|FullyKiosk/i.test(navigator.userAgent)) return true;
  try { const p = window.parent; return !!(p.externalApp || p.webkit?.messageHandlers?.getExternalAuth || p.fully || window.fully); } catch { return false; }
}

/* ---------- lettore a schermo intero, dentro la plancia ---------- */
let blob = null;
function prepara() {   // scarico il PDF subito, così «Condividi» parte al primo tocco
  if (blob) return;
  blob = "…";
  fetch(manualeUrl()).then(r => r.ok ? r.blob() : null).then(b => { blob = b || null; disegnaBarra(); }).catch(() => { blob = null; disegnaBarra(); });
}
const puoCondividere = () => blob instanceof Blob && !!navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([blob], FILE, { type: "application/pdf" })] }); } catch { return false; } })();
function barra() {
  return `<b class="mn1vt">📖 ${t("Manuale di istruzioni", "User manual")}</b><span class="grow"></span>
    ${puoCondividere() ? `<button class="btn sm" data-act="mnCondividi">📤 ${t("Condividi", "Share")}</button>` : ""}
    <a class="btn sm" href="${esc(manualeUrl())}" download="${FILE}">⬇️ ${t("Salva", "Save")}</a>
    <a class="btn sm" href="${esc(manualeUrl())}" target="_blank" rel="noopener">↗ ${t("Apri fuori", "Open outside")}</a>
    <button class="btn sm" data-act="mnChiudi" aria-label="${t("Chiudi", "Close")}">✕</button>`;
}
function disegnaBarra() { const b = document.querySelector("#mn1v .mn1vb"); if (b) b.innerHTML = barra(); }
function corpo() {
  /* i browser senza lettore di PDF (WebView Android) non sanno mostrarlo: allora l'indice e i pulsanti */
  if (navigator.pdfViewerEnabled !== false) return `<iframe class="mn1vf" src="${esc(manualeUrl())}#view=FitH" title="${t("Manuale di istruzioni", "User manual")}"></iframe>`;
  const I = info(), cap = I?.[LINGUA]?.indice || [];
  return `<div class="mn1vn"><span class="mn1vi" aria-hidden="true">📖</span>
    <p><b>${t("Questo schermo non sa mostrare i PDF da solo.", "This screen can't show PDFs by itself.")}</b><br>
    ${t("Tocca «Salva» o «Condividi» per aprirlo con un'altra app, per esempio un lettore di PDF o Google Drive.", "Tap «Save» or «Share» to open it with another app, for example a PDF reader or Google Drive.")}</p>
    ${cap.length ? `<ol>${cap.map(c => `<li>${esc(c)}</li>`).join("")}</ol>` : ""}</div>`;
}
function apriQui() {
  prepara();
  let v = document.getElementById("mn1v");
  if (!v) { v = document.createElement("div"); v.id = "mn1v"; v.className = "mn1v"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); document.body.appendChild(v); }
  v.innerHTML = `<div class="mn1vb">${barra()}</div><div class="mn1vc">${corpo()}</div>`;
  requestAnimationFrame(() => v.classList.add("open"));
}
function chiudi() { const v = document.getElementById("mn1v"); if (v) { v.classList.remove("open"); setTimeout(() => v.remove(), 250); } }
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("mn1v")) chiudi(); });

Object.assign(ACT, {
  /* «Apri»: una nuova scheda del browser; se il browser la blocca o siamo in un'app, il lettore qui dentro */
  mnApri: () => {
    if (inApp()) return apriQui();
    let w = null;
    try { w = window.open(manualeUrl(), "_blank"); } catch {}
    if (w) { try { w.opener = null; } catch {} } else apriQui();
  },
  mnQui: () => apriQui(),
  mnChiudi: () => chiudi(),
  mnCondividi: async () => {
    if (!(blob instanceof Blob)) return;
    try { await navigator.share({ files: [new File([blob], FILE, { type: "application/pdf" })], title: t("Manuale di 'Nduja", "'Nduja manual") }); } catch { /* annullato */ }
  },
  mnVisto: () => { sSet("manuale", "1"); render(true); },
});

/** riga «📖 Manuale di istruzioni» in cima a ⚙️ Impostazioni (per tutti) */
export function manualeCard() {
  return `<section class="card mn1"><div class="mn1r"><span class="mn1i" aria-hidden="true">📖</span>
    <div class="mn1t"><b>${t("Manuale di istruzioni", "User manual")}</b><span>${t("Come si usa ogni pagina, in parole semplici. Da leggere qui, scaricare o stampare.", "How to use every page, in plain words. Read it here, download it or print it.")}</span>
      <small>${manualeDati()}</small></div>
    <div class="mn1b"><button class="btn sm pri" data-act="mnApri">📖 ${t("Apri", "Open")}</button>
      <a class="btn sm" href="${esc(manualeUrl())}" download="${FILE}">⬇️ ${t("Scarica PDF", "Download PDF")}</a></div></div></section>`;
}
/** riga «C'è il manuale» per la scheda delle novità della Home: finché su questo dispositivo non si tocca «Ho visto» */
export function manualeNovita() {
  if (sGet("manuale") === "1") return "";
  return `<div class="nv1r"><span class="nv1i" aria-hidden="true">📖</span><div class="nv1t"><b>${t("C'è il manuale di istruzioni", "There's a user manual")}</b>
      <span>${t("Ogni pagina spiegata in parole semplici. Lo trovi sempre in ⚙️ Impostazioni.", "Every page explained in plain words. It's always in ⚙️ Settings.")}</span></div>
    <div class="nv1b"><button class="btn sm pri" data-act="mnApri">📖 ${t("Apri", "Open")}</button><button class="btn sm" data-act="mnVisto">👍 ${t("Ho visto", "Got it")}</button></div></div>`;
}

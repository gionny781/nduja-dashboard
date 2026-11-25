/* Fluidità della plancia (0.7.58).
   1) Le animazioni dei disegni (clima, caldaia, elettrodomestici, oggetti…) si fermano quando non si vedono:
      fuori dallo schermo, sotto il salvaschermo o con la pagina nascosta. Riprendono appena tornano visibili.
   2) «Grafica automatica» non guarda più solo se il dispositivo è Android: misura quanti fotogrammi al secondo
      riesce a disegnare e, se la plancia va a scatti, accende da sola la grafica leggera su quel dispositivo
      (con «Annulla» e la possibilità di rimisurare da ⚙️ Impostazioni → Questo dispositivo). */
import { ACT, UI, t, sGet, sSet, grafica, applyTheme, render, toast } from "./core.js";

/* ---------- 1) animazioni ferme quando non si vedono ---------- */
const SEL = "svg,.card,.ocard,[class*=anim]";
const visti = new WeakSet();
const io = "IntersectionObserver" in window
  ? new IntersectionObserver(es => { for (const e of es) e.target.toggleAttribute("data-nv", !e.isIntersecting); }, { rootMargin: "80px" })
  : null;
function osserva(root) {
  if (!io || root.nodeType !== 1) return;
  const lista = root.matches?.(SEL) ? [root, ...root.querySelectorAll(SEL)] : root.querySelectorAll(SEL);
  for (const el of lista) if (!visti.has(el)) { visti.add(el); io.observe(el); }
}
function dimentica(root) {
  if (!io || root.nodeType !== 1) return;
  if (visti.has(root)) { visti.delete(root); io.unobserve(root); }
  for (const el of root.querySelectorAll(SEL)) if (visti.has(el)) { visti.delete(el); io.unobserve(el); }
}
if (io) {
  new MutationObserver(ms => { for (const m of ms) { m.removedNodes.forEach(dimentica); m.addedNodes.forEach(osserva); } })
    .observe(document.body, { childList: true, subtree: true });
  osserva(document.body);
}

/* ---------- 2) misura della fluidità per «Grafica automatica» ---------- */
/** esito salvato per questo dispositivo: "1" = andava a scatti (leggera accesa), "0" = fluida, null = non ancora misurata */
export const esitoMisura = () => sGet("liteAuto");
/** fotogrammi al secondo dell'ultima misura (per mostrarli in Impostazioni) */
export const fpsMisurati = () => +(sGet("liteFps") || 0);
/** sotto questa soglia la plancia «va a scatti» (regolabile in ⚙️ → Questo dispositivo) */
export const sogliaFps = () => Math.min(55, Math.max(15, +(sGet("liteSoglia") || 40)));

const libera = () => document.visibilityState === "visible" && !UI.ss && !UI.sheet && !document.body.classList.contains("ss-on");
function contaFotogrammi(ms) {
  return new Promise(res => {
    let n = 0, t0 = 0;
    const tk = now => { if (!t0) t0 = now; n++; if (now - t0 < ms) requestAnimationFrame(tk); else res(n * 1000 / (now - t0)); };
    requestAnimationFrame(tk);
  });
}
let inCorso = false;
/** misura due volte (3 s ciascuna, a pagina ferma) e prende la migliore, così un attimo di lavoro non conta */
export async function misura(manuale) {
  if (inCorso || !("requestAnimationFrame" in window)) return;
  inCorso = true;
  try {
    const giri = [];
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 20 && !libera(); k++) await new Promise(r => setTimeout(r, 3000));
      if (!libera()) return;
      giri.push(await contaFotogrammi(3000));
      await new Promise(r => setTimeout(r, 1500));
    }
    const fps = Math.round(Math.max(...giri)), lenta = fps < sogliaFps();
    sSet("liteFps", String(fps)); sSet("liteAuto", lenta ? "1" : "0");
    if (grafica() !== "auto") { if (manuale) render(true); return; }
    const prima = document.body.classList.contains("lite");
    applyTheme();
    if (lenta && !prima) {
      render(true);
      toast(t(`La plancia andava a scatti (${fps} fotogrammi al secondo): ho acceso la grafica leggera su questo dispositivo.`,
              `The dashboard was stuttering (${fps} frames per second): light graphics is now on for this device.`),
        false, [t("Annulla", "Undo"), () => { sSet("lite", "0"); applyTheme(); render(true); }]);
    } else if (manuale) {
      render(true);
      toast(lenta ? t(`${fps} fotogrammi al secondo: resta la grafica leggera.`, `${fps} frames per second: light graphics stays on.`)
                  : t(`${fps} fotogrammi al secondo: va bene la grafica completa.`, `${fps} frames per second: full graphics is fine.`));
    }
  } finally { inCorso = false; }
}
/* prima misura: solo con «Automatica», sui dispositivi non ancora misurati, qualche secondo dopo l'avvio */
const daMisurare = () => grafica() === "auto" && esitoMisura() == null && !/Android/i.test(navigator.userAgent);
setTimeout(() => { if (daMisurare()) misura(false); }, 8000);

ACT.liteMisura = () => {
  if (document.body.classList.contains("lite") && grafica() === "auto") {
    /* per misurare la grafica completa la riaccendo un momento */
    sSet("liteAuto", "0"); applyTheme();
  }
  toast(t("Misuro la fluidità: non toccare la plancia per qualche secondo…", "Measuring smoothness: don't touch the dashboard for a few seconds…"));
  setTimeout(() => misura(true), 800);
};
ACT.liteSoglia = el => { sSet("liteSoglia", el.dataset.v); render(true); };


/* 'Nduja Dashboard — 🔠 leggibilità (0.7.62), scelta per ogni dispositivo in ⚙️ Impostazioni → Questo dispositivo:
   - dimensione del testo: Normale, Grande (+15%), Molto grande (+30%). Ingrandisce testi, icone e tasti (le dimensioni dei caratteri
     dei fogli di stile, rifatte qui una volta sola), non i disegni: le scritte già grandi (oltre 24 px) crescono poco;
   - contrasto alto: testi pieni al posto di quelli grigi trasparenti, bordi visibili, un velo più coprente sotto il vetro
     (regole in base.css e tools/light_extra.css, più i colori trasparenti dei fogli di stile resi pieni qui);
   - movimento ridotto: niente animazioni decorative. «Come il sistema» segue prefers-reduced-motion; «Sempre» applica le regole
     che i fogli di stile hanno per prefers-reduced-motion: reduce e ferma quelle che accendono solo con no-preference.
   Le regole si costruiscono solo se servono, in un foglio di stile aggiunto in fondo: chi non sceglie niente non paga niente. */
import { ACT, sGet, sSet, render, toast, t, menoMoto, motoScelta } from "./core.js";

export const dimTesto = () => ["1", "2"].includes(sGet("testo")) ? sGet("testo") : "0";
export const contrastoAlto = () => sGet("contrasto") === "1";
const FATTORE = { "1": 1.15, "2": 1.3 };
/* le scritte grandi (numeri enormi, orologi, emoji-disegno) crescono solo quanto una scritta di 24 px */
const scala = (px, k) => Math.round((px <= 24 ? px * k : px + 24 * (k - 1)) * 100) / 100;
const TRASP = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/;

/* tutte le regole dei fogli di stile della plancia (non il mio), con @media e @supports */
function percorri(lista, fn, out) {
  for (const r of lista) {
    if (r instanceof CSSStyleRule) { const x = fn(r); if (x) out.push(x); }
    else if (r instanceof CSSMediaRule || r instanceof CSSSupportsRule) {
      const dentro = []; percorri(r.cssRules, fn, dentro);
      if (dentro.length) out.push(`@${r instanceof CSSMediaRule ? "media" : "supports"} ${r.conditionText}{${dentro.join("")}}`);
    }
  }
  return out;
}
const fogli = () => [...document.styleSheets].filter(s => s.ownerNode?.id !== "leg1" && (() => { try { return !!s.cssRules; } catch { return false; } })());

function cssTesto(k) {
  const out = [];
  for (const s of fogli()) percorri(s.cssRules, r => {
    const m = /^([\d.]+)px$/.exec(r.style.getPropertyValue("font-size").trim()); if (!m || +m[1] <= 0) return null;
    return `${r.selectorText}{font-size:${scala(+m[1], k)}px${r.style.getPropertyPriority("font-size") ? "!important" : ""}}`;
  }, out);
  return out.join("\n");
}
/* contrasto alto: i colori dei testi semitrasparenti diventano quasi pieni (stesse regole, stessi selettori, dopo) */
function cssContrasto() {
  const out = [];
  for (const s of fogli()) percorri(s.cssRules, r => {
    const c = r.style.getPropertyValue("color").trim(), m = TRASP.exec(c);
    if (!m || +m[4] >= .86 || +m[4] < .2) return null;
    return `${r.selectorText}{color:rgba(${m[1]},${m[2]},${m[3]},.92)${r.style.getPropertyPriority("color") ? "!important" : ""}}`;
  }, out);
  return out.join("\n");
}
/* movimento ridotto scelto qui: le regole @media (prefers-reduced-motion: reduce) valgono sempre, e le animazioni
   che i fogli di stile accendono solo con (prefers-reduced-motion: no-preference) si fermano */
function cssMoto() {
  const out = [];
  const giu = lista => { for (const r of lista) {
    if (r instanceof CSSMediaRule && /prefers-reduced-motion:\s*reduce/.test(r.conditionText)) for (const x of r.cssRules) out.push(x.cssText);
    else if (r instanceof CSSMediaRule && /prefers-reduced-motion:\s*no-preference/.test(r.conditionText)) {
      for (const x of r.cssRules) if (x instanceof CSSStyleRule) {
        const tx = x.style.cssText;   // anche le forme brevi con var(), che non si leggono una proprietà alla volta
        const d = [/(^|;)\s*animation(-name)?\s*:\s*(?!none\s*(;|$))/.test(tx) ? "animation:none!important" : "",
          /(^|;)\s*transition(-property|-duration)?\s*:\s*(?!none\s*(;|$))/.test(tx) ? "transition:none!important" : ""].filter(Boolean);
        if (d.length) out.push(`${x.selectorText}{${d.join(";")}}`);
      }
    }
    else if (r instanceof CSSMediaRule || r instanceof CSSSupportsRule) giu(r.cssRules);
  } };
  for (const s of fogli()) giu(s.cssRules);
  return out.join("\n");
}

let firma = null;
/** applica le scelte di questo dispositivo (classi sul body e, se servono, le regole costruite qui) */
export function applicaLeggibilita() {
  const tx = dimTesto(), hc = contrastoAlto(), rm = motoScelta() === "1" && !sistemaFermo();
  document.body.classList.toggle("tx1", tx === "1"); document.body.classList.toggle("tx2", tx === "2");
  document.body.classList.toggle("hc", hc); document.body.classList.toggle("rm", menoMoto());
  const f = tx + (hc ? "h" : "") + (rm ? "m" : ""); if (f === firma) return; firma = f;
  let st = document.getElementById("leg1");
  if (f === "0") { st?.remove(); return; }
  st?.remove();   // fuori dal conto dei fogli da leggere
  const css = [tx !== "0" ? cssTesto(FATTORE[tx]) : "", hc ? cssContrasto() : "", rm ? cssMoto() : ""].join("\n");
  st = document.createElement("style"); st.id = "leg1"; st.textContent = css; document.head.appendChild(st);
}
const sistemaFermo = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

/* i fogli di stile sono già caricati quando parte questo modulo (index.html li mette prima); se uno è in ritardo, riprovo al suo arrivo */
function pronti() {
  const L = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(l => !l.sheet);
  if (!L.length) return applicaLeggibilita();
  L.forEach(l => l.addEventListener("load", () => { firma = null; applicaLeggibilita(); }, { once: true }));
  applicaLeggibilita();
}
pronti();
try { matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { firma = null; applicaLeggibilita(); render(true); }); } catch {}

Object.assign(ACT, {
  txSet: el => { sSet("testo", el.dataset.v); applicaLeggibilita(); render(true);
    toast("🔠 " + ({ "0": t("Testo normale", "Normal text"), "1": t("Testo grande", "Large text"), "2": t("Testo molto grande", "Extra large text") }[el.dataset.v] || "")); },
  hcSet: el => { sSet("contrasto", el.dataset.v); applicaLeggibilita(); render(true); toast(el.dataset.v === "1" ? "◑ " + t("Contrasto alto", "High contrast") : t("Contrasto normale", "Normal contrast")); },
  rmSet: el => { sSet("moto", el.dataset.v); applicaLeggibilita(); render(true);
    toast(menoMoto() ? "🐢 " + t("Movimento ridotto: niente animazioni decorative", "Reduced motion: no decorative animations") : t("Animazioni come prima", "Animations as before")); },
});

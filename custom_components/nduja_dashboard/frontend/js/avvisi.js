/* Avvisi intelligenti sulla Home: unisce i vecchi «Da sistemare» a controlli più furbi.
   - finestra aperta con il clima acceso nella stessa stanza
   - pioggia in arrivo con finestre aperte
   - porta aperta da più di 10 minuti
   - elettrodomestico finito (lavatrice, asciugatrice, lavastoviglie: dal consumo)
   - pile scariche, telefoni scarichi, aggiornamenti, raccolta da esporre stasera
   Ogni avviso si può nascondere con ✕ (torna se la situazione cambia). */
import { S, ACT, t, esc, nm, ok, val, attr, ents, allEnts, isOn, ago, deviceClass, areaOf, openings, shortName, card, render, sGet, sSet, weatherEnt, forecast } from "./core.js";
import { ritiri, chip } from "./raccolta.js";

const MIN = 6e4;
const vecchio = id => Date.now() - new Date(S[id].last_changed).getTime();
const nascosti = () => { try { return JSON.parse(sGet("dismiss") || "{}"); } catch { return {}; } };

/* --- elettrodomestici: seguo il consumo nel browser --- */
const ELETTRO = /lavatric|asciugatric|lavastovigl|washer|washing|dryer|dishwasher|forno|oven/i;
const elettro = () => allEnts("sensor", id => deviceClass(id) === "power" && ELETTRO.test(id + " " + nm(id)) && ok(id));
let EL = {}; try { EL = JSON.parse(sGet("appl") || "{}"); } catch {}
function seguiElettro() {
  let cambiato = false;
  for (const id of elettro()) {
    const w = val(id) || 0, s = EL[id] || { on: 0, low: 0, fine: 0 }, now = Date.now();
    if (w > 15) { if (!s.on) s.on = now; s.low = 0; }
    else if (s.on && w < 5) {
      if (!s.low) s.low = now;
      if (now - s.low > 3 * MIN) { if (now - s.on > 10 * MIN) s.fine = now; s.on = 0; s.low = 0; }
    }
    if (JSON.stringify(s) !== JSON.stringify(EL[id])) { EL[id] = s; cambiato = true; }
  }
  if (cambiato) sSet("appl", JSON.stringify(EL));
}
setInterval(seguiElettro, 30000);

const pioggia = () => {
  const w = weatherEnt(); if (!w) return false;
  if (/rain|pour|lightning|hail/.test(S[w].state)) return true;
  const f = forecast(w, "hourly").slice(0, 3);
  return f.some(x => /rain|pour|lightning|hail/.test(x.condition || "") || (x.precipitation_probability || 0) >= 60);
};

/** elenco degli avvisi: { k (chiave per nasconderlo), ic, b, s, id?, go?, cls } */
export function avvisi() {
  seguiElettro();
  const A = [], aperte = openings().filter(isOn);
  const clima = ents("climate", id => ok(id) && S[id].state !== "off");
  for (const o of aperte) {
    const conClima = clima.find(c => areaOf(c) && areaOf(c) === areaOf(o));
    const porta = ["door", "garage_door"].includes(deviceClass(o));
    if (conClima) A.push({ k: "cl:" + o + S[o].last_changed, ic: "🌡️", b: `${esc(shortName(o))} ${t("aperta col clima acceso", "open with climate on")}`, s: esc(nm(conClima)) + " · " + ago(S[o].last_changed), id: o, cls: "alert" });
    else if (porta && vecchio(o) > 10 * MIN) A.push({ k: "po:" + o + S[o].last_changed, ic: "🚪", b: `${esc(shortName(o))} ${t("aperta da", "open for")} ${ago(S[o].last_changed).replace(t(" fa", " ago"), "")}`, s: t("forse è rimasta aperta", "maybe left open"), id: o, cls: "alert" });
    else A.push({ k: "ap:" + o + S[o].last_changed, ic: "🪟", b: esc(nm(o)), s: t("aperta", "open") + " · " + ago(S[o].last_changed), id: o, cls: "alert" });
  }
  if (aperte.some(o => deviceClass(o) === "window") && pioggia())
    A.unshift({ k: "rain", ic: "🌧️", b: t("Sta arrivando la pioggia", "Rain is coming"), s: t("ci sono finestre aperte", "some windows are open"), cls: "alert" });
  for (const id of elettro()) if (EL[id]?.fine && Date.now() - EL[id].fine < 6 * 3600e3)
    A.push({ k: "el:" + id + EL[id].fine, ic: "🧺", b: `${esc(shortName(id).replace(/\s*(potenza|power|consumo)\s*/ig, " ").trim())} ${t("ha finito", "is done")}`, s: ago(new Date(EL[id].fine).toISOString()), id });
  const R = new Date().getHours() >= 17 ? ritiri().domani : [];
  if (R.length) A.push({ k: "rf:" + new Date().toDateString(), ic: "♻️", b: t("Stasera esponi", "Put out tonight"), s: R.map(chip).join(" "), raw: true });
  ents("sensor", id => deviceClass(id) === "battery" && ok(id) && val(id) != null && val(id) < 20).sort((a, b) => val(a) - val(b))
    .forEach(id => A.push({ k: "bt:" + id, ic: "🪫", b: esc(nm(id).replace(/\s*(livello\s*)?(batteria|battery)(\s*level)?\s*/ig, " ").trim()), s: `${t("pila al", "battery at")} ${Math.round(val(id))}%`, id }));
  const U = Object.keys(S).filter(id => id.startsWith("update.") && S[id].state === "on");
  if (U.length) A.push({ k: "up:" + U.join(","), ic: "⬆️", b: `${U.length} ${t(U.length === 1 ? "aggiornamento" : "aggiornamenti", U.length === 1 ? "update" : "updates")}`, s: U.slice(0, 3).map(id => esc(String(attr(id, "title") || nm(id)).replace(/\s*(update|aggiornamento)$/i, ""))).join(", "), go: "aggiornamenti" });
  const N = nascosti();
  return A.filter(a => !N[a.k]);
}

export function avvisiCard() {
  const A = avvisi(), n = A.length;
  return card(`🔔 ${t("Avvisi", "Alerts")} <span class="tag ${n ? "warn" : "ok"}">${n || t("tutto ok", "all good")}</span>`, n ? `<div class="stack">${A.map(a => `<div class="li av3 ${a.cls || ""}" ${a.go ? `data-act="go" data-id="${a.go}"` : a.id ? `data-act="more" data-id="${a.id}"` : ""} role="button">
      <span class="ic">${a.ic}</span><div class="tx"><b>${a.b}</b><span>${a.s}</span></div><button class="x3" data-act="avHide" data-k="${esc(a.k)}" aria-label="${t("Nascondi", "Dismiss")}">✕</button></div>`).join("")}</div>`
    : `<div class="small muted">${t("Nessuna finestra aperta, nessuna pila scarica, nessun aggiornamento.", "No open windows, no low batteries, no updates.")}</div>`);
}
ACT.avHide = (el, e) => {
  e?.stopPropagation?.();
  const N = nascosti(); N[el.dataset.k] = Date.now();
  for (const k of Object.keys(N)) if (Date.now() - N[k] > 7 * 864e5) delete N[k];   // pulizia
  sSet("dismiss", JSON.stringify(N)); render();
};

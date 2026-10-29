/* Novità in casa: la plancia ricorda i dispositivi già visti (nelle scelte salvate in Home Assistant, uguali su
   tutti i dispositivi) e, quando ne compaiono di nuovi, lo dice agli amministratori nella Home e negli Avvisi.
   Dal foglio delle novità si aggiungono (modalità manuale) o si tolgono (automatica); «Ho visto» li segna come visti.
   Le auto le gestisce la pagina Auto: qui dico solo che ne è arrivata una nuova.
   Serve anche a ＋ Aggiungi (edit.js) per la sezione «Suggeriti». */
import { S, REG, AREAS, DEVICES, UI, ACT, LAYOUT, PAGES, HOOKS, DEFAULT_OFF, OPENING, t, LOC, esc, nm, ok, domain, deviceClass, areaOf, areasSorted,
  isAdmin, isTV, tvInMedia, isManual, saveLayout, toast, openSheet, closeSheet, render, go, pronto } from "./core.js";

/* tipi di dispositivi che la plancia ricorda */
const TIPI = ["light", "climate", "switch", "cover", "fan", "media_player", "lock", "vacuum", "camera", "person", "scene"];
const ICONA = { light: "💡", climate: "❄️", switch: "🔌", cover: "🪟", fan: "🌀", media_player: "📺", lock: "🔒", vacuum: "🤖", camera: "📷", person: "👤", scene: "🎬", binary_sensor: "🚪" };
/** entità di un tipo che la plancia ricorda (anche nascoste: servono per la prima volta) */
const seguita = id => { const d = domain(id); return TIPI.includes(d) || (d === "binary_sensor" && OPENING.includes(deviceClass(id))); };
/** come allEnts: niente entità nascoste, di configurazione o di diagnostica */
const utile = id => !REG[id]?.hidden && REG[id]?.cat == null;
/** doppioni nascosti di proposito dalle pagine (sotto-flussi delle telecamere, mappe dei robot, comandi delle auto…) */
const doppione = id => DEFAULT_OFF.some(f => { try { return f(id); } catch { return false; } });
const copia = () => JSON.parse(JSON.stringify(LAYOUT));

/* ---------- auto: le riconosce pages/auto.js, che arriva con le pagine «secondarie» ---------- */
let autoFn = null, autoCarica = false;
function caricaAuto() {
  if (autoFn || autoCarica || !pronto()) return;
  autoCarica = true;
  import("./pages/auto.js").then(m => { autoFn = m.auto; }).catch(e => { console.warn("nduja auto", e); autoFn = () => []; }).finally(() => render());
}
const auto = () => { try { return autoFn ? autoFn() : []; } catch { return []; } };
const pronti = () => pronto() && !!autoFn && Object.keys(S).length > 0;

/* ---------- entità comparse da poco: aspetto qualche secondo che arrivino anche i registri ---------- */
let PRIMA = null;
const ATTESA = 5000;
function matura(id) {
  if (PRIMA[id] == null) { PRIMA[id] = Date.now(); setTimeout(() => render(), ATTESA + 200); }
  return Date.now() - PRIMA[id] >= ATTESA;
}

/** dispositivi nuovi: non ancora visti, non nascosti, non di configurazione, non doppioni e non di un'auto */
export function nuovi() {
  if (!pronti() || !Array.isArray(LAYOUT.seen)) return [];
  if (!PRIMA) { PRIMA = {}; for (const k of Object.keys(S)) PRIMA[k] = 0; }   // quelle che c'erano all'apertura valgono subito
  const V = new Set(LAYOUT.seen), car = new Set(auto());
  return Object.keys(S).filter(id => !V.has(id) && seguita(id) && utile(id) && !car.has(REG[id]?.device) && !doppione(id) && matura(id))
    .sort((a, b) => nm(a).localeCompare(nm(b), LOC));
}
/** auto nuove (id del dispositivo) */
export function autoNuove() {
  if (!pronti() || !Array.isArray(LAYOUT.seenCars)) return [];
  return auto().filter(d => !LAYOUT.seenCars.includes(d));
}
/** segna come visti, dentro una copia delle scelte che sto per salvare */
export function segnaVisti(l, ids = [], cars = []) {
  if (Array.isArray(l.seen) && ids.length) l.seen = [...new Set([...l.seen, ...ids])];
  if (Array.isArray(l.seenCars) && cars.length) l.seenCars = [...new Set([...l.seenCars, ...cars])];
}
const nuovo = id => Array.isArray(LAYOUT.seen) && !LAYOUT.seen.includes(id);

/* ---------- prima volta (o dopo l'aggiornamento): tutto quello che c'è è già visto, niente avviso enorme ---------- */
let inizioFatto = false;
HOOKS.push(() => {
  caricaAuto();
  if (inizioFatto || !isAdmin() || !pronti()) return;
  if (Array.isArray(LAYOUT.seen) && Array.isArray(LAYOUT.seenCars)) return;
  inizioFatto = true;
  const l = copia();
  if (!Array.isArray(l.seen)) l.seen = Object.keys(S).filter(seguita).sort();
  if (!Array.isArray(l.seenCars)) l.seenCars = auto();
  saveLayout(l).catch(e => console.warn("nduja visti", e));
});

async function salva(l, msg) {
  try { await saveLayout(l); if (msg) toast(msg); } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e.code), true); }
}

/* ---------- dove compare un dispositivo (modalità automatica) ---------- */
const PAGINE = { light: ["luci"], climate: ["clima"], switch: ["dispositivi"], cover: ["dispositivi"], fan: ["dispositivi"], lock: ["sicurezza", "dispositivi"],
  media_player: ["musica"], vacuum: ["robot"], camera: ["telecamere"], binary_sensor: ["sicurezza"] };
function dove(id) {
  const d = domain(id), a = areaOf(id);
  if ((LAYOUT.hiddenAreas || []).includes(a)) return "🙈 " + t("in una stanza nascosta: non compare", "in a hidden room: not shown");
  if (d === "person") return "🏠 " + t("nella Home, tra le persone", "on Home, under People");
  if (d === "scene") return "🏠 " + t("nella Home, sotto il saluto", "on Home, under the greeting");
  const P = (d === "remote" || (d === "media_player" && isTV(id) && tvInMedia()) ? ["media"] : PAGINE[d] || []).filter(k => PAGES[k] && LAYOUT.pages?.[k] !== false);
  if (!P.length) return t("la sua pagina è spenta in ⚙️ Impostazioni", "its page is turned off in ⚙️ Settings");
  return PAGES[P[0]].icon + " " + t("nella pagina ", "on the page ") + P.map(k => PAGES[k].title).join(t(" e ", " and "));
}
const stato = id => {
  if (!ok(id)) return t("non raggiungibile", "unavailable");
  const s = S[id].state;
  return { on: t("acceso", "on"), off: t("spento", "off"), open: t("aperta", "open"), closed: t("chiusa", "closed"), home: t("a casa", "home"), not_home: t("fuori", "away"),
    locked: t("chiusa", "locked"), unlocked: t("aperta", "unlocked"), playing: t("in riproduzione", "playing"), docked: t("alla base", "docked") }[s]
    || (domain(id) === "scene" ? "" : String(s).replace(/_/g, " "));
};

/* ---------- foglio delle novità ---------- */
const NV = { ids: [], cars: [] };
const quanti = n => n === 1 ? t("1 dispositivo nuovo trovato", "1 new device found") : t(`${n} dispositivi nuovi trovati`, `${n} new devices found`);
const autoTesto = () => t("Nuova auto trovata: la trovi nella pagina Auto", "New car found: you'll find it on the Car page");
const nomeAuto = d => LAYOUT.cars?.[d]?.nome || DEVICES[d]?.name || "";
function foglio() {
  const man = isManual(), L = NV.ids.filter(id => S[id]), inc = new Set(LAYOUT.include || []), exc = new Set(LAYOUT.exclude || []);
  const g = {}; L.forEach(id => { const a = areaOf(id) && AREAS[areaOf(id)] ? areaOf(id) : "_"; (g[a] = g[a] || []).push(id); });
  const ord = [...areasSorted(true).filter(a => g[a]), ...(g._ ? ["_"] : [])];
  const riga = id => {
    const ic = ICONA[domain(id)] || "•";
    if (man) { const on = inc.has(id);
      return `<button class="ck1 nv2 ${on ? "on" : ""}" data-act="nvInc" data-id="${id}"><span class="bx"></span><span class="nv2i">${ic}</span><span class="tx"><b>${esc(nm(id))}</b><small>${esc(id)}</small></span><span class="st">${esc(stato(id))}</span></button>`; }
    const tolto = exc.has(id);
    return `<div class="li nv3 ${tolto ? "dis" : ""}"><span class="ic">${ic}</span><div class="tx"><b>${esc(nm(id))}</b><span>${tolto ? "✕ " + t("tolto dalla plancia", "removed from the dashboard") : esc(dove(id))}</span></div>
      <button class="btn sm ${tolto ? "" : "bad"}" data-act="nvTogli" data-id="${id}">${tolto ? "↺ " + t("Rimetti", "Put back") : "✕ " + t("Togli", "Remove")}</button></div>`;
  };
  const tutti = man && L.some(id => !inc.has(id));
  return `<div class="sh-head"><div><h3>✨ ${L.length ? quanti(L.length) : t("Novità in casa", "New in your home")}</h3><div class="small muted">${L.length ? (man
      ? t("Sono comparsi in Home Assistant. Spunta quelli che vuoi nella plancia: gli altri restano in ＋ Aggiungi di ogni pagina.", "They showed up in Home Assistant. Tick the ones you want on the dashboard: the others stay in ＋ Add on every page.")
      : t("Sono comparsi in Home Assistant e li ho già messi nella plancia. Togli quelli che non ti servono.", "They showed up in Home Assistant and I already put them on the dashboard. Remove the ones you don't need.")) : ""}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${NV.cars.length ? `<button class="li nv3" data-act="nvAuto"><span class="ic">🚗</span><div class="tx"><b>${esc(autoTesto())}</b><span>${esc(NV.cars.map(nomeAuto).filter(Boolean).join(", ") || t("Foto, batteria, ricarica e comandi", "Photo, battery, charging and controls"))}</span></div><span class="st">›</span></button>` : ""}
    ${tutti ? `<div class="row" style="margin:10px 0 2px"><button class="btn pri" data-act="nvAll">＋ ${t("Aggiungi tutti", "Add all")}</button></div>` : ""}
    ${ord.map(a => `<div class="fl1">${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)}</div><div class="${man ? "cks1" : "stack"}">${g[a].map(riga).join("")}</div>`).join("")}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn ${tutti ? "" : "pri"}" data-act="nvVisto">👍 ${t("Ho visto", "Got it")}</button></div>
    <p class="small muted" style="margin-top:10px">${t("«Ho visto» li toglie dagli avvisi. Puoi sempre aggiungere o togliere con ✏️ Modifica in ogni pagina.", "«Got it» clears them from the alerts. You can always add or remove with ✏️ Edit on every page.")}</p>`;
}

/* ---------- avviso nella Home (in cima) e negli Avvisi ---------- */
const nomi = L => { const n = L.slice(0, 3).map(id => esc(nm(id))).join(", "); const r = L.length - 3;
  return r > 0 ? n + (r === 1 ? t(" e un altro", " and 1 more") : t(` e altri ${r}`, ` and ${r} more`)) : n; };
export function novitaHome() {
  if (!isAdmin()) return "";
  const L = nuovi(), C = autoNuove(); if (!L.length && !C.length) return "";
  return `<section class="card span3 nv1">
    ${L.length ? `<div class="nv1r"><span class="nv1i" aria-hidden="true">✨</span><div class="nv1t"><b>${quanti(L.length)}</b><span>${nomi(L)}</span></div>
      <div class="nv1b"><button class="btn sm pri" data-act="nvApri">👀 ${t("Guarda", "Show me")}</button><button class="btn sm" data-act="nvVisto">👍 ${t("Ho visto", "Got it")}</button></div></div>` : ""}
    ${C.length ? `<div class="nv1r"><span class="nv1i" aria-hidden="true">🚗</span><div class="nv1t"><b>${esc(autoTesto())}</b><span>${t("Foto, batteria, ricarica e comandi in un posto solo.", "Photo, battery, charging and controls in one place.")}</span></div>
      <div class="nv1b"><button class="btn sm pri" data-act="nvAuto">🚗 ${t("Apri Auto", "Open Car")}</button>${L.length ? "" : `<button class="btn sm" data-act="nvVisto">👍 ${t("Ho visto", "Got it")}</button>`}</div></div>` : ""}
  </section>`;
}
/** voci per la scheda Avvisi (solo amministratori) */
export function novitaAvvisi() {
  if (!isAdmin()) return [];
  const L = nuovi(), C = autoNuove(), A = [];
  if (L.length) A.push({ k: "nv:" + L.length + ":" + L[L.length - 1], ic: "✨", b: quanti(L.length), s: nomi(L), act: "nvApri" });
  if (C.length) A.push({ k: "na:" + C.join(","), ic: "🚗", b: esc(autoTesto()), s: t("tocca per aprirla", "tap to open it"), act: "nvAuto" });
  return A;
}

/* ---------- suggeriti in ＋ Aggiungi ---------- */
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** i più adatti tra i candidati del foglio ＋ Aggiungi: [{ id, why }] (al massimo 6)
    pagine normali: i dispositivi nuovi e quelli della stanza del pulsante; pagine create da te: quelli che c'entrano col nome */
export function suggeriti(ids, { area = "", titolo = "" } = {}) {
  const car = new Set(auto()), exc = new Set(isManual() ? [] : LAYOUT.exclude || []), nasc = new Set(LAYOUT.hiddenAreas || []);
  const parole = norm(titolo).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  const out = [];
  for (const id of ids) {
    if (!ok(id) || doppione(id) || car.has(REG[id]?.device) || exc.has(id) || nasc.has(areaOf(id))) continue;
    let p = 0, why = "";
    if (titolo) { const txt = norm(nm(id) + " " + (AREAS[areaOf(id)]?.name || "")); if (parole.some(w => txt.includes(w))) { p = 3; why = "pagina"; } }
    else {
      if (nuovo(id) && seguita(id)) { p += 4; why = "nuovo"; }
      if (area && areaOf(id) === area) { p += 2; why = why || "stanza"; }
    }
    if (p > 0) out.push({ id, p, why });
  }
  return out.sort((a, b) => b.p - a.p || nm(a.id).localeCompare(nm(b.id), LOC)).slice(0, 6);
}

/* ---------- azioni ---------- */
const togliArea = (l, id) => { const a = areaOf(id); if (a && (l.hiddenAreas || []).includes(a)) l.hiddenAreas = l.hiddenAreas.filter(x => x !== a); };
Object.assign(ACT, {
  nvApri: () => { NV.ids = nuovi(); NV.cars = autoNuove(); openSheet(foglio); },
  nvVisto: () => {
    const aperto = UI.sheet === foglio, ids = aperto ? NV.ids : nuovi(), cars = aperto ? NV.cars : autoNuove(), l = copia();
    segnaVisti(l, ids, cars); closeSheet(); salva(l, "👍 " + t("Segnati come visti", "Marked as seen"));
  },
  nvAuto: () => { const C = autoNuove(), l = copia(); segnaVisti(l, [], C); NV.cars = []; closeSheet(); salva(l); go("auto"); },
  /* manuale: spunta = nella plancia (e visto) */
  nvInc: el => {
    const id = el.dataset.id, l = copia(), inc = new Set(l.include || []);
    if (inc.has(id)) inc.delete(id); else { inc.add(id); togliArea(l, id); }
    l.include = [...inc]; segnaVisti(l, [id]); salva(l);
  },
  nvAll: () => {
    const ids = NV.ids.filter(id => S[id]), l = copia();
    l.include = [...new Set([...(l.include || []), ...ids])]; ids.forEach(id => togliArea(l, id));
    segnaVisti(l, ids); closeSheet(); salva(l, "＋ " + t(`${ids.length} aggiunt${ids.length === 1 ? "o" : "i"} alla plancia`, `${ids.length} added to the dashboard`));
  },
  /* automatica: ✕ toglie dalla plancia (e lo segna come visto), ↺ lo rimette */
  nvTogli: el => {
    const id = el.dataset.id, l = copia(), exc = new Set(l.exclude || []);
    if (exc.has(id)) exc.delete(id); else exc.add(id);
    l.exclude = [...exc]; segnaVisti(l, [id]); salva(l);
  },
});

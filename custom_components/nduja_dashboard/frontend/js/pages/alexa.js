/* 🗣️ Alexa: gli Echo di casa (integrazione Alexa Media Player), disegnati, con il volume a colori e i messaggi.
   - Griglia: solo gli altoparlanti veri (Show, Dot, Echo, Pop, Studio). Fire TV, Echo Auto, l'app sul telefono («This Device»)
     e quelli non disponibili vanno in «Altri»; i gruppi di Alexa a parte. Con ✏️ si mostra o si nasconde ognuno, si rinomina,
     si sceglie il colore e si trascina per cambiare l'ordine.
   - Il disegno si accende quando qualcuno dice «Alexa…» a quell'Echo: Alexa Media Player aggiorna last_called (vero sull'Echo
     chiamato per ultimo), last_called_timestamp e last_called_summary (la frase). Se mancano (versioni vecchie), ripiego:
     l'Echo che inizia a suonare o cambia volume. Resta acceso circa 8 secondi, poi si spegne in dissolvenza.
   - Messaggio: a chi (chip), testo, 📢 Annuncio o 🗣️ Parla, frasi pronte, ultimi 10 mandati (su questo dispositivo).
     Servizio notify.alexa_media (target = gli Echo scelti, data.type = announce | tts), altrimenti notify.alexa_media_<nome>.
   - Comandi per tutti (volume uguale, Ferma tutto, muto) e «Chiedi ad Alexa» (play_media con media_content_type custom).
   - Altrove: scheda della Home «Manda un messaggio» (HOME_EXTRA), blocchi del Colpo d'occhio (COLPO), pannello del
     salvaschermo «Casa» (VISTE.alexaSS), collegamento dalla Musica.
   Scelte della casa in LAYOUT.alexa: { mostra: { id: true|false }, colori: { id: "#rrggbb" }, frasi: [testo], tipo: "announce"|"tts", ss: false };
   l'ordine in LAYOUT.ordine.alexa; i nomi in LAYOUT.names (come nel resto della plancia). */
import { VERS, memoGen, memoVer, S, REG, DEVICES, AREAS, ACT, CHG, UI, LAYOUT, PAGES, HOME_EXTRA, COLPO, VISTE, HOOKS, t, esc, nmHA, ok, attr, idsDi,
  areaOf, card, page, svc, ws, cached, uncache, toast, openSheet, closeSheet, render, isAdmin, sGet, sSet, ordina, weatherEnt, WX, fnum, hhmm,
  utenteCfg, linkHacs, myHA } from "../core.js";
import { cambia } from "../edit.js";
import { TRASCINA, salvaOrdine, inModifica } from "../trascina.js";
import { disegnoEcho } from "../disegni.js";

const F = { PAUSE: 1, VOL: 4, MUTE: 8, PLAY_MEDIA: 512, STOP: 4096 };
const ha = (id, f) => ((attr(id, "supported_features") || 0) & f) === f;
const AX = () => LAYOUT.alexa || {};
const pagAttiva = () => LAYOUT.pages?.alexa !== false && utenteCfg().pages?.alexa !== false;

/* ================= riconoscimento ================= */
/** tutti i media_player di Alexa Media Player */
export const echi = memoGen(() => idsDi("media_player").filter(id => REG[id]?.platform === "alexa_media" && !REG[id]?.hidden && S[id]));
const modello = id => String(DEVICES[REG[id]?.device]?.model || "").trim();
/** tipo di disegno: dal modello del registro dei dispositivi, altrimenti dal nome */
function tipo(id) {
  const m = modello(id).toLowerCase(), s = (m + " " + nmHA(id) + " " + id).toLowerCase();
  if (/speaker group|\bgroup\b|gruppo/.test(m)) return "gruppo";
  if (/fire\s*tv|firetv|fire_tv|\bcube\b/.test(s)) return "firetv";
  if (/echo auto|echo_auto|\bauto\b/.test(s)) return "auto";
  if (/mobile|\bapp\b|this device|this_device|tablet|fire hd/.test(s)) return "app";
  if (/show|spot/.test(s)) return "show";
  if (/studio/.test(s)) return "studio";
  if (/\bpop\b/.test(s)) return "pop";
  if (/\bdot\b|echo/.test(s)) return "sfera";
  return "altro";
}
const CASSE = ["show", "sfera", "pop", "studio"];
/** nella griglia (o tra i gruppi): la scelta con ✏️, altrimenti solo gli altoparlanti veri raggiungibili */
const mostrato = id => { const v = AX().mostra?.[id]; return v != null ? !!v : (CASSE.includes(tipo(id)) || tipo(id) === "gruppo") && ok(id); };
export const griglia = memoVer(() => ordina(echi().filter(id => tipo(id) !== "gruppo" && mostrato(id)), "alexa"));
const gruppi = memoVer(() => echi().filter(id => tipo(id) === "gruppo" && mostrato(id)));
const altri = memoVer(() => echi().filter(id => !mostrato(id)));

/* ---------- nomi: «Echo Show  di Giovanni Echo Show di Giovanni» → «Echo Show 5 · Salotto» ---------- */
function pulisci(n) {
  n = String(n || "").replace(/\s+/g, " ").trim();
  for (let i = Math.floor(n.length / 2) - 1; i <= Math.ceil(n.length / 2); i++)
    if (i > 0 && n[i] === " " && n.slice(0, i).toLowerCase() === n.slice(i + 1).toLowerCase()) return n.slice(0, i);
  /* «Echo Show di Giovanni Echo Show di Giovanni» con un pezzo ripetuto e spazi diversi */
  const w = n.split(" "), h = w.length / 2;
  if (Number.isInteger(h) && w.slice(0, h).join(" ").toLowerCase() === w.slice(h).join(" ").toLowerCase()) return w.slice(0, h).join(" ");
  return n;
}
const NOMI = memoGen(() => {
  const base = {}, conta = {};
  for (const id of echi()) {
    const m = modello(id), a = AREAS[areaOf(id)]?.name;
    let n = CASSE.includes(tipo(id)) || tipo(id) === "auto" ? (/^echo\b/i.test(m) ? m : pulisci(nmHA(id))) : pulisci(nmHA(id));
    if (a && !n.toLowerCase().includes(a.toLowerCase())) n += " · " + a;
    base[id] = n; conta[n.toLowerCase()] = (conta[n.toLowerCase()] || 0) + 1;
  }
  /* due uguali (due «Echo Dot» senza stanza): aggiungo il nome di Alexa */
  for (const id of echi()) if (conta[base[id].toLowerCase()] > 1 && pulisci(nmHA(id)).toLowerCase() !== base[id].toLowerCase()) base[id] += " · " + pulisci(nmHA(id));
  return base;
});
const nomeAuto = id => NOMI()[id] || pulisci(nmHA(id));
export const nome = id => LAYOUT.names?.[id] || nomeAuto(id);

/* ---------- colori: una tavolozza 'Nduja, uno diverso per Echo, cambiabile con ✏️ ---------- */
const TAVOLOZZA = ["#0a84ff", "#30d158", "#ff9f0a", "#bf5af2", "#ff375f", "#64d2ff", "#ffd60a", "#ff6b3d", "#5e5ce6", "#2fd3b5"];
const ORDINE_C = memoGen(() => echi().slice().sort());
/* nello stile in linea il colore va come rgb(): light.css cambia il colore del testo degli elementi con certi esadecimali nello stile */
const rgb = h => `rgb(${[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(",")})`;
const colore = id => { const c = AX().colori?.[id]; return /^#[0-9a-f]{6}$/i.test(c || "") ? c : TAVOLOZZA[Math.max(0, ORDINE_C().indexOf(id)) % TAVOLOZZA.length]; };

/* ---------- stato ---------- */
const STATO = () => ({ playing: t("In riproduzione", "Playing"), paused: t("In pausa", "Paused"), idle: t("Inattivo", "Idle"), on: t("Inattivo", "Idle"), off: t("Spento", "Off"),
  standby: t("Inattivo", "Idle"), buffering: t("Sta caricando…", "Loading…") });
const suona = id => ["playing", "buffering"].includes(S[id]?.state);
function statoTesto(id) {
  if (!ok(id)) return t("Non disponibile", "Unavailable");
  const s = S[id].state, a = S[id].attributes, tit = [a.media_title, a.media_artist].filter(Boolean).join(" · ");
  return (STATO()[s] || s) + (suona(id) && tit ? " · " + tit : "");
}
const volume = id => { const v = attr(id, "volume_level"); return v == null || isNaN(+v) ? null : Math.round(+v * 100); };
const muto = id => !!attr(id, "is_volume_muted");

/* ================= «Alexa…»: il disegno si accende ================= */
const DURATA = 8000;
const LUCE = {};     // id -> { fino, frase }
const VISTO = {};    // id -> ultimo last_called_timestamp visto (il primo si ricorda soltanto: aprendo la plancia non si accende niente)
const PRIMA = {};    // ripiego senza last_called: id -> { s, v }
let ripieghi = false;
/** controlla se qualcuno ha appena chiamato un Echo; vero se qualcosa si è acceso o spento */
function controlla() {
  const ora = Date.now(); let cambio = false; ripieghi = false;
  for (const id of echi()) {
    const a = S[id]?.attributes || {};
    if ("last_called_timestamp" in a || "last_called" in a) {
      const ts = +a.last_called_timestamp || 0;
      if (!(id in VISTO)) VISTO[id] = ts;
      else if (ts !== VISTO[id]) {
        VISTO[id] = ts;
        /* last_called vero e la chiamata è di adesso (non un vecchio valore riletto dopo una riconnessione) */
        if (a.last_called && ts && Math.abs(ora - ts) < 120000) { LUCE[id] = { fino: ora + DURATA, frase: String(a.last_called_summary || "").trim() }; cambio = true; }
      }
    } else if (CASSE.includes(tipo(id))) {
      ripieghi = true;
      const s = S[id]?.state, v = a.volume_level, p = PRIMA[id]; PRIMA[id] = { s, v };
      if (p && ((s !== p.s && ["playing", "buffering"].includes(s)) || (v != null && p.v != null && v !== p.v))) { LUCE[id] = { fino: ora + DURATA, frase: "" }; cambio = true; }
    }
    if (LUCE[id] && LUCE[id].fino <= ora) { delete LUCE[id]; cambio = true; }
  }
  return cambio;
}
export const ascolta = id => !!LUCE[id] && LUCE[id].fino > Date.now();
const fraseDetta = id => ascolta(id) ? LUCE[id].frase : "";
const statoDisegno = id => !ok(id) ? "na" : ascolta(id) ? "ascolta" : suona(id) ? "suona" : "fermo";
HOOKS.push(() => { if (echi().length) controlla(); });
/* ogni secondo: si accende subito (anche sotto il salvaschermo, dove la pagina non si ridisegna) e si spegne dopo 8 secondi */
setInterval(() => {
  if (document.hidden || !echi().length || !controlla()) return;
  if (UI.ss) document.querySelectorAll("[data-axl] svg.axd").forEach(sv => { const id = sv.parentNode.dataset.axl; if (S[id]) sv.setAttribute("class", sv.getAttribute("class").replace(/\bs-\w+/, "s-" + statoDisegno(id))); });
  else render();
}, 1000);

/* ---------- il disegno di un Echo ---------- */
function schermo(id) {
  const a = S[id]?.attributes || {}, w = weatherEnt();
  if (suona(id)) return { titolo: a.media_title || t("In riproduzione", "Playing"), sotto: a.media_artist || a.media_album_name || "", img: a.entity_picture || "" };
  return { ora: hhmm(Date.now()), meteo: w && S[w] && ok(w) ? (WX()[S[w].state] || ["🌡️"])[0] + " " + fnum(attr(w, "temperature"), 0) + "°" : "" };
}
export const disegno = (id, piccolo = false) => disegnoEcho(tipo(id), statoDisegno(id), { piccolo, schermo: tipo(id) === "show" && !piccolo ? schermo(id) : null });
/** chip (a chi mandare, Home, Colpo d'occhio): con il disegnino che si accende anche lui */
const mini = id => `<span class="ax1mi" data-axl="${esc(id)}">${disegno(id, true)}</span>`;

/* ================= volume ================= */
function barra(id, grande = true) {
  const v = volume(id), dis = !ok(id) || !ha(id, F.VOL) || v == null, p = v ?? 0;
  return `<div class="ax1v ${grande ? "" : "sm"} ${muto(id) ? "mu" : ""}">
    <input type="range" min="0" max="100" step="1" value="${p}" style="--p:${p}%" data-axv data-chg="axVol" data-id="${esc(id)}" aria-label="${esc(t("Volume di ", "Volume of ") + nome(id))}" ${dis ? "disabled" : ""}>
    <output>${dis && v == null ? "—" : p + "%"}</output>
    ${ha(id, F.MUTE) && ok(id) ? `<button class="ax1mu ${muto(id) ? "on" : ""}" data-act="axMuto" data-id="${esc(id)}" aria-pressed="${muto(id)}" aria-label="${muto(id) ? t("Togli il muto", "Unmute") : t("Muto", "Mute")}">${muto(id) ? "🔇" : "🔈"}</button>` : ""}</div>`;
}
/* il numero e il colore seguono il dito mentre si trascina */
document.addEventListener("input", e => { const el = e.target; if (!el.matches?.("[data-axv]")) return; el.style.setProperty("--p", el.value + "%"); const o = el.nextElementSibling; if (o?.tagName === "OUTPUT") o.textContent = el.value + "%"; });

/* ================= pagina ================= */
const V = { altri: false };
function tessera(id) {
  const fr = fraseDetta(id), mod = inModifica();
  return `<div class="ax1e s-${statoDisegno(id)} ${mod ? "ed" : ""}" style="--axc:${rgb(colore(id))}" data-tri="${esc(id)}">
    <button class="ax1d" data-axl="${esc(id)}" data-act="${mod ? "axEd" : "more"}" data-id="${esc(id)}" aria-label="${esc(nome(id))}">${disegno(id)}</button>
    <b class="ax1n">${esc(nome(id))}</b>
    <span class="ax1s">${esc(statoTesto(id))}</span>
    <span class="ax1fr" aria-live="polite">${fr ? "«" + esc(fr) + "»" : ""}</span>
    ${barra(id)}
    ${mod ? `<span class="edb"><button data-act="axEd" data-id="${esc(id)}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="axMostra" data-id="${esc(id)}" data-v="0" aria-label="${t("Togli dalla griglia", "Remove from the grid")}">✕</button></span>` : ""}</div>`;
}
function grigliaCard() {
  const G = griglia(), mod = inModifica();
  const vuota = !G.length ? `<div class="empty">${altri().length ? t("Nessun Echo nella griglia: mostrane uno da «Altri» qui sotto.", "No Echo in the grid: show one from «Others» below.") : t("Nessun Echo trovato.", "No Echo found.")}</div>` : "";
  return card(`🗣️ ${t("I tuoi Echo", "Your Echo devices")}`, `<div class="ax1g" ${mod ? `data-tr="alexa"` : ""}>${G.map(tessera).join("")}</div>${vuota}
    ${mod ? `<p class="small muted" style="margin-top:10px">${t("Trascina per cambiare l'ordine. Tocca un Echo per nome, colore e se mostrarlo.", "Drag to change the order. Tap an Echo for name, colour and whether to show it.")}</p>` : ""}`,
    { cls: "span3 ax1gc", right: ripieghi ? `<span class="small muted" title="${esc(t("Aggiorna Alexa Media Player per vedere la frase detta.", "Update Alexa Media Player to see what was said."))}">ⓘ</span>` : "" });
}
function rigaPiccola(id, extra = "") {
  return `<div class="ax1r ${ok(id) ? "" : "dis"}" style="--axc:${rgb(colore(id))}" data-tri="${esc(id)}">${mini(id)}<div class="tx"><b>${esc(nome(id))}</b><span>${esc(statoTesto(id))}${modello(id) && modello(id) !== nome(id) ? " · " + esc(modello(id)) : ""}</span></div>${extra}</div>`;
}
function gruppiCard() {
  const L = gruppi(), mod = inModifica(); if (!L.length) return "";
  return card(`👥 ${t("Gruppi di Alexa", "Alexa groups")}`, `<div class="stack">${L.map(id => `<div class="ax1gr">${rigaPiccola(id, mod ? `<button class="btn sm" data-act="axMostra" data-id="${esc(id)}" data-v="0">🙈 ${t("Nascondi", "Hide")}</button>` : "")}${barra(id, false)}</div>`).join("")}</div>`, { cls: "ax1grc" });
}
function altriCard() {
  const L = altri(), mod = inModifica(); if (!L.length) return "";
  const aperto = V.altri || mod;
  return card(`📦 ${t("Altri", "Others")} <small class="muted">${L.length}</small>`, aperto
    ? `<div class="stack">${L.map(id => rigaPiccola(id, mod ? `<button class="btn sm" data-act="axMostra" data-id="${esc(id)}" data-v="1">👁️ ${t("Mostra", "Show")}</button>` : "")).join("")}</div>
      <p class="small muted" style="margin-top:8px">${t("Fire TV, Echo Auto, l'app sul telefono e gli Echo non disponibili restano qui. Con ✏️ Modifica li mostri nella griglia.", "Fire TV, Echo Auto, the phone app and unavailable Echo devices stay here. Use ✏️ Edit to show them in the grid.")}</p>`
    : `<div class="ax1al">${L.map(mini).join("")}</div><button class="btn sm" data-act="axAltri" style="margin-top:10px">${t("Mostra l'elenco", "Show the list")}</button>`, { cls: "ax1ac" });
}

/* ================= messaggio ================= */
const FRASI0 = () => [t("A tavola!", "Dinner's ready!"), t("Si esce tra 5 minuti", "We're leaving in 5 minutes"), t("Buonanotte a tutti", "Good night everyone"),
  t("Qualcuno mi aiuta a portare la spesa?", "Can someone help me with the shopping?"), t("Ricordatevi di spegnere le luci", "Remember to turn the lights off")];
const frasi = () => Array.isArray(AX().frasi) ? AX().frasi.filter(x => typeof x === "string" && x.trim()) : FRASI0();
const tipoDef = () => AX().tipo === "tts" ? "tts" : "announce";
let TIPO = null;
const tipoOra = () => TIPO || tipoDef();
/** a chi mandarlo: scelta di questo dispositivo ("tutti" o un elenco) */
const destinatari = () => [...griglia(), ...gruppi()].filter(ok);
function scelta() { try { const v = JSON.parse(sGet("alexa_a") || '"tutti"'); return Array.isArray(v) ? v.filter(id => destinatari().includes(id)) : "tutti"; } catch { return "tutti"; } }
const tutti = () => { const s = scelta(); return s === "tutti" || !s.length; };
const scelti = () => tutti() ? griglia().filter(ok) : scelta();
function chip(id) {
  const on = !tutti() && scelta().includes(id);
  return `<button class="ax1c ${on ? "on" : ""} ${tipo(id) === "gruppo" ? "grp" : ""}" style="--axc:${rgb(colore(id))}" data-act="axChi" data-id="${esc(id)}" aria-pressed="${on}">${mini(id)}<span>${esc(nome(id))}</span></button>`;
}
function chips() {
  const G = griglia().filter(ok), R = gruppi().filter(ok);
  return `<div class="ax1cs" role="group" aria-label="${t("A chi", "To whom")}"><button class="ax1c tut ${tutti() ? "on" : ""}" data-act="axChi" data-id="" aria-pressed="${tutti()}"><span>🏠 ${t("Tutti", "Everyone")}</span></button>${G.map(chip).join("")}${R.length ? `<span class="ax1cg" aria-hidden="true"></span>${R.map(chip).join("")}` : ""}</div>`;
}
const tipoSeg = () => `<div class="seg ax1ts">${[["announce", "📢 " + t("Annuncio", "Announce")], ["tts", "🗣️ " + t("Parla", "Speak")]].map(([k, n]) => `<button class="${tipoOra() === k ? "act" : ""}" data-act="axTipo" data-v="${k}" aria-pressed="${tipoOra() === k}">${n}</button>`).join("")}</div>`;
const casella = () => `<div class="ax1in"><input class="ax1q" type="text" maxlength="400" enterkeyhint="send" autocomplete="off" placeholder="${esc(t("Scrivi qui il messaggio…", "Type your message here…"))}" aria-label="${esc(t("Messaggio", "Message"))}">
  <button class="btn pri ax1go" data-act="axInvia" aria-label="${t("Invia", "Send")}">➤<span> ${t("Invia", "Send")}</span></button></div>`;
/* ---------- servizi ---------- */
const servizi = () => cached("axsvc", 5 * 60000, () => ws({ type: "get_services" }));
const notifyAlexa = sv => Object.keys(sv?.notify || {}).filter(k => k === "alexa_media" || k.startsWith("alexa_media_"));
function mancaServizio() {
  const sv = servizi(); if (!sv) return "";
  if (notifyAlexa(sv).length) return "";
  return `<div class="ax1no">⚠️ ${t("Non trovo il servizio notify.alexa_media: in Home Assistant controlla che Alexa Media Player sia caricato (Impostazioni → Dispositivi e servizi) e, se serve, ricaricalo.", "I can't find the notify.alexa_media service: in Home Assistant check that Alexa Media Player is loaded (Settings → Devices & services) and reload it if needed.")}</div>`;
}
/** manda il messaggio; vero se è partito. a = "tutti" o l'elenco, come ricordarlo negli ultimi mandati */
async function manda(testo, chi, k, a = chi) {
  testo = String(testo || "").trim(); if (!testo) return false;
  chi = chi.filter(id => S[id]);
  if (!chi.length) { toast(t("Scegli a chi mandarlo", "Choose who to send it to"), true); return false; }
  uncache("axsvc"); let sv;
  try { sv = await ws({ type: "get_services" }); } catch { sv = servizi(); }
  const n = sv?.notify || {}, data = { type: k === "tts" ? "tts" : "announce" };
  let mancano = [];
  try {
    if (n.alexa_media) await svc("notify", "alexa_media", { message: testo, target: chi, data });
    else {
      const per = chi.map(id => [id, "alexa_media_" + id.split(".")[1]]), si = per.filter(([, s]) => n[s]);
      if (!si.length) { toast(t("Manca il servizio notify.alexa_media: controlla Alexa Media Player in Home Assistant.", "The notify.alexa_media service is missing: check Alexa Media Player in Home Assistant."), true); return false; }
      await Promise.all(si.map(([, s]) => svc("notify", s, { message: testo, data })));
      mancano = per.filter(([, s]) => !n[s]).map(([id]) => id);
    }
  } catch { return false; }
  ricorda(testo, a, data.type);
  if (mancano.length) toast(t("Non arriva a: ", "Not delivered to: ") + mancano.map(nome).join(", "), true);
  else toast((data.type === "tts" ? "🗣️ " : "📢 ") + t("Mandato a ", "Sent to ") + (a === "tutti" ? t("tutti", "everyone") : chi.length > 2 ? chi.length + " Echo" : chi.map(nome).join(", ")));
  return true;
}
/* ---------- ultimi mandati (su questo dispositivo) ---------- */
const recenti = () => { try { const L = JSON.parse(sGet("alexa_rec") || "[]"); return Array.isArray(L) ? L.filter(r => r && typeof r.x === "string") : []; } catch { return []; } };
function ricorda(x, a, k) {
  const chiave = r => r.x + "|" + JSON.stringify(r.a) + "|" + r.k;
  const nuovo = { x, a, k, t: Date.now() }, L = [nuovo, ...recenti().filter(r => chiave(r) !== chiave(nuovo))].slice(0, 10);
  sSet("alexa_rec", JSON.stringify(L)); render();
}
const aChi = a => a === "tutti" ? t("Tutti", "Everyone") : (Array.isArray(a) ? a : []).filter(id => S[id]).map(nome).join(", ") || "—";
function recentiHtml() {
  const L = recenti(); if (!L.length) return "";
  return `<div class="fl1">🕘 ${t("Ultimi mandati", "Recently sent")}</div><div class="ax1rc">${L.map((r, i) => `<button class="ax1rr" data-act="axRimanda" data-i="${i}" title="${esc(t("Rimanda", "Send again"))}">
    <span class="ic">${r.k === "tts" ? "🗣️" : "📢"}</span><span class="tx"><b>${esc(r.x)}</b><small>${esc(aChi(r.a))} · ${esc(hhmm(r.t))}</small></span><span class="rp" aria-hidden="true">↻</span></button>`).join("")}</div>`;
}
/** la scheda del messaggio: pg (pagina), hm (Home), cd (Colpo d'occhio) */
function messaggio(dove = "pg") {
  if (!destinatari().length) return dove === "pg" ? card(`💬 ${t("Manda un messaggio", "Send a message")}`, `<div class="empty">${t("Nessun Echo raggiungibile adesso.", "No Echo reachable right now.")}</div>`, { cls: "span2" }) : "";
  const pg = dove === "pg", mod = pg && UI.edit && isAdmin();
  return card(`💬 ${t("Manda un messaggio", "Send a message")}`, `<div class="ax1msg">${mancaServizio()}${chips()}${casella()}
    <div class="ax1op">${tipoSeg()}${pg ? `<small class="muted">${tipoOra() === "tts" ? t("Solo la voce, senza il suono di avviso.", "Just the voice, no chime.") : t("Con il suono di avviso prima.", "With a chime first.")}</small>` : ""}</div>
    ${pg ? `<div class="fl1">⚡ ${t("Frasi pronte", "Quick phrases")}${mod ? ` <button class="btn sm" data-act="axFrasi">✏️ ${t("Cambia", "Change")}</button>` : ""}</div><div class="ax1fz">${frasi().map((f, i) => `<button data-act="axFrase" data-i="${i}">${esc(f)}</button>`).join("") || `<small class="muted">${t("Nessuna.", "None.")}</small>`}</div>${recentiHtml()}` : ""}</div>`,
    pg ? { cls: "span2 ax1mc" } : { cls: "ax1mc " + dove, link: [t("Alexa", "Alexa"), "alexa"] });
}

/* ================= comandi per tutti ================= */
function tuttiCard() {
  const L = griglia().filter(id => ok(id) && ha(id, F.VOL)); if (!L.length) return "";
  const V0 = L.map(volume).filter(v => v != null), med = V0.length ? Math.round(V0.reduce((a, b) => a + b, 0) / V0.length) : 50;
  const tuttiMuti = L.filter(id => ha(id, F.MUTE)).every(muto), P = [...L, ...gruppi()].filter(suona);
  return card(`🎚️ ${t("Comandi per tutti", "Controls for all")}`, `<div class="fl1" style="margin-top:0">${t("Volume uguale per tutti", "Same volume for all")}</div>
    <div class="ax1v tt" style="--axc:var(--blue)"><input type="range" min="0" max="100" value="${med}" style="--p:${med}%" data-axv data-chg="axVolTutti" aria-label="${t("Volume di tutti", "Volume of all")}"><output>${med}%</output></div>
    <div class="ax1tb"><button class="btn ${P.length ? "warm" : ""}" data-act="axFerma" ${P.length ? "" : "disabled"}>⏹ ${t("Ferma tutto", "Stop everything")}</button>
      ${L.some(id => ha(id, F.MUTE)) ? `<button class="btn" data-act="axMutoTutti" data-v="${tuttiMuti ? 0 : 1}">${tuttiMuti ? "🔈 " + t("Togli il muto", "Unmute all") : "🔇 " + t("Muto per tutti", "Mute all")}</button>` : ""}</div>
    <p class="small muted" style="margin-top:8px">${P.length ? t(`Suona su ${P.length}: ${P.map(nome).join(", ")}.`, `Playing on ${P.length}: ${P.map(nome).join(", ")}.`) : t("Niente sta suonando.", "Nothing is playing.")}</p>`, { cls: "ax1tc" });
}
/* ================= chiedi ad Alexa ================= */
const chiedibili = () => griglia().filter(id => ok(id) && ha(id, F.PLAY_MEDIA));
const doveChiedi = () => { const v = sGet("alexa_chiedi"), C = chiedibili(); return C.includes(v) ? v : (!tutti() && C.find(id => scelta().includes(id))) || C[0]; };
function chiediCard() {
  const C = chiedibili(); if (!C.length) return "";
  return card(`✨ ${t("Chiedi ad Alexa", "Ask Alexa")}`, `<p class="small muted" style="margin:-4px 0 10px">${t("Scrivi quello che diresti ad Alexa: lo fa l'Echo che scegli, come se glielo dicessi a voce.", "Write what you'd say to Alexa: the Echo you pick does it, as if you said it out loud.")}</p>
    ${C.length > 1 ? `<select class="ax1sel" data-chg="axDoveChiedi" aria-label="${t("Quale Echo", "Which Echo")}">${C.map(id => `<option value="${esc(id)}" ${doveChiedi() === id ? "selected" : ""}>${esc(nome(id))}</option>`).join("")}</select>` : ""}
    <div class="ax1in"><input class="ax1k" type="text" maxlength="300" enterkeyhint="go" autocomplete="off" placeholder="${esc(t("che tempo fa domani", "what's the weather tomorrow"))}" aria-label="${t("Cosa chiedere", "What to ask")}">
      <button class="btn pri" data-act="axChiedi">▶<span> ${t("Chiedi", "Ask")}</span></button></div>`, { cls: "ax1kc" });
}

/* ================= ✏️ Modifica ================= */
function impostazioniCard() {
  if (!inModifica()) return "";
  return card(`⚙️ ${t("Alexa: scelte della casa", "Alexa: home settings")}`, `<div class="ax1set">
    <div class="ax1sr"><span>${t("Tipo predefinito dei messaggi", "Default message type")}<small>${t("Quello già scelto quando si apre la casella.", "The one already picked when the box opens.")}</small></span>
      <div class="seg">${[["announce", "📢 " + t("Annuncio", "Announce")], ["tts", "🗣️ " + t("Parla", "Speak")]].map(([k, n]) => `<button class="${tipoDef() === k ? "act" : ""}" data-act="axTipoDef" data-v="${k}">${n}</button>`).join("")}</div></div>
    <div class="ax1sr"><span>${t("Echo nel salvaschermo «Casa»", "Echo on the «Home» screensaver")}<small>${t("Un pannello con gli Echo, che si accendono quando parli ad Alexa.", "A panel with the Echo devices, lighting up when you talk to Alexa.")}</small></span>
      <button class="sw ${AX().ss !== false ? "on" : ""}" data-act="axSS" aria-label="${t("Echo nel salvaschermo", "Echo on the screensaver")}"><i></i></button></div>
    <div class="ax1sr"><span>${t("Frasi pronte", "Quick phrases")}<small>${t(`${frasi().length} frasi`, `${frasi().length} phrases`)}</small></span><button class="btn sm" data-act="axFrasi">✏️ ${t("Cambia", "Change")}</button></div></div>`, { cls: "ax1sc" });
}
function schedaEcho(id) {
  const c = colore(id), scelto = AX().colori?.[id];
  return `<div class="sh-head"><div><h3>✏️ ${esc(nome(id))}</h3><div class="small muted mono">${esc(id)}${modello(id) ? " · " + esc(modello(id)) : ""}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="ax1sh" style="--axc:${rgb(c)}"><span class="ax1d">${disegno(id)}</span></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="ax1nm" type="text" value="${esc(LAYOUT.names?.[id] || "")}" placeholder="${esc(nomeAuto(id))}"></label>
    <div class="fl1">${t("Colore", "Colour")}</div>
    <div class="ax1pal">${["", ...TAVOLOZZA].map(h => `<button class="${(scelto || "") === h ? "on" : ""}" style="--c:${rgb(h || c)}" data-act="axColore" data-id="${esc(id)}" data-v="${h}" aria-label="${h || t("Automatico", "Automatic")}">${h ? "" : "✨"}</button>`).join("")}</div>
    <div class="ax1sr" style="margin-top:12px"><span>${tipo(id) === "gruppo" ? t("Mostra tra i gruppi", "Show among groups") : t("Mostra nella griglia", "Show in the grid")}<small>${AX().mostra?.[id] == null ? t("Adesso: scelto da solo", "Now: picked automatically") : t("Scelto da te", "Picked by you")}</small></span>
      <button class="sw ${mostrato(id) ? "on" : ""}" data-act="axMostra" data-id="${esc(id)}" data-v="${mostrato(id) ? 0 : 1}" aria-label="${t("Mostra", "Show")}"><i></i></button></div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="axNome" data-id="${esc(id)}">💾 ${t("Salva il nome", "Save name")}</button>
      ${AX().mostra?.[id] != null ? `<button class="btn" data-act="axMostra" data-id="${esc(id)}" data-v="">✨ ${t("Torna automatico", "Back to automatic")}</button>` : ""}</div>
    <p class="small muted" style="margin-top:12px">${t("Il nome cambia solo nella plancia, non in Alexa né in Home Assistant.", "The name changes only in the dashboard, not in Alexa or Home Assistant.")}</p>`;
}
function schedaFrasi() {
  const L = frasi();
  return `<div class="sh-head"><div><h3>⚡ ${t("Frasi pronte", "Quick phrases")}</h3><div class="small muted">${t("Un tocco e partono, agli Echo scelti. Valgono per tutta la casa.", "One tap and they go to the chosen Echo devices. They apply to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="stack">${L.map((f, i) => `<div class="li"><span class="ic">💬</span><div class="tx"><b>${esc(f)}</b></div><button class="btn sm" data-act="axFrDel" data-i="${i}" aria-label="${t("Togli", "Remove")}">✕</button></div>`).join("") || `<div class="small muted">${t("Nessuna frase.", "No phrases.")}</div>`}</div>
    <div class="ax1in" style="margin-top:12px"><input id="ax1fn" type="text" maxlength="200" placeholder="${esc(t("Nuova frase…", "New phrase…"))}"><button class="btn pri" data-act="axFrAdd">＋ ${t("Aggiungi", "Add")}</button></div>
    ${Array.isArray(AX().frasi) ? `<button class="btn sm" data-act="axFrReset" style="margin-top:10px">↺ ${t("Torna a quelle di partenza", "Back to the default ones")}</button>` : ""}`;
}
const salvaAX = (fn, msg) => cambia(l => { l.alexa = JSON.parse(JSON.stringify(l.alexa || {})); fn(l.alexa); }, msg);

/* ================= azioni ================= */
const contenitore = el => el.closest(".ax1msg") || document;
Object.assign(ACT, {
  axChi: el => {
    const id = el.dataset.id; let s = scelta();
    if (!id) s = "tutti";
    else { s = s === "tutti" ? [id] : s.includes(id) ? s.filter(x => x !== id) : [...s, id]; if (!s.length) s = "tutti"; }
    sSet("alexa_a", JSON.stringify(s)); render(true);
  },
  axTipo: el => { TIPO = el.dataset.v; render(true); },
  axInvia: async el => {
    const box = contenitore(el), q = box.querySelector(".ax1q"); if (!q) return;
    if (!q.value.trim()) { q.focus(); return; }
    el.disabled = true;
    try { if (await manda(q.value, scelti(), tipoOra(), tutti() ? "tutti" : scelti())) q.value = ""; } finally { el.disabled = false; }
  },
  axFrase: el => { const f = frasi()[+el.dataset.i]; if (f) manda(f, scelti(), tipoOra(), tutti() ? "tutti" : scelti()); },
  axRimanda: el => { const r = recenti()[+el.dataset.i]; if (!r) return; manda(r.x, r.a === "tutti" ? griglia().filter(ok) : (r.a || []).filter(id => S[id] && ok(id)), r.k, r.a === "tutti" ? "tutti" : (r.a || [])); },
  axMuto: el => { const id = el.dataset.id; svc("media_player", "volume_mute", { is_volume_muted: !muto(id) }, { entity_id: id }).catch(() => {}); },
  axMutoTutti: el => { const L = griglia().filter(id => ok(id) && ha(id, F.MUTE)); if (L.length) svc("media_player", "volume_mute", { is_volume_muted: el.dataset.v === "1" }, { entity_id: L }).catch(() => {}); },
  axFerma: () => {
    const P = [...griglia(), ...gruppi()].filter(suona); if (!P.length) return toast(t("Niente sta suonando", "Nothing is playing"));
    const pausa = P.filter(id => ha(id, F.PAUSE)), stop = P.filter(id => !ha(id, F.PAUSE) && ha(id, F.STOP));
    Promise.all([pausa.length && svc("media_player", "media_pause", {}, { entity_id: pausa }), stop.length && svc("media_player", "media_stop", {}, { entity_id: stop })])
      .then(() => toast("⏹ " + t("Fermato: ", "Stopped: ") + P.map(nome).join(", "))).catch(() => {});
  },
  axChiedi: async el => {
    const box = el.closest(".card") || document, q = box.querySelector(".ax1k"), id = doveChiedi(); if (!q || !id) return;
    const x = q.value.trim(); if (!x) { q.focus(); return; }
    try { await svc("media_player", "play_media", { media_content_id: x, media_content_type: "custom" }, { entity_id: id }); q.value = ""; toast("✨ " + x + " · " + nome(id)); } catch {}
  },
  axAltri: () => { V.altri = true; render(true); },
  axEd: el => { const id = el.dataset.id; openSheet(() => schedaEcho(id)); },
  axMostra: el => { const id = el.dataset.id, v = el.dataset.v;
    salvaAX(a => { a.mostra = { ...(a.mostra || {}) }; if (v === "") delete a.mostra[id]; else a.mostra[id] = v === "1"; },
      v === "1" ? "👁️ " + nome(id) : v === "0" ? "🙈 " + nome(id) : "✨ " + nome(id)); },
  axColore: el => { const id = el.dataset.id, v = el.dataset.v; salvaAX(a => { a.colori = { ...(a.colori || {}) }; if (v) a.colori[id] = v; else delete a.colori[id]; }); },
  axNome: el => { const id = el.dataset.id, n = (document.getElementById("ax1nm")?.value || "").trim();
    cambia(l => { l.names = { ...(l.names || {}) }; if (n && n !== nomeAuto(id)) l.names[id] = n; else delete l.names[id]; }, "💾 " + (n || nomeAuto(id))); closeSheet(); },
  axTipoDef: el => { TIPO = null; salvaAX(a => { if (el.dataset.v === "tts") a.tipo = "tts"; else delete a.tipo; }); },
  axSS: () => salvaAX(a => { if (a.ss === false) delete a.ss; else a.ss = false; }),
  axFrasi: () => openSheet(schedaFrasi),
  axFrDel: el => { const i = +el.dataset.i, L = frasi().slice(); L.splice(i, 1); salvaAX(a => { a.frasi = L; }); },
  axFrAdd: () => { const i = document.getElementById("ax1fn"), v = (i?.value || "").trim(); if (!v) { i?.focus(); return; }
    const L = [...frasi(), v].slice(0, 20); salvaAX(a => { a.frasi = L; }, "＋ " + v); if (i) i.value = ""; },
  axFrReset: () => salvaAX(a => { delete a.frasi; }, "↺ " + t("Frasi di partenza", "Default phrases")),
});
CHG.axVol = el => svc("media_player", "volume_set", { volume_level: +el.value / 100 }, { entity_id: el.dataset.id }).catch(() => {});
CHG.axVolTutti = el => { const L = griglia().filter(id => ok(id) && ha(id, F.VOL)); if (L.length) svc("media_player", "volume_set", { volume_level: +el.value / 100 }, { entity_id: L }).then(() => toast("🎚️ " + el.value + "% · " + t("tutti", "all"))).catch(() => {}); };
CHG.axDoveChiedi = el => { sSet("alexa_chiedi", el.value); render(true); };
/* Invio manda il messaggio (o la domanda) della sua casella */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.isComposing) return;
  const el = e.target; if (!el.matches?.(".ax1q,.ax1k,#ax1fn")) return;
  e.preventDefault();
  const b = el.id === "ax1fn" ? document.querySelector('[data-act="axFrAdd"]') : el.parentNode.querySelector(el.matches(".ax1q") ? '[data-act="axInvia"]' : '[data-act="axChiedi"]');
  b?.click();
});
TRASCINA.alexa = { nome, salva: ({ ids }) => salvaOrdine("alexa", griglia(), ids) };

/* ================= pagina ================= */
function pagina() {
  controlla();
  const dx = tuttiCard() + chiediCard();
  return `<div class="g g3 ax1pg">${grigliaCard()}${messaggio("pg")}${dx ? `<div class="ax1col">${dx}</div>` : ""}${gruppiCard()}${altriCard()}${impostazioniCard()}</div>`;
}

/* ================= altrove ================= */
/* Home: «Manda un messaggio» (casella + chip + invia), da mettere o togliere come le altre; nel Colpo d'occhio è il blocco «Messaggio ad Alexa» */
HOME_EXTRA.alexa = { title: () => t("Messaggio ad Alexa", "Message to Alexa"), render: () => { controlla(); return messaggio("hm"); }, show: () => pagAttiva() && destinatari().length > 0 };
/* Colpo d'occhio: il messaggio c'è già come scheda della Home («Messaggio ad Alexa» tra i blocchi); qui una tessera del volume per ogni Echo */
function tesseraVolume(id, dim) {
  controlla();
  if (!S[id]) return "";
  return `<section class="card ax1cv d-${dim} s-${statoDisegno(id)}" style="--axc:${rgb(colore(id))}"><div class="ax1cvh"><span class="ax1d" data-axl="${esc(id)}">${disegno(id, dim === "s")}</span>
    <div class="tx"><b>${esc(nome(id))}</b><span>${esc(fraseDetta(id) ? "«" + fraseDetta(id) + "»" : statoTesto(id))}</span></div></div>${barra(id, dim === "s")}</section>`;
}
let colpoG = -1;
HOOKS.push(() => {
  if (colpoG === VERS.gen) return; colpoG = VERS.gen;
  for (const k of Object.keys(COLPO)) if (k.startsWith("alexaVol:")) delete COLPO[k];
  for (const id of echi()) if (CASSE.includes(tipo(id)) || tipo(id) === "gruppo" || AX().mostra?.[id])
    COLPO["alexaVol:" + id] = { title: () => t("Volume · ", "Volume · ") + nome(id), icon: "🔊", pagina: "alexa", show: () => pagAttiva() && !!S[id], render: dim => tesseraVolume(id, dim) };
});
/* salvaschermo «Casa»: un pannello con gli Echo (al massimo 4), che si accendono quando parli ad Alexa */
VISTE.alexaSS = () => {
  if (!pagAttiva() || AX().ss === false) return "";
  const G = griglia().slice(0, 4); if (!G.length) return "";
  controlla();
  return `<div class="ax1ss">${G.map(id => `<div class="s-${statoDisegno(id)}" style="--axc:${rgb(colore(id))}"><span class="ax1sd" data-axl="${esc(id)}">${disegno(id, true)}</span><b>${esc(nome(id))}</b><small>${esc(statoTesto(id))}</small></div>`).join("")}</div>`;
};
/** per la Musica: c'è la pagina Alexa (per il collegamento dalla scheda di un Echo) */
VISTE.alexaPagina = () => { try { return !!PAGES.alexa?.show() && pagAttiva(); } catch { return false; } };

/* cosa serve per avere questa pagina («✨ Cosa puoi aggiungere», aggiungi.js) */
const RICHIEDE = {
  cosa: t("I tuoi Echo disegnati, con il volume a colori per ognuno, i messaggi e gli annunci da mandare a uno o a tutti, e l'Echo che si accende quando parli ad Alexa.", "Your Echo devices drawn, with a coloured volume for each, messages and announcements to one or all, and the Echo lighting up when you talk to Alexa."),
  serve: t("Alexa Media Player, gratuita, dal Marketplace (in HACS fino alla 2026.10), con il tuo account Amazon.", "Alexa Media Player, free, from the Marketplace (in HACS up to 2026.10), with your Amazon account."),
  passi: [t("Impostazioni → Marketplace: cerca «Alexa Media Player», scaricalo e riavvia Home Assistant (fino alla 2026.10: in HACS).", "Settings → Marketplace: search «Alexa Media Player», download it and restart Home Assistant (up to 2026.10: in HACS)."),
    t("Impostazioni → Dispositivi e servizi → ＋ Aggiungi integrazione → «Alexa Media Player»: accedi con il tuo account Amazon.", "Settings → Devices & services → ＋ Add integration → «Alexa Media Player»: sign in with your Amazon account.")],
  link: [[t("Alexa Media Player in HACS", "Alexa Media Player in HACS"), linkHacs("alandtse", "alexa_media_player")], [t("Aggiungi un'integrazione", "Add an integration"), myHA("integrations")]],
  anteprima: [["🗣️", "Echo Show 8 · " + t("Cucina", "Kitchen"), t("Inattivo", "Idle"), "40%", 40], ["🔵", "Echo Dot · " + t("Camera", "Bedroom"), t("In riproduzione", "Playing"), "25%", 25]] };
page("alexa", { richiede: RICHIEDE, title: "Alexa", short: "Alexa", icon: "🗣️", order: 34, editable: true,
  show: () => echi().length > 0, badge: () => griglia().some(ascolta), render: pagina });

/* Chat di famiglia: messaggi tra le persone di casa, cioè gli utenti di Home Assistant collegati a una persona.
   Conversazioni: «Famiglia» (tutti) e una a due con ogni persona. I messaggi stanno solo in Home Assistant (chat.py):
   è il server a decidere chi vede cosa, qui si disegna e basta. Un avviso in tempo reale aggiorna gli altri dispositivi;
   chi non ha la plancia aperta riceve una notifica sul telefono (app di Home Assistant), che riapre la plancia qui.
   Si condividono in un tocco: la propria posizione, una foto da una telecamera di casa, una voce della lista della spesa.
   In Home: l'indicatore dei non letti in alto e la scheda «Chat» con l'ultimo messaggio (HOME_EXTRA). */
import { S, ACT, CHG, UI, HOME_EXTRA, STRIP, t, LOC, esc, nm, attr, ok, allEnts, ents, card, page, toast, openSheet, closeSheet, render, go,
  sicuro, ws, conn, ready, km, fnum, hhmm, ago } from "../core.js";
import { telecamere as camPlancia, flussi, fotoCam } from "../video.js";

const FAM = "famiglia";
const EMOJI = ["👍", "❤️", "😂", "😮", "🙏", "🎉", "🏠", "🍝", "⏰", "👌"];
const SPUNTI = () => [t("Arrivo tra 10 minuti", "Be there in 10 minutes"), t("Serve qualcosa?", "Need anything?"), t("A che ora torni?", "What time are you back?"), t("A tavola! 🍝", "Dinner's ready! 🍝")];
const PRIMA = 60;
let MAX_TESTO = 1000;

/* ---------- stato ---------- */
/* conv[id] = { id, n, ultimo, non_letti, letti: {uid: n}, msg: null | [...], altri, attesa: [...] } */
const C = { stato: "caricando", err: "", io: null, membro: false, membri: [], conv: {}, notifiche: true, telefoni: [], aperta: null, bozze: {}, sel: null };
const conv = id => C.conv[id] || (C.conv[id] = { id, n: 0, ultimo: null, non_letti: 0, letti: {}, msg: null, altri: false, attesa: [] });
const diretta = uid => "d:" + [C.io, uid].sort().join("+");
const altroDi = id => id.startsWith("d:") ? id.slice(2).split("+").find(u => u !== C.io) || null : null;
const membro = uid => C.membri.find(m => m.uid === uid) || null;
/** chi partecipa (me compreso) */
const partecipanti = id => id === FAM ? C.membri.map(m => m.uid) : id.slice(2).split("+");

async function carica() {
  try {
    const r = await ws({ type: "nduja_dashboard/chat_get" });
    Object.assign(C, { stato: "ok", err: "", io: r.io, membro: r.membro, membri: r.membri || [], notifiche: r.notifiche !== false, telefoni: r.telefoni || [] });
    MAX_TESTO = r.limiti?.testo || MAX_TESTO;
    for (const x of r.conv || []) { const c = conv(x.id); Object.assign(c, { n: x.n, ultimo: x.ultimo, non_letti: x.non_letti, letti: x.letti || {} }); if (c.msg) caricaMsg(x.id, true); }
  } catch (e) {
    console.warn("nduja chat", e);
    if (C.stato !== "ok") { C.stato = "errore"; C.err = e?.code || e?.message || String(e); }
  }
  render();
}
/** i messaggi di una conversazione (gli ultimi PRIMA); «di nuovo» li rilegge tutti, «precedenti» aggiunge quelli più vecchi */
async function caricaMsg(id, diNuovo, precedenti) {
  const c = conv(id); if (c.caricando) return; c.caricando = true;
  try {
    const r = await ws({ type: "nduja_dashboard/chat_msg", conv: id, limite: PRIMA, ...(precedenti && c.msg?.length ? { prima: c.msg[0].n } : {}) });
    if (precedenti) { c.msg = [...r.msg, ...(c.msg || [])]; c.altri = r.altri; }
    else { const vecchi = diNuovo && c.msg ? c.msg.filter(m => m.n < (r.msg[0]?.n ?? 0)) : []; c.msg = [...vecchi, ...r.msg]; if (!vecchi.length) c.altri = r.altri; SC.giu = SC.giu || !diNuovo; }
    c.n = Math.max(c.n, r.n); c.letti = r.letti || c.letti;
  } catch (e) { console.warn("nduja chat msg", e); if (!c.msg) c.msg = []; }
  c.caricando = false; render();
}

/* ---------- persone ---------- */
/** un colore per persona (per le iniziali e il nome nelle bolle), ben distanti tra loro */
const tinta = uid => Math.round([...String(uid)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) * 137.508) % 360;
const nomeDi = uid => { const m = membro(uid); return m ? (S[m.persona] ? nm(m.persona) : m.nome) : t("Qualcuno", "Someone"); };
const fotoDi = uid => { const p = membro(uid)?.persona; return p && S[p] ? attr(p, "entity_picture") : null; };
function avatar(uid, cls = "") {
  const f = fotoDi(uid), n = nomeDi(uid);
  return `<span class="kta1 ${cls}" style="${f ? `background-image:url('${esc(f)}')` : `--h:${tinta(uid)}`}" aria-hidden="true">${f ? "" : esc((n[0] || "?").toUpperCase())}</span>`;
}
/* la famiglia: una casetta con un cuore, disegnata per la plancia */
const casetta = (cls = "") => `<span class="kta1 fam ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="tt" d="M3.5 11.2 12 4l8.5 7.2"/><path class="mu" d="M5.8 10v9.2h12.4V10"/><path class="cu" d="M12 17.4s-3.1-1.9-3.1-3.9c0-1 .8-1.8 1.7-1.8.6 0 1.1.3 1.4.8.3-.5.8-.8 1.4-.8.9 0 1.7.8 1.7 1.8 0 2-3.1 3.9-3.1 3.9z"/></svg></span>`;
const titolo = id => id === FAM ? t("Famiglia", "Family") : nomeDi(altroDi(id));
const faccia = (id, cls) => id === FAM ? casetta(cls) : avatar(altroDi(id), cls);
const elenco = L => L.length <= 1 ? L.join("") : L.slice(0, -1).join(", ") + t(" e ", " and ") + L[L.length - 1];
function sottotitolo(id) {
  if (id === FAM) return esc(elenco(C.membri.filter(m => m.uid !== C.io).map(m => nomeDi(m.uid)).concat(t("tu", "you"))));
  const p = membro(altroDi(id))?.persona; if (!p || !S[p] || !ok(p)) return "";
  const z = S[p].state;
  return (z === "home" ? "🏠 " + t("a casa", "at home") : z === "not_home" ? "📍 " + t("fuori casa", "away") : "📍 " + esc(S["zone." + z]?.attributes.friendly_name || z)) + " · " + esc(ago(S[p].last_changed).replace(t(" fa", " ago"), ""));
}

/* ---------- elenchi e conteggi ---------- */
function conversazioni() {
  if (!C.membro) return [];
  const L = [FAM, ...C.membri.filter(m => m.uid !== C.io).map(m => diretta(m.uid))];
  for (const id of Object.keys(C.conv)) if (!L.includes(id) && C.conv[id].ultimo) L.push(id);   // con chi non è più in famiglia: resta da leggere
  const q = id => C.conv[id]?.ultimo?.quando || "";
  return L.sort((a, b) => q(b).localeCompare(q(a)) || (a === FAM ? -1 : b === FAM ? 1 : titolo(a).localeCompare(titolo(b), LOC)));
}
const nonLetti = () => Object.values(C.conv).reduce((s, c) => s + (c.non_letti || 0), 0);
const largo = () => matchMedia("(min-width:861px)").matches;
/** la conversazione sullo schermo: quella aperta; su schermi larghi, se non ce n'è una, la prima */
const vista = () => C.aperta || (largo() ? conversazioni()[0] || null : null);

/* ---------- anteprima di un messaggio ---------- */
function anteprima(m) {
  if (!m) return "";
  if (m.tipo === "cancellato") return "🚫 " + t("Messaggio cancellato", "Message deleted");
  if (m.tipo === "pos") return "📍 " + t("Posizione", "Location") + (m.dati?.zona ? " · " + zonaNome(m.dati.zona) : "");
  if (m.tipo === "foto") return "📷 " + t("Foto", "Photo") + (m.dati?.cam ? " · " + m.dati.cam : "");
  if (m.tipo === "spesa") return "🛒 " + (m.dati?.voce || "");
  return String(m.testo || "").replace(/\s+/g, " ");
}
const zonaNome = z => z === "home" ? t("A casa", "At home") : z === "not_home" ? t("Fuori casa", "Away") : z;
function chiScrive(id, m) {
  if (!m || m.tipo === "cancellato") return "";
  if (m.da === C.io) return t("Tu: ", "You: ");
  return id === FAM ? nomeDi(m.da) + ": " : "";
}

/* ---------- date ---------- */
const giorno = iso => { const d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
function giornoTesto(iso) {
  const g = Math.round((giorno(new Date().toISOString()) - giorno(iso)) / 864e5);
  if (g === 0) return t("Oggi", "Today");
  if (g === 1) return t("Ieri", "Yesterday");
  const d = new Date(iso);
  return d.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}
function quandoBreve(iso) {
  if (!iso) return "";
  const g = Math.round((giorno(new Date().toISOString()) - giorno(iso)) / 864e5);
  if (g === 0) return hhmm(iso);
  if (g === 1) return t("ieri", "yesterday");
  if (g < 7) return new Date(iso).toLocaleDateString(LOC, { weekday: "short" });
  return new Date(iso).toLocaleDateString(LOC, { day: "numeric", month: "short" });
}

/* ---------- contenuto dei messaggi ---------- */
const EMO = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;
const soloEmoji = s => { const x = String(s || "").trim(); return !!x && x.length <= 16 && EMO.test(x) && !/^[\d#*\s]+$/.test(x); };
/** testo con i link cliccabili (solo http e https) */
const linkato = s => esc(s).replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);

/* foto della chat: l'indirizzo va firmato (auth/sign_path), così la vede solo chi fa parte della conversazione */
const FOTO = {};
function fotoUrl(id, f) {
  const k = id + "/" + f, x = FOTO[k];
  if (x && (x.url || x.carica) && Date.now() - x.t < 50 * 60000) return x.url || null;
  FOTO[k] = { t: Date.now(), carica: true, url: x?.url };
  ws({ type: "auth/sign_path", path: `/api/nduja_dashboard/chat_foto/${id}/${f}`, expires: 3600 })
    .then(r => { FOTO[k] = { t: Date.now(), url: r.path }; render(); })
    .catch(() => { FOTO[k] = { t: Date.now() - 49 * 60000, url: null }; });
  return x?.url || null;
}
/* posizione: la casa al centro e il segnaposto nella sua direzione, più lontano quanto più è lontano (disegno della plancia) */
function posizione(d) {
  const hl = attr("zone.home", "latitude"), ho = attr("zone.home", "longitude"), dist = km(d.lat, d.lon, hl, ho);
  const casa = d.zona === "home" || (dist != null && dist < 0.15);
  let x = 32, y = 32;
  if (dist != null && !casa) {
    const r = v => v * Math.PI / 180, dl = r(d.lon - ho);
    const b = Math.atan2(Math.sin(dl) * Math.cos(r(d.lat)), Math.cos(r(hl)) * Math.sin(r(d.lat)) - Math.sin(r(hl)) * Math.cos(r(d.lat)) * Math.cos(dl));
    const rr = 9 + Math.min(17, Math.log10(1 + dist) * 9);
    x = 32 + rr * Math.sin(b); y = 32 - rr * Math.cos(b);
  }
  const quanto = dist == null ? "" : casa ? t("a casa", "at home") : (dist < 1 ? Math.round(dist * 1000) + " m" : fnum(dist, dist < 10 ? 1 : 0) + " km") + t(" da casa", " from home");
  const apple = /iPhone|iPad|Macintosh/.test(navigator.userAgent), android = /Android/.test(navigator.userAgent);
  const mappa = apple ? `maps://?ll=${d.lat},${d.lon}&q=${d.lat},${d.lon}` : android ? `geo:${d.lat},${d.lon}?q=${d.lat},${d.lon}` : "";
  return `<div class="ktp1" title="${fnum(d.lat, 5)}, ${fnum(d.lon, 5)}"><svg class="ktp1m" viewBox="0 0 64 64" aria-hidden="true"><circle class="a1" cx="32" cy="32" r="26"/><circle class="a2" cx="32" cy="32" r="16"/>
      ${casa ? "" : `<path class="vi" d="M32 32L${x.toFixed(1)} ${y.toFixed(1)}"/>`}<path class="ca" d="M26.5 33.5 32 28.5l5.5 5v5.5h-11z"/>
      <g class="pin" transform="translate(${x.toFixed(1)} ${(casa ? 25 : y).toFixed(1)})"><path d="M0 0c-3.2-3.6-4.8-6.1-4.8-8.3a4.8 4.8 0 0 1 9.6 0c0 2.2-1.6 4.7-4.8 8.3z"/><circle cx="0" cy="-8.4" r="1.8"/></g></svg>
    <div class="tx"><b>${esc(zonaNome(d.zona || "")) || t("Posizione", "Location")}</b><span>${esc(quanto)}${d.acc ? ` · ±${d.acc < 1000 ? Math.round(d.acc) + " m" : fnum(d.acc / 1000, 1) + " km"}` : ""}</span>
      ${mappa ? `<a href="${esc(mappa)}" class="ktp1a">🗺️ ${t("Apri nelle mappe", "Open in maps")}</a>` : ""}</div></div>`;
}
function contenuto(id, m) {
  const d = m.dati || {};
  if (m.tipo === "cancellato") return `<p class="ktx1 del">🚫 ${m.da === C.io ? t("Hai cancellato questo messaggio", "You deleted this message") : t("Messaggio cancellato", "Message deleted")}</p>`;
  if (m.tipo === "pos") return posizione(d);
  if (m.tipo === "foto") {
    if (d.persa || !d.f) return `<p class="ktx1 del">📷 ${t("Foto non più disponibile", "Photo no longer available")}${d.cam ? " · " + esc(d.cam) : ""}</p>`;
    const u = fotoUrl(id, d.f);
    return `<button class="ktf1" data-act="ktFoto" data-conv="${esc(id)}" data-f="${esc(d.f)}" aria-label="${t("Ingrandisci la foto", "Enlarge photo")}">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : `<i class="ktf1w"></i>`}<span>📷 ${esc(d.cam || "")}</span></button>`;
  }
  if (m.tipo === "spesa") return `<div class="kts1"><span class="ic">🛒</span><div class="tx"><b>${esc(d.voce)}</b><span>${d.lista && !/spesa|shopping|grocer/i.test(d.lista) ? t("dalla lista «", "from the list «") + esc(d.lista) + "»" : t("dalla lista della spesa", "from the shopping list")}</span></div></div>`;
  return `<p class="ktx1">${linkato(m.testo)}</p>`;
}

/* ---------- disegno della conversazione ---------- */
const SC = { giu: true, fondo: true, alto: null };    // scorrimento: andare in fondo, eravamo in fondo, altezza prima di caricare i precedenti
const arrivati = {};                                    // messaggi appena arrivati (per l'animazione)
/** chi ha letto un mio messaggio */
const lettoDa = (id, n) => partecipanti(id).filter(u => u !== C.io && (conv(id).letti[u] || 0) >= n);
function spunte(id, m) {
  const altri = partecipanti(id).filter(u => u !== C.io), L = lettoDa(id, m.n), tutti = altri.length > 0 && L.length === altri.length;
  return `<i class="ktk1 ${tutti ? "on" : ""}" title="${tutti ? t("Letto", "Read") : t("Inviato", "Sent")}">${tutti ? "✓✓" : "✓"}</i>`;
}
function stato(id, m) {
  const altri = partecipanti(id).filter(u => u !== C.io), L = lettoDa(id, m.n);
  if (!L.length) return t("Inviato", "Sent");
  if (id !== FAM || L.length === altri.length) return id === FAM && altri.length > 1 ? t("Letto da tutti", "Read by everyone") : t("Letto", "Read");
  return t("Letto da ", "Read by ") + elenco(L.map(nomeDi));
}
function bolle(id) {
  const c = conv(id), M = c.msg || [], out = [];
  if (c.altri) out.push(`<button class="btn sm ktpr1" data-act="ktPrima" data-id="${esc(id)}">${c.caricando ? "…" : "↑ " + t("Messaggi precedenti", "Earlier messages")}</button>`);
  const ultimoMio = [...M].reverse().find(m => m.da === C.io && m.tipo !== "cancellato");
  M.forEach((m, i) => {
    const p = M[i - 1], s = M[i + 1], mio = m.da === C.io;
    if (!p || giorno(p.quando) !== giorno(m.quando)) out.push(`<div class="ktd1"><span>${esc(giornoTesto(m.quando))}</span></div>`);
    const vicino = (a, b) => a && b && a.da === b.da && giorno(a.quando) === giorno(b.quando) && Math.abs(new Date(b.quando) - new Date(a.quando)) < 5 * 60000;
    const primo = !vicino(p, m), ultimo = !vicino(m, s), emo = m.tipo === "testo" && soloEmoji(m.testo);
    const nw = Date.now() - (arrivati[id + ":" + m.n] || 0) < 1500, sel = C.sel === id + ":" + m.n;
    out.push(`<div class="ktm1 ${mio ? "me" : "lui"} ${primo ? "pr" : ""} ${ultimo ? "ul" : ""} ${nw ? "nw" : ""} ${sel ? "sel" : ""}" data-n="${m.n}"><div class="ktw1">
      ${!mio && id === FAM ? (ultimo ? avatar(m.da, "sm") : `<span class="kta1 sm vuoto"></span>`) : ""}
      <div class="ktb1 t-${m.tipo} ${emo ? "emo" : ""}" data-act="ktSel" data-id="${esc(id)}" data-n="${m.n}" role="button" tabindex="0">
        ${!mio && id === FAM && primo && m.tipo !== "cancellato" ? `<b class="ktn1" style="--h:${tinta(m.da)}">${esc(nomeDi(m.da))}</b>` : ""}
        ${emo ? `<p class="ktx1">${esc(m.testo)}</p>` : contenuto(id, m)}
        <span class="ktt1">${hhmm(m.quando)}${mio && m.tipo !== "cancellato" ? spunte(id, m) : ""}</span></div></div>
      ${sel ? `<div class="kto1">${m.tipo === "testo" ? `<button class="btn sm" data-act="ktCopia" data-id="${esc(id)}" data-n="${m.n}">📋 ${t("Copia", "Copy")}</button>` : ""}${mio && m.tipo !== "cancellato" ? `<button class="btn sm bad" data-act="ktDel" data-id="${esc(id)}" data-n="${m.n}">🗑 ${t("Cancella", "Delete")}</button>` : ""}</div>` : ""}
    </div>`);
    if (m === ultimoMio && i === M.length - 1) out.push(`<div class="kts2">${esc(stato(id, m))}</div>`);
  });
  for (const a of c.attesa) out.push(`<div class="ktm1 me pr ul att"><div class="ktw1"><div class="ktb1 t-${a.tipo}"><p class="ktx1">${a.tipo === "testo" ? linkato(a.testo) : esc(a.etichetta)}</p><span class="ktt1">🕓</span></div></div></div>`);
  return out.join("");
}
/* nessun messaggio: due fumetti e la casa (disegno della plancia) */
const disegnoVuoto = () => `<svg class="ktv1d" viewBox="0 0 96 72" aria-hidden="true"><path class="f1" d="M10 14a8 8 0 0 1 8-8h34a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H28l-9 8v-8h-1a8 8 0 0 1-8-8z"/>
  <path class="f2" d="M40 34a8 8 0 0 1 8-8h30a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-1v8l-9-8H48a8 8 0 0 1-8-8z"/><circle class="p" cx="24" cy="22" r="2.6"/><circle class="p" cx="35" cy="22" r="2.6"/><circle class="p" cx="46" cy="22" r="2.6"/>
  <path class="ca" d="M55 45.5 63 39l8 6.5M57.5 44v7.5h11V44"/></svg>`;
function vuota(id) {
  return `<div class="ktv1">${disegnoVuoto()}<b>${id === FAM ? t("Scrivi alla famiglia", "Write to the family") : t("Scrivi a ", "Write to ") + esc(titolo(id))}</b>
    <span>${id === FAM ? t("Lo leggono tutti, su ogni telefono e tablet di casa.", "Everyone reads it, on every phone and tablet at home.") : t("Lo leggete solo voi due.", "Only the two of you can read it.")}</span>
    <div class="ktsp1">${SPUNTI().map(s => `<button class="btn sm" data-act="ktSpunto" data-v="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
}
function conversazione(id) {
  const c = conv(id);
  if (!c.msg) caricaMsg(id);
  const corpo = !c.msg ? `<div class="ktv1"><span class="small muted">${t("Carico i messaggi…", "Loading messages…")}</span></div>` : c.msg.length || c.attesa.length ? bolle(id) : vuota(id);
  return `<section class="card ktc2" aria-label="${esc(titolo(id))}">
    <header class="kth1"><button class="ktbk1" data-act="ktIndietro" aria-label="${t("Indietro", "Back")}">‹</button>${faccia(id, "md")}
      <div class="tx"><b>${esc(titolo(id))}</b><span>${sottotitolo(id)}</span></div></header>
    <div class="ktsc1" id="ktsc1" role="log" aria-live="polite">${corpo}</div>
    <footer class="ktin1">
      <div class="kte1">${EMOJI.map(e => `<button data-act="ktEmo" data-v="${e}" aria-label="${e}">${e}</button>`).join("")}</div>
      <div class="ktr1"><button class="ktpl1" data-act="ktPiu" aria-label="${t("Condividi", "Share")}" title="${t("Posizione, foto, spesa", "Location, photo, shopping")}">＋</button>
        <textarea id="ktta1" rows="1" maxlength="${MAX_TESTO}" placeholder="${esc(id === FAM ? t("Scrivi alla famiglia…", "Message the family…") : t("Scrivi a ", "Message ") + titolo(id) + "…")}" aria-label="${t("Messaggio", "Message")}"></textarea>
        <button class="ktin1s" data-act="ktInvia" aria-label="${t("Invia", "Send")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12 3 4.2l18 7.8-18 7.8z"/><path class="l" d="M4.6 12H12"/></svg></button></div>
    </footer></section>`;
}
function riga(id) {
  const c = C.conv[id], m = c?.ultimo, n = c?.non_letti || 0;
  return `<button class="ktl1 ${vista() === id ? "act" : ""} ${n ? "nl" : ""}" data-act="ktApri" data-id="${esc(id)}">${faccia(id)}
    <span class="tx"><b>${esc(titolo(id))}</b><span>${m ? esc(chiScrive(id, m) + anteprima(m)) : `<em>${id === FAM ? t("Tutta la casa", "The whole home") : t("Scrivi il primo messaggio", "Write the first message")}</em>`}</span></span>
    <span class="mt"><small>${m ? esc(quandoBreve(m.quando)) : ""}</small>${n ? `<em>${n > 99 ? "99+" : n}</em>` : ""}</span></button>`;
}

function avviso(testo) { return `<div class="g g3"><section class="card span3"><div class="ch"><h2>💬 Chat</h2></div><div class="note1">${testo}</div></section></div>`; }
function pagina() {
  if (C.stato === "caricando") return `<div class="g g3"><section class="card span3"><div class="small muted">${t("Carico la chat…", "Loading the chat…")}</div></section></div>`;
  if (C.stato === "errore") return avviso(/unknown_command|unknown command/i.test(C.err)
    ? t("Per usare la Chat riavvia Home Assistant (Impostazioni → Sistema → ⏻ Riavvia): l'aggiornamento della plancia ha cambiato anche la parte che salva i messaggi.", "To use the Chat restart Home Assistant (Settings → System → ⏻ Restart): the dashboard update also changed the part that stores the messages.")
    : t("Non riesco a leggere la chat da Home Assistant. Riprova tra poco.", "I can't read the chat from Home Assistant. Try again shortly."));
  if (!C.membro) return avviso(t("Il tuo utente non è collegato a nessuna persona di Home Assistant, quindi non può usare la chat di famiglia. Un amministratore può collegarlo in Impostazioni → Persone: apri la persona e scegli l'utente.", "Your user isn't linked to any Home Assistant person, so it can't use the family chat. An admin can link it in Settings → People: open the person and pick the user."));
  const L = conversazioni();
  if (!C.aperta && largo() && L.length) C.aperta = L[0];   // su schermo largo la conversazione resta quella, anche se un'altra riceve un messaggio
  const v = vista();
  return `<div class="kt1 ${C.aperta ? "aperta" : ""}">
    <section class="card ktls1"><div class="ch"><h2>💬 ${t("Conversazioni", "Conversations")}${nonLetti() ? ` <span class="tag info">${nonLetti()}</span>` : ""}</h2>
      <button class="btn sm" data-act="ktNotif" title="${t("Notifiche sul telefono", "Phone notifications")}">${C.notifiche ? "🔔" : "🔕"}</button></div>
      <div class="ktll1">${L.map(riga).join("")}</div>
      ${L.length < 2 ? `<p class="small muted" style="margin-top:12px">${t("Le altre persone compaiono qui quando il loro utente di Home Assistant è collegato a una persona.", "Other people show up here when their Home Assistant user is linked to a person.")}</p>` : ""}
      <p class="small muted ktpv1">🔒 ${t("I messaggi restano in Home Assistant, a casa tua. Nessun servizio esterno.", "Messages stay in Home Assistant, in your home. No outside services.")}</p></section>
    ${v ? conversazione(v) : ""}</div>`;
}

/* la chat riempie lo schermo fino alla barra in basso (che cambia altezza con le pillole in alto, il tema, la barra a scomparsa) */
function misura() {
  const k = document.querySelector(".kt1"), el = k && (largo() ? k : k.querySelector(".ktc2")); if (!el) return;
  const top = el.getBoundingClientRect().top + scrollY, tb = document.getElementById("tabbar");
  const barra = !largo() && tb && getComputedStyle(tb).display !== "none" && !document.body.classList.contains("navauto");
  const h = Math.max(largo() ? 520 : 360, Math.round((barra ? tb.getBoundingClientRect().top - 12 : innerHeight - 16) - top));
  if (h !== misura.h) { misura.h = h; document.documentElement.style.setProperty("--kt-h", h + "px"); }
}
addEventListener("resize", () => { if (UI.page === "chat") { misura(); render(); } });

/* dopo il disegno: testo della bozza giusta, scorrimento, letti */
let taConv = null;
function dopo() {
  misura();
  const v = vista(), ta = document.getElementById("ktta1"), sc = document.getElementById("ktsc1");
  if (ta && taConv !== v) { ta.value = C.bozze[v] || ""; taConv = v; cresci(ta); SC.giu = true; }
  if (!ta) taConv = null;
  if (sc) {
    if (SC.alto != null) { sc.scrollTop += sc.scrollHeight - SC.alto; SC.alto = null; }
    else if (SC.giu && conv(v).msg) { sc.scrollTop = sc.scrollHeight; SC.giu = false; SC.fondo = true; }
  }
  if (v) segnaLetto(v);
}
const cresci = ta => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight + 2) + "px"; };
const guardo = id => UI.page === "chat" && !UI.ss && document.visibilityState === "visible" && vista() === id && (largo() || C.aperta === id);
let inLettura = {};
function segnaLetto(id) {
  const c = conv(id); if (!guardo(id) || !c.msg || (c.letti[C.io] || 0) >= c.n || inLettura[id]) return;
  const n = c.n; inLettura[id] = true;
  ws({ type: "nduja_dashboard/chat_read", conv: id, n }).then(r => { c.letti[C.io] = Math.max(c.letti[C.io] || 0, r.n); if (r.n >= c.n) c.non_letti = 0; render(); })
    .catch(e => console.warn("nduja chat read", e)).finally(() => { inLettura[id] = false; });
}
/* i link dentro i messaggi si aprono davvero (senza selezionare la bolla) */
document.addEventListener("click", e => { if (e.target.closest?.(".ktb1 a[href]")) e.stopPropagation(); }, true);
document.addEventListener("scroll", e => { if (e.target.id === "ktsc1") { const s = e.target; SC.fondo = s.scrollHeight - s.scrollTop - s.clientHeight < 60; } }, true);

/* ---------- arrivi in tempo reale ---------- */
function evento(ev) {
  if (!ev?.conv) return;
  const c = conv(ev.conv);
  if (ev.tipo === "nuovo") {
    const m = ev.msg; if (!m) return;
    const gia = c.msg?.some(x => x.n === m.n);
    c.n = Math.max(c.n, m.n); if (!c.ultimo || m.n >= c.ultimo.n) c.ultimo = m;
    if (c.msg && !gia) { c.msg.push(m); c.msg.sort((a, b) => a.n - b.n); arrivati[ev.conv + ":" + m.n] = Date.now(); if (SC.fondo || m.da === C.io) SC.giu = true; }
    if (m.da === C.io) {
      c.letti[C.io] = Math.max(c.letti[C.io] || 0, m.n);
      const i = c.attesa.findIndex(a => a.tipo === m.tipo && (m.tipo !== "testo" || a.testo === m.testo)); if (i >= 0) c.attesa.splice(i, 1);   // era in attesa: ora c'è davvero
    } else if (!gia) {
      c.non_letti = (c.non_letti || 0) + 1;
      if (!guardo(ev.conv)) toast("💬 " + nomeDi(m.da) + (ev.conv === FAM ? " · " + t("Famiglia", "Family") : "") + ": " + anteprima(m).slice(0, 80));
    }
  } else if (ev.tipo === "letto") {
    c.letti[ev.uid] = Math.max(c.letti[ev.uid] || 0, ev.n);
    if (ev.uid === C.io) c.non_letti = ev.n >= c.n ? 0 : (c.msg ? c.msg.filter(m => m.n > ev.n && m.da !== C.io && m.tipo !== "cancellato").length : c.non_letti);
  } else if (ev.tipo === "cancellato") {
    for (const m of [...(c.msg || []), ...(c.ultimo ? [c.ultimo] : [])]) if (m.n === ev.n) { m.tipo = "cancellato"; delete m.testo; delete m.dati; }
    if (C.sel === ev.conv + ":" + ev.n) C.sel = null;
  }
  render();
}

/* la plancia dice al server se è aperta e usata: chi la sta guardando non riceve la notifica sul telefono */
let presInviata = { vis: null, t: 0 };
function presenza(forza) {
  if (C.stato !== "ok" || !conn) return;
  const vis = document.visibilityState === "visible" && !UI.ss, ora = Date.now();
  if (!forza && vis === presInviata.vis && (!vis || ora - presInviata.t < 60000)) return;
  presInviata = { vis, t: ora };
  ws({ type: "nduja_dashboard/chat_presenza", visibile: vis }).catch(() => {});
}
document.addEventListener("visibilitychange", () => { presenza(); if (document.visibilityState === "visible") { apriDaLink(); render(); } });
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => presenza(), { passive: true });
setInterval(() => presenza(), 30000);

/* la notifica sul telefono apre /nduja?apri=chat:<conversazione>: qui la apro e tolgo il segno dall'indirizzo */
function apriDaLink() {
  let w = window; try { if (window.parent !== window && parent.location.href) w = parent; } catch {}
  let q = null; try { q = new URLSearchParams(w.location.search).get("apri"); } catch { return; }
  if (!q || !/^chat(:|$)/.test(q)) return;
  try { const u = new URL(w.location.href); u.searchParams.delete("apri"); w.history.replaceState(w.history.state, "", u.pathname + u.search + u.hash); } catch {}
  const prova = (i = 0) => {
    if (!UI.page || !Object.keys(S).length || !PAGE_OK()) { if (i < 60) setTimeout(() => prova(i + 1), 300); return; }
    const id = q.slice(5).replace(/ /g, "+");   // un «+» non codificato arriva come spazio
    if (id && conversazioni().includes(id)) { C.aperta = id; C.sel = null; SC.giu = true; }
    go("chat");
  };
  prova();
}
ready.then(() => {
  if (!conn) return;
  carica().then(() => presenza(true));
  conn.subscribeMessage(evento, { type: "nduja_dashboard/chat_subscribe" }).then(() => presenza(true)).catch(e => console.warn("nduja chat_subscribe", e));
  conn.addEventListener("ready", () => { presInviata.vis = null; carica().then(() => presenza(true)); for (const id in C.conv) if (C.conv[id].msg) caricaMsg(id, true); });
  window.addEventListener("focus", () => carica());
  try { if (window.parent !== window) parent.addEventListener("location-changed", () => setTimeout(apriDaLink, 50)); } catch {}
  apriDaLink();
}).catch(() => {});

/* ---------- invio ---------- */
let tmp = 0;
async function invia(id, tipo, extra, etichetta) {
  const c = conv(id), a = { k: ++tmp, tipo, testo: extra.testo || "", etichetta: etichetta || "" };
  c.attesa.push(a); SC.giu = true; render();
  try {
    const r = await ws({ type: "nduja_dashboard/chat_send", conv: id, tipo, ...extra });
    c.attesa = c.attesa.filter(x => x !== a);
    if (r?.msg) evento({ conv: id, tipo: "nuovo", msg: r.msg });
    return true;
  } catch (e) {
    c.attesa = c.attesa.filter(x => x !== a);
    if (tipo === "testo" && !(C.bozze[id] || "").trim()) { C.bozze[id] = extra.testo; taConv = null; }
    toast(t("Non inviato: ", "Not sent: ") + ({ too_fast: t("troppi messaggi insieme, aspetta un attimo", "too many messages at once, wait a moment"), camera: t("la telecamera non ha dato la foto", "the camera didn't return a photo"),
      unauthorized: t("non hai il permesso", "not allowed"), unknown_command: t("riavvia Home Assistant", "restart Home Assistant") }[e?.code] || e?.message || e?.code || "?"), true);
    render(); return false;
  }
}
function inviaTesto() {
  const id = vista(), ta = document.getElementById("ktta1"); if (!id || !ta) return;
  const testo = ta.value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TESTO);
  if (!testo) { ta.focus(); return; }
  ta.value = ""; C.bozze[id] = ""; cresci(ta); ta.focus();
  invia(id, "testo", { testo });
}
document.addEventListener("input", e => {
  if (e.target.id !== "ktta1") return;
  const id = vista(); if (id) C.bozze[id] = e.target.value;
  cresci(e.target);
});
document.addEventListener("keydown", e => {
  if (e.target.id !== "ktta1" || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  if (matchMedia("(pointer:coarse)").matches) return;   // sul telefono «Invio» va a capo: si manda con ➤
  e.preventDefault(); inviaTesto();
});
/* tastiera sulle bolle (Invio o spazio = tocco) */
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("ktb1")) { e.preventDefault(); ACT.ktSel(e.target); } });

/* ---------- condividere: posizione, foto, spesa ---------- */
const io = () => membro(C.io)?.persona || null;
function miaPos() {
  const p = io(); if (!p || !S[p]) return null;
  const a = S[p].attributes; if (a.latitude == null || a.longitude == null) return null;
  return { lat: +a.latitude, lon: +a.longitude, zona: S[p].state === "home" || S[p].state === "not_home" ? S[p].state : String(S["zone." + S[p].state]?.attributes.friendly_name || S[p].state), acc: a.gps_accuracy };
}
/* le telecamere della plancia (senza doppioni dei flussi), come nella pagina Telecamere */
const telecamere = () => { try { return camPlancia().filter(id => ok(flussi(id).diretta)); } catch { return []; } };
const LISTA = { liste: [], id: null, voci: null, err: false };
const listeSpesa = () => allEnts("todo").sort((a, b) => (/shopping|spesa|grocer/i.test(b + nm(b)) - /shopping|spesa|grocer/i.test(a + nm(a))) || nm(a).localeCompare(nm(b), LOC));
function caricaVoci(eid) {
  LISTA.id = eid; LISTA.voci = null; LISTA.err = false; render();
  ws({ type: "todo/item/list", entity_id: eid }).then(r => { if (LISTA.id === eid) { LISTA.voci = (r.items || []).filter(x => x.status !== "completed"); render(); } })
    .catch(() => { if (LISTA.id === eid) { LISTA.err = true; render(); } });
}
let foglio = "menu";
function schedaPiu() {
  const id = vista(), pos = miaPos(), cams = telecamere(), liste = listeSpesa();
  const testa = (h, s, indietro) => `<div class="sh-head"><div>${indietro ? `<button class="lnk ktbk2" data-act="ktFoglio" data-v="menu">‹ ${t("Indietro", "Back")}</button>` : ""}<h3>${h}</h3><div class="small muted">${s}</div></div><button class="x" data-act="sheetClose">×</button></div>`;
  if (foglio === "cam") return testa("📷 " + t("Foto da una telecamera", "Photo from a camera"), t("Tocca una telecamera: la foto di adesso arriva a ", "Tap a camera: a photo of right now goes to ") + esc(titolo(id)) + ".", true)
    + (cams.length ? `<div class="ktcm1">${cams.map(c => { const a = flussi(c).anteprima, u = fotoCam(ok(a) ? a : c); return `<button class="ktcm2" data-act="ktCam" data-id="${c}">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : `<i></i>`}<b>${esc(nm(c))}</b></button>`; }).join("")}</div>`
      : `<div class="empty">${t("Nessuna telecamera in casa.", "No cameras at home.")}</div>`);
  if (foglio === "spesa") {
    const L = liste;
    return testa("🛒 " + t("Dalla lista della spesa", "From the shopping list"), t("Tocca una voce per mandarla.", "Tap an item to send it."), true)
      + (L.length > 1 ? `<div class="pkt1">${L.map(l => `<button class="${LISTA.id === l ? "act" : ""}" data-act="ktLista" data-id="${l}">${esc(nm(l))}</button>`).join("")}</div>` : "")
      + (!L.length ? `<div class="empty">${t("Non c'è nessuna lista in Home Assistant. Aggiungi l'integrazione «Lista della spesa» (Impostazioni → Dispositivi e servizi).", "There's no list in Home Assistant. Add the «Shopping list» integration (Settings → Devices & services).")}</div>`
        : LISTA.err ? `<div class="empty">${t("Non riesco a leggere la lista.", "I can't read the list.")}</div>` : !LISTA.voci ? `<div class="empty">${t("Carico la lista…", "Loading the list…")}</div>`
        : LISTA.voci.length ? `<div class="pkl1">${LISTA.voci.map((v, i) => `<button class="pk1" data-act="ktVoce" data-i="${i}"><span class="ic">🛒</span><span class="tx"><b>${esc(v.summary)}</b>${v.description ? `<small>${esc(v.description)}</small>` : ""}</span><span class="plus">➤</span></button>`).join("")}</div>`
        : `<div class="empty">${t("La lista è vuota: non manca niente.", "The list is empty: nothing missing.")}</div>`);
  }
  return testa(t("Condividi", "Share"), t("In un tocco, a ", "In one tap, to ") + esc(titolo(id)) + ".")
    + `<div class="ktsh1">
      <button class="ktsh2" data-act="ktPos" ${pos ? "" : "disabled"}><span class="ic pos">📍</span><span class="tx"><b>${t("La mia posizione", "My location")}</b><small>${pos ? esc(zonaNome(pos.zona)) : t("Home Assistant non sa dove sei", "Home Assistant doesn't know where you are")}</small></span></button>
      <button class="ktsh2" data-act="ktFoglio" data-v="cam" ${cams.length ? "" : "disabled"}><span class="ic cam">📷</span><span class="tx"><b>${t("Foto da una telecamera", "Photo from a camera")}</b><small>${cams.length ? cams.length + " " + t(cams.length === 1 ? "telecamera" : "telecamere", cams.length === 1 ? "camera" : "cameras") : t("nessuna telecamera", "no cameras")}</small></span></button>
      <button class="ktsh2" data-act="ktFoglio" data-v="spesa" ${liste.length ? "" : "disabled"}><span class="ic sp">🛒</span><span class="tx"><b>${t("Dalla lista della spesa", "From the shopping list")}</b><small>${liste.length ? esc(nm(liste[0])) : t("nessuna lista", "no list")}</small></span></button></div>`;
}

/* ---------- notifiche sul telefono (per sé) ---------- */
function schedaNotifiche() {
  return `<div class="sh-head"><div><h3>${C.notifiche ? "🔔" : "🔕"} ${t("Notifiche della chat", "Chat notifications")}</h3><div class="small muted">${t("Valgono solo per te.", "They apply only to you.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="li"><span class="ic">📱</span><div class="tx"><b>${t("Sul telefono", "On the phone")}</b><span>${t("Quando arriva un messaggio e non hai la plancia aperta", "When a message arrives and the dashboard isn't open")}</span></div>
      <button class="sw ${C.notifiche ? "on" : ""}" data-act="ktNotifSw" aria-label="${t("Notifiche sul telefono", "Phone notifications")}"><i></i></button></div>
    <div class="fl1">${t("I tuoi telefoni", "Your phones")}</div>
    ${C.telefoni.length ? `<div class="vr1">${C.telefoni.map(n => `<span class="pillv">📱 ${esc(n)}</span>`).join("")}</div><p class="small muted" style="margin-top:10px">${t("Toccando la notifica si apre la plancia su questa chat.", "Tapping the notification opens the dashboard on this chat.")}</p>`
      : `<div class="note1">${t("Non trovo il tuo telefono. Installa l'app Home Assistant e controlla che il telefono sia tra quelli tracciati della tua persona (Impostazioni → Persone).", "I can't find your phone. Install the Home Assistant app and make sure the phone is among the tracked devices of your person (Settings → People).")}</div>`}`;
}

/* ---------- azioni ---------- */
Object.assign(ACT, {
  ktApri: el => { C.aperta = el.dataset.id; C.sel = null; SC.giu = true; render(true); },
  ktIndietro: () => { C.aperta = null; C.sel = null; render(true); window.scrollTo(0, 0); },
  ktPrima: el => { const sc = document.getElementById("ktsc1"); SC.alto = sc ? sc.scrollHeight : null; caricaMsg(el.dataset.id, false, true); },
  ktInvia: () => inviaTesto(),
  ktEmo: el => {
    const ta = document.getElementById("ktta1"); if (!ta) return;
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
    ta.value = ta.value.slice(0, a) + el.dataset.v + ta.value.slice(b); C.bozze[vista()] = ta.value;
    const p = a + el.dataset.v.length; if (!matchMedia("(pointer:coarse)").matches) ta.focus(); try { ta.setSelectionRange(p, p); } catch {}
    cresci(ta);
  },
  ktSpunto: el => { const ta = document.getElementById("ktta1"); if (!ta) return; ta.value = el.dataset.v; C.bozze[vista()] = ta.value; cresci(ta); ta.focus(); },
  ktSel: el => { const k = el.dataset.id + ":" + el.dataset.n; C.sel = C.sel === k ? null : k; render(); },
  ktCopia: el => {
    const m = conv(el.dataset.id).msg?.find(x => x.n === +el.dataset.n); if (!m) return;
    navigator.clipboard?.writeText(m.testo || "").then(() => toast("📋 " + t("Copiato", "Copied")), () => toast(t("Non riesco a copiare", "Can't copy"), true));
    C.sel = null; render();
  },
  ktDel: async el => {
    if (!sicuro(el, t("Cancello?", "Delete?"))) return;
    const id = el.dataset.id, n = +el.dataset.n; C.sel = null;
    try { await ws({ type: "nduja_dashboard/chat_delete", conv: id, n }); evento({ conv: id, tipo: "cancellato", n }); toast("🗑 " + t("Messaggio cancellato", "Message deleted")); }
    catch (e) { toast(t("Non cancellato: ", "Not deleted: ") + (e?.message || e?.code), true); }
  },
  ktFoto: (el, e) => {
    e?.stopPropagation?.();
    const u = fotoUrl(el.dataset.conv, el.dataset.f), m = conv(el.dataset.conv).msg?.find(x => x.dati?.f === el.dataset.f);
    if (!u) return;
    openSheet(() => `<div class="sh-head"><div><h3>📷 ${esc(m?.dati?.cam || t("Foto", "Photo"))}</h3><div class="small muted">${m ? esc(nomeDi(m.da)) + " · " + esc(giornoTesto(m.quando)) + " " + hhmm(m.quando) : ""}</div></div><button class="x" data-act="sheetClose">×</button></div>
      <img class="ktfz1" src="${esc(fotoUrl(el.dataset.conv, el.dataset.f) || u)}" alt="">`);
  },
  ktPiu: () => { foglio = "menu"; openSheet(schedaPiu); },
  ktFoglio: el => { foglio = el.dataset.v; if (foglio === "spesa") { const L = listeSpesa(); if (L.length) caricaVoci(L.includes(LISTA.id) ? LISTA.id : L[0]); } render(); },
  ktPos: () => { const id = vista(), p = miaPos(); if (!p) return; closeSheet(); invia(id, "pos", { dati: p }, "📍 " + zonaNome(p.zona)); },
  ktCam: el => { const id = vista(), cam = el.dataset.id; closeSheet(); toast("📷 " + t("Scatto la foto…", "Taking the photo…")); invia(id, "foto", { camera: flussi(cam).diretta, dati: { cam: nm(cam) } }, "📷 " + nm(cam)); },
  ktLista: el => caricaVoci(el.dataset.id),
  ktVoce: el => { const v = LISTA.voci?.[+el.dataset.i], id = vista(); if (!v) return; closeSheet(); invia(id, "spesa", { dati: { voce: v.summary, lista: nm(LISTA.id) } }, "🛒 " + v.summary); },
  ktNotif: () => openSheet(schedaNotifiche),
  ktNotifSw: async () => {
    const on = !C.notifiche;
    try { const r = await ws({ type: "nduja_dashboard/chat_notifiche", attive: on }); C.notifiche = r.notifiche; render(); toast(on ? "🔔 " + t("Notifiche della chat attive", "Chat notifications on") : "🔕 " + t("Notifiche della chat spente", "Chat notifications off")); }
    catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e?.message || e?.code), true); }
  },
  ktHome: el => { C.aperta = el.dataset.id || null; C.sel = null; SC.giu = true; go("chat"); },
});

/* ---------- Home: l'ultimo messaggio e i non letti ---------- */
function homeCard() {
  const L = conversazioni().filter(id => C.conv[id]?.ultimo), id = L[0], c = C.conv[id], m = c.ultimo, tot = nonLetti();
  const altri = L.slice(1).filter(x => C.conv[x].non_letti);
  return card(`💬 ${t("Chat", "Chat")}${tot ? ` <span class="tag info">${tot} ${t(tot === 1 ? "nuovo" : "nuovi", "new")}</span>` : ""}`, `
    <button class="kthm1 ${c.non_letti ? "nl" : ""}" data-act="ktHome" data-id="${esc(id)}">${m.da === C.io || id !== FAM ? faccia(id, "md") : avatar(m.da, "md")}
      <span class="tx"><b>${esc(id === FAM ? nomeDi(m.da) + " · " + t("Famiglia", "Family") : titolo(id))}</b><span>${esc(chiScrive(id === FAM && m.da !== C.io ? "" : id, m) + anteprima(m))}</span></span>
      <span class="mt"><small>${esc(quandoBreve(m.quando))}</small>${c.non_letti ? `<em>${c.non_letti}</em>` : ""}</span></button>
    ${altri.length ? `<div class="kthm2">${altri.slice(0, 3).map(x => `<button class="pillv" data-act="ktHome" data-id="${esc(x)}">${faccia(x, "xs")} ${esc(titolo(x))} <b>${C.conv[x].non_letti}</b></button>`).join("")}</div>` : ""}
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="ktHome" data-id="${esc(id)}">✍️ ${t("Rispondi", "Reply")}</button></div>`,
    { link: [t("Tutte", "All"), "chat"] });
}
HOME_EXTRA.chat = { title: () => t("Chat", "Chat"), render: homeCard, show: () => C.stato === "ok" && C.membro && conversazioni().some(id => C.conv[id]?.ultimo) };
/* in alto nella Home: quanti messaggi non hai letto */
STRIP.push(() => { const n = UI.page === "home" && C.stato === "ok" ? nonLetti() : 0; return n ? `<button class="pillv ktpl2" data-act="go" data-id="chat" title="${t("Messaggi non letti", "Unread messages")}">💬 ${n > 99 ? "99+" : n}</button>` : ""; });

/* la pagina c'è quando in casa ci sono almeno due persone con un utente */
const PAGE_OK = () => (C.stato === "ok" ? C.membri.length : allEnts("person", id => !!attr(id, "user_id")).length) >= 2;
page("chat", { title: t("Chat", "Chat"), short: "Chat", icon: "💬", order: 43, show: PAGE_OK, badge: () => nonLetti() > 0, render: pagina, after: dopo });

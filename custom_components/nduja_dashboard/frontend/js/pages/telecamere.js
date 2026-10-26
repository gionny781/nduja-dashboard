/* Telecamere: anteprime leggere aggiornate ogni pochi secondi; al tocco la diretta col lettore unico (video.js:
   WebRTC → HLS → MJPEG → foto). I doppioni (sub stream, transcodifiche, canali non raggiungibili) restano fuori finché non li aggiungi con ＋.
   Con ✏️ Modifica: ＋ qualsiasi camera.* (anche nascosta), ✕ per toglierla, ◀ ▶ per l'ordine, ✏️ per nome, stanza, gruppo,
   flusso della diretta e dell'anteprima (con il metodo di ognuno) e 🗂 Gruppi (schede separate, facoltative).
   Tutto si salva nel layout (LAYOUT.telecamere, LAYOUT.camOrder, names, rooms): vale su tutti i dispositivi. */
import { S, REG, ACT, CHG, UI, AREAS, FLOORS, LAYOUT, t, LOC, esc, nm, nmHA, ok, attr, card, empty, page, render, sGet, sSet, DEFAULT_OFF,
  openSheet, closeSheet, cached, ws, areaOf, areasSorted, excluded, defaultOff } from "../core.js";
import { cambia, scegli, mostra } from "../edit.js";
import { anteprima, telecamere, flussi, proposta, gruppiCam, gruppoDi, padreDi, fotoCam, METODI, NOME_METODO } from "../video.js";

DEFAULT_OFF.push(id => id.startsWith("camera.") && (/sub_?stream|transcod|_ptz|snapshot/i.test(id) || S[id]?.state === "unavailable"));
const V = { big: sGet("camBig") === "1" };
const $id = x => document.getElementById(x);

/* ---------- griglia ---------- */
/** riassunto dei flussi sulla tessera, solo in modifica: «🔗 2 flussi · HLS» */
function riassunto(id) {
  const f = flussi(id), p = [];
  if (f.anteprima !== f.diretta) p.push("🔗 " + t("2 flussi", "2 streams"));
  if (f.m) p.push("▶ " + NOME_METODO[f.m]);
  if (f.ma) p.push("▦ " + NOME_METODO[f.ma]);
  return p.length ? `<span class="cmf1">${esc(p.join(" · "))}</span>` : "";
}
function tessera(id, L) {
  const html = `<div class="cm1 ${ok(id) ? "" : "dis"}">${anteprima(id)}${UI.edit ? riassunto(id) : ""}</div>`;
  if (!UI.edit) return html;
  const G = L.filter(x => gruppoDi(x) === gruppoDi(id)), i = G.indexOf(id);
  return `<div class="ed1">${html}<div class="edb">
    <button data-act="camMove" data-id="${id}" data-v="-1" ${i > 0 ? "" : "disabled"} aria-label="${t("Sposta prima", "Move earlier")}">◀</button><button data-act="camMove" data-id="${id}" data-v="1" ${i < G.length - 1 ? "" : "disabled"} aria-label="${t("Sposta dopo", "Move later")}">▶</button>
    <button data-act="camEdit" data-id="${id}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="edDel" data-id="${id}" data-page="" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}
const aggiungiBtn = big => UI.edit ? `<button class="add1 ${big ? "wide1" : ""}" data-act="camAdd"><span>＋</span>${t("Aggiungi telecamera", "Add camera")}</button>` : "";

function pagina() {
  const L = telecamere(), G = gruppiCam();
  if (!L.length) return `<div class="g">${card("📷 " + t("Telecamere", "Cameras"), empty(t("Nessuna telecamera: premi ✏️ Modifica per aggiungerle.", "No cameras: press ✏️ Edit to add them.")) + aggiungiBtn(true))}</div>`;
  /* una scheda per gruppo (nell'ordine dei gruppi), poi quelle senza gruppo; i gruppi vuoti si vedono solo in modifica */
  const sezioni = [...G.map(g => ({ id: g.id, nome: g.nome, L: L.filter(x => gruppoDi(x) === g.id) })),
    { id: "", nome: G.length ? t("Altre telecamere", "Other cameras") : t("Telecamere", "Cameras"), L: L.filter(x => !gruppoDi(x)) }]
    .filter(s => s.L.length || UI.edit);
  return `<div class="g">${sezioni.map((s, k) => `<section class="card"><div class="ch"><h2>📷 ${esc(s.nome)} <span class="tag info">${s.L.length}</span></h2>
      ${k ? "" : `<div class="row" style="gap:6px">${UI.edit ? `<button class="btn sm" data-act="camGruppi">🗂 ${t("Gruppi", "Groups")}</button>` : ""}<button class="btn sm" data-act="camBig">${V.big ? "▦ " + t("Piccole", "Small") : "▢ " + t("Grandi", "Large")}</button></div>`}</div>
    <div class="cms1 ${V.big ? "big" : ""}">${s.L.map(id => tessera(id, L)).join("")}${s.id ? "" : aggiungiBtn()}</div>
    ${UI.edit && s.id && !s.L.length ? `<p class="small muted">${t("Ancora vuoto: scegli le telecamere da 🗂 Gruppi o con ✏️ su ognuna.", "Still empty: pick the cameras from 🗂 Groups or with ✏️ on each one.")}</p>` : ""}
    ${UI.edit && k === sezioni.length - 1 ? `<p class="small muted" style="margin-top:10px">${t("◀ ▶ cambia l'ordine, ✏️ nome, stanza, gruppo e flussi, ✕ toglie. Se una telecamera ha più flussi (principale e sub-stream, HD e SD) l'anteprima usa quello leggero e la diretta il principale: le coppie le trovo da solo. Con ＋ aggiungi qualsiasi telecamera, anche i doppioni nascosti.", "◀ ▶ changes the order, ✏️ name, room, group and streams, ✕ removes. If a camera has more than one stream (main and sub-stream, HD and SD) the preview uses the light one and the live view the main one: I find the pairs myself. With ＋ add any camera, even hidden duplicates.")}</p>` : ""}</section>`).join("")}</div>`;
}

/* ---------- ＋ aggiungi: qualsiasi camera.*, anche nascosta in Home Assistant, doppione o flusso di un'altra ---------- */
const AG = { q: "" };
function perche(id, L) {
  const p = padreDi(id, L);
  if (p) return "🔗 " + t("flusso di ", "stream of ") + nm(p);
  if (REG[id]?.hidden || REG[id]?.cat != null) return "🙈 " + t("nascosta in Home Assistant", "hidden in Home Assistant");
  if (excluded(id)) return "✕ " + t("tolta dalla plancia", "removed from the dashboard");
  if (S[id]?.state === "unavailable") return "⚠️ " + t("non raggiungibile", "unavailable");
  if (defaultOff(id)) return "🧩 " + t("doppione nascosto", "hidden duplicate");
  return "";
}
const miniatura = id => ok(id) && attr(id, "entity_picture") ? `<img class="cmt1" src="${esc(fotoCam(id))}" alt="" loading="lazy">` : `<span class="cmt1">📷</span>`;
function aggiungi() {
  const L = telecamere(), dentro = new Set(L), q = AG.q.toLowerCase();
  const C = Object.keys(S).filter(id => id.startsWith("camera.") && !dentro.has(id))
    .filter(id => !q || (nm(id) + " " + id + " " + (AREAS[areaOf(id)]?.name || "")).toLowerCase().includes(q))
    .sort((a, b) => nm(a).localeCompare(nm(b), LOC));
  const riga = id => { const w = perche(id, L);
    return `<button class="pk1" data-act="camPick" data-id="${id}">${miniatura(id)}<span class="tx"><b>${esc(nm(id))}</b><small>${esc(id)}${w ? ` · ${esc(w)}` : ""}</small></span><span class="plus">＋</span></button>`; };
  const fl = C.filter(id => padreDi(id, L)), altre = C.filter(id => !fl.includes(id));
  return `<div class="sh-head"><div><h3>＋ ${t("Telecamere", "Cameras")}</h3><div class="small muted">${t("Tutte le telecamere di Home Assistant che non sono già nella plancia, anche quelle nascoste. Puoi aggiungerne più di una.", "Every Home Assistant camera that isn't on the dashboard yet, hidden ones included. You can add more than one.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <input id="cm1q" class="pk1q" type="search" placeholder="🔍 ${t("Cerca per nome, stanza o entità…", "Search by name, room or entity…")}" value="${esc(AG.q)}" autocomplete="off">
    ${altre.length ? `<div class="fl1">${fl.length ? t("Altre telecamere", "Other cameras") : t("Telecamere", "Cameras")}</div><div class="pkl1">${altre.map(riga).join("")}</div>` : ""}
    ${fl.length ? `<div class="fl1">${t("Flussi delle tue telecamere", "Streams of your cameras")}</div><p class="small muted" style="margin:-2px 2px 8px">${t("Sono già usati come anteprima o diretta: aggiungili solo se li vuoi anche come telecamera a parte.", "They're already used as preview or live stream: add them only if you also want them as a separate camera.")}</p><div class="pkl1">${fl.map(riga).join("")}</div>` : ""}
    ${C.length ? "" : `<div class="empty">${q ? t("Nessun risultato.", "No results.") : t("Tutte le telecamere sono già nella plancia.", "Every camera is already on the dashboard.")}</div>`}`;
}
document.addEventListener("input", e => { if (e.target.id === "cm1q") { AG.q = e.target.value; render(); } });

/* ---------- ✏️ una telecamera: nome, stanza, gruppo, flussi e metodi ---------- */
let E = null;
/* metodi che il flusso offre: true, false oppure null (non so: Home Assistant non l'ha detto) */
const capacita = id => cached("camcap:" + id, 5 * 60000, () => ws({ type: "camera/capabilities", entity_id: id }).then(r => r?.frontend_stream_types || []).catch(() => null));
function offre(id, m) {
  const c = capacita(id);
  if (m === "webrtc") return c ? c.includes("web_rtc") : null;
  if (m === "hls") return c ? c.includes("hls") : null;
  if (m === "mjpeg") return !!attr(id, "access_token");
  return !!attr(id, "entity_picture");
}
const SPIEGA = () => ({ webrtc: t("quasi in tempo reale (serve go2rtc)", "almost real time (needs go2rtc)"), hls: t("qualche secondo di ritardo, va ovunque", "a few seconds behind, works everywhere"),
  mjpeg: t("immagini in sequenza, senza audio", "a sequence of images, no sound"), foto: t("una foto ogni 2 secondi", "a photo every 2 seconds") });
/** pulsanti del metodo per un flusso: f = "m" (diretta) o "ma" (anteprima) */
function metodi(f, x) {
  const scelto = E[f] || "", ult = sGet("camMetodo_" + x);
  const op = f === "m" ? [["", "✨ Auto"], ...METODI.map(m => [m, NOME_METODO[m]])]
    : [["", "🖼️ " + t("Foto leggera", "Light photo")], ...METODI.filter(m => m !== "foto").map(m => [m, NOME_METODO[m]])];
  const cap = capacita(x), offerti = METODI.filter(m => offre(x, m) === true);
  const nota = scelto ? (offre(x, scelto) === false ? "⚠️ " + t("Questo flusso non sembra offrire ", "This stream doesn't seem to offer ") + NOME_METODO[scelto] + t(": la diretta potrebbe non partire.", ": the live view may not start.") : NOME_METODO[scelto] + ": " + SPIEGA()[scelto] + ".")
    : f === "m" ? t("Provo WebRTC, poi HLS, MJPEG e foto; parto da quello che ha funzionato l'ultima volta", "I try WebRTC, then HLS, MJPEG and photo, starting from the one that worked last time") + (ult ? ` (${t("su questo dispositivo", "on this device")}: ${NOME_METODO[ult]})` : "") + "."
    : t("Una foto aggiornata ogni pochi secondi: la scelta più leggera. Con un metodo video l'anteprima si muove sempre (consuma di più).", "A photo refreshed every few seconds: the lightest choice. With a video method the preview is always moving (uses more data).");
  return `<div class="seg cms2">${op.map(([m, n]) => `<button class="${scelto === m ? "act" : ""} ${m && offre(x, m) === false ? "no1" : ""}" data-act="camM" data-f="${f}" data-v="${m}">${esc(n)}</button>`).join("")}</div>
    <p class="small muted cmn2">${esc(nota)}</p>
    <p class="small muted cmn2">${cap === undefined ? t("Controllo i metodi offerti…", "Checking the methods offered…")
      : `${t("Offre", "Offers")}: ${offerti.map(m => NOME_METODO[m]).join(" · ") || "—"}${cap === null ? t(" (WebRTC e HLS: Home Assistant non lo dice)", " (WebRTC and HLS: Home Assistant doesn't say)") : ""}`}</p>`;
}
function scheda() {
  const e = E, id = e.id, prop = proposta(id), dir = e.diretta && S[e.diretta] ? e.diretta : id, ant = e.anteprima && S[e.anteprima] ? e.anteprima : prop || dir;
  const G = gruppiCam(), suggeriti = [t("Esterno", "Outside"), t("Interno", "Inside")].filter(n => !G.some(g => g.nome.toLowerCase() === n.toLowerCase()));
  const r = LAYOUT.rooms?.[id] || "", haArea = REG[id]?.area;
  const flusso = (ruolo, x, sotto) => `<button class="li cfl2" data-act="camFl" data-v="${ruolo}">${miniatura(x)}<div class="tx"><b>${esc(nm(x))}</b><span>${esc(x)}${sotto ? " · " + esc(sotto) : ""}</span></div><span class="st">›</span></button>`;
  return `<div class="sh-head"><div><h3>✏️ ${esc(nm(id))}</h3><div class="small muted mono">${esc(id)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome nella plancia", "Name in the dashboard")}</span><input id="cm1n" type="text" value="${esc(e.nome)}" placeholder="${esc(nmHA(id))}" data-chg="camNome"></label>
    <label class="fld1"><span>${t("Stanza", "Room")}</span><select id="cm1r" data-chg="camStanza"><option value="">${haArea && AREAS[haArea] ? t("Come in Home Assistant", "As in Home Assistant") + ` (${esc(AREAS[haArea].name)})` : t("Nessuna stanza", "No room")}</option>
      ${areasSorted(true).map(a => `<option value="${a}" ${e.area === a ? "selected" : ""}>${esc(AREAS[a].name)}${FLOORS[AREAS[a].floor] ? " · " + esc(FLOORS[AREAS[a].floor].name) : ""}</option>`).join("")}</select></label>
    <div class="fl1">${t("Gruppo", "Group")} <span class="cmo2">· ${t("facoltativo, una scheda a parte", "optional, a separate card")}</span></div>
    <div class="pkt1">${[["", t("Nessuno", "None")], ...G.map(g => [g.id, g.nome]), ...suggeriti.map(n => ["new:" + n, "＋ " + n])].map(([g, n]) => `<button class="${e.gruppo === g ? "act" : ""}" data-act="camG" data-v="${esc(g)}">${esc(n)}</button>`).join("")}</div>
    <input id="cm1g" class="pk1q cmg2" type="text" placeholder="${t("…oppure scrivi il nome di un gruppo nuovo", "…or type the name of a new group")}" value="${esc(e.gruppo.startsWith("new:") && !suggeriti.includes(e.gruppo.slice(4)) ? e.gruppo.slice(4) : "")}" data-chg="camGNome1" autocomplete="off">
    <div class="fl1">${t("Flussi", "Streams")}</div>
    <div class="cfl1"><div class="cfl1h">▶ ${t("Diretta", "Live view")} <span>${t("al tocco, il flusso principale", "on tap, the main stream")}</span></div>
      ${flusso("diretta", dir, dir === id ? t("questa telecamera", "this camera") : "")}${metodi("m", dir)}</div>
    <div class="cfl1"><div class="cfl1h">▦ ${t("Anteprima in griglia", "Grid preview")} <span>${t("il flusso leggero", "the light stream")}</span></div>
      ${flusso("anteprima", ant, !e.anteprima && prop ? "✨ " + t("trovato da solo", "found automatically") : ant === dir ? t("uguale alla diretta", "same as the live view") : "")}${metodi("ma", ant)}</div>
    ${!prop && !e.anteprima ? `<p class="small muted" style="margin-top:8px">${t("Non ho trovato un flusso leggero (sub-stream, SD) per questa telecamera: se c'è, sceglilo toccando l'anteprima.", "I didn't find a light stream (sub-stream, SD) for this camera: if there is one, pick it by tapping the preview.")}</p>` : ""}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="camSave">💾 ${t("Salva", "Save")}</button>
      <button class="btn bad" data-act="edDel" data-id="${id}" data-page="">✕ ${t("Togli dalla plancia", "Remove from dashboard")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Nome, stanza, gruppo e flussi cambiano solo nella plancia, per tutti i dispositivi; Home Assistant resta com'è.", "Name, room, group and streams change only in the dashboard, on every device; Home Assistant stays as it is.")}</p>`;
}
const apri = e => { E = e; openSheet(scheda); };
/* prima di aprire un altro foglio tengo quello che è già scritto */
function tieni() {
  if (!E) return;
  if ($id("cm1n")) E.nome = $id("cm1n").value.trim();
  if ($id("cm1r")) E.area = $id("cm1r").value;
  const g = ($id("cm1g")?.value || "").trim(); if (g) E.gruppo = "new:" + g;
}
CHG.camNome = el => { if (E) E.nome = el.value.trim(); };
CHG.camStanza = el => { if (E) E.area = el.value; };
CHG.camGNome1 = el => { if (!E) return; const v = el.value.trim(); if (v) E.gruppo = "new:" + v; else if (E.gruppo.startsWith("new:")) E.gruppo = ""; render(); };

/* ---------- 🗂 gruppi ---------- */
const NUOVI = () => [t("Esterno", "Outside"), t("Interno", "Inside"), t("Ingresso", "Entrance"), t("Giardino", "Garden")];
function gruppi() {
  const G = gruppiCam(), L = telecamere(), sugg = NUOVI().filter(n => !G.some(g => g.nome.toLowerCase() === n.toLowerCase()));
  return `<div class="sh-head"><div><h3>🗂 ${t("Gruppi", "Groups")}</h3><div class="small muted">${t("Facoltativi: ogni gruppo è una scheda a parte (es. «Esterno», «Interno»). Tocca le telecamere per metterle nel gruppo o toglierle.", "Optional: every group is a separate card (e.g. «Outside», «Inside»). Tap the cameras to put them in the group or take them out.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${G.length ? G.map((g, i) => `<div class="cgr1">
      <div class="row" style="gap:6px"><input class="pk1q cgi1" type="text" value="${esc(g.nome)}" data-chg="camGRen" data-id="${g.id}" aria-label="${t("Nome del gruppo", "Group name")}">
        <button class="btn sm" data-act="camGMove" data-id="${g.id}" data-v="-1" ${i ? "" : "disabled"} aria-label="${t("Sposta su", "Move up")}">▲</button><button class="btn sm" data-act="camGMove" data-id="${g.id}" data-v="1" ${i < G.length - 1 ? "" : "disabled"} aria-label="${t("Sposta giù", "Move down")}">▼</button>
        <button class="btn sm bad" data-act="camGDel" data-id="${g.id}" aria-label="${t("Elimina il gruppo", "Delete the group")}">✕</button></div>
      <div class="pkt1">${L.map(id => { const qui = gruppoDi(id) === g.id, altro = !qui && gruppoDi(id);
        return `<button class="${qui ? "act" : ""}" data-act="camGTog" data-g="${g.id}" data-id="${id}" title="${altro ? esc(t("ora in ", "now in ") + (G.find(x => x.id === altro)?.nome || "")) : ""}">${qui ? "✓ " : ""}${esc(nm(id))}${altro ? ` <small>· ${esc(G.find(x => x.id === altro)?.nome || "")}</small>` : ""}</button>`; }).join("")}</div></div>`).join("")
      : `<div class="empty">${t("Nessun gruppo: tutte le telecamere sono in un'unica scheda.", "No groups: all cameras are in a single card.")}</div>`}
    <div class="fl1">${t("Nuovo gruppo", "New group")}</div>
    <div class="row" style="gap:8px"><input id="cg1n" class="pk1q" type="text" placeholder="${t("Nome del gruppo", "Group name")}" autocomplete="off" style="flex:1;margin:0"><button class="btn pri" data-act="camGAdd">＋ ${t("Aggiungi", "Add")}</button></div>
    ${sugg.length ? `<div class="pkt1" style="margin-top:8px">${sugg.map(n => `<button data-act="camGAdd" data-v="${esc(n)}">＋ ${esc(n)}</button>`).join("")}</div>` : ""}
    ${G.length ? `<p class="small muted" style="margin-top:12px">${t("Le telecamere senza gruppo restano nella scheda «Altre telecamere». Eliminando un gruppo le sue telecamere tornano lì.", "Cameras without a group stay in the «Other cameras» card. Deleting a group sends its cameras back there.")}</p>` : ""}`;
}
/** modifica LAYOUT.telecamere su una copia: fn(C) con C.voci e C.gruppi sempre presenti */
const salvaCam = (fn, msg) => cambia(l => { const C = JSON.parse(JSON.stringify(l.telecamere || {})); C.voci = C.voci || {}; C.gruppi = C.gruppi || []; fn(C); l.telecamere = C; }, msg);
/** gruppo con questo nome (lo crea se manca): restituisce l'id */
function gruppoPerNome(C, nome) {
  const g = C.gruppi.find(x => x.nome.toLowerCase() === nome.toLowerCase());
  if (g) return g.id;
  const id = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  C.gruppi.push({ id, nome }); return id;
}
/** toglie le voci rimaste vuote */
const pulisci = (C, id) => { const v = C.voci[id]; if (v) { for (const k in v) if (v[k] === "" || v[k] == null) delete v[k]; if (!Object.keys(v).length) delete C.voci[id]; } };

/* ---------- azioni ---------- */
Object.assign(ACT, {
  camBig: () => { V.big = !V.big; sSet("camBig", V.big ? "1" : "0"); render(true); },
  camMove: el => { const id = el.dataset.id, d = +el.dataset.v;
    cambia(l => { const o = telecamere(), G = o.filter(x => gruppoDi(x) === gruppoDi(id)), k = G.indexOf(id), j = k + d;
      if (k < 0 || j < 0 || j >= G.length) return; const a = o.indexOf(id), b = o.indexOf(G[j]); [o[a], o[b]] = [o[b], o[a]];
      l.camOrder = [...o, ...(l.camOrder || []).filter(x => !o.includes(x))]; }); },
  camAdd: () => { AG.q = ""; openSheet(aggiungi); },
  camPick: el => { const id = el.dataset.id; cambia(l => mostra(l, id, { forza: true }), "＋ " + nm(id)); },
  camEdit: el => { const id = el.dataset.id, v = LAYOUT.telecamere?.voci?.[id] || {}, g = gruppoDi(id);
    apri({ id, nome: LAYOUT.names?.[id] || "", area: LAYOUT.rooms?.[id] || "", gruppo: g, diretta: v.diretta && S[v.diretta] ? v.diretta : "", anteprima: v.anteprima && S[v.anteprima] ? v.anteprima : "", m: v.m || "", ma: v.ma && v.ma !== "foto" ? v.ma : "" }); },
  camG: el => { tieni(); E.gruppo = el.dataset.v; const i = $id("cm1g"); if (i) i.value = ""; render(); },
  camM: el => { tieni(); E[el.dataset.f] = el.dataset.v; render(); },
  camFl: el => { tieni(); const e = { ...E }, ruolo = el.dataset.v, prop = proposta(e.id), dir = e.diretta || e.id;
    scegli({ titolo: ruolo === "diretta" ? "▶ " + t("Flusso della diretta", "Live view stream") : "▦ " + t("Flusso dell'anteprima", "Preview stream"),
      sotto: ruolo === "diretta" ? t("Di solito il flusso principale (HD): si vede al tocco, nel foglio grande.", "Usually the main stream (HD): shown on tap, in the large sheet.")
        : t("Di solito il sub-stream (SD): pesa meno e basta per le anteprime. Scegli la diretta stessa se non ce n'è uno.", "Usually the sub-stream (SD): it's lighter and enough for previews. Pick the live stream itself if there isn't one."),
      filtro: x => x.startsWith("camera."), area: areaOf(e.id), attuale: e[ruolo] || "", auto: ruolo === "diretta" ? e.id : prop || dir,
      onPick: x => { if (ruolo === "diretta") e.diretta = x === e.id ? "" : x; else e.anteprima = x; apri(e); } }); },
  camSave: () => { tieni(); const e = E, id = e.id, gNuovo = e.gruppo.startsWith("new:") ? e.gruppo.slice(4).trim() : "";
    closeSheet();
    cambia(l => {
      l.names = { ...(l.names || {}) }; l.rooms = { ...(l.rooms || {}) };
      if (e.nome && e.nome !== nmHA(id)) l.names[id] = e.nome; else delete l.names[id];
      if (e.area) l.rooms[id] = e.area; else delete l.rooms[id];
      const C = JSON.parse(JSON.stringify(l.telecamere || {})); C.voci = C.voci || {}; C.gruppi = C.gruppi || [];
      const g = gNuovo ? gruppoPerNome(C, gNuovo) : C.gruppi.some(x => x.id === e.gruppo) ? e.gruppo : "";
      C.voci[id] = { diretta: e.diretta && e.diretta !== id ? e.diretta : "", anteprima: e.anteprima || "", m: e.m, ma: e.ma, gruppo: g };
      pulisci(C, id); l.telecamere = C;
    }, "💾 " + (e.nome || nmHA(id))); },
  camGruppi: () => openSheet(gruppi),
  camGAdd: el => { const i = $id("cg1n"), n = (el.dataset.v || i?.value || "").trim(); if (!n) { i?.focus(); return; }
    if (i && !el.dataset.v) i.value = "";
    salvaCam(C => { gruppoPerNome(C, n); }, "🗂 " + n); },
  camGMove: el => { const id = el.dataset.id, d = +el.dataset.v;
    salvaCam(C => { const G = C.gruppi, i = G.findIndex(g => g.id === id), j = i + d; if (i < 0 || j < 0 || j >= G.length) return; [G[i], G[j]] = [G[j], G[i]]; }); },
  camGDel: el => { const id = el.dataset.id, n = gruppiCam().find(g => g.id === id)?.nome || "";
    salvaCam(C => { C.gruppi = C.gruppi.filter(g => g.id !== id); for (const k in C.voci) if (C.voci[k].gruppo === id) { delete C.voci[k].gruppo; pulisci(C, k); } }, "✕ " + n); },
  camGTog: el => { const g = el.dataset.g, id = el.dataset.id;
    salvaCam(C => { const v = C.voci[id] = C.voci[id] || {}; v.gruppo = v.gruppo === g ? "" : g; pulisci(C, id); }); },
});
CHG.camGRen = el => { const id = el.dataset.id, n = el.value.trim(); if (!n) { render(); return; } salvaCam(C => { const g = C.gruppi.find(x => x.id === id); if (g) g.nome = n; }); };

page("telecamere", { title: t("Telecamere", "Cameras"), short: t("Telecam.", "Cameras"), icon: "📷", order: 50, editable: true, show: () => telecamere().length > 0 || isAdminSafe(), render: pagina });
function isAdminSafe() { try { return UI.user?.is_admin && Object.keys(S).some(id => id.startsWith("camera.")); } catch { return false; } }

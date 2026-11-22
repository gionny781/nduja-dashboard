/* «✨ Cosa puoi aggiungere»: le pagine e le schede della Home che oggi non compaiono perché in casa manca quello che serve
   (Formula 1 senza i sensori della F1, Auto senza un'auto collegata, Irrigazione senza valvole…). Per ognuna: cosa fa, cosa serve,
   i passi e i link di Home Assistant per averla e, se c'è già un'entità adatta, il pulsante per sceglierla subito.
   Cosa serve lo dichiarano le pagine stesse (richiede, accanto a show(): vedi core.js). Quando arriva quello che serve
   la pagina compare da sola e la voce sparisce. «Non mi interessa» nasconde una voce per tutta la casa (LAYOUT.aggiungi.via).
   Si vede in ⚙️ Impostazioni (solo amministratori) e, più corta, in fondo alla Home in ✏️ Modifica. */
import { PAGES, HOME_EXTRA, AGGIUNGI, LAYOUT, UI, ACT, t, esc, isAdmin, openSheet, go, linkBtn } from "./core.js";
import { cambia } from "./edit.js";

/** risponde come se a guardare fosse una persona qualsiasi (non amministratore): molte pagine si mostrano sempre
    all'amministratore, anche vuote, per poterle riempire; per gli altri compaiono solo quando c'è quello che serve */
function comeUtente(f) {
  const u = UI.user;
  UI.user = { ...(u || {}), is_admin: false };
  try { return !!f(); } catch { return false; } finally { UI.user = u; }
}
const via = () => LAYOUT.aggiungi?.via || [];

/** tutte le voci con «richiede»: { k, icona, titolo, R, home (scheda della Home), aperta (l'amministratore la vede già, vuota), conScheda } */
function voci() {
  const out = [];
  for (const [k, P] of Object.entries(PAGES)) {
    if (!P.richiede || P.hiddenNav || LAYOUT.pages?.[k] === false) continue;   // spenta in Impostazioni → Pagine: l'ha scelto l'amministratore
    const manca = P.richiede.manca ? (() => { try { return !!P.richiede.manca(); } catch { return false; } })() : !comeUtente(P.show);
    if (!manca) continue;
    out.push({ k, icona: P.icon, titolo: P.title, R: P.richiede, aperta: (() => { try { return !!P.show(); } catch { return false; } })(), conScheda: !!HOME_EXTRA[k], ord: P.order });
  }
  for (const [k, H] of Object.entries(HOME_EXTRA)) {
    if (!H.richiede || out.some(v => v.k === k)) continue;
    const manca = H.richiede.manca ? (() => { try { return !!H.richiede.manca(); } catch { return false; } })() : !comeUtente(H.show);
    if (!manca) continue;
    const pg = H.richiede.pagina && PAGES[H.richiede.pagina];
    out.push({ k: "home:" + k, icona: H.richiede.icona || "🏠", titolo: H.title(), R: H.richiede, home: true, ord: (pg?.order ?? 50) + 0.01 });
  }
  /* altre cose (AGGIUNGI di core.js): dicono loro se manca qualcosa */
  for (const [k, A] of Object.entries(AGGIUNGI)) {
    const manca = (() => { try { return !!A.richiede?.manca?.(); } catch { return false; } })();
    if (!manca) continue;
    out.push({ k: "altro:" + k, icona: A.icon, titolo: A.title(), R: A.richiede, altro: A.tipo?.() || "", ord: A.ord ?? 90 });
  }
  return out.sort((a, b) => a.ord - b.ord);
}
/** pagine attive: quelle che compaiono nel menu a tutti (senza Home e Impostazioni, che ci sono sempre) */
const attive = () => Object.keys(PAGES).filter(k => !["home", "impostazioni"].includes(k) && !PAGES[k].hiddenNav && LAYOUT.pages?.[k] !== false && comeUtente(PAGES[k].show)).length;
const voce = k => voci().find(v => v.k === k);

/* ---------- disegno ---------- */
/** finto aspetto: righe [icona, titolo, sotto, valore, %] (la % disegna una barretta) */
const anteprima = A => !A?.length ? "" : `<div class="ag1p" aria-hidden="true"><em>${t("esempio", "example")}</em>${A.map(([ic, ti, so, va, pc]) => `<div class="ag1pr"><span class="ag1pi">${ic}</span><span class="tx"><b>${esc(ti)}</b>${so ? `<small>${esc(so)}</small>` : ""}${pc != null ? `<i class="ag1pb"><u style="width:${Math.max(4, Math.min(100, pc))}%"></u></i>` : ""}</span>${va ? `<span class="ag1pv">${esc(va)}</span>` : ""}</div>`).join("")}</div>`;
const tipo = v => v.altro ? v.altro : v.home ? t("Scheda della Home", "Home card") : v.conScheda ? t("Pagina e scheda della Home", "Page and Home card") : t("Pagina", "Page");
const scegliBtn = (R, cls = "") => R.scegli ? `<button class="btn sm ${cls}" data-act="${R.scegli[0]}">🔎 ${esc(R.scegli[1])}</button>` : "";
function riquadro(v) {
  const R = v.R;
  return `<div class="ag1v">
    <div class="ag1vh"><span class="ag1vi" aria-hidden="true">${v.icona}</span><div class="tx"><b>${esc(v.titolo)}</b><small>${tipo(v)}${v.aperta ? " · " + t("la vedi solo tu, ancora vuota", "only you see it, still empty") : ""}</small></div></div>
    ${anteprima(R.anteprima)}
    <p class="ag1vc">${esc(R.cosa)}</p>
    <div class="ag1vs"><span>${t("Serve", "Needs")}</span>${esc(R.serve)}</div>
    <div class="ag1vb"><button class="btn sm pri" data-act="agPassi" data-id="${esc(v.k)}">📋 ${t("Come fare", "How to")}</button>${scegliBtn(R)}
      ${v.aperta ? `<button class="btn sm" data-act="go" data-id="${esc(v.k)}">${t("Apri", "Open")} ›</button>` : ""}
      <button class="btn sm ghost ag1no" data-act="agVia" data-id="${esc(v.k)}" title="${t("Toglila da questo elenco (per tutta la casa)", "Remove it from this list (for the whole home)")}">🙈 ${t("Non mi interessa", "Not interested")}</button></div>
  </div>`;
}
/** la sezione completa (⚙️ Impostazioni, solo amministratori) */
export function aggiungiCard() {
  if (!isAdmin()) return "";
  const V = voci(), no = new Set(via()), L = V.filter(v => !no.has(v.k)), N = V.filter(v => no.has(v.k)), n = attive();
  return `<section class="card ag1" id="ag1"><div class="ch"><h2>✨ ${t("Cosa puoi aggiungere", "What you can add")}</h2></div>
    <div class="ag1n"><div><b>${n}</b><small>${n === 1 ? t("pagina attiva", "active page") : t("pagine attive", "active pages")}</small></div><div class="${L.length ? "pi" : ""}"><b>${L.length}</b><small>${L.length === 1 ? t("si può aggiungere", "can be added") : t("si possono aggiungere", "can be added")}</small></div></div>
    <p class="small muted ag1d">${t("Queste pagine e schede compaiono da sole quando in casa c'è quello che serve. Ecco cosa fanno e come averle: appena Home Assistant ha il necessario, la pagina arriva nel menu e la voce sparisce da qui.", "These pages and cards show up by themselves when your home has what they need. Here's what they do and how to get them: as soon as Home Assistant has it, the page appears in the menu and leaves this list.")}</p>
    ${L.length ? `<div class="ag1g">${L.map(riquadro).join("")}</div>` : `<div class="ag1ok">🎉 ${t("Hai già tutto: ogni pagina ha quello che le serve.", "You have it all: every page has what it needs.")}</div>`}
    ${N.length ? `<div class="fl1">🙈 ${t("Non ti interessano", "Not interested")} (${N.length})</div><div class="vr1">${N.map(v => `<button data-act="agRimetti" data-id="${esc(v.k)}" title="${t("Rimetti nell'elenco", "Put back in the list")}">↩︎ ${v.icona} ${esc(v.titolo)}</button>`).join("")}</div>` : ""}
  </section>`;
}
/** versione corta in fondo alla Home in ✏️ Modifica: un pulsante per voce, «Tutto» porta alle Impostazioni */
export function aggiungiHome() {
  if (!isAdmin() || !UI.edit) return "";
  const no = new Set(via()), L = voci().filter(v => !no.has(v.k));
  if (!L.length) return "";
  return `<section class="card span3 ag1hm"><div class="ch"><h2>✨ ${t("Cosa puoi aggiungere", "What you can add")}</h2><a data-act="agTutto">${t("Tutto", "All")} ›</a></div>
    <p class="small muted" style="margin:0 0 10px">${t("Pagine e schede che compaiono quando in casa c'è quello che serve: tocca per sapere come.", "Pages and cards that show up when your home has what they need: tap to see how.")}</p>
    <div class="vr1">${L.map(v => `<button data-act="agPassi" data-id="${esc(v.k)}">${v.icona} ${esc(v.titolo)}</button>`).join("")}</div></section>`;
}
/** i passi per avere una pagina: foglio con cosa serve, passi numerati, link di Home Assistant e scelta dell'entità */
function passi(k) {
  const v = voce(k), A = AGGIUNGI[k.replace(/^altro:/, "")], P = PAGES[k] || HOME_EXTRA[k.replace(/^home:/, "")] || (k.startsWith("altro:") && A ? { icon: A.icon, title: A.title } : null);
  /* già pronta (è arrivato quello che serve mentre il foglio era aperto) */
  if (!v) return `<div class="sh-head"><div><h3>${P?.icon || "✨"} ${esc(P?.title?.call ? P.title() : P?.title || "")}</h3></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="ag1ok">✅ ${k.startsWith("altro:") ? t("C'è tutto quello che serve: è pronto da scegliere.", "Everything it needs is there: it's ready to pick.") : t("C'è tutto quello che serve: la trovi nel menu.", "Everything it needs is there: you'll find it in the menu.")}</div>
    ${PAGES[k] ? `<button class="btn pri" data-act="go" data-id="${esc(k)}" style="margin-top:12px">${t("Apri", "Open")} ›</button>` : ""}`;
  const R = v.R;
  return `<div class="sh-head"><div><h3>${v.icona} ${esc(v.titolo)}</h3><div class="small muted">${t("Cosa serve e come averlo", "What it needs and how to get it")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <p class="ag1vc" style="margin-top:2px">${esc(R.cosa)}</p>
    <div class="ag1vs"><span>${t("Serve", "Needs")}</span>${esc(R.serve)}</div>
    ${(R.passi || []).length ? `<ol class="ag1st">${R.passi.map(p => `<li>${esc(p)}</li>`).join("")}</ol>` : ""}
    ${(R.link || []).length || R.scegli ? `<div class="ag1vb">${(R.link || []).map(([n, u], i) => linkBtn(esc(n), u, i === 0 ? "pri" : "")).join("")}${scegliBtn(R)}</div>` : ""}
    ${R.scegli ? `<p class="small muted" style="margin-top:8px">🔎 ${t("Se in Home Assistant ce l'hai già ma non l'ho riconosciuto da solo, sceglilo tu: la pagina compare subito.", "If Home Assistant already has it but I didn't recognise it, pick it yourself: the page shows up right away.")}</p>` : ""}
    <p class="small muted" style="margin-top:8px">${v.altro ? (R.quando || "") : v.home ? t("Quando c'è quello che serve, la scheda compare da sola nella Home.", "When it's there, the card shows up on Home by itself.") : t("Quando c'è quello che serve, la pagina compare da sola nel menu.", "When it's there, the page shows up in the menu by itself.")}
      ${(R.link || []).some(([, u]) => u.includes("my.home-assistant.io")) ? t(" I link «my» aprono il tuo Home Assistant: la prima volta chiedono il suo indirizzo.", " «my» links open your Home Assistant: the first time they ask for its address.") : ""}</p>`;
}

/* ---------- azioni ---------- */
const salvaVia = (k, si) => cambia(l => {
  const s = new Set(l.aggiungi?.via || []); si ? s.add(k) : s.delete(k);
  l.aggiungi = { ...(l.aggiungi || {}), via: [...s] }; if (!l.aggiungi.via.length) delete l.aggiungi.via; if (!Object.keys(l.aggiungi).length) delete l.aggiungi;
}, si ? "🙈 " + t("Tolta dall'elenco", "Removed from the list") : "↩︎ " + t("Rimessa nell'elenco", "Back in the list"));
Object.assign(ACT, {
  agPassi: el => { const k = el.dataset.id; openSheet(() => passi(k)); },
  agVia: el => salvaVia(el.dataset.id, true),
  agRimetti: el => salvaVia(el.dataset.id, false),
  agTutto: () => { UI.edit = false; go("impostazioni"); setTimeout(() => document.getElementById("ag1")?.scrollIntoView({ block: "start", behavior: "smooth" }), 350); },
});

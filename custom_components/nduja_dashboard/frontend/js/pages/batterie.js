/* Batterie: tutte le pile della casa, dalla più scarica, con stanza, tipo di pila e «da quanto non si fa sentire».
   Filtri tutte / da cambiare / per stanza, riepilogo «Ti servono: 3 × CR2032» per la spesa, «Ho cambiato la pila».
   Con ✏️ (solo admin): aggiungi un sensore, nascondi, soglie (di tutta la casa e per dispositivo), tipo di pila e nome.
   La logica (trovarle, escludere telefoni, auto e batteria di casa) è in ../batterie.js. */
import { S, AREAS, ACT, UI, t, LOC, esc, nm, attr, areasSorted, card, empty, page, render, openSheet, closeSheet, toast, isAdmin, sGet, sSet, ago, domain } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { batterie, daCambiare, prontoBatt, ordine, spesa, sogliaGlobale, confDi, conf, MUTO_GG, SOGLIA, TIPI_PILA, tTipo, isSensBatt, isBinBatt, hasBattAttr } from "../batterie.js";

const vista = () => ["tutte", "cambiare", "stanza"].includes(sGet("btVista")) ? sGet("btVista") : "tutte";
const GIORNO = 864e5;
const data = ms => new Date(ms).toLocaleDateString(LOC, { day: "numeric", month: "short", year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
const giorni = ms => Math.floor((Date.now() - ms) / GIORNO);
const fraGiorni = n => n <= 0 ? t("oggi", "today") : n === 1 ? t("ieri", "yesterday") : t(`${n} giorni fa`, `${n} days ago`);

/** icona del dispositivo dal nome (solo per riconoscerlo a colpo d'occhio) */
function icona(b) {
  const s = (b.id + " " + b.nome + " " + (attr(b.id, "friendly_name") || "")).toLowerCase(), d = domain(b.id);
  if (d === "lock" || /serratur|lock/.test(s)) return "🔒";
  return /fumo|smoke|co2?\b|monossido/.test(s) ? "🔥" : /allag|leak|perdit|water_leak|acqua/.test(s) ? "💧" : /campanell|doorbell/.test(s) ? "🔔"
    : /porta|door|finestr|window|contatt|contact|apertur/.test(s) ? "🚪" : /moviment|motion|presenz|occupan|\bpir\b/.test(s) ? "🏃"
    : /termostat|valvol|trv|radiator|termosifon/.test(s) ? "♨️" : /temperat|temp\b|_temp|igrometr|humid|umidit|clima|meteo|weather/.test(s) ? "🌡️"
    : /telecomand|remote|pulsant|button|dimmer|interrutt|switch|tasto|cube/.test(s) ? "🎛️" : /telecamer|camera|cam\b/.test(s) ? "📷"
    : /tapparell|blind|tenda|shade|cover/.test(s) ? "🪟" : /siren/.test(s) ? "🚨" : /chiav|keys?\b|tag\b|tracker|airtag|tile/.test(s) ? "🔑"
    : /bilancia|scale/.test(s) ? "⚖️" : /pianta|plant|flora|terreno|soil/.test(s) ? "🪴" : "🔋";
}
/** colore della barra: rosso sotto la soglia, arancio fino al doppio, verde sopra */
const livello = b => b.attesa ? "at" : !b.on && b.pct == null && b.bassa == null ? "nd" : b.cambiare || b.bassa ? "r" : b.pct != null && b.pct < Math.min(60, b.soglia * 2) ? "o" : "g";
function valore(b) {
  if (b.pct != null) return `<b>${Math.round(b.pct)}<small>%</small></b>`;
  if (b.bassa === true) return `<span class="bt1w">${t("Scarica", "Low")}</span>`;
  if (b.bassa === false) return `<span class="bt1w ok">${t("OK", "OK")}</span>`;
  return `<span class="bt1w nd">—</span>`;
}
/** una pila: disegno della pila, nome, stanza, tipo, ultima notizia, avvisi; in modifica ✏️ e nascondi */
function riga(b, senzaStanza = false) {
  const lv = livello(b), riemp = b.pct != null ? Math.max(3, b.pct) : b.bassa === true ? 8 : b.bassa === false ? 100 : 0;
  const sotto = [b.area && !senzaStanza ? esc(AREAS[b.area].name) : "", b.tipo ? `<em class="bt1t">${esc(tTipo(b))}</em>` : "",
    b.agg ? t("notizie ", "seen ") + esc(ago(new Date(b.agg).toISOString())) : ""].filter(Boolean).join(" · ");
  const note = [];
  if (!b.on) note.push(`<span class="bt1n r">📡 ${t("non risponde", "not responding")}</span>`);
  else if (b.muto != null && b.muto >= MUTO_GG) note.push(`<span class="bt1n o">📡 ${t(`nessuna notizia da ${b.muto} giorni: forse è scarica o scollegata`, `no news for ${b.muto} days: maybe flat or disconnected`)}</span>`);
  if (b.attesa) note.push(`<span class="bt1n">⏳ ${t("pila cambiata: aspetto la nuova lettura", "battery replaced: waiting for a new reading")}</span>`);
  else if (b.cambio) note.push(`<span class="bt1n">🔄 ${t("cambiata", "replaced")} ${esc(data(b.cambio))} · ${esc(fraGiorni(giorni(b.cambio)))}</span>`);
  const html = `<div class="li bt1 ${lv}${b.nascosta ? " hid" : ""}" data-act="more" data-id="${b.id}" role="button">
    <span class="ic">${icona(b)}</span>
    <div class="tx"><b>${esc(b.nome)}</b><span>${sotto || esc(b.id)}</span>
      <span class="bt1b" aria-hidden="true"><i style="width:${riemp}%"></i></span>${note.length ? `<span class="bt1ns">${note.join("")}</span>` : ""}</div>
    <div class="bt1v">${valore(b)}${b.pct != null || b.bassa != null ? `<small>${t("avviso", "alert")} &lt;${b.soglia}%</small>` : ""}</div>
    ${isAdmin() && b.cambiare && !UI.edit ? `<button class="btn sm bt1c" data-act="btCambiata" data-k="${esc(b.k)}">🔄 ${t("Ho cambiato la pila", "I replaced it")}</button>` : ""}
  </div>`;
  if (!UI.edit) return html;
  return `<div class="ed1">${html}<div class="edb"><button data-act="btEd" data-k="${esc(b.k)}" aria-label="${t("Modifica", "Edit")}">✏️</button>${b.nascosta
    ? `<button class="bt1sh" data-act="btMostra" data-k="${esc(b.k)}" aria-label="${t("Mostra", "Show")}">👁</button>`
    : `<button data-act="btNascondi" data-k="${esc(b.k)}" aria-label="${t("Nascondi", "Hide")}">✕</button>`}</div></div>`;
}

function riepilogo(L, D) {
  const { pile, senza } = spesa(D), mute = L.filter(b => !b.on || (b.muto != null && b.muto >= MUTO_GG)).length;
  /* la più scarica: quella col livello in % più basso; se nessuna dice la percentuale, una «bassa» sì/no */
  const peggio = [...L].filter(b => b.pct != null).sort((a, b) => a.pct - b.pct)[0] || L.find(b => b.bassa === true);
  const box = (k, v, s, cls = "") => `<div class="bt1k ${cls}"><small>${k}</small><b>${v}</b>${s ? `<span>${s}</span>` : ""}</div>`;
  return `<section class="card span3 bt1s">
    <div class="bt1ks">
      ${box("🔋 " + t("Pile", "Batteries"), L.length, t("una per dispositivo", "one per device"))}
      ${box("🪫 " + t("Da cambiare", "To replace"), D.length, D.length ? esc(D.slice(0, 2).map(b => b.nome).join(", ")) + (D.length > 2 ? "…" : "") : t("tutto a posto", "all good"), D.length ? "r" : "g")}
      ${peggio ? box("📉 " + t("La più scarica", "Lowest"), peggio.pct != null ? Math.round(peggio.pct) + "%" : "🪫", esc(peggio.nome)) : ""}
      ${box("📡 " + t("Mute", "Silent"), mute, mute ? t(`${MUTO_GG}+ giorni o spente`, `${MUTO_GG}+ days or offline`) : t("tutte si fanno sentire", "all reporting"), mute ? "o" : "")}
    </div>
    <div class="bt1sp"><span class="bt1spk">🛒 ${t("Ti servono", "You need")}</span>${D.length
      ? (pile.length ? pile.map(([k, n]) => `<span class="bt1pl"><b>${n} ×</b> ${esc(k)}</span>`).join("") : "")
        + (senza ? `<span class="muted small">${pile.length ? "+ " : ""}${senza} ${t(senza === 1 ? "pila di tipo non indicato" : "pile di tipo non indicato", senza === 1 ? "battery of unknown type" : "batteries of unknown type")}${isAdmin() ? t(" · annotalo con ✏️", " · add it with ✏️") : ""}</span>` : "")
      : `<span class="muted small">${t("niente, per ora", "nothing, for now")}</span>`}</div>
  </section>`;
}

function filtri(L, D) {
  const v = vista(), b = (k, n, c) => `<button class="${v === k ? "act" : ""}" data-act="btVista" data-v="${k}">${n}${c != null ? ` <span class="bt1fc">${c}</span>` : ""}</button>`;
  return `<div class="seg bt1f">${b("tutte", t("Tutte", "All"), L.length)}${b("cambiare", t("Da cambiare", "To replace"), D.length)}${b("stanza", t("Per stanza", "By room"))}</div>`;
}

function pagina() {
  if (!prontoBatt()) return `<div class="g g3">${card("🔋 " + t("Batterie", "Batteries"), empty(t("Cerco le pile della casa…", "Looking for the batteries in your home…")), { cls: "span3" })}</div>`;
  const T = batterie({ tutte: true }), L = T.filter(b => !b.nascosta).sort((a, b) => ordine(a) - ordine(b) || a.nome.localeCompare(b.nome, LOC)), D = L.filter(b => b.cambiare);
  const N = T.filter(b => b.nascosta), v = vista();
  const vuoto = !L.length ? card("🔋 " + t("Batterie", "Batteries"), empty(isAdmin()
    ? t("Non ho trovato pile da seguire. Premi ✏️ Modifica in alto per aggiungere un sensore.", "I found no batteries to follow. Press ✏️ Edit at the top to add a sensor.")
    : t("Non ho trovato pile da seguire.", "I found no batteries to follow.")), { cls: "span3" }) : "";
  let corpo = "";
  if (L.length) {
    const testa = `<div class="ch"><h2>${v === "cambiare" ? "🪫 " + t("Da cambiare", "To replace") : "🔋 " + t("Tutte le pile", "All batteries")}</h2>${filtri(L, D)}</div>`;
    if (v === "stanza") {
      const g = {}; L.forEach(b => (g[b.area || "_"] = g[b.area || "_"] || []).push(b));
      const zone = [...areasSorted(true).filter(a => g[a]), ...(g._ ? ["_"] : [])];
      corpo = `<section class="card span3 bt1sec bt1h"><div class="ch"><h2>🏠 ${t("Per stanza", "By room")}</h2>${filtri(L, D)}</div></section>`
        + zone.map(a => card(`${esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name)} <span class="tag ${g[a].some(b => b.cambiare) ? "bad" : "ok"}">${g[a].filter(b => b.cambiare).length || "✓"}</span>`,
          `<div class="stack">${g[a].map(b => riga(b, true)).join("")}</div>`)).join("");
    } else {
      const M = v === "cambiare" ? D : L;
      corpo = `<section class="card span3 bt1sec">${testa}${M.length ? `<div class="bt1l">${M.map(b => riga(b)).join("")}</div>`
        : empty("✅ " + t("Nessuna pila da cambiare. Le avviso io quando scendono sotto la soglia.", "No battery to replace. I'll tell you when they drop below the threshold."))}</section>`;
    }
  }
  const modifica = UI.edit && isAdmin() ? `<section class="card span3 bt1e">
      <div class="ch"><h2>✏️ ${t("Scelte delle batterie", "Battery settings")}</h2></div>
      <div class="bt1er">
        <label class="fld1"><span>${t("Avvisami quando una pila scende sotto il", "Alert me when a battery drops below")}</span>
          <span class="row" style="gap:8px"><input id="bt1sg" type="number" min="1" max="99" step="1" inputmode="numeric" value="${sogliaGlobale()}" style="width:96px"><b>%</b>
          <button class="btn sm" data-act="btSoglia">💾 ${t("Salva", "Save")}</button></span></label>
        <p class="small muted">${t(`Vale per tutta la casa (predefinita: ${SOGLIA}%). Puoi cambiarla per un solo dispositivo con ✏️. La usano anche gli avvisi della Home e quelli sul telefono.`, `Applies to the whole home (default ${SOGLIA}%). Change it for a single device with ✏️. Home and phone alerts use it too.`)}</p>
      </div>
      <button class="add1 wide1" data-act="btAggiungi"><span>＋</span>${t("Aggiungi un sensore di batteria", "Add a battery sensor")}</button>
      ${N.length ? `<div class="fl1">👁 ${t("Nascoste", "Hidden")} (${N.length})</div><div class="bt1l">${N.sort((a, b) => a.nome.localeCompare(b.nome, LOC)).map(b => riga(b)).join("")}</div>` : ""}
    </section>` : "";
  return `<div class="g g3">${L.length ? riepilogo(L, D) : ""}${vuoto}${corpo}${modifica}</div>`;
}

/* ---------- ✏️ di una pila ---------- */
function scheda(k) {
  const b = batterie({ tutte: true }).find(x => x.k === k);
  if (!b) return `<div class="sh-head"><div><h3>🔋</h3></div><button class="x" data-act="sheetClose">×</button></div>${empty("—")}`;
  const c = confDi(k);
  return `<div class="sh-head"><div><h3>✏️ ${esc(b.nome)}</h3><div class="small muted mono">${esc(b.ids.join(" · "))}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="bt1n" type="text" value="${esc(c.nome || "")}" placeholder="${esc(b.nome)}"></label>
    <div class="bt1g2">
      <label class="fld1"><span>${t("Tipo di pila", "Battery type")}</span><input id="bt1t" type="text" list="bt1tl" maxlength="20" value="${esc(c.tipo || "")}" placeholder="${t("es. CR2032, AA…", "e.g. CR2032, AA…")}" autocomplete="off">
        <datalist id="bt1tl">${TIPI_PILA.map(x => `<option value="${x}">`).join("")}</datalist></label>
      <label class="fld1"><span>${t("Quante", "How many")}</span><input id="bt1q" type="number" min="1" max="12" step="1" inputmode="numeric" value="${b.qta}"></label>
    </div>
    <div class="bt1tp">${TIPI_PILA.slice(0, 9).map(x => `<button class="${(c.tipo || "").toUpperCase() === x ? "act" : ""}" data-act="btTipo" data-v="${x}">${x}</button>`).join("")}</div>
    <label class="fld1"><span>${t("Avvisami sotto il (%)", "Alert me below (%)")}</span><input id="bt1s" type="number" min="1" max="99" step="1" inputmode="numeric" value="${esc(c.soglia || "")}" placeholder="${t("come tutta la casa", "same as the whole home")} (${sogliaGlobale()}%)"></label>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn pri" data-act="btSalva" data-k="${esc(k)}">💾 ${t("Salva", "Save")}</button>
      <button class="btn" data-act="btCambiata" data-k="${esc(k)}">🔄 ${t("Ho cambiato la pila oggi", "Replaced it today")}</button>
      ${b.nascosta ? `<button class="btn" data-act="btMostra" data-k="${esc(k)}">👁 ${t("Mostra di nuovo", "Show again")}</button>` : `<button class="btn bad" data-act="btNascondi" data-k="${esc(k)}">✕ ${t("Nascondi", "Hide")}</button>`}
      ${b.extra ? `<button class="btn bad" data-act="btTogli" data-k="${esc(k)}">🗑 ${t("Togli il sensore aggiunto", "Remove added sensor")}</button>` : ""}
    </div>
    ${b.cambio ? `<p class="small muted" style="margin-top:12px">🔄 ${t("Ultimo cambio", "Last replaced")}: ${esc(data(b.cambio))} (${esc(fraGiorni(giorni(b.cambio)))}) · <a class="lnk" data-act="btCambioVia" data-k="${esc(k)}">${t("cancella", "clear")}</a></p>` : ""}
    <p class="small muted" style="margin-top:12px">${t("Nome, tipo e soglie valgono per tutta la casa e solo nella plancia.", "Name, type and thresholds apply to the whole home and only in the dashboard.")}</p>`;
}

/* ---------- salvataggi (LAYOUT.batterie, solo admin) ---------- */
const salvaB = (fn, msg) => cambia(l => { const B = l.batterie = JSON.parse(JSON.stringify(l.batterie || {})); B.d = B.d || {}; fn(B); for (const k of Object.keys(B.d)) if (!Object.keys(B.d[k]).length) delete B.d[k]; }, msg);
const pulisci = o => { for (const k of Object.keys(o)) if (o[k] == null || o[k] === "") delete o[k]; return o; };
const nomeK = k => batterie({ tutte: true }).find(b => b.k === k)?.nome || k;
const numero = (v, min, max) => { const n = Math.round(+v); return v !== "" && n >= min && n <= max ? n : null; };
/** candidati per «＋ Aggiungi»: % di batteria, «batteria bassa», battery_level e qualsiasi sensore in % che non è già nell'elenco */
function candidato(id) {
  if (!S[id]) return false;
  const gia = new Set(batterie({ tutte: true }).flatMap(b => b.ids));
  if (gia.has(id)) return false;
  if (isSensBatt(id) || isBinBatt(id) || hasBattAttr(id)) return true;
  if (id.startsWith("sensor.") && attr(id, "unit_of_measurement") === "%") return true;
  return id.startsWith("binary_sensor.") && /batter|pila|low_bat|bassa/i.test(id + " " + nm(id));
}

Object.assign(ACT, {
  btVista: el => { sSet("btVista", el.dataset.v); render(); },
  btEd: el => { const k = el.dataset.k; openSheet(() => scheda(k)); },
  btTipo: el => { const i = document.getElementById("bt1t"); if (i) { i.value = el.dataset.v; } document.querySelectorAll(".bt1tp button").forEach(x => x.classList.toggle("act", x === el)); },
  btSalva: el => {
    const k = el.dataset.k, nome = document.getElementById("bt1n").value.trim(), tipo = document.getElementById("bt1t").value.trim().toUpperCase().replace(/\s+/g, " ");
    const qta = numero(document.getElementById("bt1q").value, 1, 12), sv = document.getElementById("bt1s").value.trim(), soglia = numero(sv, 1, 99);
    if (sv && soglia == null) return toast(t("La soglia va da 1 a 99%", "The threshold goes from 1 to 99%"), true);
    closeSheet();
    salvaB(B => { B.d[k] = pulisci({ ...(B.d[k] || {}), nome: nome || null, tipo: tipo || null, qta: qta > 1 ? qta : null, soglia }); }, "💾 " + (nome || nomeK(k)));
  },
  btCambiata: el => {
    const k = el.dataset.k, n = nomeK(k);
    if (UI.sheet) closeSheet();
    salvaB(B => { B.d[k] = { ...(B.d[k] || {}), cambio: new Date().toISOString() }; }, "🔄 " + t(`Pila cambiata: ${n}`, `Battery replaced: ${n}`));
  },
  btCambioVia: el => { const k = el.dataset.k; closeSheet(); salvaB(B => { if (B.d[k]) delete B.d[k].cambio; }); },
  btNascondi: el => { const k = el.dataset.k; if (UI.sheet) closeSheet(); salvaB(B => { B.nascosti = [...new Set([...(B.nascosti || []), k])]; }, "✕ " + nomeK(k)); },
  btMostra: el => { const k = el.dataset.k; if (UI.sheet) closeSheet(); salvaB(B => { B.nascosti = (B.nascosti || []).filter(x => x !== k); }, "👁 " + nomeK(k)); },
  btTogli: el => {
    const k = el.dataset.k, b = batterie({ tutte: true }).find(x => x.k === k); closeSheet();
    salvaB(B => { B.extra = (B.extra || []).filter(id => !b?.ids.includes(id)); }, "🗑 " + nomeK(k));
  },
  btSoglia: () => {
    const v = numero(document.getElementById("bt1sg").value.trim(), 1, 99);
    if (v == null) return toast(t("La soglia va da 1 a 99%", "The threshold goes from 1 to 99%"), true);
    salvaB(B => { if (v === SOGLIA) delete B.soglia; else B.soglia = v; }, "💾 " + t(`Avviso sotto il ${v}%`, `Alert below ${v}%`));
  },
  btAggiungi: () => scegli({ titolo: "＋ " + t("Sensore di batteria", "Battery sensor"), sotto: t("Livello della pila in %, «batteria bassa» sì/no o un dispositivo con il livello della batteria.", "Battery level in %, «battery low» yes/no or a device with a battery level."),
    filtro: candidato, auto: false, onPick: id => { if (id && S[id]) salvaB(B => { B.extra = [...new Set([...(B.extra || []), id])]; B.nascosti = (B.nascosti || []).filter(x => x !== id); }, "＋ " + nm(id)); } }),
});

page("batterie", { title: t("Batterie", "Batteries"), short: t("Batterie", "Batteries"), icon: "🔋", order: 31, editable: true,
  /* finché non so cosa escludere (un attimo dopo l'avvio) basta che in casa ci sia una batteria qualsiasi */
  show: () => prontoBatt() ? batterie({ tutte: true }).length > 0 || (conf().extra || []).length > 0 : Object.keys(S).some(id => isSensBatt(id) || isBinBatt(id) || hasBattAttr(id)), badge: () => daCambiare().length > 0, render: pagina });

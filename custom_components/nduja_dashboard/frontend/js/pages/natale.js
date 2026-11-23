/* 🎄 Natale: le cose smart della festa, solo nel periodo di Natale (dal 1° dicembre al 6 gennaio, date regolabili in ⚙️ → Natale).
   - L'albero (Twinkly o la luce scelta) disegnato al centro, che si accende come quello vero: colore, luminosità, effetto;
     intorno, come piccole icone, il presepe e le altre luci di festa. Comandi grandi: accendi o spegni tutto il Natale, l'albero,
     luminosità, colore, modalità (movie, color, effect, playlist…) ed effetti del Twinkly.
   - Le altre luci e prese di festa si trovano da sole (natale, albero, presepe, xmas, festa, luminarie, addobbi, stella, ghirlanda…
     nel nome, nella stanza o nelle etichette) e si correggono in ✏️: ＋ aggiungi, ✕ togli.
   - Orari: «accendi al tramonto» (o a un'ora) e «spegni alle…», solo nel periodo: automazione «'Nduja · luci di Natale» creata dalla
     plancia, che si riscrive da sola quando cambiano luci, orari o date.
   - Conto alla rovescia, scheda della Home (HOME_EXTRA) e «✨ Cosa puoi aggiungere» (AGGIUNGI) se non c'è nessuna luce di festa.
   Fuori periodo la pagina non è nel menu, ma l'amministratore la apre da ⚙️ Impostazioni → Natale per prepararla.
   Scelte della casa in LAYOUT.natale: { da, a, vista, albero, modo, luci:[], tolte:[], orari:{ on, acc, rit, ora, sp, firma } }. */
import { S, ACT, CHG, UI, LAYOUT, PAGES, HOME_EXTRA, AGGIUNGI, HOOKS, t, LOC, esc, nm, ok, attr, card, page, svc, toast, openSheet, closeSheet,
  render, go, isAdmin, api, etichettaNduja, luciComando, pronto, linkIntegrazione, hhmm } from "../core.js";
import { scegli, cambia } from "../edit.js";
import { NC, DA, A, inizio, fine, inPeriodo, vista, inMenu, dataTesto, conto, oreAlNatale, albero, modoDi, luciFesta, tutteFesta, haQualcosa,
  statoAlbero, nomeEffetto, alberoSVG, iconaFesta, luciAuto } from "../festa.js";

/* ================= valori ================= */
const modi = id => attr(id, "supported_color_modes") || [];
const regolabile = id => id?.startsWith("light.") && modi(id).some(m => m !== "onoff");
const aColori = id => id?.startsWith("light.") && modi(id).some(m => ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(m));
const accesa = id => ok(id) && S[id].state === "on";
const NOMI_MODO = () => ({ movie: t("Animazione", "Movie"), color: t("Colore fisso", "Solid colour"), effect: t("Effetto", "Effect"), playlist: "Playlist",
  demo: t("Dimostrazione", "Demo"), rt: t("Tempo reale", "Real time"), off: t("Spento", "Off") });
const nomeModo = m => NOMI_MODO()[m] || m;
const ICO_MODO = { movie: "🎞️", color: "🎨", effect: "✨", playlist: "🔁", demo: "🎪", rt: "📡", off: "⏻" };
/* colori di festa per il pulsante «Colore» */
const COLORI = () => [["#ffcf72", t("Bianco caldo", "Warm white")], ["#ff3b30", t("Rosso", "Red")], ["#ffb000", t("Oro", "Gold")], ["#30d158", t("Verde", "Green")],
  ["#64d2ff", t("Ghiaccio", "Ice")], ["#5e5ce6", t("Blu", "Blue")], ["#ff6fb1", t("Rosa", "Pink")], ["#ffffff", t("Bianco", "White")]];
const rgbDa = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/* ================= pagina ================= */
function stato(st) {
  if (!st) return "";
  if (!st.disp) return t("Staccato o spento dalla presa", "Unplugged or switched off at the socket");
  if (!st.on) return t("Spento", "Off");
  const p = [t("Acceso", "On")];
  if (regolabile(st.id)) p.push(Math.round(st.bri * 100) + "%");
  if (st.modo && st.modo !== "off") p.push(nomeModo(st.modo) + (["movie", "effect"].includes(st.modo) && st.eff ? " · " + nomeEffetto(st.eff) : ""));
  else if (st.eff) p.push(nomeEffetto(st.eff));
  return p.join(" · ");
}
/** «Mancano 12 giorni a Natale» (discreto, in alto) */
const contoPill = () => { const d = new Date(), c = conto(d), tx = c.k === "vigilia" && d.getHours() >= 18 ? oreAlNatale(c.ms) : c.testo;
  return `<span class="na1cd ${c.k}">${c.k === "natale" ? "🎁" : c.k === "feste" ? "✨" : c.k === "vigilia" ? "🌟" : "⏳"} ${esc(tx)}</span>`; };
/* le piccole icone attorno all'albero (al massimo 6: le altre sono nell'elenco) */
function chip(id) {
  const on = accesa(id), na = !ok(id);
  return `<button class="na1ch ${on ? "on" : ""} ${na ? "na" : ""}" data-act="natTg" data-id="${id}" title="${esc(nm(id))}"><span class="i">${iconaFesta(id)}</span><small>${esc(nm(id))}</small></button>`;
}
function eroe() {
  const al = albero(), st = statoAlbero(al), L = luciFesta(), T = tutteFesta(), onN = T.filter(accesa).length, ch = L.slice(0, 6);
  const sx = ch.filter((_, i) => i % 2 === 0), dx = ch.filter((_, i) => i % 2 === 1), mod = UI.edit && isAdmin();
  const titolo = al ? nm(al) : t("Il tuo Natale", "Your Christmas");
  return `<section class="card span3 na1h ${st?.on ? "acceso" : ""}">
    <div class="na1t"><div><h2>${esc(titolo)}</h2><p class="${st && !st.disp ? "na1off" : ""}">${al ? esc(stato(st)) : esc(T.length ? t(`${onN} di ${T.length} luci di festa accese`, `${onN} of ${T.length} festive lights on`) : t("Nessuna luce di festa, per ora", "No festive lights yet"))}</p></div>${contoPill()}</div>
    <div class="na1b">
      <div class="na1sc"><div class="na1cl">${sx.map(chip).join("")}</div>
        <div class="na1al ${al ? "" : "dec"}" ${al && st?.disp ? `data-act="natTg" data-id="${al}" role="button" aria-label="${esc(t("Accendi o spegni l'albero", "Turn the tree on or off"))}"` : ""}>${alberoSVG(al ? st : null, { uid: "pg" })}${al && !st.disp ? `<span class="na1pl">🔌</span>` : ""}</div>
        <div class="na1cl">${dx.map(chip).join("")}</div></div>
      <div class="na1cm">
        ${T.length ? `<div class="na1gr"><button class="btn na1big on" data-act="natTutto" data-v="1">🎄 ${t("Accendi tutto il Natale", "Turn on all of Christmas")}</button>
          <button class="btn na1big" data-act="natTutto" data-v="0">⏻ ${t("Spegni tutto", "Turn everything off")}</button></div>
          <p class="small muted na1n">${t(`${onN} di ${T.length} accese`, `${onN} of ${T.length} on`)}${T.some(id => !ok(id)) ? " · " + t(`${T.filter(id => !ok(id)).length} non raggiungibili`, `${T.filter(id => !ok(id)).length} unreachable`) : ""}</p>` : ""}
        ${al ? comandiAlbero(st) : `<div class="na1vuoto">${t("Non trovo l'albero: se hai un Twinkly collegalo a Home Assistant, oppure scegli tu la luce dell'albero.", "I can't find the tree: if you have a Twinkly connect it to Home Assistant, or pick the tree light yourself.")}
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">${isAdmin() ? `<button class="btn sm" data-act="natAlberoSc">🎄 ${t("Scegli l'albero", "Pick the tree")}</button>` : ""}<a class="btn sm" href="${esc(linkIntegrazione("twinkly"))}" target="_blank" rel="noopener">↗ Twinkly</a></div></div>`}
        ${mod ? `<div class="na1ed"><button class="btn sm" data-act="natAlberoSc">🎄 ${t("Albero", "Tree")}: ${al ? esc(nm(al)) : t("nessuno", "none")}</button>${al ? `<button class="btn sm" data-act="natModoSc">🎛️ ${t("Modalità", "Mode")}: ${modoDi(al) ? esc(nm(modoDi(al))) : t("nessuna", "none")}</button>` : ""}<button class="btn sm" data-act="natCfg">⚙️ ${t("Periodo", "Season")}</button></div>` : ""}
      </div></div></section>`;
}
function comandiAlbero(st) {
  const id = st.id;
  if (!st.disp) return `<div class="na1vuoto">🔌 ${t("L'albero è staccato o spento dalla presa: quando lo riaccendi, qui tornano i comandi.", "The tree is unplugged or switched off at the socket: when you switch it back on, the controls come back here.")}</div>`;
  return `<div class="na1rw"><span>🎄 ${t("Albero", "Tree")}</span><button class="sw ${st.on ? "on" : ""}" data-act="natTg" data-id="${id}" aria-label="${esc(nm(id))}"><i></i></button></div>
    ${st.on && regolabile(id) ? `<div class="na1rw"><span>☀︎ ${t("Luminosità", "Brightness")}</span><input type="range" min="1" max="100" value="${Math.max(1, Math.round(st.bri * 100))}" data-chg="natBri" data-id="${id}" aria-label="${t("Luminosità", "Brightness")}"><b>${Math.round(st.bri * 100)}%</b></div>` : ""}
    ${st.on && aColori(id) ? `<div class="na1rw na1cw"><span>🎨 ${t("Colore", "Colour")}</span><div class="na1sw">${COLORI().map(([h, n]) => `<button style="--c:${h}" class="${st.rgb && !st.anim && Math.abs(rgbDa(h).reduce((a, v, i) => a + Math.abs(v - st.rgb[i]), 0)) < 40 ? "on" : ""}" data-act="natCol" data-v="${h}" data-id="${id}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join("")}</div></div>` : ""}`;
}
/** modalità ed effetti del Twinkly (a pulsanti) */
function effettiCard() {
  const al = albero(), st = statoAlbero(al); if (!st) return "";
  const mo = modoDi(al), O = mo ? (attr(mo, "options") || []).filter(o => o !== "rt" || S[mo].state === "rt") : [], E = attr(al, "effect_list") || [];
  if (!O.length && !E.length) return "";
  const spento = !st.disp;
  return card(`✨ ${t("Modalità ed effetti", "Modes and effects")}`, `${spento ? `<p class="small muted" style="margin:-4px 0 10px">${t("Si scelgono quando l'albero è collegato.", "You can pick them when the tree is connected.")}</p>` : ""}
    ${O.length ? `<div class="fl1" style="margin-top:0">${t("Modalità", "Mode")}</div><div class="na1md">${O.map(o => `<button class="${st.modo === o ? "on" : ""}" data-act="natModo" data-v="${esc(o)}" ${spento ? "disabled" : ""}><span>${ICO_MODO[o] || "•"}</span>${esc(nomeModo(o))}</button>`).join("")}</div>` : ""}
    ${E.length ? `<div class="fl1">${t("Effetti", "Effects")}</div><div class="na1ef">${E.map(e => `<button class="${st.eff === e && st.anim ? "on" : ""}" data-act="natEff" data-v="${esc(e)}" ${spento ? "disabled" : ""}>${esc(nomeEffetto(e))}</button>`).join("")}</div>
      <p class="small muted" style="margin-top:8px">${t("Toccando un effetto l'albero passa da solo alla modalità «Animazione».", "Tapping an effect switches the tree to «Movie» mode by itself.")}</p>` : ""}`, { cls: "span2 na1fx" });
}
/** le altre luci e prese di festa */
function luciCard() {
  const L = luciFesta(), mod = UI.edit && isAdmin(), via = (NC().tolte || []).filter(id => S[id]);
  if (!L.length && !mod) return "";
  return card(`💡 ${t("Luci di festa", "Festive lights")}`, `<div class="stack">${L.map(id => { const on = accesa(id), na = !ok(id);
      return `<div class="li ${na ? "dis" : ""}"><span class="ic">${iconaFesta(id)}</span><div class="tx"><b>${esc(nm(id))}</b><span>${na ? t("non raggiungibile", "unreachable") : on ? t("accesa", "on") : t("spenta", "off")}${(NC().luci || []).includes(id) ? " · " + t("aggiunta da te", "added by you") : ""}</span></div>
        ${mod ? `<button class="btn sm" data-act="natTogli" data-id="${id}" aria-label="${t("Togli", "Remove")}">✕</button>` : na ? "" : `<button class="sw ${on ? "on" : ""}" data-act="natTg" data-id="${id}" aria-label="${esc(nm(id))}"><i></i></button>`}</div>`; }).join("")
      || `<div class="small muted">${t("Nessuna, per ora.", "None yet.")}</div>`}</div>
    ${mod ? `<button class="add1 wide1" data-act="natAdd" style="margin-top:10px"><span>＋</span>${t("Aggiungi una luce o una presa", "Add a light or a plug")}</button>
      <p class="small muted" style="margin-top:8px">${t("Le trovo da sole dal nome, dalla stanza o dalle etichette (natale, albero, presepe, luminarie, addobbi, stella, ghirlanda…). Con ✕ togli quelle sbagliate.", "I find them by name, room or labels (christmas, tree, nativity, lights, decorations, star, garland…). Remove wrong ones with ✕.")}</p>
      ${via.length ? `<div class="fl1">🙈 ${t("Tolte", "Removed")}</div><div class="vr1">${via.map(id => `<button data-act="natRimetti" data-id="${id}">↩︎ ${esc(nm(id))}</button>`).join("")}</div>` : ""}` : ""}`, { cls: "na1lc" });
}

/* ================= ⏰ orari: automazione «'Nduja · luci di Natale» ================= */
const AUT = "nduja_natale";
const OR = () => ({ acc: "tramonto", rit: 0, ora: "17:30", sp: "23:30", ...(NC().orari || {}) });
const oraOk = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
const automazioneEnt = () => Object.keys(S).find(e => e.startsWith("automation.") && attr(e, "id") === AUT) || null;
const ritTxt = m => !m ? t("al tramonto", "at sunset") : m < 0 ? t(`${-m} min prima del tramonto`, `${-m} min before sunset`) : t(`${m} min dopo il tramonto`, `${m} min after sunset`);
const accTxt = o => o.acc === "ora" && oraOk(o.ora) ? t("alle ", "at ") + o.ora : ritTxt(+o.rit || 0);
/** il giorno è nel periodo (per lo spegnimento conta il giorno di 12 ore fa: così le luci si spengono anche dopo mezzanotte e l'ultima sera) */
const periodoTpl = (ore = 0) => { const a = inizio(), b = fine(), d = ore ? `(now() - timedelta(hours=${ore})).strftime('%m-%d')` : "now().strftime('%m-%d')";
  return `{% set d = ${d} %}{{ ${a <= b ? `'${a}' <= d <= '${b}'` : `d >= '${a}' or d <= '${b}'`} }}`; };
const perDominio = (L, s) => ["light", "switch"].map(d => [d, L.filter(id => id.startsWith(d + "."))]).filter(([, x]) => x.length)
  .map(([d, x]) => ({ action: `${d}.${s}`, target: { entity_id: x }, continue_on_error: true }));
function automazione(o = OR()) {
  const L = tutteFesta(); if (!L.length) return null;
  const rit = Math.round(+o.rit || 0), off = `${rit < 0 ? "-" : ""}${String(Math.floor(Math.abs(rit) / 60)).padStart(2, "0")}:${String(Math.abs(rit) % 60).padStart(2, "0")}:00`;
  const tr = [o.acc === "ora" && oraOk(o.ora) ? { trigger: "time", at: o.ora + ":00", id: "accendi" } : { trigger: "sun", event: "sunset", offset: off, id: "accendi" }];
  if (oraOk(o.sp)) tr.push({ trigger: "time", at: o.sp + ":00", id: "spegni" });
  const ch = [{ conditions: [{ condition: "trigger", id: "accendi" }, { condition: "template", value_template: periodoTpl() }], sequence: perDominio(L, "turn_on") }];
  if (oraOk(o.sp)) ch.push({ conditions: [{ condition: "trigger", id: "spegni" }, { condition: "template", value_template: periodoTpl(12) }], sequence: perDominio(L, "turn_off") });
  return { id: AUT, alias: "'Nduja · " + t("luci di Natale", "Christmas lights"),
    description: t(`Creata da 'Nduja Dashboard (pagina Natale): accende le luci di festa ${accTxt(o)}${oraOk(o.sp) ? " e le spegne alle " + o.sp : ""}, solo dal ${dataTesto(inizio())} al ${dataTesto(fine())}. Si aggiorna da sola quando cambi luci, orari o date nella plancia.`,
      `Created by 'Nduja Dashboard (Christmas page): turns the festive lights on ${accTxt(o)}${oraOk(o.sp) ? " and off at " + o.sp : ""}, only from ${dataTesto(inizio())} to ${dataTesto(fine())}. It updates itself when you change lights, times or dates in the dashboard.`),
    triggers: tr, conditions: [], actions: [{ choose: ch }], mode: "single" };
}
/** impronta di quello che fa (senza i testi, che dipendono dalla lingua di chi salva) */
const firma = c => { let h = 7; for (const x of JSON.stringify([c.triggers, c.actions])) h = (Math.imul(h, 31) + x.charCodeAt(0)) >>> 0; return h.toString(36); };
let scrivendo = false, ultimo = 0;
/** orari attivi e qualcosa è cambiato (luci, orari, date): riscrivo l'automazione. forza = anche se l'impronta è uguale (Ricrea) */
async function riscrivi(forza) {
  const o = NC().orari; if (!isAdmin() || !o?.on || scrivendo) return;
  const c = automazione(); if (!c) return;
  const f = firma(c); if (!forza && f === o.firma) return;
  scrivendo = true;
  try {
    const nuova = !automazioneEnt();
    await api("POST", "/api/config/automation/config/" + AUT, c);
    if (nuova) etichettaNduja(automazioneEnt);
    await cambia(l => { l.natale = { ...(l.natale || {}), orari: { ...(l.natale?.orari || {}), firma: f } }; });
  } catch (e) { toast(t("Home Assistant non ha accettato l'automazione: ", "Home Assistant refused the automation: ") + (e.message || e), true); }
  finally { scrivendo = false; ultimo = Date.now(); }
}
/* le luci trovate da sole possono cambiare (nuove luci, nomi, etichette): controllo ogni tanto, solo l'amministratore */
HOOKS.push(() => { if (isAdmin() && pronto() && NC().orari?.on && !scrivendo && Date.now() - ultimo > 20000) { ultimo = Date.now(); setTimeout(() => riscrivi(), 0); } });

function orariCard() {
  if (!haQualcosa()) return "";
  const o = OR(), on = !!NC().orari?.on, e = automazioneEnt(), adm = isAdmin();
  const riassunto = on ? t(`Si accendono ${accTxt(o)}${oraOk(o.sp) ? ", si spengono alle " + o.sp : ""}.`, `They turn on ${accTxt(o)}${oraOk(o.sp) ? ", off at " + o.sp : ""}.`) : t("Le accendi e le spegni tu.", "You turn them on and off yourself.");
  const ult = e && attr(e, "last_triggered") ? t(" · ultima volta ", " · last run ") + new Date(attr(e, "last_triggered")).toLocaleDateString(LOC, { weekday: "short", day: "numeric" }) + " " + hhmm(attr(e, "last_triggered")) : "";
  if (!adm) return card(`⏰ ${t("Orari", "Schedule")}`, `<p class="small">${esc(riassunto)}</p>`, { cls: "na1or" });
  const rit = [-60, -45, -30, -15, 0, 15, 30, 45, 60, 90];
  return card(`⏰ ${t("Orari delle luci", "Light schedule")}`, `<div class="na1rw"><span>${t("Accendi e spegni da sole", "Turn on and off by themselves")}</span><button class="sw ${on ? "on" : ""}" data-act="natOrOn" aria-label="${t("Orari", "Schedule")}"><i></i></button></div>
    ${on ? `<div class="sz1o"><span>${t("Accendi", "Turn on")}</span>${seg("natAcc", o.acc === "ora" ? "ora" : "tramonto", [["tramonto", "🌇 " + t("Al tramonto", "At sunset")], ["ora", "🕐 " + t("A un'ora", "At a time")]])}</div>
      <div class="row na1hr">${o.acc === "ora" ? `<label>${t("alle", "at")} <input type="time" value="${esc(oraOk(o.ora) ? o.ora : "17:30")}" data-chg="natOra"></label>`
        : `<label><select data-chg="natRit">${rit.map(m => `<option value="${m}" ${(+o.rit || 0) === m ? "selected" : ""}>${esc(ritTxt(m))}</option>`).join("")}</select></label>`}</div>
      <div class="sz1o"><span>${t("Spegni", "Turn off")}</span>${seg("natSpM", oraOk(o.sp) ? "1" : "0", [["1", "🌙 " + t("A un'ora", "At a time")], ["0", t("Mai, le spengo io", "Never, I do it")]])}</div>
      ${oraOk(o.sp) ? `<div class="row na1hr"><label>${t("alle", "at")} <input type="time" value="${esc(o.sp)}" data-chg="natSp"></label></div>` : ""}
      <p class="small muted" style="margin-top:10px">${t(`Solo nel periodo di festa (dal ${dataTesto(inizio())} al ${dataTesto(fine())}), per l'albero e le ${luciFesta().length} luci di festa. Lo fa l'automazione «'Nduja · luci di Natale» in Home Assistant, anche a plancia chiusa: si aggiorna da sola quando cambi qualcosa qui.`, `Only in the festive season (${dataTesto(inizio())} to ${dataTesto(fine())}), for the tree and the ${luciFesta().length} festive lights. The «'Nduja · Christmas lights» automation in Home Assistant does it, even with the dashboard closed: it updates by itself when you change something here.`)}</p>
      <div class="na1st">${e ? `${S[e].state === "on" ? "✅ " + t("Automazione attiva", "Automation on") : "⏸ " + t("Automazione in pausa in Home Assistant", "Automation paused in Home Assistant")}${esc(ult)}`
        : `⚠️ ${t("L'automazione non c'è in Home Assistant", "The automation isn't in Home Assistant")} <button class="btn sm" data-act="natRicrea">↻ ${t("Ricrea", "Recreate")}</button>`}</div>`
      : `<p class="small muted" style="margin-top:8px">${t("Accendile al tramonto (o a un'ora che scegli) e spegnile a un'ora, solo nel periodo di festa. Creo io l'automazione in Home Assistant.", "Turn them on at sunset (or a time you pick) and off at a time, only in the festive season. I create the automation in Home Assistant.")}</p>`}`, { cls: "na1or" });
}
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, n]) => `<button class="${String(cur) === String(k) ? "act" : ""}" data-act="${act}" data-v="${k}">${n}</button>`).join("")}</div>`;

function pagina() {
  const fuori = !inMenu();
  return `<div class="g g3 na1">
    ${fuori && isAdmin() ? `<section class="card span3 na1fu"><b>🗓️ ${t("Fuori dal periodo di festa", "Outside the festive season")}</b><span>${t(`Questa pagina compare nel menu dal ${dataTesto(inizio())} al ${dataTesto(fine())}. Intanto puoi prepararla: la vedi solo tu.`, `This page shows in the menu from ${dataTesto(inizio())} to ${dataTesto(fine())}. Meanwhile you can get it ready: only you see it.`)}</span><button class="btn sm" data-act="natCfg">⚙️ ${t("Periodo", "Season")}</button></section>` : ""}
    ${eroe()}${effettiCard()}${luciCard()}${orariCard()}</div>`;
}

/* ================= ⚙️ periodo (anche da Impostazioni → Natale) ================= */
const MESI = () => Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(LOC, { month: "long" }));
const giorniMese = m => new Date(2024, m, 0).getDate();
function selData(k, v) {
  const [m, g] = v.split("-").map(Number);
  return `<span class="na1dt"><select data-chg="natData" data-k="${k}" data-p="g" aria-label="${t("Giorno", "Day")}">${Array.from({ length: giorniMese(m) }, (_, i) => `<option ${i + 1 === g ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
    <select data-chg="natData" data-k="${k}" data-p="m" aria-label="${t("Mese", "Month")}">${MESI().map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></span>`;
}
function schedaPeriodo() {
  const v = vista(), predef = inizio() === DA && fine() === A;
  return `<div class="sh-head"><div><h3>🎄 ${t("Natale", "Christmas")}</h3><div class="small muted">${t("Quando compare la pagina delle luci di festa. Vale per tutta la casa.", "When the festive lights page shows up. It applies to the whole home.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="fl1">${t("La pagina e la scheda della Home", "The page and the Home card")}</div>
    ${seg("natVista", v, [["auto", "✨ " + t("Automatico", "Automatic")], ["sempre", "👁️ " + t("Mostra sempre", "Always show")], ["mai", "🙈 " + t("Nascondi sempre", "Always hide")]])}
    <p class="small muted" style="margin-top:8px">${v === "auto" ? t("Compaiono da sole nel periodo di festa e spariscono dopo.", "They show up by themselves in the festive season and go away after.") : v === "sempre" ? t("Restano nel menu tutto l'anno.", "They stay in the menu all year.") : t("Non compaiono mai nel menu; la pagina si apre solo da qui.", "They never show in the menu; the page only opens from here.")}</p>
    <div class="fl1">🗓️ ${t("Periodo di festa", "Festive season")}</div>
    <div class="na1pr"><span>${t("dal", "from")}</span>${selData("da", inizio())}<span>${t("al", "to")}</span>${selData("a", fine())}</div>
    <p class="small muted" style="margin-top:8px">${t("Di solito dal 1° dicembre all'Epifania (6 gennaio). Vale anche per gli orari delle luci e per «Automatico a Natale» di sfondo e salvaschermo.", "Usually from 1 December to Epiphany (6 January). It also applies to the light schedule and to «Automatic at Christmas» for background and screensaver.")}
      ${inPeriodo() ? " " + t("Oggi siamo nel periodo.", "Today is in the season.") : " " + t("Oggi siamo fuori periodo.", "Today is outside the season.")}</p>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="natApri">🎄 ${t("Apri la pagina Natale", "Open the Christmas page")}</button>${predef ? "" : `<button class="btn" data-act="natDef">↺ ${t("1 dicembre – 6 gennaio", "1 December – 6 January")}</button>`}</div>`;
}

/* ================= azioni ================= */
/** salva una scelta in LAYOUT.natale (e riscrive l'automazione se serve); le chiavi vuote spariscono */
const salva = (fn, msg) => cambia(l => { const n = l.natale = JSON.parse(JSON.stringify(l.natale || {})); fn(n);
  for (const k of ["luci", "tolte"]) if (Array.isArray(n[k]) && !n[k].length) delete n[k]; if (!Object.keys(n).length) delete l.natale; }, msg).then(() => riscrivi());
const orari = (fn, msg) => salva(n => { n.orari = { ...(n.orari || {}) }; fn(n.orari); }, msg);
Object.assign(ACT, {
  natTg: el => { const id = el.dataset.id; if (!ok(id)) return toast(t("Non raggiungibile: è staccato?", "Unreachable: is it unplugged?"), true); svc(id.split(".")[0], "toggle", {}, { entity_id: id }); },
  natTutto: el => { const on = el.dataset.v === "1", L = tutteFesta().filter(ok); if (!L.length) return toast(t("Nessuna luce di festa raggiungibile", "No reachable festive lights"), true);
    luciComando(L, on).then(() => toast(on ? "🎄 " + t("Buon Natale! Luci accese: ", "Merry Christmas! Lights on: ") + L.length : "⏻ " + t("Luci di festa spente", "Festive lights off"))); },
  natCol: el => svc("light", "turn_on", { rgb_color: rgbDa(el.dataset.v) }, { entity_id: el.dataset.id }),
  natEff: el => { const id = albero(); if (id) svc("light", "turn_on", { effect: el.dataset.v }, { entity_id: id }); },
  natModo: el => { const m = modoDi(albero()); if (m) svc("select", "select_option", { option: el.dataset.v }, { entity_id: m }); },
  natCfg: () => openSheet(schedaPeriodo),
  natApri: () => { closeSheet(); go("natale"); },
  natVista: el => { const v = el.dataset.v; salva(n => { if (v === "auto") delete n.vista; else n.vista = v; }, { auto: "✨ " + t("Automatico", "Automatic"), sempre: "👁️ " + t("Sempre nel menu", "Always in the menu"), mai: "🙈 " + t("Nascosta", "Hidden") }[v]); },
  natDef: () => salva(n => { delete n.da; delete n.a; }, "🗓️ " + t("1 dicembre – 6 gennaio", "1 December – 6 January")),
  natAdd: () => scegli({ titolo: "🎄 " + t("Aggiungi una luce di festa", "Add a festive light"), auto: false, attuale: null,
    sotto: t("Una luce o una presa smart (per esempio quella dell'albero o del presepe).", "A light or a smart plug (for example the tree's or the nativity scene's)."),
    filtro: id => /^(light|switch)\./.test(id) && !tutteFesta().includes(id),
    onPick: id => id && salva(n => { n.luci = [...new Set([...(n.luci || []), id])]; n.tolte = (n.tolte || []).filter(x => x !== id); }, "🎄 " + nm(id)) }),
  natTogli: el => { const id = el.dataset.id, auto = luciAuto().includes(id); salva(n => { n.luci = (n.luci || []).filter(x => x !== id); if (auto) n.tolte = [...new Set([...(n.tolte || []), id])]; }, "✕ " + nm(id)); },
  natRimetti: el => { const id = el.dataset.id; salva(n => { n.tolte = (n.tolte || []).filter(x => x !== id); }, "↩︎ " + nm(id)); },
  natAlberoSc: () => scegli({ titolo: "🎄 " + t("La luce dell'albero", "The tree light"), filtro: id => /^(light|switch)\./.test(id), attuale: NC().albero || null, nessuno: true,
    auto: albero(true),
    sotto: t("Di solito il Twinkly: lo trovo da solo. Va bene anche la presa smart dell'albero. «🚫 Nessuno» se non hai un albero smart.", "Usually the Twinkly: I find it by myself. The tree's smart plug works too. «🚫 None» if you have no smart tree."),
    onPick: id => salva(n => { if (id) n.albero = id; else delete n.albero; delete n.modo; }, "🎄 " + (id === "none" ? t("nessun albero", "no tree") : id ? nm(id) : t("automatico", "automatic"))) }),
  natModoSc: () => scegli({ titolo: "🎛️ " + t("Modalità dell'albero", "Tree mode"), filtro: id => id.startsWith("select."), attuale: NC().modo || null, nessuno: true,
    sotto: t("Il selettore con movie, color, effect… dello stesso Twinkly.", "The selector with movie, color, effect… of the same Twinkly."),
    onPick: id => salva(n => { if (id) n.modo = id; else delete n.modo; }, "🎛️ " + (id === "none" ? t("nessuna", "none") : id ? nm(id) : t("automatica", "automatic"))) }),
  natOrOn: async () => {
    if (NC().orari?.on) { try { await api("DELETE", "/api/config/automation/config/" + AUT); } catch {} await orari(o => { o.on = false; delete o.firma; }, "⏰ " + t("Orari spenti", "Schedule off")); return; }
    await orari(o => { o.on = true; delete o.firma; }, "⏰ " + t("Orari attivi", "Schedule on"));
  },
  natAcc: el => orari(o => { o.acc = el.dataset.v; }),
  natSpM: el => orari(o => { o.sp = el.dataset.v === "1" ? "23:30" : ""; }),
  natRicrea: () => riscrivi(true).then(() => toast("↻ " + t("Automazione ricreata", "Automation recreated"))),
});
Object.assign(CHG, {
  natBri: el => svc("light", "turn_on", { brightness_pct: +el.value }, { entity_id: el.dataset.id }),
  natRit: el => orari(o => { o.rit = +el.value; }),
  natOra: el => { if (oraOk(el.value)) orari(o => { o.ora = el.value; o.acc = "ora"; }); },
  natSp: el => { if (oraOk(el.value)) orari(o => { o.sp = el.value; }); },
  natData: el => { const k = el.dataset.k, [m0, g0] = (k === "da" ? inizio() : fine()).split("-").map(Number);
    let m = m0, g = g0; if (el.dataset.p === "m") m = +el.value; else g = +el.value; g = Math.min(g, giorniMese(m));
    const v = String(m).padStart(2, "0") + "-" + String(g).padStart(2, "0");
    salva(n => { n[k] = v; if ((n.da || DA) === DA && (n.a || A) === A) { delete n.da; delete n.a; } }, "🗓️ " + dataTesto(v)); },
});
/* il numero accanto alla luminosità cambia mentre si trascina */
document.addEventListener("input", e => { const el = e.target; if (el.dataset?.chg === "natBri") { const b = el.nextElementSibling; if (b) b.textContent = el.value + "%"; } });

/* ================= scheda della Home ================= */
function homeCard() {
  const al = albero(), st = statoAlbero(al), T = tutteFesta(), on = T.filter(accesa).length, c = conto();
  return card(`🎄 ${t("Natale", "Christmas")}`, `<div class="na1hm"><button class="na1hmt" data-act="go" data-id="natale" aria-label="${t("Apri Natale", "Open Christmas")}">${alberoSVG(al ? st : null, { uid: "hm" })}</button>
    <div class="tx"><b>${esc(c.testo)}</b><span>${al ? esc(stato(st)) : t(`${on} di ${T.length} luci accese`, `${on} of ${T.length} lights on`)}</span>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px">${on < T.filter(ok).length ? `<button class="btn sm warm" data-act="natTutto" data-v="1">🎄 ${t("Accendi tutto", "All on")}</button>` : ""}${on ? `<button class="btn sm" data-act="natTutto" data-v="0">⏻ ${t("Spegni tutto", "All off")}</button>` : ""}</div></div></div>`,
    { link: [t("Natale", "Christmas"), "natale"] });
}
const paginaSpenta = () => LAYOUT.pages?.natale === false;
HOME_EXTRA.natale = { title: () => t("Natale", "Christmas"), render: homeCard, show: () => inMenu() && haQualcosa() && !paginaSpenta() };

/* «✨ Cosa puoi aggiungere»: nessuna luce di festa */
AGGIUNGI.natale = { title: () => t("Luci di Natale", "Christmas lights"), icon: "🎄", tipo: () => t("Pagina di Natale", "Christmas page"), ord: 47.5,
  richiede: {
    cosa: t("Nel periodo di Natale una pagina per le luci di festa: l'albero disegnato che si accende come quello vero, accendi e spegni tutto con un tocco, effetti, orari al tramonto e il conto alla rovescia.", "During Christmas a page for the festive lights: the drawn tree that lights up like the real one, everything on and off with one tap, effects, sunset schedule and the countdown."),
    serve: t("Un albero Twinkly collegato a Home Assistant, oppure una presa smart per l'albero o il presepe.", "A Twinkly tree connected to Home Assistant, or a smart plug for the tree or the nativity scene."),
    passi: [t("Twinkly: Impostazioni → Dispositivi e servizi → ＋ Aggiungi integrazione → «Twinkly» (l'albero acceso e nella stessa rete).", "Twinkly: Settings → Devices & services → ＋ Add integration → «Twinkly» (tree on and on the same network)."),
      t("Oppure attacca l'albero a una presa smart e chiamala «Albero di Natale» (o mettile l'etichetta «Natale»).", "Or plug the tree into a smart plug and name it «Christmas tree» (or give it the «Christmas» label)."),
      t("Hai già la presa o la luce? Sceglila qui sotto.", "Already have the plug or light? Pick it below.")],
    link: [["Twinkly", linkIntegrazione("twinkly")]],
    scegli: ["natAdd", t("Scegli una luce o una presa", "Pick a light or a plug")],
    quando: t("Quando c'è, la pagina 🎄 Natale compare nel menu nel periodo di festa (si prepara da ⚙️ Impostazioni → Natale).", "Once it's there, the 🎄 Christmas page shows in the menu during the festive season (get it ready from ⚙️ Settings → Christmas)."),
    anteprima: [["🎄", t("Albero di Natale", "Christmas tree"), t("acceso · Animazione · 80%", "on · Movie · 80%")], ["🛖", t("Presepe", "Nativity scene"), t("acceso", "on")]],
    manca: () => !haQualcosa(),
  } };

page("natale", { title: t("Natale", "Christmas"), short: t("Natale", "Xmas"), icon: "🎄", order: 46, editable: true,
  show: () => (inMenu() && haQualcosa()) || isAdmin(), render: pagina });
/* fuori periodo la pagina non è nel menu (ma si apre da ⚙️) */
Object.defineProperty(PAGES.natale, "hiddenNav", { get: () => !inMenu(), enumerable: true, configurable: true });

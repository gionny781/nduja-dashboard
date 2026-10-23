/* Momenti: pulsanti che fanno più cose insieme («Esco», «Notte», «Buongiorno»…).
   Si costruiscono come le azioni delle automazioni e si salvano in Home Assistant come script
   (così funzionano anche da Alexa, Google, automazioni). In Home c'è la scheda «Momenti». */
import { S, ACT, CHG, LAYOUT, UI, t, esc, nm, card, svc, toast, openSheet, closeSheet, render, isAdmin, api, etichettaNduja } from "./core.js";
import { cambia } from "./edit.js";
import { editorAzioni, azioniHA, usaModello } from "./pages/automazioni.js";

const elenco = () => (LAYOUT.momenti || []).filter(m => m && m.id);
const PRONTI = () => [
  { nome: t("Esco", "Leaving"), icona: "🚪", azioni: [{ tipo: "off", entita: [] }] },
  { nome: t("Notte", "Night"), icona: "🌙", azioni: [{ tipo: "off", entita: [] }] },
  { nome: t("Buongiorno", "Good morning"), icona: "☀️", azioni: [{ tipo: "on", entita: [] }] },
  { nome: t("Film", "Movie"), icona: "🎬", azioni: [{ tipo: "off", entita: [] }] },
];
const ICONE = ["🚪", "🌙", "☀️", "🎬", "🍽️", "🛋️", "🏃", "🛏️", "🏖️", "🎉", "📚", "🧘", "🔒", "💡", "🔥", "❄️", "🎵", "👶", "🐶", "🚗"];

let M = null, nuovo = false;
const scriptId = m => "script." + m.id;
function scheda() {
  return `<div class="sh-head"><div><h3>${esc(M.icona || "✨")} ${nuovo ? t("Nuovo momento", "New moment") : esc(M.nome)}</h3><div class="small muted">${t("Un pulsante che fa tutte queste cose insieme. Si salva in Home Assistant come script.", "One button doing all of these at once. Saved in Home Assistant as a script.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    ${nuovo ? `<div class="vr1" style="margin-bottom:8px">${PRONTI().map((p, i) => `<button data-act="moPronto" data-i="${i}">${p.icona} ${esc(p.nome)}</button>`).join("")}</div>` : ""}
    <label class="fld1"><span>${t("Nome", "Name")}</span><input type="text" value="${esc(M.nome || "")}" data-chg="moF" data-k="nome" placeholder="${t("Esco di casa", "Leaving home")}"></label>
    <div class="ico1" style="margin-top:8px">${ICONE.map(ic => `<button class="${M.icona === ic ? "on" : ""}" data-act="moIco" data-v="${ic}">${ic}</button>`).join("")}</div>
    <div class="fl1">${t("Cosa fa", "What it does")}</div>${editorAzioni(M)}
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn pri" data-act="moSave">💾 ${t("Salva", "Save")}</button>${!nuovo ? `<button class="btn bad" data-act="moDel">🗑 ${t("Elimina", "Delete")}</button>` : ""}</div>`;
}
const apri = () => { usaModello(M, () => openSheet(scheda)); openSheet(scheda); };
CHG.moF = el => { M[el.dataset.k] = el.value; };

export function momentiCard() {
  const L = elenco();
  if (!L.length && !isAdmin()) return "";
  return card("✨ " + t("Momenti", "Moments"), `<div class="mo1">${L.map((m, i) => `<button class="mob1 ${S[scriptId(m)]?.state === "on" ? "on" : ""}" data-act="moRun" data-i="${i}"><span>${esc(m.icona || "✨")}</span><b>${esc(m.nome)}</b>${UI.edit && isAdmin() ? `<i data-act="moEdit" data-i="${i}">✏️</i>` : ""}</button>`).join("")}
    ${isAdmin() && (UI.edit || !L.length) ? `<button class="mob1 add" data-act="moNew"><span>＋</span><b>${t("Nuovo momento", "New moment")}</b></button>` : ""}</div>
    ${!L.length ? `<div class="small muted" style="margin-top:8px">${t("Esempi: «Esco» spegne tutte le luci e inserisce l'allarme; «Notte» abbassa le tapparelle e spegne la TV.", "E.g. «Leaving» turns off every light and arms the alarm; «Night» closes the covers and turns off the TV.")}</div>` : ""}`, { right: isAdmin() && L.length && !UI.edit ? `<button class="btn sm" data-act="moGestisci">✏️</button>` : "" });
}

Object.assign(ACT, {
  moRun: (el, e) => { if (e?.target?.dataset?.act === "moEdit") return; const m = elenco()[+el.dataset.i];
    svc("script", "turn_on", {}, { entity_id: scriptId(m) }).then(() => toast(`${m.icona || "✨"} ${m.nome}`)); },
  moEdit: (el, e) => { e?.stopPropagation?.(); M = JSON.parse(JSON.stringify(elenco()[+el.dataset.i])); nuovo = false; apri(); },
  moGestisci: () => { UI.edit = true; render(true); },
  moNew: () => { M = { id: "nduja_" + Date.now().toString(36), nome: "", icona: "✨", azioni: [{ tipo: "off", entita: [] }] }; nuovo = true; apri(); },
  moPronto: el => { const p = PRONTI()[+el.dataset.i]; Object.assign(M, JSON.parse(JSON.stringify(p))); render(); },
  moIco: el => { M.icona = el.dataset.v; render(); },
  moSave: async () => {
    if (!M.nome?.trim()) return toast(t("Scrivi un nome", "Write a name"), true);
    const seq = azioniHA(M); if (!seq.length) return toast(t("Scegli almeno un'azione con i dispositivi", "Choose at least one action with devices"), true);
    try {
      await api("POST", "/api/config/script/config/" + encodeURIComponent(M.id), { alias: (M.icona ? M.icona + " " : "") + M.nome, description: t("Momento creato con 'Nduja Dashboard", "Moment created with 'Nduja Dashboard"), sequence: seq, mode: "restart" });
      if (nuovo) { const sid = scriptId(M); etichettaNduja(() => S[sid] ? sid : null); }   // nuovo: etichetta «'Nduja»
      const m = M; await cambia(l => { const L = (l.momenti || []).filter(x => x.id !== m.id); const i = (l.momenti || []).findIndex(x => x.id === m.id); if (i < 0) L.push(m); else L.splice(i, 0, m); l.momenti = L; });
      closeSheet(); toast("💾 " + M.nome);
    } catch (e) { toast(t("Non salvato: ", "Not saved: ") + (e.message || e), true); }
  },
  moDel: async () => {
    if (!confirm(t("Eliminare questo momento?", "Delete this moment?"))) return;
    const id = M.id;
    try { await api("DELETE", "/api/config/script/config/" + encodeURIComponent(id)); } catch {}
    await cambia(l => { l.momenti = (l.momenti || []).filter(x => x.id !== id); }); closeSheet();
  },
});

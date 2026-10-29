/* Aggiornamenti: installa dalla plancia quello che Home Assistant propone (Home Assistant, componenti aggiuntivi,
   HACS, firmware). Novità, backup prima di installare, avanzamento, «Installa tutti» (Home Assistant per ultimo), versioni saltate. */
import { S, ACT, VISTE, esc, card, svc, ws, toast, render, openSheet, page, t } from "../core.js";

const F = { INSTALL: 1, VERSION: 2, PROGRESS: 4, BACKUP: 8, NOTES: 16 };
const has = (id, f) => ((S[id]?.attributes?.supported_features || 0) & f) === f;
const A = id => S[id]?.attributes || {};
const tutte = () => Object.keys(S).filter(id => id.startsWith("update."));
const disponibili = () => tutte().filter(id => S[id].state === "on");
const saltati = () => tutte().filter(id => S[id].state === "off" && A(id).skipped_version && A(id).skipped_version === A(id).latest_version && A(id).installed_version !== A(id).latest_version);
const installando = id => A(id).in_progress === true || typeof A(id).in_progress === "number";
const NOCHK = new Set(); /* backup disattivati a mano */
const busy = new Set();

function tipo(id) {
  const a = A(id), u = a.release_url || "";
  if (/home_assistant_(core|supervisor|operating_system)/.test(id)) return ["🏠", "Home Assistant", 0];
  if (has(id, 29) && a.title && !/github\.com/.test(u)) return ["🧩", t("Componenti aggiuntivi", "Add-ons"), 1];
  if (/github\.com/.test(u) && has(id, 23)) return ["📦", "HACS", 2];
  if (/fritz/i.test(id + (a.title || "")) || VISTE.reteAgg?.(id)) return ["📶", t("Rete e server", "Network and servers"), 3];   // modem, NAS, server (pagina Rete)
  if (/firmware|shelly|0x/i.test(id + u)) return ["🔌", t("Firmware dispositivi", "Device firmware"), 4];
  return ["⚙️", t("Altro", "Other"), 5];
}
const nome = id => {
  const a = A(id);
  return String(a.title || a.friendly_name || id.split(".")[1]).replace(/\s*(update|aggiornamento|firmware update|firmware)\s*$/i, "").replace(/_/g, " ").trim() || id;
};

function riga(id) {
  const a = A(id), [ic] = tipo(id), run = installando(id) || busy.has(id);
  const pct = typeof a.update_percentage === "number" ? a.update_percentage : typeof a.in_progress === "number" ? a.in_progress : null;
  const bk = has(id, F.BACKUP), core = /home_assistant_core|operating_system/.test(id);
  return `<div class="up69 ${run ? "run" : ""}">
    <span class="ic">${ic}</span>
    <div class="tx"><b>${esc(nome(id))}</b><span class="v">${esc(a.installed_version || "—")} <i>→</i> <em>${esc(a.latest_version || "—")}</em></span>
      ${a.release_summary ? `<span class="sm">${esc(String(a.release_summary).replace(/<[^>]+>/g, "").slice(0, 160))}</span>` : ""}
      ${core && !run ? `<span class="sm warn">${t("Home Assistant si riavvia: la plancia torna da sola dopo un paio di minuti.", "Home Assistant will restart: the dashboard comes back by itself in a couple of minutes.")}</span>` : ""}
      ${run ? `<div class="pb69"><i style="width:${pct == null ? 35 : Math.max(4, pct)}%" class="${pct == null ? "ind" : ""}"></i></div><span class="sm">${t("Installazione in corso", "Installing")}${pct != null ? " · " + Math.round(pct) + "%" : "…"}</span>` : ""}</div>
    <div class="ac">
      ${has(id, F.NOTES) ? `<button class="btn sm" data-act="upNote" data-id="${id}">📄 ${t("Novità", "Notes")}</button>` : a.release_url ? `<a class="btn sm" href="${esc(a.release_url)}" target="_blank" rel="noopener">📄 ${t("Novità", "Notes")}</a>` : ""}
      ${has(id, F.INSTALL) ? `${bk && !run ? `<label class="bk69"><input type="checkbox" data-upbk="${id}" ${NOCHK.has(id) ? "" : "checked"}> ${t("backup", "backup")}</label>` : ""}
        <button class="btn sm pri" data-act="upGo" data-id="${id}" ${run ? "disabled" : ""}>${run ? "⏳" : "⬆️ " + t("Installa", "Install")}</button>` : `<span class="sm muted">${t("da aggiornare sul dispositivo", "update on the device")}</span>`}
      ${!run ? `<button class="btn sm" data-act="upSkip" data-id="${id}" title="${t("Salta questa versione", "Skip this version")}">${t("Salta", "Skip")}</button>` : ""}
    </div></div>`;
}

function pagina() {
  const L = disponibili().sort((a, b) => tipo(a)[2] - tipo(b)[2] || nome(a).localeCompare(nome(b)));
  const sk = saltati(), tot = tutte().length;
  const gruppi = {}; tutte().forEach(id => { const t = tipo(id); (gruppi[t[1]] = gruppi[t[1]] || { ic: t[0], o: t[2], n: 0, on: 0 }).n++; if (S[id].state === "on") gruppi[t[1]].on++; });
  const installabili = L.filter(id => has(id, F.INSTALL) && !installando(id));
  return `<div class="g g3">
    ${card(`⬆️ ${t("Da aggiornare", "Pending")} <span class="tag ${L.length ? "warn" : "ok"}">${L.length ? L.length : t("tutto aggiornato", "up to date")}</span>`, `
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn sm" data-act="upCheck">🔄 ${t("Controlla ora", "Check now")}</button>
        ${installabili.length > 1 ? `<button class="btn sm pri" data-act="upAll">⬆️ ${t("Installa tutti", "Install all")} (${installabili.length})</button>` : ""}
        <a class="btn sm up69a" href="/config/updates" target="_top">${t("Apri in Home Assistant", "Open in Home Assistant")} ›</a>
      </div>
      ${L.length ? `<div class="stack">${L.map(riga).join("")}</div>` : `<div class="small muted">${t("Nessun aggiornamento in attesa.", "No pending updates.")}</div>`}`, { cls: "span2" })}
    ${card("📋 " + t("Riepilogo", "Summary"), `<div class="stack">${Object.entries(gruppi).sort((a, b) => a[1].o - b[1].o).map(([g, x]) => `<div class="row between small"><span>${x.ic} ${esc(g)}</span><b>${x.on ? `<span class="tag warn">${x.on} ${t("da fare", "to do")}</span> ` : ""}<span class="muted">${x.n}</span></b></div>`).join("")}
      <div class="small muted" style="margin-top:6px">${tot} ${t("elementi controllati.", "items checked.")}</div></div>`)}
    ${sk.length ? card(`⏭️ ${t("Versioni saltate", "Skipped versions")} <span class="tag">${sk.length}</span>`, `<div class="stack">${sk.map(id => `<div class="up69 sk"><span class="ic">${tipo(id)[0]}</span>
      <div class="tx"><b>${esc(nome(id))}</b><span class="v">${esc(A(id).installed_version || "—")} <i>→</i> <em>${esc(A(id).latest_version || "—")}</em> ${t("saltata", "skipped")}</span></div>
      <div class="ac"><button class="btn sm" data-act="upUnskip" data-id="${id}">↩︎ ${t("Ripristina", "Restore")}</button></div></div>`).join("")}</div>`, { cls: "span3" }) : ""}
  </div>`;
}

/* ---------- azioni ---------- */
const conferma = (el, testo) => {
  if (el.dataset.sure === "1") return true;
  el.dataset.sure = "1"; const old = el.textContent; el.textContent = testo;
  setTimeout(() => { if (el.isConnected) { el.dataset.sure = ""; el.textContent = old; } }, 3500);
  return false;
};
async function installa(id) {
  const data = has(id, F.BACKUP) ? { backup: !NOCHK.has(id) } : {};
  busy.add(id); render();
  try { await svc("update", "install", data, { entity_id: id }); toast("⬆️ " + nome(id) + ": " + t("installazione avviata", "install started")); }
  catch { busy.delete(id); render(); return false; }
  setTimeout(() => { busy.delete(id); render(); }, 20000);
  return true;
}
Object.assign(ACT, {
  upGo: el => { if (!conferma(el, t("Sicuro? Tocca ancora", "Sure? Tap again"))) return; installa(el.dataset.id); },
  upSkip: el => { if (!conferma(el, t("Saltare?", "Skip?"))) return; svc("update", "skip", {}, { entity_id: el.dataset.id }).then(() => toast("⏭️ " + nome(el.dataset.id) + ": " + t("versione saltata", "version skipped"))); },
  upUnskip: el => svc("update", "clear_skipped", {}, { entity_id: el.dataset.id }).then(() => toast("↩︎ " + nome(el.dataset.id) + " " + t("torna tra gli aggiornamenti", "is back in the list"))),
  upCheck: () => svc("homeassistant", "update_entity", {}, { entity_id: tutte() }).then(() => toast("🔄 " + t("Controllo avviato: tra poco la lista si aggiorna", "Check started: the list will refresh shortly"))),
  upAll: async el => {
    if (!conferma(el, t("Installo tutto? Tocca ancora", "Install all? Tap again"))) return;
    const L = disponibili().filter(id => has(id, F.INSTALL) && !installando(id));
    const ultimi = L.filter(id => /home_assistant_(core|operating_system|supervisor)/.test(id)), prima = L.filter(id => !ultimi.includes(id));
    toast(`⬆️ ${t("Installo", "Installing")} ${L.length} ${t("aggiornamenti, uno alla volta", "updates, one at a time")}`);
    for (const id of [...prima, ...ultimi]) { await installa(id); await new Promise(r => setTimeout(r, 1500)); }
  },
  upNote: async el => {
    const id = el.dataset.id; let md = "";
    try { md = await ws({ type: "update/release_notes", entity_id: id }); } catch { md = ""; }
    const url = A(id).release_url;
    openSheet(() => `<div class="sh-head"><div><h3>📄 ${esc(nome(id))} ${esc(A(id).latest_version || "")}</h3></div><button class="x" data-act="sheetClose">×</button></div>
      <div class="nt69">${md ? markdown(md) : `<p class="muted">${t("Nessuna nota disponibile.", "No notes available.")}</p>`}</div>
      ${url ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener" style="margin-top:10px">${t("Apri la pagina completa", "Open full page")} ›</a>` : ""}`);
  }
});
document.addEventListener("change", e => { const t = e.target; if (t.matches?.("[data-upbk]")) { t.checked ? NOCHK.delete(t.dataset.upbk) : NOCHK.add(t.dataset.upbk); } });

/* markdown essenziale per le note di rilascio */
function markdown(md) {
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let out = "", ul = false;
  for (const raw of String(md).replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/)) {
    const l = raw.replace(/<[^>]+>/g, "").trimEnd(), m = l.match(/^\s*[-*+]\s+(.*)/), h = l.match(/^(#{1,4})\s+(.*)/);
    if (m) { if (!ul) { out += "<ul>"; ul = true; } out += `<li>${inl(m[1])}</li>`; continue; }
    if (ul) { out += "</ul>"; ul = false; }
    if (h) out += `<h4>${inl(h[2])}</h4>`; else if (l.trim()) out += `<p>${inl(l)}</p>`;
  }
  return out + (ul ? "</ul>" : "");
}

/* ---------- registrazione ---------- */
page("aggiornamenti", { title: t("Aggiornamenti", "Updates"), short: t("Aggiorna", "Updates"), icon: "⬆️", order: 90, render: pagina, badge: () => disponibili().length > 0 });

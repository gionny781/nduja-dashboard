/* Telecamere: anteprime aggiornate ogni pochi secondi; tocca per la diretta a schermo intero.
   I doppioni (sub stream, transcodifiche, canali non raggiungibili) restano fuori finché non li aggiungi con ＋. */
import { S, ACT, LAYOUT, UI, t, esc, nm, ok, attr, ents, card, empty, page, openSheet, render, sGet, sSet, DEFAULT_OFF, areaOf, AREAS } from "../core.js";
import { item, addBtn, cambia } from "../edit.js";

DEFAULT_OFF.push(id => id.startsWith("camera.") && (/sub_?stream|transcod|_ptz|snapshot/i.test(id) || S[id]?.state === "unavailable"));
const V = { big: sGet("camBig") === "1", live: null };
const ordine = L => { const o = LAYOUT.camOrder || []; return [...L].sort((a, b) => ((o.indexOf(a) + 1 || 999) - (o.indexOf(b) + 1 || 999)) || nm(a).localeCompare(nm(b))); };
/* l'anteprima cambia indirizzo quando HA rinnova il token: aggiungo un contatore per ricaricarla */
let giro = 0; setInterval(() => { giro++; if (document.querySelector(".cm1 img")) render(); }, 10000);
const foto = id => { const p = attr(id, "entity_picture"); return p ? p + (p.includes("?") ? "&" : "?") + "t=" + giro : ""; };
const STATO = s => ({ recording: "⏺ " + t("registra", "recording"), streaming: "🔴 live", idle: "" }[s] ?? s);

function tessera(id, L) {
  const i = L.indexOf(id);
  return `<div class="cm1 ${ok(id) ? "" : "dis"}"><button class="cmb1" data-act="camLive" data-id="${id}">${ok(id) ? `<img src="${esc(foto(id))}" alt="" loading="lazy">` : `<span class="cmx1">📷</span>`}
    <span class="cmn1"><b>${esc(nm(id))}</b><small>${esc([AREAS[areaOf(id)]?.name, STATO(S[id].state)].filter(Boolean).join(" · "))}</small></span></button>
    ${UI.edit ? `<div class="cmo1"><button data-act="camMove" data-id="${id}" data-v="-1" ${i === 0 ? "disabled" : ""}>◀</button><button data-act="camMove" data-id="${id}" data-v="1" ${i === L.length - 1 ? "disabled" : ""}>▶</button></div>` : ""}</div>`;
}
function diretta() {
  const id = V.live; if (!id || !S[id]) return "";
  const tok = attr(id, "access_token");
  return `<div class="sh-head"><div><h3>📷 ${esc(nm(id))}</h3><div class="small muted">${t("In diretta", "Live")}</div></div><button class="btn sm" data-act="more" data-id="${id}">⤢ ${t("Apri in HA", "Open in HA")}</button><button class="x" data-act="sheetClose">×</button></div>
    <img class="cml1" data-keep src="/api/camera_proxy_stream/${id}?token=${esc(tok || "")}" alt="">`;
}
Object.assign(ACT, {
  camLive: el => { V.live = el.dataset.id; openSheet(diretta); },
  camBig: () => { V.big = !V.big; sSet("camBig", V.big ? "1" : "0"); render(true); },
  camMove: el => { const id = el.dataset.id, d = +el.dataset.v; cambia(l => { const o = ordine(ents("camera")), i = o.indexOf(id), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; l.camOrder = o; }); },
});

function pagina() {
  const L = ordine(ents("camera"));
  if (!L.length) return `<div class="g">${card("📷 " + t("Telecamere", "Cameras"), empty(t("Nessuna telecamera: premi ✏️ Modifica per aggiungerle.", "No cameras: press ✏️ Edit to add them.")) + addBtn(["camera"], { big: true }))}</div>`;
  return `<div class="g"><section class="card"><div class="ch"><h2>📷 ${t("Telecamere", "Cameras")} <span class="tag info">${L.length}</span></h2>
      <button class="btn sm" data-act="camBig">${V.big ? "▦ " + t("Piccole", "Small") : "▢ " + t("Grandi", "Large")}</button></div>
    <div class="cms1 ${V.big ? "big" : ""}">${L.map(id => item(id, tessera(id, L))).join("")}${addBtn(["camera"], { label: t("Aggiungi telecamera", "Add camera") })}</div>
    ${UI.edit ? `<p class="small muted" style="margin-top:10px">${t("◀ ▶ cambia l'ordine. I doppioni (sub stream, transcodifiche, mappe dei robot) sono nascosti: aggiungili con ＋ se ti servono.", "◀ ▶ changes the order. Duplicates (sub streams, transcodes, vacuum maps) are hidden: add them with ＋ if you need them.")}</p>` : ""}</section></div>`;
}
page("telecamere", { title: t("Telecamere", "Cameras"), short: t("Telecam.", "Cameras"), icon: "📷", order: 50, editable: true, show: () => ents("camera").length > 0 || isAdminSafe(), render: pagina });
function isAdminSafe() { try { return UI.user?.is_admin && Object.keys(S).some(id => id.startsWith("camera.")); } catch { return false; } }

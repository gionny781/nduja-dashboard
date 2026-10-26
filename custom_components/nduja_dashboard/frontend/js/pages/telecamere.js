/* Telecamere: anteprime leggere aggiornate ogni pochi secondi; al tocco la diretta col lettore unico (video.js:
   WebRTC → HLS → MJPEG → foto). I doppioni (sub stream, transcodifiche, canali non raggiungibili) restano fuori finché non li aggiungi con ＋. */
import { S, ACT, UI, t, ok, ents, card, empty, page, render, sGet, sSet, DEFAULT_OFF } from "../core.js";
import { item, addBtn, cambia } from "../edit.js";
import { anteprima, ordineCam as ordine } from "../video.js";

DEFAULT_OFF.push(id => id.startsWith("camera.") && (/sub_?stream|transcod|_ptz|snapshot/i.test(id) || S[id]?.state === "unavailable"));
const V = { big: sGet("camBig") === "1" };

function tessera(id, L) {
  const i = L.indexOf(id);
  return `<div class="cm1 ${ok(id) ? "" : "dis"}">${anteprima(id)}
    ${UI.edit ? `<div class="cmo1"><button data-act="camMove" data-id="${id}" data-v="-1" ${i === 0 ? "disabled" : ""}>◀</button><button data-act="camMove" data-id="${id}" data-v="1" ${i === L.length - 1 ? "disabled" : ""}>▶</button></div>` : ""}</div>`;
}
Object.assign(ACT, {
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

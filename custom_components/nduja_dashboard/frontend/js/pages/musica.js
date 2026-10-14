/* Musica e TV: casse, TV e lettori multimediali per stanza, con copertina, titolo, comandi, volume, sorgente.
   In Home la scheda «In riproduzione» mostra solo quello che sta suonando. */
import { S, ACT, CHG, UI, t, esc, nm, ok, attr, ents, areaOf, AREAS, areasSorted, card, empty, page, svc, isAdmin } from "../core.js";
import { item, addBtn } from "../edit.js";

const F = { PAUSE: 1, VOL: 4, MUTE: 8, PREV: 16, NEXT: 32, ON: 128, OFF: 256, SOURCE: 2048, STOP: 4096, PLAY: 16384, SHUFFLE: 32768, SOUND: 65536, REPEAT: 262144 };
const ha = (id, f) => ((attr(id, "supported_features") || 0) & f) === f;
const acceso = id => ok(id) && !["off", "standby", "unavailable", "unknown"].includes(S[id].state);
const suona = id => S[id]?.state === "playing";
const tipo = id => { const d = String(attr(id, "device_class") || ""); return d === "tv" || /tv|televis|samsung|lg_|bravia|chromecast|fire|apple_tv|shield/i.test(id) ? "📺" : d === "speaker" || /echo|alexa|sonos|nest|home|speaker|cassa|google/i.test(id) ? "🔊" : "🎵"; };
const STATO = () => ({ playing: t("In riproduzione", "Playing"), paused: t("In pausa", "Paused"), idle: t("Acceso", "Idle"), on: t("Acceso", "On"), off: t("Spento", "Off"), standby: "Standby", buffering: t("Carica…", "Buffering…") });

function lettore(id, piccolo = false) {
  const a = S[id].attributes, on = acceso(id), img = a.entity_picture, vol = a.volume_level;
  const titolo = a.media_title || (on ? a.source || a.app_name || "" : ""), art = a.media_artist || a.media_album_name || a.media_series_title || "";
  const b = (act, ic, f, extra = "") => ha(id, f) ? `<button class="mpc1 ${extra}" data-act="${act}" data-id="${id}">${ic}</button>` : "";
  return `<div class="mpl1 ${on ? "on" : ""} ${suona(id) ? "play" : ""} ${piccolo ? "mini" : ""}">
    <div class="mpa1" style="${img ? `background-image:url('${esc(img)}')` : ""}">${img ? "" : `<span>${tipo(id)}</span>`}</div>
    <div class="mpt2"><div class="row between" style="gap:8px"><b>${esc(nm(id))}</b>${ha(id, F.ON) || ha(id, F.OFF) ? `<button class="sw ${on ? "on" : ""}" data-act="muPower" data-id="${id}" aria-label="${esc(nm(id))}"><i></i></button>` : ""}</div>
      <small>${esc(STATO()[S[id].state] || S[id].state)}${AREAS[areaOf(id)] && !piccolo ? " · " + esc(AREAS[areaOf(id)].name) : ""}</small>
      ${titolo ? `<div class="mpn1"><b>${esc(titolo)}</b>${art ? `<span>${esc(art)}</span>` : ""}</div>` : ""}
      ${on ? `<div class="mpk1">${b("muPrev", "⏮", F.PREV)}${ha(id, F.PAUSE) || ha(id, F.PLAY) ? `<button class="mpc1 big" data-act="muPlay" data-id="${id}">${suona(id) ? "⏸" : "▶"}</button>` : ""}${b("muNext", "⏭", F.NEXT)}
        ${!piccolo ? b("muShuffle", "🔀", F.SHUFFLE, a.shuffle ? "on" : "") + b("muRepeat", a.repeat === "one" ? "🔂" : "🔁", F.REPEAT, a.repeat && a.repeat !== "off" ? "on" : "") : ""}</div>
      ${ha(id, F.VOL) ? `<div class="mpv1">${ha(id, F.MUTE) ? `<button data-act="muMute" data-id="${id}">${a.is_volume_muted ? "🔇" : vol > .5 ? "🔊" : "🔉"}</button>` : "🔉"}<input type="range" min="0" max="100" value="${Math.round((vol || 0) * 100)}" data-chg="muVol" data-id="${id}"><em>${Math.round((vol || 0) * 100)}</em></div>` : ""}
      ${!piccolo && ha(id, F.SOURCE) && (a.source_list || []).length ? `<label class="fld1"><span>${t("Sorgente", "Source")}</span><select data-chg="muSrc" data-id="${id}">${(a.source_list || []).map(s => `<option ${a.source === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}
      ${!piccolo && ha(id, F.SOUND) && (a.sound_mode_list || []).length ? `<label class="fld1"><span>${t("Modalità audio", "Sound mode")}</span><select data-chg="muSound" data-id="${id}">${(a.sound_mode_list || []).map(s => `<option ${a.sound_mode === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}` : ""}
    </div></div>`;
}

const tutti = () => ents("media_player", id => !attr(id, "group_members") || attr(id, "group_members").length <= 1 || attr(id, "group_members")[0] === id);
function pagina() {
  const L = tutti(), g = {};
  L.forEach(id => (g[AREAS[areaOf(id)] ? areaOf(id) : "_"] = g[AREAS[areaOf(id)] ? areaOf(id) : "_"] || []).push(id));
  const ord = [...areasSorted().filter(a => g[a]), ...(g._ ? ["_"] : [])].filter(a => UI.edit || g[a].some(id => !suona(id)));
  const play = L.filter(suona);
  return `<div class="g g3">
    ${play.length ? card("🎶 " + t("In riproduzione", "Now playing"), `<div class="mpg2">${play.map(id => lettore(id)).join("")}</div>`, { cls: "span3" }) : ""}
    ${ord.map(a => card(esc(a === "_" ? t("Senza stanza", "No room") : AREAS[a].name), `<div class="stack">${g[a].filter(id => !suona(id)).map(id => item(id, lettore(id))).join("") || `<div class="small muted">${t("Sta suonando qui sopra.", "Playing above.")}</div>`}${addBtn(["media_player"], { area: a === "_" ? "" : a })}</div>`)).join("")}
    ${!L.length ? card("🎵 " + t("Musica e TV", "Music and TV"), empty(t("Nessun lettore multimediale.", "No media player.")) + addBtn(["media_player"], { big: true }), { cls: "span3" }) : ""}
  </div>`;
}
/** scheda Home: solo quello che suona adesso */
export function musicaCard() {
  const P = tutti().filter(suona); if (!P.length) return "";
  return card("🎶 " + t("In riproduzione", "Now playing"), `<div class="stack">${P.slice(0, 3).map(id => lettore(id, true)).join("")}</div>`, { link: [t("Musica", "Music"), "musica"] });
}

Object.assign(ACT, {
  muPlay: el => svc("media_player", "media_play_pause", {}, { entity_id: el.dataset.id }),
  muPrev: el => svc("media_player", "media_previous_track", {}, { entity_id: el.dataset.id }),
  muNext: el => svc("media_player", "media_next_track", {}, { entity_id: el.dataset.id }),
  muPower: el => svc("media_player", acceso(el.dataset.id) ? "turn_off" : "turn_on", {}, { entity_id: el.dataset.id }),
  muMute: el => svc("media_player", "volume_mute", { is_volume_muted: !attr(el.dataset.id, "is_volume_muted") }, { entity_id: el.dataset.id }),
  muShuffle: el => svc("media_player", "shuffle_set", { shuffle: !attr(el.dataset.id, "shuffle") }, { entity_id: el.dataset.id }),
  muRepeat: el => { const r = attr(el.dataset.id, "repeat"); svc("media_player", "repeat_set", { repeat: r === "off" ? "all" : r === "all" ? "one" : "off" }, { entity_id: el.dataset.id }); },
});
CHG.muVol = el => svc("media_player", "volume_set", { volume_level: +el.value / 100 }, { entity_id: el.dataset.id });
CHG.muSrc = el => svc("media_player", "select_source", { source: el.value }, { entity_id: el.dataset.id });
CHG.muSound = el => svc("media_player", "select_sound_mode", { sound_mode: el.value }, { entity_id: el.dataset.id });

page("musica", { title: t("Musica e TV", "Music and TV"), short: t("Musica", "Music"), icon: "🎵", order: 33, editable: true,
  show: () => ents("media_player").length > 0, badge: () => tutti().some(suona), render: pagina });

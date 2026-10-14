/* Eventi dei calendari di Home Assistant (calendar.get_events), con cache di 5 minuti. */
import { S, LAYOUT, t, LOC, ents, nm, cached, svcResp } from "./core.js";

export const RIFIUTI = /raccolta|rifiut|differenziat|spazzatura|waste|garbage|trash|recycl|abfall|m[üu]ll/i;
const COLORI = ["#ff8a3d", "#4fb3ff", "#7bd88f", "#c792ea", "#ffd166", "#ff6b9a", "#5ee0d0", "#b0b8c8"];

/** calendari da mostrare: quelli scelti, altrimenti tutti tranne la raccolta differenziata */
export function calendari() {
  const tutti = ents("calendar");
  if (Array.isArray(LAYOUT.calendars)) return LAYOUT.calendars.filter(id => S[id]);
  return tutti.filter(id => !RIFIUTI.test(id + " " + nm(id)));
}
export const colore = id => LAYOUT.calColors?.[id] || COLORI[ents("calendar").indexOf(id) % COLORI.length] || COLORI[0];
export const puoScrivere = id => ((S[id]?.attributes.supported_features || 0) & 1) === 1;

const giorno0 = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const allDay = ev => String(ev.start).length <= 10;
export const inizio = ev => allDay(ev) ? new Date(ev.start + "T00:00:00") : new Date(ev.start);
export const fine = ev => allDay(ev) ? new Date(ev.end + "T00:00:00") : new Date(ev.end);

/** eventi dei calendari ids da oggi per `giorni` giorni, ordinati; undefined mentre carica */
export function eventi(ids, giorni = 7) {
  if (!ids.length) return [];
  const da = giorno0(), a = new Date(da.getTime() + giorni * 864e5);
  const key = "ev:" + ids.join(",") + ":" + giorni + ":" + da.toDateString();
  const r = cached(key, 5 * 60000, async () => {
    const res = await svcResp("calendar", "get_events", { start_date_time: da.toISOString(), end_date_time: a.toISOString() }, ids);
    return ids.flatMap(id => (res?.[id]?.events || []).map(ev => ({ ...ev, cal: id }))).sort((x, y) => inizio(x) - inizio(y));
  });
  return r;
}
/** l'evento cade (anche in parte) nel giorno d? */
export const nelGiorno = (ev, d) => { const g = giorno0(d), g2 = new Date(g.getTime() + 864e5); return inizio(ev) < g2 && fine(ev) > g; };
export const ora = ev => allDay(ev) ? t("tutto il giorno", "all day") : inizio(ev).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
export function nomeGiorno(d) {
  const g = giorno0(d), oggi = giorno0(), diff = Math.round((g - oggi) / 864e5);
  if (diff === 0) return t("Oggi", "Today");
  if (diff === 1) return t("Domani", "Tomorrow");
  const s = g.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" });
  return s[0].toUpperCase() + s.slice(1);
}

/* 'Nduja Dashboard — 📚 ricette pronte per le automazioni (0.7.64).
   Ogni ricetta compare solo se la casa ha i dispositivi che servono (come «✨ Cosa puoi aggiungere»), chiede solo i dispositivi
   (già scelti da sola quando è chiaro quali) e qualche numero, e poi diventa un'automazione normale del costruttore:
   si salva subito oppure si ritocca in «Quando → Solo se → Allora».
   Ricetta: { k, ic, nome(), cosa(), serve() → vero se la casa ha quello che serve, campi() → [{ k, tipo: ent|num|ora|testo, titolo, filtro, multi, facoltativo, unita, auto }],
     crea(v) → modello del costruttore (automazioni-modello.js) } */
import { S, AREAS, t, nm, unit, deviceClass, areaOf, ents, allEnts, luciContate, isLightSwitch, weatherEnt, ok } from "./core.js";
import { apertura, movimento, echi, persone, isElettro, elettrodomestici } from "./automazioni-modello.js";

const luce = id => id.startsWith("light.") || isLightSwitch(id);
const luciOk = () => luciContate().filter(ok);
const varco = id => id.startsWith("cover.") && ["gate", "garage", "door"].includes(deviceClass(id));
const tenda = id => deviceClass(id) === "awning" || /tenda.?da.?sole|tenda_sole|awning|pergol|frunk|trunk|charge_port|baule/i.test(id + " " + nm(id));
const tapparelle = () => ents("cover").filter(id => !varco(id) && !tenda(id) && ok(id));
const finestre = () => allEnts("binary_sensor", id => ["window"].includes(deviceClass(id)));
const porte = () => allEnts("binary_sensor", id => ["door", "garage_door"].includes(deviceClass(id)));
const nomeArea = id => (AREAS[areaOf(id)]?.name || "").toLowerCase();
const esterno = id => /esterno|giardin|garden|portic|porch|terrazz|balcon|cortil|vialett|outdoor|esterna/i.test(id + " " + nm(id) + " " + nomeArea(id));
const corridoio = id => /corridoi|hall|ingress|entrat|scal|stair/i.test(id + " " + nm(id) + " " + nomeArea(id));
const batterie = () => allEnts("sensor", id => deviceClass(id) === "battery" && unit(id) === "%" && ok(id) && !/iphone|ipad|pixel|galaxy|phone|telefono|tablet|model_|auto|car\b|ev_|powerwall|battery_soc|accumulo|storage|ups|nas\b|inverter/i.test(id + " " + nm(id)));
const potenzaCasa = () => allEnts("sensor", id => deviceClass(id) === "power" && /rete|grid|import|prelievo|casa|house|home|total|consumo|consumption|load|carico/i.test(id + " " + nm(id)) && !/solar|pv|fotovolt|inverter|batter|export|immiss/i.test(id + " " + nm(id)));
const zoneAcqua = () => [...allEnts("valve", id => !/principale|main|acqua_casa|gas/i.test(id + nm(id))), ...allEnts("switch", id => /irrig|sprinkl|rain_?bird|zona/i.test(id + " " + nm(id)) && !/luce|light|presa|plug|watering/i.test(id + " " + nm(id)))];
const clima = () => ents("climate");
const allarmi = () => allEnts("alarm_control_panel");
const primoEcho = () => echi().slice(0, 1);
const tuttiTel = "notify";

/* pezzi che tornano spesso */
const notifica = (msg, servizio) => ({ tipo: "notifica", servizio: servizio || tuttiTel, messaggio: msg });
const alexa = (L, msg) => L?.length ? [{ tipo: "alexa", entita: L, messaggio: msg, modo: "announce" }] : [];
const campoEcho = () => echi().length ? [{ k: "echo", tipo: "ent", titolo: t("Anche su Alexa (facoltativo)", "Also on Alexa (optional)"), filtro: id => echi().includes(id), multi: true, facoltativo: true, auto: primoEcho }] : [];
const campoTel = () => [{ k: "tel", tipo: "tel", titolo: t("Notifica a", "Notify"), auto: () => tuttiTel }];

export const RICETTE = () => [
  { k: "tramonto", ic: "🌇", nome: () => t("Luci al tramonto se c'è qualcuno", "Lights at sunset if someone is home"),
    cosa: () => t("Al tramonto accende le luci scelte, ma solo se qualcuno è in casa.", "At sunset it turns on the chosen lights, but only if someone is home."),
    serve: () => luciContate().length > 0 && persone().length > 0,
    campi: () => [{ k: "luci", tipo: "ent", titolo: t("Quali luci", "Which lights"), filtro: luce, multi: true, auto: () => { const L = luciOk().filter(esterno); return L.length ? L : luciOk().slice(0, 2); } },
      { k: "offset", tipo: "num", titolo: t("Minuti prima (−) o dopo (+) il tramonto", "Minutes before (−) or after (+) sunset"), auto: () => 0 }],
    crea: v => ({ nome: t("Luci al tramonto", "Lights at sunset"), quando: [{ tipo: "sole", evento: "sunset", offset: +v.offset || 0 }], soloSe: { modo: "e", cond: [{ tipo: "casa", chi: "qualcuno" }] }, azioni: [{ tipo: "on", entita: v.luci }] }) },

  { k: "ultimo", ic: "🚪", nome: () => t("Spegni tutto quando esce l'ultimo", "Turn everything off when the last person leaves"),
    cosa: () => t("Quando in casa non resta nessuno spegne luci e dispositivi scelti.", "When nobody is left at home it turns off the chosen lights and devices."),
    serve: () => persone().length > 0 && luciContate().length > 0,
    campi: () => [{ k: "cose", tipo: "ent", titolo: t("Cosa spegnere", "What to turn off"), filtro: id => /^(light|switch|media_player|fan|climate)\./.test(id), multi: true, auto: luciOk },
      ...(allarmi().length ? [{ k: "allarme", tipo: "ent", titolo: t("Inserisci anche l'allarme (facoltativo)", "Also arm the alarm (optional)"), filtro: id => id.startsWith("alarm_control_panel."), multi: false, facoltativo: true, auto: () => [] }] : [])],
    crea: v => ({ nome: t("Esce l'ultimo: spegni tutto", "Last one out: all off"), quando: [{ tipo: "casa", evento: "ultimo" }], soloSe: { modo: "e", cond: [] },
      azioni: [{ tipo: "off", entita: v.cose }, ...(v.allarme?.length ? [{ tipo: "allarme", entita: v.allarme, modo: "alarm_arm_away" }] : [])] }) },

  { k: "buongiorno", ic: "☀️", nome: () => t("Buongiorno", "Good morning"),
    cosa: () => t("All'ora della sveglia, nei giorni feriali, alza le tapparelle, accende il clima e Alexa dà il buongiorno.", "At wake-up time on weekdays it raises the covers, turns on the climate and Alexa says good morning."),
    serve: () => tapparelle().length + clima().length + echi().length > 0,
    campi: () => [{ k: "ora", tipo: "ora", titolo: t("A che ora", "What time"), auto: () => "07:00" },
      ...(tapparelle().length ? [{ k: "tapp", tipo: "ent", titolo: t("Tapparelle da alzare", "Covers to raise"), filtro: id => id.startsWith("cover.") && !varco(id), multi: true, facoltativo: true, auto: tapparelle }] : []),
      ...(clima().length ? [{ k: "clima", tipo: "ent", titolo: t("Clima da accendere", "Climate to turn on"), filtro: id => id.startsWith("climate."), multi: true, facoltativo: true, auto: () => clima().slice(0, 1) },
        { k: "temp", tipo: "num", titolo: t("Temperatura (°)", "Temperature (°)"), auto: () => 21 }] : []),
      ...campoEcho()],
    crea: v => ({ nome: t("Buongiorno", "Good morning"), quando: [{ tipo: "ora", ora: v.ora || "07:00" }], soloSe: { modo: "e", cond: [{ tipo: "orario", giorni: ["mon", "tue", "wed", "thu", "fri"] }] },
      azioni: [...(v.tapp?.length ? [{ tipo: "tapparella", entita: v.tapp, pos: 100 }] : []), ...(v.clima?.length ? [{ tipo: "clima", entita: v.clima, modo: "heat", temp: +v.temp || 21 }] : []),
        ...alexa(v.echo, t("Buongiorno! È ora di alzarsi", "Good morning! Time to get up"))] }) },

  { k: "buonanotte", ic: "🌙", nome: () => t("Buonanotte", "Good night"),
    cosa: () => t("La sera, all'ora scelta, spegne le luci, abbassa le tapparelle e, se vuoi, inserisce l'allarme notte.", "In the evening, at the chosen time, it turns off the lights, lowers the covers and, if you want, arms the alarm for the night."),
    serve: () => luciContate().length > 0,
    campi: () => [{ k: "ora", tipo: "ora", titolo: t("A che ora", "What time"), auto: () => "23:30" },
      { k: "luci", tipo: "ent", titolo: t("Luci da spegnere", "Lights to turn off"), filtro: luce, multi: true, auto: luciOk },
      ...(tapparelle().length ? [{ k: "tapp", tipo: "ent", titolo: t("Tapparelle da abbassare", "Covers to lower"), filtro: id => id.startsWith("cover.") && !varco(id), multi: true, facoltativo: true, auto: tapparelle }] : []),
      ...(allarmi().length ? [{ k: "allarme", tipo: "ent", titolo: t("Allarme notte (facoltativo)", "Night alarm (optional)"), filtro: id => id.startsWith("alarm_control_panel."), multi: false, facoltativo: true, auto: () => [] }] : [])],
    crea: v => ({ nome: t("Buonanotte", "Good night"), quando: [{ tipo: "ora", ora: v.ora || "23:30" }], soloSe: { modo: "e", cond: [{ tipo: "casa", chi: "qualcuno" }] },
      azioni: [{ tipo: "off", entita: v.luci }, ...(v.tapp?.length ? [{ tipo: "tapparella", entita: v.tapp, pos: 0 }] : []), ...(v.allarme?.length ? [{ tipo: "allarme", entita: v.allarme, modo: "alarm_arm_night" }] : [])] }) },

  { k: "pioggia", ic: "🌧️", nome: () => t("Finestra aperta e pioggia in arrivo", "Window open and rain coming"),
    cosa: () => t("Quando il meteo annuncia pioggia e c'è una finestra aperta, ti avvisa.", "When the weather says rain and a window is open, it lets you know."),
    serve: () => !!weatherEnt() && finestre().length > 0,
    campi: () => [{ k: "fin", tipo: "ent", titolo: t("Quali finestre", "Which windows"), filtro: id => apertura(id), multi: true, auto: finestre }, ...campoTel(), ...campoEcho()],
    crea: v => ({ nome: t("Pioggia con finestre aperte", "Rain with windows open"), quando: [{ tipo: "pioggia" }], soloSe: { modo: "o", cond: (v.fin || []).map(id => ({ tipo: "stato", entita: id, stato: "on" })) },
      azioni: [notifica(t("🌧️ Sta arrivando la pioggia e c'è una finestra aperta", "🌧️ Rain is coming and a window is open"), v.tel), ...alexa(v.echo, t("Sta arrivando la pioggia e c'è una finestra aperta", "Rain is coming and a window is open"))] }) },

  { k: "porta", ic: "🚪", nome: () => t("Porta aperta da 5 minuti", "Door open for 5 minutes"),
    cosa: () => t("Se una porta resta aperta troppo a lungo, ti avvisa.", "If a door stays open too long, it lets you know."),
    serve: () => porte().length > 0,
    campi: () => [{ k: "porte", tipo: "ent", titolo: t("Quali porte", "Which doors"), filtro: id => apertura(id), multi: true, auto: porte }, { k: "min", tipo: "num", titolo: t("Dopo quanti minuti", "After how many minutes"), auto: () => 5 }, ...campoTel(), ...campoEcho()],
    crea: v => ({ nome: t("Porta rimasta aperta", "Door left open"), quando: [{ tipo: "apertura", entita: v.porte, min: +v.min || 5 }], soloSe: { modo: "e", cond: [] },
      azioni: [notifica(t(`🚪 Una porta è aperta da ${+v.min || 5} minuti`, `🚪 A door has been open for ${+v.min || 5} minutes`), v.tel), ...alexa(v.echo, t("Attenzione, una porta è rimasta aperta", "Heads up, a door was left open"))] }) },

  { k: "lavatrice", ic: "🧺", nome: () => t("Lavatrice finita su Alexa e sul telefono", "Washer done on Alexa and phone"),
    cosa: () => t("Quando l'elettrodomestico finisce (dal consumo, con le soglie della pagina Elettrodomestici) lo dice Alexa e arriva una notifica.", "When the appliance is done (from its power use, with the thresholds of the Appliances page) Alexa says so and a notification arrives."),
    serve: () => elettrodomestici().length > 0,
    campi: () => [{ k: "el", tipo: "ent", titolo: t("Quale elettrodomestico (sensore del consumo)", "Which appliance (power sensor)"), filtro: isElettro, multi: false,
      auto: () => { const L = elettrodomestici(); return [L.find(id => /lavatric|washer|washing/i.test(id + nm(id))) || L[0]].filter(Boolean); } }, ...campoTel(), ...campoEcho()],
    crea: v => { const n = v.el?.[0] ? nm(v.el[0]).replace(/\s*(power|potenza|consumo)\s*/ig, " ").trim() : t("La lavatrice", "The washer");
      return { nome: t(`${n} ha finito`, `${n} is done`), quando: [{ tipo: "elettro", entita: v.el?.[0] || "" }], soloSe: { modo: "e", cond: [] },
        azioni: [...alexa(v.echo, t(`${n} ha finito`, `${n} is done`)), notifica(t(`🧺 ${n} ha finito`, `🧺 ${n} is done`), v.tel)] }; } },

  { k: "batteria", ic: "🪫", nome: () => t("Batteria scarica", "Low battery"),
    cosa: () => t("Quando la pila di un sensore scende sotto la soglia, ti avvisa con il suo nome.", "When a sensor's battery drops below the threshold, it tells you which one."),
    serve: () => batterie().length > 0,
    campi: () => [{ k: "bat", tipo: "ent", titolo: t("Quali pile", "Which batteries"), filtro: id => id.startsWith("sensor.") && deviceClass(id) === "battery", multi: true, auto: batterie },
      { k: "soglia", tipo: "num", titolo: t("Sotto il (%)", "Below (%)"), auto: () => 15 }, ...campoTel()],
    crea: v => ({ nome: t("Pila scarica", "Battery low"), quando: [{ tipo: "soglia", entita: v.bat, verso: "sotto", valore: +v.soglia || 15 }], soloSe: { modo: "e", cond: [] },
      azioni: [notifica(t("🪫 Pila scarica: {{ trigger.to_state.name }} è al {{ trigger.to_state.state }}%", "🪫 Battery low: {{ trigger.to_state.name }} is at {{ trigger.to_state.state }}%"), v.tel)] }) },

  { k: "corridoio", ic: "🌙", nome: () => t("Luce del corridoio di notte col movimento", "Hallway light at night on motion"),
    cosa: () => t("Di notte, quando il sensore vede qualcuno, accende la luce per qualche minuto e poi la spegne.", "At night, when the sensor sees someone, it turns on the light for a few minutes and then off."),
    serve: () => allEnts("binary_sensor", movimento).length > 0 && luciContate().length > 0,
    campi: () => [{ k: "mov", tipo: "ent", titolo: t("Sensore di movimento", "Motion sensor"), filtro: movimento, multi: true, auto: () => { const L = allEnts("binary_sensor", movimento); return [L.find(corridoio) || L[0]].filter(Boolean); } },
      { k: "luce", tipo: "ent", titolo: t("Quale luce", "Which light"), filtro: luce, multi: true, auto: () => { const L = luciOk(); return [L.find(corridoio) || L[0]].filter(Boolean); } },
      { k: "min", tipo: "num", titolo: t("Per quanti minuti", "For how many minutes"), auto: () => 2 }, { k: "lum", tipo: "num", titolo: t("Luminosità (%)", "Brightness (%)"), auto: () => 30 }],
    crea: v => ({ nome: t("Corridoio di notte", "Hallway at night"), quando: [{ tipo: "movimento", entita: v.mov, modo: "rilevato" }], soloSe: { modo: "e", cond: [{ tipo: "sole", fase: "notte" }] },
      azioni: [{ tipo: "pertempo", entita: v.luce, minuti: +v.min || 2, ...(+v.lum ? { lum: +v.lum } : {}) }] }) },

  { k: "climafin", ic: "🌡️", nome: () => t("Clima spento con la finestra aperta", "Climate off with the window open"),
    cosa: () => t("Se una finestra resta aperta per qualche minuto, spegne il clima per non sprecare energia.", "If a window stays open for a few minutes, it turns off the climate so no energy is wasted."),
    serve: () => finestre().length > 0 && clima().length > 0,
    campi: () => [{ k: "fin", tipo: "ent", titolo: t("Quali finestre", "Which windows"), filtro: apertura, multi: true, auto: finestre },
      { k: "clima", tipo: "ent", titolo: t("Quale clima", "Which climate"), filtro: id => id.startsWith("climate."), multi: true,
        auto: () => { const A = new Set(finestre().map(areaOf).filter(Boolean)), L = clima().filter(id => A.has(areaOf(id))); return L.length ? L : clima().slice(0, 1); } }, { k: "min", tipo: "num", titolo: t("Dopo quanti minuti", "After how many minutes"), auto: () => 2 }],
    crea: v => ({ nome: t("Finestra aperta: clima spento", "Window open: climate off"), quando: [{ tipo: "apertura", entita: v.fin, min: +v.min || 2 }], soloSe: { modo: "e", cond: [] }, azioni: [{ tipo: "off", entita: v.clima }] }) },

  { k: "consumo", ic: "⚡", nome: () => t("Avviso consumo alto", "High power use alert"),
    cosa: () => t("Quando la casa consuma più della soglia per qualche minuto (rischio che salti la corrente), ti avvisa.", "When the home draws more than the threshold for a few minutes (risk of a power trip), it lets you know."),
    serve: () => potenzaCasa().length > 0,
    campi: () => [{ k: "sens", tipo: "ent", titolo: t("Sensore del consumo della casa", "Home power sensor"), filtro: id => id.startsWith("sensor.") && deviceClass(id) === "power", multi: false, auto: () => potenzaCasa().slice(0, 1) },
      { k: "soglia", tipo: "num", titolo: t("Sopra (nell'unità del sensore)", "Above (in the sensor's unit)"), auto: () => { const s = potenzaCasa()[0]; return s && /kw/i.test(unit(s)) ? 3 : 3000; } },
      { k: "min", tipo: "num", titolo: t("Per almeno (minuti)", "For at least (minutes)"), auto: () => 2 }, ...campoTel(), ...campoEcho()],
    crea: v => ({ nome: t("Consumo alto", "High power use"), quando: [{ tipo: "soglia", entita: v.sens, verso: "sopra", valore: +v.soglia || 3000, per: +v.min || 2 }], soloSe: { modo: "e", cond: [] },
      azioni: [notifica(t("⚡ La casa sta consumando tanto: spegni qualcosa", "⚡ The home is drawing a lot: turn something off"), v.tel), ...alexa(v.echo, t("Attenzione, la casa sta consumando tanto", "Heads up, the home is drawing a lot of power"))] }) },

  { k: "irrigazione", ic: "💧", nome: () => t("Irrigazione saltata se piove", "Skip watering when it rains"),
    cosa: () => t("Quando il meteo annuncia pioggia chiude le zone dell'irrigazione e ti avvisa.", "When the weather says rain it closes the watering zones and lets you know."),
    serve: () => !!weatherEnt() && zoneAcqua().length > 0,
    campi: () => [{ k: "zone", tipo: "ent", titolo: t("Zone dell'irrigazione", "Watering zones"), filtro: id => /^(valve|switch)\./.test(id), multi: true, auto: zoneAcqua }, ...campoTel()],
    crea: v => ({ nome: t("Piove: niente irrigazione", "Rain: no watering"), quando: [{ tipo: "pioggia" }], soloSe: { modo: "e", cond: [] },
      azioni: [{ tipo: "off", entita: v.zone }, notifica(t("💧 Piove: ho fermato l'irrigazione", "💧 It's raining: I stopped the watering"), v.tel)] }) },
];
/** le ricette per questa casa */
export const ricetteDisponibili = () => RICETTE().filter(r => { try { return r.serve(); } catch { return false; } });
/** i valori di partenza dei campi di una ricetta */
export function valoriIniziali(r) {
  const v = {};
  for (const c of r.campi()) { let x; try { x = c.auto?.(); } catch { x = null; } v[c.k] = c.tipo === "ent" ? (Array.isArray(x) ? x : x ? [x] : []).filter(id => S[id]) : x ?? ""; }
  return v;
}
/** che cosa manca nei campi (testo) o null */
export function mancaRicetta(r, v) {
  for (const c of r.campi()) if (c.tipo === "ent" && !c.facoltativo && !(v[c.k] || []).length) return t("Scegli: ", "Choose: ") + c.titolo.toLowerCase();
  return null;
}

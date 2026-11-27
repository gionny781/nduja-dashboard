// Prova delle automazioni (0.7.64) sul finto Home Assistant: per ogni tipo di «Quando», «Solo se» e «Allora» e per ogni ricetta
// controlla la configurazione generata (sintassi di oggi: triggers / conditions / actions), che riletta e riscritta torni identica,
// legge in frase le automazioni «fatte in Home Assistant» del finto e misura la pagina con tante entità.
// Uso (dalla radice del repo, con `python3 -m http.server 8765` acceso):  node tools/mock/automazioni.mjs   (TANTE=3000 per la velocità)
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on("pageerror", e => console.log("PAGEERR", e.message));
await p.goto(`http://localhost:${process.env.PORT || 8765}/tools/mock/host.html`);
await p.evaluate(n => { localStorage.clear(); if (n) localStorage.setItem("mockTante", n); }, process.env.TANTE || "");
await p.reload(); await p.waitForTimeout(3500);
const f = p.frames()[1];
await f.evaluate(() => location.hash = "automazioni"); await p.waitForTimeout(2000);
const esito = await f.evaluate(async () => {
  const M = await import("/custom_components/nduja_dashboard/frontend/js/automazioni-modello.js");
  const R = await import("/custom_components/nduja_dashboard/frontend/js/automazioni-ricette.js");
  const core = await import("/custom_components/nduja_dashboard/frontend/js/core.js");
  const out = { ok: 0, ko: [], frasi: [], ricette: [], ha: [] };
  const ord = x => Array.isArray(x) ? x.map(ord) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ord(x[k])])) : x;
  const J = x => JSON.stringify(ord(x));
  const mod = (quando, cond = [], azioni = [{ tipo: "on", entita: ["light.soggiorno"] }], modo = "e") => ({ v: 2, nome: "Prova", quando, soloSe: { modo, cond }, azioni });
  /** controlla: configurazione attesa (pezzo) e giro completo modello → HA → modello → HA */
  const prova = (nome, m, chiave, atteso) => {
    const cfg = M.inHA(m, "prova1"), got = chiave === "triggers" ? cfg.triggers : chiave === "conditions" ? cfg.conditions : cfg.actions;
    const r = M.daHA(JSON.parse(JSON.stringify(cfg))), giro = r.modificabile && M.uguali(M.inHA(r.modello, "prova1"), cfg);
    const err = M.controlla(m);
    if (J(got) !== J(atteso) || !giro || err) out.ko.push({ nome, got, atteso, giro, motivo: r.motivo, err });
    else out.ok++;
    out.frasi.push(nome + " → " + M.fraseTesto(m));
  };
  const L = "light.soggiorno";
  /* ---------- QUANDO ---------- */
  prova("Q ora", mod([{ tipo: "ora", ora: "07:30" }]), "triggers", [{ trigger: "time", at: "07:30:00" }]);
  prova("Q sole", mod([{ tipo: "sole", evento: "sunset", offset: -30 }]), "triggers", [{ trigger: "sun", event: "sunset", offset: "-00:30:00" }]);
  prova("Q stato", mod([{ tipo: "stato", entita: ["binary_sensor.finestra_soggiorno"], a: "on", per: 2 }]), "triggers", [{ trigger: "state", entity_id: ["binary_sensor.finestra_soggiorno"], to: "on", for: { minutes: 2 } }]);
  prova("Q stato qualsiasi", mod([{ tipo: "stato", entita: ["cover.tapparella_soggiorno"], a: "*" }]), "triggers", [{ trigger: "state", entity_id: ["cover.tapparella_soggiorno"] }]);
  prova("Q soglia", mod([{ tipo: "soglia", entita: ["sensor.grid_power"], verso: "sopra", valore: "3000", per: "5" }]), "triggers", [{ trigger: "numeric_state", entity_id: ["sensor.grid_power"], above: 3000, for: { minutes: 5 } }]);
  prova("Q soglia sotto", mod([{ tipo: "soglia", entita: ["sensor.battery_soc"], verso: "sotto", valore: 20 }]), "triggers", [{ trigger: "numeric_state", entity_id: ["sensor.battery_soc"], below: 20 }]);
  prova("Q apertura", mod([{ tipo: "apertura", entita: ["binary_sensor.porta_ingresso"], min: 5 }]), "triggers", [{ trigger: "state", entity_id: ["binary_sensor.porta_ingresso"], to: "on", for: { minutes: 5 } }]);
  prova("Q movimento", mod([{ tipo: "movimento", entita: ["binary_sensor.movimento_ingresso"], modo: "rilevato" }]), "triggers", [{ trigger: "state", entity_id: ["binary_sensor.movimento_ingresso"], to: "on" }]);
  prova("Q nessun movimento", mod([{ tipo: "movimento", entita: ["binary_sensor.movimento_ingresso"], modo: "nessuno", min: 15 }]), "triggers", [{ trigger: "state", entity_id: ["binary_sensor.movimento_ingresso"], to: "off", for: { minutes: 15 } }]);
  prova("Q persona", mod([{ tipo: "persona", persona: ["person.anna"], evento: "arriva" }]), "triggers", [{ trigger: "zone", entity_id: ["person.anna"], zone: "zone.home", event: "enter" }]);
  prova("Q ultimo esce", mod([{ tipo: "casa", evento: "ultimo" }]), "triggers", [{ trigger: "state", entity_id: "zone.home", to: "0" }]);
  prova("Q primo arriva", mod([{ tipo: "casa", evento: "primo" }]), "triggers", [{ trigger: "numeric_state", entity_id: "zone.home", above: 0 }]);
  prova("Q pulsante event", mod([{ tipo: "pulsante", entita: "event.telecomando_ikea_azione", pressione: "on" }]), "triggers", [{ trigger: "state", entity_id: ["event.telecomando_ikea_azione"], not_from: ["unavailable", "unknown"], not_to: ["unavailable", "unknown"] }]);
  prova("Q pulsante event (filtro)", mod([{ tipo: "pulsante", entita: "event.telecomando_ikea_azione", pressione: "on" }]), "conditions", [{ condition: "state", entity_id: "event.telecomando_ikea_azione", attribute: "event_type", state: "on" }]);
  prova("Q pulsante dispositivo", mod([{ tipo: "pulsante", device: { domain: "zha", device_id: "dev_b_telecomando_ikea", type: "remote_button_short_press", subtype: "turn_on" } }]), "triggers", [{ trigger: "device", domain: "zha", device_id: "dev_b_telecomando_ikea", type: "remote_button_short_press", subtype: "turn_on" }]);
  const el = M.elettrodomestici()[0], g = (await import("/custom_components/nduja_dashboard/frontend/js/avvisi.js")).soglie(el);
  prova("Q elettrodomestico", mod([{ tipo: "elettro", entita: el }]), "triggers", [{ trigger: "numeric_state", entity_id: [el], below: g.off, for: { minutes: g.min } }]);
  prova("Q allarme inserito", mod([{ tipo: "allarme", entita: ["alarm_control_panel.alarmo"], evento: "inserito" }]), "triggers", [{ trigger: "state", entity_id: ["alarm_control_panel.alarmo"], to: ["armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass"] }]);
  prova("Q allarme scattato", mod([{ tipo: "allarme", entita: ["alarm_control_panel.alarmo"], evento: "scattato" }]), "triggers", [{ trigger: "state", entity_id: ["alarm_control_panel.alarmo"], to: "triggered" }]);
  prova("Q calendario", mod([{ tipo: "calendario", entita: "calendar.famiglia", prima: 15 }]), "triggers", [{ trigger: "calendar", event: "start", entity_id: "calendar.famiglia", offset: "-00:15:00" }]);
  prova("Q pioggia", mod([{ tipo: "pioggia", entita: ["weather.forecast_casa"] }]), "triggers", [{ trigger: "state", entity_id: ["weather.forecast_casa"], to: ["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"] }]);
  prova("Q due quando", mod([{ tipo: "ora", ora: "07:00" }, { tipo: "persona", persona: ["person.mario"], evento: "esce" }]), "triggers", [{ trigger: "time", at: "07:00:00" }, { trigger: "zone", entity_id: ["person.mario"], zone: "zone.home", event: "leave" }]);
  /* ---------- SOLO SE ---------- */
  const T = [{ tipo: "ora", ora: "07:00" }];
  prova("C qualcuno", mod(T, [{ tipo: "casa", chi: "qualcuno" }]), "conditions", [{ condition: "numeric_state", entity_id: "zone.home", above: 0 }]);
  prova("C nessuno", mod(T, [{ tipo: "casa", chi: "nessuno" }]), "conditions", [{ condition: "state", entity_id: "zone.home", state: "0" }]);
  prova("C persona in casa", mod(T, [{ tipo: "casa", chi: "person.anna", dentro: true }]), "conditions", [{ condition: "state", entity_id: "person.anna", state: "home" }]);
  prova("C persona fuori", mod(T, [{ tipo: "casa", chi: "person.mario", dentro: false }]), "conditions", [{ condition: "not", conditions: [{ condition: "state", entity_id: "person.mario", state: "home" }] }]);
  prova("C orario e giorni", mod(T, [{ tipo: "orario", dalle: "22:00", alle: "06:00", giorni: ["sat", "sun"] }]), "conditions", [{ condition: "time", after: "22:00:00", before: "06:00:00", weekday: ["sat", "sun"] }]);
  prova("C notte", mod(T, [{ tipo: "sole", fase: "notte" }]), "conditions", [{ condition: "state", entity_id: "sun.sun", state: "below_horizon" }]);
  prova("C stato", mod(T, [{ tipo: "stato", entita: "cover.tapparella_soggiorno", stato: "open" }]), "conditions", [{ condition: "state", entity_id: ["cover.tapparella_soggiorno"], state: "open" }]);
  prova("C valore", mod(T, [{ tipo: "valore", entita: "sensor.grid_power", verso: "sotto", valore: "500" }]), "conditions", [{ condition: "numeric_state", entity_id: ["sensor.grid_power"], below: 500 }]);
  prova("C «o»", mod(T, [{ tipo: "sole", fase: "notte" }, { tipo: "casa", chi: "nessuno" }], undefined, "o"), "conditions", [{ condition: "or", conditions: [{ condition: "state", entity_id: "sun.sun", state: "below_horizon" }, { condition: "state", entity_id: "zone.home", state: "0" }] }]);
  /* ---------- ALLORA ---------- */
  const A = a => mod(T, [], a);
  prova("A accendi luce", A([{ tipo: "on", entita: [L, "switch.relay_1"], lum: 60, kelvin: 2700 }]), "actions", [{ action: "light.turn_on", target: { entity_id: [L] }, data: { brightness_pct: 60, color_temp_kelvin: 2700 } }, { action: "switch.turn_on", target: { entity_id: ["switch.relay_1"] } }]);
  prova("A colore", A([{ tipo: "on", entita: [L], colore: "#ff8000" }]), "actions", [{ action: "light.turn_on", target: { entity_id: [L] }, data: { rgb_color: [255, 128, 0] } }]);
  prova("A spegni", A([{ tipo: "off", entita: [L, "cover.tapparella_cucina"] }]), "actions", [{ action: "light.turn_off", target: { entity_id: [L] } }, { action: "cover.close_cover", target: { entity_id: ["cover.tapparella_cucina"] } }]);
  prova("A commuta", A([{ tipo: "toggle", entita: [L] }]), "actions", [{ action: "light.toggle", target: { entity_id: [L] } }]);
  prova("A per N minuti", A([{ tipo: "pertempo", entita: ["light.giardino_portico"], minuti: 3, lum: 40 }]), "actions", [{ action: "light.turn_on", target: { entity_id: ["light.giardino_portico"] }, data: { brightness_pct: 40 } }, { delay: { minutes: 3 } }, { action: "light.turn_off", target: { entity_id: ["light.giardino_portico"] } }]);
  prova("A tapparelle %", A([{ tipo: "tapparella", entita: ["cover.tapparella_soggiorno"], pos: "40" }]), "actions", [{ action: "cover.set_cover_position", target: { entity_id: ["cover.tapparella_soggiorno"] }, data: { position: 40 } }]);
  prova("A clima", A([{ tipo: "clima", entita: ["climate.soggiorno"], modo: "heat", temp: "21" }]), "actions", [{ action: "climate.set_temperature", target: { entity_id: ["climate.soggiorno"] }, data: { temperature: 21, hvac_mode: "heat" } }]);
  prova("A clima solo modo", A([{ tipo: "clima", entita: ["climate.soggiorno"], modo: "off" }]), "actions", [{ action: "climate.set_hvac_mode", target: { entity_id: ["climate.soggiorno"] }, data: { hvac_mode: "off" } }]);
  prova("A scena", A([{ tipo: "scena", entita: ["scene.film"] }]), "actions", [{ action: "scene.turn_on", target: { entity_id: ["scene.film"] } }]);
  prova("A altra automazione", A([{ tipo: "automazione", entita: ["automation.raccolta"] }]), "actions", [{ action: "automation.trigger", target: { entity_id: ["automation.raccolta"] } }]);
  prova("A allarme", A([{ tipo: "allarme", entita: ["alarm_control_panel.alarmo"], modo: "alarm_arm_night", codice: "1234" }]), "actions", [{ action: "alarm_control_panel.alarm_arm_night", target: { entity_id: ["alarm_control_panel.alarmo"] }, data: { code: "1234" } }]);
  prova("A notifica", A([{ tipo: "notifica", servizio: "mobile_app_iphone_di_anna", messaggio: "Ciao", apri: true }]), "actions", [{ action: "notify.mobile_app_iphone_di_anna", data: { message: "Ciao", title: "🌶️ Prova", data: { url: "/nduja", clickAction: "/nduja", actions: [{ action: "URI", title: core.t("Apri 'Nduja", "Open 'Nduja"), uri: "/nduja" }] } } }]);
  prova("A Alexa", A([{ tipo: "alexa", entita: ["media_player.echo_cucina"], messaggio: "La lavatrice ha finito", modo: "announce" }]), "actions", [{ action: "notify.alexa_media", data: { message: "La lavatrice ha finito", target: ["media_player.echo_cucina"], data: { type: "announce" } } }]);
  prova("A aspetta", A([{ tipo: "attendi", minuti: 10 }, { tipo: "off", entita: [L] }]), "actions", [{ delay: { minutes: 10 } }, { action: "light.turn_off", target: { entity_id: [L] } }]);
  /* ---------- vecchio modello (0.7.22): stessa configurazione di prima ---------- */
  const vecchio = { nome: "Vecchia", quando: { tipo: "ora", ora: "07:00", giorni: ["mon", "fri"] }, soloSe: { dalle: "06:00", alle: "09:00", casa: "" }, azioni: [{ tipo: "on", entita: [L], lum: "50" }] };
  const cv = M.inHA(vecchio, "v1");
  if (J(cv.conditions) === J([{ condition: "time", weekday: ["mon", "fri"] }, { condition: "time", after: "06:00:00", before: "09:00:00" }]) && J(cv.triggers) === J([{ trigger: "time", at: "07:00:00" }])) out.ok++; else out.ko.push({ nome: "vecchio modello", got: cv });
  /* «c'è qualcuno in casa» del 0.7.22: elenco delle persone, si riapre identica */
  const P = core.idsDi("person").filter(x => !core.REG[x]?.hidden), vq = { nome: "Vecchia2", quando: { tipo: "sole", evento: "sunset", offset: 0 }, soloSe: { casa: "qualcuno" }, azioni: [{ tipo: "on", entita: [L] }] };
  const cq = { id: "v2", alias: "Vecchia2", description: "Creata con 'Nduja Dashboard", triggers: [{ trigger: "sun", event: "sunset", offset: "00:00:00" }], conditions: [{ condition: "or", conditions: P.map(p => ({ condition: "state", entity_id: p, state: "home" })) }], actions: [{ action: "light.turn_on", target: { entity_id: [L] } }], mode: "single" };
  if (M.uguali(M.inHA(vq, "v2"), cq) && M.daHA(cq).modificabile) out.ok++; else out.ko.push({ nome: "vecchio «qualcuno»", got: M.inHA(vq, "v2") });
  /* ---------- ricette ---------- */
  for (const r of R.ricetteDisponibili()) {
    const v = R.valoriIniziali(r), manca = R.mancaRicetta(r, v), m = M.normalizza({ v: 2, ...r.crea(v) }), err = M.controlla(m), cfg = M.inHA(m, "r_" + r.k), d = M.daHA(JSON.parse(JSON.stringify(cfg)));
    const buona = !manca && !err && d.modificabile && cfg.triggers.length && cfg.actions.length;
    if (buona) out.ok++; else out.ko.push({ nome: "ricetta " + r.k, manca, err, motivo: d.motivo, cfg });
    out.ricette.push(r.k + " → " + M.fraseTesto(m));
  }
  /* ---------- automazioni «fatte in Home Assistant»: frase e se si possono modificare ---------- */
  for (const id of core.idsDi("automation").filter(x => !x.includes("finta_"))) {
    let cfg; try { cfg = (await core.ws({ type: "automation/config", entity_id: id })).config; } catch { continue; }
    const r = M.daHA(cfg);
    out.ha.push(`${r.modificabile ? "✏️" : "👁"} ${core.nm(id)}: ${M.fraseTesto(r.modificabile ? r.modello : null, r.modificabile ? null : { quando: r.quando, cond: r.cond, azioni: r.azioni, modo: r.modello.soloSe.modo })}${r.modificabile ? "" : "  [" + r.motivo + "]"}`);
  }
  /* ---------- velocità della pagina ---------- */
  const PG = core.PAGES.automazioni; PG.render(); const t0 = performance.now(); for (let i = 0; i < 5; i++) PG.render(); out.ms = Math.round((performance.now() - t0) / 5);
  out.entita = Object.keys(core.S).length; out.auto = core.idsDi("automation").length;
  return out;
});
console.log(`✅ ${esito.ok} prove giuste · ❌ ${esito.ko.length} sbagliate`);
for (const k of esito.ko) console.log("❌", JSON.stringify(k));
console.log("\n— frasi del costruttore —"); esito.frasi.forEach(x => console.log(" ", x));
console.log("\n— ricette —"); esito.ricette.forEach(x => console.log(" ", x));
console.log("\n— automazioni di Home Assistant —"); esito.ha.forEach(x => console.log(" ", x));
console.log(`\nPagina Automazioni: ${esito.ms} ms a disegno con ${esito.entita} entità e ${esito.auto} automazioni`);
await b.close();
process.exit(esito.ko.length ? 1 : 0);

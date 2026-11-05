/* 'Nduja Dashboard — Assistente vocale: si parla o si scrive alla casa con Assist di Home Assistant.
   - Scrivere: conversation/process, con l'agente e la lingua della pipeline scelta e con conversation_id
     per tenere il filo del discorso (Home Assistant lo dimentica dopo qualche minuto di silenzio).
   - Parlare: assist_pipeline/run dal microfono del browser. L'audio va a Home Assistant come messaggi binari
     sulla websocket già aperta: primo byte = il numero che Home Assistant dà in «run-start», poi PCM a 16 bit,
     16 kHz, mono (microfono.js); un messaggio con il solo numero vuol dire «ho finito».
     Home Assistant capisce da solo quando hai smesso di parlare; si può anche toccare ■.
   - La risposta compare scritta e, se la pipeline ha una voce e l'utente lo vuole, si sente.
   Niente servizi esterni aggiunti dalla plancia: si parla solo con Home Assistant (che usa le pipeline
   configurate lì, anche con Gemini o OpenAI). Tutte le scelte sono di questo dispositivo:
   ⚙️ Impostazioni → Assistente vocale. */
import { S, ACT, CHG, UI, STRIP, FISSI, PAGES, AREAS, t, LOC, esc, sGet, sSet, ws, conn, toast, openSheet, render, sicuro,
  areasSorted, roomTemp, luci, allEnts, nmHA, hhmm } from "./core.js";

/* ================= scelte (di questo dispositivo) ================= */
const BTN = ["tutti", "alto", "no"];
const asPipe = () => sGet("asPipe") || "";                                  // "" = la predefinita di Home Assistant
const asLang = () => sGet("asLang") || "";                                  // "" = automatica (quella della pipeline)
const asBtn = () => BTN.includes(sGet("asBtn")) ? sGet("asBtn") : "tutti";  // tutti | alto | no
const asVoce = () => sGet("asVoce") !== "0";                                // risposta letta ad alta voce
const asFrasi = () => String(sGet("asFrasi") || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 12);
const MAX_STORIA = 30;                 // messaggi tenuti sul dispositivo
const FILO = 5 * 60000;                // dopo 5 minuti di silenzio si ricomincia un discorso nuovo
const MAX_ASCOLTO = 30000;             // il microfono si chiude da solo dopo 30 secondi

/* ================= pipeline di Home Assistant ================= */
const PL = { v: null, t: 0, carica: false };
/** { pipelines: [...], preferred_pipeline } oppure { errore } (Assist non attivo); null mentre arriva */
function pipeline(forza) {
  if (!PL.carica && (forza || !PL.v || Date.now() - PL.t > 10 * 60000)) {
    PL.carica = true;
    ws({ type: "assist_pipeline/pipeline/list" })
      .then(r => { PL.v = { pipelines: r?.pipelines || [], preferred_pipeline: r?.preferred_pipeline || null }; })
      .catch(e => { PL.v = { pipelines: [], errore: e?.code || e?.message || "?" }; })
      .finally(() => { PL.t = Date.now(); PL.carica = false; render(); });
  }
  return PL.v;
}
const base = l => String(l || "").toLowerCase().split(/[-_]/)[0];
const lingueUguali = (a, b) => !!a && !!b && base(a) === base(b);
/** la pipeline da usare: quella scelta; se no la predefinita, oppure (con una lingua scelta) la prima di quella lingua */
function pipeScelta(auto) {
  const P = pipeline(), L = P?.pipelines || [];
  if (!L.length) return null;
  const sc = !auto && L.find(p => p.id === asPipe()); if (sc) return sc;
  const pref = L.find(p => p.id === P.preferred_pipeline) || L[0], lg = asLang();
  if (lg && !lingueUguali(pref.language, lg)) return L.find(p => lingueUguali(p.language, lg)) || pref;
  return pref;
}
/** la lingua della conversazione */
function lingua(p = pipeScelta()) {
  if (asLang()) return asLang();
  const c = p?.conversation_language;
  return c && c !== "*" ? c : p?.language || LOC.slice(0, 2);
}
const nomeLingua = l => { try { const n = new Intl.DisplayNames([LOC], { type: "language" }).of(l); return n ? n[0].toUpperCase() + n.slice(1) : l; } catch { return l; } };
/** nome dell'agente di conversazione (Home Assistant, Gemini, OpenAI…) */
function nomeAgente(p) {
  const e = p?.conversation_engine || "";
  if (!e || e === "homeassistant" || e === "conversation.home_assistant") return "Home Assistant";
  return S[e] ? nmHA(e) : "";   // agente senza entità: non invento un nome
}

/* ================= cronologia breve (solo su questo dispositivo) ================= */
function leggiStoria() { try { const L = JSON.parse(sGet("asStoria") || "[]"); return Array.isArray(L) ? L.filter(m => m && (m.sep || m.testo)).slice(-MAX_STORIA) : []; } catch { return []; } }
const V = { stato: "", msg: leggiStoria(), conv: null, convT: 0, nota: "", scrive: "", attesa: "" };
// stato: "" | "avvio" (accendo il microfono) | "ascolto" | "penso" | "attendo" (risposta scritta, arriva la voce) | "parla"
function salvaStoria() { V.msg = V.msg.slice(-MAX_STORIA); while (V.msg[0]?.sep) V.msg.shift(); sSet("asStoria", JSON.stringify(V.msg)); }
function aggiungi(da, testo, x = {}) { if (!String(testo || "").trim()) return; V.msg.push({ da, testo: String(testo).trim(), ts: Date.now(), ...x }); salvaStoria(); }
/** il discorso di adesso (null = nuovo) */
const filo = () => V.conv && Date.now() - V.convT < FILO ? V.conv : null;
function tieniFilo(id) { if (id) { V.conv = id; V.convT = Date.now(); } }
const testoRisposta = r => r?.speech?.plain?.speech || r?.speech?.ssml?.speech || "";

/* ================= scrivere ================= */
const occupato = () => ["avvio", "ascolto", "penso", "attendo"].includes(V.stato);
async function scrivi(testo) {
  testo = String(testo || "").trim();
  if (!testo) return;
  if (occupato()) { toast(t("Un attimo: sto ancora rispondendo", "Just a moment: still answering")); return; }
  zitto();
  V.nota = ""; aggiungi("io", testo); V.stato = "penso"; render();
  const p = pipeScelta(), msg = { type: "conversation/process", text: testo, conversation_id: filo(), language: lingua(p) };
  if (p?.conversation_engine) msg.agent_id = p.conversation_engine;
  try {
    const r = await ws(msg);
    tieniFilo(r?.conversation_id);
    aggiungi("casa", testoRisposta(r?.response) || t("Fatto.", "Done."), r?.response?.response_type === "error" ? { err: 1 } : {});
  } catch (e) {
    aggiungi("casa", t("L'assistente non risponde: ", "The assistant isn't answering: ") + (e?.message || e?.code || "?"), { err: 1 });
  }
  V.stato = ""; render();
}

/* ================= parlare ================= */
const stretto = () => matchMedia("(max-width:860px)").matches;
/** si può usare il microfono qui? (serve HTTPS: i browser lo danno solo alle pagine sicure) */
const micPossibile = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));
function perchéNoMic() {
  if (!window.isSecureContext) return t("Per parlare serve l'indirizzo sicuro di Home Assistant (https://, per esempio con Home Assistant Cloud o un certificato): su http:// il browser non dà il microfono. Intanto puoi scrivere.",
    "Speaking needs Home Assistant's secure address (https://, e.g. with Home Assistant Cloud or a certificate): on http:// the browser won't give access to the microphone. You can type meanwhile.");
  return t("Questo browser non permette di usare il microfono qui. Puoi scrivere.", "This browser doesn't allow the microphone here. You can type.");
}
/* una corsa (run) di Assist: registratore, numero del gestore audio, audio in attesa, abbonamento */
let R = null;
const AC = () => window.AudioContext || window.webkitAudioContext;

/** il registratore: microfono → 16 kHz mono 16 bit, a pezzi da 80 ms */
async function registratore(ctx, stream, pezzo) {
  const src = ctx.createMediaStreamSource(stream);
  let nodo;
  if (ctx.audioWorklet && window.AudioWorkletNode) {
    await ctx.audioWorklet.addModule(new URL("./microfono.js", import.meta.url));
    nodo = new AudioWorkletNode(ctx, "nduja-microfono");
    nodo.port.onmessage = e => pezzo(e.data);
  } else {
    /* browser vecchi: stessa cosa nel processore classico */
    nodo = ctx.createScriptProcessor(4096, 1, 1);
    const passo = ctx.sampleRate / 16000, buf = new Int16Array(1280); let pos = 0, somma = 0, quanti = 0, n = 0;
    nodo.onaudioprocess = e => {
      const ch = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        somma += ch[i]; quanti++; pos += 1; if (pos < passo) continue; pos -= passo;
        const v = Math.max(-1, Math.min(1, somma / quanti)); somma = 0; quanti = 0;
        buf[n++] = v < 0 ? v * 32768 : v * 32767; if (n === buf.length) { pezzo(buf.slice(0)); n = 0; }
      }
    };
  }
  /* il nodo va collegato a qualcosa perché giri: un guadagno a zero, così non si sente niente */
  const muto = ctx.createGain(); muto.gain.value = 0;
  src.connect(nodo); nodo.connect(muto); muto.connect(ctx.destination);
  return () => { try { src.disconnect(); nodo.disconnect(); muto.disconnect(); } catch {} };
}
/** manda un pezzo di audio a Home Assistant (vuoto = fine) */
function manda(pcm) {
  const s = conn?.socket || conn?.w;
  if (!s || s.readyState !== 1 || R?.id == null) return;
  const b = new Uint8Array(1 + pcm.byteLength); b[0] = R.id;
  b.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 1);
  s.send(b);
}
function livello(pcm) {
  let q = 0; for (let i = 0; i < pcm.length; i += 4) q += pcm[i] * pcm[i];
  const rms = Math.sqrt(q / Math.ceil(pcm.length / 4)) / 32768, l = Math.min(1, Math.pow(rms * 7, .75));
  R.lv = Math.max(l, (R.lv || 0) * .72);
  document.getElementById("vc1w")?.style.setProperty("--l", R.lv.toFixed(3));
}

async function ascolta() {
  if (V.stato === "ascolto" || V.stato === "avvio") return finisci();    // secondo tocco: ho finito di parlare
  if (V.stato === "penso" || V.stato === "attendo") return;
  zitto();
  V.nota = "";
  if (!micPossibile()) { V.nota = perchéNoMic(); render(); return; }
  const P = pipeline(), p = pipeScelta();
  if (P?.errore) { V.nota = t("In questo Home Assistant Assist non è attivo, quindi non si può parlare. Puoi scrivere all'assistente predefinito.", "Assist isn't active in this Home Assistant, so you can't talk. You can type to the default assistant."); render(); return; }
  if (!p) { V.nota = t("Sto ancora leggendo le pipeline di Home Assistant: riprova tra un attimo.", "Still loading Home Assistant's pipelines: try again in a moment."); render(); return; }
  if (!p.stt_engine) { V.nota = t(`La pipeline «${esc(p.name)}» non ha il riconoscimento vocale: aggiungilo in Home Assistant (Impostazioni → Assistenti vocali) o scegline un'altra in ⚙️ Impostazioni. Intanto puoi scrivere.`, `The «${esc(p.name)}» pipeline has no speech-to-text: add it in Home Assistant (Settings → Voice assistants) or pick another one in ⚙️ Settings. You can type meanwhile.`); render(); return; }
  /* nel tocco: audio sbloccato (iPhone) e contesto creato subito */
  sblocca();
  let ctx; try { ctx = new (AC())(); } catch { V.nota = perchéNoMic(); render(); return; }
  const run = R = { id: null, buf: [], fine: false, ctx, stop: null, unsub: null, lv: 0, voce: asVoce() && !!p.tts_engine, pipe: p };
  V.stato = "avvio"; render();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
  catch (e) {
    chiudi(run);
    V.stato = "";
    V.nota = ["NotAllowedError", "SecurityError"].includes(e?.name) ? t("Il microfono non è permesso: consentilo nelle impostazioni del browser (o dell'app) per questo sito e riprova. Intanto puoi scrivere.", "The microphone isn't allowed: allow it for this site in the browser (or app) settings and try again. You can type meanwhile.")
      : e?.name === "NotFoundError" ? t("Non trovo nessun microfono su questo dispositivo. Puoi scrivere.", "No microphone found on this device. You can type.")
      : t("Il microfono non si apre (", "The microphone won't open (") + esc(e?.name || e?.message || "?") + t("). Puoi scrivere.", "). You can type.");
    render(); return;
  }
  if (R !== run || run.fine) { stream.getTracks().forEach(x => x.stop()); return; }   // annullato nel frattempo
  run.stream = stream;
  try {
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    /* senza un tocco (riapertura automatica) alcuni browser tengono l'audio fermo: allora aspetto il tocco */
    if (ctx.state === "suspended") { chiudi(run); V.stato = ""; V.nota = t("Tocca 🎙️ per rispondere.", "Tap 🎙️ to answer."); render(); return; }
    run.stop = await registratore(ctx, stream, pcm => {
      if (R !== run || run.fine) return;
      livello(pcm);
      if (run.id == null) run.buf.push(pcm); else manda(pcm);
    });
    run.unsub = await conn.subscribeMessage(ev => evento(run, ev), {
      type: "assist_pipeline/run", start_stage: "stt", end_stage: run.voce ? "tts" : "intent",
      input: { sample_rate: 16000 }, pipeline: p.id, conversation_id: filo(),
    }, { resubscribe: false });
    if (R !== run) { try { run.unsub?.()?.catch?.(() => {}); } catch {} return; }
  } catch (e) {
    chiudi(run); V.stato = "";
    V.nota = t("Non riesco a parlare con Assist: ", "Can't reach Assist: ") + esc(e?.message || e?.code || "?") + t(". Puoi scrivere.", ". You can type.");
    render(); return;
  }
  if (V.stato === "avvio") V.stato = "ascolto";
  run.timer = setTimeout(() => { if (R === run) finisci(); }, MAX_ASCOLTO);
  render();
}
/** smetto di ascoltare: chiudo il microfono e dico a Home Assistant che ho finito */
function finisci() {
  const run = R; if (!run || run.fine) return;
  if (V.stato === "avvio" && !run.unsub) { chiudi(run); V.stato = ""; render(); return; }   // non ero ancora partito: annullo
  run.fine = true; clearTimeout(run.timer);
  spegniMic(run);
  if (run.id != null) manda(new Int16Array(0));
  if (V.stato === "ascolto" || V.stato === "avvio") V.stato = "penso";
  render();
}
function spegniMic(run) {
  try { run.stop?.(); } catch {}
  run.stream?.getTracks().forEach(x => x.stop());
  if (run.ctx && run.ctx.state !== "closed") run.ctx.close().catch(() => {});
  run.stop = null; run.stream = null; run.ctx = null;
}
/** chiude tutto della corsa (microfono e abbonamento) */
function chiudi(run) {
  if (!run) return;
  run.fine = true; clearTimeout(run.timer);
  spegniMic(run);
  try { run.unsub?.()?.catch?.(() => {}); } catch {}
  run.unsub = null;
  if (R === run) R = null;
}
const ERRORI = () => ({
  "stt-no-text-recognized": t("Non ho sentito niente: riprova un po' più vicino, oppure scrivi.", "I didn't catch anything: try again a little closer, or type."),
  "stt-stream-failed": t("Il riconoscimento vocale si è interrotto: riprova.", "Speech recognition stopped: try again."),
  "stt-provider-missing": t("Il riconoscimento vocale della pipeline non c'è più: controllalo in Home Assistant (Impostazioni → Assistenti vocali).", "The pipeline's speech-to-text is missing: check it in Home Assistant (Settings → Voice assistants)."),
  "stt-provider-unsupported-metadata": t("Il riconoscimento vocale non accetta questa lingua o questo audio: controlla la pipeline in Home Assistant.", "Speech-to-text doesn't accept this language or audio: check the pipeline in Home Assistant."),
  "pipeline-not-found": t("La pipeline scelta non c'è più: scegline un'altra in ⚙️ Impostazioni.", "The chosen pipeline is gone: pick another one in ⚙️ Settings."),
  "intent-failed": t("L'assistente non è riuscito a rispondere: ", "The assistant couldn't answer: "),
  "tts-failed": t("Non riesco a leggere la risposta ad alta voce.", "I can't read the answer aloud."),
});
function evento(run, e) {
  if (R !== run && e?.type !== "tts-end" && e?.type !== "run-end") return;
  const d = e?.data || {};
  switch (e?.type) {
    case "run-start":
      run.id = d.runner_data?.stt_binary_handler_id ?? null;
      if (run.id != null) { run.buf.forEach(manda); run.buf = []; if (run.fine) manda(new Int16Array(0)); }
      break;
    case "stt-vad-end": finisci(); break;                       // Home Assistant ha capito che hai finito di parlare
    case "stt-end":
      finisci();
      if (d.stt_output?.text) aggiungi("io", d.stt_output.text, { voce: 1 });
      V.stato = "penso";
      break;
    case "intent-progress":                                      // risposta che arriva a pezzi (assistenti con IA)
      if (d.chat_log_delta?.content) V.scrive += d.chat_log_delta.content;
      break;
    case "intent-end": {
      const o = d.intent_output || {};
      tieniFilo(o.conversation_id);
      V.scrive = "";
      aggiungi("casa", testoRisposta(o.response) || t("Fatto.", "Done."), o.response?.response_type === "error" ? { err: 1, voce: 1 } : { voce: 1 });
      run.continua = !!o.continue_conversation;
      if (run.voce) V.stato = "attendo";
      else { chiudi(run); V.stato = ""; if (run.continua && UI.sheet === foglio) setTimeout(() => { if (!V.stato && UI.sheet === foglio) ascolta(); }, 400); }
      break;
    }
    case "tts-end": {
      const u = d.tts_output?.url;
      if (u && run.voce) parla(u, run.continua); else if (V.stato === "penso" || V.stato === "attendo") V.stato = "";
      break;
    }
    case "run-end":
      chiudi(run);
      if (V.stato !== "parla") V.stato = "";
      break;
    case "error": {
      const E = ERRORI(), c = d.code;
      chiudi(run); V.scrive = "";
      if (c === "tts-failed") { V.nota = E[c]; if (V.stato !== "parla") V.stato = ""; break; }
      V.stato = "";
      /* problemi dell'ascolto: un avviso sotto, non un messaggio nella cronologia */
      if (/^stt-|^pipeline-/.test(c || "")) { V.nota = E[c] || esc(d.message || "?"); break; }
      aggiungi("casa", c === "intent-failed" ? E[c] + (d.message || "") : E[c] || (d.message || t("Qualcosa non è andato: riprova.", "Something went wrong: try again.")), { err: 1, voce: 1 });
      break;
    }
  }
  render();
}

/* ================= la voce della risposta ================= */
let AU = null;
/* mezzo secondo di silenzio: suonato nel tocco, sblocca l'audio sui telefoni che lo vogliono (iPhone) */
const SILENZIO = (() => {
  const n = 800, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer), s = (o, x) => [...x].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  s(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); s(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, n * 2, true);
  let bin = ""; b.forEach(x => bin += String.fromCharCode(x)); return "data:audio/wav;base64," + btoa(bin);
})();
function sblocca() { try { AU = AU || new Audio(); AU.onended = AU.onerror = null; AU.src = SILENZIO; AU.play()?.catch(() => {}); } catch {} }
function parla(url, continua) {
  AU = AU || new Audio();
  V.stato = "parla"; render();
  const fine = () => {
    if (AU) AU.onended = AU.onerror = null;
    if (V.stato !== "parla") return;
    V.stato = ""; render();
    /* l'assistente fa una domanda: riapro il microfono (solo se il foglio è ancora aperto) */
    if (continua && UI.sheet === foglio) ascolta();
  };
  AU.onended = fine; AU.onerror = fine;
  AU.src = url;
  AU.play()?.catch(fine);
}
/** smette di leggere la risposta */
function zitto() { if (V.stato === "parla") { try { AU?.pause(); } catch {} if (AU) AU.onended = AU.onerror = null; V.stato = ""; } }

/* ================= frasi suggerite ================= */
function stanzaEsempio() {
  const A = areasSorted().filter(a => roomTemp(a) != null);
  return A.find(a => /camer|letto|bed/i.test(AREAS[a].name)) || A[0] || null;
}
/** frasi da toccare: le tue (⚙️), altrimenti gli esempi nella lingua della conversazione; più le ultime dette */
function frasi() {
  const it = base(lingua()) === "it", mie = asFrasi(), a = stanzaEsempio(), r = a ? AREAS[a].name : null;
  let es = mie.length ? mie : [
    luci().length ? (it ? "Spegni tutte le luci" : "Turn off all the lights") : null,
    r ? (it ? `Che temperatura c'è in ${r.toLowerCase()}?` : `What's the temperature in the ${r.toLowerCase()}?`) : null,
    allEnts("todo").length ? (it ? "Aggiungi latte alla spesa" : "Add milk to my shopping list") : null,
  ].filter(Boolean);
  if (!es.length) es = [it ? "Che ore sono?" : "What time is it?"];
  const visti = new Set(es.map(x => x.toLowerCase())), recenti = [];
  for (let i = V.msg.length - 1; i >= 0; i--) {
    const m = V.msg[i];
    if (m.da !== "io" || V.msg[i + 1]?.err || visti.has(m.testo.toLowerCase()) || m.testo.length > 60) continue;   // non ripropongo frasi non capite
    visti.add(m.testo.toLowerCase()); recenti.push(m.testo); if (recenti.length === 3) break;
  }
  return [...es.map(x => [x, ""]), ...recenti.map(x => [x, "rec"])];
}

/* ================= disegno ================= */
const MIC = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.6" y="2.6" width="6.8" height="11.6" rx="3.4" fill="currentColor"/><path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.8v3.2M8.8 21.2h6.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`;
const STOP = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.6" fill="currentColor"/></svg>`;
const INVIA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12 19.5 5l-4.2 15-3.6-6.3z" fill="currentColor"/><path d="m11.7 13.7 7.8-8.7" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/></svg>`;
/** disegno della plancia per il foglio vuoto: la casetta che «ascolta», con le onde della voce */
const DISEGNO = `<svg class="vc1d" viewBox="0 0 120 84" aria-hidden="true">
  <defs><linearGradient id="vc1g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs>
  <g fill="none" stroke-linecap="round"><path class="o3" d="M18 22a46 46 0 0 0 0 40M102 22a46 46 0 0 1 0 40" stroke-width="2.4"/><path class="o2" d="M28 29a32 32 0 0 0 0 26M92 29a32 32 0 0 1 0 26" stroke-width="2.6"/><path class="o1" d="M38 35a18 18 0 0 0 0 14M82 35a18 18 0 0 1 0 14" stroke-width="2.8"/></g>
  <path d="M60 14 41 30v28a4 4 0 0 0 4 4h30a4 4 0 0 0 4-4V30z" fill="url(#vc1g1)"/>
  <path d="M60 14 41 30v28a4 4 0 0 0 4 4h30a4 4 0 0 0 4-4V30z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
  <rect x="56.4" y="31" width="7.2" height="13.5" rx="3.6" fill="#fff"/><path d="M52.6 41.5a7.4 7.4 0 0 0 14.8 0M60 49v4.2M56.6 53.4h6.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
</svg>`;
/** testo della risposta: niente HTML, solo grassetto (**così**) e a capo, come lo scrivono gli assistenti con IA */
const formatta = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const quando = ts => {
  const d = new Date(ts), oggi = new Date(), ieri = new Date(Date.now() - 864e5);
  return d.toDateString() === oggi.toDateString() ? hhmm(d) : d.toDateString() === ieri.toDateString() ? t("ieri ", "yesterday ") + hhmm(d)
    : d.toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short" }) + " " + hhmm(d);
};
function messaggi() {
  if (!V.msg.length && !V.scrive) return `<div class="vc1e">${DISEGNO}<b>${t("Ciao! Cosa faccio?", "Hi! What shall I do?")}</b>
    <span>${t("Parla o scrivi alla casa: accendo e spengo, ti dico come va, aggiungo cose alle liste. Rispondo con Assist di Home Assistant.", "Talk or type to your home: I switch things on and off, tell you how things are, add items to lists. Answers come from Home Assistant's Assist.")}</span></div>`;
  let prima = 0;
  const righe = V.msg.map(m => {
    if (m.sep) { prima = 0; return `<div class="vc1sep"><span>${t("Nuova conversazione", "New conversation")}</span></div>`; }
    const stacco = prima && m.ts - prima > FILO ? `<div class="vc1sep"><span>${esc(quando(m.ts))}</span></div>` : !prima ? `<div class="vc1sep"><span>${esc(quando(m.ts))}</span></div>` : "";
    prima = m.ts;
    return `${stacco}<div class="vc1b ${m.da === "io" ? "io" : "casa"} ${m.err ? "err" : ""}">${formatta(m.testo)}<small>${m.voce && m.da === "io" ? "🎙️ " : ""}${hhmm(m.ts)}</small></div>`;
  }).join("");
  return righe + (V.scrive ? `<div class="vc1b casa vivo">${formatta(V.scrive)}<i class="vc1cur"></i></div>` : "");
}
function statoRiga() {
  const s = V.stato;
  if (s === "avvio") return `<div class="vc1st"><span class="vc1pt"><i></i><i></i><i></i></span><span>${t("Accendo il microfono…", "Turning on the microphone…")}</span></div>`;
  if (s === "ascolto") return `<div class="vc1st on"><div class="vc1w" id="vc1w" data-keep>${"<i></i>".repeat(7)}</div><span><b>${t("Ti ascolto…", "Listening…")}</b><small>${t("Quando smetti di parlare capisco da solo; oppure tocca ■.", "When you stop talking I notice by myself; or tap ■.")}</small></span></div>`;
  if (s === "penso") return V.scrive ? "" : `<div class="vc1st"><span class="vc1pt"><i></i><i></i><i></i></span><span>${t("Ci penso…", "Thinking…")}</span></div>`;
  if (s === "parla") return `<div class="vc1st"><span class="vc1sp"><i></i><i></i><i></i></span><span>${t("Ti rispondo…", "Answering…")}</span><button class="btn sm" data-act="vcZitto">■ ${t("Basta", "Stop")}</button></div>`;
  return "";
}
function foglio() {
  const P = pipeline(), p = pipeScelta(), puo = micPossibile() && !P?.errore && (!p || !!p.stt_engine);
  const sotto = P?.errore ? t("Assist non è attivo: scrivo all'assistente predefinito", "Assist isn't active: typing to the default assistant")
    : p ? `${esc(p.name)} · ${esc(nomeLingua(lingua(p)))}${nomeAgente(p) && p.name !== nomeAgente(p) ? " · " + esc(nomeAgente(p)) : ""}` : t("Assist di Home Assistant", "Home Assistant Assist");
  const ascolto = V.stato === "ascolto" || V.stato === "avvio";
  return `<div class="sh-head vc1h"><div><h3>🎙️ ${t("Assistente", "Assistant")}</h3><div class="small muted">${sotto}</div></div>
      ${V.msg.length ? `<button class="btn sm" data-act="vcNuova" title="${t("Ricomincia il discorso", "Start a new conversation")}">＋ ${t("Nuova", "New")}</button>` : ""}<button class="x" data-act="sheetClose" aria-label="${t("Chiudi", "Close")}">×</button></div>
    <div class="vc1m" id="vc1m" aria-live="polite">${messaggi()}</div>
    ${statoRiga()}
    ${V.nota ? `<div class="note1 vc1n">${V.nota}</div>` : ""}
    <div class="vc1c">${frasi().map(([f, k]) => `<button class="${k ? "rec" : ""}" data-act="vcFrase" data-v="${esc(f)}" ${occupato() ? "disabled" : ""}>${k ? "↺ " : ""}${esc(f)}</button>`).join("")}</div>
    <div class="vc1in"><input id="vc1q" type="text" enterkeyhint="send" autocomplete="off" placeholder="${t("Scrivi alla casa…", "Type to your home…")}" value="${esc(V.attesa)}" aria-label="${t("Messaggio per l'assistente", "Message for the assistant")}">
      <button class="vc1s" data-act="vcInvia" aria-label="${t("Invia", "Send")}">${INVIA}</button>
      <button class="vc1mic ${ascolto ? "on" : ""} ${puo ? "" : "no"}" data-act="vcMic" aria-pressed="${ascolto}" aria-label="${ascolto ? t("Ho finito di parlare", "I'm done talking") : t("Parla", "Talk")}">${ascolto ? STOP : MIC}</button></div>`;
}

/* ================= pulsanti: in alto e flottante (telefono) ================= */
const fabVisibile = () => asBtn() === "tutti" && stretto() && !!UI.page && !UI.ss && UI.page !== "chat" && !PAGES[UI.page]?.bare;
STRIP.push(() => asBtn() === "no" || fabVisibile() ? "" : `<button class="pillv vc1p ${V.stato ? "on" : ""}" data-act="vcApri" title="${t("Assistente vocale", "Voice assistant")}" aria-label="${t("Assistente vocale", "Voice assistant")}">🎙️</button>`);
let ultimi = "";
function fissi() {
  let el = document.getElementById("vc1fab");
  const si = fabVisibile();
  document.body.classList.toggle("vc1on", si);
  if (!si) el?.remove();
  else {
    if (!el) { el = document.createElement("button"); el.id = "vc1fab"; el.className = "vc1f"; el.dataset.act = "vcApri"; el.setAttribute("aria-label", t("Assistente vocale", "Voice assistant")); document.body.appendChild(el); el.innerHTML = MIC; }
    el.classList.toggle("on", !!V.stato);
  }
  /* foglio aperto: scorro in fondo quando arriva qualcosa di nuovo; chiuso: smetto di ascoltare */
  if (UI.sheet === foglio) {
    const k = V.msg.length + ":" + V.scrive.length + ":" + V.stato, box = document.getElementById("vc1m");
    if (box && k !== ultimi) box.scrollTop = box.scrollHeight;
    ultimi = k;
  } else {
    ultimi = "";
    if (R) { chiudi(R); if (V.stato !== "parla") V.stato = ""; render(); }
  }
}
FISSI.push(fissi);
try { matchMedia("(max-width:860px)").addEventListener("change", () => render()); } catch {}

/* ================= azioni ================= */
Object.assign(ACT, {
  vcApri: () => {
    pipeline(Date.now() - PL.t > 60000);   // pipeline nuove in Home Assistant: le rileggo
    V.nota = ""; openSheet(foglio);
    if (matchMedia("(pointer:fine)").matches) setTimeout(() => document.getElementById("vc1q")?.focus(), 450);   // sul telefono niente tastiera da sola
  },
  vcMic: () => ascolta(),
  vcInvia: () => { const el = document.getElementById("vc1q"), v = el?.value || ""; if (!v.trim()) return el?.focus(); if (occupato()) return scrivi(v); el.value = ""; V.attesa = ""; scrivi(v); },
  vcFrase: el => scrivi(el.dataset.v),
  vcZitto: () => { zitto(); render(); },
  vcNuova: () => { if (R) chiudi(R); zitto(); V.conv = null; V.scrive = ""; V.stato = ""; V.nota = ""; if (V.msg.length && !V.msg[V.msg.length - 1].sep) { V.msg.push({ sep: 1, ts: Date.now() }); salvaStoria(); } render(); },
});
document.addEventListener("input", e => { if (e.target.id === "vc1q") V.attesa = e.target.value; });
document.addEventListener("keydown", e => { if (e.target.id === "vc1q" && e.key === "Enter" && !e.isComposing) { e.preventDefault(); ACT.vcInvia(); } });

/* ================= ⚙️ Impostazioni → Assistente vocale ================= */
const PERM = { v: null };
function permesso() {
  if (PERM.v == null && navigator.permissions?.query) {
    PERM.v = "?";
    navigator.permissions.query({ name: "microphone" }).then(s => { PERM.v = s.state; s.onchange = () => { PERM.v = s.state; render(); }; render(); }).catch(() => { PERM.v = "x"; });
  }
  return PERM.v;
}
function statoMic() {
  if (!micPossibile()) return ["no", perchéNoMic()];
  const p = permesso();
  if (p === "denied") return ["no", t("Il browser ha negato il microfono a questo sito: consentilo nelle sue impostazioni.", "The browser denied the microphone to this site: allow it in its settings.")];
  if (p === "granted") return ["ok", t("Pronto: il permesso è già dato.", "Ready: permission already granted.")];
  return ["ok", t("Disponibile: al primo 🎙️ il browser chiede il permesso.", "Available: on the first 🎙️ the browser asks for permission.")];
}
/** scheda delle impostazioni (per ogni dispositivo, la vedono tutti) */
export function assistenteCard() {
  const P = pipeline(), L = P?.pipelines || [], p = pipeScelta(), sel = asPipe() && L.some(x => x.id === asPipe()) ? asPipe() : "";
  const pref = L.find(x => x.id === P?.preferred_pipeline) || L[0];
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, n]) => `<button class="${cur === k ? "act" : ""}" data-act="${act}" data-v="${k}">${n}</button>`).join("")}</div>`;
  const dett = x => [nomeLingua(x.language), nomeAgente(x) !== x.name ? nomeAgente(x) : "", x.stt_engine ? "🎤 " + t("voce", "voice") : "⌨️ " + t("solo testo", "text only"), x.tts_engine ? "🔊" : ""].filter(Boolean).join(" · ");
  const voce = (id, ic, n, s) => `<button class="li ${sel === id ? "sel1" : ""}" data-act="vcPipe" data-v="${esc(id)}"><span class="ic">${ic}</span><div class="tx"><b>${esc(n)}</b><span>${esc(s)}</span></div></button>`;
  const lingue = [...new Set([LOC.slice(0, 2), ...L.map(x => base(x.language)).filter(Boolean), ...(asLang() ? [asLang()] : [])])];
  const [mk, mt] = statoMic(), nMsg = V.msg.filter(m => !m.sep).length;
  const pipeBox = P == null ? `<div class="small muted">${t("Leggo le pipeline di Home Assistant…", "Loading Home Assistant's pipelines…")}</div>`
    : P.errore ? `<div class="note1" style="margin:0">${t("Assist non è attivo in Home Assistant: si può solo scrivere all'assistente predefinito.", "Assist isn't active in Home Assistant: you can only type to the default assistant.")}</div>`
    : `<div class="vc1pl">${voce("", "✨", t("Predefinita", "Preferred"), pref ? t("di Home Assistant: ", "Home Assistant's: ") + pref.name + (asLang() && pipeScelta(true)?.id !== pref.id ? t(` (in ${nomeLingua(asLang())}: ${pipeScelta(true).name})`, ` (in ${nomeLingua(asLang())}: ${pipeScelta(true).name})`) : "") : "—")}
        ${L.map(x => voce(x.id, x.stt_engine ? "🎙️" : "⌨️", x.name, dett(x))).join("")}</div>`;
  return `<section class="card vc1set"><div class="ch"><h2>🎙️ ${t("Assistente vocale", "Voice assistant")}</h2><button class="btn sm" data-act="vcApri">▶ ${t("Prova", "Try")}</button></div>
    <p class="small muted" style="margin:-6px 0 14px;position:relative">${t("Parli o scrivi alla casa con Assist di Home Assistant. Queste scelte valgono solo per questo dispositivo.", "Talk or type to your home with Home Assistant's Assist. These choices apply to this device only.")}</p>
    <div class="dev1g">
      <div class="vc1pw"><b>${t("Pipeline", "Pipeline")}</b>${pipeBox}
        <small class="muted">${t("Chi capisce e chi risponde (anche Gemini o OpenAI). Le pipeline si creano in Home Assistant → Impostazioni → Assistenti vocali.", "Who understands and who answers (Gemini or OpenAI too). Pipelines are created in Home Assistant → Settings → Voice assistants.")}</small></div>
      <div><b>${t("Lingua", "Language")}</b>
        <select class="wz-sel vc1sel" data-chg="vcLang" aria-label="${t("Lingua", "Language")}"><option value="">${t("Automatica", "Automatic")}${p ? " · " + esc(nomeLingua(base(p.conversation_language && p.conversation_language !== "*" ? p.conversation_language : p.language))) : ""}</option>
          ${lingue.map(l => `<option value="${esc(l)}" ${asLang() === l ? "selected" : ""}>${esc(nomeLingua(l))}</option>`).join("")}</select>
        <small class="muted">${t("La lingua in cui parli e scrivi e quella delle frasi suggerite. Con la pipeline predefinita, sceglie quella di questa lingua.", "The language you talk and type in, and the suggested phrases' one. With the preferred pipeline, it picks the one for this language.")}</small></div>
      <div><b>${t("Pulsante 🎙️", "🎙️ button")}</b>${seg("vcBtn", asBtn(), [["tutti", t("In alto e flottante", "Top and floating")], ["alto", t("Solo in alto", "Top only")], ["no", t("Nascosto", "Hidden")]])}
        <small class="muted">${t("Flottante: il pulsante tondo in basso sul telefono. Nascosto: l'assistente si apre da qui con ▶ Prova.", "Floating: the round button at the bottom on phones. Hidden: open the assistant from here with ▶ Try.")}</small></div>
      <div><b>${t("Risposta vocale", "Spoken reply")}</b>${seg("vcVoce", asVoce() ? "1" : "0", [["1", "🔊 " + t("Sì", "Yes")], ["0", "🔇 No"]])}
        <small class="muted">${t("Quando parli, la risposta si sente anche ad alta voce (se la pipeline ha una voce).", "When you talk, the answer is also read aloud (if the pipeline has a voice).")}</small></div>
      <div><b>${t("Frasi rapide", "Quick phrases")}</b>
        <textarea class="vc1fr" data-chg="vcFrasi" rows="3" placeholder="${esc(t("Spegni tutte le luci\nChe temperatura c'è in camera?", "Turn off all the lights\nWhat's the temperature in the bedroom?"))}" aria-label="${t("Frasi rapide", "Quick phrases")}">${esc(asFrasi().join("\n"))}</textarea>
        <small class="muted">${t("Una per riga: compaiono da toccare nell'assistente. Vuoto: gli esempi della plancia.", "One per line: shown as chips in the assistant. Empty: the dashboard's examples.")}</small></div>
      <div><b>${t("Microfono e cronologia", "Microphone and history")}</b>
        <div class="li vc1mk ${mk}"><span class="ic">${mk === "ok" ? "🎤" : "🔒"}</span><div class="tx"><span>${mt}</span></div></div>
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="small muted">${nMsg ? t(`${nMsg} messaggi su questo dispositivo`, `${nMsg} messages on this device`) : t("Nessun messaggio salvato", "No saved messages")}</span>
          ${nMsg ? `<button class="btn sm bad" data-act="vcCancella">🗑 ${t("Cancella", "Clear")}</button>` : ""}</div>
        <small class="muted">${t(`Restano solo qui, gli ultimi ${MAX_STORIA}.`, `Kept only here, the last ${MAX_STORIA}.`)}</small></div>
    </div></section>`;
}
Object.assign(ACT, {
  vcPipe: el => { sSet("asPipe", el.dataset.v); V.conv = null; render(); toast("🎙️ " + (pipeScelta()?.name || "")); },
  vcBtn: el => { sSet("asBtn", el.dataset.v); render(true); },
  vcVoce: el => { sSet("asVoce", el.dataset.v); if (el.dataset.v === "0") zitto(); render(); },
  vcCancella: el => { if (!sicuro(el, t("Tocca ancora per cancellare", "Tap again to clear"))) return;
    V.msg = []; V.conv = null; salvaStoria(); toast("🗑 " + t("Cronologia cancellata", "History cleared")); render(true); },
});
CHG.vcLang = el => { sSet("asLang", el.value); V.conv = null; render(); };
CHG.vcFrasi = el => { sSet("asFrasi", el.value.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 12).join("\n")); render(); toast("💾 " + t("Frasi salvate", "Phrases saved")); };

/* 'Nduja Dashboard — avvio veloce: subito il nucleo, la Home e le Impostazioni;
   le altre pagine si caricano un attimo dopo, mentre la Home è già sullo schermo. */
import { tuttePronte } from "./core.js";
import "./edit.js";
import "./climadisegni.js";
import "./luce.js";
import "./salvaschermo.js";
import "./grafici.js";
import "./pages/benvenuto.js";
import "./pages/home.js";
import "./pages/custom.js";
import "./pages/impostazioni.js";

const DOPO = ["mappa", "luci", "clima", "caldaia", "energia", "dispositivi", "batterie", "elettrodomestici", "musica", "media", "robot", "irrigazione", "auto", "sicurezza", "telecamere", "calendario", "liste", "scadenze", "faccende", "bacheca", "chat", "squadra", "formula1", "automazioni", "rete", "aggiornamenti"];
const carica = () => Promise.all(DOPO.map(p => import(`./pages/${p}.js`).catch(e => console.error("nduja", p, e)))).then(tuttePronte);
(window.requestIdleCallback || (f => setTimeout(f, 200)))(carica, { timeout: 1200 });

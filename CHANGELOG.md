# Changelog

> 🇮🇹 'Nduja Dashboard è in **beta**: funziona, ma può cambiare e avere difetti. Segnalali nelle Issues.
> 🇬🇧 'Nduja Dashboard is in **beta**: it works, but it may change and have bugs. Please report them in Issues.

## 0.7.0-beta
- 🇮🇹 **Mappa della casa**: le stanze di ogni piano disegnate da sole dalle aree, con luci accese (si illuminano), finestre aperte, clima, movimento, allarmi fumo/gas/acqua e temperatura. Tocca una stanza per comandarla, 💡 per accendere o spegnere le sue luci.
- 🇮🇹 In ✏️ Modifica: sposta ← ↑ ↓ →, allarga ⇠ ⇢, cambia altezza ⇡ ⇣, «Disposizione automatica» per ricominciare, «Piantina» per mettere sotto un'immagine della tua casa (/local/…).
- 🇬🇧 **House map**: each floor's rooms drawn automatically from your areas, with lights on (they glow), open windows, climate, motion, smoke/gas/water alarms and temperature. Tap a room to control it, 💡 to switch its lights.
- 🇬🇧 In ✏️ Edit: move ← ↑ ↓ →, widen ⇠ ⇢, change height ⇡ ⇣, «Auto layout» to start over, «Floor plan» to put an image of your home underneath (/local/…).

## 0.6.1-beta
- 🇮🇹 **Energia, sensori a piacere**: in ⚙️ Sensori ogni voce accetta **qualsiasi sensore** della casa (con ricerca), non solo quelli proposti. Il fotovoltaico accetta **più stringhe o inverter** (PV1, PV2, PV3…) che vengono sommati; anche batterie e consumi si possono sommare. Si possono scegliere i contatori di oggi (prodotto, prelevato, immesso). Le modifiche si salvano subito.
- 🇮🇹 Nuova scheda **Stringhe** con la produzione di ogni stringa e il totale.
- 🇮🇹 La carica della batteria non prende più per sbaglio la batteria del telefono.
- 🇬🇧 **Energy, any sensor**: in ⚙️ Sensors every item accepts **any sensor** in the house (searchable). Solar accepts **several strings or inverters** (PV1, PV2, PV3…) which are added up; batteries and consumption can be summed too. Today's meters (produced, imported, exported) can be chosen. Changes save immediately.
- 🇬🇧 New **Strings** card with each string's production and the total.
- 🇬🇧 Battery charge no longer picks a phone battery by mistake.

## 0.6.0-beta
- 🇮🇹 **Robot aspirapolvere**: stato, batteria, metri e minuti, mappa, Pulisci / Pausa / Ferma / Alla base / Trova, **pulizia di singole stanze** (Dreame e Roborock), impostazioni rapide (potenza, modalità…) scelte con ✏️, manutenzione di spazzole e filtro con ↺ azzera.
- 🇮🇹 **Telecamere**: anteprime aggiornate ogni 10 secondi, tocca per la diretta; doppioni (sub stream, transcodifiche, mappe dei robot, non raggiungibili) nascosti finché non li aggiungi; ordine con ◀ ▶; vista piccola o grande.
- 🇮🇹 **Sicurezza**: allarme con tastierino per il codice (in casa, fuori casa, notte, vacanza), serrature, porte e finestre, fumo/gas/acqua, movimento. Allarme scattato e sensori di pericolo compaiono negli Avvisi della Home.
- 🇬🇧 **Robot vacuum**: status, battery, area and time, map, Clean / Pause / Stop / Dock / Locate, **single-room cleaning** (Dreame and Roborock), quick settings (suction, mode…) chosen with ✏️, brush and filter maintenance with ↺ reset.
- 🇬🇧 **Cameras**: snapshots refreshed every 10 seconds, tap for live view; duplicates (sub streams, transcodes, vacuum maps, unavailable) hidden until you add them; ◀ ▶ order; small or large view.
- 🇬🇧 **Security**: alarm with code keypad (home, away, night, vacation), locks, doors and windows, smoke/gas/water, motion. Triggered alarm and danger sensors show up in Home alerts.

## 0.5.0-beta
- 🇮🇹 **Persone**: schede con foto, dove sono e da quanto, distanza da casa, batteria del telefono (⚡ se in carica). Il telefono si trova da solo; con ✏️ si cambiano nome, batteria, sensore di ricarica e distanza.
- 🇮🇹 **Calendario**: nuova pagina con gli eventi di oggi, della settimana o del mese, ＋ Evento, scelta dei calendari; agenda di oggi e domani nella Home.
- 🇮🇹 **Raccolta differenziata**: «Stasera esponi…» con i colori dei rifiuti, da sensori o calendari (trovati da soli o scelti con ✏️).
- 🇮🇹 **Avvisi** nella Home: finestra aperta col clima acceso, pioggia in arrivo con finestre aperte, porta aperta da più di 10 minuti, lavatrice finita, pile scariche, aggiornamenti, raccolta di stasera. Ogni avviso si nasconde con ✕.
- 🇮🇹 Home modificabile: ✏️ sul meteo per scegliere quale usare, ＋/✕ su scene e persone.
- 🇮🇹 Meteo di casa scelto meglio (niente più meteo di circuiti F1 o città lontane).
- 🇮🇹 Temperatura delle stanze senza caldaie, mandate, setpoint e temperature interne dei dispositivi.
- 🇮🇹 Barra di navigazione **sempre visibile** o **a scomparsa**, e tema, scelti per ogni dispositivo in ⚙️ Impostazioni → Questo dispositivo.
- 🇮🇹 **Personalizzazione**: in Home con ✏️ Modifica ogni scheda si sposta ▲▼ o si nasconde; ✏️ su ogni stanza per nome, ordine, nascondere e scegliere **qualsiasi** sensore di temperatura o umidità della casa (con ricerca). Nuova sezione 🎨 Personalizza in Impostazioni.
- 🇮🇹 Stanze personalizzabili ovunque: tocca una stanza in Clima → «Temperature in casa», o ✏️ Stanza in Luci e Clima; il nome si salva appena esci dal campo.
- 🇮🇹 Orologio grande in Home sopra la data.
- 🇮🇹 I file si ricaricano appena cambiano: installare «main» da HACS funziona senza svuotare la cache.
- 🇬🇧 **People**: cards with photo, where they are and since when, distance from home, phone battery (⚡ when charging). The phone is found automatically; ✏️ changes name, battery, charging sensor and distance.
- 🇬🇧 **Calendar**: new page with today's, this week's or this month's events, ＋ Event, calendar selection; today/tomorrow agenda on Home.
- 🇬🇧 **Waste collection**: "Put out tonight…" with coloured waste types, from sensors or calendars (auto-detected or chosen with ✏️).
- 🇬🇧 **Alerts** on Home: window open with climate on, rain coming with windows open, door open for more than 10 minutes, washing machine done, low batteries, updates, tonight's waste. Dismiss each with ✕.
- 🇬🇧 Editable Home: ✏️ on weather to choose the source, ＋/✕ on scenes and people.
- 🇬🇧 Better home weather detection; room temperatures ignore boilers, setpoints and device-internal temperatures.
- 🇬🇧 Navigation bar **always visible** or **auto-hide**, and theme, per device in ⚙️ Settings → This device.
- 🇬🇧 **Customization**: on Home, ✏️ Edit lets you move ▲▼ or hide every card; ✏️ on each room for name, order, hiding and choosing **any** temperature or humidity sensor in the house (searchable). New 🎨 Customize section in Settings.
- 🇬🇧 Rooms customizable everywhere: tap a room in Climate → «Indoor temperatures», or ✏️ Room in Lights and Climate; the name saves as soon as you leave the field.
- 🇬🇧 Big clock on Home above the date.
- 🇬🇧 Files reload as soon as they change: installing "main" from HACS works without clearing the cache.

## 0.4.3-beta
- 🇮🇹 Benvenuto e Impostazioni senza i dati in alto (sole, rete, persone…); nel benvenuto niente menu, solo le due scelte.
- 🇬🇧 Welcome and Settings without the top data pills; the welcome screen hides the menu and shows only the two choices.

## 0.4.2-beta
- 🇮🇹 Energia: riconoscimento dei sensori più furbo. Non usa più le **previsioni** del fotovoltaico come produzione; preferisce i sensori dello stesso inverter della configurazione Energia; se trova solo la stringa PV1 somma anche PV2, PV3….
- 🇬🇧 Energy: smarter sensor detection. Solar **forecasts** are no longer used as production; sensors of the same inverter as the Energy configuration are preferred; if only string PV1 is found, PV2, PV3… are added.

## 0.4.1-beta
- 🇮🇹 **Tema chiaro, scuro o automatico** (segue Home Assistant): pulsante ◐ in alto, scelto per ogni dispositivo.
- 🇮🇹 Schema Energia più grande e leggibile sul telefono.
- 🇬🇧 **Light, dark or automatic theme** (follows Home Assistant): ◐ button at the top, per device.
- 🇬🇧 Bigger, readable Energy flow on phones.

## 0.4.0-beta
- 🇮🇹 Nuova pagina **⚡ Energia**: flusso in tempo reale (sole, rete, casa, batteria), totali di oggi (prodotto, consumato, prelevato, immesso, autoconsumo, autosufficienza), chi consuma adesso e consumi dei dispositivi di oggi.
- 🇮🇹 I sensori si trovano da soli dalla configurazione **Energia** di Home Assistant; con ✏️ Modifica → ⚙️ Sensori si scelgono a mano (anche con i segni invertiti).
- 🇮🇹 Pillole ☀ sole e ↑↓ rete in alto.
- 🇬🇧 New **⚡ Energy** page: live flow (solar, grid, home, battery), today's totals, who's using power now and today's device consumption.
- 🇬🇧 Sensors are found from Home Assistant's **Energy** configuration; ✏️ Edit → ⚙️ Sensors to choose them manually (sign inversion included).

## 0.3.2-beta
- 🇮🇹 Le versioni ora sono segnate **beta**; scritta BETA nella plancia.
- 🇬🇧 Versions are now marked **beta**; BETA label in the dashboard.

## 0.3.1
- 🇮🇹 ⚙️ Impostazioni → **🔄 Riavvia il wizard**: torna al benvenuto e si sceglie di nuovo Automatica o Manuale (le pagine create restano).
- 🇮🇹 Corretto: i pulsanti «tocca ancora per confermare» (Installa, Elimina pagina…) a volte non accettavano il secondo tocco.
- 🇬🇧 ⚙️ Settings → **🔄 Restart the wizard**: back to the welcome screen to choose Automatic or Manual again (your pages are kept).
- 🇬🇧 Fixed: "tap again to confirm" buttons (Install, Delete page…) sometimes ignored the second tap.

## 0.3.0
- 🇮🇹 Primo avvio: si apre il benvenuto con due scelte, **Automatica** (trovo tutto io) o **Manuale** (parti da zero).
- 🇮🇹 **✏️ Modifica** in ogni sezione (Luci, Clima, Prese e dispositivi, pagine tue): ＋ Aggiungi con ricerca, ✏️ nome e stanza, ✕ togli.
- 🇮🇹 Nuova pagina **Prese e dispositivi**. **＋ Nuova pagina**: crea pagine tue con nome e icona e mettici quello che vuoi.
- 🇬🇧 First start: welcome screen with **Automatic** (find everything) or **Manual** (start empty).
- 🇬🇧 **✏️ Edit** on every section (Lights, Climate, Plugs and devices, your pages): ＋ Add with search, ✏️ name and room, ✕ remove.
- 🇬🇧 New **Plugs and devices** page. **＋ New page**: create your own pages with name and icon and put anything in them.

## 0.2.1
- 🇮🇹 Icona dell'integrazione e release automatiche (HACS mostra la versione).
- 🇬🇧 Integration icon and automatic releases (HACS shows the version).

## 0.2.0
- 🇮🇹 Wizard di configurazione in ⚙️ Impostazioni: stanze, luci, clima e sensori per stanza, dispositivi, persone, meteo, scene, pagine.
- 🇬🇧 Setup wizard in ⚙️ Settings: rooms, lights, climate and room sensors, devices, people, weather, scenes, pages.

## 0.1.0
- 🇮🇹 Prima anteprima: Home, Luci, Clima, Aggiornamenti.
- 🇬🇧 First preview: Home, Lights, Climate, Updates.

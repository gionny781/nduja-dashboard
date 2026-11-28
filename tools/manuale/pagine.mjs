// Testi del manuale, capitolo «Le pagine, una per una» (italiano e inglese, stesso contenuto).
// Una voce per pagina della plancia (id = quello di PAGES) più le parti che non sono pagine del menu (casa3d, oggetti, assistente).
// L'ordine del capitolo è quello del menu della plancia, letto dal finto Home Assistant (genera.mjs); «dopo» mette una voce subito dopo un'altra.
// scatto: come fare lo screenshot sul finto Home Assistant — p = pagina, ls = scelte (localStorage), lay = mockLayout ("3d" = casa di prova in 3D),
//   clic = selettori da toccare separati da |, ora = ora ferma, chiaro = tema chiaro, scorri = selettore da portare in cima, alto = altezza dello schermo.
// Testi: **grassetto**; «tocchi» e «consigli» sono elenchi. Niente termini tecnici se non servono.

/* copie di sicurezza per la schermata (0.7.63): quattro copie inventate; all'apertura il finto Home Assistant aggiunge «prima dell'aggiornamento a 0.7.63» */
const COPIE_PROVA = (() => {
  const dati = {}, copie = [
    ["giorno", "2026-11-25T02:12:00+00:00", "Mario", "0.7.62-dev", {}],
    ["guidata", "2026-11-23T17:40:00+00:00", "Mario", "0.7.62-dev", {}],
    ["giorno", "2026-11-22T02:12:00+00:00", "Anna, Mario", "0.7.62-dev", {}],
    ["aggiornamento", "2026-11-20T08:05:00+00:00", null, "0.7.61-dev", { da: "0.7.61-dev", a: "0.7.62-dev" }],
  ].map(([motivo, ts, chi, versione, param], i) => {
    const j = JSON.stringify({ casa: { faccende: { lavori: Array.from({ length: 30 + i * 9 }, (_, k) => ({ id: "f" + k, nome: "Faccenda " + k })) } }, layout: { configured: true, prova: i } });
    dati["h" + i] = { j, byte: 2600 + i * 700, grezzi: j.length };
    return { id: "c" + i, ts, motivo, param, chi, versione, h: "h" + i };
  });
  return JSON.stringify({ versione: "0.7.62-dev", copie, dati, chi: [] });
})();

export const PAGINE = [
  {
    id: "home", scatto: { p: "home" },
    it: {
      sotto: "La casa in una pagina: chi c'è, cosa è acceso, cosa c'è da sapere.",
      serve: "È la pagina di partenza. In alto il **saluto** con il riepilogo della casa in una riga (chi è in casa, luci accese, finestre aperte, clima acceso) e le scene più usate. Sotto le **schede**: meteo, **stanze divise per piano**, persone, Momenti, agenda, raccolta differenziata e gli **Avvisi** (finestra aperta col clima acceso, pioggia in arrivo, lavatrice finita, pile scariche…). Le altre pagine aggiungono qui le loro schede compatte.",
      tocchi: [
        "**Tocco su una stanza**: si apre la sua finestra con luci, clima, tapparelle, prese, porte e sensori, tutto comandabile.",
        "**Tocco su un Momento** («Esco», «Notte», «Film»…): fa più cose insieme.",
        "**«Dettagli ›»** e i titoli delle schede portano alla pagina completa.",
        "In **Avvisi**, ⚙️ (amministratori) sceglie le regole: dopo quanti minuti una porta è «rimasta aperta», da che ora ricordare la raccolta, quali avvisi mostrare; 📱 li manda anche sul telefono.",
      ],
      sola: "Stanze e piani arrivano dalle aree di Home Assistant; temperatura e umidità di ogni stanza dal sensore più adatto. Quando compaiono dispositivi nuovi, un amministratore vede «N dispositivi nuovi trovati».",
      consigli: [
        "Con **✏️ Modifica** scegli quali schede vedere, la loro larghezza e l'ordine (trascinandole dalla barra arancione).",
        "Se una stanza mostra la temperatura sbagliata: ✏️ Modifica → ✏️ sulla stanza → scegli il sensore giusto.",
      ],
    },
    en: {
      sotto: "Your home on one page: who's in, what's on, what you should know.",
      serve: "This is the start page. At the top, the **greeting** sums up the home in one line (who's in, lights on, windows open, climate running) with your most used scenes. Below are the **cards**: weather, **rooms grouped by floor**, people, Moments, agenda, waste collection and **Alerts** (window open with the heating on, rain coming, washing machine done, flat batteries…). Other pages add their compact cards here.",
      tocchi: [
        "**Tap a room**: its window opens with lights, climate, covers, plugs, doors and sensors, all controllable.",
        "**Tap a Moment** («Leaving», «Night», «Movie»…): it does several things at once.",
        "**«Details ›»** and card titles take you to the full page.",
        "In **Alerts**, ⚙️ (admins) sets the rules: after how many minutes a door is «left open», from what time to remind the waste collection, which alerts to show; 📱 sends them to the phone too.",
      ],
      sola: "Rooms and floors come from your Home Assistant areas; each room's temperature and humidity from the most suitable sensor. When new devices show up, an admin sees «N new devices found».",
      consigli: [
        "With **✏️ Edit** you choose which cards to see, how wide they are and their order (drag them by the orange bar).",
        "If a room shows the wrong temperature: ✏️ Edit → ✏️ on the room → pick the right sensor.",
      ],
    },
  },
  {
    id: "colpo", scatto: { p: "colpo" },
    it: {
      sotto: "La tua vista con le cose più importanti, grandi e leggibili da lontano.",
      serve: "Una pagina tutta tua, ideale per il **tablet a muro**: tessere grandi con i dispositivi, i sensori, le stanze e i blocchi pronti delle altre pagine (meteo, energia adesso, agenda, avvisi, lista della spesa, allarme…). Ognuno ha la sua, anche chi non è amministratore, e la ritrova su tutti i suoi dispositivi.",
      tocchi: [
        "**Tocco**: l'azione naturale (accendi o spegni, apri o chiudi, avvia la scena). Serrature, cancelli e sirene chiedono un secondo tocco.",
        "**Pressione lunga** (o clic destro): i dettagli, per esempio le luci di un gruppo o la pagina di un blocco.",
        "In **✏️ Modifica**: ＋ aggiunge, ✕ toglie, ogni tessera può essere piccola, media o grande, con nome e icona tuoi; si sposta trascinandola.",
      ],
      sola: "La prima volta propone una vista automatica (meteo, prossimo impegno, luci, stanze principali, persone, allarme): «Va bene così» o «Scelgo io».",
      consigli: [
        "In ⚙️ Impostazioni → Questo dispositivo → **Pagina iniziale** scegli «Colpo d'occhio»: il tablet si apre sempre qui.",
        "Un amministratore può copiare la sua vista a un'altra persona (📋 Copia a…), comodo per nonni e bambini.",
      ],
    },
    en: {
      sotto: "Your own view with what matters most, big and readable from afar.",
      serve: "A page that is all yours, ideal for a **wall tablet**: big tiles with devices, sensors, rooms and ready-made blocks from the other pages (weather, energy now, agenda, alerts, shopping list, alarm…). Everyone has their own, non-admins too, and finds it on all their devices.",
      tocchi: [
        "**Tap**: the natural action (on or off, open or close, run the scene). Locks, gates and sirens ask for a second tap.",
        "**Long press** (or right-click): the details, for example the lights in a group or the page of a block.",
        "In **✏️ Edit**: ＋ adds, ✕ removes, each tile can be small, medium or large, with your own name and icon; drag it to move it.",
      ],
      sola: "The first time it suggests an automatic view (weather, next event, lights, main rooms, people, alarm): «Keep it» or «I'll choose».",
      consigli: [
        "In ⚙️ Settings → This device → **Start page** pick «At a glance»: the tablet always opens here.",
        "An admin can copy their view to another person (📋 Copy to…), handy for grandparents and kids.",
      ],
    },
  },
  {
    id: "mappa", scatto: { p: "mappa", ls: { mockPiani: "1" }, lay: "3d" },
    it: {
      sotto: "Ogni piano disegnato dalle tue stanze, con quello che succede adesso.",
      serve: "La pianta della casa, un piano alla volta: le stanze **si illuminano** quando le luci sono accese, e si vedono finestre aperte, clima, movimento, allarmi di fumo, gas e acqua, temperatura. Dentro ogni stanza le icone dei suoi dispositivi, nel punto in cui li hai messi.",
      tocchi: [
        "**Tocco su una stanza**: la sua finestra con tutti i comandi; 💡 accende o spegne le sue luci.",
        "**Tocco su un dispositivo**: lo accende o lo spegne; **pressione lunga**: i dettagli.",
        "**2D / 3D** in alto passa alla casa in 3D (pagina seguente).",
      ],
      sola: "Disegna da sola una stanza per ogni area di Home Assistant e mette i dispositivi dal centro della stanza verso i bordi.",
      consigli: [
        "In **✏️ Modifica** sposti e allarghi le stanze, aggiungi stanze solo della mappa (scale, ripostiglio, terrazzo), fai stanze a L e metti sotto la **piantina** della tua casa.",
        "⚙️ «Cosa mostrare nelle stanze» toglie quello che non ti serve.",
      ],
    },
    en: {
      sotto: "Each floor drawn from your rooms, with what's happening now.",
      serve: "The floor plan of your home, one floor at a time: rooms **light up** when their lights are on, and you see open windows, climate, motion, smoke, gas and water alarms, temperature. Inside each room are the icons of its devices, where you placed them.",
      tocchi: [
        "**Tap a room**: its window with all the controls; 💡 turns its lights on or off.",
        "**Tap a device**: turns it on or off; **long press**: the details.",
        "**2D / 3D** at the top switches to the 3D house (next page).",
      ],
      sola: "It draws a room for each Home Assistant area and places devices from the centre of the room towards the walls.",
      consigli: [
        "In **✏️ Edit** you move and resize rooms, add map-only rooms (stairs, closet, terrace), make L-shaped rooms and put your own **floor plan** underneath.",
        "⚙️ «What to show in rooms» hides what you don't need.",
      ],
    },
  },
  {
    id: "casa3d", dopo: "mappa", icona: "🏠", scatto: { p: "mappa", ls: { mockPiani: "1", nduja_map3: "1", nduja_map3cut: "1" }, lay: "3d" },
    it: {
      titolo: "Casa in 3D",
      sotto: "La casa intera, piani uno sopra l'altro, viva come quella vera.",
      serve: "Nella Mappa, con **3D**, la casa si vede tutta insieme con il **tetto**. Le luci accese **illuminano pavimento e muri** del loro colore vero, porte e finestre sono aperte o chiuse davvero, le tapparelle alla loro altezza, la TV accesa brilla, il robot è nella stanza dove pulisce.",
      tocchi: [
        "**Un dito** ruota, **due dita** (o la rotella) avvicinano, due dita o il tasto destro spostano; ⟲ ⟳ ⤒ ⤓ ＋ − e «Vista iniziale» fanno lo stesso.",
        "**Tocco su un piano** (o 🏠 di lato): il tetto si solleva e guardi dentro quel piano.",
        "**Tocco su un dispositivo**: comando; **pressione lunga**: dettagli.",
      ],
      sola: "La costruisce dalla mappa 2D. «✨ Arreda per me» propone l'arredo dal nome delle stanze.",
      consigli: [
        "In **✏️ Modifica** ci sono quattro strumenti: 🧱 Stanze, 🚪 Porte e finestre (sui muri, collegate al loro sensore), 💡 Dispositivi (trascinali dove sono davvero), 🛋️ Arredo. In «🏠 Tetto e piani» scegli il tipo di tetto.",
        "Sui tablet lenti attiva la grafica leggera: niente bagliori né ombre.",
      ],
    },
    en: {
      titolo: "3D house",
      sotto: "The whole house, floors stacked, alive like the real one.",
      serve: "In the Map, with **3D**, you see the whole house with its **roof**. Lights that are on **light up floors and walls** in their real colour, doors and windows really open or close, covers sit at their height, a TV that is on glows, the vacuum is in the room it's cleaning.",
      tocchi: [
        "**One finger** rotates, **two fingers** (or the wheel) zoom, two fingers or the right button pan; ⟲ ⟳ ⤒ ⤓ ＋ − and «Initial view» do the same.",
        "**Tap a floor** (or 🏠 on the side): the roof lifts and you look inside that floor.",
        "**Tap a device**: control; **long press**: details.",
      ],
      sola: "It builds the house from the 2D map. «✨ Furnish for me» suggests furniture from the room names.",
      consigli: [
        "**✏️ Edit** has four tools: 🧱 Rooms, 🚪 Doors and windows (on the walls, linked to their sensor), 💡 Devices (drag them where they really are), 🛋️ Furniture. «🏠 Roof and floors» sets the roof type.",
        "On slow tablets turn on light graphics: no glows or shadows.",
      ],
    },
  },
  {
    id: "luci", scatto: { p: "luci" },
    it: {
      sotto: "Tutte le luci di casa, del loro colore vero.",
      serve: "In alto quante luci sono accese e **dove**, **⏻ Spegni tutto** e le scene di luce. Sotto le stanze divise per piano: ogni luce è una **tessera grande** che si illumina del colore vero della lampada, con la luminosità come riempimento.",
      tocchi: [
        "**Tocco**: accende o spegne.",
        "**Trascina in orizzontale** sulla tessera: luminosità.",
        "**Pressione lunga** (o ⋯): la **scheda grande** con la lampada disegnata del colore vero, il **cerchio della luminosità** da trascinare, bianco caldo/freddo, ruota dei colori, ☆ colori preferiti ed effetti.",
      ],
      sola: "Riconosce i **gruppi di luci** senza contarle due volte e mostra «▦ 2» con le luci del gruppo.",
      consigli: [
        "Un interruttore che comanda una lampada? ✏️ Modifica → ＋ Aggiungi luce: diventa una luce.",
        "Con ✏️ cambi nome, stanza, ordine e **icona** di ogni luce (lampadario, piantana, faretti, striscia LED…).",
      ],
    },
    en: {
      sotto: "All your lights, in their real colour.",
      serve: "At the top, how many lights are on and **where**, **⏻ All off** and the light scenes. Below, the rooms by floor: each light is a **big tile** that glows in the lamp's real colour, with the brightness as a fill.",
      tocchi: [
        "**Tap**: on or off.",
        "**Drag sideways** on the tile: brightness.",
        "**Long press** (or ⋯): the **big card** with the lamp drawn in its real colour, the **brightness dial** to drag, warm/cool white, colour wheel, ☆ favourite colours and effects.",
      ],
      sola: "It recognises **light groups** without counting lights twice and shows «▦ 2» with the group's lights.",
      consigli: [
        "A switch that drives a lamp? ✏️ Edit → ＋ Add light: it becomes a light.",
        "With ✏️ you change each light's name, room, order and **icon** (chandelier, floor lamp, spotlights, LED strip…).",
      ],
    },
  },
  {
    id: "energia", scatto: { p: "energia" },
    it: {
      sotto: "La casa in questo momento: sole, batteria, rete, consumi.",
      serve: "Una **scena animata** della casa: il sole segue l'ora vera, il meteo aggiunge nuvole o pioggia, i pannelli si illuminano con la produzione e i pallini sulle linee mostrano dove va l'energia (sole, batteria, rete, casa, auto). Sotto un riepilogo in parole semplici, i totali di oggi, chi consuma adesso, lo storico e i costi.",
      tocchi: [
        "**Tocco su un valore** della scena: apre il sensore.",
        "**Storico**: scegli giorno, settimana, mese o anno.",
        "⚙️ **Sensori** (amministratori): quali usare per «Chi consuma adesso» e «Consumi di oggi».",
      ],
      sola: "Legge la **configurazione Energia** di Home Assistant; senza, cerca da sola i sensori di potenza. Quello che non hai (pannelli, batteria, auto) non compare. Senza fotovoltaico passa da sola a **Solo contatore** (sotto).",
      consigli: [
        "Configura l'Energia in Home Assistant (Impostazioni → Plance → Energia) con i prezzi: avrai anche i costi.",
        "Ti piace la scena? C'è anche come salvaschermo «Fotovoltaico in tempo reale».",
      ],
    },
    en: {
      sotto: "Your home right now: sun, battery, grid, usage.",
      serve: "An **animated scene** of your home: the sun follows the real time, the weather adds clouds or rain, the panels light up with production and dots along the lines show where the energy goes (sun, battery, grid, home, car). Below, a plain-words summary, today's totals, what is using power now, history and costs.",
      tocchi: [
        "**Tap a value** in the scene: opens the sensor.",
        "**History**: pick day, week, month or year.",
        "⚙️ **Sensors** (admins): which to use for «Using power now» and «Today's usage».",
      ],
      sola: "It reads Home Assistant's **Energy configuration**; without it, it looks for power sensors by itself. What you don't have (panels, battery, car) doesn't show. Without solar it switches to **Meter only** by itself (below).",
      consigli: [
        "Set up Energy in Home Assistant (Settings → Dashboards → Energy) with prices: you'll get costs too.",
        "Like the scene? It's also a screensaver, «Live solar».",
      ],
    },
  },
  {
    id: "meteo", scatto: { p: "meteo", scorri: ".mt1c" },
    it: {
      sotto: "Il meteo completo, con la tua stazione e le allerte.",
      serve: "Il cielo di adesso con temperatura, massima e minima e quando arriva o smette la pioggia; poi percepita, umidità, vento con la bussola, pressione, UV, visibilità, alba e tramonto. Le previsioni **ora per ora** (24 o 48 ore) e dei **prossimi giorni**, le allerte meteo col colore del livello e, se c'è, il radar della pioggia.",
      tocchi: [
        "**📍**: guarda un altro meteo su questo dispositivo.",
        "**Tocco su un sensore** della tua stazione: il suo grafico.",
        "Sul PC passa sopra un'ora del grafico per i dettagli.",
      ],
      sola: "Sceglie il meteo di casa scartando quelli di altri posti; trova la tua stazione meteo o i sensori esterni. Compare solo quello che il tuo meteo fornisce.",
      consigli: [
        "Le allerte arancioni e rosse arrivano anche negli Avvisi della Home; il livello lo scegli in ⚙️.",
        "Il meteo di casa si cambia in Home → ✏️ Modifica sulla scheda Meteo.",
      ],
    },
    en: {
      sotto: "The full weather, with your station and the warnings.",
      serve: "The sky right now with temperature, high and low and when rain starts or stops; then feels-like, humidity, wind with a compass, pressure, UV, visibility, sunrise and sunset. **Hour by hour** forecasts (24 or 48 hours) and the **next days**, weather warnings coloured by level and, if you have one, the rain radar.",
      tocchi: [
        "**📍**: look at another weather on this device.",
        "**Tap a sensor** of your station: its chart.",
        "On a PC hover an hour of the chart for details.",
      ],
      sola: "It picks your home weather and ignores those of other places; it finds your weather station or outdoor sensors. Only what your weather provides shows up.",
      consigli: [
        "Orange and red warnings also go to the Home Alerts; you pick the level in ⚙️.",
        "Change the home weather in Home → ✏️ Edit on the Weather card.",
      ],
    },
  },
  {
    id: "contatore", dopo: "energia", icona: "🔌", scatto: { p: "energia", ls: { mockCasa: "contatore-w", mockCntW: "2500" } },
    it: {
      titolo: "Energia: solo contatore",
      sotto: "Per chi non ha il fotovoltaico: consumi, fasce e bolletta.",
      serve: "Basta il **contatore di energia** della casa (Shelly EM, lettore ottico, misuratore in quadro), anche senza sensore di potenza: la potenza di adesso si **stima** da quanto cresce. La scena mostra casa, contatore e rete, con una **lancetta** verso la potenza impegnata: arancione dall'80%, rossa oltre il 100% («rischio che salti il contatore»). Sotto: **oggi, ieri, settimana, mese, mese scorso, anno** in kWh ed euro con il confronto con prima, i grafici ora per ora, giorno per giorno e mese per mese, le **fasce F1, F2, F3**, la **stima della bolletta** a fine periodo e il **consumo di base** della notte.",
      tocchi: [
        "**Tocco su una barra** dei grafici: il suo valore.",
        "**⚙️ Contatore e bolletta** (amministratori): contatore, potenza impegnata, fasce (Italia o le tue), prezzo fisso, da un sensore o per fascia, quota fissa, giorno di inizio della bolletta.",
      ],
      sola: "Si accende da sola quando non trova i pannelli; trova il contatore nella configurazione Energia o da solo. Le fasce italiane seguono il calendario ARERA, con domeniche e festività.",
      consigli: [
        "Imposta la potenza impegnata della tua bolletta (3 kW, 4,5 kW, 6 kW…): la lancetta ti avvisa prima che salti il contatore.",
        "Hai la monoraria? Spegni le fasce in ⚙️.",
        "Anche il Colpo d'occhio e il salvaschermo «Consumi» mostrano lancetta e kWh di oggi.",
      ],
    },
    en: {
      titolo: "Energy: meter only",
      sotto: "For homes without solar: usage, time bands and the bill.",
      serve: "All it needs is the home's **energy meter** (Shelly EM, optical reader, panel meter), even without a power sensor: the current power is **estimated** from how fast it grows. The scene shows the house, meter and grid, with a **needle** towards your contracted power: orange from 80%, red above 100% («the meter may trip»). Below: **today, yesterday, week, month, last month, year** in kWh and money compared with before, hour-by-hour, day-by-day and month-by-month charts, the **F1, F2, F3 bands**, the **bill estimate** for the period and the night **base load**.",
      tocchi: [
        "**Tap a bar** in the charts: its value.",
        "**⚙️ Meter and bill** (admins): meter, contracted power, bands (Italy or your own), fixed price, from a sensor or per band, fixed fee, billing start day.",
      ],
      sola: "It turns on by itself when no panels are found; it finds the meter in the Energy configuration or by itself. Italian bands follow the ARERA calendar, with Sundays and holidays.",
      consigli: [
        "Set the contracted power from your bill (3 kW, 4.5 kW, 6 kW…): the needle warns you before the meter trips.",
        "Flat-rate tariff? Turn the bands off in ⚙️.",
        "Glance and the «Energy use» screensaver also show the needle and today's kWh.",
      ],
    },
  },
  {
    id: "stazione", dopo: "meteo", icona: "🏡", scatto: { p: "meteo", ls: { mockCasa: "stazione" }, scorri: ".mt2" },
    it: {
      titolo: "La mia stazione",
      sotto: "I dati veri di casa, prima delle previsioni.",
      serve: "Se hai una **stazione meteo** (Ecowitt, Netatmo, Davis, Tempest, Ambient Weather, Fine Offset) o anche solo un termometro esterno e un pluviometro, in cima alla pagina Meteo c'è **«La mia stazione»**: la temperatura con la **minima e la massima di oggi** e a che ora, percepita, umidità e rugiada, la **pioggia** di oggi, della settimana, del mese e dell'anno, il **vento** con la raffica massima di oggi, la **pressione** con la tendenza delle ultime 3 ore («in calo: possibile peggioramento»), UV e luce. Sotto i grafici delle ultime 24 ore e 7 giorni e il confronto con le previsioni.",
      tocchi: [
        "**Temperatura, Pioggia, Vento, Pressione** e **24 ore / 7 giorni**: scegli il grafico.",
        "**⚙️** (amministratori): correggi i sensori; puoi mostrare la temperatura della stazione nella Home e nel Colpo d'occhio.",
      ],
      sola: "Trova da sola i sensori della stazione (anche con i nomi in inglese delle integrazioni) e scarta quelli dentro casa, delle caldaie e delle piante.",
      consigli: [
        "Il salvaschermo «Meteo» usa i dati veri della stazione.",
      ],
    },
    en: {
      titolo: "My station",
      sotto: "Your home's real readings, before the forecast.",
      serve: "If you have a **weather station** (Ecowitt, Netatmo, Davis, Tempest, Ambient Weather, Fine Offset) or just an outdoor thermometer and a rain gauge, the Weather page starts with **«My station»**: the temperature with **today's low and high** and when, feels-like, humidity and dew point, **rain** today, this week, month and year, **wind** with today's highest gust, **pressure** with the 3-hour trend («falling: weather may get worse»), UV and light. Below, charts of the last 24 hours and 7 days and the comparison with the forecast.",
      tocchi: [
        "**Temperature, Rain, Wind, Pressure** and **24 h / 7 days**: pick the chart.",
        "**⚙️** (admins): fix the sensors; you can show the station temperature on Home and in Glance.",
      ],
      sola: "It finds the station's sensors by itself (also with the integrations' English names) and skips indoor, boiler and plant sensors.",
      consigli: [
        "The «Weather» screensaver uses the station's real readings.",
      ],
    },
  },
  {
    id: "acqua", scatto: { p: "acqua" },
    it: {
      sotto: "I consumi di acqua e gas, e le perdite.",
      serve: "La gemella dell'Energia: consumo di **oggi** confrontato con un giorno medio, **portata in tempo reale** se hai il sensore, il contatore dell'acqua con le cifre che scorrono e quello del gas con la fiamma. Settimana, mese e anno con i costi; i sensori di perdita.",
      tocchi: [
        "**«Chiudi l'acqua»** (con una valvola dell'acqua): doppio tocco di conferma; poi «Riapri l'acqua».",
        "**Storico**: settimana, mese, anno.",
        "**✏️ / ⚙️** (amministratori): contatori, portata, valvola, sensori di perdita, prezzi.",
      ],
      sola: "Prende i contatori dalla configurazione Energia di Home Assistant, altrimenti cerca i sensori adatti.",
      consigli: [
        "Con un sensore di portata ricevi **«Possibile perdita: l'acqua scorre da 2 ore»** negli Avvisi; minuti e portata minima si scelgono in ⚙️.",
      ],
    },
    en: {
      sotto: "Water and gas usage, and leaks.",
      serve: "Energy's twin: **today's** usage compared with an average day, **live flow** if you have the sensor, the water meter with rolling digits and the gas meter with its flame. Week, month and year with costs; the leak sensors.",
      tocchi: [
        "**«Shut off water»** (with a water valve): double tap to confirm; then «Turn water back on».",
        "**History**: week, month, year.",
        "**✏️ / ⚙️** (admins): meters, flow, valve, leak sensors, prices.",
      ],
      sola: "It takes the meters from Home Assistant's Energy configuration, otherwise it looks for suitable sensors.",
      consigli: [
        "With a flow sensor you get **«Possible leak: water has been flowing for 2 hours»** in Alerts; minutes and minimum flow are set in ⚙️.",
      ],
    },
  },
  {
    id: "clima", scatto: { p: "clima" },
    it: {
      sotto: "Condizionatori, termostati e radiatori, stanza per stanza.",
      serve: "Ogni climatizzatore è **disegnato e animato**: alette, aria fredda o calda, gocce, ventola, fiamma; la velocità segue la ventola. Accanto la temperatura e l'umidità di ogni stanza.",
      tocchi: [
        "**− e +**: temperatura voluta; i pulsanti sotto cambiano modalità; **⏻** accende o spegne.",
        "**Tocco sul disegno**: la scheda grande con il **cerchio da trascinare** per la temperatura.",
        "✏️ → **🎞️ Aspetto**: animazioni della plancia, le tue immagini o GIF, oppure l'icona.",
      ],
      sola: "Separa i circuiti della caldaia (vanno nella pagina Caldaia) dai termostati veri delle stanze.",
      consigli: [
        "Nella scheda grande la frase dice anche quanto manca: «Fa 19°, ti porto a 23° in una mezz'ora».",
      ],
    },
    en: {
      sotto: "Air conditioners, thermostats and radiators, room by room.",
      serve: "Each climate device is **drawn and animated**: louvres, cold or warm air, droplets, fan, flame; the speed follows the fan. Next to it, each room's temperature and humidity.",
      tocchi: [
        "**− and +**: target temperature; the buttons below change mode; **⏻** turns it on or off.",
        "**Tap the drawing**: the big card with the **dial to drag** for the temperature.",
        "✏️ → **🎞️ Look**: the dashboard's animations, your own images or GIFs, or the icon.",
      ],
      sola: "It separates boiler circuits (they go to the Boiler page) from the real room thermostats.",
      consigli: [
        "In the big card the sentence also says how long it takes: «It's 19°, I'll get you to 23° in about half an hour».",
      ],
    },
  },
  {
    id: "caldaia", scatto: { p: "caldaia" },
    it: {
      sotto: "La caldaia disegnata, con fiamma, pressione e acqua calda.",
      serve: "La fiamma cresce con la modulazione, l'acqua scorre verso il termosifone e il rubinetto. **Riscaldamento** acceso o spento, estate/inverno, mandata; **acqua calda** con comfort/eco e boost; **pressione** con avviso se è fuori range, codici d'errore in chiaro, manutenzione e consumi del gas con il costo.",
      tocchi: [
        "**− e +**: temperatura di mandata o dell'acqua calda.",
        "**🔧 Manutenzione**: «✅ Fatta oggi» e ogni quanti mesi ricordarla.",
        "**✏️** (amministratori): sensori, comandi, soglie della pressione, prezzo del gas.",
      ],
      sola: "Compare solo se trova la caldaia: Ariston, myVAILLANT, ViCare, Bosch/Buderus, Remeha/Baxi/De Dietrich, Immergas, ebusd, OpenTherm Gateway, Plugwise, Netatmo e altre, o dai suoi sensori.",
      consigli: [
        "Non la trova? Pagina Clima → ✏️ → «aggiungila a mano».",
      ],
    },
    en: {
      sotto: "The boiler drawn, with flame, pressure and hot water.",
      serve: "The flame grows with modulation, water flows to the radiator and the tap. **Heating** on or off, summer/winter, flow temperature; **hot water** with comfort/eco and boost; **pressure** with a warning when out of range, error codes in plain words, maintenance and gas usage with its cost.",
      tocchi: [
        "**− and +**: flow or hot water temperature.",
        "**🔧 Maintenance**: «✅ Done today» and how many months between services.",
        "**✏️** (admins): sensors, controls, pressure limits, gas price.",
      ],
      sola: "It appears only if it finds the boiler: Ariston, myVAILLANT, ViCare, Bosch/Buderus, Remeha/Baxi/De Dietrich, Immergas, ebusd, OpenTherm Gateway, Plugwise, Netatmo and more, or from its sensors.",
      consigli: [
        "Not found? Climate page → ✏️ → «add it by hand».",
      ],
    },
  },
  {
    id: "aria", scatto: { p: "aria" },
    it: {
      sotto: "Com'è l'aria in ogni stanza, e cosa fare.",
      serve: "Per ogni stanza un giudizio semplice: **Ottima, Buona, Discreta, Scarsa**, con particelle che si muovono più fitte quando l'aria è peggiore. CO₂, polveri sottili (PM2.5, PM10), VOC, NO₂, formaldeide, radon e umidità; **consigli** in parole semplici con il pulsante per agire («In camera la CO₂ è alta: apri la finestra 10 minuti»); purificatori, deumidificatori e umidificatori con il filtro.",
      tocchi: [
        "**Tocco su una stanza**: ogni valore sulla sua scala colorata.",
        "**Tocco su un valore**: grafico di 24 ore, 7 o 30 giorni.",
        "**ℹ️** spiega le soglie; **⚙️** (amministratori) le cambia.",
      ],
      sola: "Compare solo se hai sensori dell'aria, purificatori o deumidificatori. I sensori di fuori servono ai consigli, non sono stanze.",
      consigli: [
        "Se una stanza resta «Scarsa» per più di 30 minuti arriva un avviso nella Home (minuti in ⚙️).",
      ],
    },
    en: {
      sotto: "How the air is in each room, and what to do.",
      serve: "Each room gets a simple rating: **Excellent, Good, Fair, Poor**, with particles moving more densely when the air is worse. CO₂, fine dust (PM2.5, PM10), VOC, NO₂, formaldehyde, radon and humidity; plain-words **tips** with a button to act («CO₂ is high in the bedroom: open the window for 10 minutes»); purifiers, dehumidifiers and humidifiers with their filter.",
      tocchi: [
        "**Tap a room**: each value on its coloured scale.",
        "**Tap a value**: 24-hour, 7- or 30-day chart.",
        "**ℹ️** explains the thresholds; **⚙️** (admins) changes them.",
      ],
      sola: "It appears only if you have air sensors, purifiers or dehumidifiers. Outdoor sensors feed the tips, they're not rooms.",
      consigli: [
        "If a room stays «Poor» for more than 30 minutes you get an alert on Home (minutes in ⚙️).",
      ],
    },
  },
  {
    id: "tapparelle", scatto: { p: "tapparelle" },
    it: {
      sotto: "Tapparelle, veneziane e tende, ognuna disegnata.",
      serve: "Ogni tapparella **sale e scende con la posizione vera** (le veneziane girano le lamelle, le tende si aprono dal centro). **Gruppi rapidi** per tutta la casa, un piano, una stanza o un lato; **scenari** come «Notte» o «Sole forte»; **automatismi** facoltativi (chiudi al tramonto, mezze chiuse col caldo, non chiudere con la finestra aperta).",
      tocchi: [
        "**Trascina sulla finestra disegnata**: la porti dove vuoi; oppure ▲ ■ ▼.",
        "**Tutte su · Metà · Tutte giù**: per casa, piano, stanza o lato.",
        "**✏️**: nome, stanza, lato della casa, aspetto e sensore della finestra.",
      ],
      sola: "Cancelli e garage non finiscono qui: stanno negli Accessi della Sicurezza. Trova da sola il sensore della finestra di ogni tapparella, quando c'è.",
      consigli: [
        "Gli scenari si salvano come script di Home Assistant (etichetta «'Nduja») e si aggiungono ai Momenti con un tocco.",
      ],
    },
    en: {
      sotto: "Roller shutters, blinds and curtains, each one drawn.",
      serve: "Each cover **goes up and down with its real position** (blinds tilt their slats, curtains open from the middle). **Quick groups** for the whole house, a floor, a room or a side; **scenes** like «Night» or «Strong sun»; optional **automations** (close at sunset, half closed when it's hot, don't close with the window open).",
      tocchi: [
        "**Drag on the drawn window**: move it where you want; or ▲ ■ ▼.",
        "**All up · Half · All down**: for house, floor, room or side.",
        "**✏️**: name, room, side of the house, look and window sensor.",
      ],
      sola: "Gates and garages don't end up here: they're in Security's Access. It finds each cover's window sensor by itself, when there is one.",
      consigli: [
        "Scenes are saved as Home Assistant scripts (label «'Nduja») and added to Moments in one tap.",
      ],
    },
  },
  {
    id: "dispositivi", scatto: { p: "dispositivi" },
    it: {
      sotto: "Prese, interruttori, ventilatori e serrature, stanza per stanza.",
      serve: "Tutto quello che si accende e si spegne e non ha una pagina sua, diviso per stanza, con lo stato e il consumo quando c'è.",
      tocchi: [
        "**Tocco sull'interruttore**: acceso o spento.",
        "**✏️ Modifica**: ＋ aggiungi, ✏️ nome e stanza, ✕ togli, trascina per l'ordine.",
      ],
      sola: "Luci, tapparelle, irrigazione, purificatori e accessi hanno le loro pagine e qui non si ripetono.",
      consigli: [
        "Una presa che accende una lampada? Aggiungila in Luci: da lì in poi è una luce.",
      ],
    },
    en: {
      sotto: "Plugs, switches, fans and locks, room by room.",
      serve: "Everything that turns on and off and doesn't have its own page, by room, with its state and power use when available.",
      tocchi: [
        "**Tap the switch**: on or off.",
        "**✏️ Edit**: ＋ add, ✏️ name and room, ✕ remove, drag to reorder.",
      ],
      sola: "Lights, covers, irrigation, purifiers and access points have their own pages and don't repeat here.",
      consigli: [
        "A plug that powers a lamp? Add it in Lights: from then on it's a light.",
      ],
    },
  },
  {
    id: "batterie", scatto: { p: "batterie" },
    it: {
      sotto: "Tutte le pile di casa, dalla più scarica.",
      serve: "Sensori, telecomandi, serrature: **una riga per dispositivo** con la pila colorata, la stanza, il tipo di pila e da quanto non si fa sentire. «🛒 Ti servono: 2 × CR2032, 1 × AA» per la spesa.",
      tocchi: [
        "**Filtri**: tutte, da cambiare, per stanza.",
        "**🔄 Ho cambiato la pila**: registra la data del cambio.",
        "**✏️** (amministratori): soglia per tutta la casa o per dispositivo, tipo e numero di pile, nascondi.",
      ],
      sola: "Trova da sola tutte le pile, senza doppioni; restano fuori i telefoni, l'auto e la batteria di casa. Se un dispositivo tace da giorni lo dice: «forse è scarica o scollegata».",
      consigli: [
        "Gli avvisi «pila scarica» della Home e del telefono seguono le soglie scelte qui.",
      ],
    },
    en: {
      sotto: "All the batteries in your home, lowest first.",
      serve: "Sensors, remotes, locks: **one row per device** with a coloured battery, the room, the battery type and how long since it was last heard. «🛒 You need: 2 × CR2032, 1 × AA» for shopping.",
      tocchi: [
        "**Filters**: all, to replace, by room.",
        "**🔄 I changed the battery**: records the date.",
        "**✏️** (admins): threshold for the whole house or per device, type and number of batteries, hide.",
      ],
      sola: "It finds every battery by itself, without duplicates; phones, the car and the home battery stay out. If a device has been silent for days it says so: «maybe flat or disconnected».",
      consigli: [
        "The «low battery» alerts on Home and on the phone follow the thresholds set here.",
      ],
    },
  },
  {
    id: "elettrodomestici", scatto: { p: "elettrodomestici" },
    it: {
      sotto: "Lavatrice, asciugatrice, lavastoviglie, forno: cosa fanno e quando finiscono.",
      serve: "Ogni elettrodomestico è **animato** (l'oblò gira, la lavastoviglie spruzza, il forno si accende) con lo stato: fermo, in funzione, finito. Potenza, consumi di oggi, ora di fine e la presa.",
      tocchi: [
        "**Tocco**: la scheda grande con l'anello di quanto manca, «finisco alle…», pausa e riprendi quando si può.",
        "**✏️ → «Quando è in funzione e quando ha finito»**: watt e minuti, la durata minima di un ciclo e se avvisarti.",
        "✏️ → aspetto: animazioni della plancia, le tue immagini o GIF, oppure l'icona.",
      ],
      sola: "Li riconosce da prese con il consumo e dalle integrazioni (per esempio Home Connect).",
      consigli: [
        "Con «Frasi degli oggetti» negli Avvisi leggi «La lavatrice ha finito, 38 minuti in anticipo».",
      ],
    },
    en: {
      sotto: "Washing machine, dryer, dishwasher, oven: what they're doing and when they'll finish.",
      serve: "Each appliance is **animated** (the drum spins, the dishwasher sprays, the oven glows) with its state: idle, running, done. Power, today's usage, end time and the plug.",
      tocchi: [
        "**Tap**: the big card with a ring showing what's left, «I'll finish at…», pause and resume when possible.",
        "**✏️ → «When it's running and when it's done»**: watts and minutes, the shortest cycle and whether to alert you.",
        "✏️ → look: the dashboard's animations, your own images or GIFs, or the icon.",
      ],
      sola: "It recognises them from plugs with power metering and from integrations (for example Home Connect).",
      consigli: [
        "With «Object sentences» in Alerts you read «The washing machine is done, 38 minutes early».",
      ],
    },
  },
  {
    id: "musica", scatto: { p: "musica" },
    it: {
      sotto: "La musica di casa: dove ascoltare, cosa ascoltare.",
      serve: "In cima scegli **dove ascolti**: questo dispositivo (telefono, tablet o PC), una cassa di Home Assistant (Alexa, Google/Nest, Sonos…) o un gruppo. Sfoglia musica e radio con le copertine; il **mini lettore** resta in basso mentre cambi pagina. Con **Music Assistant** cerchi brani, artisti, playlist e radio.",
      tocchi: [
        "**Tocco sulla copertina** di una cassa: la scheda grande con il cerchio del volume da trascinare; **tocco lungo** = muto.",
        "**⇄ Sposta su…**: passa la musica da una cassa all'altra.",
        "**☆**: playlist e radio tra i **Preferiti** di tutta la casa.",
      ],
      sola: "Ogni cassa mostra solo i comandi che supporta. Le TV vanno nella pagina Media.",
      consigli: [
        "Nella scheda grande «＋ Unisci» e «Stacca» fanno suonare più casse insieme.",
      ],
    },
    en: {
      sotto: "Music at home: where to listen, what to listen to.",
      serve: "At the top pick **where you listen**: this device (phone, tablet or PC), a Home Assistant speaker (Alexa, Google/Nest, Sonos…) or a group. Browse music and radio with covers; the **mini player** stays at the bottom while you change page. With **Music Assistant** you search tracks, artists, playlists and radio.",
      tocchi: [
        "**Tap a speaker's cover**: the big card with the volume dial to drag; **long press** = mute.",
        "**⇄ Move to…**: moves the music from one speaker to another.",
        "**☆**: playlists and radio in the house's **Favourites**.",
      ],
      sola: "Each speaker only shows the controls it supports. TVs go to the Media page.",
      consigli: [
        "In the big card «＋ Join» and «Unjoin» make several speakers play together.",
      ],
    },
  },
  {
    id: "auto", scatto: { p: "auto" },
    it: {
      sotto: "La tua auto: batteria, ricarica, posizione e comandi.",
      serve: "Foto dell'auto, batteria e autonomia, **ricarica** (velocità, tempo che manca, limite), posizione e comandi: apri e chiudi, clima, baule, ricarica.",
      tocchi: [
        "**Comandi**: per aprire serve il **doppio tocco** di conferma.",
        "**✏️**: correggi i sensori, sotto quale % la batteria è bassa, quali comandi tenere.",
      ],
      sola: "Compare solo se in Home Assistant c'è un'auto (Tesla, BMW, VW, Kia/Hyundai, Renault, Polestar, Mercedes…) e trova da sola la sua foto.",
      consigli: [
        "Un'auto non riconosciuta si aggiunge in fondo alla pagina; «🚫 Nessuno» per i sensori che la tua auto non ha.",
      ],
    },
    en: {
      sotto: "Your car: battery, charging, location and controls.",
      serve: "A photo of the car, battery and range, **charging** (speed, time left, limit), location and controls: lock and unlock, climate, boot, charging.",
      tocchi: [
        "**Controls**: unlocking needs a **double tap** to confirm.",
        "**✏️**: fix sensors, below which % the battery is low, which controls to keep.",
      ],
      sola: "It appears only if Home Assistant has a car (Tesla, BMW, VW, Kia/Hyundai, Renault, Polestar, Mercedes…) and finds its photo by itself.",
      consigli: [
        "Add an unrecognised car at the bottom of the page; «🚫 None» for sensors your car doesn't have.",
      ],
    },
  },
  {
    id: "alexa", scatto: { p: "alexa" },
    it: {
      sotto: "I tuoi Echo, i loro volumi e i messaggi.",
      serve: "Ogni Echo è **disegnato** come il suo modello (Show con l'ora e il meteo, Dot, Pop, Studio…) con una barra del volume grande nel suo colore. Quando qualcuno dice «Alexa…» il suo Echo **si accende** sullo schermo e compare la frase detta. Sotto i **messaggi**: annuncio o voce a uno, a più Echo o a tutti.",
      tocchi: [
        "**Barra del volume**: trascinala; 🔈 accanto = muto.",
        "**Messaggi**: scegli a chi, scrivi, **📢 Annuncio** o **🗣️ Parla**; frasi pronte e ultimi messaggi a un tocco.",
        "**✨ Chiedi ad Alexa**: scrivi un comando come se lo dicessi.",
      ],
      sola: "Compare con **Alexa Media Player** (dal Marketplace). Fire TV, Echo Auto e quelli non disponibili vanno in «Altri».",
      consigli: [
        "Con ✏️ scegli colore, nome, ordine e le frasi pronte. In Home c'è la scheda «Manda un messaggio».",
      ],
    },
    en: {
      sotto: "Your Echos, their volumes and messages.",
      serve: "Each Echo is **drawn** like its model (Show with time and weather, Dot, Pop, Studio…) with a big volume bar in its colour. When someone says «Alexa…» their Echo **lights up** on screen with the words spoken. Below are the **messages**: announcement or voice to one, several or all Echos.",
      tocchi: [
        "**Volume bar**: drag it; 🔈 next to it = mute.",
        "**Messages**: choose who, type, **📢 Announce** or **🗣️ Speak**; ready phrases and recent messages in one tap.",
        "**✨ Ask Alexa**: type a command as if you were saying it.",
      ],
      sola: "It appears with **Alexa Media Player** (from the Marketplace). Fire TV, Echo Auto and unavailable ones go to «Others».",
      consigli: [
        "With ✏️ choose colour, name, order and ready phrases. Home has a «Send a message» card.",
      ],
    },
  },
  {
    id: "media", scatto: { p: "media" },
    it: {
      sotto: "TV, decoder e box, con il telecomando.",
      serve: "Ogni schermo con quello che è in onda, accensione, sorgente e volume; un **telecomando virtuale** (frecce e OK, indietro, home, menu, volume, canali, numeri) e le **app di streaming** come pulsanti grandi.",
      tocchi: [
        "**Tocco sullo schermo**: la scheda grande con la TV disegnata e il telecomando; **tocco lungo** = spegni.",
        "**Telecomando**: mostra solo i tasti che funzionano; in ✏️ dai a un tasto un comando tuo.",
        "**App**: un tocco la apre (su Android/Google TV).",
      ],
      sola: "Compare se hai TV, decoder, Apple TV, Chromecast, Fire TV, console o telecomandi; manda i comandi giusti per Android/Google TV, Apple TV, Samsung, LG, Sony, Philips e Fire TV.",
      consigli: [
        "Una cassa scambiata per TV? «🔊 È una cassa» la sposta in Musica.",
      ],
    },
    en: {
      sotto: "TVs, set-top boxes and streamers, with the remote.",
      serve: "Each screen with what's on, power, source and volume; a **virtual remote** (arrows and OK, back, home, menu, volume, channels, numbers) and **streaming apps** as big buttons.",
      tocchi: [
        "**Tap the screen**: the big card with the TV drawn and the remote; **long press** = off.",
        "**Remote**: only the keys that work; in ✏️ give a key your own command.",
        "**Apps**: one tap opens it (on Android/Google TV).",
      ],
      sola: "It appears if you have TVs, set-top boxes, Apple TV, Chromecast, Fire TV, consoles or remotes; it sends the right commands for Android/Google TV, Apple TV, Samsung, LG, Sony, Philips and Fire TV.",
      consigli: [
        "A speaker mistaken for a TV? «🔊 It's a speaker» moves it to Music.",
      ],
    },
  },
  {
    id: "robot", scatto: { p: "robot" },
    it: {
      sotto: "Il robot aspirapolvere: stato, mappa, stanze, ricambi.",
      serve: "Il robot visto dall'alto mentre pulisce, torna alla base o si ricarica; batteria, mappa, pulizia per stanza, impostazioni rapide e lo stato di spazzole e filtri.",
      tocchi: [
        "**Pulisci tutto · Pausa · Alla base**: pulsanti grandi; «Trova» lo fa suonare.",
        "**Pulisci solo alcune stanze**: toccale nell'ordine in cui vuoi pulirle.",
        "**✏️**: soglia dei ricambi, numero di passate.",
      ],
      sola: "Compare se c'è un robot in Home Assistant e trova da solo la sua mappa.",
      consigli: [
        "Nella scheda grande la frase racconta cosa fa: «Sto pulendo la cucina, poi il corridoio».",
      ],
    },
    en: {
      sotto: "The robot vacuum: state, map, rooms, parts.",
      serve: "The robot seen from above while it cleans, goes home or charges; battery, map, room cleaning, quick settings and the state of brushes and filters.",
      tocchi: [
        "**Clean all · Pause · Dock**: big buttons; «Locate» makes it beep.",
        "**Clean some rooms only**: tap them in the order you want them cleaned.",
        "**✏️**: parts threshold, number of passes.",
      ],
      sola: "It appears if Home Assistant has a robot vacuum and finds its map by itself.",
      consigli: [
        "In the big card the sentence tells what it's doing: «I'm cleaning the kitchen, then the hallway».",
      ],
    },
  },
  {
    id: "irrigazione", scatto: { p: "irrigazione" },
    it: {
      sotto: "Le zone del giardino, con il meteo.",
      serve: "Una tessera per zona con il prato o l'aiuola disegnati, che si bagnano mentre la zona è accesa. Stato, tempo che manca, prossima irrigazione, umidità del terreno e pioggia prevista; **«Domani piove: vuoi saltare l'irrigazione?»** mette in pausa i programmi.",
      tocchi: [
        "**5 · 10 · 15 · 30 minuti** o una durata tua per avviare, **■** per fermare.",
        "**⚙️ su «Programmi e meteo»**: quando «piove», durata della pausa, pulsanti rapidi, umidità del terreno.",
      ],
      sola: "Trova valvole e switch da irrigazione, Rain Bird, Hydrawise, Rachio, b-hyve, OpenSprinkler, Gardena. Dove serve crea lo script «'Nduja · irrigazione» che chiude la zona dopo i minuti scelti, anche a plancia chiusa.",
      consigli: [
        "Le piante collegate a una zona si segnano annaffiate quando la zona parte.",
      ],
    },
    en: {
      sotto: "Your garden zones, with the weather.",
      serve: "One tile per zone with the lawn or flowerbed drawn, getting wet while the zone runs. State, time left, next watering, soil moisture and expected rain; **«Rain tomorrow: skip watering?»** pauses the programs.",
      tocchi: [
        "**5 · 10 · 15 · 30 minutes** or your own duration to start, **■** to stop.",
        "**⚙️ on «Programs and weather»**: when it «rains», pause length, quick buttons, soil moisture.",
      ],
      sola: "It finds irrigation valves and switches, Rain Bird, Hydrawise, Rachio, b-hyve, OpenSprinkler, Gardena. Where needed it creates the «'Nduja · irrigation» script that closes the zone after the chosen minutes, even with the dashboard closed.",
      consigli: [
        "Plants linked to a zone are marked as watered when the zone starts.",
      ],
    },
  },
  {
    id: "piante", scatto: { p: "piante", ls: { mockPianteDemo: "1" } },
    it: {
      sotto: "Le tue piante: come stanno e quando annaffiarle.",
      serve: "Una scheda per pianta con la tua foto o un disegno per tipo (verde, grassa, fiorita, aromatica, orto, albero). Umidità del terreno, luce, temperatura e fertilità con le barre, e lo stato in parole semplici: «Ha sete», «Troppa luce», «Tutto ok». **Promemoria** per annaffiare e concimare.",
      tocchi: [
        "**«Fatto oggi»**: annaffiata o concimata (con ↶ per annullare).",
        "**＋**: aggiungi una pianta, scatta o carica la foto. Tutti in casa possono farlo.",
        "**🔔** (amministratori): una notifica al giorno sul telefono.",
      ],
      sola: "Compare con l'integrazione «plant», Plant Monitor, Mi Flora o sensori del terreno, oppure appena aggiungi una pianta a mano.",
      consigli: [
        "Se domani piove, il promemoria per le piante di fuori aspetta un giorno.",
      ],
    },
    en: {
      sotto: "Your plants: how they're doing and when to water them.",
      serve: "One card per plant with your photo or a drawing by type (green, succulent, flowering, herb, vegetable, tree). Soil moisture, light, temperature and fertility with bars, and the state in plain words: «Thirsty», «Too much light», «All good». **Reminders** to water and feed.",
      tocchi: [
        "**«Done today»**: watered or fed (with ↶ to undo).",
        "**＋**: add a plant, take or upload its photo. Everyone at home can.",
        "**🔔** (admins): one notification a day on the phone.",
      ],
      sola: "It appears with the «plant» integration, Plant Monitor, Mi Flora or soil sensors, or as soon as you add a plant by hand.",
      consigli: [
        "If it rains tomorrow, the reminder for outdoor plants waits a day.",
      ],
    },
  },
  {
    id: "calendario", scatto: { p: "calendario" },
    it: {
      sotto: "Gli impegni di casa, oggi, questa settimana, questo mese.",
      serve: "Gli eventi dei calendari di Home Assistant con il colore di ogni calendario; in Home l'**Agenda** di oggi e domani.",
      tocchi: [
        "**Oggi · Settimana · Mese**: ogni dispositivo ricorda la vista.",
        "**＋ Evento**: aggiungi un impegno.",
        "**✏️ Calendari**: quali mostrare, colori, quanti giorni ed eventi nell'Agenda della Home.",
      ],
      sola: "Usa tutti i calendari che hai in Home Assistant (Google, Local Calendar, CalDAV…).",
      consigli: [
        "Per aggiungere eventi serve un calendario in cui si può scrivere, per esempio Local Calendar.",
      ],
    },
    en: {
      sotto: "The household's events: today, this week, this month.",
      serve: "Events from your Home Assistant calendars, each with its colour; on Home, the **Agenda** for today and tomorrow.",
      tocchi: [
        "**Today · Week · Month**: each device remembers the view.",
        "**＋ Event**: add an event.",
        "**✏️ Calendars**: which to show, colours, how many days and events in the Home Agenda.",
      ],
      sola: "It uses every calendar you have in Home Assistant (Google, Local Calendar, CalDAV…).",
      consigli: [
        "To add events you need a calendar you can write to, for example Local Calendar.",
      ],
    },
  },
  {
    id: "liste", scatto: { p: "liste" },
    it: {
      sotto: "La spesa e le cose da fare, in tempo reale.",
      serve: "Le liste di Home Assistant (Lista della spesa, Local To-do, Google Tasks, Todoist, Bring!…): una voce aggiunta da Alexa o da un altro telefono compare subito. La spesa si divide **per reparto**; le scadenze si colorano (scaduto, oggi, domani).",
      tocchi: [
        "**Aggiungi…** in alto, con Invio; i **suggerimenti** dalle voci usate più spesso.",
        "**Spunta grande**: fatto; le fatte vanno in fondo e si svuotano con un tocco.",
        "**Trascina ⠿**: riordina; **tocco su una voce**: nome, note, scadenza.",
      ],
      sola: "Indovina il reparto di ogni voce; se sbaglia, tocca l'icona accanto: se lo ricorda per tutta la casa.",
      consigli: [
        "⭐ su una lista la mette nella Home, con un campo per aggiungere al volo.",
      ],
    },
    en: {
      sotto: "Shopping and to-dos, in real time.",
      serve: "Home Assistant's lists (Shopping list, Local To-do, Google Tasks, Todoist, Bring!…): an item added by Alexa or another phone shows up at once. Shopping is grouped **by aisle**; due dates are coloured (overdue, today, tomorrow).",
      tocchi: [
        "**Add…** at the top, with Enter; **suggestions** from your most used items.",
        "**Big tick**: done; done items go to the bottom and clear in one tap.",
        "**Drag ⠿**: reorder; **tap an item**: name, notes, due date.",
      ],
      sola: "It guesses the aisle of each item; if it's wrong, tap the icon next to it: it remembers for the whole house.",
      consigli: [
        "⭐ on a list puts it on Home, with a field to add things on the fly.",
      ],
    },
  },
  {
    id: "scadenze", scatto: { p: "scadenze" },
    it: {
      sotto: "Bollette, revisione, bollo, visite: niente più dimenticanze.",
      serve: "Divise in **Scadute, Oggi, Prossimi 7 giorni, Più avanti**, con categoria, importo e totale del mese. Quelle che si ripetono, con «Fatto», passano da sole alla prossima data.",
      tocchi: [
        "**＋**: nuova scadenza; mentre scrivi il titolo la plancia indovina la categoria.",
        "**«Fatto»**: la segna, o passa alla prossima se si ripete.",
        "**🔔** (amministratori): promemoria sul telefono il giorno stesso o qualche giorno prima.",
      ],
      sola: "Le salva in una lista di Home Assistant: non ce l'hai? «Crea la lista Scadenze» la crea con un tocco.",
      consigli: [
        "Nella notifica del telefono ci sono «✓ Fatto» e «⏰ Ricordamelo domani».",
      ],
    },
    en: {
      sotto: "Bills, car service, tax, appointments: nothing forgotten.",
      serve: "Grouped into **Overdue, Today, Next 7 days, Later**, with category, amount and monthly total. Recurring ones move to the next date by themselves when you tap «Done».",
      tocchi: [
        "**＋**: new deadline; while you type the title the dashboard guesses the category.",
        "**«Done»**: ticks it, or moves it to the next date if it repeats.",
        "**🔔** (admins): phone reminders on the day or a few days before.",
      ],
      sola: "It saves them in a Home Assistant list: don't have one? «Create the Deadlines list» makes it in one tap.",
      consigli: [
        "The phone notification has «✓ Done» and «⏰ Remind me tomorrow».",
      ],
    },
  },
  {
    id: "faccende", scatto: { p: "faccende" },
    it: {
      sotto: "I lavori di casa, a chi tocca e quando.",
      serve: "Ogni faccenda con ogni quanti giorni va fatta, **a chi tocca** (a turno o sempre la stessa persona) e l'ultima volta. Divise in «In ritardo», «Oggi» e «Prossimi giorni».",
      tocchi: [
        "**«Fatto»**: registra chi e quando e passa il turno.",
        "**«Le mie»**: solo quelle che toccano a te.",
        "**✏️**: «Fatto da…» per un'altra persona e «Annulla l'ultimo Fatto».",
      ],
      sola: "Con l'elenco vuoto propone qualche esempio (bagno, aspirapolvere, spazzatura…). Chiunque in casa può aggiungerle e segnarle.",
      consigli: [
        "Dal tablet di casa la plancia chiede chi l'ha fatta.",
      ],
    },
    en: {
      sotto: "Housework: whose turn it is and when.",
      serve: "Each chore with how often it's due, **whose turn** (rotating or always the same person) and the last time. Grouped into «Overdue», «Today» and «Coming days».",
      tocchi: [
        "**«Done»**: records who and when and passes the turn.",
        "**«Mine»**: only the ones that are yours.",
        "**✏️**: «Done by…» for someone else and «Undo last Done».",
      ],
      sola: "With an empty list it suggests a few examples (bathroom, vacuuming, bins…). Anyone at home can add and tick them.",
      consigli: [
        "From the household tablet the dashboard asks who did it.",
      ],
    },
  },
  {
    id: "bacheca", scatto: { p: "bacheca" },
    it: {
      sotto: "I bigliettini di famiglia.",
      serve: "Messaggi brevi con autore, data e colore. Uno si può **appuntare** in alto; con una **scadenza** (stasera, domani, una settimana…) sparisce da solo. Un messaggio nuovo compare subito su tutti i dispositivi.",
      tocchi: [
        "**Scrivi**: testo, colore, scadenza.",
        "**📌**: appunta; **🗑**: cancella con il doppio tocco (chi l'ha scritto o un amministratore).",
      ],
      sola: "Chiunque in casa può scrivere; in Home ci sono gli ultimi messaggi.",
      consigli: [
        "Perfetta per il tablet in cucina: «Stasera cena alle 20».",
      ],
    },
    en: {
      sotto: "The family's sticky notes.",
      serve: "Short messages with author, date and colour. One can be **pinned** at the top; with an **expiry** (tonight, tomorrow, a week…) it disappears by itself. A new message shows up at once on every device.",
      tocchi: [
        "**Write**: text, colour, expiry.",
        "**📌**: pin; **🗑**: delete with a double tap (the author or an admin).",
      ],
      sola: "Anyone at home can write; Home shows the latest messages.",
      consigli: [
        "Perfect for the kitchen tablet: «Dinner at 8 tonight».",
      ],
    },
  },
  {
    id: "chat", scatto: { p: "chat", ls: { mockChatDemo: "1" }, clic: '[data-act="ktApri"][data-id="famiglia"]' },
    it: {
      sotto: "I messaggi tra le persone di casa, senza servizi esterni.",
      serve: "Il gruppo **«Famiglia»** e una chat a due con ogni persona, con foto, ✓✓ letto ed emoji rapide. Tutto resta in Home Assistant e ognuno vede solo le sue conversazioni.",
      tocchi: [
        "**＋**: condividi la tua posizione, una foto da una telecamera di casa o una voce della spesa.",
        "**Tocco su un tuo messaggio**: copialo o cancellalo.",
        "**🔔**: spegni le notifiche solo per te.",
      ],
      sola: "Compare quando almeno due persone di Home Assistant hanno un utente. Se la plancia è chiusa arriva una notifica sul telefono.",
      consigli: [
        "In Home Assistant collega ogni persona al suo utente (Impostazioni → Persone).",
      ],
    },
    en: {
      sotto: "Messages between the people at home, no outside services.",
      serve: "The **«Family»** group and a one-to-one chat with each person, with photos, ✓✓ read and quick emoji. Everything stays in Home Assistant and everyone sees only their own conversations.",
      tocchi: [
        "**＋**: share your location, a photo from a home camera or a shopping item.",
        "**Tap one of your messages**: copy or delete it.",
        "**🔔**: turn notifications off just for you.",
      ],
      sola: "It appears when at least two Home Assistant people have a user. When the dashboard is closed a notification arrives on the phone.",
      consigli: [
        "In Home Assistant link each person to their user (Settings → People).",
      ],
    },
  },
  {
    id: "squadra", scatto: { p: "squadra" },
    it: {
      sotto: "La tua squadra: prossima partita, diretta, classifica.",
      serve: "Prossima partita con il conto alla rovescia, competizione, stadio e TV; la **diretta** con gol e cartellini e una piccola animazione al gol; ultimi risultati e classifica.",
      tocchi: [
        "**In alto**: scegli la squadra, se ne segui più d'una.",
        "**✏️**: unisci o togli le fonti, nome, sigla e colori, la classifica.",
        "**📱**: avviso sul telefono a ogni gol e a fine partita.",
      ],
      sola: "Compare con Team Tracker o Calcio Live (dal Marketplace), oppure con un calendario delle partite. I loghi arrivano solo dall'integrazione, altrimenti uno stemma disegnato.",
      consigli: [
        "In Home la scheda dice «tra quanto» o il risultato in diretta.",
      ],
    },
    en: {
      sotto: "Your team: next match, live, table.",
      serve: "Next match with countdown, competition, stadium and TV; **live** with goals and cards and a small goal animation; recent results and the table.",
      tocchi: [
        "**At the top**: pick the team, if you follow more than one.",
        "**✏️**: merge or remove sources, name, short name and colours, the table.",
        "**📱**: phone alert on every goal and at full time.",
      ],
      sola: "It appears with Team Tracker or Calcio Live (from the Marketplace), or with a calendar of matches. Logos only come from the integration, otherwise a drawn crest.",
      consigli: [
        "The Home card shows «in how long» or the live score.",
      ],
    },
  },
  {
    id: "formula1", scatto: { p: "formula1", ls: { mockF1Live: "gara" } },
    it: {
      sotto: "Il weekend di Formula 1, all'ora di casa.",
      serve: "Il prossimo Gran Premio con il circuito, il conto alla rovescia e gli orari di tutte le sessioni; durante la sessione bandiere, safety car, giro, **ordine in pista** e direzione gara; classifiche piloti e costruttori e l'ultima gara con il podio.",
      tocchi: [
        "**⭐ / ✏️**: pilota e team preferiti, evidenziati ovunque.",
        "**⚙️**: sensori, sezioni da mostrare, quante righe.",
        "**📱**: avviso sul telefono prima di qualifiche, sprint o gara.",
      ],
      sola: "Compare con F1 Sensor (dal Marketplace), con un calendario della Formula 1 o con Team Tracker.",
      consigli: [
        "Il preavviso sul telefono lo scegli tu, in minuti.",
      ],
    },
    en: {
      sotto: "The Formula 1 weekend, in your local time.",
      serve: "The next Grand Prix with the circuit, countdown and the times of all sessions; during a session flags, safety car, lap, **running order** and race control; driver and constructor standings and the last race with the podium.",
      tocchi: [
        "**⭐ / ✏️**: favourite driver and team, highlighted everywhere.",
        "**⚙️**: sensors, sections to show, how many rows.",
        "**📱**: phone alert before qualifying, sprint or race.",
      ],
      sola: "It appears with F1 Sensor (from the Marketplace), a Formula 1 calendar or Team Tracker.",
      consigli: [
        "You choose how many minutes ahead the phone alert arrives.",
      ],
    },
  },
  {
    id: "sicurezza", scatto: { p: "sicurezza" },
    it: {
      sotto: "Allarme, accessi, porte, fumo e acqua, movimento.",
      serve: "L'**allarme** col tastierino; gli **Accessi** (cancello, garage, portone, serrature) con pulsanti grandi e disegni animati; porte e finestre, sensori di fumo, gas e acqua, movimento e le telecamere.",
      tocchi: [
        "**Accessi**: per aprire serve il **doppio tocco**; il tocco sul disegno apre la scheda grande (tocco lungo = apri e tieni aperto, se la centralina lo permette).",
        "**Allarme**: scegli come inserirlo (in casa, fuori casa, notte…) e scrivi il codice sul tastierino.",
        "**⚙️**: quali sensori danno l'allarme, quanti sensori di movimento e quali telecamere mostrare.",
      ],
      sola: "Mette negli Accessi da sola cancelli, garage, porte e serrature.",
      consigli: [
        "Con ✏️ → ＋ Aggiungi accesso usi anche un relè o uno script, con il sensore che dice se è aperto.",
      ],
    },
    en: {
      sotto: "Alarm, access, doors, smoke and water, motion.",
      serve: "The **alarm** with its keypad; **Access** (gate, garage, front door, locks) with big buttons and animated drawings; doors and windows, smoke, gas and water sensors, motion and cameras.",
      tocchi: [
        "**Access**: opening needs a **double tap**; tapping the drawing opens the big card (long press = open and keep open, if the controller allows it).",
        "**Alarm**: choose how to arm it (home, away, night…) and type the code on the keypad.",
        "**⚙️**: which sensors trigger the alarm, how many motion sensors and which cameras to show.",
      ],
      sola: "It puts gates, garages, doors and locks in Access by itself.",
      consigli: [
        "With ✏️ → ＋ Add access you can also use a relay or a script, with the sensor that says if it's open.",
      ],
    },
  },
  {
    id: "natale", scatto: { p: "natale", ora: "2026-12-12T18:30" },
    it: {
      sotto: "Le luci di festa, solo nel periodo di Natale.",
      serve: "Al centro l'**albero disegnato** che si accende come quello vero (colore, luminosità, effetto del Twinkly), attorno il presepe e le altre luci di festa. Pulsanti grandi, orari automatici e il conto alla rovescia.",
      tocchi: [
        "**Accendi tutto il Natale / Spegni tutto**.",
        "**Albero**: luminosità, colori di festa, modalità ed effetti.",
        "**Orari**: accendi al tramonto (o a un'ora), spegni alle…, solo nel periodo.",
      ],
      sola: "Trova le luci di festa dal nome, dalla stanza o dalle etichette (natale, albero, presepe, luminarie…). Compare dal 1° dicembre al 6 gennaio.",
      consigli: [
        "In ⚙️ Impostazioni → Natale cambi le date o la apri fuori periodo per prepararla. Ci sono anche gli sfondi e il salvaschermo di Natale.",
      ],
    },
    en: {
      sotto: "Festive lights, only during the Christmas season.",
      serve: "In the middle, the **drawn tree** lights up like the real one (Twinkly colour, brightness, effect), with the nativity and other festive lights around it. Big buttons, automatic schedules and the countdown.",
      tocchi: [
        "**Turn on all of Christmas / Turn everything off**.",
        "**Tree**: brightness, festive colours, modes and effects.",
        "**Schedule**: on at sunset (or a time), off at…, only during the season.",
      ],
      sola: "It finds festive lights by name, room or label (christmas, tree, nativity, xmas…). It shows from 1 December to 6 January.",
      consigli: [
        "In ⚙️ Settings → Christmas change the dates or open it out of season to get it ready. There are Christmas backgrounds and a screensaver too.",
      ],
    },
  },
  {
    id: "telecamere", scatto: { p: "telecamere" },
    it: {
      sotto: "Le telecamere, dall'anteprima alla diretta.",
      serve: "Anteprime leggere di tutte le telecamere e, al tocco, la **diretta** con audio, tutto schermo e istantanea. Gruppi facoltativi («Esterno», «Interno»).",
      tocchi: [
        "**Tocco sull'anteprima**: la diretta.",
        "**🔊 · ⛶ · 📸**: audio, tutto schermo, istantanea (sul telefono si apre «Condividi»).",
        "**✏️**: flusso per la diretta e per l'anteprima, metodo, nome, ordine, gruppi.",
      ],
      sola: "Sceglie da solo il modo migliore (WebRTC, poi HLS, MJPEG o una foto ogni 2 secondi) e lo ricorda; unisce i doppioni della stessa telecamera.",
      consigli: [
        "Mentre guardi una diretta il salvaschermo non parte.",
      ],
    },
    en: {
      sotto: "Cameras, from preview to live.",
      serve: "Light previews of all cameras and, on tap, the **live view** with audio, full screen and snapshot. Optional groups («Outdoor», «Indoor»).",
      tocchi: [
        "**Tap a preview**: live view.",
        "**🔊 · ⛶ · 📸**: audio, full screen, snapshot (on phones «Share» opens).",
        "**✏️**: stream for live and for preview, method, name, order, groups.",
      ],
      sola: "It picks the best way by itself (WebRTC, then HLS, MJPEG or a photo every 2 seconds) and remembers it; it merges duplicate streams of the same camera.",
      consigli: [
        "While you watch a live view the screensaver doesn't start.",
      ],
    },
  },
  {
    id: "automazioni", scatto: { p: "automazioni" },
    it: {
      sotto: "Accendi, spegni, metti in pausa e crea le automazioni.",
      serve: "Ogni automazione ha un **interruttore** e «ultima volta: 2 h fa», divise per stanza o etichetta. Toccandone una leggi **in italiano cosa fa** e le ultime 5 volte che è partita. Il costruttore **Quando → Solo se → Allora** e le **ricette pronte** ne creano di nuove senza YAML.",
      tocchi: [
        "**Nome**: la frase, la cronologia, la **pausa** (1 ora, 4 ore, fino a domattina, a scelta), Esegui, Modifica, Duplica. **Spegni tutte** di un gruppo chiede un secondo tocco.",
        "**＋ Nuova automazione**: soglie, porte aperte da N minuti, movimento, pulsanti, elettrodomestico finito, allarme, calendario, pioggia; luci col colore, «per N minuti», tapparelle, clima, Alexa. **Prova ora** fa subito le azioni.",
        "**📚 Ricette pronte**: solo per i dispositivi che hai; salva o ritocca.",
      ],
      sola: "Quelle fatte in Home Assistant si modificano qui solo se il costruttore le riscrive identiche; prima di cambiarne una tiene la versione di prima («Rimetti com'era prima»).",
      consigli: [
        "Chi non è amministratore accende, spegne e mette in pausa. I **Momenti** si creano dalla Home.",
      ],
    },
    en: {
      sotto: "Turn on, off, pause and create automations.",
      serve: "Every automation has a **switch** and «last ran: 2 h ago», grouped by room or label. Tap one to read **in plain words what it does** and its latest 5 runs. The **When → Only if → Then** builder and the **ready-made recipes** create new ones without YAML.",
      tocchi: [
        "**Name**: the sentence, the history, the **pause** (1 hour, 4 hours, until morning, your choice), Run, Edit, Duplicate. **Turn all off** for a group needs a second tap.",
        "**＋ New automation**: thresholds, doors open for N minutes, motion, buttons, appliance done, alarm, calendar, rain; lights with colour, «for N minutes», covers, climate, Alexa. **Try now** runs the actions right away.",
        "**📚 Ready-made recipes**: only for the devices you have; save or fine-tune.",
      ],
      sola: "Automations made in Home Assistant are edited here only if the builder rewrites them identically; before changing one it keeps the previous version («Put back as it was»).",
      consigli: [
        "Non-admins can turn on, off and pause. **Moments** are created on Home.",
      ],
    },
  },
  {
    id: "rete", scatto: { p: "rete" },
    it: {
      sotto: "Internet, modem, server e Wi-Fi ospiti.",
      serve: "Internet c'è o no, download e upload in tempo reale, Speedtest con il grafico; schede per modem, mini PC, NAS, Proxmox, Raspberry e stampanti (acceso, CPU, RAM, disco, temperatura); dispositivi online e **nuovi visti oggi**; Wi-Fi ospiti con il QR; gruppo di continuità.",
      tocchi: [
        "**Tocco sull'IP pubblico**: lo mostra (di base è nascosto).",
        "**▶ Prova adesso**: Speedtest.",
        "**Riavvia · Spegni · Accendi**: con doppia conferma.",
      ],
      sola: "Compare solo se trova qualcosa: FRITZ!Box, UniFi, Omada, Deco, Mikrotik, OpenWrt, Netgear, Asus, Vodafone Station, UPnP…",
      consigli: [
        "Con ✏️ scrivi nome e password della rete ospiti: gli ospiti inquadrano il QR e sono connessi.",
      ],
    },
    en: {
      sotto: "Internet, modem, servers and guest Wi-Fi.",
      serve: "Whether Internet is up, live download and upload, Speedtest with a chart; cards for modem, mini PC, NAS, Proxmox, Raspberry and printers (on, CPU, RAM, disk, temperature); devices online and **new ones seen today**; guest Wi-Fi with a QR code; UPS.",
      tocchi: [
        "**Tap the public IP**: shows it (hidden by default).",
        "**▶ Test now**: Speedtest.",
        "**Restart · Shut down · Power on**: with double confirmation.",
      ],
      sola: "It appears only if it finds something: FRITZ!Box, UniFi, Omada, Deco, Mikrotik, OpenWrt, Netgear, Asus, Vodafone Station, UPnP…",
      consigli: [
        "With ✏️ type the guest network name and password: guests scan the QR and they're on.",
      ],
    },
  },
  {
    id: "aggiornamenti", scatto: { p: "aggiornamenti" },
    it: {
      sotto: "Gli aggiornamenti di Home Assistant, dalla plancia.",
      serve: "Home Assistant, componenti aggiuntivi, Marketplace e firmware: le novità, il backup prima di installare, l'avanzamento.",
      tocchi: [
        "**Installa**: uno alla volta; **Installa tutti**: Home Assistant per ultimo.",
        "**Salta**: non propone più quella versione (si può rimettere).",
      ],
      sola: "Raccoglie da sola tutti gli aggiornamenti che Home Assistant conosce, divisi per tipo.",
      consigli: [
        "Dopo un aggiornamento di 'Nduja riavvia Home Assistant.",
      ],
    },
    en: {
      sotto: "Home Assistant updates, from the dashboard.",
      serve: "Home Assistant, add-ons, Marketplace and firmware: release notes, a backup before installing, progress.",
      tocchi: [
        "**Install**: one at a time; **Install all**: Home Assistant last.",
        "**Skip**: stops offering that version (you can bring it back).",
      ],
      sola: "It gathers every update Home Assistant knows about, grouped by type.",
      consigli: [
        "After updating 'Nduja, restart Home Assistant.",
      ],
    },
  },
  {
    id: "impostazioni", scatto: { p: "impostazioni" },
    it: {
      sotto: "Il manuale, le scelte di questo dispositivo e quelle della casa.",
      serve: "In alto questo **manuale** e la **🏡 casa di esempio**. Poi **📱 Questo dispositivo** (tema, leggibilità, pagina iniziale, salvaschermo, grafica, chiosco), **🎨 Aspetto** (sfondi), **🎙️ Assistente vocale** e, per gli amministratori, la procedura guidata, la plancia per persona, ✨ Cosa puoi aggiungere, 🩺 Controlla Home Assistant e 🛟 Copie di sicurezza. Per tutti c'è 🐞 Segnala un problema.",
      tocchi: [
        "**📖 Apri / ⬇️ Scarica PDF**: questo manuale.",
        "**👀 Prova la casa di esempio**: una casa inventata dentro la plancia; niente arriva a Home Assistant.",
        "**🔠 Leggibilità**: testo più grande, contrasto alto, movimento ridotto (solo su questo dispositivo).",
        "**Riavvia il wizard**: riparte da Automatica o Manuale (le pagine create da te restano).",
        "**⬇️ Esporta / ⬆️ Importa**: un file con tutte le scelte della plancia (prima di importare la plancia fa una copia di sicurezza).",
      ],
      sola: "Chi non è amministratore vede solo le scelte del suo dispositivo, l'aspetto e l'assistente vocale.",
      consigli: [
        "Le **copie di sicurezza** si fanno da sole; «Esporta» serve per avere un file tuo o per portare la plancia su un altro Home Assistant.",
      ],
    },
    en: {
      sotto: "The manual, this device's choices and the home's.",
      serve: "At the top, this **manual** and the **🏡 sample home**. Then **📱 This device** (theme, readability, start page, screensaver, graphics, kiosk), **🎨 Appearance** (backgrounds), **🎙️ Voice assistant** and, for admins, the setup wizard, per-person dashboard, ✨ What you can add, 🩺 Check Home Assistant and 🛟 Safety copies. Everyone has 🐞 Report a problem.",
      tocchi: [
        "**📖 Open / ⬇️ Download PDF**: this manual.",
        "**👀 Try the sample home**: a made-up home inside the dashboard; nothing reaches Home Assistant.",
        "**🔠 Readability**: larger text, high contrast, reduced motion (this device only).",
        "**Restart the wizard**: starts again from Automatic or Manual (pages you created are kept).",
        "**⬇️ Export / ⬆️ Import**: a file with every dashboard choice (before importing, the dashboard makes a safety copy).",
      ],
      sola: "Non-admins only see their device's choices, appearance and voice assistant.",
      consigli: [
        "**Safety copies** are made by themselves; «Export» is for keeping a file of your own or moving the dashboard to another Home Assistant.",
      ],
    },
  },
  {
    id: "copie", dopo: "impostazioni", icona: "🛟", scatto: { p: "impostazioni", ls: { mockVersione: "0.7.63-dev", mockCopie: COPIE_PROVA }, clic: '[data-act="cpApri"]', attesa: 1200 },
    it: {
      titolo: "Copie di sicurezza",
      sotto: "Le scelte della casa si salvano da sole: se qualcosa va storto, torni indietro.",
      serve: "Home Assistant salva da solo una **copia delle scelte della casa** (scelte della plancia e dati di Colpo d'occhio, Faccende, Bacheca, Liste, Piante…) **prima di ogni cambiamento grosso** (procedura guidata, importazione, ripristino, «Ricomincia dal benvenuto», aggiornamento di 'Nduja) e **una volta al giorno** se qualcosa è cambiato. Tiene le ultime 10 copie più l'ultima di ognuna delle 3 versioni di 'Nduja più recenti; sono compresse e stanno in Home Assistant, quindi valgono per tutti i dispositivi.",
      tocchi: [
        "**⚙️ Impostazioni → 🛟 Copie di sicurezza → Apri**: l'elenco con data, motivo, chi ha fatto il cambiamento e dimensione.",
        "**↩️ Ripristina**: dice cosa cambierà, poi rimette la copia; prima fa una copia di adesso, così puoi sempre tornare indietro.",
        "**⬇️**: scarica la copia come file (si ricarica con «Importa le impostazioni»). **🗑**: la elimina (tocca due volte).",
      ],
      sola: "Solo per gli amministratori. Ripristinare non tocca dispositivi né automazioni di Home Assistant; restano fuori le cose del momento, come le pause delle automazioni e l'irrigazione in corso.",
      consigli: [
        "Le copie sono anche nei backup di Home Assistant: se rifai Home Assistant da un backup, tornano anche loro.",
      ],
    },
    en: {
      titolo: "Safety copies",
      sotto: "The home's choices save themselves: if something goes wrong, you go back.",
      serve: "Home Assistant saves by itself a **copy of the home's choices** (dashboard choices and the data of At a glance, Chores, Board, Lists, Plants…) **before every big change** (setup wizard, import, restore, «Restart from the welcome screen», 'Nduja update) and **once a day** if something changed. It keeps the latest 10 copies plus the latest of each of the 3 most recent 'Nduja versions; they're compressed and stored in Home Assistant, so they apply to every device.",
      tocchi: [
        "**⚙️ Settings → 🛟 Safety copies → Open**: the list with date, reason, who made the change and size.",
        "**↩️ Restore**: tells you what will change, then puts the copy back; first it makes a copy of now, so you can always go back.",
        "**⬇️**: downloads the copy as a file (load it back with «Import settings»). **🗑**: deletes it (tap twice).",
      ],
      sola: "Admins only. Restoring doesn't touch Home Assistant devices or automations; things of the moment stay out, like automation pauses and watering in progress.",
      consigli: [
        "The copies are also in Home Assistant's backups: if you rebuild Home Assistant from a backup, they come back too.",
      ],
    },
  },
  {
    id: "segnala", dopo: "impostazioni", icona: "🐞", scatto: { p: "impostazioni", clic: '[data-act="sgApri"]' },
    it: {
      titolo: "Segnala un problema",
      sotto: "Qualcosa non va o hai un'idea? Un tocco e la segnalazione è pronta.",
      serve: "**⚙️ Impostazioni → 🐞 Segnala un problema** (anche nella schermata «La plancia non riesce a partire») prepara una segnalazione per GitHub: scegli il tipo (non funziona, si vede male, va lento, idea), scrivi cosa è successo e la plancia aggiunge da sola **i dettagli che servono**: versioni di 'Nduja e di Home Assistant, browser e dispositivo, lingua, grafica e fluidità, quante entità e pagine, la pagina aperta e gli ultimi errori con file e riga.",
      tocchi: [
        "**Tocco su una riga dei dettagli**: la togli (diventa barrata); il riquadro sotto mostra **esattamente** cosa verrà inviato.",
        "**↗ Apri su GitHub**: apre la segnalazione già compilata; se il testo è troppo lungo lo copia negli appunti e ti dice di incollarlo.",
        "**📋 Copia**: mette tutto negli appunti, per incollarlo dove vuoi.",
      ],
      sola: "**Niente dati personali**: niente nomi di entità, indirizzi IP o web, posizione o persone. Non parte niente da solo: la invii tu, su GitHub (serve un account gratuito).",
      consigli: [
        "Scrivi cosa stavi facendo e cosa ti aspettavi: aiuta più di ogni dettaglio tecnico.",
      ],
    },
    en: {
      titolo: "Report a problem",
      sotto: "Something's wrong or have an idea? One tap and the report is ready.",
      serve: "**⚙️ Settings → 🐞 Report a problem** (also on the «The dashboard can't start» screen) prepares a GitHub report: pick the kind (doesn't work, looks wrong, slow, idea), write what happened and the dashboard adds **the details needed** by itself: 'Nduja and Home Assistant versions, browser and device, language, graphics and smoothness, how many entities and pages, the open page and the latest errors with file and line.",
      tocchi: [
        "**Tap a details line**: it's removed (struck through); the box below shows **exactly** what will be sent.",
        "**↗ Open on GitHub**: opens the report already filled in; if the text is too long it copies it to the clipboard and tells you to paste it.",
        "**📋 Copy**: puts everything on the clipboard, to paste wherever you like.",
      ],
      sola: "**No personal data**: no entity names, IP or web addresses, location or people. Nothing is sent by itself: you send it, on GitHub (a free account is needed).",
      consigli: [
        "Write what you were doing and what you expected: it helps more than any technical detail.",
      ],
    },
  },
  {
    id: "oggetti", fine: true, icona: "🖼️", scatto: { p: "sicurezza", clic: '[data-k="cancello:cover.cancello"]' },
    it: {
      titolo: "Schede oggetto",
      sotto: "Tocchi un oggetto e lui ti risponde.",
      serve: "Cancello, porta con serratura, robot, clima, luci, lavatrice, asciugatrice, lavastoviglie, casse e TV hanno una **scheda grande**: l'oggetto disegnato al centro si muove con lo stato vero (il cancello scorre, la chiave gira, l'oblò gira) e in alto **una frase come se parlasse** («Sono chiuso. Tutto tranquillo.»). Sotto i comandi più usati, grandi.",
      tocchi: [
        "**Tocco**: l'azione principale (apri o chiudi, pausa, accendi).",
        "**Tocco lungo** (un anello si riempie): sblocca la porta, apri e tieni aperto il cancello, muto per le casse.",
        "**Cerchio da trascinare**: temperatura del clima, luminosità delle luci e volume delle casse.",
      ],
      sola: "Si aprono toccando l'oggetto nella sua pagina, nella Home o nella scheda «✨ Oggetti in primo piano».",
      consigli: [
        "Le frasi si spengono una per una in ⚙️ Impostazioni → 🎨 Aspetto → «Frasi degli oggetti».",
        "Preferisci i pannelli di prima? ⚙️ Impostazioni → Questo dispositivo → «Pannelli di prima».",
      ],
    },
    en: {
      titolo: "Object cards",
      sotto: "Tap an object and it answers.",
      serve: "Gate, door lock, robot vacuum, climate, lights, washing machine, dryer, dishwasher, speakers and TVs have a **big card**: the object drawn in the middle moves with its real state (the gate slides, the key turns, the drum spins) and at the top **a sentence as if it were talking** («I'm closed. All quiet.»). Below are the most used controls, big.",
      tocchi: [
        "**Tap**: the main action (open or close, pause, turn on).",
        "**Long press** (a ring fills up): unlock the door, open and keep the gate open, mute a speaker.",
        "**Dial to drag**: climate temperature, light brightness and speaker volume.",
      ],
      sola: "They open when you tap the object on its page, on Home or in the «✨ Featured objects» card.",
      consigli: [
        "Sentences can be turned off one by one in ⚙️ Settings → 🎨 Appearance → «Object sentences».",
        "Prefer the old panels? ⚙️ Settings → This device → «Previous panels».",
      ],
    },
  },
  {
    id: "assistente", fine: true, icona: "🎙️", scatto: { p: "home", clic: '[data-act="vcApri"]' },
    it: {
      titolo: "Assistente vocale",
      sotto: "Parla o scrivi alla casa, da qualsiasi pagina.",
      serve: "Il pulsante **🎙️** in alto (sul telefono anche quello rotondo in basso) apre la conversazione con **Assist** di Home Assistant: scrivi o parla, vedi il testo riconosciuto e la risposta, e la senti se la tua pipeline ha una voce.",
      tocchi: [
        "**🎙️**: parla; Home Assistant capisce da solo quando hai finito (oppure ■).",
        "**Frasi da toccare**: «Spegni tutte le luci», «Aggiungi latte alla spesa»…",
        "**⚙️ Impostazioni → Assistente vocale**: pipeline, lingua, pulsante, risposta a voce, frasi tue (per dispositivo).",
      ],
      sola: "Usa l'assistente di Home Assistant, senza servizi esterni aggiunti dalla plancia.",
      consigli: [
        "Il microfono funziona solo se apri Home Assistant con un indirizzo https://; altrimenti resta la tastiera.",
      ],
    },
    en: {
      titolo: "Voice assistant",
      sotto: "Talk or type to your home, from any page.",
      serve: "The **🎙️** button at the top (on phones also the round one at the bottom) opens a conversation with Home Assistant's **Assist**: type or talk, see the recognised text and the answer, and hear it if your pipeline has a voice.",
      tocchi: [
        "**🎙️**: talk; Home Assistant knows when you've finished (or ■).",
        "**Tap-to-send phrases**: «Turn off all the lights», «Add milk to the shopping list»…",
        "**⚙️ Settings → Voice assistant**: pipeline, language, button, spoken reply, your own phrases (per device).",
      ],
      sola: "It uses Home Assistant's assistant, with no external services added by the dashboard.",
      consigli: [
        "The microphone only works when you open Home Assistant at an https:// address; otherwise the keyboard stays.",
      ],
    },
  },
];

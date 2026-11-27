# Verso la 0.8.0 — controllo finale delle anteprime

## Pronta per la 0.8.0: sì
Controllo della **0.7.65-dev** (27 novembre 2026): tutte le 37 pagine senza errori in tema chiaro e scuro, in italiano e in inglese, a 390, 800, 1340 e 1920 px;
ridisegno dopo un cambio di stato **sotto 0,4 s su ogni pagina** con 3.462 entità e la CPU rallentata 6× (con la 0.7.64 da 0,7 a 27 s; 0,7 s al massimo quando cambiano le entità, una volta sola); procedura guidata, utente non amministratore,
salvaschermo e avvisi senza errori; arrivo dalla 0.7.10.4 provato con il `LAYOUT` di allora, prima e dopo il riavvio di Home Assistant: parte, tiene tutte le scelte e non salva niente da sola.
Le cose rimaste della sezione 3 sono fatte (luci come scheda oggetto, dubbi chiariti, pulizie). Resta solo un consiglio che **non blocca**: confrontare una volta i disegni della
guida con il Marketplace vero della 2026.11 (sezione 3). Il testo per il CHANGELOG della 0.8.0 è in `docs/sviluppo/0.8.0-note.md`; i risultati del controllo sono nella sezione 5.

Preparato con la 0.7.57-dev (25 novembre 2026), rileggendo le schede in `docs/sviluppo/`, la ROADMAP, il CHANGELOG e i tag GitHub; aggiornato con la 0.7.65-dev.
Serve a Giovanni per decidere quando pubblicare la **0.8.0** ufficiale.

## 1. Cosa è stato fatto
Tutte le anteprime della tabella della ROADMAP sono uscite, ognuna con il suo tag (`v0.7.11-dev` … `v0.7.65-dev`) e la sua sezione nel CHANGELOG. Dopo la 0.7.57: 0.7.58 Fluidità · 0.7.59 Veloce con migliaia di entità · 0.7.60 Alexa · 0.7.61 Manuale PDF · 0.7.62 Casa di esempio, testo grande e contrasto · 0.7.63 Copie di sicurezza e «Segnala un problema» · 0.7.64 Automazioni complete · 0.7.65 Luci come scheda oggetto e controllo finale.

| Area | Anteprime |
|---|---|
| Casa e vista | 0.7.11 Novità in casa · 0.7.49 Cosa puoi aggiungere · 0.7.50 Trascina e sposta · 0.7.51 Colpo d'occhio · 0.7.53 Casa in 3D · 0.7.55–0.7.56 Schede oggetto |
| Dispositivi | 0.7.18 Elettrodomestici · 0.7.25 Clima · 0.7.27 Luci · 0.7.31 Irrigazione · 0.7.35 Batterie · 0.7.37 Caldaia · 0.7.42 Tapparelle · 0.7.46 Piante · 0.7.54 Natale |
| Energia e ambiente | 0.7.26 Energia · 0.7.41 Meteo · 0.7.43 Aria · 0.7.44 Acqua e gas |
| Sicurezza | 0.7.20 Accessi · 0.7.23 Telecamere in diretta · 0.7.24 Flussi e gruppi |
| Svago | 0.7.28–0.7.29 Musica · 0.7.30 Media · 0.7.32 La mia squadra · 0.7.33 Formula 1 |
| Famiglia | 0.7.21 Faccende · 0.7.22 Bacheca · 0.7.38 Chat · 0.7.39 Liste · 0.7.40 Scadenze |
| Strumenti | 0.7.19 Controlla Home Assistant · 0.7.22-dev1 Automazioni come tasti · 0.7.36 Rete · 0.7.45 Assistente vocale |
| Su misura | 0.7.34 e 0.7.52 Salvaschermo e sfondi · 0.7.47–0.7.48 Autonomia (tutto regolabile dalla plancia) |
| Documentazione | 0.7.57 Guida illustrata (`COME_INSTALLARE.md`, `HOW_TO_INSTALL.md`), galleria nuova, README riordinato |

Versioni correttive uscite in mezzo: 0.7.29-dev1/dev2 (avvisi pioggia e aggiornamento), 0.7.34-dev1 (grafica leggera per tablet Android e Fully Kiosk),
0.7.37-dev1/dev2 (avvisi «elettrodomestico finito» falsi, soglie scelte dall'utente), 0.7.47-dev1 (Marketplace di Home Assistant 2026.11 al posto di HACS).

## 2. Cosa è rimasto sui rami `wip-*`
**Niente.** Sul repository c'è solo `main` e nessuna anteprima è rimasta indietro (anche il ramo `wip-0.7.53-dev` previsto dalla scheda della 3D non è servito).

## 3. Cosa resta da sistemare o decidere
**Fatto con la 0.7.65**
- ✅ **Luci come scheda oggetto**: pressione lunga (o ⋯) apre la scheda grande con la lampada disegnata del colore e della luminosità veri (quattro forme dall'icona: sospensione, lampada, striscia LED, lanterna), il cerchio della luminosità, bianco, colori, effetti e luci del gruppo. Con «Pannelli di prima» resta il foglio di prima; nella Home automatica le luci non entrano negli «Oggetti in primo piano» (si scelgono con ⚙️), così la Home di chi c'è già non cambia.
- ✅ Dubbi chiariti, codice e CHANGELOG allineati:
  - 0.7.36 Rete: il codice riconosceva già l'integrazione `sky_hub` e i nomi «Sky Hub»; ora anche il nome «Sky WiFi» (il modem di Sky Italia). CHANGELOG: «Sky Hub» aggiunto alla 0.7.36.
  - 0.7.37 Caldaia: Beretta e Riello erano già riconosciute (integrazione e nome); aggiunte al CHANGELOG della 0.7.37.
  - 0.7.49: La mia squadra e Media hanno già il loro «richiede» (compaiono in «Cosa puoi aggiungere», con «Scegli un sensore o un calendario» e «Una TV che non ho riconosciuto»); aggiunte al CHANGELOG della 0.7.49.
  - 0.7.52: «La tua immagine» ha la sfocatura (0–30 px) e il velo del colore del tema (0–80%), che scurisce nel tema scuro e schiarisce nel chiaro. La descrizione diceva «sfocata e scurita»: ora «sfocata e con un velo». Il CHANGELOG era giusto.
  - 0.7.53: in ✏️ della Mappa «＋» aggiunge qualsiasi dispositivo, telecamere e sensori compresi, e si trascinano anche nel 3D; aggiunto al CHANGELOG della 0.7.53.
- ✅ Pulizie della documentazione: nella tabella della ROADMAP ci sono tutte le correttive (0.7.29-dev1/dev2, 0.7.34-dev1, 0.7.37-dev1/dev2, 0.7.47-dev1) e la riga 0.7.55 dice lavatrice, asciugatrice e lavastoviglie; la scheda 0.7.18 dice «Prima: 0.7.11-dev», la 0.7.22 «l'evento della 0.7.21», la scheda in standby «Accessi della 0.7.20»; tolto dalla radice del repository `aut.json`, un file di prova finito per sbaglio nella 0.7.46.

**Consigliato, non blocca**
- **Prova su un Home Assistant vero** dei percorsi della guida (Marketplace, interruttore Pre-release): i disegni della guida seguono il README, ma il Marketplace della 2026.11 va confrontato una volta con le schermate reali e, se serve, ritoccato. Dalla sessione programmata non si può fare (niente Home Assistant vero).

**Da decidere con Giovanni (dopo la 0.8.0)**
- Calendario settimanale dei programmi dell'Irrigazione (in AUTONOMIA.md come «da decidere»).
- **In auto: CarPlay e Android Auto**, in standby (`standby/in-auto-carplay.md`): si farà con l'app 'Nduja dopo la 0.8.0.
- App per iPhone/iPad (`docs/app/PIANO.md`): Apple Developer Program, permesso CarPlay, nome dell'app, versione Plus e aspetti fiscali sono tutti aperti. Il piano dice prima «repository privato» e poi «pubblico» (parte «open core»): da chiarire.

## 4. Per pubblicare la 0.8.0
1. Versione `0.8.0` in `const.py` e `manifest.json` (senza `-dev`: il workflow crea una release normale, che arriva a tutti).
2. CHANGELOG: una sezione `## 0.8.0` che riassume le anteprime (la tabella sopra è una buona traccia); togliere dal README la riga sulle anteprime `-dev` se non serve più.
3. ROADMAP: «0.8.0 ✅ pubblicata».
4. Dopo l'uscita, chi ha la 0.7.10.x riceve l'aggiornamento e deve **riavviare Home Assistant** (elenco nella sezione 5): il testo pronto, con il riavvio in grande, è in `docs/sviluppo/0.8.0-note.md`.

## 5. Controllo finale della 0.7.65 (27 novembre 2026)

### B) Giro completo di prova
- **Tutte le 37 pagine** di `PAGES` (comprese Benvenuto e Natale) × tema scuro e chiaro × italiano e inglese × 390, 800, 1340 e 1920 px = **592 combinazioni**: nessun errore JavaScript, nessun errore in console, nessuna pagina più larga dello schermo. L'unica richiesta che esce dalla plancia è la foto dell'auto cercata su Wikipedia (pagina Auto, già prima).
- **Lingua**: nei testi delle pagine in inglese non restano parole italiane della plancia, e viceversa; restano solo i nomi e i dati inventati del finto Home Assistant (es. «Lista della spesa», «sweeping and mopping»). Trovato e corretto: nella Musica un lettore non raggiungibile mostrava «unavailable» anche in italiano.
- **Grafica**: guardate le schermate di tutte le pagine (tablet verticale, telefono in tema chiaro, PC in tema chiaro inglese): complete e leggere. Trovato e corretto: l'ordine del menu cambiava da un'apertura all'altra per quattro coppie di pagine con lo stesso posto (Acqua e gas / Meteo, Musica / Auto, Alexa / Media, Chat / La mia squadra).
- **Procedura guidata da zero**: Automatica (riepilogo → «Va bene, entra») e Manuale (tutti i passi con «Avanti» fino a «Salva») a 390 e 1340 px: finiscono nella Home con le scelte salvate, senza errori.
- **Utente non amministratore**: 35 pagine visibili, ✏️ Modifica solo nel Colpo d'occhio (che ognuno si fa a modo suo), Impostazioni ridotte, nessun errore.
- **Salvaschermo**: orologio, cielo, casa, notte, foto e automatico (fotovoltaico) con «▶ Prova»: nessun errore. **Avvisi** della Home e foglio «📱 Avvisi sul telefono»: nessun errore.
- Prove già nel repository ancora giuste: `tools/mock/automazioni.mjs` 58 su 58.

### Velocità con tante entità
Finto Home Assistant con **3.462 entità** (`mockTante=3000` con il nuovo `mockTanteMix`: sensori di ogni tipo, molti «diagnostici», porte, finestre, movimento, prese, luci, tapparelle, aggiornamenti e tracker, divisi nelle stanze e su 500 dispositivi), **CPU rallentata 6×** (Chromium), tablet orizzontale 1340 px.
Tempo di un **ridisegno vero** (menu, pillole in alto e pagina, come lo fa `render()`), in secondi: dopo un cambio di stato (quello che succede di continuo) e dopo un cambio delle entità, del registro o delle scelte (raro: una volta e basta).
Misurato con `tools/mock/velocita.mjs` (tempo tra due fotogrammi meno quello di un fotogramma vuoto); «0.7.64» è lo stesso giro, con lo stesso finto Home Assistant, sul codice di prima.

| Pagina | 0.7.64 cambio di stato | **0.7.65 cambio di stato** | 0.7.64 entità cambiate | 0.7.65 entità cambiate |
|---|---|---|---|---|
| home | 3,20 | **0,39** | 6,04 | 0,55 |
| meteo | 8,70 | **0,36** | 5,52 | 0,66 |
| tapparelle | 26,56 | **0,33** | 27,93 | 0,41 |
| mappa | 1,85 | **0,29** | 4,99 | 0,49 |
| natale | 1,99 | **0,24** | 2,27 | 0,55 |
| calendario | 1,88 | **0,23** | 2,27 | 0,41 |
| automazioni | 2,03 | **0,20** | 4,50 | 0,39 |
| luci | 1,81 | **0,20** | 3,60 | 0,38 |
| sicurezza | 3,40 | **0,20** | 4,06 | 0,54 |
| energia | 1,96 | **0,19** | 4,97 | 0,69 |
| aria | 1,91 | **0,18** | 3,87 | 0,40 |
| acqua | 1,99 | **0,18** | 4,45 | 0,54 |
| liste | 2,81 | **0,17** | 2,49 | 0,34 |
| aggiornamenti | 2,03 | **0,16** | 2,69 | 0,30 |
| scadenze | 2,58 | **0,16** | 2,02 | 0,30 |
| rete | 2,75 | **0,16** | 5,00 | 0,33 |
| formula1 | 1,90 | **0,14** | 3,89 | 0,30 |
| impostazioni | 4,06 | **0,14** | 7,57 | 0,33 |
| clima | 2,82 | **0,14** | 9,78 | 0,47 |
| dispositivi | 2,46 | **0,13** | 6,30 | 0,40 |
| irrigazione | 1,39 | **0,13** | 3,83 | 0,50 |
| alexa | 2,61 | **0,13** | 2,27 | 0,31 |
| colpo | 5,47 | **0,12** | 4,13 | 0,38 |
| squadra | 1,86 | **0,11** | 2,36 | 0,44 |
| caldaia | 2,04 | **0,11** | 2,82 | 0,33 |
| benvenuto | 2,59 | **0,10** | 2,31 | 0,26 |
| piante | 2,94 | **0,10** | 2,53 | 0,28 |
| musica | 1,62 | **0,10** | 2,08 | 0,40 |
| auto | 1,94 | **0,10** | 4,20 | 0,27 |
| elettrodomestici | 0,72 | **0,10** | 1,59 | 0,33 |
| batterie | 2,15 | **0,10** | 2,31 | 0,39 |
| media | 2,67 | **0,10** | 7,40 | 0,23 |
| chat | 3,57 | **0,09** | 2,71 | 0,39 |
| telecamere | 1,98 | **0,08** | 6,22 | 0,30 |
| bacheca | 3,70 | **0,08** | 4,57 | 0,25 |
| robot | 2,77 | **0,08** | 2,32 | 0,26 |
| faccende | 2,67 | **0,08** | 2,27 | 0,30 |

Massimo dopo un cambio di stato: **0,39 s** (home); prima 26,56 s (tapparelle). Dopo un cambio delle entità il massimo è 0,69 s (energia), una volta sola.
Cosa costava: il menu chiedeva a ogni pagina se mostrarsi e il suo pallino, e diverse pagine ripassavano **tutte le entità di casa per ogni sensore o zona** (umidità e temperatura delle stanze in Home, Aria e core, sensori del Meteo, tapparelle e finestre, irrigazione, piante, rete, novità in casa, batterie, Formula 1, Squadra, Caldaia), oppure contavano `Object.keys(S)` a ogni chiamata.
Ora usano gli indici di `core.js` (`idsDi`, `idsDispositivo`, `idsArea`, `tutteLeEntita`) e `memoGen`/`memoVer`; tornando sulla finestra le scelte si rileggono ma, se non sono cambiate, non si rifà niente.
Controllo: l'HTML di tutte le 37 pagine è identico a quello della 0.7.64 (salvo l'ora del sole nella scena del Meteo e il logo di riserva della Squadra, che dipendono da quando si fa la foto).

### C) Aggiornamento dalla 0.7.10.x
Simulato l'utente della **0.7.10.4** con un `LAYOUT` di allora (modalità automatica con esclusioni, stanza nascosta, ordine e nomi delle stanze, nomi e stanze dei dispositivi, sensori scelti, meteo, una pagina spenta, pagina personalizzata «Sera», mappa 2D, ordine e schede nascoste della Home, scheda libera «Preferiti», scelte per utente, avvisi sul telefono, Momenti, ordine delle telecamere, robot, elettrodomestici), a 1340 e 390 px:
- **senza riavvio** di Home Assistant (Python della 0.7.10.4: `casa_*`, `chat_*`, `copie_*`, `pausa` e il servizio `leggi_casa` non esistono; il finto Home Assistant lo simula con `mockNoCasa`, ora anche per pausa e copie) e **dopo il riavvio**: la plancia parte senza errori su tutte le pagine, tiene tutte le scelte (pagina «Sera» nel menu, Lavanderia nascosta, «Giardino», scheda «Preferiti», Momento «Esco», Robot spento) e **non riscrive il `LAYOUT` da sola** (nessuna chiave cambiata o aggiunta).
- **Cosa chiede il riavvio di Home Assistant** (finché non si riavvia la pagina dice «riavvia Home Assistant» e non salva; il resto funziona):
  - Faccende, Bacheca, Liste (reparti ricordati e suggerimenti), Colpo d'occhio (la vista salvata), Automazioni (preferite e nascoste) e Irrigazione (timer): i dati della casa (`casa_get`, `casa_save`, `casa_subscribe`, 0.7.21);
  - pausa delle Automazioni e dell'Irrigazione (`pausa`, 0.7.22-dev1);
  - Chat (`chat_*`, 0.7.38);
  - Piante: dati e promemoria sul telefono (servizio `nduja_dashboard.leggi_casa`, 0.7.46);
  - Copie di sicurezza (`copie_*`, 0.7.63; la copia «prima dell'aggiornamento» la fa Home Assistant all'avvio).
  - Anche i file della plancia arrivano «puliti» solo dopo il riavvio: l'indirizzo dei file contiene la versione e l'impronta calcolate all'avvio di Home Assistant, quindi prima del riavvio il browser può tenere in memoria pezzi della versione vecchia.
- Testo per le note della 0.8.0, con il riavvio in grande: `docs/sviluppo/0.8.0-note.md`.

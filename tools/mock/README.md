# Finto Home Assistant per provare la plancia

`host.html` simula Home Assistant (stati, aree, piani, servizi, salvataggio delle scelte in `localStorage`)
e carica la plancia vera in un iframe. Serve per provare le modifiche senza un Home Assistant.

```bash
python3 -m http.server 8765 &          # dalla radice del repo
npm i --no-save playwright-core        # una volta
node tools/mock/shot.mjs home 1280 1100 home.png
LAYOUT='{"configured":false}' node tools/mock/shot.mjs benvenuto 390 844 tel.png
```
Gli errori JavaScript della pagina compaiono come `PAGEERR`.

**Telecamere** (`mockCam` in `LS`): `webrtc` (predefinito: diretta vera via WebRTC dentro il browser, con una scena disegnata),
`webrtc_ko` (WebRTC rifiutato, poi HLS), `hls`, `mjpeg`, `foto`. `window.mockCamLog` conta le dirette WebRTC aperte e chiuse.
Con il semplice `http.server` gli indirizzi `/mockhls/…` e `/api/camera_proxy_stream/…` rispondono 404: va bene per provare
il passaggio al metodo successivo; per vedere HLS e MJPEG veri serve un server di prova che li fornisca.
```bash
LS='{"mockCam":"webrtc_ko"}' node tools/mock/shot.mjs telecamere 1280 900 cam.png '[data-act="camLive"]'
```

**Flussi delle telecamere** (0.7.24): nel finto Home Assistant ci sono coppie da unire da sole — `cortile_hd`/`cortile_sd` (stesso nome),
`giardino_clear`/`giardino_fluent` (Reolink), `campanello` + `campanello_video_sub` (stesso dispositivo) — e `camera.cantina`, nascosta in
Home Assistant (compare solo in ＋ Aggiungi). Le immagini `cam-hd.svg` e `cam-sd.svg` servono a vedere quale flusso usa l'anteprima.

**Clima animato** (0.7.25): `climate.soggiorno` raffresca con la ventola alta, `climate.cucina` scalda con la ventola bassa, `climate.termostato_corridoio`
scalda, `climate.radiatore_lavanderia` è a riposo (`hvac_action: idle`), `climate.deumidificatore_lavanderia` deumidifica (ventola «2» di 3) e
`climate.camera_ospiti` è spento e senza stanza. Per provare «Le mie immagini» vanno bene `/tools/mock/cam-hd.svg` e `/tools/mock/cam-sd.svg`.

**Energia** (0.7.26): `sun.sun` segue l'ora vera (alba alle 7, tramonto alle 18). Con `mockEnt` in `LS` cambi o togli qualsiasi entità finta:
`{ "entity_id": ["stato", { attributi }] }` la cambia, `null` la toglie; negli attributi `"@+5h"` o `"@-30m"` diventano «adesso + 5 ore / − 30 minuti».
```bash
# notte serena, batteria che scarica
LS='{"mockEnt":"{\"sun.sun\":[\"below_horizon\",{\"elevation\":-30,\"rising\":false,\"next_rising\":\"@+8h\",\"next_setting\":\"@+19h\"}],\"weather.forecast_casa\":[\"clear-night\",{}],\"sensor.battery_power\":[\"380\"]}"}' node tools/mock/shot.mjs energia 1280 900 notte.png
```

**Musica** (0.7.28): `media_source/browse_media` ha «My media» (album Demo A e Demo B con le copertine `cover-a.svg` e `cover-b.svg`, una cartella di foto
da nascondere, un brano sciolto) e Radio Browser; i brani sono note semplici generate nel browser (WAV). `media_player.sonos_soggiorno` ha il suo elenco (Preferiti,
Libreria), `media_player.echo_cucina` è di `alexa_media` («Chiedi ad Alexa»), `media_player.casa_tutta` è un gruppo Google Cast. `play_media` e play/pausa cambiano lo stato finto.
```bash
node tools/mock/shot.mjs musica 1280 900 musica.png '.mu1tb >> nth=0|.mu1tb >> nth=0|.mu1lr >> nth=1'
```

**Luci** (0.7.27): i comandi `light.*` e `switch.*` (accendi, spegni, luminosità, bianco, colore, effetto) cambiano davvero lo stato finto, anche dei membri dei gruppi.
`light.soggiorno` è bianca regolabile, `light.led_tv_soggiorno` è a colori con gli effetti, `light.giardino` è un gruppo (vialetto e portico, in Esterno),
`switch.luce_cantina` e `switch.relay_1` si possono aggiungere come luci. Con `mockPiani` in `LS` le stanze sono divise in due piani.
```bash
LS='{"mockPiani":"1"}' node tools/mock/shot.mjs luci 1280 900 luci.png '[data-act="luDet"][data-id="light.led_tv_soggiorno"]'
```

**Music Assistant** (0.7.29): `media_player.ma_soggiorno` (suona, con la coda) e `media_player.ma_cucina` sono di `music_assistant`; `music_assistant.search` cerca in un piccolo
catalogo inventato (prova «demo» o «onde»), `get_queue`, `play_media` (anche `enqueue` e `radio_mode`) e `transfer_queue` cambiano lo stato finto. Con `mockNoMA` in `LS`
Music Assistant non c'è (compare la riga «installa Music Assistant»). I preferiti si provano mettendo `muPreferiti` in `mockLayout`.
```bash
LS='{"nduja_mu_dove":"media_player.ma_soggiorno"}' node tools/mock/shot.mjs musica 1280 900 ma.png '[data-act="mu1sp"]'
```

**Media** (0.7.30): `media_player.tv_soggiorno` è una Samsung accesa su Netflix con `remote.tv_soggiorno` (comandi `KEY_*`), `media_player.apple_tv_soggiorno` riproduce
con la copertina (`remote.apple_tv_soggiorno`), `media_player.google_tv_cucina` è di `androidtv_remote` (app con i link, `current_activity`), `media_player.lg_camera` è una LG webOS
spenta (`webostv.button`) e `remote.harmony_studio` è un Harmony senza lettore, con le attività. Accensione, sorgente, volume e attività cambiano lo stato finto; i comandi compaiono come `SVC`.
```bash
LS='{"nduja_md_tv":"media_player.tv_soggiorno"}' node tools/mock/shot.mjs media 1280 1000 media.png '[data-act="mdNum"]'
```

**Irrigazione** (0.7.31): `switch.rain_bird_sprinkler_1` (Prato davanti, irriga) e `_2` sono di `rainbird` (con `rainbird.start_irrigation`, il ritardo pioggia `number.rain_bird_controller_rain_delay` e il calendario
dei programmi), `valve.prato_dietro` è di `hydrawise` (sensore «in funzione», prossimo ciclo, tempo che manca; `hydrawise.start_watering`, `suspend`, `resume`), `valve.orto_gocciolatore` (Zigbee) e
`switch.zona_siepe` (Zigbee2MQTT) usano il timer della plancia; `valve.acqua_principale` e `switch.luce_zona_giorno` NON devono comparire. Con `mockPioggiaDomani` in `LS` domani piove (avviso «vuoi saltare l'irrigazione?»).
Le chiamate REST `/api/config/script|automation/config/…` vengono intercettate: lo script e l'automazione creati compaiono negli stati finti (`API` nella console).
```bash
LS='{"mockPioggiaDomani":"1"}' node tools/mock/shot.mjs irrigazione 1280 1100 irr.png
```

**La mia squadra** (0.7.32), squadre inventate: `sensor.real_borgo` è di Team Tracker (`teamtracker`) e gioca **in diretta** (2-1 al 67', `last_play` con gol e cartellini,
possesso e tiri; il logo punta a un file che non c'è, per provare lo stemma di riserva), `sensor.calciolive_all_mixed_sporting_lago` è di Calcio Live (5 risultati, la prossima tra due giorni,
una «TBD»), `sensor.calciolive_classifica_lega_demo` è la classifica. `calendar.partite_calcio_demo` («Partite Pro Valle») si usa da solo solo se non c'è altro: provalo togliendo gli altri con `mockEnt`.
`get_services` ha `notify.mobile_app_telefono_demo` per provare l'automazione «'Nduja · squadra». Per vedere l'animazione del gol cambia `team_score` con `mockStati` mentre la pagina è aperta.
```bash
LS='{"nduja_sq_sel":"sq:sporting lago"}' node tools/mock/shot.mjs squadra 1280 1100 squadra.png
```

**Formula 1** (0.7.33), campionato inventato con F1 Sensor (`sensor.f1_next_race`, classifiche, ultima gara, lista piloti; `platform: f1_sensor`): weekend del «Gran Premio di Valle Demo»
con le libere finite, le qualifiche tra circa due ore e la gara domani; il tracciato è `pista-demo.svg` (togli `circuit_outline_url` con `mockEnt` per vedere il circuito disegnato).
Con `mockF1Live` = `gara` (gara in corso con la Safety Car, ordine in pista, direzione gara) o `quali` (Q2 con bandiera gialla); con `mockF1Solo` = `cal` restano solo gli eventi di
`calendar.f1_season_calendar`. Pilota e team preferiti: `{"f1":{"pilota":{"code":"RIV","nome":"Rivera"},"team":{"id":"aurora","nome":"Aurora Racing"}}}` in `mockLayout`.
```bash
LS='{"mockF1Live":"gara"}' node tools/mock/shot.mjs formula1 1280 1500 f1.png
```

**Salvaschermo** (0.7.34): nei Media c'è la cartella «Salvaschermo» con quattro foto inventate (`foto-*.svg`, una verticale). Le scelte sono in `localStorage`
(`nduja_ssMin`, `nduja_ssStile` = `auto|orologio|cielo|casa|notte|foto`, `nduja_ssDir`, `nduja_ssFonte`, `nduja_ssCfg`…); «▶ Prova» lo apre subito. Con `ORA` l'ora resta ferma
(il sole finto la segue): utile per il cielo all'alba, al tramonto e di notte. Il meteo si cambia con `mockEnt`.
```bash
ORA="2026-10-30T17:45" LS='{"nduja_ssMin":"5","nduja_ssStile":"cielo"}' node tools/mock/shot.mjs impostazioni 1280 800 cielo.png '[data-act="ssProva"]'
LS='{"nduja_ssMin":"5","nduja_ssStile":"foto","nduja_ssDir":"media-source://media_source/local/Salvaschermo"}' node tools/mock/shot.mjs impostazioni 1280 800 foto.png '[data-act="ssProva"]'
```

**Batterie** (0.7.35): nove dispositivi con la pila (categoria «diagnostica» come in Home Assistant): `sensor.movimento_corridoio_battery` al 17%, `binary_sensor.fumo_cucina_battery_low` acceso (solo sì/no),
`sensor.telecomando_ikea_battery` con anche il sì/no dello stesso dispositivo (deve comparire una volta sola), `lock.serratura_ingresso` con `battery_level`, `sensor.allagamento_lavanderia_battery` muto da 12 giorni
e `sensor.valvola_bagno_battery` non raggiungibile. I telefoni, la Model 3 e `sensor.battery_soc` (batteria di casa) NON devono comparire. Le scelte stanno in `batterie` dentro `mockLayout`.
```bash
LS='{"mockLayout":"{\"configured\":true,\"batterie\":{\"d\":{\"dev_b_fumo_cucina\":{\"tipo\":\"CR2032\",\"qta\":2}}}}"}' node tools/mock/shot.mjs batterie 1280 1000 batterie.png
```

**Rete e server** (0.7.36): FRITZ!Box finto (`platform: fritz`) con connessione, IP pubblico `203.0.113.42` (intervallo di documentazione), velocità in kB/s e massimo della linea in kbit/s, riavvio, Wi-Fi ospiti «Ospiti Casa» e un aggiornamento; Speedtest.net, NAS Synology (due volumi), nodo Proxmox `pve` e una VM spenta, `switch.pc_studio` (Wake on LAN), System Monitor, stampante IPP con gli inchiostri e UPS NUT.
Cinque `device_tracker` del router; `config/entity_registry/list` dice che il «Tablet ospite» e un dispositivo disattivato sono nuovi di oggi. Con `mockNoInternet` la connessione è giù, con `mockUpsBatt` l'UPS va a batteria. «Prova adesso» porta valori nuovi dopo 3 secondi.
La password della rete ospiti (per il QR) si mette in `rete.ospiti.pwd` dentro `mockLayout`.
```bash
LS='{"mockLayout":"{\"configured\":true,\"rete\":{\"ospiti\":{\"pwd\":\"pane-vino-2026\"}}}"}' node tools/mock/shot.mjs rete 1280 1500 rete.png
LS='{"mockNoInternet":"1","mockUpsBatt":"1"}' node tools/mock/shot.mjs rete 1280 900 giu.png
```

**Caldaia** (0.7.37), dati inventati: una caldaia «Ariston» finta (`platform: ariston`) con fiamma, modulazione al 64%, mandata e ritorno, pressione 1,4 bar, esterna, modalità estate/inverno (`select`),
mandata impostata (`number`), un circuito `climate.caldaia_circuito` (deve uscire dalla pagina Clima), `climate.ariston_zona_1` che è un termostato vero (resta nel Clima, in Soggiorno), acqua calda `water_heater.ariston`
(comfort/eco/boost) e la pompa; il contatore del gas `sensor.contatore_gas` è nella configurazione Energia con 1,05 €/m³. Con `mockCaldaia` = `off` (ferma), `acs` (acqua calda in uso) o `otgw` (al posto della Ariston
un OpenTherm Gateway con i sensori «diagnostici»); `mockCaldaiaErr` porta un errore e la pressione bassa, `mockNoCaldaia` toglie la caldaia (in ✏️ del Clima compare «aggiungila a mano»), `mockNoGas` toglie il gas.
La manutenzione annotata sta in `caldaia.manut` dentro `mockLayout`.
```bash
LS='{"mockCaldaia":"acs"}' node tools/mock/shot.mjs caldaia 1280 1300 caldaia.png
LS='{"mockCaldaia":"otgw","mockCaldaiaErr":"1"}' node tools/mock/shot.mjs caldaia 1280 1300 errore.png
```

**Chat** (0.7.38): i membri sono le persone con `user_id` (Mario `u1`, Anna `u2`, Marco `u3`); i messaggi stanno in `mockChat` (stessa forma dello Store di `chat.py`), con `mockChatDemo` partono due conversazioni d'esempio (foto, posizione, spesa, non letti).
`mockChatArriva("famiglia", "u2", "Ciao!")` fa arrivare un messaggio, `mockChatLegge("famiglia", "u3")` lo fa leggere; `auth/sign_path` delle foto della chat risponde con `cam-hd.svg`; `todo.shopping_list` ha quattro voci. `mockNoCasa` = Home Assistant non riavviato, `mockNoPerson` = utente senza persona.
```bash
LS='{"mockChatDemo":"1"}' node tools/mock/shot.mjs chat 1280 900 chat.png
LS='{"mockChatDemo":"1"}' node tools/mock/shot.mjs chat 390 844 tel.png '[data-act="ktApri"][data-id="famiglia"]'
```

**Liste** (0.7.39), dati inventati: `todo.shopping_list` (Lista della spesa, `shopping_list`: aggiungi, togli, cambia, riordina, note), `todo.cose_da_fare` (Local To-do, tutte le funzioni, scadenze ieri, oggi alle 18, domani e tra 12 giorni)
e `todo.commissioni` (Google Tasks, solo il giorno della scadenza). I servizi `todo.*` e `todo/item/move` cambiano davvero le voci e `todo/item/subscribe` le manda in tempo reale; con `mockNoTodoSub` l'abbonamento non c'è e la pagina usa `todo/item/list`.
Reparti ricordati e suggerimenti stanno nella sezione `liste` di `mockCasa`; la lista aperta in `nduja_listaSel`, quella della Home in `nduja_listaHome`.
```bash
LS='{"nduja_listaSel":"todo.cose_da_fare"}' node tools/mock/shot.mjs liste 1280 1000 liste.png
LS='{"mockNoTodoSub":"1"}' node tools/mock/shot.mjs liste 390 844 tel.png '[data-act="lsRep"] >> nth=0'
```

**Scadenze** (0.7.40), dati inventati: `todo.scadenze` (Local To-do «Scadenze», tutte le funzioni) con bollette, revisione, dentista (con l'ora), condominio, Netflix, compleanno, bollo, carta d'identità, una garanzia senza data e una fatta;
categoria, ripetizione e importo sono nella descrizione come li scrive la plancia. `get_services` ha `notify.mobile_app_iphone_di_mario` e `_anna` (i telefoni di Mario e Anna) per provare 🔔: l'automazione creata compare come `API POST …/nduja_scadenze`.
Con `mockNoScadenze` la lista non c'è (prova di «Crea la lista Scadenze»: il flusso di Local To-do `/api/config/config_entries/flow` è finto e crea la lista); con anche `mockNoFlow` Home Assistant rifiuta e compaiono le istruzioni.
```bash
node tools/mock/shot.mjs scadenze 1280 1000 scadenze.png
LS='{"mockNoScadenze":"1"}' node tools/mock/shot.mjs scadenze 390 844 crea.png '[data-act="scCrea"]'
```

**Meteo** (0.7.41), dati inventati: `weather.forecast_casa` ha tutti gli attributi (vento con direzione e raffiche, pressione, punto di rugiada, UV, visibilità; la percepita manca, così si vede quella calcolata)
e risponde a `get_forecasts` con 48 ore (`hourly`) e 10 giorni (`daily`); `weather.f1_weather` non ha previsioni. Stazione Ecowitt finta in Esterno (`sensor.stazione_meteo_*`: temperatura, umidità, pioggia di oggi e della settimana,
intensità, vento, raffica, direzione, pressione), `binary_sensor.meteoalarm` con un'allerta arancione per vento e `camera.radar_pioggia` (RainViewer) con `radar-demo.svg`.
Con `mockAllerta` = `gialla`, `rossa` o `no`; `mockNoStazione` toglie la stazione (resta la sonda esterna della caldaia), `mockNoRadar` il radar. Il meteo guardato è in `nduja_meteoEnt`, 24/48 ore in `nduja_meteoOre`.
```bash
ORA="2026-10-30T15:20" node tools/mock/shot.mjs meteo 1280 2600 meteo.png
LS='{"mockAllerta":"rossa","mockNoRadar":"1"}' node tools/mock/shot.mjs meteo 390 844 tel.png '[data-act="mtCfg"]'
```

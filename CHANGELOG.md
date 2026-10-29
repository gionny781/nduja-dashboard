# Changelog

> 🇮🇹 'Nduja Dashboard è in **beta**: funziona, ma può cambiare e avere difetti. Segnalali nelle Issues.
> 🇬🇧 'Nduja Dashboard is in **beta**: it works, but it may change and have bugs. Please report them in Issues.

## 0.7.33-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **🏎️ Formula 1**, pagina nuova: compare da sola se in Home Assistant c'è **F1 Sensor** (HACS), un **calendario della Formula 1** («Gran Premio d'Italia - Qualifiche», «… - Gara») o **Team Tracker** con lo sport «racing». Altrimenti in ⚙️ Impostazioni → Personalizza → «Formula 1» (o con ✏️) scegli una fonte, con la spiegazione di cosa installare.
- 🇮🇹 **Prossimo Gran Premio**: nome, round, circuito e città, **conto alla rovescia** (ai secondi nell'ultima ora) alla prossima sessione, l'ora in pista e i giri; il **tracciato** è l'immagine dell'integrazione, e se manca un circuito astratto disegnato per 'Nduja. **Programma del weekend** con libere, qualifiche, sprint e gara nell'**ora di casa**, con quelle finite, quella in corso e la prossima.
- 🇮🇹 **Weekend in corso** (con i dati live di F1 Sensor): sessione e manche delle qualifiche, **bandiere** (verde, gialla, rossa, a scacchi) e **Safety Car / VSC** disegnate, giro, tempo che manca, giro veloce, **ordine in pista** con distacchi o tempi, pit stop e ritiri, i messaggi della **direzione gara**.
- 🇮🇹 **Classifiche piloti e costruttori** con i colori dei team, e **ultima gara** con il podio e tutti i risultati. Il **pilota e il team preferiti** (⭐, si scelgono con ✏️ o in Impostazioni, per tutta la casa) sono evidenziati ovunque.
- 🇮🇹 **Scheda «Formula 1» in Home**: la prossima sessione con il «tra quanto» e l'orario della gara, oppure la sessione in corso con bandiera, giro e primi tre.
- 🇮🇹 **📱 Avvisi sul telefono** (facoltativi): su richiesta la plancia crea in Home Assistant l'automazione **«'Nduja · Formula 1»** con l'etichetta «'Nduja», che avvisa **15 minuti prima** delle sessioni scelte («Tra 15 minuti partono le qualifiche»), anche a plancia chiusa.
- 🇬🇧 **🏎️ Formula 1**, a new page: shown by itself if Home Assistant has **F1 Sensor** (HACS), a **Formula 1 calendar** («Italian Grand Prix - Qualifying», «… - Race») or **Team Tracker** with the «racing» sport. Otherwise in ⚙️ Settings → Customize → «Formula 1» (or with ✏️) pick a source, with an explanation of what to install.
- 🇬🇧 **Next Grand Prix**: name, round, circuit and city, a **countdown** (to the second in the last hour) to the next session, the track time and laps; the **circuit** is the integration's image, or else an abstract circuit drawn for 'Nduja. **Weekend schedule** with practice, qualifying, sprint and race in your **home time zone**, showing the ones done, the live one and the next.
- 🇬🇧 **Live weekend** (with F1 Sensor's live data): session and qualifying part, drawn **flags** (green, yellow, red, chequered) and **Safety Car / VSC**, lap, time left, fastest lap, **running order** with gaps or times, pit stops and retirements, **race control** messages.
- 🇬🇧 **Drivers' and constructors' standings** with team colours, and the **last race** with its podium and all results. Your **favourite driver and team** (⭐, chosen with ✏️ or in Settings, for the whole home) are highlighted everywhere.
- 🇬🇧 **«Formula 1» card on Home**: the next session with the time left and the race time, or the live session with flag, lap and top three.
- 🇬🇧 **📱 Phone alerts** (optional): on request the dashboard creates the **«'Nduja · Formula 1»** automation in Home Assistant, with the «'Nduja» label, which alerts **15 minutes before** the chosen sessions («Qualifying starts in 15 minutes»), even with the dashboard closed.

## 0.7.32-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **⚽ La mia squadra**, pagina nuova: compare da sola se in Home Assistant c'è **Team Tracker** o **Calcio Live** (HACS); altrimenti in ⚙️ Impostazioni → Personalizza → «La mia squadra» (o con ✏️) scegli un loro sensore oppure un **calendario con le partite** («Inter - Milan», «Serie A: Inter - Milan», «Inter 2-1 Milan»). Si seguono **più squadre**: le scegli in alto. Lo stesso club da Team Tracker e da Calcio Live diventa una squadra sola.
- 🇮🇹 **Prossima partita**: le due squadre, **conto alla rovescia** (ai secondi nell'ultima ora), giorno e ora (o «orario da definire»), competizione, stadio e canale TV quando ci sono.
- 🇮🇹 **Partita in corso**: risultato grande, minuto (o «Intervallo»), gol, autogol, rigori e cartellini con il minuto e il giocatore, possesso palla e tiri in porta se l'integrazione li dà; quando qualcuno segna parte una piccola **animazione** disegnata per 'Nduja (la palla in rete e «GOL!»). Con «Riduci movimento» tutto resta fermo.
- 🇮🇹 **Ultimi risultati** con V/N/P e **classifica** (da Calcio Live) con la tua squadra evidenziata.
- 🇮🇹 **Loghi** solo dall'integrazione, niente immagini nel pacchetto: se mancano, uno **stemma** disegnato con la sigla e i colori; con ✏️ cambi nome, sigla e colori o togli la squadra.
- 🇮🇹 **Scheda «La mia squadra» in Home**: prossima partita con il «tra quanto», oppure il risultato in diretta (con «GOL!» quando si segna).
- 🇮🇹 **📱 Avvisi sul telefono** (facoltativi): su richiesta la plancia crea in Home Assistant l'automazione **«'Nduja · squadra»** con l'etichetta «'Nduja», che avvisa a ogni **gol** e a **fine partita** con il risultato (Team Tracker o Calcio Live), anche a plancia chiusa.
- 🇬🇧 **⚽ My team**, a new page: shown by itself if Home Assistant has **Team Tracker** or **Calcio Live** (HACS); otherwise in ⚙️ Settings → Customize → «My team» (or with ✏️) pick one of their sensors or a **calendar with the matches** («Inter - Milan», «Serie A: Inter - Milan», «Inter 2-1 Milan»). You can follow **more than one team** and switch at the top. The same club from Team Tracker and Calcio Live becomes one team.
- 🇬🇧 **Next match**: both teams, a **countdown** (to the second in the last hour), day and time (or «time to be confirmed»), competition, stadium and TV channel when available.
- 🇬🇧 **Live match**: big score, minute (or «Half-time»), goals, own goals, penalties and cards with minute and player, possession and shots on target when the integration provides them; when someone scores a small **animation** drawn for 'Nduja plays (the ball in the net and «GOAL!»). With «Reduce motion» nothing moves.
- 🇬🇧 **Recent results** with W/D/L and the **table** (from Calcio Live) with your team highlighted.
- 🇬🇧 **Logos** only from the integration, no images in the package: when missing, a drawn **badge** with initials and colours; with ✏️ change name, initials and colours or remove the team.
- 🇬🇧 **«My team» card on Home**: next match with the time left, or the live score (with «GOAL!» when someone scores).
- 🇬🇧 **📱 Phone alerts** (optional): on request the dashboard creates the **«'Nduja · team»** automation in Home Assistant, with the «'Nduja» label, which alerts at every **goal** and at **full time** with the score (Team Tracker or Calcio Live), even with the dashboard closed.

## 0.7.31-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **💧 Irrigazione**, pagina nuova: compare solo se in Home Assistant c'è qualcosa per irrigare — valvole dell'acqua, switch con nomi come «irrigazione», «zona», «sprinkler», «gocciolatore», oppure **Rain Bird**, **Hydrawise**, **Rachio**, **b-hyve**, **OpenSprinkler**, **Gardena**, valvole Tuya/Zigbee. Valvole principali dell'acqua, pompe, programmi e luci «zona giorno» restano fuori. Con ✏️ Modifica aggiungi altri switch, valvole o script, cambi nome e aspetto o togli una zona.
- 🇮🇹 **Una tessera per zona**: il prato con l'irrigatore che si alza e spruzza, o l'aiuola con i gocciolatori, disegnati per 'Nduja; il **terreno si scurisce** mentre si bagna e poi si asciuga. Stato (spenta, in irrigazione con il tempo che manca, programmata), avvio per **5, 10, 15 o 30 minuti** o una durata tua, e stop.
- 🇮🇹 **Durata giusta**: con il servizio dell'integrazione se c'è (Rain Bird, Hydrawise, Rachio, b-hyve, OpenSprinkler). Per le altre zone la plancia crea in Home Assistant lo script **«'Nduja · irrigazione»**, che chiude la zona dopo i minuti scelti anche a plancia chiusa, e un'automazione di sicurezza che chiude quelle zone se Home Assistant si riavvia mentre irrigano. Li crea un amministratore con un tocco (o da soli al primo avvio), con l'etichetta «'Nduja».
- 🇮🇹 **Programmi e meteo**: prossima irrigazione (dalle integrazioni e dai loro calendari), sensori di umidità del terreno e pioggia dei prossimi giorni. Se domani piove: **«Domani piove: vuoi saltare l'irrigazione?»**, e con un tocco metto in pausa i programmi fino a domani sera — ritardo pioggia (Rain Bird, Rachio, b-hyve, OpenSprinkler), sospensione di Hydrawise, automazioni dell'irrigazione (Home Assistant le riaccende da solo) e switch scelti da te. «Riprendi» toglie la pausa.
- 🇮🇹 **Scheda «Irrigazione» in Home** con le zone attive (tempo che manca e stop) e la prossima partenza. Le zone escono dalla pagina Prese.
- 🇬🇧 **💧 Irrigation**, a new page: shown only if Home Assistant has something to water with — water valves, switches named like «irrigation», «zone», «sprinkler», «drip», or **Rain Bird**, **Hydrawise**, **Rachio**, **b-hyve**, **OpenSprinkler**, **Gardena**, Tuya/Zigbee valves. Main water valves, pumps, schedules and «day zone» lights stay out. With ✏️ Edit add other switches, valves or scripts, change name and look, or remove a zone.
- 🇬🇧 **A card per zone**: a lawn with a pop-up sprinkler that sprays, or a flower bed with drippers, drawn for 'Nduja; the **soil darkens** as it gets wet and then dries. Status (off, watering with time left, scheduled), start for **5, 10, 15 or 30 minutes** or your own time, and stop.
- 🇬🇧 **Right duration**: with the integration's own service when there is one (Rain Bird, Hydrawise, Rachio, b-hyve, OpenSprinkler). For other zones the dashboard creates the **«'Nduja · irrigation»** script in Home Assistant, which closes the zone after the chosen minutes even with the dashboard closed, plus a safety automation that closes those zones if Home Assistant restarts while they water. An administrator creates them with one tap (or automatically on the first start), with the «'Nduja» label.
- 🇬🇧 **Schedules and weather**: next watering (from the integrations and their calendars), soil moisture sensors and rain for the next days. If it will rain tomorrow: **«Rain tomorrow: skip watering?»**, and one tap pauses the schedules until tomorrow night — rain delay (Rain Bird, Rachio, b-hyve, OpenSprinkler), Hydrawise suspension, irrigation automations (Home Assistant turns them back on by itself) and switches you pick. «Resume» ends the pause.
- 🇬🇧 **«Irrigation» card on Home** with the zones that are watering (time left and stop) and the next start. Zones leave the Plugs page.

## 0.7.30-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **📺 Media**, pagina nuova: compare solo se hai TV, decoder, Apple TV, Chromecast, Fire TV, console o telecomandi (`remote.*`). Se ne hai più di uno li scegli in alto; la scelta resta su questo dispositivo.
- 🇮🇹 **Scheda della TV**: uno schermo disegnato che mostra quello che è in onda (l'immagine, oppure i colori dell'app aperta) e si accende con un piccolo effetto; accensione e spegnimento, volume e muto, la **sorgente** (HDMI, TV…), play/pausa se c'è qualcosa in riproduzione.
- 🇮🇹 **🎛️ Telecomando virtuale**: croce direzionale e OK, indietro, home, menu, volume, canali e i **numeri** in un pannello a scomparsa. Manda i comandi giusti per **Android/Google TV**, **Apple TV**, **Samsung**, **LG webOS**, **Sony Bravia**, **Philips** e **Fire TV** (ADB); volume e muto passano dal lettore quando basta. Mostra **solo i tasti che funzionano**; con ✏️ Modifica tocchi un tasto e gli dai un **comando tuo** (anche uno script), con «Prova» e «Torna a quello di partenza». Sul PC vanno anche le frecce, Invio e ⌫.
- 🇮🇹 **App di streaming**: pulsanti grandi con un logo di testo e colori disegnati per 'Nduja (niente loghi ufficiali) per Netflix, Prime Video, Disney+, YouTube, RaiPlay, Mediaset Infinity, DAZN, Spotify e altre; l'elenco viene dalla TV, l'app aperta si riconosce. Su Android/Google TV si aprono con il loro link. I telecomandi Harmony mostrano le loro **attività**.
- 🇮🇹 **Scheda «Media» in Home** per la TV accesa: cosa c'è, volume − +, spegni, e un tocco porta alla pagina.
- 🇮🇹 **Musica e Media separate**: le TV passano nella pagina Media e in **Musica** restano le casse (la pagina si chiama «Musica»). Nomi, stanze e scelte restano come prima; se spegni la pagina Media, le TV tornano in Musica.
- 🇬🇧 **📺 Media**, a new page: shown only if you have TVs, set-top boxes, Apple TV, Chromecast, Fire TV, consoles or remotes (`remote.*`). If you have more than one, pick it at the top; the choice stays on this device.
- 🇬🇧 **TV card**: a drawn screen that shows what's on (the picture, or the colours of the open app) and switches on with a small effect; power, volume and mute, the **source** (HDMI, TV…), play/pause when something is playing.
- 🇬🇧 **🎛️ Virtual remote**: D-pad and OK, back, home, menu, volume, channels and the **numbers** in a fold-out panel. It sends the right commands for **Android/Google TV**, **Apple TV**, **Samsung**, **LG webOS**, **Sony Bravia**, **Philips** and **Fire TV** (ADB); volume and mute go through the player when that's enough. Only **keys that work** are shown; with ✏️ Edit tap a key to give it **your own command** (a script too), with «Try» and «Back to default». On a PC the arrows, Enter and ⌫ work too.
- 🇬🇧 **Streaming apps**: big buttons with a text logo and colours drawn for 'Nduja (no official logos) for Netflix, Prime Video, Disney+, YouTube, RaiPlay, Mediaset Infinity, DAZN, Spotify and more; the list comes from the TV and the open app is highlighted. On Android/Google TV they open with their link. Harmony remotes show their **activities**.
- 🇬🇧 **«Media» card on Home** for the TV that's on: what's on, volume − +, power off, and a tap takes you to the page.
- 🇬🇧 **Music and Media apart**: TVs move to the Media page and **Music** keeps the speakers (the page is now called «Music»). Names, rooms and choices stay as they were; if you turn the Media page off, TVs go back to Music.

## 0.7.29-dev2
- 🇮🇹 **Avvisi sul telefono**: l'avviso «nuovo aggiornamento disponibile» non veniva aggiunto all'automazione (gli aggiornamenti erano scartati). Riapri 📱 e premi «Salva».
- 🇬🇧 **Phone alerts**: the «new update available» alert was not added to the automation (updates were skipped). Reopen 📱 and press «Save».

## 0.7.29-dev1
- 🇮🇹 **Avvisi sul telefono** (Home → Avvisi → 📱): due avvisi nuovi, **pioggia che inizia con finestre aperte** e **nuovo aggiornamento disponibile**. Come gli altri si accendono e spengono uno per uno; per chi li ha già attivi basta riaprire 📱 e premere «Salva».
- 🇬🇧 **Phone alerts** (Home → Alerts → 📱): two new alerts, **rain starting with windows open** and **new update available**. Like the others, each can be turned on or off; if you already use them, reopen 📱 and press «Save».

## 0.7.29-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **🔎 Music Assistant**: se è installata, nella pagina Musica cerchi **brani, artisti, album, playlist e radio** (tutto insieme o un tipo alla volta) e li fai partire con un tocco sulla sua cassa. Con **⋯** scegli «Dopo questo», «Aggiungi alla coda» o **📻 Radio da qui** (musica simile senza fine, dove il servizio lo permette). Se «Dove ascolti» non è una cassa di Music Assistant, scegli su quale suonare.
- 🇮🇹 **Coda visibile**: sotto il lettore di una cassa di Music Assistant vedi il brano di adesso, quello dopo e quanti brani ci sono in coda.
- 🇮🇹 Senza Music Assistant, una riga discreta (solo per gli amministratori) spiega che installandola puoi cercare e ascoltare da Spotify, Apple Music, radio…, con il link alla guida ufficiale.
- 🇮🇹 **⇄ Sposta su…**: passa la musica da una cassa all'altra, anche da e verso questo dispositivo. Tra casse di Music Assistant passa **tutta la coda**; dalla plancia a una cassa che accetta la coda passa anche i brani dopo; negli altri casi riparte lo stesso brano o la stessa radio sulla nuova cassa, quando si può, e la cassa di prima si mette in pausa. «Dove ascolti» segue la musica.
- 🇮🇹 **⭐ Preferiti**: con ☆ su una playlist o una radio (in «Sfoglia» o nella ricerca di Music Assistant) la metti tra i preferiti, in cima alla pagina Musica. Valgono per **tutta la casa**; suonano dove ascolti oppure, se lì non si può, dove si può. Con ✏️ Modifica li togli.
- 🇬🇧 **🔎 Music Assistant**: if it's installed, on the Music page you search **songs, artists, albums, playlists and radio** (all together or one kind at a time) and start them with a tap on its speaker. With **⋯** choose «Play next», «Add to queue» or **📻 Radio from here** (endless similar music, where the service allows it). If «Where to listen» isn't a Music Assistant speaker, choose which one plays.
- 🇬🇧 **Queue you can see**: under the player of a Music Assistant speaker you see the current track, the next one and how many tracks are queued.
- 🇬🇧 Without Music Assistant, a discreet line (admins only) explains that installing it lets you search and listen from Spotify, Apple Music, radio…, with a link to the official guide.
- 🇬🇧 **⇄ Move to…**: moves the music from one speaker to another, also from and to this device. Between Music Assistant speakers the **whole queue** moves; from the dashboard to a speaker that accepts a queue the following tracks go too; otherwise the same track or station starts again on the new speaker, when possible, and the previous one pauses. «Where to listen» follows the music.
- 🇬🇧 **⭐ Favourites**: with ☆ on a playlist or a station (in «Browse» or in the Music Assistant search) you add it to the favourites at the top of the Music page. They apply to the **whole home**; they play where you listen or, if that's not possible there, where they can. Remove them with ✏️ Edit.

## 0.7.28-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **🎧 Musica: dove ascolti**. In cima alla pagina Musica scegli dove suona la musica: **📱 Questo dispositivo** (il telefono, il tablet o il PC che stai usando), una delle **casse** di Home Assistant (Alexa, Google/Nest, Sonos…) o un **gruppo** (👥). La scelta resta su questo dispositivo; quello che sta suonando si riconosce dalle barrette verdi.
- 🇮🇹 **Ascolto sulla plancia**: la musica e le radio di Home Assistant (la cartella «media», Radio Browser…) suonano direttamente qui, con copertina (o un disco disegnato per 'Nduja che gira), play/pausa, avanti/indietro, barra di avanzamento, volume, «Riproduci tutto», «Casuale» e la coda «Dopo». Dove il browser lo permette funzionano anche i comandi sulla schermata di blocco e sulle cuffie.
- 🇮🇹 **Mini lettore in basso**: resta visibile quando cambi pagina (sulla pagina Musica compare quando il lettore grande esce dallo schermo); un tocco riporta alla Musica, ✕ ferma. La scheda **In riproduzione** della Home mostra anche quello che suona qui.
- 🇮🇹 **📂 Sfoglia** con le copertine: le cartelle e gli album sono tessere, dentro un album o una playlist i brani sono un elenco. Per le casse che hanno un loro elenco (Sonos, Google Cast…) sfogli quello e la musica parte sulla cassa; per le altre uso i media di Home Assistant. Mostro solo quello che si ascolta (niente foto, video o telecamere).
- 🇮🇹 **🗣️ Chiedi ad Alexa**: per gli Echo (Alexa Media Player) scrivi artista, brano, playlist o radio e scegli dove cercarlo (Amazon Music, Spotify, Apple Music, Deezer, TuneIn, iHeartRadio) oppure «A voce» per dire ad Alexa quello che vuoi. Ogni cassa mostra solo i comandi che supporta davvero.
- 🇮🇹 Corretto: nel tema chiaro le copertine delle casse e il tasto ▶ grande non si vedevano; i menu a tendina (es. «Sorgente») a volte mostravano le voci di un'altra cassa.
- 🇬🇧 **🎧 Music: where to listen**. At the top of the Music page choose where the music plays: **📱 This device** (the phone, tablet or PC you're using), one of Home Assistant's **speakers** (Alexa, Google/Nest, Sonos…) or a **group** (👥). The choice stays on this device; what's playing shows small green bars.
- 🇬🇧 **Listening on the dashboard**: Home Assistant's music and radio (the «media» folder, Radio Browser…) play right here, with cover art (or a spinning record drawn for 'Nduja), play/pause, previous/next, progress bar, volume, «Play all», «Shuffle» and the «Up next» queue. Where the browser allows it, lock-screen and headphone controls work too.
- 🇬🇧 **Mini player at the bottom**: it stays visible when you change page (on the Music page it shows up when the big player scrolls off screen); a tap takes you back to Music, ✕ stops. The **Now playing** card on Home also shows what's playing here.
- 🇬🇧 **📂 Browse** with cover art: folders and albums are tiles, inside an album or a playlist the tracks are a list. For speakers with their own library (Sonos, Google Cast…) you browse that and the music starts on the speaker; for the others I use Home Assistant's media. Only things you can listen to are shown (no photos, videos or cameras).
- 🇬🇧 **🗣️ Ask Alexa**: for Echo devices (Alexa Media Player) type an artist, song, playlist or station and choose where to look for it (Amazon Music, Spotify, Apple Music, Deezer, TuneIn, iHeartRadio), or «Voice» to tell Alexa what you want. Every speaker shows only the controls it really supports.
- 🇬🇧 Fixed: in the light theme speaker covers and the big ▶ button were hard to see; drop-down menus (e.g. «Source») sometimes showed another speaker's items.

## 0.7.27-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **💡 Luci rifatte**: in alto il **riepilogo** con quante luci sono accese e **dove** (tocca una stanza per andarci), le icone delle luci accese col loro colore, **⏻ Spegni tutto** e le **scene di luce**, se ci sono. Sotto, le **stanze divise per piano**, ognuna con «Spegni» o «Accendi».
- 🇮🇹 Ogni luce è una **tessera grande** che si illumina del **colore vero della lampada** (anche il bianco caldo o freddo), con un **alone morbido** che cresce con la luminosità. La luminosità si vede come **riempimento** della tessera e si regola **trascinando il dito in orizzontale**; un **tocco** accende o spegne, una **pressione lunga** (o ⋯) apre i dettagli. Sul PC vanno anche il tasto destro e la tastiera (Invio, frecce).
- 🇮🇹 **Dettagli della luce**: cursore grande della luminosità, **temperatura del bianco** (calda, naturale, fredda o al grado) se la lampada la supporta, **ruota dei colori** e tavolozza per le luci RGB, con i tuoi **colori preferiti** (☆ salva quello di adesso), ed **effetti** se ce ne sono. Da una stanza della Home o da un gruppo «‹» ti riporta indietro.
- 🇮🇹 **Gruppi riconosciuti, niente doppioni**: i gruppi di luci (di Home Assistant, Zigbee, Hue…) raccolgono da soli le loro luci della stessa stanza e mostrano «▦ 2»; nei dettagli del gruppo comandi ogni luce. Il conteggio delle luci accese non conta più due volte la stessa luce, anche nella Home, nella mappa e in alto.
- 🇮🇹 **Interruttori che comandano una luce**: con ✏️ Modifica → ＋ Aggiungi luce li trovi (prima quelli che dal nome o dal tipo sembrano luci, gli altri con la ricerca). Diventano luci, escono da Prese e con ✕ ci tornano.
- 🇮🇹 **Modifica** (✏️): ＋ per ritrovare le luci tolte, ✕ per toglierle, ◀ ▶ per l'**ordine** in ogni stanza, ✏️ per **nome**, stanza e **icona**: lampadina, lampadario, plafoniera, lampada, piantana, applique, faretti, striscia LED, esterno (disegnate per 'Nduja), o automatica dal nome. Le scelte valgono su tutti i dispositivi.
- 🇮🇹 Le nuove tessere compaiono anche nelle **stanze della Home**, nelle **pagine** e nelle **schede create da te**; nella **mappa** le luci hanno la loro icona e il loro colore. Tema chiaro e scuro, telefono, tablet e PC; con «Riduci movimento» niente transizioni.
- 🇬🇧 **💡 Lights redone**: at the top a **summary** of how many lights are on and **where** (tap a room to jump to it), the icons of the lights that are on in their colour, **⏻ Turn everything off** and the **light scenes**, if any. Below, the **rooms by floor**, each with «Turn off» or «Turn on».
- 🇬🇧 Each light is a **large tile** that glows in the **lamp's real colour** (warm or cool white too), with a **soft halo** that grows with brightness. Brightness shows as the tile's **fill** and is set by **dragging your finger sideways**; a **tap** switches it on or off, a **long press** (or ⋯) opens the details. On a PC right-click and the keyboard (Enter, arrows) work too.
- 🇬🇧 **Light details**: a large brightness slider, **white temperature** (warm, neutral, cool or by the degree) if the lamp supports it, a **colour wheel** and palette for RGB lights, with your **favourite colours** (☆ saves the current one), and **effects** if there are any. From a room on Home or from a group «‹» takes you back.
- 🇬🇧 **Groups recognised, no duplicates**: light groups (Home Assistant, Zigbee, Hue…) gather their own lights in the same room and show «▦ 2»; in the group's details you control each light. The count of lights on no longer counts the same light twice, on Home, the map and the top bar too.
- 🇬🇧 **Switches that control a light**: with ✏️ Edit → ＋ Add light you find them (first those that look like lights by name or type, the others by searching). They become lights, leave Plugs and go back there with ✕.
- 🇬🇧 **Edit** (✏️): ＋ to get back removed lights, ✕ to remove them, ◀ ▶ for the **order** in each room, ✏️ for **name**, room and **icon**: bulb, chandelier, ceiling light, lamp, floor lamp, wall light, spotlights, LED strip, outdoor (drawn for 'Nduja), or automatic from the name. Choices apply on every device.
- 🇬🇧 The new tiles also show in the **rooms on Home**, in **your own pages** and **cards**; on the **map** lights have their own icon and colour. Light and dark theme, phone, tablet and PC; with «Reduce motion» no transitions.

## 0.7.26-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **⚡ Energia più bella**: la parte alta della pagina Energia ora è una **scena animata** disegnata apposta per 'Nduja. Tutti i dati, lo storico e i costi restano com'erano.
- 🇮🇹 **Cielo vero**: il sole si muove su un arco seguendo l'ora reale tra alba e tramonto (da `sun.sun`); il colore del cielo passa da alba a giorno, tramonto e notte. Di notte compaiono la **luna**, con la sua fase del giorno, e le **stelle**. Il **meteo di casa** cambia la scena: nuvole che passano (più veloci col vento), pioggia, rovesci, nebbia, neve (anche sul prato), grandine e temporale con i lampi.
- 🇮🇹 **La casa al centro**: i **pannelli sul tetto** si illuminano in proporzione alla produzione (rispetto al massimo degli ultimi 30 giorni), la **batteria** mostra il livello e se si carica o si scarica, il **contatore** dice se prelevi o immetti, e l'**auto in carica** (se c'è ed è a casa) compare davanti alla colonnina. Di notte si accendono le finestre.
- 🇮🇹 **Linee di energia** con i pallini che scorrono: sole → casa, sole → batteria, sole → rete, rete ↔ casa, batteria ↔ casa e casa → auto. Verso e velocità seguono i watt. Le etichette sulla scena mostrano i valori e, toccate, aprono il sensore; sul telefono stanno in tessere sotto la scena.
- 🇮🇹 **Elettrodomestici accesi** sotto la scena, con le animazioni della 0.7.18 e i watt di ciascuno; quelli che consumano di più sono **in evidenza**, con la parte dei consumi della casa.
- 🇮🇹 **Riepilogo in parole semplici**, per esempio «Il sole copre il 78% dei consumi, stai immettendo 1,2 kW», più batteria e auto in carica.
- 🇮🇹 Senza fotovoltaico, batteria o auto gli elementi mancanti non compaiono. La scena è leggera (solo CSS, poche decine di animazioni), uguale col tema chiaro e scuro, e con «Riduci movimento» resta ferma.
- 🇬🇧 **⚡ A nicer Energy page**: the top of the Energy page is now an **animated scene** drawn for 'Nduja. All the data, history and costs stay as they were.
- 🇬🇧 **A real sky**: the sun moves along an arc following the real time between sunrise and sunset (from `sun.sun`); the sky colour goes from dawn to day, sunset and night. At night the **moon**, in today's phase, and the **stars** come out. The **home weather** changes the scene: passing clouds (faster with wind), rain, downpours, fog, snow (on the lawn too), hail and thunderstorms with lightning.
- 🇬🇧 **The house in the middle**: the **roof panels** light up in proportion to production (compared with the peak of the last 30 days), the **battery** shows its level and whether it's charging or discharging, the **meter** shows whether you import or export, and the **charging car** (if there is one and it's at home) appears by the charger. At night the windows light up.
- 🇬🇧 **Energy lines** with flowing dots: sun → home, sun → battery, sun → grid, grid ↔ home, battery ↔ home and home → car. Direction and speed follow the watts. The labels on the scene show the values and open the sensor on tap; on phones they sit in tiles below the scene.
- 🇬🇧 **Appliances running** below the scene, with the 0.7.18 animations and the watts of each; the biggest consumers are **highlighted**, with their share of the home's consumption.
- 🇬🇧 **A plain-language summary**, for example «The sun covers 78% of what the house uses, you're exporting 1.2 kW», plus battery and charging car.
- 🇬🇧 Without solar, battery or car the missing parts don't show. The scene is light (CSS only, a few dozen animations), the same in light and dark theme, and still with «Reduce motion».

## 0.7.25-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **🌡️ Clima animato**: ogni condizionatore, termostato e radiatore ha il suo disegno animato, fatto apposta per 'Nduja. Il **condizionatore** muove le alette; quando raffresca soffia aria blu con i fiocchi, quando scalda aria arancione a onde, quando deumidifica fa scendere le gocce e in ventilazione gira la ventola. Il **termostato** ha la fiamma che guizza (o il fiocco, la goccia, la ventola) e l'anello che respira; il **radiatore** si scalda elemento dopo elemento con le onde di calore che salgono.
- 🇮🇹 La **velocità dell'animazione segue la ventola** (silenziosa, bassa, media, alta, turbo, anche a numeri). Quando la temperatura è raggiunta il disegno resta colorato ma **fermo** («a riposo»).
- 🇮🇹 Con ✏️ Modifica → ✏️ sul clima → **🎞️ Aspetto** scegli: **animazioni della plancia** (di partenza, con il disegno automatico o quello che preferisci), **le tue immagini o GIF** da `/local/…`, una per ogni momento (spento, raffresca, scalda, deumidifica, ventila; controllo che il file esista), oppure l'**icona** di sempre. Nel foglio c'è l'**anteprima dal vivo** dei cinque momenti, con quello di adesso evidenziato.
- 🇮🇹 Lo stesso aspetto compare nella pagina **Clima**, nelle schede clima della **Home** e delle stanze, nelle **stanze della Home** e nella **mappa**. Le scelte si salvano nella plancia e valgono su tutti i dispositivi. Con «Riduci movimento» i disegni restano fermi.
- 🇬🇧 **🌡️ Animated climate**: every air conditioner, thermostat and radiator has its own animated drawing, made for 'Nduja. The **air conditioner** moves its louvres; when cooling it blows blue air with snowflakes, when heating orange wavy air, when drying it drips drops and in fan mode its fan spins. The **thermostat** has a flickering flame (or snowflake, drop, fan) and a breathing ring; the **radiator** warms up section by section with heat waves rising.
- 🇬🇧 The **animation speed follows the fan** (quiet, low, medium, high, turbo, numbers too). When the temperature is reached the drawing stays coloured but **still** («idle»).
- 🇬🇧 With ✏️ Edit → ✏️ on the climate device → **🎞️ Look** choose: **dashboard animations** (default, with the automatic drawing or the one you prefer), **your own images or GIFs** from `/local/…`, one for each moment (off, cooling, heating, drying, fan; I check that the file exists), or the usual **icon**. The sheet has a **live preview** of the five moments, with the current one highlighted.
- 🇬🇧 The same look shows on the **Climate** page, in the climate cards on **Home** and in rooms, in the **rooms on Home** and on the **map**. Choices are saved in the dashboard and apply on every device. With «Reduce motion» the drawings stay still.

## 0.7.24-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **📷 Telecamere: flussi**. Se la stessa telecamera ha più entità (principale e sub-stream, HD e SD, Clear e Fluent) le **unisco da solo**: l'anteprima in griglia usa il **flusso leggero**, la diretta al tocco il **principale**, e il doppione non compare più come telecamera a parte. Riconosco `_sub`, `_main`, `_hd`, `_sd` (e Clear/Fluent di Reolink) e le telecamere dello stesso dispositivo. In modifica ogni tessera mostra «🔗 2 flussi».
- 🇮🇹 Con ✏️ su una telecamera scegli **il flusso della diretta e quello dell'anteprima** (anche diversi da quelli proposti) e, per ognuno, **il metodo**: Auto, WebRTC, HLS, MJPEG o Foto per la diretta; foto leggera (di partenza) oppure WebRTC, HLS o MJPEG per avere **l'anteprima in movimento**. Vedi quali metodi offre ogni flusso. Se il metodo scelto non va, la diretta lo dice e offre «Prova gli altri metodi».
- 🇮🇹 **＋ Aggiungi telecamera** mostra **tutte** le `camera.*`, anche quelle nascoste in Home Assistant, i doppioni e i sub-stream, con una miniatura e il motivo per cui non c'erano. **✕** toglie, **◀ ▶** riordina, ✏️ **rinomina** e cambia stanza.
- 🇮🇹 **🗂 Gruppi** facoltativi (es. «Esterno», «Interno»): ognuno è una **scheda a parte**, nell'ordine che scegli; le telecamere si mettono nel gruppo con un tocco. Quelle senza gruppo restano in «Altre telecamere». Anche la scheda Telecamere di 🛡️ Sicurezza segue flussi e ordine.
- 🇮🇹 Tutte le scelte si salvano nella plancia e valgono **su tutti i dispositivi**. Le anteprime in movimento si fermano mentre guardi una diretta e non bloccano il salvaschermo.
- 🇬🇧 **📷 Cameras: streams**. When the same camera has more than one entity (main and sub-stream, HD and SD, Clear and Fluent) I **join them by myself**: the grid preview uses the **light stream**, the live view on tap the **main one**, and the duplicate no longer shows up as a separate camera. I recognise `_sub`, `_main`, `_hd`, `_sd` (and Reolink's Clear/Fluent) and cameras of the same device. In edit mode each tile shows «🔗 2 streams».
- 🇬🇧 With ✏️ on a camera choose **the live view stream and the preview stream** (even different from the suggested ones) and, for each one, **the method**: Auto, WebRTC, HLS, MJPEG or Photo for the live view; light photo (default) or WebRTC, HLS or MJPEG for a **moving preview**. You see which methods each stream offers. If the chosen method doesn't work, the live view says so and offers «Try the other methods».
- 🇬🇧 **＋ Add camera** lists **every** `camera.*`, including those hidden in Home Assistant, duplicates and sub-streams, with a thumbnail and the reason it wasn't there. **✕** removes, **◀ ▶** reorders, ✏️ **renames** and changes the room.
- 🇬🇧 Optional **🗂 Groups** (e.g. «Outside», «Inside»): each one is a **separate card**, in the order you choose; cameras go into a group with one tap. Those without a group stay in «Other cameras». The Cameras card in 🛡️ Security follows streams and order too.
- 🇬🇧 Every choice is saved in the dashboard and applies **on every device**. Moving previews pause while you watch a live view and don't block the screensaver.

## 0.7.23-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **📷 Telecamere in diretta**: un lettore nuovo, uguale ovunque, che sceglie da solo il modo migliore. Prova prima **WebRTC** (immagine quasi in tempo reale), poi **HLS**, poi **MJPEG** e, se proprio non va niente, mostra **una foto ogni 2 secondi**. Un'etichetta in alto dice il metodo usato e «collegamento…» mentre si collega.
- 🇮🇹 Ogni dispositivo **ricorda il metodo che ha funzionato** per ogni telecamera e la volta dopo parte da quello: la diretta si apre prima.
- 🇮🇹 Le griglie mostrano **anteprime leggere** (con il tasto ▶); la diretta parte **al tocco**, in un foglio più grande. Comandi: **audio** (muto di partenza, si attiva con un tocco), **tutto schermo** e **📸 Istantanea**, che salva il fotogramma che vedi (su telefono e tablet si apre «Condividi», da cui la salvi nelle Foto).
- 🇮🇹 Gli stream si **chiudono davvero** quando chiudi il foglio, cambi pagina o metti la plancia in secondo piano (e si riaprono quando torni): niente traffico nascosto. Mentre guardi una telecamera il salvaschermo non parte.
- 🇮🇹 In **🛡️ Sicurezza** c'è la nuova scheda **Telecamere** con le anteprime; anche le telecamere delle pagine create da te aprono la diretta. Le scritte sulle anteprime ora si leggono anche col tema chiaro.
- 🇮🇹 Per WebRTC serve **go2rtc** in Home Assistant: è incluso di serie nelle versioni recenti. Senza, la plancia usa HLS o MJPEG da sola.
- 🇬🇧 **📷 Live cameras**: a new player, the same everywhere, that picks the best way by itself. It tries **WebRTC** first (almost real time), then **HLS**, then **MJPEG** and, if nothing else works, shows **a photo every 2 seconds**. A badge at the top shows the method in use and «connecting…» while it connects.
- 🇬🇧 Each device **remembers the method that worked** for each camera and starts from it next time, so the live view opens faster.
- 🇬🇧 Grids show **light previews** (with a ▶ button); the live view starts **on tap**, in a larger sheet. Controls: **sound** (muted at first, one tap to turn it on), **full screen** and **📸 Snapshot**, which saves the frame you're seeing (on phones and tablets it opens «Share», so you can save it to Photos).
- 🇬🇧 Streams are **really closed** when you close the sheet, change page or put the dashboard in the background (and reopened when you come back): no hidden traffic. The screensaver doesn't start while you're watching a camera.
- 🇬🇧 **🛡️ Security** has a new **Cameras** card with previews; cameras on your own pages open the live view too. Labels on the previews are now readable in the light theme as well.
- 🇬🇧 WebRTC needs **go2rtc** in Home Assistant: it's included by default in recent versions. Without it, the dashboard uses HLS or MJPEG by itself.

## 0.7.22-dev1
> 🧪 Anteprima / preview · ⚠️ **riavvia Home Assistant** dopo l'aggiornamento / **restart Home Assistant** after updating.
- 🇮🇹 **Automazioni come tasti**: ogni automazione è un tasto moderno. Lo tocchi e si accende o si spegne; acceso è verde, spento è grigio.
- 🇮🇹 **Pausa**: con ⋯ metti in pausa un'automazione per 1 ora, 4 ore, fino a domattina o una settimana. Home Assistant la riaccende da solo, anche con la plancia chiusa e dopo un riavvio. Toccando un tasto in pausa la riaccendi subito.
- 🇮🇹 Sempre da ⋯: **Esegui adesso**, **Mostra in Home** (le preferite diventano una scheda «Automazioni» in Home) e **Nascondi da qui** (per quelle tecniche che non vuoi vedere). Valgono per tutti, su tutti i dispositivi.
- 🇬🇧 **Automations as buttons**: every automation is a modern button. Tap it to turn it on or off; green when on, grey when off.
- 🇬🇧 **Pause**: with ⋯ pause an automation for 1 hour, 4 hours, until tomorrow morning or one week. Home Assistant turns it back on by itself, even with the dashboard closed and after a restart. Tap a paused button to turn it back on right away.
- 🇬🇧 Also from ⋯: **Run now**, **Show on Home** (favourites become an «Automations» card on Home) and **Hide from here** (for technical ones you don't want to see). They apply to everyone, on every device.

## 0.7.22-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
> ⚠️ 🇮🇹 Se arrivi da una versione prima della 0.7.21-dev **riavvia Home Assistant** dopo l'aggiornamento. · 🇬🇧 If you're coming from a version before 0.7.21-dev, **restart Home Assistant** after updating.
- 🇮🇹 **📌 Bacheca** (pagina nuova): i messaggi di famiglia. Ognuno ha testo (fino a 280 caratteri), **autore** (chi lo scrive, con la foto della sua persona), data e **colore** a scelta tra sei.
- 🇮🇹 Un messaggio si può **appuntare in alto** (con la puntina) e può avere una **scadenza**: stasera, domani, 3 giorni, una settimana o un giorno scelto; allo scadere **sparisce da solo**. Senza scadenza resta finché qualcuno non lo cancella.
- 🇮🇹 Lo **cancella** (con il doppio tocco di conferma) o lo appunta **chi l'ha scritto oppure un amministratore**.
- 🇮🇹 Usa i dati condivisi della 0.7.21: **qualsiasi utente** può scrivere, i messaggi valgono su tutti i dispositivi e **uno nuovo compare subito** sugli altri telefoni e tablet, con una piccola animazione d'arrivo (ferma con «Riduci movimento»).
- 🇮🇹 In **Home** la scheda **«Bacheca»** con gli ultimi messaggi (prima gli appuntati) e «Scrivi»; si nasconde con ✏️ Modifica o per persona, come le altre. La pagina si sceglie in Impostazioni e nella plancia per persona.
- 🇬🇧 **📌 Notice board** (new page): family messages. Each one has text (up to 280 characters), **author** (whoever writes it, with their person's photo), date and one of six **colours**.
- 🇬🇧 A message can be **pinned to the top** (with a drawn pin) and can have an **expiry**: tonight, tomorrow, 3 days, a week or a chosen day; when it expires it **disappears by itself**. Without an expiry it stays until someone deletes it.
- 🇬🇧 **The author or an admin** can **delete** it (double tap to confirm) or pin it.
- 🇬🇧 It uses the shared data from 0.7.21: **any user** can write, messages are the same on every device and **a new one shows up right away** on the other phones and tablets, with a small arrival animation (still with «Reduce motion»).
- 🇬🇧 On **Home**, the **«Notice board»** card with the latest messages (pinned first) and «Write»; hide it with ✏️ Edit or per person, like the others. The page can be chosen in Settings and in the per-person dashboard.

## 0.7.21-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
> ⚠️ 🇮🇹 Dopo l'aggiornamento **riavvia Home Assistant**: cambia anche la parte in Python. · 🇬🇧 After updating **restart Home Assistant**: the Python part changes too.
- 🇮🇹 **🧹 Faccende** (pagina nuova): i lavori di casa, ognuno con nome, icona, **ogni quanti giorni** va fatto, **a chi tocca** tra le persone di Home Assistant (**a turno**, nell'ordine scelto, oppure **sempre la stessa persona**, oppure chiunque) e l'**ultima volta** che è stato fatto. Divisi in «In ritardo», «Oggi» e «Prossimi giorni», con una barra che si riempie fino alla scadenza.
- 🇮🇹 **«Fatto»** registra chi e quando e passa il turno a chi viene dopo. Se il tuo utente è collegato a una persona lo segno a nome tuo; dal tablet di casa (o da un utente senza persona) ti chiedo chi l'ha fatto. Con ✏️ trovi «Fatto da…» per un'altra persona, **«Annulla l'ultimo Fatto»** e le ultime volte. «Le mie» mostra solo quelle che toccano a te.
- 🇮🇹 In **Home** la scheda **«Faccende di oggi»** (prima le tue, poi quelle in ritardo) con «Fatto» a portata di dito; si nasconde con ✏️ Modifica o per persona, come le altre.
- 🇮🇹 Con l'elenco vuoto la pagina propone **qualche esempio** (bagno, aspirapolvere, spazzatura, lenzuola…): li aggiungi solo se li scegli tu.
- 🇮🇹 **Dati condivisi**: le faccende valgono su tutti i dispositivi e le può aggiungere, cambiare e segnare **qualsiasi utente**, non solo gli amministratori. Sono salvate in Home Assistant a parte rispetto alle scelte della plancia; se due persone salvano insieme nessuna cancella il lavoro dell'altra, e gli altri dispositivi si aggiornano subito. Serviranno anche alla Bacheca.
- 🇬🇧 **🧹 Chores** (new page): household chores, each with name, icon, **how often** (days), **whose turn** among Home Assistant people (**taking turns** in the chosen order, **always the same person**, or anyone) and the **last time** it was done. Grouped as «Overdue», «Today» and «Coming up», with a bar filling up until it's due.
- 🇬🇧 **«Done»** records who and when and passes the turn to the next person. If your user is linked to a person it's recorded as you; from the shared tablet (or a user without a person) I ask who did it. ✏️ has «Done by…» for someone else, **«Undo the last Done»** and the recent history. «Mine» shows only the ones that are your turn.
- 🇬🇧 On **Home**, the **«Today's chores»** card (yours first, then overdue ones) with «Done» right there; hide it with ✏️ Edit or per person, like the others.
- 🇬🇧 With an empty list the page offers **a few examples** (bathroom, vacuuming, rubbish, sheets…): they're added only if you pick them.
- 🇬🇧 **Shared data**: chores are the same on every device and **any user** can add, change and mark them, not just admins. They're stored in Home Assistant separately from the dashboard choices; if two people save at the same time neither loses the other's change, and other devices update right away. The Notice board will use them too.

## 0.7.20-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **Accessi** in 🛡️ Sicurezza: una scheda nuova per cancello, cancelletto, porta del garage, portone e porte. Ci finiscono da sole le cover di tipo cancello, garage e porta e le serrature (che prima avevano la scheda «Serrature»).
- 🇮🇹 Con ✏️ Modifica → **＋ Aggiungi accesso** inserisci qualsiasi serratura, cover, interruttore, pulsante (`button`, `input_button`) o script. Per ognuno scegli nome, icona (cancello, cancelletto, garage, portone, porta: disegni animati della plancia), comando (**apri/chiudi**, **impulso** come il telecomando, oppure **apri · stop · chiudi** per le cover che si fermano) e un **sensore facoltativo** che dice se è aperto. Con ✏️ gli accessi si tolgono, si rinominano e si riordinano con ◀ ▶.
- 🇮🇹 Pulsanti grandi; per **aprire serve il doppio tocco** di conferma, come nella pagina Auto. Lo stato si vede quando è noto: aperto, chiuso, si apre, si chiude (con l'animazione, ferma con «Riduci movimento»).
- 🇮🇹 In **Home** una scheda compatta «Accessi» con il pulsante principale di ognuno; compare solo se ci sono accessi.
- 🇬🇧 **Access** in 🛡️ Security: a new card for gates, pedestrian gates, garage doors, main doors and doors. Covers of class gate, garage and door and locks (which used to have the «Locks» card) show up by themselves.
- 🇬🇧 With ✏️ Edit → **＋ Add access** add any lock, cover, switch, button (`button`, `input_button`) or script. For each one choose name, icon (gate, pedestrian gate, garage, main door, door: animated dashboard drawings), command (**open/close**, **pulse** like a remote, or **open · stop · close** for covers that can stop) and an **optional sensor** telling whether it's open. With ✏️ you remove, rename and reorder them with ◀ ▶.
- 🇬🇧 Big buttons; **opening needs a double tap** to confirm, as on the Car page. The state shows when known: open, closed, opening, closing (animated, still with «Reduce motion»).
- 🇬🇧 On **Home**, a compact «Access» card with each one's main button; it shows up only when there are access points.

## 0.7.19-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **Controlla Home Assistant** (⚙️ Impostazioni, solo amministratori): premi «Controlla» e ricevi un elenco in parole semplici, con ✅ o ⚠️ e il numero di casi: stanze, stanze senza piano, dispositivi mostrati senza stanza, Energia, meteo, persone senza telefono o tracker, dispositivi mostrati che non rispondono (con l'elenco da aprire) e versione di Home Assistant. Ogni ⚠️ ha un pulsante che apre la schermata giusta di Home Assistant. Il controllo legge soltanto: non cambia niente.
- 🇮🇹 **Schermata d'errore chiara**: se la plancia non si collega a Home Assistant o i suoi file non partono, al posto della pagina bianca compare un riquadro con cosa controllare, «Riprova» e «Dettagli per l'assistenza» (versione, errori e browser), da incollare in una segnalazione. Quando tutto funziona non compare mai.
- 🇮🇹 **Etichetta «'Nduja»**: le automazioni e gli script (Momenti, avvisi sul telefono) creati dalla plancia ricevono l'etichetta «'Nduja» in Home Assistant, creata se manca. Le altre etichette restano.
- 🇬🇧 **Check Home Assistant** (⚙️ Settings, admins only): press «Check» to get a plain-language list, with ✅ or ⚠️ and how many cases: rooms, rooms without a floor, devices shown without a room, Energy, weather, people without a phone or tracker, devices shown that don't respond (with a list to open) and the Home Assistant version. Each ⚠️ has a button that opens the right Home Assistant screen. The check only reads: it never changes anything.
- 🇬🇧 **Clear error screen**: if the dashboard can't connect to Home Assistant or its files don't start, instead of a blank page you get a box with what to check, «Try again» and «Details for support» (version, errors and browser) to paste into a report. When everything works it never shows up.
- 🇬🇧 **'Nduja label**: automations and scripts (Moments, phone alerts) created by the dashboard get the «'Nduja» label in Home Assistant, created if missing. Other labels are kept.

## 0.7.18-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **Elettrodomestici animati**: con ✏️ scegli l'aspetto di ogni elettrodomestico per **fermo**, **in funzione** e **finito**. Le **animazioni della plancia** sono disegnate apposta: lavatrice (oblò che gira con i panni, acqua e bolle), asciugatrice (cestello e aria calda), lavastoviglie (spruzzi e vapore), forno (resistenze che si accendono e luce), frigorifero (fiocchi di neve e alone freddo) e una generica per le prese (spia ed energia nel cavo); quando ha finito compaiono una spunta e dei brillantini. Sono la scelta di partenza per i tipi che riconosco.
- 🇮🇹 **Le mie immagini**: un'immagine o una GIF tua per ciascun momento (in `/config/www`, quindi `/local/…`), con anteprima e controllo che il file esista; se ne manca una uso quella di «Fermo». Oppure l'**icona** di sempre. Nel foglio ✏️ vedi l'anteprima dal vivo dei tre momenti.
- 🇮🇹 Lo stesso aspetto compare nella nuova scheda **Elettrodomestici** della Home e nella **mappa**, nella stanza della presa o del sensore (si può togliere con ✏️). Le scelte si salvano in Home Assistant; chi aveva già un'immagine o un'animazione nell'icona la ritrova com'era. Con «Riduci movimento» attivo le animazioni restano ferme.
- 🇬🇧 **Animated appliances**: with ✏️ choose each appliance's look when **idle**, **running** and **done**. The **dashboard animations** are drawn from scratch: washing machine (spinning drum with clothes, water and bubbles), dryer (drum and warm air), dishwasher (sprays and steam), oven (glowing elements and light), fridge (snowflakes and a cold glow) and a generic plug (status light and energy flowing in the cable); when done, a tick and sparkles appear. They're the default for the types I recognise.
- 🇬🇧 **My images**: your own image or GIF for each moment (in `/config/www`, so `/local/…`), with preview and a check that the file exists; a missing one falls back to «Idle». Or the usual **icon**. The ✏️ sheet shows a live preview of the three moments.
- 🇬🇧 The same look shows up in the new **Appliances** card on Home and on the **map**, in the plug's or sensor's room (can be turned off with ✏️). Choices are saved in Home Assistant; anyone who already had an image or animation as the icon keeps it as it was. With «Reduce motion» on, the animations stay still.

## 0.7.11-dev
> 🧪 Anteprima / preview: HACS la mostra solo con «Mostra versioni beta» · shown by HACS only with «Show beta versions».
- 🇮🇹 **Novità in casa**: la plancia ricorda i dispositivi che ha già visto (luci, clima, prese, tapparelle, ventilatori, TV e lettori, serrature, robot, telecamere, porte e finestre, persone e scene). Al primo avvio dopo l'aggiornamento considera già visto tutto quello che c'è, quindi nessun avviso enorme.
- 🇮🇹 Quando in Home Assistant compaiono dispositivi nuovi, un amministratore vede in Home (e negli Avvisi) «N dispositivi nuovi trovati». Toccandolo si apre l'elenco diviso per stanza: in manuale li aggiungi con la spunta o con «Aggiungi tutti», in automatica vedi in quale pagina sono comparsi e puoi toglierli. «Ho visto» li segna come visti.
- 🇮🇹 Se arriva un'auto nuova l'avviso dice «Nuova auto trovata: la trovi nella pagina Auto».
- 🇮🇹 **Suggeriti** in ＋ Aggiungi: in cima all'elenco i dispositivi più adatti a quella pagina e non ancora nella plancia (i nuovi, quelli della stanza, nelle pagine tue quelli che c'entrano col nome), da aggiungere con un tocco.
- 🇬🇧 **New in your home**: the dashboard remembers the devices it has already seen (lights, climate, plugs, covers, fans, TVs and players, locks, vacuums, cameras, doors and windows, people and scenes). On the first start after the update everything already there counts as seen, so no huge alert.
- 🇬🇧 When new devices show up in Home Assistant, admins see «N new devices found» on Home (and in Alerts). Tap it for the list by room: in manual mode tick them or «Add all», in automatic mode see which page they landed on and remove them. «Got it» marks them as seen.
- 🇬🇧 A new car gets its own alert: «New car found: you'll find it on the Car page».
- 🇬🇧 **Suggested** in ＋ Add: the devices that best fit that page and aren't on the dashboard yet (new ones, the room's ones, on your own pages the ones matching its name) at the top, one tap to add.

## 0.7.10.4
- 🇮🇹 App 'Nduja: se il collegamento a Home Assistant non riesce (per esempio passando dal Wi‑Fi al 5G), la plancia riprova da sola invece di fermarsi.
- 🇬🇧 'Nduja app: if connecting to Home Assistant fails (e.g. switching from Wi‑Fi to 5G), the dashboard keeps retrying instead of giving up.

## 0.7.10.3
- 🇮🇹 Più fluida sui telefoni: quando in casa tanti sensori cambiano di continuo, la plancia si ridisegna al massimo ogni 400 ms e aspetta che tu tolga il dito dallo schermo. I tuoi tocchi restano immediati.
- 🇬🇧 Smoother on phones: when many sensors change all the time, the dashboard redraws at most every 400 ms and waits until your finger leaves the screen. Your taps stay instant.

## 0.7.10.2
- 🇮🇹 Preparazione per l'app 'Nduja per iPhone e iPad: la plancia può collegarsi a Home Assistant da sola quando è aperta dall'app. Dentro Home Assistant non cambia nulla.
- 🇬🇧 Groundwork for the 'Nduja iPhone/iPad app: the dashboard can connect to Home Assistant on its own when opened from the app. Nothing changes inside Home Assistant.

## 0.7.10.1
- 🇮🇹 **Auto** (nuova pagina, compare solo se in Home Assistant c'è un'auto collegata con la sua integrazione: Tesla, BMW, Volkswagen, Škoda, Kia/Hyundai, Renault, Polestar, Mercedes e altre): foto dell'auto, batteria con autonomia e limite di ricarica, stato della ricarica (potenza, tempo alla carica completa, cavo), dove si trova e quanto è lontana da casa, e i comandi: apri/chiudi (con doppio tocco per aprire), clima con temperatura, avvia/ferma ricarica, baule, frunk e sportello di ricarica, limite e corrente di ricarica, chilometri, temperature e pressione delle gomme; in «Altri comandi» tutto il resto (clacson, luci, modalità sentinella, sedili riscaldati…). Nella Home la scheda «Auto» e in alto la batteria. I comandi dell'auto non compaiono più nelle pagine Clima, Prese e Sicurezza.
- 🇮🇹 **Foto dell'auto**: uso quella dell'integrazione; se non c'è la cerco su Wikipedia con marca e modello (si può spegnere, o mettere un indirizzo tuo, con ✏️).
- 🇮🇹 Le schede nuove della Home compaiono al loro posto e non più in fondo.
- 🇮🇹 La plancia include ora la libreria **hls.js** 1.6.13 (licenza Apache 2.0, avvisi in `THIRD_PARTY_LICENSES.md`) che servirà per le dirette delle telecamere.
- 🇬🇧 **Car** (new page, shown only if Home Assistant has a car connected through its integration: Tesla, BMW, Volkswagen, Škoda, Kia/Hyundai, Renault, Polestar, Mercedes and more): car photo, battery with range and charge limit, charging status (power, time to full, cable), where it is and how far from home, and controls: lock/unlock (double tap to unlock), climate with temperature, start/stop charging, trunk, frunk and charge port, charge limit and current, odometer, temperatures and tyre pressure; «More controls» holds the rest (horn, lights, sentry mode, heated seats…). «Car» card on Home and battery at the top. Car controls no longer show up in Climate, Plugs and Security.
- 🇬🇧 **Car photo**: the integration's picture; if missing I look it up on Wikipedia by make and model (can be turned off, or use your own link, with ✏️).
- 🇬🇧 New Home cards appear in their natural place instead of at the bottom.
- 🇬🇧 The dashboard now bundles **hls.js** 1.6.13 (Apache 2.0 license, notices in `THIRD_PARTY_LICENSES.md`) for upcoming live camera streams.

## 0.7.10-beta
- 🇮🇹 **Procedura guidata che riprende da dove eri**: se chiudi la plancia a metà configurazione, alla riapertura riparti dallo stesso passo con le scelte fatte (restano su quel dispositivo finché non salvi o annulli). Nel benvenuto compare «Riprendi da dove eri».
- 🇮🇹 **«Salta per ora» e «Annulla»** in ogni passo: salti un passo lasciandolo com'era, oppure esci senza cambiare niente.
- 🇮🇹 **Riepilogo della modalità automatica**: prima di entrare vedi quante stanze, luci, clima, dispositivi e persone ho trovato, le stanze divise per piano e le pagine che compariranno; poi «Va bene, entra» o «Voglio scegliere io».
- 🇬🇧 **Setup that resumes**: close the dashboard halfway through setup and it reopens at the same step with your choices (kept on that device until you save or cancel). The welcome screen offers «Pick up where you left off».
- 🇬🇧 **«Skip for now» and «Cancel»** on every step: skip a step leaving it as it was, or leave without changing anything.
- 🇬🇧 **Automatic mode summary**: before entering you see how many rooms, lights, climate devices, devices and people I found, rooms by floor and the pages you'll get; then «Looks good» or «Let me choose».

## 0.7.9-beta
- 🇮🇹 **Home con schede libere**: in ✏️ Modifica «＋ Nuova scheda» con titolo e icona tua, e dentro qualsiasi dispositivo o sensore (valori, luci, prese, clima…); si sposta e si nasconde come le altre.
- 🇮🇹 **Avvisi sul telefono**: 📱 sulla scheda Avvisi; scegli i telefoni e cosa (fumo/gas/acqua, allarme scattato, porta aperta da 10 minuti, elettrodomestico finito, pila scarica). Creo in Home Assistant l'automazione «'Nduja · avvisi sul telefono», che funziona anche a plancia chiusa.
- 🇮🇹 **Più veloce**: all'apertura carico subito Home e Impostazioni, le altre pagine subito dopo.
- 🇬🇧 **Home free cards**: in ✏️ Edit «＋ New card» with your own title and icon, holding any device or sensor (values, lights, plugs, climate…); moves and hides like the others.
- 🇬🇧 **Phone alerts**: 📱 on the Alerts card; pick phones and what (smoke/gas/water, alarm triggered, door open 10 minutes, appliance done, low battery). I create the «'Nduja · phone alerts» automation in Home Assistant, which works with the dashboard closed.
- 🇬🇧 **Faster**: Home and Settings load first, the other pages right after.

## 0.7.8-beta
- 🇮🇹 **Musica e TV**: nuova pagina con casse e TV per stanza: copertina, titolo e artista, ⏮ ⏯ ⏭, casuale e ripeti, volume e muto, sorgente e modalità audio, accendi/spegni. In Home la scheda «In riproduzione».
- 🇮🇹 **Esporta / importa le impostazioni** (⚙️ Impostazioni → Personalizza): un file con tutte le scelte della plancia, per backup o per un altro Home Assistant.
- 🇮🇹 **Plancia per persona** (⚙️ Impostazioni): per ogni utente di Home Assistant scegli quali pagine e quali schede della Home vede; pulsante «Plancia semplice» già pronto.
- 🇬🇧 **Music and TV**: new page with speakers and TVs by room: artwork, title and artist, ⏮ ⏯ ⏭, shuffle and repeat, volume and mute, source and sound mode, power. «Now playing» card on Home.
- 🇬🇧 **Export / import settings** (⚙️ Settings → Customize): one file with every dashboard choice, for backup or another Home Assistant.
- 🇬🇧 **Per-person dashboard** (⚙️ Settings): for each Home Assistant user choose which pages and Home cards they see; ready-made «Simple dashboard» button.

## 0.7.7-beta
- 🇮🇹 **Salvaschermo** (⚙️ Impostazioni → Questo dispositivo): dopo 1, 5, 10 o 30 minuti senza tocchi mostra un orologio grande con data, meteo, temperatura di casa e persone in casa, oppure le **tue foto** da una cartella dei Media di Home Assistant (in dissolvenza); di notte si attenua, si sveglia al tocco.
- 🇮🇹 **Grafici**: tocca un sensore con un numero (temperatura, umidità, consumi…) e vedi l'andamento di 24 ore, 7 o 30 giorni con minimo, massimo e media, dentro la plancia.
- 🇮🇹 **Energia → Storico e costi**: settimana, mese, anno con prodotto, prelevato e immesso; **spesa in bolletta, guadagno dall'immissione, risparmio dal sole e netto in euro** (prezzi dalla configurazione Energia o scelti in ⚙️ Sensori). Nella scheda Oggi c'è la spesa del giorno.
- 🇮🇹 **Momenti**: pulsanti che fanno più cose insieme («Esco», «Notte», «Buongiorno», «Film»…), nella scheda Momenti della Home; si salvano in Home Assistant come script. Nuova azione **Allarme** (inserisci/disinserisci) anche nelle automazioni.
- 🇬🇧 **Screensaver** (⚙️ Settings → This device): after 1, 5, 10 or 30 idle minutes shows a big clock with date, weather, home temperature and people home, or **your photos** from a Home Assistant Media folder (cross-fading); dims at night, wakes on touch.
- 🇬🇧 **Charts**: tap any numeric sensor (temperature, humidity, power…) for a 24 h, 7 or 30 day chart with min, max and average, inside the dashboard.
- 🇬🇧 **Energy → History and costs**: week, month, year with produced, imported and exported; **grid cost, export earnings, solar savings and net in euros** (prices from the Energy configuration or set in ⚙️ Sensors). Today's cost in the Today card.
- 🇬🇧 **Moments**: buttons doing several things at once («Leaving», «Night», «Good morning», «Movie»…), in Home's Moments card; saved in Home Assistant as scripts. New **Alarm** action (arm/disarm) in automations too.

## 0.7.6-beta
- 🇮🇹 **Tutto schermo**: pulsante ⛶ in alto accanto al tema; la plancia occupa tutto lo schermo (dove il browser lo permette). Di nuovo per uscire (o tasto Esc).
- 🇮🇹 **Modalità chiosco** (⚙️ Impostazioni → Questo dispositivo): nasconde barra laterale e intestazione di Home Assistant su quel dispositivo, a ogni apertura — ideale per il tablet a muro; funziona anche su iPhone, dove il tutto schermo non c'è.
- 🇬🇧 **Full screen**: ⛶ button at the top next to the theme; the dashboard fills the screen (where the browser allows it). Again to exit (or Esc).
- 🇬🇧 **Kiosk mode** (⚙️ Settings → This device): hides Home Assistant's sidebar and header on that device, every time — great for a wall tablet; works on iPhone too, where full screen isn't available.

## 0.7.5-beta
- 🇮🇹 **Automazioni**: tutte le automazioni di Home Assistant con ricerca, filtro attive/spente, interruttore, ▶ esegui adesso e quando sono partite l'ultima volta. **＋ Nuova automazione** senza uscire dalla plancia: Quando (a un'ora e in certi giorni, un dispositivo cambia, alba/tramonto, qualcuno arriva o esce) → Solo se (fascia oraria, qualcuno/nessuno in casa) → Allora (accendi, spegni, commuta, scena o script, notifica al telefono, aspetta). Si salvano in Home Assistant; quelle create qui si modificano ed eliminano anche qui, le altre si aprono nell'editor di Home Assistant.
- 🇬🇧 **Automations**: every Home Assistant automation with search, on/off filter, switch, ▶ run now and last run. **＋ New automation** without leaving the dashboard: When (at a time on chosen days, a device changes, sunrise/sunset, someone arrives or leaves) → Only if (time range, someone/nobody home) → Then (turn on, off, toggle, scene or script, phone notification, wait). Saved in Home Assistant; the ones created here can be edited and deleted here, the others open in Home Assistant's editor.

## 0.7.4-beta
- 🇮🇹 **Mappa in 3D**: pulsante 2D / 3D; la casa viene costruita dalla tua mappa con pavimenti e muri alzati, le stanze con le luci accese si illuminano. Trascina per girarla e inclinarla (o usa ⟲ ⟳ ⤒ ⤓); la vista si ricorda per ogni dispositivo.
- 🇬🇧 **3D map**: 2D / 3D button; the house is built from your map with floors and raised walls, rooms with lights on glow. Drag to rotate and tilt (or use ⟲ ⟳ ⤒ ⤓); the view is remembered per device.

## 0.7.3-beta
- 🇮🇹 **Elettrodomestici**: oltre 70 icone tra cui scegliere, oppure un'immagine o **GIF tua** (/local/…); quando l'elettrodomestico parte l'icona **si anima** (gira, vibra, pulsa, salta, vapore — automatica in base al tipo o scelta da te).
- 🇮🇹 **Mappa con i dispositivi**: in ogni stanza le icone dei suoi dispositivi (luci, prese, tapparelle, clima, TV, serrature, robot, telecamere); tocca per accendere o spegnere. In ✏️ Modifica: **＋** aggiunge qualsiasi dispositivo della casa alla stanza (anche alle stanze solo-mappa), **✕** lo toglie; «✨ Dispositivi automatici / ✋ Solo scelti» per piano.
- 🇬🇧 **Appliances**: over 70 icons to choose from, or your own image or **GIF** (/local/…); when the appliance starts its icon **animates** (spin, shake, pulse, bounce, steam — automatic by type or chosen).
- 🇬🇧 **Map with devices**: each room shows its devices' icons (lights, plugs, covers, climate, TV, locks, vacuum, cameras); tap to switch. In ✏️ Edit: **＋** adds any device in the house to the room (map-only rooms too), **✕** removes it; «✨ Auto devices / ✋ Chosen only» per floor.

## 0.7.2-beta
- 🇮🇹 **Mappa**: «＋ Stanza» aggiunge stanze che esistono solo nella mappa (ripostiglio, scale, terrazzo… anche se non le hai create in Home Assistant), con nome modificabile e 🗑 elimina; le aree di Home Assistant compaiono tutte, anche quelle senza dispositivi, e si possono togliere dalla mappa (🙈) e rimettere (👁).
- 🇮🇹 **Elettrodomestici**: nuova pagina con lavatrice, asciugatrice, lavastoviglie, forno, friggitrice, frigo… trovati da soli (anche unendo presa smart e app del produttore): in funzione / finito / fermo, potenza adesso, consumo di oggi, ora di fine, presa da accendere o spegnere. Con ✏️ scegli nome, icona e qualsiasi sensore; con ＋ ne aggiungi.
- 🇬🇧 **Map**: «＋ Room» adds rooms that exist only in the map (closet, stairs, terrace… even if you didn't create them in Home Assistant), with editable name and 🗑 delete; all Home Assistant areas show up, even without devices, and can be removed from the map (🙈) and put back (👁).
- 🇬🇧 **Appliances**: new page with washing machine, dryer, dishwasher, oven, air fryer, fridge… auto-detected (even merging smart plug and manufacturer app): running / done / idle, power now, today's consumption, end time, plug on/off. ✏️ chooses name, icon and any sensor; ＋ adds more.

## 0.7.1-beta
- 🇮🇹 **Energia → Oggi**: ora mostra davvero prodotto, consumato, prelevato e immesso (la richiesta delle statistiche era sbagliata); i contatori giornalieri (today/daily) si leggono direttamente.
- 🇮🇹 **Mappa: stanze a L** (e di qualsiasi forma): «＋ pezzo (L)» aggiunge un rettangolo alla stanza, ognuno si sposta e si ridimensiona da solo; i **muri** vengono disegnati sul contorno e si uniscono da soli.
- 🇬🇧 **Energy → Today**: now really shows produced, consumed, imported and exported (the statistics request was wrong); daily meters (today/daily) are read directly.
- 🇬🇧 **Map: L-shaped rooms** (and any shape): «＋ piece (L)» adds a rectangle to the room, each one moves and resizes on its own; **walls** are drawn on the outline and join automatically.

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

# Autonomia: cosa si regola dalla plancia

Revisione chiesta da Giovanni (regola «Autonomia» in `PROCEDURA.md`): chi usa la plancia deve poter cambiare da solo tutto quello che dipende dalla sua casa, senza YAML.
Per ogni pagina: valore fisso o riconoscimento automatico trovato, dove sta nel codice e cosa è stato fatto.
Le scelte di tutta la casa stanno in `LAYOUT` (solo amministratori), quelle del singolo dispositivo in `localStorage` (`sGet`/`sSet`). Chi non tocca niente vede la plancia come prima.

## Parte 1 — 0.7.47-dev (da Aggiornamenti a Energia, più Avvisi, Controlla, Salvaschermo, Novità)

| pagina | valore fisso | dove | cosa fai |
|---|---|---|---|
| Aggiornamenti | backup prima di installare sempre attivo; la casella del singolo aggiornamento non si ricordava | `pages/aggiornamenti.js` `NOCHK`, `installa()` | reso regolabile: Riepilogo → «💾 Backup prima di installare» (`LAYOUT.aggiornamenti.backup`), con spiegazione; la casella sul singolo aggiornamento resta |
| Aggiornamenti | gruppi del Riepilogo riconosciuti dal nome (HACS, firmware, rete) | `tipo()` | lasciato: cambia solo il raggruppamento, non cosa si installa |
| Aggiornamenti | 20 s di «in corso», 1,5 s tra un'installazione e l'altra | `installa()`, `upAll` | lasciato: tecnica interna |
| Auto | sensori riconosciuti dal nome (batteria, autonomia, km, stato e potenza di ricarica, cavo, fine ricarica, limite, corrente, temperature, posizione) | `pages/auto.js` `ruoli()` | reso regolabile: ✏️ → «Sensori», ogni voce con «✨ Automatico», un'entità qualsiasi o «🚫 Nessuno», col valore di adesso (`cars[dev].sensori`) |
| Auto | auto riconosciute solo da integrazione o sensori; un'auto nascosta con «Non è un'auto» non si poteva più rimettere | `eAuto()`, `carHide` | reso regolabile: «＋ Aggiungi un'auto che non ho riconosciuto» (`cars._add`) e «🙈 Nascoste» con ↩︎; la pagina resta per l'amministratore se ha nascosto tutte le auto |
| Auto | si aggiunge a mano un'auto solo se ce n'è già una riconosciuta | `page(... show)` | rinviato alla 0.7.49 («Cosa puoi aggiungere»): vedi parte 2 |
| Auto | batteria rossa sotto il 15%, arancione sotto il 30% | `batteria()`, `homeCard()` | reso regolabile: ✏️ «Batteria bassa sotto (%)» (arancione sotto il doppio), col valore di adesso (`cars[dev].basso`) |
| Auto | pillola 🚗 in alto solo con una sola auto | `STRIP` | reso regolabile: ✏️ «Mostra la batteria in alto», per ogni auto (`cars[dev].pillola`) |
| Auto | «Altri comandi» mostra tutti i pulsanti, interruttori e selettori | `comandi()` | reso regolabile: ✏️ «Altri comandi», si toglie il segno a quelli che non si usano (`cars[dev].nascondi`) |
| Auto | gomme trovate da sole, al massimo 4; clima a passi di 0,5° | `ruoli().gomme`, `carTemp` | lasciato: elenco di sola lettura / comando del dispositivo |
| Automazioni | icona presa dal nome (es. «Irrigazione serale» → 🌇) | `pages/automazioni.js` `icona()` | reso regolabile: ⋯ → «Icona» con «✨ dal nome» (`automazioni.icone`, dati della casa) |
| Automazioni | «Fino a domattina» = alle 7:00 | `minutiADomattina()` | reso regolabile: ⋯ «Ora di «domattina»», vale per tutte (`automazioni.mattina`); l'ora compare sul pulsante |
| Automazioni | pause solo di 1 ora, 4 ore, domattina o 1 settimana | `menu()` | aggiunto in ⋯ «Fino a un giorno e un'ora a scelta» |
| Automazioni | il costruttore crea sempre `mode: single` | `inHA()` | lasciato: per i casi avanzati c'è «Modifica» in Home Assistant |
| Bacheca | 4 messaggi nella scheda della Home | `pages/bacheca.js` `IN_HOME` | reso regolabile: ⚙️ della Bacheca «Messaggi nella scheda della Home», da 1 a 12 (`LAYOUT.bacheca.inHome`) |
| Bacheca | massimo 280 caratteri e 80 messaggi; scadenze rapide | `MAX_TESTO`, `MAX_MSG`, `SCADE()` | lasciato: limiti per tenere piccoli i dati salvati; c'è già «Scegli il giorno…» |
| Aria | i consigli partono sempre da «Discreta» | `pages/aria.js` `consigli()` | reso regolabile: ⚙️ «Dai consigli quando l'aria è» Discreta o peggio / solo Scarsa (`aria.consigliDa`), vale anche in Home |
| Aria | stanze «di fuori» riconosciute solo dal nome | `stanzaFuori` | reso regolabile: ⚙️ «Stanze di fuori», un interruttore per stanza e ✨ per tornare al riconoscimento automatico (`aria.fuori`) |
| Aria | purificatore / deumidificatore / umidificatore riconosciuto da nome o device_class | `tipoDisp` | reso regolabile: ✏️ del dispositivo → «Che cos'è» (`aria.dispTipi`), con ✨ |
| Aria | soglie, avviso in Home, minuti di ricambio, % del filtro, sensori e stanze | `TIPI()`, `minAvviso`, `ricambio`, `filtroMin` | già regolabile (0.7.43) |
| Aria | passo ±5% dell'umidità, 5 consigli e 5 stanze in vista | `arObj`, `hero`, `homeCard` | lasciato: comando del dispositivo / impaginazione |
| Clima | in ✏️ si aggiungevano solo i climatizzatori | `pages/clima.js` `pagina()` | ✏️ → «＋ Aggiungi ventilatore o umidificatore» (la scheda compare in ✏️ anche vuota) |
| Clima | sensori di temperatura e umidità della stanza scelti da soli | `core.js` `climateSensor` | già correggibile toccando la stanza (`LAYOUT.sensors`) |
| Prese e dispositivi | dispositivi tolti perché stanno in altre pagine (irrigazione, rete, tapparelle, aria, acqua) | `pages/dispositivi.js` `tutti()` | lasciato: si corregge dalla pagina che li prende (parte 2) |
| Pagine dell'utente, Benvenuto | nessun valore fisso | `custom.js`, `benvenuto.js` | niente da fare |
| Batterie | «muta» dopo 7 giorni senza notizie | `batterie.js` `MUTO_GG` | reso regolabile: ✏️ → «Segnala muta una pila dopo N giorni» (1–365, `batterie.muto`) |
| Batterie | telefoni avvisati sul telefono sotto il 15% | `batterie.js` `perAutomazione()` | reso regolabile: ✏️ → «Telefoni: avvisami sul telefono sotto il» (0 = mai, `batterie.telefoni`) |
| Batterie | l'automazione «'Nduja · avvisi» non si aggiornava cambiando soglie o pile | `pages/batterie.js` `salvaB` | ora si riscrive da sola a ogni salvataggio, se gli avvisi sul telefono sono attivi |
| Batterie | soglia 20%; riconoscimento automatico delle pile | `SOGLIA`, `esclusi()` | già regolabile (per casa e per dispositivo, ＋ e ✕) |
| Caldaia | allarmi riconosciuti da soli, senza modo di togliere quelli falsi | `pages/caldaia.js` `ruoli()` | reso regolabile: ✏️ → Sensori e comandi → «Allarmi» con spunta (`caldaia.noAllarmi`) e «＋ Aggiungi un allarme» (`caldaia.allarmi`) |
| Caldaia | promemoria manutenzione 30 giorni prima | `problemi()`, `cardErrori()` | reso regolabile: 🔧 → «Avvisami quanti giorni prima» (`caldaia.preavviso`); vale per pagina, Home e Avvisi |
| Caldaia | manutenzione solo ogni anno o 2 anni | `schedaManut()` | reso regolabile: campo «Mesi» (1–120) |
| Caldaia | costo del gas solo col prezzo della configurazione Energia | `gas()` | reso regolabile: ✏️ → «Prezzo del gas» (`caldaia.prezzoGas`), solo se Energia non ne ha uno |
| Caldaia | valuta fissa EUR | `euro()` | presa da Home Assistant (`get_config.currency`) |
| Caldaia | pressione 1–2,5 bar | `soglie()` | già regolabile; aggiunte una riga di spiegazione e la pressione di adesso |
| Caldaia | vista 30 giorni / 12 mesi dimenticata | `VS` | ricordata per dispositivo (`cdStor`) |
| Caldaia | riconoscimento della caldaia, dei ruoli e dei termostati veri | `eCaldaia()`, `ruoli()`, `termostatoVero()` | già correggibile con ✏️ (dispositivi, ruoli, «nessuno») e Clima → ＋ |
| Calendario | agenda della Home: oggi e domani, 5 eventi | `pages/calendario.js` `agendaCard()` | reso regolabile: ✏️ Calendari → «Agenda nella Home» 2/3/7 giorni e 3/5/8/12 eventi (`LAYOUT.agenda`) |
| Calendario | colori decisi dalla posizione (`LAYOUT.calColors` senza campo) | `agenda.js` `colore()` | reso regolabile: in ✏️ Calendari si tocca il pallino e si sceglie fra 8 colori |
| Calendario | vista oggi / settimana / mese torna a «settimana» | `V.giorni` | ricordata per dispositivo (`calGiorni`) |
| Calendario | raccolta differenziata esclusa da sola | `agenda.js` `calendari()` | già correggibile con le spunte; aggiunta una riga che spiega «Automatico» |
| Chat | frasi rapide, lista della spesa scelta dal nome, telefoni che ricevono la notifica | `pages/chat.js`, `chat.py` | lasciato: frasi solo nelle conversazioni vuote; con più liste ci sono le linguette; i telefoni seguono i dispositivi della persona (lato server) |
| Elettrodomestici | «Finito» resta 3 ore sulla scheda, in Home e nella mappa | `pages/elettrodomestici.js` `stato()` | reso regolabile: ✏️ «"Finito" resta per (ore)», 0 = non mostrarlo (`fineOre`), con aiuto anche su «Ciclo più breve» |
| Elettrodomestici | soglie W/minuti, ciclo minimo, avviso; riconoscimento dei sensori | `config()`, `automatici()` | già regolabile (0.7.37-dev2): ✏️, ＋ e 🗑 |
| Energia | «Chi consuma adesso»: tutti i sensori di potenza filtrati per nome | `pages/energia.js` `consumi()` | reso regolabile: ⚙️ Sensori «Chi consuma adesso» (vuoto = automatico); in ✏️ una ✕ per riga, «↩︎ Rimetti» in ⚙️ |
| Energia | «Consumi di oggi» solo dalla configurazione Energia | `consumi()` | reso regolabile: ⚙️ «Consumi di oggi» per scegliere i contatori |
| Energia | 12 righe, sopra 1 W | `consumi()` | reso regolabile: ⚙️ «Elenchi»: Righe e Mostra sopra (W) |
| Energia | auto sempre davanti a casa nella scena | `autoACasa()` | reso regolabile: ⚙️ «Mostra l'auto davanti a casa» |
| Energia | valuta EUR, «€/kWh» nei campi | `euro()` | presa da Home Assistant |
| Energia | periodo dello Storico torna a «Settimana» | `VS` | ricordato per dispositivo (`enStor`) |
| Energia | tolleranza di 20 W, picco minimo 800 W, giorno 7–19 senza `sun.sun` | `riepilogo()`, `picco()`, `scenaenergia.js` | lasciato: grafica, toglie il rumore dei sensori |
| Home · Avvisi | porta «forse è rimasta aperta» dopo 10 minuti (anche nell'automazione del telefono) | `avvisi.js` `avvisi()`, `automazione()` | reso regolabile: Avvisi → ⚙️ «Regole degli avvisi» (`LAYOUT.avvisi.portaMin`); l'automazione si riscrive da sola |
| Home · Avvisi | pioggia con finestre aperte: 3 ore, probabilità ≥ 60% | `pioggia()` | reso regolabile in ⚙️ (`pioggiaOre`, `pioggiaPr`), col nome del meteo usato |
| Home · Avvisi | «ha finito» resta 6 ore | `avvisi()` | reso regolabile in ⚙️ (`finitoOre`) |
| Home · Avvisi | telefono scarico sotto il 20% | `avvisi()` | reso regolabile in ⚙️ (`telBatt`), con la batteria di adesso di ogni telefono |
| Home · Avvisi | «Stasera esponi» dalle 17 | `avvisi()` | reso regolabile in ⚙️ (`raccoltaOra`, 12–23; solo se c'è la raccolta) |
| Home · Avvisi | tipi di avviso sempre mostrati | `avvisi()` | reso regolabile: ⚙️ «Da mostrare nella Home» (`avvisi.off`); pericoli e allarme restano sempre |
| Home · Avvisi | trigger «aggiornamento disponibile» mai creato (finiva in un commento) | `automazione()` | bug corretto |
| Home · Avvisi | elettrodomestici riconosciuti dal nome, soglia predefinita diversa dalla pagina | `elettro()`, `soglie()` | lasciato: si aggiungono e regolano nella pagina Elettrodomestici |
| Controlla HA | versione minima 2024.12 | `controlla.js` `MINIMA` | lasciato: requisito tecnico |
| Novità | tipi seguiti, 5 s di attesa, 6 suggeriti | `novita.js` | lasciato: logica interna; l'utente decide già con ✕, «Ho visto», ＋ |
| Salvaschermo | minuti, stile, velocità, informazioni, notte, attenuazione, foto | `salvaschermo.js` | già regolabile per dispositivo |
| Salvaschermo | colori delle temperature, voci per pannello | `pannelli()` | lasciato: grafica e spazio sullo schermo |

## Parte 2 — 0.7.48-dev (da Faccende in poi, più Acqua, Home, Mappa, edit.js)

| pagina | valore fisso | dove | cosa fai |
|---|---|---|---|
| Acqua e gas | contatori, portate, valvola, sensori di perdita riconosciuti da soli | `pages/acqua.js` `contatori()`, `flusso()`, `valvola()`, `sensoriPerdita()` | già regolabile (0.7.44): ⚙️ / ✏️ con ✨, 🚫, ＋, ✕ |
| Acqua e gas | perdita dopo 120 min, acqua ferma sotto 0 L/min, avviso acceso; «in uso» 10 min | `minPerdita()`, `portataMin()`, `avvisoOn()`, `minInUso()` | già regolabile (0.7.44) |
| Acqua e gas | valuta fissa EUR, «€/» nei campi dei prezzi | `euro()`, `scelte()` | presa da Home Assistant (`get_config.currency`), come in Energia e Caldaia |
| Acqua e gas | «giorno medio» sempre sugli ultimi 30 giorni | `media()` | reso regolabile: ⚙️ «Giorno medio» 7/14/30/60/90 giorni (`acqua.mediaGiorni`), vale anche in Home |
| Acqua e gas | periodo dello Storico torna a «Settimana» | `VS` | ricordato per dispositivo (`aqStor`) |
| Acqua e gas | «Portata del gas» senza spiegazione | `VOCI()` | aggiunta la riga di aiuto |
| Acqua e gas | 12 L/min = rubinetto aperto, 40 L/min di gas = caldaia al massimo; ±3% «come un giorno medio»; gas «in uso» appena la portata supera 0 | `adesso()`, `pannello()`, `qta()` | lasciato: grafica e impaginazione |
| Auto | comando di ricarica riconosciuto dal nome (interruttore o pulsanti avvia/ferma) | `pages/auto.js` `comandi()` | reso regolabile: ✏️ → «Sensori e comandi» → «Comando della ricarica» con ✨, un'entità qualsiasi o 🚫 (`cars[dev].sensori.ricCmd`); con 🚫 l'interruttore torna in «Altri comandi» |
| Auto | gomme sempre mostrate | `scheda()` | reso regolabile: ✏️ → «Mostra la pressione delle gomme», con i valori di adesso (`cars[dev].noGomme`) |
| Auto | tutte le auto nella scheda della Home | `homeCard()` | reso regolabile: ✏️ → «Mostra nella scheda «Auto» della Home» (`cars[dev].noHome`) |
| Auto | clima a passi fissi di 0,5° | `carTemp` | ora usa passo e limiti dell'integrazione (`target_temp_step`, `min_temp`, `max_temp`), 0,5° se mancano |
| Auto | pagina per l'amministratore senza auto riconosciute | `page(... show)` | rinviato alla 0.7.49 («Cosa puoi aggiungere»), che tratta proprio le pagine che non compaiono |
| Auto | pulsanti wake/refresh esclusi da «Altri comandi»; foto Wikipedia tenuta 30 giorni | `comandi()`, `fotoWiki()` | lasciato: tecnica interna |
| Faccende | 5 faccende nella scheda della Home | `pages/faccende.js` `homeCard()` | reso regolabile: ⚙️ della pagina (e della scheda in Home) → «Faccende nella scheda della Home», 1–12 (`faccende.inHome`) |
| Faccende | in Home solo quelle di oggi e in ritardo | `homeCard()` | reso regolabile: ⚙️ «Mostra in anticipo» domani, 2, 3 o 7 giorni (`faccende.anticipo`) |
| Faccende | 12 voci di storia, 150 faccende, esempi, giorni rapidi | `MAX_STORIA`, `MAX_LAVORI`, `ESEMPI` | lasciato: limiti dei dati salvati; «Ogni quanti giorni» accetta già 1–365 |
| Formula 1 | sensori di F1 Sensor riconosciuti dagli attributi (prossima gara, classifiche, ultima gara, piloti, ordine in pista, stato, bandiere, safety car, giro, tempo, direzione gara) | `pages/formula1.js` `fonti()` | reso regolabile: ⚙️ → «Sensori di F1 Sensor», per ogni voce ✨, un'entità adatta o 🚫, col valore di adesso (`f1.sensori`) |
| Formula 1 | calendari e Team Tracker riconosciuti dal nome | `isCalF1`, `isTTF1` | già regolabile (✕, ＋, ↺); aggiunta una riga di spiegazione |
| Formula 1 | avvisi solo dal primo calendario | `automazione()` | ora un trigger per ogni calendario in uso; il 📱 dice quali |
| Formula 1 | tutte le sezioni sempre visibili | `pagina()` | reso regolabile: ⚙️ «Cosa mostrare»: programma, in pista, piloti, costruttori, ultima gara (`f1.off`) |
| Formula 1 | 10 righe in classifica e in pista, podio + 7 nell'ultima gara; 3 messaggi della direzione gara | `pilotiCard`, `weekendCard`, `ultimaCard` | reso regolabile: ⚙️ «Righe» 5–20 o tutte (`f1.righe`; il preferito resta visibile) e messaggi 1/3/5/10 (`f1.rc`) |
| Formula 1 | avviso 15 minuti prima | `automazione()` | reso regolabile: 📱 «Quanti minuti prima», 1–180 (`f1.notif.min`) |
| Formula 1 | l'automazione «'Nduja · Formula 1» non si aggiornava cambiando le fonti | `salva` | ora si riscrive da sola quando cambiano trigger o telefoni (`f1.notif.firma`) |
| Formula 1 | durate delle sessioni da calendario, finestra «in corso» di 3 h, calendario −6/+150 giorni | `DUR`, `dati()`, `eventiCal` | lasciato: tecnica interna |
| Formula 1 | la pagina compare solo se trova una fonte | `page(... show)` | rinviato alla 0.7.49 («Cosa puoi aggiungere») |
| Home | 6 scene sotto il saluto | `pages/home.js` `riepilogo()` | reso regolabile: ✏️ Modifica → ⚙️ di «Saluto e orologio» → «Scene sotto il saluto», 0–12 (`home.scene`) |
| Home | 5 giorni di previsione nella scheda Meteo | `meteo()` | reso regolabile: ⚙️ del Meteo, 3–7 (`home.meteoGiorni`) |
| Home | sensori della finestra della stanza scelti per device_class, al massimo 12, senza correzione | `schedaStanza()` | reso regolabile: ✏️ della stanza → «Sensori nella finestra della stanza» con ✕, ↩︎ e ＋, col valore di adesso (`roomSens[stanza] = { add, hide }`) |
| Home | schede aggiunte da altre pagine senza ⚙️ | `SCHEDE()` | `HOME_EXTRA.<k>.cfg` (facoltativo) mette ⚙️ sulla scheda in ✏️ Modifica; usato da Faccende |
| Home · Avvisi | l'automazione «'Nduja · avvisi» prendeva i sensori di pericolo con una sua lista | `avvisi.js` `automazione()` | ora segue ⚙️ della Sicurezza (`sicurezza.noPericoli`, `sicurezza.pericoli`) |
| Home | orari del saluto, 3 aperture citate nel riepilogo | `saluto()`, `riepilogo()` | lasciato: testo e impaginazione |
| Impostazioni | «Plancia semplice»; bozza della procedura guidata 30 giorni | `usSemplice`, `bozza()` | lasciato: scelta rapida, poi si regola voce per voce / tecnica interna |
| Irrigazione | zone riconosciute da nome, valvole `water` e integrazioni; aspetto dal nome; programmi da sospendere | `pages/irrigazione.js` `eZona()`, `gocciaDaNome()`, `pausabili()` | già regolabile: ✏️ ＋ zona, «Non è una zona», ↺, «Aspetto», ＋/✕ programmi (`irrig.zone`, `tolte`, `aspetto`, `pausa`, `noPausa`) |
| Irrigazione | «piove» = icona di pioggia o probabilità ≥ 60% o ≥ 2 mm, solo per domani | `pioggiaDomani()`, `programmi()` | reso regolabile: ⚙️ su «Programmi e meteo» → probabilità, millimetri, icona sì/no, domani o le prossime 3–48 ore (`irrig.pioggiaPr`, `pioggiaMm`, `icona`, `pioggiaOre`), con la previsione di adesso; vale anche in Home |
| Irrigazione | pausa per pioggia fino a domani alle 23:59 | `finePausa()` | reso regolabile: ⚙️ «Fino a» da domani a 7 giorni e «Alle» (`irrig.pausaGiorni`, `pausaOra`) |
| Irrigazione | orari dei programmi | `programmi()` | aggiunto «🕒 Orari» sulle automazioni che irrigano (costruttore della plancia o editor di HA); quelli delle integrazioni restano nell'integrazione. Un calendario settimanale della plancia sarebbe una funzione nuova |
| Irrigazione | durata di partenza 10 min solo per dispositivo; pulsanti 5·10·15·30 | `durata()`, `DUR` | reso regolabile: ⚙️ «Durata di partenza» (`irrig.durata`), ✏️ della zona (`irrig.durate[id]`), «Pulsanti rapidi» 2–6 numeri (`irrig.rapidi`) |
| Irrigazione | terreno secco sotto il 25%, bagnato sopra il 60%; sensori del terreno presi da soli | `programmi()`, `terreno()` | reso regolabile: ⚙️ soglie col valore di adesso (`irrig.secco`, `zuppo`) e sensori con ✕ ↺ ＋ (`irrig.terreno`, `noTerreno`) |
| Irrigazione | calendari dei programmi riconosciuti da integrazione o nome | `calendari()` | reso regolabile: ⚙️ con ✕ ↺ ＋ (`irrig.calendari`, `noCal`) |
| Irrigazione | script «'Nduja · irrigazione» e automazione di sicurezza da aggiornare a mano quando cambiano le zone | `preparaTimer()` | ora si riscrivono da soli quando un amministratore apre la pagina; la prima creazione resta un pulsante |
| Irrigazione | tolleranza 45 s, al massimo 240 min; terreno che si asciuga in 2 ore; voci in Home | `scriptCfg()`, `bagnato()`, `homeCard()` | lasciato: tecnica interna e impaginazione |
| La mia squadra | squadre e fonti unite da sole per nome; un calendario sempre squadra a sé | `pages/squadra.js` `rileva()` | reso regolabile: ✏️ → «Fonti» con «＋ Unisci un'altra fonte», ✕ e ↺ (`cfg.<k>.con`, `cfg.<k>.via`) |
| La mia squadra | classifica di Calcio Live scelta da sola | `classifica()` | reso regolabile: ✏️ «Classifica» automatica / una qualsiasi / nessuna (`cfg.<k>.classifica`) |
| La mia squadra | 5 ultimi risultati; «Appena finita» per 5 ore; classifica intera; sezioni sempre visibili | `squadre()`, `classificaCard`, `eroe` | reso regolabile: ⚙️ risultati 3–10 (`squadra.ultimi`), ore 0–24 (`finitaOre`), righe intorno alla squadra (`righeCl`), «Cosa mostrare» (`off`) |
| La mia squadra | tutte le squadre nella scheda della Home | `homeCard` | reso regolabile: ✏️ «Mostra nella Home» (`cfg.<k>.home`) |
| La mia squadra | l'automazione «'Nduja · squadra» restava ferma quando cambiavano squadre o fonti | `salvaSq` | ora si riscrive dopo ogni salvataggio e quando una squadra compare o sparisce da sola |
| La mia squadra | aggiungere/togliere squadre, nome, sigla e colori | `sqAdd`, `sqTogli`, `sqSalva` | già regolabile; «Salva» non cancella più le altre scelte della squadra |
| La mia squadra | la pagina compare solo se trova una squadra | `page(... show)` | rinviato alla 0.7.49 |
| Liste | 6 voci nella scheda della Home | `pages/liste.js` `homeCard()` | reso regolabile: ⚙️ «Voci nella scheda della Home», 3–20 (`liste.inHome`) |
| Liste | suggerimenti di partenza della spesa sempre presenti | `SPESA_BASE` | reso regolabile: ⚙️ acceso/spento (`liste.base = false`) |
| Liste | liste visibili, spesa riconosciuta, reparti, vista | `spesaAuto()`, `repartoDi()` | già regolabile |
| Liste | ora 09:00 se manca; 150 voci imparate, 500 reparti | `lsSalva`, `MAX_USO` | lasciato: il campo dell'ora è lì accanto / limiti dei dati |
| Luci | scene di luce riconosciute dal nome o dalle luci comandate | `pages/luci.js` `sceneLuce()` | reso regolabile: ✏️ ✕ toglie, «＋ Scena» aggiunge, ↩︎ rimette (`lightScenes = { add, hide }`) |
| Luci | interruttori che «sembrano luci» | `foglioAggiungi()` | lasciato: decide solo l'ordine dei suggerimenti |
| Mappa | temperatura, aperture, movimento e clima sempre mostrati nelle stanze | `pages/mappa.js` `stanza()`, `vista3d()` | reso regolabile: ✏️ → ⚙️ «Cosa mostrare nelle stanze», 2D e 3D (`mapShow`) |
| Mappa | pericoli per device_class | `stanza()` | ora segue ⚙️ della Sicurezza (`sicurezza.noPericoli`, `sicurezza.pericoli`) |
| Mappa | griglia di 12 colonne, stanze «grandi» dal nome | `COL`, `GRANDE` | lasciato: grafica; le misure si cambiano con ⇠ ⇢ ⇡ ⇣ |
| Media | TV o cassa decisa solo dal riconoscimento automatico | `core.js` `isTV()`, `pages/media.js` `schermi()` | reso regolabile: ✏️ → «🔊 È una cassa», «＋ Una TV che non ho riconosciuto», «Spostate in Musica» con ↩︎ (`mdTv`); vale anche per Musica e Novità |
| Media | tutte le app sempre mostrate | `apps()` | reso regolabile: ✏️ tocco sull'app per toglierla o rimetterla, per schermo (`mdApp`) |
| Media | tasti del telecomando | `P`, `azione()` | già regolabile (`mdTasti`) |
| Media | 3 TV in Home, volume ±5%, 1,5 s dopo l'accensione | `homeCard()`, `azione()` | lasciato: impaginazione / comando / tecnica interna |
| Meteo | pioggia «probabile» dal 50% | `pages/meteo.js` `adesso()`, `prossimiGiorni()` | reso regolabile: ⚙️ «Previsione della pioggia» 20–80% (`meteo.pioggiaPr`), col massimo delle prossime 24 ore |
| Meteo | sensori, allerte, radar; meteo e ore per dispositivo | `sensore()`, `fonti()` | già regolabile |
| Meteo | soglie di pressione, scale UV/Beaufort/visibilità, colori | `tessere()` | lasciato: scale standard / grafica |
| Musica | «Dove ascolti» e «Sposta su…» con tutte le casse | `pages/musica.js` `casse()`, `destinazioni()` | reso regolabile: ⚙️ un interruttore per cassa (`musica.noDove`) |
| Musica | 3 lettori nella scheda della Home; consiglio di Music Assistant sempre | `musicaCard()`, `scelta()` | reso regolabile: ⚙️ 1–6 (`musica.inHome`), consiglio sì/no (`musica.noMA`) |
| Musica | TV riconosciute da sole | `core.js` `isTV()` | reso regolabile dalla pagina Media («È una cassa», `mdTv`) |
| Musica | ricerca, Sfoglia, coda: quante voci | `cercaMA()`, `BR.quanti` | lasciato: impaginazione, c'è «Mostra altri» |
| Piante | se domani piove il promemoria delle piante di fuori slitta sempre | `pages/piante.js` `pioggiaDomani()`, `automazione()` | reso regolabile: ⚙️ «Se domani piove, aspetta ad annaffiare» (`piante.pioggia.slitta`); l'automazione «'Nduja · piante» si riscrive da sola |
| Piante | non si vedeva quale meteo era usato | `impostazioni()` | aggiunta la riga con meteo usato e previsione di domani |
| Piante | soglie pioggia e pila, avvisi, promemoria, soglie per pianta, tipo, dentro/fuori, piante trovate | `prMin()`, `DEF`, `indovina()`, `trovate()` | già regolabile (0.7.46) |
| Piante | luce ignorata col sole basso; limiti dei dati | `letture()`, `MAX` | lasciato: evita falsi avvisi / limiti dei dati |
| Rete | barre di CPU, RAM e disco arancioni dal 75%, rosse dal 90% | `pages/rete.js` `metro()` | reso regolabile: ✏️ → «📊 Soglie e avvisi», col valore più alto di adesso (`rete.soglie`) |
| Rete | «spento» segnalato solo per modem, server, NAS e Raspberry | `homeCard()`, `badge` | reso regolabile: ✏️ del dispositivo → «Avvisami se è spento» (`rete.avvisa`) |
| Rete | pulsanti Accendi, Riavvia, Spegni dal nome | `ruoli()` | reso regolabile: ✏️ → «Pulsanti» con ✨, entità o 🚫 (`rete.sens[d].accendi/riavvia/spegni`) |
| Rete | velocità massima della linea e «connesso da» dal nome; tensione dell'UPS dal nome, «🚫 Nessuno» non funzionava sull'UPS | `internetOra()`, `upsInfo()` | reso regolabile (`rete.inet.maxDown/maxUp/daQuando`, `rete.sens[ups].tensione`); bug corretto |
| Rete | grafico dello speedtest di 7 giorni | `cardSpeedtest()` | reso regolabile: 7 o 30 giorni, per dispositivo (`rtSpGiorni`) |
| Rete | voci in vista, anello dell'UPS, tempi della prova | `cardCollegati()`, `cardUps()`, `rtSpeed` | lasciato: impaginazione / grafica / tecnica interna |
| Robot | ricambi rossi sotto il 15%, arancioni sotto il 35% | `pages/robot.js` `robot()` | reso regolabile: ✏️ «Da cambiare sotto (%)» (`vacuums[id].ricambi`) |
| Robot | sensori di manutenzione presi tutti | `manutenzione()` | reso regolabile: ✏️ una spunta per ognuno (`vacuums[id].noManut`) |
| Robot | pulizia per stanza con una sola passata | `pulisciStanze()` | reso regolabile: ✏️ 1–3 passate con Dreame e Roborock (`vacuums[id].passate`) |
| Scadenze | 3 scadenze nella scheda della Home | `pages/scadenze.js` `homeCard()` | reso regolabile: ⚙️ 1–10 (`scadenze.inHome`) |
| Scadenze | negli Avvisi solo scadute e di oggi | `VISTE.scadenzeAvvisi` | reso regolabile: ⚙️ mai / oggi / domani / 3 / 7 giorni (`scadenze.avvisi`) |
| Scadenze | promemoria solo il giorno, 1, 3 o 7 giorni prima | `schedaProm()` | reso regolabile: «Altro: N giorni prima» (1–365) |
| Scadenze | l'automazione non seguiva i telefoni nuovi delle persone scelte | `controllaTelefoni()` | ora si riscrive da sola se i telefoni cambiano |
| Scadenze | 7 categorie fisse; gruppo «Prossimi 7 giorni» | `CAT()`, `gruppo()` | lasciato: le categorie sono scritte nella descrizione e lette dall'automazione |
| Sicurezza | sensori di pericolo solo dalla device_class (fumo, gas, CO, acqua, safety, tamper) | `pages/sicurezza.js` `sensoriPericolo()` | reso regolabile: ⚙️ «Sensori di pericolo» con la spunta e lo stato di adesso (`sicurezza.noPericoli`) e «＋ Aggiungi» (`sicurezza.pericoli`); vale in Home, Avvisi, Mappa e sul telefono |
| Sicurezza | un sensore tolto con ✕ non si poteva più rimettere | `pagina()` | bug corretto: ⚙️ «Tolti dalla pagina» con ↺ |
| Sicurezza | 12 sensori di movimento; tutte le telecamere | `pagina()`, `telecamereCard()` | reso regolabile: ⚙️ 4–40 o nessuno (`sicurezza.movimenti`), tutte / un gruppo / nessuna (`sicurezza.camere`) |
| Sicurezza · Accessi | impulso fisso di 1 s; tutti gli accessi in Home | `comando()`, `homeCard()` | reso regolabile: ✏️ «Durata dell'impulso» 0,2–10 s (`accessi.voci[id].impulso`), «Nella scheda della Home» (`accessi.voci[id].home`) |
| Sicurezza | modi dell'allarme, codice, doppio tocco | `MODI()`, `sicuro()` | lasciato: dipende dal dispositivo / tecnica interna |
| Tapparelle | lati del sole fissi, casa dritta verso i punti cardinali | `pages/tapparelle.js` `AZ`, `cfgCaldo()` | reso regolabile: Automatismi → caldo → «Correggi l'orientamento della casa», −45…+45° (`tapparelle.auto.caldo.rot`); l'automazione si riscrive da sola |
| Tapparelle | «Sole alto almeno» senza spiegazione | `schedaAuto()` | aggiunta la riga di aiuto |
| Tapparelle | riconoscimento, aspetto, lati, finestra, «Metà», ritardi, soglie del caldo | `eTapparella()`, `AUTO_DEF()` | già regolabile (0.7.42) |
| Telecamere | doppioni nascosti, flussi e metodi, anteprime, gruppi, ordine | `pages/telecamere.js`, `video.js` | già regolabile |
| Telecamere | anteprime ogni 10 s, foto ogni 2 s | `video.js` | lasciato: tecnica interna |
| edit.js | elenco di scelta di 200 voci; in ＋ solo porte e finestre tra i binary_sensor | `chooser()`, `candidati()` | lasciato: tecnica interna; i sensori di pericolo si aggiungono da ⚙️ della Sicurezza |

## Riepilogo delle due parti

**Reso regolabile in 0.7.47:** regole degli Avvisi della Home (porta aperta, pioggia, «ha finito», telefono scarico, raccolta, avvisi mostrati), sensori, auto e comandi dell'Auto, backup degli Aggiornamenti, icone e «domattina» delle Automazioni, messaggi della Bacheca, consigli, stanze di fuori e dispositivi dell'Aria, soglie e telefoni delle Batterie, allarmi, manutenzione e prezzo del gas della Caldaia, colori e Agenda del Calendario, sensori ed elenchi dell'Energia.

**Reso regolabile in 0.7.48:** pioggia, pausa, durate, terreno e calendari dell'Irrigazione; sensori, sezioni, righe e preavviso della Formula 1; fonti, classifica e sezioni della Squadra; sensori di pericolo, movimento, telecamere e accessi della Sicurezza (seguiti anche da Avvisi, Mappa e telefono); TV/casse e app dei Media; soglie, pulsanti e sensori della Rete; ricambi e passate del Robot; Home e Avvisi delle Scadenze; scene, meteo e sensori delle stanze in Home; scene delle Luci; cosa mostra la Mappa; Faccende in Home; orientamento delle Tapparelle; casse e lettori della Musica; slittamento delle Piante; Liste, Meteo e Acqua. Le automazioni create dalla plancia (avvisi, irrigazione, Formula 1, squadra, piante, scadenze, tapparelle) si riscrivono da sole quando cambiano le scelte.

**Resta fisso, e perché:**
- grafica e impaginazione (colori delle scale, quante voci stanno in una scheda quando c'è già «mostra altri», animazioni);
- tecnica interna (tempi di rete e di attesa, tolleranze degli script, limiti dei dati salvati);
- scale standard (UV, Beaufort, pressione) e condizioni che non dipendono dalla casa;
- comandi del dispositivo (passi e limiti dati dall'integrazione).

**Rinviato alla 0.7.49 («Cosa puoi aggiungere»):** le pagine che non compaiono senza dispositivi riconosciuti (Auto, Formula 1, La mia squadra, Media senza TV): la scheda 0.7.49 tratta proprio questo.

**Da decidere con Giovanni:** un calendario settimanale dei programmi dell'Irrigazione fatto dalla plancia (oggi gli orari stanno nelle automazioni o nell'integrazione).

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
| Auto | si aggiunge a mano un'auto solo se ce n'è già una riconosciuta | `page(... show)` | da fare (parte 2, «Auto» è tra gli esempi di Giovanni): far comparire la pagina a tutti gli amministratori senza auto cambierebbe quello che vedono adesso; va pensato insieme a «Cosa puoi aggiungere» (0.7.49) |
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

## Parte 2 — 0.7.48-dev (da Faccende in poi, Home, Mappa, edit.js)

Da fare con la scheda 0.7.48-dev. Resta da qui: Acqua (non era nella parte 1), Irrigazione, Formula 1, La mia squadra, la pagina Auto senza auto riconosciute.

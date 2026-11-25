# Verso la 0.8.0 — controllo finale delle anteprime

Preparato con la 0.7.57-dev (25 novembre 2026), rileggendo le schede in `docs/sviluppo/`, la ROADMAP, il CHANGELOG e i tag GitHub.
Serve a Giovanni per decidere quando pubblicare la **0.8.0** ufficiale.

## 1. Cosa è stato fatto
Tutte le anteprime della tabella della ROADMAP sono uscite, ognuna con il suo tag (`v0.7.11-dev` … `v0.7.57-dev`) e la sua sezione nel CHANGELOG.

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
**Da fare (piccolo)**
- **Luci come scheda oggetto** (0.7.56, punto A3 «se avanza tempo»): non fatta. La lampada disegnata con il colore e la luminosità veri; oggi le luci aprono ancora il loro pannello.
- **Prova su un Home Assistant vero** dei percorsi della guida (Marketplace, interruttore Pre-release): i disegni della guida seguono il README, ma il Marketplace della 2026.11 va confrontato con le schermate reali e, se serve, ritoccato.

**Da verificare (dubbi del controllo, probabilmente a posto)**
- 0.7.36 Rete: «Sky WiFi» non è citato nel CHANGELOG. · 0.7.37 Caldaia: Beretta e Riello non sono citate.
- 0.7.49: «La mia squadra» e «Media senza TV» erano rinviate qui da AUTONOMIA.md, ma il CHANGELOG non le nomina in «Cosa puoi aggiungere».
- 0.7.52: per lo sfondo «immagine tua» la scheda chiedeva «sfoca e scurisci»; il CHANGELOG cita la sfocatura e il velo.
- 0.7.53: telecamere e sensori tra i dispositivi trascinabili sulla mappa non sono nominati.

**Da decidere con Giovanni**
- Calendario settimanale dei programmi dell'Irrigazione (in AUTONOMIA.md come «da decidere»).
- **In auto: CarPlay e Android Auto**, in standby (`standby/in-auto-carplay.md`): si farà con l'app 'Nduja dopo la 0.8.0.
- App per iPhone/iPad (`docs/app/PIANO.md`): Apple Developer Program, permesso CarPlay, nome dell'app, versione Plus e aspetti fiscali sono tutti aperti. Il piano dice prima «repository privato» e poi «pubblico» (parte «open core»): da chiarire.

**Pulizie della documentazione (si possono fare con la 0.8.0)**
- ROADMAP: la tabella cita solo la 0.7.22-dev1 tra le correttive; la riga 0.7.55 dice solo «lavatrice» (sono lavatrice, asciugatrice e lavastoviglie).
- Rimasugli della vecchia numerazione nelle schede: la 0.7.18 dice «Prima: 0.7.17-dev» (dalla 0.7.12 alla 0.7.17 non ci sono versioni), la 0.7.22 cita «l'evento della 0.7.14» (è la 0.7.21), la scheda in standby cita «Accessi della 0.7.13» (sono della 0.7.20).

## 4. Per pubblicare la 0.8.0
1. Versione `0.8.0` in `const.py` e `manifest.json` (senza `-dev`: il workflow crea una release normale, che arriva a tutti).
2. CHANGELOG: una sezione `## 0.8.0` che riassume le anteprime (la tabella sopra è una buona traccia); togliere dal README la riga sulle anteprime `-dev` se non serve più.
3. ROADMAP: «0.8.0 ✅ pubblicata».
4. Dopo l'uscita, chi ha la 0.7.10.x riceve l'aggiornamento: alcune funzioni (Faccende, Bacheca, Chat, Colpo d'occhio, Piante) chiedono un **riavvio di Home Assistant**; conviene scriverlo in grande nelle note della release.

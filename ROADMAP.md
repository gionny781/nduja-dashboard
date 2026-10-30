# 🌶️ 'Nduja Dashboard — roadmap

## 0.5.0-beta ✅ pubblicata
- [x] Barra di navigazione: **sempre visibile** o **a scomparsa** (scelta per dispositivo, in ⚙️ Impostazioni)
- [x] Meteo: scelta automatica del meteo di casa (scartare meteo di altri posti, es. F1) + ✏️ sulla scheda Meteo
- [x] Temperatura stanze: scartare caldaie (mandata/ritorno/setpoint), temperature interne dei dispositivi, CPU, batterie
- [x] **Persone**: sezione per inserire e configurare le persone di casa (es. Giovanni, Caterina…): scegliere la persona, foto, telefono collegato (batteria, in carica), distanza e tempo di rientro, da quanto è fuori — in ⚙️ Impostazioni e con ✏️ Modifica
- [x] **Calendario**: prossimi impegni dai calendari di Home Assistant (scegli quali), vista oggi / settimana, aggiunta di un evento
- [x] **Raccolta differenziata**: cosa si espone stasera e domani (da calendario o sensori), con promemoria nella Home
- [x] Avvisi intelligenti nella Home (lavatrice finita, finestra aperta col clima acceso, batteria scarica…)
- [x] File ricaricati quando cambiano davvero (per provare «main» senza problemi di cache)

## 0.6.0-beta ✅ pubblicata
- [x] Robot aspirapolvere
- [x] Telecamere
- [x] Sicurezza (allarme, serrature, porte, fumo/gas/acqua, movimento)

## 0.7.0-beta ✅ pubblicata
- [x] Mappa della casa dalle aree, modificabile, con piantina sotto

## 0.7.10-beta ✅ pubblicata
- [x] Procedura guidata che riprende da dove eri, «Salta per ora» e «Annulla», riepilogo della modalità automatica

## 0.7.10.4 ✅ pubblicata
- Nell'app la plancia riprova a collegarsi dopo un cambio di rete.

## 0.7.10.3 ✅ pubblicata
- Plancia più fluida sui telefoni (meno ridisegni quando i sensori cambiano spesso).

## 0.7.10.2 ✅ pubblicata
- Collegamento diretto della plancia per l'app 'Nduja (iPhone/iPad).

## 0.7.10.1 ✅ pubblicata
- [x] Pagina Auto (solo per chi ha un'auto in Home Assistant), foto automatica, scheda nella Home
- [x] hls.js incluso con le sue licenze

## Anteprime verso la 0.8.0
Le novità escono una alla volta come **anteprime** (`0.7.x-dev`, pre-release: HACS le mostra solo a chi attiva «Mostra versioni beta»).
Quando tutto sarà perfetto uscirà la **0.8.0** ufficiale. Le schede di lavoro sono in `docs/sviluppo/`.

| Anteprima | Quando | Contenuto |
|---|---|---|
| 0.7.11-dev ✅ | gio 22 ott | Novità in casa: avviso dei dispositivi nuovi, suggeriti in ＋ Aggiungi |
| 0.7.18-dev ✅ | ven 23 ott | Elettrodomestici animati o con le tue immagini |
| 0.7.19-dev ✅ | ven 23 ott | Controlla Home Assistant, schermata d'errore chiara, etichetta «'Nduja» |
| 0.7.20-dev ✅ | sab 24 ott | Sicurezza: scheda Accessi (cancello, cancelletto, garage, portone) |
| 0.7.21-dev ✅ | lun 26 ott | Faccende (e dati condivisi tra tutti gli utenti) |
| 0.7.22-dev ✅ | lun 26 ott | Bacheca |
| 0.7.22-dev1 ✅ | lun 26 ott | Automazioni come tasti, con pausa (chiesta da Giovanni) |
| 0.7.23-dev ✅ | lun 26 ott | Telecamere in diretta (WebRTC → HLS → MJPEG → foto) |
| 0.7.24-dev ✅ | lun 26 ott | Telecamere: scelta dei flussi, aggiungi/togli, gruppi |
| 0.7.25-dev ✅ | lun 26 ott | Clima animato o con le tue immagini |
| 0.7.26-dev ✅ | lun 26 ott | Energia: scena animata con sole, meteo, casa ed elettrodomestici |
| 0.7.27-dev ✅ | lun 26 ott | Luci rifatte |
| 0.7.28-dev ✅ | lun 26 ott | Musica: ascolta su questo dispositivo, Alexa, Google, Sonos |
| 0.7.29-dev ✅ | lun 26 ott | Musica: Music Assistant e «Sposta su…» |
| 0.7.30-dev ✅ | gio 29 ott | Media: TV, telecomando virtuale, app di streaming |
| 0.7.31-dev ✅ | gio 29 ott | Irrigazione animata |
| 0.7.32-dev ✅ | gio 29 ott | La mia squadra (calcio) |
| 0.7.33-dev ✅ | ven 30 ott | Formula 1 |
| 0.7.34-dev ✅ | ven 30 ott | Salvaschermo nuovo (della plancia, tuo o automatico) |
| 0.7.35-dev ✅ | ven 30 ott | Batterie |
| 0.7.36-dev ✅ | ven 30 ott | Rete e server (modem, mini PC, NAS, UPS) |
| 0.7.37-dev ✅ | ven 30 ott | Caldaia |
| 0.7.38-dev ✅ | ven 30 ott | Chat di famiglia |
| 0.7.39-dev ✅ | ven 30 ott | Liste: spesa e cose da fare |
| 0.7.40-dev | dom 1 nov | Scadenze e promemoria |
| 0.7.41-dev | mar 3 nov | Meteo completo |
| 0.7.42-dev | gio 5 nov | Tapparelle e tende |
| 0.7.43-dev | sab 7 nov | Qualità dell'aria |
| 0.7.44-dev | lun 9 nov | Acqua e gas |
| 0.7.45-dev | mer 11 nov | Assistente vocale (Assist) |
| 0.7.46-dev | ven 13 nov | Piante e giardino |
| 0.7.47-dev | dom 15 nov | Guida all'installazione illustrata e controllo finale |
| 0.7.48-dev | mar 17 nov | In auto: comandi per CarPlay e Android Auto |
| 0.7.49-dev | gio 19 nov | Autonomia (1): tutto regolabile dalla plancia — da Aggiornamenti a Energia |
| 0.7.50-dev | sab 21 nov | Autonomia (2): tutto regolabile dalla plancia — da Faccende in poi |
| 0.7.51-dev | lun 23 nov | «Cosa puoi aggiungere»: la plancia dice cosa manca e come attivarlo |

## Dopo
- 0.8.0 — versione ufficiale con tutte le anteprime, guida COME_INSTALLARE con foto, ritocchi
- 1.0 — via «beta», segnalazione all'elenco ufficiale HACS

## Dopo la 0.8.0
- 📱 **App 'Nduja per iPhone, iPad e CarPlay**: piano in [docs/app/PIANO.md](docs/app/PIANO.md).

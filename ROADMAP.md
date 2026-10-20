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

## 0.7.10.1 ✅ pubblicata
- [x] Pagina Auto (solo per chi ha un'auto in Home Assistant), foto automatica, scheda nella Home
- [x] hls.js incluso con le sue licenze

## Anteprime verso la 0.8.0
Le novità escono una alla volta come **anteprime** (`0.7.x-dev`, pre-release: HACS le mostra solo a chi attiva «Mostra versioni beta»).
Quando tutto sarà perfetto uscirà la **0.8.0** ufficiale. Le schede di lavoro sono in `docs/sviluppo/`.

| Anteprima | Quando | Contenuto |
|---|---|---|
| 0.7.11-dev | gio 22 ott | Novità in casa: avviso dei dispositivi nuovi, suggeriti in ＋ Aggiungi |
| 0.7.12-dev | sab 24 ott | Controlla Home Assistant, schermata d'errore chiara, etichetta «'Nduja» |
| 0.7.13-dev | lun 26 ott | Sicurezza: scheda Accessi (cancello, cancelletto, garage, portone) |
| 0.7.14-dev | mer 28 ott | Faccende (e dati condivisi tra tutti gli utenti) |
| 0.7.15-dev | ven 30 ott | Bacheca |
| 0.7.16-dev | dom 1 nov | Telecamere in diretta (WebRTC → HLS → MJPEG → foto) |
| 0.7.17-dev | mar 3 nov | Telecamere: scelta dei flussi, aggiungi/togli, gruppi |
| 0.7.18-dev | gio 5 nov | Elettrodomestici animati o con le tue immagini |
| 0.7.19-dev | sab 7 nov | Clima animato o con le tue immagini |
| 0.7.20-dev | lun 9 nov | Energia: scena animata con sole, meteo, casa ed elettrodomestici |
| 0.7.21-dev | mer 11 nov | Luci rifatte |
| 0.7.22-dev | ven 13 nov | Musica: ascolta su questo dispositivo, Alexa, Google, Sonos |
| 0.7.23-dev | dom 15 nov | Musica: Music Assistant e «Sposta su…» |
| 0.7.24-dev | mar 17 nov | Media: TV, telecomando virtuale, app di streaming |

## Dopo
- 0.8.0 — versione ufficiale con tutte le anteprime, guida COME_INSTALLARE con foto, ritocchi
- 1.0 — via «beta», segnalazione all'elenco ufficiale HACS

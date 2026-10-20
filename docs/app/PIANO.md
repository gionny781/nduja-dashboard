# App 'Nduja per iPhone, iPad e CarPlay: piano

Il lavoro comincia **dopo la 0.8.0 ufficiale**. La 0.8.0 esce solo quando Giovanni dà l'ok, dopo aver provato tutte le anteprime.

## Com'è fatta
- **iPhone e iPad**: app nativa in SwiftUI.
  - Dentro mostra la plancia 'Nduja vera, sempre aggiornata, perché arriva da Home Assistant.
  - Intorno ha le parti native:
    - accesso con il login di Home Assistant;
    - passaggio automatico tra indirizzo di casa e indirizzo remoto;
    - schermo intero;
    - icona 'Nduja.
- **Widget** per la schermata Home, la schermata di blocco e, se Apple li accetta, CarPlay: stati e tasti rapidi.
- **Siri e Comandi rapidi** (App Intents): «Ehi Siri, apri il cancello con 'Nduja».
- **CarPlay**: schermate native Apple, a griglia e a elenco.
  - Mostra i comandi «In auto» preparati dalla plancia (0.7.42) e gli stati principali: cancello, garage, allarme, clima, auto elettrica.
  - Non è possibile mostrare la plancia web: lo vieta Apple.
- Le notifiche push restano all'app ufficiale Home Assistant, perché richiederebbero un server nostro.

## Cosa serve
| Cosa | Stato | Serve per |
|---|---|---|
| Mac con Xcode | ✅ c'è | scrivere, compilare e provare l'app |
| Account Apple gratuito / beta sviluppatore | ✅ c'è | installare l'app sul proprio iPhone/iPad via cavo (il profilo scade ogni 7 giorni) |
| Apple Developer Program (99 €/anno) | ❌ da fare | permesso CarPlay, TestFlight, App Store |
| Permesso CarPlay da Apple (categoria «driving task») | ❌ da chiedere | far comparire l'app in auto; Apple può metterci settimane |

## Fasi
1. **Base iPhone/iPad**: login, plancia, indirizzi locale/remoto, icona. Prova con il cavo, basta l'account gratuito.
2. **Widget e Siri.**
3. **CarPlay**: si prova prima nel simulatore CarPlay di Xcode, poi in auto. Serve l'iscrizione a pagamento e il permesso di Apple.
4. **TestFlight** per la famiglia, poi **App Store**. Il nome dell'app non può contenere «Home Assistant» come marchio: da verificare con le regole del marchio della Open Home Foundation.

## Come lavoriamo
- Codice in un repository separato `nduja-app`.
- Claude scrive il codice e Giovanni compila con Xcode sul suo Mac. Se il Mac è collegato a Claude, la compilazione e i test si possono lanciare da lì con `xcodebuild`.
- Password e account Apple li inserisce sempre Giovanni.

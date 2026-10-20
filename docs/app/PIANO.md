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
| Mac con Xcode recente | ⚠️ il MacBook Air 2018 (Intel) si ferma a Sonoma 14: niente Xcode 26 | compilare per iOS 26 |
| Mac di GitHub Actions (cloud, gratis per repo pubblici) | ✅ scelta | compilano l'app con l'Xcode più recente; installazione sull'iPhone con Sideloadly (account gratuito) o TestFlight (account a pagamento) |
| Mac mini con chip M (facoltativo, più avanti) | da valutare | sviluppo più comodo e veloce, prove dirette da Xcode |
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

## Gratis per tutti, con un extra a pagamento una tantum
> **In sospeso:** si parte con l'app **completamente gratuita**. Il Plus a pagamento resta solo un'idea: prima di attivarlo vanno verificati i vincoli per i dipendenti pubblici (incompatibilità e autorizzazioni) con l'ufficio del personale o con un consulente.

- **Gratis per sempre:** l'app completa con la plancia, i widget base, l'accesso in casa e fuori, Face ID. La plancia su HACS resta gratuita e MIT.
- **'Nduja Plus**, acquisto unico nell'app (In‑App Purchase «non consumabile», obbligatorio per Apple). Idee:
  - CarPlay;
  - widget avanzati e schermata di blocco;
  - Live Activities (cancello che si apre, Tesla in carica);
  - Apple Watch;
  - più case;
  - icone e temi alternativi.
- **Codice «open core»:**
  - Il repository `nduja-app` è pubblico e contiene la parte gratuita.
  - Le funzioni Plus stanno in un pacchetto Swift **privato** (`nduja-app-plus`).
  - I Mac di GitHub del repository pubblico lo includono nella compilazione ufficiale con un token segreto, quindi restano gratis.
- **Commissione Apple:** 15% con lo Small Business Program, per chi incassa meno di 1 milione l'anno.
- **Da sistemare prima di vendere** (non sono consulenze legali o fiscali):
  - per le regole UE (DSA) l'App Store chiede di dichiararsi «trader» e mostra pubblicamente indirizzo, telefono ed email del venditore;
  - gli incassi vanno dichiarati; con un commercialista va valutato se serve la partita IVA.

# Changelog

> 🇮🇹 'Nduja Dashboard è in **beta**: funziona, ma può cambiare e avere difetti. Segnalali nelle Issues.
> 🇬🇧 'Nduja Dashboard is in **beta**: it works, but it may change and have bugs. Please report them in Issues.

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

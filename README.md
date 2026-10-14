# 🌶️ 'Nduja Dashboard

**A spicy, glass-style control deck for Home Assistant.**
*Una plancia in stile vetro, piccante, per Home Assistant.*

![beta](https://img.shields.io/badge/status-beta-orange.svg)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)
![Validate](https://github.com/gionny781/nduja-dashboard/actions/workflows/validate.yml/badge.svg)

![Welcome](docs/welcome.png)

![Home](docs/home.png)

![Home – light](docs/home-light.png)

> 🧪 **BETA** — 🇮🇹 la plancia è giovane: funziona, ma può cambiare e avere difetti; segnalali nelle [Issues](https://github.com/gionny781/nduja-dashboard/issues). · 🇬🇧 young project: it works, but may change and have bugs; please report them in [Issues](https://github.com/gionny781/nduja-dashboard/issues).
>
> ⚠️ **Work in progress.** Version 1.0 is being built in stages. Home, People, Calendar, Waste collection, Lights, Climate, Energy and Updates are ready; Map, Vacuum, Cameras and Security are here.

---

## 🇬🇧 English

'Nduja Dashboard adds a full-page dashboard to the Home Assistant sidebar. You don't write any YAML:
it builds itself from your **areas, floors and devices**.

**What you get**
- **Home** – greeting and a one-line summary of the house, weather with 5-day forecast, every room by floor (temperature, humidity, lights on, open windows, climate), people (photo, where they are, distance, phone battery), scenes, waste collection, today's agenda and smart *Alerts* (window open with climate on, rain coming, washing machine done, low batteries, updates). Tap a room to control everything in it.
- **Energy** – live flow (solar, grid, home, battery), today's totals and device consumption, from Home Assistant's Energy configuration.
- **Calendar** – events from your Home Assistant calendars (today, week, month) and ＋ Event.
- **Map** – every floor drawn from your areas: lights, windows, climate, motion, temperature; move and resize rooms, put your floor plan underneath.
- **Appliances** – washing machine, dryer, dishwasher, oven…: running/done, power, today's kWh, end time, plug.
- **Vacuum** – status, map, room cleaning, quick settings and maintenance. **Cameras** – live snapshots and live view. **Security** – alarm keypad, locks, doors, smoke/gas/water, motion.
- **Lights** – all lights by floor and room, brightness sliders, "turn off" per room and for the whole house.
- **Climate** – thermostats and air conditioners by room, plus a temperature/humidity overview of every room.
- **Updates** – install Home Assistant, add-on, HACS and firmware updates right from the dashboard: release notes, backup before installing, progress bar, *Install all* (Home Assistant last), skip/restore versions.
- Glass design for tablets and phones, **light, dark or automatic theme** (◐ at the top), Italian and English (follows your Home Assistant language).
- **First start**: choose **Automatic** (everything is found for you) or **Manual** (start empty and add what you want).
- **✏️ Edit on every page** (admins): ＋ Add with search, rename, move to another room, ✕ remove. **＋ New page** to create your own pages.
- **Plugs and devices** page: plugs, switches, covers, fans, TVs, locks, vacuums by room.
- **Setup wizard** (⚙️ Settings, admins only): choose rooms and their order, lights, thermostats, the temperature sensor of each room, devices, people, weather, scenes and pages. Choices are saved in Home Assistant and apply to every device.
- Pages show up only when you have the matching devices.

### Installation
1. HACS → ⋮ → **Custom repositories** → add `https://github.com/gionny781/nduja-dashboard`, category **Integration**.
2. Search **'Nduja Dashboard** in HACS → **Download**.
3. Restart Home Assistant.
4. **Settings → Devices & services → Add integration → 'Nduja Dashboard**.
5. Open **🌶️ 'Nduja** in the sidebar.

**Options** (Settings → Devices & services → 'Nduja Dashboard → Configure): sidebar name and icon, admin-only access, and the energy sensors (optional – left empty, the dashboard looks for them by itself).

### Tips
- Assign every device to an **area**, and areas to **floors**: that's what the dashboard uses to draw your house.
- Hidden entities and configuration/diagnostic entities are ignored.

---

## 🇮🇹 Italiano

'Nduja Dashboard aggiunge alla barra laterale di Home Assistant una plancia a pagina intera. Niente YAML:
si costruisce da sola dalle tue **aree, piani e dispositivi**.

**Cosa trovi**
- **Home** – saluto e riepilogo della casa in una riga, meteo con le previsioni a 5 giorni, tutte le stanze divise per piano (temperatura, umidità, luci accese, finestre aperte, clima), persone (foto, dove sono, distanza, batteria del telefono), scene, raccolta differenziata, agenda di oggi e *Avvisi* intelligenti (finestra aperta col clima acceso, pioggia in arrivo, lavatrice finita, pile scariche, aggiornamenti). Tocca una stanza per comandare tutto quello che c'è dentro.
- **Energia** – flusso in tempo reale (sole, rete, casa, batteria), totali di oggi e consumi dei dispositivi, dalla configurazione Energia di Home Assistant.
- **Calendario** – gli eventi dei calendari di Home Assistant (oggi, settimana, mese) e ＋ Evento.
- **Mappa** – ogni piano disegnato dalle aree: luci, finestre, clima, movimento, temperatura; sposta e ridimensiona le stanze, metti sotto la tua piantina.
- **Elettrodomestici** – lavatrice, asciugatrice, lavastoviglie, forno…: in funzione/finito, potenza, kWh di oggi, ora di fine, presa.
- **Robot** – stato, mappa, pulizia per stanza, impostazioni rapide e manutenzione. **Telecamere** – anteprime e diretta. **Sicurezza** – allarme col tastierino, serrature, porte, fumo/gas/acqua, movimento.
- **Luci** – tutte le luci per piano e stanza, con regolazione della luminosità, «spegni» per stanza e per tutta la casa.
- **Clima** – termostati e condizionatori per stanza, più la temperatura e l'umidità di ogni stanza.
- **Aggiornamenti** – installa dalla plancia gli aggiornamenti di Home Assistant, dei componenti aggiuntivi, di HACS e dei firmware: novità, backup prima di installare, avanzamento, *Installa tutti* (Home Assistant per ultimo), versioni saltate.
- Grafica in vetro per tablet e telefono, **tema chiaro, scuro o automatico** (◐ in alto), in italiano e in inglese (segue la lingua di Home Assistant).
- **Primo avvio**: scegli **Automatica** (trovo tutto io) o **Manuale** (parti da zero e aggiungi quello che vuoi).
- **✏️ Modifica in ogni pagina** (amministratori): ＋ Aggiungi con ricerca, cambia nome, sposta in un'altra stanza, ✕ togli. **＋ Nuova pagina** per creare pagine tue.
- Pagina **Prese e dispositivi**: prese, interruttori, tapparelle, ventilatori, TV, serrature, robot per stanza.
- **Wizard di configurazione** (⚙️ Impostazioni, solo amministratori): scegli stanze e ordine, luci, termostati, il sensore di temperatura di ogni stanza, dispositivi, persone, meteo, scene e pagine. Le scelte si salvano in Home Assistant e valgono su tutti i dispositivi.
- Le pagine compaiono solo se hai i dispositivi giusti.

### Installazione
1. HACS → ⋮ → **Archivi digitali personalizzati** → aggiungi `https://github.com/gionny781/nduja-dashboard`, categoria **Integrazione**.
2. Cerca **'Nduja Dashboard** in HACS → **Scarica**.
3. Riavvia Home Assistant.
4. **Impostazioni → Dispositivi e servizi → Aggiungi integrazione → 'Nduja Dashboard**.
5. Apri **🌶️ 'Nduja** nella barra laterale.

**Opzioni** (Impostazioni → Dispositivi e servizi → 'Nduja Dashboard → Configura): nome e icona nella barra laterale, accesso solo per amministratori, sensori dell'energia (facoltativi: se li lasci vuoti la plancia li cerca da sola).

### Consigli
- Assegna ogni dispositivo a un'**area** e le aree ai **piani**: è da lì che la plancia disegna la casa.
- Le entità nascoste e quelle di configurazione o diagnostica vengono ignorate.

---

| Lights / Luci | Climate / Clima |
|---|---|
| ![Lights](docs/lights.png) | ![Climate](docs/climate.png) |
| **Room / Stanza** | **Updates / Aggiornamenti** |
| ![Room](docs/room.png) | ![Updates](docs/updates.png) |
| **Energy / Energia** | **Wizard** |
| ![Energy](docs/energy.png) | ![Wizard](docs/wizard.png) |
| **Edit / Modifica** | **Security / Sicurezza** |
| ![Edit](docs/edit.png) | ![Security](docs/security.png) |
| **Map / Mappa** | **Appliances / Elettrodomestici** |
| ![Map](docs/map.png) | ![Appliances](docs/appliances.png) |

## License
MIT © gionny781

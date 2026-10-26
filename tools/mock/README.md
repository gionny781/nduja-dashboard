# Finto Home Assistant per provare la plancia

`host.html` simula Home Assistant (stati, aree, piani, servizi, salvataggio delle scelte in `localStorage`)
e carica la plancia vera in un iframe. Serve per provare le modifiche senza un Home Assistant.

```bash
python3 -m http.server 8765 &          # dalla radice del repo
npm i --no-save playwright-core        # una volta
node tools/mock/shot.mjs home 1280 1100 home.png
LAYOUT='{"configured":false}' node tools/mock/shot.mjs benvenuto 390 844 tel.png
```
Gli errori JavaScript della pagina compaiono come `PAGEERR`.

**Telecamere** (`mockCam` in `LS`): `webrtc` (predefinito: diretta vera via WebRTC dentro il browser, con una scena disegnata),
`webrtc_ko` (WebRTC rifiutato, poi HLS), `hls`, `mjpeg`, `foto`. `window.mockCamLog` conta le dirette WebRTC aperte e chiuse.
Con il semplice `http.server` gli indirizzi `/mockhls/…` e `/api/camera_proxy_stream/…` rispondono 404: va bene per provare
il passaggio al metodo successivo; per vedere HLS e MJPEG veri serve un server di prova che li fornisca.
```bash
LS='{"mockCam":"webrtc_ko"}' node tools/mock/shot.mjs telecamere 1280 900 cam.png '[data-act="camLive"]'
```

**Flussi delle telecamere** (0.7.24): nel finto Home Assistant ci sono coppie da unire da sole — `cortile_hd`/`cortile_sd` (stesso nome),
`giardino_clear`/`giardino_fluent` (Reolink), `campanello` + `campanello_video_sub` (stesso dispositivo) — e `camera.cantina`, nascosta in
Home Assistant (compare solo in ＋ Aggiungi). Le immagini `cam-hd.svg` e `cam-sd.svg` servono a vedere quale flusso usa l'anteprima.

**Clima animato** (0.7.25): `climate.soggiorno` raffresca con la ventola alta, `climate.cucina` scalda con la ventola bassa, `climate.termostato_corridoio`
scalda, `climate.radiatore_lavanderia` è a riposo (`hvac_action: idle`), `climate.deumidificatore_lavanderia` deumidifica (ventola «2» di 3) e
`climate.camera_ospiti` è spento e senza stanza. Per provare «Le mie immagini» vanno bene `/tools/mock/cam-hd.svg` e `/tools/mock/cam-sd.svg`.

**Energia** (0.7.26): `sun.sun` segue l'ora vera (alba alle 7, tramonto alle 18). Con `mockEnt` in `LS` cambi o togli qualsiasi entità finta:
`{ "entity_id": ["stato", { attributi }] }` la cambia, `null` la toglie; negli attributi `"@+5h"` o `"@-30m"` diventano «adesso + 5 ore / − 30 minuti».
```bash
# notte serena, batteria che scarica
LS='{"mockEnt":"{\"sun.sun\":[\"below_horizon\",{\"elevation\":-30,\"rising\":false,\"next_rising\":\"@+8h\",\"next_setting\":\"@+19h\"}],\"weather.forecast_casa\":[\"clear-night\",{}],\"sensor.battery_power\":[\"380\"]}"}' node tools/mock/shot.mjs energia 1280 900 notte.png
```

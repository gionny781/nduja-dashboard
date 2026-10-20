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

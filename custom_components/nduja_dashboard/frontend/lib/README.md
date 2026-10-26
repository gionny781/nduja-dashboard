# Librerie di terzi / Third-party libraries

| Libreria | Versione | Licenza | File |
|---|---|---|---|
| [hls.js](https://github.com/video-dev/hls.js) — lettore video HLS (dirette delle telecamere) | 1.6.13 | Apache License 2.0 | `hls.min.js` |

- Copyright © 2017 Dailymotion e collaboratori di hls.js — avviso originale in `hls.js-LICENSE.txt`.
- Testo completo della licenza Apache 2.0 in `LICENSE-Apache-2.0.txt`.
- hls.js è incluso così com'è, senza modifiche. Lo carica `js/video.js` (il lettore delle telecamere) con un percorso relativo e solo quando serve, cioè quando una diretta passa a HLS su un browser che non lo legge da solo (su Safari e iPhone si usa il video nativo). Non viene mai scaricato da internet. Il resto di 'Nduja Dashboard è sotto licenza MIT (file `LICENSE` nella radice del repository).

🇬🇧 hls.js 1.6.13 (Apache License 2.0, © 2017 Dailymotion and hls.js contributors) is bundled unmodified and loaded by `js/video.js` from a relative path, only when a live view falls back to HLS on a browser without native HLS (never from a CDN). Original notice in `hls.js-LICENSE.txt`, full license text in `LICENSE-Apache-2.0.txt`. The rest of 'Nduja Dashboard is MIT licensed.

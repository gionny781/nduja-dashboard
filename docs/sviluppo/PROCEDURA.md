# Procedura per le versioni di anteprima (0.7.x-dev)

Fino alla versione ufficiale **0.8.0** le novità escono come **anteprime**: release GitHub segnate come
*pre-release*. HACS le mostra solo a chi attiva «Mostra versioni beta» per 'Nduja. Chi usa la versione ufficiale
(0.7.10.1) non le riceve. Quando Giovanni dirà che è tutto perfetto, si pubblicherà la 0.8.0 ufficiale con tutto dentro.

Ogni sessione programmata realizza **una sola scheda** (`docs/sviluppo/<versione>.md`), con calma e bene.

## 1. Preparazione
1. Clona o aggiorna il repo: `git clone https://github.com/gionny781/nduja-dashboard`.
   Se non hai accesso in scrittura, aggiungi il repo alla sessione con lo strumento add_repo, access "push".
   Lavora sul ramo `main`.
2. Leggi `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `THIRD_PARTY_LICENSES.md`, questa procedura e la scheda di oggi.
   Leggi sempre `frontend/js/core.js`, `edit.js`, `app.js` e i file indicati nella scheda.
3. **Versione nel manifest**:
   - se è quella «prima» indicata nella scheda, procedi;
   - se è più indietro, perché un'anteprima precedente non è uscita, controlla i rami `wip-*`. Fai comunque la versione di oggi partendo da `main`, senza mescolare lavori non finiti, e avvisa Giovanni nel messaggio finale;
   - se è già la versione di oggi o una successiva, fermati e scrivi a Giovanni.

## 2. Regole
- **Stile del codice esistente:**
  - moduli ES;
  - testi sempre bilingue con `t("italiano", "english")`;
  - azioni con `ACT`/`CHG` e `data-act`;
  - scelte valide per tutta la casa con `saveLayout`/`cambia` (solo admin), scelte del singolo dispositivo con `sGet`/`sSet`;
  - pagine registrate con `page()` e mostrate solo se servono (`show`);
  - schede della Home aggiunte da altre pagine tramite `HOME_EXTRA` di core.js.
- **Grafica:** in vetro, coerente con il resto, tema scuro e chiaro, ottima su telefono, tablet e PC.
- **Dipendenze:** nessuna libreria caricata da internet; `frontend/lib/hls.min.js` è già incluso. Niente YAML per l'utente.
- **Originalità:** codice, immagini e animazioni devono essere **tuoi**. Niente copiato da altri progetti o prodotti, niente loghi ufficiali, GIF o immagini scaricate da internet. Le animazioni «della plancia» vanno disegnate in SVG/CSS dentro il pacchetto.
- **Accessibilità e leggerezza:** rispetta `prefers-reduced-motion`; niente animazioni pesanti.
- **Compatibilità:** non rompere le funzioni esistenti e le scelte già salvate dagli utenti.

## 3. Prova (obbligatoria)
1. Dalla radice del repo: `python3 -m http.server 8765 &` e `npm i --no-save playwright-core`.
2. Usa `tools/mock/shot.mjs` (istruzioni in `tools/mock/README.md`; Chromium in `/opt/pw-browsers/chromium`).
3. Aggiungi in `tools/mock/host.html` le entità e le risposte finte che servono, senza dati personali veri.
4. Verifica con screenshot, e **guardali**:
   - tema scuro e chiaro (`L=1`);
   - desktop 1280 e telefono 390;
   - nessun `PAGEERR`;
   - le pagine esistenti (Home, Impostazioni, Auto e quelle toccate) funzionano ancora.
5. Se hai toccato `base.css` o `nduja.css`: `python3 tools/make_light_css.py`.
6. Se qualcosa non è all'altezza, **non pubblicare**: fai push sul ramo `wip-<versione>` e scrivi a Giovanni cosa manca.

## 4. Pubblicazione come anteprima
1. Versione `<versione>` (es. `0.7.11-dev`) in `const.py` e `manifest.json`.
2. In `CHANGELOG.md` aggiungi in cima la sezione `## <versione>` con punti 🇮🇹 e 🇬🇧 nello stile delle precedenti.
3. Aggiorna il README (italiano e inglese) se cambia qualcosa di visibile.
4. In `ROADMAP.md` spunta le voci fatte.
5. Fai il commit su `main` con messaggio `<versione>: <titolo>`, che termina con queste due righe:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: <link di questa sessione, se disponibile>
   ```
6. `git push origin main`. Il workflow Release crea da solo una **pre-release**, perché la versione finisce con `-dev`.
7. Verifica:
   - la release con `gh api repos/gionny781/nduja-dashboard/releases/tags/v<versione>`: deve avere `prerelease: true`;
   - il workflow Validate con `gh run list -R gionny781/nduja-dashboard -L 3`.
   Se fallisce, correggi e ripubblica.

## 5. Messaggio finale a Giovanni
Mandalo con SendUserMessage se disponibile: breve, in italiano, con
- cosa c'è di nuovo;
- se l'anteprima è uscita;
- come provarla: HACS → 'Nduja → ⋮ → Riscarica → attiva «Mostra versioni beta» → scegli `v<versione>` → riavvia Home Assistant;
- 1-2 screenshot delle novità.

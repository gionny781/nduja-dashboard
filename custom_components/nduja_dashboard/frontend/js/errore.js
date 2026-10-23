/* 'Nduja Dashboard — schermata d'errore chiara.
   Script normale (non modulo), caricato prima di tutto il resto: se la plancia non si collega a Home Assistant
   o i suoi file non partono (errore JavaScript, oppure troppi secondi senza dati), al posto della schermata bianca
   mostra un riquadro con cosa controllare, «Riprova» e i dettagli per l'assistenza.
   Appena la plancia riceve i dati (core.js chiama ndujaPronta) il riquadro non compare più, o sparisce se c'era. */
(function () {
  var ERR = [], pronta = false, shown = false, attesa = 15000, dopoErrore = 8000, timer = null;
  var lang = "en";
  try { lang = (parent.document.documentElement.lang || navigator.language || "en").slice(0, 2); } catch (e) { lang = (navigator.language || "en").slice(0, 2); }
  var IT = lang === "it", t = function (it, en) { return IT ? it : en; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var versione = function () {
    var m = location.pathname.match(/nduja_dashboard_static\/([^/]+)\//);
    return (m ? m[1] : "?") + (window.NDUJA_APP ? " · app" : "");
  };
  function annota(testo) {
    if (pronta || ERR.length >= 12) return;
    ERR.push(new Date().toLocaleTimeString() + "  " + String(testo).slice(0, 400));
    clearTimeout(timer); timer = setTimeout(controlla, dopoErrore);
  }
  /* errori dei file (script, fogli di stile) e del codice prima che la plancia sia partita */
  window.addEventListener("error", function (e) {
    var el = e.target;
    if (el && el !== window && el.tagName) {   // un file che non si carica: conta solo per script e fogli di stile (non le immagini)
      if (el.tagName === "SCRIPT" || el.tagName === "LINK") annota(t("File non caricato: ", "File not loaded: ") + (el.src || el.href));
      return;
    }
    annota((e.message || "Error") + (e.filename ? " (" + e.filename.split("/").slice(-2).join("/") + ":" + (e.lineno || 0) + ")" : ""));
  }, true);
  window.addEventListener("unhandledrejection", function (e) { var r = e.reason; annota((r && (r.message || r.code)) || r || "Promise"); });

  function tema() {
    var m = "auto";
    try { m = localStorage.getItem("nduja_theme") || "auto"; } catch (e) {}
    var scuro = m === "dark";
    if (m === "auto") {
      scuro = true;
      try { var h = parent.document.querySelector("home-assistant").hass; if (h && h.themes && typeof h.themes.darkMode === "boolean") scuro = h.themes.darkMode; else scuro = matchMedia("(prefers-color-scheme: dark)").matches; }
      catch (e) { try { scuro = matchMedia("(prefers-color-scheme: dark)").matches; } catch (e2) {} }
    }
    if (!scuro) document.body.classList.add("light");
  }
  function dettagli() {
    return ["'Nduja Dashboard " + versione(), t("Ora", "Time") + ": " + new Date().toString(), "URL: " + location.pathname,
      t("Dentro Home Assistant", "Inside Home Assistant") + ": " + (function () { try { return window.parent !== window && !!window.parent.hassConnection ? t("sì", "yes") : t("no", "no"); } catch (e) { return "?"; } })(),
      "User agent: " + navigator.userAgent, "", t("Errori", "Errors") + ":"].concat(ERR.length ? ERR : [t("nessuno: la plancia non ha ricevuto dati da Home Assistant", "none: the dashboard received no data from Home Assistant")]).join("\n");
  }
  function mostra(motivo) {
    if (pronta || shown || !document.body) return;
    shown = true; tema();
    var c = document.getElementById("connect"); if (c) c.classList.remove("show");
    var fuori = window.parent === window && !window.NDUJA_APP;
    var d = document.createElement("div");
    d.id = "errore"; d.className = "err1"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-labelledby", "err1t");
    d.innerHTML = '<div class="glass err1b"><div class="err1h"><span>🌶️</span><div><h3 id="err1t">' + t("La plancia non riesce a partire", "The dashboard can't start") + "</h3><p>" +
      (motivo === "fuori" ? t("Non trovo il collegamento a Home Assistant.", "I can't find the connection to Home Assistant.") : t("Non arrivano i dati da Home Assistant, oppure un file della plancia non si è caricato.", "No data is coming from Home Assistant, or a dashboard file didn't load.")) + "</p></div></div>" +
      "<b class=\"err1s\">" + t("Cosa controllare", "What to check") + "</b><ul>" +
      (fuori ? "<li>" + t("Apri la plancia dalla voce 🌶️ nella barra laterale di Home Assistant, non da un indirizzo diretto.", "Open the dashboard from the 🌶️ entry in the Home Assistant sidebar, not from a direct address.") + "</li>" : "") +
      "<li>" + t("Che questo dispositivo sia in rete e raggiunga Home Assistant (Wi‑Fi, dati, VPN).", "That this device is online and can reach Home Assistant (Wi‑Fi, mobile data, VPN).") + "</li>" +
      "<li>" + t("Dopo un aggiornamento di 'Nduja: riavvia Home Assistant, poi ricarica la pagina (se serve, svuota la cache del browser o dell'app).", "After a 'Nduja update: restart Home Assistant, then reload the page (if needed, clear the browser's or app's cache).") + "</li>" +
      "<li>" + t("Se non si sistema, apri una segnalazione su GitHub e incolla i dettagli qui sotto.", "If it doesn't get fixed, open an issue on GitHub and paste the details below.") + "</li></ul>" +
      '<div class="err1a"><button class="btn pri" type="button" id="err1r">↻ ' + t("Riprova", "Try again") + "</button></div>" +
      '<details class="err1d"><summary>' + t("Dettagli per l'assistenza", "Details for support") + '</summary><pre id="err1p"></pre></details></div>';
    document.body.appendChild(d);
    document.getElementById("err1p").textContent = dettagli();
    document.getElementById("err1r").onclick = function () { location.reload(); };
    d.querySelector("details").addEventListener("toggle", function () { document.getElementById("err1p").textContent = dettagli(); });
  }
  function controlla() {
    if (pronta || shown) return;
    if (document.visibilityState === "hidden") { clearTimeout(timer); timer = setTimeout(controlla, 2000); return; }   // in sottofondo i tempi non contano
    mostra();
  }
  timer = setTimeout(controlla, attesa);
  /* chiamate da core.js */
  window.ndujaPronta = function () {
    pronta = true; clearTimeout(timer);
    var d = document.getElementById("errore"); if (d) d.remove();
    shown = false;
  };
  window.ndujaErrore = function (motivo) { clearTimeout(timer); mostra(motivo); };
})();

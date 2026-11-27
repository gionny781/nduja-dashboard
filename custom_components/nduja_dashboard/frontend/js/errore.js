/* 'Nduja Dashboard — schermata d'errore chiara e «🐞 Segnala un problema».
   Script normale (non modulo), caricato prima di tutto il resto: se la plancia non si collega a Home Assistant
   o i suoi file non partono (errore JavaScript, oppure troppi secondi senza dati), al posto della schermata bianca
   mostra un riquadro con cosa controllare, «Riprova» e «Segnala il problema».
   Appena la plancia riceve i dati (core.js chiama ndujaPronta) il riquadro non compare più, o sparisce se c'era.

   Tiene anche, sempre, gli ultimi 10 errori (file e riga) e prepara il testo delle segnalazioni (window.ndujaSegnala):
   lo usano questa schermata e ⚙️ Impostazioni → Segnala un problema (segnala.js). Niente dati personali:
   via nomi di entità, indirizzi IP, indirizzi web e nomi delle persone; l'utente vede tutto prima e può togliere le righe. */
(function () {
  var pronta = false, shown = false, attesa = 15000, dopoErrore = 8000, timer = null;
  var lang = "en";
  try { lang = (parent.document.documentElement.lang || navigator.language || "en").slice(0, 2); } catch (e) { lang = (navigator.language || "en").slice(0, 2); }
  var IT = lang === "it", t = function (it, en) { return IT ? it : en; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var versione = function () {
    var m = location.pathname.match(/nduja_dashboard_static\/([^/]+)\//);
    return (m ? m[1] : "?") + (window.NDUJA_APP ? " · app" : "");
  };

  /* ---------- gli ultimi 10 errori, anche dopo la partenza ---------- */
  var ULTIMI = [], MAX = 10;
  /** «js/pages/luci.js:120» da un indirizzo con riga (e colonna) */
  function dove(file, riga) {
    if (!file) return "";
    var f = String(file).split("?")[0].split("#")[0], i = f.indexOf("/js/");
    f = i >= 0 ? f.slice(i + 1) : f.indexOf("/css/") >= 0 ? f.slice(f.indexOf("/css/") + 1) : f.split("/").slice(-1)[0];
    return f + (riga ? ":" + riga : "");
  }
  /** il primo punto del codice della plancia nello stack */
  function daStack(st) {
    var m = String(st || "").match(/(https?:\/\/[^\s)]+?\.m?js)(?:\?[^\s):]*)?:(\d+)(?::\d+)?/);
    return m ? dove(m[1], m[2]) : "";
  }
  function registra(msg, luogo) {
    msg = String(msg == null ? "" : msg).replace(/\s+/g, " ").trim().slice(0, 300) || "Error";
    var ora = new Date().toTimeString().slice(0, 8), u = ULTIMI[ULTIMI.length - 1];
    if (u && u.msg === msg && u.dove === luogo) { u.volte++; u.ora = ora; return; }   // lo stesso errore di fila: lo conto
    ULTIMI.push({ ora: ora, msg: msg, dove: luogo || "", volte: 1 });
    if (ULTIMI.length > MAX) ULTIMI.shift();
  }
  /** un errore prima della partenza: la schermata d'errore compare prima (dopo 8 secondi invece di 15) */
  function prima() {
    if (pronta) return;
    clearTimeout(timer); timer = setTimeout(controlla, dopoErrore);
  }
  /* errori dei file (script, fogli di stile) e del codice */
  window.addEventListener("error", function (e) {
    var el = e.target;
    if (el && el !== window && el.tagName) {   // un file che non si carica: conta solo per script e fogli di stile (non le immagini)
      if (el.tagName === "SCRIPT" || el.tagName === "LINK") { prima(); registra(t("File non caricato", "File not loaded"), dove(el.src || el.href)); }
      return;
    }
    prima();
    registra(e.message || "Error", dove(e.filename, e.lineno) || daStack(e.error && e.error.stack));
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    prima();
    registra((r && (r.message || r.code)) || (typeof r === "object" ? (function () { try { return JSON.stringify(r); } catch (x) { return "Promise"; } })() : r) || "Promise", daStack(r && r.stack));
  });
  /* console.error della plancia (gli errori presi e scritti in console) */
  try {
    var ce = console.error;
    console.error = function () {
      try {
        var a = [].slice.call(arguments), err = null;
        for (var i = 0; i < a.length; i++) if (a[i] && (a[i].stack || a[i].message)) { err = a[i]; break; }
        var msg = a.map(function (x) { return x && x.message ? x.message : typeof x === "object" ? (function () { try { return JSON.stringify(x); } catch (y) { return String(x); } })() : String(x); }).join(" ");
        registra(msg, daStack(err ? err.stack : new Error().stack.split("\n").slice(2).join("\n")));
      } catch (x) { /* mai bloccare la console */ }
      return ce.apply(console, arguments);
    };
  } catch (e) {}

  /* ---------- testo della segnalazione (anche per segnala.js) ---------- */
  var REPO = "https://github.com/gionny781/nduja-dashboard/issues/new", MAXURL = 6000;
  var DOMINI = "light|switch|sensor|binary_sensor|climate|cover|fan|media_player|lock|humidifier|vacuum|valve|siren|scene|script|automation|person|zone|device_tracker|camera|alarm_control_panel|remote|input_[a-z]+|number|select|button|weather|calendar|todo|update|water_heater|event|image|lawn_mower|notify|sun|text|time|date|datetime|counter|timer|group|tts|stt|conversation|assist_satellite|schedule|tag|plant";
  var RE_ENT = new RegExp("\\b(?:" + DOMINI + ")\\.[a-z0-9_]+\\b", "g");
  var TIPI = function () { return [["bug", "🐞", t("Non funziona", "Doesn't work")], ["vista", "🎨", t("Si vede male", "Looks wrong")], ["lento", "🐢", t("Va lento", "It's slow")], ["idea", "💡", t("Idea", "Idea")]]; };
  /** toglie i dati personali da un testo: entità, indirizzi IP e web, email, codici lunghi e i nomi passati (persone, stanze…) */
  function sanifica(s, nomi) {
    s = String(s == null ? "" : s)
      .replace(/https?:\/\/[^\s)'"]+/g, function (u) { return u.indexOf("/js/") >= 0 || u.indexOf("/css/") >= 0 ? dove(u.replace(/:(\d+)(?::\d+)?$/, ""), (u.match(/:(\d+)(?::\d+)?$/) || [])[1]) : "‹" + t("indirizzo", "address") + "›"; })
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "‹email›")
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "‹IP›")
      .replace(/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, "‹IP›")
      .replace(/\bmobile_app_[a-z0-9_]+/g, "mobile_app_‹…›")
      .replace(RE_ENT, function (m) { return m.split(".")[0] + ".‹…›"; })
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "‹…›");
    (nomi || []).filter(function (n) { return n && String(n).trim().length > 2; })
      .sort(function (a, b) { return String(b).length - String(a).length; })
      .forEach(function (n) { s = s.split(String(n).trim()).join("‹" + t("nome", "name") + "›"); });
    return s;
  }
  /** righe degli errori, già pulite */
  function righeErrori(nomi) {
    return ULTIMI.map(function (e) { return e.ora + "  " + sanifica(e.msg, nomi).slice(0, 220) + (e.dove ? "  @ " + e.dove : "") + (e.volte > 1 ? "  (×" + e.volte + ")" : ""); });
  }
  /** browser e dispositivo, senza niente di personale */
  function browser() {
    var u = navigator.userAgent, m, b = "?", s = "";
    if ((m = u.match(/FullyKiosk|Fully Kiosk/i))) b = "Fully Kiosk";
    else if ((m = u.match(/Edg\/(\d+)/))) b = "Edge " + m[1];
    else if ((m = u.match(/SamsungBrowser\/(\d+)/))) b = "Samsung Internet " + m[1];
    else if ((m = u.match(/Firefox\/(\d+)/))) b = "Firefox " + m[1];
    else if ((m = u.match(/(?:Chrome|CriOS)\/(\d+)/))) b = "Chrome " + m[1] + (/; wv\)/.test(u) ? " (WebView)" : "");
    else if ((m = u.match(/Version\/([\d.]+).*Safari/))) b = "Safari " + m[1];
    else if (/AppleWebKit/.test(u)) b = "WebKit (" + t("app", "app") + ")";
    if ((m = u.match(/Android ([\d.]+)/))) s = "Android " + m[1];
    else if ((m = u.match(/(?:iPhone|CPU) OS ([\d_]+)/))) s = "iOS " + m[1].replace(/_/g, ".");
    else if (/Macintosh/.test(u)) s = navigator.maxTouchPoints > 1 ? "iPadOS" : "macOS";
    else if (/Windows/.test(u)) s = "Windows";
    else if (/CrOS/.test(u)) s = "ChromeOS";
    else if (/Linux/.test(u)) s = "Linux";
    return b + (s ? " · " + s : "");
  }
  function dispositivo() {
    var w = Math.min(screen.width, screen.height), tipo = navigator.maxTouchPoints > 0 ? (w < 600 ? t("telefono", "phone") : t("tablet", "tablet")) : t("computer", "computer");
    return tipo + " · " + t("finestra ", "window ") + innerWidth + "×" + innerHeight + " @" + (Math.round((window.devicePixelRatio || 1) * 10) / 10) + "x";
  }
  /** dove gira la plancia */
  function ambiente() {
    var u = navigator.userAgent, p = null;
    try { p = window.parent; } catch (e) {}
    if (window.NDUJA_APP) return t("app 'Nduja (iPhone/iPad)", "'Nduja app (iPhone/iPad)");
    if (/FullyKiosk|Fully Kiosk/i.test(u) || window.fully) return "Fully Kiosk";
    try { if (p && p.externalApp) return t("app di Home Assistant (Android)", "Home Assistant app (Android)"); } catch (e) {}
    try { if (p && p.webkit && p.webkit.messageHandlers && p.webkit.messageHandlers.getExternalAuth) return t("app di Home Assistant (iPhone/iPad/Mac)", "Home Assistant app (iPhone/iPad/Mac)"); } catch (e) {}
    if (/Home ?Assistant/i.test(u)) return t("app di Home Assistant", "Home Assistant app");
    return window.parent !== window ? t("browser, dentro Home Assistant", "browser, inside Home Assistant") : t("browser, fuori da Home Assistant", "browser, outside Home Assistant");
  }
  /** righe di base (versione, browser, dispositivo, lingua): { k, testo } */
  function base() {
    return [
      { k: "nduja", testo: "'Nduja: " + versione() },
      { k: "browser", testo: t("Browser: ", "Browser: ") + browser() },
      { k: "disp", testo: t("Dispositivo: ", "Device: ") + dispositivo() },
      { k: "dove", testo: t("Dove: ", "Where: ") + ambiente() },
      { k: "lingua", testo: t("Lingua: ", "Language: ") + (navigator.language || "?") + " · " + t("plancia in ", "dashboard in ") + (IT ? "italiano" : "English") },
    ];
  }
  function tipo(k) { var T = TIPI(); for (var i = 0; i < T.length; i++) if (T[i][0] === k) return T[i]; return T[0]; }
  function titolo(k, cosa) {
    var c = String(cosa || "").replace(/\s+/g, " ").trim();
    return (k === "idea" ? "[" + t("Idea", "Idea") + "] " : "[" + t("Problema", "Problem") + "] ") + (c ? (c.length > 70 ? c.slice(0, 68) + "…" : c) : tipo(k)[2]);
  }
  /** corpo in Markdown, con le stesse sezioni dei moduli di GitHub (.github/ISSUE_TEMPLATE) */
  function corpo(o) {
    var T = tipo(o.tipo), r = o.righe || [], er = o.errori || [];
    return "### " + t("Tipo", "Type") + "\n" + T[1] + " " + T[2] + "\n\n### " + t("Cosa è successo", "What happened") + "\n" + (String(o.cosa || "").trim() || "_" + t("(non scritto)", "(not written)") + "_") +
      "\n\n### " + t("Dettagli raccolti dalla plancia", "Details collected by the dashboard") + "\n```\n" + (r.length ? r.join("\n") : t("(tolti)", "(removed)")) +
      (o.conErrori ? "\n\n" + t("Ultimi errori", "Latest errors") + ":\n" + (er.length ? er.join("\n") : t("nessuno", "none")) : "") + "\n```\n" +
      "\n_" + (o.errore ? t("Preparata dalla schermata d'errore della plancia.", "Prepared by the dashboard's error screen.") : t("Preparata da ⚙️ Impostazioni → Segnala un problema.", "Prepared by ⚙️ Settings → Report a problem.")) + " " + t("Niente nomi di entità, indirizzi o persone.", "No entity names, addresses or people.") + "_";
  }
  /** indirizzo di GitHub già compilato; se il testo è troppo lungo per un indirizzo: lungo = true e il corpo chiede di incollare */
  function url(tit, txt) {
    var u = REPO + "?title=" + encodeURIComponent(tit) + "&body=" + encodeURIComponent(txt);
    if (u.length <= MAXURL) return { url: u, lungo: false };
    return { url: REPO + "?title=" + encodeURIComponent(tit) + "&body=" + encodeURIComponent(t("<!-- Incolla qui il testo copiato dalla plancia (tieni premuto → Incolla, oppure Ctrl+V) -->\n\n", "<!-- Paste here the text copied from the dashboard (long press → Paste, or Ctrl+V) -->\n\n")), lungo: true };
  }
  /** copia negli appunti: prima il modo moderno, se non c'è (app, iframe senza permesso) il vecchio */
  function copiaVecchio(txt) {
    var a = document.createElement("textarea"), ok = false;
    a.value = txt; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(a); a.focus(); a.select();
    try { a.setSelectionRange(0, txt.length); ok = document.execCommand("copy"); } catch (e) {}
    a.remove(); return ok;
  }
  function copia(txt) {
    var vecchio = copiaVecchio(txt);   // subito, dentro il tocco: funziona anche dove il modo moderno è bloccato
    if (vecchio) return Promise.resolve(true);
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return false; }); } catch (e) {}
    return Promise.resolve(false);
  }
  window.ndujaSegnala = { tipi: TIPI, base: base, errori: righeErrori, sanifica: sanifica, titolo: titolo, corpo: corpo, url: url, copia: copia, versione: versione };
  window.ndujaErrori = function () { return ULTIMI.slice(); };

  /* ---------- schermata d'errore ---------- */
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
  /* la segnalazione dentro la schermata d'errore: stesso testo di ⚙️ Impostazioni, con le righe che si possono togliere */
  var SG = { tipo: "bug", cosa: "", via: {} };
  function righeSG() {
    var R = base(), mot = SG.motivo === "fuori" ? t("non trova il collegamento a Home Assistant", "can't find the connection to Home Assistant") : t("non arrivano i dati da Home Assistant o un file non si carica", "no data from Home Assistant or a file doesn't load");
    R.push({ k: "stato", testo: t("Stato: la plancia non parte (", "State: the dashboard doesn't start (") + mot + ")" });
    R.push({ k: "dentro", testo: t("Dentro Home Assistant: ", "Inside Home Assistant: ") + (function () { try { return window.parent !== window && !!window.parent.hassConnection ? t("sì", "yes") : t("no", "no"); } catch (e) { return "?"; } })() });
    return R;
  }
  function testoSG() {
    var R = righeSG().filter(function (r) { return !SG.via[r.k]; }).map(function (r) { return r.testo; });
    var tit = titolo(SG.tipo, SG.cosa);
    return { titolo: tit, corpo: corpo({ tipo: SG.tipo, cosa: SG.cosa, righe: R, conErrori: !SG.via.errori, errori: righeErrori([]), errore: true }) };
  }
  function disegnaSG() {
    var box = document.getElementById("err1g"); if (!box) return;
    var x = testoSG(), u = url(x.titolo, x.corpo), E = righeErrori([]);
    box.querySelector(".sg1r").innerHTML = righeSG().concat([{ k: "errori", testo: t("Ultimi errori: ", "Latest errors: ") + E.length }]).map(function (r) {
      return '<button type="button" class="sg1l ' + (SG.via[r.k] ? "via" : "") + '" data-k="' + r.k + '" aria-pressed="' + (!SG.via[r.k]) + '"><span class="bx"></span><span>' + esc(r.testo) + "</span></button>";
    }).join("");
    box.querySelector(".sg1t").innerHTML = TIPI().map(function (k) { return '<button type="button" class="' + (SG.tipo === k[0] ? "act" : "") + '" data-t="' + k[0] + '">' + k[1] + " " + esc(k[2]) + "</button>"; }).join("");
    box.querySelector("pre").textContent = x.titolo + "\n\n" + x.corpo;
    var a = box.querySelector("a.sg1go");
    a.href = u.url; a.setAttribute("data-lungo", u.lungo ? "1" : "");
    box.querySelector(".sg1lg").hidden = !u.lungo;
  }
  function apriSG() {
    var box = document.getElementById("err1g"); if (!box) return;
    box.hidden = false;
    box.innerHTML = '<b class="err1s">🐞 ' + t("Segnala il problema", "Report the problem") + "</b>" +
      '<div class="seg sg1t"></div>' +
      '<label class="fld1"><span>' + t("Cosa stavi facendo? (facoltativo)", "What were you doing? (optional)") + '</span><textarea rows="3" id="err1c" placeholder="' + esc(t("Per esempio: dopo l'aggiornamento, aprendo la plancia dal telefono…", "For example: after the update, opening the dashboard on the phone…")) + '"></textarea></label>' +
      '<div class="sg1h">' + t("Dettagli raccolti da soli · tocca una riga per toglierla", "Details collected automatically · tap a line to remove it") + '</div><div class="sg1r"></div>' +
      '<div class="sg1h">' + t("Ecco esattamente cosa verrà inviato", "Here's exactly what will be sent") + '</div><pre class="sg1v"></pre>' +
      '<p class="sg1lg note1" hidden>' + t("Il testo è lungo: toccando «Apri su GitHub» lo copio negli appunti. Su GitHub tieni premuto nella casella e scegli «Incolla».", "The text is long: tapping «Open on GitHub» copies it to the clipboard. On GitHub long-press the box and choose «Paste».") + "</p>" +
      '<div class="err1a"><a class="btn pri sg1go" target="_blank" rel="noopener" href="#">↗ ' + t("Apri su GitHub", "Open on GitHub") + '</a><button class="btn" type="button" id="err1k">📋 ' + t("Copia", "Copy") + "</button></div>" +
      '<p class="sg1n">' + t("Serve un account GitHub (gratis). Non mando niente da solo: decidi tu su GitHub.", "You need a (free) GitHub account. Nothing is sent by itself: you decide on GitHub.") + "</p>";
    box.addEventListener("click", function (e) {
      var l = e.target.closest(".sg1l"), k = e.target.closest(".sg1t button");
      if (l) { SG.via[l.dataset.k] = !SG.via[l.dataset.k]; disegnaSG(); }
      if (k) { SG.tipo = k.dataset.t; disegnaSG(); }
      if (e.target.closest("a.sg1go") && e.target.closest("a.sg1go").getAttribute("data-lungo") === "1") { var x = testoSG(); copia(x.corpo); }
      if (e.target.closest("#err1k")) { var y = testoSG(); copia(y.titolo + "\n\n" + y.corpo).then(function (ok) { var b = document.getElementById("err1k"); if (b) b.textContent = ok ? "✓ " + t("Copiato", "Copied") : t("Non riesco a copiare: seleziona il testo qui sopra", "Can't copy: select the text above"); }); }
    });
    box.querySelector("#err1c").addEventListener("input", function (e) { SG.cosa = e.target.value; disegnaSG(); });
    disegnaSG();
    var b = document.getElementById("err1s"); if (b) b.remove();
    box.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function mostra(motivo) {
    if (pronta || shown || !document.body) return;
    shown = true; tema(); SG.motivo = motivo;
    var c = document.getElementById("connect"); if (c) c.classList.remove("show");
    var fuori = window.parent === window && !window.NDUJA_APP, esempio = false;
    try { esempio = sessionStorage.getItem("nduja_esempio") === "1"; } catch (x) {}
    var d = document.createElement("div");
    d.id = "errore"; d.className = "err1"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-labelledby", "err1t");
    d.innerHTML = '<div class="glass err1b"><div class="err1h"><span>🌶️</span><div><h3 id="err1t">' + t("La plancia non riesce a partire", "The dashboard can't start") + "</h3><p>" +
      (motivo === "fuori" ? t("Non trovo il collegamento a Home Assistant.", "I can't find the connection to Home Assistant.") : t("Non arrivano i dati da Home Assistant, oppure un file della plancia non si è caricato.", "No data is coming from Home Assistant, or a dashboard file didn't load.")) + "</p></div></div>" +
      "<b class=\"err1s\">" + t("Cosa controllare", "What to check") + "</b><ul>" +
      (fuori ? "<li>" + t("Apri la plancia dalla voce 🌶️ nella barra laterale di Home Assistant, non da un indirizzo diretto.", "Open the dashboard from the 🌶️ entry in the Home Assistant sidebar, not from a direct address.") + "</li>" : "") +
      "<li>" + t("Che questo dispositivo sia in rete e raggiunga Home Assistant (Wi‑Fi, dati, VPN).", "That this device is online and can reach Home Assistant (Wi‑Fi, mobile data, VPN).") + "</li>" +
      "<li>" + t("Dopo un aggiornamento di 'Nduja: riavvia Home Assistant, poi ricarica la pagina (se serve, svuota la cache del browser o dell'app).", "After a 'Nduja update: restart Home Assistant, then reload the page (if needed, clear the browser's or app's cache).") + "</li>" +
      "<li>" + t("Se non si sistema, segnala il problema: preparo io il testo per GitHub.", "If it doesn't get fixed, report the problem: I prepare the text for GitHub.") + "</li></ul>" +
      '<div class="err1a"><button class="btn pri" type="button" id="err1r">↻ ' + t("Riprova", "Try again") + "</button>" +
      '<button class="btn" type="button" id="err1s">🐞 ' + t("Segnala il problema", "Report the problem") + "</button>" +
      (esempio ? '<button class="btn" type="button" id="err1x">' + t("Esci dalla casa di esempio", "Exit the sample home") + "</button>"
        : '<button class="btn" type="button" id="err1e">👀 ' + t("Intanto guarda la casa di esempio", "Meanwhile, look at the sample home") + "</button>") + "</div>" +
      '<div class="sg1 err1g" id="err1g" hidden></div></div>';
    document.body.appendChild(d);
    document.getElementById("err1r").onclick = function () { location.reload(); };
    document.getElementById("err1s").onclick = apriSG;
    /* 🏡 casa di esempio (esempio.js): una casa finta dentro la plancia, senza Home Assistant; «Esci» riporta qui */
    var e = document.getElementById("err1e");
    var x = document.getElementById("err1x");
    if (x) x.onclick = function () { try { sessionStorage.removeItem("nduja_esempio"); sessionStorage.removeItem("nduja_esempio_da"); } catch (y) {} location.reload(); };
    if (e) e.onclick = function () { try { sessionStorage.setItem("nduja_esempio", "1"); sessionStorage.setItem("nduja_esempio_da", "home"); history.replaceState(null, "", "#home"); } catch (x) {} location.reload(); };
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

/* Rete e server: internet (stato, velocità in tempo reale dal modem, IP pubblico, speedtest con grafico e «Prova adesso»),
   modem/router, mini PC, NAS, Proxmox, Raspberry e stampanti (acceso/spento, CPU, RAM, disco, temperatura, uptime,
   riavvio/accensione con doppia conferma), dispositivi collegati (quanti online, i nuovi di oggi), Wi-Fi ospiti con il QR
   disegnato da ../qr.js e gruppo di continuità (NUT, APC UPS Daemon).
   Tutto si trova da solo; con ✏️ (solo admin) si aggiunge, toglie, rinomina e si scelgono i sensori: LAYOUT.rete.
   In Home la scheda «Rete» (HOME_EXTRA). La pagina compare solo se trova qualcosa. */
import { S, REG, DEVICES, ACT, UI, LAYOUT, HOME_EXTRA, VISTE, t, LOC, esc, fnum, nm, nmHA, ok, val, attr, unit, card, empty, page, svc, ws, cached,
  toast, openSheet, closeSheet, render, isAdmin, sicuro, deviceClass, domain, ago, durata } from "../core.js";
import { cambia, scegli } from "../edit.js";
import { statistiche, linea } from "../grafici.js";
import { qrSvg, wifiQR } from "../qr.js";

/* ---------- integrazioni ---------- */
const ROUTER = /^(fritz|unifi|tplink_omada|omada|tplink_deco|tplink_router|mikrotik|luci|openwrt|ubus|netgear|asuswrt|huawei_lte|vodafone_station|sfr_box|keenetic_ndms2|sky_hub|skyhub|bt_smarthub|freebox|upnp|eero|google_wifi|linksys_smart_wifi|zyxel|starlink|airos|ruckus_unleashed|aruba|ddwrt|opnsense|pfsense|zte_router|technicolor|tim_hub)$/;
const SERVER = /^(systemmonitor|glances|proxmoxve|synology_dsm|truenas|qnap|unraid|netdata|rpi_power|ping|wake_on_lan|idrac|hp_ilo|webmin|openmediavault|xiaomi_miio_gateway_x)$/;
const STAMPANTE = /^(ipp|brother|hp_printer|epson_printer|epson)$/;
const UPS = /^(nut|apcupsd)$/;
const SPEED = /^(speedtestdotnet|fastdotcom|speedtest|librespeed|ookla)$/;
const NOME_ROUTER = /router|modem|fritz|gateway|\bwan\b|vodafone station|sky ?hub|tim ?hub|zte|livebox|\bdeco\b|omada|mikrotik|openwrt|airport|eero|starlink|unifi dream|\budm\b|\bucg\b|\busg\b/i;
const NOME_SERVER = /\bnas\b|server|proxmox|\bpve\b|synology|diskstation|truenas|unraid|qnap|raspberry|raspi|\brpi\b|mini ?pc|\bnuc\b|beelink|glances|system monitor|\bvm\b|docker|portainer|homelab|workstation/i;
const INTERNET_PING = /google|cloudflare|quad9|opendns|internet|8[._]8[._]8[._]8|1[._]1[._]1[._]1|9[._]9[._]9[._]9|\bdns\b|wan/i;

/* tipi di dispositivo: icona e nome */
export const TIPI = () => ({
  router: ["📶", t("Modem / router", "Modem / router")], server: ["🖥️", t("Server / mini PC", "Server / mini PC")], nas: ["🗄️", "NAS"],
  pc: ["💻", "PC"], rpi: ["🍓", "Raspberry"], vm: ["📦", t("Macchina virtuale", "Virtual machine")], stampante: ["🖨️", t("Stampante", "Printer")], altro: ["🔌", t("Altro", "Other")],
});
const ORDINE_TIPI = ["router", "server", "nas", "pc", "rpi", "vm", "stampante", "altro"];

const conf = () => LAYOUT.rete || {};
const testo = id => (id + " " + nmHA(id)).toLowerCase();
const pct = id => unit(id) === "%";
const piatt = id => REG[id]?.platform || "";
const IP4 = /^(\d{1,3}\.){3}\d{1,3}$/, IP6 = /^[0-9a-f:]{6,}$/i;

/* ---------- velocità: tutto in Mbit/s ---------- */
const MBIT = { "bit/s": 1e-6, "kbit/s": 1e-3, "mbit/s": 1, "gbit/s": 1e3, "b/s": 8e-6, "kb/s": 8e-3, "kib/s": 8.192e-3, "mb/s": 8, "mib/s": 8.389, "gb/s": 8e3, "gib/s": 8590 };
/** fattore per passare a Mbit/s: «kbit/s» e «kb/s» sono bit; «kB/s», «KiB/s», «MB/s» sono byte */
function fattore(u) {
  u = String(u || "").trim(); if (!u) return null;
  if (/bit/i.test(u) || /bps$/i.test(u)) return MBIT[u.toLowerCase().replace(/ps$/, "it/s").replace("bbit", "bit")] ?? MBIT[u.toLowerCase()] ?? null;
  return MBIT[u.toLowerCase()] ?? null;
}
const isRate = id => id.startsWith("sensor.") && (deviceClass(id) === "data_rate" || fattore(unit(id)) != null);
export const mbit = id => { const v = val(id), f = fattore(unit(id)); return v == null || f == null ? null : Math.max(0, v * f); };
export function velocita(m) {
  if (m == null) return "—";
  if (m >= 1000) return fnum(m / 1000, m >= 10000 ? 0 : 1) + " Gbit/s";
  if (m >= 100) return fnum(m, 0) + " Mbit/s";
  if (m >= 1) return fnum(m, 1) + " Mbit/s";
  return fnum(m * 1000, 0) + " kbit/s";
}
const GIU = /download|downlink|receiv|ricev|\brx\b|_rx\b|rx_|bytes_in|\bin\b|_in_|incoming|scaric/i, SU = /upload|uplink|sent|invia|\btx\b|_tx\b|tx_|bytes_out|\bout\b|_out_|outgoing|caric/i;
const MAX = /max|link|limit|massim|sync|capacity|line_rate|linea/i;

/* ---------- dispositivi di Home Assistant ---------- */
let memo = { k: "", v: null };
function perDispositivo() {
  const G = {};
  /* le entità senza dispositivo (anche quelle scritte in YAML, senza registro: Wake on LAN, ping…) fanno gruppo da sole */
  for (const id of Object.keys(S)) { const r = REG[id]; if (r?.hidden) continue; const k = r?.device || id; (G[k] = G[k] || []).push(id); }
  return G;
}
const nomeDev = k => DEVICES[k]?.name || (S[k] ? nmHA(k) : k);
const testoDev = (k, E) => (nomeDev(k) + " " + (DEVICES[k]?.model || "") + " " + (DEVICES[k]?.maker || "") + " " + E.map(testo).join(" ")).toLowerCase();

/** ruoli delle entità di un dispositivo (scelte a mano in LAYOUT.rete.sens) */
function ruoli(k, E) {
  const sc = conf().sens?.[k] || {}, sens = E.filter(x => x.startsWith("sensor.")), trova = (L, f) => L.find(f) || null;
  const scelto = r => sc[r] === "none" ? null : sc[r] && S[sc[r]] ? sc[r] : undefined;
  const dischi = sens.filter(x => pct(x) && /disk|disco|volume|storage|used_percent|use_percent|filesystem|rootfs|pool|_used$|datastore/i.test(testo(x)) && !/mem|ram\b|_ram|cpu|swap|batter|inode/i.test(testo(x)));
  const temps = sens.filter(x => deviceClass(x) === "temperature" || /°[CF]$/.test(unit(x)));
  const R = {
    stato: E.find(x => x.startsWith("binary_sensor.") && (["connectivity", "running", "power"].includes(deviceClass(x)) || /status|running|online|reachab|ping|power|acceso|in_esecuzione/i.test(testo(x))) && !/update|aggiorn|security|sicurezz|problem|batter|charg|link\b|_link$|connection|connessione|\bwan\b|internet/i.test(testo(x))) || null,   // la linea internet del modem non dice se il modem è acceso
    cpu: trova(sens, x => pct(x) && /cpu|processor|processore|load_percent|utilization_total|cpu_used|cpu_usage|processor_use/i.test(testo(x)) && !/temp|freq/i.test(testo(x))),
    ram: trova(sens, x => pct(x) && /mem|\bram\b|_ram_|_ram$|memory/i.test(testo(x)) && !/swap|cache|buffer/i.test(testo(x))),
    disco: dischi.sort((a, b) => (val(b) ?? -1) - (val(a) ?? -1))[0] || null,
    temp: temps.find(x => /cpu|processor|soc|core|package|chip|system|sistema|board/i.test(testo(x))) || temps[0] || null,
    uptime: trova(sens, x => (deviceClass(x) === "timestamp" && /boot|uptime|avvio|restart|startup|up_since|device_uptime|last_boot|acceso_da/i.test(testo(x)) && !/connection|connessione|wan/i.test(testo(x)))
      || (/uptime|acceso_da/i.test(testo(x)) && /^(s|min|h|d)$/.test(unit(x)))),
  };
  for (const r of Object.keys(R)) { const s = scelto(r); if (s !== undefined) R[r] = s; }
  R.dischi = dischi.length;
  /* pulsanti di accensione, spegnimento e riavvio */
  const B = E.filter(x => x.startsWith("button.") || (x.startsWith("switch.") && piatt(x) === "wake_on_lan"));
  R.riavvia = B.find(x => x.startsWith("button.") && (deviceClass(x) === "restart" || /reboot|restart|riavvi/i.test(testo(x))) && !/reconnect|riconnett/i.test(testo(x))) || null;
  R.spegni = B.find(x => x.startsWith("button.") && /shutdown|power_off|poweroff|spegn|\bhalt\b|_stop$|\bstop\b/i.test(testo(x))) || null;
  R.accendi = B.find(x => (x.startsWith("switch.") && piatt(x) === "wake_on_lan") || (x.startsWith("button.") && (/wake|power_on|poweron|accendi|_start$|\bstart\b|\bwol\b/i.test(testo(x)) || piatt(x) === "wake_on_lan"))) || null;
  R.agg = E.find(x => x.startsWith("update.") && S[x].state === "on") || null;
  /* stampanti: stato e inchiostri/toner */
  R.inchiostri = sens.filter(x => pct(x) && /ink|toner|inchiostr|marker|drum|tamburo|black|cyan|magenta|yellow|nero|ciano|giallo/i.test(testo(x)));
  R.statoTesto = trova(sens, x => !pct(x) && isNaN(+S[x].state) && /status|stato|state$|printer|stampante/i.test(testo(x)) || (STAMPANTE.test(piatt(x)) && x === sens[0] && isNaN(+S[x].state))) || null;
  return R;
}
/** il dispositivo è acceso? true / false / null (non lo so) */
function acceso(r, E) {
  if (r.stato && S[r.stato]) return ok(r.stato) ? S[r.stato].state === "on" : false;
  if (r.accendi?.startsWith("switch.") && ok(r.accendi)) return S[r.accendi].state === "on";
  const conValore = E.filter(x => !/^(button|update|switch|image|device_tracker)\./.test(x));
  if (!conValore.length) return null;
  return conValore.some(ok);
}

/** punteggio da modem/router */
function puntiRouter(k, E) {
  const T = testoDev(k, E); let p = 0;
  if (E.some(x => isRate(x) && !MAX.test(testo(x)))) p += 2;
  if (E.some(x => x.startsWith("binary_sensor.") && deviceClass(x) === "connectivity")) p += 2;
  if (E.some(x => x.startsWith("sensor.") && (IP4.test(S[x].state) || IP6.test(S[x].state)) && /external|public|wan|pubblic|esterno|ip/i.test(testo(x)))) p += 3;
  if (E.some(x => x.startsWith("button.") && (deviceClass(x) === "restart" || /reboot|riavvi/i.test(testo(x))))) p += 2;
  if (E.some(x => x.startsWith("switch.") && /wi.?fi|wlan|guest|ospit/i.test(testo(x)))) p += 2;
  if (NOME_ROUTER.test(T)) p += 3;
  if (E.some(x => x.startsWith("device_tracker.") && attr(x, "source_type") === "router")) p -= 4;   // un dispositivo collegato al router, non il router
  return p;
}

/** tutto quello che trovo, una volta ogni tanto (memo sugli stati) */
function trovaTutto() {
  const c = conf(), key = Object.keys(S).length + ":" + Object.keys(DEVICES).length + ":" + JSON.stringify(c);
  if (memo.k === key && memo.v) return memo.v;
  const G = perDispositivo(), tolti = new Set(c.tolti || []), D = [], U = [], ST = [];
  const extra = new Set((c.extra || []).map(id => REG[id]?.device || id).filter(k => G[k]));
  for (const [k, E] of Object.entries(G)) {
    if (DEVICES[k]?.disabled) continue;
    const pl = E.map(piatt).find(Boolean) || "", T = testoDev(k, E);
    if (SPEED.test(pl) || (!REG[k] && /speedtest|fast_com/.test(k))) { ST.push(...E); continue; }
    if (UPS.test(pl) || (/\bups\b|gruppo di continuit|continuity/i.test(T) && E.some(x => x.startsWith("sensor.") && pct(x) && (deviceClass(x) === "battery" || /charge|carica|batter/i.test(testo(x)))))) { if (!tolti.has(k)) U.push(k); continue; }
    let tipo = null;
    if (pl === "ping" && E.length && E.every(x => INTERNET_PING.test(testo(x)) || x.startsWith("sensor."))) continue;   // ping a internet: serve per lo stato della connessione
    if (ROUTER.test(pl) || NOME_ROUTER.test(T)) { if (puntiRouter(k, E) >= 3) tipo = "router"; }
    if (!tipo && STAMPANTE.test(pl)) tipo = "stampante";
    if (!tipo && (SERVER.test(pl) || NOME_SERVER.test(T))) {
      const r = ruoli(k, E);
      if (r.cpu || r.ram || r.disco || r.stato || r.uptime || r.accendi || r.riavvia || pl === "ping" || pl === "wake_on_lan" || pl === "rpi_power") tipo = "server";
    }
    if (!tipo && /printer|stampante/i.test(T) && E.some(x => x.startsWith("sensor."))) tipo = "stampante";
    if (!tipo && extra.has(k)) tipo = "altro";
    if (!tipo) continue;
    /* tipo più preciso dal nome */
    if (tipo === "server") tipo = /raspberry|raspi|\brpi\b|rpi_power/i.test(T + " " + pl) ? "rpi" : /\bnas\b|synology|diskstation|truenas|qnap|unraid|openmediavault/i.test(T + " " + pl) ? "nas"
      : /\bvm\b|qemu|lxc|container|virtual/i.test(T) || (pl === "proxmoxve" && !/node|nodo|\bpve\b/i.test(nomeDev(k))) ? "vm" : /\bpc\b|desktop|laptop|portatile|notebook|workstation|gaming|imac|macbook/i.test(T) ? "pc" : "server";
    if (!tolti.has(k)) D.push({ k, tipo: c.tipi?.[k] || tipo, E, pl });
  }
  /* aggiunti a mano ma non riconosciuti */
  for (const k of extra) if (!D.some(d => d.k === k) && !U.includes(k) && !tolti.has(k)) D.push({ k, tipo: c.tipi?.[k] || "altro", E: G[k], pl: G[k].map(piatt).find(Boolean) || "" });
  const nascosti = [...tolti].filter(k => G[k]);
  memo = { k: key, v: { D, U, ST, G, nascosti } };
  return memo.v;
}
/** ricalcolo al massimo ogni 250 ms (la pagina, la Home e il menu li chiedono più volte per disegno) o se cambiano le scelte */
const ogni = f => { let t0 = 0, k0 = "", v; return () => { const n = performance.now(), k = JSON.stringify(conf()); if (n - t0 > 250 || k !== k0) { v = f(); t0 = n; k0 = k; } return v; }; };
export const dispositivi = ogni(() => trovaTutto().D.map(d => ({ ...d, r: ruoli(d.k, d.E), nome: c0(d.k) })).map(d => ({ ...d, on: acceso(d.r, d.E) }))
  .sort((a, b) => ORDINE_TIPI.indexOf(a.tipo) - ORDINE_TIPI.indexOf(b.tipo) || a.nome.localeCompare(b.nome, LOC)));
const c0 = k => conf().nomi?.[k] || nomeDev(k);

/* ---------- internet ---------- */
const internet = ogni(internetOra);
function internetOra() {
  const c = conf().inet || {}, { D, ST } = trovaTutto(), scelto = r => c[r] === "none" ? null : c[r] && S[c[r]] ? c[r] : undefined;
  const routers = D.filter(d => d.tipo === "router").sort((a, b) => puntiRouter(b.k, b.E) - puntiRouter(a.k, a.E));
  const RE = routers.flatMap(d => d.E);
  const rates = RE.filter(x => isRate(x) && !MAX.test(testo(x)) && !/total|totale|today|oggi|month|mese/i.test(testo(x)));
  let down = rates.find(x => GIU.test(testo(x))) || null, up = rates.find(x => SU.test(testo(x)) && x !== down) || null;
  let maxDown = RE.find(x => isRate(x) && MAX.test(testo(x)) && GIU.test(testo(x))) || null, maxUp = RE.find(x => isRate(x) && MAX.test(testo(x)) && SU.test(testo(x))) || null;
  /* stato: connettività del router, poi ping verso internet */
  const pingNet = Object.keys(S).filter(x => x.startsWith("binary_sensor.") && !REG[x]?.hidden && (piatt(x) === "ping" || /ping/.test(x)) && INTERNET_PING.test(testo(x)));
  const conn = RE.filter(x => x.startsWith("binary_sensor.") && deviceClass(x) === "connectivity");
  let stato = conn.find(x => /wan|internet|connection|connessione|connected|online/i.test(testo(x))) || conn[0] || pingNet[0] || null;
  let ip = RE.find(x => x.startsWith("sensor.") && IP4.test(S[x].state) && /external|public|wan|pubblic|esterno/i.test(testo(x)))
    || Object.keys(S).find(x => x.startsWith("sensor.") && piatt(x) === "dnsip" && IP4.test(S[x].state)) || null;
  const daQuando = RE.find(x => deviceClass(x) === "timestamp" && /connection|connessione|wan|online/i.test(testo(x))) || null;
  /* speedtest */
  const SP = [...ST, ...Object.keys(S).filter(x => x.startsWith("sensor.") && /speedtest|fast_com|librespeed/.test(x) && !ST.includes(x))].filter(x => x.startsWith("sensor."));
  let sd = SP.find(x => /download|scaric/i.test(testo(x))) || (SP.find(x => /fast_com/.test(x)) ?? null), su = SP.find(x => /upload|caric/i.test(testo(x)) && !/download/i.test(testo(x))) || null,
    sp = SP.find(x => /ping|latenz|latency/i.test(testo(x))) || null;
  const s = { stato: scelto("stato"), down: scelto("down"), up: scelto("up"), ip: scelto("ip"), sd: scelto("sd"), su: scelto("su"), sp: scelto("sp") };
  if (s.stato !== undefined) stato = s.stato; if (s.down !== undefined) down = s.down; if (s.up !== undefined) up = s.up; if (s.ip !== undefined) ip = s.ip;
  if (s.sd !== undefined) sd = s.sd; if (s.su !== undefined) su = s.su; if (s.sp !== undefined) sp = s.sp;
  /* collegato? */
  let collegato = null;
  if (stato && S[stato]) collegato = ok(stato) ? S[stato].state === "on" : null;
  else if (pingNet.length) collegato = pingNet.some(x => S[x].state === "on");
  else if (down && ok(down)) collegato = true;
  const ospiti = guest(RE);
  return { routers, down, up, maxDown, maxUp, stato, ip, daQuando, sd, su, sp, collegato, ospiti, pingNet };
}

/* ---------- Wi-Fi ospiti ---------- */
function guest(RE) {
  const c = conf().ospiti || {};
  const sw = c.sw === "none" ? null : (c.sw && S[c.sw] ? c.sw : RE.find(x => x.startsWith("switch.") && /guest|ospit/i.test(testo(x)))
    || Object.keys(S).find(x => x.startsWith("switch.") && !REG[x]?.hidden && /(guest|ospit)\w*_?(wi.?fi|wlan|rete|network)|(wi.?fi|wlan)\w*_?(guest|ospit)/i.test(x)) || null);
  /* FRITZ!Box: l'interruttore si chiama «<modem> Wi-Fi <nome della rete>» */
  const daNome = sw ? nmHA(sw).replace(DEVICES[REG[sw]?.device]?.name || "\u0000", "").replace(/^\s*wi-?fi\s+/i, "").trim() : "";
  const ssid = c.ssid || (sw && (attr(sw, "ssid") || attr(sw, "SSID") || (piatt(sw) === "fritz" ? daNome : ""))) || "", pwd = c.pwd || (sw && (attr(sw, "password") || attr(sw, "passphrase"))) || "";
  return sw || ssid ? { sw, ssid, pwd, tipo: c.tipo || "WPA", nome: ssid || daNome || (sw ? nm(sw) : "") } : null;
}

/* ---------- dispositivi collegati (device_tracker del router) ---------- */
const trackers = () => Object.keys(S).filter(x => x.startsWith("device_tracker.") && !REG[x]?.hidden && (attr(x, "source_type") === "router" || (ROUTER.test(piatt(x)) && !/gps|bluetooth/.test(attr(x, "source_type") || ""))));
/** voci del registro create oggi (il registro completo dice quando Home Assistant ha visto un'entità la prima volta) */
const registro = () => cached("rt:registro", 10 * 60000, () => ws({ type: "config/entity_registry/list" }).catch(() => []));
function nuoviOggi() {
  const R = registro(); if (!Array.isArray(R)) return null;
  const da = new Date(); da.setHours(0, 0, 0, 0);
  const quando = e => typeof e.created_at === "number" ? e.created_at * 1000 : e.created_at ? new Date(e.created_at).getTime() : 0;
  return R.filter(e => e.entity_id?.startsWith("device_tracker.") && (ROUTER.test(e.platform || "") || S[e.entity_id] && attr(e.entity_id, "source_type") === "router") && quando(e) >= da.getTime())
    .map(e => ({ id: e.entity_id, nome: S[e.entity_id] ? nm(e.entity_id) : e.name || e.original_name || e.entity_id.split(".")[1].replace(/_/g, " "), quando: quando(e), spento: !!e.disabled_by,
      ip: attr(e.entity_id, "ip"), on: S[e.entity_id]?.state === "home" })).sort((a, b) => b.quando - a.quando);
}

/* ---------- UPS ---------- */
function upsInfo(k) {
  const E = trovaTutto().G[k] || [], sens = E.filter(x => x.startsWith("sensor.")), T = x => testo(x), sc = conf().sens?.[k] || {};
  const pick = (r, f) => sc[r] && S[sc[r]] ? sc[r] : sens.find(f) || null;
  const carica = pick("carica", x => pct(x) && (deviceClass(x) === "battery" || /battery_charge|charge|carica|bcharge|_battery$/i.test(T(x))) && !/low|warning|restart|min/i.test(T(x)));
  const autonomia = pick("autonomia", x => /runtime|time_left|timeleft|autonomia|tempo_residuo/i.test(T(x)) && !/low|min|warning/i.test(T(x)));
  const carico = pick("carico", x => pct(x) && /load|carico|loadpct/i.test(T(x)));
  const statoS = pick("stato", x => /status|stato/i.test(T(x)) && !/data|_raw|alarm/i.test(T(x)) && isNaN(+S[x].state)) || sens.find(x => /status_data|statflag/i.test(T(x)));
  const online = E.find(x => x.startsWith("binary_sensor.") && /online|status|power|rete/i.test(T(x)));
  const tensione = sens.find(x => /input_voltage|line_?v|tensione_ingresso|linev/i.test(T(x)) || (deviceClass(x) === "voltage" && /input|ingresso|line/i.test(T(x))));
  const st = statoS && ok(statoS) ? String(S[statoS].state) : "";
  const aBatteria = /on ?batt|onbatt|\bOB\b|discharg|scarica|a batteria|battery mode/i.test(st) || (online && ok(online) && S[online].state === "off");
  const bassa = /\bLB\b|low ?batt|batteria bassa/i.test(st);
  const inCarica = /charg|CHRG|in carica/i.test(st) && !/discharg/i.test(st);
  let sec = null;
  if (autonomia && val(autonomia) != null) { const u = unit(autonomia); sec = val(autonomia) * (u === "min" ? 60 : u === "h" ? 3600 : u === "d" ? 86400 : 1); }
  return { k, nome: c0(k), carica, autonomia, carico, statoS, tensione, aBatteria, bassa, inCarica, sec, st, raggiungibile: E.some(ok) };
}

/* ---------- disegni ---------- */
/** scena: casa → modem → internet; i pallini scorrono quando la linea è su */
function scenaInternet(I) {
  const k = I.collegato === true ? "on" : I.collegato === false ? "ko" : "nd";
  return `<svg class="rt1sc ${k}" viewBox="0 0 320 96" aria-hidden="true">
    <path class="ln" d="M70 58 H138 M182 58 H252"/>
    <path class="fl" d="M70 58 H138"/><path class="fl b" d="M182 58 H252"/>
    <g class="cs" transform="translate(22 30)"><path d="M0 22 L24 2 L48 22 V52 H0 Z" class="mu"/><rect x="18" y="32" width="12" height="20" rx="2" class="po"/><rect x="6" y="26" width="9" height="9" rx="1.5" class="fi"/><rect x="33" y="26" width="9" height="9" rx="1.5" class="fi"/></g>
    <g class="rt" transform="translate(138 42)"><rect x="0" y="6" width="44" height="22" rx="6" class="mu"/><path d="M10 6 L6 -8 M34 6 L38 -8" class="an"/><circle cx="12" cy="17" r="2.2" class="led"/><circle cx="21" cy="17" r="2.2" class="led"/><circle cx="30" cy="17" r="2.2" class="led w"/></g>
    <g class="gl" transform="translate(256 24)"><circle cx="32" cy="34" r="27" class="mu"/><ellipse cx="32" cy="34" rx="11" ry="27" class="me"/><path d="M5 34 H59 M9 20 H55 M9 48 H55" class="me"/></g>
    ${k === "ko" ? `<g class="x" transform="translate(217 58)"><circle r="10"/><path d="M-4 -4 L4 4 M4 -4 L-4 4"/></g>` : ""}
  </svg>`;
}
/** barra di velocità con il riferimento al massimo */
function barra(m, max, cls) {
  const p = m == null ? 0 : Math.max(2, Math.min(100, max ? m / max * 100 : 0));
  return `<span class="rt1bar ${cls}"><i style="width:${p}%"></i></span>`;
}
/** scala «tonda» per le barre: il massimo del modem se c'è, altrimenti 10/50/100/300/500/1000… */
function scala(m, maxId, sp) {
  const mx = maxId ? mbit(maxId) : null; if (mx) return mx;
  const ref = Math.max(m || 0, sp || 0) * 1.15;
  return [10, 30, 50, 100, 200, 300, 500, 1000, 2500, 10000].find(x => x >= ref) || ref || 100;
}
const metro = (lab, id, cls = "", titolo = "") => {
  if (!id) return "";
  const v = val(id), p = v == null ? 0 : Math.max(0, Math.min(100, v)), lv = p >= 90 ? "r" : p >= 75 ? "o" : "";
  return `<div class="rt1m ${lv} ${cls}" ${titolo ? `title="${esc(titolo)}"` : ""}><span>${lab}</span><span class="rt1mb"><i style="width:${p}%"></i></span><b>${v == null ? "—" : Math.round(v) + "%"}</b></div>`;
};
function uptimeTesto(id) {
  if (!id || !ok(id)) return null;
  if (deviceClass(id) === "timestamp") { const ms = new Date(S[id].state).getTime(); return isNaN(ms) ? null : durata((Date.now() - ms) / 1000); }
  const v = val(id), u = unit(id); if (v == null) return null;
  return durata(v * (u === "min" ? 60 : u === "h" ? 3600 : u === "d" ? 86400 : 1));
}

/* ---------- schede ---------- */
let ipVisto = false, spMetrica = "sd", spInCorso = 0;
function cardInternet(I) {
  const dm = I.down ? mbit(I.down) : null, um = I.up ? mbit(I.up) : null, spd = I.sd ? mbit(I.sd) : null, spu = I.su ? mbit(I.su) : null;
  const sD = scala(dm, I.maxDown, spd), sU = scala(um, I.maxUp, spu);
  const st = I.collegato === true ? ["ok", t("Connesso", "Connected")] : I.collegato === false ? ["bad", t("Nessuna connessione", "No connection")] : ["info", t("Stato sconosciuto", "Unknown status")];
  const da = I.daQuando && ok(I.daQuando) ? durata((Date.now() - new Date(S[I.daQuando].state).getTime()) / 1000) : I.stato && S[I.stato] ? durata((Date.now() - new Date(S[I.stato].last_changed).getTime()) / 1000) : null;
  const ipv = I.ip && ok(I.ip) ? S[I.ip].state : null;
  const right = UI.edit && isAdmin() ? `<button class="btn sm" data-act="rtInet">✏️ ${t("Sensori", "Sensors")}</button>` : "";
  return card(`🌐 ${t("Internet", "Internet")} <span class="tag ${st[0]}">${st[1]}</span>`, `
    <div class="rt1in">
      ${scenaInternet(I)}
      <div class="rt1vel">
        ${I.down || I.up ? `
        <div class="rt1v"><span class="k">⬇ ${t("Download", "Download")}</span><b>${velocita(dm)}</b>${barra(dm, sD, "d")}<small>${t("adesso, dal modem", "now, from the modem")} · ${t("scala", "scale")} ${velocita(sD)}</small></div>
        <div class="rt1v"><span class="k">⬆ ${t("Upload", "Upload")}</span><b>${velocita(um)}</b>${barra(um, sU, "u")}<small>${t("adesso, dal modem", "now, from the modem")} · ${t("scala", "scale")} ${velocita(sU)}</small></div>`
        : `<div class="small muted">${t("Il modem non dice la velocità in tempo reale. Con ✏️ puoi scegliere i sensori di download e upload.", "The modem doesn't report live speed. With ✏️ you can pick the download and upload sensors.")}</div>`}
      </div>
    </div>
    <div class="rt1ch">
      ${da && I.collegato !== false ? `<span>⏱ ${t("connesso da", "up for")} <b>${esc(da)}</b></span>` : I.collegato === false && I.stato ? `<span class="bad">⏱ ${t("giù da", "down for")} <b>${esc(durata((Date.now() - new Date(S[I.stato].last_changed).getTime()) / 1000))}</b></span>` : ""}
      ${ipv ? `<button class="rt1ip ${ipVisto ? "" : "blur"}" data-act="rtIp" title="${t("Tocca per mostrare o nascondere", "Tap to show or hide")}">🌍 IP <b>${esc(ipVisto ? ipv : ipv.replace(/\d/g, "•"))}</b></button>` : ""}
      ${I.sp && val(I.sp) != null && I.collegato !== false ? `<span>📶 ping <b>${fnum(val(I.sp), 0)} ms</b></span>` : ""}
      ${I.routers[0] ? `<span>📡 ${esc(c0(I.routers[0].k))}</span>` : ""}
    </div>`, { cls: "span2 rt1i", right });
}
function cardSpeedtest(I) {
  if (!I.sd && !I.su) return "";
  const corrente = { sd: I.sd, su: I.su, sp: I.sp }[spMetrica] || I.sd || I.su, ultimo = [I.sd, I.su, I.sp].filter(x => x && S[x]).map(x => new Date(S[x].last_updated || S[x].last_changed).getTime()).sort((a, b) => b - a)[0];
  const inCorso = Date.now() - spInCorso < 90000 && !(ultimo > spInCorso);   // finita quando arrivano i valori nuovi
  let grafico = "";
  if (corrente) {
    const start = new Date(Date.now() - 7 * 864e5), r = statistiche([corrente], start, "hour", ["mean", "min", "max"]);
    if (r === undefined) grafico = `<div class="small muted">${t("Carico…", "Loading…")}</div>`;
    else {
      const f = spMetrica === "sp" ? 1 : fattore(unit(corrente)) ?? 1;
      const P = (r?.[corrente] || []).filter(p => p.mean != null).map(p => ({ x: p.start, y: p.mean * f, lo: p.min != null ? p.min * f : null, hi: p.max != null ? p.max * f : null }));
      grafico = linea(P, { colore: spMetrica === "su" ? "#bf5af2" : spMetrica === "sp" ? "#ff9f0a" : "#64d2ff", u: spMetrica === "sp" ? " ms" : "", periodo: "day" });
    }
  }
  const box = (k, id, v, u) => `<button class="rt1sk ${spMetrica === k ? "act" : ""}" data-act="rtSpM" data-v="${k}" ${id ? "" : "disabled"}><small>${{ sd: "⬇ Download", su: "⬆ Upload", sp: "⏱ Ping" }[k]}</small><b>${v}</b><span>${u}</span></button>`;
  const vv = id => id ? mbit(id) : null;
  return card(`🚀 ${t("Speedtest", "Speedtest")}`, `
    <div class="rt1sks">${box("sd", I.sd, vv(I.sd) == null ? "—" : fnum(vv(I.sd), vv(I.sd) < 100 ? 1 : 0), "Mbit/s")}${box("su", I.su, vv(I.su) == null ? "—" : fnum(vv(I.su), vv(I.su) < 100 ? 1 : 0), "Mbit/s")}${box("sp", I.sp, I.sp && val(I.sp) != null ? fnum(val(I.sp), 0) : "—", "ms")}</div>
    <div class="rt1g">${grafico}</div>
    <div class="row between rt1sf"><span class="small muted">${ultimo ? t("Ultima prova", "Last test") + " " + esc(ago(new Date(ultimo).toISOString())) : ""} · ${t("ultimi 7 giorni", "last 7 days")}</span>
      <button class="btn sm pri" data-act="rtSpeed" ${inCorso ? "disabled" : ""}>${inCorso ? "⏳ " + t("Prova in corso…", "Testing…") : "▶ " + t("Prova adesso", "Test now")}</button></div>`, { cls: "rt1st" });
}
function cardCollegati(I) {
  const T = trackers(), on = T.filter(x => S[x].state === "home"), N = nuoviOggi();
  if (!T.length && !N?.length) return "";
  const riga = n => `<div class="li rt1nw ${n.on ? "on" : ""}" ${S[n.id] ? `data-act="more" data-id="${n.id}" role="button"` : ""}><span class="ic">${n.spento ? "💤" : "🆕"}</span><div class="tx"><b>${esc(n.nome)}</b>
    <span>${t("visto per la prima volta alle", "first seen at")} ${esc(new Date(n.quando).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }))}${n.ip ? " · " + esc(n.ip) : ""}${n.spento ? " · " + t("disattivato in Home Assistant", "disabled in Home Assistant") : ""}</span></div>
    <span class="rt1dot ${n.on ? "on" : ""}"></span></div>`;
  return card(`🔗 ${t("Dispositivi collegati", "Connected devices")}`, `
    <div class="rt1cn"><b>${on.length}</b><span>${t("online adesso", "online now")}<small>${t("su", "of")} ${T.length} ${t("che il router conosce", "known to the router")}</small></span></div>
    <div class="fl1">🆕 ${t("Nuovi visti oggi", "New today")}${N?.length ? ` <span class="tag warn">${N.length}</span>` : ""}</div>
    ${N == null ? `<div class="small muted">${t("Controllo…", "Checking…")}</div>` : N.length ? `<div class="stack">${N.slice(0, 8).map(riga).join("")}</div>${N.length > 8 ? `<div class="small muted" style="margin-top:6px">+ ${N.length - 8}</div>` : ""}`
      : `<div class="small muted">✅ ${t("Nessun dispositivo nuovo oggi.", "No new devices today.")}</div>`}`);
}
function cardOspiti(I) {
  const o = I.ospiti; if (!o) return "";
  const on = o.sw ? S[o.sw]?.state === "on" : null, puoQR = !!(o.ssid && (o.pwd || o.tipo === "nopass"));
  return card(`📶 ${t("Wi-Fi ospiti", "Guest Wi-Fi")}`, `
    <div class="rt1gu">
      ${o.sw ? `<div class="li ${ok(o.sw) ? "" : "dis"}"><span class="ic">${on ? "🟢" : "⚪"}</span><div class="tx"><b>${esc(o.nome)}</b><span>${!ok(o.sw) ? t("non raggiungibile", "unavailable") : on ? t("acceso: gli ospiti possono collegarsi", "on: guests can connect") : t("spento", "off")}</span></div>
        ${ok(o.sw) ? `<button class="sw ${on ? "on" : ""}" data-act="rtOspT" data-id="${o.sw}" aria-label="${t("Wi-Fi ospiti", "Guest Wi-Fi")}"><i></i></button>` : ""}</div>` : ""}
      ${puoQR ? `<button class="rt1qrb" data-act="rtQR">${qrSvg(wifiQR(o.ssid, o.pwd, o.tipo), { cls: "rt1qr", titolo: "QR Wi-Fi" })}<span><b>${t("Inquadra per collegarti", "Scan to connect")}</b><small>${t("tocca per ingrandire", "tap to enlarge")}</small></span></button>`
        : `<div class="small muted">${isAdmin() ? t("Per il QR scrivi nome e password della rete ospiti con ✏️.", "For the QR code enter the guest network name and password with ✏️.") : t("Il QR compare quando l'amministratore inserisce la password.", "The QR appears once the admin enters the password.")}</div>`}
      ${isAdmin() ? `<button class="btn sm" data-act="rtOsp">✏️ ${t("Rete ospiti", "Guest network")}</button>` : ""}
    </div>`);
}
function cardUps(k) {
  const u = upsInfo(k), c = u.carica ? val(u.carica) : null, lv = c == null ? "nd" : u.bassa || c < 25 ? "r" : c < 50 ? "o" : "g";
  const stato = !u.raggiungibile ? ["bad", t("non raggiungibile", "unavailable")] : u.aBatteria ? ["bad", t("a batteria: manca la corrente", "on battery: power is out")] : u.inCarica ? ["info", t("dalla rete, in carica", "on mains, charging")] : ["ok", t("dalla rete", "on mains")];
  const R = 34, C = 2 * Math.PI * R, p = c == null ? 0 : Math.max(0, Math.min(100, c)) / 100;
  const html = `<section class="card rt1ups ${u.aBatteria ? "ob" : ""}">
    <div class="ch"><h2>🔋 ${esc(u.nome)} <span class="tag ${stato[0]}">${stato[1]}</span></h2>${UI.edit && isAdmin() ? `<button class="btn sm" data-act="rtEd" data-k="${esc(k)}">✏️</button>` : ""}</div>
    <div class="rt1u">
      <svg class="rt1ring ${lv}" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${R}" class="bg"/><circle cx="42" cy="42" r="${R}" class="fg" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/>
        <text x="42" y="47" text-anchor="middle">${c == null ? "—" : Math.round(c) + "%"}</text></svg>
      <div class="rt1ud">
        <div><small>${t("Autonomia", "Runtime")}</small><b>${u.sec != null ? esc(durata(u.sec)) : "—"}</b></div>
        <div><small>${t("Carico", "Load")}</small><b>${u.carico && val(u.carico) != null ? Math.round(val(u.carico)) + "%" : "—"}</b>${u.carico ? `<span class="rt1mb"><i style="width:${Math.max(0, Math.min(100, val(u.carico) || 0))}%"></i></span>` : ""}</div>
        ${u.tensione && val(u.tensione) != null ? `<div><small>${t("Rete elettrica", "Mains")}</small><b>${fnum(val(u.tensione), 0)} V</b></div>` : ""}
        ${u.st ? `<div><small>${t("Stato", "Status")}</small><b class="mono">${esc(u.st)}</b></div>` : ""}
      </div>
    </div></section>`;
  return html;
}
/** stato delle stampanti (IPP: idle, printing, stopped) in parole */
const statoStampante = s => ({ idle: t("pronta", "ready"), printing: t("sta stampando", "printing"), stopped: t("ferma", "stopped"), processing: t("sta stampando", "printing"),
  sleep: t("a riposo", "sleeping"), offline: "offline", error: t("errore", "error") }[String(s).toLowerCase()] || String(s));
function cardDispositivo(d) {
  const T = TIPI()[d.tipo] || TIPI().altro, r = d.r, up = uptimeTesto(r.uptime), temp = r.temp && val(r.temp) != null ? fnum(val(r.temp), 0) + "°" : null;
  const stato = d.on === true ? ["on", t("acceso", "on")] : d.on === false ? ["off", t("spento", "off")] : ["nd", t("stato sconosciuto", "unknown")];
  const st = r.statoTesto && ok(r.statoTesto) ? statoStampante(S[r.statoTesto].state) : null;
  const tasto = (id, ic, n, ask, v) => id && S[id] && (S[id].state !== "unavailable" || id.startsWith("switch.")) ? `<button class="btn sm ${v || ""}" data-act="rtPremi" data-id="${id}" data-ask="${esc(ask)}">${ic} ${n}</button>` : "";
  const tasti = [d.on !== true ? tasto(r.accendi, "⏻", t("Accendi", "Turn on"), t("Tocca ancora per accendere", "Tap again to turn on"), "warm") : "",
    d.on !== false ? tasto(r.riavvia, "🔄", t("Riavvia", "Restart"), t("Tocca ancora per riavviare", "Tap again to restart")) : "",
    d.on !== false && r.spegni && r.spegni !== r.riavvia ? tasto(r.spegni, "⏻", t("Spegni", "Shut down"), t("Tocca ancora per spegnere", "Tap again to shut down"), "bad") : ""].filter(Boolean).join("");
  const inch = r.inchiostri.filter(x => val(x) != null).slice(0, 6);
  const colore = x => /cyan|ciano/i.test(testo(x)) ? "#32ade6" : /magenta/i.test(testo(x)) ? "#ff2d92" : /yellow|giallo/i.test(testo(x)) ? "#ffd60a" : "var(--tx2)";
  const html = `<section class="card rt1d ${stato[0]}">
    <div class="rt1dh"><span class="rt1di">${T[0]}<i class="rt1dot ${stato[0]}"></i></span><div class="tx"><b>${esc(d.nome)}</b><span>${esc(T[1])} · ${stato[1]}${up && d.on !== false ? " · " + t("da", "for") + " " + esc(up) : ""}</span></div>
      ${temp ? `<span class="rt1t" ${r.temp ? `data-act="more" data-id="${r.temp}" role="button"` : ""}>🌡 ${temp}</span>` : ""}</div>
    ${r.cpu || r.ram || r.disco ? `<div class="rt1ms" ${d.on === false ? 'data-off="1"' : ""}>${metro("CPU", r.cpu)}${metro("RAM", r.ram)}${r.dischi > 1 ? metro(t("Dischi", "Disks"), r.disco, "", t(`il più pieno di ${r.dischi}: ${nm(r.disco)}`, `the fullest of ${r.dischi}: ${nm(r.disco)}`)) : metro(t("Disco", "Disk"), r.disco)}</div>` : ""}
    ${st ? `<div class="small rt1ps">🖨 ${esc(st)}</div>` : ""}
    ${inch.length ? `<div class="rt1ink">${inch.map(x => `<span title="${esc(nm(x))}"><i style="height:${Math.max(4, Math.min(100, val(x)))}%;background:${colore(x)}"></i></span>`).join("")}<small>${t("inchiostro / toner", "ink / toner")}</small></div>` : ""}
    ${r.agg || tasti ? `<div class="rt1ac">${r.agg ? `<button class="btn sm" data-act="go" data-id="aggiornamenti">⬆️ ${t("Aggiornamento", "Update")}</button>` : ""}${tasti}</div>` : ""}
  </section>`;
  if (!UI.edit || !isAdmin()) return html;
  return `<div class="ed1 rt1ed">${html}<div class="edb"><button data-act="rtEd" data-k="${esc(d.k)}" aria-label="${t("Modifica", "Edit")}">✏️</button><button data-act="rtTogli" data-k="${esc(d.k)}" aria-label="${t("Togli", "Remove")}">✕</button></div></div>`;
}

function pagina() {
  const I = internet(), D = dispositivi(), { U, nascosti } = trovaTutto();
  const haInternet = I.routers.length || I.stato || I.down || I.sd || I.pingNet.length;
  const sezione = (tit, html) => html ? `<div class="sec span3 rt1sec">${tit}</div>${html}` : "";
  const modifica = UI.edit && isAdmin() ? `<section class="card span3 rt1e">
      <div class="ch"><h2>✏️ ${t("Scelte della rete", "Network settings")}</h2></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="add1" data-act="rtAggiungi"><span>＋</span>${t("Aggiungi un dispositivo", "Add a device")}</button>
        <button class="btn" data-act="rtInet">🌐 ${t("Sensori di internet e speedtest", "Internet and speedtest sensors")}</button><button class="btn" data-act="rtOsp">📶 ${t("Wi-Fi ospiti", "Guest Wi-Fi")}</button></div>
      ${nascosti.length ? `<div class="fl1">👁 ${t("Tolti dalla pagina", "Removed from the page")} (${nascosti.length})</div><div class="stack">${nascosti.map(k => `<div class="li"><span class="ic">🙈</span><div class="tx"><b>${esc(c0(k))}</b><span>${esc(DEVICES[k]?.model || k)}</span></div><button class="btn sm" data-act="rtRimetti" data-k="${esc(k)}">👁 ${t("Rimetti", "Restore")}</button></div>`).join("")}</div>` : ""}
    </section>` : "";
  const vuoto = !haInternet && !D.length && !U.length ? card("🌐 " + t("Rete", "Network"), empty(t("Non ho trovato modem, server o gruppi di continuità in Home Assistant.", "I found no modem, server or UPS in Home Assistant.")), { cls: "span3" }) : "";
  const altro = [cardCollegati(I), cardOspiti(I), ...U.map(cardUps)].filter(Boolean).join("");
  return `<div class="g g3 rt1">
    ${haInternet ? cardInternet(I) + (cardSpeedtest(I) || `<section class="card rt1st">${empty(t("Nessuno speedtest: aggiungi l'integrazione Speedtest.net in Home Assistant per misurare la linea.", "No speedtest: add the Speedtest.net integration in Home Assistant to measure your line."))}</section>`) : ""}
    ${vuoto}
    ${altro}
    ${sezione(`🖥️ ${t("Dispositivi e server", "Devices and servers")}`, D.map(cardDispositivo).join(""))}
    ${modifica}
  </div>`;
}

/* ---------- ✏️ schede di modifica ---------- */
const salvaR = (fn, msg) => cambia(l => { const R = l.rete = JSON.parse(JSON.stringify(l.rete || {})); fn(R); for (const k of ["nomi", "tipi", "sens", "inet", "ospiti"]) if (R[k] && !Object.keys(R[k]).length) delete R[k]; }, msg);
const RUOLI_DEV = () => [["stato", "🟢 " + t("Acceso / spento", "On / off"), id => id.startsWith("binary_sensor.") || id.startsWith("switch.")], ["cpu", "🧠 CPU (%)", id => id.startsWith("sensor.")],
  ["ram", "🧮 RAM (%)", id => id.startsWith("sensor.")], ["disco", "💽 " + t("Disco (%)", "Disk (%)"), id => id.startsWith("sensor.")], ["temp", "🌡 " + t("Temperatura", "Temperature"), id => id.startsWith("sensor.")],
  ["uptime", "⏱ " + t("Acceso da (uptime o ultimo avvio)", "Uptime or last boot"), id => id.startsWith("sensor.")]];
const RUOLI_UPS = () => [["carica", "🔋 " + t("Carica (%)", "Charge (%)")], ["autonomia", "⏳ " + t("Autonomia", "Runtime")], ["carico", "⚡ " + t("Carico (%)", "Load (%)")], ["stato", "ℹ️ " + t("Stato", "Status")]];
const RUOLI_NET = () => [["stato", "🌐 " + t("Connessione (sì/no)", "Connection (yes/no)"), id => id.startsWith("binary_sensor.")], ["down", "⬇ " + t("Download in tempo reale", "Live download"), isRate],
  ["up", "⬆ " + t("Upload in tempo reale", "Live upload"), isRate], ["ip", "🌍 " + t("IP pubblico", "Public IP"), id => id.startsWith("sensor.")],
  ["sd", "🚀 Speedtest download", id => id.startsWith("sensor.")], ["su", "🚀 Speedtest upload", id => id.startsWith("sensor.")], ["sp", "⏱ Speedtest ping", id => id.startsWith("sensor.")]];
const valoreDi = id => id && S[id] ? (ok(id) ? esc(S[id].state) + (unit(id) ? " " + esc(unit(id)) : "") : t("non raggiungibile", "unavailable")) : "—";
const rigaScelta = (act, k, r, n, id, manuale) => `<button class="pk1 ${manuale ? "sel1" : ""}" data-act="${act}" data-k="${esc(k)}" data-r="${r}"><span class="tx"><b>${n}</b><small>${id ? esc(nm(id)) + " · " + valoreDi(id) : t("nessuno", "none")}${manuale ? "" : " · ✨ " + t("automatico", "automatic")}</small></span><span class="st">›</span></button>`;

function schedaDispositivo(k) {
  const { D, U } = trovaTutto(), d = D.find(x => x.k === k), ups = U.includes(k);
  const E = trovaTutto().G[k] || [], sc = conf().sens?.[k] || {};
  const R = ups ? upsInfo(k) : d ? ruoli(k, E) : {};
  const tipo = conf().tipi?.[k] || d?.tipo || "altro";
  return `<div class="sh-head"><div><h3>✏️ ${esc(c0(k))}</h3><div class="small muted">${esc([DEVICES[k]?.maker, DEVICES[k]?.model].filter(Boolean).join(" ") || k)}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <label class="fld1"><span>${t("Nome", "Name")}</span><input id="rt1n" type="text" value="${esc(BZ.rt1n ?? conf().nomi?.[k] ?? "")}" placeholder="${esc(nomeDev(k))}"></label>
    ${ups ? "" : `<div class="fl1">${t("Tipo", "Type")}</div><div class="rt1tp">${ORDINE_TIPI.map(x => `<button class="${(bozzaTipo || tipo) === x ? "act" : ""}" data-act="rtTipo" data-k="${esc(k)}" data-v="${x}">${TIPI()[x][0]} ${TIPI()[x][1]}</button>`).join("")}</div>`}
    <div class="fl1">${t("Sensori", "Sensors")}</div>
    <div class="pkl1">${(ups ? RUOLI_UPS() : RUOLI_DEV()).map(([r, n]) => rigaScelta("rtSens", k, r, n, sc[r] === "none" ? null : R[r], !!sc[r])).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="rtSalva" data-k="${esc(k)}">💾 ${t("Salva", "Save")}</button>
      <button class="btn bad" data-act="rtTogli" data-k="${esc(k)}">✕ ${t("Togli dalla pagina", "Remove from the page")}</button></div>
    <p class="small muted" style="margin-top:12px">${t("Le scelte valgono per tutta la casa e solo nella plancia.", "Choices apply to the whole home and only in the dashboard.")}</p>`;
}
function schedaInternet() {
  const I = internet(), c = conf().inet || {};
  return `<div class="sh-head"><div><h3>🌐 ${t("Internet e speedtest", "Internet and speedtest")}</h3><div class="small muted">${t("Lascia «automatico» se va bene così.", "Leave «automatic» if it's fine.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="pkl1">${RUOLI_NET().map(([r, n]) => rigaScelta("rtNet", "", r, n, c[r] === "none" ? null : I[r], !!c[r])).join("")}</div>`;
}
function schedaOspiti() {
  const I = internet(), o = conf().ospiti || {}, g = I.ospiti || {};
  return `<div class="sh-head"><div><h3>📶 ${t("Wi-Fi ospiti", "Guest Wi-Fi")}</h3><div class="small muted">${t("Per accenderla e spegnerla e per il QR da far inquadrare.", "To turn it on and off and for the QR code to scan.")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="pkl1">${rigaScelta("rtOspSw", "", "sw", "🔘 " + t("Interruttore della rete ospiti", "Guest network switch"), o.sw === "none" ? null : g.sw, !!o.sw)}</div>
    <label class="fld1"><span>${t("Nome della rete (SSID)", "Network name (SSID)")}</span><input id="rt1ss" type="text" value="${esc(BZ.rt1ss ?? o.ssid ?? "")}" placeholder="${esc(g.ssid || t("es. Ospiti di casa", "e.g. Home guests"))}" autocomplete="off"></label>
    <label class="fld1"><span>${t("Password", "Password")}</span><input id="rt1pw" type="text" value="${esc(BZ.rt1pw ?? o.pwd ?? "")}" autocomplete="off" spellcheck="false"></label>
    <div class="fl1">${t("Protezione", "Security")}</div>
    <div class="seg">${[["WPA", "WPA/WPA2/WPA3"], ["WEP", "WEP"], ["nopass", t("Aperta", "Open")]].map(([k, n]) => `<button class="${(bozzaOsp || o.tipo || "WPA") === k ? "act" : ""}" data-act="rtOspTipo" data-v="${k}">${n}</button>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-act="rtOspSalva">💾 ${t("Salva", "Save")}</button></div>
    <p class="small muted" style="margin-top:12px">⚠️ ${t("La password della rete ospiti si salva nelle scelte della plancia: la vede chiunque usi la plancia di casa. Non scrivere qui la password della rete principale.", "The guest network password is saved in the dashboard choices: anyone using the home dashboard can see it. Don't enter your main network password here.")}</p>`;
}
function schedaQR() {
  const o = internet().ospiti || {};
  return `<div class="sh-head"><div><h3>📶 ${esc(o.ssid)}</h3><div class="small muted">${t("Inquadra con la fotocamera del telefono", "Scan with the phone camera")}</div></div><button class="x" data-act="sheetClose">×</button></div>
    <div class="rt1qrbig">${qrSvg(wifiQR(o.ssid, o.pwd, o.tipo), { cls: "rt1qr", titolo: "QR Wi-Fi " + esc(o.ssid) })}</div>
    <div class="rt1qrt"><div><small>${t("Rete", "Network")}</small><b>${esc(o.ssid)}</b></div>${o.pwd ? `<div><small>${t("Password", "Password")}</small><b class="mono">${esc(o.pwd)}</b></div>` : ""}</div>`;
}

/* ---------- azioni ---------- */
/* bozze delle schede: restano se si apre l'elenco dei sensori e si torna indietro */
let bozzaTipo = null, bozzaOsp = null, BZ = {};
document.addEventListener("input", e => { if (["rt1n", "rt1ss", "rt1pw"].includes(e.target.id)) BZ[e.target.id] = e.target.value; });
Object.assign(ACT, {
  rtIp: () => { ipVisto = !ipVisto; render(); },
  rtSpM: el => { spMetrica = el.dataset.v; render(); },
  rtSpeed: () => {
    const I = internet(), L = [I.sd, I.su, I.sp].filter(Boolean); if (!L.length) return;
    spInCorso = Date.now(); render();
    svc("homeassistant", "update_entity", {}, { entity_id: L }).then(() => toast("🚀 " + t("Speedtest avviato: ci vuole circa mezzo minuto", "Speedtest started: it takes about half a minute"))).catch(() => { spInCorso = 0; render(); });
    setTimeout(render, 91000);
  },
  rtPremi: el => {
    const id = el.dataset.id; if (!sicuro(el, el.dataset.ask)) return;
    const p = id.startsWith("switch.") ? svc("switch", "turn_on", {}, { entity_id: id }) : svc(domain(id), "press", {}, { entity_id: id });
    p.then(() => toast("✓ " + nm(id))).catch(() => {});
  },
  rtOspT: el => svc("switch", "toggle", {}, { entity_id: el.dataset.id }),
  rtQR: () => openSheet(schedaQR),
  rtEd: el => { const k = el.dataset.k; bozzaTipo = null; BZ = {}; openSheet(() => schedaDispositivo(k)); },
  rtTipo: el => { bozzaTipo = el.dataset.v; render(); },
  rtSalva: el => {
    const k = el.dataset.k, n = document.getElementById("rt1n")?.value.trim(), tipo = bozzaTipo; closeSheet();
    salvaR(R => { R.nomi = { ...(R.nomi || {}) }; R.tipi = { ...(R.tipi || {}) };
      if (n && n !== nomeDev(k)) R.nomi[k] = n; else delete R.nomi[k];
      if (tipo) R.tipi[k] = tipo; }, "💾 " + (n || nomeDev(k)));
  },
  rtTogli: el => { const k = el.dataset.k; if (UI.sheet) closeSheet(); salvaR(R => { R.tolti = [...new Set([...(R.tolti || []), k])]; R.extra = (R.extra || []).filter(id => (REG[id]?.device || id) !== k); }, "✕ " + c0(k)); },
  rtRimetti: el => { const k = el.dataset.k; salvaR(R => { R.tolti = (R.tolti || []).filter(x => x !== k); }, "👁 " + c0(k)); },
  rtSens: el => {
    const k = el.dataset.k, r = el.dataset.r, ups = trovaTutto().U.includes(k), ruolo = (ups ? RUOLI_UPS() : RUOLI_DEV()).find(x => x[0] === r), E = trovaTutto().G[k] || [];
    scegli({ titolo: ruolo[1], sotto: esc(c0(k)), filtro: id => (ruolo[2] || (x => x.startsWith("sensor.")))(id) && (E.includes(id) || !REG[id]?.hidden), area: null,
      attuale: conf().sens?.[k]?.[r] || "", nessuno: true,
      onPick: id => { salvaR(R => { R.sens = { ...(R.sens || {}) }; R.sens[k] = { ...(R.sens[k] || {}) }; if (id) R.sens[k][r] = id; else delete R.sens[k][r]; if (!Object.keys(R.sens[k]).length) delete R.sens[k]; });
        setTimeout(() => openSheet(() => schedaDispositivo(k)), 60); } });
  },
  rtInet: () => openSheet(schedaInternet),
  rtNet: el => {
    const r = el.dataset.r, ruolo = RUOLI_NET().find(x => x[0] === r);
    scegli({ titolo: ruolo[1], filtro: ruolo[2], attuale: conf().inet?.[r] || "", nessuno: true,
      onPick: id => { salvaR(R => { R.inet = { ...(R.inet || {}) }; if (id) R.inet[r] = id; else delete R.inet[r]; }); setTimeout(() => openSheet(schedaInternet), 60); } });
  },
  rtOsp: () => { bozzaOsp = null; BZ = {}; openSheet(schedaOspiti); },
  rtOspSw: () => scegli({ titolo: "🔘 " + t("Interruttore della rete ospiti", "Guest network switch"), filtro: id => id.startsWith("switch."), attuale: conf().ospiti?.sw || "", nessuno: true,
    onPick: id => { salvaR(R => { R.ospiti = { ...(R.ospiti || {}) }; if (id) R.ospiti.sw = id; else delete R.ospiti.sw; }); setTimeout(() => openSheet(schedaOspiti), 60); } }),
  rtOspTipo: el => { bozzaOsp = el.dataset.v; render(); },
  rtOspSalva: () => {
    const ssid = document.getElementById("rt1ss")?.value.trim(), pwd = document.getElementById("rt1pw")?.value, tipo = bozzaOsp;
    closeSheet();
    salvaR(R => { R.ospiti = { ...(R.ospiti || {}) }; if (ssid) R.ospiti.ssid = ssid; else delete R.ospiti.ssid; if (pwd) R.ospiti.pwd = pwd; else delete R.ospiti.pwd; if (tipo) R.ospiti.tipo = tipo; }, "💾 " + t("Wi-Fi ospiti", "Guest Wi-Fi"));
  },
  rtAggiungi: () => scegli({ titolo: "＋ " + t("Dispositivo di rete o server", "Network device or server"), sotto: t("Scegli una sua entità qualsiasi: aggiungo tutto il dispositivo.", "Pick any of its entities: I add the whole device."),
    filtro: id => /^(sensor|binary_sensor|switch|button)\./.test(id) && !REG[id]?.hidden && !dispositivi().some(d => d.E.includes(id)), auto: false,
    onPick: id => { if (!id || !S[id]) return; const k = REG[id]?.device || id; salvaR(R => { R.extra = [...new Set([...(R.extra || []), id])]; R.tolti = (R.tolti || []).filter(x => x !== k); }, "＋ " + nomeDev(k)); } }),
});

/* ---------- pagina, Home, collegamenti con le altre pagine ---------- */
/** c'è qualcosa da mostrare? */
export function haRete() {
  try { const I = internet(); return !!(I.routers.length || I.stato || I.down || I.sd || I.pingNet.length || dispositivi().length || trovaTutto().U.length || I.ospiti || trackers().length); } catch { return false; }
}
/* modem, server, NAS e Raspberry devono restare accesi: se sono spenti lo dico in Home e nel menu (PC e macchine virtuali spente sono normali) */
const IMPORTANTI = ["router", "server", "nas", "rpi"];
function homeCard() {
  const I = internet(), D = dispositivi(), spenti = D.filter(d => d.on === false && IMPORTANTI.includes(d.tipo)), U = trovaTutto().U.map(upsInfo).filter(u => u.aBatteria);
  const st = I.collegato === true ? ["ok", "🟢", t("Internet ok", "Internet ok")] : I.collegato === false ? ["bad", "🔴", t("Internet giù", "Internet down")] : ["", "⚪", t("Internet", "Internet")];
  const dm = I.down ? mbit(I.down) : null, um = I.up ? mbit(I.up) : null, on = trackers().filter(x => S[x].state === "home").length;
  return card("🌐 " + t("Rete", "Network"), `<button class="rt1h ${st[0]}" data-act="go" data-id="rete">
      <span class="rt1hi">${st[1]}</span><div class="tx"><b>${st[2]}</b><span>${I.collegato === false && I.stato && S[I.stato] ? t("giù da", "down for") + " " + esc(durata((Date.now() - new Date(S[I.stato].last_changed).getTime()) / 1000)) : dm != null || um != null ? `⬇ ${velocita(dm)} · ⬆ ${velocita(um)}` : I.sd && mbit(I.sd) != null ? `🚀 ${velocita(mbit(I.sd))}` : ""}${on ? ` · 🔗 ${on} online` : ""}</span></div><span class="st">›</span></button>
    ${spenti.length ? `<div class="rt1hs">${spenti.map(d => `<span class="tag bad">⏻ ${esc(d.nome)} ${t("spento", "off")}</span>`).join("")}</div>` : D.some(d => IMPORTANTI.includes(d.tipo)) ? `<div class="small muted" style="margin-top:8px">✅ ${t("Modem e server accesi", "Modem and servers on")}</div>` : ""}
    ${U.map(u => `<div class="rt1hs"><span class="tag bad">🔋 ${esc(u.nome)} ${t("a batteria", "on battery")}${u.carica && val(u.carica) != null ? " · " + Math.round(val(u.carica)) + "%" : ""}</span></div>`).join("")}`, { link: [t("Tutto", "All"), "rete"] });
}
HOME_EXTRA.rete = { title: () => t("Rete", "Network"), render: homeCard, show: haRete };
/** entità comandate da questa pagina (Wi-Fi ospiti, accensioni): escono da «Prese e dispositivi» */
VISTE.reteMostrati = () => { const I = internet(), S2 = new Set(); if (I.ospiti?.sw) S2.add(I.ospiti.sw); dispositivi().forEach(d => { if (d.r.accendi?.startsWith("switch.")) S2.add(d.r.accendi); }); return S2; };
/** l'aggiornamento è di un dispositivo di rete o di un server? (pagina Aggiornamenti) */
VISTE.reteAgg = id => { const k = REG[id]?.device; return !!k && (dispositivi().some(d => d.k === k) || trovaTutto().U.includes(k)); };

page("rete", { title: t("Rete e server", "Network and servers"), short: t("Rete", "Network"), icon: "🌐", order: 85, editable: true,
  show: () => haRete() || (conf().extra || []).length > 0, badge: () => internet().collegato === false || dispositivi().some(d => d.on === false && IMPORTANTI.includes(d.tipo)), render: pagina });

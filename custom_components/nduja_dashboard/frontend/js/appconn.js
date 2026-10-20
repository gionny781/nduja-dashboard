/* Collegamento diretto a Home Assistant quando la plancia gira dentro l'app 'Nduja per iPhone/iPad.
   L'app passa in window.NDUJA_APP il refresh token ottenuto con l'accesso di Home Assistant;
   qui si chiede il token di accesso e si apre la websocket, con gli stessi metodi usati da core.js. */
const A = window.NDUJA_APP || {};
let token = null, scade = 0;

export async function accessToken() {
  if (token && Date.now() < scade - 60000) return token;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: A.refresh_token || "", client_id: A.client_id || "" });
  const r = await fetch("/auth/token", { method: "POST", body });
  if (r.status === 400 || r.status === 401 || r.status === 403) { try { A.esci && A.esci(); } catch {} throw new Error("accesso scaduto"); }
  if (!r.ok) throw new Error("token " + r.status);
  const j = await r.json();
  token = j.access_token; scade = Date.now() + (j.expires_in || 1800) * 1000;
  return token;
}

class Conn extends EventTarget {
  constructor() { super(); this.n = 1; this.attese = new Map(); this.eventi = new Map(); this.lista = []; this.connesso = false; this.avviato = false; }
  apri() {
    return new Promise((ok, ko) => {
      const w = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/api/websocket");
      this.w = w;
      w.onmessage = async ev => {
        const m = JSON.parse(ev.data);
        if (m.type === "auth_required") {
          try { w.send(JSON.stringify({ type: "auth", access_token: await accessToken() })); } catch (e) { ko(e); w.close(); }
        } else if (m.type === "auth_invalid") {
          token = null; ko(new Error("auth_invalid"));
        } else if (m.type === "auth_ok") {
          this.connesso = true; this.n = 1; this.eventi.clear();
          for (const s of this.lista) this._abbona(s);
          if (!this.avviato) { this.avviato = true; ok(); } else { ok(); this.dispatchEvent(new Event("ready")); }
        } else if (m.type === "result") {
          const p = this.attese.get(m.id);
          if (p) { this.attese.delete(m.id); m.success ? p.ok(m.result) : p.ko(m.error); }
        } else if (m.type === "event") {
          const s = this.eventi.get(m.id);
          if (s) s.cb(m.event);
        }
      };
      w.onclose = () => {
        const era = this.connesso;
        this.connesso = false;
        for (const p of this.attese.values()) p.ko({ code: "disconnected" });
        this.attese.clear();
        if (era) this.dispatchEvent(new Event("disconnected"));
        if (this.avviato) setTimeout(() => this.apri().catch(() => {}), era ? 1000 : 5000);
        else ko(new Error("websocket chiusa"));
      };
    });
  }
  sendMessagePromise(msg) {
    return new Promise((ok, ko) => {
      if (!this.connesso) return ko({ code: "disconnected" });
      const id = this.n++;
      this.attese.set(id, { ok, ko });
      this.w.send(JSON.stringify({ ...msg, id }));
    });
  }
  _abbona(s) {
    const id = this.n++;
    s.id = id; this.eventi.set(id, s);
    this.attese.set(id, { ok: () => {}, ko: () => this.eventi.delete(id) });
    this.w.send(JSON.stringify({ ...s.msg, id }));
  }
  subscribeMessage(cb, msg) {
    const s = { cb, msg };
    this.lista.push(s);
    if (this.connesso) this._abbona(s);
    return Promise.resolve(() => {
      this.lista = this.lista.filter(x => x !== s);
      if (this.connesso && s.id) this.sendMessagePromise({ type: "unsubscribe_events", subscription: s.id }).catch(() => {});
    });
  }
  subscribeEvents(cb, event_type) { return this.subscribeMessage(cb, event_type ? { type: "subscribe_events", event_type } : { type: "subscribe_events" }); }
}

export async function connetti() { const c = new Conn(); await c.apri(); return c; }

/* Codice QR scritto per 'Nduja, senza librerie: modalità byte (UTF-8), correzione d'errore livello M, versioni 1–10
   (fino a 213 byte: basta per una rete Wi-Fi). Segue lo standard ISO/IEC 18004: Reed-Solomon su GF(256),
   schemi fissi, 8 maschere con la penalità più bassa, informazioni di formato e di versione.
   qrMatrice(testo) → matrice di booleani (true = nero) o null se il testo è troppo lungo; qrSvg(testo) → disegno SVG. */

/* per versione (1–10, livello M): [codici di correzione per blocco, [blocchi, codici dati per blocco]…] */
const BLOCCHI = [null,
  [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
  [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
const ALLINEA = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const datiMax = v => BLOCCHI[v].slice(1).reduce((s, [n, k]) => s + n * k, 0);

/* ---------- aritmetica in GF(256), polinomio 0x11D ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
/** polinomio generatore di grado n (coefficienti dal grado più alto, senza il primo che vale 1) */
function generatore(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const r = new Array(g.length + 1).fill(0);
    g.forEach((c, j) => { r[j] ^= c; r[j + 1] ^= mul(c, EXP[i]); });
    g = r;
  }
  return g.slice(1);
}
/** codici di correzione Reed-Solomon di un blocco */
function correzione(dati, n) {
  const g = generatore(n), r = new Array(n).fill(0);
  for (const d of dati) {
    const f = d ^ r.shift(); r.push(0);
    if (f) g.forEach((c, i) => { r[i] ^= mul(c, f); });
  }
  return r;
}

/* ---------- bit di formato e di versione (codici BCH) ---------- */
function bch(valore, bitDati, gen, bitGen) {
  let r = valore << (bitGen - 1);
  for (let i = bitDati + bitGen - 2; i >= bitGen - 1; i--) if ((r >> i) & 1) r ^= gen << (i - bitGen + 1);
  return (valore << (bitGen - 1)) | r;
}
const formato = maschera => bch((0 << 3) | maschera, 5, 0x537, 11) ^ 0x5412;   // livello M = 00
const versioneBit = v => bch(v, 6, 0x1f25, 13);

/** testo → matrice QR (array di righe di booleani) */
export function qrMatrice(testo) {
  const byte = [...new TextEncoder().encode(String(testo))];
  let v = 1;
  while (v <= 10 && 4 + (v < 10 ? 8 : 16) + byte.length * 8 > datiMax(v) * 8) v++;
  if (v > 10) return null;
  /* flusso di bit: modalità byte (0100), lunghezza, dati, terminatore, riempimento */
  const bit = [], metti = (x, n) => { for (let i = n - 1; i >= 0; i--) bit.push((x >> i) & 1); };
  metti(4, 4); metti(byte.length, v < 10 ? 8 : 16); byte.forEach(b => metti(b, 8));
  const cap = datiMax(v) * 8;
  metti(0, Math.min(4, cap - bit.length));
  while (bit.length % 8) bit.push(0);
  const dati = []; for (let i = 0; i < bit.length; i += 8) dati.push(bit.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  for (let p = 0; dati.length < datiMax(v); p ^= 1) dati.push(p ? 0x11 : 0xec);
  /* blocchi, correzione e intreccio */
  const [ec, ...gruppi] = BLOCCHI[v], B = [];
  let k = 0;
  for (const [n, len] of gruppi) for (let i = 0; i < n; i++) { const d = dati.slice(k, k + len); k += len; B.push({ d, e: correzione(d, ec) }); }
  const finali = [], lmax = Math.max(...B.map(b => b.d.length));
  for (let i = 0; i < lmax; i++) for (const b of B) if (i < b.d.length) finali.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of B) finali.push(b.e[i]);

  /* matrice e moduli fissi */
  const N = v * 4 + 17, M = Array.from({ length: N }, () => new Array(N).fill(false)), F = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (x, y, nero) => { M[y][x] = nero; F[y][x] = true; };
  for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }   // linee di temporizzazione
  const mirino = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
    if (x >= 0 && y >= 0 && x < N && y < N) set(x, y, d !== 2 && d !== 4); } };
  mirino(3, 3); mirino(N - 4, 3); mirino(3, N - 4);
  const A = ALLINEA[v];
  for (const ay of A) for (const ax of A) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === A[A.length - 1]) || (ax === A[A.length - 1] && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const scriviFormato = m => {
    const f = formato(m), b = i => ((f >> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(N - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, N - 15 + i, b(i));
    set(8, N - 8, true);   // modulo sempre nero
  };
  scriviFormato(0);   // riserva le posizioni
  if (v >= 7) {
    const vb = versioneBit(v);
    for (let i = 0; i < 18; i++) { const b = ((vb >> i) & 1) === 1, a = N - 11 + i % 3, c = Math.floor(i / 3); set(a, c, b); set(c, a, b); }
  }
  /* dati a zig-zag, a coppie di colonne da destra */
  let i = 0;
  for (let dx = N - 1; dx >= 1; dx -= 2) {
    if (dx === 6) dx = 5;
    for (let vert = 0; vert < N; vert++) for (let j = 0; j < 2; j++) {
      const x = dx - j, su = ((dx + 1) & 2) === 0, y = su ? N - 1 - vert : vert;
      if (!F[y][x] && i < finali.length * 8) { M[y][x] = ((finali[i >> 3] >> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  /* maschera con la penalità più bassa */
  const MASCHERE = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const applica = m => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!F[y][x] && MASCHERE[m](x, y)) M[y][x] = !M[y][x]; };
  let migliore = 0, minimo = Infinity;
  for (let m = 0; m < 8; m++) {
    applica(m); scriviFormato(m);
    const p = penalita(M); if (p < minimo) { minimo = p; migliore = m; }
    applica(m);   // la stessa maschera due volte torna indietro
  }
  applica(migliore); scriviFormato(migliore);
  return M;
}

/** penalità dello standard: file di 5+ uguali, quadrati 2×2, schemi simili ai mirini, equilibrio tra neri e bianchi */
function penalita(M) {
  const N = M.length; let p = 0, neri = 0;
  const linea = get => {
    let q = 0, run = 1;
    for (let i = 1; i <= N; i++) {
      if (i < N && get(i) === get(i - 1)) run++;
      else { if (run >= 5) q += run - 2; run = 1; }
    }
    for (let i = 0; i + 11 <= N; i++) {
      const s = Array.from({ length: 11 }, (_, k) => get(i + k) ? 1 : 0).join("");
      if (s === "10111010000" || s === "00001011101") q += 40;
    }
    return q;
  };
  for (let y = 0; y < N; y++) p += linea(x => M[y][x]);
  for (let x = 0; x < N; x++) p += linea(y => M[y][x]);
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
  for (const r of M) for (const c of r) if (c) neri++;
  return p + Math.floor(Math.abs(neri * 20 - N * N * 10) / (N * N)) * 10;
}

/** disegno SVG del codice (con il margine bianco di 4 moduli richiesto dai lettori) */
export function qrSvg(testo, { cls = "", titolo = "" } = {}) {
  const M = qrMatrice(testo); if (!M) return "";
  const N = M.length, Q = 4, T = N + Q * 2;
  let d = "";
  M.forEach((r, y) => { let x = 0; while (x < N) { if (!r[x]) { x++; continue; } let l = 1; while (x + l < N && r[x + l]) l++; d += `M${x + Q} ${y + Q}h${l}v1h-${l}z`; x += l; } });
  return `<svg class="${cls}" viewBox="0 0 ${T} ${T}" shape-rendering="crispEdges" role="img"${titolo ? ` aria-label="${titolo}"` : ""}><rect width="${T}" height="${T}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** testo per collegarsi a una rete Wi-Fi (formato letto da iPhone e Android) */
export function wifiQR(ssid, password, tipo = "WPA") {
  const e = s => String(s || "").replace(/([\\;,":])/g, "\\$1");
  return password ? `WIFI:T:${tipo};S:${e(ssid)};P:${e(password)};;` : `WIFI:T:nopass;S:${e(ssid)};;`;
}

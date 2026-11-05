/* 'Nduja Dashboard — processore del microfono (AudioWorklet) per l'assistente vocale.
   Riceve l'audio del browser (di solito 44,1 o 48 kHz), lo porta a 16 kHz mono facendo la media dei campioni
   (un filtro semplice che toglie i fischi del ricampionamento) e lo manda alla plancia a pezzi da 80 ms,
   in interi a 16 bit: il formato che Home Assistant vuole per il riconoscimento vocale. */
class NdujaMicrofono extends AudioWorkletProcessor {
  constructor() {
    super();
    this.passo = sampleRate / 16000;   // campioni del browser per ogni campione a 16 kHz
    this.pos = 0; this.somma = 0; this.quanti = 0;
    this.pezzo = new Int16Array(1280); this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.somma += ch[i]; this.quanti++; this.pos += 1;
      if (this.pos < this.passo) continue;
      this.pos -= this.passo;
      const v = Math.max(-1, Math.min(1, this.somma / this.quanti));
      this.somma = 0; this.quanti = 0;
      this.pezzo[this.n++] = v < 0 ? v * 32768 : v * 32767;
      if (this.n === this.pezzo.length) { this.port.postMessage(this.pezzo.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("nduja-microfono", NdujaMicrofono);

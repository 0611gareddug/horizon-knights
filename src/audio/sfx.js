// 효과음 (Web Audio로 직접 합성 — 파일 없음)
export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    const unlock = () => {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          this.ctx = null;
        }
      }
      this.ctx?.resume?.();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  tone(freq, dur, type = 'square', vol = 0.05, slide = 0) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || this.volume <= 0) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // 대사 웅얼거림 (캐릭터마다 음높이가 다름)
  blip(pitch = 1) {
    this.tone(220 * pitch * (0.92 + Math.random() * 0.16), 0.045, 'square', 0.035);
  }

  noise(dur, vol = 0.08, hi = false) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || this.volume <= 0) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = hi ? 'highpass' : 'lowpass';
    f.frequency.value = hi ? 1800 : 700;
    const g = c.createGain();
    g.gain.value = vol * this.volume;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  hit(strong) {
    this.noise(strong ? 0.12 : 0.07, strong ? 0.16 : 0.1);
    this.tone(strong ? 140 : 190, 0.08, 'square', 0.04, 0.5);
  }
  swing() {
    this.noise(0.08, 0.05, true);
  }
  shoot() {
    this.tone(700, 0.08, 'triangle', 0.04, 0.5);
  }
  boom() {
    this.noise(0.35, 0.22);
    this.tone(90, 0.3, 'sine', 0.12, 0.4);
  }
  ok() {
    this.tone(660, 0.07, 'square', 0.04);
    setTimeout(() => this.tone(990, 0.1, 'square', 0.04), 70);
  }
  rumble() {
    this.noise(0.6, 0.18);
  }
}

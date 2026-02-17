import { clamp, lerp, TAU } from "./hexagon.js";

export class ScreenShake {
  constructor() {
    this.t = 0;
    this.amp = 0;
  }

  kick(amount = 1) {
    this.amp = Math.min(18, this.amp + amount * 6);
    this.t = 0.18;
  }

  update(dt) {
    if (this.t <= 0) return;
    this.t -= dt;
    this.amp = lerp(this.amp, 0, clamp(dt * 10, 0, 1));
  }

  apply(ctx) {
    if (this.t <= 0) return;
    const a = this.amp * (this.t / 0.18);
    const dx = (Math.random() * 2 - 1) * a;
    const dy = (Math.random() * 2 - 1) * a;
    ctx.translate(dx, dy);
  }
}

export class Particles {
  constructor() {
    this.list = [];
  }

  burst({ x, y, color, count = 18, speed = 260 }) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.55 + Math.random() * 0.25,
        maxLife: 0.55 + Math.random() * 0.25,
        color,
        r: 1.5 + Math.random() * 2.8,
      });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.vy += 420 * dt; // gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.list) {
      const t = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = 0.9 * t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class AudioFx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  }

  resume() {
    const ctx = this._ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
  }

  beep({ freq = 440, dur = 0.06, type = "sine", gain = 0.05 } = {}) {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  rotate() {
    this.beep({ freq: 320, dur: 0.045, type: "triangle", gain: 0.045 });
  }

  clear(mult = 1) {
    this.beep({ freq: 520 + 60 * mult, dur: 0.07, type: "sine", gain: 0.06 });
    this.beep({ freq: 780 + 80 * mult, dur: 0.05, type: "sine", gain: 0.03 });
  }

  gameOver() {
    this.beep({ freq: 220, dur: 0.12, type: "sawtooth", gain: 0.05 });
    this.beep({ freq: 160, dur: 0.14, type: "sawtooth", gain: 0.05 });
  }
}


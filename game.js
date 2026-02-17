import { Hexagon, clamp, TAU } from "./hexagon.js";
import { FallingBlock, Stacks, pickColor } from "./blocks.js";
import { computeLandingDistance, isGameOverStack } from "./collision.js";
import { Input } from "./input.js";
import { AudioFx, Particles, ScreenShake } from "./ui.js";

function now() {
  return performance.now();
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

export class Game {
  constructor({ canvas, onHud, onGameOver }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onHud = onHud;
    this.onGameOver = onGameOver;

    this.audio = new AudioFx();
    this.shake = new ScreenShake();
    this.particles = new Particles();

    this.hex = new Hexagon({ x: 0, y: 0, radius: 80 });
    this.stacks = new Stacks();
    this.falling = [];

    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;

    this.running = false;
    this.gameOver = false;

    this._lastT = 0;
    this._raf = 0;

    // difficulty
    this.baseFallSpeed = 260; // px/s
    this.speedMult = 1.0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.95; // seconds; decreases over time
    this.elapsed = 0;

    // geometry
    this.blockSize = 20;
    this.maxBlocksToCenter = 15; // lose if stack reaches this height

    this.input = new Input({
      canvas,
      onRotate: (dir) => {
        if (!this.running || this.gameOver) return;
        this.audio.resume();
        this.hex.rotate(dir);
        this.audio.rotate();
      },
    });
    this.input.attach();

    this._resize = this._resize.bind(this);
    window.addEventListener("resize", this._resize, { passive: true });
    this._resize();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.input.detach();
    window.removeEventListener("resize", this._resize);
  }

  start() {
    this._resize();
    this.running = true;
    this.gameOver = false;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.speedMult = 1.0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.95;
    this.baseFallSpeed = 260;
    this.falling.length = 0;
    this.stacks.reset();
    this.hex.rotationIndex = 0;
    this.hex.rotation = 0;
    this.hex.targetRotation = 0;
    this.particles.list.length = 0;
    this._lastT = now();
    this._tickHud();
    this._loop();
  }

  _resize() {
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width || window.innerWidth));
    const h = Math.max(320, Math.floor(rect.height || window.innerHeight));

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = h / 2;
    this.hex.setCenter(cx, cy);

    // responsive sizing
    const minDim = Math.min(w, h);
    this.hex.setRadius(Math.max(64, Math.min(120, minDim * 0.14)));
    this.blockSize = Math.max(14, Math.min(26, this.hex.radius * 0.23));
    this.maxBlocksToCenter = Math.max(12, Math.floor((this.hex.radius * 2.2) / this.blockSize));
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!this.running) return;

    const t = now();
    let dt = (t - this._lastT) / 1000;
    this._lastT = t;
    dt = clamp(dt, 0, 1 / 20); // prevent huge jumps

    if (!this.gameOver) {
      this._update(dt);
    } else {
      // keep subtle effects alive
      this.shake.update(dt);
      this.particles.update(dt);
    }

    this._draw();
  }

  _update(dt) {
    this.elapsed += dt;

    // difficulty curve
    const timeMult = 1 + this.elapsed * 0.008; // speed increases over time
    const scoreMult = 1 + Math.min(1.8, this.score / 4000) * 0.7;
    const dangerMult = 1 + this.stacks.dangerLevel(this.maxBlocksToCenter) * 0.6;
    this.speedMult = timeMult * scoreMult * dangerMult;

    // spawn rate increases gradually
    this.spawnInterval = Math.max(0.32, 0.95 - this.elapsed * 0.02 - Math.min(0.35, this.score / 10000));

    this.spawnTimer += dt;
    while (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      this._spawnBlock();
    }

    this.hex.update(dt);
    this.shake.update(dt);
    this.particles.update(dt);

    // combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // move falling blocks
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const b = this.falling[i];
      b.speed = this.baseFallSpeed * this.speedMult;
      b.update(dt);

      const localSide = this.hex.worldSideToLocal(b.worldSide);
      const h = this.stacks.height(localSide);
      const landDist = computeLandingDistance({
        hexRadius: this.hex.radius,
        blockSize: this.blockSize,
        stackHeight: h,
      });

      if (b.dist <= landDist) {
        // land
        this.falling.splice(i, 1);
        this.stacks.push(localSide, { color: b.color });

        const newH = this.stacks.height(localSide);
        if (isGameOverStack({ stackHeight: newH, maxBlocksToCenter: this.maxBlocksToCenter })) {
          this._setGameOver();
          return;
        }

        // check clears (and chain clears)
        const removed = this.stacks.clearMatches(3);
        if (removed > 0) {
          this.combo = Math.min(20, this.combo + 1);
          this.comboTimer = 1.35; // extend combo window
          const gained = Math.floor(removed * 25 * this.combo);
          this.score += gained;
          this.shake.kick(1 + removed * 0.25);
          this.audio.clear(Math.min(6, this.combo));

          // particle burst near the impacted side
          const { x, y } = this._sidePointWorld(b.worldSide, this.hex.radius + this.blockSize * 0.8);
          this.particles.burst({ x, y, color: b.color, count: 14 + removed * 3 });

          // slight speed-up bonus on clears
          this.baseFallSpeed = Math.min(520, this.baseFallSpeed + 3);
        } else {
          this.score += 5;
        }

        this._tickHud();
      }
    }

    this._tickHud();
  }

  _spawnBlock() {
    const worldSide = randInt(6);
    const color = pickColor(this.score);

    // start a bit off-screen-ish from center
    const w = this.canvas.getBoundingClientRect().width || window.innerWidth;
    const h = this.canvas.getBoundingClientRect().height || window.innerHeight;
    const far = Math.hypot(w, h) * 0.55;
    const dist = Math.max(this.hex.radius + this.blockSize * 6, far);

    this.falling.push(
      new FallingBlock({
        worldSide,
        color,
        dist,
        speed: this.baseFallSpeed * this.speedMult,
      }),
    );
  }

  _sidePointWorld(worldSide, dist) {
    const a = Hexagon.sideAngleWorld(worldSide);
    return {
      x: this.hex.x + Math.cos(a) * dist,
      y: this.hex.y + Math.sin(a) * dist,
    };
  }

  _drawBackground(w, h) {
    const ctx = this.ctx;
    // subtle vignette + stars
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(10,14,26,0.0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  _draw() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.floor(rect.width || window.innerWidth);
    const h = Math.floor(rect.height || window.innerHeight);

    // clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    this.shake.apply(ctx);

    this._drawBackground(w, h);

    // draw lanes (6 rays)
    ctx.save();
    ctx.translate(this.hex.x, this.hex.y);
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = Hexagon.sideAngleWorld(i);
      const x2 = Math.cos(a) * Math.min(w, h);
      const y2 = Math.sin(a) * Math.min(w, h);
      ctx.strokeStyle = "rgba(234,240,255,0.045)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // stacks (in world space according to current hex rotation)
    this._drawStacks();

    // falling blocks
    this._drawFalling();

    // center hex on top
    this.hex.draw(ctx, { glow: true });

    // particles on top
    this.particles.draw(ctx);

    // subtle center danger pulse when high stacks
    const danger = this.stacks.dangerLevel(this.maxBlocksToCenter);
    if (danger > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18 * danger;
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 8);
      ctx.fillStyle = "rgba(255,79,216,1)";
      ctx.beginPath();
      ctx.arc(this.hex.x, this.hex.y, this.hex.radius * (0.22 + 0.08 * pulse), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawBlockAt({ x, y, color, size, alpha = 1 }) {
    const ctx = this.ctx;
    const r = size * 0.28;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1, size * 0.06);

    // rounded rect
    const w = size * 0.92;
    const h = size * 0.92;
    const x0 = x - w / 2;
    const y0 = y - h / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    ctx.arcTo(x0, y0 + h, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + w, y0, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // inner highlight
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.arc(x - size * 0.12, y - size * 0.12, size * 0.18, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  _drawStacks() {
    const size = this.blockSize;
    for (let local = 0; local < 6; local++) {
      const stack = this.stacks.sides[local];
      if (!stack.length) continue;

      // local side corresponds to world side = local + rotationIndex
      const worldSide = (local + this.hex.rotationIndex) % 6;
      const a = Hexagon.sideAngleWorld(worldSide);
      const ux = Math.cos(a);
      const uy = Math.sin(a);

      for (let i = 0; i < stack.length; i++) {
        const dist = this.hex.radius + (i + 0.5) * size;
        const x = this.hex.x + ux * dist;
        const y = this.hex.y + uy * dist;
        this._drawBlockAt({ x, y, color: stack[i].color, size });
      }
    }
  }

  _drawFalling() {
    const size = this.blockSize;
    for (const b of this.falling) {
      const a = Hexagon.sideAngleWorld(b.worldSide);
      const x = this.hex.x + Math.cos(a) * b.dist;
      const y = this.hex.y + Math.sin(a) * b.dist;
      this._drawBlockAt({ x, y, color: b.color, size, alpha: 0.98 });
    }
  }

  _tickHud() {
    this.onHud?.({
      score: this.score,
      combo: this.combo,
      speedMult: this.speedMult,
    });
  }

  _setGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.audio.gameOver();
    this.onGameOver?.({ score: this.score });
  }
}


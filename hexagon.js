export const TAU = Math.PI * 2;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  // shortest-path lerp (wrap at 2π)
  let d = ((b - a + Math.PI) % (TAU)) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export class Hexagon {
  constructor({ x, y, radius }) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    this.rotationIndex = 0; // 0..5
    this.rotation = 0; // radians
    this.targetRotation = 0;

    this._rotVel = 0;
  }

  setCenter(x, y) {
    this.x = x;
    this.y = y;
  }

  setRadius(r) {
    this.radius = r;
  }

  rotate(dir) {
    // dir: -1 (ccw), +1 (cw)
    this.rotationIndex = (this.rotationIndex + (dir > 0 ? 1 : 5)) % 6;
    this.targetRotation = this.rotationIndex * (Math.PI / 3);
  }

  update(dt) {
    // Smooth critically-damped-ish approach to target rotation.
    // Tune for "snappy but not instant".
    const stiffness = 22; // higher = snappier
    const damping = 10; // higher = less overshoot

    const current = this.rotation;
    const target = this.targetRotation;
    const desired = angleLerp(current, target, clamp(stiffness * dt, 0, 1));
    const v = (desired - current) / Math.max(1e-6, dt);
    this._rotVel = lerp(this._rotVel, v, clamp(damping * dt, 0, 1));
    this.rotation = current + this._rotVel * dt;
  }

  // World side angles (0..5) are fixed in space.
  static sideAngleWorld(i) {
    return -Math.PI / 2 + i * (Math.PI / 3);
  }

  // Local side index (stack index) that corresponds to a world side index, given current rotationIndex.
  worldSideToLocal(worldSide) {
    return (worldSide - this.rotationIndex + 6) % 6;
  }

  draw(ctx, { glow = true } = {}) {
    const { x, y, radius } = this;
    const rot = this.rotation;

    // Outer hex outline
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    const verts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      verts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
    }

    // subtle shadow/glow
    if (glow) {
      ctx.shadowColor = "rgba(124,92,255,0.35)";
      ctx.shadowBlur = 18;
    }

    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.closePath();
    ctx.lineWidth = Math.max(2, radius * 0.05);
    ctx.strokeStyle = "rgba(234,240,255,0.22)";
    ctx.stroke();

    // radial dividers
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, radius * 0.02);
    ctx.strokeStyle = "rgba(234,240,255,0.10)";
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }

    ctx.restore();
  }
}


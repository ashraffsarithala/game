import { clamp } from "./hexagon.js";

export const COLOR_SETS = [
  ["#7c5cff", "#3ef3c0", "#ff4fd8"], // 3 colors early
  ["#7c5cff", "#3ef3c0", "#ff4fd8", "#ffd84f"],
  ["#7c5cff", "#3ef3c0", "#ff4fd8", "#ffd84f", "#4ff2ff"],
  ["#7c5cff", "#3ef3c0", "#ff4fd8", "#ffd84f", "#4ff2ff", "#ff6b4f"],
];

export function pickColor(score, rng = Math.random) {
  const tier =
    score < 500 ? 0 :
    score < 1500 ? 1 :
    score < 3500 ? 2 : 3;
  const set = COLOR_SETS[tier] || COLOR_SETS[COLOR_SETS.length - 1];
  return set[Math.floor(rng() * set.length)];
}

export class FallingBlock {
  constructor({ worldSide, color, dist, speed }) {
    this.worldSide = worldSide; // 0..5 fixed in world space
    this.color = color;
    this.dist = dist; // distance from center along this side ray
    this.speed = speed; // inward speed (px/s)
    this.radius = 10; // draw size is derived elsewhere; this is just a hint
  }

  update(dt) {
    this.dist -= this.speed * dt;
  }
}

export class Stacks {
  constructor() {
    this.sides = Array.from({ length: 6 }, () => []);
  }

  reset() {
    for (const s of this.sides) s.length = 0;
  }

  height(i) {
    return this.sides[i].length;
  }

  maxHeight() {
    let m = 0;
    for (let i = 0; i < 6; i++) m = Math.max(m, this.sides[i].length);
    return m;
  }

  push(i, block) {
    this.sides[i].push(block);
  }

  // returns total removed blocks
  clearMatches(minRun = 3) {
    let removedTotal = 0;
    let any = true;

    while (any) {
      any = false;
      for (let s = 0; s < 6; s++) {
        const stack = this.sides[s];
        if (stack.length < minRun) continue;

        // find any contiguous run(s) in the stack
        let start = 0;
        while (start < stack.length) {
          const color = stack[start].color;
          let end = start + 1;
          while (end < stack.length && stack[end].color === color) end++;
          const runLen = end - start;
          if (runLen >= minRun) {
            stack.splice(start, runLen);
            removedTotal += runLen;
            any = true;
            // after splice, keep start same index to re-check
          } else {
            start = end;
          }
        }
      }
    }

    return removedTotal;
  }

  // Soft cap for speed scaling etc.
  dangerLevel(maxBlocksToCenter) {
    // 0..1
    const m = this.maxHeight();
    return clamp(m / Math.max(1, maxBlocksToCenter), 0, 1);
  }
}


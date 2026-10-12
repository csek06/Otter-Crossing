// Small effects in world space: splash droplets, ripples and the action item
// check pop. Pooled. Droplets are skipped under prefers-reduced-motion.

import { Pool } from '../core/pool.js';

export function createFx() {
  const pool = new Pool(() => ({ kind: '', x: 0, row: 0, vx: 0, vy: 0, h: 0, life: 0, max: 0, fromX: 0, fromRow: 0, target: null }));
  const live = [];

  function spawn(kind, x, row, vx, vy, life) {
    const p = pool.get();
    p.kind = kind;
    p.x = x;
    p.row = row;
    p.vx = vx;
    p.vy = vy;
    p.h = 0;
    p.life = life;
    p.max = life;
    live.push(p);
  }

  return {
    live,
    splash(x, row, reduced) {
      spawn('ring', x, row, 0, 0, 0.5);
      if (reduced) return;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        spawn('drop', x, row, Math.cos(a) * 1.2, 2.2 + Math.random() * 1.4, 0.45);
      }
    },
    check(x, row) {
      spawn('check', x, row, 0, 1.4, 0.6);
    },
    // A token flying in to the otter (Action items magnet).
    pull(x, row, target) {
      spawn('pull', x, row, 0, 0, 0.28);
      const p = live[live.length - 1];
      p.fromX = x;
      p.fromRow = row;
      p.target = target;
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.life -= dt;
        if (p.life <= 0) {
          live.splice(i, 1);
          pool.release(p);
          continue;
        }
        p.x += p.vx * dt;
        if (p.kind === 'drop') {
          p.h += p.vy * dt;
          p.vy -= 9 * dt;
        } else if (p.kind === 'check') {
          p.h += p.vy * dt;
        } else if (p.kind === 'pull' && p.target) {
          const k = 1 - p.life / p.max;
          const e = k * k;
          p.x = p.fromX + (p.target.x + 0.5 - p.fromX) * e;
          p.row = p.fromRow + (p.target.row - p.fromRow) * e;
          p.h = Math.sin(k * Math.PI) * 0.8;
        }
      }
    },
    clear() {
      while (live.length) pool.release(live.pop());
    },
  };
}

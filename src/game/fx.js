// Small effects in world space: splash droplets, ripples and the action item
// check pop. Pooled. Droplets are skipped under prefers-reduced-motion.

import { Pool } from '../core/pool.js';

export function createFx() {
  const pool = new Pool(() => ({ kind: '', x: 0, row: 0, vx: 0, vy: 0, h: 0, life: 0, max: 0 }));
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
        }
      }
    },
    clear() {
      while (live.length) pool.release(live.pop());
    },
  };
}

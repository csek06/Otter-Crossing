// All-hands express: a long, fast train of meeting invites. A signal fires at
// least ALLHANDS_MIN_WARNING seconds before the train reaches the playfield.
//
// Each lane cycles: idle, then warn (signal on), then pass (train crosses), then idle.
// The generator test runs this cycle and checks the warning lead time.

import { GRID, RULES, TUNING } from '../config.js';
import { createRng } from '../core/rng.js';
import { CONTENT } from '../content.js';
import { PAL } from '../render/palette.js';
import { roundRect, shadow, FONT_DISPLAY } from '../render/primitives.js';

const lerp = (a, b, t) => a + (b - a) * t;

export const allhands = {
  id: 'allhands',
  safe: false,
  hint: 'allhands',
  minRow: 22,
  weight: (d, row) => (row < allhands.minRow ? 0 : lerp(0.2, 0.35, d)),

  generate(lane, row, d, rng) {
    lane.speed = lerp(12, 17, d) + rng.range(0, 3);
    lane.dir = rng.chance(0.5) ? 1 : -1;
    lane.trainLen = rng.int(9, 13);
    lane.warnTime = Math.max(RULES.ALLHANDS_MIN_WARNING + 0.2, lerp(1.7, 1.3, d));
    lane.idleMin = lerp(3, 1.8, d);
    lane.idleMax = lerp(6.5, 4.2, d);
    lane.runtime = createRng((rng.next() * 4294967296) >>> 0);
    lane.state = 'idle';
    lane.t = 0;
    lane.idle = rng.range(0.6, lane.idleMax);
    lane.front = 0;
    lane.signalT = 0;
  },

  // Distance the train front starts off-screen. Part of the warning lead.
  entryGap: 1,

  update(lane, dt) {
    lane.t += dt;
    if (lane.state === 'idle') {
      if (lane.t >= lane.idle) {
        lane.state = 'warn';
        lane.t = 0;
        lane.signalT = 0;
      }
    } else if (lane.state === 'warn') {
      lane.signalT += dt;
      if (lane.t >= lane.warnTime) {
        lane.state = 'pass';
        lane.t = 0;
        lane.front = lane.dir > 0 ? -allhands.entryGap : GRID.COLS + allhands.entryGap;
      }
    } else if (lane.state === 'pass') {
      lane.signalT += dt;
      lane.front += lane.speed * lane.dir * dt;
      const tail = lane.front - lane.dir * lane.trainLen;
      const gone = lane.dir > 0 ? tail > GRID.COLS + 0.5 : tail < -0.5;
      if (gone) {
        lane.state = 'idle';
        lane.t = 0;
        lane.idle = lane.runtime.range(lane.idleMin, lane.idleMax);
      }
    }
  },

  signalOn(lane) {
    return lane.state !== 'idle';
  },

  // Which of the two lamps is lit. Each lamp flashes ALLHANDS_BLINK_HZ times a second.
  lampPhase(lane) {
    return Math.floor(lane.signalT * RULES.ALLHANDS_BLINK_HZ * 2) % 2;
  },

  span(lane) {
    if (lane.state !== 'pass') return null;
    const a = lane.front;
    const b = lane.front - lane.dir * lane.trainLen;
    return [Math.min(a, b), Math.max(a, b)];
  },

  blocks() {
    return 0;
  },

  collide(lane, player) {
    const s = allhands.span(lane);
    if (!s) return null;
    const px = player.x + 0.5;
    const half = TUNING.PLAYER_HALF_W;
    if (px + half > s[0] + TUNING.HAZARD_INSET && px - half < s[1] - TUNING.HAZARD_INSET) return { cause: 'allhands' };
    return null;
  },

  hitboxes(lane) {
    const s = allhands.span(lane);
    return s ? [[s[0] + TUNING.HAZARD_INSET, s[1] - TUNING.HAZARD_INSET]] : [];
  },

  drawGround(ctx, lane, v, y) {
    const t = v.tile;
    const top = y - v.rowH;
    const w = t * GRID.COLS;
    ctx.fillStyle = PAL.rail;
    ctx.fillRect(v.ox - 1, top, w + 2, v.rowH + 0.5);
    // Ties and rails.
    ctx.fillStyle = PAL.railTie;
    for (let c = 0; c < GRID.COLS * 2; c++) {
      ctx.fillRect(v.ox + c * t * 0.5 + t * 0.12, top + v.rowH * 0.18, t * 0.18, v.rowH * 0.64);
    }
    ctx.fillStyle = PAL.railSteel;
    ctx.fillRect(v.ox, top + v.rowH * 0.3, w, Math.max(1.5, v.line * 1.2));
    ctx.fillRect(v.ox, top + v.rowH * 0.68, w, Math.max(1.5, v.line * 1.2));
    // Steady red edge while the signal is on. Steady, not blinking.
    if (allhands.signalOn(lane)) {
      ctx.fillStyle = PAL.redSoft;
      ctx.fillRect(v.ox, top, w, v.rowH * 0.12);
      ctx.fillRect(v.ox, y - v.rowH * 0.12, w, v.rowH * 0.12);
    }
  },

  // Signal posts sit in the facade margins on both sides of the lane.
  drawSignals(ctx, lane, v, y) {
    const t = v.tile;
    const on = allhands.signalOn(lane);
    const phase = allhands.lampPhase(lane);
    const mw = v.ox;
    for (const side of [0, 1]) {
      const cx = side === 0 ? mw / 2 : v.ox + t * GRID.COLS + mw / 2;
      const top = y - v.rowH;
      ctx.fillStyle = PAL.ink;
      roundRect(ctx, cx - mw * 0.36, top + v.rowH * 0.06, mw * 0.72, v.rowH * 0.88, mw * 0.2);
      ctx.fill();
      for (let i = 0; i < 2; i++) {
        const lit = on && phase === i;
        ctx.fillStyle = lit ? PAL.red : PAL.redDim;
        ctx.beginPath();
        ctx.arc(cx, top + v.rowH * (0.3 + i * 0.4), mw * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  drawObjects(ctx, lane, v, y) {
    const s = allhands.span(lane);
    if (!s) return;
    const t = v.tile;
    const gy = y - v.rowH * 0.14;
    const depth = v.rowH * 0.66;
    const height = t * 0.5;
    shadow(ctx, v.ox + ((s[0] + s[1]) / 2) * t, gy + v.rowH * 0.04, ((s[1] - s[0]) / 2) * t, v.rowH * 0.15);
    // Cars: one engine and a chain of envelopes, each one tile long.
    // The engine is two tiles long and always leads.
    for (let i = 1; i < lane.trainLen; i++) {
      const pos = lane.dir > 0 ? lane.front - (i + 1) : lane.front + i;
      if (pos > GRID.COLS + 0.5 || pos < -1.5) continue;
      if (i === 1) {
        const ex = lane.dir > 0 ? lane.front - 2 : lane.front;
        drawEngine(ctx, v.ox + ex * t, gy, t, depth, height, v, lane.dir);
      } else {
        drawEnvelope(ctx, v.ox + pos * t, gy, t, depth, height, v);
      }
    }
  },
};

function drawEnvelope(ctx, x, gy, t, depth, height, v) {
  const lw = v.line;
  const x0 = x + t * 0.04;
  const w = t * 0.92;
  ctx.lineWidth = lw;
  ctx.strokeStyle = PAL.ink;
  // Front face.
  ctx.fillStyle = PAL.paperDeep;
  ctx.fillRect(x0, gy - height, w, height);
  ctx.strokeRect(x0, gy - height, w, height);
  // Top face with the envelope flap.
  const top = gy - height - depth;
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(x0, top, w, depth);
  ctx.strokeRect(x0, top, w, depth);
  ctx.beginPath();
  ctx.moveTo(x0, top);
  ctx.lineTo(x0 + w / 2, top + depth * 0.62);
  ctx.lineTo(x0 + w, top);
  ctx.stroke();
  // Coupler between cars.
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x0 - t * 0.06, gy - height * 0.55, t * 0.08, height * 0.2);
}

function drawEngine(ctx, x, gy, t, depth, height, v, dir) {
  const lw = v.line;
  const x0 = x + t * 0.04;
  const w = t * 1.92;
  ctx.lineWidth = lw;
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.ink;
  roundRect(ctx, x0, gy - height - t * 0.1, w, height + t * 0.1, t * 0.1);
  ctx.fill();
  ctx.stroke();
  const top = gy - height - depth - t * 0.12;
  ctx.fillStyle = PAL.inkSoft;
  roundRect(ctx, x0, top, w, depth + t * 0.02, t * 0.1);
  ctx.fill();
  ctx.stroke();
  // Recording dot as the headlight, on the leading side.
  ctx.fillStyle = PAL.red;
  ctx.beginPath();
  ctx.arc(dir > 0 ? x0 + w - t * 0.2 : x0 + t * 0.2, gy - height * 0.5, t * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.paper;
  ctx.font = `800 ${t * 0.26}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(CONTENT.labels.allHandsTrain, x0 + w / 2, top + depth * 0.55);
}

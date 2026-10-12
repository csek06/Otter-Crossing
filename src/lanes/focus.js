// Focus time: safe lanes with static obstacles (desks, plants, coffee mugs).
// Obstacles block movement but never hurt. Placement always keeps a path open.

import { GRID } from '../config.js';
import { PAL } from '../render/palette.js';
import { block, shadow, roundRect } from '../render/primitives.js';
import { drawMeadow, drawNature, hash2 } from '../render/habitat.js';

const ALL = (1 << GRID.COLS) - 1;
const KINDS = ['desk', 'plant', 'mug', 'cabinet'];

// Columns reachable in a lane: start from the entry columns and spread sideways
// through free tiles.
export function spread(entry, blocked) {
  let reach = entry & ~blocked & ALL;
  for (;;) {
    const grown = (reach | (reach << 1) | (reach >> 1)) & ~blocked & ALL;
    if (grown === reach) return reach;
    reach = grown;
  }
}

export function bitCount(n) {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

export const focus = {
  id: 'focus',
  safe: true,
  hint: null,

  // Fills lane.obstacles and lane.blocked. ctx.reach carries reachable columns
  // from the previous lane so stacked focus lanes never wall the otter in.
  generate(lane, row, d, rng, ctx) {
    lane.obstacles.length = 0;
    lane.blocked = 0;
    const zone = ctx.zone || null;
    let maxObs = rng.int(0, 3);
    if (zone === 'start') maxObs = rng.int(0, 2);
    if (zone === 'behind') maxObs = rng.int(1, 3);

    for (let attempt = 0; attempt < 12; attempt++) {
      let mask = 0;
      for (let i = 0; i < maxObs; i++) mask |= 1 << rng.int(0, GRID.COLS - 1);
      if (zone === 'start') mask &= ~(1 << GRID.START_COL);
      if (zone === 'behind') {
        lane.blocked = mask;
        break;
      }
      const reach = spread(ctx.reach, mask);
      if (bitCount(reach) >= 3) {
        lane.blocked = mask;
        break;
      }
    }

    for (let c = 0; c < GRID.COLS; c++) {
      if (lane.blocked & (1 << c)) lane.obstacles.push({ col: c, kind: rng.pick(KINDS), seed: rng.next() });
    }
    if (zone !== 'behind') {
      const entry = zone === 'start' && ctx.firstStart ? 1 << GRID.START_COL : ctx.reach;
      ctx.reach = spread(entry, lane.blocked);
    }
  },

  update() {},

  blocks(lane, col) {
    return (lane.blocked >> col) & 1;
  },

  collide() {
    return null;
  },

  safeAt(lane, col) {
    return !((lane.blocked >> col) & 1);
  },

  drawGround(ctx, lane, v, y) {
    if (v.habitat) return drawMeadow(ctx, lane, v, y - v.rowH);
    // Carpet tiles: a quiet checker so movement reads on the grid.
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(v.gx0, y - v.rowH, v.gx1 - v.gx0, v.rowH + 0.5);
    ctx.fillStyle = PAL.paperDark;
    const c0 = v.wide ? v.c0 : 0;
    const c1 = v.wide ? v.c1 : GRID.COLS - 1;
    for (let c = c0; c <= c1; c++) {
      if (((c - lane.row) & 1) !== 0) continue;
      ctx.fillRect(v.ox + c * v.tile, y - v.rowH, v.tile, v.rowH + 0.5);
    }
  },

  drawObjects(ctx, lane, v, y) {
    // Wide screens: scenery off the playfield, fixed to the world.
    if (v.wide) {
      for (let c = v.c0; c <= v.c1; c++) {
        if (c >= 0 && c < GRID.COLS) continue;
        const h = hash2(lane.row, c);
        if (h % 100 >= (v.habitat ? 34 : 22)) continue;
        const kind = KINDS[(h >> 8) % KINDS.length];
        if (v.habitat) drawNature(ctx, kind, v.ox + c * v.tile, y, v);
        else drawObstacle(ctx, { kind }, v.ox + c * v.tile, y, v);
      }
    }
    for (const o of lane.obstacles) {
      if (v.habitat) drawNature(ctx, o.kind, v.ox + o.col * v.tile, y, v);
      else drawObstacle(ctx, o, v.ox + o.col * v.tile, y, v);
    }
  },
};

function drawObstacle(ctx, o, x, y, v) {
  const t = v.tile;
  const lw = v.line;
  const gy = y - v.rowH * 0.18;
  switch (o.kind) {
    case 'desk': {
      shadow(ctx, x + t / 2, gy, t * 0.46, v.rowH * 0.16);
      block(ctx, x + t * 0.06, gy, t * 0.88, v.rowH * 0.55, t * 0.3, PAL.cream, PAL.paperDeep, lw, t * 0.04);
      // Monitor showing a video tile.
      const mw = t * 0.5;
      const mx = x + (t - mw) / 2;
      const my = gy - t * 0.3 - v.rowH * 0.3;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + t / 2 - lw, my, lw * 2, t * 0.08);
      ctx.lineWidth = lw;
      ctx.strokeStyle = PAL.ink;
      ctx.fillStyle = PAL.screen;
      roundRect(ctx, mx, my - t * 0.34, mw, t * 0.34, t * 0.04);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.screenFace;
      ctx.beginPath();
      ctx.arc(mx + mw / 2, my - t * 0.21, t * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(mx + mw / 2 - t * 0.1, my - t * 0.12, t * 0.2, t * 0.1);
      break;
    }
    case 'cabinet': {
      shadow(ctx, x + t / 2, gy, t * 0.4, v.rowH * 0.16);
      block(ctx, x + t * 0.14, gy, t * 0.72, v.rowH * 0.5, t * 0.62, PAL.wall, PAL.wallDark, lw, t * 0.03);
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = lw;
      for (let i = 1; i < 3; i++) {
        const yy = gy - (t * 0.62 * i) / 3;
        ctx.beginPath();
        ctx.moveTo(x + t * 0.14, yy);
        ctx.lineTo(x + t * 0.86, yy);
        ctx.stroke();
        ctx.fillStyle = PAL.ink;
        ctx.fillRect(x + t * 0.44, yy + t * 0.07, t * 0.12, lw * 1.5);
      }
      break;
    }
    case 'plant': {
      shadow(ctx, x + t / 2, gy, t * 0.3, v.rowH * 0.14);
      block(ctx, x + t * 0.3, gy, t * 0.4, v.rowH * 0.32, t * 0.26, PAL.inkSoft, PAL.furDark, lw, t * 0.04);
      const cx = x + t / 2;
      const cy = gy - t * 0.26 - v.rowH * 0.2;
      ctx.lineWidth = lw;
      ctx.strokeStyle = PAL.ink;
      const leaves = [[-0.18, -0.1, -0.5], [0.18, -0.1, 0.5], [0, -0.26, 0], [-0.1, -0.34, -0.25], [0.1, -0.34, 0.25]];
      for (const [dx, dy, rot] of leaves) {
        ctx.fillStyle = dy < -0.2 ? PAL.leaf : PAL.leafDark;
        ctx.beginPath();
        ctx.ellipse(cx + dx * t, cy + dy * t, t * 0.1, t * 0.2, rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'mug':
    default: {
      shadow(ctx, x + t / 2, gy, t * 0.26, v.rowH * 0.12);
      const mw = t * 0.36;
      const mx = x + (t - mw) / 2;
      const mh = t * 0.38;
      ctx.lineWidth = lw;
      ctx.strokeStyle = PAL.ink;
      // Handle.
      ctx.beginPath();
      ctx.arc(mx + mw, gy - mh * 0.55, t * 0.09, -Math.PI / 2, Math.PI / 2);
      ctx.lineWidth = lw * 2.2;
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.fillStyle = PAL.cream;
      roundRect(ctx, mx, gy - mh, mw, mh, t * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.furDark;
      ctx.beginPath();
      ctx.ellipse(mx + mw / 2, gy - mh, mw / 2, v.rowH * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // A brand blue band, like a company mug.
      ctx.fillStyle = PAL.brand;
      ctx.fillRect(mx + lw / 2, gy - mh * 0.55, mw - lw, mh * 0.18);
      break;
    }
  }
}

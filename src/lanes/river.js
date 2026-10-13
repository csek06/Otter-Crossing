// The river: floating logs with a highlighter stripe (Highlights) act as
// platforms. No text on the water or the logs, so the logs and pickups read.
//
// Otters swim, so falling in is not instant: the current carries the otter
// sideways and it has SWIM_TIME seconds to reach a highlight.
//
// Rule (checked by the generator test): every gap between highlights is at most
// RIVER_MAX_WAIT seconds of current, so a highlight passes any column at least that often.

import { GRID, RULES } from '../config.js';
import { PAL } from '../render/palette.js';
import { roundRect } from '../render/primitives.js';
import { drawToken } from '../render/token.js';
import { drawPickup } from '../render/pickup.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function riverSpeed(d, rng) {
  return lerp(1.3, 1.7, d) + rng.range(0, lerp(0.5, 1.0, d));
}

export const river = {
  id: 'river',
  safe: false,
  hint: 'river',
  minRow: 8,
  weight: (d, row) => (row < river.minRow ? 0 : 0.6),

  generate(lane, row, d, rng, ctx) {
    const speed = riverSpeed(d, rng);
    ctx.riverDir = -(ctx.riverDir || 1);
    const maxGap = RULES.RIVER_MAX_WAIT * speed;
    // Gaps sit near the 2 second limit so the transcript water stays readable.
    const minGap = maxGap * lerp(0.55, 0.75, d);
    const maxLen = d < 0.4 ? 3 : 2;
    const minLen = 2;

    lane.platforms.length = 0;
    let x = 0;
    // Keep adding highlights until the ring is wide enough that the wrap point
    // is always off-screen.
    const minRing = GRID.COLS + 2 * maxLen + 1;
    while (x < minRing || lane.platforms.length < 3) {
      const len = rng.int(minLen, maxLen);
      rng.next(); // was the log's phrase; still drawn so every course stays the same
      lane.platforms.push({ x, len, token: false, taken: false, lit: 0 });
      x += len + rng.range(minGap, maxGap);
    }
    lane.ring = x;
    lane.speed = speed;
    lane.dir = ctx.riverDir;
    lane.pad = (lane.ring - GRID.COLS) / 2;
    lane.phase = rng.range(0, lane.ring);
    rng.int(0, 31); // was the transcript's first line; kept for the same reason
  },

  update(lane, dt) {
    lane.phase = (lane.phase + lane.speed * lane.dir * dt) % lane.ring;
    if (lane.phase < 0) lane.phase += lane.ring;
    // Wave offset. 600 tiles is a whole number of waves at both crest speeds, so the wrap is seamless.
    lane.wave = ((lane.wave || 0) + lane.speed * lane.dir * dt) % 600;
    for (const p of lane.platforms) if (p.lit > 0) p.lit = Math.max(0, p.lit - dt);
  },

  left(lane, plat) {
    let p = (plat.x + lane.phase) % lane.ring;
    if (p < 0) p += lane.ring;
    return p - lane.pad;
  },

  platformAt(lane, x) {
    const cx = x + 0.5;
    for (const plat of lane.platforms) {
      const l = river.left(lane, plat);
      if (cx >= l + 0.05 && cx <= l + plat.len - 0.05) return plat;
    }
    return null;
  },

  blocks() {
    return 0;
  },

  // Called every frame the otter is standing (not hopping) in this lane.
  // Returns 'splash' when the otter first lands in the water, 'ride' when it
  // lands on a new highlight.
  carry(lane, player, dt) {
    const plat = river.platformAt(lane, player.x);
    const drift = lane.speed * lane.dir * dt;
    if (plat) {
      player.x += drift;
      player.swim = -1;
      plat.lit = 0.25;
      if (player.riding !== plat) {
        player.riding = plat;
        return 'ride';
      }
      return null;
    }
    player.riding = null;
    // The current pulls a swimmer more gently than it moves the highlights, so a
    // passing highlight catches up and scoops the otter out.
    player.x += drift * 0.3;
    if (player.swim < 0) {
      player.swim = 0;
      return 'splash';
    }
    player.swim += dt;
    return null;
  },

  collide(lane, player) {
    if (player.swim >= RULES.SWIM_TIME) return { cause: 'river' };
    if (player.x < -0.45 || player.x > GRID.COLS - 0.55) return { cause: 'river' };
    return null;
  },

  safeAt(lane, col) {
    return !!river.platformAt(lane, col);
  },

  hitboxes(lane) {
    return lane.platforms.map((p) => {
      const l = river.left(lane, p);
      return [l + 0.05, l + p.len - 0.05];
    });
  },

  // Blue water with wave crests. No text, so the logs and pickups stand out.
  drawGround(ctx, lane, v, y) {
    const t = v.tile;
    const top = y - v.rowH;
    const x0 = v.gx0;
    const w = v.gx1 - v.gx0;
    ctx.fillStyle = PAL.water;
    ctx.fillRect(x0, top, w, v.rowH + 0.5);
    // A darker band along the far bank gives the water some depth.
    ctx.fillStyle = PAL.waterDeep;
    ctx.fillRect(x0, top, w, v.rowH * 0.22);
    drawWaves(ctx, lane, v, top);
    // A thin line along the near bank.
    ctx.fillStyle = PAL.riverLine;
    ctx.fillRect(x0, top, w, 1);
  },

  drawObjects(ctx, lane, v, y) {
    const t = v.tile;
    for (const plat of lane.platforms) {
      const l = river.left(lane, plat);
      if (l > GRID.COLS + 0.5 || l + plat.len < -0.5) continue;
      drawHighlight(ctx, v.ox + l * t, y, plat, v);
      if (plat.token && !plat.taken) drawToken(ctx, v.ox + (l + plat.len / 2) * t, y - v.rowH * 0.62, v, v.time);
      const pu = lane.powerup;
      if (pu && pu.plat === plat && !pu.taken) drawPickup(ctx, v.ox + (l + plat.len / 2) * t, y - v.rowH * 0.45, v, pu.id, v.time);
    }
  },
};

// Two rows of scalloped crests above and below the text. They drift with the
// current at slightly different rates, so the water looks like it is moving.
const WAVE_LEN = 0.6; // tiles
function drawWaves(ctx, lane, v, top) {
  const t = v.tile;
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.gx0, top, v.gx1 - v.gx0, v.rowH);
  ctx.clip();
  ctx.strokeStyle = PAL.waveCrest;
  ctx.lineWidth = Math.max(1, v.line);
  ctx.lineCap = 'round';
  const rows = [
    { y: top + v.rowH * 0.2, k: 1.25, off: 0 },
    { y: top + v.rowH * 0.86, k: 0.8, off: WAVE_LEN / 2 },
  ];
  const len = WAVE_LEN * t;
  const amp = t * 0.05;
  ctx.beginPath();
  for (const r of rows) {
    let x = v.ox + (((((lane.wave || 0) * r.k + r.off) % WAVE_LEN) + WAVE_LEN) % WAVE_LEN) * t - len;
    while (x > v.gx0) x -= len;
    for (; x < v.gx1; x += len) {
      // One crest: a short arch, then a flat trough before the next.
      ctx.moveTo(x, r.y);
      ctx.quadraticCurveTo(x + len * 0.25, r.y - amp * 2, x + len * 0.5, r.y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// A floating log with a highlighter stripe across the middle.
// The stripe keeps the link to Highlights: you ride the highlighted moments.
function drawHighlight(ctx, x, y, plat, v) {
  const t = v.tile;
  const w = plat.len * t;
  const sink = plat.lit > 0 ? t * 0.03 : 0;
  const h = v.rowH * 0.62;
  const top = y - v.rowH * 0.82 + sink;
  const cap = Math.min(h * 0.32, w * 0.12);
  const x0 = x + t * 0.04;
  const x1 = x + w - t * 0.04;
  ctx.lineWidth = v.line;
  ctx.strokeStyle = PAL.ink;

  // Ripple in the water around the log, stronger while something stands on it.
  ctx.fillStyle = plat.lit > 0 ? PAL.ripple : PAL.waterRing;
  ctx.beginPath();
  ctx.ellipse((x0 + x1) / 2, top + h * 0.78, (x1 - x0) / 2 + t * 0.08, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body: lighter on top, darker underside, then bark grooves.
  ctx.fillStyle = PAL.wood;
  roundRect(ctx, x0, top, x1 - x0, h, h / 2);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x0, top, x1 - x0, h, h / 2);
  ctx.clip();
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(x0, top + h * 0.66, x1 - x0, h * 0.34);
  ctx.strokeStyle = PAL.woodDark;
  ctx.lineWidth = Math.max(1, v.line * 0.8);
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Same grooves every frame: offsets come from the log's own position in the ring.
  const seed = Math.floor(plat.x * 7);
  for (let k = 0; k < 3; k++) {
    const gy = top + h * (0.2 + k * 0.17);
    for (let gx = x0 + cap * 1.4 + ((seed + k * 3) % 5) * t * 0.07; gx < x1 - cap * 1.6; gx += t * 0.55) {
      ctx.moveTo(gx, gy);
      ctx.lineTo(Math.min(gx + t * 0.22, x1 - cap * 1.6), gy);
    }
  }
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = v.line;
  ctx.strokeStyle = PAL.ink;
  roundRect(ctx, x0, top, x1 - x0, h, h / 2);
  ctx.stroke();

  // Cut end with growth rings on the trailing side of the current.
  const ex = x1 - cap;
  ctx.fillStyle = PAL.woodEnd;
  ctx.beginPath();
  ctx.ellipse(ex, top + h / 2, cap, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = PAL.woodRing;
  ctx.lineWidth = Math.max(1, v.line * 0.7);
  ctx.beginPath();
  ctx.ellipse(ex, top + h / 2, cap * 0.55, h * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Highlighter stripe, with no text. In the habitat a log is just a log.
  if (v.habitat) return;
  const left = x0 + cap * 0.6;
  const right = ex - cap * 1.05;
  const bh = h * 0.6;
  const by = top + (h - bh) / 2 - h * 0.04;
  ctx.fillStyle = PAL.highlighter;
  ctx.beginPath();
  ctx.moveTo(left + t * 0.03, by);
  ctx.lineTo(right - t * 0.01, by + t * 0.01);
  ctx.lineTo(right + t * 0.02, by + bh * 0.5);
  ctx.lineTo(right, by + bh);
  ctx.lineTo(left + t * 0.01, by + bh - t * 0.01);
  ctx.lineTo(left - t * 0.02, by + bh * 0.5);
  ctx.closePath();
  ctx.fill();
}

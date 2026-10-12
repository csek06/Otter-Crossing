// Meeting traffic: calendar blocks slide across like cars. 30, 60 and 90 minute
// meetings are 1, 2 and 3 tiles long. Directions alternate lane to lane.
//
// Each lane is a ring of R tiles that scrolls past the 9 visible columns. Gaps are
// planned up front so every lane has a gap wide enough to cross.

import { GRID, RULES, TUNING, FLAGS } from '../config.js';
import { CONTENT } from '../content.js';
import { PAL } from '../render/palette.js';
import { roundRect, fitText, shadow, FONT_UI } from '../render/primitives.js';
import { sprite } from '../render/sprites.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function meetingCap(d) {
  return lerp(RULES.MEETING_DENSITY_MIN, RULES.MEETING_DENSITY_MAX, d);
}

// The gap needed so a column stays open for MEETING_OPEN_TIME at this speed,
// taking the player and hazard hitboxes into account.
export function bigGapFor(speed) {
  const slack = TUNING.PLAYER_HALF_W * 2 - TUNING.HAZARD_INSET * 2;
  return Math.max(3, RULES.MEETING_OPEN_TIME * speed + slack + 0.1);
}

function pickLen(d, rng) {
  const r = rng.next();
  const w1 = 0.45 - 0.15 * d;
  const w2 = 0.35;
  if (r < w1) return 1;
  if (r < w1 + w2) return 2;
  return 3;
}

function titles() {
  return CONTENT.meetingTitles[FLAGS.AUDIENCE] || CONTENT.meetingTitles.external;
}

export const meetings = {
  id: 'meetings',
  safe: false,
  hint: 'meetings',
  weight: () => 1,

  generate(lane, row, d, rng, ctx) {
    const speed = lerp(1.0, 2.0, d) + rng.range(0, lerp(0.8, 2.2, d));
    ctx.meetingDir = -(ctx.meetingDir || 1);
    const ring = rng.int(16, 20);
    const minGap = RULES.MEETING_MIN_GAP;
    const bigGap = bigGapFor(speed);
    const target = meetingCap(d) * ring * rng.range(0.75, 1);

    const lens = [];
    let sum = 0;
    for (;;) {
      const len = pickLen(d, rng);
      const n = lens.length + 1;
      const fits = ring - (sum + len) >= bigGap + (n - 1) * minGap;
      if (!fits || (lens.length > 0 && sum + len > target)) break;
      lens.push(len);
      sum += len;
    }
    if (lens.length === 0) {
      lens.push(1);
      sum = 1;
    }

    // Share the spare tiles out among the gaps.
    const n = lens.length;
    const spare = ring - sum - bigGap - (n - 1) * minGap;
    const weights = [];
    let wsum = 0;
    for (let i = 0; i < n; i++) {
      const w = rng.next() + 0.2;
      weights.push(w);
      wsum += w;
    }
    const gaps = [];
    for (let i = 0; i < n; i++) gaps.push((i === 0 ? bigGap : minGap) + (spare * weights[i]) / wsum);

    const pool = titles();
    lane.cars.length = 0;
    let x = 0;
    for (let i = 0; i < n; i++) {
      lane.cars.push({ x, len: lens[i], title: rng.pick(pool[lens[i]]) });
      x += lens[i] + gaps[(i + 1) % n];
    }
    lane.speed = speed;
    lane.dir = ctx.meetingDir;
    lane.ring = ring;
    lane.pad = (ring - GRID.COLS) / 2;
    lane.phase = rng.range(0, ring);
    lane.gaps = gaps;
  },

  update(lane, dt) {
    lane.phase = (lane.phase + lane.speed * lane.dir * dt) % lane.ring;
    if (lane.phase < 0) lane.phase += lane.ring;
  },

  // Left edge of a car in world columns.
  carLeft(lane, car) {
    let p = (car.x + lane.phase) % lane.ring;
    if (p < 0) p += lane.ring;
    return p - lane.pad;
  },

  blocks() {
    return 0;
  },

  collide(lane, player) {
    const px = player.x + 0.5;
    const half = TUNING.PLAYER_HALF_W;
    const inset = TUNING.HAZARD_INSET;
    for (const car of lane.cars) {
      const l = meetings.carLeft(lane, car);
      if (px + half > l + inset && px - half < l + car.len - inset) {
        return { cause: 'meeting', car };
      }
    }
    return null;
  },

  // Clear now and for the next moment, used by Live Assist.
  safeAt(lane, col) {
    const half = TUNING.PLAYER_HALF_W;
    for (const ahead of [0, 0.35]) {
      for (const car of lane.cars) {
        const l = meetings.carLeft(lane, car) + lane.speed * lane.dir * ahead;
        if (col + 0.5 + half > l && col + 0.5 - half < l + car.len) return false;
      }
    }
    return true;
  },

  hitboxes(lane) {
    return lane.cars.map((car) => {
      const l = meetings.carLeft(lane, car);
      return [l + TUNING.HAZARD_INSET, l + car.len - TUNING.HAZARD_INSET];
    });
  },

  drawGround(ctx, lane, v, y) {
    const w = v.tile * GRID.COLS;
    const top = y - v.rowH;
    ctx.fillStyle = PAL.track;
    ctx.fillRect(v.ox, top, w, v.rowH + 0.5);
    // Calendar slot lines: solid on the hour, faint on the half hour.
    ctx.fillStyle = PAL.trackLine;
    for (let c = 0; c <= GRID.COLS; c++) {
      ctx.fillRect(v.ox + c * v.tile - 0.5, top, 1, v.rowH);
    }
    ctx.fillRect(v.ox, top, w, 1);
  },

  drawObjects(ctx, lane, v, y) {
    const t = v.tile;
    for (const car of lane.cars) {
      const l = meetings.carLeft(lane, car);
      if (l > GRID.COLS + 0.5 || l + car.len < -0.5) continue;
      const x = v.ox + l * t;
      const gy = y - v.rowH * 0.14;
      shadow(ctx, x + (car.len * t) / 2, gy + v.rowH * 0.04, (car.len * t) / 2, v.rowH * 0.14);
      drawMeeting(ctx, x, gy, car, v, lane.dir);
    }
  },
};

function drawMeeting(ctx, x, gy, car, v, dir) {
  const t = v.tile;
  const w = car.len * t - t * 0.1;
  const depth = v.rowH * 0.62;
  const height = t * 0.3;
  const pad = v.line * 2;
  const sw = w + pad * 2;
  const sh = depth + height + pad * 2;
  const key = `m|${car.len}|${car.title}|${dir}`;
  const img = sprite(key, sw, sh, v, (c) => {
    const x0 = pad;
    const g = pad + depth + height;
    const r = t * 0.08;
    c.lineWidth = v.line;
    c.strokeStyle = PAL.ink;
    // Front face with 15 minute ticks: the block's length reads by shape too.
    c.fillStyle = PAL.brandFront;
    roundRect(c, x0, g - height - r, w, height + r, r);
    c.fill();
    c.stroke();
    c.fillStyle = PAL.brandText;
    const ticks = car.len * 2;
    for (let i = 1; i < ticks; i++) {
      const tx = x0 + (w * i) / ticks;
      const th = i % 2 === 0 ? height * 0.5 : height * 0.28;
      c.fillRect(tx - v.line / 2, g - th - v.line, v.line, th);
    }
    // Direction chevron on the leading edge.
    const cx = dir > 0 ? x0 + w - t * 0.12 : x0 + t * 0.12;
    const cy = g - height * 0.55;
    c.beginPath();
    c.moveTo(cx - dir * t * 0.05, cy - height * 0.25);
    c.lineTo(cx + dir * t * 0.03, cy);
    c.lineTo(cx - dir * t * 0.05, cy + height * 0.25);
    c.strokeStyle = PAL.brandText;
    c.lineWidth = v.line * 1.2;
    c.stroke();
    // Top face: a calendar event card.
    c.lineWidth = v.line;
    c.strokeStyle = PAL.ink;
    c.fillStyle = PAL.brandTop;
    roundRect(c, x0, g - height - depth, w, depth, r);
    c.fill();
    c.stroke();
    c.fillStyle = PAL.brandStripe;
    c.fillRect(x0 + v.line, g - height - depth + v.line * 1.5, t * 0.07, depth - v.line * 3);
    // Title.
    const tx = x0 + t * 0.14;
    const maxW = w - t * 0.2;
    const size = fitText(c, car.title, maxW, t * 0.24, t * 0.16, 700, FONT_UI);
    c.fillStyle = PAL.brandText;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.save();
    c.beginPath();
    c.rect(tx, g - height - depth, maxW, depth);
    c.clip();
    c.fillText(car.title, tx, g - height - depth / 2 + size * 0.05);
    c.restore();
  });
  ctx.drawImage(img, x - pad + t * 0.05, gy - depth - height - pad, sw, sh);
}

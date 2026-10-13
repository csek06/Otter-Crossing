// The river: floating logs act as platforms. Plain logs on wavy water, with no
// text, so the logs and pickups read clearly.
//
// Crocodiles: from CROC.MIN_ROW on, some river lanes swap one log for a crocodile.
// Its back and tail ride like a log. Its head swims out in front, in the gap
// ahead of it, and land on the head (or walk onto it) and it bites. A swimmer
// it passes is not bitten: the body comes along behind and scoops the otter up
// like any log, so the swim rule below still holds.
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

export const CROC = {
  MIN_ROW: 30,    // no crocodiles before this lane
  HEAD: 0.9,      // tiles the head reaches out ahead of the body
  CHANCE_MIN: 0.2, // chance a river lane has a crocodile, early
  CHANCE_MAX: 0.35, // and late
  SNAP: 0.07,     // seconds the jaws stay wide before they snap shut on a bite
};

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
      // Once the log's phrase; now it decides crocodiles, so courses stay the same.
      const roll = rng.next();
      lane.platforms.push({ x, len, token: false, taken: false, lit: 0, croc: false, roll, chomp: -1 });
      x += len + rng.range(minGap, maxGap);
    }
    lane.ring = x;
    // Some lanes get one crocodile, on a log where its head fits in the water ahead.
    lane.crocs = 0;
    const chance = row >= CROC.MIN_ROW ? lerp(CROC.CHANCE_MIN, CROC.CHANCE_MAX, d) : 0;
    const ps = lane.platforms;
    const roll = ps[0].roll;
    const first = roll < chance ? Math.floor((roll / chance) * ps.length) : ps.length;
    for (let j = 0; j < ps.length && first < ps.length && !lane.crocs; j++) {
      const i = (first + j) % ps.length;
      const p = ps[i];
      // The gap on the side it swims toward (around the ring at the ends).
      const n = ps.length;
      let ahead;
      if (ctx.riverDir > 0) {
        const next = ps[(i + 1) % n];
        ahead = next.x + (i + 1 === n ? x : 0) - (p.x + p.len);
      } else {
        const prev = ps[(i - 1 + n) % n];
        ahead = p.x - (prev.x + prev.len - (i === 0 ? x : 0));
      }
      if (ahead < CROC.HEAD + 0.4) continue;
      p.croc = true;
      lane.crocs = 1;
    }
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
    for (const p of lane.platforms) {
      if (p.lit > 0) p.lit = Math.max(0, p.lit - dt);
      if (p.chomp >= 0) p.chomp += dt;
    }
  },

  left(lane, plat) {
    let p = (plat.x + lane.phase) % lane.ring;
    if (p < 0) p += lane.ring;
    return p - lane.pad;
  },

  // The tile span of a crocodile's head: out in front, in the direction it swims.
  headSpan(lane, plat) {
    const l = river.left(lane, plat);
    return lane.dir > 0 ? [l + plat.len, l + plat.len + CROC.HEAD] : [l - CROC.HEAD, l];
  },

  // The crocodile whose head is under column x, if any.
  headAt(lane, x) {
    if (!lane.crocs) return null;
    const cx = x + 0.5;
    for (const plat of lane.platforms) {
      if (!plat.croc) continue;
      const [a, b] = river.headSpan(lane, plat);
      if (cx >= a + 0.05 && cx <= b - 0.05) return plat;
    }
    return null;
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
    // Landing on a crocodile's head, or stepping onto it from its back: a bite.
    // collide() reports it. A swimmer it passes is left alone.
    const croc = river.headAt(lane, player.x);
    if (croc && (player.swim < 0 || player.land > 0)) {
      player.bite = croc;
      return null;
    }
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
    if (player.bite) {
      const plat = player.bite;
      player.bite = null;
      return { cause: 'croc', plat };
    }
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
      if (plat.croc) drawCroc(ctx, v.ox + l * t, y, plat, lane.dir, v);
      else drawHighlight(ctx, v.ox + l * t, y, plat, v);
      if (plat.token && !plat.taken) drawToken(ctx, v.ox + (l + plat.len / 2) * t, y - v.rowH * 0.62, v, v.time);
      const pu = lane.powerup;
      if (pu && pu.plat === plat && !pu.taken) drawPickup(ctx, v.ox + (l + plat.len / 2) * t, y - v.rowH * 0.45, v, pu.id, v.time);
    }
  },
};

// Rows of scalloped crests across the whole lane. They drift with the current
// at slightly different rates, so the water looks like it is moving.
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
  // Four evenly spaced rows across the whole lane, each drifting at its own
  // rate (600 tiles is still a whole number of waves at every rate).
  const rows = [
    { y: top + v.rowH * 0.2, k: 1.25, off: 0 },
    { y: top + v.rowH * 0.42, k: 0.95, off: WAVE_LEN / 2 },
    { y: top + v.rowH * 0.64, k: 1.1, off: WAVE_LEN / 4 },
    { y: top + v.rowH * 0.86, k: 0.8, off: (WAVE_LEN * 3) / 4 },
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

// A floating log: bark, grooves and a cut end.
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
}

// A crocodile: the body (the part you can ride) is the platform, the head
// reaches out ahead of it. Drawn with the head on the right, mirrored when it
// swims left. The jaws open and shut slowly as a tell, and snap shut on a bite.
function drawCroc(ctx, x, y, plat, dir, v) {
  const t = v.tile;
  const w = plat.len * t;
  const H = CROC.HEAD * t;
  const sink = plat.lit > 0 ? t * 0.03 : 0;
  const h = v.rowH * 0.6;
  const top = y - v.rowH * 0.8 + sink;
  const lw = v.line;
  ctx.save();
  if (dir > 0) ctx.translate(x, 0);
  else {
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = PAL.ink;
  ctx.lineJoin = 'round';

  // Ripple around it, like a log.
  ctx.fillStyle = plat.lit > 0 ? PAL.ripple : PAL.waterRing;
  ctx.beginPath();
  ctx.ellipse((w + H) / 2, top + h * 0.85, (w + H) / 2 + t * 0.04, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail tapering to a point, then the body.
  const x0 = t * 0.04;
  const tailEnd = x0 + Math.min(w * 0.35, t * 0.8);
  ctx.fillStyle = PAL.croc;
  ctx.beginPath();
  ctx.moveTo(x0, top + h * 0.62);
  ctx.quadraticCurveTo(tailEnd * 0.6, top + h * 0.12, tailEnd, top + h * 0.05);
  ctx.lineTo(w, top + h * 0.02);
  ctx.lineTo(w, top + h);
  ctx.lineTo(tailEnd, top + h);
  ctx.quadraticCurveTo(tailEnd * 0.6, top + h * 0.95, x0, top + h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Darker flank below the waterline, and two rows of bumpy scutes down the back.
  ctx.save();
  ctx.beginPath();
  ctx.rect(tailEnd * 0.5, top + h * 0.66, w, h);
  ctx.clip();
  ctx.fillStyle = PAL.crocDark;
  ctx.fillRect(0, top, w, h);
  ctx.restore();
  ctx.fillStyle = PAL.crocDark;
  for (let sx = tailEnd * 0.7; sx < w - t * 0.1; sx += t * 0.2) {
    const yb = sx < tailEnd ? top + h * (0.08 + 0.32 * (1 - sx / tailEnd)) : top + h * 0.08;
    for (const row of [0.14, 0.38]) {
      ctx.beginPath();
      ctx.ellipse(sx + (row > 0.2 ? t * 0.1 : 0), yb + h * row, t * 0.055, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Stubby legs at the waterline.
  for (const lx of [tailEnd + t * 0.1, w - t * 0.3]) {
    if (lx > w - t * 0.15 || lx < x0) continue;
    ctx.fillStyle = PAL.croc;
    ctx.beginPath();
    ctx.ellipse(lx, top + h * 0.95, t * 0.09, h * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // The jaws: open and shut about once every two seconds; still under reduced motion.
  let open;
  if (plat.chomp >= 0) open = plat.chomp < CROC.SNAP ? 1 : 0;
  else if (v.still) open = 0.5;
  else open = 0.5 + 0.5 * Math.sin(v.time * Math.PI + plat.x * 3);
  const a = open * 0.42;
  const px = w - t * 0.02;
  const py = top + h * 0.55;
  const tipX = w + H;
  // Inside of the mouth.
  ctx.fillStyle = PAL.mouth;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + (tipX - px) * Math.cos(a), py - (tipX - px) * Math.sin(a));
  ctx.lineTo(px + (tipX - px) * Math.cos(a * 0.6), py + (tipX - px) * Math.sin(a * 0.6));
  ctx.closePath();
  ctx.fill();
  // Lower jaw, then the upper jaw with its teeth.
  jaw(ctx, px, py, a * 0.6, (j) => {
    ctx.fillStyle = PAL.crocBelly;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(j * 0.94, 0);
    ctx.quadraticCurveTo(j * 0.98, h * 0.22, j * 0.82, h * 0.3);
    ctx.lineTo(0, h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    teeth(ctx, j, -1, t, lw);
  }, tipX - px);
  jaw(ctx, px, py, -a, (j) => {
    ctx.fillStyle = PAL.croc;
    ctx.beginPath();
    ctx.moveTo(-t * 0.02, -h * 0.55);
    ctx.quadraticCurveTo(j * 0.5, -h * 0.5, j, -h * 0.18);
    ctx.quadraticCurveTo(j * 1.02, 0, j * 0.94, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    teeth(ctx, j, 1, t, lw);
    // Nostrils at the tip.
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(j * 0.86, -h * 0.2, t * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }, tipX - px);
  // Eye bump with a slit pupil, on top of the head.
  ctx.fillStyle = PAL.croc;
  ctx.beginPath();
  ctx.arc(px + t * 0.06, top + h * 0.04, t * 0.09, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PAL.highlighter;
  ctx.beginPath();
  ctx.ellipse(px + t * 0.07, top + h * 0.0, t * 0.05, t * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(px + t * 0.06, top - h * 0.06, t * 0.02, t * 0.065);
  ctx.restore();
}

function jaw(ctx, px, py, angle, draw, len) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  draw(len);
  ctx.restore();
}

// A row of small teeth along a jaw edge. side 1 points down (upper jaw), -1 up.
function teeth(ctx, len, side, t, lw) {
  ctx.fillStyle = PAL.paper;
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = lw * 0.5;
  for (let tx = len * 0.22; tx < len * 0.9; tx += t * 0.13) {
    ctx.beginPath();
    ctx.moveTo(tx - t * 0.035, 0);
    ctx.lineTo(tx, side * t * 0.06);
    ctx.lineTo(tx + t * 0.035, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineWidth = lw;
}

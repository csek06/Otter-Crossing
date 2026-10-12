// Transcript river: the water is a stream of Otter feature blurbs flowing past.
// Highlights glow on top of key phrases and act as platforms.
//
// Otters swim, so falling in is not instant: the current carries the otter
// sideways and it has SWIM_TIME seconds to reach a highlight.
//
// Rule (checked by the generator test): every gap between highlights is at most
// RIVER_MAX_WAIT seconds of current, so a highlight passes any column at least that often.

import { GRID, RULES, FLAGS } from '../config.js';
import { CONTENT } from '../content.js';
import { PAL } from '../render/palette.js';
import { roundRect, fitText, FONT_MONO } from '../render/primitives.js';
import { drawToken } from '../render/token.js';

const lerp = (a, b, t) => a + (b - a) * t;

// "Feature name: tagline" for every feature that is live, plus any extra blurbs.
export function riverLines() {
  const lines = [];
  for (const f of Object.values(CONTENT.features)) {
    if (f.placeholder && !FLAGS.SHOW_UNRELEASED) continue;
    lines.push(`${f.name}: ${f.tagline}`);
  }
  return lines.concat(CONTENT.river.extraBlurbs || []);
}

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
    const phrases = CONTENT.river.phrases;

    lane.platforms.length = 0;
    let x = 0;
    // Keep adding highlights until the ring is wide enough that the wrap point
    // is always off-screen.
    const minRing = GRID.COLS + 2 * maxLen + 1;
    while (x < minRing || lane.platforms.length < 3) {
      const len = rng.int(minLen, maxLen);
      lane.platforms.push({ x, len, phrase: rng.pick(phrases), token: false, taken: false, lit: 0 });
      x += len + rng.range(minGap, maxGap);
    }
    lane.ring = x;
    lane.speed = speed;
    lane.dir = ctx.riverDir;
    lane.pad = (lane.ring - GRID.COLS) / 2;
    lane.phase = rng.range(0, lane.ring);
    lane.lineIndex = rng.int(0, 31);
    lane.sprite = null;
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

  // Blue water with wave crests, and a stream of feature blurbs flowing on it.
  drawGround(ctx, lane, v, y) {
    const t = v.tile;
    const top = y - v.rowH;
    ctx.fillStyle = PAL.water;
    ctx.fillRect(v.ox - 1, top, t * GRID.COLS + 2, v.rowH + 0.5);
    // A darker band along the far bank gives the water some depth.
    ctx.fillStyle = PAL.waterDeep;
    ctx.fillRect(v.ox - 1, top, t * GRID.COLS + 2, v.rowH * 0.22);
    drawWaves(ctx, lane, v, top);
    const img = textSprite(lane, v);
    const ringPx = lane.ring * t;
    let x0 = v.ox + (lane.phase - lane.pad) * t;
    while (x0 > v.ox) x0 -= ringPx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.ox, top, t * GRID.COLS, v.rowH);
    ctx.clip();
    for (let x = x0; x < v.ox + t * GRID.COLS; x += ringPx) ctx.drawImage(img, x, top, ringPx, v.rowH);
    ctx.restore();
    // Line break between transcript lines.
    ctx.fillStyle = PAL.riverLine;
    ctx.fillRect(v.ox, top, t * GRID.COLS, 1);
  },

  drawObjects(ctx, lane, v, y) {
    const t = v.tile;
    for (const plat of lane.platforms) {
      const l = river.left(lane, plat);
      if (l > GRID.COLS + 0.5 || l + plat.len < -0.5) continue;
      drawHighlight(ctx, v.ox + l * t, y, plat, v);
      if (plat.token && !plat.taken) drawToken(ctx, v.ox + (l + plat.len / 2) * t, y - v.rowH * 0.62, v, v.time);
    }
  },
};

// Two rows of scalloped crests above and below the text. They drift with the
// current at slightly different rates, so the water looks like it is moving.
const WAVE_LEN = 0.6; // tiles
function drawWaves(ctx, lane, v, top) {
  const t = v.tile;
  const w = t * GRID.COLS;
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.ox, top, w, v.rowH);
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
    for (; x < v.ox + w; x += len) {
      // One crest: a short arch, then a flat trough before the next.
      ctx.moveTo(x, r.y);
      ctx.quadraticCurveTo(x + len * 0.25, r.y - amp * 2, x + len * 0.5, r.y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Pre-render the lane's scrolling transcript text once, sized to the ring.
function textSprite(lane, v) {
  const key = v.tile + '|' + v.scale;
  if (lane.sprite && lane.spriteKey === key) return lane.sprite;
  const t = v.tile;
  const w = Math.ceil(lane.ring * t);
  const h = Math.ceil(v.rowH);
  const c = lane.sprite || document.createElement('canvas');
  c.width = Math.ceil(w * v.scale);
  c.height = Math.ceil(h * v.scale);
  const g = c.getContext('2d');
  g.setTransform(v.scale, 0, 0, v.scale, 0, 0);
  g.clearRect(0, 0, w, h);
  const lines = riverLines();
  const size = t * 0.3;
  g.font = `600 ${size}px ${FONT_MONO}`;
  g.textBaseline = 'middle';
  let x = t * 0.2;
  let i = lane.lineIndex;
  while (x < w) {
    const line = lines[i % lines.length];
    const colon = line.indexOf(':');
    const speaker = colon > 0 ? line.slice(0, colon + 1) : '';
    const said = colon > 0 ? line.slice(colon + 1) : line;
    g.fillStyle = PAL.riverSpeaker;
    g.fillText(speaker, x, h * 0.52);
    x += g.measureText(speaker).width;
    g.fillStyle = PAL.riverText;
    g.fillText(said, x, h * 0.52);
    x += g.measureText(said).width + t * 0.6;
    i++;
  }
  // Clear the text under each highlight so the phrase on top reads cleanly.
  for (const p of lane.platforms) g.clearRect(p.x * t - t * 0.25, 0, p.len * t + t * 0.5, h);
  lane.sprite = c;
  lane.spriteKey = key;
  return c;
}

// A floating log with a highlighter stripe across the middle carrying the phrase.
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

  // Highlighter stripe with the phrase.
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
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, by, right - left, bh);
  ctx.clip();
  ctx.fillStyle = PAL.ink;
  fitText(ctx, plat.phrase, right - left - t * 0.08, t * 0.27, t * 0.15, 600, FONT_MONO);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(plat.phrase, (left + right) / 2, by + bh * 0.55);
  ctx.restore();
}

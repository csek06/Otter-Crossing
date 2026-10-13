// Art for the daily challenge's habitat: the otter's own river valley. The lanes
// play exactly as they do in the office (same course, same hitboxes); only the
// look changes. Meetings become animals on the trail, the all-hands express is a
// flock of geese coming in low, focus lanes are meadow with rocks and trees, and
// the river keeps its logs.

import { PAL } from './palette.js';
import { roundRect, block, shadow } from './primitives.js';
import { sprite } from './sprites.js';

// Which animal walks a meeting's slot. 30, 60 and 90 minute meetings are 1, 2
// and 3 tiles long, so the animal's size matches the hitbox.
const ANIMALS = { 1: ['turtle', 'duck'], 2: ['beaver', 'fox'], 3: ['moose', 'bear'] };
export function animalFor(car) {
  const list = ANIMALS[car.len] || ANIMALS[1];
  let h = 0;
  for (const ch of car.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

// Focus lane obstacles in the habitat, by the office obstacle they replace.
const NATURE = { desk: 'rock', plant: 'bush', mug: 'stump', cabinet: 'pine' };

export function hash2(a, b) {
  let x = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 2654435761) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

// x is the animal's left edge, gy the ground line. Facing dir (1 is right).
export function drawAnimal(ctx, x, gy, car, dir, v) {
  const t = v.tile;
  const kind = animalFor(car);
  const w = car.len * t - t * 0.1;
  const pad = v.line * 2 + t * 0.05;
  const sw = w + pad * 2;
  const sh = t * 1.6;
  const img = sprite(`hab|${kind}|${car.len}|${dir}`, sw, sh, v, (c) => {
    c.save();
    if (dir < 0) {
      c.translate(sw, 0);
      c.scale(-1, 1);
    }
    c.translate(pad, 0);
    c.lineWidth = v.line;
    c.strokeStyle = PAL.ink;
    c.lineJoin = 'round';
    ANIMAL_ART[kind](c, w, sh - pad, t, v);
    c.restore();
  });
  // A small walking bob, off when reduced motion is on.
  const bob = v.still ? 0 : Math.abs(Math.sin(v.time * 7 + x * 0.05)) * t * 0.03;
  shadow(ctx, x + w / 2 + t * 0.05, gy + v.rowH * 0.04, w / 2, v.rowH * 0.14);
  ctx.drawImage(img, x - pad + t * 0.05, gy - sh + pad - bob, sw, sh);
}

function ellipse(c, x, y, rx, ry, fill, rot = 0) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

function eye(c, x, y, t) {
  c.fillStyle = PAL.ink;
  c.beginPath();
  c.arc(x, y, t * 0.035, 0, Math.PI * 2);
  c.fill();
}

function legs(c, xs, top, g, lw, fill) {
  c.fillStyle = fill;
  for (const lx of xs) {
    roundRect(c, lx - lw / 2, top, lw, g - top, lw * 0.4);
    c.fill();
    c.stroke();
  }
}

// Each draws facing right in a box w wide, standing on the line g.
const ANIMAL_ART = {
  turtle(c, w, g, t) {
    const cx = w * 0.46;
    legs(c, [cx - t * 0.22, cx + t * 0.22], g - t * 0.1, g, t * 0.1, PAL.grassLight);
    ellipse(c, cx + t * 0.36, g - t * 0.13, t * 0.11, t * 0.08, PAL.grassLight);
    eye(c, cx + t * 0.4, g - t * 0.15, t);
    c.fillStyle = PAL.shell;
    c.beginPath();
    c.ellipse(cx, g - t * 0.08, t * 0.33, t * 0.3, 0, Math.PI, Math.PI * 2);
    c.closePath();
    c.fill();
    c.stroke();
    // Shell plates.
    c.strokeStyle = PAL.grassDark;
    c.beginPath();
    c.moveTo(cx - t * 0.12, g - t * 0.08);
    c.lineTo(cx - t * 0.08, g - t * 0.27);
    c.lineTo(cx + t * 0.08, g - t * 0.27);
    c.lineTo(cx + t * 0.12, g - t * 0.08);
    c.stroke();
    c.strokeStyle = PAL.ink;
    c.fillStyle = PAL.grassDark;
    c.fillRect(cx - t * 0.33, g - t * 0.1, t * 0.66, t * 0.04);
  },
  duck(c, w, g, t) {
    const cx = w * 0.45;
    c.strokeStyle = PAL.beak;
    c.lineWidth = t * 0.05;
    c.beginPath();
    c.moveTo(cx - t * 0.06, g - t * 0.12);
    c.lineTo(cx - t * 0.06, g);
    c.moveTo(cx + t * 0.08, g - t * 0.12);
    c.lineTo(cx + t * 0.08, g);
    c.stroke();
    c.strokeStyle = PAL.ink;
    c.lineWidth = Math.max(1, t * 0.035);
    // Tail, body, wing.
    c.fillStyle = PAL.brown;
    c.beginPath();
    c.moveTo(cx - t * 0.26, g - t * 0.26);
    c.lineTo(cx - t * 0.42, g - t * 0.36);
    c.lineTo(cx - t * 0.32, g - t * 0.18);
    c.closePath();
    c.fill();
    c.stroke();
    ellipse(c, cx, g - t * 0.24, t * 0.3, t * 0.15, PAL.sand);
    ellipse(c, cx - t * 0.04, g - t * 0.26, t * 0.18, t * 0.08, PAL.brown);
    // Green head with a white collar, and a beak.
    ellipse(c, cx + t * 0.28, g - t * 0.32, t * 0.07, t * 0.04, PAL.beak);
    ellipse(c, cx + t * 0.18, g - t * 0.42, t * 0.11, t * 0.1, PAL.pine);
    c.fillStyle = PAL.paper;
    c.fillRect(cx + t * 0.1, g - t * 0.34, t * 0.12, t * 0.025);
    eye(c, cx + t * 0.21, g - t * 0.45, t);
  },
  beaver(c, w, g, t) {
    // Flat tail behind, with a crosshatch.
    ellipse(c, t * 0.3, g - t * 0.08, t * 0.3, t * 0.08, PAL.brownDark);
    const bx = w * 0.55;
    legs(c, [bx - t * 0.32, bx + t * 0.3], g - t * 0.14, g, t * 0.14, PAL.brownDark);
    ellipse(c, bx, g - t * 0.3, t * 0.55, t * 0.27, PAL.brown);
    const hx = w - t * 0.3;
    ellipse(c, hx - t * 0.12, g - t * 0.5, t * 0.07, t * 0.07, PAL.brown);
    ellipse(c, hx, g - t * 0.37, t * 0.22, t * 0.19, PAL.brown);
    // Buck teeth and a nose.
    c.fillStyle = PAL.paper;
    c.fillRect(hx + t * 0.1, g - t * 0.26, t * 0.08, t * 0.09);
    c.strokeRect(hx + t * 0.1, g - t * 0.26, t * 0.08, t * 0.09);
    ellipse(c, hx + t * 0.2, g - t * 0.38, t * 0.05, t * 0.04, PAL.ink);
    eye(c, hx + t * 0.06, g - t * 0.45, t);
  },
  fox(c, w, g, t) {
    // Bushy tail with a white tip.
    ellipse(c, t * 0.42, g - t * 0.5, t * 0.36, t * 0.14, PAL.fox, -0.35);
    ellipse(c, t * 0.12, g - t * 0.62, t * 0.1, t * 0.08, PAL.paper, -0.35);
    const bx = w * 0.55;
    legs(c, [bx - t * 0.36, bx - t * 0.22, bx + t * 0.22, bx + t * 0.36], g - t * 0.32, g, t * 0.08, PAL.foxDark);
    ellipse(c, bx, g - t * 0.44, t * 0.5, t * 0.18, PAL.fox);
    ellipse(c, bx + t * 0.38, g - t * 0.4, t * 0.1, t * 0.12, PAL.paper);
    const hx = w - t * 0.28;
    // Ears, head and snout.
    c.fillStyle = PAL.foxDark;
    for (const ex of [-0.1, 0.06]) {
      c.beginPath();
      c.moveTo(hx + ex * t - t * 0.06, g - t * 0.68);
      c.lineTo(hx + ex * t, g - t * 0.86);
      c.lineTo(hx + ex * t + t * 0.06, g - t * 0.68);
      c.closePath();
      c.fill();
      c.stroke();
    }
    ellipse(c, hx, g - t * 0.62, t * 0.15, t * 0.13, PAL.fox);
    c.fillStyle = PAL.fox;
    c.beginPath();
    c.moveTo(hx + t * 0.08, g - t * 0.7);
    c.lineTo(hx + t * 0.3, g - t * 0.6);
    c.lineTo(hx + t * 0.08, g - t * 0.52);
    c.closePath();
    c.fill();
    c.stroke();
    ellipse(c, hx + t * 0.3, g - t * 0.6, t * 0.035, t * 0.035, PAL.ink);
    eye(c, hx + t * 0.05, g - t * 0.65, t);
  },
  moose(c, w, g, t) {
    const bx = w * 0.45;
    legs(c, [bx - t * 0.7, bx - t * 0.5, bx + t * 0.5, bx + t * 0.7], g - t * 0.62, g, t * 0.1, PAL.brownDark);
    ellipse(c, bx, g - t * 0.78, t * 0.92, t * 0.3, PAL.brownDark);
    ellipse(c, bx + t * 0.45, g - t * 1.0, t * 0.32, t * 0.14, PAL.brownDark);
    // Neck, head and the bell under the chin.
    const hx = w - t * 0.38;
    c.fillStyle = PAL.brownDark;
    c.beginPath();
    c.moveTo(bx + t * 0.68, g - t * 1.0);
    c.lineTo(hx, g - t * 0.98);
    c.lineTo(hx, g - t * 0.72);
    c.lineTo(bx + t * 0.78, g - t * 0.62);
    c.closePath();
    c.fill();
    c.stroke();
    ellipse(c, hx + t * 0.02, g - t * 0.62, t * 0.05, t * 0.1, PAL.brownDark);
    ellipse(c, hx + t * 0.12, g - t * 0.86, t * 0.27, t * 0.13, PAL.brown, 0.25);
    // Antlers: two broad paddles.
    c.fillStyle = PAL.sand;
    for (const [ax, rot] of [[-0.14, -0.5], [0.12, 0.4]]) {
      ellipse(c, hx + ax * t, g - t * 1.16, t * 0.2, t * 0.08, PAL.sand, rot);
    }
    eye(c, hx + t * 0.04, g - t * 0.92, t);
  },
  bear(c, w, g, t) {
    const bx = w * 0.46;
    legs(c, [bx - t * 0.62, bx - t * 0.32, bx + t * 0.32, bx + t * 0.62], g - t * 0.4, g, t * 0.2, PAL.brownDark);
    ellipse(c, bx, g - t * 0.6, t * 0.92, t * 0.38, PAL.brownDark);
    ellipse(c, bx + t * 0.35, g - t * 0.85, t * 0.32, t * 0.18, PAL.brownDark);
    const hx = w - t * 0.42;
    ellipse(c, hx - t * 0.1, g - t * 0.98, t * 0.08, t * 0.08, PAL.brownDark);
    ellipse(c, hx + t * 0.14, g - t * 0.98, t * 0.08, t * 0.08, PAL.brownDark);
    ellipse(c, hx + t * 0.03, g - t * 0.76, t * 0.28, t * 0.24, PAL.brownDark);
    ellipse(c, hx + t * 0.22, g - t * 0.7, t * 0.12, t * 0.09, PAL.brown);
    ellipse(c, hx + t * 0.32, g - t * 0.72, t * 0.04, t * 0.035, PAL.ink);
    eye(c, hx + t * 0.1, g - t * 0.82, t);
  },
};

// One goose of the flock, flying low. x is the left edge of its tile. The lead
// goose is bigger. Wings beat twice a second, still with reduced motion.
export function drawGoose(ctx, x, gy, v, dir, lead, i) {
  const t = v.tile;
  const s = lead ? 1.8 : 1.3;
  const span = lead ? 2 : 1;
  const cx = x + (span * t) / 2;
  const cy = gy - t * 0.5;
  shadow(ctx, cx, gy + v.rowH * 0.04, t * 0.32 * s, v.rowH * 0.1);
  const flap = v.still ? 0.3 : Math.sin(v.time * Math.PI * 4 + i * 0.9);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dir * s, s);
  ctx.lineWidth = v.line / s;
  ctx.strokeStyle = PAL.ink;
  ctx.lineJoin = 'round';
  // Far wing, body, near wing.
  wing(ctx, t, -flap, PAL.inkSoft);
  ellipse(ctx, 0, 0, t * 0.3, t * 0.12, PAL.goose);
  ellipse(ctx, -t * 0.02, t * 0.05, t * 0.2, t * 0.06, PAL.paper);
  // Black neck and head with the white chin strap.
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = t * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(t * 0.2, -t * 0.03);
  ctx.lineTo(t * 0.4, -t * 0.12);
  ctx.stroke();
  ctx.lineWidth = v.line / s;
  ellipse(ctx, t * 0.44, -t * 0.14, t * 0.07, t * 0.055, PAL.ink);
  ctx.fillStyle = PAL.paper;
  ctx.fillRect(t * 0.4, -t * 0.14, t * 0.05, t * 0.04);
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.moveTo(t * 0.5, -t * 0.16);
  ctx.lineTo(t * 0.58, -t * 0.13);
  ctx.lineTo(t * 0.5, -t * 0.11);
  ctx.fill();
  wing(ctx, t, flap, PAL.goose);
  ctx.restore();
}

function wing(c, t, k, fill) {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(-t * 0.12, -t * 0.02);
  c.quadraticCurveTo(-t * 0.02, -t * (0.12 + 0.24 * k), t * 0.12, -t * (0.02 + 0.3 * k));
  c.lineTo(t * 0.1, -t * 0.02);
  c.closePath();
  c.fill();
  c.stroke();
}

// Rocks, bushes, stumps and pines on the meadow. x is the tile's left edge, y
// the row's near edge, like the office obstacles.
export function drawNature(ctx, officeKind, x, y, v) {
  const t = v.tile;
  const lw = v.line;
  const gy = y - v.rowH * 0.18;
  const kind = NATURE[officeKind] || officeKind;
  ctx.lineWidth = lw;
  ctx.strokeStyle = PAL.ink;
  switch (kind) {
    case 'rock': {
      shadow(ctx, x + t / 2, gy, t * 0.44, v.rowH * 0.16);
      ctx.fillStyle = PAL.stone;
      ctx.beginPath();
      ctx.moveTo(x + t * 0.08, gy);
      ctx.lineTo(x + t * 0.14, gy - t * 0.3);
      ctx.lineTo(x + t * 0.38, gy - t * 0.5);
      ctx.lineTo(x + t * 0.7, gy - t * 0.44);
      ctx.lineTo(x + t * 0.9, gy - t * 0.18);
      ctx.lineTo(x + t * 0.92, gy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.stoneDark;
      ctx.beginPath();
      ctx.moveTo(x + t * 0.38, gy - t * 0.5);
      ctx.lineTo(x + t * 0.5, gy - t * 0.2);
      ctx.lineTo(x + t * 0.92, gy);
      ctx.lineTo(x + t * 0.9, gy - t * 0.18);
      ctx.lineTo(x + t * 0.7, gy - t * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // A bit of moss on top.
      ctx.fillStyle = PAL.grass;
      ctx.beginPath();
      ctx.ellipse(x + t * 0.36, gy - t * 0.44, t * 0.12, t * 0.05, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bush': {
      shadow(ctx, x + t / 2, gy, t * 0.42, v.rowH * 0.15);
      const blobs = [[0.28, -0.22, 0.2], [0.72, -0.22, 0.2], [0.5, -0.4, 0.24], [0.5, -0.18, 0.22]];
      for (const [bx, by, r] of blobs) ellipse(ctx, x + bx * t, gy + by * t, r * t, r * t * 0.9, by < -0.3 ? PAL.grass : PAL.grassDark);
      ctx.fillStyle = PAL.berry;
      for (const [bx, by] of [[0.36, -0.36], [0.6, -0.46], [0.66, -0.24], [0.3, -0.18]]) {
        ctx.beginPath();
        ctx.arc(x + bx * t, gy + by * t, t * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'stump': {
      shadow(ctx, x + t / 2, gy, t * 0.34, v.rowH * 0.14);
      block(ctx, x + t * 0.22, gy, t * 0.56, v.rowH * 0.36, t * 0.24, PAL.woodEnd, PAL.wood, lw, t * 0.1);
      ctx.strokeStyle = PAL.woodRing;
      ctx.beginPath();
      ctx.ellipse(x + t * 0.5, gy - t * 0.24 - v.rowH * 0.18, t * 0.12, v.rowH * 0.07, 0, 0, Math.PI * 2);
      ctx.stroke();
      // A mushroom at the foot.
      ctx.strokeStyle = PAL.ink;
      ctx.fillStyle = PAL.paper;
      ctx.fillRect(x + t * 0.74, gy - t * 0.1, t * 0.05, t * 0.1);
      ellipse(ctx, x + t * 0.765, gy - t * 0.11, t * 0.08, t * 0.04, PAL.red);
      break;
    }
    case 'pine':
    default:
      drawPine(ctx, x + t / 2, gy, t, lw, 1);
      break;
  }
}

export function drawPine(ctx, cx, gy, t, lw, s = 1) {
  shadow(ctx, cx, gy, t * 0.36 * s, t * 0.12);
  ctx.lineWidth = lw;
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.brownDark;
  ctx.fillRect(cx - t * 0.06, gy - t * 0.24, t * 0.12, t * 0.24);
  ctx.strokeRect(cx - t * 0.06, gy - t * 0.24, t * 0.12, t * 0.24);
  for (let i = 0; i < 3; i++) {
    const base = gy - t * (0.18 + i * 0.3) * s;
    const half = t * (0.4 - i * 0.09) * s;
    ctx.fillStyle = i === 2 ? PAL.grass : PAL.pine;
    ctx.beginPath();
    ctx.moveTo(cx - half, base);
    ctx.lineTo(cx, base - t * 0.46 * s);
    ctx.lineTo(cx + half, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// The narrow margins beside the playfield on phones: a strip of forest.
export function drawTreeline(ctx, row, side, x, top, w, v) {
  ctx.fillStyle = PAL.forest;
  ctx.fillRect(x, top, w, v.rowH + 0.5);
  const h = hash2(row, side);
  if (h % 3 !== 0) {
    const cx = x + w * (0.35 + (h % 7) * 0.05);
    drawPine(ctx, cx, top + v.rowH * 0.9, w * 1.3, v.line * 0.8, 0.9);
  } else {
    ctx.fillStyle = PAL.grassDark;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, top + v.rowH * 0.6, w * 0.34, v.rowH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Flat ground details, fixed to the world so they scroll with the lanes.
export function drawMeadow(ctx, lane, v, top) {
  const t = v.tile;
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(v.gx0, top, v.gx1 - v.gx0, v.rowH + 0.5);
  ctx.fillStyle = PAL.grassLight;
  for (let c = v.c0; c <= v.c1; c++) {
    if (((c + lane.row) & 1) === 0) continue;
    ctx.fillRect(v.ox + c * t, top, t, v.rowH + 0.5);
  }
  // A few flowers and tufts.
  for (let c = v.c0; c <= v.c1; c++) {
    const h = hash2(lane.row, c);
    if (h % 5 !== 0) continue;
    const fx = v.ox + (c + 0.2 + (h % 60) / 100) * t;
    const fy = top + v.rowH * (0.3 + ((h >> 8) % 40) / 100);
    if (h % 2) {
      ctx.fillStyle = (h >> 4) % 2 ? PAL.paper : PAL.highlighter;
      ctx.beginPath();
      ctx.arc(fx, fy, t * 0.04, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = PAL.grassDark;
      ctx.lineWidth = Math.max(1, v.line * 0.8);
      ctx.beginPath();
      ctx.moveTo(fx - t * 0.05, fy);
      ctx.lineTo(fx - t * 0.07, fy - t * 0.08);
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - t * 0.1);
      ctx.moveTo(fx + t * 0.05, fy);
      ctx.lineTo(fx + t * 0.07, fy - t * 0.08);
      ctx.stroke();
    }
  }
}

export function drawTrail(ctx, lane, v, top) {
  const t = v.tile;
  ctx.fillStyle = PAL.dirt;
  ctx.fillRect(v.gx0, top, v.gx1 - v.gx0, v.rowH + 0.5);
  // Grass verges along both edges.
  ctx.fillStyle = PAL.grassDark;
  ctx.fillRect(v.gx0, top, v.gx1 - v.gx0, v.rowH * 0.08);
  ctx.fillRect(v.gx0, top + v.rowH * 0.94, v.gx1 - v.gx0, v.rowH * 0.06);
  // Paw prints and pebbles.
  ctx.fillStyle = PAL.dirtDark;
  for (let c = v.c0; c <= v.c1; c++) {
    const h = hash2(lane.row * 3 + 1, c);
    const px = v.ox + (c + 0.15 + (h % 70) / 100) * t;
    const py = top + v.rowH * (0.3 + ((h >> 6) % 40) / 100);
    if (h % 3 === 0) {
      ctx.beginPath();
      ctx.ellipse(px, py, t * 0.06, t * 0.045, 0, 0, Math.PI * 2);
      for (let k = -1; k <= 1; k++) ctx.ellipse(px + k * t * 0.05, py - t * 0.07, t * 0.022, t * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (h % 3 === 1) {
      ctx.beginPath();
      ctx.ellipse(px, py, t * 0.04, t * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A gravel bar along the river, where the geese fly in low.
export function drawShore(ctx, lane, v, top) {
  const t = v.tile;
  ctx.fillStyle = PAL.gravel;
  ctx.fillRect(v.gx0, top, v.gx1 - v.gx0, v.rowH + 0.5);
  ctx.fillStyle = PAL.stone;
  for (let c = v.c0; c <= v.c1; c++) {
    for (let k = 0; k < 3; k++) {
      const h = hash2(lane.row * 7 + k, c);
      ctx.beginPath();
      ctx.ellipse(v.ox + (c + (h % 90) / 100) * t, top + v.rowH * (0.18 + ((h >> 7) % 66) / 100), t * 0.035, t * 0.024, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

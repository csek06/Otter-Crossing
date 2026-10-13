// The otter, drawn in code: a blocky body, a round head, a headset in brand blue.
// Outfits (see game/wardrobe.js) are drawn on top in drawOutfit.

import { PAL } from './palette.js';
import { block, shadow } from './primitives.js';

// cx: center x. gy: ground y under the otter. lift: hop height in px.
export function drawOtter(ctx, cx, gy, v, o) {
  const t = v.tile;
  const lw = v.line;
  const { facing, lift, sx, sy, alpha, outfit } = o;

  shadow(ctx, cx, gy, t * 0.28 * (1 - Math.min(0.4, lift / t)), v.rowH * 0.13);
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(cx, gy - lift);
  ctx.scale(sx * 1.15, sy * 1.15);

  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const back = facing === 'up';

  // Tail: behind the body. Pointing toward the camera when hopping away.
  ctx.fillStyle = PAL.furDark;
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = lw;
  ctx.beginPath();
  if (back) {
    ctx.ellipse(0, t * 0.04, t * 0.09, t * 0.16, 0, 0, Math.PI * 2);
  } else if (side) {
    ctx.ellipse(-side * t * 0.28, -t * 0.06, t * 0.16, t * 0.07, side * 0.4, 0, Math.PI * 2);
  } else {
    ctx.ellipse(t * 0.2, -t * 0.32, t * 0.07, t * 0.13, 0.5, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

  // Body.
  const bw = t * 0.48;
  const bodyH = t * 0.32;
  block(ctx, -bw / 2, 0, bw, v.rowH * 0.32, bodyH, PAL.fur, PAL.fur, lw, t * 0.14);
  if (!back) {
    ctx.fillStyle = PAL.cream;
    ctx.beginPath();
    ctx.ellipse(side * t * 0.05, -bodyH * 0.45, t * 0.13, bodyH * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head.
  const hw = t * 0.42;
  const hg = -bodyH + t * 0.02;
  const hh = t * 0.24;
  block(ctx, -hw / 2 + side * t * 0.04, hg, hw, v.rowH * 0.24, hh, PAL.fur, PAL.fur, lw, t * 0.15);
  const hx = side * t * 0.04;
  const top = hg - hh - v.rowH * 0.24;

  // Ears.
  ctx.fillStyle = PAL.furDark;
  for (const ex of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + ex * hw * 0.38, top + t * 0.03, t * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Headset band and earcups.
  ctx.strokeStyle = PAL.brand;
  ctx.lineWidth = lw * 2;
  ctx.beginPath();
  ctx.moveTo(hx - hw * 0.5, hg - hh * 0.5);
  ctx.quadraticCurveTo(hx, top - t * 0.06, hx + hw * 0.5, hg - hh * 0.5);
  ctx.stroke();
  ctx.fillStyle = PAL.brand;
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = lw;
  for (const ex of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + ex * hw * 0.5, hg - hh * 0.5, t * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (!back) {
    // Face: muzzle, nose, eyes. Shifts toward the direction of travel.
    const fx = hx + side * t * 0.06;
    const fy = hg - hh * 0.42;
    ctx.fillStyle = PAL.cream;
    ctx.beginPath();
    ctx.ellipse(fx, fy + t * 0.02, t * 0.12, t * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.ellipse(fx, fy - t * 0.005, t * 0.035, t * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(fx + ex * t * 0.085, fy - t * 0.085, t * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }
    // Headset mic on the right side.
    ctx.strokeStyle = PAL.brand;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.moveTo(hx + hw * 0.5, hg - hh * 0.5);
    ctx.quadraticCurveTo(hx + hw * 0.45, fy + t * 0.08, fx + t * 0.12, fy + t * 0.06);
    ctx.stroke();
  }
  if (outfit && outfit !== 'classic') drawOutfit(ctx, outfit, { t, lw, side, back, hx, hg, hh, hw, top, chestX: side * t * 0.05 });
  ctx.restore();
}

function poly(ctx, pts, fill, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// Role outfits read by shape: a tie, a scarf, a lanyard badge, a cap and glasses.
// Halloween costumes: a pumpkin hat, a witch hat, a vampire collar, mummy
// wrappings and a ghost sheet.
function drawOutfit(ctx, id, g) {
  const { t, lw, side, back, hx, hg, hw, top, chestX: cx } = g;
  if (HALLOWEEN[id]) {
    HALLOWEEN[id](ctx, g);
  } else if (id === 'sales') {
    if (back) return;
    // Collar points and a tie.
    poly(ctx, [cx - t * 0.1, hg - t * 0.01, cx - t * 0.01, hg + t * 0.05, cx - t * 0.03, hg - t * 0.01], PAL.paper, lw * 0.8);
    poly(ctx, [cx + t * 0.1, hg - t * 0.01, cx + t * 0.01, hg + t * 0.05, cx + t * 0.03, hg - t * 0.01], PAL.paper, lw * 0.8);
    poly(ctx, [cx - t * 0.03, hg - t * 0.005, cx + t * 0.03, hg - t * 0.005, cx + t * 0.02, hg + t * 0.04, cx - t * 0.02, hg + t * 0.04], PAL.red, lw * 0.8);
    poly(ctx, [cx - t * 0.02, hg + t * 0.04, cx + t * 0.02, hg + t * 0.04, cx + t * 0.045, hg + t * 0.19, cx, hg + t * 0.235, cx - t * 0.045, hg + t * 0.19], PAL.red, lw * 0.8);
  } else if (id === 'cs') {
    // A scarf around the neck with a tail, in teal with a highlighter stripe. Shows from behind too.
    const w = hw * 0.92;
    const tailX = back ? -side * t * 0.08 - t * 0.06 : cx + t * 0.06;
    poly(ctx, [tailX, hg, tailX + t * 0.08, hg, tailX + t * 0.09, hg + t * 0.17, tailX + t * 0.01, hg + t * 0.17], PAL.teal, lw * 0.8);
    ctx.fillStyle = PAL.highlighter;
    ctx.fillRect(tailX + t * 0.012, hg + t * 0.11, t * 0.07, t * 0.025);
    ctx.fillStyle = PAL.teal;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(hx - w / 2, hg - t * 0.035, w, t * 0.075, t * 0.035) : ctx.rect(hx - w / 2, hg - t * 0.035, w, t * 0.075);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.fillStyle = PAL.highlighter;
    ctx.fillRect(hx - w / 2 + t * 0.03, hg - t * 0.006, w - t * 0.06, t * 0.018);
  } else if (id === 'recruiting') {
    // A lanyard with a name badge.
    ctx.strokeStyle = PAL.brand;
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - t * 0.1, hg - t * 0.01);
    ctx.lineTo(cx, hg + t * 0.09);
    ctx.lineTo(cx + t * 0.1, hg - t * 0.01);
    ctx.stroke();
    if (back) return;
    poly(ctx, [cx - t * 0.075, hg + t * 0.085, cx + t * 0.075, hg + t * 0.085, cx + t * 0.075, hg + t * 0.2, cx - t * 0.075, hg + t * 0.2], PAL.paper, lw * 0.8);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(cx - t * 0.068, hg + t * 0.09, t * 0.136, t * 0.03);
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(cx - t * 0.045, hg + t * 0.145, t * 0.09, t * 0.016);
    ctx.fillRect(cx - t * 0.03, hg + t * 0.17, t * 0.06, t * 0.012);
  } else if (id === 'education') {
    // Round glasses, then a mortarboard with a tassel.
    if (!back) {
      const fx = hx + side * t * 0.06;
      const ey = hg - g.hh * 0.42 - t * 0.085;
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = lw * 0.9;
      for (const ex of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(fx + ex * t * 0.085, ey, t * 0.045, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(fx - t * 0.04, ey);
      ctx.lineTo(fx + t * 0.04, ey);
      ctx.stroke();
    }
    const cy = top + t * 0.005;
    poly(ctx, [hx - t * 0.15, cy - t * 0.02, hx + t * 0.15, cy - t * 0.02, hx + t * 0.14, cy + t * 0.05, hx - t * 0.14, cy + t * 0.05], PAL.ink, lw * 0.8);
    poly(ctx, [hx - t * 0.3, cy - t * 0.02, hx, cy - t * 0.1, hx + t * 0.3, cy - t * 0.02, hx, cy + t * 0.06], PAL.inkSoft, lw);
    const tx = hx + (side || 1) * t * 0.22;
    ctx.strokeStyle = PAL.highlighter;
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    ctx.moveTo(hx, cy - t * 0.02);
    ctx.lineTo(tx, cy - t * 0.005);
    ctx.lineTo(tx, cy + t * 0.11);
    ctx.stroke();
    ctx.fillStyle = PAL.highlighter;
    ctx.fillRect(tx - t * 0.02, cy + t * 0.1, t * 0.04, t * 0.05);
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(hx, cy - t * 0.02, t * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Head and body landmarks, in the otter's own space (ground at y 0): the body
// runs from y 0 up to about -0.61 tiles and BODY_HALF tiles either side, the head
// from hg up to top.
const BODY_HALF = 0.24;

const HALLOWEEN = {
  pumpkin(ctx, { t, lw, side, back, hx, top }) {
    // A round pumpkin sitting on the head, with ribs, a stem and a carved grin.
    const cy = top - t * 0.03;
    const rx = t * 0.22;
    const ry = t * 0.13;
    ctx.fillStyle = PAL.pumpkin;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(hx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.pumpkinDark;
    ctx.lineWidth = lw * 0.8;
    for (const k of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(hx + k * rx * 0.55, cy, rx * 0.28, ry * 0.96, 0, -Math.PI / 2, Math.PI / 2, k < 0);
      ctx.stroke();
    }
    poly(ctx, [hx - t * 0.025, cy - ry * 0.9, hx + t * 0.025, cy - ry * 0.9, hx + t * 0.04, cy - ry - t * 0.08, hx - t * 0.005, cy - ry - t * 0.09], PAL.leafDark, lw * 0.8);
    if (back) return;
    const fx = hx + side * t * 0.05;
    ctx.fillStyle = PAL.ink;
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(fx + ex * t * 0.1, cy - t * 0.005);
      ctx.lineTo(fx + ex * t * 0.04, cy - t * 0.005);
      ctx.lineTo(fx + ex * t * 0.07, cy - t * 0.055);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(fx - t * 0.11, cy + t * 0.03);
    ctx.quadraticCurveTo(fx, cy + t * 0.11, fx + t * 0.11, cy + t * 0.03);
    ctx.quadraticCurveTo(fx, cy + t * 0.065, fx - t * 0.11, cy + t * 0.03);
    ctx.fill();
  },

  witch(ctx, { t, lw, side, hx, top }) {
    // A wide brim, a tall cone with a bent tip, and a band with a buckle.
    const by = top + t * 0.02;
    const lean = (side || 1) * t * 0.1;
    poly(ctx, [hx - t * 0.15, by, hx + t * 0.15, by, hx + t * 0.05, by - t * 0.3, hx + lean, by - t * 0.42, hx + t * 0.0, by - t * 0.31], PAL.witch, lw);
    ctx.fillStyle = PAL.witchDark;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(hx, by, t * 0.3, t * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    poly(ctx, [hx - t * 0.145, by - t * 0.005, hx + t * 0.145, by - t * 0.005, hx + t * 0.128, by - t * 0.06, hx - t * 0.128, by - t * 0.06], PAL.power, lw * 0.8);
    ctx.strokeStyle = PAL.highlighter;
    ctx.lineWidth = lw * 1.1;
    ctx.strokeRect(hx - t * 0.028, by - t * 0.052, t * 0.056, t * 0.04);
  },

  vampire(ctx, { t, lw, side, back, hx, hg, hh }) {
    const bw = t * (BODY_HALF + 0.03);
    if (back) {
      // From behind the cape covers the back.
      poly(ctx, [hx - bw * 0.8, hg + t * 0.02, hx + bw * 0.8, hg + t * 0.02, bw + t * 0.04, -t * 0.02, -bw - t * 0.04, -t * 0.02], PAL.ink, lw);
    } else {
      // Cape edges down both sides of the body, red lining showing.
      for (const sx of [-1, 1]) {
        poly(ctx, [sx * bw * 0.7, hg + t * 0.03, sx * bw, hg + t * 0.04, sx * (bw + t * 0.05), -t * 0.02, sx * (bw - t * 0.06), -t * 0.02], PAL.ink, lw * 0.8);
        poly(ctx, [sx * bw * 0.72, hg + t * 0.06, sx * (bw - t * 0.03), -t * 0.03, sx * (bw - t * 0.07), -t * 0.03], PAL.red, lw * 0.6);
      }
    }
    // The tall collar behind the head.
    for (const sx of [-1, 1]) {
      poly(ctx, [hx + sx * hh * 0.35, hg + t * 0.02, hx + sx * t * 0.3, hg - t * 0.16, hx + sx * t * 0.24, hg + t * 0.03], PAL.ink, lw);
      poly(ctx, [hx + sx * hh * 0.45, hg + t * 0.0, hx + sx * t * 0.27, hg - t * 0.11, hx + sx * t * 0.235, hg + t * 0.0], PAL.red, lw * 0.6);
    }
    if (back) return;
    // Two small fangs under the muzzle.
    const fx = hx + side * t * 0.06;
    const fy = hg - hh * 0.42 + t * 0.085;
    ctx.fillStyle = PAL.paper;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = lw * 0.6;
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(fx + ex * t * 0.045, fy);
      ctx.lineTo(fx + ex * t * 0.015, fy);
      ctx.lineTo(fx + ex * t * 0.03, fy + t * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },

  mummy(ctx, { t, lw, side, back, hx, hg, hh }) {
    // Bandage strips wrapped at a slight angle around the body and head.
    const strip = (x0, x1, y, tilt) => {
      const h = t * 0.05;
      poly(ctx, [x0, y + tilt, x1, y - tilt, x1, y - tilt + h, x0, y + tilt + h], PAL.bandage, lw * 0.6);
    };
    const bx = t * (BODY_HALF + 0.01);
    for (let i = 0; i < 4; i++) strip(-bx, bx, -t * (0.1 + i * 0.12), (i % 2 ? 1 : -1) * t * 0.02);
    const hx0 = hx - t * 0.22;
    const hx1 = hx + t * 0.22;
    // Chin and forehead, leaving a gap for the eyes.
    for (const [k, i] of [[0.04, 0], [0.3, 1], [0.42, 2]]) strip(hx0, hx1, hg - t * k, (i % 2 ? -1 : 1) * t * 0.02);
    // A loose end trailing off the side.
    const ex = (side || -1) * -1;
    poly(ctx, [ex * bx, -t * 0.34, ex * (bx + t * 0.1), -t * 0.27, ex * (bx + t * 0.09), -t * 0.23, ex * bx, -t * 0.29], PAL.bandage, lw * 0.6);
    if (back) return;
    // Eyes peek out between the wraps.
    const fx = hx + side * t * 0.06;
    const ey = hg - hh * 0.42 - t * 0.085;
    ctx.fillStyle = PAL.ink;
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(fx + e * t * 0.085, ey, t * 0.032, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  ghost(ctx, { t, lw, side, back, hx, top }) {
    // A sheet over the whole otter: a dome over the head, flaring out to a wavy hem.
    const cx = hx * 0.5;
    const domeY = top + t * 0.12;
    const r = t * 0.25;
    const hemY = -t * 0.01;
    const half = t * (BODY_HALF + 0.09);
    ctx.fillStyle = PAL.paper;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r, domeY);
    ctx.arc(cx, domeY, r, Math.PI, 0);
    ctx.quadraticCurveTo(cx + r * 1.05, hemY - t * 0.25, cx + half, hemY);
    const waves = 4;
    for (let i = 0; i < waves; i++) {
      const xa = cx + half - ((i + 0.5) * 2 * half) / waves;
      const xb = cx + half - ((i + 1) * 2 * half) / waves;
      ctx.quadraticCurveTo(xa, hemY - t * 0.08, xb, hemY);
    }
    ctx.quadraticCurveTo(cx - r * 1.05, hemY - t * 0.25, cx - r, domeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (back) return;
    const fx = cx + side * t * 0.07;
    ctx.fillStyle = PAL.ink;
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(fx + e * t * 0.08, domeY + t * 0.02, t * 0.035, t * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(fx, domeY + t * 0.13, t * 0.03, t * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

// The otter, drawn in code: a blocky body, a round head, a headset in brand blue.

import { PAL } from './palette.js';
import { block, shadow } from './primitives.js';

// cx: center x. gy: ground y under the otter. lift: hop height in px.
export function drawOtter(ctx, cx, gy, v, o) {
  const t = v.tile;
  const lw = v.line;
  const { facing, lift, sx, sy, alpha } = o;

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
  ctx.restore();
}

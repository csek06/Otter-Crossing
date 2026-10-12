// Action item token: a little checkbox that bobs. Checked when collected.

import { PAL } from './palette.js';
import { roundRect, shadow } from './primitives.js';

export function drawToken(ctx, cx, gy, v, time, checked = false, alpha = 1) {
  const t = v.tile;
  const s = t * 0.3;
  const bob = checked ? 0 : Math.sin(time * 4 + cx * 0.05) * t * 0.04;
  if (!checked) shadow(ctx, cx, gy, s * 0.55, v.rowH * 0.07);
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  const x = cx - s / 2;
  const y = gy - s - t * 0.14 + bob;
  ctx.lineWidth = v.line * 1.2;
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.paper;
  roundRect(ctx, x, y, s, s, s * 0.2);
  ctx.fill();
  ctx.stroke();
  if (checked) {
    ctx.strokeStyle = PAL.brand;
    ctx.lineWidth = v.line * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.22, y + s * 0.52);
    ctx.lineTo(x + s * 0.44, y + s * 0.74);
    ctx.lineTo(x + s * 0.8, y + s * 0.26);
    ctx.stroke();
  }
  ctx.restore();
}

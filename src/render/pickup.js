// Power-up pickups: a glowing brand badge with the feature's icon. The glow
// breathes slowly (once a second), well under the 3 flashes a second limit.

import { PAL, rgba } from './palette.js';
import { roundRect, shadow } from './primitives.js';
import { iconPath } from './icons.js';

export function drawPickup(ctx, cx, gy, v, id, time) {
  const t = v.tile;
  const s = t * 0.56;
  const bob = Math.sin(time * 3) * t * 0.05;
  const pulse = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
  shadow(ctx, cx, gy, s * 0.5, v.rowH * 0.1);
  const y = gy - s - t * 0.2 + bob;
  // Glow.
  ctx.fillStyle = rgba(PAL.brand, 0.14 + 0.16 * pulse);
  ctx.beginPath();
  ctx.arc(cx, y + s / 2, s * (0.85 + 0.12 * pulse), 0, Math.PI * 2);
  ctx.fill();
  // Badge with a raised edge.
  ctx.lineWidth = v.line;
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.brandFront;
  roundRect(ctx, cx - s / 2, y + t * 0.06, s, s, s * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PAL.brand;
  roundRect(ctx, cx - s / 2, y, s, s, s * 0.22);
  ctx.fill();
  ctx.stroke();
  drawIcon(ctx, id, cx, y + s / 2, s * 0.7, PAL.paper, v.line * 1.1);
}

export function drawIcon(ctx, id, cx, cy, size, color, lw) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = (lw * 24) / size + 0.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(iconPath(id));
  ctx.restore();
}

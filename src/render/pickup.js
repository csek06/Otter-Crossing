// Power-up pickups: a superhero green badge with the feature's icon, a green
// halo and slowly turning rays, so they stand out from the blue meetings and
// river. The glow breathes once a second, well under the 3 flashes a second
// limit. With reduced motion the rays hold still.

import { PAL, rgba } from './palette.js';
import { roundRect, shadow } from './primitives.js';
import { iconPath } from './icons.js';

export function drawPickup(ctx, cx, gy, v, id, time) {
  const t = v.tile;
  const s = t * 0.56;
  const still = v.still;
  const bob = still ? 0 : Math.sin(time * 3) * t * 0.05;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
  shadow(ctx, cx, gy, s * 0.5, v.rowH * 0.1);
  const y = gy - s - t * 0.2 + bob;
  const my = y + s / 2;
  // Halo: a soft green disc fading out.
  const r = s * (1.05 + 0.15 * pulse);
  const g = ctx.createRadialGradient(cx, my, s * 0.2, cx, my, r);
  g.addColorStop(0, rgba(PAL.powerLight, 0.75));
  g.addColorStop(0.55, rgba(PAL.power, 0.35 + 0.2 * pulse));
  g.addColorStop(1, rgba(PAL.power, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, my, r, 0, Math.PI * 2);
  ctx.fill();
  // Rays: eight thin spikes turning slowly.
  const spin = still ? 0 : time * 0.8;
  ctx.fillStyle = rgba(PAL.power, 0.55 + 0.25 * pulse);
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = spin + (k * Math.PI) / 4;
    const len = s * (k % 2 ? 0.85 : 1.05) * (0.95 + 0.1 * pulse);
    const w = 0.13;
    ctx.moveTo(cx + Math.cos(a - w) * s * 0.45, my + Math.sin(a - w) * s * 0.45);
    ctx.lineTo(cx + Math.cos(a) * len, my + Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a + w) * s * 0.45, my + Math.sin(a + w) * s * 0.45);
  }
  ctx.fill();
  // Badge with a raised edge.
  ctx.lineWidth = v.line;
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.powerDeep;
  roundRect(ctx, cx - s / 2, y + t * 0.06, s, s, s * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PAL.power;
  roundRect(ctx, cx - s / 2, y, s, s, s * 0.22);
  ctx.fill();
  ctx.stroke();
  // A highlight on the top left corner, like a shine.
  ctx.fillStyle = rgba(PAL.paper, 0.55);
  roundRect(ctx, cx - s / 2 + s * 0.12, y + s * 0.1, s * 0.3, s * 0.12, s * 0.06);
  ctx.fill();
  drawIcon(ctx, id, cx, my, s * 0.7, PAL.ink, v.line * 1.2);
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

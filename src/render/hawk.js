// The Deadline Hawk: an original bird with a clock on its chest. Its shadow
// grows on the ground as the stall timer runs out.

import { PAL, rgba } from './palette.js';

// k: 0 when the warning starts, 1 when the hawk strikes.
export function drawHawkShadow(ctx, cx, gy, v, k, time) {
  const t = v.tile;
  const span = t * (1.4 + 1.8 * k);
  const drift = Math.sin(time * 2.2) * t * 0.25 * (1 - k);
  ctx.save();
  ctx.translate(cx + drift, gy - v.rowH * 0.05);
  ctx.scale(1, 0.45);
  ctx.fillStyle = rgba(PAL.ink, 0.28 + 0.32 * k);
  wingShape(ctx, span, 0);
  ctx.fill();
  ctx.restore();
}

function wingShape(ctx, span, flap) {
  const s = span / 2;
  const f = flap * s * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.35);
  ctx.quadraticCurveTo(s * 0.5, -s * 0.5 - f, s, -s * 0.15 - f);
  ctx.lineTo(s * 0.78, s * 0.02);
  ctx.lineTo(s * 0.86, s * 0.12);
  ctx.lineTo(s * 0.55, s * 0.12);
  ctx.quadraticCurveTo(s * 0.25, s * 0.15, s * 0.16, s * 0.42);
  ctx.lineTo(0, s * 0.6);
  ctx.lineTo(-s * 0.16, s * 0.42);
  ctx.quadraticCurveTo(-s * 0.25, s * 0.15, -s * 0.55, s * 0.12);
  ctx.lineTo(-s * 0.86, s * 0.12);
  ctx.lineTo(-s * 0.78, s * 0.02);
  ctx.lineTo(-s, -s * 0.15 - f);
  ctx.quadraticCurveTo(-s * 0.5, -s * 0.5 - f, 0, -s * 0.35);
  ctx.closePath();
}

// The hawk itself, seen from the front and slightly above.
export function drawHawk(ctx, cx, cy, v, time) {
  const t = v.tile;
  const span = t * 2.1;
  const flap = Math.sin(time * 18);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = v.line;
  ctx.strokeStyle = PAL.ink;
  // Wings.
  ctx.fillStyle = PAL.inkSoft;
  wingShape(ctx, span, flap);
  ctx.fill();
  ctx.stroke();
  // Body.
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.ellipse(0, t * 0.05, t * 0.26, t * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // Clock face on the chest, hands near midnight.
  ctx.fillStyle = PAL.paper;
  ctx.beginPath();
  ctx.arc(0, t * 0.12, t * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = v.line * 1.3;
  ctx.beginPath();
  ctx.moveTo(0, t * 0.12);
  ctx.lineTo(0, t * 0.02);
  ctx.moveTo(0, t * 0.12);
  ctx.lineTo(-t * 0.06, t * 0.06);
  ctx.stroke();
  // Head, brow and beak.
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.arc(0, -t * 0.32, t * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.paperDeep;
  ctx.beginPath();
  ctx.moveTo(-t * 0.05, -t * 0.27);
  ctx.lineTo(t * 0.05, -t * 0.27);
  ctx.lineTo(0, -t * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.red;
  for (const ex of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(ex * t * 0.075, -t * 0.35, t * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = PAL.paper;
  ctx.lineWidth = v.line;
  ctx.beginPath();
  ctx.moveTo(-t * 0.13, -t * 0.43);
  ctx.lineTo(-t * 0.03, -t * 0.39);
  ctx.moveTo(t * 0.13, -t * 0.43);
  ctx.lineTo(t * 0.03, -t * 0.39);
  ctx.stroke();
  ctx.restore();
}

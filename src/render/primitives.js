// Shared drawing helpers for the blocky, tilted look. Every object is a top face
// plus a front face, outlined in ink.

import { PAL } from './palette.js';

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// A box standing on the ground. (x, groundY) is the front left corner on the ground.
// depth is how far back it goes on screen, height is how tall it stands.
export function block(ctx, x, groundY, w, depth, height, top, front, line, r = 0) {
  const lw = line || 1;
  ctx.lineWidth = lw;
  ctx.strokeStyle = PAL.ink;
  // Front face.
  ctx.fillStyle = front;
  roundRect(ctx, x, groundY - height - r, w, height + r, r);
  ctx.fill();
  ctx.stroke();
  // Top face.
  ctx.fillStyle = top;
  roundRect(ctx, x, groundY - height - depth, w, depth, r);
  ctx.fill();
  ctx.stroke();
}

export function shadow(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Fit text into a width by shrinking the font, down to a minimum size.
export function fitText(ctx, text, maxW, size, minSize, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > minSize && ctx.measureText(text).width > maxW) {
    s -= 0.5;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_MONO = '"Overpass Mono", ui-monospace, Menlo, Consolas, monospace';
export const FONT_DISPLAY = '"Overpass", system-ui, sans-serif';

// Draws the world: ground for every visible row, then raised objects far to near
// so nearer things overlap farther ones. The camera is a fixed tilt.

import { GRID } from '../config.js';
import { PAL } from './palette.js';
import { roundRect } from './primitives.js';
import { drawOtter } from './otter.js';
import { visualRow, logicalRow } from '../game/player.js';

export function createRenderer(stage, game, opts) {
  const v = { tile: 0, rowH: 0, ox: 0, line: 1, scale: 1, w: 0, h: 0 };

  function layout() {
    v.w = stage.w;
    v.h = stage.h;
    v.scale = stage.dpr;
    v.tile = stage.w / GRID.VIEW_COLS;
    v.rowH = v.tile * GRID.ROW_SCALE;
    v.ox = (stage.w - v.tile * GRID.COLS) / 2;
    v.line = Math.max(1, v.tile * 0.035);
    game.viewRows = Math.ceil(stage.h / v.rowH) + 1;
  }
  layout();

  const rowY = (r) => v.h - (r - game.camRow) * v.rowH;

  function drawFacade(row, y) {
    const t = v.tile;
    const top = y - v.rowH;
    const mw = v.ox;
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : v.ox + t * GRID.COLS;
      ctx().fillStyle = PAL.wall;
      ctx().fillRect(x, top, mw, v.rowH + 0.5);
      // One video-tile window per row. Every so often someone is recording.
      const h = hash(row * 2 + side);
      const ww = mw * 0.62;
      const wh = v.rowH * 0.6;
      const wx = x + (mw - ww) / 2;
      const wy = top + (v.rowH - wh) / 2;
      const c = ctx();
      c.fillStyle = PAL.screen;
      roundRect(c, wx, wy, ww, wh, t * 0.03);
      c.fill();
      if (h % 3 !== 0) {
        c.fillStyle = PAL.screenFace;
        c.beginPath();
        c.arc(wx + ww / 2, wy + wh * 0.42, ww * 0.16, 0, Math.PI * 2);
        c.fill();
        c.fillRect(wx + ww * 0.25, wy + wh * 0.66, ww * 0.5, wh * 0.34);
      }
      if (h % 7 === 0) {
        c.fillStyle = PAL.red;
        c.beginPath();
        c.arc(wx + ww * 0.8, wy + wh * 0.18, Math.max(1.2, ww * 0.08), 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  let _ctx = null;
  const ctx = () => _ctx;

  function draw(fps) {
    _ctx = stage.ctx;
    const c = _ctx;
    c.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    c.fillStyle = PAL.ink;
    c.fillRect(0, 0, v.w, v.h);

    if (game.shake > 0 && !opts.reducedMotion()) {
      const s = game.shake * v.tile * 0.25;
      c.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const first = Math.floor(game.camRow) - 1;
    const last = Math.ceil(game.camRow + game.viewRows) + 1;

    // Ground pass.
    for (let r = first; r <= last; r++) {
      const lane = game.getLane(r);
      const y = rowY(r);
      if (lane) lane.mod.drawGround(c, lane, v, y);
      drawFacade(r, y);
    }
    // Object pass, far to near. Clipped to the playfield so traffic slides out
    // from behind the office facades.
    const p = game.player;
    const pRow = p.dead ? p.row : Math.round(visualRow(p));
    c.save();
    c.beginPath();
    c.rect(v.ox, -v.h, v.tile * GRID.COLS, v.h * 3);
    c.clip();
    for (let r = last; r >= first; r--) {
      const lane = game.getLane(r);
      const y = rowY(r);
      if (lane) lane.mod.drawObjects(c, lane, v, y);
      if (r === pRow && game.state !== 'title') drawPlayer(c);
    }
    c.restore();

    // Facade edges.
    c.fillStyle = PAL.wallDark;
    c.fillRect(v.ox - v.line, 0, v.line, v.h);
    c.fillRect(v.ox + v.tile * GRID.COLS, 0, v.line, v.h);

    if (game.debug.hitboxes) drawHitboxes(c);
    if (opts.debug && fps != null) {
      c.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      c.fillStyle = PAL.ink;
      c.fillRect(4, v.h - 22, 70, 18);
      c.fillStyle = PAL.highlighter;
      c.font = '12px ui-monospace, monospace';
      c.textBaseline = 'middle';
      c.fillText(`${fps.toFixed(0)} fps`, 10, v.h - 13);
    }
  }

  function drawPlayer(c) {
    const p = game.player;
    const t = v.tile;
    const vr = visualRow(p);
    let cx = v.ox + (p.x + 0.5) * t;
    const gy = rowY(vr) - v.rowH * 0.32;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    let alpha = 1;
    if (p.hopT >= 0) {
      const k = Math.sin(Math.PI * p.hopT);
      lift = k * t * 0.32;
      sx = 1 - 0.1 * k;
      sy = 1 + 0.16 * k;
    } else if (p.land > 0) {
      sx = 1.12;
      sy = 0.86;
    }
    if (p.bump > 0 && p.bumpDir) {
      const k = Math.sin((p.bump / 0.12) * Math.PI);
      cx += p.bumpDir.dx * k * t * 0.08;
      lift += p.bumpDir.dy * k * t * 0.05;
    }
    if (p.dead) {
      if (p.deathCause === 'meeting') {
        sx = 1.3;
        sy = 0.35;
      } else if (p.deathCause === 'hawk') {
        lift = p.deathT * t * 6;
        alpha = Math.max(0, 1 - p.deathT / 0.6);
      }
    }
    if (p.invuln > 0 && Math.floor(p.invuln * 6) % 2 === 1) alpha *= 0.4;
    drawOtter(c, cx, gy, v, { facing: p.facing, lift, sx, sy, alpha });
  }

  function drawHitboxes(c) {
    c.lineWidth = 1.5;
    const p = game.player;
    const lr = logicalRow(p);
    const half = 0.3;
    c.strokeStyle = PAL.highlighter;
    c.strokeRect(v.ox + (p.x + 0.5 - half) * v.tile, rowY(lr) - v.rowH, half * 2 * v.tile, v.rowH);
    c.strokeStyle = PAL.red;
    const first = Math.floor(game.camRow) - 1;
    const last = Math.ceil(game.camRow + game.viewRows) + 1;
    for (let r = first; r <= last; r++) {
      const lane = game.getLane(r);
      if (!lane || !lane.mod.hitboxes) continue;
      for (const [a, b] of lane.mod.hitboxes(lane)) {
        c.strokeRect(v.ox + a * v.tile, rowY(r) - v.rowH + 2, (b - a) * v.tile, v.rowH - 4);
      }
    }
  }

  return { draw, layout, view: v };
}

function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

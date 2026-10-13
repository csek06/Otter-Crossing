// Draws the world: ground for every visible row, then raised objects far to near
// so nearer things overlap farther ones. The camera is a fixed tilt.

import { GRID, RULES } from '../config.js';
import { PAL } from './palette.js';
import { roundRect } from './primitives.js';
import { drawOtter } from './otter.js';
import { drawToken } from './token.js';
import { drawHawk, drawHawkShadow } from './hawk.js';
import { drawPickup, drawIcon } from './pickup.js';
import { rgba } from './palette.js';
import { visualRow, logicalRow } from '../game/player.js';
import { tileSize } from '../core/stage.js';
import { drawTreeline } from './habitat.js';

export function createRenderer(stage, game, opts) {
  const v = { tile: 0, rowH: 0, ox: 0, line: 1, scale: 1, w: 0, h: 0, time: 0 };

  function layout() {
    v.w = stage.w;
    v.h = stage.h;
    v.scale = stage.dpr;
    v.tile = tileSize(stage.w, stage.h);
    v.rowH = v.tile * GRID.ROW_SCALE;
    v.ox = (stage.w - v.tile * GRID.COLS) / 2;
    v.line = Math.max(1, v.tile * 0.035);
    // The world is only drawn on the 9 playable columns plus a half-tile margin
    // each side (office facades, or forest in the habitat). Wide screens use the
    // rest of the window for the power-up panels (screens.js), not the world.
    v.margin = Math.min(v.ox, v.tile / 2);
    v.c0 = 0; // first and last columns with ground detail
    v.c1 = GRID.COLS - 1;
    v.gx0 = v.ox - 1; // where lane ground is drawn
    v.gx1 = v.ox + v.tile * GRID.COLS + 1;
    game.viewRows = Math.ceil(stage.h / v.rowH) + 1;
  }
  layout();

  const rowY = (r) => v.h - (r - game.camRow) * v.rowH;

  function drawFacade(row, y) {
    const t = v.tile;
    if (v.habitat) {
      for (const side of [0, 1]) drawTreeline(ctx(), row, side, side === 0 ? v.ox - v.margin : v.ox + t * GRID.COLS, y - v.rowH, v.margin, v);
      return;
    }
    const top = y - v.rowH;
    const mw = v.margin;
    for (const side of [0, 1]) {
      const x = side === 0 ? v.ox - mw : v.ox + t * GRID.COLS;
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
    v.time = performance.now() / 1000;
    v.theme = game.theme || 'office';
    v.habitat = v.theme === 'habitat';
    v.still = opts.reducedMotion();
    c.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    c.fillStyle = v.habitat ? PAL.forest : PAL.ink;
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
      if (lane && lane.mod.drawSignals) lane.mod.drawSignals(c, lane, v, y);
    }
    const showMarkers = game.markers && game.markers.length && game.state !== 'title' && game.state !== 'demo';
    if (showMarkers) drawMarkerLines(c, first, last);
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
      if (lane) {
        for (const tok of lane.tokens) {
          if (!tok.taken) drawToken(c, v.ox + (tok.col + 0.5) * v.tile, y - v.rowH * 0.3, v, v.time);
        }
        if (lane.powerup && !lane.powerup.taken && !lane.powerup.plat) {
          drawPickup(c, v.ox + (lane.powerup.col + 0.5) * v.tile, y - v.rowH * 0.3, v, lane.powerup.id, v.time);
        }
        lane.mod.drawObjects(c, lane, v, y);
      }
      if (r === pRow && game.state !== 'title') drawPlayer(c);
    }
    drawLiveAssist(c);
    drawFx(c);
    if (game.state === 'playing' && game.hawk.warn > 0) {
      drawHawkShadow(c, v.ox + (p.x + 0.5) * v.tile, rowY(visualRow(p)) - v.rowH * 0.32, v, game.hawk.warn, v.time);
    }
    c.restore();
    if (game.hawk.swoopT >= 0 && game.state !== 'title') drawSwoop(c);
    if (showMarkers) drawMarkerLabels(c, first, last);
    drawAlarm(c);

    // Facade edges.
    c.fillStyle = v.habitat ? PAL.forestDeep : PAL.wallDark;
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

  // The hawk alarm lights the whole screen red: a steady glow that grows as the
  // strike nears, plus a short pulse on each beep (at most 3 a second). With
  // reduced motion only the steady glow shows.
  function drawAlarm(c) {
    const k = game.hawk.alarm;
    if (!(k > 0) || game.state !== 'playing') return;
    const flash = v.still ? 0 : Math.exp(-game.hawk.pulse * 7) * (0.12 + 0.16 * k);
    const a = 0.1 + 0.22 * k + flash;
    const cx = v.w / 2;
    const cy = v.h / 2;
    const g = c.createRadialGradient(cx, cy, Math.min(v.w, v.h) * 0.2, cx, cy, Math.hypot(cx, cy));
    g.addColorStop(0, rgba(PAL.red, a * 0.25));
    g.addColorStop(1, rgba(PAL.red, Math.min(0.7, a * 1.6)));
    c.fillStyle = g;
    c.fillRect(-v.tile, -v.tile, v.w + v.tile * 2, v.h + v.tile * 2); // covers screen shake too
  }

  // Where the hawk carries the otter during its swoop: [hawk y, otter lift].
  function swoop(gy) {
    const t = v.tile;
    const k = game.hawk.swoopT;
    const dive = 0.35;
    if (k < dive) {
      const e = k / dive;
      return { hawkY: lerp(-t * 2, gy - t * 0.9, e * e), lift: 0 };
    }
    const up = (k - dive) * t * 9;
    return { hawkY: gy - t * 0.9 - up, lift: up };
  }

  function drawSwoop(c) {
    const p = game.player;
    const gy = rowY(visualRow(p)) - v.rowH * 0.32;
    const s = swoop(gy);
    drawHawk(c, v.ox + (p.x + 0.5) * v.tile, s.hawkY, v, v.time);
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
    let sink = 0;
    const swimming = p.swim >= 0 && p.hopT < 0;
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
    if (swimming) sink = t * 0.2 + Math.sin(v.time * 8) * t * 0.02;
    if (p.dead) {
      if (p.deathCause === 'meeting' || p.deathCause === 'allhands') {
        sx = 1.3;
        sy = 0.35;
      } else if (p.deathCause === 'hawk') {
        lift = swoop(gy).lift;
      } else if (p.deathCause === 'river') {
        sink = t * 0.2 + p.deathT * t * 0.6;
        alpha = Math.max(0, 1 - p.deathT / 0.8);
      }
    }
    if (p.invuln > 0 && Math.floor(p.invuln * 6) % 2 === 1) alpha *= 0.4;
    if (sink > 0) {
      // In the water: only the top of the otter shows above the waterline.
      c.save();
      c.beginPath();
      c.rect(0, 0, v.w, gy);
      c.clip();
      drawOtter(c, cx, gy + sink, v, { facing: p.facing, lift, sx, sy, alpha, outfit: game.outfit });
      c.restore();
      c.strokeStyle = PAL.ripple;
      c.lineWidth = v.line;
      const rr = (v.time * 1.5) % 1;
      c.globalAlpha = 1 - rr;
      c.beginPath();
      c.ellipse(cx, gy, t * (0.3 + rr * 0.25), v.rowH * (0.1 + rr * 0.08), 0, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      if (swimming && !p.dead) drawSwimTimer(c, cx, gy - t * 0.78, 1 - p.swim / RULES.SWIM_TIME);
    } else {
      drawOtter(c, cx, gy, v, { facing: p.facing, lift, sx, sy, alpha, outfit: game.outfit });
    }
    if (!p.dead) drawShield(c, cx, gy - lift);
  }

  // Leaderboard names across the lanes (src/game/markers.js). The line is the
  // far edge of the lane that score reached: cross it and you've beaten them.
  const MARK = { you: PAL.highlighter, top: PAL.brand, near: PAL.paper };
  function markerY(m) {
    return rowY(game.startRow + m.score) - v.rowH;
  }
  function eachMarker(first, last, fn) {
    for (const m of game.markers) {
      const r = game.startRow + m.score;
      if (r >= first && r <= last + 1) fn(m, markerY(m), game.score > m.score);
    }
  }
  function drawMarkerLines(c, first, last) {
    const t = v.tile;
    c.lineWidth = Math.max(2, v.line * 2);
    c.setLineDash([t * 0.22, t * 0.14]);
    eachMarker(first, last, (m, y, passed) => {
      c.globalAlpha = passed ? 0.35 : 0.9;
      c.strokeStyle = PAL.ink;
      c.lineWidth = Math.max(3, v.line * 3.2);
      c.beginPath();
      c.moveTo(v.ox, y);
      c.lineTo(v.ox + t * GRID.COLS, y);
      c.stroke();
      c.strokeStyle = MARK[m.kind];
      c.lineWidth = Math.max(2, v.line * 2);
      c.stroke();
    });
    c.setLineDash([]);
    c.globalAlpha = 1;
  }
  function drawMarkerLabels(c, first, last) {
    const t = v.tile;
    const size = Math.max(11, Math.round(t * 0.24));
    c.font = `700 ${size}px "Overpass Mono", ui-monospace, Menlo, monospace`;
    c.textBaseline = 'middle';
    const padX = size * 0.5;
    const h = size * 1.5;
    const maxW = t * GRID.COLS - t * 0.24;
    eachMarker(first, last, (m, y, passed) => {
      let text = m.label;
      while (text.length > 4 && c.measureText(text).width + padX * 2 > maxW) text = text.slice(0, -2) + '…';
      const w = c.measureText(text).width + padX * 2;
      const x = v.ox + t * 0.12;
      const top = y - h / 2;
      c.globalAlpha = passed ? 0.5 : 1;
      c.fillStyle = MARK[m.kind];
      roundRect(c, x, top, w, h, h / 2);
      c.fill();
      c.strokeStyle = PAL.ink;
      c.lineWidth = Math.max(1.5, v.line * 1.5);
      c.stroke();
      c.fillStyle = m.kind === 'top' ? PAL.paper : PAL.ink;
      c.fillText(text, x + padX, y + size * 0.06);
    });
    c.globalAlpha = 1;
  }

  // Live Assist: glowing outlines on the safe tiles ahead.
  function drawLiveAssist(c) {
    const e = game.active.find((a) => a.mod.id === 'liveAssist');
    if (!e || !e.tiles || game.state !== 'playing') return;
    const t = v.tile;
    const fade = Math.min(1, e.t / 0.5);
    c.lineWidth = v.line * 2;
    for (let i = 0; i < e.tiles.length; i += 2) {
      const r = e.tiles[i];
      const col = e.tiles[i + 1];
      const x = v.ox + col * t;
      const y = rowY(r) - v.rowH;
      c.fillStyle = rgba(PAL.power, 0.22 * fade);
      roundRect(c, x + t * 0.1, y + v.rowH * 0.12, t * 0.8, v.rowH * 0.76, t * 0.12);
      c.fill();
      c.strokeStyle = rgba(PAL.powerDeep, 0.95 * fade);
      c.setLineDash([t * 0.12, t * 0.08]);
      c.stroke();
      c.setLineDash([]);
    }
  }

  // Otter Notetaker's shield: a ring around the otter with a notepad riding on it.
  function drawShield(c, cx, gy) {
    const e = game.active.find((a) => a.mod.id === 'notetaker');
    if (!e) return;
    // Flicker gently (2 times a second) in the last 2 seconds.
    if (e.t < 2 && Math.floor(e.t * 4) % 2 === 0) return;
    const t = v.tile;
    const cy = gy - t * 0.38;
    c.lineWidth = v.line * 1.6;
    c.strokeStyle = PAL.power;
    c.fillStyle = rgba(PAL.power, 0.16);
    c.beginPath();
    c.ellipse(cx, cy, t * 0.52, t * 0.56, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const a = v.time * 2.4;
    const ix = cx + Math.cos(a) * t * 0.52;
    const iy = cy + Math.sin(a) * t * 0.56;
    c.fillStyle = PAL.power;
    c.beginPath();
    c.arc(ix, iy, t * 0.15, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = PAL.ink;
    c.lineWidth = v.line;
    c.stroke();
    drawIcon(c, 'notetaker', ix, iy, t * 0.2, PAL.ink, v.line);
  }

  // How long the otter can keep swimming, as a shrinking ring.
  function drawSwimTimer(c, x, y, k) {
    const r = v.tile * 0.18;
    c.lineWidth = v.line * 2.4;
    c.strokeStyle = PAL.ink;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = PAL.paper;
    c.beginPath();
    c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, k));
    c.stroke();
  }

  function drawFx(c) {
    const t = v.tile;
    for (const f of game.fx.live) {
      const x = v.ox + f.x * t;
      const gy = rowY(f.row) - v.rowH * 0.32;
      const k = f.life / f.max;
      if (f.kind === 'drop') {
        c.fillStyle = PAL.paper;
        c.beginPath();
        c.arc(x, gy - f.h * t * 0.5, t * 0.05, 0, Math.PI * 2);
        c.fill();
      } else if (f.kind === 'ring') {
        c.strokeStyle = PAL.ripple;
        c.lineWidth = v.line * 1.5;
        c.beginPath();
        c.ellipse(x, gy, t * (0.2 + (1 - k) * 0.5), v.rowH * (0.08 + (1 - k) * 0.15), 0, 0, Math.PI * 2);
        c.stroke();
      } else if (f.kind === 'check') {
        drawToken(c, x, gy - f.h * t * 0.4, v, 0, true, Math.min(1, k * 2));
      } else if (f.kind === 'pull') {
        drawToken(c, x, gy - f.h * t, v, 0, k < 0.5, 1);
      }
    }
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

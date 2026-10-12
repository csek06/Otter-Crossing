// The otter. Grid-based hops with a quick squash and stretch.

import { GRID, TUNING } from '../config.js';

export function createPlayer() {
  return {
    x: GRID.START_COL,     // column, float so it can ride things later
    row: 0,
    fromX: 0, fromRow: 0,
    toX: 0, toRow: 0,
    hopT: -1,              // 0 to 1 while hopping, -1 when idle
    facing: 'up',
    land: 0,               // landing squash timer
    bump: 0,               // blocked-move wobble timer
    bumpDir: 0,
    dead: false,
    deathT: 0,
    deathCause: null,
    deathCar: null,
    deathLane: null,
    invuln: 0,
    swim: -1,              // seconds in the water, -1 when not swimming
    riding: null,          // the highlight the otter is standing on
  };
}

export function resetPlayer(p, row) {
  p.x = GRID.START_COL;
  p.row = row;
  p.fromX = p.toX = p.x;
  p.fromRow = p.toRow = row;
  p.hopT = -1;
  p.facing = 'up';
  p.land = 0;
  p.bump = 0;
  p.dead = false;
  p.deathT = 0;
  p.deathCause = null;
  p.deathCar = null;
  p.deathLane = null;
  p.invuln = 0;
  p.swim = -1;
  p.riding = null;
}

export function isHopping(p) {
  return p.hopT >= 0;
}

// The row used for collisions. The otter switches rows halfway through a hop.
export function logicalRow(p) {
  if (p.hopT < 0) return p.row;
  return p.hopT >= 0.5 ? p.toRow : p.fromRow;
}

// Try to start a hop. getLane(row) returns the lane for a row.
// Returns 'hop', 'blocked' or 'busy'.
export function tryHop(p, dir, getLane) {
  if (p.hopT >= 0 || p.dead) return 'busy';
  p.facing = dir.name;
  const tx = Math.min(GRID.COLS - 1, Math.max(0, Math.round(p.x) + dir.dx));
  const tr = p.row + dir.dy;
  const lane = getLane(tr);
  const sideways = dir.dx !== 0;
  if ((sideways && tx === Math.round(p.x)) || !lane || lane.mod.blocks(lane, tx)) {
    p.bump = 0.12;
    p.bumpDir = dir;
    return 'blocked';
  }
  p.fromX = p.x;
  p.fromRow = p.row;
  p.toX = tx;
  p.toRow = tr;
  p.hopT = 0;
  return 'hop';
}

export function updatePlayer(p, dt) {
  if (p.land > 0) p.land = Math.max(0, p.land - dt);
  if (p.bump > 0) p.bump = Math.max(0, p.bump - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.hopT < 0) return false;
  p.hopT += dt / TUNING.HOP_TIME;
  if (p.hopT >= 1) {
    p.hopT = -1;
    p.x = p.toX;
    p.row = p.toRow;
    p.land = 0.08;
    return true; // landed
  }
  const t = p.hopT;
  p.x = p.fromX + (p.toX - p.fromX) * t;
  return false;
}

// Visual row as a float, for drawing and the camera.
export function visualRow(p) {
  if (p.hopT < 0) return p.row;
  return p.fromRow + (p.toRow - p.fromRow) * p.hopT;
}

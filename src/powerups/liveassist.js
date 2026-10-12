// Live Assist (behind FLAGS.SHOW_UNRELEASED): lights a safe path through the next
// few lanes for 4 seconds, like a tip on what to do next. Live for Enterprise
// since July 2026; the flag stays off until positioning is final.

import { GRID } from '../config.js';

const AHEAD = 4;

export default {
  id: 'liveAssist',
  featureId: 'liveAssist',
  unreleased: true,
  duration: 4,
  weight: 0.7,

  apply(game) {
    game.addActive(this);
  },

  // Tiles that are safe right now and connect to the otter's column, row by row.
  update(game, dt, entry) {
    const p = game.player;
    const tiles = entry.tiles || (entry.tiles = []);
    tiles.length = 0;
    let reach = new Set([Math.round(p.x)]);
    for (let r = p.row + 1; r <= p.row + AHEAD; r++) {
      const lane = game.getLane(r);
      if (!lane || !lane.mod.safeAt) break;
      const next = new Set();
      for (let c = 0; c < GRID.COLS; c++) {
        const near = reach.has(c) || reach.has(c - 1) || reach.has(c + 1);
        if (near && lane.mod.safeAt(lane, c)) next.add(c);
      }
      if (!next.size) break;
      for (const c of next) tiles.push(r, c);
      reach = next;
    }
  },
};

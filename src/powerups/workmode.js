// Work Mode (Work run): a task that runs while you keep playing. Each new lane
// crossed is one step. After STEPS lanes the run finishes and hands back its
// artifact, a follow-up doc: every action item token on the next few lanes is
// pulled in, plus a bonus for the doc itself. Die first and the game over
// screen says how close the run was.

import { GRID } from '../config.js';

export const STEPS = 8;      // lanes to finish a run
export const SWEEP_ROWS = 6; // lanes ahead the follow-up doc sweeps for tokens
export const DOC_BONUS = 3;  // action items the finished doc is worth on its own

export default {
  id: 'workMode',
  featureId: 'workMode',
  unreleased: false,
  duration: STEPS, // counted in lanes, not seconds; update() keeps entry.t in lanes
  weight: 0.9,

  apply(game) {
    game.removeActive(this.id);
    game.addActive(this);
    const e = game.active[game.active.length - 1];
    e.from = game.maxRow;
    e.left = STEPS;
  },

  update(game, dt, e) {
    const left = STEPS - (game.maxRow - e.from);
    e.left = Math.max(0, left);
    // updatePowerups subtracts dt after this, so add it back to count lanes only.
    e.t = Math.max(0, left) + dt;
    if (left > 0) return;
    e.t = 0;
    let n = DOC_BONUS;
    const p = game.player;
    for (let r = p.row; r <= p.row + SWEEP_ROWS; r++) {
      const lane = game.getLane(r);
      if (!lane) continue;
      for (const tok of lane.tokens) {
        if (tok.taken) continue;
        tok.taken = true;
        game.takeToken(tok.col + 0.5, r, true);
        n++;
      }
      if (lane.type === 'river') {
        for (const plat of lane.platforms) {
          if (!plat.token || plat.taken) continue;
          plat.taken = true;
          const x = lane.mod.left(lane, plat) + plat.len / 2;
          game.takeToken(Math.min(GRID.COLS - 0.5, Math.max(0.5, x)), r, true);
          n++;
        }
      }
    }
    for (let i = 0; i < DOC_BONUS; i++) game.takeToken(p.x + 0.5, p.row);
    game.message('workModeDone', { n });
  },
};

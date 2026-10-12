// The title screen's attract loop player. Looks one row ahead and picks a move
// that is safe right now. It is meant to look like someone playing, not to play
// well, so it thinks a few times a second and sometimes waits. After a set number
// of lanes it stops being careful and loses, so the loop shows a whole run.

import { GRID } from '../config.js';
import { DIR } from '../core/input.js';

const THINK = 0.2; // seconds between moves
const GIVE_UP_MIN = 12; // lanes before the demo throws the run
const GIVE_UP_MAX = 28;

function cellOk(lane, col) {
  if (!lane || col < 0 || col >= GRID.COLS) return false;
  if (lane.mod.blocks(lane, col)) return false;
  return lane.mod.safeAt(lane, col);
}

export function createAutopilot() {
  let wait = 0;
  let giveUpAt = GIVE_UP_MAX;
  const ap = {
    reset() {
      wait = 0.6;
      giveUpAt = GIVE_UP_MIN + Math.floor(Math.random() * (GIVE_UP_MAX - GIVE_UP_MIN + 1));
    },
    giveUpAt: () => giveUpAt,
    setGiveUp: (n) => { giveUpAt = n; },
    // Returns a DIR, or null to stay put this frame.
    next(game, dt) {
      wait -= dt;
      if (wait > 0) return null;
      wait = THINK;
      const p = game.player;
      const col = Math.round(p.x);
      const here = game.getLane(p.row);
      const ahead = game.getLane(p.row + 1);
      // Done playing nicely: charge forward into whatever comes next.
      if (game.score >= giveUpAt) {
        if (ahead && !ahead.mod.blocks(ahead, col)) return DIR.up;
        return col < GRID.COLS - 1 ? DIR.right : DIR.left;
      }
      // Riding a log near the edge: hop off sideways or forward before it carries us out.
      const edge = here && here.mod.carry && (p.x < 0.6 || p.x > GRID.COLS - 1.6);
      if (cellOk(ahead, col)) return DIR.up;
      const hereOk = here && (here.mod.carry ? !edge && here.mod.safeAt(here, p.x) : here.mod.safeAt(here, col));
      // Step toward a column that is open ahead, favoring the middle of the lane.
      const order = col < GRID.COLS / 2 ? [1, -1] : [-1, 1];
      for (const dx of order) {
        if (cellOk(ahead, col + dx) && cellOk(here, col + dx)) return dx > 0 ? DIR.right : DIR.left;
      }
      if (hereOk && game.stall < 4) return null;
      for (const dx of order) if (cellOk(here, col + dx)) return dx > 0 ? DIR.right : DIR.left;
      if (cellOk(game.getLane(p.row - 1), col)) return DIR.down;
      return null;
    },
  };
  return ap;
}

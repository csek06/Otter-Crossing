// Action items (magnet): pulls nearby action item tokens in for 6 seconds.

const RANGE_COLS = 3;
const RANGE_ROWS = 3;

export default {
  id: 'actionItems',
  featureId: 'actionItems',
  unreleased: false,
  duration: 6,
  weight: 1,

  apply(game) {
    game.addActive(this);
  },

  update(game) {
    const p = game.player;
    for (let r = p.row - 1; r <= p.row + RANGE_ROWS; r++) {
      const lane = game.getLane(r);
      if (!lane) continue;
      for (const tok of lane.tokens) {
        if (!tok.taken && Math.abs(tok.col - p.x) <= RANGE_COLS) {
          tok.taken = true;
          game.takeToken(tok.col + 0.5, r, true);
        }
      }
      if (lane.type === 'river') {
        for (const plat of lane.platforms) {
          if (!plat.token || plat.taken) continue;
          const x = lane.mod.left(lane, plat) + plat.len / 2;
          if (x > -0.5 && x < 9.5 && Math.abs(x - 0.5 - p.x) <= RANGE_COLS) {
            plat.taken = true;
            game.takeToken(x, r, true);
          }
        }
      }
    }
  },
};

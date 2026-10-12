// Names across the lanes, like Crossy Road: a line on the lane where someone's
// score ended, so you can see who you're about to pass. It shows your own best
// (even offline), the top 10, and the players just ahead of the score you're
// chasing. As you pass those, the next ones ahead are fetched.
//
// game.markers is what the renderer draws: [{ score, label, kind }], where kind
// is 'you', 'top' (rank 1 to 10) or 'near'. A marker sits on the lane you reach
// with that score; crossing its line means you beat it.

import { dailyBest } from './daily.js';

const REFETCH_GAP = 4000; // ms between lookups while a run climbs

export function createMarkers({ online, youLabel, now = () => Date.now() }) {
  let rows = new Map(); // rank -> { rank, initials, score }
  let you = 0;
  let board = 'global';
  let key = null;
  let token = 0;
  let lastFetch = -Infinity;
  let pending = false;

  function rebuild(game) {
    const byScore = new Map();
    const add = (score, part, kind, rank) => {
      if (!(score > 0)) return;
      const m = byScore.get(score) || { score, parts: [], kind, rank };
      m.parts.push(part);
      // Your best wins the style, then the better rank.
      if (kind === 'you' || (m.kind !== 'you' && rank < m.rank)) { m.kind = kind; m.rank = rank; }
      byScore.set(score, m);
    };
    if (you > 0) add(you, youLabel, 'you', 0);
    for (const r of [...rows.values()].sort((a, b) => a.rank - b.rank)) {
      add(r.score, `#${r.rank} ${r.initials}`, r.rank <= 10 ? 'top' : 'near', r.rank);
    }
    game.markers = [...byScore.values()]
      .sort((a, b) => a.score - b.score)
      .map((m) => ({
        score: m.score,
        kind: m.kind,
        // Two names fit; more get a count.
        label: m.parts.length > 2 ? `${m.parts.slice(0, 2).join(', ')} +${m.parts.length - 2}` : m.parts.join(', '),
      }));
  }

  function fetch(game, around) {
    if (!online || !online.enabled) return;
    const t = ++token;
    pending = true;
    lastFetch = now();
    online.markers(board, key, around).then((list) => {
      if (t !== token) return; // a newer run or lookup took over
      pending = false;
      for (const r of list) {
        if (r && r.rank > 0 && r.score > 0 && typeof r.initials === 'string') rows.set(r.rank, { rank: r.rank, initials: r.initials, score: r.score });
      }
      rebuild(game);
    });
  }

  return {
    // At the start of a run.
    reset(game) {
      token++;
      pending = false;
      rows = new Map();
      lastFetch = -Infinity;
      board = game.mode === 'daily' ? 'daily' : 'global';
      key = game.mode === 'daily' ? game.dailyKey : null;
      you = game.mode === 'daily' ? dailyBest(game.dailyKey).best : game.best;
      rebuild(game);
      fetch(game, you);
    },
    // On every new lane. Once you're past everyone ahead that we know about
    // (outside the top 10), look up the next few.
    score(game) {
      if (!online || !online.enabled || pending || !rows.size || now() - lastFetch < REFETCH_GAP) return;
      let ahead = false;
      let topFloor = Infinity;
      for (const r of rows.values()) {
        if (r.rank <= 10) topFloor = Math.min(topFloor, r.score);
        else if (r.score > game.score) ahead = true;
      }
      if (!ahead && game.score > you && game.score < topFloor) fetch(game, game.score);
    },
  };
}

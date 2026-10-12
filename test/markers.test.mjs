// Lane markers: which names go on which lanes, and when the next ones load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkers } from '../src/game/markers.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeOnline(pages) {
  const calls = [];
  return {
    calls,
    enabled: true,
    markers(board, key, around) {
      calls.push({ board, key, around });
      return Promise.resolve(pages.shift() || []);
    },
  };
}

test('markers: your best shows even offline, on its own lane', () => {
  const game = { mode: 'free', best: 12 };
  createMarkers({ online: { enabled: false }, youLabel: 'Your best' }).reset(game);
  assert.deepEqual(game.markers, [{ score: 12, kind: 'you', label: 'Your best' }]);
  const fresh = { mode: 'free', best: 0 };
  createMarkers({ online: null, youLabel: 'Your best' }).reset(fresh);
  assert.deepEqual(fresh.markers, [], 'no best yet, no marker');
});

test('markers: top 10 and nearby names, merged by lane', async () => {
  const online = fakeOnline([[
    { rank: 1, initials: 'ACE', score: 300 },
    { rank: 2, initials: 'BOB', score: 300 },
    { rank: 3, initials: 'CAT', score: 300 },
    { rank: 14, initials: 'DEE', score: 20 },
    { rank: 15, initials: 'EVE', score: 12 },
  ]]);
  const game = { mode: 'free', best: 12 };
  const m = createMarkers({ online, youLabel: 'Your best' });
  m.reset(game);
  assert.deepEqual(online.calls[0], { board: 'global', key: null, around: 12 }, 'looks up around your best');
  await tick();
  assert.deepEqual(game.markers, [
    { score: 12, kind: 'you', label: 'Your best, #15 EVE' },
    { score: 20, kind: 'near', label: '#14 DEE' },
    { score: 300, kind: 'top', label: '#1 ACE, #2 BOB +1' },
  ]);
});

test('markers: past everyone ahead, it fetches the next ones (not too often)', async () => {
  let clock = 0;
  const online = fakeOnline([[{ rank: 1, initials: 'ACE', score: 300 }, { rank: 40, initials: 'DEE', score: 20 }], [{ rank: 39, initials: 'FOX', score: 25 }]]);
  const game = { mode: 'free', best: 5, score: 0 };
  const m = createMarkers({ online, youLabel: 'Your best', now: () => clock });
  m.reset(game);
  await tick();
  clock = 10000;
  game.score = 15;
  m.score(game);
  assert.equal(online.calls.length, 1, 'DEE is still ahead');
  game.score = 21;
  m.score(game);
  assert.equal(online.calls.length, 2, 'passed DEE: look further ahead');
  assert.equal(online.calls[1].around, 21);
  await tick();
  assert.ok(game.markers.some((x) => x.label === '#39 FOX'));
  game.score = 26;
  m.score(game);
  assert.equal(online.calls.length, 2, 'waits a few seconds between lookups');
  clock = 20000;
  m.score(game);
  assert.equal(online.calls.length, 3);
});

test('markers: daily runs use the daily board, and a new run drops stale answers', async () => {
  const online = fakeOnline([[{ rank: 1, initials: 'OLD', score: 50 }], [{ rank: 1, initials: 'NEW', score: 60 }]]);
  const m = createMarkers({ online, youLabel: 'Your best' });
  const game = { mode: 'daily', dailyKey: '2026-10-12', best: 99 };
  m.reset(game);
  m.reset(game);
  await tick();
  assert.deepEqual(online.calls[0], { board: 'daily', key: '2026-10-12', around: 0 }, 'daily best, not the free-play best');
  assert.deepEqual(game.markers.map((x) => x.label), ['#1 NEW']);
});

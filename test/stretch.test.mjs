// Rules for the daily challenge, outfits, booth sign-ups and music.
//   npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONTENT } from '../src/content.js';
import { createGenerator, newLane } from '../src/game/generator.js';
import { dateKey, dailySeed, shareText } from '../src/game/daily.js';
import { OUTFITS, createWardrobe } from '../src/game/wardrobe.js';
import { validEmail, toCsv } from '../src/game/booth.js';
import { stepEvents, bpmFor, intensityFor, LAYERS, MUSIC_FULL_AT } from '../src/core/music.js';

function memoryStore(init = {}) {
  const data = { ...init };
  return {
    data,
    load: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f),
    save: (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); },
  };
}

test('daily: dates map to stable, distinct seeds', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dailySeed('2026-10-12'), dailySeed('2026-10-12'));
  const seen = new Set();
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 366 * 3; i++) {
    seen.add(dailySeed(dateKey(d)));
    d.setDate(d.getDate() + 1);
  }
  assert.equal(seen.size, 366 * 3, 'every day of three years has its own seed');
});

test('daily: the same date always builds the same course', () => {
  const seed = dailySeed('2026-10-12');
  const course = () => {
    const g = createGenerator({ seed, startRow: 0 });
    const out = [];
    for (let r = -9; r < 400; r++) {
      const l = g.fill(newLane(), r);
      out.push([l.type, l.blocked, l.dir, +(l.speed || 0).toFixed(6), l.powerup && l.powerup.id, (l.tokens || []).length].join(':'));
    }
    return out.join('|');
  };
  assert.equal(course(), course());
  const other = createGenerator({ seed: dailySeed('2026-10-13'), startRow: 0 });
  const g = createGenerator({ seed, startRow: 0 });
  let diff = 0;
  for (let r = 0; r < 100; r++) if (g.fill(newLane(), r).type !== other.fill(newLane(), r).type) diff++;
  assert.ok(diff > 10, 'the next day is a different course');
});

test('daily: share text fills every slot and has no leftover braces', () => {
  const s = shareText(CONTENT.daily.share, '2026-10-12', 57, 12);
  assert.ok(s.includes('2026-10-12') && s.includes('57') && s.includes('12'));
  assert.ok(!/[{}]/.test(s));
});

test('outfits: costs, buying, wearing and persistence', () => {
  assert.equal(OUTFITS[0].id, 'classic');
  assert.equal(OUTFITS[0].cost, 0);
  for (const o of OUTFITS) assert.ok(CONTENT.outfits.items[o.id], `copy for ${o.id}`);
  for (const role of ['sales', 'cs', 'recruiting', 'education']) assert.ok(OUTFITS.some((o) => o.id === role), role);
  for (let i = 1; i < OUTFITS.length; i++) assert.ok(OUTFITS[i].cost > OUTFITS[i - 1].cost, 'costs go up');

  const store = memoryStore();
  const w = createWardrobe(store);
  assert.equal(w.wallet(), 0);
  assert.equal(w.wearing(), 'classic');
  assert.equal(w.buy('sales'), false, 'cannot buy without items');
  assert.equal(w.wear('sales'), false, 'cannot wear what you do not own');
  w.earn(20);
  assert.equal(w.buy('sales'), true);
  assert.equal(w.wallet(), 5);
  assert.equal(w.wearing(), 'sales');
  assert.equal(w.buy('sales'), false, 'cannot buy twice');
  assert.equal(w.wallet(), 5);
  w.earn(-10);
  assert.equal(w.wallet(), 5, 'negative earnings are ignored');

  const again = createWardrobe(store);
  assert.equal(again.wallet(), 5);
  assert.equal(again.wearing(), 'sales');
  assert.ok(again.owns('sales') && again.owns('classic'));
  again.wear('classic');
  again.reset();
  assert.equal(createWardrobe(store).wallet(), 0);
  assert.equal(createWardrobe(store).owns('sales'), false);
});

test('outfits: bad saved data falls back safely', () => {
  const w = createWardrobe(memoryStore({ wallet: -4, outfits: ['nope', 'cs'], outfit: 'nope' }));
  assert.equal(w.wallet(), 0);
  assert.equal(w.wearing(), 'classic');
  assert.ok(w.owns('cs'));
  assert.ok(!w.owns('nope'));
});

test('booth: email check and CSV export', () => {
  assert.ok(validEmail('pat.lee@example.com'));
  assert.ok(validEmail('  sam@example.org '));
  for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '@c.com']) assert.ok(!validEmail(bad), bad);
  const csv = toCsv([
    { email: 'pat.lee@example.com', consent: 'Yes, "email" me, please', score: 12, items: 3, time: '2026-10-12T10:00:00.000Z' },
    { email: '=HYPERLINK("x")@example.com', consent: '+1', score: 1, items: 0, time: 't' },
  ]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"email","consent_text","score","action_items","time"');
  assert.ok(lines[1].includes('"Yes, ""email"" me, please"'), 'quotes are doubled');
  assert.ok(lines[2].startsWith(`"'=HYPERLINK`), 'formulas are neutralized');
  assert.ok(lines[2].includes(`"'+1"`));
});

test('booth: the consent box copy and privacy link exist', () => {
  assert.ok(CONTENT.booth.consent.length > 10);
  assert.match(CONTENT.booth.privacyUrl, /^https:\/\/otter\.ai\//);
});

test('music: intensity only ever adds layers, and speeds up', () => {
  assert.equal(intensityFor(0), 0);
  assert.equal(intensityFor(MUSIC_FULL_AT * 3), 1);
  assert.ok(bpmFor(1) > bpmFor(0));
  const ks = [0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.8, 1];
  const voices = (k) => {
    const set = new Set();
    for (let s = 0; s < 64; s++) for (const e of stepEvents(s, k)) set.add(`${s}:${e.voice}:${e.note || ''}`);
    return set;
  };
  let prev = voices(0);
  assert.ok([...prev].some((v) => v.includes(':bass:')), 'bass from the start');
  for (const k of ks.slice(1)) {
    const cur = voices(k);
    for (const v of prev) assert.ok(cur.has(v), `layer dropped at k=${k}: ${v}`);
    assert.ok(cur.size >= prev.size);
    prev = cur;
  }
  const counts = [...new Set(Object.values(LAYERS))].map((k) => voices(k).size);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1], 'each layer adds notes');
  for (let s = 0; s < 64; s++) for (const e of stepEvents(s, 1)) assert.ok(e.gain > 0 && e.gain <= 0.3);
});

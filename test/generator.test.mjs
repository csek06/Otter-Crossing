// Generates tens of thousands of lanes and checks the generator's rules hold.
//   npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GRID, RULES, TUNING } from '../src/config.js';
import { CONTENT } from '../src/content.js';
import { createGenerator, newLane, maxHazardRun, difficultyAt } from '../src/game/generator.js';
import { meetingCap, bigGapFor } from '../src/lanes/meetings.js';
import { spread, bitCount } from '../src/lanes/focus.js';
import { river } from '../src/lanes/river.js';
import { allhands } from '../src/lanes/allhands.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = (1 << GRID.COLS) - 1;
const EPS = 1e-9;

// Generate rows for several seeds and start offsets. 8 runs x 2000 rows = 16,000 lanes.
function runs() {
  const out = [];
  const configs = [];
  for (let s = 1; s <= 6; s++) configs.push({ seed: s * 7919, startRow: 0 });
  configs.push({ seed: 424242, startRow: 150 });
  configs.push({ seed: 99, startRow: 600 });
  for (const cfg of configs) {
    const gen = createGenerator(cfg);
    const lanes = [];
    for (let row = cfg.startRow - 8; row < cfg.startRow + 2000; row++) lanes.push(gen.fill(newLane(), row));
    out.push({ cfg, lanes });
  }
  return out;
}
const RUNS = runs();
const playable = (run) => run.lanes.filter((l) => l.row >= run.cfg.startRow);
const total = RUNS.reduce((n, r) => n + playable(r).length, 0);

test('generates at least 10,000 lanes', () => {
  assert.ok(total >= 10000, `only ${total} lanes`);
});

test('meeting lanes stay under the density cap', () => {
  let n = 0;
  for (const run of RUNS) {
    for (const l of playable(run)) {
      if (l.type !== 'meetings') continue;
      n++;
      const filled = l.cars.reduce((s, c) => s + c.len, 0);
      const density = filled / l.ring;
      assert.ok(density <= meetingCap(l.difficulty) + EPS, `row ${l.row}: density ${density.toFixed(3)} over cap`);
      assert.ok(density <= RULES.MEETING_DENSITY_MAX + EPS, `row ${l.row}: density over the hard max`);
    }
  }
  assert.ok(n > 2000, `expected many meeting lanes, got ${n}`);
});

test('every meeting lane has crossable gaps', () => {
  for (const run of RUNS) {
    for (const l of playable(run)) {
      if (l.type !== 'meetings') continue;
      const cars = [...l.cars].sort((a, b) => a.x - b.x);
      assert.ok(cars.length >= 1);
      const gaps = cars.map((c, i) => {
        const next = cars[(i + 1) % cars.length];
        let g = next.x - (c.x + c.len);
        if (i === cars.length - 1) g += l.ring;
        return g;
      });
      const minGap = Math.min(...gaps);
      const maxGap = Math.max(...gaps);
      assert.ok(minGap >= RULES.MEETING_MIN_GAP - EPS, `row ${l.row}: gap ${minGap.toFixed(2)} too small`);
      // Time a single column stays clear inside the widest gap, accounting for hitboxes.
      const open = (maxGap - (TUNING.PLAYER_HALF_W * 2 - TUNING.HAZARD_INSET * 2)) / l.speed;
      assert.ok(open >= RULES.MEETING_OPEN_TIME - EPS, `row ${l.row}: widest gap open ${open.toFixed(2)}s`);
      assert.ok(maxGap >= bigGapFor(l.speed) - EPS);
      // Cars must fit in the ring and be hidden off-screen while they wrap.
      const sum = cars.reduce((s, c) => s + c.len, 0) + gaps.reduce((s, g) => s + g, 0);
      assert.ok(Math.abs(sum - l.ring) < 1e-6, `row ${l.row}: ring does not add up`);
      assert.ok(l.pad >= 3, `row ${l.row}: wrap point would be visible`);
    }
  }
});

test('meeting directions alternate between consecutive meeting lanes', () => {
  for (const run of RUNS) {
    let prev = null;
    for (const l of playable(run)) {
      if (l.type !== 'meetings') continue;
      if (prev) assert.notEqual(l.dir, prev.dir, `row ${l.row}`);
      prev = l;
    }
  }
});

test('breather lanes come regularly', () => {
  for (const run of RUNS) {
    let streak = 0;
    for (const l of playable(run)) {
      if (l.type === 'focus') {
        streak = 0;
        continue;
      }
      streak++;
      assert.ok(streak <= maxHazardRun(l.difficulty), `row ${l.row}: ${streak} hazard lanes in a row`);
      assert.ok(streak <= RULES.MAX_HAZARD_RUN_MAX);
    }
  }
});

test('breathers are more frequent early on', () => {
  const early = { focus: 0, all: 0 };
  const late = { focus: 0, all: 0 };
  for (const run of RUNS) {
    for (const l of playable(run)) {
      if (l.row < run.cfg.startRow + GRID.START_ZONE) continue;
      const bucket = difficultyAt(l.row) < 0.25 ? early : difficultyAt(l.row) >= 1 ? late : null;
      if (!bucket) continue;
      bucket.all++;
      if (l.type === 'focus') bucket.focus++;
    }
  }
  const e = early.focus / early.all;
  const lt = late.focus / late.all;
  assert.ok(e > lt + 0.05, `early breather share ${e.toFixed(2)} vs late ${lt.toFixed(2)}`);
});

test('the start zone is safe and the start tile is free', () => {
  for (const run of RUNS) {
    const s = run.cfg.startRow;
    for (const l of run.lanes) {
      if (l.row < s + GRID.START_ZONE) assert.equal(l.type, 'focus', `row ${l.row}`);
      if (l.row === s) assert.equal((l.blocked >> GRID.START_COL) & 1, 0);
    }
  }
});

test('stacked focus lanes never wall the otter in', () => {
  for (const run of RUNS) {
    let reach = 1 << GRID.START_COL;
    for (const l of playable(run)) {
      if (l.type === 'focus') {
        reach = spread(reach, l.blocked);
        assert.ok(bitCount(reach) >= 1, `row ${l.row}: no reachable column`);
      } else {
        reach = ALL;
      }
    }
  }
});

test('only=<type> restricts hazards (debug ?lane=)', () => {
  const gen = createGenerator({ seed: 5, only: 'focus' });
  for (let r = 0; r < 300; r++) assert.equal(gen.fill(newLane(), r).type, 'focus');
  for (const only of ['meetings', 'river', 'allhands']) {
    const gen2 = createGenerator({ seed: 5, only });
    for (let r = 0; r < 300; r++) assert.ok(['focus', only].includes(gen2.fill(newLane(), r).type));
  }
});

test('the same seed makes the same course', () => {
  const a = createGenerator({ seed: 1234 });
  const b = createGenerator({ seed: 1234 });
  for (let r = 0; r < 500; r++) {
    const la = a.fill(newLane(), r);
    const lb = b.fill(newLane(), r);
    assert.equal(la.type, lb.type);
    assert.equal(la.blocked, lb.blocked);
    assert.deepEqual(la.cars, lb.cars);
  }
});

test('river highlights: every gap is at most 2 seconds of current', () => {
  let n = 0;
  for (const run of RUNS) {
    for (const l of playable(run)) {
      if (l.type !== 'river') continue;
      n++;
      const ps = [...l.platforms].sort((a, b) => a.x - b.x);
      assert.ok(ps.length >= 3, `row ${l.row}: only ${ps.length} highlights`);
      for (let i = 0; i < ps.length; i++) {
        const next = ps[(i + 1) % ps.length];
        let g = next.x - (ps[i].x + ps[i].len);
        if (i === ps.length - 1) g += l.ring;
        assert.ok(g >= 0, `row ${l.row}: highlights overlap`);
        assert.ok(g / l.speed <= RULES.RIVER_MAX_WAIT + EPS, `row ${l.row}: gap of ${(g / l.speed).toFixed(2)}s`);
      }
      const maxLen = Math.max(...ps.map((p) => p.len));
      assert.ok(l.pad >= maxLen, `row ${l.row}: wrap point would be visible`);
    }
  }
  assert.ok(n > 1500, `expected many river lanes, got ${n}`);
});

test('river highlights: simulated, one passes every column at least every 2 seconds', () => {
  const dt = 1 / 60;
  let checked = 0;
  for (const run of RUNS.slice(0, 3)) {
    for (const l of playable(run).filter((x) => x.type === 'river').slice(0, 150)) {
      const lane = { ...l, platforms: l.platforms.map((p) => ({ ...p })) };
      const lastSeen = new Array(GRID.COLS).fill(0);
      let worst = 0;
      for (let step = 0; step < 20 / dt; step++) {
        river.update(lane, dt);
        const time = step * dt;
        for (let c = 0; c < GRID.COLS; c++) {
          if (river.platformAt(lane, c)) {
            worst = Math.max(worst, time - lastSeen[c]);
            lastSeen[c] = time;
          }
        }
      }
      for (let c = 0; c < GRID.COLS; c++) worst = Math.max(worst, 20 - lastSeen[c]);
      assert.ok(worst <= RULES.RIVER_MAX_WAIT + 0.1, `row ${l.row}: a column waited ${worst.toFixed(2)}s`);
      checked++;
    }
  }
  assert.ok(checked >= 300);
});

test('all-hands: the signal fires at least 1 second before the train reaches the lane', () => {
  const dt = 1 / 120;
  let trains = 0;
  for (const run of RUNS) {
    for (const l of playable(run)) {
      if (l.type !== 'allhands') continue;
      assert.ok(l.warnTime >= RULES.ALLHANDS_MIN_WARNING, `row ${l.row}: warn time ${l.warnTime}`);
      const lane = { ...l };
      let signalSince = null;
      let visible = false;
      let flips = 0;
      let lastPhase = allhands.lampPhase(lane);
      for (let step = 0; step < 40 / dt; step++) {
        allhands.update(lane, dt);
        const time = step * dt;
        if (allhands.signalOn(lane)) {
          if (signalSince == null) signalSince = time;
        } else {
          signalSince = null;
        }
        const ph = allhands.lampPhase(lane);
        if (ph !== lastPhase) flips++;
        lastPhase = ph;
        const s = allhands.span(lane);
        const onScreen = !!s && s[1] > 0 && s[0] < GRID.COLS;
        if (onScreen && !visible) {
          trains++;
          assert.ok(signalSince != null, `row ${l.row}: train arrived with the signal off`);
          const lead = time - signalSince;
          assert.ok(lead >= RULES.ALLHANDS_MIN_WARNING - EPS, `row ${l.row}: only ${lead.toFixed(2)}s of warning`);
        }
        visible = onScreen;
      }
      // Each lamp flips on and off: flashes per second is flips / 2 per lamp pair, at most 3.
      assert.ok(RULES.ALLHANDS_BLINK_HZ <= 3);
      assert.ok(flips / 2 / 40 <= 3, `row ${l.row}: blinking too fast`);
    }
  }
  assert.ok(trains > 1000, `expected many trains, got ${trains}`);
});

test('action item tokens sit on reachable tiles', () => {
  let n = 0;
  for (const run of RUNS) {
    for (const l of playable(run)) {
      for (const tok of l.tokens) {
        n++;
        assert.ok(!((l.blocked >> tok.col) & 1), `row ${l.row}: token on an obstacle`);
        assert.notEqual(l.type, 'allhands');
      }
      if (l.type === 'river') n += l.platforms.filter((p) => p.token).length;
    }
  }
  assert.ok(n > 1000, `expected tokens, got ${n}`);
});

// Copy rules.
test('feature taglines are 6 words or fewer', () => {
  for (const [id, f] of Object.entries(CONTENT.features)) {
    if (f.placeholder) continue;
    const words = f.tagline.trim().split(/\s+/).length;
    assert.ok(words <= 6, `${id}: "${f.tagline}" is ${words} words`);
    for (const k of ['name', 'tagline', 'description', 'helpUrl']) assert.ok(f[k], `${id} missing ${k}`);
  }
});

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'screenshots') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(js|mjs|css|html|md|json)$/.test(name) && name !== 'package-lock.json') out.push(p);
  }
  return out;
}

const EM_DASH = String.fromCharCode(0x2014);

test('no em-dashes anywhere in source, copy or docs', () => {
  for (const f of files(root)) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!text.includes(EM_DASH), `em-dash in ${f}`);
  }
  const dist = join(root, 'dist', 'otter-crossing.html');
  if (existsSync(dist)) assert.ok(!readFileSync(dist, 'utf8').includes(EM_DASH), 'em-dash in dist');
});

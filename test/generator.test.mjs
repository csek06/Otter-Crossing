// Generates tens of thousands of lanes and checks the generator's rules hold.
//   npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GRID, RULES, TUNING, FLAGS } from '../src/config.js';
import { CONTENT } from '../src/content.js';
import { createGenerator, newLane, maxHazardRun, difficultyAt } from '../src/game/generator.js';
import { meetingCap, bigGapFor } from '../src/lanes/meetings.js';
import { spread, bitCount } from '../src/lanes/focus.js';
import { river } from '../src/lanes/river.js';
import { allhands } from '../src/lanes/allhands.js';
import { POWERUPS, POWERUP_BY_ID, spawnable } from '../src/powerups/registry.js';

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

test('every run meets a power-up within the first 15 lanes', () => {
  for (let seed = 1; seed <= 3000; seed++) {
    const gen = createGenerator({ seed });
    let first = null;
    for (let row = 0; row <= RULES.POWERUP_FIRST_BY && first == null; row++) {
      if (gen.fill(newLane(), row).powerup) first = row;
    }
    assert.ok(first != null && first <= RULES.POWERUP_FIRST_BY, `seed ${seed}: no power-up by lane ${RULES.POWERUP_FIRST_BY}`);
  }
});

test('power-ups: reachable tiles, AI Chat once a run, nothing unreleased', () => {
  const unreleased = new Set(POWERUPS.filter((p) => p.unreleased).map((p) => p.id));
  let n = 0;
  for (const run of RUNS) {
    let reach = 1 << GRID.START_COL;
    let aiChat = 0;
    let last = null;
    for (const l of playable(run)) {
      if (l.type === 'focus') reach = spread(reach, l.blocked);
      else reach = ALL;
      if (!l.powerup) continue;
      n++;
      assert.notEqual(l.type, 'allhands', `row ${l.row}: power-up on the all-hands track`);
      if (l.type === 'river') {
        assert.ok(l.powerup.plat && l.platforms.includes(l.powerup.plat), `row ${l.row}: river power-up not on a log`);
        assert.ok(!l.powerup.plat.token, `row ${l.row}: power-up shares a log with a token`);
      } else {
        assert.ok(!((l.blocked >> l.powerup.col) & 1), `row ${l.row}: power-up on an obstacle`);
        assert.ok((reach >> l.powerup.col) & 1, `row ${l.row}: power-up on an unreachable tile`);
        assert.ok(!l.tokens.some((t) => t.col === l.powerup.col), `row ${l.row}: power-up on a token`);
      }
      assert.ok(!unreleased.has(l.powerup.id), `row ${l.row}: unreleased ${l.powerup.id} spawned`);
      assert.ok(POWERUP_BY_ID[l.powerup.id]);
      if (l.powerup.id === 'aiChat') aiChat++;
      if (last != null) {
        assert.ok(l.row - last >= RULES.POWERUP_GAP_MIN, `row ${l.row}: power-ups too close`);
        // An all-hands lane can push one back a lane or two, never far.
        assert.ok(l.row - last <= RULES.POWERUP_GAP_MAX + 3, `row ${l.row}: power-ups too far apart`);
      }
      last = l.row;
    }
    assert.ok(aiChat <= 1, `AI Chat spawned ${aiChat} times in one run`);
  }
  assert.ok(n > 300, `expected many power-ups, got ${n}`);
});

test('power-ups are spread across lane types, columns and gaps', () => {
  const types = new Map();
  const cols = new Set();
  const gaps = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const gen = createGenerator({ seed });
    let last = null;
    for (let r = 0; r < 600; r++) {
      const l = gen.fill(newLane(), r);
      if (!l.powerup) continue;
      types.set(l.type, (types.get(l.type) || 0) + 1);
      if (!l.powerup.plat) cols.add(l.powerup.col);
      if (last != null) gaps.add(r - last);
      last = r;
    }
  }
  for (const t of ['focus', 'meetings', 'river']) assert.ok(types.get(t) > 50, `few power-ups on ${t}: ${types.get(t) || 0}`);
  assert.equal(cols.size, GRID.COLS, 'every column gets power-ups');
  assert.ok(gaps.size >= RULES.POWERUP_GAP_MAX - RULES.POWERUP_GAP_MIN, `gaps vary: ${[...gaps].sort((a, b) => a - b)}`);
});

test('unreleased power-ups spawn only when the flag allows', () => {
  assert.ok(spawnable(false).every((p) => !p.unreleased));
  assert.equal(spawnable(true).length, POWERUPS.length);
});

test('Live Assist is released and spawns in normal runs', () => {
  assert.ok(spawnable(false).some((p) => p.id === 'liveAssist'));
  const gen = createGenerator({ seed: 77 });
  const seen = new Set();
  for (let r = 0; r < 4000; r++) {
    const l = gen.fill(newLane(), r);
    if (l.powerup) seen.add(l.powerup.id);
  }
  assert.ok(seen.has('liveAssist'), 'liveAssist never spawned');
});

test('Work Mode: a run takes 8 new lanes, then sweeps tokens ahead into a follow-up doc', async () => {
  const { default: wm, STEPS, SWEEP_ROWS, DOC_BONUS } = await import('../src/powerups/workmode.js');
  const lanes = new Map();
  for (let r = 0; r < 40; r++) {
    const l = newLane();
    l.row = r;
    l.tokens = [{ col: r % GRID.COLS, taken: false, t: 0 }];
    lanes.set(r, l);
  }
  const msgs = [];
  const game = {
    active: [], maxRow: 5, actionItems: 0, player: { row: 5, x: 4 },
    addActive(mod) { this.active.push({ mod, t: mod.duration, max: mod.duration }); },
    removeActive(id) { this.active = this.active.filter((e) => e.mod.id !== id); },
    getLane: (r) => lanes.get(r) || null,
    takeToken() { game.actionItems++; },
    message: (key, vars) => msgs.push([key, vars]),
  };
  const tick = () => {
    for (const e of [...game.active]) {
      wm.update(game, 1 / 60, e);
      e.t -= 1 / 60;
      if (e.t <= 0) game.removeActive(e.mod.id);
    }
  };
  wm.apply(game);
  // Time alone never finishes a run.
  for (let i = 0; i < 600; i++) tick();
  assert.equal(game.active.length, 1, 'still running after 10 seconds standing still');
  assert.equal(game.active[0].left, STEPS);
  for (let step = 1; step < STEPS; step++) {
    game.maxRow++; game.player.row++;
    tick();
    assert.equal(game.active[0].left, STEPS - step, `step ${step}`);
  }
  assert.equal(game.actionItems, 0);
  game.maxRow++; game.player.row++;
  tick();
  assert.equal(game.active.length, 0, 'the run ends when it finishes');
  assert.equal(game.actionItems, SWEEP_ROWS + 1 + DOC_BONUS, 'sweeps one token per lane ahead plus the doc bonus');
  assert.deepEqual(msgs, [['workModeDone', { n: SWEEP_ROWS + 1 + DOC_BONUS }]]);
  assert.ok(lanes.get(game.player.row + SWEEP_ROWS).tokens[0].taken);
  assert.ok(!lanes.get(game.player.row + SWEEP_ROWS + 1).tokens[0].taken, 'the sweep stops after SWEEP_ROWS lanes');
});

test('every power-up module has the shared interface and content', () => {
  for (const p of POWERUPS) {
    assert.equal(typeof p.id, 'string');
    assert.ok(CONTENT.features[p.featureId], `${p.id}: no content for ${p.featureId}`);
    assert.equal(typeof p.unreleased, 'boolean');
    assert.equal(typeof p.duration, 'number');
    assert.equal(typeof p.apply, 'function');
  }
  for (const key of ['notetakerSaved', 'aiChatRevive']) assert.ok(CONTENT.powerupMessages[key]);
});

// Copy rules.
test('feature taglines are 6 words or fewer', () => {
  for (const [id, f] of Object.entries(CONTENT.features)) {
    if (f.placeholder) continue; // none today, kept for future placeholder copy
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

test('COPY_REVIEW.md is up to date with content.js', async () => {
  const { buildCopyReview } = await import('../tools/copy-review.mjs');
  const onDisk = readFileSync(join(root, 'COPY_REVIEW.md'), 'utf8');
  assert.equal(onDisk, buildCopyReview(), 'run npm run copy-review');
});

test('AUDIENCE internal uses internal meeting titles', () => {
  const was = FLAGS.AUDIENCE;
  try {
    for (const aud of ['external', 'internal']) {
      FLAGS.AUDIENCE = aud;
      const allowed = new Set(Object.values(CONTENT.meetingTitles[aud]).flat());
      const gen = createGenerator({ seed: 42, only: 'meetings' });
      let n = 0;
      for (let r = 0; r < 400; r++) {
        const l = gen.fill(newLane(), r);
        for (const car of l.cars) {
          if (l.type !== 'meetings') continue;
          assert.ok(allowed.has(car.title), `${aud}: unexpected title ${car.title}`);
          n++;
        }
      }
      assert.ok(n > 100);
    }
  } finally {
    FLAGS.AUDIENCE = was;
  }
});

test('the hawk alarm starts before the shadow and pulses at most 3 times a second', () => {
  assert.ok(RULES.HAWK_ALARM > 0 && RULES.HAWK_ALARM < RULES.HAWK_WARN && RULES.HAWK_WARN < RULES.HAWK_STRIKE);
  assert.ok(RULES.HAWK_ALARM_HZ <= 3);
});

test('meeting titles are short enough to fit their block, with no repeats', () => {
  const MAX = { 1: 9, 2: 14, 3: 20 };
  for (const aud of ['external', 'internal']) {
    for (const len of [1, 2, 3]) {
      const list = CONTENT.meetingTitles[aud][len];
      assert.ok(list.length >= (aud === 'external' ? 25 : 12), `${aud} ${len}: only ${list.length} titles`);
      assert.equal(new Set(list).size, list.length, `${aud} ${len}: repeated title`);
      for (const title of list) assert.ok(title.length <= MAX[len], `${aud} ${len}: "${title}" is longer than ${MAX[len]} characters`);
    }
  }
});

// Lane generator. Pure and seeded so the automated test can check its rules
// over thousands of lanes without a browser.
//
// Rules it guarantees (see RULES in config.js):
// - Every meeting lane stays under the density cap and has a crossable gap.
// - Focus-time breather lanes come regularly, more often early on.
// - Stacked focus lanes never wall the otter in.
// - A highlight passes every river column at least every RIVER_MAX_WAIT seconds.
// - The all-hands signal fires at least ALLHANDS_MIN_WARNING seconds ahead.
// - A power-up appears within the first POWERUP_FIRST_BY lanes, then on a random lane
//   every POWERUP_GAP_MIN to POWERUP_GAP_MAX lanes.

import { GRID, RULES, TUNING } from '../config.js';
import { createRng } from '../core/rng.js';
import { LANES, HAZARDS } from '../lanes/registry.js';
import { spawnable } from '../powerups/registry.js';

const ALL = (1 << GRID.COLS) - 1;
const lerp = (a, b, t) => a + (b - a) * t;

export function difficultyAt(row) {
  return Math.min(1, Math.max(0, row / TUNING.DIFFICULTY_ROWS));
}

export function maxHazardRun(d) {
  return Math.round(lerp(RULES.MAX_HAZARD_RUN_MIN, RULES.MAX_HAZARD_RUN_MAX, d));
}

export function breatherChance(d) {
  return lerp(RULES.BREATHER_CHANCE_MAX, RULES.BREATHER_CHANCE_MIN, d);
}

export function newLane() {
  return { row: 0, type: 'focus', mod: null, obstacles: [], blocked: 0, cars: [], platforms: [], tokens: [], powerup: null, first: false, crocs: 0 };
}

// only: restrict hazard lanes to one type id (debug ?lane=). Breathers still appear,
// unless only is 'focus', in which case every lane is focus time.
// powerups: which power-ups may spawn, as [{ id, weight, oncePerRun }].
export function createGenerator({ seed, startRow = 0, only = null, powerups = spawnable() }) {
  const rng = createRng(seed);
  const ctx = { reach: ALL, hazardRun: 0, meetingDir: 1, zone: null, firstStart: false };
  const placedOnce = new Set();
  // Leave a few lanes of slack before POWERUP_FIRST_BY in case the chosen lane can't take it.
  let nextPowerup = startRow + rng.int(RULES.POWERUP_FIRST_MIN, RULES.POWERUP_FIRST_BY - 3);
  const seen = new Set();
  let hazards = HAZARDS;
  if (only && only !== 'focus') hazards = HAZARDS.filter((h) => h.id === only);
  if (!hazards.length) hazards = HAZARDS;

  function pickHazard(d, row) {
    // Rivers come in short clusters, the way real water does.
    if (ctx.lastType === 'river' && rng.chance(0.4)) {
      const r = hazards.find((h) => h.id === 'river');
      if (r) return r;
    }
    let total = 0;
    for (const h of hazards) total += h.weight(d, row);
    // Debug ?lane= can ask for a type before its usual first row.
    if (total <= 0) return hazards[0];
    let r = rng.next() * total;
    for (const h of hazards) {
      r -= h.weight(d, row);
      if (r <= 0 && h.weight(d, row) > 0) return h;
    }
    return hazards.find((h) => h.weight(d, row) > 0);
  }

  // Action item tokens. Never on a blocked tile; in the river they ride a highlight.
  function placeTokens(lane, row) {
    lane.tokens.length = 0;
    if (row < startRow + 2) return;
    if (lane.type === 'allhands') return;
    if (!rng.chance(RULES.TOKEN_CHANCE)) return;
    if (lane.type === 'river') {
      rng.pick(lane.platforms).token = true;
      return;
    }
    for (let i = 0; i < 6; i++) {
      const col = rng.int(0, GRID.COLS - 1);
      if (!lane.mod.blocks(lane, col)) {
        lane.tokens.push({ col, taken: false, t: 0 });
        return;
      }
    }
  }

  // Power-ups land on a random lane of any kind except the all-hands track: a
  // reachable free tile on land, or a log in the river. The next one is due a
  // random POWERUP_GAP_MIN to POWERUP_GAP_MAX lanes later. If the lane it is due
  // on can't take it, it moves to the next lane that can.
  function placePowerup(lane, row) {
    lane.powerup = null;
    if (row < startRow + GRID.START_ZONE || row < nextPowerup) return;
    if (lane.type === 'allhands') return;
    const pool = powerups.filter((p) => !(p.oncePerRun && placedOnce.has(p.id)));
    if (!pool.length) return;
    let spot = null;
    if (lane.type === 'river') {
      const logs = lane.platforms.filter((p) => !p.token);
      if (!logs.length) return;
      spot = { col: -1, plat: rng.pick(logs) };
    } else {
      let free = (lane.mod.safe ? ctx.reach : ALL) & ~lane.blocked;
      for (const tok of lane.tokens) free &= ~(1 << tok.col);
      if (!free) return;
      const cols = [];
      for (let c = 0; c < GRID.COLS; c++) if (free & (1 << c)) cols.push(c);
      spot = { col: rng.pick(cols), plat: null };
    }
    let total = 0;
    for (const p of pool) total += p.weight;
    let r = rng.next() * total;
    let pick = pool[pool.length - 1];
    for (const p of pool) {
      r -= p.weight;
      if (r <= 0) { pick = p; break; }
    }
    lane.powerup = { id: pick.id, col: spot.col, plat: spot.plat, taken: false };
    if (pick.oncePerRun) placedOnce.add(pick.id);
    nextPowerup = row + rng.int(RULES.POWERUP_GAP_MIN, RULES.POWERUP_GAP_MAX);
  }

  // Fill a lane object for the next row. Rows must be requested in order.
  function fill(lane, row) {
    const d = difficultyAt(row);
    let mod;
    ctx.zone = null;
    ctx.firstStart = row === startRow;
    if (row < startRow) {
      mod = LANES.focus;
      ctx.zone = 'behind';
    } else if (row < startRow + GRID.START_ZONE) {
      mod = LANES.focus;
      ctx.zone = 'start';
    } else if (only === 'focus') {
      mod = LANES.focus;
    } else if (ctx.hazardRun >= maxHazardRun(d)) {
      mod = LANES.focus;
    } else if (ctx.hazardRun > 0 && rng.chance(breatherChance(d))) {
      mod = LANES.focus;
    } else {
      mod = pickHazard(d, row);
    }

    lane.row = row;
    lane.type = mod.id;
    lane.mod = mod;
    lane.difficulty = d;
    lane.crocs = 0; // lanes are pooled; only the river sets this
    mod.generate(lane, row, d, rng, ctx);
    placeTokens(lane, row);
    placePowerup(lane, row);
    ctx.lastType = mod.id;
    lane.first = !seen.has(mod.id) && row >= startRow;
    if (row >= startRow) seen.add(mod.id);

    if (mod.safe) {
      ctx.hazardRun = 0;
    } else {
      ctx.hazardRun++;
      // Hazard lanes let the otter move sideways, so every column is reachable after one.
      ctx.reach = ALL;
    }
    return lane;
  }

  return { fill, rng };
}

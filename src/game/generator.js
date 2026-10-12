// Lane generator. Pure and seeded so the automated test can check its rules
// over thousands of lanes without a browser.
//
// Rules it guarantees (see RULES in config.js):
// - Every meeting lane stays under the density cap and has a crossable gap.
// - Focus-time breather lanes come regularly, more often early on.
// - Stacked focus lanes never wall the otter in.

import { GRID, RULES, TUNING } from '../config.js';
import { createRng } from '../core/rng.js';
import { LANES, HAZARDS } from '../lanes/registry.js';

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
  return { row: 0, type: 'focus', mod: null, obstacles: [], blocked: 0, cars: [], first: false };
}

// only: restrict hazard lanes to one type id (debug ?lane=). Breathers still appear,
// unless only is 'focus', in which case every lane is focus time.
export function createGenerator({ seed, startRow = 0, only = null }) {
  const rng = createRng(seed);
  const ctx = { reach: ALL, hazardRun: 0, meetingDir: 1, zone: null, firstStart: false };
  const seen = new Set();
  let hazards = HAZARDS;
  if (only && only !== 'focus') hazards = HAZARDS.filter((h) => h.id === only);
  if (!hazards.length) hazards = HAZARDS;

  function pickHazard(d) {
    let total = 0;
    for (const h of hazards) total += h.weight(d);
    let r = rng.next() * total;
    for (const h of hazards) {
      r -= h.weight(d);
      if (r <= 0) return h;
    }
    return hazards[hazards.length - 1];
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
      mod = pickHazard(d);
    }

    lane.row = row;
    lane.type = mod.id;
    lane.mod = mod;
    lane.difficulty = d;
    mod.generate(lane, row, d, rng, ctx);
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

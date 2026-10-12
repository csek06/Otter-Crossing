// Game state: lanes, the otter, the camera, the Deadline Hawk, tokens, scoring
// and deaths. Rendering and UI live elsewhere and listen through the events object.

import { GRID, TUNING, RULES } from '../config.js';
import { Pool } from '../core/pool.js';
import { randomSeed } from '../core/rng.js';
import { createGenerator, difficultyAt, newLane } from './generator.js';
import { createPlayer, resetPlayer, tryHop, updatePlayer, logicalRow, visualRow, isHopping } from './player.js';
import { createFx } from './fx.js';
import { load, save } from '../core/storage.js';

const lerp = (a, b, t) => a + (b - a) * t;

// How long each death plays before the game over screen.
const DEATH_TIME = { meeting: TUNING.DEATH_DELAY, allhands: TUNING.DEATH_DELAY, river: 1.0, hawk: 1.35 };

export function createGame({ params, events, input, sfx, reducedMotion }) {
  const lanePool = new Pool(newLane);
  const game = {
    state: 'title', // title, playing, paused, dying, over
    lanes: [],
    laneBase: 0,
    player: createPlayer(),
    camRow: 0,
    startRow: 0,
    maxRow: 0,
    score: 0,
    actionItems: 0,
    best: load('best', 0),
    time: 0,
    moved: false,
    shake: 0,
    stall: 0,          // seconds since the last forward progress
    hawk: { warn: 0, swoopT: -1 },
    gen: null,
    seed: 0,
    hintsShown: new Set(),
    stats: { highlights: 0 },
    fx: createFx(),
    debug: { invincible: false, hitboxes: false },
    viewRows: 20,
  };

  function getLane(row) {
    const i = row - game.laneBase;
    return i >= 0 && i < game.lanes.length ? game.lanes[i] : null;
  }
  game.getLane = getLane;

  function ensureLanes() {
    const want = Math.ceil(game.camRow + game.viewRows + TUNING.LOOKAHEAD_ROWS);
    while (game.laneBase + game.lanes.length <= want) {
      const row = game.laneBase + game.lanes.length;
      game.lanes.push(game.gen.fill(lanePool.get(), row));
    }
    // Recycle lanes that have scrolled out behind the camera.
    while (game.lanes.length && game.lanes[0].row < Math.floor(game.camRow) - 2) {
      lanePool.release(game.lanes.shift());
      game.laneBase++;
    }
  }

  game.reset = function reset() {
    for (const l of game.lanes) lanePool.release(l);
    game.lanes.length = 0;
    game.seed = params.seed != null ? params.seed : randomSeed();
    game.startRow = params.start;
    game.gen = createGenerator({ seed: game.seed, startRow: game.startRow, only: params.lane });
    game.laneBase = game.startRow - GRID.BEHIND - 3;
    game.camRow = game.startRow - GRID.BEHIND;
    resetPlayer(game.player, game.startRow);
    game.maxRow = game.startRow;
    game.score = 0;
    game.actionItems = 0;
    game.time = 0;
    game.moved = false;
    game.shake = 0;
    game.stall = 0;
    game.hawk.warn = 0;
    game.hawk.swoopT = -1;
    game.stats.highlights = 0;
    game.hintsShown.clear();
    game.fx.clear();
    // Prime lanes and let traffic settle so the first frame looks lived in.
    ensureLanes();
    for (let i = 0; i < 30; i++) for (const l of game.lanes) l.mod.update(l, 0.1);
    events.score(game);
  };

  game.start = function start() {
    game.reset();
    game.state = 'playing';
    input.setEnabled(true);
    events.state(game);
  };

  game.setPaused = function setPaused(v) {
    if (v && game.state === 'playing') {
      game.state = 'paused';
      input.setEnabled(false);
      events.state(game);
    } else if (!v && game.state === 'paused') {
      game.state = 'playing';
      input.setEnabled(true);
      events.state(game);
    }
  };

  function kill(cause, hit) {
    const p = game.player;
    if (p.dead) return;
    if (game.debug.invincible || p.invuln > 0) {
      // Keep debug runs playable: pull the otter out of trouble.
      if (cause === 'river') {
        p.swim = 0;
        p.x = Math.min(GRID.COLS - 1, Math.max(0, p.x));
      }
      if (cause === 'hawk') game.stall = 0;
      return;
    }
    p.dead = true;
    p.deathCause = cause;
    p.deathT = 0;
    p.deathCar = hit && hit.car ? hit.car : null;
    p.deathLane = hit && hit.lane ? hit.lane : null;
    p.hopT = -1;
    game.state = 'dying';
    input.setEnabled(false);
    if (cause === 'hawk') {
      game.hawk.swoopT = 0;
      sfx.screech();
    } else if (cause === 'river') {
      game.fx.splash(p.x + 0.5, p.row, reducedMotion());
      sfx.splash();
    } else {
      game.shake = 0.3;
      sfx.hit();
    }
    events.state(game);
  }
  game.kill = kill;

  function finish() {
    game.state = 'over';
    const isBest = game.score > game.best;
    if (isBest) {
      game.best = game.score;
      save('best', game.best);
    }
    events.gameOver(game, { cause: game.player.deathCause, isBest });
    events.state(game);
  }

  function hint(id) {
    if (game.hintsShown.has(id)) return;
    game.hintsShown.add(id);
    events.hint(id);
  }

  function checkHints() {
    const pr = game.player.row;
    for (let r = pr; r <= pr + 4; r++) {
      const lane = getLane(r);
      if (lane && lane.first && lane.mod.hint) hint(lane.mod.hint);
    }
  }

  function collectTokens(lane) {
    const p = game.player;
    if (lane.type === 'river') {
      const plat = p.riding;
      if (plat && plat.token && !plat.taken) {
        plat.taken = true;
        takeToken(p.x + 0.5, lane.row);
      }
      return;
    }
    for (const tok of lane.tokens) {
      if (!tok.taken && Math.abs(p.x - tok.col) < 0.5) {
        tok.taken = true;
        takeToken(tok.col + 0.5, lane.row);
      }
    }
  }

  function takeToken(x, row) {
    game.actionItems++;
    game.fx.check(x, row);
    sfx.pickup();
    events.score(game);
  }

  // One bell per lamp flash, from the nearest active all-hands lane on screen.
  function ringBells() {
    let nearest = null;
    let best = Infinity;
    const top = game.camRow + game.viewRows;
    for (const l of game.lanes) {
      if (l.type !== 'allhands' || l.state !== 'warn') continue;
      if (l.row < game.camRow || l.row > top) continue;
      const d = Math.abs(l.row - game.player.row);
      if (d < best) { best = d; nearest = l; }
    }
    for (const l of game.lanes) {
      if (l.type !== 'allhands') continue;
      const ph = l.mod.lampPhase(l);
      if (l === nearest && ph !== l.lastPhase) sfx.bell();
      l.lastPhase = ph;
    }
  }

  game.update = function update(dt) {
    game.fx.update(dt);
    if (game.state === 'title' || game.state === 'over') {
      // Keep traffic moving behind the menus.
      for (const l of game.lanes) l.mod.update(l, dt);
      return;
    }
    if (game.state === 'paused') return;

    game.time += dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
    for (const l of game.lanes) l.mod.update(l, dt);

    const p = game.player;
    if (game.state === 'dying') {
      p.deathT += dt;
      if (game.hawk.swoopT >= 0) game.hawk.swoopT += dt;
      // Pulled along by whatever caught you.
      if (p.deathLane && p.deathLane.speed && p.deathCause === 'meeting') p.x += p.deathLane.speed * p.deathLane.dir * dt;
      if (p.deathT >= (DEATH_TIME[p.deathCause] || TUNING.DEATH_DELAY)) finish();
      return;
    }

    // Start the next buffered move as soon as the otter is free.
    if (!isHopping(p)) {
      const dir = input.next();
      if (dir) {
        const res = tryHop(p, dir, getLane);
        if (res === 'hop') {
          game.moved = true;
          sfx.hop();
        } else if (res === 'blocked') {
          sfx.bump();
        }
      }
    }

    const landed = updatePlayer(p, dt);
    if (landed) {
      const l = getLane(p.row);
      if (!l || !l.mod.carry) {
        p.swim = -1;
        p.riding = null;
      }
      if (p.row > game.maxRow) {
        game.maxRow = p.row;
        game.score = game.maxRow - game.startRow;
        game.stall = 0;
        events.score(game);
      }
    }

    // Lanes that move the otter (the river current).
    if (!isHopping(p)) {
      const l = getLane(p.row);
      if (l && l.mod.carry) {
        const res = l.mod.carry(l, p, dt);
        if (res === 'splash') {
          game.fx.splash(p.x + 0.5, p.row, reducedMotion());
          sfx.splash();
        } else if (res === 'ride') {
          game.stats.highlights++;
        }
      }
    }

    // Collisions and pickups in the otter's current row.
    const lane = getLane(logicalRow(p));
    if (lane) {
      collectTokens(lane);
      const hit = lane.mod.collide(lane, p);
      if (hit) {
        hit.lane = lane;
        kill(hit.cause, hit);
        if (p.dead) return;
      }
    }

    // The Deadline Hawk: stall too long and it strikes. The shadow warns first.
    game.stall += dt;
    game.hawk.warn = Math.max(0, Math.min(1, (game.stall - RULES.HAWK_WARN) / (RULES.HAWK_STRIKE - RULES.HAWK_WARN)));
    if (game.stall >= RULES.HAWK_WARN) {
      if (!game.hawk.warned) {
        game.hawk.warned = true;
        sfx.flap();
      }
      hint('hawk');
    } else {
      game.hawk.warned = false;
    }
    if (game.stall >= RULES.HAWK_STRIKE) {
      kill('hawk', null);
      if (p.dead) return;
    }

    // Camera: follows the otter and creeps forward on its own once play begins.
    const d = difficultyAt(game.maxRow);
    const target = visualRow(p) - GRID.BEHIND;
    let cam = game.camRow;
    if (game.moved) cam += lerp(TUNING.CAMERA_CREEP_MIN, TUNING.CAMERA_CREEP_MAX, d) * dt;
    if (target > cam) cam += (target - cam) * Math.min(1, TUNING.CAMERA_FOLLOW * dt);
    game.camRow = Math.max(game.camRow, cam);

    // Fell behind the camera: the Deadline Hawk takes the otter.
    if (!p.dead && visualRow(p) < game.camRow - 0.35) kill('hawk', null);

    ringBells();
    ensureLanes();
    checkHints();
  };

  return game;
}

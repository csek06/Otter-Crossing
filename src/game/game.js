// Game state: lanes, the otter, the camera, the Deadline Hawk, tokens, scoring
// and deaths. Rendering and UI live elsewhere and listen through the events object.

import { GRID, TUNING, RULES } from '../config.js';
import { Pool } from '../core/pool.js';
import { randomSeed } from '../core/rng.js';
import { createGenerator, difficultyAt, newLane } from './generator.js';
import { createPlayer, resetPlayer, tryHop, forceHop, updatePlayer, logicalRow, visualRow, isHopping } from './player.js';
import { POWERUP_BY_ID } from '../powerups/registry.js';
import { createFx } from './fx.js';
import { load, save } from '../core/storage.js';
import { createAutopilot } from './autopilot.js';
import { dateKey, dailySeed } from './daily.js';
import { DIR } from '../core/input.js';

const lerp = (a, b, t) => a + (b - a) * t;

// How long each death plays before the game over screen.
const DEATH_TIME = { meeting: TUNING.DEATH_DELAY, allhands: TUNING.DEATH_DELAY, river: 1.0, hawk: 1.35 };

export function createGame({ params, events: listeners, input, sfx: sounds, reducedMotion }) {
  const lanePool = new Pool(newLane);
  const autopilot = createAutopilot();
  // The booth attract loop plays silently and never reaches the UI.
  const quiet = (fns) => Object.fromEntries(Object.entries(fns).map(([k, f]) => [k, (...a) => (game.demo ? undefined : f(...a))]));
  const events = quiet(listeners);
  const sfx = quiet(sounds);
  const game = {
    state: 'title', // title, demo, playing, paused, learn, dying, over
    mode: 'free',      // free or daily
    demo: false,       // true while the title screen attract loop plays
    demoRuns: 0,       // attract loop runs finished, for tests
    dailyKey: null,
    autopilot,
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
    learned: new Set(), // power-ups explained this run
    learnT: 0,
    active: [],        // timed power-ups: { mod, t, max }
    held: [],          // held power-ups, like AI Chat
    used: [],          // feature ids used this run, in order, for the game over recap
    auto: null,        // Summary auto-hop in progress
    lastSafeRow: 0,
    sfx,
    fx: createFx(),
    debug: { invincible: false, hitboxes: false },
    viewRows: 20,
    behind: GRID.BEHIND,
    demoBehind: 0,     // rows behind the otter during the attract loop
    outfit: 'classic', // set from the wardrobe
  };

  function getLane(row) {
    const i = row - game.laneBase;
    return i >= 0 && i < game.lanes.length ? game.lanes[i] : null;
  }
  game.getLane = getLane;

  // Like getLane, but generates lanes further ahead if needed.
  function getLaneAhead(row) {
    while (game.laneBase + game.lanes.length <= row) {
      const r = game.laneBase + game.lanes.length;
      game.lanes.push(game.gen.fill(lanePool.get(), r));
    }
    return getLane(row);
  }

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

  game.reset = function reset(mode = 'free') {
    for (const l of game.lanes) lanePool.release(l);
    game.lanes.length = 0;
    game.mode = mode;
    // The daily course ignores the debug parameters so every run of it is the same.
    const daily = mode === 'daily';
    game.dailyKey = daily ? dateKey() : null;
    game.seed = daily ? dailySeed(game.dailyKey) : params.seed != null ? params.seed : randomSeed();
    game.startRow = daily ? 0 : params.start;
    game.gen = createGenerator({ seed: game.seed, startRow: game.startRow, only: daily ? null : params.lane });
    // The attract loop sets the camera so the otter plays in the gap between the
    // title sign and the drawer. main.js measures that gap into demoBehind.
    game.behind = game.demo ? game.demoBehind || GRID.BEHIND + 4 : GRID.BEHIND;
    game.laneBase = game.startRow - Math.ceil(game.behind) - 3;
    game.camRow = game.startRow - game.behind;
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
    game.active.length = 0;
    game.held.length = 0;
    game.used.length = 0;
    game.learned.clear();
    game.learnT = 0;
    game.auto = null;
    game.lastSafeRow = game.startRow;
    game.hintsShown.clear();
    game.fx.clear();
    // Prime lanes and let traffic settle so the first frame looks lived in.
    ensureLanes();
    for (let i = 0; i < 30; i++) for (const l of game.lanes) l.mod.update(l, 0.1);
    events.score(game);
  };

  game.start = function start(mode = 'free') {
    game.demo = false;
    game.reset(mode);
    game.state = 'playing';
    input.setEnabled(true);
    events.state(game);
    // Debug: ?powerup=<id> grants one at the start.
    if (mode === 'free' && params.powerup && POWERUP_BY_ID[params.powerup]) grantPowerup(POWERUP_BY_ID[params.powerup], false);
  };

  // Attract loop: the autopilot plays behind the title screen, loses, and starts over.
  game.startDemo = function startDemo() {
    game.demo = true;
    game.reset();
    game.state = 'demo';
    input.setEnabled(false);
    autopilot.reset();
  };

  // Power-up plumbing used by the modules in src/powerups/.
  game.addActive = (mod) => {
    game.removeActive(mod.id);
    game.active.push({ mod, t: mod.duration, max: mod.duration });
  };
  game.removeActive = (id) => {
    const i = game.active.findIndex((e) => e.mod.id === id);
    if (i >= 0) game.active.splice(i, 1);
  };
  game.hold = (mod) => {
    if (!game.held.includes(mod)) game.held.push(mod);
  };
  game.release = (id) => {
    const i = game.held.findIndex((m) => m.id === id);
    if (i >= 0) game.held.splice(i, 1);
  };
  game.isActive = (id) => game.active.some((e) => e.mod.id === id);
  game.message = (key, vars) => events.message(key, vars);
  game.markUsed = (featureId) => {
    if (!game.used.includes(featureId)) game.used.push(featureId);
  };

  // The first pickup of each power-up in a run stops play and explains it
  // (state 'learn'). Hopping forward closes it. Later pickups show the card.
  function grantPowerup(mod, teach = true) {
    game.markUsed(mod.featureId);
    sfx.powerup();
    const first = !game.learned.has(mod.id);
    game.learned.add(mod.id);
    mod.apply(game);
    if (teach && first && !game.demo && game.state === 'playing') {
      game.state = 'learn';
      game.learnT = 0;
      input.clear();
      events.learn(mod);
      events.state(game);
    } else {
      events.powerup(mod);
    }
  }

  game.grantPowerup = grantPowerup;

  // Ignore input for a moment so a buffered hop does not close it unread.
  const LEARN_MIN = 0.4;
  function updateLearn(dt) {
    game.learnT += dt;
    const dir = input.next();
    if (game.learnT < LEARN_MIN || dir !== DIR.up) return;
    input.clear();
    game.state = 'playing';
    events.state(game);
  }

  // Summary: hop forward n lanes, then on to the next safe lane.
  game.autoHop = (n) => {
    const p = game.player;
    let target = null;
    for (let r = p.row + n; r <= p.row + n + 12; r++) {
      const l = getLaneAhead(r);
      if (l && l.mod.safe) { target = l; break; }
    }
    if (!target) return;
    // Land on the free column closest to where the otter is.
    let col = Math.round(p.x);
    for (let d = 0; d < GRID.COLS; d++) {
      const a = col - d, b = col + d;
      if (a >= 0 && !target.mod.blocks(target, a)) { col = a; break; }
      if (b < GRID.COLS && !target.mod.blocks(target, b)) { col = b; break; }
    }
    game.auto = { row: target.row, col };
    input.clear();
  };

  // AI Chat: back to the nearest safe lane on screen, with a moment of invulnerability.
  game.respawnSafe = (invuln) => {
    const p = game.player;
    let lane = null;
    for (let r = p.row; r >= Math.ceil(game.camRow) + 1; r--) {
      const l = getLane(r);
      if (l && l.mod.safe) { lane = l; break; }
    }
    if (!lane) {
      lane = getLane(game.lastSafeRow) || getLane(Math.ceil(game.camRow) + 1);
      // Pull the camera back so the otter is in view.
      game.camRow = Math.min(game.camRow, lane.row - 2);
    }
    let col = Math.round(Math.min(GRID.COLS - 1, Math.max(0, p.x)));
    for (let d = 0; d < GRID.COLS; d++) {
      if (col - d >= 0 && !lane.mod.blocks(lane, col - d)) { col -= d; break; }
      if (col + d < GRID.COLS && !lane.mod.blocks(lane, col + d)) { col += d; break; }
    }
    p.row = p.fromRow = p.toRow = lane.row;
    p.x = p.fromX = p.toX = col;
    p.hopT = -1;
    p.swim = -1;
    p.riding = null;
    p.invuln = invuln;
    game.stall = 0;
    game.hawk.warn = 0;
    game.hawk.swoopT = -1;
    input.clear();
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
    // Invulnerable after a shield hit or a revive: traffic passes through.
    if (p.invuln > 0 && (cause === 'meeting' || cause === 'allhands')) return;
    if (game.auto) return;
    for (const e of game.active) {
      if (e.mod.absorb && e.mod.absorb(game, cause)) {
        game.shake = 0.15;
        return;
      }
    }
    if (!game.debug.invincible) {
      for (const mod of game.held) {
        if (mod.revive && mod.revive(game, cause)) {
          game.shake = 0.2;
          sfx.hit();
          return;
        }
      }
    }
    if (game.debug.invincible) {
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
    if (game.demo) {
      game.demoRuns++;
      game.startDemo();
      return;
    }
    game.state = 'over';
    const isBest = game.mode === 'free' && game.score > game.best;
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

  function takeToken(x, row, pulled = false) {
    game.actionItems++;
    if (pulled) game.fx.pull(x, row, game.player);
    else game.fx.check(x, row);
    sfx.pickup();
    events.score(game);
  }
  game.takeToken = takeToken;

  function collectPowerup(lane) {
    const pu = lane.powerup;
    const p = game.player;
    if (!pu || pu.taken) return;
    if (pu.plat ? p.riding !== pu.plat : Math.abs(p.x - pu.col) >= 0.5) return;
    const mod = POWERUP_BY_ID[pu.id];
    if (!mod) return;
    pu.taken = true;
    grantPowerup(mod);
  }

  function updatePowerups(dt) {
    for (let i = game.active.length - 1; i >= 0; i--) {
      const e = game.active[i];
      if (e.mod.update) e.mod.update(game, dt, e);
      e.t -= dt;
      if (e.t <= 0 && game.active[i] === e) game.active.splice(i, 1);
    }
  }

  // Summary's auto-hop: quick hops forward, drifting toward the landing column.
  function stepAuto() {
    const p = game.player;
    const a = game.auto;
    if (isHopping(p)) return;
    if (p.row >= a.row) {
      game.auto = null;
      p.invuln = Math.max(p.invuln, 0.5);
      return;
    }
    const x = Math.round(p.x);
    const toX = x + Math.sign(a.col - x);
    forceHop(p, toX, p.row + 1, 0.075);
    p.invuln = Math.max(p.invuln, 0.3);
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
    if (game.state === 'learn') { updateLearn(dt); return; }

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

    updatePowerups(dt);
    if (game.auto) stepAuto();

    // Start the next buffered move as soon as the otter is free.
    if (!isHopping(p) && !game.auto) {
      const dir = game.demo ? autopilot.next(game, dt) : input.next();
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
      if (l && l.mod.safe && !game.auto) game.lastSafeRow = p.row;
      if (p.row > game.maxRow) {
        game.maxRow = p.row;
        game.score = game.maxRow - game.startRow;
        game.stall = 0;
        events.score(game);
      }
    }

    // Lanes that move the otter (the river current).
    if (!isHopping(p) && !game.auto) {
      const l = getLane(p.row);
      if (l && l.mod.carry) {
        const res = l.mod.carry(l, p, dt);
        if (res === 'splash') {
          game.fx.splash(p.x + 0.5, p.row, reducedMotion());
          sfx.splash();
        } else if (res === 'ride') {
          game.stats.highlights++;
          game.markUsed('highlights');
        }
      }
    }

    // Collisions and pickups in the otter's current row.
    const lane = getLane(logicalRow(p));
    if (lane) {
      collectTokens(lane);
      collectPowerup(lane);
      const hit = game.auto ? null : lane.mod.collide(lane, p);
      if (hit) {
        hit.lane = lane;
        kill(hit.cause, hit);
        if (p.dead) return;
        // A shield or revive can move the otter; stop processing this frame.
        if (lane !== getLane(logicalRow(p))) return;
      }
    }

    // The Deadline Hawk: stall too long and it strikes. The shadow warns first.
    if (!game.auto) game.stall += dt;
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
    const target = visualRow(p) - game.behind;
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

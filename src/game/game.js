// Game state: lanes, the otter, the camera, scoring and deaths.
// Rendering and UI live elsewhere and listen through the events object.

import { GRID, TUNING } from '../config.js';
import { Pool } from '../core/pool.js';
import { randomSeed } from '../core/rng.js';
import { createGenerator, difficultyAt, newLane } from './generator.js';
import { createPlayer, resetPlayer, tryHop, updatePlayer, logicalRow, visualRow, isHopping } from './player.js';
import { load, save } from '../core/storage.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function createGame({ params, events, input, sfx }) {
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
    gen: null,
    seed: 0,
    hintsShown: new Set(),
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
    game.hintsShown.clear();
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
    if (game.debug.invincible || p.invuln > 0) return;
    p.dead = true;
    p.deathCause = cause;
    p.deathT = 0;
    p.deathCar = hit && hit.car ? hit.car : null;
    p.deathLane = hit && hit.lane ? hit.lane : null;
    p.hopT = -1;
    game.state = 'dying';
    game.shake = 0.3;
    input.setEnabled(false);
    sfx.hit();
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

  function checkHints() {
    const pr = game.player.row;
    for (let r = pr; r <= pr + 4; r++) {
      const lane = getLane(r);
      if (!lane || !lane.first || !lane.mod.hint) continue;
      if (game.hintsShown.has(lane.mod.hint)) continue;
      game.hintsShown.add(lane.mod.hint);
      events.hint(lane.mod.hint);
    }
  }

  game.update = function update(dt) {
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
      // Pulled along by the meeting that caught you.
      if (p.deathCar && p.deathLane) p.x += p.deathLane.speed * p.deathLane.dir * dt;
      if (p.deathT >= TUNING.DEATH_DELAY) finish();
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
    if (landed && p.row > game.maxRow) {
      game.maxRow = p.row;
      game.score = game.maxRow - game.startRow;
      events.score(game);
    }

    // Collisions in the otter's current row.
    const lane = getLane(logicalRow(p));
    if (lane) {
      const hit = lane.mod.collide(lane, p);
      if (hit) {
        hit.lane = lane;
        kill(hit.cause, hit);
      }
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

    ensureLanes();
    checkHints();
  };

  return game;
}

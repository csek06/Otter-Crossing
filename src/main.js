// Entry point: wires the stage, input, game, renderer and screens together.

import { CONTENT } from './content.js';
import { FLAGS, BOOTH } from './config.js';
import { PARAMS } from './core/params.js';
import { createStage } from './core/stage.js';
import { createInput } from './core/input.js';
import { sfx, unlockAudio } from './core/audio.js';
import { loadPalette } from './render/palette.js';
import { createRenderer } from './render/renderer.js';
import { createGame } from './game/game.js';
import { createScreens } from './ui/screens.js';
import { createMusic } from './core/music.js';
import { createWardrobe } from './game/wardrobe.js';
import { recordDaily } from './game/daily.js';

loadPalette();

const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const stage = createStage(document.getElementById('stage'), document.getElementById('game'));

let screens = null;
let game = null;
const booth = FLAGS.BOOTH_MODE || PARAMS.booth;
const wardrobe = createWardrobe();
const music = createMusic();

const input = createInput(stage.canvas, {
  onPause: () => {
    if (!game) return;
    if (game.state === 'playing') pause();
    else if (game.state === 'paused') resume();
  },
  onKey: (e) => {
    if (!PARAMS.debug || !game) return false;
    if (e.code === 'KeyI') { toggleDebug('invincible'); return true; }
    if (e.code === 'KeyH') { toggleDebug('hitboxes'); return true; }
    return false;
  },
});

game = createGame({
  params: PARAMS,
  input,
  sfx,
  reducedMotion: () => reduced.matches,
  events: {
    score: (g) => {
      music.setLanes(g.score);
      if (screens) screens.score(g);
    },
    hint: (id) => screens && CONTENT.hints[id] && screens.hint(CONTENT.hints[id]),
    message: (key) => screens && CONTENT.powerupMessages[key] && screens.hint(CONTENT.powerupMessages[key], 1.8),
    powerup: (mod) => screens && screens.feature(mod.featureId),
    gameOver: (g, info) => {
      // Every run's action items go into the outfit wallet.
      const wallet = wardrobe.earn(g.actionItems);
      const daily = g.mode === 'daily' ? recordDaily(g.score, g.actionItems, g.dailyKey) : null;
      screens.gameOver(g, { ...info, daily, wallet });
    },
    state: (g) => {
      if (g.state === 'playing') music.start(false);
      else music.stop();
      if (!screens) return;
      if (g.state === 'playing') { screens.show(null); screens.hud(true); }
      if (g.state === 'paused') screens.show('pause');
      if (g.state === 'over') { screens.clearHint(); screens.hud(false); screens.show('over'); }
    },
  },
});

function play(mode = 'free') {
  unlockAudio();
  sfx.start();
  music.stop();
  music.step = 0;
  music.setLanes(0);
  game.start(mode);
}
function pause() { game.setPaused(true); }
function resume() { game.setPaused(false); }
function quit() {
  game.state = 'title';
  input.setEnabled(false);
  screens.hud(false);
  screens.clearHint();
  game.reset();
  if (booth) {
    game.startDemo();
    screens.resetOptin();
  }
  screens.show('title');
}

screens = createScreens(
  {
    play, pause, resume, quit,
    outfitChanged: (id) => { game.outfit = id; },
    cleared: () => { game.best = 0; game.outfit = wardrobe.wearing(); },
  },
  { wardrobe, booth },
);
game.outfit = wardrobe.wearing();

const renderer = createRenderer(stage, game, { reducedMotion: () => reduced.matches, debug: PARAMS.debug });
stage.onResize = () => renderer.layout();

// Debug tools.
function toggleDebug(key) {
  game.debug[key] = !game.debug[key];
  const el = document.getElementById(key === 'invincible' ? 'dbg-inv' : 'dbg-hit');
  if (el) el.checked = game.debug[key];
}
if (PARAMS.debug) {
  const panel = document.getElementById('debug');
  panel.hidden = false;
  document.getElementById('dbg-inv').addEventListener('change', (e) => { game.debug.invincible = e.target.checked; });
  document.getElementById('dbg-hit').addEventListener('change', (e) => { game.debug.hitboxes = e.target.checked; });
  window.__otter = { game, input, play, pause, resume, quit, music, wardrobe, screens };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pause();
});

// Booth mode: the attract loop plays behind the title. Tap the scene to start,
// and any screen goes back to the title after a stretch without input.
let lastInput = performance.now();
if (booth) {
  const touch = () => { lastInput = performance.now(); };
  window.addEventListener('pointerdown', touch, true);
  window.addEventListener('keydown', touch, true);
  window.addEventListener('input', touch, true);
  // The title screen covers the scene, so listen on its open area and the sign.
  document.getElementById('screen-title').addEventListener('click', (e) => {
    const open = e.target === e.currentTarget || e.target.closest('.sign');
    if (open && game.state === 'demo' && screens.current() === 'title') play('free');
  });
}
const idleLimit = (PARAMS.idle || BOOTH.IDLE) * 1000;
function checkIdle(now) {
  if (!booth || now - lastInput < idleLimit) return;
  const onTitle = game.state === 'demo' && screens.current() === 'title';
  if (onTitle || screens.current() === 'admin') return;
  lastInput = now;
  quit();
}

if (booth) game.startDemo();
else game.reset();
screens.show('title');

// HUD chips for active and held power-ups.
const chipItems = [];
function updatePowerChips() {
  chipItems.length = 0;
  for (const e of game.active) chipItems.push({ id: e.mod.id, featureId: e.mod.featureId, k: e.max ? e.t / e.max : 1 });
  for (const m of game.held) chipItems.push({ id: m.id, featureId: m.featureId, k: 1, held: true });
  screens.powers(chipItems);
}

// Main loop. Large frame gaps are split into small steps so collisions stay fair.
let last = performance.now();
let fps = 60;
function frame(now) {
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  while (dt > 0) {
    const step = Math.min(dt, 1 / 120);
    game.update(step);
    dt -= step;
  }
  renderer.draw(PARAMS.debug ? fps : null);
  checkIdle(now);
  if (game.state === 'playing' || game.state === 'dying') updatePowerChips();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

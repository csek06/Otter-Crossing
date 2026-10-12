// Entry point: wires the stage, input, game, renderer and screens together.

import { CONTENT } from './content.js';
import { FLAGS, BOOTH, GRID } from './config.js';
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
import { spawnable } from './powerups/registry.js';

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
  screens.show('title');
  game.startDemo();
  if (booth) screens.resetOptin();
}

screens = createScreens(
  {
    play, pause, resume, quit,
    outfitChanged: (id) => { game.outfit = id; },
    musicChanged: () => music.refresh(),
    cleared: () => { game.best = 0; game.outfit = wardrobe.wearing(); },
  },
  { wardrobe, booth },
);
game.outfit = wardrobe.wearing();

const renderer = createRenderer(stage, game, { reducedMotion: () => reduced.matches, debug: PARAMS.debug });
// Put the attract loop otter in the open gap between the title sign and the drawer.
function fitDemoCamera() {
  const title = document.getElementById('screen-title');
  if (title.hidden) return;
  const st = stage.el.getBoundingClientRect();
  const posts = title.querySelector('.sign-posts').getBoundingClientRect();
  const drawer = title.querySelector('.drawer').getBoundingClientRect();
  if (!st.height || drawer.top <= posts.bottom) return;
  const rowH = (stage.w / GRID.VIEW_COLS) * GRID.ROW_SCALE;
  const y = drawer.top - st.top - (drawer.top - posts.bottom) * 0.25;
  game.demoBehind = Math.max(2, (stage.h - y) / rowH);
  if (game.demo) game.behind = game.demoBehind;
}
stage.onResize = () => {
  renderer.layout();
  fitDemoCamera();
};

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

// The attract loop plays behind the title. Tap the scene to start. In booth mode,
// any screen goes back to the title after a stretch without input.
let lastInput = performance.now();
if (booth) {
  const touch = () => { lastInput = performance.now(); };
  window.addEventListener('pointerdown', touch, true);
  window.addEventListener('keydown', touch, true);
  window.addEventListener('input', touch, true);
}
// The title screen covers the scene, so listen on its open area and the sign.
document.getElementById('screen-title').addEventListener('click', (e) => {
  const open = e.target === e.currentTarget || e.target.closest('.sign');
  if (open && game.state === 'demo' && screens.current() === 'title') play('free');
});
const idleLimit = (PARAMS.idle || BOOTH.IDLE) * 1000;
function checkIdle(now) {
  if (!booth || now - lastInput < idleLimit) return;
  const onTitle = game.state === 'demo' && screens.current() === 'title';
  if (onTitle || screens.current() === 'admin') return;
  lastInput = now;
  quit();
}

screens.show('title');
fitDemoCamera();
game.startDemo();

// HUD power-up tracker: one slot for every power-up this run can spawn, showing
// whether it is waiting to be found, active (with time left), held, or used up.
const trackerMods = spawnable();
const trackerItems = trackerMods.map((m) => ({ id: m.id, featureId: m.featureId, state: 'off', k: 0 }));
function updatePowerChips() {
  for (let i = 0; i < trackerMods.length; i++) {
    const m = trackerMods[i];
    const it = trackerItems[i];
    const e = game.active.find((a) => a.mod === m);
    if (e) {
      it.state = 'active';
      it.k = e.max ? e.t / e.max : 1;
    } else if (game.held.includes(m)) {
      it.state = 'held';
      it.k = 1;
    } else {
      it.state = m.oncePerRun && game.used.includes(m.featureId) ? 'used' : 'off';
      it.k = 0;
    }
  }
  screens.powers(trackerItems);
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

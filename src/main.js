// Entry point: wires the stage, input, game, renderer and screens together.

import { CONTENT } from './content.js';
import { PARAMS } from './core/params.js';
import { createStage } from './core/stage.js';
import { createInput } from './core/input.js';
import { sfx, unlockAudio } from './core/audio.js';
import { loadPalette } from './render/palette.js';
import { createRenderer } from './render/renderer.js';
import { createGame } from './game/game.js';
import { createScreens } from './ui/screens.js';

loadPalette();

const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const stage = createStage(document.getElementById('stage'), document.getElementById('game'));

let screens = null;
let game = null;

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
  events: {
    score: (g) => screens && screens.score(g),
    hint: (id) => screens && CONTENT.hints[id] && screens.hint(CONTENT.hints[id]),
    gameOver: (g, info) => screens.gameOver(g, info),
    state: (g) => {
      if (!screens) return;
      if (g.state === 'playing') { screens.show(null); screens.hud(true); }
      if (g.state === 'paused') screens.show('pause');
      if (g.state === 'over') { screens.clearHint(); screens.hud(false); screens.show('over'); }
    },
  },
});

function play() {
  unlockAudio();
  sfx.start();
  game.start();
}
function pause() { game.setPaused(true); }
function resume() { game.setPaused(false); }
function quit() {
  game.state = 'title';
  input.setEnabled(false);
  screens.hud(false);
  screens.clearHint();
  game.reset();
  screens.show('title');
}

screens = createScreens({ play, pause, resume, quit });

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
  window.__otter = { game, input, play, pause, resume, quit };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pause();
});

game.reset();
screens.show('title');

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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

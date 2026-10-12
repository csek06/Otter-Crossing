// Tap to hop forward, swipe left, right or back. Arrow keys and WASD on desktop.
// Moves go into a short buffer so rapid taps queue cleanly.

import { TUNING } from '../config.js';

export const DIR = {
  up: { dx: 0, dy: 1, name: 'up' },
  down: { dx: 0, dy: -1, name: 'down' },
  left: { dx: -1, dy: 0, name: 'left' },
  right: { dx: 1, dy: 0, name: 'right' },
};

const KEYS = {
  ArrowUp: 'up', KeyW: 'up', Space: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function createInput(target, handlers) {
  const queue = [];
  let enabled = false;
  let touch = null;

  function push(name) {
    if (!enabled) return;
    if (queue.length >= TUNING.INPUT_BUFFER) return;
    queue.push(DIR[name]);
    if (handlers.onInput) handlers.onInput();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (handlers.onPause) handlers.onPause();
      return;
    }
    if (handlers.onKey && handlers.onKey(e)) return;
    const name = KEYS[e.code];
    if (!name || !enabled) return;
    // Do not steal keys from focused buttons or inputs.
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return;
    e.preventDefault();
    if (e.repeat) return;
    push(name);
  });

  target.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
    if (target.setPointerCapture) {
      try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    e.preventDefault();
  });

  function swipeName(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  target.addEventListener('pointermove', (e) => {
    if (!touch || touch.id !== e.pointerId || touch.fired) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    // Fire as soon as the swipe is clear, without waiting for release.
    if (Math.hypot(dx, dy) >= TUNING.SWIPE_MIN) {
      touch.fired = true;
      push(swipeName(dx, dy));
    }
  });

  const end = (e) => {
    if (!touch || touch.id !== e.pointerId) return;
    if (!touch.fired) push('up');
    touch = null;
  };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', () => { touch = null; });

  return {
    queue,
    next: () => queue.shift(),
    clear: () => { queue.length = 0; },
    setEnabled: (v) => { enabled = v; if (!v) { queue.length = 0; touch = null; } },
  };
}

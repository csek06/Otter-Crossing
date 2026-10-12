// The stage fills the window. Phones in portrait see the 9 columns edge to edge;
// wider screens see the world carry on past the playfield (see tileSize).
// The UI keeps a phone-width scale: --stage-w is the width of a 9:16 column.
// Canvas backing store capped at 2x DPR and about 5 million pixels.

import { GRID } from '../config.js';

const ASPECT = 9 / 16;
const MAX_PIXELS = 5e6;

// Tile size for a w by h stage: 10 tiles across, unless that would show fewer
// than MIN_ROWS rows.
export function tileSize(w, h) {
  return Math.min(w / GRID.VIEW_COLS, h / (GRID.MIN_ROWS * GRID.ROW_SCALE));
}

export function createStage(stageEl, canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = { el: stageEl, canvas, ctx, w: 0, h: 0, dpr: 1, onResize: null };

  function fit() {
    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);
    stageEl.style.width = w + 'px';
    stageEl.style.height = h + 'px';
    stageEl.style.setProperty('--stage-w', Math.floor(Math.min(w, h * ASPECT)) + 'px');
    stageEl.classList.toggle('wide', w > h * 0.75);
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    stage.w = w;
    stage.h = h;
    stage.dpr = dpr;
    if (stage.onResize) stage.onResize();
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();
  stage.fit = fit;
  return stage;
}

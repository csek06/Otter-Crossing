// Portrait 9:16 stage, letterboxed to fit any screen. Canvas backing store capped at 2x DPR.

const ASPECT = 9 / 16;

export function createStage(stageEl, canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = { el: stageEl, canvas, ctx, w: 0, h: 0, dpr: 1, onResize: null };

  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let w = vw;
    let h = vw / ASPECT;
    if (h > vh) {
      h = vh;
      w = vh * ASPECT;
    }
    w = Math.floor(w);
    h = Math.floor(h);
    stageEl.style.width = w + 'px';
    stageEl.style.height = h + 'px';
    stageEl.style.setProperty('--stage-w', w + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

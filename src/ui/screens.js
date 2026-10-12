// DOM screens over the canvas: title, how to play, pause, game over, plus the HUD
// and hint toast. All text comes from content.js.

import { CONTENT } from '../content.js';
import { FLAGS } from '../config.js';
import { isMuted, setMuted } from '../core/audio.js';

const $ = (id) => document.getElementById(id);

function lookup(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONTENT);
}

export function createScreens(handlers) {
  // Fill copy.
  document.querySelectorAll('[data-copy]').forEach((el) => {
    const s = lookup(el.dataset.copy);
    if (typeof s === 'string') el.textContent = s;
  });
  document.querySelectorAll('[data-copy-label]').forEach((el) => {
    const s = lookup(el.dataset.copyLabel);
    if (typeof s === 'string') el.setAttribute('aria-label', s);
  });
  const list = $('howto-list');
  for (const line of CONTENT.howTo.lines) {
    const li = document.createElement('li');
    li.textContent = line;
    list.appendChild(li);
  }
  const tryBtn = $('btn-try');
  tryBtn.textContent = CONTENT.links.tryOtter.label;
  tryBtn.href = CONTENT.links.tryOtter.url;
  tryBtn.hidden = FLAGS.AUDIENCE !== 'external';

  const screens = {
    title: $('screen-title'),
    howto: $('screen-howto'),
    pause: $('screen-pause'),
    over: $('screen-over'),
  };
  const hud = $('hud');

  function show(name) {
    for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
    const el = screens[name];
    if (el) {
      const first = el.querySelector('.btn-primary');
      if (first) first.focus({ preventScroll: true });
    } else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  function syncMute() {
    const m = isMuted();
    document.querySelectorAll('.btn-mute').forEach((b) => {
      b.textContent = m ? CONTENT.game.muteOff : CONTENT.game.muteOn;
      b.setAttribute('aria-pressed', String(m));
    });
  }
  syncMute();

  document.querySelectorAll('.btn-mute').forEach((b) =>
    b.addEventListener('click', () => {
      setMuted(!isMuted());
      syncMute();
    }),
  );
  $('btn-play').addEventListener('click', handlers.play);
  $('btn-again').addEventListener('click', handlers.play);
  $('btn-restart').addEventListener('click', handlers.play);
  $('btn-howto').addEventListener('click', () => show('howto'));
  $('btn-howto-back').addEventListener('click', () => show('title'));
  $('btn-resume').addEventListener('click', handlers.resume);
  $('btn-quit').addEventListener('click', handlers.quit);
  $('btn-over-quit').addEventListener('click', handlers.quit);
  $('btn-pause').addEventListener('click', handlers.pause);

  let toastTimer = 0;
  const toast = $('toast');

  return {
    show,
    hud(visible) {
      hud.hidden = !visible;
    },
    score(game) {
      $('hud-lanes').textContent = String(game.score);
      $('hud-items').textContent = String(game.actionItems);
    },
    hint(text, seconds = 2.2) {
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), seconds * 1000);
    },
    clearHint() {
      clearTimeout(toastTimer);
      toast.classList.remove('show');
    },
    gameOver(game, { cause, isBest }) {
      const d = CONTENT.deaths[cause] || CONTENT.deaths.meeting;
      $('over-cause').textContent = d.title;
      $('over-tip').textContent = d.tip;
      $('over-score').textContent = String(game.score);
      $('over-best').textContent = String(game.best);
      $('over-newbest').hidden = !isBest;
    },
  };
}

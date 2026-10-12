// DOM screens over the canvas: title, how to play, pause, game over with the
// feature recap and initials entry, the leaderboard, outfits, the booth admin
// screen, plus the HUD and toasts. All text comes from content.js.

import { CONTENT } from '../content.js';
import { FLAGS, BOOTH } from '../config.js';
import { isMuted, setMuted } from '../core/audio.js';
import { iconSvg } from '../render/icons.js';
import { topScores, qualifies, addScore, lastInitials, clearScores } from '../game/leaderboard.js';
import { OUTFITS } from '../game/wardrobe.js';
import { shareText } from '../game/daily.js';
import { signups, addSignup, clearSignups, toCsv, validEmail } from '../game/booth.js';
import { drawOtter } from '../render/otter.js';

const $ = (id) => document.getElementById(id);
const C = CONTENT.game;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function lookup(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONTENT);
}

// Fill {name} slots in a copy string.
function fmt(s, vars) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// handlers: play, daily, pause, resume, quit, and optional saved, outfitChanged, cleared.
// opts: { wardrobe, booth }
export function createScreens(handlers, { wardrobe, booth = false } = {}) {
  // Fill copy.
  document.querySelectorAll('[data-copy]').forEach((e) => {
    const s = lookup(e.dataset.copy);
    if (typeof s === 'string') e.textContent = s;
  });
  document.querySelectorAll('[data-copy-label]').forEach((e) => {
    const s = lookup(e.dataset.copyLabel);
    if (typeof s === 'string') e.setAttribute('aria-label', s);
  });
  const list = $('howto-list');
  for (const line of CONTENT.howTo.lines) list.appendChild(el('li', null, line));
  const tryBtn = $('btn-try');
  tryBtn.textContent = CONTENT.links.tryOtter.label;
  tryBtn.href = CONTENT.links.tryOtter.url;
  tryBtn.hidden = FLAGS.AUDIENCE !== 'external';
  // A booth device is shared, so the daily challenge stays off the title there.
  if (booth) {
    $('btn-daily').hidden = true;
    $('title-modes').style.gridTemplateColumns = '1fr';
  }
  const privacy = $('optin-privacy');
  privacy.textContent = CONTENT.booth.privacyLabel;
  privacy.href = CONTENT.booth.privacyUrl;

  const screens = {
    title: $('screen-title'),
    howto: $('screen-howto'),
    pause: $('screen-pause'),
    over: $('screen-over'),
    board: $('screen-board'),
    outfits: $('screen-outfits'),
    admin: $('screen-admin'),
  };
  const hud = $('hud');
  let current = null;
  let boardFrom = 'title';

  function show(name) {
    current = name;
    for (const [k, e] of Object.entries(screens)) e.hidden = k !== name;
    const e = screens[name];
    if (e) {
      const drawer = e.querySelector('.drawer');
      if (drawer) drawer.scrollTop = 0;
      const first = e.querySelector('.initials:not([hidden]) .slot-letter') || e.querySelector('.btn-primary');
      if (first) first.focus({ preventScroll: true });
    } else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  // Sound toggles: the title has an icon button, pause has a text button.
  function syncMute() {
    const m = isMuted();
    document.querySelectorAll('.btn-mute').forEach((b) => {
      if (!b.classList.contains('btn-icon')) b.textContent = m ? C.muteOff : C.muteOn;
      b.setAttribute('aria-pressed', String(!m));
      b.classList.toggle('is-muted', m);
    });
  }
  syncMute();
  document.querySelectorAll('.btn-mute').forEach((b) =>
    b.addEventListener('click', () => {
      setMuted(!isMuted());
      syncMute();
    }),
  );

  $('btn-play').addEventListener('click', () => handlers.play('free'));
  $('btn-daily').addEventListener('click', () => handlers.play('daily'));
  $('btn-again').addEventListener('click', () => handlers.play(lastMode));
  $('btn-restart').addEventListener('click', () => handlers.play(lastMode));
  $('btn-outfits').addEventListener('click', openOutfits);
  $('btn-outfits-back').addEventListener('click', () => show('title'));
  $('btn-admin-back').addEventListener('click', () => show('title'));
  let lastMode = 'free';
  $('btn-howto').addEventListener('click', () => show('howto'));
  $('btn-howto-back').addEventListener('click', () => show('title'));
  $('btn-resume').addEventListener('click', handlers.resume);
  $('btn-quit').addEventListener('click', handlers.quit);
  $('btn-over-quit').addEventListener('click', handlers.quit);
  $('btn-pause').addEventListener('click', handlers.pause);
  $('btn-board').addEventListener('click', () => openBoard('title'));
  $('btn-over-board').addEventListener('click', () => openBoard('over'));
  $('btn-board-back').addEventListener('click', () => show(boardFrom));

  // Leaderboard.
  let highlightId = null;
  function openBoard(from) {
    boardFrom = from;
    const ol = $('board-list');
    ol.textContent = '';
    const scores = topScores();
    $('board-empty').hidden = scores.length > 0;
    scores.forEach((s, i) => {
      const li = el('li', 'board-row' + (s.id === highlightId ? ' is-new' : ''));
      li.appendChild(el('span', 'board-rank', String(i + 1)));
      li.appendChild(el('span', 'board-initials', s.initials));
      li.appendChild(el('span', 'board-items', `${s.items || 0} ${C.itemsShort}`));
      li.appendChild(el('span', 'board-score', String(s.score)));
      ol.appendChild(li);
    });
    show('board');
  }

  // Initials entry: three letter slots with up and down buttons. Typing works too.
  const form = $('initials');
  const slotsEl = form.querySelector('.initials-slots');
  const letters = [0, 0, 0];
  const slotEls = [];
  for (let i = 0; i < 3; i++) {
    const slot = el('div', 'slot');
    const up = el('button', 'slot-btn');
    up.type = 'button';
    up.setAttribute('aria-label', `${C.nextLetter}, ${C.letter} ${i + 1}`);
    up.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12l5-5 5 5"/></svg>';
    const letter = el('button', 'slot-letter');
    letter.type = 'button';
    const down = el('button', 'slot-btn');
    down.type = 'button';
    down.setAttribute('aria-label', `${C.prevLetter}, ${C.letter} ${i + 1}`);
    down.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>';
    up.addEventListener('click', () => bump(i, 1));
    down.addEventListener('click', () => bump(i, -1));
    letter.addEventListener('click', () => bump(i, 1));
    letter.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { bump(i, 1); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'ArrowDown') { bump(i, -1); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'ArrowRight' && i < 2) { slotEls[i + 1].letter.focus(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && i > 0) { slotEls[i - 1].letter.focus(); e.preventDefault(); }
      else if (/^[a-z]$/i.test(e.key)) {
        letters[i] = LETTERS.indexOf(e.key.toUpperCase());
        render();
        if (i < 2) slotEls[i + 1].letter.focus();
        else $('btn-save').focus();
        e.preventDefault();
      }
    });
    slot.append(up, letter, down);
    slotsEl.appendChild(slot);
    slotEls.push({ letter });
  }
  function bump(i, d) {
    letters[i] = (letters[i] + d + 26) % 26;
    render();
  }
  function render() {
    slotEls.forEach((s, i) => {
      s.letter.textContent = LETTERS[letters[i]];
      s.letter.setAttribute('aria-label', `${C.letter} ${i + 1}: ${LETTERS[letters[i]]}`);
    });
  }
  let pending = null;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pending) return;
    highlightId = addScore(letters.map((n) => LETTERS[n]).join(''), pending.score, pending.items);
    pending = null;
    form.hidden = true;
    $('btn-again').focus({ preventScroll: true });
    if (handlers.saved) handlers.saved();
  });

  // Outfits: a preview of each, drawn with the same code as the game otter.
  function drawPreview(canvas, id) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || 60;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    const t = size * 0.92;
    const v = { tile: t, rowH: t * 0.9, line: Math.max(1, t / 40) };
    drawOtter(c, size / 2, size * 0.9, v, { facing: 'down', lift: 0, sx: 1, sy: 1, alpha: 1, outfit: id });
  }
  function openOutfits() {
    const O = CONTENT.outfits;
    $('wallet-num').textContent = String(wardrobe.wallet());
    const ul = $('outfit-list');
    ul.textContent = '';
    for (const o of OUTFITS) {
      const copy = O.items[o.id];
      const wearing = wardrobe.wearing() === o.id;
      const li = el('li', 'outfit' + (wearing ? ' is-wearing' : ''));
      const cv = el('canvas', 'outfit-preview');
      cv.setAttribute('aria-hidden', 'true');
      const text = el('div', 'outfit-text');
      text.append(el('strong', 'outfit-name', copy.name), el('p', 'outfit-line', copy.line));
      const btn = el('button', 'btn');
      btn.type = 'button';
      btn.dataset.outfit = o.id;
      if (wearing) {
        btn.textContent = O.wearing;
        btn.classList.add('btn-wearing');
        btn.setAttribute('aria-pressed', 'true');
      } else if (wardrobe.owns(o.id)) {
        btn.textContent = O.wear;
        btn.setAttribute('aria-label', `${O.wear}: ${copy.name}`);
        btn.addEventListener('click', () => { wardrobe.wear(o.id); changed(o.id); });
      } else if (wardrobe.wallet() >= o.cost) {
        btn.textContent = fmt(O.buy, { cost: o.cost });
        btn.setAttribute('aria-label', `${fmt(O.buy, { cost: o.cost })}: ${copy.name}`);
        btn.addEventListener('click', () => { if (wardrobe.buy(o.id)) changed(o.id); });
      } else {
        btn.textContent = fmt(O.need, { more: o.cost - wardrobe.wallet() });
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('aria-label', `${copy.name}: ${fmt(O.need, { more: o.cost - wardrobe.wallet() })}`);
      }
      li.append(cv, text, btn);
      ul.appendChild(li);
      drawPreview(cv, o.id);
    }
    show('outfits');
  }
  function changed(id) {
    if (handlers.outfitChanged) handlers.outfitChanged(id);
    openOutfits();
    const b = $('outfit-list').querySelector(`[data-outfit="${id}"]`);
    if (b) b.focus({ preventScroll: true });
  }

  // Daily challenge result for Slack.
  let shareString = '';
  $('btn-copy').addEventListener('click', async () => {
    const msg = $('share-msg');
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareString);
        ok = true;
      }
    } catch { /* fall through */ }
    if (!ok) {
      // Older browsers and some file:// setups: copy from a selection.
      const ta = el('textarea');
      ta.value = shareString;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    msg.textContent = ok ? CONTENT.daily.copied : CONTENT.daily.copyManual;
  });

  // Booth sign-up. The box starts unticked and nothing is saved unless it is ticked.
  const optin = $('optin');
  const optinMsg = $('optin-msg');
  let optinRun = null;
  function resetOptin() {
    $('optin-email').value = '';
    $('optin-consent').checked = false;
    optinMsg.textContent = '';
  }
  optin.addEventListener('input', () => { optinMsg.textContent = ''; });
  optin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('optin-email').value;
    if (!validEmail(email)) { optinMsg.textContent = CONTENT.booth.invalid; return; }
    if (!$('optin-consent').checked) { optinMsg.textContent = CONTENT.booth.needConsent; return; }
    addSignup({ email, consent: CONTENT.booth.consent, score: optinRun ? optinRun.score : 0, items: optinRun ? optinRun.items : 0 });
    resetOptin();
    optinMsg.textContent = CONTENT.booth.thanks;
    $('btn-optin').hidden = true;
  });

  // Hidden admin screen: hold the logo for 3 seconds, or press Alt+Shift+O on the title.
  const A = CONTENT.admin;
  function openAdmin() {
    $('admin-signups').textContent = fmt(A.signups, { n: signups().length });
    $('admin-scores').textContent = fmt(A.scores, { n: topScores().length });
    $('admin-msg').textContent = '';
    disarm();
    show('admin');
  }
  if (booth) {
    const logo = document.querySelector('.logo-slot');
    let holdTimer = 0;
    const cancel = () => clearTimeout(holdTimer);
    logo.addEventListener('pointerdown', () => { cancel(); holdTimer = setTimeout(openAdmin, BOOTH.ADMIN_HOLD * 1000); });
    logo.addEventListener('pointerup', cancel);
    logo.addEventListener('pointerleave', cancel);
    logo.addEventListener('pointercancel', cancel);
    logo.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyO' && current === 'title') { e.preventDefault(); openAdmin(); }
    });
  }
  // Clearing needs a second tap within 3 seconds.
  let armed = null;
  let armTimer = 0;
  function disarm() {
    clearTimeout(armTimer);
    armed = null;
    $('btn-admin-clear').textContent = A.clearSignups;
    $('btn-admin-clear-scores').textContent = A.clearScores;
  }
  function confirmThen(btn, fn) {
    if (armed === btn) {
      disarm();
      fn();
      openAdmin();
      $('admin-msg').textContent = A.cleared;
      btn.focus({ preventScroll: true });
      return;
    }
    disarm();
    armed = btn;
    btn.textContent = A.confirm;
    armTimer = setTimeout(disarm, 3000);
  }
  $('btn-admin-clear').addEventListener('click', (e) => confirmThen(e.currentTarget, clearSignups));
  $('btn-admin-clear-scores').addEventListener('click', (e) => confirmThen(e.currentTarget, () => {
    clearScores();
    wardrobe.reset();
    if (handlers.cleared) handlers.cleared();
  }));
  $('btn-admin-export').addEventListener('click', () => {
    const name = `otter-crossing-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([toCsv(signups())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('admin-msg').textContent = fmt(A.exported, { file: name });
  });

  // Hint toast and feature card.
  let toastTimer = 0;
  const toast = $('toast');
  let featureTimer = 0;
  const feature = $('feature-toast');

  // HUD power-up chips with a timer ring.
  const powersEl = $('hud-powers');
  const chips = new Map();
  const RING = 2 * Math.PI * 16;

  return {
    show,
    current: () => current,
    resetOptin,
    hud(visible) {
      hud.hidden = !visible;
      if (!visible) this.powers([]);
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
      clearTimeout(featureTimer);
      feature.classList.remove('show');
    },
    // Feature name and tagline for about 1.5 seconds on pickup. Play continues.
    feature(featureId, seconds = 1.5) {
      const f = CONTENT.features[featureId];
      if (!f) return;
      $('ft-icon').innerHTML = iconSvg(featureId);
      $('ft-name').textContent = f.name;
      $('ft-tagline').textContent = f.tagline;
      feature.classList.add('show');
      clearTimeout(featureTimer);
      featureTimer = setTimeout(() => feature.classList.remove('show'), seconds * 1000);
    },
    // items: [{ id, featureId, k (0 to 1 remaining), held }]
    powers(items) {
      const seen = new Set();
      for (const it of items) {
        seen.add(it.id);
        let chip = chips.get(it.id);
        if (!chip) {
          const f = CONTENT.features[it.featureId];
          chip = el('div', 'hud-power');
          chip.setAttribute('role', 'img');
          chip.setAttribute('aria-label', f ? f.name : it.id);
          chip.innerHTML = `<svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="ring-bg" cx="20" cy="20" r="16"/><circle class="ring-fg" cx="20" cy="20" r="16" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>${iconSvg(it.featureId, 'hud-power-icon')}`;
          chip.fg = chip.querySelector('.ring-fg');
          powersEl.appendChild(chip);
          chips.set(it.id, chip);
        }
        if (chip.classList.contains('is-held') !== !!it.held) {
          const f = CONTENT.features[it.featureId];
          const name = f ? f.name : it.id;
          chip.setAttribute('aria-label', it.held ? `${name}, ${C.held}` : name);
        }
        chip.classList.toggle('is-held', !!it.held);
        const off = RING * (1 - Math.max(0, Math.min(1, it.k)));
        if (Math.abs((chip.lastOff || 0) - off) > 0.2) {
          chip.fg.setAttribute('stroke-dashoffset', off.toFixed(1));
          chip.lastOff = off;
        }
      }
      for (const [id, chip] of chips) {
        if (!seen.has(id)) {
          chip.remove();
          chips.delete(id);
        }
      }
    },
    gameOver(game, { cause, isBest, daily, wallet }) {
      const d = CONTENT.deaths[cause] || CONTENT.deaths.meeting;
      lastMode = game.mode;
      $('over-cause').textContent = d.title;
      $('over-tip').textContent = d.tip;
      $('over-score').textContent = String(game.score);
      $('over-best').textContent = String(daily ? daily.best : game.best);
      $('over-best-label').textContent = daily ? C.todayBest : C.best;
      $('over-items').textContent = String(game.actionItems);
      $('over-newbest').hidden = !(daily ? daily.isBest : isBest);
      $('over-wallet').textContent = fmt(C.walletLine, { n: wallet });

      // Daily challenge: a tag and a result to paste in Slack.
      $('over-mode').hidden = !daily;
      $('share').hidden = !daily;
      $('share-msg').textContent = '';
      if (daily) {
        $('over-mode').textContent = fmt(CONTENT.daily.tag, { date: game.dailyKey });
        shareString = shareText(CONTENT.daily.share, game.dailyKey, game.score, game.actionItems);
        $('share-text').textContent = shareString;
      }

      // Booth sign-up.
      optin.hidden = !booth;
      if (booth) {
        resetOptin();
        $('btn-optin').hidden = false;
        optinRun = { score: game.score, items: game.actionItems };
      }

      // Initials, if a free run made the local top 10.
      if (!daily && qualifies(game.score)) {
        pending = { score: game.score, items: game.actionItems };
        const init = lastInitials();
        for (let i = 0; i < 3; i++) letters[i] = Math.max(0, LETTERS.indexOf(init[i] || 'A'));
        render();
        form.hidden = false;
      } else {
        pending = null;
        form.hidden = true;
      }

      // Features you used, each with its description and a Learn more link.
      const ul = $('recap-list');
      ul.textContent = '';
      for (const id of game.used) {
        const f = CONTENT.features[id];
        if (!f) continue;
        const li = el('li', 'recap-item');
        const icon = el('span', 'recap-icon');
        icon.innerHTML = iconSvg(id);
        const body = el('div', 'recap-body');
        body.appendChild(el('strong', 'recap-name', f.name));
        body.appendChild(el('p', 'recap-desc', f.description));
        const a = el('a', 'recap-link', C.learnMore);
        a.href = f.helpUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', `${C.learnMore}: ${f.name}`);
        body.appendChild(a);
        li.append(icon, body);
        ul.appendChild(li);
      }
      $('recap-empty').hidden = game.used.length > 0;
    },
  };
}

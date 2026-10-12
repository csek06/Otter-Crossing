// DOM screens over the canvas: title, how to play, pause, game over with the
// feature recap and initials entry, the leaderboard, outfits, the booth admin
// screen, plus the HUD and toasts. All text comes from content.js.

import { CONTENT } from '../content.js';
import { FLAGS, BOOTH } from '../config.js';
import { isMuted, setMuted, isMusicOn, setMusicOn } from '../core/audio.js';
import { iconSvg } from '../render/icons.js';
import { topScores, qualifies, addScore, lastInitials, clearScores } from '../game/leaderboard.js';
import { OUTFITS } from '../game/wardrobe.js';
import { shareText, dateKey } from '../game/daily.js';
import { signups, addSignup, clearSignups, toCsv, validEmail } from '../game/booth.js';
import { drawOtter } from '../render/otter.js';
import { load, save } from '../core/storage.js';

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
// online: the client from src/online/client.js (may be disabled).
// eventCode: () => the event code for this device, or null.
export function createScreens(handlers, { wardrobe, booth = false, online = null, eventCode = () => null } = {}) {
  const ON = CONTENT.online;
  const live = !!(online && online.enabled);
  // Fill copy.
  document.querySelectorAll('[data-copy]').forEach((e) => {
    const s = lookup(e.dataset.copy);
    if (typeof s === 'string') e.textContent = s;
  });
  document.querySelectorAll('[data-copy-label]').forEach((e) => {
    const s = lookup(e.dataset.copyLabel);
    if (typeof s === 'string') e.setAttribute('aria-label', s);
  });
  // One copy of the logo mark in the page; the explainer borrows it.
  const mark = document.querySelector('.logo-slot svg');
  if (mark) document.querySelectorAll('.learn-logo').forEach((e) => e.appendChild(mark.cloneNode(true)));
  const list = $('howto-list');
  for (const line of CONTENT.howTo.lines) list.appendChild(el('li', null, line));
  const tryBtn = $('btn-try');
  tryBtn.textContent = CONTENT.links.tryOtter.label;
  tryBtn.href = CONTENT.links.tryOtter.url;
  tryBtn.hidden = FLAGS.AUDIENCE !== 'external';
  // A booth device is shared, so the daily challenge stays off the title there.
  if (booth) {
    $('btn-daily').hidden = true;
    $('title-modes').style.gridTemplateColumns = '1fr auto';
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

  // Music toggles, same pattern as sound. Muting sound silences music too.
  function syncMusic() {
    const on = isMusicOn();
    document.querySelectorAll('.btn-music').forEach((b) => {
      if (!b.classList.contains('btn-icon')) b.textContent = on ? C.musicOn : C.musicOff;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-off', !on);
    });
  }
  syncMusic();
  document.querySelectorAll('.btn-music').forEach((b) =>
    b.addEventListener('click', () => {
      setMusicOn(!isMusicOn());
      syncMusic();
      if (handlers.musicChanged) handlers.musicChanged();
    }),
  );

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

  // Leaderboards: this device, plus the online boards when the build has them.
  let highlightId = null;
  let boardTab = 'device';
  let boardLoad = 0; // ignore answers for a tab that is no longer showing
  let eventName = null;
  function tabs() {
    const list = [['device', ON.tabDevice]];
    if (!live) return list;
    list.push(['global', ON.tabGlobal], ['daily', ON.tabDaily]);
    if (eventCode()) list.push(['event', eventName || ON.tabEvent]);
    if (!booth && online.company) list.push(['company', ON.tabCompany]);
    return list;
  }
  function renderTabs() {
    const box = $('board-tabs');
    const list = tabs();
    const headings = { device: C.leaderboardHeading, global: ON.headingGlobal, daily: ON.headingDaily, event: fmt(ON.headingEvent, { event: eventName || ON.tabEvent }), company: ON.headingCompany };
    $('board-heading').textContent = headings[boardTab] || C.leaderboardHeading;
    box.hidden = list.length < 2;
    box.textContent = '';
    for (const [id, label] of list) {
      const b = el('button', 'board-tab', label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.tab = id;
      b.setAttribute('aria-selected', String(id === boardTab));
      b.addEventListener('click', () => { boardTab = id; renderTabs(); loadTab(); });
      box.appendChild(b);
    }
  }
  function boardStatus(text) {
    const p = $('board-status');
    p.textContent = text || '';
    p.hidden = !text;
  }
  function renderRows(rows) {
    const ol = $('board-list');
    ol.textContent = '';
    rows.forEach((s, i) => {
      const you = s.is_you || (s.id != null && s.id === highlightId);
      const li = el('li', 'board-row' + (you ? ' is-new' : ''));
      li.appendChild(el('span', 'board-rank', String(s.rank || i + 1)));
      const who = el('span', 'board-initials', s.initials);
      if (s.is_you) who.appendChild(el('span', 'board-you', ON.you));
      li.appendChild(who);
      li.appendChild(el('span', 'board-items', `${s.items || 0} ${C.itemsShort}`));
      li.appendChild(el('span', 'board-score', String(s.score)));
      ol.appendChild(li);
    });
    // Long online boards: bring your own row into view.
    const mine = ol.querySelector('.board-you');
    if (mine && mine.closest('li').scrollIntoView) mine.closest('li').scrollIntoView({ block: 'nearest' });
  }
  function showAccount() {
    const sess = online.session();
    $('board-account').hidden = !sess;
    if (sess) $('board-account-text').textContent = fmt(ON.signedIn, { email: sess.email || '' });
    $('account-msg').textContent = '';
  }
  async function loadTab() {
    const load = ++boardLoad;
    $('board-empty').hidden = true;
    $('board-signin').hidden = true;
    $('board-account').hidden = true;
    renderRows([]);
    if (boardTab === 'device') {
      boardStatus('');
      const scores = topScores();
      renderRows(scores);
      $('board-empty').textContent = C.noScores;
      $('board-empty').hidden = scores.length > 0;
      return;
    }
    if (boardTab === 'company') {
      if (!online.signedIn()) { boardStatus(''); openSignin(); return; }
      showAccount();
      if (!online.domain()) { boardStatus(ON.personal); return; }
    }
    boardStatus(ON.loading);
    const key = boardTab === 'daily' ? dateKey() : boardTab === 'event' ? eventCode() : null;
    try {
      const rows = await online.board(boardTab, key);
      if (load !== boardLoad) return;
      boardStatus(boardTab === 'company' ? fmt(ON.companyHeading, { domain: online.domain() }) : '');
      renderRows(Array.isArray(rows) ? rows : []);
      $('board-empty').textContent = ON.emptyOnline;
      $('board-empty').hidden = Array.isArray(rows) && rows.length > 0;
    } catch {
      if (load === boardLoad) boardStatus(ON.unreachable);
    }
  }
  function fetchEventName() {
    const code = eventCode();
    if (!live || !code || eventName) return;
    online.eventInfo(code).then((info) => {
      if (info && info.name && code === eventCode()) { eventName = info.name; if (current === 'board') renderTabs(); }
    });
  }
  fetchEventName();
  function openBoard(from) {
    boardFrom = from;
    if (!tabs().some(([id]) => id === boardTab)) boardTab = 'device';
    renderTabs();
    loadTab();
    show('board');
    fetchEventName();
  }

  // Work email sign-in for the company board: email, then a one-time code.
  let signinEmail = '';
  function openSignin() {
    $('board-signin').hidden = false;
    $('signin-code-field').hidden = !signinEmail;
    $('btn-signin').textContent = signinEmail ? ON.verify : ON.sendCode;
    $('signin-msg').textContent = '';
  }
  if (live) {
    $('board-signin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('signin-msg');
      const btn = $('btn-signin');
      if (!signinEmail) {
        const email = $('signin-email').value.trim();
        if (!validEmail(email)) { msg.textContent = ON.badEmail; return; }
        btn.disabled = true;
        try {
          await online.sendCode(email);
          signinEmail = email;
          openSignin();
          msg.textContent = ON.codeSent;
          $('signin-code').focus();
        } catch {
          msg.textContent = ON.sendFailed;
        } finally {
          btn.disabled = false;
        }
        return;
      }
      const code = $('signin-code').value.replace(/\s/g, '');
      if (!/^\d{6,10}$/.test(code)) { msg.textContent = ON.badCode; return; }
      btn.disabled = true;
      try {
        await online.verifyCode(signinEmail, code);
        signinEmail = '';
        $('signin-code').value = '';
        loadTab();
      } catch {
        msg.textContent = ON.badCode;
      } finally {
        btn.disabled = false;
      }
    });
    $('signin-email').addEventListener('input', () => {
      if (signinEmail) { signinEmail = ''; openSignin(); }
    });
    $('btn-signout').addEventListener('click', async () => {
      await online.signOut();
      loadTab();
    });
    let forgetArmed = 0;
    $('btn-forget').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (!forgetArmed) {
        btn.textContent = ON.forgetConfirm;
        forgetArmed = setTimeout(() => { forgetArmed = 0; btn.textContent = ON.forget; }, 3000);
        return;
      }
      clearTimeout(forgetArmed);
      forgetArmed = 0;
      btn.textContent = ON.forget;
      try {
        await online.forget();
        loadTab();
        boardStatus(ON.forgotten);
      } catch {
        $('account-msg').textContent = ON.unreachable;
      }
    });
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
    const initials = letters.map((n) => LETTERS[n]).join('');
    if (pending.local) highlightId = addScore(initials, pending.score, pending.items);
    if (pending.online) postOnline(initials, pending);
    pending = null;
    form.hidden = true;
    $('btn-again').focus({ preventScroll: true });
    if (handlers.saved) handlers.saved();
  });

  // Posts the run to the online boards and says where it placed.
  async function postOnline(initials, run) {
    const msg = $('post-msg');
    const post = $('post-online').checked;
    save('online.post', post);
    if (!post) return;
    const company = !$('post-company-row').hidden && $('post-company').checked;
    if (!$('post-company-row').hidden) save('online.postCompany', company);
    msg.textContent = ON.posting;
    try {
      const r = await online.submit({ initials, score: run.score, items: run.items, company });
      if (r && r.queued) { msg.textContent = ON.queued; return; }
      const parts = [];
      if (r.global) parts.push(fmt(ON.rankGlobal, { n: r.global }));
      if (r.daily) parts.push(fmt(ON.rankDaily, { n: r.daily }));
      if (r.event) parts.push(fmt(ON.rankEvent, { n: r.event, event: eventName || eventCode() }));
      if (r.company) parts.push(fmt(ON.rankCompany, { n: r.company, domain: online.domain() }));
      msg.textContent = parts.length ? fmt(ON.posted, { ranks: parts.join(', ') }) : '';
    } catch {
      msg.textContent = ON.failed;
    }
  }

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
    $('admin-event').value = eventCode() || '';
    $('admin-event-form').hidden = !live;
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
  $('admin-event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('admin-event').value.trim().toLowerCase();
    if (code && !/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) { $('admin-msg').textContent = A.eventBad; return; }
    if (handlers.setEvent) handlers.setEvent(code || null);
    eventName = null;
    fetchEventName();
    $('admin-msg').textContent = code ? fmt(A.eventSaved, { code }) : A.eventCleared;
  });
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
    // Feature name and tagline for about 5.5 seconds on pickup. Play continues.
    feature(featureId, seconds = 5.5) {
      const f = CONTENT.features[featureId];
      if (!f) return;
      $('ft-icon').innerHTML = iconSvg(featureId);
      $('ft-name').textContent = f.name;
      $('ft-tagline').textContent = f.tagline;
      feature.classList.add('show');
      clearTimeout(featureTimer);
      featureTimer = setTimeout(() => feature.classList.remove('show'), seconds * 1000);
    },
    // First pickup of a power-up this run: what it does in the game and at work.
    // Play is frozen behind it; hopping forward closes it (see game.js).
    learn(mod) {
      const f = CONTENT.features[mod.featureId];
      const L = CONTENT.learn;
      const box = $('learn');
      this.clearHint();
      box.hidden = false;
      $('learn-icon').innerHTML = iconSvg(mod.featureId);
      $('learn-name').textContent = f.name;
      $('learn-tagline').textContent = f.tagline;
      $('learn-power').textContent = CONTENT.powers[mod.id] || '';
      $('learn-work').textContent = f.description;
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      $('learn-go-text').textContent = coarse ? L.touch : L.keys;
    },
    hideLearn() {
      $('learn').hidden = true;
    },
    // items: [{ id, featureId, state: off | active | held | used, k (0 to 1 remaining) }]
    powers(items) {
      const seen = new Set();
      for (const it of items) {
        seen.add(it.id);
        let chip = chips.get(it.id);
        if (!chip) {
          chip = el('div', 'hud-power');
          chip.setAttribute('role', 'img');
          chip.innerHTML = `<svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="ring-bg" cx="20" cy="20" r="16"/><circle class="ring-fg" cx="20" cy="20" r="16" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg>${iconSvg(it.featureId, 'hud-power-icon')}`;
          chip.fg = chip.querySelector('.ring-fg');
          chip.lastOff = RING;
          powersEl.appendChild(chip);
          chips.set(it.id, chip);
        }
        if (chip.state !== it.state) {
          chip.state = it.state;
          chip.className = `hud-power is-${it.state}`;
          const f = CONTENT.features[it.featureId];
          chip.setAttribute('aria-label', `${f ? f.name : it.id}, ${C.powerState[it.state]}`);
        }
        const off = RING * (1 - Math.max(0, Math.min(1, it.k)));
        if (Math.abs(chip.lastOff - off) > 0.2) {
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
      const deaths = game.theme === 'habitat' ? CONTENT.habitat.deaths : CONTENT.deaths;
      const d = deaths[cause] || deaths.meeting;
      lastMode = game.mode;
      $('over-cause').textContent = d.title;
      // A Work run still going when the otter went down: say how close it was.
      const run = game.active.find((e) => e.mod.id === 'workMode');
      const left = run ? run.left : 0;
      $('over-tip').textContent = left > 0 ? `${d.tip} ${fmt(CONTENT.powerupMessages.workModeLeft, { n: left, total: run.max })}` : d.tip;
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

      // Initials, only for a new personal best (today's best on the daily). Each
      // player keeps one top score, so a lower run has nothing to save. A booth
      // is a shared device, so there any run that makes the local top 10 counts.
      const newBest = daily ? daily.isBest : isBest;
      const counts = booth || newBest;
      const local = !daily && counts && qualifies(game.score);
      const onlineRun = counts && live && online.hasRun() && game.score > 0;
      $('post-msg').textContent = '';
      $('post-online-row').hidden = !onlineRun;
      $('post-company-row').hidden = !(onlineRun && !booth && online.domain());
      if (onlineRun) {
        $('post-online').checked = load('online.post', true);
        $('post-company').checked = load('online.postCompany', true);
        $('post-company-text').textContent = fmt(ON.companyLabel, { domain: online.domain() || '' });
      }
      $('initials-heading').textContent = local ? C.madeTop10 : ON.saveHeading;
      if (local || onlineRun) {
        pending = { score: game.score, items: game.actionItems, local, online: onlineRun };
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

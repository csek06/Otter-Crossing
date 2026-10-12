// Headless browser smoke test. Opens dist/otter-crossing.html over file://, plays
// through each screen, checks for console errors and saves screenshots.
//
//   npm run smoke
// Set CHROMIUM_PATH if Chromium is somewhere other than the default below.

import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = pathToFileURL(join(root, 'dist', 'otter-crossing.html')).href;
const shots = join(root, 'screenshots');
mkdirSync(shots, { recursive: true });

const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));

const SIZES = [
  { name: 'phone-375x667', width: 375, height: 667, dpr: 2, touch: true },
  { name: 'phone-390x844', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'tablet-820x1180', width: 820, height: 1180, dpr: 2, touch: true },
  { name: 'desktop-1440x900', width: 1440, height: 900, dpr: 1, touch: false },
];

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
};

const browser = await chromium.launch({ executablePath });

async function open(size, query = '') {
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.dpr,
    hasTouch: size.touch,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) errors.push('network request: ' + r.url()); });
  await page.goto(file + query);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

const wait = (page, ms) => page.waitForTimeout(ms);
const state = (page) => page.evaluate(() => {
  const g = window.__otter.game;
  return { state: g.state, score: g.score, row: g.player.row, cause: g.player.deathCause, cam: g.camRow };
});

// Screens at every size.
for (const size of SIZES) {
  const { ctx, page, errors } = await open(size, '?debug=1&seed=7');
  await page.screenshot({ path: join(shots, `${size.name}-1-title.png`) });
  await page.click('#btn-howto');
  await page.screenshot({ path: join(shots, `${size.name}-2-howto.png`) });
  await page.click('#btn-howto-back');
  await page.click('#btn-play');
  await wait(page, 200);
  // Invincible so the run survives long enough to show traffic.
  await page.evaluate(() => {
    const g = window.__otter.game;
    g.debug.invincible = true;
    // Clear the otter's column so six forward hops always land.
    for (let r = 1; r <= 7; r++) { const l = g.getLane(r); l.blocked &= ~(1 << 4); l.obstacles = l.obstacles.filter((o) => o.col !== 4); }
  });
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowUp'); await wait(page, 160); }
  await wait(page, 300);
  await page.screenshot({ path: join(shots, `${size.name}-3-play.png`) });
  const s = await state(page);
  check(s.state === 'playing' && s.score === 6, `${size.name}: six hops forward score 6 (got ${s.score}, ${s.state})`);
  await page.keyboard.press('Escape');
  await wait(page, 100);
  await page.screenshot({ path: join(shots, `${size.name}-4-pause.png`) });
  check((await state(page)).state === 'paused', `${size.name}: Esc pauses`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__otter.game.debug.invincible = false; window.__otter.game.kill('meeting', null); });
  await wait(page, 1100);
  await page.screenshot({ path: join(shots, `${size.name}-5-over.png`) });
  check((await state(page)).state === 'over', `${size.name}: game over screen after a death`);
  check(errors.length === 0, `${size.name}: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Real collision with meeting traffic: keep hopping forward into a meeting lane until hit.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=meetings&seed=3');
  await page.click('#btn-play');
  let s;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('ArrowUp');
    await wait(page, 140);
    s = await state(page);
    if (s.state !== 'playing') break;
  }
  await wait(page, 1000);
  s = await state(page);
  check(s.state === 'over' && s.cause === 'meeting', `meeting traffic hits the otter (state ${s.state}, cause ${s.cause})`);
  const cause = await page.textContent('#over-cause');
  check(cause === 'Pulled into a meeting', `game over shows the cause (${cause})`);
  await page.screenshot({ path: join(shots, 'meeting-death.png') });
  // Restart.
  await page.click('#btn-again');
  await wait(page, 200);
  s = await state(page);
  check(s.state === 'playing' && s.score === 0, 'play again restarts the run');
  check(errors.length === 0, `meeting run: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Standing still lets the camera pass the otter: the Deadline Hawk.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=focus&seed=5');
  await page.click('#btn-play');
  await page.keyboard.press('ArrowUp');
  await wait(page, 200);
  await page.keyboard.press('ArrowDown');
  // Speed things up: jump the camera forward.
  await page.evaluate(() => { window.__otter.game.camRow += 8; });
  await wait(page, 1900);
  const s = await state(page);
  check(s.state === 'over' && s.cause === 'hawk', `falling behind the camera ends the run (cause ${s.cause})`);
  check(errors.length === 0, `hawk run: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Touch: tap hops forward, swipe right moves right.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&lane=focus&seed=11');
  await page.tap('#btn-play');
  await wait(page, 150);
  const box = await page.locator('#game').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.7);
  await wait(page, 250);
  let s = await state(page);
  check(s.row === 1, `tap hops forward (row ${s.row})`);
  const x0 = await page.evaluate(() => window.__otter.game.player.x);
  await page.evaluate(({ x, y }) => {
    const c = document.getElementById('game');
    const ev = (type, dx) => c.dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: x + dx, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', 0); ev('pointermove', 15); ev('pointermove', 40); ev('pointerup', 40);
  }, { x: box.x + box.width / 2, y: box.y + box.height * 0.7 });
  await wait(page, 250);
  const x1 = await page.evaluate(() => window.__otter.game.player.x);
  check(x1 === x0 + 1 || (x0 === 8 && x1 === 8), `swipe right moves one column (${x0} to ${x1})`);
  check(errors.length === 0, `touch run: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Later difficulty renders and runs.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&start=300&seed=2');
  await page.click('#btn-play');
  await page.evaluate(() => { window.__otter.game.debug.invincible = true; window.__otter.game.debug.hitboxes = true; });
  for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowUp'); await wait(page, 150); }
  await wait(page, 300);
  await page.screenshot({ path: join(shots, 'late-difficulty-hitboxes.png') });
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); };
    requestAnimationFrame(f);
  }));
  console.log(`info headless frame count over 1s: ${fps}`);
  check(errors.length === 0, `late difficulty: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Transcript river: riding a highlight carries the otter, swimming too long sweeps it away.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&lane=river&seed=21');
  await page.click('#btn-play');
  await wait(page, 200);
  // Stand on a highlight.
  const ride = await page.evaluate(async () => {
    const g = window.__otter.game;
    const lane = g.lanes.find((l) => l.type === 'river' && l.row > g.player.row);
    const plat = lane.platforms.find((pl) => { const x = lane.mod.left(lane, pl); return x > 1 && x + pl.len < 8; })
      || lane.platforms[0];
    g.player.row = lane.row; g.player.toRow = lane.row; g.maxRow = lane.row;
    g.player.x = Math.round(lane.mod.left(lane, plat) + plat.len / 2 - 0.5);
    const x0 = g.player.x;
    await new Promise((r) => setTimeout(r, 400));
    return { x0, x1: g.player.x, riding: !!g.player.riding, rides: g.stats.highlights, state: g.state, row: lane.row };
  });
  check(ride.riding && ride.rides >= 1 && ride.x1 !== ride.x0, `riding a highlight carries the otter (${ride.x0.toFixed(2)} to ${ride.x1.toFixed(2)}, rides ${ride.rides})`);
  await page.screenshot({ path: join(shots, 'river-ride.png') });
  // Drop into still water away from any highlight.
  await page.evaluate(() => {
    const g = window.__otter.game;
    const p = g.player;
    const lane = g.getLane(p.row);
    lane.speed = 0;
    p.riding = null;
    let best = 4;
    for (let x = 0; x <= 8; x += 0.05) if (!lane.mod.platformAt(lane, x)) { best = x; break; }
    p.x = best;
  });
  await wait(page, 450);
  const swimming = await page.evaluate(() => window.__otter.game.player.swim);
  await page.screenshot({ path: join(shots, 'river-swim.png') });
  check(swimming >= 0 || (await state(page)).state !== 'playing', `falling in starts the swim timer (${swimming})`);
  await wait(page, 1600);
  const s = await state(page);
  check(s.state === 'over' && s.cause === 'river', `swimming too long: swept away by notes (cause ${s.cause})`);
  check((await page.textContent('#over-cause')) === 'Swept away by notes', 'river death message');
  check(errors.length === 0, `river run: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// All-hands express: the signal fires at least 1 second before the train hits.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&lane=allhands&start=40&seed=8');
  await page.click('#btn-play');
  await wait(page, 200);
  await page.evaluate(() => {
    const g = window.__otter.game;
    const lane = g.lanes.find((l) => l.type === 'allhands' && l.row > g.player.row);
    g.player.row = lane.row; g.player.toRow = lane.row; g.maxRow = lane.row; g.player.x = 4;
    lane.state = 'idle'; lane.t = 0; lane.idle = 0.05;
    window.__signalAt = null;
    const tick = () => {
      if (lane.state !== 'idle' && window.__signalAt == null) window.__signalAt = performance.now();
      if (g.state === 'playing') requestAnimationFrame(tick);
      else window.__hitAt = performance.now();
    };
    tick();
  });
  await wait(page, 700);
  await page.screenshot({ path: join(shots, 'allhands-warning.png') });
  await wait(page, 2500);
  const r = await page.evaluate(() => ({ lead: (window.__hitAt - window.__signalAt) / 1000 }));
  const s = await state(page);
  check(s.state !== 'playing' && s.cause === 'allhands', `the all-hands hits an otter on the rails (cause ${s.cause})`);
  check(r.lead >= 1.0, `signal fired ${r.lead.toFixed(2)}s before the hit`);
  await wait(page, 900);
  check((await page.textContent('#over-cause')) === 'Steamrolled by the all-hands', 'all-hands death message');
  check(errors.length === 0, `all-hands run: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// A passing train, for the screenshot.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=allhands&start=40&seed=8');
  await page.click('#btn-play');
  await page.evaluate(() => {
    const g = window.__otter.game;
    g.debug.invincible = true;
    for (const l of g.lanes) if (l.type === 'allhands') { l.state = 'warn'; l.t = l.warnTime - 0.15; }
  });
  await wait(page, 450);
  await page.screenshot({ path: join(shots, 'allhands-train.png') });
  check(errors.length === 0, `train render: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Deadline Hawk: stall and the shadow grows from 5 seconds, then it strikes at 7.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=focus&seed=5');
  await page.click('#btn-play');
  await page.keyboard.press('ArrowUp');
  // Freeze the camera so only the stall timer matters.
  await page.evaluate(() => { window.__otter.game.moved = false; });
  await wait(page, 4600);
  check((await page.evaluate(() => window.__otter.game.hawk.warn)) === 0, 'no hawk shadow before 5 seconds');
  await wait(page, 1300);
  const warn = await page.evaluate(() => window.__otter.game.hawk.warn);
  check(warn > 0 && (await state(page)).state === 'playing', `hawk shadow grows after 5 seconds (${warn.toFixed(2)})`);
  await page.screenshot({ path: join(shots, 'hawk-shadow.png') });
  await wait(page, 1250);
  await page.screenshot({ path: join(shots, 'hawk-swoop.png') });
  await wait(page, 1500);
  const s = await state(page);
  check(s.state === 'over' && s.cause === 'hawk', `stalling 7 seconds brings the Deadline Hawk (cause ${s.cause})`);
  check(errors.length === 0, `hawk stall: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Action item tokens count up when collected.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=focus&seed=5');
  await page.click('#btn-play');
  await page.evaluate(() => {
    const g = window.__otter.game;
    const lane = g.getLane(g.player.row + 1);
    lane.blocked = 0; lane.obstacles.length = 0;
    lane.tokens.push({ col: Math.round(g.player.x), taken: false, t: 0 });
  });
  await page.keyboard.press('ArrowUp');
  await wait(page, 300);
  const n = await page.evaluate(() => window.__otter.game.actionItems);
  check(n === 1, `collecting a token counts an action item (${n})`);
  check((await page.textContent('#hud-items')) === '1', 'HUD shows action items');
  check(errors.length === 0, `tokens: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Random play across all lane types at several difficulties, watching for errors.
for (const start of [0, 120, 400]) {
  const { ctx, page, errors } = await open(SIZES[1], `?debug=1&start=${start}&seed=${start + 3}`);
  await page.click('#btn-play');
  await page.evaluate(() => { window.__otter.game.debug.invincible = true; });
  const keys = ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'];
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press(keys[(i * 7 + start) % keys.length]);
    await wait(page, 90);
  }
  const s = await state(page);
  const types = await page.evaluate(() => [...new Set(window.__otter.game.lanes.map((l) => l.type))].join(','));
  if (start === 120) await page.screenshot({ path: join(shots, 'mixed-lanes.png') });
  check(s.score > 4, `random play from ${start}: progressed ${s.score} lanes through ${types}`);
  check(errors.length === 0, `random play from ${start}: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- M3: power-ups, teaching screen, leaderboard ----------

// The feature card stays up for 3.5 seconds.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&seed=3');
  await page.click('#btn-play');
  await page.evaluate(() => { window.__otter.game.debug.invincible = true; window.__otter.screens.feature('aiChat'); });
  await wait(page, 3000);
  const at3 = await page.isVisible('#feature-toast.show');
  await wait(page, 900);
  const at4 = await page.isVisible('#feature-toast.show');
  check(at3 && !at4, `feature card shows for about 3.5 seconds (3s: ${at3}, 3.9s: ${at4})`);
  check(errors.length === 0, `feature card timing: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Otter Notetaker absorbs one meeting hit, then the next one counts.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&lane=meetings&seed=3&powerup=notetaker');
  await page.click('#btn-play');
  await wait(page, 300);
  check(await page.isVisible('#feature-toast.show'), 'pickup shows the feature card without pausing');
  check((await page.textContent('#ft-name')) === 'Otter Notetaker', 'feature card names Otter Notetaker');
  check((await page.textContent('#ft-tagline')) === 'Joins your meetings and takes notes', 'feature card shows the tagline');
  check((await state(page)).state === 'playing', 'play continues during the feature card');
  await page.screenshot({ path: join(shots, 'm3-notetaker-pickup.png') });
  const hit = await page.evaluate(async () => {
    const g = window.__otter.game;
    g.kill('meeting', null);
    const absorbed = g.state === 'playing' && !g.isActive('notetaker');
    await new Promise((r) => setTimeout(r, 1200));
    g.kill('meeting', null);
    return { absorbed, toast: document.getElementById('toast').textContent, after: g.state };
  });
  check(hit.absorbed, 'Otter Notetaker absorbs one hit');
  check(hit.toast === 'Otter Notetaker took that one for you.', `shield message (${hit.toast})`);
  check(hit.after === 'dying', 'the next hit counts');
  check(errors.length === 0, `notetaker: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// The shield also lasts only 12 seconds.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=focus&seed=3&powerup=notetaker');
  await page.click('#btn-play');
  await wait(page, 200);
  const r = await page.evaluate(() => {
    const g = window.__otter.game;
    const e = g.active.find((a) => a.mod.id === 'notetaker');
    return { t: e && e.t, slots: document.querySelectorAll('.hud-power').length, active: [...document.querySelectorAll('.hud-power.is-active')].map((c) => c.getAttribute('aria-label')) };
  });
  check(r.t > 11 && r.t <= 12, `shield timer starts at 12 seconds (${r.t && r.t.toFixed(2)})`);
  check(r.slots === 5, `the tracker has a slot for each released power-up (${r.slots})`);
  check(r.active.length === 1 && r.active[0] === 'Otter Notetaker, active', `the tracker shows the active power-up (${r.active})`);
  await page.screenshot({ path: join(shots, 'm3-hud-shield.png') });
  check(errors.length === 0, `shield timer: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Power-up tracker at every size: fits on its own row under the score, shows held
// and used states, and never covers the pause button.
for (const size of SIZES) {
  const { ctx, page, errors } = await open(size, '?debug=1&lane=focus&seed=6&powerup=aiChat');
  await page.click('#btn-play');
  await wait(page, 250);
  const read = () => page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect();
    const slots = [...document.querySelectorAll('.hud-power')];
    const pause = box(document.getElementById('btn-pause'));
    const score = box(document.querySelector('.hud-score'));
    return {
      labels: slots.map((c) => c.getAttribute('aria-label')),
      below: slots.every((c) => box(c).top >= score.bottom),
      clear: slots.every((c) => { const b = box(c); return b.right <= pause.left || b.top >= pause.bottom; }),
      inside: slots.every((c) => { const b = box(c); return b.left >= 0 && b.right <= innerWidth; }),
      group: document.getElementById('hud-powers').getAttribute('aria-label'),
    };
  });
  const a = await read();
  check(a.labels.length === 5 && a.below && a.clear && a.inside, `${size.name}: tracker sits under the score, inside the screen, clear of pause`);
  check(a.group === 'Power-ups', `${size.name}: tracker is a labeled group`);
  check(a.labels.includes('AI Chat, ready') && a.labels.filter((l) => l.endsWith('not found yet')).length === 4, `${size.name}: held and not found states (${a.labels})`);
  await page.screenshot({ path: join(shots, `${size.name}-6-tracker.png`) });
  await page.evaluate(() => window.__otter.game.kill('meeting', null));
  await wait(page, 120);
  const b = await read();
  check(b.labels.includes('AI Chat, used'), `${size.name}: AI Chat shows as used after the revive (${b.labels})`);
  check(errors.length === 0, `${size.name} tracker: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// A power-up on a river log is collected by riding that log.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&lane=river&seed=8');
  await page.click('#btn-play');
  await wait(page, 200);
  const r = await page.evaluate(async () => {
    const g = window.__otter.game;
    let lane = null;
    for (let row = g.player.row + 1; row < g.player.row + 200 && !lane; row++) {
      const l = g.getLane(row);
      if (l && l.powerup && l.powerup.plat) lane = l;
    }
    if (!lane) return { found: false };
    const plat = lane.powerup.plat;
    g.player.row = lane.row; g.player.toRow = lane.row; g.maxRow = lane.row;
    g.player.x = lane.mod.left(lane, plat) + plat.len / 2 - 0.5;
    await new Promise((res) => setTimeout(res, 150));
    return { found: true, taken: lane.powerup.taken, id: lane.powerup.id, active: g.active.length + g.held.length };
  });
  check(r.found, 'a river lane carries a power-up on a log');
  check(r.taken && r.active === 1, `riding the log picks up the power-up (${r.id})`);
  check(errors.length === 0, `river power-up: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// AI Chat: held, revives once on the last safe lane with 2 seconds of invulnerability.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&seed=4&powerup=aiChat');
  await page.click('#btn-play');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowUp'); await wait(page, 160); }
  const r = await page.evaluate(async () => {
    const g = window.__otter.game;
    const held = g.held.length;
    g.kill('river', null);
    const lane = g.getLane(g.player.row);
    const res = { held, state: g.state, safe: lane.mod.safe, invuln: g.player.invuln, after: g.held.length, toast: document.getElementById('toast').textContent };
    await new Promise((r) => setTimeout(r, 100));
    g.kill('meeting', null);
    res.blocked = g.state;
    await new Promise((r) => setTimeout(r, 2200));
    g.kill('meeting', null);
    res.final = g.state;
    return res;
  });
  check(r.held === 1, 'AI Chat is held until needed');
  check(r.state === 'playing' && r.safe && r.after === 0, 'AI Chat revives on a safe lane, once');
  check(Math.abs(r.invuln - 2) < 0.1, `revive gives 2 seconds of invulnerability (${r.invuln})`);
  check(r.toast === 'AI Chat caught you up.', `revive message (${r.toast})`);
  check(r.blocked === 'playing', 'hits are ignored while invulnerable');
  check(r.final === 'dying', 'after the revive, the next death counts');
  check(errors.length === 0, `aiChat: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Summary: auto-hops at least 5 lanes forward to a safe lane.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&seed=6&start=60&powerup=summary');
  await page.click('#btn-play');
  await wait(page, 120);
  await page.screenshot({ path: join(shots, 'm3-summary-hop.png') });
  await wait(page, 1500);
  const r = await page.evaluate(() => {
    const g = window.__otter.game;
    return { score: g.score, state: g.state, safe: g.getLane(g.player.row).mod.safe, auto: !!g.auto };
  });
  check(r.state === 'playing' && r.score >= 5 && r.safe && !r.auto, `Summary skips ahead ${r.score} lanes to a safe lane`);
  check(errors.length === 0, `summary: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Action items: pulls nearby tokens in for 6 seconds.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=focus&seed=9&powerup=actionItems');
  await page.click('#btn-play');
  const n = await page.evaluate(async () => {
    const g = window.__otter.game;
    const p = g.player;
    for (const dr of [1, 2, 3]) {
      const lane = g.getLane(p.row + dr);
      lane.tokens.push({ col: Math.max(0, Math.round(p.x) - 2), taken: false, t: 0 });
      lane.tokens.push({ col: Math.min(8, Math.round(p.x) + 2), taken: false, t: 0 });
    }
    await new Promise((r) => setTimeout(r, 300));
    return g.actionItems;
  });
  check(n === 6, `the magnet pulls in nearby tokens (${n})`);
  const left = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 6000));
    return window.__otter.game.isActive('actionItems');
  });
  check(!left, 'the magnet ends after 6 seconds');
  check(errors.length === 0, `magnet: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Live Assist: lights safe tiles for 4 seconds.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&seed=12&start=40&powerup=liveAssist');
  await page.click('#btn-play');
  await page.evaluate(() => { window.__otter.game.debug.invincible = true; });
  await wait(page, 300);
  const tiles = await page.evaluate(() => {
    const e = window.__otter.game.active.find((a) => a.mod.id === 'liveAssist');
    return e && e.tiles ? e.tiles.length / 2 : 0;
  });
  check(tiles > 0, `Live Assist lights ${tiles} safe tiles`);
  await page.screenshot({ path: join(shots, 'm3-live-assist.png') });
  check(errors.length === 0, `live assist: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// A natural run: a power-up within 15 lanes, walk into it, then the teaching screen.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&seed=31');
  await page.evaluate(() => localStorage.clear());
  await page.click('#btn-play');
  const r = await page.evaluate(async () => {
    const g = window.__otter.game;
    const lane = g.lanes.find((l) => l.powerup && l.row >= g.startRow);
    if (!lane) return { row: null };
    // Stand just behind it, then hop on.
    const p = g.player;
    const behind = g.getLane(lane.row - 1);
    behind.blocked = 0; behind.obstacles.length = 0;
    if (behind.cars) behind.cars.length = 0;
    behind.mod = g.getLane(g.startRow).mod;
    behind.type = 'focus';
    p.row = p.fromRow = p.toRow = lane.row - 1;
    p.x = p.fromX = p.toX = lane.powerup.col;
    g.maxRow = p.row;
    g.camRow = p.row - 6;
    return { row: lane.row - g.startRow, id: lane.powerup.id };
  });
  check(r.row != null && r.row <= 15, `first power-up appears at lane ${r.row} (${r.id})`);
  await page.keyboard.press('ArrowUp');
  await wait(page, 250);
  const used = await page.evaluate(() => window.__otter.game.used.slice());
  check(used.length >= 1, `picking it up records the feature (${used.join(',')})`);
  await page.screenshot({ path: join(shots, 'm3-pickup.png') });
  await page.evaluate(() => {
    const g = window.__otter.game;
    g.debug.invincible = false;
    g.held.length = 0; g.active.length = 0; g.auto = null; g.player.invuln = 0;
    g.markUsed('highlights');
    g.kill('allhands', null);
  });
  await wait(page, 1100);
  check((await state(page)).state === 'over', 'game over after the run');
  const names = await page.$$eval('#recap-list .recap-name', (els) => els.map((e) => e.textContent));
  check(names.length >= 2 && names.includes('Highlights'), `Features you used: ${names.join(', ')}`);
  const links = await page.$$eval('#recap-list .recap-link', (els) => els.map((e) => e.href));
  check(links.length === names.length && links.every((h) => h.startsWith('https://help.otter.ai')), 'each feature has a Learn more link');
  check((await page.textContent('#over-tip')) === 'Missed it? AI Chat can catch you up.', 'all-hands tip names AI Chat');
  check((await page.getAttribute('#btn-try', 'href')) === 'https://otter.ai', 'Try Otter goes to otter.ai');
  const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 5000 }).catch(() => null), page.click('#btn-try')]);
  check(!!popup && popup.url().startsWith('https://otter.ai'), `Try Otter opens otter.ai in a new tab (${popup && popup.url()})`);
  if (popup) await popup.close();
  await page.screenshot({ path: join(shots, 'm3-over-recap.png') });

  // Initials entry and the leaderboard.
  check(await page.isVisible('#initials'), 'initials entry shows for a top 10 score');
  await page.focus('.slot-letter');
  await page.keyboard.type('zoe');
  await page.click('#btn-save');
  check(await page.isHidden('#initials'), 'initials saved');
  await page.click('#btn-over-board');
  const rows = await page.$$eval('.board-row', (els) => els.map((e) => e.textContent));
  check(rows.length === 1 && rows[0].includes('ZOE'), `leaderboard shows the new entry (${rows.join(' | ')})`);
  await page.screenshot({ path: join(shots, 'm3-leaderboard.png') });
  check(errors.length === 0, `teaching screen: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// No initials for a zero score, and an empty recap shows its prompt.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&seed=2&lane=focus');
  await page.evaluate(() => localStorage.clear());
  await page.click('#btn-play');
  await page.evaluate(() => window.__otter.game.kill('meeting', null));
  await wait(page, 1000);
  check(await page.isHidden('#initials'), 'no initials entry for a zero score');
  check(await page.isVisible('#recap-empty'), 'empty recap invites a pickup next run');
  await page.screenshot({ path: join(shots, 'm3-over-empty.png') });
  check(errors.length === 0, `empty recap: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Title screen at every size, with the leaderboard button and sound icon.
for (const size of SIZES) {
  const { ctx, page, errors } = await open(size, '?seed=7');
  const targets = await page.$$eval('#screen-title button', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  check(targets.every((t) => t >= 48), `${size.name}: title tap targets are at least 48px (${targets.map((t) => t.toFixed(0)).join(',')})`);
  await page.screenshot({ path: join(shots, `${size.name}-1-title.png`) });
  check(errors.length === 0, `${size.name} title: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// prefers-reduced-motion: no shake, no splash droplets.
{
  const { ctx, page, errors } = await open(SIZES[0], '?debug=1&lane=river&seed=21');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('#btn-play');
  const r = await page.evaluate(() => {
    const g = window.__otter.game;
    g.fx.splash(4, g.player.row, matchMedia('(prefers-reduced-motion: reduce)').matches);
    return { drops: g.fx.live.filter((f) => f.kind === 'drop').length, rings: g.fx.live.filter((f) => f.kind === 'ring').length };
  });
  check(r.drops === 0 && r.rings === 1, `reduced motion: ripple only, no droplets (${r.drops} drops)`);
  check(errors.length === 0, `reduced motion: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Keyboard: the menus are reachable and show a focus ring.
{
  const { ctx, page, errors } = await open(SIZES[3], '?seed=7');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  check(focus.tag === 'BUTTON' && focus.outline !== 'none' && focus.width >= 2, `keyboard focus is visible (${focus.tag}, ${focus.outline} ${focus.width}px)`);
  await page.keyboard.press('Enter');
  await wait(page, 200);
  check(errors.length === 0, `keyboard: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Booth mode: attract loop, tap to play, sign-up consent, idle reset, hidden admin.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&booth=1&idle=3&seed=7');
  const r0 = await page.evaluate(() => ({ state: window.__otter.game.state, row: window.__otter.game.player.row }));
  await wait(page, 3000);
  const r1 = await page.evaluate(() => ({ state: window.__otter.game.state, row: window.__otter.game.player.row, demo: window.__otter.game.demo }));
  check(r0.state === 'demo' && r1.demo && r1.row >= r0.row + 2, `booth: attract loop plays on the title (row ${r0.row} to ${r1.row})`);
  check(await page.isHidden('#btn-daily'), 'booth: daily challenge is off the shared title');
  await page.screenshot({ path: join(shots, 'booth-title.png') });
  const box = await page.locator('#game').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.3);
  await wait(page, 200);
  const st = await page.evaluate(() => ({ state: window.__otter.game.state, demo: window.__otter.game.demo, score: window.__otter.game.score }));
  check(st.state === 'playing' && !st.demo && st.score === 0, `booth: tapping the scene starts a real run (${st.state})`);
  await page.evaluate(() => { window.__otter.game.actionItems = 4; window.__otter.game.kill('meeting', null); });
  await wait(page, 1100);
  check(await page.isVisible('#optin'), 'booth: sign-up shows on game over');
  check(!(await page.isChecked('#optin-consent')), 'booth: consent box is unchecked by default');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('otterCrossing.signups') || '[]').length);
  await page.fill('#optin-email', 'pat.lee@example.com');
  await page.click('#btn-optin');
  check((await stored()) === 0 && (await page.textContent('#optin-msg')).length > 0, 'booth: nothing is saved without consent');
  await page.check('#optin-consent');
  await page.fill('#optin-email', 'not an email');
  await page.click('#btn-optin');
  check((await stored()) === 0, 'booth: a bad email is not saved');
  await page.fill('#optin-email', 'pat.lee@example.com');
  await page.locator('#optin').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(shots, 'booth-signup.png') });
  await page.click('#btn-optin');
  check((await stored()) === 1, 'booth: a consented sign-up is saved on the device');
  await wait(page, 3600);
  const idle = await page.evaluate(() => ({ state: window.__otter.game.state, email: document.getElementById('optin-email').value, title: !document.getElementById('screen-title').hidden }));
  check(idle.state === 'demo' && idle.title && idle.email === '', `booth: idle returns to the attract loop and clears the form (${idle.state})`);
  // Mid-run idle: the run ends and the title comes back.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.3);
  await page.evaluate(() => { window.__otter.game.debug.invincible = true; });
  await wait(page, 3600);
  check(await page.evaluate(() => window.__otter.game.state === 'demo'), 'booth: an abandoned run returns to the title');
  await page.evaluate(() => { window.__otter.game.debug.invincible = false; });

  // Hidden admin: hold the logo.
  await page.locator('.logo-slot').dispatchEvent('pointerdown');
  await wait(page, 3200);
  check(await page.isVisible('#screen-admin'), 'booth: holding the logo opens the admin screen');
  check((await page.textContent('#admin-signups')).includes('1'), 'booth: admin shows the sign-up count');
  await page.screenshot({ path: join(shots, 'booth-admin.png') });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-admin-export')]);
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync(await dl.path(), 'utf8');
  check(dl.suggestedFilename().endsWith('.csv') && csv.includes('pat.lee@example.com') && csv.startsWith('"email"'), `booth: CSV export (${dl.suggestedFilename()})`);
  await wait(page, 4000);
  check(await page.isVisible('#screen-admin'), 'booth: the admin screen is not cut short by the idle timer');
  await page.click('#btn-admin-clear');
  check((await stored()) === 1 && (await page.textContent('#btn-admin-clear')) === 'Tap again to confirm', 'booth: clearing asks for a second tap');
  await page.click('#btn-admin-clear');
  check((await stored()) === 0 && (await page.textContent('#admin-signups')).includes('0'), 'booth: clear removes sign-ups');
  await page.click('#btn-admin-back');
  await page.keyboard.press('Alt+Shift+KeyO');
  check(await page.isVisible('#screen-admin'), 'booth: Alt+Shift+O opens admin from the title');
  check(errors.length === 0, `booth: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Not booth mode: the attract loop still plays, but no sign-up and no admin.
{
  const { ctx, page, errors } = await open(SIZES[3], '?debug=1&seed=7');
  await wait(page, 3000);
  const d = await page.evaluate(() => ({ state: window.__otter.game.state, row: window.__otter.game.player.row, giveUp: window.__otter.game.demo }));
  check(d.state === 'demo' && d.row > 2, `normal: attract loop plays behind the title (row ${d.row})`);
  // Past its give-up point the demo charges ahead, loses, and starts a new run.
  const runs0 = await page.evaluate(() => { const g = window.__otter.game; g.autopilot.setGiveUp(0); return g.demoRuns; });
  let runs1 = runs0;
  for (let i = 0; i < 40 && runs1 === runs0; i++) {
    await wait(page, 250);
    runs1 = await page.evaluate(() => window.__otter.game.demoRuns);
  }
  const after = await page.evaluate(() => ({ state: window.__otter.game.state, title: !document.getElementById('screen-title').hidden, hud: !document.getElementById('hud').hidden, over: !document.getElementById('screen-over').hidden }));
  check(runs1 === runs0 + 1 && after.state === 'demo' && after.title && !after.hud && !after.over, `normal: the demo loses and starts over on its own (${runs0} to ${runs1} runs)`);
  await page.screenshot({ path: join(shots, 'title-demo.png') });
  await page.locator('.logo-slot').dispatchEvent('pointerdown');
  await wait(page, 3200);
  check(await page.isHidden('#screen-admin'), 'normal: the logo does not open admin');
  await page.click('#btn-play');
  await page.evaluate(() => window.__otter.game.kill('meeting', null));
  await wait(page, 1100);
  check(await page.isHidden('#optin'), 'normal: no sign-up on game over');
  check(errors.length === 0, `normal: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Daily challenge: the same course every time today, its own best, a result to share.
{
  const { ctx, page, errors } = await open(SIZES[3], '?debug=1&seed=7&lane=river');
  const course = () => page.evaluate(() => {
    const g = window.__otter.game;
    return { mode: g.mode, seed: g.seed, lanes: g.lanes.filter((l) => l.row >= 0 && l.row < 30).map((l) => l.type + (l.type === 'focus' ? l.blocked : (l.speed || 0).toFixed(4))).join(',') };
  });
  await page.click('#btn-daily');
  const a = await course();
  await page.evaluate(() => { window.__otter.game.actionItems = 3; window.__otter.game.score = 9; window.__otter.game.kill('meeting', null); });
  await wait(page, 1100);
  check(await page.isVisible('#over-mode'), 'daily: game over shows the daily tag');
  check(await page.isHidden('#initials'), 'daily: no initials entry for daily runs');
  check((await page.textContent('#over-best-label')) === "Today's best" && (await page.textContent('#over-best')) === '9', 'daily: today\'s best is tracked');
  const share = await page.textContent('#share-text');
  check(/\d{4}-\d{2}-\d{2}/.test(share) && share.includes('9') && share.includes('3'), `daily: share text (${share})`);
  await page.click('#btn-copy');
  await wait(page, 200);
  check((await page.textContent('#share-msg')).length > 0, 'daily: copy gives feedback');
  await page.screenshot({ path: join(shots, 'daily-over.png') });
  await page.click('#btn-again');
  await wait(page, 100);
  const b = await course();
  check(a.mode === 'daily' && b.mode === 'daily' && a.seed === b.seed && a.lanes === b.lanes && a.lanes.length > 20, 'daily: play again gives the same course, ignoring debug lane filters');
  await page.evaluate(() => window.__otter.quit());
  await page.click('#btn-play');
  const c = await course();
  check(c.mode === 'free' && c.seed !== a.seed, 'daily: free play uses its own seed');
  check(errors.length === 0, `daily: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Outfits: earn, buy, wear, and see it in play.
{
  const { ctx, page, errors } = await open(SIZES[1], '?debug=1&seed=7');
  await page.click('#btn-outfits');
  check((await page.getAttribute('[data-outfit="sales"]', 'aria-disabled')) === 'true', 'outfits: locked with an empty wallet');
  await page.click('#btn-outfits-back');
  await page.click('#btn-play');
  await page.evaluate(() => { window.__otter.game.actionItems = 7; window.__otter.game.kill('meeting', null); });
  await wait(page, 1100);
  check((await page.textContent('#over-wallet')).includes('7'), 'outfits: a run adds its action items to the wallet');
  await page.evaluate(() => { localStorage.setItem('otterCrossing.wallet', '200'); });
  await page.reload();
  await wait(page, 400);
  await page.click('#btn-outfits');
  await page.screenshot({ path: join(shots, 'outfits-shop.png') });
  for (const id of ['sales', 'cs', 'recruiting', 'education']) await page.click(`[data-outfit="${id}"]`);
  const w = await page.evaluate(() => ({ wallet: window.__otter.wardrobe.wallet(), wearing: window.__otter.game.outfit }));
  check(w.wallet === 200 - 140 && w.wearing === 'education', `outfits: buying spends items and puts it on (${w.wallet}, ${w.wearing})`);
  await page.screenshot({ path: join(shots, 'outfits-owned.png') });
  for (const id of ['classic', 'sales', 'cs', 'recruiting', 'education']) {
    await page.click(`[data-outfit="${id}"]`);
    await page.click('#btn-outfits-back');
    await page.click('#btn-play');
    await page.evaluate(() => { window.__otter.game.debug.invincible = true; });
    await page.keyboard.press('ArrowDown');
    await wait(page, 250);
    const clip = await page.evaluate(() => {
      const r = document.getElementById('game').getBoundingClientRect();
      return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.55, width: r.width * 0.4, height: r.height * 0.25 };
    });
    await page.screenshot({ path: join(shots, `outfit-${id}.png`), clip });
    await page.evaluate(() => window.__otter.quit());
    await page.click('#btn-outfits');
  }
  await page.reload();
  await wait(page, 300);
  check(await page.evaluate(() => window.__otter.game.outfit === 'education'), 'outfits: the choice persists');
  check(errors.length === 0, `outfits: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

// Music: plays during a run, builds with distance, stops on pause and game over.
{
  const { ctx, page, errors } = await open(SIZES[3], '?debug=1&seed=7');
  await page.click('#btn-play');
  await wait(page, 600);
  const m0 = await page.evaluate(() => ({ playing: window.__otter.music.playing, n: window.__otter.music.scheduled, k: window.__otter.music.k }));
  check(m0.playing && m0.n > 0 && m0.k === 0, `music: starts with the run (${m0.n} notes)`);
  await page.evaluate(() => { window.__otter.game.score = 80; window.__otter.music.setLanes(80); });
  const n1 = await page.evaluate(() => window.__otter.music.scheduled);
  await wait(page, 1000);
  const n2 = await page.evaluate(() => window.__otter.music.scheduled);
  await page.evaluate(() => { window.__otter.music.setLanes(0); });
  const n3 = await page.evaluate(() => window.__otter.music.scheduled);
  await wait(page, 1000);
  const n4 = await page.evaluate(() => window.__otter.music.scheduled);
  check(n2 - n1 > (n4 - n3) * 1.8, `music: denser at 80 lanes than at 0 (${n2 - n1} vs ${n4 - n3} notes a second)`);
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !window.__otter.music.playing), 'music: stops on pause');
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => window.__otter.music.playing), 'music: resumes');
  // The music switch: off from the pause screen, effects stay on, saved for next time.
  await page.keyboard.press('Escape');
  await page.click('#screen-pause .btn-music');
  check((await page.textContent('#screen-pause .btn-music')) === 'Music off', 'music: pause screen toggle reads Music off');
  await page.keyboard.press('Escape');
  await wait(page, 300);
  const off0 = await page.evaluate(() => window.__otter.music.scheduled);
  await wait(page, 1000);
  const off1 = await page.evaluate(() => window.__otter.music.scheduled);
  const fx = await page.evaluate(() => ({ muted: localStorage.getItem('otterCrossing.muted'), music: localStorage.getItem('otterCrossing.music') }));
  check(off1 === off0 && fx.music === 'false' && fx.muted !== 'true', `music: off silences music only (${off1 - off0} notes, muted ${fx.muted})`);
  await page.evaluate(() => window.__otter.game.kill('meeting', null));
  check(await page.evaluate(() => !window.__otter.music.playing), 'music: stops when the otter is caught');
  await page.reload();
  await wait(page, 300);
  check((await page.getAttribute('#screen-title .btn-music', 'aria-pressed')) === 'false', 'music: the setting is saved');
  await page.click('#screen-title .btn-music');
  await page.click('#btn-play');
  await wait(page, 600);
  check(await page.evaluate(() => window.__otter.music.scheduled > 0), 'music: title toggle turns it back on');
  check(errors.length === 0, `music: no console errors ${errors.join(' | ')}`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed');

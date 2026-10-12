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
  await page.evaluate(() => { window.__otter.game.debug.invincible = true; });
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
  await wait(page, 1200);
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

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed');

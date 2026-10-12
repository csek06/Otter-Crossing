# Otter Crossing

An endless lane-hopper for Otter.ai. Hop an otter across a workday full of meetings, a river of feature blurbs, the all-hands express and a deadline that will not wait. Power-ups teach Otter features, and the game over screen says which feature would have saved you.

Runs are about 30 to 120 seconds. It works on phones, tablets and desktops, offline, from one HTML file.

## Play it

Open `dist/otter-crossing.html` in a modern browser (Chrome, Safari, Edge or Firefox). Double-clicking it works: the file is self-contained and runs from `file://` with no network. That makes it safe for booth Wi-Fi.

- Phone or tablet: tap to hop forward, swipe left, right or back.
- Keyboard: arrow keys or WASD, Space hops forward, Esc or P pauses.

Scores, the local top 10 and the sound setting are saved in the browser's localStorage on that device.

## Run it locally (for development)

You need Node.js 18 or later.

```sh
npm install
npm run build     # writes dist/otter-crossing.html (and regenerates COPY_REVIEW.md)
npm run watch     # rebuilds when src/ changes; refresh the browser to see it
npm test          # generator rules over 16,000 lanes, power-up rules, copy checks
npm run smoke     # builds, then plays through every screen in headless Chromium
```

During development, open `dist/otter-crossing.html` directly after each build. There is no dev server, so what you test is exactly what ships.

The smoke test looks for Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Point it elsewhere with `CHROMIUM_PATH=/path/to/chrome npm run smoke`. Screenshots land in `screenshots/` (not committed).

## Deploy to static hosting

There is nothing to configure. Upload the one file.

1. Run `npm run build`.
2. Upload `dist/otter-crossing.html` to any static host. Rename it to `index.html` if you want it served at a folder's root URL.

Examples:

- **Netlify or Cloudflare Pages:** drag a folder containing `index.html` into the dashboard.
- **GitHub Pages:** commit the file as `index.html` to the branch or `docs/` folder that Pages serves.
- **Amazon S3 or Google Cloud Storage:** upload with content type `text/html`.
- **An existing site:** drop it in as a page, or embed it with `<iframe src="otter-crossing.html" style="width:100%;height:100vh;border:0" allow="autoplay"></iframe>`.

Notes:

- The JS and CSS are inline. If your site sends a Content-Security-Policy header, it needs `'unsafe-inline'` for `script-src` and `style-src`, and `data:` for `font-src`.
- The file makes no network requests and has no analytics. The only links out are Try Otter and the Learn more links on the game over screen.
- For a booth, open the file once in a full-screen browser window, or add it to the home screen on a tablet.

## Flags

Flags live in `src/config.js`. Change one, then run `npm run build`.

| Flag | Default | What it does |
|---|---|---|
| `AUDIENCE` | `"external"` | `"internal"` swaps in internal meeting titles (for example "Forecast call") and hides the Try Otter button. |
| `SHOW_UNRELEASED` | `false` | `true` lets unreleased features spawn and appear in the river. Today that is Live Assist, with placeholder copy. |
| `BOOTH_MODE` | `false` | Reserved for the booth stretch goal (attract loop, idle reset, opt-in). Not built yet. |

Tuning numbers (hop time, camera speed, difficulty ramp) are in `TUNING`. Generator rules that the tests check (traffic density caps, river timing, breather spacing, all-hands warning, hawk timing, power-up spacing) are in `RULES`.

## Edit the copy

All on-screen text is in `src/content.js`: feature names, taglines, descriptions, help links, death messages, tips, hints, meeting titles, river phrases, links and button labels. Non-engineers can edit it without touching game code.

- Features use the same shape as our other game: `{ name, tagline, description, helpUrl }`.
- Rules: sentence case, taglines 6 words or fewer, no em-dashes, no claims beyond the taglines. `npm test` checks the tagline length and the em-dashes.
- After editing, run `npm run copy-review` (or `npm run build`) to refresh `COPY_REVIEW.md`. The test suite fails if it is stale.

`COPY_REVIEW.md` lists every claim, tagline, tip and link with a checkbox, so it can be verified against help.otter.ai in one pass.

## Brand

- **Colors:** six CSS variables at the top of `src/styles.css`. `--c-brand` is a placeholder for the official Otter blue. The game art reads these variables too, so one change updates menus and canvas.
- **Logo:** paste the Otter logo SVG inside `<div class="logo-slot">` in `src/index.html`. The dashed placeholder disappears once the slot has content.
- **Fonts:** Overpass ExtraBold (display) and Overpass Mono (numbers, the river), both SIL Open Font License 1.1, inlined as base64 at build time from `@fontsource`. Body text uses the system font.

## Add a lane type

Lane types are modules in `src/lanes/` that share one interface:

```js
export const myLane = {
  id: 'myLane',
  safe: false,                    // true for breather lanes
  hint: 'myLane',                 // key in CONTENT.hints, shown the first time it appears
  minRow: 30,                     // optional: first row it can appear
  weight: (d, row) => 0.3,        // how often it is picked at difficulty d (0 to 1)
  generate(lane, row, d, rng, ctx) {},  // fill lane data. Use rng, never Math.random
  update(lane, dt) {},                  // move hazards
  drawGround(ctx, lane, view, y) {},    // flat ground for the row
  drawObjects(ctx, lane, view, y) {},   // raised objects for the row
  collide(lane, player) { return null }, // or { cause: 'myLane' }
  blocks(lane, col) { return 0 },        // truthy if a static obstacle fills the tile
  safeAt(lane, col) { return true },     // used by Live Assist
  // Optional: carry(lane, player, dt), hitboxes(lane), drawSignals(ctx, lane, view, y)
};
```

Then:

1. Import it and add it to `LANES` and `HAZARDS` in `src/lanes/registry.js`.
2. Add its hint to `CONTENT.hints`. If it can kill, add a cause to `CONTENT.deaths` with a title and tip.
3. Add a rule test to `test/generator.test.mjs` for whatever keeps it fair.
4. Try it alone with `?debug=1&lane=myLane`.

## Add a power-up

Power-ups are modules in `src/powerups/`:

```js
export default {
  id: 'myPowerup',
  featureId: 'myFeature',   // key in CONTENT.features
  unreleased: false,        // true keeps it hidden unless SHOW_UNRELEASED
  duration: 8,              // seconds, or 0 if it is instant or held
  weight: 1,                // how often it spawns
  apply(game) { game.addActive(this); },
  // Optional hooks:
  // update(game, dt, entry)  every frame while active
  // absorb(game, cause)      return true to cancel a hit
  // revive(game, cause)      return true to cancel a death (held power-ups)
  // oncePerRun: true         spawn at most once a run
};
```

Then:

1. Import it in `src/powerups/registry.js` and add it to `POWERUPS`.
2. Add the feature to `CONTENT.features` with `name`, `tagline`, `description` and `helpUrl`.
3. Add an icon path for the feature id to `src/render/icons.js` (24 by 24 grid, stroked).
4. Try it with `?debug=1&powerup=myPowerup`.

Pickup, feature card, HUD timer ring and game over recap all pick it up automatically.

## Debug

Add these to the URL, for example `otter-crossing.html?debug=1&lane=river`:

| Parameter | Effect |
|---|---|
| `?debug=1` | FPS counter, hitboxes and an invincibility toggle (keys H and I) |
| `?lane=<type>` | only `focus`, `meetings`, `river` or `allhands` lanes, plus breathers |
| `?start=<lanes>` | start at a later difficulty, for example `?start=300` |
| `?powerup=<id>` | grant `notetaker`, `aiChat`, `summary`, `actionItems` or `liveAssist` at the start (works even with `SHOW_UNRELEASED` off) |
| `?seed=<n>` | replay the same course |

## Project layout

```
src/
  config.js        flags, tuning and generator rules
  content.js       all copy
  main.js          wires everything together
  core/            loop helpers: input, stage (9:16 letterbox), audio, rng, pool, storage
  game/            game state, generator, player, effects, leaderboard
  lanes/           focus, meetings, river, allhands
  powerups/        notetaker, aichat, summary, actionitems, liveassist
  render/          renderer, palette, otter, hawk, pickups, icons
  ui/screens.js    title, how to play, pause, game over, leaderboard, HUD
tools/
  build.mjs        bundles everything into dist/otter-crossing.html
  copy-review.mjs  writes COPY_REVIEW.md from content.js
test/
  generator.test.mjs  rules over 16,000 lanes, power-ups, copy
  smoke.mjs           headless browser play-through and screenshots
```

## Accessibility and comfort

- Hazards read by shape and motion, not color alone: meetings are calendar cards with tick marks and a direction arrow, the all-hands is a long chain of envelopes behind signal lamps, highlights are marker strokes.
- Nothing flashes faster than 3 times a second. The all-hands lamps flash 2 times a second, and the test suite checks it.
- Menu buttons are at least 48px, with a visible focus ring. Menus work with the keyboard, and the initials picker takes typed letters.
- `prefers-reduced-motion` turns off the hit shake and splash droplets.

## Known limits

- Frame rate is verified at 60fps in headless Chromium on a desktop machine, not yet on a mid-range phone.
- Sounds are synthesized with the Web Audio API and have not been checked by ear in automated tests.
- Scores are per device and per browser. Clearing site data clears them.

# Otter Crossing

An endless lane-hopper for Otter.ai. Hop an otter across a workday full of meetings, a river with highlighted logs to ride, the all-hands express and a deadline that will not wait. Power-ups teach Otter features, and the game over screen says which feature would have saved you.

Runs are about 30 to 120 seconds. It works on phones, tablets and desktops, offline, from one HTML file. The game fills the screen. On a laptop or monitor the playfield stays centered, and during a run the space on each side shows a panel of power-up cards with the same content as the first-pickup explainer: what each one does in the game and inside Otter. Cards are grayed out until you find that power-up. Once collected, a card stays in full color for the rest of the run with a counter of how many times you picked it up, and it glows only while that power-up is active. The panels aren't shown on the title screen, and stay up on game over so you can see what your run collected. They show when there's at least 300px beside the playfield, and drop the taglines and labels on short windows so the cards fit. Game over (on every screen size) shows lanes crossed, your best, action items and power-ups collected, and lists each feature you used with how many times. The pickup toast and the explainer still show as before.

## Play it

Open `dist/otter-crossing.html` in a modern browser (Chrome, Safari, Edge or Firefox). Double-clicking it works: the file is self-contained and runs from `file://` with no network. That makes it safe for booth Wi-Fi.

- Phone or tablet: tap to hop forward, swipe left, right or back.
- Keyboard: arrow keys or WASD, Space hops forward, Esc or P pauses.

Scores, the local top 10, today's daily best, the outfit wallet and the sound setting are saved in the browser's localStorage on that device. Nothing leaves the device.

## Modes

The title screen plays a silent demo behind the menu: an autopilot otter plays a run, throws it after 12 to 28 lanes so you see it lose, and starts again. Tap the open scene or Play to take over.


- **Play:** a fresh random course every run. Each player keeps one top score, so game over only offers to save a run that beats your best. In booth mode, where one device is shared, any run that makes the local top 10 can be saved.
- **Daily challenge:** one course per calendar date, the same for everyone. The seed comes from the local date, so a given date always builds the same course. Game over shows today's best and a **Copy result** button with a one-line result to paste in Slack. Daily runs do not go on the top 10. The daily course runs outdoors, through the otter's own habitat: turtles, ducks, beavers, foxes, moose and bears cross on the trails, geese fly in low where the all-hands train would be, and the river has plain logs. It's the same course and hitboxes, only the art and the game over copy change.
- **Deadline Hawk timer:** the HUD shows a countdown and bar for the seconds left before the hawk strikes. It refills on every new lane. After 3 seconds without progress (`RULES.HAWK_ALARM`), an alarm beeps and the whole screen glows red, beeping and pulsing faster and higher as the strike nears, from once a second up to 3 times a second. The shadow still appears at 5 seconds and the hawk strikes at 7.
- **Outfits:** every run's action items go into a wallet. Spend them on role outfits: Sales (a tie, 15), Customer success (a scarf, 25), Recruiting (a lanyard badge, 40) and Education (a cap and glasses, 60). Costs are in `src/game/wardrobe.js`, names and lines in `CONTENT.outfits`.
- **Music:** a synthesized four-bar loop that adds layers (pad and bass, hats, arpeggio, drums, lead) and speeds up from 104 to 128 BPM as you cross lanes, reaching full intensity at 100 lanes. It plays only during a run and stops on pause and game over. The music button (the note on the title, or Music on and off on the pause screen) turns off just the music and keeps the effects. The sound button mutes everything. Both settings are saved on the device.

## Booth mode

Turn it on with `BOOTH_MODE: true` in `src/config.js`, or add `?booth=1` to the URL without rebuilding.

- **Idle reset:** after 20 seconds without input (`BOOTH.IDLE`), any screen or run goes back to the title and clears the sign-up form.
- **Sign-up:** game over shows an optional email field with a consent box that starts unticked. Nothing is saved unless the box is ticked. The consent text (`booth.consent`) and privacy link (`booth.privacyUrl`) are placeholders for Legal. Sign-ups are stored in localStorage on the device only.
- **Admin screen:** hold the Otter logo on the title for 3 seconds, or press Alt+Shift+O. It shows counts, exports sign-ups as a CSV, and clears sign-ups or scores and outfits. Clearing asks for a second tap. The admin screen ignores the idle timer.
- The daily challenge is hidden in booth mode because the device is shared.

After an event: open the admin screen, export the CSV, send it to the team that owns the list, then clear sign-ups.

## Run it locally (for development)

You need Node.js 18 or later.

```sh
npm install
npm run build     # writes dist/otter-crossing.html (and regenerates COPY_REVIEW.md)
npm run watch     # rebuilds when src/ changes; refresh the browser to see it
npm test          # generator rules over 16,000 lanes, power-ups, copy, daily, outfits, booth, music
npm run smoke     # builds, then plays through every screen in headless Chromium
```

During development, open `dist/otter-crossing.html` directly after each build. There is no dev server, so what you test is exactly what ships.

The smoke test looks for Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Point it elsewhere with `CHROMIUM_PATH=/path/to/chrome npm run smoke`. Screenshots land in `screenshots/` (not committed).

## Deploy to static hosting

There is nothing to configure. Upload the one file.

1. Run `npm run build`.
2. Upload `dist/otter-crossing.html` to any static host. Rename it to `index.html` if you want it served at a folder's root URL.

### GitHub Pages (set up)

`.github/workflows/pages.yml` runs the unit tests, builds the game and publishes it on every push to the default branch. You can also run it by hand from the Actions tab.

One-time setup:

1. In the repo, open **Settings > Pages**, and under **Build and deployment** set **Source** to **GitHub Actions**.
2. Push, or run **Deploy to GitHub Pages** from the Actions tab.
3. The game is served at `https://<owner>.github.io/<repo>/` (for this repo, `https://csek06.github.io/Otter-Crossing/`).

Notes:

- A GitHub Pages site is public, even when the repo is private. Pages on a private repo needs a paid GitHub plan.
- Copy marked draft in `COPY_REVIEW.md` is live on that URL until it is signed off.

### Online boards (Supabase, optional)

Global, daily, event and company boards run on Supabase. They're off until the Supabase secrets are in GitHub. The Pages build then looks up the project URL and publishable key itself, and the build log says `offline only` until it finds them. `.github/workflows/supabase.yml` deploys the migrations and configures Auth and email (Resend). See [docs/backend.md](docs/backend.md) for the design, where each setting lives and `npm run test:db`.

### Other static hosts

Examples:

- **Netlify or Cloudflare Pages:** drag a folder containing `index.html` into the dashboard.
- **GitHub Pages:** commit the file as `index.html` to the branch or `docs/` folder that Pages serves.
- **Amazon S3 or Google Cloud Storage:** upload with content type `text/html`.
- **An existing site:** drop it in as a page, or embed it with `<iframe src="otter-crossing.html" style="width:100%;height:100vh;border:0" allow="autoplay"></iframe>`.

Notes:

- The JS and CSS are inline. If your site sends a Content-Security-Policy header, it needs `'unsafe-inline'` for `script-src` and `style-src`, and `data:` for `font-src`.
- With online boards off (the default), the file makes no network requests. It has no analytics either way. The only links out are Try Otter and the Learn more links on the game over screen.
- For a booth, open the file once in a full-screen browser window, or add it to the home screen on a tablet.

## Flags

Flags live in `src/config.js`. Change one, then run `npm run build`.

| Flag | Default | What it does |
|---|---|---|
| `AUDIENCE` | `"external"` | `"internal"` swaps in internal meeting titles (for example "Forecast call") and hides the Try Otter button. |
| `SHOW_UNRELEASED` | `false` | `true` lets unreleased features spawn and appear in the river. Nothing is held back today. |
| `BOOTH_MODE` | `false` | `true` turns on booth mode: idle reset, email sign-up and the admin screen. See [Booth mode](#booth-mode). `?booth=1` does the same without a rebuild. |

Tuning numbers (hop time, camera speed, difficulty ramp) are in `TUNING`. Generator rules that the tests check (traffic density caps, river timing, breather spacing, all-hands warning, hawk timing, power-up spacing) are in `RULES`.

Power-ups land on a random lane of any kind except the all-hands track (on a log when it's the river), in a random free column. The first one shows up by lane 15. After that the next is due a random 25 to 40 lanes later. Work Mode starts a Work run that counts the new lanes you cross. After 8 it finishes and pulls every action item on the next 6 lanes into a follow-up doc, plus 3 for the doc itself. If you go down first, the game over screen says how many lanes the run had left.

The first time you pick up each power-up in a run, play freezes and a card in the middle of the screen explains it: what it does in the game (`CONTENT.powers`) and what the feature does at work (the feature description). Hop forward (up, W, a tap or a swipe up) to close it; that hop does not move the otter. Later pickups of the same power-up show the short card at the bottom instead. The title screen demo never shows it.

The HUD tracker under the score has one slot for each power-up the run can spawn: faded until you find it, a draining ring while it's active, a full ring while AI Chat is held, and crossed out once it's spent.

## Edit the copy

All on-screen text is in `src/content.js`: feature names, taglines, descriptions, help links, death messages, tips, hints, meeting titles, links and button labels. Meeting blocks pick a title at random from long lists of everyday business meetings (sales, customer success, recruiting, product, marketing, leadership, HR, finance and education), kept to 9, 14 and 20 characters for 30, 60 and 90 minute blocks so they fit. Non-engineers can edit it without touching game code.

- Features use the same shape as our other game: `{ name, tagline, description, helpUrl }`.
- Rules: sentence case, taglines 6 words or fewer, no em-dashes, no claims beyond the taglines. `npm test` checks the tagline length and the em-dashes.
- After editing, run `npm run copy-review` (or `npm run build`) to refresh `COPY_REVIEW.md`. The test suite fails if it is stale.

`COPY_REVIEW.md` lists every claim, tagline, tip and link with a checkbox, so it can be verified against help.otter.ai in one pass.

## Brand

- **Colors:** nine CSS variables at the top of `src/styles.css`, including `--c-water` for the river, `--c-grass` for the daily habitat and `--c-power` for power-ups. `--c-brand` is `#144FFF`, the logo blue from the otter.ai media kit, and it is the only brand blue in the game: logo, buttons and signs. Power-ups and their effects (pickups, the Live Assist path, the Notetaker shield, active HUD chips and panel cards) are superhero green, `#22D35E`, so they stand out from the blue meetings and river. The game art reads these variables too, so one change updates menus and canvas.
- **Logo:** the Otter logo mark from the otter.ai site header is inlined in `<div class="logo-slot">` in `src/index.html`. It uses `currentColor` and is drawn in `--c-brand`. The power-up explainer's "Inside Otter" label reuses the same mark. Confirm usage with brand before launch. To swap it, replace the SVG in that slot.
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

Pickup, feature card, HUD power-up tracker and game over recap all pick it up automatically.

## Debug

Add these to the URL, for example `otter-crossing.html?debug=1&lane=river`:

| Parameter | Effect |
|---|---|
| `?debug=1` | FPS counter, hitboxes and an invincibility toggle (keys H and I) |
| `?lane=<type>` | only `focus`, `meetings`, `river` or `allhands` lanes, plus breathers |
| `?start=<lanes>` | start at a later difficulty, for example `?start=300` |
| `?powerup=<id>` | grant `notetaker`, `aiChat`, `summary`, `actionItems`, `liveAssist` or `workMode` at the start (works even for power-ups held back by `SHOW_UNRELEASED`) |
| `?seed=<n>` | replay the same course |
| `?booth=1` | booth mode, without changing the flag |
| `?idle=<seconds>` | with `?debug=1`, a shorter booth idle timeout for testing |

## Project layout

```
src/
  config.js        flags, tuning and generator rules
  content.js       all copy
  main.js          wires everything together
  core/            loop helpers: input, stage (fills the window), audio, music, rng, pool, storage
  game/            game state, generator, player, effects, leaderboard,
                   daily challenge, wardrobe (outfits), booth sign-ups, autopilot
  lanes/           focus, meetings, river, allhands
  powerups/        notetaker, aichat, summary, actionitems, liveassist, workmode
  render/          renderer, palette, otter, hawk, pickups, icons, habitat (daily art)
  ui/screens.js    title, how to play, pause, game over, leaderboard, HUD
tools/
  build.mjs        bundles everything into dist/otter-crossing.html
  copy-review.mjs  writes COPY_REVIEW.md from content.js
test/
  generator.test.mjs  rules over 16,000 lanes, power-ups, copy
  stretch.test.mjs    daily seeds, outfits, sign-up CSV, music layers
  smoke.mjs           headless browser play-through and screenshots
```

## Accessibility and comfort

- Hazards read by shape and motion, not color alone: meetings are calendar cards with tick marks and a direction arrow, the all-hands is a long chain of envelopes behind signal lamps, the logs you ride are round wood with a cut end and a highlighter stripe.
- Nothing flashes faster than 3 times a second. The all-hands lamps flash 2 times a second, the hawk alarm pulses at most 3 times a second, and the test suite checks both. With reduced motion on, the hawk alarm is a steady red glow with no pulse.
- Menu buttons are at least 48px, with a visible focus ring. Menus work with the keyboard, and the initials picker takes typed letters.
- `prefers-reduced-motion` turns off the hit shake and splash droplets.

## Known limits

- Frame rate is verified at 60fps in headless Chromium on a desktop machine, not yet on a mid-range phone.
- Sounds and music are synthesized with the Web Audio API. The tests check that notes are scheduled and layers build, not how they sound.
- The daily challenge seed uses the device's local date. Two people in different time zones get the same course for the same date, but not always at the same moment.
- Booth sign-ups live in one browser on one device. Export them before clearing site data.
- Scores are per device and per browser. Clearing site data clears them.

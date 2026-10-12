# Otter Crossing

An endless lane-hopper for Otter.ai. Hop through a workday full of meetings and learn Otter features along the way.

Status: milestone 3. All lane types, the Deadline Hawk, action item tokens, power-ups, the game over teaching screen and the local top 10 are in. The full README (adding lanes and power-ups, flags, deploying) and COPY_REVIEW.md arrive with milestone 4.

## Play it

Open `dist/otter-crossing.html` in any modern browser. It is one self-contained file and runs offline, including from `file://`.

## Develop

```sh
npm install
npm run build     # writes dist/otter-crossing.html
npm run watch     # rebuilds when src/ changes; refresh the browser
npm test          # generator rules over 16,000 lanes (traffic caps, highlight timing,
                  # breathers, all-hands warnings), plus copy checks
npm run smoke     # headless browser smoke test and screenshots in screenshots/
```

The smoke test looks for Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Set `CHROMIUM_PATH` to use another one.

## Where things live

- `src/content.js`: every piece of on-screen copy. Edit text here, not in game code.
- `src/config.js`: mode flags (`AUDIENCE`, `SHOW_UNRELEASED`, `BOOTH_MODE`) and tuning numbers.
- `src/styles.css`: colors and fonts as CSS variables. `--c-brand` is a placeholder for the official Otter blue.
- `src/lanes/`: one module per lane type, registered in `src/lanes/registry.js`.
- `src/powerups/`: one module per power-up, registered in `src/powerups/registry.js`.

## Debug

Add to the URL:

- `?debug=1` shows FPS and a panel with invincibility and hitbox toggles (keys I and H).
- `?lane=meetings`, `?lane=river`, `?lane=allhands` or `?lane=focus` spawns only that lane type (plus focus-time breathers).
- `?start=300` starts at a later difficulty.
- `?seed=42` replays the same course.
- `?powerup=notetaker`, `aiChat`, `summary`, `actionItems` or `liveAssist` grants that power-up at the start. Live Assist only spawns naturally when `SHOW_UNRELEASED` is true, but the debug grant works either way.

## Fonts

Overpass and Overpass Mono, SIL Open Font License 1.1, inlined at build time from `@fontsource`.

# Otter Crossing

An endless lane-hopper for Otter.ai. Hop through a workday full of meetings and learn Otter features along the way.

Status: milestone 2. Focus time, meeting traffic, the transcript river, the all-hands express, the Deadline Hawk and action item tokens are in. Power-ups, the teaching recap, the leaderboard and polish come in milestone 3. The full README arrives with milestone 4.

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

## Debug

Add to the URL:

- `?debug=1` shows FPS and a panel with invincibility and hitbox toggles (keys I and H).
- `?lane=meetings`, `?lane=river`, `?lane=allhands` or `?lane=focus` spawns only that lane type (plus focus-time breathers).
- `?start=300` starts at a later difficulty.
- `?seed=42` replays the same course.

## Fonts

Overpass and Overpass Mono, SIL Open Font License 1.1, inlined at build time from `@fontsource`.

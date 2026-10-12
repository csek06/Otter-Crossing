// Mode flags and tuning numbers. Copy lives in content.js, not here.

export const FLAGS = {
  // "external" (default) or "internal". Internal uses internal meeting titles and hides the external CTA.
  AUDIENCE: 'external',
  // Unreleased features stay hidden until launch.
  SHOW_UNRELEASED: false,
  // Trade show booth behavior (stretch goal, not built yet).
  BOOTH_MODE: false,
};

export const GRID = {
  COLS: 9,            // playable columns
  VIEW_COLS: 10,      // playable columns plus half a tile of office facade on each side
  ROW_SCALE: 0.9,     // on-screen row height relative to tile width (camera tilt)
  START_COL: 4,
  START_ZONE: 3,      // safe focus rows at the start of a run
  BEHIND: 6,          // rows kept on screen behind the otter
};

export const TUNING = {
  HOP_TIME: 0.12,             // seconds per hop
  INPUT_BUFFER: 3,            // queued moves
  SWIPE_MIN: 24,              // CSS px before a touch counts as a swipe
  PLAYER_HALF_W: 0.3,         // hitbox half width in tiles (art is about 0.42)
  HAZARD_INSET: 0.1,          // hitbox inset on each side of hazards, in tiles
  CAMERA_CREEP_MIN: 0.28,     // rows per second the camera advances on its own
  CAMERA_CREEP_MAX: 0.6,
  CAMERA_FOLLOW: 4,           // how quickly the camera catches up to the otter
  DIFFICULTY_ROWS: 320,       // rows until difficulty reaches 1
  DEATH_DELAY: 0.75,          // seconds of death animation before the game over screen
  LOOKAHEAD_ROWS: 26,         // lanes generated ahead of the camera
};

// Generator rules. The automated test in test/generator.test.mjs checks these.
export const RULES = {
  MEETING_DENSITY_MIN: 0.3,   // occupancy cap at difficulty 0
  MEETING_DENSITY_MAX: 0.55,  // occupancy cap at difficulty 1, never higher
  MEETING_MIN_GAP: 1.5,       // tiles between any two meetings
  MEETING_OPEN_TIME: 0.6,     // every lane has a gap that leaves a column open this long
  MAX_HAZARD_RUN_MIN: 2,      // hazard lanes in a row before a breather, early
  MAX_HAZARD_RUN_MAX: 5,      // and late
  BREATHER_CHANCE_MIN: 0.15,  // chance of an extra breather lane, late
  BREATHER_CHANCE_MAX: 0.38,  // and early
  RIVER_MAX_WAIT: 2,          // a highlight passes any river column at least this often (seconds)
  SWIM_TIME: 1,               // seconds the otter can swim before it is swept away
  ALLHANDS_MIN_WARNING: 1,    // signal fires at least this many seconds before the train arrives
  ALLHANDS_BLINK_HZ: 2,       // signal lamp flashes per second, never above 3
  HAWK_WARN: 5,               // seconds without forward progress before the shadow appears
  HAWK_STRIKE: 7,             // seconds without forward progress before the hawk strikes
  TOKEN_CHANCE: 0.24,         // chance a lane carries an action item token
  POWERUP_FIRST_MIN: 5,       // the first power-up is placed from this many lanes in
  POWERUP_FIRST_BY: 15,       // and is guaranteed within this many lanes
  POWERUP_GAP_MIN: 25,        // lanes between later power-ups
  POWERUP_GAP_MAX: 40,
};

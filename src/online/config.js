// Where the online leaderboards live. tools/build.mjs fills these in from the
// SUPABASE_URL and SUPABASE_ANON_KEY environment variables (GitHub repository
// variables in CI). Empty means the game is offline-only, as before.
// With ?debug=1 the boards are off unless ?sbUrl=...&sbKey=... point at a test project.

/* global __SUPABASE_URL__, __SUPABASE_ANON_KEY__ */
import { PARAMS } from '../core/params.js';

const built = {
  url: typeof __SUPABASE_URL__ === 'string' ? __SUPABASE_URL__ : '',
  anonKey: typeof __SUPABASE_ANON_KEY__ === 'string' ? __SUPABASE_ANON_KEY__ : '',
};

// Debug runs (invincible, ?start=, ?lane=) never post to the real boards.
const off = { url: '', anonKey: '' };
export const ONLINE_CONFIG = PARAMS.debug
  ? (PARAMS.sbUrl && PARAMS.sbKey ? { url: PARAMS.sbUrl, anonKey: PARAMS.sbKey } : off)
  : PARAMS.offline ? off : built;

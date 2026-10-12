// URL parameters: ?booth=1 turns on booth mode without a rebuild. ?event=<code> puts
// scores on an event board (when online). ?offline=1 turns online boards off.
// For debugging: ?debug=1 ?lane=<type> ?start=<lanes> ?powerup=<id> ?seed=<n> ?idle=<seconds>

const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const PARAMS = {
  debug: q.get('debug') === '1',
  lane: q.get('lane') || null,
  start: Math.max(0, parseInt(q.get('start') || '0', 10) || 0),
  powerup: q.get('powerup') || null,
  seed: q.has('seed') ? parseInt(q.get('seed'), 10) >>> 0 : null,
  booth: q.get('booth') === '1',
  event: /^[a-z0-9][a-z0-9-]{1,39}$/i.test(q.get('event') || '') ? q.get('event').toLowerCase() : null,
  offline: q.get('offline') === '1',
  // Debug only: point the online boards at another Supabase project (or a test mock).
  sbUrl: q.get('debug') === '1' ? q.get('sbUrl') : null,
  sbKey: q.get('debug') === '1' ? q.get('sbKey') : null,
  company: q.get('debug') === '1' && q.get('company') === '1', // debug: show company boards
  // Booth idle timeout override, debug builds only, so tests do not wait 20 seconds.
  idle: q.get('debug') === '1' && q.has('idle') ? Math.max(1, parseFloat(q.get('idle')) || 20) : null,
};

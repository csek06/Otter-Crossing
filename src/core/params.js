// URL parameters: ?booth=1 turns on booth mode without a rebuild.
// For debugging: ?debug=1 ?lane=<type> ?start=<lanes> ?powerup=<id> ?seed=<n> ?idle=<seconds>

const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const PARAMS = {
  debug: q.get('debug') === '1',
  lane: q.get('lane') || null,
  start: Math.max(0, parseInt(q.get('start') || '0', 10) || 0),
  powerup: q.get('powerup') || null,
  seed: q.has('seed') ? parseInt(q.get('seed'), 10) >>> 0 : null,
  booth: q.get('booth') === '1',
  // Booth idle timeout override, debug builds only, so tests do not wait 20 seconds.
  idle: q.get('debug') === '1' && q.has('idle') ? Math.max(1, parseFloat(q.get('idle')) || 20) : null,
};

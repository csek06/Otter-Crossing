// URL parameters for debugging: ?debug=1 ?lane=<type> ?start=<lanes> ?powerup=<id> ?seed=<n>

const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const PARAMS = {
  debug: q.get('debug') === '1',
  lane: q.get('lane') || null,
  start: Math.max(0, parseInt(q.get('start') || '0', 10) || 0),
  powerup: q.get('powerup') || null,
  seed: q.has('seed') ? parseInt(q.get('seed'), 10) >>> 0 : null,
};

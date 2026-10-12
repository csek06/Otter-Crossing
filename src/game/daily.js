// Daily challenge: one course per calendar day, the same for everyone, so a team
// can compare scores. The seed comes from the local date, so a date always maps
// to the same course wherever you are.

import { load, save } from '../core/storage.js';

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// FNV-1a over the date string. Changing the salt changes every daily course.
export function dailySeed(key) {
  const s = 'otter-crossing-daily:' + key;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Today's best, kept for the current date only.
export function dailyBest(key = dateKey()) {
  const d = load('daily', null);
  return d && d.date === key ? d : { date: key, best: 0, items: 0, runs: 0 };
}

export function recordDaily(score, items, key = dateKey()) {
  const d = dailyBest(key);
  d.runs++;
  const isBest = score > d.best;
  if (isBest) {
    d.best = score;
    d.items = items;
  }
  save('daily', d);
  return { ...d, isBest };
}

// Text for pasting into Slack. tpl comes from content.js with {date}, {lanes} and {items}.
export function shareText(tpl, key, lanes, items) {
  return tpl.replace('{date}', key).replace('{lanes}', String(lanes)).replace('{items}', String(items));
}

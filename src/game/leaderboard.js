// Local top 10 with 3-letter initials, kept in localStorage.

import { load, save } from '../core/storage.js';

const KEY = 'top10';
const SIZE = 10;

export function topScores() {
  const list = load(KEY, []);
  return Array.isArray(list) ? list.filter((e) => e && typeof e.score === 'number') : [];
}

export function qualifies(score) {
  if (score <= 0) return false;
  const list = topScores();
  return list.length < SIZE || score > list[list.length - 1].score;
}

export function cleanInitials(s) {
  return (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
}

// Returns the new entry's id so the leaderboard can mark it.
export function addScore(initials, score, items) {
  const entry = { id: Date.now() + Math.random(), initials: cleanInitials(initials), score, items, date: new Date().toISOString().slice(0, 10) };
  const list = topScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.items - a.items);
  save(KEY, list.slice(0, SIZE));
  save('lastInitials', entry.initials);
  return entry.id;
}

export function lastInitials() {
  return load('lastInitials', 'OTR');
}

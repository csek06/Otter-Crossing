// Booth sign-ups, stored on this device only. Nothing is sent anywhere. Staff
// export a CSV from the hidden admin screen and clear the device after the event.

import { load, save } from '../core/storage.js';

const KEY = 'signups';

export function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim()) && String(s).trim().length <= 254;
}

export function signups() {
  const list = load(KEY, []);
  return Array.isArray(list) ? list : [];
}

// Only call this when the visitor ticked the consent box.
export function addSignup({ email, consent, score, items }, now = new Date()) {
  if (!validEmail(email)) return false;
  const list = signups();
  list.push({ email: String(email).trim(), consent, score, items, time: now.toISOString() });
  save(KEY, list);
  return true;
}

export function clearSignups() {
  save(KEY, []);
}

// Quote every cell, and stop spreadsheets from reading a cell as a formula.
function cell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(list) {
  const head = ['email', 'consent_text', 'score', 'action_items', 'time'];
  const rows = list.map((r) => [r.email, r.consent, r.score, r.items, r.time]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// localStorage wrapper that fails quietly (private browsing, file:// quirks).

const PREFIX = 'otterCrossing.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable. Scores just will not persist.
  }
}

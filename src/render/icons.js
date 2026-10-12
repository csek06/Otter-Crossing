// Feature icons as 24x24 SVG path data. The same paths draw in the DOM (HUD,
// game over recap) and on the canvas (pickups) through Path2D.

export const ICONS = {
  notetaker: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h3',
  aiChat: 'M4 5h16v11H11l-5 4v-4H4zM8 10.5h.01M12 10.5h.01M16 10.5h.01',
  summary: 'M4 6h16M4 11h12M4 16h7M16 15l3 3-3 3',
  actionItems: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12l3 3 5-6',
  highlights: 'M14 4l6 6-8 8H6v-6zM4 21h16',
  liveAssist: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  workMode: 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 7h16v12H4zM4 12h16M11 12v2h2v-2',
};

export function iconSvg(id, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[id] || ''}"/></svg>`;
}

const paths = new Map();
export function iconPath(id) {
  if (!paths.has(id)) paths.set(id, new Path2D(ICONS[id] || ''));
  return paths.get(id);
}

// Canvas colors come from the CSS variables in styles.css, so swapping the brand blue
// there updates the game art too. Fallbacks match styles.css.

const FALLBACK = {
  paper: '#F3EEE4',
  ink: '#2A211C',
  brand: '#3B5BDB',
  teal: '#0F2F37',
  highlighter: '#FFE14D',
  red: '#E5484D',
};

export const PAL = { ...FALLBACK };

export function loadPalette() {
  if (typeof getComputedStyle === 'undefined') return PAL;
  const css = getComputedStyle(document.documentElement);
  for (const key of Object.keys(FALLBACK)) {
    const v = css.getPropertyValue('--c-' + key).trim();
    PAL[key] = v || FALLBACK[key];
  }
  // Derived tones. Everything in the game is a mix of the six named colors.
  PAL.paperDark = mix(PAL.paper, PAL.ink, 0.07);
  PAL.paperDeep = mix(PAL.paper, PAL.ink, 0.14);
  PAL.track = mix(PAL.paper, PAL.brand, 0.13);
  PAL.trackLine = mix(PAL.paper, PAL.brand, 0.24);
  PAL.inkSoft = mix(PAL.ink, PAL.paper, 0.35);
  PAL.fur = mix(mix(PAL.ink, PAL.paper, 0.3), PAL.red, 0.16);
  PAL.furDark = mix(mix(PAL.ink, PAL.paper, 0.12), PAL.red, 0.1);
  PAL.cream = mix(PAL.paper, PAL.ink, 0.04);
  PAL.brandTop = mix(PAL.brand, PAL.paper, 0.08);
  PAL.brandFront = mix(PAL.brand, PAL.ink, 0.4);
  PAL.brandStripe = mix(PAL.brand, PAL.ink, 0.25);
  PAL.brandText = mix(PAL.paper, PAL.brand, 0.04);
  PAL.leaf = mix(PAL.teal, PAL.paper, 0.38);
  PAL.leafDark = mix(PAL.teal, PAL.paper, 0.2);
  PAL.wall = mix(PAL.ink, PAL.paper, 0.72);
  PAL.wallDark = mix(PAL.ink, PAL.paper, 0.55);
  PAL.screen = mix(PAL.teal, PAL.paper, 0.12);
  PAL.screenFace = mix(PAL.teal, PAL.paper, 0.45);
  PAL.shadow = 'rgba(42, 33, 28, 0.18)';
  return PAL;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Mix color a toward color b by t (0 to 1).
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

loadPalette();

// Canvas colors come from the CSS variables in styles.css, so swapping the brand blue
// there updates the game art too. Fallbacks match styles.css.

const FALLBACK = {
  paper: '#F3EEE4',
  ink: '#2A211C',
  brand: '#144FFF',
  teal: '#0F2F37',
  highlighter: '#FFE14D',
  red: '#E5484D',
  water: '#1F5FA8',
  grass: '#5E9E4A',
  power: '#22D35E',
};

export const PAL = { ...FALLBACK };

export function loadPalette() {
  if (typeof getComputedStyle === 'undefined') return PAL;
  const css = getComputedStyle(document.documentElement);
  for (const key of Object.keys(FALLBACK)) {
    const v = css.getPropertyValue('--c-' + key).trim();
    PAL[key] = v || FALLBACK[key];
  }
  // Derived tones. Everything in the game is a mix of the nine named colors.
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
  PAL.shadow = rgba(PAL.ink, 0.18);
  // Transcript river.
  PAL.riverLine = mix(PAL.water, PAL.ink, 0.45);
  PAL.waterDeep = mix(PAL.water, PAL.ink, 0.18);
  PAL.waveCrest = rgba(PAL.paper, 0.42);
  PAL.waterRing = rgba(PAL.ink, 0.16);
  // Floating logs: warm wood from red and highlighter, shaded with ink.
  PAL.wood = mix(mix(PAL.red, PAL.highlighter, 0.45), PAL.ink, 0.42);
  PAL.woodDark = mix(PAL.wood, PAL.ink, 0.35);
  PAL.woodEnd = mix(PAL.wood, PAL.paper, 0.5);
  PAL.woodRing = mix(PAL.wood, PAL.ink, 0.1);
  PAL.highlighterEdge = mix(PAL.highlighter, PAL.ink, 0.35);
  PAL.glow = rgba(PAL.highlighter, 0.16);
  PAL.glowStrong = rgba(PAL.highlighter, 0.38);
  PAL.ripple = rgba(PAL.paper, 0.55);
  // All-hands rail.
  PAL.rail = mix(PAL.ink, PAL.paper, 0.22);
  PAL.railTie = mix(PAL.ink, PAL.paper, 0.38);
  PAL.railSteel = mix(PAL.ink, PAL.paper, 0.6);
  PAL.redSoft = rgba(PAL.red, 0.35);
  PAL.redDim = mix(PAL.red, PAL.ink, 0.6);
  // Power-ups: the green badge, its darker edge and the light center of its glow.
  PAL.powerDeep = mix(PAL.power, PAL.ink, 0.38);
  PAL.powerLight = mix(PAL.power, PAL.paper, 0.55);
  // The daily challenge's habitat: meadow, trail, forest and riverbank.
  PAL.grassLight = mix(PAL.grass, PAL.highlighter, 0.18);
  PAL.grassDark = mix(PAL.grass, PAL.teal, 0.3);
  PAL.forest = mix(PAL.grass, PAL.teal, 0.72);
  PAL.forestDeep = mix(PAL.forest, PAL.ink, 0.35);
  PAL.pine = mix(PAL.grass, PAL.teal, 0.5);
  PAL.dirt = mix(PAL.wood, PAL.paper, 0.45);
  PAL.dirtDark = mix(PAL.dirt, PAL.ink, 0.18);
  PAL.sand = mix(mix(PAL.paper, PAL.highlighter, 0.2), PAL.teal, 0.12);
  PAL.sandDark = mix(PAL.sand, PAL.ink, 0.2);
  PAL.gravel = mix(PAL.paper, PAL.teal, 0.24);
  PAL.stone = mix(PAL.paper, PAL.teal, 0.42);
  PAL.stoneDark = mix(PAL.stone, PAL.ink, 0.3);
  PAL.fox = mix(PAL.red, PAL.highlighter, 0.35);
  PAL.foxDark = mix(PAL.fox, PAL.ink, 0.3);
  PAL.brown = mix(PAL.wood, PAL.ink, 0.25);
  PAL.brownDark = mix(PAL.wood, PAL.ink, 0.55);
  PAL.shell = mix(PAL.grass, PAL.ink, 0.3);
  PAL.goose = mix(PAL.ink, PAL.paper, 0.55);
  PAL.beak = mix(PAL.highlighter, PAL.red, 0.35);
  PAL.berry = PAL.red;
  // River crocodiles.
  PAL.croc = mix(PAL.grass, PAL.ink, 0.38);
  PAL.crocDark = mix(PAL.croc, PAL.ink, 0.38);
  PAL.crocBelly = mix(PAL.grass, PAL.paper, 0.4);
  PAL.mouth = mix(PAL.red, PAL.ink, 0.35);
  // Halloween costumes.
  PAL.pumpkin = mix(PAL.red, PAL.highlighter, 0.48);
  PAL.pumpkinDark = mix(PAL.pumpkin, PAL.ink, 0.3);
  PAL.witch = mix(mix(PAL.brand, PAL.red, 0.45), PAL.ink, 0.35);
  PAL.witchDark = mix(PAL.witch, PAL.ink, 0.4);
  PAL.bandage = mix(PAL.paper, PAL.highlighter, 0.12);
  PAL.bandageLine = mix(PAL.paper, PAL.ink, 0.3);
  return PAL;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Mix color a toward color b by t (0 to 1).
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

loadPalette();

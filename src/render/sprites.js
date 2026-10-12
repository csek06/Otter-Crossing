// Offscreen sprite cache. Text-heavy art (meeting blocks) is drawn once per size
// and reused every frame, which keeps mid-range phones at 60fps.

const cache = new Map();
let cacheScale = 0;
let cacheTile = 0;

export function sprite(key, w, h, v, draw) {
  if (v.scale !== cacheScale || v.tile !== cacheTile) {
    cache.clear();
    cacheScale = v.scale;
    cacheTile = v.tile;
  }
  let img = cache.get(key);
  if (img) return img;
  img = document.createElement('canvas');
  img.width = Math.ceil(w * v.scale);
  img.height = Math.ceil(h * v.scale);
  const c = img.getContext('2d');
  c.scale(v.scale, v.scale);
  draw(c);
  cache.set(key, img);
  return img;
}

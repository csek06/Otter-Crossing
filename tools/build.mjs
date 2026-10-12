// Builds dist/otter-crossing.html: one self-contained file with the JS, CSS and fonts
// inlined. Runs offline from file://.
//
//   node tools/build.mjs          build once
//   node tools/build.mjs --watch  rebuild when src/ changes

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'dist', 'otter-crossing.html');

// Open-license fonts (SIL OFL 1.1), Latin subset, inlined as base64.
const FONTS = [
  { family: 'Overpass', weight: 800, file: 'node_modules/@fontsource/overpass/files/overpass-latin-800-normal.woff2' },
  { family: 'Overpass Mono', weight: 600, file: 'node_modules/@fontsource/overpass-mono/files/overpass-mono-latin-600-normal.woff2' },
];

function fontCss() {
  return FONTS.map((f) => {
    const b64 = readFileSync(join(root, f.file)).toString('base64');
    return `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  }).join('\n');
}

async function run() {
  const t0 = Date.now();
  const result = await build({
    entryPoints: [join(src, 'main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2019'],
    write: false,
    legalComments: 'none',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(join(src, 'styles.css'), 'utf8');
  const html = readFileSync(join(src, 'index.html'), 'utf8')
    .replace('/*FONTS*/', () => fontCss())
    .replace('/*STYLES*/', () => css)
    .replace('/*SCRIPT*/', () => js);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`Built ${out} (${(html.length / 1024).toFixed(0)} KB) in ${Date.now() - t0}ms`);
}

await run();

if (process.argv.includes('--watch')) {
  let timer = null;
  watch(src, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => run().catch((e) => console.error(e.message)), 80);
  });
  console.log('Watching src/ for changes.');
}

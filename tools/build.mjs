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
  const { url: sbUrl, key: sbKey, kind } = publicKey();
  const result = await build({
    entryPoints: [join(src, 'main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2019'],
    write: false,
    legalComments: 'none',
    // Online leaderboards (optional). Both empty means offline-only.
    define: {
      __SUPABASE_URL__: JSON.stringify(sbUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(sbKey),
      __COMPANY_BOARDS__: JSON.stringify(process.env.COMPANY_BOARDS === '1'),
    },
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(join(src, 'styles.css'), 'utf8');
  const html = readFileSync(join(src, 'index.html'), 'utf8')
    .replace('/*FONTS*/', () => fontCss())
    .replace('/*STYLES*/', () => css)
    .replace('/*SCRIPT*/', () => js);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  const online = sbUrl && sbKey ? `online boards: ${sbUrl}, ${kind} key${process.env.COMPANY_BOARDS === '1' ? ', company boards on' : ''}` : 'offline only';
  console.log(`Built ${out} (${(html.length / 1024).toFixed(0)} KB, ${online}) in ${Date.now() - t0}ms`);
}

// The key ends up in a public web page, so only a public key may go in. A secret
// or service_role key here would hand out full database access: refuse it and
// build offline instead, with an error in the CI log.
export function keyKind(key) {
  if (/^sb_publishable_/.test(key)) return 'publishable';
  if (/^sb_secret_/.test(key)) return 'secret';
  if (/^eyJ/.test(key)) {
    try {
      const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
      return role === 'anon' ? 'legacy anon' : `legacy ${role || 'unknown'}`;
    } catch { return 'unknown'; }
  }
  return 'unknown';
}
function publicKey() {
  const url = process.env.SUPABASE_URL || '';
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return { url: '', key: '', kind: '' };
  const kind = keyKind(key);
  if (kind === 'publishable' || kind === 'legacy anon') return { url, key, kind };
  console.log(`::error::SUPABASE_ANON_KEY is a ${kind} key, which must never go in the public game. Built offline instead. Use the project's publishable key (sb_publishable_...) or remove SUPABASE_ANON_KEY so the build looks it up.`);
  return { url: '', key: '', kind: '' };
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

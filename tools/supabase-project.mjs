// Works out which Supabase project to use, so SUPABASE_PROJECT_ID is optional:
// 1. SUPABASE_PROJECT_ID, if set
// 2. the ref inside SUPABASE_URL (https://<ref>.supabase.co), if set
// 3. the only project the access token can see
// Run directly, it writes PROJECT_REF to $GITHUB_ENV.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolveRef({ token, ref, url } = process.env) {
  if (ref && ref.trim()) return { ref: ref.trim(), how: 'SUPABASE_PROJECT_ID' };
  const m = /^https:\/\/([a-z0-9]{8,40})\.supabase\.co\b/.exec(String(url || '').trim());
  if (m) return { ref: m[1], how: 'SUPABASE_URL' };
  if (!token) return { error: 'No SUPABASE_ACCESS_TOKEN secret.' };
  const res = await fetch('https://api.supabase.com/v1/projects', { headers: { Authorization: `Bearer ${token}` } }).catch((e) => ({ ok: false, status: e.message }));
  if (!res.ok) return { error: `Couldn't list projects with the access token (${res.status}). Check that SUPABASE_ACCESS_TOKEN is a personal access token from supabase.com/dashboard/account/tokens.` };
  const list = await res.json();
  if (list.length === 1) return { ref: list[0].id || list[0].ref, how: `the only project on the token ("${list[0].name}")` };
  if (!list.length) return { error: 'The access token can see no projects.' };
  return { error: `The token can see ${list.length} projects: ${list.map((p) => `"${p.name}" (${p.id || p.ref})`).join(', ')}. Add a SUPABASE_PROJECT_ID secret with the ref to use.` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await resolveRef({ token: process.env.SUPABASE_ACCESS_TOKEN, ref: process.env.SUPABASE_PROJECT_ID, url: process.env.SUPABASE_URL });
  if (r.error) { console.log(`::error::${r.error}`); process.exit(1); }
  appendFileSync(process.env.GITHUB_ENV, `PROJECT_REF=${r.ref}\n`);
  console.log(`Project ${r.ref}, from ${r.how}.`);
}

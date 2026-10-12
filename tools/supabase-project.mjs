// Works out which Supabase project to use, so SUPABASE_PROJECT_ID is optional:
// 1. SUPABASE_PROJECT_ID, if set
// 2. the ref inside SUPABASE_URL (https://<ref>.supabase.co), if set
// 3. the only project the access token can see
// Run directly, it writes PROJECT_REF to $GITHUB_ENV.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Names the kind of key in SUPABASE_ACCESS_TOKEN without printing it. The CLI and
// the Management API need a personal access token (sbp_...), not a project API key.
export function tokenProblem(token) {
  const t = String(token || '');
  if (!t) return null;
  if (t !== t.trim()) return 'SUPABASE_ACCESS_TOKEN has spaces or a line break around it. Paste it again without them.';
  if (/^sbp_/.test(t)) return null;
  let kind = 'a value that is not a Supabase personal access token';
  if (/^sb_secret_/.test(t)) kind = "the project's secret API key (sb_secret_...)";
  else if (/^sb_publishable_/.test(t)) kind = "the project's publishable API key (sb_publishable_...)";
  else if (/^eyJ/.test(t)) {
    let role = '';
    try { role = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role || ''; } catch {}
    kind = role ? `the project's legacy ${role} API key (a JWT)` : 'a JWT, not a personal access token';
  }
  return `SUPABASE_ACCESS_TOKEN holds ${kind}. Replace it with a personal access token: supabase.com/dashboard/account/tokens > Generate new token. It starts with sbp_.`;
}

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
  const bad = tokenProblem(process.env.SUPABASE_ACCESS_TOKEN);
  if (bad) { console.log(`::error::${bad}`); process.exit(1); }
  const r = await resolveRef({ token: process.env.SUPABASE_ACCESS_TOKEN, ref: process.env.SUPABASE_PROJECT_ID, url: process.env.SUPABASE_URL });
  if (r.error) { console.log(`::error::${r.error}`); process.exit(1); }
  appendFileSync(process.env.GITHUB_ENV, `PROJECT_REF=${r.ref}\n`);
  console.log(`Project ${r.ref}, from ${r.how}.`);
}

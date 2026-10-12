// Finds the project URL and the public (publishable or legacy anon) key for the
// Pages build, so they don't have to be copied into GitHub by hand. Both are
// public by design. Writes them to $GITHUB_ENV; on any problem it warns and the
// game builds offline only.
import { appendFileSync } from 'node:fs';

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_ID: ref, GITHUB_ENV: out } = process.env;
const warn = (m) => { console.log(`::warning::${m} The game builds offline only.`); process.exit(0); };
if (!token || !ref) warn('No SUPABASE_URL and SUPABASE_ANON_KEY variables, and no access token to look them up.');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers: { Authorization: `Bearer ${token}` } }).catch((e) => warn(`Supabase lookup failed: ${e.message}.`));
if (!res.ok) warn(`Supabase key lookup failed (${res.status}).`);
const keys = await res.json();
const pick = keys.find((k) => k.type === 'publishable' && k.api_key) || keys.find((k) => k.name === 'anon' && k.api_key);
if (!pick) warn('The project has no publishable or anon key.');
appendFileSync(out, `SUPABASE_URL=https://${ref}.supabase.co\nSUPABASE_ANON_KEY=${pick.api_key}\n`);
console.log(`Online boards: https://${ref}.supabase.co with the ${pick.type === 'publishable' ? 'publishable' : 'legacy anon'} key.`);

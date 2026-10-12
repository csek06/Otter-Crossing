// Configures the hosted Supabase project from the repo, through the Management API.
// Run by .github/workflows/supabase.yml after the migrations. Each part is a
// separate call so one failure doesn't hide the others.
//
//   SUPABASE_ACCESS_TOKEN  personal access token (secret)
//   SUPABASE_PROJECT_ID    project ref (secret)
//   SITE_URL               where the game is served (defaults to the Pages URL)
//   RESEND_API_KEY         optional (secret): turns on Resend as the email sender
//   AUTH_EMAIL_FROM        sender address on a domain verified in Resend (variable)
//
// node tools/supabase-setup.mjs --dry-run prints what it would send.

import { readFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const env = process.env;
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_ID;
const site = (env.SITE_URL || 'https://csek06.github.io/Otter-Crossing/').replace(/\/?$/, '/');
const API = 'https://api.supabase.com/v1/projects/' + ref;

if (!DRY && (!token || !ref)) {
  console.log('No SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_ID, so nothing to configure.');
  process.exit(0);
}

let failed = 0;
async function call(label, method, path, body) {
  if (DRY) {
    console.log(`[dry run] ${label}: ${method} ${path}`);
    console.log(JSON.stringify(body, (k, v) => (k === 'smtp_pass' ? '***' : v), 2));
    return {};
  }
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    failed++;
    console.log(`::error::${label} failed (${res.status}): ${text.slice(0, 400)}`);
    return null;
  }
  console.log(`ok   ${label}`);
  return text ? JSON.parse(text) : {};
}

// 1. Where sign-in links may land. The game reads the token from the link's hash.
await call('Auth URLs', 'PATCH', '/config/auth', {
  site_url: site,
  uri_allow_list: [site, site + 'index.html', site + 'otter-crossing.html'].join(','),
});

// 2. Resend as the sender. The built-in sender only allows a few emails an hour.
if (env.RESEND_API_KEY && env.AUTH_EMAIL_FROM) {
  await call('Email sender (Resend SMTP)', 'PATCH', '/config/auth', {
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: env.RESEND_API_KEY,
    smtp_admin_email: env.AUTH_EMAIL_FROM,
    smtp_sender_name: 'Otter Crossing',
    rate_limit_email_sent: 100,
  });
} else if (env.RESEND_API_KEY || env.AUTH_EMAIL_FROM) {
  failed++;
  console.log('::error::Resend needs both the RESEND_API_KEY secret and the AUTH_EMAIL_FROM variable.');
} else {
  console.log('skip Email sender: no RESEND_API_KEY secret yet, Supabase keeps its built-in test sender.');
}

// 3. The email. The game asks for the code, and the link in the same email works too.
// New players get the "confirm signup" email, returning ones the "magic link" email,
// so both carry the code.
const subject = 'Your Otter Crossing code';
const html = `<h2>Your Otter Crossing code</h2>
<p>Enter this code in the game to join your company board:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Or <a href="{{ .ConfirmationURL }}">sign in with this link</a> on this device.</p>
<p>The code works for one hour. If you didn't ask for it, you can ignore this email.</p>`;
// Free projects on Supabase's built-in sender can't change the email, so this
// waits for a custom sender.
const customSmtp = !!(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM);
if (!customSmtp) console.log('skip Sign-in email: needs a custom sender (Supabase refuses template changes on the built-in one).');
else await call('Sign-in email', 'PATCH', '/config/auth', {
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  mailer_subjects_magic_link: subject,
  mailer_templates_magic_link_content: html,
  mailer_subjects_confirmation: subject,
  mailer_templates_confirmation_content: html,
});

// 4. Events from supabase/events.json. Upserts, so editing a row and rerunning updates it.
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/; // same as the events table check
const events = JSON.parse(readFileSync(new URL('../supabase/events.json', import.meta.url), 'utf8')).events || [];
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = [];
for (const e of events) {
  const ok = e && SLUG.test(e.id) && e.name && !Number.isNaN(Date.parse(e.starts_at)) && !Number.isNaN(Date.parse(e.ends_at)) && Date.parse(e.ends_at) > Date.parse(e.starts_at);
  if (!ok) { failed++; console.log(`::error::Bad event in supabase/events.json: ${JSON.stringify(e)}`); continue; }
  rows.push(`(${lit(e.id)}, ${lit(e.name)}, ${lit(e.starts_at)}::timestamptz, ${lit(e.ends_at)}::timestamptz)`);
}
if (rows.length) {
  await call(`Events (${rows.length})`, 'POST', '/database/query', {
    query: `insert into public.events (id, name, starts_at, ends_at) values ${rows.join(', ')}
on conflict (id) do update set name = excluded.name, starts_at = excluded.starts_at, ends_at = excluded.ends_at;`,
  });
} else {
  console.log('skip Events: supabase/events.json has none.');
}

if (failed) process.exit(1);

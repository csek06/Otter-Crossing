// The online leaderboard client against a fake Supabase.
//   npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOnline } from '../src/online/client.js';

function memoryStore() {
  const data = {};
  return { data, load: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), save: (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); } };
}

// routes: { 'POST /rest/v1/rpc/start_run': (body, headers) => [status, json] }
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    const path = url.replace('https://proj.supabase.co', '');
    const key = `${opts.method} ${path}`;
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ key, body, headers: opts.headers });
    const h = routes[key];
    if (h === 'offline') throw new TypeError('Failed to fetch');
    if (!h) return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'no_route' }) };
    const [status, json] = h(body, opts.headers);
    return { ok: status < 300, status, text: async () => (json === undefined ? '' : JSON.stringify(json)) };
  };
  fn.calls = calls;
  return fn;
}

const base = { url: 'https://proj.supabase.co/', anonKey: 'anon-key' };

test('online: off without a URL and key, and makes no requests', async () => {
  const f = fakeFetch({});
  const o = createOnline({ url: '', anonKey: '', fetchImpl: f, store: memoryStore() });
  assert.equal(o.enabled, false);
  o.startRun('free');
  await assert.rejects(o.submit({ initials: 'PAT', score: 5, items: 0 }));
  await assert.rejects(o.board('global'));
  assert.equal(f.calls.length, 0);
});

test('online: a run posts with the device id, anon key headers and ranks back', async () => {
  const f = fakeFetch({
    'POST /rest/v1/rpc/start_run': () => [200, 'run-1'],
    'POST /rest/v1/rpc/submit_score': () => [200, { global: 12 }],
    'POST /rest/v1/rpc/leaderboard': () => [200, [{ rank: 1, initials: 'PAT', score: 80, items: 2, is_you: true }]],
  });
  const store = memoryStore();
  const o = createOnline({ ...base, fetchImpl: f, store });
  assert.ok(o.enabled);
  assert.match(o.device(), /^[A-Za-z0-9_-]{16,64}$/);
  assert.equal(createOnline({ ...base, fetchImpl: f, store }).device(), o.device(), 'device id persists');
  o.startRun('daily', '2026-10-12', 'summit-2026');
  const ranks = await o.submit({ initials: 'PAT', score: 40, items: 3, company: true });
  assert.deepEqual(ranks, { global: 12 });
  const [start, submit] = f.calls;
  assert.deepEqual(start.body, { p_device: o.device(), p_mode: 'daily', p_daily_key: '2026-10-12', p_event: 'summit-2026' });
  assert.equal(start.headers.apikey, 'anon-key');
  assert.equal(start.headers.Authorization, 'Bearer anon-key');
  assert.equal(submit.body.p_run, 'run-1');
  assert.equal(submit.body.p_company, false, 'no company without a signed-in work domain');
  await assert.rejects(o.submit({ initials: 'PAT', score: 40, items: 3 }), /no_run/, 'one post per run');
  const rows = await o.board('global');
  assert.equal(rows[0].initials, 'PAT');
  assert.equal(f.calls[2].body.p_device, o.device());
});

test('online: offline posts queue and flush later; rejected ones are dropped', async () => {
  const routes = {
    'POST /rest/v1/rpc/start_run': () => [200, 'run-2'],
    'POST /rest/v1/rpc/submit_score': 'offline',
  };
  const store = memoryStore();
  const o = createOnline({ ...base, fetchImpl: fakeFetch(routes), store });
  o.startRun('free');
  assert.deepEqual(await o.submit({ initials: 'SAM', score: 9, items: 1 }), { queued: true });
  assert.equal(o.pending(), 1);
  assert.equal(store.data['online.queue'].length, 1, 'queue survives a reload');
  routes['POST /rest/v1/rpc/submit_score'] = () => [200, { global: 3 }];
  assert.equal(await o.flush(), 1);
  assert.equal(o.pending(), 0);

  routes['POST /rest/v1/rpc/submit_score'] = 'offline';
  o.startRun('free');
  await o.submit({ initials: 'SAM', score: 9, items: 1 });
  routes['POST /rest/v1/rpc/submit_score'] = () => [400, { message: 'run_expired' }];
  assert.equal(await o.flush(), 0);
  assert.equal(o.pending(), 0, 'server rejections are not retried');
});

test('online: server errors come back as codes', async () => {
  const o = createOnline({ ...base, store: memoryStore(), fetchImpl: fakeFetch({
    'POST /rest/v1/rpc/start_run': () => [200, 'run-3'],
    'POST /rest/v1/rpc/submit_score': () => [400, { code: '22023', message: 'implausible_score' }],
  }) });
  o.startRun('free');
  await assert.rejects(o.submit({ initials: 'PAT', score: 9999, items: 0 }), /implausible_score/);
});

test('online: work email sign-in, company posts, refresh and sign out', async () => {
  let t = 1_000_000_000_000;
  const routes = {
    'POST /auth/v1/otp': (b) => [200, {}],
    'POST /auth/v1/verify': (b) => (b.token === '123456' ? [200, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, user: { email: b.email } }] : [403, { msg: 'Token has expired or is invalid' }]),
    'POST /rest/v1/rpc/claim_company': (b, h) => [200, h.Authorization === 'Bearer at-1' || h.Authorization === 'Bearer at-2' ? 'acme-robotics.com' : null],
    'POST /auth/v1/token?grant_type=refresh_token': (b) => [200, { access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600 }],
    'POST /rest/v1/rpc/start_run': () => [200, 'run-4'],
    'POST /rest/v1/rpc/submit_score': () => [200, { global: 5, company: 1 }],
    'POST /auth/v1/logout': () => [204],
  };
  const f = fakeFetch(routes);
  const store = memoryStore();
  const o = createOnline({ ...base, fetchImpl: f, store, now: () => t });
  await o.sendCode(' pat.lee@acme-robotics.com ');
  assert.deepEqual(f.calls[0].body, { email: 'pat.lee@acme-robotics.com', create_user: true });
  await assert.rejects(o.verifyCode('pat.lee@acme-robotics.com', '000000'), /invalid/);
  assert.equal(await o.verifyCode('pat.lee@acme-robotics.com', '123456'), 'acme-robotics.com');
  assert.ok(o.signedIn());
  assert.equal(o.domain(), 'acme-robotics.com');
  assert.equal(o.session().email, 'pat.lee@acme-robotics.com');
  assert.equal(createOnline({ ...base, fetchImpl: f, store }).domain(), 'acme-robotics.com', 'session persists');

  o.startRun('free');
  await o.submit({ initials: 'PAT', score: 30, items: 2, company: true });
  const submit = f.calls.find((c) => c.key.endsWith('submit_score'));
  assert.equal(submit.headers.Authorization, 'Bearer at-1');
  assert.equal(submit.body.p_company, true);

  t += 3600 * 1000; // the access token expires
  o.startRun('free');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(f.calls.some((c) => c.key.includes('refresh_token')), 'refreshes the session');
  assert.equal(o.session().access_token, 'at-2');

  await o.signOut();
  assert.equal(o.signedIn(), false);
  const logout = f.calls.find((c) => c.key === 'POST /auth/v1/logout');
  assert.equal(logout.headers.Authorization, 'Bearer at-2', 'logs out with the user token');
});

test('online: a magic link hash signs in', async () => {
  const o = createOnline({ ...base, store: memoryStore(), fetchImpl: fakeFetch({
    'POST /rest/v1/rpc/claim_company': () => [200, null],
  }) });
  assert.equal(await o.fromHash('#error=nope'), false);
  assert.equal(await o.fromHash('#access_token=a&refresh_token=r&expires_in=3600&type=magiclink'), true);
  assert.ok(o.signedIn());
  assert.equal(o.domain(), null, 'personal email: signed in, no company');
});

// Online leaderboards on Supabase, through its REST and Auth APIs with plain
// fetch (no SDK, so the game stays one offline file). Off unless the build sets
// SUPABASE_URL and SUPABASE_ANON_KEY (see tools/build.mjs). The anon key is meant
// to be public: the database only exposes the functions in supabase/migrations.
//
// What it stores on this device: a random device id, the signed-in session (if
// any), and scores waiting to post while offline.

import { load, save } from '../core/storage.js';

const TIMEOUT = 8000;
const REFRESH_EARLY = 60; // seconds before expiry to refresh the session
const QUEUE_MAX = 20;

export const BOARDS = ['global', 'week', 'daily', 'event', 'company'];

function randomId() {
  const bytes = new Uint8Array(16);
  (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.random() * 256; });
  return 'd' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Turns a Supabase error body into a short code like "implausible_score".
function errorCode(body, status) {
  const m = body && (body.message || body.msg || body.error_description || body.error);
  return typeof m === 'string' && m ? m : `http_${status}`;
}

export function createOnline({ url, anonKey, company = false, fetchImpl = globalThis.fetch, store = { load, save }, now = () => Date.now() } = {}) {
  const base = (url || '').replace(/\/+$/, '');
  const enabled = !!(base && anonKey && fetchImpl);

  let device = store.load('online.device', null);
  if (typeof device !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(device)) {
    device = randomId();
    store.save('online.device', device);
  }
  let session = store.load('online.session', null);
  let queue = store.load('online.queue', []);
  if (!Array.isArray(queue)) queue = [];

  async function request(path, { method = 'POST', body, auth = true, bearer = null } = {}) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT) : 0;
    const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
    // Only a signed-in player's token goes in Authorization. The project key rides on
    // apikey alone: new publishable keys (sb_publishable_...) aren't JWTs and the
    // platform rejects them as a Bearer token.
    const user = auth ? bearer || (await token()) : null;
    if (user) headers.Authorization = `Bearer ${user}`;
    try {
      const res = await fetchImpl(base + path, { method, headers, body: body == null ? undefined : JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!res.ok) {
        const err = new Error(errorCode(data, res.status));
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (e) {
      if (e && e.name === 'AbortError') throw Object.assign(new Error('timeout'), { offline: true });
      if (e && e.status == null && !e.offline) e.offline = true; // network error
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function saveSession(s) {
    session = s;
    store.save('online.session', s);
  }

  // The access token, refreshed when close to expiry. Null when signed out.
  async function token() {
    if (!session) return null;
    if (session.expires_at - REFRESH_EARLY > now() / 1000) return session.access_token;
    try {
      const s = await request('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token }, auth: false });
      saveSession({ ...session, ...sessionFrom(s) });
      return session.access_token;
    } catch (e) {
      if (!e.offline) saveSession(null); // refresh token no longer valid
      return null;
    }
  }

  function sessionFrom(s) {
    return {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(now() / 1000) + (s.expires_in || 3600),
      email: (s.user && s.user.email) || (session && session.email) || '',
    };
  }

  const rpc = (name, args) => request(`/rest/v1/rpc/${name}`, { body: args });

  let run = null; // { id: Promise<uuid|null>, mode, dailyKey }

  const api = {
    enabled,
    // Company boards need sign-in email that reaches players (custom SMTP), so they
    // stay hidden until the build turns them on.
    company: enabled && !!company,
    device: () => device,
    session: () => session,
    signedIn: () => !!session,
    domain: () => (session && session.domain) || null,
    pending: () => queue.length,

    // Call when a real run starts. Failure just means this run can't post.
    startRun(mode = 'free', dailyKey = null, eventCode = null) {
      if (!enabled) return;
      const args = { p_device: device, p_mode: mode, p_daily_key: mode === 'daily' ? dailyKey : null, p_event: eventCode || null };
      run = { mode, dailyKey, id: rpc('start_run', args).catch(() => null) };
    },
    hasRun: () => !!run,

    // Posts the run that just ended. Resolves to the ranks, e.g. { global: 12, company: 2 },
    // or { queued: true } when offline (it retries later), or throws with a code.
    async submit({ initials, score, items, company = false }) {
      if (!enabled || !run) throw new Error('no_run');
      const id = await run.id;
      run = null;
      if (!id) throw Object.assign(new Error('no_run'), { offline: true });
      const args = { p_run: id, p_device: device, p_initials: initials, p_score: score, p_items: items, p_company: !!company && !!api.domain() };
      try {
        return await rpc('submit_score', args);
      } catch (e) {
        if (!e.offline) throw e;
        queue.push(args);
        queue = queue.slice(-QUEUE_MAX);
        store.save('online.queue', queue);
        return { queued: true };
      }
    },

    // Retries queued scores. Drops ones the server rejects.
    async flush() {
      if (!enabled || !queue.length) return 0;
      let sent = 0;
      const keep = [];
      for (const args of queue) {
        try {
          await rpc('submit_score', args);
          sent++;
        } catch (e) {
          if (e.offline) keep.push(args);
        }
      }
      queue = keep;
      store.save('online.queue', queue);
      return sent;
    },

    // Rows: [{ rank, initials, score, items, is_you }]
    board(name, key = null, limit = 10) {
      if (!enabled) return Promise.reject(new Error('offline'));
      return rpc('leaderboard', { p_board: name, p_key: key, p_device: device, p_limit: limit });
    },

    eventInfo(code) {
      if (!enabled || !code) return Promise.resolve(null);
      return rpc('event_info', { p_event: code }).catch(() => null);
    },

    // Work email sign-in with a one-time code. Supabase Auth keeps the email; the
    // game tables only get the domain.
    sendCode(email) {
      return request('/auth/v1/otp', { body: { email: String(email).trim(), create_user: true }, auth: false });
    },
    async verifyCode(email, code) {
      const s = await request('/auth/v1/verify', { body: { type: 'email', email: String(email).trim(), token: String(code).trim() }, auth: false });
      saveSession(sessionFrom(s));
      return api.claim();
    },
    // A magic link lands back here with the session in the URL hash.
    async fromHash(hash) {
      const h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
      if (!h.get('access_token') || !h.get('refresh_token')) return false;
      saveSession(sessionFrom({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 }));
      await api.claim().catch(() => null);
      return true;
    },
    // Records the email domain. Resolves to the domain, or null for personal email.
    async claim() {
      const domain = await rpc('claim_company', {});
      saveSession({ ...session, domain: domain || null });
      return domain || null;
    },
    async signOut() {
      const t = session && (await token());
      saveSession(null);
      if (t) await request('/auth/v1/logout', { body: {}, bearer: t }).catch(() => null);
    },
    // Deletes this device's (and account's) online scores, then signs out.
    async forget() {
      const n = await rpc('forget_me', { p_device: device });
      queue = [];
      store.save('online.queue', queue);
      await api.signOut();
      return n;
    },
  };
  return api;
}

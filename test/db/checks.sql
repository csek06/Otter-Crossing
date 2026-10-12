-- Runs after supabase-stub.sql and the migrations. Any failed assert stops the run.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

-- Helpers: act as the anon role, or as a signed-in user.
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;
create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
$$;
create function pg_temp.expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error % from: %', p_msg, p_sql;
exception when others then
  if position(p_msg in sqlerrm) = 0 then
    raise exception 'expected error % from: %, got: %', p_msg, p_sql, sqlerrm;
  end if;
end $$;
-- Test only: pretend a run started some seconds ago.
create function pg_temp.age_run(p uuid, secs int) returns void language sql as $$
  update public.runs set started_at = now() - make_interval(secs => secs) where id = p;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'pat.lee@acme-robotics.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'sam.rivera@acme-robotics.com', now()),
  ('00000000-0000-0000-0000-00000000000c', 'jo.kim@gmail.com', now()),
  ('00000000-0000-0000-0000-00000000000d', 'casey@globex-labs.com', null),
  ('00000000-0000-0000-0000-00000000000e', 'riley@globex-labs.com', now());
insert into public.events (id, name, starts_at, ends_at) values
  ('summit-2026', 'Fictional Summit 2026', now() - interval '1 day', now() + interval '1 day'),
  ('old-show', 'Old Show', now() - interval '10 days', now() - interval '9 days');

-- 1. No direct table access for the API roles.
set role anon;
select pg_temp.expect_error('select * from public.scores', 'permission denied');
select pg_temp.expect_error('select * from public.runs', 'permission denied');
select pg_temp.expect_error('insert into public.scores (run_id, initials, score, items, mode, device) values (gen_random_uuid(), ''AAA'', 5, 0, ''free'', ''x'')', 'permission denied');
select pg_temp.expect_error('select * from public.players', 'permission denied');
select pg_temp.expect_error('select public.claim_company()', 'permission denied');
reset role;
set role authenticated;
select pg_temp.expect_error('select * from public.scores', 'permission denied');
reset role;

-- 2. Runs and score checks.
set role anon;
select pg_temp.as_anon();
select pg_temp.expect_error($q$ select public.start_run('short') $q$, 'bad_device');
select pg_temp.expect_error($q$ select public.start_run('device-aaaaaaaaaaaaaaaa', 'arcade') $q$, 'bad_mode');
reset role;

create temp table t (k text primary key, v uuid);
grant all on t to anon, authenticated;
set role anon;
insert into t select 'a1', public.start_run('device-aaaaaaaaaaaaaaaa');
-- Too fast: 50 lanes in no time.
select pg_temp.expect_error($q$ select public.submit_score((select v from t where k = 'a1'), 'device-aaaaaaaaaaaaaaaa', 'PAT', 50, 10) $q$, 'implausible_score');
reset role;
select pg_temp.age_run((select v from t where k = 'a1'), 60);
set role anon;
select pg_temp.expect_error($q$ select public.submit_score((select v from t where k = 'a1'), 'device-aaaaaaaaaaaaaaaa', 'PAT', 50, 500) $q$, 'implausible_items');
select pg_temp.expect_error($q$ select public.submit_score((select v from t where k = 'a1'), 'device-bbbbbbbbbbbbbbbb', 'PAT', 50, 10) $q$, 'unknown_run');
do $$ declare r jsonb; begin
  r := public.submit_score((select v from t where k = 'a1'), 'device-aaaaaaaaaaaaaaaa', 'pat', 50, 10);
  assert r = '{"global": 1}'::jsonb, 'first score is #1 globally: ' || r;
end $$;
select pg_temp.expect_error($q$ select public.submit_score((select v from t where k = 'a1'), 'device-aaaaaaaaaaaaaaaa', 'PAT', 50, 10) $q$, 'already_submitted');

-- Same device scores again, higher: still one entry, the best.
insert into t select 'a2', public.start_run('device-aaaaaaaaaaaaaaaa');
reset role; select pg_temp.age_run((select v from t where k = 'a2'), 60); set role anon;
select public.submit_score((select v from t where k = 'a2'), 'device-aaaaaaaaaaaaaaaa', 'PAT', 80, 12);
-- Another device, blocked initials post as OTR.
insert into t select 'b1', public.start_run('device-bbbbbbbbbbbbbbbb');
reset role; select pg_temp.age_run((select v from t where k = 'b1'), 60); set role anon;
do $$ declare r jsonb; begin
  r := public.submit_score((select v from t where k = 'b1'), 'device-bbbbbbbbbbbbbbbb', 'ass', 60, 3);
  assert r ->> 'global' = '2', 'second place: ' || r;
end $$;
do $$ declare n int; top record; second record; begin
  select count(*) into n from public.leaderboard('global');
  assert n = 2, 'one row per player, got ' || n;
  select * into top from public.leaderboard('global', null, 'device-aaaaaaaaaaaaaaaa') where rank = 1;
  assert top.initials = 'PAT' and top.score = 80 and top.is_you, 'best score per player, marked as you';
  select * into second from public.leaderboard('global', null, 'device-aaaaaaaaaaaaaaaa') where rank = 2;
  assert second.initials = 'OTR' and not second.is_you, 'blocked initials become OTR';
  select count(*) into n from public.leaderboard('week');
  assert n = 2, 'week board';
end $$;
select pg_temp.expect_error($q$ select * from public.leaderboard('everything') $q$, 'bad_board');

-- 3. Events: a running event counts, a finished or unknown one is ignored.
insert into t select 'e1', public.start_run('device-cccccccccccccccc', 'free', null, 'SUMMIT-2026');
insert into t select 'e2', public.start_run('device-cccccccccccccccc', 'free', null, 'old-show');
reset role;
do $$ begin
  assert (select event_id from public.runs where id = (select v from t where k = 'e1')) = 'summit-2026', 'running event attached';
  assert (select event_id from public.runs where id = (select v from t where k = 'e2')) is null, 'finished event ignored';
end $$;
select pg_temp.age_run((select v from t where k = 'e1'), 30);
set role anon;
do $$ declare r jsonb; begin
  r := public.submit_score((select v from t where k = 'e1'), 'device-cccccccccccccccc', 'CAM', 40, 2);
  assert r ->> 'event' = '1' and r ->> 'global' = '3', 'event and global ranks: ' || r;
  assert (select count(*) from public.leaderboard('event', 'summit-2026')) = 1, 'event board';
  assert (public.event_info('summit-2026') ->> 'name') = 'Fictional Summit 2026', 'event info';
  assert public.event_info('old-show') is null, 'no info for a finished event';
end $$;

-- 4. Daily challenge board.
select pg_temp.expect_error($q$ select public.start_run('device-cccccccccccccccc', 'daily', null) $q$, 'bad_daily_key');
select pg_temp.expect_error($q$ select public.start_run('device-cccccccccccccccc', 'daily', current_date - 5) $q$, 'bad_daily_key');
insert into t select 'd1', public.start_run('device-cccccccccccccccc', 'daily', current_date);
reset role; select pg_temp.age_run((select v from t where k = 'd1'), 30); set role anon;
do $$ declare r jsonb; begin
  r := public.submit_score((select v from t where k = 'd1'), 'device-cccccccccccccccc', 'CAM', 25, 1);
  assert r = '{"daily": 1}'::jsonb, 'daily rank only: ' || r;
  assert (select count(*) from public.leaderboard('daily', current_date::text)) = 1, 'daily board';
  assert (select count(*) from public.leaderboard('global')) = 3, 'daily runs stay off the global board';
end $$;
reset role;

-- 5. Company boards.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert public.claim_company() = 'acme-robotics.com', 'work email gives a company'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin assert public.claim_company() is null, 'gmail gives no company'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$ select public.claim_company() $q$, 'email_not_confirmed');

-- Pat (acme) posts with the company box ticked; Sam (acme) posts without it first, then joins.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into t select 'pa', public.start_run('device-pppppppppppppppp');
reset role; select pg_temp.age_run((select v from t where k = 'pa'), 30); set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare r jsonb; begin
  r := public.submit_score((select v from t where k = 'pa'), 'device-pppppppppppppppp', 'PAT', 30, 2, true);
  assert r ->> 'company' = '1', 'company rank: ' || r;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into t select 'sa', public.start_run('device-ssssssssssssssss');
reset role; select pg_temp.age_run((select v from t where k = 'sa'), 30); set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.submit_score((select v from t where k = 'sa'), 'device-ssssssssssssssss', 'SAM', 45, 2, true);
do $$ begin
  assert (select count(*) from public.leaderboard('company')) = 0, 'no company board before claiming';
  assert public.claim_company() = 'acme-robotics.com';
  assert (select count(*) from public.leaderboard('company')) = 2, 'claiming adds earlier runs';
  assert (select initials from public.leaderboard('company', null, 'device-ssssssssssssssss') where is_you) = 'SAM', 'you on the company board';
end $$;
-- Other companies and anonymous players can't see it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin
  assert public.claim_company() = 'globex-labs.com';
  assert (select count(*) from public.leaderboard('company')) = 0, 'another company sees only its own board';
end $$;
reset role;
set role anon;
select pg_temp.as_anon();
do $$ begin assert (select count(*) from public.leaderboard('company')) = 0, 'anon sees no company board'; end $$;
reset role;

-- 6. Rate limit: 120 runs an hour per device.
insert into public.runs (device, mode) select 'device-rrrrrrrrrrrrrrrr', 'free' from generate_series(1, 120);
set role anon;
select pg_temp.expect_error($q$ select public.start_run('device-rrrrrrrrrrrrrrrr') $q$, 'rate_limited');

-- 7. Forget me.
do $$ begin
  assert public.forget_me('device-bbbbbbbbbbbbbbbb') = 1, 'forget removes the device runs';
  -- Left: PAT and CAM from devices, Pat and Sam from their accounts.
  assert (select count(*) from public.leaderboard('global')) = 4, 'and its scores';
end $$;
reset role;

\o
\pset tuples_only on
select 'all database checks passed' as result;

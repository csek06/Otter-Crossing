-- Otter Crossing online leaderboards.
--
-- The game never reads or writes these tables directly. Row level security is on
-- for every table and the anon and authenticated roles get no table grants. The
-- game calls four functions instead:
--
--   start_run(device, mode, daily_key, event)         when a run starts
--   submit_score(run, device, initials, score, items, company)   on game over
--   leaderboard(board, key, device, limit)            to show a board
--   claim_company()                                   after a work email sign-in
--
-- Boards: global (all time), week (last 7 days), daily (one daily challenge
-- date), event (one event code) and company (players who signed in with the
-- same work email domain; only they can see it). Each board keeps one entry per
-- player, their best. Public boards show initials only. Email addresses stay in
-- Supabase Auth; the game tables only keep the email domain.

-- Personal email domains never form a company board.
create table public.free_email_domains (
  domain text primary key check (domain = lower(domain))
);

insert into public.free_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'), ('yahoo.com'), ('ymail.com'), ('rocketmail.com'),
  ('yahoo.co.uk'), ('yahoo.ca'), ('yahoo.com.au'), ('yahoo.co.in'), ('yahoo.co.jp'),
  ('yahoo.fr'), ('yahoo.de'), ('yahoo.es'), ('yahoo.it'), ('yahoo.com.br'),
  ('hotmail.com'), ('hotmail.co.uk'), ('hotmail.fr'), ('hotmail.de'), ('hotmail.it'), ('hotmail.es'),
  ('outlook.com'), ('outlook.co.uk'), ('live.com'), ('live.co.uk'), ('live.ca'), ('msn.com'), ('passport.com'),
  ('aol.com'), ('aim.com'), ('icloud.com'), ('me.com'), ('mac.com'),
  ('proton.me'), ('protonmail.com'), ('pm.me'), ('tutanota.com'), ('tuta.io'),
  ('gmx.com'), ('gmx.net'), ('gmx.de'), ('web.de'), ('mail.com'), ('email.com'), ('usa.com'),
  ('yandex.com'), ('yandex.ru'), ('mail.ru'), ('zoho.com'), ('zohomail.com'),
  ('fastmail.com'), ('hey.com'), ('hushmail.com'), ('inbox.com'), ('lycos.com'),
  ('qq.com'), ('163.com'), ('126.com'), ('sina.com'), ('naver.com'), ('daum.net'),
  ('comcast.net'), ('verizon.net'), ('att.net'), ('sbcglobal.net'), ('bellsouth.net'),
  ('cox.net'), ('charter.net'), ('earthlink.net'), ('optonline.net'), ('btinternet.com'),
  ('sky.com'), ('orange.fr'), ('free.fr'), ('laposte.net'), ('libero.it'), ('t-online.de'),
  ('rediffmail.com'), ('mailinator.com'), ('guerrillamail.com'), ('10minutemail.com'),
  ('sharklasers.com'), ('yopmail.com'), ('temp-mail.org');

-- Initials that never show on a public board. They post as OTR instead.
create table public.blocked_initials (
  initials text primary key check (initials ~ '^[A-Z]{3}$')
);

insert into public.blocked_initials (initials) values
  ('ASS'), ('CUM'), ('DIK'), ('DIC'), ('FAG'), ('FCK'), ('FUC'), ('FUK'), ('FUQ'),
  ('KKK'), ('NAZ'), ('NIG'), ('NGR'), ('SEX'), ('SHT'), ('TIT'), ('VAG'), ('WTF'), ('XXX');

-- Events (trade shows, webinars). Staff add rows in the Supabase dashboard or SQL
-- editor; the game only reads ones that are running.
create table public.events (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null check (char_length(name) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- One row per signed-in player: the work email domain, or null for personal email.
create table public.players (
  user_id uuid primary key references auth.users (id) on delete cascade,
  domain text check (domain is null or domain = lower(domain)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A run is opened when play starts, so the server knows how long it lasted.
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  device text not null check (device ~ '^[A-Za-z0-9_-]{16,64}$'),
  user_id uuid references auth.users (id) on delete set null,
  mode text not null check (mode in ('free', 'daily')),
  daily_key date,
  event_id text references public.events (id) on delete set null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index runs_device_started on public.runs (device, started_at desc);

create table public.scores (
  id bigint generated always as identity primary key,
  run_id uuid not null unique references public.runs (id) on delete cascade,
  initials text not null check (initials ~ '^[A-Z]{3}$'),
  score integer not null check (score between 1 and 10000),
  items integer not null check (items between 0 and 100000),
  mode text not null check (mode in ('free', 'daily')),
  daily_key date,
  event_id text references public.events (id) on delete set null,
  domain text,
  user_id uuid references auth.users (id) on delete set null,
  device text not null,
  created_at timestamptz not null default now()
);
create index scores_free on public.scores (score desc) where mode = 'free';
create index scores_daily on public.scores (daily_key, score desc) where mode = 'daily';
create index scores_event on public.scores (event_id, score desc) where event_id is not null;
create index scores_domain on public.scores (domain, score desc) where domain is not null;
create index scores_device on public.scores (device);
create index scores_user on public.scores (user_id);

-- Locked down: no direct table access for the game's roles.
alter table public.free_email_domains enable row level security;
alter table public.blocked_initials enable row level security;
alter table public.events enable row level security;
alter table public.players enable row level security;
alter table public.runs enable row level security;
alter table public.scores enable row level security;
revoke all on public.free_email_domains, public.blocked_initials, public.events,
  public.players, public.runs, public.scores from anon, authenticated;

-- Tuning for the plausibility checks. A hop takes 0.12 seconds, so a run can't
-- cross lanes faster than about 8 a second even with Summary's auto-hop.
create or replace function public._min_seconds_per_lane() returns numeric
language sql immutable as $$ select 0.1::numeric $$;

-- The best score per player on a board. A player is their account if they
-- signed in, otherwise their device.
create or replace function public._board_rows(p_board text, p_key text, p_domain text)
returns table (player text, initials text, score integer, items integer, device text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (player) player, s.initials, s.score, s.items, s.device, s.created_at
  from (
    select coalesce(s.user_id::text, 'd:' || s.device) as player, s.*
    from public.scores s
    where case p_board
      when 'global' then s.mode = 'free'
      when 'week' then s.mode = 'free' and s.created_at > now() - interval '7 days'
      when 'daily' then s.mode = 'daily' and s.daily_key = p_key::date
      when 'event' then s.event_id = p_key
      when 'company' then s.domain = p_domain
      else false
    end
  ) s
  order by player, s.score desc, s.items desc, s.created_at asc
$$;

create or replace function public.start_run(
  p_device text,
  p_mode text default 'free',
  p_daily_key date default null,
  p_event text default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid;
  v_event text;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'bad_device' using errcode = '22023';
  end if;
  if p_mode not in ('free', 'daily') then
    raise exception 'bad_mode' using errcode = '22023';
  end if;
  -- Daily keys are the player's local date, so allow a day either side.
  if p_mode = 'daily' and (p_daily_key is null or p_daily_key not between current_date - 1 and current_date + 1) then
    raise exception 'bad_daily_key' using errcode = '22023';
  end if;
  if (select count(*) from public.runs where device = p_device and started_at > now() - interval '1 hour') >= 120 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  -- Only a running event counts. Unknown or finished codes are ignored.
  select id into v_event from public.events
    where id = lower(p_event) and now() between starts_at and ends_at;
  insert into public.runs (device, user_id, mode, daily_key, event_id)
    values (p_device, auth.uid(), p_mode, case when p_mode = 'daily' then p_daily_key end, v_event)
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.submit_score(
  p_run uuid,
  p_device text,
  p_initials text,
  p_score integer,
  p_items integer,
  p_company boolean default false
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r public.runs%rowtype;
  v_elapsed numeric;
  v_initials text := upper(coalesce(p_initials, ''));
  v_domain text;
  v_uid uuid := auth.uid();
  v_ranks jsonb := '{}'::jsonb;
begin
  select * into r from public.runs where id = p_run for update;
  if not found or r.device is distinct from p_device then
    raise exception 'unknown_run' using errcode = '22023';
  end if;
  if r.submitted_at is not null then
    raise exception 'already_submitted' using errcode = '22023';
  end if;
  v_elapsed := extract(epoch from now() - r.started_at);
  if v_elapsed > 86400 then
    raise exception 'run_expired' using errcode = '22023';
  end if;
  if p_score is null or p_score < 1 or p_score > 10000 or p_score * public._min_seconds_per_lane() > v_elapsed then
    raise exception 'implausible_score' using errcode = '22023';
  end if;
  if p_items is null or p_items < 0 or p_items > p_score * 2 + 50 then
    raise exception 'implausible_items' using errcode = '22023';
  end if;
  if v_initials !~ '^[A-Z]{3}$' or exists (select 1 from public.blocked_initials b where b.initials = v_initials) then
    v_initials := 'OTR';
  end if;
  if p_company and v_uid is not null then
    select domain into v_domain from public.players where user_id = v_uid;
  end if;

  update public.runs set submitted_at = now(), user_id = coalesce(user_id, v_uid) where id = p_run;
  insert into public.scores (run_id, initials, score, items, mode, daily_key, event_id, domain, user_id, device)
    values (p_run, v_initials, p_score, p_items, r.mode, r.daily_key, r.event_id, v_domain, coalesce(r.user_id, v_uid), p_device);

  -- Where this score places on each board it counts for.
  if r.mode = 'free' then
    v_ranks := v_ranks || jsonb_build_object('global',
      1 + (select count(*) from public._board_rows('global', null, null) b where b.score > p_score));
  else
    v_ranks := v_ranks || jsonb_build_object('daily',
      1 + (select count(*) from public._board_rows('daily', r.daily_key::text, null) b where b.score > p_score));
  end if;
  if r.event_id is not null then
    v_ranks := v_ranks || jsonb_build_object('event',
      1 + (select count(*) from public._board_rows('event', r.event_id, null) b where b.score > p_score));
  end if;
  if v_domain is not null then
    v_ranks := v_ranks || jsonb_build_object('company',
      1 + (select count(*) from public._board_rows('company', null, v_domain) b where b.score > p_score));
  end if;
  return v_ranks;
end;
$$;

-- Top of a board, best score per player. The company board only answers for a
-- signed-in player with a work domain, and only shows their own domain.
create or replace function public.leaderboard(
  p_board text,
  p_key text default null,
  p_device text default null,
  p_limit integer default 10
) returns table (rank integer, initials text, score integer, items integer, is_you boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_domain text;
  v_uid uuid := auth.uid();
begin
  if p_board not in ('global', 'week', 'daily', 'event', 'company') then
    raise exception 'bad_board' using errcode = '22023';
  end if;
  if p_board = 'company' then
    if v_uid is null then return; end if;
    select domain into v_domain from public.players where user_id = v_uid;
    if v_domain is null then return; end if;
  end if;
  if p_board = 'daily' and (p_key is null or p_key !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'bad_daily_key' using errcode = '22023';
  end if;
  return query
    select (row_number() over (order by b.score desc, b.items desc, b.created_at asc))::integer,
           b.initials, b.score, b.items,
           coalesce(b.player = coalesce(v_uid::text, 'd:' || p_device) or b.device = p_device, false)
    from public._board_rows(p_board, p_key, v_domain) b
    order by b.score desc, b.items desc, b.created_at asc
    limit least(greatest(coalesce(p_limit, 10), 1), 50);
end;
$$;

-- After a work email sign-in: record the email domain for company boards.
-- Returns the domain, or null for a personal email address.
create or replace function public.claim_company() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_domain text;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select lower(u.email) into v_email from auth.users u
    where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'email_not_confirmed' using errcode = '28000';
  end if;
  v_domain := split_part(v_email, '@', 2);
  if exists (select 1 from public.free_email_domains f where f.domain = v_domain) then
    v_domain := null;
  end if;
  insert into public.players (user_id, domain) values (v_uid, v_domain)
    on conflict (user_id) do update set domain = excluded.domain, updated_at = now();
  -- Earlier runs from this account join the company board too.
  if v_domain is not null then
    update public.scores set domain = v_domain where user_id = v_uid and domain is null;
  end if;
  return v_domain;
end;
$$;

-- The running event's name, for the board tab label.
create or replace function public.event_info(p_event text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'ends_at', ends_at)
  from public.events where id = lower(p_event) and now() between starts_at and ends_at
$$;

-- Privacy: remove every online score from this device and, if signed in, this account.
create or replace function public.forget_me(p_device text) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'bad_device' using errcode = '22023';
  end if;
  with gone as (
    delete from public.runs where device = p_device or (v_uid is not null and user_id = v_uid) returning 1
  ) select count(*) into v_n from gone;
  if v_uid is not null then
    delete from public.players where user_id = v_uid;
  end if;
  return v_n;
end;
$$;

revoke all on function public._min_seconds_per_lane() from public;
revoke all on function public._board_rows(text, text, text) from public;
revoke all on function public.start_run(text, text, date, text) from public;
revoke all on function public.submit_score(uuid, text, text, integer, integer, boolean) from public;
revoke all on function public.leaderboard(text, text, text, integer) from public;
revoke all on function public.claim_company() from public;
revoke all on function public.event_info(text) from public;
revoke all on function public.forget_me(text) from public;
grant execute on function public.start_run(text, text, date, text) to anon, authenticated;
grant execute on function public.submit_score(uuid, text, text, integer, integer, boolean) to anon, authenticated;
grant execute on function public.leaderboard(text, text, text, integer) to anon, authenticated;
grant execute on function public.event_info(text) to anon, authenticated;
grant execute on function public.forget_me(text) to anon, authenticated;
grant execute on function public.claim_company() to authenticated;

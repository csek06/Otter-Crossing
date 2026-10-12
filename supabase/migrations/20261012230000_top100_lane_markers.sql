-- Top 100 boards, and the names the game draws across the lanes as you play.

-- Same as before, but boards go up to 100 rows (and default to 100).
create or replace function public.leaderboard(
  p_board text,
  p_key text default null,
  p_device text default null,
  p_limit integer default 100
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
    limit least(greatest(coalesce(p_limit, 100), 1), 100);
end;
$$;

-- Names to draw on the lanes during a run: the top 10, plus the players just
-- ahead of and just behind p_around (the score the player is chasing). The
-- caller's own rows are left out; the game draws "your best" itself.
create or replace function public.lane_markers(
  p_board text,
  p_key text default null,
  p_device text default null,
  p_around integer default 0
) returns table (rank integer, initials text, score integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_around integer := greatest(coalesce(p_around, 0), 0);
begin
  if p_board not in ('global', 'daily', 'event') then
    raise exception 'bad_board' using errcode = '22023';
  end if;
  if p_board = 'daily' and (p_key is null or p_key !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'bad_daily_key' using errcode = '22023';
  end if;
  return query
    with ranked as (
      select (row_number() over (order by b.score desc, b.items desc, b.created_at asc))::integer as rank,
             b.initials, b.score,
             coalesce(b.player = coalesce(v_uid::text, 'd:' || p_device) or b.device = p_device, false) as mine
      from public._board_rows(p_board, p_key, null) b
    ), others as (
      select * from ranked where not mine
    ), ahead as (
      select * from others where others.score > v_around order by others.score asc, others.rank desc limit 8
    ), behind as (
      select * from others where others.score <= v_around order by others.score desc, others.rank asc limit 2
    )
    select o.rank, o.initials, o.score from others o where o.rank <= 10
    union
    select a.rank, a.initials, a.score from ahead a
    union
    select h.rank, h.initials, h.score from behind h
    order by 3 asc, 1 desc;
end;
$$;

revoke all on function public.lane_markers(text, text, text, integer) from public;
grant execute on function public.lane_markers(text, text, text, integer) to anon, authenticated;

-- =====================================================================
-- Vokes POC — stats views
-- Run this SECOND in the Supabase SQL editor.
-- =====================================================================
-- These are the "views" the Airtable base builds by hand. Each is one query.
-- The site reads them directly over the REST API — no backend code.

-- ------------------------------------------------------------ player_stats
create or replace view player_stats with (security_invoker = true) as
select
  p.id,
  p.name,
  p.photo_url,
  count(f.id)                                              as apps,
  coalesce(sum(f.goals), 0)                                as goals,
  coalesce(sum(f.assists), 0)                              as assists,
  coalesce(sum(f.errors), 0)                               as errors,
  coalesce(sum(f.pints), 0)                                as pints,
  count(*) filter (where f.clean_sheet)                    as clean_sheets,
  count(*) filter (where f.clean_sheet is not null)        as games_in_goal,
  count(*) filter (where m.result = 'Win')                 as w,
  count(*) filter (where m.result = 'Draw')                as d,
  count(*) filter (where m.result = 'Loss')                as l,
  round(100.0 * count(*) filter (where m.result = 'Win')
        / nullif(count(*) filter (where m.result is not null), 0), 1) as win_pct,
  round(coalesce(sum(f.goals), 0) / nullif(count(f.id), 0), 2)        as goals_per_game,
  (select count(*) from matches mm where mm.motm_player_id = p.id)    as motm,
  (select count(*) from matches mm where mm.dotd_player_id = p.id)    as dotd,
  count(*) filter (where f.disciplinary is not null
                     and f.disciplinary <> 'Not for me')   as bookings,
  min(m.played_on)                                         as first_game,
  max(m.played_on)                                         as last_game,
  count(distinct m.season_id)                              as seasons,
  -- how much of this player's data was actually filled in (blank ≠ zero)
  count(*) filter (where f.goals   is not null)            as goals_recorded,
  count(*) filter (where f.assists is not null)            as assists_recorded
from players p
join performances f on f.player_id = p.id
join matches m      on m.id = f.match_id
group by p.id, p.name, p.photo_url;

-- ------------------------------------------------------------ head_to_head
create or replace view head_to_head with (security_invoker = true) as
select
  o.id,
  o.name                                            as opposition,
  count(m.id)                                       as played,
  count(*) filter (where m.result = 'Win')          as w,
  count(*) filter (where m.result = 'Draw')         as d,
  count(*) filter (where m.result = 'Loss')         as l,
  coalesce(sum(m.goals_for), 0)                     as gf,
  coalesce(sum(m.goals_against), 0)                 as ga,
  coalesce(sum(m.goals_for), 0)
    - coalesce(sum(m.goals_against), 0)             as gd,
  round(100.0 * count(*) filter (where m.result = 'Win')
        / nullif(count(*) filter (where m.result is not null), 0), 1) as win_pct,
  min(m.played_on)                                  as first_played,
  max(m.played_on)                                  as last_played
from oppositions o
join matches m on m.opposition_id = o.id
group by o.id, o.name;

-- ------------------------------------------------------------ season_stats
create or replace view season_stats with (security_invoker = true) as
select
  s.id,
  s.name                                            as season,
  count(m.id)                                       as played,
  count(*) filter (where m.result = 'Win')          as w,
  count(*) filter (where m.result = 'Draw')         as d,
  count(*) filter (where m.result = 'Loss')         as l,
  coalesce(sum(m.goals_for), 0)                     as gf,
  coalesce(sum(m.goals_against), 0)                 as ga,
  round(100.0 * count(*) filter (where m.result = 'Win')
        / nullif(count(*) filter (where m.result is not null), 0), 1) as win_pct,
  min(m.played_on)                                  as starts_on,
  max(m.played_on)                                  as ends_on
from seasons s
join matches m on m.season_id = s.id
group by s.id, s.name;

-- ------------------------------------------------------------ match_detail
create or replace view match_detail with (security_invoker = true) as
select
  m.id,
  m.fixture_name,
  m.played_on,
  o.name                as opposition,
  s.name                as season,
  m.goals_for,
  m.goals_against,
  m.result,
  m.weather,
  m.one_where,
  m.match_report,
  mp.name               as motm,
  dp.name               as dotd,
  (select count(*) from performances f where f.match_id = m.id) as squad_size,
  (select coalesce(json_agg(json_build_object(
       'player', pl.name,
       'goals', f.goals,
       'assists', f.assists,
       'errors', f.errors,
       'pints', f.pints,
       'clean_sheet', f.clean_sheet,
       'disciplinary', f.disciplinary
     ) order by f.goals desc nulls last, pl.name), '[]'::json)
   from performances f join players pl on pl.id = f.player_id
   where f.match_id = m.id)                                     as squad
from matches m
join oppositions o    on o.id = m.opposition_id
left join seasons s   on s.id = m.season_id
left join players mp  on mp.id = m.motm_player_id
left join players dp  on dp.id = m.dotd_player_id;

-- These views use security_invoker, so the caller reads the BASE tables as
-- itself. Granting explicitly rather than relying on Supabase's default
-- privileges keeps this file self-contained.
grant select on seasons, oppositions, players, matches, performances to anon, authenticated;
grant select on player_stats, head_to_head, season_stats, match_detail to anon, authenticated;
grant insert on performances, matches to anon, authenticated;

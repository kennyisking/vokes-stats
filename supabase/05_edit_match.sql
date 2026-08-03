-- =====================================================================
-- Vokes POC — enable the "Update a match" form
-- Run this in the SQL editor (safe on an existing install).
-- =====================================================================
-- Post-match admin: result, score, MOM/DOD, weather, keeper, "the one where…".
--
-- SECURITY NOTE: this is the first policy that lets the public key CHANGE
-- existing data. Deletion is still impossible, and performances still cannot
-- be edited — but a match row can now be overwritten by anyone with the link.
-- Acceptable for a POC; put the form behind Cloudflare Access before real use.

alter table matches add column if not exists updated_by int references players(id);
alter table matches add column if not exists updated_at timestamptz;

drop policy if exists update_match on matches;
create policy update_match on matches for update using (true) with check (true);

grant update on matches to anon, authenticated;

-- stamp every edit
create or replace function touch_match()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_match on matches;
create trigger trg_touch_match
  before update on matches
  for each row execute function touch_match();

-- match_detail needs rebuilding to expose the new columns.
-- Drop first: the live view has a different column order, and
-- `create or replace view` cannot reorder/rename existing columns.
drop view if exists match_detail;
create view match_detail with (security_invoker = true) as
select
  m.id, m.fixture_name, m.played_on,
  o.name as opposition, s.name as season,
  m.goals_for, m.goals_against, m.result, m.weather, m.one_where, m.match_report,
  m.opponent_has_keeper, m.updated_at,
  mp.name as motm, dp.name as dotd, ub.name as updated_by,
  (select count(*) from performances f where f.match_id = m.id) as squad_size,
  (select coalesce(json_agg(json_build_object(
       'player', pl.name, 'goals', f.goals, 'assists', f.assists,
       'errors', f.errors, 'pints', f.pints,
       'clean_sheet', f.clean_sheet, 'disciplinary', f.disciplinary
     ) order by f.goals desc nulls last, pl.name), '[]'::json)
   from performances f join players pl on pl.id = f.player_id
   where f.match_id = m.id) as squad
from matches m
join oppositions o    on o.id = m.opposition_id
left join seasons s   on s.id = m.season_id
left join players mp  on mp.id = m.motm_player_id
left join players dp  on dp.id = m.dotd_player_id
left join players ub  on ub.id = m.updated_by;

grant select on match_detail to anon, authenticated;

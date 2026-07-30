-- =====================================================================
-- Vokes POC — run this AFTER `node scripts/load.mjs`
-- =====================================================================
-- The seed supplies explicit ids so the Airtable relationships survive intact.
-- That leaves each table's identity sequence still sitting at 1, so the first
-- form submission would collide with an existing row. This advances them.

-- `is_called = false` + max+1 so an empty table still starts at 1.
select setval(pg_get_serial_sequence('seasons',      'id'), coalesce((select max(id) from seasons),      0) + 1, false);
select setval(pg_get_serial_sequence('oppositions',  'id'), coalesce((select max(id) from oppositions),  0) + 1, false);
select setval(pg_get_serial_sequence('players',      'id'), coalesce((select max(id) from players),      0) + 1, false);
select setval(pg_get_serial_sequence('matches',      'id'), coalesce((select max(id) from matches),      0) + 1, false);
select setval(pg_get_serial_sequence('performances', 'id'), coalesce((select max(id) from performances), 0) + 1, false);

-- ------------------------------------------------------------ sanity check
-- Expected: 18 / 46 / 71 / 222 / 1299
select
  (select count(*) from seasons)      as seasons,
  (select count(*) from oppositions)  as oppositions,
  (select count(*) from players)      as players,
  (select count(*) from matches)      as matches,
  (select count(*) from performances) as performances;

-- Expected: 104 wins, 17 draws, 99 losses, 757 for, 728 against
select
  count(*) filter (where result = 'Win')  as w,
  count(*) filter (where result = 'Draw') as d,
  count(*) filter (where result = 'Loss') as l,
  sum(goals_for)     as gf,
  sum(goals_against) as ga
from matches;

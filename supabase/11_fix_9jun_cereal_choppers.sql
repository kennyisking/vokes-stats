-- =====================================================================
-- Vokes — fix the 9 Jun 2026 fixture (one-off data correction)
-- Run this in the Supabase SQL editor.
-- =====================================================================
-- 9 Jun 2026 had two entries but was really ONE game, vs Cereal Choppers:
--   * match 221 "Old Men of Ashmere - 09 Jun 2026" (7-1) — has the real squad
--     (Sam, Joe, Hugo, George, Josh), but under the wrong opponent.
--   * match 223 "Cereal Choppers FC - 09 Jun 2026" (10-1) — an empty duplicate
--     with no performances.
-- Fix: delete the empty duplicate, repoint the real match to Cereal Choppers,
-- correct its name and score to 10-1, and drop the now-orphan opponent.

begin;

-- 1. remove the empty duplicate (no performances attached; cascade is a no-op)
delete from matches where id = 223;

-- 2. the real game was vs Cereal Choppers FC (opposition 44), 10-1
update matches
set opposition_id = 44,
    fixture_name  = 'Cereal Choppers FC - 09 Jun 2026',
    goals_for     = 10,
    goals_against = 1
where id = 221;

-- 3. "Old Men of Ashmere" (opposition 46) now has no matches — remove it
delete from oppositions where id = 46;

commit;

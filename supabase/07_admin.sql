-- =====================================================================
-- Vokes POC — enable the admin "Edit stats" raw-data editor
-- Run this in the SQL editor (safe on an existing install).
-- =====================================================================
-- The site's admin area (behind a client-side password) needs to CHANGE
-- existing rows in every core table, not just matches. This grants the
-- public key UPDATE on the remaining tables.
--
-- SECURITY NOTE: like 05_edit_match.sql, this lets anyone holding the
-- (public) anon key overwrite data. The 'lollard' password in the UI is a
-- convenience gate, NOT real protection. Deletion is still impossible —
-- nothing here adds a DELETE policy, so history can be corrected but never
-- destroyed. Put the admin area behind Cloudflare Access before real use.

-- matches already has an update policy + grant from 05_edit_match.sql.
-- players already has an update policy + a photo_url column grant from
-- 06_photos.sql; widen that grant to the whole row for the editor.

-- ---- players: allow editing the name too (policy already exists) -------
grant update on players to anon, authenticated;

-- ---- oppositions -------------------------------------------------------
drop policy if exists update_opposition on oppositions;
create policy update_opposition on oppositions for update using (true) with check (true);
grant update on oppositions to anon, authenticated;

-- so the create-match form can add a brand-new opponent
drop policy if exists insert_opposition on oppositions;
create policy insert_opposition on oppositions for insert with check (true);
grant insert on oppositions to anon, authenticated;

-- ---- seasons -----------------------------------------------------------
drop policy if exists update_season on seasons;
create policy update_season on seasons for update using (true) with check (true);
grant update on seasons to anon, authenticated;

drop policy if exists insert_season on seasons;
create policy insert_season on seasons for insert with check (true);
grant insert on seasons to anon, authenticated;

-- ---- performances: the per-player raw numbers --------------------------
drop policy if exists update_performance on performances;
create policy update_performance on performances for update using (true) with check (true);
grant update on performances to anon, authenticated;

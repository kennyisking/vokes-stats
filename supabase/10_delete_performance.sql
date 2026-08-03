-- =====================================================================
-- Vokes POC — allow deleting a single performance
-- Run this in the SQL editor (safe on an existing install).
-- =====================================================================
-- Until now performances could be added but never removed. The "Update a
-- match" page can now delete an individual player's stat line for a match.
--
-- SECURITY NOTE: this is the first policy that lets the public key DELETE
-- data. It is scoped to performances only — matches, players and history
-- rows still cannot be deleted through the public site. A performance is a
-- single (match, player) stats entry, so the blast radius is one line at a
-- time. Put the admin pages behind Cloudflare Access before real use.

drop policy if exists delete_performance on performances;
create policy delete_performance on performances for delete using (true);

grant delete on performances to anon, authenticated;

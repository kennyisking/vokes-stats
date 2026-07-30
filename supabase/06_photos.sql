-- =====================================================================
-- Vokes POC — player photos
-- Run this in the SQL editor (safe on an existing install).
-- =====================================================================
-- Creates a public bucket for player photos and lets the site set
-- players.photo_url — and ONLY that column.

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "player photos are public" on storage.objects;
create policy "player photos are public"
  on storage.objects for select
  using (bucket_id = 'player-photos');

drop policy if exists "anyone can add a player photo" on storage.objects;
create policy "anyone can add a player photo"
  on storage.objects for insert
  with check (bucket_id = 'player-photos');

-- Row-level permission to update a player…
drop policy if exists update_player_photo on players;
create policy update_player_photo on players
  for update using (true) with check (true);

-- …narrowed by a COLUMN grant, so photo_url is the only field the public
-- key can change. Names and ids stay untouchable.
grant update (photo_url) on players to anon, authenticated;

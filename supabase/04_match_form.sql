-- =====================================================================
-- Vokes POC — enable the "Create a match" form
-- Run this in the SQL editor (safe to run on an existing install).
-- =====================================================================
-- The match form can create a fixture against a NEW opponent, or in a new
-- season, so it needs insert rights on those two lookup tables.
-- Still no update or delete anywhere: history remains unmodifiable.

create policy create_opposition on oppositions for insert with check (true);
create policy create_season     on seasons     for insert with check (true);

grant insert on oppositions, seasons to anon, authenticated;

-- Keep the fixture naming convention consistent with the 222 imported
-- matches: "{Opposition} - DD Mon YYYY" (zero-padded day, 3-letter month).
-- The form builds this client-side; this is the safety net.
create or replace function set_fixture_name()
returns trigger language plpgsql as $$
begin
  if new.fixture_name is null or btrim(new.fixture_name) = '' then
    new.fixture_name :=
      (select name from oppositions where id = new.opposition_id)
      || ' - ' || to_char(new.played_on, 'DD Mon YYYY');
  end if;
  return new;
end $$;

drop trigger if exists trg_set_fixture_name on matches;
create trigger trg_set_fixture_name
  before insert on matches
  for each row execute function set_fixture_name();

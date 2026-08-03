-- =====================================================================
-- Vokes — clear dead Airtable photo URLs
-- Run this in the Supabase SQL editor.
-- =====================================================================
-- The original player photos were imported from Airtable and point at
-- v5.airtableusercontent.com. Airtable's attachment URLs expire (they now
-- return HTTP 410 Gone), so those avatars render as broken images.
--
-- Nulling photo_url makes the site fall back to the player's initials
-- avatar with an "add photo +" prompt, so a working photo can be
-- re-uploaded through the app (which stores it permanently in Supabase).
--
-- Photos already re-uploaded to Supabase storage are NOT touched.

update players
set photo_url = null
where photo_url like '%airtableusercontent.com%';

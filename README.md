# That's All Vokes — end-to-end POC

A working replacement for the Airtable base: **public form → Postgres → live stats site.**
Free to run, no row caps, and the data is yours.

Built from the two CSV exports (222 matches, 1,299 performances, 71 players, 46 opponents).

```
 submit.html  ──POST──▶  Supabase (Postgres)  ──GET──▶  index.html
  the form                 real database              the stats site
```

---

## Setup — about 15 minutes

You need a free [Supabase](https://supabase.com) account. Nothing else, and no credit card.

### 1. Create the database

Supabase → **New project**. Any name, any region, pick a strong database password.
Wait ~2 minutes for it to provision.

Then **SQL Editor → New query**, and run these two files in order:

| File | What it does |
|---|---|
| `supabase/01_schema.sql` | Tables, constraints, Row Level Security |
| `supabase/02_views.sql` | The stats views (player stats, head-to-head, seasons, match detail) |
| `supabase/04_match_form.sql` | Lets the match form create new opponents and seasons |
| `supabase/05_edit_match.sql` | Enables the "Update a match" form (adds UPDATE on matches) |
| `supabase/06_photos.sql` | Player photo bucket + column-scoped update on `players.photo_url` |

### 2. Load five years of history

Get your keys from **Project Settings → API**, then:

```bash
export SUPABASE_URL="https://xxxxxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."          # service_role key — keep it off the internet

node scripts/load.mjs
```

You should see:

```
  seasons        18
  oppositions    46
  players        71
  matches       222
  performances 1299
```

Then run `supabase/03_after_load.sql` in the SQL editor. **Don't skip this** — it advances
the ID sequences past the seeded rows. Without it the first form submission collides with
an existing record.

> Regenerating `seed.json` from the CSVs is `python3 build.py`.

### 3. Point the site at your database

Open `web/config.js` and paste in your **Project URL** and **anon / public** key
(*not* the service_role key):

```js
window.VOKES_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJ...',
  teamName: "That's All Vokes",
};
```

The anon key is designed to be public. RLS restricts it to reading, and to inserting
performances and matches — it **cannot update or delete anything**.

Open `web/index.html` in a browser. That's the whole thing working.

### 4. Put it online

**Cloudflare Pages** → Create project → *Direct Upload* → drag in the `web/` folder.
You get a free `*.pages.dev` URL, no build step, no server. Netlify Drop works identically.

---

## Check it worked

The site should match these figures exactly:

| | Expected |
|---|---|
| Matches played | 222 |
| Record | 104 W, 17 D, 99 L (47%) |
| Goals | 757 for, 728 against (+29) |
| Players / opponents / seasons | 71 / 46 / 18 |
| Longest win streak | 5 |
| Top scorer | Ozzy O'Sullivan, 141 |
| Most appearances | Sam Broadey, 166 |
| Most pints | Justin Hubbard, 342.5 |
| Worst record | The Danimals — P32 W5 D3 L24 |
| Only unbeaten opponent | PR7 — P8 W8 |

**Then test the write path:** open `submit.html`, log a performance, and watch it appear
in the stats. Submit twice for the same player and match and the database will reject it —
the constraint Airtable didn't have.

---

## What this proves

- **The whole lifecycle works** — a public form writes to a real database, and a public site reads from it. No spreadsheet in the middle.
- **The caps disappear.** 1,299 performances is under 1 MB. The free tier holds 500 MB. At ~320 rows/year that is not a limit you will ever meet.
- **The views become queries.** Every leaderboard and head-to-head in `02_views.sql` is a single SQL statement, not a hand-maintained Airtable view.
- **History can't be damaged.** There are no update or delete policies. The public site can add records; it cannot destroy five years of data.
- **Data quality is enforced.** One performance per player per match, results constrained to Win/Draw/Loss, spice ratings 1–5.

---

## Known gaps — read before reviewing

**1. The source CSVs are view exports, not full table exports.** The schema models every
field the live forms capture, but these columns load as `NULL` because they weren't in the
export:

*Performances:* penalties · shots out of the cage · expected goals for · expected goals
against · spice rating · game description · memorable moment · paid?
*Matches:* goals scored/conceded as separate fields · opponent has keeper · notes
*Missing entirely:* the Players table (including photos) and the Opposition table.

The form at `submit.html` collects all of them, so new submissions are complete. A full
Airtable export would backfill the history.

**2. Data quality issues carried over from Airtable:**

- **8 duplicate performances** skipped during load (Alex Monk twice in two matches, "Random person" twice, Hugo Hensley twice, Justin Hubbard once). The new unique constraint prevents recurrence.
- **1 performance with no player attached** (`The Danimals - 02 Aug 2022 -`) — excluded.
- **2 matches with no score or result** (Pogballers 19 May 2026, TBC FC 28 Jul 2026).
- **Blanks are treated as zero.** 32% of performances have no goals value and 49% no errors value. "Scored 0" and "didn't fill it in" are currently indistinguishable. Player pages show a note where this applies. **This is a pre-existing issue and worth an explicit decision.**
- **"Random person"** is a catch-all guest player.
- **One joint MOM** (`Crowe Clark Wanderers - 10 May 2022` → Joe Day *and* Ario Aribaldi). A single `motm_player_id` column can't represent a shared award, so the first name is taken. If joint awards are common, this needs a junction table.

**3. Editing.** There is deliberately no update or delete policy, so a mis-typed submission
can only be fixed by an admin in the Supabase Table Editor. Combined with the one-per-player-per-match
constraint, a player cannot resubmit to correct themselves. Worth an explicit decision:
either keep it locked down, or add a scoped update policy.

**4. Not yet built:** an admin editing UI for performances (the Supabase Table Editor
covers that for now).

**5. Requires PostgreSQL 15+** for `security_invoker` views — any Supabase project created
in the last couple of years is fine.

---

## What the admin needs to do

1. Review the site and confirm the stats match what Airtable shows today.
2. Provide a **complete** Airtable export or API access, so the missing fields can be backfilled.
3. Decide the blank-vs-zero rule.
4. Confirm the 8 duplicates and the 2 scoreless matches.

---

## Files

```
build.py                   CSVs → seed.json
seed.json                  normalised data, ready to load
supabase/01_schema.sql     tables, constraints, RLS
supabase/02_views.sql      stats views
supabase/03_after_load.sql sequence reset + sanity checks
scripts/load.mjs           seed → Supabase (Node 18+, no dependencies)
web/config.js              your Supabase URL + anon key
web/index.html             stats site
web/app.js                 read path
web/submit.html            performance form
web/submit.js              write path
web/new-match.html         admin match-creation form + league importer
web/new-match.js
web/edit-match.html        post-game "update a match" form
web/edit-match.js
web/fixtures-parser.js     playfiveaside fixture parser (shared)
web/styles.css
scripts/test-parser.mjs    parser unit tests — `node scripts/test-parser.mjs`
```

## Cost

£0. Supabase free tier: 500 MB database, 1 GB file storage, unlimited API requests.
Cloudflare Pages free tier: unlimited static hosting.

One caveat: **free Supabase projects pause after 7 days with no requests.** In season that
won't happen. Over a long break, restore it from the dashboard, or set a free weekly cron
ping to keep it awake.

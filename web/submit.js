/* Performance form — writes straight into Postgres via PostgREST.
   RLS allows insert only: this form can add a record, never change one. */

const CFG = window.VOKES_CONFIG || {};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function msg(kind, html) { $('#msg').innerHTML = `<div class="notice ${kind}">${html}</div>`; }

async function api(path, opts = {}) {
  const res = await fetch(`${CFG.url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: CFG.anonKey,
      Authorization: `Bearer ${CFG.anonKey}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text() || res.status);
  // PostgREST returns 201 with an EMPTY body for `return=minimal` inserts.
  // Calling res.json() on that throws, which would report a successful
  // submission as a failure.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function boot() {
  if (!CFG.url || !CFG.anonKey) {
    msg('err', '<strong>Not configured yet.</strong><br>Paste your Supabase URL and anon key into <code>web/config.js</code>.');
    return;
  }
  try {
    const [matches, players] = await Promise.all([
      // all fixtures, so a ?match= link to an older game still resolves
      api('matches?select=id,fixture_name,played_on&order=played_on.desc.nullslast&limit=5000'),
      // most-played first, so regulars are right at the top of the list
      api('player_stats?select=id,name,apps&order=apps.desc.nullslast&limit=2000'),
    ]);

    $('#match').innerHTML = '<option value="">Choose…</option>' +
      matches.map(m => `<option value="${m.id}">${esc(m.fixture_name)}</option>`).join('');
    $('#player').innerHTML = '<option value="">Choose…</option>' +
      players.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

    // ?match=123 pre-fills and locks the fixture — the per-match link trick
    const pre = new URLSearchParams(location.search).get('match');
    if (pre && matches.some(m => String(m.id) === pre)) {
      $('#match').value = pre;
      $('#match').disabled = true;
      $('#match').closest('.field').querySelector('.hint').textContent =
        'Pre-filled from your match link.';
    }

    $('#f').style.display = '';
  } catch (e) {
    msg('err', `<strong>Couldn't load the form.</strong><br><code>${esc(e.message)}</code>`);
  }
}

$('#f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#f button');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const fd = new FormData(ev.target);
  const numOrNull = (k) => {
    const v = fd.get(k);
    return v === null || v === '' ? null : Number(v);
  };
  const strOrNull = (k) => {
    const v = fd.get(k);
    return v === null || v === '' ? null : v;
  };
  const cs = fd.get('clean_sheet');

  const row = {
    match_id: Number($('#match').value),   // read from element, works when disabled
    player_id: numOrNull('player_id'),
    goals: numOrNull('goals'),
    penalties: numOrNull('penalties'),
    assists: numOrNull('assists'),
    errors: numOrNull('errors'),
    pints: numOrNull('pints'),
    shots_out_of_cage: numOrNull('shots_out_of_cage'),
    xg_for: numOrNull('xg_for'),
    xg_against: numOrNull('xg_against'),
    spice_rating: numOrNull('spice_rating'),
    clean_sheet: cs === 'true' ? true : cs === 'false' ? false : null,
    disciplinary: strOrNull('disciplinary'),
    game_description: strOrNull('game_description'),
    memorable_moment: strOrNull('memorable_moment'),
    paid: strOrNull('paid'),
  };

  if (!row.match_id || !row.player_id) {
    msg('err', '<strong>Pick a match and a player.</strong>');
    btn.disabled = false; btn.textContent = 'Submit';
    return;
  }

  try {
    await api('performances', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    $('#f').style.display = 'none';
    msg('ok', `<strong>Logged. Nice one.</strong><br>
      Your performance is in the database and the stats have already updated.
      <a href="index.html">See the stats →</a>`);
    window.scrollTo(0, 0);
  } catch (e) {
    const dup = /duplicate key|unique/i.test(e.message);
    msg('err', dup
      ? `<strong>You've already submitted for this match.</strong><br>
         The database enforces one entry per player per match — this is exactly the rule
         that let 8 duplicates through in Airtable.`
      : `<strong>Couldn't submit.</strong><br><code>${esc(e.message)}</code>`);
    btn.disabled = false;
    btn.textContent = 'Submit';
    window.scrollTo(0, 0);
  }
});

boot();

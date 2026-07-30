/* Update a match — PATCHes only the fields you actually fill in.
   Blank = leave alone, which is how the Airtable form behaves. */

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
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let MATCHES = [], PLAYERS = [], OPPS = [];

function showCurrent() {
  const m = MATCHES.find(x => String(x.id) === $('#match').value);
  if (!m) { $('#current').textContent = ''; return; }
  const score = m.goals_for == null ? 'no score yet' : `${m.goals_for}–${m.goals_against}`;
  const bits = [
    score,
    m.result || 'no result',
    m.weather || 'no weather',
    m.motm_player_id ? 'MOM set' : 'no MOM',
  ];
  $('#current').textContent = `Currently: ${bits.join(' · ')}`;
}

async function boot() {
  if (!CFG.url || !CFG.anonKey) {
    msg('err', '<strong>Not configured yet.</strong><br>Paste your Supabase URL and anon key into <code>web/config.js</code>.');
    return;
  }
  try {
    const [m, p, o] = await Promise.all([
      api('matches?select=id,fixture_name,played_on,goals_for,goals_against,result,weather,motm_player_id&order=played_on.desc.nullslast&limit=5000'),
      api('players?select=id,name&order=name.asc&limit=2000'),
      api('oppositions?select=id,name&order=name.asc&limit=2000'),
    ]);
    MATCHES = m; PLAYERS = p; OPPS = o;

    $('#match').innerHTML = '<option value="">Choose…</option>' +
      MATCHES.map(x => `<option value="${x.id}">${esc(x.fixture_name)}</option>`).join('');
    $('#opposition').innerHTML = '<option value="">Leave unchanged</option>' +
      OPPS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');

    const playerOpts = (blank) => `<option value="">${blank}</option>` +
      PLAYERS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    $('#motm').innerHTML = playerOpts('Leave unchanged');
    $('#dotd').innerHTML = playerOpts('Leave unchanged');
    $('#submitted_by').innerHTML = playerOpts('Choose…');

    // ?match=123 deep link, e.g. straight from the stats page
    const pre = new URLSearchParams(location.search).get('match');
    if (pre && MATCHES.some(x => String(x.id) === pre)) $('#match').value = pre;

    $('#match').onchange = showCurrent;
    showCurrent();
    $('#f').style.display = '';
  } catch (e) {
    msg('err', `<strong>Couldn't load the form.</strong><br><code>${esc(e.message)}</code>`);
  }
}

$('#f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#f button');
  btn.disabled = true;
  btn.textContent = 'Updating…';

  const id = $('#match').value;
  const submittedBy = $('#submitted_by').value;
  const patch = {};

  const numVal = (sel) => $(sel).value === '' ? undefined : Number($(sel).value);
  const txtVal = (sel) => $(sel).value.trim() === '' ? undefined : $(sel).value.trim();
  const radio = (name) => document.querySelector(`input[name=${name}]:checked`)?.value;

  if (numVal('#gf') !== undefined) patch.goals_for = numVal('#gf');
  if (numVal('#ga') !== undefined) patch.goals_against = numVal('#ga');
  if (radio('result')) patch.result = radio('result');
  if (radio('weather')) patch.weather = radio('weather');
  if (txtVal('#one_where') !== undefined) patch.one_where = txtVal('#one_where');
  if (numVal('#opposition') !== undefined) patch.opposition_id = numVal('#opposition');
  if (numVal('#motm') !== undefined) patch.motm_player_id = numVal('#motm');
  if (numVal('#dotd') !== undefined) patch.dotd_player_id = numVal('#dotd');

  const k = radio('keeper');
  if (k) patch.opponent_has_keeper = k === 'null' ? null : k === 'true';

  patch.updated_by = Number(submittedBy);

  try {
    if (!id) throw new Error('Pick a match to update.');
    if (!submittedBy) throw new Error('Say who you are.');
    if (Object.keys(patch).length <= 1) throw new Error('Nothing to update — fill in at least one field.');

    const updated = await api(`matches?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    const m = updated[0];
    const changed = Object.keys(patch).filter(k => k !== 'updated_by');

    $('#f').style.display = 'none';
    msg('ok', `<strong>${esc(m.fixture_name)} updated.</strong><br>
      Changed: ${changed.map(esc).join(', ')}.<br><br>
      <a href="index.html">See the stats →</a> &nbsp;·&nbsp;
      <a href="edit-match.html">Update another</a>`);
    window.scrollTo(0, 0);
  } catch (e) {
    msg('err', `<strong>Couldn't update.</strong><br><code>${esc(e.message)}</code>`);
    btn.disabled = false;
    btn.textContent = 'Update the match';
    window.scrollTo(0, 0);
  }
});

boot();

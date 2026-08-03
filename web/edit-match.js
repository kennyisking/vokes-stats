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
  const val = $('#match').value;
  loadSquad(val);
  const m = MATCHES.find(x => String(x.id) === val);
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

// The squad list under the match picker — one deletable row per performance.
async function loadSquad(matchId) {
  const box = $('#squad'), field = $('#squadField');
  if (!matchId) { field.style.display = 'none'; box.innerHTML = ''; return; }
  field.style.display = '';
  box.innerHTML = '<div class="small muted">Loading squad…</div>';
  try {
    const rows = await api(
      `performances?select=id,goals,assists,pints,errors,players(name)&match_id=eq.${encodeURIComponent(matchId)}`);
    if (!rows.length) {
      box.innerHTML = '<div class="small muted">No performances logged for this match yet.</div>';
      return;
    }
    rows.sort((a, b) => (a.players?.name || '').localeCompare(b.players?.name || ''));
    box.innerHTML = rows.map(r => {
      const name = r.players?.name || `player ${r.id}`;
      const bits = [];
      if (r.goals) bits.push(`${r.goals}g`);
      if (r.assists) bits.push(`${r.assists}a`);
      if (r.pints) bits.push(`${r.pints}🍺`);
      if (r.errors) bits.push(`${r.errors} err`);
      const stat = bits.length ? bits.join(' · ') : 'no stats';
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;font-size:14px">${esc(name)} <span class="small muted">${esc(stat)}</span></div>
        <button type="button" class="perf-del" data-id="${r.id}"
          data-label="${esc(name)}'s entry for this match"
          style="flex:none;font-size:12px;padding:4px 11px;border:1px solid var(--loss);
                 color:var(--loss);background:transparent;border-radius:6px;cursor:pointer">Delete</button>
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<div class="small" style="color:var(--loss)">Couldn't load the squad.<br><code>${esc(e.message)}</code></div>`;
  }
}

async function deletePerf(id, label, btn) {
  if (!confirm(`Delete ${label}?\n\nThis removes their stats for this match and can't be undone.`)) return;
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  try {
    // return=representation so an RLS-blocked delete comes back empty instead
    // of looking like a silent success (the bug the match update had).
    const del = await api(`performances?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (!del || !del.length) {
      throw new Error("Nothing was deleted — the database may not allow it yet. Has migration 10 been run?");
    }
    loadSquad($('#match').value);   // refresh the list
  } catch (e) {
    alert(`Couldn't delete.\n\n${e.message}`);
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
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
    $('#squad').addEventListener('click', (e) => {
      const b = e.target.closest('.perf-del');
      if (b) deletePerf(b.dataset.id, b.dataset.label, b);
    });
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

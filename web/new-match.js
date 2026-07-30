/* Create-a-match form. Inserts into matches (and oppositions/seasons if new),
   then hands back the pre-filled player link for that fixture. */

const CFG = window.VOKES_CONFIG || {};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** "{Opposition} - DD Mon YYYY" — matches all 222 imported fixtures. */
function fixtureName(opposition, iso) {
  if (!opposition || !iso) return '';
  const [y, m, d] = iso.split('-');
  return `${opposition} - ${d.padStart(2, '0')} ${MONTHS[Number(m) - 1]} ${y}`;
}

let OPPS = [], SEASONS = [];

const chosenOpposition = () =>
  $('#opposition').value === '__new'
    ? $('#oppositionNew').value.trim()
    : (OPPS.find(o => String(o.id) === $('#opposition').value)?.name || '');

function updatePreview() {
  const name = fixtureName(chosenOpposition(), $('#played_on').value);
  $('#fixturePreview').textContent = name
    ? `Will be created as: ${name}`
    : 'The fixture will be named automatically.';
}

function autoResult() {
  const gf = $('#gf').value, ga = $('#ga').value;
  if (gf === '' || ga === '') return;
  const r = Number(gf) > Number(ga) ? 'Win' : Number(gf) < Number(ga) ? 'Loss' : 'Draw';
  const el = document.querySelector(`input[name=result][value="${r}"]`);
  if (el) el.checked = true;
}

async function boot() {
  if (!CFG.url || !CFG.anonKey) {
    msg('err', '<strong>Not configured yet.</strong><br>Paste your Supabase URL and anon key into <code>web/config.js</code>.');
    return;
  }
  try {
    [OPPS, SEASONS] = await Promise.all([
      api('oppositions?select=id,name&order=name.asc&limit=2000'),
      api('seasons?select=id,name&limit=2000'),
    ]);

    $('#opposition').innerHTML = '<option value="">Choose…</option>' +
      OPPS.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('') +
      '<option value="__new">+ New opponent…</option>';

    $('#season').innerHTML = '<option value="">None</option>' +
      SEASONS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') +
      '<option value="__new">+ New season…</option>';

    $('#opposition').onchange = () => {
      const isNew = $('#opposition').value === '__new';
      $('#oppositionNew').style.display = isNew ? '' : 'none';
      if (isNew) $('#oppositionNew').focus();
      updatePreview();
    };
    $('#season').onchange = () => {
      const isNew = $('#season').value === '__new';
      $('#seasonNew').style.display = isNew ? '' : 'none';
      if (isNew) $('#seasonNew').focus();
    };
    $('#oppositionNew').oninput = updatePreview;
    $('#played_on').onchange = updatePreview;
    $('#gf').oninput = autoResult;
    $('#ga').oninput = autoResult;

    $('#f').style.display = '';
  } catch (e) {
    msg('err', `<strong>Couldn't load the form.</strong><br><code>${esc(e.message)}</code>`);
  }
}

/** Return an existing lookup row's id (case-insensitive) or create it. */
async function resolveLookup(table, list, name) {
  const hit = list.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit.id;
  const created = await api(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name }),
  });
  return created[0].id;
}

$('#f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#f button');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const oppName = chosenOpposition();
    const playedOn = $('#played_on').value;
    if (!oppName) throw new Error('Pick or name an opposition.');
    if (!playedOn) throw new Error('Pick a match date.');

    const opposition_id = await resolveLookup('oppositions', OPPS, oppName);

    let season_id = null;
    if ($('#season').value === '__new') {
      const sn = $('#seasonNew').value.trim();
      if (sn) season_id = await resolveLookup('seasons', SEASONS, sn);
    } else if ($('#season').value) {
      season_id = Number($('#season').value);
    }

    const gf = $('#gf').value, ga = $('#ga').value;
    const row = {
      fixture_name: fixtureName(oppName, playedOn),
      opposition_id,
      season_id,
      played_on: playedOn,
      goals_for: gf === '' ? null : Number(gf),
      goals_against: ga === '' ? null : Number(ga),
      result: document.querySelector('input[name=result]:checked')?.value || null,
      opponent_has_keeper: $('#keeper').value === '' ? null : $('#keeper').value === 'true',
      weather: $('#weather').value.trim() || null,
      one_where: $('#one_where').value.trim() || null,
      notes: $('#notes').value.trim() || null,
    };

    const created = await api('matches', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    const match = created[0];
    const link = `${location.origin}${location.pathname.replace(/new-match\.html$/, '')}submit.html?match=${match.id}`;

    $('#f').style.display = 'none';
    msg('ok', `<strong>${esc(match.fixture_name)} created.</strong><br><br>
      Send this to the squad — it pre-fills the fixture so nobody picks the wrong one:<br>
      <input type="text" readonly value="${esc(link)}" style="width:100%;margin-top:8px"
             onclick="this.select()"><br><br>
      <a href="${esc(link)}">Open the player form →</a> &nbsp;·&nbsp;
      <a href="index.html">Back to stats</a> &nbsp;·&nbsp;
      <a href="new-match.html">Create another</a>`);
    window.scrollTo(0, 0);
  } catch (e) {
    const dup = /duplicate key|unique/i.test(e.message);
    msg('err', dup
      ? `<strong>That fixture already exists.</strong><br>
         A match against this opponent on this date is already in the database.`
      : `<strong>Couldn't create the match.</strong><br><code>${esc(e.message)}</code>`);
    btn.disabled = false;
    btn.textContent = 'Create match';
    window.scrollTo(0, 0);
  }
});

/* ==================================================================
   Import fixtures from the playfiveaside league page
   ================================================================== */

const TEAM = CFG.teamName || "That's All Vokes";
let EXISTING = new Set();     // fixture_name values already in the database
let FOUND = [];               // parsed fixtures awaiting confirmation

function importMsg(kind, html) {
  $('#importResult').innerHTML = `<div class="notice ${kind}">${html}</div>`;
}

async function loadExisting() {
  const rows = await api('matches?select=fixture_name&limit=5000');
  EXISTING = new Set(rows.map(r => r.fixture_name));
}

function renderFound() {
  if (!FOUND.length) {
    importMsg('err', `<strong>No ${esc(TEAM)} fixtures found.</strong><br>
      Check the page actually lists this team, or try the paste option.`);
    return;
  }
  const rows = FOUND.map((f, i) => {
    const name = `${f.opposition} - ${FixturesParser.ukDate(f.date)}`;
    const exists = EXISTING.has(name);
    const future = f.date >= new Date().toISOString().slice(0, 10);
    const scoreless = f.goalsFor === 0 && f.goalsAgainst === 0;
    const played = !future && !scoreless;
    return `<tr>
      <td style="text-align:left">
        <label style="display:flex;gap:8px;align-items:center;cursor:pointer">
          <input type="checkbox" data-i="${i}" ${exists ? 'disabled' : 'checked'}>
          <span>${esc(name)}</span>
        </label>
      </td>
      <td>${esc(f.time || '')}</td>
      <td>${played ? `${f.goalsFor}–${f.goalsAgainst}` : '<span class="muted">upcoming</span>'}</td>
      <td>${exists ? '<span class="muted">already in</span>' : '<span style="color:var(--accent)">new</span>'}</td>
    </tr>`;
  }).join('');

  const newCount = FOUND.filter((f) =>
    !EXISTING.has(`${f.opposition} - ${FixturesParser.ukDate(f.date)}`)).length;

  $('#importResult').innerHTML = `
    <div class="small muted" style="margin-bottom:8px">
      Found ${FOUND.length} ${esc(TEAM)} fixture${FOUND.length === 1 ? '' : 's'} · ${newCount} new
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th>Fixture</th><th>Time</th><th>Score</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <button type="button" class="btn" id="createBtn" style="margin-top:12px"
      ${newCount ? '' : 'disabled'}>Create ${newCount} match${newCount === 1 ? '' : 'es'}</button>
    <div id="createResult" style="margin-top:12px"></div>`;

  const btn = $('#createBtn');
  if (btn) btn.onclick = createSelected;
}

async function createSelected() {
  const btn = $('#createBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  const picked = [...document.querySelectorAll('#importResult input[type=checkbox]')]
    .filter(c => c.checked && !c.disabled)
    .map(c => FOUND[Number(c.dataset.i)]);

  const done = [], failed = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const f of picked) {
    try {
      const opposition_id = await resolveLookup('oppositions', OPPS, f.opposition);
      // A 0–0 in the future is an unplayed fixture, not a goalless draw.
      const upcoming = f.date >= today && f.goalsFor === 0 && f.goalsAgainst === 0;
      const row = {
        fixture_name: `${f.opposition} - ${FixturesParser.ukDate(f.date)}`,
        opposition_id,
        played_on: f.date,
        goals_for: upcoming ? null : f.goalsFor,
        goals_against: upcoming ? null : f.goalsAgainst,
        result: upcoming ? null
          : f.goalsFor > f.goalsAgainst ? 'Win'
          : f.goalsFor < f.goalsAgainst ? 'Loss' : 'Draw',
      };
      const created = await api('matches', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      done.push(created[0]);
      OPPS = await api('oppositions?select=id,name&order=name.asc&limit=2000');
    } catch (e) {
      failed.push(`${f.opposition} ${f.date}: ${e.message.slice(0, 120)}`);
    }
  }

  const links = done.map(m =>
    `<div style="margin-top:6px">${esc(m.fixture_name)} —
     <a href="submit.html?match=${m.id}">player link</a></div>`).join('');

  $('#createResult').innerHTML = `<div class="notice ${failed.length ? 'err' : 'ok'}">
    <strong>Created ${done.length} match${done.length === 1 ? '' : 'es'}.</strong>
    ${links}
    ${failed.length ? `<br><br><strong>Failed:</strong><br>${failed.map(esc).join('<br>')}` : ''}
    <br><br><a href="index.html">See the stats →</a></div>`;

  await loadExisting();
  renderFound();
}

async function handleImport(getText, label) {
  importMsg('ok', `<span class="muted">${label}…</span>`);
  try {
    const text = await getText();
    await loadExisting();
    FOUND = FixturesParser.forTeam(FixturesParser.parseFixtures(text), TEAM)
      .filter(f => f.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    renderFound();
  } catch (e) {
    importMsg('err', `<strong>Couldn't read that.</strong><br><code>${esc(e.message)}</code><br><br>
      Make sure you selected the whole fixtures page (⌘A / Ctrl+A) before copying.`);
  }
}

$('#parseBtn').onclick = () => handleImport(async () => {
  const t = $('#pasteArea').value;
  if (!t.trim()) throw new Error('Paste the fixtures page first.');
  return t;
}, 'Reading');

/** Keep the "open the page" link pointed at whatever URL is in the box. */
function syncLeagueLink() {
  const a = $('#openLeague');
  if (!a) return;
  const url = $('#leagueUrl').value.trim();
  if (/^https?:\/\//i.test(url)) {
    a.href = url;
    a.removeAttribute('aria-disabled');
    a.style.opacity = '';
  } else {
    a.removeAttribute('href');
    a.setAttribute('aria-disabled', 'true');
    a.style.opacity = '.5';
  }
}

$('#leagueUrl').addEventListener('input', syncLeagueLink);

syncLeagueLink();

boot();

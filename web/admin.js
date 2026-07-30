/* Admin area: password gate + a raw-data editor for every core table.
   Create/Update a match are the existing forms, embedded as iframes.

   The password is a convenience gate only — the anon key is public, so this
   protects nobody determined. Real deployments belong behind Cloudflare Access. */

const CFG = window.VOKES_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PASSWORD = 'lollard';
const GATE_KEY = 'vokes-admin-unlocked';
const unlocked = () => { try { return sessionStorage.getItem(GATE_KEY) === '1'; } catch (e) { return false; } };

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

function editMsg(kind, html) {
  $('#editMsg').innerHTML = html ? `<div class="notice ${kind}">${html}</div>` : '';
}

/* ------------------------------------------------------------------ gate */
function reveal() {
  $('#gate').style.display = 'none';
  $('#app').style.display = '';
  // load the iframes only once we're in
  $$('.admin-frame').forEach(f => { if (!f.src && f.dataset.src) f.src = f.dataset.src; });
  bootEditor();
}

$('#gateForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('#pw').value === PASSWORD) {
    try { sessionStorage.setItem(GATE_KEY, '1'); } catch (err) { /* private mode */ }
    reveal();
  } else {
    $('#gateMsg').innerHTML = '<div class="notice err">Wrong password.</div>';
    $('#pw').value = '';
    $('#pw').focus();
  }
});

/* --------------------------------------------------------------- tabbing */
$$('nav button').forEach(btn => btn.onclick = () => {
  $$('nav button').forEach(b => b.classList.toggle('on', b === btn));
  $$('.tab-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === btn.dataset.tab));
});

$('#lock').onclick = (e) => {
  e.preventDefault();
  try { sessionStorage.removeItem(GATE_KEY); } catch (err) { /* ignore */ }
  location.reload();
};

/* ============================================================ raw editor */
/* One spec per editable table. `fields` lists only the columns worth
   touching — identity keys, timestamps and generated columns stay hidden. */
const RESULTS = ['Win', 'Draw', 'Loss'];
const DISCIPLINARY = ['Not for me', 'Just a warning 😇', '2 minutes in the bin', 'Naughty step'];
const PAID = ["Yes I've already paid", "No I'm a bad bloke and will pay now", 'Unknown'];

const f = (key, type, extra = {}) => ({ key, type, ...extra });

const TABLES = {
  players: {
    label: 'Players', order: 'name.asc',
    rowLabel: r => r.name,
    fields: [f('name', 'text'), f('photo_url', 'text')],
  },
  oppositions: {
    label: 'Oppositions', order: 'name.asc',
    rowLabel: r => r.name,
    fields: [f('name', 'text')],
  },
  seasons: {
    label: 'Seasons', order: 'name.asc',
    rowLabel: r => r.name,
    fields: [f('name', 'text')],
  },
  matches: {
    label: 'Matches', order: 'played_on.desc.nullslast',
    rowLabel: r => r.fixture_name,
    fields: [
      f('fixture_name', 'text'),
      f('played_on', 'date'),
      f('goals_for', 'num'), f('goals_against', 'num'),
      f('result', 'enum', { options: RESULTS }),
      f('opposition_id', 'fk', { lk: 'oppositions' }),
      f('season_id', 'fk', { lk: 'seasons' }),
      f('motm_player_id', 'fk', { lk: 'players', label: 'MOM (player)' }),
      f('dotd_player_id', 'fk', { lk: 'players', label: 'DOD (player)' }),
      f('opponent_has_keeper', 'bool'),
      f('weather', 'text'),
      f('one_where', 'text', { label: 'The one where…' }),
      f('notes', 'textarea'),
      f('match_report', 'textarea'),
    ],
  },
  performances: {
    label: 'Match performances', byMatch: true,
    rowLabel: r => r._playerName || `player ${r.player_id}`,
    fields: [
      f('player_id', 'fk', { lk: 'players' }),
      f('goals', 'num'), f('penalties', 'num'), f('assists', 'num'),
      f('errors', 'num'), f('pints', 'num'), f('shots_out_of_cage', 'num'),
      f('xg_for', 'num'), f('xg_against', 'num'),
      f('spice_rating', 'enum', { options: [1, 2, 3, 4, 5] }),
      f('clean_sheet', 'bool'),
      f('disciplinary', 'enum', { options: DISCIPLINARY }),
      f('game_description', 'textarea'),
      f('memorable_moment', 'textarea'),
      f('paid', 'enum', { options: PAID }),
    ],
  },
};

// lookups shared across selects; filled on boot
const LK = { players: [], oppositions: [], seasons: [], matches: [] };
const nameById = (lk) => Object.fromEntries(LK[lk].map(x => [String(x.id), x.name || x.fixture_name]));

const prettyLabel = (spec) =>
  spec.label || spec.key.replace(/_id$/, '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

async function bootEditor() {
  if (!CFG.url || !CFG.anonKey) {
    editMsg('err', '<strong>Not configured yet.</strong><br>Paste your Supabase URL and anon key into <code>web/config.js</code>.');
    return;
  }
  if (LK.players.length) return;                 // already booted
  try {
    const [pl, op, se, ma] = await Promise.all([
      api('players?select=id,name&order=name.asc&limit=2000'),
      api('oppositions?select=id,name&order=name.asc&limit=2000'),
      api('seasons?select=id,name&order=name.asc&limit=2000'),
      api('matches?select=id,fixture_name&order=played_on.desc.nullslast&limit=5000'),
    ]);
    Object.assign(LK, { players: pl, oppositions: op, seasons: se, matches: ma });
    renderTablePicker();
  } catch (e) {
    editMsg('err', `<strong>Couldn't load the editor.</strong><br><code>${esc(e.message)}</code>`);
  }
}

function renderTablePicker() {
  const host = $('#editor');
  host.innerHTML = `
    <div class="field">
      <label for="tbl">What do you want to edit?</label>
      <select id="tbl">
        <option value="">Choose a table…</option>
        ${Object.entries(TABLES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join('')}
      </select>
    </div>
    <div id="rowpick"></div>
    <div id="formhost"></div>`;
  $('#tbl').onchange = () => { editMsg(); renderRowPicker($('#tbl').value); };
}

/* --- row picker: matches/players/etc. by name, or match→player for perfs --- */
function renderRowPicker(tableKey) {
  const pick = $('#rowpick');
  $('#formhost').innerHTML = '';
  if (!tableKey) { pick.innerHTML = ''; return; }
  const spec = TABLES[tableKey];

  if (spec.byMatch) {
    pick.innerHTML = `
      <div class="field">
        <label for="pMatch">Match</label>
        <select id="pMatch"><option value="">Choose a match…</option>
          ${LK.matches.map(m => `<option value="${m.id}">${esc(m.fixture_name)}</option>`).join('')}</select>
      </div>
      <div class="field" id="pPlayerWrap" style="display:none">
        <label for="pPlayer">Player</label>
        <select id="pPlayer"></select>
      </div>`;
    $('#pMatch').onchange = () => loadPerformances($('#pMatch').value);
    return;
  }

  // simple tables: load rows and list them by label
  loadRows(tableKey).then(rows => {
    pick.innerHTML = `
      <div class="field">
        <label for="pRow">${esc(spec.label)}</label>
        <select id="pRow"><option value="">Choose…</option>
          ${rows.map(r => `<option value="${r.id}">${esc(spec.rowLabel(r))}</option>`).join('')}</select>
      </div>`;
    $('#pRow').onchange = () => {
      const row = rows.find(r => String(r.id) === $('#pRow').value);
      renderForm(tableKey, row);
    };
  }).catch(e => editMsg('err', `<strong>Couldn't load rows.</strong><br><code>${esc(e.message)}</code>`));
}

const rowCache = {};
async function loadRows(tableKey) {
  if (rowCache[tableKey]) return rowCache[tableKey];
  const spec = TABLES[tableKey];
  const rows = await api(`${tableKey}?select=*&order=${spec.order}&limit=5000`);
  rowCache[tableKey] = rows;
  return rows;
}

let PERFS = [];
async function loadPerformances(matchId) {
  const wrap = $('#pPlayerWrap');
  $('#formhost').innerHTML = '';
  if (!matchId) { wrap.style.display = 'none'; return; }
  try {
    PERFS = await api(`performances?match_id=eq.${encodeURIComponent(matchId)}&select=*`);
    const names = nameById('players');
    PERFS.forEach(p => p._playerName = names[String(p.player_id)] || `player ${p.player_id}`);
    PERFS.sort((a, b) => a._playerName.localeCompare(b._playerName));
    $('#pPlayer').innerHTML = '<option value="">Choose a player…</option>' +
      PERFS.map(p => `<option value="${p.id}">${esc(p._playerName)}</option>`).join('');
    wrap.style.display = PERFS.length ? '' : 'none';
    if (!PERFS.length) editMsg('err', 'No performances recorded for that match yet.');
    else editMsg();
    $('#pPlayer').onchange = () => {
      const row = PERFS.find(p => String(p.id) === $('#pPlayer').value);
      renderForm('performances', row);
    };
  } catch (e) {
    editMsg('err', `<strong>Couldn't load performances.</strong><br><code>${esc(e.message)}</code>`);
  }
}

/* --- the field form --------------------------------------------------- */
function fieldInput(spec, row) {
  const v = row[spec.key];
  const id = `fld_${spec.key}`;
  const blank = '<option value="">— none —</option>';
  switch (spec.type) {
    case 'num':
      return `<input type="number" step="any" id="${id}" value="${v == null ? '' : esc(v)}">`;
    case 'date':
      return `<input type="date" id="${id}" value="${v == null ? '' : esc(v)}">`;
    case 'textarea':
      return `<textarea id="${id}" rows="3">${esc(v ?? '')}</textarea>`;
    case 'bool':
      return `<select id="${id}">
        <option value=""${v == null ? ' selected' : ''}>— unknown —</option>
        <option value="true"${v === true ? ' selected' : ''}>True</option>
        <option value="false"${v === false ? ' selected' : ''}>False</option></select>`;
    case 'enum':
      return `<select id="${id}">${blank}${spec.options.map(o =>
        `<option value="${esc(o)}"${String(v) === String(o) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    case 'fk': {
      const list = LK[spec.lk];
      return `<select id="${id}">${blank}${list.map(o =>
        `<option value="${o.id}"${String(v) === String(o.id) ? ' selected' : ''}>${esc(o.name || o.fixture_name)}</option>`).join('')}</select>`;
    }
    default:
      return `<input type="text" id="${id}" value="${esc(v ?? '')}">`;
  }
}

function renderForm(tableKey, row) {
  const host = $('#formhost');
  if (!row) { host.innerHTML = ''; return; }
  const spec = TABLES[tableKey];
  host.innerHTML = `
    <h3 style="margin:24px 0 4px">Editing: ${esc(spec.rowLabel(row))}</h3>
    <div class="small muted" style="margin-bottom:16px">${esc(spec.label)} · row id ${esc(row.id)}</div>
    <form id="editForm">
      ${spec.fields.map(sp => `<div class="field">
        <label for="fld_${sp.key}">${esc(prettyLabel(sp))}</label>
        ${fieldInput(sp, row)}
      </div>`).join('')}
      <button class="btn" type="submit">Save changes</button>
    </form>`;

  $('#editForm').onsubmit = (e) => { e.preventDefault(); saveRow(tableKey, row); };
}

/** Read a field back to a typed value (or null when cleared). */
function readField(spec) {
  const raw = $(`#fld_${spec.key}`).value;
  switch (spec.type) {
    case 'num': return raw === '' ? null : Number(raw);
    case 'date': return raw === '' ? null : raw;
    case 'bool': return raw === '' ? null : raw === 'true';
    case 'fk': return raw === '' ? null : Number(raw);
    case 'enum':
      if (raw === '') return null;
      return spec.options.every(o => typeof o === 'number') ? Number(raw) : raw;
    default: return raw === '' ? null : raw;   // text / textarea
  }
}

async function saveRow(tableKey, row) {
  const spec = TABLES[tableKey];
  const btn = $('#editForm button');
  btn.disabled = true; btn.textContent = 'Saving…';

  // only send fields that actually changed
  const patch = {};
  for (const sp of spec.fields) {
    const next = readField(sp);
    const prev = row[sp.key] ?? null;
    if (String(next) !== String(prev)) patch[sp.key] = next;
  }

  try {
    if (!Object.keys(patch).length) throw new Error('Nothing changed.');
    const updated = await api(`${tableKey}?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    Object.assign(row, updated[0]);            // keep the in-memory copy fresh
    invalidateCaches(tableKey);
    editMsg('ok', `<strong>Saved.</strong> Updated: ${Object.keys(patch).map(esc).join(', ')}.`);
    btn.disabled = false; btn.textContent = 'Save changes';
    window.scrollTo(0, 0);
  } catch (e) {
    editMsg('err', `<strong>Couldn't save.</strong><br><code>${esc(e.message)}</code>`);
    btn.disabled = false; btn.textContent = 'Save changes';
    window.scrollTo(0, 0);
  }
}

/** A name change should show up in dropdowns elsewhere, so drop stale caches. */
function invalidateCaches(tableKey) {
  delete rowCache[tableKey];
  if (LK[tableKey]) {
    // refresh the shared lookup list used by FK selects
    api(`${tableKey}?select=*&order=${TABLES[tableKey].order}&limit=5000`)
      .then(rows => { LK[tableKey] = rows; }).catch(() => {});
  }
}

/* unlock immediately if this session already passed the gate */
if (unlocked()) reveal();

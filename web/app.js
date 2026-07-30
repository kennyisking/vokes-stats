/* Vokes stats — reads live from Supabase via PostgREST. No build step. */

const CFG = window.VOKES_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = (v) => v == null ? '–' : (Math.round(v * 10) / 10).toString();
const date = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

async function api(path) {
  const res = await fetch(`${CFG.url.replace(/\/$/, '')}/rest/v1/${path}`, {
    headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const DB = { players: [], h2h: [], seasons: [], matches: [] };
let view = 'overview';

const QUAL = 15;      // minimum appearances to qualify for rate-based stats
const RINGER = 10;    // fewer appearances than this counts as a ringer
const RARE = 6;       // fewer meetings than this counts as a rare opponent

/* Theme handling lives in theme.js, shared across all pages. */

/* ------------------------------------------------------------ generic table */
function table(rows, cols, opts = {}) {
  let sort = opts.sort || cols[1]?.k, dir = opts.dir || 'desc';
  const wrap = el('<div class="tablewrap"><table></table></div>');
  const tbl = $('table', wrap);

  const draw = () => {
    const sorted = [...rows].sort((a, b) => {
      let x = a[sort], y = b[sort];
      if (x == null) return 1;
      if (y == null) return -1;
      // PostgREST can serialise `numeric` columns as strings — sort them as numbers
      const bothNumeric = !isNaN(Number(x)) && !isNaN(Number(y)) && x !== '' && y !== '';
      const c = bothNumeric ? Number(x) - Number(y) : String(x).localeCompare(String(y));
      return dir === 'desc' ? -c : c;
    });
    tbl.innerHTML =
      `<thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.k === sort ? 'on' : ''}">${c.t}${c.k === sort ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>` +
      `<tbody>${sorted.map(r => `<tr class="${opts.onClick ? 'clickable' : ''}" data-id="${r.id}">${cols.map(c => `<td>${c.f ? c.f(r) : esc(r[c.k] ?? '–')}</td>`).join('')}</tr>`).join('')}</tbody>`;

    tbl.querySelectorAll('th').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      if (k === sort) dir = dir === 'desc' ? 'asc' : 'desc';
      else { sort = k; dir = typeof rows[0]?.[k] === 'string' ? 'asc' : 'desc'; }
      draw();
    });
    if (opts.onClick) tbl.querySelectorAll('tbody tr').forEach(tr =>
      tr.onclick = () => opts.onClick(Number(tr.dataset.id)));
  };
  draw();
  return wrap;
}

const wdl = (r) => `<span class="pill w">${r.w}</span> <span class="pill d">${r.d}</span> <span class="pill l">${r.l}</span>`;

/* ----------------------------------------------------------- leaderboards */
/* One definition per board. `min` gates rate stats to a fair sample;
   totals have no minimum. `asc` means lower is better. */
const num = (v) => Number(v || 0);

const BOARDS = [
  { title: 'Top scorers', note: 'Goals scored.',
    value: p => num(p.goals), fmt: v => n1(v) },
  { title: 'Most assists', note: 'Assists provided.',
    value: p => num(p.assists), fmt: v => n1(v) },
  { title: 'Most appearances', note: 'Games played.',
    value: p => num(p.apps), fmt: v => v },
  { title: 'Most pints', note: 'Total post-match pints logged.',
    value: p => num(p.pints), fmt: v => n1(v) },
  { title: 'Most MOMs', note: 'MOM awards won.',
    value: p => num(p.motm), fmt: v => v },
  { title: 'Most DODs', note: 'DOD awards collected.',
    value: p => num(p.dotd), fmt: v => v },
  { title: 'Fewest errors per game', min: QUAL, asc: true,
    note: 'Errors leading to goals, per appearance.',
    value: p => num(p.errors) / num(p.apps),
    fmt: (v, p) => `${v.toFixed(3)} <span class="muted small">(${n1(p.errors)})</span>` },
  { title: 'Pints per game', min: QUAL,
    note: 'Post-match pints logged, per appearance.',
    value: p => num(p.pints) / num(p.apps), fmt: v => v.toFixed(2) },
  { title: 'Greed index', min: QUAL,
    cardNote: 'Goals ÷ assists',
    note: 'Goals divided by assists.',
    eligible: p => num(p.assists) > 0,
    value: p => num(p.goals) / num(p.assists),
    fmt: (v, p) => `${v.toFixed(2)} <span class="muted small">(${n1(p.goals)}/${n1(p.assists)})</span>` },
  { title: 'Clean sheet rate', min: QUAL,
    cardNote: 'Goalkeeping stints kept clean',
    note: 'Share of goalkeeping stints that ended without conceding.',
    eligible: p => num(p.games_in_goal) > 0,
    value: p => 100 * num(p.clean_sheets) / num(p.games_in_goal),
    fmt: (v, p) => `${v.toFixed(0)}% <span class="muted small">(${p.clean_sheets}/${p.games_in_goal})</span>` },
];

/* Share of a player's own career spent facing the most-played opponent.
   Needs per-match squads, so it's built once the data has loaded. */
function addRivalBoard() {
  if (!DB.h2h.length || !DB.matches.length) return;
  const nemesis = DB.h2h.reduce((a, b) => (Number(b.played) > Number(a.played) ? b : a));
  const short = nemesis.opposition.replace(/^The\s+/i, '').replace(/\s+/g, '');

  const vs = new Map();
  DB.matches.forEach(m => {
    if (m.opposition !== nemesis.opposition) return;
    (m.squad || []).forEach(s => vs.set(s.player, (vs.get(s.player) || 0) + 1));
  });

  BOARDS.push({
    title: 'x' + short,
    cardNote: `Share of a player's games vs ${nemesis.opposition}`,
    note: `Share of appearances against ${nemesis.opposition}, the most-played opponent.`,
    min: QUAL,
    value: p => 100 * (vs.get(p.name) || 0) / num(p.apps),
    fmt: (v, p) => `${v.toFixed(1)}% <span class="muted small">(${vs.get(p.name) || 0})</span>`,
  });
}

/* Who brought the most players into the club. Built from players.recruited_by,
   which only exists after the 2026-07-30 data update has been run. */
function addRecruiterBoard() {
  const rows = DB.recruits || [];
  const counts = new Map();
  rows.forEach(r => {
    const by = (r.recruited_by || '').trim();
    if (by) counts.set(by, (counts.get(by) || 0) + 1);
  });
  if (!counts.size) return;

  BOARDS.push({
    title: 'Top recruiters',
    cardNote: 'Players brought into the club',
    note: 'How many players each person brought into the club.',
    eligible: p => (counts.get(p.name) || 0) > 0,
    value: p => counts.get(p.name) || 0,
    fmt: v => v,
  });
}

/* ------------------------------------------------------------ avatars */
const initialsOf = (name) =>
  name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/** Photo if we have one, otherwise initials with a + prompting an upload. */
function avatar(p, size = 26) {
  const s = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
  if (p.photo_url) {
    return `<img class="pav" style="${s}" src="${esc(p.photo_url)}" alt="${esc(p.name)}" loading="lazy">`;
  }
  return `<span class="pav pav-add" style="${s}" data-upload="${p.id}" role="button" tabindex="0"
    title="Add a photo of ${esc(p.name)}">${esc(initialsOf(p.name))}<i class="pav-plus">+</i></span>`;
}

/** Square-crop and shrink in the browser so we never upload a 5MB photo. */
function squareThumb(file, px = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d').drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, px, px);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

async function uploadPhoto(playerId) {
  const p = DB.players.find(x => String(x.id) === String(playerId));
  if (!p) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const node = document.querySelector(`[data-upload="${playerId}"]`);
    if (node) node.classList.add('pav-busy');
    try {
      const blob = await squareThumb(file);
      const path = `${playerId}-${Date.now()}.jpg`;
      const base = CFG.url.replace(/\/$/, '');

      const up = await fetch(`${base}/storage/v1/object/player-photos/${path}`, {
        method: 'POST',
        headers: {
          apikey: CFG.anonKey,
          Authorization: `Bearer ${CFG.anonKey}`,
          'Content-Type': 'image/jpeg',
        },
        body: blob,
      });
      if (!up.ok) throw new Error(await up.text() || up.status);

      const url = `${base}/storage/v1/object/public/player-photos/${path}`;
      const patch = await fetch(`${base}/rest/v1/players?id=eq.${playerId}`, {
        method: 'PATCH',
        headers: {
          apikey: CFG.anonKey,
          Authorization: `Bearer ${CFG.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ photo_url: url }),
      });
      if (!patch.ok) throw new Error(await patch.text() || patch.status);

      p.photo_url = url;
      render(view);                       // repaint wherever this player appears
    } catch (e) {
      if (node) node.classList.remove('pav-busy');
      alert(`Couldn't save that photo.\n\n${e.message}`);
    }
  };
  input.click();
}

// one delegated handler covers every avatar on every view
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-upload]');
  if (!t) return;
  e.stopPropagation();                    // don't also open the player page
  uploadPhoto(t.dataset.upload);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target.closest?.('[data-upload]');
  if (!t) return;
  e.preventDefault();
  e.stopPropagation();
  uploadPhoto(t.dataset.upload);
});

/* Season names are free text in Airtable, so they arrive in four styles:
   "July 2022 - Aug 2022", "Jul 2024 – Oct 2024", "Feb - May 2026", "June - Aug 2026".
   Normalised on display to: "Aug – Oct 2025" / "Nov 2025 – Feb 2026". */
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
                 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function seasonLabel(raw) {
  if (!raw) return raw;
  const parts = String(raw).split(/\s*[–—-]\s*/);
  if (parts.length !== 2) return raw;

  const read = (side) => {
    const m = side.match(/^([A-Za-z]+)\s*(\d{4})?$/);
    if (!m) return null;
    const idx = MONTHS3.findIndex(x => m[1].toLowerCase().startsWith(x.toLowerCase()));
    if (idx === -1) return null;
    return { month: MONTHS3[idx], year: m[2] ? Number(m[2]) : null };
  };

  const a = read(parts[0].trim()), b = read(parts[1].trim());
  if (!a || !b || !b.year) return raw;
  const startYear = a.year ?? b.year;             // "Feb - May 2026" implies 2026
  return startYear === b.year
    ? `${a.month} – ${b.month} ${b.year}`
    : `${a.month} ${startYear} – ${b.month} ${b.year}`;
}

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

/** Full ranked list for a board, respecting its minimum. */
function boardRows(b) {
  return DB.players
    .filter(p => num(p.apps) >= (b.min || 0))
    .filter(p => (b.eligible ? b.eligible(p) : true))
    .map(p => ({ p, v: b.value(p) }))
    .filter(r => Number.isFinite(r.v))
    .sort((x, y) => (b.asc ? x.v - y.v : y.v - x.v));
}

const boardRow = (r, i, b, showApps) => `
  <div class="brow" data-player="${r.p.id}">
    <span class="brank${i < 3 ? ' medal m' + (i + 1) : ''}">${i + 1}</span>
    ${avatar(r.p, showApps ? 26 : 22)}
    <span class="bname" title="${esc(r.p.name)}">${esc(r.p.name)}${
      showApps ? ` <span class="muted small">${r.p.apps} apps</span>` : ''}</span>
    <strong class="bval">${b.fmt(r.v, r.p)}</strong>
  </div>`;

function miniBoard(b, i) {
  const rows = boardRows(b);
  // Definitions and qualifiers sit in the footer so every card's first
  // placed player lands on the same line.
  const sub = [b.cardNote, b.min ? `min ${b.min} apps` : '']
    .filter(Boolean).join(' · ');
  return `<div class="card board" data-board="${i}" tabindex="0" role="button"
               title="Click for the full leaderboard">
    <h3>${b.title}</h3>
    ${rows.slice(0, 5).map((r, n) => boardRow(r, n, b, false)).join('')}
    <div class="bfoot small muted">
      ${sub ? `<span>${sub}</span>` : '<span></span>'}<span>view all →</span>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ modal */
function openBoard(i) {
  const b = BOARDS[i];
  const rows = boardRows(b);
  const overlay = el(`<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(b.title)}">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h3 style="margin:0 0 2px;text-transform:none;font-size:17px;color:var(--text)">${b.title}</h3>
          <div class="small muted">${b.note}${b.min ? ` Minimum ${b.min} appearances.` : ''}</div>
        </div>
        <button class="modal-x" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        ${rows.length
          ? rows.map((r, n) => boardRow(r, n, b, true)).join('')
          : '<div class="muted">Nobody qualifies yet.</div>'}
      </div>
      <div class="modal-foot small muted">${rows.length} player${rows.length === 1 ? '' : 's'}</div>
    </div>
  </div>`);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  $('.modal-x', overlay).onclick = close;

  // rows link through to each player's page; the avatar's upload "+" still
  // wins because its handler calls stopPropagation.
  overlay.querySelectorAll('.modal-body .brow').forEach(row => {
    row.classList.add('brow-link');
    row.onclick = (e) => {
      // clicking the avatar's upload "+" adds a photo, it doesn't navigate
      if (e.target.closest('[data-upload]')) return;
      close();
      showPlayer(Number(row.dataset.player));
    };
  });

  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.append(overlay);
  $('.modal-x', overlay).focus();
}

/* ------------------------------------------------------------------ views */
function overview() {
  const t = DB.matches;
  const played = t.filter(m => m.result);
  const W = played.filter(m => m.result === 'Win').length;
  const D = played.filter(m => m.result === 'Draw').length;
  const L = played.filter(m => m.result === 'Loss').length;
  const gf = t.reduce((s, m) => s + (m.goals_for ?? 0), 0);
  const ga = t.reduce((s, m) => s + (m.goals_against ?? 0), 0);
  const pints = DB.players.reduce((s, p) => s + Number(p.pints || 0), 0);

  // longest win streak, chronologically
  const chron = [...played].filter(m => m.played_on).sort((a, b) => a.played_on.localeCompare(b.played_on));
  let best = 0, cur = 0;
  for (const m of chron) { cur = m.result === 'Win' ? cur + 1 : 0; best = Math.max(best, cur); }

  const stat = (k, v, note = '') => `<div class="card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="n">${note}</div></div>`;

  const root = el('<div></div>');
  root.append(el(`<div class="grid cols-4">
    ${stat('Played', t.length, `${date(chron[0]?.played_on)} → ${date(chron[chron.length - 1]?.played_on)}`)}
    ${stat('Record', `${W}–${D}–${L}`, `${Math.round(100 * W / (played.length || 1))}% win rate`)}
    ${stat('Goals', `${gf}:${ga}`, `${gf - ga > 0 ? '+' : ''}${gf - ga} goal difference`)}
    ${stat('Pints', n1(pints), 'logged after matches')}
  </div>`));

  root.append(el(`<div class="grid cols-4" style="margin-top:12px">
    ${stat('Players', DB.players.length, 'all time')}
    ${stat('Opponents', DB.h2h.length, 'faced')}
    ${stat('Best run', best, 'consecutive wins')}
    ${stat('Seasons', DB.seasons.length, 'recorded')}
  </div>`));

  root.append(el('<h2>Leaderboards <span class="muted small" style="font-weight:400">— click any board for the full list</span></h2>'));
  // auto-fit: the grid reflows for however many boards are defined
  root.append(el(`<div class="grid auto">
    ${BOARDS.map((b, i) => miniBoard(b, i)).join('')}
  </div>`));

  root.querySelectorAll('[data-board]').forEach(card => {
    const open = () => openBoard(Number(card.dataset.board));
    card.onclick = open;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    };
  });

  root.append(el('<h2>Seasons</h2>'));
  root.append(table(DB.seasons, [
    { k: 'season', t: 'Season', f: r => esc(seasonLabel(r.season)) },
    { k: 'played', t: 'P' },
    { k: 'w', t: 'W/D/L', f: wdl },
    { k: 'gf', t: 'GF' }, { k: 'ga', t: 'GA' },
    { k: 'win_pct', t: 'Win %', f: r => r.win_pct == null ? '–' : r.win_pct + '%' },
  ], { sort: 'starts_on' }));
  return root;
}

const RINGERS_KEY = 'vokes-hide-ringers';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

function players() {
  const root = el('<div></div>');
  const hidden = store.get(RINGERS_KEY) === '1';
  const ctl = el(`<div class="controls">
    <input type="search" placeholder="Search players…">
    <label class="toggle" title="Hide anyone with fewer than ${RINGER} appearances">
      <input type="checkbox" id="hideRingers" ${hidden ? 'checked' : ''}>
      Hide ringers
    </label>
  </div>`);
  const count = el('<div class="small muted" style="margin:-4px 0 10px"></div>');
  const host = el('<div></div>');
  root.append(ctl, count, host);

  const render = (q = '') => {
    const hide = $('#hideRingers', ctl).checked;
    const all = DB.players.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    const rows = hide ? all.filter(p => Number(p.apps) >= RINGER) : all;
    const dropped = all.length - rows.length;
    count.textContent = `${rows.length} player${rows.length === 1 ? '' : 's'}` +
      (dropped ? ` · ${dropped} ringer${dropped === 1 ? '' : 's'} hidden (under ${RINGER} apps)` : '');
    host.innerHTML = '';
    host.append(table(rows, [
      { k: 'name', t: 'Player',
        f: r => `<span class="pcell">${avatar(r, 24)}<span class="plink">${esc(r.name)}</span></span>` },
      { k: 'apps', t: 'Apps' },
      { k: 'goals', t: 'Goals', f: r => n1(r.goals) },
      { k: 'assists', t: 'Assists', f: r => n1(r.assists) },
      { k: 'goals_per_game', t: 'G/Game', f: r => n1(r.goals_per_game) },
      { k: 'w', t: 'W/D/L', f: wdl },
      { k: 'win_pct', t: 'Win %', f: r => r.win_pct == null ? '–' : r.win_pct + '%' },
      { k: 'motm', t: 'MOM' },
      { k: 'dotd', t: 'DOD' },
      { k: 'pints', t: 'Pints', f: r => n1(r.pints) },
      { k: 'clean_sheets', t: 'CS' },
    ], { sort: 'apps', onClick: showPlayer }));
  };
  const search = $('input[type=search]', ctl);
  search.oninput = () => render(search.value);
  $('#hideRingers', ctl).onchange = (e) => {
    store.set(RINGERS_KEY, e.target.checked ? '1' : '0');
    render(search.value);
  };
  render();
  return root;
}

// mount a player detail page (the table's onClick only returns an element)
function showPlayer(id) {
  const node = playerDetail(id);
  if (!node) return;
  const main = $('#main');
  main.innerHTML = '';
  main.append(node);
  window.scrollTo(0, 0);
}

function playerDetail(id) {
  const p = DB.players.find(x => x.id === id);
  if (!p) return null;
  const mine = DB.matches.filter(m => (m.squad || []).some(s => s.player === p.name));
  const root = el('<div></div>');
  root.append(el('<button class="back">← All players</button>'));
  $('.back', root).onclick = () => render('players');

  root.append(el(`<div class="player-head">
    ${avatar(p, 68)}
    <div><h1 style="font-size:24px;margin:0">${esc(p.name)}</h1>
    <div class="sub" style="margin:0">${p.apps} appearances · ${date(p.first_game)} → ${date(p.last_game)} · ${p.seasons} seasons</div></div>
  </div>`));

  const stat = (k, v, note = '') => `<div class="card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="n">${note}</div></div>`;
  root.append(el(`<div class="grid cols-4" style="margin-top:16px">
    ${stat('Goals', n1(p.goals), `${n1(p.goals_per_game)} per game`)}
    ${stat('Assists', n1(p.assists), '')}
    ${stat('Record', `${p.w}–${p.d}–${p.l}`, `${p.win_pct ?? '–'}% win rate`)}
    ${stat('Pints', n1(p.pints), `${p.clean_sheets} clean stints in goal`)}
  </div>`));
  root.append(el(`<div class="grid cols-4" style="margin-top:12px">
    ${stat('MOM', p.motm, 'awards won')}
    ${stat('DOD', p.dotd, 'awards collected')}
    ${stat('Errors', n1(p.errors), 'leading to goals')}
    ${stat('Bookings', p.bookings, 'warnings and worse')}
  </div>`));

  // where this player sits on every leaderboard they qualify for
  const ranks = BOARDS
    .map(b => {
      const rows = boardRows(b);
      const i = rows.findIndex(r => r.p.id === p.id);
      return i === -1 ? null : { b, rank: i + 1, total: rows.length, v: rows[i].v };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank / a.total - b.rank / b.total);

  if (ranks.length) {
    root.append(el('<h2>Squad ranking</h2>'));
    root.append(el(`<div class="rankbars">
      ${ranks.map(r => `
        <div class="rankbar${r.rank === 1 ? ' first' : ''}">
          <span class="rankbar-pos">${r.rank}<span class="ord">${ordinal(r.rank)}</span></span>
          <span class="rankbar-title">${r.b.title}</span>
          <span class="rankbar-of muted small">of ${r.total}</span>
          <span class="rankbar-val">${r.b.fmt(r.v, p)}</span>
        </div>`).join('')}
    </div>`));
  }

  root.append(el(`<h2>Matches (${mine.length})</h2>`));
  root.append(matchList(mine, p.name));
  return root;
}

const RARE_KEY = 'vokes-hide-rare';

function h2hView() {
  const root = el('<div></div>');
  const hidden = store.get(RARE_KEY) === '1';
  const ctl = el(`<div class="controls">
    <label class="toggle" title="Hide opponents faced fewer than ${RARE} times">
      <input type="checkbox" id="hideRare" ${hidden ? 'checked' : ''}>
      Hide rare teams
    </label>
  </div>`);
  const count = el('<div class="small muted" style="margin:-4px 0 10px"></div>');
  const host = el('<div></div>');
  root.append(ctl, count, host);

  const render = () => {
    const hide = $('#hideRare', ctl).checked;
    const rows = hide ? DB.h2h.filter(o => Number(o.played) >= RARE) : DB.h2h;
    const dropped = DB.h2h.length - rows.length;
    count.textContent = `${rows.length} opponent${rows.length === 1 ? '' : 's'}` +
      (dropped ? ` · ${dropped} hidden (under ${RARE} meetings)` : '');
    host.innerHTML = '';
    host.append(h2hTable(rows));
  };
  $('#hideRare', ctl).onchange = (e) => {
    store.set(RARE_KEY, e.target.checked ? '1' : '0');
    render();
  };
  render();
  return root;
}

function h2hTable(rows) {
  return table(rows, [
    { k: 'opposition', t: 'Opposition' },
    { k: 'played', t: 'P' },
    { k: 'w', t: 'W/D/L', f: wdl },
    { k: 'gf', t: 'GF' }, { k: 'ga', t: 'GA' },
    { k: 'gd', t: 'GD', f: r => (r.gd > 0 ? '+' : '') + r.gd },
    { k: 'win_pct', t: 'Win %', f: r => r.win_pct == null ? '–' : r.win_pct + '%' },
    { k: 'last_played', t: 'Last met', f: r => date(r.last_played) },
  ], { sort: 'played' });
}

function matchList(rows, highlight) {
  const host = el('<div></div>');
  rows.forEach(m => {
    const cls = m.result === 'Win' ? 'w' : m.result === 'Draw' ? 'd' : m.result === 'Loss' ? 'l' : '';
    const score = m.goals_for == null ? '–' : `${m.goals_for}–${m.goals_against}`;
    const card = el(`<div class="match">
      <div class="match-head">
        <span class="match-score pill ${cls}">${score}</span>
        <span class="match-opp">${esc(m.opposition)}</span>
        <span class="match-date">${date(m.played_on)}</span>
      </div></div>`);
    let open = false;
    $('.match-head', card).onclick = () => {
      open = !open;
      const ex = $('.match-body', card);
      if (ex) ex.remove();
      if (!open) return;
      const squad = m.squad || [];
      card.append(el(`<div class="match-body">
        <div class="small muted" style="margin:12px 0 8px">
          ${esc(seasonLabel(m.season) || '')}${m.weather ? ' · ' + esc(m.weather) : ''}
          ${m.motm ? ' · MOM ' + esc(m.motm) : ''}${m.dotd ? ' · DOD ' + esc(m.dotd) : ''}</div>
        <div class="tablewrap"><table>
          <thead><tr><th>Player</th><th>G</th><th>A</th><th>Err</th><th>Pints</th><th>CS</th><th>Card</th></tr></thead>
          <tbody>${squad.map(s => `<tr${highlight === s.player ? ' style="background:rgba(63,185,80,.08)"' : ''}>
            <td>${esc(s.player)}</td><td>${n1(s.goals)}</td><td>${n1(s.assists)}</td>
            <td>${n1(s.errors)}</td><td>${n1(s.pints)}</td>
            <td>${s.clean_sheet === true ? '✓' : s.clean_sheet === false ? '✗' : '–'}</td>
            <td>${esc(s.disciplinary && s.disciplinary !== 'Not for me' ? s.disciplinary : '–')}</td></tr>`).join('')}</tbody>
        </table></div>
        ${m.match_report ? `<div class="report">${esc(m.match_report)}</div>` : ''}
      </div>`));
    };
    host.append(card);
  });
  return host;
}

function matches() {
  const root = el('<div></div>');
  const ctl = el(`<div class="controls">
    <input type="search" placeholder="Search opponent or report…">
    <select><option value="">All results</option><option>Win</option><option>Draw</option><option>Loss</option></select>
    <select class="season"><option value="">All seasons</option>${DB.seasons.map(s =>
      `<option value="${esc(s.season)}">${esc(seasonLabel(s.season))}</option>`).join('')}</select>
  </div>`);
  const host = el('<div></div>');
  const count = el('<div class="small muted" style="margin-bottom:10px"></div>');
  root.append(ctl, count, host);

  const render = () => {
    const q = $('input', ctl).value.toLowerCase();
    const res = ctl.querySelectorAll('select')[0].value;
    const sea = ctl.querySelectorAll('select')[1].value;
    const rows = DB.matches.filter(m =>
      (!q || (m.opposition + ' ' + (m.match_report || '')).toLowerCase().includes(q)) &&
      (!res || m.result === res) && (!sea || m.season === sea));
    count.textContent = `${rows.length} match${rows.length === 1 ? '' : 'es'}`;
    host.innerHTML = '';
    host.append(matchList(rows));
  };
  ctl.querySelectorAll('input,select').forEach(x => x.oninput = render);
  render();
  return root;
}

/* ---------------------------------------------------------------- routing */
const VIEWS = { overview, players, h2h: h2hView, matches, cool: coolStats };

function render(v) {
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const main = $('#main');
  main.innerHTML = '';
  main.append(VIEWS[v]());
  window.scrollTo(0, 0);
}

async function boot() {
  const main = $('#main');
  if (!CFG.url || !CFG.anonKey) {
    main.innerHTML = `<div class="notice err"><strong>Not configured yet.</strong><br>
      Open <code>web/config.js</code> and paste your Supabase Project URL and anon key.
      See <code>README.md</code> for the four setup steps.</div>`;
    return;
  }
  try {
    // explicit limits: Supabase can cap rows returned by default
    const [p, h, s, m] = await Promise.all([
      api('player_stats?select=*&limit=2000'),
      api('head_to_head?select=*&limit=2000'),
      api('season_stats?select=*&limit=2000'),
      api('match_detail?select=*&order=played_on.desc.nullslast&limit=5000'),
    ]);
    Object.assign(DB, { players: p, h2h: h, seasons: s, matches: m });
    addRivalBoard();
    // recruited_by only exists after the data update; skip the board if absent
    try {
      DB.recruits = await api('players?select=name,recruited_by&limit=2000');
      addRecruiterBoard();
    } catch (e) { /* column not there yet — no recruiter board */ }
    document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
      if (b.dataset.href) { location.href = b.dataset.href; return; }
      render(b.dataset.v);
    });
    render('overview');
  } catch (e) {
    main.innerHTML = `<div class="notice err"><strong>Couldn't load from Supabase.</strong><br>
      <code>${esc(e.message)}</code><br><br>
      Check the URL and anon key in <code>config.js</code>, and that both SQL files have been run.</div>`;
  }
}

boot();

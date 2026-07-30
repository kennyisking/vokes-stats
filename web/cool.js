/* "Cool stats" — hand-built SVG visualisations, no chart library.
   Everything here is computed from the same four views the rest of the site uses. */

function coolStats() {
  const root = el('<div></div>');
  const chron = DB.matches
    .filter(m => m.played_on)
    .slice()
    .sort((a, b) => a.played_on.localeCompare(b.played_on));

  // Only add a note where the visual is unreadable without it.
  const section = (title, note) => {
    root.append(el(`<h2>${title}</h2>`));
    if (note) root.append(el(`<div class="small muted" style="margin:-8px 0 12px">${note}</div>`));
  };
  const card = (inner) => el(`<div class="card" style="overflow-x:auto">${inner}</div>`);

  /* ============================================================ 1. arc */
  (() => {
    const pts = [];
    let cum = 0;
    chron.filter(m => m.goals_for != null).forEach((m, i) => {
      cum += m.goals_for - m.goals_against;
      pts.push({ i, cum, m });
    });
    if (pts.length < 2) return;

    const W = 860, H = 260, PAD = 34;
    const maxI = pts.length - 1;
    const lo = Math.min(...pts.map(p => p.cum)), hi = Math.max(...pts.map(p => p.cum));
    const x = i => PAD + (i / maxI) * (W - PAD * 2);
    const y = v => H - PAD - ((v - lo) / ((hi - lo) || 1)) * (H - PAD * 2);

    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.cum).toFixed(1)}`).join('');
    const area = `${line}L${x(maxI).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
    const trough = pts.reduce((a, b) => (b.cum < a.cum ? b : a));
    const peak = pts.reduce((a, b) => (b.cum > a.cum ? b : a));
    const last = pts[pts.length - 1];

    const mark = (p, label, dy) => `
      <circle cx="${x(p.i)}" cy="${y(p.cum)}" r="4" fill="var(--accent)"/>
      <text x="${x(p.i)}" y="${y(p.cum) + dy}" font-size="11" fill="var(--muted)"
            text-anchor="${p.i > maxI * 0.8 ? 'end' : p.i < maxI * 0.2 ? 'start' : 'middle'}">${label}</text>`;

    const yr = d => new Date(d).getUTCFullYear();

    section('Cumulative goal difference');
    root.append(card(`
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;min-width:560px">
        <defs><linearGradient id="gdFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".35"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient></defs>
        <line x1="${PAD}" y1="${y(0)}" x2="${W - PAD}" y2="${y(0)}"
              stroke="var(--muted)" stroke-dasharray="3 3" opacity=".5"/>
        <text x="${PAD - 6}" y="${y(0) + 4}" font-size="11" fill="var(--muted)" text-anchor="end">0</text>
        <path d="${area}" fill="url(#gdFill)"/>
        <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"/>
        ${mark(trough, `${trough.cum}`, 18)}
        ${mark(peak, `+${peak.cum}`, -10)}
        ${mark(last, `${last.cum > 0 ? '+' : ''}${last.cum}`, -10)}
        <text x="${PAD}" y="${H - 8}" font-size="11" fill="var(--muted)">${yr(pts[0].m.played_on)}</text>
        <text x="${W - PAD}" y="${H - 8}" font-size="11" fill="var(--muted)" text-anchor="end">${yr(last.m.played_on)}</text>
      </svg>`));
  })();

  /* ================================================== 2. rivalry ladder */
  (() => {
    const MIN_MEET = 6;
    const rows = DB.h2h
      .filter(o => Number(o.played) >= MIN_MEET && o.win_pct != null)
      .map(o => ({ name: o.opposition, p: Number(o.played), pct: Number(o.win_pct) }))
      .sort((a, b) => b.pct - a.pct);
    if (rows.length < 3) return;

    const overall = (() => {
      const pl = chron.filter(m => m.result);
      return pl.length ? 100 * pl.filter(m => m.result === 'Win').length / pl.length : 50;
    })();

    section('Win rate by opponent', `Opponents faced ${MIN_MEET}+ times. Dashed line is the all-time average.`);
    root.append(card(`
      <div style="position:relative">
        <div style="position:absolute;left:calc(160px + ${overall.toFixed(1)}% * 0.62);top:0;bottom:0;
                    border-left:1px dashed var(--muted);opacity:.6"></div>
        ${rows.map(r => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <div style="width:150px;flex:none;font-size:13px;white-space:nowrap;overflow:hidden;
                        text-overflow:ellipsis">${esc(r.name)}</div>
            <div style="flex:1;background:var(--panel-2);border-radius:5px;height:18px;overflow:hidden">
              <div title="${esc(r.name)}: ${r.p} played, ${r.pct.toFixed(1)}% won"
                   style="width:${r.pct.toFixed(1)}%;height:100%;border-radius:5px;
                          background:${r.pct >= 60 ? 'var(--win)' : r.pct >= 40 ? 'var(--draw)' : 'var(--loss)'}"></div>
            </div>
            <div class="small muted" style="width:78px;text-align:right;flex:none">
              ${r.pct.toFixed(0)}% · P${r.p}</div>
          </div>`).join('')}
      </div>`));
  })();

  /* ==================================================== 3. MOM vs DOD */
  (() => {
    const MIN_APPS = 15;
    const rows = DB.players
      .filter(p => Number(p.apps) >= MIN_APPS)
      .map(p => ({ name: p.name, mom: Number(p.motm || 0), dod: Number(p.dotd || 0) }))
      .map(r => ({ ...r, net: r.mom - r.dod }))
      .sort((a, b) => b.net - a.net);
    if (rows.length < 3) return;

    const max = Math.max(...rows.map(r => Math.max(r.mom, r.dod))) || 1;

    section('MOM vs DOD', `Players with ${MIN_APPS}+ appearances. DOD left, MOM right.`);
    root.append(card(`
      <div>
        ${rows.map(r => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <div style="width:140px;flex:none;font-size:13px;white-space:nowrap;overflow:hidden;
                        text-overflow:ellipsis">${esc(r.name)}</div>
            <div style="flex:1;display:flex;align-items:center">
              <div style="flex:1;display:flex;justify-content:flex-end">
                <div title="${r.dod} DOD" style="width:${(r.dod / max * 100).toFixed(1)}%;height:16px;
                     background:var(--loss);border-radius:4px 0 0 4px"></div>
              </div>
              <div style="width:1px;height:22px;background:var(--muted);opacity:.5"></div>
              <div style="flex:1">
                <div title="${r.mom} MOM" style="width:${(r.mom / max * 100).toFixed(1)}%;height:16px;
                     background:var(--win);border-radius:0 4px 4px 0"></div>
              </div>
            </div>
            <div class="small" style="width:74px;text-align:right;flex:none;
                 color:${r.net > 0 ? 'var(--win)' : r.net < 0 ? 'var(--loss)' : 'var(--muted)'}">
              ${r.net > 0 ? '+' : ''}${r.net}
              <span class="muted">(${r.mom}/${r.dod})</span></div>
          </div>`).join('')}
      </div>`));
  })();

  /* ======================================================= 4. pints */
  (() => {
    const buckets = { Win: [], Draw: [], Loss: [] };
    chron.forEach(m => {
      if (!m.result || !(m.squad && m.squad.length)) return;   // needs a recorded squad
      // a match with a squad but no pints logged counts as a genuine 0
      const p = (m.squad || []).reduce((s, x) => s + Number(x.pints || 0), 0);
      buckets[m.result].push(p);
    });
    const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    const data = ['Win', 'Draw', 'Loss'].map(r => ({ r, v: avg(buckets[r]), n: buckets[r].length }));
    if (!data.some(d => d.n)) return;
    const max = Math.max(...data.map(d => d.v)) * 1.15;

    section('Team pints per match, by result');
    root.append(card(`
      <div style="display:flex;flex-direction:column;gap:12px">
        ${data.map(d => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <strong>${d.r}</strong>
              <span class="muted">${d.v.toFixed(2)} pints · ${d.n} matches</span>
            </div>
            <div style="background:var(--panel-2);border-radius:6px;height:26px;overflow:hidden">
              <div style="width:${(d.v / max * 100).toFixed(1)}%;height:100%;border-radius:6px;
                background:${d.r === 'Win' ? 'var(--win)' : d.r === 'Draw' ? 'var(--draw)' : 'var(--loss)'}"></div>
            </div>
          </div>`).join('')}
      </div>`));
  })();

  /* ============================================ 4b. pints seasonality */
  (() => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const per = MONTHS.map(() => ({ sum: 0, n: 0 }));
    chron.forEach(m => {
      if (!(m.squad && m.squad.length)) return;   // needs a recorded squad
      // no pints logged for a played match counts as 0, not as missing
      const pints = (m.squad || []).reduce((s, x) => s + Number(x.pints || 0), 0);
      const mo = new Date(m.played_on).getUTCMonth();
      per[mo].sum += pints; per[mo].n += 1;
    });
    const data = per.map((d, i) => ({ m: MONTHS[i], v: d.n ? d.sum / d.n : 0, n: d.n }));
    if (!data.some(d => d.n)) return;
    const peak = data.reduce((a, b) => (b.v > a.v ? b : a));
    const max = peak.v * 1.18 || 1;

    const W = 860, H = 250, PAD = 34, BOT = 26;
    const colW = (W - PAD * 2) / 12;
    const barW = colW * 0.58;
    const cx = i => PAD + colW * i + colW / 2;
    const y = v => H - BOT - (v / max) * (H - BOT - PAD);
    const base = H - BOT;

    const cols = data.map((d, i) => {
      const bx = cx(i) - barW / 2, by = y(d.v);
      const isPeak = d.n && d.v === peak.v;
      const label = d.n
        ? `<text x="${cx(i)}" y="${by - 5}" font-size="10" fill="var(--muted)" text-anchor="middle">${d.v.toFixed(1)}</text>`
        : '';
      return `
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}"
              height="${(base - by).toFixed(1)}" rx="3" fill="var(--accent)"
              opacity="${d.n ? (isPeak ? 1 : 0.5) : 0.1}">
          <title>${d.m}: ${d.n ? d.v.toFixed(2) + ' pints/match · ' + d.n + ' match' + (d.n === 1 ? '' : 'es') : 'no pints logged'}</title>
        </rect>${label}
        <text x="${cx(i)}" y="${H - 8}" font-size="11" text-anchor="middle"
              fill="${isPeak ? 'var(--accent)' : 'var(--muted)'}">${d.m}</text>`;
    }).join('');

    section('Pints per match, by calendar month');
    root.append(card(`
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;min-width:560px">
        <line x1="${PAD}" y1="${base}" x2="${W - PAD}" y2="${base}" stroke="var(--muted)" opacity=".35"/>
        ${cols}
      </svg>`));
  })();

  /* ====================================================== 5. weather */
  (() => {
    const MIN_MATCHES = 5;
    const by = {};
    chron.forEach(m => {
      if (!m.result || !m.weather) return;
      (by[m.weather] ||= []).push(m);
    });
    const rows = Object.entries(by)
      .filter(([, ms]) => ms.length >= MIN_MATCHES)
      .map(([w, ms]) => ({
        w, n: ms.length,
        pct: 100 * ms.filter(m => m.result === 'Win').length / ms.length,
      }))
      .sort((a, b) => b.pct - a.pct);
    if (rows.length < 2) return;

    section('Win rate by weather', `Conditions with ${MIN_MATCHES}+ matches.`);
    root.append(card(`
      <div>
        ${rows.map(r => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
            <div style="width:170px;flex:none;font-size:13px;white-space:nowrap;overflow:hidden;
                        text-overflow:ellipsis">${esc(r.w)}</div>
            <div style="flex:1;background:var(--panel-2);border-radius:5px;height:18px;overflow:hidden">
              <div title="${esc(r.w)}: ${r.n} matches, ${r.pct.toFixed(1)}% won"
                   style="width:${r.pct.toFixed(1)}%;height:100%;border-radius:5px;
                          background:${r.pct >= 60 ? 'var(--win)' : r.pct >= 40 ? 'var(--draw)' : 'var(--loss)'}"></div>
            </div>
            <div class="small muted" style="width:74px;text-align:right;flex:none">
              ${r.pct.toFixed(0)}% · n=${r.n}</div>
          </div>`).join('')}
      </div>`));
  })();

  /* ================================================= 6. scoreline bingo */
  (() => {
    const grid = {};
    let maxG = 0, most = 0;
    chron.forEach(m => {
      if (m.goals_for == null) return;
      const k = `${m.goals_for}|${m.goals_against}`;
      grid[k] = (grid[k] || 0) + 1;
      most = Math.max(most, grid[k]);
      maxG = Math.max(maxG, m.goals_for, m.goals_against);
    });
    if (!maxG) return;
    const N = Math.min(maxG, 12);

    let rows = '';
    for (let ga = 0; ga <= N; ga++) {
      let tds = `<td style="text-align:center;color:var(--muted);font-size:11px">${ga}</td>`;
      for (let gf = 0; gf <= N; gf++) {
        const c = grid[`${gf}|${ga}`] || 0;
        const t = c / most;
        const col = gf > ga ? '63,185,80' : gf < ga ? '248,81,73' : '210,153,34';
        tds += `<td style="text-align:center;padding:0">
          <div title="${gf}–${ga}: ${c} time${c === 1 ? '' : 's'}"
               style="width:26px;height:22px;display:grid;place-items:center;font-size:11px;
                      background:rgba(${col},${(t * 0.9).toFixed(2)});border-radius:3px;
                      color:${t > 0.5 ? '#fff' : 'var(--text)'}">${c || ''}</div></td>`;
      }
      rows += `<tr>${tds}</tr>`;
    }
    const header = `<tr><th></th>${Array.from({ length: N + 1 }, (_, i) =>
      `<th style="text-align:center;font-size:11px">${i}</th>`).join('')}</tr>`;

    section('Scoreline frequency');
    root.append(card(`
      <div style="display:flex;gap:8px;align-items:flex-start">
        <div class="small muted" style="writing-mode:vertical-rl;transform:rotate(180deg);padding-top:20px">conceded</div>
        <div>
          <div class="small muted" style="margin-bottom:4px">scored →</div>
          <table style="border-collapse:separate;border-spacing:2px">${header}${rows}</table>
        </div>
      </div>`));
  })();

  /* ================================================ 6. squad generations */
  (() => {
    const people = DB.players
      .filter(p => Number(p.apps) >= 15 && p.first_game && p.last_game)
      .sort((a, b) => a.first_game.localeCompare(b.first_game));
    if (people.length < 2) return;

    const t0 = new Date(chron[0].played_on).getTime();
    const t1 = new Date(chron[chron.length - 1].played_on).getTime();
    const span = (t1 - t0) || 1;
    const pos = d => ((new Date(d).getTime() - t0) / span) * 100;

    const years = [];
    for (let y = new Date(t0).getUTCFullYear(); y <= new Date(t1).getUTCFullYear(); y++) {
      const p = pos(`${y}-01-01`);
      if (p >= 0 && p <= 100) years.push({ y, p });
    }

    section('First to most recent appearance');
    root.append(card(`
      <div style="position:relative;padding-top:18px">
        ${years.map(y => `<div style="position:absolute;top:0;left:${y.p}%;height:100%;
          border-left:1px dashed var(--line)"><span class="small muted"
          style="position:absolute;top:-2px;left:3px">${y.y}</span></div>`).join('')}
        ${people.map(p => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;position:relative">
            <div style="width:132px;flex:none;font-size:13px;white-space:nowrap;overflow:hidden;
                        text-overflow:ellipsis">${esc(p.name)}</div>
            <div style="flex:1;position:relative;height:14px">
              <div title="${esc(p.name)}: ${date(p.first_game)} → ${date(p.last_game)}, ${p.apps} apps"
                   style="position:absolute;left:${pos(p.first_game).toFixed(1)}%;
                          width:${Math.max(1.2, pos(p.last_game) - pos(p.first_game)).toFixed(1)}%;
                          height:100%;border-radius:7px;background:var(--accent);
                          opacity:${(0.35 + Math.min(1, Number(p.apps) / 166) * 0.65).toFixed(2)}"></div>
            </div>
            <div class="small muted" style="width:52px;text-align:right;flex:none">${p.apps}</div>
          </div>`).join('')}
      </div>`));
  })();

  return root;
}

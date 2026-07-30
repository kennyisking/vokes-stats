#!/usr/bin/env python3
"""
Vokes POC — stage 1: turn the Airtable CSV exports into a normalised seed file.

Usage:  python3 build.py
Reads:  ../Historic Matches.csv, ../Match Report – Stats.csv
Writes: seed.json  (consumed by scripts/load.mjs)

The CSVs are *view* exports and are missing many captured fields. The schema
models the FULL structure; missing columns simply load as NULL. See
../data-audit-and-recommendation.md.
"""

import csv, json, re, datetime, collections, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
MATCHES_CSV = os.path.join(SRC, 'Historic Matches.csv')
PERF_CSV = os.path.join(SRC, 'Match Report – Stats.csv')


def parse_date(s):
    s = (s or '').strip()
    for fmt in ('%d %B %Y', '%d %b %Y'):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def num_or_none(v):
    v = (v or '').strip()
    if not v:
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except ValueError:
        return None


def split_list(v):
    return [x.strip() for x in (v or '').split(',') if x.strip()]


def first_name(v):
    """MOTM/DOTD are multi-selects like Players — at least one match has a
    JOINT award ('Joe Day,Ario Aribaldi'). Treating the raw string as a name
    invents a phantom player, so split and take the first.
    A joint award can't be modelled by a single motm_player_id column; see
    README 'Known gaps'."""
    names = split_list(v)
    return names[0] if names else None


def main():
    matches_raw = list(csv.DictReader(open(MATCHES_CSV, encoding='utf-8-sig')))
    perf_raw = list(csv.DictReader(open(PERF_CSV, encoding='utf-8-sig')))

    players, oppositions, seasons = {}, {}, {}

    def pid(name):
        name = name.strip()
        if name not in players:
            players[name] = len(players) + 1
        return players[name]

    def oid(name):
        name = name.strip()
        if name not in oppositions:
            oppositions[name] = len(oppositions) + 1
        return oppositions[name]

    def sid(name):
        name = (name or '').strip() or 'Unknown'
        if name not in seasons:
            seasons[name] = len(seasons) + 1
        return seasons[name]

    # ---------- matches ----------
    matches, by_fixture = [], {}
    for i, m in enumerate(matches_raw, start=1):
        fixture = m['Fixture name'].strip()
        d = parse_date(m['Match date ()'])
        opposition = re.sub(r'\s*-\s*\d{1,2}\s+\w+\s+\d{4}\s*$', '', fixture).strip()

        gf = ga = None
        sm = re.match(r'^(\d+)\s*-\s*(\d+)', (m['Score'] or '').strip())
        if sm:
            gf, ga = int(sm.group(1)), int(sm.group(2))

        report = (m['Match report'] or '').strip()
        one_where = None
        ow = re.search(r'>\s*The one where\.{0,3}\s*(.+)', report)
        if ow:
            one_where = ow.group(1).strip()

        for nm in split_list(m['Players']):
            pid(nm)
        motm_name = first_name(m['Man of the match'])
        dotd_name = first_name(m['Dick of the day'])
        for nm in (motm_name, dotd_name):
            if nm:
                pid(nm)

        rec = {
            'id': i,
            'fixture_name': fixture,
            'opposition_id': oid(opposition),
            'season_id': sid(m['Season']),
            'played_on': d.isoformat() if d else None,
            'goals_for': gf,
            'goals_against': ga,
            'result': (m['Match result'] or '').strip() or None,
            'motm_player_id': pid(motm_name) if motm_name else None,
            'dotd_player_id': pid(dotd_name) if dotd_name else None,
            'weather': (m['Weather report'] or '').strip() or None,
            'one_where': one_where,
            'match_report': report or None,
            # captured by the live form but absent from this export:
            'opponent_has_keeper': None,
            'notes': None,
        }
        matches.append(rec)
        by_fixture[fixture] = rec

    # ---------- performances ----------
    seen, duplicates, orphans, performances = set(), [], [], []
    for p in perf_raw:
        key = p['Performance'].strip()
        if key in seen:
            duplicates.append(key)
            continue
        seen.add(key)

        parts = key.rsplit(' - ', 1)
        if len(parts) != 2 or parts[0].strip() not in by_fixture:
            orphans.append(key)
            continue
        fixture, player = parts[0].strip(), parts[1].strip()

        cs = (p['Clean sheet whilst in goal'] or '').strip()
        performances.append({
            'id': len(performances) + 1,
            'match_id': by_fixture[fixture]['id'],
            'player_id': pid(player),
            'goals': num_or_none(p['Goals']),
            'assists': num_or_none(p['Assists']),
            'errors': num_or_none(p['Errors leading to goals']),
            'pints': num_or_none(p['Pints']),
            'clean_sheet': True if cs == 'True' else (False if cs == 'False' else None),
            'disciplinary': (p['Disciplinary procedures'] or '').strip() or None,
            # captured by the live form but absent from this export:
            'penalties': None, 'shots_out_of_cage': None,
            'xg_for': None, 'xg_against': None, 'spice_rating': None,
            'game_description': None, 'memorable_moment': None, 'paid': None,
        })

    seed = {
        'generated': datetime.datetime.now().isoformat(timespec='seconds'),
        'source': 'Airtable view exports (incomplete — see data audit)',
        'players': [{'id': i, 'name': n, 'photo_url': None} for n, i in players.items()],
        'oppositions': [{'id': i, 'name': n} for n, i in oppositions.items()],
        'seasons': [{'id': i, 'name': n} for n, i in seasons.items()],
        'matches': matches,
        'performances': performances,
        'quality': {
            'duplicate_performances_skipped': sorted(set(duplicates)),
            'orphan_performances': orphans,
            'matches_missing_result': [m['fixture_name'] for m in matches if not m['result']],
            'matches_missing_score': [m['fixture_name'] for m in matches if m['goals_for'] is None],
        },
    }

    out = os.path.join(HERE, 'seed.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, indent=1)

    print(f'Wrote {out}')
    print(f"  players       {len(seed['players']):>5}")
    print(f"  oppositions   {len(seed['oppositions']):>5}")
    print(f"  seasons       {len(seed['seasons']):>5}")
    print(f"  matches       {len(seed['matches']):>5}")
    print(f"  performances  {len(seed['performances']):>5}")
    print(f"  duplicates skipped {len(set(duplicates))}, orphans {len(orphans)}")


if __name__ == '__main__':
    main()

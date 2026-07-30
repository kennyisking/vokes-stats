/* Parser for playfiveaside.com fixture pages.
   Deliberately text-based rather than HTML-structure-based, so a redesign of
   their markup doesn't break it. Works on raw HTML, on rendered page text, or
   on anything in between. */

(function (root) {
  const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
    oct: 10, nov: 11, dec: 12,
  };
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const ENTITIES = {
    rsquo: "'", lsquo: "'", apos: "'", quot: '"', ldquo: '"', rdquo: '"',
    amp: '&', nbsp: ' ', ndash: '-', mdash: '-', hellip: '…',
  };

  /** Entity decode that works with or without a DOM (so it's unit-testable). */
  function decodeEntities(t) {
    return t
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
  }

  const DATE_RE = /(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/gi;
  const FIXTURE_RE = /(\d{1,2}:\d{2}\s*[AP]\.?M\.?)([\s\S]{0,200}?)(\d{1,3})\s*:\s*(\d{1,3})([\s\S]{0,120}?)(?=\d{1,2}:\d{2}\s*[AP]\.?M\.?|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4}|$)/gi;

  /** Strip markup, links and site furniture, leaving readable text. */
  function toText(input) {
    let t = String(input || '');
    if (/<[a-z!][\s\S]*>/i.test(t)) {
      t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
           .replace(/<style[\s\S]*?<\/style>/gi, ' ')
           .replace(/<[^>]+>/g, ' ');
    }
    t = decodeEntities(t);
    return t
      .replace(/ /g, ' ')
      .replace(/[‘’ʼ]/g, "'")    // curly → straight apostrophes
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')      // markdown links
      // Goal-by-goal tables sit in markdown rows and would otherwise bleed
      // into the away team's name. Drop those lines wholesale.
      .split(/\r?\n/)
      .filter(line => {
        const l = line.replace(/^\s*[-*+]\s*/, '');   // drop any list bullet first
        return !/^\|/.test(l) && !/^[-|:\s]+$/.test(l);
      })
      .join('\n')
      .replace(/#collapseExample_?\d*/gi, ' ')
      .replace(/\bPAY\b/g, ' ')
      .replace(/\[?\s*Pitch\s*\d+\s*\]?/gi, ' ')
      .replace(/\|/g, ' ')
      .replace(/\*\*/g, ' ');
  }

  /** Tidy a captured team name. */
  function cleanTeam(s) {
    return String(s || '')
      // if any goal-detail slipped through, cut at the first score pattern
      .replace(/\d+\s*:\s*\d+[\s\S]*$/, ' ')
      .replace(/\bPOM\b\s*:?[\s\S]*$/i, ' ')
      .replace(/\bCards\b\s*:?[\s\S]*$/i, ' ')
      .replace(/[-–—>#*_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const iso = (y, m, d) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  /** "2026-07-28" -> "28 Jul 2026", matching the imported fixture names. */
  function ukDate(isoStr) {
    const [y, m, d] = isoStr.split('-');
    return `${d} ${SHORT[Number(m) - 1]} ${y}`;
  }

  /**
   * @returns {Array<{date, time, home, away, homeGoals, awayGoals}>}
   */
  function parseFixtures(input) {
    const text = toText(input);

    // Index every date header so each fixture can inherit the nearest one above it.
    const dates = [];
    let dm;
    DATE_RE.lastIndex = 0;
    while ((dm = DATE_RE.exec(text)) !== null) {
      const month = MONTHS[dm[1].toLowerCase()];
      if (!month) continue;
      dates.push({ at: dm.index, date: iso(Number(dm[3]), month, Number(dm[2])) });
    }

    const dateFor = (pos) => {
      let found = null;
      for (const d of dates) { if (d.at < pos) found = d.date; else break; }
      return found;
    };

    const out = [];
    let fm;
    FIXTURE_RE.lastIndex = 0;
    while ((fm = FIXTURE_RE.exec(text)) !== null) {
      const home = cleanTeam(fm[2]);
      const away = cleanTeam(fm[5]);
      if (!home || !away) continue;
      if (home.length > 60 || away.length > 60) continue;
      out.push({
        date: dateFor(fm.index),
        time: fm[1].replace(/\s+/g, ' ').trim(),
        home,
        away,
        homeGoals: Number(fm[3]),
        awayGoals: Number(fm[4]),
      });
    }
    return out;
  }

  /** Keep only fixtures involving `teamName`, from the team's point of view. */
  function forTeam(fixtures, teamName) {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const me = norm(teamName);
    return fixtures
      .filter(f => norm(f.home) === me || norm(f.away) === me)
      .map(f => {
        const atHome = norm(f.home) === me;
        return {
          date: f.date,
          time: f.time,
          opposition: atHome ? f.away : f.home,
          goalsFor: atHome ? f.homeGoals : f.awayGoals,
          goalsAgainst: atHome ? f.awayGoals : f.homeGoals,
        };
      });
  }

  const api = { parseFixtures, forTeam, ukDate, toText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FixturesParser = api;
})(typeof self !== 'undefined' ? self : this);

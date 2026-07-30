#!/usr/bin/env node
/* Tests the fixture parser against real playfiveaside page text, in three
   shapes: as-rendered markdown, one-token-per-line (browser copy/paste),
   and raw HTML. Run: node scripts/test-parser.mjs */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const P = require(join(HERE, '..', 'web', 'fixtures-parser.js'));

const TEAM = "That's All Vokes";
let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

// ---- shape 1: as the page renders / markdown-converted -------------------
const markdown = `
### Tuesday, July 21, 2026

- 7:00 PM [Pitch 1] [PAY](x) That's All Vokes 3 : 2 [PAY](y) Cereal Choppers FC [#collapseExample_19](#c)
- | | Fed | **1 : 0** | | |
| **POM**: Wes | | | | |
- 7:40 PM [Pitch 1] [PAY](x) Super Soccer Striker Penguins 1 : 9 [PAY](y) TBC FC [#collapseExample_20](#c)
- 8:20 PM [Pitch 1] [PAY](x) The Danimals 9 : 4 [PAY](y) OOO FC [#collapseExample_21](#c)

### Tuesday, July 28, 2026

- 7:00 PM [Pitch 1] [PAY](x) Cereal Choppers FC 0 : 0 [PAY](y) The Danimals
- 8:20 PM [Pitch 1] [PAY](x) TBC FC 0 : 0 [PAY](y) That's All Vokes

### Tuesday, August 4, 2026

- 7:40 PM [Pitch 1] [PAY](x) The Danimals 0 : 0 [PAY](y) That's All Vokes
`;

// ---- shape 2: browser copy/paste, one token per line ---------------------
const pasted = `
Tuesday, July 28, 2026
8:20 PM
Pitch 1
PAY
TBC FC
0 : 0
PAY
That's All Vokes
POM:
Cards:
Tuesday, August 11, 2026
7:40 PM
Pitch 1
PAY
That's All Vokes
0 : 0
PAY
Super Soccer Striker Penguins
`;

// ---- shape 3: raw HTML ---------------------------------------------------
const html = `
<h3>Tuesday, August 4, 2026</h3>
<ul><li><span>7:40 PM</span> <span>[Pitch 1]</span>
<a href="/pay">PAY</a> <b>The Danimals</b> 0 : 0 <a href="/pay">PAY</a> <b>That&rsquo;s All Vokes</b></li></ul>
`;

console.log('shape 1 — rendered/markdown');
const f1 = P.forTeam(P.parseFixtures(markdown), TEAM);
check('finds 3 Vokes fixtures', f1.length, 3);
check('21 Jul opponent', f1[0]?.opposition, 'Cereal Choppers FC');
check('21 Jul score', [f1[0]?.goalsFor, f1[0]?.goalsAgainst], [3, 2]);
check('21 Jul date', f1[0]?.date, '2026-07-21');
check('28 Jul away vs TBC', f1[1]?.opposition, 'TBC FC');
check('28 Jul score 0:0', [f1[1]?.goalsFor, f1[1]?.goalsAgainst], [0, 0]);
check('4 Aug vs Danimals', f1[2]?.opposition, 'The Danimals');

console.log('\nshape 2 — copy/pasted text');
const f2 = P.forTeam(P.parseFixtures(pasted), TEAM);
check('finds 2 Vokes fixtures', f2.length, 2);
check('opponent 1', f2[0]?.opposition, 'TBC FC');
check('date 1', f2[0]?.date, '2026-07-28');
check('opponent 2', f2[1]?.opposition, 'Super Soccer Striker Penguins');
check('date 2', f2[1]?.date, '2026-08-11');

console.log('\nshape 3 — raw HTML with curly apostrophe');
const f3 = P.forTeam(P.parseFixtures(html), TEAM);
check('finds 1 Vokes fixture', f3.length, 1);
check('opponent', f3[0]?.opposition, 'The Danimals');
check('date', f3[0]?.date, '2026-08-04');

console.log('\nfixture name formatting');
check('ukDate', P.ukDate('2026-08-04'), '04 Aug 2026');
check('ukDate single digit', P.ukDate('2022-08-02'), '02 Aug 2022');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll parser tests passed.');
process.exit(failures ? 1 : 0);

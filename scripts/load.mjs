#!/usr/bin/env node
/**
 * Vokes POC — stage 2: load seed.json into Supabase.
 *
 * Runs on YOUR machine (it needs network access to Supabase).
 * No dependencies — plain Node 18+ fetch.
 *
 *   export SUPABASE_URL="https://xxxxxxxx.supabase.co"
 *   export SUPABASE_SERVICE_KEY="eyJ..."      # service_role key, Settings → API
 *   node scripts/load.mjs
 *
 * The service key bypasses RLS so it can seed the tables. It is read from the
 * environment and never written to disk. Use a throwaway POC project and
 * rotate the key afterwards if you like.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, '..', 'seed.json');

const URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.\n');
  console.error('  export SUPABASE_URL="https://xxxxxxxx.supabase.co"');
  console.error('  export SUPABASE_SERVICE_KEY="eyJ..."');
  process.exit(1);
}

const CHUNK = 500;

async function insert(table, rows) {
  if (!rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const res = await fetch(`${URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${table} insert failed (${res.status})\n${body}`);
    }
    done += batch.length;
    process.stdout.write(`\r  ${table.padEnd(14)} ${done}/${rows.length}`);
  }
  process.stdout.write('\n');
  return done;
}

async function count(table) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  });
  if (!res.ok) return `ERROR ${res.status}`;
  return res.headers.get('content-range')?.split('/')[1] ?? '?';
}

const seed = JSON.parse(readFileSync(SEED, 'utf8'));

console.log(`Loading seed generated ${seed.generated}`);
console.log(`Target ${URL}\n`);

// Order matters — foreign keys.
await insert('seasons', seed.seasons);
await insert('oppositions', seed.oppositions);
await insert('players', seed.players);
await insert('matches', seed.matches);
await insert('performances', seed.performances);

console.log('\nVerifying row counts in Postgres:');
for (const t of ['seasons', 'oppositions', 'players', 'matches', 'performances']) {
  console.log(`  ${t.padEnd(14)} ${await count(t)}`);
}

const q = seed.quality;
console.log('\nData quality carried over from the Airtable export:');
console.log(`  duplicate performances skipped   ${q.duplicate_performances_skipped.length}`);
console.log(`  performances with no player       ${q.orphan_performances.length}`);
console.log(`  matches with no result/score      ${q.matches_missing_result.length}`);
console.log('\nDone. Point web/config.js at this project and open web/index.html.');

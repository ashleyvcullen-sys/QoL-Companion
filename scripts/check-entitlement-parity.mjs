// Does the client agree with the database about who is premium?
//
// This exists because of a bug where neither side was wrong on its own.
// hasPremiumAccess() and public.has_premium() were both defensible readings
// of "premium until expires_at" — they simply disagreed about one value.
// A row of tier='premium', expires_at='infinity' (the shape the migration
// header tells you to write for a manual grant) was premium in Postgres and
// not premium in JavaScript, because new Date('infinity') is an Invalid Date
// and every comparison against NaN is false. RLS served the rows; the client
// drew a locked door in front of them.
//
// A unit test over the JS could not have caught that. It would have asserted
// whatever the JS already did. The only test that catches a DISAGREEMENT has
// to ask both sides the same question, so this runs the real SQL against a
// real Postgres and compares it to the real JS.
//
// Real Postgres, specifically: @electric-sql/pglite is Postgres compiled to
// WASM, in-process, no server or Docker. That matters because the whole bug
// lived in a semantic difference between Postgres and JavaScript — a
// hand-written model of Postgres in JS would have encoded my misunderstanding
// and passed.
//
// The SQL is READ FROM THE MIGRATIONS rather than copied here. If someone
// edits has_premium() and not hasPremiumAccess(), this test is what notices.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { hasPremiumAccess, petLimitFromRow } from '../src/lib/entitlements.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = join(ROOT, 'supabase', 'migrations')

const SOURCES = [
  ['pet_limit_for', '20260830000000_subscription_pet_gating.sql'],
  ['has_premium', '20260830010000_premium_feature_gating.sql'],
]

// Pulls `create or replace function public.<name> ... $$;` out of a migration
// verbatim. Deliberately not a copy of the SQL: the point is to run what
// actually ships.
function extractFunction(name, file) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
  const start = sql.indexOf(`create or replace function public.${name}(`)
  if (start === -1) {
    throw new Error(`Could not find public.${name}() in ${file}. If it moved, update SOURCES.`)
  }
  const end = sql.indexOf('$$;', start)
  if (end === -1) throw new Error(`Unterminated body for public.${name}() in ${file}.`)
  return sql.slice(start, end + 3)
}

const USER = '11111111-1111-1111-1111-111111111111'

// The fixtures. Each is a row as it would exist in user_entitlements, plus
// what a human would say the answer obviously is.
//
// Note there is no "unparseable date" case: timestamptz will not store one,
// so it cannot be a parity case. The JS guards it anyway (an unreadable date
// is treated as no entitlement) and that is covered where it can be — in the
// JS, below.
const FIXTURES = [
  { name: 'manual grant, infinity', tier: 'premium', pet_limit: 5, expires_at: 'infinity' },
  { name: 'negative infinity', tier: 'premium', pet_limit: 5, expires_at: '-infinity' },
  { name: 'far future expiry', tier: 'premium', pet_limit: 5, expires_at: '2099-01-01T00:00:00Z' },
  { name: 'lapsed', tier: 'premium', pet_limit: 5, expires_at: '2020-01-01T00:00:00Z' },
  { name: 'null expiry', tier: 'premium', pet_limit: 5, expires_at: null },
  { name: 'free tier, infinity', tier: 'free', pet_limit: 5, expires_at: 'infinity' },
  { name: 'premium, limit below floor', tier: 'premium', pet_limit: 0, expires_at: 'infinity' },
  { name: 'expires one hour out', tier: 'premium', pet_limit: 5, expires_at: new Date(Date.now() + 3600e3).toISOString() },
  { name: 'expired one hour ago', tier: 'premium', pet_limit: 5, expires_at: new Date(Date.now() - 3600e3).toISOString() },
]

const db = await PGlite.create()

// The functions call auth.uid(). Stubbed rather than edited out, so the SQL
// under test is byte-for-byte what ships. The value is settable so the
// "someone else's row" case is reachable.
await db.exec(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('test.uid', true), '')::uuid;
  $fn$;

  create table public.user_entitlements (
    user_id    uuid primary key,
    tier       text        not null default 'free',
    pet_limit  int         not null default 1,
    expires_at timestamptz,
    updated_at timestamptz not null default now()
  );
`)

for (const [name, file] of SOURCES) await db.exec(extractFunction(name, file))
await db.exec(`select set_config('test.uid', '${USER}', false);`)

const rows = []
let failures = 0

for (const fx of FIXTURES) {
  await db.query('delete from public.user_entitlements')
  await db.query(
    'insert into public.user_entitlements (user_id, tier, pet_limit, expires_at) values ($1, $2, $3, $4)',
    [USER, fx.tier, fx.pet_limit, fx.expires_at],
  )

  // to_jsonb is how PostgREST renders the row on the wire, so this is the
  // exact shape the client receives — including 'infinity' arriving as the
  // string "infinity", which is the whole reason this test exists.
  const { rows: [wire] } = await db.query('select to_jsonb(e) as row from public.user_entitlements e')
  const clientRow = wire.row

  const { rows: [sql] } = await db.query(
    'select public.has_premium($1) as premium, public.pet_limit_for($1) as pet_limit',
    [USER],
  )

  const js = { premium: hasPremiumAccess(clientRow), pet_limit: petLimitFromRow(clientRow) }
  const agreePremium = sql.premium === js.premium
  const agreeLimit = sql.pet_limit === js.pet_limit
  if (!agreePremium || !agreeLimit) failures++

  rows.push({
    fixture: fx.name,
    wire_expires_at: JSON.stringify(clientRow.expires_at),
    db: `${sql.premium}/${sql.pet_limit}`,
    js: `${js.premium}/${js.pet_limit}`,
    agree: agreePremium && agreeLimit ? 'yes' : 'NO',
  })
}

// The absent-row case, which is not an insert: a free account has no row at
// all, and both sides have to default the same way.
await db.query('delete from public.user_entitlements')
{
  const { rows: [sql] } = await db.query(
    'select public.has_premium($1) as premium, public.pet_limit_for($1) as pet_limit',
    [USER],
  )
  const js = { premium: hasPremiumAccess(null), pet_limit: petLimitFromRow(null) }
  const agree = sql.premium === js.premium && sql.pet_limit === js.pet_limit
  if (!agree) failures++
  rows.push({
    fixture: 'no row at all',
    wire_expires_at: '—',
    db: `${sql.premium}/${sql.pet_limit}`,
    js: `${js.premium}/${js.pet_limit}`,
    agree: agree ? 'yes' : 'NO',
  })
}

await db.close()

console.table(rows)

// JS-only guards. Not parity cases — Postgres cannot hold these values — but
// worth asserting, because petLimitFromRow used to grant the full limit for
// any string Date could not read, which made a typo in expires_at an upgrade.
const unreadable = { tier: 'premium', pet_limit: 5, expires_at: 'not-a-date' }
if (hasPremiumAccess(unreadable) !== false || petLimitFromRow(unreadable) !== 1) {
  console.error('FAIL: an unreadable expires_at must fail closed, not grant premium.')
  failures++
}

if (failures > 0) {
  console.error(`\nEntitlement parity check FAILED: ${failures} disagreement(s).`)
  console.error('The client and the database do not agree about the same row. Whichever')
  console.error('one you believe, they must not ship differing — that is how a paying')
  console.error('subscriber gets served rows the UI locks, or vice versa.')
  process.exit(1)
}

console.log(`Entitlement parity check passed — ${rows.length} rows, client and database agree on every one.`)

// Refuses a build that asks the database to return a newly inserted `pets` row.
//
// `.insert({...}).select()` on `pets` CANNOT SUCCEED under the current RLS,
// and for a while nobody could create a pet through the app because of it.
//
// INSERT ... RETURNING applies the SELECT policy to the new row.
// pets_select_visible requires `id in (select visible_pet_ids(auth.uid()))`,
// and visible_pet_ids is declared `stable`, so it runs on the statement's own
// snapshot and cannot see the row that statement is inserting. The new pet is
// never in its own visible set: the RETURNING row fails the policy, and
// Postgres rolls the whole insert back with a 42501 that looks for all the
// world like a pet-limit rejection.
//
// The fix is to mint the id client-side and not ask for the row back. This
// check exists so that fix cannot be quietly undone — `.select()` after an
// insert is such an ordinary thing to write that it will be written again.
//
// STATIC on purpose. The live equivalent, scripts/check-onboarding-path.mjs,
// proves the whole path works but needs a privileged key and a network, so it
// cannot gate a build. This one is a text search and runs in prebuild.
//
// Scope is deliberately narrow. The per-pet tables (bcs_entries, medications,
// pet_media, pet_conditions, condition_entries, condition_events,
// medication_doses) were all tested against real RLS and are fine with
// RETURNING, because the row their policy checks — the pet — already exists.
// Only `pets` checks the row being inserted, so only `pets` is banned here.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const offences = []

for (const file of walk(SRC).filter((f) => /\.(js|jsx)$/.test(f))) {
  const source = readFileSync(file, 'utf8')
  // Find `.from('pets')` and look at what follows it in the same chain.
  const re = /\.from\(\s*['"`]pets['"`]\s*\)/g
  let match
  while ((match = re.exec(source)) !== null) {
    // The chain runs until the statement settles. A generous window is fine:
    // this is looking for a specific pair, not parsing JavaScript.
    const chain = source.slice(match.index, match.index + 900)
    const stop = chain.search(/\n\s*(const|let|return|if|await\s+supabase|\}\s*\n)/)
    const scoped = stop === -1 ? chain : chain.slice(0, stop)

    const writes = /\.(insert|upsert)\s*\(/.test(scoped)
    const returns = /\.select\s*\(/.test(scoped)
    if (writes && returns) {
      offences.push({
        file: relative(ROOT, file),
        line: source.slice(0, match.index).split('\n').length,
      })
    }
  }
}

if (offences.length > 0) {
  console.error('\nRefusing to build: a pets insert asks for the row back.\n')
  for (const o of offences) console.error(`  ${o.file}:${o.line}`)
  console.error(`
INSERT ... RETURNING on pets always fails under the current RLS — the SELECT
policy calls visible_pet_ids(), which is stable and cannot see the row being
inserted. The insert is rolled back and reports 42501, which reads as a
pet-limit rejection. No user can create a pet.

Mint the id client-side and drop the .select():

    const newPetId = crypto.randomUUID()
    await supabase.from('pets').insert({ id: newPetId, ... })

See scripts/check-onboarding-path.mjs for the live proof.
`)
  process.exit(1)
}

console.log('Insert-returning check passed — no pets insert asks for the row back.')

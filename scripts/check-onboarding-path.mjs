// Can a free user with no pets actually create their first pet?
//
// This exists because the answer was NO, through a full App Store review,
// and nothing caught it.
//
// The bug was not in the policy and not in the client — both were correct in
// isolation. Onboarding did `.insert({...}).select().single()`, and
// INSERT ... RETURNING applies the SELECT policy to the new row.
// pets_select_visible requires `id in (select visible_pet_ids(auth.uid()))`,
// and visible_pet_ids is `stable`, so it runs on the statement's own snapshot
// and cannot see the row that statement is inserting. The new pet was never
// in its own visible set, so the RETURNING row failed the policy and Postgres
// rolled the whole insert back with a 42501 that the app read as "you are at
// your limit" — which is why it surfaced as a pet-limit prompt on an account
// with no pets.
//
// WHY THIS TEST IS SHAPED THE WAY IT IS
//
// Nothing short of a real INSERT against real RLS could have caught it. A
// unit test over the client would have mocked supabase. A test using the
// service role would have passed, because the service role bypasses RLS
// entirely — which is exactly why seeding the demo account worked while no
// real user could onboard. So this creates a genuine auth user, signs in AS
// them, and drives the same statements the app does under their own JWT.
//
// It cleans up after itself, including on failure.
//
//   SUPABASE_SECRET_KEY=... node scripts/check-onboarding-path.mjs
//
// Not wired into prebuild: it needs a privileged key and network, and a build
// must not depend on either. Run it before a release, and after any change to
// the pets policies or to how Onboarding writes.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function fromDotEnv(key) {
  try {
    const line = readFileSync(join(ROOT, '.env'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${key}=`))
    return line ? line.slice(key.length + 1).trim() : null
  } catch {
    return null
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || fromDotEnv('VITE_SUPABASE_URL')
const ANON_KEY = process.env.SUPABASE_ANON_KEY || fromDotEnv('VITE_SUPABASE_ANON_KEY')
// SUPABASE_SERVICE_ROLE_KEY is the legacy name; both are accepted so this
// keeps working across the move to sb_secret_ keys.
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing Supabase URL or anon key (env, or VITE_* in .env).')
  process.exit(1)
}
if (!SECRET_KEY) {
  console.error('SUPABASE_SECRET_KEY is not set — needed to create and delete the throwaway user.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } })

const results = []
function check(name, passed, detail = '') {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

// A throwaway account, created and destroyed inside this run. Randomised so a
// crashed previous run cannot collide with this one.
const email = `onboarding-check-${randomUUID().slice(0, 8)}@qolcompanion.com.au`
const password = `Tmp-${randomUUID()}!A9`

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
})
if (createError) {
  console.error(`Could not create the throwaway user: ${createError.message}`)
  process.exit(1)
}
const uid = created.user.id

try {
  const user = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { error: signInError } = await user.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`)

  // Precondition: this really is the state onboarding runs in.
  const { data: before } = await user.from('pets').select('id')
  check('a brand new account starts with no pets', before.length === 0, `${before.length} pet(s)`)

  const { data: limit } = await user.rpc('pet_limit_for', { uid })
  check('free pet limit is 1', limit === 1, `pet_limit_for = ${limit}`)

  // THE TEST. Exactly what Onboarding.handleSubmit does: an id minted client
  // side, and no .select() — because asking for the row back is what broke.
  const petId = randomUUID()
  const { error: insertError } = await user.from('pets').insert({
    id: petId,
    user_id: uid,
    name: 'Regression',
    species: 'dog',
    weight_range_key: '21-50',
    age_label: '3 years',
    sex: 'unknown',
  })
  check('a free user with 0 pets can create their first pet',
    !insertError, insertError ? `${insertError.code} ${insertError.message}` : '')

  // The pet has to be readable afterwards, or onboarding completes into a
  // Home screen that bounces straight back to the form.
  const { data: after } = await user.from('pets').select('id, name')
  check('the new pet is visible to its owner',
    after.length === 1 && after[0].id === petId, `${after.length} row(s) back`)

  // The guard that sends an account with no pets to /onboarding keys on this.
  check('RequireOnboardedPet would now let them through', after.length > 0)

  // And the reason the old code was written that way: prove the failing shape
  // still fails, so this test keeps meaning something. If a future migration
  // makes RETURNING work, this flips and the comment above needs revisiting.
  const { error: returningError } = await user
    .from('pets')
    .insert({ id: randomUUID(), user_id: uid, name: 'WithReturning', species: 'dog', sex: 'unknown' })
    .select()
    .single()
  check('insert().select() on pets still fails as documented',
    Boolean(returningError), returningError ? returningError.code : 'it SUCCEEDED — re-read the comment at the top')

  // The limit must still bite. A fix that lets everyone onboard by loosening
  // the gate would pass every check above and be worse than the bug.
  const { error: secondError } = await user
    .from('pets')
    .insert({ id: randomUUID(), user_id: uid, name: 'Second', species: 'cat', sex: 'unknown' })
  check('a second pet is still refused on the free limit',
    secondError?.code === '42501', secondError ? secondError.code : 'it was ALLOWED')
} finally {
  await admin.from('pets').delete().eq('user_id', uid)
  await admin.from('user_entitlements').delete().eq('user_id', uid)
  await admin.auth.admin.deleteUser(uid)
  console.log('\ncleaned up the throwaway account')
}

const failed = results.filter((r) => !r.passed)
if (failed.length) {
  console.error(`\n${failed.length} check(s) FAILED. A new user cannot onboard.`)
  process.exit(1)
}
console.log(`\nAll ${results.length} checks passed — a free user with no pets can complete onboarding.`)

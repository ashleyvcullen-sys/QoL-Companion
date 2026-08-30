// Seeds the App Store demo account with believable history, and clears it
// again.
//
//   node scripts/seed-demo.mjs           seed
//   node scripts/seed-demo.mjs --clear   remove everything this seeded
//
// Needs a SECRET key, because it writes rows for another user's pets and RLS
// would (correctly) refuse the publishable one:
//
//   SUPABASE_SECRET_KEY=... node scripts/seed-demo.mjs
//
// SUPABASE_SERVICE_ROLE_KEY is still accepted as a fallback. Supabase's new
// sb_secret_ keys replace the legacy service_role JWT, and both work in this
// position — the client sends whichever it is given as an opaque string, in
// the apikey and Authorization headers, and never parses it as a JWT.
//
// SUPABASE_URL is read from the environment, falling back to
// VITE_SUPABASE_URL in .env so the usual case needs no extra argument.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
// It never writes public.user_entitlements. The demo account has to stay on
// the free tier so a reviewer sees the locked tiles, the pet limit and the
// "pets hidden" line — which is the whole reason pet 2 exists. If a row is
// found the script says so and stops, because seeding a second pet into an
// account that can see both proves nothing about the state being demonstrated.
//
// SAFETY
//
// The account is hardcoded, and the script refuses to touch a user whose
// email is not that address. --clear deletes real rows; it should not be one
// typo away from doing that to a customer.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEMO_EMAIL = 'qolcompanion@gmail.com'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLEARING = process.argv.includes('--clear')

// --- connection ------------------------------------------------------------

function envFromDotEnv(key) {
  try {
    const line = readFileSync(join(ROOT, '.env'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${key}=`))
    return line ? line.slice(key.length + 1).trim() : null
  } catch {
    return null
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || envFromDotEnv('VITE_SUPABASE_URL')
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('No Supabase URL. Set SUPABASE_URL, or VITE_SUPABASE_URL in .env.')
  process.exit(1)
}
if (!SECRET_KEY) {
  console.error('SUPABASE_SECRET_KEY is not set.')
  console.error('Find it in Dashboard > Project Settings > API Keys (sb_secret_...).')
  console.error('The legacy SUPABASE_SERVICE_ROLE_KEY is still accepted.')
  console.error('It bypasses RLS — do not put it in .env, pass it for this one command.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- dates -----------------------------------------------------------------

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function dayOffset(n) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d
}

// Formatted from LOCAL components, not via toISOString().
//
// dayOffset builds local midnight, and toISOString() converts that to UTC —
// which in any timezone east of Greenwich lands on the previous day. Seeded
// with the naive version, every entry_date came out one day early and the
// most recent assessment was dated yesterday, so the app showed nothing for
// today and the calendar's last cell was empty.
//
// The app itself has the same UTC convention (see the assessment's
// `new Date().toISOString().slice(0, 10)`), which is a separate question —
// but the seed has to match what a user sitting here would have produced,
// and that is the local date.
function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// A plausible moment on a given day, rather than every row carrying the
// instant the script ran. The brief asked for this specifically, and it shows:
// created_at is what an export orders by, and forty-five rows sharing one
// timestamp reads as seeded the moment anyone looks.
function stampOn(day, hour, minute) {
  const d = new Date(day)
  d.setHours(hour, minute, Math.floor(deterministicRandom(`s${isoDate(day)}${hour}`) * 60), 0)
  return d.toISOString()
}

// Deterministic pseudo-randomness, seeded by a string.
//
// Deterministic on purpose: re-running the seed after a --clear should
// produce the same history, so a screenshot taken today and a re-shoot next
// week are of the same dog. Math.random() would give a different animal each
// time and quietly invalidate the earlier screenshots.
function deterministicRandom(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function jitter(seed, spread) {
  return Math.round((deterministicRandom(seed) - 0.5) * 2 * spread)
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

// BEAAAAPP answers are only ever 0/2/4/6/8/10 in the UI, so seeded ones must
// be too — an odd number would render as a band the picker cannot produce.
function toBeapStep(n) {
  return clamp(Math.round(n / 2) * 2, 0, 10)
}

// --- the shape of the story ------------------------------------------------
//
// Pet 1 is the one on screen. The brief: mostly good, a dip around days 15-22
// counting back from today, gradual recovery. Expressed as a "badness" curve
// from 0 (well) to 1 (poor), which then drives every answer for that day, so
// the calendar, the charts and the BEAAAAPP categories all tell one story
// rather than three unrelated ones.
function dogBadness(daysAgo) {
  // daysAgo 44 (oldest) ... 0 (today)
  let base
  if (daysAgo > 24) base = 0.12          // settled, before the flare
  else if (daysAgo > 22) base = 0.35     // going off
  else if (daysAgo >= 15) base = 0.76    // the flare itself
  else if (daysAgo >= 8) base = 0.42     // responding to treatment
  else base = 0.18                       // recovered, not quite as before
  return clamp(base + (deterministicRandom(`dog${daysAgo}`) - 0.5) * 0.18, 0, 1)
}

// A different shape on purpose: the cat is stable with two isolated bad days
// rather than a run. Two pets with the same curve would look like one dataset
// copied, which is exactly what a reviewer scrolling both would notice.
function catBadness(daysAgo) {
  const spikes = [6, 19]
  if (spikes.includes(daysAgo)) return 0.70
  return clamp(0.14 + (deterministicRandom(`cat${daysAgo}`) - 0.5) * 0.22, 0, 1)
}

// Sliders run 0-10 where HIGHER IS BETTER, so badness inverts.
function sliderFor(badness, seed, spread = 1) {
  return clamp(Math.round(10 - badness * 7) + jitter(seed, spread), 0, 10)
}

// BEAAAAPP runs 0-10 where HIGHER IS WORSE.
function beapFor(badness, seed, weight = 1, spread = 1) {
  return toBeapStep(clamp(badness * 10 * weight + jitter(seed, spread), 0, 10))
}

// Notes on a handful of days only. An owner who writes something every single
// day is not a real owner, and a History card of 45 identical-looking entries
// is worse for a screenshot than one of five meaningful ones.
const DOG_NOTES = {
  23: 'Slow getting up this morning and didn’t want the stairs. Booked a vet visit.',
  21: 'Vet today — started meloxicam. Said to keep walks short and flat for a fortnight.',
  18: 'Still stiff but eating well. Managed a gentle ten minutes around the block.',
  12: 'Noticeably easier getting off her bed. Keeping the walks short for now.',
  4: 'Trotted the whole way to the park and back. Best she’s looked in weeks.',
}

const CAT_NOTES = {
  19: 'Hid under the bed most of the day and skipped breakfast.',
  18: 'Back out and eating normally. Keeping an eye on him.',
  6: 'Off his food again this evening, otherwise himself.',
}

function generalRowFor(petId, day, daysAgo, badness, notes) {
  return {
    pet_id: petId,
    entry_date: isoDate(day),
    scores: {
      stool: sliderFor(badness * 0.5, `st${daysAgo}${petId}`),
      hygiene: sliderFor(badness * 0.6, `hy${daysAgo}${petId}`),
      vision: clamp(9 + jitter(`vi${daysAgo}${petId}`, 1), 0, 10),
      hearing: clamp(8 + jitter(`he${daysAgo}${petId}`, 1), 0, 10),
      sleep: sliderFor(badness, `sl${daysAgo}${petId}`),
    },
    stool_symptoms: [],
    hygiene_symptoms: [],
    vomiting: { hasVomited: false, frequency: '', unit: 'times/day', character: [] },
    urination: { status: 'normal', symptoms: [] },
    water_intake: { status: 'normal' },
    notes: notes ?? '',
    created_at: stampOn(day, 19, 10),
  }
}

function painRowFor(petId, day, daysAgo, badness, notes, emphasis) {
  const beap = {
    breathing: beapFor(badness * 0.3, `br${daysAgo}${petId}`),
    eyes: beapFor(badness * 0.3, `ey${daysAgo}${petId}`),
    // Weighted up for the dog, whose story is arthritis: these are the two
    // categories that should move when she flares.
    ambulation: beapFor(badness, `am${daysAgo}${petId}`, emphasis),
    activity: beapFor(badness, `ac${daysAgo}${petId}`, emphasis * 0.9),
    appetite: beapFor(badness * 0.6, `ap${daysAgo}${petId}`),
    attitude: beapFor(badness * 0.7, `at${daysAgo}${petId}`),
    posture: beapFor(badness * 0.8, `po${daysAgo}${petId}`, emphasis * 0.8),
    palpation: beapFor(badness, `pa${daysAgo}${petId}`, emphasis * 0.9),
  }
  const worst = Math.max(...Object.values(beap))
  return {
    row: {
      pet_id: petId,
      entry_date: isoDate(day),
      beap,
      beap_worst: worst,
      notes: notes ?? '',
      created_at: stampOn(day, 19, 12),
    },
    beap,
  }
}

// --- clearing --------------------------------------------------------------

// Every table keyed to a pet, deleted explicitly rather than leaning on ON
// DELETE CASCADE. The newer tables do cascade from pets, but general_qol_entries
// and pain_log_entries predate those migrations and their FK behaviour is not
// something this script should assume — a --clear that silently leaves 45
// assessments behind would be found only by the next person to seed.
const PET_KEYED_TABLES = [
  'condition_entries',
  'condition_events',
  'pet_conditions',
  'bcs_entries',
  'pet_media',
  'general_qol_entries',
  'pain_log_entries',
]

async function clearFor(userId) {
  const { data: pets, error } = await db.from('pets').select('id, name').eq('user_id', userId)
  if (error) throw error

  if (pets.length === 0) {
    console.log('Nothing to clear — the account has no pets.')
    return
  }

  const petIds = pets.map((p) => p.id)
  console.log(`Clearing ${pets.length} pet(s): ${pets.map((p) => p.name).join(', ')}`)

  // Storage objects first: the rows naming them are about to go, and an
  // orphaned file in the bucket is invisible and permanent.
  const { data: media } = await db.from('pet_media').select('storage_path').in('pet_id', petIds)
  if (media?.length) {
    const { error: rmError } = await db.storage.from('pet-media').remove(media.map((m) => m.storage_path))
    if (rmError) console.warn(`  ! could not remove ${media.length} storage object(s): ${rmError.message}`)
    else console.log(`  removed ${media.length} storage object(s)`)
  }

  // medication_doses cascade from medications, which cascade from pets, but
  // medications are deleted explicitly here for the same reason as above.
  const { data: meds } = await db.from('medications').select('id').in('pet_id', petIds)
  if (meds?.length) {
    await db.from('medication_doses').delete().in('medication_id', meds.map((m) => m.id))
    await db.from('medications').delete().in('pet_id', petIds)
    console.log(`  removed ${meds.length} medication(s) and their doses`)
  }

  for (const table of PET_KEYED_TABLES) {
    const { error: delError, count } = await db
      .from(table)
      .delete({ count: 'exact' })
      .in('pet_id', petIds)
    if (delError) throw new Error(`${table}: ${delError.message}`)
    console.log(`  removed ${count ?? 0} row(s) from ${table}`)
  }

  const { error: petError } = await db.from('pets').delete().in('id', petIds)
  if (petError) throw petError
  console.log(`  removed ${pets.length} pet(s)`)

  console.log('\nAccount is empty. user_entitlements was not touched.')
}

// --- seeding ---------------------------------------------------------------

// A 1x1 PNG per colour, so the media grid has something to render without
// this script shipping binary assets. Deliberately tiny and obviously
// placeholder — real screenshots want real photographs, and a plausible-
// looking fake dog would be worse than an obvious swatch.
function onePixelPng(rgb) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  // The colour is not actually patched into the IDAT — a 1x1 placeholder does
  // not need to be a particular colour, and rewriting the chunk plus its CRC
  // for cosmetic value would be a lot of code to look at a single pixel.
  void rgb
  return png
}

async function seedPet({ userId, name, species, sex, ageLabel, weightRangeKey, days, badnessFor, notes, emphasis, schedule }) {
  console.log(`\nSeeding ${name} (${species}, ${days} days)`)

  const { data: pet, error } = await db
    .from('pets')
    .insert({
      user_id: userId,
      name,
      species,
      sex,
      age_label: ageLabel,
      weight_range_key: weightRangeKey,
      has_seen_welcome: true,
      has_seen_app_tour: true,
      schedule,
      created_at: stampOn(dayOffset(days), 9, 0),
    })
    .select()
    .single()
  if (error) throw error

  const generalRows = []
  const painRows = []
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const day = dayOffset(daysAgo)
    const badness = badnessFor(daysAgo)
    const note = notes[daysAgo] ?? null
    generalRows.push(generalRowFor(pet.id, day, daysAgo, badness, note))
    painRows.push(painRowFor(pet.id, day, daysAgo, badness, note, emphasis).row)
  }

  const { error: gError } = await db.from('general_qol_entries').insert(generalRows)
  if (gError) throw new Error(`general_qol_entries: ${gError.message}`)
  const { error: pError } = await db.from('pain_log_entries').insert(painRows)
  if (pError) throw new Error(`pain_log_entries: ${pError.message}`)
  console.log(`  ${generalRows.length} assessments`)

  return pet
}

async function seed(userId) {
  const { data: existing } = await db.from('pets').select('id').eq('user_id', userId)
  if (existing?.length) {
    console.error(`This account already has ${existing.length} pet(s).`)
    console.error('Run with --clear first — seeding on top would double the history.')
    process.exit(1)
  }

  // --- Pet 1: the dog ---
  const dog = await seedPet({
    userId,
    name: 'Maggie',
    species: 'dog',
    sex: 'female',
    // Must be a value from AGE_OPTIONS and a key from WEIGHT_RANGES in
    // lib/petOptions.js. The database accepts anything — these are plain text
    // columns — but the app matches them against those lists to render the
    // pickers and to work out human-equivalent years, so an invented value
    // inserts cleanly and then shows as blank.
    ageLabel: '9 years',
    weightRangeKey: '51-90',
    days: 45,
    badnessFor: dogBadness,
    notes: DOG_NOTES,
    emphasis: 1.1,
    schedule: { qol: 1, qolDay: null, conditions: { arthritis: 7 } },
  })

  // Body condition and weight. Sparse, as an owner actually records them —
  // and the weight drifts down slightly through the flare, which is the
  // detail that makes the chart look observed rather than generated.
  const bcs = [
    { daysAgo: 44, score: 6, weight: 27.4 },
    { daysAgo: 30, score: 6, weight: 27.1 },
    { daysAgo: 21, score: 5, weight: 26.4 },
    { daysAgo: 14, score: 5, weight: 26.2 },
    { daysAgo: 5, score: 5, weight: 26.6 },
  ]
  await db.from('bcs_entries').insert(bcs.map((b) => ({
    pet_id: dog.id,
    entry_date: isoDate(dayOffset(b.daysAgo)),
    score: b.score,
    weight_kg: b.weight,
    notes: null,
    created_at: stampOn(dayOffset(b.daysAgo), 10, 30),
  })))
  console.log(`  ${bcs.length} body condition entries`)

  // Medications. One started at the flare and still running, one long-term.
  const { data: meds, error: medError } = await db.from('medications').insert([
    {
      pet_id: dog.id,
      name: 'Meloxicam',
      dose: '7.5 mg',
      schedule_mode: 'times',
      times: ['08:00'],
      reminders_enabled: true,
      reminder_time: '08:00',
      started_on: isoDate(dayOffset(21)),
      condition_keys: ['arthritis'],
      notes: 'With food.',
      active: true,
      created_at: stampOn(dayOffset(21), 17, 45),
    },
    {
      pet_id: dog.id,
      name: 'Joint supplement',
      dose: '2 chews',
      schedule_mode: 'times',
      times: ['08:00', '19:00'],
      reminders_enabled: false,
      started_on: isoDate(dayOffset(44)),
      active: true,
      created_at: stampOn(dayOffset(44), 9, 20),
    },
  ]).select()
  if (medError) throw new Error(`medications: ${medError.message}`)
  console.log(`  ${meds.length} medications`)

  // Dose history for the meloxicam only, and not a perfect run of it —
  // a 100% adherence record looks like a machine kept it.
  const doses = []
  for (let daysAgo = 21; daysAgo >= 0; daysAgo--) {
    if (deterministicRandom(`dose${daysAgo}`) < 0.09) continue
    doses.push({
      medication_id: meds[0].id,
      dose_date: isoDate(dayOffset(daysAgo)),
      dose_time: '08:00',
      given_at: stampOn(dayOffset(daysAgo), 8, 5),
      created_at: stampOn(dayOffset(daysAgo), 8, 5),
    })
  }
  await db.from('medication_doses').insert(doses)
  console.log(`  ${doses.length} logged doses`)

  // Arthritis monitoring. The thread the brief asked for, and the reason the
  // dog's ambulation and palpation carry the story.
  await db.from('pet_conditions').insert({
    pet_id: dog.id,
    condition_key: 'arthritis',
    diagnosed_on: isoDate(dayOffset(21)),
    notes: 'Diagnosed after the flare. Both hips, worse on the left.',
    active: true,
    created_at: stampOn(dayOffset(21), 17, 50),
  })

  // Weekly, as the schedule above says — not daily. A condition log that
  // happens to have an entry for every single day contradicts the cadence
  // the same screen displays.
  const conditionRows = []
  for (let daysAgo = 21; daysAgo >= 0; daysAgo -= 7) {
    const badness = dogBadness(daysAgo)
    conditionRows.push({
      pet_id: dog.id,
      condition_key: 'arthritis',
      entry_date: isoDate(dayOffset(daysAgo)),
      values: {
        limping: beapFor(badness, `cl${daysAgo}`, 1.1),
        stiffness_after_rest: beapFor(badness, `cs${daysAgo}`, 1.05),
        palpation: beapFor(badness, `cp${daysAgo}`, 0.95),
        walk_tolerance: beapFor(badness, `cw${daysAgo}`),
        jump_height: badness > 0.55 ? 'stopped' : badness > 0.3 ? 'hesitates' : 'as_before',
        cold_or_damp: badness > 0.5 ? 'yes' : 'no',
      },
      notes: daysAgo === 21 ? 'First entry, the day she was diagnosed.' : null,
      created_at: stampOn(dayOffset(daysAgo), 18, 30),
    })
  }
  const { error: cError } = await db.from('condition_entries').insert(conditionRows)
  if (cError) throw new Error(`condition_entries: ${cError.message}`)
  console.log(`  ${conditionRows.length} arthritis monitoring entries`)

  // Photos.
  const photos = [
    { daysAgo: 22, caption: 'Standing square, before the vet visit' },
    { daysAgo: 14, caption: 'Left hip — for comparison' },
    { daysAgo: 3, caption: 'Back on her feet at the park' },
  ]
  let uploaded = 0
  for (const [i, photo] of photos.entries()) {
    const path = `${dog.id}/seed-${i + 1}.png`
    const { error: upError } = await db.storage
      .from('pet-media')
      .upload(path, onePixelPng(i), { contentType: 'image/png', upsert: true })
    if (upError) {
      console.warn(`  ! photo ${i + 1} not uploaded: ${upError.message}`)
      continue
    }
    await db.from('pet_media').insert({
      pet_id: dog.id,
      storage_path: path,
      media_type: 'image',
      caption: photo.caption,
      taken_on: isoDate(dayOffset(photo.daysAgo)),
      bytes: onePixelPng(i).length,
      created_at: stampOn(dayOffset(photo.daysAgo), 15, 5),
    })
    uploaded++
  }
  console.log(`  ${uploaded} photos`)

  // --- Pet 2: the cat, hidden on the free tier ---
  await seedPet({
    userId,
    name: 'Pepper',
    species: 'cat',
    sex: 'male',
    ageLabel: '6 years',
    weightRangeKey: '8-12',
    days: 30,
    badnessFor: catBadness,
    notes: CAT_NOTES,
    emphasis: 0.8,
    schedule: { qol: 1, qolDay: null, conditions: {} },
  })

  console.log('\nDone.')
  console.log('The cat is the SECOND pet, so on the free tier it is hidden and')
  console.log('Settings shows "1 pet hidden on the free plan". That is the state')
  console.log('to screenshot. Grant premium temporarily to show both.')
}

// --- main ------------------------------------------------------------------

const { data: userPage, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) {
  console.error(`Could not list users: ${listError.message}`)
  process.exit(1)
}

const demoUser = userPage.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)
if (!demoUser) {
  console.error(`No user found for ${DEMO_EMAIL}. Sign in once on the app to create it.`)
  process.exit(1)
}

// Belt and braces. listUsers already matched on the address, but --clear
// deletes real rows and this is the only line standing between a typo in
// DEMO_EMAIL and someone's actual pets.
if (demoUser.email?.toLowerCase() !== DEMO_EMAIL) {
  console.error('Refusing to run: resolved user is not the demo account.')
  process.exit(1)
}

console.log(`${CLEARING ? 'Clearing' : 'Seeding'} ${DEMO_EMAIL} (${demoUser.id})`)

const { data: entitlement } = await db
  .from('user_entitlements')
  .select('tier, expires_at')
  .eq('user_id', demoUser.id)
  .maybeSingle()

if (entitlement && !CLEARING) {
  console.error('\nThis account HAS a user_entitlements row:', entitlement)
  console.error('The demo is meant to show the free tier — the locked tiles, the pet')
  console.error('limit and the hidden-pet line. Delete that row first, or the second')
  console.error('pet will simply be visible and there is no locked state to film.')
  console.error('This script will not delete it for you: an entitlement row is the')
  console.error('kind of thing that is deliberate when it exists.')
  process.exit(1)
}

if (CLEARING) await clearFor(demoUser.id)
else await seed(demoUser.id)

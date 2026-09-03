import { supabase } from './supabase'
import {
  computeBeapWorst,
  computeGeneralQolResult,
  computeIndividualMeasures,
  computeOverviewCategories,
} from './scoring'

function mapGeneralQolRow(row) {
  return {
    id: row.id,
    date: row.entry_date,
    scores: row.scores ?? {},
    // Defaulted here, at the boundary, rather than guarded at each of the
    // dozen places that read them.
    //
    // scoreStoolOrHygiene does `symptoms.length` with no guard, so a row
    // whose symptom column is null — an early row, or one written before
    // that column existed — throws on the spot. That was survivable while
    // scoring only ran on screens an owner chose to open; it is not
    // survivable now the home screen computes a score on launch, where the
    // same null is a white screen instead of one broken chart.
    stoolSymptoms: row.stool_symptoms ?? [],
    hygieneSymptoms: row.hygiene_symptoms ?? [],
    vomiting: row.vomiting ?? { hasVomited: null, frequency: '', unit: 'times/day', character: [] },
    urination: row.urination ?? { status: null, symptoms: [] },
    waterIntake: row.water_intake ?? { status: null },
    notes: row.notes,
  }
}

function mapPainLogRow(row) {
  return {
    id: row.id,
    date: row.entry_date,
    beap: row.beap,
    beapWorst: row.beap_worst,
    notes: row.notes,
  }
}

export async function fetchLatestGeneralQolEntry(petId) {
  const { data, error } = await supabase
    .from('general_qol_entries')
    .select('*')
    .eq('pet_id', petId)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? mapGeneralQolRow(data) : null
}

export async function fetchLatestPainLogEntry(petId) {
  const { data, error } = await supabase
    .from('pain_log_entries')
    .select('*')
    .eq('pet_id', petId)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? mapPainLogRow(data) : null
}

// Write a single BEAAAAPP category into an existing assessment for a date.
//
// Arthritis asks Ambulation and Palpation, and those are not similar to the
// daily assessment's categories — they ARE them. Storing the answer twice
// leaves two records of one measurement, free to disagree, with nothing to
// say which the vet should believe. So the condition form writes its answer
// back to the assessment it came from.
//
// It only ever UPDATES a row that already exists, and returns null when there
// is none. Creating one would put a day into the pain history the owner never
// assessed — a single category standing in for eight — and the comfort pillar
// is calculated from the worst answered category, so one bad ambulation score
// on an otherwise unassessed day would read as a thoroughly miserable day.
//
// beap_worst is recomputed rather than patched, because it is a derived value
// and the whole point of this function is that derived values stay true.
export async function updateBeapCategory({ petId, date, category, value }) {
  const { data, error } = await supabase
    .from('pain_log_entries')
    .select('*')
    .eq('pet_id', petId)
    .eq('entry_date', date)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const beap = { ...(data.beap ?? {}), [category]: value }
  const beapWorst = computeBeapWorst(beap)

  const { error: updateError } = await supabase
    .from('pain_log_entries')
    .update({ beap, beap_worst: beapWorst })
    .eq('id', data.id)

  if (updateError) throw updateError
  return mapPainLogRow({ ...data, beap, beap_worst: beapWorst })
}

// Write one everyday-function score into an existing assessment for a date.
//
// The counterpart to updateBeapCategory above, for the questions that live in
// `scores` rather than in `beap` — sleep being the first, because cognitive
// decline asks exactly the same question.
//
// Same rule: it only ever UPDATES a row that already exists. A general entry
// conjured from a single sleep answer would put a day into the history that
// the owner never assessed, and the overall percentage would be computed from
// one question.
export async function updateGeneralScore({ petId, date, key, value }) {
  const { data, error } = await supabase
    .from('general_qol_entries')
    .select('*')
    .eq('pet_id', petId)
    .eq('entry_date', date)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const scores = { ...(data.scores ?? {}), [key]: value }
  const { error: updateError } = await supabase
    .from('general_qol_entries')
    .update({ scores })
    .eq('id', data.id)

  if (updateError) throw updateError
  return mapGeneralQolRow({ ...data, scores })
}

// A whole column on the assessment row, rather than a key inside `scores`.
//
// Vomiting, urination and water intake are stored as their own jsonb columns
// because each is a small object rather than a number. A condition form that
// asks one of those questions has to write back to the column, not into
// scores — otherwise the answer lands somewhere the assessment never reads.
//
// UPDATE-only, like updateGeneralScore. Creating a row here would put a day
// into the history the owner never assessed, with one field filled and the
// rest of the assessment blank.
const GENERAL_FIELD_COLUMNS = {
  vomiting: 'vomiting',
  urination: 'urination',
  waterIntake: 'water_intake',
}

export async function updateGeneralField({ petId, date, field, value }) {
  const column = GENERAL_FIELD_COLUMNS[field]
  if (!column) return null

  const { data, error } = await supabase
    .from('general_qol_entries')
    .select('*')
    .eq('pet_id', petId)
    .eq('entry_date', date)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const { error: updateError } = await supabase
    .from('general_qol_entries')
    .update({ [column]: value })
    .eq('id', data.id)

  if (updateError) throw updateError
  return mapGeneralQolRow({ ...data, [column]: value })
}

// Clears the note written on one day's assessment, leaving every score and
// answer exactly as it is.
//
// Both rows, because the assessment writes the same text to both when it
// saves — the everyday-function row and the pain row each carry a copy, and
// clearing one would leave the other to reappear in the report and on the
// calendar as though nothing had happened.
//
// An update, never a delete: the owner asked to remove what they wrote, not
// to throw away the day's assessment. On a trend line those are very
// different — one takes a pencil mark off a day, the other takes the day out
// of the record.
export async function clearAssessmentNote({ petId, date }) {
  // An EMPTY STRING, not null.
  //
  // general_qol_entries.notes is `not null`, so writing null is rejected
  // outright — "null value in column \"notes\" ... violates not-null
  // constraint", which is what this did when it shipped. An empty string
  // clears it within the column's own rules and needs no migration, and every
  // reader in the app already treats a blank note as no note: the history
  // list, the export and the calendar's pencil mark all test `.trim()`.
  //
  // .select() on each update, deliberately.
  //
  // Without it, an update that matches NO ROWS — a row-level security policy
  // that permits reading but not writing, a date that does not line up —
  // comes back with no error at all, and the caller cheerfully reports
  // success while the note is still there. Asking for the updated rows back
  // is the only way to tell "done" from "silently did nothing".
  let updated = 0

  for (const table of ['general_qol_entries', 'pain_log_entries']) {
    const { data, error } = await supabase
      .from(table)
      .update({ notes: '' })
      .eq('pet_id', petId)
      .eq('entry_date', date)
      .select('id')

    if (error) throw error
    updated += (data ?? []).length
  }

  // Both tables can legitimately be empty of this date — a pain row without a
  // general row, say — but NEITHER having a row means nothing was cleared,
  // and the owner needs to be told that rather than watching the note come
  // back on the next refresh.
  if (updated === 0) {
    throw new Error('That note could not be found to delete. Please try again.')
  }

  return updated
}

export async function fetchGeneralQolEntries(petId) {
  const { data, error } = await supabase
    .from('general_qol_entries')
    .select('*')
    .eq('pet_id', petId)
    .order('entry_date', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapGeneralQolRow)
}

export async function fetchPainLogEntries(petId) {
  const { data, error } = await supabase
    .from('pain_log_entries')
    .select('*')
    .eq('pet_id', petId)
    .order('entry_date', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapPainLogRow)
}

// Kept separate from buildDailySeries rather than folded into it: the daily
// series already spreads the overview pillars in, and two of those (appetite,
// sleep) share a name with an individual measure while meaning something
// different. Two arrays, no collision, and nothing about the existing charts
// changes.
export function buildMeasureSeries(generalEntries, painEntries) {
  const generalByDate = new Map(generalEntries.map((entry) => [entry.date, entry]))
  const painByDate = new Map(painEntries.map((entry) => [entry.date, entry]))
  const allDates = Array.from(new Set([...generalByDate.keys(), ...painByDate.keys()])).sort()

  return allDates.map((date) => ({
    date,
    ...computeIndividualMeasures(generalByDate.get(date) ?? null, painByDate.get(date)?.beap),
  }))
}

export function buildDailySeries(generalEntries, painEntries) {
  const generalByDate = new Map(generalEntries.map((entry) => [entry.date, entry]))
  const painByDate = new Map(painEntries.map((entry) => [entry.date, entry]))
  const allDates = Array.from(new Set([...generalByDate.keys(), ...painByDate.keys()])).sort()

  return allDates.map((date) => {
    const generalEntry = generalByDate.get(date) ?? null
    const painEntry = painByDate.get(date) ?? null
    // Same-date pain entry feeds the BEAAAAPP half of the overall score.
    const generalResult = generalEntry ? computeGeneralQolResult(generalEntry, painEntry?.beap) : null
    const categories = computeOverviewCategories(generalEntry, painEntry)

    return {
      date,
      generalTotal: generalResult ? generalResult.total : null,
      generalPercent: generalResult ? generalResult.percent : null,
      ...categories,
    }
  })
}

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
    scores: row.scores,
    stoolSymptoms: row.stool_symptoms,
    hygieneSymptoms: row.hygiene_symptoms,
    vomiting: row.vomiting,
    urination: row.urination,
    waterIntake: row.water_intake,
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

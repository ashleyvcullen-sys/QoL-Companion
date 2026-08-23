import { supabase } from './supabase'
import { computeGeneralQolResult, computeOverviewCategories } from './scoring'

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

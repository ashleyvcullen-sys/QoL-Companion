import { useMemo } from 'react'
import { supabase } from './supabase'
import { invalidateQuery, useCachedQuery } from './queryCache'

// Read back by three screens at once — the home card's cap reason, the weight
// chart in Trends, and the Body Condition screen itself — so it is served
// from the session cache rather than re-queried on every arrival. Same reason
// as the assessment history: see lib/queryCache.js.
const BCS_EMPTY = []

function bcsKey(petId) {
  return petId ? `bcs-entries:${petId}` : null
}

function mapBcsRow(row) {
  return {
    id: row.id,
    date: row.entry_date,
    score: row.score,
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    notes: row.notes,
  }
}

export async function fetchBcsEntries(petId) {
  const { data, error } = await supabase
    .from('bcs_entries')
    .select('*')
    .eq('pet_id', petId)
    .order('entry_date', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapBcsRow)
}

// One entry per pet per day, same convention as general_qol_entries — a
// second save on the same date replaces the first rather than stacking.
// weightKg is optional and independent of the score — an owner with no scales
// still gets a usable BCS entry. Passing undefined leaves the stored value
// alone is NOT how upsert works, so callers must pass the existing weight
// through explicitly when they aren't changing it.
function localIsoDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 10)
}

export async function saveBcsEntry({ petId, score, weightKg, notes, entryDate }) {
  // Cleared here rather than in whichever screen happened to save, following
  // the same convention as qolData and conditionsData.
  if (petId) invalidateQuery(bcsKey(petId))
  const { error } = await supabase
    .from('bcs_entries')
    .upsert(
      {
        pet_id: petId,
        // Local date, like every other screen — was UTC until 21 Sep 2026.
        entry_date: entryDate ?? localIsoDate(),
        score,
        weight_kg: weightKg ?? null,
        notes: notes || null,
      },
      { onConflict: 'pet_id,entry_date' },
    )

  if (error) throw error
}

export function useBcsHistory(petId) {
  const { data, loading, refresh } = useCachedQuery(
    bcsKey(petId),
    () => fetchBcsEntries(petId),
    { empty: BCS_EMPTY },
  )

  return useMemo(
    () => ({ entries: data ?? BCS_EMPTY, loading, refresh }),
    [data, loading, refresh],
  )
}

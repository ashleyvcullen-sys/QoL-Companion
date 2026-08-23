import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function mapBcsRow(row) {
  return {
    id: row.id,
    date: row.entry_date,
    score: row.score,
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
export async function saveBcsEntry({ petId, score, notes, entryDate }) {
  const { error } = await supabase
    .from('bcs_entries')
    .upsert(
      {
        pet_id: petId,
        entry_date: entryDate ?? new Date().toISOString().slice(0, 10),
        score,
        notes: notes || null,
      },
      { onConflict: 'pet_id,entry_date' },
    )

  if (error) throw error
}

export function useBcsHistory(petId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!petId) {
      setEntries([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchBcsEntries(petId)
      .then((result) => {
        if (!cancelled) setEntries(result)
      })
      .catch((error) => {
        console.error('Failed to load BCS history:', error.message)
        if (!cancelled) setEntries([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId, reloadToken])

  return { entries, loading, refresh: () => setReloadToken((n) => n + 1) }
}

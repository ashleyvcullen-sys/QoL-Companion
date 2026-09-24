import { useMemo } from 'react'
import { fetchGeneralQolEntries, fetchPainLogEntries } from './qolData'
import { useCachedQuery } from './queryCache'

const EMPTY = { general: [], pain: [] }

// The assessment history for one pet.
//
// Served from the session cache — see lib/queryCache.js. Both halves are
// fetched together and cached under one key, because every caller uses them
// together and a screen holding yesterday's pain log against today's
// assessment would score the day wrong.
export function useQolHistory(petId) {
  const { data, loading, refresh } = useCachedQuery(
    petId ? `qol-history:${petId}` : null,
    () => Promise.all([fetchGeneralQolEntries(petId), fetchPainLogEntries(petId)])
      .then(([general, pain]) => ({ general, pain })),
    { empty: EMPTY },
  )

  return useMemo(() => ({
    generalEntries: data?.general ?? [],
    painEntries: data?.pain ?? [],
    loading,
    refresh,
  }), [data, loading, refresh])
}

import { useEffect, useState } from 'react'
import { fetchLatestGeneralQolEntry, fetchLatestPainLogEntry } from './qolData'

// Fetches the latest general entry plus the matching pain entry, since the
// overall QoL score now averages the everyday-function questions and the
// BEAAAAPP categories together. `beap` is only returned when the latest
// pain entry is from the same date as the latest general entry — pairing
// two different days into one score would be wrong, and an unpaired day
// just scores on the 8 function questions it does have.
export function useLatestGeneralQol(petId) {
  const [entry, setEntry] = useState(null)
  const [beap, setBeap] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!petId) {
      setEntry(null)
      setBeap(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all([fetchLatestGeneralQolEntry(petId), fetchLatestPainLogEntry(petId)])
      .then(([generalResult, painResult]) => {
        if (cancelled) return
        setEntry(generalResult)
        setBeap(
          generalResult && painResult && painResult.date === generalResult.date
            ? painResult.beap
            : null,
        )
      })
      .catch((error) => {
        console.error('Failed to load latest QoL entry:', error.message)
        if (!cancelled) {
          setEntry(null)
          setBeap(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId])

  return { entry, beap, loading }
}

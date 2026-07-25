import { useEffect, useState } from 'react'
import { fetchLatestGeneralQolEntry } from './qolData'

export function useLatestGeneralQol(petId) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!petId) {
      setEntry(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchLatestGeneralQolEntry(petId)
      .then((result) => {
        if (!cancelled) setEntry(result)
      })
      .catch((error) => {
        console.error('Failed to load latest QoL entry:', error.message)
        if (!cancelled) setEntry(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId])

  return { entry, loading }
}

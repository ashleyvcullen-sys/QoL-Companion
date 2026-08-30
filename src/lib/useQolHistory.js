import { useCallback, useEffect, useState } from 'react'
import { fetchGeneralQolEntries, fetchPainLogEntries } from './qolData'

export function useQolHistory(petId) {
  const [generalEntries, setGeneralEntries] = useState([])
  const [painEntries, setPainEntries] = useState([])
  const [loading, setLoading] = useState(true)
  // So a screen that changes one of these rows — clearing a note, say — can
  // pull the history again rather than showing what it looked like before.
  const [reloadToken, setReloadToken] = useState(0)
  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!petId) {
      setGeneralEntries([])
      setPainEntries([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all([fetchGeneralQolEntries(petId), fetchPainLogEntries(petId)])
      .then(([general, pain]) => {
        if (cancelled) return
        setGeneralEntries(general)
        setPainEntries(pain)
      })
      .catch((error) => {
        console.error('Failed to load QoL history:', error.message)
        if (!cancelled) {
          setGeneralEntries([])
          setPainEntries([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId, reloadToken])

  return { generalEntries, painEntries, loading, refresh }
}

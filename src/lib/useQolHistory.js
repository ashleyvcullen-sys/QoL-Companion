import { useEffect, useState } from 'react'
import { fetchGeneralQolEntries, fetchPainLogEntries } from './qolData'

export function useQolHistory(petId) {
  const [generalEntries, setGeneralEntries] = useState([])
  const [painEntries, setPainEntries] = useState([])
  const [loading, setLoading] = useState(true)

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
  }, [petId])

  return { generalEntries, painEntries, loading }
}

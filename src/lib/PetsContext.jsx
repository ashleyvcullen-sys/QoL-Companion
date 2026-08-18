import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { logStartupIssue } from './diagnostics'

const PetsContext = createContext(undefined)

export function PetsProvider({ children }) {
  const { user } = useAuth()
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)
  const [petsError, setPetsError] = useState(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setPets([])
      setLoading(false)
      setPetsError(null)
      return
    }

    setLoading(true)
    setPetsError(null)

    try {
      // Wrapped in try/catch (not just checking the `error` field below) —
      // a genuine network-level failure can reject this promise outright
      // rather than resolving with { data: null, error }. Without the
      // try/catch, that rejection was unhandled and `setLoading(false)`
      // below never ran, leaving `loading: true` forever with no way to
      // recover.
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPets(data ?? [])
    } catch (err) {
      logStartupIssue('pets-fetch-failed', err)
      console.error('Failed to load pets:', err.message)
      setPets([])
      setPetsError(err.message || 'Failed to load your pet data.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <PetsContext.Provider value={{ pets, loading, petsError, refresh }}>
      {children}
    </PetsContext.Provider>
  )
}

export function usePets() {
  const ctx = useContext(PetsContext)
  if (!ctx) throw new Error('usePets must be used within PetsProvider')
  return ctx
}

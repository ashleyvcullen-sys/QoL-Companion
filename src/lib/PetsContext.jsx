import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

const PetsContext = createContext(undefined)

export function PetsProvider({ children }) {
  const { user } = useAuth()
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setPets([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to load pets:', error.message)
      setPets([])
    } else {
      setPets(data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <PetsContext.Provider value={{ pets, loading, refresh }}>
      {children}
    </PetsContext.Provider>
  )
}

export function usePets() {
  const ctx = useContext(PetsContext)
  if (!ctx) throw new Error('usePets must be used within PetsProvider')
  return ctx
}

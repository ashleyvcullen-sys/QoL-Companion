import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { logStartupIssue } from './diagnostics'
import { loadSelectedPetId, saveSelectedPetId } from './selectedPetStorage'

const PetsContext = createContext(undefined)

export function PetsProvider({ children }) {
  const { user } = useAuth()
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)
  const [petsError, setPetsError] = useState(null)

  // Which user the current `pets` array was actually fetched for.
  //
  // On a cold start `refresh` runs once with no user (auth hasn't resolved),
  // takes the early-return branch below, and sets loading FALSE with an
  // empty list. Auth then resolves. For one render the app therefore sees a
  // signed-in user, loading complete, and zero pets — and RequireOnboardedPet
  // redirects to onboarding before the real fetch has even started. That is
  // the "app always opens on Add Another Pet" bug.
  //
  // Comparing against the current user id closes the gap: an empty list left
  // over from the no-user pass no longer counts as a finished result.
  const [fetchedForUserId, setFetchedForUserId] = useState(null)

  const [selectedPetId, setSelectedPetId] = useState(null)
  // Tracked separately from `loading` but folded into it below: rendering a
  // pet-specific screen before the persisted selection has been read would
  // briefly show the wrong pet's data and then swap under the user.
  const [selectionLoading, setSelectionLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setPets([])
      setLoading(false)
      setPetsError(null)
      setFetchedForUserId(null)
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
      // Set on failure too, not just success — otherwise a fetch error would
      // leave the app loading forever instead of showing petsError.
      setFetchedForUserId(user.id)
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Restore the persisted selection whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false
    setSelectionLoading(true)

    if (!user?.id) {
      setSelectedPetId(null)
      setSelectionLoading(false)
      return
    }

    loadSelectedPetId(user.id).then((storedId) => {
      if (cancelled) return
      setSelectedPetId(storedId)
      setSelectionLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // `pets` is ordered newest-first, so pets[0] is the default when there's
  // no valid stored selection. A stored id can go stale — the pet was
  // deleted here, or on another device — in which case fall back rather
  // than leaving the app pointing at a pet that no longer exists.
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null

  // If the stored id didn't resolve to a real pet but we did fall back to
  // one, write that correction back so the stale id doesn't linger.
  useEffect(() => {
    if (loading || selectionLoading) return
    if (!selectedPet) return
    if (selectedPet.id === selectedPetId) return

    setSelectedPetId(selectedPet.id)
    saveSelectedPetId(user?.id, selectedPet.id)
  }, [loading, selectionLoading, selectedPet, selectedPetId, user?.id])

  const selectPet = useCallback(
    (petId) => {
      setSelectedPetId(petId)
      saveSelectedPetId(user?.id, petId)
    },
    [user?.id],
  )

  // True only once this user's own pets have come back. Guards the render
  // where auth has resolved but the pets fetch for that user hasn't run yet.
  const petsFetchedForCurrentUser = !user || fetchedForUserId === user.id

  const value = {
    pets,
    // Kept true until the persisted selection is known too, so consumers
    // never render against a provisional pet — and until this user's pets
    // have actually been fetched, so an empty list from the no-user pass is
    // never mistaken for "this account has no pets".
    loading: loading || selectionLoading || !petsFetchedForCurrentUser,
    petsError,
    refresh,
    selectedPet,
    selectedPetId: selectedPet?.id ?? null,
    selectPet,
  }

  return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>
}

export function usePets() {
  const ctx = useContext(PetsContext)
  if (!ctx) throw new Error('usePets must be used within PetsProvider')
  return ctx
}

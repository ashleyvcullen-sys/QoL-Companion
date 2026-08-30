import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { useEntitlements } from './EntitlementsContext'
import { logStartupIssue } from './diagnostics'
import { loadSelectedPetId, saveSelectedPetId } from './selectedPetStorage'

const PetsContext = createContext(undefined)

export function PetsProvider({ children }) {
  const { user } = useAuth()
  const { petLimit, loading: entitlementsLoading } = useEntitlements()
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

  // How many pets the account really has, including any the limit is
  // hiding. This CANNOT be derived from `pets`.
  //
  // Once the RLS policy is applied, `select * from pets` returns the visible
  // ones and nothing else — so pets.length is capped at the limit by
  // definition, hiddenPetCount computed from it would always be zero, and
  // the "N pets are hidden" banner would never appear for anyone. The count
  // has to come from public.pet_count_for(), which is SECURITY DEFINER and
  // so sees past the policy that hides them.
  //
  // Null until it resolves, and null forever if the migration has not been
  // applied yet (the function does not exist, the call errors, and the app
  // carries on with client-side filtering only).
  const [totalPetCount, setTotalPetCount] = useState(null)

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

      // Separate call, deliberately not fatal. If the migration has not been
      // applied the function does not exist and this errors — which is fine,
      // because in that state RLS is not hiding anything either, so the
      // client-side filter is the only gate and pets.length is the truth.
      const { data: count, error: countError } = await supabase
        .rpc('pet_count_for', { uid: user.id })
      setTotalPetCount(countError ? null : (count ?? null))
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

  // Which of this account's pets the current subscription lets it see.
  //
  // `pets` above stays complete and untouched — the full list is what the
  // banner counts against, and it is the honest answer to "what does this
  // account have". Hiding is a view, not a deletion: nothing here or on the
  // server removes a pet, so letting a subscription lapse and renewing it
  // brings every record back with no restore step.
  //
  // The cut is oldest-first, matching public.visible_pet_ids() in
  // supabase/migrations/20260830000000_subscription_pet_gating.sql exactly.
  // On a downgrade the pet that survives is the one with the longest history
  // behind it, which is almost always the animal the account was opened for.
  //
  // Sorted here rather than relying on the query, which orders newest-first
  // for display. `id` breaks a created_at tie so the same pets are hidden on
  // every render and on every device, rather than whichever way the sort
  // happened to fall — two pets added in the same second must not swap
  // places between launches.
  const visiblePets = useMemo(() => {
    if (pets.length <= petLimit) return pets
    const keep = new Set(
      [...pets]
        .sort((a, b) => {
          if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
          return a.id < b.id ? -1 : 1
        })
        .slice(0, petLimit)
        .map((pet) => pet.id),
    )
    // Filtered out of `pets` rather than returned from the sort, so the
    // visible list keeps the newest-first order the rest of the app expects.
    return pets.filter((pet) => keep.has(pet.id))
  }, [pets, petLimit])

  // Prefer the server's count, fall back to what we can see. The two agree
  // in every state except the one that matters — after the migration, where
  // only the server's count knows about the hidden pets.
  const knownPetCount = totalPetCount ?? pets.length
  const hiddenPetCount = Math.max(knownPetCount - visiblePets.length, 0)

  // Whether adding another pet would be refused. Uses the true count for the
  // same reason: a free account with three pets can only see one, and asking
  // "is 1 >= 1" would be right by accident here and wrong the moment a tier
  // allows more than it has.
  const atPetLimit = knownPetCount >= petLimit

  // Selection resolves against the VISIBLE list. A stored id can go stale —
  // the pet was deleted here or on another device — and can now also point
  // at a pet that still exists but has been hidden by a downgrade. Both fall
  // back to the first visible pet rather than leaving a null selection,
  // which would strand every pet-scoped screen on an empty state.
  const selectedPet = visiblePets.find((pet) => pet.id === selectedPetId) ?? visiblePets[0] ?? null

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
    // The complete list, unfiltered. Route guards and "has this account
    // onboarded at all" checks want this, not visiblePets — an account with
    // three pets and a lapsed subscription has certainly onboarded.
    pets,
    // What the UI should show. Everything user-facing reads this.
    visiblePets,
    hiddenPetCount,
    petLimit,
    atPetLimit,
    // The true total, hidden pets included. `pets.length` is not this.
    totalPetCount: knownPetCount,
    // Kept true until the persisted selection is known too, so consumers
    // never render against a provisional pet — and until this user's pets
    // have actually been fetched, so an empty list from the no-user pass is
    // never mistaken for "this account has no pets".
    //
    // Entitlements are folded in for the same reason: rendering before the
    // limit is known would show the free view to a subscriber for a frame,
    // and the reminder sync below would act on it and cancel real reminders.
    loading: loading || selectionLoading || entitlementsLoading || !petsFetchedForCurrentUser,
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

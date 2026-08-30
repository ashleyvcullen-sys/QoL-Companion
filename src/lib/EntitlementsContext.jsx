import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { FREE_PET_LIMIT, hasPremiumAccess, petLimitFromRow } from './entitlements'

const EntitlementsContext = createContext(undefined)

// What the server thinks this account is entitled to.
//
// Read from public.user_entitlements rather than from RevenueCat's
// customerInfo, for three reasons that all point the same way:
//
//  1. It is the same row the RLS policies read, so the pets the app shows
//     and the pets the database will return cannot disagree. Deriving the
//     limit from RevenueCat on the client and from the table on the server
//     would give two answers that drift apart on exactly the accounts where
//     it matters — the ones mid-purchase or mid-lapse.
//  2. RevenueCat's plugin has no working web implementation, so customerInfo
//     is permanently null in a browser. Gating on it would cap the web build
//     at one pet for everybody, including paying subscribers.
//  3. customerInfo is null while the SDK configures on a cold start. A limit
//     derived from it would read "free" for a second on every launch, which
//     is long enough to hide pets and cancel their reminders.
//
// PetsProvider consumes this, so this provider has to sit above it — and
// above RevenueCatProvider too, which it does not depend on at all.
export function EntitlementsProvider({ children }) {
  const { user } = useAuth()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setRow(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // maybeSingle, not single: a free account has no row at all, and that
      // is the normal case rather than an error. The webhook only writes a
      // row when there is something to write.
      const { data, error } = await supabase
        .from('user_entitlements')
        .select('tier, pet_limit, expires_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      setRow(data ?? null)
    } catch (err) {
      // Fall back to free rather than surfacing an error. The database is
      // still enforcing the real limit either way, so the worst case here is
      // that a subscriber briefly sees the free view — annoying, and far
      // better than a blocking error screen over a subscription lookup.
      console.error('Failed to load entitlements:', err.message)
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = {
    tier: row?.tier ?? 'free',
    // The single client-side answer to "may this account use paid features".
    // Derived from the same row public.has_premium() reads in every RLS
    // policy, so the UI and the database cannot disagree.
    hasPremium: hasPremiumAccess(row),
    petLimit: petLimitFromRow(row),
    expiresAt: row?.expires_at ?? null,
    loading,
    // Called after a purchase or a restore. The webhook that writes the row
    // is a separate round trip from Apple to RevenueCat to us, so it can
    // land a moment after the purchase returns — see Paywall.jsx, which
    // retries this rather than reading once and believing it.
    refresh,
  }

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext)
  if (!ctx) throw new Error('useEntitlements must be used within EntitlementsProvider')
  return ctx
}

export { FREE_PET_LIMIT }

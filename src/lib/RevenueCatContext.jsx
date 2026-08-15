import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { useAuth } from './AuthContext'

const RevenueCatContext = createContext(undefined)

// Public, client-side RevenueCat API key for the Apple App Store build (the
// `appl_` prefix) — safe to ship inside the bundle, same trust model as a
// Stripe *publishable* key. Needs the VITE_ prefix to be readable via
// import.meta.env at all (see .env / vite's env-var rules).
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY

export function RevenueCatProvider({ children }) {
  const { user } = useAuth()
  const [customerInfo, setCustomerInfo] = useState(null)
  const [offerings, setOfferings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configureError, setConfigureError] = useState('')

  const configuredRef = useRef(false)
  const identifiedUserId = useRef(null)
  const listenerIdRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return
    const [{ customerInfo: info }, offeringsResult] = await Promise.all([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings(),
    ])
    setCustomerInfo(info)
    setOfferings(offeringsResult)
  }, [])

  // Removes the CustomerInfo listener only on the provider's true final
  // unmount (this effect has no deps), not on every user-id change below —
  // otherwise the second effect's per-render cleanup would tear the
  // listener down right after adding it.
  useEffect(() => {
    return () => {
      if (listenerIdRef.current && Capacitor.isNativePlatform()) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerIdRef.current }).catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    // The purchases-capacitor plugin has no real web implementation (its web
    // fallback throws "not supported" for nearly everything), and this app
    // also runs in a plain browser during development — skip entirely there
    // rather than logging noise on every page load.
    if (!Capacitor.isNativePlatform()) {
      setLoading(false)
      return
    }

    if (!REVENUECAT_API_KEY) {
      console.error('VITE_REVENUECAT_API_KEY is not set — RevenueCat will not be configured.')
      setConfigureError('missing-api-key')
      setLoading(false)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setConfigureError('')
      try {
        // configure() should only run once per app lifetime — switching
        // between signed-in users afterwards goes through logIn()/logOut()
        // instead, matching RevenueCat's recommended pattern.
        if (!configuredRef.current) {
          await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO })
          await Purchases.configure({ apiKey: REVENUECAT_API_KEY })
          configuredRef.current = true
        }

        if (!listenerIdRef.current) {
          listenerIdRef.current = await Purchases.addCustomerInfoUpdateListener((info) => {
            if (!cancelled) setCustomerInfo(info)
          })
        }

        if (user?.id) {
          if (identifiedUserId.current !== user.id) {
            await Purchases.logIn({ appUserID: user.id })
            identifiedUserId.current = user.id
          }
        } else if (identifiedUserId.current !== null) {
          // Signed out — drop back to an anonymous RevenueCat identity so a
          // different account signing in on the same device next doesn't
          // inherit the previous user's entitlements.
          await Purchases.logOut()
          identifiedUserId.current = null
        }

        await refresh()
      } catch (err) {
        console.error('Failed to configure RevenueCat:', err.message)
        if (!cancelled) setConfigureError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [user?.id, refresh])

  async function purchasePackage(pkg) {
    const { customerInfo: info } = await Purchases.purchasePackage({ aPackage: pkg })
    setCustomerInfo(info)
    return info
  }

  async function restorePurchases() {
    const { customerInfo: info } = await Purchases.restorePurchases()
    setCustomerInfo(info)
    return info
  }

  const value = {
    customerInfo,
    offerings,
    loading,
    configureError,
    refresh,
    purchasePackage,
    restorePurchases,
  }

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext)
  if (!ctx) throw new Error('useRevenueCat must be used within RevenueCatProvider')
  return ctx
}

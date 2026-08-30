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

// Verbose SDK logging, opt-in per build.
//
// This used to be `import.meta.env.DEV ? DEBUG : INFO`, which never once
// produced a debug log on a device. DEV is a VITE flag, not an Xcode one, and
// the native app always runs the output of `npm run build` — a production
// bundle where DEV is false and the DEBUG branch is tree-shaken away. So an
// Xcode Debug build, running against a StoreKit configuration file, still got
// INFO, and the per-product diagnostics that say WHY an offering came back
// empty were never printed.
//
// An explicit variable rather than reusing DEV, because the thing being asked
// is "is this a native build I am debugging", which no Vite flag knows.
const REVENUECAT_DEBUG_LOGGING = import.meta.env.VITE_REVENUECAT_DEBUG === 'true'

export function RevenueCatProvider({ children }) {
  const { user } = useAuth()
  const [customerInfo, setCustomerInfo] = useState(null)
  const [offerings, setOfferings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configureError, setConfigureError] = useState('')
  const [offeringsError, setOfferingsError] = useState('')

  const configuredRef = useRef(false)
  const identifiedUserId = useRef(null)
  const listenerIdRef = useRef(null)

  // Two independent calls, settled independently.
  //
  // This was one Promise.all, which meant a rejection from EITHER call threw
  // the pair and landed in the configure catch — so a failed getOfferings
  // reported as "Premium isn't available right now" (the SDK could not be set
  // up) when the truth was that the SDK was fine and the offering had not
  // loaded. The two need different answers: a configure failure is not worth
  // retrying in-place, a missing offering is.
  //
  // getCustomerInfo still throws, because failing to read who the customer is
  // IS a configure-level problem. getOfferings does not; it records its own
  // error and leaves the rest of the SDK usable. Note that nothing gating
  // access depends on either — see EntitlementsContext, which is the source
  // of truth for what an account may do.
  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return

    const [infoResult, offeringsResult] = await Promise.allSettled([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings(),
    ])

    if (offeringsResult.status === 'fulfilled') {
      setOfferings(offeringsResult.value)
      setOfferingsError('')
    } else {
      const message = offeringsResult.reason?.message || 'Could not load the subscription options.'
      console.error('Failed to load RevenueCat offerings:', message)
      setOfferings(null)
      setOfferingsError(message)
    }

    if (infoResult.status === 'rejected') throw infoResult.reason
    setCustomerInfo(infoResult.value.customerInfo)
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
          await Purchases.setLogLevel({
            level: REVENUECAT_DEBUG_LOGGING ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO,
          })
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
    offeringsError,
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

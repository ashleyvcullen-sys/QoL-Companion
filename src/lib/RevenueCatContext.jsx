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
  const { user, loading: authLoading } = useAuth()
  const [customerInfo, setCustomerInfo] = useState(null)
  const [offerings, setOfferings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configureError, setConfigureError] = useState('')
  const [offeringsError, setOfferingsError] = useState('')

  // Which Supabase user the SDK is actually identified as. State, not a ref,
  // because the UI has to be able to refuse a purchase until this matches the
  // signed-in user — see identityReady below.
  const [identifiedUserId, setIdentifiedUserId] = useState(null)

  // The same value as a ref, because the effect below has to make decisions
  // from it without listing it as a dependency (which would re-run the effect
  // every time it changed). Kept in step by identifyAs().
  const identifiedRef = useRef(null)

  // The in-flight configure() promise, not a boolean.
  //
  // This was `configuredRef.current = true` set AFTER the await, so a second
  // effect run starting while the first was still awaiting configure() saw
  // false and configured again — two concurrent configures against an SDK
  // that documents the call as once per app lifetime. Holding the promise
  // means the second run awaits the first rather than repeating it.
  const configurePromiseRef = useRef(null)
  const listenerIdRef = useRef(null)

  // Sets the ref and the state together, so the effect's decisions and the
  // UI's gating can never disagree about who the SDK is.
  const identifyAs = useCallback((id) => {
    identifiedRef.current = id
    setIdentifiedUserId(id)
  }, [])

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

    // Do not configure until the session is known.
    //
    // This is the anonymous-purchase bug. configure() with no appUserID mints
    // a $RCAnonymousID, and the provider used to run on mount — where `user`
    // is null because AuthContext starts at session === undefined. The SDK
    // was therefore anonymous, loading was cleared, and the paywall became
    // purchasable, all before getSession() came back. That window is as long
    // as the session check takes, which AuthContext allows up to ten seconds
    // for. A purchase made inside it attaches to the anonymous identity, and
    // the webhook has no Supabase user to write an entitlement for.
    //
    // Staying in `loading` here is what keeps the paywall non-interactive.
    if (authLoading) {
      setLoading(true)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setConfigureError('')
      try {
        // configure() only once per app lifetime, and — now that the session
        // has resolved before we get here — with the appUserID already known.
        // Configuring WITH the identity means a signed-in user never holds an
        // anonymous id at all, rather than holding one briefly and being
        // aliased out of it afterwards. That matters: per RevenueCat's
        // identifying-customers docs, an anonymous identity is only merged
        // into the target id if that id does not already exist. For a
        // returning account it does, and the anonymous purchase is orphaned.
        if (!configurePromiseRef.current) {
          configurePromiseRef.current = (async () => {
            await Purchases.setLogLevel({
              level: REVENUECAT_DEBUG_LOGGING ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO,
            })
            await Purchases.configure({
              apiKey: REVENUECAT_API_KEY,
              ...(user?.id ? { appUserID: user.id } : {}),
            })
            return user?.id ?? null
          })()
        }
        const configuredAs = await configurePromiseRef.current
        if (configuredAs) identifyAs(configuredAs)

        if (!listenerIdRef.current) {
          listenerIdRef.current = await Purchases.addCustomerInfoUpdateListener((info) => {
            if (!cancelled) setCustomerInfo(info)
          })
        }

        // Compared against the CURRENT identity rather than against whatever
        // configure() was called with. Those differ once an account has been
        // switched: configuredAs is fixed for the app's lifetime, so using it
        // here left the SDK still logged in as the previous user after a sign
        // out that followed a sign in.
        if (user?.id) {
          if (identifiedRef.current !== user.id) {
            await Purchases.logIn({ appUserID: user.id })
          }
          if (!cancelled) identifyAs(user.id)
        } else if (identifiedRef.current !== null) {
          // Signed out — drop back to an anonymous RevenueCat identity so a
          // different account signing in on the same device next doesn't
          // inherit the previous user's entitlements.
          await Purchases.logOut()
          if (!cancelled) identifyAs(null)
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
  }, [user?.id, authLoading, refresh, identifyAs])

  // Is the SDK identified as the signed-in user right now?
  //
  // Nothing that moves money may happen while this is false. An anonymous
  // purchase is not a cosmetic problem: the webhook maps app_user_id to a
  // Supabase user, so a purchase made under a $RCAnonymousID writes no
  // entitlement row and the customer pays and receives nothing.
  const identityReady = Boolean(user?.id) && identifiedUserId === user.id

  // The guard is here as well as in the UI on purpose. The screen disables
  // its buttons, and these refuse outright — a disabled button is a courtesy,
  // and this is the thing that makes the bad state actually unreachable.
  function assertIdentity(action) {
    if (!identityReady) {
      throw new Error(
        `Cannot ${action} before RevenueCat is identified as the signed-in user. ` +
        'This guard exists because purchasing anonymously silently loses the purchase.',
      )
    }
  }

  async function purchasePackage(pkg) {
    assertIdentity('purchase')
    const { customerInfo: info } = await Purchases.purchasePackage({ aPackage: pkg })
    setCustomerInfo(info)
    return info
  }

  async function restorePurchases() {
    // Restore is gated too. Restoring onto an anonymous identity attaches the
    // entitlement to an id no Supabase user maps to, which is the same
    // failure by a different route.
    assertIdentity('restore purchases')
    const { customerInfo: info } = await Purchases.restorePurchases()
    setCustomerInfo(info)
    return info
  }

  const value = {
    identityReady,
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

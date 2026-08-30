import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { useRevenueCat } from '../lib/RevenueCatContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { usePets } from '../lib/PetsContext'
import {
  APPLE_DISCLOSURE,
  PAYWALL_FEATURE_LIST,
  PAYWALL_SUBHEAD,
  paywallHeadline,
} from '../lib/paywallCopy'

// Apple's own subscription management page. Deliberately not a deep link
// into Settings: this URL is the one Apple documents for the purpose, it
// works from a browser view, and it lands on the subscription list rather
// than somewhere the user then has to navigate from.
//
// PENDING ASH — the Play Store equivalent, once there is an Android build:
// https://play.google.com/store/account/subscriptions
const MANAGE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions'

// Re-read the entitlement, then the pets, after a purchase or a restore.
//
// Both halves are needed and the order matters. The pet limit comes from
// user_entitlements, but the pets themselves are filtered by RLS using that
// same row — so an upgrade does not merely unhide pets the client already
// has, it changes which rows the database will return at all. Refreshing the
// limit without refetching pets would leave a subscriber looking at the one
// pet the free query gave them.
//
// Retried because the grant is not ours to make. Apple tells RevenueCat,
// RevenueCat calls our webhook, and only then does the row exist — a round
// trip that usually beats the user back to the screen but is not guaranteed
// to. Three tries over ~3s covers the normal case; beyond that the row will
// be picked up on the next launch, and the database is already enforcing the
// correct limit either way, so nothing here can grant access that was not
// actually paid for.
async function settleEntitlement(refreshEntitlements, refreshPets) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1000))
    await refreshEntitlements()
  }
  await refreshPets()
}

// Three outcomes wear three different responses, and conflating them is the
// usual way a paywall becomes infuriating.
//
//  - The user dismissed Apple's sheet. This is not an error and must show
//    NOTHING. RevenueCat signals it with userCancelled rather than a code,
//    which is why that flag is checked first and on its own.
//  - The network failed. Retrying genuinely might work, so say so. The raw
//    text here is usually an NSURLErrorDomain string, which tells a pet
//    owner nothing.
//  - Anything else genuinely failed. Show what we know.
//
// The plugin reports codes inconsistently across versions — a numeric `code`
// on some, a readableErrorCode string on others — so both are checked rather
// than trusting one shape.
function describePurchaseError(err) {
  if (err?.userCancelled) return null

  const readable = String(err?.readableErrorCode ?? '')
  const code = String(err?.code ?? '')
  const isNetwork = readable === 'NETWORK_ERROR' || code === '10'

  if (isNetwork) {
    return "Couldn't reach the App Store. Check your connection and try again."
  }
  return err?.message || 'Something went wrong with that purchase.'
}

// Per-month equivalent for the annual plan — spec section 4 calls this the
// single most effective element in shifting mix toward annual.
//
// Computed from the product's own numeric price and currency rather than
// written into the copy. A hardcoded "$7.50" would be wrong in every
// storefront but one, and showing a price that does not match what StoreKit
// is about to charge is both a rejection risk and a straightforward lie.
// Falls back to null — the line is simply omitted — if the SDK gives us no
// numeric price to divide.
function perMonthEquivalent(annualPackage) {
  const price = annualPackage?.product?.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null

  const currency = annualPackage.product.currencyCode
  const monthly = price / 12
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(monthly)
  } catch {
    // Unknown currency code — better to drop the line than print a number
    // with no unit on it.
    return null
  }
}

export default function Paywall() {
  const { offerings, loading, configureError, purchasePackage, restorePurchases } = useRevenueCat()
  const { refresh: refreshEntitlements, hasPremium } = useEntitlements()
  const { refresh: refreshPets } = usePets()
  const navigate = useNavigate()

  // Which locked control sent the user here. Absent when they came on
  // purpose, which gets the generic headline.
  const { state } = useLocation()
  const headline = paywallHeadline(state?.feature)

  const [selectedId, setSelectedId] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [actionError, setActionError] = useState('')
  const [restoreMessage, setRestoreMessage] = useState('')

  const packages = offerings?.current?.availablePackages ?? []

  // RevenueCat labels these on the package, so this does not depend on
  // product identifiers we would otherwise have to keep in sync by hand.
  const annual = packages.find((p) => p.packageType === 'ANNUAL')
  const monthly = packages.find((p) => p.packageType === 'MONTHLY')
  const ordered = [annual, monthly].filter(Boolean)

  // Annual pre-selected, per spec section 4. In an effect rather than in
  // useState's initialiser because offerings arrive asynchronously — at
  // first render there is nothing to select.
  useEffect(() => {
    if (selectedId || ordered.length === 0) return
    setSelectedId((annual ?? ordered[0]).identifier)
  }, [selectedId, ordered, annual])

  const selected = ordered.find((p) => p.identifier === selectedId) ?? null
  const perMonth = perMonthEquivalent(annual)

  async function handlePurchase() {
    if (!selected || purchasing) return
    setPurchasing(true)
    setActionError('')
    try {
      await purchasePackage(selected)
      await settleEntitlement(refreshEntitlements, refreshPets)
      // No success banner. The entitlement has landed, every locked control
      // is now open, and leaving the user on the sales screen to read a
      // thank-you is a worse answer than putting them back where they were.
      navigate(-1)
    } catch (err) {
      // null for a dismissed sheet — the user chose that, and telling them
      // it "failed" would be both wrong and slightly insulting.
      const message = describePurchaseError(err)
      if (message) setActionError(message)
    } finally {
      setPurchasing(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setActionError('')
    setRestoreMessage('')
    try {
      const info = await restorePurchases()
      await settleEntitlement(refreshEntitlements, refreshPets)
      // Restoring when there is nothing to restore succeeds — RevenueCat
      // returns customerInfo with no active entitlement rather than
      // throwing. Silence there reads as a broken button, so say plainly
      // that nothing was found.
      const restored = Boolean(info?.entitlements?.active?.premium)
      setRestoreMessage(restored
        ? 'Your subscription has been restored.'
        : 'No previous subscription found for this Apple ID.')
    } catch (err) {
      const message = describePurchaseError(err)
      if (message) setActionError(message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="screen paywall">
      {/* Spec section 8. A plain, immediate close at the top — Apple rejects
          paywalls that are hard to escape, and a delayed or hidden dismiss
          damages trust even when it survives review. */}
      <button
        type="button"
        className="paywall-close"
        aria-label="Close"
        onClick={() => navigate(-1)}
      >
        <X size={20} />
      </button>

      <Card>
        <h1 className="paywall-headline">{headline}</h1>
        <p className="paywall-subhead">{PAYWALL_SUBHEAD}</p>

        <ul className="paywall-features">
          {PAYWALL_FEATURE_LIST.map((line) => (
            <li key={line}>
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

      {hasPremium && (
        <Card>
          <p role="status">You're subscribed to QoL Companion Premium. Thank you.</p>
        </Card>
      )}

      {!Capacitor.isNativePlatform() && (
        <Card>
          <p>Subscriptions are only available in the QoL Companion app on your phone.</p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && loading && (
        <Card><p>Loading…</p></Card>
      )}

      {Capacitor.isNativePlatform() && !loading && configureError && (
        <Card>
          <p className="form-error" role="alert">
            Premium isn't available right now. Please try again later.
          </p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && !loading && !configureError && ordered.length === 0 && (
        <Card><p>Nothing to see yet — Premium is coming soon.</p></Card>
      )}

      {/* Spec section 4. Both options visible at once, never a toggle that
          hides one — a user has to be able to compare without discovering
          that the other plan exists. */}
      {ordered.length > 0 && (
        <div className="paywall-plans" role="radiogroup" aria-label="Choose a plan">
          {ordered.map((pkg) => {
            const isAnnual = pkg.packageType === 'ANNUAL'
            const isSelected = pkg.identifier === selectedId
            return (
              <button
                key={pkg.identifier}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`paywall-plan ${isSelected ? 'selected' : ''}`.trim()}
                onClick={() => setSelectedId(pkg.identifier)}
              >
                <span className="paywall-plan-term">
                  {isAnnual ? 'Annual' : 'Monthly'}
                  {isAnnual && <span className="paywall-plan-badge">Best value</span>}
                </span>
                <span className="paywall-plan-price">
                  {pkg.product.priceString} / {isAnnual ? 'year' : 'month'}
                </span>
                {isAnnual && perMonth && (
                  <span className="paywall-plan-equivalent">
                    {perMonth} per month, billed annually
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {ordered.length > 0 && (
        <>
          {/* Spec section 5. "Continue" — not "Subscribe now", not "Start
              free trial" (there is no trial), not "Buy". */}
          <Btn
            type="button"
            className="btn-block"
            disabled={purchasing || !selected}
            onClick={handlePurchase}
          >
            {purchasing ? 'Processing…' : 'Continue'}
          </Btn>

          {/* Spec section 6. VERBATIM — do not reword this for layout. If it
              does not fit, the layout gives way, not the text. This is the
              string Apple checks under Guideline 3.1.2. */}
          <p className="paywall-disclosure">{APPLE_DISCLOSURE}</p>
        </>
      )}

      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {restoreMessage && <p className="paywall-restore-message" role="status">{restoreMessage}</p>}

      {/* Spec section 7. Three items of equal weight. Restore Purchases has
          to be a visible, working control on this screen — its absence is a
          standard rejection, not a nicety. */}
      <div className="paywall-footer-row">
        <button type="button" className="subtle-link" onClick={handleRestore} disabled={restoring}>
          {restoring ? 'Restoring…' : 'Restore Purchases'}
        </button>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className="subtle-link">Terms of Use</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="subtle-link">Privacy Policy</Link>
      </div>

      {/* Shown before the link out, not after it — once the user has left for
          Apple's settings screen they are not coming back to read a caveat,
          and "will my records be deleted?" is the question that stops people
          cancelling something they have already decided to cancel. */}
      {Capacitor.isNativePlatform() && hasPremium && (
        <Card>
          <p className="assessment-hint">
            Your other pets' records will be hidden but not deleted, and will return
            if you resubscribe.
          </p>
          <button
            type="button"
            className="subtle-link"
            onClick={() => Browser.open({ url: MANAGE_SUBSCRIPTION_URL })}
          >
            Manage or cancel your subscription
          </button>
        </Card>
      )}
    </div>
  )
}

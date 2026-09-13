import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Purchases, INTRO_ELIGIBILITY_STATUS } from '@revenuecat/purchases-capacitor'
import { Browser } from '@capacitor/browser'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { useRevenueCat } from '../lib/RevenueCatContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { usePets } from '../lib/PetsContext'
import { PRIVACY_POLICY_URL, TERMS_URL } from '../lib/legalUrls'
import {
  APPLE_DISCLOSURE,
  APPLE_TRIAL_DISCLOSURE,
  trialLine,
  CANCELLATION_KEEPS_RECORDS,
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

// Apple reports a one-week trial as WEEK x 1, which would render as "1 week
// free". The offer is marketed as seven days, and a paywall that says
// something different from the ad is both confusing and a review risk, so a
// single week is spelled in days. Everything else is rendered as Apple
// states it, pluralised.
function trialLengthText(intro) {
  if (!intro) return null
  const n = intro.periodNumberOfUnits
  const unit = String(intro.periodUnit || '').toUpperCase()
  if (unit === 'WEEK' && n === 1) return '7 days'
  const word = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }[unit]
  if (!word) return null
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

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

export default function Paywall() {
  const { offerings, loading, configureError, identityReady, purchasePackage, restorePurchases } = useRevenueCat()
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
  // productId -> true when THIS Apple ID can still take the introductory
  // offer. Eligibility is per Apple ID and per subscription group, so it is
  // not something we can infer from the product alone — anyone who has
  // subscribed before is ineligible and must not be shown a trial they
  // cannot have.
  const [introEligible, setIntroEligible] = useState({})

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

  // Ask Apple, not the product. A null introPrice means no offer exists at
  // all; a present one only means the offer exists, not that this customer
  // may have it. Failure is silent and falls back to showing no trial, which
  // under-promises rather than advertising something the purchase sheet will
  // then refuse.
  const productIds = ordered.map((p) => p.product.identifier).join(',')
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !productIds) return
    let cancelled = false
    const ids = productIds.split(',')
    Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: ids })
      .then((result) => {
        if (cancelled) return
        const next = {}
        for (const id of ids) {
          next[id] = result?.[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
        }
        setIntroEligible(next)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [productIds])

  // The trial text for a package, or null when there is no offer, the
  // customer is not eligible, or the period is one we do not have wording
  // for.
  function trialFor(pkg) {
    if (!introEligible[pkg.product.identifier]) return null
    return trialLengthText(pkg.product.introPrice)
  }

  const selected = ordered.find((p) => p.identifier === selectedId) ?? null
  const selectedTrial = selected ? trialFor(selected) : null

  async function handlePurchase() {
    if (!selected || purchasing || !identityReady) return
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
          {PAYWALL_FEATURE_LIST.map(({ text, detail }) => (
            <li key={text}>
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              {/* The detail sits inside the text span, not as a sibling of
                  the tick, so it lines up under the words rather than under
                  the tick — and so a wrapping bullet keeps its subline
                  attached to it. */}
              <span>
                {text}
                {detail && <span className="paywall-feature-detail">{detail}</span>}
              </span>
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

      {/* The offering came back with no annual or monthly package in it.
          This used to read "Premium is coming soon", which was true while the
          products did not exist; now that the entitlement and the default
          offering are configured, reaching this state means the offering
          failed to load or is misconfigured — and telling a user who wants to
          pay that the thing is not built yet would be wrong and would lose
          the sale. */}
      {Capacitor.isNativePlatform() && !loading && !configureError && ordered.length === 0 && (
        <Card>
          <p className="form-error" role="alert">
            We couldn't load the subscription options. Please check your connection
            and try again.
          </p>
        </Card>
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
                  {trialFor(pkg)
                    ? trialLine(trialFor(pkg), pkg.product.priceString, isAnnual ? 'year' : 'month')
                    : `${pkg.product.priceString} / ${isAnnual ? 'year' : 'month'}`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {ordered.length > 0 && (
        <>
          {/* Spec section 5. "Continue" by default — not "Subscribe now",
              not "Buy". "Start free trial" ONLY when this customer is
              actually eligible for one: offering a trial the purchase sheet
              then refuses is a rejection and a broken promise. */}
          <Btn
            type="button"
            className="btn-block"
            disabled={purchasing || !selected || !identityReady}
            onClick={handlePurchase}
          >
            {purchasing ? 'Processing…' : selectedTrial ? 'Start free trial' : 'Continue'}
          </Btn>

          {/* Spec section 6. VERBATIM — do not reword this for layout. If it
              does not fit, the layout gives way, not the text. This is the
              string Apple checks under Guideline 3.1.2. */}
          <p className="paywall-disclosure">
            {selectedTrial ? APPLE_TRIAL_DISCLOSURE : APPLE_DISCLOSURE}
          </p>
        </>
      )}

      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {restoreMessage && <p className="paywall-restore-message" role="status">{restoreMessage}</p>}

      {/* Spec section 7. Three items of equal weight. Restore Purchases has
          to be a visible, working control on this screen — its absence is a
          standard rejection, not a nicety. */}
      <div className="paywall-footer-row">
        <button type="button" className="subtle-link" onClick={handleRestore} disabled={restoring || !identityReady}>
          {restoring ? 'Restoring…' : 'Restore Purchases'}
        </button>
        <span aria-hidden="true">·</span>
        {/* The WEBSITE documents, not the in-app Legal & Privacy screen these
            used to point at.
            Apple expects the EULA linked from a subscription paywall to cover
            auto-renewal, cancellation and refunds, and the privacy policy to
            be the real one. The in-app page is a plain-language summary that
            does not cover those terms, so linking it here is a Guideline
            3.1.2 rejection waiting to happen.
            Plain anchors with target="_blank" so they open in the system
            browser rather than an SFSafariViewController inside the app. */}
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="subtle-link">
          Terms of Use
        </a>
        <span aria-hidden="true">·</span>
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="subtle-link">
          Privacy Policy
        </a>
      </div>

      {/* Shown before the link out, not after it — once the user has left for
          Apple's settings screen they are not coming back to read a caveat,
          and "will my records be deleted?" is the question that stops people
          cancelling something they have already decided to cancel. */}
      {Capacitor.isNativePlatform() && hasPremium && (
        <Card>
          <p className="assessment-hint">{CANCELLATION_KEEPS_RECORDS}</p>
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

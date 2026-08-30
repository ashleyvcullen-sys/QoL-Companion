import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { Browser } from '@capacitor/browser'
import { useRevenueCat } from '../lib/RevenueCatContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { usePets } from '../lib/PetsContext'

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

export default function Paywall() {
  const { offerings, loading, configureError, purchasePackage, restorePurchases } = useRevenueCat()
  const { refresh: refreshEntitlements } = useEntitlements()
  // Set when the user arrived by tapping a locked tile, so the headline
  // answers the thing they actually reached for. Absent when they came
  // here on purpose, which gets the general heading instead.
  const { state } = useLocation()
  const feature = state?.feature ?? null
  const { refresh: refreshPets } = usePets()
  const [purchasingId, setPurchasingId] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const packages = offerings?.current?.availablePackages ?? []

  async function handlePurchase(pkg) {
    setPurchasingId(pkg.identifier)
    setActionError('')
    setActionMessage('')
    try {
      await purchasePackage(pkg)
      await settleEntitlement(refreshEntitlements, refreshPets)
      setActionMessage('Purchase successful — thank you for your support!')
    } catch (err) {
      // RevenueCat rejects with a userCancelled flag rather than treating
      // it as a real failure — don't show an error for a simple cancel.
      if (!err?.userCancelled) {
        setActionError(err?.message || 'Something went wrong with that purchase.')
      }
    } finally {
      setPurchasingId(null)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setActionError('')
    setActionMessage('')
    try {
      await restorePurchases()
      await settleEntitlement(refreshEntitlements, refreshPets)
      setActionMessage('Purchases restored.')
    } catch (err) {
      setActionError(err?.message || 'Could not restore purchases.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>
          {feature ? `${feature} with QoL Companion Premium` : 'QoL Companion Premium'}
        </SectionTitle>
        <p className="home-subtitle">
          One subscription, everything unlocked — up to five pet profiles, body
          condition and weight, photos and videos, and monitoring for specific
          diagnosed conditions.
        </p>
      </Card>

      {!Capacitor.isNativePlatform() && (
        <Card>
          <p>Purchases are only available in the QoL Companion app on your phone.</p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && loading && (
        <Card>
          <p>Loading…</p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && !loading && configureError && (
        <Card>
          <p className="form-error" role="alert">
            Premium isn't available right now. Please try again later.
          </p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && !loading && !configureError && packages.length === 0 && (
        <Card>
          <p>Nothing to see yet — Premium is coming soon.</p>
        </Card>
      )}

      {packages.map((pkg) => (
        <Card key={pkg.identifier} className="paywall-package">
          <div className="paywall-package-info">
            <p className="paywall-package-title">{pkg.product.title}</p>
            <p className="paywall-package-description">{pkg.product.description}</p>
          </div>
          <Btn
            type="button"
            className="btn-block"
            disabled={purchasingId !== null}
            onClick={() => handlePurchase(pkg)}
          >
            {purchasingId === pkg.identifier ? 'Processing…' : `${pkg.product.priceString}`}
          </Btn>
        </Card>
      ))}

      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {actionMessage && <p role="status">{actionMessage}</p>}

      {Capacitor.isNativePlatform() && (
        <button type="button" className="subtle-link" onClick={handleRestore} disabled={restoring}>
          {restoring ? 'Restoring…' : 'Restore purchases'}
        </button>
      )}

      {/* Shown before the link out, not after it — once the user has left for
          Apple's settings screen they are not coming back to read a caveat,
          and "will my records be deleted?" is the question that stops people
          cancelling something they have already decided to cancel. Answering
          it honestly here is worth more than the retention a vague warning
          might buy. */}
      {Capacitor.isNativePlatform() && (
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

      <Footer />
    </div>
  )
}

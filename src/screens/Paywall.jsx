import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { useRevenueCat } from '../lib/RevenueCatContext'

export default function Paywall() {
  const { offerings, loading, configureError, purchasePackage, restorePurchases } = useRevenueCat()
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
        <SectionTitle>Premium Plans</SectionTitle>
        <p className="home-subtitle">
          Support ongoing development and unlock features like tracking more than one
          pet and monitoring specific diagnosed conditions.
        </p>
      </Card>

      {!Capacitor.isNativePlatform() && (
        <Card>
          <p>Purchases are only available in the QoL Companion app on your phone.</p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && loading && (
        <Card>
          <p>Loading plans…</p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && !loading && configureError && (
        <Card>
          <p className="form-error" role="alert">
            Plans aren't available right now. Please try again later.
          </p>
        </Card>
      )}

      {Capacitor.isNativePlatform() && !loading && !configureError && packages.length === 0 && (
        <Card>
          <p>Nothing to see yet — premium plans are coming soon.</p>
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

      <Footer />
    </div>
  )
}

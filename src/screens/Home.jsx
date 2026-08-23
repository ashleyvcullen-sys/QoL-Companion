import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Heart, TrendingUp, Bell, HeartHandshake, FileDown, LogOut, PawPrint, Stethoscope, Scale } from 'lucide-react'
import { usePets } from '../lib/PetsContext'
import { useRevenueCat } from '../lib/RevenueCatContext'
import { supabase } from '../lib/supabase'
import { HOME_TOUR_MESSAGES } from '../lib/homeTourContent'
import { hasDiseaseMonitoringAccess } from '../lib/entitlements'
import { cancelQolReminder } from '../lib/notifications'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeTour from '../components/HomeTour'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import ComingSoonModal from '../components/ComingSoonModal'
import Footer from '../components/Footer'
import PetSwitcher from '../components/PetSwitcher'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'
import AboutIcon from '../components/icons/AboutIcon'

const NAV_ITEMS = [
  { to: '/about', label: 'About', Icon: AboutIcon },
  { to: '/assessment', label: 'Quality Of Life Assessment', Icon: Heart },
  { to: '/trends', label: 'Trends', Icon: TrendingUp },
  // Plus-tier feature, currently ungated for testing — see the note on the
  // Add Another Pet tile below for how to re-gate on hasPlusAccess().
  { to: '/body-condition', label: 'Body Condition / Weight', Icon: Scale },
  { to: '/home-care-tips', label: 'Home Care Tips', Icon: HomeCareTipsIcon },
  { to: '/schedule', label: 'Schedule', Icon: Bell },
  { to: '/export-report', label: 'Export Report', Icon: FileDown },
  { to: '/end-of-life', label: 'End Of Life', Icon: HeartHandshake },
  { to: '/emergencies', label: 'Emergencies', Icon: AlertTriangle },
]

export default function Home() {
  const { pets, refresh, selectedPet, selectPet } = usePets()
  const { customerInfo } = useRevenueCat()
  const pet = selectedPet
  const petName = pet?.name || 'your pet'
  const navigate = useNavigate()
  const location = useLocation()

  const [showTour, setShowTour] = useState(false)
  const autoTourShownRef = useRef(false)
  const tileRefs = useRef({})

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')

  const [showDiseaseMonitoringPreview, setShowDiseaseMonitoringPreview] = useState(false)

  const tourSteps = NAV_ITEMS.map(({ to, label }) => ({ to, label, message: HOME_TOUR_MESSAGES[to] }))

  useEffect(() => {
    if (pet && !pet.has_seen_app_tour && !autoTourShownRef.current) {
      autoTourShownRef.current = true
      setShowTour(true)
    }
  }, [pet])

  useEffect(() => {
    if (location.state?.startTour) {
      setShowTour(true)
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate])

  async function completeTour() {
    setShowTour(false)
    if (pet && !pet.has_seen_app_tour) {
      const { error } = await supabase
        .from('pets')
        .update({ has_seen_app_tour: true })
        .eq('id', pet.id)
        .select()
      if (error) {
        // If this write silently fails (e.g. a missing UPDATE RLS policy on
        // `pets`), has_seen_app_tour never actually flips to true, and the
        // tour will auto-show again on every future visit to Home.
        console.error('Failed to mark app tour as seen:', error.message)
        return
      }
      await refresh()
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeletePet() {
    if (!pet || deleting) return
    setDeleting(true)
    setDeleteError('')

    const { error } = await supabase.from('pets').delete().eq('id', pet.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    // Reminders are now per-pet, so this pet's own scheduled reminder has
    // to go with it — otherwise it keeps firing for a pet that no longer
    // exists. Other pets' reminders are keyed separately and unaffected.
    cancelQolReminder(pet.id).catch((err) => {
      console.error('Failed to cancel reminder for deleted pet:', err.message)
    })

    // Work out the replacement *before* refreshing, while `pets` still
    // includes the one just deleted.
    const remaining = pets.filter((p) => p.id !== pet.id)

    setShowDeleteConfirm(false)
    setDeleting(false)

    if (remaining.length > 0) {
      // Multi-pet: switch to another pet rather than bouncing the user to
      // onboarding. PetsContext would fall back to pets[0] on its own once
      // the selected id goes stale, but selecting explicitly also persists
      // the choice, so it survives a restart.
      selectPet(remaining[0].id)
    }

    // If nothing remains, pets drops to an empty array and the
    // RequireOnboardedPet route guard in App.jsx redirects to /onboarding
    // as soon as it sees pets.length === 0 — no manual navigate needed.
    await refresh()
  }

  async function handleDeleteAccount() {
    if (deletingAccount) return
    setDeletingAccount(true)
    setDeleteAccountError('')

    // Runs server-side with the service-role key (see
    // supabase/functions/delete-account) — deletes this user's pet(s), all
    // associated QoL/pain entries, and the auth.users record itself.
    // supabase-js automatically attaches the current session's access
    // token as the Authorization header.
    const { error } = await supabase.functions.invoke('delete-account')

    if (error) {
      setDeleteAccountError(error.message || 'Something went wrong deleting your account. Please try again.')
      setDeletingAccount(false)
      return
    }

    // The account (and its session, server-side) no longer exists — signing
    // out here just clears the local session state before returning to
    // Login.
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="screen">
      <Card className="home-header">
        <img
          src="/images/logo.png"
          alt="Dog and cat, nose to nose, forming a heart"
          className="logo-placeholder"
        />
        <SectionTitle>{pet ? `${petName}'s Quality Of Life Companion` : 'Your Quality Of Life Companion'}</SectionTitle>
        <p className="home-subtitle">
          Here to support and help you navigate {petName}'s quality of life and wellbeing
          every step of the way.
        </p>
        <PetSwitcher />
      </Card>

      <div className="icon-grid">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            ref={(el) => { tileRefs.current[to] = el }}
            className="icon-tile-link"
          >
            <Card className="icon-tile">
              <span className="icon-badge">
                <Icon size={22} strokeWidth={2} color="#fff" />
              </span>
              <span className="icon-tile-label">{label}</span>
            </Card>
          </Link>
        ))}

        <button
          type="button"
          className="icon-tile-link"
          onClick={() => {
            // Once disease monitoring is a real, buildable feature, the
            // granted branch routes to it instead of the preview modal.
            if (!hasDiseaseMonitoringAccess(customerInfo)) setShowDiseaseMonitoringPreview(true)
          }}
        >
          <Card className="icon-tile icon-tile-disabled">
            <span className="icon-badge icon-badge-disabled">
              <Stethoscope size={22} strokeWidth={2} color="#fff" />
            </span>
            <span className="icon-tile-label">Monitoring Specific Diseases</span>
            <span className="icon-tile-sublabel">Coming soon</span>
          </Card>
        </button>

        {/* Multi-pet is currently ungated — this routes straight to the
            add-pet flow. To put it behind the paywall later, gate this on
            hasMultiPetAccess(customerInfo) and fall back to the
            ComingSoon/paywall path when not entitled. */}
        <Link to="/onboarding" className="icon-tile-link">
          <Card className="icon-tile">
            <span className="icon-badge">
              <PawPrint size={22} strokeWidth={2} color="#fff" />
            </span>
            <span className="icon-tile-label">Add Another Pet</span>
          </Card>
        </Link>
      </div>

      <button type="button" className="sign-out-button" onClick={handleSignOut}>
        <LogOut size={14} /> Sign out
      </button>

      {pet && (
        <button
          type="button"
          className="delete-pet-link"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Remove {petName}
        </button>
      )}

      <button
        type="button"
        className="delete-pet-link"
        onClick={() => setShowDeleteAccountConfirm(true)}
      >
        Delete Account
      </button>

      {showTour && (
        <HomeTour steps={tourSteps} targetRefs={tileRefs} onFinish={completeTour} />
      )}

      {showDiseaseMonitoringPreview && (
        <ComingSoonModal
          title="Monitoring Specific Diseases"
          message="Specific quality-of-life tracking for diagnosed conditions like arthritis, cardiac disease, kidney disease, and more — coming soon."
          onClose={() => setShowDiseaseMonitoringPreview(false)}
          // showPlansLink temporarily omitted — re-add once real subscription
          // products exist in App Store Connect / RevenueCat. Paywall screen
          // and RevenueCat integration are untouched, just unreachable from
          // the UI for now so App Review doesn't see an empty paywall.
        />
      )}

      {showDeleteConfirm && (
        <Modal
          title={`Delete ${petName}?`}
          onClose={() => (deleting ? null : setShowDeleteConfirm(false))}
        >
          <p>
            This will permanently delete {petName} and all their data. This cannot be undone.
          </p>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Btn>
            <Btn type="button" variant="danger" onClick={handleDeletePet} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Btn>
          </div>
        </Modal>
      )}

      {showDeleteAccountConfirm && (
        <Modal
          title="Delete Account?"
          onClose={() => (deletingAccount ? null : setShowDeleteAccountConfirm(false))}
        >
          <p>
            This will permanently delete your account and all associated data. This cannot be undone.
          </p>
          {deleteAccountError && <p className="form-error" role="alert">{deleteAccountError}</p>}
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setShowDeleteAccountConfirm(false)} disabled={deletingAccount}>
              Cancel
            </Btn>
            <Btn type="button" variant="danger" onClick={handleDeleteAccount} disabled={deletingAccount}>
              {deletingAccount ? 'Deleting…' : 'Delete Account'}
            </Btn>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  )
}

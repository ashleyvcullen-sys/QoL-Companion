import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Camera, Heart, HeartHandshake, Lock, LogOut, Pill, Scale, Stethoscope, TrendingUp } from 'lucide-react'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { supabase } from '../lib/supabase'
import { HOME_TOUR_MESSAGES } from '../lib/homeTourContent'
import { cancelQolReminder } from '../lib/notifications'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeTour from '../components/HomeTour'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import Footer from '../components/Footer'
import PetSwitcher from '../components/PetSwitcher'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'

// Grouped rather than one flat grid. Thirteen equal tiles gave no hint of
// what belongs together or what to do first; two labelled groups let the eye
// skip straight to the half of the screen it needs.
//
// Four things left the grid entirely because they were never features:
//   About and Schedule    -> secondary links at the foot of the screen
//   Add Another Pet       -> the pet switcher, which is the control for pets
//   Export Report         -> a button on Trends, which is the data it exports
const NAV_SECTIONS = [
  {
    title: 'Monitor',
    items: [
      // Free, and staying free. The assessment, the score and the trends are
      // what somebody uses while deciding whether their animal is suffering.
      { to: '/assessment', label: 'Overall Quality of Life Assessment', Icon: Heart },
      { to: '/trends', label: 'Trends', Icon: TrendingUp },
      // `premium` locks the tile and sends a tap to the paywall. `feature`
      // is the phrase the paywall headline uses, so someone who tapped
      // Medications is answered about medications rather than being handed a
      // generic pitch.
      { to: '/body-condition', label: 'Body Condition / Weight', Icon: Scale, premium: true, feature: 'Track body condition and weight' },
      { to: '/medications', label: 'Medications', Icon: Pill, premium: true, feature: 'Track medications' },
      { to: '/conditions', label: 'Disease-Specific Monitoring', Icon: Stethoscope, premium: true, feature: 'Monitor a diagnosed condition' },
      { to: '/media', label: 'Photos & Videos', Icon: Camera, premium: true, feature: 'Save photos and videos' },
    ],
  },
  {
    title: 'Support',
    items: [
      // Emergencies first, deliberately. Someone reaching for this section
      // in a hurry should not have to read past two other tiles to find it.
      { to: '/emergencies', label: 'Emergencies', Icon: AlertTriangle },
      { to: '/home-care-tips', label: 'Home Care Tips', Icon: HomeCareTipsIcon },
      { to: '/end-of-life', label: 'End of Life', Icon: HeartHandshake },
      // Promoted from a quiet link at the foot of the page. Reminders are
      // what make a daily habit stick, so burying them under "About" was
      // working against the thing the app is for.
      { to: '/schedule', label: 'Reminders', Icon: Bell },
    ],
  },
]

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

export default function Home() {
  const { visiblePets, hiddenPetCount, refresh, selectedPet, selectPet } = usePets()
  const { hasPremium } = useEntitlements()
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

    // Work out the replacement *before* refreshing, while the list still
    // includes the one just deleted.
    //
    // From visiblePets, not pets: the full list contains pets hidden by a
    // lapsed subscription, and selecting one of those would point the whole
    // app at a pet the database will refuse to return anything for.
    const remaining = visiblePets.filter((p) => p.id !== pet.id)

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
        <SectionTitle>{pet ? `${petName}'s Quality of Life Companion` : 'Your Quality of Life Companion'}</SectionTitle>
        {/* One line, not two. The credit is folded into the subtext rather
            than stacked above it — who made it and what it is for are the
            same sentence, and two lines of supporting text under one heading
            read as a preamble nobody finishes. */}
        <p className="home-subtitle">
          Designed by a vet to help you follow {petName}'s quality of life.
        </p>
        <PetSwitcher />

        {/* Only ever a statement of fact plus a reassurance. No upgrade
            button: someone who has just lost access does not need to be
            sold to in the same breath, and the records being safe is the
            thing they actually want to know. */}
        {hiddenPetCount > 0 && (
          <p className="pets-hidden-notice" role="status">
            {hiddenPetCount} pet {hiddenPetCount === 1 ? 'profile is' : 'profiles are'} hidden
            on the free plan. Your records are saved and will return if you resubscribe.
          </p>
        )}
      </Card>

      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="nav-section">
          <span className="nav-section-title">{section.title}</span>
          <div className="icon-grid">
            {section.items.map(({ to, label, Icon, premium, feature }) => {
              const locked = premium && !hasPremium

              // Locked tiles stay legible on purpose. Someone has to be able
              // to see what the feature IS — not merely that something is
              // withheld — or the lock is just a closed door with no sign on
              // it. Icon and label keep full contrast; only the surface dims.
              const tile = (
                <Card className={`icon-tile ${locked ? 'icon-tile-locked' : ''}`.trim()}>
                  <span className="icon-badge">
                    <Icon size={22} strokeWidth={2} color="#fff" />
                  </span>
                  <span className="icon-tile-label">{label}</span>
                  {locked && (
                    // aria-hidden because the state is already carried by the
                    // button's own label — a screen reader announcing "lock
                    // image" after "premium feature, locked" is noise.
                    <span className="icon-tile-lock" aria-hidden="true">
                      <Lock size={12} strokeWidth={2.5} />
                    </span>
                  )}
                </Card>
              )

              // A real <button> rather than a dimmed Link. Reduced opacity is
              // invisible to VoiceOver, so the lock has to be in the
              // accessible name or the tile simply reads as "Medications" and
              // the user is left wondering why tapping it changed the screen
              // to a sales page.
              return locked ? (
                <button
                  key={to}
                  type="button"
                  ref={(el) => { tileRefs.current[to] = el }}
                  className="icon-tile-link"
                  aria-label={`${label}, premium feature, locked`}
                  onClick={() => navigate('/paywall', { state: { feature } })}
                >
                  {tile}
                </button>
              ) : (
                <Link
                  key={to}
                  to={to}
                  ref={(el) => { tileRefs.current[to] = el }}
                  className="icon-tile-link"
                >
                  {tile}
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {/* Not features, so not tiles. Kept reachable but quiet. */}
      <div className="home-secondary-links">
        <Link to="/about" className="subtle-link">About</Link>
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

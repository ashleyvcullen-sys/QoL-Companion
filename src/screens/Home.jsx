import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Camera, Heart, HeartHandshake, Lock, Pill, Scale, Stethoscope, TrendingUp } from 'lucide-react'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { supabase } from '../lib/supabase'
import { HOME_TOUR_MESSAGES } from '../lib/homeTourContent'
import { petPossessive } from '../lib/petText'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeTour from '../components/HomeTour'
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
      { to: '/body-condition', label: 'Body Condition / Weight', Icon: Scale, premium: true, feature: 'bcs' },
      { to: '/medications', label: 'Medications', Icon: Pill, premium: true, feature: 'medications' },
      { to: '/conditions', label: 'Disease-Specific Monitoring', Icon: Stethoscope, premium: true, feature: 'conditions' },
      { to: '/media', label: 'Photos & Videos', Icon: Camera, premium: true, feature: 'media' },
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
  const { refresh, selectedPet } = usePets()
  const { hasPremium } = useEntitlements()
  const pet = selectedPet
  const petName = pet?.name || 'your pet'
  const navigate = useNavigate()
  const location = useLocation()

  const [showTour, setShowTour] = useState(false)
  const autoTourShownRef = useRef(false)
  const tileRefs = useRef({})

  // `premium` rides along from the same tile definitions that lock the grid,
  // so the tour cannot disagree with the tiles about which features are paid
  // — and adding a premium feature marks its tour step automatically.
  // Gated on !hasPremium exactly as the tiles are: a subscriber has these.
  const tourSteps = NAV_ITEMS.map(({ to, label, premium }) => ({
    to,
    label,
    premium: Boolean(premium) && !hasPremium,
    message: HOME_TOUR_MESSAGES[to],
  }))

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
          Developed by a veterinarian to help you monitor {petPossessive(pet)} quality
          of life, every step of the way.
        </p>
        <PetSwitcher />

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

      {/* Not features, so not tiles. Kept reachable but quiet.
          Settings holds the plan, sign out and the two irreversible
          deletes, which used to sit loose at the foot of this screen. */}
      <div className="home-secondary-links">
        <Link to="/about" className="subtle-link">About</Link>
        <Link to="/settings" className="subtle-link">Settings</Link>
      </div>

      {showTour && (
        <HomeTour steps={tourSteps} targetRefs={tileRefs} onFinish={completeTour} />
      )}

      <Footer />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Camera, CircleQuestionMark, Heart, HeartHandshake, Lock, Pill, Scale, Stethoscope, TrendingUp } from 'lucide-react'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { supabase } from '../lib/supabase'
import { HOME_TOUR_MESSAGES } from '../lib/homeTourContent'
import Card from '../components/Card'
import HomeTour from '../components/HomeTour'
import Footer from '../components/Footer'
import PetSummaryCard from '../components/PetSummaryCard'
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
      // A tile rather than a link under the grid. It was the last thing left
      // in the secondary row, and one lonely underlined word beneath a grid
      // of tiles reads as leftover rather than as a choice.
      { to: '/about', label: 'About', Icon: CircleQuestionMark },
    ],
  },
]

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

export default function Home() {
  const { refresh, selectedPet } = usePets()
  const { hasPremium } = useEntitlements()
  const pet = selectedPet
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
      {/* The header card — logo, "{name}'s Quality of Life Companion", the
          vet credit and the pet switcher — was removed on 29 Aug 2026 when
          the summary card below took its title. Two cards saying the pet's
          name, one above the other, is not a header and a summary; it is the
          same heading twice.

          The logo went with it. It opens the welcome flow, where it is doing
          brand work on a screen with nothing else to say; here it sat above
          the fold on every visit, in front of the thing the owner came for,
          and the pet's own photo identifies this record better than a generic
          mark of ours does. */}
      {/* How {name} actually is, above the ten ways of finding out.
          The screen carried nothing but branding and navigation until 29 Aug
          2026 — the same view for an owner with a year of entries as for one
          who signed up a minute ago. */}
      <PetSummaryCard />

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

      {showTour && (
        <HomeTour steps={tourSteps} targetRefs={tileRefs} onFinish={completeTour} />
      )}

      <Footer />
    </div>
  )
}

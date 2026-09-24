import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Aperture, Camera, ChevronRight, CircleQuestionMark, Compass, FileText,
  Globe, HeartHandshake, Lock, Mail, Pill, Settings, Stethoscope, Upload, Weight,
} from 'lucide-react'
import { useState } from 'react'
import IntroModal from '../components/IntroModal'
import { useEntitlements } from '../lib/EntitlementsContext'
import { usePets } from '../lib/PetsContext'
import { openExternal, INSTAGRAM_URL, SUPPORT_EMAIL, WEBSITE_URL } from '../lib/openExternal'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'

// Everything that is not Home, Assess or Trends.
//
// Built for the bottom tab bar (Sep 2026). Home carried thirteen tiles and a
// six-link footer bar, which is a menu pretending to be a dashboard: the one
// thing an owner opens the app to see — how their animal is today — was
// below a screenful of navigation. The tiles that are not daily reading live
// here, one tap from anywhere, and the footer bar comes off entirely.
//
// Rows rather than tiles. A tile grid reads as "pick one of these"; this is
// a menu, and a menu is a list.
//
// `blurb` is the sentence that used to open the destination screen, moved
// here on Ash's instruction, 24 Sep 2026: tapping a row shows the title and
// that sentence, and the owner decides whether to go. The screen keeps its
// title and loses the sentence, so it is said once rather than twice.
//
// Rows without one — the external links, Take the Tour, and the locked rows
// that lead to the paywall rather than to a screen — navigate straight away.
// A confirmation over "Follow Us on Instagram" would be asking permission to
// ask permission.
const SECTIONS = [
  {
    key: 'pet',
    // Untitled — Ash's instruction 24 Sep 2026. It was headed with the pet's
    // name, which on a premium account leaves a name over a group that has
    // emptied out to nothing (every paid row moved to the Assess tab) and on
    // a free one labels four locked rows with the animal they are locked
    // for. The rows say what they are.
    items: [
      // Disease-Specific Monitoring is on the Assess tab — Ash's instruction
      // 23 Sep 2026. Same rule as Medications: on a FREE account the locked
      // row stays, because it is the only way the feature can be found and
      // the only way to its paywall.
      { to: '/conditions', label: 'Disease-Specific Monitoring', Icon: Stethoscope, premium: true, feature: 'conditions', freeOnly: true },
      // Medications are a tab of their own on premium — Ash's instruction
      // 23 Sep 2026 — so the row here would be a second way in to the same
      // daily task. On a FREE account there is no tab, and this locked row is
      // the only way the feature can still be found, and the only way to the
      // paywall for it. Hence `freeOnly`.
      { to: '/medications', label: 'Medications', Icon: Pill, premium: true, feature: 'medications', freeOnly: true },
      // A weighing scale rather than lucide's Scale, which is the balanced
      // scales of justice — Ash, 23 Sep 2026.
      //
      // `freeOnly`, like every paid row here: on premium these all live on
      // the Assess tab, and a second way in to a daily task is one too many.
      // On a free account the locked row is the only way the feature can be
      // found and the only route to its paywall — Ash's instruction
      // 24 Sep 2026.
      { to: '/body-condition', label: 'Body Condition / Weight', Icon: Weight, premium: true, feature: 'bcs', freeOnly: true },
      { to: '/media', label: 'Photos & Videos', Icon: Camera, premium: true, feature: 'media', freeOnly: true },
      // Reminders moved into Account Management and Settings — Ash's
      // instruction 24 Sep 2026. How often the app asks you for something is
      // a setting, and it now sits with the rest of them rather than beside
      // the screens it schedules.
      { to: '/export-report', label: 'Export Report', Icon: Upload, freeOnly: true },
    ],
  },
  {
    key: 'guidance',
    title: 'Guidance',
    items: [
      {
        to: '/home-care-tips',
        label: 'Home Care Tips',
        Icon: HomeCareTipsIcon,
        blurb: "Practical things you can do at home to help your pet's quality of life.",
      },
      {
        to: '/end-of-life',
        label: 'End of Life',
        Icon: HeartHandshake,
        blurb: "A gentle, practical reference for one of the hardest parts of caring for an animal — written to be read whenever it's useful, not just at the end.",
      },
      {
        to: '/emergencies',
        label: 'Emergencies',
        Icon: AlertTriangle,
        blurb: "Signs that mean 'go now', not 'monitor and see'.",
      },
      {
        to: '/about',
        label: 'About',
        Icon: CircleQuestionMark,
        blurb: 'Learn more about the app, or revisit this tour anytime.',
      },
      // Same destination the footer's link had: Home, told to start the
      // tour. This one DOES ask first — Ash's instruction 24 Sep 2026 — since
      // it is the one row that starts something rather than opening
      // somewhere, and it takes over the screen for four steps.
      //
      // Its blurb — APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026.
      {
        to: '/',
        label: 'Take the Tour',
        Icon: Compass,
        state: { startTour: true },
        blurb: 'A quick walk through the app, and where to find things.',
      },
    ],
  },
  {
    key: 'account',
    title: 'Account',
    items: [
      // No blurb on either of these — Ash's instruction 24 Sep 2026. An
      // owner tapping Settings or Legal knows what they are for and is on
      // their way to do something; a sentence explaining the room before
      // opening the door is only useful where the room is a surprise.
      { to: '/settings', label: 'Account Management and Settings', Icon: Settings },
      { to: '/legal', label: 'Privacy, Data & Legal', Icon: FileText },
      { external: INSTAGRAM_URL, label: 'Follow Us on Instagram', Icon: Aperture },
      { external: WEBSITE_URL, label: 'Visit Our Website', Icon: Globe },
      { href: `mailto:${SUPPORT_EMAIL}`, label: 'Email Us', Icon: Mail },
    ],
  },
]

export default function More() {
  const navigate = useNavigate()
  const { hasPremium } = useEntitlements()
  // Only for the pop-up, which fills {name} / {they} / {their} into the
  // destination's sentence the same way Assess does.
  const { selectedPet } = usePets()
  // The row a tap is asking about, if any.
  const [asking, setAsking] = useState(null)

  return (
    <div className="screen">
      <h2 className="section-title more-title">More</h2>

      {SECTIONS.map((section) => (
        <div key={section.key}>
          {section.title && <span className="nav-section-title">{section.title}</span>}
          <div className="more-list">
            {section.items.filter((item) => !(item.freeOnly && hasPremium)).map((item) => {
              const { label, Icon } = item
              const locked = item.premium && !hasPremium

              const inner = (
                <>
                  <span className="more-row-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="more-row-label">{label}</span>
                  {locked && (
                    <span className="more-row-lock" aria-hidden="true">
                      <Lock size={12} strokeWidth={2.5} />
                    </span>
                  )}
                  <ChevronRight className="more-row-chev" size={18} aria-hidden="true" />
                </>
              )

              // A locked row is a button that goes to the paywall carrying the
              // feature it was asked about, exactly as the home tiles did —
              // and it says so in its accessible name, because a lock glyph
              // alone is invisible to VoiceOver.
              if (locked) {
                return (
                  <button
                    key={label}
                    type="button"
                    className="more-row"
                    aria-label={`${label}, premium feature, locked`}
                    onClick={() => navigate('/paywall', { state: { feature: item.feature } })}
                  >
                    {inner}
                  </button>
                )
              }

              if (item.external) {
                return (
                  <button key={label} type="button" className="more-row" onClick={() => openExternal(item.external)}>
                    {inner}
                  </button>
                )
              }

              if (item.href) {
                return (
                  <a key={label} href={item.href} className="more-row">
                    {inner}
                  </a>
                )
              }

              return (
                <button
                  key={label}
                  type="button"
                  className="more-row"
                  onClick={() => {
                    if (item.blurb) setAsking(item)
                    else navigate(item.to, item.state ? { state: item.state } : undefined)
                  }}
                >
                  {inner}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* One pop-up component across the app — see IntroModal. */}
      {asking && (
        <IntroModal
          title={asking.label}
          body={asking.blurb}
          pet={selectedPet}
          onBack={() => setAsking(null)}
          onNext={() => {
            const { to, state } = asking
            setAsking(null)
            navigate(to, state ? { state } : undefined)
          }}
        />
      )}

    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, Heart, Lock, Stethoscope, Weight } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import { useState } from 'react'
import IntroModal from '../components/IntroModal'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { useDueToday } from '../lib/useDueToday'

// Everything an owner records, on one screen.
//
// This was a sheet over whatever screen the Assess tab was tapped from —
// Ash's instruction 24 Sep 2026 makes it a screen of its own. A modal is for
// a question that interrupts something; choosing what to record is the task
// itself, and a task deserves a page: it can be scrolled, linked to, returned
// to with the back control, and it leaves the app in a place rather than in a
// state.
//
// Both tiers land here — Ash's instruction 24 Sep 2026. A free account used
// to be sent straight to the assessment, so the other three rows were
// invisible to it: nothing in the app said disease monitoring, weight or
// photos existed. They are listed for everyone now, with a lock on the three
// that are paid, and tapping one goes to the paywall carrying its name.
const ROWS = [
  {
    to: '/assessment',
    label: 'Overall Quality of Life Assessment',
    Icon: Heart,
    due: (state) => state.assessmentDue,
  },
  {
    to: '/conditions',
    label: 'Disease-Specific Monitoring',
    Icon: Stethoscope,
    premium: true,
    feature: 'conditions',
    due: (state) => state.dueConditionKeys.length > 0,
    // Moved off the Conditions screen on Ash's instruction 24 Sep 2026, the
    // same way the two below were: the sentence that says what a screen is
    // for belongs at the choice, not above the list you have already chosen.
    blurb: 'Track the things that matter for a condition {name} has been diagnosed with, alongside {their} Overall Quality of Life Assessments.',
  },
  // Weight and body condition are recorded on the same rhythm as everything
  // else here, so they belong in the same list.
  //
  // `blurb` is the sentence that used to open each screen, moved here on
  // Ash's instruction 24 Sep 2026 — the same rule the More screen follows:
  // said once, where the choice is made, rather than at the top of a form the
  // owner has already committed to.
  //
  // {name}, {they} and {their} are filled by PetText where the modal renders
  // them: the list is built once at module level and the pet is not known
  // until the screen does.
  {
    to: '/body-condition',
    label: 'Body Condition / Weight',
    Icon: Weight,
    premium: true,
    feature: 'bcs',
    // Ash's instruction 24 Sep 2026: the pop-up says what the scale IS and
    // stops there. "Then pick the description that fits best" was telling an
    // owner how to use a screen they had not opened yet, and the screen
    // itself says it at the moment it applies.
    blurb: 'A 9-point scale for how much body fat {name} is carrying. Feel the ribs, look from above for a waist, and look from the side for an abdominal tuck.',
  },
  // A wound photographed weekly is a measurement.
  {
    to: '/media',
    label: 'Photos & Videos',
    Icon: Camera,
    premium: true,
    feature: 'media',
    blurb: "Keep a visual record of how {name} is doing. A photo of a wound, a rash or {their} posture — or a short clip of how {they} are walking or breathing.",
  },
]

export default function Assess() {
  const navigate = useNavigate()
  const { selectedPet } = usePets()
  const { hasPremium } = useEntitlements()
  const due = useDueToday(selectedPet, { includeConditions: hasPremium })
  // The row a tap is asking about, if any.
  const [asking, setAsking] = useState(null)

  return (
    <div className="screen">
      <Card>
        {/* APPROVED — Dr Ash Cullen (BSc, DVM), 23 Sep 2026, as the sheet's
            title; the sheet became this screen on 24 Sep 2026. */}
        <SectionTitle>What Would You Like to Record?</SectionTitle>
        {/* APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. The whole blurb.
            
            Warmer, on Ash's instruction 24 Sep 2026. The change that matters
            is the middle clause: an owner who has not spotted a slow decline
            has not failed at anything, and a screen asking them to record
            more should say so before it asks. The rest is the same point —
            small impressions, gathered, become something a vet can use. */}
        <p>
          Seeing {selectedPet?.name ?? 'your pet'} every day is exactly what makes a slow
          change so hard to notice — it isn&rsquo;t something you&rsquo;ve missed. Checking in
          regularly gathers those small moments into a picture you can look back on, and one
          your vet can work from.
        </p>
      </Card>

      <div className="more-list">
        {ROWS.map((row) => {
          const { to, label, Icon, due: isDue, blurb } = row
          const locked = row.premium && !hasPremium
          return (
          <button
            key={to}
            type="button"
            className="more-row"
            aria-label={locked ? `${label}, premium feature, locked` : undefined}
            onClick={() => {
              // A locked row goes to the paywall carrying the feature it was
              // asked about — the same route the More screen's locked rows
              // take, so the paywall can name what was tapped.
              if (locked) navigate('/paywall', { state: { feature: row.feature } })
              else if (blurb) setAsking(row)
              else navigate(to)
            }}
          >
            <span className="more-row-icon" aria-hidden="true"><Icon size={18} /></span>
            <span className="more-row-label">{label}</span>
            {/* The same fact the dot on the tab carries, said in a word now
                that there is room for one. Never on a locked row: nothing is
                owed on a feature this account does not have. */}
            {!locked && isDue?.(due) && <span className="more-row-due">Due</span>}
            {locked && (
              <span className="more-row-lock" aria-hidden="true">
                <Lock size={12} strokeWidth={2.5} />
              </span>
            )}
            <ChevronRight className="more-row-chev" size={18} aria-hidden="true" />
          </button>
          )
        })}
      </div>

      {/* One pop-up component across the app — see IntroModal. */}
      {asking && (
        <IntroModal
          title={asking.label}
          body={asking.blurb}
          pet={selectedPet}
          onBack={() => setAsking(null)}
          onNext={() => {
            const { to } = asking
            setAsking(null)
            navigate(to)
          }}
        />
      )}

    </div>
  )
}

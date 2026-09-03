import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, Heart, Stethoscope } from 'lucide-react'
import Btn from './Btn'
import Card from './Card'
import PetSwitcher from './PetSwitcher'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { todayIsoDate, useAllConditionEntries, usePetConditions } from '../lib/conditionsData'
import { CONDITION_LIST, conditionByKey } from '../lib/conditions'
import { computeGeneralQolResult, computeOverviewCategories } from '../lib/scoring'
import OverviewBars from './OverviewBars'
import { WELLBEING_CONCEPTS } from './WellbeingConcepts'
import { MONITORING_STATE, monitoringStatus } from '../lib/monitoringStatus'
import { formatDateDDMMYYYY } from '../lib/formatDate'

// What the home screen says about this pet, before any navigation.
//
// The screen carried no live data at all until 29 Aug 2026: an owner with a
// year of entries saw the same logo, title and ten tiles as one who had signed
// up thirty seconds earlier. Everything the app knew about the animal was two
// taps away, which is a poor trade for the one screen an owner opens most.
//
// Two halves, each answering the same three questions about its own thing:
//
//   How is {name}?     the last assessment, as a score and a direction
//   What do I owe?     due, overdue, or up to date
//   Where do I go?     one button, sized like a decision
//
// Every number here is computed by the same functions the rest of the app
// uses — computeGeneralQolResult, monitoringStatus — so this card cannot
// disagree with the screen it links to.

// The assessment's own cadence lives on the pet, not on a condition
// definition, so it is wrapped to look like one for monitoringStatus.
function assessmentCadence(pet) {
  return { key: 'qol', cadence: { days: pet?.schedule?.qol ?? pet?.schedule?.general ?? 7 } }
}

export default function PetSummaryCard() {
  const { selectedPet: pet } = usePets()
  const navigate = useNavigate()
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)
  const { conditions } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)
  const today = todayIsoDate()

  const latestGeneral = generalEntries[generalEntries.length - 1] ?? null
  const previousGeneral = generalEntries[generalEntries.length - 2] ?? null

  // Belt and braces on top of the defaults in mapGeneralQolRow.
  //
  // This card is the first thing rendered on launch, so anything it throws
  // takes the whole app down before the owner can reach a single screen. A
  // row this cannot score is worth losing a number over; it is not worth
  // losing the app over.
  const resultFor = (entry) => {
    if (!entry) return null
    try {
      const pain = painEntries.find((row) => row.date === entry.date) ?? null
      return computeGeneralQolResult(entry, pain?.beap)
    } catch (error) {
      console.error('Could not score that assessment:', error.message)
      return null
    }
  }
  const latest = resultFor(latestGeneral)
  const previous = resultFor(previousGeneral)
  const change = latest && previous ? latest.percent - previous.percent : null

  // The five pillars, on the home screen rather than one screen in.
  //
  // Ash's instruction, 29 Aug 2026: this is what the app is built around, and
  // it was the one thing an owner had to go looking for. The single
  // percentage says how {name} is; these say WHICH part of them — a 78%
  // carried by a comfort score of 40 is a different animal to a 78% that is
  // even across the five, and only one of those needs doing something about
  // today.
  //
  // The same computeOverviewCategories the Trends screen uses, so the two
  // cannot disagree. Compact variant: five labelled bars have to sit under a
  // score without becoming the card.
  const overview = useMemo(() => {
    if (!latestGeneral) return null
    const pain = painEntries.find((row) => row.date === latestGeneral.date) ?? null
    try {
      return computeOverviewCategories(latestGeneral, pain)
    } catch (error) {
      console.error('Could not build the pillar overview:', error.message)
      return null
    }
  }, [latestGeneral, painEntries])

  // Everything due, assessment first. A condition whose reminder is off, or
  // that has never been logged, is not "due" — one has no schedule to be
  // measured against and the other has no last date to measure from.
  const due = useMemo(() => {
    if (!pet) return []
    const out = []

    const qol = monitoringStatus({
      definition: assessmentCadence(pet),
      schedule: null,
      lastDate: latestGeneral?.date ?? null,
      today,
    })
    if (qol.state === MONITORING_STATE.DUE) {
      out.push({ key: 'qol', label: 'Quality of life assessment', overdueBy: qol.overdueBy, to: '/assessment' })
    }

    for (const row of conditions) {
      const definition = conditionByKey(row.conditionKey)
      if (!definition) continue
      const entries = byCondition[row.conditionKey] ?? []
      const status = monitoringStatus({
        definition,
        schedule: pet.schedule,
        lastDate: entries[entries.length - 1]?.date ?? null,
        today,
      })
      if (status.state !== MONITORING_STATE.DUE) continue
      out.push({
        key: row.conditionKey,
        label: definition.label,
        overdueBy: status.overdueBy,
        to: `/conditions/${row.conditionKey}`,
      })
    }
    return out
  }, [pet, conditions, byCondition, latestGeneral, today])

  if (!pet) return null

  const tracked = CONDITION_LIST.filter(
    (definition) => conditions.some((row) => row.conditionKey === definition.key),
  )
  const trackedCount = tracked.length

  // The heading names what {name} actually has, on Ash's instruction 29 Aug
  // 2026 — "Allergies and Skin Disease Monitoring", not "Disease-Specific
  // Monitoring". An owner monitoring one condition is thinking about that
  // condition, and a category name makes them translate before they read
  // anything.
  //
  // The condition's FULL label, the same name its own page and its tile use.
  // A shortened form was tried first and Ash's call is against it: a heading
  // here and a different heading on the page it opens are two names for one
  // thing, and the owner has to work out that they match. Wrapping to two
  // lines costs less than that.
  //
  // Two or more falls back to a category, because listing them runs to three
  // lines and none of them is the heading; none tracked falls back to the
  // category too, since there is nothing to name yet.
  const diseaseHeading = trackedCount === 1
    ? `${tracked[0].label} Monitoring`
    : trackedCount > 1
      ? 'Condition Monitoring'
      : 'Disease-Specific Monitoring'

  // One condition means the button can go straight to it rather than to a
  // list with one thing on it.
  const diseaseTarget = trackedCount === 1 ? `/conditions/${tracked[0].key}` : '/conditions'

  // The condition's own organ icon where exactly one is tracked, so the
  // heading is recognisable before it is read — it is the same mark that
  // labels the condition on its tile and on its own page. Two or more, or
  // none, falls back to the stethoscope the home tile uses for the section.
  const DiseaseIcon = trackedCount === 1 && tracked[0].Icon
    ? tracked[0].Icon
    : Stethoscope

  // The two halves are split apart rather than pooled, on Ash's instruction
  // 29 Aug 2026. They answer different questions and the app treats them
  // differently — one is a whole-animal score across the same questions every
  // time, the other is a set of signs specific to a diagnosis — and a single
  // merged list of "things due" quietly taught the owner they were the same
  // kind of thing.
  const qolDue = due.find((item) => item.key === 'qol') ?? null
  const conditionsDue = due.filter((item) => item.key !== 'qol')
  // The worst of them, for the note's wording. Zero means "due today" rather
  // than late, which is deliberately not the same news.
  const diseaseOverdueBy = conditionsDue.reduce(
    (worst, item) => Math.max(worst, item.overdueBy ?? 0),
    0,
  )

  return (
    <Card className="pet-summary">
      <div className="pet-summary-head">
        {/* The brand mark in the top slot, where the pet's photo was —
            Ash's call, 29 Aug 2026, after trying it above the photo and again
            under the title. The pet is named in the line beneath it, so the
            circle above does not also have to identify them. */}
        <img
          src="/images/logo.png"
          alt="Dog and cat, nose to nose, forming a heart"
          className="pet-summary-logo"
        />

        <div className="pet-summary-identity">
          {/* The landing title, on Ash's instruction 29 Aug 2026 — and
              "QoL Companion" rather than "Quality of Life Companion", which
              is the short form the rest of this card now uses. */}
          <h2 className="pet-summary-name">{pet.name}&apos;s QoL Companion</h2>

          <p className="pet-summary-meta">
            {loading ? 'Loading…' : trackedCount > 0
              ? `${trackedCount} condition${trackedCount === 1 ? '' : 's'} monitored`
              : 'No conditions monitored'}
          </p>
        </div>

        {/* The switcher moved here with the title, 29 Aug 2026. It belongs
            with the pet it switches, and leaving it behind in a header card
            that no longer said anything would have kept that card alive for
            one control. */}
        <PetSwitcher />
      </div>

      {/* --- Overall quality of life ------------------------------------ */}
      <section className="pet-summary-section">
        <div className="pet-summary-section-head">
          <div>
            {/* No subtext here, on Ash's instruction 29 Aug 2026. The
                score, the band and the pillars under it say what this is
                better than a sentence describing it does — and the disease
                half keeps its line because that one is genuinely not
                self-evident. */}
            {/* "Overall QoL", to match "Bailey's 5 QoL Pillars" below it.
                The ring's aria-label keeps the words in full — a screen
                reader says "Q O L", which is not what an owner would hear a
                vet say. */}
            {/* The same heart the home screen's assessment tile carries, so
                the two are recognisably the same thing. */}
            <h3 className="pet-summary-section-title">
              <span className="pet-summary-section-icon" aria-hidden="true">
                <Heart size={16} />
              </span>
              Overall QoL Monitoring
            </h3>
          </div>
        </div>

        {/* Centred, on Ash's instruction 29 Aug 2026, and larger for it.
            This is the app's central number — tucked into the top-right
            corner of a heading row it read as a badge on the title rather
            than as the thing the screen is about. */}
        {latest ? (
          <div className="pet-summary-score">
            <ScoreRing percent={latest.percent} colour={latest.color} size={92} />
            <p className="pet-summary-band" style={{ color: latest.color }}>
              {latest.band}
            </p>
            <p className="pet-summary-change">
              {change == null
                ? formatDateDDMMYYYY(latestGeneral.date)
                : change === 0
                  ? 'Unchanged since last time'
                  : `${Math.abs(change)} points ${change > 0 ? 'higher' : 'lower'} than last time`}
            </p>
          </div>
        ) : (
          <p className="pet-summary-empty">
            No assessment yet. The first one is what everything else is measured against.
          </p>
        )}

        {overview && <PillarSummary petName={pet.name} overview={overview} />}

        {/* Said in words, with the mark the rest of the card uses for
            something needing attention.
            //
            A bare red "3 days late" under a score told an owner a number
            without telling them what was late or what to do about it — and it
            sat directly above a button whose own label had stopped being
            true, since "start today's assessment" is not what someone three
            days behind is being asked for.

            PENDING ASH — wording. */}
        {qolDue ? (
          <p className={`pet-summary-duenote ${qolDue.overdueBy > 0 ? 'late' : ''}`.trim()}>
            <AlertTriangle size={14} />
            {qolDue.overdueBy > 0
              ? `This assessment is ${qolDue.overdueBy} day${qolDue.overdueBy === 1 ? '' : 's'} overdue`
              : 'This assessment is due today'}
          </p>
        ) : latestGeneral && (
          /* The other half of the same sentence. A screen that only speaks up
             when you are behind teaches an owner that silence means nothing
             in particular — and keeping up is the behaviour this card exists
             to ask for, so it is worth saying out loud when they have. */
          <p className="pet-summary-clear">
            <Check size={14} /> Up to date
          </p>
        )}

        <Btn type="button" className="btn-block" onClick={() => navigate('/assessment')}>
          {!latestGeneral
            ? 'Start the first assessment'
            : qolDue
              ? 'Go to QoL Assessment'
              : 'Start today\'s assessment'}
        </Btn>
      </section>

      {/* --- Disease-specific monitoring --------------------------------- */}
      <section className="pet-summary-section">
        <div className="pet-summary-section-head">
          <div>
            <h3 className="pet-summary-section-title">
              <span className="pet-summary-section-icon" aria-hidden="true">
                <DiseaseIcon size={16} />
              </span>
              {diseaseHeading}
            </h3>
            {/* No subtext, on Ash's instruction 29 Aug 2026 — the same call
                as the assessment half. Naming the condition in the heading is
                what made the sentence redundant: "Allergies Monitoring" over
                a button reading "Go to Allergies monitoring" needs no third
                explanation of which condition it means. */}
          </div>
        </div>

        {/* The same note the assessment above uses, on Ash's instruction 29
            Aug 2026 — and nothing else.

            This half used to list flagged findings from the last week and a
            row per overdue condition. Both were pointers to the same page the
            button already goes to, and between them they took more of the
            card than the score it sits under. The one thing an owner needs
            from a home screen is whether they owe an entry; the findings are
            on the page they land on, in the calendar built to show them.

            PENDING ASH — wording, matched to the assessment's. */}
        {conditionsDue.length > 0 ? (
          <p className={`pet-summary-duenote ${diseaseOverdueBy > 0 ? 'late' : ''}`.trim()}>
            <AlertTriangle size={14} />
            {conditionsDue.length > 1
              ? `${conditionsDue.length} assessments are due`
              : diseaseOverdueBy > 0
                ? `This assessment is ${diseaseOverdueBy} day${diseaseOverdueBy === 1 ? '' : 's'} overdue`
                : 'This assessment is due today'}
          </p>
        ) : trackedCount > 0 && (
          <p className="pet-summary-clear">
            <Check size={14} /> Up to date
          </p>
        )}

        <Btn
          type="button"
          variant="outline"
          className="btn-block"
          onClick={() => navigate(diseaseTarget)}
        >
          {/* No "monitoring" on the end: the heading immediately above
              already says it, and "Go to Allergies and Skin Disease
              monitoring" is a mouthful of a button. */}
          {trackedCount === 1
            ? `Go to ${tracked[0].label}`
            : trackedCount > 1
              ? 'Go to condition monitoring'
              : 'Set up disease monitoring'}
        </Btn>
      </section>
    </Card>
  )
}

// The five pillars, behind an expandable heading.
//
// They belong on this screen — they are what the app is built around — but
// five labelled bars is five lines, and expanded by default they pushed the
// whole disease-monitoring half of this card below the fold on a phone.
//
// A heading and nothing else, on Ash's instruction 29 Aug 2026. An earlier
// version put five severity-coloured dots and the weakest pillar named
// beside it, on the reasoning that a collapsed row should still say
// something. Her call is that the score above already says how {name} is,
// and that a row of dots an owner has to decode earns less than the words
// that tell them plainly what is behind it.
function PillarSummary({ petName, overview }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  return (
    <div className="pet-summary-pillars">
      <button
        type="button"
        className="pet-summary-pillars-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {/* The chevron sits INSIDE the sentence rather than beside it.
            Centred and flexed, a two-line heading left the arrow stranded
            against the right edge of the card, level with the gap between the
            lines and reading as though it belonged to neither. Inline, it
            follows the last word wherever that word ends up.

            Points down when there is more to see and up once it is open, so
            the arrow describes the state rather than the action. */}
        <span>
          {petName}&apos;s 5 QoL Pillars
          <ChevronDown
            size={15}
            className={`expandable-note-chevron ${open ? 'is-open' : ''}`.trim()}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* `hidden` rather than unmounting, so the relationship the button
          points at with aria-controls exists whether or not it is open —
          the same rule ExpandableNote follows. */}
      <div id={bodyId} className="pet-summary-pillars-body" hidden={!open}>
        <OverviewBars concepts={WELLBEING_CONCEPTS} overview={overview} compact />
      </div>
    </div>
  )
}

// The score, as a ring rather than a number on its own.
//
// A number says 68%; a ring says 68% of what, at a glance and without being
// read. Drawn rather than charted — one circle needs no library, and the
// chart library's smallest useful unit is heavier than this whole card.
function ScoreRing({ percent, colour, size = 64 }) {
  // Drawn in a fixed 64-unit viewBox and scaled by `size`, so the stroke and
  // the gap keep their proportions at any diameter rather than needing a
  // second set of numbers per size.
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const filled = Math.max(0, Math.min(100, percent)) / 100

  return (
    <span
      className="pet-summary-ring"
      role="img"
      aria-label={`Quality of life ${percent}%`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="pet-summary-ring-value" style={{ color: colour }}>{percent}%</span>
    </span>
  )
}

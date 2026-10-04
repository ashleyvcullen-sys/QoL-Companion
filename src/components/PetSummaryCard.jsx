import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, Minus, Pill, Stethoscope, TrendingDown, TrendingUp } from 'lucide-react'
import Btn from './Btn'
import Card from './Card'
import ScoreRing from './ScoreRing'
import PetSwitcher from './PetSwitcher'
import PetAvatar from './PetAvatar'
import ConditionIntroModal from './ConditionIntroModal'
import Modal from './Modal'
import PetText from './PetText'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { useEntitlements } from '../lib/EntitlementsContext'
import { MEDICATION_STATE, formatMedicationTime, medicationStatusToday, useMedications } from '../lib/medicationsData'
import { useBcsHistory } from '../lib/bcsData'
import { bodyConditionOn, qolInfluencesOn } from '../lib/qolInfluences'
import { todayIsoDate, useAllConditionEntries, usePetConditions } from '../lib/conditionsData'
import { CONDITION_LIST } from '../lib/conditions'
import { configsByCondition } from '../lib/charts'
import {
  BCS_MAX_AGE_DAYS,
  bodyConditionInfluence,
  computeGeneralQolResult,
  computeOverviewBreakdown,
  computeOverviewCategories,
  describePercentChange,
  severityColorFromPercent,
} from '../lib/scoring'
import { diseaseDaysByDate } from '../lib/diseaseDays'
import PillarBreakdownModal from './PillarBreakdownModal'
import DayAnswersModal from './DayAnswersModal'
import { describeAssessmentDay } from '../lib/assessmentSummary'
import { WELLBEING_CONCEPTS } from './WellbeingConcepts'
import { MONITORING_STATE, monitoringStatus } from '../lib/monitoringStatus'
import { formatDateDDMMYY, isoDaysAgo } from '../lib/formatDate'
import { conditionHistory } from '../lib/conditionHistory'
import { scheduleForCondition } from '../lib/cadence'
import { ConditionState, ConditionStrip } from './ConditionStrip'

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
  // The condition a tap is asking about, if any — see ConditionIntroModal.
  const [askingCondition, setAskingCondition] = useState(null)
  // Whether the owner has asked why today's score was capped.
  const [showCapReason, setShowCapReason] = useState(false)
  // Whether the owner has asked to read back the last check-in's answers.
  const [showLastAnswers, setShowLastAnswers] = useState(false)
  const navigate = useNavigate()
  const { hasPremium } = useEntitlements()
  // Doses, for the line below the conditions. Only for an account that can
  // open the screen it links to.
  const { medications, doses } = useMedications(hasPremium ? pet?.id : null)
  const medicationStatus = medicationStatusToday(medications, doses)
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)
  // Body condition counts towards the score since 24 Sep 2026. Premium-only,
  // like the screen that records it — a free account has none, and asking for
  // them would be a query that can only ever come back empty.
  const { entries: bcsEntries } = useBcsHistory(hasPremium ? pet?.id : null)
  const { conditions } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)
  const diseaseByDate = useMemo(
    () => diseaseDaysByDate({ petConditions: conditions, entriesByCondition: byCondition, species: pet?.species }),
    [conditions, byCondition, pet?.species],
  )
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
      // Disease monitoring and body condition count towards the score since
      // 24 Sep 2026 — see lib/qolInfluences.js.
      const influences = qolInfluencesOn({ diseaseByDate, bcsEntries, pet, date: entry.date })
      return computeGeneralQolResult(
        entry, pain?.beap, pet?.species, influences.diseaseEmergencies, influences,
      )
    } catch (error) {
      console.error('Could not score that assessment:', error.message)
      return null
    }
  }
  // A body condition reading that has aged out of the score, where the last
  // one said something worth saying. Null when it is recent, ideal, or there
  // is none.
  const staleBodyCondition = useMemo(() => {
    const reading = bodyConditionOn(bcsEntries, todayIsoDate())
    if (!reading || reading.daysAgo <= BCS_MAX_AGE_DAYS) return null
    const wouldHaveCounted = bodyConditionInfluence({ ...reading, daysAgo: 0 })
    return wouldHaveCounted?.bandFloorIndex > 0 ? reading : null
  }, [bcsEntries])

  // The pain half of the latest day, which the answers modal reads alongside
  // the general one.
  const latestPain = latestGeneral
    ? painEntries.find((row) => row.date === latestGeneral.date) ?? null
    : null
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
  // The answers behind each pillar, for the breakdown the bars open.
  const breakdown = useMemo(() => {
    if (!latestGeneral) return null
    const pain = painEntries.find((row) => row.date === latestGeneral.date) ?? null
    try {
      const items = computeOverviewBreakdown(
        latestGeneral,
        pain,
        qolInfluencesOn({ diseaseByDate, bcsEntries, pet, date: latestGeneral.date }).pillarAnswers,
        pet?.species,
      )
      // The answer as the owner gave it — the same wording the day's summary
      // shows — in place of the bare band name.
      const rows = new Map(
        describeAssessmentDay(latestGeneral, pain, pet?.species).map((row) => [row.key, row]),
      )
      for (const list of Object.values(items)) {
        for (const item of list) {
          const row = item.key ? rows.get(item.key) : null
          if (row?.answer) item.detail = row.detail ? `${row.answer} (${row.detail})` : row.answer
        }
      }
      return items
    } catch (error) {
      console.error('Could not build the pillar breakdown:', error.message)
      return null
    }
  }, [latestGeneral, painEntries, diseaseByDate, pet?.species])

  const overview = useMemo(() => {
    if (!latestGeneral) return null
    const pain = painEntries.find((row) => row.date === latestGeneral.date) ?? null
    try {
      return computeOverviewCategories(
        latestGeneral,
        pain,
        qolInfluencesOn({ diseaseByDate, bcsEntries, pet, date: latestGeneral.date }).pillarAnswers,
        pet?.species,
      )
    } catch (error) {
      console.error('Could not build the pillar overview:', error.message)
      return null
    }
  }, [latestGeneral, painEntries, diseaseByDate, pet?.species])

  // Everything due, assessment first. A condition whose reminder is off, or
  // that has never been logged, is not "due" — one has no schedule to be
  // measured against and the other has no last date to measure from.
  const qolDue = useMemo(() => {
    if (!pet) return null
    const status = monitoringStatus({
      definition: assessmentCadence(pet),
      schedule: null,
      lastDate: latestGeneral?.date ?? null,
      today,
    })
    return status.state === MONITORING_STATE.DUE ? status : null
  }, [pet, latestGeneral, today])

  // One entry per tracked condition, each carrying its own definition and its
  // own due state — they get a section each now, so a single pooled list of
  // "what is due" no longer answers the question this half asks.
  // Per-pet cancer configuration, keyed by condition — the same map the
  // charts build from, so the summary and the calendar resolve the same
  // parameter set.
  const configs = useMemo(() => configsByCondition(conditions), [conditions])

  const trackedConditions = useMemo(() => {
    if (!pet) return []
    const schedules = {}
    return CONDITION_LIST
      .filter((definition) => conditions.some((row) => row.conditionKey === definition.key))
      .map((definition) => {
        schedules[definition.key] = scheduleForCondition(pet, definition)
        const entries = byCondition[definition.key] ?? []
        const status = monitoringStatus({
          definition,
          schedule: pet.schedule,
          lastDate: entries[entries.length - 1]?.date ?? null,
          today,
        })
        return {
          definition,
          status,
          due: status.state === MONITORING_STATE.DUE ? status : null,
          // The cadence this pet is actually on, so a weekly condition's
          // strip does not draw six missed check-ins a week — Ash's report
          // 5 Sep 2026.
          history: conditionHistory({
            cadenceDays: schedules[definition.key].days,
            remindersOff: schedules[definition.key].off,
            definition,
            config: configs[definition.key],
            entries,
            species: pet.species,
            today,
          }),
        }
      })
  }, [pet, conditions, byCondition, configs, today])

  if (!pet) return null

  const trackedCount = trackedConditions.length

  return (
    <Card className="pet-summary">
      <div className="pet-summary-head">
        {/* The brand mark in the top slot, where the pet's photo was —
            Ash's call, 29 Aug 2026, after trying it above the photo and again
            under the title. The pet is named in the line beneath it, so the
            circle above does not also have to identify them. */}
        {/* The pet's photo moved into the score ring below — Ash's
            instruction 24 Sep 2026. It was a 52px circle above a 92px ring,
            which made the smaller, more personal thing the lesser one; now
            the animal's face IS the ring.

            The brand mark came back to the top of the card on her
            instruction the same day, smaller than it was and above the title
            rather than beside it: it says whose app this is without being
            the first thing the eye lands on, which is the photo. */}
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
            {/* The heart that sat here — matching the assessment tile's —
                went on Ash's instruction 27 Sep 2026. The score ring directly
                below is already the thing the eye lands on, and a badge on the
                heading was decoration competing with it. */}
            <h3 className="pet-summary-section-title">
              Overall QoL
            </h3>
          </div>
        </div>

        {/* Centred, on Ash's instruction 29 Aug 2026, and larger for it.
            This is the app's central number — tucked into the top-right
            corner of a heading row it read as a badge on the title rather
            than as the thing the screen is about. */}
        {latest ? (
          <div className="pet-summary-score">
            <ScoreRing
              percent={latest.percent}
              colour={latest.color}
              size={148}
              centre={<PetAvatar pet={pet} size={112} editable />}
            />
            <p className="pet-summary-percent" style={{ color: latest.color }}>
              {latest.percent}%
            </p>
            {/* Band, change and status each on their own line — Ash's
                instruction 4 Sep 2026. They were briefly merged to save
                height; the height now comes out of the condition rows
                instead, and the score stack reads as one thing per line. */}
            <p className="pet-summary-band" style={{ color: latest.color }}>
              {latest.band}
            </p>

            {/* WHY the number is what it is, when something held it down.
                APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026.
                
                Since 24 Sep 2026 a day can be capped by a disease finding or
                by body condition as well as by the assessment's own severe
                answers, which means a score of 74 has several possible
                causes and an owner reading it has no way to tell them apart.
                A vet reading it over their shoulder has none either. The
                reason is one line, in the muted type the rest of the stack
                uses, and it only appears when a cap actually fired. */}
            {/* The explanation is one tap away since 27 Sep 2026, on Ash's
                instruction. The line names WHAT capped the day; an owner
                seeing 49% under a pet who ate and walked normally also wants
                to know why one answer is allowed to do that, and the only
                place that was explained was a modal three taps away on
                Trends.
                
                A question mark beside the line rather than the whole line
                underlined — Ash, 27 Sep 2026. The sentence is a statement
                about today, not a link, and underlining all of it made the
                fact look like the action. */}
            {latest.capReason && (
              <>
                <p className="pet-summary-cap-reason">
                  Capped at {latest.percent}% by {latest.capReason}
                </p>
                {/* On its own line under the statement — Ash, 27 Sep 2026.
                    Beside it, the button landed wherever the sentence happened
                    to wrap, sometimes alone on a second line anyway.
                    
                    The mark is a plain question mark rather than lucide's
                    HelpCircle, which draws its own circle and came out as two
                    rings inside a round button.
                    
                    APPROVED — Dr Ash Cullen (BSc, DVM), 27 Sep 2026. Her wording. */}
                <button
                  type="button"
                  className="cap-reason-help"
                  onClick={() => setShowCapReason(true)}
                >
                  <span className="cap-reason-help-mark" aria-hidden="true">?</span>
                  Why is the score capped?
                </button>
              </>
            )}

            {/* APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. A body condition score stops
                counting after thirty days, and the score quietly RISES when
                it does. An owner could read that as improvement, which is the
                opposite of what it means, so the app asks for a new reading
                instead of saying nothing. Only where the last one was
                flagged: a pet that has always weighed well needs no prompt. */}
            {staleBodyCondition && (
              <p className="pet-summary-cap-reason">
                Body condition last measured {staleBodyCondition.daysAgo} days ago, at
                {' '}{staleBodyCondition.score} of 9. Worth weighing {pet?.name ?? 'them'} again.
              </p>
            )}

            {/* The direction of travel. A percentage on its own says how
                {name} is today; this is the only thing on the card that says
                which way {they} are going.

                APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026. */}
            {/* A chip rather than another grey line — Ash's instruction
                23 Sep 2026. This is the only thing on the card that says
                which WAY they are going, and it was wearing the same colour
                as the date beneath it. The arrow and the colour say it before
                the words are read; the words stay exactly as approved. */}
            {/* When it was last done, always — Ash's instruction 24 Sep
                2026. The line under it says which way the score has moved,
                which means nothing without knowing whether "last time" was
                yesterday or five weeks ago.

                APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026 — the three
                wordings. */}
            <p className="pet-summary-last">
              {latestGeneral.date === todayIsoDate()
                ? 'Last assessed today'
                : latestGeneral.date === isoDaysAgo(1)
                  ? 'Last assessed yesterday'
                  : `Last assessed ${formatDateDDMMYY(latestGeneral.date)}`}
            </p>

            <p className={`pet-summary-change ${change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`.trim()}>
              {change != null && (
                change > 0 ? <TrendingUp size={13} aria-hidden="true" />
                  : change < 0 ? <TrendingDown size={13} aria-hidden="true" />
                    : <Minus size={13} aria-hidden="true" />
              )}
              {change == null
                ? formatDateDDMMYY(latestGeneral.date)
                : change === 0
                  ? 'Unchanged since last time'
                  : describePercentChange(change)}
            </p>
          </div>
        ) : (
          /* Before the first assessment the card used to drop to this one
             line — no photo, no ring, nothing of the animal at all. Ash's
             report 4 Oct 2026, testing a brand-new account: the home screen
             a new owner lands on is the emptiest it will ever be, and it was
             also the only one that did not show their pet.

             Same ring at the same size, drawn empty, with the same photo in
             it. The line below it is her approved copy, unchanged.

             APPROVED — Dr Ash Cullen (BSc, DVM), 4 Oct 2026. */
          <div className="pet-summary-score">
            <ScoreRing
              percent={0}
              colour="var(--border)"
              size={148}
              label="No quality of life score yet"
              centre={<PetAvatar pet={pet} size={112} editable />}
            />
            <p className="pet-summary-empty">
              No assessment yet. The first one is what everything else is measured against.
            </p>
          </div>
        )}

        {overview && <PillarSummary overview={overview} breakdown={breakdown} pet={pet} />}

        {/* Said in words, with the mark the rest of the card uses for
            something needing attention.
            //
            A bare red "3 days late" under a score told an owner a number
            without telling them what was late or what to do about it — and it
            sat directly above a button whose own label had stopped being
            true, since "start today's assessment" is not what someone three
            days behind is being asked for.

            APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. */}
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
            <Check size={14} /> Monitoring up to date
          </p>
        )}

        {/* Read back what was actually said last time — Ash's instruction
            4 Oct 2026. The answers were saved, scored, charted and exported,
            but the only way to see them as questions and answers was to find
            that day on the Trends calendar and tap it. The last check-in is
            the one an owner wants most often, and it is the one this card is
            already about.

            The same DayAnswersModal the calendar opens, so the two can never
            describe a day differently. Read-only: editing a past day belongs
            to the assessment's own "Edit Existing" path.

            APPROVED — Dr Ash Cullen (BSc, DVM), 4 Oct 2026. */}
        {latestGeneral && (
          <button
            type="button"
            className="subtle-link pet-summary-answers-link"
            onClick={() => setShowLastAnswers(true)}
          >
            See Your Last Answers
          </button>
        )}

        {/* Only when there is something to do, on Ash's instruction 3 Sep
            2026 — the same rule the condition sections below follow. A button
            under a section that already says "Up to date" invites a tap that
            leads to a form with nothing to fill in, and on a card with two or
            three conditions it was a column of buttons where only some of
            them meant anything.

            The exception is a pet with NO assessment yet. There is nothing to
            be up to date with, and no other way into the assessment from this
            card, so the first-run case always keeps its button.

            APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026 — wording carried
            over unchanged from the version she approved earlier today. */}
        {(qolDue || !latestGeneral) && (
          <Btn type="button" className="btn-block" onClick={() => navigate('/assessment')}>
            {!latestGeneral ? 'Start the First Assessment' : 'Go to QoL Assessment'}
          </Btn>
        )}
      </section>

      {/* --- One row per condition ---------------------------------------
          Collapsed to a single row on Ash's instruction 4 Sep 2026, from the
          mock-up she approved. Each condition was a full section — heading,
          status line, fortnight strip with its scale, a trend line, a named
          finding and sometimes a button — roughly 300px each. A pet with two
          conditions pushed every tile on the home screen below the fold, so
          the screen that exists to say "here is what to do" had to be
          scrolled before any of it was visible.

          Everything the section said still exists, one tap away, on the
          condition's own screen: this row opens it. What stays here is what
          can be read without stopping — the condition, how the fortnight
          went, and whether anything is owed.

          One destination in both states, deliberately. /conditions/:key is
          both the assessment and the summary of it, so an up-to-date row is
          not the dead end the removed button would have been. */}
      {trackedConditions.map(({ definition, status, history }) => {
        const Icon = definition.Icon ?? Stethoscope
        return (
          <button
            type="button"
            key={definition.key}
            className="dx-row"
            // Says what the condition covers before opening it, the same as
            // the list does — Ash's instruction 24 Sep 2026.
            onClick={() => setAskingCondition(definition)}
          >
            {/* The condition's own icon, in the pink circle the rest of the
                card uses — Ash's instruction 4 Sep 2026, unchanged from the
                section heading it replaces. */}
            <span className="pet-summary-section-icon" aria-hidden="true">
              <Icon size={16} />
            </span>

            <span className="dx-row-text">
              <span className="dx-row-title">{definition.label}</span>

              {/* Fortnight on the left, what is owed on the right. They shared
                  the title's line at first and the title wrapped to make room
                  for "1 day overdue" — a two-line condition name beside a
                  one-line status reads as two rows, not one. */}
              <span className="dx-row-foot">
                <ConditionStrip history={history} />
                <ConditionState status={status} />
              </span>
            </span>

            <ChevronRight className="dx-row-chev" size={18} aria-hidden="true" />
          </button>
        )
      })}

      {/* --- Medications today --------------------------------------------
          Ash's instruction 23 Sep 2026. A reminder fires once and is gone;
          this is the standing answer to "have I given it?", on the screen
          the owner opens anyway.

          Three states and nothing else. It says nothing at all for a pet on
          no medication — reassuring somebody about doses they do not give is
          noise — and it never says a dose is late the minute it is due: an
          owner who gives the 8am tablet with breakfast at 8:40 has not
          missed anything (see DOSE_GRACE_MINUTES).

          APPROVED — Dr Ash Cullen (BSc, DVM), 23 Sep 2026. All three lines, and the 60-minute grace
          before a dose is called late. */}
      {medicationStatus.state !== MEDICATION_STATE.NONE && (
        <button
          type="button"
          className={`dx-row med-today med-today-${medicationStatus.state}`}
          onClick={() => navigate('/medications')}
        >
          <span className="pet-summary-section-icon" aria-hidden="true">
            <Pill size={16} />
          </span>

          <span className="dx-row-text">
            <span className="dx-row-title">Medications</span>
            <span className="dx-row-foot med-today-state">
              {medicationStatus.state === MEDICATION_STATE.OVERDUE ? (
                <>
                  <AlertTriangle size={13} aria-hidden="true" />
                  {medicationStatus.overdue.length === 1
                    ? `${medicationStatus.overdue[0].medication.name} was due at ${formatMedicationTime(medicationStatus.overdue[0].time)}`
                    : `${medicationStatus.overdue.length} doses not marked as given`}
                </>
              ) : medicationStatus.state === MEDICATION_STATE.DUE ? (
                `${medicationStatus.outstanding.length} ${medicationStatus.outstanding.length === 1 ? 'dose' : 'doses'} still to give today`
              ) : (
                <>
                  <Check size={13} aria-hidden="true" />
                  All given today
                </>
              )}
            </span>
          </span>

          <ChevronRight className="dx-row-chev" size={18} aria-hidden="true" />
        </button>
      )}

      {/* APPROVED — Dr Ash Cullen (BSc, DVM), 27 Sep 2026. The whole modal. The second paragraph is her approved
          sentence from the Trends explainer, said again where the number it
          explains is actually being read. */}
      {showCapReason && (
        <Modal title="Why Is This Score Capped?" onClose={() => setShowCapReason(false)}>
          <p>
            Today's score is capped at {latest?.percent}% because of {latest?.capReason}.
          </p>
          {/* The answers themselves. On a seventeen-item assessment plus
              whatever is being monitored, naming the category and stopping
              leaves the owner hunting for which answer did it. */}
          {/* Through PetText, because a finding carries this pet's pronouns
              as {they}/{are} tokens — rendered raw they would appear on screen
              as literal braces. */}
          {latest?.capFindings?.length > 0 && (
            <ul className="emergency-list">
              {latest.capFindings.map((finding) => (
                <li key={finding}><PetText template={finding} pet={pet} /></li>
              ))}
            </ul>
          )}
          <p>
            Because an average can hide a single serious problem, some findings hold the overall
            rating down on their own — so an urgent issue in an otherwise normal assessment won't
            be overlooked.
          </p>
        </Modal>
      )}

      {showLastAnswers && latestGeneral && (
        <DayAnswersModal
          title="Your Last Answers"
          dateLabel={formatDateDDMMYY(latestGeneral.date)}
          rows={describeAssessmentDay(latestGeneral, latestPain, pet?.species)}
          pet={pet}
          emptyMessage="No assessment was saved on this day."
          note={latestGeneral?.notes ?? latestPain?.notes ?? null}
          onClose={() => setShowLastAnswers(false)}
        />
      )}

      <ConditionIntroModal
        definition={askingCondition}
        pet={pet}
        onClose={() => setAskingCondition(null)}
        onProceed={() => {
          const key = askingCondition.key
          setAskingCondition(null)
          navigate(`/conditions/${key}`)
        }}
      />

      {/* Nothing tracked yet — one section offering the way in. */}
      {trackedCount === 0 && (
        <section className="pet-summary-section">
          <div className="pet-summary-section-head">
            <div>
              <h3 className="pet-summary-section-title">
                <span className="pet-summary-section-icon" aria-hidden="true">
                  <Stethoscope size={16} />
                </span>
                Conditions
              </h3>
            </div>
          </div>

          <Btn
            type="button"
            variant="outline"
            className="btn-block"
            onClick={() => navigate('/conditions')}
          >
            Set Up Disease Monitoring
          </Btn>
        </section>
      )}

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
// Module scope on purpose: it survives the component unmounting and
// remounting as tabs are switched, which is exactly the case it exists for.
let pillarsHaveAnimated = false

function PillarSummary({ overview, breakdown, pet }) {
  const [firstPaint] = useState(() => {
    if (pillarsHaveAnimated) return false
    pillarsHaveAnimated = true
    return true
  })
  // Which pillar's breakdown is open. Lives here, beside the tiles that open
  // it — declaring it in PetSummaryCard left it out of scope in this
  // component, which crashed the home screen (21 Sep 2026).
  const [openPillar, setOpenPillar] = useState(null)

  return (
    <>
      {/* Five tiles, always on screen — Ash's instruction 23 Sep 2026, from
          the mock-up she approved.

          They were bars behind a "{name}'s 5 QoL Pillars" disclosure, which
          made sense while the home screen was this card on top of eleven
          navigation tiles: the pillars had to earn their vertical space
          against everything else. With the tiles gone to the More screen and
          the tab bar, nothing is competing for the space, and a number an
          owner has to go looking for is a number most of them will not see.

          Each tile opens the same breakdown the bars did — which answers, in
          the owner's own words, are holding that pillar down. */}
      <div className={`pillar-tiles ${firstPaint ? 'is-first-paint' : ''}`.trim()}>
        {WELLBEING_CONCEPTS.map(({ key, label, Icon, color, tint }, index) => {
          const value = overview[key]
          return (
            <button
              key={key}
              type="button"
              // Each tile arrives 45ms after the one before it, so the row
              // reads left to right the way it is meant to be read rather
              // than appearing as one block of five numbers. The delay is
              // inline because it is per-tile data, not a style.
              style={{ animationDelay: `${index * 45}ms` }}
              className={`pillar-tile ${openPillar === key ? 'is-open' : ''}`.trim()}
              aria-expanded={openPillar === key}
              aria-label={`${label}, ${value != null ? `${Math.round(value)} percent` : 'not scored'}`}
              onClick={() => setOpenPillar(key)}
            >
              <span className="pillar-tile-icon" style={{ background: tint }} aria-hidden="true">
                <Icon size={14} color={color} />
              </span>
              {/* Coloured by the same severity scale as the ring, so a pillar
                  in trouble is visible without reading the number. */}
              <span
                className="pillar-tile-value"
                style={{ color: value != null ? severityColorFromPercent(value) : 'var(--text-muted)' }}
              >
                {value != null ? `${Math.round(value)}%` : '\u2014'}
              </span>
              <span className="pillar-tile-label">{label}</span>
            </button>
          )
        })}
      </div>

      {openPillar && (
        <PillarBreakdownModal
          concept={WELLBEING_CONCEPTS.find((concept) => concept.key === openPillar)}
          value={overview?.[openPillar]}
          items={breakdown?.[openPillar] ?? []}
          pet={pet}
          onClose={() => setOpenPillar(null)}
        />
      )}
    </>
  )
}

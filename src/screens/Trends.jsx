import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, FileDown, Heart, Lock, Stethoscope, Weight } from 'lucide-react'
import Btn from '../components/Btn'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Modal from '../components/Modal'
import ConceptDefinition from '../components/ConceptDefinition'
import ExpandableNote from '../components/ExpandableNote'
import RangeToggle from '../components/RangeToggle'
import ChartView from '../components/ChartView'
import DayAnswersModal from '../components/DayAnswersModal'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import Skeleton from '../components/Skeleton'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { diseaseDaysByDate } from '../lib/diseaseDays'
import { buildDailySeries } from '../lib/qolData'
import {
  buildChartRegistry,
  chartByKey,
  chartsForCondition,
  configsByCondition,
  resolveTrackedConditions,
} from '../lib/charts'
import {
  useAllConditionEntries,
  useAllConditionEvents,
  usePetConditions,
} from '../lib/conditionsData'
import { describeConditionDay } from '../lib/conditions'
import { parametersFor } from '../lib/cancerConfig'
import { useEntitlements } from '../lib/EntitlementsContext'
import { useMedications } from '../lib/medicationsData'
import { useBcsHistory } from '../lib/bcsData'
import { describeAssessmentDay } from '../lib/assessmentSummary'
import { formatDateDDMMYY } from '../lib/formatDate'
import { clearAssessmentNote } from '../lib/qolData'


// One labelled group of chips. Each carries its own icon — a pillar's, an
// organ's — so the row is scanned rather than read, and the selected one
// fills with the accent.
function TrendChips({ label, options, activeKeys, onChoose }) {
  return (
    <div className="trend-chip-group">
      <span className="nav-section-title">{label}</span>
      <div className="trend-chips">
        {options.map((option) => {
          const Icon = option.Icon
          const isActive = activeKeys.includes(option.key)
          return (
            <button
              key={option.key}
              type="button"
              className={`trend-chip ${isActive ? 'is-active' : ''}`.trim()}
              aria-pressed={isActive}
              onClick={() => onChoose(option.key)}
            >
              <span
                className="trend-chip-icon"
                style={{ background: isActive ? 'rgba(255, 255, 255, 0.24)' : (option.tint ?? 'var(--accent-wash-strong)') }}
                aria-hidden="true"
              >
                <Icon size={13} color={isActive ? '#fff' : (option.colour ?? '#C97B8C')} />
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Trends() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { generalEntries, painEntries, loading, refresh } = useQolHistory(pet?.id)
  const { medications } = useMedications(pet?.id)
  // Body condition and weight, so they can be charted here alongside
  // everything else — Ash's instruction 23 Sep 2026. The rows are premium and
  // RLS refuses them to a free account anyway; the guard below is so a lapsed
  // subscription cannot leave a paid chart sitting in the picker.
  const { entries: bcsEntries } = useBcsHistory(pet?.id)
  const { hasPremium } = useEntitlements()
  // Everything needed to draw a condition's summary calendar, for every
  // condition at once. The per-condition screen loads one condition's worth
  // through the singular hooks; these are the same queries without the
  // conditionKey filter, and the report already uses them for exactly this.
  const { conditions } = usePetConditions(pet?.id)
  const { byCondition: entriesByCondition } = useAllConditionEntries(pet?.id)
  // Red disease days floor that day's Overall QoL — see lib/diseaseDays.js.
  const diseaseByDate = diseaseDaysByDate({
    petConditions: conditions, entriesByCondition, species: pet?.species,
  })
  const { byCondition: eventsByCondition } = useAllConditionEvents(pet?.id)
  const [showScoringExplainer, setShowScoringExplainer] = useState(false)
  // Which day's answers are open, as an ISO date. Null is closed.
  const [openDay, setOpenDay] = useState(null)
  const [noteError, setNoteError] = useState('')
  // The same idea for a CONDITION calendar, but a date alone is not enough:
  // two conditions can both have been logged on the same day and they are
  // different sets of answers. Held as { conditionKey, date }.
  const [openConditionDay, setOpenConditionDay] = useState(null)

  // Month or all time, for every chart on this screen at once — Ash's
  // instruction 4 Sep 2026. Month by default: the daily question is "how is
  // she today", and someone opening the app to log an entry should not have
  // to narrow a year first.
  // What the owner has chosen to look at. More than one at a time — Ash's instruction 23 Sep 2026. Held as an
  // ordered list so the charts appear in the order they were chosen rather
  // than in the order the picker happens to list them.
  //
  // EMPTY on arrival, and not remembered between visits — Ash's instruction
  // 24 Sep 2026. A screen that opens with something already chosen answers a
  // question the owner has not asked yet, and the one it picks is rarely the
  // one they came for.
  const [chartKeys, setChartKeys] = useState([])

  // Tapping a chip adds it; tapping it again takes it away. Nothing is
  // remembered between visits, so every visit starts from the question
  // rather than from an answer to a previous one.
  function toggleChart(key) {
    setChartKeys((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ))
  }

  const [range, setRange] = useState('month')
  // 'month' keeps the single-month calendar and the fortnight of points;
  // 'quarter' and 'all' both open the full-span view, the first of them
  // narrowed to ninety days.
  const allTime = range !== 'month'
  const windowDays = range === 'quarter' ? 90 : null


  // The two halves of one day's assessment, for the day whose answers are
  // open. Looked up rather than carried on the calendar descriptor, so the
  // calendar stays a picture of the data instead of a copy of it.
  const openGeneralEntry = openDay
    ? generalEntries.find((entry) => entry.date === openDay) ?? null
    : null
  const openPainEntry = openDay
    ? painEntries.find((entry) => entry.date === openDay) ?? null
    : null

  // Clears the note on the day currently open. The day's scores and answers
  // are untouched — see clearAssessmentNote.
  //
  // A failure is shown IN the modal rather than logged. This swallowed its
  // errors to the console when it shipped, so a delete that did not take
  // looked exactly like a button that did nothing.
  async function handleDeleteNote() {
    if (!openDay || !pet?.id) return
    setNoteError('')
    try {
      await clearAssessmentNote({ petId: pet.id, date: openDay })
      refresh()
      setOpenDay(null)
    } catch (error) {
      setNoteError(error.message || 'Could not delete that note.')
    }
  }


  const dailySeries = buildDailySeries(generalEntries, painEntries, pet?.species, diseaseByDate)

  // Every chart this screen can draw, described in one place. Trends decides
  // the layout — which cards, which collapse — but not what a chart IS.
  // Conditions are deliberately left out of this call: they have their own
  // pages, and the registry is filtered rather than rebuilt to exclude them.
  const charts = buildChartRegistry({
    generalEntries,
    painEntries,
    dailySeries,
    bcsEntries: hasPremium ? bcsEntries : [],
    // Only for the calendar's start/stop marks — the medication list itself
    // lives on its own screen.
    medications,
    species: pet?.species,
    pet,
    diseaseByDate,
  })

  // --- Tracked conditions, summarised here too -----------------------------
  //
  // Added 3 Sep 2026 on Ash's instruction: an owner monitoring three things
  // had to visit three screens to see how the month had gone. The summary
  // calendars now also gather on this screen, which is the one place already
  // meant for "how have we been doing".
  //
  // Built with chartsForCondition, the SAME function the condition's own
  // screen and the exported report call, rather than a second drawing of the
  // same data. A calendar that disagreed with itself between two screens
  // would be worse than not having it here at all.
  //
  // Gated on premium because condition monitoring is a paid feature. In
  // practice the rows would not load for a free account anyway — the RLS
  // policy refuses them — but a lapsed subscription must not leave stale
  // calendars sitting on a free screen.
  const conditionConfigs = configsByCondition(conditions)
  const conditionSummaries = (hasPremium ? resolveTrackedConditions(conditions) : [])
    .map((definition) => {
      const entries = entriesByCondition[definition.key] ?? []
      const built = chartsForCondition({
        definition,
        entries,
        events: eventsByCondition[definition.key] ?? [],
        medications,
        species: pet?.species,
        pet,
        config: conditionConfigs[definition.key],
      })
      return {
        definition,
        entries,
        calendar: chartByKey(built, `${definition.key}:calendar`),
        // The measured numbers this condition draws a line for — Ash's
        // instruction 5 Sep 2026. Two exist in the whole app: heart disease's
        // resting respiratory rate and kidney disease's daily water intake.
        // Both were already built here for the condition's own screen and the
        // report; Trends simply never rendered them, so the one screen called
        // Trends was the one place a measured trend could not be seen.
        //
        // Filtered by kind rather than by name, so a third charted parameter
        // appears here the day it is added with no further wiring.
        lines: built.filter((chart) => chart.kind === 'line'),
      }
    })

  // --- What can be charted, as one list -------------------------------------
  //
  // Two groups, both visible — Ash's instruction 23 Sep 2026. The conditions
  // used to have a card each further down the screen, with their own "Graph
  // X" toggles, which meant two different controls answering the same
  // question depending on how far you had scrolled. One picker now, and a
  // condition is a chip beside Comfort rather than something to go and find.
  //
  // Every option carries its own chart, so nothing here can offer something
  // that cannot be drawn: an option with no chart is simply not built.
  const measureOptions = [
    { key: 'good-bad-days', label: 'Good / Bad Days', Icon: CalendarDays },
    { key: 'overall', label: 'Overall QoL', Icon: Heart },
    // Named as they are named everywhere else — Comfort, Appetite, Sleep,
    // Curiosity, Connection — rather than "Comfort pillar". Ash, 23 Sep 2026.
    ...WELLBEING_CONCEPTS.map((concept) => ({
      key: `pillar:${concept.key}`,
      label: concept.label,
      Icon: concept.Icon,
      colour: concept.color,
      tint: concept.tint,
      concept,
    })),
    { key: 'body:score', label: 'Body Condition', Icon: Weight },
    { key: 'body:weight', label: 'Weight', Icon: Weight },
  ]
    .map((option) => ({ ...option, chart: chartByKey(charts, option.key) }))
    .filter((option) => option.chart)

  // A calendar per condition, plus any measured line it keeps — heart
  // disease's resting respiratory rate, kidney disease's water intake. Both
  // are built by chartsForCondition above, the same function the condition's
  // own screen and the exported report use.
  const conditionOptions = conditionSummaries.flatMap(({ definition, calendar, lines }) => [
    ...(calendar ? [{
      key: calendar.key,
      label: definition.label,
      Icon: definition.Icon ?? Stethoscope,
      chart: calendar,
      conditionKey: definition.key,
      conditionLabel: definition.label,
    }] : []),
    ...lines.map((chart) => ({
      key: chart.key,
      label: chart.title,
      Icon: definition.Icon ?? Stethoscope,
      chart,
      conditionKey: definition.key,
      conditionLabel: definition.label,
    })),
  ])

  const allOptions = [...measureOptions, ...conditionOptions]
  // Switching pets can take a chosen chart away with it — the new pet may
  // have no weight recorded, no arthritis, or no premium behind them. What
  // survives is kept and the rest simply falls away, so the chips and the
  // charts always agree.
  const shown = chartKeys
    .map((key) => allOptions.find((option) => option.key === key))
    .filter(Boolean)
  const selectedKeys = shown.map((option) => option.key)

  // One chart per chosen measure, stacked in the order they were chosen —
  // Ash's instruction 24 Sep 2026, replacing a version that drew the pillars
  // together on a single axis. Five lines crossing each other in five colours
  // is a puzzle rather than a comparison: each one has its own card, its own
  // title, and its own definition, and the comparison is made by scrolling.

  // The entry behind the open condition day, and the definition as it was
  // actually asked — cancer resolves its parameters per pet, so the static
  // list would describe questions this owner was never shown.
  const openConditionSummary = openConditionDay
    ? conditionSummaries.find((item) => item.definition.key === openConditionDay.conditionKey) ?? null
    : null
  const openConditionEntry = openConditionSummary
    ? openConditionSummary.entries.find((entry) => entry.date === openConditionDay.date) ?? null
    : null
  const openConditionDefinition = openConditionSummary
    ? {
        ...openConditionSummary.definition,
        parameters: parametersFor(
          openConditionSummary.definition,
          conditionConfigs[openConditionSummary.definition.key],
          pet?.species,
        ),
      }
    : null

  const notesHistory = [...generalEntries]
    .reverse()
    .filter((entry) => entry.notes && entry.notes.trim())
    .slice(0, 10)

  return (
    <div className="screen">
      <HomeLink />
      <Card>
        <SectionTitle>Trends</SectionTitle>
        <p>
          Visual trends make gradual change easier to spot than single numbers — and are
          useful to bring to a vet visit.
        </p>
        {/* Lives here rather than as its own home-screen tile: exporting is
            something you do TO this data, so it belongs beside it. A full
            button rather than a quiet link, because taking a report to a vet
            visit is the single most valuable thing an owner does with this
            screen and it was previously the least visible thing on it. */}
        {/* Locked on a free account — Ash's instruction 24 Sep 2026. Shown
            rather than hidden: a feature nobody can see is a feature nobody
            subscribes for. */}
        <Btn
          type="button"
          className="btn-block"
          onClick={() => (hasPremium
            ? navigate('/export-report')
            : navigate('/paywall', { state: { feature: 'export' } }))}
        >
          {hasPremium ? <FileDown size={17} /> : <Lock size={15} />}
          {' '}Export a Report for Your Vet
        </Btn>
      </Card>

      {/* One chart at a time, chosen by the owner — Ash's instruction
          23 Sep 2026.

          This screen used to open with the score ring, the five pillars and
          the Overall QoL line. All three say how the pet is TODAY, and all
          three are now on the home screen, above the fold, before Trends is
          reached at all — so the first thing here was the thing the owner had
          just read, with the actual history pushed under it.

          What is left is the question this screen exists to answer: which
          measure, over what span. */}
      <Card>
        {/* APPROVED — Dr Ash Cullen (BSc, DVM), 23 Sep 2026. This title and the
            two group labels below it. */}
        <SectionTitle>What Would You Like to See?</SectionTitle>
        {/* "Tap more than one to see them one after another" was removed on
            Ash's instruction 24 Sep 2026. The chips are directly below the
            question and answer it themselves. */}

        <TrendChips
          /* Ash, 23 Sep 2026. */
          label={`${pet?.name ?? 'Your Pet'}\u2019s Overall QoL`}
          options={measureOptions}
          activeKeys={selectedKeys}
          onChoose={toggleChart}
        />
        {conditionOptions.length > 0 && (
          <TrendChips
            label="Conditions"
            options={conditionOptions}
            activeKeys={selectedKeys}
            onChoose={toggleChart}
          />
        )}

        {/* One control for every chart on this screen, not just this one —
            Ash's instruction 4 Sep 2026. It travels with whichever chart card
            comes first, so it is always directly above the first thing it
            changes. */}
        <RangeToggle value={range} onChange={setRange} />

        {loading && <Skeleton lines={4} />}

        {!loading && (allOptions.length === 0 ? (
          /* An empty state that offers the way out of itself — Ash's
             instruction 23 Sep 2026. "No assessments logged yet" is true and
             useless on its own: the owner is on a screen about history with
             no history, and the thing that fixes it is one tap away. */
          <div className="empty-state">
            <p>No assessments logged yet.</p>
            <Btn type="button" onClick={() => navigate('/assessment')}>
              Start the First Assessment
            </Btn>
          </div>
        ) : shown.length === 0 ? (
          /* Nothing chosen yet. The line that used to sit here ("Choose one
             or more above to see how they have changed") was removed on Ash's
             instruction 24 Sep 2026 — the chips are directly above and the
             question above them already asks. Nothing is drawn until one is
             chosen. */
          null
        ) : (
          <>
            {shown.map((option) => (
              <div className="trend-chart-block" key={option.key}>
                <h3 className="report-chart-title trends-chart-title">
                  <span
                    className="trend-chip-icon"
                    style={{ background: option.tint ?? 'var(--accent-wash-strong)' }}
                    aria-hidden="true"
                  >
                    <option.Icon size={13} color={option.colour ?? '#C97B8C'} />
                  </span>
                  {option.chart.title}
                </h3>
                {/* A pillar's definition travels with its own chart, so one
                    choice answers both "what is Comfort?" and "how has it
                    been?" rather than making the owner find two controls to
                    ask two halves of one question. */}
                {option.concept && <ConceptDefinition concept={option.concept} />}
                <ChartView
                  chart={option.chart}
                  allTime={allTime}
                  windowDays={windowDays}
                  onOpenDay={option.chart.kind !== 'calendar'
                    ? undefined
                    : option.conditionKey
                      ? (date) => setOpenConditionDay({ conditionKey: option.conditionKey, date })
                      : setOpenDay}
                />
                {/* The way through to the condition's own screen, where the
                    entries are made and a note can be edited. */}
                {option.conditionKey && (
                  <Link className="subtle-link trends-condition-link" to={`/conditions/${option.conditionKey}`}>
                    Go to {option.conditionLabel} Monitoring
                  </Link>
                )}
              </div>
            ))}
          </>
        ))}
      </Card>

      <Card>
        <SectionTitle>History</SectionTitle>
        {notesHistory.length === 0 ? (
          <p>No notes logged yet.</p>
        ) : (
          /* Collapsed by default, on Ash's instruction 3 Sep 2026. Ten notes
             of free text is the longest thing on this screen and it sat under
             everything an owner actually came here to look at. The count is
             in the label so a closed section still says how much is behind
             it.

             APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. */
          <ExpandableNote
            className="history-expander"
            label={`${notesHistory.length} note${notesHistory.length === 1 ? '' : 's'} you've written`}
          >
          <div className="history-list">
            {/* A button, not a div. A note is written about a particular day,
                and the questions it was written beside are the context that
                makes it mean anything — "off her food again" reads very
                differently next to an appetite score of 2 than next to a 7.
                The answers were already one tap from the calendar above; this
                is the same way in, from the place an owner is actually
                reading. */}
            {notesHistory.map((entry) => (
              <button
                key={entry.date}
                type="button"
                className="history-item"
                onClick={() => setOpenDay(entry.date)}
              >
                <p className="history-date">{formatDateDDMMYY(entry.date)}</p>
                <p className="history-notes">{entry.notes}</p>
                <span className="history-open">See this day's assessment</span>
              </button>
            ))}
          </div>
          </ExpandableNote>
        )}
      </Card>

      <button type="button" className="subtle-link" onClick={() => setShowScoringExplainer(true)}>
        How Does QoL Companion Calculate Quality of Life?
      </button>

      {openDay && (
        <DayAnswersModal
          title="This Day's Answers"
          dateLabel={formatDateDDMMYY(openDay)}
          rows={describeAssessmentDay(openGeneralEntry, openPainEntry, pet.species)}
          pet={pet}
          emptyMessage="No assessment was saved on this day."
          note={openGeneralEntry?.notes ?? openPainEntry?.notes ?? null}
          onDeleteNote={
            (openGeneralEntry?.notes ?? openPainEntry?.notes) ? handleDeleteNote : null
          }
          noteError={noteError}
          onClose={() => { setOpenDay(null); setNoteError('') }}
        />
      )}

      {/* Read-only here, deliberately. Deleting a note is an edit to that
          condition's record and belongs on that condition's own screen,
          which the link on each card above goes to. */}
      {openConditionDay && (
        <DayAnswersModal
          title="This Day's Answers"
          dateLabel={formatDateDDMMYY(openConditionDay.date)}
          rows={openConditionDefinition
            ? describeConditionDay(openConditionDefinition, openConditionEntry?.values, pet?.species)
            : []}
          pet={pet}
          emptyMessage="Nothing was recorded for this condition on this day."
          note={openConditionEntry?.notes ?? null}
          onClose={() => setOpenConditionDay(null)}
        />
      )}

      {showScoringExplainer && (
        <Modal title="How Does QoL Companion Calculate Quality of Life?" onClose={() => setShowScoringExplainer(false)}>
          <p>Your Overview scores and your overall QoL score are calculated a little differently, and both matter.</p>
          {/* APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Rewritten for the new pillar mapping.
              The two clauses naming what Comfort and Appetite cover were
              changed when urination moved between them — APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. */}
          <p>The 5 Overview pillars (Comfort, Appetite, Sleep, Curiosity, Connection) each bring together the answers that belong to them — from the Overall Quality of Life Assessment and from any disease monitoring recorded the same day. Comfort covers pain, mobility, breathing, skin, itch and passing urine; Appetite covers eating, drinking and digestion; Sleep covers rest; Curiosity covers activity, senses and favourite things; and Connection covers attitude and engagement with you. Pain questions are adapted from the BEAAAAPP pain assessment and, for cats, the Feline Grimace Scale. If any answer in a pillar is urgent, that pillar is held at 49% or below.</p>
          <p>Your overall QoL score is a single average across everything you record — the everyday-function questions (appetite, hydration, hygiene, senses, and more), your pet's favourite things, and every category of the BEAAAAPP pain assessment, each counting equally. Anything you mark "Not sure," or haven't answered yet, is left out of the average rather than counted against your pet.</p>
          {/* APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Updated to match the floor rules: any
              Severe pain answer, blood in the vomit and a cat's possible
              urinary blockage now set the rating AND cap the score. */}
          <p>Because an average can hide a single serious problem, some findings hold the overall rating down on their own: a Severe or Very severe answer in the pain assessment, blood in the vomit, or signs of a urinary blockage in a cat. Any of these records the day as Severely reduced, with the score capped at 49% — so a pet with one urgent issue won't be shown as doing well just because everything else looks fine.</p>
          <p>Together, these give you a fuller picture than either could alone. The scoring rules themselves are fixed and transparent — built using adaptations of these clinical frameworks alongside veterinary clinical expertise, not judged case-by-case or influenced by AI.</p>
        </Modal>
      )}

    </div>
  )
}

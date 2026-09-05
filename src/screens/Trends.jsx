import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileDown, Heart } from 'lucide-react'
import Btn from '../components/Btn'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import ConceptDefinition from '../components/ConceptDefinition'
import ExpandableNote from '../components/ExpandableNote'
import OverviewBars from '../components/OverviewBars'
import RangeToggle from '../components/RangeToggle'
import ScoreRing from '../components/ScoreRing'
import ChartView from '../components/ChartView'
import DayAnswersModal from '../components/DayAnswersModal'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { computeGeneralQolResult, computeOverviewCategories } from '../lib/scoring'
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
import { describeAssessmentDay } from '../lib/assessmentSummary'
import { formatDateDDMMYY } from '../lib/formatDate'
import { clearAssessmentNote } from '../lib/qolData'


export default function Trends() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { generalEntries, painEntries, loading, refresh } = useQolHistory(pet?.id)
  const { medications } = useMedications(pet?.id)
  const { hasPremium } = useEntitlements()
  // Everything needed to draw a condition's summary calendar, for every
  // condition at once. The per-condition screen loads one condition's worth
  // through the singular hooks; these are the same queries without the
  // conditionKey filter, and the report already uses them for exactly this.
  const { conditions } = usePetConditions(pet?.id)
  const { byCondition: entriesByCondition } = useAllConditionEntries(pet?.id)
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
  // Which pillar's chart is open, if any. One at a time: five charts stacked
  // down the screen is what this card had before 29 Aug 2026, and the reason
  // they were taken out.
  const [openPillar, setOpenPillar] = useState(null)

  const [range, setRange] = useState('month')
  const allTime = range === 'all'


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

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null

  // The same number the home screen shows, from the same function and with
  // the same pain entry matched by date — Ash's instruction 4 Sep 2026, the
  // circle at the top of Trends. Wrapped, because this screen must not go
  // down over one unscoreable row.
  const latestResult = (() => {
    if (!latestGeneralEntry) return null
    try {
      const pain = painEntries.find((row) => row.date === latestGeneralEntry.date) ?? null
      return computeGeneralQolResult(latestGeneralEntry, pain?.beap)
    } catch (error) {
      console.error('Could not score that assessment:', error.message)
      return null
    }
  })()
  const hasLatestData = latestGeneralEntry || latestPainEntry
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)

  // Every chart this screen can draw, described in one place. Trends decides
  // the layout — which cards, which collapse — but not what a chart IS.
  // Conditions are deliberately left out of this call: they have their own
  // pages, and the registry is filtered rather than rebuilt to exclude them.
  const charts = buildChartRegistry({
    generalEntries,
    painEntries,
    dailySeries,
    // Only for the calendar's start/stop marks — the medication list itself
    // lives on its own screen.
    medications,
    species: pet?.species,
  })

  const overallChart = chartByKey(charts, 'overall')
  const goodBadDays = chartByKey(charts, 'good-bad-days')
  // Built by the registry already — they were dropped from this screen on
  // 29 Aug 2026 and kept for the report. Ash's instruction 5 Sep 2026 brings
  // them back, one at a time and only when asked for.
  const openPillarChart = openPillar ? chartByKey(charts, `pillar:${openPillar}`) : null

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
      }
    })

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

  const openConcept = WELLBEING_CONCEPTS.find((concept) => concept.key === openPillar) ?? null

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
        <Btn type="button" className="btn-block" onClick={() => navigate('/export-report')}>
          <FileDown size={17} /> Export A Report For Your Vet
        </Btn>
      </Card>

      <Card>
        <SectionTitle>Overview</SectionTitle>
        {loading && <p>Loading…</p>}
        {!loading && !hasLatestData && <p>No assessments logged yet.</p>}
        {!loading && hasLatestData && (
          <>
            {/* The circle first, then the five pillars under it — Ash's
                instruction 4 Sep 2026. The score answers "how is {name}"; the
                bars answer "which part of them", and the second only means
                something once the first has been read. Same ring, same
                component and same size as the home screen's. */}
            {latestResult && (
              <div className="trends-score">
                {/* The same heading the home card puts over the same ring —
                    Ash's instruction 4 Sep 2026: the heart in its circle, then
                    "Overall QoL". The card above it is called Overview because
                    it also holds the five pillars; this names the number. */}
                <h3 className="pet-summary-section-title">
                  <span className="pet-summary-section-icon" aria-hidden="true">
                    <Heart size={16} />
                  </span>
                  Overall QoL
                </h3>
                <ScoreRing
                  percent={latestResult.percent}
                  colour={latestResult.color}
                  size={92}
                />
                <p className="pet-summary-band" style={{ color: latestResult.color }}>
                  {latestResult.band}
                </p>
              </div>
            )}

            {/* Tapping anywhere on a pillar — icon, name or bar — opens its
                chart, and tapping it again closes it. Ash's instruction 5 Sep
                2026, replacing a version where the icon opened the pillar's
                definition and the rest of the row opened its chart: two
                targets an inch apart doing different things, with nothing to
                say which was which. */}
            {/* Above the bars, not below them: an instruction that arrives
                after the thing it describes has already been scrolled past is
                not an instruction.

                It replaces "Want to see a pillar over time? Pick it in the
                report" — which was true until 5 Sep 2026 and is now the
                wrong answer to its own question, since the chart is one tap
                away right here.

                PENDING ASH — the wording is mine. */}
            <p className="assessment-hint">
              Tap a pillar to see how it has changed over time.
            </p>
            <OverviewBars
              concepts={WELLBEING_CONCEPTS}
              overview={overview}
              onSelect={(key) => setOpenPillar((current) => (current === key ? null : key))}
              selectedKey={openPillar}
            />

            {/* Open in place, under the bars rather than at the foot of the
                card, so the chart and the bar that opened it are read
                together. Follows the screen's Month / All time toggle like
                every other chart here.

                The definition travels with the chart. It used to be what the
                icon opened; folding it in here means one tap answers both
                "what is Comfort?" and "how has it been?" rather than making
                the owner find two controls to ask two halves of one
                question. */}
            {openPillarChart && (
              <div className="trends-pillar-chart">
                <h3 className="report-chart-title">{openPillarChart.title}</h3>
                <ConceptDefinition concept={openConcept} />
                <ChartView chart={openPillarChart} allTime={allTime} />
                <button
                  type="button"
                  className="condition-cadence-change"
                  onClick={() => setOpenPillar(null)}
                >
                  Hide
                </button>
              </div>
            )}
            <p className="assessment-hint">
              From {formatDateDDMMYY(latestGeneralEntry?.date ?? latestPainEntry?.date)} — based on your most recent assessment.
            </p>
          </>
        )}
      </Card>

      {/* Overall QoL before Good / Bad Days — Ash's instruction 5 Sep 2026,
          swapping the two. The line is the same number the card above it has
          just shown as a ring, so the two read as one thought: here it is
          today, here is how it got here. The calendar then breaks that same
          span into individual days. */}
      <Card>
        <SectionTitle>{overallChart?.title ?? 'Overall QoL Over Time'}</SectionTitle>
        {/* One control for every chart on this screen, not just this one —
            Ash's instruction 4 Sep 2026, moved out of the intro card the next
            day. It sat under the export button, which put it in a card with
            no picture in it and left it reading as something to do with
            exporting. It travels with whichever chart card comes first, so it
            is always directly above the first thing it changes. */}
        <RangeToggle value={range} onChange={setRange} />
        {overallChart ? <ChartView chart={overallChart} allTime={allTime} /> : <p>No assessments logged yet.</p>}
      </Card>

      <Card>
        <SectionTitle>{goodBadDays?.title ?? 'Good / Bad Days'}</SectionTitle>
        {goodBadDays
          ? <ChartView chart={goodBadDays} allTime={allTime} onOpenDay={setOpenDay} />
          : <p>No assessments logged yet.</p>}
      </Card>

      {/* One card per condition being monitored, between the overall charts
          and the notes. Below the overall picture because that is the one
          every pet has; above History because a calendar is scanned and a
          note is read. */}
      {conditionSummaries.map(({ definition, calendar }) => (
        <Card key={definition.key}>
          <SectionTitle>{pet?.name}&apos;s {definition.label} Summary</SectionTitle>
          {calendar ? (
            <ChartView
              chart={calendar}
              allTime={allTime}
              onOpenDay={(date) => setOpenConditionDay({ conditionKey: definition.key, date })}
            />
          ) : (
            /* Tracked, but nothing logged for it yet. Said out loud rather
               than the card being dropped: a condition silently missing from
               a screen that promises all of them reads as a bug. */
            <p>No {definition.label.toLowerCase()} entries logged yet.</p>
          )}
          <Link className="subtle-link trends-condition-link" to={`/conditions/${definition.key}`}>
            Go to {definition.label} Monitoring
          </Link>
        </Card>
      ))}

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
        How does QoL Companion calculate quality of life?
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
        <Modal title="How does QoL Companion calculate quality of life?" onClose={() => setShowScoringExplainer(false)}>
          <p>Your Overview scores and your overall QoL score are calculated a little differently, and both matter.</p>
          <p>The 5 Overview pillars (Comfort, Appetite, Sleep, Curiosity, Connection) draw on your pet's BEAAAAPP pain assessment — an adaptation of a validated veterinary pain-scoring framework — shown separately rather than averaged, so you can see what is changing. For cats, the Comfort score also incorporates assessment structures from the Feline Grimace Scale, a peer-reviewed facial-expression pain scale specific to cats. Sleep additionally reflects your own everyday sleep rating.</p>
          <p>Your overall QoL score is a single average across everything you record — the everyday-function questions (appetite, hydration, hygiene, senses, and more) and every category of the BEAAAAPP pain assessment, each counting equally. Anything you mark "Not sure," or haven't answered yet, is left out of the average rather than counted against your pet.</p>
          <p>Because an average can hide a single serious problem, one severe finding in the pain assessment will hold the overall rating down on its own — so a pet with one urgent issue won't be shown as doing well just because everything else looks fine.</p>
          <p>Together, these give you a fuller picture than either could alone. The scoring rules themselves are fixed and transparent — built using adaptations of these clinical frameworks alongside veterinary clinical expertise, not judged case-by-case or influenced by AI.</p>
        </Modal>
      )}

      <Footer />
    </div>
  )
}

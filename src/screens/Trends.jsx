import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import Btn from '../components/Btn'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import ConceptDefinition from '../components/ConceptDefinition'
import OverviewBars from '../components/OverviewBars'
import ChartView from '../components/ChartView'
import DayAnswersModal from '../components/DayAnswersModal'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { useConceptToggle } from '../lib/useConceptToggle'
import { computeOverviewCategories } from '../lib/scoring'
import { buildDailySeries } from '../lib/qolData'
import { buildChartRegistry, chartByKey } from '../lib/charts'
import { useMedications } from '../lib/medicationsData'
import { describeAssessmentDay } from '../lib/assessmentSummary'
import { formatDateDDMMYYYY } from '../lib/formatDate'
import { clearAssessmentNote } from '../lib/qolData'


export default function Trends() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { generalEntries, painEntries, loading, refresh } = useQolHistory(pet?.id)
  const { medications } = useMedications(pet?.id)
  const [showScoringExplainer, setShowScoringExplainer] = useState(false)
  // Which day's answers are open, as an ISO date. Null is closed.
  const [openDay, setOpenDay] = useState(null)
  const [noteError, setNoteError] = useState('')

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

  const overviewToggle = useConceptToggle()
  const activeOverviewConcept = WELLBEING_CONCEPTS.find((c) => c.key === overviewToggle.activeKey)

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
            <OverviewBars
              concepts={WELLBEING_CONCEPTS}
              overview={overview}
              onIconClick={overviewToggle.toggle}
            />
            <ConceptDefinition concept={activeOverviewConcept} />
            <p className="assessment-hint">
              From {formatDateDDMMYYYY(latestGeneralEntry?.date ?? latestPainEntry?.date)} — based on your most recent assessment.
            </p>
            {/* The five pillars used to have a collapsed chart each, stacked
                down this screen. Five headings you had to open one at a time
                is a poor way to find anything, and most owners never opened
                them — so the charts moved to the report, where you pick the
                ones the visit is actually about. */}
            <p className="assessment-hint">
              Want to see a pillar over time? Pick it in the report — you can choose any
              combination there.
            </p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>{goodBadDays?.title ?? 'Good / Bad Days'}</SectionTitle>
        {goodBadDays
          ? <ChartView chart={goodBadDays} onOpenDay={setOpenDay} />
          : <p>No assessments logged yet.</p>}
      </Card>

      <Card>
        <SectionTitle>{overallChart?.title ?? 'Overall QoL Over Time'}</SectionTitle>
        {overallChart ? <ChartView chart={overallChart} /> : <p>No assessments logged yet.</p>}
      </Card>

      <Card>
        <SectionTitle>History</SectionTitle>
        {notesHistory.length === 0 ? (
          <p>No notes logged yet.</p>
        ) : (
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
                <p className="history-date">{formatDateDDMMYYYY(entry.date)}</p>
                <p className="history-notes">{entry.notes}</p>
                <span className="history-open">See this day's assessment</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <button type="button" className="subtle-link" onClick={() => setShowScoringExplainer(true)}>
        How does QoL Companion calculate quality of life?
      </button>

      {openDay && (
        <DayAnswersModal
          title="This Day's Answers"
          dateLabel={formatDateDDMMYYYY(openDay)}
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

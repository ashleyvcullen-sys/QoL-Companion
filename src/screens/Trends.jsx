import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, FileDown } from 'lucide-react'
import Btn from '../components/Btn'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import ConceptDefinition from '../components/ConceptDefinition'
import OverviewBars from '../components/OverviewBars'
import ChoiceButtons from '../components/ChoiceButtons'
import ChartView from '../components/ChartView'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { useConceptToggle } from '../lib/useConceptToggle'
import { computeOverviewCategories } from '../lib/scoring'
import { buildDailySeries } from '../lib/qolData'
import { useBcsHistory } from '../lib/bcsData'
import { buildChartRegistry, chartByKey } from '../lib/charts'

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function Trends() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)
  const { entries: bcsEntries, loading: bcsLoading } = useBcsHistory(pet?.id)
  const [showScoringExplainer, setShowScoringExplainer] = useState(false)
  // Charts start collapsed. Seven full-height charts stacked made the screen
  // a long scroll where nothing was findable; collapsed, the page is a list
  // of what's trackable and you open the one you came for.
  const [bodyMetric, setBodyMetric] = useState('body:score')
  const [expandedCharts, setExpandedCharts] = useState({})

  function toggleChart(key) {
    setExpandedCharts((current) => ({ ...current, [key]: !current[key] }))
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
    bcsEntries,
    species: pet?.species,
  })

  const overallChart = chartByKey(charts, 'overall')
  const goodBadDays = chartByKey(charts, 'good-bad-days')
  const bcsChart = chartByKey(charts, 'body:score')
  const weightChart = chartByKey(charts, 'body:weight')
  const activeBodyChart = chartByKey(charts, bodyMetric)
  const hasBodyCharts = Boolean(bcsChart || weightChart)

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
        {goodBadDays ? <ChartView chart={goodBadDays} /> : <p>No assessments logged yet.</p>}
      </Card>

      <Card>
        <SectionTitle>{overallChart?.title ?? 'Overall QoL Over Time'}</SectionTitle>
        {overallChart ? <ChartView chart={overallChart} /> : <p>No assessments logged yet.</p>}
      </Card>

      <Card>
        <h2 className="section-title chart-collapse-heading">
          <button
            type="button"
            className="chart-collapse"
            aria-expanded={Boolean(expandedCharts.body)}
            onClick={() => toggleChart('body')}
          >
            <span>Body Condition / Weight Over Time</span>
            <ChevronDown size={18} className={`chart-chevron ${expandedCharts.body ? 'open' : ''}`.trim()} />
          </button>
        </h2>

        {expandedCharts.body && (
          <>
            {bcsLoading && <p>Loading…</p>}

            {!bcsLoading && !hasBodyCharts && (
              <p>No body condition scores logged yet.</p>
            )}

            {/* The metric switcher is only worth showing once there is more
                than one metric to switch between — with weight never recorded
                it would be a two-button control where one button always says
                "nothing here". */}
            {!bcsLoading && bcsChart && weightChart && (
              <ChoiceButtons
                options={[bcsChart, weightChart].map((chart) => ({
                  value: chart.key,
                  label: chart.label,
                }))}
                value={bodyMetric}
                onChange={setBodyMetric}
              />
            )}

            {!bcsLoading && hasBodyCharts && (
              <ChartView chart={activeBodyChart ?? bcsChart ?? weightChart} />
            )}

            {!bcsLoading && bcsChart && !weightChart && (
              <p className="assessment-hint">
                No weights logged yet. Weight is optional when you record a body condition score.
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>History</SectionTitle>
        {notesHistory.length === 0 ? (
          <p>No notes logged yet.</p>
        ) : (
          <div className="history-list">
            {notesHistory.map((entry) => (
              <div key={entry.date} className="history-item">
                <p className="history-date">{formatDateDDMMYYYY(entry.date)}</p>
                <p className="history-notes">{entry.notes}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <button type="button" className="subtle-link" onClick={() => setShowScoringExplainer(true)}>
        How does QoL Companion calculate quality of life?
      </button>

      {showScoringExplainer && (
        <Modal title="How does QoL Companion calculate quality of life?" onClose={() => setShowScoringExplainer(false)}>
          <p>Your Overview scores and your overall QoL score are calculated a little differently, and both matter.</p>
          <p>The 5 Overview pillars (Comfort, Appetite, Sleep, Curiosity, Connection) draw on your pet's BEAAAAPP pain assessment — an adaptation of a validated veterinary pain-scoring framework — broken out individually rather than averaged, so you can see which specific aspects of wellbeing are changing. For cats, the Comfort score also draws on the Feline Grimace Scale, a peer-reviewed facial-expression pain scale specific to cats. Sleep additionally reflects your own everyday sleep rating.</p>
          <p>Your overall QoL score is a single average across everything you record — the everyday-function questions (appetite, hydration, hygiene, senses, and more) and every category of the BEAAAAPP pain assessment, each counting equally. Anything you mark "Not sure," or haven't answered yet, is left out of the average rather than counted against your pet.</p>
          <p>Because an average can hide a single serious problem, one severe finding in the pain assessment will hold the overall rating down on its own — so a pet with one urgent issue won't be shown as doing well just because everything else looks fine.</p>
          <p>Together, these give you a fuller picture than either could alone. The scoring rules themselves are fixed and transparent — built using adaptations of these clinical frameworks alongside veterinary clinical expertise, not judged case-by-case or influenced by AI.</p>
        </Modal>
      )}

      <Footer />
    </div>
  )
}

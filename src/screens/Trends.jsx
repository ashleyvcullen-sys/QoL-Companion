import { useState } from 'react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import ConceptDefinition from '../components/ConceptDefinition'
import OverviewBars from '../components/OverviewBars'
import TrendLineChart from '../components/TrendLineChart'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { useConceptToggle } from '../lib/useConceptToggle'
import { computeOverviewCategories } from '../lib/scoring'
import { buildDailySeries } from '../lib/qolData'
import { useBcsHistory } from '../lib/bcsData'
import { BCS_MIN, BCS_MAX } from '../lib/bcsScale'
import TrendsCalendar from './trends/TrendsCalendar'

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function Trends() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)
  const { entries: bcsEntries, loading: bcsLoading } = useBcsHistory(pet?.id)
  const [showScoringExplainer, setShowScoringExplainer] = useState(false)

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  const hasLatestData = latestGeneralEntry || latestPainEntry
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const hasHistory = dailySeries.length > 0

  const overviewToggle = useConceptToggle()
  const activeOverviewConcept = WELLBEING_CONCEPTS.find((c) => c.key === overviewToggle.activeKey)

  const chartToggle = useConceptToggle()
  const activeChartConcept = WELLBEING_CONCEPTS.find((c) => c.key === chartToggle.activeKey)

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
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Good / bad days</SectionTitle>
        <TrendsCalendar generalEntries={generalEntries} painEntries={painEntries} />
        <p className="assessment-hint">
          A good quality of life means having more good days than bad.
        </p>
      </Card>

      <Card>
        <SectionTitle>General QoL over time</SectionTitle>
        {!hasHistory ? (
          <p>No assessments logged yet.</p>
        ) : (
          <TrendLineChart data={dailySeries} dataKey="generalTotal" color="#C97B8C" height={200} brush />
        )}
      </Card>

      {WELLBEING_CONCEPTS.map(({ key, label, Icon, color }) => (
        <Card key={key}>
          <div className="chart-title">
            <button
              type="button"
              className="chart-title-icon"
              style={{ background: color }}
              onClick={() => chartToggle.toggle(key)}
            >
              <Icon size={14} color="#fff" />
            </button>
            <SectionTitle>{label} over time</SectionTitle>
          </div>
          {chartToggle.activeKey === key && <ConceptDefinition concept={activeChartConcept} />}
          {!hasHistory ? (
            <p>No assessments logged yet.</p>
          ) : (
            <TrendLineChart data={dailySeries} dataKey={key} color={color} height={180} domain={[0, 100]} brush />
          )}
        </Card>
      ))}

      <Card>
        <SectionTitle>Body Condition Score over time</SectionTitle>
        {bcsLoading && <p>Loading…</p>}
        {!bcsLoading && bcsEntries.length === 0 && <p>No body condition scores logged yet.</p>}
        {!bcsLoading && bcsEntries.length > 0 && (
          <>
            {/* Fixed 1-9 domain rather than an auto-scaled axis: BCS is a
                fixed clinical scale, and letting it rescale would make a
                move from 5 to 6 look like a dramatic swing. */}
            <TrendLineChart
              data={bcsEntries}
              dataKey="score"
              color="#5C6F8A"
              height={180}
              domain={[BCS_MIN, BCS_MAX]}
              brush
            />
            <p className="assessment-hint">
              4–5 is ideal. Both lower and higher scores move away from ideal, so this chart
              reads differently to the others — the middle is best, not the top.
            </p>
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

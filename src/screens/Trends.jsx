import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import ConceptDefinition from '../components/ConceptDefinition'
import OverviewBars from '../components/OverviewBars'
import TrendLineChart from '../components/TrendLineChart'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { useConceptToggle } from '../lib/useConceptToggle'
import { computeOverviewCategories } from '../lib/scoring'
import { buildDailySeries } from '../lib/qolData'
import TrendsCalendar from './trends/TrendsCalendar'

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function Trends() {
  const { pets } = usePets()
  const pet = pets[0]
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  const hasLatestData = latestGeneralEntry || latestPainEntry
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const hasHistory = dailySeries.length > 0

  // No dedicated "baseline" flag on entries — the chronologically earliest
  // general/pain entry (arrays are fetched sorted ascending) serves as the
  // baseline for comparison.
  const hasBaseline = generalEntries.length > 0 || painEntries.length > 0
  const baselineOverview = computeOverviewCategories(generalEntries[0] ?? null, painEntries[0] ?? null)

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
              baselineOverview={baselineOverview}
              hasBaseline={hasBaseline}
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
        <TrendsCalendar generalEntries={generalEntries} />
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

      <Footer />
    </div>
  )
}

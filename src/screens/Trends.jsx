import { useState } from 'react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import ConceptDefinition from '../components/ConceptDefinition'
import OverviewBars from '../components/OverviewBars'
import ChoiceButtons from '../components/ChoiceButtons'
import TrendLineChart from '../components/TrendLineChart'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { useConceptToggle } from '../lib/useConceptToggle'
import {
  computeOverviewCategories,
  INDIVIDUAL_MEASURE_GROUPS,
  individualMeasureByKey,
} from '../lib/scoring'
import { buildDailySeries, buildMeasureSeries } from '../lib/qolData'
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
  const [bodyMetric, setBodyMetric] = useState('score')
  const [measureKey, setMeasureKey] = useState('vomiting')

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  const hasLatestData = latestGeneralEntry || latestPainEntry
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const hasHistory = dailySeries.length > 0

  // Weight is optional on a BCS entry, so the weight series is only the
  // subset of entries that actually carried one. Plotting every entry and
  // letting the line bridge the gaps would imply weights that were never
  // recorded.
  const weightEntries = bcsEntries.filter((entry) => entry.weightKg != null)
  const weights = weightEntries.map((entry) => entry.weightKg)
  // Unlike BCS, weight has no fixed clinical range, so the axis follows the
  // data with a little padding either side.
  const weightDomain = weights.length
    ? [Math.max(0, Math.min(...weights) - 0.5), Math.max(...weights) + 0.5]
    : [0, 1]

  // One series holding all 16 measures per date, so switching the picker is
  // just a different dataKey rather than a recompute.
  const measureSeries = buildMeasureSeries(generalEntries, painEntries)
  const activeMeasure = individualMeasureByKey(measureKey)
  // A measure only answered as "Not sure", or never reached in the wizard,
  // scores null on every date — charting that draws an empty box, so check
  // there is something to plot before rendering one.
  const measureHasData = measureSeries.some((row) => row[measureKey] != null)

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
        <SectionTitle>Single measure over time</SectionTitle>
        <p className="assessment-hint">
          The charts above roll several answers together. This one graphs a single question
          from the assessment on its own.
        </p>

        <div className="field">
          <label htmlFor="measure-picker">Measure</label>
          <select
            id="measure-picker"
            value={measureKey}
            onChange={(e) => setMeasureKey(e.target.value)}
          >
            {INDIVIDUAL_MEASURE_GROUPS.map((entry) => (
              <optgroup key={entry.group} label={entry.group}>
                {entry.measures.map((measure) => (
                  <option key={measure.key} value={measure.key}>{measure.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {loading && <p>Loading…</p>}
        {!loading && !measureHasData && (
          <p>No {activeMeasure?.label.toLowerCase()} answers logged yet.</p>
        )}
        {!loading && measureHasData && (
          <>
            {/* Fixed 0-10 so switching measures doesn't rescale the axis —
                otherwise a measure that never moved off 10 would look as
                dramatic as one that collapsed to 2. */}
            <TrendLineChart
              data={measureSeries}
              dataKey={measureKey}
              color={activeMeasure?.color ?? '#5C6F8A'}
              height={180}
              domain={[0, 10]}
              brush
            />
            <p className="assessment-hint">
              10 is best, 0 is worst — the same direction as the other charts. Days you didn't
              answer this question are skipped rather than counted as zero.
            </p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Body Condition / Weight over time</SectionTitle>
        <ChoiceButtons
          options={[
            { value: 'score', label: 'Body condition' },
            { value: 'weight', label: 'Weight' },
          ]}
          value={bodyMetric}
          onChange={setBodyMetric}
        />

        {bcsLoading && <p>Loading…</p>}

        {!bcsLoading && bodyMetric === 'score' && (
          bcsEntries.length === 0 ? (
            <p>No body condition scores logged yet.</p>
          ) : (
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
          )
        )}

        {!bcsLoading && bodyMetric === 'weight' && (
          weightEntries.length === 0 ? (
            <p>No weights logged yet. Weight is optional when you record a body condition score.</p>
          ) : (
            <>
              <TrendLineChart
                data={weightEntries}
                dataKey="weightKg"
                unit=" kg"
                color="#7A9A7E"
                height={180}
                domain={weightDomain}
                brush
              />
              <p className="assessment-hint">
                Only days you recorded a weight appear here. Weight and body condition can move
                independently — a steady score while weight drops is worth raising with your vet.
              </p>
            </>
          )
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

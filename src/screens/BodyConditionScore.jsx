import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import SeverityOptionList from '../components/SeverityOptionList'
import ChartView from '../components/ChartView'
import ChoiceButtons from '../components/ChoiceButtons'
import { buildChartRegistry, chartByKey } from '../lib/charts'
import { usePets } from '../lib/PetsContext'
import { saveBcsEntry, useBcsHistory } from '../lib/bcsData'
import { BCS_CITATION, BCS_IMAGE_CREDIT, bcsImageSrc, bcsLevelsFor, bcsSeverityColor, bcsSpeciesKey } from '../lib/bcsScale'

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function BodyConditionScore() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { entries, loading, refresh } = useBcsHistory(pet?.id)

  // The same two charts Trends draws, from the same descriptions — not a
  // second implementation that looks similar until one of them is edited.
  const [bodyMetric, setBodyMetric] = useState('body:score')
  const bodyCharts = buildChartRegistry({ bcsEntries: entries })
  const scoreChart = chartByKey(bodyCharts, 'body:score')
  const weightChart = chartByKey(bodyCharts, 'body:weight')
  const activeBodyChart = chartByKey(bodyCharts, bodyMetric) ?? scoreChart ?? weightChart

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysEntry = entries.find((entry) => entry.date === todayStr) ?? null
  const latestEntry = entries[entries.length - 1] ?? null

  const [score, setScore] = useState(null)
  // null means "untouched", so the field can fall back to whatever is stored
  // for today while still letting the user clear it back to empty.
  const [weight, setWeight] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Falls back to whatever is already saved for today, so revisiting the
  // screen shows the current answer rather than a blank slate.
  const selectedScore = score ?? todaysEntry?.score ?? null

  const weightValue =
    weight ?? (todaysEntry?.weightKg != null ? String(todaysEntry.weightKg) : '')
  const trimmedWeight = weightValue.trim()
  const parsedWeight = trimmedWeight === '' ? null : Number(trimmedWeight)
  const weightInvalid =
    parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight >= 500)

  // Most recent entry that actually carried a weight, so the hint stays useful
  // even when the last few entries were score-only.
  const lastWeighed = [...entries].reverse().find((entry) => entry.weightKg != null) ?? null

  const speciesKey = bcsSpeciesKey(pet.species)
  const levels = bcsLevelsFor(speciesKey)

  async function handleSave() {
    if (selectedScore == null || saving) return

    if (weightInvalid) {
      setErrorMessage('Enter a weight in kilograms, or leave it blank.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      await saveBcsEntry({
        petId: pet.id,
        score: selectedScore,
        // Upsert replaces the whole row, so an untouched weight has to be
        // passed back explicitly or saving a score would wipe it.
        weightKg: parsedWeight,
        notes: notes || todaysEntry?.notes || '',
      })
      refresh()
      navigate('/')
    } catch (error) {
      setErrorMessage(error.message || 'Something went wrong saving this score.')
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card className="bcs-intro">
        <SectionTitle>Body Condition / Weight</SectionTitle>
        <p>
          A 9-point scale for how much body fat {pet.name} is carrying. Feel the ribs, look
          from above for a waist, and look from the side for an abdominal tuck — then pick
          the description that fits best. 4–5 is ideal.
        </p>
        <p className="assessment-hint">
          Each illustration shows the view from above on the left and the view from the side
          on the right.
        </p>
        {!loading && latestEntry && (
          <p className="assessment-hint">
            Last recorded: {latestEntry.score}/9 on {formatDateDDMMYYYY(latestEntry.date)}.
          </p>
        )}
      </Card>

      <Card>
        <SeverityOptionList
          levels={levels.map((level) => level.text)}
          value={selectedScore}
          onChange={setScore}
          scores={levels.map((level) => level.score)}
          bandLabels={levels.map((level) => `${level.score} — ${level.label}`)}
          colorForIndex={(i) => bcsSeverityColor(levels[i].score)}
          imageSrcFor={(score) => bcsImageSrc(speciesKey, score)}
          imageAltFor={(score) => `Body condition score ${score} of 9 — view from above and from the side`}
          imageLayout="wide"
          descriptionOnSelect
        />

        <div className="field">
          <label htmlFor="bcs-weight">Body weight (optional)</label>
          <div className="input-with-unit">
            <input
              id="bcs-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="e.g. 4.8"
              value={weightValue}
              onChange={(e) => setWeight(e.target.value)}
            />
            <span className="input-unit">kg</span>
          </div>
          {lastWeighed && (
            <p className="assessment-hint">
              Last weighed: {lastWeighed.weightKg} kg on {formatDateDDMMYYYY(lastWeighed.date)}.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="bcs-notes">Notes (optional)</label>
          <textarea
            id="bcs-notes"
            value={notes || todaysEntry?.notes || ''}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Btn type="button" className="btn-block" onClick={handleSave} disabled={selectedScore == null || saving || weightInvalid}>
          {saving ? 'Saving…' : todaysEntry ? 'Update today’s score' : 'Save score'}
        </Btn>
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>

      {activeBodyChart && (
        <Card>
          <SectionTitle>Over Time</SectionTitle>

          {/* The switcher earns its place only once there is something to
              switch to — with no weights recorded it would be two buttons
              where one always says "nothing here". */}
          {scoreChart && weightChart && (
            <ChoiceButtons
              options={[scoreChart, weightChart].map((chart) => ({ value: chart.key, label: chart.label }))}
              value={bodyMetric}
              onChange={setBodyMetric}
            />
          )}

          <ChartView chart={activeBodyChart} />

          {scoreChart && !weightChart && (
            <p className="assessment-hint">
              No weights logged yet. Weight is optional when you record a body condition score.
            </p>
          )}

          <Btn
            type="button"
            className="btn-block"
            onClick={() => navigate('/export-report', {
              state: { preselect: [scoreChart, weightChart].filter(Boolean).map((chart) => chart.key) },
            })}
          >
            <FileDown size={16} /> Export this for your vet
          </Btn>
        </Card>
      )}

      <div className="bcs-sources">
        <p>{BCS_CITATION}</p>
        <p>{BCS_IMAGE_CREDIT}</p>
      </div>

      <Footer />
    </div>
  )
}

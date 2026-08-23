import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import TrendLineChart from '../components/TrendLineChart'
import { usePets } from '../lib/PetsContext'
import {
  SEVERITY,
  SEVERITY_COLOURS,
  SEVERITY_LABELS,
  chartConfigFor,
  conditionByKey,
  evaluateParameter,
  summariseEntry,
} from '../lib/conditions'
import ConditionParameter from '../components/ConditionParameter'
import MonthCalendar from '../components/MonthCalendar'
import ConditionEvents from '../components/ConditionEvents'
import PetText from '../components/PetText'
import {
  removePetCondition,
  saveConditionEntry,
  todayIsoDate,
  eventTypeByValue,
  useConditionEntries,
  useConditionEvents,
  usePetConditions,
} from '../lib/conditionsData'

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function ConditionMonitoring() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { conditions, loading, refresh } = usePetConditions(pet?.id)

  // Which condition is determined by the URL, so each one is a real page you
  // can navigate back to rather than a tab inside a single screen.
  const navigate = useNavigate()
  const { conditionKey } = useParams()
  const currentKey = conditionKey ?? null
  const definition = conditionByKey(currentKey)

  const { entries, loading: entriesLoading, refresh: refreshEntries } =
    useConditionEntries(pet?.id, currentKey)
  const { events, loading: eventsLoading, refresh: refreshEvents } =
    useConditionEvents(pet?.id, currentKey)

  // One object for every answer in the condition, including follow-ups.
  // Seeded from today's saved entry so revisiting shows what's there.
  const [draft, setDraft] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [chartKey, setChartKey] = useState(null)

  const today = todayIsoDate()
  const todaysEntry = entries.find((entry) => entry.date === today) ?? null
  const latestEntry = entries[entries.length - 1] ?? null

  const values = draft ?? todaysEntry?.values ?? {}

  // Any emergency answer anywhere in the condition, surfaced at the top of
  // the card as well as beside the question — an owner scrolling to save
  // shouldn't be able to miss it.
  const emergencies = (definition?.parameters ?? [])
    .map((parameter) => evaluateParameter(parameter, values[parameter.key], pet?.species))
    .filter((verdict) => verdict?.severity === SEVERITY.EMERGENCY)

  async function handleRemove(condition) {
    setErrorMessage('')
    try {
      await removePetCondition(condition.id)
      refresh()
      navigate('/conditions')
    } catch (error) {
      setErrorMessage(error.message || 'Could not remove that condition.')
    }
  }

  async function handleSave() {
    if (!definition || busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      // Blanks are dropped rather than stored as null, so "not asked today"
      // and "answered as nothing" never look the same in the history. 'unsure'
      // IS stored — it's a real answer, and losing it would make a deliberate
      // "not sure" indistinguishable from a skipped question.
      const stored = {}
      for (const [key, raw] of Object.entries(values)) {
        if (raw === '' || raw == null) continue
        stored[key] = raw
      }

      await saveConditionEntry({
        petId: pet.id,
        conditionKey: definition.key,
        values: stored,
        notes: notes || todaysEntry?.notes || '',
      })
      setDraft(null)
      setNotes('')
      refreshEntries()
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that entry.')
    } finally {
      setBusy(false)
    }
  }

  // One summary per logged day, oldest first — feeds both the timeline and
  // the concern-count chart from a single pass.
  const summaries = definition
    ? entries.map((entry) => ({
        date: entry.date,
        ...summariseEntry(definition, entry.values, pet?.species),
      }))
    : []

  // Recharts can only place a vertical line on an x value present in the
  // series, so an event on a day with no reading simply isn't drawn. It still
  // appears in the list below — the chart is a bonus, not the record.
  function markersFor(series) {
    const dates = new Set(series.map((point) => point.date))
    return events
      .filter((event) => dates.has(event.date))
      .map((event) => ({
        date: event.date,
        label: event.title,
        short: eventTypeByValue(event.type)?.value === 'medication_started' ? 'Rx' : '',
        colour: eventTypeByValue(event.type)?.colour,
      }))
  }

  const summaryByDate = new Map(summaries.map((day) => [day.date, day]))

  // Any parameter that can be turned into a series. Everything on the cardiac
  // form qualifies, but each has its own axis — see chartConfigFor.
  const graphable = (definition?.parameters ?? [])
    .map((parameter) => ({ parameter, config: chartConfigFor(parameter, entries, pet?.species) }))
    .filter((entry) => entry.config !== null)

  const activeChart = graphable.find((entry) => entry.parameter.key === chartKey) ?? graphable[0] ?? null


  return (
    <div className="screen">
      <HomeLink />

      <Link to="/conditions" className="subtle-link">← All Conditions</Link>

      {loading && <Card><p>Loading…</p></Card>}

      {!definition && !loading && (
        <Card>
          <SectionTitle>Not Found</SectionTitle>
          <p>That condition isn't available.</p>
          <Link to="/conditions" className="subtle-link">Back to All Conditions</Link>
        </Card>
      )}

      {definition && (
        <>
          <Card>
            <div className="condition-heading">
              {definition.Icon && (
                <span className="icon-badge condition-badge">
                  <definition.Icon size={34} color="#fff" />
                </span>
              )}
              <SectionTitle>{definition.label}</SectionTitle>
            </div>
            {definition.intro && (
              <p className="assessment-hint"><PetText template={definition.intro} pet={pet} /></p>
            )}
          </Card>

          <Card>
            {emergencies.length > 0 && (
              <p className="condition-emergency" role="alert">
                <AlertTriangle size={17} />
                <span>{emergencies[0].message}</span>
              </p>
            )}

            {definition.parameters.map((parameter, index) => (
              <ConditionParameter
                key={parameter.key}
                parameter={parameter}
                values={values}
                pet={pet}
                number={index + 1}
                onChange={setDraft}
              />
            ))}

            <div className="field">
              <label htmlFor="condition-notes">Notes (optional)</label>
              <textarea
                id="condition-notes"
                rows={2}
                value={notes || todaysEntry?.notes || ''}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Btn type="button" className="btn-block" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : todaysEntry ? 'Update today’s entry' : 'Save entry'}
            </Btn>
            {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
            {!entriesLoading && latestEntry && (
              <p className="assessment-hint">
                Last recorded {formatDateDDMMYYYY(latestEntry.date)}.
              </p>
            )}
          </Card>

          {summaries.length > 0 && (
            <Card>
              <SectionTitle>{pet.name}'s {definition.label} Summary</SectionTitle>
              <MonthCalendar
                dayFor={(dateKey) => {
                  const day = summaryByDate.get(dateKey)
                  if (!day?.severity) return null
                  return {
                    colour: SEVERITY_COLOURS[day.severity],
                    title: `${SEVERITY_LABELS[day.severity]}${day.flags ? ` — ${day.flags} flagged` : ''}`,
                  }
                }}
              />
            </Card>
          )}

          {summaries.length > 1 && (
            <Card>
              <SectionTitle>Things Flagged Each Day</SectionTitle>
              <TrendLineChart
                data={summaries}
                dataKey="flags"
                color="#C97A2E"
                height={160}
                domain={[0, Math.max(2, definition.parameters.length)]}
                brush
              />
              <p className="assessment-hint">
                How many findings were flagged on each day. A colour tells you something was
                wrong; this tells you how much — one thing off and four things off look very
                different on a chart, and the difference matters.
              </p>
            </Card>
          )}

          {graphable.length > 0 && activeChart && (
            <Card>
              <SectionTitle>Graph a Parameter</SectionTitle>

              <div className="field">
                <label htmlFor="condition-chart-picker">Parameter</label>
                <select
                  id="condition-chart-picker"
                  value={activeChart.parameter.key}
                  onChange={(e) => setChartKey(e.target.value)}
                >
                  {graphable.map(({ parameter }) => (
                    <option key={parameter.key} value={parameter.key}>{parameter.label}</option>
                  ))}
                </select>
              </div>

              <TrendLineChart
                data={activeChart.config.points}
                dataKey="value"
                unit={activeChart.config.unit}
                color="#8A5C6F"
                height={180}
                domain={activeChart.config.domain}
                markers={markersFor(activeChart.config.points)}
                referenceValue={activeChart.config.threshold}
                referenceLabel={activeChart.config.threshold != null ? `${activeChart.config.threshold}` : undefined}
                brush
              />
              {activeChart.config.caption && (
                <p className="assessment-hint">{activeChart.config.caption}</p>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle>Events</SectionTitle>
            <p className="assessment-hint">
              Episodes, diagnoses, and medications started or stopped. Anything recorded on a
              day that also has a reading is marked on the charts above.
            </p>
            <ConditionEvents
              petId={pet.id}
              conditionKey={definition.key}
              events={events}
              loading={eventsLoading}
              onChange={refreshEvents}
            />
          </Card>

          <Card>
            <SectionTitle>Stop Tracking</SectionTitle>
            <p className="assessment-hint">
              Removing {definition.label} deletes the readings and events recorded for it. Your
              general quality of life history isn't affected.
            </p>
            {conditions
              .filter((condition) => condition.conditionKey === definition.key)
              .map((condition) => (
                <Btn
                  key={condition.id}
                  type="button"
                  variant="danger"
                  className="btn-block"
                  onClick={() => handleRemove(condition)}
                >
                  <Trash2 size={16} /> Stop tracking {definition.label}
                </Btn>
              ))}
          </Card>

        </>
      )}

      <Footer />
    </div>
  )
}

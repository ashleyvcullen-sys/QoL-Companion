import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import SeverityOptionList from '../components/SeverityOptionList'
import { usePets } from '../lib/PetsContext'
import { saveBcsEntry, useBcsHistory } from '../lib/bcsData'
import { BCS_CITATION, bcsLevelsFor, bcsSeverityColor } from '../lib/bcsScale'

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

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysEntry = entries.find((entry) => entry.date === todayStr) ?? null
  const latestEntry = entries[entries.length - 1] ?? null

  const [score, setScore] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Falls back to whatever is already saved for today, so revisiting the
  // screen shows the current answer rather than a blank slate.
  const selectedScore = score ?? todaysEntry?.score ?? null

  const levels = bcsLevelsFor(pet.species)

  async function handleSave() {
    if (selectedScore == null || saving) return
    setSaving(true)
    setErrorMessage('')

    try {
      await saveBcsEntry({
        petId: pet.id,
        score: selectedScore,
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

      <Card>
        <SectionTitle>Body Condition Score</SectionTitle>
        <p className="beap-citation">{BCS_CITATION}</p>
        <p>
          A 9-point scale for how much body fat {pet.name} is carrying. Feel the ribs, look
          from above for a waist, and look from the side for an abdominal tuck — then pick
          the description that fits best. 4–5 is ideal.
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
        />

        <div className="field">
          <label htmlFor="bcs-notes">Notes (optional)</label>
          <textarea
            id="bcs-notes"
            value={notes || todaysEntry?.notes || ''}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Btn type="button" className="btn-block" onClick={handleSave} disabled={selectedScore == null || saving}>
          {saving ? 'Saving…' : todaysEntry ? 'Update today’s score' : 'Save score'}
        </Btn>
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>

      <Footer />
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import Btn from './Btn'
import ChoiceButtons from './ChoiceButtons'
import Modal from './Modal'
import { EVENT_TYPES, addConditionEvent, deleteConditionEvent, eventTypeByValue, todayIsoDate } from '../lib/conditionsData'
import { formatDateDDMMYYYY } from '../lib/formatDate'


const EMPTY = { type: 'episode', title: '', notes: '', date: todayIsoDate() }

export default function ConditionEvents({ petId, conditionKey, events, loading, onChange }) {
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // Set after saving a "medication started" event, to offer the hand-off.
  const [medicationPrompt, setMedicationPrompt] = useState(null)

  async function handleSave() {
    const title = form.title.trim()
    if (!title) {
      setErrorMessage(
        form.type === 'medication_started' || form.type === 'medication_stopped'
          ? 'Which medication?'
          : 'Give this event a short description.',
      )
      return
    }

    setBusy(true)
    setErrorMessage('')
    try {
      await addConditionEvent({
        petId,
        conditionKey,
        type: form.type,
        title,
        notes: form.notes,
        eventDate: form.date,
      })

      // Recording that a drug was started is not the same as setting up its
      // doses and reminders. Offering the hand-off at the moment the owner is
      // already thinking about it is the only time they're likely to do it.
      if (form.type === 'medication_started') setMedicationPrompt(title)

      setForm(EMPTY)
      setAdding(false)
      onChange()
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that event.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(event) {
    setErrorMessage('')
    try {
      await deleteConditionEvent(event.id)
      onChange()
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete that event.')
    }
  }

  const isMedication = form.type === 'medication_started' || form.type === 'medication_stopped'

  return (
    <>
      {loading && <p>Loading…</p>}

      {!loading && events.length === 0 && !adding && (
        // PENDING ASH — "above" became "below". The Events card moved to sit
        // directly under the questionnaire on 4 Sep 2026, so the calendar it
        // points at is now underneath it rather than over it.
        <p>
          Nothing recorded yet. Episodes, diagnoses and medication changes are marked on the
          calendar below.
        </p>
      )}

      {!loading && events.length > 0 && (
        <div className="event-list">
          {[...events].reverse().map((event) => {
            const type = eventTypeByValue(event.type)
            return (
              <div key={event.id} className="event-row">
                <span className="event-dot" style={{ background: type?.colour ?? 'var(--border)' }} />
                <div className="event-body">
                  <span className="event-title">{event.title}</span>
                  <span className="assessment-hint">
                    {type?.label ?? event.type} — {formatDateDDMMYYYY(event.date)}
                  </span>
                  {event.notes && <span className="assessment-hint">{event.notes}</span>}
                </div>
                <button type="button" aria-label={`Delete ${event.title}`} onClick={() => handleDelete(event)}>
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {adding ? (
        <>
          <div className="field">
            <label>What happened?</label>
            <ChoiceButtons
              options={EVENT_TYPES.map(({ value, label }) => ({ value, label }))}
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
            />
          </div>

          <div className="field">
            <label htmlFor="event-title">
              {isMedication ? 'Medication name' : form.type === 'diagnosis' ? 'Diagnosis' : 'Short description'}
            </label>
            {/* The placeholder is per event type — see EVENT_TYPES in
                lib/conditionsData.js. */}
            <input
              id="event-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={eventTypeByValue(form.type)?.placeholder ?? ''}
            />
          </div>

          <div className="field">
            <label htmlFor="event-date">Date</label>
            <input
              id="event-date"
              type="date"
              value={form.date}
              max={todayIsoDate()}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="event-notes">Notes (optional)</label>
            <textarea
              id="event-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <Btn type="button" className="btn-block" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save event'}
          </Btn>
          <button type="button" className="subtle-link" onClick={() => { setAdding(false); setErrorMessage('') }}>
            Cancel
          </button>
        </>
      ) : (
        <Btn type="button" className="btn-block" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add an event
        </Btn>
      )}

      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

      {medicationPrompt && (
        <Modal title="Add this to Medications?" onClose={() => setMedicationPrompt(null)}>
          <p>
            You've recorded that {medicationPrompt} was started. Would you like to add it to
            Medications, so you can log each dose and be reminded when one is due?
          </p>
          <Btn
            type="button"
            className="btn-block"
            onClick={() => {
              const name = medicationPrompt
              setMedicationPrompt(null)
              // Name travels in navigation state so the form opens filled in.
              navigate('/medications', { state: { newMedicationName: name } })
            }}
          >
            Set up reminders
          </Btn>
          <button type="button" className="subtle-link modal-secondary-link" onClick={() => setMedicationPrompt(null)}>
            Not now
          </button>
        </Modal>
      )}
    </>
  )
}

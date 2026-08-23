import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { usePets } from '../lib/PetsContext'
import {
  createMedication,
  deleteMedication,
  logDose,
  todayIsoDate,
  unlogDose,
  updateMedication,
  useMedications,
} from '../lib/medicationsData'
import { scheduleMedicationReminders, cancelMedicationReminders } from '../lib/notifications'

const EMPTY_FORM = { name: '', dose: '', times: [], notes: '' }

function formatTime(time) {
  const [hour, minute] = time.split(':').map(Number)
  const suffix = hour < 12 ? 'am' : 'pm'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')}${suffix}`
}

export default function Medications() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { medications, doses, loading, refresh } = useMedications(pet?.id)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const active = medications.filter((medication) => medication.active)
  const inactive = medications.filter((medication) => !medication.active)

  function doseGiven(medicationId, time) {
    return doses.some((dose) => dose.medicationId === medicationId && dose.time === time)
  }

  function asNeededCount(medicationId) {
    return doses.filter((dose) => dose.medicationId === medicationId && dose.time == null).length
  }

  function startAdd() {
    setEditingId('new')
    setForm(EMPTY_FORM)
    setErrorMessage('')
  }

  function startEdit(medication) {
    setEditingId(medication.id)
    setForm({
      name: medication.name,
      dose: medication.dose ?? '',
      times: [...medication.times],
      notes: medication.notes ?? '',
    })
    setErrorMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErrorMessage('')
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) {
      setErrorMessage('Give the medication a name.')
      return
    }

    setBusy(true)
    setErrorMessage('')
    try {
      // Sorted so the reminder slot order matches the order shown on screen —
      // otherwise editing times could silently reassign which slot holds
      // which notification id.
      const times = [...form.times].filter(Boolean).sort()
      const saved = editingId === 'new'
        ? await createMedication({ petId: pet.id, name, dose: form.dose, times, notes: form.notes })
        : await updateMedication(editingId, { name, dose: form.dose, times, notes: form.notes })

      await scheduleMedicationReminders({
        medicationId: saved.id,
        medicationName: saved.name,
        petName: pet.name,
        dose: saved.dose,
        times: saved.times,
        active: saved.active,
      })

      cancelEdit()
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that medication.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleDose(medication, time) {
    setErrorMessage('')
    try {
      if (doseGiven(medication.id, time)) {
        await unlogDose({ medicationId: medication.id, time, date: todayIsoDate() })
      } else {
        await logDose({ medicationId: medication.id, time, date: todayIsoDate() })
      }
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not record that dose.')
    }
  }

  async function handleLogAsNeeded(medication) {
    setErrorMessage('')
    try {
      await logDose({ medicationId: medication.id, time: null, date: todayIsoDate() })
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not record that dose.')
    }
  }

  async function handleSetActive(medication, nextActive) {
    setErrorMessage('')
    try {
      const saved = await updateMedication(medication.id, { active: nextActive })
      await scheduleMedicationReminders({
        medicationId: saved.id,
        medicationName: saved.name,
        petName: pet.name,
        dose: saved.dose,
        times: saved.times,
        active: saved.active,
      })
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not update that medication.')
    }
  }

  async function handleDelete(medication) {
    setErrorMessage('')
    try {
      await cancelMedicationReminders(medication.id)
      await deleteMedication(medication.id)
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete that medication.')
    }
  }

  const editing = editingId !== null

  return (
    <div className="screen">
      <HomeLink />

      <Card className="bcs-intro">
        <SectionTitle>Medications</SectionTitle>
        <p>
          Keep {pet.name}'s medications in one place, get reminded when each dose is due, and
          tick them off as you go.
        </p>
        <p className="assessment-hint">
          Ticking a dose records it against today, so you can check whether it's already been
          given — and show the record at the next vet visit.
        </p>
      </Card>

      <Card>
        <SectionTitle>Today</SectionTitle>
        {loading && <p>Loading…</p>}
        {!loading && active.length === 0 && <p>No medications added yet.</p>}

        {!loading && active.map((medication) => (
          <div key={medication.id} className="med-today-row">
            <div className="med-today-header">
              <span className="med-name">{medication.name}</span>
              {medication.dose && <span className="med-dose">{medication.dose}</span>}
            </div>

            {medication.times.length === 0 ? (
              <div className="med-slot-row">
                <button
                  type="button"
                  className="med-slot"
                  onClick={() => handleLogAsNeeded(medication)}
                >
                  <Plus size={14} /> Log a dose
                </button>
                <span className="assessment-hint">
                  As needed — {asNeededCount(medication.id)} given today
                </span>
              </div>
            ) : (
              <div className="med-slot-row">
                {medication.times.map((time) => {
                  const given = doseGiven(medication.id, time)
                  return (
                    <button
                      key={time}
                      type="button"
                      className={`med-slot ${given ? 'given' : ''}`.trim()}
                      onClick={() => handleToggleDose(medication, time)}
                      aria-pressed={given}
                    >
                      {given && <Check size={14} />} {formatTime(time)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>

      <Card>
        <SectionTitle>{editing ? (editingId === 'new' ? 'Add medication' : 'Edit medication') : 'All medications'}</SectionTitle>

        {editing ? (
          <>
            <div className="field">
              <label htmlFor="med-name">Name</label>
              <input
                id="med-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Gabapentin"
              />
            </div>

            <div className="field">
              <label htmlFor="med-dose">Dose (optional)</label>
              <input
                id="med-dose"
                value={form.dose}
                onChange={(e) => setForm({ ...form, dose: e.target.value })}
                placeholder="e.g. 1 tablet, 0.5 ml"
              />
            </div>

            <div className="field">
              <label>Times of day</label>
              {form.times.map((time, index) => (
                <div key={index} className="med-time-edit">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      const times = [...form.times]
                      times[index] = e.target.value
                      setForm({ ...form, times })
                    }}
                  />
                  <button
                    type="button"
                    className="med-time-remove"
                    aria-label="Remove this time"
                    onClick={() => setForm({ ...form, times: form.times.filter((_, i) => i !== index) })}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="subtle-link"
                onClick={() => setForm({ ...form, times: [...form.times, '08:00'] })}
              >
                <Plus size={14} /> Add a time
              </button>
              <p className="assessment-hint">
                Leave empty for an as-needed medication — you'll be able to log doses without
                being reminded.
              </p>
            </div>

            <div className="field">
              <label htmlFor="med-notes">Notes (optional)</label>
              <textarea
                id="med-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. give with food"
              />
            </div>

            <Btn type="button" className="btn-block" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : 'Save medication'}
            </Btn>
            <button type="button" className="subtle-link" onClick={cancelEdit} disabled={busy}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {medications.length === 0 && !loading && <p>Nothing added yet.</p>}

            {[...active, ...inactive].map((medication) => (
              <div key={medication.id} className={`med-list-row ${medication.active ? '' : 'inactive'}`.trim()}>
                <div className="med-list-info">
                  <span className="med-name">{medication.name}</span>
                  <span className="assessment-hint">
                    {medication.dose ? `${medication.dose} — ` : ''}
                    {medication.times.length === 0
                      ? 'as needed'
                      : medication.times.map(formatTime).join(', ')}
                    {medication.active ? '' : ' — stopped'}
                  </span>
                  {medication.notes && <span className="assessment-hint">{medication.notes}</span>}
                </div>
                <div className="med-list-actions">
                  <button type="button" aria-label={`Edit ${medication.name}`} onClick={() => startEdit(medication)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="subtle-link"
                    onClick={() => handleSetActive(medication, !medication.active)}
                  >
                    {medication.active ? 'Stop' : 'Restart'}
                  </button>
                  <button type="button" aria-label={`Delete ${medication.name}`} onClick={() => handleDelete(medication)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            <Btn type="button" className="btn-block" onClick={startAdd}>
              <Plus size={16} /> Add medication
            </Btn>
          </>
        )}
      </Card>

      <Footer />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BellOff, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import ChoiceButtons from '../components/ChoiceButtons'
import { usePets } from '../lib/PetsContext'
import {
  createMedication,
  deleteMedication,
  frequencySlotKey,
  logDose,
  todayIsoDate,
  unlogDose,
  updateMedication,
  useMedications,
  weekStartIsoDate,
} from '../lib/medicationsData'
import {
  cancelMedicationReminders,
  checkNotificationPermission,
  requestNotificationPermission,
  scheduleMedicationReminders,
} from '../lib/notifications'

const EMPTY_FORM = {
  name: '',
  dose: '',
  scheduleMode: 'times',
  times: ['08:00'],
  frequencyCount: 2,
  frequencyPeriod: 'day',
  remindersEnabled: true,
  notes: '',
}

const MODE_OPTIONS = [
  { value: 'times', label: 'At set times' },
  { value: 'frequency', label: 'A number of times' },
  { value: 'as_needed', label: 'As needed' },
]

function formatTime(time) {
  const [hour, minute] = time.split(':').map(Number)
  const suffix = hour < 12 ? 'am' : 'pm'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')}${suffix}`
}

function describeSchedule(medication) {
  if (medication.scheduleMode === 'as_needed') return 'as needed'
  if (medication.scheduleMode === 'frequency') {
    const count = medication.frequencyCount ?? 1
    return `${count}× per ${medication.frequencyPeriod === 'week' ? 'week' : 'day'}`
  }
  return medication.times.map(formatTime).join(', ')
}

export default function Medications() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { medications, doses, loading, refresh } = useMedications(pet?.id)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notifStatus, setNotifStatus] = useState(null)

  const isNative = Capacitor.isNativePlatform()

  // Arriving from a "medication started" event on a condition: open the add
  // form with the name already in, so the owner finishes one thought rather
  // than starting a new one. The state is cleared immediately so a refresh or
  // a back-and-forward doesn't reopen a form they already dealt with.
  const location = useLocation()
  const navigate = useNavigate()
  // Captured on first render, not read live: the effect below clears router
  // state once the prefill has been consumed, which would take this with it
  // and strand the owner here with no way back to what they were doing.
  const [returnTo] = useState(() => location.state?.returnTo ?? null)
  const [returnLabel] = useState(() => location.state?.returnLabel ?? 'where you were')

  const prefillName = location.state?.newMedicationName

  useEffect(() => {
    if (!prefillName) return
    setEditingId('new')
    setForm({ ...EMPTY_FORM, name: prefillName })
    navigate(location.pathname, { replace: true, state: null })
  }, [prefillName, navigate, location.pathname])

  useEffect(() => {
    if (!isNative) return
    checkNotificationPermission().then(setNotifStatus).catch(() => setNotifStatus(null))
  }, [isNative])

  const active = medications.filter((medication) => medication.active)
  const inactive = medications.filter((medication) => !medication.active)

  const today = todayIsoDate()
  const weekStart = weekStartIsoDate()

  // A daily course counts against today; a weekly one against the whole
  // week, which is why the hook fetches from the week's start rather than
  // just today.
  function dosesFor(medication) {
    const scope = medication.scheduleMode === 'frequency' && medication.frequencyPeriod === 'week'
      ? doses.filter((dose) => dose.date >= weekStart)
      : doses.filter((dose) => dose.date === today)
    return scope.filter((dose) => dose.medicationId === medication.id)
  }

  function slotTaken(medication, slot) {
    return dosesFor(medication).some((dose) => dose.time === slot)
  }

  // Any medication with reminders switched on, but the OS permission
  // missing, is silently not reminding anyone.
  const remindersBlocked = isNative
    && notifStatus !== 'granted'
    && active.some((m) => m.scheduleMode === 'times' && m.remindersEnabled)

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
      scheduleMode: medication.scheduleMode,
      times: medication.times.length > 0 ? [...medication.times] : ['08:00'],
      frequencyCount: medication.frequencyCount ?? 2,
      frequencyPeriod: medication.frequencyPeriod ?? 'day',
      remindersEnabled: medication.remindersEnabled,
      notes: medication.notes ?? '',
    })
    setErrorMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErrorMessage('')
  }

  async function syncReminders(saved) {
    await scheduleMedicationReminders({
      medicationId: saved.id,
      medicationName: saved.name,
      petName: pet.name,
      dose: saved.dose,
      times: saved.times,
      active: saved.active,
      remindersEnabled: saved.remindersEnabled,
    })
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) {
      setErrorMessage('Give the medication a name.')
      return
    }
    if (form.scheduleMode === 'times' && form.times.filter(Boolean).length === 0) {
      setErrorMessage('Add at least one time, or choose a different schedule.')
      return
    }

    setBusy(true)
    setErrorMessage('')
    try {
      // Sorted so reminder slot order matches what's shown, and de-duplicated
      // so two identical times can't create two reminders for one dose.
      const times = [...new Set(form.times.filter(Boolean))].sort()
      const payload = {
        name,
        dose: form.dose,
        notes: form.notes,
        scheduleMode: form.scheduleMode,
        times,
        frequencyCount: Number(form.frequencyCount) || 1,
        frequencyPeriod: form.frequencyPeriod,
        remindersEnabled: form.scheduleMode === 'times' ? form.remindersEnabled : false,
      }

      const saved = editingId === 'new'
        ? await createMedication({ petId: pet.id, ...payload })
        : await updateMedication(editingId, payload)

      await syncReminders(saved)

      if (saved.scheduleMode === 'times' && saved.remindersEnabled && isNative && notifStatus !== 'granted') {
        const display = await requestNotificationPermission()
        setNotifStatus(display)
        if (display === 'granted') await syncReminders(saved)
      }

      cancelEdit()
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that medication.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleSlot(medication, slot) {
    setErrorMessage('')
    try {
      if (slotTaken(medication, slot)) {
        await unlogDose({ medicationId: medication.id, time: slot, date: today })
      } else {
        await logDose({ medicationId: medication.id, time: slot, date: today })
      }
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not record that dose.')
    }
  }

  async function handleLogAsNeeded(medication) {
    setErrorMessage('')
    try {
      await logDose({ medicationId: medication.id, time: null, date: today })
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not record that dose.')
    }
  }

  async function handleSetActive(medication, nextActive) {
    setErrorMessage('')
    try {
      const saved = await updateMedication(medication.id, { active: nextActive })
      await syncReminders(saved)
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

  async function handleEnableNotifications() {
    const display = await requestNotificationPermission()
    setNotifStatus(display)
    if (display !== 'granted') return
    for (const medication of active) {
      await syncReminders(medication).catch(() => {})
    }
    refresh()
  }

  const editing = editingId !== null

  function renderSlots(medication) {
    if (medication.scheduleMode === 'as_needed') {
      const count = dosesFor(medication).filter((dose) => dose.time == null).length
      return (
        <div className="med-slot-row">
          <button type="button" className="med-slot" onClick={() => handleLogAsNeeded(medication)}>
            <Plus size={14} /> Log a dose
          </button>
          <span className="assessment-hint">As needed — {count} given today</span>
        </div>
      )
    }

    if (medication.scheduleMode === 'frequency') {
      const total = medication.frequencyCount ?? 1
      const period = medication.frequencyPeriod === 'week' ? 'this week' : 'today'
      const taken = dosesFor(medication).filter((dose) => dose.time != null).length
      return (
        <>
          <div className="med-slot-row">
            {Array.from({ length: total }, (_, index) => {
              const slot = frequencySlotKey(index)
              const given = slotTaken(medication, slot)
              return (
                <button
                  key={slot}
                  type="button"
                  className={`med-slot ${given ? 'given' : ''}`.trim()}
                  onClick={() => handleToggleSlot(medication, slot)}
                  aria-pressed={given}
                >
                  {given && <Check size={14} />} Dose {index + 1}
                </button>
              )
            })}
          </div>
          <span className="assessment-hint">{taken} of {total} {period}</span>
        </>
      )
    }

    return (
      <div className="med-slot-row">
        {medication.times.map((time) => {
          const given = slotTaken(medication, time)
          return (
            <button
              key={time}
              type="button"
              className={`med-slot ${given ? 'given' : ''}`.trim()}
              onClick={() => handleToggleSlot(medication, time)}
              aria-pressed={given}
            >
              {given && <Check size={14} />} {formatTime(time)}
            </button>
          )
        })}
        {!medication.remindersEnabled && (
          <span className="assessment-hint"><BellOff size={13} /> reminders off</span>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <HomeLink />

      {returnTo && (
        <button type="button" className="subtle-link" onClick={() => navigate(returnTo)}>
          ← Back to {returnLabel}
        </button>
      )}

      <Card className="bcs-intro">
        <SectionTitle>Medications</SectionTitle>
        <p>
          Keep {pet.name}'s medications in one place, and tick each dose off as you give it.
        </p>
        <p className="assessment-hint">
          Ticking a dose records it against today, so you can check whether it's already been
          given — and show the record at the next vet visit.
        </p>
      </Card>

      {remindersBlocked && (
        <Card>
          <SectionTitle>Reminders are switched off on this device</SectionTitle>
          <p>
            You've asked to be reminded about {pet.name}'s medication, but notifications aren't
            permitted for QoL Companion — so no reminder will arrive.
          </p>
          <Btn type="button" className="btn-block" onClick={handleEnableNotifications}>
            Allow notifications
          </Btn>
        </Card>
      )}

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
            {renderSlots(medication)}
          </div>
        ))}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>

      <Card>
        <SectionTitle>
          {editing ? (editingId === 'new' ? 'Add medication' : 'Edit medication') : 'All medications'}
        </SectionTitle>

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
              <label>How is it given?</label>
              <ChoiceButtons
                options={MODE_OPTIONS}
                value={form.scheduleMode}
                onChange={(scheduleMode) => setForm({ ...form, scheduleMode })}
              />
            </div>

            {form.scheduleMode === 'times' && (
              <>
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
                </div>

                <label className="med-reminder-toggle">
                  <input
                    type="checkbox"
                    checked={form.remindersEnabled}
                    onChange={(e) => setForm({ ...form, remindersEnabled: e.target.checked })}
                  />
                  <span>Remind me at these times</span>
                </label>
                <p className="assessment-hint">
                  {isNative
                    ? 'A notification will arrive on this device at each time above.'
                    : 'Reminders only work in the app on your phone, not in a browser.'}
                </p>
              </>
            )}

            {form.scheduleMode === 'frequency' && (
              <>
                <div className="med-frequency-row">
                  <div className="field">
                    <label htmlFor="med-freq-count">How many times</label>
                    <input
                      id="med-freq-count"
                      type="number"
                      min="1"
                      max="12"
                      value={form.frequencyCount}
                      onChange={(e) => setForm({ ...form, frequencyCount: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="med-freq-period">Per</label>
                    <select
                      id="med-freq-period"
                      value={form.frequencyPeriod}
                      onChange={(e) => setForm({ ...form, frequencyPeriod: e.target.value })}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                    </select>
                  </div>
                </div>
                <p className="assessment-hint">
                  You'll get a tick box per dose to mark off, but no reminders — there's no set
                  time to remind you at. Choose "At set times" if you want to be notified.
                </p>
              </>
            )}

            {form.scheduleMode === 'as_needed' && (
              <p className="assessment-hint">
                You'll be able to log a dose whenever you give one, with no schedule and no
                reminders.
              </p>
            )}

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
                    {describeSchedule(medication)}
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

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
  monthStartIsoDate,
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
  reminderTime: '08:00',
  reminderDays: [],
  notes: '',
  startedOn: '',
  endedOn: '',
}

// Monday first, the way a week is read here. Values are JavaScript weekday
// numbers so nothing has to translate them on the way to a notification.
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

// Stops at 28. A reminder set for the 29th, 30th or 31st simply would not
// fire in the months that have no such date — silently, five times a year for
// the 31st — and an owner would have no way of knowing.
const MONTH_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))

// What the reminders will actually do, in words, for the line under the time
// picker. It used to say "Once a month" whatever the frequency, which was
// wrong the moment anyone chose twice a month — and wrong in the direction
// that matters, since it described fewer reminders than they would get.
//
// Daily is the odd one out and says so: one reminder covers the whole day's
// doses rather than one per dose, because there is no way to know how the
// owner spaces them.
function describeReminderPlan(form) {
  const count = Number(form.frequencyCount) || 1
  const chosen = (form.reminderDays ?? []).length

  if (form.frequencyPeriod === 'day') {
    return count === 1
      ? 'One reminder each day, at this time.'
      : `One reminder each day at this time, mentioning all ${count} doses.`
  }

  const period = form.frequencyPeriod === 'week' ? 'week' : 'month'
  const anchor = form.frequencyPeriod === 'week'
    ? 'the same weekday the course started'
    : 'the same date the course started'

  if (chosen === 0) {
    return count === 1
      ? `One reminder each ${period}, on ${anchor}.`
      : `${count} doses a ${period}, but one reminder — on ${anchor}. Pick days below to be reminded for each.`
  }

  return chosen === 1
    ? `One reminder each ${period}, on the day picked below.`
    : `${chosen} reminders each ${period}, on the days picked below.`
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
    const period = medication.frequencyPeriod === 'week' ? 'week'
      : medication.frequencyPeriod === 'month' ? 'month'
        : 'day'
    return `${count}× per ${period}`
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
  const monthStart = monthStartIsoDate()

  // A daily course counts against today; a weekly one against the whole
  // week, which is why the hook fetches from the week's start rather than
  // just today.
  function dosesFor(medication) {
    // Which doses count towards the tally: a daily course counts today's, a
    // weekly one the whole week, a monthly one the whole month.
    const period = medication.scheduleMode === 'frequency' ? medication.frequencyPeriod : null
    const scope = period === 'month'
      ? doses.filter((dose) => dose.date >= monthStart)
      : period === 'week'
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
    && active.some((m) => m.scheduleMode !== 'as_needed' && m.remindersEnabled)

  function toggleReminderDay(day) {
    const chosen = form.reminderDays ?? []
    if (chosen.includes(day)) {
      setForm({ ...form, reminderDays: chosen.filter((entry) => entry !== day) })
      return
    }
    // Capped at the number of doses. Three reminders for a medication given
    // twice a week would have the app telling an owner to give a dose that
    // was never prescribed — the one kind of wrong a medication reminder
    // must not be.
    if (chosen.length >= (Number(form.frequencyCount) || 1)) return
    setForm({ ...form, reminderDays: [...chosen, day].sort((a, b) => a - b) })
  }

  // Lowering the count has to drop days that no longer fit, or the form would
  // sit in a state its own rule forbids.
  function setFrequencyCount(raw) {
    const count = Number(raw) || 1
    setForm({
      ...form,
      frequencyCount: raw,
      reminderDays: (form.reminderDays ?? []).slice(0, count),
    })
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
      startedOn: medication.startedOn ?? '',
      reminderTime: medication.reminderTime ?? '08:00',
      reminderDays: medication.reminderDays ?? [],
      endedOn: medication.endedOn ?? '',
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
      scheduleMode: saved.scheduleMode,
      frequencyPeriod: saved.frequencyPeriod,
      frequencyCount: saved.frequencyCount,
      reminderTime: saved.reminderTime,
      reminderDays: saved.reminderDays,
      startedOn: saved.startedOn,
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
        // As-needed is the only mode that cannot remind — it answers to signs,
        // not to a clock. Frequency can, at a time the owner picked.
        remindersEnabled: form.scheduleMode === 'as_needed' ? false : form.remindersEnabled,
        reminderTime: form.reminderTime,
        reminderDays: form.reminderDays,
        startedOn: form.startedOn,
        endedOn: form.endedOn,
      }

      const saved = editingId === 'new'
        ? await createMedication({ petId: pet.id, ...payload })
        : await updateMedication(editingId, payload)

      await syncReminders(saved)

      if (saved.remindersEnabled && isNative && notifStatus !== 'granted') {
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
      // Stopping a course records when, unless the owner already said. The
      // date is what the calendar draws; without it, "stopped" is a fact with
      // no position in time.
      const saved = await updateMedication(medication.id, {
        active: nextActive,
        ...(nextActive === false && !medication.endedOn ? { endedOn: todayIsoDate() } : {}),
        ...(nextActive === true ? { endedOn: '' } : {}),
      })
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
      const period = medication.frequencyPeriod === 'week' ? 'this week'
        : medication.frequencyPeriod === 'month' ? 'this month'
          : 'today'
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

            {/* Dates, not "when did you add this to the app". They are drawn
                on the Trends and condition calendars, so an owner can see
                what the days looked like either side of starting something.
                Both optional: a guess drawn as a fact is worse than a gap. */}
            <div className="field">
              <label htmlFor="med-started">Started (optional)</label>
              <input
                id="med-started"
                type="date"
                value={form.startedOn}
                max={todayIsoDate()}
                onChange={(e) => setForm({ ...form, startedOn: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="med-ended">Stopped (optional)</label>
              <input
                id="med-ended"
                type="date"
                value={form.endedOn}
                min={form.startedOn || undefined}
                onChange={(e) => setForm({ ...form, endedOn: e.target.value })}
              />
              <p className="assessment-hint">
                Leave this empty while {pet.name} is still taking it. Marking a medication as
                finished fills it in for you.
              </p>
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
                      onChange={(e) => setFrequencyCount(e.target.value)}
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
                      <option value="month">Month</option>
                    </select>
                  </div>
                </div>
                <p className="assessment-hint">
                  You'll get a tick box per dose to mark off. Choose "At set times" instead if
                  each dose is due at a particular time of day.
                </p>

                <label className="med-reminder-toggle">
                  <input
                    type="checkbox"
                    checked={form.remindersEnabled}
                    onChange={(e) => setForm({ ...form, remindersEnabled: e.target.checked })}
                  />
                  <span>Remind me</span>
                </label>

                {/* The app still never invents a time — it uses one the owner
                    gives it. Weekly and monthly reminders land on the same
                    weekday, or the same date, as the day the course started. */}
                {form.remindersEnabled && (
                <div className="field">
                  <label htmlFor="med-reminder-time">Remind me at</label>
                  <input
                    id="med-reminder-time"
                    type="time"
                    value={form.reminderTime}
                    onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
                  />
                  <p className="assessment-hint">{describeReminderPlan(form)}</p>
                  {!isNative && (
                    <p className="assessment-hint">
                      Reminders only work in the app on your phone, not in a browser.
                    </p>
                  )}
                </div>
                )}

                {/* Which days, once there is more than one day it could be.
                    A medication given twice a week has two days, and only the
                    owner knows which two — putting both on the day the course
                    started would be two reminders on one day and none on the
                    other. */}
                {form.remindersEnabled && form.frequencyPeriod !== 'day' && (
                  <div className="field">
                    <label>
                      {form.frequencyPeriod === 'week' ? 'Which days?' : 'Which dates?'}
                    </label>
                    <div className="symptom-chips">
                      {(form.frequencyPeriod === 'week' ? WEEKDAY_OPTIONS : MONTH_DAY_OPTIONS).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`chip ${(form.reminderDays ?? []).includes(option.value) ? 'selected' : ''}`.trim()}
                          disabled={
                            !(form.reminderDays ?? []).includes(option.value)
                            && (form.reminderDays ?? []).length >= (Number(form.frequencyCount) || 1)
                          }
                          onClick={() => toggleReminderDay(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="assessment-hint">
                      {(form.reminderDays ?? []).length}/{Number(form.frequencyCount) || 1} picked.
                      {' '}
                      {(form.reminderDays ?? []).length === 0
                        ? 'Pick nothing and you\'ll be reminded on the same day the course started.'
                        : (form.reminderDays ?? []).length >= (Number(form.frequencyCount) || 1)
                          ? 'That is all the doses accounted for. Untick one to change it.'
                          : 'You can pick more, or leave it here if some doses fall on the same day.'}
                    </p>
                    {form.frequencyPeriod === 'month' && (
                      <p className="assessment-hint">
                        Dates stop at the 28th, so a reminder never falls on a date some months
                        do not have.
                      </p>
                    )}
                  </div>
                )}
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

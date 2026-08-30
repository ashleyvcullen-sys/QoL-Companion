import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BellOff, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import ReminderDayPicker from '../components/ReminderDayPicker'
import { usePets } from '../lib/PetsContext'
import { usePetConditions } from '../lib/conditionsData'
import { resolveTrackedConditions } from '../lib/charts'
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
  scheduleMode: 'frequency',
  times: ['08:00'],
  frequencyCount: 2,
  frequencyPeriod: 'day',
  remindersEnabled: true,
  reminderTime: '08:00',
  reminderDays: [],
  notes: '',
  startedOn: '',
  endedOn: '',
  conditionKeys: [],
}

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
  // What {name} is actually being monitored for. Only these are offered — a
  // list of every condition the app supports would mostly be things this pet
  // does not have.
  const { conditions } = usePetConditions(pet?.id)
  const trackedConditions = resolveTrackedConditions(conditions)

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
      conditionKeys: medication.conditionKeys ?? [],
      endedOn: medication.endedOn ?? '',
      // Medications saved before the mode buttons were removed open as
      // what they always were: three times of day IS three times a day. The
      // times themselves are kept on the record, so the doses already ticked
      // off against them still line up.
      scheduleMode: medication.scheduleMode === 'as_needed' ? 'as_needed' : 'frequency',
      times: medication.times.length > 0 ? [...medication.times] : ['08:00'],
      frequencyCount: medication.scheduleMode === 'times' && medication.times.length > 0
        ? medication.times.length
        : medication.frequencyCount ?? 2,
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
        conditionKeys: form.conditionKeys ?? [],
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
            {/* Which condition this is for. Chips rather than a dropdown,
                because more than one can be true: steroids for an inflamed
                gut and a sore joint is the ordinary case, and making the
                owner pick one would file the drug wrongly and then hide it
                from half the places it belongs. */}
            {trackedConditions.length > 0 && (
              <div className="field">
                <label>What is this for? (optional)</label>
                <div className="symptom-chips">
                  {trackedConditions.map((definition) => {
                    const chosen = (form.conditionKeys ?? []).includes(definition.key)
                    return (
                      <button
                        key={definition.key}
                        type="button"
                        className={`chip ${chosen ? 'selected' : ''}`.trim()}
                        onClick={() => setForm({
                          ...form,
                          conditionKeys: chosen
                            ? form.conditionKeys.filter((key) => key !== definition.key)
                            : [...(form.conditionKeys ?? []), definition.key],
                        })}
                      >
                        {definition.label}
                      </button>
                    )
                  })}
                </div>
                <p className="assessment-hint">
                  Choose none and it will show under every condition {pet.name} is
                  monitored for.
                </p>
              </div>
            )}

            <div className="field">
              <label htmlFor="med-started">Started (optional)</label>
              <div className="med-date-row">
                <input
                  id="med-started"
                  type="date"
                  value={form.startedOn}
                  max={todayIsoDate()}
                  onChange={(e) => setForm({ ...form, startedOn: e.target.value })}
                />
                {/* iOS's own picker has a Reset, and Reset there means "back
                    to today" — not "no date". Since both of these are
                    genuinely optional, there has to be a way back to empty,
                    and the native control does not offer one. Only shown when
                    there is something to clear. */}
                {form.startedOn && (
                  <button
                    type="button"
                    className="subtle-link"
                    onClick={() => setForm({ ...form, startedOn: '' })}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="med-ended">Stopped (optional)</label>
              <div className="med-date-row">
                <input
                  id="med-ended"
                  type="date"
                  value={form.endedOn}
                  min={form.startedOn || undefined}
                  onChange={(e) => setForm({ ...form, endedOn: e.target.value })}
                />
                {form.endedOn && (
                  <button
                    type="button"
                    className="subtle-link"
                    onClick={() => setForm({ ...form, endedOn: '' })}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="assessment-hint">
                Leave this empty while {pet.name} is still taking it. Marking a medication as
                finished fills it in for you.
              </p>
            </div>

            {/* One question instead of a mode to pick first. Choosing
                between "at set times", "a number of times" and "as needed"
                asked the owner to classify the medication before they could
                describe it — and the two scheduled answers collected the same
                thing in the end. How often it is given is the question; "as
                needed" is the one answer that means there is no how often. */}
            <label className="med-reminder-toggle">
              <input
                type="checkbox"
                checked={form.scheduleMode === 'as_needed'}
                onChange={(e) => setForm({
                  ...form,
                  scheduleMode: e.target.checked ? 'as_needed' : 'frequency',
                })}
              />
              <span>Given as needed</span>
            </label>

            {form.scheduleMode !== 'as_needed' && (
              <>
                {/* One question, answered on one line: "2 per day". It was
                    two stacked fields labelled "How many times" and "Per",
                    which asked the same thing the heading asks and split the
                    answer across two columns to do it. */}
                <div className="field">
                  <label htmlFor="med-freq-count">How often?</label>
                  <div className="med-frequency-row">
                    <input
                      id="med-freq-count"
                      className="med-freq-count"
                      type="number"
                      min="1"
                      max="12"
                      value={form.frequencyCount}
                      onChange={(e) => setFrequencyCount(e.target.value)}
                    />
                    <span className="med-frequency-per">per</span>
                    <select
                      id="med-freq-period"
                      value={form.frequencyPeriod}
                      onChange={(e) => setForm({ ...form, frequencyPeriod: e.target.value })}
                    >
                      <option value="day">day</option>
                      <option value="week">week</option>
                      <option value="month">month</option>
                    </select>
                  </div>
                </div>
                <p className="assessment-hint">
                  You'll get a tick box per dose to mark off.
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
                    {/* A real calendar rather than a strip of numbers. The
                        dates now sit under the weekdays they actually fall
                        on, and a month shows its own number of days — which
                        is the difference between "the 14th" and "the second
                        Saturday", and the difference between a September
                        that has a 31st and one that does not. */}
                    <ReminderDayPicker
                      mode={form.frequencyPeriod === 'week' ? 'week' : 'month'}
                      value={form.reminderDays ?? []}
                      max={Number(form.frequencyCount) || 1}
                      fromIso={form.startedOn || null}
                      onChange={(days) => setForm({ ...form, reminderDays: days })}
                    />
                    <p className="assessment-hint">
                      {(form.reminderDays ?? []).length}/{Number(form.frequencyCount) || 1} picked.
                      {' '}
                      {(form.reminderDays ?? []).length === 0
                        ? 'Pick nothing and you\'ll be reminded on the same day the course started.'
                        : (form.reminderDays ?? []).length >= (Number(form.frequencyCount) || 1)
                          ? 'That is all the doses accounted for. Untick one to change it.'
                          : 'You can pick more, or leave it here if some doses fall on the same day.'}
                    </p>
                  </div>
                )}
              </>
            )}

            {form.scheduleMode === 'as_needed' && (
              <p className="assessment-hint">
                Log a dose whenever you give one. No schedule, no reminders.
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

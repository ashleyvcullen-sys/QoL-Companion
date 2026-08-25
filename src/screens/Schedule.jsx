import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, HelpCircle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings'
import { supabase } from '../lib/supabase'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import {
  checkNotificationPermission,
  requestNotificationPermission,
  checkExactAlarmPermission,
  requestExactAlarmPermission,
  scheduleConditionReminder,
  scheduleQolReminder,
} from '../lib/notifications'
import { useMedications } from '../lib/medicationsData'
import { useAllConditionEntries, usePetConditions } from '../lib/conditionsData'
import ReminderDayPicker from '../components/ReminderDayPicker'
import { resolveTrackedConditions } from '../lib/charts'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import Footer from '../components/Footer'

const CADENCE_OPTIONS = [
  { value: 1, label: 'Daily' },
  { value: 7, label: 'Weekly' },
  { value: 14, label: 'Every 2 weeks' },
  { value: 30, label: 'Monthly' },
]

// Conditions get one more option than the quality of life assessment does.
// Someone monitoring four things does not necessarily want four reminders,
// and the alternative — deleting the condition to stop being nudged about
// it — would take the history with it.
const CONDITION_CADENCE_OPTIONS = [
  ...CADENCE_OPTIONS,
  { value: 0, label: 'No reminder' },
]

// Which day the reminder lands on, and therefore which picker to show. A
// daily cadence has no day to choose; a fortnightly one still lands on a
// weekday. Monthly is the only one that asks for a date.
function dayModeFor(cadenceDays) {
  if (cadenceDays === 7 || cadenceDays === 14) return 'week'
  if (cadenceDays >= 28) return 'month'
  return null
}

// Local midnight from 'YYYY-MM-DD'. new Date('2026-08-25') parses as UTC,
// which is the previous day west of Greenwich — and a weekly reminder
// anchored a day early is a day early every week from then on.
function localDateFromIso(iso) {
  if (!iso) return null
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

// '08:00' as a person reads it. Medications.jsx has its own copy; both are
// four lines, and sharing them would mean a module for one function.
function formatTime(value) {
  if (!value) return ''
  const [hour, minute] = value.split(':').map(Number)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`
}

// When a medication will actually raise a notification, in words. Says
// "off" rather than staying silent when reminders are disabled: an owner
// checking this screen is asking "what will tell me?", and a medication
// quietly absent from the list looks like a bug.
function describeMedicationReminder(medication) {
  if (medication.scheduleMode === 'as_needed') return 'As needed — no reminders'
  if (!medication.remindersEnabled) return 'Reminders off'

  if (medication.scheduleMode === 'times') {
    const times = (medication.times ?? []).filter(Boolean)
    return times.length ? times.map(formatTime).join(', ') : 'No times set'
  }

  if (!medication.reminderTime) return 'No reminder time set'
  const when = formatTime(medication.reminderTime)
  if (medication.frequencyPeriod === 'week') return `${when}, weekly`
  if (medication.frequencyPeriod === 'month') return `${when}, monthly`
  return `${when}, daily`
}

function daysSince(dateStr) {
  const last = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - last) / (1000 * 60 * 60 * 24))
}

function openNotificationSettings() {
  // Cross-platform: opens the app's own notification settings on Android
  // (Settings.ACTION_APP_NOTIFICATION_SETTINGS) and the app settings screen
  // on iOS (the only one Apple officially supports opening directly) —
  // replaces an earlier iOS-only window.location.href = 'app-settings:'
  // hack that had no Android equivalent.
  return NativeSettings.open({
    optionAndroid: AndroidSettings.AppNotification,
    optionIOS: IOSSettings.App,
  })
}

function ScheduleRow({
  label,
  lastDate,
  cadenceDays,
  cadenceDay = null,
  onCadenceChange,
  onDayChange,
  options = CADENCE_OPTIONS,
  reminderOff = false,
}) {
  // Nothing is overdue when there is no schedule to be overdue against.
  const isOverdue = !reminderOff && (!lastDate || daysSince(lastDate) >= cadenceDays)
  const dayMode = reminderOff ? null : dayModeFor(cadenceDays)

  return (
    <div className="schedule-row">
      <div className="schedule-row-header">
        <span className="schedule-row-label">{label}</span>
        {!reminderOff && (
          <span className={`schedule-badge ${isOverdue ? 'overdue' : 'ok'}`}>
            {isOverdue ? 'Overdue' : 'On track'}
          </span>
        )}
      </div>
      <p className="assessment-hint">Last logged: {lastDate || 'never'}</p>
      <div className="field">
        <label>Repeat</label>
        <select value={cadenceDays} onChange={(e) => onCadenceChange(Number(e.target.value))}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Which day, once "how often" leaves a choice. A cadence says how
          often; it cannot say when, and "weekly" measured from whichever
          Tuesday the last entry happened to fall on is not a day anyone
          picked. */}
      {dayMode && onDayChange && (
        <div className="field">
          <label>{dayMode === 'week' ? 'Which day?' : 'Which date?'}</label>
          <ReminderDayPicker
            mode={dayMode}
            value={cadenceDay == null ? [] : [cadenceDay]}
            max={1}
            onChange={(days) => onDayChange(days.length ? days[days.length - 1] : null)}
          />
          <p className="assessment-hint">
            {cadenceDay == null
              ? 'Pick nothing and the reminder falls the right number of days after your last entry.'
              : 'Tap it again to go back to counting from your last entry.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  const { refresh, selectedPet } = usePets()
  const pet = selectedPet
  const { generalEntries, loading } = useQolHistory(pet?.id)
  const { medications, loading: medsLoading } = useMedications(pet?.id)
  const { conditions, loading: conditionsLoading } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)
  const [showFrequencyInfo, setShowFrequencyInfo] = useState(false)
  const [notifStatus, setNotifStatus] = useState(null)
  const [exactAlarmStatus, setExactAlarmStatus] = useState(null)
  const isAndroid = Capacitor.getPlatform() === 'android'

  const latestGeneralDate = generalEntries[generalEntries.length - 1]?.date ?? null

  const activeMedications = medications.filter((medication) => medication.active)

  // Conditions with readings logged, which is what "monitoring" means
  // everywhere else in the app — not simply a row in the table.
  const trackedConditions = resolveTrackedConditions(conditions)
    .filter((definition) => (byCondition[definition.key] ?? []).length > 0)

  // Schedule used to track "general" and "pain" cadence separately, even
  // though a save always writes both halves of the assessment together —
  // there was never a real scenario where they'd differ. Consolidated to a
  // single `qol` field; existing pets fall back to whatever `general` was
  // already set to (or a weekly default) so no one's cadence silently resets.
  const cadenceDays = pet.schedule.qol ?? pet.schedule.general ?? 7
  // Which weekday or date the reminder lands on. Null means "count from the
  // last entry", which is what every existing pet has been doing, so nothing
  // changes for anyone who never opens this.
  const cadenceDay = pet.schedule.qolDay ?? null

  // Per-condition cadence, stored under the same `schedule` object as the
  // assessment's. A condition with no entry here falls back to the cadence
  // its own definition recommends, so the sensible default is still the
  // clinical one rather than a flat weekly.
  const conditionSchedules = pet.schedule.conditions ?? {}

  function scheduleForCondition(definition) {
    const saved = conditionSchedules[definition.key]
    return {
      days: saved?.days ?? definition.cadence?.days ?? 1,
      day: saved?.day ?? null,
      // Only an explicit 0 turns a reminder off. `undefined` means the owner
      // has never touched this one, which is not the same thing.
      off: saved?.days === 0,
    }
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    checkNotificationPermission().then(setNotifStatus)
  }, [])

  // Exact-alarm timing is a separate, optional Android 12+ setting on top
  // of base notification permission — only worth checking/showing once the
  // user has actually turned reminders on at all.
  useEffect(() => {
    if (!isAndroid || notifStatus !== 'granted') return
    checkExactAlarmPermission().then(setExactAlarmStatus)
  }, [isAndroid, notifStatus])

  // Keeps the scheduled reminder in sync with the current cadence whenever
  // this screen is visited with permission already granted — not just
  // right after a change — so it self-heals (e.g. after a reinstall, or
  // permission granted after a cadence was already set).
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || notifStatus !== 'granted' || loading) return
    scheduleQolReminder({
      petId: pet.id,
      petName: pet.name,
      cadenceDays,
      cadenceDay,
      fromDate: latestGeneralDate ?? new Date(),
    })
  }, [notifStatus, loading, cadenceDays, cadenceDay, latestGeneralDate, pet.id, pet.name])

  // The same self-healing pass for every condition being monitored. Keyed on
  // a serialised copy of the schedule rather than the object itself, which is
  // a fresh reference on every render and would reschedule endlessly.
  const conditionScheduleKey = JSON.stringify(conditionSchedules)
  const trackedKey = trackedConditions.map((d) => d.key).join(',')
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || notifStatus !== 'granted' || conditionsLoading) return
    trackedConditions.forEach((definition) => {
      const { days, day } = scheduleForCondition(definition)
      const entries = byCondition[definition.key] ?? []
      scheduleConditionReminder({
        petId: pet.id,
        petName: pet.name,
        conditionKey: definition.key,
        conditionLabel: definition.label,
        cadenceDays: days,
        cadenceDay: day,
        fromDate: localDateFromIso(entries[entries.length - 1]?.date) ?? new Date(),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifStatus, conditionsLoading, conditionScheduleKey, trackedKey, pet.id, pet.name])

  async function saveSchedule(nextSchedule) {
    const { error } = await supabase.from('pets').update({ schedule: nextSchedule }).eq('id', pet.id)
    if (!error) await refresh()
  }

  async function updateCadence(days) {
    // Changing how often clears which day, because the day means a different
    // thing on either side of the change: the 14th of the month is not a
    // weekday, and Tuesday is not a date.
    const keepsDay = dayModeFor(days) === dayModeFor(cadenceDays)
    await saveSchedule({
      ...pet.schedule,
      qol: days,
      qolDay: keepsDay ? cadenceDay : null,
    })
  }

  async function updateCadenceDay(day) {
    await saveSchedule({ ...pet.schedule, qolDay: day })
  }

  async function updateConditionSchedule(conditionKey, patch) {
    const current = conditionSchedules[conditionKey] ?? {}
    await saveSchedule({
      ...pet.schedule,
      conditions: {
        ...conditionSchedules,
        [conditionKey]: { ...current, ...patch },
      },
    })
  }

  async function handleEnableReminders() {
    const display = await requestNotificationPermission()
    setNotifStatus(display)
  }

  async function handleEnableExactAlarms() {
    const exact = await requestExactAlarmPermission()
    setExactAlarmStatus(exact)
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Schedule</SectionTitle>
        <p>
          Set how often the assessment should be repeated. A due/overdue badge shows
          based on your last logged entry — a simple way to keep monitoring consistent.
        </p>
      </Card>

      <Card>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <ScheduleRow
            label="Overall Quality of Life Assessment"
            lastDate={latestGeneralDate}
            cadenceDays={cadenceDays}
            cadenceDay={cadenceDay}
            onCadenceChange={updateCadence}
            onDayChange={updateCadenceDay}
          />
        )}
      </Card>

      {/* Directly under the box that asks for a cadence, because that is the
          moment the question occurs to someone. At the foot of the screen it
          was four cards past the only control it explains. */}
      <Card>
        <button type="button" className="icon-tile-link" onClick={() => setShowFrequencyInfo(true)}>
          <div className="welcome-help-row">
            <span className="icon-badge">
              <HelpCircle size={20} color="#fff" />
            </span>
            <span>How often should I be assessing my pet's quality of life?</span>
          </div>
        </button>
      </Card>

      {/* Each condition sets its own cadence, the same way the assessment
          does. It used to be a read-only list of what the app thought was
          "worth filling in", which is exactly the sort of advice that gets
          ignored when nothing acts on it — a monthly injection and a daily
          pain score are not on the same clock, and only the owner knows
          which of the two this week looks like. */}
      <Card>
        <SectionTitle>Disease Monitoring</SectionTitle>
        {conditionsLoading && <p>Loading…</p>}
        {!conditionsLoading && trackedConditions.length === 0 && (
          <p className="assessment-hint">
            Nothing being monitored yet.{' '}
            <Link to="/conditions" className="subtle-link">Browse conditions</Link>
          </p>
        )}
        {!conditionsLoading && trackedConditions.map((definition) => {
          const entries = byCondition[definition.key] ?? []
          const lastDate = entries[entries.length - 1]?.date ?? null
          const { days, day, off } = scheduleForCondition(definition)

          return (
            <div key={definition.key}>
              <ScheduleRow
                label={definition.label}
                lastDate={lastDate}
                cadenceDays={days}
                cadenceDay={day}
                options={CONDITION_CADENCE_OPTIONS}
                reminderOff={off}
                onCadenceChange={(next) => updateConditionSchedule(definition.key, {
                  days: next,
                  // Same reasoning as the assessment above: a weekday and a
                  // date are not interchangeable, so the day is dropped
                  // whenever the kind of day changes.
                  day: dayModeFor(next) === dayModeFor(days) ? day : null,
                })}
                onDayChange={(nextDay) => updateConditionSchedule(definition.key, { day: nextDay })}
              />
              {definition.cadence && (
                <p className="assessment-hint">
                  Suggested: {definition.cadence.label}.
                </p>
              )}
              <Link to={`/conditions/${definition.key}`} className="subtle-link">
                Open {definition.label}
              </Link>
            </div>
          )
        })}
      </Card>

      {/* Last of the three. The quality of life cadence and the per-disease
          cadences are the same kind of decision — how often to look at the
          pet — and medications sat between them, splitting the pair with a
          list that answers to a prescription instead. */}
      <Card>
        <SectionTitle>Medications</SectionTitle>
        {medsLoading && <p>Loading…</p>}
        {!medsLoading && activeMedications.length === 0 && (
          <p className="assessment-hint">
            No medications yet. <Link to="/medications" className="subtle-link">Add one</Link> to
            get reminders for it.
          </p>
        )}
        {!medsLoading && activeMedications.map((medication) => (
          <div key={medication.id} className="schedule-row">
            <div className="schedule-row-header">
              <span className="schedule-row-label">{medication.name}</span>
              {!medication.remindersEnabled && medication.scheduleMode !== 'as_needed' && (
                <span className="assessment-hint"><BellOff size={13} /> off</span>
              )}
            </div>
            <p className="assessment-hint">{describeMedicationReminder(medication)}</p>
          </div>
        ))}
        {!medsLoading && activeMedications.length > 0 && (
          <Link to="/medications" className="subtle-link">Change these in Medications</Link>
        )}
      </Card>

      {Capacitor.isNativePlatform() && (notifStatus === 'prompt' || notifStatus === 'prompt-with-rationale') && (
        <Card>
          <p>Allow notifications so we can remind you when it's time for your next check-in?</p>
          <Btn type="button" className="btn-block" onClick={handleEnableReminders}>
            Enable reminders
          </Btn>
        </Card>
      )}

      {Capacitor.isNativePlatform() && notifStatus === 'denied' && (
        <Card>
          <p className="assessment-hint">Reminders are off.</p>
          <Btn type="button" variant="outline" className="btn-block" onClick={openNotificationSettings}>
            Open Settings to turn them back on
          </Btn>
        </Card>
      )}

      {isAndroid && (exactAlarmStatus === 'prompt' || exactAlarmStatus === 'prompt-with-rationale') && (
        <Card>
          <p>
            For the most precise reminder timing, Android has a separate "exact alarms"
            setting — optional, reminders will still arrive without it, just not always
            at the exact time.
          </p>
          <Btn type="button" variant="outline" className="btn-block" onClick={handleEnableExactAlarms}>
            Enable precise timing
          </Btn>
        </Card>
      )}

      {isAndroid && exactAlarmStatus === 'denied' && (
        <p className="assessment-hint">
          Precise reminder timing is off — reminders will still arrive, just not always
          at the exact time.
        </p>
      )}

      {showFrequencyInfo && (
        <Modal title="How often should I assess?" onClose={() => setShowFrequencyInfo(false)}>
          <p>
            For young, healthy pets, checking in at least fortnightly is a reasonable
            baseline — enough to catch any gradual changes without it feeling like a chore.
          </p>
          <p>
            For older pets, or pets with a diagnosed illness or declining health, assessing
            daily — or as often as you're able — gives you and your vet the clearest, most
            accurate picture of how they're really doing, especially when things can change
            quickly.
          </p>
        </Modal>
      )}

      <Footer />
    </div>
  )
}

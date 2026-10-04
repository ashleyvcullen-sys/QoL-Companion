import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, BellOff, HelpCircle } from 'lucide-react'
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
  DEFAULT_REMINDER_TIME,
} from '../lib/notifications'
import { useMedications } from '../lib/medicationsData'
import { todayIsoDate, useAllConditionEntries, usePetConditions } from '../lib/conditionsData'
import { daysBetween } from '../lib/monitoringStatus'
import ReminderDayPicker from '../components/ReminderDayPicker'
import NotificationsCard from '../components/NotificationsCard'
import { resolveTrackedConditions } from '../lib/charts'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import Skeleton from '../components/Skeleton'
import { formatDateDDMMYY } from '../lib/formatDate'
import {
  CADENCE_OPTIONS,
  CONDITION_CADENCE_OPTIONS,
  dayModeFor,
  saveConditionSchedule,
  scheduleForCondition as scheduleForConditionOf,
  reminderTimeOf,
  QOL_CADENCE_OPTIONS,
  qolRepeatOf,
  qolWeekdaysOf,
} from '../lib/cadence'

// The options, the day-mode rule and the per-condition defaults now live in
// lib/cadence.js — the condition's own screen offers the same control at the
// top of it, and one of those two copies would eventually have drifted.

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
  onRemindersChange = null,
  // The assessment picks from a longer list, keyed by name rather than by
  // interval — see QOL_CADENCE_OPTIONS. The condition rows keep the presets,
  // which are keyed by their number of days.
  repeat = null,
  onRepeatChange = null,
  // The weekdays chosen for a rung that asks for several, and the way to
  // change them.
  weekdays = [],
  onWeekdaysChange = null,
  // Only to say, under the day picker, what time those days land at. A
  // reminder on chosen weekdays repeats natively and so must carry a clock
  // time; this screen names it rather than letting the owner find out.
  reminderTime = null,
}) {
  const asksRepeat = Boolean(repeat && onRepeatChange)
  // A rung like "3 times weekly" picks its days rather than an interval.
  const asksWeekdays = Boolean(asksRepeat && repeat.times && onWeekdaysChange)
  // Nothing is overdue when there is no schedule to be overdue against.
  //
  // Through the shared helper rather than a local date subtraction. The one
  // that used to live here built a Date from the ISO string (UTC midnight)
  // and compared it to `new Date()` (local now), which is a day out in either
  // direction depending on the timezone and the hour — so this row and the
  // condition list could disagree about the same pet on the same evening.
  const isOverdue = !reminderOff && (!lastDate || daysBetween(lastDate, todayIsoDate()) >= cadenceDays)
  const dayMode = reminderOff ? null : dayModeFor(cadenceDays)

  return (
    <div className="schedule-row">
      {/* Without a label the header holds only the badge, and centring it
          keeps it under the card's own heading rather than stranded against
          the left edge — see the assessment card, which titles itself with a
          SectionTitle like every other section on this screen. */}
      <div className={`schedule-row-header ${label ? '' : 'is-untitled'}`.trim()}>
        {label && <span className="schedule-row-label">{label}</span>}
        {!reminderOff && (
          <span className={`schedule-badge ${isOverdue ? 'overdue' : 'ok'}`}>
            {isOverdue ? 'Overdue' : 'On track'}
          </span>
        )}
      </div>
      <p className="assessment-hint">
        Last logged: {lastDate ? formatDateDDMMYY(lastDate) : 'never'}
      </p>

      {/* The same toggle the Medications screen uses, and the same reasoning
          — Ash's instruction 27 Sep 2026. Turning a reminder off was an option
          buried at the bottom of the "Repeat" list, which asks an owner to
          look for "off" inside a control labelled "how often": the state and
          the frequency are two different questions and now have two different
          controls. "No reminder" has left the list accordingly, so there is
          one place this is set rather than two that can disagree. */}
      {onRemindersChange && (
        <button
          type="button"
          className={`med-reminder-toggle ${reminderOff ? '' : 'is-on'}`.trim()}
          onClick={() => onRemindersChange(reminderOff)}
          aria-pressed={!reminderOff}
          aria-label={label ? `Reminders for ${label}` : 'Reminders'}
        >
          {reminderOff
            ? <BellOff size={13} aria-hidden="true" />
            : <Bell size={13} aria-hidden="true" />}
          {reminderOff ? 'Reminders off' : 'Reminders on'}
        </button>
      )}

      {/* Hidden while reminders are off: how often to be reminded is not a
          question worth answering when the answer is "never". It comes back
          holding the cadence it had, which is what turning them on restores. */}
      {/* One list, with the weekly frequencies in it — Ash's instruction
          4 Oct 2026. Twice through six times a week, alongside the four
          intervals that were always there.

          APPROVED — Dr Ash Cullen (BSc, DVM), 4 Oct 2026. */}
      {!reminderOff && asksRepeat && (
        <div className="field">
          <label htmlFor="qol-repeat">Repeat</label>
          <select
            id="qol-repeat"
            value={repeat.value}
            onChange={(e) => onRepeatChange(e.target.value)}
          >
            {QOL_CADENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      )}

      {!reminderOff && !asksRepeat && (
        <div className="field">
          <label>Repeat</label>
          <select value={cadenceDays} onChange={(e) => onCadenceChange(Number(e.target.value))}>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Which days, for a rung that asks for more than one — Ash's
          instruction 4 Oct 2026. Three times weekly as an interval is "every
          two days", which drifts across the week and is not what anyone means
          by it; three times weekly as Monday, Wednesday and Friday is.

          Choosing none is allowed and is the old behaviour: the reminder goes
          back to counting from the last entry.

          ALL COPY PENDING ASH. */}
      {!reminderOff && asksWeekdays && (
        <div className="field">
          <label>Which days?</label>
          <ReminderDayPicker
            mode="week"
            value={weekdays}
            max={repeat.times}
            onChange={onWeekdaysChange}
          />
          <p className="assessment-hint">
            {weekdays.length > 0
              ? `Your check-in reminder arrives on these days, at ${formatTime(reminderTime ?? DEFAULT_REMINDER_TIME)}.`
              : `Pick up to ${repeat.times} day${repeat.times === 1 ? '' : 's'}, or leave this empty to be reminded every ${cadenceDays} days instead.`}
          </p>
        </div>
      )}

      {/* Which day, once "how often" leaves a choice. A cadence says how
          often; it cannot say when, and "weekly" measured from whichever
          Tuesday the last entry happened to fall on is not a day anyone
          picked. */}
      {!reminderOff && !asksWeekdays && dayMode && onDayChange && (
        <div className="field">
          <label>{dayMode === 'week' ? 'Which day?' : 'Which date?'}</label>
          <ReminderDayPicker
            mode={dayMode}
            value={cadenceDay == null ? [] : [cadenceDay]}
            max={1}
            onChange={(days) => onDayChange(days.length ? days[days.length - 1] : null)}
          />
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  const navigate = useNavigate()
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
  // One time of day for this pet's check-in reminders — Ash's instruction
  // 4 Oct 2026. Null keeps the old behaviour, which is to land at whatever
  // time the last entry was saved at.
  const reminderTime = reminderTimeOf(pet)
  // Which rung of the list this pet is on. One set up before the list grew
  // reads back as the rung with its interval.
  const qolRepeat = qolRepeatOf(pet)
  const qolWeekdays = qolWeekdaysOf(pet)
  // A fresh array every render, so the effect below is keyed on its contents.
  const weekdayKey = qolWeekdays.join(',')

  // Per-condition cadence, stored under the same `schedule` object as the
  // assessment's. A condition with no entry here falls back to the cadence
  // its own definition recommends, so the sensible default is still the
  // clinical one rather than a flat weekly.
  const conditionSchedules = pet.schedule.conditions ?? {}

  const scheduleForCondition = (definition) => scheduleForConditionOf(pet, definition)

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
      reminderTime,
      weekdays: qolWeekdays,
      fromDate: latestGeneralDate ?? new Date(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifStatus, loading, cadenceDays, cadenceDay, reminderTime, weekdayKey,
    latestGeneralDate, pet.id, pet.name])

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
        reminderTime,
        fromDate: localDateFromIso(entries[entries.length - 1]?.date) ?? new Date(),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifStatus, conditionsLoading, conditionScheduleKey, trackedKey, reminderTime, pet.id, pet.name])

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

  // Both are saved: the rung, so the list reads back as it was set, and the
  // interval it works out to, which is what every other reader in the app has
  // always used.
  async function updateRepeat(value) {
    const option = QOL_CADENCE_OPTIONS.find((item) => item.value === value)
    if (!option) return
    const keepsDay = dayModeFor(option.days) === dayModeFor(cadenceDays)
    await saveSchedule({
      ...pet.schedule,
      qol: option.days,
      qolRepeat: option.value,
      qolDay: keepsDay ? cadenceDay : null,
      // Days chosen for "3 times weekly" mean nothing on "Monthly", and more
      // of them than the new rung asks for is not a set anyone picked.
      qolDays: option.times ? qolWeekdays.slice(0, option.times) : [],
    })
  }

  async function updateWeekdays(days) {
    await saveSchedule({ ...pet.schedule, qolDays: days })
  }

  async function updateCadenceDay(day) {
    await saveSchedule({ ...pet.schedule, qolDay: day })
  }

  // Empty clears it, which is how an owner goes back to "whenever I last
  // assessed". Every reminder reschedules itself off the effects above.
  async function updateReminderTime(time) {
    await saveSchedule({ ...pet.schedule, reminderTime: time || null })
  }

  async function updateConditionSchedule(conditionKey, patch) {
    const error = await saveConditionSchedule({ pet, conditionKey, patch })
    if (!error) await refresh()
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

      {/* First, because every cadence control below it is inert without
          this. Ash's instruction 3 Sep 2026. */}
      <NotificationsCard
        notifStatus={notifStatus}
        exactAlarmStatus={exactAlarmStatus}
        isAndroid={isAndroid}
        onEnable={handleEnableReminders}
        onEnableExactAlarms={handleEnableExactAlarms}
        onOpenSettings={openNotificationSettings}
      />

      {/* The heading and the question that comes before the decision, in one
          card — Ash's instruction 27 Sep 2026. They were two, which put a
          card boundary between a title and the only thing under it and made
          the question read as a separate feature rather than as part of
          setting the schedule up.
          
          The line that used to sit under the heading is now the sentence the
          More screen shows before opening this one — Ash's instruction 24 Sep
          2026. Said once, where the choice is made.
          
          Still ABOVE the cadence control, not below it. Someone who does not
          know how often to assess needs the answer BEFORE they are asked to
          pick a number, not after they have already guessed at one. It sat at
          the foot of the screen originally, then directly under the control;
          this is the third position and the first one that comes before the
          decision it informs. */}
      <Card>
        <SectionTitle>Reminders</SectionTitle>
        <button
          type="button"
          className="icon-tile-link schedule-frequency-help"
          onClick={() => setShowFrequencyInfo(true)}
        >
          <div className="welcome-help-row">
            <span className="icon-badge">
              <HelpCircle size={20} color="#fff" />
            </span>
            <span>How often should I be assessing my pet's quality of life?</span>
          </div>
        </button>
      </Card>

      {/* One time of day for every check-in reminder — Ash's instruction
          4 Oct 2026. Without it a reminder lands at whatever time the last
          entry was saved at, which is how an owner who assessed once at 11pm
          ends up being asked at 11pm from then on.

          In its own card, on her instruction the same day. It shared one with
          the "how often should I be assessing" question above, which put two
          unrelated things — something to read and something to set — in one
          box with nothing between them.

          Here rather than on each section: it is the same answer for all of
          them, and asking it once is the point. Medication reminders are not
          affected — those already fire at times the owner set dose by dose.

          APPROVED — Dr Ash Cullen (BSc, DVM), 4 Oct 2026. */}
      <Card>
        <div className="field schedule-reminder-time">
          <label htmlFor="reminder-time">What time should reminders arrive?</label>
          <input
            id="reminder-time"
            type="time"
            value={reminderTime ?? ''}
            onChange={(event) => updateReminderTime(event.target.value)}
          />
          <p className="assessment-hint">
            {reminderTime
              ? 'Every check-in reminder arrives at this time.'
              : 'Leave this empty and reminders arrive at the time of day you last assessed.'}
          </p>
        </div>
      </Card>

      <Card>
        {/* Titled the same way Disease Monitoring and Medications are — Ash's
            instruction 27 Sep 2026. It was the row's own label, which is the
            right treatment for one condition inside a list and the wrong one
            for the heading of a section: smaller, left-aligned, and in the
            body face while the two cards below it were centred headings. */}
        <SectionTitle>Overall Quality of Life Assessment</SectionTitle>
        {loading ? (
          <Skeleton lines={3} />
        ) : (
          <ScheduleRow
            lastDate={latestGeneralDate}
            cadenceDays={cadenceDays}
            cadenceDay={cadenceDay}
            onCadenceChange={updateCadence}
            onDayChange={updateCadenceDay}
            // The assessment can be turned off too — Ash's instruction
            // 27 Sep 2026, "any reminder". It is stored the same way a
            // condition's is, as a cadence of 0, which monitoringStatus
            // already reads as OFF: the tab's due dot clears with it and no
            // notification is armed.
            reminderOff={cadenceDays === 0}
            // Turning reminders back on restores the interval that was set,
            // rather than resetting everyone to weekly.
            onRemindersChange={(turnOn) => updateCadence(turnOn ? qolRepeat.days : 0)}
            // The assessment only, on Ash's instruction 4 Oct 2026. A
            // condition's cadence is the one its own definition recommends,
            // which is a clinical number rather than a preference.
            repeat={qolRepeat}
            onRepeatChange={updateRepeat}
            weekdays={qolWeekdays}
            onWeekdaysChange={updateWeekdays}
            reminderTime={reminderTime}
          />
        )}
      </Card>

      {/* Each condition sets its own cadence, the same way the assessment
          does. It used to be a read-only list of what the app thought was
          "worth filling in", which is exactly the sort of advice that gets
          ignored when nothing acts on it — a monthly injection and a daily
          pain score are not on the same clock, and only the owner knows
          which of the two this week looks like. */}
      <Card>
        <SectionTitle>Disease Monitoring</SectionTitle>
        {conditionsLoading && <Skeleton lines={3} />}
        {!conditionsLoading && trackedConditions.length === 0 && (
          <p className="assessment-hint">
            Nothing being monitored yet.{' '}
            <Link to="/conditions" className="subtle-link">Browse Conditions</Link>
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
                // Off is stored as a cadence of 0. Turning reminders back on
                // restores the cadence the condition was set up with rather
                // than guessing at one — `days` is 0 while they are off, so
                // there is nothing else to go back to.
                onRemindersChange={(turnOn) => updateConditionSchedule(definition.key, {
                  days: turnOn ? (definition.cadence?.days ?? 7) : 0,
                  day: turnOn ? day : null,
                })}
                onCadenceChange={(next) => updateConditionSchedule(definition.key, {
                  days: next,
                  // Same reasoning as the assessment above: a weekday and a
                  // date are not interchangeable, so the day is dropped
                  // whenever the kind of day changes.
                  day: dayModeFor(next) === dayModeFor(days) ? day : null,
                })}
                onDayChange={(nextDay) => updateConditionSchedule(definition.key, { day: nextDay })}
              />
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
        {medsLoading && <Skeleton lines={3} />}
        {/* The sentence whole, then the way in — Ash's call, 3 Sep 2026.
            "Add one" was a link in the middle of the sentence, so it broke
            the line in two and left "to get reminders for it" stranded after
            a tap target. A reader met the button before they had finished
            reading what it was for. */}
        {!medsLoading && activeMedications.length === 0 && (
          <div className="empty-with-action">
            <p className="assessment-hint">
              No medications yet. Add one to get reminders for it.
            </p>
            <Btn
              type="button"
              variant="outline"
              className="btn-block"
              onClick={() => navigate('/medications')}
            >
              Add a Medication
            </Btn>
          </div>
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
          <Link to="/medications" className="subtle-link">Change These in Medications</Link>
        )}
      </Card>

      {/* The three permission cards that used to sit here have gone into
          NotificationsCard at the top of the screen — same states, one place,
          and visible when the answer is yes rather than only when it is no. */}

      {showFrequencyInfo && (
        <Modal title="How Often Should I Assess?" onClose={() => setShowFrequencyInfo(false)}>
          <p>
            For young, healthy pets, checking in at least weekly is a reasonable
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

    </div>
  )
}

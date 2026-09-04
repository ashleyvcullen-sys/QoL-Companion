import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// The single fixed id every reminder used before multi-pet support, when
// an account could only ever have one pet. Nothing schedules under it any
// more, but an existing install can still have a pending notification
// carrying it (and the wrong pet's name), so it gets cancelled alongside
// any reschedule — see cancelLegacySharedReminder().
const LEGACY_SHARED_REMINDER_ID = 1001

// Notification ids have to be integers (Android backs them with Java ints),
// while pet ids are UUID strings — so each pet's reminder id is a stable
// hash of its uuid. Same pet always maps to the same id, so a reschedule
// reliably replaces that pet's own pending reminder and leaves every other
// pet's untouched.
//
// FNV-1a, folded into a positive 31-bit range. A collision between two pets
// on one account would mean one silently replacing the other's reminder,
// but across a 2.1-billion-value space and a handful of pets per account
// that's vanishingly unlikely.
function hashToNotificationId(seed) {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  const id = ((hash >>> 0) % 0x7ffffffe) + 1
  // Never collide with the legacy id, which is cancelled independently.
  return id === LEGACY_SHARED_REMINDER_ID ? id + 1 : id
}

// Unchanged output: still hashes the bare pet id, so reminders already
// pending on an existing install keep the same id and are still cancellable.
export function qolReminderIdForPet(petId) {
  return hashToNotificationId(petId)
}

// One id per medication per time slot, so a three-times-a-day drug holds
// three independent reminders and editing one time doesn't disturb the
// others. Namespaced with 'med:' so a medication uuid can never collide
// with a pet uuid hashed for its QoL reminder.
export function medicationReminderId(medicationId, timeIndex) {
  return hashToNotificationId(`med:${medicationId}:${timeIndex}`)
}

// One id per condition per pet, so arthritis and heart disease can be due on
// different days without one reschedule clearing the other. Namespaced with
// 'cond:' for the same reason 'med:' is — a condition key hashed bare could
// collide with a pet uuid.
export function conditionReminderId(petId, conditionKey) {
  return hashToNotificationId(`cond:${petId}:${conditionKey}`)
}

// Moves a due date forward onto the day the owner asked for.
//
// A cadence on its own says how OFTEN; it cannot say WHEN. "Weekly" from a
// Tuesday entry lands on a Tuesday forever, whether or not that is the day
// the owner is ever free to sit down with the pet. Given a day, the reminder
// slides forward to the next one of those on or after the date it was
// already due — forward only, so a reminder never arrives earlier than the
// cadence allows.
//
// `day` is a JavaScript weekday (0 Sunday – 6 Saturday) for a weekly or
// fortnightly cadence, and a date of the month for a monthly one. Dates are
// capped at the 28th where they are chosen, so there is no month this can
// fail to find.
export function advanceToChosenDay(date, cadenceDays, day) {
  if (day == null || !Number.isFinite(Number(day))) return date
  const target = Number(day)

  if (cadenceDays >= 28) {
    // Built from parts rather than by nudging the month on a copy. Calling
    // setMonth on the 31st of January asks for "31 February", which JavaScript
    // rolls forward to 3 March — so a reminder due at the end of January and
    // set for the 28th would have landed in MARCH, a month late, and only in
    // the months where it mattered. Starting from the 1st there is no date to
    // overflow.
    const next = new Date(date.getFullYear(), date.getMonth(), 1)
    next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), 0)
    if (date.getDate() > target) next.setMonth(next.getMonth() + 1)
    next.setDate(target)
    return next
  }

  // Up to six days forward, which is as far as the next given weekday can
  // ever be.
  const next = new Date(date)
  const shift = (target - next.getDay() + 7) % 7
  next.setDate(next.getDate() + shift)
  return next
}

export async function checkNotificationPermission() {
  const { display } = await LocalNotifications.checkPermissions()
  return display
}

export async function requestNotificationPermission() {
  const { display } = await LocalNotifications.requestPermissions()
  return display
}

// Android 12+ only — exact-alarm delivery is a separate, optional setting
// from base notification permission (iOS has no equivalent concept, so
// these are no-ops there). The plugin already falls back to inexact
// delivery when this isn't granted, so this is purely "more precise timing
// if the user wants it," never a blocker for reminders working at all.
export async function checkExactAlarmPermission() {
  if (Capacitor.getPlatform() !== 'android') return 'granted'
  const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting()
  return exact_alarm
}

export async function requestExactAlarmPermission() {
  if (Capacitor.getPlatform() !== 'android') return 'granted'
  // Sends the user to the system "Alarms & reminders" settings screen and
  // resolves with the resulting state once they return to the app.
  const { exact_alarm } = await LocalNotifications.changeExactNotificationSetting()
  return exact_alarm
}

// Cancels just this pet's reminder — every other pet's stays scheduled.
export async function cancelQolReminder(petId) {
  if (!petId) return
  await LocalNotifications.cancel({ notifications: [{ id: qolReminderIdForPet(petId) }] })
}

// One-off cleanup for installs that predate per-pet ids. Harmless no-op
// once there's nothing pending under the old id.
async function cancelLegacySharedReminder() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: LEGACY_SHARED_REMINDER_ID }] })
  } catch {
    // Cancelling something that isn't scheduled shouldn't ever break a
    // reschedule.
  }
}

// Each pet gets its own independent reminder on its own cadence, keyed by
// qolReminderIdForPet — scheduling one never disturbs another's.
//
// Always a one-shot notification, cancelled and re-issued from `fromDate`
// (either "now" when the cadence itself changes, or the just-completed
// entry's date on save) rather than relying on the plugin's own repeating
// schedule — a fixed native repeat has no idea when the user actually did
// the assessment, so it would drift out of sync with real completions
// instead of counting fresh from each one.
export async function scheduleQolReminder({ petId, petName, cadenceDays, cadenceDay = null, fromDate }) {
  if (!petId) return

  const display = await checkNotificationPermission()
  if (display !== 'granted') return

  await cancelLegacySharedReminder()
  await cancelQolReminder(petId)

  let nextDate = new Date(fromDate)
  nextDate.setDate(nextDate.getDate() + cadenceDays)
  // The chosen weekday or date, applied before the in-the-past check so a
  // day that slides the reminder backwards can never be scheduled.
  nextDate = advanceToChosenDay(nextDate, cadenceDays, cadenceDay)
  if (nextDate.getTime() <= Date.now()) {
    // Cadence was shortened past an already-elapsed date — fire soon
    // rather than scheduling something in the past.
    nextDate = new Date(Date.now() + 60 * 1000)
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: qolReminderIdForPet(petId),
        title: 'Quality of Life check-in',
        body: `Time for ${petName}'s quality of life check-in`,
        schedule: { at: nextDate },
        // petId rides along so tapping the notification can open the
        // assessment for the pet it was actually about, rather than
        // whichever pet happens to be selected at the time.
        extra: { screen: 'assessment', petId },
      },
    ],
  })
}

export async function cancelConditionReminder(petId, conditionKey) {
  if (!petId || !conditionKey) return
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: conditionReminderId(petId, conditionKey) }],
    })
  } catch {
    // Cancelling something that was never scheduled is a no-op on both
    // platforms; never let it break a reschedule.
  }
}

// The same shape as the quality of life reminder above, and deliberately so:
// a disease check is due a set interval after the LAST one, not at a fixed
// wall-clock time, so it has to be re-issued from each completion rather
// than left to repeat natively.
//
// `cadenceDays` of 0 means the owner turned this condition's reminder off.
// The cancel above still runs, so switching it off clears anything pending
// rather than leaving the last one to fire.
export async function scheduleConditionReminder({
  petId, petName, conditionKey, conditionLabel, cadenceDays, cadenceDay = null, fromDate,
}) {
  if (!petId || !conditionKey) return

  const display = await checkNotificationPermission()
  if (display !== 'granted') return

  await cancelConditionReminder(petId, conditionKey)

  if (!cadenceDays) return

  let nextDate = new Date(fromDate ?? Date.now())
  nextDate.setDate(nextDate.getDate() + cadenceDays)
  nextDate = advanceToChosenDay(nextDate, cadenceDays, cadenceDay)
  if (nextDate.getTime() <= Date.now()) {
    nextDate = new Date(Date.now() + 60 * 1000)
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: conditionReminderId(petId, conditionKey),
        title: `${conditionLabel} check-in`,
        body: `Time for ${petName}'s ${conditionLabel.toLowerCase()} check-in`,
        schedule: { at: nextDate },
        // The condition key rides along so tapping the notification opens
        // the condition it was about rather than the conditions list.
        extra: { screen: 'condition', petId, conditionKey },
      },
    ],
  })
}

// Medication reminders repeat natively at a fixed wall-clock time, which is
// the opposite choice to scheduleQolReminder above — and deliberately so. A
// QoL check-in is due a set interval after the *last* one, so it has to be
// re-issued from each completion. A tablet at 8am is due at 8am regardless
// of whether yesterday's was given, so a native daily repeat is both correct
// and survives the app never being opened.
//
// MAX_SLOTS caps how many pending ids one medication can leave behind.
// Cancelling has to cover every slot the medication might previously have
// had, not just the ones it has now — otherwise reducing a drug from three
// doses a day to one would leave the other two firing forever.
export const MAX_MEDICATION_SLOTS = 12

export async function cancelMedicationReminders(medicationId) {
  if (!medicationId) return
  const notifications = Array.from({ length: MAX_MEDICATION_SLOTS }, (_, index) => ({
    id: medicationReminderId(medicationId, index),
  }))
  try {
    await LocalNotifications.cancel({ notifications })
  } catch {
    // Cancelling ids that were never scheduled is a no-op on both platforms;
    // never let it break a reschedule.
  }
}

// A local date from an ISO 'YYYY-MM-DD'. new Date('2026-08-25') parses as
// UTC midnight, which is the previous day for anyone west of Greenwich — and
// a weekly reminder anchored to the wrong weekday is wrong every week.
function localDateFromIso(iso) {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export async function scheduleMedicationReminders({
  medicationId, medicationName, petName, dose, times, active, remindersEnabled = true,
  scheduleMode = 'times', frequencyPeriod, frequencyCount, reminderTime, startedOn,
  reminderDays,
}) {
  if (!medicationId) return

  await cancelMedicationReminders(medicationId)

  if (!active || !remindersEnabled) return

  const display = await checkNotificationPermission()
  if (display !== 'granted') return

  const title = `${medicationName} for ${petName}`
  let notifications = []

  if (scheduleMode === 'times') {
    notifications = (times ?? []).slice(0, MAX_MEDICATION_SLOTS).map((time, index) => {
      const [hour, minute] = time.split(':').map(Number)
      return {
        id: medicationReminderId(medicationId, index),
        title,
        body: dose ? `${dose} — due now` : 'Due now',
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        extra: { screen: 'medications', medicationId },
      }
    })
  } else if (scheduleMode === 'frequency' && reminderTime) {
    // One notification per chosen day. A medication given twice a week has
    // two days and needs two reminders; the single anchored reminder that
    // came before this could only ever nudge on one of them.
    // One reminder for the whole period, at a time the OWNER chose. The app
    // still never invents a time — it just stopped refusing to use one it was
    // given. Weekly and monthly are anchored to the day the course started,
    // which is the only day in the record that means anything: a monthly
    // injection given on the 3rd should be raised on the 3rd.
    const [hour, minute] = reminderTime.split(':').map(Number)
    const anchor = localDateFromIso(startedOn) ?? new Date()
    const chosen = (reminderDays ?? []).filter((day) => Number.isFinite(Number(day)))

    // Days to put a reminder on. With none chosen, the day the course started
    // — which is what happened before an owner could choose at all, and is
    // the right answer for a once-a-month injection.
    let days = []
    if (frequencyPeriod === 'week') {
      days = chosen.length ? chosen : [anchor.getDay()]
    } else if (frequencyPeriod === 'month') {
      days = chosen.length ? chosen : [anchor.getDate()]
    } else {
      days = [null] // daily: no day component at all
    }

    const count = frequencyCount ?? 1
    const period = frequencyPeriod === 'week' ? 'this week'
      : frequencyPeriod === 'month' ? 'this month'
        : 'today'

    // A TIME PER DOSE, for a medication given several times a day.
    //
    // Ash's request, 3 Sep 2026: a dog on three-times-daily medication was
    // reminded once, at one time, for all three — which is a reminder for the
    // first dose and nothing at all for the two that are easiest to forget.
    //
    // The extra times ride in `times`, which is already a text[] of clock
    // times on this table and is empty for a frequency medication. That is
    // the same meaning it carries in 'times' mode — "the clock times this
    // drug is given" — so this is not an overloaded column, and it needs no
    // migration. `reminderTime` stays the first of them, so a medication
    // saved before today still has exactly the reminder it had.
    if (frequencyPeriod === 'day') {
      const perDose = [reminderTime, ...(times ?? [])]
        .filter((time) => typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time))
        // One reminder per distinct time, in order, whatever order they were
        // entered in.
        .filter((time, i, all) => all.indexOf(time) === i)
        .sort()
        .slice(0, MAX_MEDICATION_SLOTS)

      notifications = perDose.map((time, index) => {
        const [doseHour, doseMinute] = time.split(':').map(Number)
        return {
          id: medicationReminderId(medicationId, index),
          title,
          // Named by which dose it is, so three identical notifications in a
          // day are told apart on the lock screen.
          body: perDose.length > 1
            ? `Dose ${index + 1} of ${count}${dose ? ` — ${dose}` : ''}`
            : `${count} ${count === 1 ? 'dose' : 'doses'} due ${period}`,
          schedule: {
            on: { hour: doseHour, minute: doseMinute },
            repeats: true,
            allowWhileIdle: true,
          },
          extra: { screen: 'medications', medicationId },
        }
      })
    } else {
        notifications = days.slice(0, MAX_MEDICATION_SLOTS).map((day, index) => {
        const on = { hour, minute }
        // Capacitor's weekday is 1-7 starting at Sunday; getDay() is 0-6.
        if (frequencyPeriod === 'week') on.weekday = Number(day) + 1
        else if (frequencyPeriod === 'month') on.day = Number(day)

        return {
          id: medicationReminderId(medicationId, index),
          title,
          body: `${count} ${count === 1 ? 'dose' : 'doses'} due ${period}`,
          schedule: { on, repeats: true, allowWhileIdle: true },
          extra: { screen: 'medications', medicationId },
        }
      })
    }
  }

  // As-needed medications answer to no clock, so there is nothing to raise.
  if (notifications.length === 0) return

  await LocalNotifications.schedule({ notifications })
}

// Everything this device has queued, gone.
//
// For deleting the account or signing out: there is nothing left to
// reconcile against and nothing that should still fire. The pending queue is
// read and cancelled wholesale rather than id by id, because an id-based
// approach would have to know every kind of reminder the app has ever
// scheduled — including ones written by an older version and still sitting
// in this device's queue.
export async function cancelAllReminders() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { notifications } = await LocalNotifications.getPending()
    if (!notifications?.length) return
    await LocalNotifications.cancel({
      notifications: notifications.map((notification) => ({ id: notification.id })),
    })
  } catch (error) {
    console.error('Could not cancel pending reminders:', error.message)
  }
}

// Every reminder belonging to ONE pet: its check-in, its medications and its
// conditions.
//
// Deleting a pet used to cancel only the check-in, which left its medication
// reminders firing for an animal that no longer existed — and they repeat
// natively, so they fire forever without the app ever opening. Nothing could
// ever clear them either: rehydration and the hidden-pet sync both walk the
// pets that still exist, so a deleted pet is invisible to the very code that
// would have cleaned up after it.
//
// The ids have to be gathered BEFORE the pet row goes. Deleting it cascades
// its medications and conditions, and this cannot ask the database for the
// ids of rows that have already been removed.
export async function cancelRemindersForPet({ petId, medicationIds = [], conditionKeys = [] }) {
  if (!petId) return
  await cancelQolReminder(petId).catch((error) => {
    console.error('Could not cancel check-in reminder:', error.message)
  })
  for (const medicationId of medicationIds) {
    await cancelMedicationReminders(medicationId)
  }
  for (const conditionKey of conditionKeys) {
    await cancelConditionReminder(petId, conditionKey).catch((error) => {
      console.error('Could not cancel condition reminder:', error.message)
    })
  }
}

// Ids of everything currently queued with the OS. Used to tell "this
// reminder was never scheduled" apart from "this reminder is fine", so
// rehydration can be a no-op on a normal launch instead of tearing down and
// rebuilding every reminder each time the app opens.
export async function getPendingNotificationIds() {
  if (!Capacitor.isNativePlatform()) return []
  try {
    const { notifications } = await LocalNotifications.getPending()
    return (notifications ?? []).map((notification) => Number(notification.id))
  } catch {
    // If we can't read the queue, report none pending. Rehydration then
    // reschedules, which is wasteful but safe — the opposite mistake would
    // leave a medication silently unreminded.
    return []
  }
}

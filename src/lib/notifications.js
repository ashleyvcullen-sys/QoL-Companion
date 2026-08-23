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
export async function scheduleQolReminder({ petId, petName, cadenceDays, fromDate }) {
  if (!petId) return

  const display = await checkNotificationPermission()
  if (display !== 'granted') return

  await cancelLegacySharedReminder()
  await cancelQolReminder(petId)

  const nextDate = new Date(fromDate)
  nextDate.setDate(nextDate.getDate() + cadenceDays)
  if (nextDate.getTime() <= Date.now()) {
    // Cadence was shortened past an already-elapsed date — fire soon
    // rather than scheduling something in the past.
    nextDate.setTime(Date.now() + 60 * 1000)
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
const MAX_MEDICATION_SLOTS = 12

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

export async function scheduleMedicationReminders({ medicationId, medicationName, petName, dose, times, active }) {
  if (!medicationId) return

  await cancelMedicationReminders(medicationId)

  // An inactive course, or an as-needed medication with no fixed times, has
  // nothing to schedule — the cancel above is the whole job.
  if (!active || !times || times.length === 0) return

  const display = await checkNotificationPermission()
  if (display !== 'granted') return

  const notifications = times.slice(0, MAX_MEDICATION_SLOTS).map((time, index) => {
    const [hour, minute] = time.split(':').map(Number)
    return {
      id: medicationReminderId(medicationId, index),
      title: `${medicationName} for ${petName}`,
      body: dose ? `${dose} — due now` : 'Due now',
      schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      extra: { screen: 'medications', medicationId },
    }
  })

  await LocalNotifications.schedule({ notifications })
}

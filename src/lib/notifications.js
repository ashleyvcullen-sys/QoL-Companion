import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// KNOWN MULTI-PET LIMITATION: this id is fixed, which dates from when an
// account could only ever have one pet. Now that multi-pet is supported,
// scheduling a reminder for one pet cancels-and-replaces the reminder for
// every other pet — an account with several pets effectively gets a single
// shared reminder, belonging to whichever pet's schedule was saved last.
//
// Fixing it needs a per-pet id (a stable number derived from the pet's
// UUID) plus per-pet cancellation, and a product decision about whether
// several pets should produce several separate daily notifications.
export const QOL_REMINDER_ID = 1001

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

export async function cancelQolReminder() {
  await LocalNotifications.cancel({ notifications: [{ id: QOL_REMINDER_ID }] })
}

// Always a one-shot notification, cancelled and re-issued from `fromDate`
// (either "now" when the cadence itself changes, or the just-completed
// entry's date on save) rather than relying on the plugin's own repeating
// schedule — a fixed native repeat has no idea when the user actually did
// the assessment, so it would drift out of sync with real completions
// instead of counting fresh from each one.
export async function scheduleQolReminder({ petName, cadenceDays, fromDate }) {
  const display = await checkNotificationPermission()
  if (display !== 'granted') return

  await cancelQolReminder()

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
        id: QOL_REMINDER_ID,
        title: 'Quality of Life check-in',
        body: `Time for ${petName}'s quality of life check-in`,
        schedule: { at: nextDate },
        extra: { screen: 'assessment' },
      },
    ],
  })
}

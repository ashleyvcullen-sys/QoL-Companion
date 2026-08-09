import { LocalNotifications } from '@capacitor/local-notifications'

// Single pet per account (enforced elsewhere), so there's only ever one QoL
// reminder in flight — a fixed id lets us always cancel-and-reschedule
// rather than tracking ids per pet.
export const QOL_REMINDER_ID = 1001

export async function checkNotificationPermission() {
  const { display } = await LocalNotifications.checkPermissions()
  return display
}

export async function requestNotificationPermission() {
  const { display } = await LocalNotifications.requestPermissions()
  return display
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

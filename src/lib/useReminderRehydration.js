import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePets } from './PetsContext'
import {
  checkNotificationPermission,
  getPendingNotificationIds,
  medicationReminderId,
  scheduleMedicationReminders,
} from './notifications'
import { fetchMedications } from './medicationsData'

// Medication reminders are scheduled with the OS, not stored in our
// database — so they do not survive a reinstall, a restore from backup, or a
// move to a new phone. The medication rows come back from Supabase and look
// exactly as before, while the reminders behind them are gone. Nothing in
// the app would say so, and the owner has no way to notice until a dose is
// missed. For an animal on pain relief that is a real harm, so the app
// re-arms anything missing on launch.
//
// Scoped to medications on purpose. QoL check-in reminders are already
// re-issued by the Schedule screen whenever it is opened with permission
// granted, and re-arming those here would misfire: a one-shot check-in
// reminder that has legitimately already fired is *supposed* to be absent
// from the queue, and rescheduling it would nag the user a minute after
// they opened the app. A medication reminder repeats forever, so if it is
// missing it was genuinely lost.
export function useReminderRehydration() {
  // Visible pets only. Re-arming medication reminders for a pet the
  // account cannot currently see would notify someone about an animal the
  // app will not show them.
  const { visiblePets: pets } = usePets()
  const ranRef = useRef(false)

  useEffect(() => {
    // Once per app launch. Adding a medication schedules its own reminders,
    // so there is nothing to re-check on later renders.
    if (ranRef.current) return
    if (!Capacitor.isNativePlatform()) return
    if (!pets || pets.length === 0) return

    ranRef.current = true
    let cancelled = false

    async function rehydrate() {
      const display = await checkNotificationPermission()
      if (display !== 'granted' || cancelled) return

      const pending = new Set(await getPendingNotificationIds())
      if (cancelled) return

      for (const pet of pets) {
        const medications = await fetchMedications(pet.id).catch(() => [])
        if (cancelled) return

        for (const medication of medications) {
          // An inactive course, or an as-needed medication with no fixed
          // times, is *supposed* to have nothing queued — leave it alone.
          if (!medication.active || !medication.remindersEnabled || medication.times.length === 0) continue

          const expected = medication.times.map((_, index) => medicationReminderId(medication.id, index))
          if (expected.every((id) => pending.has(id))) continue

          await scheduleMedicationReminders({
            medicationId: medication.id,
            medicationName: medication.name,
            petName: pet.name,
            dose: medication.dose,
            times: medication.times,
            active: medication.active,
            remindersEnabled: medication.remindersEnabled,
          }).catch((error) => {
            console.error('Could not restore reminders for', medication.name, error.message)
          })
        }
      }
    }

    rehydrate().catch((error) => {
      console.error('Reminder rehydration failed:', error.message)
    })

    return () => { cancelled = true }
  }, [pets])
}

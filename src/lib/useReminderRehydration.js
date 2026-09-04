import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePets } from './PetsContext'
import {
  checkNotificationPermission,
  conditionReminderId,
  getPendingNotificationIds,
  medicationReminderId,
  scheduleConditionReminder,
  scheduleMedicationReminders,
} from './notifications'
import { fetchMedications } from './medicationsData'
import { fetchPetConditions } from './conditionsData'
import { conditionByKey } from './conditions'

// Medication reminders are scheduled with the OS, not stored in our
// database — so they do not survive a reinstall, a restore from backup, or a
// move to a new phone. The medication rows come back from Supabase and look
// exactly as before, while the reminders behind them are gone. Nothing in
// the app would say so, and the owner has no way to notice until a dose is
// missed. For an animal on pain relief that is a real harm, so the app
// re-arms anything missing on launch.
//
// Medications and CONDITION reminders since 3 Sep 2026. Condition reminders
// were re-issued only by the Schedule screen, which meant anything that
// cleared the queue — a reinstall, a restore, a lapsed subscription coming
// back, signing out and in — left them gone until the owner happened to open
// that screen again. They are the check-ins for the disease the app is being
// used to watch, so silently losing them is the worst of the three.
//
// Still NOT the QoL check-in. That one is re-issued by the Schedule screen
// and re-arming it here would misfire: a one-shot reminder that has
// legitimately already fired is supposed to be absent from the queue, and
// rescheduling it would nag the owner a minute after they opened the app.
// A medication or condition reminder missing from the queue was genuinely
// lost; a check-in missing from it may simply have done its job.
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

        // Conditions first — cheap, and the same pending-set test.
        const conditions = await fetchPetConditions(pet.id).catch(() => [])
        if (cancelled) return

        for (const condition of conditions) {
          if (!condition.active) continue
          if (pending.has(conditionReminderId(pet.id, condition.conditionKey))) continue
          const definition = conditionByKey(condition.conditionKey)
          if (!definition) continue

          // Resolved exactly as scheduleForCondition does in Schedule.jsx —
          // the saved entry is { days, day }, and an unset one falls back to
          // the condition's own cadence rather than to nothing. Only an
          // explicit 0 means the owner switched this reminder off; undefined
          // means they have never touched it, which is not the same thing.
          const saved = pet.schedule?.conditions?.[condition.conditionKey]
          if (saved?.days === 0) continue
          const cadenceDays = saved?.days ?? definition.cadence?.days ?? 1

          await scheduleConditionReminder({
            petId: pet.id,
            petName: pet.name,
            conditionKey: condition.conditionKey,
            conditionLabel: definition.label,
            cadenceDays,
            cadenceDay: saved?.day ?? null,
            fromDate: new Date(),
          }).catch((error) => {
            console.error('Could not restore reminder for', definition.label, error.message)
          })
        }

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

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePets } from './PetsContext'
import {
  cancelRemindersForPet,
  checkNotificationPermission,
  getPendingNotificationIds,
  qolReminderIdForPet,
  scheduleQolReminder,
} from './notifications'
import { fetchMedications } from './medicationsData'
import { fetchPetConditions } from './conditionsData'

// Keeps scheduled reminders in step with which pets are actually visible.
//
// Reminders live with the OS, not in our database, so they outlive the state
// that created them. Without this, a subscription lapsing leaves the hidden
// pets' check-in reminders firing on their old cadence — the app would
// notify someone about a pet it will not then show them, which reads as a
// bug at best and as a nag to pay at worst. Renewing has the mirror problem:
// the pet reappears with its reminder long since cancelled, and nothing
// would ever re-arm it.
//
// Covers all three kinds since 3 Sep 2026. It was scoped to the check-in on
// the reasoning that useReminderRehydration handles medications — but that
// hook only ever ADDS, and it walks visible pets, so a hidden pet's
// medication reminders had nothing to cancel them. They repeat natively, so
// a lapsed subscription meant an owner going on being reminded about doses
// for an animal the app would not show them.
//
// Re-arming stays check-in only. Medications come back through
// useReminderRehydration on the next launch, which is where that logic
// already lives, and duplicating it here would give two places the power to
// schedule the same id.
export function useHiddenPetReminderSync() {
  const { pets, visiblePets, loading } = usePets()
  // Which pets we have already reconciled, so a re-render does not re-issue
  // work. Keyed by the visible set itself, since that is the thing that has
  // to change for there to be anything to do.
  const lastKeyRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    // `loading` covers entitlements too. Acting before the limit is known
    // would cancel a subscriber's reminders on the strength of a free-tier
    // guess that is about to be corrected.
    if (loading) return
    if (pets.length === 0) return

    const visibleIds = new Set(visiblePets.map((pet) => pet.id))
    const key = `${pets.length}:${[...visibleIds].sort().join(',')}`
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key

    let cancelled = false

    async function sync() {
      const display = await checkNotificationPermission()
      if (display !== 'granted' || cancelled) return

      // Cancel first, and unconditionally. Cancelling a reminder that is not
      // scheduled is a no-op, so this needs no knowledge of what is pending.
      //
      // The pet is hidden, not deleted, so its medications and conditions are
      // still readable — the ids can be looked up rather than gathered in
      // advance the way a delete has to.
      for (const pet of pets) {
        if (visibleIds.has(pet.id)) continue
        const [medications, conditions] = await Promise.all([
          fetchMedications(pet.id).catch(() => []),
          fetchPetConditions(pet.id).catch(() => []),
        ])
        if (cancelled) return
        await cancelRemindersForPet({
          petId: pet.id,
          medicationIds: medications.map((medication) => medication.id),
          conditionKeys: conditions.map((condition) => condition.conditionKey),
        }).catch((error) => {
          console.error('Could not cancel reminders for hidden pet:', error.message)
        })
      }

      if (cancelled) return

      // Re-arm anything visible that has lost its reminder — which is what a
      // resubscribe looks like from here. Checked against the pending queue
      // rather than rescheduled blindly, so a pet whose reminder is already
      // waiting keeps its existing fire time instead of having the clock
      // reset every launch.
      const pending = new Set(await getPendingNotificationIds())
      if (cancelled) return

      for (const pet of visiblePets) {
        if (pending.has(qolReminderIdForPet(pet.id))) continue
        // A pet with no cadence set has never had a reminder to restore.
        const cadenceDays = pet.schedule?.qol ?? pet.schedule?.general
        if (!cadenceDays) continue

        await scheduleQolReminder({
          petId: pet.id,
          petName: pet.name,
          cadenceDays,
          cadenceDay: pet.schedule?.qolDay ?? null,
          fromDate: new Date(),
        }).catch((error) => {
          console.error('Could not restore reminder for', pet.name, error.message)
        })
      }
    }

    sync().catch((error) => {
      console.error('Hidden-pet reminder sync failed:', error.message)
    })

    return () => { cancelled = true }
  }, [pets, visiblePets, loading])
}

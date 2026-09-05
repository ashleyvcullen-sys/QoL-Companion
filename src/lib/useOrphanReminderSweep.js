import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './AuthContext'
import { usePets } from './PetsContext'
import {
  MAX_MEDICATION_SLOTS,
  cancelAllReminders,
  cancelReminderIds,
  checkNotificationPermission,
  conditionReminderId,
  getPendingNotificationIds,
  medicationReminderId,
  qolReminderIdForPet,
} from './notifications'
import { fetchMedications } from './medicationsData'
import { fetchPetConditions } from './conditionsData'

// Cancels reminders that belong to nothing.
//
// Ash's report, 4 Sep 2026: a QoL check-in for "Maggie" fired on her phone
// after she had deleted the account it belonged to.
//
// The 3 Sep fix (commit 9056dc3) cancels reminders when a pet or an account
// is deleted THROUGH THE APP. That is the only moment the app has ever known
// to clean up, and it is not the only way a pet or an account stops existing:
//
//   - deleted server-side, from the Supabase dashboard, the CLI or a seed
//     script — which is exactly how the demo account has been recreated
//     several times, and the phone is never told
//   - armed by a build that predates the fix, and still sitting in the queue
//   - restored from a backup of a phone whose account has since gone
//   - the session simply expiring on a device nobody signs back in on
//
// Reminders live with the OS, not in the database, so they outlive every one
// of those. Nothing in the app cancels a reminder for an account it can no
// longer see, because every existing cleanup path walks pets that still
// exist — and a deleted pet is invisible to code that iterates pets.
//
// So this reconciles the other way round: read what the OS actually has
// queued, work out what SHOULD be queued from what the app can see, and
// cancel the difference.
//
// SAFETY. Cancelling a real reminder is the worse mistake — an owner trusts
// a dose reminder and finds out it is gone by missing a dose. So this sweeps
// only when it is certain it knows the full picture, and does nothing at all
// on any doubt: pets still loading, the pets fetch having failed, or any
// per-pet lookup erroring. Better to leave an orphan for one more launch
// than to silence a medication.
export function useOrphanReminderSweep() {
  const { session, loading: authLoading } = useAuth()
  const { visiblePets, loading, petsError } = usePets()

  // What we last reconciled against, so a re-render is not a re-sweep.
  const lastKeyRef = useRef(null)

  const petKey = visiblePets.map((pet) => pet.id).sort().join(',')

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (authLoading) return

    let cancelled = false

    // No session. Either signed out, or the account has been deleted
    // server-side and the token no longer resolves — which look identical
    // from here, and want the same answer: nothing on this device belongs to
    // anyone, so nothing should fire.
    if (!session) {
      if (lastKeyRef.current === 'no-session') return
      lastKeyRef.current = 'no-session'
      cancelAllReminders().catch((error) => {
        console.error('Could not clear reminders for a signed-out device:', error.message)
      })
      return undefined
    }

    // Every reason to hold off. `loading` already folds in entitlements and
    // whether this user's pets have actually been fetched, so an empty list
    // from the no-user pass is never mistaken for "this account has no pets".
    if (loading || petsError) return undefined

    const key = `${session.user?.id ?? 'anon'}:${petKey}`
    if (lastKeyRef.current === key) return undefined
    lastKeyRef.current = key

    async function sweep() {
      const display = await checkNotificationPermission()
      if (display !== 'granted' || cancelled) return

      const pending = await getPendingNotificationIds()
      if (!pending.length || cancelled) return

      // What the app believes should be armed. Built from the same id
      // functions that arm them, so a change to the id scheme cannot make
      // this sweep start cancelling live reminders.
      const expected = new Set()
      let complete = true

      for (const pet of visiblePets) {
        expected.add(qolReminderIdForPet(pet.id))

        const [medications, conditions] = await Promise.all([
          fetchMedications(pet.id).catch(() => { complete = false; return [] }),
          fetchPetConditions(pet.id).catch(() => { complete = false; return [] }),
        ])
        if (cancelled) return

        for (const condition of conditions) {
          expected.add(conditionReminderId(pet.id, condition.conditionKey))
        }
        // Every slot, not only the ones currently in use. A drug edited from
        // three times a day to two leaves the third slot queued until the
        // next reschedule, and that reminder is not an orphan — it belongs to
        // a medication that still exists.
        for (const medication of medications) {
          for (let index = 0; index < MAX_MEDICATION_SLOTS; index += 1) {
            expected.add(medicationReminderId(medication.id, index))
          }
        }
      }

      // A single failed lookup means the expected set is short, and every id
      // it is missing would be cancelled as an orphan. Do nothing instead.
      if (!complete || cancelled) {
        lastKeyRef.current = null
        return
      }

      const orphans = pending.filter((id) => !expected.has(id))
      if (!orphans.length || cancelled) return

      console.warn(`Cancelling ${orphans.length} reminder(s) that belong to nothing.`)
      await cancelReminderIds(orphans)
    }

    sweep().catch((error) => {
      lastKeyRef.current = null
      console.error('Could not sweep orphaned reminders:', error.message)
    })

    return () => { cancelled = true }
  }, [session, authLoading, loading, petsError, petKey, visiblePets])
}

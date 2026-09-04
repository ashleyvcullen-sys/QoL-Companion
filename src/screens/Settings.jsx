import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Lock, LogOut, Trash2, TriangleAlert } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { supabase } from '../lib/supabase'
import { cancelAllReminders, cancelRemindersForPet } from '../lib/notifications'
import { fetchMedications } from '../lib/medicationsData'
import { fetchPetConditions } from '../lib/conditionsData'
import {
  CANCELLATION_KEEPS_RECORDS,
  FREE_FEATURE_LIST,
  PAYWALL_FEATURE_LIST,
} from '../lib/paywallCopy'

// Apple's subscription management, by the two routes that exist.
//
// itms-apps:// hands straight to the App Store app and its native
// subscription sheet, which is where a cancellation actually happens.
// Capacitor passes a scheme it does not recognise to the system rather than
// trying to load it in the WebView, so assigning location is enough.
//
// The https form is the same destination for a browser, and is what the
// paywall has always used. Kept for the web build, where itms-apps means
// nothing.
//
// The RevenueCat SDK has no showManageSubscriptions in the version this app
// pins (13.4.0) — checked before writing this rather than assumed.
const MANAGE_SUBSCRIPTION_SCHEME = 'itms-apps://apps.apple.com/account/subscriptions'
const MANAGE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions'

function openManageSubscription() {
  if (Capacitor.isNativePlatform()) {
    window.location.href = MANAGE_SUBSCRIPTION_SCHEME
  } else {
    window.open(MANAGE_SUBSCRIPTION_URL, '_blank', 'noopener,noreferrer')
  }
}

// Account settings, and the one place the app says which plan you are on.
//
// These controls were spread down the foot of Home — sign out, remove a pet
// and delete an account sitting under the feature grid, where they were both
// easy to hit by accident and hard to find on purpose. Home is the screen
// somebody opens every day to record an assessment; the irreversible things
// do not belong on it.
export default function Settings() {
  const { visiblePets, hiddenPetCount, refresh, selectedPet, selectPet } = usePets()
  const { hasPremium, loading: entitlementsLoading } = useEntitlements()
  const pet = selectedPet
  const petName = pet?.name || 'your pet'
  const navigate = useNavigate()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')

  async function handleSignOut() {
    // Reminders are scheduled with the OS against this device, not this
    // account. Left armed, they go on naming a pet belonging to someone who
    // has signed out — on a shared or sold phone, to whoever has it next.
    //
    // Safe to clear because everything here is re-armed on the next launch:
    // useReminderRehydration restores medication and condition reminders,
    // and the Schedule screen re-issues the check-in.
    await cancelAllReminders()
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeletePet() {
    if (!pet || deleting) return
    setDeleting(true)
    setDeleteError('')

    // Read what this pet has scheduled BEFORE deleting it. The delete
    // cascades its medications and conditions, and their reminder ids are
    // derived from rows that will no longer exist.
    const [medications, conditions] = await Promise.all([
      fetchMedications(pet.id).catch(() => []),
      fetchPetConditions(pet.id).catch(() => []),
    ])

    const { error } = await supabase.from('pets').delete().eq('id', pet.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    // Every reminder this pet had, not only its check-in — Ash's report,
    // 3 Sep 2026. Other pets are untouched: every id cancelled here is
    // derived from this pet, this pet's medications, or this pet's
    // conditions.
    cancelRemindersForPet({
      petId: pet.id,
      medicationIds: medications.map((medication) => medication.id),
      conditionKeys: conditions.map((condition) => condition.conditionKey),
    }).catch((err) => {
      console.error('Failed to cancel reminders for deleted pet:', err.message)
    })

    // Work out the replacement *before* refreshing, while the list still
    // includes the one just deleted.
    //
    // From visiblePets, not pets: the full list contains pets hidden by a
    // lapsed subscription, and selecting one of those would point the whole
    // app at a pet the database will refuse to return anything for.
    const remaining = visiblePets.filter((p) => p.id !== pet.id)

    setShowDeleteConfirm(false)
    setDeleting(false)

    if (remaining.length > 0) {
      // Multi-pet: switch to another pet rather than bouncing the user to
      // onboarding. PetsContext would fall back to pets[0] on its own once
      // the selected id goes stale, but selecting explicitly also persists
      // the choice, so it survives a restart.
      selectPet(remaining[0].id)
    }

    // If nothing remains, pets drops to an empty array and the
    // RequireOnboardedPet route guard in App.jsx redirects to /onboarding
    // as soon as it sees pets.length === 0 — no manual navigate needed.
    await refresh()
  }

  async function handleDeleteAccount() {
    if (deletingAccount) return
    setDeletingAccount(true)
    setDeleteAccountError('')

    // Runs server-side with the service-role key (see
    // supabase/functions/delete-account) — deletes this user's pet(s), all
    // associated QoL/pain entries, and the auth.users record itself.
    // supabase-js automatically attaches the current session's access
    // token as the Authorization header.
    const { error } = await supabase.functions.invoke('delete-account')

    if (error) {
      setDeleteAccountError(error.message || 'Something went wrong deleting your account. Please try again.')
      setDeletingAccount(false)
      return
    }

    // Nothing on this account exists any more, so nothing it scheduled
    // should still fire. Cancelled from the pending queue rather than pet by
    // pet: the rows are already gone server-side, so there is nothing left to
    // derive ids from.
    await cancelAllReminders()

    // The account (and its session, server-side) no longer exists — signing
    // out here just clears the local session state before returning to
    // Login.
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="screen">
      <HomeLink />

      {/* The screen had no title of its own — it opened straight onto "Your
          Plan". That was survivable while the link said Settings and the
          screen was obviously the settings; it is not, now that it is named
          something a user has to recognise on arrival. Every other screen in
          the app titles itself this way. */}
      <Card>
        <SectionTitle>Account Management</SectionTitle>
        <p className="assessment-hint">
          Your plan, and the controls for your account and your pets' records.
        </p>
      </Card>

      <Card>
        <SectionTitle>Your Plan</SectionTitle>

        {/* "QoL Companion Basic", not "Free plan" — Ash's instruction 4 Sep
            2026. The tier has a name now, the same shape as the paid one, so
            an owner who is not subscribed is on something rather than merely
            not on the other thing.

            APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026.

            Until the entitlement row resolves, say nothing rather than
            guessing. Defaulting to the unsubscribed name for the half-second
            it takes would tell a paying subscriber they are not one. */}
        {entitlementsLoading ? (
          <p>Loading…</p>
        ) : (
          <p className="settings-plan-name">
            {hasPremium ? 'QoL Companion Premium' : 'QoL Companion Basic'}
          </p>
        )}

        {/* Hidden pets are only ever a Basic-plan situation, and this is the
            only place in the app that explains them. A statement of fact
            followed by the reassurance, in secondary type: no icon, no
            colour, no dismiss. Nothing has gone wrong and no records are at
            risk, so anything that reads as a warning would frighten someone
            about data that is perfectly safe. */}
        {!entitlementsLoading && hiddenPetCount > 0 && (
          <p className="assessment-hint">
            {hiddenPetCount} {hiddenPetCount === 1 ? 'pet is' : 'pets are'} hidden on
            Basic. Your records are saved and will return if you resubscribe.
          </p>
        )}

        {/* What you have, and what the other plan adds.
            Both lists come from lib/paywallCopy.js — the same definitions the
            paywall sells from — so the two screens cannot describe the same
            subscription differently. That is the entire reason this is not
            written out here. */}
        {!entitlementsLoading && (
          <div className="plan-compare">
            <section className={`plan-tier ${!hasPremium ? 'is-current' : ''}`.trim()}>
              <h3 className="plan-tier-name">
                QoL Companion Basic
                {!hasPremium && <span className="plan-tier-current">Your plan</span>}
              </h3>
              <ul className="plan-compare-list">
                {FREE_FEATURE_LIST.map((line) => (
                  <li key={line}>
                    <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`plan-tier plan-tier-premium ${hasPremium ? 'is-current' : ''}`.trim()}>
              <h3 className="plan-tier-name">
                QoL Companion Premium
                {hasPremium && <span className="plan-tier-current">Your plan</span>}
              </h3>
              {/* Says outright that Premium is additive. The old headings
                  carried that in the word "adds"; naming the tiers plainly is
                  clearer, but it would otherwise read as though Premium were
                  only these six things. */}
              <p className="plan-tier-note">Everything in Basic, plus:</p>
              {/* Only `text`. The paywall renders each line's `detail` (the
                  named conditions under disease-specific monitoring); here it
                  would be a paragraph inside a comparison, which is a list. */}
              <ul className="plan-compare-list">
                {PAYWALL_FEATURE_LIST.map(({ text }) => (
                  <li key={text}>
                    {/* A tick for what you have, a lock for what you do not.
                        The same lock the Home tiles and the tour use, so it
                        reads as the same fact rather than a third idea — and
                        it stops six green ticks implying the reader already
                        has all of this. */}
                    {hasPremium
                      ? <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                      : <Lock size={14} strokeWidth={2.5} aria-hidden="true" className="plan-locked-icon" />}
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* Subscribers get a way to cancel, free users get a way to start.
            Labelled for what it does: there is nothing to "manage" on a plan
            you are not paying for, and a Manage Subscription button that
            opens a sales page is the kind of thing that reads as a trick. */}
        {!entitlementsLoading && hasPremium && (
          <>
            <p className="assessment-hint">{CANCELLATION_KEEPS_RECORDS}</p>
            <Btn
              type="button"
              variant="outline"
              className="btn-block"
              onClick={openManageSubscription}
            >
              Manage subscription
            </Btn>
          </>
        )}

        {!entitlementsLoading && !hasPremium && (
          <Btn type="button" className="btn-block" onClick={() => navigate('/paywall')}>
            See Premium
          </Btn>
        )}
      </Card>

      <Card>
        <SectionTitle>Account</SectionTitle>

        <button type="button" className="sign-out-button" onClick={handleSignOut}>
          <LogOut size={14} /> Sign out
        </button>

        {/* Two destructive actions, told apart.
            //
            They shared one class until 3 Sep 2026 — same size, same muted
            grey, same centred line — so "Remove Bailey" and "Delete Account"
            were indistinguishable at a glance. One takes a pet off an account
            somebody keeps using; the other ends the account and takes every
            pet, every assessment and every photo with it. Reading them
            wrongly is not a recoverable mistake, and the app was doing
            nothing to help.

            Three things separate them now: the account one is in the severity
            colour rather than grey, it is boxed rather than a bare line, and
            it says underneath what it destroys. Colour alone would not be
            enough — it is the one signal a colour-blind owner may not get,
            and the consequence line is the one that cannot be missed. */}
        {pet && (
          <button
            type="button"
            className="destructive-link"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 size={14} /> Remove {petName}
          </button>
        )}

        <div className="destructive-block">
          <button
            type="button"
            className="destructive-link severe"
            onClick={() => setShowDeleteAccountConfirm(true)}
          >
            <TriangleAlert size={14} /> Delete Account
          </button>
          {/* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. */}
          <p className="destructive-note">
            Permanently deletes your account and every pet, assessment, photo and
            record on it. This cannot be undone.
          </p>
        </div>
      </Card>

      {showDeleteConfirm && (
        <Modal
          title={`Delete ${petName}?`}
          onClose={() => (deleting ? null : setShowDeleteConfirm(false))}
        >
          <p>
            This will permanently delete {petName} and all their data. This cannot be undone.
          </p>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Btn>
            <Btn type="button" variant="danger" onClick={handleDeletePet} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Btn>
          </div>
        </Modal>
      )}

      {showDeleteAccountConfirm && (
        <Modal
          title="Delete Account?"
          onClose={() => (deletingAccount ? null : setShowDeleteAccountConfirm(false))}
        >
          <p>
            This will permanently delete your account and all associated data. This cannot be undone.
          </p>
          {deleteAccountError && <p className="form-error" role="alert">{deleteAccountError}</p>}
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setShowDeleteAccountConfirm(false)} disabled={deletingAccount}>
              Cancel
            </Btn>
            <Btn type="button" variant="danger" onClick={handleDeleteAccount} disabled={deletingAccount}>
              {deletingAccount ? 'Deleting…' : 'Delete Account'}
            </Btn>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  )
}

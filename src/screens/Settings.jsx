import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { supabase } from '../lib/supabase'
import { cancelQolReminder } from '../lib/notifications'

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
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeletePet() {
    if (!pet || deleting) return
    setDeleting(true)
    setDeleteError('')

    const { error } = await supabase.from('pets').delete().eq('id', pet.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    // Reminders are now per-pet, so this pet's own scheduled reminder has
    // to go with it — otherwise it keeps firing for a pet that no longer
    // exists. Other pets' reminders are keyed separately and unaffected.
    cancelQolReminder(pet.id).catch((err) => {
      console.error('Failed to cancel reminder for deleted pet:', err.message)
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

    // The account (and its session, server-side) no longer exists — signing
    // out here just clears the local session state before returning to
    // Login.
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Your Plan</SectionTitle>

        {/* Until the entitlement row resolves, say nothing rather than
            guessing. Defaulting to "Free plan" for the half-second it takes
            would tell a paying subscriber they are not one. */}
        {entitlementsLoading ? (
          <p>Loading…</p>
        ) : (
          <p className="settings-plan-name">
            {hasPremium ? 'QoL Companion Premium' : 'Free plan'}
          </p>
        )}

        {/* Hidden pets are only ever a free-plan situation, and this is the
            only place in the app that explains them. A statement of fact
            followed by the reassurance, in secondary type: no icon, no
            colour, no dismiss. Nothing has gone wrong and no records are at
            risk, so anything that reads as a warning would frighten someone
            about data that is perfectly safe. */}
        {!entitlementsLoading && hiddenPetCount > 0 && (
          <p className="assessment-hint">
            {hiddenPetCount} {hiddenPetCount === 1 ? 'pet is' : 'pets are'} hidden on the
            free plan. Your records are saved and will return if you resubscribe.
          </p>
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

        {pet && (
          <button
            type="button"
            className="delete-pet-link"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Remove {petName}
          </button>
        )}

        <button
          type="button"
          className="delete-pet-link"
          onClick={() => setShowDeleteAccountConfirm(true)}
        >
          Delete Account
        </button>
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

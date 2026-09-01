import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { usePets } from '../lib/PetsContext'
import { WEIGHT_RANGES, AGE_OPTIONS } from '../lib/petOptions'
import { humanYearsForAge } from '../lib/humanYears'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import StartupErrorScreen from '../components/StartupErrorScreen'
import PetLimitModal from '../components/PetLimitModal'

const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
]

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Not sure / unknown' },
]

// The end of the line, shown when this account cannot create a pet and has
// none — so there is no Home to send them to and no paywall to offer.
//
// A screen rather than a modal, on purpose. A modal implies a way back to
// what is behind it, and what is behind it is a form that cannot be
// submitted. Every control here leads somewhere that actually exists:
// /support is outside RequireOnboardedPet, and signing out returns to a
// login that can establish a fresh session — which is the most likely fix,
// since the usual cause is a session whose identity no longer matches.
function OnboardingBlocked({ onRetry }) {
  return (
    <div className="screen">
      <Card>
        <SectionTitle>We couldn't add your pet</SectionTitle>
        <p>
          Your account is signed in, but the database refused to create the pet.
          This usually means the session has gone stale rather than anything
          being wrong with your account or your data.
        </p>
        <p>Signing out and back in resolves it in almost every case.</p>
        <Btn type="button" className="btn-block" onClick={onRetry}>Try again</Btn>
        <button
          type="button"
          className="subtle-link"
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.assign('/login')
          }}
        >
          Sign out and start again
        </button>
        <Link to="/support" className="subtle-link">Contact support</Link>
      </Card>
    </div>
  )
}

export default function Onboarding() {
  const { user, loading: authLoading, authError, retryAuth } = useAuth()
  const { pets, atPetLimit, loading: petsLoading, petsError, refresh, selectPet } = usePets()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [species, setSpecies] = useState('dog')
  const [weightRangeKey, setWeightRangeKey] = useState('')
  const [ageLabel, setAgeLabel] = useState('')
  const [sex, setSex] = useState('unknown')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // Set when the database refuses the insert, so the rejection lands as an
  // offer rather than a Postgres error.
  const [showLimitPrompt, setShowLimitPrompt] = useState(false)
  // Set when the insert is refused for an account with no pets, where a
  // dismissible prompt would have nowhere to dismiss to.
  const [blocked, setBlocked] = useState(false)

  if (authError) {
    return <StartupErrorScreen message="We couldn't verify your login." detail={authError} onRetry={retryAuth} />
  }
  if (authLoading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (petsError) {
    return <StartupErrorScreen message="We couldn't load your pet's data." detail={petsError} onRetry={refresh} />
  }
  if (petsLoading) return <p>Loading…</p>

  // Whether this account has a pet the app can actually show.
  //
  // This is the single fact that decides whether anywhere else in the app is
  // reachable. RequireOnboardedPet sends an account with no pets straight
  // back to this screen, and EVERY route worth dismissing a prompt to — Home
  // and /paywall included — sits behind it. So for an account with none,
  // "dismiss and go somewhere" has no somewhere.
  const hasPet = pets.length > 0

  // At the limit WITH a pet: go Home rather than float a modal over an empty
  // screen. Home is reachable precisely because there is a pet.
  //
  // This replaces a PetLimitModal whose onClose navigated to '/'. That was
  // right for this case and catastrophic for the one below, because both of
  // its buttons — "Not now" and "See plans" — lead into the guarded area.
  if (atPetLimit && hasPet) return <Navigate to="/" replace />

  // At the limit with NO pet. The limit rules should not be able to produce
  // this (a limit of one always leaves one pet visible), so reaching it means
  // something has genuinely gone wrong — most likely a session whose
  // auth.uid() no longer matches the account the client thinks it is.
  //
  // Deliberately NOT a dismissible modal. There is nowhere for a dismissal to
  // go, and offering one is what turned this screen into a trap: every exit
  // it could offer bounces off RequireOnboardedPet and lands back here.
  if (atPetLimit && !hasPet) return <OnboardingBlocked onRetry={refresh} />

  // The same terminal state, reached the other way: the form looked
  // submittable, the database refused it, and this account has no pet to go
  // Home to. Checked here rather than beside the form so there is exactly one
  // definition of what "blocked" looks like.
  if (blocked) return <OnboardingBlocked onRetry={refresh} />

  // A free account with no pets must ALWAYS get the form. Nothing above this
  // line may stop it: this is the only route by which an account gets its
  // first pet, and blocking it makes the app unusable rather than limited.

  // `pets` rather than visiblePets: a returning user whose second pet is
  // hidden has still seen the welcome flow, and replaying it for them would
  // be a regression on top of a downgrade.
  const isAddingAnother = pets.length > 0

  const weightOptions = WEIGHT_RANGES[species]
  const humanYears = humanYearsForAge(species, weightRangeKey, ageLabel)

  function handleSpeciesChange(nextSpecies) {
    setSpecies(nextSpecies)
    setWeightRangeKey('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    // The id is minted here rather than by the database, so this insert does
    // not have to ask for the row back.
    //
    // THIS IS NOT A STYLE CHOICE. `.insert(...).select()` on `pets` cannot
    // succeed under the current RLS, and no pet could be created through the
    // app at all until this changed.
    //
    // INSERT ... RETURNING applies the SELECT policy to the new row.
    // pets_select_visible requires `id in (select visible_pet_ids(...))`, and
    // visible_pet_ids is declared `stable` — so it runs on the statement's own
    // snapshot and cannot see the row that statement is inserting. The new pet
    // is never in its own visible set, the RETURNING row fails the policy, and
    // Postgres aborts and rolls back the whole insert with a 42501 that reads
    // as "you are at your limit".
    //
    // Knowing the id up front also means the pet can be selected below without
    // a second round trip. The row is read back normally on the next refresh(),
    // where it is a separate statement and the policy is satisfied.
    const newPetId = crypto.randomUUID()

    const { error } = await supabase
      .from('pets')
      .insert({
        id: newPetId,
        user_id: user.id,
        name,
        species,
        weight_range_key: weightRangeKey || null,
        age_label: ageLabel || null,
        sex,
        // Additional pets skip the first-run experiences — the user has
        // already seen both, and leaving these false would bounce them
        // straight back into the Welcome walkthrough (and re-trigger the
        // Home tour) just for adding a pet.
        ...(isAddingAnother ? { has_seen_welcome: true, has_seen_app_tour: true } : {}),
      })

    if (error) {
      // 23505 used to be swallowed here and treated as "already onboarded,
      // go home" — a workaround for the old one-pet-per-account unique
      // constraint. That constraint is now dropped (see
      // supabase/migrations/20260823000000_drop_pets_user_id_unique.sql),
      // so a duplicate-key error here is a genuine failure and must be
      // surfaced rather than silently looking like success.
      if (error.code === '23505') {
        setErrorMessage(
          "Couldn't add this pet — the database still has the one-pet-per-account restriction in place. " +
          'If you have just added multi-pet support, run the pending database migration and try again.',
        )
      } else if (error.code === '42501') {
        // The RLS backstop refused the insert — the client's count and the
        // database's disagreed, most likely because the subscription changed
        // in another session while this form was open. The raw message is
        // "new row violates row-level security policy for table \"pets\"",
        // which tells the owner nothing and reads like a fault.
        //
        // WHICH recovery depends entirely on whether this account has a pet,
        // and getting that wrong is the bug this branch used to have. It
        // always showed PetLimitModal, whose every exit leads into the
        // guarded area — so for an account with no pets, "Not now" and "See
        // plans" both bounced off RequireOnboardedPet and returned the user
        // to this same form, refused again, forever.
        if (hasPet) setShowLimitPrompt(true)
        else setBlocked(true)
      } else {
        setErrorMessage(error.message)
      }
      setSubmitting(false)
      return
    }

    await refresh()
    // Switch to the pet that was just created, rather than leaving the user
    // on whichever pet they were viewing before.
    selectPet(newPetId)
    navigate('/')
  }

  return (
    <div className="screen">
      <Card>
        <SectionTitle>{isAddingAnother ? 'Add Another Pet' : "Welcome — Let's Add Your First Pet"}</SectionTitle>
        <p className="home-subtitle">
          {isAddingAnother
            ? 'Set up a separate QoL record for another pet. Each pet has their own assessments, trends, and reminders — switch between them any time from the Home screen.'
            : 'Set up a QoL record for a pet — you can add more later.'}
        </p>
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="pet-name">Name</label>
            <input
              id="pet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <fieldset className="field-group">
            <legend>Species</legend>
            <div className="radio-row">
              {SPECIES_OPTIONS.map((opt) => (
                <label key={opt.value} className="radio-pill">
                  <input
                    type="radio"
                    name="species"
                    value={opt.value}
                    checked={species === opt.value}
                    onChange={() => handleSpeciesChange(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="pet-weight">Weight range</label>
            <select
              id="pet-weight"
              value={weightRangeKey}
              onChange={(e) => setWeightRangeKey(e.target.value)}
              required
            >
              <option value="" disabled>Select a weight range</option>
              {weightOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pet-age">Age</label>
            <select
              id="pet-age"
              value={ageLabel}
              onChange={(e) => setAgeLabel(e.target.value)}
              required
            >
              <option value="" disabled>Select an age</option>
              {AGE_OPTIONS.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>

          {humanYears != null && (
            <div className="tip-callout">
              <span className="tip-callout-icon">💡</span>
              <p>
                <strong>Did you know?</strong> At {ageLabel}, {name || 'your pet'} is approximately <strong>{humanYears} in human years</strong> — incorporating ideas from AAHA and AAFP life-stage guidelines.
              </p>
            </div>
          )}

          <fieldset className="field-group">
            <legend>Sex</legend>
            <div className="radio-row">
              {SEX_OPTIONS.map((opt) => (
                <label key={opt.value} className="radio-pill">
                  <input
                    type="radio"
                    name="sex"
                    value={opt.value}
                    checked={sex === opt.value}
                    onChange={() => setSex(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Btn type="submit" className="btn-block" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Btn>
          {/* Only when adding an extra pet — during genuine first-run
              onboarding there's no Home to go back to yet. */}
          {isAddingAnother && (
            <button type="button" className="subtle-link" onClick={() => navigate('/')} disabled={submitting}>
              Cancel
            </button>
          )}
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        </form>
      </Card>

      {/* The database refused the insert after the fact. Dismissing returns
          to Home rather than to the form: the form cannot succeed in this
          state, so leaving them on it would invite a second attempt at
          something already established to fail. */}
      {showLimitPrompt && <PetLimitModal onClose={() => navigate('/')} />}
    </div>
  )
}

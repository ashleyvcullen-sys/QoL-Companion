import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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

  if (authError) {
    return <StartupErrorScreen message="We couldn't verify your login." detail={authError} onRetry={retryAuth} />
  }
  if (authLoading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (petsError) {
    return <StartupErrorScreen message="We couldn't load your pet's data." detail={petsError} onRetry={refresh} />
  }
  if (petsLoading) return <p>Loading…</p>

  // At the limit, the form is not shown at all. PetSwitcher already offers
  // the prompt rather than this route, so arriving here means a direct URL,
  // a stale tab, or a subscription that lapsed between opening the form and
  // submitting it. Filling in a form whose submit is guaranteed to be
  // refused is worse than being told up front.
  if (atPetLimit) {
    return (
      <div className="screen">
        <PetLimitModal onClose={() => navigate('/')} />
      </div>
    )
  }

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

    const { data: created, error } = await supabase
      .from('pets')
      .insert({
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
      .select()
      .single()

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
        // The RLS backstop refused the insert — which means the client's
        // count and the database's disagreed, most likely because the
        // subscription changed in another session while this form was open.
        // The raw message is "new row violates row-level security policy for
        // table \"pets\"", which tells the owner nothing and reads like a
        // fault. Show the offer instead, exactly as the pre-insert check
        // would have.
        setShowLimitPrompt(true)
      } else {
        setErrorMessage(error.message)
      }
      setSubmitting(false)
      return
    }

    await refresh()
    // Switch to the pet that was just created, rather than leaving the user
    // on whichever pet they were viewing before.
    if (created?.id) selectPet(created.id)
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
                <strong>Did you know?</strong> At {ageLabel}, {name || 'your pet'} is approximately <strong>{humanYears} in human years</strong> — based on AAHA/AAFP life stage guidelines.
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

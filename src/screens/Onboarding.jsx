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
  const { pets, loading: petsLoading, petsError, refresh } = usePets()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [species, setSpecies] = useState('dog')
  const [weightRangeKey, setWeightRangeKey] = useState('')
  const [ageLabel, setAgeLabel] = useState('')
  const [sex, setSex] = useState('unknown')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (authError) {
    return <StartupErrorScreen message="We couldn't verify your login." detail={authError} onRetry={retryAuth} />
  }
  if (authLoading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (petsError) {
    return <StartupErrorScreen message="We couldn't load your pet's data." detail={petsError} onRetry={refresh} />
  }
  if (petsLoading) return <p>Loading…</p>
  // One pet per account in this build — multi-pet is not part of it, so an
  // already-onboarded user has nothing to do here.
  if (pets.length > 0) return <Navigate to="/" replace />

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

    const { error } = await supabase.from('pets').insert({
      user_id: user.id,
      name,
      species,
      weight_range_key: weightRangeKey || null,
      age_label: ageLabel || null,
      sex,
    })

    if (error) {
      if (error.code === '23505') {
        // A pet row already exists for this user (e.g. a duplicate submit, or
        // this screen was reached after onboarding already completed) — just
        // pick up the existing pet instead of showing a raw DB error.
        await refresh()
        navigate('/')
        return
      }
      setErrorMessage(error.message)
      setSubmitting(false)
      return
    }

    await refresh()
    navigate('/')
  }

  return (
    <div className="screen">
      <Card>
        <SectionTitle>Welcome — Let's Add Your First Pet</SectionTitle>
        <p className="home-subtitle">Set up a QoL record for a pet — you can add more later.</p>
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
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: "#FBEFF1", border: "1px solid #F0DCE1", marginBottom: 14 }}>
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>💡</span>
              <p style={{ fontSize: 12.5, color: "#7A5B63", margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: "#3D2B30" }}>Did you know?</strong> At {ageLabel}, {name || 'your pet'} is approximately <strong>{humanYears} in human years</strong> — based on AAHA/AAFP life stage guidelines.
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
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        </form>
      </Card>
    </div>
  )
}

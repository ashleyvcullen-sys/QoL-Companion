import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { usePets } from '../lib/PetsContext'
import { usePremiumDenial } from '../lib/premiumErrors'
import { conditionByKey } from '../lib/conditions'
import { giModulesForSpecies } from '../lib/giModules'
import {
  GI_KEY,
  activeGiModuleKeys,
  normaliseGiConfig,
  parametersForGi,
  setOtherGiCondition,
  toggleGiModule,
} from '../lib/giConfig'
import { addPetCondition, saveConditionConfig, usePetConditions } from '../lib/conditionsData'

// Choosing what to monitor for Gastrointestinal Disease.
//
// Its own screen rather than a branch inside ConditionSetup, which is built
// around cancer's diagnosis → suggested-modules → treatment flow. GI has none
// of that: the owner already knows what their pet has, and the list they pick
// from IS the list of things to watch. Forcing it through cancer's shape would
// have meant a diagnosis step that infers nothing.
export default function GastrointestinalSetup() {
  const { selectedPet: pet } = usePets()
  // Turns an RLS refusal into the paywall rather than a Postgres string.
  const premiumOr = usePremiumDenial('conditions')
  const navigate = useNavigate()
  const definition = conditionByKey(GI_KEY)

  const { conditions, loading, refresh } = usePetConditions(pet?.id)
  const petCondition = conditions.find((entry) => entry.conditionKey === GI_KEY) ?? null

  // A local draft, seeded once the saved config arrives. Editing a draft
  // rather than writing on every tap means an owner can change their mind
  // without a round trip to the database each time.
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (petCondition && draft === null) setDraft(normaliseGiConfig(petCondition.config))
  }, [petCondition, draft])

  const config = draft ?? normaliseGiConfig(petCondition?.config)
  const active = activeGiModuleKeys(config)
  const modules = giModulesForSpecies(pet?.species)
  const questionCount = parametersForGi(config, pet?.species).length
  const cancerSelected = active.includes('gi_cancer')
  const foodAllergySelected = active.includes('food_sensitivity')

  async function handleSave() {
    if (busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      const id = petCondition?.id
        ?? (await addPetCondition({ petId: pet.id, conditionKey: GI_KEY })).id
      await saveConditionConfig(id, config)
      refresh()
      navigate(`/conditions/${GI_KEY}`)
    } catch (error) {
      setErrorMessage(premiumOr(error, 'Could not save that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (!pet || loading || !definition) {
    return (
      <div className="screen">
        <HomeLink />
        <Card><p>Loading…</p></Card>
        <Footer />
      </div>
    )
  }

  return (
    <div className="screen">
      <HomeLink />
      <Link to={`/conditions/${GI_KEY}`} className="subtle-link">← Back</Link>

      <Card>
        <div className="condition-heading">
          {definition.Icon && (
            <span className="icon-badge condition-badge">
              <definition.Icon size={34} color="#fff" />
            </span>
          )}
          <SectionTitle>What To Monitor</SectionTitle>
        </div>
        <p className="assessment-hint">
          Gut problems look different depending on the cause. Tell us what applies to
          {pet.name} and this section will ask about those things only.
        </p>
        <p className="assessment-hint">
          You can pick more than one, and change this at any time.
        </p>
      </Card>

      <Card>
        <SectionTitle>What Does {pet.name} Have?</SectionTitle>
        <div className="include-group">
          <div className="symptom-chips">
            {modules.map((module) => (
              <button
                key={module.key}
                type="button"
                className={`chip ${active.includes(module.key) ? 'selected' : ''}`.trim()}
                onClick={() => setDraft(toggleGiModule(config, module.key))}
              >
                {module.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="gi-other">Something else? (optional)</label>
          <input
            id="gi-other"
            type="text"
            value={config.otherCondition}
            placeholder="e.g. protein-losing enteropathy"
            onChange={(e) => setDraft(setOtherGiCondition(config, e.target.value))}
          />
          <p className="assessment-hint">
            Recorded for your vet. The everyday questions below cover most gut problems
            whatever the cause, so you will still get a useful record.
          </p>
        </div>
      </Card>

      {/* Cancer of the gut is monitored by the Cancer section, which already
          has the diagnoses, the treatment modules and the grading built for
          it. Rebuilding a lesser version here would give an owner a worse form
          and split one pet's history across two sections. */}
      {cancerSelected && (
        <Card>
          <SectionTitle>Gastrointestinal Cancer</SectionTitle>
          <p>
            Cancer is monitored in its own section, which is built for it — the diagnosis,
            the treatment {pet.name} is on, and side effects graded the way an oncologist
            would. This section will not ask about it.
          </p>
          <Btn
            type="button"
            variant="outline"
            className="btn-block"
            onClick={() => navigate('/conditions/cancer')}
          >
            Go to Cancer monitoring
          </Btn>
        </Card>
      )}

      {/* A food trial is monitored properly by Allergies and Skin Disease —
          which diet, when it started, how long it has run, whether it was
          broken and with what, and the whole re-challenge protocol, with the
          milestones drawn on its calendar. This section asked a two-question
          version of the same thing until 29 Aug 2026, which split one trial's
          record across two places. Same reasoning as gut cancer above. */}
      {foodAllergySelected && (
        <Card>
          <SectionTitle>Food Sensitivity Or Allergy</SectionTitle>
          <p>
            {/* PENDING ASH — wording. */}
            Food allergies are monitored in Allergies and Skin Disease, which follows the whole
            diet trial. This section will not ask about it.
          </p>
          <Btn
            type="button"
            variant="outline"
            className="btn-block"
            onClick={() => navigate('/conditions/allergies')}
          >
            Go to Allergies and Skin Disease
          </Btn>
        </Card>
      )}

      <Card>
        <p className="assessment-hint">
          {questionCount} question{questionCount === 1 ? '' : 's'} each time you fill this in.
        </p>
        <Btn type="button" className="btn-block" onClick={handleSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Btn>
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>

      <Footer />
    </div>
  )
}

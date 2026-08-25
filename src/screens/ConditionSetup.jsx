import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import ChoiceButtons from '../components/ChoiceButtons'
import PetText from '../components/PetText'
import { usePets } from '../lib/PetsContext'
import { conditionByKey } from '../lib/conditions'
import { DIAGNOSES, SIGN_MODULE_LIST, TREATMENT_MODULE_LIST, subtypesFor } from '../lib/cancerModules'
import {
  activeModuleKeys,
  addInstance,
  diagnosisDetail,
  instancesOfType,
  normaliseCancerConfig,
  parametersForCancer,
  removeInstance,
  setDiagnosisDetail,
  setOtherDiagnosis,
  setTreatment,
  toggleDiagnosis,
  toggleModule,
} from '../lib/cancerConfig'
import { addPetCondition, saveConditionConfig, usePetConditions } from '../lib/conditionsData'

// Choosing what to monitor, for a condition whose questions are composed
// rather than fixed.
//
// Deliberately a separate route rather than a card on the monitoring page.
// The monitoring page is what someone opens daily; this is what they open
// once, and then occasionally when something changes.
export default function ConditionSetup() {
  const { selectedPet: pet } = usePets()
  const navigate = useNavigate()
  const { conditionKey } = useParams()
  const definition = conditionByKey(conditionKey ?? '')

  const { conditions, loading, refresh } = usePetConditions(pet?.id)
  const petCondition = conditions.find((entry) => entry.conditionKey === conditionKey) ?? null

  // Local draft, seeded from the saved config once it arrives. Editing a
  // draft rather than writing on every tap means an owner can change their
  // mind without three round trips to the database.
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [newLabels, setNewLabels] = useState({})

  useEffect(() => {
    if (petCondition && draft === null) setDraft(normaliseCancerConfig(petCondition.config))
  }, [petCondition, draft])

  const config = draft ?? normaliseCancerConfig(petCondition?.config)
  const active = activeModuleKeys(config)
  const questionCount = parametersForCancer(config).length

  // Everything below the diagnosis stays hidden until one is answered.
  // Which signs are worth watching depends on what {name} has, so offering
  // the module list first asks for a choice with no basis behind it.
  const hasDiagnosis = config.diagnoses.length > 0

  const treatmentChosen = config.treatment && config.treatment !== 'none'

  // Ensures a pet_conditions row exists and returns its id. Nothing creates
  // one when the owner taps into a condition any more, so the first save is
  // what brings it into being.
  async function ensureConditionRow() {
    if (petCondition) return petCondition.id
    const created = await addPetCondition({ petId: pet.id, conditionKey })
    return created.id
  }

  async function handleSave() {
    if (busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      const id = await ensureConditionRow()
      await saveConditionConfig(id, config)
      refresh()
      navigate(`/conditions/${conditionKey}`)
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Leaving for the medications screen has to SAVE first. The diagnosis and
  // modules live in a local draft until Save is pressed, so navigating away
  // from an unsaved draft threw away everything the owner had just chosen —
  // and they came back to an empty setup screen with no idea why.
  async function handleAddToMedications() {
    if (busy) return
    setErrorMessage('')

    {
      setBusy(true)
      try {
        const id = await ensureConditionRow()
        await saveConditionConfig(id, config)
        refresh()
      } catch (error) {
        // Staying put with the draft intact beats navigating away and losing
        // it, so the error stops the trip rather than being swallowed.
        setErrorMessage(error.message || 'Could not save that. Please try again.')
        setBusy(false)
        return
      }
      setBusy(false)
    }

    navigate('/medications', {
      state: {
        returnTo: `/conditions/${conditionKey}/setup`,
        returnLabel: `${definition?.label ?? 'monitoring'} setup`,
      },
    })
  }

  function handleAdd(module) {
    const label = (newLabels[module.key] ?? '').trim()
    if (!label) return
    setDraft(addInstance(config, { label, type: module.perInstance }))
    setNewLabels((current) => ({ ...current, [module.key]: '' }))
  }

  if (!definition) {
    return (
      <div className="screen">
        <HomeLink />
        <Card>
          <SectionTitle>Not Found</SectionTitle>
          <p>That condition isn't available.</p>
          <Link to="/conditions" className="subtle-link">Back to All Conditions</Link>
        </Card>
        <Footer />
      </div>
    )
  }

  return (
    <div className="screen">
      <HomeLink />
      <Link to={`/conditions/${conditionKey}`} className="subtle-link">← Back</Link>

      <Card>
        <div className="condition-heading">
          {definition.Icon && (
            <span className="icon-badge condition-badge">
              <definition.Icon size={34} color="#fff" />
            </span>
          )}
          <SectionTitle>What To Monitor</SectionTitle>
        </div>
        {/* The condition's setup text. NOT its summary — "there are many
            different types of cancer" is the answer to "is this the right
            condition for my pet?", which was already answered on the previous
            screen. By the time someone is here they have chosen cancer; what
            they need now is what this screen is asking them to do. */}
        {(definition.setupIntro ?? definition.intro) && (
          <p className="assessment-hint">
            <PetText template={definition.setupIntro ?? definition.intro} pet={pet} />
          </p>
        )}
      </Card>

      {loading && <Card><p>Loading…</p></Card>}

      {!loading && (
        <>
          <Card>
            <SectionTitle>Diagnosis</SectionTitle>
            {/* .include-group is the app's wrapper for a block of chips —
                the report picker uses it too. It carries the 8px internal
                gap and 16px top margin that give every chip group in the app
                the same rhythm, which hand-placed margins here would not. */}
            <div className="include-group">
              {/* Chips rather than ChoiceButtons: a pet can have more than
                  one cancer, and a cancer that has spread is two things to
                  watch rather than one. */}
              <div className="symptom-chips">
                {DIAGNOSES.map((diagnosis) => (
                  <button
                    key={diagnosis.key}
                    type="button"
                    className={`chip ${config.diagnoses.includes(diagnosis.key) ? 'selected' : ''}`.trim()}
                    onClick={() => setDraft(toggleDiagnosis(config, diagnosis.key))}
                  >
                    {diagnosis.label}
                  </button>
                ))}
              </div>
            </div>

            {/* A diagnosis can ask a follow-up of its own, for this species
                only. Feline lymphoma is the first: the site is what the vet
                will have told the owner, and it changes what is worth
                watching. Canine lymphoma has no equivalent question. */}
            {config.diagnoses.map((key) => {
              const subtypes = subtypesFor(key, pet?.species)
              if (!subtypes) return null
              const detail = diagnosisDetail(config, key)
              const chosen = subtypes.options.find((o) => o.value === detail.type)
              return (
                <div key={key} className="include-group">
                  <span className="include-group-label">{subtypes.label}</span>
                  <ChoiceButtons
                    options={subtypes.options.map((o) => ({ value: o.value, label: o.label }))}
                    value={detail.type ?? null}
                    onChange={(next) => setDraft(setDiagnosisDetail(config, key, { type: next }))}
                  />
                  {chosen?.allowsFreeText && (
                    <div className="field">
                      <label htmlFor={`subtype-other-${key}`}>Which type?</label>
                      <input
                        id={`subtype-other-${key}`}
                        type="text"
                        value={detail.other ?? ''}
                        placeholder="Type it here"
                        onChange={(e) =>
                          setDraft(setDiagnosisDetail(config, key, { other: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {config.diagnoses.includes('other') && (
              <div className="field">
                <label htmlFor="other-diagnosis">What has {pet.name} been diagnosed with?</label>
                <input
                  id="other-diagnosis"
                  type="text"
                  value={config.otherDiagnosis}
                  placeholder="Type the diagnosis"
                  onChange={(e) => setDraft(setOtherDiagnosis(config, e.target.value))}
                />
              </div>
            )}
          </Card>

          {hasDiagnosis && (
            <Card>
              <SectionTitle>Things to Monitor</SectionTitle>
              <p className="assessment-hint">
                <PetText
                  template="Suggested parameters to monitor may be automatically selected based on {name}'s diagnosis. If there are additional things you'd like to monitor, you can select them here. If you aren't sure what to monitor, please speak to your veterinarian."
                  pet={pet}
                />
              </p>
              <div className="include-group">
                <div className="symptom-chips">
                  {SIGN_MODULE_LIST.map((module) => (
                    <button
                      key={module.key}
                      type="button"
                      className={`chip ${active.includes(module.key) ? 'selected' : ''}`.trim()}
                      onClick={() => setDraft(toggleModule(config, module.key))}
                    >
                      {module.label}
                    </button>
                  ))}
                </div>

                {/* What each selected module will ask about. There is no
                    separate "suggested from the diagnosis" line: the chips
                    already show what is selected, and naming them again in
                    prose was the same information twice. */}
                {SIGN_MODULE_LIST.filter((m) => active.includes(m.key) && m.summary).map((module) => (
                  <p key={module.key} className="assessment-hint">
                    <strong>{module.label}:</strong>{' '}
                    <PetText template={module.summary} pet={pet} />
                  </p>
                ))}
              </div>
            </Card>
          )}

          {hasDiagnosis && (
            <Card>
              <SectionTitle>Treatment</SectionTitle>
              <p className="assessment-hint">
                Treatment brings its own things to watch for, so this adds a few questions.
              </p>
              <div className="include-group">
                <ChoiceButtons
                  options={TREATMENT_MODULE_LIST.map((module) => ({
                    value: module.key,
                    label: module.label,
                  }))}
                  value={config.treatment}
                  onChange={(next) => setDraft(setTreatment(config, next))}
                />
              </div>

              {/* Offered rather than done automatically. The app cannot know
                  the drug, the dose or the schedule, and a medication entry
                  invented on the owner's behalf would be wrong in a place
                  where being wrong matters. */}
              {treatmentChosen && (
                <div className="include-group">
                  <p className="assessment-hint">
                    Would you like to add this to {pet.name}'s medications, so you can set up
                    reminders and record each dose?
                  </p>
                  <Btn
                    type="button"
                    variant="outline"
                    className="btn-block"
                    onClick={handleAddToMedications}
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Add to medications'}
                  </Btn>
                </div>
              )}
            </Card>
          )}

          {/* One card per module that measures instances rather than answers.
              A pet can have three lumps, and each needs its own name, its own
              measurements and its own history — so a lump is something you
              add here, not a question you answer. */}
          {hasDiagnosis && SIGN_MODULE_LIST.filter((m) => m.perInstance && active.includes(m.key)).map((module) => {
            const instances = instancesOfType(config, module.perInstance)
            const inputId = `new-instance-${module.key}`
            return (
              <Card key={module.key}>
                <SectionTitle>{module.label}</SectionTitle>
                <p className="assessment-hint">
                  {module.instanceSites
                    ? 'Add each one your vet has asked you to keep an eye on.'
                    : 'Give each one a name so you can tell them apart — where it is works well.'}
                </p>

                {module.instanceNote?.[pet?.species] && (
                  <p className="assessment-hint">
                    <PetText template={module.instanceNote[pet.species]} pet={pet} />
                  </p>
                )}

                {instances.length === 0 && <p>None added yet.</p>}

                {/* Same row shape the events list uses — .event-body is
                    what makes the title take the space and pushes the delete
                    button to the right edge. Without it the button sits
                    against the text. */}
                {instances.map((instance) => (
                  <div key={instance.id} className="event-row">
                    <div className="event-body">
                      <span className="event-title">{instance.label || 'Unnamed'}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${instance.label || 'this one'}`}
                      onClick={() => setDraft(removeInstance(config, instance.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="field">
                  <label htmlFor={inputId}>{module.instanceLabel ?? 'Where is it?'}</label>
                  {module.instanceSites ? (
                    <select
                      id={inputId}
                      value={newLabels[module.key] ?? ''}
                      onChange={(e) => setNewLabels((c) => ({ ...c, [module.key]: e.target.value }))}
                    >
                      <option value="">Choose one…</option>
                      {module.instanceSites
                        .filter((site) => !instances.some((entry) => entry.label === site))
                        .map((site) => (
                          <option key={site} value={site}>{site}</option>
                        ))}
                    </select>
                  ) : (
                    <input
                      id={inputId}
                      type="text"
                      value={newLabels[module.key] ?? ''}
                      placeholder="Left flank"
                      onChange={(e) => setNewLabels((c) => ({ ...c, [module.key]: e.target.value }))}
                    />
                  )}
                </div>

                <div className="include-group">
                  <Btn
                    type="button"
                    variant="outline"
                    className="btn-block"
                    disabled={!(newLabels[module.key] ?? '').trim()}
                    onClick={() => handleAdd(module)}
                  >
                    <Plus size={16} /> Add
                  </Btn>
                </div>
              </Card>
            )
          })}

          <Card>
            <div className="include-group">
              <p className="assessment-hint">
                {!hasDiagnosis
                  ? 'Choose a diagnosis above to carry on.'
                  : `That's ${questionCount} question${questionCount === 1 ? '' : 's'} to answer each day.`}
              </p>
            <Btn
              type="button"
              className="btn-block"
              onClick={handleSave}
              disabled={busy || !hasDiagnosis}
            >
              {busy ? 'Saving…' : 'Save'}
            </Btn>
              {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
            </div>
          </Card>
        </>
      )}

      <Footer />
    </div>
  )
}

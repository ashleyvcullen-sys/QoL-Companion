import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import ChoiceButtons from '../components/ChoiceButtons'
import ConditionParameter from '../components/ConditionParameter'
import PetText from '../components/PetText'
import { usePets } from '../lib/PetsContext'
import {
  CORE_PARAMETERS,
  DIAGNOSES,
  LUMP_MEASURES,
  NODE_MEASURES,
  SIGN_MODULE_LIST,
  TREATMENT_MODULE_LIST,
} from '../lib/cancerModules'

// Every piece of cancer wording, on one screen, rendered by the real
// components.
//
// Reviewing this content any other way means ticking through module
// combinations in setup and answering questions to reveal follow-ups — and
// the wording you are checking is the wording an owner reads, which only the
// real ConditionParameter renders faithfully. So this page mounts every
// parameter of every module at once.
//
// Deliberately NOT linked from anywhere. It is reachable by URL only:
//   /conditions/cancer/review
// An owner has no reason to see a hundred questions about conditions their
// pet does not have.
//
// Answers here go nowhere. State is local and thrown away on navigation, so
// tapping through options to see what they look like cannot write anything
// to a real pet's record.
function countPending(value, seen = new Set()) {
  if (value == null) return 0
  if (typeof value === 'string') return value.includes('PENDING ASH') ? 1 : 0
  if (typeof value !== 'object') return 0
  if (seen.has(value)) return 0
  seen.add(value)
  return Object.values(value).reduce((total, entry) => total + countPending(entry, seen), 0)
}

function Block({ title, subtitle, parameters, pet, values, onChange, startNumber }) {
  if (!parameters.length) {
    return (
      <Card>
        <SectionTitle>{title}</SectionTitle>
        <p className="assessment-hint">No questions in this one.</p>
      </Card>
    )
  }

  const pending = countPending(parameters)

  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {subtitle && (
        <p className="assessment-hint"><PetText template={subtitle} pet={pet} /></p>
      )}
      <p className="assessment-hint">
        {parameters.length} question{parameters.length === 1 ? '' : 's'}
        {pending > 0 && ` · ${pending} string${pending === 1 ? '' : 's'} still marked PENDING ASH`}
      </p>
      {parameters.map((parameter, index) => (
        <ConditionParameter
          key={parameter.key}
          parameter={parameter}
          values={values}
          pet={pet}
          number={startNumber + index}
          onChange={onChange}
        />
      ))}
    </Card>
  )
}

export default function CancerContentReview() {
  const { selectedPet: pet } = usePets()
  // Local only. Nothing here is saved.
  const [values, setValues] = useState({})
  const [species, setSpecies] = useState(pet?.species ?? 'dog')

  // Species-specific wording only differs where a parameter defines it, so
  // the toggle rewrites the pet rather than the parameters — the same thing
  // the real screens do when a cat is selected.
  const previewPet = { ...(pet ?? { name: 'your pet', sex: 'unknown' }), species }

  const measuresFor = (module) =>
    (module.perInstance === 'node' ? NODE_MEASURES : LUMP_MEASURES).map((measure) => ({
      ...measure,
      key: `${module.perInstance}:preview:${measure.key}`,
      followUp: measure.followUp
        ? { ...measure.followUp, key: `${module.perInstance}:preview:${measure.followUp.key}` }
        : undefined,
    }))

  const totalPending =
    countPending(CORE_PARAMETERS) +
    countPending(SIGN_MODULE_LIST) +
    countPending(TREATMENT_MODULE_LIST) +
    countPending(LUMP_MEASURES) +
    countPending(NODE_MEASURES)

  return (
    <div className="screen">
      <HomeLink />
      <Link to="/conditions/cancer" className="subtle-link">← Cancer</Link>

      <Card>
        <SectionTitle>Cancer Wording Review</SectionTitle>
        <p>
          Every question in every module, rendered the way an owner sees it. Nothing on this page
          is saved — tap anything you like.
        </p>
        <p className="assessment-hint">
          {totalPending} string{totalPending === 1 ? '' : 's'} across the module definitions still
          carry a PENDING ASH marker.
        </p>
        <ChoiceButtons
          options={[
            { value: 'dog', label: 'Dog wording' },
            { value: 'cat', label: 'Cat wording' },
          ]}
          value={species}
          onChange={setSpecies}
        />
        <p className="assessment-hint">
          Where a scale has no cat wording it falls back to the dog text, the same way the rest of
          the app does — so anything reading oddly as a cat needs its own levels.
        </p>
      </Card>

      <Block
        title="Core — always asked"
        subtitle="Asked for every cancer patient, whatever they have. Deliberately short: appetite, pain, activity and demeanour already come from the Overall Quality of Life Assessment."
        parameters={CORE_PARAMETERS}
        pet={previewPet}
        values={values}
        onChange={setValues}
        startNumber={1}
      />

      <Card>
        <SectionTitle>Sign Modules</SectionTitle>
        <p className="assessment-hint">
          Ten of them. An owner sees only the ones they tick, so no real patient ever faces this
          many questions at once.
        </p>
      </Card>

      {SIGN_MODULE_LIST.map((module) => (
        <Block
          key={module.key}
          title={module.label}
          subtitle={module.summary}
          parameters={module.perInstance ? measuresFor(module) : module.parameters}
          pet={previewPet}
          values={values}
          onChange={setValues}
          startNumber={1}
        />
      ))}

      <Card>
        <SectionTitle>Treatment Modules</SectionTitle>
        <p className="assessment-hint">One of these at a time, chosen at setup.</p>
      </Card>

      {TREATMENT_MODULE_LIST.map((module) => (
        <Block
          key={module.key}
          title={module.label}
          subtitle={module.summary}
          parameters={module.parameters}
          pet={previewPet}
          values={values}
          onChange={setValues}
          startNumber={1}
        />
      ))}

      <Card>
        <SectionTitle>Diagnoses</SectionTitle>
        <p className="assessment-hint">
          What each diagnosis suggests. More than one can be selected, and a diagnosis only
          suggests modules — it adds no wording of its own.
        </p>
        {DIAGNOSES.map((preset) => (
          <div key={preset.key} className="report-field-row">
            <span>{preset.label}</span>
            <strong>
              {preset.modules.length === 0
                ? 'core only'
                : preset.modules
                    .map((key) => SIGN_MODULE_LIST.find((m) => m.key === key)?.label ?? key)
                    .join(', ')}
            </strong>
          </div>
        ))}
      </Card>

      <Footer />
    </div>
  )
}

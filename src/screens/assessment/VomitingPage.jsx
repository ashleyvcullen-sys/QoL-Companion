import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import SymptomChips from '../../components/SymptomChips'
import PetText from '../../components/PetText'
import {
  VOMITING_HAS_VOMITED_OPTIONS,
  VOMITING_UNIT_OPTIONS,
  VOMITING_CHARACTER_OPTIONS,
  VOMITING_CHARACTER_OPTIONS_CAT_EXTRA,
  VOMITING_FREQUENCY_QUALIFIER_OPTIONS,
} from '../../lib/assessmentOptions'

const FREQUENCY_QUALIFIER_VALUES = VOMITING_FREQUENCY_QUALIFIER_OPTIONS.map((o) => o.value)

// `embedded` drops the page's own title and icon header. On the assessment
// this IS the page and needs both; inside a condition form the question
// already has a numbered label above it, and a second heading saying
// "Vomiting" underneath the one that says "3. Vomiting" reads as a mistake.
export default function VomitingPage({ value, onChange, icon, species, pet, embedded = false }) {
  const { hasVomited, frequency, unit, character } = value
  const isFrequencyQualifier = FREQUENCY_QUALIFIER_VALUES.includes(frequency)
  const characterOptions = species === 'cat'
    ? [...VOMITING_CHARACTER_OPTIONS.slice(0, -1), ...VOMITING_CHARACTER_OPTIONS_CAT_EXTRA, 'Other']
    : VOMITING_CHARACTER_OPTIONS

  function update(patch) {
    onChange({ ...value, ...patch })
  }

  return (
    <div className={embedded ? 'condition-embedded-page' : 'assessment-page'}>
      {!embedded && (
        <>
          <SectionTitle>Vomiting</SectionTitle>
          <IconLabelHeader icon={icon} label="Vomiting" />
        </>
      )}
      <p><PetText template="Has {name} been vomiting?" pet={pet} /></p>
      <ChoiceButtons
        options={VOMITING_HAS_VOMITED_OPTIONS}
        value={hasVomited}
        onChange={(v) => update({ hasVomited: v })}
      />

      {hasVomited === true && (
        <>
          <div className="field">
            <label htmlFor="vomit-frequency">Frequency</label>
            <input
              id="vomit-frequency"
              type="number"
              min="0"
              value={isFrequencyQualifier ? '' : frequency}
              onChange={(e) => update({ frequency: e.target.value })}
            />
          </div>

          <ChoiceButtons
            options={VOMITING_UNIT_OPTIONS}
            value={unit}
            onChange={(v) => update({ unit: v })}
          />

          <p className="field-hint">Or, if you don't have an exact count:</p>
          <ChoiceButtons
            options={VOMITING_FREQUENCY_QUALIFIER_OPTIONS}
            value={isFrequencyQualifier ? frequency : null}
            onChange={(v) => update({ frequency: v })}
          />

          <SymptomChips
            options={characterOptions}
            selected={character}
            onChange={(v) => update({ character: v })}
          />
        </>
      )}
    </div>
  )
}

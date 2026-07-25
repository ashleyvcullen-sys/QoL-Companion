import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import SymptomChips from '../../components/SymptomChips'
import {
  VOMITING_HAS_VOMITED_OPTIONS,
  VOMITING_UNIT_OPTIONS,
  VOMITING_CHARACTER_OPTIONS,
} from '../../lib/assessmentOptions'

export default function VomitingPage({ value, onChange, icon }) {
  const { hasVomited, frequency, unit, character } = value
  const frequencyUnsure = frequency === 'unsure'

  function update(patch) {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="assessment-page">
      <SectionTitle>Vomiting</SectionTitle>
      <IconLabelHeader icon={icon} label="Vomiting" />
      <p>Has your pet been vomiting recently?</p>
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
              value={frequencyUnsure ? '' : frequency}
              disabled={frequencyUnsure}
              onChange={(e) => update({ frequency: e.target.value })}
            />
          </div>

          <ChoiceButtons
            options={VOMITING_UNIT_OPTIONS}
            value={unit}
            onChange={(v) => update({ unit: v })}
          />

          <label className="unsure-toggle">
            <input
              type="checkbox"
              checked={frequencyUnsure}
              onChange={(e) => update({ frequency: e.target.checked ? 'unsure' : '' })}
            />
            Not sure of frequency
          </label>

          <SymptomChips
            options={VOMITING_CHARACTER_OPTIONS}
            selected={character}
            onChange={(v) => update({ character: v })}
          />
        </>
      )}
    </div>
  )
}

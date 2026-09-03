import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import SymptomChips from '../../components/SymptomChips'
import PetText from '../../components/PetText'
import Modal from '../../components/Modal'
import Btn from '../../components/Btn'
import { fillPetText } from '../../lib/petText'
import {
  VOMITING_HAS_VOMITED_OPTIONS,
  VOMITING_UNIT_OPTIONS,
  VOMITING_CHARACTER_OPTIONS,
  VOMITING_CHARACTER_OPTIONS_CAT_EXTRA,
  VOMITING_FREQUENCY_QUALIFIER_OPTIONS,
  VOMITING_EMERGENCY,
} from '../../lib/assessmentOptions'

const FREQUENCY_QUALIFIER_VALUES = VOMITING_FREQUENCY_QUALIFIER_OPTIONS.map((o) => o.value)

// `embedded` drops the page's own title and icon header. On the assessment
// this IS the page and needs both; inside a condition form the question
// already has a numbered label above it, and a second heading saying
// "Vomiting" underneath the one that says "3. Vomiting" reads as a mistake.
export default function VomitingPage({
  value, onChange, icon, species, pet, embedded = false,
  // Shown when this answer arrived from a disease form filled in earlier the
  // same day, so the owner knows why the question is already answered rather
  // than wondering whether the app has guessed.
  prefilledNote = null,
}) {
  const { hasVomited, frequency, unit, character } = value
  const isFrequencyQualifier = FREQUENCY_QUALIFIER_VALUES.includes(frequency)

  // Blood in the vomit, raised the moment it is ticked.
  //
  // Only on the assessment, never embedded. Inside a condition form the same
  // answer already flags red with this sentence under it (see Verdict in
  // ConditionParameter) — a modal on top of that would say the same thing
  // twice about one tick.
  //
  // Fires on the TRANSITION into the emergency state rather than on every
  // render, so dismissing it does not immediately re-open it while the chip
  // stays ticked. Same behaviour as the stool and urinary alerts, which are
  // the only other places in the assessment that interrupt an owner.
  const [showEmergency, setShowEmergency] = useState(false)
  const isEmergency = !embedded
    && (character ?? []).some((chip) => VOMITING_EMERGENCY.chips.includes(chip))

  useEffect(() => {
    if (isEmergency) setShowEmergency(true)
  }, [isEmergency])
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
      {prefilledNote && <p className="assessment-hint">{prefilledNote}</p>}
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

      {showEmergency && (
        <Modal title={VOMITING_EMERGENCY.title} onClose={() => setShowEmergency(false)}>
          <div className="warning-banner">
            <AlertTriangle size={20} />
            <p>{fillPetText(VOMITING_EMERGENCY.warning, pet)}</p>
          </div>
          <Btn type="button" variant="danger" className="btn-block" onClick={() => setShowEmergency(false)}>
            I understand
          </Btn>
        </Modal>
      )}
    </div>
  )
}

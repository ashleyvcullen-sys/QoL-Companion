import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import { SLEEP_SCALE } from '../../lib/beapScales'
import { fillPetText } from '../../lib/petText'

// The six sleep levels, scored the way every other everyday-function question
// is scored: 10 for sleeping normally down to 0 for day and night reversed.
// The levels themselves are ordered best-first, so index 0 takes 10.
//
// The opposite direction to a BEAAAAPP severity, deliberately. Sleep sits with
// appetite and hydration in the general assessment, where a higher number has
// always meant a better day and the overview multiplies it up for the pillar.
const SLEEP_SCORES = [10, 8, 6, 4, 2, 0]

export default function SleepPage({ value, onChange, pet, description, note }) {
  const levels = (SLEEP_SCALE[pet?.species] ?? SLEEP_SCALE.dog)
    .map((text) => fillPetText(text, pet))

  const isUnsure = value === 'unsure'

  return (
    <div className="assessment-page">
      <SectionTitle>Sleep</SectionTitle>

      {Array.isArray(description)
        ? description.map((text, index) => (
          <p key={index} className="assessment-hint">{text}</p>
        ))
        : description && <p className="assessment-hint">{description}</p>}

      {/* Where this answer came from, when a condition form collected it
          first. Above the options rather than below, so it is read before
          the choice rather than after it. */}
      {note && <p className="assessment-hint">{note}</p>}

      <SeverityOptionList
        levels={levels}
        value={isUnsure ? null : value}
        onChange={onChange}
        scores={SLEEP_SCORES}
      />

      {/* Kept from the slider this replaced. "Not sure" is a real answer —
          an owner who was away overnight genuinely does not know — and it is
          excluded from scoring rather than counted as a bad night. */}
      <button
        type="button"
        className={`chip ${isUnsure ? 'selected' : ''}`.trim()}
        onClick={() => onChange(isUnsure ? null : 'unsure')}
      >
        Not sure
      </button>
    </div>
  )
}

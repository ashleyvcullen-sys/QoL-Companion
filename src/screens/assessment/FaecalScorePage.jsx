import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import SymptomChips from '../../components/SymptomChips'
import PetText from '../../components/PetText'
import Modal from '../../components/Modal'
import Btn from '../../components/Btn'
import { fillPetText } from '../../lib/petText'
import {
  faecalAdviceFor,
  faecalBandLabelsFor,
  faecalColourForIndexFor,
  faecalLevelsFor,
  faecalScoresFor,
} from '../../lib/faecalScore'

// The Overall Assessment's stool question, as a faecal score (1-5 in half
// steps, 2-3 optimal) rather than the 0-10 slider it replaced on 21 Sep 2026.
//
// `faecal` is the chosen score, or null. `stool` is the everyday-function
// value the scoring reads: the score converted to 0-10, or 'unsure' / 'none'.
// Both are set together by the caller, so every existing reader of
// scores.stool keeps working unchanged.
//
// The chips and the black/tarry pop-up are exactly as before.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. The question wording.
export default function FaecalScorePage({
  faecal,
  stool,
  onScore,
  onUnsure,
  onNone,
  chipOptions,
  chipValue,
  onChipChange,
  emergency = null,
  noneOption,
  pet,
}) {
  const [showEmergency, setShowEmergency] = useState(false)
  const isEmergency = Boolean(emergency)
    && chipValue.some((chip) => emergency.chips.includes(chip))
  // Only on the change INTO the emergency state while the owner is on this
  // page — not when the page opens with it already ticked (a resumed draft, a
  // revisit, or an answer carried in from a disease form). Until 21 Sep 2026
  // the effect also ran on mount, so moving onto the page re-raised an alert
  // for an answer given earlier, which read as a response to whatever had
  // just been tapped.
  const wasEmergency = useRef(isEmergency)
  useEffect(() => {
    if (isEmergency && !wasEmergency.current) setShowEmergency(true)
    wasEmergency.current = isEmergency
  }, [isEmergency])

  // The rungs the Royal Canin chart draws for this species — the cat chart
  // has no 3.5 or 4.5, so a cat owner is no longer offered them.
  const species = pet?.species
  const levels = faecalLevelsFor(species).map((text) => text.replace(/\s*\(emergency\)\s*/g, ' ').trim())
  // The advice a red rung carries, where it is not one of the two the
  // emergency alert already covers — Ash's instruction 24 Sep 2026.
  const advice = faecal != null ? faecalAdviceFor(faecal, species) : null
  const isUnsure = stool === 'unsure' && faecal == null
  const isNone = stool === 'none'

  return (
    <div className="assessment-page">
      <SectionTitle>Faecal Score</SectionTitle>
      <p><PetText template="Which best describes {name}'s faeces lately?" pet={pet} /></p>
      {/* The hint under the question was removed on Ash's instruction
          24 Sep 2026. Every rung now carries its own band word — Optimal,
          Acceptable, Soft, Loose — so a line saying which numbers are good
          repeated what the options already say beside themselves. */}

      <SeverityOptionList
        levels={levels}
        value={faecal ?? null}
        onChange={onScore}
        scores={faecalScoresFor(species)}
        bandLabels={faecalBandLabelsFor(species)}
        colorForIndex={faecalColourForIndexFor(species)}
      />

      {advice && (
        <p
          className={advice.severity === 'emergency' ? 'condition-emergency' : 'condition-flag'}
          role={advice.severity === 'emergency' ? 'alert' : 'status'}
        >
          <AlertTriangle size={advice.severity === 'emergency' ? 17 : 15} />
          <span><PetText template={advice.text} pet={pet} /></span>
        </p>
      )}

      <div className="choice-buttons">
        <button
          type="button"
          className={`chip ${isUnsure ? 'selected' : ''}`.trim()}
          onClick={onUnsure}
        >
          Not sure
        </button>
        {noneOption && (
          <button
            type="button"
            className={`chip ${isNone ? 'selected' : ''}`.trim()}
            onClick={onNone}
          >
            {noneOption.label}
          </button>
        )}
      </div>

      <p className="assessment-hint">Anything else you noticed?</p>
      <SymptomChips options={chipOptions} selected={chipValue} onChange={onChipChange} />

      {emergency && showEmergency && (
        <Modal title={emergency.title} onClose={() => setShowEmergency(false)}>
          <div className="warning-banner">
            <AlertTriangle size={20} />
            <p>{fillPetText(emergency.warning, pet)}</p>
          </div>
          <p>{fillPetText(emergency.advice, pet)}</p>
          <Btn type="button" variant="danger" className="btn-block" onClick={() => setShowEmergency(false)}>
            I Understand
          </Btn>
        </Modal>
      )}
    </div>
  )
}

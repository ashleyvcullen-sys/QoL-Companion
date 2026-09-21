import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import SeverityOptionList from '../../components/SeverityOptionList'
import SymptomChips from '../../components/SymptomChips'
import PetText from '../../components/PetText'
import Modal from '../../components/Modal'
import Btn from '../../components/Btn'
import { fillPetText } from '../../lib/petText'
import {
  FAECAL_BAND_LABELS,
  FAECAL_SCORES,
  faecalColourForIndex,
  faecalLevelsFor,
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
  icon,
  emergency = null,
  noneOption,
  pet,
}) {
  const [showEmergency, setShowEmergency] = useState(false)
  const isEmergency = Boolean(emergency)
    && chipValue.some((chip) => emergency.chips.includes(chip))
  useEffect(() => {
    if (isEmergency) setShowEmergency(true)
  }, [isEmergency])

  const levels = faecalLevelsFor(pet?.species).map((text) => text.replace(/\s*\(emergency\)\s*/g, ' ').trim())
  const isUnsure = stool === 'unsure' && faecal == null
  const isNone = stool === 'none'

  return (
    <div className="assessment-page">
      <SectionTitle>Faecal Score</SectionTitle>
      <IconLabelHeader icon={icon} label="Stool" />
      <p><PetText template="Which best describes {name}'s stools lately?" pet={pet} /></p>
      <p className="assessment-hint">Scores of 2 to 3 are ideal.</p>

      <SeverityOptionList
        levels={levels}
        value={faecal ?? null}
        onChange={onScore}
        scores={FAECAL_SCORES}
        bandLabels={FAECAL_BAND_LABELS}
        colorForIndex={faecalColourForIndex}
      />

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

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import ScoreSlider from '../../components/ScoreSlider'
import SymptomChips from '../../components/SymptomChips'
import Modal from '../../components/Modal'
import Btn from '../../components/Btn'
import { fillPetText } from '../../lib/petText'

// `emergency` is optional and shaped { chips, title, warning, advice }. Only
// Stool passes it; Hygiene renders exactly as before.
//
// The alert fires on the transition into the emergency state rather than on
// every render, so dismissing it does not immediately re-open it while the
// chip stays ticked — the same behaviour as the urinary blockage alert, which
// is the only other place in the assessment that interrupts an owner.
export default function SliderWithChipsPage({
  title,
  description,
  sliderValue,
  onSliderChange,
  chipOptions,
  chipValue,
  onChipChange,
  icon,
  scaleLabels,
  extraOption,
  emergency = null,
  pet = null,
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

  return (
    <div className="assessment-page">
      <SectionTitle>{title}</SectionTitle>
      {description && <p className="assessment-hint">{description}</p>}
      <ScoreSlider label={title} value={sliderValue} onChange={onSliderChange} icon={icon} scaleLabels={scaleLabels} extraOption={extraOption} />
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

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (isEmergency) setShowEmergency(true)
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
            I understand
          </Btn>
        </Modal>
      )}
    </div>
  )
}

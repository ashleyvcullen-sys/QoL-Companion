import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import SymptomChips from '../../components/SymptomChips'
import Modal from '../../components/Modal'
import Btn from '../../components/Btn'
import { URINATION_STATUS_OPTIONS, URINATION_SYMPTOM_OPTIONS } from '../../lib/assessmentOptions'

const BLOCKAGE_RISK_SYMPTOMS = ['Straining', 'Not urinating at all']

export default function UrinationPage({ value, onChange, icon, species, sex }) {
  const { status, symptoms } = value
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)

  const isMaleCat = species === 'cat' && sex === 'male'
  const isEmergency = isMaleCat && status === 'abnormal' &&
    symptoms.some((s) => BLOCKAGE_RISK_SYMPTOMS.includes(s))

  useEffect(() => {
    if (isEmergency) setShowEmergencyModal(true)
  }, [isEmergency])

  function update(patch) {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="assessment-page">
      <SectionTitle>Urination</SectionTitle>
      <IconLabelHeader icon={icon} label="Urination" />
      <p>How has your pet's urination been?</p>
      <ChoiceButtons
        options={URINATION_STATUS_OPTIONS}
        value={status}
        onChange={(v) => update({ status: v })}
      />

      {status === 'abnormal' && (
        <SymptomChips
          options={URINATION_SYMPTOM_OPTIONS}
          selected={symptoms}
          onChange={(v) => update({ symptoms: v })}
        />
      )}

      {showEmergencyModal && (
        <Modal title="This could be an emergency" onClose={() => setShowEmergencyModal(false)}>
          <div className="warning-banner">
            <AlertTriangle size={20} />
            <p>
              Straining to urinate, or being unable to pass any urine, can be a sign of a
              urinary blockage in male cats — a genuine emergency that can become
              life-threatening within 24–48 hours if untreated.
            </p>
          </div>
          <p>
            Please contact your vet or the nearest emergency vet immediately, even if
            you're not certain.
          </p>
          <Btn type="button" variant="danger" className="btn-block" onClick={() => setShowEmergencyModal(false)}>
            I understand
          </Btn>
        </Modal>
      )}
    </div>
  )
}

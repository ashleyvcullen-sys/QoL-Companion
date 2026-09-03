import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import SymptomChips from '../../components/SymptomChips'
import PetText from '../../components/PetText'
import Modal from '../../components/Modal'
import Btn from '../../components/Btn'
import { URINATION_STATUS_OPTIONS, URINATION_SYMPTOM_OPTIONS } from '../../lib/assessmentOptions'

// What raises the blockage alert. Ash's instruction 3 Sep 2026 added
// vocalising, which is often the first thing an owner notices — a cat calling
// out in the tray — and is easily read as constipation or distress rather
// than as an obstruction.
const BLOCKAGE_RISK_SYMPTOMS = ['Straining', 'Not urinating at all', 'Vocalisation']

export default function UrinationPage({ value, onChange, icon, species, pet }) {
  const { status, symptoms } = value
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)

  // Every cat, not only males, on Ash's instruction 3 Sep 2026. Male cats
  // block far more often, which is why the alert started there — but a female
  // cat straining and passing nothing is still an obstruction until a vet says
  // otherwise, and the owner of one was getting no warning at all.
  //
  // `sex` is no longer destructured. The caller still passes it; nothing here
  // reads it any more.
  const isCat = species === 'cat'
  const isEmergency = isCat && status === 'abnormal' &&
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
      <p><PetText template="How has {name}'s urination been?" pet={pet} /></p>
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
            {/* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Her wording,
                quoted back verbatim in her approval. */}
            <p>
              Straining to urinate, crying out while trying, or being unable to pass any
              urine can be a sign of a urinary blockage — most often in male cats, but
              possible in any cat. It is a genuine emergency that can become
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

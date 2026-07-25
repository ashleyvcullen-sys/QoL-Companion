import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import SymptomChips from '../../components/SymptomChips'
import { URINATION_STATUS_OPTIONS, URINATION_SYMPTOM_OPTIONS } from '../../lib/assessmentOptions'

export default function UrinationPage({ value, onChange, icon }) {
  const { status, symptoms } = value

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
    </div>
  )
}

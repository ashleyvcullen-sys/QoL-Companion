import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import { WATER_INTAKE_OPTIONS } from '../../lib/assessmentOptions'

export default function DrinkingPage({ value, onChange, icon }) {
  return (
    <div className="assessment-page">
      <SectionTitle>Drinking</SectionTitle>
      <IconLabelHeader icon={icon} label="Drinking" />
      <p>How has your pet's water intake been?</p>
      <ChoiceButtons options={WATER_INTAKE_OPTIONS} value={value} onChange={onChange} />
    </div>
  )
}

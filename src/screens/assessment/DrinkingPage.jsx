import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import PetText from '../../components/PetText'
import { WATER_INTAKE_OPTIONS } from '../../lib/assessmentOptions'

export default function DrinkingPage({ value, onChange, icon, pet }) {
  return (
    <div className="assessment-page">
      <SectionTitle>Drinking</SectionTitle>
      <IconLabelHeader icon={icon} label="Drinking" />
      <p><PetText template="How has {name}'s water intake been?" pet={pet} /></p>
      <ChoiceButtons options={WATER_INTAKE_OPTIONS} value={value} onChange={onChange} />
    </div>
  )
}

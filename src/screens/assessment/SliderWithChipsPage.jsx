import SectionTitle from '../../components/SectionTitle'
import ScoreSlider from '../../components/ScoreSlider'
import SymptomChips from '../../components/SymptomChips'

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
}) {
  return (
    <div className="assessment-page">
      <SectionTitle>{title}</SectionTitle>
      {description && <p>{description}</p>}
      <ScoreSlider label={title} value={sliderValue} onChange={onSliderChange} icon={icon} scaleLabels={scaleLabels} />
      <SymptomChips options={chipOptions} selected={chipValue} onChange={onChipChange} />
    </div>
  )
}

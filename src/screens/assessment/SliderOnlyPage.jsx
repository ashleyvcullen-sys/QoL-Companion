import SectionTitle from '../../components/SectionTitle'
import ScoreSlider from '../../components/ScoreSlider'

export default function SliderOnlyPage({ title, description, value, onChange, icon, scaleLabels }) {
  return (
    <div className="assessment-page">
      <SectionTitle>{title}</SectionTitle>
      {description && <p>{description}</p>}
      <ScoreSlider label={title} value={value} onChange={onChange} icon={icon} scaleLabels={scaleLabels} />
    </div>
  )
}

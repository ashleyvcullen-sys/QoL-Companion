import SectionTitle from '../../components/SectionTitle'
import ScoreSlider from '../../components/ScoreSlider'

// `description` takes a string or a list of them. The list exists for Sleep,
// where the useful context is three separate thoughts — how much is normal,
// what age changes, and what actually warrants a mention — and running them
// together as one block above a slider is a paragraph nobody reads.
function Description({ description }) {
  if (!description) return null
  // The app's subtext style, the same class every explanatory line uses. As
  // plain paragraphs these sat at body size and read as the question itself
  // rather than as context for it.
  if (!Array.isArray(description)) return <p className="assessment-hint">{description}</p>
  return description.map((text, index) => (
    <p key={index} className="assessment-hint">{text}</p>
  ))
}

export default function SliderOnlyPage({ title, description, value, onChange, icon, scaleLabels }) {
  return (
    <div className="assessment-page">
      <SectionTitle>{title}</SectionTitle>
      <Description description={description} />
      <ScoreSlider label={title} value={value} onChange={onChange} icon={icon} scaleLabels={scaleLabels} />
    </div>
  )
}

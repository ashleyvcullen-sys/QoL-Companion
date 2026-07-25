import SectionTitle from '../../components/SectionTitle'
import WellbeingConcepts from '../../components/WellbeingConcepts'

export default function IntroPage() {
  return (
    <div className="assessment-page">
      <SectionTitle>Quality Of Life Assessment</SectionTitle>
      <p>
        This check-in walks through how your pet has been doing lately. It only takes a
        few minutes, and the more you can answer the more useful the trends will be — but
        "Not sure" is always a fine answer too.
      </p>

      <WellbeingConcepts />

      <p className="assessment-hint">Tap Next or swipe to begin.</p>
    </div>
  )
}

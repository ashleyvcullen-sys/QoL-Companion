import SectionTitle from '../../components/SectionTitle'
import WellbeingConcepts from '../../components/WellbeingConcepts'

export default function IntroPage({ petName, isFirstAssessment }) {
  return (
    <div className="assessment-page">
      <SectionTitle>Overall Quality of Life Assessment</SectionTitle>
      {isFirstAssessment ? (
        <p>
          Let's establish what's normal for {petName}. This first assessment becomes
          their baseline — future check-ins will be compared against it, so you can see
          what's actually changed rather than guessing.
        </p>
      ) : (
        <p>
          This check-in walks through how {petName} has been doing lately. It only takes a
          few minutes, and the more you can answer the more useful the trends will be — but
          "Not sure" is always a fine answer too.
        </p>
      )}

      <WellbeingConcepts />

      <p className="assessment-hint">Tap Next or swipe to begin.</p>
    </div>
  )
}

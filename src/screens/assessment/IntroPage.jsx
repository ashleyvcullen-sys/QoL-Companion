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
          This assessment walks through how {petName} has been lately. Answer what you can — but
          "Not sure" is always a fine answer too.
        </p>
      )}

      <WellbeingConcepts />

      {/* The last thing on the page, and centred: it is an instruction to
          the reader rather than more information, and left-aligned under a
          block of prose it read as another paragraph of it. */}
      <p className="assessment-hint assessment-begin-hint">Tap Next or swipe to begin.</p>
    </div>
  )
}

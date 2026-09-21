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
        /* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026, the join included.
           The instruction is hers; the "Not sure" clause stays after it
           rather than replacing it, because an owner told to be accurate and
           given no way out is an owner who guesses.
           The clause is not softening, either: null genuinely means
           unanswered all the way through the scoring, and every concern
           threshold explicitly declines to flag on it. */
        <p>
          This assessment walks through how {petName} has been lately. Try to answer as
          honestly and accurately as possible — but "Not sure" is always a fine answer too.
        </p>
      )}

      <WellbeingConcepts />

      {/* The last thing on the page, and centred: it is an instruction to
          the reader rather than more information, and left-aligned under a
          block of prose it read as another paragraph of it. */}
      <p className="assessment-hint assessment-begin-hint">Tap Next or swipe to begin.</p>

      {/* APPROVED — Dr Ash Cullen (BSc, DVM), 13 Sep 2026. Instrument credits are no longer
          repeated at the foot of each screen — they live in one place, the
          Legal & Privacy screen and the Terms, both built from
          lib/references.js. Nothing was removed from the app, only from here. */}
    </div>
  )
}

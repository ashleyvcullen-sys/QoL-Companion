import SectionTitle from '../../components/SectionTitle'
import WellbeingConcepts from '../../components/WellbeingConcepts'

export default function IntroPage({ petName, isFirstAssessment, onStartFromLast, startedFromLast }) {
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

      {/* Quick log — Ash's instruction 23 Sep 2026.

          Seventeen questions every day is a lot on a good day, and the days
          it is hardest to face are exactly the days worth recording. This
          fills the answers in with last time's, and then changes nothing
          else: every page is still walked through, every answer is still the
          owner's to confirm or change, and nothing is saved until the end.
          It is a starting point, not a shortcut past looking.

          Notes are deliberately NOT carried over — a note is about a
          particular day, and yesterday's sentence on today's entry would be
          a record of something that did not happen.

          APPROVED — Dr Ash Cullen (BSc, DVM), 23 Sep 2026. The button and the line that replaces it. */}
      {onStartFromLast && !isFirstAssessment && (
        startedFromLast ? (
          <p className="assessment-hint assessment-prefilled">
            Filled in with last time's answers. Change anything that is different today.
          </p>
        ) : (
          <button type="button" className="subtle-link assessment-prefill-link" onClick={onStartFromLast}>
            Start from last time's answers
          </button>
        )
      )}

      {/* The last thing on the page, and centred: it is an instruction to
          the reader rather than more information, and left-aligned under a
          block of prose it read as another paragraph of it. */}
      {/* "Tap Next or swipe to begin" until 24 Sep 2026 — there is no Next
          button any more, so the swipe is the whole instruction. Ash's
          wording. */}
      <p className="assessment-hint assessment-begin-hint">Swipe to begin.</p>

      {/* APPROVED — Dr Ash Cullen (BSc, DVM), 13 Sep 2026. Instrument credits are no longer
          repeated at the foot of each screen — they live in one place, the
          Legal & Privacy screen and the Terms, both built from
          lib/references.js. Nothing was removed from the app, only from here. */}
    </div>
  )
}

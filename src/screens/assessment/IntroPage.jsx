import SectionTitle from '../../components/SectionTitle'
import WellbeingConcepts from '../../components/WellbeingConcepts'
import { assessmentReferences } from '../../lib/references'

export default function IntroPage({ petName, species, isFirstAssessment }) {
  // Species-filtered: the Feline Grimace Scale is not used on a dog, and
  // crediting an instrument the owner will never be shown is noise dressed
  // up as rigour. assessmentReferences() has always existed for this and had
  // no caller — the credits were moved to Legal & Privacy and never came
  // back, leaving the function orphaned and its comment describing behaviour
  // the app did not have.
  const references = assessmentReferences(species)
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

      {/* Where the instrument is used, not only on the legal page. The exact
          wording comes from lib/references.js so this line and the legal
          attribution are two views of one record — and so neither can claim
          the app IS an instrument it adapts. */}
      {references.map((reference) => (
        <p key={reference.key} className="source-note">{reference.short}</p>
      ))}
    </div>
  )
}

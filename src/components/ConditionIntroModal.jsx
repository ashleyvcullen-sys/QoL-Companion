import IntroModal from './IntroModal'

// What a condition covers, asked before its screen opens.
//
// Ash's instruction 24 Sep 2026, and the same pattern as the More screen:
// the title and the sentence that used to open the destination, with the
// choice to go on or back. It appears from both places a condition can be
// tapped — the home card's rows and the Disease-Specific Monitoring list —
// so the answer to "what is this one?" arrives before the form does rather
// than at the top of it.
//
// The summary is the condition's own, moved off its screen. Said once, where
// the choice is made.
export default function ConditionIntroModal({ definition, pet, onClose, onProceed }) {
  if (!definition) return null

  // The pop-up itself is IntroModal, shared with Assess and More — this
  // knows only which of a condition's fields fill it.
  return (
    <IntroModal
      title={definition.label}
      body={definition.summary}
      pet={pet}
      onBack={onClose}
      onNext={onProceed}
    />
  )
}

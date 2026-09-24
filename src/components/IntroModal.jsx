import Modal from './Modal'
import Btn from './Btn'
import PetText from './PetText'

// "Here is what this screen is, do you want it?" — the one pop-up that stands
// between a list of choices and the screen a choice opens.
//
// Written out three times until 24 Sep 2026: on Assess, on More, and in
// ConditionIntroModal. All three were the destination's own title, the
// sentence that used to open it, and Back / Next — so a change to the pattern
// meant the same edit in three places, and the three had already drifted
// (only one of them filled the pet's name into its sentence).
//
// `body` may carry {name}, {they} and {their}; PetText fills them, and leaves
// a sentence with none of them exactly as it is.
//
// "Back" and "Next" — APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. Back
// sits on the left, where back always is; Next is the affirmative, on the
// right.
export default function IntroModal({ title, body, pet, onBack, onNext }) {
  return (
    <Modal title={title} onClose={onBack}>
      {body && <p><PetText template={body} pet={pet} /></p>}
      <div className="modal-actions">
        <Btn type="button" variant="outline" onClick={onBack}>Back</Btn>
        <Btn type="button" onClick={onNext}>Next</Btn>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { Info } from 'lucide-react'
import Btn from './Btn'
import Modal from './Modal'
import PetText from './PetText'
import { fillPetText } from '../lib/petText'

// A named button that opens what it names.
//
// Lived inside ConditionParameter until 3 Sep 2026 and served one caller: the
// "How to Measure RRR" style guide attached to a question. It moved here when
// Ash asked for the condition-level background ("Signs of allergies") to be
// centred and to match that format — two call sites wanting the identical
// control, which is one component rather than two that drift.
//
// Steps or prose, not both. A measuring guide is an ordered list because the
// order is the instruction; background about a condition is a paragraph, and
// numbering it would invent a sequence that is not there.
export default function HowTo({ title, steps = null, body = null, footer, pet, centred = false }) {
  const [open, setOpen] = useState(false)
  // Templated, like the content below it. This rendered raw until 29 Aug 2026,
  // so the kidney guide's title printed "Measuring What {name} Drinks" with
  // the braces showing.
  const heading = fillPetText(title ?? 'How to Measure This', pet)

  return (
    <>
      <Btn
        type="button"
        variant="outline"
        className={`how-to-button ${centred ? 'centred' : ''}`.trim()}
        onClick={() => setOpen(true)}
      >
        <Info size={15} /> {heading}
      </Btn>
      {open && (
        <Modal title={heading} onClose={() => setOpen(false)}>
          {steps && (
            <ol className="how-to-steps">
              {steps.map((step, i) => (
                <li key={i}><PetText template={step} pet={pet} /></li>
              ))}
            </ol>
          )}
          {body && (
            <p className="assessment-hint"><PetText template={body} pet={pet} /></p>
          )}
          {footer && (
            <p className="how-to-footer"><PetText template={footer} pet={pet} /></p>
          )}
          <Btn type="button" className="btn-block" onClick={() => setOpen(false)}>Got it</Btn>
        </Modal>
      )}
    </>
  )
}

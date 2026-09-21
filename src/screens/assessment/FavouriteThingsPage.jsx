import { useState } from 'react'
import { Heart } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import IconLabelHeader from '../../components/IconLabelHeader'
import ChoiceButtons from '../../components/ChoiceButtons'
import PetText from '../../components/PetText'
import Btn from '../../components/Btn'
import { fillPetText } from '../../lib/petText'
import {
  FAVOURITE_THING_OPTIONS,
  FAVOURITE_THINGS_MAX,
  FAVOURITE_THINGS_PLACEHOLDERS,
} from '../../lib/assessmentOptions'

// Up to three things the pet loves doing, named once by the owner and then
// checked at every assessment.
//
// A loss of interest in favourite activities is often one of the first
// things an owner can see changing, well before anything on a clinical scale
// moves — and because the owner chose the activities, the question is about
// THIS animal rather than a generic one.
//
// `value` is today's answers: [{ thing, answer }]. `savedThings` is the list
// stored on the pet. The first time (nothing saved, nothing answered) the
// page asks for the list; after that it shows the list with an answer row
// under each, and a link to change them.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Every owner-facing string on this page.
export default function FavouriteThingsPage({ value, savedThings, onChange, pet }) {
  const current = Array.isArray(value) && value.length > 0
    ? value
    : (savedThings ?? []).filter(Boolean).map((thing) => ({ thing, answer: null }))

  const [editing, setEditing] = useState(current.length === 0)
  const [drafts, setDrafts] = useState(() => padded(current.map((item) => item.thing)))

  const placeholders = FAVOURITE_THINGS_PLACEHOLDERS[pet?.species] ?? FAVOURITE_THINGS_PLACEHOLDERS.dog
  const typed = drafts.map((text) => text.trim()).filter(Boolean)

  function saveList() {
    // Answers already given survive a rename of a different item, and a
    // reorder, because they are matched on the words rather than position.
    const byThing = new Map(current.map((item) => [item.thing, item.answer]))
    onChange(typed.map((thing) => ({ thing, answer: byThing.get(thing) ?? null })))
    setEditing(false)
  }

  function setAnswer(index, answer) {
    onChange(current.map((item, i) => (i === index ? { ...item, answer } : item)))
  }

  return (
    <div className="assessment-page">
      <SectionTitle>Favourite Things</SectionTitle>
      <IconLabelHeader icon={Heart} label="Favourite Things" />

      {/* On both views, set-up and answering: it is the reason the page
          exists, and the owner meets it every time rather than once. */}
      <p className="assessment-hint">
        <PetText
          template="Every pet is different. Joy and a good quality of life can look quite different from one animal to the next, shaped by {their} own personality and the things {they} {have} always loved doing. This section helps you keep track of whether {name} is still enjoying the things {they} usually {do}."
          pet={pet}
        />
      </p>

      {editing ? (
        <>
          <p>
            <PetText template="What are three things {name} loves to do?" pet={pet} />
          </p>
          <p className="assessment-hint">
            Everyday things are best. Losing interest in a favourite activity is often one of
            the first signs that quality of life is changing.
          </p>
          {drafts.map((text, index) => (
            <div className="field" key={index}>
              <label htmlFor={`favourite-${index}`}>{index + 1}.</label>
              <input
                id={`favourite-${index}`}
                type="text"
                value={text}
                maxLength={80}
                placeholder={placeholders[index]}
                onChange={(e) => setDrafts(drafts.map((d, i) => (i === index ? e.target.value : d)))}
              />
            </div>
          ))}
          <Btn type="button" className="btn-block" disabled={typed.length === 0} onClick={saveList}>
            Save These
          </Btn>
          <p className="assessment-hint">
            You can skip this for now and add them at your next assessment.
          </p>
        </>
      ) : (
        <>
          <p>
            <PetText template="Has {name} been enjoying these lately?" pet={pet} />
          </p>
          {current.map((item, index) => (
            <div className="favourite-thing" key={item.thing}>
              <p className="favourite-thing-name"><strong>{item.thing}</strong></p>
              <ChoiceButtons
                options={FAVOURITE_THING_OPTIONS}
                value={item.answer}
                onChange={(answer) => setAnswer(index, answer)}
              />
            </div>
          ))}
          <button
            type="button"
            className="subtle-link"
            onClick={() => {
              setDrafts(padded(current.map((item) => item.thing)))
              setEditing(true)
            }}
          >
            {fillPetText('Change {name}’s Favourite Things', pet)}
          </button>
        </>
      )}
    </div>
  )
}

function padded(list) {
  const out = list.slice(0, FAVOURITE_THINGS_MAX)
  while (out.length < FAVOURITE_THINGS_MAX) out.push('')
  return out
}

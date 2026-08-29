import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Camera, Info } from 'lucide-react'
import Btn from './Btn'
import ChoiceButtons from './ChoiceButtons'
import Modal from './Modal'
import ExpandableNote from './ExpandableNote'
import PetText from './PetText'
import VomitingPage from '../screens/assessment/VomitingPage'
import SeverityOptionList from './SeverityOptionList'
import {
  NOT_APPLICABLE,
  SEVERITY,
  UNSURE,
  WHY_LABEL,
  textForSpecies,
  VCOG_GRADE_LABELS,
  VCOG_SCORES,
  evaluateParameter,
  levelsFor,
  vcogColourForIndex,
} from '../lib/conditions'
import { fillPetText } from '../lib/petText'

const UNSURE_OPTION = { value: UNSURE, label: 'Not sure' }

// The shape VomitingPage expects. A condition form that has never been
// answered has no value at all, and the page destructures its own props.
const EMPTY_VOMITING = { hasVomited: null, frequency: '', unit: 'times/day', character: [] }

// A button opening a dialog rather than an inline expander. The instructions
// matter enormously the first few times and are noise thereafter, and an
// expander pushes every question below it down the screen when opened — which
// is exactly when the owner is trying to read it and count at the same time.
function HowTo({ title, steps, footer, pet }) {
  const [open, setOpen] = useState(false)
  // Templated, like the steps below it. This rendered raw until 29 Aug 2026,
  // so the kidney guide's title printed "Measuring What {name} Drinks" with
  // the braces showing. It went unnoticed because the only other howToTitle
  // in the app has no token in it.
  const heading = fillPetText(title ?? 'How to Measure This', pet)

  return (
    <>
      <Btn type="button" variant="outline" className="how-to-button" onClick={() => setOpen(true)}>
        <Info size={15} /> {heading}
      </Btn>
      {open && (
        <Modal title={heading} onClose={() => setOpen(false)}>
          <ol className="how-to-steps">
            {steps.map((step, i) => (
              <li key={i}><PetText template={step} pet={pet} /></li>
            ))}
          </ol>
          {footer && (
            <p className="how-to-footer"><PetText template={footer} pet={pet} /></p>
          )}
          <Btn type="button" className="btn-block" onClick={() => setOpen(false)}>Got it</Btn>
        </Modal>
      )}
    </>
  )
}

// The alert shown when an answer flags.
//
// Through PetText, like every other owner-facing string. This rendered the
// message raw until now, which meant an alert could not use the pet's name —
// a {name} token would have printed as literal braces. No existing message
// used one, so nothing was visibly broken; it just quietly ruled out the
// naming convention the rest of the app follows, on the sentences where
// being spoken to about YOUR animal matters most.
// Option labels through the pet's own words, like every other string on the
// screen. They were passed to ChoiceButtons raw, so an option reading "Normal
// for {name}" would have printed the braces — the same gap the alert messages
// had, in the one place an owner has to read every option to choose between
// them.
function petTextOptions(options = [], pet) {
  return options.map((option) => ({ ...option, label: fillPetText(option.label, pet) }))
}

function Verdict({ verdict, pet }) {
  if (!verdict?.message) return null
  if (verdict.severity === SEVERITY.EMERGENCY) {
    return (
      <p className="condition-emergency" role="alert">
        <AlertTriangle size={17} />
        <span><PetText template={verdict.message} pet={pet} /></span>
      </p>
    )
  }
  if (verdict.severity === SEVERITY.CONCERN) {
    return (
      <p className="condition-flag" role="status">
        <AlertTriangle size={15} />
        <span><PetText template={verdict.message} pet={pet} /></span>
      </p>
    )
  }
  return null
}

export default function ConditionParameter({
  parameter,
  values,
  pet,
  number,
  note,
  onChange,
  // Where a photo prompt should send the owner back to. Given by the
  // condition page; without it a `photo` follow-up still works, it just
  // returns them to the media screen with no way back.
  returnTo,
  returnLabel,
}) {
  const species = pet?.species

  // Every owner-facing string that has to arrive as a PLAIN STRING rather
  // than as React children — placeholders, dialog titles, option labels.
  //
  // This exists because those are exactly the ones that keep getting missed.
  // PetText is obvious at the call site: you can see the templating. A bare
  // `placeholder={parameter.placeholder}` looks completely fine and silently
  // ships braces to the owner, and that has now happened three times — alert
  // messages, choice labels, and the howTo title above. One helper, used for
  // all of them, so there is no version of this that looks correct and is not.
  //
  // Species first, then tokens: a string may be written once for both species
  // or keyed by species, and either form can contain {name}.
  //
  // Declared HERE, above its first use. It read perfectly well sitting lower
  // down next to the other derived values, and would have thrown "Cannot
  // access 'plain' before initialization" on every condition question.
  const plain = (value) => fillPetText(textForSpecies(value, species), pet)
  const value = values[parameter.key] ?? ''
  const verdict = evaluateParameter(parameter, value, species)
  const isUnsure = value === UNSURE
  const isNotApplicable = value === NOT_APPLICABLE
  // Both sentinels blank the input, but they mean different things and are
  // stored differently — see NOT_APPLICABLE in conditions.js.
  const isBlanked = isUnsure || isNotApplicable
  const naOption = parameter.notApplicableLabel
    ? { value: NOT_APPLICABLE, label: plain(parameter.notApplicableLabel) }
    : null

  function set(key, next) {
    onChange({ ...values, [key]: next })
  }

  // Option text goes through the same templating as `why` and the labels, so
  // a level reading "{they} {are} still eating" renders as "she is still
  // eating" rather than showing the braces. Done here rather than inside
  // SeverityOptionList because that component is shared with BCS, which has
  // no pet-specific wording and no pet to hand.
  const optionTexts = levelsFor(parameter, species).map((text) => fillPetText(text, pet))

  const followUp = parameter.followUp
  // `when` matches one exact answer, which is right for yes/no and choice.
  // A graded scale needs a threshold instead — "tell us where" should appear
  // for every score at or above the concerning level, not only for one of
  // them. UNSURE and blank both fail the comparison, which is what we want.
  const followUpVisible = Boolean(
    followUp &&
      (followUp.whenAtLeast != null
        ? value !== '' && value !== UNSURE && Number(value) >= followUp.whenAtLeast
        : value === followUp.when),
  )
  const followUpValue = followUp ? (values[followUp.key] ?? '') : ''

  return (
    <div className="condition-parameter">
      <span className="condition-parameter-label">
        {number != null && <span className="condition-parameter-number">{number}.</span>}
        {/* Templated like the follow-up label already was. Without this a
            label reading "How lame is {name}?" renders the braces literally,
            which is the kind of thing that only shows up on a real pet. */}
        <span>{fillPetText(parameter.label, pet)}</span>
      </span>
      {/* Folded away behind a button rather than printed under every
          question. Eleven questions with a paragraph each turns a form into
          an essay, and the owner filling it in for the thirtieth time is
          scrolling past all of it to reach the answers.

          Never the standing alert below, which is the opposite case: that one
          has to be read before the question is answered, so it is not
          something an owner can choose not to open.

          Through textForSpecies: a subtext may be written once for both
          species, or keyed by species where part of it is only true for one —
          "chews" belongs in a dog's list of things that break a diet trial and
          not in a cat's. */}
      {textForSpecies(parameter.why, species) && (
        <ExpandableNote label={fillPetText(parameter.whyLabel ?? WHY_LABEL, pet)}>
          <p className="assessment-hint">
            <PetText template={textForSpecies(parameter.why, species)} pet={pet} />
          </p>
        </ExpandableNote>
      )}

      {/* A standing alert, shown whatever the answer — unlike every other
          alert in the app, which appears in response to one.
          
          It exists for the case where the DANGER IS IN THE QUESTION rather
          than in any of its answers: straining to urinate looks exactly like
          straining to pass stool, and an owner who reads this question as
          being about constipation will answer it accurately and still miss a
          blocked cat. Nothing they could pick would raise it, so it cannot
          wait for an answer. */}
      {textForSpecies(parameter.standingAlert, species) && (
        <p className="condition-emergency" role="alert">
          <AlertTriangle size={17} />
          <span>
            <PetText template={textForSpecies(parameter.standingAlert, species)} pet={pet} />
          </span>
        </p>
      )}
      {/* Below `why`, not above it: the explanation of what the question means
          comes first, and where this particular answer came from second. */}
      {note && <p className="assessment-hint">{note}</p>}
      {parameter.howTo && (
        <HowTo
          title={parameter.howToTitle}
          steps={parameter.howTo}
          footer={parameter.howToFooter}
          pet={pet}
        />
      )}

      {parameter.type === 'number' && (
        <>
          <div className="input-with-unit">
            <input
              type="number"
              inputMode="decimal"
              min={parameter.min}
              max={parameter.max}
              step={parameter.step ?? 1}
              value={isBlanked ? '' : value}
              disabled={isBlanked}
              placeholder={
                isNotApplicable
                  ? plain(parameter.notApplicableLabel)
                  : isUnsure
                    ? 'Not sure'
                    : plain(parameter.placeholder ?? '')
              }
              onChange={(e) => set(parameter.key, e.target.value)}
            />
            {/* Through `plain` like everything else, even though no unit has
                ever carried a token. The point of the helper is that there is
                no render site here that looks right and is not; leaving one
                exception is how the next one gets added. */}
            {parameter.unit && <span className="input-unit">{plain(parameter.unit)}</span>}
          </div>
          <ChoiceButtons
            options={naOption ? [naOption, UNSURE_OPTION] : [UNSURE_OPTION]}
            value={isBlanked ? value : null}
            onChange={(next) => set(parameter.key, value === next ? '' : next)}
          />
        </>
      )}

      {/* The assessment's own vomiting question, rendered here. Not a copy of
          it — literally the same component, so the two forms can never drift
          into asking subtly different things. */}
      {parameter.type === 'vomiting' && (
        <VomitingPage
          value={value && typeof value === 'object' ? value : EMPTY_VOMITING}
          onChange={(next) => set(parameter.key, next)}
          species={species}
          pet={pet}
          embedded
        />
      )}

      {parameter.type === 'choice' && (
        <ChoiceButtons
          options={[...petTextOptions(parameter.options, pet), UNSURE_OPTION]}
          value={value}
          onChange={(next) => set(parameter.key, next)}
        />
      )}

      {parameter.type === 'yesno' && (
        <ChoiceButtons
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, UNSURE_OPTION]}
          value={value}
          onChange={(next) => set(parameter.key, next)}
        />
      )}

      {/* Same picker as BEAAAAPP and BCS, given the VCOG scale instead: five
          grades scored 0-4 rather than six scored 0/2/4/6/8/10, labelled
          "Grade 0".."Grade 4" and coloured on the oncology cut rather than
          the BEAAAAPP bands. The owner reads a plain description and picks
          it; what gets stored, charted and printed is the grade. */}
      {parameter.type === 'vcog' && (
        <>
          <SeverityOptionList
            levels={optionTexts}
            value={value === '' || isUnsure ? null : Number(value)}
            onChange={(next) => set(parameter.key, next)}
            scores={VCOG_SCORES}
            bandLabels={VCOG_GRADE_LABELS}
            colorForIndex={vcogColourForIndex}
          />
          <ChoiceButtons
            options={[UNSURE_OPTION]}
            value={isUnsure ? UNSURE : null}
            onChange={() => set(parameter.key, isUnsure ? '' : UNSURE)}
          />
        </>
      )}

      {(parameter.type === 'beap' || parameter.type === 'scale') && (
        <>
          <SeverityOptionList
            levels={optionTexts}
            value={isBlanked || value === '' ? null : Number(value)}
            onChange={(next) => set(parameter.key, next)}
            // Thumbnails only where the option text came from a BEAAAAPP
            // category, since that's where the photo set exists. A parameter
            // with its own wording has no matching imagery.
            species={parameter.type === 'beap' && !parameter.hideImages ? species : undefined}
            categoryKey={parameter.type === 'beap' && !parameter.hideImages ? parameter.beapKey : undefined}
          />
          {/* "Does not apply" alongside "Not sure", where the parameter
              offers it. A cat with no litter tray is not an owner who is
              unsure — it is a question that does not apply to that cat, and
              filing one as the other loses the difference. Selecting it
              clears any level already picked, and the day is scored as
              though the question were never asked. */}
          <ChoiceButtons
            options={naOption ? [naOption, UNSURE_OPTION] : [UNSURE_OPTION]}
            value={isBlanked ? value : null}
            onChange={(next) => set(parameter.key, value === next ? '' : next)}
          />
        </>
      )}

      <Verdict verdict={verdict} pet={pet} />

      {followUpVisible && (
        <div className="condition-followup">
          <span className="condition-parameter-label">
            {fillPetText(followUp.label, pet)}
          </span>

          {followUp.type === 'text' && (
            <textarea
              rows={2}
              value={followUpValue}
              placeholder={plain(followUp.placeholder)}
              onChange={(e) => set(followUp.key, e.target.value)}
            />
          )}

          {followUp.type === 'choice' && (
            <>
              <ChoiceButtons
                options={[
                  ...petTextOptions(followUp.options, pet),
                  ...(followUp.allowOther ? [{ value: 'other', label: followUp.otherLabel ?? 'Other' }] : []),
                  UNSURE_OPTION,
                ]}
                value={followUpValue}
                onChange={(next) => set(followUp.key, next)}
              />
              {/* Stored under its own key rather than overwriting the choice,
                  so "they picked Other" and "here is what they wrote" stay
                  separate facts in the record. */}
              {followUpValue === 'other' && (
                <textarea
                  rows={2}
                  value={values[`${followUp.key}_other`] ?? ''}
                  placeholder="Describe the cough in your own words"
                  onChange={(e) => set(`${followUp.key}_other`, e.target.value)}
                />
              )}
            </>
          )}

          {/* Not an input. Some answers are better shown than described — a
              worm in a stool is the case this exists for — and the app already
              has a place for photos a vet will look at. This is the way
              across, offered only once the answer that makes it useful has
              been given. */}
          {followUp.type === 'photo' && (
            <>
              {followUp.hint && (
                <p className="assessment-hint">
                  <PetText template={followUp.hint} pet={pet} />
                </p>
              )}
              <Link
                to="/media"
                state={{ returnTo, returnLabel }}
                className="subtle-link"
              >
                <Camera size={14} /> Add a photo or video
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

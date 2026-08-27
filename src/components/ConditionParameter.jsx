import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import Btn from './Btn'
import ChoiceButtons from './ChoiceButtons'
import Modal from './Modal'
import PetText from './PetText'
import SeverityOptionList from './SeverityOptionList'
import {
  NOT_APPLICABLE,
  SEVERITY,
  UNSURE,
  VCOG_GRADE_LABELS,
  VCOG_SCORES,
  evaluateParameter,
  levelsFor,
  vcogColourForIndex,
} from '../lib/conditions'
import { fillPetText } from '../lib/petText'

const UNSURE_OPTION = { value: UNSURE, label: 'Not sure' }

// A button opening a dialog rather than an inline expander. The instructions
// matter enormously the first few times and are noise thereafter, and an
// expander pushes every question below it down the screen when opened — which
// is exactly when the owner is trying to read it and count at the same time.
function HowTo({ title, steps, footer, pet }) {
  const [open, setOpen] = useState(false)
  const heading = title ?? 'How to Measure This'

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

export default function ConditionParameter({ parameter, values, pet, number, note, onChange }) {
  const species = pet?.species
  const value = values[parameter.key] ?? ''
  const verdict = evaluateParameter(parameter, value, species)
  const isUnsure = value === UNSURE
  const isNotApplicable = value === NOT_APPLICABLE
  // Both sentinels blank the input, but they mean different things and are
  // stored differently — see NOT_APPLICABLE in conditions.js.
  const isBlanked = isUnsure || isNotApplicable
  const naOption = parameter.notApplicableLabel
    ? { value: NOT_APPLICABLE, label: parameter.notApplicableLabel }
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
      {parameter.why && (
        <p className="assessment-hint"><PetText template={parameter.why} pet={pet} /></p>
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
                  ? parameter.notApplicableLabel
                  : isUnsure
                    ? 'Not sure'
                    : (parameter.placeholder ?? '')
              }
              onChange={(e) => set(parameter.key, e.target.value)}
            />
            {parameter.unit && <span className="input-unit">{parameter.unit}</span>}
          </div>
          <ChoiceButtons
            options={naOption ? [naOption, UNSURE_OPTION] : [UNSURE_OPTION]}
            value={isBlanked ? value : null}
            onChange={(next) => set(parameter.key, value === next ? '' : next)}
          />
        </>
      )}

      {parameter.type === 'choice' && (
        <ChoiceButtons
          options={[...parameter.options, UNSURE_OPTION]}
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
              placeholder={followUp.placeholder}
              onChange={(e) => set(followUp.key, e.target.value)}
            />
          )}

          {followUp.type === 'choice' && (
            <>
              <ChoiceButtons
                options={[
                  ...followUp.options,
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
        </div>
      )}
    </div>
  )
}

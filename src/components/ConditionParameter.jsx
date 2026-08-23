import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import Btn from './Btn'
import ChoiceButtons from './ChoiceButtons'
import Modal from './Modal'
import PetText from './PetText'
import SeverityOptionList from './SeverityOptionList'
import { SEVERITY, UNSURE, evaluateParameter, levelsFor } from '../lib/conditions'
import { fillPetText } from '../lib/petText'

const UNSURE_OPTION = { value: UNSURE, label: 'Not sure' }

// A button opening a dialog rather than an inline expander. The instructions
// matter enormously the first few times and are noise thereafter, and an
// expander pushes every question below it down the screen when opened — which
// is exactly when the owner is trying to read it and count at the same time.
function HowTo({ title, steps, pet }) {
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
          <Btn type="button" className="btn-block" onClick={() => setOpen(false)}>Got it</Btn>
        </Modal>
      )}
    </>
  )
}

function Verdict({ verdict }) {
  if (!verdict?.message) return null
  if (verdict.severity === SEVERITY.EMERGENCY) {
    return (
      <p className="condition-emergency" role="alert">
        <AlertTriangle size={17} />
        <span>{verdict.message}</span>
      </p>
    )
  }
  if (verdict.severity === SEVERITY.CONCERN) {
    return (
      <p className="condition-flag" role="status">
        <AlertTriangle size={15} />
        <span>{verdict.message}</span>
      </p>
    )
  }
  return null
}

export default function ConditionParameter({ parameter, values, pet, onChange }) {
  const species = pet?.species
  const value = values[parameter.key] ?? ''
  const verdict = evaluateParameter(parameter, value, species)
  const isUnsure = value === UNSURE

  function set(key, next) {
    onChange({ ...values, [key]: next })
  }

  const followUp = parameter.followUp
  const followUpVisible = followUp && value === followUp.when
  const followUpValue = followUp ? (values[followUp.key] ?? '') : ''

  return (
    <div className="condition-parameter">
      <span className="condition-parameter-label">{parameter.label}</span>
      {parameter.why && (
        <p className="assessment-hint"><PetText template={parameter.why} pet={pet} /></p>
      )}
      {parameter.howTo && (
        <HowTo title={parameter.howToTitle} steps={parameter.howTo} pet={pet} />
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
              value={isUnsure ? '' : value}
              disabled={isUnsure}
              placeholder={isUnsure ? 'Not sure' : ''}
              onChange={(e) => set(parameter.key, e.target.value)}
            />
            {parameter.unit && <span className="input-unit">{parameter.unit}</span>}
          </div>
          <ChoiceButtons
            options={[UNSURE_OPTION]}
            value={isUnsure ? UNSURE : null}
            onChange={() => set(parameter.key, isUnsure ? '' : UNSURE)}
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

      {(parameter.type === 'beap' || parameter.type === 'scale') && (
        <>
          <SeverityOptionList
            levels={levelsFor(parameter, species)}
            value={value === '' || isUnsure ? null : Number(value)}
            onChange={(next) => set(parameter.key, next)}
            // Thumbnails only where the option text came from a BEAAAAPP
            // category, since that's where the photo set exists. A parameter
            // with its own wording has no matching imagery.
            species={parameter.type === 'beap' ? species : undefined}
            categoryKey={parameter.type === 'beap' ? parameter.beapKey : undefined}
          />
          <ChoiceButtons
            options={[UNSURE_OPTION]}
            value={isUnsure ? UNSURE : null}
            onChange={() => set(parameter.key, isUnsure ? '' : UNSURE)}
          />
        </>
      )}

      <Verdict verdict={verdict} />

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

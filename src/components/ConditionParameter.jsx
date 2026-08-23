import { useState } from 'react'
import { AlertTriangle, ChevronDown, Info } from 'lucide-react'
import ChoiceButtons from './ChoiceButtons'
import SeverityOptionList from './SeverityOptionList'
import { SEVERITY, UNSURE, beapLevelsFor, evaluateParameter } from '../lib/conditions'

const UNSURE_OPTION = { value: UNSURE, label: 'Not sure' }

// Collapsed by default. The instructions matter enormously the first few
// times and are noise thereafter, so they're one tap away rather than always
// occupying the screen.
function HowTo({ title, steps }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="how-to">
      <button type="button" className="how-to-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Info size={15} />
        <span>{title ?? 'How to measure this'}</span>
        <ChevronDown size={16} className={`chart-chevron ${open ? 'open' : ''}`.trim()} />
      </button>
      {open && (
        <ol className="how-to-steps">
          {steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      )}
    </div>
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

export default function ConditionParameter({ parameter, values, species, onChange }) {
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
      {parameter.why && <p className="assessment-hint">{parameter.why}</p>}
      {parameter.howTo && <HowTo title={parameter.howToTitle} steps={parameter.howTo} />}

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

      {parameter.type === 'beap' && (
        <SeverityOptionList
          levels={beapLevelsFor(parameter, species)}
          value={value === '' || isUnsure ? null : Number(value)}
          onChange={(next) => set(parameter.key, next)}
          species={species}
          categoryKey={parameter.beapKey}
        />
      )}

      {parameter.type === 'beap' && (
        <ChoiceButtons
          options={[UNSURE_OPTION]}
          value={isUnsure ? UNSURE : null}
          onChange={() => set(parameter.key, isUnsure ? '' : UNSURE)}
        />
      )}

      <Verdict verdict={verdict} />

      {followUpVisible && (
        <div className="condition-followup">
          <span className="condition-parameter-label">{followUp.label}</span>

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

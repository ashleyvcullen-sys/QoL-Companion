import { useEffect } from 'react'
import SectionTitle from '../../components/SectionTitle'
import { FELINE_GRIMACE_ACTION_UNITS } from '../../lib/felineGrimaceScale'
import { BEAP_BANDS, bandColorForIndex, beapBandIndexForScore } from '../../lib/scoring'

export default function FelineGrimacePage({ answers, onAnswerChange, onTotalChange }) {
  const values = Object.values(answers)
  const allAnswered = values.every((v) => v !== null)
  // Live running total as each action unit is answered (unanswered ones
  // contribute 0) — becomes the real, save-eligible score only once all 5
  // are in, matching how every other BEAAAAPP category starts at null and
  // only becomes a definite value once answered.
  const runningTotal = values.reduce((sum, v) => sum + (v ?? 0), 0)
  const finalTotal = allAnswered ? runningTotal : null

  useEffect(() => {
    onTotalChange(finalTotal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalTotal])

  const bandIndex = beapBandIndexForScore(runningTotal)
  const band = BEAP_BANDS[bandIndex]

  return (
    <div className="assessment-page">
      <SectionTitle>Eyes / Face</SectionTitle>
      <p className="beap-citation">
        Based on the Feline Grimace Scale (Evangelista et al., Scientific Reports, 2019,
        Université de Montréal).
      </p>

      {FELINE_GRIMACE_ACTION_UNITS.map((unit) => {
        // Defaults to the "0" photo before an answer is picked, rather than
        // showing no image — avoids a layout jump/empty gap next to a
        // question the user hasn't reached yet.
        const selectedValue = answers[unit.key] ?? 0

        return (
          <div key={unit.key} className="grimace-action-unit">
            <div className="grimace-action-unit-header">
              <p className="grimace-action-unit-label">{unit.label}</p>
              <img
                src={`/images/fgs/${unit.imagePrefix}_${selectedValue}.jpg`}
                alt=""
                className="grimace-action-unit-thumb"
              />
            </div>
            <div className="severity-option-list">
              {unit.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`severity-option ${answers[unit.key] === option.value ? 'selected' : ''}`.trim()}
                  onClick={() => onAnswerChange(unit.key, option.value)}
                >
                  <span className="severity-option-content">
                    <span>{option.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <div className="grimace-total">
        <span className="grimace-total-value">{runningTotal} / 10</span>
        <span className="grimace-total-label" style={{ color: bandColorForIndex(bandIndex) }}>
          {band.label}
        </span>
      </div>
    </div>
  )
}

import SectionTitle from '../../components/SectionTitle'
import { computeGeneralQolResult, computeBeapWorst, beapSeverityLabel } from '../../lib/scoring'

export default function ReviewPage({ entry, onNotesChange, onBeapNotesChange, errorMessage }) {
  const generalResult = computeGeneralQolResult(entry)
  const beapValues = Object.values(entry.beap)
  const hasAllBeapAnswers = beapValues.every((v) => v !== null)
  const beapWorst = hasAllBeapAnswers ? computeBeapWorst(entry.beap) : null

  return (
    <div className="assessment-page">
      <SectionTitle>Review</SectionTitle>

      <div className="review-summary">
        <div className="review-summary-row">
          <span>General QoL</span>
          <strong>{generalResult.percent}% — {generalResult.band}</strong>
        </div>
        <div className="review-summary-row">
          <span>Pain (BEAAAAPP)</span>
          <strong>{hasAllBeapAnswers ? beapSeverityLabel(beapWorst) : 'Incomplete'}</strong>
        </div>
      </div>

      <div className="field">
        <label htmlFor="general-notes">Anything else about today?</label>
        <textarea
          id="general-notes"
          value={entry.notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
        />
      </div>

      <div className="field">
        <label htmlFor="pain-notes">Any notes about pain or mobility?</label>
        <textarea
          id="pain-notes"
          value={entry.beapNotes}
          onChange={(e) => onBeapNotesChange(e.target.value)}
          rows={3}
        />
      </div>

      {!hasAllBeapAnswers && (
        <p className="form-error" role="alert">
          Please go back and answer all 8 pain categories before saving.
        </p>
      )}

      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    </div>
  )
}

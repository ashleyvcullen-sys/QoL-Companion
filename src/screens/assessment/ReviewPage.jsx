import SectionTitle from '../../components/SectionTitle'
import { computeGeneralQolResult, describeBeapSeverityFloor, describeEmergencyFloor } from '../../lib/scoring'
import { beapCategoryDisplayName } from '../../lib/beapScales'

// "A", "A and B", "A, B and C"
function formatList(items) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export default function ReviewPage({ entry, onNotesChange, errorMessage, species }) {
  const generalResult = computeGeneralQolResult(entry, entry.beap, species)
  const beapValues = Object.values(entry.beap)
  const hasAllBeapAnswers = beapValues.every((v) => v !== null)

  // Only present when the worst single finding forced the band below what
  // the average alone would have given — otherwise a high percentage sitting
  // next to a severe band looks like a bug rather than a deliberate safety
  // override.
  const floor = describeBeapSeverityFloor(entry.beap)
  const emergencyFloor = describeEmergencyFloor(entry, species)
  const floorCategoryNames = floor
    ? floor.categories.map((key) => beapCategoryDisplayName(species, key))
    : []

  return (
    <div className="assessment-page">
      <SectionTitle>Review</SectionTitle>

      <div className="review-summary">
        <div className="review-summary-row">
          <span>General QoL</span>
          <strong>{generalResult.percent}% — {generalResult.band}</strong>
        </div>
        {floor && (
          <p className="review-summary-floor-note" style={{ color: floor.color }}>
            ⚠️ Because <strong>{formatList(floorCategoryNames)}</strong>{' '}
            {floorCategoryNames.length > 1 ? 'were' : 'was'} marked{' '}
            <strong>{floor.severityLabel}</strong>, this assessment is recorded as{' '}
            <strong>{floor.bandLabel}</strong>, regardless of the overall average.
          </p>
        )}
        {/* PENDING ASH — wording drafted to mirror the approved BEAAAAPP
            note above. */}
        {emergencyFloor && (
          <p className="review-summary-floor-note" style={{ color: emergencyFloor.color }}>
            ⚠️ Because <strong>{formatList(emergencyFloor.findings)}</strong>{' '}
            {emergencyFloor.findings.length > 1 ? 'were' : 'was'} recorded, this assessment
            is recorded as <strong>{emergencyFloor.bandLabel}</strong>, regardless of the
            overall average.
          </p>
        )}
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

      {!hasAllBeapAnswers && (
        <p className="form-error" role="alert">
          Please go back and answer all 8 pain categories before saving.
        </p>
      )}

      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    </div>
  )
}

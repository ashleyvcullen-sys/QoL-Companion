import SectionTitle from '../../components/SectionTitle'
import {
  computeGeneralQolResult,
  describeBeapSeverityFloor,
  describeDiseaseFloor,
  describeEmergencyFloor,
} from '../../lib/scoring'
import DiseaseTodayList from '../../components/DiseaseTodayList'
import { beapCategoryDisplayName } from '../../lib/beapScales'

// "A", "A and B", "A, B and C"
function formatList(items) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export default function ReviewPage({
  entry, onNotesChange, errorMessage, species, pet, diseaseEmergencies = [], diseaseToday = [],
}) {
  const generalResult = computeGeneralQolResult(entry, entry.beap, species, diseaseEmergencies)
  const beapValues = Object.values(entry.beap)
  const hasAllBeapAnswers = beapValues.every((v) => v !== null)

  // Only present when the worst single finding forced the band below what
  // the average alone would have given — otherwise a high percentage sitting
  // next to a severe band looks like a bug rather than a deliberate safety
  // override.
  // Each note is shown only when it names the band the assessment actually
  // ended up in. With black, tarry stool (Moderately reduced) and a Severe
  // pain answer (Severely reduced) together, the stool note would otherwise
  // say "capped at 74%" beside a 49% score.
  const bandSetBy = (note) => (note && note.bandLabel === generalResult.band ? note : null)
  const floor = bandSetBy(describeBeapSeverityFloor(entry.beap))
  const emergencyFloor = bandSetBy(describeEmergencyFloor(entry, species))
  const diseaseFloor = bandSetBy(describeDiseaseFloor(diseaseEmergencies))
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
            <strong>{floor.bandLabel}</strong> and its score is capped at {floor.ceiling}%.
          </p>
        )}
        {/* APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Both notes. The BEAAAAPP one above was approved
            ending "regardless of the overall average"; since 21 Sep 2026 the
            percentage is capped too, so both now say so. */}
        {emergencyFloor && (
          <p className="review-summary-floor-note" style={{ color: emergencyFloor.color }}>
            ⚠️ Because <strong>{formatList(emergencyFloor.findings)}</strong>{' '}
            {emergencyFloor.findings.length > 1 ? 'were' : 'was'} recorded, this assessment
            is recorded as <strong>{emergencyFloor.bandLabel}</strong> and its score is
            capped at {emergencyFloor.ceiling}%.
          </p>
        )}
        {/* APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. */}
        {diseaseFloor && (
          <p className="review-summary-floor-note" style={{ color: diseaseFloor.color }}>
            ⚠️ Because <strong>{formatList(diseaseFloor.conditions)}</strong> monitoring
            recorded an urgent finding today, this assessment is recorded as{' '}
            <strong>{diseaseFloor.bandLabel}</strong> and its score is capped at {diseaseFloor.ceiling}%.
          </p>
        )}
        <DiseaseTodayList days={diseaseToday} pet={pet} />
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

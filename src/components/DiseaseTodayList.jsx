import { SEVERITY_COLOURS, SEVERITY_LABELS } from '../lib/conditions'
import { fillPetText } from '../lib/petText'

// Each tracked condition's status on one day, beside the Overall QoL result,
// so the two are read together. A red day here is also what floored the
// band — see lib/diseaseDays.js.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026.
export default function DiseaseTodayList({ days, pet, title = 'Disease Monitoring Today' }) {
  if (!days?.length) return null
  return (
    <div className="disease-today">
      <p className="disease-today-title"><strong>{title}</strong></p>
      {days.map((day) => {
        const top = day.flagged?.[0]?.label
        return (
          <div className="review-summary-row" key={day.conditionKey}>
            <span>{day.conditionLabel}</span>
            <strong style={{ color: SEVERITY_COLOURS[day.severity] }}>
              {SEVERITY_LABELS[day.severity]}
              {top ? ` — ${fillPetText(top, pet)}` : ''}
            </strong>
          </div>
        )
      })}
    </div>
  )
}

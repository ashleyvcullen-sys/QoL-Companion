import { SEVERITY_COLOURS, SEVERITY_LABELS } from '../lib/conditions'

function formatShort(dateStr) {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

// A cell per logged day, coloured by that day's worst finding. Chosen over a
// month calendar because condition monitoring is often daily for a stretch
// and then not at all — a calendar would be mostly empty squares, where this
// shows the run of readings that actually exist.
export default function ConditionStatusTimeline({ days }) {
  if (days.length === 0) return <p>No entries logged yet.</p>

  // Newest last, so the eye ends on today.
  const recent = days.slice(-60)

  return (
    <>
      <div className="status-timeline">
        {recent.map((day) => (
          <span
            key={day.date}
            className="status-cell"
            style={{ background: day.severity ? SEVERITY_COLOURS[day.severity] : 'var(--border)' }}
            title={`${formatShort(day.date)} — ${day.severity ? SEVERITY_LABELS[day.severity] : 'Nothing recorded'}${day.flags ? ` (${day.flags} flagged)` : ''}`}
          />
        ))}
      </div>

      <div className="status-legend">
        {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
          <span key={key} className="status-legend-item">
            <span className="status-swatch" style={{ background: SEVERITY_COLOURS[key] }} />
            {label}
          </span>
        ))}
      </div>

      <p className="assessment-hint">
        Each block is a day you recorded. Colour follows the single worst finding that day —
        one serious answer colours the whole day, rather than being averaged away by the others.
      </p>
    </>
  )
}

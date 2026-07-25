import { computeGeneralQolResult, severityColorFromPercent } from '../../lib/scoring'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function TrendsCalendar({ generalEntries }) {
  const percentByDate = new Map(
    generalEntries.map((entry) => [entry.date, computeGeneralQolResult(entry).percent])
  )

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthLabel = today.toLocaleString('default', { month: 'long', year: 'numeric' })

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function dateKeyFor(day) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  return (
    <div className="calendar">
      <div className="calendar-month-label">{monthLabel}</div>
      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={`weekday-${i}`} className="calendar-weekday">{label}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="calendar-cell calendar-cell-empty" />
          }
          const percent = percentByDate.get(dateKeyFor(day))
          const color = percent != null ? severityColorFromPercent(percent) : null
          return (
            <div
              key={day}
              className="calendar-cell"
              style={{
                background: color ?? '#E5DEE1',
                color: color ? '#fff' : 'var(--text-h)',
              }}
              title={percent != null ? `${percent}%` : 'No assessment'}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

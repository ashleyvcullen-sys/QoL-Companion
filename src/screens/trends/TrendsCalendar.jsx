import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { computeGeneralQolResult } from '../../lib/scoring'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function TrendsCalendar({ generalEntries, painEntries = [] }) {
  // BEAAAAPP now feeds the overall score too, so each day's general entry
  // is paired with that same day's pain entry (if one exists).
  const beapByDate = new Map(painEntries.map((entry) => [entry.date, entry.beap]))
  // Stores each day's colour straight from the result rather than deriving
  // it from the percentage again — otherwise a day floored to Severe by a
  // single emergency finding would still be painted green by its (high)
  // average.
  const resultByDate = new Map(
    generalEntries.map((entry) => [
      entry.date,
      computeGeneralQolResult(entry, beapByDate.get(entry.date)),
    ])
  )

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function dateKeyFor(day) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${viewYear}-${mm}-${dd}`
  }

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (isCurrentMonth) return
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-button"
          onClick={goToPreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="calendar-month-label">{monthLabel}</div>
        <button
          type="button"
          className="calendar-nav-button"
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={`weekday-${i}`} className="calendar-weekday">{label}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="calendar-cell calendar-cell-empty" />
          }
          const result = resultByDate.get(dateKeyFor(day))
          const percent = result?.percent ?? null
          // null, not a CSS string — a non-empty string is truthy, so the
          // `?? '#E5DEE1'` and dark-text fallbacks below never fired and an
          // unassessed day rendered white text on a near-white background.
          const color = result ? result.color : null
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

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// The month grid used by both the quality of life trends and the condition
// summaries. Extracted so "the same calendar format" is literally the same
// component rather than two that look alike until one is edited.
//
// The caller supplies `dayFor(dateKey)`, returning { colour, title } for a
// day with data or null for one without. Nothing about scoring lives here.
export default function MonthCalendar({ dayFor }) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  // Which day the reader has tapped. The `title` attribute below is a hover
  // tooltip, and on a phone there is no hover — so on the device this
  // calendar was built for, every one of those explanations was unreachable.
  // Tapping a day puts the same text on screen underneath.
  const [selectedDay, setSelectedDay] = useState(null)

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Whether any day on screen carries a medication mark. Only then is the
  // key worth the space — a legend explaining a symbol that is not present
  // is furniture.
  const hasMarkers = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .some((day) => dayFor(dateKeyFor(day))?.marker)

  function dateKeyFor(day) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Clearing on navigation: a detail line left over from August, sitting
  // under September, would be read as belonging to September.
  function goToPreviousMonth() {
    setSelectedDay(null)
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    setSelectedDay(null)
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
        <button type="button" className="calendar-nav-button" onClick={goToPreviousMonth} aria-label="Previous month">
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
          const info = dayFor(dateKeyFor(day))
          // null rather than a colour string for "no data": a non-empty
          // string is truthy, so the fallbacks below would never fire and an
          // unrecorded day would render white text on a near-white cell.
          const colour = info?.colour ?? null
          const title = info?.title || 'Nothing recorded'
          const isSelected = selectedDay === day

          return (
            <button
              key={day}
              type="button"
              className={`calendar-cell ${isSelected ? 'selected' : ''}`.trim()}
              style={{ background: colour ?? '#E5DEE1', color: colour ? '#fff' : 'var(--text-h)' }}
              title={title}
              aria-label={`${day} ${monthLabel}: ${title}`}
              onClick={() => setSelectedDay(isSelected ? null : day)}
            >
              {day}
              {/* A medication started or stopped on this day. Deliberately a
                  dot rather than a letter or an icon: the cell is a few
                  millimetres square with a number already in it, and anything
                  legible would cover the number. Tapping the day says what
                  it was. */}
              {info?.marker && <span className="calendar-cell-marker" />}
            </button>
          )
        })}
      </div>

      {selectedDay != null && (
        <p className="calendar-detail" role="status">
          <strong>{selectedDay} {monthLabel.split(' ')[0]}</strong>
          {' — '}
          {dayFor(dateKeyFor(selectedDay))?.title || 'Nothing recorded'}
        </p>
      )}

      {hasMarkers && (
        <p className="calendar-legend">
          <span className="calendar-legend-dot" />
          A medication started or stopped. Tap a day to see which.
        </p>
      )}
    </div>
  )
}

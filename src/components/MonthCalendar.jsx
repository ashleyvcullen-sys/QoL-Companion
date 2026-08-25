import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Pill, Stethoscope } from 'lucide-react'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// The month grid used by both the quality of life trends and the condition
// summaries. Extracted so "the same calendar format" is literally the same
// component rather than two that look alike until one is edited.
//
// The caller supplies `dayFor(dateKey)`, returning { colour, title } for a
// day with data or null for one without. Nothing about scoring lives here.
export default function MonthCalendar({ dayFor, onOpenDay }) {
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

  // Same reasoning for the note mark. Two legends where only one symbol is on
  // screen is furniture explaining something that isn't there.
  const hasNotes = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .some((day) => dayFor(dateKeyFor(day))?.note)

  const hasEvents = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .some((day) => dayFor(dateKeyFor(day))?.event)

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
              {/* A medication started or stopped on this day. A pill rather
                  than a plain dot: the cell is a few millimetres square, but
                  the shape is recognisable at that size where a letter would
                  not be, and it says what the mark MEANS without the reader
                  having to find the key first. Tapping the day gives the
                  detail. */}
              {info?.marker && (
                <span className="calendar-cell-marker">
                  <Pill size={9} strokeWidth={2.5} />
                </span>
              )}
              {/* The note mark takes the opposite corner, so a day that has
                  both a medication change and a note shows both rather than
                  one covering the other — which is exactly the day an owner
                  most wants to open. */}
              {info?.note && (
                <span className="calendar-cell-note">
                  <Pencil size={9} strokeWidth={2.5} />
                </span>
              )}
              {/* A medical event — a vet visit, an episode, a diagnosis.
                  Bottom-right, so all three marks can sit on one day without
                  overlapping: the day that has a flare, a new drug AND a note
                  about it is exactly the day worth opening. */}
              {info?.event && (
                <span className="calendar-cell-event">
                  <Stethoscope size={9} strokeWidth={2.5} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay != null && (
        <div className="calendar-detail" role="status">
          <p className="calendar-detail-text">
            <strong>{selectedDay} {monthLabel.split(' ')[0]}</strong>
            {' — '}
            {dayFor(dateKeyFor(selectedDay))?.title || 'Nothing recorded'}
          </p>
          {/* The colour and the summary line say how the day went. This is
              the way back to what was actually answered to get there, which
              until now was recorded and never shown. Offered only where the
              caller can answer it, and only on a day with something on it. */}
          {onOpenDay && dayFor(dateKeyFor(selectedDay)) && (
            <button
              type="button"
              className="subtle-link"
              onClick={() => onOpenDay(dateKeyFor(selectedDay))}
            >
              See this day's answers
            </button>
          )}
        </div>
      )}

      {hasMarkers && (
        <p className="calendar-legend">
          <Pill size={13} />
          A medication started or stopped. Tap a day to see which.
        </p>
      )}

      {hasNotes && (
        <p className="calendar-legend">
          <Pencil size={13} />
          A note was written on this day. Tap the day to read it.
        </p>
      )}

      {hasEvents && (
        <p className="calendar-legend">
          <Stethoscope size={13} />
          A medical event was recorded. Tap the day to see what.
        </p>
      )}
    </div>
  )
}

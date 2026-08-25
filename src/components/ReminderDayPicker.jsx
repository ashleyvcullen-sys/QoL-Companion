import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Sunday-first, matching MonthCalendar. Two calendars in one app that start
// the week on different days would be read as two different weeks.
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// A date beyond the 28th does not exist in every month, and a reminder set
// for one would simply not fire in the months without it — silently, and
// five times a year for the 31st. Shown on the calendar because they are
// real dates in the month being looked at, but not selectable, with the
// reason on screen rather than left for the owner to discover.
const LAST_SAFE_DATE = 28

// The reminder day picker, in two modes.
//
//   'week'  — which weekday, as a single calendar row.
//   'month' — which date, on a real month grid, so the dates line up under
//             the weekdays they actually fall on and a short month shows 28
//             or 30 days rather than a flat list of 31.
//
// It was a wrapping strip of numbered chips before this, which said nothing
// about what day of the week the 14th is, or that September has no 31st.
export default function ReminderDayPicker({
  mode = 'month',
  value = [],
  max = 1,
  onChange,
  fromIso = null,
}) {
  const now = new Date()

  // Opens on the month the course starts in, when there is one — that is the
  // month the owner is thinking about — and on this month otherwise.
  const opening = localDateFromIso(fromIso) ?? now
  const [viewYear, setViewYear] = useState(opening.getFullYear())
  const [viewMonth, setViewMonth] = useState(opening.getMonth())

  const chosen = value ?? []
  const isFull = chosen.length >= max

  function toggle(day) {
    if (chosen.includes(day)) {
      onChange(chosen.filter((entry) => entry !== day))
      return
    }
    // One-day pickers replace rather than refuse. Where only a single day is
    // ever wanted, making someone unpick Tuesday before they can pick
    // Wednesday is two taps to answer a one-tap question.
    if (max === 1) {
      onChange([day])
      return
    }
    // More than one, and the cap is a real limit rather than a mode: three
    // reminders on a medication given twice a week would be the app telling
    // an owner to give a dose that was never prescribed.
    if (isFull) return
    onChange([...chosen, day].sort((a, b) => a - b))
  }

  if (mode === 'week') {
    return (
      <div className="calendar reminder-picker">
        <div className="calendar-grid">
          {WEEKDAY_NAMES.map((name, weekday) => {
            const selected = chosen.includes(weekday)
            return (
              <button
                key={name}
                type="button"
                className={`calendar-cell reminder-cell ${selected ? 'chosen' : ''}`.trim()}
                disabled={!selected && isFull && max > 1}
                aria-pressed={selected}
                onClick={() => toggle(weekday)}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  // Nothing before this month: a reminder cannot be set in the past, and
  // being able to page back to last March only makes the picker look like it
  // is asking for a one-off date rather than a date each month.
  const atEarliestMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const cells = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function goToPreviousMonth() {
    if (atEarliestMonth) return
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // Only worth explaining when the month on screen actually has one of the
  // dates in question. February never does, and a warning about the 31st
  // under a calendar with no 31 on it is noise.
  const showsUnsafeDates = daysInMonth > LAST_SAFE_DATE

  return (
    <div className="calendar reminder-picker">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-button"
          onClick={goToPreviousMonth}
          disabled={atEarliestMonth}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="calendar-month-label">{monthLabel}</div>
        <button
          type="button"
          className="calendar-nav-button"
          onClick={goToNextMonth}
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
          const selected = chosen.includes(day)
          const unsafe = day > LAST_SAFE_DATE
          return (
            <button
              key={day}
              type="button"
              className={`calendar-cell reminder-cell ${selected ? 'chosen' : ''}`.trim()}
              disabled={unsafe || (!selected && isFull && max > 1)}
              aria-pressed={selected}
              aria-label={`${day} ${monthLabel}`}
              onClick={() => toggle(day)}
            >
              {day}
            </button>
          )
        })}
      </div>

      {showsUnsafeDates && (
        <p className="assessment-hint">
          The 29th to the 31st can't be chosen — those dates don't come round every month,
          so a reminder set for one would quietly skip the months without it.
        </p>
      )}
    </div>
  )
}

// Local midnight from 'YYYY-MM-DD'. new Date('2026-08-25') is parsed as UTC,
// which is the day before for anyone west of Greenwich — and opening the
// picker on July when the course starts in August is exactly the kind of
// quiet wrongness this component exists to remove.
function localDateFromIso(iso) {
  if (!iso) return null
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

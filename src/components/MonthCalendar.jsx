import { useState } from 'react'
import { ChevronLeft, ChevronRight, Flag, Pencil, Pill, Stethoscope } from 'lucide-react'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// The month grid used by both the quality of life trends and the condition
// summaries. Extracted so "the same calendar format" is literally the same
// component rather than two that look alike until one is edited.
//
// The caller supplies `dayFor(dateKey)`, returning { colour, title } for a
// day with data or null for one without. Nothing about scoring lives here.
export default function MonthCalendar({ dayFor, onOpenDay, missedDays }) {
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

  // Milestones are a separate mark from events — see the note beside the
  // badges below.
  const hasMilestones = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .some((day) => dayFor(dateKeyFor(day))?.milestone)

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
          // Owed and not answered, versus simply not a day anything was owed
          // on — Ash's report 5 Sep 2026. Every unlogged day used to be filled
          // solid grey, so a pet checked weekly showed six grey blocks a week
          // and an owner who was perfectly up to date read six missed
          // check-ins. Same rule as the strips: a mark means something was
          // missed, and a day nothing was due on is left quiet.
          const isMissed = !colour && missedDays?.has(dateKeyFor(day))
          const title = info?.title || (isMissed ? 'Check-in missed' : 'Nothing recorded')
          const isSelected = selectedDay === day

          return (
            <button
              key={day}
              type="button"
              className={`calendar-cell ${isSelected ? 'selected' : ''} ${!colour && !isMissed ? 'calendar-cell-quiet' : ''} ${isMissed ? 'calendar-cell-missed' : ''}`.replace(/\s+/g, ' ').trim()}
              style={colour ? { background: colour, color: '#fff' } : undefined}
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
                  <Pill size={10} strokeWidth={2.75} />
                </span>
              )}
              {/* The note mark takes the opposite corner, so a day that has
                  both a medication change and a note shows both rather than
                  one covering the other — which is exactly the day an owner
                  most wants to open. */}
              {info?.note && (
                <span className="calendar-cell-note">
                  <Pencil size={10} strokeWidth={2.75} />
                </span>
              )}
              {/* Four marks, one per corner, one meaning each.
                  Top-left a note, top-right a medication change, bottom-right
                  something from the Events list, bottom-left a change to what
                  the app is tracking — a diet trial starting, a re-challenge
                  food going in.

                  They were three until 29 Aug 2026, with events and the app's
                  own milestones sharing a flag. Ash's report is what that
                  costs: a day with an amber finding, a new drug and a vet
                  visit drew one mark and wrote one merged line, so the event
                  she had just logged looked as though it had never reached the
                  calendar. A mark that means several things means none of
                  them.

                  Four is what the day can actually carry, and the day that
                  carries all four is exactly the one worth opening. */}
              {info?.event && (
                <span className="calendar-cell-event">
                  <Stethoscope size={10} strokeWidth={2.75} />
                </span>
              )}
              {info?.milestone && (
                <span className="calendar-cell-milestone">
                  <Flag size={10} strokeWidth={2.75} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay != null && (
        <div className="calendar-detail" role="status">
          <p className="calendar-detail-date">
            <strong>{selectedDay} {monthLabel.split(' ')[0]}</strong>
          </p>
          {/* One line per thing that happened, each behind the mark it was
              drawn with, rather than all of them joined by dashes into a
              single sentence.

              The merged version is what Ash was reading when she reported the
              calendar: the day's findings, the medication change and the
              logged event ran together into one line under one flag, and
              nothing said which part was which. A day's marks and a day's
              lines now use the same vocabulary, so the flag on the cell and
              the flagged line underneath are recognisably the same thing.

              Falls back to `title` for any caller that has not been given
              parts — nothing is lost if a new calendar arrives with the old
              shape. */}
          {detailLinesFor(dayFor(dateKeyFor(selectedDay)))}
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
          {/* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Names the Events list rather than calling
              it "a medical event", which read as a category of its own when
              it is simply the row the owner added below. */}
          Something from the Events list below — an episode, a diagnosis, a
          treatment change. Tap the day to see what.
        </p>
      )}

      {hasMilestones && (
        <p className="calendar-legend">
          <Flag size={13} />
          {/* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Deliberately does not list what counts:
              the set differs by condition — a diet trial mark exists only in
              allergies — and a list that is wrong for the condition being
              looked at is worse than no list. */}
          A change to what is being tracked, such as a diet trial starting.
          Tap the day to see what.
        </p>
      )}
    </div>
  )
}


// One line per thing recorded on a day, each behind its own mark.
//
// `parts` is what the chart descriptors in lib/charts.js now return: the
// day's findings, a medication change, a note, an Events row, a change to
// what is being tracked. Any of them may be absent.
//
// A caller that supplies only `title` — nothing does today, but the shape is
// public — still renders, as one unmarked line.
function detailLinesFor(info) {
  if (!info) return <p className="calendar-detail-text">Nothing recorded</p>

  const parts = info.parts
  if (!parts) {
    return <p className="calendar-detail-text">{info.title || 'Nothing recorded'}</p>
  }

  const lines = [
    // No icon: the day's own colour is this line's mark, and giving it a
    // fifth glyph would say the findings are one more thing that happened
    // rather than the day's verdict on all of them.
    { key: 'severity', Icon: null, text: parts.severity },
    { key: 'marker', Icon: Pill, text: parts.marker },
    { key: 'note', Icon: Pencil, text: parts.note },
    { key: 'event', Icon: Stethoscope, text: parts.event },
    { key: 'milestone', Icon: Flag, text: parts.milestone },
  ].filter((line) => Boolean(line.text))

  if (lines.length === 0) return <p className="calendar-detail-text">Nothing recorded</p>

  return lines.map(({ key, Icon, text }) => (
    <p key={key} className="calendar-detail-text">
      {Icon && <Icon size={13} className="calendar-detail-icon" />}
      {text}
    </p>
  ))
}

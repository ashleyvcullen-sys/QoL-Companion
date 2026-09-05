import { useState } from 'react'
import { SEVERITY, SEVERITY_COLOURS } from '../lib/conditions'

// The whole record in one view — one row per month, one cell per day.
//
// Ash's instruction 4 Sep 2026: "enable user to view all time summaries in one
// view rather than needing to scroll through graph/calendar. this is
// especially important for exporting reports to see the full picture." The
// month grid answers "how was August?"; nothing answered "how has the year
// been?" without paging through it a month at a time, and the report inherited
// the same limit — a vet was handed whichever month the owner happened to be
// looking at.
//
// Rows by month rather than the denser columns-by-week heatmap, her choice
// from two mock-ups the same day. Both fit; only one can tell you WHEN. A
// year of week-columns is a texture you can see a bad patch in but cannot
// name, and at the cell size it forces there is nothing left to tap.
//
// Nothing about scoring lives here. The caller passes the same `dayFor` the
// month grid takes, so the two cannot disagree about a day.
export default function AllTimeCalendar({ dayFor, range, onOpenDay }) {
  // Which day the reader has tapped. The month grid learned this the hard way
  // — `title` is a hover tooltip and there is no hover on a phone, so every
  // explanation it carried was unreachable on the device it was built for.
  const [selectedDay, setSelectedDay] = useState(null)

  if (!range?.from || !range?.to) return null

  const months = monthsBetween(range.from, range.to)
  if (!months.length) return null

  const counts = { logged: 0, ok: 0, concern: 0, emergency: 0, elapsed: 0 }
  for (const month of months) {
    for (const dateKey of month.days) {
      if (dateKey < range.from || dateKey > range.to) continue
      counts.elapsed += 1
      const day = dayFor(dateKey)
      const severity = severityOf(day)
      if (severity) {
        counts.logged += 1
        counts[severity] += 1
      }
    }
  }

  const selected = selectedDay ? dayFor(selectedDay) : null

  return (
    <div className="at-cal">
      {months.map((month) => (
        <div key={month.key} className="at-row">
          <span className="at-row-label">{month.label}</span>
          {/* Always 31 columns, so every month lines up under the last and a
              vertical band of amber reads as the same days of the month
              across a year. February's missing three are blanks. */}
          <div className="at-row-days">
            {month.days.map((dateKey, index) => {
              if (!dateKey || dateKey < range.from || dateKey > range.to) {
                return <span key={index} className="at-day at-day-pad" aria-hidden="true" />
              }
              const day = dayFor(dateKey)
              const label = day?.title ? `${dateKey}: ${day.title}` : dateKey
              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`at-day ${day?.colour ? '' : 'at-day-empty'}`.trim()}
                  style={day?.colour ? { background: day.colour } : undefined}
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    setSelectedDay(dateKey)
                    if (onOpenDay && day) onOpenDay(dateKey)
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}

      {/* What the reader tapped, in words. The same job the month grid's
          selected-day line does, for the same reason. */}
      {selected?.title && (
        <p className="at-selected">
          <b>{formatDayLabel(selectedDay)}</b> — {selected.title}
        </p>
      )}

      {/* The sentence someone reads out in a consult. It did not exist
          anywhere in the app before this view: the calendar could show a
          fortnight of amber without ever saying how many days that was out of
          how many, and "how often is she bad?" is the question a vet asks. */}
      <p className="at-stats">
        <b>{counts.logged}</b> {counts.logged === 1 ? 'day' : 'days'} logged
        {' '}over <b>{counts.elapsed}</b>
        {counts.logged > 0 && (
          <>
            {' · '}<b>{counts.concern + counts.emergency}</b> flagged
            {counts.emergency > 0 && <>{' · '}<b>{counts.emergency}</b> needing attention</>}
          </>
        )}
        <br />
        {formatDayLabel(range.from)} – {formatDayLabel(range.to)}
      </p>
    </div>
  )
}

// Which severity a day's colour stands for.
//
// Read back from the colour rather than added to what `dayFor` returns: the
// two calendar descriptors build that object differently — one from a scored
// result, one from a summarised entry — and giving them a third field to keep
// in step is a way for them to fall out of step. The colours are already the
// one thing they agree on.
function severityOf(day) {
  if (!day?.colour) return null
  if (day.colour === SEVERITY_COLOURS[SEVERITY.EMERGENCY]) return 'emergency'
  if (day.colour === SEVERITY_COLOURS[SEVERITY.CONCERN]) return 'concern'
  return 'ok'
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Every month the range touches, oldest first, each carrying 31 date keys —
// null where the month is short. UTC throughout, like the fortnight strip on
// the home card: stepping months in local time drifts across a DST boundary.
function monthsBetween(fromIso, toIso) {
  const [fromYear, fromMonth] = fromIso.split('-').map(Number)
  const [toYear, toMonth] = toIso.split('-').map(Number)
  if (!fromYear || !fromMonth || !toYear || !toMonth) return []

  const out = []
  let year = fromYear
  let month = fromMonth
  // A guard rather than a while(true): a corrupt range must not spin here.
  for (let i = 0; i < 600; i += 1) {
    const days = []
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate()
    for (let day = 1; day <= 31; day += 1) {
      days.push(day <= length
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : null)
    }
    out.push({ key: `${year}-${month}`, label: `${MONTH_NAMES[month - 1]} ${String(year).slice(-2)}`, days })
    if (year === toYear && month === toMonth) break
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return out
}

function formatDayLabel(dateIso) {
  const [year, month, day] = String(dateIso).split('-')
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : dateIso
}

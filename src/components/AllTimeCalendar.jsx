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
export default function AllTimeCalendar({ dayFor, range, missedDays }) {
  if (!range?.from || !range?.to) return null

  const months = monthsBetween(range.from, range.to)
  if (!months.length) return null

  const counts = { logged: 0, ok: 0, concern: 0, emergency: 0, elapsed: 0, missed: 0 }
  const rows = months.map((month) => {
    const row = { ...month, cells: [], ok: 0, concern: 0, emergency: 0, missed: 0 }
    for (const dateKey of month.days) {
      if (!dateKey || dateKey < range.from || dateKey > range.to) {
        row.cells.push({ kind: 'pad' })
        continue
      }
      counts.elapsed += 1
      const severity = severityOf(dayFor(dateKey))
      if (severity) {
        counts.logged += 1
        counts[severity] += 1
        row[severity] += 1
        row.cells.push({ kind: severity, colour: dayFor(dateKey).colour })
      } else if (missedDays?.has(dateKey)) {
        counts.missed += 1
        row.missed += 1
        row.cells.push({ kind: 'missed' })
      } else {
        row.cells.push({ kind: 'none' })
      }
    }
    return row
  })

  return (
    <div className="at-cal">
      {rows.map((row) => (
        <div key={row.key} className="at-row">
          <span className="at-row-label">{row.label}</span>
          {/* Not tappable, on Ash's instruction 5 Sep 2026. Thirty-one days
              across a phone leaves each one a few pixels wide, and a target
              nobody can aim at is worse than no target: the reader cannot
              tell which day they are about to open. The month grid is where
              a day is opened, and every day there is full size.

              So the row is read as one picture rather than as thirty-one
              controls — which is also what a screen reader wants. A grid of
              three hundred individually labelled dots is unusable; one
              sentence per month is the record. */}
          <div className="at-row-days" role="img" aria-label={rowLabel(row)}>
            {row.cells.map((cell, index) => (
              <span
                key={index}
                className={`at-day at-day-${cell.kind}`}
                style={cell.colour ? { background: cell.colour } : undefined}
              />
            ))}
          </div>
        </div>
      ))}

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
        {counts.missed > 0 && <>{' · '}<b>{counts.missed}</b> missed</>}
        <br />
        {formatDayLabel(range.from)} – {formatDayLabel(range.to)}
      </p>
    </div>
  )
}

// One sentence per month, for a reader who cannot see the row.
function rowLabel(row) {
  const parts = []
  if (row.ok) parts.push(`${row.ok} good`)
  if (row.concern) parts.push(`${row.concern} worth watching`)
  if (row.emergency) parts.push(`${row.emergency} needing attention`)
  if (row.missed) parts.push(`${row.missed} missed`)
  return parts.length ? `${row.label}: ${parts.join(', ')}` : `${row.label}: nothing recorded`
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

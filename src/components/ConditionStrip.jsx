import { AlertTriangle, Check } from 'lucide-react'
import { MONITORING_STATE } from '../lib/monitoringStatus'

// The fortnight, and what is owed. Two pieces, used together on the home
// screen's condition row and at the top of the condition's own screen —
// extracted 4 Sep 2026 so the two cannot drift apart.

// Fourteen ticks, oldest left, coloured exactly as the calendar colours the
// same day. A hollow tick is a check-in that was owed and did not happen:
// nothing recorded is not the same as nothing wrong, and a strip that painted
// those green would tell an owner their pet was fine on days nobody looked.
//
// One tick per SCHEDULED CHECK-IN since 5 Sep 2026, not per calendar day —
// see conditionHistory. A weekly pet used to get two marks and twelve blanks.
export function ConditionStrip({ history, className = '' }) {
  if (!history) return null

  return (
    <span
      className={`dx-strip mini ${className}`.trim()}
      role="img"
      // Check-ins, not days — the strip counts the pet's own cadence since
      // 5 Sep 2026, so for a weekly condition these marks are weeks. Counted
      // off the strip itself rather than off WINDOW_SLOTS: the strip is only
      // as long as the history is, and a fortnightly pet with seven marks was
      // being announced as "0 flagged, 7 missed".
      // APPROVED — Dr Ash Cullen (BSc, DVM), 5 Sep 2026.
      aria-label={describe(history)}
    >
      {history.strip.map((day, index) => (
        <span
          key={day.date}
          // `none` where nothing was owed — see the note on missed in
          // lib/conditionHistory.js. An outline is a missed check-in, not
          // merely a day without one.
          className={`dx-day ${day.severity ?? (day.missed ? '' : 'none')} ${index === history.strip.length - 1 ? 'today' : ''}`.replace(/\s+/g, ' ').trim()}
        />
      ))}
    </span>
  )
}

const STATES = {
  [MONITORING_STATE.OK]: { tone: 'ok', text: 'Up to date', label: 'Monitoring up to date' },
  [MONITORING_STATE.DUE]: { tone: 'due', text: 'Due today', label: 'This assessment is due today' },
  [MONITORING_STATE.NEVER]: { tone: 'due', text: 'Not recorded yet', label: 'Nothing recorded yet' },
  [MONITORING_STATE.OFF]: { tone: 'off', text: 'Reminder off', label: 'Reminder off for this condition' },
}

// Each state said in words and in its own colour — Ash's instruction 4 Sep
// 2026: up to date green with a tick, due today amber with the warning mark,
// overdue red with the same mark.
//
// Due today was previously drawn in the green of the up-to-date state,
// because the row only distinguished late from not-late. Due today is
// neither: something is owed, but nothing has been missed.
//
// A screen reader gets the full sentence approved on 3 Sep 2026 — "This
// assessment is 17 days overdue" — from the aria-label; the visible text is
// the short form, because it has one line to say it in.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026 — up to date, due today,
// overdue, and their colours.
//
// The other two states — APPROVED — Dr Ash Cullen (BSc, DVM), 5 Sep 2026. Taking the whole status rather than
// just "is it due" is what surfaced them: a condition with no entries at all,
// and one whose reminder the owner has turned off, were both being drawn as
// a green "Up to date", which for a condition nobody has ever logged is
// simply untrue. "Not recorded yet" and "Reminder off" are mine.
export function ConditionState({ status }) {
  const state = STATES[status?.state] ?? STATES[MONITORING_STATE.OK]
  const overdueBy = status?.overdueBy ?? 0
  const late = status?.state === MONITORING_STATE.DUE && overdueBy > 0

  const tone = late ? 'late' : state.tone
  const text = late
    ? `${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue`
    : state.text
  const label = late
    ? `This assessment is ${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue`
    : state.label

  return (
    <span className={`dx-row-state ${tone}`} role="img" aria-label={label}>
      {/* A reminder the owner switched off is a setting, not a warning, so
          it gets neither mark. */}
      {tone === 'ok' && <Check size={14} />}
      {(tone === 'due' || tone === 'late') && <AlertTriangle size={14} />}
      <span>{text}</span>
    </span>
  )
}

function describe(history) {
  const shown = history.strip.length
  if (!shown) return 'Nothing logged yet'
  const missed = history.strip.filter((day) => day.missed).length
  if (history.logged === 0) return `Nothing logged in the last ${shown} check-ins`
  const parts = [`${history.flagged} flagged`]
  if (missed > 0) parts.push(`${missed} missed`)
  return `Last ${shown} check-in${shown === 1 ? '' : 's'}: ${parts.join(', ')}`
}

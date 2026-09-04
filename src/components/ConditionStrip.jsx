import { AlertTriangle, Check } from 'lucide-react'
import { WINDOW_DAYS } from '../lib/conditionHistory'
import { MONITORING_STATE } from '../lib/monitoringStatus'

// The fortnight, and what is owed. Two pieces, used together on the home
// screen's condition row and at the top of the condition's own screen —
// extracted 4 Sep 2026 so the two cannot drift apart.

// Fourteen ticks, oldest left, coloured exactly as the calendar colours the
// same day. A hollow tick is a day with nothing logged: nothing recorded is
// not the same as nothing wrong, and a strip that painted those green would
// tell an owner their pet was fine on days nobody looked.
export function ConditionStrip({ history, className = '' }) {
  if (!history) return null

  return (
    <span
      className={`dx-strip mini ${className}`.trim()}
      role="img"
      aria-label={history.logged === 0
        ? 'Nothing logged in the last 14 days'
        : `Last 14 days: ${history.flagged} day${history.flagged === 1 ? '' : 's'} flagged, ${WINDOW_DAYS - history.logged} not logged`}
    >
      {history.strip.map((day, index) => (
        <span
          key={day.date}
          className={`dx-day ${day.severity ?? ''} ${index === history.strip.length - 1 ? 'today' : ''}`.replace(/\s+/g, ' ').trim()}
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
// PENDING ASH — the other two states. Taking the whole status rather than
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

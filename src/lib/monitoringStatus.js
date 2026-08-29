// One answer to "is this due?", for every screen that asks it.
//
// Three screens asked it independently and two of them disagreed. Schedule
// built a Date from the ISO string and compared it to `new Date()`, which
// mixes a UTC midnight with a local clock and can be a day out either way
// depending on the hour and the timezone. ConditionMonitoring parsed both
// sides as UTC midnight and got it right. The condition list didn't ask at
// all. So the same pet could read "On track" on one screen and "due now" on
// another, which is worse than either answer alone.
//
// The decision lives here. The wording stays on the screens, because how you
// say "you're late filling this in" to someone monitoring a sick animal is a
// different question to how you work out that they are.

// Whole days between two ISO dates, both parsed as UTC midnight.
//
// UTC on both sides is what makes this stable: the difference between two
// midnights is always a whole number of days, so no clock change, timezone
// or time of day can make "yesterday" come out as 0 or 2.
export function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null
}

// How often this condition should be filled in, for this pet.
//
// The owner's own choice wins; failing that, the cadence the condition itself
// recommends (arthritis is weekly, most things are daily); failing that,
// daily. An explicit 0 means the owner turned this condition's reminder off,
// and is preserved rather than falling through to a default — "off" is an
// answer, not an absence.
export function cadenceDaysFor(definition, schedule) {
  const saved = schedule?.conditions?.[definition?.key]
  if (saved?.days === 0) return 0
  return saved?.days ?? definition?.cadence?.days ?? 1
}

export const MONITORING_STATE = {
  OFF: 'off',
  NEVER: 'never',
  DUE: 'due',
  OK: 'ok',
}

// The state of one condition's monitoring for one pet.
//
// `dueIn` is days until the next one is due: 0 means today, negative means
// late by that many days. It is returned for every state that has one so a
// screen can say "due tomorrow" or "3 days late" without recomputing
// anything.
export function monitoringStatus({ definition, schedule, lastDate, today }) {
  const cadenceDays = cadenceDaysFor(definition, schedule)
  if (!cadenceDays) return { state: MONITORING_STATE.OFF, cadenceDays: 0, dueIn: null }
  if (!lastDate) return { state: MONITORING_STATE.NEVER, cadenceDays, dueIn: null }

  const sinceLast = daysBetween(lastDate, today)
  if (sinceLast == null) return { state: MONITORING_STATE.NEVER, cadenceDays, dueIn: null }

  const dueIn = cadenceDays - sinceLast
  return {
    state: dueIn <= 0 ? MONITORING_STATE.DUE : MONITORING_STATE.OK,
    cadenceDays,
    dueIn,
    // How many days past due, for the states that are past it. Zero on the
    // day it becomes due, which is deliberately not the same as being late.
    overdueBy: dueIn <= 0 ? -dueIn : 0,
  }
}

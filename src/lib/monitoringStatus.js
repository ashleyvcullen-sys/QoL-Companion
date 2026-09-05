import { formatDateDDMMYY, isIsoDate } from './formatDate'

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
// The owner's own choice wins; failing that, daily.
//
// A definition MAY carry its own `cadence` and none currently does — Ash's
// call, 29 Aug 2026: everything starts daily and the owner changes it in
// Reminders if they want to. The fallback is kept because the alternative is
// hard-coding 1 here and rediscovering later that some condition needed a
// different starting point.
//
// An explicit 0 means the owner turned this condition's reminder off, and is
// preserved rather than falling through to a default — "off" is an answer,
// not an absence.
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

// "Started 6 weeks and 2 days ago (14/07/2026)".
//
// Weeks rather than days, because the thing being counted is measured in
// weeks: an elimination trial runs at least eight of them, and "58 days"
// makes the reader do arithmetic to find out where they are.
//
// Lives here rather than in the component that first needed it, because two
// screens now show it — the date question itself, and the condition form on
// every later day, where the question has stopped being asked.
export function elapsedLabel(dateIso, today) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dateIso}T00:00:00Z`)
  if (!Number.isFinite(ms)) return null
  const days = Math.floor(ms / 86400000)
  // Through lib/formatDate rather than built here — this was one of two
  // remaining hand-rolled copies, and they printed a four-digit year after
  // the shared one moved to two on 4 Sep 2026. The validity test comes from
  // the same file, so this function and the formatter cannot disagree about
  // what counts as a date.
  if (!isIsoDate(dateIso)) return null
  const shown = formatDateDDMMYY(dateIso)

  if (days < 0) return `Set for ${shown}.`
  if (days === 0) return 'Started today.'
  if (days === 1) return `Started yesterday (${shown}).`
  if (days < 14) return `Started ${days} days ago (${shown}).`

  const weeks = Math.floor(days / 7)
  const spare = days % 7
  const weekText = spare === 0
    ? `${weeks} weeks`
    : `${weeks} weeks and ${spare} day${spare === 1 ? '' : 's'}`
  return `Started ${weekText} ago (${shown}).`
}

// Which days a check-in was actually DUE and did not happen.
//
// Ash's report 5 Sep 2026: a pet monitored weekly drew six hollow boxes for
// every filled one, and an owner who was perfectly up to date read six missed
// check-ins. The strip was answering "was anything logged on this day?" when
// the question an owner asks it is "did I miss anything?".
//
// Walked forward from the first entry rather than derived from a fixed grid,
// because dueness is measured from the LAST entry — the same rule
// monitoringStatus uses above. Log on the 1st and again on the 20th at a
// weekly cadence and the 8th and the 15th were missed; the days between them
// were never owed.
//
// A missed slot is treated as consumed, so a fortnight's silence on a weekly
// cadence is two missed check-ins rather than thirteen.
//
// Returns an empty set when there is no cadence to be measured against: a
// condition whose reminder the owner has switched off is not one they are
// behind on.
export function missedCheckIns({ dates = [], cadenceDays, from, to }) {
  const missed = new Set()
  if (!cadenceDays || cadenceDays < 1) return missed
  if (!from || !to) return missed

  const logged = new Set(dates)
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return missed

  // Daily needs no walk: every day from the first entry onward was owed.
  if (cadenceDays === 1) {
    for (let at = start; at <= end; at += 86400000) {
      const key = isoFromUtc(at)
      if (!logged.has(key)) missed.add(key)
    }
    return missed
  }

  let lastLogged = start
  for (let at = start + 86400000; at <= end; at += 86400000) {
    const key = isoFromUtc(at)
    if (logged.has(key)) {
      lastLogged = at
      continue
    }
    if (at - lastLogged >= cadenceDays * 86400000) {
      missed.add(key)
      // Consumed, so the next one is owed a full cadence later rather than
      // every day from here on being marked.
      lastLogged = at
    }
  }
  return missed
}

function isoFromUtc(ms) {
  const at = new Date(ms)
  return [
    at.getUTCFullYear(),
    String(at.getUTCMonth() + 1).padStart(2, '0'),
    String(at.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

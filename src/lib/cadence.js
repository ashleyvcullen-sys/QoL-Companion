import { supabase } from './supabase'

// How often each thing is assessed, and where that setting lives.
//
// Extracted from Schedule.jsx on 4 Sep 2026, when the same control was added
// to the top of each condition's own screen. The default rule in particular
// has to have one home: a condition with no saved entry falls back to the
// cadence its own definition recommends, and only an explicit 0 means "no
// reminder" — `undefined` means the owner has never touched this one, which
// is not the same thing. Two copies of that would eventually disagree.

export const CADENCE_OPTIONS = [
  { value: 1, label: 'Daily' },
  { value: 7, label: 'Weekly' },
  { value: 14, label: 'Every 2 weeks' },
  { value: 30, label: 'Monthly' },
]

// How often a thing repeats — one list, used by the assessment and, since
// 4 Oct 2026, by every disease too.
//
// One control rather than two: a frequency picker beside a separate
// "3 times / weekly" one read as three questions about a single thing.
//
// `days` is the interval the reminder and the overdue badge run on, and it is
// what goes on `schedule.qol` exactly as before — so nothing else in the app
// had to change. The option's own key goes beside it on `schedule.qolRepeat`,
// so the list reads back as it was set.
//
// `times` is how many weekdays the rung asks for. Where it is set, the day
// picker takes that many and the reminder fires on exactly those days.
// Without any days chosen the rung still falls back to its interval, so
// nothing is broken for an owner who ignores it.
//
// SIX, FIVE AND FOUR TIMES WEEKLY came off on Ash's instruction 4 Oct 2026,
// having been added the same day. They were the rungs a whole number of days
// could not separate — five and six both landed on "every day", four and
// three both on "every two days" — so they depended entirely on the day
// picker to mean anything, and an owner who skipped it got a rung that
// silently behaved like its neighbour.
//
// What remains has a distinct interval per rung: 1, 2, 3, 7, 14, 30. That is
// what lets a condition's cadence be identified by its `days` alone — see
// CONDITION_CADENCE_OPTIONS below.
export const QOL_CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly-3', label: '3 times weekly', days: 2, times: 3 },
  { value: 'weekly-2', label: 'Twice weekly', days: 3, times: 2 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'fortnightly', label: 'Every 2 weeks', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
]

// THE SAME FREQUENCIES AS THE ASSESSMENT since 4 Oct 2026, on Ash's
// instruction: "give the same frequency of monitoring options for disease
// specific monitoring". A condition was offered four intervals while the
// assessment offered those plus the weekly counts, so the same question about
// the same animal had two different sets of answers depending on which screen
// it was asked on.
//
// Derived from the one list rather than retyped beside it, so a rung added
// there appears here too. The projection is lossless because every rung has
// its own interval: `days` identifies the option, which is what lets a
// condition keep storing nothing but its interval — no new field, no
// migration, and old saved values still read back as the right rung.
//
// If a rung with a duplicate interval is ever added, that stops being true
// and conditions will need the option's key stored alongside, exactly as
// `schedule.qolRepeat` does for the assessment.
//
// A condition can also have no reminder at all. Someone monitoring four
// things does not necessarily want four reminders, and the alternative —
// deleting the condition to stop being nudged — would take the history with
// it. That state is still stored as a cadence of 0 but is not OFFERED here:
// since 27 Sep 2026 it is a toggle of its own, matching the Medications
// screen. Asking someone to find "off" at the bottom of a list labelled "how
// often" was conflating two questions in one control.
export const CONDITION_CADENCE_OPTIONS = QOL_CADENCE_OPTIONS.map((option) => ({
  value: option.days,
  label: option.label,
  days: option.days,
  times: option.times,
}))

// The rung a condition is currently on, by its interval.
export function conditionCadenceOption(days) {
  return CONDITION_CADENCE_OPTIONS.find((option) => option.value === days) ?? null
}

// 0-6, and nothing that merely converts to it.
//
// Number(null), Number('') and Number(false) are all 0, so a filter that
// tested the CONVERTED value let any of those through as Sunday — a reminder
// on a day nobody picked, which is worse than one dropped. Found 4 Oct 2026
// by probing the function rather than by anything going wrong.
function isWeekday(day) {
  if (typeof day !== 'number' && typeof day !== 'string') return false
  if (typeof day === 'string' && day.trim() === '') return false
  const n = Number(day)
  return Number.isInteger(n) && n >= 0 && n <= 6
}

// The weekdays this condition's check-in is set to, 0-6. Empty means it is
// still an interval counted from the last entry — the same contract, and the
// same fallback, as qolWeekdaysOf below.
export function conditionWeekdaysOf(pet, conditionKey) {
  const days = conditionSchedulesOf(pet)[conditionKey]?.weekdays
  if (!Array.isArray(days)) return []
  return [...new Set(days.filter(isWeekday).map(Number))].sort((a, b) => a - b)
}

// The weekdays this pet's check-in is set to, 0-6. Empty means it is still an
// interval counted from the last entry.
export function qolWeekdaysOf(pet) {
  const days = pet?.schedule?.qolDays
  if (!Array.isArray(days)) return []
  return [...new Set(days.filter(isWeekday).map(Number))].sort((a, b) => a - b)
}

export function qolCadenceOption(value) {
  return QOL_CADENCE_OPTIONS.find((option) => option.value === value) ?? null
}

// Which option the list should be showing. A pet set up before this existed
// has only an interval saved, so it falls back to the first option with that
// interval — 1 day is Daily, 7 is Weekly, and so on.
export function qolRepeatOf(pet) {
  const saved = qolCadenceOption(pet?.schedule?.qolRepeat)
  if (saved) return saved
  const days = pet?.schedule?.qol ?? pet?.schedule?.general ?? 7
  return QOL_CADENCE_OPTIONS.find((option) => option.days === days)
    ?? QOL_CADENCE_OPTIONS.find((option) => option.value === 'weekly')
}

// Which day the reminder lands on, and therefore which picker to show. A
// daily cadence has no day to choose; a fortnightly one still lands on a
// weekday. Monthly is the only one that asks for a date.
export function dayModeFor(cadenceDays) {
  if (cadenceDays === 7 || cadenceDays === 14) return 'week'
  if (cadenceDays >= 28) return 'month'
  return null
}

export function conditionSchedulesOf(pet) {
  return pet?.schedule?.conditions ?? {}
}

export function scheduleForCondition(pet, definition) {
  const saved = conditionSchedulesOf(pet)[definition.key]
  return {
    days: saved?.days ?? definition.cadence?.days ?? 1,
    day: saved?.day ?? null,
    off: saved?.days === 0,
    // The weekdays a rung like "3 times weekly" was pinned to, added 4 Oct
    // 2026 with the shared frequency list. `days` is untouched and is still
    // the interval everything else reads — the overdue badge, the fortnight
    // strip, the scoring influences — so none of them had to learn about
    // this. It matters only to the reminder and to the picker that sets it.
    weekdays: conditionWeekdaysOf(pet, definition.key),
  }
}

// The label as the owner set it, for reading back rather than choosing.
export function cadenceLabel(days) {
  // 0 left the options list on 27 Sep 2026 when "off" became a toggle, so it
  // has to be named here or this reads back "Every 0 days".
  if (!days) return 'No reminder'
  return CONDITION_CADENCE_OPTIONS.find((option) => option.value === days)?.label ?? `Every ${days} days`
}

// Writes one condition's cadence, leaving every other condition's alone.
// Returns the error, if any, rather than throwing: both callers show it in
// place beside the control that failed.
export async function saveConditionSchedule({ pet, conditionKey, patch }) {
  if (!pet?.id) return null
  const schedules = conditionSchedulesOf(pet)
  const current = schedules[conditionKey] ?? {}
  const { error } = await supabase
    .from('pets')
    .update({
      schedule: {
        ...pet.schedule,
        conditions: { ...schedules, [conditionKey]: { ...current, ...patch } },
      },
    })
    .eq('id', pet.id)
  return error ?? null
}

// The hint under the day picker went on Ash's instruction 4 Oct 2026. Both
// sentences — "Pick nothing and the reminder falls the right number of days
// after your last entry." and "Tap it again to go back to counting from your
// last entry." — are gone from the Schedule screen and from a condition's own
// cadence control.

// The time of day this pet's check-in reminders land at, or null for the old
// behaviour: the time the last entry happened to be saved at.
//
// Stored in the pets table's `schedule` jsonb beside the cadences, so it
// needed no migration. Medication reminders keep their own per-dose times.
export function reminderTimeOf(pet) {
  const time = pet?.schedule?.reminderTime
  return typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time) ? time : null
}

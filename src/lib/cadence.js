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

// Conditions can also have no reminder at all. Someone monitoring four things
// does not necessarily want four reminders, and the alternative — deleting the
// condition to stop being nudged about it — would take the history with it.
//
// That state is still stored as a cadence of 0, but it is no longer OFFERED
// here: since 27 Sep 2026 it is a toggle of its own on the Reminders screen,
// on Ash's instruction, matching the Medications screen. Asking someone to
// find "off" at the bottom of a list labelled "how often" was conflating two
// questions in one control.
//
// The list is kept identical to CADENCE_OPTIONS rather than merged into it,
// because the two are free to diverge again and the condition screens import
// this name.
export const CONDITION_CADENCE_OPTIONS = [...CADENCE_OPTIONS]

// How often the assessment repeats.
//
// One list, like every other control on these screens — Ash's instruction
// 4 Oct 2026, after a two-list "3 times / weekly" version read as three
// controls for one question. The weekly frequencies are hers, the same day:
// twice through six times a week, "if they want".
//
// `days` is the interval the reminder and the overdue badge run on, and it is
// what goes on `schedule.qol` exactly as before — so nothing else in the app
// had to change. The option's own key goes beside it on `schedule.qolRepeat`,
// so the list reads back as it was set rather than as whatever interval it
// worked out to.
//
// A whole number of days cannot separate every rung: five and six times a
// week both land on "every day", and three and four times a week both land on
// "every two days". The key is what keeps them apart on screen.
// `times` is how many weekdays the rung asks for. Where it is set, the day
// picker takes that many and the reminder fires on exactly those days —
// Ash's instruction 4 Oct 2026. Without any days chosen the rung still falls
// back to its interval, so nothing is broken for an owner who ignores it.
export const QOL_CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly-6', label: '6 times weekly', days: 1, times: 6 },
  { value: 'weekly-5', label: '5 times weekly', days: 1, times: 5 },
  { value: 'weekly-4', label: '4 times weekly', days: 2, times: 4 },
  { value: 'weekly-3', label: '3 times weekly', days: 2, times: 3 },
  { value: 'weekly-2', label: 'Twice weekly', days: 3, times: 2 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'fortnightly', label: 'Every 2 weeks', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
]

// The weekdays this pet's check-in is set to, 0-6. Empty means it is still an
// interval counted from the last entry.
export function qolWeekdaysOf(pet) {
  const days = pet?.schedule?.qolDays
  if (!Array.isArray(days)) return []
  return [...new Set(days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b)
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

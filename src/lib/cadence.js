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

// Conditions get one more option than the quality of life assessment does.
// Someone monitoring four things does not necessarily want four reminders,
// and the alternative — deleting the condition to stop being nudged about
// it — would take the history with it.
export const CONDITION_CADENCE_OPTIONS = [
  ...CADENCE_OPTIONS,
  { value: 0, label: 'No reminder' },
]

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

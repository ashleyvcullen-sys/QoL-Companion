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

// The line under the day picker, in both places that draw one: the Schedule
// screen and a condition's own cadence control. Written out in both until
// 24 Sep 2026.
//
// APPROVED — Dr Ash Cullen (BSc, DVM). Her words, moved rather than rewritten.
export function reminderDayHint(chosenDay) {
  return chosenDay == null
    ? 'Pick nothing and the reminder falls the right number of days after your last entry.'
    : 'Tap it again to go back to counting from your last entry.'
}

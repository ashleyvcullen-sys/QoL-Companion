import { useMemo } from 'react'
import { supabase } from './supabase'
import { invalidateQueryPrefix, useCachedQuery } from './queryCache'

// Read twice over on every screen — the tab bar's dose dot is mounted app-wide
// and the Medications screen asks for the same two tables again on arrival —
// so both go through the session cache. Before that the Meds tab showed a
// skeleton on every visit while re-fetching rows the bar had just read.
const MEDICATIONS_EMPTY = { medications: [], doses: [] }
const MEDICATIONS_KEY_PREFIX = 'medications:'

// Writes here carry a medication id, not a pet id, so the family is cleared
// rather than one key — see invalidateQueryPrefix.
function forgetMedications() {
  invalidateQueryPrefix(MEDICATIONS_KEY_PREFIX)
}

function mapMedicationRow(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    name: row.name,
    dose: row.dose,
    // Empty times means as-needed rather than "no schedule set".
    times: row.times ?? [],
    // 'times' | 'frequency' | 'as_needed'. Explicit rather than inferred from
    // an empty `times`, because "as needed" and "twice a day, whenever suits"
    // both have no clock times but mean different things.
    scheduleMode: row.schedule_mode ?? (row.times?.length ? 'times' : 'as_needed'),
    frequencyCount: row.frequency_count,
    frequencyPeriod: row.frequency_period,
    remindersEnabled: row.reminders_enabled ?? true,
    reminderTime: row.reminder_time ?? null,
    reminderDays: row.reminder_days ?? [],
    // Which conditions this medication is for, as condition keys. Empty means
    // not tied to one — a wormer or a supplement belongs to no diagnosis in
    // particular, and that is a real answer rather than a gap.
    conditionKeys: row.condition_keys ?? [],
    notes: row.notes,
    active: row.active,
    // Null means "not recorded", never "today". An owner who does not know
    // when a long-standing medication began should not have the app invent a
    // date and then draw it on a calendar as though it were fact.
    startedOn: row.started_on ?? null,
    endedOn: row.ended_on ?? null,
  }
}

// Frequency slots need a stable key so ticking one can't be confused with
// another, and so the unique index still blocks double-logging. 'n1', 'n2'
// rather than a clock time — deliberately not parseable as one.
export function frequencySlotKey(index) {
  return `n${index + 1}`
}

// Monday-based week start, matching how a "once a week" course is naturally
// counted. Local date arithmetic, not UTC.
export function weekStartIsoDate(reference) {
  const date = reference ? new Date(reference) : new Date()
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

// First day of the current month, in the pet owner's own timezone.
//
// Same timezone dance as weekStartIsoDate above: toISOString() would convert
// to UTC first, so anyone east of Greenwich in the evening would get
// yesterday's date — and on the 1st of the month, last month.
export function monthStartIsoDate(reference) {
  const date = reference ? new Date(reference) : new Date()
  date.setDate(1)
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function mapDoseRow(row) {
  return {
    id: row.id,
    medicationId: row.medication_id,
    date: row.dose_date,
    time: row.dose_time,
    givenAt: row.given_at,
  }
}

export function todayIsoDate() {
  // Local calendar date, not UTC — a dose given at 9pm in Perth belongs to
  // that day, and toISOString() would push it to tomorrow.
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

export async function fetchMedications(petId) {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapMedicationRow)
}

// Fetches from the start of the current week rather than just today: a
// "once a week" course needs the whole week to know whether it's been given,
// and daily medications just filter this down to today. One query either way.
export async function fetchDosesSince(petId, fromDate) {
  const { data, error } = await supabase
    .from('medication_doses')
    .select('*, medications!inner(pet_id)')
    .eq('medications.pet_id', petId)
    .gte('dose_date', fromDate)

  if (error) throw error
  return (data ?? []).map(mapDoseRow)
}

export async function createMedication({
  petId, name, dose, times, notes, scheduleMode, frequencyCount, frequencyPeriod,
  remindersEnabled, startedOn, endedOn, reminderTime, reminderDays, conditionKeys,
}) {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      pet_id: petId,
      name,
      dose: dose || null,
      // `times` also carries the per-dose reminder times of a medication
      // given several times a DAY — see scheduleMedicationReminders. Same
      // meaning either way ("the clock times this drug is given"), so no new
      // column and no migration.
      times: scheduleMode === 'times' || (scheduleMode === 'frequency' && frequencyPeriod === 'day')
        ? (times ?? [])
        : [],
      schedule_mode: scheduleMode,
      frequency_count: scheduleMode === 'frequency' ? frequencyCount : null,
      frequency_period: scheduleMode === 'frequency' ? frequencyPeriod : null,
      reminders_enabled: remindersEnabled ?? true,
      notes: notes || null,
      started_on: startedOn || null,
      ended_on: endedOn || null,
      reminder_time: scheduleMode === 'frequency' ? (reminderTime || null) : null,
      reminder_days: scheduleMode === 'frequency' ? (reminderDays ?? []) : null,
      condition_keys: conditionKeys ?? [],
    })
    .select()
    .single()

  if (error) throw error
  forgetMedications()
  return mapMedicationRow(data)
}

export async function updateMedication(medicationId, {
  name, dose, times, notes, active, scheduleMode, frequencyCount, frequencyPeriod,
  remindersEnabled, startedOn, endedOn, reminderTime, reminderDays, conditionKeys,
}) {
  const patch = {}
  if (name !== undefined) patch.name = name
  if (dose !== undefined) patch.dose = dose || null
  if (notes !== undefined) patch.notes = notes || null
  if (active !== undefined) patch.active = active
  if (remindersEnabled !== undefined) patch.reminders_enabled = remindersEnabled
  // Empty string means the owner cleared the field, which is a real answer —
  // "I do not know" — and has to reach the database as null rather than being
  // skipped as though they had never touched it.
  if (startedOn !== undefined) patch.started_on = startedOn || null
  if (endedOn !== undefined) patch.ended_on = endedOn || null
  // Independent of schedule mode: what a drug is FOR does not change because
  // of how often it is given.
  if (conditionKeys !== undefined) patch.condition_keys = conditionKeys ?? []

  // Mode drives the other three, so they're written as a set. Leaving a
  // stale frequency on a medication switched to clock times would make the
  // row describe two different schedules at once.
  if (scheduleMode !== undefined) {
    patch.schedule_mode = scheduleMode
    patch.times = scheduleMode === 'times'
      || (scheduleMode === 'frequency' && frequencyPeriod === 'day')
      ? (times ?? [])
      : []
    patch.frequency_count = scheduleMode === 'frequency' ? frequencyCount : null
    patch.frequency_period = scheduleMode === 'frequency' ? frequencyPeriod : null
    // Part of the same set: a reminder time left on a medication switched to
    // clock times would schedule a reminder nothing asks for.
    patch.reminder_time = scheduleMode === 'frequency' ? (reminderTime || null) : null
    patch.reminder_days = scheduleMode === 'frequency' ? (reminderDays ?? []) : null
  } else if (times !== undefined) {
    patch.times = times
  }

  const { data, error } = await supabase
    .from('medications')
    .update(patch)
    .eq('id', medicationId)
    .select()
    .single()

  if (error) throw error
  forgetMedications()
  return mapMedicationRow(data)
}

export async function deleteMedication(medicationId) {
  const { error } = await supabase.from('medications').delete().eq('id', medicationId)
  if (error) throw error
  forgetMedications()
}

// Scheduled doses upsert on (medication, date, slot) so double-tapping can't
// double-log. As-needed doses pass time = null and insert every time, which
// is the point — the partial unique index in the migration allows exactly
// that.
export async function logDose({ medicationId, time, date }) {
  const payload = {
    medication_id: medicationId,
    dose_date: date ?? todayIsoDate(),
    dose_time: time ?? null,
    given_at: new Date().toISOString(),
  }

  const query = time
    ? supabase.from('medication_doses').upsert(payload, { onConflict: 'medication_id,dose_date,dose_time' })
    : supabase.from('medication_doses').insert(payload)

  const { error } = await query
  if (error) throw error
  forgetMedications()
}

export async function unlogDose({ medicationId, time, date }) {
  const { error } = await supabase
    .from('medication_doses')
    .delete()
    .eq('medication_id', medicationId)
    .eq('dose_date', date ?? todayIsoDate())
    .eq('dose_time', time)

  if (error) throw error
  forgetMedications()
}

export function useMedications(petId) {
  const { data, loading, refresh } = useCachedQuery(
    petId ? `${MEDICATIONS_KEY_PREFIX}${petId}` : null,
    () => {
      // The earliest date any medication could still be counting from. A week
      // can start in the previous month — Wednesday the 1st — so this is the
      // earlier of the two rather than simply the month start.
      const earliestStart = [weekStartIsoDate(), monthStartIsoDate()].sort()[0]
      return Promise.all([fetchMedications(petId), fetchDosesSince(petId, earliestStart)])
        .then(([medications, doses]) => ({ medications, doses }))
    },
    { empty: MEDICATIONS_EMPTY },
  )

  return useMemo(() => ({
    medications: data?.medications ?? MEDICATIONS_EMPTY.medications,
    doses: data?.doses ?? MEDICATIONS_EMPTY.doses,
    loading,
    refresh,
  }), [data, loading, refresh])
}

// "2× per day", "as needed", "8:00am, 8:00pm" — one medication's schedule in
// the fewest words that are still true.
//
// Lives here rather than on a screen because two screens show it: the
// Medications list and Home's medication row. The Medications screen had its
// own copy of this until 24 Sep 2026, which threw on a medication saved with
// no times where this one says "no times set".
export function describeMedicationSchedule(medication) {
  if (medication.scheduleMode === 'as_needed') return 'as needed'
  if (medication.scheduleMode === 'frequency') {
    const count = medication.frequencyCount ?? 1
    const period = medication.frequencyPeriod === 'week' ? 'week'
      : medication.frequencyPeriod === 'month' ? 'month'
        : 'day'
    return `${count}\u00d7 per ${period}`
  }
  const times = (medication.times ?? []).filter(Boolean)
  return times.length ? times.map(formatMedicationTime).join(', ') : 'no times set'
}

// '08:00' as a person reads it.
export function formatMedicationTime(value) {
  if (!value) return ''
  const [hour, minute] = String(value).split(':').map(Number)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')}${suffix}`
}

// medicationsForCondition was removed on 24 Sep 2026: nothing referenced it.

// --- What is owed today, across every medication ---------------------------
//
// Ash's instruction 23 Sep 2026, for the alert on the home screen.
//
// Three states, in the order they matter: a dose whose time has passed and
// was not given (overdue), a dose still to come (due), and everything given
// (up to date). A pet on nothing returns 'none', and the home screen says
// nothing at all rather than reassuring an owner about medications they do
// not give.
//
// GRACE is how long after a scheduled time a dose is merely due rather than
// overdue. Sixty minutes: an owner who gives the 8am tablet with breakfast at
// 8:40 has not missed anything, and an app that says they have will be
// ignored by the time it matters.
const DOSE_GRACE_MINUTES = 60

export const MEDICATION_STATE = {
  NONE: 'none',
  UP_TO_DATE: 'up_to_date',
  DUE: 'due',
  OVERDUE: 'overdue',
}

function minutesOfDay(time) {
  const [hour, minute] = String(time ?? '').split(':').map(Number)
  if (!Number.isFinite(hour)) return null
  return hour * 60 + (Number.isFinite(minute) ? minute : 0)
}

export function medicationStatusToday(medications = [], doses = [], now = new Date()) {
  const today = todayIsoDate()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const givenToday = doses.filter((dose) => dose.date === today)

  const outstanding = []
  const overdue = []
  let expected = 0
  let given = 0

  for (const medication of medications) {
    if (!medication.active) continue
    // As-needed medications are never owed: that is what as-needed means.
    if (medication.scheduleMode === 'as_needed') continue

    const mine = givenToday.filter((dose) => dose.medicationId === medication.id)

    if (medication.scheduleMode === 'frequency' && medication.frequencyPeriod !== 'day') {
      // Weekly and monthly courses are not a question about today.
      continue
    }

    if (medication.scheduleMode === 'frequency') {
      const count = medication.frequencyCount ?? 1
      expected += count
      given += Math.min(mine.length, count)
      const missing = count - mine.length
      if (missing > 0) {
        // No per-dose times to measure against, so the reminder time is the
        // only thing that can make one late.
        const reminder = minutesOfDay(medication.reminderTime)
        const late = reminder != null && minutesNow > reminder + DOSE_GRACE_MINUTES
        for (let i = 0; i < missing; i++) {
          (late ? overdue : outstanding).push({ medication, time: medication.reminderTime ?? null })
        }
      }
      continue
    }

    for (const time of (medication.times ?? []).filter(Boolean)) {
      expected += 1
      if (mine.some((dose) => dose.time === time)) {
        given += 1
        continue
      }
      const due = minutesOfDay(time)
      const late = due != null && minutesNow > due + DOSE_GRACE_MINUTES
      ;(late ? overdue : outstanding).push({ medication, time })
    }
  }

  const state = expected === 0
    ? MEDICATION_STATE.NONE
    : overdue.length > 0
      ? MEDICATION_STATE.OVERDUE
      : outstanding.length > 0
        ? MEDICATION_STATE.DUE
        : MEDICATION_STATE.UP_TO_DATE

  return { state, overdue, outstanding, expected, given }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

function mapMedicationRow(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    name: row.name,
    dose: row.dose,
    // Empty times means as-needed rather than "no schedule set".
    times: row.times ?? [],
    notes: row.notes,
    active: row.active,
  }
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

export async function fetchDosesForDate(petId, date) {
  const { data, error } = await supabase
    .from('medication_doses')
    .select('*, medications!inner(pet_id)')
    .eq('medications.pet_id', petId)
    .eq('dose_date', date)

  if (error) throw error
  return (data ?? []).map(mapDoseRow)
}

export async function createMedication({ petId, name, dose, times, notes }) {
  const { data, error } = await supabase
    .from('medications')
    .insert({ pet_id: petId, name, dose: dose || null, times, notes: notes || null })
    .select()
    .single()

  if (error) throw error
  return mapMedicationRow(data)
}

export async function updateMedication(medicationId, { name, dose, times, notes, active }) {
  const patch = {}
  if (name !== undefined) patch.name = name
  if (dose !== undefined) patch.dose = dose || null
  if (times !== undefined) patch.times = times
  if (notes !== undefined) patch.notes = notes || null
  if (active !== undefined) patch.active = active

  const { data, error } = await supabase
    .from('medications')
    .update(patch)
    .eq('id', medicationId)
    .select()
    .single()

  if (error) throw error
  return mapMedicationRow(data)
}

export async function deleteMedication(medicationId) {
  const { error } = await supabase.from('medications').delete().eq('id', medicationId)
  if (error) throw error
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
}

export async function unlogDose({ medicationId, time, date }) {
  const { error } = await supabase
    .from('medication_doses')
    .delete()
    .eq('medication_id', medicationId)
    .eq('dose_date', date ?? todayIsoDate())
    .eq('dose_time', time)

  if (error) throw error
}

export function useMedications(petId) {
  const [medications, setMedications] = useState([])
  const [doses, setDoses] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!petId) {
      setMedications([])
      setDoses([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all([fetchMedications(petId), fetchDosesForDate(petId, todayIsoDate())])
      .then(([meds, todaysDoses]) => {
        if (cancelled) return
        setMedications(meds)
        setDoses(todaysDoses)
      })
      .catch((error) => {
        console.error('Failed to load medications:', error.message)
        if (cancelled) return
        setMedications([])
        setDoses([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId, reloadToken])

  return { medications, doses, loading, refresh }
}

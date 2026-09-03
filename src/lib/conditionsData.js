import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export function todayIsoDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 10)
}

function mapConditionRow(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    conditionKey: row.condition_key,
    diagnosedOn: row.diagnosed_on,
    notes: row.notes,
    active: row.active,
    // Per-pet parameter selection, for conditions composed rather than
    // declared. Empty for every condition with a fixed parameter list, which
    // is all of them except cancer.
    config: row.config ?? {},
  }
}

function mapEntryRow(row) {
  return {
    id: row.id,
    conditionKey: row.condition_key,
    date: row.entry_date,
    values: row.values ?? {},
    notes: row.notes,
  }
}

export async function fetchPetConditions(petId) {
  const { data, error } = await supabase
    .from('pet_conditions')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapConditionRow)
}

export async function addPetCondition({ petId, conditionKey, diagnosedOn, notes }) {
  const { data, error } = await supabase
    .from('pet_conditions')
    .upsert(
      {
        pet_id: petId,
        condition_key: conditionKey,
        diagnosed_on: diagnosedOn || null,
        notes: notes || null,
        active: true,
      },
      { onConflict: 'pet_id,condition_key' },
    )
    .select()
    .single()

  if (error) throw error
  return mapConditionRow(data)
}

// Saved on its own rather than through addPetCondition, because changing what
// you monitor is a different action to starting to monitor. An owner adding a
// second lump three weeks in should not touch diagnosed_on or notes.
export async function saveConditionConfig(conditionId, config) {
  const { error } = await supabase
    .from('pet_conditions')
    .update({ config })
    .eq('id', conditionId)
  if (error) throw error
}

export async function setConditionActive(conditionId, active) {
  const { error } = await supabase.from('pet_conditions').update({ active }).eq('id', conditionId)
  if (error) throw error
}

// Stopping monitoring deletes the readings and events too.
//
// It used to delete only the pet_conditions row. condition_entries and
// condition_events are keyed by (pet_id, condition_key) rather than by
// pet_conditions.id — deliberately, so a condition can be re-added without a
// foreign key to migrate — which means nothing cascades and every reading
// survived. Two things went wrong with that: the screen told the owner their
// readings had been deleted when they had not, and re-adding the condition
// resurrected months of old data as though it had never been removed.
//
// Children first, the pet_conditions row last. If a delete fails halfway the
// condition still shows as tracked, which the owner can see and retry —
// whereas the other order would leave orphaned readings with nothing in the
// interface pointing at them.
export async function removePetCondition(condition) {
  const id = condition?.id
  const petId = condition?.petId
  const conditionKey = condition?.conditionKey

  if (!id || !petId || !conditionKey) {
    throw new Error('Could not remove that condition: missing id, pet or condition key.')
  }

  const { error: entriesError } = await supabase
    .from('condition_entries')
    .delete()
    .eq('pet_id', petId)
    .eq('condition_key', conditionKey)
  if (entriesError) throw entriesError

  const { error: eventsError } = await supabase
    .from('condition_events')
    .delete()
    .eq('pet_id', petId)
    .eq('condition_key', conditionKey)
  if (eventsError) throw eventsError

  const { error } = await supabase.from('pet_conditions').delete().eq('id', id)
  if (error) throw error
}

export async function fetchConditionEntries(petId, conditionKey) {
  const { data, error } = await supabase
    .from('condition_entries')
    .select('*')
    .eq('pet_id', petId)
    .eq('condition_key', conditionKey)
    .order('entry_date', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapEntryRow)
}

// One entry per condition per day. A second save on the same date replaces
// the first, matching every other log in the app.
export async function saveConditionEntry({ petId, conditionKey, values, notes, entryDate }) {
  const { error } = await supabase
    .from('condition_entries')
    .upsert(
      {
        pet_id: petId,
        condition_key: conditionKey,
        entry_date: entryDate ?? todayIsoDate(),
        values,
        notes: notes || null,
      },
      { onConflict: 'pet_id,condition_key,entry_date' },
    )

  if (error) throw error
}

export function usePetConditions(petId) {
  const [conditions, setConditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!petId) {
      setConditions([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchPetConditions(petId)
      .then((result) => { if (!cancelled) setConditions(result) })
      .catch((error) => {
        console.error('Failed to load conditions:', error.message)
        if (!cancelled) setConditions([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [petId, reloadToken])

  return { conditions, loading, refresh }
}

export function useConditionEntries(petId, conditionKey) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!petId || !conditionKey) {
      setEntries([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchConditionEntries(petId, conditionKey)
      .then((result) => { if (!cancelled) setEntries(result) })
      .catch((error) => {
        console.error('Failed to load condition entries:', error.message)
        if (!cancelled) setEntries([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [petId, conditionKey, reloadToken])

  return { entries, loading, refresh }
}

// --- Events ---------------------------------------------------------------

// The placeholder belongs to the TYPE, not to the field.
//
// One placeholder served all five, so choosing "Diagnosis" and being shown
// "e.g. collapsed in the garden" invited the owner to write the wrong kind of
// thing in the one box a vet reads first. An example is only useful when it
// is an example of what is actually being asked for.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026 — the four examples. "e.g. heart disease" is hers.
// `mark` decides which badge the day wears on the calendar, and `prefix` how
// the event reads on the day's line.
//
// The calendar's marks mean things, not tables. A medication change logged
// here is the same fact as one on the Medications screen, so it gets the same
// pill — it drew a stethoscope until 29 Aug 2026 purely because it happened
// to be stored in the events table, which is an implementation detail no
// owner should have to know. Anything without a `mark` gets the stethoscope,
// which is what the Events list is for.
export const EVENT_TYPES = [
  { value: 'episode', label: 'Medical episode', colour: '#A33A2E', placeholder: 'e.g. a seizure, a vomiting episode' },
  { value: 'diagnosis', label: 'Diagnosis', colour: '#5C6F8A', placeholder: 'e.g. heart disease' },
  {
    value: 'medication_started',
    label: 'Medication started',
    colour: '#3D8259',
    placeholder: 'e.g. Furosemide',
    mark: 'medication',
    prefix: 'Started',
  },
  {
    value: 'medication_stopped',
    label: 'Medication stopped',
    colour: '#C97A2E',
    placeholder: 'e.g. Furosemide',
    mark: 'medication',
    prefix: 'Stopped',
  },
  { value: 'other', label: 'Something else', colour: '#8A5C6F', placeholder: 'e.g. a change in routine' },
]

export function eventTypeByValue(value) {
  return EVENT_TYPES.find((entry) => entry.value === value) ?? null
}

function mapEventRow(row) {
  return {
    id: row.id,
    conditionKey: row.condition_key,
    date: row.event_date,
    type: row.event_type,
    title: row.title,
    notes: row.notes,
  }
}

export async function fetchConditionEvents(petId, conditionKey) {
  const { data, error } = await supabase
    .from('condition_events')
    .select('*')
    .eq('pet_id', petId)
    .eq('condition_key', conditionKey)
    .order('event_date', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapEventRow)
}

export async function addConditionEvent({ petId, conditionKey, type, title, notes, eventDate }) {
  const { data, error } = await supabase
    .from('condition_events')
    .insert({
      pet_id: petId,
      condition_key: conditionKey,
      event_type: type,
      title,
      notes: notes || null,
      event_date: eventDate ?? todayIsoDate(),
    })
    .select()
    .single()

  if (error) throw error
  return mapEventRow(data)
}

export async function deleteConditionEvent(eventId) {
  const { error } = await supabase.from('condition_events').delete().eq('id', eventId)
  if (error) throw error
}

export function useConditionEvents(petId, conditionKey) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!petId || !conditionKey) {
      setEvents([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchConditionEvents(petId, conditionKey)
      .then((result) => { if (!cancelled) setEvents(result) })
      .catch((error) => {
        console.error('Failed to load events:', error.message)
        if (!cancelled) setEvents([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [petId, conditionKey, reloadToken])

  return { events, loading, refresh }
}

// Every condition entry for a pet in one query, grouped by condition.
//
// The per-condition hook can't be used here: the export screen needs several
// conditions at once and React hooks can't be called in a loop that varies
// with the data. One fetch, grouped client-side, is also fewer round trips
// than one request per condition.
export function useAllConditionEntries(petId) {
  const [byCondition, setByCondition] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!petId) {
      setByCondition({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('condition_entries')
      .select('*')
      .eq('pet_id', petId)
      .order('entry_date', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to load condition entries:', error.message)
          setByCondition({})
        } else {
          const grouped = {}
          for (const row of data ?? []) {
            const entry = mapEntryRow(row)
            ;(grouped[entry.conditionKey] ??= []).push(entry)
          }
          setByCondition(grouped)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId])

  return { byCondition, loading }
}

// Every event for a pet, grouped by condition — the events counterpart to
// useAllConditionEntries. The report needs these: without them the exported
// parameter charts lose the event markers the on-screen ones carry, which is
// exactly the divergence lib/charts.js exists to prevent.
export function useAllConditionEvents(petId) {
  const [byCondition, setByCondition] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!petId) {
      setByCondition({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('condition_events')
      .select('*')
      .eq('pet_id', petId)
      .order('event_date', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to load condition events:', error.message)
          setByCondition({})
        } else {
          const grouped = {}
          for (const row of data ?? []) {
            const event = mapEventRow(row)
            ;(grouped[event.conditionKey] ??= []).push(event)
          }
          setByCondition(grouped)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId])

  return { byCondition, loading }
}

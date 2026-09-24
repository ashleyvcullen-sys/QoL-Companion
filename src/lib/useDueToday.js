import { useMemo } from 'react'
import { CONDITION_LIST } from './conditions'
import { MONITORING_STATE, monitoringStatus } from './monitoringStatus'
import { todayIsoDate, useAllConditionEntries, usePetConditions } from './conditionsData'
import { useQolHistory } from './useQolHistory'

// The assessment's own cadence lives on the pet, not on a condition
// definition, so it is wrapped to look like one for monitoringStatus.
export function assessmentCadence(pet) {
  return { key: 'qol', cadence: { days: pet?.schedule?.qol ?? pet?.schedule?.general ?? 7 } }
}

// What is owed today, for this pet — the overall assessment and every
// condition being monitored.
//
// Built for the tab bar's badge (Ash's instruction 23 Sep 2026), which is
// why it lives in its own hook rather than inside the home card: the bar is
// on every screen, and "is anything due?" should have one answer wherever it
// is asked. Every number comes from the same monitoringStatus the home card
// and the condition screens use, so a dot on the tab cannot disagree with
// the screen it leads to.
//
// Conditions are gated by the caller, not here: a lapsed subscription must
// not be nagged about a feature it can no longer open.
export function useDueToday(pet, { includeConditions = true } = {}) {
  const { generalEntries } = useQolHistory(pet?.id)
  const { conditions } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)

  return useMemo(() => {
    if (!pet) return { assessmentDue: false, dueConditionKeys: [], anyDue: false }
    const today = todayIsoDate()

    const assessment = monitoringStatus({
      definition: assessmentCadence(pet),
      schedule: null,
      lastDate: generalEntries[generalEntries.length - 1]?.date ?? null,
      today,
    })
    // NEVER — no assessment at all — counts as due: the first one is the
    // whole point of the app, and a bar that stayed quiet until after it had
    // been done would say nothing to the person who most needs telling.
    const assessmentDue = assessment.state === MONITORING_STATE.DUE
      || assessment.state === MONITORING_STATE.NEVER

    const dueConditionKeys = !includeConditions ? [] : CONDITION_LIST
      .filter((definition) => conditions.some((row) => row.conditionKey === definition.key))
      .filter((definition) => {
        const entries = byCondition[definition.key] ?? []
        const status = monitoringStatus({
          definition,
          schedule: pet.schedule,
          lastDate: entries[entries.length - 1]?.date ?? null,
          today,
        })
        // Unlike the assessment, a condition that has never been logged is
        // not "due": it may have been set up minutes ago, and its own
        // schedule decides when it starts asking.
        return status.state === MONITORING_STATE.DUE
      })
      .map((definition) => definition.key)

    return {
      assessmentDue,
      dueConditionKeys,
      anyDue: assessmentDue || dueConditionKeys.length > 0,
    }
  }, [pet, generalEntries, conditions, byCondition, includeConditions])
}

// Disease monitoring, day by day, in the shape the Overall QoL score needs.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. A red answer in any
// tracked condition's form floors that SAME DAY's Overall QoL to Severely
// reduced (score capped at 49%), exactly as a Very severe pain answer does.
// Same day only. The average itself is untouched: disease questions differ
// per condition, per species and per pet, so they are never added to it.
//
// Before this, a pet could have a red Heart Disease day (blue gums) beside a
// green 95% Overall QoL ring on the same date.

import {
  CONDITION_LIST, NOT_APPLICABLE, SEVERITY, UNSURE,
  evaluateParameter, summariseEntry, visibleParameters,
} from './conditions'
import { pillarFor } from './pillarMap'
import { resolveDefinition } from './cancerConfig'

// Map<date, [{ conditionKey, conditionLabel, severity, flagged }]>, one item
// per tracked condition that has an answered entry on that date. Only
// conditions the pet is tracking now — a condition that has been stopped
// no longer speaks for the pet.
export function diseaseDaysByDate({ petConditions = [], entriesByCondition = {}, species }) {
  const byDate = new Map()
  for (const petCondition of petConditions) {
    const definition = CONDITION_LIST.find((condition) => condition.key === petCondition.conditionKey)
    if (!definition) continue
    let resolved = definition
    try {
      resolved = resolveDefinition(definition, petCondition.config ?? {}, species) ?? definition
    } catch (error) {
      console.error('Could not resolve that condition:', error.message)
    }
    for (const entry of entriesByCondition[petCondition.conditionKey] ?? []) {
      let summary = null
      try {
        summary = summariseEntry(resolved, entry.values, species)
      } catch (error) {
        console.error('Could not summarise that day:', error.message)
        continue
      }
      if (!summary || summary.severity == null) continue
      const list = byDate.get(entry.date) ?? []
      list.push({
        conditionKey: petCondition.conditionKey,
        conditionLabel: definition.label,
        severity: summary.severity,
        flagged: summary.flagged ?? [],
        pillarAnswers: pillarAnswersFor(petCondition.conditionKey, resolved, entry.values, species),
      })
      byDate.set(entry.date, list)
    }
  }
  return byDate
}

// One entry's answers as pillar scores: [{ pillar, score (0-100), red }].
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Scored by level: a graded
// scale by its rung (best 100 down to worst 0), a cancer grade 0-4 likewise,
// and a yes/no, choice or number by its traffic light (100 / 50 / 0).
function pillarAnswersFor(conditionKey, resolved, values, species) {
  const out = []
  let parameters = []
  try {
    parameters = visibleParameters(resolved?.parameters ?? [], values ?? {})
  } catch {
    parameters = resolved?.parameters ?? []
  }
  for (const parameter of parameters) {
    const pillar = pillarFor(conditionKey, parameter.key)
    if (!pillar || parameter.informational) continue
    const value = values?.[parameter.key]
    if (value == null || value === '' || value === UNSURE || value === NOT_APPLICABLE) continue
    let verdict = null
    try {
      verdict = evaluateParameter(parameter, value, species)
    } catch {
      continue
    }
    let score = null
    if (parameter.scoreTen) {
      const ten = parameter.scoreTen[Number(value)]
      if (ten != null) score = ten * 10
    } else if (parameter.type === 'scale' || parameter.type === 'beap') {
      const n = Number(value)
      if (Number.isFinite(n)) score = Math.max(0, Math.min(100, 100 - n * 10))
    } else if (parameter.type === 'vcog') {
      const n = Number(value)
      if (Number.isFinite(n)) score = Math.max(0, Math.min(100, 100 - n * 25))
    }
    if (score == null) {
      if (!verdict) continue
      score = verdict.severity === SEVERITY.EMERGENCY ? 0
        : verdict.severity === SEVERITY.CONCERN ? 50 : 100
    }
    out.push({ pillar, score, red: verdict?.severity === SEVERITY.EMERGENCY })
  }
  return out
}

// Every pillar answer recorded in disease monitoring on one date.
export function pillarAnswersOn(byDate, date) {
  return (byDate?.get(date) ?? []).flatMap((day) => day.pillarAnswers ?? [])
}

// The red findings from one day's list, as the scoring expects them:
// [{ conditionLabel, finding }].
export function diseaseEmergenciesFrom(dayList) {
  return (dayList ?? [])
    .filter((day) => day.severity === SEVERITY.EMERGENCY)
    .map((day) => ({
      conditionLabel: day.conditionLabel,
      finding: day.flagged.find((flag) => flag.severity === SEVERITY.EMERGENCY)?.label ?? null,
    }))
}

// Convenience for callers holding a map and a date.
export function diseaseEmergenciesOn(byDate, date) {
  return diseaseEmergenciesFrom(byDate?.get(date))
}

// Everything outside the seventeen assessment items that the overall score
// answers to, assembled for one date.
//
// Ash's instruction 24 Sep 2026: disease monitoring and body condition affect
// the overall quality of life score. Both act as FLOORS on the band — the
// mechanism the worst BEAAAAPP category and the emergency answers already use
// — and both also pull their own pillar down. The seventeen-item average is
// untouched, so two pets and two days remain the same measurement; what
// changes is the ceiling that average is allowed to reach.
//
// One module rather than the same three lines at eight call sites: the home
// card, the trends series, the assessment's own finish screen and the export
// must not be able to disagree about what a day scored.
import { scheduleForCondition } from './cadence'
import { CONDITION_LIST } from './conditions'
import {
  diseaseConcernsFrom,
  diseaseDaysInForceOn,
  diseaseEmergenciesFrom,
  pillarAnswersOn,
} from './diseaseDays'
import { bodyConditionPillarAnswer } from './scoring'

const DAY_MS = 24 * 60 * 60 * 1000

// How often each condition is checked for THIS pet — the owner's own setting
// where they have one, the clinical default otherwise. It decides how long a
// finding stays in force.
export function cadenceDaysForPet(pet) {
  return (conditionKey) => {
    const definition = CONDITION_LIST.find((condition) => condition.key === conditionKey)
    if (!definition || !pet) return 1
    const schedule = scheduleForCondition(pet, definition)
    // "No reminder" is not "no monitoring": the questions are still asked, so
    // fall back to the condition's own cadence rather than to a single day.
    return schedule?.off ? (definition.cadence?.days ?? 1) : (schedule?.days ?? 1)
  }
}

// The most recent body condition score on or before `date`, with its age in
// days and the reading before it, or null. Scoring decides what to do with
// them — see BCS_MAX_AGE_DAYS and bodyConditionInfluence, where a 3 counts
// only when it is a fall from `previousScore`.
export function bodyConditionOn(bcsEntries = [], date) {
  if (!date) return null
  const asMs = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(asMs)) return null
  const upTo = (bcsEntries ?? [])
    .filter((entry) => entry?.score != null)
    .map((entry) => ({ ms: Date.parse(`${entry.date}T00:00:00Z`), score: Number(entry.score) }))
    .filter((entry) => Number.isFinite(entry.ms) && entry.ms <= asMs)
    .sort((a, b) => a.ms - b.ms)
  if (upTo.length === 0) return null
  const latest = upTo[upTo.length - 1]
  const previous = upTo.length > 1 ? upTo[upTo.length - 2] : null
  return {
    score: latest.score,
    daysAgo: Math.round((asMs - latest.ms) / DAY_MS),
    previousScore: previous ? previous.score : null,
  }
}

// { diseaseEmergencies, diseaseConcerns, bodyCondition, pillarAnswers } for a
// date — the third and fourth arguments computeGeneralQolResult takes, plus
// the pillar answers computeOverviewCategories takes.
export function qolInfluencesOn({ diseaseByDate, bcsEntries = [], pet, date }) {
  const inForce = diseaseDaysInForceOn(diseaseByDate, date, cadenceDaysForPet(pet))
  const bodyCondition = bodyConditionOn(bcsEntries, date)
  return {
    diseaseEmergencies: diseaseEmergenciesFrom(inForce),
    diseaseConcerns: diseaseConcernsFrom(inForce),
    bodyCondition,
    // The pillar side. Disease answers are taken from the day they were
    // actually recorded (a pillar average is a picture of what was answered,
    // not of what is still in force), and body condition joins them as one
    // more Appetite item.
    pillarAnswers: [
      ...pillarAnswersOn(diseaseByDate, date),
      bodyConditionPillarAnswer(bodyCondition),
    ].filter(Boolean),
  }
}

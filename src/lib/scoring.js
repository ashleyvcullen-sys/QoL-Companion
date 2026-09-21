// Reference: QoLCompanion_Developer_Handoff.md, Section 4.

import { URINARY_BLOCKAGE_SYMPTOMS, VOMITING_EMERGENCY } from './assessmentOptions'

export const SEVERITY = {
  GOOD: 'good',
  MODERATE: 'moderate',
  SEVERE: 'severe',
}

export const SEVERITY_COLORS = {
  [SEVERITY.GOOD]: '#3D8259',
  [SEVERITY.MODERATE]: '#C97A2E',
  [SEVERITY.SEVERE]: '#A33A2E',
}

export function severityFromPercent(percent) {
  if (percent >= 75) return SEVERITY.GOOD
  if (percent >= 50) return SEVERITY.MODERATE
  return SEVERITY.SEVERE
}

export function severityColorFromPercent(percent) {
  return SEVERITY_COLORS[severityFromPercent(percent)]
}

// Each band carries its own severity/colour, so the label and the colour
// come from one place and can't drift apart (they were previously computed
// from two independent threshold lists).
//
// "Good" and "Mildly reduced" share the good/green colour, so green
// starts at 75% — matching the colour thresholds this app used before bands
// carried their own severity. Four bands, three colours. Note the *label*
// still distinguishes 90+ from 75-89 even though the colour doesn't.
//
// severityFromPercent() above is left alone: it's the generic
// percent-to-colour helper used for the 5 Overview pillar bars, which are a
// different measure on a different scale, and shouldn't be recoloured by a
// change to the overall-QoL banding.
// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026; reviewed and confirmed
// 5 Sep 2026. These are the words a vet reads off the ring, so the wording
// was looked at again once the screens around it had settled.
//
// Two revisions on from "Minimal / Some / Moderate / Severe impact". The
// problem with "impact" was that it graded an abstraction rather than the
// animal — an owner reading "82% — Some impact" has to work out impact on
// what. A first pass at plain language ("Doing well", "Struggling") fixed
// that but read as emotional commentary, which is the wrong register for a
// number that may be shown to a vet or used in an end-of-life discussion.
//
// These grade quality of life itself, in the language a clinician would use
// in a record. The severity ladder is unambiguous, nothing is softened, and
// nothing editorialises about how the owner should feel.
const GENERAL_QOL_BANDS = [
  { min: 90, label: 'Good', severity: SEVERITY.GOOD },
  { min: 75, label: 'Mildly reduced', severity: SEVERITY.GOOD },
  { min: 50, label: 'Moderately reduced', severity: SEVERITY.MODERATE },
  { min: 0, label: 'Severely reduced', severity: SEVERITY.SEVERE },
]

const BAND_INDEX_SEVERE_IMPACT = 3

// The highest percentage each band can show: one below the minimum of the
// band above it. Used to cap the headline number when a floor has pulled the
// band down, so the ring never reads 94% "Severely reduced".
function bandCeiling(bandIndex) {
  return bandIndex === 0 ? 100 : GENERAL_QOL_BANDS[bandIndex - 1].min - 1
}

function generalQolBandIndexFromPercent(percent) {
  const index = GENERAL_QOL_BANDS.findIndex((band) => percent >= band.min)
  return index === -1 ? GENERAL_QOL_BANDS.length - 1 : index
}

export function generalQolBandFromPercent(percent) {
  return GENERAL_QOL_BANDS[generalQolBandIndexFromPercent(percent)].label
}

// A flat 16-point average dilutes any single catastrophic finding — one
// BEAAAAPP category at 10 (e.g. "cannot breathe", which the assessment
// itself flags as an emergency) moves the average by at most ~6 points, so
// an otherwise-healthy pet in genuine crisis would still average into
// "Good". This floor stops the headline band from reading better
// than the worst single finding justifies, mirroring how triage works:
// urgency is set by the worst problem, not the mean of all of them.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. The percentage now
// follows the band down: it is capped at the top of whichever band a floor
// forces (49% for Severely reduced, 74% for Moderately reduced). It used to be
// left untouched so the average stayed comparable over time, but a ring
// reading 94% beside "Severely reduced" confused owners more than it helped.
// The uncapped average is still returned as `averagePercent`.
function beapBandFloorIndex(beap) {
  if (!beap) return 0

  const answered = BEAP_CATEGORIES
    .map((category) => beap[category])
    .filter((value) => value != null)
  if (answered.length === 0) return 0

  const worst = Math.max(...answered)
  // APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. "Severe" and "Very
  // severe" on ANY category, Eyes included, both floor to Severely reduced
  // (score capped at 49%). Until then 8 floored only to Moderately reduced
  // and 9-10 to Severely reduced. For cats' Eyes/Face this means a Feline
  // Grimace Scale total of 8 or more.
  if (worst >= 8) return BAND_INDEX_SEVERE_IMPACT
  return 0
}

// Two of the three answers in the assessment that stop the owner with an
// emergency pop-up — the same chips, read from the same lists, as
// VomitingPage and UrinationPage. (The third, black/tarry stool, pops up but
// does not floor — see below.)
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Blood in the vomit and a
// possible cat urinary blockage floor the band to Severely reduced (capped
// at 49%). Black, tarry stool deliberately does NOT: it still raises its
// pop-up, but scores like any other stool chip (the flat 5-point penalty),
// the same as fresh blood or mucous. Until then a
// pop-up told the owner to call the vet while the ring could still read
// "Good": each of these is one item of sixteen, worth about 6 points.
//
// The urinary one is cats only, matching the pop-up, so it needs the
// species. Callers that do not pass one get the vomiting floor only — never
// a floor the owner was not shown an alert for.
export function assessmentEmergencies(entry, species = null) {
  if (!entry) return []
  const found = []
  if (entry.vomiting?.hasVomited === true
    && (entry.vomiting.character ?? []).some((chip) => VOMITING_EMERGENCY.chips.includes(chip))) {
    found.push('vomiting')
  }
  if (species === 'cat'
    && entry.urination?.status === 'abnormal'
    && (entry.urination.symptoms ?? []).some((chip) => URINARY_BLOCKAGE_SYMPTOMS.includes(chip))) {
    found.push('urination')
  }
  return found
}

const EMERGENCY_FLOOR_BAND = {
  vomiting: BAND_INDEX_SEVERE_IMPACT,
  urination: BAND_INDEX_SEVERE_IMPACT,
}

function emergencyBandFloorIndex(entry, species) {
  return Math.max(0, ...assessmentEmergencies(entry, species).map((key) => EMERGENCY_FLOOR_BAND[key]))
}

const VOMIT_DAILY_THRESHOLD = 2
const VOMIT_WEEKLY_THRESHOLD = 5

export function scoreSlider(value) {
  return value === 'unsure' ? null : value
}

// Both stool and hygiene apply a single flat penalty when any symptom is
// selected, capped regardless of how many are ticked.
//
// Hygiene used to stack -5 *per* symptom, uncapped, which saturated almost
// immediately: any slider value with 2+ symptoms hit the Math.max(0, ...)
// floor, so "mild matting and slight odour at 9/10" scored identically to
// "severely soiled with open wounds at 0/10". Capping at a flat -5 lets the
// slider carry the severity, with symptoms acting as a single qualifier on
// top of it.
//
// Trade-off, deliberate and matching stool's existing behaviour: the
// *number* of symptoms no longer affects the score beyond the first. The
// symptoms themselves are still stored in full on the entry, so they remain
// visible in reports and history even though they don't move the number.
export function scoreStoolOrHygiene(value, symptoms, { symptomPenalty = 5 } = {}) {
  // 'none' is stool-only ("No faeces today") — like 'unsure', there's no
  // quality to score, so it's excluded from the average rather than
  // penalized or treated as a perfect score.
  if (value === 'unsure' || value === 'none') return null
  const penalty = symptoms.length > 0 ? symptomPenalty : 0
  return Math.max(0, value - penalty)
}

export function scoreVomiting(vomiting) {
  if (vomiting.hasVomited === 'unsure') return null
  if (!vomiting.hasVomited) return 10
  const frequency = Number(vomiting.frequency)
  const exceedsThreshold = !Number.isNaN(frequency) && (
    (vomiting.unit === 'times/day' && frequency > VOMIT_DAILY_THRESHOLD) ||
    (vomiting.unit === 'times/week' && frequency >= VOMIT_WEEKLY_THRESHOLD)
  )
  return exceedsThreshold ? 0 : 5
}

export function scoreUrination(urination) {
  if (urination.status === 'unsure') return null
  if (urination.status === 'normal') return 10
  return urination.symptoms.length > 0 ? 0 : 5
}

// Favourite things: up to three activities the owner named as the ones their
// pet loves, each answered every assessment. One item in the average, the
// mean of the answers given. "Didn't have the chance" is left out, like
// "Not sure" everywhere else — a rainy day is not a lost interest.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Counts as one item
// alongside the other sixteen; three answer levels.
export const FAVOURITE_THING_SCORES = { usual: 10, less: 5, none: 0 }

export function scoreFavouriteThings(favouriteThings) {
  if (!Array.isArray(favouriteThings)) return null
  const scores = favouriteThings
    .map((item) => FAVOURITE_THING_SCORES[item?.answer])
    .filter((score) => score != null)
  if (scores.length === 0) return null
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function scoreWaterIntake(waterIntake) {
  if (waterIntake.status === 'unsure') return null
  if (waterIntake.status === 'normal') return 10
  return 5
}

// BEAAAAPP categories are scored 0 = no abnormalities .. 10 = very severe,
// i.e. the opposite direction to the everyday-function questions, where 10
// is best. Flipping to `10 - score` puts them on the same 0-10
// higher-is-better scale so all 16 data points can go into one flat
// average. (Equivalent to the percentage-based invert() used for the
// Overview pillars, just kept on the 0-10 scale the rest of this function
// already works in.)
function scoreBeapCategory(value) {
  if (value == null) return null
  return 10 - value
}

// Overall QoL: a single flat average of up to 16 individual data points —
// the 8 everyday-function questions plus the 8 BEAAAAPP pain categories,
// each weighted equally. Deliberately NOT a two-group (function vs. pain)
// average.
//
// `beap` is passed separately because it lives in its own table
// (pain_log_entries) rather than on the general entry; callers pair the two
// by date. Any data point that's unanswered — "Not sure" on a function
// question, or a missing/incomplete BEAAAAPP category — is excluded from
// the average entirely rather than counted as zero, so a partial
// assessment isn't penalised for what it doesn't contain.
// `diseaseEmergencies` is the same day's red disease findings, from
// diseaseEmergenciesOn() in lib/diseaseDays.js — any one floors the band.
export function computeGeneralQolResult(entry, beap, species = null, diseaseEmergencies = []) {
  const functionScores = [
    scoreStoolOrHygiene(entry.scores.stool, entry.stoolSymptoms, { symptomPenalty: 5 }),
    scoreStoolOrHygiene(entry.scores.hygiene, entry.hygieneSymptoms, { symptomPenalty: 5 }),
    scoreVomiting(entry.vomiting),
    scoreUrination(entry.urination),
    scoreWaterIntake(entry.waterIntake),
    scoreSlider(entry.scores.vision),
    scoreSlider(entry.scores.hearing),
    scoreSlider(entry.scores.sleep),
    scoreFavouriteThings(entry.favouriteThings),
  ]

  const painScores = BEAP_CATEGORIES.map((category) => scoreBeapCategory(beap?.[category]))

  const scored = [...functionScores, ...painScores].filter((score) => score !== null)
  const total = scored.reduce((sum, score) => sum + score, 0)
  const max = scored.length * 10
  const averagePercent = max === 0 ? 0 : Math.round((total / max) * 100)

  // The band is whichever is worse: what the average alone suggests, the
  // floor imposed by the single worst BEAAAAPP finding, or the floor imposed
  // by an emergency pop-up answer.
  const averageBandIndex = generalQolBandIndexFromPercent(averagePercent)
  const bandIndex = Math.max(
    averageBandIndex,
    beapBandFloorIndex(beap),
    emergencyBandFloorIndex(entry, species),
    (diseaseEmergencies?.length ?? 0) > 0 ? BAND_INDEX_SEVERE_IMPACT : 0,
  )
  const band = GENERAL_QOL_BANDS[bandIndex]

  // The headline number is capped to the band, so the two always agree. When
  // no floor fired the average is already inside its band and is unchanged.
  const percent = Math.min(averagePercent, bandCeiling(bandIndex))

  return {
    total,
    max,
    percent,
    averagePercent,
    band: band.label,
    color: SEVERITY_COLORS[band.severity],
    // True when the worst BEAAAAPP finding or an emergency answer pulled the
    // band (and so the percentage) below what the average alone would have
    // given — lets the UI explain why.
    bandFlooredBySeverity: bandIndex > averageBandIndex,
  }
}

export const BEAP_CATEGORIES = [
  'breathing',
  'eyes',
  'ambulation',
  'activity',
  'appetite',
  'attitude',
  'posture',
  'palpation',
]

// Single source of truth for the 6 BEAAAAPP severity bands — shared by the
// per-category 0/2/4/6/8/10 option picker (indexed positionally) and the
// Feline Grimace Scale's summed 0–10 total (looked up by range via `max`,
// since a sum of five 0–2 sub-scores can land on any integer, not just the
// even values the picker itself ever produces).
export const BEAP_BANDS = [
  { max: 0, label: 'No abnormalities', shortLabel: 'None' },
  { max: 2, label: 'Mild (1–2)', shortLabel: 'Mild' },
  { max: 4, label: 'Moderate (3–4)', shortLabel: 'Moderate' },
  { max: 6, label: 'Moderate to severe (5–6)', shortLabel: 'Moderate–severe' },
  { max: 8, label: 'Severe (7–8)', shortLabel: 'Severe' },
  { max: 10, label: 'Very severe (9–10)', shortLabel: 'Very severe' },
]

export function bandColorForIndex(i) {
  if (i <= 1) return SEVERITY_COLORS.good
  if (i <= 3) return SEVERITY_COLORS.moderate
  return SEVERITY_COLORS.severe
}

export function beapBandIndexForScore(score) {
  const index = BEAP_BANDS.findIndex((band) => score <= band.max)
  return index === -1 ? BEAP_BANDS.length - 1 : index
}

// Unanswered categories are excluded rather than counted, matching
// computeGeneralQolResult's "exclude, don't penalise" rule. Without the
// filter, a null coerced to 0 ("no abnormalities") and silently understated
// the worst finding. Returns null when nothing has been answered at all,
// rather than Math.max()'s -Infinity for an empty list.
export function computeBeapWorst(beap) {
  if (!beap) return null

  const answered = BEAP_CATEGORIES
    .map((category) => beap[category])
    .filter((value) => value != null)

  return answered.length > 0 ? Math.max(...answered) : null
}

export function beapSeverityLabel(score) {
  return BEAP_BANDS[beapBandIndexForScore(score)].shortLabel
}

// Describes *why* the severity floor fired, for UI that needs to explain a
// band that looks inconsistent with a high percentage. Returns null when no
// floor was triggered.
//
// Only the categories at the single worst score are named — those are the
// ones that actually set the floor. If breathing is 10 and posture is 8,
// breathing alone determines the Severe floor (an 8 by itself would only
// reach Moderate), so naming posture too would overstate its part.
export function describeBeapSeverityFloor(beap) {
  const floorIndex = beapBandFloorIndex(beap)
  if (floorIndex === 0) return null

  const answered = BEAP_CATEGORIES
    .map((category) => beap[category])
    .filter((value) => value != null)
  const worst = Math.max(...answered)

  return {
    categories: BEAP_CATEGORIES.filter((category) => beap[category] === worst),
    worst,
    // 'Severe' (7-8) or 'Very severe' (9-10) — how the level was labelled
    // when the user picked it.
    severityLabel: beapSeverityLabel(worst),
    // 'Moderately reduced' or 'Severely reduced' — the band this floor
    // forces, whatever the average would otherwise have given.
    bandLabel: GENERAL_QOL_BANDS[floorIndex].label,
    ceiling: bandCeiling(floorIndex),
    color: SEVERITY_COLORS[GENERAL_QOL_BANDS[floorIndex].severity],
  }
}

// Describes the emergency-answer floor for the Review page, the same way
// describeBeapSeverityFloor() does for BEAAAAPP. Returns null when none of
// the three pop-up answers is present.
const EMERGENCY_FINDING_LABELS = {
  vomiting: 'blood in the vomit',
  urination: 'signs of a possible urinary blockage',
}

export function describeEmergencyFloor(entry, species = null) {
  const found = assessmentEmergencies(entry, species)
  if (found.length === 0) return null
  // The worst of the findings present sets the band the note names.
  const bandIndex = emergencyBandFloorIndex(entry, species)
  const band = GENERAL_QOL_BANDS[bandIndex]
  return {
    findings: found.map((key) => EMERGENCY_FINDING_LABELS[key]),
    bandLabel: band.label,
    ceiling: bandCeiling(bandIndex),
    color: SEVERITY_COLORS[band.severity],
  }
}

// The disease-monitoring floor, described for the Review page.
export function describeDiseaseFloor(diseaseEmergencies = []) {
  if (!diseaseEmergencies?.length) return null
  const band = GENERAL_QOL_BANDS[BAND_INDEX_SEVERE_IMPACT]
  return {
    conditions: [...new Set(diseaseEmergencies.map((item) => item.conditionLabel))],
    bandLabel: band.label,
    ceiling: bandCeiling(BAND_INDEX_SEVERE_IMPACT),
    color: SEVERITY_COLORS[band.severity],
  }
}

export function computeDiseaseInstrumentResult(scoresByDomain) {
  const values = Object.values(scoresByDomain).filter((v) => v !== 'unsure' && v != null)
  const total = values.reduce((sum, v) => sum + v, 0)
  const max = values.length * 10
  const percent = max === 0 ? 0 : Math.round((total / max) * 100)

  return {
    total,
    max,
    percent,
    color: severityColorFromPercent(percent),
  }
}

// Null-safe by design: an unanswered category returns null (excluded, shown
// as "no data") rather than a value. Previously `beap ? invert(beap.x) : null`
// only checked the beap object existed, so an unanswered category fell
// through to invert(null) -> 100 - (0/10)*100 -> a perfect 100% pillar.
function invert(value) {
  if (value == null) return null
  return 100 - (value / 10) * 100
}

// The 16 individual data points that the overall QoL average is built from,
// exposed one by one so a single measure can be charted on its own. The
// rolled-up pillars in computeOverviewCategories() deliberately blur several
// inputs together — useful for a summary, useless for "is the vomiting
// getting worse?", which is exactly the question an owner brings to a vet.
//
// Grouped only for the picker's benefit. Every key here scores 0-10 on the
// same higher-is-better scale as the average, and null when unanswered, so
// they can all share one axis without further conversion.
export const INDIVIDUAL_MEASURE_GROUPS = [
  {
    group: 'Everyday function',
    color: '#5C6F8A',
    measures: [
      { key: 'stool', label: 'Faeces' },
      { key: 'hygiene', label: 'Hygiene' },
      { key: 'vomiting', label: 'Vomiting' },
      { key: 'urination', label: 'Urination' },
      { key: 'waterIntake', label: 'Water intake' },
      { key: 'vision', label: 'Vision' },
      { key: 'hearing', label: 'Hearing' },
      { key: 'sleep', label: 'Sleep' },
      { key: 'favouriteThings', label: 'Favourite Things' },
    ],
  },
  {
    group: 'Pain and comfort',
    color: '#C97B8C',
    measures: [
      { key: 'breathing', label: 'Breathing' },
      { key: 'eyes', label: 'Eyes' },
      { key: 'ambulation', label: 'Mobility' },
      { key: 'activity', label: 'Activity' },
      { key: 'appetite', label: 'Appetite' },
      { key: 'attitude', label: 'Attitude' },
      { key: 'posture', label: 'Posture' },
      { key: 'palpation', label: 'Response to Touch' },
    ],
  },
]

export const INDIVIDUAL_MEASURES = INDIVIDUAL_MEASURE_GROUPS.flatMap((entry) =>
  entry.measures.map((measure) => ({ ...measure, group: entry.group, color: entry.color })),
)

export function individualMeasureByKey(key) {
  return INDIVIDUAL_MEASURES.find((measure) => measure.key === key) ?? null
}

// The eight function keys and the eight BEAAAAPP keys don't overlap, so this
// flattens to 16 distinct entries with no prefixing needed.
export function computeIndividualMeasures(entry, beap) {
  const fromEntry = entry
    ? {
        stool: scoreStoolOrHygiene(entry.scores?.stool, entry.stoolSymptoms, { symptomPenalty: 5 }),
        hygiene: scoreStoolOrHygiene(entry.scores?.hygiene, entry.hygieneSymptoms, { symptomPenalty: 5 }),
        // These three read fields straight off their sub-object, so a row
        // saved before the question existed (or a partial save) would throw
        // rather than score. Missing means unanswered, which is null — NOT
        // the 10 that `!vomiting.hasVomited` would otherwise produce.
        vomiting: entry.vomiting ? scoreVomiting(entry.vomiting) : null,
        urination: entry.urination ? scoreUrination(entry.urination) : null,
        waterIntake: entry.waterIntake ? scoreWaterIntake(entry.waterIntake) : null,
        vision: scoreSlider(entry.scores?.vision),
        hearing: scoreSlider(entry.scores?.hearing),
        sleep: scoreSlider(entry.scores?.sleep),
        favouriteThings: scoreFavouriteThings(entry.favouriteThings),
      }
    : {}

  const fromBeap = Object.fromEntries(
    BEAP_CATEGORIES.map((category) => [category, scoreBeapCategory(beap?.[category])]),
  )

  return { ...fromEntry, ...fromBeap }
}

// The five keys computeOverviewCategories() returns, and therefore the five
// series buildDailySeries() carries per day. Named here rather than only in
// WellbeingConcepts.jsx because two things outside the UI need the list: the
// condition page, which can only plot a referenced parameter from one of
// these, and the overlap check, which refuses a `reference` naming anything
// else. Must stay in step with the object returned below.
export const OVERVIEW_PILLAR_KEYS = ['comfort', 'appetite', 'sleep', 'curiosity', 'connection']

// The five wellbeing pillars.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Each pillar is the average
// (0-100) of the Overall Assessment answers that belong to it plus the same
// day's disease-monitoring answers mapped to it (lib/pillarMap.js). Any red
// answer in a pillar caps it at 49 — the same rule as the overall score.
//
// Until then Comfort was the single worst BEAAAAPP answer, and the other four
// were one assessment question each, so disease monitoring never reached the
// pillars at all.
//
//   Comfort     pain: breathing, eyes/face, ambulation, posture, palpation;
//               hygiene
//   Appetite    pain: appetite; vomiting, stool, urination, drinking
//   Sleep       sleep
//   Curiosity   pain: activity; vision, hearing, favourite things
//   Connection  pain: attitude
//
// `pillarAnswers` is [{ pillar, score, red }] from pillarAnswersOn() in
// lib/diseaseDays.js. A pillar with nothing answered is null ("no data").
const PILLAR_RED_CAP = 49

// What each pillar is made of, answer by answer: { comfort: [{ label,
// detail, score, red, source }], ... }. The home screen's pillar breakdown
// reads this; computeOverviewCategories averages it, so the two can never
// disagree about which answers pulled a pillar down.
export function computeOverviewBreakdown(latestGeneralEntry, latestPainEntry, pillarAnswers = [], species = null) {
  const beap = latestPainEntry?.beap ?? {}
  const entry = latestGeneralEntry
  const items = { comfort: [], appetite: [], sleep: [], curiosity: [], connection: [] }
  // `key` matches the row key in describeAssessmentDay() (lib/assessmentSummary.js),
  // so a screen can show the answer as it was given.
  const push = (pillar, label, score, red = false, detail = null, source = 'assessment', key = null) => {
    if (score == null || !Number.isFinite(score)) return
    items[pillar].push({ key, label, detail, score: Math.round(score), red, source })
  }
  // BEAAAAPP, 0 best .. 10 worst. 8 and above is red, matching the band floor.
  const pain = (pillar, category, label) => {
    const value = beap?.[category]
    if (value == null) return
    push(pillar, label, invert(value), value >= 8, beapSeverityLabel(value), 'assessment', `beap:${category}`)
  }
  // Everyday-function items, already 0-10 higher-is-better.
  const everyday = (pillar, label, score, red = false, key = label) => {
    if (score == null) return
    push(pillar, label, score * 10, red, null, 'assessment', key)
  }

  pain('comfort', 'breathing', 'Breathing')
  pain('comfort', 'eyes', species === 'cat' ? 'Eyes / Face' : 'Eyes')
  pain('comfort', 'ambulation', 'Mobility')
  pain('comfort', 'posture', 'Posture')
  pain('comfort', 'palpation', 'Response to Touch')
  pain('appetite', 'appetite', 'Appetite')
  pain('curiosity', 'activity', 'Activity')
  pain('connection', 'attitude', 'Attitude')

  if (entry) {
    const redFindings = new Set(assessmentEmergencies(entry, species))
    everyday('comfort', 'Hygiene', scoreStoolOrHygiene(entry.scores?.hygiene, entry.hygieneSymptoms ?? []), false,
      'Hygiene, coat quality and grooming')
    everyday('appetite', 'Vomiting', entry.vomiting ? scoreVomiting(entry.vomiting) : null, redFindings.has('vomiting'))
    everyday('appetite', entry.scores?.faecal != null ? 'Faecal Score' : 'Faeces',
      scoreStoolOrHygiene(entry.scores?.stool, entry.stoolSymptoms ?? []), false,
      entry.scores?.faecal != null ? 'Faecal score' : 'Faeces')
    everyday('appetite', 'Urination', entry.urination ? scoreUrination(entry.urination) : null, redFindings.has('urination'))
    everyday('appetite', 'Drinking', entry.waterIntake ? scoreWaterIntake(entry.waterIntake) : null)
    everyday('sleep', 'Sleep', scoreSlider(entry.scores?.sleep))
    everyday('curiosity', 'Vision', scoreSlider(entry.scores?.vision))
    everyday('curiosity', 'Hearing', scoreSlider(entry.scores?.hearing))
    everyday('curiosity', 'Favourite Things', scoreFavouriteThings(entry.favouriteThings))
  }

  for (const answer of pillarAnswers ?? []) {
    if (items[answer.pillar]) {
      push(answer.pillar, answer.label ?? 'Disease monitoring', answer.score, Boolean(answer.red),
        answer.detail ?? null, 'disease')
    }
  }
  return items
}

export function computeOverviewCategories(latestGeneralEntry, latestPainEntry, pillarAnswers = [], species = null) {
  const items = computeOverviewBreakdown(latestGeneralEntry, latestPainEntry, pillarAnswers, species)
  const pillar = (list) => {
    if (list.length === 0) return null
    const average = Math.round(list.reduce((sum, item) => sum + item.score, 0) / list.length)
    return list.some((item) => item.red) ? Math.min(average, PILLAR_RED_CAP) : average
  }

  return {
    comfort: pillar(items.comfort),
    appetite: pillar(items.appetite),
    sleep: pillar(items.sleep),
    curiosity: pillar(items.curiosity),
    connection: pillar(items.connection),
  }
}

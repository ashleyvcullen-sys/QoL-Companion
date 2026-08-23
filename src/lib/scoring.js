// Reference: QoLCompanion_Developer_Handoff.md, Section 4.

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
// "Minimal impact" and "Some impact" share the good/green colour, so green
// starts at 75% — matching the colour thresholds this app used before bands
// carried their own severity. Four bands, three colours. Note the *label*
// still distinguishes 90+ from 75-89 even though the colour doesn't.
//
// severityFromPercent() above is left alone: it's the generic
// percent-to-colour helper used for the 5 Overview pillar bars, which are a
// different measure on a different scale, and shouldn't be recoloured by a
// change to the overall-QoL banding.
const GENERAL_QOL_BANDS = [
  { min: 90, label: 'Minimal impact', severity: SEVERITY.GOOD },
  { min: 75, label: 'Some impact', severity: SEVERITY.GOOD },
  { min: 50, label: 'Moderate impact', severity: SEVERITY.MODERATE },
  { min: 0, label: 'Severe impact', severity: SEVERITY.SEVERE },
]

const BAND_INDEX_MODERATE_IMPACT = 2
const BAND_INDEX_SEVERE_IMPACT = 3

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
// "Minimal impact". This floor stops the headline band from reading better
// than the worst single finding justifies, mirroring how triage works:
// urgency is set by the worst problem, not the mean of all of them.
//
// The percentage itself is deliberately left untouched — only the band and
// its colour are floored, so the underlying average stays honest and
// comparable over time.
function beapBandFloorIndex(beap) {
  if (!beap) return 0

  const answered = BEAP_CATEGORIES
    .map((category) => beap[category])
    .filter((value) => value != null)
  if (answered.length === 0) return 0

  const worst = Math.max(...answered)
  // >= 9 rather than == 10 so the floor tier lines up with the band labels
  // BEAP_BANDS uses: 7-8 is "Severe", 9-10 is "Very severe". Only the
  // Feline Grimace Scale can produce an odd score (it sums five 0-2 action
  // units); every other category uses the even-only 0/2/4/6/8/10 picker and
  // so can never land on 9. Without this, a cat scoring 9 on Eyes/Face read
  // as "marked Very severe ... reflects a Moderate impact", which looks
  // self-contradictory even though both halves were correct.
  if (worst >= 9) return BAND_INDEX_SEVERE_IMPACT
  if (worst >= 8) return BAND_INDEX_MODERATE_IMPACT
  return 0
}

const VOMIT_DAILY_THRESHOLD = 2
const VOMIT_WEEKLY_THRESHOLD = 5

function scoreSlider(value) {
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
function scoreStoolOrHygiene(value, symptoms, { symptomPenalty = 5 } = {}) {
  // 'none' is stool-only ("No faeces today") — like 'unsure', there's no
  // quality to score, so it's excluded from the average rather than
  // penalized or treated as a perfect score.
  if (value === 'unsure' || value === 'none') return null
  const penalty = symptoms.length > 0 ? symptomPenalty : 0
  return Math.max(0, value - penalty)
}

function scoreVomiting(vomiting) {
  if (vomiting.hasVomited === 'unsure') return null
  if (!vomiting.hasVomited) return 10
  const frequency = Number(vomiting.frequency)
  const exceedsThreshold = !Number.isNaN(frequency) && (
    (vomiting.unit === 'times/day' && frequency > VOMIT_DAILY_THRESHOLD) ||
    (vomiting.unit === 'times/week' && frequency >= VOMIT_WEEKLY_THRESHOLD)
  )
  return exceedsThreshold ? 0 : 5
}

function scoreUrination(urination) {
  if (urination.status === 'unsure') return null
  if (urination.status === 'normal') return 10
  return urination.symptoms.length > 0 ? 0 : 5
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
export function computeGeneralQolResult(entry, beap) {
  const functionScores = [
    scoreStoolOrHygiene(entry.scores.stool, entry.stoolSymptoms, { symptomPenalty: 5 }),
    scoreStoolOrHygiene(entry.scores.hygiene, entry.hygieneSymptoms, { symptomPenalty: 5 }),
    scoreVomiting(entry.vomiting),
    scoreUrination(entry.urination),
    scoreWaterIntake(entry.waterIntake),
    scoreSlider(entry.scores.vision),
    scoreSlider(entry.scores.hearing),
    scoreSlider(entry.scores.sleep),
  ]

  const painScores = BEAP_CATEGORIES.map((category) => scoreBeapCategory(beap?.[category]))

  const scored = [...functionScores, ...painScores].filter((score) => score !== null)
  const total = scored.reduce((sum, score) => sum + score, 0)
  const max = scored.length * 10
  const percent = max === 0 ? 0 : Math.round((total / max) * 100)

  // The band is whichever is worse: what the average alone suggests, or the
  // floor imposed by the single worst BEAAAAPP finding.
  const bandIndex = Math.max(
    generalQolBandIndexFromPercent(percent),
    beapBandFloorIndex(beap),
  )
  const band = GENERAL_QOL_BANDS[bandIndex]

  return {
    total,
    max,
    percent,
    band: band.label,
    color: SEVERITY_COLORS[band.severity],
    // True when the worst BEAAAAPP finding pulled the band below what the
    // average alone would have given — lets the UI explain the discrepancy
    // rather than looking simply inconsistent.
    bandFlooredBySeverity: bandIndex > generalQolBandIndexFromPercent(percent),
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
    // 'Moderate impact' or 'Severe impact' — the band this forces.
    impactLabel: GENERAL_QOL_BANDS[floorIndex].label,
    color: SEVERITY_COLORS[GENERAL_QOL_BANDS[floorIndex].severity],
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
      { key: 'stool', label: 'Stool' },
      { key: 'hygiene', label: 'Hygiene' },
      { key: 'vomiting', label: 'Vomiting' },
      { key: 'urination', label: 'Urination' },
      { key: 'waterIntake', label: 'Water intake' },
      { key: 'vision', label: 'Vision' },
      { key: 'hearing', label: 'Hearing' },
      { key: 'sleep', label: 'Sleep' },
    ],
  },
  {
    group: 'Pain and comfort',
    color: '#C97B8C',
    measures: [
      { key: 'breathing', label: 'Breathing' },
      { key: 'eyes', label: 'Eyes' },
      { key: 'ambulation', label: 'Ambulation' },
      { key: 'activity', label: 'Activity' },
      { key: 'appetite', label: 'Appetite' },
      { key: 'attitude', label: 'Attitude' },
      { key: 'posture', label: 'Posture' },
      { key: 'palpation', label: 'Palpation' },
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
      }
    : {}

  const fromBeap = Object.fromEntries(
    BEAP_CATEGORIES.map((category) => [category, scoreBeapCategory(beap?.[category])]),
  )

  return { ...fromEntry, ...fromBeap }
}

export function computeOverviewCategories(latestGeneralQolEntry, latestPainLogEntry) {
  const beap = latestPainLogEntry?.beap
  // A stored beapWorst of null is a real "nothing answered" rather than a
  // missing field, so only fall back to recomputing when it's absent
  // entirely (?? handles null/undefined identically, hence the explicit
  // 'beapWorst' in check).
  const hasStoredWorst =
    latestPainLogEntry != null && 'beapWorst' in latestPainLogEntry && latestPainLogEntry.beapWorst != null
  const beapWorst = hasStoredWorst ? latestPainLogEntry.beapWorst : computeBeapWorst(beap)
  const sleepScore = latestGeneralQolEntry?.scores?.sleep

  return {
    comfort: invert(beapWorst),
    appetite: invert(beap?.appetite),
    sleep: typeof sleepScore === 'number' ? sleepScore * 10 : null,
    curiosity: invert(beap?.activity),
    connection: invert(beap?.attitude),
  }
}

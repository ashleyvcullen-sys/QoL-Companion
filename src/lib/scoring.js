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
// can't drift apart. Previously the label came from these thresholds while
// the colour came independently from severityFromPercent()'s 75/50 cutoffs,
// which meant 75-89% rendered the green "good" colour next to the words
// "Some impact". Note "Some impact" and "Moderate impact" deliberately
// share the moderate colour — there are four bands but only three severity
// colours, and only "Minimal impact" should read as unqualified good.
//
// severityFromPercent() above is left alone: it's the generic
// percent-to-colour helper used for the 5 Overview pillar bars, which are a
// different measure on a different scale, and shouldn't be recoloured by a
// change to the overall-QoL banding.
const GENERAL_QOL_BANDS = [
  { min: 90, label: 'Minimal impact', severity: SEVERITY.GOOD },
  { min: 75, label: 'Some impact', severity: SEVERITY.MODERATE },
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
  if (worst >= 10) return BAND_INDEX_SEVERE_IMPACT
  if (worst >= 8) return BAND_INDEX_MODERATE_IMPACT
  return 0
}

const VOMIT_DAILY_THRESHOLD = 2
const VOMIT_WEEKLY_THRESHOLD = 5

function scoreSlider(value) {
  return value === 'unsure' ? null : value
}

function scoreStoolOrHygiene(value, symptoms, { perSymptomPenalty, flatPenalty } = {}) {
  // 'none' is stool-only ("No faeces today") — like 'unsure', there's no
  // quality to score, so it's excluded from the average rather than
  // penalized or treated as a perfect score.
  if (value === 'unsure' || value === 'none') return null
  const penalty = flatPenalty != null
    ? (symptoms.length > 0 ? flatPenalty : 0)
    : symptoms.length * perSymptomPenalty
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
    scoreStoolOrHygiene(entry.scores.stool, entry.stoolSymptoms, { flatPenalty: 5 }),
    scoreStoolOrHygiene(entry.scores.hygiene, entry.hygieneSymptoms, { perSymptomPenalty: 5 }),
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

export function computeBeapWorst(beap) {
  return Math.max(...BEAP_CATEGORIES.map((category) => beap[category]))
}

export function beapSeverityLabel(score) {
  return BEAP_BANDS[beapBandIndexForScore(score)].shortLabel
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

function invert(value) {
  return 100 - (value / 10) * 100
}

export function computeOverviewCategories(latestGeneralQolEntry, latestPainLogEntry) {
  const beap = latestPainLogEntry?.beap
  const beapWorst = latestPainLogEntry?.beapWorst ?? (beap ? computeBeapWorst(beap) : null)
  const sleepScore = latestGeneralQolEntry?.scores?.sleep

  return {
    comfort: beapWorst != null ? invert(beapWorst) : null,
    appetite: beap ? invert(beap.appetite) : null,
    sleep: typeof sleepScore === 'number' ? sleepScore * 10 : null,
    curiosity: beap ? invert(beap.activity) : null,
    connection: beap ? invert(beap.attitude) : null,
  }
}

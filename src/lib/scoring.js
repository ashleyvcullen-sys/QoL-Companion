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

const GENERAL_QOL_BANDS = [
  { min: 90, label: 'Minimal impact' },
  { min: 75, label: 'Some impact' },
  { min: 50, label: 'Moderate impact' },
  { min: 0, label: 'Severe impact' },
]

export function generalQolBandFromPercent(percent) {
  return GENERAL_QOL_BANDS.find((band) => percent >= band.min).label
}

const VOMIT_DAILY_THRESHOLD = 2
const VOMIT_WEEKLY_THRESHOLD = 5

function scoreSlider(value) {
  return value === 'unsure' ? null : value
}

function scoreStoolOrHygiene(value, symptoms, { perSymptomPenalty, flatPenalty } = {}) {
  if (value === 'unsure') return null
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

export function computeGeneralQolResult(entry) {
  const sectionScores = [
    scoreStoolOrHygiene(entry.scores.stool, entry.stoolSymptoms, { flatPenalty: 5 }),
    scoreStoolOrHygiene(entry.scores.hygiene, entry.hygieneSymptoms, { perSymptomPenalty: 5 }),
    scoreVomiting(entry.vomiting),
    scoreUrination(entry.urination),
    scoreWaterIntake(entry.waterIntake),
    scoreSlider(entry.scores.vision),
    scoreSlider(entry.scores.hearing),
    scoreSlider(entry.scores.sleep),
  ]

  const scored = sectionScores.filter((score) => score !== null)
  const total = scored.reduce((sum, score) => sum + score, 0)
  const max = scored.length * 10
  const percent = max === 0 ? 0 : Math.round((total / max) * 100)

  return {
    total,
    max,
    percent,
    band: generalQolBandFromPercent(percent),
    color: severityColorFromPercent(percent),
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

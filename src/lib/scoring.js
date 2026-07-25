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

const BEAP_SEVERITY_LABELS = {
  0: 'None',
  2: 'Mild',
  4: 'Moderate',
  6: 'Moderate–severe',
  8: 'Severe',
  10: 'Very severe',
}

export function computeBeapWorst(beap) {
  return Math.max(...BEAP_CATEGORIES.map((category) => beap[category]))
}

export function beapSeverityLabel(score) {
  return BEAP_SEVERITY_LABELS[score]
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

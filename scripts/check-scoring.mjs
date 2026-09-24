// The overall score, pinned.
//
// Since 24 Sep 2026 four separate things can hold a day's score down — the
// worst BEAAAAPP category, an emergency answer, a disease finding, and body
// condition — and they interact. Nothing was checking that but a human
// running a script by hand, which is not a check.
//
// Every case below is one Ash approved. If a constant moves, this fails and
// names the case, which is the point: the number in this app is the number a
// vet reads in a consult, and it must not change by accident.
//
//   node --import ./scripts/register-audit-loader.mjs scripts/check-scoring.mjs
import { computeGeneralQolResult } from '../src/lib/scoring.js'

// A day that scores 85% on the seventeen items alone: good, not perfect.
const GOOD_DAY = {
  scores: { stool: 9, faecal: 2.5, hygiene: 9, vision: 9, hearing: 8, sleep: 8 },
  stoolSymptoms: [],
  hygieneSymptoms: [],
  vomiting: { happened: false, symptoms: [] },
  urination: { normal: true, symptoms: [] },
  waterIntake: { normal: true, symptoms: [] },
  favouriteThings: [{ answer: 'usual' }, { answer: 'usual' }, { answer: 'less' }],
}
const GOOD_BEAP = {
  breathing: 0, eyes: 0, ambulation: 2, activity: 2,
  appetite: 0, attitude: 0, pain: 2, posture: 2,
}

// And one that scores 94%: everything at its best.
const PERFECT_DAY = {
  ...GOOD_DAY,
  scores: { stool: 10, faecal: 2.5, hygiene: 10, vision: 10, hearing: 10, sleep: 10 },
  favouriteThings: [{ answer: 'usual' }, { answer: 'usual' }, { answer: 'usual' }],
}
const PERFECT_BEAP = {
  breathing: 0, eyes: 0, ambulation: 0, activity: 0,
  appetite: 0, attitude: 0, pain: 0, posture: 0,
}

const CASES = [
  // [ name, day, beap, influences, expected percent, expected band ]
  ['a good day, nothing else recorded', GOOD_DAY, GOOD_BEAP, {}, 85, 'Mildly reduced'],
  ['a perfect day, nothing else recorded', PERFECT_DAY, PERFECT_BEAP, {}, 94, 'Good'],

  // Disease findings. One amber caps at 89, two or more at 74, an urgent one
  // at 49 — Ash's instruction 24 Sep 2026.
  ['one amber finding cannot pull a day below its own band', GOOD_DAY, GOOD_BEAP,
    { diseaseConcerns: [{ conditionLabel: 'Arthritis' }] }, 85, 'Mildly reduced'],
  ['one amber finding caps a perfect day at 89', PERFECT_DAY, PERFECT_BEAP,
    { diseaseConcerns: [{ conditionLabel: 'Arthritis' }] }, 89, 'Mildly reduced'],
  ['two amber findings cap at 74', PERFECT_DAY, PERFECT_BEAP,
    { diseaseConcerns: [{ conditionLabel: 'Arthritis' }, { conditionLabel: 'Allergies' }] }, 74, 'Moderately reduced'],
  ['an urgent finding caps at 49', PERFECT_DAY, PERFECT_BEAP,
    { diseaseEmergencies: [{ conditionLabel: 'Kidney Disease' }] }, 49, 'Severely reduced'],

  // Body condition. 4-5 ideal; 3 only when it has fallen; 6-7 amber; 1, 2,
  // 8 and 9 red; nothing older than 30 days counts at all.
  ['an ideal body condition changes nothing', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 5, daysAgo: 3, previousScore: 5 } }, 85, 'Mildly reduced'],
  ['a pet that has always been a 3 is left alone', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 3, daysAgo: 4, previousScore: 3 } }, 85, 'Mildly reduced'],
  ['a 3 that used to be a 5 caps at 74', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 3, daysAgo: 4, previousScore: 5 } }, 74, 'Moderately reduced'],
  ['a 7 caps at 74', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 7, daysAgo: 4, previousScore: 7 } }, 74, 'Moderately reduced'],
  ['a 2 caps at 49', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 2, daysAgo: 4, previousScore: 3 } }, 49, 'Severely reduced'],
  ['a 9 caps at 49', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 9, daysAgo: 4, previousScore: 8 } }, 49, 'Severely reduced'],
  ['a reading older than 30 days does not count', GOOD_DAY, GOOD_BEAP,
    { bodyCondition: { score: 2, daysAgo: 45, previousScore: 3 } }, 85, 'Mildly reduced'],

  // The worst floor wins, and only one of them.
  ['the worst of several floors is the one that applies', GOOD_DAY, GOOD_BEAP,
    {
      diseaseConcerns: [{ conditionLabel: 'Arthritis' }],
      diseaseEmergencies: [{ conditionLabel: 'Kidney Disease' }],
      bodyCondition: { score: 7, daysAgo: 2, previousScore: 7 },
    }, 49, 'Severely reduced'],
]

let failures = 0
for (const [name, day, beap, influences, expectedPercent, expectedBand] of CASES) {
  const result = computeGeneralQolResult(
    day, beap, 'dog', influences.diseaseEmergencies ?? [], influences,
  )
  const ok = result.percent === expectedPercent && result.band === expectedBand
  if (!ok) {
    failures += 1
    console.error(`  ✗ ${name}`)
    console.error(`      expected ${expectedPercent}% ${expectedBand}`)
    console.error(`      got      ${result.percent}% ${result.band}`)
  }
}

// A capped day has to be able to say what capped it — the home card prints
// this, and a number nobody can account for is the thing it exists to stop.
const capped = computeGeneralQolResult(PERFECT_DAY, PERFECT_BEAP, 'dog', [], {
  diseaseConcerns: [{ conditionLabel: 'Arthritis' }],
})
if (!capped.capReason || !capped.capReason.includes('Arthritis')) {
  failures += 1
  console.error('  ✗ a capped day names what capped it')
  console.error(`      got ${JSON.stringify(capped.capReason)}`)
}
const uncapped = computeGeneralQolResult(GOOD_DAY, GOOD_BEAP, 'dog', [], {})
if (uncapped.capReason !== null) {
  failures += 1
  console.error('  ✗ a day that was not capped says nothing')
  console.error(`      got ${JSON.stringify(uncapped.capReason)}`)
}

if (failures > 0) {
  console.error(`\nScoring check FAILED — ${failures} case(s) do not score as approved.`)
  process.exit(1)
}

console.log(`Scoring check passed — ${CASES.length + 2} cases, every one as approved.`)

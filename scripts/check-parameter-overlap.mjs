// Fails when a condition question quietly measures something the daily
// wellbeing assessment already measures.
//
// Heart Disease used to ask the BEAAAAPP appetite scale a second time. An
// owner whose dog had heart disease and a mast cell tumour graded appetite
// three times before breakfast, on three forms free to disagree with each
// other, and nobody noticed for months — because nothing was watching for it.
// This is the thing that watches for it.
//
// It does NOT decide whether an overlap is wrong. Plenty are right: a cough
// is not breathing effort, and a cat who cannot reach round to groom is a
// different question to a cat who is dirty. What it insists on is that the
// overlap was NOTICED — that whoever added the parameter wrote down which
// daily measure it touches (`covers`) and what they decided to do about it
// (`relationship`). The reasoning itself belongs in a comment above the
// parameter, where a reader will actually find it.
//
// Run it with `npm run check:overlap`. `npm run build` runs it first.

import { CONDITIONS, RELATIONSHIP } from '../src/lib/conditions.js'
import {
  CORE_PARAMETERS,
  LUMP_MEASURES,
  NODE_MEASURES,
  SIGN_MODULES,
  TREATMENT_MODULES,
} from '../src/lib/cancerModules.js'
import {
  INDIVIDUAL_MEASURES,
  OVERVIEW_PILLAR_KEYS,
  computeOverviewCategories,
} from '../src/lib/scoring.js'

// --- what counts as touching a daily measure -------------------------------
//
// Deliberately crude, and deliberately over-eager: the cost of a false
// positive is one line of declaration on a parameter that turns out to be
// unrelated, and the cost of a false negative is another duplicated question
// shipping unnoticed. Widen these rather than narrowing them.
//
// A parameter may match more than one domain — "Walks" is both ambulation and
// activity — and declaring any one of the matches is enough.
const DOMAIN_HINTS = [
  ['appetite', /appetit|inappet|eating|food|hungr|anorex/],
  ['vomiting', /vomit/],
  ['stool', /stool|diarrh|faec/],
  ['urination', /urin|litter|toilet/],
  ['waterIntake', /drink|water|thirst/],
  ['breathing', /breath|respirat|pant|cough/],
  ['ambulation', /ambulat|mobilit|walk|jump|stiff|lame|limp|weight.bearing|getting about/],
  ['activity', /activit|energy|lethargy|exercise|play|walk/],
  ['attitude', /attitude|behaviour|demeanour|in.himself|quiet|withdraw/],
  ['palpation', /palpation|touch/],
  ['hygiene', /groom|hygiene|matted/],
  ['sleep', /sleep/],
  ['eyes', /\beyes?\b/],
  ['posture', /posture|hunch/],
  ['vision', /vision|sight|blind/],
  ['hearing', /hearing|deaf/],
]

const MEASURE_KEYS = new Set(INDIVIDUAL_MEASURES.map((measure) => measure.key))
const RELATIONSHIPS = new Set(Object.values(RELATIONSHIP))

function domainsFor(parameter) {
  const text = `${parameter.key ?? ''} ${parameter.label ?? ''}`.toLowerCase()
  return DOMAIN_HINTS.filter(([, pattern]) => pattern.test(text)).map(([domain]) => domain)
}

// --- every parameter in the app --------------------------------------------
//
// Follow-ups are deliberately left out. They are not questions in their own
// right — they only appear once their parent has been answered a particular
// way, and they inherit its subject. "What have you noticed?" under exercise
// tolerance is not a second activity question.
const parameters = []

function collect(where, list = []) {
  for (const parameter of list) {
    if (parameter?.key) parameters.push({ where, parameter })
  }
}

for (const condition of Object.values(CONDITIONS)) {
  collect(condition.label, condition.parameters)
}

// Cancer's list is composed per pet, so there is no single array to read. The
// pieces it is composed FROM are what get checked — which also catches a
// module no pet happens to have selected yet.
collect('Cancer — core', CORE_PARAMETERS)
for (const module of Object.values(SIGN_MODULES)) {
  collect(`Cancer — ${module.label}`, module.parameters)
}
for (const module of Object.values(TREATMENT_MODULES)) {
  collect(`Cancer — ${module.label}`, module.parameters)
}
collect('Cancer — lump measurements', LUMP_MEASURES)
collect('Cancer — lymph node measurements', NODE_MEASURES)

// --- the checks ------------------------------------------------------------
const errors = []
const warnings = []

// The five pillar keys are named in scoring.js but produced by a function, so
// check the list has not drifted from what the function actually returns
// before trusting it to validate anything else.
const producedPillars = Object.keys(computeOverviewCategories(null, null))
const missingPillars = producedPillars.filter((key) => !OVERVIEW_PILLAR_KEYS.includes(key))
const extraPillars = OVERVIEW_PILLAR_KEYS.filter((key) => !producedPillars.includes(key))
if (missingPillars.length || extraPillars.length) {
  errors.push(
    `OVERVIEW_PILLAR_KEYS is out of step with computeOverviewCategories(): `
    + `missing ${JSON.stringify(missingPillars)}, extra ${JSON.stringify(extraPillars)}`,
  )
}

for (const { where, parameter } of parameters) {
  const at = `${where} → ${parameter.key}`
  const { covers, relationship } = parameter
  const domains = domainsFor(parameter)

  if (relationship && !RELATIONSHIPS.has(relationship)) {
    errors.push(`${at}: relationship '${relationship}' is not one of ${[...RELATIONSHIPS].join(', ')}`)
    continue
  }

  if (relationship && !covers) {
    errors.push(`${at}: declares relationship '${relationship}' but no 'covers'`)
    continue
  }

  if (covers && !relationship) {
    errors.push(`${at}: declares covers '${covers}' but no 'relationship'`)
    continue
  }

  if (covers && !MEASURE_KEYS.has(covers)) {
    errors.push(`${at}: covers '${covers}', which is not a measure in INDIVIDUAL_MEASURES`)
    continue
  }

  // The one that catches the actual mistake: a new parameter that reads like
  // a daily measure and says nothing about it.
  if (domains.length && !relationship) {
    errors.push(
      `${at} ("${parameter.label}") looks like the daily assessment's `
      + `${domains.join(' / ')} question but declares no relationship to it.\n`
      + `      Add covers + relationship (reference | supersedes | distinct), and a comment saying why.`,
    )
    continue
  }

  // A reference is charted from buildDailySeries(), which only carries the
  // five overview pillars. Anything else would leave the condition page with
  // a question removed and no chart put in its place.
  if (relationship === RELATIONSHIP.REFERENCE && !OVERVIEW_PILLAR_KEYS.includes(covers)) {
    errors.push(
      `${at}: references '${covers}', which the daily series does not carry. `
      + `A reference can only name one of: ${OVERVIEW_PILLAR_KEYS.join(', ')}`,
    )
    continue
  }

  if (covers && domains.length && !domains.includes(covers)) {
    warnings.push(`${at}: declares covers '${covers}'; reads more like ${domains.join(' / ')}`)
  }
}

// --- report ----------------------------------------------------------------
for (const warning of warnings) console.warn(`  warn  ${warning}`)

if (errors.length) {
  console.error(`\n${errors.length} undeclared or invalid overlap${errors.length === 1 ? '' : 's'}:\n`)
  for (const error of errors) console.error(`  ✗  ${error}`)
  console.error('\nSee the "Overlap with the daily assessment" note at the top of src/lib/conditions.js.\n')
  process.exit(1)
}

const declared = parameters.filter(({ parameter }) => parameter.relationship).length
console.log(
  `Parameter overlap check passed — ${parameters.length} parameters, `
  + `${declared} declaring a relationship to the daily assessment`
  + `${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`,
)

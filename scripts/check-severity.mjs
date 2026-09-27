// Which disease scales can go red, pinned.
//
// Ash's decision 27 Sep 2026: severe and very severe are red on a disease
// scale and cap quality of life at Severely reduced — but only where an
// emergency message exists, because a finding the app cannot advise on is
// not one it should be calling an emergency. See emergencyFromFor().
//
// The risk that creates is silent: add a parameter, forget the message, and
// it quietly can never go red however bad the answer. So the exempt set is
// written down here and asserted. A new exemption is then a decision someone
// made on purpose rather than one nobody noticed.
//
//   node --import ./scripts/register-audit-loader.mjs scripts/check-severity.mjs
import { CONDITION_LIST, emergencyFromFor } from '../src/lib/conditions.js'
import { CORE_PARAMETERS, SIGN_MODULE_LIST, TREATMENT_MODULE_LIST } from '../src/lib/cancerModules.js'
import { GI_CORE_PARAMETERS, GI_MODULE_LIST } from '../src/lib/giModules.js'

// APPROVED — Dr Ash Cullen (BSc, DVM), 27 Sep 2026. Scales that do NOT cap.
// The six dementia parameters, whose severe rungs are the steady state of the
// disease rather than an event, and arthritis grooming — a welfare marker,
// not something to ring anyone about.
const EXEMPT = new Set([
  'cognitive:disorientation',
  'cognitive:interactions',
  'cognitive:sleep_wake',
  'cognitive:house_soiling',
  'cognitive:activity_changes',
  'cognitive:anxiety',
  'arthritis:grooming',

  // PENDING ASH. Caught by this check the first time it ran, which is what it
  // is for. "Frequent accidents indoors, with little or no warning" and "no
  // control at all — faecal incontinence" are severe, but they are a loss of
  // continence rather than an event to ring about, and the parameter carries
  // no emergency message to show. Exempt for now so the rule holds; Ash to
  // confirm whether GI urgency should cap or stay amber.
  'gastrointestinal:urgency',
])

const seen = new Map()
function walk(params, conditionKey) {
  for (const parameter of params ?? []) {
    if (parameter?.type === 'scale') {
      const id = `${conditionKey}:${parameter.key}`
      if (!seen.has(id)) seen.set(id, emergencyFromFor(parameter, 'dog') != null)
    }
    walk(parameter?.followUps, conditionKey)
  }
}

for (const condition of CONDITION_LIST) walk(condition.parameters, condition.key)
walk(CORE_PARAMETERS, 'cancer')
for (const module of [...SIGN_MODULE_LIST, ...TREATMENT_MODULE_LIST]) walk(module.parameters, 'cancer')
walk(GI_CORE_PARAMETERS, 'gastrointestinal')
for (const module of GI_MODULE_LIST) walk(module.parameters, 'gastrointestinal')

const exempt = [...seen].filter(([, caps]) => !caps).map(([id]) => id).sort()
const unexpected = exempt.filter((id) => !EXEMPT.has(id))
const stale = [...EXEMPT].filter((id) => !exempt.includes(id)).sort()

if (unexpected.length > 0) {
  console.error('\nThese disease scales cannot go red, and are not approved exemptions:\n')
  for (const id of unexpected) console.error(`  ${id}`)
  console.error('\nEither give the parameter an emergencyMessage — the severe rungs then cap')
  console.error('quality of life at Severely reduced — or add it to EXEMPT here with a reason.')
  process.exit(1)
}

if (stale.length > 0) {
  console.error('\nThese are listed as exempt but now cap after all:\n')
  for (const id of stale) console.error(`  ${id}`)
  console.error('\nRemove them from EXEMPT if that is intended.')
  process.exit(1)
}

console.log(
  `Severity check passed — ${seen.size} disease scales, ${seen.size - exempt.length} capping at Severely reduced, ${exempt.length} exempt as approved.`,
)

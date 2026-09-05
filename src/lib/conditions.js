// Condition monitoring definitions.
//
// ============================================================================
// THIS IS THE FILE TO EDIT. Everything a condition needs — its name, what
// gets logged, wording, units, thresholds, what counts as an emergency —
// lives here as plain data. Adding a condition, adding a parameter, or
// changing wording is an edit to this file alone.
// ============================================================================
//
// CLINICAL CONTENT: written and signed off by Dr Ash Cullen (BSc, DVM), 23 Aug 2026.
// Anything added later that has NOT been through her must be marked PENDING.
//
// Parameter `type` values the UI knows how to render. Every type also offers
// "Not sure", stored as the string 'unsure' and never treated as an answer.
//
//   'number'  — numeric input. Uses unit, min, max, step, and concernAbove /
//               concernBelow, each of which may be a plain number or an
//               object keyed by species.
//   'beap'    — reuses a BEAAAAPP category's six levels via `beapKey`, so the
//               wording lives in beapScales.js and cannot drift from the main
//               assessment. Automatically species-correct.
//   'choice'  — one of `options`, each with a `severity` of 'ok' | 'concern'
//               | 'emergency'.
//   'yesno'   — Yes / No. `emergencyWhen` or `concernWhen` names the answer
//               that matters.
//   'text'    — a free-text box. No "Not sure" chip: the owner can write it.
//   'date'    — a day that has already happened. Stored ISO, shown
//               DD/MM/YYYY, and never scored. `showElapsed` adds "started 6
//               weeks ago" underneath, for the questions where the elapsed
//               time is the point of asking.
//
// A parameter may carry `dependsOn: { key, equals }` or
// `dependsOn: { key, equalsAny: [...] }`, and is only asked when it is met —
// see visibleParameters, which resolves the whole chain rather than one step.
//
// Any parameter may carry a `followUp`, or several as `followUps`. Each is
// shown only when the parent answer matches `when` (one exact answer),
// `whenAny` (any of several) or `whenAtLeast` (a score at or above a
// threshold) — or always, with `always: true`, for the ones that are really
// part of the question rather than a reaction to its answer.
//
// Follow-up answers are stored under their own key. Read the list with
// followUpsOf() rather than either field directly, so a parameter written
// with one and a parameter written with three behave identically everywhere.

// Imported as named components rather than built here: this file is .js, and
// Vite does not transform JSX in a .js file.
import {
  AllergyOrganIcon,
  BoneOrganIcon,
  CancerOrganIcon,
  CognitiveOrganIcon,
  GutOrganIcon,
  HeartOrganIcon,
  KidneyOrganIcon,
  SeizureOrganIcon,
} from '../components/icons/OrganIcon'
import { BEAP_SCALES, SLEEP_SCALE } from './beapScales'
import { SLEEP_NOTES } from './assessmentOptions'
import { referenceText } from './references'
import { formatDateDDMMYY, isIsoDate } from './formatDate'

export const SEVERITY = { OK: 'ok', CONCERN: 'concern', EMERGENCY: 'emergency' }

export const UNSURE = 'unsure'

// "This doesn't apply" — distinct from "I'm not sure".
//
// Feline lymphoma is why this exists: a cat with lymphoma often has lymph
// nodes you cannot feel at all, and an owner asked to measure one has a
// third honest answer beyond a number and a shrug. Recording that as UNSURE
// would file a normal, expected finding as uncertainty.
//
// Like UNSURE it is excluded from scoring and from charts — there is no
// number to plot — but it is stored, so "not enlarged today" stays in the
// record rather than looking like a question nobody answered.
export const NOT_APPLICABLE = 'na'

// --- Overlap with the daily assessment -------------------------------------
//
// Several condition questions measure something the daily wellbeing
// assessment already measures. Sometimes that is duplication: Heart Disease
// asked the BEAAAAPP appetite scale a second time, so an owner graded
// appetite twice on the same day — three times if the pet also had cancer —
// and nothing stopped the answers disagreeing. Sometimes the overlap is
// deliberate and worth keeping: a cough is not breathing effort, and a cat
// who cannot turn round to groom is not the same question as a cat who is
// dirty.
//
// The rule is that no overlap gets to be undeclared. A parameter that touches
// a daily measure names it in `covers` and says what it is doing about it in
// `relationship`:
//
//   reference   Not asked here at all. The daily assessment's answer stands
//               for this condition's.
//   supersedes  Asked here, in more detail or in a context the daily
//               assessment does not cover. Both answers are kept; neither is
//               derived from the other.
//   distinct    A genuinely different question that happens to sit in the
//               same domain. The comment above it has to say how — `why` is
//               owner-facing text and is not the place for it.
//
// NOTHING USES `reference` RIGHT NOW, and anything that did would be
// invisible. Its whole point was that the condition still SHOWED the measure
// by charting the daily assessment's series — so when charts left the
// condition pages (29 Aug 2026, Ash's call: calendars here, trends in
// Overall Quality of Life), a referenced parameter stopped producing
// anything at all. It is not asked, not summarised, not drawn. Heart
// Disease's appetite was the only one and has been deleted.
//
// Left in the vocabulary because the decision it records is still a real one
// — "the daily assessment already asks this, so we do not" — and the overlap
// check accepts it as an answer. But do not reach for it expecting the owner
// to see anything.
//
// The other two are declarations only. They exist so
// scripts/check-parameter-overlap.mjs can fail when a NEW parameter quietly
// overlaps a daily measure and says nothing about it, which is exactly how
// the appetite duplication got in.
//
// `covers` names a key from INDIVIDUAL_MEASURES in scoring.js. A `reference`
// additionally has to name one of OVERVIEW_PILLAR_KEYS — the check still
// enforces that, and it costs nothing to keep.
export const RELATIONSHIP = {
  REFERENCE: 'reference',
  SUPERSEDES: 'supersedes',
  DISTINCT: 'distinct',
}

// Whether the owner is actually asked this. See the note above RELATIONSHIP:
// a referenced parameter is not asked here, and since charts left the
// condition pages it is not shown here either. Nothing uses it today.
export function isAsked(parameter) {
  return parameter?.relationship !== RELATIONSHIP.REFERENCE
}

// A parameter's follow-ups, however they were written.
//
// `followUp` (one) came first and most parameters still use it; `followUps`
// (a list) exists because Skin And Coat needs two — a photo and a description
// — and "which of these two is the real one?" is not a question the data
// should have to answer.
export function followUpsOf(parameter) {
  if (Array.isArray(parameter?.followUps)) return parameter.followUps
  return parameter?.followUp ? [parameter.followUp] : []
}

// Whether a follow-up should be on screen, given the parent's answer.
//
// Lives here rather than in the component so that the form, the day summary
// and the export cannot disagree about which questions were asked.
export function followUpVisible(followUp, value) {
  if (!followUp) return false
  if (followUp.always) return true
  if (followUp.whenAtLeast != null) {
    return value !== '' && value !== UNSURE && Number(value) >= followUp.whenAtLeast
  }
  if (followUp.whenAny != null) {
    return value !== '' && value !== UNSURE && followUp.whenAny.includes(value)
  }
  // A multi-select parent answers with a list, so "when: 'other'" has to mean
  // "other is among what they picked" rather than "other is the whole
  // answer".
  if (Array.isArray(value)) return value.includes(followUp.when)
  return value === followUp.when
}

export function askedParameters(parameters = []) {
  return parameters.filter(isAsked)
}

// Whether a parameter's precondition is met.
//
// Some questions only make sense once another has been answered a particular
// way — "did {name} stick to the diet today?" is meaningless for a pet who is
// not on a diet trial, and asking it anyway produces a "no" that reads as a
// failure rather than as not applicable.
//
// One step, but see visibleParameters for the chain: this answers "is THIS
// parameter's own precondition met?" and nothing more.
//
// `equals` matches one answer; `equalsAny` matches any of several. The second
// exists because the allergy form asks what {name} has been diagnosed with —
// food, environmental, both or unknown — and the diet and gut questions
// belong to three of those four. Writing that as "not environmental" would be
// the same rule stated as a negative, and a negative precondition is much
// harder to read on the parameter it governs.
// A multi-select answer, as a list, whatever shape it is stored in.
//
// The allergy diagnosis was a single choice until 29 Aug 2026 and is now a
// multi-select, so entries saved before that hold a bare string. Rather than
// migrate the rows — the app's other data is not migrated either, and a
// migration only moves the problem to whoever restores an old backup — every
// reader normalises here.
//
// "both" was one of the old single answers and is exactly what a
// multi-select expresses better, so it is translated rather than dropped:
// an owner who answered it keeps the meaning of their answer.
export function selectedValues(value) {
  if (Array.isArray(value)) return value
  if (value == null || value === '') return []
  if (value === 'both') return ['food', 'environmental']
  return [value]
}

export function dependencyMet(parameter, values) {
  const on = parameter?.dependsOn
  if (!on) return true
  const value = values?.[on.key]
  // For a multi-select parent: met when the answer includes ANY of these.
  if (Array.isArray(on.includesAny)) {
    const chosen = selectedValues(value)
    return on.includesAny.some((entry) => chosen.includes(entry))
  }
  if (Array.isArray(on.equalsAny)) return on.equalsAny.includes(value)
  return value === on.equals
}

// The questions to actually put on screen, given what has been answered so
// far. Everything downstream — scoring, charts, the day's answers — reads the
// values that exist rather than this list, so a question that disappears
// takes its answer out of the summary with it.
// --- Standing answers ------------------------------------------------------
//
// Most condition questions are about today. A few are not: what {name} has
// been diagnosed with, which diet the trial uses, the day it started. Those
// are facts about the case, and asking them again every single day is both
// tedious and a good way to end up with three different answers to one
// question across a week of entries.
//
// Two flags describe that:
//
//   carryForward  the last answer given is copied into today's entry, so the
//                 record for each day is complete and the owner types nothing.
//   askOnce       once carried, the question leaves the daily form. It does
//                 NOT leave the record, and the screen offers a way back to
//                 it — see the standing-answers card in ConditionMonitoring.
//
// carryForward without askOnce is the "is she STILL on the trial?" case: the
// previous answer is offered as the default and the owner confirms or changes
// it, with `repeatLabel` rewording the question for the second time onwards.

// The most recent answer to each carry-forward question, from entries BEFORE
// the one being filled in.
//
// Walks backwards and takes the first real answer it finds, so a gap — a day
// where the owner skipped the whole form — does not lose a standing fact.
export function carriedAnswers(parameters = [], previousEntries = []) {
  const carried = {}
  for (const parameter of parameters) {
    if (!parameter.carryForward) continue
    // The parameter's own answer AND any follow-up that qualifies it.
    //
    // Without the follow-ups this carried "Other" forward and dropped the
    // owner's typed answer to "what has she been diagnosed with?" — so the
    // question stopped being asked (askOnce) while the only part of the
    // answer worth reading disappeared after the first entry.
    const keys = [parameter.key, ...followUpsOf(parameter).map((followUp) => followUp.key)]
    for (const key of keys) {
      for (let i = previousEntries.length - 1; i >= 0; i -= 1) {
        const value = previousEntries[i]?.values?.[key]
        if (value != null && value !== '') {
          carried[key] = value
          break
        }
      }
    }
  }
  return carried
}

// The parameters as the FORM should show them, given what has been carried.
//
// Only the form: the record and the scoring still see every parameter, so a
// question that has stopped being asked is still reported with its answer.
export function formParameters(parameters = [], carried = {}, { editStanding = false } = {}) {
  return parameters
    .filter((parameter) => editStanding || !(parameter.askOnce && carried[parameter.key] != null))
    .map((parameter) => (
      parameter.repeatLabel && carried[parameter.key] != null
        ? { ...parameter, label: parameter.repeatLabel }
        : parameter
    ))
}

// The questions that have stopped being asked, with the answers standing for
// them — what the "you told us this already" card is built from.
export function standingAnswers(parameters = [], carried = {}) {
  return parameters
    .filter((parameter) => parameter.askOnce && carried[parameter.key] != null)
    .map((parameter) => {
      const value = carried[parameter.key]
      // A follow-up that qualifies the standing answer belongs on the card
      // beside it. "Diagnosed with: Other" tells the owner nothing they did
      // not already know; "Other — flea allergy dermatitis" is the answer
      // they actually gave.
      const detail = followUpsOf(parameter)
        .filter((followUp) => followUpVisible(followUp, value))
        .map((followUp) => carried[followUp.key])
        .find((entry) => typeof entry === 'string' && entry.trim() !== '')
      return { parameter, value, detail: detail ? detail.trim() : null }
    })
}

// The questions to actually put on screen, dependencies resolved ALL THE WAY
// UP rather than one step.
//
// The bug this fixes, found 29 Aug 2026: the allergy form asks whether the
// pet is on a diet trial, then — only if yes — whether the owner is
// re-challenging, then — only if yes — which food, when, and how the pet
// reacted. An owner who worked through all of that and then changed the first
// answer to "no" still saw the last three questions. Their own precondition
// ("re-challenging = yes") was still satisfied, because the stored answer
// does not disappear when the question that asked it does.
//
// So a parameter is visible only if its own precondition is met AND the
// parameter it depends on is itself visible. Answers are deliberately NOT
// cleared: an owner who flips back to "yes" finds their work still there, and
// summariseEntry applies this same rule, so a hidden answer stays out of the
// record for as long as it is hidden.
//
// Cycle-guarded. A dependsOn loop would be a data error rather than something
// to support, but it should show up as a hidden question rather than as a
// hung form.
export function visibleParameters(parameters = [], values = {}) {
  const asked = askedParameters(parameters)
  const byKey = new Map(asked.map((parameter) => [parameter.key, parameter]))

  const isVisible = (parameter, seen) => {
    if (!dependencyMet(parameter, values)) return false
    const parentKey = parameter.dependsOn?.key
    if (!parentKey) return true
    // A dependency on something this form does not ask — a question from
    // another module, say — is treated as met. dependencyMet has already
    // checked the stored value, which is the best this can know.
    const parent = byKey.get(parentKey)
    if (!parent) return true
    if (seen.has(parentKey)) return false
    seen.add(parentKey)
    return isVisible(parent, seen)
  }

  return asked.filter((parameter) => isVisible(parameter, new Set([parameter.key])))
}

// --- Shared parameters -----------------------------------------------------
//
// Questions that mean the same thing in more than one condition. Gum colour
// is gum colour whether you are watching a heart or a spleen: the same
// instruction for lifting the lip, the same four options, the same reason
// white or blue is an emergency.
//
// Defined once so there is ONE place to edit the wording. The alternative —
// a copy per condition — drifts within weeks, and the copies that drift are
// the ones nobody remembers to update.
//
// Consumers may override any field (a condition-specific `why`, say) while
// keeping the measurement itself identical.
// The line shown under an emergency answer when there is nothing more
// specific to say than "this needs a vet now".
//
// A shared constant because nine questions across five conditions use it.
// Nine copies of one sentence is nine chances for one to drift into saying
// something slightly different about the same urgency.
//
// Declared HERE, above the shared parameter blocks, and that placement is
// load-bearing: `breathing_effort` below is built at module load, so a
// definition further down the file threw "Cannot access 'SEEK_VET_ASAP'
// before initialization" the moment anything imported this file.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Phrased to match the aspiration alert in the GI
// section rather than inventing a second way to say it.
export const SEEK_VET_ASAP = 'Seek veterinary attention as soon as possible.'

// The one alert both seizure escalations raise — over five minutes, and more
// than one in 24 hours. Ash's instruction 3 Sep 2026, reversing the split she
// asked for earlier the same day: both are emergencies, and both say the same
// thing.
//
// Assembled from wording she has already approved: "is an emergency" is from
// the standing alert, and the second sentence is SEEK_VET_ASAP verbatim.
export const SEIZURE_EMERGENCY_ALERT =
  'A seizure lasting more than 5 minutes, or more than one seizure in 24 hours (a cluster), '
  + `is an emergency. ${SEEK_VET_ASAP}`

export const SHARED_PARAMETERS = {
  gum_colour: {
    key: 'mucous_membranes',
    label: 'Gum Colour',
    type: 'choice',
    why:
      'Gum colour reflects how well oxygenated blood is reaching the tissues. Pink is what you want. Blue or white means oxygen or circulation is failing.',
    howToTitle: 'How to Check Gum Colour',
    howTo: [
      'Lift the lip gently and look at the gum above the upper teeth.',
      'Check in good light — indoor lighting can make pink look pale.',
      'Some pets have naturally pigmented (black) gums. If so, the inside of the lower eyelid works instead.',
    ],
    options: [
      { value: 'pink', label: 'Pink', severity: SEVERITY.OK },
      { value: 'pale_pink', label: 'Pale pink', severity: SEVERITY.OK },
      { value: 'white', label: 'White', severity: SEVERITY.EMERGENCY },
      { value: 'blue', label: 'Blue or grey', severity: SEVERITY.EMERGENCY },
    ],
    emergencyMessage:
      'This needs veterinary attention now. Contact your vet or an emergency service immediately.',
  },

  // Cancer's wording, adopted by Heart Disease too — Ash's call, 24 Aug.
  // The cancer levels describe the WORK of breathing in fewer words; the
  // cardiac ones carried extra detail (flaring nostrils, elbows held out,
  // head and neck extended, gums possibly white or blue) that is real but
  // reads as a lot to hold in your head while watching an animal breathe.
  //
  // The key stays `respiratory_effort`, which is what Heart Disease has been
  // storing against. Renaming it to match the cancer draft's
  // `breathing_effort` would have orphaned every reading already logged.
  //
  // The "(emergency)" marker is load-bearing on a `scale`: the picker reads
  // it to draw the hazard icon AND evaluateParameter reads it to flag the
  // day. Removing it from a level silently downgrades that level.
  breathing_effort: {
    key: 'respiratory_effort',
    label: 'Breathing Effort',
    type: 'scale',
    // The same domain as the daily assessment's breathing category, asked in
    // more detail: six levels written for a patient being watched for this
    // specifically, with the top two marked as emergencies. Both are kept —
    // deriving one from the other is deliberately not done, because the two
    // are answered in different frames of mind on different days.
    covers: 'breathing',
    relationship: RELATIONSHIP.SUPERSEDES,
    // Moderate (4) and moderate-to-severe (6) mark the day amber. 8 and 10
    // carry the "(emergency)" marker and are handled by that.
    concernFrom: 4,
    // The top two rungs carry the "(emergency)" marker, which sets the
    // colour; this is the line that appears under them. Without it the panel
    // drew red with no words in it — true of six questions across the app
    // until 29 Aug 2026, this one included.
    emergencyMessage: SEEK_VET_ASAP,
    levels: {
      dog: [
        'Effortless. The chest moves gently and evenly, mouth closed.',
        'Slightly deeper chest movement, but still relaxed.',
        'Chest movement is easy to see, and the tummy sometimes moves with it.',
        'Obvious effort — the tummy pushes in and out with each breath.',
        'Laboured at rest — the tummy heaves with every breath. (emergency)',
        'Struggling — open-mouth gasping, unable to settle. (emergency)',
      ],
      cat: [
        'Effortless. The chest moves gently and evenly, mouth closed.',
        'Slightly deeper chest movement, but still relaxed.',
        'Chest movement is easy to see, and the tummy sometimes moves with it.',
        'Obvious effort — the tummy pushes in and out, may sit hunched.',
        'Open-mouth breathing with the tummy heaving. (emergency)',
        'Struggling — gasping, unable to settle. (emergency)',
      ],
    },
  },

  // Coughing, with the "what does it sound like" follow-up. Shared because
  // the question and its options are the same wherever it is asked — only
  // the reason it matters differs, which is what the `why` override is for.
  coughing: {
    key: 'coughing',
    label: 'Coughing',
    type: 'yesno',
    // Sits in the breathing domain but is not breathing effort: a pet can
    // cough all week and breathe effortlessly in between, and the daily
    // assessment would record that as normal.
    covers: 'breathing',
    relationship: RELATIONSHIP.DISTINCT,
    concernWhen: 'yes',
    concernMessage:
      'Worth mentioning to your vet, particularly if it is new or more frequent.',
    followUp: {
      when: 'yes',
      key: 'cough_character',
      label: 'What Does the Cough Sound Like?',
      type: 'choice',
      allowOther: true,
      otherLabel: 'Describe it yourself',
      options: [
        { value: 'moist', label: 'Moist or wet', severity: SEVERITY.CONCERN },
        { value: 'dry', label: 'Dry or hacking', severity: SEVERITY.CONCERN },
      ],
    },
  },
  // Stool consistency, shared between Gastrointestinal Disease and Allergies.
  //
  // Lifted here from giModules.js on 29 Aug 2026, when the allergy form
  // needed it too. Writing a second stool scale would have been two described
  // clinical scales for one thing, free to drift — the precise problem this
  // registry exists to stop, and a bad one to have it on, because a vet
  // managing food-responsive enteropathy is reading both forms.
  stool_consistency: {
    key: 'faecal_consistency',
    label: 'Stool Consistency',
    type: 'scale',
    // Distinct from the assessment's stool question, not a duplicate of it.
    // That one is a 0-10 impression with symptom chips; this is a described
    // scale where each rung is a recognisable stool, which is what a vet
    // manages a chronic enteropathy on. Declaring `covers` keeps them charted
    // together without keeping them in step.
    covers: 'stool',
    relationship: RELATIONSHIP.DISTINCT,
    concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026, wording and severities both.
    // Severe and very severe are emergencies: the stool itself is not the
    // problem, what leaves with it is.
    emergencyMessage: 'Watery diarrhoea can lead to dehydration quickly in pets. Contact your vet promptly for assessment.',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Follows the shape of a
    // published faecal scoring chart without reproducing one. Written to what
    // an owner sees when they pick it up.
    levels: {
      dog: [
        'Firm and formed. Holds its shape and leaves nothing behind.',
        'Formed but softer. Holds its shape, though it leaves a mark.',
        'Soft and losing shape. Log-shaped but flattens, and is hard to pick up cleanly.',
        'Very soft, piles rather than holds shape. Cannot pick up cleanly.',
        'Mostly watery. Cannot be picked up. (emergency)',
        'Entirely liquid. (emergency)',
      ],
      // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The cat wording is mine, following the structure of the
      // dog levels above rather than inventing a second way of describing the
      // same thing. Same six rungs, same escalation through the scoop test:
      // hard to scoop cleanly, cannot scoop cleanly, cannot be scooped.
      cat: [
        'Firm and formed. Holds its shape when scooped from the tray.',
        'Formed but softer. Holds its shape, though it sticks to the litter.',
        'Soft and losing shape. Clumps with the litter and is hard to scoop cleanly.',
        'Very soft, piles rather than holds shape. Cannot scoop cleanly.',
        'Mostly watery. Cannot be scooped. (emergency)',
        'Entirely liquid. (emergency)',
      ],
    },
  },

  // THE SAME QUESTION as the Overall Quality of Life Assessment, not a
  // per-condition version of it. `assessmentField` names the column it
  // shares: answering it here fills it in there and the other way round.
  //
  // Three conditions ask it now — gastrointestinal, kidney and allergies —
  // and each wants its own wording for what a "yes" means, which is what
  // `overrides` is for. What must NOT vary is the question itself: three
  // records of how much a pet vomited on one day, free to disagree, is the
  // problem this whole mechanism exists to avoid.
  vomiting: {
    key: 'vomiting',
    label: 'Vomiting',
    type: 'vomiting',
    assessmentField: 'vomiting',
    covers: 'vomiting',
    relationship: RELATIONSHIP.SUPERSEDES,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Overridden per condition where there is
    // something more specific to say.
    emergencyMessage: 'Blood in the vomit needs veterinary attention as soon as possible.',
  },
}

export function sharedParameter(key, overrides = {}) {
  const base = SHARED_PARAMETERS[key]
  if (!base) return null
  return { ...base, ...overrides }
}

// The note shown on every question that reuses a BEAAAAPP category verbatim.
//
// Defined once and shared rather than written per parameter, because the whole
// point is that these ARE the same question — two subtly different
// explanations of that would undo it. Any parameter with `beapKey` should
// carry it.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Her wording, verbatim.
//
// One sentence, shown once, only when the answer is actually already there.
// The static "this is the same question as..." subtext that used to sit above
// it has gone: on a pre-filled question the two said the same thing twice.
//
// `prefilledFrom` is the same sentence pointed the other way, for the
// assessment screens, where the answer came from a condition form instead.
export const prefilledFrom = (sourceLabel) =>
  `Already filled in from today's ${sourceLabel}. You can still change your answer and it will update in both assessments.`

export const SAME_AS_ASSESSMENT = prefilledFrom('Overall Quality of Life Assessment')

// APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Her wording, verbatim.
//
// Shown once, under the Disease-Specific Monitoring title. It was on each
// individual condition page too for a while; repeating it at the top of every
// disease was a sentence someone had already read, sitting between them and
// the thing they came to do.
// The label on the button that reveals a question's subtext.
//
// The subtext explains what a question is really asking — what "straining"
// looks like, why coughing after a vomit matters. That is worth reading once
// and worth having available forever, which is not the same as worth having
// on screen every time. A GI form with eleven questions carried eleven
// paragraphs of it, and the questions themselves were what got scrolled past.
//
// A parameter can override this with `whyLabel` where the generic phrasing
// does not fit what its subtext actually says.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
export const WHY_LABEL = 'More info'

export const MONITORING_DISCLAIMER =
  "This does not replace your vet's advice or clinical assessment, but will help make monitoring at home easier between visits."

// `shortLabel` is the condition's name in running prose: lower case, and
// trimmed to the part an owner would say out loud. `label` is a heading and
// says everything ("Arthritis and Mobility Issues"); a sentence listing six
// of those is unreadable, so the paywall's condition line uses these. Lower
// case because it only ever appears mid-sentence. Anything without one falls
// back to the lower-cased label, so a new condition still reads correctly
// before anyone gets round to writing its short form.
export const CONDITIONS = {
  cardiac: {
    key: 'cardiac',
    label: 'Heart Disease',
    shortLabel: 'heart disease',
    Icon: HeartOrganIcon,
    // Shown on the condition list to say what monitoring involves before
    // someone commits to it.
    // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Murmurs added, and named
    // FIRST: an owner who has been told "there's a murmur, we'll keep an eye
    // on it" and nothing more is the person most likely to think this section
    // is not for them, and is exactly who it is for.
    summary:
      'For pets with a heart murmur — including where the underlying cause has not been determined — and for conditions such as myxomatous mitral valve disease (MMVD), dilated cardiomyopathy (DCM) and hypertrophic cardiomyopathy (HCM).',
    intro:
      'Monitoring parameters such as resting breathing rate and exercise tolerance can help catch subtle changes over time. Earlier detection often leads to earlier intervention and better outcomes.',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. See the 'acvim-cardiac' entry in lib/references.js.
    citation: referenceText('acvim-cardiac'),
    parameters: [
      {
        key: 'resting_respiratory_rate',
        label: 'Resting Respiratory (Breathing) Rate (RRR)',
        type: 'number',
        // Graphed. One of two questions in the app that draw a line — see
        // numberChartFor. A rate creeping from 24 to 38 over a summer is the
        // whole reason this question exists, and it is invisible on a
        // calendar that only knows whether the day was flagged.
        chart: true,
        unit: 'breaths/min',
        min: 1,
        max: 200,
        step: 1,
        placeholder: 'e.g. 24',
        // Rate, not effort. The daily assessment grades how hard {name} is
        // working to breathe; nothing in it counts breaths, and a normal
        // effort with a rate of 44 is the finding this question exists for.
        covers: 'breathing',
        relationship: RELATIONSHIP.DISTINCT,
        why:
          '**This is one of the most subtle but useful things you can measure at home.** In many cases of heart disease, fluid can build up in the lungs, leading to an increased breathing rate at rest. This often occurs before more obvious signs of sickness. A resting respiratory rate (RRR) of **consistently more than 30 breaths per minute** warrants a vet visit sooner rather than later.',
        howToTitle: 'How to Measure RRR',
        howTo: [
          'Ensure {name} is completely asleep and relaxed (i.e. not straight after a walk or excitement).',
          'Watch the chest. One breath is the rise AND fall of the chest.',
          'Count the number of breaths for 30 seconds, then double it to get the rate per minute.',
        ],
        // Closing line, after the steps rather than as one of them — it is
        // the conclusion to draw, not an action to take.
        //
        // NOTE: 30 now appears in three places — here, in `why` above, and in
        // `concernAbove` below, which is the only one the app actually acts
        // on. Change one, change all three.
        howToFooter:
          '**If the RRR is consistently greater than 30 breaths per minute, contact your vet.**',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 23 Aug 2026: 30 breaths/min for both
        // dogs and cats.
        //
        // The published sources do not differentiate by species either. Tufts
        // gives normal as under 32-35 for "a normal dog or cat" and says to
        // contact a vet above 35; 30 is the more conservative home-monitoring
        // trigger and the one chosen here.
        //
        // Left as a species-keyed object even though both values match, so
        // splitting them later is an edit to a number rather than a change of
        // shape — and so the file records that the question was asked and
        // deliberately answered the same way twice.
        concernAbove: { dog: 30, cat: 30 },
        concernMessage:
          'This is higher than the usual resting range. One high reading can happen — but if it stays above this over several readings, or your pet also seems unsettled or is breathing harder, contact your vet.',
      },
      sharedParameter('breathing_effort', {
        // Overridden, not shared: this sentence refers to the resting
        // respiratory rate question directly above it on the cardiac form,
        // which the cancer module has no equivalent of.
        why:
          'Breathing effort tells us how hard {name} is working to get oxygen — not how fast, which you have already counted above. This does not need to be assessed while {name} is completely asleep but ideally should be done when {they} {are} relaxed.',
      }),
      sharedParameter('coughing', {
        // Overridden, not shared: why a cough matters differs by disease.
        why:
          'Coughing in a heart patient can mean fluid in the lungs, or an enlarged heart pressing on the airway. What it sounds like helps tell those apart.',
      }),
      {
        key: 'exercise_tolerance',
        label: 'Exercise Tolerance',
        type: 'choice',
        // The daily assessment grades activity as a whole. This asks about
        // exertion specifically — a dog can be bright and busy around the
        // house and still stop halfway up the same hill it managed last week,
        // and in heart disease that is the earlier signal of the two.
        covers: 'activity',
        relationship: RELATIONSHIP.DISTINCT,
        why:
          'Tiring sooner than usual or stopping on a walk can be one of the earliest signs of heart disease.',
        options: [
          { value: 'normal', label: 'Normal', severity: SEVERITY.OK },
          { value: 'reduced', label: 'Reduced', severity: SEVERITY.CONCERN },
        ],
        concernMessage: 'Worth noting, especially if it is a change from the last few days.',
        followUp: {
          when: 'reduced',
          key: 'exercise_notes',
          label: 'What Have You Noticed?',
          type: 'text',
          placeholder: 'e.g. stopped halfway on the usual walk, lay down after five minutes',
        },
      },
      {
        key: 'syncope',
        label: 'Fainting or Collapsing',
        type: 'yesno',
        emergencyWhen: 'yes',
        why:
          'This always requires prompt veterinary attention, especially with heart disease and even if {name} seems completely normal after.',
        emergencyMessage:
          'Contact your vet or an emergency service now. A collapse needs to be assessed today, even if your pet seems fine again.',
        followUp: {
          when: 'yes',
          key: 'syncope_notes',
          label: 'What Happened?',
          type: 'text',
          placeholder: 'e.g. after excitement at the door, out for a few seconds, came round on {their} own',
        },
      },
      sharedParameter('gum_colour'),
      {
        key: 'abdominal_distension',
        label: 'Swollen or Bloated Tummy (Ascites)',
        type: 'yesno',
        concernWhen: 'yes',
        why:
          'Sometimes fluid can accumulate in the abdomen of pets with heart disease. This often occurs gradually and can be easy to miss day-to-day, but is easier to spot when you are looking for it. If you suspect {name}\'s tummy appears or feels swollen or bloated, prompt veterinary attention is required.',
        concernMessage: 'Mention this to your vet, particularly if it is new or increasing.',
        followUp: {
          when: 'yes',
          key: 'distension_notes',
          label: 'Anything to Add?',
          type: 'text',
          placeholder: 'e.g. noticeably rounder than last week, firm to touch',
        },
      },
    ],
  },

  // --- Planned, not yet built -------------------------------------------
  //
  // Listed so the condition page shows what's coming rather than a list of
  // one. Deliberately carry NO clinical content: no parameters, no
  // thresholds, no wording that could be mistaken for reviewed guidance.
  // `comingSoon` is what stops them being openable.
  // An episode log wearing the shape of a daily form.
  //
  // Every other condition asks "how has {name} been?" on a schedule. Epilepsy
  // does not work like that: there is nothing to report for six weeks and
  // then something at three in the morning. So the first question is whether
  // a seizure happened at all, and everything else hangs off a `dependsOn`
  // and simply is not shown on a day when the answer is no. An owner opening
  // this on a quiet day answers one question and leaves.
  //
  // One record per day, which is what the entries table stores. A cluster is
  // captured by "how many" rather than by several records — an owner counting
  // three seizures before dawn is not going to fill in three forms, and the
  // count is the number that matters clinically anyway.
  seizures: {
    key: 'seizures',
    label: 'Seizures',
    shortLabel: 'seizures',
    Icon: SeizureOrganIcon,
    summary:
      'Includes seizures caused by primary epilepsy, brain lesions, metabolic disease and infection.',
    // The calendar reads as an exception log, not a diary — see
    // calendarAssumesWell in lib/charts.js. Every day from the first entry to
    // today is green unless a seizure was recorded on it, which means the
    // owner only has to open this when something happens.
    calendarAssumesWell: true,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
    calendarKeyLabels: {
      ok: 'Seizure-free',
      concern: 'Seizure',
      emergency: 'Seizure with emergency signs',
    },
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Shown under the calendar itself, because the
    // rule it describes is not one an owner could infer from the colours.
    calendarUnloggedTitle: 'Seizure-free',
    calendarCaption:
      'You do not need to fill this in every day. Any day you have not recorded a seizure on is shown as seizure-free, and so is any day you recorded "no". Only the days with a seizure need an entry.',
    // The "Keep yourself safe" paragraph that opened this section was removed
    // on Ash's instruction (1 Sep 2026). It warned the owner they could be
    // bitten during a seizure. The standing red alert on the first question
    // still carries the clinical thresholds — five minutes, and more than one
    // in 24 hours — which is the part that decides whether to call a vet.
    intro: [
      // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
      'You do not need to fill this in every day — only on a day {name} has a seizure. Every other day is counted as seizure-free, so the gaps between seizures show up on the calendar without you doing anything.',
      // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
      'What your vet needs most is how long it lasted, how many there were, and how long {name} took to come back to {them}self afterwards.',
    ],
    parameters: [
      {
        key: 'had_seizure',
        label: 'Has {name} Had A Seizure Today?',
        type: 'yesno',
        concernWhen: 'yes',
        // Shown whatever is answered, and before anything is answered —
        // unlike every other alert in the app, which responds to a choice.
        //
        // It has to be standing because the two things that turn a seizure
        // into an emergency are BOTH knowable before the owner has typed
        // anything: how long this one has gone on for, and whether it is the
        // second today. Someone watching a seizure right now needs the five
        // minute rule in front of them, not three questions further down.
        //
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Both thresholds
        // confirmed: five minutes, and more than one seizure in 24 hours.
        // Both graded the same, and both raising this same alert, on her
        // final instruction of the day.
        standingAlert: SEIZURE_EMERGENCY_ALERT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'Answer no on days nothing happens and there is nothing else to fill in. A record of the quiet days is what makes the pattern visible.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        concernMessage:
          'Recorded. Tell your vet about any seizure, even a short one that {name} recovered from quickly.',
        // Offered on every seizure day, not only the first.
        //
        // A video is the single most useful thing an owner can bring to a
        // neurology appointment: what a seizure looked like is very hard to
        // describe and very easy to film, and by the appointment it is weeks
        // in the past. It sits on this question rather than on "what did it
        // look like" because that one already carries the "which part of the
        // body" box, and a parameter has room for one follow-up.
        followUp: {
          key: 'seizure_video',
          when: 'yes',
          type: 'photo',
          // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
          label: 'Show your vet',
          hint: 'If you can film a seizure safely, do — from a distance, and only if {name} is not left alone to do it. A video shows your vet things that are almost impossible to describe, and it matters most early on, before the seizures are under control.',
        },
      },

      {
        key: 'seizure_count',
        label: 'How Many Seizures Today?',
        type: 'choice',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'More than one seizure in 24 hours is called a cluster, and requires vet attention as soon as possible.',
        // Severities here describe ESCALATION, not the event.
        //
        // Every option was amber to begin with, which meant a single
        // straightforward seizure lit the calendar with six or seven
        // "concerns" — what it looked like, whether she was aware, how long
        // recovery took. Those are descriptions of one event, not six
        // separate findings, and listing them all under "Worth watching"
        // buried the one that mattered.
        //
        // So the day flags ONCE, on "has there been a seizure", and after
        // that only a genuine escalation adds anything: a cluster, over five
        // minutes, or not recovered a day later.
        //
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Two or more in a
        // day is the conventional cluster definition, and every rung of it is
        // an emergency. Her final call of the day, reversing the amber grade
        // she asked for earlier: a cluster is a cluster at two.
        //
        // No concernMessage any more — nothing on this parameter reaches the
        // concern branch, so one would be dead wording that reads as though
        // some answer here were merely worth watching.
        options: [
          { value: 'one', label: 'One', severity: SEVERITY.OK },
          { value: 'two', label: 'Two', severity: SEVERITY.EMERGENCY },
          { value: 'three_plus', label: 'Three or more', severity: SEVERITY.EMERGENCY },
        ],
        emergencyMessage: SEIZURE_EMERGENCY_ALERT,
      },

      {
        // Bands rather than a typed number, deliberately. Nobody holds a
        // stopwatch to a seizure, and a form asking for one gets a guess
        // dressed up as a measurement. The bands are drawn around the five
        // minute threshold because that is the only boundary that changes
        // what the owner should do.
        key: 'seizure_duration',
        label: 'How Long Did The Longest One Last?',
        type: 'choice',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'It is often difficult to time the exact duration of a seizure. A rough estimate is fine.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The bands and their severities.
        options: [
          { value: 'under_1', label: 'Less than a minute', severity: SEVERITY.OK },
          { value: '1_2', label: '1 to 2 minutes', severity: SEVERITY.OK },
          { value: '2_5', label: '2 to 5 minutes', severity: SEVERITY.OK },
          { value: 'over_5', label: 'More than 5 minutes', severity: SEVERITY.EMERGENCY },
          { value: 'still_going', label: 'Still going now', severity: SEVERITY.EMERGENCY },
        ],
        emergencyMessage: SEIZURE_EMERGENCY_ALERT,
      },

      {
        key: 'seizure_type',
        label: 'What Did It Look Like?',
        type: 'choice',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        allowOther: true,
        otherLabel: 'Describe it yourself',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Written to be answerable
        // by someone who has never heard the words focal or generalised.
        why:
          'Whether a seizure involves the whole body or only part of it helps your vet narrow down possible causes.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The options and their severities.
        options: [
          { value: 'generalised', label: 'Whole body — collapsed, stiff or paddling', severity: SEVERITY.OK },
          { value: 'focal', label: 'One part only — face, one limb, twitching', severity: SEVERITY.OK },
          { value: 'started_focal', label: 'Started in one part, then spread to the whole body', severity: SEVERITY.OK },
        ],
        // Only for the two answers where "which part?" is a real question.
        // A whole-body seizure has no part to name, and asking anyway invites
        // an answer that means nothing.
        followUp: {
          key: 'seizure_type_detail',
          whenAny: ['focal', 'started_focal'],
          // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
          label: 'Which part of the body?',
          type: 'text',
          placeholder: 'e.g. left side of the face twitching, then the front leg',
        },
      },

      {
        key: 'consciousness',
        label: 'Was {name} Aware Of You During It?',
        type: 'choice',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Whether a pet is conscious through a seizure is one of the things a vet will ask.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The options and their severities.
        options: [
          { value: 'aware', label: 'Aware — responded to me', severity: SEVERITY.OK },
          { value: 'unaware', label: 'Not aware — no response at all', severity: SEVERITY.CONCERN },
          { value: 'unsure_aware', label: 'Hard to tell', severity: SEVERITY.OK },
        ],
      },

      {
        // Declared against urination even though the overlap check does not
        // demand it — neither "bladder" nor "bowels" matches its patterns.
        // Declared anyway because the honest answer is that it touches both
        // domains, and the decision is deliberate: this is a description of
        // one event, not a report on how {name} has been toileting, and the
        // two must not be kept in step.
        key: 'incontinence',
        label: 'Did {name} Lose Control Of {their} Bladder Or Bowels?',
        type: 'choice',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'This is common during a seizure and is not something {name} can help. It is worth recording because it helps your vet judge how severe the seizure was.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The options and their severities.
        options: [
          { value: 'neither', label: 'No', severity: SEVERITY.OK },
          { value: 'bladder', label: 'Yes — passed urine', severity: SEVERITY.OK },
          { value: 'bowels', label: 'Yes — passed a stool', severity: SEVERITY.OK },
          { value: 'both', label: 'Yes — both', severity: SEVERITY.OK },
        ],
      },

      {
        key: 'warning_signs',
        label: 'Was There Any Warning Beforehand?',
        type: 'yesno',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'Some pets behave oddly in the minutes or hours before a seizure — clingy, restless, hiding, staring. Recognising these behaviours can give you time to get somewhere safe for both yourself and your pet.',
        followUp: {
          key: 'warning_signs_detail',
          when: 'yes',
          label: 'What did you notice?',
          type: 'text',
          placeholder: 'e.g. followed me from room to room for an hour, would not settle',
        },
      },

      {
        key: 'recovery',
        label: 'How Long To Get Back To Normal?',
        type: 'choice',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'The period after a seizure is called the post-ictal phase. Pacing, disorientation and clinginess are common. How long the post-ictal phase lasts is worth tracking — a recovery that gets longer over months is a change your vet will want to know about.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The bands and their severities.
        options: [
          { value: 'minutes', label: 'A few minutes', severity: SEVERITY.OK },
          { value: 'under_hour', label: 'Under an hour', severity: SEVERITY.OK },
          { value: 'hours', label: 'Several hours', severity: SEVERITY.CONCERN },
          { value: 'over_day', label: 'More than a day, or not back to normal yet', severity: SEVERITY.EMERGENCY },
        ],
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        emergencyMessage:
          'A pet who has not returned to normal more than a day after a seizure needs to be seen. Contact your vet.',
      },

      {
        key: 'seizure_notes',
        label: 'Anything Else You Noticed?',
        type: 'text',
        dependsOn: { key: 'had_seizure', equals: 'yes' },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'What {they} {were} doing beforehand, the time of day, anything different about this one. Small details are what turn a list of dates into a pattern.',
        placeholder: 'e.g. 2am, asleep on the sofa beforehand, wet {them}self during it',
      },
    ],
  },

  // Composed rather than declared. `composed: true` is what tells the app to
  // resolve this pet's parameter list from their config (see cancerConfig.js)
  // instead of reading a fixed `parameters` array. The array below stays
  // empty on purpose — a cancer patient's questions depend on which signs
  // their owner is actually watching.
  cancer: {
    key: 'cancer',
    label: 'Cancer',
    shortLabel: 'cancer',
    Icon: CancerOrganIcon,
    composed: true,
    summary:
      'There are many different types of cancer and they cause different symptoms. This makes it easier to keep track of the ones that matter for your pet.',
    // Shown on the setup screen under "What To Monitor", not on the condition
    // page. `intro` on every other condition explains what monitoring that
    // condition involves; for cancer that question cannot be answered until
    // the owner has said which cancer, so the text that would have gone there
    // belongs on the screen where they answer it.
    setupIntro:
      'Cancer looks different in every patient. Your vet may have told you exactly what to watch for; if you are still waiting on results, start with the basics and add to it later.',
    // Credited once, at the top of the assessment, the same way the app
    // credits BEAAAAPP and the WSAVA body condition chart — rather than
    // explaining the provenance again inside every graded question.
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    citation: referenceText('vcog-ctcae'),
    parameters: [],
  },

  // NO CITATION, AND THAT IS CHECKED RATHER THAN MISSING.
  //
  // Confirmed by Dr Ash Cullen (BSc, DVM), 3 Sep 2026: the stool scoring here
  // is NOT derived from the Purina, Bristol or Waltham faecal charts, or any
  // other published scale. It is an original structure, as is the rest of the
  // module. Asked and answered; it does not need asking again.
  gastrointestinal: {
    key: 'gastrointestinal',
    label: 'Gastrointestinal Disease',
    shortLabel: 'gastrointestinal disease',
    Icon: GutOrganIcon,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
    summary:
      'Digestive problems can be a condition in their own right — such as IBD, food allergies, infection or parasites — or a sign of something else. It is therefore important to always consult your vet first.',
    // Composed, like cancer: the owner says which conditions apply and gets
    // those questions. GI is not one disease — a cat with EPI, a dog on a
    // food trial and a dog recovering from a foreign body removal share an
    // organ system and almost nothing else, and one fixed form would be mostly
    // irrelevant to all three of them every day.
    //
    // See lib/giModules.js for the questions and lib/giConfig.js for how a
    // config becomes a parameter list.
    composed: true,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The whole section. Every owner-facing string in
    // giModules.js is drafted by me, including all the thresholds.
    // The intro sentence has gone with the setup card's — same words, same
    // instruction, 3 Sep 2026. An empty array rather than a removed key:
    // resolveDefinition and the setup screen both read `intro` and an array
    // is what they expect.
    intro: [],
    parameters: [],
  },

  // --- Cognitive Decline ---------------------------------------------------
  //
  // Structured on DISHAA's six domains — Disorientation, Interactions,
  // Sleep-wake cycle, House-soiling, Activity, Anxiety — because it is the
  // instrument built to be repeated rather than scored once for a diagnosis,
  // which is what an app an owner returns to needs.
  //
  // Dogs and cats get their OWN questions rather than shared wording with
  // species variations. Feline cognitive dysfunction shows differently enough
  // that a translated dog question would be asking the wrong thing: a cat
  // does not get stuck behind furniture, it howls at 3am at a wall.
  //
  // Keys are shared across species where the domain is the same, so a pet's
  // history lines up on one chart whichever set of questions produced it —
  // and species filtering guarantees only one of each pair is ever shown.
  //
  // EVERY level below is drafted by me and needs Ash's eye. They are written
  // to be replaced sentence by sentence, the way arthritis was.
  cognitive: {
    key: 'cognitive',
    label: 'Cognitive Decline / Dementia',
    shortLabel: 'cognitive decline',
    Icon: CognitiveOrganIcon,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. The "sometimes called
    // canine/feline dementia" tail has gone: the title says Dementia now, so
    // the sentence was introducing a word already on the screen above it.
    summary:
      'Changes in memory, orientation, sleep patterns and interaction that can come with ageing.',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Nothing from
    // DISHAA is reproduced here; the domains are followed and the owner
    // wording is drafted.
    citation: referenceText('dishaa'),
    // The caution comes FIRST, before the "changes are gradual" framing.
    // Everything below this line teaches an owner to watch and wait; this
    // sentence is the one that might send them to a vet instead, and a
    // caveat placed after the instructions is a caveat nobody acts on.
    // Bolded because PetText renders **runs** as <strong>, and this is the
    // one instruction on the screen that changes what someone does today.
    //
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The first two sentences are mine. The rest is yours,
    // approved 25 Aug 2026.
    intro: [
      '**Many signs of cognitive decline can also be signs of illness.** A veterinary assessment is important to rule out other causes before assuming cognitive decline.',
    ],
    parameters: [
      // --- Disorientation -------------------------------------------------
      {
        key: 'disorientation',
        species: 'dog',
        label: 'Disorientation',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her cut: the examples
        // that followed are already the six levels below, and repeating them
        // above the scale asks the owner to read the same list twice.
        why:
          'This is about whether {name} still finds {their} way around places {they} {have} always known.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'Finds {their} way around the house and garden normally.',
            'Occasionally pauses, as if working out where to go next.',
            'Sometimes goes to the hinge side of a door, or stands in a room staring into space.',
            'Often looks lost in familiar places, or gets stuck behind or under furniture.',
            'Frequently disorientated, and needs help finding the way out of a room.',
            'Appears lost most of the time, even in a single familiar room.',
          ],
        },
      },
      {
        key: 'disorientation',
        species: 'cat',
        label: 'Disorientation',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Same cut as the dog
        // version, for the same reason.
        why:
          'This is about whether {name} still moves around {their} own home with confidence.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026, for every level EXCEPT
        // moderate. That one ("Sometimes stares at walls or into space") is
        // still mine — it was the one level not sent, and it is the only rung
        // between "occasionally hesitates" and "often seems unsure", so it is
        // worth a look.
        levels: {
          cat: [
            'Moves around the house confidently and settles in the usual places.',
            'Occasionally hesitates before entering a room, walking through a doorway or jumping onto usual perches.',
            'Sometimes stares at walls or into space for a while.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
            'Often seems unsure of where {they} {are}, or hides/settles in unusual places.',
            'Frequently disorientated, cannot find the litter tray or food. May vocalise or become distressed if alone. Sometimes gets \'stuck\' in unusual places.',
            'Constantly disorientated, needs constant guidance to food, water and/or litter tray. Often vocalises or gets distressed if left alone. Often gets \'stuck\' in unusual places.',
          ],
        },
      },

      // --- Interactions ---------------------------------------------------
      {
        key: 'interactions',
        species: 'dog',
        label: 'Interaction With You',
        type: 'scale',
        // The daily assessment's attitude category is about demeanour — how
        // bright they seem. This is about the specific social habits that
        // fall away first: the greeting at the door, asking to be stroked.
        covers: 'attitude',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
        why:
          'All dogs interact differently, and some are naturally more independent than others. The main thing is to know what is normal for {name}, and to notice a change from that.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'Greets you, seeks attention and enjoys interacting with you as {they} normally {do}.',
            'Slightly less inclined to interact with you than normal.',
            'Notably less interactive than normal.',
            'Rarely interacts with you and may even move away or avoid interaction.',
            'Rarely interacts with you, and acts as if {they} {do} not recognise you or other family members.',
            'No longer seeks contact or interaction. May not recognise familiar people.',
          ],
        },
      },
      {
        key: 'interactions',
        species: 'cat',
        label: 'Interaction With You',
        type: 'scale',
        covers: 'attitude',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. The same point the dog
        // anxiety question makes, and for the same reason: a scale that reads
        // as "less affectionate is worse" would mark an aloof cat down from
        // the first day for being exactly {them}self.
        why:
          'Not all cats actively seek attention or affection. The main thing is to know what is normal for {name}, and to recognise if things are changing.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. "OR" left capitalised as
        // written: it separates two opposite presentations on one rung, and
        // level text has no bold, so the capitals are the only emphasis
        // available.
        levels: {
          cat: [
            'Seeks attention or settles nearby, enjoys being patted (or usual level of affection).',
            'Slightly less inclined to seek attention or be around you.',
            'Seeking attention notably less. Less tolerant of being handled (or usual level of affection).',
            'Rarely seeks contact and may move away / hide when approached.',
            'Rarely interacts OR has become unusually clingy and follows you often.',
            'No longer interacts OR has become unusually clingy and gets distressed when left alone.',
          ],
        },
      },

      // --- Sleep-wake cycle -----------------------------------------------
      {
        key: 'sleep_wake',
        species: 'dog',
        label: 'Sleep',
        type: 'scale',
        // Literally the same question as the daily assessment's sleep
        // section — same six levels, from the same definition — so the two
        // are kept in step rather than asked twice. `scoreKey` says which
        // general score it fills; the daily one stores 0-10 with 10 as best,
        // this stores severity with 0 as best, and the conversion between
        // them is a subtraction.
        covers: 'sleep',
        relationship: RELATIONSHIP.SUPERSEDES,
        scoreKey: 'sleep',
        // The normal hours, the same sentence the daily assessment shows, so
        // an owner judging "is this a lot?" has the number in front of them
        // wherever they are asked.
        why: SLEEP_NOTES.dog[0],
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: { dog: SLEEP_SCALE.dog },
      },
      {
        key: 'sleep_wake',
        species: 'cat',
        label: 'Sleep',
        type: 'scale',
        covers: 'sleep',
        relationship: RELATIONSHIP.SUPERSEDES,
        scoreKey: 'sleep',
        why: SLEEP_NOTES.cat[0],
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: { cat: SLEEP_SCALE.cat },
      },

      // --- House-soiling --------------------------------------------------
      {
        key: 'house_soiling',
        species: 'dog',
        label: 'Toileting',
        type: 'scale',
        // Not the daily urination question, which asks how urination has
        // been. This asks WHERE, and whether the habit of asking to go out
        // has been lost — a house-trained dog forgetting is the finding.
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Capitalisation, full stops
        // and one comma normalised; "uses doggy door" given its article.
        levels: {
          dog: [
            'Asks to go out (or uses a doggy door) and toilets outside as usual.',
            'Occasional toileting inside, but still regularly asks/attempts to go out.',
            'Asks/attempts to go out less reliably, with toileting inside happening more frequently.',
            'Often toilets inside and rarely asks/attempts to go outside. Sometimes this occurs soon after being outside.',
            'Regularly toileting inside and no longer signals the need to go out.',
            'Always toileting inside. May no longer posture to toilet and may have accidents even when asleep (incontinent).',
          ],
        },
      },
      {
        key: 'house_soiling',
        species: 'cat',
        label: 'Litter Tray Habits',
        type: 'scale',
        // Plenty of cats never use one — outdoor cats, cat flaps, farm cats.
        // Without this they would be marked down every time for not doing
        // something they have never done.
        notApplicableLabel: 'My cat does not use a litter tray',
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Worth a note on this one: toileting outside the tray
        // has more common explanations than dementia (arthritis, kidney
        // disease, cystitis, a tray in the wrong place). Should this question
        // carry a line saying so, or is that the vet's job?
        levels: {
          cat: [
            'Uses the litter tray normally.',
            'The occasional accident just outside the tray.',
            'Toilets outside the tray now and then, in the same few places.',
            'Often toilets away from the tray, in different places around the house.',
            'Rarely uses the tray, and toilets wherever {they} happen{s} to be.',
            'No longer uses the tray at all. May no longer posture to toilet, or may have accidents while {they} {are} sleeping (incontinence).',
          ],
        },
      },

      // --- Activity -------------------------------------------------------
      {
        key: 'activity_changes',
        species: 'dog',
        label: 'Purposeful Activity',
        type: 'scale',
        // The daily activity category asks how much they are doing. This
        // asks whether what they are doing makes sense — a dog pacing a
        // circuit for an hour is busy and not well.
        covers: 'activity',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Two sentences, and the
        // second is the one doing the work: an owner who has already answered
        // the daily activity question will otherwise read this as the same
        // question and give it the same answer.
        why:
          'Your Overall Quality of Life Assessment asks how much {name} is doing. '
          + 'This asks whether it still has a point to it.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Capitalisation and full
        // stops normalised (severe ended on a colon), and "the world around
        // them" made a pronoun token so it follows the pet's sex.
        levels: {
          dog: [
            'Playing and exploring as usual. Engaged in sniffing and investigating new things.',
            'Slightly less interested in play or exploring.',
            'Notably less interested in play or exploring. Occasionally seems to wander aimlessly.',
            'Wanders or paces without any obvious purpose.',
            'Long periods of pacing, circling or staring into space. Not interested in sniffing or investigating new things.',
            'Almost all activity is repetitive or aimless. Disengaged from the world around {them}.',
          ],
        },
      },
      {
        key: 'activity_changes',
        species: 'cat',
        label: 'Purposeful Activity',
        type: 'scale',
        covers: 'activity',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Two sentences, and the
        // second is the one doing the work: an owner who has already answered
        // the daily activity question will otherwise read this as the same
        // question and give it the same answer.
        why:
          'Your Overall Quality of Life Assessment asks how much {name} is doing. '
          + 'This asks whether it still has a point to it.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
        levels: {
          cat: [
            'Grooming, playing and investigating new things as usual. Regular routines are intact.',
            'Slightly less interested in regular activities and routines.',
            'Notably less interested in regular activities and routines. Occasional aimless wandering.',
            'Wanders or paces without apparent purpose. No longer interested in regular activities.',
            'Extended periods of pacing, circling or staring into space.',
            'Almost all activity is seemingly aimless.',
          ],
        },
      },

      // --- Anxiety --------------------------------------------------------
      {
        key: 'anxiety',
        species: 'dog',
        label: 'Anxiety',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
        why:
          'Anxiety from cognitive decline looks different in every dog, and some dogs are naturally more anxious than others. The main thing is to know what is normal for {name}, and to watch for a change from that.',
        howToTitle: 'Common Signs Of Anxiety In Dogs',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The list is mine. Written as things an owner can see
        // from across a room rather than as clinical signs, since that is who
        // is reading it.
        howTo: [
          'Panting or drooling when it is not warm and {they} {have} not been exercising.',
          'Pacing, circling, or being unable to settle anywhere for long.',
          'Trembling or shaking.',
          'Lip-licking, repeated yawning, or turning the head away.',
          'Ears held back, tail tucked, body held low.',
          'Hiding, or pressing hard against you.',
          'Barking, whining or howling, particularly when left alone.',
          'Chewing, scratching at doors, or toileting indoors when left alone.',
          'Turning down food that would normally be taken.',
        ],
        // The same caution the condition's introduction opens with, repeated
        // here because this list is behind a button — an owner who taps
        // straight into it may never have read the top of the screen, and
        // this is the list most likely to have them conclude "it's just
        // anxiety" about a sign that is pain, illness or a drug side effect.
        //
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        howToFooter:
          '**Many of these can also be signs of illness or pain.** It is important for a vet to rule those out before assuming anxiety.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'Settled and content with small changes or being left alone.',
            'Occasionally unsettled by things that never used to bother {them}.',
            'Notably more anxious or restless when left alone.',
            'Notably more anxious when left alone. More clingy than usual — follows you around the house and does not want to be alone.',
            'Anxious for most of the day, regardless of whether you are home or not. Has difficulty relaxing at all.',
            'Constantly distressed and cannot be comforted.',
          ],
        },
      },
      {
        key: 'anxiety',
        species: 'cat',
        label: 'Anxiety',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
        why:
          'All cats have different thresholds for anxiety. The main thing is to know what is normal for {name}, and to notice a change from that.',
        howToTitle: 'Common Signs Of Anxiety In Cats',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The list is mine. Deliberately not the dog list with
        // the words changed: a frightened dog is loud and busy, a frightened
        // cat mostly does LESS of everything, and half of these are things
        // stopping rather than starting. The over-grooming and under-grooming
        // pair are both here on purpose — anxiety pushes cats either way, and
        // an owner watching for only one would miss the other.
        howTo: [
          'Hiding for long stretches, or keeping to somewhere {they} can watch the room from.',
          'Crouched and tense, with the tail wrapped tightly in or tucked under.',
          'Ears flattened or turned back, and pupils wide in normal light.',
          'Startling at ordinary household sounds that never used to matter.',
          'Over-grooming, often the belly or flanks, to the point of thin fur or bald patches.',
          'Grooming much less, so the coat starts to look unkempt.',
          'Growling, hissing or swiping when approached or handled.',
          'Yowling or calling out, particularly at night.',
          'Eating less, or only eating when nobody else is in the room.',
          'Toileting outside the litter tray, or spraying indoors.',
        ],
        // The same caution the condition's introduction opens with, repeated
        // here because this list is behind a button — an owner who taps
        // straight into it may never have read the top of the screen, and
        // this is the list most likely to have them conclude "it's just
        // anxiety" about a sign that is pain, illness or a drug side effect.
        //
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        howToFooter:
          '**Many of these can also be signs of illness or pain.** It is important for a vet to rule those out before assuming anxiety.',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
        levels: {
          cat: [
            'Copes with the usual household comings and goings.',
            'Occasionally frightened or upset by things that never used to bother {them}.',
            'Notably more skittish, or hiding more than usual for no apparent reason.',
            'Often hiding for long periods of time, or calling out when left alone.',
            'Hiding, distressed or vocalising for most of the day. Difficult to settle at all.',
            'Constantly hiding, distressed or vocalising. Cannot be comforted.',
          ],
        },
      },
    ],
  },

  arthritis: {
    key: 'arthritis',
    label: 'Arthritis and Mobility Issues',
    shortLabel: 'arthritis',
    Icon: BoneOrganIcon,
    summary:
      'Stiffness, lameness and willingness to move.',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
    intro:
      'Symptoms of arthritis are usually gradual.',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Neither
    // is reproduced here; the parameters follow their domains and the owner
    // wording below is drafted.
    citation: referenceText('load-fmpi'),
    parameters: [
      // The BEAAAAPP category rather than a scale of its own, so the two can
      // never disagree about the same day. Ambulation IS the central
      // arthritis measure and the daily assessment already collects it with
      // six species-specific levels.
      //
      // Asked here rather than referenced from the daily assessment, which is
      // what Heart Disease does with appetite. An owner who opens Arthritis
      // without having done the assessment that day would otherwise be left
      // with an entry missing the one measure that matters most in it — and
      // now that the answer is shared both ways, asking costs them nothing:
      // whichever screen they reach first fills in the other.
      {
        key: 'limping',
        // Ambulation was here until 25 Aug 2026 and has gone on Ash's
        // instruction. It borrowed the BEAAAAPP ambulation category, which
        // grades getting about as one thing — limping, stiffness, stairs and
        // jumping all folded into a single rung. In arthritis those come
        // apart: a cat that has quietly stopped jumping is not limping, and a
        // dog with one sore elbow may be limping while getting about fine.
        // Jumping already has its own question, so this one asks only about
        // the limp.
        label: 'Limping',
        type: 'scale',
        // `distinct`, not `supersedes`, and that difference is the point of
        // this change. It names ambulation as the measure it sits near — the
        // overlap check requires that — while declaring it is NOT the same
        // question, so the two are no longer kept in step. The assessment
        // still grades getting about as a whole; this asks only about the
        // limp.
        covers: 'ambulation',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // The most severe rung carries the "(emergency)" marker; this is the
        // line that appears under it.
        emergencyMessage: SEEK_VET_ASAP,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Written to what an
        // owner can see from across a room: whether there is a limp, when it
        // shows, and whether it settles.
        levels: {
          dog: [
            'Walks evenly. No limp at any time.',
            'A slight limp now and then, usually after getting up or after a long walk.',
            'A limp that is easy to see after rest or exercise, but wears off as {they} {do} more.',
            'Limping most of the time. It does not fully wear off.',
            'Obvious limp at every step, and sometimes carries the leg for a few strides. (emergency)',
            'Will not put the leg down at all, or cannot walk without help. (emergency)',
          ],
          cat: [
            'Walks evenly. No limp at any time.',
            'A slight limp now and then, usually after getting up or after being still for a while.',
            'A limp that is easy to see after rest, but wears off as {they} move{s} around.',
            'Limping most of the time. It does not fully wear off.',
            'Obvious limp at every step, and sometimes holds the leg up. (emergency)',
            'Will not put the leg down at all, or cannot walk without help. (emergency)',
          ],
        },
      },
      {
        key: 'stiffness_after_rest',
        label: 'Stiffness After Resting',
        type: 'scale',
        // Not the same question as getting about. This is about the first
        // minute after standing up, which is when arthritis shows and when
        // nobody is watching a walk.
        covers: 'ambulation',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // The most severe rung carries the "(emergency)" marker; this is the
        // line that appears under it.
        emergencyMessage: SEEK_VET_ASAP,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Her wording, one set for
        // both species: nothing in it is dog- or cat-specific, so the drafted
        // versions that differed at moderate-to-severe are gone. Only
        // capitalisation and full stops were normalised to match the rest of
        // the app, and "obviously stiff or a long time" was read as "for".
        levels: {
          dog: [
            'Gets up with ease and immediately moves around normally.',
            'Slightly slow to get up and has a few stiff steps before returning to normal movement.',
            'Slow to get up and appears stiff for the first minute or so, before moving comfortably.',
            'Some difficulty getting up, stiff for several minutes. Needs to \'warm up\' before moving comfortably.',
            'Difficulty getting up, obviously stiff for a long time after resting. Never seems to move comfortably.',
            'Struggles to get up at all or cannot without assistance. Reluctant to walk or move. (emergency)',
          ],
          cat: [
            'Gets up with ease and immediately moves around normally.',
            'Slightly slow to get up and has a few stiff steps before returning to normal movement.',
            'Slow to get up and appears stiff for the first minute or so, before moving comfortably.',
            'Some difficulty getting up, stiff for several minutes. Needs to \'warm up\' before moving comfortably.',
            'Difficulty getting up, obviously stiff for a long time after resting. Never seems to move comfortably.',
            'Struggles to get up at all or cannot without assistance. Reluctant to walk or move. (emergency)',
          ],
        },
      },
      // The BEAAAAPP palpation category rather than a yes/no of its own.
      // Same reasoning as ambulation above: the daily assessment already
      // grades response to touch on six species-specific levels, and a
      // separate arthritis version would sit beside it free to disagree.
      //
      // The "where?" follow-up is the one thing BEAAAAPP does not ask and
      // arthritis needs — which joint is sore is what changes the vet's
      // examination.
      {
        key: 'palpation',
        // Same reasoning as Ambulation above: named for the BEAAAAPP category
        // it reuses, so the two never read as separate measures — including
        // the "(response to touch)" gloss, which is the whole point of the
        // heading for an owner who does not use the word palpation.
        label: 'Palpation (response to touch)',
        type: 'beap',
        beapKey: 'palpation',
        hideImages: true,
        // Same category as the daily assessment, asked with the one thing it
        // does not ask: where. Kept rather than referenced for the same
        // reason as ambulation above.
        covers: 'palpation',
        relationship: RELATIONSHIP.SUPERSEDES,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        followUp: {
          key: 'palpation_where',
          // A threshold, not an exact score — asked at every level from
          // "flinches or pulls away" upwards.
          whenAtLeast: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
          type: 'text',
          label: 'Where Is {name} Sore?',
          placeholder: 'Hips, lower back, a particular leg…',
        },
      },

      // --- Dogs only ------------------------------------------------------
      {
        key: 'walk_tolerance',
        species: 'dog',
        label: 'Walks',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026 — her instruction to
        // flag the bottom rung. This scale carried no emergency message at
        // all, because until now no rung on it was an emergency; the marker
        // draws the triangle and this is what tells the owner what to do
        // about it. Same sentence as Limping directly above.
        emergencyMessage: SEEK_VET_ASAP,
        // Stamina on a walk, against a distance this dog does every day —
        // a comparison the daily activity grade has no way to make.
        covers: 'activity',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026. Capitalisation and full
        // stops normalised to match the other scales; wording otherwise hers.
        levels: {
          dog: [
            'Very keen on walks, does not tire and does not pull up sore after.',
            'Keen on walks and goes the usual distance, but is a little slower at the end.',
            'Slows down or lags before the end of the usual walk. Will sometimes pull up sore after.',
            'Slow and needs the walk cut shorter than usual. Will limp or pull up sore after.',
            'Can only manage a short, slow walk. Goes out mostly to sniff rather than exercise.',
            'Unwilling to walk or not interested in walks at all. (emergency)',
          ],
        },
      },
      // Same key as the cat question below, deliberately. It is the same
      // measurement — can {name} still get up onto the things {they} used to —
      // and only the examples differ, so one key keeps one history and one
      // chart whatever the species. Species filtering guarantees a pet is only
      // ever shown one of the two.
      //
      // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. No `why` on this
      // one: the options say it themselves.
      {
        key: 'jump_height',
        species: 'dog',
        label: 'Jumping',
        covers: 'ambulation',
        relationship: RELATIONSHIP.DISTINCT,
        type: 'choice',
        options: [
          { value: 'as_before', label: 'Gets in and out of the car and onto furniture without hesitating', severity: SEVERITY.OK },
          { value: 'hesitates', label: 'Still manages, but hesitates or takes a run-up first', severity: SEVERITY.CONCERN },
          { value: 'lower_only', label: 'Only manages lower things, or needs a hand up or a ramp', severity: SEVERITY.CONCERN },
          { value: 'stopped', label: 'Has stopped jumping up altogether', severity: SEVERITY.CONCERN },
        ],
        concernMessage:
          'Worth mentioning to your vet, particularly if this is a change from a few months ago.',
      },
      {
        key: 'cold_or_damp',
        species: 'dog',
        label: 'Worse In Cold Or Damp Weather',
        type: 'yesno',
        // Informational: weather is not deterioration, and flagging it amber
        // every wet week would drag the trend down for something that
        // reverses on its own.
        informational: true,
      },

      // --- Cats only ------------------------------------------------------
      {
        key: 'jump_height',
        species: 'cat',
        label: 'Jumping',
        type: 'choice',
        // A specific loss the daily ambulation grade misses entirely: a cat
        // who has quietly stopped using the windowsill still walks normally.
        covers: 'ambulation',
        relationship: RELATIONSHIP.DISTINCT,
        options: [
          { value: 'as_before', label: 'Gets to all the usual places', severity: SEVERITY.OK },
          { value: 'hesitates', label: 'Gets there, but hesitates first', severity: SEVERITY.CONCERN },
          { value: 'lower_only', label: 'Only jumps to lower places now', severity: SEVERITY.CONCERN },
          { value: 'stopped', label: 'Has stopped jumping up', severity: SEVERITY.CONCERN },
        ],
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. This one WAS the literal string 'PENDING ASH',
        // which an owner picking anything below "gets to all the usual places"
        // would have read as their alert.
        concernMessage:
          'Worth mentioning to your vet, particularly if this is a change from a few months ago.',
        why:
          'Choosing a lower windowsill, or taking the sofa in two steps instead of one, is often the first sign of sore joints.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
      },
      {
        key: 'grooming',
        species: 'cat',
        label: 'Grooming',
        type: 'scale',
        // The daily assessment scores hygiene — whether {name} is clean. This
        // asks whether {they} can still reach, which is a mobility question
        // wearing a coat. A cat groomed by an owner scores well on one and
        // badly on the other, and that gap is the finding.
        covers: 'hygiene',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          cat: [
            'Coat is well kept all over.',
            'Slightly less tidy than usual.',
            'Some untidy patches, usually over the back or hips.',
            'Coat is matted or greasy where {they} cannot reach.',
            'Rarely grooms any more. Coat is matted or greasy.',
            'Not grooming at all. Coat is severely matted and greasy.',
          ],
        },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
        why:
          'A cat who cannot comfortably turn or position to groom will stop doing so. The most common areas they will stop grooming are over the back, the hips and the base of the tail.',
      },
      {
        key: 'litter_tray',
        species: 'cat',
        label: 'Using The Litter Tray',
        type: 'choice',
        // About climbing in, not about what comes out. The daily urination
        // question is unchanged by a cat who cannot get over the side.
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
        options: [
          { value: 'normal', label: 'Uses it normally', severity: SEVERITY.OK },
          { value: 'awkward', label: 'Climbs in and out awkwardly', severity: SEVERITY.CONCERN },
          { value: 'accidents', label: 'Sometimes goes just outside it', severity: SEVERITY.CONCERN },
          { value: 'avoiding', label: 'Avoiding it altogether', severity: SEVERITY.CONCERN },
        ],
        concernMessage:
          'A high-sided tray can be hard to climb into with sore joints. A lower one, or a second tray closer by, often helps.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
      },
    ],
  },

  // Chronic kidney disease only. Acute kidney injury and lower urinary tract
  // disease are deliberately out: a blocked cat is an emergency measured in
  // hours, and putting it on a form designed for a condition tracked over
  // months would be the wrong shape for both.
  //
  // Owner-observable signs only. No creatinine, no SDMA, no blood pressure —
  // Ash's call, and the same principle the rest of the app follows: a
  // question an owner cannot answer without phoning the vet is a question
  // that makes the form feel like it is not for them.
  // A fixed core with one gated block, rather than a composed condition.
  //
  // Allergic pets look broadly alike whatever the trigger — itch, ears, feet,
  // skin — so there is no useful setup question to ask up front. The one
  // thing that genuinely differs is whether the owner is running an
  // elimination diet trial, and that hangs off a single yes/no rather than a
  // setup screen. Same mechanism the seizure form uses to hide everything on
  // a quiet day.
  allergies: {
    key: 'allergies',
    label: 'Allergies and Skin Disease',
    shortLabel: 'allergies',
    Icon: AllergyOrganIcon,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her paragraphs, with
    // sentence capitals and full stops added. Split across summary and intro
    // so they render as separate paragraphs rather than one block.
    //
    // Opening paragraph replaced 29 Aug 2026 on her instruction: it now leads
    // with skin disease rather than with allergy, and names the non-allergic
    // causes. One typo corrected — she wrote "cause by", set here as
    // "caused by".
    summary:
      'Most skin disease is due to underlying allergies, caused by food, environment or a combination of both. '
      + 'Other kinds of skin disease may be caused by parasites, immune-mediated processes or dietary deficiencies.',
    intro: [
      'Speak to your vet team about options for allergy diagnosis and management, and use the following questionnaire to track how {name} is responding to treatments.',
    ],
    // Behind a toggle rather than inline. This is reference material — read
    // once, when someone is working out whether the module applies to their
    // pet — and it sat permanently above the questions they came to answer,
    // pushing them down the screen on every visit thereafter. Same reasoning
    // as the `why` on a parameter, and the same component.
    //
    // The label names the content rather than saying "More info", because a
    // toggle a user has to open to find out what is behind it is a toggle
    // most people do not open.
    //
    // "particularly in cats" rather than a species-keyed string: this renders
    // through PetText, which fills tokens but does not resolve a
    // { dog, cat } object, so a species-split here would print as
    // [object Object]. Naming the species in the sentence is both correct and
    // useful — a dog owner reading it learns something too.
    whyLabel: 'Signs of allergies',
    why:
      'Signs of allergies include itching, over-grooming (particularly in cats), paw licking/chewing, ear infections '
      + 'and sometimes gastrointestinal issues. '
      + 'It is important to intervene early if any of these symptoms are noticed, to prevent inflammation and infection.',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. See the 'pvas' entry in lib/references.js.
    citation: referenceText('pvas'),
    // Shown above the "is {name} on any medication?" question, because in
    // skin disease the answer is very often yes-but-they-did-not-think-so.
    //
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
    medicationNote:
      'Please include topical treatments as well as tablets — medicated shampoos, mousses, sprays, ear drops and creams all count.',
    parameters: [
      // Asked first, and it decides what the rest of the form contains.
      //
      // An environmentally allergic pet has no diet trial to run and no
      // food-driven gut signs to record, so those questions are not merely
      // unnecessary for that owner — they are misleading, because a form that
      // asks about a diet trial implies one is part of the plan.
      //
      // "Not known yet" gets the food questions, deliberately. Not knowing is
      // the state most owners are in at the start, and the diet trial is how
      // that question gets answered.
      {
        key: 'allergy_type',
        label: 'What Has {name} Been Diagnosed With?',
        // Multi-select, on Ash's instruction 29 Aug 2026 — and "Both" is gone
        // with it. A separate "Both" option only ever existed because the
        // question could take one answer; with two selectable it says the
        // same thing worse, and it does not extend (there is no "food and
        // environmental and something else" option to add next).
        //
        // Legacy rows hold a bare string, including 'both'. See
        // selectedValues, which every reader goes through.
        type: 'multichoice',
        // A standing fact, not a daily question. Asked once, carried into
        // every later entry, and changeable from the card at the top of the
        // form.
        carryForward: true,
        askOnce: true,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Updated for multi-select.
        why:
          'Pick as many as apply. This decides which questions you are asked, and you can change it at any time — if you are not sure yet, choose "Not known yet".',
        // Informational: it describes what is being monitored rather than
        // reporting a sign, so it must not colour the day or count towards
        // the day having been assessed.
        informational: true,
        // No automatic "Not sure": "Not known yet" below IS that answer, and
        // it is the one that decides which questions follow. See noUnsure in
        // ConditionParameter.
        noUnsure: true,
        options: [
          { value: 'food', label: 'Food allergy' },
          { value: 'environmental', label: 'Environmental allergy' },
          { value: 'unknown', label: 'Not known yet' },
          // Added 29 Aug 2026 on Ash's instruction, and it follows the
          // opening paragraph she rewrote the same day: not all skin disease
          // is allergic. Parasites, immune-mediated disease and dietary
          // deficiency all bring an owner to this section, and until now the
          // only honest answer available to them was "Not known yet" — which
          // is not what they mean and which put them onto a food trial path.
          { value: 'other', label: 'Other' },
        ],
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. "Other" does NOT open the
        // diet-trial questions (see on_diet_trial's dependsOn below, which
        // lists food, both and unknown). The reasoning: a pet diagnosed with
        // something other than an allergy has no food trial to run, so the
        // form stays on the skin, ear, paw and sleep questions. If you would
        // rather "Other" behaved like "Not known yet" and offered the trial,
        // say so and it is a one-word change.
        followUp: {
          key: 'allergy_type_other',
          when: 'other',
          // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026 ("allow user to enter
          // condition if known"), phrased as a question.
          label: 'What is the diagnosis?',
          type: 'text',
          placeholder: 'e.g. flea allergy dermatitis, mange',
        },
      },
      {
        // The 0-10 itch score, delivered as the app's six-rung scale.
        //
        // A `scale` scores index x 2, so these six rungs ARE 0, 2, 4, 6, 8
        // and 10 — the number a dermatologist recognises, on the picker every
        // other question in the app uses. The steps are even rather than
        // continuous, which is the one difference from a true visual analog
        // scale and is worth knowing when comparing to a clinic's own score.
        key: 'itch',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. What the calendar's day line says when this
        // flags; see findingFor. The level text itself is yours — this only
        // names which part of {name} it was about.
        finding: 'Itching — {answer}',
        // Spelled "pruritus" — Ash wrote "prutitis" in the instruction, which
        // is the common typo for it. Worth flagging rather than silently
        // matching, since it is the term that goes to the vet.
        label: 'Itching (Pruritus Score)',
        type: 'scale',
        // The one scale plotted so far. Every itch answer has always been
        // stored in condition_entries.values.itch — this only asks for it to
        // be drawn, so the chart appears with the pet's full history rather
        // than starting from today.
        //
        // The other four scales in this module (skin, ears, paws_face,
        // itch_sleep) are deliberately NOT charted yet — Ash's call once this
        // one has been seen.
        chart: true,
        // CONFIRMED — Dr Ash Cullen (BSc, DVM), 1 Sep 2026. Was PENDING; cleared
        // once the chart made it visible. This is not only a severity rule
        // any more: it is the dashed line an owner reads and may take to
        // their vet, which is why it needed confirming before shipping.
        // Inclusive — evaluateParameter uses `score >= concernFrom`, so a 4
        // is itself a concern, and the chart caption says "at or above".
        concernFrom: 4,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Species-keyed: the cat
        // version carries Ash's point about over-grooming, which is the whole
        // reason a cat's itch gets missed.
        why: {
          dog:
            'This is the single most useful thing you can record. It helps determine whether treatments are working or not.',
          cat:
            'This is the single most useful thing you can record. It helps determine whether treatments are working or not. '
            + 'In cats this often presents as over-grooming a particular area — often the tummy or the limbs.',
        },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. ALL TWELVE LEVELS ARE MINE, AND THEY ARE NOT THE
        // VALIDATED DESCRIPTORS.
        //
        // Dogs and cats have SEPARATE validated instruments, which is why
        // these are split rather than sharing one list with a dog fallback:
        //
        //   dogs  Pruritus Visual Analog Scale (PVAS) — Rybnicek, Lau-Gillard,
        //         Harvey & Hill, Veterinary Dermatology 2009.
        //   cats  VAScat — Colombo, Sartori, Schievano & Borio, Veterinary
        //         Dermatology 2022. Built for cats specifically because they
        //         show pruritus as increased licking, increased scratching,
        //         or both — so the dog wording is the wrong question for a
        //         cat, not merely a less precise one.
        //
        // Both are behind journal paywalls, so their published anchor wording
        // could not be read, and reproducing it verbatim would be a rights
        // question in any case. What is written below follows the SHAPE of
        // those scales — an owner-rated 0-10 built on observable behaviour —
        // with wording of my own. Until you have checked it against the real
        // instruments this must not be described to anyone as a PVAS or
        // VAScat score.
        //
        // Both instruments are also CONTINUOUS: the owner marks a point on a
        // line. These are six fixed rungs at 0, 2, 4, 6, 8 and 10. Ask me for
        // a slider if you want the input to match as well as the wording.
        levels: {
          dog: [
            'Not scratching, licking or chewing at all.',
            'Scratching or licking a little more than usual, now and then.',
            'Scratching or licking several times a day. Stops if distracted.',
            'Scratching, licking or chewing often through the day. Interrupts what {they} {are} doing.',
            'Almost constant when awake, and hard to interrupt. Waking at night to scratch.',
            'Scratching or chewing without stopping. Damaging the skin, or cannot rest at all. (emergency)',
          ],
          // Licking as well as scratching throughout, deliberately. A cat's
          // itch usually shows first as over-grooming — and an owner watching
          // only for scratching will score a badly itchy cat as a 0.
          // "Hair loss" in the top two rungs changed to "fur loss", 29 Aug
          // 2026 on Ash's instruction — her own dictated wording, revised by
          // her. It also settles an inconsistency inside this one list, where
          // rung 4 already said "Fur thinning".
          cat: [
            'Not scratching, and grooming no more than {they} need{s} to.',
            'Grooming or scratching a little more than usual, now and then.',
            'Grooming or scratching several times a day. Stops if distracted.',
            'Long bouts of grooming or scratching through the day. Fur thinning where {they} {have} been licking.',
            'Almost constantly over-grooming or scratching while awake. Fur loss or thinning may be noted.',
            'Constantly over-grooming or scratching, causing fur loss and damage to the skin. (emergency)',
          ],
        },
        emergencyMessage: SEEK_VET_ASAP,
      },

      {
        key: 'skin',
        label: 'Skin And Coat',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. What the calendar's day line says when this
        // flags; see findingFor. The level text itself is yours — this only
        // names which part of {name} it was about.
        finding: 'Skin and coat — {answer}',
        // Grooming is the daily assessment's hygiene domain, and a coat in
        // poor condition can flag there too. Different question, though: that
        // one asks whether {name} is keeping {them}self clean, and this asks
        // what the skin underneath looks like. A well-groomed dog can have a
        // red, sore belly and a matted dog can have perfectly healthy skin.
        covers: 'hygiene',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'Look at the belly, armpits, groin and the inside of the back legs — the thinly furred places where redness shows first.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'Skin and coat look normal.',
            'Slightly pink in one or two of the thinly furred areas.',
            'Clearly red in places, or the coat is thinning where {they} {have} been licking.',
            'Red and sore in several places. Bald patches, scabs or spots.',
            'Widespread redness, fur loss, scabbing or a hot spot.',
            'Raw, weeping or bleeding skin, or an open sore spreading or worsening rapidly. (emergency)',
          ],
        },
        emergencyMessage: SEEK_VET_ASAP,
        // Both always offered, not gated on a score — Ash's call.
        //
        // The photo used to appear only from moderate upwards, which meant
        // the owner could not record the early picture that later comparisons
        // are judged against. And "where" is not a reaction to the severity:
        // a small red patch in one armpit and the same redness spread over
        // the whole belly score the same on the rungs above and are not the
        // same finding.
        followUps: [
          {
            key: 'skin_notes',
            always: true,
            // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
            label: 'Additional notes',
            type: 'text',
            placeholder: 'e.g. both armpits and the belly, red with small scabs',
          },
          {
            key: 'skin_photo',
            always: true,
            type: 'photo',
            label: 'Show your vet',
            // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
            hint: 'Skin changes fast, and by the appointment it may look completely different. A photo now gives your vet something to compare against, and something to judge from if they cannot see {name} today.',
          },
        ],
      },

      {
        key: 'ears',
        label: 'Ears',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. What the calendar's day line says when this
        // flags; see findingFor. The level text itself is yours — this only
        // names which part of {name} it was about.
        finding: 'Ears — {answer}',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Ears are the most common thing to flare alongside allergic skin, and an ear infection left alone gets harder to treat. Head shaking and scratching the ears are worth acting on early.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'Ears look and smell normal.',
            'The odd head shake or scratch at an ear.',
            'Shaking or scratching at the ears regularly. Slightly pink inside.',
            'Red inside, or a smell, or some discharge.',
            'Sore to touch, obvious discharge or a strong smell. May be tilting the head to one side.',
            'Crying out when the ear is touched, or losing balance. The ear flap may look fluid-filled or puffy (aural haematoma). (emergency)',
          ],
        },
        emergencyMessage: SEEK_VET_ASAP,
      },

      {
        key: 'paws_face',
        label: 'Paws And Face',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. What the calendar's day line says when this
        // flags; see findingFor. The level text itself is yours — this only
        // names which part of {name} it was about.
        finding: 'Paws and face — {answer}',
        // Dogs only, on Ash's instruction. A cat's itch shows as
        // over-grooming, which the Itching question above now names
        // explicitly for cats — asking a cat owner separately about paw
        // licking and face rubbing was asking the dog's version of a question
        // they have already answered.
        species: 'dog',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Licking or chewing the paws and rubbing the face are very common signs of allergies and itch.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'Not licking the feet or rubbing the face at all.',
            'Occasional licking at a paw, or the odd face rub.',
            'Licking the feet most days. Brown staining between the toes.',
            'Licking or chewing the feet for long stretches. Rubbing the face on the floor or furniture.',
            'Feet red, sore or swollen between the toes. Face rubbing constantly.',
            'Chewing the feet raw, or the face is swollen. (emergency)',
          ],
        },
        emergencyMessage: SEEK_VET_ASAP,
      },

      {
        key: 'itch_sleep',
        label: 'Sleep Disturbed By Itching',
        type: 'scale',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. What the calendar's day line says when this
        // flags; see findingFor. The level text itself is yours — this only
        // names which part of {name} it was about.
        finding: 'Sleep — {answer}',
        // Dogs only, on Ash's instruction — the same call as Paws And Face
        // above. A cat sleeps in short bouts through the day and night and
        // often somewhere the owner cannot see, so "was she woken by it?" is
        // a question most cat owners genuinely cannot answer, and one they
        // would answer wrongly rather than leave blank.
        species: 'dog',
        // The daily assessment asks how {name} slept. This asks whether
        // ITCHING is what disturbed it, which is a different finding and one
        // of the better measures of how bad a flare really is — an owner
        // underestimates daytime scratching and never misses being woken by
        // it at 3am.
        covers: 'sleep',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Being woken by scratching is one of the clearest signs that a flare is genuinely bad, and it is worth telling your vet about.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her six levels, with
        // sentence capitals and full stops added and her "scratch/lick"
        // written out as "scratch or lick" to read as a sentence.
        //
        // Not split by species: licking is if anything the more important
        // half for a cat, and the wording holds for both without change.
        levels: {
          dog: [
            'Sleeps through the night. Does not wake up to scratch or lick at all.',
            'Scratches or licks once or twice, but then goes back to sleep.',
            'Wakes to scratch or lick a few times through the night, but eventually settles.',
            'Awake and scratching or licking through most of the night. Struggles to settle.',
            'Awake and scratching or licking all night. Cannot settle.',
            'Awake and scratching or licking all night. Cannot settle, and is distressed — whining, panting or crying. (emergency)',
          ],
        },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026 — her instruction to
        // flag this rung. The marker is what draws the hazard triangle; the
        // message is what tells the owner to act on it, and a level marked
        // emergency without one draws the colour with no words under it.
        //
        // SEEK_VET_ASAP rather than a sentence written for this scale: it is
        // the wording she approved today, and the itch scale directly above
        // this one already uses it for the same escalation.
        emergencyMessage: SEEK_VET_ASAP,
      },

      // --- The diet trial block -------------------------------------------
      //
      // Everything below shows only for an owner running an elimination diet
      // trial. For everyone else the form ends above, and this gate is the
      // last question they see.
      {
        key: 'on_diet_trial',
        label: 'Is {name} On An Elimination Diet Trial?',
        // Asked every time, because it is the one standing fact that
        // genuinely changes — a trial ends. The previous answer is offered as
        // the default so nobody re-types it, and the wording changes to
        // "still" once there is one.
        repeatLabel: 'Is {name} Still On An Elimination Diet Trial?',
        carryForward: true,
        type: 'yesno',
        // Not asked of an environmentally allergic pet — see allergy_type.
        // includesAny, not equalsAny: the answer is a list now. "Both" no
        // longer exists as an option, and a legacy 'both' normalises to
        // ['food', 'environmental'], so those owners still reach the trial.
        dependsOn: { key: 'allergy_type', includesAny: ['food', 'unknown'] },
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording, with
        // sentence capitals and "This means" added at the front so it reads
        // as an answer to the question above rather than a fragment.
        why:
          'This means feeding a prescription hydrolysed diet or single novel protein diet for at least 8 weeks. '
          + 'In this time {name} is not allowed anything other than this diet. This will determine whether a food '
          + 'allergy is present. Speak to your vet if you have questions about what foods are appropriate for an '
          + 'elimination diet.',
      },

      // Directly under the gate, not below the gut questions.
      //
      // These two ARE the answer to "yes": which diet, and since when. Two
      // unrelated questions in between meant that tapping yes showed the
      // owner a vomiting question next, and the diet box was far enough down
      // to look as though it did not exist.
      {
        key: 'diet_trial_food',
        label: 'Which Diet Is {name} On?',
        type: 'text',
        // A FALLBACK mark only — see milestoneDayLabels.
        //
        // This used to mark the calendar in its own right, which put a second
        // flag there for the same event: "Elimination diet started" on the
        // start date, and "Elimination diet: Brand X hydrolysed" on whichever
        // day the owner typed the name in. The start-date milestone below now
        // pulls this answer in (withAnswerFrom), so the normal case is one
        // mark, on the day the trial began, naming the diet.
        //
        // fallbackFor covers the owner who names the diet and skips the date:
        // this then marks the day they told us, so the trial still appears on
        // the calendar. The moment a start date exists anywhere in the record
        // this mark stands down and the accurate one takes over.
        milestone: {
          label: 'Elimination diet started', withAnswer: true, fallbackFor: 'diet_start_date',
        },
        // Declared against appetite because the overlap check reads "Diet"
        // and asks. It is right to ask and the answer is no: the daily
        // assessment's appetite question is about how much {name} is eating,
        // and this names the product in the bowl. It is not even a daily
        // question — it is a standing fact about the trial.
        covers: 'appetite',
        relationship: RELATIONSHIP.DISTINCT,
        dependsOn: { key: 'on_diet_trial', equals: 'yes' },
        carryForward: true,
        askOnce: true,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Word for word the same
        // as Which Food Are You Using To Re-Challenge?, on her instruction —
        // it is the same ask, so it should not be two different sentences.
        why:
          'Be as specific as possible, and try to name the protein and/or the brand of food.',
        placeholder: 'e.g. Brand X hydrolysed, or Brand Y kangaroo and potato',
      },

      {
        key: 'diet_start_date',
        label: 'When Did The Diet Trial Start?',
        type: 'date',
        carryForward: true,
        askOnce: true,
        // Marked on the summary calendar, on the day the answer NAMES rather
        // than the day it was typed in — see milestoneDayLabels. Names the
        // diet by pulling in the answer above, so this is the single mark for
        // the trial starting.
        milestone: { on: 'date', label: 'Elimination diet started', withAnswerFrom: 'diet_trial_food' },
        dependsOn: { key: 'on_diet_trial', equals: 'yes' },
        // Turns the answer into "started 6 weeks and 2 days ago", which is
        // the number the whole trial is judged on.
        showElapsed: true,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. The figure is Ash's, from the question
        // above: "at least 8 weeks". It said "six to eight" until 29 Aug
        // 2026, which put two different numbers for the same protocol on one
        // form.
        why:
          'A food trial needs at least 8 weeks on the diet alone before it has proved anything, because the skin takes that long to settle. Recording the start date once means the app can tell you where you are rather than you having to count back.',
      },


      // --- Gut signs -------------------------------------------------------
      //
      // Placed below the diet-trial question on Ash's instruction, so the
      // skin signs stay together at the top of the form and the gut ones
      // read as secondary.
      //
      // The description tells owners allergies can cause gastrointestinal
      // issues; until now the form gave nowhere to record them. Both are the
      // SHARED definitions — the vomiting one writes to the same field as the
      // Overall Quality of Life Assessment and the GI form, and the stool
      // scale is the same six rungs GI uses — so a pet with both allergies
      // and a GI condition has one record rather than two free to disagree.
      {
        ...sharedParameter('vomiting', {
          // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
          concernMessage:
            'Worth recording. Vomiting can be part of a food allergy, so tell your vet — especially if it follows a particular food.',
          // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Declared on the allergy copy only, so the
          // GI and cardiac calendars are untouched. {answer:lower} drops the
          // capital off "Vomited — 2 today — bile" so it reads as one
          // sentence.
          finding: '{name} {answer:lower}',
        }),
        // Only while a trial is running — Ash's call.
        //
        // Gated on the trial rather than on the diagnosis: answering "no" to
        // the diet trial now ends the form there, so gut signs are collected
        // for the weeks the trial is being judged and not otherwise. An
        // environmentally allergic pet never reaches this at all, because the
        // gate above is itself hidden for them and the dependency chain
        // resolves the whole way up.
        //
        // NOTE: this does mean a food-allergic pet who is NOT currently on a
        // trial has nowhere to record vomiting or stool in this section. The
        // Gastrointestinal Disease section is where that goes.
        dependsOn: { key: 'on_diet_trial', equals: 'yes' },
      },
      {
        ...sharedParameter('stool_consistency', {
          // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Allergy copy only, as above.
          finding: 'Stool — {answer}',
        }),
        // Same gate as vomiting above.
        dependsOn: { key: 'on_diet_trial', equals: 'yes' },
      },

      {
        key: 'diet_adherence',
        label: 'Has {name} Had Anything Other Than The Trial Food Today?',
        type: 'yesno',
        dependsOn: { key: 'on_diet_trial', equals: 'yes' },
        concernWhen: 'yes',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. This is the one Ash named: the calendar used
        // to quote the question back ("Has Bailey Had Anything Other Than The
        // Trial Food Today?") on the very day the answer was the point.
        finding: { yes: 'The diet trial was broken' },
        findingWithDetail: { yes: 'The diet trial was broken — {name} had {detail}' },
        findingDetail: 'diet_slip_detail',
        // The daily assessment's appetite question is about how much {name}
        // is eating. This is about WHAT — a dog eating perfectly well can
        // still have wrecked a diet trial with one dropped chip.
        covers: 'appetite',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'Treats, chews, flavoured medication, toothpaste, someone else\'s bowl, something picked up on a walk. A single slip can restart the clock on the whole trial, so it is worth recording honestly rather than tidily.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        concernMessage:
          'Worth writing down. One slip does not usually ruin a trial, but your vet needs to know about it when they judge the result.',
        // Marked on the calendar, every time — not just the first. Two breaks
        // in a trial is a different result to one.
        //
        // markOnly: the flag still appears on the day, and the day's line says
        // nothing extra about it. The finding above already reads "The diet
        // trial was broken — Bailey had a dental chew"; without this the line
        // then added "— Diet broken: a dental chew" and said it twice. Ash's
        // call, 29 Aug 2026: drop the second, keep the mark.
        //
        // detailFrom is kept so that turning markOnly off restores the full
        // text rather than a bare "Diet broken".
        milestone: {
          when: 'yes', label: 'Diet broken', detailFrom: 'diet_slip_detail', markOnly: true,
        },
        followUp: {
          key: 'diet_slip_detail',
          when: 'yes',
          label: 'What did {they} have?',
          type: 'text',
          placeholder: 'e.g. half a dental chew, licked a plate',
        },
      },

      // --- Re-challenge ----------------------------------------------------
      //
      // The half of a food trial that most owners never complete.
      //
      // Six to eight weeks of a restricted diet only shows THAT food was part
      // of the problem. It does not say which food, and a pet left on the
      // trial diet forever is a pet on a needlessly narrow diet for a reason
      // nobody ever established. Re-challenging — one protein at a time,
      // long enough for a reaction to show, back to the trial diet in between
      // — is what turns "it might be food" into a list of what {name} can and
      // cannot eat.
      //
      // Gated behind its own yes/no rather than shown to everyone on a trial:
      // an owner in week two does not need these questions, and the guidance
      // on the gate itself is what tells them when they will.
      {
        key: 'rechallenge',
        label: 'Are You Re-Challenging With A New Food?',
        type: 'yesno',
        dependsOn: { key: 'on_diet_trial', equals: 'yes' },
        // Declared against appetite because the overlap check reads the word
        // "food" and asks. It is right to ask and the answer is no: the daily
        // assessment's appetite question is about how much {name} is eating,
        // and this is about WHICH food is being tested. A pet eating
        // enthusiastically can be reacting to every mouthful.
        covers: 'appetite',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording, with
        // sentence capitals and full stops added.
        why:
          'If {name}\'s skin disease has improved on the elimination diet after the 8 weeks, the next step is to '
          + '"re-challenge" with one food at a time. This will determine what {name} is allergic to. Speak to your '
          + 'vet about how to do this.',
      },

      {
        key: 'rechallenge_food',
        label: 'Which Food Are You Using To Re-Challenge?',
        type: 'text',
        // A FALLBACK mark only — same reasoning as the diet name above. This
        // and "when did you introduce it?" were marking the same re-challenge
        // twice, usually on the same day, as "Re-challenge: chicken —
        // Re-challenge food introduced". The introduction date below now
        // carries the food's name, and this marks the day the owner told us
        // only while no introduction date has been given at all.
        //
        // NOTE: judged across the whole record, so an owner who dated their
        // first re-challenge and not their second gets no mark for the
        // second. The alternative — judging per entry — double-marks every
        // properly answered re-challenge, which is the commoner case.
        milestone: { label: 'Re-challenge', withAnswer: true, fallbackFor: 'rechallenge_start_date' },
        dependsOn: { key: 'rechallenge', equals: 'yes' },
        // Declared against appetite because the overlap check reads the word
        // "food" and asks. It is right to ask and the answer is no: the daily
        // assessment's appetite question is about how much {name} is eating,
        // and this is about WHICH food is being tested. A pet eating
        // enthusiastically can be reacting to every mouthful.
        covers: 'appetite',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Be as specific as possible, and try to name the protein and/or the brand of food.',
        placeholder: 'e.g. chicken — Brand X chicken and rice',
      },

      {
        key: 'rechallenge_start_date',
        label: 'When Did You Introduce It?',
        type: 'date',
        // One mark per re-challenge, on the day the food actually went in
        // rather than the day it was typed, naming the food. A record with
        // four re-challenges still shows four marks.
        milestone: { on: 'date', label: 'Re-challenge', withAnswerFrom: 'rechallenge_food' },
        dependsOn: { key: 'rechallenge', equals: 'yes' },
        showElapsed: true,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording, and the two-week figure.
        why:
          'A reaction can take up to two weeks to show, so a food is not cleared until {name} has been on it that long with no flare.',
      },

      {
        key: 'rechallenge_reaction',
        label: 'Any Reaction To The New Food?',
        type: 'choice',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording. Your option labels, lower-cased to sit after
        // the dash.
        finding: 'Re-challenge — {answer:lower}',
        dependsOn: { key: 'rechallenge', equals: 'yes' },
        // The itch question above already records how itchy {name} is today.
        // This asks something the score cannot: whether the owner is
        // attributing it to the food being tested. Both are kept, because a
        // rising itch score with "no reaction" ticked is itself worth a vet
        // seeing.
        //
        // Declared against appetite rather than hygiene — the label names a
        // food, and declaring the domain the checker actually reads is the
        // honest answer. It is not an appetite question either way.
        covers: 'appetite',
        relationship: RELATIONSHIP.DISTINCT,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'Compare against how {they} {were} on the trial diet alone, not against how {they} {were} before the trial started.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The options and their severities.
        options: [
          { value: 'none', label: 'No reaction so far', severity: SEVERITY.OK },
          { value: 'itch', label: 'More itchy', severity: SEVERITY.CONCERN },
          { value: 'skin', label: 'Skin or ears have flared', severity: SEVERITY.CONCERN },
          { value: 'gut', label: 'Upset tummy — vomiting or loose stools', severity: SEVERITY.CONCERN },
        ],
        // No emergency option, and therefore no emergencyMessage. The
        // facial swelling / hives / trouble breathing option was here until
        // 29 Aug 2026 and has gone on Ash's instruction — so nothing this
        // question can be answered with flags red, and a message for a
        // severity that cannot occur would be dead wording.
        //
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        concernMessage:
          'Worth recording, and worth stopping this food and going back to the trial diet. Tell your vet what {name} reacted to — that is the result the trial exists to produce.',
      },
    ],
  },

  // NO CITATION, AND THAT IS CHECKED RATHER THAN MISSING.
  //
  // Confirmed by Dr Ash Cullen (BSc, DVM), 3 Sep 2026: this module does NOT
  // draw on IRIS staging or any other published instrument. The parameters
  // are an original structure built for owner observation at home — IRIS
  // stages on creatinine, SDMA and proteinuria, which are bloodwork an owner
  // does not have. Asked and answered; it does not need asking again.
  kidney: {
    key: 'kidney',
    label: 'Kidney Disease',
    shortLabel: 'kidney disease',
    Icon: KidneyOrganIcon,
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
    //
    // Both sentences sit in `summary` rather than one here and one in
    // `intro`, because they are one thought: here is what to watch for, and
    // here is why you are the one watching. The page renders summary and
    // intro as consecutive paragraphs, so splitting them would put a
    // paragraph break in the middle of a point.
    //
    // Weight is deliberately not mentioned. It matters in kidney disease and
    // it matters in most of the others too, which is exactly why it has its
    // own Body Condition tile rather than a pointer from inside one disease.
    //
    // "side effects" corrected to "symptoms" here, on the appetite parameter
    // and on nausea, 29 Aug 2026 on Ash's instruction — a side effect belongs
    // to a treatment, and these are signs of the disease itself.
    summary:
      'Loss of appetite, changes in drinking and urination, nausea and vomiting are all common symptoms of kidney disease. '
      + 'It is important to monitor these symptoms closely at home.',
    // Its own paragraph deliberately. This is the point that home monitoring
    // does not replace a vet, and running it on from the sentence above
    // buries it.
    //
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording, with a comma
    // added after "home monitoring".
    intro:
      'Regular vet checks are important in conjunction with home monitoring, to monitor blood pressure, check urine concentration and perform blood tests to check the progression of kidney disease.',
    // No citation. The questions below follow the signs of chronic kidney
    // disease as they present at home; they are not taken from a published
    // instrument, and crediting one the content does not actually draw on
    // would be worse than crediting none.
    parameters: [
      // The BEAAAAPP appetite category, asked here rather than referenced.
      //
      // Referencing is what Heart Disease does, and for kidney it would be
      // the wrong call: appetite is the single sign owners notice first in
      // CKD, and an owner who opens this page without having done the daily
      // assessment would end up with a kidney entry missing the measure that
      // matters most in it. Because the answer is shared both ways, asking
      // costs them nothing — whichever screen they reach first fills in the
      // other.
      {
        key: 'appetite',
        label: 'Appetite',
        type: 'beap',
        beapKey: 'appetite',
        covers: 'appetite',
        relationship: RELATIONSHIP.SUPERSEDES,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // The top two rungs of the shared appetite scale already carry the
        // emergency marker; this is the line that appears under them. Set on
        // the kidney parameter, not on the scale in beapScales.js — the scale
        // is shared with the daily assessment and with any other condition
        // that borrows it, and what to do about a pet refusing food is not
        // the same sentence in every context.
        emergencyMessage: SEEK_VET_ASAP,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Appetite loss or reduction is one of the most common symptoms of kidney disease. '
          + 'It is a valuable indicator of how well {name} is feeling each day.',
      },

      // Drinking and urinating are both in the daily assessment, and both are
      // asked again here in a sharper form — Ash's call.
      //
      // `distinct`, not `supersedes`, and the difference matters. Supersedes
      // means the same question kept in step through a shared field, the way
      // vomiting and appetite are. These are NOT the same question: the
      // assessment asks whether drinking looks normal today, and this asks
      // how it compares to what was normal for {name} before the kidneys
      // were involved. Keeping them in step would force one answer to stand
      // for both, and the two can honestly differ.
      {
        key: 'water_intake',
        // "Drinking", not "Water Intake" — Ash's call. The measured question
        // directly below it is "Daily Water Intake", and two questions one
        // after the other whose names differ by one word is a reliable way to
        // get an impression typed into the box meant for millilitres.
        //
        // The KEY stays `water_intake`: it is what every entry already
        // logged is stored against, and renaming it would orphan them.
        label: 'Drinking',
        type: 'scale',
        covers: 'waterIntake',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // The scale branch of evaluateParameter reads `emergencyMessage`, and
        // a parameter without one draws the hazard colour with no words
        // under it. The marker in the level text makes it an emergency; this
        // is what tells the owner to act on it.
        emergencyMessage: SEEK_VET_ASAP,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Increased thirst is a very common symptom of kidney disease. '
          + 'Measuring daily water intake can help your vet to determine whether {name} is drinking excessively.',
        levels: {
          dog: [
            'Drinking the amount {they} normally {do}.',
            'Drinking slightly more than usual, or emptying the bowl a little sooner.',
            'Noticeably more than usual. The bowl needs refilling more often than it used to.',
            'Drinking a lot more. Seeking out other water — puddles, the toilet, taps.',
            'Drinking almost constantly, and {their} bowl needs refilling several times a day.',
            'Barely drinking at all, or cannot keep water down. (emergency)',
          ],
          cat: [
            'Drinking the amount {they} normally {do}.',
            'Drinking slightly more than usual, or visiting the bowl a little more often.',
            'Noticeably more than usual. Spending longer at the bowl, or going back more often.',
            'Drinking a lot more. Seeking out other water — taps, glasses, the shower, plant pots.',
            'Drinking almost constantly, and {their} bowl needs refilling several times a day.',
            'Barely drinking at all, or cannot keep water down. (emergency)',
          ],
        },
      },

      // The measured number, alongside the scale rather than instead of it.
      //
      // Two questions about water looks like duplication and is not. The
      // scale is answerable by anyone — it asks how this compares to what was
      // normal — and a millilitre figure is the one an owner can hand to a
      // vet. Plenty of households cannot produce the number at all (two cats,
      // one bowl; a dog who drinks from puddles), which is exactly why the
      // scale has to stand on its own and the number has to be skippable.
      // "Not sure" comes free with every parameter type, and the note at the
      // bottom of the guide points at it deliberately.
      {
        key: 'water_intake_ml',
        label: 'Daily Water Intake',
        type: 'number',
        // Graphed, for the same reason as RRR. The whole point of measuring
        // in millilitres rather than judging it is the trend across days, and
        // the guide on this question says exactly that.
        chart: true,
        unit: 'ml',
        min: 0,
        max: 10000,
        step: 1,
        placeholder: 'e.g. 450',
        covers: 'waterIntake',
        relationship: RELATIONSHIP.DISTINCT,
        // NO THRESHOLD, deliberately. What counts as too much depends on body
        // weight, and this form does not know what {name} weighs — a number
        // that flags 800ml would be wrong for a Labrador and far too late for
        // a cat. Trend over days is what this is for.
        //
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. If you want a threshold here it needs to be per kg,
        // and the form would need {name}'s weight to apply it.
        why:
          'A measured amount is more useful to your vet than an impression, and the trend over several days is more useful than any single day.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her steps, verbatim,
        // with sentence capitals and full stops added and "this will =" in
        // step 3 written out as "is".
        howToTitle: 'How To Measure Daily Water Intake',
        howTo: [
          'Measure how much (in ml) water goes into {name}\'s bowl at the start of the day. (Starting amount.)',
          'Measure how much (in ml) is left after 24 hours. (Finishing amount.)',
          'Subtract the finishing amount from the starting amount. This is {name}\'s daily water intake.',
          'Do this over a few days to get an idea of the average daily intake.',
        ],
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her note, verbatim.
        howToFooter:
          'Note: this can be difficult/impossible to measure if there are multiple pets in the house that share the same water bowl. If you cannot measure {name}\'s water intake, that\'s ok! Just select "Not sure".',
      },

      // Same reasoning as water intake above: the daily assessment asks whether
      // urination looks normal, this asks how much and how often against
      // {name}'s own baseline. Species-split because the evidence is
      // different — a litter tray can be weighed and a garden cannot.
      {
        key: 'urination',
        label: 'Urination',
        type: 'scale',
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // The scale branch of evaluateParameter reads `emergencyMessage`, and
        // a parameter without one draws the hazard colour with no words
        // under it. The marker in the level text makes it an emergency; this
        // is what tells the owner to act on it.
        emergencyMessage: SEEK_VET_ASAP,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        why:
          'Kidneys that are struggling to concentrate urine produce more of it, so drinking more and passing more usually go together. A sudden drop in how much is being passed matters just as much as an increase.',
        levels: {
          // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her six levels, with
          // sentence capitals and full stops added.
          //
          // The top rung folds in complete anuria, the same way the cat list
          // below does — which is what made the separate "Passing No Urine At
          // All" question redundant.
          dog: [
            'No changes in urination patterns noted.',
            'Urinating slightly more than usual, or asking to go out more frequently.',
            'Urinating more often and larger amounts. Asking to go out more frequently, including at night time.',
            'Urinating frequently throughout the day and night. Occasional accidents inside.',
            'Urinating or trying to urinate constantly. Frequent accidents inside or incontinence.',
            'Constantly trying to urinate but only passing small amounts, or not passing anything at all (end-stage kidney failure). (emergency)',
          ],
          // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her six levels, with
          // sentence capitals and full stops added.
          //
          // The top rung folds in complete anuria, which is why the separate
          // "Passing No Urine At All" question that used to sit at the bottom
          // of this section has gone: it was asking again, less well, what
          // this rung already asks.
          //
          // THE CAT LIST FLAGS ONE RUNG EARLIER THAN THE DOG'S, on Ash's
          // instruction 3 Sep 2026: severe and very severe are both
          // emergencies for a cat, very severe only for a dog. A cat going in
          // and out of the tray constantly and producing little is how a
          // urinary obstruction presents, and waiting for the bottom rung
          // means waiting for a cat that has stopped passing urine at all.
          cat: [
            'No changes in urination noted lately.',
            'Urinating slightly more often than usual.',
            'Urinating more often than usual and larger amounts.',
            'Urinating frequently, often large amounts at a time and sometimes outside of the litter tray.',
            'Urinating constantly, often outside of the litter tray. May be incontinent. (emergency)',
            'Constant dribbling of urine/incontinence OR urinating less / complete lack of urination (end-stage kidney failure). (emergency)',
          ],
        },
      },

      // Nausea, separately from appetite.
      //
      // Declared against appetite even though the overlap check does not
      // demand it — nothing in "nausea" matches its appetite pattern. It is
      // declared anyway because the honest answer is that they are related
      // and the decision was made on purpose: a pet can be nauseous and still
      // eat, and can be off food for reasons that have nothing to do with
      // nausea, so these do not collapse into one question.
      {
        key: 'nausea',
        label: 'Nausea',
        type: 'scale',
        // The scale branch of evaluateParameter reads `emergencyMessage`, and
        // a parameter without one draws the hazard colour with no words
        // under it. The marker in the level text makes it an emergency; this
        // is what tells the owner to act on it.
        emergencyMessage: SEEK_VET_ASAP,
        covers: 'appetite',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        why:
          'Nausea is a common symptom of kidney disease. It is worth mentioning it to your vet as it can often be relieved with certain medications.',
        levels: {
          dog: [
            'No signs of nausea.',
            'Occasional lip licking or swallowing, but eating normally.',
            'Lip licking, drooling or turning away from food at times.',
            'Frequently drooling or lip licking. Approaches food then walks away from it.',
            'Clearly nauseous for much of the day. Refusing food. (emergency)',
            'Constantly nauseous, drooling heavily, or retching without bringing anything up. (emergency)',
          ],
          cat: [
            'No signs of nausea.',
            'Occasional lip licking or swallowing, but eating normally.',
            'Lip licking, drooling, or sitting hunched over the bowl without eating.',
            'Frequently drooling or lip licking. Approaches food then walks away from it.',
            'Clearly nauseous for much of the day. Refusing food. (emergency)',
            'Constantly nauseous, drooling heavily, or retching without bringing anything up. (emergency)',
          ],
        },
      },

      // The shared vomiting question, exactly as Gastrointestinal Disease
      // uses it. Two records of how much a pet vomited on one day, free to
      // disagree, is the problem this mechanism exists to prevent — and a pet
      // with both kidney disease and a GI condition would otherwise have
      // three.
      {
        key: 'vomiting',
        label: 'Vomiting',
        type: 'vomiting',
        assessmentField: 'vomiting',
        covers: 'vomiting',
        relationship: RELATIONSHIP.SUPERSEDES,
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026.
        concernMessage:
          'Worth mentioning to your vet. Vomiting secondary to kidney disease can often be relieved with certain medications.',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
        emergencyMessage:
          'Blood in the vomit needs veterinary attention as soon as possible.',
      },

      // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The levels and the threshold. Uraemic signs in the mouth are
      // specific to kidney disease and easy for an owner to check, which is
      // an unusual combination and the reason this is here rather than folded
      // into nausea.
      {
        key: 'mouth',
        label: 'Breath And Mouth',
        type: 'scale',
        // The scale branch of evaluateParameter reads `emergencyMessage`, and
        // a parameter without one draws the hazard colour with no words
        // under it. The marker in the level text makes it an emergency; this
        // is what tells the owner to act on it.
        emergencyMessage: SEEK_VET_ASAP,
        // Declared against breathing because the overlap check reads the word
        // "breath" and asks. It is right to ask and the answer is no: this is
        // halitosis, and the daily assessment's breathing question is about
        // how hard {name} is working to breathe. Same five letters, nothing
        // else in common — the same situation as the cardiac cough question.
        covers: 'breathing',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026, for the first two
        // sentences. The closing line is kept from the draft.
        why:
          'When the kidneys aren\'t functioning properly, waste products can build up. This can cause bad breath and sores in the mouth. It is worth a look every few days.',
        levels: {
          dog: [
            'Breath and mouth look normal for {them}.',
            'Breath is a little stronger than usual.',
            'Noticeably unpleasant breath.',
            'Strong breath, and the gums or tongue look red or sore.',
            'Visible sores or ulcers in the mouth. (emergency)',
            'Refusing to let you look, drooling, or bleeding from the mouth. (emergency)',
          ],
        },
      },

    ],
  },
}

// Alphabetical by the label the owner actually reads, not by registry key
// (which would put 'cardiac' before 'cognitive' and read as arbitrary). Sorted
// here rather than in the screen so every consumer gets the same order.
export const CONDITION_LIST = Object.values(CONDITIONS).sort((a, b) =>
  a.label.localeCompare(b.label),
)

export const AVAILABLE_CONDITIONS = CONDITION_LIST.filter((entry) => !entry.comingSoon)

export function conditionByKey(key) {
  return CONDITIONS[key] ?? null
}

// --- VCOG-CTCAE ------------------------------------------------------------
//
// The Veterinary Cooperative Oncology Group's Common Terminology Criteria for
// Adverse Events: the standard way a veterinary oncologist grades treatment
// side effects. Grades run 0 (none) to 4 (life-threatening). Grade 5 exists
// in the published criteria and means death, so nothing in an app an owner
// fills in daily should offer it.
//
// Two reasons this is its own type rather than a `scale`:
//
//   1. `scale` is BEAAAAPP-shaped — six levels scored 0/2/4/6/8/10, plotted on
//      a fixed 0-10 axis. VCOG grades plotted on that axis would sit in the
//      bottom half of every chart and read as trivial.
//   2. The report has to print "Grade 2", because that is the number that
//      means something to an oncologist. A 0-10 severity score does not.
//
// The owner never sees the published criteria, which are written for
// clinicians ("increase of N stools per day over baseline") and would be
// misgraded by anyone counting at home. Each grade instead carries an
// owner-facing description; the owner picks the description, the app stores
// and charts the grade.
export const VCOG_MIN_GRADE = 0
export const VCOG_MAX_GRADE = 4
export const VCOG_SCORES = [0, 1, 2, 3, 4]

export const VCOG_GRADE_LABELS = ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']

// Deliberately NOT the BEAAAAPP band colours. Those run across six levels;
// these run across five, and grade 3 is the conventional point at which an
// oncologist wants to hear from the owner.
export const VCOG_GRADE_COLOURS = [
  '#3D8259',
  '#3D8259',
  '#C97A2E',
  '#A33A2E',
  '#A33A2E',
]

export function vcogColourForIndex(index) {
  return VCOG_GRADE_COLOURS[index] ?? VCOG_GRADE_COLOURS[VCOG_GRADE_COLOURS.length - 1]
}

// The BEAAAAPP appetite level a VCOG anorexia grade corresponds to.
//
// A cancer patient answers ONE question about eating — the graded one — and
// this is how that answer reaches the daily assessment's appetite category so
// the owner is not asked twice about the same meal.
//
// The values are BEAAAAPP SEVERITIES, so 0 is eating normally and 10 is
// refusing food. That is the direction beap.appetite is stored in, and the
// overview inverts it for display; producing a "higher is better" score here
// would silently invert the pillar.
//
// Five grades onto six levels, so grade 1 spans two of them: it covers both
// "Slightly slower to eat" and "A bit picky, some hesitancy". Only one value
// can be recorded, and it records the MILDER of the two — Ash's call. A pet
// whose owner has said "eating a little less, but still eating meals" reads
// as closer to normal than to picky, and erring the other way would make the
// step from grade 0 to grade 1 look like a bigger fall than it is on the
// appetite pillar and the overall percentage.
//
// The consequence, stated plainly: severity 4 is never written by this route.
// It remains reachable when the owner answers appetite in the daily
// assessment themselves.
//
//   grade 0  Eating normally                              -> 0   Eating normally
//   grade 1  A little less than usual, still eating meals  -> 2   Slightly slower to eat
//   grade 2  Noticeably less; coaxing, or favourites only  -> 6   Eating noticeably less
//   grade 3  Very little for more than a day despite coaxing -> 8 Little interest, even treats
//   grade 4  Not eating at all                            -> 10  Refusing food
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
export const BEAP_APPETITE_BY_VCOG_GRADE = [0, 2, 6, 8, 10]

// And back the other way.
//
// This exists because grade 1 covers two BEAAAAPP levels rather than one, so
// both of them land on it — there is no level whose grade is ambiguous. That
// was the missing piece: without it the conversion could only run one way,
// and the cancer form could not be pre-filled from the assessment.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026.
export const VCOG_GRADE_BY_BEAP_APPETITE = { 0: 0, 2: 1, 4: 1, 6: 2, 8: 3, 10: 4 }

export function vcogGradeFromBeapAppetite(score) {
  const value = Number(score)
  if (!Number.isFinite(value)) return null
  return VCOG_GRADE_BY_BEAP_APPETITE[value] ?? null
}

// The daily assessment stores sleep as a SCORE — 10 is sleeping normally,
// 0 is not — because that is the direction every everyday-function question
// runs and what the sleep pillar multiplies up for display. A condition
// stores the same answer as a SEVERITY, 0 best. Same six levels either way,
// so the conversion is a subtraction and nothing is lost in either
// direction.
// The option a stored value should light up.
//
// Two things break a plain equality check. A value can arrive as a string
// from JSON, and it can be a number the current picker does not offer — the
// sleep slider this replaced stored anything from 0 to 10, so a night
// recorded as 7 matches none of the six options and the question renders as
// though it were never answered. Both would make a pre-filled answer look
// unanswered, which is exactly the confusion the pre-fill exists to remove.
//
// Nearest wins, and a tie goes to the gentler reading — a legacy 7 shows as
// 8 rather than 6, because inventing a worse answer than the owner gave is
// the more harmful of the two errors.
export function snapToOption(value, options) {
  // Guarded BEFORE Number(), because Number(null), Number(undefined ?? '')
  // and Number('') are all 0 — which would light up "no abnormalities" on a
  // question nobody has answered. An invented healthy answer is the worst
  // failure this function could have.
  if (value == null || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  let best = null
  for (const option of options) {
    if (best == null) { best = option; continue }
    const gap = Math.abs(option - numeric)
    const bestGap = Math.abs(best - numeric)
    if (gap < bestGap || (gap === bestGap && option > best)) best = option
  }
  return best
}

export function sleepScoreFromSeverity(severity) {
  const value = Number(severity)
  return Number.isFinite(value) ? 10 - value : null
}

export function sleepSeverityFromScore(score) {
  const value = Number(score)
  return Number.isFinite(value) ? 10 - value : null
}

export function beapAppetiteFromVcogGrade(grade) {
  const index = Number(grade)
  if (!Number.isFinite(index)) return null
  return BEAP_APPETITE_BY_VCOG_GRADE[index] ?? null
}

// Owner-facing text for each grade, lowest first. Falls back to an empty list
// so a parameter still under authoring renders nothing rather than throwing.
export function vcogLevelsFor(parameter) {
  return (parameter.grades ?? []).map((entry) => entry.owner ?? '')
}

// The six option texts for a scale parameter, in the right species' wording.
//
// Two sources: 'beap' borrows a BEAAAAPP category so the wording can never
// drift from the main assessment, and 'scale' carries its own because the
// question is genuinely different. Both fall back to dog the same way
// BeapCategoryPage does, so an unexpected species renders something sensible
// rather than nothing.
export function levelsFor(parameter, species) {
  if (parameter.type === 'vcog') {
    return vcogLevelsFor(parameter)
  }
  if (parameter.type === 'scale') {
    return parameter.levels?.[species] ?? parameter.levels?.dog ?? []
  }
  const scale = BEAP_SCALES[species] ?? BEAP_SCALES.dog
  return scale.find((entry) => entry.key === parameter.beapKey)?.levels ?? []
}

// Kept as the old name for existing callers.
export const beapLevelsFor = levelsFor

// The score at or above which a BEAAAAPP-backed parameter is an emergency,
// straight from the scale definition. null for a parameter that is not
// BEAAAAPP-backed, and for eyes, which has no emergency band at all. The
// parenthetical here used to name palpation too; palpation was given a band
// on 3 Sep 2026 and this was not updated with it.
export function beapEmergencyFromFor(parameter, species) {
  if (parameter?.type !== 'beap' || !parameter.beapKey) return null
  const scale = BEAP_SCALES[species] ?? BEAP_SCALES.dog
  return scale.find((entry) => entry.key === parameter.beapKey)?.emergencyFrom ?? null
}

// Any owner-facing string may be a plain string, or keyed by species where
// part of what it says is only true for one of them.
//
// Used for alert messages, question subtexts, placeholders and citations —
// all of which have now needed it. Falls back to the dog wording for an
// unexpected species, the same way `levelsFor` does, so a string is never
// silently dropped.
export function textForSpecies(value, species) {
  if (value == null || typeof value === 'string') return value
  return value[species] ?? value.dog ?? null
}

// An alert message may be a plain string, or keyed by species where part of
// what it says is only true for one of them.
//
// Straining is why this exists: a dog and a cat straining and producing
// nothing both need to be seen today, but only in the cat is a urinary
// blockage on the list — and telling a dog owner that is noise in the one
// message that most needs to be read and acted on.
//
// Falls back to the dog wording for an unexpected species, the same way
// `levelsFor` does, so an alert is never silently dropped.
function messageFor(message, species) {
  if (message == null || typeof message === 'string') return message
  return message[species] ?? message.dog ?? null
}

// A threshold may be a single number or keyed by species.
function thresholdFor(threshold, species) {
  if (threshold == null) return null
  if (typeof threshold === 'number') return threshold
  return threshold[species] ?? threshold.dog ?? null
}

// What, if anything, to say about an answer.
//
// Returns null when there is nothing to say — including when no threshold is
// configured. Silence is not reassurance: an app monitoring heart failure must
// never imply a reading is fine when it simply has no rule to judge it by.
// 'unsure' is never an answer, so it never triggers anything.
export function evaluateParameter(parameter, value, species) {
  if (value == null || value === '' || value === UNSURE || value === NOT_APPLICABLE) return null

  // Informational parameters are recorded but never judged. The palliative
  // medication module is the reason this exists: drinking more, urinating
  // more and panting are EXPECTED on steroids, and scoring them as concerns
  // would flag a comfortable, well-palliated patient amber every single day
  // and drag their quality of life trend down for something benign. The
  // readings are still logged, charted and exported — a steadily climbing
  // water intake is worth showing a vet — they just aren't deterioration.
  if (parameter.informational) return null

  // A shared assessment field rather than a scale — vomiting is the only one
  // today. The answer is an object, so none of the numeric branches below
  // apply.
  //
  // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The rule, not just the wording. Drafted as: blood is an
  // emergency, any vomiting at all is worth watching, nothing is fine. The
  // assessment scores this question its own way for the quality of life
  // percentage; this is only about whether the condition's DAY is flagged.
  if (parameter.type === 'vomiting') {
    if (typeof value !== 'object') return null
    if (value.hasVomited == null || value.hasVomited === UNSURE) return null
    if (!value.hasVomited) return { severity: SEVERITY.OK }
    if ((value.character ?? []).some((entry) => String(entry).toLowerCase().includes('blood'))) {
      return {
        severity: SEVERITY.EMERGENCY,
        message: messageFor(parameter.emergencyMessage, species),
      }
    }
    return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
  }

  if (parameter.type === 'number') {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null

    const above = thresholdFor(parameter.concernAbove, species)
    const below = thresholdFor(parameter.concernBelow, species)

    if (above != null && numeric > above) {
      return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
    }
    if (below != null && numeric < below) {
      return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
    }
    return { severity: SEVERITY.OK }
  }

  if (parameter.type === 'choice') {
    const option = parameter.options.find((entry) => entry.value === value)
    if (!option) return null
    if (option.severity === SEVERITY.EMERGENCY) {
      return { severity: SEVERITY.EMERGENCY, message: messageFor(parameter.emergencyMessage, species) }
    }
    if (option.severity === SEVERITY.CONCERN) {
      return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
    }
    return { severity: SEVERITY.OK }
  }

  if (parameter.type === 'yesno') {
    if (parameter.emergencyWhen != null && value === parameter.emergencyWhen) {
      return { severity: SEVERITY.EMERGENCY, message: messageFor(parameter.emergencyMessage, species) }
    }
    if (parameter.concernWhen != null && value === parameter.concernWhen) {
      return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
    }
    return { severity: SEVERITY.OK }
  }

  if (parameter.type === 'vcog') {
    const grade = Number(value)
    if (!Number.isFinite(grade)) return null

    // Both cuts are opt-in per parameter. Where grade 3 sits between "manage
    // at home" and "ring the practice" differs by category — grade 3 vomiting
    // and grade 3 lethargy are not the same phone call — so neither is
    // assumed here.
    if (parameter.emergencyFromGrade != null && grade >= parameter.emergencyFromGrade) {
      return { severity: SEVERITY.EMERGENCY, message: messageFor(parameter.emergencyMessage, species) }
    }
    if (parameter.concernFromGrade != null && grade >= parameter.concernFromGrade) {
      return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
    }
    return { severity: SEVERITY.OK }
  }

  if (parameter.type === 'beap' || parameter.type === 'scale') {
    const score = Number(value)
    if (!Number.isFinite(score)) return null

    // The option text already says "(emergency)" — the same marker the main
    // assessment uses to flag its worst two levels. Reading it back means the
    // app can't tell an owner a finding is an emergency and then colour the
    // day green, which is what happened before: these answers were recorded
    // and then contributed nothing to the summary.
    const level = levelsFor(parameter, species)[score / 2]
    if (typeof level === 'string' && level.includes('(emergency)')) {
      return { severity: SEVERITY.EMERGENCY, message: messageFor(parameter.emergencyMessage, species) }
    }

    // A BEAAAAPP-backed parameter keeps its emergency band in beapScales.js
    // rather than in the level text. Same source lib/assessmentSummary.js and
    // the scoring read, so the form, the calendar and the export cannot
    // disagree about which rungs are emergencies.
    const beapEmergencyFrom = beapEmergencyFromFor(parameter, species)
    if (beapEmergencyFrom != null && score >= beapEmergencyFrom) {
      return { severity: SEVERITY.EMERGENCY, message: messageFor(parameter.emergencyMessage, species) }
    }

    // Opt-in per parameter, because how much of a scale counts as concerning
    // is a clinical judgement rather than something to assume. See BEAP_BANDS
    // in scoring.js: 4 is Moderate, 6 Moderate to severe.
    if (parameter.concernFrom != null && score >= parameter.concernFrom) {
      return { severity: SEVERITY.CONCERN, message: messageFor(parameter.concernMessage, species) }
    }
    return { severity: SEVERITY.OK }
  }

  return null
}

// Summary of one day's answers.
//
// Deliberately NOT an average. These findings are not commensurable: a blue
// gum or a collapse means "phone someone now" whatever the other seven say,
// and any averaging dilutes precisely the finding that matters most. So the
// day's severity is its WORST finding — the same principle the overall QoL
// score already uses, where the worst BEAAAAPP category floors the band
// rather than being averaged away.
//
// The counts sit alongside because severity alone can't distinguish "one
// thing is off" from "four things are off", and that difference is often the
// trend an owner and vet actually want to see.
// The parameter list to judge an entry against.
//
// For a condition with a fixed list this is just `condition.parameters`. For
// one composed per pet (cancer), the caller resolves the list first with
// parametersFor() and passes `{ ...definition, parameters: resolved }` — so
// this reads whatever it is handed rather than assuming the static list, and
// a definition carrying no static parameters at all summarises as empty
// instead of throwing.
function parametersOf(condition) {
  return condition?.parameters ?? []
}

// A parameter's name for a list, including which lump or lymph node it was
// about — "Size" on its own is not an answer to "what was flagged?" when a
// pet is being measured in three places.
//
// Exported for the home card, which names the parameter and its band
// ("Itching: Moderate–severe") rather than quoting the level sentence.
export function labelOf(parameter) {
  return parameter.instanceLabel
    ? `${parameter.label} — ${parameter.instanceLabel}`
    : parameter.label
}

// One answer, as the owner would read it back.
//
// The calendar could always say a day was "worth watching"; it could never
// say what was actually answered. This turns a stored value back into the
// words that were on screen when it was given — the level text for a scale,
// the option label for a choice, the number and its unit for a reading.
//
// Returns null where there is nothing to show, so a day's list can skip
// questions that were never answered rather than filling with "—".
export function describeParameterAnswer(parameter, value, species) {
  if (value == null || value === '') return null
  if (value === UNSURE) return 'Not sure'
  if (value === NOT_APPLICABLE) return "Doesn't apply"

  if (parameter.type === 'text') {
    const text = String(value).trim()
    return text || null
  }

  // Stored as ISO because that is what a date input gives and what sorts
  // correctly; read back through lib/formatDate, which is what the rest of
  // the app shows and what the owner wrote on the calendar in the kitchen.
  if (parameter.type === 'date') {
    return isIsoDate(value) ? formatDateDDMMYY(value) : null
  }

  if (parameter.type === 'vomiting') {
    if (typeof value !== 'object') return null
    if (value.hasVomited === UNSURE) return 'Not sure'
    if (value.hasVomited == null) return null
    if (!value.hasVomited) return 'No vomiting'
    const frequency = value.frequency === '' || value.frequency == null
      ? null
      : `${value.frequency}${value.unit ? ` ${value.unit}` : ''}`
    const character = (value.character ?? []).filter(Boolean).join(', ')
    return ['Vomited', frequency, character].filter(Boolean).join(' — ')
  }

  if (parameter.type === 'number') {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    return parameter.unit ? `${numeric} ${parameter.unit}` : String(numeric)
  }

  if (parameter.type === 'yesno') {
    return value === true || value === 'yes' ? 'Yes' : 'No'
  }

  if (parameter.type === 'choice') {
    const option = (parameter.options ?? []).find((entry) => entry.value === value)
    return option?.label ?? String(value)
  }

  // A multi-select reads back as the labels the owner picked, in the order
  // the question lists them rather than the order they were tapped — so the
  // same set of answers always reads the same way.
  if (parameter.type === 'multichoice') {
    const chosen = selectedValues(value)
    if (chosen.length === 0) return null
    const labels = (parameter.options ?? [])
      .filter((entry) => chosen.includes(entry.value))
      .map((entry) => entry.label)
    return labels.length > 0 ? labels.join(', ') : chosen.join(', ')
  }

  if (parameter.type === 'vcog') {
    const grade = Number(value)
    if (!Number.isFinite(grade)) return null
    const owner = vcogLevelsFor(parameter)[grade]
    // The grade is the record a vet reads; the owner wording is the record
    // the owner gave. Both, because this list is shown to one and exported
    // to the other.
    return owner ? `Grade ${grade} — ${stripEmergencyMarker(owner)}` : `Grade ${grade}`
  }

  if (parameter.type === 'beap' || parameter.type === 'scale') {
    const score = Number(value)
    if (!Number.isFinite(score)) return null
    const level = levelsFor(parameter, species)[score / 2]
    return level ? stripEmergencyMarker(level) : String(score)
  }

  return String(value)
}

// The "(emergency)" marker is an instruction to the app, not words for a
// reader. The severity it drives is already shown beside the answer.
function stripEmergencyMarker(text) {
  return String(text).replace(/\s*\(emergency\)\s*/gi, ' ').trim()
}

// What a flagged answer SAYS, rather than which question asked it.
//
// The calendar's day line named the questions that flagged: "Worth watching:
// Has Bailey Had Anything Other Than The Trial Food Today?, Stool
// Consistency". That is the form read back at the owner. It says where to
// look and nothing about what happened, and on the allergy log — where the
// interesting days are the ones with a slip and a soft stool — it was the
// least useful line on the page.
//
// A parameter can instead declare a `finding`, which turns its own answer
// into a statement: "The diet trial was broken — Bailey had half a dental
// chew. Bailey's stool — Very soft, piles rather than holds shape."
//
// Plain data, so the condition definitions stay declarative:
//
//   finding: 'Ears — {answer}'              // one template
//   finding: { yes: '...', no: '...' }      // keyed by the stored value,
//                                           // with an optional `default`
//   findingWithDetail: {...}                // used INSTEAD when the
//   findingDetail: 'diet_slip_detail'       // named key holds text
//
// Tokens: {answer} is the same wording describeParameterAnswer gives, and
// {answer:lower} is that with its first letter lowered so it can sit
// mid-sentence. {detail} is the findingDetail answer. Pet tokens ({name},
// {they}, {s}...) are left alone here and filled by the caller, which is what
// already happens to the labels this replaces.
//
// A parameter that declares nothing falls back to its label, so every
// condition written before this is unchanged.
export function findingFor(parameter, value, species, values) {
  if (!parameter) return null

  const detailKey = parameter.findingDetail
  const rawDetail = detailKey ? values?.[detailKey] : null
  const detail = typeof rawDetail === 'string' ? rawDetail.trim() : ''

  const spec = (detail && parameter.findingWithDetail) || parameter.finding
  if (!spec) return null

  let template = null
  if (typeof spec === 'string') {
    template = spec
  } else if (typeof spec === 'object' && !Array.isArray(spec)) {
    // An object answer (vomiting) has no key to look up, so such a parameter
    // has to use the string form.
    const key = value != null && typeof value !== 'object' ? String(value) : null
    template = (key != null ? spec[key] : undefined) ?? spec.default ?? null
  }
  if (typeof template !== 'string' || template === '') return null

  let text = template
  if (text.includes('{answer}') || text.includes('{answer:lower}')) {
    const answer = describeParameterAnswer(parameter, value, species)
    // No answer means no statement. Falling back to the label here would put
    // a question mid-sentence, which is the thing this exists to stop.
    if (answer == null) return null
    text = text.split('{answer:lower}').join(answer.charAt(0).toLowerCase() + answer.slice(1))
    text = text.split('{answer}').join(answer)
  }
  if (text.includes('{detail}')) text = text.split('{detail}').join(detail)

  return text.trim() || null
}

// Every question on a condition form for one day, with the answer given and
// whether it flagged. Follow-ups sit under the question they belong to, and
// questions that were never answered are dropped rather than listed blank.
export function describeConditionDay(condition, values, species) {
  const rows = []

  // visibleParameters rather than a per-parameter dependency check: it
  // resolves the whole chain, so a question whose PARENT is hidden stays out
  // of the record even though its own stored answer still satisfies its own
  // precondition. The form and the record have to agree about which
  // questions existed.
  for (const parameter of visibleParameters(parametersOf(condition), values)) {
    const value = values?.[parameter.key]
    const answer = describeParameterAnswer(parameter, value, species)
    if (answer == null) continue

    const verdict = evaluateParameter(parameter, value, species)
    rows.push({
      key: parameter.key,
      label: labelOf(parameter),
      answer,
      severity: verdict?.severity ?? null,
    })

    // A follow-up is only meaningful next to the answer that triggered it —
    // "Hips, lower back" on its own is not a finding.
    for (const followUp of followUpsOf(parameter)) {
      const followAnswer = describeParameterAnswer(followUp, values?.[followUp.key], species)
      if (followAnswer == null) continue
      rows.push({
        key: followUp.key,
        label: typeof followUp.label === 'string' ? followUp.label : 'More detail',
        answer: followAnswer,
        severity: null,
        isFollowUp: true,
      })
    }
  }

  return rows
}

export function summariseEntry(condition, values, species) {
  let emergencies = 0
  let concerns = 0
  let answered = 0
  let unsure = 0
  // WHICH parameters flagged, not just how many. "1 flagged" tells an owner
  // there is something to look at and then makes them go and find it —
  // which, on a calendar showing three months, means opening days one at a
  // time until they hit the right one.
  const flagged = []

  // visibleParameters handles two of the three skips: it drops referenced
  // parameters, and it resolves dependencies ALL THE WAY UP — so an owner who
  // came off a diet trial is not still flagged by yesterday's answer to a
  // question the app has stopped asking, nor by an answer to a question whose
  // parent has stopped being asked.
  for (const parameter of visibleParameters(parametersOf(condition), values)) {
    // Skipped before the answered count, not just before the flag count. A
    // day where the owner filled in nothing but the steroid module has not
    // been assessed for concern, and colouring it green would say it had.
    if (parameter.informational) continue

    const value = values?.[parameter.key]
    if (value == null || value === '') continue
    // Not counted as answered OR as unsure. A lymph node that cannot be felt
    // is a normal finding with no number behind it, so it neither flags the
    // day nor marks it as something the owner was unsure about.
    if (value === NOT_APPLICABLE) continue
    if (value === UNSURE) { unsure += 1; continue }
    answered += 1

    const verdict = evaluateParameter(parameter, value, species)
    // A statement of what was answered where the parameter provides one,
    // otherwise the question's name — see findingFor.
    const finding = findingFor(parameter, value, species, values)
    const named = finding ?? labelOf(parameter)
    if (verdict?.severity === SEVERITY.EMERGENCY) {
      emergencies += 1
      flagged.push({
        key: parameter.key, label: named, isFinding: finding != null, severity: SEVERITY.EMERGENCY,
      })
    } else if (verdict?.severity === SEVERITY.CONCERN) {
      concerns += 1
      flagged.push({
        key: parameter.key, label: named, isFinding: finding != null, severity: SEVERITY.CONCERN,
      })
    }
  }

  // Nothing answered is not the same as nothing wrong, so it gets its own
  // state rather than defaulting to OK.
  if (answered === 0) {
    return { severity: null, emergencies: 0, concerns: 0, flags: 0, flagged: [], answered, unsure }
  }

  const severity = emergencies > 0
    ? SEVERITY.EMERGENCY
    : concerns > 0
      ? SEVERITY.CONCERN
      : SEVERITY.OK

  // Worst first, so a day with an emergency and two concerns names the
  // emergency before anything else.
  flagged.sort((a, b) => (
    (a.severity === SEVERITY.EMERGENCY ? 0 : 1) - (b.severity === SEVERITY.EMERGENCY ? 0 : 1)
  ))

  return { severity, emergencies, concerns, flags: emergencies + concerns, flagged, answered, unsure }
}

// How a NUMBER parameter is turned into a line.
//
// Charts left the condition pages on 29 Aug 2026 — calendars here, trends in
// Overall Quality of Life. This is the deliberate exception, and it is
// opt-in: a parameter draws a line only if it says `chart: true`.
//
// Numbers only, and that is the point rather than a limitation. The scales
// were what made a condition page a column of lines nobody read — six rungs
// plotted against time says little the calendar has not already said in
// colour. A measured quantity is different: 24 breaths a minute in June and
// 38 in August is a trend an owner cannot see any other way, and it is the
// number a vet will want. Two questions in the whole app qualify, and if a
// third ever does it will be a number too.
// A `scale` answer is always one of BEAP_SCORES — 0, 2, 4, 6, 8, 10 — so its
// axis is that range and nothing else. See SeverityOptionList, which is what
// renders a scale and what decides the values it can emit.
const SCALE_DOMAIN = [0, 10]

export function numberChartFor(parameter, entries, species) {
  // Two shapes, one chart. A 'number' is a free reading — a respiratory rate,
  // millilitres of water — where the interesting range is whatever the pet
  // actually does. A 'scale' is a fixed 0-10 answer where the range is the
  // scale itself.
  const isScale = parameter.type === 'scale'
  if (!parameter.chart) return null
  if (parameter.type !== 'number' && !isScale) return null

  const points = entries
    .map((entry) => ({ date: entry.date, value: Number(entry.values?.[parameter.key]) }))
    .filter((point) => Number.isFinite(point.value))
  if (points.length === 0) return null

  // concernAbove for a number, concernFrom for a scale — and the two do NOT
  // mean the same thing. concernAbove is exclusive (`numeric > above`);
  // concernFrom is inclusive (`score >= concernFrom`), both in
  // evaluateParameter. The caption below has to say which, or a pruritus of
  // exactly 4 reads as fine on the chart while the app flags it as a concern.
  const isInclusive = parameter.concernAbove == null && parameter.concernFrom != null
  const threshold = thresholdFor(parameter.concernAbove ?? parameter.concernFrom, species)

  const unit = parameter.unit ? ` ${parameter.unit}` : undefined
  const thresholdText = threshold != null
    ? `${threshold}${parameter.unit ? ` ${parameter.unit}` : ''}`
    : null

  let domain
  if (isScale) {
    // The scale's own range, NOT the observed one. Auto-scaling here would
    // draw a steady run of 6-7 filling the full height of the chart, which
    // reads as a catastrophe rather than as "consistently uncomfortable" —
    // and would rescale the moment a good day arrived, so two screenshots a
    // week apart would not be comparable.
    domain = SCALE_DOMAIN
  } else {
    // A little headroom either side so the highest reading is not drawn on
    // the frame of the chart.
    const values = points.map((point) => point.value)
    const pad = Math.max(1, Math.round((Math.max(...values) - Math.min(...values)) * 0.1))
    domain = [Math.max(0, Math.min(...values) - pad), Math.max(...values) + pad]
  }

  return {
    points,
    domain,
    unit,
    threshold,
    caption: thresholdText != null
      ? `The dashed line is ${thresholdText}. Readings ${isInclusive ? 'at or above' : 'above'} it are worth mentioning to your vet, especially if they stay there.`
      : null,
  }
}

export const SEVERITY_COLOURS = {
  [SEVERITY.OK]: '#3D8259',
  [SEVERITY.CONCERN]: '#C97A2E',
  [SEVERITY.EMERGENCY]: '#A33A2E',
}

export const SEVERITY_LABELS = {
  [SEVERITY.OK]: 'Nothing flagged',
  [SEVERITY.CONCERN]: 'Worth watching',
  [SEVERITY.EMERGENCY]: 'Needs attention',
}

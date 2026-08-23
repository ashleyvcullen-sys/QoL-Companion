// Condition monitoring definitions.
//
// ============================================================================
// THIS IS THE FILE TO EDIT. Everything a condition needs — its name, what
// gets logged, wording, units, thresholds, what counts as an emergency —
// lives here as plain data. Adding a condition, adding a parameter, or
// changing wording is an edit to this file alone.
// ============================================================================
//
// CLINICAL CONTENT: written and signed off by Ash Cullen (BVSc), 23 Aug 2026.
// Anything added later that has NOT been through him must be marked PENDING.
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
//
// Any parameter may carry a `followUp`, shown only when the parent answer
// matches `followUp.when`. Follow-up answers are stored under their own key.

// Imported as named components rather than built here: this file is .js, and
// Vite does not transform JSX in a .js file.
import { BoneOrganIcon, HeartOrganIcon, KidneyOrganIcon } from '../components/icons/OrganIcon'
import { BEAP_SCALES } from './beapScales'

export const SEVERITY = { OK: 'ok', CONCERN: 'concern', EMERGENCY: 'emergency' }

export const UNSURE = 'unsure'

export const CONDITIONS = {
  cardiac: {
    key: 'cardiac',
    label: 'Heart disease',
    Icon: HeartOrganIcon,
    // Shown on the condition list to say what monitoring involves before
    // someone commits to it.
    summary: 'Breathing rate and effort, coughing, exercise tolerance, gum colour and more.',
    intro:
      'Tracking a few things at home between visits shows how well treatment is holding, and can catch a change days before it becomes an emergency.',
    parameters: [
      {
        key: 'resting_respiratory_rate',
        label: 'Resting breathing rate',
        type: 'number',
        unit: 'breaths/min',
        min: 1,
        max: 200,
        step: 1,
        why:
          'This is the single most useful thing you can measure at home. In heart disease, fluid builds up in the lungs before an animal looks unwell, and the breathing rate rises first. A steady upward trend over a few days is often the earliest warning that treatment needs adjusting — usually before any coughing or distress appears.',
        howToTitle: 'How to measure it',
        howTo: [
          'Wait until your pet is asleep, or fully settled and relaxed. Not just after a walk, a meal, or excitement.',
          'Watch the chest. One breath is one rise AND fall together.',
          'Count the breaths for 30 seconds, then double it. That is the rate per minute.',
          'Do not count while a dog is panting, or while a cat is purring — neither gives a true reading.',
          'Measuring at roughly the same time each day makes a trend much easier to see.',
        ],
        // APPROVED — Ash Cullen (BVSc), 23 Aug 2026: 30 breaths/min for both
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
      {
        key: 'respiratory_effort',
        label: 'Breathing effort',
        type: 'beap',
        beapKey: 'breathing',
        why:
          'Rate tells you how fast; effort tells you how hard. Breathing that takes visible work — heaving sides, abdominal push, open-mouth breathing in a cat — matters even when the count looks acceptable.',
      },
      {
        key: 'coughing',
        label: 'Coughing',
        type: 'yesno',
        concernWhen: 'yes',
        why:
          'Coughing in a heart patient can mean fluid in the lungs, or an enlarged heart pressing on the airway. What it sounds like helps tell those apart.',
        concernMessage:
          'Worth mentioning to your vet, particularly if it is new, more frequent, or happening at night.',
        followUp: {
          when: 'yes',
          key: 'cough_character',
          label: 'What does the cough sound like?',
          type: 'choice',
          allowOther: true,
          otherLabel: 'Describe it yourself',
          options: [
            { value: 'moist', label: 'Moist or wet', severity: SEVERITY.CONCERN },
            { value: 'dry', label: 'Dry or hacking', severity: SEVERITY.CONCERN },
          ],
        },
      },
      {
        key: 'exercise_tolerance',
        label: 'Exercise tolerance',
        type: 'choice',
        why:
          'Tiring sooner than usual, or stopping on a walk they would normally manage, is often the first thing an owner notices — and it tends to change before anything else does.',
        options: [
          { value: 'normal', label: 'Normal', severity: SEVERITY.OK },
          { value: 'reduced', label: 'Reduced', severity: SEVERITY.CONCERN },
        ],
        concernMessage: 'Worth noting, especially if it is a change from the last few days.',
        followUp: {
          when: 'reduced',
          key: 'exercise_notes',
          label: 'What have you noticed?',
          type: 'text',
          placeholder: 'e.g. stopped halfway on the usual walk, lay down after five minutes',
        },
      },
      {
        key: 'syncope',
        label: 'Fainting or collapsing',
        type: 'yesno',
        emergencyWhen: 'yes',
        why:
          'A faint or collapse means the brain briefly lost its blood supply. In a heart patient this always needs veterinary attention, even if your pet seems completely normal afterwards.',
        emergencyMessage:
          'Contact your vet or an emergency service now. A collapse needs to be assessed today, even if your pet seems fine again.',
        followUp: {
          when: 'yes',
          key: 'syncope_notes',
          label: 'What happened?',
          type: 'text',
          placeholder: 'e.g. after excitement at the door, out for a few seconds, came round on their own',
        },
      },
      {
        key: 'mucous_membranes',
        label: 'Gum colour',
        type: 'choice',
        why:
          'Gum colour reflects how well oxygenated blood is reaching the tissues. Pink is what you want. Blue or white means oxygen or circulation is failing.',
        howToTitle: 'How to check',
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
      {
        key: 'abdominal_distension',
        label: 'Swollen or bloated tummy',
        type: 'yesno',
        concernWhen: 'yes',
        why:
          'In right-sided heart failure, fluid can collect in the abdomen. It usually builds gradually, so it is easy to miss day to day and easier to spot when you are looking for it.',
        concernMessage: 'Mention this to your vet, particularly if it is new or increasing.',
        followUp: {
          when: 'yes',
          key: 'distension_notes',
          label: 'Anything to add?',
          type: 'text',
          placeholder: 'e.g. noticeably rounder than last week, firm to touch',
        },
      },
      {
        key: 'appetite',
        label: 'Appetite',
        type: 'beap',
        beapKey: 'appetite',
        why:
          'Appetite often falls away as heart failure progresses, and some heart medications can affect it too. A sustained drop is worth raising.',
      },
    ],
  },

  // --- Planned, not yet built -------------------------------------------
  //
  // Listed so the condition page shows what's coming rather than a list of
  // one. Deliberately carry NO clinical content: no parameters, no
  // thresholds, no wording that could be mistaken for reviewed guidance.
  // `comingSoon` is what stops them being openable.
  arthritis: {
    key: 'arthritis',
    label: 'Arthritis and mobility',
    Icon: BoneOrganIcon,
    summary: 'Stiffness, lameness, willingness to move, and how pain relief is holding.',
    comingSoon: true,
    parameters: [],
  },

  kidney: {
    key: 'kidney',
    label: 'Kidney disease',
    Icon: KidneyOrganIcon,
    summary: 'Appetite, weight, drinking and urination, nausea and vomiting.',
    comingSoon: true,
    parameters: [],
  },
}

export const CONDITION_LIST = Object.values(CONDITIONS)

export const AVAILABLE_CONDITIONS = CONDITION_LIST.filter((entry) => !entry.comingSoon)

export function conditionByKey(key) {
  return CONDITIONS[key] ?? null
}

// BEAAAAPP levels for a parameter, in the right species' wording. Falls back
// to dog the same way BeapCategoryPage does, so an unexpected species renders
// something sensible rather than nothing.
export function beapLevelsFor(parameter, species) {
  const scale = BEAP_SCALES[species] ?? BEAP_SCALES.dog
  return scale.find((entry) => entry.key === parameter.beapKey)?.levels ?? []
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
  if (value == null || value === '' || value === UNSURE) return null

  if (parameter.type === 'number') {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null

    const above = thresholdFor(parameter.concernAbove, species)
    const below = thresholdFor(parameter.concernBelow, species)

    if (above != null && numeric > above) {
      return { severity: SEVERITY.CONCERN, message: parameter.concernMessage }
    }
    if (below != null && numeric < below) {
      return { severity: SEVERITY.CONCERN, message: parameter.concernMessage }
    }
    return { severity: SEVERITY.OK }
  }

  if (parameter.type === 'choice') {
    const option = parameter.options.find((entry) => entry.value === value)
    if (!option) return null
    if (option.severity === SEVERITY.EMERGENCY) {
      return { severity: SEVERITY.EMERGENCY, message: parameter.emergencyMessage }
    }
    if (option.severity === SEVERITY.CONCERN) {
      return { severity: SEVERITY.CONCERN, message: parameter.concernMessage }
    }
    return { severity: SEVERITY.OK }
  }

  if (parameter.type === 'yesno') {
    if (parameter.emergencyWhen != null && value === parameter.emergencyWhen) {
      return { severity: SEVERITY.EMERGENCY, message: parameter.emergencyMessage }
    }
    if (parameter.concernWhen != null && value === parameter.concernWhen) {
      return { severity: SEVERITY.CONCERN, message: parameter.concernMessage }
    }
    return { severity: SEVERITY.OK }
  }

  // BEAAAAPP levels carry their own severity via the shared scoring bands and
  // the "(emergency)" marker the assessment already uses, so nothing extra is
  // layered on here.
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
export function summariseEntry(condition, values, species) {
  let emergencies = 0
  let concerns = 0
  let answered = 0
  let unsure = 0

  for (const parameter of condition.parameters) {
    const value = values?.[parameter.key]
    if (value == null || value === '') continue
    if (value === UNSURE) { unsure += 1; continue }
    answered += 1

    const verdict = evaluateParameter(parameter, value, species)
    if (verdict?.severity === SEVERITY.EMERGENCY) emergencies += 1
    else if (verdict?.severity === SEVERITY.CONCERN) concerns += 1
  }

  // Nothing answered is not the same as nothing wrong, so it gets its own
  // state rather than defaulting to OK.
  if (answered === 0) return { severity: null, emergencies: 0, concerns: 0, flags: 0, answered, unsure }

  const severity = emergencies > 0
    ? SEVERITY.EMERGENCY
    : concerns > 0
      ? SEVERITY.CONCERN
      : SEVERITY.OK

  return { severity, emergencies, concerns, flags: emergencies + concerns, answered, unsure }
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

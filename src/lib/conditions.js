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
    label: 'Heart Disease',
    Icon: HeartOrganIcon,
    // Shown on the condition list to say what monitoring involves before
    // someone commits to it.
    summary: 'Breathing rate and effort, coughing, exercise tolerance, gum colour and more.',
    intro:
      'Monitoring parameters such as resting breathing rate and exercise tolerance can help catch subtle changes over time. Earlier detection often leads to earlier intervention and better outcomes.',
    parameters: [
      {
        key: 'resting_respiratory_rate',
        label: 'Resting Respiratory (Breathing) Rate',
        type: 'number',
        unit: 'breaths/min',
        min: 1,
        max: 200,
        step: 1,
        why:
          '**This is one of the most subtle but useful things you can measure at home.** In many cases of heart disease, fluid can build up in the lungs, leading to an increased breathing rate at rest. This often occurs before more obvious signs of sickness. A resting respiratory rate (RRR) of **consistently more than 30 breaths per minute** warrants a vet visit sooner rather than later.',
        howToTitle: 'How to Measure Resting Breathing Rate',
        howTo: [
          'Ensure {name} is completely asleep and relaxed (i.e. not straight after a walk or excitement).',
          'Watch the chest. One breath is the rise AND fall of the chest.',
          'Count the breaths for 30 seconds, then double it. That is the rate per minute.',
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
        label: 'Breathing Effort',
        // Its OWN levels rather than the BEAAAAPP breathing scale. That scale
        // deliberately blends rate and effort ("faster", "quicker", "rapid"),
        // which is right for a general assessment but wrong here: rate is
        // already captured as a number directly above, so an owner would be
        // answering the same question twice and the two could disagree.
        // These describe work of breathing only — chest excursion, abdominal
        // push, posture, open-mouth breathing.
        //
        // PENDING ASH — drafted, not yet reviewed. Same 6-level, 0-10 shape
        // as BEAAAAPP, and the "(emergency)" marker is load-bearing: the
        // picker reads it to flag those options.
        type: 'scale',
        levels: {
          dog: [
            'Effortless. The chest moves gently and evenly, mouth closed.',
            'Slightly deeper chest movement, but still relaxed. The tummy stays still.',
            'Chest movement is easy to see, and the tummy sometimes moves with it.',
            'Obvious effort — the tummy pushes in and out with each breath, nostrils may flare.',
            'Laboured at rest — the tummy heaves with every breath, elbows held away from the body, head and neck extended. (emergency)',
            'Struggling — open-mouth gasping, unable to settle or lie down. Gums may appear white or blue. (emergency)',
          ],
          cat: [
            'Effortless. The chest moves gently and evenly, mouth closed.',
            'Slightly deeper chest movement, but still relaxed. The tummy stays still.',
            'Chest movement is easy to see, and the tummy sometimes moves with it.',
            'Obvious effort — the tummy pushes in and out with each breath, may sit hunched with elbows out.',
            'Open-mouth breathing with the tummy heaving. Cats rarely breathe through the mouth unless they are in trouble. (emergency)',
            'Struggling — gasping, head and neck extended, unable to settle. Gums may appear white or blue. (emergency)',
          ],
        },
        why:
          'Breathing effort tells us how hard {name} is working to get oxygen — not how fast, which you have already counted above. This does not need to be assessed while {name} is completely asleep but ideally should be done when {they} {are} relaxed.',
      },
      {
        key: 'coughing',
        label: 'Coughing',
        type: 'yesno',
        concernWhen: 'yes',
        why:
          'Coughing in a heart patient can mean fluid in the lungs, or an enlarged heart pressing on the airway. What it sounds like helps tell those apart.',
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
      {
        key: 'exercise_tolerance',
        label: 'Exercise Tolerance',
        type: 'choice',
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
          placeholder: 'e.g. after excitement at the door, out for a few seconds, came round on their own',
        },
      },
      {
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
      {
        key: 'abdominal_distension',
        label: 'Swollen or Bloated Tummy',
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
      {
        key: 'appetite',
        label: 'Appetite',
        type: 'beap',
        beapKey: 'appetite',
        why:
          'Appetite can often reduce gradually as heart failure progresses.',
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
    label: 'Arthritis and Mobility',
    Icon: BoneOrganIcon,
    summary: 'Stiffness, lameness, willingness to move, and how pain relief is holding.',
    comingSoon: true,
    parameters: [],
  },

  kidney: {
    key: 'kidney',
    label: 'Kidney Disease',
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

// The six option texts for a scale parameter, in the right species' wording.
//
// Two sources: 'beap' borrows a BEAAAAPP category so the wording can never
// drift from the main assessment, and 'scale' carries its own because the
// question is genuinely different. Both fall back to dog the same way
// BeapCategoryPage does, so an unexpected species renders something sensible
// rather than nothing.
export function levelsFor(parameter, species) {
  if (parameter.type === 'scale') {
    return parameter.levels?.[species] ?? parameter.levels?.dog ?? []
  }
  const scale = BEAP_SCALES[species] ?? BEAP_SCALES.dog
  return scale.find((entry) => entry.key === parameter.beapKey)?.levels ?? []
}

// Kept as the old name for existing callers.
export const beapLevelsFor = levelsFor

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

// How a parameter is turned into something graphable.
//
// Four shapes behind one picker, each with its own axis and its own caption,
// because pretending they share a scale would be worse than not charting
// them. BEAAAAPP values are inverted so that, like every other chart in the
// app, up means better — the raw scale runs the other way.
export function chartConfigFor(parameter, entries, species) {
  const read = (entry) => entry.values?.[parameter.key]

  if (parameter.type === 'number') {
    const points = entries
      .map((entry) => ({ date: entry.date, value: Number(read(entry)) }))
      .filter((point) => Number.isFinite(point.value))
    if (points.length === 0) return null

    const values = points.map((point) => point.value)
    const pad = Math.max(1, Math.round((Math.max(...values) - Math.min(...values)) * 0.1))
    const above = parameter.concernAbove
    const threshold = above == null
      ? null
      : typeof above === 'number' ? above : (above[species] ?? above.dog ?? null)

    return {
      points,
      domain: [Math.max(0, Math.min(...values) - pad), Math.max(...values) + pad],
      unit: parameter.unit ? ` ${parameter.unit}` : undefined,
      threshold,
      caption: threshold != null
        ? `The dashed line is ${threshold}${parameter.unit ? ` ${parameter.unit}` : ''}. Readings above it are worth mentioning to your vet, especially if they stay there.`
        : null,
    }
  }

  if (parameter.type === 'beap' || parameter.type === 'scale') {
    const points = entries
      .map((entry) => ({ date: entry.date, value: 10 - Number(read(entry)) }))
      .filter((point) => Number.isFinite(point.value))
    if (points.length === 0) return null
    return {
      points,
      domain: [0, 10],
      caption: '10 is best, 0 is worst — the same direction as the other charts in the app.',
    }
  }

  if (parameter.type === 'yesno') {
    const points = entries
      .map((entry) => ({ date: entry.date, value: read(entry) === 'yes' ? 1 : read(entry) === 'no' ? 0 : null }))
      .filter((point) => point.value != null)
    if (points.length === 0) return null
    return {
      points,
      domain: [0, 1],
      caption: 'The line sits at the top on days you answered yes, and at the bottom on days you answered no.',
    }
  }

  if (parameter.type === 'choice') {
    // Plotted by severity rather than by which option was chosen: the options
    // are named states, and a line drawn between "pale pink" and "blue" as if
    // they were adjacent numbers would invent a scale that doesn't exist.
    const rank = { [SEVERITY.OK]: 0, [SEVERITY.CONCERN]: 1, [SEVERITY.EMERGENCY]: 2 }
    const points = entries
      .map((entry) => {
        const option = parameter.options.find((o) => o.value === read(entry))
        return option ? { date: entry.date, value: rank[option.severity] ?? 0 } : null
      })
      .filter(Boolean)
    if (points.length === 0) return null
    return {
      points,
      domain: [0, 2],
      caption: '0 means nothing flagged, 1 worth watching, 2 needs attention.',
    }
  }

  return null
}

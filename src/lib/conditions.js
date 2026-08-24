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
import {
  BoneOrganIcon,
  CancerOrganIcon,
  CognitiveOrganIcon,
  GutOrganIcon,
  HeartOrganIcon,
  KidneyOrganIcon,
  SeizureOrganIcon,
} from '../components/icons/OrganIcon'
import { BEAP_SCALES } from './beapScales'

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
//   reference   Not asked here at all. The daily assessment's answer is what
//               this condition charts. Removes a question from the form.
//   supersedes  Asked here, in more detail or in a context the daily
//               assessment does not cover. Both answers are kept; neither is
//               derived from the other.
//   distinct    A genuinely different question that happens to sit in the
//               same domain. The comment above it has to say how — `why` is
//               owner-facing text and is not the place for it.
//
// Only `reference` changes behaviour today. The other two are declarations —
// they exist so scripts/check-parameter-overlap.mjs can fail when a NEW
// parameter quietly overlaps a daily measure and says nothing about it, which
// is exactly how the appetite duplication got in.
//
// `covers` names a key from INDIVIDUAL_MEASURES in scoring.js. A `reference`
// additionally has to name one of OVERVIEW_PILLAR_KEYS, because those are the
// only series the condition page can currently plot from — the check enforces
// that too, so a reference cannot silently lose its chart.
export const RELATIONSHIP = {
  REFERENCE: 'reference',
  SUPERSEDES: 'supersedes',
  DISTINCT: 'distinct',
}

// Whether the owner is actually asked this. A referenced parameter still
// belongs to the condition — it is charted on the condition page and offered
// in the report — it just is not a question on the form.
export function isAsked(parameter) {
  return parameter?.relationship !== RELATIONSHIP.REFERENCE
}

export function askedParameters(parameters = []) {
  return parameters.filter(isAsked)
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
}

export function sharedParameter(key, overrides = {}) {
  const base = SHARED_PARAMETERS[key]
  if (!base) return null
  return { ...base, ...overrides }
}

export const CONDITIONS = {
  cardiac: {
    key: 'cardiac',
    label: 'Heart Disease',
    Icon: HeartOrganIcon,
    // Shown on the condition list to say what monitoring involves before
    // someone commits to it.
    summary:
      'Includes conditions such as myxomatous mitral valve disease (MMVD), dilated cardiomyopathy (DCM) and hypertrophic cardiomyopathy (HCM).',
    intro:
      'Monitoring parameters such as resting breathing rate and exercise tolerance can help catch subtle changes over time. Earlier detection often leads to earlier intervention and better outcomes.',
    parameters: [
      {
        key: 'resting_respiratory_rate',
        label: 'Resting Respiratory (Breathing) Rate (RRR)',
        type: 'number',
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
          '**If the RRR is consistently greater than 30 breaths per minute, contact your veterinarian.**',
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
          placeholder: 'e.g. after excitement at the door, out for a few seconds, came round on their own',
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
      // Referenced, not asked.
      //
      // This was the BEAAAAPP appetite scale a second time — same six levels,
      // same wording, on a form filled in on the same day as the assessment
      // that already asks it. Removing it removes a question, not a measure:
      // the appetite trend on this page is now drawn from the daily
      // assessment, which is where the number was coming from anyway.
      {
        key: 'appetite',
        label: 'Appetite',
        relationship: RELATIONSHIP.REFERENCE,
        covers: 'appetite',
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
  seizures: {
    key: 'seizures',
    label: 'Seizures',
    Icon: SeizureOrganIcon,
    summary:
      'Includes seizures caused by primary epilepsy, brain lesions, metabolic disease and infection.',
    comingSoon: true,
    parameters: [],
  },

  // Composed rather than declared. `composed: true` is what tells the app to
  // resolve this pet's parameter list from their config (see cancerConfig.js)
  // instead of reading a fixed `parameters` array. The array below stays
  // empty on purpose — a cancer patient's questions depend on which signs
  // their owner is actually watching.
  cancer: {
    key: 'cancer',
    label: 'Cancer',
    Icon: CancerOrganIcon,
    composed: true,
    summary:
      'There are many different types of cancer and they cause different symptoms. This makes it easier to keep track of the ones that matter for your pet.',
    intro:
      'Cancer looks different in every patient. Your vet may have told you exactly what to watch for; if you are still waiting on results, start with the basics and add to it later.',
    // Credited once, at the top of the assessment, the same way the app
    // credits BEAAAAPP and the WSAVA body condition chart — rather than
    // explaining the provenance again inside every graded question.
    // PENDING ASH — confirm the version to cite and the exact wording.
    citation:
      'Adapted from the Veterinary Cooperative Oncology Group — Common Terminology Criteria for Adverse Events (VCOG-CTCAE).',
    parameters: [],
  },

  gastrointestinal: {
    key: 'gastrointestinal',
    label: 'Gastrointestinal Disease',
    Icon: GutOrganIcon,
    summary:
      'Digestive problems can be a condition in their own right — such as IBD, food allergies, infection or parasites — or a sign of something else, like Addison\'s disease or pancreatitis.',
    comingSoon: true,
    parameters: [],
  },

  cognitive: {
    key: 'cognitive',
    label: 'Cognitive Decline',
    Icon: CognitiveOrganIcon,
    // PENDING ASH — written by me, not reviewed.
    summary:
      'Changes in memory, orientation, sleep patterns and interaction that can come with ageing, sometimes called canine or feline dementia.',
    comingSoon: true,
    parameters: [],
  },

  arthritis: {
    key: 'arthritis',
    label: 'Arthritis and Mobility Issues',
    Icon: BoneOrganIcon,
    summary:
      'Stiffness, lameness and willingness to move, and how well pain relief is holding.',
    intro:
      'Arthritis changes slowly, so this one is worth filling in about once a week rather than every day. The questions differ for dogs and cats because the two show it differently — a cat rarely limps, but stops jumping.',
    // How often this is worth filling in. Conditions without a cadence are
    // daily by default, which is what every other one has been until now.
    // Arthritis moves over weeks, not days: a daily prompt would train
    // owners to tick through it without really looking, and seven near-
    // identical entries say no more than one.
    cadence: { days: 7, label: 'weekly', noun: 'week' },
    // PENDING ASH — confirm both instruments and the exact wording. Neither
    // is reproduced here; the parameters follow their domains and the owner
    // wording below is drafted.
    citation:
      'Adapted from the Liverpool Osteoarthritis in Dogs (LOAD) and the Feline Musculoskeletal Pain Index (FMPI).',
    parameters: [
      // The BEAAAAPP category rather than a scale of its own, so the two can
      // never disagree about the same day. Ambulation IS the central
      // arthritis measure and the daily assessment already collects it with
      // six species-specific levels.
      //
      // Asked here rather than referenced from the daily assessment, which is
      // what Heart Disease does with appetite. The difference is cadence:
      // Heart Disease is filled in daily, alongside the assessment, so
      // referencing it costs nothing. Arthritis is weekly, and an owner who
      // did not happen to do the daily assessment that week would be left
      // with an arthritis entry missing the one measure that matters most.
      {
        key: 'ambulation',
        label: 'Getting About',
        type: 'beap',
        beapKey: 'ambulation',
        hideImages: true,
        covers: 'ambulation',
        relationship: RELATIONSHIP.SUPERSEDES,
        concernFrom: 4, // PENDING ASH
        why:
          'The same question as in the daily assessment, kept here because it is the one that matters most for arthritis.', // PENDING ASH
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
        concernFrom: 4, // PENDING ASH
        levels: {
          dog: [
            'Gets up and moves off normally.',
            'Very slightly slow to get going, loose within a few steps.',
            'Stiff for the first minute or so after getting up.',
            'Clearly stiff for several minutes, and needs to warm up before moving freely.',
            'Stiff for a long time after resting, and never fully loosens up.',
            'Struggles to get up at all, or cannot without help. (emergency)',
          ],
          cat: [
            'Gets up and moves off normally.',
            'Very slightly slow to get going, loose within a few steps.',
            'Stiff for the first minute or so after getting up.',
            'Clearly stiff for several minutes, and moves carefully before settling again.',
            'Stiff for a long time after resting, and never fully loosens up.',
            'Struggles to get up at all, or cannot without help. (emergency)',
          ],
        },
        why:
          'Stiffness after rest is often the first thing owners notice, and it comes on before any limp does.', // PENDING ASH
      },
      {
        key: 'pain_relief_effect',
        label: 'How Well Is The Pain Relief Working?',
        type: 'choice',
        options: [
          { value: 'not_on_any', label: 'Not on any', severity: SEVERITY.OK },
          { value: 'well', label: 'Working well', severity: SEVERITY.OK },
          { value: 'wearing_off', label: 'Wears off before the next dose', severity: SEVERITY.CONCERN },
          { value: 'not_helping', label: 'Not helping much', severity: SEVERITY.CONCERN },
        ],
        concernMessage:
          'Worth raising with your vet — the dose, the timing or the medication itself may need changing.', // PENDING ASH
        why:
          'How well pain relief is holding is the thing your vet most wants to know at a recheck, and it is easy to lose track of between visits.', // PENDING ASH
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
        label: 'Response To Touch',
        type: 'beap',
        beapKey: 'palpation',
        hideImages: true,
        // Same category as the daily assessment, asked with the one thing it
        // does not ask: where. Kept rather than referenced for the same
        // cadence reason as ambulation above.
        covers: 'palpation',
        relationship: RELATIONSHIP.SUPERSEDES,
        concernFrom: 4, // PENDING ASH
        followUp: {
          key: 'palpation_where',
          // A threshold, not an exact score — asked at every level from
          // "flinches or pulls away" upwards.
          whenAtLeast: 4, // PENDING ASH
          type: 'text',
          label: 'Where Is {name} Sore?',
          placeholder: 'Hips, lower back, a particular leg…',
        },
        why:
          'Gently running your hands over {them} tells you things watching cannot — and where {they} {are} sore is what your vet will want to examine.', // PENDING ASH
      },

      // --- Dogs only ------------------------------------------------------
      {
        key: 'walk_tolerance',
        species: 'dog',
        label: 'Walks',
        type: 'scale',
        // Stamina on a walk, against a distance this dog does every day —
        // a comparison the daily activity grade has no way to make.
        covers: 'activity',
        relationship: RELATIONSHIP.DISTINCT,
        concernFrom: 4, // PENDING ASH
        levels: {
          dog: [
            'Walks as far as ever and comes home keen.',
            'Walks the usual distance but is a little slower at the end.',
            'Slows down or lags before the end of the usual walk.',
            'Needs the walk cut short, or is sore afterwards.',
            'Manages only a short, slow walk.',
            'Unwilling to walk at all.',
          ],
        },
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
        label: 'Jumping Up',
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
        concernMessage: 'PENDING ASH',
        why:
          'Cats rarely limp. Choosing a lower windowsill, or taking the sofa in two steps instead of one, is usually the first sign.', // PENDING ASH
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
        concernFrom: 4, // PENDING ASH
        levels: {
          cat: [
            'Coat is well kept all over.',
            'Very slightly less tidy than usual.',
            'Some untidy patches, usually over the back or hips.',
            'Coat is matted or greasy where {they} cannot reach.',
            'Has largely stopped grooming.',
            'Coat is badly matted and {they} {are} not grooming at all.',
          ],
        },
        why:
          'A cat who cannot turn comfortably stops grooming the places that need turning — over the back, the hips and the base of the tail.', // PENDING ASH
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
          'A high-sided tray can be hard to climb into with sore joints. A lower one, or a second tray closer by, often helps.', // PENDING ASH
      },
    ],
  },

  kidney: {
    key: 'kidney',
    label: 'Kidney Disease',
    Icon: KidneyOrganIcon,
    summary:
      'Appetite, weight, drinking and urination, nausea and vomiting.',
    comingSoon: true,
    parameters: [],
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

// Appetite, derived from the VCOG inappetence grade rather than asked twice.
//
// A cancer patient answers ONE question about eating: the VCOG-graded
// inappetence question, which is the more precise instrument and the one an
// oncologist needs in the report. Everywhere else in the app that wants a
// familiar 0-10 appetite score reads it from that grade instead of putting a
// second appetite question in front of the owner on the same day — two
// answers about the same meal that can disagree.
//
// Direction matches the everyday-function questions, NOT BEAAAAPP severity:
// 10 is eating normally, 0 is eating nothing. That is what the general
// assessment's appetite slider means, so a derived value can stand in for a
// recorded one without inverting.
//
// PENDING ASH — the mapping is mine, not reviewed. Index is the VCOG grade.
export const APPETITE_SCORE_BY_VCOG_GRADE = [10, 8, 5, 2, 0]

export function appetiteScoreFromVcogGrade(grade) {
  const index = Number(grade)
  if (!Number.isFinite(index)) return null
  return APPETITE_SCORE_BY_VCOG_GRADE[index] ?? null
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

  if (parameter.type === 'vcog') {
    const grade = Number(value)
    if (!Number.isFinite(grade)) return null

    // Both cuts are opt-in per parameter. Where grade 3 sits between "manage
    // at home" and "ring the practice" differs by category — grade 3 vomiting
    // and grade 3 lethargy are not the same phone call — so neither is
    // assumed here.
    if (parameter.emergencyFromGrade != null && grade >= parameter.emergencyFromGrade) {
      return { severity: SEVERITY.EMERGENCY, message: parameter.emergencyMessage }
    }
    if (parameter.concernFromGrade != null && grade >= parameter.concernFromGrade) {
      return { severity: SEVERITY.CONCERN, message: parameter.concernMessage }
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
      return { severity: SEVERITY.EMERGENCY, message: parameter.emergencyMessage }
    }

    // Opt-in per parameter, because how much of a scale counts as concerning
    // is a clinical judgement rather than something to assume. See BEAP_BANDS
    // in scoring.js: 4 is Moderate, 6 Moderate to severe.
    if (parameter.concernFrom != null && score >= parameter.concernFrom) {
      return { severity: SEVERITY.CONCERN, message: parameter.concernMessage }
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

export function summariseEntry(condition, values, species) {
  let emergencies = 0
  let concerns = 0
  let answered = 0
  let unsure = 0

  for (const parameter of parametersOf(condition)) {
    // Skipped before the answered count, not just before the flag count. A
    // day where the owner filled in nothing but the steroid module has not
    // been assessed for concern, and colouring it green would say it had.
    if (parameter.informational) continue

    // A referenced parameter is never answered on this form, so it can
    // neither flag a day nor count towards the day having been assessed.
    if (!isAsked(parameter)) continue

    const value = values?.[parameter.key]
    if (value == null || value === '') continue
    // Not counted as answered OR as unsure. A lymph node that cannot be felt
    // is a normal finding with no number behind it, so it neither flags the
    // day nor marks it as something the owner was unsure about.
    if (value === NOT_APPLICABLE) continue
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

  if (parameter.type === 'vcog') {
    const points = entries
      .map((entry) => ({ date: entry.date, value: Number(read(entry)) }))
      .filter((point) => Number.isFinite(point.value))
    if (points.length === 0) return null

    return {
      points,
      // Fixed 0-4, never fitted to the data. A patient who has only ever been
      // grade 0 and grade 1 would otherwise get a chart where grade 1 touches
      // the top of the axis and looks like the worst thing that can happen.
      domain: [VCOG_MIN_GRADE, VCOG_MAX_GRADE],
      threshold: parameter.concernFromGrade ?? null,
      // Where the scale came from is credited ONCE at the top of the
      // assessment, the same way BEAAAAPP and the WSAVA chart are. Repeating
      // it under every chart is noise on a screen an owner reads daily.
      caption: parameter.concernFromGrade != null
        ? `Graded 0 to 4. A rising line means worsening. The dashed line is grade ${parameter.concernFromGrade}.`
        : 'Graded 0 to 4. A rising line means worsening.',
    }
  }

  if (parameter.type === 'beap' || parameter.type === 'scale') {
    // Direction is per-parameter, not global.
    //
    // Stored values are always BEAAAAPP severity: 0 = no abnormalities,
    // 10 = worst. Most parameters plot that raw, so the chart shows back the
    // number the owner picked and a rising line means deterioration. Appetite
    // sets chartHigherIsBetter, because a line that climbs as a pet stops
    // eating reads backwards no matter how it is captioned.
    const flip = parameter.chartHigherIsBetter === true
    const points = entries
      .map((entry) => {
        const raw = Number(read(entry))
        return { date: entry.date, value: flip ? 10 - raw : raw }
      })
      .filter((point) => Number.isFinite(point.value))
    if (points.length === 0) return null
    return {
      points,
      domain: [0, 10],
      caption: flip
        ? '10 is best, 0 is worst. A falling line means things are getting worse.'
        : '0 is best, 10 is worst — the same scale you picked from above. A rising line means things are getting worse.',
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

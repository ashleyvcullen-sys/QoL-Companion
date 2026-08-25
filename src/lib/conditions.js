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
import { BEAP_SCALES, SLEEP_SCALE } from './beapScales'
import { SLEEP_NOTES } from './assessmentOptions'
import { referenceText } from './references'

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

// The note shown on every question that reuses a BEAAAAPP category verbatim.
//
// Defined once and shared rather than written per parameter, because the whole
// point is that these ARE the same question — two subtly different
// explanations of that would undo it. Any parameter with `beapKey` should
// carry it.
//
// APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Her wording, verbatim.
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

// APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Her wording, verbatim.
//
// Shown once, under the Disease-Specific Monitoring title. It was on each
// individual condition page too for a while; repeating it at the top of every
// disease was a sentence someone had already read, sitting between them and
// the thing they came to do.
export const MONITORING_DISCLAIMER =
  "This does not replace your vet's advice or clinical assessment, but will help make monitoring at home easier between visits."

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
    // PENDING ASH — see the 'acvim-cardiac' entry in lib/references.js.
    citation: referenceText('acvim-cardiac'),
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
    // PENDING ASH — confirm the version to cite and the exact wording.
    citation: referenceText('vcog-ctcae'),
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
    Icon: CognitiveOrganIcon,
    // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. The "sometimes called
    // canine/feline dementia" tail has gone: the title says Dementia now, so
    // the sentence was introducing a word already on the screen above it.
    summary:
      'Changes in memory, orientation, sleep patterns and interaction that can come with ageing.',
    // PENDING ASH — confirm the instrument and the exact wording. Nothing from
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
    // PENDING ASH — the first two sentences are mine. The rest is yours,
    // approved 25 Aug 2026.
    intro: [
      '**Many signs of cognitive decline can also be signs of illness.** A veterinary assessment is important to rule out other causes before assuming cognitive decline.',
      'Cognitive decline usually happens gradually, which makes the small changes easy to miss. Regular check ins and filling out this questionnaire can help to highlight any trends or consistent changes worth flagging with your vet.',
    ],
    parameters: [
      // --- Disorientation -------------------------------------------------
      {
        key: 'disorientation',
        species: 'dog',
        label: 'Orientation',
        type: 'scale',
        concernFrom: 4, // PENDING ASH
        levels: {
          dog: [
            'Finds {their} way around the house and garden normally.',
            'Occasionally pauses, as if working out where to go next.',
            'Sometimes goes to the hinge side of a door, or stands in a room without settling.',
            'Often looks lost in familiar places, or gets stuck behind or under furniture.',
            'Frequently disoriented, and needs help finding the way out of a room.',
            'Appears lost most of the time, even in a single familiar room.',
          ],
        },
      },
      {
        key: 'disorientation',
        species: 'cat',
        label: 'Orientation',
        type: 'scale',
        concernFrom: 4, // PENDING ASH
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026, for every level EXCEPT
        // moderate. That one ("Sometimes stares at walls or into space") is
        // still mine — it was the one level not sent, and it is the only rung
        // between "occasionally hesitates" and "often seems unsure", so it is
        // worth a look.
        levels: {
          cat: [
            'Moves around the house confidently and settles in the usual places.',
            'Occasionally hesitates before entering a room, walking through a doorway or jumping onto usual perches.',
            'Sometimes stares at walls or into space for a while.', // PENDING ASH
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
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
        why:
          'All dogs interact differently, and some are naturally more independent than others. The main thing is to know what is normal for {name}, and to notice a change from that.',
        concernFrom: 4, // PENDING ASH
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
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. The same point the dog
        // anxiety question makes, and for the same reason: a scale that reads
        // as "less affectionate is worse" would mark an aloof cat down from
        // the first day for being exactly {them}self.
        why:
          'Not all cats naturally seek affection or attention. The main thing is to know what is normal for {name}, and to recognise if things are changing.',
        concernFrom: 4, // PENDING ASH
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. "OR" left capitalised as
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
        concernFrom: 4, // PENDING ASH
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
        concernFrom: 4, // PENDING ASH
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
        concernFrom: 4, // PENDING ASH
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Capitalisation, full stops
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
        concernFrom: 4, // PENDING ASH
        // PENDING ASH — worth a note on this one: toileting outside the tray
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
        concernFrom: 4, // PENDING ASH
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Capitalisation and full
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
        concernFrom: 4, // PENDING ASH
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
        levels: {
          cat: [
            'Grooming, playing and investigating new things per usual. Regular routines are intact.',
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
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
        why:
          'Anxiety from cognitive decline looks different in every dog, and some dogs are naturally more anxious than others. The main thing is to know what is normal for {name}, and to watch for a change from that.',
        howToTitle: 'Common Signs Of Anxiety In Dogs',
        // PENDING ASH — the list is mine. Written as things an owner can see
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
        // PENDING ASH — drafted by me.
        howToFooter:
          '**Many of these can also be signs of illness or pain.** It is important for a vet to rule those out before assuming anxiety.',
        concernFrom: 4, // PENDING ASH
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
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
        why:
          'All cats have different thresholds for anxiety. The main thing is to know what is normal for {name}, and to notice a change from that.',
        howToTitle: 'Common Signs Of Anxiety In Cats',
        // PENDING ASH — the list is mine. Deliberately not the dog list with
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
        // PENDING ASH — drafted by me.
        howToFooter:
          '**Many of these can also be signs of illness or pain.** It is important for a vet to rule those out before assuming anxiety.',
        concernFrom: 4, // PENDING ASH
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
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
    Icon: BoneOrganIcon,
    summary:
      'Stiffness, lameness and willingness to move.',
    // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
    intro:
      'Symptoms of arthritis are usually gradual. Changes are therefore easier to see over weeks to months, rather than day to day.',
    // PENDING ASH — confirm both instruments and the exact wording. Neither
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
        key: 'ambulation',
        // Named the same as the BEAAAAPP category it reuses. It IS that
        // question, so calling it something friendlier here only made the two
        // look like different measures on the same day.
        label: 'Ambulation',
        type: 'beap',
        beapKey: 'ambulation',
        hideImages: true,
        covers: 'ambulation',
        relationship: RELATIONSHIP.SUPERSEDES,
        concernFrom: 4, // PENDING ASH
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
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Her wording, one set for
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
        // it reuses, so the two never read as separate measures.
        label: 'Palpation',
        type: 'beap',
        beapKey: 'palpation',
        hideImages: true,
        // Same category as the daily assessment, asked with the one thing it
        // does not ask: where. Kept rather than referenced for the same
        // reason as ambulation above.
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
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Capitalisation and full
        // stops normalised to match the other scales; wording otherwise hers.
        levels: {
          dog: [
            'Very keen on walks, does not tire and does not pull up sore after.',
            'Keen on walks and goes the usual distance, but is a little slower at the end.',
            'Slows down or lags before the end of the usual walk. Will sometimes pull up sore after.',
            'Slow and needs the walk cut shorter than usual. Will limp or pull up sore after.',
            'Can only manage a short, slow walk. Goes out mostly to sniff rather than exercise.',
            'Unwilling to walk or not interested in walks at all.',
          ],
        },
      },
      // Same key as the cat question below, deliberately. It is the same
      // measurement — can {name} still get up onto the things {they} used to —
      // and only the examples differ, so one key keeps one history and one
      // chart whatever the species. Species filtering guarantees a pet is only
      // ever shown one of the two.
      //
      // PENDING ASH — options drafted by me, not reviewed. No `why` on this
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
        // PENDING ASH — drafted. This one WAS the literal string 'PENDING ASH',
        // which an owner picking anything below "gets to all the usual places"
        // would have read as their alert.
        concernMessage:
          'Worth mentioning to your vet, particularly if this is a change from a few months ago.',
        why:
          'Choosing a lower windowsill, or taking the sofa in two steps instead of one, is often the first sign of sore joints.', // PENDING ASH
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
            'Slightly less tidy than usual.',
            'Some untidy patches, usually over the back or hips.',
            'Coat is matted or greasy where {they} cannot reach.',
            'Rarely grooms any more. Coat is matted or greasy.',
            'Not grooming at all. Coat is severely matted and greasy.',
          ],
        },
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
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
// APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
export const BEAP_APPETITE_BY_VCOG_GRADE = [0, 2, 6, 8, 10]

// And back the other way.
//
// This exists because grade 1 covers two BEAAAAPP levels rather than one, so
// both of them land on it — there is no level whose grade is ambiguous. That
// was the missing piece: without it the conversion could only run one way,
// and the cancer form could not be pre-filled from the assessment.
//
// APPROVED — Ash Cullen (BVSc), 25 Aug 2026.
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

// A parameter's name for a list, including which lump or lymph node it was
// about — "Size" on its own is not an answer to "what was flagged?" when a
// pet is being measured in three places.
function labelOf(parameter) {
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

// Every question on a condition form for one day, with the answer given and
// whether it flagged. Follow-ups sit under the question they belong to, and
// questions that were never answered are dropped rather than listed blank.
export function describeConditionDay(condition, values, species) {
  const rows = []

  for (const parameter of parametersOf(condition)) {
    if (!isAsked(parameter)) continue

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
    const followUp = parameter.followUp
    if (!followUp) continue
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
    if (verdict?.severity === SEVERITY.EMERGENCY) {
      emergencies += 1
      flagged.push({ key: parameter.key, label: labelOf(parameter), severity: SEVERITY.EMERGENCY })
    } else if (verdict?.severity === SEVERITY.CONCERN) {
      concerns += 1
      flagged.push({ key: parameter.key, label: labelOf(parameter), severity: SEVERITY.CONCERN })
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

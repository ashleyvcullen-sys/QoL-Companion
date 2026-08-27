// Cancer monitoring — sign modules, treatment modules and diagnosis presets.
//
// ============================================================================
// THIS IS THE FILE TO EDIT for cancer content. Same principle as
// conditions.js: everything an owner reads lives here as plain data.
// ============================================================================
//
// Why cancer is composed rather than fixed
// ----------------------------------------
// Every other condition in the app has ONE parameter list — a cardiac patient
// answers the same eight questions as every other cardiac patient. Cancer has
// no such set. Structuring by tumour type would mean twenty definitions, each
// needing authoring before anything ships, and owners often cannot name the
// diagnosis anyway.
//
// So THE DIAGNOSIS IS METADATA AND THE SIGNS ARE THE STRUCTURE. A diagnosis
// suggests modules; the owner can add or remove any of them. More than one
// diagnosis can be selected, because pets get more than one cancer and a
// cancer that has spread is two things to watch, not one.
//
// See CancerMonitoring_Structure.md for the full reasoning.
//
// PENDING ASH: owner-facing strings drafted by Claude are marked. Anything
// NOT marked came from Ash directly.

import { RELATIONSHIP, SEVERITY, sharedParameter } from './conditions'

// ---------------------------------------------------------------- core
//
// Deliberately thin. Pain, activity and demeanour are ALREADY collected by
// the general assessment (BEAAAAPP) and the Body Condition screen. Re-asking
// them here would put two answers to the same question on the same day.
//
// Appetite is asked ONCE, here, as a VCOG grade — the finer instrument, and
// the one an oncologist reads. The daily assessment's appetite category is
// filled in from that grade rather than asked a second time; see
// beapAppetiteFromVcogGrade() in conditions.js.
export const CORE_PARAMETERS = [
  // Graded, because the grade is the number an oncologist acts on and the
  // one the report has to print. `beapKey` + `beapFromGrade` mean it still
  // fills in the daily assessment's appetite category — one direction only.
  //
  // One direction is a deliberate limit, not an oversight. Five grades do not
  // map cleanly onto six BEAAAAPP levels, so converting back would have to
  // guess, and a guess written into a clinical record is worse than a
  // question asked twice. The finer instrument feeds the coarser one; never
  // the reverse.
  {
    key: 'inappetence',
    label: 'Appetite',
    type: 'vcog',
    vcogCategory: 'Anorexia',
    covers: 'appetite',
    relationship: RELATIONSHIP.SUPERSEDES,
    beapKey: 'appetite',
    // Graded here, scored there, converted in both directions. The owner
    // answers appetite once a day whichever screen they open first.
    beapFromGrade: true,
    concernFromGrade: 3, // PENDING ASH
    grades: [
      { grade: 0, owner: 'Eating normally.' },
      { grade: 1, owner: 'Eating a little less than usual, but still eating meals.' },
      { grade: 2, owner: 'Eating noticeably less. Needs coaxing, or only eats favourites.' },
      { grade: 3, owner: 'Eating very little for more than a day, despite coaxing.' },
      { grade: 4, owner: 'Not eating at all. (emergency)' },
    ],
  },
  {
    key: 'nausea',
    label: 'Nausea',
    type: 'vcog',
    vcogCategory: 'Nausea',
    concernFromGrade: 3, // PENDING ASH
    grades: [
      { grade: 0, owner: 'No sign of nausea.' },
      { grade: 1, owner: 'Occasional lip-licking or drooling, but eating normally.' },
      { grade: 2, owner: 'Lip-licking, drooling or gulping, and turning away from food.' },
      { grade: 3, owner: 'Obviously nauseous for more than a day, and not eating because of it.' },
      { grade: 4, owner: 'Constantly nauseous and unable to keep anything down. (emergency)' },
    ],
  },
  {
    key: 'in_himself',
    label: 'Behaviour',
    type: 'scale',
    // The same ground as the daily assessment's attitude category, written
    // for a patient on treatment: withdrawal here is the thing owners report
    // first and the thing that most often precedes a bad week.
    covers: 'attitude',
    relationship: RELATIONSHIP.SUPERSEDES,
    concernFrom: 4, // PENDING ASH
    levels: {
      dog: [
        'Completely {them}self.',
        'Slightly quieter than usual.',
        'Noticeably quieter, but still greeting you and interested in things.',
        'Withdrawn. Less interested in people, walks or food.',
        'Very withdrawn. Mostly sleeping, little interest in anything.',
        'Unresponsive or seems distressed. (emergency)',
      ],
      cat: [
        'Completely {them}self.',
        'Slightly quieter than usual.',
        'Noticeably quieter, but still coming to find you.',
        'Withdrawn. Hiding more, less interested in people or food.',
        'Very withdrawn. Mostly hidden or sleeping, little interest in anything.',
        'Unresponsive or seems distressed. (emergency)',
      ],
    },
  },
]

// ------------------------------------------------------- sign modules
export const SIGN_MODULES = {
  mass: {
    key: 'mass',
    label: 'A lump you can see and feel',
    summary: 'Size, appearance and whether it is bothering {name}.', // PENDING ASH
    // Parameters are generated per instance — see LUMP_MEASURES.
    perInstance: 'lump',
    parameters: [],
  },

  lymph_nodes: {
    key: 'lymph_nodes',
    label: 'Lymph nodes',
    summary: 'Size of the lymph nodes you can feel. Ask your veterinarian how to do this if unsure.',
    // Shown where the nodes themselves are — the add card in setup, and above
    // the measurements on the daily form — but deliberately NOT in the module
    // summary under Things to Monitor. Someone choosing what to track does
    // not need this yet; someone being asked for a number does.
    instanceNote: {
      cat: 'Cats do not always have noticeably enlarged external lymph nodes. If you cannot feel any, ignore this section — or select N/A on the days you cannot feel one.', // PENDING ASH
    },
    perInstance: 'node',
    instanceLabel: 'Which lymph node?',
    instanceSites: [
      'Under the jaw (left)',
      'Under the jaw (right)',
      'In front of the shoulder (left)',
      'In front of the shoulder (right)',
      'Behind the shoulder (left)',
      'Behind the shoulder (right)',
      'Behind the knee (left)',
      'Behind the knee (right)',
    ],
    parameters: [],
  },

  respiratory: {
    key: 'respiratory',
    label: 'Breathing',
    summary: 'Breathing effort and coughing.', // PENDING ASH
    parameters: [
      // Shared with Heart Disease, including the "what does it sound like"
      // follow-up. Only the reason it matters is different.
      sharedParameter('coughing', {
        why: 'A new or worsening cough matters in a cancer patient, and is worth telling your vet about even if {name} seems well otherwise.', // PENDING ASH
      }),
      // Shared with Heart Disease — one definition, one place to edit.
      sharedParameter('breathing_effort'),
    ],
  },

  gums: {
    key: 'gums',
    label: 'Gum colour',
    summary: 'Pale, white or blue gums can mean bleeding inside, or that {name} is not getting enough oxygen.', // PENDING ASH
    parameters: [
      // Identical to Heart Disease's, from the same definition — including
      // the how-to for lifting the lip. See SHARED_PARAMETERS in
      // conditions.js.
      sharedParameter('gum_colour'),

    ],
  },

  mobility: {
    key: 'mobility',
    label: 'Lameness and Mobility',
    summary: 'Whether {name} is using the leg, and how {they} {are} getting about.', // PENDING ASH
    parameters: [
      {
        key: 'weight_bearing',
        label: 'Weight-Bearing',
        type: 'choice',
        // One leg, not general mobility: a bone tumour patient walks until
        // the day the leg goes, and that day is what this question is for.
        covers: 'ambulation',
        relationship: RELATIONSHIP.DISTINCT,
        options: [
          { value: 'full', label: 'Using the leg normally', severity: SEVERITY.OK },
          { value: 'partial', label: 'Limping, but still using it', severity: SEVERITY.CONCERN },
          { value: 'none', label: 'Not putting the leg down at all', severity: SEVERITY.EMERGENCY },
        ],
        emergencyMessage: 'A leg that suddenly cannot be used at all needs veterinary attention today. In a pet with a bone tumour this can mean the bone has broken.', // PENDING ASH
        concernMessage: 'Worth telling your vet about, especially if the limp is new or getting worse.', // PENDING ASH
      },
    ],
  },

  urinary: {
    key: 'urinary',
    label: 'Urination',
    summary: 'Straining, blood, and how often.', // PENDING ASH
    parameters: [
      {
        key: 'unable_to_pass_urine',
        label: 'Unable To Pass Urine',
        type: 'yesno',
        emergencyWhen: 'yes',
        // The daily urination question asks how it has been. This asks
        // whether anything is coming out at all, which is a different
        // question with a different answer on the phone.
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
        emergencyMessage: 'A pet straining to urinate without producing anything is an emergency. Contact your vet or the nearest emergency clinic now.', // PENDING ASH
      },
      {
        key: 'straining_to_urinate',
        label: 'Straining To Urinate',
        type: 'yesno',
        concernWhen: 'yes',
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
      },
      {
        key: 'blood_in_urine',
        label: 'Blood In The Urine',
        type: 'yesno',
        concernWhen: 'yes',
        covers: 'urination',
        relationship: RELATIONSHIP.DISTINCT,
      },
    ],
  },

  gi: {
    key: 'gi',
    label: 'Vomiting and diarrhoea',
    summary: 'Both are common symptoms of certain cancers, but can also occur with certain treatments.',
    parameters: [
      {
        key: 'vomiting',
        label: 'Vomiting',
        type: 'vcog',
        // Graded rather than the daily yes/no-and-how-often, because on
        // treatment the grade is what decides whether anything changes.
        covers: 'vomiting',
        relationship: RELATIONSHIP.SUPERSEDES,
        vcogCategory: 'Vomiting',
        concernFromGrade: 3, // PENDING ASH
        // NOTE on the "(emergency)" markers below. For a `scale` parameter
        // that marker drives BOTH the hazard icon and the severity. For a
        // `vcog` parameter severity comes from concernFromGrade /
        // emergencyFromGrade only, so the marker here is purely the icon —
        // which is what lets grade 3 carry a warning triangle while still
        // being graded a concern rather than an emergency.
        grades: [
          { grade: 0, owner: 'No vomiting.' },
          { grade: 1, owner: 'Vomited once in the last day.' },
          { grade: 2, owner: 'Vomited two or three times in the last day.' },
          { grade: 3, owner: 'Vomiting repeatedly, or unable to keep water down. (emergency)' },
          { grade: 4, owner: 'Vomiting constantly and becoming weak or collapsed. (emergency)' },
        ],
      },
      {
        key: 'diarrhoea',
        label: 'Diarrhoea',
        type: 'vcog',
        covers: 'stool',
        relationship: RELATIONSHIP.SUPERSEDES,
        vcogCategory: 'Diarrhoea',
        concernFromGrade: 3, // PENDING ASH
        grades: [
          { grade: 0, owner: 'Normal stools.' },
          { grade: 1, owner: 'Slightly softer than usual.' },
          { grade: 2, owner: 'Clearly loose, and going more often than usual.' },
          { grade: 3, owner: 'Watery, or having accidents indoors when {they} normally would not.' },
          { grade: 4, owner: 'Watery and becoming weak, or there is blood. (emergency)' },
        ],
      },
      {
        key: 'black_tarry_stool',
        label: 'Black, Tarry Stools',
        type: 'yesno',
        concernWhen: 'yes',
        // Sits in the stool domain and is not a stool score. Melaena is
        // digested blood — a formed, black, tarry stool is abnormal in a way
        // no consistency scale registers, and a pet passing one can score
        // perfectly well on the daily question.
        covers: 'stool',
        relationship: RELATIONSHIP.DISTINCT,
        concernMessage: 'Black, tarry stools can mean bleeding higher up the gut. Book a visit with your vet.', // PENDING ASH
      },
    ],
  },

  haemorrhage: {
    key: 'haemorrhage',
    label: 'Collapse or a swollen tummy',
    summary: 'Signs that a tumour may be bleeding inside.', // PENDING ASH
    parameters: [
      {
        key: 'collapse_episode',
        label: 'Collapse Or Fainting',
        type: 'yesno',
        emergencyWhen: 'yes',
        emergencyMessage: 'Collapse in a pet with a tumour that can bleed needs veterinary attention immediately. Contact your vet or the nearest emergency clinic now.', // PENDING ASH
      },
      { key: 'swollen_abdomen', label: 'Swollen Or Bloated Tummy', type: 'yesno', concernWhen: 'yes' },
    ],
  },

  nasal: {
    key: 'nasal',
    label: 'Nose and face',
    summary: 'Discharge, facial swelling and noisy breathing.', // PENDING ASH
    parameters: [
      {
        key: 'nasal_discharge',
        label: 'Discharge From The Nose',
        type: 'choice',
        // Descriptors signed off by Ash, 24 Aug 2026.
        options: [
          { value: 'none', label: 'None', severity: SEVERITY.OK },
          { value: 'clear', label: 'Clear', severity: SEVERITY.OK },
          { value: 'coloured', label: 'Yellow or green', severity: SEVERITY.CONCERN },
          { value: 'bloody', label: 'Bloody', severity: SEVERITY.CONCERN },
        ],
        concernMessage: 'Worth telling your vet about, particularly if this is new or getting worse.', // PENDING ASH
      },
      {
        key: 'facial_swelling',
        label: 'Swelling Of The Face',
        type: 'yesno',
        concernWhen: 'yes',
        followUp: {
          key: 'facial_swelling_where',
          when: 'yes',
          type: 'text',
          label: 'Where Is The Swelling?',
          placeholder: 'Under the eye, along the muzzle, one side of the face…',
        },
      },
      // Noise, not effort: a nasal tumour makes a pet snore and snuffle long
      // before it makes {them} work to breathe, which is the earlier sign and
      // the one the daily breathing grade will not show.
      { key: 'noisy_breathing', label: 'Noisy Breathing Through The Nose', type: 'yesno', concernWhen: 'yes', covers: 'breathing', relationship: RELATIONSHIP.DISTINCT },
    ],
  },

  oral: {
    key: 'oral',
    label: 'Mouth and eating mechanics',
    // Deliberately separate from appetite. A pet with an oral tumour is
    // hungry and WANTS to eat — an appetite grade alone reads that as fine.
    summary: 'Whether {name} can eat comfortably — not whether {they} {are} hungry.', // PENDING ASH
    parameters: [
      // The two mechanics questions sit in the appetite domain and are not
      // appetite: this patient is hungry. Declared so the check can see the
      // distinction was made on purpose rather than missed.
      { key: 'dropping_food', label: 'Dropping Food While Eating', type: 'yesno', concernWhen: 'yes', covers: 'appetite', relationship: RELATIONSHIP.DISTINCT },
      { key: 'avoiding_hard_food', label: 'Avoiding Hard Food Or Chewing On One Side', type: 'yesno', concernWhen: 'yes', covers: 'appetite', relationship: RELATIONSHIP.DISTINCT },
      { key: 'oral_bleeding', label: 'Bleeding From The Mouth', type: 'yesno', concernWhen: 'yes' },
      { key: 'drooling', label: 'Drooling More Than Usual', type: 'yesno', concernWhen: 'yes' },
    ],
  },
}

// ------------------------------------------- per-instance measurements
//
// A lump is not a parameter — it is an INSTANCE that generates parameters. A
// patient can have three of them, each needing its own measurements and its
// own photo thread, so these are templated per instance into keys like
// `lump:m1:length_mm`. Entry values are keyed the same way, so
// condition_entries needs no schema change at all.
//
// Lumps and lymph nodes are measured the same way but are NOT the same
// thing. A lymph node has no surface to inspect and a pet does not lick at
// one, so the appearance and licking questions belong to lumps alone.

const MEASURE_HOW_TO = [
  'Get a ruler or a tape measure.',
  'Measure the longest part of it in one direction — that is the length.',
  'Then measure across it, at right angles to the first measurement — that is the width.',
  'Write both down in millimetres, and try to measure the same way each time so the numbers can be compared.',
]

const LUMP_CAVEAT =
  '**A lump that is not getting bigger on the outside does not always mean nothing is happening inside.**' // PENDING ASH

const NODE_CAVEAT =
  '**A lymph node that is not getting bigger does not always mean nothing is happening on the inside.**' // PENDING ASH

export const LUMP_MEASURES = [
  {
    key: 'length_mm',
    label: 'Length',
    type: 'number',
    unit: 'mm',
    min: 0,
    step: 1,
    howToTitle: 'How to Measure a Lump',
    howTo: MEASURE_HOW_TO,
    howToFooter: LUMP_CAVEAT,
  },
  { key: 'width_mm', label: 'Width', type: 'number', unit: 'mm', min: 0, step: 1 },
  {
    key: 'surface',
    label: 'How It Looks',
    type: 'choice',
    // Descriptors signed off by Ash, 24 Aug 2026.
    options: [
      { value: 'intact', label: 'Skin over it looks normal', severity: SEVERITY.OK },
      { value: 'hair_loss', label: 'Hair loss over it', severity: SEVERITY.CONCERN },
      { value: 'pigmented', label: 'Changed colour', severity: SEVERITY.CONCERN },
      { value: 'red', label: 'Red or swollen', severity: SEVERITY.CONCERN },
      { value: 'ulcerated', label: 'Broken open', severity: SEVERITY.CONCERN },
      { value: 'bleeding', label: 'Bleeding', severity: SEVERITY.CONCERN },
    ],
    concernMessage: 'Worth telling your vet about, particularly if this is a change from last time.', // PENDING ASH
    // Stored under its own key rather than overwriting the choice, so "the
    // skin has changed colour" and "here is what colour" stay separate facts.
    followUp: {
      key: 'surface_colour',
      when: 'pigmented',
      type: 'text',
      label: 'What Colour Is It?',
      placeholder: 'Black, red, purple…',
    },
  },
  { key: 'bothering', label: 'Licking, Chewing Or Rubbing At It', type: 'yesno', concernWhen: 'yes' },
]

export const NODE_MEASURES = [
  {
    key: 'length_mm',
    label: 'Length',
    type: 'number',
    unit: 'mm',
    min: 0,
    step: 1,
    // A node you cannot feel is a real answer, not a skipped question.
    notApplicableLabel: 'N/A',
    howToTitle: 'How to Measure a Lymph Node',
    howTo: MEASURE_HOW_TO,
    howToFooter: NODE_CAVEAT,
  },
  {
    key: 'width_mm',
    label: 'Width',
    type: 'number',
    unit: 'mm',
    min: 0,
    step: 1,
    notApplicableLabel: 'N/A',
  },
]

export const MEASURES_BY_INSTANCE_TYPE = {
  lump: LUMP_MEASURES,
  node: NODE_MEASURES,
}

// ---------------------------------------------------- treatment modules
// APPROVED — Ash Cullen (BVSc), 25 Aug 2026, wording and thresholds both,
// and shared between dogs and cats on her instruction.
//
// Defined once and referenced from both species keys rather than pasted
// twice. Two identical arrays are two things to edit, and the second one is
// the one that gets forgotten — which is how a cat ends up being asked a
// subtly different question to a dog about the same treated patch of skin.
const RADIATION_SKIN_LEVELS = [
  'Skin at the treated site looks normal.',
  'Slightly pink or red, like mild sunburn. {name} is not bothered by it.',
  'Clearly red, and the hair is thinning or coming away. May look dry or flaky.',
  'Skin is moist, weeping or peeling in places. {name} may lick or scratch at it.',
  'Raw and open over a larger area, weeping or crusted. Clearly sore to touch.',
  'Open wound, bleeding, or a bad smell coming from the site. (emergency)',
]

const RADIATION_DISCOMFORT_LEVELS = [
  'Not bothered by the site at all.',
  'Occasionally notices it — a glance or a quick lick, then moves on.',
  'Licks, scratches or rubs at the site now and then.',
  'Flinches or pulls away when the site is touched, and returns to licking it.',
  'Clearly sore without being touched. Restless, will not settle, or guards the area.',
  'Cries out, will not let anyone near the site, or will not stop licking it. (emergency)',
]

export const TREATMENT_MODULES = {
  none: { key: 'none', label: 'No treatment, or comfort care only', parameters: [] },

  chemo: {
    key: 'chemo',
    label: 'Chemotherapy',
    summary: 'Side effects to watch for while {name} is on treatment.', // PENDING ASH
    // Days since the last treatment is DERIVED from the condition event the
    // owner already logs, never asked.
    usesTreatmentDay: true,
    // Vomiting and diarrhoea are not repeated here — choosing chemotherapy
    // enables the `gi` module, which already grades both on VCOG.
    impliesModules: ['gi'],
    parameters: [
      {
        key: 'lethargy',
        label: 'Energy',
        type: 'vcog',
        vcogCategory: 'Lethargy',
        // Graded against the days after a treatment rather than against
        // normal, which is what the daily activity score measures.
        covers: 'activity',
        relationship: RELATIONSHIP.SUPERSEDES,
        // APPROVED — Ash Cullen (BVSc), 25 Aug 2026. Amber from grade 2, red
        // from grade 3. The earliest amber of any cancer parameter, and
        // deliberately: a dog sleeping most of the day after chemotherapy is
        // the finding that most often turns out to be the start of something,
        // and the one owners most often wait on.
        //
        // Grade 4 also carries the (emergency) marker in its own text, which
        // drives the hazard icon; emergencyFromGrade is what makes grade 3
        // red as well.
        concernFromGrade: 2,
        emergencyFromGrade: 3,
        grades: [
          { grade: 0, owner: 'Normal energy.' },
          { grade: 1, owner: 'Slightly quieter, but doing everything {they} normally would.' },
          { grade: 2, owner: 'Noticeably tired. Less interested in walks or play.' },
          { grade: 3, owner: 'Very tired. Sleeping most of the day and reluctant to get up.' },
          { grade: 4, owner: 'Unable to get up, or unresponsive. (emergency)' },
        ],
      },
      {
        key: 'unusually_quiet_or_hot',
        label: 'Very Quiet, Shivering Or Feels Hot',
        type: 'yesno',
        concernWhen: 'yes',
        // Reads like the attitude category and is not it. Quiet here is one
        // symptom of three, and the three together are a phone call tonight
        // rather than a slightly lower score.
        covers: 'attitude',
        relationship: RELATIONSHIP.DISTINCT,
        // PENDING ASH — drafted by me, and the most urgent of the outstanding
        // ones. Until now this field held a note to myself, which meant an
        // owner answering "yes" was shown "PENDING ASH — this is the
        // neutropenic sepsis question" as their alert.
        //
        // Three deliberate choices in the wording, all yours to overrule:
        //
        //   1. "Today, not tomorrow" rather than a severity word. Neutropenic
        //      sepsis is not something an owner can grade, and asking them to
        //      judge how bad it is invites waiting.
        //   2. It says to ring even if the pet seems otherwise well, because
        //      the early hours of this often look like an off day.
        //   3. It mentions chemotherapy by name so the owner has the reason
        //      to give the person who answers the phone, which is what gets
        //      them seen rather than triaged to tomorrow.
        //
        concernMessage: 'Ring your vet today, not tomorrow, and tell them {name} is having chemotherapy. Being very quiet, shivering or feeling hot can be the first sign of a serious infection in the week or so after a treatment, and it needs treating quickly. Do this even if {they} otherwise seem{s} well.',
        // PENDING ASH — drafted for review. The point being made: chemo drops
        // the white cells that fight infection, the dip lands roughly a week
        // after treatment, and at that point an ordinary infection can become
        // serious quickly. Owners cannot see a white cell count; what they
        // can see is a pet who has gone quiet and feels hot.
        why: 'Chemotherapy temporarily lowers the white blood cells that fight infection, and they are usually at their lowest about a week after a treatment. During that window an infection can take hold quickly, and the first thing you are likely to notice is that {name} has gone very quiet, is shivering, or feels hot to touch. It is always worth ringing your vet about this rather than waiting to see.',
      },
    ],
  },

  radiation: {
    key: 'radiation',
    label: 'Radiation therapy',
    summary: 'Skin and comfort at the treated site.', // APPROVED — Ash Cullen (BVSc), 25 Aug 2026
    parameters: [
      {
        key: 'skin_at_site',
        label: 'Skin At The Treated Site',
        type: 'scale',
        // Follows the course of an acute radiation skin reaction as an OWNER
        // would see it: nothing, redness, dry flaking, then moist breakdown,
        // then an open wound. Written to what can be seen rather than what it
        // is called, so nobody is asked to decide whether something counts as
        // "desquamation".
        //
        // Amber from 4 — the first level where the hair is going and the
        // reaction is more than colour.
        concernFrom: 4,
        levels: { dog: RADIATION_SKIN_LEVELS, cat: RADIATION_SKIN_LEVELS },
      },
      {
        key: 'pain_at_site',
        label: 'Discomfort At The Treated Site',
        type: 'scale',
        // Deliberately not the same question as the skin one above. Skin
        // describes what the site LOOKS like; this describes what {name} does
        // about it, and the two come apart in both directions — a site that
        // looks alarming can be comfortable once it has settled, and a site
        // that looks mild can be very sore early on. Grading them together
        // would let one hide the other.
        //
        // Amber from 4 — the first level where the licking is habitual rather
        // than a passing glance.
        concernFrom: 4,
        levels: { dog: RADIATION_DISCOMFORT_LEVELS, cat: RADIATION_DISCOMFORT_LEVELS },
      },
    ],
  },

  palliative_meds: {
    key: 'palliative_meds',
    label: 'Steroids or palliative medication',
    summary: 'Expected effects, tracked but not treated as deterioration.', // PENDING ASH
    // EVERY parameter here is informational — see the note on `informational`
    // in conditions.js. Drinking more, urinating more and panting are what
    // steroids DO. Scored as concerns they would flag a comfortable,
    // well-palliated patient amber every single day.
    informationalOnly: true,
    parameters: [
      // Every one of these overlaps a daily measure and every one is a
      // different question, because the expected answer is different: on
      // steroids, drinking more is the drug working, not the patient
      // declining. Declared rather than left to be rediscovered.
      { key: 'drinking_more', label: 'Drinking More Than Usual', type: 'yesno', informational: true, covers: 'waterIntake', relationship: RELATIONSHIP.DISTINCT },
      { key: 'urinating_more', label: 'Urinating More Than Usual', type: 'yesno', informational: true, covers: 'urination', relationship: RELATIONSHIP.DISTINCT },
      { key: 'panting', label: 'Panting More Than Usual', type: 'yesno', informational: true, covers: 'breathing', relationship: RELATIONSHIP.DISTINCT },
      { key: 'appetite_increase', label: 'Hungrier Than Usual', type: 'yesno', informational: true, covers: 'appetite', relationship: RELATIONSHIP.DISTINCT },
    ],
  },
}

// ------------------------------------------------------------- diagnoses
//
// More than one can be selected: pets get more than one cancer, and a cancer
// that has spread is two things to watch rather than one. Each one SUGGESTS
// modules — the owner can add or remove any of them afterwards, which is why
// this is a suggestion table and not a schema.
//
// PENDING ASH — the whole table. Two in particular: skin/soft tissue → `gi`
// carries the mast cell case (histamine-driven gut ulceration) now that mast
// cell is no longer listed separately, and mammary → `respiratory` assumes
// metastasis surveillance is useful to an owner rather than just alarming.
export const DIAGNOSES = [
  { key: 'unknown', label: 'Not sure yet, or waiting on results', modules: [] },
  {
    key: 'lymphoma',
    label: 'Lymphoma',
    modules: ['lymph_nodes', 'gi', 'gums', 'respiratory'],
    // Feline lymphoma is asked about by site, because the site is what an
    // owner has been told and because it changes what is worth watching.
    // Canine lymphoma is far more often multicentric, so the question would
    // mostly be answered "unsure" and earn nothing.
    subtypes: {
      cat: {
        label: 'What type of lymphoma?',
        // A subtype can suggest modules of its own, on top of what the
        // diagnosis already suggests. Only renal adds anything here:
        // lymphoma already brings in GI and Breathing for every patient, so
        // intestinal and mediastinal are covered before the subtype is even
        // asked.
        options: [
          { value: 'intestinal', label: 'Intestinal' },
          { value: 'renal', label: 'Renal', modules: ['urinary'] },
          { value: 'mediastinal', label: 'Mediastinal' },
          { value: 'other', label: 'Other', allowsFreeText: true },
          { value: 'unsure', label: 'Not sure' },
        ],
      },
    },
  },
  { key: 'osteosarcoma', label: 'Bone tumour (osteosarcoma)', modules: ['mobility', 'respiratory'] },
  { key: 'splenic', label: 'Splenic tumour', modules: ['haemorrhage', 'gums', 'respiratory'] },
  { key: 'tcc', label: 'Bladder or urethral tumour', modules: ['urinary'] },
  { key: 'nasal', label: 'Nasal tumour', modules: ['nasal', 'respiratory'] },
  { key: 'oral', label: 'Oral tumour', modules: ['oral', 'mass'] },
  { key: 'mammary', label: 'Mammary tumour', modules: ['mass', 'respiratory'] },
  {
    key: 'lung',
    label: 'Lung tumour or cancer that has spread to the lungs',
    modules: ['respiratory', 'gums'],
  },
  {
    key: 'soft_tissue',
    // Mast cell tumours live here rather than as their own entry — they are
    // a skin tumour, and asking an owner to distinguish one from any other
    // lump before histopathology is asking the impossible.
    label: 'Skin or soft tissue tumour',
    modules: ['mass', 'gi'],
  },
  { key: 'other', label: 'Something else', modules: [], allowsFreeText: true },
]

export function diagnosisByKey(key) {
  return DIAGNOSES.find((entry) => entry.key === key) ?? null
}

// Union of every selected diagnosis's suggestions. Two diagnoses that both
// suggest `respiratory` contribute it once.
export function modulesForDiagnoses(keys = []) {
  const out = []
  for (const key of keys) {
    for (const module of diagnosisByKey(key)?.modules ?? []) {
      if (!out.includes(module)) out.push(module)
    }
  }
  return out
}

export function signModuleByKey(key) {
  return SIGN_MODULES[key] ?? null
}

export function treatmentModuleByKey(key) {
  return TREATMENT_MODULES[key] ?? null
}

export const SIGN_MODULE_LIST = Object.values(SIGN_MODULES)
export const TREATMENT_MODULE_LIST = Object.values(TREATMENT_MODULES)

// The subtype question for a diagnosis, for this species, or null if there
// isn't one. Species-keyed rather than universal: the question only earns
// its place where the answer is one the owner is likely to have.
export function subtypesFor(diagnosisKey, species) {
  return diagnosisByKey(diagnosisKey)?.subtypes?.[species] ?? null
}

// Modules suggested by a chosen subtype.
//
// Scans every species' subtype list rather than taking species as an
// argument: the stored value can only have come from the picker for this
// pet's species, so there is nothing to disambiguate, and it keeps
// activeModuleKeys() from having to know the species.
export function modulesForDiagnosisDetail(diagnosisKey, detail) {
  const subtypes = diagnosisByKey(diagnosisKey)?.subtypes
  if (!subtypes || !detail?.type) return []
  for (const forSpecies of Object.values(subtypes)) {
    const option = forSpecies.options?.find((entry) => entry.value === detail.type)
    if (option?.modules) return option.modules
  }
  return []
}

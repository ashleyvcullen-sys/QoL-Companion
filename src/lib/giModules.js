import { RELATIONSHIP, SEVERITY, sharedParameter } from './conditions'

// Gastrointestinal disease, composed the way cancer is.
//
// GI is not one condition. A cat with EPI, a dog on a food trial and a dog
// recovering from a foreign body removal share an organ system and almost
// nothing else — the questions that matter to each are different, and asking
// all of them of everyone produces a form most of which is irrelevant every
// day. So the owner says what applies at setup and gets those questions.
//
// EVERY owner-facing string below is APPROVED — Dr Ash Cullen (BSc, DVM),
// 3 Sep 2026.

// -------------------------------------------------------------- core
//
// Asked of every GI pet, whatever they have. These are the measures that mean
// something across the whole system and that a vet will want a trend of.
export const GI_CORE_PARAMETERS = [
  // The shared definition, so Allergies and GI cannot drift apart on what
  // a stool looks like. See SHARED_PARAMETERS in lib/conditions.js.
  sharedParameter('stool_consistency'),
  {
    key: 'stool_frequency',
    label: 'Stool Frequency',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. A choice against this pet's
    // own normal, rather than a count.
    //
    // The count was the wrong question. Normal varies so widely between
    // individuals that the number alone says nothing without knowing the
    // baseline — and an owner who did not see every trip to the garden cannot
    // give an honest one anyway. "More than normal for Bella" is a question
    // they can always answer, and it is the answer that carries the meaning.
    type: 'choice',
    options: [
      { value: 'normal', label: 'Normal for {name}' },
      { value: 'increased', label: 'Increased', severity: SEVERITY.CONCERN },
      { value: 'decreased', label: 'Decreased', severity: SEVERITY.CONCERN },
    ],
    concernMessage: 'Worth noting for your vet, particularly if this has been going on for more than a day or two.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    // Moved here from the constipation module on 29 Aug 2026, Ash's call.
    //
    // It was a standalone question that every GI owner monitoring
    // constipation answered every day, including the ones whose pet had just
    // been. Asked only of the owners who have said stool frequency is DOWN,
    // it is the obvious next question rather than a daily chore — and the
    // number is what tells a vet whether this is a slow day or an
    // obstruction.
    //
    // No threshold on it, and none is lost: the old `concernAbove: 2` gave
    // amber, and answering "Decreased" above already does. Follow-ups are
    // never scored, so the flag lives on the parent where it belongs.
    followUp: {
      key: 'days_since_stool',
      when: 'decreased',
      label: 'Days Since The Last Stool',
      type: 'number',
      unit: 'days',
      min: 0,
      max: 14,
      step: 1,
      placeholder: 'e.g. 1',
    },
  },
  {
    key: 'vomiting',
    label: 'Vomiting',
    // THE SAME QUESTION as the Overall Quality of Life Assessment, not a GI
    // version of it. `assessmentField` names the column it shares: answering
    // it here fills it in there and the other way round, exactly as arthritis
    // does with Ambulation and Palpation.
    //
    // A GI-specific vomiting scale sat here first and has gone. Two records of
    // how much a pet vomited on one day, free to disagree, with nothing to say
    // which the vet should believe, is the problem this whole mechanism
    // exists to avoid — and vomiting is the worst possible question to have
    // it on, because it is the one both forms care most about.
    type: 'vomiting',
    assessmentField: 'vomiting',
    covers: 'vomiting',
    relationship: RELATIONSHIP.SUPERSEDES,
    concernMessage: 'Worth recording. If {name} cannot keep water down, or this carries on for more than a day, contact your vet.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    emergencyMessage: 'Blood in the vomit needs veterinary attention as soon as possible.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
  },
  {
    key: 'blood_or_mucus',
    label: 'Blood Or Mucus In The Stool',
    type: 'choice',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Options and severities both. Fresh blood and digested
    // blood are separated because they mean different things and different
    // urgency, and an owner can tell them apart by colour even though they
    // cannot name them.
    options: [
      { value: 'none', label: 'Neither' },
      { value: 'mucus', label: 'Mucus or slime only', severity: SEVERITY.CONCERN },
      { value: 'fresh', label: 'Fresh red blood', severity: SEVERITY.CONCERN },
      { value: 'both', label: 'Both mucus and fresh blood', severity: SEVERITY.CONCERN },
      { value: 'black', label: 'Black or tarry', severity: SEVERITY.EMERGENCY },
    ],
    concernMessage: 'Worth telling your vet about, particularly if this is new or happening most days.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    emergencyMessage: 'Black or tarry stool can mean bleeding higher up the gut. Contact your vet today.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
  },
  {
    key: 'straining',
    label: 'Straining To Pass Stool',
    type: 'scale',
    concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    // The standing alert has gone, on Ash's instruction 3 Sep 2026. It sat
    // above this question permanently, whatever the answer, warning that
    // straining to urinate is mistaken for constipation.
    //
    // What still carries that warning, so it is clear what remains:
    //   - emergencyMessage below, on the two straining rungs that are
    //     emergencies, and it names urinary blockage for both species;
    //   - the urination question in the Overall Quality of Life Assessment,
    //     which raises its own blocked-cat alert (screens/assessment/
    //     UrinationPage.jsx).
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    levels: {
      dog: [
        'Passes stool easily, with no straining.',
        'Takes slightly longer than usual, but passes it without difficulty.',
        'Visibly straining for a short time before passing something.',
        'Straining for a while each time, and may vocalise while straining. What comes is small or hard.',
        'Straining repeatedly and producing very little. (emergency)',
        'Straining and producing nothing at all. (emergency)',
      ],
      // Vocalising appears from moderate onwards and not before, on Ash's
      // instruction. A cat who is a little slow in the tray is not calling
      // out, and putting the sign at the mild end would have owners hearing
      // it where it is not.
      cat: [
        'Passes stool easily, with no straining.',
        'Takes slightly longer in the tray than usual, but passes it without difficulty.',
        'Visibly straining, and may be vocalising in the tray before passing something.',
        'Straining and vocalising each visit, and what comes is small or hard.',
        'In and out of the tray repeatedly, vocalising and producing very little. (emergency)',
        'Straining and producing nothing at all, or vocalising in distress. (emergency)',
      ],
    },
    // Split by species on Ash's instruction. The urinary blockage line is only
    // true for cats, and in a dog owner's emergency alert it is noise in the
    // one message that most needs to be read and acted on.
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. The blockage line is now on
    // BOTH species' alerts, not just the cat's: the standing alert above warns
    // an owner before they answer, and this is what they see once they have.
    // A dog can block too, and the owner who has just selected a straining
    // level is the one who most needs telling.
    emergencyMessage: {
      dog: 'A dog straining repeatedly and producing little or nothing needs to be seen today. This may indicate a urinary blockage, which is an emergency.',
      cat: 'A cat straining repeatedly and producing little or nothing needs to be seen today. This may indicate a urinary blockage, which is an emergency.',
    },
  },
  {
    key: 'abdominal_pain',
    species: 'dog',
    label: 'Abdominal Pain',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her four options, verbatim,
    // and dogs only on her instruction.
    //
    // A choice rather than a six-level scale: four rungs is what she wrote,
    // and padding it to six to match the other questions would have meant
    // inventing two she did not. "Not sure" is added by the form itself, so
    // it is not listed here.
    type: 'choice',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording.
    //
    // "If {name} tolerates it" leads, deliberately: an owner should not be
    // pressing on a painful abdomen to answer a question, and a pet who will
    // not allow it has answered it anyway.
    why: 'If {name} tolerates it, gently feel along {their} tummy, applying very gentle pressure. If {they} become{s} agitated, obviously uncomfortable or aggressive, stop immediately.',
    options: [
      { value: 'relaxed', label: 'Appears relaxed. Tummy is soft and comfortable when gently palpated.' },
      { value: 'tense', label: 'Appears slightly tense, and tummy flinches or tenses when touched.', severity: SEVERITY.CONCERN },
      { value: 'hunched', label: 'Appears hunched over and uncomfortable. Tummy is tense.', severity: SEVERITY.CONCERN },
      { value: 'praying', label: 'Hunched over, or frequent "downward dog" stretching. Tummy is tense and sore when palpated.', severity: SEVERITY.EMERGENCY },
    ],
    concernMessage: 'Worth telling your vet about, particularly if this is new or getting worse.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The severity on the last option is MY call, not yours.
    // I made it an emergency rather than a concern: a hunched dog stretching
    // repeatedly with a tense, painful abdomen is the pancreatitis and
    // torsion presentation, and those are same-day. It is one word to change
    // to CONCERN if you would rather it were amber — note that emergency also
    // floors the whole day's summary to red.
    emergencyMessage: 'A hunched, stretching dog with a tense, painful tummy needs to be seen today. Contact your vet or the nearest emergency clinic.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
  },
]

// Aspiration, asked only of the conditions where food comes back up.
//
// It was a core question until 29 Aug 2026, asked of every GI owner every
// day — including someone monitoring anal glands, who has no reason to be
// asked daily whether their dog is coughing. Ash's call: it belongs to the
// conditions that involve vomiting or reflux, and nowhere else.
//
// Defined once and referenced from each module rather than pasted into
// several. parametersForGi deduplicates by key, so an owner who has selected
// both reflux and pancreatitis is asked it once.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording.
//
// Temperature was dropped from the question: an owner cannot take one, and
// asking for a sign they have no way of checking makes the whole question
// feel like it is not for them. Coughing and noisy breathing are both things
// anyone can hear from across a room.
const ASPIRATION_SIGNS = {
  key: 'aspiration_signs',
  label: 'Coughing Or Noisy Breathing',
  type: 'yesno',
  emergencyWhen: 'yes',
  why: 'These are signs that food may have entered the airways instead of the GI tract (aspiration). This can occur after vomiting or regurgitation of food.',
  emergencyMessage: 'Seek veterinary attention as soon as possible.',
}

// APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her six levels, verbatim.
//
// Shared between species rather than pasted twice: two identical arrays are
// two things to edit, and the second is the one that gets forgotten.
// Levels 2 to 10 are identical for both species and defined once. Only the
// normal state differs: a cat's version of paying the bottom too much
// attention is overgrooming, and "no licking" does not describe it.
const SCOOTING_LEVELS_TAIL = [
  'Sporadic licking and/or scoot, then stops.',
  'Licks and/or scoots bottom a few times a day. A fishy or metallic odour may be present.',
  'Scooting and licking bottom often. Difficult to distract {them} from it.',
  'Constantly licking or chewing at bottom, scooting and/or sitting down more than usual. Skin around the bottom looks red and sore.',
  'Swelling, bleeding or an obvious open sore next to the bottom. (emergency)',
]

const DOG_SCOOTING_LEVELS = [
  'No scooting and/or licking at bottom.',
  ...SCOOTING_LEVELS_TAIL,
]

// APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording for the cat's normal
// state, with "the bottom" naming the place outright rather than "the area"
// implying it — an owner should not have to work out which area is meant.
// Moved to the second sentence so the word is not said twice in a row.
const CAT_SCOOTING_LEVELS = [
  'No overgrooming or scooting. Does not seem bothered by the bottom.',
  ...SCOOTING_LEVELS_TAIL,
]

// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The wording is mine; the severity markers are Ash's, 29 Aug
// 2026. Written for the first fortnight after gut surgery, which is the only
// time this question is asked.
//
// Shared between species: nothing about a healing incision differs between a
// dog and a cat that an owner could see.
const SURGICAL_SITE_LEVELS = [
  'Clean and dry, with the edges together.',
  'Slightly pink at the edges, but dry.',
  'Some swelling or bruising around the site.',
  'Damp or weeping a little, or {name} keeps trying to lick it. (emergency)',
  'Red, swollen and discharging, or hot to touch. (emergency)',
  'The site has opened, or something is showing through it. (emergency)',
]

// -------------------------------------------------------------- modules
export const GI_MODULES = {
  // First in the list, and contributing no questions of its own.
  //
  // "We are still working it out" is a real answer, and a common one — most
  // gut cases are monitored for weeks before anything is named. Without this
  // an owner in that position either picks a condition their pet may not have
  // or cannot get past setup at all. The core questions still apply, so they
  // get a useful record either way, and can add the diagnosis when it comes.
  unknown: {
    key: 'unknown',
    label: 'Not sure yet',
    parameters: [],
  },

  chronic_enteropathy: {
    key: 'chronic_enteropathy',
    label: 'Chronic enteropathy / IBD',
    parameters: [
      {
        key: 'urgency',
        label: 'Urgency And Accidents',
        type: 'scale',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Urgency is one of the
        // things owners notice first and vets ask about, and it is not the
        // same as consistency: a formed stool that cannot be held is still a
        // large-bowel sign.
        levels: {
          dog: [
            'Asks to go out to toilet at usual times and can hold on if needed.',
            'Occasionally asks more urgently than usual, but can wait.',
            'Often needs to go in a hurry, and cannot wait long.',
            'Sometimes has accidents indoors despite asking.',
            'Frequent accidents indoors, with little or no warning.',
            'No control at all — passes stool without seeming to notice (faecal incontinence).',
          ],
          cat: [
            'Uses the tray at the usual times, with no urgency.',
            'Occasionally rushes to the tray, but gets there.',
            'Often rushes to the litter tray and gets there just in time.',
            'Sometimes misses the tray, or toilets just outside it.',
            'Frequently toilets outside the tray, with little warning.',
            'No control at all — passes stool without seeming to notice (faecal incontinence).',
          ],
        },
      },
    ],
  },

  // Selected at setup, but has NO questions of its own — Ash's call, 29 Aug
  // 2026, and the same call already made for gut cancer below.
  //
  // It used to ask two: whether {name} was on a hypoallergenic or single
  // protein trial, and whether the diet had been adhered to today. The
  // Allergies and Skin Disease section now asks both of those and a good deal
  // more — which diet, when it started, how long it has run, whether the trial
  // was broken and with what, and the whole re-challenge protocol — with the
  // milestones drawn on its calendar. Keeping a two-question version here gave
  // an owner a worse form and split one food trial across two sections, each
  // with its own record of when it started.
  //
  // The module stays selectable. What an owner has is still worth recording,
  // and selecting it is what surfaces the way across to Allergies.
  food_sensitivity: {
    key: 'food_sensitivity',
    label: 'Food sensitivity or allergy',
    redirectTo: 'allergies',
    parameters: [],
  },

  infection_parasites: {
    key: 'infection_parasites',
    label: 'Infection or parasites',
    parameters: [
      {
        key: 'visible_parasites',
        label: 'Anything Visible In The Stool?',
        type: 'yesno',
        concernWhen: 'yes',
        why: 'Worms, segments like grains of rice, or anything else you can see.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        concernMessage: 'Worth telling your vet — it may change which treatment is used, or when the next dose is due.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // Better shown than described. What an owner calls "little white bits"
        // a vet can often identify on sight, and the photo is far more use at
        // the appointment than the memory of it — by then the evidence has
        // usually been thrown away.
        followUp: {
          key: 'visible_parasites_photo',
          when: 'yes',
          type: 'photo',
          label: 'Show your vet',
          hint: 'A photo is worth far more than a description here, and it will be gone by the appointment. Take one now and it is saved to {name}\'s photos, ready to show them.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        },
      },
    ],
  },

  anal_glands: {
    key: 'anal_glands',
    label: 'Anal gland disease',
    parameters: [
      {
        key: 'scooting',
        label: 'Scooting Or Licking At The Bottom',
        type: 'scale',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording, shared
        // between dogs and cats: nothing in it is species-specific, and the
        // two drafted versions that differed have gone.
        //
        // Two things added to her text, both flagged: "metallic" is spelled
        // out, and the (emergency) marker is kept on the last level — that is
        // app machinery rather than wording, and without it an abscessed anal
        // gland stops raising a red alert.
        levels: { dog: DOG_SCOOTING_LEVELS, cat: CAT_SCOOTING_LEVELS },
        emergencyMessage: 'A swelling or open sore beside the bottom can be an abscessed anal gland, which is painful and needs treating today.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
      },
    ],
  },

  post_surgery: {
    key: 'post_surgery',
    label: 'Recovery from GIT surgery',
    parameters: [
      {
        key: 'wound',
        label: 'External Appearance Of Surgical Site',
        type: 'scale',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The six levels are still mine. What has changed on
        // Ash's instruction is where the red line sits: everything from
        // moderate-to-severe upwards is now an emergency rather than only a
        // wound that has already opened.
        //
        // That is the right call for the fortnight after gut surgery, which is
        // the only time this module is in use. A weeping site being licked is
        // hours away from a dehisced one, and an owner who is told "worth
        // watching" will watch it.
        levels: { dog: SURGICAL_SITE_LEVELS, cat: SURGICAL_SITE_LEVELS },
        emergencyMessage: 'Seek veterinary attention as soon as possible. Stop {name} licking the site in the meantime.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // A photograph is worth more than any of these six sentences at the
        // appointment, and more still on the phone beforehand — a vet can
        // often tell from one whether this needs to be seen now or tomorrow.
        followUp: {
          key: 'wound_photo',
          whenAtLeast: 4,
          type: 'photo',
          label: 'Show your vet',
          hint: 'Take a photo of the site now. A vet can often tell from a photo how urgent this is, and it gives you something to compare against tomorrow.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        },
      },
      {
        key: 'back_to_normal',
        label: 'Eating And Toileting Since Surgery',
        type: 'choice',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Options and severities both.
        options: [
          { value: 'both', label: 'Eating and passing stool normally' },
          { value: 'eating_only', label: 'Eating, but has not passed stool yet', severity: SEVERITY.CONCERN },
          { value: 'stool_only', label: 'Passing stool, but not eating', severity: SEVERITY.CONCERN },
          { value: 'neither', label: 'Neither eating nor passing stool', severity: SEVERITY.EMERGENCY },
        ],
        concernMessage: 'Worth ringing your vet to check whether this is expected at this stage of recovery.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. Her wording.
        //
        // Two thresholds in one sentence, deliberately: ring today, be seen
        // today if it has already run past a day. The app cannot know how long
        // it has been going — this question is asked about right now — so the
        // message hands that judgement to the owner rather than guessing at it.
        emergencyMessage: 'Worth ringing your vet. If this has been going on for more than a day, {name} needs to be seen as soon as possible.',
      },
    ],
  },

  // NOW ADDS NO QUESTIONS OF ITS OWN, and that is worth knowing before
  // anyone wonders whether something is broken.
  //
  // Megacolon went first (29 Aug 2026): the question it added was effort in
  // the tray, which the core Straining question already asks of both species
  // on six levels with the same emergency at the top. "Days Since The Last
  // Stool" moved the same day to sit under the core Stool Frequency question,
  // where it appears only if the owner answers "Decreased" — so every owner
  // gets it when it is relevant, whether or not they ticked this module.
  //
  // Kept as a selectable label rather than deleted, because selecting it is
  // still meaningful: it records what the owner is monitoring {name} for and
  // it appears in the setup summary. If that is not wanted, deleting the
  // module here is all it takes — nothing else references it.
  constipation: {
    key: 'constipation',
    label: 'Constipation',
    parameters: [],
  },

  megaoesophagus: {
    key: 'megaoesophagus',
    label: 'Megaoesophagus',
    // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. The whole note. The point being made: the danger in
    // megaoesophagus is not the regurgitation itself, it is what gets breathed
    // in, and owners are rarely told to watch for that.
    intro: 'The thing to watch for is not just how often {name} brings food back, but whether any of it has gone into the lungs. A cough, noisy breathing or a temperature in the day or two after an episode is the sign that matters most.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
    parameters: [
      {
        key: 'regurgitation',
        label: 'Bringing Food Back Up',
        type: 'choice',
        // Regurgitation is not vomiting and the difference matters — no
        // heaving, no warning, and it comes back undigested. Asked as its own
        // question rather than folded into the assessment's vomiting one,
        // which asks about something else.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 29 Aug 2026. "After every meal" added,
        // and both it and "after most meals" raised to emergencies on her
        // instruction: regurgitation that has become that consistent can mean
        // an obstruction rather than the megaoesophagus itself, and that is a
        // today problem.
        options: [
          { value: 'none', label: 'Not today' },
          { value: 'once', label: 'Once', severity: SEVERITY.CONCERN },
          { value: 'few', label: 'Two or three times', severity: SEVERITY.CONCERN },
          { value: 'most_meals', label: 'After most meals', severity: SEVERITY.EMERGENCY },
          { value: 'every_meal', label: 'After every meal', severity: SEVERITY.EMERGENCY },
        ],
        concernMessage: 'Worth recording for your vet. Feeding position, food consistency and meal size can often be adjusted to reduce this.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        emergencyMessage: 'Contact your vet as soon as possible.',
      },
          // Regurgitation IS this condition, and aspiration is what kills these patients — the module intro says so.
      ASPIRATION_SIGNS,
],
  },

  pancreatitis: {
    key: 'pancreatitis',
    label: 'Pancreatitis',
    parameters: [
      {
        key: 'praying_position',
        // Dogs only, on Ash's instruction. The praying position is a canine
        // way of easing abdominal pain; a painful cat hunches or hides rather
        // than stretching, so asking a cat owner to watch for it invites a
        // "no" that means nothing.
        species: 'dog',
        label: 'Stretching Or Praying Position',
        type: 'yesno',
        concernWhen: 'yes',
        why: 'Front legs down and bottom up, held for longer than a stretch. It is a way of easing tummy pain, and is worth telling your vet about.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        concernMessage: 'This position is often a sign of tummy pain. Ring your vet today, particularly if {name} is also off {their} food.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
      },
          // Vomiting is cardinal here, and a vomiting patient can aspirate.
      ASPIRATION_SIGNS,
],
  },

  epi: {
    key: 'epi',
    label: 'Exocrine pancreatic insufficiency (EPI)',
    parameters: [
      {
        key: 'stool_volume',
        label: 'Amount Of Stool',
        type: 'choice',
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Options and severities. Volume rather than
        // consistency: the classic EPI sign is a lot of pale, greasy stool
        // from a pet who is eating well, and consistency alone misses it.
        options: [
          { value: 'normal', label: 'The usual amount' },
          { value: 'more', label: 'More than usual', severity: SEVERITY.CONCERN },
          { value: 'much_more', label: 'Much more than usual, and pale or greasy', severity: SEVERITY.CONCERN },
        ],
        concernMessage: 'Worth telling your vet — the enzyme dose may need adjusting.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
      },
    ],
  },

  reflux: {
    key: 'reflux',
    label: 'Reflux',
    parameters: [
      {
        key: 'reflux_signs',
        label: 'Gulping, Lip-Licking Or Burping',
        type: 'scale',
        concernFrom: 4, // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Reflux is easy to miss
        // because the signs look like ordinary behaviour; these are written to
        // be recognisable rather than named.
        //
        // The (emergency) marker on the last level is Ash's, 29 Aug 2026.
        emergencyMessage: 'A pet who is uncomfortable much of the day, eating less or refusing food needs to be seen today. Contact your vet or the nearest emergency clinic.', // APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.
        levels: {
          dog: [
            'None of these today.',
            'A little lip-licking or gulping now and then.',
            'Noticeable gulping or lip-licking after meals.',
            'Gulping, lip-licking or burping several times a day, and seems uncomfortable with it.',
            'Seems uncomfortable for much of the day. Eating less. (emergency)',
            'Refusing food, or crying and unable to settle. (emergency)',
          ],
          cat: [
            'None of these today.',
            'A little lip-licking or swallowing now and then.',
            'Noticeable swallowing or lip-licking after meals.',
            'Swallowing, lip-licking or gagging several times a day, and seems uncomfortable with it.',
            'Seems uncomfortable for much of the day. Eating less. (emergency)',
            'Refusing food, or crying and unable to settle. (emergency)',
          ],
        },
      },
          // Reflux brings stomach contents to the back of the throat, which is the other route into the airway.
      ASPIRATION_SIGNS,
],
  },

  // Selected at setup, but has no questions of its own. Cancer of the gut is
  // monitored by the cancer section, which already has the diagnoses, the
  // treatment modules and the VCOG grading — rebuilding a lesser version of
  // that here would give an owner a worse form and split their history in two.
  gi_cancer: {
    key: 'gi_cancer',
    label: 'Gastrointestinal cancer',
    redirectTo: 'cancer',
    parameters: [],
  },
}

export const GI_MODULE_LIST = Object.values(GI_MODULES)

export function giModuleByKey(key) {
  return GI_MODULES[key] ?? null
}

// Modules offered to this species.
//
// Nothing is narrowed today — megacolon was, and has gone. Kept because the
// alternative is rebuilding it the next time a module applies to one species
// only, and because `parametersForGi` leans on it to drop questions from a
// config that names a module this species cannot be offered.
export function giModulesForSpecies(species) {
  if (!species) return GI_MODULE_LIST
  return GI_MODULE_LIST.filter((module) => !module.species || module.species === species)
}

// Which disease-monitoring questions feed which wellbeing pillar.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Her categories:
//   Comfort     arthritis, pain, pruritus, hygiene, skin and coat, ears,
//               breathing and breathing effort, coughing, ascites,
//               fainting/collapse, exercise tolerance, seizures
//   Appetite    vomiting, nausea, stool quality, drinking, reflux
//
// COGNITIVE TOILETING / LITTER HABITS MOVED TO COMFORT on Ash's instruction,
// 5 Oct 2026 — it sat under Appetite from 21 Sep. Losing the habit of asking
// to go out, or of using the tray, is a comfort and dignity problem rather
// than a digestive one, and arthritis:litter_tray has always been read that
// way: the same behaviour should not change pillar because the cause is
// cognitive rather than musculoskeletal.
//
// URINATION MOVED TO COMFORT on Ash's instruction, 24 Sep 2026 — passing
// urine is a question about physical ease rather than about intake and
// digestion, and straining, blood or an inability to pass it are pain. Water
// intake stays with Appetite, which is where drinking belongs.
//   Sleep       anything about sleep
//   Curiosity   anything about curiosity (plus vision and hearing, hers)
//   Connection  attitude, engagement with family and others
// Questions she did not name were placed by me and approved with the list.
//
// Keyed `${conditionKey}:${parameterKey}`. Anything not listed feeds no
// pillar — including questions that can never flag (what a seizure looked
// like, whether there was a warning), which would only dilute the average.
//
// Questions that share a field with the Overall Assessment (vomiting,
// appetite, palpation, sleep) are deliberately absent: their answer is
// carried into the assessment the same day and counted there, once.

const C = 'comfort'
const A = 'appetite'
const S = 'sleep'
const CU = 'curiosity'
const CO = 'connection'

const GI = {
  faecal_consistency: A, faecal_score: A, stool_frequency: A, blood_or_mucus: A, straining: A,
  abdominal_pain: C, urgency: A, visible_parasites: A, scooting: C, wound: C,
  back_to_normal: A, regurgitation: A, aspiration_signs: C, praying_position: C,
  stool_volume: A, reflux_signs: A,
}

const BY_CONDITION = {
  allergies: {
    itch: C, skin: C, ears: C, paws_face: C, rechallenge_reaction: C,
    itch_sleep: S, faecal_consistency: A, faecal_score: A,
  },
  arthritis: {
    limping: C, stiffness_after_rest: C, walk_tolerance: C, jump_height: C,
    grooming: C, litter_tray: C,
  },
  cognitive: {
    disorientation: CU, activity_changes: CU, interactions: CO, anxiety: CO,
    // Comfort, not Appetite — Ash's instruction 5 Oct 2026. Losing the habit
    // of asking to go out, or of using the tray, is a comfort and dignity
    // problem rather than a digestive one: arthritis:litter_tray has always
    // been read that way, and the same behaviour should not change pillar
    // because the cause is cognitive rather than musculoskeletal.
    house_soiling: C,
    // Ash's instruction 1 Oct 2026: the cognitive sleep question feeds Sleep.
    //
    // It is the exception to the rule above, and safe to be one. The question
    // SUPERSEDES the assessment's own sleep score — same scale, same six
    // levels — and writes its answer into it, so on a day with an assessment
    // the two items hold the identical number and averaging them changes
    // nothing. On a day WITHOUT one there is nothing to write into, and
    // without this line the answer reached no pillar at all.
    sleep_wake: S,
  },
  cardiac: {
    resting_respiratory_rate: C, respiratory_effort: C, coughing: C,
    exercise_tolerance: C, syncope: C, mucous_membranes: C, abdominal_distension: C,
  },
  kidney: {
    water_intake: A, water_intake_ml: A, urination: C, nausea: A, mouth: A,
  },
  seizures: {
    had_seizure: C, seizure_count: C, seizure_duration: C, consciousness: C, recovery: C,
  },
  cancer: {
    ...GI,
    nausea: A, in_himself: CO, coughing: C, respiratory_effort: C, mucous_membranes: C,
    weight_bearing: C, unable_to_pass_urine: C, straining_to_urinate: C, blood_in_urine: C,
    vomiting: A, diarrhoea: A, black_tarry_stool: A, collapse_episode: C, swollen_abdomen: C,
    nasal_discharge: C, facial_swelling: C, noisy_breathing: C, dropping_food: A,
    avoiding_hard_food: A, oral_bleeding: A, drooling: A, lethargy: CU,
    unusually_quiet_or_hot: C, skin_at_site: C, pain_at_site: C,
  },
  gastrointestinal: { ...GI },
}

export function pillarFor(conditionKey, parameterKey) {
  return BY_CONDITION[conditionKey]?.[parameterKey] ?? null
}

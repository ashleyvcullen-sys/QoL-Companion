// Short, prose-friendly name for a category. The full labels carry
// parenthetical clarifications ("Ambulation (walking, stairs & jumping)")
// that are useful as headings but unreadable mid-sentence, so those are
// stripped. Names without a parenthetical (e.g. cat "Eyes / Face") are
// already short and pass through unchanged.
export function beapCategoryDisplayName(species, key) {
  const category = BEAP_SCALES[species]?.find((c) => c.key === key)
  if (!category) return key
  return category.label.split('(')[0].trim()
}

// Sleep, on the same six-level shape as everything else.
//
// Lives here rather than inside the cognitive condition because BOTH ask it:
// the daily assessment's sleep question IS this scale, and cognitive decline
// asks the same thing again in the context of dementia. One definition, so
// the two can never describe sleep differently.
//
// Ordered best first, like every scale in this file — the caller decides
// whether that maps to 0 (a severity) or to 10 (a score).
//
// Level 0 is shared word for word between the species — a normal night is a
// normal night — and the dog levels below it are Ash's. The cat levels from
// "occasionally restless" down are still mine.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 25 Aug 2026, for level 0 and the dog scale.
// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026.  for cat levels 1 to 5.
const SLEEPS_NORMALLY =
  'Sleeps through the night and is awake, or can be woken easily, throughout the day (napping throughout the day is normal).'

export const SLEEP_SCALE = {
  dog: [
    SLEEPS_NORMALLY,
    'Occasional and brief moments of being unsettled at night, but will settle quickly.',
    'Wakes once or twice most nights but eventually settles. Sleeping more than usual throughout the day.',
    'Restless and unsettled for long periods throughout the night. Sleeps most of the day.',
    'Awake and unsettled most of the night. Pacing, panting or barking even if nothing is there. Sleeps most of the day.',
    'Day and night sleep cycles are completely reversed. Pacing, panting or barking all night, then sleeping throughout the whole day.',
  ],
  cat: [
    SLEEPS_NORMALLY,
    'Occasionally restless or vocal at night, then settles.',
    'Calls out or wanders at night once or twice most nights.',
    'Vocalising or pacing for long stretches at night, most nights.',
    'Loud, distressed calling at night, and asleep most of the day.',
    'Awake and calling all night, seeming very distressed, then sleeps all day.',
  ],
}

// SEVERITY BANDS, per category, as data.
//
// `concernFrom` and `emergencyFrom` are the score at or above which an answer
// is flagged. null means that category never reaches that band.
//
// These used to be a literal "(emergency)" typed into the level prose, which
// isEmergencyLevel found with String.includes. That had two problems: a typo
// silently disabled a flag with nothing to notice it, and the marker had to
// be scrubbed out of every string before it could be shown to anyone. The
// markers are gone; these fields are the only source.
//
// EMERGENCY IS EVERY CATEGORY AT 8 AND 10, on Ash's instruction 3 Sep 2026:
// every severe rung that was not already an emergency became one, and the
// alert under it tells the owner to contact their vet as soon as possible.
//
// Until then only breathing and appetite fired at 8, with attitude and
// posture at 10 and eyes, ambulation, activity and palpation never firing at
// all. Her call was that a severe rung on any of the eight describes an
// animal who needs to be seen, and that a scale where "severe" means an
// emergency on two categories and nothing on four teaches an owner to read
// the words rather than trust the marks.
//
// Two consequences worth knowing, both flagged to her:
//   - EYES IS THE EXCEPTION, on her instruction the same day: no concern band
//     and no emergency band, exactly as before. It was briefly given one by
//     the change above and taken straight back out — its 6 and 8 wording is
//     nearly identical, and for cats the score is the summed Feline Grimace
//     Scale rather than a six-step picker, so it does not behave like the
//     other seven and should not be graded like them;
//   - ATTITUDE GAINED ITS AMBER BAND on Ash's instruction 4 Sep 2026:
//     concern from 6, emergency unchanged at 8. It had no amber band at all
//     for three days — concernFrom and emergencyFrom were both 8, so 8 and
//     10 fired red and 6 was clear, and the one thing an owner could never
//     see on attitude was a warning.
//
//     Her call on the rungs: "withdrawn, less interested in family" (6) is
//     worth surfacing without sending anyone to a vet tonight; "avoids
//     interaction, anxious or irritable, hides often" (8) and "unresponsive
//     or clearly distressed" (10) are both red. Eyes therefore remains the
//     only category that departs from severe-means-emergency-at-8.
//
//     APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026.
//
// CONCERN IS NEW, and set per category rather than as one cutoff, because the
// six levels do not mean equivalent things across the eight. At 6 a dog has
// "stopped using stairs altogether" (ambulation) but is only "withdrawn, less
// interested in family" (attitude) — the first is worth surfacing, the second
// is a description of most older dogs on a quiet day. Numbers set by Ash,
// 1 Sep 2026:
//
//   >= 6   ambulation, activity, palpation, posture, breathing, appetite,
//          and attitude since 4 Sep 2026 — see the note above; it was >= 8,
//          which collided with its own emergency threshold and left the
//          category with no amber band at all
//   never  eyes
//
// Eyes is excluded deliberately. Its 6 and 8 wording is nearly identical, and
// for cats the score is the summed Feline Grimace Scale rather than a
// six-step picker, so it does not behave like the other seven.
//
// Same numbers for both species: the seven that band are species-neutral, and
// eyes — the one that is not — is the one left out.
export const BEAP_SCALES = {
  dog: [
    { key: "breathing", letter: "B", label: "Breathing", concernFrom: 6, emergencyFrom: 8, levels: [
      "Breathing appears comfortable, calm, and takes minimal effort.",
      "Occasional panting at rest. Breathing otherwise appears comfortable, calm, and takes minimal effort.",
      "Occasionally breathing a little faster or heavier, panting more often at rest.",
      "Often breathing faster or heavier than usual. Panting often at rest.",
      "Constant rapid, laboured breathing, even at rest.",
      "Distressed gasping, struggling to breathe. Gums may appear white or blue.",
    ] },
    { key: "eyes", letter: "E", label: "Eyes", concernFrom: null, emergencyFrom: null, levels: [
      "Eyes bright and alert.",
      "Eyes slightly less bright than usual.",
      "Eyes slightly duller, brow may be slightly furrowed.",
      "Dull eyes, may look slightly narrowed or worried.",
      "Dull eyes, may look narrowed or distressed.",
      "Dull eyes that may be closed completely or may look panicked.",
    ] },
    { key: "ambulation", letter: "A", label: "Ambulation (walking, stairs & jumping)", concernFrom: 6, emergencyFrom: 8, levels: [
      "Walks normally, manages stairs easily, no stiffness. Jumps into the car or onto furniture without hesitation.",
      "Occasional stiffness, otherwise normal. Slight hesitation before jumping.",
      "Mild or intermittent limping and/or stiffness, especially after lying down. Reluctant to use stairs and jump into the car or onto furniture.",
      "Constant limping and/or stiffness, avoids stairs and jumping altogether.",
      "Reluctant to bear weight and/or moves with marked stiffness. Won't attempt stairs or jumping. Occasionally licks or chews a painful area.",
      "Unable or unwilling to stand or walk or jump. Often licks or chews a painful area.",
    ] },
    { key: "activity", letter: "A", label: "Activity", concernFrom: 6, emergencyFrom: 8, levels: [
      "Plays and engages in all normal activities.",
      "Slightly less playful than usual.",
      "Reduced interest in play or activity.",
      "Mostly rests, withdrawn from family. Not interested in play anymore.",
      "Reluctant to move.",
      "Won't get up at all.",
    ] },
    { key: "appetite", letter: "A", label: "Appetite", concernFrom: 6, emergencyFrom: 8, levels: [
      "Eating normally.",
      "Slightly slower to eat.",
      "A bit picky, some hesitancy.",
      "Eating noticeably less; only wants treats or human food.",
      "Little interest in food, even treats.",
      "Refusing food.",
    ] },
    { key: "attitude", letter: "A", label: "Attitude", concernFrom: 6, emergencyFrom: 8, levels: [
      "Happy, interested, seeks attention.",
      "Generally happy, occasionally withdrawn.",
      "Somewhat subdued or less interested.",
      "Withdrawn, less interested in family.",
      "Avoids interaction, anxious or irritable. Hides often.",
      "Unresponsive or clearly distressed. Constantly hiding or withdrawn.",
    ] },
    { key: "posture", letter: "P", label: "Posture", concernFrom: 6, emergencyFrom: 8, levels: [
      "Relaxed at rest and during play; tail moving normally.",
      "Mostly relaxed; tail a little lower.",
      "Slightly tense or restless; tail lower. Seems reluctant to lay down or relax.",
      "Tense, guarded, reluctant to lie down; tail tucked.",
      "Hunched, tucked tail, odd position. Can't seem to get comfortable.",
      "Rigid and trembling/shaking, can't seem to get comfortable.",
    ] },
    { key: "palpation", letter: "P", label: "Palpation (response to touch)", concernFrom: 6, emergencyFrom: 8, levels: [
      "Enjoys touch, no tension.",
      "Comfortable, mild tension in one area.",
      "Some sensitivity or mild flinching.",
      "Flinches or pulls away from a specific area.",
      "Guards or growls when touched.",
      "Won't tolerate touch, cries out or snaps.",
    ] },
  ],
  cat: [
    { key: "breathing", letter: "B", label: "Breathing", concernFrom: 6, emergencyFrom: 8, levels: [
      "Calm, normal breathing.",
      "Normal breathing, occasionally a little quicker.",
      "A little faster or heavier breathing.",
      "Noticeably faster, more effort to breathe.",
      "Rapid, laboured, open-mouth breathing.",
      "Distressed, gasping, or extreme effort to breathe.",
    ] },
    { key: "eyes", letter: "E", label: "Eyes / Face", concernFrom: null, emergencyFrom: null, levels: [
      "Ears forward, eyes round with normal pupils, relaxed muzzle, whiskers loose.",
      "Ears slightly rotated, mild squint, pupils a touch wider.",
      "Ears rotated out or back, moderate squint, dilated pupils.",
      "Ears flattened, squinting with a tense muzzle (grimace face), whiskers bunched.",
      "Ears tightly flattened, eyes tightly closed, clear grimace face.",
      "Vacant stare or unresponsive, ears pinned flat, pupils fixed.",
    ] },
    { key: "ambulation", letter: "A", label: "Ambulation (jumping, walking & stairs)", concernFrom: 6, emergencyFrom: 8, levels: [
      "Jumps and walks normally, manages stairs easily.",
      "Occasional hesitation before jumping or using stairs.",
      "Mild reluctance to jump or use stairs.",
      "Avoids jumping and stairs, some limping.",
      "Won't jump or use stairs, noticeable limping.",
      "Unable or unwilling to walk or jump.",
    ] },
    { key: "activity", letter: "A", label: "Activity", concernFrom: 6, emergencyFrom: 8, levels: [
      "Normal play, exploring, and grooming.",
      "Slightly less playful than usual.",
      "Reduced play, grooms a little less.",
      "Mostly rests, withdrawn from family.",
      "Hiding more; licking or chewing a painful area, or accidents outside the litter tray.",
      "Withdrawn and hiding, won't engage; incontinence.",
    ] },
    { key: "appetite", letter: "A", label: "Appetite", concernFrom: 6, emergencyFrom: 8, levels: [
      "Eating normally.",
      "Slightly slower to eat.",
      "A bit picky, some hesitancy.",
      "Eating noticeably less; only wants treats or human food.",
      "Little interest in food, even treats.",
      "Refusing food.",
    ] },
    { key: "attitude", letter: "A", label: "Attitude", concernFrom: 6, emergencyFrom: 8, levels: [
      "Sociable, curious, seeks attention.",
      "Generally sociable, occasionally withdrawn.",
      "Somewhat subdued or less interested.",
      "Withdrawn, hides more, less interested in family.",
      "Avoids interaction, anxious or irritable.",
      "Unresponsive or clearly distressed.",
    ] },
    { key: "posture", letter: "P", label: "Posture", concernFrom: 6, emergencyFrom: 8, levels: [
      "Relaxed at rest; tail moving normally.",
      "Mostly relaxed; tail a little lower or twitchier.",
      "Sits hunched or tense ('loaf') more than usual; tail flicking more.",
      "Hunched 'loaf' posture for long periods; tail low or tucked.",
      "Tightly hunched, tucked in, won't move from position.",
      "Rigid, trembling, can't get comfortable.",
    ] },
    { key: "palpation", letter: "P", label: "Palpation (response to touch)", concernFrom: 6, emergencyFrom: 8, levels: [
      "Enjoys touch, no tension.",
      "Comfortable, mild tension in one area.",
      "Some sensitivity or mild flinching.",
      "Flinches or pulls away from a specific area.",
      "Guards, hisses, or growls when touched.",
      "Won't tolerate touch, hisses, cries out, or swats.",
    ] },
  ],
};

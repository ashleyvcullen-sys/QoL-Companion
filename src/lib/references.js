// Every published instrument this app draws on, in one place.
//
// It used to be three places: a line under each question that used a scale, a
// line at the top of each condition, and a hand-written paragraph in the
// legal screen. Three copies of the same list is three chances for one to
// fall behind — and the one that must never fall behind is the legal one,
// because that is the copy that has to be complete.
//
// So this is the source. The assessment shows its own subset at the start,
// the condition pages show theirs at the top, and the attribution section of
// Terms and Privacy renders ALL of them without anyone having to remember to
// add the new one.
//
// `where` says which screens a reference belongs to:
//   'assessment'  the Overall Quality of Life Assessment
//   'condition'   a disease monitoring section (these carry their own line)
//   'app'         used elsewhere — body condition, life stage, end of life
//
// `species` narrows a reference to one species where the instrument only
// applies to one. Left out, it applies to both.
export const REFERENCES = [
  {
    key: 'beaaaapp',
    where: 'assessment',
    short: 'Incorporates ideas from the BEAAAAPP pain scale concept by Dr. Shea Cox.',
    full: 'This app incorporates ideas from the BEAAAAPP pain-scale concept by Dr. Shea Cox.',
  },
  {
    key: 'feline-grimace',
    where: 'assessment',
    species: 'cat',
    short: 'Incorporates ideas from the Feline Grimace Scale (Evangelista et al., Scientific Reports, 2019, Université de Montréal).',
    full: 'The cat eyes/face scoring incorporates ideas from the Feline Grimace Scale (Evangelista MC, Watanabe R, Leung VSY, Monteiro BP, O\'Toole E, Pang DSJ, Steagall PV. "Facial expressions of pain in cats: the development and validation of a Feline Grimace Scale." Scientific Reports, 2019;9:19128).',
  },
  {
    key: 'vcog-ctcae',
    where: 'condition',
    short: 'Incorporates assessment structures from the Veterinary Cooperative Oncology Group — Common Terminology Criteria for Adverse Events (VCOG-CTCAE).',
    full: 'Cancer treatment side-effect grading incorporates assessment structures from the Veterinary Cooperative Oncology Group — Common Terminology Criteria for Adverse Events (VCOG-CTCAE).',
  },
  {
    key: 'load-fmpi',
    where: 'condition',
    short: 'Incorporates ideas and assessment structures from the Liverpool Osteoarthritis in Dogs (LOAD) questionnaire and the Feline Musculoskeletal Pain Index (FMPI).',
    full: 'Arthritis monitoring incorporates ideas and assessment structures from the Liverpool Osteoarthritis in Dogs (LOAD) questionnaire and the Feline Musculoskeletal Pain Index (FMPI).',
  },
  {
    key: 'dishaa',
    where: 'condition',
    // PENDING ASH — confirm the instrument and the exact wording. Nothing
    // from DISHAA is reproduced; the domains are followed and the owner
    // wording is drafted.
    short: 'Incorporates assessment structures from the DISHAA cognitive assessment domains.',
    full: 'Cognitive decline monitoring incorporates assessment structures from the DISHAA domains (Disorientation, Interactions, Sleep-wake cycle, House-soiling, Activity, Anxiety).',
  },
  {
    key: 'acvim-cardiac',
    where: 'condition',
    // PENDING ASH — drafted by me, both lines. Heart disease was the one
    // monitoring section with no citation at all. The parameters it collects
    // (resting respiratory rate, exercise tolerance, syncope, abdominal
    // distension) are the ones these two sources describe, but the instrument
    // and the exact wording are yours to confirm — and I have not reproduced
    // anything from either.
    short: 'Incorporates ideas from ACVIM consensus guidelines on myxomatous mitral valve disease and from published guidance on home monitoring of sleeping and resting respiratory rate.',
    full: 'Heart disease monitoring incorporates ideas from the American College of Veterinary Internal Medicine (ACVIM) consensus guidelines for the diagnosis and treatment of myxomatous mitral valve disease in dogs (Keene BW, Atkins CE, Bonagura JD, et al. J Vet Intern Med. 2019;33(3):1127-1140), and from published guidance on owner monitoring of sleeping and resting respiratory rate.',
  },
  {
    key: 'pvas',
    where: 'condition',
    // PENDING ASH — confirm both instruments and the exact wording.
    //
    // TWO scales, not one. The canine PVAS does not apply to cats, and the
    // feline instrument was published thirteen years later precisely because
    // cats show pruritus differently. Crediting only the dog one would be
    // crediting the wrong paper to half the users.
    //
    //   PVAS   Rybnicek J, Lau-Gillard PJ, Harvey R, Hill PB. "Further
    //          validation of a pruritus severity scale for use in dogs."
    //          Veterinary Dermatology 2009;20(2):115-122.
    //   VAScat Colombo S, Sartori R, Schievano C, Borio S. "Development and
    //          validation of an owner-assessed Visual Analog Scale for feline
    //          pruritus severity scoring (VAScat)." Veterinary Dermatology
    //          2022. PMID 35920060.
    //
    // Nothing from either is reproduced: the 0-10 owner-rated structure is
    // followed and the wording at each level is drafted.
    short: 'Incorporates assessment structures from published owner-assessed pruritus severity scales for dogs and cats.',
    full: 'Itch scoring incorporates assessment structures from published owner-assessed pruritus severity scales — the Pruritus Visual Analog Scale (PVAS) in dogs (Rybnicek J, Lau-Gillard PJ, Harvey R, Hill PB, Veterinary Dermatology, 2009) and VAScat in cats (Colombo S, Sartori R, Schievano C, Borio S, Veterinary Dermatology, 2022).',
  },
  {
    key: 'wsava-bcs',
    where: 'app',
    short: 'Incorporates the WSAVA/Purina 9-point body condition scoring structure.',
    full: 'Body condition scoring incorporates the WSAVA/Purina 9-point scale (World Small Animal Veterinary Association, in partnership with Purina).',
  },
  {
    // The BCS illustrations are NOT WSAVA's artwork — see BCS_IMAGE_CREDIT in
    // lib/bcsScale.js. It used to be credited on the Body Condition screen
    // itself; with the page-bottom credits gone (29 Aug 2026, Ash's call)
    // this is the only place it is now said, so it has to be said here.
    key: 'wsava-bcs-images',
    short: 'Illustrations incorporate ideas from the WSAVA Body Condition Score chart.',
    full: 'The body condition illustrations incorporate ideas from the WSAVA Body Condition Score chart. They are an adaptation and not the official WSAVA artwork.',
  },
  {
    key: 'aaha-aafp',
    where: 'app',
    short: 'Incorporates ideas from published AAHA and AAFP life-stage guidelines.',
    full: 'Life-stage and human-year equivalents incorporate ideas from published AAHA and AAFP guidelines.',
  },
  {
    key: 'lehman-grief',
    where: 'app',
    short: 'Incorporates ideas from guidance by Kristi Lehman, MSW, LISW, DVM Center.',
    full: 'The "How children grieve" guidance incorporates ideas from material by Kristi Lehman, MSW, LISW, DVM Center.',
  },
]

// The references shown at the start of the assessment, for this pet.
//
// Species-filtered, because the Feline Grimace Scale is not used on a dog and
// crediting an instrument the owner will never be shown is noise dressed up
// as rigour.
export function assessmentReferences(species) {
  return REFERENCES.filter((reference) => (
    reference.where === 'assessment'
    && (!reference.species || reference.species === species)
  ))
}

// Every reference, in full, for the attribution section of Terms and Privacy.
// No filter of any kind: that section exists to be complete.
export function allReferencesText() {
  return REFERENCES.map((reference) => reference.full)
}

// The short form of one reference, by key. Used by the condition definitions
// so a condition's citation line and the legal attribution are two views of
// one record rather than two strings that happen to match today.
export function referenceText(key) {
  const reference = REFERENCES.find((entry) => entry.key === key)
  // Loud rather than silent. A missing citation is a legal problem, and an
  // empty string on the screen would look exactly like a condition that
  // never had one.
  if (!reference) throw new Error(`Unknown reference: ${key}`)
  return reference.short
}

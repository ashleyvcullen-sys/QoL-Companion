import {
  HYGIENE_SYMPTOM_OPTIONS,
  STOOL_NONE_TODAY_OPTION,
  STOOL_SYMPTOM_OPTIONS,
  URINATION_STATUS_OPTIONS,
  URINATION_SYMPTOM_OPTIONS,
  VOMITING_FREQUENCY_QUALIFIER_OPTIONS,
  WATER_INTAKE_OPTIONS,
} from './assessmentOptions'
import { BEAP_SCALES, SLEEP_SCALE, beapCategoryDisplayName } from './beapScales'
import {
  BEAP_CATEGORIES,
  scoreSlider,
  scoreStoolOrHygiene,
  scoreUrination,
  scoreVomiting,
} from './scoring'

// One day's Overall Quality of Life Assessment, question by question.
//
// The calendar could say a day was 62%; it could not say what was answered to
// get there. This turns a saved row back into the questions as they were
// asked and the answers as they were given, in the order the assessment
// walks through them — so "why was Tuesday amber?" is one tap rather than a
// memory test.
//
// Unanswered questions are dropped rather than listed blank. A row saved
// before a question existed is the normal case here, not an error, and a
// screen full of dashes is not a summary.
export function describeAssessmentDay(generalEntry, painEntry, species) {
  const rows = []
  const scores = generalEntry?.scores ?? {}

  // `severity` is 'concern' or null, and it is what lifts a row into the
  // "Worth monitoring" group in DayAnswersModal — the same field the condition
  // rows already carry, so both feeds normalise the same way.
  //
  // A THRESHOLD PER QUESTION, not one across all of them. These are not a
  // common 0-10 scale: most are three-point step functions, and the same
  // number means different things on different questions. Three vomits and
  // mildly increased drinking both land near the middle and are not
  // equivalently worrying, so a single cutoff would flag the wrong ones.
  // Numbers set by Ash, 1 Sep 2026.
  function add(label, answer, detail, severity = null) {
    if (answer == null || answer === '') return
    rows.push({ key: label, label, answer, detail: detail || null, severity })
  }

  // null is "Not sure" or unanswered and must never flag: the owner said they
  // did not know, which is not the same as saying something is wrong.
  const atOrBelow = (score, limit) => (score == null ? null : (score <= limit ? 'concern' : null))

  // The sliders read back as the number that was chosen, with the wording
  // from either end of the scale so the number means something. "7/10" on its
  // own tells an owner nothing they didn't already know.
  add('Stool quality', sliderAnswer(scores.stool, 'Watery / diarrhoea', 'Well formed'),
    chipList(generalEntry?.stoolSymptoms, [...STOOL_SYMPTOM_OPTIONS, STOOL_NONE_TODAY_OPTION]),
    atOrBelow(scoreStoolOrHygiene(scores.stool, generalEntry?.stoolSymptoms ?? []), 4))

  // <= 5 is ANY vomiting: scoreVomiting gives 10 for none, 5 for vomiting
  // under the daily/weekly threshold, 0 for over it. So the flag fires the
  // first time rather than waiting for it to become frequent.
  add('Vomiting', vomitingAnswer(generalEntry?.vomiting),
    null,
    atOrBelow(generalEntry?.vomiting ? scoreVomiting(generalEntry.vomiting) : null, 5))

  // Score 0 only — abnormal WITH a symptom. Abnormal with none scores 5 and
  // deliberately does not flag: "something is off but I cannot say what"
  // carries nothing a vet could act on.
  add('Urination', optionLabel(generalEntry?.urination?.status, URINATION_STATUS_OPTIONS),
    chipList(generalEntry?.urination?.symptoms, URINATION_SYMPTOM_OPTIONS),
    atOrBelow(generalEntry?.urination ? scoreUrination(generalEntry.urination) : null, 0))

  // Both directions, off the STATUS rather than the score. scoreWaterIntake
  // returns 5 for reduced and 5 for increased, so the score cannot tell them
  // apart — but the stored status can, and the row already reads "Reduced" or
  // "Increased", so the flag is never ambiguous.
  add('Drinking', optionLabel(generalEntry?.waterIntake?.status, WATER_INTAKE_OPTIONS),
    null,
    ['reduced', 'increased'].includes(generalEntry?.waterIntake?.status) ? 'concern' : null)

  add('Hygiene, coat quality and grooming', sliderAnswer(scores.hygiene, 'Unkempt', 'Clean'),
    chipList(generalEntry?.hygieneSymptoms, HYGIENE_SYMPTOM_OPTIONS),
    // 3, not 4 like stool. A 4/10 coat is scruffy; it was lifting into "Worth
    // a look" beside blood in the urine, which flattened the difference
    // between the two. Ash's call, 1 Sep 2026.
    atOrBelow(scoreStoolOrHygiene(scores.hygiene, generalEntry?.hygieneSymptoms ?? []), 3))

  add('Vision', sliderAnswer(scores.vision, 'Bumps into things', 'Moves confidently'),
    null, atOrBelow(scoreSlider(scores.vision), 4))
  add('Hearing', sliderAnswer(scores.hearing, "Doesn't respond", 'Responds normally'),
    null, atOrBelow(scoreSlider(scores.hearing), 4))

  // Sleep is the one general score with real level wording behind it, so it
  // reads back as those words rather than as a number.
  add('Sleep', sleepAnswer(scores.sleep, species), null, atOrBelow(scoreSlider(scores.sleep), 4))

  // The BEAAAAPP categories, in the order they are asked, each as the level
  // text that was on screen when it was chosen.
  const beap = painEntry?.beap ?? {}
  for (const category of BEAP_CATEGORIES) {
    const value = beap[category]
    if (value == null) continue
    rows.push({
      key: `beap:${category}`,
      label: beapCategoryDisplayName(species, category),
      answer: beapLevelText(category, value, species),
      detail: null,
      // Drives the dot beside the answer and lifts the row into "Worth a
      // look". A three-band severity now, matching what the condition rows
      // carry, rather than a boolean that could only ever say "emergency".
      severity: beapSeverity(category, value, species),
    })
  }

  const notes = [generalEntry?.notes, painEntry?.notes]
    .map((text) => (text ?? '').trim())
    .filter(Boolean)
  // Deduplicated: the same note saved through both halves of one save would
  // otherwise read as two different notes.
  const uniqueNotes = [...new Set(notes)]
  if (uniqueNotes.length) {
    rows.push({ key: 'notes', label: 'Notes', answer: uniqueNotes.join(' — '), detail: null })
  }

  return rows
}

function sliderAnswer(value, lowLabel, highLabel) {
  if (value == null || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  // Which end of the scale the answer sits at, in words. The midpoint gets
  // neither, because calling a 5 "well formed" would be a claim the owner
  // did not make.
  const sense = numeric >= 7 ? highLabel : numeric <= 3 ? lowLabel : null
  return sense ? `${numeric}/10 — ${sense}` : `${numeric}/10`
}

function sleepAnswer(value, species) {
  if (value === 'unsure') return 'Not sure'
  if (value == null || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  // SleepPage scores best-first from 10 down to 0, so the level index is the
  // inverse of the score over two.
  const levels = SLEEP_SCALE[species] ?? SLEEP_SCALE.dog
  const level = levels[(10 - numeric) / 2]
  return level ? stripTokens(level) : `${numeric}/10`
}

function vomitingAnswer(vomiting) {
  if (!vomiting) return null
  if (vomiting.hasVomited === 'unsure') return 'Not sure'
  if (!vomiting.hasVomited) return 'No vomiting'

  const qualifier = optionLabel(vomiting.frequency, VOMITING_FREQUENCY_QUALIFIER_OPTIONS)
  const frequency = qualifier
    ?? (vomiting.frequency != null && vomiting.frequency !== ''
      ? `${vomiting.frequency} ${vomiting.unit ?? ''}`.trim()
      : null)

  const character = (vomiting.character ?? []).filter(Boolean).join(', ')
  return ['Vomited', frequency, character].filter(Boolean).join(' — ')
}

function optionLabel(value, options) {
  if (value == null || value === '') return null
  return options.find((option) => option.value === value)?.label ?? null
}

// The chips chosen under a slider, as a readable list. Options may be plain
// strings or {value,label} objects depending on the question, so both shapes
// are handled rather than assuming one.
function chipList(values, options) {
  if (!Array.isArray(values) || values.length === 0) return null
  return values
    .map((value) => {
      const match = options.find((option) => (
        typeof option === 'string' ? option === value : option.value === value
      ))
      if (!match) return String(value)
      return typeof match === 'string' ? match : match.label
    })
    .join(', ')
}

function beapEntryFor(category, species) {
  const scale = BEAP_SCALES[species] ?? BEAP_SCALES.dog
  return scale.find((entry) => entry.key === category) ?? null
}

function beapLevelsFor(category, species) {
  return beapEntryFor(category, species)?.levels ?? []
}

function beapLevelText(category, value, species) {
  const score = Number(value)
  if (!Number.isFinite(score)) return String(value)
  const level = beapLevelsFor(category, species)[score / 2]
  return level ? stripTokens(level) : `${score}/10`
}

// Read from the category's own bands rather than found in its prose. See the
// note above BEAP_SCALES: a marker typed into a sentence could be lost to a
// typo with nothing to notice, and had to be scrubbed before display.
//
// Emergency behaviour is deliberately identical to the string matching this
// replaces — breathing and appetite at 8 and 10, attitude and posture at 10.
function beapSeverity(category, value, species) {
  const score = Number(value)
  if (!Number.isFinite(score)) return null

  const entry = beapEntryFor(category, species)
  if (!entry) return null

  if (entry.emergencyFrom != null && score >= entry.emergencyFrom) return 'emergency'
  if (entry.concernFrom != null && score >= entry.concernFrom) return 'concern'
  return null
}

// Level text carries the **bold** runs that PetText turns into markup, which
// do not belong in a plain summary line. The "(emergency)" marker this also
// used to strip is gone — the bands are data now, not prose.
function stripTokens(text) {
  return String(text)
    .replace(/\*\*/g, '')
    .trim()
}

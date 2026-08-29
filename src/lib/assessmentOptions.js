// Sits next to ScoreSlider's built-in "Not sure" button, specifically on the
// stool/faeces page (see ScoreSlider's `extraOption` prop).
export const STOOL_NONE_TODAY_OPTION = { value: 'none', label: 'No faeces today' }

export const STOOL_SYMPTOM_OPTIONS = [
  'None',
  'Constipation',
  'Straining',
  'Incontinence',
  'Fresh blood',
  'Mucous',
  'Black/tarry',
  'Other',
]

// Stool findings that stop the assessment and say so.
//
// The chips are otherwise all equal: any one of them takes the same 5 points
// off the stool score and none of them says anything. Melaena is not equal to
// the others — it is digested blood, it means bleeding somewhere upstream,
// and an owner who does not know that will tick it and move on. So this one
// raises the same interruption the male-cat urinary blockage does.
//
// PENDING ASH — wording drafted by me, not reviewed.
export const STOOL_EMERGENCY = {
  chips: ['Black/tarry'],
  title: 'This could be an emergency',
  warning:
    'Black, tarry stools usually mean digested blood, which comes from bleeding higher up in the gut. '
    + 'It can look like ordinary dark stool, so it is easily missed.',
  advice:
    'Please contact your vet today, even if {name} seems otherwise well in {them}self.',
}

// Sleep, in numbers. Owners consistently ask two things — how much is normal,
// and whether what they are seeing is just age — and the answer to both is
// that the pattern matters more than the hours. Species-specific because a
// dog owner does not need to read about cats.
//
// APPROVED — Ash Cullen (BVSc), 25 Aug 2026, except where noted below.
export const SLEEP_NOTES = {
  dog: [
    'Most dogs sleep between 8-14 hours out of a 24-hour day, and a good deal of that is daytime napping. A change in sleep pattern is what matters.',
    'A dog who has started pacing, panting or is unsettled at night is worth mentioning to your vet.',
  ],
  cat: [
    'Most cats sleep between 12-16 hours out of a 24-hour day. Cats are naturally most active around dawn and dusk, so one who is busy in the early hours is not necessarily unsettled.',
    'A change is what matters. A cat who has started pacing, vocalising at night, or sleeping somewhere unusual is worth mentioning to your vet.',
  ],
}

// The label on the button that reveals SLEEP_NOTES.
//
// It names the question the notes answer rather than the notes themselves —
// "Read more" tells an owner nothing about whether it is worth the tap.
// Species-keyed for the same reason the notes are: a dog owner asking this
// is not asking about cats.
//
// PENDING ASH — wording.
export const SLEEP_NOTES_LABEL = {
  dog: 'How much sleep is normal for a dog?',
  cat: 'How much sleep is normal for a cat?',
}

export const HYGIENE_SYMPTOM_OPTIONS = [
  'None',
  'Matting',
  'Odour',
  'Pressure sores',
  'Greasy coat',
  'Dry skin',
  'Soiling',
  'Open wounds',
  'No longer grooms self',
  'Other',
]

export const VOMITING_CHARACTER_OPTIONS = ['Bile', 'Foamy', 'Undigested food', 'Blood', 'Other']
// Cats only — inserted before 'Other' by VomitingPage so 'Other' stays last.
export const VOMITING_CHARACTER_OPTIONS_CAT_EXTRA = ['Hairball']

export const URINATION_SYMPTOM_OPTIONS = [
  'Straining',
  'Blood',
  'Small volume',
  'Incontinence',
  'Vocalisation',
  'Frequent',
  'Infrequent',
  'Not urinating at all',
  'Other',
]

export const VOMITING_HAS_VOMITED_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
  { value: 'unsure', label: 'Not sure' },
]

export const VOMITING_UNIT_OPTIONS = [
  { value: 'times/day', label: 'times/day' },
  { value: 'times/week', label: 'times/week' },
]

// Alternatives to an exact count — selecting one of these sets `frequency`
// directly to its value (same way "unsure" already worked), rather than a
// number. scoreVomiting() falls back to its default "vomited, under
// threshold" score for any non-numeric frequency, so no scoring changes are
// needed to support these.
export const VOMITING_FREQUENCY_QUALIFIER_OPTIONS = [
  { value: 'unsure', label: 'Not sure' },
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'just_today', label: 'Just today' },
]

export const URINATION_STATUS_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'unsure', label: 'Not sure' },
]

export const WATER_INTAKE_OPTIONS = [
  { value: 'reduced', label: 'Reduced' },
  { value: 'normal', label: 'Normal' },
  { value: 'increased', label: 'Increased' },
  { value: 'unsure', label: 'Not sure' },
]

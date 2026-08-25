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
    'Please contact your vet today, even if your pet seems otherwise well in themselves.',
}

// Sleep, in numbers. Owners consistently ask two things — how much is normal,
// and whether what they are seeing is just age — and the honest answer to
// both is that the pattern matters more than the hours. Species-specific
// because a dog owner does not need to read about cats.
//
// PENDING ASH — drafted by me, not reviewed. Two things to confirm:
// the hour ranges, and the last cat line. Cats are crepuscular rather than
// nocturnal (most active at dawn and dusk), which is what the wording says,
// but you asked for nocturnal — your call which goes in front of owners.
export const SLEEP_NOTES = {
  dog: [
    'Most adult dogs sleep somewhere between 8 and 14 hours across a full day and night, and a good deal of that is daytime napping.',
    'Older dogs often sleep more in total but less soundly — more naps by day, and more waking or unsettledness at night. A change in the pattern usually tells you more than the number of hours does.',
  ],
  cat: [
    'Most adult cats sleep between 12 and 16 hours a day. Kittens sleep more still, and older cats often drift back up towards that.',
    'Cats are naturally most active around dawn and dusk, so one who is busy in the early hours is not necessarily unsettled — that is normal feline wiring rather than a problem.',
    'A change is what matters. An older cat who has started pacing, calling out at night, or sleeping somewhere unusual is worth mentioning to your vet.',
  ],
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

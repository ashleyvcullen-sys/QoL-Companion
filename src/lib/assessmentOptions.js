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
  'Black stool',
  'Other',
]

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

// Feline Grimace Scale — Evangelista MC, Watanabe R, Leung VSY, Monteiro BP,
// O'Toole E, Pang DSJ, Steagall PV. "Facial expressions of pain in cats: the
// development and validation of a Feline Grimace Scale." Scientific Reports,
// 2019;9:19128. Université de Montréal.
export const FELINE_GRIMACE_ACTION_UNITS = [
  {
    key: 'earPosition',
    label: 'Ear position',
    options: [
      { value: 0, text: 'Ears facing forward' },
      { value: 1, text: 'Ears slightly pulled apart or rotated outward' },
      { value: 2, text: 'Ears flattened and rotated outward' },
    ],
  },
  {
    key: 'orbitalTightening',
    label: 'Orbital tightening',
    options: [
      { value: 0, text: 'Eyes open' },
      { value: 1, text: 'Eyes partially open / squinting' },
      { value: 2, text: 'Eyes squinted or tightly closed' },
    ],
  },
  {
    key: 'muzzleTension',
    label: 'Muzzle tension',
    options: [
      { value: 0, text: 'Muzzle relaxed (round shape)' },
      { value: 1, text: 'Muzzle mildly tense' },
      { value: 2, text: 'Muzzle tense (elliptical shape)' },
    ],
  },
  {
    key: 'whiskersChange',
    label: 'Whiskers change',
    options: [
      { value: 0, text: 'Whiskers loose and curved' },
      { value: 1, text: 'Whiskers slightly curved or straight' },
      { value: 2, text: 'Whiskers straight and moving forward' },
    ],
  },
  {
    key: 'headPosition',
    label: 'Head position',
    options: [
      { value: 0, text: 'Head held above the shoulder line' },
      { value: 1, text: 'Head aligned with the shoulder line' },
      { value: 2, text: 'Head held below the shoulder line, or tilted' },
    ],
  },
]

export const WEIGHT_RANGES = {
  dog: [
    { key: '0-20', label: 'Up to 10 kg' },
    { key: '21-50', label: '10–25 kg' },
    { key: '51-90', label: '25–40 kg' },
    { key: '90+', label: 'Over 40 kg' },
    { key: 'unknown', label: 'Not sure / unknown' },
  ],
  cat: [
    { key: 'under8', label: 'Under 4 kg' },
    { key: '8-12', label: '4–5 kg' },
    { key: '12-15', label: '5–7 kg' },
    { key: 'over15', label: 'Over 7 kg' },
    { key: 'unknown', label: 'Not sure / unknown' },
  ],
}

function yearLabel(n) {
  return `${n} year${n === 1 ? '' : 's'}`
}

export const AGE_OPTIONS = [
  '<1 year (puppy/kitten)',
  ...Array.from({ length: 20 }, (_, i) => yearLabel(i + 1)),
  '21+ years',
  'Not sure / unknown',
]

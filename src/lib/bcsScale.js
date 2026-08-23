// Body Condition Score — the standard 9-point veterinary scale.
//
// PENDING CLINICAL SIGN-OFF: this wording is a placeholder drafted from the
// Association for Pet Obesity Prevention's published dog and cat charts
// (which render the WSAVA/Purina 9-point system). It has NOT yet been
// checked against the official WSAVA chart. Ash is reviewing it against his
// own reference before this feature is considered launch-ready — do not
// treat this text as final clinical content until that review is done.
//
// Dogs and cats have separate charts with genuinely different criteria, so
// this is species-keyed like BEAP_SCALES.

export const BCS_CITATION =
  'Body Condition Score based on the WSAVA/Purina 9-point scale (World Small Animal Veterinary Association, in partnership with Purina).'

export const BCS_MIN = 1
export const BCS_MAX = 9

// 4 and 5 are both "ideal" on the 9-point scale — 4 is lean-ideal, 5 is
// mid-ideal. Anything outside 4-5 is a deviation in one direction or the
// other, which is why BCS can't reuse the app's higher-is-better colouring.
export const BCS_IDEAL_MIN = 4
export const BCS_IDEAL_MAX = 5

export const BCS_SCALES = {
  dog: [
    { score: 1, label: 'Emaciated', text: 'Ribs, lumbar spine and hip bones visible with no fat cover; waist clearly visible; severe abdominal tuck.' },
    { score: 2, label: 'Very thin', text: 'Ribs, lumbar spine and pelvic bones visible and easy to feel; little to no palpable fat cover.' },
    { score: 3, label: 'Thin', text: 'Ribs easy to feel with minimal fat cover; lumbar spine may be visible; pelvic bones becoming prominent; waist and abdominal tuck clearly visible.' },
    { score: 4, label: 'Lean (ideal)', text: 'Ribs easy to feel beneath a thin fat cover; waist visible from above; abdominal tuck clearly visible.' },
    { score: 5, label: 'Ideal', text: 'Ribs easy to feel without excess fat cover; waist visible behind the ribs from above; abdominal tuck visible from the side.' },
    { score: 6, label: 'Above ideal', text: 'Ribs palpable beneath slight excess fat cover; waist visible but less defined; abdominal tuck present but reduced.' },
    { score: 7, label: 'Overweight', text: 'Firm pressure needed to feel ribs through heavy fat cover; waist difficult to see; minimal abdominal tuck; fat deposits over the lower back and tail base.' },
    { score: 8, label: 'Obese', text: 'Ribs difficult or impossible to feel through heavy fat cover; waist and abdominal tuck absent; fat deposits over the lower back and tail base; abdomen may appear rounded.' },
    { score: 9, label: 'Grossly obese', text: 'Ribs cannot be felt through extensive fat cover; waist and abdominal tuck absent; heavy fat deposits over the chest, spine, lower back, tail base, neck and limbs; abdomen rounded and protruding.' },
  ],
  cat: [
    { score: 1, label: 'Emaciated', text: 'Ribs, spine and pelvic bones clearly visible; no palpable fat cover; very pronounced abdominal tuck.' },
    { score: 2, label: 'Very thin', text: 'Ribs and spine visible and easy to feel; almost no fat cover; pelvic bones prominent; pronounced abdominal tuck.' },
    { score: 3, label: 'Thin', text: 'Ribs easy to feel with minimal fat cover; lumbar vertebrae and pelvic bones visible; waist and abdominal tuck clearly visible.' },
    { score: 4, label: 'Lean (ideal)', text: 'Ribs palpable under slight fat cover; waist visible from above; abdominal tuck visible; minimal abdominal fat.' },
    { score: 5, label: 'Ideal', text: 'Ribs palpable with slight fat cover; waist visible behind the ribs; slight abdominal tuck; minimal abdominal fat pad.' },
    { score: 6, label: 'Above ideal', text: 'Ribs palpable under slight excess fat; waist less distinct; small abdominal fat pad; abdominal tuck absent.' },
    { score: 7, label: 'Overweight', text: 'Ribs not easily felt through moderate fat cover; waist difficult to see; moderate abdominal fat pad.' },
    { score: 8, label: 'Obese', text: 'Ribs not felt through excess fat cover; waist absent; prominent abdominal fat pad; fat deposits over the lower back.' },
    { score: 9, label: 'Grossly obese', text: 'Ribs not felt through heavy fat cover; abdomen distended with no waist; extensive fat deposits over the lower back, face and limbs.' },
  ],
}

// BCS is U-shaped: both 1 and 9 are bad, 4-5 is ideal. The rest of the app
// assumes higher = better (severityFromPercent etc.), so BCS deliberately
// does NOT reuse that — a 9 must never render green.
export function bcsSeverityColor(score) {
  if (score == null) return 'var(--border)'
  const distance = score < BCS_IDEAL_MIN ? BCS_IDEAL_MIN - score : score - BCS_IDEAL_MAX
  if (distance <= 0) return '#3D8259' // 4-5, ideal
  if (distance === 1) return '#C97A2E' // 3 or 6
  if (distance === 2) return '#C97A2E' // 2 or 7
  return '#A33A2E' // 1, 8, 9
}

export function bcsLevelsFor(species) {
  return BCS_SCALES[species] ?? BCS_SCALES.dog
}

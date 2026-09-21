// Faecal score, 1-5 in half steps, 2-3 optimal.
//
// Informed by the Royal Canin Faecal Scoring Guide (the WALTHAM faeces
// scoring system). The descriptions are our own words — the guide's wording
// and photographs are not reproduced — and the credit is in lib/references.js
// under 'royal-canin-faecal'.
//
// Replaced, on 21 Sep 2026 and on Ash's instruction, both the Overall
// Assessment's 0-10 stool slider and the six-rung Stool Consistency scale in
// Allergies, Gastrointestinal and Cancer monitoring. One scale across the
// app, so the assessment and the disease forms describe a stool the same way.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. The descriptions (both species), the 0-10 conversion and the flag bands.

export const FAECAL_SCORES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

// Separate wording per species. A dog's stool is judged on the ground or in
// a bag; a cat's in a litter tray, where litter sticks to it and a liquid
// stool soaks in rather than pooling — so the cat rungs describe what an
// owner actually sees at the tray (Ash, 21 Sep 2026).
export const FAECAL_LEVELS = {
  dog: [
    'Hard, dry and crumbly. Breaks apart when picked up.',
    'Dry and firm, with very little moisture inside.',
    'Firm and well formed, with a clear shape. May have small cracks on the surface.',
    'Well formed and slightly soft, with a damp surface. Picks up cleanly.',
    'Moist and starting to lose its shape. Leaves a little residue.',
    'Soft and moist. Still holds a shape, but leaves residue when picked up.',
    'Very moist, with little shape left. Hard to pick up.',
    'Mostly liquid, with only a little texture. (emergency)',
    'Entirely liquid, with no texture or shape. (emergency)',
  ],
  cat: [
    'Hard, dry and crumbly. Breaks apart when scooped.',
    'Dry and firm, with very little moisture inside. Litter barely sticks to it.',
    'Firm and well formed, with a clear shape. Scoops out cleanly with little litter stuck to it.',
    'Well formed and slightly soft. A little litter sticks to the surface.',
    'Moist and starting to lose its shape. Litter clings to it.',
    'Soft and moist. Still holds a shape, but coated in litter and hard to scoop in one piece.',
    "Very moist, with little shape left. Clumps into the litter and can't be scooped cleanly.",
    'Mostly liquid, with only a little texture. Soaks into the litter, or may be found outside the tray. (emergency)',
    'Entirely liquid. Soaks straight into the litter, often with accidents outside the tray. (emergency)',
  ],
}

export const FAECAL_BAND_LABELS = [
  'Score 1 · Hard', 'Score 1.5', 'Score 2 · Optimal', 'Score 2.5 · Optimal', 'Score 3 · Optimal',
  'Score 3.5', 'Score 4', 'Score 4.5', 'Score 5 · Liquid',
]

// For the everyday-function average, where 10 is best. The optimal band
// scores 10; each step away from it costs more on the loose side than the
// hard side.
export const FAECAL_TO_TEN = { 1: 6, 1.5: 8, 2: 10, 2.5: 10, 3: 10, 3.5: 7, 4: 5, 4.5: 2, 5: 0 }

// Green only for the guide's optimal band, 2-3 (Ash, 21 Sep 2026). Amber
// either side of it; red (disease forms only) once it is mostly or entirely
// liquid — the same two-worst-rungs rule the old stool scale used.
export const FAECAL_CONCERN_SCORES = [1, 1.5, 3.5, 4]
export const FAECAL_EMERGENCY_FROM = 4.5

const GREEN = '#3D8259'
const AMBER = '#C97A2E'
const RED = '#A33A2E'
const COLOURS = [AMBER, AMBER, GREEN, GREEN, GREEN, AMBER, AMBER, RED, RED]

export function faecalColourForIndex(index) {
  return COLOURS[index] ?? RED
}

export function faecalLevelsFor(species) {
  return FAECAL_LEVELS[species] ?? FAECAL_LEVELS.dog
}

export function faecalIndexOf(score) {
  return FAECAL_SCORES.indexOf(Number(score))
}

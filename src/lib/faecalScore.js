// Faecal score, per the Royal Canin Faecal Scoring Guide.
//
// Informed by that guide (the WALTHAM faeces scoring system). The
// descriptions are OUR OWN WORDS — the guide's wording and photographs are
// not reproduced — and the credit is in lib/references.js under
// 'royal-canin-faecal'.
//
// Replaced, on 21 Sep 2026 and on Ash's instruction, both the Overall
// Assessment's 0-10 stool slider and the six-rung Stool Consistency scale in
// Allergies, Gastrointestinal and Cancer monitoring. One scale across the
// app, so the assessment and the disease forms describe faeces the same way.
//
// RUNGS NOW FOLLOW THE GUIDE PER SPECIES — Ash's instruction 24 Sep 2026,
// from the cat and adult-dog charts. They are not the same scale:
//
//   Dogs  1, 2, 2.5, 3, 3.5, 4, 4.5, 5
//   Cats  1, 2, 2.5, 3, 4, 5
//
// A cat owner was being offered 3.5 and 4.5, which the cat chart does not
// have, and both species were offered 1.5, which neither chart has.
//
// The guide's own key is three-way: OPTIMAL (2.5), ACCEPTABLE (2 and 3), and
// TOO HARD / TOO SOFT (everything else). That is what `tone` carries here.
//
// PENDING ASH — the three judgement calls this raised, all of them clinical:
//   1. ACCEPTABLE is drawn amber but NOT flagged. The guide calls 2 and 3
//      acceptable, so flagging them would raise a concern the guide does not.
//   2. Those two therefore score 9/10 rather than the 10 they scored while
//      2-3 was one optimal band. Only 2.5 scores 10 now.
//   3. Cats lose the 3.5 and 4.5 rungs. Entries already saved on them still
//      read (see FAECAL_TO_TEN, which keeps every key) but cannot be chosen.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. The descriptions, both
// species. Each rung below keeps the words she approved for that score; the
// rungs the charts do not have were removed, not rewritten.

const GREEN = '#3D8259'
const AMBER = '#C97A2E'
const RED = '#A33A2E'

const TONE_COLOUR = { optimal: GREEN, acceptable: AMBER, outside: RED }

// One row per rung the guide draws for that species, in order.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. Her words: dogs "Soft"
// (3.5), "Loose" (4), "Mostly liquid" (4.5); cats "Loose" (4). Both charts
// keep "Acceptable" at 2 and 3, which is where the guide puts it.
//
// PENDING ASH — the remaining `band` words. Every rung carries one now, on Ash's
// instruction 24 Sep 2026: half of them had only a bare "Score 3.5" beside
// the description, so the ones that did carry a word read as the only rungs
// worth naming. Drawn from the guide's own three-way key — OPTIMAL,
// ACCEPTABLE, and TOO HARD / TOO SOFT — but naming what the rung IS rather
// than how far off it is: Hard, Soft, Loose, Liquid. "Soft" for 3.5 and
// "Loose" for 4 are Ash's words, 24 Sep 2026; "Liquid" is on the two rungs
// the app already calls an emergency, where "soft" would contradict the
// alert beside it.
const RUNGS = {
  dog: [
    { score: 1, tone: 'outside', band: 'Hard', text: 'Hard, dry and crumbly. Breaks apart when picked up.' },
    { score: 2, tone: 'acceptable', band: 'Acceptable', text: 'Firm and well formed, with a clear shape. May have small cracks on the surface.' },
    { score: 2.5, tone: 'optimal', band: 'Optimal', text: 'Well formed and slightly soft, with a damp surface. Picks up cleanly.' },
    { score: 3, tone: 'acceptable', band: 'Acceptable', text: 'Moist and starting to lose its shape. Leaves a little residue.' },
    { score: 3.5, tone: 'outside', band: 'Soft', text: 'Soft and moist. Still holds a shape, but leaves residue when picked up.' },
    { score: 4, tone: 'outside', band: 'Loose', text: 'Very moist, with little shape left. Hard to pick up.' },
    // PENDING ASH — the description. "Mostly liquid" is the band now, on
    // Ash's instruction 24 Sep 2026, so the sentence no longer opens by
    // saying it a second time.
    { score: 4.5, tone: 'outside', band: 'Mostly liquid', text: 'Only a little texture left. (emergency)' },
    { score: 5, tone: 'outside', band: 'Liquid', text: 'Entirely liquid, with no texture or shape. (emergency)' },
  ],
  // Separate wording as well as separate rungs. A dog's faeces are judged on
  // the ground or in a bag; a cat's in a litter tray, where litter sticks to
  // it and a liquid stool soaks in rather than pooling (Ash, 21 Sep 2026).
  cat: [
    { score: 1, tone: 'outside', band: 'Hard', text: 'Hard, dry and crumbly. Breaks apart when scooped.' },
    { score: 2, tone: 'acceptable', band: 'Acceptable', text: 'Firm and well formed, with a clear shape. Scoops out cleanly with little litter stuck to it.' },
    { score: 2.5, tone: 'optimal', band: 'Optimal', text: 'Well formed and slightly soft. A little litter sticks to the surface.' },
    // Back to "Acceptable" — Ash, 24 Sep 2026, reversing the "Soft" she
    // had asked for an hour earlier. 3 is an acceptable rung on the cat
    // chart, and the band word is what says so.
    { score: 3, tone: 'acceptable', band: 'Acceptable', text: 'Moist and starting to lose its shape. Litter clings to it.' },
    { score: 4, tone: 'outside', band: 'Loose', text: "Very moist, with little shape left. Clumps into the litter and can't be scooped cleanly." },
    { score: 5, tone: 'outside', band: 'Liquid', text: 'Entirely liquid. Soaks straight into the litter, often with accidents outside the tray. (emergency)' },
  ],
}

// Rungs the app has offered in the past and does not offer now: 1.5, which
// went when the charts did on 24 Sep 2026, and the cat's 3.5 and 4.5, which
// the cat chart does not draw. Never shown as a choice — they exist so a day
// already saved on one reads back in words, in its own species' wording,
// rather than as a bare number.
//
// Every description here is the one Ash approved on 21 Sep 2026 for that
// rung and that species.
const RETIRED = {
  dog: [
    { score: 1.5, tone: 'outside', band: 'Hard', text: 'Dry and firm, with very little moisture inside.' },
  ],
  cat: [
    { score: 1.5, tone: 'outside', band: 'Hard', text: 'Dry and firm, with very little moisture inside. Litter barely sticks to it.' },
    { score: 3.5, tone: 'outside', band: 'Soft', text: 'Soft and moist. Still holds a shape, but coated in litter and hard to scoop in one piece.' },
    { score: 4.5, tone: 'outside', band: 'Liquid', text: 'Mostly liquid, with only a little texture. Soaks into the litter, or may be found outside the tray. (emergency)' },
  ],
}

function rungsFor(species) {
  return RUNGS[species] ?? RUNGS.dog
}

// Every rung is named, not just the good ones.
function labelFor(rung) {
  return rung.band ? `Score ${rung.score} · ${rung.band}` : `Score ${rung.score}`
}

export function faecalScoresFor(species) {
  return rungsFor(species).map((rung) => rung.score)
}

export function faecalLevelsFor(species) {
  return rungsFor(species).map((rung) => rung.text)
}

export function faecalBandLabelsFor(species) {
  return rungsFor(species).map(labelFor)
}

export function faecalColourForIndexFor(species) {
  const rungs = rungsFor(species)
  return (index) => TONE_COLOUR[rungs[index]?.tone] ?? RED
}

export function faecalIndexOf(score, species) {
  return faecalScoresFor(species).indexOf(Number(score))
}

// The rung a saved score sits on — this species' chart first, then the other
// one, so a day saved before 24 Sep 2026 on a rung this species is no longer
// offered still reads back as words rather than a bare number.
export function faecalRungOf(score, species) {
  const wanted = Number(score)
  const at = (list) => list?.find((rung) => rung.score === wanted)
  // This species' chart, then the rungs it used to offer, then the other
  // species' — so a saved day always resolves, and resolves to the closest
  // wording there is for the animal it was recorded about.
  return at(rungsFor(species))
    ?? at(RETIRED[species] ?? RETIRED.dog)
    ?? at(RUNGS.dog) ?? at(RETIRED.dog)
    ?? at(RUNGS.cat) ?? at(RETIRED.cat)
    ?? null
}

// The description for a saved score, emergency marker and all.
export function faecalTextOf(score, species) {
  return faecalRungOf(score, species)?.text ?? null
}

// The label for a saved score, including one saved on a rung this species is
// no longer offered.
export function faecalLabelOf(score, species) {
  const rung = faecalRungOf(score, species)
  return rung ? labelFor(rung) : `Score ${score}`
}

// For the everyday-function average, where 10 is best. Optimal scores 10,
// acceptable 9, and each step outside costs more on the loose side than the
// hard side.
//
// Every key the app has ever offered is kept, including 1.5, so a day saved
// on a retired rung still scores exactly as it did.
export const FAECAL_TO_TEN = { 1: 6, 1.5: 8, 2: 9, 2.5: 10, 3: 9, 3.5: 7, 4: 5, 4.5: 2, 5: 0 }

// What a red rung tells the owner to do — Ash's instruction 24 Sep 2026:
// "advise user to seek vet attention if this is an ongoing issue".
//
// PENDING ASH — the wording. Two things it is deliberately careful about:
// one off day is not a reason to book an appointment, and the thing that
// makes it one is that it keeps happening.
//
// The emergency rungs (4.5 and 5 for a dog, 5 for a cat) say something
// stronger instead: those need a vet today, not if it carries on, and "if
// this keeps happening" beside watery diarrhoea would soften exactly the
// message that must not be softened.
export const FAECAL_OUTSIDE_ADVICE = "An off day happens. If {name}'s faeces stay like this, or this keeps coming back, book a check with your vet."

// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Her wording, moved here
// from the condition parameter so the assessment can say it too.
export const FAECAL_EMERGENCY_ADVICE = 'Watery diarrhoea can lead to dehydration quickly in pets. Contact your vet promptly for assessment.'

// What a red rung says to do, and how loudly. Null on the green and amber
// rungs, which need nothing said about them.
export function faecalAdviceFor(score, species) {
  const rung = faecalRungOf(score, species)
  if (!rung || rung.tone !== 'outside') return null
  return String(rung.text).includes('(emergency)')
    ? { severity: 'emergency', text: FAECAL_EMERGENCY_ADVICE }
    : { severity: 'concern', text: FAECAL_OUTSIDE_ADVICE }
}

// Flagged as a concern: the guide's TOO HARD / TOO SOFT rungs only.
// ACCEPTABLE is not a concern — that is what the word means.
export const FAECAL_CONCERN_SCORES = [1, 1.5, 3.5, 4]
export const FAECAL_EMERGENCY_FROM = 4.5

// --- Back-compatible names -------------------------------------------------
//
// Callers that cannot know the species — the shared condition parameter
// definition — take the dog set, and the species-aware `*For` functions above
// override it wherever the species IS known.
export const FAECAL_SCORES = faecalScoresFor('dog')
export const FAECAL_BAND_LABELS = faecalBandLabelsFor('dog')
export const FAECAL_LEVELS = { dog: faecalLevelsFor('dog'), cat: faecalLevelsFor('cat') }
export const faecalColourForIndex = faecalColourForIndexFor('dog')

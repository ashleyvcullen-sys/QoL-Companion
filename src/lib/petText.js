// Pet-aware text: pronouns, name substitution, and light emphasis.
//
// Clinical copy reads badly with "their" when the owner knows perfectly well
// whether their dog is a he or a she — and reads worse if the app guesses
// wrong. Sex is optional at onboarding, so the neutral forms stay as the
// fallback rather than as a compromise everyone gets.

const PRONOUNS = {
  male: { they: 'he', them: 'him', their: 'his', theirs: 'his', are: 'is', were: 'was', have: 'has', s: 's' },
  female: { they: 'she', them: 'her', their: 'her', theirs: 'hers', are: 'is', were: 'was', have: 'has', s: 's' },
  // 'they' takes plural agreement, hence `are`/`were`/`have` and the empty
  // verb-s — "they seem" against "he seems".
  unknown: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', are: 'are', were: 'were', have: 'have', s: '' },
}

export function petPronouns(pet) {
  return PRONOUNS[pet?.sex] ?? PRONOUNS.unknown
}

// Species words, for copy that has to name the species rather than imply it.
// "Sometimes called canine dementia" is the sentence a dog owner should read;
// "canine or feline dementia" makes them do the work of picking their half.
//
// The fallback keeps both, because a sentence naming the wrong species is
// worse than one naming neither.
const SPECIES_WORDS = {
  dog: { species: 'dog', canineOrFeline: 'canine' },
  cat: { species: 'cat', canineOrFeline: 'feline' },
}

export function petSpeciesWords(pet) {
  return SPECIES_WORDS[pet?.species] ?? { species: 'pet', canineOrFeline: 'canine or feline' }
}

// Fills {name}, {they}, {their}, {them}, {are}, {have}, {s}, {species},
// {canineOrFeline} and their capitalised forms ({They}, {Their}). Leaves anything it doesn't recognise
// alone rather than blanking it, so a typo in a template shows up as itself
// instead of vanishing.
//
// NOTE ON {s}: it is the verb-s for a PRONOUN subject — "{they} seem{s}"
// gives "he seems" / "they seem". It must NOT be used after {name}, because
// a pet's name is singular whatever their sex, so "{name} seem{s}" produces
// "Sam seem" for an unknown-sex pet. After a name, just write the verb.
export function fillPetText(template, pet) {
  if (!template) return ''
  const tokens = {
    name: pet?.name ?? 'your pet',
    ...petPronouns(pet),
    ...petSpeciesWords(pet),
  }

  return template.replace(/\{(\w+)\}/g, (whole, key) => {
    const lower = key.charAt(0).toLowerCase() + key.slice(1)
    const value = tokens[lower]
    if (value === undefined) return whole
    const isCapitalised = key.charAt(0) === key.charAt(0).toUpperCase() && key.charAt(0) !== key.charAt(0).toLowerCase()
    return isCapitalised ? value.charAt(0).toUpperCase() + value.slice(1) : value
  })
}

// Splits **bold** runs into React-ready parts. Returns plain objects rather
// than JSX so this file stays .js — the caller maps them to elements.
export function emphasisParts(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== '')
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { bold: true, text: part.slice(2, -2) }
        : { bold: false, text: part },
    )
}

// Convenience: fill the tokens, then split the emphasis.
export function petTextParts(template, pet) {
  return emphasisParts(fillPetText(template, pet))
}

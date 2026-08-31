import { AVAILABLE_CONDITIONS, conditionByKey } from './conditions'

// Paywall copy, from qol-paywall-spec.md.
//
// Kept in one file because several of these strings are load-bearing in a
// way ordinary UI text is not: the disclosure block is what Apple checks
// under Guideline 3.1.2, and the headline table is the highest-leverage
// element on the screen. Scattering them through JSX would make it easy to
// "tidy" one during a layout change without realising what it was for.

// Every entry point that can open the paywall passes one of these keys as
// router state. Keys, not sentences: the sentence belongs to the paywall,
// so a copy change happens here rather than in six screens that would
// otherwise drift out of step with each other.
export const PAYWALL_FEATURES = {
  MEDICATIONS: 'medications',
  MEDIA: 'media',
  CONDITIONS: 'conditions',
  BCS: 'bcs',
  EXPORT: 'export',
  PETS: 'pets',
}

// Spec section 1. The headline answers the thing the user reached for.
const HEADLINES = {
  [PAYWALL_FEATURES.MEDICATIONS]: 'Track every medication in one place with Premium',
  [PAYWALL_FEATURES.MEDIA]: "Keep a visual record of your pet's condition with Premium",
  [PAYWALL_FEATURES.CONDITIONS]: "Get monitoring built for your pet's condition with Premium",
  [PAYWALL_FEATURES.BCS]: 'Track body condition and weight over time with Premium',
  [PAYWALL_FEATURES.EXPORT]: 'Give your vet team the full picture with Premium',
  [PAYWALL_FEATURES.PETS]: 'Track every pet in your household with Premium',
}

const GENERIC_HEADLINE = 'Unlock everything QoL Companion can do with Premium'

export function paywallHeadline(featureKey) {
  return HEADLINES[featureKey] ?? GENERIC_HEADLINE
}

// Spec section 2. Constant, whatever the entry point — the headline above it
// changes with the entry point, this does not.
//
// Two sentences doing two jobs. The first is the credential — the reason to
// trust the thing being sold, and the only place the paywall says a vet
// built it. The second is a lead-in that ends in a colon, so this string has
// to stay directly above PAYWALL_FEATURE_LIST: separate the two and it is
// left pointing at nothing.
//
// Note what the first sentence does NOT say. "Designed by a veterinarian" is
// a fact about the app's authorship; anything about spotting or knowing what
// is wrong with a pet would be a clinical claim, which the app's disclaimer
// language exists to avoid.
export const PAYWALL_SUBHEAD =
  'Designed by a veterinarian. Premium unlocks all of the following features:'

// The condition line, carried as a subline under the disease-monitoring
// feature and shown on every entry point. Names real conditions because
// "disease-specific monitoring tools" tells an owner nothing about whether
// their pet's disease is one of them — arthritis and kidney disease are the
// two most people arrive with, so they lead.
//
// Built from the registry rather than written out, so it cannot quietly go
// stale. Only the KEYS are listed here: the names themselves come from
// conditions.js, a comingSoon flag removes a condition from the sentence
// automatically (AVAILABLE_CONDITIONS is already filtered on it), and a
// newly added condition is covered by the "and more" tail without anyone
// editing this file.
const FEATURED_CONDITION_KEYS = ['arthritis', 'kidney', 'cardiac', 'cancer', 'cognitive']

// How many conditions the sentence names before giving up and saying "more".
// Five is a list; eight is an inventory, and an owner scanning for their own
// pet's diagnosis stops reading either way.
const NAMED_CONDITION_COUNT = 5

function conditionProseName(condition) {
  return condition.shortLabel ?? condition.label.toLowerCase()
}

// "Includes arthritis, kidney disease, heart disease, cancer, cognitive
// decline and more."
//
// The tail is deliberately unconditional in the normal case but not a lie in
// the edge case: if every available condition is named, there IS no "and
// more" and the sentence says so.
export function conditionListLine() {
  const featured = FEATURED_CONDITION_KEYS
    .map(conditionByKey)
    // A key that no longer resolves, or one whose condition has been pulled
    // behind comingSoon, drops out rather than naming something the user
    // cannot then find.
    .filter((c) => c && AVAILABLE_CONDITIONS.includes(c))

  // Top up from whatever else is available, so pulling a featured condition
  // shortens the sentence by a name rather than leaving it at four.
  const rest = AVAILABLE_CONDITIONS.filter((c) => !featured.includes(c))
  const named = [...featured, ...rest].slice(0, NAMED_CONDITION_COUNT)

  if (named.length === 0) return null

  const names = named.map(conditionProseName)
  const remaining = AVAILABLE_CONDITIONS.length - named.length
  const tail = remaining > 0 ? ' and more' : ''

  // Oxford-comma-free serial list, matching the app's other prose. With a
  // tail the last name runs straight into "and more", which is why the join
  // is not simply names.join(', ').
  const list = tail
    ? names.join(', ')
    : names.slice(0, -1).join(', ') + (names.length > 1 ? ' and ' : '') + names[names.length - 1]

  return `Includes ${list}${tail}.`
}

// Spec section 3. Six lines, and it stays six.
//
// Objects rather than bare strings so a line can carry a subline. The
// alternative was for the screen to attach the condition list to whichever
// bullet happens to be first, which silently attaches it to the wrong
// feature the moment anyone reorders the list.
//
// `detail` is resolved once, here, rather than on every render: the registry
// is static from module load, so nothing about the answer can change while
// the app is running.
export const PAYWALL_FEATURE_LIST = [
  { text: 'Disease-specific monitoring tools', detail: conditionListLine() },
  { text: 'Add medications and set reminders for dosing' },
  { text: 'Upload photos and videos to track changes and share with your vet' },
  { text: 'Body condition and weight tracking' },
  { text: 'Downloadable summary reports to share with your vet team' },
  { text: 'Add up to 5 pets' },
]

// What the free plan already gives you.
//
// The counterpart to PAYWALL_FEATURE_LIST, and it exists so the comparison on
// Settings can be built from one definition per column rather than from a
// screen's idea of what the other screen says. The paywall does not show this
// list — it is selling the other one — but the two belong together, because
// the moment a feature moves between tiers BOTH lists have to change and
// having them in one file is what makes that obvious.
//
// Plain strings rather than the paywall list's objects: nothing here carries
// a subline, and inventing a shape for symmetry alone would be worse than the
// asymmetry.
export const FREE_FEATURE_LIST = [
  'Unlimited quality-of-life assessments for one pet',
  'Full BEAAAAPP pain scoring',
  'Overall wellbeing score',
  'Trends and calendar',
  'Home-care and emergency guidance',
  'End-of-life support content',
]

// Shown immediately before any control that leads to cancelling.
//
// One definition because it now appears on both the paywall and Settings, and
// a reassurance about someone's records that says two different things in two
// places is worse than not saying it at all.
//
// Placed BEFORE the control everywhere it is used, not after: once the user
// has left for Apple's settings screen they are not coming back to read a
// caveat, and "will my records be deleted?" is the question that stops people
// cancelling something they have already decided to cancel.
export const CANCELLATION_KEEPS_RECORDS =
  "If you cancel, your other pets' records will be hidden but not deleted. " +
  "They'll return if you resubscribe."

// Spec section 6. VERBATIM — this is the Apple-required disclosure and the
// spec says explicitly not to reword it for layout. If it does not fit, the
// layout changes, not this string. Missing or abbreviated disclosure is a
// standard 3.1.2 rejection.
export const APPLE_DISCLOSURE =
  'Your subscription renews automatically unless cancelled at least 24 hours ' +
  'before the end of the current period. Payment is charged to your Apple ID ' +
  'at confirmation of purchase. Manage or cancel anytime in your Apple ID settings.'

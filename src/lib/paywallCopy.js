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
// "Monitor quality of life" and not "know when something's wrong": the
// second edges toward a clinical claim, which the app's own disclaimer
// language exists to avoid.
export const PAYWALL_SUBHEAD =
  'Designed by a veterinarian to help you monitor quality of life from home.'

// Spec section 3. Six lines, and it stays six.
export const PAYWALL_FEATURE_LIST = [
  'Add medications and set reminders for dosing',
  'Upload photos and videos to track changes and share with your vet',
  'Disease-specific monitoring tools',
  'Body condition and weight tracking',
  'Downloadable summary reports to share with your vet team',
  'Add up to 5 pets',
]

// Spec section 6. VERBATIM — this is the Apple-required disclosure and the
// spec says explicitly not to reword it for layout. If it does not fit, the
// layout changes, not this string. Missing or abbreviated disclosure is a
// standard 3.1.2 rejection.
export const APPLE_DISCLOSURE =
  'Your subscription renews automatically unless cancelled at least 24 hours ' +
  'before the end of the current period. Payment is charged to your Apple ID ' +
  'at confirmation of purchase. Manage or cancel anytime in your Apple ID settings.'

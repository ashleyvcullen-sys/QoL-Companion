// Central gate for tier-gated feature access. This app has no billing yet —
// every pet is on the 'free' tier (see the `subscription_tier` column on
// `pets`, added ahead of any real monetization work). Every place in the app
// that needs to know whether a feature is unlocked should call through here
// rather than hard-coding its own check, so real entitlement logic (reading
// `pet.subscription_tier`, a subscription service, etc.) can be dropped in
// later without touching call sites.
//
// Each function currently ignores its `pet` argument and returns a fixed
// value matching today's behavior — every feature below is locked for
// everyone. The argument is kept in the signature now so callers already
// pass the right context once these start reading real tier data.

export function hasMultiPetAccess(pet) { // eslint-disable-line no-unused-vars
  return false
}

export function hasDiseaseMonitoringAccess(pet) { // eslint-disable-line no-unused-vars
  return false
}

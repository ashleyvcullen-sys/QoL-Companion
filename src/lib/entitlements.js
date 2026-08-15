// Central gate for tier-gated feature access. Reads live entitlement state
// from RevenueCat (see RevenueCatContext.jsx) rather than a hard-coded
// value — every place in the app that needs to know whether a feature is
// unlocked should call through here rather than checking conditions
// directly, so a single source of truth stays in one place.
//
// These identifiers must exactly match entitlement identifiers configured
// in the RevenueCat dashboard (Project > Entitlements). Until an entitlement
// with a given identifier actually exists there (and has a product attached
// that's been purchased), `customerInfo.entitlements.active` will simply
// never contain it — every function below safely returns `false` by
// default, matching current (pre-monetization) behavior with nothing to
// configure on our end.
const ENTITLEMENT_MULTI_PET = 'multi_pet'
const ENTITLEMENT_DISEASE_MONITORING = 'disease_monitoring'

function hasEntitlement(customerInfo, entitlementId) {
  return Boolean(customerInfo?.entitlements?.active?.[entitlementId])
}

// `customerInfo` is the object from useRevenueCat() — pass it in from the
// caller rather than reaching into the context here, so these stay plain,
// easily testable functions instead of hooks.
export function hasMultiPetAccess(customerInfo) {
  return hasEntitlement(customerInfo, ENTITLEMENT_MULTI_PET)
}

export function hasDiseaseMonitoringAccess(customerInfo) {
  return hasEntitlement(customerInfo, ENTITLEMENT_DISEASE_MONITORING)
}

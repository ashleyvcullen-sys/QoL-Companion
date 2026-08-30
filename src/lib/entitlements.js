// Central gate for tier-gated feature access. Reads live entitlement state
// from RevenueCat (see RevenueCatContext.jsx) rather than a hard-coded
// value — every place in the app that needs to know whether a feature is
// unlocked should call through here rather than checking conditions
// directly, so a single source of truth stays in one place.
//
// These identifiers must exactly match entitlement identifiers configured
// in the RevenueCat dashboard (Project > Entitlements). Until an entitlement
// with a given identifier actually exists there (and has a product attached
// that's been purchased), `customerInfo.entitlements.active` will never
// contain it — every function below safely returns `false` by default.
//
// IMPORTANT: that safe default means shipping a gate BEFORE the entitlement
// exists in RevenueCat locks everyone out, including you. Configure the
// dashboard first, gate second.
//
// Named by TIER, not by feature. An earlier version had a
// `disease_monitoring` entitlement, which meant an unrelated Pro feature
// would have had to ask "is disease monitoring unlocked?" to answer "is
// this user on Pro?". Entitlement identifiers are painful to change once
// real purchases exist, so this is worth getting right before launch.
const ENTITLEMENT_PLUS = 'plus'
const ENTITLEMENT_PRO = 'pro'

function hasEntitlement(customerInfo, entitlementId) {
  return Boolean(customerInfo?.entitlements?.active?.[entitlementId])
}

// `customerInfo` is the object from useRevenueCat() — pass it in from the
// caller rather than reaching into the context here, so these stay plain,
// easily testable functions instead of hooks.

// Pro is a superset of Plus. The intended RevenueCat setup attaches the Pro
// product to BOTH the 'plus' and 'pro' entitlements, so this OR should be
// redundant — it's here so that a dashboard misconfiguration degrades into
// "Pro subscriber still gets Plus features" rather than "paying customer
// locked out of what they paid for".
export function hasPlusAccess(customerInfo) {
  return hasEntitlement(customerInfo, ENTITLEMENT_PLUS) || hasEntitlement(customerInfo, ENTITLEMENT_PRO)
}

export function hasProAccess(customerInfo) {
  return hasEntitlement(customerInfo, ENTITLEMENT_PRO)
}

// --- Per-feature checks -----------------------------------------------
//
// Each feature names its own function even where several share a tier, so
// call sites read as what they mean and a feature can move between tiers by
// editing one line here rather than hunting through screens. Medications
// moved Plus -> Pro on 23 Aug 2026; that was this one line.
//
//   Plus: multi-pet, body condition / weight, photos and video,
//         choosing which measures to trend
//   Pro:  everything in Plus, plus medications and disease monitoring

export function hasMultiPetAccess(customerInfo) {
  return hasPlusAccess(customerInfo)
}

// --- Pet limit ---------------------------------------------------------
//
// How many pet profiles an account may see at once. Everything above the
// limit is HIDDEN, never deleted — see PetsContext.visiblePets and
// supabase/migrations/20260830000000_subscription_pet_gating.sql.
//
// This mirrors public.pet_limit_for() in that migration, and the two must
// agree exactly. They are read at different moments — the client from a
// cached row, the database from the row itself — so a difference in the rule
// shows up as the app listing a pet that every query then refuses to return.
// If you change the rule here, change it there in the same commit.

export const FREE_PET_LIMIT = 1

// What each tier grants on purchase. Mirrors TIER_PET_LIMITS in
// supabase/functions/revenuecat-webhook/index.ts, which is what actually
// writes the number — this copy exists for copy and for the paywall, never
// as the source of the limit in force. That is always the user's own
// pet_limit column, which may have been raised by hand above the tier value.
//
// Plus and Pro share a limit on purpose: Pro is disease monitoring and
// medications, not more pets.
export const TIER_PET_LIMITS = {
  free: 1,
  plus: 5,
  pro: 5,
}

export function petLimitFromRow(row) {
  if (!row) return FREE_PET_LIMIT
  // An entitlement with no expiry, or one that has passed, is not an
  // entitlement. Same clause as the SQL, deliberately written the same way
  // round so the two read as obviously identical.
  if (!row.expires_at || new Date(row.expires_at) < new Date()) return FREE_PET_LIMIT
  return Math.max(row.pet_limit ?? FREE_PET_LIMIT, FREE_PET_LIMIT)
}

export function hasBcsAccess(customerInfo) {
  return hasPlusAccess(customerInfo)
}

export function hasMediaAccess(customerInfo) {
  return hasPlusAccess(customerInfo)
}

export function hasMeasureTrendsAccess(customerInfo) {
  return hasPlusAccess(customerInfo)
}

export function hasMedicationsAccess(customerInfo) {
  return hasProAccess(customerInfo)
}

export function hasDiseaseMonitoringAccess(customerInfo) {
  return hasProAccess(customerInfo)
}

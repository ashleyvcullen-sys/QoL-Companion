// Central gate for paid feature access. Reads live entitlement state from
// RevenueCat (see RevenueCatContext.jsx) rather than a hard-coded value —
// every place in the app that needs to know whether a feature is unlocked
// should call through here rather than checking conditions directly, so a
// single source of truth stays in one place.
//
// ONE PAID TIER. The app used to have two, Plus and Pro, with features split
// between them; that structure is gone and there is now premium or not.
// Everything below is therefore the same boolean, and there is deliberately
// no tier comparison, ordering or precedence anywhere in this file — if a
// second tier ever returns it should come back as an explicit design rather
// than by someone reintroducing `>=` between plan names.
//
// This identifier must exactly match the entitlement identifier configured
// in the RevenueCat dashboard (Project > Entitlements). Until an entitlement
// with this identifier actually exists there (and has a product attached
// that's been purchased), `customerInfo.entitlements.active` will never
// contain it — so this safely returns `false` by default.
//
// IMPORTANT: that safe default means shipping a gate BEFORE the entitlement
// exists in RevenueCat locks everyone out, including you. Configure the
// dashboard first, gate second.
const ENTITLEMENT_PREMIUM = 'premium'

// `customerInfo` is the object from useRevenueCat() — pass it in from the
// caller rather than reaching into the context here, so this stays a plain,
// easily testable function instead of a hook.
export function hasPremiumAccess(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_PREMIUM])
}

// --- Pet limit ---------------------------------------------------------
//
// How many pet profiles an account may see at once. Everything above the
// limit is HIDDEN, never deleted — see PetsContext.visiblePets and
// supabase/migrations/20260830000000_subscription_pet_gating.sql.
//
// petLimitFromRow mirrors public.pet_limit_for() in that migration, and the
// two must agree exactly. They are read at different moments — the client
// from a cached row, the database from the row itself — so a difference in
// the rule shows up as the app listing a pet that every query then refuses
// to return. If you change the rule here, change it there in the same
// commit.

export const FREE_PET_LIMIT = 1
export const PREMIUM_PET_LIMIT = 5

// What the tier grants on purchase. Mirrors TIER_PET_LIMITS in
// supabase/functions/revenuecat-webhook/index.ts, which is what actually
// writes the number — this copy exists for paywall and prompt copy, never as
// the source of the limit in force. That is always the user's own pet_limit
// column, which support may have raised above the tier value.
export const TIER_PET_LIMITS = {
  free: FREE_PET_LIMIT,
  premium: PREMIUM_PET_LIMIT,
}

export function petLimitFromRow(row) {
  if (!row) return FREE_PET_LIMIT
  // An entitlement with no expiry, or one that has passed, is not an
  // entitlement. Same clause as the SQL, deliberately written the same way
  // round so the two read as obviously identical.
  //
  // Note this means a manually granted row must carry an explicit expiry —
  // 'infinity' rather than null. The migration header spells this out.
  if (!row.expires_at || new Date(row.expires_at) < new Date()) return FREE_PET_LIMIT
  return Math.max(row.pet_limit ?? FREE_PET_LIMIT, FREE_PET_LIMIT)
}

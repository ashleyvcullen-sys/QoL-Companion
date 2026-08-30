// Central gate for paid feature access. Every place in the app that needs to
// know whether a feature is unlocked calls through here rather than checking
// conditions directly, so the rule lives in one file and can be compared
// against the SQL that enforces it.
//
// ONE PAID TIER. The app used to have two, Plus and Pro, with features split
// between them; that structure is gone and there is now premium or not.
// There is deliberately no tier comparison, ordering or precedence anywhere
// in this file — if a second tier ever returns it should come back as an
// explicit design rather than by someone reintroducing `>=` between plan
// names.
//
// ONE SOURCE OF TRUTH, and it is not RevenueCat.
//
// hasPremiumAccess takes the public.user_entitlements row — the same row
// public.has_premium() reads inside every RLS policy — rather than
// RevenueCat's customerInfo. That is the whole point. Asking RevenueCat on
// the client and asking user_entitlements on the server would be two answers
// that disagree exactly when it matters:
//
//   - customerInfo is permanently null in a browser, because the purchases
//     plugin has no working web implementation. Every web user would read as
//     free while the database happily served them premium rows.
//   - customerInfo is null for a moment on every native cold start, so a
//     subscriber would see the locked UI for a frame on each launch.
//   - a limit or grant raised by hand in user_entitlements — a rescue, a
//     support case — exists nowhere in RevenueCat at all.
//
// RevenueCatContext is still what buys and restores. It is not what decides.
const ENTITLEMENT_PREMIUM = 'premium'

// Postgres timestamptz has two literals JavaScript's Date cannot parse:
// 'infinity' and '-infinity'. PostgREST passes them through as exactly those
// strings, and `new Date('infinity')` is an Invalid Date whose every
// comparison is false — so `expires_at >= now` and `expires_at < now` are
// BOTH false for the same row.
//
// That asymmetry is what made this so quiet. petLimitFromRow guards with `<`
// and so fell through to the correct branch; hasPremiumAccess asserted with
// `>=` and so returned false. A manual grant got the right pet limit and no
// premium access, which reads as "the grant half worked" rather than as a
// date-parsing bug.
//
// And it was the documented value. The migration header and the comment on
// petLimitFromRow both tell you a manual grant must carry an explicit
// 'infinity' — the one value that could not be parsed.
//
// Returns milliseconds, Infinity, or null for "no usable expiry". Null is
// deliberately what an UNPARSEABLE value returns too: a date this cannot read
// must fail closed, because the alternative is granting premium on a typo.
function expiryMillis(value) {
  if (!value) return null
  if (value === 'infinity') return Infinity
  if (value === '-infinity') return -Infinity
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

// Mirrors public.has_premium() in
// supabase/migrations/20260830010000_premium_feature_gating.sql, clause for
// clause. Note the part that surprises people and is shared with
// petLimitFromRow below: a row with no expires_at is NOT premium. A manual
// grant must carry an explicit 'infinity'.
export function hasPremiumAccess(entitlementRow) {
  if (!entitlementRow) return false
  if (entitlementRow.tier !== ENTITLEMENT_PREMIUM) return false
  const expiry = expiryMillis(entitlementRow.expires_at)
  if (expiry === null) return false
  return expiry >= Date.now()
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
  //
  // Through expiryMillis for the same reason hasPremiumAccess is: 'infinity'
  // is unparseable as a Date. This one happened to behave correctly anyway —
  // `NaN < now` is false, so it fell through to the grant — but it was
  // reaching the right answer by accident, and an unreadable date was
  // silently granting the full limit rather than falling back to free.
  const expiry = expiryMillis(row.expires_at)
  if (expiry === null || expiry < Date.now()) return FREE_PET_LIMIT
  return Math.max(row.pet_limit ?? FREE_PET_LIMIT, FREE_PET_LIMIT)
}

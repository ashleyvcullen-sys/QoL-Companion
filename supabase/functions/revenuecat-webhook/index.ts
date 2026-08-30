// Receives RevenueCat subscription events and writes public.user_entitlements,
// which is the only thing the pets RLS policies trust. The client is told
// about entitlements too, but only so it can explain itself — the database
// decides.
//
// !! DEPLOYMENT: THIS FUNCTION MUST HAVE JWT VERIFICATION TURNED OFF !!
// Supabase checks for a Supabase JWT on Edge Functions by default and
// rejects the request before any of this code runs. RevenueCat sends its own
// shared secret in the Authorization header instead, so with verify_jwt left
// on every delivery fails with 401 and the symptom is "subscriptions simply
// never apply" with nothing in this function's logs to explain it. Deploy
// with `--no-verify-jwt`, or turn Verify JWT off in
// Dashboard > Edge Functions > revenuecat-webhook > Details.
//
// Secrets to set (Dashboard > Edge Functions > Secrets):
//   REVENUECAT_WEBHOOK_SECRET  the same value entered in the RevenueCat
//                              dashboard under the webhook's Authorization
//                              header field.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? ''

// PENDING ASH — the pet limits per tier. Free is fixed at 1 by the product
// decision; these two are placeholders that must match what the App Store
// listing and the paywall actually promise before anything goes on sale.
// They are here rather than in the database so a change is a code review
// rather than a hand-typed UPDATE against live subscriber rows.
const TIER_PET_LIMITS: Record<string, number> = {
  free: 1,
  plus: 3,
  pro: 25,
}

const FREE = { tier: 'free', pet_limit: 1 }

// Which entitlement wins when a customer somehow holds both. Pro is a
// superset of Plus (see src/lib/entitlements.js), so it must be checked
// first or a Pro subscriber would be written down to the Plus limit.
const TIER_PRECEDENCE = ['pro', 'plus']

function tierFromEntitlements(entitlementIds: string[] | null | undefined) {
  const held = new Set(entitlementIds ?? [])
  for (const tier of TIER_PRECEDENCE) {
    if (held.has(tier)) return tier
  }
  return null
}

// Constant-time comparison. A plain `===` on a secret leaks its length and,
// in principle, its content through timing; this costs nothing, so there is
// no reason to take the risk.
function secretMatches(provided: string, expected: string) {
  if (!expected) return false
  const a = new TextEncoder().encode(provided)
  const b = new TextEncoder().encode(expected)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  if (!secretMatches(req.headers.get('Authorization') ?? '', WEBHOOK_SECRET)) {
    // Deliberately vague to the caller, explicit in the log.
    console.error('revenuecat-webhook: Authorization did not match')
    return json({ error: 'unauthorized' }, 401)
  }

  let event: Record<string, any>
  try {
    const body = await req.json()
    event = body?.event ?? {}
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const eventId: string | null = event.id ?? null
  const eventType: string = event.type ?? ''
  const appUserId: string | null = event.app_user_id ?? null

  // RevenueCat's app_user_id is the Supabase auth user id, because
  // RevenueCatContext.jsx calls Purchases.logIn({ appUserID: user.id }).
  // Anything else is either an anonymous id from before that call or a
  // different project pointed at this URL — either way there is no user to
  // write, and 200 stops RevenueCat retrying something that will never work.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!appUserId || !UUID_RE.test(appUserId)) {
    console.warn(`revenuecat-webhook: ignoring ${eventType} for non-uuid app_user_id`)
    return json({ ok: true, ignored: 'app_user_id is not a supabase user id' }, 200)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const eventAt = event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : new Date()
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null

  // Decide what this event means. The distinction that matters most is
  // CANCELLATION, which is NOT a revocation: it means auto-renew was turned
  // off, and the subscriber keeps everything they paid for until the period
  // ends. Revoking there would cut off access someone is still owed, and
  // contradicts Terms 5.4. EXPIRATION is the event that actually ends it.
  let next: { tier: string; pet_limit: number; expires_at: string | null } | null = null

  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE': {
      const tier = tierFromEntitlements(event.entitlement_ids)
      if (!tier) {
        // A purchase carrying no entitlement we recognise. Granting a guessed
        // tier would be worse than granting nothing.
        console.warn(`revenuecat-webhook: ${eventType} with unrecognised entitlements`, event.entitlement_ids)
        return json({ ok: true, ignored: 'no recognised entitlement' }, 200)
      }
      next = { tier, pet_limit: TIER_PET_LIMITS[tier] ?? 1, expires_at: expiresAt }
      break
    }

    case 'CANCELLATION':
      // Auto-renew off. Access runs to expires_at, so there is nothing to
      // change — recorded only so the log shows it arrived.
      console.log(`revenuecat-webhook: CANCELLATION for ${appUserId} — access retained until expiry`)
      return json({ ok: true, action: 'none' }, 200)

    case 'BILLING_ISSUE':
      // Retry period. Apple may still recover the payment; cutting access
      // now would punish a subscriber for an expired card.
      console.warn(`revenuecat-webhook: BILLING_ISSUE for ${appUserId} — access retained`)
      return json({ ok: true, action: 'none' }, 200)

    case 'EXPIRATION':
      next = { ...FREE, expires_at: null }
      break

    case 'SUBSCRIPTION_PAUSED':
      // Google Play pause. Access runs to the end of the paid period exactly
      // as with a cancellation, and EXPIRATION follows when it lapses.
      next = { tier: 'free', pet_limit: 1, expires_at: expiresAt }
      break

    case 'TRANSFER': {
      // The subscription moved to a different RevenueCat identity, which
      // here means a different Supabase user. Both sides have to be written:
      // grant the receiver, and drop the donor to free, or the entitlement
      // silently exists twice.
      const from: string[] = event.transferred_from ?? []
      const to: string[] = event.transferred_to ?? []
      const tier = tierFromEntitlements(event.entitlement_ids) ?? 'plus'

      for (const donor of from.filter((id) => UUID_RE.test(id))) {
        await admin.from('user_entitlements').upsert({
          user_id: donor,
          ...FREE,
          expires_at: null,
          updated_at: new Date().toISOString(),
          last_event_id: eventId,
          last_event_at: eventAt.toISOString(),
        })
      }
      for (const receiver of to.filter((id) => UUID_RE.test(id))) {
        await admin.from('user_entitlements').upsert({
          user_id: receiver,
          tier,
          pet_limit: TIER_PET_LIMITS[tier] ?? 1,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
          last_event_id: eventId,
          last_event_at: eventAt.toISOString(),
        })
      }
      console.log(`revenuecat-webhook: TRANSFER ${from.join(',')} -> ${to.join(',')}`)
      return json({ ok: true, action: 'transfer' }, 200)
    }

    default:
      // TEST, SUBSCRIBER_ALIAS, NON_RENEWING_PURCHASE and anything RevenueCat
      // adds later. 200 so it is not retried forever.
      console.log(`revenuecat-webhook: ignoring event type ${eventType}`)
      return json({ ok: true, ignored: eventType }, 200)
  }

  // Idempotency and out-of-order protection, in one read.
  //
  // RevenueCat retries on any non-2xx, so the same event id can arrive
  // several times; and because a retry can overtake a later event, an old
  // EXPIRATION can arrive after the RENEWAL that replaced it. Applying that
  // blindly downgrades a paying subscriber, which is the worst failure this
  // function has available to it.
  const { data: existing, error: readError } = await admin
    .from('user_entitlements')
    .select('last_event_id, last_event_at')
    .eq('user_id', appUserId)
    .maybeSingle()

  if (readError) {
    console.error('revenuecat-webhook: could not read existing entitlement', readError)
    // 500 so RevenueCat retries — this is a transient failure, not a bad event.
    return json({ error: 'read failed' }, 500)
  }

  if (existing?.last_event_id && existing.last_event_id === eventId) {
    return json({ ok: true, action: 'duplicate' }, 200)
  }

  if (existing?.last_event_at && new Date(existing.last_event_at) > eventAt) {
    console.warn(`revenuecat-webhook: ignoring ${eventType}, older than stored state`)
    return json({ ok: true, action: 'stale' }, 200)
  }

  const { error: writeError } = await admin.from('user_entitlements').upsert({
    user_id: appUserId,
    tier: next.tier,
    pet_limit: next.pet_limit,
    expires_at: next.expires_at,
    updated_at: new Date().toISOString(),
    last_event_id: eventId,
    last_event_at: eventAt.toISOString(),
  })

  if (writeError) {
    console.error('revenuecat-webhook: upsert failed', writeError)
    return json({ error: 'write failed' }, 500)
  }

  console.log(`revenuecat-webhook: ${eventType} -> ${next.tier} (limit ${next.pet_limit}) for ${appUserId}`)
  return json({ ok: true, action: 'applied', tier: next.tier }, 200)
})

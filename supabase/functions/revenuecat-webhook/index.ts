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

// The pet limit each tier grants at the moment of purchase.
//
// ONE PAID TIER. There is no ordering or precedence here and there must not
// be — the app had Plus and Pro, that structure is gone, and a customer
// either holds the premium entitlement or does not.
//
// These are the values WRITTEN to a user's row, not the values read back.
// pet_limit_for() reads the pet_limit column, so raising one person's limit
// by hand (a breeder, a rescue, a support case) is a single UPDATE against
// their row and survives every renewal — the webhook only rewrites the
// column when an event for that user actually arrives.
const TIER_PET_LIMITS: Record<string, number> = {
  free: 1,
  premium: 5,
}

const FREE = { tier: 'free', pet_limit: 1 }

// Must match the entitlement identifier in the RevenueCat dashboard.
const ENTITLEMENT_PREMIUM = 'premium'

function tierFromEntitlements(entitlementIds: string[] | null | undefined) {
  return (entitlementIds ?? []).includes(ENTITLEMENT_PREMIUM) ? 'premium' : null
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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const eventAt = event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : new Date()
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null

  // --- Identity events -----------------------------------------------------
  //
  // These MUST be handled before the app_user_id guard below, and that
  // ordering is the whole point of this block.
  //
  // An identity event is precisely the case where app_user_id is NOT a
  // Supabase user id: it is the anonymous $RCAnonymousID being merged into a
  // real one. The guard rejects non-uuid app_user_id with a 200, so with
  // TRANSFER handled inside the switch below it it was unreachable for the
  // one transition it exists to catch. The real ids live in
  // transferred_from/transferred_to (TRANSFER) or aliases/original_app_user_id
  // (SUBSCRIBER_ALIAS), not necessarily in app_user_id.
  //
  // BOTH events are handled because RevenueCat documents both for identity
  // transitions and the payload for any given transition is not something
  // this code should guess at. Dropping either with a 200 tells RevenueCat
  // never to retry, and the money has already changed hands.
  if (eventType === 'TRANSFER' || eventType === 'SUBSCRIBER_ALIAS') {
    // Every id the event mentions, from the fields each event type uses.
    // Collected leniently: an id appearing in the wrong field still names a
    // real account, and the uuid filter is what keeps this safe.
    const donors: string[] = (event.transferred_from ?? []).filter((id: string) => UUID_RE.test(id))
    const receivers: string[] = [
      ...(event.transferred_to ?? []),
      ...(event.aliases ?? []),
      event.app_user_id,
      event.original_app_user_id,
    ].filter((id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id))

    const uniqueReceivers = [...new Set(receivers)].filter((id) => !donors.includes(id))
    const tier = tierFromEntitlements(event.entitlement_ids)

    // A TRANSFER moves an entitlement, so the donor loses it. An alias merges
    // two names for the same customer and has no donor to demote — which is
    // why donors comes only from transferred_from.
    for (const donor of donors) {
      await admin.from('user_entitlements').upsert({
        user_id: donor,
        ...FREE,
        expires_at: null,
        updated_at: new Date().toISOString(),
        last_event_id: eventId,
        last_event_at: eventAt.toISOString(),
      })
    }

    if (uniqueReceivers.length === 0) {
      // Both sides anonymous, or an alias between two ids neither of which is
      // a Supabase user. Nothing to write and nothing a retry would fix.
      console.warn(`revenuecat-webhook: ${eventType} with no Supabase user on either side`)
      return json({ ok: true, ignored: 'no supabase user in identity event' }, 200)
    }

    if (!tier) {
      // The identity moved but the payload does not say what entitlement came
      // with it. A retry cannot add fields, so this returns 200 rather than
      // looping forever — but it is logged at error level because a customer
      // may now be paying with no row, and that needs a human.
      //
      // PENDING ASH: if this ever fires, the fix is to read the subscriber
      // from RevenueCat's REST API here rather than trusting the payload.
      console.error(
        `revenuecat-webhook: ${eventType} for ${uniqueReceivers.join(',')} carried no ` +
        'recognised entitlement — entitlement NOT written, needs manual review',
      )
      return json({ ok: true, ignored: 'identity event without entitlement data', needs_review: true }, 200)
    }

    for (const receiver of uniqueReceivers) {
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

    console.log(`revenuecat-webhook: ${eventType} ${donors.join(',') || '(anonymous)'} -> ${uniqueReceivers.join(',')}`)
    return json({ ok: true, action: 'identity' }, 200)
  }

  // RevenueCat's app_user_id is the Supabase auth user id, because
  // RevenueCatContext.jsx configures with appUserID and calls
  // Purchases.logIn({ appUserID: user.id }). Anything else is either an
  // anonymous id from before that call or a different project pointed at this
  // URL — either way there is no user to write, and 200 stops RevenueCat
  // retrying something that will never work.
  //
  // Identity events are exempt and were handled above, because for those an
  // anonymous app_user_id is the normal case rather than a broken one.
  if (!appUserId || !UUID_RE.test(appUserId)) {
    console.warn(`revenuecat-webhook: ignoring ${eventType} for non-uuid app_user_id`)
    return json({ ok: true, ignored: 'app_user_id is not a supabase user id' }, 200)
  }

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

    default:
      // TEST, NON_RENEWING_PURCHASE and anything RevenueCat adds later. 200
      // so it is not retried forever. TRANSFER and SUBSCRIBER_ALIAS are NOT
      // here any more — they are identity events and are handled above the
      // app_user_id guard, because for them a non-uuid app_user_id is the
      // normal case.
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

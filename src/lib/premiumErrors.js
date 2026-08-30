import { useNavigate } from 'react-router-dom'

// Turns an RLS refusal into something a person can act on.
//
// Every premium table's policies now carry public.has_premium(), so a write
// attempted without an entitlement comes back as Postgres error 42501 with
// the text "new row violates row-level security policy for table ...".
// That string must never reach a user: it reads as a fault in the app rather
// than as the paid boundary it is, and it names internal tables besides.
//
// The client checks entitlement before offering any of these actions, so in
// normal use this never fires. It fires when the two disagree — a
// subscription that lapsed in another session, a renewal that has not landed
// yet, a screen left open on a second device. That is precisely the moment
// the message has to be good.
//
// 42501 is insufficient_privilege, which for our schema means exactly one
// thing: a policy said no. It cannot be confused with a missing row (that
// returns no error at all) or a constraint violation (23xxx).
const RLS_DENIED = '42501'

export function isPremiumDenied(error) {
  return error?.code === RLS_DENIED
}

// A single sentence for the places that show inline text rather than open
// the paywall. Deliberately does not apologise or suggest anything went
// wrong, because nothing did.
export const PREMIUM_DENIED_MESSAGE =
  'This is a Premium feature. Your records are saved and will return when your subscription is active.'

// One handler for every "the save failed" branch on a premium screen.
//
// Returns the message to display, or null when it has already navigated —
// so a call site stays a one-liner and cannot accidentally show the raw
// error on the way out:
//
//   setErrorMessage(premiumOr(error, 'Could not save that medication.'))
//
// A 42501 sends the user to the paywall rather than leaving them on a screen
// whose every subsequent action would fail the same way, and carries the
// feature phrase so the headline answers what they were trying to do.
export function usePremiumDenial(feature) {
  const navigate = useNavigate()

  return function premiumOr(error, fallback) {
    if (isPremiumDenied(error)) {
      navigate('/paywall', { state: { feature } })
      return null
    }
    return error?.message || fallback
  }
}

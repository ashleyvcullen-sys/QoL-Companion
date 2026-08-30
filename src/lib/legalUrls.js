// The public legal documents, as one definition.
//
// These are the URLs Apple checks. A subscription paywall has to link an EULA
// covering auto-renewal, cancellation and refunds, and a privacy policy — and
// the in-app Legal & Privacy screen is a plain-language SUMMARY that does not
// cover those terms. Pointing the paywall at the in-app page is a Guideline
// 3.1.2 rejection, so the paywall links these instead.
//
// In one file because they appear on more than one screen and must not drift:
// a paywall linking one document while the Legal screen links another is the
// kind of difference nobody notices until review.
//
// Both the apex and www hosts resolve; www is used here because that is the
// canonical form given for the App Store listing. The link TEXT is written
// without it, which is normal — the host is not the useful part of a URL to
// read aloud.
export const TERMS_URL = 'https://www.qolcompanion.com.au/terms-conditions'
export const PRIVACY_POLICY_URL = 'https://www.qolcompanion.com.au/privacy-policy'

export const TERMS_LABEL = 'qolcompanion.com.au/terms-conditions'
export const PRIVACY_POLICY_LABEL = 'qolcompanion.com.au/privacy-policy'

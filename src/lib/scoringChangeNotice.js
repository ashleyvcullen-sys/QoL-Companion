// The one-off pop-up that explains why yesterday's numbers have moved.
//
// On 24 Sep 2026 the overall score started counting disease monitoring and
// body condition (lib/qolInfluences.js). Scores are computed from stored
// answers every time they are drawn, never saved, so the change applies to
// the whole history at once — which is the right arithmetic and the wrong
// surprise: an owner opens the app and a fortnight that read "Mildly
// reduced" now reads "Moderately reduced", with nothing having happened to
// their animal.
//
// A pop-up with an OK on it rather than a line on two screens — Ash's
// instruction 24 Sep 2026. A line can be scrolled past by exactly the person
// who needed it; a dialogue is read and then gone for good.
//
// Gone for good means two things, whichever comes first: they press OK, or a
// day passes. One day rather than a week because a dialogue that keeps
// coming back is an irritation, and anyone who has opened the app once has
// already seen it.
//
// The clock starts at first launch rather than on a fixed date, so an owner
// who updates six weeks late still gets the explanation on the day the
// numbers change for THEM.
const KEY = 'qol.scoringChange.2026-09-24'
const DISMISSED = 'dismissed'
const DAYS = 1
const DAY_MS = 24 * 60 * 60 * 1000

export function scoringChangeNoticeVisible() {
  try {
    const stored = window.localStorage.getItem(KEY)
    if (stored === DISMISSED) return false
    if (!stored) {
      window.localStorage.setItem(KEY, String(Date.now()))
      return true
    }
    const started = Number(stored)
    if (!Number.isFinite(started)) return false
    return Date.now() - started < DAYS * DAY_MS
  } catch {
    // No storage — private mode, cleared data. Showing it on every launch
    // would be worse than not showing it at all, so it stays quiet.
    return false
  }
}

// Pressing OK. Written as a word rather than a date so it can never come
// back, whatever the clock says.
export function dismissScoringChangeNotice() {
  try {
    window.localStorage.setItem(KEY, DISMISSED)
  } catch {
    // It is dismissed for this session either way — the component's own
    // state closes it. It would simply return on the next launch.
  }
}

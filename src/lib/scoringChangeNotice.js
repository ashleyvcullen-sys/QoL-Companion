// The one-week note that explains why yesterday's numbers have moved.
//
// On 24 Sep 2026 the overall score started counting disease monitoring and
// body condition (lib/qolInfluences.js). Scores are computed from stored
// answers every time they are drawn, never saved, so the change applies to
// the whole history at once — which is the right arithmetic and the wrong
// surprise: an owner opens the app and a fortnight that read "Mildly
// reduced" now reads "Moderately reduced", with nothing having happened to
// their animal.
//
// So: a line on Trends, for the first seven days after this build is first
// opened, and then never again.
//
// The clock starts at first launch rather than at a fixed date because an
// owner who updates six weeks late deserves the same explanation on the day
// it changes for THEM.
const KEY = 'qol.scoringChange.2026-09-24'
const DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function scoringChangeNoticeVisible() {
  try {
    const stored = window.localStorage.getItem(KEY)
    if (!stored) {
      window.localStorage.setItem(KEY, String(Date.now()))
      return true
    }
    const started = Number(stored)
    if (!Number.isFinite(started)) return false
    return Date.now() - started < DAYS * DAY_MS
  } catch {
    // No storage — private mode, cleared data. Showing it every launch would
    // be worse than not showing it at all, so it stays quiet.
    return false
  }
}

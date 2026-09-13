import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { InAppReview } from '@capacitor-community/in-app-review'

// Apple's own review sheet, asked for at a moment that earns it.
//
// Two rules decide when, and the second matters more than the first.
//
// ENOUGH USE. Asking a stranger to rate something they have opened twice gets
// a one-star or nothing. Five completed assessments means the owner has kept
// coming back, which is the only evidence we have that the app is working for
// them.
//
// NOT AFTER BAD NEWS. The app has just told this owner their pet's quality of
// life is moderately or severely reduced. Asking them to rate the app in that
// moment is tone-deaf, and it invites a low rating for a number the app did
// not cause. Only Good and Mildly reduced — the 75% floor — are asked.
//
// Apple shows the sheet at most three times per user per year and decides for
// itself whether to show it at all, so nothing here can rely on it appearing.
// The cooldown below is ours on top of that: having asked once, we do not ask
// again for four months even if Apple silently swallowed it.
const COUNT_KEY = 'review.assessmentCount'
const ASKED_KEY = 'review.lastAskedAt'
const ASK_AFTER_ASSESSMENTS = 5
const COOLDOWN_DAYS = 120
const MIN_PERCENT = 75

async function readNumber(key) {
  const { value } = await Preferences.get({ key })
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Never throws and never blocks the caller's screen. A review prompt is the
// least important thing happening at this moment; if any of it fails, the
// owner should never know.
export async function maybeAskForReview(percent) {
  try {
    if (!Capacitor.isNativePlatform()) return

    const count = (await readNumber(COUNT_KEY)) + 1
    await Preferences.set({ key: COUNT_KEY, value: String(count) })

    if (count < ASK_AFTER_ASSESSMENTS) return
    if (!Number.isFinite(percent) || percent < MIN_PERCENT) return

    const lastAsked = await readNumber(ASKED_KEY)
    const elapsedDays = (Date.now() - lastAsked) / 86400000
    if (lastAsked && elapsedDays < COOLDOWN_DAYS) return

    await Preferences.set({ key: ASKED_KEY, value: String(Date.now()) })
    await InAppReview.requestReview()
  } catch {
    // Deliberately silent.
  }
}

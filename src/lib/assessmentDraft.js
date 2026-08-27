import { Preferences } from '@capacitor/preferences'

// @capacitor/preferences works on web too (backed by localStorage there),
// so this isn't gated to native — losing an in-progress assessment to an
// accidentally-closed browser tab is just as real a problem as switching
// away from the native app mid-assessment.

function draftKey(petId) {
  return `qol_assessment_draft_${petId}`
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

// Returns the saved draft's entry only if it was started today — a draft
// from a previous day is stale (this app is one assessment per pet per
// day) and gets cleared rather than offered back.
export async function loadTodaysAssessmentDraft(petId) {
  const { value } = await Preferences.get({ key: draftKey(petId) })
  if (!value) return null

  let draft
  try {
    draft = JSON.parse(value)
  } catch {
    return null
  }

  if (draft?.date !== todayDateString()) {
    await clearAssessmentDraft(petId)
    return null
  }

  // The page too, where one was saved. Answers alone can only say which
  // sections are FILLED IN, which is not the same as where someone was
  // standing — an owner who skipped a question and moved on gets sent back
  // to the one they chose to skip.
  return { entry: draft.entry ?? null, pageIndex: draft.pageIndex ?? null }
}

export async function saveAssessmentDraft(petId, entry, pageIndex = null) {
  await Preferences.set({
    key: draftKey(petId),
    value: JSON.stringify({ date: todayDateString(), entry, pageIndex }),
  })
}

export async function clearAssessmentDraft(petId) {
  await Preferences.remove({ key: draftKey(petId) })
}

import { Preferences } from '@capacitor/preferences'

// Which pet the user last had selected, so multi-pet users come back to the
// same pet they left off on rather than always snapping to the most recent.
// Same Preferences-based approach as assessmentDraft.js — works on web too
// (localStorage-backed), so this isn't gated to native.
//
// Stored per user id rather than globally: two accounts signing in on the
// same device shouldn't inherit each other's selection (and a stale id from
// another account would just fail validation and fall back anyway).
function selectedPetKey(userId) {
  return `qol_selected_pet_${userId}`
}

export async function loadSelectedPetId(userId) {
  if (!userId) return null
  try {
    const { value } = await Preferences.get({ key: selectedPetKey(userId) })
    return value || null
  } catch {
    // A failed read just means we fall back to a default pet — never worth
    // breaking app startup over.
    return null
  }
}

export async function saveSelectedPetId(userId, petId) {
  if (!userId) return
  try {
    if (petId) {
      await Preferences.set({ key: selectedPetKey(userId), value: petId })
    } else {
      await Preferences.remove({ key: selectedPetKey(userId) })
    }
  } catch {
    // Best-effort persistence — the in-memory selection still works for
    // this session even if the write fails.
  }
}

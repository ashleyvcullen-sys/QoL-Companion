// Whether to animate, and the one place that decides it.
//
// Two switches, either of which is enough: the phone's own Reduce Motion
// setting, and the app's toggle in Settings. The phone's is authoritative
// when it is on — somebody who has asked their whole device to stop moving
// should not have to ask this app separately — and the app's toggle exists
// for people who want motion elsewhere but not here.
const STORAGE_KEY = 'qol.reduceMotion'

export function systemReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function readReduceMotion() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// What every animation in the app asks before it starts.
export function reduceMotion() {
  return systemReducedMotion() || readReduceMotion()
}

// Stamped on the root element so stylesheet animations can be switched off
// by the same answer the JavaScript ones use — one source of truth, rather
// than a media query saying one thing and a setting saying another.
export function applyReduceMotion(on) {
  const root = document.documentElement
  if (on) root.dataset.reduceMotion = 'true'
  else delete root.dataset.reduceMotion
}

export function setReduceMotion(on) {
  applyReduceMotion(on)
  try {
    window.localStorage.setItem(STORAGE_KEY, String(on))
  } catch {
    // It still applies for this session; it just will not be remembered.
  }
}

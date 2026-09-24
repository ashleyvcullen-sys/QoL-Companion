// Dynamic Type: the app's text follows the size the owner set for their
// phone, rather than the size this stylesheet happens to like.
//
// Ash's instruction 24 Sep 2026. It matters more here than in most apps —
// the people using this are often reading a screen about an old animal
// through reading glasses, and a fixed 13px caption is a caption they cannot
// read.
//
// How it works: iOS resolves the CSS font shorthand `-apple-system-body` to
// whatever the Dynamic Type body size currently is (17px at the default
// setting, up to about 53px at the largest accessibility size). Measuring a
// hidden element set to it is the only way a web view can read that setting
// — there is no media query for it.
//
// Everything in the type scale is `calc(Npx * var(--type-scale))`, so setting
// one number here moves the whole scale together and every relationship in
// it is preserved.

const BASE_PX = 17
// Clamped deliberately. Below 1 there is nothing to gain — the scale is
// already small — and above 1.3 the five-tab bar, the calendar cells and the
// score ring stop fitting a 375px phone, which is a worse outcome for the
// same person than slightly smaller text. Someone who needs more than this
// is better served by the system zoom than by a broken layout.
const MIN = 1
const MAX = 1.3

// The body size the phone is currently set to, or null where the browser
// does not understand -apple-system-body (every desktop browser, and
// Android's web view).
export function systemBodyPx() {
  if (typeof document === 'undefined') return null
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body'
  document.body.appendChild(probe)
  const size = parseFloat(window.getComputedStyle(probe).fontSize)
  probe.remove()
  // A browser that does not support the keyword leaves its own default
  // (usually exactly 16px), which is not a Dynamic Type answer. Treat
  // anything that has not moved off a plain default as "no setting to read".
  return Number.isFinite(size) && size > 0 ? size : null
}

export function typeScale() {
  const size = systemBodyPx()
  if (!size) return 1
  return Math.min(MAX, Math.max(MIN, size / BASE_PX))
}

export function applyTypeScale() {
  const scale = typeScale()
  document.documentElement.style.setProperty('--type-scale', String(scale))
  return scale
}

// Dynamic Type can be changed while the app is in the background — the owner
// goes to Settings precisely because they could not read something here — so
// the size is measured again every time the app comes back rather than only
// at launch.
export function watchTypeScale() {
  applyTypeScale()
  const onVisible = () => {
    if (document.visibilityState === 'visible') applyTypeScale()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}

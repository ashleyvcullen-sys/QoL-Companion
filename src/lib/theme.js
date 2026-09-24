// Light, dark, or whatever the phone is set to.
//
// Ash's instruction 23 Sep 2026. The theme itself is a token list in
// index.css; this is only the switch — it stamps the root element, which the
// [data-theme] rules there read, and remembers the choice.
//
// "system" stamps NOTHING, deliberately: the media query then applies, and
// the app follows the phone the moment the phone changes, including on the
// automatic sunset switch. Writing "light" or "dark" on every launch would
// pin it to whatever it was at install time.
const STORAGE_KEY = 'qol.theme'
export const THEME_OPTIONS = ['system', 'light', 'dark']

export function readThemePreference() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return THEME_OPTIONS.includes(saved) ? saved : 'system'
  } catch {
    // Storage can be unavailable (private mode, cleared site data). Following
    // the phone is the right answer when we cannot remember being told
    // otherwise.
    return 'system'
  }
}

export function applyTheme(preference) {
  const root = document.documentElement
  if (preference === 'light' || preference === 'dark') root.dataset.theme = preference
  else delete root.dataset.theme
}

export function setThemePreference(preference) {
  applyTheme(preference)
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // The theme still changed for this session; it just will not be
    // remembered. Not worth a message.
  }
}

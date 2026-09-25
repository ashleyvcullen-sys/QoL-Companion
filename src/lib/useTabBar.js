import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useEntitlements } from './EntitlementsContext'
import { usePets } from './PetsContext'

// Screens the bottom tab bar stays off.
//
// Ash's instruction, 23 Sep 2026: the bar is present everywhere in the app,
// the assessment wizard included. Leaving a half-finished check-in is safe —
// every answer is kept as a local draft and the wizard resumes on the page it
// was left on — so a tab is a way out, not a way to lose work.
//
// What remains are the three screens that are not "in the app" yet: Login,
// Onboarding, and the Welcome walkthrough a brand-new pet is held on. Every
// tab from there would bounce straight back to where the owner already is.
const TAB_BAR_HIDDEN_PREFIXES = ['/login', '/onboarding', '/welcome']

// Where a back control does not belong: the tab roots, the screens before
// there is an app to navigate, and the assessment, whose wizard owns both the
// horizontal swipe (previous question) and its own Exit.
const BACK_HIDDEN_PREFIXES = ['/login', '/onboarding', '/welcome', '/assessment']

export function isTabBarPath(pathname) {
  return !TAB_BAR_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// The paths the bottom bar itself leads to. Medications is premium-only and
// sits where the bar puts it, between Assess and Trends.
export function tabOrderFor(hasPremium) {
  return hasPremium
    ? ['/', '/assess', '/medications', '/trends', '/more']
    : ['/', '/assessment', '/trends', '/more']
}

// Standing on a tab root.
//
// Two things turn on it: the back control says "Home" rather than "Back",
// because a tab has no history of its own to pop; and the horizontal swipe is
// off entirely.
//
// The swipe used to PAGE between tabs here — left for the next tab, right for
// the previous. Removed on Ash's instruction 25 Sep 2026: a tab bar is
// already five taps wide at the bottom of the screen, and a gesture that
// changes tab is mostly encountered by accident, while trying to scroll a
// chart or a list. It stays where it is genuinely the way through: inside an
// assessment, between questions.
export function useOnTabRoot() {
  const { pathname } = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { pets, loading: petsLoading } = usePets()
  const { hasPremium } = useEntitlements()

  if (authLoading || petsLoading || !user || pets.length === 0) return false

  return tabOrderFor(hasPremium).includes(pathname)
}

// True when the bar should be on screen. Used by TabBar to draw it and by
// Footer to stand down — the footer's links moved into More, and two fixed
// bars stacked at the bottom of the same screen is neither.
//
// Gated on there being an account with a pet in it, because /terms,
// /privacy and /support are reachable signed out, where every tab would
// bounce straight to the login screen.
// Whether this screen gets the back bar, and the swipe that goes with it.
// Deliberately the same answer for both, so the button and the gesture can
// never disagree about whether going back is a thing here.
//
// Every screen but Home has one — Ash's instruction 23 Sep 2026. On the
// other tab roots the button goes Home rather than back, because a tab has
// no history of its own to pop; on Home itself there is nowhere to go, and a
// control that does nothing is worse than no control.
export function useBackNavVisible() {
  const { pathname } = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { pets, loading: petsLoading } = usePets()

  if (authLoading || petsLoading) return false
  if (!user || pets.length === 0) return false
  if (pathname === '/') return false
  return !BACK_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function useTabBarVisible() {
  const { pathname } = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { pets, loading: petsLoading } = usePets()

  if (authLoading || petsLoading) return false
  if (!user || pets.length === 0) return false
  return isTabBarPath(pathname)
}

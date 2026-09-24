import { NavLink, useLocation } from 'react-router-dom'
import { Heart, House, Lock, Menu, Pill, TrendingUp } from 'lucide-react'
import { useTabBarVisible } from '../lib/useTabBar'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { useDueToday } from '../lib/useDueToday'
import { MEDICATION_STATE, medicationStatusToday, useMedications } from '../lib/medicationsData'

// A tab bar is for the handful of places somebody goes every day; everything
// else is a list one tap deeper. Assess sits in the middle because it is the
// thing the app exists to have them do.
//
// Medications is a tab of its own on premium — Ash's instruction 23 Sep 2026.
// Doses are logged more often than anything else in the app, several times a
// day, and a daily task behind two taps is a daily task people stop doing. A
// free account never sees it: the screen is paid, and a tab that always leads
// to a paywall is an advert in the furniture.
//
// "Meds" — APPROVED — Dr Ash Cullen (BSc, DVM), 23 Sep 2026. The full word does not fit
// five ways across a 375px screen at this size, and a truncated label is
// worse than a short one.
const BASE_TABS = [
  { to: '/', label: 'Home', Icon: House },
  // Both tiers go to the list of things that can be recorded — Ash's
  // instruction 24 Sep 2026. A free account used to be sent straight to the
  // one thing it can record, which meant the other three were invisible:
  // nothing in the app said disease monitoring, weight or photos existed.
  // They are on the list now, locked, which is how a paid feature is found.
  { to: '/assess', tourTarget: '/assessment', label: 'Assess', Icon: Heart },
  { to: '/trends', label: 'Trends', Icon: TrendingUp },
  { to: '/more', label: 'More', Icon: Menu },
]

// On both tiers — Ash's instruction 24 Sep 2026. A free account sees the tab
// with a lock on it and reaches the paywall through it; the route guard
// (RequirePremium in App.jsx) is what actually holds the screen shut, so the
// tab needs no special destination.
const MEDICATIONS_TAB = { to: '/medications', label: 'Meds', Icon: Pill, premium: true }

// Everything the Assess tab leads to, so tapping a condition from the home
// card lights Assess rather than More — Ash's report 24 Sep 2026. These four
// are the rows ON the Assess screen; they only used to count when they were
// reached through it, because the test was a prefix match on "/assess" and a
// condition's own path does not start with that.
//
// `/assessment` is matched by `/assess` already, on purpose: it is the same
// tab either way, and a free account's Assess tab goes straight to it.
const ASSESS_PATHS = ['/conditions', '/body-condition', '/media']

// More stays lit for everything ELSE it leads to — settings, the tour, the
// reference screens — so the bar always says which quarter of the app is on
// screen rather than going blank the moment you tap through.
function activeTab(pathname) {
  if (pathname === '/') return '/'
  if (pathname.startsWith('/trends')) return '/trends'
  if (pathname.startsWith('/medications')) return '/medications'
  // '/assess' and '/assessment' both.
  if (pathname.startsWith('/assess')) return '/assess'
  if (ASSESS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return '/assess'
  return '/more'
}

export default function TabBar() {
  const visible = useTabBarVisible()
  const { pathname } = useLocation()
  const { selectedPet } = usePets()
  const { hasPremium } = useEntitlements()
  // Anything owed today, so the bar says so wherever the owner is — Ash's
  // instruction 23 Sep 2026. Conditions only count for an account that can
  // still open them.
  const { anyDue } = useDueToday(selectedPet, { includeConditions: hasPremium })
  // Doses owed today. Premium-only, like the screen itself.
  const { medications, doses } = useMedications(hasPremium ? selectedPet?.id : null)
  const medicationState = medicationStatusToday(medications, doses).state
  const medicationsDue = medicationState === MEDICATION_STATE.DUE
    || medicationState === MEDICATION_STATE.OVERDUE

  // What "assess" means depends on the account: one thing to record on a
  // free one, four on a premium one — see the Assess screen.

  if (!visible) return null

  const active = activeTab(pathname)
  // Medications sits between Assess and Trends: the two things recorded daily
  // stay together, and the two ways of looking back stay together. Five tabs
  // on both tiers now.
  const tabs = [...BASE_TABS.slice(0, 2), MEDICATIONS_TAB, ...BASE_TABS.slice(2)]

  return (
    <>
      {/* Fixed bars sit outside normal flow, so the space they occupy has to
          be reserved separately or the last card on every screen ends up
          underneath one. Same arrangement as Footer's spacer. */}
      <div className="tab-bar-spacer" aria-hidden="true" />

      <nav
        className="tab-bar"
        aria-label="Main"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((tab) => {
          const { to, label, Icon } = tab
          const locked = tab.premium && !hasPremium
          const isActive = active === to
          // A dot rather than a count. "Something is waiting" is the whole
          // message; a number would invite the owner to work out which of
          // four things it meant while standing in the kitchen.
          const showDue = !locked
            && ((to === '/assess' && anyDue) || (to === '/medications' && medicationsDue))
          const inner = (
            <>
              <span className="tab-bar-icon">
                <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                {showDue && <span className="tab-bar-dot" aria-hidden="true" />}
                {/* A small lock rather than a hidden tab: the feature has to
                    be visible to be wanted. Tapping it lands on the paywall
                    by way of the route guard. */}
                {locked && (
                  <span className="tab-bar-lock" aria-hidden="true">
                    <Lock size={9} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="tab-bar-label">{label}</span>
            </>
          )

          return (
            <NavLink
              key={to}
              to={hasPremium ? to : (tab.freeTo ?? to)}
              aria-label={locked ? `${label}, premium feature, locked` : undefined}
              // The home tour spotlights tabs as well as tiles — see the
              // lookup in HomeTour.
              data-tour-target={tab.tourTarget ?? to}
              className={`tab-bar-item ${isActive ? 'is-active' : ''}`.trim()}
              aria-current={isActive ? 'page' : undefined}
            >
              {inner}
            </NavLink>
          )
        })}
      </nav>

    </>
  )
}

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, House } from 'lucide-react'
import { useBackNavVisible, useOnTabRoot } from '../lib/useTabBar'
import { useHorizontalSwipe } from '../lib/swipeNav'
import { useZoom } from './ZoomTransition'

// One back control, always on screen, plus the swipe that does the same
// thing — Ash's instruction 23 Sep 2026.
//
// A WebView gives neither for free: iOS's interactive pop gesture belongs to
// a native navigation controller, and this app is one page with a router
// inside it. Both are therefore built here, from one visibility rule, so the
// gesture and the button are never available in different places.
//
// The gesture itself lives in lib/swipeNav.js, which the assessment wizard
// shares — anywhere on the screen, with one guard list. It is off on the tab
// roots; see useOnTabRoot for why.
//
// Sticky rather than fixed: it takes its own space at the top of the column
// instead of floating over the first card, and still never scrolls away.
export default function BackBar() {
  const navigate = useNavigate()
  const visible = useBackNavVisible()
  // A tab root has no back of its own, and since 25 Sep 2026 no swipe either
  // — see useOnTabRoot.
  const onTabRoot = useOnTabRoot()
  const { zoomBack } = useZoom()

  // Forward, for a screen the owner has already swiped back out of — Ash's
  // instruction 24 Sep 2026, "forward / back in the app, not just across the
  // tabs". history.state.idx is React Router's position in the stack; at the
  // end of it there is nothing ahead and the swipe does nothing rather than
  // guessing at a destination.
  const goForward = useCallback(() => {
    const index = window.history.state?.idx
    if (typeof index === 'number' && index < window.history.length - 1) navigate(1)
  }, [navigate])

  const goBack = useCallback(() => {
    // A deep link, a notification tap or a reload can land the owner on a
    // screen with nothing behind it. history.state.idx is React Router's own
    // position in the stack; 0 means this is the first entry and there is
    // nothing to pop, so Home is the honest destination.
    const index = window.history.state?.idx
    const pop = () => {
      if (typeof index === 'number' && index > 0) navigate(-1)
      else navigate('/')
    }

    // If this screen was opened by a card expanding, it shrinks back into
    // that card. zoomBack does the navigating itself so the previous screen
    // is underneath before the rectangle starts moving; it returns false when
    // there is no card to shrink into, and true — without navigating twice —
    // if a transition is already running.
    if (zoomBack?.(pop)) return
    pop()
  }, [navigate, zoomBack])

  // Right goes back, left goes forward, on the screens that have a back
  // control to agree with.
  //
  // NOT on the tab roots. The same gesture paged between tabs there until
  // 25 Sep 2026, when Ash had it removed: the bar is five taps wide at the
  // bottom of the screen, and a swipe that changed tab was mostly met by
  // accident while trying to scroll something. History would have done the
  // same thing by another route — Trends back to Assess is a tab change
  // whatever it is called — so the gesture is off there outright rather than
  // narrowed.
  useHorizontalSwipe({
    enabled: visible && !onTabRoot,
    standDownForOwnPager: true,
    onLeft: goForward,
    onRight: goBack,
  })

  if (!visible) return null

  return (
    <div className="back-bar">
      {/* On a tab root the only sensible destination is Home, and the label
          says so rather than promising a "back" that is really a jump. */}
      <button type="button" className="back-bar-button" onClick={onTabRoot ? () => navigate('/') : goBack}>
        {onTabRoot
          ? <House size={16} aria-hidden="true" />
          : <ChevronLeft size={18} aria-hidden="true" />}
        {onTabRoot ? 'Home' : 'Back'}
      </button>
    </div>
  )
}

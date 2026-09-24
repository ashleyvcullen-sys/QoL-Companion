import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTabBarVisible } from '../lib/useTabBar'

// How much there has to be below the fold before the button appears.
//
// It was 1.8 SCREENS, which is a long page — so on most screens the control
// simply never existed, which is what Ash reported on 24 Sep 2026. It is now
// a fixed overflow: if there is more than a couple of taps' worth of
// scrolling to do, there is a button to do it with. Below that, the jump is a
// flick of the thumb and a floating button would be clutter over the content
// it is offering to move.
const OVERFLOW_PX = 200
// Close enough to the end that "go to the bottom" would not move anything.
const AT_END_PX = 48

// One button that changes direction — jump to the bottom from the top, and
// back to the top once you are down there. Ash's instruction 24 Sep 2026,
// after a stacked pair: only one of the two is ever the useful one, and two
// arrows together make the owner read both and pick, for a control whose
// whole value is that it needs no thought.
//
// It stays on screen the whole way down a long page rather than appearing
// and vanishing as you scroll — the same control in the same place.
//
// On every screen with something below the fold — Trends, the condition
// screens, Home Care Tips, the legal text, and the shorter ones in between.
export default function ScrollButtons() {
  const tabBarVisible = useTabBarVisible()
  // Re-measured on every navigation: a new screen can be shorter or longer
  // than the last, and the body's own size does not always change enough for
  // the observer below to notice.
  const { pathname } = useLocation()
  const [show, setShow] = useState(false)
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    function measure() {
      const doc = document.documentElement
      setShow(doc.scrollHeight - window.innerHeight > OVERFLOW_PX)
      // Held in state, not computed at render: the scroll handler only
      // re-renders when this value actually changes, and one read straight
      // off the window during render would go stale.
      setAtBottom(window.innerHeight + window.scrollY >= doc.scrollHeight - AT_END_PX)
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)

    // Screens grow as their data arrives, and a chart or a calendar can
    // double a page's height a second after it renders. A scroll listener
    // alone would leave the button missing until the owner happened to
    // scroll — which is the moment it stops being useful.
    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(document.body)
    }

    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [pathname])

  if (!show) return null

  // Down until there is nothing below, then up. At the very bottom the only
  // useful direction is back to the top.
  const toBottom = !atBottom

  return (
    <button
      type="button"
      className={`scroll-jump ${tabBarVisible ? 'has-tab-bar' : ''}`.trim()}
      aria-label={toBottom ? 'Scroll to the bottom' : 'Scroll back to the top'}
      onClick={() => window.scrollTo({
        top: toBottom ? document.documentElement.scrollHeight : 0,
        behavior: 'smooth',
      })}
    >
      {toBottom ? <ArrowDown size={20} /> : <ArrowUp size={20} />}
    </button>
  )
}

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Where each screen is scrolled to, and where it should be on arrival.
//
// A router does not do this for you: without it, opening a condition from a
// home screen scrolled halfway down lands you halfway down the condition
// screen, which is the kind of thing that reads as the app having lost its
// place. It matters more now that a card expands into the screen — the
// content revealed underneath has to be the top of it.
//
// Forward: the top. Back: exactly where they were, because going back to a
// list and having to find your place again is the other half of the same
// complaint.
export default function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map())
  const previousKey = useRef(location.key)

  useEffect(() => {
    // The browser's own restoration guesses, and guesses late — after the new
    // screen has painted at the wrong offset.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  // useLayoutEffect, not useEffect: this has to run in the same frame the new
  // screen is committed. Scrolling after paint is the jump.
  useLayoutEffect(() => {
    const leavingKey = previousKey.current
    if (leavingKey && leavingKey !== location.key) {
      positions.current.set(leavingKey, window.scrollY)
    }
    previousKey.current = location.key

    const saved = positions.current.get(location.key)
    if (navigationType === 'POP' && typeof saved === 'number') {
      window.scrollTo(0, saved)
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.key, navigationType])

  return null
}

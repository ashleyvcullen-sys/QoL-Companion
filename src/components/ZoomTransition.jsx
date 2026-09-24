import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { reduceMotion } from '../lib/motion'

// The zoom, in numbers. 265ms sits in the middle of the design system's
// 180-280ms range; the curve is a plain ease-out with no overshoot, because
// a card opening into a screen about a sick animal should feel like a drawer
// being opened, not a notification arriving.
const EXPAND_MS = 265
const FADE_MS = 140
const REDUCED_FADE_MS = 120
const EASE_OUT = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

const ZoomContext = createContext(null)

export function useZoom() {
  return useContext(ZoomContext) ?? { zoomTo: null, zoomBack: null, hasOrigin: () => false }
}

// A card that expands into the screen it opens.
//
// Ash's instruction 23 Sep 2026, for the condition rows on the home card and
// the rows on the More screen.
//
// WHAT ACTUALLY MOVES is a plain coloured rectangle, not the screen and not
// the card. The destination renders immediately underneath, at its correct
// scroll position; the rectangle starts exactly over the tapped card, grows
// to fill the viewport, and fades away to reveal what was already there.
// Animating the screen itself would mean fighting its scroll position, its
// data loading in mid-flight, and the tab bar underneath it.
//
// The rectangle sits BELOW the tab bar's z-index on purpose: the bar is the
// one thing on screen that must not move or flicker during a navigation, so
// it is simply never covered.
export function ZoomProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const overlayRef = useRef(null)
  const [rect, setRect] = useState(null)
  // True from the first tap until the overlay has finished fading. A second
  // tap while it is true is ignored, so a double-tap cannot start two
  // transitions or navigate twice.
  const runningRef = useRef(false)
  // Where each screen was opened from, so going back can shrink into the
  // same card. Keyed by path; a Map rather than navigation state because the
  // swipe-back gesture and the Back button both need it without the route
  // having carried anything.
  const originsRef = useRef(new Map())

  const run = useCallback((from, direction) => {
    const overlay = overlayRef.current
    if (!overlay) return

    const finish = () => {
      setRect(null)
      runningRef.current = false
    }

    // Reduced motion: no geometry, just a short fade over the change — the
    // same reassurance that something happened, without the movement.
    if (reduceMotion()) {
      const fade = overlay.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: REDUCED_FADE_MS, easing: 'ease-out', fill: 'forwards' },
      )
      fade.onfinish = finish
      fade.oncancel = finish
      return
    }

    const width = Math.max(1, window.innerWidth)
    const height = Math.max(1, window.innerHeight)
    const small = {
      transform: `translate(${from.left}px, ${from.top}px) scale(${from.width / width}, ${from.height / height})`,
      borderRadius: '18px',
    }
    const full = { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: '0px' }

    const move = overlay.animate(
      direction === 'in' ? [small, full] : [full, small],
      { duration: EXPAND_MS, easing: EASE_OUT, fill: 'forwards' },
    )

    move.onfinish = () => {
      const fade = overlay.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' },
      )
      fade.onfinish = finish
      fade.oncancel = finish
    }
    move.oncancel = finish
  }, [])

  // Kicked off after the destination has rendered, so the rectangle is never
  // covering a screen that is not there yet.
  useEffect(() => {
    if (!rect) return
    // Two frames: one for React to commit the overlay, one for the browser to
    // have laid it out before it is asked to move.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => run(rect.from, rect.direction)))
    return () => cancelAnimationFrame(id)
  }, [rect, run])

  const zoomTo = useCallback((to, element) => {
    if (runningRef.current) return
    const box = element?.getBoundingClientRect?.()
    originsRef.current.set(to, box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null)

    // No element, or a card scrolled out of view, means nothing to grow from.
    // Navigate plainly rather than inventing an origin.
    if (!box || box.height === 0 || box.bottom < 0 || box.top > window.innerHeight) {
      navigate(to)
      return
    }

    runningRef.current = true
    navigate(to)
    setRect({ from: { top: box.top, left: box.left, width: box.width, height: box.height }, direction: 'in' })
  }, [navigate])

  const hasOrigin = useCallback((path) => Boolean(originsRef.current.get(path)), [])

  // The reverse. The previous screen renders underneath first — with its own
  // scroll position restored — and the rectangle shrinks back into the card
  // that was tapped.
  const zoomBack = useCallback((goBack) => {
    if (runningRef.current) {
      return true
    }
    const origin = originsRef.current.get(location.pathname)
    if (!origin) return false

    runningRef.current = true
    goBack()
    setRect({ from: origin, direction: 'out' })
    return true
  }, [location.pathname])

  return (
    <ZoomContext.Provider value={{ zoomTo, zoomBack, hasOrigin }}>
      {children}
      {rect && (
        <div
          ref={overlayRef}
          className="zoom-overlay"
          aria-hidden="true"
          // Starts where its animation starts — over the card on the way in,
          // full-screen on the way back — so there is never a frame of it in
          // the wrong place before the first keyframe applies.
          style={reduceMotion() || rect.direction === 'out' ? undefined : {
            transform: `translate(${rect.from.left}px, ${rect.from.top}px) scale(${rect.from.width / Math.max(1, window.innerWidth)}, ${rect.from.height / Math.max(1, window.innerHeight)})`,
            borderRadius: '18px',
          }}
        />
      )}
    </ZoomContext.Provider>
  )
}

import { useEffect, useRef } from 'react'

// One horizontal swipe, shared by everything in the app that turns a page.
//
// Ash's report 24 Sep 2026: swiping in the assessment only worked over the
// text. The handlers were on the wizard's own element, so a gesture that
// started on the screen's padding, beside the card, or below the buttons
// landed on nothing. They are on `window` now — a page turn is a gesture
// made AT the screen, not at one box on it — and what keeps it off the
// things that must not turn a page is the guard list below rather than the
// accident of which element is under the finger.
//
// Both users are here: the assessment wizard (previous / next question) and
// the back bar (back / forward). The back bar used to page between the main
// tabs too; removed on Ash's instruction 25 Sep 2026 — see useOnTabRoot.

// Things that move sideways under a finger themselves.
//
// Narrowed on Ash's report 24 Sep 2026 that left swipes were not reaching
// More: the list held `.recharts-wrapper` and `.trend-chips`, which between
// them cover most of the Trends screen. Neither actually moves — a chart body
// is static (only its BRUSH drags) and the chips wrap rather than scroll.
// What is left is the handful of things that genuinely do.
export const SIDEWAYS = '.recharts-brush, .pet-switcher, .about-carousel, input[type="range"], [data-no-swipe]'

// A layer with its own way out. Swiping behind it would navigate the screen
// underneath while the owner is still looking at the thing on top.
export const BLOCKING_LAYERS = '.modal-overlay, .home-tour-backdrop, .media-lightbox'

// A screen that pages itself. Where one of these is on screen it owns the
// horizontal swipe outright, so the back bar stands down rather than both
// answering the same gesture — which on a free account, where /assessment is
// a tab root, moved the question AND changed tab. The tab pager has since
// gone, but the stand-down stays: an assessment reached from anywhere else
// still has a back bar behind it.
export const OWN_PAGER = '.swipeable-wizard'

const TRAVEL_PX = 60
const MAX_MS = 800
// How far a finger has to travel before the page starts following it.
const DRAG_START_PX = 8

// `onLeft` is a swipe towards the left — forwards, the next page. `onRight`
// is the way back. Either may be omitted, and a null `enabled` takes the
// listeners off entirely.
//
// `onDragMove(dx)` and `onDragEnd(committed)` are for a caller that wants to
// SHOW the gesture rather than only act on it — Ash's instruction 24 Sep
// 2026: "show the scroll action rather than just static switching". The
// wizard moves the question under the finger with them. They fire only while
// the gesture is horizontal; the moment it turns into a vertical scroll the
// drag is cancelled and the page springs back, so the two gestures never
// fight.
export function useHorizontalSwipe({
  enabled = true,
  onLeft,
  onRight,
  onDragMove,
  onDragEnd,
  standDownForOwnPager = false,
}) {
  // Through a ref so that changing handlers — which is every render, since
  // they close over the current page — does not tear the listeners down and
  // put them back mid-gesture.
  const handlers = useRef({ onLeft, onRight, onDragMove, onDragEnd })
  handlers.current = { onLeft, onRight, onDragMove, onDragEnd }

  useEffect(() => {
    if (!enabled) return undefined

    let startX = null
    let startY = null
    let armed = false
    let startedAt = 0
    // Set once a gesture has proved itself horizontal, so a vertical scroll
    // that wanders sideways never starts dragging the page.
    let dragging = false

    function endDrag(committed) {
      if (!dragging) return
      dragging = false
      handlers.current.onDragEnd?.(committed)
    }

    function onTouchStart(event) {
      // Multi-touch is a pinch or a two-finger scroll, never a page turn.
      if (event.touches.length !== 1) {
        armed = false
        return
      }
      if (document.querySelector(BLOCKING_LAYERS)) {
        armed = false
        return
      }
      if (standDownForOwnPager && document.querySelector(OWN_PAGER)) {
        armed = false
        return
      }
      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      armed = !event.target?.closest?.(SIDEWAYS)
      startedAt = Date.now()
    }

    function onTouchMove(event) {
      if (!armed || startX == null || !handlers.current.onDragMove) return
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (!dragging) {
        // Nothing moves until the gesture is unambiguous: past a few pixels
        // and more sideways than up.
        if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) <= Math.abs(dy)) {
          // Decided it is a scroll — stand down for the rest of this touch.
          if (Math.abs(dy) > DRAG_START_PX && Math.abs(dy) > Math.abs(dx)) armed = false
          return
        }
        dragging = true
      }
      handlers.current.onDragMove(dx)
    }

    function onTouchCancel() {
      armed = false
      endDrag(false)
    }

    function onTouchEnd(event) {
      if (!armed || startX == null) { endDrag(false); return }
      armed = false
      const touch = event.changedTouches[0]
      const travelled = touch.clientX - startX
      const drifted = Math.abs(touch.clientY - startY)
      // Far enough, clearly horizontal, and not a slow drag that was really
      // an attempt to scroll. A drag that has already moved the page is
      // allowed to take its time — the finger is visibly holding it.
      const far = Math.abs(travelled) >= TRAVEL_PX
      const level = drifted < Math.abs(travelled)
      const quick = dragging || Date.now() - startedAt < MAX_MS
      if (!far || !level || !quick) {
        endDrag(false)
        return
      }

      endDrag(true)
      if (travelled < 0) handlers.current.onLeft?.()
      else handlers.current.onRight?.()
    }

    // Passive: nothing here calls preventDefault, so the browser keeps
    // scrolling at 60fps while the gesture is being watched.
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled, standDownForOwnPager])
}

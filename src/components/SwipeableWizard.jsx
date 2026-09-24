import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Btn from './Btn'
import { useHorizontalSwipe } from '../lib/swipeNav'
import { reduceMotion } from '../lib/motion'

// How the question moves. The page follows the finger, then either carries on
// off the screen or springs back — Ash's instruction 24 Sep 2026, "show the
// scroll action rather than just static switching".
const SPRING_MS = 200
const SETTLE_MS = 190
// A drag with nowhere to go — back from the first page, on a wizard with no
// way out — still moves, but only enough to say "there is nothing here".
const EDGE_RESISTANCE = 0.3

export default function SwipeableWizard({
  pages,
  onComplete,
  indicator = 'fraction',
  finishLabel = 'Finish',
  footer,
  // Content that belongs to ONE page but below the dots rather than above
  // them — an array parallel to `pages`, with holes for the pages
  // that have none. The assessment's source credits are the reason: they
  // belong to the intro page, but they are not part of the instructions and
  // should not push the buttons down the screen.
  pageFooters = [],
  initialPageIndex = 0,
  // Told to the caller whenever the page changes, so a half-finished
  // assessment can be saved with the page the owner was standing on rather
  // than one worked out afterwards from which answers are filled in.
  onPageChange,
  // What a backwards swipe on the FIRST page means — Ash's instruction
  // 24 Sep 2026. Without it the gesture simply died there: every other page
  // went back one and the first went nowhere, which reads as the swipe
  // having stopped working rather than as the wizard having a beginning.
  // The assessment hands this its own Exit confirmation, so the gesture does
  // exactly what the Exit button does.
  onExitFirstPage,
}) {
  const [rawPageIndex, setPageIndex] = useState(initialPageIndex)
  // Clamped, because a page set can SHRINK under the owner: a condition form
  // shows only the questions its current answers make relevant, so answering
  // one can remove a later page while somebody is standing on it. Without
  // this the wizard renders `undefined` — a blank card with a Next button
  // that goes nowhere.
  const pageIndex = Math.max(0, Math.min(rawPageIndex, pages.length - 1))

  useEffect(() => {
    onPageChange?.(pageIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex])
  const isLastPage = pageIndex === pages.length - 1

  // Per-page scroll offsets, captured whenever a page is left. Forward
  // navigation always lands at the top of the new page; only Back restores
  // where that specific page was scrolled to before the user moved on from
  // it — same mental model as a browser's own back button.
  const scrollPositions = useRef({})
  const nextScrollMode = useRef('top')

  // The element the questions live in. Moved directly, not through state: a
  // drag redraws on every touchmove, and re-rendering a whole assessment page
  // sixty times a second to move it 4px is how a swipe ends up feeling worse
  // than no swipe at all.
  const trackRef = useRef(null)
  // Which way the next page should come in from, set by whichever control
  // caused the change. 0 means "do not animate".
  const enterFrom = useRef(0)
  // Where the finger left the page, so a swipe hands over to the next page
  // mid-movement instead of restarting it: the incoming question is placed
  // exactly where the outgoing one's neighbour would have been, and carries
  // on from there. That continuity is the difference between a page that
  // slides and a page that blinks.
  const dragX = useRef(0)

  const still = reduceMotion()

  const setTrack = useCallback((x, ms) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${ms}ms linear` : 'none'
    track.style.transform = x ? `translateX(${x}px)` : ''
    // A page on its way out fades as it goes; one being dragged stays solid
    // until it is past the point of no return.
    track.style.opacity = Math.abs(x) > window.innerWidth * 0.6 ? '0' : '1'
  }, [])

  useLayoutEffect(() => {
    if (nextScrollMode.current === 'restore') {
      window.scrollTo(0, scrollPositions.current[pageIndex] ?? 0)
    } else {
      window.scrollTo(0, 0)
    }

    // The new page arrives from the side the old one left towards, then
    // settles. Laid out first with no transition so the browser never paints
    // it in its final position and then moves it.
    const from = enterFrom.current
    enterFrom.current = 0
    dragX.current = 0
    if (!from || still) {
      setTrack(0, 0)
      return
    }
    setTrack(from, 0)
    const frame = requestAnimationFrame(() => setTrack(0, SETTLE_MS))
    return () => cancelAnimationFrame(frame)
  }, [pageIndex, setTrack, still])

  function goNext() {
    if (isLastPage) {
      onComplete?.()
      return
    }
    scrollPositions.current[pageIndex] = window.scrollY
    nextScrollMode.current = 'top'
    // Forwards: this page leaves to the left, the next one comes in from the
    // right.
    enterFrom.current = still ? 0 : window.innerWidth + dragX.current
    // From the clamped index, not the stored one — they differ exactly when
    // the page set has shrunk, and stepping from the stored one would skip.
    setPageIndex(pageIndex + 1)
  }

  function goBack() {
    scrollPositions.current[pageIndex] = window.scrollY
    nextScrollMode.current = 'restore'
    enterFrom.current = still ? 0 : -window.innerWidth + dragX.current
    setPageIndex(Math.max(0, pageIndex - 1))
  }

  // Straight to a page, from its dot. Back and Next were removed on Ash's
  // instruction 24 Sep 2026 — the swipe is the way through, and the dots are
  // both the map and the control. They animate from the side the page
  // actually lies on, so tapping three dots along still reads as travel.
  function goTo(index) {
    if (index === pageIndex) return
    scrollPositions.current[pageIndex] = window.scrollY
    nextScrollMode.current = index < pageIndex ? 'restore' : 'top'
    enterFrom.current = still ? 0 : (index > pageIndex ? window.innerWidth : -window.innerWidth)
    setPageIndex(index)
  }

  // Horizontal swipe navigation, alongside (not instead of) the Back/Next
  // buttons below — the same goNext()/goBack(), so both do the same thing,
  // Finish-on-swipe on the last page included.
  //
  // On the window rather than on this element — Ash's report 24 Sep 2026
  // that it "still doesn't work unless it's done in the textbox". The
  // handlers were on the wizard's own box, so a swipe that began on the
  // screen's padding, beside the card or below the buttons began on nothing
  // at all. lib/swipeNav.js holds the one gesture the whole app uses.
  useHorizontalSwipe({
    onLeft: () => goNext(),
    onRight: () => (pageIndex === 0 ? onExitFirstPage?.() : goBack()),
    // The page under the finger. Resistance at either end, so a swipe with
    // nowhere to go feels like the edge of the wizard rather than a swipe
    // that did not register.
    onDragMove: still ? undefined : (dx) => {
      const blocked = (dx > 0 && pageIndex === 0 && !onExitFirstPage)
        || (dx < 0 && isLastPage && !onComplete)
      dragX.current = blocked ? 0 : dx
      setTrack(blocked ? dx * EDGE_RESISTANCE : dx, 0)
    },
    // Committed: carry it the rest of the way off screen, and the incoming
    // page takes over from the layout effect above. Not committed: spring
    // back to where it was.
    onDragEnd: still ? undefined : (committed) => {
      if (!committed) {
        dragX.current = 0
        setTrack(0, SPRING_MS)
      }
    },
  })

  return (
    <div className="swipeable-wizard">
      {indicator === 'dots' ? (
        <div className="swipeable-wizard-dots">
          {pages.map((_, i) => (
            <span key={i} className={`wizard-dot ${i === pageIndex ? 'active' : ''}`.trim()} />
          ))}
        </div>
      ) : (
        <div className="swipeable-wizard-progress">
          {pageIndex + 1} / {pages.length}
        </div>
      )}
      {/* The class stays: it is how the back bar knows a screen pages
          itself and stands down — see lib/swipeNav.js. */}
      <div className="swipeable-wizard-page" ref={trackRef}>
        {pages[pageIndex]}
      </div>
      {/* Dots under the question — Ash's instruction 24 Sep 2026, so the
          horizontal swipe is visible rather than something you have to be
          told about. The same affordance the About carousel uses. Smaller
          and wrapped, because an assessment has seventeen of them where a
          carousel has four, and they are a signpost rather than a control:
          tapping one goes to that question. */}
      {pages.length > 1 && (
        <div className="swipeable-wizard-dots under">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`wizard-dot ${i === pageIndex ? 'active' : ''}`.trim()}
              aria-label={`Question ${i + 1} of ${pages.length}`}
              aria-current={i === pageIndex ? 'step' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
      {/* Only the one button that is not navigation. Back and Next went on
          Ash's instruction 24 Sep 2026 — swiping moves between questions and
          the dots say where you are — but finishing is a decision, and a
          decision needs something to press. */}
      {isLastPage && (
        <div className="swipeable-wizard-nav">
          <Btn type="button" className="btn-block" onClick={goNext}>{finishLabel}</Btn>
        </div>
      )}
      {pageFooters[pageIndex] ?? null}
      {footer}
    </div>
  )
}

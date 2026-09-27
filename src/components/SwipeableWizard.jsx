import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Btn from './Btn'
import { useHorizontalSwipe } from '../lib/swipeNav'
import { reduceMotion } from '../lib/motion'

// How the question moves. The page follows the finger, then either carries on
// off the screen or springs back — Ash's instruction 24 Sep 2026, "show the
// scroll action rather than just static switching".
// Easing and timings. The settle is the long one because it is the movement
// the eye follows all the way; the spring back is shorter, because nothing
// happened and lingering over it makes the wizard feel reluctant.
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
// The card's height changes with the question, and the curve that suits a
// slide is too eager for a box growing under someone's hands: the first
// frame of the quintic covers a third of the distance, which reads as a
// snap. This one starts gently.
const HEIGHT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SPRING_MS = 240
const SETTLE_MS = 260
// The floor for a slide that only has a little way left to go.
const MIN_SETTLE_MS = 140
// The gap between one question and the next while they are both on screen.
const GUTTER_PX = 24
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

  // Every question opens at its top, and the trip up there is never shown.
  //
  // Ash's report 25 Sep 2026: moving between questions "jolts to the top each
  // time". The scroll reset was correct and its TIMING was wrong — it landed
  // at the end of the sideways slide, so the eye saw the page move across and
  // then the whole document snap upwards.
  //
  // What fixes it is not scrolling later or less, but putting the incoming
  // question where it is going to end up BEFORE it is visible. A neighbour is
  // absolutely positioned inside the track at top: 0, which is the top of the
  // question you are currently reading — so when the document is scrolled down
  // 300px, the neighbour that slides in is showing its middle. Offsetting it
  // by exactly the scroll position puts its top under the viewport's top
  // instead. It slides in already at the top; the reset that follows the swap
  // then moves nothing on screen, because the page is already there.
  //
  // Per-page scroll offsets were kept here until now, so Back returned each
  // question to where it had been left. That is gone on the same instruction:
  // every page opens at the top, whichever way it was reached.
  //
  // The one thing this cannot do is lengthen the card while it borrows the
  // offset, so on a question TALLER than the one it replaces the last of it
  // can be clipped for the length of the slide. Deliberate: questions are
  // built to fit the screen, which is the case where the offset is zero and
  // none of this happens at all.
  const setNeighbourOffset = useCallback((y) => {
    const track = trackRef.current
    if (!track) return
    for (const neighbour of track.querySelectorAll('.wizard-neighbour')) {
      neighbour.style.top = y ? `${y}px` : ''
    }
  }, [])

  const still = reduceMotion()

  // The width one page travels to become the next: the viewport plus the gap
  // between them.
  const stepWidth = () => (trackRef.current?.offsetWidth ?? window.innerWidth) + GUTTER_PX

  // The last offset a drag asked for, and the frame that will write it.
  // Ash's report 24 Sep 2026 that the carousel was not smooth: a touchmove
  // can fire more often than the screen refreshes, and every call here wrote
  // a style — so the browser was recalculating and compositing several times
  // for one painted frame. Now the finger updates a number and one
  // requestAnimationFrame writes it, which is the most the display can show.
  const pendingX = useRef(null)
  const frameRef = useRef(0)

  const writeTrack = useCallback((x, ms) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none'
    track.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
  }, [])

  // Drops a drag write that has been queued but not yet painted. Anything
  // that writes the track itself MUST call this first: a frame left over
  // from the last touchmove lands after it and puts the page back where the
  // finger was, with `transition: none` — which cancels the slide before it
  // starts. That was the glitch on landing (Ash, 24 Sep 2026): the page did
  // not animate at all, it sat where it was let go and then jumped.
  const cancelPendingWrite = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    pendingX.current = null
  }, [])

  const setTrack = useCallback((x, ms) => {
    // An animation (a settle, a spring back) is written immediately: it is
    // one write, and it has to land before the transition can start.
    if (ms) {
      cancelPendingWrite()
      writeTrack(x, ms)
      return
    }
    pendingX.current = x
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      if (pendingX.current != null) writeTrack(pendingX.current, 0)
    })
  }, [writeTrack, cancelPendingWrite])

  // Promoted to its own compositor layer for the length of the gesture only.
  // Permanently promoted, it would become the containing block for every
  // `position: fixed` modal inside it; not promoted at all, each frame of the
  // drag repaints the questions rather than just moving them.
  const setLifted = useCallback((on) => {
    const track = trackRef.current
    if (!track) return
    track.style.willChange = on ? 'transform' : ''
    track.classList.toggle('is-moving', on)
  }, [])

  useLayoutEffect(() => {
    // Both in the same frame, before the browser paints: the page that has
    // just become the middle one sits at the top of the track, and the
    // document goes to the top to match. Nothing appears to move.
    window.scrollTo(0, 0)
    setNeighbourOffset(0)

    // The page that was the neighbour is now the middle one, so the track
    // goes back to zero with no animation: it has already travelled.
    enterFrom.current = 0
    dragX.current = 0
    // Written straight to the element, NOT through the frame-batched path:
    // this runs in a layout effect, before the browser paints the swapped
    // page, and a deferred write would leave the new question drawn one
    // screen off to the side for a frame. That single frame was the flash on
    // landing (Ash, 24 Sep 2026).
    cancelPendingWrite()
    // The pinned height goes with the transform: the incoming page is the
    // page in flow now, and it can size the card itself.
    if (trackRef.current) trackRef.current.style.height = ''
    writeTrack(0, 0)
    setLifted(false)
  }, [pageIndex, writeTrack, cancelPendingWrite, setLifted, setNeighbourOffset])

  // One move, however it was asked for. The track finishes the slide to
  // where the neighbour already is, and only then does the index change —
  // which is why the question never jumps: the page you watched arrive IS
  // the page you end up on.
  //
  // Ash's report 24 Sep 2026 that landing on the next page glitched. Three
  // things were wrong with the first version, and all three showed up in the
  // last few pixels:
  //
  //   1. The swap was on a TIMER. A transition starts on the next frame, so
  //      the timer always expired a frame or two early and the page changed
  //      while the track was still a few pixels short of home. It waits for
  //      the browser to say the transition has ended now.
  //   2. The card's HEIGHT jumped. A neighbour is positioned out of flow, so
  //      it adds nothing to the height — and the moment it became the middle
  //      page the card snapped to its height. The height is now animated
  //      alongside the slide, so the card grows or shrinks as the question
  //      arrives.
  //   3. The duration was fixed. Releasing a swipe 80% of the way across
  //      still took the full 260ms for the last 20%, which reads as the page
  //      hesitating before it lands. It is now proportional to what is left.
  const settleTimer = useRef(null)
  const settleDone = useRef(null)

  function finishSettle() {
    clearTimeout(settleTimer.current)
    const done = settleDone.current
    settleDone.current = null
    if (done) done()
  }

  function moveTo(index) {
    if (index === pageIndex || index < 0 || index > pages.length - 1) return
    // A move asked for while one is still running: finish that one first, so
    // two swipes in quick succession queue up rather than fight.
    finishSettle()
    // Before the slide starts, so the question that arrives is already at its
    // top — see setNeighbourOffset. A tap on Next needs this as much as a
    // swipe does: the jolt was never about which control asked.
    setNeighbourOffset(window.scrollY)
    const track = trackRef.current
    const neighbouring = Math.abs(index - pageIndex) === 1
    if (still || !neighbouring || !track) {
      // A jump of more than one page has no neighbour to slide to, so it
      // simply changes. Same for reduced motion.
      setPageIndex(index)
      return
    }

    cancelPendingWrite()
    const forward = index > pageIndex
    const target = forward ? -stepWidth() : stepWidth()
    const remaining = Math.abs(target - dragX.current)
    const ms = Math.round(
      Math.min(SETTLE_MS, Math.max(MIN_SETTLE_MS, (remaining / Math.abs(target || 1)) * SETTLE_MS)),
    )

    // Height, measured before anything moves: where the card is now, and
    // where it has to be when the incoming question is the one in flow.
    const incoming = track.querySelector(forward ? '.wizard-neighbour.is-next' : '.wizard-neighbour.is-prev')
    const fromHeight = track.offsetHeight
    const toHeight = incoming?.offsetHeight ?? fromHeight
    if (toHeight !== fromHeight) {
      track.style.height = `${fromHeight}px`
      // Read, so the browser takes the starting height as a fact before the
      // transition is declared. Without it both heights land in one style
      // recalculation and nothing animates.
      void track.offsetHeight
    }

    track.style.transition = `transform ${ms}ms ${EASE}, height ${ms}ms ${HEIGHT_EASE}`
    track.style.transform = `translate3d(${target}px, 0, 0)`
    if (toHeight !== fromHeight) track.style.height = `${toHeight}px`

    const land = () => {
      track.removeEventListener('transitionend', onEnd)
      setPageIndex(index)
    }
    function onEnd(event) {
      // Only the slide itself. The height finishes at the same moment and
      // would otherwise land the page twice.
      if (event.target !== track || event.propertyName !== 'transform') return
      finishSettle()
    }
    settleDone.current = land
    track.addEventListener('transitionend', onEnd)
    // A transition that never reports back — an element hidden mid-gesture,
    // a tab sent to the background — must not leave the wizard stuck.
    settleTimer.current = setTimeout(finishSettle, ms + 120)
  }

  useEffect(() => () => {
    clearTimeout(settleTimer.current)
    cancelAnimationFrame(frameRef.current)
  }, [])

  function goNext() {
    if (isLastPage) {
      onComplete?.()
      return
    }
    moveTo(pageIndex + 1)
  }

  function goBack() {
    moveTo(pageIndex - 1)
  }

  // Straight to a page, from its dot.
  function goTo(index) {
    moveTo(index)
  }

  // Auto-advance lived here from 24 Sep to 27 Sep 2026: a page marked
  // `data-auto-advance` turned itself as soon as an answer was tapped, after
  // a 340ms pause and with a guard for alerts and modals.
  //
  // Removed on Ash's instruction. It was added to save taps on seventeen
  // questions, and Back and Next returning on 27 Sep solved that better: the
  // page now moves when the owner says so, whichever control they use. An
  // assessment that turns its own page also takes the answer away before it
  // can be reconsidered, which on questions about a sick animal is the wrong
  // trade — and on the BEAAAAPP pages, where the options carry illustrations,
  // it moved on before the picture had been looked at.

  // Horizontal swipe navigation, alongside (not instead of) the Back/Next
  // buttons below — the same goNext()/goBack() for every page turn.
  //
  // With ONE deliberate exception: a swipe never finishes the questionnaire.
  // Ash's instruction 27 Sep 2026. Saving is a decision and a decision has to
  // be pressed — a gesture made to see what is on the next page should not be
  // able to commit a check-in, and on the last page there is no next page to
  // be looking for. The drag still resists and springs back there, so the
  // gesture reads as the end of the wizard rather than as one that failed.
  //
  // On the window rather than on this element — Ash's report 24 Sep 2026
  // that it "still doesn't work unless it's done in the textbox". The
  // handlers were on the wizard's own box, so a swipe that began on the
  // screen's padding, beside the card or below the buttons began on nothing
  // at all. lib/swipeNav.js holds the one gesture the whole app uses.
  useHorizontalSwipe({
    onLeft: () => {
      // Never Finish. See the note above.
      if (isLastPage) return
      goNext()
    },
    onRight: () => (pageIndex === 0 ? onExitFirstPage?.() : goBack()),
    // The page under the finger. Resistance at either end, so a swipe with
    // nowhere to go feels like the edge of the wizard rather than a swipe
    // that did not register.
    onDragMove: still ? undefined : (dx) => {
      // Resistance only where there is genuinely nothing beside this page.
      const atStart = dx > 0 && pageIndex === 0
      const atEnd = dx < 0 && isLastPage
      const blocked = atStart || atEnd
      if (dragX.current === 0 && !blocked) {
        setLifted(true)
        // The neighbour is about to come into view, so it needs its offset
        // now rather than at the end of the gesture — the whole point is that
        // it is never SEEN anywhere but at its top.
        setNeighbourOffset(window.scrollY)
      }
      dragX.current = blocked ? 0 : dx
      setTrack(blocked ? dx * EDGE_RESISTANCE : dx, 0)
    },
    // Committed: carry it the rest of the way off screen, and the incoming
    // page takes over from the layout effect above. Not committed: spring
    // back to where it was.
    onDragEnd: still ? undefined : (committed) => {
      // A drag that was RESISTED changes no page, so the track has to be put
      // back whether or not it travelled far enough to count as committed.
      // dragX stays at 0 through such a drag (see onDragMove), which is what
      // distinguishes it from one that genuinely moved the page. Before the
      // last page stopped finishing on a swipe this could not happen: the
      // committed case always navigated away and took the offset with it.
      if (dragX.current === 0) {
        setTrack(0, SPRING_MS)
        window.setTimeout(() => setLifted(false), SPRING_MS)
        return
      }
      if (!committed) {
        dragX.current = 0
        setTrack(0, SPRING_MS)
        window.setTimeout(() => {
          setLifted(false)
          // Nothing changed page, so the borrowed offset goes back: the next
          // gesture takes the scroll position as it is then.
          setNeighbourOffset(0)
        }, SPRING_MS)
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
      {/* The question, with its neighbours waiting either side of it — Ash's
          instruction 24 Sep 2026, so a swipe pulls the next question in
          rather than replacing this one when you let go.
          
          The neighbours are positioned absolutely, so they add nothing to the
          card's height, and `inert` keeps them out of the tab order, off the
          screen reader and deaf to stray taps: they are a picture of what is
          coming, not a second copy of the form.
          
          The class stays on the middle one: it is how the back bar knows a
          screen pages itself and stands down — see lib/swipeNav.js. */}
      <div className="swipeable-wizard-page" ref={trackRef}>
        {pageIndex > 0 && (
          <div className="wizard-neighbour is-prev" inert="" aria-hidden="true">
            {pages[pageIndex - 1]}
          </div>
        )}
        {pages[pageIndex]}
        {pageIndex < pages.length - 1 && (
          <div className="wizard-neighbour is-next" inert="" aria-hidden="true">
            {pages[pageIndex + 1]}
          </div>
        )}
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
      {/* Back and Next, restored on Ash's instruction 25 Sep 2026.
          
          They were removed on 24 Sep in favour of the swipe and the dots. The
          swipe stays and is still the quick way through — but a gesture is
          only discoverable once you have made it, and the dots say where you
          are rather than offering a way on. So the buttons are back, doing
          exactly what the swipe does, and landing at the top of the question
          as a tap should.
          
          Back is absent on the first page rather than disabled: on the
          assessment a backwards move from page one is Exit, which is the
          wizard's own confirmation and does not belong on a Next row. */}
      <div className="swipeable-wizard-nav">
        {pageIndex > 0 && (
          <Btn type="button" variant="outline" onClick={() => goBack()}>Back</Btn>
        )}
        <Btn type="button" onClick={() => goNext()}>
          {isLastPage ? finishLabel : 'Next'}
        </Btn>
      </div>
      {pageFooters[pageIndex] ?? null}
      {footer}
    </div>
  )
}

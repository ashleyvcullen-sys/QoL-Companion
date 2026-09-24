import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import Card from './Card'
import Btn from './Btn'

const SPOTLIGHT_PADDING = 8
const TOOLTIP_GAP = 14
// How close to the top of the screen the card may sit. Below this it is
// under the notch.
const TOOLTIP_MIN_TOP = 56

export default function HomeTour({ steps, targetRefs, onFinish }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  // The card's real height, measured after it renders. It used to be guessed
  // at 160px, which was roughly right when every step pointed at a tile in
  // the middle of the screen and wrong once the steps pointed at the tab bar:
  // a taller card placed 160px above a target 60px from the bottom ended up
  // pinned to the bottom of the screen — Ash's report, 24 Sep 2026.
  const cardRef = useRef(null)
  const [cardHeight, setCardHeight] = useState(0)

  const isCompletionStep = stepIndex >= steps.length
  const step = steps[stepIndex]

  // Each step shows the screen it is describing. Done before the target is
  // measured, so the spotlight lands on the tab of a screen that is already
  // on show rather than on the one the owner just left.
  //
  // Three things here are deliberate, all of them from Ash's report 24 Sep
  // 2026 that logging in died with "replaceState() more than 100 times per
  // 10 seconds":
  //
  //   The dependency is the PATH, a string, not the step object. The steps
  //   array was rebuilt on every render, so this effect ran on every render.
  //   Asked for once per step and per landing place.
  //
  //   The current path comes from the router, not from
  //   window.location.pathname, which is not where a router keeps its
  //   position in every configuration.
  //
  //   `replace`, and only once per destination: if something else on the
  //   screen disagrees about where the app should be — a route guard, say —
  //   the two must not be able to push each other back and forth for ever.
  const askedFor = useRef(null)
  useLayoutEffect(() => {
    const show = isCompletionStep ? null : step?.show
    if (!show) return
    if (pathname === show) {
      askedFor.current = null
      return
    }
    if (askedFor.current === show) return
    askedFor.current = show
    navigate(show, { replace: true })
  }, [isCompletionStep, step?.show, pathname, navigate])

  useLayoutEffect(() => {
    if (isCompletionStep) {
      setRect(null)
      return
    }

    // Tiles register themselves in targetRefs; the tab bar is rendered
    // outside this screen entirely, so its tabs are found by attribute.
    const key = step.target ?? step.to
    const target =
      targetRefs?.current?.[key] ?? document.querySelector(`[data-tour-target="${key}"]`)
    // Without this the previous step's spotlight stayed on screen under the
    // next step's text, pointing at the wrong thing.
    if (!target) {
      setRect(null)
      return
    }

    function measure() {
      setRect(target.getBoundingClientRect())
    }

    measure()
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const settleTimeout = setTimeout(measure, 400)

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      clearTimeout(settleTimeout)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [stepIndex, isCompletionStep, step, targetRefs])

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return undefined
    const measure = () => setCardHeight(card.getBoundingClientRect().height)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    // The card changes height between steps — some messages are three lines,
    // some are six — and again if the system font size changes.
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    return () => observer.disconnect()
  }, [stepIndex])

  function goNext() {
    setStepIndex((i) => i + 1)
  }

  const spotlightStyle = rect && {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  }

  // Below the spotlight if the card fits there, above it if not, and clamped
  // to the screen either way. Measured, not estimated, so the card sits the
  // same distance from what it is pointing at whatever it says.
  const tooltipStyle = (() => {
    if (!rect) return { top: '50%', transform: 'translateY(-50%)' }
    const viewport = window.innerHeight
    const height = cardHeight || 160

    const below = rect.bottom + TOOLTIP_GAP
    if (below + height + TOOLTIP_GAP <= viewport) return { top: below }

    const above = rect.top - TOOLTIP_GAP - height
    if (above >= TOOLTIP_MIN_TOP) return { top: above }

    // Neither side has room — a spotlight taller than the space around it.
    // Sit as high as the screen allows rather than sliding off the bottom.
    return { top: TOOLTIP_MIN_TOP }
  })()

  return (
    <div className="home-tour-backdrop">
      {spotlightStyle ? (
        <div className="home-tour-spotlight" style={spotlightStyle} />
      ) : (
        <div className="home-tour-backdrop-dim" />
      )}

      <Card ref={cardRef} className="home-tour-card" style={tooltipStyle}>
        {isCompletionStep ? (
          <>
            <p className="home-tour-title">You're all set!</p>
            {/* APPROVED — Dr Ash Cullen (BSc, DVM), 23 Sep 2026. */}
            <p>You can replay this tour any time from More.</p>
            <Btn type="button" className="btn-block" onClick={onFinish}>Done</Btn>
          </>
        ) : (
          <>
            <p className="home-tour-progress">{stepIndex + 1} of {steps.length}</p>
            {/* Named, not hidden. The step stays in the tour and keeps its
                full description — someone deciding whether the app is worth
                paying for has to see what it does. This only stops them
                finishing the tour believing it is all included.
                The same lock glyph the locked tiles wear, so it reads as the
                same fact rather than a second idea. Shown on the same
                condition as those tiles: a subscriber already has these and
                does not need telling. */}
            {step.premium && (
              <p className="premium-tag">
                <Lock size={11} strokeWidth={2.5} aria-hidden="true" />
                Premium
              </p>
            )}
            <p>{step.message}</p>
            <div className="home-tour-actions">
              <button type="button" className="home-tour-skip" onClick={onFinish}>Skip Tour</button>
              <Btn type="button" onClick={goNext}>Next</Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

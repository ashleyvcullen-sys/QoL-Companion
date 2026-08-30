import { useLayoutEffect, useState } from 'react'
import Card from './Card'
import Btn from './Btn'

const SPOTLIGHT_PADDING = 8
const TOOLTIP_GAP = 12
const TOOLTIP_ESTIMATE_HEIGHT = 160
// Generous placeholder just for deciding whether the "place above" branch
// would land too close to the top to be worth it — the actual fallback
// below is exact, via env(), not this number.
const TOOLTIP_MIN_TOP_ESTIMATE = 80

export default function HomeTour({ steps, targetRefs, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)

  const isCompletionStep = stepIndex >= steps.length
  const step = steps[stepIndex]

  useLayoutEffect(() => {
    if (isCompletionStep) {
      setRect(null)
      return
    }

    const target = targetRefs.current[step.to]
    if (!target) return

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

  function goNext() {
    setStepIndex((i) => i + 1)
  }

  const spotlightStyle = rect && {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  }

  const tooltipStyle = rect
    ? rect.bottom + TOOLTIP_ESTIMATE_HEIGHT < window.innerHeight
      ? { top: rect.bottom + TOOLTIP_GAP }
      : rect.top - TOOLTIP_ESTIMATE_HEIGHT > TOOLTIP_MIN_TOP_ESTIMATE
        ? { top: rect.top - TOOLTIP_ESTIMATE_HEIGHT }
        // Placing above would land too close to the top to trust a raw
        // pixel guess — this position is fixed (not inside .screen's
        // padded box), so it needs its own safe-area clamp rather than
        // inheriting one from a container.
        : { top: 'max(16px, calc(env(safe-area-inset-top) + 12px))' }
    : { top: '50%', transform: 'translateY(-50%)' }

  return (
    <div className="home-tour-backdrop">
      {spotlightStyle ? (
        <div className="home-tour-spotlight" style={spotlightStyle} />
      ) : (
        <div className="home-tour-backdrop-dim" />
      )}

      <Card className="home-tour-card" style={tooltipStyle}>
        {isCompletionStep ? (
          <>
            <p className="home-tour-title">You're all set!</p>
            <p>You can replay this tour any time from the footer.</p>
            <Btn type="button" className="btn-block" onClick={onFinish}>Done</Btn>
          </>
        ) : (
          <>
            <p className="home-tour-progress">{stepIndex + 1} of {steps.length}</p>
            <p>{step.message}</p>
            <div className="home-tour-actions">
              <button type="button" className="home-tour-skip" onClick={onFinish}>Skip tour</button>
              <Btn type="button" onClick={goNext}>Next</Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

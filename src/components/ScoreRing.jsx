// The quality of life score as a ring.
//
// Lifted out of PetSummaryCard on 4 Sep 2026 so Trends can show the same one
// at the top of it — the home screen and Trends should not draw the app's
// central number two different ways.


import { useEffect, useRef, useState } from 'react'

// How long the ring takes to fill, and the number to count up to it.
const SWEEP_MS = 850

// Honours the system setting. Someone who has asked their phone to stop
// animating things has asked this too.
function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The score, as a ring rather than a number on its own.
//
// A number says 68%; a ring says 68% of what, at a glance and without being
// read. Drawn rather than charted — one circle needs no library, and the
// chart library's smallest useful unit is heavier than this whole card.
export default function ScoreRing({ percent, colour, size = 64, centre = null }) {
  // The ring sweeps up to the score and the number counts with it — Ash's
  // instruction 23 Sep 2026. It is the app's central number, and arriving
  // fully drawn gives the owner nothing to watch; filling makes the same fact
  // land as a measurement being taken.
  //
  // requestAnimationFrame rather than a CSS transition on strokeDasharray,
  // because the NUMBER has to count with the ring — two animations of the
  // same value driven by two different clocks drift visibly at this duration.
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? percent : 0))
  const frameRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(percent)
      return undefined
    }

    const from = 0
    const started = performance.now()

    function step(now) {
      const progress = Math.min(1, (now - started) / SWEEP_MS)
      // Ease out: fast at the start, settling into the final number rather
      // than stopping dead on it.
      const eased = 1 - (1 - progress) ** 3
      setShown(Math.round(from + (percent - from) * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [percent])

  // Drawn in a fixed 64-unit viewBox and scaled by `size`, so the stroke and
  // the gap keep their proportions at any diameter rather than needing a
  // second set of numbers per size.
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const filled = Math.max(0, Math.min(100, shown)) / 100

  return (
    <span
      className="pet-summary-ring"
      role="img"
      aria-label={`Quality of life ${percent}%`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      {/* With something in the middle — the pet's own photo on the home card
          — the number moves out from under it and is drawn by the caller
          beneath the ring. Ash's instruction 24 Sep 2026.

          The label on the wrapper carries the real figure either way, so a
          screen reader is never read a half-finished animation. */}
      {centre
        ? <span className="pet-summary-ring-centre">{centre}</span>
        : <span className="pet-summary-ring-value" style={{ color: colour }} aria-hidden="true">{shown}%</span>}
    </span>
  )
}

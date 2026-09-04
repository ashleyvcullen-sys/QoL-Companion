// The quality of life score as a ring.
//
// Lifted out of PetSummaryCard on 4 Sep 2026 so Trends can show the same one
// at the top of it — the home screen and Trends should not draw the app's
// central number two different ways.


// The score, as a ring rather than a number on its own.
//
// A number says 68%; a ring says 68% of what, at a glance and without being
// read. Drawn rather than charted — one circle needs no library, and the
// chart library's smallest useful unit is heavier than this whole card.
export default function ScoreRing({ percent, colour, size = 64 }) {
  // Drawn in a fixed 64-unit viewBox and scaled by `size`, so the stroke and
  // the gap keep their proportions at any diameter rather than needing a
  // second set of numbers per size.
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const filled = Math.max(0, Math.min(100, percent)) / 100

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
      <span className="pet-summary-ring-value" style={{ color: colour }}>{percent}%</span>
    </span>
  )
}

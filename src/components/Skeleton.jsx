// Placeholder shapes for content that is on its way.
//
// Ash's instruction 23 Sep 2026, replacing a bare "Loading…" on the data
// screens. The word reads as a stall — the screen has stopped and is telling
// you so. Shapes read as the screen already being there, with the numbers
// still arriving, which is both truer and shorter to wait through.
//
// Deliberately plain: grey bars at the sizes the real content will take, no
// spinner. A spinner is a second thing moving on a screen that is about to
// redraw anyway.
export default function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="skeleton-line"
          // Ragged ends, like real text. Every bar the same width reads as a
          // graphic rather than as content.
          style={{ width: `${[100, 82, 91, 74, 96][index % 5]}%` }}
        />
      ))}
    </div>
  )
}

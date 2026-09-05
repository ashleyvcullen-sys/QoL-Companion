const OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All time' },
]

// Month or all time, once per screen.
//
// Ash's instruction 4 Sep 2026. One control rather than one per chart: a
// screen carrying a calendar and three graphs was four separate ways of
// asking the same question, and the answer an owner wants is about the
// screen — "show me the whole record" — not about a particular picture on it.
//
// Defaults to Month. The daily question is "how is she today", and someone
// opening the app to log an entry should not have to narrow a year first.
//
// "Month" and "All time" — APPROVED — Dr Ash Cullen (BSc, DVM), 5 Sep 2026.
export default function RangeToggle({ value, onChange, className = '' }) {
  return (
    <div className={`range-toggle ${className}`.trim()} role="group" aria-label="How much history to show">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`range-toggle-option ${value === option.value ? 'selected' : ''}`.trim()}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

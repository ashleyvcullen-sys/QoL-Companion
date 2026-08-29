import TrendLineChart from './TrendLineChart'
import MonthCalendar from './MonthCalendar'
import { SEVERITY_KEY_ITEMS } from '../lib/charts'

// Draws one descriptor from lib/charts.js.
//
// The point of this component is that the screen and the PDF capture render
// a chart through the SAME code path. They used to build their own props, and
// the report's copy quietly dropped event markers, the threshold label and
// the caption — so the vet was reading a different chart to the owner. The
// only things a caller may vary now are the two that genuinely differ between
// a screen and a screenshot: the brush (useless in a static image) and the
// entry animation (which would capture mid-flight).
export default function ChartView({
  chart,
  brush = true,
  isAnimationActive = true,
  showCaption = true,
  // Given only by the screens that can answer "what was answered that day?".
  // The PDF capture passes nothing, so the report never renders a button
  // nobody can press.
  onOpenDay,
}) {
  if (!chart) return null

  const caption = showCaption && chart.caption
    ? <p className="assessment-hint">{chart.caption}</p>
    : null

  // What the colours mean. Only the calendars carry it — a line chart draws
  // one line in one colour, and a green/amber/red key under it would be
  // explaining something that isn't there.
  //
  // A chart may supply its own wording. Seizures does: "good day" and "bad
  // day" are the right words for an overall quality of life calendar and the
  // wrong ones for an epilepsy log, where green means a specific thing —
  // no seizure — rather than a generally decent day.
  const severityKey = chart.severityKey
    ? (
      <p className="chart-key chart-severity-key">
        {(chart.severityKeyItems ?? SEVERITY_KEY_ITEMS).map((item) => (
          <span key={item.label} className="chart-severity-item">
            <span className="chart-severity-swatch" style={{ background: item.colour }} />
            {item.label}
          </span>
        ))}
      </p>
    )
    : null

  // Above the chart rather than below: on the good/bad days calendar this is
  // what the reader is looking FOR, and a footnote arrives after they have
  // already decided what they were looking at.
  const intro = chart.intro
    ? <p className="assessment-hint chart-intro">{chart.intro}</p>
    : null

  if (chart.kind === 'calendar') {
    return (
      <>
        {intro}
        <MonthCalendar dayFor={chart.dayFor} onOpenDay={onOpenDay} />
        {severityKey}
        {caption}
      </>
    )
  }

  return (
    <>
      <TrendLineChart
        data={chart.data}
        dataKey={chart.dataKey}
        color={chart.colour}
        height={chart.height}
        domain={chart.domain}
        unit={chart.unit}
        referenceValue={chart.threshold}
        referenceLabel={chart.thresholdLabel}
        band={chart.band}
        markers={chart.markers ?? []}
        brush={brush}
        isAnimationActive={isAnimationActive}
      />
      {caption}
    </>
  )
}

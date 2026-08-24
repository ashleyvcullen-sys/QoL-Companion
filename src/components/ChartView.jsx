import TrendLineChart from './TrendLineChart'
import MonthCalendar from './MonthCalendar'

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
}) {
  if (!chart) return null

  const caption = showCaption && chart.caption
    ? <p className="assessment-hint">{chart.caption}</p>
    : null

  if (chart.kind === 'calendar') {
    return (
      <>
        <MonthCalendar dayFor={chart.dayFor} />
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
        markers={chart.markers ?? []}
        brush={brush}
        isAnimationActive={isAnimationActive}
      />
      {caption}
    </>
  )
}

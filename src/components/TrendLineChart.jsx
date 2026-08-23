import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, ReferenceLine } from 'recharts'

const DEFAULT_VISIBLE_DAYS = 14
const BRUSH_HEIGHT = 24

export default function TrendLineChart({ data, dataKey, color, height, domain, unit, referenceValue, referenceLabel, markers = [], isAnimationActive = true, brush = false }) {
  const containerHeight = brush ? height + BRUSH_HEIGHT + 10 : height

  return (
    <ResponsiveContainer width="100%" height={containerHeight}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F5DFE4" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={domain} tick={{ fontSize: 11 }} />
        <Tooltip />
        {/* A threshold drawn on the chart rather than left in the caption —
            "is today above the line?" is the question being asked, and it
            shouldn't require holding a number in your head. */}
        {/* Event markers. A rate climbing for a week reads differently when
            a diuretic was stopped four days ago, so the events sit on the
            chart rather than in a list somewhere else. Only drawn for dates
            the series actually contains — recharts can't place a vertical
            line on an x value that isn't in the data. */}
        {markers.map((marker) => (
          <ReferenceLine
            key={`${marker.date}-${marker.label}`}
            x={marker.date}
            stroke={marker.colour ?? '#8A5C6F'}
            strokeDasharray="3 3"
            label={{ value: marker.short ?? '', position: 'top', fontSize: 10, fill: marker.colour ?? '#8A5C6F' }}
          />
        ))}
        {referenceValue != null && (
          <ReferenceLine
            y={referenceValue}
            stroke="#A33A2E"
            strokeDasharray="4 4"
            label={referenceLabel ? { value: referenceLabel, position: 'insideTopRight', fontSize: 11, fill: '#A33A2E' } : undefined}
          />
        )}
        <Line
          type="monotone"
          dataKey={dataKey}
          unit={unit}
          stroke={color}
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={isAnimationActive}
        />
        {brush && (
          <Brush
            dataKey="date"
            height={BRUSH_HEIGHT}
            stroke={color}
            travellerWidth={8}
            startIndex={Math.max(0, data.length - DEFAULT_VISIBLE_DAYS)}
            endIndex={Math.max(0, data.length - 1)}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

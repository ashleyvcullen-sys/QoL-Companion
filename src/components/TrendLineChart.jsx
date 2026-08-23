import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts'

const DEFAULT_VISIBLE_DAYS = 14
const BRUSH_HEIGHT = 24

export default function TrendLineChart({ data, dataKey, color, height, domain, unit, isAnimationActive = true, brush = false }) {
  const containerHeight = brush ? height + BRUSH_HEIGHT + 10 : height

  return (
    <ResponsiveContainer width="100%" height={containerHeight}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F5DFE4" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={domain} tick={{ fontSize: 11 }} />
        <Tooltip />
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

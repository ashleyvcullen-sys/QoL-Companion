import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, ReferenceArea, ReferenceLine } from 'recharts'
import { formatDateDDMM, formatDateDDMMYY } from '../lib/formatDate'

// Points, not days — the series holds one row per LOGGED day, so this window
// is the last fourteen check-ins whatever cadence the pet is on. It was
// called DEFAULT_VISIBLE_DAYS until 5 Sep 2026, which described neither what
// it counts nor what it does; the behaviour is unchanged.
const DEFAULT_VISIBLE_POINTS = 14
const BRUSH_HEIGHT = 24

export default function TrendLineChart({ data, dataKey, color, height, domain, unit, referenceValue, referenceLabel, band = null, markers = [], isAnimationActive = true, brush = false, allTime = false }) {
  const containerHeight = brush ? height + BRUSH_HEIGHT + 10 : height

  return (
    <ResponsiveContainer width="100%" height={containerHeight}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F5DFE4" />
        {/* The axis printed the stored ISO string until 4 Sep 2026 —
            "2026-09-03" under every tick, which is the one date format
            nobody in the app is shown anywhere else. Day and month here,
            because fourteen ticks on a phone cannot each carry a year; the
            tooltip gives the full date for whichever point is tapped. */}
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateDDMM} />
        <YAxis domain={domain} tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={formatDateDDMMYY} />
        {/* A healthy band, drawn behind everything else.
            
            A threshold line answers "am I above the line?". A band answers
            "am I inside it?", which is the question body condition actually
            asks — 4 and 5 are ideal and BOTH directions away from that are
            worse, so a single line cannot say it. Declared before the Line so
            it paints underneath rather than over the data.
            
            `ifOverflow="extendDomain"` is deliberately NOT set: the band is
            only meaningful inside the fixed 1–9 axis, and letting it stretch
            the domain would move the axis to fit the band. */}
        {band && (
          <ReferenceArea
            y1={band.from}
            y2={band.to}
            fill={band.colour ?? '#3D8259'}
            fillOpacity={0.12}
            stroke="none"
            label={band.label ? { value: band.label, position: 'insideLeft', fontSize: 10, fill: band.colour ?? '#3D8259' } : undefined}
          />
        )}
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
            // All time opens the window on the whole series — Ash's
            // instruction 4 Sep 2026. The default fortnight is right for the
            // question an owner asks daily and wrong for the one they ask
            // before a vet visit: nine months of a pet who declined to 52%
            // and recovered drew as a flat line at 77%, because the last
            // fourteen days of it were flat.
            //
            // The brush stays either way. This moves where it opens, not
            // whether the reader can move it.
            startIndex={allTime ? 0 : Math.max(0, data.length - DEFAULT_VISIBLE_POINTS)}
            endIndex={Math.max(0, data.length - 1)}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

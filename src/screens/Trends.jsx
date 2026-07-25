import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { computeOverviewCategories, severityColorFromPercent } from '../lib/scoring'
import { buildDailySeries } from '../lib/qolData'
import TrendsCalendar from './trends/TrendsCalendar'

export default function Trends() {
  const { pets } = usePets()
  const pet = pets[0]
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  const hasLatestData = latestGeneralEntry || latestPainEntry
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const hasHistory = dailySeries.length > 0

  return (
    <div className="screen">
      <Card>
        <SectionTitle>Trends</SectionTitle>
        <p>
          Visual trends make gradual change easier to spot than single numbers — and are
          useful to bring to a vet visit.
        </p>
      </Card>

      <Card>
        <SectionTitle>Overview</SectionTitle>
        {loading && <p>Loading…</p>}
        {!loading && !hasLatestData && <p>No assessments logged yet.</p>}
        {!loading && hasLatestData && (
          <>
            <div className="overview-bars">
              {WELLBEING_CONCEPTS.map(({ key, label, Icon, color }) => {
                const value = overview[key]
                return (
                  <div key={key} className="overview-bar-row">
                    <span className="overview-bar-icon" style={{ background: color }}>
                      <Icon size={16} color="#fff" />
                    </span>
                    <span className="overview-bar-label">{label}</span>
                    <div className="overview-bar-track">
                      <div
                        className="overview-bar-fill"
                        style={{
                          width: `${value ?? 0}%`,
                          background: value != null ? severityColorFromPercent(value) : 'var(--border)',
                        }}
                      />
                    </div>
                    <span className="overview-bar-percent">
                      {value != null ? `${Math.round(value)}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="assessment-hint">
              From {latestGeneralEntry?.date ?? latestPainEntry?.date} — based on your most recent assessment.
            </p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Good / bad days</SectionTitle>
        <TrendsCalendar generalEntries={generalEntries} />
      </Card>

      <Card>
        <SectionTitle>General QoL over time</SectionTitle>
        {!hasHistory ? (
          <p>No assessments logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5DFE4" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="generalTotal" stroke="#C97B8C" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {WELLBEING_CONCEPTS.map(({ key, label, Icon, color }) => (
        <Card key={key}>
          <div className="chart-title">
            <span className="chart-title-icon" style={{ background: color }}>
              <Icon size={14} color="#fff" />
            </span>
            <SectionTitle>{label} over time</SectionTitle>
          </div>
          {!hasHistory ? (
            <p>No assessments logged yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5DFE4" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      ))}
    </div>
  )
}

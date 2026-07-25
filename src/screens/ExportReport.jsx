import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { buildDailySeries } from '../lib/qolData'
import { computeGeneralQolResult, computeOverviewCategories, beapSeverityLabel } from '../lib/scoring'

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export default function ExportReport() {
  const { pets } = usePets()
  const pet = pets[0]
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  const generalResult = latestGeneralEntry ? computeGeneralQolResult(latestGeneralEntry) : null
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const recent = dailySeries.slice(-10).reverse()

  return (
    <div className="screen">
      <Card>
        <SectionTitle>Report</SectionTitle>
        <p>A summary you can print or save as a PDF to bring to a vet visit.</p>
        <Btn type="button" className="no-print" onClick={() => window.print()}>Print</Btn>
      </Card>

      {loading && (
        <Card><p>Loading…</p></Card>
      )}

      {!loading && (
        <>
          <Card>
            <SectionTitle>Pet</SectionTitle>
            <div className="report-field-row"><span>Name</span><strong>{pet.name}</strong></div>
            <div className="report-field-row"><span>Species</span><strong>{capitalize(pet.species)}</strong></div>
            <div className="report-field-row"><span>Age</span><strong>{pet.age_label || 'Not recorded'}</strong></div>
            <div className="report-field-row"><span>Sex</span><strong>{capitalize(pet.sex)}</strong></div>
          </Card>

          <Card>
            <SectionTitle>Latest scores</SectionTitle>
            <div className="report-field-row">
              <span>General QoL</span>
              <strong>{generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}</strong>
            </div>
            <div className="report-field-row">
              <span>Pain (BEAAAAPP)</span>
              <strong>{latestPainEntry ? beapSeverityLabel(latestPainEntry.beapWorst) : 'Not yet assessed'}</strong>
            </div>
          </Card>

          <Card>
            <SectionTitle>Overview</SectionTitle>
            {WELLBEING_CONCEPTS.map(({ key, label }) => (
              <div key={key} className="report-field-row">
                <span>{label}</span>
                <strong>{overview[key] != null ? `${Math.round(overview[key])}%` : '—'}</strong>
              </div>
            ))}
          </Card>

          <Card>
            <SectionTitle>Recent assessments</SectionTitle>
            {recent.length === 0 ? (
              <p>No assessments logged yet.</p>
            ) : (
              recent.map((day) => (
                <div key={day.date} className="report-field-row">
                  <span>{day.date}</span>
                  <strong>{day.generalPercent != null ? `${day.generalPercent}%` : '—'}</strong>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}

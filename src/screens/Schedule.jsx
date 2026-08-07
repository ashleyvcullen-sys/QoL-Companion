import { supabase } from '../lib/supabase'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'

const CADENCE_OPTIONS = [
  { value: 1, label: 'Daily' },
  { value: 7, label: 'Weekly' },
  { value: 14, label: 'Every 2 weeks' },
  { value: 30, label: 'Monthly' },
]

function daysSince(dateStr) {
  const last = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - last) / (1000 * 60 * 60 * 24))
}

function ScheduleRow({ label, lastDate, cadenceDays, onCadenceChange }) {
  const isOverdue = !lastDate || daysSince(lastDate) >= cadenceDays

  return (
    <div className="schedule-row">
      <div className="schedule-row-header">
        <span className="schedule-row-label">{label}</span>
        <span className={`schedule-badge ${isOverdue ? 'overdue' : 'ok'}`}>
          {isOverdue ? 'Overdue' : 'On track'}
        </span>
      </div>
      <p className="assessment-hint">Last logged: {lastDate || 'never'}</p>
      <div className="field">
        <label>Repeat</label>
        <select value={cadenceDays} onChange={(e) => onCadenceChange(Number(e.target.value))}>
          {CADENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function Schedule() {
  const { pets, refresh } = usePets()
  const pet = pets[0]
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const latestGeneralDate = generalEntries[generalEntries.length - 1]?.date ?? null
  const latestPainDate = painEntries[painEntries.length - 1]?.date ?? null

  async function updateCadence(field, days) {
    const nextSchedule = { ...pet.schedule, [field]: days }
    const { error } = await supabase.from('pets').update({ schedule: nextSchedule }).eq('id', pet.id)
    if (!error) await refresh()
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Schedule</SectionTitle>
        <p>
          Set how often each assessment should be repeated. A due/overdue badge shows next
          to each based on your last logged entry — a simple way to keep monitoring consistent.
        </p>
      </Card>

      <Card>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            <ScheduleRow
              label="Quality of Life assessment"
              lastDate={latestGeneralDate}
              cadenceDays={pet.schedule.general}
              onCadenceChange={(days) => updateCadence('general', days)}
            />
            <ScheduleRow
              label="Pain scoring"
              lastDate={latestPainDate}
              cadenceDays={pet.schedule.pain}
              onCadenceChange={(days) => updateCadence('pain', days)}
            />
          </>
        )}
      </Card>

      <p className="assessment-hint">
        This app tracks due dates in-app rather than sending push notifications — check the
        Overview tab regularly, or make it part of a daily routine (e.g. alongside feeding).
      </p>
    </div>
  )
}

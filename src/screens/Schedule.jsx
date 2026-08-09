import { useEffect, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import {
  checkNotificationPermission,
  requestNotificationPermission,
  scheduleQolReminder,
} from '../lib/notifications'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import Footer from '../components/Footer'

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

function openNotificationSettings() {
  // No Capacitor plugin exposes this directly — a WKWebView hands off
  // Apple's own app-settings: URL scheme to the OS without needing any
  // extra native config, the same way tel:/mailto: links already do.
  window.location.href = 'app-settings:'
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
  const { generalEntries, loading } = useQolHistory(pet?.id)
  const [showFrequencyInfo, setShowFrequencyInfo] = useState(false)
  const [notifStatus, setNotifStatus] = useState(null)

  const latestGeneralDate = generalEntries[generalEntries.length - 1]?.date ?? null

  // Schedule used to track "general" and "pain" cadence separately, even
  // though a save always writes both halves of the assessment together —
  // there was never a real scenario where they'd differ. Consolidated to a
  // single `qol` field; existing pets fall back to whatever `general` was
  // already set to (or a weekly default) so no one's cadence silently resets.
  const cadenceDays = pet.schedule.qol ?? pet.schedule.general ?? 7

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    checkNotificationPermission().then(setNotifStatus)
  }, [])

  // Keeps the scheduled reminder in sync with the current cadence whenever
  // this screen is visited with permission already granted — not just
  // right after a change — so it self-heals (e.g. after a reinstall, or
  // permission granted after a cadence was already set).
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || notifStatus !== 'granted' || loading) return
    scheduleQolReminder({
      petName: pet.name,
      cadenceDays,
      fromDate: latestGeneralDate ?? new Date(),
    })
  }, [notifStatus, loading, cadenceDays, latestGeneralDate, pet.name])

  async function updateCadence(days) {
    const nextSchedule = { ...pet.schedule, qol: days }
    const { error } = await supabase.from('pets').update({ schedule: nextSchedule }).eq('id', pet.id)
    if (!error) await refresh()
  }

  async function handleEnableReminders() {
    const display = await requestNotificationPermission()
    setNotifStatus(display)
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Schedule</SectionTitle>
        <p>
          Set how often the assessment should be repeated. A due/overdue badge shows
          based on your last logged entry — a simple way to keep monitoring consistent.
        </p>
      </Card>

      <Card>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <ScheduleRow
            label="Quality of Life assessment"
            lastDate={latestGeneralDate}
            cadenceDays={cadenceDays}
            onCadenceChange={updateCadence}
          />
        )}
      </Card>

      {Capacitor.isNativePlatform() && (notifStatus === 'prompt' || notifStatus === 'prompt-with-rationale') && (
        <Card>
          <p>Allow notifications so we can remind you when it's time for your next check-in?</p>
          <Btn type="button" className="btn-block" onClick={handleEnableReminders}>
            Enable reminders
          </Btn>
        </Card>
      )}

      {Capacitor.isNativePlatform() && notifStatus === 'denied' && (
        <Card>
          <p className="assessment-hint">Reminders are off.</p>
          <Btn type="button" variant="outline" className="btn-block" onClick={openNotificationSettings}>
            Open Settings to turn them back on
          </Btn>
        </Card>
      )}

      <Card>
        <button type="button" className="icon-tile-link" onClick={() => setShowFrequencyInfo(true)}>
          <div className="welcome-help-row">
            <span className="icon-badge">
              <HelpCircle size={20} color="#fff" />
            </span>
            <span>How often should I be assessing my pet's quality of life?</span>
          </div>
        </button>
      </Card>

      <p className="assessment-hint">
        {Capacitor.isNativePlatform()
          ? 'Check the Overview tab regularly, or make it part of a daily routine (e.g. alongside feeding) — reminders are a backstop, not a replacement.'
          : 'This app tracks due dates in-app rather than sending push notifications — check the Overview tab regularly, or make it part of a daily routine (e.g. alongside feeding).'}
      </p>

      {showFrequencyInfo && (
        <Modal title="How often should I assess?" onClose={() => setShowFrequencyInfo(false)}>
          <p>
            For young, healthy pets, checking in at least fortnightly is a reasonable
            baseline — enough to catch any gradual changes without it feeling like a chore.
          </p>
          <p>
            For older pets, or pets with a diagnosed illness or declining health, assessing
            daily — or as often as you're able — gives you and your vet the clearest, most
            accurate picture of how they're really doing, especially when things can change
            quickly.
          </p>
        </Modal>
      )}

      <Footer />
    </div>
  )
}

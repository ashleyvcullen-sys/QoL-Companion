import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Droplet, House } from 'lucide-react'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Modal from '../components/Modal'
import Footer from '../components/Footer'
import SwipeableWizard from '../components/SwipeableWizard'
import IntroPage from './assessment/IntroPage'
import SliderWithChipsPage from './assessment/SliderWithChipsPage'
import VomitingPage from './assessment/VomitingPage'
import UrinationPage from './assessment/UrinationPage'
import DrinkingPage from './assessment/DrinkingPage'
import SliderOnlyPage from './assessment/SliderOnlyPage'
import BeapCategoryPage from './assessment/BeapCategoryPage'
import FelineGrimacePage from './assessment/FelineGrimacePage'
import ReviewPage from './assessment/ReviewPage'
import { STOOL_SYMPTOM_OPTIONS, HYGIENE_SYMPTOM_OPTIONS } from '../lib/assessmentOptions'
import { FELINE_GRIMACE_ACTION_UNITS } from '../lib/felineGrimaceScale'
import { BEAP_CATEGORIES, computeBeapWorst } from '../lib/scoring'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { supabase } from '../lib/supabase'
import { scheduleQolReminder } from '../lib/notifications'
import PooIcon from '../components/icons/PooIcon'
import SoapIcon from '../components/icons/SoapIcon'
import EyesIcon from '../components/icons/EyesIcon'
import SleepIcon from '../components/icons/SleepIcon'
import PuddleIcon from '../components/icons/PuddleIcon'
import DropletsIcon from '../components/icons/DropletsIcon'

const INITIAL_ENTRY = {
  scores: { stool: 'unsure', hygiene: 'unsure', vision: 'unsure', hearing: 'unsure', sleep: 'unsure' },
  stoolSymptoms: [],
  hygieneSymptoms: [],
  vomiting: { hasVomited: null, frequency: '', unit: 'times/day', character: [] },
  urination: { status: null, symptoms: [] },
  waterIntake: { status: null },
  notes: '',
  beap: Object.fromEntries(BEAP_CATEGORIES.map((category) => [category, null])),
  // Only ever used for cats — the 5 Feline Grimace Scale action-unit answers
  // that sum into beap.eyes. Kept separate from `beap` since it's never sent
  // to Supabase itself, only the resulting total is.
  catEyesGrimace: Object.fromEntries(FELINE_GRIMACE_ACTION_UNITS.map((unit) => [unit.key, null])),
}

export default function QualityOfLifeAssessment() {
  const { pets } = usePets()
  const pet = pets[0]
  const navigate = useNavigate()

  // Loads lazily and defaults to the normal intro copy until it resolves —
  // for a returning user that's already correct, and for a first-timer the
  // fetch is quick enough that a flash of the wrong copy is unlikely.
  const { generalEntries, loading: historyLoading } = useQolHistory(pet.id)
  const isFirstAssessment = !historyLoading && generalEntries.length === 0

  const [entry, setEntry] = useState(INITIAL_ENTRY)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  function updateScore(field, value) {
    setEntry((prev) => ({ ...prev, scores: { ...prev.scores, [field]: value } }))
  }

  function updateField(field, value) {
    setEntry((prev) => ({ ...prev, [field]: value }))
  }

  function updateBeap(category, value) {
    setEntry((prev) => ({ ...prev, beap: { ...prev.beap, [category]: value } }))
  }

  function updateGrimaceAnswer(unitKey, value) {
    setEntry((prev) => ({
      ...prev,
      catEyesGrimace: { ...prev.catEyesGrimace, [unitKey]: value },
    }))
  }

  async function handleComplete() {
    if (saving) return

    const beapValues = Object.values(entry.beap)
    if (beapValues.some((v) => v === null)) {
      setErrorMessage('Please answer all 8 pain categories before saving.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    const entryDate = new Date().toISOString().slice(0, 10)
    const beapWorst = computeBeapWorst(entry.beap)

    const { error: generalError } = await supabase
      .from('general_qol_entries')
      .upsert({
        pet_id: pet.id,
        entry_date: entryDate,
        scores: entry.scores,
        stool_symptoms: entry.stoolSymptoms,
        hygiene_symptoms: entry.hygieneSymptoms,
        vomiting: entry.vomiting,
        urination: entry.urination,
        water_intake: entry.waterIntake,
        notes: entry.notes,
      }, { onConflict: 'pet_id,entry_date' })

    if (generalError) {
      setErrorMessage(generalError.message)
      setSaving(false)
      return
    }

    const { error: painError } = await supabase
      .from('pain_log_entries')
      .upsert({
        pet_id: pet.id,
        entry_date: entryDate,
        beap: entry.beap,
        beap_worst: beapWorst,
        notes: entry.notes,
      }, { onConflict: 'pet_id,entry_date' })

    if (painError) {
      setErrorMessage(painError.message)
      setSaving(false)
      return
    }

    // Reschedule from this completion, not the cadence-change baseline —
    // keeps the reminder counting from when the pet was actually last
    // checked on rather than drifting from whenever the cadence was set.
    const cadenceDays = pet.schedule.qol ?? pet.schedule.general ?? 7
    scheduleQolReminder({ petName: pet.name, cadenceDays, fromDate: entryDate }).catch((error) => {
      console.error('Failed to reschedule QoL reminder:', error.message)
    })

    setSaving(false)
    navigate('/')
  }

  const pages = [
    <IntroPage key="intro" petName={pet.name} isFirstAssessment={isFirstAssessment} />,
    <SliderWithChipsPage
      key="stool"
      title="Stool quality"
      sliderValue={entry.scores.stool}
      onSliderChange={(v) => updateScore('stool', v)}
      chipOptions={STOOL_SYMPTOM_OPTIONS}
      chipValue={entry.stoolSymptoms}
      onChipChange={(v) => updateField('stoolSymptoms', v)}
      icon={PooIcon}
      scaleLabels={['Watery / diarrhoea', 'Mixed', 'Well formed']}
    />,
    <VomitingPage
      key="vomiting"
      value={entry.vomiting}
      onChange={(v) => updateField('vomiting', v)}
      icon={PuddleIcon}
    />,
    <UrinationPage
      key="urination"
      value={entry.urination}
      onChange={(v) => updateField('urination', v)}
      icon={DropletsIcon}
      species={pet.species}
      sex={pet.sex}
    />,
    <DrinkingPage
      key="drinking"
      value={entry.waterIntake.status}
      onChange={(v) => updateField('waterIntake', { status: v })}
      icon={Droplet}
    />,
    <SliderWithChipsPage
      key="hygiene"
      title="Hygiene, Coat Quality And Grooming"
      sliderValue={entry.scores.hygiene}
      onSliderChange={(v) => updateScore('hygiene', v)}
      chipOptions={HYGIENE_SYMPTOM_OPTIONS}
      chipValue={entry.hygieneSymptoms}
      onChipChange={(v) => updateField('hygieneSymptoms', v)}
      icon={SoapIcon}
      scaleLabels={['Unkempt', 'Average', 'Clean']}
    />,
    <SliderOnlyPage
      key="vision"
      title="Vision"
      value={entry.scores.vision}
      onChange={(v) => updateScore('vision', v)}
      icon={EyesIcon}
      scaleLabels={['Bumps into things / appears blind', 'A bit hesitant', 'Moves confidently / appears visual']}
    />,
    <SliderOnlyPage
      key="hearing"
      title="Hearing"
      value={entry.scores.hearing}
      onChange={(v) => updateScore('hearing', v)}
      icon={Bell}
      scaleLabels={['Doesn\'t respond to name or sounds', 'Slower to respond', 'Responds normally to sounds and name']}
    />,
    <SliderOnlyPage
      key="sleep"
      title="Sleep"
      value={entry.scores.sleep}
      onChange={(v) => updateScore('sleep', v)}
      icon={SleepIcon}
      scaleLabels={['Restless, disrupted, or reversed day/night pattern', 'Some restless nights', 'Settles and sleeps normally']}
    />,
    ...BEAP_CATEGORIES.map((category) =>
      category === 'eyes' && pet.species === 'cat' ? (
        <FelineGrimacePage
          key={category}
          answers={entry.catEyesGrimace}
          onAnswerChange={updateGrimaceAnswer}
          onTotalChange={(total) => updateBeap('eyes', total)}
        />
      ) : (
        <BeapCategoryPage
          key={category}
          species={pet.species}
          categoryKey={category}
          value={entry.beap[category]}
          onChange={(v) => updateBeap(category, v)}
        />
      )
    ),
    <ReviewPage
      key="review"
      entry={entry}
      onNotesChange={(v) => updateField('notes', v)}
      errorMessage={errorMessage}
    />,
  ]

  return (
    <div className="screen">
      <button type="button" className="home-link" onClick={() => setShowExitConfirm(true)}>
        <House size={14} />
        Exit
      </button>

      <Card>
        <SwipeableWizard
          pages={pages}
          finishLabel={saving ? 'Saving…' : 'Save'}
          onComplete={handleComplete}
          footer={<Footer />}
        />
      </Card>

      {showExitConfirm && (
        <Modal title="Exit assessment?" onClose={() => setShowExitConfirm(false)}>
          <p>Are you sure? Your progress on this assessment won't be saved.</p>
          <div className="modal-actions">
            <Btn type="button" variant="outline" onClick={() => setShowExitConfirm(false)}>
              Cancel
            </Btn>
            <Btn type="button" variant="danger" onClick={() => navigate('/')}>
              Exit
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
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
import { STOOL_SYMPTOM_OPTIONS, HYGIENE_SYMPTOM_OPTIONS, STOOL_NONE_TODAY_OPTION } from '../lib/assessmentOptions'
import { FELINE_GRIMACE_ACTION_UNITS } from '../lib/felineGrimaceScale'
import { BEAP_CATEGORIES, computeBeapWorst } from '../lib/scoring'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { supabase } from '../lib/supabase'
import { scheduleQolReminder } from '../lib/notifications'
import { loadTodaysAssessmentDraft, saveAssessmentDraft, clearAssessmentDraft } from '../lib/assessmentDraft'
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

// Mirrors the wizard's actual page order (see `pages` below) without
// depending on it directly — resume-index lookups happen from event
// handlers, well after any particular render's `pages` array existed, so a
// static list decoupled from render timing is simpler than threading the
// live one through.
const PAGE_KEY_ORDER = [
  'intro',
  'stool', 'vomiting', 'urination', 'drinking', 'hygiene', 'vision', 'hearing', 'sleep',
  ...BEAP_CATEGORIES,
  'review',
]

// "unsure" is both a slider's default AND a deliberate, valid answer (the
// "Not sure" toggle) — there's no way to tell those apart from the stored
// value alone. Treating "still at the pristine default" as "unanswered" is
// an approximation, not a perfect signal: a user who explicitly confirmed
// "Not sure" and never touched anything else on that page would get
// resumed there again. Acceptable trade-off — worst case is a mild, occasional
// re-visit to a page they'd already deliberately answered, never data loss.
function isSectionAnswered(entryToCheck, pageKey) {
  switch (pageKey) {
    case 'stool':
      return entryToCheck.scores.stool !== 'unsure' || entryToCheck.stoolSymptoms.length > 0
    case 'vomiting':
      return entryToCheck.vomiting.hasVomited !== null
    case 'urination':
      return entryToCheck.urination.status !== null
    case 'drinking':
      return entryToCheck.waterIntake.status !== null
    case 'hygiene':
      return entryToCheck.scores.hygiene !== 'unsure' || entryToCheck.hygieneSymptoms.length > 0
    case 'vision':
      return entryToCheck.scores.vision !== 'unsure'
    case 'hearing':
      return entryToCheck.scores.hearing !== 'unsure'
    case 'sleep':
      return entryToCheck.scores.sleep !== 'unsure'
    default:
      // BEAP categories (key is the category name itself) — 'intro' and
      // 'review' also fall through here and are always "answered", since
      // neither has anything to complete on its own and neither should
      // ever itself be a resume target.
      return BEAP_CATEGORIES.includes(pageKey) ? entryToCheck.beap[pageKey] !== null : true
  }
}

function findResumeIndex(hydratedEntry) {
  const index = PAGE_KEY_ORDER.findIndex((key) => !isSectionAnswered(hydratedEntry, key))
  return index === -1 ? PAGE_KEY_ORDER.length - 1 : index
}

// Reconstructs the assessment-flow `entry` shape from already-submitted
// Supabase rows, for the "Edit Existing" path. catEyesGrimace can't be
// recovered — only the summed total was ever persisted — so it's left
// blank; FelineGrimacePage won't clobber the hydrated beap.eyes value with
// that until the user actually starts re-answering it (see there).
function entryFromServerRows(generalRow, painRow) {
  return {
    scores: generalRow?.scores ?? INITIAL_ENTRY.scores,
    stoolSymptoms: generalRow?.stoolSymptoms ?? [],
    hygieneSymptoms: generalRow?.hygieneSymptoms ?? [],
    vomiting: generalRow?.vomiting ?? INITIAL_ENTRY.vomiting,
    urination: generalRow?.urination ?? INITIAL_ENTRY.urination,
    waterIntake: generalRow?.waterIntake ?? INITIAL_ENTRY.waterIntake,
    notes: generalRow?.notes ?? painRow?.notes ?? '',
    beap: painRow?.beap ?? INITIAL_ENTRY.beap,
    catEyesGrimace: INITIAL_ENTRY.catEyesGrimace,
  }
}

export default function QualityOfLifeAssessment() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()

  // Loads lazily and defaults to the normal intro copy until it resolves —
  // for a returning user that's already correct, and for a first-timer the
  // fetch is quick enough that a flash of the wrong copy is unlikely.
  const { generalEntries, painEntries, loading: historyLoading } = useQolHistory(pet.id)
  const isFirstAssessment = !historyLoading && generalEntries.length === 0

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaysGeneralEntry = generalEntries.find((e) => e.date === todayStr) ?? null
  const todaysPainEntry = painEntries.find((e) => e.date === todayStr) ?? null

  const [entry, setEntry] = useState(INITIAL_ENTRY)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [draftToResume, setDraftToResume] = useState(null)
  const [showExistingTodayChoice, setShowExistingTodayChoice] = useState(false)
  const [readyToPersist, setReadyToPersist] = useState(false)
  const [initialPageIndex, setInitialPageIndex] = useState(0)
  const [wizardKey, setWizardKey] = useState(0)

  // Runs once history has loaded. A completed entry for today takes
  // priority over the local in-progress draft entirely — if today's
  // already submitted, the "already completed" choice below is what's
  // offered, and any stray local draft (e.g. from an abandoned edit
  // attempt earlier the same day) gets cleared rather than separately
  // offered too, to avoid stacking two different resume prompts. Only
  // when there's no entry for today yet does the local-draft check run.
  // Persisting is held off (readyToPersist stays false) until whichever
  // prompt applies has been resolved — otherwise the blank INITIAL_ENTRY
  // would silently overwrite a real draft the moment this mounts.
  useEffect(() => {
    if (historyLoading) return

    if (todaysGeneralEntry) {
      setShowExistingTodayChoice(true)
      return
    }

    let cancelled = false
    loadTodaysAssessmentDraft(pet.id).then((draftEntry) => {
      if (cancelled) return
      if (draftEntry) {
        setDraftToResume(draftEntry)
      } else {
        setReadyToPersist(true)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, generalEntries, pet.id])

  // Debounced so rapid typing (e.g. the notes field) doesn't fire a write
  // per keystroke — still eventually-consistent within well under a second.
  useEffect(() => {
    if (!readyToPersist) return
    const timeout = setTimeout(() => {
      saveAssessmentDraft(pet.id, entry)
    }, 400)
    return () => clearTimeout(timeout)
  }, [entry, readyToPersist, pet.id])

  // Forces SwipeableWizard to remount with the new starting index — plain
  // prop changes wouldn't do anything once it's already mounted, since its
  // pageIndex is only ever initialized from props on first mount.
  function jumpTo(hydratedEntry) {
    setInitialPageIndex(findResumeIndex(hydratedEntry))
    setWizardKey((k) => k + 1)
  }

  function handleResumeDraft() {
    setEntry(draftToResume)
    jumpTo(draftToResume)
    setDraftToResume(null)
    setReadyToPersist(true)
  }

  function handleStartFresh() {
    clearAssessmentDraft(pet.id)
    setDraftToResume(null)
    setReadyToPersist(true)
  }

  function handleStartNewToday() {
    clearAssessmentDraft(pet.id)
    setShowExistingTodayChoice(false)
    setReadyToPersist(true)
  }

  function handleEditExisting() {
    const hydrated = entryFromServerRows(todaysGeneralEntry, todaysPainEntry)
    setEntry(hydrated)
    jumpTo(hydrated)
    clearAssessmentDraft(pet.id)
    setShowExistingTodayChoice(false)
    setReadyToPersist(true)
  }

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

    await clearAssessmentDraft(pet.id)

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
      extraOption={STOOL_NONE_TODAY_OPTION}
    />,
    <VomitingPage
      key="vomiting"
      value={entry.vomiting}
      onChange={(v) => updateField('vomiting', v)}
      icon={PuddleIcon}
      species={pet.species}
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
          initialTotal={entry.beap.eyes}
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
          key={wizardKey}
          pages={pages}
          initialPageIndex={initialPageIndex}
          finishLabel={saving ? 'Saving…' : 'Save'}
          onComplete={handleComplete}
          footer={<Footer />}
        />
      </Card>

      {showExitConfirm && (
        <Modal title="Exit assessment?" onClose={() => setShowExitConfirm(false)}>
          <p>
            Are you sure? Your answers so far are saved as a draft you can resume next
            time, but this attempt won't be submitted unless you finish and save.
          </p>
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

      {draftToResume && (
        <Modal title="Resume assessment?" onClose={handleStartFresh}>
          <p>You have an assessment in progress — resume where you left off, or start fresh?</p>
          <div className="modal-actions">
            <Btn type="button" variant="outline" onClick={handleStartFresh}>
              Start fresh
            </Btn>
            <Btn type="button" onClick={handleResumeDraft}>
              Resume
            </Btn>
          </div>
        </Modal>
      )}

      {showExistingTodayChoice && (
        <Modal title="Already completed today" onClose={handleStartNewToday}>
          <p>
            You've already completed today's assessment. Would you like to start a new one
            (this will overwrite today's entry) or edit your existing entry?
          </p>
          <div className="modal-actions">
            <Btn type="button" variant="outline" onClick={handleStartNewToday}>
              Start New
            </Btn>
            <Btn type="button" onClick={handleEditExisting}>
              Edit Existing
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

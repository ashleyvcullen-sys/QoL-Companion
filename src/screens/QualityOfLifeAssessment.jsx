import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Droplet, FileDown, House } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
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
import SleepPage from './assessment/SleepPage'
import FelineGrimacePage from './assessment/FelineGrimacePage'
import ReviewPage from './assessment/ReviewPage'
import {
  STOOL_SYMPTOM_OPTIONS,
  HYGIENE_SYMPTOM_OPTIONS,
  STOOL_NONE_TODAY_OPTION,
  STOOL_EMERGENCY,
  SLEEP_NOTES,
} from '../lib/assessmentOptions'
import { FELINE_GRIMACE_ACTION_UNITS } from '../lib/felineGrimaceScale'
import { BEAP_CATEGORIES, computeBeapWorst, computeGeneralQolResult } from '../lib/scoring'
import {
  beapAppetiteFromVcogGrade,
  prefilledFrom,
  sleepScoreFromSeverity,
  sleepSeverityFromScore,
  vcogGradeFromBeapAppetite,
} from '../lib/conditions'
import { CONDITION_LIST } from '../lib/conditions'
import { assessmentReferences } from '../lib/references'
import {
  saveConditionEntry,
  todayIsoDate,
  useAllConditionEntries,
  usePetConditions,
} from '../lib/conditionsData'
import { parametersFor } from '../lib/cancerConfig'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { supabase } from '../lib/supabase'
import { scheduleQolReminder } from '../lib/notifications'
import { loadTodaysAssessmentDraft, saveAssessmentDraft, clearAssessmentDraft } from '../lib/assessmentDraft'
import PooIcon from '../components/icons/PooIcon'
import SoapIcon from '../components/icons/SoapIcon'
import EyesIcon from '../components/icons/EyesIcon'
import PuddleIcon from '../components/icons/PuddleIcon'
import DropletsIcon from '../components/icons/DropletsIcon'

// Local rather than shared: three screens format a date this way and each
// has its own copy. Worth unifying one day; not worth a new module today.
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

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

  // BEAAAAPP categories a condition form has already collected TODAY.
  //
  // Arthritis asks Ambulation and Palpation, and those are not similar to the
  // categories below — they are the same question. Whichever screen the owner
  // reaches first should be the only place they answer it; the other should
  // show the answer and say where it came from.
  //
  // Same day only, matching the condition side: an answer from Tuesday is not
  // an answer about today, and presenting it in an answered-looking field
  // would be worse than an empty one.
  const todayDate = todayIsoDate()
  const { byCondition: conditionEntriesByCondition } = useAllConditionEntries(pet.id)
  // Needed for cancer alone: its question list is composed from the owner's
  // own configuration rather than declared on the condition, so reading
  // `condition.parameters` would find nothing there.
  const { conditions: petConditions } = usePetConditions(pet.id)

  // Two maps: BEAAAAPP categories, and the everyday-function scores. Same
  // idea either way — a condition asked this question today, so this screen
  // shows the answer rather than asking again.
  const { beap: beapFromConditions, scores: scoresFromConditions } = useMemo(() => {
    const found = {}
    const foundScores = {}
    for (const condition of CONDITION_LIST) {
      const todaysEntry = (conditionEntriesByCondition[condition.key] ?? [])
        .find((conditionEntry) => conditionEntry.date === todayDate)
      if (!todaysEntry) continue

      const petCondition = petConditions.find((row) => row.conditionKey === condition.key) ?? null
      for (const parameter of parametersFor(condition, petCondition?.config ?? {}, pet.species)) {
        if (parameter.scoreKey) {
          const severity = Number(todaysEntry.values?.[parameter.key])
          if (!Number.isFinite(severity)) continue
          foundScores[parameter.scoreKey] = {
            value: sleepScoreFromSeverity(severity),
            conditionKey: condition.key,
            conditionLabel: condition.label,
            parameterKey: parameter.key,
            entryValues: todaysEntry.values ?? {},
            entryNotes: todaysEntry.notes ?? '',
          }
          continue
        }

        if (!parameter.beapKey) continue
        const raw = Number(todaysEntry.values?.[parameter.key])
        if (!Number.isFinite(raw)) continue
        // Cancer grades appetite; the assessment scores it. Convert here so
        // the owner sees a level rather than a grade on this screen.
        const score = parameter.beapFromGrade ? beapAppetiteFromVcogGrade(raw) : raw
        if (score == null) continue
        found[parameter.beapKey] = {
          value: score,
          conditionKey: condition.key,
          conditionLabel: condition.label,
          parameterKey: parameter.key,
          entryValues: todaysEntry.values ?? {},
          entryNotes: todaysEntry.notes ?? '',
          beapFromGrade: Boolean(parameter.beapFromGrade),
        }
      }
    }
    return { beap: found, scores: foundScores }
  }, [conditionEntriesByCondition, petConditions, todayDate, pet.species])

  // Set once the assessment is saved. Holds what was just recorded so the
  // finish screen can show it without re-reading the database — the row was
  // written a moment ago and reading it back to display what we already know
  // is a round trip that can only introduce a delay or a discrepancy.
  const [completed, setCompleted] = useState(null)

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

  // Sleep, seeded from a condition form the same way. 'unsure' is the
  // untouched default here, so it counts as unanswered — a real "not sure"
  // the owner chose deliberately is indistinguishable from it, which is a
  // known limitation of that default and not one this introduces.
  useEffect(() => {
    const keys = Object.keys(scoresFromConditions)
    if (keys.length === 0) return
    setEntry((previous) => {
      let changed = false
      const scores = { ...previous.scores }
      for (const key of keys) {
        if (scores[key] == null || scores[key] === 'unsure') {
          scores[key] = scoresFromConditions[key].value
          changed = true
        }
      }
      return changed ? { ...previous, scores } : previous
    })
  }, [scoresFromConditions])

  // Seeds only categories still unanswered here. A value the owner has
  // already set on this screen — or resumed from a draft — always wins, so
  // this can never overwrite what they typed.
  useEffect(() => {
    const keys = Object.keys(beapFromConditions)
    if (keys.length === 0) return
    setEntry((previous) => {
      let changed = false
      const beap = { ...previous.beap }
      for (const key of keys) {
        if (beap[key] == null) {
          beap[key] = beapFromConditions[key].value
          changed = true
        }
      }
      return changed ? { ...previous, beap } : previous
    })
  }, [beapFromConditions])

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

    // Keep the condition form in step. Only categories a condition actually
    // collected today, and only where the owner has moved the answer on this
    // screen — the condition entry is otherwise left exactly as it was.
    try {
      for (const [key, source] of Object.entries(scoresFromConditions)) {
        const score = entry.scores[key]
        if (score == null || score === 'unsure' || score === source.value) continue
        await saveConditionEntry({
          petId: pet.id,
          conditionKey: source.conditionKey,
          entryDate,
          values: { ...source.entryValues, [source.parameterKey]: sleepSeverityFromScore(score) },
          notes: source.entryNotes,
        })
      }

      for (const [category, source] of Object.entries(beapFromConditions)) {
        const score = entry.beap[category]
        if (score == null || score === source.value) continue
        // Converted, not copied: the condition form stores a grade, so
        // writing the level straight in would store a number meaning
        // something else entirely.
        const stored = source.beapFromGrade ? vcogGradeFromBeapAppetite(score) : score
        if (stored == null) continue
        await saveConditionEntry({
          petId: pet.id,
          conditionKey: source.conditionKey,
          entryDate,
          values: { ...source.entryValues, [source.parameterKey]: stored },
          notes: source.entryNotes,
        })
      }
    } catch (syncError) {
      // The assessment itself saved. Say so rather than reporting a failure
      // that did not happen.
      setErrorMessage(
        `Assessment saved, but the condition form could not be updated to match: ${syncError.message}`,
      )
    }

    // Reschedule from this completion, not the cadence-change baseline —
    // keeps the reminder counting from when the pet was actually last
    // checked on rather than drifting from whenever the cadence was set.
    const cadenceDays = pet.schedule.qol ?? pet.schedule.general ?? 7
    scheduleQolReminder({ petId: pet.id, petName: pet.name, cadenceDays, fromDate: entryDate }).catch((error) => {
      console.error('Failed to reschedule QoL reminder:', error.message)
    })

    await clearAssessmentDraft(pet.id)

    // The last assessment BEFORE this one, for the comparison. generalEntries
    // was loaded when the screen opened, so it does not include what was just
    // saved — which is exactly what we want here.
    const previousGeneral = generalEntries[generalEntries.length - 1] ?? null
    const previousPain = painEntries.find((row) => row.date === previousGeneral?.date) ?? null

    setCompleted({
      result: computeGeneralQolResult(entry, entry.beap),
      previous: previousGeneral
        ? {
            date: previousGeneral.date,
            result: computeGeneralQolResult(previousGeneral, previousPain?.beap),
          }
        : null,
    })

    setSaving(false)
  }

  // Species-filtered: a dog owner is never shown the Feline Grimace Scale, so
  // crediting it to them would be noise dressed up as rigour.
  const references = assessmentReferences(pet.species)

  // Below the Back/Next buttons on the intro page only. Credits belong at
  // the bottom of the screen, under the controls — not between the
  // instructions and the button the reader is trying to press.
  const pageFooters = [
    references.length > 0 ? (
      <div className="assessment-references" key="references">
        {references.map((reference) => (
          <p key={reference.key} className="beap-citation">{reference.short}</p>
        ))}
      </div>
    ) : null,
  ]

  const pages = [
    <IntroPage key="intro" petName={pet.name} isFirstAssessment={isFirstAssessment} />,
    <SliderWithChipsPage
      key="stool"
      title="Stool quality"
      sliderValue={entry.scores.stool}
      onSliderChange={(v) => updateScore('stool', v)}
      pet={pet}
      chipOptions={STOOL_SYMPTOM_OPTIONS}
      chipValue={entry.stoolSymptoms}
      onChipChange={(v) => updateField('stoolSymptoms', v)}
      icon={PooIcon}
      scaleLabels={['Watery / diarrhoea', 'Mixed', 'Well formed']}
      extraOption={STOOL_NONE_TODAY_OPTION}
      emergency={STOOL_EMERGENCY}
    />,
    <VomitingPage
      key="vomiting"
      pet={pet}
      value={entry.vomiting}
      onChange={(v) => updateField('vomiting', v)}
      icon={PuddleIcon}
      species={pet.species}
    />,
    <UrinationPage
      key="urination"
      pet={pet}
      value={entry.urination}
      onChange={(v) => updateField('urination', v)}
      icon={DropletsIcon}
      species={pet.species}
      sex={pet.sex}
    />,
    <DrinkingPage
      key="drinking"
      pet={pet}
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
    <SleepPage
      key="sleep"
      pet={pet}
      value={entry.scores.sleep}
      onChange={(v) => updateScore('sleep', v)}
      description={SLEEP_NOTES[pet.species] ?? SLEEP_NOTES.dog}
      note={
        scoresFromConditions.sleep
          ? prefilledFrom(`${scoresFromConditions.sleep.conditionLabel} assessment`)
          : null
      }
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
          note={
            beapFromConditions[category]
              ? prefilledFrom(`${beapFromConditions[category].conditionLabel} assessment`)
              : null
          }
          onChange={(v) => updateBeap(category, v)}
        />
      )
    ),
    <ReviewPage
      key="review"
      entry={entry}
      onNotesChange={(v) => updateField('notes', v)}
      errorMessage={errorMessage}
      species={pet.species}
    />,
  ]

  if (completed) {
    const { result, previous } = completed
    const change = previous ? result.percent - previous.result.percent : null

    return (
      <div className="screen">
        <Card>
          <SectionTitle>Saved</SectionTitle>
          <p className="assessment-hint">
            Today's assessment is recorded for {pet.name}.
          </p>

          <div className="review-summary">
            <div className="review-summary-row">
              <span>Quality of life today</span>
              <strong style={{ color: result.color }}>
                {result.percent}% — {result.band}
              </strong>
            </div>
            {previous && (
              <div className="review-summary-row">
                <span>Last assessment ({formatDateDDMMYYYY(previous.date)})</span>
                <strong>{previous.result.percent}% — {previous.result.band}</strong>
              </div>
            )}
          </div>

          {/* One comparison, not a verdict. A 3-point move between two days is
              noise, and telling an owner their pet is "improving" on the
              strength of it would be inventing a trend out of a rounding
              difference. The charts are where a trend can honestly be read,
              which is what the link below is for. */}
          {change != null && (
            <p className="assessment-hint">
              {change === 0
                ? 'The same as last time.'
                : `${Math.abs(change)} points ${change > 0 ? 'higher' : 'lower'} than last time. A single comparison is not a trend — the charts show whether it holds.`}
            </p>
          )}

          <Btn
            type="button"
            className="btn-block"
            onClick={() => navigate('/export-report', {
              state: {
                preselect: ['overall', ...WELLBEING_CONCEPTS.map((concept) => `pillar:${concept.key}`)],
              },
            })}
          >
            <FileDown size={16} /> Export a report for your vet
          </Btn>

          <button type="button" className="subtle-link" onClick={() => navigate('/trends')}>
            See all trends
          </button>
          <button type="button" className="subtle-link" onClick={() => navigate('/')}>
            Back to home
          </button>
        </Card>
        <Footer />
      </div>
    )
  }

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
          pageFooters={pageFooters}
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

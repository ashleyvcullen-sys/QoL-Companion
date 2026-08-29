import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, FileDown, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import Modal from '../components/Modal'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import ChartView from '../components/ChartView'
import DayAnswersModal from '../components/DayAnswersModal'
import ChoiceButtons from '../components/ChoiceButtons'
import { usePets } from '../lib/PetsContext'
import {
  SAME_AS_ASSESSMENT,
  SEVERITY,
  askedParameters,
  describeConditionDay,
  visibleParameters,
  beapAppetiteFromVcogGrade,
  conditionByKey,
  evaluateParameter,
  sleepScoreFromSeverity,
  sleepSeverityFromScore,
  vcogGradeFromBeapAppetite,
} from '../lib/conditions'
import { chartsForCondition, chartByKey } from '../lib/charts'
import { useQolHistory } from '../lib/useQolHistory'
import { updateBeapCategory, updateGeneralField, updateGeneralScore } from '../lib/qolData'
import { describeMedicationSchedule, medicationsForCondition, useMedications } from '../lib/medicationsData'
import { daysSinceTreatment, isCancerConfigured, parametersFor } from '../lib/cancerConfig'
import { GI_KEY, isGiConfigured } from '../lib/giConfig'
import { SIGN_MODULE_LIST, treatmentModuleByKey } from '../lib/cancerModules'
import ConditionParameter from '../components/ConditionParameter'
import ConditionEvents from '../components/ConditionEvents'
import PetText from '../components/PetText'
import {
  addPetCondition,
  saveConditionConfig,
  removePetCondition,
  saveConditionEntry,
  todayIsoDate,
  useConditionEntries,
  useConditionEvents,
  usePetConditions,
} from '../lib/conditionsData'

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function ConditionMonitoring() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { conditions, loading, refresh } = usePetConditions(pet?.id)

  // Loaded for the prefill: a question this condition shares with the
  // Overall Quality of Life Assessment is answered once, and today's
  // assessment is where that answer lives. Without this the owner would be
  // asked the same thing twice on the same day.
  const { generalEntries, painEntries } = useQolHistory(pet?.id)
  const { medications } = useMedications(pet?.id)
  // Only what {name} is on NOW. A finished course is history, and listing it
  // under "is she currently on any medication?" would answer that question
  // wrongly.
  // This condition's medications, not every medication. Anything the owner
  // has not assigned still shows — "I have not said what this is for" is far
  // more common than "this is definitely not for the thing I am looking at".
  const activeMedications = medicationsForCondition(
    medications.filter((medication) => medication.active),
    definition?.key,
  )

  // Which condition is determined by the URL, so each one is a real page you
  // can navigate back to rather than a tab inside a single screen.
  const navigate = useNavigate()
  const { conditionKey } = useParams()
  const currentKey = conditionKey ?? null
  const definition = conditionByKey(currentKey)

  // The row for THIS condition, which carries the per-pet config. Only a
  // composed condition (cancer) uses it; for everything else it is `{}` and
  // resolving is a no-op.
  const petCondition = conditions.find((entry) => entry.conditionKey === currentKey) ?? null
  const config = petCondition?.config ?? {}

  const { entries, loading: entriesLoading, refresh: refreshEntries } =
    useConditionEntries(pet?.id, currentKey)
  const { events, loading: eventsLoading, refresh: refreshEvents } =
    useConditionEvents(pet?.id, currentKey)

  // One object for every answer in the condition, including follow-ups.
  // Seeded from today's saved entry so revisiting shows what's there.
  const [draft, setDraft] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // Which day's answers are open, as an ISO date. Null is closed.
  const [openDay, setOpenDay] = useState(null)
  // Confirmation exists because this now genuinely deletes the readings. It
  // did not before — the button used to remove the condition and silently
  // leave every entry behind, so a mis-tap was recoverable by re-adding it.
  // It no longer is.
  const [confirmRemove, setConfirmRemove] = useState(null)
  // Shown after a successful save. Until now the form gave no answer at all
  // when it worked — the page simply sat there, which reads as "nothing
  // happened" and invites a second tap on Save.
  const [justSaved, setJustSaved] = useState(false)

  const today = todayIsoDate()

  // How often this condition is worth filling in. Absent means daily, which
  // is how every condition behaved before arthritis.
  const cadence = definition?.cadence ?? null

  // Whole days between the last entry and today. Parsed as UTC midnight on
  // both sides so a clock change cannot make this off by one.
  function daysSince(dateIso) {
    if (!dateIso) return null
    const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dateIso}T00:00:00Z`)
    return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null
  }

  const todaysEntry = entries.find((entry) => entry.date === today) ?? null
  const latestEntry = entries[entries.length - 1] ?? null

  // Declared AFTER latestEntry, and that ordering is the whole point: these
  // two read it, and a `const` cannot be read on a line above its own
  // declaration. Reversed, every render of this screen threw "Cannot access
  // 'latestEntry' before initialization" before it drew anything.
  const sinceLast = daysSince(latestEntry?.date)
  const dueIn = cadence && sinceLast != null ? cadence.days - sinceLast : null


  // Any emergency answer anywhere in the condition, surfaced at the top of
  // the card as well as beside the question — an owner scrolling to save
  // shouldn't be able to miss it.
  // For a fixed condition this is definition.parameters; for cancer it is
  // composed from the owner's module selection and their list of masses.
  // A composed condition shows no questions until setup has been done. The
  // core parameters exist regardless of configuration, so testing
  // parameters.length here would always pass and the form would appear
  // before the owner had told us anything about the diagnosis.
  // Each composed condition answers "has this been set up?" its own way.
  // Cancer keys it on a diagnosis having been answered; GI on a condition
  // having been picked or typed. Asking cancer's question of a GI config
  // would send every GI owner back to setup forever.
  const isConfigured = definition?.key === GI_KEY ? isGiConfigured(config) : isCancerConfigured(config)
  const needsSetup = Boolean(definition?.composed) && !isConfigured
  // Asked parameters only. A referenced one (cardiac appetite) belongs to the
  // condition and is charted below, but the owner already answered it in the
  // daily assessment and is not asked again here.
  //
  // This is the list BEFORE preconditions are applied, and it has to be:
  // `values` is built from it, and the visible list is built from `values`.
  // Deriving the visible list here instead would be circular — and would
  // throw on first render rather than fail quietly.
  const askedList = needsSetup
    ? []
    : askedParameters(parametersFor(definition, config, pet?.species))

  // Answers already given in TODAY'S assessment, for the questions that are
  // the same question. Same day only — deliberately. Arthritis is filled in
  // weekly, so most weeks there will be nothing here, and that is the right
  // outcome: showing Tuesday's ambulation score on Friday's form, in a field
  // that looks answered, would be presenting stale data as current.
  const todaysPain = painEntries.find((entry) => entry.date === today) ?? null
  const todaysGeneral = generalEntries.find((entry) => entry.date === today) ?? null

  function assessmentValueFor(parameter) {
    // A whole field on the assessment row rather than a score — vomiting is
    // an object, not a number, so it comes back as it was stored.
    if (parameter.assessmentField) {
      const recorded = todaysGeneral?.[parameter.assessmentField]
      // An untouched vomiting question is a shape with nothing chosen in it,
      // not an answer. Pre-filling from that would mark the question answered
      // on the strength of the assessment having been opened.
      if (!recorded || recorded.hasVomited == null) return null
      return recorded
    }

    // Questions that fill a general score rather than a BEAAAAPP category —
    // sleep. Stored there as a score, shown here as a severity.
    if (parameter.scoreKey) {
      const recorded = todaysGeneral?.scores?.[parameter.scoreKey]
      if (recorded == null || recorded === 'unsure') return null
      return sleepSeverityFromScore(recorded)
    }

    if (!parameter.beapKey || !todaysPain) return null
    const recorded = todaysPain.beap?.[parameter.beapKey] ?? null
    if (recorded == null) return null
    // A graded question shows a grade, not a level, so the assessment's answer
    // is converted on the way in — and back again on the way out.
    return parameter.beapFromGrade ? vcogGradeFromBeapAppetite(recorded) : recorded
  }

  const assessmentPrefill = {}
  for (const parameter of askedList) {
    const prefilled = assessmentValueFor(parameter)
    if (prefilled != null) assessmentPrefill[parameter.key] = prefilled
  }

  // Order matters: anything the owner has actually typed or saved on this
  // form wins over the pre-filled answer. The pre-fill is a starting point,
  // not an override.
  const values = { ...assessmentPrefill, ...(draft ?? todaysEntry?.values ?? {}) }

  // What actually goes on the form. A question whose precondition is not met
  // is not shown at all — and because this is recomputed from `values` on
  // every render, answering "yes, on a diet trial" makes the follow-on
  // question appear immediately rather than after a save.
  const parameters = visibleParameters(askedList, values)

  // Credited at the foot of the page: the condition's own source, plus any
  // belonging to the questions on screen right now.
  // A citation may be a plain string, or keyed by species where only one
  // species' wording follows the instrument — the same shape alert messages
  // use.
  const citationFor = (citation) => (
    citation == null || typeof citation === 'string'
      ? citation
      : citation[pet?.species] ?? null
  )
  const pageCitations = [...new Set(
    [definition?.citation, ...parameters.map((parameter) => citationFor(parameter.citation))]
      .filter(Boolean),
  )]

  // Days since the last treatment, derived from the event the owner already
  // logs rather than asked. "Lethargic on day 8" is a different question to
  // "lethargic generally" — that is when a neutropenic patient gets into
  // trouble — so the form says which day it is above the questions.
  // The note belongs to the module, but the daily form works from a flat
  // parameter list — so this maps an instance type back to the module that
  // owns it.
  function instanceNoteFor(instanceType) {
    const module = SIGN_MODULE_LIST.find((m) => m.perInstance === instanceType)
    return module?.instanceNote?.[pet?.species] ?? null
  }

  const treatmentModule = definition?.composed ? treatmentModuleByKey(config?.treatment) : null
  const treatmentDay = treatmentModule?.usesTreatmentDay
    ? daysSinceTreatment(events, today)
    : null

  // Whether this pet is on medication for THIS condition. Stored on the
  // condition's config rather than asked as a daily question: it is a standing
  // fact about their treatment, not something that changes between Tuesday and
  // Wednesday, and asking it every day would train people to tap past it.
  //
  // Cancer is excluded — its treatment module already asks this, and asking
  // twice on one screen is exactly the duplication we have spent the day
  // removing.
  // Skipped for cancer, which asks about treatment in its own setup. GI is
  // composed too but has no treatment step, so without this a GI owner would
  // never be asked about medication at all.
  const asksAboutMedication = Boolean(definition)
    && (!definition.composed || definition.key === GI_KEY)
  const onMedication = config?.onMedication ?? null

  async function handleMedicationAnswer(answer) {
    if (busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      // Answering is a deliberate act, so it may create the pet_conditions
      // row. Reading about a condition still leaves no trace, and this does
      // not mark the condition as tracked — that still takes a saved
      // assessment (see Conditions.jsx).
      const id = petCondition?.id
        ?? (await addPetCondition({ petId: pet.id, conditionKey: definition.key })).id
      await saveConditionConfig(id, { ...(config ?? {}), onMedication: answer })
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function goToMedications() {
    // Same round trip cancer's setup uses, so the owner lands back here
    // rather than on the medications list wondering where they were.
    navigate('/medications', {
      state: {
        returnTo: `/conditions/${definition.key}`,
        returnLabel: `${definition.label} monitoring`,
      },
    })
  }

  const emergencies = parameters
    .map((parameter) => evaluateParameter(parameter, values[parameter.key], pet?.species))
    .filter((verdict) => verdict?.severity === SEVERITY.EMERGENCY)

  async function handleRemove(condition) {
    setErrorMessage('')
    setBusy(true)
    try {
      await removePetCondition(condition)
      setConfirmRemove(null)
      refresh()
      navigate('/conditions')
    } catch (error) {
      setErrorMessage(error.message || 'Could not remove that condition.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!definition || busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      // Blanks are dropped rather than stored as null, so "not asked today"
      // and "answered as nothing" never look the same in the history. 'unsure'
      // IS stored — it's a real answer, and losing it would make a deliberate
      // "not sure" indistinguishable from a skipped question.
      const stored = {}
      for (const [key, raw] of Object.entries(values)) {
        if (raw === '' || raw == null) continue
        stored[key] = raw
      }

      // Saving an assessment is what starts monitoring. The row is created
      // here rather than when the owner tapped in, so that reading about a
      // condition and backing out leaves no trace. Upsert on
      // (pet_id, condition_key), so doing this on every save is harmless.
      if (!petCondition) {
        await addPetCondition({ petId: pet.id, conditionKey: definition.key })
      }

      await saveConditionEntry({
        petId: pet.id,
        conditionKey: definition.key,
        values: stored,
        notes: notes || todaysEntry?.notes || '',
      })
      // The same answer, kept the same in both places. Only categories the
      // owner actually answered here, and only where the value has moved —
      // an unchanged answer needs no write, and 'unsure' is not a score.
      let syncFailed = false
      try {
        for (const parameter of parameters) {
          if (parameter.assessmentField) {
            const answer = stored[parameter.key]
            if (!answer || typeof answer !== 'object') continue
            // Nothing to write if the assessment already says this.
            if (JSON.stringify(todaysGeneral?.[parameter.assessmentField]) === JSON.stringify(answer)) continue
            await updateGeneralField({
              petId: pet.id,
              date: today,
              field: parameter.assessmentField,
              value: answer,
            })
            continue
          }

          if (parameter.scoreKey) {
            const severity = Number(stored[parameter.key])
            if (!Number.isFinite(severity)) continue
            const asScore = sleepScoreFromSeverity(severity)
            if (todaysGeneral?.scores?.[parameter.scoreKey] === asScore) continue
            await updateGeneralScore({
              petId: pet.id,
              date: today,
              key: parameter.scoreKey,
              value: asScore,
            })
            continue
          }

          if (!parameter.beapKey) continue
          const raw = Number(stored[parameter.key])
          if (!Number.isFinite(raw)) continue
          const score = parameter.beapFromGrade ? beapAppetiteFromVcogGrade(raw) : raw
          if (score == null) continue
          if (todaysPain?.beap?.[parameter.beapKey] === score) continue
          await updateBeapCategory({
            petId: pet.id,
            date: today,
            category: parameter.beapKey,
            value: score,
          })
        }
      } catch (syncError) {
        // The condition entry itself saved. Say precisely that, rather than
        // letting the outer catch report a failure that did not happen.
        syncFailed = true
        setErrorMessage(
          `Saved here, but today's assessment could not be updated to match: ${syncError.message}`,
        )
      }

      setDraft(null)
      setNotes('')
      refreshEntries()
      refresh()
      // A local flag rather than reading errorMessage: setState above does
      // not change the value this closure captured, so testing the state here
      // would always see the message as empty and pop the modal over the top
      // of a failure.
      if (!syncFailed) setJustSaved(true)
    } catch (error) {
      setErrorMessage(error.message || 'Could not save that entry.')
    } finally {
      setBusy(false)
    }
  }

  // This condition's summary calendar, and only that — described in
  // lib/charts.js so the report draws exactly the same thing from exactly the
  // same descriptor. Lines live in the Overall Quality of Life section now;
  // see the note above chartsForCondition for why.
  const charts = chartsForCondition({
    definition,
    entries,
    events,
    // Only for the calendar's start/stop marks — the medication list itself
    // lives on its own screen.
    medications,
    species: pet?.species,
    config,
  })

  // The entry behind the day whose answers are open, and the definition as
  // it was actually asked — cancer resolves its parameters per pet, so the
  // static list would describe questions this owner was never shown.
  const openEntry = openDay ? entries.find((entry) => entry.date === openDay) ?? null : null
  const resolvedForDay = definition
    ? { ...definition, parameters: parametersFor(definition, config, pet?.species) }
    : null

  const calendarChart = definition ? chartByKey(charts, `${definition.key}:calendar`) : null


  return (
    <div className="screen">
      <HomeLink />

      <Link to="/conditions" className="subtle-link">← All Conditions</Link>

      {loading && <Card><p>Loading…</p></Card>}

      {!definition && !loading && (
        <Card>
          <SectionTitle>Not Found</SectionTitle>
          <p>That condition isn't available.</p>
          <Link to="/conditions" className="subtle-link">Back to All Conditions</Link>
        </Card>
      )}

      {definition && (
        <>
          <Card>
            <div className="condition-heading">
              {definition.Icon && (
                <span className="icon-badge condition-badge">
                  <definition.Icon size={34} color="#fff" />
                </span>
              )}
              <SectionTitle>{definition.label}</SectionTitle>
            </div>
            {/* Summary first, then intro: what this condition covers, then
                what monitoring it involves. The summary moved here from the
                condition list, where it was being read before anyone had
                chosen anything. */}
            {definition.summary && (
              <p className="assessment-hint condition-intro">
                <PetText template={definition.summary} pet={pet} />
              </p>
            )}
            {/* A string or a list of them. Cognitive decline needs two: a
                caution that sends someone to a vet, and separately how to use
                the section. Run together in one block, the caution reads as
                preamble to the instructions rather than as the point. */}
            {(Array.isArray(definition.intro) ? definition.intro : [definition.intro])
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="assessment-hint condition-intro">
                  <PetText template={paragraph} pet={pet} />
                </p>
              ))}
          </Card>

          {asksAboutMedication && (
            <Card>
              <SectionTitle>Medication</SectionTitle>
              <p className="assessment-hint">
                Is {pet.name} currently on any medication for{' '}
                <PetText template="{their}" pet={pet} /> {definition.label.toLowerCase()}?
              </p>
              <ChoiceButtons
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                value={onMedication}
                onChange={handleMedicationAnswer}
              />

              {/* What is actually recorded, shown here rather than only on
                  the medications screen. Saying "yes" and then being asked to
                  go and look somewhere else to find out what you said yes to
                  is a round trip for information the app already has.
                  Offered, never invented: the app does not know the drug, the
                  dose or the schedule, so an empty list asks rather than
                  guesses. */}
              {onMedication === 'yes' && (
                <>
                  {activeMedications.length > 0 ? (
                    <>
                      <div className="condition-medication-list">
                        {activeMedications.map((medication) => (
                          <div key={medication.id} className="condition-medication-row">
                            <span className="condition-medication-name">{medication.name}</span>
                            <span className="assessment-hint">
                              {[medication.dose, describeMedicationSchedule(medication)]
                                .filter(Boolean).join(' — ')}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="assessment-hint">
                        Anything not assigned to a condition is shown here too.
                      </p>
                      <button type="button" className="subtle-link" onClick={goToMedications}>
                        Edit in Medications
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="assessment-hint">
                        Nothing recorded yet. Would you like to add it to {pet.name}'s
                        medications, so you can set up reminders and record each dose?
                      </p>
                      <Btn
                        type="button"
                        variant="outline"
                        className="btn-block"
                        onClick={goToMedications}
                        disabled={busy}
                      >
                        Add to medications
                      </Btn>
                    </>
                  )}
                </>
              )}
            </Card>
          )}

          {/* A composed condition with nothing selected has no questions to
              show, so the daily form would be an empty card. Sending the
              owner to setup is the only useful thing this screen can do
              until they have chosen something. */}
          {needsSetup && (
            <Card>
              <SectionTitle>Start With The Diagnosis</SectionTitle>
              <p className="assessment-hint">
                Cancer looks different in every patient, so tell us what {pet.name} has been
                diagnosed with — or that you're still waiting to find out — and we'll ask about
                the right things.
              </p>
              <Btn type="button" className="btn-block" onClick={() => navigate(`/conditions/${definition.key}/setup`)}>
                Choose diagnosis
              </Btn>
            </Card>
          )}

          {!needsSetup && (
          <Card>
            {emergencies.length > 0 && (
              <p className="condition-emergency" role="alert">
                <AlertTriangle size={17} />
                <span>{emergencies[0].message}</span>
              </p>
            )}

            {treatmentDay != null && (
              <p className="condition-flag" role="status">
                <span>
                  Day {treatmentDay} after {pet.name}'s last treatment.
                </span>
              </p>
            )}

            {parameters.map((parameter, index) => (
              <div key={parameter.key}>
                {/* A heading each time the group changes, so one lump's
                    questions read as a block rather than three unrelated
                    questions with the same name repeated in each label. */}
                {parameter.groupLabel && parameter.groupLabel !== parameters[index - 1]?.groupLabel && (
                  <h3 className="condition-group-heading">{parameter.groupLabel}</h3>
                )}
                {/* Once, above the first instance of its kind — this is the
                    moment an owner is being asked for a number they may not
                    be able to give. */}
                {parameter.instanceType && parameter.instanceType !== parameters[index - 1]?.instanceType && instanceNoteFor(parameter.instanceType) && (
                  <p className="assessment-hint">
                    <PetText template={instanceNoteFor(parameter.instanceType)} pet={pet} />
                  </p>
                )}                <ConditionParameter
                  parameter={parameter}
                  values={values}
                  pet={pet}
                  note={
                    assessmentValueFor(parameter) != null
                      ? SAME_AS_ASSESSMENT
                      : null
                  }
                  returnTo={`/conditions/${definition.key}`}
                  returnLabel={`${definition.label} monitoring`}
                  number={index + 1}
                  onChange={setDraft}
                />
              </div>
            ))}

            <div className="field">
              <label htmlFor="condition-notes">Notes (optional)</label>
              <textarea
                id="condition-notes"
                rows={2}
                value={notes || todaysEntry?.notes || ''}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Btn type="button" className="btn-block" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : todaysEntry ? 'Update today’s entry' : 'Save entry'}
            </Btn>
            {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
            {!entriesLoading && latestEntry && (
              <p className="assessment-hint">
                Last recorded {formatDateDDMMYYYY(latestEntry.date)}.
                {cadence && dueIn != null && (
                  dueIn > 1
                    ? ` Next one due in ${dueIn} days.`
                    : dueIn === 1
                      ? ' Next one due tomorrow.'
                      : ' Due now.'
                )}
              </p>
            )}

            {!entriesLoading && !latestEntry && cadence && (
              <p className="assessment-hint">
                This one is worth filling in {cadence.label} rather than every day.
              </p>
            )}
            {definition.composed && (
              <Link to={`/conditions/${definition.key}/setup`} className="subtle-link">
                Change what you're monitoring
              </Link>
            )}
          </Card>
          )}

          {calendarChart && (
            <Card>
              <SectionTitle>{pet.name}'s {definition.label} Summary</SectionTitle>
              <ChartView chart={calendarChart} onOpenDay={setOpenDay} />
            </Card>
          )}

          {/* Offered where the record is, not on a menu somewhere else. The
              moment an owner decides their vet should see this is the moment
              they are looking at it. */}
          {charts.length > 0 && (
            <Card>
              <SectionTitle>Take This To Your Vet</SectionTitle>
              <p className="assessment-hint">
                Export {pet.name}'s {definition.label.toLowerCase()} record as a report. This
                page's summary is selected to start with, and you can add {pet.name}'s general
                quality of life trends on the next screen.
              </p>
              <Btn
                type="button"
                className="btn-block"
                onClick={() => navigate('/export-report', {
                  state: { preselect: charts.map((chart) => chart.key) },
                })}
              >
                <FileDown size={16} /> Export this record
              </Btn>
            </Card>
          )}

          <Card>
            <SectionTitle>Events</SectionTitle>
            <p className="assessment-hint">
              Episodes, diagnoses, and medications started or stopped. Anything recorded on a
              day is marked on the calendar above.
            </p>
            <ConditionEvents
              petId={pet.id}
              conditionKey={definition.key}
              events={events}
              loading={eventsLoading}
              onChange={refreshEvents}
            />
          </Card>

          <Card>
            <SectionTitle>Stop Tracking</SectionTitle>
            <p className="assessment-hint">
              Removing {definition.label} deletes the readings and events recorded for it. Your
              general quality of life history isn't affected.
            </p>
            {conditions
              .filter((condition) => condition.conditionKey === definition.key)
              .map((condition) => (
                <Btn
                  key={condition.id}
                  type="button"
                  variant="danger"
                  className="btn-block"
                  onClick={() => setConfirmRemove(condition)}
                >
                  <Trash2 size={16} /> Stop tracking {definition.label}
                </Btn>
              ))}
          </Card>

        </>
      )}

      {justSaved && (
        <Modal title="Saved" onClose={() => setJustSaved(false)}>
          <p>
            Today's {definition.label} assessment is recorded for {pet.name}.
          </p>
          <p className="assessment-hint">
            You can change today's answers any time — coming back to this page and saving
            again replaces them rather than adding a second entry.
          </p>
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setJustSaved(false)}>
              Stay here
            </Btn>
            <Btn
              type="button"
              onClick={() => {
                setJustSaved(false)
                navigate('/conditions')
              }}
            >
              Back to conditions
            </Btn>
          </div>
        </Modal>
      )}

      {confirmRemove && (
        <Modal
          title={`Stop tracking ${definition.label}?`}
          onClose={() => setConfirmRemove(null)}
        >
          <p>
            This deletes every reading and event you've recorded for {definition.label}
            {entries.length > 0 && ` — ${entries.length} ${entries.length === 1 ? 'day' : 'days'} of readings`}
            {events.length > 0 && ` and ${events.length} ${events.length === 1 ? 'event' : 'events'}`}.
            It can't be undone.
          </p>
          <p className="assessment-hint">
            {pet.name}'s general quality of life history, body condition and photos aren't affected.
          </p>
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setConfirmRemove(null)}>
              Keep tracking
            </Btn>
            <Btn
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => handleRemove(confirmRemove)}
            >
              {busy ? 'Deleting…' : 'Delete and stop'}
            </Btn>
          </div>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        </Modal>
      )}

      {/* Credits at the foot of the page, not under the intro. They are read
          once, if at all, and sitting between the description and the first
          question they pushed the thing the owner came to do further down
          every single visit.
          
          The condition's own citation, plus any carried by the questions
          actually on screen — a composed condition only credits the
          instruments the owner's selections brought in, rather than every
          instrument the section could ever use. Deduplicated, because two
          questions may draw on the same source. */}
      {pageCitations.length > 0 && (
        <div className="page-references">
          {pageCitations.map((citation) => (
            <p key={citation} className="beap-citation">{citation}</p>
          ))}
        </div>
      )}

      {openDay && (
        <DayAnswersModal
          title="This Day's Answers"
          dateLabel={formatDateDDMMYYYY(openDay)}
          rows={resolvedForDay
            ? describeConditionDay(resolvedForDay, openEntry?.values, pet?.species)
            : []}
          pet={pet}
          emptyMessage="Nothing was recorded for this condition on this day."
          onClose={() => setOpenDay(null)}
        />
      )}

      <Footer />
    </div>
  )
}

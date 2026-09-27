import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import Modal from '../components/Modal'
import HomeLink from '../components/HomeLink'
import { usePets } from '../lib/PetsContext'
import { usePremiumDenial } from '../lib/premiumErrors'
import {
  SAME_AS_ASSESSMENT,
  askedParameters,
  carriedAnswers,
  describeParameterAnswer,
  formParameters,
  standingAnswers,
  visibleParameters,
  beapAppetiteFromVcogGrade,
  conditionByKey,
  sleepScoreFromSeverity,
  sleepSeverityFromScore,
  vcogGradeFromBeapAppetite,
  WHY_LABEL,
} from '../lib/conditions'
import { useQolHistory } from '../lib/useQolHistory'
import { updateBeapCategory, updateGeneralField, updateGeneralScore } from '../lib/qolData'
import { daysSinceTreatment, isCancerConfigured, parametersFor } from '../lib/cancerConfig'
import { MONITORING_STATE, elapsedLabel, monitoringStatus } from '../lib/monitoringStatus'
import { GI_KEY, hasGiFoodAllergySelected, isGiConfigured } from '../lib/giConfig'
// Only for the calendar's start/stop marks — the list itself lives on the
// Medications tab, and this screen no longer shows one.
import { SIGN_MODULE_LIST, treatmentModuleByKey } from '../lib/cancerModules'
import ConditionParameter from '../components/ConditionParameter'
import HowTo from '../components/HowTo'
import ConditionEvents from '../components/ConditionEvents'
import PetText from '../components/PetText'
import ReminderDayPicker from '../components/ReminderDayPicker'
import SwipeableWizard from '../components/SwipeableWizard'
import { ConditionState, ConditionStrip } from '../components/ConditionStrip'
import Skeleton from '../components/Skeleton'
import { conditionHistory } from '../lib/conditionHistory'
import { monitoredLabels } from '../lib/monitoredList'
import {
  CONDITION_CADENCE_OPTIONS,
  cadenceLabel,
  dayModeFor,
  saveConditionSchedule,
  scheduleForCondition,
  reminderDayHint,
} from '../lib/cadence'
import { scheduleConditionReminder } from '../lib/notifications'
import { formatDateDDMMYY } from '../lib/formatDate'
import {
  addPetCondition,
  removePetCondition,
  saveConditionEntry,
  todayIsoDate,
  useConditionEntries,
  useConditionEvents,
  usePetConditions,
} from '../lib/conditionsData'


export default function ConditionMonitoring() {
  const { selectedPet, refresh: refreshPets } = usePets()
  // Turns an RLS refusal into the paywall rather than a Postgres string.
  const premiumOr = usePremiumDenial('conditions')
  const pet = selectedPet
  const { conditions, loading, refresh } = usePetConditions(pet?.id)

  // Loaded for the prefill: a question this condition shares with the
  // Overall Quality of Life Assessment is answered once, and today's
  // assessment is where that answer lives. Without this the owner would be
  // asked the same thing twice on the same day.
  const { generalEntries, painEntries } = useQolHistory(pet?.id)

  // Which condition is determined by the URL, so each one is a real page you
  // can navigate back to rather than a tab inside a single screen.
  const navigate = useNavigate()
  const { conditionKey } = useParams()
  const currentKey = conditionKey ?? null
  const definition = conditionByKey(currentKey)

  // Declared AFTER `definition`, and that ordering is load-bearing: this
  // reads it, and a `const` cannot be read on a line above its own
  // declaration. Written the other way round — which is how it shipped — the
  // screen threw "Cannot access 'definition' before initialization" on every
  // condition, before drawing anything.
  //
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
  // Whether the standing answers — diagnosis, diet, start date — are open
  // for editing rather than summarised.
  const [editStanding, setEditStanding] = useState(false)
  // Confirmation exists because this now genuinely deletes the readings. It
  // did not before — the button used to remove the condition and silently
  // leave every entry behind, so a mis-tap was recoverable by re-adding it.
  // It no longer is.
  const [confirmRemove, setConfirmRemove] = useState(null)
  // Shown after a successful save. Until now the form gave no answer at all
  // when it worked — the page simply sat there, which reads as "nothing
  // happened" and invites a second tap on Save.
  const [justSaved, setJustSaved] = useState(false)

  // The cadence control at the top of the card, closed until asked for.
  // Whether the questionnaire is open. Ash's instruction 5 Sep 2026: a
  // condition that is up to date should not open onto a form.
  //
  // Held as an override rather than as the state itself, so it follows the
  // due-ness until the owner says otherwise — a form opened by hand stays
  // open, and one nobody has touched opens or closes with the schedule.
  const [formOpenOverride, setFormOpenOverride] = useState(null)
  // Which question is on screen, so the standing facts above the form can be
  // shown once rather than over every one of them — Ash's instruction
  // 27 Sep 2026, from the allergies form: the diagnosis, the diet trial and
  // the way back into them belong on the first page, not on all fourteen.
  const [wizardPage, setWizardPage] = useState(0)

  // The range toggle, the chart descriptors and the day-answers modal were
  // removed with the charts on 24 Sep 2026 — Trends owns all three.

  const [editingCadence, setEditingCadence] = useState(false)
  const [cadenceError, setCadenceError] = useState('')

  const today = todayIsoDate()

  const todaysEntry = entries.find((entry) => entry.date === today) ?? null
  const latestEntry = entries[entries.length - 1] ?? null

  // Declared AFTER latestEntry, and that ordering is the whole point: this
  // reads it, and a `const` cannot be read on a line above its own
  // declaration. Reversed, every render of this screen threw "Cannot access
  // 'latestEntry' before initialization" before it drew anything.
  //
  // Through lib/monitoringStatus rather than a local subtraction, so this
  // screen, the condition list and the Schedule screen cannot tell the same
  // owner three different things about the same pet. It also picks up the
  // owner's OWN chosen frequency, which this screen used to ignore: someone
  // who set arthritis to fortnightly was still told it was due on day seven,
  // because the sum here only ever read the clinical default.
  const status = monitoringStatus({
    definition,
    schedule: pet?.schedule,
    lastDate: latestEntry?.date ?? null,
    today,
  })

  const cadence = definition && pet ? scheduleForCondition(pet, definition) : null

  // Open when something is owed, closed when nothing is — Ash's instruction
  // 5 Sep 2026, the same rule the home card follows for its buttons.
  //
  // Never closed for a condition with no entries at all: there is nothing to
  // be up to date with, and a screen that offers to "edit" a record that does
  // not exist is a dead end.
  const nothingOwed = status?.state === MONITORING_STATE.OK && latestEntry != null
  const formOpen = formOpenOverride ?? !nothingOwed

  // Nothing is drawn until the readings are in — Ash's report 24 Sep 2026
  // that opening a condition glitches before it loads.
  //
  // It was not a rendering problem, it was an ANSWER problem: with no
  // entries yet, "when was this last recorded?" is null, so the screen
  // concluded a check-in was owed and opened the questionnaire. A moment
  // later the entries arrived, most conditions turned out to be up to date,
  // and the form was replaced by the card that says so. The flash was the
  // screen changing its mind in public.
  //
  // A cached condition (one visited already this session) has its entries
  // immediately and shows no skeleton at all.
  const ready = !loading && !entriesLoading

  // What a composed condition is currently set to watch — Ash's instruction
  // 5 Sep 2026. Empty for everything else: a condition with a fixed question
  // set has nothing to list and nothing to change.
  const monitoring = definition ? monitoredLabels(definition, config) : []

  // The same strip the home screen shows for this condition, from the same
  // function — Ash's instruction 4 Sep 2026, at the top of the screen with how
  // often it is set to be assessed.
  //
  // Declared AFTER `cadence`, and that ordering is the point: the strip counts
  // fourteen CHECK-INS on this pet's cadence, and without it every fortnightly
  // condition fell back to daily and drew thirteen missed check-ins for an
  // owner who was up to date. Ash's report 5 Sep 2026 — the home card was
  // passing this and this screen was not, so the same condition drew two
  // different strips on two screens.
  const history = useMemo(() => {
    if (!definition || !pet) return null
    try {
      return conditionHistory({
        definition,
        config: petCondition?.config ?? {},
        entries,
        species: pet.species,
        today,
        cadenceDays: cadence?.days ?? 1,
        remindersOff: cadence?.off ?? false,
      })
    } catch (error) {
      console.error('Could not summarise that fortnight:', error.message)
      return null
    }
  }, [definition, pet, petCondition, entries, today, cadence?.days, cadence?.off])


  async function changeCadence(patch) {
    setCadenceError('')
    const error = await saveConditionSchedule({ pet, conditionKey: definition.key, patch })
    if (error) {
      setCadenceError(error.message || 'Could not save that.')
      return
    }
    // BOTH refreshes, and the pets one is the one that matters. The cadence
    // shown on this screen comes from scheduleForCondition(pet, ...), which
    // reads pet.schedule out of PetsContext — and saveConditionSchedule
    // writes to the pets table. Refreshing only the CONDITIONS left the pet
    // in context holding its old schedule, so the select snapped straight
    // back to the previous value and stayed there until the app was
    // reloaded. Ash's report, 13 Sep 2026.
    await Promise.all([refresh(), refreshPets()])

    // Rescheduled here as well as saved. The Reminders screen self-heals its
    // own reminders when it is opened; an owner who changes the cadence here
    // and never goes there would otherwise keep the old reminder until they
    // did. scheduleConditionReminder checks permission itself, so this is
    // inert when notifications are off.
    const next = { ...(pet.schedule?.conditions?.[definition.key] ?? {}), ...patch }
    await scheduleConditionReminder({
      petId: pet.id,
      petName: pet.name,
      conditionKey: definition.key,
      conditionLabel: definition.label,
      cadenceDays: next.days ?? cadence?.days ?? 1,
      cadenceDay: next.day ?? null,
      fromDate: latestEntry?.date ? new Date(`${latestEntry.date}T00:00:00`) : new Date(),
    })
  }


  // The emergency alert appears ONCE, beside the question that raised it.
  //
  // It used to be repeated at the top of the card too, on the reasoning that
  // an owner scrolling to save shouldn't be able to miss it. In practice
  // answering one question put the same red panel on screen twice, which
  // reads as two separate problems rather than one emphasised — and the copy
  // at the top was rendered raw, so it could never have used the pet's name
  // anyway.
  //
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

  // Standing facts, carried from the last entry that answered them.
  //
  // Which allergy {name} has been diagnosed with, which diet the trial uses,
  // the day it started — none of those change from Tuesday to Wednesday, and
  // asking again daily is how one question ends up with three answers across
  // a week. Entries before today only: today's own answer, if there is one,
  // comes through `todaysEntry` below and must win.
  const carried = carriedAnswers(askedList, entries.filter((entry) => entry.date !== today))

  // Order matters: anything the owner has actually typed or saved on this
  // form wins over a carried or pre-filled answer. Both are starting points,
  // not overrides.
  const values = { ...carried, ...assessmentPrefill, ...(draft ?? todaysEntry?.values ?? {}) }

  // The questions that have stopped being asked, and the answers standing for
  // them. Shown as a card at the top with a way back in, so "asked once" does
  // not mean "answered forever".
  const standing = standingAnswers(askedList, carried)

  // What actually goes on the form. A question whose precondition is not met
  // is not shown at all — and because this is recomputed from `values` on
  // every render, answering "yes, on a diet trial" makes the follow-on
  // question appear immediately rather than after a save.
  //
  // formParameters then drops the standing ones and rewords the repeats
  // ("is she STILL on a diet trial?"). It runs last so the dependency chain
  // is resolved against the real answers rather than the trimmed list.
  // Retired questions are never put on the form, even on an entry that
  // already answered one — the replacement is asked instead. Their stored
  // answers still read back in history (visibleParameters keeps them there).
  const parameters = formParameters(
    visibleParameters(askedList.filter((parameter) => !parameter.retired), values),
    carried,
    { editStanding },
  )

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
  async function handleRemove(condition) {
    setErrorMessage('')
    setBusy(true)
    try {
      await removePetCondition(condition)
      setConfirmRemove(null)
      refresh()
      navigate('/conditions')
    } catch (error) {
      setErrorMessage(premiumOr(error, 'Could not remove that condition.'))
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
      setErrorMessage(premiumOr(error, 'Could not save that entry.'))
    } finally {
      setBusy(false)
    }
  }

  // The charts this condition draws, the day-answers modal and the note
  // deletion that went with it all lived here until 24 Sep 2026. They live
  // on Trends now — see the note further down.

  return (
    <div className="screen">
      <HomeLink />

      {/* "← All Conditions" was removed on Ash's instruction 24 Sep 2026.
          The sticky Back bar above the screen already goes there — it is the
          same journey, one line higher, and two back controls stacked on top
          of each other cost a line of screen on every condition page. The
          "Not Found" card keeps its own link, since a condition that does
          not exist has nothing else on the screen. */}
      {!ready && <Card><Skeleton lines={4} /></Card>}

      {!definition && !loading && (
        <Card>
          <SectionTitle>Not Found</SectionTitle>
          <p>That condition isn't available.</p>
          <Link to="/conditions" className="subtle-link">Back to All Conditions</Link>
        </Card>
      )}

      {definition && ready && (
        <>
          {/* The condition's own card — its fortnight strip, settings and
              background reading — is the screen when nothing is being
              answered, and is in the way when something is. Ash's
              instruction 24 Sep 2026: during a check-in, "just have the
              title and the question". The title moves into the questionnaire
              card below, so it costs no card of its own. */}
          {!formOpen && (
          <Card>
            <div className="condition-heading">
              {definition.Icon && (
                <span className="icon-badge condition-badge">
                  <definition.Icon size={34} color="#fff" />
                </span>
              )}
              <SectionTitle>{definition.label}</SectionTitle>
            </div>

            {/* How it has been going, and how often it is set to be checked —
                Ash's instruction 4 Sep 2026, at the top of the screen. The
                same fortnight strip and the same three states the home screen
                shows, from the same functions, so the two cannot disagree.

                Only for a condition actually being tracked: a screen someone
                is reading before they have chosen anything has no fortnight
                to show and no cadence to change. */}
            {petCondition && cadence && (
              <>
                {/* The fortnight strip stays while the form is open — it is
                    one row, and it is the context for the question being
                    answered. The settings below it do not: "Currently
                    monitoring" and "Monitoring frequency" are things you
                    change on the condition's home page, not halfway through
                    a check-in (Ash's instruction 24 Sep 2026). */}
                <div className="condition-status">
                  <ConditionStrip history={history} />
                  <ConditionState status={status} />
                </div>
                {!formOpen && (
                <>

                {/* "Monitoring frequency", Ash's wording, 4 Sep 2026 — it
                    replaced "How often", which read as a question the line
                    then answered. The options themselves ("Daily", "Every 2
                    weeks", "No reminder") are the same words the Reminders
                    screen uses, and the setting is the same one: changed
                    here, it changes there.

                    APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026.

                    The "Change" link beside it — APPROVED — Dr Ash Cullen (BSc, DVM), 5 Sep 2026. */}
                {/* Which of the options this pet is set up for, and the way
                    back to change them — Ash's instruction 5 Sep 2026. The
                    only way to see it was to open the setup screen and read
                    the ticks, so a GI owner could be told how their pet was
                    without being told which condition it was being measured
                    against.

                    Only for a composed condition, and only once something has
                    been chosen: an empty "Currently monitoring:" on a screen
                    that has not been set up yet says nothing and asks nothing.

                    "Currently monitoring" and the Change link —
                    APPROVED — Dr Ash Cullen (BSc, DVM), 5 Sep 2026. */}
                {monitoring.length > 0 && (
                  <p className="condition-cadence">
                    Currently monitoring: <b>{monitoring.join(', ')}</b>
                    <button
                      type="button"
                      className="condition-cadence-change"
                      onClick={() => navigate(`/conditions/${definition.key}/setup`)}
                    >
                      Change
                    </button>
                  </p>
                )}

                <p className="condition-cadence">
                  Monitoring frequency: <b>{cadenceLabel(cadence.days)}</b>
                  <button
                    type="button"
                    className="condition-cadence-change"
                    onClick={() => setEditingCadence((open) => !open)}
                  >
                    {editingCadence ? 'Done' : 'Change'}
                  </button>
                </p>

                {editingCadence && (
                  <div className="condition-cadence-edit">
                    <div className="field">
                      <label htmlFor="condition-cadence">Repeat</label>
                      <select
                        id="condition-cadence"
                        value={cadence.days}
                        onChange={(event) => {
                          const next = Number(event.target.value)
                          changeCadence({
                            days: next,
                            // A weekday and a date are not interchangeable, so
                            // the day is dropped whenever the kind of day
                            // changes — the same rule the Reminders screen
                            // follows.
                            day: dayModeFor(next) === dayModeFor(cadence.days) ? cadence.day : null,
                          })
                        }}
                      >
                        {CONDITION_CADENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    {!cadence.off && dayModeFor(cadence.days) && (
                      <div className="field">
                        <label>{dayModeFor(cadence.days) === 'week' ? 'Which day?' : 'Which date?'}</label>
                        <ReminderDayPicker
                          mode={dayModeFor(cadence.days)}
                          value={cadence.day == null ? [] : [cadence.day]}
                          max={1}
                          onChange={(days) => changeCadence({ day: days.length ? days[days.length - 1] : null })}
                        />
                        <p className="assessment-hint">{reminderDayHint(cadence.day)}</p>
                      </div>
                    )}

                    {cadenceError && <p className="form-error" role="alert">{cadenceError}</p>}
                  </div>
                )}
                </>
                )}
              </>
            )}
            {/* The summary — what this condition covers — is now the
                sentence shown before this screen opens, from the home card or
                the conditions list (ConditionIntroModal). Ash's instruction
                24 Sep 2026: said once, where the choice is made. What stays
                here is the intro: what MONITORING it involves, which is only
                useful once you are here. */}
            {/* A string or a list of them. Cognitive decline needs two: a
                caution that sends someone to a vet, and separately how to use
                the section. Run together in one block, the caution reads as
                preamble to the instructions rather than as the point. */}
            {/* Reading material, hidden while the questionnaire is open —
                Ash's instruction 24 Sep 2026, "aim to fit each question of an
                assessment into the screen". Paged, every one of these
                paragraphs sat above every question; they belong to the
                condition's home page, which is what this screen is when
                nothing is being answered. */}
            {!formOpen && (Array.isArray(definition.intro) ? definition.intro : [definition.intro])
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="assessment-hint condition-intro">
                  <PetText template={paragraph} pet={pet} />
                </p>
              ))}

            {/* Reference material, behind a toggle. Same component and same
                field name a PARAMETER uses for its own `why` — one level up,
                for background about the condition rather than about a single
                question. Nothing new was introduced for this.
                Expands in place rather than opening a sheet, so the text is
                never truncated to fit: it is as long as it is, and the card
                grows. */}
            {/* The same control the measuring guides use, centred under the
                intro — Ash's instruction 3 Sep 2026: "make it the same format
                as how to count RRR". It was an inline expander, left-aligned
                and accent-coloured, which made it the only thing on a centred
                card sitting off the centre line and the only piece of
                background material in the app that opened in place rather
                than in a sheet. */}
            {!formOpen && definition.why && (
              <HowTo
                title={definition.whyLabel ?? WHY_LABEL}
                body={definition.why}
                pet={pet}
                centred
              />
            )}
          </Card>
          )}

          {/* The Medication card is GONE — Ash's instruction 24 Sep 2026.
              Medications have a tab of their own now, where every drug is
              listed with its schedule and every dose is ticked off, and a
              card here asking "is she on medication for this?" was a second,
              shallower record of the same thing: it could say yes and then
              send the owner to the real list anyway.

              `onMedication` is left in the saved config rather than deleted.
              It is an answer the owner gave, the exported report may still
              print it, and removing a stored field is not something a
              screen's layout should decide. Nothing writes it any more. */}

          {/* A composed condition with nothing selected has no questions to
              show, so the daily form would be an empty card. Sending the
              owner to setup is the only useful thing this screen can do
              until they have chosen something. */}
          {needsSetup && (
            <Card>
              <SectionTitle>Start with the Diagnosis</SectionTitle>
              <p className="assessment-hint">
                Cancer looks different in every patient, so tell us what {pet.name} has been
                diagnosed with — or that you're still waiting to find out — and we'll ask about
                the right things.
              </p>
              <Btn type="button" className="btn-block" onClick={() => navigate(`/conditions/${definition.key}/setup`)}>
                Choose Diagnosis
              </Btn>
            </Card>
          )}

          {!needsSetup && (
          <Card className={formOpen ? 'wizard-card' : ''}>
            {/* The condition's name, at the top of its own questionnaire —
                the one thing from the card above that is still worth saying
                while a question is on screen. */}
            {formOpen && (
              <div className="condition-heading condition-heading-compact">
                {definition.Icon && (
                  <span className="icon-badge condition-badge">
                    <definition.Icon size={26} color="#fff" />
                  </span>
                )}
                <SectionTitle>{definition.label}</SectionTitle>
              </div>
            )}

            {/* The way back to the condition's own page.
                
                Ash's report 27 Sep 2026: a condition with a check-in owed had
                no option to stop tracking it. The cause was reachability, not
                a missing control — `formOpen` defaults to true whenever
                something is owed and nothing ever set it back, so for exactly
                the conditions being monitored actively the page holding the
                fortnight strip, the cadence, "Currently monitoring" and Stop
                Tracking could not be opened at all. The Back control leaves
                for the conditions list rather than landing there.
                
                On the first page only, the same rule as the standing facts
                above: this is a decision you make before starting, not one to
                offer under every question. Nothing is lost by closing —
                answers so far are already in the draft, and "Record an Entry
                Now" comes straight back to them. */}
            {formOpen && wizardPage === 0 && (
              <button
                type="button"
                className="subtle-link condition-close-form"
                onClick={() => setFormOpenOverride(false)}
              >
                {/* APPROVED — Dr Ash Cullen (BSc, DVM), 27 Sep 2026. Her wording,
                    shortened from "Not now — go to … overview" the same day. */}
                Go to {definition.label.toLowerCase()} overview
              </button>
            )}

            {treatmentDay != null && (
              <p className="condition-flag" role="status">
                <span>
                  Day {treatmentDay} after {pet.name}'s last treatment.
                </span>
              </p>
            )}

            {/* Up to date, so the form is closed and the two ways back into
                it are offered instead — Ash's instruction 5 Sep 2026, to
                match how the overall assessment behaves when today's is
                already saved.

                Two buttons or one, depending on whether there is an entry for
                TODAY to edit. Up to date on a weekly cadence with the last
                entry on Tuesday means there is nothing to edit and only a new
                one to start; up to date because it was answered this morning
                means editing is the likelier intent, so it leads.

                All four strings here — APPROVED — Dr Ash Cullen (BSc, DVM), 5 Sep 2026. */}
            {!formOpen && (
              <div className="condition-closed">
                {/* Two states became reachable on 27 Sep 2026, when the open
                    form gained a way back to this page: a condition with a
                    check-in DUE, and one with no entries at all. The second
                    crashed — `latestEntry.date` on a null — because until then
                    you could only see this card when nothing was owed, which
                    guaranteed a previous entry existed. Ash hit it on a newly
                    set up gastrointestinal record.
                    
                    The wording has to follow: "Nothing is due yet" was true
                    when that was the only way to be here and is a lie now.
                    
                    APPROVED — Dr Ash Cullen (BSc, DVM), 27 Sep 2026. The two new
                    strings: "Nothing recorded yet." and "Last recorded {date}."
                    without the due clause. */}
                <p className="assessment-hint">
                  {todaysEntry
                    ? `Today's ${definition.label.toLowerCase()} entry is saved.`
                    : !latestEntry
                      ? 'Nothing recorded yet.'
                      : nothingOwed
                        ? `Last recorded ${formatDateDDMMYY(latestEntry.date)}. Nothing is due yet.`
                        : `Last recorded ${formatDateDDMMYY(latestEntry.date)}.`}
                </p>
                {todaysEntry ? (
                  <>
                    <Btn type="button" className="btn-block" onClick={() => setFormOpenOverride(true)}>
                      Edit Today's Entry
                    </Btn>
                    <Btn
                      type="button"
                      variant="outline"
                      className="btn-block"
                      onClick={() => { setDraft({}); setFormOpenOverride(true) }}
                    >
                      Start Again
                    </Btn>
                  </>
                ) : (
                  <Btn type="button" className="btn-block" onClick={() => setFormOpenOverride(true)}>
                    Record an Entry Now
                  </Btn>
                )}
              </div>
            )}

            {/* What you have already told us, and a way back to it.
                
                These questions have left the daily form — the diagnosis, the
                diet, the day the trial started. Summarising them here rather
                than dropping them silently matters for two reasons: the owner
                can see the app has not lost the answer, and a trial start date
                is the number they most want on screen ("am I at 8 weeks
                yet?"). The Change button puts the questions back. */}
            {standing.length > 0 && !editStanding && (!formOpen || wizardPage === 0) && (
              <div className="standing-answers">
                {standing.map(({ parameter, value, detail }) => (
                  <p key={parameter.key} className="assessment-hint">
                    <PetText template={parameter.label} pet={pet} />
                    {': '}
                    {parameter.type === 'date'
                      ? elapsedLabel(value, today)
                      : describeParameterAnswer(parameter, value, pet?.species)}
                    {/* What the owner typed to qualify the answer — the
                        condition behind "Other", for instance. Without it the
                        card shows the category and hides the answer. */}
                    {detail ? ` — ${detail}` : ''}
                  </p>
                ))}
                <button type="button" className="subtle-link" onClick={() => setEditStanding(true)}>
                  Change These
                </button>
              </div>
            )}
            {editStanding && (!formOpen || wizardPage === 0) && (
              <button type="button" className="subtle-link" onClick={() => setEditStanding(false)}>
                Done Changing
              </button>
            )}

            {/* One question per page, swiped across — Ash's instruction
                24 Sep 2026, "exactly like in overall qol assessment".

                It was one long scroll: every question for the condition
                stacked down a single card, which on cancer or kidney is a
                screen you have to keep working your way down rather than a
                set of questions you answer. The same SwipeableWizard the
                overall assessment uses, so both check-ins are the same
                gesture, the same progress count and the same Back/Next.

                The last page is Events / Notes, and the wizard's own Next
                becomes Save there. */}
            {formOpen && (
              <SwipeableWizard
                // Rebuilt when the condition changes, so moving between two
                // conditions does not land on page four of the new one.
                key={definition.key}
                finishLabel={busy ? 'Saving…' : todaysEntry ? 'Update today\'s entry' : 'Save entry'}
                onComplete={handleSave}
                // A right swipe on the first page leaves the questionnaire
                // the same way the back control does, rather than dying
                // there — the answers so far are held in the draft.
                onExitFirstPage={() => navigate('/conditions')}
                onPageChange={setWizardPage}
                /* "Last recorded … Next one due in N days" was here until
                   Ash removed it on 24 Sep 2026. It is a fact about the
                   schedule, not about the question on screen, and the
                   condition's own card says it the moment the form is
                   closed. Only a save error remains, which belongs beside
                   the button that failed. */
                footer={errorMessage
                  ? <p className="form-error" role="alert">{errorMessage}</p>
                  : null}
                pages={[
                  ...parameters.map((parameter, index) => (
                    <div key={parameter.key} className="assessment-page">
                      {/* On every page of the group, not just the first.
                          Down a scroll, one heading covered the questions
                          beneath it; paged, each question is alone on the
                          screen and "which lump is this about?" has to be
                          answerable without swiping back. */}
                      {parameter.groupLabel && (
                        <h3 className="condition-group-heading">{parameter.groupLabel}</h3>
                      )}
                      {/* Same reasoning: the note explains the number this
                          page is asking for, so it belongs on the page that
                          asks for it. */}
                      {parameter.instanceType && instanceNoteFor(parameter.instanceType) && (
                        <p className="assessment-hint">
                          <PetText template={instanceNoteFor(parameter.instanceType)} pet={pet} />
                        </p>
                      )}
                      <ConditionParameter
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
                  )),
                  /* Events, at the end of the check-in and nowhere else —
                     Ash's instruction 24 Sep 2026. Its own page now that the
                     questions are paged: answer for today, then say what else
                     happened, then Save. */
                  <div key="events" className="assessment-page">
                    {/* Heading only — Ash's instruction 24 Sep 2026. The line
                        under it ("Episodes, diagnoses, and medications
                        started or stopped…") is gone: the Add button and the
                        type chips behind it say the same thing at the moment
                        it matters. "Events / Notes" is Ash's wording. */}
                    <SectionTitle>Events / Notes</SectionTitle>
                    <ConditionEvents
                      petId={pet.id}
                      conditionKey={definition.key}
                      events={events}
                      loading={eventsLoading}
                      onChange={refreshEvents}
                    />
                  </div>,
                ]}
              />
            )}

            {/* "Change what you're monitoring" was here from 29 Aug 2026 until
                5 Sep 2026, when Ash had it removed: the "Currently monitoring:
                ... Change" line added to the top of this screen the same day
                is the same journey, said next to the thing it changes and
                without the owner having to scroll past the whole questionnaire
                to find it. Two routes to one setup screen is one too many. */}

          </Card>
          )}

          {/* Shown here as well as on the setup screen. An owner who chose
              "food sensitivity or allergy" weeks ago never sees that screen
              again, and this section now asks them nothing about it — so
              without this the trial simply looks forgotten. */}
          {!formOpen && definition.key === GI_KEY && hasGiFoodAllergySelected(config) && (
            <Card>
              <SectionTitle>Food Sensitivity or Allergy</SectionTitle>
              <p>
                {/* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. */}
                {pet.name}'s food trial is monitored in Allergies and Skin Disease — the diet,
                the start date, any slips, and re-challenging one food at a time.
              </p>
              <Btn
                type="button"
                variant="outline"
                className="btn-block"
                onClick={() => navigate('/conditions/allergies')}
              >
                Go to Allergies and Skin Disease
              </Btn>
            </Card>
          )}

          {/* The summary calendar and the parameter lines were removed on
              Ash's instruction 24 Sep 2026: Trends draws the same calendar
              and the same lines for every condition, from the same
              chartsForCondition descriptors, and there is no reason for an
              owner to meet the identical picture twice. This screen is where
              a reading is MADE; Trends is where the record is read. Each day
              on that calendar still opens its answers there, and each
              condition there still links back here. */}

          {/* "Export This Record" went with them — Ash's instruction
              24 Sep 2026. The export screen is reached from Trends, where
              the charts being exported are the ones on the screen. */}

          {/* Only once there is something to stop.
              
              This used to render the heading and the warning about deleting
              readings whatever the state, with the button mapped from a list
              that was empty until the owner's first save — so anyone reading
              about a condition they had never tracked was shown a "Stop
              Tracking" card, told their readings would be deleted, and given
              no button. An empty destructive section is worse than no
              section: it implies something is being tracked. */}
          {/* Only on the condition's home page, never under a question —
              Ash's instruction 24 Sep 2026. A destructive control repeated
              below every one of nine questions is both noise and a hazard. */}
          {petCondition && !formOpen && (
            <Card className="stop-tracking-card">
              {/* Smaller, on Ash's instruction 24 Sep 2026. It was a full
                  card — heading, two lines of warning, a full-width danger
                  button — for something almost nobody does, sitting at the
                  foot of a screen people visit daily. One line and one
                  button now; the confirmation that follows still spells out
                  what is deleted, which is where that warning belongs. */}
              <button
                type="button"
                className="stop-tracking-link"
                onClick={() => setConfirmRemove(petCondition)}
              >
                <Trash2 size={14} /> Stop tracking {definition.label.toLowerCase()}
              </button>
            </Card>
          )}

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
              Stay Here
            </Btn>
            <Btn
              type="button"
              onClick={() => {
                setJustSaved(false)
                navigate('/conditions')
              }}
            >
              Back to Conditions
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
              Keep Tracking
            </Btn>
            <Btn
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => handleRemove(confirmRemove)}
            >
              {busy ? 'Deleting…' : 'Delete and Stop'}
            </Btn>
          </div>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        </Modal>
      )}

      {/* APPROVED — Dr Ash Cullen (BSc, DVM), 13 Sep 2026. The module citation used to be
          rendered here. Credits now live in one place — Legal & Privacy, and
          the Terms. definition.citation is still populated from
          lib/references.js for the five modules that adapt a published
          instrument; it is simply no longer repeated on this screen. */}

    </div>
  )
}

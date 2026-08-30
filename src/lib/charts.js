// One description of every chart the app can draw.
//
// Before this file, a chart was defined wherever it happened to be rendered.
// The overall-QoL line existed once in Trends and again in the report; the
// five pillar charts existed twice the same way; condition parameter charts
// existed in ConditionMonitoring AND in the report — and the two had drifted,
// because only the on-screen copy passed event markers, the threshold label
// and the explanatory caption. A vet reading the exported PDF was looking at
// a quietly different chart to the one the owner was looking at on screen.
//
// So the shape of a chart lives here and nowhere else. Screens decide WHICH
// charts to show and how to lay them out; they no longer decide what a chart
// IS. Adding a parameter to a condition now makes it appear on the condition
// page and in the report's picker with no further wiring.
//
// Two kinds come out of here:
//   line     — data + dataKey, handed to TrendLineChart
//   calendar — a dayFor(dateKey) function, handed to MonthCalendar
// A consumer that can only draw one kind filters on `kind`.

import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import {
  SEVERITY,
  SEVERITY_COLOURS,
  numberChartFor,
  SEVERITY_LABELS,
  conditionByKey,
  summariseEntry,
} from './conditions'
import { eventTypeByValue, todayIsoDate } from './conditionsData'
import { resolveDefinition } from './cancerConfig'
import { computeGeneralQolResult } from './scoring'
import { fillPetText } from './petText'
import { BCS_MIN, BCS_MAX, BCS_IDEAL_MIN, BCS_IDEAL_MAX } from './bcsScale'

export const CHART_GROUPS = {
  OVERALL: 'overall',
  PILLARS: 'pillars',
  BODY: 'body',
  CONDITION: 'condition',
}

export const OVERALL_COLOUR = '#C97B8C'
export const BCS_COLOUR = '#5C6F8A'
export const WEIGHT_COLOUR = '#7A9A7E'
export const CONDITION_COLOUR = '#8A5C6F'
// What the three colours on a calendar mean, in the owner's words rather
// than the scoring vocabulary. Green covers both "nothing flagged" and the
// mildly-reduced band that shares its colour, so "good day" is the honest
// reading of a green cell rather than a stricter claim than the colour makes.
export const SEVERITY_KEY_ITEMS = [
  { colour: SEVERITY_COLOURS[SEVERITY.OK], label: 'Good day' },
  { colour: SEVERITY_COLOURS[SEVERITY.CONCERN], label: 'Average day' },
  { colour: SEVERITY_COLOURS[SEVERITY.EMERGENCY], label: 'Bad day' },
]

// Recharts can only place a vertical line on an x value present in the
// series, so an event on a day with no reading simply isn't drawn. It still
// appears in the event list on the condition page — the marker is a bonus,
// not the record.
function markersFor(points, events) {
  if (!events?.length) return undefined
  const dates = new Set(points.map((point) => point.date))
  const marks = events
    .filter((event) => dates.has(event.date))
    .map((event) => ({
      date: event.date,
      label: event.title,
      short: event.type === 'medication_started' ? 'Rx' : '',
      colour: eventTypeByValue(event.type)?.colour,
    }))
  return marks.length ? marks : undefined
}

// Days on which a standing fact CHANGED, as one entry per day.
//
// The calendar already marks readings, medications, notes and events. What it
// could not show was the shape of a diet trial: the day it started, and the
// day each re-challenge food went in. Those are the two dates an owner and a
// vet read the whole allergy record against — "the itch dropped three weeks
// after the diet started, then jumped four days after the chicken" is the
// point of keeping the record at all, and it was invisible.
//
// Driven by data, not a hard-coded list of keys: a parameter says
// `milestone: { on, label, withAnswer }` and this finds the days its answer
// first appears or changes. `on: 'date'` marks the DAY THE ANSWER NAMES — a
// trial start date is about the day the trial started, not the day it was
// typed in — and anything else marks the day the entry was saved.
// Returns Map<date, { label }>, where `label` may be NULL.
//
// A null label is a mark with nothing to say: the day still gets its flag on
// the calendar, and the day's line says nothing about it. That is for a
// milestone whose parameter also produces a finding (see findingFor in
// lib/conditions.js) — without it, a broken diet trial was announced twice in
// one line, once as "The diet trial was broken — Bailey had a dental chew"
// and again as "Diet broken: a dental chew". Ash asked for the second to go
// and for the mark to stay, which is exactly this split.
export function milestoneDayLabels(parameters = [], entries = []) {
  const byDate = new Map()
  const add = (date, text, { markOnly = false } = {}) => {
    if (!date) return
    if (markOnly) {
      // A mark, with no text. Never overwrites a label already on the day —
      // one silent milestone must not silence a talkative one.
      if (!byDate.has(date)) byDate.set(date, { label: null })
      return
    }
    if (!text) return
    const existing = byDate.get(date)?.label ?? null
    if (existing?.includes(text)) return
    byDate.set(date, { label: existing ? `${existing} — ${text}` : text })
  }

  for (const parameter of parameters) {
    const milestone = parameter.milestone
    if (!milestone) continue

    // A FALLBACK milestone: only marks the calendar while the parameter it
    // names goes unanswered.
    //
    // The trial's start date is what should carry the mark, because it lands
    // on the day the trial actually began rather than the day the owner
    // typed it in — and it pulls the diet's name in with withAnswerFrom, so
    // one mark says both things. But an owner who names the diet and skips
    // the date would then get no mark at all, and a diet trial nobody can see
    // on the calendar is worse than one marked on roughly the right day.
    //
    // Judged across the WHOLE record rather than per entry, deliberately. Per
    // entry, filling the date in later would leave the fallback mark standing
    // beside the real one and put the same trial on the calendar twice —
    // which is the thing this whole pass has been removing.
    if (milestone.fallbackFor
      && entries.some((entry) => {
        const value = entry?.values?.[milestone.fallbackFor]
        return value != null && value !== ''
      })) {
      continue
    }

    // `when` marks EVERY day carrying a particular answer, rather than the
    // days the answer changed. A diet trial broken on Tuesday and again on
    // Friday is two breaks, and change-detection would draw one mark and
    // silently swallow the second — which is the opposite of what the owner
    // needs to see when the trial's result is being judged.
    //
    // `detailFrom` pulls the follow-up's answer in, so the mark says what
    // {name} actually had rather than only that something happened.
    if (milestone.when != null) {
      for (const entry of entries) {
        if (entry?.values?.[parameter.key] !== milestone.when) continue
        const detail = milestone.detailFrom ? entry.values?.[milestone.detailFrom] : null
        add(
          entry.date,
          detail ? `${milestone.label}: ${detail}` : milestone.label,
          { markOnly: milestone.markOnly === true },
        )
      }
      continue
    }

    let previous = null
    for (const entry of entries) {
      const value = entry?.values?.[parameter.key]
      if (value == null || value === '') continue
      if (value === previous) continue
      previous = value

      // The answer goes in the label where the answer is the interesting part
      // ("Re-challenge: chicken").
      //
      // withAnswerFrom names ANOTHER parameter to take that answer from. The
      // date a diet trial started and the diet it uses are two questions, and
      // marking them separately put two flags on the calendar for one event —
      // "Elimination diet started" on the start date and "Elimination diet:
      // Brand X hydrolysed" on whichever day the owner happened to type it.
      // One mark, on the day it actually happened, naming the food.
      //
      // Falls back to the bare label if that other answer is missing, so a
      // trial with no diet named still gets marked on its start date.
      const namedAnswer = milestone.withAnswerFrom
        ? entry.values?.[milestone.withAnswerFrom]
        : null
      const detail = milestone.withAnswer
        ? `${milestone.label}: ${value}`
        : (namedAnswer ? `${milestone.label}: ${namedAnswer}` : milestone.label)
      add(
        milestone.on === 'date' ? String(value) : entry.date,
        detail,
        { markOnly: milestone.markOnly === true },
      )
    }
  }

  return byDate
}

// Which days carry a medical event, as one entry per day.
//
// Same shape as the medication and note maps below, and drawn the same way:
// a mark inside the day's cell on the calendar. Several events on one day —
// a vet visit and the medication it started — accumulate rather than
// overwrite, because both belong to that day.
export function eventDayLabels(events = []) {
  const byDate = new Map()

  for (const event of events) {
    if (!event?.date) continue
    const type = eventTypeByValue(event.type)
    const label = event.title || type?.label || 'Event'
    const existing = byDate.get(event.date)
    byDate.set(event.date, existing ? `${existing} \u2014 ${label}` : label)
  }

  return byDate
}

// Which days carry a note, as one entry per day.
//
// Notes arrive from more than one place on the same day — the assessment and
// the pain log each have their own field, and a condition entry has another —
// so they accumulate rather than overwrite. Blank and whitespace-only notes
// are dropped: an empty string is not a note, and marking every day would
// make the mark meaningless.
export function noteDayLabels(...entryLists) {
  const byDate = new Map()

  for (const entries of entryLists) {
    for (const entry of entries ?? []) {
      const text = (entry?.notes ?? '').trim()
      if (!text || !entry.date) continue
      const existing = byDate.get(entry.date)
      // The same note saved through two paths on one day would otherwise be
      // shown twice, which reads as two different notes.
      if (existing?.includes(text)) continue
      // Separated, not run together: two notes on one day joined by a bare
      // space read as one sentence that never made sense.
      byDate.set(entry.date, existing ? `${existing} \u2014 ${text}` : text)
    }
  }

  return byDate
}

function medicationDayLabels(medications = []) {
  const byDate = new Map()

  function add(date, label) {
    if (!date) return
    const existing = byDate.get(date)
    byDate.set(date, existing ? `${existing}, ${label}` : label)
  }

  for (const medication of medications) {
    add(medication.startedOn, `Started ${medication.name}`)
    add(medication.endedOn, `Stopped ${medication.name}`)
  }

  return byDate
}

// --- The individual builders ---------------------------------------------
//
// Each returns a descriptor or null. Null means "there is nothing to draw" —
// no data yet, or a parameter that can't be turned into a series — and the
// caller drops it rather than rendering an empty frame.

// No medication or note marks on the line charts. A dashed vertical line
// every time a tablet started or a note was written turned a twelve-week
// trend into a picket fence, and the thing the chart exists to show — the
// shape of the line — was the thing hardest to see. Both marks live on the
// calendars, where a day is a cell and a mark sits inside it.
function overallChart(dailySeries) {
  if (!dailySeries.length) return null
  return {
    key: 'overall',
    group: CHART_GROUPS.OVERALL,
    groupLabel: 'Overall',
    label: 'Overall QoL',
    title: 'Overall QoL Over Time',
    kind: 'line',
    data: dailySeries,
    // The percentage, not the raw total. A total is out of a maximum that
    // changes with how many questions were answered, so two days scoring 84
    // could mean quite different things and the axis had no fixed top. A
    // percentage is the same number the assessment shows at the end and the
    // same one the Good / Bad Days calendar colours by — one scale for the
    // whole app, 100% being the best day.
    dataKey: 'generalPercent',
    domain: [0, 100],
    unit: '%',
    colour: OVERALL_COLOUR,
    height: 200,
    caption: 'Higher is better. 100% is the best possible day.',
  }
}

function goodBadDaysChart(generalEntries, painEntries, medications, noteDays = new Map()) {
  const medicationDays = medicationDayLabels(medications)
  if (!generalEntries.length && medicationDays.size === 0 && noteDays.size === 0) return null

  const beapByDate = new Map(painEntries.map((entry) => [entry.date, entry.beap]))
  // The colour is taken straight off the computed result rather than being
  // re-derived from the percentage — a day floored to Severe by a single
  // emergency finding would otherwise still be painted green by its
  // (perfectly healthy-looking) average.
  const resultByDate = new Map(
    generalEntries.map((entry) => [
      entry.date,
      computeGeneralQolResult(entry, beapByDate.get(entry.date)),
    ]),
  )

  return {
    key: 'good-bad-days',
    group: CHART_GROUPS.OVERALL,
    groupLabel: 'Overall',
    label: 'Good / bad days',
    title: 'Good / Bad Days',
    kind: 'calendar',
    dayFor: (dateKey) => {
      const result = resultByDate.get(dateKey)
      const marker = medicationDays.get(dateKey) ?? null
      const note = noteDays.get(dateKey) ?? null
      // A medication starting, or a note written, on a day with no assessment
      // still gets marked. That day is uncoloured, which is honest — nothing
      // was scored — but the mark is the whole reason the owner is looking at
      // this calendar.
      if (!result && !marker && !note) return null
      const percent = result ? `${result.percent}%` : null
      return {
        colour: result ? result.color : null,
        title: [percent, marker, note].filter(Boolean).join(' — '),
        marker,
        note,
        // Same shape the condition calendars return, so MonthCalendar has one
        // way of drawing a day's detail rather than two.
        parts: { severity: percent, marker, note },
      }
    },
    // Above the calendar, not below it. It is the point of the chart rather
    // than a footnote to it — an owner should read what they are looking for
    // before they look, not after.
    intro: 'A good quality of life means having more good days than bad.',
    severityKey: true,
  }
}

function pillarCharts(dailySeries) {
  if (!dailySeries.length) return []
  return WELLBEING_CONCEPTS.map(({ key, label, color }) => ({
    key: `pillar:${key}`,
    group: CHART_GROUPS.PILLARS,
    groupLabel: 'Wellbeing pillars',
    label,
    title: `${label} Over Time`,
    kind: 'line',
    data: dailySeries,
    dataKey: key,
    colour: color,
    domain: [0, 100],
    height: 180,
    // Carried through so Trends can still colour the pillar's icon button and
    // open its definition without re-finding the concept.
    conceptKey: key,
  }))
}

function bodyCharts(bcsEntries) {
  const charts = []

  if (bcsEntries.length) {
    charts.push({
      key: 'body:score',
      group: CHART_GROUPS.BODY,
      groupLabel: 'Body condition',
      label: 'Body condition',
      title: 'Body Condition Over Time',
      kind: 'line',
      data: bcsEntries,
      dataKey: 'score',
      colour: BCS_COLOUR,
      // Fixed 1–9 domain: BCS is a fixed clinical scale, and letting it
      // rescale to the data would make a move from 5 to 6 look like a
      // dramatic swing.
      domain: [BCS_MIN, BCS_MAX],
      // The ideal range, shaded green, from the same constants the scoring
      // uses. This chart is the one place in the app where the middle is
      // best and both directions away from it are worse, and a caption
      // saying so is a worse way to say it than showing it: "is the line in
      // the green?" is answerable at a glance, and "is 6 better or worse
      // than 4?" is not.
      band: {
        from: BCS_IDEAL_MIN,
        to: BCS_IDEAL_MAX,
        colour: SEVERITY_COLOURS[SEVERITY.OK],
        label: 'Ideal',
      },
      height: 180,
      caption:
        'The green band is the ideal range. Both lower and higher scores move away from ideal, so '
        + 'this chart reads differently to the others — the middle is best, not the top.',
    })
  }

  // Weight is optional on a BCS entry, so the weight series is only the
  // subset of entries that actually carried one. Plotting every entry and
  // letting the line bridge the gaps would imply weights never recorded.
  const weightEntries = bcsEntries.filter((entry) => entry.weightKg != null)
  if (weightEntries.length) {
    const weights = weightEntries.map((entry) => entry.weightKg)
    charts.push({
      key: 'body:weight',
      group: CHART_GROUPS.BODY,
      groupLabel: 'Body condition',
      label: 'Weight',
      title: 'Weight Over Time',
      kind: 'line',
      data: weightEntries,
      dataKey: 'weightKg',
      unit: ' kg',
      colour: WEIGHT_COLOUR,
      // Unlike BCS, weight has no fixed clinical range, so the axis follows
      // the data with a little padding either side.
      domain: [Math.max(0, Math.min(...weights) - 0.5), Math.max(...weights) + 0.5],
      height: 180,
      caption:
        'Only days you recorded a weight appear here. Weight and body condition can move '
        + 'independently — a steady score while weight drops is worth raising with your vet.',
    })
  }

  return charts
}

// Everything a condition contributes to the registry: its summary calendar,
// plus a line for any parameter that has explicitly opted into one.
//
// Condition pages used to draw lines too — a concern count, one per graphable
// parameter, and a borrowed line for each parameter the condition referenced
// rather than asked. Ash's call is that they don't earn their place. A
// condition form is a handful of questions answered every few days, and a
// line drawn through that many points says less than the calendar sitting
// above it does at a glance, while costing the owner a scroll past half a
// dozen of them to reach the events list.
//
// So the calendar carries the picture here: colour per day, what was flagged
// on the day you tap. Trends live in the Overall Quality of Life section.
//
// The exception, added 29 Aug 2026 on Ash's instruction, is a MEASURED
// NUMBER — resting respiratory rate, daily water intake in millilitres.
// Those were never the problem: the column of lines was six-rung scales
// plotted against time, which say little the calendar has not already said
// in colour. A number an owner went and counted is different, and it is the
// one a vet will ask for. A parameter opts in with `chart: true`; see
// numberChartFor in lib/conditions.js, which refuses anything that is not a
// number.
export function chartsForCondition({
  definition,
  entries = [],
  events = [],
  medications = [],
  species,
  config,
  // Only for templating the names of flagged questions into the calendar's
  // day text. Optional: without it the labels read as they are written, which
  // is what happened until 29 Aug 2026 — the line under the calendar said
  // "Worth watching: Has {name} Had A Seizure Today?", braces and all.
  pet,
}) {
  if (!definition) return []

  // A composed condition (cancer) has no static parameter list — its charts
  // depend on which sign modules this particular pet is set up with, and on
  // how many masses they are measuring. Resolving here means every consumer
  // of the registry, the report included, gets the right set without knowing
  // configs exist.
  const resolved = resolveDefinition(definition, config, species)

  const charts = []
  const groupLabel = resolved.label

  // One summary per logged day, oldest first — the calendar's whole source.
  const summaries = entries.map((entry) => ({
    date: entry.date,
    ...summariseEntry(resolved, entry.values, species),
  }))

  const medicationDays = medicationDayLabels(medications)
  // A condition entry carries its own notes field, separate from the
  // assessment's. Both belong on this condition's calendar.
  const noteDays = noteDayLabels(entries)
  const eventDays = eventDayLabels(events)
  // Diet trial started, re-challenge food introduced — see milestoneDayLabels.
  const milestoneDays = milestoneDayLabels(resolved.parameters, entries)

  // An EXCEPTION LOG rather than a diary.
  //
  // Seizures is the only condition where not filling anything in is itself
  // the good news. Every other condition's calendar is blank on a day nobody
  // logged, because nobody knows how the pet was. Here, an owner who has
  // nothing to report has nothing to report — and a page of grey squares
  // between two seizures hides the very thing they want to see, which is the
  // length of the gap.
  //
  // Green runs from the FIRST logged entry to today, and no further in either
  // direction. Before the first entry the app genuinely does not know, and
  // painting those days green would be inventing a seizure-free history. The
  // future is not green for the same reason.
  const assumesWell = definition.calendarAssumesWell === true
  const firstLoggedDate = entries[0]?.date ?? null
  const todayKey = todayIsoDate()

  if (summaries.length > 0 || medicationDays.size > 0
      || noteDays.size > 0 || eventDays.size > 0 || milestoneDays.size > 0) {
    const summaryByDate = new Map(summaries.map((day) => [day.date, day]))
    charts.push({
      key: `${resolved.key}:calendar`,
      group: CHART_GROUPS.CONDITION,
      groupLabel,
      conditionKey: resolved.key,
      label: 'Summary calendar',
      title: `${resolved.label} Summary`,
      kind: 'calendar',
      dayFor: (dateKey) => {
        const day = summaryByDate.get(dateKey)
        const marker = medicationDays.get(dateKey) ?? null
        const note = noteDays.get(dateKey) ?? null
        const event = eventDays.get(dateKey) ?? null
        const milestone = milestoneDays.get(dateKey) ?? null
        // May be null on a mark-only milestone — see milestoneDayLabels.
        const milestoneLabel = milestone?.label ?? null
        if (!day?.severity && !marker && !note && !event && !milestone) {
          // Nothing logged. On an exception log that means the good outcome,
          // within the window the app can actually vouch for.
          if (assumesWell && firstLoggedDate && dateKey >= firstLoggedDate && dateKey <= todayKey) {
            return {
              colour: SEVERITY_COLOURS[SEVERITY.OK],
              title: definition.calendarUnloggedTitle ?? 'Nothing recorded',
            }
          }
          return null
        }
        // Names what was flagged, not just how many. "Worth watching — 1
        // flagged" told the owner there was something without saying what,
        // which on a three-month calendar meant opening days one at a time
        // to find it.
        //
        // A condition with its own key labels uses those instead of the
        // generic ones, and lists only its EMERGENCY flags. On the seizure
        // log the generic version read "Worth watching: Has Bailey Had A
        // Seizure Today?" — a question quoted back as if it were a finding,
        // where "Seizure" says the same thing and says it as a fact. The
        // concern-level flag on such a log is the event itself, so naming it
        // adds nothing; a red day still names what escalated it.
        const keyLabels = definition.calendarKeyLabels
        const named = (day?.flagged ?? [])
          .filter((entry) => !keyLabels || entry.severity === SEVERITY.EMERGENCY)
          .map((entry) => ({ text: fillPetText(entry.label, pet), isFinding: entry.isFinding === true }))
        // Question names are a list; statements are sentences.
        //
        // Where every flag on the day carries a finding (see findingFor in
        // lib/conditions.js) the line reads "The diet trial was broken —
        // Bailey had half a dental chew. Bailey's stool — Very soft." Commas
        // would run those two together into one unparseable clause. Where
        // any flag is still a bare question name, the old comma list is
        // right, because "Appetite. Drinking." is not a sentence either.
        const asFindings = named.length > 0 && named.every((entry) => entry.isFinding)
        const namedText = asFindings
          ? named.map((entry) => (/[.!?]$/.test(entry.text) ? entry.text : `${entry.text}.`)).join(' ')
          : named.map((entry) => entry.text).join(', ')
        // "Worth watching:" dropped where the findings speak for themselves —
        // Ash's instruction, 29 Aug 2026. On the allergy log the line read
        // "Worth watching: The diet trial was broken — Bailey had a dental
        // chew.", where the first two words say nothing the sentence after
        // them has not already said, and the cell is already amber.
        //
        // Dropped on an EMERGENCY day too, on her follow-up instruction —
        // "just state the abnormalities". The colour still carries the
        // severity, the key still names it, and the emergency message itself
        // is shown on the form where the answer is given rather than here.
        const severityWord = day?.severity
          ? (keyLabels?.[day.severity] ?? SEVERITY_LABELS[day.severity])
          : null
        const dropSeverityWord = asFindings
        const severityTitle = severityWord
          ? (dropSeverityWord && named.length
            ? namedText
            : `${severityWord}${named.length ? `: ${namedText}` : ''}`)
          : null
        return {
          colour: day?.severity ? SEVERITY_COLOURS[day.severity] : null,
          title: [severityTitle, marker, note, event, milestoneLabel].filter(Boolean).join(' — '),
          marker,
          note,
          // Four separate marks, not one.
          //
          // Until 29 Aug 2026 a diet-trial milestone was drawn with the same
          // dot as a medical event, on the reasoning that a fourth kind of
          // mark was a new thing for the owner to learn. Ash's report shows
          // that was the wrong trade: with one mark and one merged line, a day
          // carrying an amber finding, a new medication and a vet visit said
          // all three things behind a single flag, and the owner could not
          // tell which of them the flag was for — or that the event they had
          // just logged had reached the calendar at all.
          //
          // A stethoscope is the Events list. A flag is a change to the plan
          // the app tracks itself, such as a diet trial starting. Truthiness
          // is all the calendar reads for a mark, so a mark-only milestone
          // still draws its flag with no text behind it.
          event,
          milestone: milestone ? (milestoneLabel ?? true) : null,
          // One line per thing that happened, each with its own mark, rather
          // than five clauses joined by dashes.
          parts: {
            severity: severityTitle,
            marker,
            note,
            event,
            milestone: milestoneLabel,
          },
        }
      },
      severityKey: true,
      // Wording per condition where the default is wrong. "Good day" is right
      // for a quality of life calendar; on an epilepsy log green means one
      // specific thing, and saying so is the difference between a colour the
      // owner reads and a colour they interpret.
      severityKeyItems: definition.calendarKeyLabels
        ? [
          { colour: SEVERITY_COLOURS[SEVERITY.OK], label: definition.calendarKeyLabels.ok },
          { colour: SEVERITY_COLOURS[SEVERITY.CONCERN], label: definition.calendarKeyLabels.concern },
          { colour: SEVERITY_COLOURS[SEVERITY.EMERGENCY], label: definition.calendarKeyLabels.emergency },
        ]
        : undefined,
      caption: definition.calendarCaption ?? undefined,
    })
  }

  // Any parameter that has opted into a line. Two in the whole app: Heart
  // Disease's resting respiratory rate and Kidney Disease's measured daily
  // water intake. Both are numbers, and numberChartFor refuses anything else.
  //
  // Event markers are carried here and nowhere else: a rate climbing for a
  // week reads very differently when a diuretic was stopped four days ago.
  for (const parameter of resolved.parameters) {
    const config = numberChartFor(parameter, entries, species)
    if (!config) continue
    charts.push({
      key: `${resolved.key}:${parameter.key}`,
      group: CHART_GROUPS.CONDITION,
      groupLabel,
      conditionKey: resolved.key,
      parameterKey: parameter.key,
      label: parameter.label,
      title: parameter.label,
      kind: 'line',
      data: config.points,
      dataKey: 'value',
      unit: config.unit,
      colour: CONDITION_COLOUR,
      domain: config.domain,
      height: 180,
      threshold: config.threshold,
      thresholdLabel: config.threshold != null ? `${config.threshold}` : undefined,
      markers: markersFor(config.points, events) ?? [],
      caption: config.caption ?? undefined,
    })
  }

  return charts
}

// --- The whole registry ---------------------------------------------------

// Everything chartable for one pet, in the order the app presents it:
// overall, then the wellbeing pillars, then body condition, then one block
// per tracked condition. Consumers filter; nobody re-derives.
//
// Every argument is data that has ALREADY been loaded by a hook. This stays a
// pure function so it can be called from a render without care, and so the
// report and the screen provably see the same thing.
export function buildChartRegistry({
  generalEntries = [],
  painEntries = [],
  dailySeries = [],
  bcsEntries = [],
  medications = [],
  trackedConditions = [],
  entriesByCondition = {},
  eventsByCondition = {},
  configByCondition = {},
  species,
  pet,
} = {}) {
  // The assessment and the pain log are saved together but keep separate
  // notes fields, so a day's note can be in either. Built once and shared by
  // every overview chart, so the calendar and the lines can never disagree
  // about which days carry a note.
  const noteDays = noteDayLabels(generalEntries, painEntries)

  const charts = [
    overallChart(dailySeries),
    goodBadDaysChart(generalEntries, painEntries, medications, noteDays),
    ...pillarCharts(dailySeries),
    ...bodyCharts(bcsEntries),
  ].filter(Boolean)

  for (const definition of trackedConditions) {
    charts.push(
      ...chartsForCondition({
        definition,
        entries: entriesByCondition[definition.key] ?? [],
        events: eventsByCondition[definition.key] ?? [],
        medications,
        species,
        pet,
        config: configByCondition[definition.key],
      }),
    )
  }

  return charts
}

// Same list, collapsed into the groups a picker wants to show as headings.
// Groups with nothing in them never appear, so an owner tracking no
// conditions is not offered an empty "Conditions" heading.
export function groupCharts(charts) {
  const groups = []
  const byLabel = new Map()

  for (const chart of charts) {
    let group = byLabel.get(chart.groupLabel)
    if (!group) {
      group = { label: chart.groupLabel, group: chart.group, charts: [] }
      byLabel.set(chart.groupLabel, group)
      groups.push(group)
    }
    group.charts.push(chart)
  }

  return groups
}

export function chartByKey(charts, key) {
  return charts.find((chart) => chart.key === key) ?? null
}

// The conditions an owner is actually tracking, resolved to their definitions.
// A key left in the database for a condition since removed from the app is
// dropped rather than rendering an empty block.
export function resolveTrackedConditions(conditions = []) {
  return conditions
    .filter((entry) => entry.active && conditionByKey(entry.conditionKey))
    .map((entry) => conditionByKey(entry.conditionKey))
}

// The per-pet config for each tracked condition, keyed by condition. Empty
// for everything with a fixed parameter list; the cancer entry is the only
// one that carries anything today.
export function configsByCondition(conditions = []) {
  const out = {}
  for (const entry of conditions) {
    if (entry?.conditionKey) out[entry.conditionKey] = entry.config ?? {}
  }
  return out
}

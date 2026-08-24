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
  RELATIONSHIP,
  SEVERITY_COLOURS,
  SEVERITY_LABELS,
  askedParameters,
  chartConfigFor,
  conditionByKey,
  summariseEntry,
} from './conditions'
import { eventTypeByValue } from './conditionsData'
import { resolveDefinition } from './cancerConfig'
import { computeGeneralQolResult } from './scoring'
import { BCS_MIN, BCS_MAX } from './bcsScale'

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
export const FLAGS_COLOUR = '#C97A2E'

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

// --- The individual builders ---------------------------------------------
//
// Each returns a descriptor or null. Null means "there is nothing to draw" —
// no data yet, or a parameter that can't be turned into a series — and the
// caller drops it rather than rendering an empty frame.

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
    dataKey: 'generalTotal',
    colour: OVERALL_COLOUR,
    height: 200,
  }
}

function goodBadDaysChart(generalEntries, painEntries) {
  if (!generalEntries.length) return null

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
      if (!result) return null
      return { colour: result.color, title: `${result.percent}%` }
    },
    caption: 'A good quality of life means having more good days than bad.',
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
      height: 180,
      caption:
        '4–5 is ideal. Both lower and higher scores move away from ideal, so this chart reads '
        + 'differently to the others — the middle is best, not the top.',
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

// A chart for a parameter this condition REFERENCES rather than asks.
//
// The series is the daily assessment's, not the condition's — the same key on
// the same 0-100 higher-is-better scale as the wellbeing pillar charts,
// because it is literally the same number. This exists so that deleting a
// duplicated question from a condition form does not also delete its trend
// from the condition page: the owner answers appetite once and still sees how
// it has moved on the page where it matters.
//
// Returns null when the pet has no assessments carrying that measure, which
// is also what happens if `covers` names something buildDailySeries does not
// produce. The overlap check is what stops that reaching here.
function referencedChart(parameter, dailySeries, definition) {
  const points = dailySeries.filter((day) => day[parameter.covers] != null)
  if (points.length === 0) return null

  return {
    key: `${definition.key}:${parameter.key}`,
    group: CHART_GROUPS.CONDITION,
    groupLabel: definition.label,
    conditionKey: definition.key,
    parameterKey: parameter.key,
    // Marks the chart as coming from somewhere else, so a screen can say so
    // without having to know which parameters are referenced.
    referenced: true,
    label: parameter.label,
    title: parameter.label,
    kind: 'line',
    data: points,
    dataKey: parameter.covers,
    colour: CONDITION_COLOUR,
    // Fixed, like the pillar charts this borrows from — the axis means the
    // same thing on both pages.
    domain: [0, 100],
    height: 180,
    caption:
      'Taken from your daily assessment rather than asked again here. A higher line is better.',
  }
}

// Every chart belonging to one condition: its calendar, its concern count,
// and one per graphable parameter. Exported on its own because the condition
// page wants exactly this set and nothing else.
export function chartsForCondition({
  definition,
  entries = [],
  events = [],
  dailySeries = [],
  species,
  config,
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

  // One summary per logged day, oldest first — feeds both the calendar and
  // the concern-count chart from a single pass.
  const summaries = entries.map((entry) => ({
    date: entry.date,
    ...summariseEntry(resolved, entry.values, species),
  }))

  if (summaries.length > 0) {
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
        if (!day?.severity) return null
        return {
          colour: SEVERITY_COLOURS[day.severity],
          title: `${SEVERITY_LABELS[day.severity]}${day.flags ? ` — ${day.flags} flagged` : ''}`,
        }
      },
    })
  }

  if (summaries.length > 1) {
    charts.push({
      key: `${resolved.key}:flags`,
      group: CHART_GROUPS.CONDITION,
      groupLabel,
      conditionKey: resolved.key,
      // Cadence-neutral wording. "Each day" was wrong the moment a
      // condition became weekly, and "each week" would be wrong for the
      // daily ones — what is true for both is "each time you filled it in".
      label: 'Things flagged',
      title: 'Things Flagged',
      kind: 'line',
      data: summaries,
      dataKey: 'flags',
      colour: FLAGS_COLOUR,
      // Referenced parameters are excluded: they are never answered on this
      // form, so they can never be flagged, and counting them would make the
      // axis taller than anything that can be plotted on it.
      domain: [0, Math.max(2, askedParameters(resolved.parameters).length)],
      height: 160,
      caption:
        'How many findings were flagged each time you filled this in. A colour tells you '
        + 'something was wrong; this tells you how much — one thing off and four things off look '
        + 'very different on a chart, and the difference matters.',
    })
  }

  for (const parameter of resolved.parameters) {
    if (parameter.relationship === RELATIONSHIP.REFERENCE) {
      const referenced = referencedChart(parameter, dailySeries, definition)
      if (referenced) charts.push(referenced)
      continue
    }

    const config = chartConfigFor(parameter, entries, species)
    if (!config) continue
    charts.push({
      key: `${resolved.key}:${parameter.key}`,
      group: CHART_GROUPS.CONDITION,
      groupLabel,
      conditionKey: resolved.key,
      parameterKey: parameter.key,
      // A chart has no heading to sit under, so a per-mass measure carries
      // the mass name here even though the form does not. Otherwise a pet
      // with three lumps gets three charts all called "Size".
      label: parameter.instanceLabel ? `${parameter.label} — ${parameter.instanceLabel}` : parameter.label,
      title: parameter.instanceLabel ? `${parameter.label} — ${parameter.instanceLabel}` : parameter.label,
      kind: 'line',
      data: config.points,
      dataKey: 'value',
      unit: config.unit,
      colour: CONDITION_COLOUR,
      domain: config.domain,
      height: 180,
      threshold: config.threshold,
      thresholdLabel: config.threshold != null ? `${config.threshold}` : undefined,
      markers: markersFor(config.points, events),
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
  trackedConditions = [],
  entriesByCondition = {},
  eventsByCondition = {},
  configByCondition = {},
  species,
} = {}) {
  const charts = [
    overallChart(dailySeries),
    goodBadDaysChart(generalEntries, painEntries),
    ...pillarCharts(dailySeries),
    ...bodyCharts(bcsEntries),
  ].filter(Boolean)

  for (const definition of trackedConditions) {
    charts.push(
      ...chartsForCondition({
        definition,
        entries: entriesByCondition[definition.key] ?? [],
        events: eventsByCondition[definition.key] ?? [],
        dailySeries,
        species,
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

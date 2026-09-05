// The fortnight strip: what a condition's summary is instead of a percentage.
//
// Lifted out of PetSummaryCard on 4 Sep 2026 so the condition's own screen can
// show the same fourteen days at the top of it. One implementation, so the
// home screen and the disease screen cannot disagree about the same fortnight.

import { SEVERITY, labelOf, summariseEntry } from './conditions'
import { resolveDefinition } from './cancerConfig'
import { BEAP_BANDS } from './scoring'


// --- The fortnight strip ----------------------------------------------------
//
// What a condition's summary is INSTEAD of a percentage.
//
// There is no composite score for a disease and there should not be one: the
// parameter set differs per condition, per species and per pet — allergies
// grows three questions the day a diet trial starts, cancer resolves its own
// from the config — so any number would change meaning mid-treatment and
// would not be comparable to the number beside it. It would also be the one
// figure an owner reads out to their vet.
//
// So: one tick per day for a fortnight, coloured exactly as the calendar
// colours the same day, and read from the same summariseEntry the calendar
// reads. A hollow tick is a day with nothing logged, which is a state of its
// own rather than a green one — nothing recorded is not the same as nothing
// wrong.
export const WINDOW_SLOTS = 14


export function conditionHistory({ definition, config, entries, species, today, cadenceDays = 1, remindersOff = false }) {
  // Resolved, because a cancer parameter set is built per pet and summarising
  // against the static definition would grade questions this owner was never
  // asked.
  let resolved = definition
  try {
    resolved = resolveDefinition(definition, config, species)
  } catch (error) {
    console.error('Could not resolve that condition:', error.message)
  }

  const byDate = new Map()
  for (const entry of entries) {
    try {
      byDate.set(entry.date, summariseEntry(resolved, entry.values, species))
    } catch (error) {
      // One unreadable day must not take the home screen down with it.
      console.error('Could not summarise that day:', error.message)
    }
  }

  // One cell per SCHEDULED CHECK-IN, not per calendar day — Ash's report
  // 5 Sep 2026.
  //
  // A pet checked weekly drew twelve empty cells and two filled ones, and an
  // owner who had not missed anything still read a strip that was mostly
  // absence. The window was fourteen days because the cadence used to be
  // assumed daily; measured in the pet's own cadence it is fourteen check-ins,
  // which for a daily pet is exactly what it was before and for a weekly one
  // is fourteen weeks.
  //
  // A period rather than an exact date, so logging a day late still fills its
  // slot: period i covers the `cadence` days ending on today - i * cadence.
  // A condition whose reminder the owner has switched off reports days: 0.
  // Fall back to the cadence its own definition recommends so the strip still
  // spans a sensible stretch of time — and see `missed` below, which is never
  // set in that state.
  const cadence = Number(cadenceDays) > 0
    ? Number(cadenceDays)
    : Math.max(1, Number(definition?.cadence?.days) || 1)
  const dayMs = 86400000
  const todayMs = Date.parse(`${today}T00:00:00Z`)

  function periodDates(index) {
    const endMs = todayMs - index * cadence * dayMs
    const out = []
    for (let step = cadence - 1; step >= 0; step -= 1) out.push(isoFromUtc(endMs - step * dayMs))
    return out
  }

  const RANK = { [SEVERITY.EMERGENCY]: 3, [SEVERITY.CONCERN]: 2, [SEVERITY.OK]: 1 }
  function worstIn(dates) {
    let worst = null
    for (const date of dates) {
      const severity = byDate.get(date)?.severity
      if (!severity) continue
      if (!worst || (RANK[severity] ?? 0) > (RANK[worst] ?? 0)) worst = severity
    }
    return worst
  }

  const firstLogged = entries[0]?.date ?? null

  // Whether a day was ANSWERED, which is not the same as whether it can be
  // scored. summariseEntry returns no severity for an entry it cannot grade —
  // a condition whose parameters have all been answered "doesn't apply", or a
  // composed one whose config has since changed — and reading missedness off
  // the severity marked those days as check-ins that never happened. They did
  // happen; there is simply nothing to colour them with.
  const loggedDates = new Set(entries.map((entry) => entry.date))

  function cellFor(index) {
    const dates = periodDates(index)
    const end = dates[dates.length - 1]
    const severity = worstIn(dates)
    const answered = dates.some((date) => loggedDates.has(date))
    return {
      date: end,
      severity: severity ?? null,
      // Owed and not answered. Only inside the monitored era — periods before
      // the first entry were never owed — and never at all where the owner has
      // switched this condition's reminder off. Telling someone they have
      // missed thirteen check-ins they asked not to be reminded about is the
      // app inventing an obligation they declined.
      missed: !remindersOff && !answered && firstLogged != null && end >= firstLogged,
    }
  }

  // As long as the history is, up to fourteen — Ash's report 5 Sep 2026.
  //
  // A fixed fourteen slots meant a pet monitored fortnightly for three months
  // drew six filled cells and eight empty ones, because eight of the fourteen
  // fortnights predate the first entry. Those were never owed and are not
  // missed, so they were drawn as nothing — but eight cells of nothing is
  // still a strip that reads as absence, which is the whole complaint.
  //
  // Trimmed to the slots that exist. A condition monitored for six fortnights
  // shows six marks, all of them meaning something. Strips of different
  // lengths between two conditions is the honest answer: one of them has been
  // watched for longer.
  const strip = []
  if (remindersOff) {
    // No schedule to measure against, so no slots and no misses — one mark
    // per check-in the owner actually did, most recent last. Ash's report
    // 5 Sep 2026: falling back to a nominal cadence here drew a strip that
    // was mostly empty for someone who had simply chosen not to be reminded.
    const logged = entries.map((entry) => entry.date).slice(-WINDOW_SLOTS)
    for (const date of logged) {
      strip.push({ date, severity: byDate.get(date)?.severity ?? null, missed: false })
    }
  } else {
    for (let index = WINDOW_SLOTS - 1; index >= 0; index -= 1) {
      const cell = cellFor(index)
      // Nothing before the first entry. `strip.length` guards the case of a
      // gap inside the era, which must keep its place in the run.
      if (strip.length === 0 && firstLogged != null && cell.date < firstLogged) continue
      strip.push(cell)
    }
  }

  const earlierStrip = []
  for (let index = WINDOW_SLOTS * 2 - 1; index >= WINDOW_SLOTS; index -= 1) earlierStrip.push(cellFor(index))

  const isFlagged = (cell) => cell.severity === SEVERITY.CONCERN || cell.severity === SEVERITY.EMERGENCY

  const logged = strip.filter((cell) => cell.severity != null).length
  const flagged = strip.filter(isFlagged).length
  const earlierFlagged = earlierStrip.filter(isFlagged).length
  const earlierLogged = earlierStrip.filter((cell) => cell.severity != null).length

  // Only compare windows that are actually comparable.
  //
  // "8 flagged, up from 4" was being printed for a pet diagnosed 18 days ago:
  // the previous window held five logged check-ins because monitoring had not
  // started for the rest of it, so a full window was measured against part of
  // one. Every newly diagnosed pet would read as deteriorating for its first
  // month, in red, under a strip that visibly improves.
  //
  // Half the recent window's logged check-ins is the bar. Below that there is
  // no honest comparison to draw and the count stands on its own.
  const hadEarlier = earlierLogged > 0 && earlierLogged * 2 >= logged

  // The most recent thing worth naming, newest first. flagged[0] is already
  // the worst finding of its day — summariseEntry sorts it that way.
  //
  // Named as "Itching: Moderate–severe" rather than by quoting the level
  // sentence, on Ash's instruction 3 Sep 2026. The sentence is right on a
  // calendar day-line, where it is the whole content; here it ran to three
  // lines under a fourteen-tick strip that had already said how bad the day
  // was. The band says the same thing in one word, and it is the same word
  // the assessment prints beside the level the owner picked.
  //
  // Searched across the whole period rather than only its end date: on a
  // weekly cadence the answer that raised the flag was given on whichever day
  // the owner sat down, not on the day the slot happens to close.
  let finding = null
  for (let i = 0; i < WINDOW_SLOTS && !finding; i += 1) {
    const dates = periodDates(i).slice().reverse()
    const on = dates.find((date) => byDate.get(date)?.flagged?.[0])
    if (!on) continue
    const first = byDate.get(on).flagged[0]
    const parameter = (resolved.parameters ?? []).find((entry) => entry.key === first.key)
    const score = Number(entries.find((entry) => entry.date === on)?.values?.[first.key])
    // A band only where there is a 0-10 answer behind it. A yes/no or a
    // choice has no rung to name, and inventing one would be worse than the
    // bare parameter name beside a coloured dot.
    const band = Number.isFinite(score) && (parameter?.type === 'scale' || parameter?.type === 'beap')
      ? BEAP_BANDS[Math.min(BEAP_BANDS.length - 1, Math.max(0, Math.ceil(score / 2)))]?.shortLabel ?? null
      : null
    finding = {
      ...first,
      name: shortName(parameter ? labelOf(parameter) : first.label),
      band,
      daysAgo: Math.round((todayMs - Date.parse(`${on}T00:00:00Z`)) / dayMs),
    }
  }

  return { strip, logged, flagged, earlierFlagged, hadEarlier, finding }
}

// The parameter's name, trimmed for a one-line summary. "Itching (Pruritus
// Score)" is the right label on the form, where the owner is being told which
// instrument they are answering; on the card it is a parenthetical between
// the name and the band. Ash's instruction 3 Sep 2026 — "just say itching".
//
// Trailing parenthetical only, and only here. The stored label is untouched,
// so the form, the calendar and the export all still name the instrument.
function shortName(label) {
  return typeof label === 'string' ? label.replace(/\s*\([^()]*\)\s*$/, '') : label
}

// A UTC millisecond timestamp back to 'YYYY-MM-DD'. UTC on purpose: stepping
// days in local time drifts across a DST boundary, which on a fortnightly
// cadence is a whole slot in the wrong place.
function isoFromUtc(ms) {
  const at = new Date(ms)
  return [
    at.getUTCFullYear(),
    String(at.getUTCMonth() + 1).padStart(2, '0'),
    String(at.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

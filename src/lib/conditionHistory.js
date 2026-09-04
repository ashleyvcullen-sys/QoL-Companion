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
export const WINDOW_DAYS = 14

// The last n ISO dates, oldest first, ending on `todayIso`. UTC arithmetic on
// purpose: new Date('2026-09-03') is midnight UTC, and stepping days in local
// time drifts across a DST boundary.
function lastDates(todayIso, n) {
  const [year, month, day] = String(todayIso).split('-').map(Number)
  if (!year || !month || !day) return []
  const end = Date.UTC(year, month - 1, day)
  const out = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const at = new Date(end - i * 86400000)
    out.push([
      at.getUTCFullYear(),
      String(at.getUTCMonth() + 1).padStart(2, '0'),
      String(at.getUTCDate()).padStart(2, '0'),
    ].join('-'))
  }
  return out
}

export function conditionHistory({ definition, config, entries, species, today }) {
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

  const span = lastDates(today, WINDOW_DAYS * 2)
  const earlier = span.slice(0, WINDOW_DAYS)
  const recent = span.slice(WINDOW_DAYS)
  const isFlagged = (date) => {
    const severity = byDate.get(date)?.severity
    return severity === SEVERITY.CONCERN || severity === SEVERITY.EMERGENCY
  }

  const strip = recent.map((date) => ({ date, severity: byDate.get(date)?.severity ?? null }))
  const logged = strip.filter((day) => day.severity != null).length
  const flagged = recent.filter(isFlagged).length

  const earlierFlagged = earlier.filter(isFlagged).length
  const earlierLogged = earlier.filter((date) => byDate.get(date)?.severity != null).length

  // Only compare fortnights that are actually comparable.
  //
  // "8 flagged, up from 4" was being printed for a pet diagnosed 18 days ago:
  // the previous fortnight held five logged days because monitoring had not
  // started for the other nine, so a full fortnight was being measured against
  // a part of one. Every newly diagnosed pet would read as deteriorating for
  // its first month, in red, under a strip that visibly improves.
  //
  // Half the recent window's logged days is the bar. Below that there is no
  // honest comparison to draw and the count stands on its own.
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
  let finding = null
  for (let i = recent.length - 1; i >= 0 && !finding; i -= 1) {
    const first = byDate.get(recent[i])?.flagged?.[0]
    if (!first) continue
    const parameter = (resolved.parameters ?? []).find((entry) => entry.key === first.key)
    const score = Number(entries.find((entry) => entry.date === recent[i])?.values?.[first.key])
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
      daysAgo: recent.length - 1 - i,
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

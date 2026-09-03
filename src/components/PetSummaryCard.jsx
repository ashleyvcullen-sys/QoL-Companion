import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, Heart, Stethoscope } from 'lucide-react'
import Btn from './Btn'
import Card from './Card'
import PetSwitcher from './PetSwitcher'
import PetText from './PetText'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { todayIsoDate, useAllConditionEntries, usePetConditions } from '../lib/conditionsData'
import { CONDITION_LIST, SEVERITY, labelOf, summariseEntry } from '../lib/conditions'
import { resolveDefinition } from '../lib/cancerConfig'
import { configsByCondition } from '../lib/charts'
import { BEAP_BANDS, computeGeneralQolResult, computeOverviewCategories } from '../lib/scoring'
import OverviewBars from './OverviewBars'
import { WELLBEING_CONCEPTS } from './WellbeingConcepts'
import { MONITORING_STATE, monitoringStatus } from '../lib/monitoringStatus'
import { formatDateDDMMYYYY } from '../lib/formatDate'

// What the home screen says about this pet, before any navigation.
//
// The screen carried no live data at all until 29 Aug 2026: an owner with a
// year of entries saw the same logo, title and ten tiles as one who had signed
// up thirty seconds earlier. Everything the app knew about the animal was two
// taps away, which is a poor trade for the one screen an owner opens most.
//
// Two halves, each answering the same three questions about its own thing:
//
//   How is {name}?     the last assessment, as a score and a direction
//   What do I owe?     due, overdue, or up to date
//   Where do I go?     one button, sized like a decision
//
// Every number here is computed by the same functions the rest of the app
// uses — computeGeneralQolResult, monitoringStatus — so this card cannot
// disagree with the screen it links to.

// The assessment's own cadence lives on the pet, not on a condition
// definition, so it is wrapped to look like one for monitoringStatus.
function assessmentCadence(pet) {
  return { key: 'qol', cadence: { days: pet?.schedule?.qol ?? pet?.schedule?.general ?? 7 } }
}


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
const WINDOW_DAYS = 14

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

function conditionHistory({ definition, config, entries, species, today }) {
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

// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording.
function agoLabel(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export default function PetSummaryCard() {
  const { selectedPet: pet } = usePets()
  const navigate = useNavigate()
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)
  const { conditions } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)
  const today = todayIsoDate()

  const latestGeneral = generalEntries[generalEntries.length - 1] ?? null
  const previousGeneral = generalEntries[generalEntries.length - 2] ?? null

  // Belt and braces on top of the defaults in mapGeneralQolRow.
  //
  // This card is the first thing rendered on launch, so anything it throws
  // takes the whole app down before the owner can reach a single screen. A
  // row this cannot score is worth losing a number over; it is not worth
  // losing the app over.
  const resultFor = (entry) => {
    if (!entry) return null
    try {
      const pain = painEntries.find((row) => row.date === entry.date) ?? null
      return computeGeneralQolResult(entry, pain?.beap)
    } catch (error) {
      console.error('Could not score that assessment:', error.message)
      return null
    }
  }
  const latest = resultFor(latestGeneral)
  const previous = resultFor(previousGeneral)
  const change = latest && previous ? latest.percent - previous.percent : null

  // The five pillars, on the home screen rather than one screen in.
  //
  // Ash's instruction, 29 Aug 2026: this is what the app is built around, and
  // it was the one thing an owner had to go looking for. The single
  // percentage says how {name} is; these say WHICH part of them — a 78%
  // carried by a comfort score of 40 is a different animal to a 78% that is
  // even across the five, and only one of those needs doing something about
  // today.
  //
  // The same computeOverviewCategories the Trends screen uses, so the two
  // cannot disagree. Compact variant: five labelled bars have to sit under a
  // score without becoming the card.
  const overview = useMemo(() => {
    if (!latestGeneral) return null
    const pain = painEntries.find((row) => row.date === latestGeneral.date) ?? null
    try {
      return computeOverviewCategories(latestGeneral, pain)
    } catch (error) {
      console.error('Could not build the pillar overview:', error.message)
      return null
    }
  }, [latestGeneral, painEntries])

  // Everything due, assessment first. A condition whose reminder is off, or
  // that has never been logged, is not "due" — one has no schedule to be
  // measured against and the other has no last date to measure from.
  const qolDue = useMemo(() => {
    if (!pet) return null
    const status = monitoringStatus({
      definition: assessmentCadence(pet),
      schedule: null,
      lastDate: latestGeneral?.date ?? null,
      today,
    })
    return status.state === MONITORING_STATE.DUE ? status : null
  }, [pet, latestGeneral, today])

  // One entry per tracked condition, each carrying its own definition and its
  // own due state — they get a section each now, so a single pooled list of
  // "what is due" no longer answers the question this half asks.
  // Per-pet cancer configuration, keyed by condition — the same map the
  // charts build from, so the summary and the calendar resolve the same
  // parameter set.
  const configs = useMemo(() => configsByCondition(conditions), [conditions])

  const trackedConditions = useMemo(() => {
    if (!pet) return []
    return CONDITION_LIST
      .filter((definition) => conditions.some((row) => row.conditionKey === definition.key))
      .map((definition) => {
        const entries = byCondition[definition.key] ?? []
        const status = monitoringStatus({
          definition,
          schedule: pet.schedule,
          lastDate: entries[entries.length - 1]?.date ?? null,
          today,
        })
        return {
          definition,
          due: status.state === MONITORING_STATE.DUE ? status : null,
          history: conditionHistory({
            definition,
            config: configs[definition.key],
            entries,
            species: pet.species,
            today,
          }),
        }
      })
  }, [pet, conditions, byCondition, configs, today])

  if (!pet) return null

  const trackedCount = trackedConditions.length

  return (
    <Card className="pet-summary">
      <div className="pet-summary-head">
        {/* The brand mark in the top slot, where the pet's photo was —
            Ash's call, 29 Aug 2026, after trying it above the photo and again
            under the title. The pet is named in the line beneath it, so the
            circle above does not also have to identify them. */}
        <img
          src="/images/logo.png"
          alt="Dog and cat, nose to nose, forming a heart"
          className="pet-summary-logo"
        />

        <div className="pet-summary-identity">
          {/* The landing title, on Ash's instruction 29 Aug 2026 — and
              "QoL Companion" rather than "Quality of Life Companion", which
              is the short form the rest of this card now uses. */}
          <h2 className="pet-summary-name">{pet.name}&apos;s QoL Companion</h2>

          <p className="pet-summary-meta">
            {loading ? 'Loading…' : trackedCount > 0
              ? `${trackedCount} condition${trackedCount === 1 ? '' : 's'} monitored`
              : 'No conditions monitored'}
          </p>
        </div>

        {/* The switcher moved here with the title, 29 Aug 2026. It belongs
            with the pet it switches, and leaving it behind in a header card
            that no longer said anything would have kept that card alive for
            one control. */}
        <PetSwitcher />
      </div>

      {/* --- Overall quality of life ------------------------------------ */}
      <section className="pet-summary-section">
        <div className="pet-summary-section-head">
          <div>
            {/* No subtext here, on Ash's instruction 29 Aug 2026. The
                score, the band and the pillars under it say what this is
                better than a sentence describing it does — and the disease
                half keeps its line because that one is genuinely not
                self-evident. */}
            {/* "Overall QoL", to match "Bailey's 5 QoL Pillars" below it.
                The ring's aria-label keeps the words in full — a screen
                reader says "Q O L", which is not what an owner would hear a
                vet say. */}
            {/* The same heart the home screen's assessment tile carries, so
                the two are recognisably the same thing. */}
            <h3 className="pet-summary-section-title">
              <span className="pet-summary-section-icon" aria-hidden="true">
                <Heart size={16} />
              </span>
              Overall QoL
            </h3>
          </div>
        </div>

        {/* Centred, on Ash's instruction 29 Aug 2026, and larger for it.
            This is the app's central number — tucked into the top-right
            corner of a heading row it read as a badge on the title rather
            than as the thing the screen is about. */}
        {latest ? (
          <div className="pet-summary-score">
            <ScoreRing percent={latest.percent} colour={latest.color} size={92} />
            <p className="pet-summary-band" style={{ color: latest.color }}>
              {latest.band}
            </p>
            <p className="pet-summary-change">
              {change == null
                ? formatDateDDMMYYYY(latestGeneral.date)
                : change === 0
                  ? 'Unchanged since last time'
                  : `${Math.abs(change)} points ${change > 0 ? 'higher' : 'lower'} than last time`}
            </p>
          </div>
        ) : (
          <p className="pet-summary-empty">
            No assessment yet. The first one is what everything else is measured against.
          </p>
        )}

        {overview && <PillarSummary petName={pet.name} overview={overview} />}

        {/* Said in words, with the mark the rest of the card uses for
            something needing attention.
            //
            A bare red "3 days late" under a score told an owner a number
            without telling them what was late or what to do about it — and it
            sat directly above a button whose own label had stopped being
            true, since "start today's assessment" is not what someone three
            days behind is being asked for.

            APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. */}
        {qolDue ? (
          <p className={`pet-summary-duenote ${qolDue.overdueBy > 0 ? 'late' : ''}`.trim()}>
            <AlertTriangle size={14} />
            {qolDue.overdueBy > 0
              ? `This assessment is ${qolDue.overdueBy} day${qolDue.overdueBy === 1 ? '' : 's'} overdue`
              : 'This assessment is due today'}
          </p>
        ) : latestGeneral && (
          /* The other half of the same sentence. A screen that only speaks up
             when you are behind teaches an owner that silence means nothing
             in particular — and keeping up is the behaviour this card exists
             to ask for, so it is worth saying out loud when they have. */
          <p className="pet-summary-clear">
            <Check size={14} /> Monitoring up to date
          </p>
        )}

        {/* Only when there is something to do, on Ash's instruction 3 Sep
            2026 — the same rule the condition sections below follow. A button
            under a section that already says "Up to date" invites a tap that
            leads to a form with nothing to fill in, and on a card with two or
            three conditions it was a column of buttons where only some of
            them meant anything.

            The exception is a pet with NO assessment yet. There is nothing to
            be up to date with, and no other way into the assessment from this
            card, so the first-run case always keeps its button.

            APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026 — wording carried
            over unchanged from the version she approved earlier today. */}
        {(qolDue || !latestGeneral) && (
          <Btn type="button" className="btn-block" onClick={() => navigate('/assessment')}>
            {!latestGeneral ? 'Start the first assessment' : 'Go to QoL Assessment'}
          </Btn>
        )}
      </section>

      {/* --- One section per condition ------------------------------------
          Each tracked condition gets its own titled block, on Ash's
          instruction 3 Sep 2026 — "Allergies and Skin Disease Monitoring",
          "Kidney Disease Monitoring" — rather than one "Condition Monitoring"
          heading covering all of them.

          A pet with two conditions is being monitored for two different
          things on two different schedules, and one of them can be overdue
          while the other is not. Pooled, that read as "2 assessments are
          due" with a single button to a list — which told the owner neither
          which one nor took them there. */}
      {trackedConditions.map(({ definition, due: conditionDue, history }) => {
        const Icon = definition.Icon ?? Stethoscope
        return (
          <section className="pet-summary-section" key={definition.key}>
            <div className="pet-summary-section-head">
              <div>
                <h3 className="pet-summary-section-title">
                  <span className="pet-summary-section-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  {definition.label}
                </h3>
              </div>
            </div>

            {/* The same note the assessment above uses, and nothing else.
                This half used to list flagged findings from the last week;
                those are on the page the button opens, in the calendar built
                to show them.

                APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. */}
            {conditionDue ? (
              <p className={`pet-summary-duenote ${conditionDue.overdueBy > 0 ? 'late' : ''}`.trim()}>
                <AlertTriangle size={14} />
                {conditionDue.overdueBy > 0
                  ? `This assessment is ${conditionDue.overdueBy} day${conditionDue.overdueBy === 1 ? '' : 's'} overdue`
                  : 'This assessment is due today'}
              </p>
            ) : (
              <p className="pet-summary-clear">
                <Check size={14} /> Monitoring up to date
              </p>
            )}

            {/* Only when something is actually being asked for, on Ash's
                instruction 3 Sep 2026. A button under a section that already
                says "Up to date" invites a tap that leads to a screen with
                nothing to do on it — and with several conditions tracked, a
                column of identical buttons buried the one that mattered.
                Gone when up to date, the remaining button IS the thing that
                needs doing.

                Shown for "due today" as well as for late: due today is not
                up to date, and a section that says an assessment is due with
                no way to start it is a dead end.

                APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026 — her wording. */}
            {/* How the fortnight went, on Ash's instruction 3 Sep 2026 —
                option A of three she was shown. Between the status line and
                the button: the strip is what "how is it going" means, the
                button is what to do about it. */}
            {history && (
              <div className="dx-summary">
                <div
                  className="dx-strip"
                  role="img"
                  aria-label={history.logged === 0
                    ? 'Nothing logged in the last 14 days'
                    : `Last 14 days: ${history.flagged} day${history.flagged === 1 ? '' : 's'} flagged, ${WINDOW_DAYS - history.logged} not logged`}
                >
                  {history.strip.map((day, index) => (
                    <span
                      key={day.date}
                      className={`dx-day ${day.severity ?? ''} ${index === history.strip.length - 1 ? 'today' : ''}`.replace(/\s+/g, ' ').trim()}
                    />
                  ))}
                </div>
                <p className="dx-scale" aria-hidden="true">
                  <span>14 days ago</span><span>today</span>
                </p>

                {/* APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. Wording, all three lines. */}
                <p className="dx-trend">
                  {history.logged === 0
                    ? 'Nothing logged in the last 14 days'
                    : (
                      <>
                        Last 14 days — <b>{history.flagged === 0 ? 'nothing flagged' : `${history.flagged} flagged`}</b>
                        {history.hadEarlier && history.flagged !== history.earlierFlagged && (
                          <>
                            {', '}
                            <span className={history.flagged < history.earlierFlagged ? 'down' : 'up'}>
                              {history.flagged < history.earlierFlagged ? 'down' : 'up'} from {history.earlierFlagged}
                            </span>
                          </>
                        )}
                      </>
                    )}
                </p>

                {history.finding && (
                  <p className="dx-finding">
                    <span className={`dx-dot ${history.finding.severity === SEVERITY.EMERGENCY ? 'emergency' : ''}`.trim()} />
                    <PetText template={history.finding.name} pet={pet} />
                    {history.finding.band && <>: {history.finding.band}</>}
                    <span className="when"> · {agoLabel(history.finding.daysAgo)}</span>
                  </p>
                )}
              </div>
            )}

            {conditionDue && (
              <Btn
                type="button"
                variant="outline"
                className="btn-block"
                onClick={() => navigate(`/conditions/${definition.key}`)}
              >
                Start {definition.label} assessment now
              </Btn>
            )}
          </section>
        )
      })}

      {/* Nothing tracked yet — one section offering the way in. */}
      {trackedCount === 0 && (
        <section className="pet-summary-section">
          <div className="pet-summary-section-head">
            <div>
              <h3 className="pet-summary-section-title">
                <span className="pet-summary-section-icon" aria-hidden="true">
                  <Stethoscope size={16} />
                </span>
                Conditions
              </h3>
            </div>
          </div>

          <Btn
            type="button"
            variant="outline"
            className="btn-block"
            onClick={() => navigate('/conditions')}
          >
            Set up disease monitoring
          </Btn>
        </section>
      )}

    </Card>
  )
}

// The five pillars, behind an expandable heading.
//
// They belong on this screen — they are what the app is built around — but
// five labelled bars is five lines, and expanded by default they pushed the
// whole disease-monitoring half of this card below the fold on a phone.
//
// A heading and nothing else, on Ash's instruction 29 Aug 2026. An earlier
// version put five severity-coloured dots and the weakest pillar named
// beside it, on the reasoning that a collapsed row should still say
// something. Her call is that the score above already says how {name} is,
// and that a row of dots an owner has to decode earns less than the words
// that tell them plainly what is behind it.
function PillarSummary({ petName, overview }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  return (
    <div className="pet-summary-pillars">
      <button
        type="button"
        className="pet-summary-pillars-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {/* The chevron sits INSIDE the sentence rather than beside it.
            Centred and flexed, a two-line heading left the arrow stranded
            against the right edge of the card, level with the gap between the
            lines and reading as though it belonged to neither. Inline, it
            follows the last word wherever that word ends up.

            Points down when there is more to see and up once it is open, so
            the arrow describes the state rather than the action. */}
        <span>
          {petName}&apos;s 5 QoL Pillars
          <ChevronDown
            size={15}
            className={`expandable-note-chevron ${open ? 'is-open' : ''}`.trim()}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* `hidden` rather than unmounting, so the relationship the button
          points at with aria-controls exists whether or not it is open —
          the same rule ExpandableNote follows. */}
      <div id={bodyId} className="pet-summary-pillars-body" hidden={!open}>
        <OverviewBars concepts={WELLBEING_CONCEPTS} overview={overview} compact />
      </div>
    </div>
  )
}

// The score, as a ring rather than a number on its own.
//
// A number says 68%; a ring says 68% of what, at a glance and without being
// read. Drawn rather than charted — one circle needs no library, and the
// chart library's smallest useful unit is heavier than this whole card.
function ScoreRing({ percent, colour, size = 64 }) {
  // Drawn in a fixed 64-unit viewBox and scaled by `size`, so the stroke and
  // the gap keep their proportions at any diameter rather than needing a
  // second set of numbers per size.
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const filled = Math.max(0, Math.min(100, percent)) / 100

  return (
    <span
      className="pet-summary-ring"
      role="img"
      aria-label={`Quality of life ${percent}%`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="pet-summary-ring-value" style={{ color: colour }}>{percent}%</span>
    </span>
  )
}

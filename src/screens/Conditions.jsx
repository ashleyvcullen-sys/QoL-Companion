import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Lock } from 'lucide-react'
import Card from '../components/Card'
import ConditionIntroModal from '../components/ConditionIntroModal'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import { usePets } from '../lib/PetsContext'
import { todayIsoDate, useAllConditionEntries, usePetConditions } from '../lib/conditionsData'
import { CONDITION_LIST, MONITORING_DISCLAIMER } from '../lib/conditions'
import { MONITORING_STATE, monitoringStatus } from '../lib/monitoringStatus'

// What the tile says about a condition's schedule, beside "Tracking".
//
// Only two states get a word. "Off" and "never logged" are not schedule
// states — one has no schedule to be measured against and the other cannot be
// tracked in the first place — and a tile that labels every possible
// condition of the world is a tile nobody reads.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 3 Sep 2026. "Overdue" and "On track" are borrowed from the
// Schedule screen so the same state has the same name in both places.
function scheduleNoteFor(status) {
  if (status.state === MONITORING_STATE.DUE) {
    return {
      className: 'due',
      // The same warning triangle the emergency alerts use. AlertCircle was
      // here first and reads as an information dot at 13px — at this size the
      // triangle is the only one of the two whose exclamation mark is
      // legible at a glance, which is the entire job of the icon.
      Icon: AlertTriangle,
      // Being due today is not being late, and saying "1 day overdue" to
      // someone who filled it in this morning last week is both wrong and
      // discouraging.
      // Short deliberately. Rendered, "Due — 3 days late" pushed
      // "Cognitive Decline / Dementia" onto three lines and left the name
      // narrower than the status beside it. The amber and the alert icon
      // already carry "this needs doing"; the words only have to say when.
      text: status.overdueBy === 0
        ? 'Due today'
        : status.overdueBy === 1
          ? '1 day late'
          : `${status.overdueBy} days late`,
    }
  }

  if (status.state === MONITORING_STATE.OK) {
    return { className: 'on-track', Icon: Check, text: 'On track' }
  }

  return null
}

export default function Conditions() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  // Which condition the owner has tapped but not yet said yes to.
  const [offering, setOffering] = useState(null)
  // Only the loading flag: which conditions have a row is deliberately not
  // what this screen reads. "Tracking" means readings have been logged, and
  // that comes from byCondition below.
  const { loading } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)
  const today = todayIsoDate()

  // "Tracking" means readings have been logged, NOT that a row exists in
  // pet_conditions. Looking someone up is not the same as monitoring them:
  // tapping in to read what a condition involves, or getting as far as
  // choosing a diagnosis and stopping, should not tick the badge. Only a
  // saved assessment does that.
  const trackedKeys = new Set(
    Object.entries(byCondition)
      .filter(([, entries]) => entries.length > 0)
      .map(([key]) => key),
  )

  function open(condition) {
    // Deliberately no write here. The pet_conditions row is created on the
    // first save — of an assessment, or of a cancer setup — so that backing
    // out of a condition leaves nothing behind.
    //
    // Every condition opens on its own page, cancer included. Cancer used to
    // skip straight to setup on a first visit, which put the owner one screen
    // deep with no idea what they had opened — and pressing back landed them
    // on a page telling them to start with the diagnosis they had just been
    // asked for. The condition page IS the start: it introduces cancer and
    // offers the diagnosis button, and setup sits one level below it where
    // back means back.
    // Every condition says what it covers before it opens — Ash's
    // instruction 24 Sep 2026. It used to ask only for a condition with
    // nothing logged yet; the summary is worth reading whether or not this is
    // the first visit, and an owner scanning the list should not land inside
    // a form they did not choose either way.
    setOffering(condition)
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card className="bcs-intro">
        <SectionTitle>Disease-Specific Monitoring</SectionTitle>
        {/* The sentence that used to sit here now opens the confirmation
            pop-up on the Assess screen, where the choice is made — Ash's
            instruction 24 Sep 2026. Only the disclaimer stays: it has to be
            on the screen it applies to, not on the way in to it. */}
        <p className="assessment-hint">{MONITORING_DISCLAIMER}</p>
      </Card>

      <div className="condition-grid">
        {CONDITION_LIST.map((condition) => {
          const { Icon } = condition
          const monitored = trackedKeys.has(condition.key)
          const disabled = condition.comingSoon

          // Only for conditions actually being tracked. A condition with no
          // readings has no last entry to be due against, and telling someone
          // they are behind on something they never started is nonsense.
          const entries = byCondition[condition.key] ?? []
          const scheduleNote = monitored
            ? scheduleNoteFor(monitoringStatus({
              definition: condition,
              schedule: pet.schedule,
              lastDate: entries[entries.length - 1]?.date ?? null,
              today,
            }))
            : null

          const inner = (
            <Card className={`condition-tile ${disabled ? 'condition-tile-disabled' : ''}`.trim()}>
              {/* Larger than the 22px used on Home. These are detailed
                  line-art organs rather than simple glyphs, and at 22px the
                  vessels and internal structure that make a heart read as a
                  heart disappear entirely. */}
              <span className={`icon-badge condition-badge ${disabled ? 'icon-badge-disabled' : ''}`.trim()}>
                {Icon && <Icon size={34} color="#fff" />}
              </span>
              {/* Label only. The summary — what a condition covers, which
                  diseases fall under it — used to sit here, and turned the
                  list into eight paragraphs to read before you could choose
                  anything. It now appears on the condition's own page, where
                  it is the answer to "is this the right one?" rather than a
                  wall of text in front of the question. */}
              <span className="condition-tile-body">
                <span className="condition-tile-label">{condition.label}</span>
              </span>
              {disabled ? (
                <span className="condition-tile-status"><Lock size={13} /> Coming soon</span>
              ) : monitored ? (
                <span className="condition-tile-statuses">
                  <span className="condition-tile-status tracking"><Check size={13} /> Tracking</span>
                  {scheduleNote && (
                    <span className={`condition-tile-status ${scheduleNote.className}`}>
                      <scheduleNote.Icon size={13} /> {scheduleNote.text}
                    </span>
                  )}
                </span>
              ) : null}
            </Card>
          )

          if (disabled) {
            return <div key={condition.key} className="condition-tile-link">{inner}</div>
          }

          return (
            <button
              key={condition.key}
              type="button"
              className="condition-tile-link"
              disabled={loading}
              onClick={() => open(condition)}
            >
              {inner}
            </button>
          )
        })}
      </div>

      <ConditionIntroModal
        definition={offering}
        pet={pet}
        onClose={() => setOffering(null)}
        onProceed={() => {
          const key = offering.key
          setOffering(null)
          navigate(`/conditions/${key}`)
        }}
      />

    </div>
  )
}

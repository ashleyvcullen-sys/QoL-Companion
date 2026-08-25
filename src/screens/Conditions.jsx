import { useNavigate } from 'react-router-dom'
import { Check, Lock } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { usePets } from '../lib/PetsContext'
import PetText from '../components/PetText'
import { CONDITION_LIST } from '../lib/conditions'
import { useAllConditionEntries, usePetConditions } from '../lib/conditionsData'

export default function Conditions() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { conditions, loading } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)

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
    navigate(`/conditions/${condition.key}`)
  }

  return (
    <div className="screen">
      <HomeLink />

      <Card className="bcs-intro">
        <SectionTitle>Disease-Specific Monitoring</SectionTitle>
        <p>
          Track the things that matter for a condition {pet.name} has been diagnosed with,
          alongside <PetText template="{their}" pet={pet} /> general quality of life.
        </p>
        <p className="assessment-hint">
          This doesn't replace your vet's monitoring plan but will help make monitoring at home
          easier between visits.
        </p>
      </Card>

      <div className="condition-grid">
        {CONDITION_LIST.map((condition) => {
          const { Icon } = condition
          const monitored = trackedKeys.has(condition.key)
          const disabled = condition.comingSoon

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
                <span className="condition-tile-status tracking"><Check size={13} /> Tracking</span>
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

      <Footer />
    </div>
  )
}

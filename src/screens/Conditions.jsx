import { useNavigate } from 'react-router-dom'
import { Check, Lock } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { usePets } from '../lib/PetsContext'
import PetText from '../components/PetText'
import { CONDITION_LIST } from '../lib/conditions'
import { addPetCondition, usePetConditions } from '../lib/conditionsData'

export default function Conditions() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const navigate = useNavigate()
  const { conditions, loading, refresh } = usePetConditions(pet?.id)

  const monitoredKeys = new Set(conditions.map((entry) => entry.conditionKey))

  async function open(condition) {
    // Tapping a condition that isn't being monitored yet starts monitoring it
    // and goes straight in. An "add" step first would be a screen whose only
    // content is a confirm button.
    if (!monitoredKeys.has(condition.key)) {
      await addPetCondition({ petId: pet.id, conditionKey: condition.key }).catch(() => {})
      refresh()
    }
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
          const monitored = monitoredKeys.has(condition.key)
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

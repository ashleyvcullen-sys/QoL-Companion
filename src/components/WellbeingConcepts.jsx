import { useState } from 'react'
import ComfortIcon from './icons/ComfortIcon'
import AppetiteIcon from './icons/AppetiteIcon'
import SleepIcon from './icons/SleepIcon'
import CuriosityIcon from './icons/CuriosityIcon'
import ConnectionIcon from './icons/ConnectionIcon'

export const WELLBEING_CONCEPTS = [
  {
    key: 'comfort',
    label: 'Comfort',
    Icon: ComfortIcon,
    color: '#C97B8C',
    tint: 'rgba(201, 123, 140, 0.14)',
    definition: 'Physical ease — moving, resting, and breathing without pain or distress.',
  },
  {
    key: 'appetite',
    label: 'Appetite',
    Icon: AppetiteIcon,
    color: '#B5651D',
    tint: 'rgba(181, 101, 29, 0.14)',
    definition: 'A healthy interest in eating and drinking, which is often one of the clearest signs of how your pet is really feeling.',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    Icon: SleepIcon,
    color: '#5C6F8A',
    tint: 'rgba(92, 111, 138, 0.14)',
    definition: 'Settled, restful sleep on a normal day-and-night pattern, rather than restless or disrupted rest.',
  },
  {
    key: 'curiosity',
    label: 'Curiosity',
    Icon: CuriosityIcon,
    color: '#3D8259',
    tint: 'rgba(61, 130, 89, 0.14)',
    definition: 'Interest in toys, people, surroundings, or play — a sign your pet still finds enjoyment in daily life.',
  },
  {
    key: 'connection',
    label: 'Connection',
    Icon: ConnectionIcon,
    color: '#8A5C6F',
    tint: 'rgba(138, 92, 111, 0.14)',
    definition: 'Wanting to be near you, responding to you, and engaging with family — the social and emotional side of wellbeing.',
  },
]

export default function WellbeingConcepts() {
  const [activeKey, setActiveKey] = useState(null)
  const active = WELLBEING_CONCEPTS.find((concept) => concept.key === activeKey)

  return (
    <>
      <div className="concept-row">
        {WELLBEING_CONCEPTS.map(({ key, label, Icon, color, tint }) => {
          const isActive = activeKey === key
          return (
            <button
              key={key}
              type="button"
              className={`concept-circle ${isActive ? 'active' : ''}`.trim()}
              onClick={() => setActiveKey(isActive ? null : key)}
            >
              <span className="concept-icon" style={{ background: isActive ? color : tint }}>
                <Icon size={20} color={isActive ? '#fff' : color} />
              </span>
              <span className="concept-label">{label}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <p className="concept-definition" style={{ background: active.tint }}>
          {active.definition}
        </p>
      )}
    </>
  )
}

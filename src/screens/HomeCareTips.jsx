import { useState } from 'react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Modal from '../components/Modal'
import HomeLink from '../components/HomeLink'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { HOME_CARE_TIPS } from '../lib/homeCareTips'

export default function HomeCareTips() {
  const [activeKey, setActiveKey] = useState(null)
  const activeConcept = WELLBEING_CONCEPTS.find((concept) => concept.key === activeKey)

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        {/* The line that used to sit here is now the sentence the More
            screen shows before opening this one — Ash's instruction 24 Sep
            2026. Said once, where the choice is made. */}
        <SectionTitle>Home Care Tips</SectionTitle>
      </Card>

      <div className="icon-grid">
        {WELLBEING_CONCEPTS.map(({ key, label, Icon, color }) => (
          <button
            key={key}
            type="button"
            className="icon-tile-link"
            onClick={() => setActiveKey(key)}
          >
            <Card className="icon-tile">
              <span className="icon-badge" style={{ background: color }}>
                <Icon size={22} color="#fff" />
              </span>
              <span className="icon-tile-label">{label}</span>
            </Card>
          </button>
        ))}
      </div>

      {activeConcept && (
        <Modal title={activeConcept.label} onClose={() => setActiveKey(null)}>
          <ul className="emergency-list">
            {HOME_CARE_TIPS[activeConcept.key].map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </Modal>
      )}

    </div>
  )
}

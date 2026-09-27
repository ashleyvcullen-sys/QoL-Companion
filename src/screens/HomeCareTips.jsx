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
        {/* A line was removed from here on 24 Sep 2026 because it repeated the
            sentence More already shows before opening this screen. One is back
            on Ash's instruction 27 Sep 2026 — but saying something different:
            More says what the screen is for, this says how to use it, which is
            the thing an owner looking at five unlabelled tiles needs.
            
            APPROVED — Dr Ash Cullen (BSc, DVM), 27 Sep 2026. The wording. */}
        <SectionTitle>Home Care Tips</SectionTitle>
        <p className="screen-intro">
          Grouped by the five pillars of quality of life — comfort, appetite, sleep, curiosity
          and connection. Tap one for things you can try at home.
        </p>
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

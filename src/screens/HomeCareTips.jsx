import { useState } from 'react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Modal from '../components/Modal'
import HomeLink from '../components/HomeLink'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'

const HOME_CARE_TIPS = {
  comfort: [
    'Add orthopedic or memory-foam bedding, especially for pets with arthritis — look for low, easy-entry beds.',
    'Use rugs or yoga mats on slippery floors (hardwood/tile) to help with traction for stiff joints.',
    'Consider ramps or steps for beds, couches, and cars instead of jumping.',
    'Ensure nails do not become overgrown.',
    'Keep the home at a stable, comfortable temperature — older pets regulate body heat less efficiently.',
  ],
  appetite: [
    'Warm food slightly to enhance aroma, which can boost interest.',
    'Try softer textures (canned, mashed, or moistened kibble) especially if dental disease or discomfort is present.',
    'Raise food and water bowls to reduce neck/back strain.',
    'Offer smaller, more frequent meals if your pet struggles with large portions.',
    "Have your veterinarian check for dental disease — it's a very common cause of appetite decline.",
  ],
  sleep: [
    'Provide a quiet, draft-free, low-traffic sleeping spot away from stairs or busy areas.',
    'Consider a nightlight if your pet has vision changes — disorientation in the dark can cause restless waking.',
    'Keep a consistent routine for bed and wake times; predictability reduces anxiety-driven sleep disruption.',
    'If you notice pacing, vocalizing at night, or disrupted sleep-wake cycles, mention it to your vet — this can be a sign of cognitive decline.',
  ],
  curiosity: [
    'Swap high-energy play for low-impact enrichment: snuffle mats, puzzle feeders, scent games, or short sniffy walks.',
    'Rotate toys periodically to keep novelty.',
    'Short, gentle training sessions (even old dogs learn new cues) keep the mind active without physical strain.',
    'For cats, window perches or cardboard boxes can provide low-effort stimulation.',
    'Watch for a drop in interest in previously enjoyed things — while some decline is normal with age, a sudden change is worth a vet visit.',
  ],
  connection: [
    'Keep up gentle physical affection — slow petting, brushing, or simply sitting nearby — even if playtime looks different now.',
    'Maintain routines (feeding times, walks, cuddle time) since predictability itself is comforting and reduces anxiety.',
    "Involve senior pets in family activities at their pace rather than leaving them out because they're slower.",
    'If mobility limits how they interact, bring the interaction to them — floor time, lap time, or moving their bed to a central room.',
    "Watch for withdrawal or clinginess that's out of character — both can be signs of discomfort, pain, or cognitive changes and are worth flagging to a vet.",
  ],
}

export default function HomeCareTips() {
  const [activeKey, setActiveKey] = useState(null)
  const activeConcept = WELLBEING_CONCEPTS.find((concept) => concept.key === activeKey)

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Home Care Tips</SectionTitle>
        <p className="home-subtitle">
          Practical things you can do at home to help your pet's quality of life.
        </p>
      </Card>

      <div className="icon-grid">
        {WELLBEING_CONCEPTS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className="icon-tile-link"
            onClick={() => setActiveKey(key)}
          >
            <Card className="icon-tile">
              <span className="icon-badge">
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

import { useState } from 'react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Modal from '../components/Modal'
import AgeBracketPicker from './endOfLife/AgeBracketPicker'
import { END_OF_LIFE_TOPICS } from '../lib/endOfLifeTopics'
import { usePets } from '../lib/PetsContext'
import { useLatestGeneralQol } from '../lib/useLatestGeneralQol'
import { computeGeneralQolResult } from '../lib/scoring'

export default function EndOfLife() {
  const { pets } = usePets()
  const pet = pets[0]
  const { entry: latestEntry, loading } = useLatestGeneralQol(pet?.id)
  const [activeTopicKey, setActiveTopicKey] = useState(null)

  const activeTopic = END_OF_LIFE_TOPICS.find((topic) => topic.key === activeTopicKey)
  const latestResult = latestEntry ? computeGeneralQolResult(latestEntry) : null

  return (
    <div className="screen">
      <Card>
        <SectionTitle>End Of Life</SectionTitle>
        <p>
          A gentle, practical reference for one of the hardest parts of caring for an
          animal — written to be read whenever it's useful, not just at the end.
        </p>
      </Card>

      <Card>
        <SectionTitle>Most recent QoL score</SectionTitle>
        {loading && <p>Loading…</p>}
        {!loading && !latestResult && <p>No assessments logged yet.</p>}
        {!loading && latestResult && (
          <div className="review-summary-row">
            <span>{latestResult.total} / {latestResult.max} — {latestResult.band}</span>
            <span className="assessment-hint">{latestEntry.date}</span>
          </div>
        )}
      </Card>

      <div className="icon-grid">
        {END_OF_LIFE_TOPICS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className="icon-tile-link"
            onClick={() => setActiveTopicKey(key)}
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

      {activeTopic && (
        <Modal title={activeTopic.label} onClose={() => setActiveTopicKey(null)}>
          {activeTopic.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph.replace('[pet]', pet?.name || 'them')}</p>
          ))}
          {activeTopic.hasAgeBracketPicker && <AgeBracketPicker />}
          {activeTopic.citation && <p className="modal-citation">{activeTopic.citation}</p>}
        </Modal>
      )}
    </div>
  )
}

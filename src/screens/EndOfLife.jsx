import { useState } from 'react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Modal from '../components/Modal'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import AgeBracketPicker from './endOfLife/AgeBracketPicker'
import { END_OF_LIFE_TOPICS } from '../lib/endOfLifeTopics'
import { usePets } from '../lib/PetsContext'
import { useLatestGeneralQol } from '../lib/useLatestGeneralQol'
import { computeGeneralQolResult } from '../lib/scoring'

// Splits on **bold** markers and renders the matched segments as <strong>,
// so topic content can carry simple inline emphasis from a plain data file.
function renderInlineText(text) {
  return text.split(/(\*\*.+?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

export default function EndOfLife() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { entry: latestEntry, beap: latestBeap, loading } = useLatestGeneralQol(pet?.id)
  const [activeTopicKey, setActiveTopicKey] = useState(null)

  const activeTopic = END_OF_LIFE_TOPICS.find((topic) => topic.key === activeTopicKey)
  const latestResult = latestEntry ? computeGeneralQolResult(latestEntry, latestBeap) : null

  return (
    <div className="screen">
      <HomeLink />

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
          {activeTopic.content.map((block, i) => {
            if (block.type === 'list') {
              return (
                <ul key={i} className="emergency-list">
                  {block.items.map((item, j) => (
                    <li key={j}>{renderInlineText(item.replace('[pet]', pet?.name || 'them'))}</li>
                  ))}
                </ul>
              )
            }
            return <p key={i}>{renderInlineText(block.text.replace('[pet]', pet?.name || 'them'))}</p>
          })}
          {activeTopic.hasAgeBracketPicker && <AgeBracketPicker />}
          {activeTopic.citation && <p className="modal-citation">{activeTopic.citation}</p>}
        </Modal>
      )}

      <Footer />
    </div>
  )
}

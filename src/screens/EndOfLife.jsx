import { useState } from 'react'
import Card from '../components/Card'
import Modal from '../components/Modal'
import HomeLink from '../components/HomeLink'
import AgeBracketPicker from './endOfLife/AgeBracketPicker'
import { END_OF_LIFE_TOPICS } from '../lib/endOfLifeTopics'
import { usePets } from '../lib/PetsContext'

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
  const [activeTopicKey, setActiveTopicKey] = useState(null)

  const activeTopic = END_OF_LIFE_TOPICS.find((topic) => topic.key === activeTopicKey)

  return (
    <div className="screen">
      <HomeLink />

      {/* A heading, not a card. The card held one line of text and cost
          nearly sixty pixels of the one screen this has to fit into — Ash's
          instruction 24 Sep 2026, "fit end of life into one screen so user
          doesn't need to scroll". The sentence that used to sit under it is
          the one the More screen shows before opening this, and the Most
          Recent QoL Score card went on 24 Sep 2026 too: this is the screen
          an owner opens when they are weighing something a number cannot
          answer. */}
      <h2 className="section-title">End of Life</h2>

      {/* Eight tiles, all of them on screen at once. `compact` is what makes
          that possible — see index.css. */}
      <div className="icon-grid compact">
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

    </div>
  )
}

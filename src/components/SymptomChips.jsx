import { useState } from 'react'
import Modal from './Modal'

export default function SymptomChips({ options, selected, onChange }) {
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [otherText, setOtherText] = useState('')

  function closeOtherInput() {
    setOtherText('')
    setShowOtherInput(false)
  }

  function toggle(option) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  function addOther() {
    if (otherText.trim()) {
      onChange([...selected, `Other: ${otherText.trim()}`])
      setOtherText('')
      setShowOtherInput(false)
    }
  }

  return (
    <div className="symptom-chips">
      {options.map((option) => {
        if (option === 'None') {
          return (
            <button
              key={option}
              type="button"
              className={`chip ${selected.length === 0 ? 'selected' : ''}`.trim()}
              onClick={() => onChange([])}
            >
              None
            </button>
          )
        }

        if (option === 'Other') {
          const hasOtherEntry = selected.some((s) => s.startsWith('Other:'))
          return (
            <button
              key={option}
              type="button"
              className={`chip ${hasOtherEntry ? 'selected' : ''}`.trim()}
              onClick={() => setShowOtherInput(true)}
            >
              Other
            </button>
          )
        }

        return (
          <button
            key={option}
            type="button"
            className={`chip ${selected.includes(option) ? 'selected' : ''}`.trim()}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        )
      })}

      {showOtherInput && (
        <Modal title="Describe symptom" onClose={closeOtherInput}>
          <div className="chip-other-modal">
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Describe symptom"
              autoFocus
            />
            <div className="chip-other-modal-actions">
              <button type="button" onClick={addOther}>Add</button>
              <button type="button" onClick={closeOtherInput}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

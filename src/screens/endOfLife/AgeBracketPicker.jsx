import { useState } from 'react'
import { AGE_BRACKET_GRIEF_DATA } from '../../lib/endOfLifeTopics'

export default function AgeBracketPicker() {
  const [activeKey, setActiveKey] = useState(null)
  const active = AGE_BRACKET_GRIEF_DATA.find((bracket) => bracket.key === activeKey)

  return (
    <div className="age-bracket-picker">
      <p className="assessment-hint">
        Click on the age brackets to read about how children of different ages grieve.
      </p>
      <div className="age-bracket-row">
        {AGE_BRACKET_GRIEF_DATA.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`age-bracket-button ${activeKey === key ? 'active' : ''}`.trim()}
            onClick={() => setActiveKey(activeKey === key ? null : key)}
          >
            {label}
          </button>
        ))}
      </div>

      {active && (
        <div className="age-bracket-table">
          <div className="age-bracket-row-item">
            <span className="age-bracket-field-label">How They Tend To Grieve</span>
            <span>{active.grieve}</span>
          </div>
          <div className="age-bracket-row-item">
            <span className="age-bracket-field-label">Understanding Of Death</span>
            <span>{active.understanding}</span>
          </div>
          <div className="age-bracket-row-item">
            <span className="age-bracket-field-label">How Adults Can Help</span>
            <span>{active.help}</span>
          </div>
        </div>
      )}
    </div>
  )
}

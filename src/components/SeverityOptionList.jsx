import { AlertTriangle } from 'lucide-react'
import { SEVERITY_COLORS } from '../lib/scoring'

const SCORES = [0, 2, 4, 6, 8, 10]
const EMERGENCY_MARKER = '(emergency)'

const BEAP_BANDS = [
  { value: 0, label: "No abnormalities" },
  { value: 2, label: "Mild (1–2)" },
  { value: 4, label: "Moderate (3–4)" },
  { value: 6, label: "Moderate to severe (5–6)" },
  { value: 8, label: "Severe (7–8)" },
  { value: 10, label: "Very severe (9–10)" },
]

function bandColorForIndex(i) {
  if (i <= 1) return SEVERITY_COLORS.good
  if (i <= 3) return SEVERITY_COLORS.moderate
  return SEVERITY_COLORS.severe
}

function parseEmergencyFlag(text) {
  const isEmergency = text.includes(EMERGENCY_MARKER)
  const cleanText = text.replace(`${EMERGENCY_MARKER}`, '').trim()
  return { isEmergency, cleanText }
}

export default function SeverityOptionList({ levels, value, onChange, species, categoryKey }) {
  return (
    <div className="severity-option-list">
      {levels.map((text, i) => {
        const score = SCORES[i]
        const band = BEAP_BANDS[i]
        const { isEmergency, cleanText } = parseEmergencyFlag(text)
        const imageSrc = species && categoryKey ? `/images/beap/${species}_${categoryKey}_${i}.jpg` : null

        return (
          <button
            key={score}
            type="button"
            className={`severity-option ${value === score ? 'selected' : ''} ${isEmergency ? 'emergency' : ''}`.trim()}
            onClick={() => onChange(score)}
          >
            <span className="severity-option-content">
              {imageSrc && <img src={imageSrc} alt="" className="severity-option-thumb" />}
              <span>
                <strong style={{ color: bandColorForIndex(i) }}>{band.label}:</strong> {cleanText}
              </span>
            </span>
            {isEmergency && <AlertTriangle size={16} className="severity-option-emergency-icon" />}
          </button>
        )
      })}
    </div>
  )
}

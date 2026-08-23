import { AlertTriangle } from 'lucide-react'
import { BEAP_BANDS, bandColorForIndex } from '../lib/scoring'

const BEAP_SCORES = [0, 2, 4, 6, 8, 10]
const EMERGENCY_MARKER = '(emergency)'

function parseEmergencyFlag(text) {
  const isEmergency = text.includes(EMERGENCY_MARKER)
  const cleanText = text.replace(`${EMERGENCY_MARKER}`, '').trim()
  return { isEmergency, cleanText }
}

// Shared picker for any "choose one level from an ordered scale" question.
//
// Defaults reproduce the BEAAAAPP behaviour exactly (six levels scored
// 0/2/4/6/8/10, labelled and coloured from BEAP_BANDS), so existing callers
// need no changes. BCS overrides `scores`, `bandLabels` and `colorForIndex`
// to render a 1-9 scale instead — the visual pattern is identical, only the
// scale differs.
export default function SeverityOptionList({
  levels,
  value,
  onChange,
  species,
  categoryKey,
  scores = BEAP_SCORES,
  bandLabels,
  colorForIndex = bandColorForIndex,
}) {
  const resolvedLabels = bandLabels ?? BEAP_BANDS.map((band) => band.label)

  return (
    <div className="severity-option-list">
      {levels.map((text, i) => {
        const score = scores[i]
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
                <strong style={{ color: colorForIndex(i) }}>{resolvedLabels[i]}:</strong> {cleanText}
              </span>
            </span>
            {isEmergency && <AlertTriangle size={16} className="severity-option-emergency-icon" />}
          </button>
        )
      })}
    </div>
  )
}

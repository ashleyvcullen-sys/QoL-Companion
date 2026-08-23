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
//
// Imagery comes in two shapes. BEAAAAPP passes `species` + `categoryKey` and
// gets the square 48px thumb beside the text. BCS passes `imageSrcFor` with
// `imageLayout="wide"`, because its reference art is a ~6:1 strip (top view
// beside side view) that is unreadable at 48px and needs the full card width
// above the text.
//
// `descriptionOnSelect` exists for the same reason. Nine wide illustrations
// plus nine full descriptions is ~1320px of scrolling, but collapsing the
// illustrations would defeat the point of a visual scale — you compare your
// animal against all nine at once. So the art always shows and the prose
// collapses to its band label until that option is picked. The full text
// still reaches screen readers via aria-label.
export default function SeverityOptionList({
  levels,
  value,
  onChange,
  species,
  categoryKey,
  scores = BEAP_SCORES,
  bandLabels,
  colorForIndex = bandColorForIndex,
  imageSrcFor = null,
  imageAltFor = null,
  imageLayout = 'thumb',
  descriptionOnSelect = false,
}) {
  const resolvedLabels = bandLabels ?? BEAP_BANDS.map((band) => band.label)
  const isWide = imageLayout === 'wide'

  return (
    <div className="severity-option-list">
      {levels.map((text, i) => {
        const score = scores[i]
        const { isEmergency, cleanText } = parseEmergencyFlag(text)
        const imageSrc = imageSrcFor
          ? imageSrcFor(score, i)
          : species && categoryKey
            ? `/images/beap/${species}_${categoryKey}_${i}.jpg`
            : null

        const showDescription = !descriptionOnSelect || value === score

        const className = [
          'severity-option',
          value === score ? 'selected' : '',
          isEmergency ? 'emergency' : '',
          imageSrc && isWide ? 'wide-image' : '',
          showDescription ? '' : 'label-only',
        ].filter(Boolean).join(' ')

        return (
          <button
            key={score}
            type="button"
            className={className}
            aria-label={showDescription ? undefined : `${resolvedLabels[i]}: ${cleanText}`}
            onClick={() => onChange(score)}
          >
            <span className="severity-option-content">
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt={imageAltFor ? imageAltFor(score, i) : ''}
                  className={isWide ? 'severity-option-wide-img' : 'severity-option-thumb'}
                  loading="lazy"
                />
              )}
              <span>
                <strong style={{ color: colorForIndex(i) }}>
                  {resolvedLabels[i]}{showDescription ? ':' : ''}
                </strong>
                {showDescription && ` ${cleanText}`}
              </span>
            </span>
            {isEmergency && <AlertTriangle size={16} className="severity-option-emergency-icon" />}
          </button>
        )
      })}
    </div>
  )
}

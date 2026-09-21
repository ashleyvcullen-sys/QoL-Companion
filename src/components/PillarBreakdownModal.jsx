import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Btn from './Btn'
import { severityColorFromPercent } from '../lib/scoring'
import { fillPetText } from '../lib/petText'

// What is holding one wellbeing pillar down, answer by answer.
//
// Opened from the pillar bars on the home screen. Reads the same breakdown
// the pillar percentage is averaged from (computeOverviewBreakdown), so the
// list and the number cannot disagree. Answers below 100% are listed worst
// first; the rest are summarised in one line, because "these eleven things
// are fine" is not what an owner opened this to read.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 21 Sep 2026. Wording.
export default function PillarBreakdownModal({ concept, value, items = [], pet, onClose }) {
  if (!concept) return null
  const reduced = items.filter((item) => item.score < 100).sort((a, b) => a.score - b.score)
  const fine = items.length - reduced.length
  const capped = items.some((item) => item.red)

  return (
    <Modal title={`${concept.label}${value != null ? ` — ${Math.round(value)}%` : ''}`} onClose={onClose}>
      <p className="assessment-hint">{concept.definition}</p>

      {items.length === 0 ? (
        <p>Nothing recorded for this yet. It fills in from the next Quality of Life Assessment.</p>
      ) : reduced.length === 0 ? (
        <p><strong>Nothing is bringing this down</strong> in the most recent assessment.</p>
      ) : (
        <>
          <p><strong>What's bringing this down</strong></p>
          <div className="pillar-breakdown">
            {reduced.map((item, index) => (
              <div className="review-summary-row" key={`${item.label}-${index}`}>
                <span>
                  {item.red && <AlertTriangle size={13} className="pillar-breakdown-flag" aria-label="Urgent" />}
                  {fillPetText(item.label, pet)}
                  {item.detail && (
                    <span className="pillar-breakdown-detail">{fillPetText(item.detail, pet)}</span>
                  )}
                </span>
                <strong style={{ color: severityColorFromPercent(item.score) }}>{item.score}%</strong>
              </div>
            ))}
          </div>
          {capped && (
            <p className="assessment-hint">
              An urgent answer holds this pillar at 49% or below, whatever the others show.
            </p>
          )}
          {fine > 0 && (
            <p className="assessment-hint">
              {fine} other {fine === 1 ? 'answer' : 'answers'} in this pillar {fine === 1 ? 'is' : 'are'} at 100%.
            </p>
          )}
        </>
      )}

      <Btn type="button" className="btn-block" onClick={onClose}>Got It</Btn>
    </Modal>
  )
}

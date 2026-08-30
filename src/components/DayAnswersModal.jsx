import Modal from './Modal'
import PetText from './PetText'
import { SEVERITY_COLOURS } from '../lib/conditions'

// One day's answers, question by question.
//
// A calendar cell can carry a colour and a mark; it cannot carry "what did I
// actually say about her breathing on the 14th?". That question used to have
// no answer anywhere in the app — the data was saved, charted and exported,
// but never shown back as the questions it came from.
//
// Rows arrive already described (see describeAssessmentDay and
// describeConditionDay); nothing here knows what a BEAAAAPP score is.
export default function DayAnswersModal({
  title, dateLabel, rows, pet, emptyMessage, onClose,
  // The note written on this day, and the way to remove it. Both optional:
  // the assessment's version of this modal has neither, and a day with no
  // note shows nothing.
  //
  // Added 29 Aug 2026 on Ash's instruction. A note saved on a past day could
  // be read — it marks the calendar and shows in the day's line — but there
  // was no way to take it back, because the form only ever edits today. A
  // note written about the wrong pet, or one the owner would rather their vet
  // did not read, was permanent.
  note, onDeleteNote,
  // Set by the caller when a delete fails, so the reason lands next to the
  // button that failed rather than in a console nobody has open.
  noteError,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="day-answers-date">{dateLabel}</p>

      {note && (
        <div className="day-answers-note">
          <p className="day-answers-note-text">{note}</p>
          {onDeleteNote && (
            <>
              <button type="button" className="subtle-link" onClick={onDeleteNote}>
                Delete this note
              </button>
              {/* Said plainly, because "delete" beside a day's readings is
                  alarming and the owner has no way of knowing which of the two
                  things on this screen it means. It removes the words they
                  wrote; every score and answer below stays. */}
              <p className="day-answers-note-caveat">
                This removes the note only. The answers and scores recorded on this day are
                kept.
              </p>
            </>
          )}
          {noteError && <p className="form-error" role="alert">{noteError}</p>}
        </div>
      )}

      {rows.length === 0 ? (
        <p>{emptyMessage ?? 'Nothing was recorded on this day.'}</p>
      ) : (
        <dl className="day-answers">
          {rows.map((row) => (
            <div
              key={row.key}
              className={`day-answer-row ${row.isFollowUp ? 'follow-up' : ''}`.trim()}
            >
              <dt className="day-answer-label">
                {/* Through PetText, not printed raw. Question labels and level
                    wording carry {name}/{their} tokens — "Where Is {name}
                    Sore?" is what is stored, and it is not what anyone should
                    ever read. */}
                <PetText template={row.label} pet={pet} />
                {/* A dot rather than a word. The answer beside it already
                    says what happened; this only says whether the app
                    flagged it, and a second sentence per row would bury the
                    answers themselves. */}
                {severityDotFor(row)}
              </dt>
              <dd className="day-answer-value">
                <PetText template={row.answer} pet={pet} />
                {row.detail && (
                  <span className="day-answer-detail">
                    <PetText template={row.detail} pet={pet} />
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  )
}

function severityDotFor(row) {
  // The assessment rows carry a plain `emergency` flag; the condition rows
  // carry a severity. Both end up as the same dot, in the same colours the
  // calendar uses, so a red dot here means what a red day means there.
  const colour = row.emergency
    ? SEVERITY_COLOURS.emergency
    : row.severity && row.severity !== 'ok'
      ? SEVERITY_COLOURS[row.severity]
      : null

  if (!colour) return null
  return <span className="day-answer-flag" style={{ background: colour }} aria-hidden="true" />
}

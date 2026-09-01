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
  // Split into the two groups.
  //
  // A follow-up travels with its parent: it is the detail OF that answer, and
  // lifting "Not putting the leg down at all" into Worth a look while leaving
  // "which leg?" behind in the list below orphans the detail from the thing
  // it details. Follow-ups carry severity: null, so they can never lift on
  // their own account.
  //
  // Collection order is preserved inside each group. That order is the order
  // the questions were asked, and re-sorting the remainder would make the day
  // harder to check against the form that produced it.
  // Blocks, not rows: a parent and its follow-ups move as one unit. Sorting
  // loose rows would put every parent above every follow-up and detach the
  // detail from what it details.
  const blocks = []
  for (const row of rows) {
    if (row.isFollowUp && blocks.length > 0) blocks[blocks.length - 1].push(row)
    else blocks.push([row])
  }

  // Emergency before concern within the group. Array.prototype.sort is stable
  // in every engine this runs on, so blocks of equal weight keep collection
  // order.
  const concerning = blocks
    .filter((block) => isConcerning(block[0]))
    .sort((a, b) => concernWeight(b[0]) - concernWeight(a[0]))
    .flat()
  const rest = blocks.filter((block) => !isConcerning(block[0])).flat()

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
        <>
          {/* Concerning answers first, and only when there are any — an empty
              "Worth a look" on a good day is a heading that says nothing.
              Emergency above concern within the group, because if both are
              present the order is the order someone should read them in.
              Assessment rows do not reach this yet. Only the eight BEAAAAPP
              categories carry a flag; the function questions (vomiting,
              drinking, urination and the rest) have no threshold defined, and
              a single 0-10 cutoff across all of them would flag the wrong
              ones — three vomits and mildly increased drinking are not
              equivalently worrying at the same number. PENDING ASH: a
              threshold per question. Until then those rows fall through to
              the list below, exactly as they do today. */}
          {concerning.length > 0 && (
            <>
              <p className="day-answers-group">Worth a look</p>
              <dl className="day-answers">
                {concerning.map((row) => (
                  <DayAnswerRow key={row.key} row={row} pet={pet} />
                ))}
              </dl>
            </>
          )}

          {rest.length > 0 && (
            <>
              {/* Only labelled when there is something above it to be "the
                  rest" of. On a clean day this list is the whole content and
                  needs no heading. */}
              {concerning.length > 0 && (
                <p className="day-answers-group">Everything else</p>
              )}
              <dl className="day-answers">
                {rest.map((row) => (
                  <DayAnswerRow key={row.key} row={row} pet={pet} />
                ))}
              </dl>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

// The answer reads as the heading and the question as its context, which is
// the inversion this whole change is about: someone tapping a day wants to
// know what happened, not to re-read the form.
//
// Still a dt/dd pair — the question genuinely IS the term for the answer, and
// a screen reader should keep that relationship. Only the visual order is
// swapped, by ordering the dd above the dt in the flex column.
// One notion of "flagged", from two different row shapes. Condition rows
// carry a three-band `severity`; assessment rows carry a boolean `emergency`
// and only on the eight BEAAAAPP categories. severityDotFor already
// normalised these for the dot — this is the same rule, named, so the
// grouping and the dot cannot disagree about what is flagged.
function isConcerning(row) {
  return Boolean(row.emergency) || (Boolean(row.severity) && row.severity !== 'ok')
}

function concernWeight(row) {
  if (row.isFollowUp) return 0
  if (row.emergency || row.severity === 'emergency') return 2
  if (row.severity === 'concern') return 1
  return 0
}

function DayAnswerRow({ row, pet }) {
  return (
    <div className={`day-answer-row ${row.isFollowUp ? 'follow-up' : ''}`.trim()}>
      <dd className="day-answer-value">
        {/* The dot sits with the ANSWER now. It describes what was recorded,
            not the question that was asked, and the answer is what it should
            be read against. */}
        {severityDotFor(row)}
        <PetText template={row.answer} pet={pet} />
        {row.detail && (
          <span className="day-answer-detail">
            <PetText template={row.detail} pet={pet} />
          </span>
        )}
      </dd>
      <dt className="day-answer-label">
        {/* Through PetText, not printed raw. Question labels and level
            wording carry {name}/{their} tokens — "Where Is {name} Sore?" is
            what is stored, and it is not what anyone should ever read. */}
        <PetText template={row.label} pet={pet} />
      </dt>
    </div>
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

// The sentences that appear beside more than one question.
//
// A leaf module on purpose: conditions.js, giModules.js, cancerModules.js and
// assessmentOptions.js all need these, and every other arrangement makes two
// of those import each other. Nothing is imported here, so nothing can cycle.
//
// Written out separately in each file until 24 Sep 2026 — four copies of the
// vomit-blood line across three files, three of "seek veterinary attention".
// They were identical, which is the problem: the next time one is reworded,
// the copies stay as they were and the app says two things about the same
// finding.
//
// EVERY string here is APPROVED — Dr Ash Cullen (BSc, DVM). They are her
// words, moved rather than rewritten: the vomit-blood and "worth telling your
// vet" lines 3 Sep 2026, "seek veterinary attention" with the BEAAAAPP
// emergency bands.

// An emergency: today, not at the next appointment.
export const SEEK_VET_ASAP = 'Seek veterinary attention as soon as possible.'

// Blood in vomit, wherever it is asked about — the overall assessment, the
// gastrointestinal module and the shared vomiting parameter.
export const BLOOD_IN_VOMIT_ALERT = 'Blood in the vomit needs veterinary attention as soon as possible.'

// A concern rather than an emergency: it belongs in the conversation, and
// sooner if it is changing.
export const TELL_YOUR_VET = 'Worth telling your vet about, particularly if this is new or getting worse.'

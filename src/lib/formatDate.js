// One date format, in one place.
//
// This function existed six times over — in five screens and a component —
// byte for byte identical each time, which is five copies that can drift and
// three screens that never got one and printed a raw ISO date at the owner
// instead ("2026-08-25" under "Last logged").
//
// DD/MM/YY on Ash's instruction, 4 Sep 2026, replacing DD/MM/YYYY. Day before
// month because the app is written for Australian and British owners, and
// because it is what they will have written on the calendar in the kitchen;
// the two-digit year because every date this app shows is recent by
// construction — an assessment, a dose, a weight — and the century was never
// carrying information.
//
// APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026.
//
// Stored dates stay ISO — that is what sorts correctly and what the database
// holds; this is only for reading.
export function formatDateDDMMYY(dateStr) {
  const parts = isoParts(dateStr)
  return parts ? `${parts.day}/${parts.month}/${parts.year.slice(-2)}` : dateStr
}

// Day and month alone, for a chart's x-axis.
//
// Fourteen ticks across a phone screen cannot each carry a year, and they do
// not need to: the axis is a run of consecutive days, and the tooltip gives
// the full date for any point the reader stops on.
export function formatDateDDMM(dateStr) {
  const parts = isoParts(dateStr)
  return parts ? `${parts.day}/${parts.month}` : dateStr
}

// Anything that is not a stored date comes back untouched.
//
// The split-on-hyphen version these two used to share turned "not-a-date"
// into "date/a/not" — three parts, all truthy, printed as though it were a
// date. Every caller passes an ISO string from the database, so it never
// happened; it became worth guarding on 4 Sep 2026, when a chart's x-axis
// started running its tick values through here and recharts hands a tick
// whatever the series put in `date`.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// Exported so a caller that has to BRANCH on validity — return null, skip a
// line — asks the same question this file answers, rather than running its
// own hyphen-split beside it. Two callers did exactly that until 4 Sep 2026,
// and their looser test passed "2026-9-3" (unpadded) through to a formatter
// that then handed the raw ISO string back. No caller can produce an
// unpadded date today; one rule means none ever can.
export function isIsoDate(dateStr) {
  return isoParts(dateStr) != null
}

function isoParts(dateStr) {
  if (typeof dateStr !== 'string') return null
  const match = ISO_DATE.exec(dateStr)
  return match ? { year: match[1], month: match[2], day: match[3] } : null
}

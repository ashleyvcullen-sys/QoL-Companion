// One date format, in one place.
//
// This function existed six times over — in five screens and a component —
// byte for byte identical each time, which is five copies that can drift and
// three screens that never got one and printed a raw ISO date at the owner
// instead ("2026-08-25" under "Last logged").
//
// DD/MM/YYYY because the app is written for Australian and British owners,
// and because it is what they will have written on the calendar in the
// kitchen. Stored dates stay ISO — that is what sorts correctly and what the
// database holds; this is only for reading.
export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return dateStr
  const [year, month, day] = String(dateStr).split('-')
  return year && month && day ? `${day}/${month}/${year}` : dateStr
}

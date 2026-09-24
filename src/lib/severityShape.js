// A second cue beside colour, for the places where colour is the ONLY thing
// saying how a day went — the fortnight strip on the home card, the month
// calendar and the all-time calendar.
//
// Ash's instruction 24 Sep 2026. Roughly one man in twelve has a red-green
// deficiency, and to him the green, amber and red days on those grids are
// three shades of the same brown. Everywhere else in the app the severity
// also has words next to it; these three are just squares.
//
// The shape is added in CSS (a diagonal hatch for a concern, a cross-hatch
// for an emergency, nothing for a good day). This decides which class a cell
// gets. The AllTimeCalendar already names its own cells by severity, so it
// needs nothing from here.
//
// Read back from the colour rather than passed down: the calendar
// descriptors are built in two different places, one from a scored result
// and one from a summarised entry, and the colour is the one thing they
// already agree on.
const BY_COLOUR = {
  '#3D8259': 'ok',
  '#C97A2E': 'concern',
  '#A33A2E': 'emergency',
}

export function severityToneFromColour(colour) {
  if (!colour) return null
  return BY_COLOUR[String(colour).toUpperCase()] ?? null
}

// '' when there is no tone to add, so it can be dropped straight into a
// template string of class names.
export function severityToneClass(colour) {
  const tone = severityToneFromColour(colour)
  return tone ? `sev-${tone}` : ''
}

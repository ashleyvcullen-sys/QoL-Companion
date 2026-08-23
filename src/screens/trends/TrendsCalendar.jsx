import MonthCalendar from '../../components/MonthCalendar'
import { computeGeneralQolResult } from '../../lib/scoring'

export default function TrendsCalendar({ generalEntries, painEntries = [] }) {
  // BEAAAAPP now feeds the overall score too, so each day's general entry
  // is paired with that same day's pain entry (if one exists).
  const beapByDate = new Map(painEntries.map((entry) => [entry.date, entry.beap]))
  // Stores each day's colour straight from the result rather than deriving
  // it from the percentage again — otherwise a day floored to Severe by a
  // single emergency finding would still be painted green by its (high)
  // average.
  const resultByDate = new Map(
    generalEntries.map((entry) => [
      entry.date,
      computeGeneralQolResult(entry, beapByDate.get(entry.date)),
    ])
  )

  return (
    <MonthCalendar
      dayFor={(dateKey) => {
        const result = resultByDate.get(dateKey)
        if (!result) return null
        // Colour comes straight off the result rather than being re-derived
        // from the percentage — a day floored to Severe by one emergency
        // finding would otherwise still be painted green by its high average.
        return { colour: result.color, title: `${result.percent}%` }
      }}
    />
  )
}

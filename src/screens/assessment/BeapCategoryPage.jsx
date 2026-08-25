import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import { BEAP_SCALES } from '../../lib/beapScales'
import { snapToOption } from '../../lib/conditions'

const BEAP_SCORES = [0, 2, 4, 6, 8, 10]

export default function BeapCategoryPage({ species, categoryKey, value, note, onChange }) {
  const effectiveSpecies = BEAP_SCALES[species] ? species : 'dog'
  const category = BEAP_SCALES[effectiveSpecies].find((c) => c.key === categoryKey)

  return (
    <div className="assessment-page">
      <SectionTitle>{category.label}</SectionTitle>
      {/* Where this answer came from, when it came from a condition form.
          Same class as every other explanatory line in the assessment. */}
      {note && <p className="assessment-hint">{note}</p>}
      <SeverityOptionList
        levels={category.levels}
        // A value from the database can arrive as a string, and the Feline
        // Grimace Scale sums to odd numbers. Both would compare false against
        // the option scores and render an answered category as blank.
        value={snapToOption(value, BEAP_SCORES)}
        onChange={onChange}
        species={effectiveSpecies}
        categoryKey={categoryKey}
      />
    </div>
  )
}

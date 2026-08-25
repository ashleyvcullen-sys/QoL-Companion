import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import { BEAP_SCALES } from '../../lib/beapScales'

export default function BeapCategoryPage({ species, categoryKey, value, note, onChange }) {
  const effectiveSpecies = BEAP_SCALES[species] ? species : 'dog'
  const category = BEAP_SCALES[effectiveSpecies].find((c) => c.key === categoryKey)

  return (
    <div className="assessment-page">
      <SectionTitle>{category.label}</SectionTitle>
      <p className="beap-citation">BEAAAAPP Pain Scale concept by Dr. Shea Cox.</p>
      {/* Where this answer came from, when it came from a condition form.
          Same class as every other explanatory line in the assessment. */}
      {note && <p className="assessment-hint">{note}</p>}
      <SeverityOptionList
        levels={category.levels}
        value={value}
        onChange={onChange}
        species={effectiveSpecies}
        categoryKey={categoryKey}
      />
    </div>
  )
}

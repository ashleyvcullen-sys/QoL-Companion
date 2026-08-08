import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import { BEAP_SCALES } from '../../lib/beapScales'

export default function BeapCategoryPage({ species, categoryKey, value, onChange }) {
  const effectiveSpecies = BEAP_SCALES[species] ? species : 'dog'
  const category = BEAP_SCALES[effectiveSpecies].find((c) => c.key === categoryKey)

  return (
    <div className="assessment-page">
      <SectionTitle>{category.label}</SectionTitle>
      <p className="beap-citation">BEAAAAPP Pain Scale concept by Dr. Shea Cox.</p>
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

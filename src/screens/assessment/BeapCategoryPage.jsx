import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import { BEAP_SCALES } from '../../lib/beapScales'

export default function BeapCategoryPage({ species, categoryKey, value, onChange }) {
  const effectiveSpecies = BEAP_SCALES[species] ? species : 'dog'
  const category = BEAP_SCALES[effectiveSpecies].find((c) => c.key === categoryKey)

  const citation = "BEAAAAPP Pain Scale concept by Dr. Shea Cox." +
    (effectiveSpecies === 'cat' && categoryKey === 'eyes'
      ? ' The eyes/face scoring here draws on the Feline Grimace Scale (Evangelista et al., "Facial expressions of pain in cats: the development and validation of a Feline Grimace Scale," Scientific Reports, 2019).'
      : '')

  return (
    <div className="assessment-page">
      <SectionTitle>{category.label}</SectionTitle>
      <p className="beap-citation">{citation}</p>
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

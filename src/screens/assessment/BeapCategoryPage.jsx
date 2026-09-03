import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import SeverityOptionList from '../../components/SeverityOptionList'
import { BEAP_SCALES } from '../../lib/beapScales'
import { SEEK_VET_ASAP, snapToOption } from '../../lib/conditions'

const BEAP_SCORES = [0, 2, 4, 6, 8, 10]

export default function BeapCategoryPage({ species, categoryKey, value, note, onChange }) {
  const effectiveSpecies = BEAP_SCALES[species] ? species : 'dog'
  const category = BEAP_SCALES[effectiveSpecies].find((c) => c.key === categoryKey)
  const score = snapToOption(value, BEAP_SCORES)
  // The same answer, asked in a condition form, has always shown a message
  // under it as well as the hazard mark — see Verdict in ConditionParameter.
  // Here it showed the mark alone, so Appetite at 10 told a kidney owner to
  // seek help and told the same owner nothing at all when the assessment
  // asked them the identical question. Ash's instruction 3 Sep 2026 to make
  // the two consistent.
  //
  // SEEK_VET_ASAP because it is the sentence she approved for exactly this,
  // and because BEAAAAPP carries no per-category message to use instead.
  const isEmergency = category.emergencyFrom != null
    && score != null
    && score >= category.emergencyFrom

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
        value={score}
        onChange={onChange}
        species={effectiveSpecies}
        categoryKey={categoryKey}
        // The same field scoring and the summaries read, so the alert an
        // owner sees on the form and the one their vet reads in the export
        // can never disagree about which rungs are emergencies.
        emergencyFrom={category.emergencyFrom}
      />

      {isEmergency && (
        <p className="condition-emergency" role="alert">
          <AlertTriangle size={17} />
          <span>{SEEK_VET_ASAP}</span>
        </p>
      )}
    </div>
  )
}

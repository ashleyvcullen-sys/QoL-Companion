import { AlertTriangle } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import { usePets } from '../lib/PetsContext'

const GENERAL_EMERGENCIES = [
  'Collapse, or unable to stand or walk',
  'Difficulty breathing, pale, white or blue/grey gums',
  'Uncontrolled bleeding',
  'Known or suspected toxin or foreign material ingestion',
  'A swollen, distended abdomen with unproductive retching',
  'A seizure lasting more than a few minutes, or repeated seizures close together',
  'Straining to urinate with little or no output (especially in male cats)',
  'Major trauma (hit by a car, a fall, a serious fight)',
  'Heavy panting, collapse, or bright red gums in the heat',
  'Sudden, severe pain or crying out',
  'A sudden eye injury or sudden blindness',
  'Repeated vomiting or an inability to keep any food/water down',
]

const CAT_ONLY_EMERGENCY = 'Panting / open mouth breathing in cats'

export default function Emergencies() {
  const { pets } = usePets()
  const species = pets[0]?.species

  const emergencies = species === 'cat'
    ? [...GENERAL_EMERGENCIES, CAT_ONLY_EMERGENCY]
    : GENERAL_EMERGENCIES

  return (
    <div className="screen">
      <HomeLink />

      <div className="warning-banner">
        <AlertTriangle size={20} />
        <p>
          If any of these apply, contact your vet or nearest emergency vet immediately —
          don't wait for a routine appointment, and don't wait to see if it passes.
        </p>
      </div>

      <Card>
        <SectionTitle>Emergency signs</SectionTitle>
        <ul className="emergency-list">
          {emergencies.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <p className="assessment-hint">
        This list can't cover everything — if something feels seriously wrong and isn't
        listed here, trust that instinct and call your vet anyway.
      </p>
    </div>
  )
}

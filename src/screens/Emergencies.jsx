import { AlertTriangle } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'

const EMERGENCIES = [
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
  'Open-mouth breathing in cats',
]

export default function Emergencies() {
  return (
    <div className="screen">
      <HomeLink />

      <Card>
        {/* The line that used to sit here is now the sentence the More
            screen shows before opening this one — Ash's instruction 24 Sep
            2026. Said once, where the choice is made. */}
        <SectionTitle>Emergencies — See Your Vet ASAP</SectionTitle>
      </Card>

      <div className="warning-banner">
        <AlertTriangle size={20} />
        <p>
          If any of these apply, contact your vet or nearest emergency vet immediately —
          don't wait for a routine appointment, and don't wait to see if it passes.
        </p>
      </div>

      <Card>
        <SectionTitle>Emergency Signs</SectionTitle>
        <ul className="emergency-list">
          {EMERGENCIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <p className="assessment-hint">
        This list can't cover everything. If something feels seriously wrong, call your vet
        anyway.
      </p>

    </div>
  )
}

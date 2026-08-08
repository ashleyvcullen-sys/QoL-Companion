import { AlertTriangle } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'

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
        <SectionTitle>Emergencies — See Your Vet ASAP</SectionTitle>
        <p className="home-subtitle">
          Signs that mean 'go now', not 'monitor and see'.
        </p>
      </Card>

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
          {EMERGENCIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <p className="assessment-hint">
        This list can't cover everything — if something feels seriously wrong and isn't
        listed here, trust that instinct and call your vet anyway.
      </p>

      <Footer />
    </div>
  )
}

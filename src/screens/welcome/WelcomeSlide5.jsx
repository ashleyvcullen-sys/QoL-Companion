import { AlertTriangle } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'

export default function WelcomeSlide5() {
  return (
    <div className="assessment-page welcome-slide welcome-slide--centered">
      <span className="welcome-alert-badge" aria-hidden="true">
        <AlertTriangle size={24} color="#fff" />
      </span>
      <SectionTitle>One important note</SectionTitle>
      <p>
        <strong>This app does not replace a veterinary exam or professional veterinary advice.</strong>{' '}
        Always contact your vet for advice, diagnosis, treatment, and anything urgent. This app
        supports that relationship, and is not a substitute for it.
      </p>
    </div>
  )
}

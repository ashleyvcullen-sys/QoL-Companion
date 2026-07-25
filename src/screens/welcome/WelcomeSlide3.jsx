import { TrendingUp } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'

export default function WelcomeSlide3() {
  return (
    <div className="assessment-page welcome-slide">
      <TrendingUp size={30} color="#C97B8C" className="welcome-slide-icon" />
      <SectionTitle>Why it's worth tracking</SectionTitle>
      <p>
        It's often hard to notice subtle changes when you see your pet every day. Keeping
        an active record of it means you're not left guessing at the vet, trying to
        remember whether things have really changed. This is extremely helpful for your
        vet, and most importantly, for maintaining and monitoring your pet's wellbeing.
      </p>
    </div>
  )
}

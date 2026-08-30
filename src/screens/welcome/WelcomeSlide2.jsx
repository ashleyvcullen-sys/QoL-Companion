import { Heart } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import WellbeingConcepts from '../../components/WellbeingConcepts'

export default function WelcomeSlide2() {
  return (
    <div className="assessment-page welcome-slide">
      <Heart size={30} color="#C97B8C" className="welcome-slide-icon" />
      <SectionTitle>What Is Quality of Life?</SectionTitle>
      <p>
        It's everything that makes up a good day: comfortable movement, a good appetite,
        restful sleep, curiosity, and the small joys. Every animal deserves a good quality
        of life, regardless of age or existing health conditions — as pet owners, it's our
        responsibility to help ensure they have it.
      </p>
      <WellbeingConcepts />
    </div>
  )
}

import { Heart } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import WellbeingConcepts from '../../components/WellbeingConcepts'

export default function WelcomeSlide2() {
  return (
    <div className="assessment-page welcome-slide">
      <Heart size={30} color="#C97B8C" className="welcome-slide-icon" />
      <SectionTitle>What Is Quality of Life?</SectionTitle>
      <p>
        {/* The five items map to the five wellbeing pillars in order —
            Comfort, Appetite, Sleep, Curiosity, Connection — and the last one
            said "the small joys", which named none of them.
            Not "the connection": the article wants an object ("connection
            with whom?"), and the bare noun is what the list already does one
            item earlier with "curiosity". */}
        It's everything that makes up a good day: comfortable movement, a good appetite,
        restful sleep, curiosity, and connection. Every animal deserves a good quality
        of life, regardless of age or existing health conditions — as pet owners, it's our
        responsibility to help ensure they have it.
      </p>
      <WellbeingConcepts />
    </div>
  )
}

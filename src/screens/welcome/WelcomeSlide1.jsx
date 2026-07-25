import SectionTitle from '../../components/SectionTitle'

export default function WelcomeSlide1({ petName }) {
  return (
    <div className="assessment-page welcome-slide welcome-slide--centered">
      <img
        src="/images/logo.png"
        alt="Dog and cat, nose to nose, forming a heart"
        className="welcome-illustration"
      />
      <SectionTitle>Welcome To Quality Of Life Companion</SectionTitle>
      <p>
        A gentle way to notice, track, and talk about how your pet is really doing — day
        by day, not just at the next check-up.
      </p>
      <div className="welcome-callout">
        <p>
          Downloading an app like this isn't always an easy step to take — it can mean
          sitting with some hard feelings about {petName}'s health. That takes courage,
          and it says a lot about how deeply you care for {petName}. We're glad you're
          here.
        </p>
      </div>
      <p className="welcome-footnote">
        Developed by a veterinarian to help pet owners, vets and pets every step of the way.
      </p>
    </div>
  )
}

import SectionTitle from '../../components/SectionTitle'

export default function WelcomeSlide1({ petName }) {
  return (
    <div className="assessment-page welcome-slide">
      <img
        src="/images/logo.png"
        alt="Dog and cat, nose to nose, forming a heart"
        className="welcome-illustration"
      />
      <SectionTitle>Welcome To Quality of Life Companion</SectionTitle>
      <p className="welcome-footnote">
        Developed by a veterinarian to help pet owners, vets and pets every step of the way.
      </p>
      <p>
        A gentle way to notice, track, and talk about how your pet is really doing — day
        by day, not just at the next check-up.
      </p>
      <div className="welcome-callout">
        <p>
          Paying close attention to {petName}'s wellbeing — at any age or stage of life —
          is one of the most caring things you can do for them. Whether you're getting to
          know a new pet, keeping an eye on changes as they get older, or navigating
          something harder, we're glad you're here.
        </p>
      </div>
    </div>
  )
}

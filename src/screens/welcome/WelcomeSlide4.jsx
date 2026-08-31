import { PawPrint } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import { APP_FEATURE_LIST } from '../../lib/appFeatures'

export default function WelcomeSlide4() {
  return (
    <div className="assessment-page welcome-slide">
      <PawPrint size={30} color="#C97B8C" className="welcome-slide-icon" />
      <SectionTitle>What this app helps you do</SectionTitle>
      <div className="welcome-help-list">
        {/* The same list About shows, from lib/appFeatures.js. This slide
            used to hold its own copy of five of these and was missing disease
            monitoring and medications entirely, so somebody signing up saw a
            smaller app than the one they were joining.
            Paid rows are marked here rather than hidden. Someone deciding
            whether to create an account should see everything the app does
            AND which parts they would be paying for — finding out later is
            how a free user ends up feeling misled. Same tag the tour uses. */}
        {APP_FEATURE_LIST.map(({ Icon, label, premium }) => (
          <div key={label} className="welcome-help-row">
            <span className="icon-badge">
              <Icon size={20} color="#fff" />
            </span>
            <span>
              {label}
              {premium && <span className="premium-tag welcome-help-premium">Premium</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

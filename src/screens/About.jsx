import { Link } from 'react-router-dom'
import Card from '../components/Card'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import WelcomeSlide1 from './welcome/WelcomeSlide1'
import WelcomeSlide2 from './welcome/WelcomeSlide2'
import WelcomeSlide5 from './welcome/WelcomeSlide5'
import { usePets } from '../lib/PetsContext'
import { APP_FEATURE_LIST } from '../lib/appFeatures'

export default function About() {
  const { selectedPet } = usePets()
  const pet = selectedPet

  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <WelcomeSlide1 petName={pet?.name} />
      </Card>

      <Card>
        <WelcomeSlide2 />
      </Card>

      <Card>
        <div className="welcome-help-list">
          {APP_FEATURE_LIST.map(({ Icon, label, to }) => (
            <Link key={to} to={to} className="icon-tile-link">
              <div className="welcome-help-row">
                <span className="icon-badge">
                  <Icon size={20} color="#fff" />
                </span>
                <span>{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <WelcomeSlide5 />
      </Card>

      <div className="legal-links">
        <Link to="/terms" className="legal-link">Terms &amp; Conditions</Link>
        <Link to="/privacy" className="legal-link">Privacy Policy</Link>
      </div>

      <Footer />
    </div>
  )
}

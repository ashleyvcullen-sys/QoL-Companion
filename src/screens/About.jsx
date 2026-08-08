import { Link } from 'react-router-dom'
import { Heart, TrendingUp, FileDown, HeartHandshake } from 'lucide-react'
import Card from '../components/Card'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'
import WelcomeSlide1 from './welcome/WelcomeSlide1'
import WelcomeSlide2 from './welcome/WelcomeSlide2'
import WelcomeSlide5 from './welcome/WelcomeSlide5'
import { usePets } from '../lib/PetsContext'

const FEATURE_ITEMS = [
  { Icon: Heart, label: 'Quality Of Life Assessments', to: '/assessment' },
  { Icon: TrendingUp, label: 'Trends Over Time', to: '/trends' },
  { Icon: HomeCareTipsIcon, label: 'Advice For Home Care', to: '/home-care-tips' },
  { Icon: FileDown, label: 'Summaries For Your Vet', to: '/export-report' },
  { Icon: HeartHandshake, label: 'Support And Preparation For End Of Life Decisions', to: '/end-of-life' },
]

export default function About() {
  const { pets } = usePets()
  const pet = pets[0]

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
          {FEATURE_ITEMS.map(({ Icon, label, to }) => (
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

      <Link to="/terms" className="subtle-link">Terms &amp; Conditions</Link>
      <Link to="/privacy" className="subtle-link">Privacy Policy</Link>

      <Footer />
    </div>
  )
}

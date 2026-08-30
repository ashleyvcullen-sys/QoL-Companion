import { Link } from 'react-router-dom'
import { Heart, Stethoscope, Pill, TrendingUp, FileDown, HeartHandshake } from 'lucide-react'
import Card from '../components/Card'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'
import WelcomeSlide1 from './welcome/WelcomeSlide1'
import WelcomeSlide2 from './welcome/WelcomeSlide2'
import WelcomeSlide5 from './welcome/WelcomeSlide5'
import { usePets } from '../lib/PetsContext'

// Ordered as the app is used rather than as it was built: the three things
// you record, then the two that read what you recorded, then end of life.
//
// The icons are the SAME ones Home uses for the same destinations — Pill for
// medications, Stethoscope for conditions. A feature wearing one icon on the
// home screen and a different one on the page that introduces it is a small
// thing that quietly makes an app feel unfinished.
const FEATURE_ITEMS = [
  { Icon: Heart, label: 'Overall Quality of Life Assessments', to: '/assessment' },
  { Icon: Stethoscope, label: 'Disease-Specific Monitoring', to: '/conditions' },
  { Icon: Pill, label: 'Medication Reminders', to: '/medications' },
  { Icon: TrendingUp, label: 'Trends Over Time', to: '/trends' },
  { Icon: HomeCareTipsIcon, label: 'Advice For Home Care', to: '/home-care-tips' },
  { Icon: FileDown, label: 'Summaries For Your Vet', to: '/export-report' },
  { Icon: HeartHandshake, label: 'Support And Preparation For End of Life Decisions', to: '/end-of-life' },
]

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

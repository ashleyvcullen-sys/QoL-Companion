import { Heart, TrendingUp, FileDown, HeartHandshake, PawPrint } from 'lucide-react'
import SectionTitle from '../../components/SectionTitle'
import HomeCareTipsIcon from '../../components/icons/HomeCareTipsIcon'

const HELP_ITEMS = [
  { Icon: Heart, label: 'Overall Quality of Life Assessments' },
  { Icon: TrendingUp, label: 'Trends Over Time' },
  { Icon: HomeCareTipsIcon, label: 'Advice For Home Care' },
  { Icon: FileDown, label: 'Summaries For Your Vet' },
  { Icon: HeartHandshake, label: 'Support And Preparation For End of Life Decisions' },
]

export default function WelcomeSlide4() {
  return (
    <div className="assessment-page welcome-slide">
      <PawPrint size={30} color="#C97B8C" className="welcome-slide-icon" />
      <SectionTitle>What this app helps you do</SectionTitle>
      <div className="welcome-help-list">
        {HELP_ITEMS.map(({ Icon, label }) => (
          <div key={label} className="welcome-help-row">
            <span className="icon-badge">
              <Icon size={20} color="#fff" />
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

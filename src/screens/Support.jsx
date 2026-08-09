import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'

const SUPPORT_EMAIL = 'info@qolcompanion.com.au'

export default function Support() {
  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Support</SectionTitle>
        <p>Need help with QoL Companion, or have feedback? We'd love to hear from you.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-primary btn-block">
          {SUPPORT_EMAIL}
        </a>
      </Card>

      <Link to="/legal" className="subtle-link">Back to Legal &amp; Privacy</Link>

      <Footer />
    </div>
  )
}

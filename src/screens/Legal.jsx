import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { allReferencesText } from '../lib/references'

const SECTIONS = [
  {
    heading: 'Privacy & data collection',
    paragraphs: [
      "This app stores the information you enter directly — your pet's name, species, age, weight, sex, and the assessments, notes, and schedule items you log. That data is used only to show you your own pet's information: to display history, calculate trends, and generate the summaries and reports you ask for.",
      "Data isn't sold, and isn't shared with third parties for advertising or marketing.",
    ],
  },
  {
    heading: 'Data deletion',
    paragraphs: [
      "You can remove a pet's data at any time from the Home screen, which deletes that pet's stored record. If you'd like all data associated with your account deleted, contact whoever provided you this app to request full deletion.",
    ],
  },
  {
    heading: 'Terms of use',
    paragraphs: [
      "This app is provided as an informational and organisational tool for pet owners, \"as is,\" without warranty of any kind. You're responsible for verifying anything important with a qualified veterinarian before acting on it.",
      "By using this app you agree not to rely on it as a substitute for professional veterinary diagnosis, treatment, or emergency care.",
    ],
  },
  {
    heading: 'AI disclaimer',
    paragraphs: [
      "This app does not use artificial intelligence to diagnose, score, or make medical decisions about your pet — all scoring is done with fixed, transparent rules you can review in the assessment itself. Some illustrations and reference imagery in this app were AI-assisted in their creation.",
    ],
  },
  {
    heading: 'Copyright & attribution',
    // Built from lib/references.js rather than written out here. This is the
    // one copy of the list that has to be COMPLETE, and a hand-written
    // paragraph is complete only until the next instrument is added and
    // nobody remembers to come back. Adding a reference to that file now puts
    // it here automatically.
    //
    // One paragraph each, rather than the single run-on paragraph this was:
    // an attribution nobody can pick apart is not much of an attribution.
    paragraphs: [
      ...allReferencesText(),
      "All other text, design, and code in this app are original to this app unless otherwise credited.",
    ],
  },
  {
    heading: 'App store privacy declarations',
    paragraphs: [
      "This app does not collect data used to track you across other companies' apps or websites, and does not use your data for third-party advertising.",
    ],
  },
]

export default function Legal() {
  return (
    <div className="screen">
      <HomeLink />

      <Card>
        <SectionTitle>Legal &amp; Privacy</SectionTitle>
        <p>
          A plain-language summary of how this app handles your data, what it can and
          can't do, and where its content comes from.
        </p>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.heading}>
          <SectionTitle>{section.heading}</SectionTitle>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </Card>
      ))}

      <Link to="/about" className="subtle-link">Back to About</Link>
      <Link to="/terms" className="subtle-link">Terms &amp; Conditions</Link>
      <Link to="/privacy" className="subtle-link">Privacy Policy</Link>

      <Footer />
    </div>
  )
}

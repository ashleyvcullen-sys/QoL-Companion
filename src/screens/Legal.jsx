import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'

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
    paragraphs: [
      "The BEAAAAPP pain-scale concept referenced in this app is adapted from work by Dr. Shea Cox. The cat eyes/face scoring draws on the Feline Grimace Scale (Evangelista MC, Watanabe R, Leung VSY, Monteiro BP, O'Toole E, Pang DSJ, Steagall PV. \"Facial expressions of pain in cats: the development and validation of a Feline Grimace Scale.\" Scientific Reports, 2019;9:19128). The \"How children grieve\" guidance is adapted from material by Kristi Lehman, MSW, LISW, DVM Center. Life-stage / human-year equivalents reference published AAHA and AAFP guidelines.",
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
    </div>
  )
}

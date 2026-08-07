import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'

const SECTIONS = [
  {
    heading: '1. Who We Are',
    content: [
      'This Privacy Policy explains how QoL Companion ("we," "us," "our"), operated by Dr Ash Cullen, a sole trader trading under ABN 68 923 567 002, collects, uses, stores, and protects information when you use the QoL Companion mobile application (the "App").',
    ],
  },
  {
    heading: '2. Information We Collect',
    content: [
      'Information you provide directly:',
      { list: [
        'Your email address (used for account sign-in via a passwordless magic link)',
        "Your pet's name, species, age, weight range, and sex",
        'Quality of life assessment responses, including symptom notes, pain scores, and any free-text notes you enter',
        'Communications you send us (e.g., via the Support page)',
      ] },
      'Information collected automatically:',
      { list: [
        'Basic technical information necessary for the App to function (e.g., session tokens for keeping you signed in)',
        'We do not use analytics or advertising tracking technologies within the App',
      ] },
      'We do not collect:',
      { list: [
        'Payment information (the App currently has no paid features)',
        'Precise location data',
        "Access to your device's camera, microphone, or contacts",
      ] },
    ],
  },
  {
    heading: '3. How We Use Your Information',
    content: [
      'We use the information described above only to:',
      { list: [
        "Provide the App's core functionality — displaying your pet's assessment history, calculating trends, and generating the reports and summaries you request",
        'Authenticate you and keep your account secure',
        'Respond to support requests you send us',
        'Comply with legal obligations, if any arise',
      ] },
      'We do not sell your information, and we do not use it for advertising or marketing purposes.',
    ],
  },
  {
    heading: '4. Who We Share Information With',
    content: [
      'We use the following third-party service providers to operate the App. Each processes data solely to provide their service to us, under their own privacy and security terms:',
      { list: [
        'Supabase — Database hosting and user authentication — Account email, pet and assessment data',
        'Resend — Sending sign-in (magic link) emails — Email address',
        'Vercel — Web hosting (for the companion website) — Standard web request data',
        "Apple / Google — App distribution, and device-level services on iOS/Android — As governed by Apple's and Google's own privacy policies",
      ] },
      'We do not share your information with any other third party, and we do not permit these providers to use your information for their own purposes.',
    ],
  },
  {
    heading: '5. Data Storage and Security',
    content: [
      "Your data is stored in Supabase's cloud infrastructure and protected using database-level access controls (Row Level Security) that ensure your account can only ever access your own data — this is enforced at the database level, not just hidden in the App's interface.",
      'No method of electronic storage or transmission is 100% secure. While we take reasonable steps to protect your information, we cannot guarantee absolute security.',
    ],
  },
  {
    heading: '6. Data Retention and Deletion',
    content: [
      'Your data is retained for as long as your account remains active.',
      'You can permanently delete a pet\'s data at any time using the "Delete Pet" option on the Home screen — this immediately and permanently removes that pet\'s profile and all associated assessments, notes, and history.',
      'To delete your entire account, contact us at info@qolcompanion.com.au.',
    ],
  },
  {
    heading: "7. Children's Privacy",
    content: [
      'The App is not directed at children, and we do not knowingly collect personal information from anyone under 18. If you believe a child has provided us with personal information, please contact us and we will delete it.',
    ],
  },
  {
    heading: '8. Your Rights',
    content: [
      'Depending on your location, you may have rights to access, correct, or delete the personal information we hold about you. You can exercise most of these rights directly within the App (viewing your data, editing pet details, or using Delete Pet), or by contacting us at info@qolcompanion.com.au.',
      'If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.',
    ],
  },
  {
    heading: '9. AI Disclaimer',
    content: [
      'This App was developed with the assistance of artificial intelligence tools. The App does not use artificial intelligence to diagnose, score, or make medical decisions about your pet — all scoring is based on fixed, transparent rules you can review within the App itself. Some illustrations and reference imagery used in the App were AI-assisted in their creation.',
    ],
  },
  {
    heading: '10. App Store Privacy Declarations',
    content: [
      "In accordance with Apple App Store and Google Play requirements: this App does not collect data used to track you across other companies' apps or websites, and does not use your data for third-party advertising.",
    ],
  },
  {
    heading: '11. Changes to This Policy',
    content: [
      'We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the App or by email before the changes take effect.',
    ],
  },
  {
    heading: '12. Contact Us',
    content: [
      'Questions or concerns about this Privacy Policy, or requests relating to your personal information, can be directed to:',
      'info@qolcompanion.com.au',
    ],
  },
]

export default function Privacy() {
  return (
    <div className="screen">
      <Card>
        <SectionTitle>Privacy Policy</SectionTitle>
        <p className="assessment-hint">Last updated: August 2026</p>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.heading}>
          <SectionTitle>{section.heading}</SectionTitle>
          {section.content.map((block, i) =>
            typeof block === 'string' ? (
              <p key={i}>{block}</p>
            ) : (
              <ul key={i} className="emergency-list">
                {block.list.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )
          )}
        </Card>
      ))}

      <Link to="/legal" className="subtle-link">Back to Legal &amp; Privacy</Link>
    </div>
  )
}

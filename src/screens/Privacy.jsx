import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'

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
        "Body condition scores and any body weight you record for your pet",
        "Medications you add for your pet — name, dose, schedule, your notes, and the record of which doses you mark as given",
        "Photos and videos you choose to add to your pet's record, along with any caption and date you give them",
        'Communications you send us (e.g., via the Support page)',
      ] },
      'Information collected automatically:',
      { list: [
        'Basic technical information necessary for the App to function (e.g., session tokens for keeping you signed in)',
        'Your subscription status, if you purchase a paid plan — see section 5',
        'We do not use analytics or advertising tracking technologies within the App',
      ] },
      'We do not collect:',
      { list: [
        'Your payment card details — see section 5',
        'Precise location data',
        'Your contacts, calendar, or health data from your device',
        'Any photo, video, or file you have not explicitly chosen to add',
      ] },
    ],
  },
  {
    heading: '3. Device Permissions',
    content: [
      'The App asks for the following permissions. Each is requested only at the moment you first use the feature that needs it, and you can decline or later revoke any of them in your device settings — the rest of the App will continue to work.',
      { list: [
        'Camera — only if you choose to photograph or film your pet from within the App. We do not access the camera at any other time.',
        'Microphone — only while you are recording a video in the App, because a video carries its own sound. Audio is never recorded separately or in the background.',
        'Photo library — only to let you pick an existing photo or video to add. We can see only the items you select, not your library as a whole.',
        'Notifications — only to deliver the reminders you set up yourself, such as a medication dose or a quality of life check-in.',
      ] },
    ],
  },
  {
    heading: '4. How We Use Your Information',
    content: [
      'We use the information described above only to:',
      { list: [
        "Provide the App's core functionality — displaying your pet's assessment history, body condition and weight, medications, photos and videos, calculating trends, and generating the reports and summaries you request",
        'Send the reminders you have chosen to set up',
        'Authenticate you and keep your account secure',
        'Determine which features your subscription gives you access to',
        'Respond to support requests you send us',
        'Comply with legal obligations, if any arise',
      ] },
      'We do not sell your information, and we do not use it for advertising or marketing purposes.',
      'We do not view, analyse, or use your photos, videos, notes, or medication records for any purpose other than storing them and showing them back to you. They are not used to train artificial intelligence models.',
    ],
  },
  {
    heading: '5. Payments and Subscriptions',
    content: [
      'If you purchase a paid subscription, the payment itself is handled entirely by Apple or Google. We never see, receive, or store your card number or billing address.',
      'We do receive a record of whether your subscription is active, which plan you are on, and when it renews or expires, so the App knows which features to unlock. This is managed on our behalf by RevenueCat (see section 6).',
    ],
  },
  {
    heading: '6. Who We Share Information With',
    content: [
      'We use the following third-party service providers to operate the App. Each processes data solely to provide their service to us, under their own privacy and security terms:',
      { list: [
        'Supabase — Database hosting, file storage, and user authentication — Account email, pet and assessment data, medications, and any photos or videos you add',
        'RevenueCat — Subscription management — An anonymous identifier and your subscription status. No payment details.',
        'Resend — Sending sign-in (magic link) emails — Email address',
        'Vercel — Web hosting (for the companion website) — Standard web request data',
        "Apple / Google — App distribution, payment processing, and device-level services on iOS/Android — As governed by Apple's and Google's own privacy policies",
      ] },
      'We do not share your information with any other third party, and we do not permit these providers to use your information for their own purposes.',
    ],
  },
  {
    heading: '7. Data Storage and Security',
    content: [
      "Your data is stored in Supabase's cloud infrastructure and protected using database-level access controls (Row Level Security) that ensure your account can only ever access your own data — this is enforced at the database level, not just hidden in the App's interface.",
      'Photos and videos are held in private storage. They are not publicly addressable, and cannot be reached by a shared or guessed link. When the App needs to display one to you, it requests a temporary link that expires after one hour. The same account-level access controls apply to files as to the rest of your data.',
      'No method of electronic storage or transmission is 100% secure. While we take reasonable steps to protect your information, we cannot guarantee absolute security.',
    ],
  },
  {
    heading: '8. Data Retention and Deletion',
    content: [
      'Your data is retained for as long as your account remains active.',
      'You can delete an individual photo or video at any time from the Photos & Videos screen. Deleting it removes the file itself, not merely its listing.',
      'You can permanently delete a pet\'s data at any time using the "Remove pet" option in Settings — this immediately and permanently removes that pet\'s profile and all associated assessments, notes, history, medications, photos, and videos.',
      'You can permanently delete your entire account at any time using the "Delete Account" option in Settings. This immediately and permanently deletes your account, your pet profile(s), and all associated data including all stored files — this action cannot be undone, and does not require contacting us.',
      'Deleting the App from your device does not delete your data, because it is stored in your account rather than on the device. Use Delete Account if that is what you intend.',
    ],
  },
  {
    heading: "9. Children's Privacy",
    content: [
      'The App is not directed at children, and we do not knowingly collect personal information from anyone under 18. If you believe a child has provided us with personal information, please contact us and we will delete it.',
    ],
  },
  {
    heading: '10. Your Rights',
    content: [
      'Depending on your location, you may have rights to access, correct, or delete the personal information we hold about you. You can exercise most of these rights directly within the App (viewing your data, editing pet details, deleting individual photos, or using Delete Pet), or by contacting us at info@qolcompanion.com.au.',
      'If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.',
    ],
  },
  {
    heading: '11. AI Disclaimer',
    content: [
      'This App was developed with the assistance of artificial intelligence tools. The App does not use artificial intelligence to diagnose, score, or make medical decisions about your pet — all scoring is based on fixed, transparent rules you can review within the App itself. Some illustrations and reference imagery used in the App were AI-assisted in their creation.',
      'Your own content — photos, videos, notes, and records — is never used to train artificial intelligence models, by us or by anyone else.',
    ],
  },
  {
    heading: '12. App Store Privacy Declarations',
    content: [
      "In accordance with Apple App Store and Google Play requirements: this App does not collect data used to track you across other companies' apps or websites, and does not use your data for third-party advertising.",
    ],
  },
  {
    heading: '13. Changes to This Policy',
    content: [
      'We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the App or by email before the changes take effect.',
    ],
  },
  {
    heading: '14. Contact Us',
    content: [
      'Questions or concerns about this Privacy Policy, or requests relating to your personal information, can be directed to:',
      'info@qolcompanion.com.au',
    ],
  },
]

export default function Privacy() {
  return (
    <div className="screen legal-doc">
      <HomeLink />

      <Card>
        <SectionTitle>Privacy Policy</SectionTitle>
        <p className="assessment-hint">Last updated: 23 August 2026</p>
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

      <Footer />
    </div>
  )
}

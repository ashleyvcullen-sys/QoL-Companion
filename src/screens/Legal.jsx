import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { allReferencesText } from '../lib/references'
import {
  PRIVACY_POLICY_LABEL,
  PRIVACY_POLICY_URL,
  TERMS_LABEL,
  TERMS_URL,
} from '../lib/legalUrls'

// The full documents live on the website; see lib/legalUrls.js.
//
// Linked with a plain anchor and target="_blank" rather than the Capacitor
// Browser plugin the footer uses: Browser.open() is an
// SFSafariViewController, which is still inside this app. A legal document
// should open in the system browser, where the reader has their own address
// bar, their own history and an unambiguous way out.
const SECTIONS = [
  {
    heading: 'Privacy & data collection',
    paragraphs: [
      "This app stores what you enter — your pet's details, quality of life assessments, notes, schedule items, medications, body condition and weight records, disease-specific monitoring responses, and any photos or videos you add. It's used only to show you your own pet's information: history, trends, and the summaries and reports you ask for.",
      "If you subscribe, we store a record of your subscription status so the app knows which features to make available to you. Payments are processed by Apple — we never see your card details.",
      "Your data is stored in Australia. The only exception is the limited subscription information we share with RevenueCat, our subscription management provider, which is based in the United States.",
      "Data isn't sold, and isn't shared with third parties for advertising or marketing.",
    ],
  },
  {
    heading: 'Subscriptions',
    paragraphs: [
      "Some features require a QoL Companion Premium subscription. If your subscription ends, information you created using those features is hidden from view within the app, but is not deleted. It remains stored and is restored in full if you resubscribe.",
      "You can request a copy of any of your information at any time — including anything currently hidden — by contacting us at info@qolcompanion.com.au.",
    ],
  },
  {
    heading: 'Data deletion',
    paragraphs: [
      "You can remove a pet's data at any time from Settings, which deletes that pet's stored record.",
      "You can also delete your entire account from within the app. This permanently removes all of your information, including anything hidden because a subscription has ended. Deleting your account does not cancel an active subscription — cancel that in your Apple ID settings.",
    ],
  },
  {
    heading: 'Terms of use',
    // The "as is, without warranty of any kind" that used to open this
    // section is deliberately gone. Australian Consumer Law guarantees cannot
    // be excluded by a term in an app, so a blanket disclaimer is not merely
    // unenforceable here — asserting it is itself a problem. The ACL
    // paragraph below replaces it.
    paragraphs: [
      "This app is provided as an informational and organisational tool for pet owners. You're responsible for verifying anything important with a qualified veterinarian before acting on it.",
      "By using this app you agree not to rely on it as a substitute for professional veterinary diagnosis, treatment, or emergency care.",
      "Nothing here excludes, restricts or modifies any guarantee, right or remedy you have under the Australian Consumer Law that cannot lawfully be excluded.",
    ],
    // Rendered after the paragraphs. A structured field rather than markup
    // inside a paragraph string, because these paragraphs are plain text by
    // design and putting HTML in one of them would mean escaping decisions in
    // every other.
    link: {
      prefix: 'Our full Terms and Conditions are at',
      url: TERMS_URL,
      label: TERMS_LABEL,
    },
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
        <p>
          Our full Privacy Policy is at{' '}
          {/* rel="noopener noreferrer" because target="_blank" otherwise hands
              the opened page a reference back to this one. */}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
            {PRIVACY_POLICY_LABEL}
          </a>
        </p>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.heading}>
          <SectionTitle>{section.heading}</SectionTitle>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {section.link && (
            <p>
              {section.link.prefix}{' '}
              <a href={section.link.url} target="_blank" rel="noopener noreferrer">
                {section.link.label}
              </a>
            </p>
          )}
        </Card>
      ))}

      <Link to="/about" className="subtle-link">Back to About</Link>
      <Link to="/terms" className="subtle-link">Terms &amp; Conditions</Link>
      <Link to="/privacy" className="subtle-link">Privacy Policy</Link>

      <Footer />
    </div>
  )
}

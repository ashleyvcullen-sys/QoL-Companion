import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import { allReferencesText } from '../lib/references'

const SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    content: [
      'By downloading, accessing, or using the QoL Companion mobile application (the "App"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, do not use the App.',
      'These Terms constitute an agreement between you and QoL Companion, operating as a sole trader under ABN 68 923 567 002 ("we," "us," "our"), not with Apple Inc. or Google LLC.',
    ],
  },
  {
    heading: '2. Eligibility',
    content: [
      'You must be at least 18 years old, or have the consent of a parent or legal guardian, to use the App. By using the App, you represent that you meet this requirement.',
    ],
  },
  {
    heading: '3. Permitted Use',
    content: [
      "We grant you a limited, non-exclusive, non-transferable, revocable license to use the App on devices you own or control, solely for your personal, non-commercial use in tracking and monitoring your own pet's wellbeing.",
      'You agree not to:',
      { list: [
        'Use the App for any unlawful purpose or in violation of any applicable law or regulation',
        'Attempt to reverse engineer, decompile, or extract the source code of the App, except where permitted by applicable law',
        'Copy, modify, distribute, sell, or lease any part of the App',
        'Use automated systems (bots, scrapers) to access or interact with the App',
        'Interfere with or disrupt the operation of the App or its underlying infrastructure',
        "Use the App to input false or misleading information about a pet's health with intent to deceive a third party (e.g., a veterinarian)",
      ] },
    ],
  },
  {
    heading: '4. Accounts',
    content: [
      'To use the App, you must create an account using a valid email address. You are responsible for maintaining the confidentiality of your account access and for all activity under your account. Notify us immediately at info@qolcompanion.com.au if you suspect unauthorized use of your account.',
      'The number of pet profiles an account may hold depends on your subscription tier. See Section 5.',
    ],
  },
  {
    heading: '5. Subscriptions and Fees',
    content: [
      // "Basic" named once, here, and used bare afterwards — Ash's
      // instruction 4 Sep 2026, after the tier was named in the app. "Free"
      // stays in this sentence deliberately: it is the word that carries the
      // meaning (it costs nothing, it does not expire), and "Basic" is a
      // product name that on its own promises nothing.
      //
      // APPROVED — Dr Ash Cullen (BSc, DVM), 4 Sep 2026.
      'QoL Companion offers a free tier, QoL Companion Basic, and a single paid subscription, QoL Companion Premium. Basic remains available and does not expire.',
      'Premium includes:',
      { list: [
        'Up to five pet profiles',
        'Body condition and weight tracking',
        'Photos and videos',
        'The ability to choose which individual measures to graph',
        'Medication tracking with reminders, and monitoring of specific diagnosed conditions, as those features become available',
      ] },
      'If a Premium subscription ends, pet profiles beyond the Basic limit are hidden rather than deleted. Your records are retained and become visible again if you resubscribe.',
      'Billing:',
      { list: [
        'Subscriptions are auto-renewing. Payment is charged to your Apple ID or Google Play account at confirmation of purchase, and renews automatically at the same price and interval unless cancelled at least 24 hours before the end of the current period',
        'The price, billing period, and renewal terms are shown to you before you purchase, and are also available on the subscription screen in the App',
        'You can manage or cancel a subscription at any time in your Apple ID or Google Play account settings. Cancelling stops future renewals; it does not refund the current period',
        'Deleting the App does not cancel a subscription',
        'Refunds are handled by Apple or Google under their own policies, not by us',
      ] },
      'If your subscription lapses, features belonging to a paid tier become unavailable, but the data you created while subscribed is not deleted. It becomes visible again if you resubscribe, and you may delete it at any time regardless of subscription status.',
      'We will not retroactively move functionality you are already using on Basic behind a paywall without reasonable notice.',
      'We may change subscription pricing or the features included in a tier. Where a change affects an active subscription, we will give reasonable notice before it takes effect, and price increases will not apply to a current billing period.',
    ],
  },
  {
    heading: '6. Disclaimers',
    content: [
      'QoL Companion is an informational and organisational tool only. It does not provide veterinary advice, diagnosis, or treatment, and does not replace consultation with a licensed veterinarian.',
      'Specifically:',
      { list: [
        'The App does not diagnose, treat, cure, or prevent any disease or condition in any animal',
        'Scoring, trends, and assessments generated by the App are based on owner-reported observations and fixed, transparent scoring rules — they are not a substitute for a physical veterinary examination',
        "Any emergency guidance provided in the App is general in nature and does not account for your specific pet's individual circumstances — always contact a veterinarian or emergency veterinary service directly for anything urgent",
        'We do not guarantee that use of the App will result in earlier detection of illness, improved outcomes, or any particular result for your pet',
      ] },
      'Medication reminders:',
      { list: [
        'Medication details, doses, and schedules are entered by you. The App does not check them, does not know what your pet has been prescribed, and cannot warn you about an incorrect dose, a missed dose, an interaction, or a contraindication',
        'Reminders are delivered by your device and depend on it being switched on, having notifications enabled and permitted for the App, and not being in a mode that suppresses them. Delivery cannot be guaranteed, and a reminder may be delayed or may not arrive at all',
        'The App must not be relied upon as the only means of ensuring a medication is given on time. Treat it as a convenience alongside your own arrangements, not as a replacement for them',
        'Marking a dose as given records only that you tapped it. It is not evidence that a medication was administered',
      ] },
      'The App is provided "as is" and "as available," without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement, except to the extent such warranties cannot be excluded under applicable consumer protection law (including the Australian Consumer Law).',
    ],
  },
  {
    heading: '7. Limitation of Liability',
    content: [
      'To the maximum extent permitted by applicable law:',
      'We will not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the App — including, without limitation, damages relating to the health or death of any animal, loss of data, or loss of profits — even if we have been advised of the possibility of such damages.',
      'Our total aggregate liability to you for any claim arising from these Terms or your use of the App will not exceed the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) AUD $100.',
      'Nothing in these Terms excludes, restricts, or modifies any right or remedy you have under the Australian Consumer Law, or any other applicable law, that cannot lawfully be excluded, restricted, or modified.',
    ],
  },
  {
    heading: '8. Intellectual Property',
    content: [
      'The App, including its design, content, source code, trademarks, and the BEAAAAPP scoring framework as implemented within the App, is owned by us or our licensors and is protected by copyright and other intellectual property laws. Except for the limited license granted in Section 3, no rights are transferred to you.',
      'Content referenced in the App is attributed to its original sources. The published instruments the App draws on are:',
      // Listed in full here as well as on the Legal & Privacy page, from the
      // same source file, so the Terms are complete on their own — an App
      // Store reviewer reading this section should not have to go and find a
      // second document. Naming two of them and pointing elsewhere for the
      // rest, which is what this said before, was not attribution.
      ...allReferencesText(),
    ],
  },
  {
    heading: '9. Your Content',
    content: [
      'Photos, videos, notes, captions, medication records and assessment answers you add to the App are yours. We claim no ownership of them.',
      'You grant us only the narrow permission needed to run the service: to store your content, and to transmit it back to you when you open the App. We do not publish it, share it, sell it, analyse it, or use it to train artificial intelligence models.',
      'You are responsible for what you upload. By adding content you confirm that:',
      { list: [
        'You have the right to upload it',
        'It relates to your own pet and to your use of the App',
        'It does not contain another identifiable person who has not agreed to appear in it',
        'It is not unlawful, and does not infringe anyone else\'s rights',
      ] },
      'We do not routinely review uploaded content, and there is no expectation that we will see it. We may remove content that we become aware is unlawful, or that is being stored in breach of these Terms.',
      'Storage is provided for the reasonable personal use described in Section 3. We may apply limits on file size, length, or total storage, and will tell you what those limits are within the App. The App may refuse a file that exceeds them.',
      'You can delete any individual photo or video at any time from within the App. Deleting removes the file itself. See the Privacy Policy for what happens to your content when a pet profile or an account is deleted.',
    ],
  },
  {
    heading: '10. Data Privacy',
    content: [
      'Your use of the App is also governed by our Privacy Policy, available on the app, which explains what information we collect and how it is used.',
    ],
  },
  {
    heading: '11. Changes to These Terms',
    content: [
      'We may update these Terms from time to time. If we make material changes, we will notify you through the App or by email before the changes take effect. Continued use of the App after changes take effect constitutes acceptance of the updated Terms.',
    ],
  },
  {
    heading: '12. Termination',
    content: [
      'You may stop using the App and delete your account at any time via the in-app "Delete Pet" and account deletion options, or by contacting us at info@qolcompanion.com.au.',
      'We may suspend or terminate your access to the App if you breach these Terms, or for any other reason with reasonable notice, except where immediate termination is warranted by unlawful conduct or risk to others.',
    ],
  },
  {
    heading: '13. Governing Law',
    content: [
      'These Terms are governed by the laws of Western Australia, Australia. Any disputes arising from these Terms will be subject to the non-exclusive jurisdiction of the courts of Western Australia.',
    ],
  },
  {
    heading: '14. Apple App Store — Additional Terms',
    content: [
      "If you downloaded the App from the Apple App Store, the following additional terms apply and take precedence over any conflicting provision above, in accordance with Apple's minimum requirements for custom End User License Agreements:",
      { list: [
        'This agreement is between you and us only, not Apple Inc. ("Apple"). Apple is not responsible for the App or its content.',
        "The license granted to you is limited to a non-transferable license to use the App on Apple-branded products that you own or control, as permitted by the App Store's usage rules.",
        'Apple has no obligation to provide maintenance or support services for the App.',
        'In the event of any failure of the App to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if any) to you. Apple has no other warranty obligation with respect to the App.',
        'We, not Apple, are responsible for addressing any claims by you or any third party relating to the App, including product liability claims, claims that the App fails to conform to legal or regulatory requirements, and claims under consumer protection or similar legislation.',
        'In the event of a third-party claim that the App infringes intellectual property rights, we, not Apple, are responsible for the investigation, defense, and resolution of such claims.',
        'You represent that you are not located in a country subject to a U.S. Government embargo, and are not on any U.S. Government list of prohibited or restricted parties.',
        'You must comply with any applicable third-party agreements (e.g., your wireless data service agreement) when using the App.',
        "Apple, and Apple's subsidiaries, are third-party beneficiaries of these Terms, and upon your acceptance, Apple has the right to enforce these Terms against you as a third-party beneficiary.",
      ] },
    ],
  },
  {
    heading: '15. Google Play — Additional Terms',
    content: [
      "If you downloaded the App from Google Play, your use is also subject to the Google Play Terms of Service. In the event of any conflict between these Terms and Google's requirements for apps distributed on Google Play, Google's requirements will prevail solely to the extent necessary for compliance.",
    ],
  },
  {
    heading: '16. Contact',
    content: [
      'Questions about these Terms can be directed to: info@qolcompanion.com.au',
    ],
  },
]

export default function Terms() {
  return (
    <div className="screen legal-doc">
      <HomeLink />

      <Card>
        <SectionTitle>Terms &amp; Conditions</SectionTitle>
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
      <Link to="/privacy" className="subtle-link">Privacy Policy</Link>

      <Footer />
    </div>
  )
}

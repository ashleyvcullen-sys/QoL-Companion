import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

const INSTAGRAM_URL = 'https://instagram.com/qol_companion'
const WEBSITE_URL = 'https://www.qolcompanion.com.au'
const SUPPORT_EMAIL = 'info@qolcompanion.com.au'

// Native gets a proper in-app browser (SFSafariViewController/Custom Tabs)
// via the Capacitor Browser plugin; web just opens a normal new tab. Either
// way this never tries to navigate the app's own WebView away to an
// external site.
async function openExternal(url) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Fixed to the viewport bottom on every screen it's rendered on, so the
// spacer below exists purely to reserve that same amount of space in normal
// document flow, wherever <Footer /> is placed — otherwise the fixed bar
// would sit on top of (hide) whatever in-flow content happens to end up
// underneath it. Its height is a static estimate matching the bar's own
// padding/line-wrap, not measured at runtime.
export default function Footer({ className = '' }) {
  return (
    <>
      <div className={`app-footer-spacer ${className}`.trim()} aria-hidden="true" />
      <div className={`app-footer ${className}`.trim()}>
        <Link to="/" state={{ startTour: true }} className="subtle-link">Take the tour</Link>
        {/* The plan, sign out, and the two irreversible deletes. Here rather
            than on Home because it is reachable from wherever the user
            happens to be when they want it, which for "cancel my
            subscription" is not necessarily the home screen. */}
        <Link to="/settings" className="subtle-link">Account Management</Link>
        <button type="button" className="subtle-link" onClick={() => openExternal(INSTAGRAM_URL)}>
          Follow us on Instagram
        </button>
        <button type="button" className="subtle-link" onClick={() => openExternal(WEBSITE_URL)}>
          Visit our website
        </button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="subtle-link">Email us</a>
        {/* The one legal link in the bar. .legal-link gives it the 44pt tap
            target the others do not have — see the note on .app-footer about
            what that costs in bar height. */}
        <Link to="/legal" className="subtle-link legal-link">Privacy, Data &amp; Legal</Link>
      </div>
    </>
  )
}

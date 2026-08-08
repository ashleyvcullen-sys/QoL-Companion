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
        <button type="button" className="subtle-link" onClick={() => openExternal(INSTAGRAM_URL)}>
          Follow us on Instagram
        </button>
        <button type="button" className="subtle-link" onClick={() => openExternal(WEBSITE_URL)}>
          Visit our website
        </button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="subtle-link">Email us</a>
        <Link to="/legal" className="subtle-link">Privacy, Data &amp; Legal</Link>
      </div>
    </>
  )
}

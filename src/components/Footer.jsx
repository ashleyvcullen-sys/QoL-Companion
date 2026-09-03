import { useEffect, useRef, useState } from 'react'
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
// underneath it.
//
// The spacer is MEASURED, not estimated. It was a flat 120px, which is the
// height the bar happens to be when its six links wrap into three rows at
// one particular width — and they wrap into two rows on a wide phone and
// four on a narrow one. Every device whose bar was not 120px tall therefore
// had either a gap under the last card or a bar sitting on top of it, which
// is what "the buttons at the bottom are misaligned on an iPhone 11" is.
//
// A ResizeObserver rather than a media query per device: the bar's height
// depends on how six variable-width links happen to wrap, which no list of
// breakpoints can predict — and it changes again with the system font size,
// which an owner can set to anything.
export default function Footer({ className = '' }) {
  const barRef = useRef(null)
  const [height, setHeight] = useState(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return undefined

    const measure = () => setHeight(bar.getBoundingClientRect().height)
    measure()

    // Not available on very old WebViews. There, `height` stays null and the
    // stylesheet's fallback applies — the old behaviour, rather than none.
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div
        className={`app-footer-spacer ${className}`.trim()}
        style={height != null ? { height } : undefined}
        aria-hidden="true"
      />
      <div ref={barRef} className={`app-footer ${className}`.trim()}>
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

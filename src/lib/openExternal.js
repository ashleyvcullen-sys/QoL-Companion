import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

// Native gets a proper in-app browser (SFSafariViewController/Custom Tabs);
// web just opens a normal new tab. Either way the app's own WebView is never
// navigated away to an external site. Lifted out of Footer so the More
// screen, which now carries the same links, opens them the same way.
export async function openExternal(url) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export const INSTAGRAM_URL = 'https://instagram.com/qol_companion'
export const WEBSITE_URL = 'https://www.qolcompanion.com.au'
export const SUPPORT_EMAIL = 'info@qolcompanion.com.au'

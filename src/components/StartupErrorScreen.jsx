import { useState } from 'react'
import { Share } from '@capacitor/share'
import Card from './Card'
import SectionTitle from './SectionTitle'
import Btn from './Btn'
import { getStartupDiagnostics, formatDiagnosticsForSharing } from '../lib/diagnostics'

// Rendered in place of a blank screen whenever the app's initial load
// sequence fails or hangs — an uncaught render error (via ErrorBoundary), or
// an auth/pets fetch that failed or timed out (see AuthContext/PetsContext).
// Deliberately uses only Card/SectionTitle/Btn — no dependency on the auth
// or pets state that may be exactly what's broken.
export default function StartupErrorScreen({ message = 'Something went wrong.', detail, onRetry }) {
  const [sharing, setSharing] = useState(false)

  async function handleShareDiagnostics() {
    setSharing(true)
    try {
      const entries = await getStartupDiagnostics()
      await Share.share({
        title: 'QoL Companion diagnostics',
        text: formatDiagnosticsForSharing(entries),
      })
    } catch (err) {
      // Sharing is a best-effort convenience here, not a critical path —
      // failing silently (beyond a console log) is fine.
      console.error('Failed to share startup diagnostics:', err)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="screen">
      <Card>
        <SectionTitle>Something went wrong</SectionTitle>
        <p>{message}</p>
        {detail && <p className="form-error" role="alert">{detail}</p>}
        {onRetry && (
          <Btn type="button" className="btn-block" onClick={onRetry}>
            Try Again
          </Btn>
        )}
        <button type="button" className="subtle-link" onClick={handleShareDiagnostics} disabled={sharing}>
          {sharing ? 'Preparing…' : 'Share Diagnostic Info'}
        </button>
      </Card>
    </div>
  )
}

// Lightweight, dependency-free diagnostic logging for failures during the
// app's initial load sequence (auth session check, pets fetch, or an
// uncaught render error) — exactly the kind of failure that would otherwise
// leave a user staring at a blank or stuck screen with nothing to report.
//
// Persisted via Capacitor Preferences (already a dependency) so entries
// survive an app restart, and exposed via getStartupDiagnostics() so a
// fallback UI can offer to share them (see StartupErrorScreen).
import { Preferences } from '@capacitor/preferences'

const DIAGNOSTICS_KEY = 'startup_diagnostics'
const MAX_ENTRIES = 20

export async function logStartupIssue(context, error, extra) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
    extra: extra ?? null,
  }

  // Always visible in the device/Xcode console immediately, independent of
  // whether the persisted write below succeeds.
  console.error(`[startup:${context}]`, entry.message, error)

  try {
    const { value } = await Preferences.get({ key: DIAGNOSTICS_KEY })
    const existing = value ? JSON.parse(value) : []
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES)
    await Preferences.set({ key: DIAGNOSTICS_KEY, value: JSON.stringify(updated) })
  } catch (storageErr) {
    // Best-effort only — logging a diagnostic must never itself become a
    // second point of failure.
    console.error('Failed to persist startup diagnostic:', storageErr)
  }
}

export async function getStartupDiagnostics() {
  try {
    const { value } = await Preferences.get({ key: DIAGNOSTICS_KEY })
    return value ? JSON.parse(value) : []
  } catch {
    return []
  }
}

export function formatDiagnosticsForSharing(entries) {
  if (entries.length === 0) return 'No startup diagnostics recorded.'
  return entries
    .map((e) => `[${e.timestamp}] ${e.context}: ${e.message}${e.stack ? `\n${e.stack}` : ''}`)
    .join('\n\n')
}

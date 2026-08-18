import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase, NATIVE_AUTH_REDIRECT } from './supabase'
import { logStartupIssue } from './diagnostics'

const AuthContext = createContext(undefined)

// How long to wait for the initial session check before treating it as
// failed rather than leaving the app on "Loading…" forever. A genuine
// network failure on supabase.auth.getSession() doesn't always reject
// promptly (or at all) — without this, an unresolved promise here would
// leave `session` at `undefined` (and therefore `loading: true`)
// indefinitely, with no error and no way for the user to recover short of
// force-quitting the app.
const SESSION_CHECK_TIMEOUT_MS = 10000

// Handles the app being reopened via the com.qolcompanion.app://login-callback
// deep link after the user taps the magic-link email on a native device.
async function handleAuthDeepLink({ url }) {
  if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return

  const { search, hash } = new URL(url)
  const params = new URLSearchParams(hash ? hash.slice(1) : search)

  const code = params.get('code')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  let error
  if (code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code))
  } else if (accessToken && refreshToken) {
    ;({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }))
  }

  if (error) {
    console.error('Failed to complete native login:', error.message)
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [authError, setAuthError] = useState(null)
  const [checkAttempt, setCheckAttempt] = useState(0)

  const retryAuth = useCallback(() => {
    setSession(undefined)
    setAuthError(null)
    setCheckAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let settled = false

    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      const timeoutError = new Error('Checking your login status took too long. Check your connection and try again.')
      logStartupIssue('auth-session-timeout', timeoutError)
      setAuthError(timeoutError.message)
    }, SESSION_CHECK_TIMEOUT_MS)

    supabase.auth.getSession()
      .then(({ data }) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        setSession(data.session)
      })
      .catch((err) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        logStartupIssue('auth-session-failed', err)
        setAuthError(err?.message || 'Failed to check your login status.')
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    const urlOpenListener = Capacitor.isNativePlatform()
      ? App.addListener('appUrlOpen', handleAuthDeepLink)
      : null

    return () => {
      clearTimeout(timeoutId)
      listener.subscription.unsubscribe()
      urlOpenListener?.then((handle) => handle.remove())
    }
  }, [checkAttempt])

  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined && !authError,
    authError,
    retryAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

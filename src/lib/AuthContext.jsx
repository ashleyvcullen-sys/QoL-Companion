import { createContext, useContext, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase, NATIVE_AUTH_REDIRECT } from './supabase'

const AuthContext = createContext(undefined)

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    const urlOpenListener = Capacitor.isNativePlatform()
      ? App.addListener('appUrlOpen', handleAuthDeepLink)
      : null

    return () => {
      listener.subscription.unsubscribe()
      urlOpenListener?.then((handle) => handle.remove())
    }
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import { createContext, useContext, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase, NATIVE_AUTH_REDIRECT } from './supabase'

const AuthContext = createContext(undefined)

// Handles the app being reopened via the com.qolcompanion.app://login-callback
// deep link after the user taps the magic-link email on a native device.
async function handleAuthDeepLink({ url }) {
  console.log('[appUrlOpen] received url:', url)

  if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return

  const { search, hash } = new URL(url)
  const params = new URLSearchParams(hash ? hash.slice(1) : search)

  const code = params.get('code')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  console.log('[appUrlOpen] parsed params:', {
    code,
    accessToken: accessToken ? `${accessToken.slice(0, 8)}…` : null,
    refreshToken: refreshToken ? `${refreshToken.slice(0, 8)}…` : null,
    allParams: Object.fromEntries(params),
  })

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[appUrlOpen] exchangeCodeForSession result:', { data, error })
  } else if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    console.log('[appUrlOpen] setSession result:', { data, error })
  } else {
    console.log('[appUrlOpen] no code or access_token/refresh_token found in URL')
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

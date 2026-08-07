import { createContext, useContext, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './supabase'

const AuthContext = createContext(undefined)

const NATIVE_LOGIN_CALLBACK_URL = 'com.qolcompanion.app://login-callback'

// When the magic-link email is opened on a native device, iOS hands the
// custom-scheme URL back to us via the appUrlOpen event instead of a normal
// page load. Pull the session out of it and hand it to supabase-js so the
// rest of the app sees the same auth state it would on the web.
async function completeNativeLoginFromUrl(url) {
  if (!url.startsWith(NATIVE_LOGIN_CALLBACK_URL)) return

  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.hash ? parsed.hash.slice(1) : parsed.search)

  const code = params.get('code')
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    return
  }

  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token })
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    if (!Capacitor.isNativePlatform()) {
      return () => listener.subscription.unsubscribe()
    }

    const urlListenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      completeNativeLoginFromUrl(url)
    })

    return () => {
      listener.subscription.unsubscribe()
      urlListenerPromise.then((urlListener) => urlListener.remove())
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

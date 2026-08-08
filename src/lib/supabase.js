import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Custom URL scheme registered in ios/App/App/Info.plist (CFBundleURLTypes).
// Used as the magic-link redirect target when running inside the native app,
// since window.location.origin resolves to capacitor://localhost there.
export const NATIVE_AUTH_REDIRECT = 'com.qolcompanion.app://login-callback'

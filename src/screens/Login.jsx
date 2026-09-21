import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase, NATIVE_AUTH_REDIRECT } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import StartupErrorScreen from '../components/StartupErrorScreen'

export default function Login() {
  const { user, loading, authError, retryAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // A failed/timed-out session check would otherwise leave `loading` true
  // forever, stranding even a signed-out user on a bare "Loading…" before
  // they ever see the login form.
  if (authError) {
    return <StartupErrorScreen message="We couldn't check your login status." detail={authError} onRetry={retryAuth} />
  }
  if (loading) return <p>Loading…</p>
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    const emailRedirectTo = Capacitor.isNativePlatform()
      ? NATIVE_AUTH_REDIRECT
      : window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
    if (error) {
      setErrorMessage(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div className="screen">
        <Card>
          <SectionTitle>Check Your Email</SectionTitle>
          <p>We sent a login link to {email}.</p>
          {/* The single most common reason someone sits on this screen and
              gives up. Said here rather than only in support: by the time a
              person emails to say the link never arrived, they have usually
              already decided the app does not work.
              //
              APPROVED — Dr Ash Cullen (BSc, DVM), 13 Sep 2026. */}
          <p className="assessment-hint">
            It should arrive within a minute. If you can't see it, check your junk
            or spam folder — and add us to your contacts so the next one reaches
            your inbox.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="screen">
      <Card>
        <SectionTitle>Log In</SectionTitle>
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="assessment-hint">
              No password needed — we'll email you a secure link to tap.
            </p>
          </div>
          <Btn type="submit" className="btn-block" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </Btn>
          {status === 'error' && <p className="form-error" role="alert">{errorMessage}</p>}
        </form>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase, NATIVE_AUTH_REDIRECT } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'

export default function Login() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

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
          <SectionTitle>Check your email</SectionTitle>
          <p>We sent a login link to {email}.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="screen">
      <Card>
        <SectionTitle>Log in</SectionTitle>
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
              We'll use this to create your account (or sign you in, if you already have
              one) — no password needed. We'll email you a secure link to tap instead.
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
